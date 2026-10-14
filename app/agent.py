
import os
import logging
from typing import Optional, Literal
from pydantic import BaseModel, Field
import instructor
from groq import AsyncGroq
import asyncio

from .config import ComplaintCategory, CONFIDENCE_THRESHOLD

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ComplaintExtraction(BaseModel):
    """Pydantic model for structured complaint extraction"""
    
    category: ComplaintCategory
    summary: str = Field(max_length=150, description="One-sentence summary of the complaint")
    sentiment: Literal["positive", "neutral", "negative"] = Field(
        description="Sentiment of the complaint message"
    )
    vulnerable_group_flag: bool = Field(
        description="True if the complaint mentions elderly, children, disabled, or other vulnerable groups"
    )
    missing_field: Optional[Literal["category", "location", "description"]] = Field(
        default=None, 
        description="The most important field that is missing from the complaint. null if all fields are present"
    )
    confidence: float = Field(
        ge=0.0, le=1.0,
        description="Confidence score between 0.0 and 1.0 for the extraction quality"
    )


class AgentClient:
    """AI Agent client with Groq Llama integration and LiteLLM fallback"""
    
    def __init__(self):
        self.groq_api_key = os.getenv("GROQ_API_KEY")
        self.groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        
        if not self.groq_api_key:
            logger.warning("GROQ_API_KEY not found in environment. Agent will not function properly.")
            
        # Initialize Groq client with Instructor
        self.groq_client = None
        if self.groq_api_key:
            base_client = AsyncGroq(api_key=self.groq_api_key)
            self.groq_client = instructor.patch(base_client)
    
    async def extract_complaint(
        self, 
        message: str, 
        context: Optional[dict] = None
    ) -> ComplaintExtraction:
        """
        Extract structured complaint data from user message using AI
        
        Args:
            message: The user's complaint message
            context: Optional context like location, previous conversation
            
        Returns:
            ComplaintExtraction: Structured complaint data
            
        Raises:
            Exception: If both Groq and LiteLLM fail
        """
        if not message or not message.strip():
            raise ValueError("Message cannot be empty")
            
        # Build system prompt
        system_prompt = self._build_system_prompt()
        
        # Build user prompt with context
        user_prompt = self._build_user_prompt(message, context)
        
        try:
            # Try Groq first
            result = await self._extract_with_groq(system_prompt, user_prompt)
            logger.info(f"Groq extraction successful with confidence: {result.confidence}")
            return result
            
        except Exception as groq_error:
            logger.warning(f"Groq extraction failed: {groq_error}")
            
            try:
                # Fallback to LiteLLM
                result = await self._extract_with_litellm(system_prompt, user_prompt)
                logger.info(f"LiteLLM fallback successful with confidence: {result.confidence}")
                return result
                
            except Exception as litellm_error:
                logger.error(f"LiteLLM fallback also failed: {litellm_error}")
                
                # Return low-confidence extraction that will trigger human review
                return ComplaintExtraction(
                    category=ComplaintCategory.OTHER,
                    summary="Unable to extract complaint details automatically",
                    sentiment="neutral",
                    vulnerable_group_flag=False,
                    missing_field="description",
                    confidence=0.0  # Low confidence triggers human review
                )
    
    async def _extract_with_groq(self, system_prompt: str, user_prompt: str) -> ComplaintExtraction:
        """Extract using Groq Llama with Instructor"""
        if not self.groq_client:
            raise Exception("Groq client not initialized")
            
        response = await self.groq_client.chat.completions.create(
            model=self.groq_model,
            response_model=ComplaintExtraction,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=1000,
            temperature=0.1,
            timeout=10.0
        )
        
        return response
    
    async def _extract_with_litellm(self, system_prompt: str, user_prompt: str) -> ComplaintExtraction:
        """Fallback extraction using Gemini 1.5 Flash via LiteLLM or direct Google GenerativeAI"""
        google_key = os.getenv("GOOGLE_API_KEY")
        
        # 1. Try Gemini 1.5 Flash via LiteLLM if available
        try:
            import litellm
            model_name = "gemini/gemini-1.5-flash" if google_key else "gpt-3.5-turbo"
            extra_kwargs = {"api_key": google_key} if google_key else {}
            
            response = await litellm.acompletion(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_prompt + "\nReturn ONLY valid JSON matching ComplaintExtraction schema."},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=1000,
                temperature=0.1,
                timeout=12.0,
                **extra_kwargs
            )
            
            content = response.choices[0].message.content
            if content:
                import json
                cleaned = content.strip().replace("```json", "").replace("```", "").strip()
                data = json.loads(cleaned)
                return ComplaintExtraction(**data)
        except Exception as litellm_err:
            logger.warning(f"LiteLLM Gemini fallback failed: {litellm_err}, attempting direct Gemini client")

        # 2. Try direct Google Gemini GenerativeModel fallback
        if google_key:
            try:
                import google.generativeai as genai
                import json
                genai.configure(api_key=google_key)
                model = genai.GenerativeModel("gemini-1.5-flash")
                prompt_full = f"{system_prompt}\n\n{user_prompt}\n\nIMPORTANT: Respond ONLY with valid JSON with keys: category, summary, sentiment, vulnerable_group_flag, missing_field, confidence."
                gemini_resp = await asyncio.to_thread(model.generate_content, prompt_full)
                if gemini_resp and gemini_resp.text:
                    cleaned = gemini_resp.text.strip().replace("```json", "").replace("```", "").strip()
                    data = json.loads(cleaned)
                    return ComplaintExtraction(**data)
            except Exception as direct_gemini_err:
                logger.error(f"Direct Gemini fallback error: {direct_gemini_err}")

        # 3. Safe fallback triggering human review
        return ComplaintExtraction(
            category=ComplaintCategory.OTHER,
            summary="Complaint processed via fallback service (queued for review)",
            sentiment="neutral", 
            vulnerable_group_flag=False,
            missing_field="description",
            confidence=0.4
        )
    
    def _build_system_prompt(self) -> str:
        """Build the system prompt for complaint extraction with bilingual Urdu/English few-shot learning"""
        categories = ", ".join([cat.value for cat in ComplaintCategory])
        
        return f"""You are an expert bilingual AI assistant for CivicFix, an intelligent municipal complaint triage platform. Your job is to extract structured information from citizen complaints in English, Urdu (Nastaliq script), and Roman Urdu (Urdu in English alphabet).

COMPLAINT CATEGORIES:
{categories}

INSTRUCTIONS:
1. Extract the complaint category from the provided list that best matches the issue.
2. Create a concise one-sentence English summary (max 150 characters) clearly summarizing the problem.
3. Determine sentiment: positive, neutral, or negative.
4. Check if vulnerable groups are mentioned (elderly, children, disabled, pregnant women, hospital patients, school students).
5. Identify if any critical field is missing: category, location, or description.
6. Provide an objective confidence score (0.0-1.0) for your extraction quality.

MULTILINGUAL URDU FEW-SHOT EXAMPLES:
- Roman Urdu: "Hamaray mohallay G-9/2 main ganda nala toot gaya hai aur kachra sadak par phel gaya hai, school k bachay guzar nahi saktay"
  -> category: "drainage", summary: "Overflowing sewer and waste blocking street in G-9/2 near school", vulnerable_group_flag: true, missing_field: null, confidence: 0.95

- Nastaliq Urdu: "مین روڈ پر گہرا کھڈا ہے جس سے گاڑیاں حادثے کا شکار ہو رہی ہیں، فوری مرمت کروائیں"
  -> category: "roads", summary: "Hazardous deep pothole on main road causing vehicle accidents", vulnerable_group_flag: false, missing_field: "location", confidence: 0.85

- Roman Urdu: "Bijli ka khamba jhuk gaya hai aur nangi taarein latak rahi hain barish main aag lag sakti hai"
  -> category: "electricity", summary: "Leaning electricity pole with hazardous live exposed wires", vulnerable_group_flag: false, missing_field: "location", confidence: 0.90

MISSING FIELDS LOGIC:
- category: Cannot determine what type of municipal issue this is from the categories above.
- location: No specific location, street name, sector, or nearby landmark mentioned in message or context.
- description: Complaint is too vague (e.g., "help", "problem here") to describe what is broken.

CONFIDENCE SCORING:
- 0.9-1.0: Very clear complaint with problem and location.
- 0.7-0.9: Good complaint with minor ambiguity or implied location.
- 0.5-0.7: Adequate complaint but missing location or specific detail.
- 0.0-0.4: Vague or unclear complaint requiring human review.

Respond ONLY with the structured JSON format."""

    def _build_user_prompt(self, message: str, context: Optional[dict] = None) -> str:
        """Build the user prompt with message and optional context"""
        prompt = f"Complaint Message: {message}"
        
        if context:
            if context.get("location"):
                prompt += f"\nLocation Context: {context['location']}"
            if context.get("previous_messages"):
                prompt += f"\nPrevious Context: {context['previous_messages']}"
        
        return prompt
    
    async def generate_clarifying_question(self, missing_field: str, context: Optional[dict] = None) -> str:
        """Generate appropriate follow-up question for missing field"""
        questions = {
            "category": "Could you please describe what type of issue this is? For example, is it related to roads, water, garbage collection, streetlights, or something else?",
            "location": "Could you please tell me the location of this issue? Please provide the area name, street name, or nearby landmarks.",
            "description": "Could you please provide more details about the problem? What exactly is happening and how is it affecting you or others?"
        }
        
        base_question = questions.get(missing_field, "Could you please provide more information about your complaint?")
        
        # Add contextual variations for Urdu speakers
        if context and context.get("language") == "ur":
            urdu_questions = {
                "category": "کیا آپ بتا سکتے ہیں یہ کس قسم کا مسئلہ ہے؟ مثلاً سڑک، پانی، صفائی، بجلی کا کھمبا، یا کوئی اور؟",
                "location": "کیا آپ اس مسئلے کی جگہ بتا سکتے ہیں؟ علاقے کا نام، گلی کا نام، یا کوئی معروف جگہ؟",
                "description": "کیا آپ اس مسئلے کے بارے میں تفصیل سے بتا سکتے ہیں؟ اصل میں کیا ہو رہا ہے اور یہ آپ کو کیسے متاثر کر رہا ہے؟"
            }
            return urdu_questions.get(missing_field, "کیا آپ اپنی شکایت کے بارے میں مزید معلومات فراہم کر سکتے ہیں؟")
        
        return base_question


# Global agent client instance
_agent_client = None

def get_agent_client() -> AgentClient:
    """Get the global agent client instance"""
    global _agent_client
    if _agent_client is None:
        _agent_client = AgentClient()
    return _agent_client


async def extract_complaint(
    message: str, 
    context: Optional[dict] = None
) -> ComplaintExtraction:
    """
    Main function to extract structured complaint data from user message
    
    Args:
        message: The user's complaint message
        context: Optional context like location, previous conversation
        
    Returns:
        ComplaintExtraction: Structured complaint data with confidence scoring
        
    Raises:
        ValueError: If message is empty
    """
    agent = get_agent_client()
    return await agent.extract_complaint(message, context)


async def generate_clarifying_question(
    missing_field: str, 
    context: Optional[dict] = None
) -> str:
    """
    Generate appropriate follow-up question for missing field
    
    Args:
        missing_field: The field that needs clarification ('category', 'location', 'description')
        context: Optional context like language preference
        
    Returns:
        str: Appropriate clarifying question
    """
    agent = get_agent_client()
    return await agent.generate_clarifying_question(missing_field, context)


def should_trigger_human_review(extraction: ComplaintExtraction) -> bool:
    """
    Determine if extraction should be sent to human review queue
    
    Args:
        extraction: The ComplaintExtraction result
        
    Returns:
        bool: True if human review is needed
    """
    return extraction.confidence < CONFIDENCE_THRESHOLD


def create_mock_extraction(message: str, missing_field: Optional[str] = None) -> ComplaintExtraction:
    """
    Create a mock extraction for development/testing without API calls
    
    Args:
        message: The complaint message
        missing_field: Optional missing field to simulate slot-filling
        
    Returns:
        ComplaintExtraction: Mock extraction result
    """
    # Simple keyword-based category detection for mock
    message_lower = message.lower()
    
    if any(word in message_lower for word in ["pothole", "hole", "road damage"]):
        category = ComplaintCategory.POTHOLE
    elif any(word in message_lower for word in ["water", "leak", "pipe", "burst"]):
        category = ComplaintCategory.WATER_LEAK
    elif any(word in message_lower for word in ["garbage", "trash", "waste", "dump"]):
        category = ComplaintCategory.GARBAGE
    elif any(word in message_lower for word in ["light", "street light", "lamp", "bulb"]):
        category = ComplaintCategory.STREETLIGHT
    elif any(word in message_lower for word in ["sewage", "drain", "sewer", "smell"]):
        category = ComplaintCategory.SEWAGE
    else:
        category = ComplaintCategory.OTHER
    
    # Mock sentiment detection
    if any(word in message_lower for word in ["angry", "terrible", "awful", "horrible", "worst"]):
        sentiment = "negative"
    elif any(word in message_lower for word in ["good", "thank", "appreciate", "great"]):
        sentiment = "positive"
    else:
        sentiment = "neutral"
    
    # Mock vulnerable group detection
    vulnerable_groups = ["elderly", "child", "children", "disabled", "pregnant", "old", "baby"]
    vulnerable_group_flag = any(word in message_lower for word in vulnerable_groups)
    
    # Generate summary
    summary = f"{category.value.title()} issue reported"
    if len(message) > 20:
        summary = message[:147] + "..." if len(message) > 150 else message
    
    # Mock confidence based on message length and completeness
    has_location = any(word in message_lower for word in ["street", "road", "near", "area", "lane", "avenue"])
    is_detailed = len(message.split()) >= 5
    
    confidence = 0.6  # Base confidence
    if has_location:
        confidence += 0.2
    if is_detailed:
        confidence += 0.2
    if missing_field:
        confidence -= 0.3
    
    confidence = max(0.0, min(1.0, confidence))  # Clamp to [0, 1]
    
    return ComplaintExtraction(
        category=category,
        summary=summary,
        sentiment=sentiment,
        vulnerable_group_flag=vulnerable_group_flag,
        missing_field=missing_field,
        confidence=confidence
    )

# Utility functions for FastAPI integration
def format_chat_response(
    extraction: ComplaintExtraction, 
    tracking_id: Optional[str] = None,
    urgency_score: Optional[int] = None,
    urgency_reasons: Optional[list] = None
) -> dict:
    """
    Format agent extraction result for /chat endpoint response
    
    Args:
        extraction: The ComplaintExtraction result
        tracking_id: Optional tracking ID if complaint was submitted
        urgency_score: Optional urgency score if computed
        urgency_reasons: Optional urgency scoring reasons
        
    Returns:
        dict: Formatted response for chat endpoint
    """
    if extraction.missing_field:
        # Fields still being collected
        return {
            "reply": f"I understand you're reporting a {extraction.category.value} issue. " + 
                    f"To help you better, could you please provide more details about the {extraction.missing_field}?",
            "tracking_id": None,
            "status": "collecting",
            "needs_clarification": True,
            "missing_field": extraction.missing_field,
            "confidence": extraction.confidence
        }
    else:
        # All fields collected, complaint can be submitted
        response = {
            "reply": f"Thank you for reporting this {extraction.category.value} issue. " +
                    (f"Your tracking ID is {tracking_id}." if tracking_id else "Processing your complaint..."),
            "tracking_id": tracking_id,
            "status": "submitted",
            "needs_clarification": False,
            "category": extraction.category.value,
            "summary": extraction.summary,
            "sentiment": extraction.sentiment,
            "confidence": extraction.confidence
        }
        
        if urgency_score is not None:
            response["urgency_score"] = urgency_score
        
        if urgency_reasons:
            response["urgency_reasons"] = urgency_reasons
            
        if should_trigger_human_review(extraction):
            response["reply"] += " This complaint has been flagged for human review to ensure accuracy."
            response["needs_human_review"] = True
        
        return response


async def process_chat_message(
    message: str,
    context: Optional[dict] = None,
    use_mock: bool = False
) -> dict:
    """
    Process a chat message through the agent pipeline
    
    Args:
        message: The user's message
        context: Optional context (location, session history, etc.)
        use_mock: Whether to use mock extraction for development
        
    Returns:
        dict: Formatted chat response
    """
    try:
        if use_mock:
            # For development without API keys
            extraction = create_mock_extraction(message)
        else:
            # Production extraction with Groq/LiteLLM
            extraction = await extract_complaint(message, context)
        
        return format_chat_response(extraction)
        
    except Exception as e:
        logger.error(f"Chat message processing failed: {e}")
        
        # Fallback response
        fallback_extraction = ComplaintExtraction(
            category=ComplaintCategory.OTHER,
            summary="Technical issue during processing",
            sentiment="neutral",
            vulnerable_group_flag=False,
            missing_field="description",
            confidence=0.0
        )
        
        response = format_chat_response(fallback_extraction)
        response["reply"] = "I'm having trouble processing your message right now. Could you please try again or provide more details?"
        response["error"] = "processing_error"
        
        return response


# Integration test function
async def test_agent_integration():
    """Test agent integration without external dependencies"""
    print("🤖 Testing CivicFix AI Agent Integration")
    
    test_messages = [
        "There is a big pothole on Main Street",
        "Water is leaking from the pipe", 
        "Streetlight not working",
        "Garbage not collected",
        "Road damaged"
    ]
    
    for message in test_messages:
        print(f"\n📝 Testing: '{message}'")
        try:
            # Test with mock extraction
            response = await process_chat_message(message, use_mock=True)
            print(f"   Category: {response.get('category', 'N/A')}")
            print(f"   Status: {response.get('status', 'N/A')}")
            print(f"   Confidence: {response.get('confidence', 'N/A')}")
            print(f"   Reply: {response.get('reply', 'N/A')[:100]}...")
            
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    print("\n✅ Agent integration test complete")


if __name__ == "__main__":
    # Run integration test when called directly
    import asyncio
    asyncio.run(test_agent_integration())
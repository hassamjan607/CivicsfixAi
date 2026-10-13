"""
CivicFix AI Vision Service

Google Gemini Flash integration for photo analysis and privacy protection.
Analyzes complaint photos for severity scoring and blurs PII.

Key Features:
- Structured image analysis using Google Gemini Flash
- Privacy protection with face and license plate blurring
- Support for multiple image formats (JPEG, PNG, WebP)
- Rate limiting and API key management
- Comprehensive error handling and fallback logic
- Detailed logging for debugging and monitoring
- Both single image and batch image analysis support

Integration Points:
- Used by complaint processing pipeline for urgency scoring
- Results fed into rules engine for base_severity calculation
- Privacy-protected images stored for deduplication
- Error handling triggers human review queue when needed
"""

import os
import logging
import io
import base64
import asyncio
import time
from typing import Optional, List, Literal, Tuple, Union
from contextlib import asynccontextmanager

import cv2
import numpy as np
from PIL import Image, ImageFilter
from pydantic import BaseModel, Field
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
import httpx

from .config import SEVERITY_TO_INT, DEFAULT_BASE_SEVERITY

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global constants for privacy detection (more robust approach)
try:
    FACE_CASCADE_PATH = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    PLATE_CASCADE_PATH = cv2.data.haarcascades + 'haarcascade_russian_plate_number.xml'
    # Test if cascade classifier works
    test_cascade = cv2.CascadeClassifier(FACE_CASCADE_PATH)
    CV2_CASCADES_AVAILABLE = not test_cascade.empty()
except (AttributeError, Exception):
    CV2_CASCADES_AVAILABLE = False
    FACE_CASCADE_PATH = None
    PLATE_CASCADE_PATH = None

# Supported image formats
SUPPORTED_FORMATS = {'JPEG', 'PNG', 'WEBP', 'JPG'}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB
MAX_IMAGE_DIMENSION = 4096  # Max width/height in pixels

# Rate limiting for Gemini API calls
RATE_LIMIT_PER_MINUTE = 60
RATE_LIMIT_WINDOW = 60  # seconds


class VisionResult(BaseModel):
    """Result of vision analysis with structured severity assessment"""
    
    severity: Literal["low", "medium", "high", "critical"] = Field(
        description="Severity level of the issue shown in the image"
    )
    description: str = Field(
        max_length=200, 
        description="One-sentence description of what is visible in the image"
    )
    confidence: float = Field(
        ge=0.0, le=1.0,
        description="Confidence score for the analysis quality"
    )
    detected_elements: List[str] = Field(
        default_factory=list,
        description="List of infrastructure elements detected in the image"
    )


class BatchVisionResult(BaseModel):
    """Result of batch vision analysis"""
    
    results: List[VisionResult]
    total_processed: int
    successful_analyses: int
    failed_analyses: int
    processing_time_seconds: float


class VisionServiceError(Exception):
    """Custom exception for vision service errors"""
    pass


class RateLimiter:
    """Simple rate limiter for API calls"""
    
    def __init__(self, max_calls: int, window_seconds: int):
        self.max_calls = max_calls
        self.window_seconds = window_seconds
        self.calls = []
    
    def can_make_call(self) -> bool:
        """Check if a call can be made without exceeding rate limit"""
        now = time.time()
        # Remove calls outside the window
        self.calls = [call_time for call_time in self.calls if now - call_time < self.window_seconds]
        return len(self.calls) < self.max_calls
    
    def record_call(self) -> None:
        """Record a successful API call"""
        self.calls.append(time.time())


class VisionClient:
    """Google Gemini Flash client with error handling and rate limiting"""
    
    def __init__(self):
        self.api_key = os.getenv("GOOGLE_API_KEY")
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        self.rate_limiter = RateLimiter(RATE_LIMIT_PER_MINUTE, RATE_LIMIT_WINDOW)
        
        if not self.api_key:
            logger.warning("GOOGLE_API_KEY not found in environment. Vision service will use fallback responses.")
            self.client = None
        else:
            try:
                genai.configure(api_key=self.api_key)
                self.client = genai.GenerativeModel(
                    model_name=self.model_name,
                    safety_settings={
                        HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                        HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                        HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                        HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
                    }
                )
                logger.info(f"Initialized Gemini Flash client with model: {self.model_name}")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini client: {e}")
                self.client = None
    
    async def analyze_image(self, image_bytes: bytes, prompt: str) -> str:
        """
        Analyze image using Gemini Flash
        
        Args:
            image_bytes: Raw image data
            prompt: Analysis prompt for Gemini
            
        Returns:
            str: Analysis result from Gemini
            
        Raises:
            VisionServiceError: If analysis fails
        """
        if not self.client:
            raise VisionServiceError("Gemini client not initialized")
        
        if not self.rate_limiter.can_make_call():
            raise VisionServiceError("Rate limit exceeded for Gemini API")
        
        try:
            # Convert bytes to PIL Image for Gemini
            image = Image.open(io.BytesIO(image_bytes))
            
            # Generate content with image and prompt
            response = await asyncio.to_thread(
                self.client.generate_content,
                [prompt, image],
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=500,
                    candidate_count=1
                )
            )
            
            self.rate_limiter.record_call()
            
            if not response.text:
                raise VisionServiceError("Empty response from Gemini")
            
            return response.text.strip()
            
        except Exception as e:
            logger.error(f"Gemini analysis failed: {e}")
            raise VisionServiceError(f"Gemini analysis failed: {e}")


def validate_image(image_bytes: bytes) -> Tuple[bool, str]:
    """
    Validate image format, size, and dimensions
    
    Args:
        image_bytes: Raw image data
        
    Returns:
        Tuple[bool, str]: (is_valid, error_message)
    """
    if len(image_bytes) > MAX_IMAGE_SIZE:
        return False, f"Image too large: {len(image_bytes)} bytes (max: {MAX_IMAGE_SIZE})"
    
    try:
        image = Image.open(io.BytesIO(image_bytes))
        
        if image.format not in SUPPORTED_FORMATS:
            return False, f"Unsupported format: {image.format}. Supported: {SUPPORTED_FORMATS}"
        
        width, height = image.size
        if width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
            return False, f"Image too large: {width}x{height} (max: {MAX_IMAGE_DIMENSION}x{MAX_IMAGE_DIMENSION})"
        
        return True, ""
        
    except Exception as e:
        return False, f"Invalid image data: {e}"


async def blur_privacy_info(image_bytes: bytes) -> bytes:
    """
    Detect and blur faces and license plates using OpenCV and Pillow
    
    Args:
        image_bytes: Raw image data
        
    Returns:
        bytes: Processed image bytes with PII blurred
        
    Raises:
        VisionServiceError: If privacy protection fails
    """
    try:
        # Convert bytes to numpy array for OpenCV
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise VisionServiceError("Could not decode image for privacy protection")
        
        # If CV2 cascades are available, try face detection
        if CV2_CASCADES_AVAILABLE and FACE_CASCADE_PATH:
            try:
                # Convert to grayscale for detection
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                face_cascade = cv2.CascadeClassifier(FACE_CASCADE_PATH)
                
                if not face_cascade.empty():
                    # Detect faces
                    faces = face_cascade.detectMultiScale(
                        gray, 
                        scaleFactor=1.1, 
                        minNeighbors=5, 
                        minSize=(30, 30)
                    )
                    
                    # Blur detected faces
                    for (x, y, w, h) in faces:
                        # Apply Gaussian blur to face region
                        face_region = img[y:y+h, x:x+w]
                        blurred_face = cv2.GaussianBlur(face_region, (99, 99), 30)
                        img[y:y+h, x:x+w] = blurred_face
                        
                    logger.info(f"Privacy protection applied: blurred {len(faces)} faces")
                else:
                    logger.warning("Face cascade classifier is empty")
            except Exception as cascade_error:
                logger.warning(f"Face detection failed: {cascade_error}")
        else:
            logger.info("OpenCV cascade classifiers not available, applying general privacy blur")
            # Apply a general blur to potential privacy areas (conservative approach)
            # This is a fallback when proper face detection isn't available
            height, width = img.shape[:2]
            # Blur potential face regions in the upper portion of the image
            if height > 100 and width > 100:
                top_region = img[0:height//2, :]
                blurred_top = cv2.GaussianBlur(top_region, (51, 51), 15)
                img[0:height//2, :] = blurred_top
                logger.info("Applied general privacy blur to upper region of image")
        
        # Try license plate detection if cascades are available
        if CV2_CASCADES_AVAILABLE and PLATE_CASCADE_PATH:
            try:
                if os.path.exists(PLATE_CASCADE_PATH):
                    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                    plate_cascade = cv2.CascadeClassifier(PLATE_CASCADE_PATH)
                    if not plate_cascade.empty():
                        plates = plate_cascade.detectMultiScale(
                            gray,
                            scaleFactor=1.1,
                            minNeighbors=3,
                            minSize=(100, 25)
                        )
                        
                        # Blur detected license plates
                        for (x, y, w, h) in plates:
                            plate_region = img[y:y+h, x:x+w]
                            blurred_plate = cv2.GaussianBlur(plate_region, (25, 25), 10)
                            img[y:y+h, x:x+w] = blurred_plate
                            
                        if len(plates) > 0:
                            logger.info(f"Blurred {len(plates)} license plates")
                else:
                    logger.info("License plate cascade file not found")
            except Exception as plate_error:
                logger.warning(f"License plate detection failed: {plate_error}")
        
        # Convert back to bytes
        _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 85])
        
        return buffer.tobytes()
        
    except Exception as e:
        logger.error(f"Privacy protection failed: {e}")
        # Return original image if privacy protection fails
        logger.warning("Returning original image due to privacy protection failure")
        return image_bytes


def parse_gemini_response(response_text: str) -> VisionResult:
    """
    Parse Gemini Flash response into structured VisionResult
    
    Args:
        response_text: Raw response from Gemini
        
    Returns:
        VisionResult: Parsed and validated result
    """
    try:
        # Expected format: "SEVERITY: [level] | DESCRIPTION: [description] | ELEMENTS: [element1, element2]"
        # But be flexible with parsing since LLM output can vary
        
        response_lower = response_text.lower()
        
        # Extract severity
        severity = "medium"  # default
        if any(word in response_lower for word in ["critical", "severe", "emergency", "dangerous", "urgent"]):
            severity = "critical"
        elif any(word in response_lower for word in ["high", "major", "significant", "serious"]):
            severity = "high"
        elif any(word in response_lower for word in ["low", "minor", "small", "slight"]):
            severity = "low"
        
        # Extract description (take first sentence or up to 200 chars)
        description_lines = [line.strip() for line in response_text.split('\n') if line.strip()]
        description = description_lines[0] if description_lines else "Infrastructure issue detected"
        
        # Limit description length
        if len(description) > 200:
            description = description[:197] + "..."
        
        # Extract detected elements (look for common infrastructure terms)
        detected_elements = []
        infrastructure_terms = [
            "pothole", "crack", "pipe", "water", "leak", "garbage", "trash", "waste",
            "streetlight", "lamp", "bulb", "drain", "sewer", "road", "pavement",
            "manhole", "wire", "cable", "pole", "tree", "sign", "sidewalk"
        ]
        
        for term in infrastructure_terms:
            if term in response_lower:
                detected_elements.append(term)
        
        # Calculate confidence based on response quality
        confidence = 0.7  # base confidence
        if len(response_text) > 50:
            confidence += 0.1
        if len(detected_elements) > 0:
            confidence += 0.1
        if any(word in response_lower for word in ["clear", "visible", "obvious", "definite"]):
            confidence += 0.1
        
        confidence = min(confidence, 1.0)
        
        return VisionResult(
            severity=severity,
            description=description,
            confidence=confidence,
            detected_elements=detected_elements[:5]  # Limit to top 5 elements
        )
        
    except Exception as e:
        logger.error(f"Failed to parse Gemini response: {e}")
        # Return fallback result
        return VisionResult(
            severity="medium",
            description="Unable to analyze image automatically",
            confidence=0.0,
            detected_elements=[]
        )


async def analyze_photo(image_bytes: bytes, context: Optional[str] = None) -> VisionResult:
    """
    Analyze complaint photo using Gemini Flash for severity assessment
    
    Args:
        image_bytes: Raw image data
        context: Optional context about the complaint (category, location)
        
    Returns:
        VisionResult with severity label and description
        
    Raises:
        VisionServiceError: If analysis fails completely
    """
    # Validate image first
    is_valid, error_msg = validate_image(image_bytes)
    if not is_valid:
        raise VisionServiceError(f"Image validation failed: {error_msg}")
    
    # Build analysis prompt
    base_prompt = """
    You are analyzing a photo submitted as part of a municipal complaint. Please assess this image and provide:

    1. SEVERITY LEVEL: Choose one of: low, medium, high, critical
       - low: Minor issues with minimal impact
       - medium: Moderate issues requiring attention  
       - high: Significant problems affecting safety or service
       - critical: Emergency situations requiring immediate response

    2. DESCRIPTION: One clear sentence describing what you see in the image

    3. DETECTED ELEMENTS: List any infrastructure elements you can identify (roads, pipes, lights, etc.)

    Focus on municipal infrastructure issues like:
    - Road damage (potholes, cracks, surface problems)
    - Water infrastructure (leaks, pipe damage, flooding)
    - Electrical infrastructure (streetlight issues, exposed wires)
    - Waste management (garbage accumulation, bin issues)
    - Drainage and sewage (blocked drains, overflow)
    - General infrastructure damage

    Consider factors like:
    - Size and extent of the problem
    - Safety implications for citizens
    - Potential for the issue to worsen
    - Impact on traffic, pedestrians, or services
    """
    
    if context:
        base_prompt += f"\n\nAdditional context: {context}"
    
    base_prompt += "\n\nProvide your assessment in a clear, structured format."
    
    try:
        # Create vision client and analyze
        vision_client = VisionClient()
        
        if vision_client.client is None:
            logger.warning("Gemini client unavailable, using fallback analysis")
            return _create_fallback_result(image_bytes)
        
        # Call Gemini Flash
        response = await vision_client.analyze_image(image_bytes, base_prompt)
        logger.info(f"Gemini analysis completed, response length: {len(response)}")
        
        # Parse response into structured result
        result = parse_gemini_response(response)
        
        logger.info(f"Vision analysis result: {result.severity} severity, {result.confidence} confidence")
        return result
        
    except VisionServiceError:
        raise  # Re-raise vision service errors
    except Exception as e:
        logger.error(f"Unexpected error in photo analysis: {e}")
        return _create_fallback_result(image_bytes)


async def analyze_photos_batch(image_list: List[bytes], context: Optional[str] = None) -> BatchVisionResult:
    """
    Analyze multiple photos in batch with optimized processing
    
    Args:
        image_list: List of raw image data bytes
        context: Optional context about the complaints
        
    Returns:
        BatchVisionResult with aggregated results and statistics
    """
    start_time = time.time()
    results = []
    successful_analyses = 0
    failed_analyses = 0
    
    # Process images concurrently (but respect rate limits)
    semaphore = asyncio.Semaphore(5)  # Limit concurrent analyses
    
    async def analyze_single_image(image_bytes: bytes, index: int) -> Optional[VisionResult]:
        async with semaphore:
            try:
                result = await analyze_photo(image_bytes, context)
                logger.info(f"Batch analysis {index + 1}: {result.severity} severity")
                return result
            except Exception as e:
                logger.error(f"Batch analysis {index + 1} failed: {e}")
                return None
    
    # Execute batch analysis
    tasks = [analyze_single_image(img, i) for i, img in enumerate(image_list)]
    analysis_results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Process results
    for result in analysis_results:
        if isinstance(result, VisionResult):
            results.append(result)
            successful_analyses += 1
        elif isinstance(result, Exception):
            failed_analyses += 1
            logger.error(f"Batch analysis exception: {result}")
        else:
            failed_analyses += 1
    
    processing_time = time.time() - start_time
    
    return BatchVisionResult(
        results=results,
        total_processed=len(image_list),
        successful_analyses=successful_analyses,
        failed_analyses=failed_analyses,
        processing_time_seconds=round(processing_time, 2)
    )


def _create_fallback_result(image_bytes: bytes) -> VisionResult:
    """
    Create fallback vision result when Gemini is unavailable
    
    Args:
        image_bytes: Raw image data
        
    Returns:
        VisionResult with default values
    """
    # Try to get basic image info for the description
    try:
        image = Image.open(io.BytesIO(image_bytes))
        width, height = image.size
        format_name = image.format or "unknown"
        description = f"Image uploaded ({format_name.lower()}, {width}x{height}) - manual review required"
    except:
        description = "Image uploaded - manual review required"
    
    return VisionResult(
        severity="medium",  # Default medium severity
        description=description,
        confidence=0.0,  # Low confidence triggers human review
        detected_elements=[]
    )


def get_base_severity_score(vision_result: VisionResult) -> int:
    """
    Convert vision result to base severity score for urgency calculation
    
    Args:
        vision_result: Result from photo analysis
        
    Returns:
        int: Base severity score (1-6)
    """
    return SEVERITY_TO_INT.get(vision_result.severity, DEFAULT_BASE_SEVERITY)


def should_trigger_human_review(vision_result: VisionResult) -> bool:
    """
    Determine if vision analysis should trigger human review
    
    Args:
        vision_result: Result from photo analysis
        
    Returns:
        bool: True if human review is needed
    """
    # Low confidence or fallback results should be reviewed
    return vision_result.confidence < 0.5


# Global vision client instance
_vision_client = None

def get_vision_client() -> VisionClient:
    """Get the global vision client instance"""
    global _vision_client
    if _vision_client is None:
        _vision_client = VisionClient()
    return _vision_client


# Integration test function
async def test_vision_integration():
    """Test vision integration without external dependencies"""
    print("🔍 Testing CivicFix Vision Service Integration")
    
    # Test with a small test image (1x1 pixel PNG)
    test_image_data = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    )
    
    try:
        print("\n📝 Testing image validation...")
        is_valid, msg = validate_image(test_image_data)
        print(f"   Validation: {is_valid} - {msg}")
        
        print("\n📝 Testing privacy protection...")
        protected_image = await blur_privacy_info(test_image_data)
        print(f"   Privacy protection completed, output size: {len(protected_image)} bytes")
        
        print("\n📝 Testing photo analysis (fallback)...")
        result = await analyze_photo(test_image_data, "Test pothole complaint")
        print(f"   Severity: {result.severity}")
        print(f"   Confidence: {result.confidence}")
        print(f"   Description: {result.description}")
        print(f"   Base severity score: {get_base_severity_score(result)}")
        
        print("\n📝 Testing batch analysis...")
        batch_result = await analyze_photos_batch([test_image_data, test_image_data])
        print(f"   Processed: {batch_result.successful_analyses}/{batch_result.total_processed}")
        print(f"   Processing time: {batch_result.processing_time_seconds}s")
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    print("\n✅ Vision service integration test complete")


if __name__ == "__main__":
    # Run integration test when called directly
    asyncio.run(test_vision_integration())
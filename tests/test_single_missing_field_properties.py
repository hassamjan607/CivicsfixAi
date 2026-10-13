"""
Property-Based Tests for Single Missing Field Follow-Up

Tests Property 14: Single Missing-Field Follow-Up
Validates: Requirements 1.3

These tests verify that the AI agent correctly generates contextual follow-up
questions when exactly one mandatory field is missing from a complaint submission.
"""

import pytest
import asyncio
from typing import Optional, Dict, Any, List
from unittest.mock import Mock, patch, AsyncMock

from hypothesis import given, strategies as st, assume, settings, HealthCheck

from app.config import ComplaintCategory
from app.agent import (
    ComplaintExtraction,
    extract_complaint,
    generate_clarifying_question,
    create_mock_extraction,
    process_chat_message,
    format_chat_response,
    AgentClient
)


# Helper function to run async code with Hypothesis
def run_async_test(async_func):
    """Helper to run async function in sync context for Hypothesis tests"""
    def wrapper(*args, **kwargs):
        return asyncio.run(async_func(*args, **kwargs))
    return wrapper


@st.composite
def complaint_with_single_missing_field(draw):
    """
    Strategy that generates complaint scenarios with exactly one missing field.
    Returns a tuple of (message, expected_missing_field, context).
    """
    # Choose which field will be missing
    missing_field = draw(st.sampled_from(["category", "location", "description"]))
    
    # Base complaint components
    categories = {
        "pothole": ["pothole", "hole in road", "road damage", "crater"],
        "water_leak": ["water leak", "pipe burst", "flooding", "broken pipe"],
        "garbage": ["garbage not collected", "trash pile", "waste disposal"],
        "streetlight": ["light not working", "broken bulb", "dark street"],
        "sewage": ["sewage overflow", "drain blocked", "bad smell"]
    }
    
    locations = [
        "Main Street near the park",
        "Block 15 Phase 2", 
        "outside City Hospital",
        "near Jinnah Avenue",
        "in front of school",
        "Railway Road sector 4"
    ]
    
    descriptions = [
        "causing traffic problems",
        "making it dangerous for pedestrians",
        "affecting elderly residents",
        "water everywhere creating mess",
        "children cannot play safely",
        "vehicles getting damaged"
    ]
    
    # Build message based on which field is missing
    message_parts = []
    expected_category = None
    
    if missing_field != "category":
        # Include category information
        category_key = draw(st.sampled_from(list(categories.keys())))
        category_phrase = draw(st.sampled_from(categories[category_key]))
        expected_category = category_key
        message_parts.append(f"There is a {category_phrase}")
    
    if missing_field != "location":
        # Include location information
        location = draw(st.sampled_from(locations))
        message_parts.append(f"at {location}")
    
    if missing_field != "description":
        # Include description information
        description = draw(st.sampled_from(descriptions))
        message_parts.append(description)
    
    # Create natural language message
    if len(message_parts) == 0:
        message = "I have a problem"
    elif len(message_parts) == 1:
        message = message_parts[0]
    else:
        message = " ".join(message_parts)
    
    # Create context
    context = {
        "has_category": missing_field != "category",
        "has_location": missing_field != "location", 
        "has_description": missing_field != "description",
        "expected_category": expected_category,
        "message_length": len(message.split())
    }
    
    return message, missing_field, context


@st.composite
def urdu_complaint_with_missing_field(draw):
    """Strategy for generating Urdu complaints with missing fields"""
    missing_field = draw(st.sampled_from(["category", "location", "description"]))
    
    # Urdu complaint patterns
    urdu_categories = {
        "pothole": ["سڑک میں گڑھا", "سڑک خراب", "سوراخ"],
        "water_leak": ["پانی کا لیکج", "پائپ ٹوٹا", "پانی بہہ رہا"],
        "garbage": ["کوڑا نہیں اٹھا", "صفائی کا مسئلہ", "گندگی"],
        "streetlight": ["بجلی کا کھمبا", "روشنی نہیں", "اندھیرا"],
        "sewage": ["گندے پانی کا مسئلہ", "نالی بند", "بدبو"]
    }
    
    urdu_locations = [
        "مین بازار کے پاس",
        "اسکول کے سامنے", 
        "ہسپتال کے باہر",
        "میری گلی میں",
        "پارک کے قریب"
    ]
    
    urdu_descriptions = [
        "بہت پریشانی ہو رہی",
        "بچوں کو خطرہ ہے",
        "بزرگوں کو مشکل",
        "گاڑیوں کو نقصان"
    ]
    
    # Build Urdu message
    message_parts = []
    
    if missing_field != "category":
        category_key = draw(st.sampled_from(list(urdu_categories.keys())))
        category_phrase = draw(st.sampled_from(urdu_categories[category_key]))
        message_parts.append(category_phrase)
    
    if missing_field != "location":
        location = draw(st.sampled_from(urdu_locations))
        message_parts.append(location)
    
    if missing_field != "description":
        description = draw(st.sampled_from(urdu_descriptions))
        message_parts.append(description)
    
    message = " ".join(message_parts) if message_parts else "مسئلہ ہے"
    
    context = {
        "language": "ur",
        "has_category": missing_field != "category",
        "has_location": missing_field != "location",
        "has_description": missing_field != "description"
    }
    
    return message, missing_field, context


@pytest.mark.property
class TestSingleMissingFieldFollowUp:
    """
    **Validates: Requirements 1.3**
    
    Property 14: Single Missing-Field Follow-Up
    For any complaint message where exactly one mandatory field (category, location, 
    or description) is absent after extraction, the /chat response SHALL contain 
    exactly one clarifying question and tracking_id SHALL be null.
    """
    
    @given(complaint_with_single_missing_field())
    @settings(max_examples=10, deadline=10000)
    def test_single_missing_field_generates_clarifying_question(self, complaint_data):
        """Test that exactly one missing field generates appropriate clarifying question"""
        
        async def async_test():
            message, expected_missing_field, context = complaint_data
            
            # Mock the agent to return extraction with the expected missing field
            mock_extraction = ComplaintExtraction(
                category=ComplaintCategory.OTHER,
                summary="User reported an issue",
                sentiment="neutral",
                vulnerable_group_flag=False,
                missing_field=expected_missing_field,
                confidence=0.7
            )
            
            # Mock create_mock_extraction to return our specific extraction
            with patch('app.agent.create_mock_extraction', return_value=mock_extraction):
                # Process the chat message
                response = await process_chat_message(message, context, use_mock=True)
                
                # Verify the response indicates fields are being collected
                assert response["status"] == "collecting"
                assert response["tracking_id"] is None
                assert response["needs_clarification"] is True
                assert response["missing_field"] == expected_missing_field
                
                # Verify a clarifying question was generated
                assert "reply" in response
                assert len(response["reply"]) > 0
                
                # Verify the question is contextually appropriate for the missing field
                reply_lower = response["reply"].lower()
                
                if expected_missing_field == "category":
                    assert any(keyword in reply_lower for keyword in [
                        "type", "category", "kind", "what type", "which type"
                    ])
                elif expected_missing_field == "location":
                    assert any(keyword in reply_lower for keyword in [
                        "location", "where", "area", "street", "address", "place"
                    ])
                elif expected_missing_field == "description":
                    assert any(keyword in reply_lower for keyword in [
                        "details", "describe", "more information", "what exactly", 
                        "how", "problem", "issue"
                    ])
        
        # Run the async test
        run_async_test(async_test)()
    
    @given(urdu_complaint_with_missing_field())
    @settings(max_examples=5, deadline=10000)
    def test_urdu_clarifying_questions(self, complaint_data):
        """Test that Urdu complaints get Urdu clarifying questions"""
        
        async def async_test():
            message, expected_missing_field, context = complaint_data
            
            # Generate clarifying question with Urdu context
            question = await generate_clarifying_question(expected_missing_field, context)
            
            # Verify it's an Urdu question (contains Urdu characters)
            urdu_chars = set("آاإأةتثجحخدذرزسشصضطظعغفقکلمنهوءیپچڈگھں")
            assert any(char in urdu_chars for char in question), f"No Urdu chars in: {question}"
            
            # Verify contextual appropriateness for Urdu
            if expected_missing_field == "category":
                assert any(keyword in question for keyword in ["قسم", "کیا", "مسئلہ"])
            elif expected_missing_field == "location":
                assert any(keyword in question for keyword in ["جگہ", "کہاں", "علاقہ"])
            elif expected_missing_field == "description":
                assert any(keyword in question for keyword in ["تفصیل", "کیسے", "کیا ہو رہا"])
        
        run_async_test(async_test)()
    
    @given(st.sampled_from(["category", "location", "description"]))
    @settings(max_examples=6)
    def test_clarifying_questions_are_field_specific(self, missing_field):
        """Test that clarifying questions are specific to the missing field"""
        
        async def async_test():
            english_question = await generate_clarifying_question(missing_field, {"language": "en"})
            urdu_question = await generate_clarifying_question(missing_field, {"language": "ur"})
            
            # Verify both questions are non-empty strings
            assert isinstance(english_question, str) and len(english_question) > 0
            assert isinstance(urdu_question, str) and len(urdu_question) > 0
            
            # Verify questions are different for different fields
            if missing_field == "category":
                # Category questions should ask about type/kind
                assert any(word in english_question.lower() for word in [
                    "type", "category", "kind", "issue", "problem"
                ])
            elif missing_field == "location":
                # Location questions should ask about place/where
                assert any(word in english_question.lower() for word in [
                    "location", "where", "area", "place", "street"
                ])
            elif missing_field == "description":
                # Description questions should ask for details
                assert any(word in english_question.lower() for word in [
                    "details", "describe", "information", "exactly", "happening"
                ])
        
        run_async_test(async_test)()
    
    @given(
        st.text(min_size=5, max_size=100),
        st.sampled_from(["category", "location", "description"])
    )
    @settings(max_examples=10)
    def test_mock_extraction_with_missing_field(self, message, missing_field):
        """Test that mock extraction correctly handles missing fields"""
        # Create mock extraction with specific missing field
        extraction = create_mock_extraction(message, missing_field)
        
        # Verify the extraction has the correct missing field
        assert extraction.missing_field == missing_field
        
        # Verify other fields are populated
        assert extraction.category in ComplaintCategory
        assert len(extraction.summary) > 0
        assert extraction.sentiment in ["positive", "neutral", "negative"]
        assert isinstance(extraction.vulnerable_group_flag, bool)
        assert 0.0 <= extraction.confidence <= 1.0
        
        # Verify confidence is reduced when field is missing
        assert extraction.confidence < 0.8  # Should be lower than complete complaints
    
    @given(
        st.text(min_size=10, max_size=200),
        st.floats(min_value=0.0, max_value=1.0)
    )
    @settings(max_examples=10)
    def test_format_chat_response_with_missing_field(self, summary, confidence):
        """Test formatting chat response when field is missing"""
        missing_field = "location"
        
        extraction = ComplaintExtraction(
            category=ComplaintCategory.POTHOLE,
            summary=summary[:150],  # Ensure within limits
            sentiment="negative",
            vulnerable_group_flag=False,
            missing_field=missing_field,
            confidence=confidence
        )
        
        # Format response
        response = format_chat_response(extraction)
        
        # Verify response structure for missing field scenario
        assert response["status"] == "collecting"
        assert response["tracking_id"] is None
        assert response["needs_clarification"] is True
        assert response["missing_field"] == missing_field
        assert response["confidence"] == confidence
        
        # Verify reply mentions the category and asks for location
        reply = response["reply"]
        assert "pothole" in reply.lower()
        assert any(word in reply.lower() for word in ["location", "where", "place"])
    
    @given(st.sampled_from(list(ComplaintCategory)))
    @settings(max_examples=5)
    def test_complete_extraction_no_missing_field(self, category):
        """Test that complete extractions don't have missing fields"""
        extraction = ComplaintExtraction(
            category=category,
            summary="Complete complaint with all details",
            sentiment="negative",
            vulnerable_group_flag=False,
            missing_field=None,  # No missing field
            confidence=0.9
        )
        
        # Format response for complete extraction
        response = format_chat_response(
            extraction, 
            tracking_id="CF-0123", 
            urgency_score=7,
            urgency_reasons=["Base severity: 3", "Weather bonus: +2"]
        )
        
        # Should indicate successful submission
        assert response["status"] == "submitted"
        assert response["tracking_id"] == "CF-0123"
        assert response["needs_clarification"] is False
        assert "missing_field" not in response  # Should not be present
        assert response["urgency_score"] == 7
        
        # Reply should mention tracking ID
        assert "CF-0123" in response["reply"]


@pytest.mark.property  
class TestFollowUpQuestionLanguageHandling:
    """Test bilingual follow-up question generation"""
    
    @given(
        st.sampled_from(["category", "location", "description"]),
        st.sampled_from(["en", "ur", None])
    )
    @settings(max_examples=9)
    def test_language_appropriate_questions(self, missing_field, language):
        """Test that questions are generated in appropriate language"""
        
        async def async_test():
            context = {"language": language} if language else {}
            
            question = await generate_clarifying_question(missing_field, context)
            
            # Verify question is non-empty
            assert isinstance(question, str)
            assert len(question.strip()) > 0
            
            if language == "ur":
                # Should contain Urdu characters
                urdu_chars = set("آاإأةتثجحخدذرزسشصضطظعغفقکلمنهوءیپچڈگھں")
                assert any(char in urdu_chars for char in question)
            else:
                # Should be in English (may contain some English words even in mixed text)
                assert any(char.isascii() and char.isalpha() for char in question)
        
        run_async_test(async_test)()
    
    @given(st.sampled_from(["category", "location", "description"]))
    @settings(max_examples=3)
    def test_question_contextual_accuracy(self, missing_field):
        """Test that questions accurately reflect the missing field context"""
        
        async def async_test():
            question = await generate_clarifying_question(missing_field)
            question_lower = question.lower()
            
            # Verify field-specific keywords
            if missing_field == "category":
                field_keywords = ["type", "category", "kind", "issue", "problem", "related"]
                assert any(keyword in question_lower for keyword in field_keywords)
                
            elif missing_field == "location":
                location_keywords = ["location", "where", "area", "place", "street", "address"]
                assert any(keyword in question_lower for keyword in location_keywords)
                
            elif missing_field == "description":
                description_keywords = ["details", "describe", "information", "exactly", "happening", "problem"]
                assert any(keyword in question_lower for keyword in description_keywords)
        
        run_async_test(async_test)()


@pytest.mark.property  
class TestChatResponseIntegration:
    """Test integration between extraction, missing field detection, and chat responses"""
    
    @given(
        st.text(min_size=1, max_size=50),
        st.sampled_from(["category", "location", "description"])
    )
    @settings(max_examples=6, deadline=15000)
    def test_end_to_end_missing_field_flow(self, message, expected_missing_field):
        """Test complete flow from message to appropriate follow-up question"""
        
        async def async_test():
            # Mock extraction with missing field
            mock_extraction = ComplaintExtraction(
                category=ComplaintCategory.OTHER,
                summary=f"Partial complaint: {message[:50]}",
                sentiment="neutral",
                vulnerable_group_flag=False,
                missing_field=expected_missing_field,
                confidence=0.6
            )
            
            with patch('app.agent.create_mock_extraction', return_value=mock_extraction):
                # Process message through complete pipeline
                response = await process_chat_message(message, use_mock=True)
                
                # Verify complete response structure
                required_fields = ["reply", "tracking_id", "status", "needs_clarification", "missing_field", "confidence"]
                for field in required_fields:
                    assert field in response, f"Missing field: {field}"
                
                # Verify values are appropriate for missing field scenario
                assert response["tracking_id"] is None
                assert response["status"] == "collecting"
                assert response["needs_clarification"] is True
                assert response["missing_field"] == expected_missing_field
                assert isinstance(response["confidence"], float)
                assert 0.0 <= response["confidence"] <= 1.0
        
        run_async_test(async_test)()
    
    @given(st.text(min_size=20, max_size=100))
    @settings(max_examples=3, deadline=15000)
    def test_complete_complaint_no_follow_up(self, detailed_message):
        """Test that complete complaints don't generate follow-up questions"""
        assume(len(detailed_message.split()) >= 3)  # Ensure some complexity
        
        async def async_test():
            # Mock complete extraction (no missing field)
            mock_extraction = ComplaintExtraction(
                category=ComplaintCategory.POTHOLE,
                summary="Complete pothole complaint with details",
                sentiment="negative",
                vulnerable_group_flag=False,
                missing_field=None,  # No missing field
                confidence=0.8
            )
            
            with patch('app.agent.create_mock_extraction', return_value=mock_extraction):
                response = await process_chat_message(detailed_message, use_mock=True)
                
                # Should not ask for clarification
                assert response["status"] == "submitted"
                assert response["needs_clarification"] is False
                assert "missing_field" not in response or response["missing_field"] is None
                
                # Should mention submission/processing
                reply = response["reply"].lower()
                assert any(word in reply for word in ["thank", "submitted", "processing", "reported"])
        
        run_async_test(async_test)()


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v"])
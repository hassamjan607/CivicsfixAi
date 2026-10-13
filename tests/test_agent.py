"""
Tests for agent.py - AI complaint extraction module

Tests include:
- Schema validation for ComplaintExtraction
- Slot-filling logic for missing fields
- Confidence scoring and human review triggers
- Bilingual clarifying question generation
- Property-based testing for schema compliance and edge cases
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from hypothesis import given, strategies as st, assume, settings
from hypothesis.stateful import RuleBasedStateMachine, Bundle, rule
from typing import Optional, Literal
from app.config import ComplaintCategory, CONFIDENCE_THRESHOLD

# Only run tests if dependencies are available
try:
    from app.agent import (
        ComplaintExtraction, 
        extract_complaint, 
        generate_clarifying_question,
        should_trigger_human_review,
        AgentClient,
        create_mock_extraction
    )
    AGENT_AVAILABLE = True
except ImportError:
    AGENT_AVAILABLE = False
    pytestmark = pytest.mark.skip("Agent dependencies not available")


@pytest.mark.skipif(not AGENT_AVAILABLE, reason="Agent dependencies not available")
class TestComplaintExtraction:
    """Test the ComplaintExtraction Pydantic model"""
    
    def test_valid_extraction(self):
        """Test creating a valid ComplaintExtraction"""
        extraction = ComplaintExtraction(
            category=ComplaintCategory.POTHOLE,
            summary="Large pothole on Main Street causing damage",
            sentiment="negative",
            vulnerable_group_flag=False,
            missing_field=None,
            confidence=0.8
        )
        
        assert extraction.category == ComplaintCategory.POTHOLE
        assert len(extraction.summary) <= 150
        assert extraction.sentiment in ["positive", "neutral", "negative"]
        assert 0.0 <= extraction.confidence <= 1.0
    
    def test_summary_length_validation(self):
        """Test that summary is limited to 150 characters"""
        long_summary = "x" * 151
        
        with pytest.raises(ValueError):
            ComplaintExtraction(
                category=ComplaintCategory.POTHOLE,
                summary=long_summary,
                sentiment="negative",
                vulnerable_group_flag=False,
                confidence=0.8
            )
    
    def test_confidence_bounds(self):
        """Test confidence score bounds validation"""
        # Valid confidence
        extraction = ComplaintExtraction(
            category=ComplaintCategory.POTHOLE,
            summary="Test complaint",
            sentiment="neutral",
            vulnerable_group_flag=False,
            confidence=0.5
        )
        assert extraction.confidence == 0.5
        
        # Test bounds
        with pytest.raises(ValueError):
            ComplaintExtraction(
                category=ComplaintCategory.POTHOLE,
                summary="Test complaint",
                sentiment="neutral",
                vulnerable_group_flag=False,
                confidence=-0.1  # Below 0.0
            )
        
        with pytest.raises(ValueError):
            ComplaintExtraction(
                category=ComplaintCategory.POTHOLE,
                summary="Test complaint", 
                sentiment="neutral",
                vulnerable_group_flag=False,
                confidence=1.1  # Above 1.0
            )
    
    def test_missing_field_values(self):
        """Test valid missing_field values"""
        valid_fields = ["category", "location", "description", None]
        
        for field in valid_fields:
            extraction = ComplaintExtraction(
                category=ComplaintCategory.OTHER,
                summary="Test complaint",
                sentiment="neutral",
                vulnerable_group_flag=False,
                missing_field=field,
                confidence=0.5
            )
            assert extraction.missing_field == field


@pytest.mark.skipif(not AGENT_AVAILABLE, reason="Agent dependencies not available")
class TestAgentClient:
    """Test the AgentClient class"""
    
    def test_agent_client_initialization(self):
        """Test AgentClient can be initialized"""
        client = AgentClient()
        assert client.groq_model == "llama-3.3-70b-versatile"
    
    @pytest.mark.asyncio
    async def test_empty_message_validation(self):
        """Test that empty messages raise ValueError"""
        client = AgentClient()
        
        with pytest.raises(ValueError, match="Message cannot be empty"):
            await client.extract_complaint("")
        
        with pytest.raises(ValueError, match="Message cannot be empty"):
            await client.extract_complaint("   ")  # Only whitespace


@pytest.mark.skipif(not AGENT_AVAILABLE, reason="Agent dependencies not available")
class TestClarifyingQuestions:
    """Test clarifying question generation"""
    
    @pytest.mark.asyncio
    async def test_clarifying_question_english(self):
        """Test English clarifying questions"""
        questions = {
            "category": await generate_clarifying_question("category"),
            "location": await generate_clarifying_question("location"),
            "description": await generate_clarifying_question("description")
        }
        
        # Check that questions are generated
        assert all(isinstance(q, str) and len(q) > 0 for q in questions.values())
        
        # Check content appropriateness
        assert "type" in questions["category"].lower()
        assert "location" in questions["location"].lower()
        assert "detail" in questions["description"].lower()
    
    @pytest.mark.asyncio
    async def test_clarifying_question_urdu(self):
        """Test Urdu clarifying questions"""
        context = {"language": "ur"}
        
        questions = {
            "category": await generate_clarifying_question("category", context),
            "location": await generate_clarifying_question("location", context),
            "description": await generate_clarifying_question("description", context)
        }
        
        # Check that Urdu questions are generated
        assert all(isinstance(q, str) and len(q) > 0 for q in questions.values())
        
        # Basic check for Urdu characters (should contain at least some Urdu text)
        urdu_chars = set("آاإأةتثجحخدذرزسشصضطظعغفقکلمنهوءیپچڈگھں")
        for question in questions.values():
            assert any(char in urdu_chars for char in question), f"No Urdu chars in: {question}"
    
    @pytest.mark.asyncio
    async def test_unknown_missing_field(self):
        """Test handling of unknown missing field"""
        question = await generate_clarifying_question("unknown_field")
        assert "more information" in question.lower()


@pytest.mark.skipif(not AGENT_AVAILABLE, reason="Agent dependencies not available")
class TestHumanReview:
    """Test human review queue logic"""
    
    def test_should_trigger_human_review(self):
        """Test human review triggering logic"""
        # Low confidence should trigger review
        low_confidence = ComplaintExtraction(
            category=ComplaintCategory.OTHER,
            summary="Test complaint",
            sentiment="neutral",
            vulnerable_group_flag=False,
            confidence=0.3  # Below CONFIDENCE_THRESHOLD (0.6)
        )
        assert should_trigger_human_review(low_confidence)
        
        # High confidence should not trigger review
        high_confidence = ComplaintExtraction(
            category=ComplaintCategory.POTHOLE,
            summary="Clear pothole complaint",
            sentiment="negative",
            vulnerable_group_flag=False,
            confidence=0.8  # Above CONFIDENCE_THRESHOLD
        )
        assert not should_trigger_human_review(high_confidence)
        
        # Threshold boundary test
        threshold_confidence = ComplaintExtraction(
            category=ComplaintCategory.POTHOLE,
            summary="Boundary test complaint",
            sentiment="neutral",
            vulnerable_group_flag=False,
            confidence=CONFIDENCE_THRESHOLD
        )
        assert not should_trigger_human_review(threshold_confidence)


@pytest.mark.skipif(not AGENT_AVAILABLE, reason="Agent dependencies not available")
class TestSlotFilling:
    """Test slot-filling logic for missing fields"""
    
    @pytest.mark.asyncio
    async def test_slot_filling_workflow(self):
        """Test the slot-filling conversation workflow"""
        client = AgentClient()
        
        # Simulate extraction with missing field
        with patch.object(client, '_extract_with_groq') as mock_groq:
            mock_groq.return_value = ComplaintExtraction(
                category=ComplaintCategory.OTHER,
                summary="User reported an issue",
                sentiment="neutral",
                vulnerable_group_flag=False,
                missing_field="location",
                confidence=0.7
            )
            
            result = await client.extract_complaint("There's a problem with the road")
            
            # Should indicate missing location
            assert result.missing_field == "location"
            assert result.confidence == 0.7
            
            # Should be able to generate clarifying question
            question = await generate_clarifying_question(result.missing_field)
            assert "location" in question.lower()


@pytest.mark.skipif(not AGENT_AVAILABLE, reason="Agent dependencies not available")
class TestErrorHandling:
    """Test error handling and fallback logic"""
    
    @pytest.mark.asyncio
    async def test_graceful_degradation(self):
        """Test graceful degradation when AI services fail"""
        client = AgentClient()
        
        # Mock both Groq and LiteLLM to fail
        with patch.object(client, '_extract_with_groq', side_effect=Exception("Groq failed")):
            with patch.object(client, '_extract_with_litellm', side_effect=Exception("LiteLLM failed")):
                
                result = await client.extract_complaint("Test complaint message")
                
                # Should return fallback extraction
                assert isinstance(result, ComplaintExtraction)
                assert result.category == ComplaintCategory.OTHER
                assert result.confidence == 0.0  # Low confidence triggers human review
                assert "Unable to extract" in result.summary
    
    @pytest.mark.asyncio
    async def test_groq_failure_litellm_fallback(self):
        """Test LiteLLM fallback when Groq fails"""
        client = AgentClient()
        
        fallback_result = ComplaintExtraction(
            category=ComplaintCategory.POTHOLE,
            summary="Fallback extraction result",
            sentiment="neutral",
            vulnerable_group_flag=False,
            confidence=0.5
        )
        
        with patch.object(client, '_extract_with_groq', side_effect=Exception("Groq failed")):
            with patch.object(client, '_extract_with_litellm', return_value=fallback_result):
                
                result = await client.extract_complaint("There's a pothole on the street")
                
                assert result == fallback_result
                assert result.confidence == 0.5


if __name__ == "__main__":
    pytest.main([__file__])


@pytest.mark.skipif(not AGENT_AVAILABLE, reason="Agent dependencies not available")
class TestAgentSchemaCompliance:
    """Property-based tests for agent schema compliance - Property 13"""
    
    # Hypothesis strategies for generating test data
    
    @st.composite
    def valid_category_strategy(draw):
        """Generate valid complaint categories"""
        return draw(st.sampled_from(list(ComplaintCategory)))
    
    @st.composite
    def valid_summary_strategy(draw):
        """Generate valid summaries (1-150 chars)"""
        return draw(st.text(min_size=1, max_size=150))
    
    @st.composite
    def valid_sentiment_strategy(draw):
        """Generate valid sentiment values"""
        return draw(st.sampled_from(["positive", "neutral", "negative"]))
    
    @st.composite
    def valid_confidence_strategy(draw):
        """Generate valid confidence scores (0.0-1.0)"""
        return draw(st.floats(min_value=0.0, max_value=1.0, allow_nan=False))
    
    @st.composite
    def valid_missing_field_strategy(draw):
        """Generate valid missing field values"""
        return draw(st.one_of(
            st.none(),
            st.sampled_from(["category", "location", "description"])
        ))
    
    @st.composite
    def complaint_message_strategy(draw):
        """Generate diverse complaint message scenarios"""
        # Various complaint types and languages
        complaint_types = [
            "There is a big pothole on Main Street",
            "Water is leaking from the pipe near the market",
            "The streetlight is not working",
            "Garbage has not been collected for days",
            "Road is damaged after the rain",
            "Sewage overflow in the neighborhood",
            "سڑک پر گڑھا ہے",  # Urdu: There's a hole in the road
            "پانی کا پائپ ٹوٹا ہوا ہے",  # Urdu: Water pipe is broken
            "بجلی کا کھمبا کام نہیں کر رہا",  # Urdu: Electric pole not working
            "",  # Empty message
            "   ",  # Whitespace only
            "x" * 200,  # Very long message
            "Help! Emergency! Live wire down!",  # Emergency keywords
            "Gas smell near the manhole",  # Emergency keywords
            "Issue with elderly people affected",  # Vulnerable groups
            "Children playing near broken glass",  # Vulnerable groups
            "Complaint about road",  # Minimal info
            "Very very very very urgent problem with everything everywhere all the time",  # Verbose
        ]
        
        return draw(st.sampled_from(complaint_types))
    
    @st.composite
    def context_strategy(draw):
        """Generate optional context for agent calls"""
        return draw(st.one_of(
            st.none(),
            st.dictionaries(
                keys=st.sampled_from(["location", "language", "previous_messages"]),
                values=st.one_of(
                    st.text(min_size=1, max_size=100),
                    st.sampled_from(["en", "ur", "ur-PK", "en-US"])
                ),
                min_size=0,
                max_size=3
            )
        ))
    
    @pytest.mark.property
    @given(
        category=valid_category_strategy(),
        summary=valid_summary_strategy(),
        sentiment=valid_sentiment_strategy(),
        vulnerable_group_flag=st.booleans(),
        missing_field=valid_missing_field_strategy(),
        confidence=valid_confidence_strategy()
    )
    def test_property_13_complaint_extraction_schema_validity(
        self,
        category,
        summary,
        sentiment,
        vulnerable_group_flag,
        missing_field,
        confidence
    ):
        """
        **Property 13: Agent Extraction Schema Compliance**
        **Validates: Requirements 11.1, 1.2**
        
        For all valid inputs to ComplaintExtraction schema:
        - The Pydantic model SHALL accept valid field combinations
        - All required fields SHALL be present and correctly typed
        - Field constraints SHALL be enforced (summary length, confidence bounds)
        - Schema validation SHALL never crash on valid inputs
        """
        
        # Test that valid inputs create a valid ComplaintExtraction instance
        extraction = ComplaintExtraction(
            category=category,
            summary=summary,
            sentiment=sentiment,
            vulnerable_group_flag=vulnerable_group_flag,
            missing_field=missing_field,
            confidence=confidence
        )
        
        # Verify all fields are properly assigned
        assert extraction.category == category
        assert extraction.summary == summary
        assert extraction.sentiment == sentiment
        assert extraction.vulnerable_group_flag == vulnerable_group_flag
        assert extraction.missing_field == missing_field
        assert extraction.confidence == confidence
        
        # Verify field constraints
        assert len(extraction.summary) <= 150
        assert extraction.sentiment in ["positive", "neutral", "negative"]
        assert 0.0 <= extraction.confidence <= 1.0
        assert extraction.missing_field in [None, "category", "location", "description"]
        assert isinstance(extraction.category, ComplaintCategory)
    
    @pytest.mark.property
    @given(st.text(min_size=151, max_size=300))
    def test_property_13_summary_length_constraint_rejection(self, long_summary):
        """
        **Property 13: Agent Extraction Schema Compliance**
        
        For summaries longer than 150 characters:
        - Schema validation SHALL reject the input with ValueError
        """
        with pytest.raises(ValueError):
            ComplaintExtraction(
                category=ComplaintCategory.OTHER,
                summary=long_summary,
                sentiment="neutral",
                vulnerable_group_flag=False,
                confidence=0.5
            )
    
    @pytest.mark.property
    @given(invalid_confidence=st.one_of(
        st.floats(max_value=-0.001),  # Below 0.0
        st.floats(min_value=1.001),   # Above 1.0
        st.just(float('inf')),        # Infinity
        st.just(float('-inf')),       # Negative infinity
        st.just(float('nan'))         # NaN
    ))
    def test_property_13_confidence_bounds_constraint_rejection(self, invalid_confidence):
        """
        **Property 13: Agent Extraction Schema Compliance**
        
        For confidence scores outside [0.0, 1.0] or NaN:
        - Schema validation SHALL reject the input with ValueError
        """
        assume(not (0.0 <= invalid_confidence <= 1.0))
        
        with pytest.raises(ValueError):
            ComplaintExtraction(
                category=ComplaintCategory.POTHOLE,
                summary="Test complaint",
                sentiment="neutral",
                vulnerable_group_flag=False,
                confidence=invalid_confidence
            )
    
    @pytest.mark.property
    @given(invalid_sentiment=st.text().filter(lambda x: x not in ["positive", "neutral", "negative"]))
    def test_property_13_sentiment_enum_constraint_rejection(self, invalid_sentiment):
        """
        **Property 13: Agent Extraction Schema Compliance**
        
        For sentiment values not in the allowed enum:
        - Schema validation SHALL reject the input with ValueError
        """
        assume(invalid_sentiment not in ["positive", "neutral", "negative"])
        
        with pytest.raises(ValueError):
            ComplaintExtraction(
                category=ComplaintCategory.POTHOLE,
                summary="Test complaint",
                sentiment=invalid_sentiment,
                vulnerable_group_flag=False,
                confidence=0.5
            )
    
    @pytest.mark.property
    @given(
        invalid_missing_field=st.text().filter(
            lambda x: x not in ["category", "location", "description"] and x is not None
        )
    )
    def test_property_13_missing_field_enum_constraint_rejection(self, invalid_missing_field):
        """
        **Property 13: Agent Extraction Schema Compliance**
        
        For missing_field values not in the allowed enum or None:
        - Schema validation SHALL reject the input with ValueError
        """
        assume(invalid_missing_field not in ["category", "location", "description"])
        assume(invalid_missing_field is not None)
        
        with pytest.raises(ValueError):
            ComplaintExtraction(
                category=ComplaintCategory.POTHOLE,
                summary="Test complaint",
                sentiment="neutral",
                vulnerable_group_flag=False,
                missing_field=invalid_missing_field,
                confidence=0.5
            )
    
    @pytest.mark.property
    @given(message=complaint_message_strategy())
    @pytest.mark.asyncio
    async def test_property_13_mock_extraction_schema_compliance(self, message):
        """
        **Property 13: Agent Extraction Schema Compliance**
        
        For all message inputs to create_mock_extraction:
        - The function SHALL always return a valid ComplaintExtraction instance
        - All schema constraints SHALL be satisfied
        - No exceptions SHALL be raised for any input
        """
        # create_mock_extraction doesn't validate empty messages, it processes them
        extraction = create_mock_extraction(message)
        
        # Verify it's a valid ComplaintExtraction instance
        assert isinstance(extraction, ComplaintExtraction)
        
        # Verify all schema constraints
        assert isinstance(extraction.category, ComplaintCategory)
        assert isinstance(extraction.summary, str)
        assert len(extraction.summary) <= 150
        assert extraction.sentiment in ["positive", "neutral", "negative"]
        assert isinstance(extraction.vulnerable_group_flag, bool)
        assert extraction.missing_field in [None, "category", "location", "description"]
        assert 0.0 <= extraction.confidence <= 1.0
    
    @pytest.mark.property
    @given(
        message=complaint_message_strategy(),
        context=context_strategy()
    )
    @pytest.mark.asyncio
    async def test_property_13_agent_extraction_error_handling(self, message, context):
        """
        **Property 13: Agent Extraction Schema Compliance**
        
        For all agent extraction calls:
        - Empty messages SHALL raise ValueError consistently
        - Valid messages SHALL either return ComplaintExtraction or handle errors gracefully
        - No unhandled exceptions SHALL crash the agent
        """
        client = AgentClient()
        
        # Test empty message handling
        if not message or not message.strip():
            with pytest.raises(ValueError, match="Message cannot be empty"):
                await client.extract_complaint(message, context)
            return
        
        # Mock both Groq and LiteLLM to fail, test graceful degradation
        with patch.object(client, '_extract_with_groq', side_effect=Exception("Mock Groq failure")):
            with patch.object(client, '_extract_with_litellm', side_effect=Exception("Mock LiteLLM failure")):
                
                result = await client.extract_complaint(message, context)
                
                # Should return a valid fallback extraction
                assert isinstance(result, ComplaintExtraction)
                assert result.category == ComplaintCategory.OTHER
                assert result.confidence == 0.0  # Low confidence for human review
                assert "Unable to extract" in result.summary
                assert result.sentiment == "neutral"
                assert isinstance(result.vulnerable_group_flag, bool)
    
    @pytest.mark.property
    @given(
        missing_field=st.sampled_from(["category", "location", "description", "unknown_field"]),
        context=context_strategy()
    )
    @pytest.mark.asyncio
    async def test_property_13_clarifying_question_generation(self, missing_field, context):
        """
        **Property 13: Agent Extraction Schema Compliance**
        
        For all clarifying question generation:
        - Questions SHALL always be non-empty strings
        - Known missing fields SHALL generate appropriate questions
        - Unknown missing fields SHALL generate generic questions
        - Language context SHALL affect question language when available
        """
        question = await generate_clarifying_question(missing_field, context)
        
        # Question should always be a non-empty string
        assert isinstance(question, str)
        assert len(question) > 0
        
        # Check content appropriateness for known fields
        if missing_field == "category":
            assert any(word in question.lower() for word in ["type", "category", "issue", "قسم", "نوع"])
        elif missing_field == "location":
            assert any(word in question.lower() for word in ["location", "where", "place", "جگہ", "کہاں"])
        elif missing_field == "description":
            assert any(word in question.lower() for word in ["detail", "describe", "more", "تفصیل", "کیا"])
        else:
            # Unknown field should generate generic question
            assert any(word in question.lower() for word in ["information", "more", "help", "معلومات"])
        
        # Check language context handling
        if context and context.get("language") == "ur":
            # Should contain some Urdu characters
            urdu_chars = set("آاإأةتثجحخدذرزسشصضطظعغفقکلمنهوءیپچڈگھں")
            assert any(char in urdu_chars for char in question)


@pytest.mark.skipif(not AGENT_AVAILABLE, reason="Agent dependencies not available")
class TestAgentPropertyBasedEdgeCases:
    """Additional property-based tests for edge cases and robustness"""
    
    @pytest.mark.property
    @given(
        extraction=st.builds(
            lambda category, summary, sentiment, vulnerable_group_flag, missing_field, confidence: ComplaintExtraction(
                category=category,
                summary=summary,
                sentiment=sentiment,
                vulnerable_group_flag=vulnerable_group_flag,
                missing_field=missing_field,
                confidence=confidence
            ),
            category=st.sampled_from(list(ComplaintCategory)),
            summary=st.text(min_size=1, max_size=150),
            sentiment=st.sampled_from(["positive", "neutral", "negative"]),
            vulnerable_group_flag=st.booleans(),
            missing_field=st.one_of(
                st.none(),
                st.sampled_from(["category", "location", "description"])
            ),
            confidence=st.floats(min_value=0.0, max_value=1.0, allow_nan=False)
        )
    )
    def test_property_human_review_trigger_consistency(self, extraction):
        """
        Property: Human review trigger logic is consistent
        
        For all valid ComplaintExtraction instances:
        - should_trigger_human_review result SHALL depend only on confidence score
        - Low confidence (< CONFIDENCE_THRESHOLD) SHALL trigger review
        - High confidence (>= CONFIDENCE_THRESHOLD) SHALL NOT trigger review
        """
        review_needed = should_trigger_human_review(extraction)
        
        if extraction.confidence < CONFIDENCE_THRESHOLD:
            assert review_needed, f"Low confidence {extraction.confidence} should trigger review"
        else:
            assert not review_needed, f"High confidence {extraction.confidence} should not trigger review"
    
    @pytest.mark.property
    @given(
        message_batch=st.lists(
            st.text(min_size=1, max_size=200).filter(lambda x: x.strip()),
            min_size=1,
            max_size=10
        )
    )
    def test_property_batch_processing_consistency(self, message_batch):
        """
        Property: Batch processing maintains individual consistency
        
        For batches of complaint messages:
        - Each message SHALL produce the same result when processed individually
        - No cross-contamination SHALL occur between messages
        """
        # Process each message individually
        individual_results = []
        for message in message_batch:
            try:
                result = create_mock_extraction(message)
                individual_results.append((message, result))
            except ValueError:
                # Skip empty messages
                continue
        
        # Process the same messages again and verify consistency
        for original_message, expected_result in individual_results:
            new_result = create_mock_extraction(original_message)
            
            # Results should be identical for the same input
            assert new_result.category == expected_result.category
            assert new_result.summary == expected_result.summary
            assert new_result.sentiment == expected_result.sentiment
            assert new_result.vulnerable_group_flag == expected_result.vulnerable_group_flag
            assert new_result.confidence == expected_result.confidence
    
    @pytest.mark.property
    @settings(max_examples=50)  # Limit due to async overhead
    @given(
        messages=st.lists(
            st.text(min_size=1, max_size=100).filter(lambda x: x.strip()),
            min_size=1,
            max_size=5
        )
    )
    @pytest.mark.asyncio
    async def test_property_concurrent_extraction_safety(self, messages):
        """
        Property: Concurrent extractions are safe and produce valid results
        
        For concurrent agent calls:
        - All SHALL complete without exceptions
        - All SHALL return valid ComplaintExtraction instances
        - No race conditions SHALL corrupt results
        """
        client = AgentClient()
        
        # Mock successful Groq responses for all messages
        mock_extractions = []
        for i, message in enumerate(messages):
            mock_extractions.append(ComplaintExtraction(
                category=ComplaintCategory.OTHER,
                summary=f"Mock extraction {i}: {message[:50]}",
                sentiment="neutral",
                vulnerable_group_flag=False,
                confidence=0.7
            ))
        
        with patch.object(client, '_extract_with_groq', side_effect=mock_extractions):
            
            # Run all extractions concurrently
            tasks = [client.extract_complaint(msg) for msg in messages]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # All should succeed and return valid extractions
            for i, result in enumerate(results):
                assert not isinstance(result, Exception), f"Task {i} failed: {result}"
                assert isinstance(result, ComplaintExtraction)
                assert result == mock_extractions[i]
"""
Unit tests for the vision service module.
Tests image validation, privacy protection, analysis, and integration points.
"""

import pytest
import asyncio
import base64
import os
from unittest.mock import Mock, patch, AsyncMock
from app.vision import (
    analyze_photo, 
    blur_privacy_info, 
    validate_image, 
    parse_gemini_response,
    get_base_severity_score,
    should_trigger_human_review,
    analyze_photos_batch,
    VisionResult,
    VisionClient,
    VisionServiceError,
    RateLimiter
)


class TestImageValidation:
    """Test image validation functionality"""
    
    def test_validate_valid_image(self):
        """Test validation of a valid small PNG image"""
        # Small 1x1 pixel PNG
        valid_image = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        is_valid, error_msg = validate_image(valid_image)
        assert is_valid == True
        assert error_msg == ""
    
    def test_validate_oversized_image(self):
        """Test validation fails for oversized image"""
        # Create fake oversized image data
        oversized_image = b"fake_image_data" * 500000  # > 5MB
        
        is_valid, error_msg = validate_image(oversized_image)
        assert is_valid == False
        assert "too large" in error_msg.lower()
    
    def test_validate_invalid_image_data(self):
        """Test validation fails for invalid image data"""
        invalid_image = b"not_an_image"
        
        is_valid, error_msg = validate_image(invalid_image)
        assert is_valid == False
        assert "invalid image data" in error_msg.lower()


class TestPrivacyProtection:
    """Test privacy protection functionality"""
    
    @pytest.mark.asyncio
    async def test_blur_privacy_info_basic(self):
        """Test basic privacy protection functionality"""
        # Small test image
        test_image = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        result = await blur_privacy_info(test_image)
        
        # Should return processed image (different size due to compression)
        assert len(result) > 0
        assert isinstance(result, bytes)
    
    @pytest.mark.asyncio
    async def test_blur_privacy_info_invalid_image(self):
        """Test privacy protection with invalid image returns original"""
        invalid_image = b"not_an_image"
        
        result = await blur_privacy_info(invalid_image)
        
        # Should return original image when processing fails
        assert result == invalid_image
    
    @pytest.mark.asyncio
    async def test_blur_privacy_info_empty_image(self):
        """Test privacy protection with empty image data"""
        empty_image = b""
        
        result = await blur_privacy_info(empty_image)
        
        # Should return original (empty) data
        assert result == empty_image


class TestGeminiResponseParsing:
    """Test Gemini response parsing logic"""
    
    def test_parse_gemini_response_structured(self):
        """Test parsing a well-structured Gemini response"""
        response_text = """
        This image shows a critical pothole with significant depth and cracking. 
        The road damage is severe and poses safety risks to vehicles and pedestrians.
        Visible elements include asphalt, concrete, and water pooling.
        """
        
        result = parse_gemini_response(response_text)
        
        assert result.severity == "critical"
        assert "pothole" in result.description.lower() or "road damage" in result.description.lower()
        assert result.confidence > 0.7
        assert len(result.detected_elements) > 0
    
    def test_parse_gemini_response_low_severity(self):
        """Test parsing response indicating low severity"""
        response_text = "Minor crack in sidewalk, small issue with minimal impact."
        
        result = parse_gemini_response(response_text)
        
        assert result.severity == "low"
        assert "minor" in result.description.lower() or "crack" in result.description.lower()
    
    def test_parse_gemini_response_empty(self):
        """Test parsing empty or minimal response"""
        response_text = ""
        
        result = parse_gemini_response(response_text)
        
        assert result.severity == "medium"  # default
        assert result.confidence == 0.7  # base confidence
        assert result.detected_elements == []


class TestVisionResult:
    """Test VisionResult model functionality"""
    
    def test_vision_result_creation(self):
        """Test creating a valid VisionResult"""
        result = VisionResult(
            severity="high",
            description="Large pothole on main road",
            confidence=0.85,
            detected_elements=["pothole", "asphalt", "road"]
        )
        
        assert result.severity == "high"
        assert result.description == "Large pothole on main road"
        assert result.confidence == 0.85
        assert len(result.detected_elements) == 3
    
    def test_vision_result_defaults(self):
        """Test VisionResult with minimal data"""
        result = VisionResult(
            severity="medium",
            description="Infrastructure issue detected",
            confidence=0.7
        )
        
        assert result.severity == "medium"
        assert result.description == "Infrastructure issue detected"
        assert result.confidence == 0.7
        assert result.detected_elements == []


class TestSeverityMapping:
    """Test severity score mapping"""
    
    def test_get_base_severity_score(self):
        """Test mapping severity levels to integer scores"""
        # Test all severity levels
        low_result = VisionResult(severity="low", description="test", confidence=0.8)
        medium_result = VisionResult(severity="medium", description="test", confidence=0.8)
        high_result = VisionResult(severity="high", description="test", confidence=0.8)
        critical_result = VisionResult(severity="critical", description="test", confidence=0.8)
        
        assert get_base_severity_score(low_result) == 2
        assert get_base_severity_score(medium_result) == 3
        assert get_base_severity_score(high_result) == 5
        assert get_base_severity_score(critical_result) == 6
    
    def test_get_base_severity_score_invalid(self):
        """Test mapping with invalid severity returns default"""
        # Create a result with valid severity first, then test with mock
        valid_result = VisionResult(severity="medium", description="test", confidence=0.8)
        
        # Mock the severity attribute to test invalid value handling
        with patch.object(valid_result, 'severity', 'unknown'):
            # Should return DEFAULT_BASE_SEVERITY (3)
            assert get_base_severity_score(valid_result) == 3


class TestHumanReviewTrigger:
    """Test human review trigger logic"""
    
    def test_should_trigger_human_review_low_confidence(self):
        """Test human review is triggered for low confidence results"""
        low_confidence_result = VisionResult(
            severity="medium",
            description="test",
            confidence=0.3
        )
        
        assert should_trigger_human_review(low_confidence_result) == True
    
    def test_should_trigger_human_review_high_confidence(self):
        """Test human review is not triggered for high confidence results"""
        high_confidence_result = VisionResult(
            severity="medium",
            description="test",
            confidence=0.8
        )
        
        assert should_trigger_human_review(high_confidence_result) == False


class TestRateLimiter:
    """Test rate limiting functionality"""
    
    def test_rate_limiter_allows_calls(self):
        """Test rate limiter allows calls within limit"""
        limiter = RateLimiter(max_calls=5, window_seconds=60)
        
        # Should allow first few calls
        for i in range(5):
            assert limiter.can_make_call() == True
            limiter.record_call()
        
        # Should block the 6th call
        assert limiter.can_make_call() == False
    
    def test_rate_limiter_window_expiry(self):
        """Test rate limiter window expiry"""
        import time
        
        limiter = RateLimiter(max_calls=2, window_seconds=1)
        
        # Use up the limit
        assert limiter.can_make_call() == True
        limiter.record_call()
        assert limiter.can_make_call() == True
        limiter.record_call()
        assert limiter.can_make_call() == False
        
        # Wait for window to expire
        time.sleep(1.1)
        
        # Should allow calls again
        assert limiter.can_make_call() == True


@pytest.mark.asyncio
class TestVisionAnalysis:
    """Test main vision analysis functionality"""
    
    async def test_analyze_photo_fallback(self):
        """Test photo analysis with fallback when API unavailable"""
        test_image = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        # Mock environment to not have API key
        with patch.dict(os.environ, {}, clear=True):
            result = await analyze_photo(test_image, "Test complaint")
            
            assert result.severity == "medium"  # fallback default
            assert result.confidence == 0.0  # fallback confidence
            assert "manual review required" in result.description.lower()
    
    async def test_analyze_photo_invalid_image(self):
        """Test photo analysis with invalid image raises error"""
        invalid_image = b"not_an_image_at_all"
        
        with pytest.raises(VisionServiceError):
            await analyze_photo(invalid_image)
    
    @patch('app.vision.VisionClient')
    async def test_analyze_photo_with_mock_gemini(self, mock_vision_client_class):
        """Test photo analysis with mocked Gemini response"""
        # Setup mock
        mock_client = Mock()
        mock_client.client = Mock()  # Not None
        mock_client.analyze_image = AsyncMock(return_value="Critical pothole with severe damage")
        mock_vision_client_class.return_value = mock_client
        
        test_image = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        with patch.dict(os.environ, {'GOOGLE_API_KEY': 'test_key'}):
            result = await analyze_photo(test_image)
            
            assert result.severity == "critical"
            assert "pothole" in result.description.lower()
            mock_client.analyze_image.assert_called_once()


@pytest.mark.asyncio
class TestBatchAnalysis:
    """Test batch photo analysis functionality"""
    
    async def test_analyze_photos_batch_success(self):
        """Test successful batch analysis"""
        test_image = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        image_list = [test_image, test_image, test_image]
        
        result = await analyze_photos_batch(image_list, "Batch test")
        
        assert result.total_processed == 3
        assert result.successful_analyses >= 0  # Could be 0 if no API key
        assert result.failed_analyses >= 0
        assert result.processing_time_seconds >= 0
        assert len(result.results) == result.successful_analyses
    
    async def test_analyze_photos_batch_empty_list(self):
        """Test batch analysis with empty image list"""
        result = await analyze_photos_batch([], "Empty test")
        
        assert result.total_processed == 0
        assert result.successful_analyses == 0
        assert result.failed_analyses == 0
        assert len(result.results) == 0


class TestVisionClient:
    """Test VisionClient functionality"""
    
    def test_vision_client_no_api_key(self):
        """Test VisionClient handles missing API key gracefully"""
        with patch.dict(os.environ, {}, clear=True):
            client = VisionClient()
            
            assert client.client is None
            assert client.api_key is None
    
    def test_vision_client_with_api_key(self):
        """Test VisionClient initialization with API key"""
        with patch.dict(os.environ, {'GOOGLE_API_KEY': 'test_key'}):
            with patch('app.vision.genai.configure') as mock_configure:
                with patch('app.vision.genai.GenerativeModel') as mock_model:
                    client = VisionClient()
                    
                    mock_configure.assert_called_once_with(api_key='test_key')
                    mock_model.assert_called_once()
                    assert client.api_key == 'test_key'


# Integration test that can be run with real API
@pytest.mark.integration
@pytest.mark.asyncio
async def test_full_vision_pipeline():
    """Integration test for full vision pipeline (requires real API key)"""
    if not os.getenv('GOOGLE_API_KEY'):
        pytest.skip("GOOGLE_API_KEY not available for integration test")
    
    test_image = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    )
    
    # Test full pipeline
    result = await analyze_photo(test_image, "Integration test complaint")
    protected_image = await blur_privacy_info(test_image)
    severity_score = get_base_severity_score(result)
    needs_review = should_trigger_human_review(result)
    
    # Assertions
    assert result.severity in ["low", "medium", "high", "critical"]
    assert len(result.description) > 0
    assert 0.0 <= result.confidence <= 1.0
    assert isinstance(result.detected_elements, list)
    assert len(protected_image) > 0
    assert 1 <= severity_score <= 6
    assert isinstance(needs_review, bool)


if __name__ == "__main__":
    # Run basic tests
    pytest.main([__file__, "-v"])
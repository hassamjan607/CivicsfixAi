# CivicFix AI Vision Service Documentation

## Overview

The Vision Service is a comprehensive image analysis module that integrates Google Gemini Flash for photo analysis and provides privacy protection capabilities. It analyzes complaint images to extract severity information and provides additional context for urgency scoring and complaint routing.

## Features

### Core Capabilities
- **Image Analysis**: Uses Google Gemini Flash to analyze complaint photos and extract structured severity information
- **Privacy Protection**: Automatically detects and blurs faces and license plates in uploaded images
- **Multi-format Support**: Handles JPEG, PNG, and WebP image formats
- **Batch Processing**: Supports both single image and batch image analysis
- **Rate Limiting**: Built-in rate limiting to prevent API abuse
- **Error Handling**: Comprehensive error handling with graceful degradation
- **Fallback Logic**: Works without API keys for development/testing

### Integration Points
- **Complaint Processing Pipeline**: Feeds severity scores into the urgency calculation engine
- **Human Review Queue**: Low-confidence results automatically trigger human review
- **Image Deduplication**: Privacy-protected images used for duplicate detection
- **Error Recovery**: Failed analyses route complaints to human review queue

## API Reference

### Core Functions

#### `analyze_photo(image_bytes: bytes, context: Optional[str] = None) -> VisionResult`

Analyzes a complaint photo using Gemini Flash for severity assessment.

**Parameters:**
- `image_bytes`: Raw image data
- `context`: Optional context about the complaint (category, location)

**Returns:**
- `VisionResult` object with severity, description, confidence, and detected elements

**Example:**
```python
from app.vision import analyze_photo

result = await analyze_photo(image_bytes, "Pothole complaint from Main Street")
print(f"Severity: {result.severity}")
print(f"Description: {result.description}")
print(f"Confidence: {result.confidence}")
```

#### `blur_privacy_info(image_bytes: bytes) -> bytes`

Detects and blurs faces and license plates using OpenCV.

**Parameters:**
- `image_bytes`: Raw image data

**Returns:**
- Processed image bytes with PII blurred

**Example:**
```python
from app.vision import blur_privacy_info

protected_image = await blur_privacy_info(original_image_bytes)
```

#### `analyze_photos_batch(image_list: List[bytes], context: Optional[str] = None) -> BatchVisionResult`

Analyzes multiple photos in batch with optimized processing.

**Parameters:**
- `image_list`: List of raw image data bytes
- `context`: Optional context about the complaints

**Returns:**
- `BatchVisionResult` with aggregated results and statistics

### Data Models

#### `VisionResult`

Result of vision analysis with structured severity assessment.

```python
class VisionResult(BaseModel):
    severity: Literal["low", "medium", "high", "critical"]
    description: str  # Max 200 characters
    confidence: float  # 0.0 to 1.0
    detected_elements: List[str]  # Infrastructure elements detected
```

#### `BatchVisionResult`

Result of batch vision analysis.

```python
class BatchVisionResult(BaseModel):
    results: List[VisionResult]
    total_processed: int
    successful_analyses: int
    failed_analyses: int
    processing_time_seconds: float
```

### Utility Functions

#### `validate_image(image_bytes: bytes) -> Tuple[bool, str]`

Validates image format, size, and dimensions.

#### `get_base_severity_score(vision_result: VisionResult) -> int`

Converts vision result to base severity score (1-6) for urgency calculation.

#### `should_trigger_human_review(vision_result: VisionResult) -> bool`

Determines if vision analysis should trigger human review (confidence < 0.5).

## Configuration

### Environment Variables

```env
# Google Gemini API
GOOGLE_API_KEY=your_google_api_key_here
GEMINI_MODEL=gemini-1.5-flash
```

### Image Constraints

- **Maximum File Size**: 5 MB
- **Maximum Dimensions**: 4096x4096 pixels
- **Supported Formats**: JPEG, PNG, WebP
- **Rate Limits**: 60 calls per minute

### Severity Mapping

The service maps Gemini Flash severity labels to integer scores:

| Severity Level | Score | Description |
|---------------|-------|-------------|
| low           | 2     | Minor issues with minimal impact |
| medium        | 3     | Moderate issues requiring attention |
| high          | 5     | Significant problems affecting safety |
| critical      | 6     | Emergency situations requiring immediate response |

## Error Handling

### Graceful Degradation

The vision service is designed to never block complaint processing:

1. **API Unavailable**: Returns fallback results with low confidence (triggers human review)
2. **Invalid Images**: Validates images and returns appropriate error messages
3. **Rate Limiting**: Handles rate limits and provides informative error messages
4. **Privacy Protection Failures**: Returns original image if blurring fails

### Error Types

- `VisionServiceError`: Custom exception for vision service specific errors
- Image validation errors for oversized or invalid files
- API timeout and rate limit errors

## Privacy Protection

### Face Detection

Uses OpenCV Haar Cascades for face detection:
- Detects faces using `haarcascade_frontalface_default.xml`
- Applies Gaussian blur with 99x99 kernel
- Logs number of faces blurred

### License Plate Detection

Attempts to detect license plates:
- Uses `haarcascade_russian_plate_number.xml` if available
- Applies Gaussian blur with 25x25 kernel
- Gracefully handles missing cascade files

### Fallback Privacy Protection

When cascade classifiers are unavailable:
- Applies general blur to upper portion of image
- Conservative approach to protect potential privacy areas
- Ensures some level of privacy protection always occurs

## Testing

### Unit Tests

Comprehensive test suite in `tests/test_vision.py`:

```bash
# Run all vision tests
python -m pytest tests/test_vision.py -v

# Run specific test categories
python -m pytest tests/test_vision.py::TestImageValidation -v
python -m pytest tests/test_vision.py::TestPrivacyProtection -v
```

### Integration Testing

```bash
# Test with actual API (requires GOOGLE_API_KEY)
python test_vision_manual.py

# Test internal integration
python -m app.vision
```

### Mock Testing

The service includes comprehensive mocking for testing without API keys:
- Mock Gemini responses with realistic analysis results
- Fallback analysis for development environments
- Deterministic results for consistent testing

## Performance Considerations

### Rate Limiting

Built-in rate limiter prevents API abuse:
- 60 calls per minute default limit
- Configurable time window
- Automatic call tracking and blocking

### Batch Processing

Optimized for batch analysis:
- Concurrent processing with semaphore limiting
- Automatic retry logic for failed analyses
- Detailed statistics and performance metrics

### Memory Efficiency

- Streams image processing to avoid memory issues
- Automatic cleanup of temporary objects
- Efficient OpenCV operations

## Monitoring and Logging

### Logging Levels

- **INFO**: Successful operations, privacy protection statistics
- **WARNING**: Fallback operations, missing cascade files
- **ERROR**: Failed API calls, processing errors

### Metrics to Monitor

- Analysis success/failure rates
- Average processing times
- Privacy protection statistics (faces/plates blurred)
- API rate limit utilization
- Human review trigger rates

## Deployment Notes

### Dependencies

Key dependencies that must be available:
- `google-generativeai>=0.8.6`: Google Gemini API client
- `opencv-python>=4.10.0.84`: Image processing and privacy protection
- `Pillow>=11.0.0`: Image format handling
- `numpy>=2.4.6`: Array operations for OpenCV

### Docker Considerations

When deploying in Docker:
- OpenCV may need additional system packages
- Cascade classifier files must be accessible
- Sufficient memory for image processing operations

### Production Setup

1. Set appropriate rate limits for your API quota
2. Configure monitoring for API usage and failures
3. Set up alerts for high human review rates
4. Regular testing of privacy protection capabilities
5. Monitor Gemini API deprecation notices and migration paths

## Migration Notes

### Google Generative AI Deprecation

The current implementation uses the deprecated `google-generativeai` package. Future updates should migrate to `google-genai`. The vision service is architected to make this migration straightforward by isolating API client logic in the `VisionClient` class.

### Upgrade Path

To upgrade to newer Gemini models or APIs:
1. Update the `VisionClient` class
2. Modify the `analyze_image` method signature if needed
3. Update environment variable configurations
4. Test thoroughly with new API responses
5. Update parsing logic if response format changes

This documentation should be updated when the migration occurs.
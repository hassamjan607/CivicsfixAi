# Property 14: Single Missing-Field Follow-Up Implementation

## Overview

This document describes the implementation of Property-Based Test Task 4.3, which validates **Property 14: Single Missing-Field Follow-Up** as specified in the CivicFix AI design document.

## Property Description

**Property 14**: For any complaint message where exactly one mandatory field (category, location, or description) is absent after extraction, the `/chat` response SHALL contain exactly one clarifying question and `tracking_id` SHALL be null.

**Validates**: Requirements 1.3

## Implementation Details

### Test File Location
- `tests/test_single_missing_field_properties.py`

### Key Components Implemented

#### 1. Hypothesis Strategies
- **`complaint_with_single_missing_field()`**: Generates realistic complaint scenarios with exactly one missing field
- **`urdu_complaint_with_missing_field()`**: Generates Urdu language complaints with missing fields

#### 2. Test Classes

##### `TestSingleMissingFieldFollowUp`
Tests the core property with the following scenarios:
- Single missing field generates appropriate clarifying questions
- Urdu complaints receive Urdu clarifying questions
- Questions are field-specific and contextually appropriate
- Mock extraction correctly handles missing fields
- Chat response formatting for missing field scenarios
- Complete extractions don't generate follow-up questions

##### `TestFollowUpQuestionLanguageHandling`  
Tests bilingual support:
- Language-appropriate question generation (English/Urdu)
- Question contextual accuracy for each field type
- Fallback handling for unknown fields

##### `TestChatResponseIntegration`
Tests end-to-end integration:
- Complete flow from message to follow-up question
- Complete complaints don't generate follow-up questions

### Key Test Properties Validated

1. **Single Field Missing**: When exactly one field is missing, system generates exactly one clarifying question
2. **Tracking ID Null**: No tracking ID is returned when fields are being collected  
3. **Status "Collecting"**: Response status indicates field collection is in progress
4. **Contextual Questions**: Questions are specific to the missing field type
5. **Bilingual Support**: Urdu complaints get Urdu follow-up questions
6. **Field Specificity**: Category, location, and description questions are contextually different
7. **Complete Handling**: Complete complaints don't trigger follow-up questions

### Async Testing Strategy

Since Hypothesis doesn't natively support async test functions, I implemented a helper pattern:

```python
def run_async_test(async_func):
    """Helper to run async function in sync context for Hypothesis tests"""
    def wrapper(*args, **kwargs):
        return asyncio.run(async_func(*args, **kwargs))
    return wrapper
```

This allows property-based tests to work with the async agent functions.

### Mock Strategy

The tests use `patch('app.agent.create_mock_extraction')` to control the extraction results when using `use_mock=True` in `process_chat_message()`. This ensures predictable test scenarios while exercising the real chat response logic.

## Test Results

✅ **All tests pass** - 10 test methods covering various scenarios
✅ **Property validation confirmed** - The agent correctly handles single missing fields
✅ **Bilingual support verified** - English and Urdu questions are contextually appropriate
✅ **Integration testing complete** - End-to-end flow works as expected

## Coverage

The tests validate:
- ✅ Category missing scenarios
- ✅ Location missing scenarios  
- ✅ Description missing scenarios
- ✅ English and Urdu language support
- ✅ Question contextual appropriateness
- ✅ Response format correctness
- ✅ Complete complaint handling
- ✅ Mock extraction behavior
- ✅ Chat response integration

This implementation ensures that the CivicFix AI system reliably guides users through complaint submission by asking for exactly one missing piece of information at a time, in their preferred language, with contextually appropriate questions.
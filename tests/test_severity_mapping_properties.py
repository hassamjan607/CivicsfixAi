"""
Property-based tests for vision service severity label mapping system.

This module contains property-based tests using Hypothesis to validate
the vision service's severity label mapping to integer scores and integration
with the urgency calculation system.

**Validates: Requirements 6.2, 12.2**
"""

import pytest
from hypothesis import given, strategies as st, assume, settings, HealthCheck
from unittest.mock import Mock, patch, AsyncMock, MagicMock
import base64
import asyncio
from typing import Optional

from app.vision import (
    VisionResult, 
    get_base_severity_score, 
    analyze_photo, 
    parse_gemini_response,
    should_trigger_human_review,
    VisionClient
)
from app.rules import compute_urgency
from app import config


class TestSeverityLabelMappingProperties:
    """Property-based tests for severity label to integer mapping."""

    @given(severity_label=st.sampled_from(["low", "medium", "high", "critical"]))
    @pytest.mark.property
    def test_severity_label_to_integer_mapping_validity(self, severity_label):
        """
        Property: All valid severity labels map to integers in range [1, 6].
        
        **Validates: Requirements 6.2, 12.2**
        
        For any valid severity label returned by the Vision Service 
        ("low", "medium", "high", "critical"), SEVERITY_TO_INT[label] 
        SHALL return an integer in the range [1, 6].
        """
        # Create a vision result with the test severity label
        vision_result = VisionResult(
            severity=severity_label,
            description=f"Test {severity_label} severity issue",
            confidence=0.8
        )
        
        # Get the mapped severity score
        severity_score = get_base_severity_score(vision_result)
        
        # Verify the score is in valid range
        assert isinstance(severity_score, int), f"Severity score must be integer, got {type(severity_score)}"
        assert 1 <= severity_score <= 6, f"Severity score {severity_score} not in range [1, 6] for label '{severity_label}'"
        
        # Verify specific mappings from config
        expected_mapping = {
            "low": 2,
            "medium": 3, 
            "high": 5,
            "critical": 6
        }
        assert severity_score == expected_mapping[severity_label], (
            f"Severity '{severity_label}' should map to {expected_mapping[severity_label]}, got {severity_score}"
        )

    @given(
        invalid_label=st.text().filter(lambda x: x not in ["low", "medium", "high", "critical"])
    )
    @pytest.mark.property
    def test_invalid_severity_label_fallback(self, invalid_label):
        """
        Property: Invalid or unknown severity labels fall back to default score.
        
        **Validates: Requirements 6.2, 12.2**
        
        For any invalid or unknown severity label, the mapping system
        SHALL fall back to the default base severity score (3).
        """
        assume(invalid_label.strip() != "")  # Skip empty strings
        
        # Create a vision result with invalid severity (mock it)
        vision_result = VisionResult(
            severity="medium",  # Valid severity initially
            description="Test invalid severity handling",
            confidence=0.8
        )
        
        # Mock the severity attribute to test invalid value handling
        with patch.object(vision_result, 'severity', invalid_label):
            severity_score = get_base_severity_score(vision_result)
            
            # Should return DEFAULT_BASE_SEVERITY (3)
            assert severity_score == config.DEFAULT_BASE_SEVERITY, (
                f"Invalid severity label '{invalid_label}' should return default score "
                f"{config.DEFAULT_BASE_SEVERITY}, got {severity_score}"
            )

    @given(
        severity1=st.sampled_from(["low", "medium", "high", "critical"]),
        severity2=st.sampled_from(["low", "medium", "high", "critical"])
    )
    @pytest.mark.property
    def test_severity_mapping_consistency(self, severity1, severity2):
        """
        Property: Severity mapping is consistent and deterministic across multiple calls.
        
        **Validates: Requirements 6.2, 12.2**
        
        For any severity label, multiple calls to the mapping function
        SHALL return the same integer score consistently.
        """
        vision_result1 = VisionResult(
            severity=severity1,
            description="First test result",
            confidence=0.8
        )
        
        vision_result2 = VisionResult(
            severity=severity2,
            description="Second test result", 
            confidence=0.8
        )
        
        # Get scores multiple times
        score1_first = get_base_severity_score(vision_result1)
        score1_second = get_base_severity_score(vision_result1)
        score2_first = get_base_severity_score(vision_result2)
        score2_second = get_base_severity_score(vision_result2)
        
        # Same severity should always yield same score
        assert score1_first == score1_second, (
            f"Severity '{severity1}' gave inconsistent scores: {score1_first} vs {score1_second}"
        )
        assert score2_first == score2_second, (
            f"Severity '{severity2}' gave inconsistent scores: {score2_first} vs {score2_second}"
        )
        
        # If severities are equal, scores must be equal
        if severity1 == severity2:
            assert score1_first == score2_first, (
                f"Same severity '{severity1}' gave different scores: {score1_first} vs {score2_first}"
            )

    @given(
        severity_label=st.sampled_from(["low", "medium", "high", "critical"]),
        confidence=st.floats(min_value=0.0, max_value=1.0, allow_nan=False),
        description=st.text(min_size=1, max_size=200)
    )
    @pytest.mark.property
    def test_severity_mapping_independent_of_other_fields(self, severity_label, confidence, description):
        """
        Property: Severity mapping depends only on severity label, not other fields.
        
        **Validates: Requirements 6.2, 12.2**
        
        The severity to integer mapping SHALL depend only on the severity label
        and be independent of confidence score, description, or detected elements.
        """
        # Create multiple vision results with same severity but different other fields
        result1 = VisionResult(
            severity=severity_label,
            description=description[:50],  # Truncate to avoid validation issues
            confidence=confidence,
            detected_elements=["element1", "element2"]
        )
        
        result2 = VisionResult(
            severity=severity_label,
            description=description[50:100] if len(description) > 50 else "Different description",
            confidence=1.0 - confidence if confidence < 1.0 else 0.5,
            detected_elements=[]
        )
        
        score1 = get_base_severity_score(result1)
        score2 = get_base_severity_score(result2)
        
        # Same severity should yield same score regardless of other fields
        assert score1 == score2, (
            f"Same severity '{severity_label}' gave different scores with different fields: "
            f"{score1} vs {score2}"
        )


class TestSeverityMappingIntegrationProperties:
    """Property-based tests for severity mapping integration with urgency scoring."""

    @given(
        severity_label=st.sampled_from(["low", "medium", "high", "critical"]),
        weather_bonus=st.integers(min_value=0, max_value=2),
        recurrence_count=st.integers(min_value=0, max_value=10),
        near_sensitive_place=st.booleans(),
        vulnerable_group=st.booleans()
    )
    @pytest.mark.property
    def test_severity_mapping_integration_with_urgency_scoring(
        self, severity_label, weather_bonus, recurrence_count, 
        near_sensitive_place, vulnerable_group
    ):
        """
        Property: Severity mapping integrates correctly with urgency scoring system.
        
        **Validates: Requirements 6.1, 6.2, 12.2**
        
        The mapped severity integer score SHALL be used correctly as the
        base_severity input to the urgency computation system, contributing
        to the final urgency score within the expected range [1, 10].
        """
        # Create vision result
        vision_result = VisionResult(
            severity=severity_label,
            description=f"Test {severity_label} severity infrastructure issue",
            confidence=0.8
        )
        
        # Get mapped severity score
        base_severity = get_base_severity_score(vision_result)
        
        # Compute urgency using the mapped score
        urgency_score, reasons = compute_urgency(
            base_severity=base_severity,
            weather_bonus=weather_bonus,
            recurrence_count=recurrence_count,
            near_sensitive_place=near_sensitive_place,
            vulnerable_group=vulnerable_group,
            text="Test complaint text without emergency keywords"
        )
        
        # Verify urgency score is in valid range
        assert 1 <= urgency_score <= 10, (
            f"Urgency score {urgency_score} not in range [1, 10] for severity '{severity_label}'"
        )
        
        # Verify base severity is correctly reflected in reasons
        base_reason = f"Base severity: {base_severity}"
        assert base_reason in reasons, (
            f"Base severity reason '{base_reason}' not found in reasons: {reasons}"
        )
        
        # Verify the base severity contributes to the final score
        expected_minimum_score = base_severity  # At minimum, should include base severity
        assert urgency_score >= expected_minimum_score, (
            f"Urgency score {urgency_score} is less than base severity {base_severity}"
        )

    @given(
        severity_ordering=st.lists(
            st.sampled_from(["low", "medium", "high", "critical"]),
            min_size=2,
            max_size=4
        ).filter(lambda x: len(set(x)) > 1)  # Ensure we have different severities
    )
    @pytest.mark.property
    def test_severity_mapping_preserves_ordering(self, severity_ordering):
        """
        Property: Severity mapping preserves logical ordering of severity levels.
        
        **Validates: Requirements 6.2, 12.2**
        
        The mapped integer scores SHALL preserve the logical ordering:
        low < medium < high < critical
        """
        severity_hierarchy = ["low", "medium", "high", "critical"]
        hierarchy_indices = {sev: idx for idx, sev in enumerate(severity_hierarchy)}
        
        # Get mapped scores for all severities in our test set
        severity_scores = {}
        for severity in severity_ordering:
            vision_result = VisionResult(
                severity=severity,
                description=f"Test {severity} issue",
                confidence=0.8
            )
            severity_scores[severity] = get_base_severity_score(vision_result)
        
        # Check ordering is preserved
        unique_severities = list(set(severity_ordering))
        for i, sev1 in enumerate(unique_severities):
            for sev2 in unique_severities[i+1:]:
                # Compare based on hierarchy
                idx1 = hierarchy_indices[sev1]
                idx2 = hierarchy_indices[sev2]
                score1 = severity_scores[sev1]
                score2 = severity_scores[sev2]
                
                if idx1 < idx2:  # sev1 is lower in hierarchy
                    assert score1 < score2, (
                        f"Severity hierarchy violation: '{sev1}' (score {score1}) should be "
                        f"less than '{sev2}' (score {score2})"
                    )
                elif idx1 > idx2:  # sev1 is higher in hierarchy
                    assert score1 > score2, (
                        f"Severity hierarchy violation: '{sev1}' (score {score1}) should be "
                        f"greater than '{sev2}' (score {score2})"
                    )

    @given(
        severity_label=st.sampled_from(["low", "medium", "high", "critical"])
    )
    @pytest.mark.property
    def test_severity_mapping_within_expected_base_range(self, severity_label):
        """
        Property: All mapped severity scores are within expected base range.
        
        **Validates: Requirements 6.2, 12.2**
        
        All severity labels SHALL map to scores within the expected base severity 
        range, ensuring they contribute appropriately to urgency calculations.
        """
        vision_result = VisionResult(
            severity=severity_label,
            description="Test severity range validation",
            confidence=0.8
        )
        
        base_severity = get_base_severity_score(vision_result)
        
        # Base severity should be in range [1, 6] as specified in design
        assert 1 <= base_severity <= 6, (
            f"Base severity {base_severity} for '{severity_label}' not in range [1, 6]"
        )
        
        # Verify it falls within the specific expected range for vision results
        # According to config: low=2, medium=3, high=5, critical=6
        expected_vision_range = [2, 3, 5, 6]
        assert base_severity in expected_vision_range, (
            f"Base severity {base_severity} for '{severity_label}' not in expected vision range {expected_vision_range}"
        )


class TestSeverityMappingEdgeCasesProperties:
    """Property-based tests for edge cases in severity mapping."""

    @given(
        case_variant=st.sampled_from([
            "low", "LOW", "Low", "LoW",
            "medium", "MEDIUM", "Medium", "MeDiUm", 
            "high", "HIGH", "High", "HiGh",
            "critical", "CRITICAL", "Critical", "CrItIcAl"
        ])
    )
    @pytest.mark.property
    def test_severity_mapping_case_sensitivity(self, case_variant):
        """
        Property: Severity mapping handles case variations appropriately.
        
        **Validates: Requirements 6.2, 12.2**
        
        The severity mapping system SHALL handle case variations consistently,
        either by being case-insensitive or by falling back to default for non-exact matches.
        """
        vision_result = VisionResult(
            severity="medium",  # Start with valid severity
            description="Test case sensitivity handling",
            confidence=0.8
        )
        
        # Mock the severity to test case variants
        with patch.object(vision_result, 'severity', case_variant):
            severity_score = get_base_severity_score(vision_result)
            
            # Determine expected behavior based on case
            normalized_case = case_variant.lower()
            if normalized_case in ["low", "medium", "high", "critical"]:
                # If the system is case-insensitive, it should map correctly
                expected_scores = {"low": 2, "medium": 3, "high": 5, "critical": 6}
                # For now, assume case-sensitive (based on config.py implementation)
                if case_variant == normalized_case:  # Exact match
                    expected_score = expected_scores[normalized_case]
                    assert severity_score == expected_score, (
                        f"Case-sensitive mapping failed: '{case_variant}' should map to {expected_score}, got {severity_score}"
                    )
                else:  # Case mismatch
                    # Should fall back to default
                    assert severity_score == config.DEFAULT_BASE_SEVERITY, (
                        f"Case mismatch '{case_variant}' should fall back to default {config.DEFAULT_BASE_SEVERITY}, got {severity_score}"
                    )

    @given(
        severity_with_whitespace=st.sampled_from([
            " low ", "  medium  ", "\thigh\t", "\ncritical\n"
        ])
    )
    @pytest.mark.property
    @settings(suppress_health_check=[HealthCheck.filter_too_much])
    def test_severity_mapping_whitespace_handling(self, severity_with_whitespace):
        """
        Property: Severity mapping handles whitespace in labels appropriately.
        
        **Validates: Requirements 6.2, 12.2**
        
        The severity mapping system SHALL handle whitespace in severity labels
        by either trimming them or falling back to default values.
        """
        vision_result = VisionResult(
            severity="medium",
            description="Test whitespace handling",
            confidence=0.8
        )
        
        # Mock the severity with whitespace
        with patch.object(vision_result, 'severity', severity_with_whitespace):
            severity_score = get_base_severity_score(vision_result)
            
            # Should either handle whitespace or fall back to default
            trimmed = severity_with_whitespace.strip()
            if trimmed in ["low", "medium", "high", "critical"]:
                expected_scores = {"low": 2, "medium": 3, "high": 5, "critical": 6}
                # For strict matching, whitespace should cause fallback to default
                assert severity_score == config.DEFAULT_BASE_SEVERITY, (
                    f"Whitespace in severity '{severity_with_whitespace}' should fall back to default "
                    f"{config.DEFAULT_BASE_SEVERITY}, got {severity_score}"
                )

    @given(
        multiple_mappings=st.integers(min_value=1, max_value=100)
    )
    @pytest.mark.property
    def test_severity_mapping_no_side_effects(self, multiple_mappings):
        """
        Property: Multiple severity mappings don't cause side effects.
        
        **Validates: Requirements 6.2, 12.2**
        
        Calling the severity mapping function multiple times SHALL not
        cause side effects or state changes that affect subsequent calls.
        """
        vision_result = VisionResult(
            severity="high",
            description="Test side effects",
            confidence=0.8
        )
        
        scores = []
        for _ in range(multiple_mappings):
            score = get_base_severity_score(vision_result)
            scores.append(score)
        
        # All scores should be identical
        assert len(set(scores)) == 1, (
            f"Multiple calls to severity mapping produced different results: {set(scores)}"
        )
        assert scores[0] == 5, f"High severity should map to 5, got {scores[0]}"


class TestVisionServiceMappingIntegrationProperties:
    """Property-based tests for vision service integration with severity mapping."""

    @given(
        mock_gemini_response=st.sampled_from([
            "This shows a low severity crack in the pavement",
            "Medium damage to the road surface is visible", 
            "High severity pothole with significant depth",
            "Critical infrastructure failure with immediate danger"
        ])
    )
    @pytest.mark.asyncio
    @pytest.mark.property
    async def test_vision_analysis_to_severity_mapping_pipeline(self, mock_gemini_response):
        """
        Property: Full vision analysis pipeline produces valid severity mappings.
        
        **Validates: Requirements 6.2, 12.1, 12.2, 12.3**
        
        The complete vision service pipeline (analysis -> parsing -> mapping -> scoring)
        SHALL produce valid severity scores within the expected range.
        """
        # Create test image
        test_image = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        # Mock the Gemini API response
        with patch('app.vision.VisionClient') as mock_vision_client_class:
            mock_client = Mock()
            mock_client.client = Mock()  # Not None to indicate API is available
            mock_client.analyze_image = AsyncMock(return_value=mock_gemini_response)
            mock_vision_client_class.return_value = mock_client
            
            # Mock environment variables
            with patch.dict('os.environ', {'GOOGLE_API_KEY': 'test_key'}):
                # Analyze photo
                vision_result = await analyze_photo(test_image, "Test complaint")
                
                # Get severity score
                severity_score = get_base_severity_score(vision_result)
                
                # Verify the pipeline works end-to-end
                assert vision_result.severity in ["low", "medium", "high", "critical"], (
                    f"Vision analysis produced invalid severity: {vision_result.severity}"
                )
                
                assert 1 <= severity_score <= 6, (
                    f"Mapped severity score {severity_score} not in valid range [1, 6]"
                )
                
                # Verify the specific mapping matches expected values
                expected_mappings = {"low": 2, "medium": 3, "high": 5, "critical": 6}
                assert severity_score == expected_mappings[vision_result.severity], (
                    f"Severity '{vision_result.severity}' should map to "
                    f"{expected_mappings[vision_result.severity]}, got {severity_score}"
                )
                
                # Verify analysis produces description
                assert len(vision_result.description) > 0, (
                    "Vision analysis should produce non-empty description"
                )

    @given(
        api_failure_scenario=st.sampled_from([
            "no_api_key",
            "api_timeout", 
            "api_error",
            "invalid_response"
        ])
    )
    @pytest.mark.asyncio
    @pytest.mark.property
    async def test_vision_service_fallback_severity_mapping(self, api_failure_scenario):
        """
        Property: Vision service fallback scenarios produce valid severity mappings.
        
        **Validates: Requirements 6.2, 12.4, 25.1**
        
        When vision service fails, the fallback mechanism SHALL still produce
        valid severity scores that integrate correctly with the urgency system.
        """
        # Create test image
        test_image = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        if api_failure_scenario == "no_api_key":
            # Test with no API key
            with patch.dict('os.environ', {}, clear=True):
                vision_result = await analyze_photo(test_image, "Test complaint")
                
        elif api_failure_scenario == "api_timeout":
            # Mock API timeout
            with patch('app.vision.VisionClient') as mock_vision_client_class:
                mock_client = Mock()
                mock_client.client = Mock()
                mock_client.analyze_image = AsyncMock(side_effect=asyncio.TimeoutError("API timeout"))
                mock_vision_client_class.return_value = mock_client
                
                with patch.dict('os.environ', {'GOOGLE_API_KEY': 'test_key'}):
                    vision_result = await analyze_photo(test_image, "Test complaint")
                    
        elif api_failure_scenario == "api_error":
            # Mock API error
            with patch('app.vision.VisionClient') as mock_vision_client_class:
                mock_client = Mock()
                mock_client.client = Mock()
                mock_client.analyze_image = AsyncMock(side_effect=Exception("API error"))
                mock_vision_client_class.return_value = mock_client
                
                with patch.dict('os.environ', {'GOOGLE_API_KEY': 'test_key'}):
                    vision_result = await analyze_photo(test_image, "Test complaint")
                    
        else:  # invalid_response
            # Mock invalid API response
            with patch('app.vision.VisionClient') as mock_vision_client_class:
                mock_client = Mock()
                mock_client.client = Mock()
                mock_client.analyze_image = AsyncMock(return_value="")
                mock_vision_client_class.return_value = mock_client
                
                with patch.dict('os.environ', {'GOOGLE_API_KEY': 'test_key'}):
                    vision_result = await analyze_photo(test_image, "Test complaint")
        
        # Get severity score from fallback result
        severity_score = get_base_severity_score(vision_result)
        
        # Verify fallback produces valid values
        assert vision_result.severity in ["low", "medium", "high", "critical"], (
            f"Fallback produced invalid severity: {vision_result.severity}"
        )
        
        assert 1 <= severity_score <= 6, (
            f"Fallback severity score {severity_score} not in valid range [1, 6]"
        )
        
        # Verify fallback behavior depends on the scenario
        if api_failure_scenario in ["no_api_key", "api_timeout", "api_error"]:
            # These scenarios use _create_fallback_result which has confidence=0.0
            assert vision_result.severity == "medium", (
                f"Fallback should use 'medium' severity, got '{vision_result.severity}'"
            )
            assert severity_score == 3, (
                f"Fallback severity score should be 3 (medium), got {severity_score}"
            )
            # Verify fallback is suitable for human review
            needs_review = should_trigger_human_review(vision_result)
            assert needs_review is True, (
                "Fallback results should trigger human review due to low confidence"
            )
        else:  # invalid_response
            # Empty response goes through parse_gemini_response which has base confidence 0.7
            assert vision_result.severity == "medium", (
                f"Parsed empty response should default to 'medium' severity, got '{vision_result.severity}'"
            )
            assert severity_score == 3, (
                f"Parsed empty response should map to score 3, got {severity_score}"
            )
            # May or may not trigger human review depending on confidence calculation


class TestSeverityMappingBoundaryProperties:
    """Property-based tests for boundary conditions in severity mapping."""

    @given(
        boundary_severity=st.sampled_from([
            ("low", 2),      # Minimum vision severity
            ("critical", 6), # Maximum vision severity  
            ("medium", 3)    # Default severity
        ])
    )
    @pytest.mark.property
    def test_severity_mapping_boundary_values(self, boundary_severity):
        """
        Property: Boundary severity values map correctly to expected scores.
        
        **Validates: Requirements 6.2, 12.2**
        
        Boundary values in the severity mapping system SHALL produce
        the correct integer scores without overflow or underflow.
        """
        severity_label, expected_score = boundary_severity
        
        vision_result = VisionResult(
            severity=severity_label,
            description=f"Test {severity_label} boundary case",
            confidence=0.8
        )
        
        severity_score = get_base_severity_score(vision_result)
        
        # Verify exact boundary mapping
        assert severity_score == expected_score, (
            f"Boundary severity '{severity_label}' should map to {expected_score}, got {severity_score}"
        )
        
        # Verify score is within absolute bounds
        assert 1 <= severity_score <= 6, (
            f"Boundary score {severity_score} exceeds absolute bounds [1, 6]"
        )

    @given(
        max_urgency_scenario=st.tuples(
            st.sampled_from(["critical"]),  # Highest severity
            st.just(2),                     # Max weather bonus
            st.integers(min_value=config.ROOT_CAUSE_THRESHOLD, max_value=10),  # Max recurrence
            st.just(True),                  # Near sensitive place
            st.just(True)                   # Vulnerable group
        )
    )
    @pytest.mark.property
    def test_severity_mapping_contributes_to_max_urgency(self, max_urgency_scenario):
        """
        Property: Maximum severity contributes appropriately to maximum urgency scenarios.
        
        **Validates: Requirements 6.1, 6.2, 12.2**
        
        The highest severity mapping (critical -> 6) SHALL contribute appropriately
        to scenarios that could reach maximum urgency score (10).
        """
        severity_label, weather_bonus, recurrence_count, near_sensitive, vulnerable_group = max_urgency_scenario
        
        vision_result = VisionResult(
            severity=severity_label,
            description="Critical infrastructure failure",
            confidence=0.8
        )
        
        base_severity = get_base_severity_score(vision_result)
        
        # Compute urgency with maximum contributing factors
        urgency_score, reasons = compute_urgency(
            base_severity=base_severity,
            weather_bonus=weather_bonus,
            recurrence_count=recurrence_count,
            near_sensitive_place=near_sensitive,
            vulnerable_group=vulnerable_group,
            text="Test complaint without emergency keywords"
        )
        
        # Verify critical severity maps to 6
        assert base_severity == 6, f"Critical severity should map to 6, got {base_severity}"
        
        # Verify urgency reaches near-maximum (capped at 10)
        expected_score = min(base_severity + weather_bonus + 2 + 1 + 1, 10)  # 6+2+2+1+1 = 12, capped at 10
        assert urgency_score == expected_score, (
            f"Max urgency scenario should produce score {expected_score}, got {urgency_score}"
        )
        
        # Verify urgency is at maximum
        assert urgency_score == 10, f"Maximum scenario should reach urgency 10, got {urgency_score}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
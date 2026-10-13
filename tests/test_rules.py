"""
CivicFix AI Rules Engine Test Suite

Property-based tests and unit tests for the pure Python urgency scoring
rules engine. Tests all scoring formulas and emergency overrides.

This will be implemented in Task 3.
"""

import pytest
from hypothesis import given, strategies as st

from app.rules import compute_urgency
from app.config import EMERGENCY_KEYWORDS, ROOT_CAUSE_THRESHOLD


class TestUrgencyScoring:
    """Test cases for urgency scoring logic"""

    def test_basic_urgency_computation(self):
        """Test basic urgency score calculation"""
        # Test minimum score scenario
        score, reasons = compute_urgency(
            base_severity=1,
            weather_bonus=0,
            recurrence_count=0,
            near_sensitive_place=False,
            vulnerable_group=False,
            text="Normal complaint"
        )
        assert score == 1
        assert reasons == ["Base severity: 1"]
        
        # Test maximum non-emergency scenario  
        score, reasons = compute_urgency(
            base_severity=6,
            weather_bonus=2,
            recurrence_count=5,  # >= ROOT_CAUSE_THRESHOLD
            near_sensitive_place=True,
            vulnerable_group=True,
            text="Complex complaint"
        )
        # 6 + 2 + 2 + 1 + 1 = 12, capped at 10
        assert score == 10
        expected_reasons = [
            "Base severity: 6",
            "Weather bonus: +2", 
            "Recurrence bonus: +2",
            "Near sensitive place: +1",
            "Vulnerable group flag: +1"
        ]
        assert reasons == expected_reasons

    def test_emergency_keyword_override(self):
        """Test emergency keyword detection and score override"""
        for keyword in EMERGENCY_KEYWORDS:
            # Test exact match (lowercase)
            score, reasons = compute_urgency(
                base_severity=1,
                weather_bonus=0,
                recurrence_count=0,
                near_sensitive_place=False,
                vulnerable_group=False,
                text=f"There is a {keyword} in the street"
            )
            assert score == 10
            assert reasons == ["Emergency override triggered"]
            
            # Test case insensitive match
            score, reasons = compute_urgency(
                base_severity=6,
                weather_bonus=2,
                recurrence_count=5,
                near_sensitive_place=True,
                vulnerable_group=True,
                text=f"URGENT: {keyword.upper()} DETECTED"
            )
            assert score == 10
            assert reasons == ["Emergency override triggered"]

    def test_weather_bonus_application(self):
        """Test weather bonus integration"""
        base_params = {
            "base_severity": 3,
            "recurrence_count": 0,
            "near_sensitive_place": False,
            "vulnerable_group": False,
            "text": "normal complaint"
        }
        
        # No weather bonus
        score, reasons = compute_urgency(weather_bonus=0, **base_params)
        assert score == 3
        assert "Weather bonus" not in " ".join(reasons)
        
        # Weather bonus +1
        score, reasons = compute_urgency(weather_bonus=1, **base_params)
        assert score == 4
        assert "Weather bonus: +1" in reasons
        
        # Weather bonus +2
        score, reasons = compute_urgency(weather_bonus=2, **base_params)
        assert score == 5
        assert "Weather bonus: +2" in reasons

    def test_recurrence_bonus_tiers(self):
        """Test recurrence count bonus calculation"""
        base_params = {
            "base_severity": 3,
            "weather_bonus": 0,
            "near_sensitive_place": False,
            "vulnerable_group": False,
            "text": "normal complaint"
        }
        
        # No recurrence (count = 0)
        score, reasons = compute_urgency(recurrence_count=0, **base_params)
        assert score == 3
        assert "Recurrence bonus" not in " ".join(reasons)
        
        # Low recurrence (1-2 occurrences)
        for count in [1, 2]:
            score, reasons = compute_urgency(recurrence_count=count, **base_params)
            assert score == 4
            assert "Recurrence bonus: +1" in reasons
            
        # High recurrence (>= threshold) 
        score, reasons = compute_urgency(recurrence_count=ROOT_CAUSE_THRESHOLD, **base_params)
        assert score == 5
        assert "Recurrence bonus: +2" in reasons
        
        score, reasons = compute_urgency(recurrence_count=ROOT_CAUSE_THRESHOLD + 2, **base_params)
        assert score == 5
        assert "Recurrence bonus: +2" in reasons

    def test_sensitive_place_bonus(self):
        """Test sensitive place location bonus"""
        base_params = {
            "base_severity": 3,
            "weather_bonus": 0,
            "recurrence_count": 0,
            "vulnerable_group": False,
            "text": "normal complaint"
        }
        
        # No sensitive place
        score, reasons = compute_urgency(near_sensitive_place=False, **base_params)
        assert score == 3
        assert "Near sensitive place" not in " ".join(reasons)
        
        # Near sensitive place
        score, reasons = compute_urgency(near_sensitive_place=True, **base_params)
        assert score == 4
        assert "Near sensitive place: +1" in reasons

    def test_vulnerable_group_bonus(self):
        """Test vulnerable group flag bonus"""
        base_params = {
            "base_severity": 3,
            "weather_bonus": 0,
            "recurrence_count": 0,
            "near_sensitive_place": False,
            "text": "normal complaint"
        }
        
        # No vulnerable group
        score, reasons = compute_urgency(vulnerable_group=False, **base_params)
        assert score == 3
        assert "Vulnerable group" not in " ".join(reasons)
        
        # Vulnerable group present
        score, reasons = compute_urgency(vulnerable_group=True, **base_params)
        assert score == 4
        assert "Vulnerable group flag: +1" in reasons

    def test_score_capping_at_10(self):
        """Test that scores are properly capped at 10"""
        # Test scenario that would exceed 10 without capping
        score, reasons = compute_urgency(
            base_severity=6,  # +6
            weather_bonus=2,  # +2
            recurrence_count=5,  # +2 (>= threshold)
            near_sensitive_place=True,  # +1
            vulnerable_group=True,  # +1  
            text="complex high priority complaint"  # Total would be 12
        )
        
        # Should be capped at 10
        assert score == 10
        
        # All components should be listed in reasons
        expected_components = [
            "Base severity: 6",
            "Weather bonus: +2",
            "Recurrence bonus: +2", 
            "Near sensitive place: +1",
            "Vulnerable group flag: +1"
        ]
        
        for component in expected_components:
            assert component in reasons, f"Missing component: {component}"

    def test_emergency_keywords_case_insensitive(self):
        """Test that emergency keyword detection is case insensitive"""
        test_cases = [
            "There is a LIVE WIRE down",
            "live wire spotted",
            "Live Wire danger",
            "I see a Live Wire",
            "OPEN MANHOLE on the road",
            "open manhole here", 
            "GAS SMELL detected",
            "gas smell strong",
            "LIVE TAAR hanging",
            "live taar loose",
            "KHULI MANHOLE visible", 
            "khuli manhole open"
        ]
        
        for text in test_cases:
            score, reasons = compute_urgency(
                base_severity=1,
                weather_bonus=0,
                recurrence_count=0,
                near_sensitive_place=False,
                vulnerable_group=False,
                text=text
            )
            
            assert score == 10, f"Emergency override failed for text: '{text}'"
            assert reasons == ["Emergency override triggered"], \
                f"Wrong reasons for emergency text '{text}': {reasons}"


class TestUrgencyProperties:
    """Property-based tests for urgency scoring correctness"""

    @given(
        base_severity=st.integers(min_value=1, max_value=6),
        weather_bonus=st.integers(min_value=0, max_value=2),
        recurrence_count=st.integers(min_value=0, max_value=25),  # Expanded range for more comprehensive testing
        near_sensitive_place=st.booleans(),
        vulnerable_group=st.booleans(),
        text=st.text(min_size=0, max_size=200).filter(lambda x: not any(kw.lower() in x.lower() for kw in EMERGENCY_KEYWORDS))
    )
    def test_urgency_score_bounds_property(self, base_severity, weather_bonus, 
                                         recurrence_count, near_sensitive_place,
                                         vulnerable_group, text):
        """**Property 1: Urgency Score Bounds and Formula Correctness**
        
        For any combination of valid inputs (base_severity 1-6, weather_bonus 0-2, 
        recurrence_count 0+, sensitive/vulnerable flags), compute_urgency SHALL return 
        a score in [1, 10] and non-empty reasons list with correct components.
        
        **Validates: Requirements 6.1, 6.4**
        """
        score, reasons = compute_urgency(
            base_severity=base_severity,
            weather_bonus=weather_bonus, 
            recurrence_count=recurrence_count,
            near_sensitive_place=near_sensitive_place,
            vulnerable_group=vulnerable_group,
            text=text
        )
        
        # 1. Score must be in bounds [1, 10]
        assert 1 <= score <= 10, f"Score {score} out of bounds for inputs: base={base_severity}, weather={weather_bonus}, recurrence={recurrence_count}, sensitive={near_sensitive_place}, vulnerable={vulnerable_group}"
        
        # 2. Reasons list must be non-empty and contain expected components
        assert len(reasons) > 0, "Reasons list should not be empty"
        assert all(isinstance(reason, str) and len(reason) > 0 for reason in reasons), \
            "All reasons must be non-empty strings"
        
        # 3. Base severity should always be present in reasons (required component)
        base_severity_reasons = [r for r in reasons if "Base severity:" in r]
        assert len(base_severity_reasons) == 1, \
            f"Exactly one base severity reason expected, got {len(base_severity_reasons)}: {base_severity_reasons}"
        assert f"Base severity: {base_severity}" in reasons, \
            f"Expected 'Base severity: {base_severity}' in reasons: {reasons}"
        
        # 4. Verify each scoring component appears correctly in reasons when applicable
        if weather_bonus > 0:
            weather_reasons = [r for r in reasons if "Weather bonus:" in r]
            assert len(weather_reasons) == 1, \
                f"Expected exactly one weather bonus reason when weather_bonus={weather_bonus}, got {len(weather_reasons)}: {weather_reasons}"
            assert f"Weather bonus: +{weather_bonus}" in reasons, \
                f"Expected 'Weather bonus: +{weather_bonus}' in reasons: {reasons}"
        else:
            # No weather bonus should be mentioned when bonus is 0
            assert not any("Weather bonus:" in reason for reason in reasons), \
                f"Weather bonus should not appear in reasons when weather_bonus=0: {reasons}"
                
        # Calculate expected recurrence bonus based on threshold
        expected_recurrence_bonus = 0
        if recurrence_count >= ROOT_CAUSE_THRESHOLD:
            expected_recurrence_bonus = 2
        elif recurrence_count > 0:
            expected_recurrence_bonus = 1
            
        if expected_recurrence_bonus > 0:
            recurrence_reasons = [r for r in reasons if "Recurrence bonus:" in r]
            assert len(recurrence_reasons) == 1, \
                f"Expected exactly one recurrence bonus reason when recurrence_count={recurrence_count}, got {len(recurrence_reasons)}: {recurrence_reasons}"
            assert f"Recurrence bonus: +{expected_recurrence_bonus}" in reasons, \
                f"Expected 'Recurrence bonus: +{expected_recurrence_bonus}' for recurrence_count={recurrence_count} in reasons: {reasons}"
        else:
            # No recurrence bonus should be mentioned when count is 0
            assert not any("Recurrence bonus:" in reason for reason in reasons), \
                f"Recurrence bonus should not appear in reasons when recurrence_count=0: {reasons}"
                
        if near_sensitive_place:
            sensitive_place_reasons = [r for r in reasons if "Near sensitive place:" in r]
            assert len(sensitive_place_reasons) == 1, \
                f"Expected exactly one sensitive place reason when near_sensitive_place=True, got {len(sensitive_place_reasons)}: {sensitive_place_reasons}"
            assert "Near sensitive place: +1" in reasons, \
                f"Expected 'Near sensitive place: +1' in reasons: {reasons}"
        else:
            # No sensitive place bonus should be mentioned when False
            assert not any("Near sensitive place:" in reason for reason in reasons), \
                f"Sensitive place bonus should not appear in reasons when near_sensitive_place=False: {reasons}"
                
        if vulnerable_group:
            vulnerable_group_reasons = [r for r in reasons if "Vulnerable group flag:" in r]
            assert len(vulnerable_group_reasons) == 1, \
                f"Expected exactly one vulnerable group reason when vulnerable_group=True, got {len(vulnerable_group_reasons)}: {vulnerable_group_reasons}"
            assert "Vulnerable group flag: +1" in reasons, \
                f"Expected 'Vulnerable group flag: +1' in reasons: {reasons}"
        else:
            # No vulnerable group bonus should be mentioned when False
            assert not any("Vulnerable group flag:" in reason for reason in reasons), \
                f"Vulnerable group flag should not appear in reasons when vulnerable_group=False: {reasons}"
        
        # 5. Verify formula is applied correctly - manual calculation check
        expected_score_uncapped = base_severity + weather_bonus + expected_recurrence_bonus
        if near_sensitive_place:
            expected_score_uncapped += 1
        if vulnerable_group:
            expected_score_uncapped += 1
        
        expected_score = min(expected_score_uncapped, 10)  # Cap at 10
        assert score == expected_score, \
            f"Formula incorrect: expected {expected_score} (uncapped: {expected_score_uncapped}), got {score} for inputs: base={base_severity}, weather={weather_bonus}, recurrence={recurrence_count} (bonus={expected_recurrence_bonus}), sensitive={near_sensitive_place}, vulnerable={vulnerable_group}"
        
        # 6. Verify reasons count matches active components
        expected_reason_count = 1  # Base severity always present
        if weather_bonus > 0:
            expected_reason_count += 1
        if expected_recurrence_bonus > 0:
            expected_reason_count += 1
        if near_sensitive_place:
            expected_reason_count += 1
        if vulnerable_group:
            expected_reason_count += 1
            
        assert len(reasons) == expected_reason_count, \
            f"Expected {expected_reason_count} reasons, got {len(reasons)}: {reasons}. Active components: base_severity=True, weather_bonus={weather_bonus > 0}, recurrence_bonus={expected_recurrence_bonus > 0}, sensitive_place={near_sensitive_place}, vulnerable_group={vulnerable_group}"

    @given(
        text=st.text(),
        base_severity=st.integers(min_value=1, max_value=6),
        weather_bonus=st.integers(min_value=0, max_value=2),
        recurrence_count=st.integers(min_value=0, max_value=10),
        near_sensitive_place=st.booleans(),
        vulnerable_group=st.booleans()
    )
    def test_emergency_override_supremacy_property(self, text, base_severity, weather_bonus,
                                                 recurrence_count, near_sensitive_place, vulnerable_group):
        """Property 2: Emergency Override Supremacy
        
        For any complaint text containing emergency keywords (case-insensitive),
        compute_urgency SHALL return score=10 and exactly the single reason
        "Emergency override triggered", regardless of ALL other scoring factors.
        
        This test verifies:
        1. Any text containing emergency keywords results in score=10
        2. The single reason "Emergency override triggered" is returned
        3. Case-insensitive matching works correctly
        4. Emergency override takes precedence over all other scoring factors
        5. Non-emergency text follows normal scoring rules
        
        Validates: Requirements 6.5
        """
        # Check if text contains any emergency keywords (case-insensitive)
        contains_emergency = any(kw.lower() in text.lower() for kw in EMERGENCY_KEYWORDS)
        
        score, reasons = compute_urgency(
            base_severity=base_severity,
            weather_bonus=weather_bonus,
            recurrence_count=recurrence_count,
            near_sensitive_place=near_sensitive_place,
            vulnerable_group=vulnerable_group,
            text=text
        )
        
        if contains_emergency:
            # Emergency override should trigger regardless of other factors
            assert score == 10, f"Emergency keyword detected but score is {score}, not 10. Text: '{text}'"
            assert reasons == ["Emergency override triggered"], \
                f"Emergency override should produce single reason, got {reasons}. " \
                f"Input params: base={base_severity}, weather={weather_bonus}, " \
                f"recurrence={recurrence_count}, sensitive={near_sensitive_place}, " \
                f"vulnerable={vulnerable_group}, text='{text}'"
        else:
            # Without emergency keywords, score should be computed normally using full formula
            expected_score = base_severity
            expected_reasons = [f"Base severity: {base_severity}"]
            
            # Add weather bonus if applicable
            if weather_bonus > 0:
                expected_score += weather_bonus
                expected_reasons.append(f"Weather bonus: +{weather_bonus}")
            
            # Calculate recurrence bonus
            if recurrence_count >= ROOT_CAUSE_THRESHOLD:
                expected_score += 2
                expected_reasons.append("Recurrence bonus: +2")
            elif recurrence_count > 0:
                expected_score += 1
                expected_reasons.append("Recurrence bonus: +1")
                
            # Add sensitive place bonus
            if near_sensitive_place:
                expected_score += 1
                expected_reasons.append("Near sensitive place: +1")
                
            # Add vulnerable group bonus
            if vulnerable_group:
                expected_score += 1
                expected_reasons.append("Vulnerable group flag: +1")
                
            # Cap at 10
            expected_score = min(expected_score, 10)
            
            assert score == expected_score, \
                f"Non-emergency scoring incorrect. Expected {expected_score}, got {score}. " \
                f"Input params: base={base_severity}, weather={weather_bonus}, " \
                f"recurrence={recurrence_count}, sensitive={near_sensitive_place}, " \
                f"vulnerable={vulnerable_group}"
            
            assert reasons == expected_reasons, \
                f"Non-emergency reasons incorrect. Expected {expected_reasons}, got {reasons}"

    @given(
        keyword=st.sampled_from(EMERGENCY_KEYWORDS),
        prefix=st.text(max_size=50).filter(lambda x: not any(kw.lower() in x.lower() for kw in EMERGENCY_KEYWORDS)),
        suffix=st.text(max_size=50).filter(lambda x: not any(kw.lower() in x.lower() for kw in EMERGENCY_KEYWORDS)),
        case_transformation=st.sampled_from(['lower', 'upper', 'title', 'mixed']),
        max_scoring_factors=st.booleans()
    )
    def test_emergency_override_comprehensive_scenarios(self, keyword, prefix, suffix, 
                                                      case_transformation, max_scoring_factors):
        """Comprehensive test for emergency override with various text combinations
        
        This test creates text with embedded emergency keywords in various cases
        and contexts, then verifies the emergency override always works correctly
        regardless of other factors.
        """
        # Apply case transformation to keyword
        if case_transformation == 'lower':
            transformed_keyword = keyword.lower()
        elif case_transformation == 'upper':
            transformed_keyword = keyword.upper()
        elif case_transformation == 'title':
            transformed_keyword = keyword.title()
        else:  # mixed case
            transformed_keyword = ''.join(
                c.upper() if i % 2 == 0 else c.lower() 
                for i, c in enumerate(keyword)
            )
        
        # Create text with keyword embedded
        test_text = f"{prefix} {transformed_keyword} {suffix}".strip()
        
        # Use either minimal or maximal scoring factors
        if max_scoring_factors:
            base_severity = 6
            weather_bonus = 2
            recurrence_count = 10  # Well above threshold
            near_sensitive_place = True
            vulnerable_group = True
        else:
            base_severity = 1
            weather_bonus = 0
            recurrence_count = 0
            near_sensitive_place = False
            vulnerable_group = False
        
        score, reasons = compute_urgency(
            base_severity=base_severity,
            weather_bonus=weather_bonus,
            recurrence_count=recurrence_count,
            near_sensitive_place=near_sensitive_place,
            vulnerable_group=vulnerable_group,
            text=test_text
        )
        
        # Emergency override should always trigger, regardless of other factors
        assert score == 10, \
            f"Emergency override failed for keyword '{keyword}' (transformed: '{transformed_keyword}') " \
            f"in text '{test_text}'. Score: {score}"
        
        assert reasons == ["Emergency override triggered"], \
            f"Emergency override should produce single reason for keyword '{keyword}' " \
            f"in text '{test_text}'. Got reasons: {reasons}"

    @given(
        non_emergency_text=st.text().filter(
            lambda x: not any(kw.lower() in x.lower() for kw in EMERGENCY_KEYWORDS) and len(x.strip()) > 0
        ),
        base_severity=st.integers(min_value=1, max_value=6),
        weather_bonus=st.integers(min_value=0, max_value=2),
        recurrence_count=st.integers(min_value=0, max_value=20),
        near_sensitive_place=st.booleans(),
        vulnerable_group=st.booleans()
    )
    def test_non_emergency_scoring_completeness(self, non_emergency_text, base_severity, weather_bonus,
                                              recurrence_count, near_sensitive_place, vulnerable_group):
        """Test that non-emergency text follows complete normal scoring rules
        
        This verifies that when no emergency keywords are present, the full scoring
        formula is applied correctly with all factors contributing appropriately.
        """
        score, reasons = compute_urgency(
            base_severity=base_severity,
            weather_bonus=weather_bonus,
            recurrence_count=recurrence_count,
            near_sensitive_place=near_sensitive_place,
            vulnerable_group=vulnerable_group,
            text=non_emergency_text
        )
        
        # Verify no emergency override
        assert "Emergency override triggered" not in reasons, \
            f"Emergency override triggered on non-emergency text '{non_emergency_text}'"
        
        # Compute expected score manually
        expected_score = base_severity
        expected_reasons = [f"Base severity: {base_severity}"]
        
        if weather_bonus > 0:
            expected_score += weather_bonus
            expected_reasons.append(f"Weather bonus: +{weather_bonus}")
        
        if recurrence_count >= ROOT_CAUSE_THRESHOLD:
            expected_score += 2
            expected_reasons.append("Recurrence bonus: +2")
        elif recurrence_count > 0:
            expected_score += 1
            expected_reasons.append("Recurrence bonus: +1")
            
        if near_sensitive_place:
            expected_score += 1
            expected_reasons.append("Near sensitive place: +1")
            
        if vulnerable_group:
            expected_score += 1
            expected_reasons.append("Vulnerable group flag: +1")
            
        expected_score = min(expected_score, 10)
        
        # Verify correct calculation
        assert score == expected_score, \
            f"Incorrect score calculation. Expected {expected_score}, got {score}. " \
            f"Factors: base={base_severity}, weather={weather_bonus}, " \
            f"recurrence={recurrence_count}, sensitive={near_sensitive_place}, " \
            f"vulnerable={vulnerable_group}"
        
        assert reasons == expected_reasons, \
            f"Incorrect reasons. Expected {expected_reasons}, got {reasons}"
        
        # Verify score bounds
        assert 1 <= score <= 10, f"Score {score} outside valid bounds [1, 10]"
        
        # Verify reasons completeness
        assert len(reasons) > 0, "Reasons list should not be empty"
        assert reasons[0].startswith("Base severity:"), "First reason should be base severity"

    @given(
        recurrence_count=st.integers(min_value=0, max_value=50),
        base_severity=st.integers(min_value=1, max_value=6),
        weather_bonus=st.integers(min_value=0, max_value=2),
        near_sensitive_place=st.booleans(),
        vulnerable_group=st.booleans(),
        text=st.text(min_size=0, max_size=200).filter(
            lambda x: not any(kw.lower() in x.lower() for kw in EMERGENCY_KEYWORDS)
        )
    )
    def test_recurrence_bonus_tiers_property(self, recurrence_count, base_severity, 
                                           weather_bonus, near_sensitive_place, 
                                           vulnerable_group, text):
        """**Property 8: Recurrence Bonus Tiers**
        
        For any recurrence_count in the range 0-50, the recurrence bonus should 
        follow tier rules exactly:
        
        1. For recurrence_count = 0: bonus = 0, no recurrence reason in list
        2. For 1 ≤ recurrence_count < ROOT_CAUSE_THRESHOLD: bonus = +1  
        3. For recurrence_count ≥ ROOT_CAUSE_THRESHOLD: bonus = +2
        4. The scoring logic correctly applies these tiers
        5. The reasons list accurately reflects the recurrence bonus
        
        This test uses comprehensive hypothesis strategies to test a wide range 
        of recurrence count values (0 to 50) combined with all other scoring 
        factors to ensure the recurrence bonus tier logic is robust.
        
        **Validates: Requirements 14.3, 14.4, 14.5**
        """
        score, reasons = compute_urgency(
            base_severity=base_severity,
            weather_bonus=weather_bonus,
            recurrence_count=recurrence_count,
            near_sensitive_place=near_sensitive_place,
            vulnerable_group=vulnerable_group,
            text=text
        )
        
        # Calculate expected recurrence bonus based on tier rules
        if recurrence_count == 0:
            expected_recurrence_bonus = 0
        elif 1 <= recurrence_count < ROOT_CAUSE_THRESHOLD:
            expected_recurrence_bonus = 1
        else:  # recurrence_count >= ROOT_CAUSE_THRESHOLD
            expected_recurrence_bonus = 2
        
        # 1. Verify recurrence bonus tier application
        if expected_recurrence_bonus == 0:
            # For recurrence_count = 0: bonus = 0, no recurrence reason in list
            assert not any("Recurrence bonus:" in reason for reason in reasons), \
                f"No recurrence bonus reason expected for recurrence_count=0, but found in reasons: {reasons}"
        elif expected_recurrence_bonus == 1:
            # For 1 ≤ recurrence_count < ROOT_CAUSE_THRESHOLD: bonus = +1
            assert f"Recurrence bonus: +{expected_recurrence_bonus}" in reasons, \
                f"Expected 'Recurrence bonus: +1' in reasons for recurrence_count={recurrence_count} " \
                f"(1 ≤ {recurrence_count} < {ROOT_CAUSE_THRESHOLD}), but got reasons: {reasons}"
        else:  # expected_recurrence_bonus == 2
            # For recurrence_count ≥ ROOT_CAUSE_THRESHOLD: bonus = +2
            assert f"Recurrence bonus: +{expected_recurrence_bonus}" in reasons, \
                f"Expected 'Recurrence bonus: +2' in reasons for recurrence_count={recurrence_count} " \
                f"({recurrence_count} ≥ {ROOT_CAUSE_THRESHOLD}), but got reasons: {reasons}"
        
        # 2. Verify exactly one recurrence bonus reason when applicable
        recurrence_reasons = [r for r in reasons if "Recurrence bonus:" in r]
        if expected_recurrence_bonus > 0:
            assert len(recurrence_reasons) == 1, \
                f"Expected exactly one recurrence bonus reason for recurrence_count={recurrence_count}, " \
                f"but found {len(recurrence_reasons)}: {recurrence_reasons}"
            assert recurrence_reasons[0] == f"Recurrence bonus: +{expected_recurrence_bonus}", \
                f"Expected exact recurrence reason 'Recurrence bonus: +{expected_recurrence_bonus}' " \
                f"for recurrence_count={recurrence_count}, but got '{recurrence_reasons[0]}'"
        else:
            assert len(recurrence_reasons) == 0, \
                f"Expected no recurrence bonus reasons for recurrence_count=0, " \
                f"but found {len(recurrence_reasons)}: {recurrence_reasons}"
        
        # 3. Verify the scoring logic correctly applies these tiers
        # Calculate expected total score manually
        expected_score = base_severity + weather_bonus + expected_recurrence_bonus
        if near_sensitive_place:
            expected_score += 1
        if vulnerable_group:
            expected_score += 1
        expected_score = min(expected_score, 10)  # Cap at 10
        
        assert score == expected_score, \
            f"Scoring logic incorrect for recurrence_count={recurrence_count}. " \
            f"Expected score={expected_score}, got score={score}. " \
            f"Components: base_severity={base_severity}, weather_bonus={weather_bonus}, " \
            f"recurrence_bonus={expected_recurrence_bonus}, sensitive_place={near_sensitive_place}, " \
            f"vulnerable_group={vulnerable_group}"
        
        # 4. Verify reasons list accuracy and completeness
        expected_reasons = [f"Base severity: {base_severity}"]
        
        if weather_bonus > 0:
            expected_reasons.append(f"Weather bonus: +{weather_bonus}")
        
        if expected_recurrence_bonus > 0:
            expected_reasons.append(f"Recurrence bonus: +{expected_recurrence_bonus}")
        
        if near_sensitive_place:
            expected_reasons.append("Near sensitive place: +1")
        
        if vulnerable_group:
            expected_reasons.append("Vulnerable group flag: +1")
        
        assert reasons == expected_reasons, \
            f"Reasons list doesn't match expected for recurrence_count={recurrence_count}. " \
            f"Expected: {expected_reasons}, Got: {reasons}"
        
        # 5. Additional tier boundary validation
        # Test specific tier boundaries to ensure correct implementation
        if recurrence_count == ROOT_CAUSE_THRESHOLD - 1:
            # Last count in tier 1 (should get +1 bonus)
            assert expected_recurrence_bonus == 1, \
                f"Boundary test failed: recurrence_count={recurrence_count} should be in tier 1 (+1 bonus), " \
                f"but got bonus={expected_recurrence_bonus}"
        
        if recurrence_count == ROOT_CAUSE_THRESHOLD:
            # First count in tier 2 (should get +2 bonus)
            assert expected_recurrence_bonus == 2, \
                f"Boundary test failed: recurrence_count={recurrence_count} should be in tier 2 (+2 bonus), " \
                f"but got bonus={expected_recurrence_bonus}"
        
        # 6. Verify score bounds are maintained even with high recurrence counts
        assert 1 <= score <= 10, \
            f"Score {score} out of bounds [1, 10] for recurrence_count={recurrence_count}"
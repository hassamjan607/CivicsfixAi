"""
Property-based tests for weather bonus scoring system.

This module contains property-based tests using Hypothesis to validate
the weather bonus scoring system according to the defined tiers and requirements.

**Validates: Requirements 7.2, 7.3, 7.4**
"""

import pytest
from hypothesis import given, strategies as st, assume, settings, HealthCheck
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

from app.context import get_weather_bonus, get_context_data
from app import config


class TestWeatherBonusTiersProperties:
    """Property-based tests for weather bonus tier system."""

    @given(precipitation=st.floats(min_value=0.0, max_value=100.0, allow_nan=False, allow_infinity=False))
    @pytest.mark.asyncio
    @pytest.mark.property
    async def test_weather_bonus_tier_correctness(self, precipitation):
        """
        Property: Weather bonus tiers are applied correctly for any precipitation value.
        
        **Validates: Requirements 7.2, 7.3, 7.4**
        
        Test that weather conditions correctly increase urgency scores according to tiers:
        - Tier 1: Light precipitation (0 < p <= 10mm/h) = 1 point
        - Tier 2: Heavy precipitation (p > 10mm/h) = 2 points  
        - Tier 3: No precipitation (p = 0) = 0 points
        """
        mock_response = {"current": {"precipitation": precipitation}}
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_response_obj = MagicMock()
            mock_response_obj.json.return_value = mock_response
            mock_response_obj.raise_for_status.return_value = None
            
            mock_client_instance = AsyncMock()
            mock_client_instance.get.return_value = mock_response_obj
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            bonus, reason = await get_weather_bonus(40.7128, -74.0060)
            
            # Verify tier assignment based on precipitation value
            if precipitation > config.WEATHER_BONUS_HIGH_MM:  # > 10 mm/h
                assert bonus == 2, f"Heavy precipitation {precipitation} mm/h should give +2 bonus"
                assert "Heavy precipitation" in reason
            elif precipitation > config.WEATHER_BONUS_LOW_MM:  # > 0 mm/h  
                assert bonus == 1, f"Light precipitation {precipitation} mm/h should give +1 bonus"
                assert "Light precipitation" in reason
            else:  # = 0 mm/h
                assert bonus == 0, f"No precipitation {precipitation} mm/h should give +0 bonus"
                assert reason == ""

    @given(
        precipitation1=st.floats(min_value=0.0, max_value=100.0, allow_nan=False, allow_infinity=False),
        precipitation2=st.floats(min_value=0.0, max_value=100.0, allow_nan=False, allow_infinity=False)
    )
    @pytest.mark.asyncio
    @pytest.mark.property
    async def test_weather_bonus_consistency(self, precipitation1, precipitation2):
        """
        Property: Weather bonus is consistent for same precipitation values.
        
        **Validates: Requirements 7.2, 7.3, 7.4**
        
        Test that the same precipitation value always produces the same bonus,
        regardless of when it's called.
        """
        mock_response1 = {"current": {"precipitation": precipitation1}}
        mock_response2 = {"current": {"precipitation": precipitation2}}
        
        with patch("httpx.AsyncClient") as mock_client:
            # First call
            mock_response_obj1 = MagicMock()
            mock_response_obj1.json.return_value = mock_response1
            mock_response_obj1.raise_for_status.return_value = None
            
            mock_client_instance1 = AsyncMock()
            mock_client_instance1.get.return_value = mock_response_obj1
            mock_client.return_value.__aenter__.return_value = mock_client_instance1
            
            bonus1, reason1 = await get_weather_bonus(40.7128, -74.0060)
            
            # Second call  
            mock_response_obj2 = MagicMock()
            mock_response_obj2.json.return_value = mock_response2
            mock_response_obj2.raise_for_status.return_value = None
            
            mock_client_instance2 = AsyncMock()
            mock_client_instance2.get.return_value = mock_response_obj2
            mock_client.return_value.__aenter__.return_value = mock_client_instance2
            
            bonus2, reason2 = await get_weather_bonus(40.7128, -74.0060)
            
            # If precipitation values are equal, bonuses must be equal
            if precipitation1 == precipitation2:
                assert bonus1 == bonus2, f"Same precipitation {precipitation1} should yield same bonus"
                assert (reason1 == "" and reason2 == "") or (reason1 != "" and reason2 != "")

    @given(
        lat=st.floats(min_value=-90.0, max_value=90.0, allow_nan=False, allow_infinity=False),
        lng=st.floats(min_value=-180.0, max_value=180.0, allow_nan=False, allow_infinity=False)
    )
    @pytest.mark.asyncio
    @pytest.mark.property
    async def test_weather_bonus_location_invariant(self, lat, lng):
        """
        Property: Weather bonus calculation works for any valid GPS coordinates.
        
        **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
        
        Test that weather bonus can be calculated for any valid latitude/longitude
        and returns a value in the expected range [0, 2].
        """
        mock_response = {"current": {"precipitation": 5.0}}  # Light rain
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_response_obj = MagicMock()
            mock_response_obj.json.return_value = mock_response
            mock_response_obj.raise_for_status.return_value = None
            
            mock_client_instance = AsyncMock()
            mock_client_instance.get.return_value = mock_response_obj
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            bonus, reason = await get_weather_bonus(lat, lng)
            
            # Bonus must be in valid range
            assert bonus in [0, 1, 2], f"Weather bonus {bonus} not in valid range [0, 1, 2]"
            
            # For light rain (5.0 mm/h), should always be +1
            assert bonus == 1
            assert "Light precipitation: 5.0 mm/h" in reason

    @given(
        api_error=st.sampled_from([
            httpx.TimeoutException("Timeout"),
            httpx.HTTPStatusError("HTTP error", request=MagicMock(), response=MagicMock()),
            httpx.RequestError("Request error"),
            Exception("General error")
        ])
    )
    @pytest.mark.asyncio
    @pytest.mark.property
    async def test_weather_bonus_graceful_degradation(self, api_error):
        """
        Property: Weather bonus gracefully handles all API failure scenarios.
        
        **Validates: Requirements 7.5**
        
        Test that any API error results in 0 bonus and empty reason string,
        ensuring the system continues to function with graceful degradation.
        """
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get.side_effect = api_error
            
            bonus, reason = await get_weather_bonus(40.7128, -74.0060)
            
            # All failures should result in safe defaults
            assert bonus == 0, f"API failure should result in 0 bonus, got {bonus}"
            assert reason == "", f"API failure should result in empty reason, got '{reason}'"

    @given(
        malformed_response=st.one_of(
            st.just({}),  # Empty response
            st.just({"current": {}}),  # Missing precipitation
            st.just({"current": {"precipitation": None}}),  # Null precipitation
            st.just({"invalid": "structure"}),  # Invalid structure
            st.just({"current": {"precipitation": "not_a_number"}}),  # Invalid type
        )
    )
    @pytest.mark.asyncio
    @pytest.mark.property
    async def test_weather_bonus_malformed_response_handling(self, malformed_response):
        """
        Property: Weather bonus handles malformed API responses gracefully.
        
        **Validates: Requirements 7.5**
        
        Test that malformed or unexpected API responses don't crash the system
        and fall back to safe defaults.
        """
        with patch("httpx.AsyncClient") as mock_client:
            mock_response_obj = MagicMock()
            mock_response_obj.json.return_value = malformed_response
            mock_response_obj.raise_for_status.return_value = None
            
            mock_client_instance = AsyncMock()
            mock_client_instance.get.return_value = mock_response_obj
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            bonus, reason = await get_weather_bonus(40.7128, -74.0060)
            
            # Malformed responses should result in safe defaults
            assert bonus == 0, f"Malformed response should result in 0 bonus, got {bonus}"
            assert reason == "", f"Malformed response should result in empty reason, got '{reason}'"


class TestWeatherBonusBoundaryConditions:
    """Property-based tests for boundary conditions in weather bonus calculation."""

    @given(
        precipitation=st.one_of(
            st.just(0.0),  # Exact boundary
            st.just(10.0),  # Exact threshold
            st.floats(min_value=9.99999, max_value=10.00001),  # Near threshold
            st.floats(min_value=-0.00001, max_value=0.00001),  # Near zero
        )
    )
    @pytest.mark.asyncio
    @pytest.mark.property
    async def test_weather_bonus_boundary_values(self, precipitation):
        """
        Property: Weather bonus handles boundary values correctly.
        
        **Validates: Requirements 7.2, 7.3, 7.4**
        
        Test that boundary values (0, 10) are handled correctly according to the tier rules.
        """
        # Handle negative values from the near-zero range
        precipitation = max(0.0, precipitation)
        
        mock_response = {"current": {"precipitation": precipitation}}
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_response_obj = MagicMock()
            mock_response_obj.json.return_value = mock_response
            mock_response_obj.raise_for_status.return_value = None
            
            mock_client_instance = AsyncMock()
            mock_client_instance.get.return_value = mock_response_obj
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            bonus, reason = await get_weather_bonus(40.7128, -74.0060)
            
            # Verify correct tier assignment for boundary values
            if precipitation > config.WEATHER_BONUS_HIGH_MM:  # > 10
                assert bonus == 2, f"Precipitation {precipitation} > 10 should give +2 bonus"
            elif precipitation > config.WEATHER_BONUS_LOW_MM:  # > 0
                assert bonus == 1, f"Precipitation {precipitation} > 0 should give +1 bonus"
            else:  # = 0
                assert bonus == 0, f"Precipitation {precipitation} = 0 should give +0 bonus"


class TestWeatherBonusIntegration:
    """Property-based tests for weather bonus integration with context service."""

    @given(
        lat=st.floats(min_value=-90.0, max_value=90.0, allow_nan=False, allow_infinity=False),
        lng=st.floats(min_value=-180.0, max_value=180.0, allow_nan=False, allow_infinity=False),
        precipitation=st.floats(min_value=0.0, max_value=50.0, allow_nan=False, allow_infinity=False)
    )
    @pytest.mark.asyncio
    @pytest.mark.property
    async def test_context_data_weather_integration(self, lat, lng, precipitation):
        """
        Property: Weather data integration works correctly in context service.
        
        **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
        
        Test that weather bonus is correctly integrated into the broader context service
        and maintains consistency with direct weather bonus calls.
        """
        mock_weather_response = {"current": {"precipitation": precipitation}}
        mock_places_response = {"elements": []}
        
        with patch("httpx.AsyncClient") as mock_client:
            # Mock weather API call
            mock_weather_obj = MagicMock()
            mock_weather_obj.json.return_value = mock_weather_response
            mock_weather_obj.raise_for_status.return_value = None
            
            # Mock places API call
            mock_places_obj = MagicMock()
            mock_places_obj.json.return_value = mock_places_response
            mock_places_obj.raise_for_status.return_value = None
            
            mock_client_instance = AsyncMock()
            mock_client_instance.get.return_value = mock_weather_obj
            mock_client_instance.post.return_value = mock_places_obj
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            weather_bonus, weather_reason, has_places = await get_context_data(lat, lng)
            
            # Verify weather bonus matches expected tier
            if precipitation > config.WEATHER_BONUS_HIGH_MM:
                assert weather_bonus == 2, f"Integration: Heavy rain {precipitation} should give +2"
                assert "Heavy precipitation" in weather_reason
            elif precipitation > config.WEATHER_BONUS_LOW_MM:
                assert weather_bonus == 1, f"Integration: Light rain {precipitation} should give +1"  
                assert "Light precipitation" in weather_reason
            else:
                assert weather_bonus == 0, f"Integration: No rain {precipitation} should give +0"
                assert weather_reason == ""
            
            # Places should be False (empty elements)
            assert has_places is False

    @given(
        weather_fails=st.booleans(),
        places_fails=st.booleans()
    )
    @pytest.mark.asyncio 
    @pytest.mark.property
    async def test_context_data_partial_failure_handling(self, weather_fails, places_fails):
        """
        Property: Context data handles partial API failures gracefully.
        
        **Validates: Requirements 7.5**
        
        Test that the context service continues to work when individual APIs fail,
        ensuring system resilience and graceful degradation.
        """
        assume(weather_fails or places_fails)  # At least one must fail
        
        with patch("app.context.get_weather_bonus") as mock_weather, \
             patch("app.context.get_nearby_sensitive_places") as mock_places:
            
            if weather_fails:
                mock_weather.side_effect = Exception("Weather API failed")
            else:
                mock_weather.return_value = (1, "Light precipitation: 5.0 mm/h")
                
            if places_fails:
                mock_places.side_effect = Exception("Places API failed")
            else:
                mock_places.return_value = True
            
            weather_bonus, weather_reason, has_places = await get_context_data(40.7128, -74.0060)
            
            # Verify safe fallbacks for failed services
            if weather_fails:
                assert weather_bonus == 0
                assert weather_reason == ""
            else:
                assert weather_bonus == 1
                assert "Light precipitation" in weather_reason
                
            if places_fails:
                assert has_places is False
            else:
                assert has_places is True


class TestExtendedWeatherConditions:
    """Property-based tests for extended weather condition scenarios."""

    @given(
        weather_scenario=st.one_of(
            # Tier 1: Light conditions (1 point)
            st.just({"precipitation": 2.5, "expected_tier": 1, "description": "light rain"}),
            st.just({"precipitation": 0.1, "expected_tier": 1, "description": "drizzle"}),
            st.just({"precipitation": 10.0, "expected_tier": 1, "description": "moderate rain"}),
            
            # Tier 2: Heavy conditions (2 points)  
            st.just({"precipitation": 15.0, "expected_tier": 2, "description": "heavy rain"}),
            st.just({"precipitation": 25.0, "expected_tier": 2, "description": "intense rain"}),
            st.just({"precipitation": 50.0, "expected_tier": 2, "description": "extreme rain"}),
            
            # Tier 3: No conditions (0 points)
            st.just({"precipitation": 0.0, "expected_tier": 0, "description": "clear weather"}),
        )
    )
    @pytest.mark.asyncio
    @pytest.mark.property
    async def test_weather_scenario_classification(self, weather_scenario):
        """
        Property: Weather scenarios are classified into correct tiers.
        
        **Validates: Requirements 7.2, 7.3, 7.4**
        
        Test realistic weather scenarios to ensure they map to the correct
        bonus tiers as specified in the requirements.
        """
        precipitation = weather_scenario["precipitation"]
        expected_tier = weather_scenario["expected_tier"]
        description = weather_scenario["description"]
        
        mock_response = {"current": {"precipitation": precipitation}}
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_response_obj = MagicMock()
            mock_response_obj.json.return_value = mock_response
            mock_response_obj.raise_for_status.return_value = None
            
            mock_client_instance = AsyncMock()
            mock_client_instance.get.return_value = mock_response_obj
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            bonus, reason = await get_weather_bonus(40.7128, -74.0060)
            
            assert bonus == expected_tier, (
                f"Weather scenario '{description}' with {precipitation} mm/h "
                f"should give tier {expected_tier} bonus, got {bonus}"
            )

    @given(
        multiple_calls=st.integers(min_value=1, max_value=5)
    )
    @pytest.mark.asyncio
    @pytest.mark.property  
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    async def test_weather_bonus_no_side_effects(self, multiple_calls):
        """
        Property: Multiple weather bonus calls don't accumulate or interfere.
        
        **Validates: Requirements 7.2, 7.3, 7.4**
        
        Test that calling the weather bonus function multiple times doesn't
        cause side effects or bonus accumulation.
        """
        precipitation = 5.0  # Fixed light rain
        mock_response = {"current": {"precipitation": precipitation}}
        
        bonuses = []
        reasons = []
        
        for _ in range(multiple_calls):
            with patch("httpx.AsyncClient") as mock_client:
                mock_response_obj = MagicMock()
                mock_response_obj.json.return_value = mock_response
                mock_response_obj.raise_for_status.return_value = None
                
                mock_client_instance = AsyncMock()
                mock_client_instance.get.return_value = mock_response_obj
                mock_client.return_value.__aenter__.return_value = mock_client_instance
                
                bonus, reason = await get_weather_bonus(40.7128, -74.0060)
                bonuses.append(bonus)
                reasons.append(reason)
        
        # All calls should return the same result
        assert len(set(bonuses)) == 1, f"Multiple calls returned different bonuses: {bonuses}"
        assert len(set(reasons)) == 1, f"Multiple calls returned different reasons: {reasons}"
        assert bonuses[0] == 1, f"Light rain should give +1 bonus, got {bonuses[0]}"
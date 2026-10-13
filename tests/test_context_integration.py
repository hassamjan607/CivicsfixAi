"""
Integration tests for context services with rules engine.

Tests the end-to-end flow of context data feeding into urgency scoring.
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from app.context import get_context_data
from app.rules import compute_urgency


class TestContextRulesIntegration:
    """Test integration between context services and rules engine."""

    @pytest.mark.asyncio
    async def test_weather_bonus_integration_with_rules(self):
        """Test that weather bonus from context feeds correctly into rules engine."""
        # Mock weather API to return heavy precipitation
        with patch("httpx.AsyncClient") as mock_client:
            mock_response_obj = MagicMock()
            mock_response_obj.json.return_value = {
                "current": {"precipitation": 15.0}
            }
            mock_response_obj.raise_for_status.return_value = None
            
            mock_client_instance = AsyncMock()
            mock_client_instance.get.return_value = mock_response_obj
            mock_client_instance.post.return_value = MagicMock()
            mock_client_instance.post.return_value.json.return_value = {"elements": []}
            mock_client_instance.post.return_value.raise_for_status.return_value = None
            
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            # Get context data
            weather_bonus, weather_reason, has_sensitive_places = await get_context_data(
                40.7128, -74.0060
            )
            
            # Verify weather bonus is correct
            assert weather_bonus == 2
            assert "Heavy precipitation: 15.0 mm/h" in weather_reason
            
            # Use the context data in urgency scoring
            urgency_score, reasons = compute_urgency(
                base_severity=3,
                weather_bonus=weather_bonus,
                recurrence_count=0,
                near_sensitive_place=has_sensitive_places,
                vulnerable_group=False,
                text="Water leak on main street"
            )
            
            # Verify the weather bonus was applied correctly
            assert urgency_score == 5  # 3 base + 2 weather
            assert "Base severity: 3" in reasons
            assert "Weather bonus: +2" in reasons

    @pytest.mark.asyncio
    async def test_sensitive_places_bonus_integration(self):
        """Test that sensitive places bonus feeds correctly into rules engine."""
        # Mock APIs - no precipitation but sensitive place nearby
        with patch("httpx.AsyncClient") as mock_client:
            mock_response_weather = MagicMock()
            mock_response_weather.json.return_value = {
                "current": {"precipitation": 0.0}
            }
            mock_response_weather.raise_for_status.return_value = None
            
            mock_response_places = MagicMock()
            mock_response_places.json.return_value = {
                "elements": [
                    {"type": "node", "id": 123, "tags": {"amenity": "hospital"}}
                ]
            }
            mock_response_places.raise_for_status.return_value = None
            
            mock_client_instance = AsyncMock()
            mock_client_instance.get.return_value = mock_response_weather
            mock_client_instance.post.return_value = mock_response_places
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            # Get context data
            weather_bonus, weather_reason, has_sensitive_places = await get_context_data(
                40.7128, -74.0060
            )
            
            # Verify context data
            assert weather_bonus == 0
            assert weather_reason == ""
            assert has_sensitive_places is True
            
            # Use context data in urgency scoring
            urgency_score, reasons = compute_urgency(
                base_severity=3,
                weather_bonus=weather_bonus,
                recurrence_count=0,
                near_sensitive_place=has_sensitive_places,
                vulnerable_group=False,
                text="Streetlight not working"
            )
            
            # Verify the sensitive place bonus was applied
            assert urgency_score == 4  # 3 base + 1 sensitive place
            assert "Base severity: 3" in reasons
            assert "Near sensitive place: +1" in reasons

    @pytest.mark.asyncio
    async def test_combined_context_bonuses(self):
        """Test multiple context bonuses working together."""
        # Mock APIs - light precipitation + sensitive place + vulnerable group
        with patch("httpx.AsyncClient") as mock_client:
            mock_response_weather = MagicMock()
            mock_response_weather.json.return_value = {
                "current": {"precipitation": 5.0}
            }
            mock_response_weather.raise_for_status.return_value = None
            
            mock_response_places = MagicMock()
            mock_response_places.json.return_value = {
                "elements": [
                    {"type": "node", "id": 123, "tags": {"amenity": "school"}},
                    {"type": "way", "id": 456, "tags": {"highway": "primary"}}
                ]
            }
            mock_response_places.raise_for_status.return_value = None
            
            mock_client_instance = AsyncMock()
            mock_client_instance.get.return_value = mock_response_weather
            mock_client_instance.post.return_value = mock_response_places
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            # Get context data
            weather_bonus, weather_reason, has_sensitive_places = await get_context_data(
                40.7128, -74.0060
            )
            
            # Verify context data
            assert weather_bonus == 1
            assert "Light precipitation: 5.0 mm/h" in weather_reason
            assert has_sensitive_places is True
            
            # Use context data with other factors
            urgency_score, reasons = compute_urgency(
                base_severity=4,
                weather_bonus=weather_bonus,
                recurrence_count=2,  # Below ROOT_CAUSE_THRESHOLD (3), so +1
                near_sensitive_place=has_sensitive_places,
                vulnerable_group=True,
                text="Dangerous pothole blocking wheelchair access"
            )
            
            # Verify all bonuses applied: 4 base + 1 weather + 1 recurrence + 1 sensitive + 1 vulnerable = 8
            assert urgency_score == 8
            expected_reasons = [
                "Base severity: 4",
                "Weather bonus: +1", 
                "Recurrence bonus: +1",
                "Near sensitive place: +1",
                "Vulnerable group flag: +1"
            ]
            for reason in expected_reasons:
                assert reason in reasons

    @pytest.mark.asyncio
    async def test_context_failure_graceful_degradation_in_rules(self):
        """Test that rules engine works normally when context services fail."""
        # Mock complete API failures
        with patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.get.side_effect = Exception("Weather API down")
            mock_client_instance.post.side_effect = Exception("Places API down")
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            # Get context data (should return safe defaults)
            weather_bonus, weather_reason, has_sensitive_places = await get_context_data(
                40.7128, -74.0060
            )
            
            # Verify safe defaults
            assert weather_bonus == 0
            assert weather_reason == ""
            assert has_sensitive_places is False
            
            # Rules engine should still work normally
            urgency_score, reasons = compute_urgency(
                base_severity=5,
                weather_bonus=weather_bonus,
                recurrence_count=0,
                near_sensitive_place=has_sensitive_places,
                vulnerable_group=False,
                text="Normal complaint with API failures"
            )
            
            # Should only have base severity
            assert urgency_score == 5
            assert reasons == ["Base severity: 5"]

    @pytest.mark.asyncio
    async def test_emergency_override_ignores_context(self):
        """Test that emergency override works regardless of context bonuses."""
        # Mock APIs with high bonuses
        with patch("httpx.AsyncClient") as mock_client:
            mock_response_weather = MagicMock()
            mock_response_weather.json.return_value = {
                "current": {"precipitation": 20.0}
            }
            mock_response_weather.raise_for_status.return_value = None
            
            mock_response_places = MagicMock()
            mock_response_places.json.return_value = {
                "elements": [{"type": "node", "id": 123, "tags": {"amenity": "hospital"}}]
            }
            mock_response_places.raise_for_status.return_value = None
            
            mock_client_instance = AsyncMock()
            mock_client_instance.get.return_value = mock_response_weather
            mock_client_instance.post.return_value = mock_response_places
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            # Get context data
            weather_bonus, _, has_sensitive_places = await get_context_data(40.7128, -74.0060)
            
            # Use emergency keyword in text
            urgency_score, reasons = compute_urgency(
                base_severity=2,
                weather_bonus=weather_bonus,
                recurrence_count=5,
                near_sensitive_place=has_sensitive_places,
                vulnerable_group=True,
                text="There is a live wire hanging dangerously"
            )
            
            # Should be 10 with emergency override only
            assert urgency_score == 10
            assert reasons == ["Emergency override triggered"]
"""
Unit tests for context services (weather and nearby places).

Tests both individual functions and graceful degradation scenarios.
"""

import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock

from app.context import get_weather_bonus, get_nearby_sensitive_places, get_context_data


class TestWeatherBonus:
    """Test weather bonus calculation from Open-Meteo API."""

    @pytest.mark.asyncio
    async def test_heavy_precipitation_bonus(self):
        """Test +2 bonus for precipitation > 10 mm/h."""
        mock_response = {
            "current": {"precipitation": 15.5}
        }
        
        with patch("httpx.AsyncClient") as mock_client:
            # Create a proper mock for the async context manager and response
            mock_response_obj = MagicMock()
            mock_response_obj.json.return_value = mock_response
            mock_response_obj.raise_for_status.return_value = None
            
            mock_client_instance = AsyncMock()
            mock_client_instance.get.return_value = mock_response_obj
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            bonus, reason = await get_weather_bonus(40.7128, -74.0060)
            
            assert bonus == 2
            assert "Heavy precipitation: 15.5 mm/h" in reason

    @pytest.mark.asyncio
    async def test_light_precipitation_bonus(self):
        """Test +1 bonus for precipitation > 0 and <= 10 mm/h."""
        mock_response = {
            "current": {"precipitation": 5.2}
        }
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_response_obj = MagicMock()
            mock_response_obj.json.return_value = mock_response
            mock_response_obj.raise_for_status.return_value = None
            
            mock_client_instance = AsyncMock()
            mock_client_instance.get.return_value = mock_response_obj
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            bonus, reason = await get_weather_bonus(40.7128, -74.0060)
            
            assert bonus == 1
            assert "Light precipitation: 5.2 mm/h" in reason

    @pytest.mark.asyncio
    async def test_no_precipitation_bonus(self):
        """Test +0 bonus for no precipitation."""
        mock_response = {
            "current": {"precipitation": 0.0}
        }
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_response_obj = MagicMock()
            mock_response_obj.json.return_value = mock_response
            mock_response_obj.raise_for_status.return_value = None
            
            mock_client_instance = AsyncMock()
            mock_client_instance.get.return_value = mock_response_obj
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            bonus, reason = await get_weather_bonus(40.7128, -74.0060)
            
            assert bonus == 0
            assert reason == ""

    @pytest.mark.asyncio
    async def test_api_timeout_graceful_degradation(self):
        """Test graceful handling of API timeout."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get.side_effect = httpx.TimeoutException("Timeout")
            
            bonus, reason = await get_weather_bonus(40.7128, -74.0060)
            
            assert bonus == 0
            assert reason == ""

    @pytest.mark.asyncio
    async def test_api_http_error_graceful_degradation(self):
        """Test graceful handling of HTTP errors."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get.side_effect = httpx.HTTPStatusError(
                "HTTP error", request=MagicMock(), response=MagicMock()
            )
            
            bonus, reason = await get_weather_bonus(40.7128, -74.0060)
            
            assert bonus == 0
            assert reason == ""

    @pytest.mark.asyncio
    async def test_malformed_response_handling(self):
        """Test handling of malformed API responses."""
        mock_response = {"invalid": "structure"}
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_response_obj = MagicMock()
            mock_response_obj.json.return_value = mock_response
            mock_response_obj.raise_for_status.return_value = None
            
            mock_client_instance = AsyncMock()
            mock_client_instance.get.return_value = mock_response_obj
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            bonus, reason = await get_weather_bonus(40.7128, -74.0060)
            
            assert bonus == 0
            assert reason == ""


class TestNearbySensitivePlaces:
    """Test nearby sensitive places detection via OSM Overpass API."""

    @pytest.mark.asyncio
    async def test_sensitive_places_found(self):
        """Test detection of nearby sensitive places."""
        mock_response = {
            "elements": [
                {"type": "node", "id": 123, "tags": {"amenity": "hospital"}},
                {"type": "way", "id": 456, "tags": {"amenity": "school"}}
            ]
        }
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_response_obj = MagicMock()
            mock_response_obj.json.return_value = mock_response
            mock_response_obj.raise_for_status.return_value = None
            
            mock_client_instance = AsyncMock()
            mock_client_instance.post.return_value = mock_response_obj
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            has_places = await get_nearby_sensitive_places(40.7128, -74.0060)
            
            assert has_places is True

    @pytest.mark.asyncio
    async def test_no_sensitive_places_found(self):
        """Test when no sensitive places are found."""
        mock_response = {"elements": []}
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_response_obj = MagicMock()
            mock_response_obj.json.return_value = mock_response
            mock_response_obj.raise_for_status.return_value = None
            
            mock_client_instance = AsyncMock()
            mock_client_instance.post.return_value = mock_response_obj
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            has_places = await get_nearby_sensitive_places(40.7128, -74.0060)
            
            assert has_places is False

    @pytest.mark.asyncio
    async def test_overpass_api_timeout_graceful_degradation(self):
        """Test graceful handling of Overpass API timeout."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post.side_effect = httpx.TimeoutException("Timeout")
            
            has_places = await get_nearby_sensitive_places(40.7128, -74.0060)
            
            assert has_places is False

    @pytest.mark.asyncio
    async def test_overpass_api_http_error_graceful_degradation(self):
        """Test graceful handling of Overpass API HTTP errors."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post.side_effect = httpx.HTTPStatusError(
                "HTTP error", request=MagicMock(), response=MagicMock()
            )
            
            has_places = await get_nearby_sensitive_places(40.7128, -74.0060)
            
            assert has_places is False

    @pytest.mark.asyncio
    async def test_overpass_query_format(self):
        """Test that the Overpass query includes expected amenity types and radius."""
        mock_response = {"elements": []}
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_response_obj = MagicMock()
            mock_response_obj.json.return_value = mock_response
            mock_response_obj.raise_for_status.return_value = None
            
            mock_client_instance = AsyncMock()
            mock_client_instance.post.return_value = mock_response_obj
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            await get_nearby_sensitive_places(40.7128, -74.0060)
            
            # Verify the query was called with proper parameters
            mock_client_instance.post.assert_called_once()
            call_args = mock_client_instance.post.call_args
            query_data = call_args[1]["data"]
            
            assert "around:100,40.7128,-74.006" in query_data
            assert "hospital|school|clinic|pharmacy|kindergarten" in query_data
            assert "primary|secondary|trunk|motorway" in query_data


class TestContextDataIntegration:
    """Test the combined context data fetcher."""

    @pytest.mark.asyncio
    async def test_successful_parallel_fetch(self):
        """Test successful parallel fetching of weather and places data."""
        with patch("app.context.get_weather_bonus") as mock_weather, \
             patch("app.context.get_nearby_sensitive_places") as mock_places:
            
            mock_weather.return_value = (2, "Heavy precipitation: 15.0 mm/h")
            mock_places.return_value = True
            
            weather_bonus, weather_reason, has_places = await get_context_data(40.7128, -74.0060)
            
            assert weather_bonus == 2
            assert "Heavy precipitation: 15.0 mm/h" in weather_reason
            assert has_places is True

    @pytest.mark.asyncio
    async def test_partial_failure_handling(self):
        """Test handling when one API fails but the other succeeds."""
        with patch("app.context.get_weather_bonus") as mock_weather, \
             patch("app.context.get_nearby_sensitive_places") as mock_places:
            
            mock_weather.side_effect = Exception("Weather API failed")
            mock_places.return_value = True
            
            weather_bonus, weather_reason, has_places = await get_context_data(40.7128, -74.0060)
            
            assert weather_bonus == 0
            assert weather_reason == ""
            assert has_places is True

    @pytest.mark.asyncio
    async def test_complete_failure_handling(self):
        """Test handling when both APIs fail."""
        with patch("app.context.get_weather_bonus") as mock_weather, \
             patch("app.context.get_nearby_sensitive_places") as mock_places:
            
            mock_weather.side_effect = Exception("Weather API failed")
            mock_places.side_effect = Exception("Places API failed")
            
            weather_bonus, weather_reason, has_places = await get_context_data(40.7128, -74.0060)
            
            assert weather_bonus == 0
            assert weather_reason == ""
            assert has_places is False


class TestWeatherBonusEdgeCases:
    """Test edge cases for weather bonus calculation."""

    @pytest.mark.asyncio
    async def test_exact_boundary_values(self):
        """Test exact boundary values for weather bonus thresholds."""
        test_cases = [
            (10.1, 2),  # Just above high threshold 
            (10.0, 1),  # At high threshold boundary
            (0.1, 1),   # Just above low threshold
            (0.0, 0),   # At low threshold boundary
        ]
        
        for precipitation, expected_bonus in test_cases:
            mock_response = {"current": {"precipitation": precipitation}}
            
            with patch("httpx.AsyncClient") as mock_client:
                mock_response_obj = MagicMock()
                mock_response_obj.json.return_value = mock_response
                mock_response_obj.raise_for_status.return_value = None
                
                mock_client_instance = AsyncMock()
                mock_client_instance.get.return_value = mock_response_obj
                mock_client.return_value.__aenter__.return_value = mock_client_instance
                
                bonus, _ = await get_weather_bonus(40.7128, -74.0060)
                
                assert bonus == expected_bonus, f"Failed for precipitation {precipitation}"

    @pytest.mark.asyncio
    async def test_negative_precipitation_handling(self):
        """Test handling of negative precipitation values."""
        mock_response = {"current": {"precipitation": -1.0}}
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_response_obj = MagicMock()
            mock_response_obj.json.return_value = mock_response
            mock_response_obj.raise_for_status.return_value = None
            
            mock_client_instance = AsyncMock()
            mock_client_instance.get.return_value = mock_response_obj
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            bonus, reason = await get_weather_bonus(40.7128, -74.0060)
            
            # Should treat negative as no precipitation (0 bonus)
            assert bonus == 0
            assert reason == ""
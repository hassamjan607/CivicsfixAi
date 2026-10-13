"""
CivicFix AI Context Services

Async services for fetching weather data and nearby sensitive places
to provide context for urgency scoring calculations.

Requirements validated:
- 7.1, 7.2, 7.3, 7.4, 7.5: Weather-aware priority scoring with Open-Meteo API
- 5.2, 5.3: GPS auto-location with OSM Overpass integration
"""

import asyncio
import logging
from typing import Tuple

import httpx

from . import config

logger = logging.getLogger(__name__)

# API timeouts in seconds
REQUEST_TIMEOUT = 5.0
SENSITIVE_PLACES_RADIUS = 100  # meters


async def get_weather_bonus(lat: float, lng: float) -> Tuple[int, str]:
    """
    Fetch precipitation data from Open-Meteo API and return weather bonus.
    
    Implements Requirements 7.1-7.5 for weather-aware priority scoring:
    - >10 mm/h precipitation: +2 bonus
    - >0 and ≤10 mm/h precipitation: +1 bonus  
    - 0 mm/h precipitation: +0 bonus
    - API failure: +0 bonus (graceful degradation)
    
    Args:
        lat: Latitude coordinate
        lng: Longitude coordinate
        
    Returns:
        Tuple of (bonus_points, reason_string)
    """
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            # Open-Meteo current weather API
            url = "https://api.open-meteo.com/v1/forecast"
            params = {
                "latitude": lat,
                "longitude": lng,
                "current": "precipitation",
                "forecast_days": 1,
                "timezone": "auto"
            }
            
            response = await client.get(url, params=params)
            response.raise_for_status()
            
            data = response.json()
            current_precipitation = data.get("current", {}).get("precipitation", 0.0)
            
            # Apply weather bonus according to requirements 7.2, 7.3, 7.4
            if current_precipitation > config.WEATHER_BONUS_HIGH_MM:
                return 2, f"Heavy precipitation: {current_precipitation} mm/h"
            elif current_precipitation > config.WEATHER_BONUS_LOW_MM:
                return 1, f"Light precipitation: {current_precipitation} mm/h"
            else:
                return 0, ""
                
    except (httpx.TimeoutException, httpx.HTTPStatusError, httpx.RequestError) as e:
        logger.warning(f"Open-Meteo API failed for coordinates ({lat}, {lng}): {e}")
        # Requirement 7.5: Graceful degradation on API failure
        return 0, ""
    except Exception as e:
        logger.error(f"Unexpected error fetching weather data: {e}")
        return 0, ""


async def get_nearby_sensitive_places(lat: float, lng: float) -> bool:
    """
    Query OSM Overpass API for hospitals, schools within 100m.
    
    Implements Requirements 5.2, 5.3 for location-based context scoring.
    Returns True if sensitive places (hospitals, schools, major roads) are nearby.
    
    Args:
        lat: Latitude coordinate
        lng: Longitude coordinate
        
    Returns:
        Boolean indicating if sensitive places are nearby
    """
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            # OSM Overpass API query for sensitive places within 100m
            overpass_query = f"""
            [out:json][timeout:5];
            (
              node["amenity"~"^(hospital|school|clinic|pharmacy|kindergarten)$"](around:{SENSITIVE_PLACES_RADIUS},{lat},{lng});
              way["amenity"~"^(hospital|school|clinic|pharmacy|kindergarten)$"](around:{SENSITIVE_PLACES_RADIUS},{lat},{lng});
              way["highway"~"^(primary|secondary|trunk|motorway)$"](around:{SENSITIVE_PLACES_RADIUS},{lat},{lng});
              node["railway"~"^(station|halt|tram_stop)$"](around:{SENSITIVE_PLACES_RADIUS},{lat},{lng});
            );
            out geom;
            """
            
            response = await client.post(
                "https://overpass-api.de/api/interpreter",
                data=overpass_query,
                headers={"User-Agent": "CivicFix/1.0"}
            )
            response.raise_for_status()
            
            data = response.json()
            elements = data.get("elements", [])
            
            # Return True if any sensitive places found
            has_sensitive_places = len(elements) > 0
            
            if has_sensitive_places:
                logger.info(f"Found {len(elements)} sensitive places near ({lat}, {lng})")
                
            return has_sensitive_places
            
    except (httpx.TimeoutException, httpx.HTTPStatusError, httpx.RequestError) as e:
        logger.warning(f"OSM Overpass API failed for coordinates ({lat}, {lng}): {e}")
        # Requirement 5.3: Graceful degradation on API failure
        return False
    except Exception as e:
        logger.error(f"Unexpected error fetching nearby places: {e}")
        return False


async def get_context_data(lat: float, lng: float) -> Tuple[int, str, bool]:
    """
    Fetch both weather bonus and sensitive places data in parallel.
    
    This is a convenience function that combines both context fetchers
    using asyncio.gather for optimal performance.
    
    Args:
        lat: Latitude coordinate
        lng: Longitude coordinate
        
    Returns:
        Tuple of (weather_bonus, weather_reason, has_sensitive_places)
    """
    try:
        # Run both API calls in parallel for better performance
        weather_result, places_result = await asyncio.gather(
            get_weather_bonus(lat, lng),
            get_nearby_sensitive_places(lat, lng),
            return_exceptions=True
        )
        
        # Handle exceptions from individual functions
        if isinstance(weather_result, Exception):
            logger.error(f"Weather fetch failed: {weather_result}")
            weather_bonus, weather_reason = 0, ""
        else:
            weather_bonus, weather_reason = weather_result
            
        if isinstance(places_result, Exception):
            logger.error(f"Places fetch failed: {places_result}")
            has_sensitive_places = False
        else:
            has_sensitive_places = places_result
            
        return weather_bonus, weather_reason, has_sensitive_places
        
    except Exception as e:
        logger.error(f"Context data fetch failed: {e}")
        # Return safe defaults on any failure
        return 0, "", False
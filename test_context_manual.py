#!/usr/bin/env python3
"""
Manual test script to verify context services work with real API endpoints.
This is for manual testing only and requires internet connectivity.
"""

import asyncio
import sys
import os

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.context import get_weather_bonus, get_nearby_sensitive_places, get_context_data


async def test_real_apis():
    """Test context services with real API endpoints."""
    print("Testing Context Services with Real APIs")
    print("=" * 50)
    
    # Test coordinates (New York City)
    lat, lng = 40.7128, -74.0060
    print(f"Testing with coordinates: {lat}, {lng}")
    print()
    
    # Test weather bonus
    print("Testing weather bonus...")
    try:
        weather_bonus, weather_reason = await get_weather_bonus(lat, lng)
        print(f"Weather bonus: {weather_bonus}")
        print(f"Weather reason: {weather_reason}")
        print()
    except Exception as e:
        print(f"Weather API test failed: {e}")
        print()
    
    # Test nearby sensitive places
    print("Testing nearby sensitive places...")
    try:
        has_places = await get_nearby_sensitive_places(lat, lng)
        print(f"Has sensitive places: {has_places}")
        print()
    except Exception as e:
        print(f"Places API test failed: {e}")
        print()
    
    # Test combined context data
    print("Testing combined context data...")
    try:
        weather_bonus, weather_reason, has_places = await get_context_data(lat, lng)
        print(f"Combined results:")
        print(f"  Weather bonus: {weather_bonus}")
        print(f"  Weather reason: {weather_reason}")
        print(f"  Has sensitive places: {has_places}")
        print()
    except Exception as e:
        print(f"Combined context test failed: {e}")
        print()
    
    print("Manual test completed!")


if __name__ == "__main__":
    print("Note: This test requires internet connectivity to call real APIs.")
    print("Press Ctrl+C to cancel or Enter to continue...")
    try:
        input()
    except KeyboardInterrupt:
        print("\nTest cancelled.")
        sys.exit(0)
    
    asyncio.run(test_real_apis())
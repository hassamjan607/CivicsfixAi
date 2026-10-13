#!/usr/bin/env python3
"""
Manual test script for vision service with actual API calls.
Run this with actual environment variables to test Gemini integration.
"""

import asyncio
import os
import sys
import base64

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

from app.vision import analyze_photo, blur_privacy_info, get_base_severity_score

async def test_with_real_api():
    """Test vision service with real Gemini API"""
    
    # Test image (small PNG)
    test_image_data = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    )
    
    print("🔍 Testing Vision Service with Real API")
    print(f"Google API Key present: {bool(os.getenv('GOOGLE_API_KEY'))}")
    
    try:
        # Test photo analysis
        print("\n📸 Testing photo analysis...")
        result = await analyze_photo(test_image_data, "Pothole complaint from Main Street")
        
        print(f"   Severity: {result.severity}")
        print(f"   Description: {result.description}")
        print(f"   Confidence: {result.confidence}")
        print(f"   Detected elements: {result.detected_elements}")
        print(f"   Base severity score: {get_base_severity_score(result)}")
        
        # Test privacy protection
        print("\n🔒 Testing privacy protection...")
        protected_image = await blur_privacy_info(test_image_data)
        print(f"   Original size: {len(test_image_data)} bytes")
        print(f"   Protected size: {len(protected_image)} bytes")
        
        print("\n✅ Vision service test completed successfully!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_with_real_api())
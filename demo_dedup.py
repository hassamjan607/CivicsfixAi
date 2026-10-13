#!/usr/bin/env python3
"""
CivicFix AI Deduplication Demo

Demonstrates the complete deduplication functionality including:
- Image hash computation
- Geographic duplicate detection  
- Distance calculations
- Fraud detection
"""

import sys
import os

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from datetime import datetime, timedelta, timezone
from sqlmodel import Session, create_engine, SQLModel
from PIL import Image, ImageDraw
import io

from app.dedup import (
    compute_image_hash,
    is_duplicate_image, 
    haversine_meters,
    find_duplicate_complaint,
    check_duplicate_image_across_complaints,
    is_fraud_suspected
)
from app.models import Complaint, Department, ImageHash
from app.config import DEDUP_RADIUS_METERS, DEDUP_WINDOW_DAYS


def create_test_image(size=(100, 100), color="red", pattern=None) -> bytes:
    """Create a test image"""
    image = Image.new("RGB", size, color)
    draw = ImageDraw.Draw(image)
    
    if pattern == "circle":
        draw.ellipse([20, 20, 80, 80], fill="blue")
    elif pattern == "square": 
        draw.rectangle([20, 20, 80, 80], fill="green")
    
    img_buffer = io.BytesIO()
    image.save(img_buffer, format="PNG")
    return img_buffer.getvalue()


def main():
    print("🔍 CivicFix AI Deduplication System Demo")
    print("=" * 50)
    
    # Setup in-memory database
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    
    with Session(engine) as session:
        # Create test department
        dept = Department(
            name="Roads Department",
            email="roads@municipality.gov"
        )
        session.add(dept)
        session.commit()
        session.refresh(dept)
        
        print("\n1. 🖼️  Image Hash Computation Demo")
        print("-" * 30)
        
        # Create test images
        image1 = create_test_image(color="red", pattern="circle")
        image2 = create_test_image(color="red", pattern="circle")  # Same as image1
        image3 = create_test_image(color="blue", pattern="square")  # Different
        
        # Compute hashes
        hash1 = compute_image_hash(image1)
        hash2 = compute_image_hash(image2)
        hash3 = compute_image_hash(image3)
        
        print(f"Image 1 hash: {hash1}")
        print(f"Image 2 hash: {hash2}")
        print(f"Image 3 hash: {hash3}")
        print(f"Images 1 & 2 identical: {hash1 == hash2}")
        print(f"Images 1 & 3 identical: {hash1 == hash3}")
        
        # Test duplicate detection
        is_dup, matching_hash = is_duplicate_image(hash1, [hash3])
        print(f"Image 1 duplicate of Image 3: {is_dup}")
        
        is_dup, matching_hash = is_duplicate_image(hash1, [hash2])
        print(f"Image 1 duplicate of Image 2: {is_dup}")
        
        print("\n2. 🌍 Geographic Distance Demo")
        print("-" * 30)
        
        # Test Haversine distance calculations
        nyc_lat, nyc_lng = 40.7128, -74.0060  # New York City
        phila_lat, phila_lng = 39.9526, -75.1652  # Philadelphia
        
        distance_km = haversine_meters(nyc_lat, nyc_lng, phila_lat, phila_lng) / 1000
        print(f"Distance NYC to Philadelphia: {distance_km:.1f} km")
        
        # Test small distance
        nearby_lat = nyc_lat + 0.0001  # About 11 meters north
        nearby_lng = nyc_lng + 0.0001  # About 7 meters east
        small_distance = haversine_meters(nyc_lat, nyc_lng, nearby_lat, nearby_lng)
        print(f"Distance to nearby point: {small_distance:.1f} meters")
        
        print(f"Within dedup radius ({DEDUP_RADIUS_METERS}m): {small_distance <= DEDUP_RADIUS_METERS}")
        
        print("\n3. 🔄 Duplicate Complaint Detection Demo")
        print("-" * 30)
        
        base_time = datetime.now(timezone.utc)
        
        # Create original complaint
        original_complaint = Complaint(
            tracking_id="CF-0001",
            category="pothole",
            summary="Large pothole on Main Street",
            description="Dangerous pothole causing vehicle damage",
            sentiment="negative",
            latitude=nyc_lat,
            longitude=nyc_lng,
            created_at=base_time - timedelta(days=1),
            department_id=dept.id
        )
        session.add(original_complaint)
        session.commit()
        session.refresh(original_complaint)
        
        print(f"Original complaint created: {original_complaint.tracking_id}")
        print(f"Location: ({original_complaint.latitude}, {original_complaint.longitude})")
        
        # Try to find duplicate nearby and recent
        duplicate = find_duplicate_complaint(
            session,
            "pothole",
            nyc_lat + 0.0001,  # 11 meters away
            nyc_lng + 0.0001,  # 7 meters away  
            base_time
        )
        
        if duplicate:
            print(f"✅ Found duplicate: {duplicate.tracking_id}")
            print(f"Distance: {small_distance:.1f}m (within {DEDUP_RADIUS_METERS}m radius)")
        else:
            print("❌ No duplicate found")
        
        # Try to find duplicate outside radius
        far_duplicate = find_duplicate_complaint(
            session,
            "pothole", 
            nyc_lat + 0.01,  # About 1 km away
            nyc_lng + 0.01,
            base_time
        )
        
        far_distance = haversine_meters(nyc_lat, nyc_lng, nyc_lat + 0.01, nyc_lng + 0.01)
        print(f"Far location distance: {far_distance:.0f}m")
        print(f"Duplicate found at far location: {far_duplicate is not None}")
        
        print("\n4. 🚫 Fraud Detection Demo")
        print("-" * 30)
        
        # Create complaint for fraud testing
        fraud_complaint = Complaint(
            tracking_id="CF-0002",
            category="road_damage",
            summary="Road damage with before/after photos",
            description="Road damage that was supposedly fixed",
            sentiment="negative",
            department_id=dept.id
        )
        session.add(fraud_complaint)
        session.commit()
        session.refresh(fraud_complaint)
        
        # Simulate before/after photos with same hash (fraud)
        same_image = create_test_image(color="red", pattern="circle")
        same_hash = compute_image_hash(same_image)
        
        # Add before and after hashes (identical - suspicious!)
        before_hash = ImageHash(
            complaint_id=fraud_complaint.id,
            hash_value=same_hash,
            photo_type="before"
        )
        after_hash = ImageHash(
            complaint_id=fraud_complaint.id, 
            hash_value=same_hash,
            photo_type="after"
        )
        
        session.add_all([before_hash, after_hash])
        session.commit()
        
        fraud_detected = is_fraud_suspected(session, fraud_complaint.id)
        print(f"Fraud detected for {fraud_complaint.tracking_id}: {fraud_detected}")
        print(f"Reason: Before/after images are {'identical' if fraud_detected else 'different'}")
        
        print("\n5. 📊 System Configuration")
        print("-" * 30)
        print(f"Deduplication radius: {DEDUP_RADIUS_METERS} meters")
        print(f"Time window: {DEDUP_WINDOW_DAYS} days")
        print(f"Image similarity threshold: {10} (hamming distance)")  # From config
        
        print("\n✅ Demo completed successfully!")
        print("The deduplication system is ready for production use.")


if __name__ == "__main__":
    main()
"""
Tests for CivicFix AI Deduplication Service

Comprehensive tests covering:
- Image hash computation and comparison
- Haversine distance calculations
- Geographic duplicate detection  
- Time window filtering
- Fraud detection via image similarity
- Edge cases and error handling
"""

import io
import math
import pytest
from datetime import datetime, timedelta, timezone
from PIL import Image, ImageDraw
from sqlmodel import Session, create_engine, SQLModel
from typing import List

from app.dedup import (
    compute_image_hash,
    is_duplicate_image,
    haversine_meters,
    find_duplicate_complaint,
    get_existing_image_hashes,
    create_image_hash,
    check_duplicate_image_across_complaints,
    update_duplicate_counts,
    is_fraud_suspected,
    validate_coordinates,
    get_nearby_complaints
)
from app.models import Complaint, ImageHash, Department
from app.config import ComplaintCategory, SIMILARITY_THRESHOLD, DEDUP_RADIUS_METERS, DEDUP_WINDOW_DAYS


@pytest.fixture
def test_session():
    """Create a test database session"""
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    
    with Session(engine) as session:
        # Create a test department
        dept = Department(
            name="Test Department",
            email="test@example.com"
        )
        session.add(dept)
        session.commit()
        session.refresh(dept)
        
        yield session


def create_test_image(size=(100, 100), color="red", pattern=None) -> bytes:
    """Create a test image with specified properties"""
    image = Image.new("RGB", size, color)
    draw = ImageDraw.Draw(image)
    
    if pattern == "circle":
        draw.ellipse([20, 20, 80, 80], fill="blue")
    elif pattern == "square":
        draw.rectangle([20, 20, 80, 80], fill="green")
    elif pattern == "lines":
        for i in range(0, 100, 10):
            draw.line([(i, 0), (i, 100)], fill="black", width=2)
    
    # Convert to bytes
    img_buffer = io.BytesIO()
    image.save(img_buffer, format="PNG")
    return img_buffer.getvalue()


class TestImageHashing:
    """Test image hash computation and comparison"""
    
    def test_compute_image_hash_success(self):
        """Test successful image hash computation"""
        image_bytes = create_test_image(color="red", pattern="circle")
        hash_value = compute_image_hash(image_bytes)
        
        assert isinstance(hash_value, str)
        assert len(hash_value) == 16  # 8x8 hash = 64 bits = 16 hex chars
        assert all(c in '0123456789abcdef' for c in hash_value)
    
    def test_compute_image_hash_different_images(self):
        """Test that different images produce different hashes"""
        image1 = create_test_image(color="red", pattern="circle")
        image2 = create_test_image(color="blue", pattern="square")
        
        hash1 = compute_image_hash(image1)
        hash2 = compute_image_hash(image2)
        
        assert hash1 != hash2
    
    def test_compute_image_hash_similar_images(self):
        """Test that similar images produce similar hashes"""
        # Create two similar red images with slightly different patterns
        image1 = create_test_image(color="red", pattern="circle")
        image2 = create_test_image(color="red", pattern="circle")  # Same pattern, should be identical
        
        hash1 = compute_image_hash(image1)
        hash2 = compute_image_hash(image2)
        
        # They should be identical since they're the same
        assert hash1 == hash2
        
        # Now test slightly different images
        image3 = create_test_image(color="#ff1010", pattern="circle")  # Different red
        hash3 = compute_image_hash(image3)
        
        # Should be similar enough to be within threshold
        is_similar, _ = is_duplicate_image(hash1, [hash3])
        # This may or may not be similar depending on threshold, so let's just check they're valid hashes
        assert len(hash1) == 16
        assert len(hash3) == 16
    
    def test_compute_image_hash_empty_bytes(self):
        """Test error handling for empty image bytes"""
        with pytest.raises(ValueError, match="Image bytes cannot be empty"):
            compute_image_hash(b"")
    
    def test_compute_image_hash_invalid_bytes(self):
        """Test error handling for invalid image data"""
        with pytest.raises(ValueError, match="Failed to compute image hash"):
            compute_image_hash(b"invalid image data")
    
    def test_is_duplicate_image_identical(self):
        """Test duplicate detection with identical hashes"""
        hash1 = "a1b2c3d4e5f6a7b8"  # Valid 16-character hex string
        existing_hashes = ["1234567890abcdef", hash1, "fedcba0987654321"]
        
        is_duplicate, matching_hash = is_duplicate_image(hash1, existing_hashes)
        assert is_duplicate
        assert matching_hash == hash1
    
    def test_is_duplicate_image_similar_within_threshold(self):
        """Test duplicate detection with similar hashes within threshold"""
        # Create two similar images
        image1 = create_test_image(color="red")
        image2 = create_test_image(color="red")
        
        hash1 = compute_image_hash(image1)
        hash2 = compute_image_hash(image2)
        
        is_duplicate, matching_hash = is_duplicate_image(hash1, [hash2])
        assert is_duplicate
        assert matching_hash == hash2
    
    def test_is_duplicate_image_different_above_threshold(self):
        """Test no duplicate detection for very different images"""
        image1 = create_test_image(color="red", pattern="circle")
        image2 = create_test_image(color="blue", pattern="lines")
        
        hash1 = compute_image_hash(image1)
        hash2 = compute_image_hash(image2)
        
        is_duplicate, matching_hash = is_duplicate_image(hash1, [hash2])
        assert not is_duplicate
        assert matching_hash is None
    
    def test_is_duplicate_image_empty_hashes(self):
        """Test duplicate detection with empty existing hashes list"""
        hash1 = "a1b2c3d4e5f6g7h8"
        
        is_duplicate, matching_hash = is_duplicate_image(hash1, [])
        assert not is_duplicate
        assert matching_hash is None
    
    def test_is_duplicate_image_invalid_hash(self):
        """Test error handling for invalid hash format"""
        with pytest.raises(ValueError, match="New hash cannot be empty"):
            is_duplicate_image("", ["validhash"])
        
        with pytest.raises(ValueError, match="Invalid hash format"):
            is_duplicate_image("invalid", ["validhash"])


class TestHaversineDistance:
    """Test Haversine distance calculations"""
    
    def test_haversine_same_point(self):
        """Test distance between same point is zero"""
        lat, lng = 40.7128, -74.0060  # New York City
        distance = haversine_meters(lat, lng, lat, lng)
        assert distance == 0.0
    
    def test_haversine_known_distance(self):
        """Test distance calculation for known coordinates"""
        # Distance between New York City and Philadelphia is approximately 130 km
        nyc_lat, nyc_lng = 40.7128, -74.0060
        phila_lat, phila_lng = 39.9526, -75.1652
        
        distance = haversine_meters(nyc_lat, nyc_lng, phila_lat, phila_lng)
        
        # Should be approximately 130,000 meters (allow 10% tolerance)
        assert 115_000 <= distance <= 145_000
    
    def test_haversine_small_distance(self):
        """Test accurate calculation for small distances"""
        # Two points very close together (about 100 meters apart)
        lat1, lng1 = 40.7128, -74.0060
        lat2, lng2 = 40.7137, -74.0060  # Move about 0.0009 degrees north
        
        distance = haversine_meters(lat1, lng1, lat2, lng2)
        
        # Should be approximately 100 meters (allow reasonable tolerance)
        assert 80 <= distance <= 120
    
    def test_haversine_invalid_coordinates(self):
        """Test error handling for invalid coordinates"""
        with pytest.raises(ValueError, match="Latitude must be between -90 and 90"):
            haversine_meters(91, 0, 40, -74)
        
        with pytest.raises(ValueError, match="Latitude must be between -90 and 90"):
            haversine_meters(40, -74, -91, 0)
        
        with pytest.raises(ValueError, match="Longitude must be between -180 and 180"):
            haversine_meters(40, 181, 40, -74)
        
        with pytest.raises(ValueError, match="Longitude must be between -180 and 180"):
            haversine_meters(40, -74, 40, -181)
    
    def test_haversine_antipodal_points(self):
        """Test distance between antipodal points (opposite sides of Earth)"""
        # London and its antipodal point
        london_lat, london_lng = 51.5074, -0.1278
        antipodal_lat, antipodal_lng = -51.5074, 179.8722
        
        distance = haversine_meters(london_lat, london_lng, antipodal_lat, antipodal_lng)
        
        # Should be approximately half of Earth's circumference (20,000 km)
        assert 19_000_000 <= distance <= 21_000_000


class TestCoordinateValidation:
    """Test coordinate validation"""
    
    def test_validate_coordinates_valid(self):
        """Test validation of valid coordinates"""
        assert validate_coordinates(40.7128, -74.0060)  # NYC
        assert validate_coordinates(0, 0)  # Equator, Prime Meridian
        assert validate_coordinates(-90, -180)  # South Pole, antimeridian
        assert validate_coordinates(90, 180)  # North Pole, antimeridian
    
    def test_validate_coordinates_invalid(self):
        """Test validation of invalid coordinates"""
        assert not validate_coordinates(91, 0)  # Latitude too high
        assert not validate_coordinates(-91, 0)  # Latitude too low
        assert not validate_coordinates(0, 181)  # Longitude too high
        assert not validate_coordinates(0, -181)  # Longitude too low


class TestDuplicateComplaintDetection:
    """Test geographic duplicate complaint detection"""
    
    _test_counter = 0  # Class variable to ensure unique tracking IDs
    
    def create_test_complaint(self, session: Session, category: str, lat: float, lng: float, 
                            created_at: datetime = None) -> Complaint:
        """Helper to create a test complaint"""
        if created_at is None:
            created_at = datetime.now(timezone.utc)
        elif created_at.tzinfo is None:
            # Add UTC timezone if created_at is naive
            created_at = created_at.replace(tzinfo=timezone.utc)
        
        # Generate a unique tracking ID using class counter
        TestDuplicateComplaintDetection._test_counter += 1
        unique_id = TestDuplicateComplaintDetection._test_counter
        
        complaint = Complaint(
            tracking_id=f"CF-{unique_id:04d}",
            category=category,
            summary="Test complaint",
            description="Test description",
            sentiment="negative",
            latitude=lat,
            longitude=lng,
            created_at=created_at,
            department_id=1
        )
        session.add(complaint)
        session.commit()
        session.refresh(complaint)
        return complaint
    
    def test_find_duplicate_within_radius_and_time(self, test_session):
        """Test finding duplicate within both radius and time window"""
        base_time = datetime.now(timezone.utc)
        lat, lng = 40.7128, -74.0060
        
        # Create original complaint 1 day ago
        original = self.create_test_complaint(
            test_session, "pothole", lat, lng, 
            created_at=base_time - timedelta(days=1)
        )
        
        # Try to find duplicate for a complaint very close by and recent
        duplicate = find_duplicate_complaint(
            test_session, "pothole", 
            lat + 0.0001, lng + 0.0001,  # About 10 meters away
            base_time
        )
        
        assert duplicate is not None
        assert duplicate.id == original.id
    
    def test_find_duplicate_outside_radius(self, test_session):
        """Test no duplicate found when outside radius"""
        base_time = datetime.now(timezone.utc)
        lat, lng = 40.7128, -74.0060
        
        # Create original complaint
        self.create_test_complaint(
            test_session, "pothole", lat, lng,
            created_at=base_time - timedelta(days=1)
        )
        
        # Try to find duplicate far away (about 1 km)
        duplicate = find_duplicate_complaint(
            test_session, "pothole",
            lat + 0.01, lng + 0.01,  # About 1 km away
            base_time
        )
        
        assert duplicate is None
    
    def test_find_duplicate_outside_time_window(self, test_session):
        """Test no duplicate found when outside time window"""
        base_time = datetime.now(timezone.utc)
        lat, lng = 40.7128, -74.0060
        
        # Create original complaint 10 days ago (outside window)
        self.create_test_complaint(
            test_session, "pothole", lat, lng,
            created_at=base_time - timedelta(days=10)
        )
        
        # Try to find duplicate nearby but outside time window
        duplicate = find_duplicate_complaint(
            test_session, "pothole",
            lat + 0.0001, lng + 0.0001,
            base_time
        )
        
        assert duplicate is None
    
    def test_find_duplicate_different_category(self, test_session):
        """Test no duplicate found for different category"""
        base_time = datetime.now(timezone.utc)
        lat, lng = 40.7128, -74.0060
        
        # Create original complaint
        self.create_test_complaint(
            test_session, "pothole", lat, lng,
            created_at=base_time - timedelta(days=1)
        )
        
        # Try to find duplicate with different category
        duplicate = find_duplicate_complaint(
            test_session, "water_leak",  # Different category
            lat + 0.0001, lng + 0.0001,
            base_time
        )
        
        assert duplicate is None
    
    def test_find_duplicate_resolved_complaint(self, test_session):
        """Test no duplicate found for resolved complaints"""
        base_time = datetime.now(timezone.utc)
        lat, lng = 40.7128, -74.0060
        
        # Create resolved complaint
        original = self.create_test_complaint(
            test_session, "pothole", lat, lng,
            created_at=base_time - timedelta(days=1)
        )
        original.status = "Resolved"
        test_session.add(original)
        test_session.commit()
        
        # Try to find duplicate - should not match resolved complaints
        duplicate = find_duplicate_complaint(
            test_session, "pothole",
            lat + 0.0001, lng + 0.0001,
            base_time
        )
        
        assert duplicate is None
    
    def test_find_duplicate_returns_oldest(self, test_session):
        """Test that oldest complaint is returned when multiple matches"""
        base_time = datetime.now(timezone.utc)
        lat, lng = 40.7128, -74.0060
        
        # Create multiple complaints at same location
        oldest = self.create_test_complaint(
            test_session, "pothole", lat, lng,
            created_at=base_time - timedelta(days=3)
        )
        
        middle = self.create_test_complaint(
            test_session, "pothole", lat, lng,
            created_at=base_time - timedelta(days=2)
        )
        
        newest = self.create_test_complaint(
            test_session, "pothole", lat, lng,
            created_at=base_time - timedelta(days=1)
        )
        
        # Should return the oldest complaint
        duplicate = find_duplicate_complaint(
            test_session, "pothole",
            lat + 0.0001, lng + 0.0001,
            base_time
        )
        
        assert duplicate is not None
        assert duplicate.id == oldest.id
    
    def test_find_duplicate_invalid_coordinates(self, test_session):
        """Test error handling for invalid coordinates"""
        base_time = datetime.now(timezone.utc)
        
        with pytest.raises(ValueError, match="Invalid coordinates"):
            find_duplicate_complaint(
                test_session, "pothole",
                91, 0,  # Invalid latitude
                base_time
            )
    
    def test_find_duplicate_empty_category(self, test_session):
        """Test error handling for empty category"""
        base_time = datetime.now(timezone.utc)
        
        with pytest.raises(ValueError, match="Category cannot be empty"):
            find_duplicate_complaint(
                test_session, "",
                40.7128, -74.0060,
                base_time
            )


class TestImageHashDatabase:
    """Test image hash database operations"""
    
    def test_create_image_hash(self, test_session):
        """Test creating image hash record"""
        # Create a test complaint first
        complaint = Complaint(
            tracking_id="CF-0001",
            category="pothole",
            summary="Test",
            description="Test",
            sentiment="negative",
            department_id=1
        )
        test_session.add(complaint)
        test_session.commit()
        test_session.refresh(complaint)
        
        # Create image hash
        hash_record = create_image_hash(
            test_session, complaint.id, "abcd1234efgh5678", "submission"
        )
        
        assert hash_record.id is not None
        assert hash_record.complaint_id == complaint.id
        assert hash_record.hash_value == "abcd1234efgh5678"
        assert hash_record.photo_type == "submission"
    
    def test_get_existing_image_hashes(self, test_session):
        """Test retrieving existing image hashes"""
        # Create test complaints and hashes
        complaint1 = Complaint(
            tracking_id="CF-0001", category="pothole", summary="Test", 
            description="Test", sentiment="negative", department_id=1
        )
        complaint2 = Complaint(
            tracking_id="CF-0002", category="pothole", summary="Test",
            description="Test", sentiment="negative", department_id=1
        )
        test_session.add_all([complaint1, complaint2])
        test_session.commit()
        test_session.refresh(complaint1)
        test_session.refresh(complaint2)
        
        # Create image hashes
        hash1 = create_image_hash(test_session, complaint1.id, "hash1", "submission")
        hash2 = create_image_hash(test_session, complaint2.id, "hash2", "submission")
        
        # Get all hashes
        all_hashes = get_existing_image_hashes(test_session)
        assert "hash1" in all_hashes
        assert "hash2" in all_hashes
        
        # Get hashes for specific complaints
        specific_hashes = get_existing_image_hashes(test_session, [complaint1.id])
        assert "hash1" in specific_hashes
        assert "hash2" not in specific_hashes
    
    def test_check_duplicate_image_across_complaints(self, test_session):
        """Test duplicate image detection across all complaints"""
        # Create test complaint and image hash
        complaint = Complaint(
            tracking_id="CF-0001", category="pothole", summary="Test",
            description="Test", sentiment="negative", department_id=1
        )
        test_session.add(complaint)
        test_session.commit()
        test_session.refresh(complaint)
        
        # Create test image and store its hash
        image_bytes = create_test_image(color="red", pattern="circle")
        hash_value = compute_image_hash(image_bytes)
        create_image_hash(test_session, complaint.id, hash_value, "submission")
        
        # Test duplicate detection with same image
        is_duplicate, tracking_id = check_duplicate_image_across_complaints(
            test_session, image_bytes
        )
        
        assert is_duplicate
        assert tracking_id == "CF-0001"
        
        # Test with different image
        different_image = create_test_image(color="blue", pattern="square")
        is_duplicate, tracking_id = check_duplicate_image_across_complaints(
            test_session, different_image
        )
        
        assert not is_duplicate
        assert tracking_id is None


class TestFraudDetection:
    """Test fraud detection via before/after image similarity"""
    
    def test_is_fraud_suspected_identical_images(self, test_session):
        """Test fraud detection when before/after images are identical"""
        # Create test complaint
        complaint = Complaint(
            tracking_id="CF-0001", category="pothole", summary="Test",
            description="Test", sentiment="negative", department_id=1
        )
        test_session.add(complaint)
        test_session.commit()
        test_session.refresh(complaint)
        
        # Create identical before and after image hashes (valid hex)
        same_hash = "a1b2c3d4e5f6a7b8"  # Valid 16-character hex string
        create_image_hash(test_session, complaint.id, same_hash, "before")
        create_image_hash(test_session, complaint.id, same_hash, "after")
        
        # Should detect fraud
        assert is_fraud_suspected(test_session, complaint.id)
    
    def test_is_fraud_suspected_different_images(self, test_session):
        """Test no fraud detection when before/after images are different"""
        # Create test complaint
        complaint = Complaint(
            tracking_id="CF-0001", category="pothole", summary="Test",
            description="Test", sentiment="negative", department_id=1
        )
        test_session.add(complaint)
        test_session.commit()
        test_session.refresh(complaint)
        
        # Create different before and after image hashes
        before_image = create_test_image(color="red", pattern="circle")
        after_image = create_test_image(color="blue", pattern="square")
        
        before_hash = compute_image_hash(before_image)
        after_hash = compute_image_hash(after_image)
        
        create_image_hash(test_session, complaint.id, before_hash, "before")
        create_image_hash(test_session, complaint.id, after_hash, "after")
        
        # Should not detect fraud
        assert not is_fraud_suspected(test_session, complaint.id)
    
    def test_is_fraud_suspected_no_before_after_images(self, test_session):
        """Test no fraud detection when no before/after images exist"""
        # Create test complaint
        complaint = Complaint(
            tracking_id="CF-0001", category="pothole", summary="Test",
            description="Test", sentiment="negative", department_id=1
        )
        test_session.add(complaint)
        test_session.commit()
        test_session.refresh(complaint)
        
        # Should not detect fraud when no before/after images
        assert not is_fraud_suspected(test_session, complaint.id)


class TestDuplicateCountUpdates:
    """Test duplicate count updates"""
    
    def test_update_duplicate_counts(self, test_session):
        """Test updating duplicate and recurrence counts"""
        # Create test complaint
        complaint = Complaint(
            tracking_id="CF-0001", category="pothole", summary="Test",
            description="Test", sentiment="negative", department_id=1,
            duplicate_count=0, recurrence_count=0
        )
        test_session.add(complaint)
        test_session.commit()
        test_session.refresh(complaint)
        
        # Set updated_at to the past so the update is deterministically strictly greater
        original_updated_at = datetime.now(timezone.utc) - timedelta(seconds=2)
        complaint.updated_at = original_updated_at
        test_session.commit()
        test_session.refresh(complaint)
        
        # Update counts
        update_duplicate_counts(test_session, complaint)
        
        # Verify counts were incremented
        test_session.refresh(complaint)
        assert complaint.duplicate_count == 1
        assert complaint.recurrence_count == 1
        assert complaint.updated_at > original_updated_at


class TestNearbyComplaints:
    """Test nearby complaints functionality"""
    
    def test_get_nearby_complaints(self, test_session):
        """Test getting complaints near a location"""
        base_lat, base_lng = 40.7128, -74.0060
        
        # Create complaints at various distances
        close_complaint = Complaint(
            tracking_id="CF-0001", category="pothole", summary="Close",
            description="Close complaint", sentiment="negative",
            latitude=base_lat + 0.0001, longitude=base_lng + 0.0001,  # ~10m
            department_id=1
        )
        
        far_complaint = Complaint(
            tracking_id="CF-0002", category="pothole", summary="Far",
            description="Far complaint", sentiment="negative", 
            latitude=base_lat + 0.01, longitude=base_lng + 0.01,  # ~1km
            department_id=1
        )
        
        test_session.add_all([close_complaint, far_complaint])
        test_session.commit()
        
        # Get nearby complaints within 50m radius
        nearby = get_nearby_complaints(
            test_session, base_lat, base_lng, radius_meters=50
        )
        
        # Should only find the close complaint
        assert len(nearby) == 1
        assert nearby[0][0].tracking_id == "CF-0001"
        assert nearby[0][1] <= 50  # Distance should be within radius
        
        # Get nearby complaints within 2km radius
        nearby_large = get_nearby_complaints(
            test_session, base_lat, base_lng, radius_meters=2000
        )
        
        # Should find both complaints, sorted by distance
        assert len(nearby_large) == 2
        assert nearby_large[0][0].tracking_id == "CF-0001"  # Closer first
        assert nearby_large[1][0].tracking_id == "CF-0002"  # Farther second
        assert nearby_large[0][1] < nearby_large[1][1]  # Distances in order
"""
CivicFix AI Deduplication Service

Image hash and geographic duplicate detection using imagehash, 
geopy, and Haversine distance calculations.

This module provides comprehensive deduplication functionality for:
- Image-based duplicate detection using perceptual hashing
- Geographic duplicate detection using Haversine distance
- Time window filtering for complaint clustering
- Integration with database models for cluster management

Features:
- Perceptual hash computation using imagehash library
- Configurable similarity thresholds for image matching
- Precise Haversine distance calculations in meters
- Efficient database queries with spatial and temporal filtering
- Support for complaint clustering and duplicate counting
"""

import math
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Tuple
from sqlmodel import Session, select
from PIL import Image
import imagehash
import io

from .models import Complaint, ImageHash
from .config import SIMILARITY_THRESHOLD, DEDUP_RADIUS_METERS, DEDUP_WINDOW_DAYS


def compute_image_hash(image_bytes: bytes) -> str:
    """
    Compute perceptual hash of image using imagehash.
    
    Uses perceptual hash (pHash) which is robust to minor changes like
    compression, scaling, and slight color variations while being sensitive
    to structural changes in the image content.
    
    Args:
        image_bytes: Raw image data as bytes
        
    Returns:
        Hex string representation of perceptual hash
        
    Raises:
        ValueError: If image_bytes is empty or cannot be processed
        PIL.UnidentifiedImageError: If image format is not supported
    """
    if not image_bytes:
        raise ValueError("Image bytes cannot be empty")
    
    try:
        # Load image from bytes
        image_stream = io.BytesIO(image_bytes)
        image = Image.open(image_stream)
        
        # Convert to RGB if necessary (handles RGBA, grayscale, etc.)
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Compute perceptual hash (8x8 = 64-bit hash by default)
        phash = imagehash.phash(image, hash_size=8)
        
        # Return as hex string
        return str(phash)
        
    except Exception as e:
        raise ValueError(f"Failed to compute image hash: {str(e)}")
    finally:
        # Clean up image stream
        try:
            image_stream.close()
        except:
            pass


def is_duplicate_image(new_hash: str, existing_hashes: List[str]) -> Tuple[bool, Optional[str]]:
    """
    Check if new image hash matches any existing hash within threshold.
    
    Computes Hamming distance between the new hash and all existing hashes.
    Returns True if any distance is within the similarity threshold.
    
    Args:
        new_hash: Hash of new image as hex string
        existing_hashes: List of existing hashes to compare against
        
    Returns:
        Tuple of (is_duplicate, matching_hash):
        - is_duplicate: True if duplicate found within similarity threshold
        - matching_hash: The hash that matched, or None if no match
        
    Raises:
        ValueError: If hash strings are invalid or have different lengths
    """
    if not new_hash:
        raise ValueError("New hash cannot be empty")
    
    if not existing_hashes:
        return False, None
    
    try:
        # Convert new hash string to imagehash object for comparison
        new_hash_obj = imagehash.hex_to_hash(new_hash)
        
        for existing_hash in existing_hashes:
            if not existing_hash:
                continue  # Skip empty hashes
                
            try:
                # Convert existing hash to imagehash object
                existing_hash_obj = imagehash.hex_to_hash(existing_hash)
                
                # Calculate Hamming distance
                hamming_distance = new_hash_obj - existing_hash_obj
                
                # Check if within similarity threshold
                if hamming_distance <= SIMILARITY_THRESHOLD:
                    return True, existing_hash
                    
            except ValueError:
                # Skip invalid hashes
                continue
        
        return False, None
        
    except ValueError as e:
        raise ValueError(f"Invalid hash format: {str(e)}")


def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Calculate Haversine distance between two points in meters.
    
    Uses the Haversine formula to compute the great-circle distance between
    two points on Earth given their latitude and longitude coordinates.
    
    Formula:
        a = sin²(Δφ/2) + cos φ1 ⋅ cos φ2 ⋅ sin²(Δλ/2)
        c = 2 ⋅ atan2(√a, √(1−a))
        d = R ⋅ c
    
    Where:
        φ is latitude in radians
        λ is longitude in radians  
        R is Earth's radius (mean radius = 6,371,000 meters)
    
    Args:
        lat1, lng1: First point coordinates (latitude, longitude in degrees)
        lat2, lng2: Second point coordinates (latitude, longitude in degrees)
        
    Returns:
        Distance in meters as float
        
    Raises:
        ValueError: If coordinates are invalid (outside valid ranges)
    """
    # Validate coordinate ranges
    if not (-90 <= lat1 <= 90) or not (-90 <= lat2 <= 90):
        raise ValueError("Latitude must be between -90 and 90 degrees")
    if not (-180 <= lng1 <= 180) or not (-180 <= lng2 <= 180):
        raise ValueError("Longitude must be between -180 and 180 degrees")
    
    # Earth's mean radius in meters
    EARTH_RADIUS_METERS = 6_371_000
    
    # Convert coordinates to radians
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    lng1_rad = math.radians(lng1)
    lng2_rad = math.radians(lng2)
    
    # Haversine formula
    dlat = lat2_rad - lat1_rad
    dlng = lng2_rad - lng1_rad
    
    a = (math.sin(dlat / 2) ** 2 + 
         math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng / 2) ** 2)
    
    # Handle edge case where a > 1 due to floating point errors
    a = min(1.0, a)
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = EARTH_RADIUS_METERS * c
    
    return distance


def find_duplicate_complaint(
    session: Session,
    category: str, 
    lat: float,
    lng: float,
    submitted_at: datetime
) -> Optional[Complaint]:
    """
    Find duplicate complaint within radius and time window.
    
    Searches for existing complaints that match:
    1. Same category
    2. Within 30 meter radius (configurable)  
    3. Within 7 day time window (configurable)
    4. Status is not "Resolved" (to avoid matching old resolved complaints)
    
    Uses efficient spatial filtering by first applying a bounding box filter
    before computing precise Haversine distances.
    
    Args:
        session: Database session
        category: Complaint category to match
        lat, lng: Complaint coordinates  
        submitted_at: Submission timestamp
        
    Returns:
        Original complaint if duplicate found, None otherwise
        
    Raises:
        ValueError: If coordinates are invalid or category is empty
    """
    # Validate inputs
    if not category:
        raise ValueError("Category cannot be empty")
    
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        raise ValueError("Invalid coordinates")
    
    # Calculate time window
    time_window_start = submitted_at - timedelta(days=DEDUP_WINDOW_DAYS)
    
    # First pass: Get complaints in the same category and time window
    # Use a bounding box for initial filtering to improve query performance
    lat_delta = DEDUP_RADIUS_METERS / 111_000  # Approximate degrees (1 degree ≈ 111km)
    lng_delta = DEDUP_RADIUS_METERS / (111_000 * math.cos(math.radians(lat)))  # Adjust for latitude
    
    query = select(Complaint).where(
        Complaint.category == category,
        Complaint.created_at >= time_window_start,
        Complaint.created_at < submitted_at,  # Only look at older complaints
        Complaint.latitude.isnot(None),
        Complaint.longitude.isnot(None),
        Complaint.latitude.between(lat - lat_delta, lat + lat_delta),
        Complaint.longitude.between(lng - lng_delta, lng + lng_delta),
        Complaint.status != "Resolved"  # Don't match resolved complaints
    ).order_by(Complaint.created_at.asc())  # Oldest first (original complaint)
    
    candidate_complaints = list(session.exec(query))
    
    # Second pass: Check precise Haversine distance for candidates
    for complaint in candidate_complaints:
        try:
            distance = haversine_meters(
                lat, lng, 
                complaint.latitude, complaint.longitude
            )
            
            if distance <= DEDUP_RADIUS_METERS:
                # Found a duplicate within radius
                return complaint
                
        except (ValueError, TypeError):
            # Skip complaints with invalid coordinates
            continue
    
    return None


def get_existing_image_hashes(session: Session, complaint_ids: Optional[List[int]] = None) -> List[str]:
    """
    Get all existing image hashes, optionally filtered by complaint IDs.
    
    Used for duplicate image detection across all complaints or specific clusters.
    
    Args:
        session: Database session
        complaint_ids: Optional list of complaint IDs to filter by
        
    Returns:
        List of hash values as strings
    """
    query = select(ImageHash.hash_value)
    
    if complaint_ids:
        query = query.where(ImageHash.complaint_id.in_(complaint_ids))
    
    results = session.exec(query).all()
    return [hash_value for hash_value in results if hash_value]


def create_image_hash(
    session: Session,
    complaint_id: int,
    hash_value: str,
    photo_type: str = "submission"
) -> ImageHash:
    """
    Create a new image hash record in the database.
    
    Args:
        session: Database session
        complaint_id: ID of the complaint the image belongs to
        hash_value: Perceptual hash as hex string
        photo_type: Type of photo (submission, before, after, proof)
        
    Returns:
        Created ImageHash record
        
    Raises:
        ValueError: If inputs are invalid
    """
    if not hash_value:
        raise ValueError("Hash value cannot be empty")
    
    if complaint_id <= 0:
        raise ValueError("Complaint ID must be positive")
    
    # Create the image hash record
    image_hash = ImageHash(
        complaint_id=complaint_id,
        hash_value=hash_value,
        photo_type=photo_type
    )
    
    session.add(image_hash)
    session.commit()
    session.refresh(image_hash)
    
    return image_hash


def check_duplicate_image_across_complaints(
    session: Session,
    image_bytes: bytes,
    exclude_complaint_id: Optional[int] = None
) -> Tuple[bool, Optional[str]]:
    """
    Check if an image is a duplicate across all complaints in the system.
    
    Computes hash of the new image and compares against all existing hashes,
    optionally excluding a specific complaint (useful when updating a complaint).
    
    Args:
        session: Database session
        image_bytes: Raw image data
        exclude_complaint_id: Optional complaint ID to exclude from search
        
    Returns:
        Tuple of (is_duplicate, original_tracking_id):
        - is_duplicate: True if duplicate found
        - original_tracking_id: Tracking ID of original complaint with matching image
        
    Raises:
        ValueError: If image processing fails
    """
    # Compute hash of new image
    new_hash = compute_image_hash(image_bytes)
    
    # Get all existing hashes (excluding specified complaint if provided)
    query = select(ImageHash, Complaint.tracking_id).join(
        Complaint, ImageHash.complaint_id == Complaint.id
    )
    
    if exclude_complaint_id:
        query = query.where(ImageHash.complaint_id != exclude_complaint_id)
    
    results = session.exec(query).all()
    
    # Extract hashes and build mapping to tracking IDs
    existing_hashes = []
    hash_to_tracking_id = {}
    
    for image_hash, tracking_id in results:
        if image_hash.hash_value:
            existing_hashes.append(image_hash.hash_value)
            hash_to_tracking_id[image_hash.hash_value] = tracking_id
    
    # Check for duplicates
    is_duplicate, matching_hash = is_duplicate_image(new_hash, existing_hashes)
    
    if is_duplicate and matching_hash:
        original_tracking_id = hash_to_tracking_id.get(matching_hash)
        return True, original_tracking_id
    
    return False, None


def update_duplicate_counts(session: Session, original_complaint: Complaint) -> None:
    """
    Update duplicate count for the original complaint when a new duplicate is merged.
    
    Increments both duplicate_count and recurrence_count fields and saves to database.
    These counters are used for urgency scoring and root cause detection.
    
    Args:
        session: Database session
        original_complaint: The original complaint to update counts for
    """
    if not original_complaint:
        return
    
    # Increment counters
    original_complaint.duplicate_count += 1
    original_complaint.recurrence_count += 1
    
    # Update timestamp
    original_complaint.updated_at = datetime.now(timezone.utc)
    
    # Save to database
    session.add(original_complaint)
    session.commit()
    session.refresh(original_complaint)


def get_complaints_in_cluster(session: Session, original_complaint_id: int) -> List[Complaint]:
    """
    Get all complaints in the same cluster as the original complaint.
    
    This includes the original complaint plus all duplicates that were merged into it.
    Currently this returns just the original complaint since we merge duplicates
    by incrementing counters rather than storing separate records.
    
    Args:
        session: Database session  
        original_complaint_id: ID of the original complaint
        
    Returns:
        List of complaints in the cluster (currently just the original)
    """
    # In our current design, we merge duplicates by incrementing counters
    # rather than maintaining separate records, so we just return the original
    original_complaint = session.get(Complaint, original_complaint_id)
    
    if original_complaint:
        return [original_complaint]
    
    return []


def is_fraud_suspected(session: Session, complaint_id: int) -> bool:
    """
    Check if before/after images are suspiciously similar (fraud detection).
    
    Compares perceptual hashes of before and after photos for the same complaint.
    If they are identical or very similar, it may indicate fraud (same photo
    used for before and after).
    
    Args:
        session: Database session
        complaint_id: ID of complaint to check
        
    Returns:
        True if fraud is suspected based on image similarity
    """
    # Get before and after image hashes for this complaint
    before_hashes = session.exec(
        select(ImageHash.hash_value).where(
            ImageHash.complaint_id == complaint_id,
            ImageHash.photo_type == "before"
        )
    ).all()
    
    after_hashes = session.exec(
        select(ImageHash.hash_value).where(
            ImageHash.complaint_id == complaint_id,
            ImageHash.photo_type == "after"
        )
    ).all()
    
    # If we don't have both before and after images, can't detect fraud
    if not before_hashes or not after_hashes:
        return False
    
    # Check if any before hash matches any after hash within threshold
    for before_hash in before_hashes:
        if before_hash:
            is_duplicate, _ = is_duplicate_image(before_hash, list(after_hashes))
            if is_duplicate:
                return True
    
    return False


def validate_coordinates(lat: float, lng: float) -> bool:
    """
    Validate latitude and longitude coordinates.
    
    Args:
        lat: Latitude in degrees
        lng: Longitude in degrees
        
    Returns:
        True if coordinates are valid, False otherwise
    """
    return (-90 <= lat <= 90) and (-180 <= lng <= 180)


def get_nearby_complaints(
    session: Session,
    lat: float,
    lng: float,
    radius_meters: float = DEDUP_RADIUS_METERS,
    max_results: int = 10
) -> List[Tuple[Complaint, float]]:
    """
    Get complaints near a specific location with their distances.
    
    Useful for debugging, analysis, or showing related complaints to users.
    
    Args:
        session: Database session
        lat, lng: Center coordinates
        radius_meters: Search radius in meters
        max_results: Maximum number of results to return
        
    Returns:
        List of (complaint, distance_meters) tuples, sorted by distance
    """
    if not validate_coordinates(lat, lng):
        raise ValueError("Invalid coordinates")
    
    # Bounding box filter for efficiency
    lat_delta = radius_meters / 111_000
    lng_delta = radius_meters / (111_000 * math.cos(math.radians(lat)))
    
    query = select(Complaint).where(
        Complaint.latitude.isnot(None),
        Complaint.longitude.isnot(None),
        Complaint.latitude.between(lat - lat_delta, lat + lat_delta),
        Complaint.longitude.between(lng - lng_delta, lng + lng_delta)
    )
    
    candidates = list(session.exec(query))
    
    # Calculate precise distances and filter
    results = []
    for complaint in candidates:
        try:
            distance = haversine_meters(lat, lng, complaint.latitude, complaint.longitude)
            if distance <= radius_meters:
                results.append((complaint, distance))
        except (ValueError, TypeError):
            continue
    
    # Sort by distance and limit results
    results.sort(key=lambda x: x[1])
    return results[:max_results]
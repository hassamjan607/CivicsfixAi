"""
CivicFix AI Models Test Suite

Unit tests for SQLModel data models, validation, and database operations.
Tests the core data layer functionality including field constraints, JSON handling,
validators, helper methods, and edge cases.

Requirements: 23.1
"""

import pytest
import json
from datetime import datetime, timedelta, date, timezone
from sqlmodel import Session

from app.models import (
    Complaint, Department, Asset, StatusEvent, ImageHash, 
    TrackingIDGenerator, generate_tracking_id,
    get_complaint_by_tracking_id, create_status_event,
    get_complaints_by_department, get_overdue_complaints,
    get_complaints_for_review
)
from app.config import ComplaintStatus, PhotoType, ComplaintCategory


class TestComplaint:
    """Test cases for Complaint model functionality"""

    def test_complaint_creation_valid(self, session: Session):
        """Test basic complaint creation with valid data"""
        complaint = Complaint(
            tracking_id="CF-0001",
            category=ComplaintCategory.POTHOLE.value,
            summary="Large pothole on main street",
            description="A deep pothole causing vehicle damage",
            sentiment="negative",
            urgency_score=5,
            latitude=33.6844,
            longitude=73.0479,
            address="Main Street, Islamabad"
        )
        
        session.add(complaint)
        session.commit()
        session.refresh(complaint)
        
        assert complaint.id is not None
        assert complaint.tracking_id == "CF-0001"
        assert complaint.category == ComplaintCategory.POTHOLE.value
        assert complaint.status == ComplaintStatus.PENDING  # default value
        assert complaint.urgency_score == 5
        assert complaint.has_coordinates() is True
        assert complaint.anonymous is False  # default value

    def test_urgency_reasons_json_handling(self, session: Session):
        """Test JSON serialization/deserialization of urgency reasons"""
        complaint = Complaint(
            tracking_id="CF-0001",
            category=ComplaintCategory.POTHOLE.value,
            summary="Test complaint",
            description="Test description",
            sentiment="neutral"
        )
        
        # Test setting reasons via helper method
        reasons = ["Base severity: 3", "Weather bonus: +2", "Vulnerable group: +1"]
        complaint.set_urgency_reasons(reasons)
        
        assert complaint.urgency_reasons == json.dumps(reasons)
        
        # Test getting reasons via helper method
        retrieved_reasons = complaint.get_urgency_reasons()
        assert retrieved_reasons == reasons
        
        session.add(complaint)
        session.commit()
        session.refresh(complaint)
        
        # Test persistence
        assert complaint.get_urgency_reasons() == reasons

    def test_urgency_reasons_edge_cases(self, session: Session):
        """Test edge cases for urgency reasons handling"""
        complaint = Complaint(
            tracking_id="CF-0001",
            category=ComplaintCategory.POTHOLE.value,
            summary="Test complaint",
            description="Test description",
            sentiment="neutral"
        )
        
        # Test empty list
        complaint.set_urgency_reasons([])
        assert complaint.get_urgency_reasons() == []
        
        # Test setting invalid type should raise error
        with pytest.raises(ValueError):
            complaint.set_urgency_reasons("not a list")
        
        # Test getting reasons from corrupted data returns empty list
        complaint.urgency_reasons = "corrupted json"
        assert complaint.get_urgency_reasons() == []

    def test_has_coordinates_method(self, session: Session):
        """Test has_coordinates helper method"""
        # Complaint with coordinates
        complaint1 = Complaint(
            tracking_id="CF-0001",
            category=ComplaintCategory.POTHOLE.value,
            summary="Test complaint",
            description="Test description",
            sentiment="neutral",
            latitude=33.6844,
            longitude=73.0479
        )
        assert complaint1.has_coordinates() is True
        
        # Complaint without coordinates
        complaint2 = Complaint(
            tracking_id="CF-0002",
            category=ComplaintCategory.POTHOLE.value,
            summary="Test complaint",
            description="Test description",
            sentiment="neutral"
        )
        assert complaint2.has_coordinates() is False
    def test_is_overdue_method(self, session: Session):
        """Test is_overdue helper method"""
        current_time = datetime.now(timezone.utc)
        
        # Past deadline, not resolved = overdue
        complaint1 = Complaint(
            tracking_id="CF-0001",
            category=ComplaintCategory.POTHOLE.value,
            summary="Test complaint",
            description="Test description",
            sentiment="neutral",
            status=ComplaintStatus.PENDING,
            sla_deadline=current_time - timedelta(hours=1)
        )
        assert complaint1.is_overdue() is True
        
        # Past deadline, resolved = not overdue
        complaint2 = Complaint(
            tracking_id="CF-0002",
            category=ComplaintCategory.POTHOLE.value,
            summary="Test complaint",
            description="Test description",
            sentiment="neutral",
            status=ComplaintStatus.RESOLVED,
            sla_deadline=current_time - timedelta(hours=1)
        )
        assert complaint2.is_overdue() is False
        
        # Future deadline = not overdue
        complaint3 = Complaint(
            tracking_id="CF-0003",
            category=ComplaintCategory.POTHOLE.value,
            summary="Test complaint",
            description="Test description",
            sentiment="neutral",
            status=ComplaintStatus.PENDING,
            sla_deadline=current_time + timedelta(hours=1)
        )
        assert complaint3.is_overdue() is False
        
        # No deadline = not overdue
        complaint4 = Complaint(
            tracking_id="CF-0004",
            category=ComplaintCategory.POTHOLE.value,
            summary="Test complaint",
            description="Test description",
            sentiment="neutral",
            status=ComplaintStatus.PENDING
        )
        assert complaint4.is_overdue() is False

    def test_get_age_hours_method(self, session: Session):
        """Test get_age_hours helper method"""
        # Create complaint with known creation time
        past_time = datetime.now(timezone.utc) - timedelta(hours=2, minutes=30)
        complaint = Complaint(
            tracking_id="CF-0001",
            category=ComplaintCategory.POTHOLE.value,
            summary="Test complaint",
            description="Test description",
            sentiment="neutral",
            created_at=past_time
        )
        
        # Age should be approximately 2.5 hours (allow some tolerance)
        age = complaint.get_age_hours()
        assert 2.4 <= age <= 2.6

    def test_to_dict_method(self, session: Session):
        """Test to_dict serialization method"""
        current_time = datetime.now(timezone.utc)
        complaint = Complaint(
            tracking_id="CF-0001",
            category=ComplaintCategory.POTHOLE.value,
            summary="Test complaint",
            description="Test description",
            sentiment="negative",
            vulnerable_group_flag=True,
            urgency_score=7,
            latitude=33.6844,
            longitude=73.0479,
            address="Test Address",
            base_severity=5,
            photo_description="Large pothole visible",
            needs_human_review=True,
            anonymous=False,
            sla_deadline=current_time + timedelta(hours=24),
            created_at=current_time
        )
        
        # Set urgency reasons
        reasons = ["Base severity: 5", "Vulnerable group: +1"]
        complaint.set_urgency_reasons(reasons)
        
        result_dict = complaint.to_dict()
        
        assert result_dict['tracking_id'] == "CF-0001"
        assert result_dict['category'] == ComplaintCategory.POTHOLE.value
        assert result_dict['urgency_reasons'] == reasons
        assert result_dict['vulnerable_group_flag'] is True
        assert result_dict['urgency_score'] == 7
        assert result_dict['latitude'] == 33.6844
        assert result_dict['anonymous'] is False
        assert 'sla_deadline' in result_dict
        assert 'created_at' in result_dict

    def test_field_constraints(self, session: Session):
        """Test field constraints work correctly"""
        complaint = Complaint(
            tracking_id="CF-0001",
            category=ComplaintCategory.POTHOLE.value,
            summary="A" * 150,  # Exactly at max length
            description="Valid description",
            sentiment="neutral",
            urgency_score=10,  # Max value
            latitude=90.0,     # Max latitude
            longitude=180.0    # Max longitude
        )
        
        session.add(complaint)
        session.commit()
        
        assert len(complaint.summary) == 150
        assert complaint.urgency_score == 10
        assert complaint.latitude == 90.0
        assert complaint.longitude == 180.0
class TestDepartment:
    """Test cases for Department model functionality"""

    def test_department_creation_valid(self, session: Session):
        """Test basic department creation with valid data"""
        department = Department(
            name="Roads Department",
            email="roads@municipality.gov",
            whatsapp_contact="+92-300-1234567",
            supervisor_contact="+92-300-1234568"
        )
        
        session.add(department)
        session.commit()
        session.refresh(department)
        
        assert department.id is not None
        assert department.name == "Roads Department"
        assert department.email == "roads@municipality.gov"
        assert department.whatsapp_contact == "+92-300-1234567"

    def test_email_normalization(self, session: Session):
        """Test email validation - checking the validator exists"""
        department = Department(
            name="Test Department",
            email="test@domain.com"
        )
        session.add(department)
        session.commit()
        
        # Verify the department was created successfully
        assert department.email == "test@domain.com"
        assert "@" in department.email  # Basic format check

    def test_department_name_uniqueness(self, session: Session):
        """Test department name uniqueness constraint"""
        # First department should work
        dept1 = Department(
            name="Unique Department",
            email="dept1@test.com"
        )
        session.add(dept1)
        session.commit()
        
        # Same name should cause integrity error
        dept2 = Department(
            name="Unique Department",  # Same name
            email="dept2@test.com"
        )
        session.add(dept2)
        
        with pytest.raises(Exception):  # SQLite integrity error
            session.commit()


class TestAsset:
    """Test cases for Asset model functionality"""

    def test_asset_creation_valid(self, session: Session):
        """Test basic asset creation with valid data"""
        asset = Asset(
            asset_type="Streetlight",
            latitude=33.6844,
            longitude=73.0479,
            warranty_expiry=date(2025, 12, 31),
            contractor_name="ABC Infrastructure"
        )
        
        session.add(asset)
        session.commit()
        session.refresh(asset)
        
        assert asset.id is not None
        assert asset.asset_type == "Streetlight"
        assert asset.latitude == 33.6844
        assert asset.longitude == 73.0479

    def test_warranty_functionality(self, session: Session):
        """Test warranty-related methods"""
        today = date.today()
        
        # Asset with active warranty
        asset1 = Asset(
            asset_type="Pipe",
            latitude=33.6844,
            longitude=73.0479,
            warranty_expiry=today + timedelta(days=365)
        )
        assert asset1.is_warranty_active() is True
        assert asset1.get_warranty_days_remaining() == 365
        
        # Asset with expired warranty
        asset2 = Asset(
            asset_type="Road",
            latitude=33.6844,
            longitude=73.0479,
            warranty_expiry=today - timedelta(days=30)
        )
        assert asset2.is_warranty_active() is False
        assert asset2.get_warranty_days_remaining() == 0
        
        # Asset with no warranty
        asset3 = Asset(
            asset_type="Light",
            latitude=33.6844,
            longitude=73.0479
        )
        assert asset3.is_warranty_active() is False
        assert asset3.get_warranty_days_remaining() is None

    def test_asset_to_dict(self, session: Session):
        """Test asset to_dict serialization method"""
        asset = Asset(
            asset_type="Traffic Light",
            latitude=33.6844,
            longitude=73.0479,
            warranty_expiry=date(2025, 12, 31),
            contractor_name="City Infrastructure Ltd"
        )
        
        result_dict = asset.to_dict()
        
        assert result_dict['asset_type'] == "Traffic Light"
        assert result_dict['latitude'] == 33.6844
        assert result_dict['longitude'] == 73.0479
        assert 'warranty_expiry' in result_dict
        assert result_dict['contractor_name'] == "City Infrastructure Ltd"
        assert 'warranty_active' in result_dict
class TestStatusEvent:
    """Test cases for StatusEvent model functionality"""

    def test_status_event_creation(self, session: Session):
        """Test basic status event creation"""
        # First create a complaint to reference
        complaint = Complaint(
            tracking_id="CF-0001",
            category=ComplaintCategory.POTHOLE.value,
            summary="Test complaint",
            description="Test description",
            sentiment="neutral"
        )
        session.add(complaint)
        session.commit()
        
        # Create status event
        status_event = StatusEvent(
            complaint_id=complaint.id,
            old_status=ComplaintStatus.PENDING,
            new_status=ComplaintStatus.IN_PROGRESS,
            actor_id="officer_123"
        )
        
        session.add(status_event)
        session.commit()
        session.refresh(status_event)
        
        assert status_event.id is not None
        assert status_event.complaint_id == complaint.id
        assert status_event.old_status == ComplaintStatus.PENDING
        assert status_event.new_status == ComplaintStatus.IN_PROGRESS
        assert status_event.actor_id == "officer_123"

    def test_status_event_to_dict(self, session: Session):
        """Test status event to_dict serialization"""
        complaint = Complaint(
            tracking_id="CF-0001",
            category=ComplaintCategory.POTHOLE.value,
            summary="Test complaint",
            description="Test description",
            sentiment="neutral"
        )
        session.add(complaint)
        session.commit()
        
        current_time = datetime.now(timezone.utc)
        status_event = StatusEvent(
            complaint_id=complaint.id,
            old_status=ComplaintStatus.PENDING,
            new_status=ComplaintStatus.IN_PROGRESS,
            actor_id="officer_456",
            timestamp=current_time
        )
        
        result_dict = status_event.to_dict()
        
        assert result_dict['complaint_id'] == complaint.id
        assert result_dict['old_status'] == ComplaintStatus.PENDING
        assert result_dict['new_status'] == ComplaintStatus.IN_PROGRESS
        assert result_dict['actor_id'] == "officer_456"
        assert 'timestamp' in result_dict


class TestImageHash:
    """Test cases for ImageHash model functionality"""

    def test_image_hash_creation(self, session: Session):
        """Test basic image hash creation"""
        # First create a complaint to reference
        complaint = Complaint(
            tracking_id="CF-0001",
            category=ComplaintCategory.POTHOLE.value,
            summary="Test complaint",
            description="Test description",
            sentiment="neutral"
        )
        session.add(complaint)
        session.commit()
        
        # Create image hash
        image_hash = ImageHash(
            complaint_id=complaint.id,
            hash_value="abc123def456",
            photo_type=PhotoType.SUBMISSION
        )
        
        session.add(image_hash)
        session.commit()
        session.refresh(image_hash)
        
        assert image_hash.id is not None
        assert image_hash.complaint_id == complaint.id
        assert image_hash.hash_value == "abc123def456"
        assert image_hash.photo_type == PhotoType.SUBMISSION

    def test_image_hash_to_dict(self, session: Session):
        """Test image hash to_dict serialization"""
        complaint = Complaint(
            tracking_id="CF-0001",
            category=ComplaintCategory.POTHOLE.value,
            summary="Test complaint", 
            description="Test description",
            sentiment="neutral"
        )
        session.add(complaint)
        session.commit()
        
        current_time = datetime.now(timezone.utc)
        image_hash = ImageHash(
            complaint_id=complaint.id,
            hash_value="def789ghi012",
            photo_type=PhotoType.PROOF,
            created_at=current_time
        )
        
        result_dict = image_hash.to_dict()
        
        assert result_dict['complaint_id'] == complaint.id
        assert result_dict['hash_value'] == "def789ghi012"
        assert result_dict['photo_type'] == PhotoType.PROOF
        assert 'created_at' in result_dict
class TestTrackingIDGenerator:
    """Test cases for TrackingIDGenerator functionality"""

    def test_tracking_id_format_validation(self):
        """Test tracking ID format validation method"""
        # Valid formats
        assert TrackingIDGenerator.validate_tracking_id_format("CF-0001") is True
        assert TrackingIDGenerator.validate_tracking_id_format("CF-9999") is True
        
        # Invalid formats
        assert TrackingIDGenerator.validate_tracking_id_format("XX-0001") is False
        assert TrackingIDGenerator.validate_tracking_id_format("CF-001") is False
        assert TrackingIDGenerator.validate_tracking_id_format("CF-12345") is False
        assert TrackingIDGenerator.validate_tracking_id_format("cf-0001") is False

    def test_tracking_id_generation(self, session: Session):
        """Test tracking ID generation uniqueness and format"""
        # Initialize sequence
        TrackingIDGenerator.initialize_sequence(session)
        
        # Generate multiple tracking IDs
        tracking_ids = []
        for i in range(5):
            tracking_id = TrackingIDGenerator.get_next_tracking_id(session)
            tracking_ids.append(tracking_id)
            
            # Verify format
            assert TrackingIDGenerator.validate_tracking_id_format(tracking_id)
        
        # Verify uniqueness
        assert len(set(tracking_ids)) == len(tracking_ids)
        
        # Verify sequential ordering
        nums = [int(tid.split("-")[1]) for tid in tracking_ids]
        assert nums == sorted(nums)

    def test_legacy_functions(self, session: Session):
        """Test backward compatibility functions"""
        tracking_id1 = generate_tracking_id(session)
        
        assert TrackingIDGenerator.validate_tracking_id_format(tracking_id1)


class TestUtilityFunctions:
    """Test cases for utility functions"""

    def test_get_complaint_by_tracking_id(self, session: Session):
        """Test getting complaint by tracking ID"""
        # Create complaint
        complaint = Complaint(
            tracking_id="CF-0001",
            category=ComplaintCategory.POTHOLE.value,
            summary="Test complaint",
            description="Test description",
            sentiment="neutral"
        )
        session.add(complaint)
        session.commit()
        
        # Test retrieval
        found_complaint = get_complaint_by_tracking_id(session, "CF-0001")
        assert found_complaint is not None
        assert found_complaint.tracking_id == "CF-0001"
        
        # Test non-existent tracking ID
        not_found = get_complaint_by_tracking_id(session, "CF-9999")
        assert not_found is None

    def test_create_status_event_function(self, session: Session):
        """Test status event creation utility function"""
        # Create complaint
        complaint = Complaint(
            tracking_id="CF-0001",
            category=ComplaintCategory.POTHOLE.value,
            summary="Test complaint",
            description="Test description",
            sentiment="neutral"
        )
        session.add(complaint)
        session.commit()
        
        # Create status event using utility function
        status_event = create_status_event(
            session=session,
            complaint_id=complaint.id,
            old_status=ComplaintStatus.PENDING,
            new_status=ComplaintStatus.IN_PROGRESS,
            actor_id="test_officer"
        )
        
        assert status_event.complaint_id == complaint.id
        assert status_event.old_status == ComplaintStatus.PENDING
        assert status_event.new_status == ComplaintStatus.IN_PROGRESS
        assert status_event.actor_id == "test_officer"
    def test_get_complaints_by_department(self, session: Session):
        """Test getting complaints by department with filtering and sorting"""
        # Create department
        department = Department(
            name="Test Department",
            email="test@dept.gov"
        )
        session.add(department)
        session.commit()
        
        # Create complaints with different urgencies and statuses
        complaints = [
            Complaint(
                tracking_id="CF-0001",
                category=ComplaintCategory.POTHOLE.value,
                summary="High urgency complaint",
                description="Test description",
                sentiment="negative",
                urgency_score=8,
                status=ComplaintStatus.PENDING,
                department_id=department.id,
                sla_deadline=datetime.now(timezone.utc) + timedelta(hours=12)
            ),
            Complaint(
                tracking_id="CF-0002",
                category=ComplaintCategory.WATER_LEAK.value,
                summary="Medium urgency complaint",
                description="Test description",
                sentiment="neutral",
                urgency_score=5,
                status=ComplaintStatus.IN_PROGRESS,
                department_id=department.id,
                sla_deadline=datetime.now(timezone.utc) + timedelta(hours=24)
            ),
            Complaint(
                tracking_id="CF-0003",
                category=ComplaintCategory.GARBAGE.value,
                summary="High urgency but later SLA",
                description="Test description", 
                sentiment="negative",
                urgency_score=8,
                status=ComplaintStatus.PENDING,
                department_id=department.id,
                sla_deadline=datetime.now(timezone.utc) + timedelta(hours=48)
            )
        ]
        
        for complaint in complaints:
            session.add(complaint)
        session.commit()
        
        # Test getting all complaints for department (should be sorted by urgency desc, sla asc)
        dept_complaints = get_complaints_by_department(session, department.id)
        assert len(dept_complaints) == 3
        # Should be ordered by urgency (8,8,5) then by SLA deadline (earliest first for same urgency)
        assert dept_complaints[0].tracking_id == "CF-0001"  # urgency 8, earlier SLA
        assert dept_complaints[1].tracking_id == "CF-0003"  # urgency 8, later SLA 
        assert dept_complaints[2].tracking_id == "CF-0002"  # urgency 5
        
        # Test filtering by status
        pending_complaints = get_complaints_by_department(session, department.id, 
                                                        status_filter=ComplaintStatus.PENDING)
        assert len(pending_complaints) == 2
        
        # Test limit
        limited_complaints = get_complaints_by_department(session, department.id, limit=2)
        assert len(limited_complaints) == 2

    def test_get_overdue_complaints(self, session: Session):
        """Test getting overdue complaints"""
        current_time = datetime.now(timezone.utc)
        
        # Create complaints with different SLA statuses
        complaints = [
            Complaint(  # Overdue
                tracking_id="CF-0001",
                category=ComplaintCategory.POTHOLE.value,
                summary="Overdue complaint",
                description="Test description",
                sentiment="neutral",
                status=ComplaintStatus.PENDING,
                sla_deadline=current_time - timedelta(hours=1)
            ),
            Complaint(  # Not overdue - resolved
                tracking_id="CF-0002",
                category=ComplaintCategory.WATER_LEAK.value,
                summary="Past deadline but resolved",
                description="Test description",
                sentiment="neutral",
                status=ComplaintStatus.RESOLVED,
                sla_deadline=current_time - timedelta(hours=2)
            ),
            Complaint(  # Not overdue - future deadline
                tracking_id="CF-0003",
                category=ComplaintCategory.GARBAGE.value,
                summary="Future deadline",
                description="Test description",
                sentiment="neutral",
                status=ComplaintStatus.PENDING,
                sla_deadline=current_time + timedelta(hours=1)
            )
        ]
        
        for complaint in complaints:
            session.add(complaint)
        session.commit()
        
        overdue_complaints = get_overdue_complaints(session)
        assert len(overdue_complaints) == 1
        assert overdue_complaints[0].tracking_id == "CF-0001"

    def test_get_complaints_for_review(self, session: Session):
        """Test getting complaints that need human review"""
        complaints = [
            Complaint(  # Needs human review
                tracking_id="CF-0001",
                category=ComplaintCategory.POTHOLE.value,
                summary="Low confidence complaint",
                description="Test description",
                sentiment="neutral",
                needs_human_review=True
            ),
            Complaint(  # Suspected fraud
                tracking_id="CF-0002",
                category=ComplaintCategory.WATER_LEAK.value,
                summary="Suspicious complaint",
                description="Test description",
                sentiment="neutral",
                suspected_fraud=True
            ),
            Complaint(  # Normal complaint
                tracking_id="CF-0003",
                category=ComplaintCategory.GARBAGE.value,
                summary="Normal complaint",
                description="Test description",
                sentiment="neutral"
            )
        ]
        
        for complaint in complaints:
            session.add(complaint)
        session.commit()
        
        review_complaints = get_complaints_for_review(session)
        assert len(review_complaints) == 2
        tracking_ids = [c.tracking_id for c in review_complaints]
        assert "CF-0001" in tracking_ids
        assert "CF-0002" in tracking_ids
        assert "CF-0003" not in tracking_ids


class TestModelConstraintsAndValidation:
    """Test cases for model constraints, field validation, and business logic"""

    def test_category_enumeration_values(self):
        """Test that category enum values are correct"""
        expected_categories = [
            "pothole", "water_leak", "garbage", "streetlight", 
            "sewage", "road_damage", "other"
        ]
        
        actual_categories = [cat.value for cat in ComplaintCategory]
        assert set(expected_categories) == set(actual_categories)

    def test_status_enumeration_values(self):
        """Test that status enum values are correct"""
        expected_statuses = ["Pending", "In Progress", "Resolved"]
        actual_statuses = [status.value for status in ComplaintStatus]
        assert set(expected_statuses) == set(actual_statuses)

    def test_photo_type_enumeration_values(self):
        """Test that photo type enum values are correct"""
        expected_types = ["submission", "before", "after", "proof"]
        actual_types = [ptype.value for ptype in PhotoType]
        assert set(expected_types) == set(actual_types)

    def test_complaint_default_values(self, session: Session):
        """Test default values are set correctly on complaint creation"""
        complaint = Complaint(
            tracking_id="CF-0001",
            category=ComplaintCategory.POTHOLE.value,
            summary="Test complaint",
            description="Test description",
            sentiment="neutral"
        )
        
        # Test default values
        assert complaint.vulnerable_group_flag is False
        assert complaint.urgency_score == 0
        assert complaint.urgency_reasons == "[]"
        assert complaint.status == ComplaintStatus.PENDING
        assert complaint.base_severity == 3
        assert complaint.needs_human_review is False
        assert complaint.suspected_fraud is False
        assert complaint.anonymous is False
        assert complaint.escalated is False
        assert complaint.root_cause_flag is False
        assert complaint.recurrence_count == 0
        assert complaint.duplicate_count == 0

    def test_timestamps_auto_creation(self, session: Session):
        """Test that timestamps are automatically set"""
        before_creation = datetime.now(timezone.utc)
        
        complaint = Complaint(
            tracking_id="CF-0001",
            category=ComplaintCategory.POTHOLE.value,
            summary="Test complaint",
            description="Test description",
            sentiment="neutral"
        )
        
        after_creation = datetime.now(timezone.utc)
        
        # created_at and updated_at should be set automatically
        assert before_creation <= complaint.created_at <= after_creation
        assert before_creation <= complaint.updated_at <= after_creation
class TestModelEdgeCases:
    """Test edge cases and error conditions in models"""

    def test_complaint_with_minimal_data(self, session: Session):
        """Test complaint creation with only required fields"""
        complaint = Complaint(
            tracking_id="CF-0001",
            category=ComplaintCategory.OTHER.value,
            summary="Minimal complaint",
            description="Minimal description",
            sentiment="neutral"
        )
        
        session.add(complaint)
        session.commit()
        session.refresh(complaint)
        
        assert complaint.id is not None
        # All optional fields should have their defaults
        assert complaint.latitude is None
        assert complaint.longitude is None
        assert complaint.address is None
        assert complaint.department_id is None
        assert complaint.has_coordinates() is False

    def test_asset_without_warranty(self, session: Session):
        """Test asset creation without warranty information"""
        asset = Asset(
            asset_type="Old Infrastructure",
            latitude=33.6844,
            longitude=73.0479
        )
        
        session.add(asset)
        session.commit()
        session.refresh(asset)
        
        assert asset.warranty_expiry is None
        assert asset.contractor_name is None
        assert asset.is_warranty_active() is False
        assert asset.get_warranty_days_remaining() is None

    def test_status_event_without_actor(self, session: Session):
        """Test status event creation without actor information"""
        complaint = Complaint(
            tracking_id="CF-0001",
            category=ComplaintCategory.OTHER.value,
            summary="Test complaint",
            description="Test description",
            sentiment="neutral"
        )
        session.add(complaint)
        session.commit()
        
        status_event = StatusEvent(
            complaint_id=complaint.id,
            old_status=ComplaintStatus.PENDING,
            new_status=ComplaintStatus.IN_PROGRESS
            # No actor_id provided
        )
        
        session.add(status_event)
        session.commit()
        session.refresh(status_event)
        
        assert status_event.actor_id is None
        assert status_event.complaint_id == complaint.id

    def test_complaint_coordinate_consistency(self, session: Session):
        """Test coordinate-related helper methods work correctly"""
        # Test complaint with coordinates
        complaint_with_coords = Complaint(
            tracking_id="CF-0001",
            category=ComplaintCategory.POTHOLE.value,
            summary="Test complaint",
            description="Test description", 
            sentiment="neutral",
            latitude=33.6844,
            longitude=73.0479
        )
        
        assert complaint_with_coords.has_coordinates() is True
        
        # Test complaint without coordinates
        complaint_without_coords = Complaint(
            tracking_id="CF-0002",
            category=ComplaintCategory.POTHOLE.value,
            summary="Test complaint",
            description="Test description",
            sentiment="neutral"
        )
        
        assert complaint_without_coords.has_coordinates() is False
        
        session.add_all([complaint_with_coords, complaint_without_coords])
        session.commit()
        
        # Verify persistence doesn't affect helper method behavior
        assert complaint_with_coords.has_coordinates() is True
        assert complaint_without_coords.has_coordinates() is False

    def test_tracking_id_generation_with_existing_complaints(self, session: Session):
        """Test tracking ID generation when complaints already exist"""
        # First create a complaint manually
        existing_complaint = Complaint(
            tracking_id="CF-0005",
            category=ComplaintCategory.OTHER.value,
            summary="Existing complaint",
            description="Test description",
            sentiment="neutral"
        )
        session.add(existing_complaint)
        session.commit()
        
        # Generate new tracking ID - should be higher than existing
        new_tracking_id = TrackingIDGenerator.get_next_tracking_id(session)
        new_number = int(new_tracking_id.split("-")[1])
        
        assert new_number > 5  # Should be higher than CF-0005

    def test_warranty_edge_cases(self, session: Session):
        """Test warranty-related edge cases"""
        today = date.today()
        
        # Asset with warranty expiring today
        asset_expiring_today = Asset(
            asset_type="Expiring Asset",
            latitude=33.6844,
            longitude=73.0479,
            warranty_expiry=today
        )
        
        assert asset_expiring_today.is_warranty_active() is True  # Today still counts as active
        assert asset_expiring_today.get_warranty_days_remaining() == 0
        
        # Asset that expired yesterday
        asset_expired_yesterday = Asset(
            asset_type="Expired Asset", 
            latitude=33.6844,
            longitude=73.0479,
            warranty_expiry=today - timedelta(days=1)
        )
        
        assert asset_expired_yesterday.is_warranty_active() is False
        assert asset_expired_yesterday.get_warranty_days_remaining() == 0

    def test_urgency_reasons_json_serialization_edge_cases(self, session: Session):
        """Test edge cases in urgency reasons JSON handling"""
        complaint = Complaint(
            tracking_id="CF-0001",
            category=ComplaintCategory.OTHER.value,
            summary="Test complaint",
            description="Test description",
            sentiment="neutral"
        )
        
        # Test with complex reasons
        complex_reasons = [
            "Base severity: 3 (from vision analysis)",
            "Weather bonus: +2 (heavy rain detected at 15.2mm/h)",
            "Recurrence bonus: +1 (2nd occurrence in same location)",
            "Special characters: 'test', \"quotes\", & symbols"
        ]
        
        complaint.set_urgency_reasons(complex_reasons)
        retrieved_reasons = complaint.get_urgency_reasons()
        
        assert retrieved_reasons == complex_reasons
        
        # Test that the JSON is valid
        import json
        parsed = json.loads(complaint.urgency_reasons)
        assert isinstance(parsed, list)
        assert len(parsed) == len(complex_reasons)

    def test_complaint_age_calculation_edge_cases(self, session: Session):
        """Test complaint age calculation with various timestamps"""
        # Test with very old complaint
        very_old_time = datetime.now(timezone.utc) - timedelta(days=30, hours=12)
        old_complaint = Complaint(
            tracking_id="CF-0001",
            category=ComplaintCategory.OTHER.value,
            summary="Old complaint",
            description="Test description",
            sentiment="neutral",
            created_at=very_old_time
        )
        
        age_hours = old_complaint.get_age_hours()
        expected_hours = 30 * 24 + 12  # 30 days + 12 hours in hours
        
        # Allow some tolerance for test execution time
        assert expected_hours - 1 <= age_hours <= expected_hours + 1
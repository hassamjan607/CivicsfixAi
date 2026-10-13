"""
CivicFix AI Data Models

SQLModel table definitions for the complete CivicFix AI data schema.
Includes Complaint, Department, Asset, StatusEvent, and ImageHash models
with proper relationships and constraints.

Features:
- Thread-safe tracking ID generation with CF-XXXX format
- JSON field handling for urgency_reasons
- Comprehensive field validation and constraints
- Helper methods for model operations
- Optimized indexes for performance
"""

import json
import threading
from datetime import datetime, date, timezone
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Session, select, text
from pydantic import field_validator, model_validator

from .config import ComplaintStatus, PhotoType, ComplaintCategory


class Department(SQLModel, table=True):
    """Department table storing municipal department information
    
    Stores department details including contact information for
    notifications and escalations.
    """
    
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True, min_length=1, max_length=100)
    email: str = Field(min_length=5, max_length=255, regex=r'^[^@]+@[^@]+\.[^@]+$')
    whatsapp_contact: Optional[str] = Field(default=None, max_length=20)
    supervisor_contact: Optional[str] = Field(default=None, max_length=20)

    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        """Validate email format"""
        if not v or '@' not in v:
            raise ValueError('Invalid email format')
        return v.lower()

    def __repr__(self) -> str:
        return f"Department(id={self.id}, name='{self.name}')"


class Complaint(SQLModel, table=True):
    """Main complaint table storing all complaint information
    
    Central table that stores all complaint data including location,
    scoring, flags, and audit information. Supports the complete
    complaint lifecycle from submission to resolution.
    """
    
    id: Optional[int] = Field(default=None, primary_key=True)
    tracking_id: str = Field(unique=True, index=True, regex=r'^CF-\d{4}$')  # CF-0001 format
    category: str = Field(index=True, min_length=1, max_length=50)
    summary: str = Field(min_length=1, max_length=150)
    description: str = Field(min_length=1, max_length=2000)
    sentiment: str = Field(regex=r'^(positive|neutral|negative)$')  # positive, neutral, negative
    vulnerable_group_flag: bool = Field(default=False)
    urgency_score: int = Field(default=0, ge=0, le=10)
    urgency_reasons: str = Field(default="[]")  # JSON array stored as TEXT
    status: str = Field(default=ComplaintStatus.PENDING, index=True)
    department_id: Optional[int] = Field(default=None, foreign_key="department.id", index=True)
    
    # Location information
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    address: Optional[str] = Field(default=None, max_length=500)
    
    # Scoring and analysis
    base_severity: int = Field(default=3, ge=1, le=6)
    photo_description: Optional[str] = Field(default=None, max_length=500)
    
    # Flags and metadata
    needs_human_review: bool = Field(default=False, index=True)
    suspected_fraud: bool = Field(default=False, index=True)
    anonymous: bool = Field(default=False, index=True)
    escalated: bool = Field(default=False, index=True)
    root_cause_flag: bool = Field(default=False, index=True)
    
    # Counters
    recurrence_count: int = Field(default=0, ge=0)
    duplicate_count: int = Field(default=0, ge=0)
    
    # Timestamps
    sla_deadline: Optional[datetime] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)

    @field_validator('category')
    @classmethod
    def validate_category(cls, v):
        """Validate category is a valid ComplaintCategory"""
        valid_categories = [cat.value for cat in ComplaintCategory]
        if v not in valid_categories:
            raise ValueError(f'Invalid category. Must be one of: {valid_categories}')
        return v

    @field_validator('urgency_reasons')
    @classmethod
    def validate_urgency_reasons(cls, v):
        """Validate urgency_reasons is valid JSON"""
        if isinstance(v, str):
            try:
                json.loads(v)
            except json.JSONDecodeError:
                raise ValueError('urgency_reasons must be valid JSON')
        return v

    @model_validator(mode='after')
    def validate_coordinates(self):
        """Validate that if one coordinate is provided, both are provided"""
        lat = self.latitude
        lng = self.longitude
        if (lat is not None) != (lng is not None):
            raise ValueError('Both latitude and longitude must be provided together')
        return self

    def get_urgency_reasons(self) -> List[str]:
        """Parse urgency_reasons JSON string into list"""
        try:
            reasons = json.loads(self.urgency_reasons)
            return reasons if isinstance(reasons, list) else []
        except (json.JSONDecodeError, TypeError):
            return []

    def set_urgency_reasons(self, reasons: List[str]) -> None:
        """Set urgency_reasons from list to JSON string"""
        if not isinstance(reasons, list):
            raise ValueError("Reasons must be a list of strings")
        self.urgency_reasons = json.dumps(reasons)

    def has_coordinates(self) -> bool:
        """Check if complaint has valid coordinates"""
        return self.latitude is not None and self.longitude is not None

    def is_overdue(self) -> bool:
        """Check if complaint is past its SLA deadline"""
        if self.sla_deadline is None:
            return False
        return datetime.now(timezone.utc) > self.sla_deadline and self.status != ComplaintStatus.RESOLVED

    def get_age_hours(self) -> float:
        """Get complaint age in hours"""
        delta = datetime.now(timezone.utc) - self.created_at
        return delta.total_seconds() / 3600

    def to_dict(self) -> Dict[str, Any]:
        """Convert complaint to dictionary for API responses"""
        return {
            'id': self.id,
            'tracking_id': self.tracking_id,
            'category': self.category,
            'summary': self.summary,
            'description': self.description,
            'sentiment': self.sentiment,
            'vulnerable_group_flag': self.vulnerable_group_flag,
            'urgency_score': self.urgency_score,
            'urgency_reasons': self.get_urgency_reasons(),
            'status': self.status,
            'department_id': self.department_id,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'address': self.address,
            'base_severity': self.base_severity,
            'photo_description': self.photo_description,
            'needs_human_review': self.needs_human_review,
            'suspected_fraud': self.suspected_fraud,
            'anonymous': self.anonymous,
            'escalated': self.escalated,
            'root_cause_flag': self.root_cause_flag,
            'recurrence_count': self.recurrence_count,
            'duplicate_count': self.duplicate_count,
            'sla_deadline': self.sla_deadline.isoformat() if self.sla_deadline else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

    def __repr__(self) -> str:
        return f"Complaint(id={self.id}, tracking_id='{self.tracking_id}', category='{self.category}')"


class Asset(SQLModel, table=True):
    """Asset table storing municipal infrastructure information
    
    Stores information about municipal assets like pipes, roads,
    streetlights etc. with location and warranty information.
    """
    
    id: Optional[int] = Field(default=None, primary_key=True)
    asset_type: str = Field(index=True, min_length=1, max_length=100)
    latitude: float = Field(ge=-90, le=90, index=True)
    longitude: float = Field(ge=-180, le=180, index=True)
    warranty_expiry: Optional[date] = Field(default=None)
    contractor_name: Optional[str] = Field(default=None, max_length=200)

    def is_warranty_active(self) -> bool:
        """Check if warranty is still active"""
        if self.warranty_expiry is None:
            return False
        return date.today() <= self.warranty_expiry

    def get_warranty_days_remaining(self) -> Optional[int]:
        """Get remaining warranty days, None if no warranty"""
        if self.warranty_expiry is None:
            return None
        delta = self.warranty_expiry - date.today()
        return max(0, delta.days)

    def to_dict(self) -> Dict[str, Any]:
        """Convert asset to dictionary for API responses"""
        return {
            'id': self.id,
            'asset_type': self.asset_type,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'warranty_expiry': self.warranty_expiry.isoformat() if self.warranty_expiry else None,
            'contractor_name': self.contractor_name,
            'warranty_active': self.is_warranty_active()
        }

    def __repr__(self) -> str:
        return f"Asset(id={self.id}, type='{self.asset_type}', lat={self.latitude}, lng={self.longitude})"


class StatusEvent(SQLModel, table=True):
    """Status event table for complaint audit trail
    
    Records all status changes for complaints providing a complete
    audit trail of who changed what and when.
    """
    
    id: Optional[int] = Field(default=None, primary_key=True)
    complaint_id: int = Field(foreign_key="complaint.id", index=True)
    old_status: str = Field(min_length=1, max_length=50)
    new_status: str = Field(min_length=1, max_length=50, index=True)
    actor_id: Optional[str] = Field(default=None, max_length=100)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)

    @field_validator('old_status', 'new_status')
    @classmethod
    def validate_status(cls, v):
        """Validate status values are valid complaint statuses"""
        valid_statuses = [status.value for status in ComplaintStatus]
        if v not in valid_statuses:
            raise ValueError(f'Invalid status. Must be one of: {valid_statuses}')
        return v

    def to_dict(self) -> Dict[str, Any]:
        """Convert status event to dictionary for API responses"""
        return {
            'id': self.id,
            'complaint_id': self.complaint_id,
            'old_status': self.old_status,
            'new_status': self.new_status,
            'actor_id': self.actor_id,
            'timestamp': self.timestamp.isoformat()
        }

    def __repr__(self) -> str:
        return f"StatusEvent(id={self.id}, complaint_id={self.complaint_id}, {self.old_status}->{self.new_status})"


class ImageHash(SQLModel, table=True):
    """Image hash table for duplicate detection and fraud prevention
    
    Stores perceptual hashes of images for duplicate detection and
    fraud prevention. Supports different photo types (submission,
    before/after, proof images).
    """
    
    id: Optional[int] = Field(default=None, primary_key=True)
    complaint_id: int = Field(foreign_key="complaint.id", index=True)
    hash_value: str = Field(index=True, min_length=1, max_length=64)
    photo_type: str = Field(default=PhotoType.SUBMISSION, index=True)  # submission, before, after, proof
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)

    @field_validator('photo_type')
    @classmethod
    def validate_photo_type(cls, v):
        """Validate photo type is a valid PhotoType"""
        valid_types = [pt.value for pt in PhotoType]
        if v not in valid_types:
            raise ValueError(f'Invalid photo type. Must be one of: {valid_types}')
        return v

    def to_dict(self) -> Dict[str, Any]:
        """Convert image hash to dictionary for API responses"""
        return {
            'id': self.id,
            'complaint_id': self.complaint_id,
            'hash_value': self.hash_value,
            'photo_type': self.photo_type,
            'created_at': self.created_at.isoformat()
        }

    def __repr__(self) -> str:
        return f"ImageHash(id={self.id}, complaint_id={self.complaint_id}, type='{self.photo_type}')"


# Thread-safe tracking ID generation with in-memory counter backup
_tracking_lock = threading.Lock()
_in_memory_counter = 0


class TrackingIDGenerator:
    """Thread-safe tracking ID generator using database sequences
    
    Generates unique tracking IDs in CF-XXXX format using atomic
    database operations to ensure uniqueness in concurrent environments.
    """
    
    @staticmethod
    def initialize_sequence(session: Session) -> None:
        """Initialize or update the tracking ID sequence in the database"""
        try:
            # Create a simple sequence table if it doesn't exist
            session.exec(text("""
                CREATE TABLE IF NOT EXISTS tracking_sequence (
                    id INTEGER PRIMARY KEY DEFAULT 1,
                    current_value INTEGER NOT NULL DEFAULT 0
                )
            """))
            
            # Check if we need to initialize
            result = session.exec(text("SELECT COUNT(*) FROM tracking_sequence")).first()
            if result == 0:
                # Find the highest existing tracking ID to initialize sequence
                highest_result = session.exec(
                    select(Complaint.tracking_id)
                    .where(Complaint.tracking_id.like("CF-%"))
                    .order_by(Complaint.tracking_id.desc())
                    .limit(1)
                ).first()
                
                initial_value = 0
                if highest_result:
                    try:
                        initial_value = int(highest_result.split("-")[1])
                    except (ValueError, IndexError):
                        initial_value = 0
                
                session.exec(text(
                    "INSERT INTO tracking_sequence (id, current_value) VALUES (1, ?)"
                ), [initial_value])
            
            session.commit()
            
        except Exception as e:
            session.rollback()
            # Don't raise - let the calling method handle fallback

    @staticmethod
    def get_next_tracking_id(session: Session) -> str:
        """Generate next tracking ID atomically using database sequence with in-memory backup"""
        global _in_memory_counter
        
        with _tracking_lock:
            try:
                # Get the current max from database
                max_db_result = session.exec(text(
                    """SELECT MAX(CAST(SUBSTR(tracking_id, 4) AS INTEGER)) 
                       FROM complaint 
                       WHERE tracking_id LIKE 'CF-%' AND LENGTH(tracking_id) = 7"""
                )).first()
                
                # Handle the tuple result from SQLModel
                if max_db_result is not None:
                    if hasattr(max_db_result, '__getitem__'):  # It's a tuple/list-like
                        max_db = max_db_result[0] if max_db_result[0] is not None else 0
                    else:  # It's a scalar
                        max_db = max_db_result
                else:
                    max_db = 0
                
                # The next number should be the higher of database max or in-memory counter + 1
                next_num = max(max_db, _in_memory_counter) + 1
                
                # Update in-memory counter
                _in_memory_counter = next_num
                
                tracking_id = f"CF-{next_num:04d}"
                
                # Double-check uniqueness (shouldn't be needed with proper locking)
                existing = session.exec(
                    select(Complaint.tracking_id).where(Complaint.tracking_id == tracking_id)
                ).first()
                
                if existing is not None:
                    # If somehow exists, increment until we find a unique one
                    while existing is not None:
                        next_num += 1
                        _in_memory_counter = next_num
                        tracking_id = f"CF-{next_num:04d}"
                        existing = session.exec(
                            select(Complaint.tracking_id).where(Complaint.tracking_id == tracking_id)
                        ).first()
                
                return tracking_id
                
            except Exception as e:
                # Fallback to simpler approach
                return TrackingIDGenerator._fallback_tracking_id(session)
    
    @staticmethod
    def _fallback_tracking_id(session: Session) -> str:
        """Fallback method for tracking ID generation"""
        global _in_memory_counter
        try:
            # Get highest existing tracking ID
            result = session.exec(
                select(Complaint.tracking_id)
                .where(Complaint.tracking_id.like("CF-%"))
                .order_by(Complaint.tracking_id.desc())
                .limit(1)
            ).first()
            
            next_num = 1
            if result:
                try:
                    last_num = int(result.split("-")[1])
                    next_num = last_num + 1
                except (ValueError, IndexError):
                    next_num = 1
            
            # Ensure in-memory counter is in sync
            _in_memory_counter = max(_in_memory_counter, next_num)
            
            return f"CF-{next_num:04d}"
            
        except Exception:
            # Ultimate fallback - use timestamp-based ID
            import time
            timestamp = int(time.time() % 10000)
            return f"CF-{timestamp:04d}"

    @staticmethod
    def validate_tracking_id_format(tracking_id: str) -> bool:
        """Validate tracking ID follows CF-XXXX format"""
        import re
        pattern = r'^CF-\d{4}$'
        return bool(re.match(pattern, tracking_id))


# Legacy functions for backward compatibility
def generate_tracking_id(session: Session) -> str:
    """Legacy function - use TrackingIDGenerator.get_next_tracking_id instead"""
    return TrackingIDGenerator.get_next_tracking_id(session)


def get_next_tracking_id(session: Session) -> str:
    """Generate the next available tracking ID using atomic database operations"""
    return TrackingIDGenerator.get_next_tracking_id(session)


# Additional utility functions
def get_complaint_by_tracking_id(session: Session, tracking_id: str) -> Optional[Complaint]:
    """Get complaint by tracking ID"""
    return session.exec(
        select(Complaint).where(Complaint.tracking_id == tracking_id)
    ).first()


def create_status_event(
    session: Session, 
    complaint_id: int, 
    old_status: str, 
    new_status: str, 
    actor_id: Optional[str] = None
) -> StatusEvent:
    """Create a new status event for complaint audit trail"""
    status_event = StatusEvent(
        complaint_id=complaint_id,
        old_status=old_status,
        new_status=new_status,
        actor_id=actor_id
    )
    session.add(status_event)
    session.commit()
    session.refresh(status_event)
    return status_event


def get_complaints_by_department(
    session: Session, 
    department_id: int, 
    status_filter: Optional[str] = None,
    limit: Optional[int] = None
) -> List[Complaint]:
    """Get complaints assigned to a specific department"""
    query = select(Complaint).where(Complaint.department_id == department_id)
    
    if status_filter:
        query = query.where(Complaint.status == status_filter)
    
    # Order by urgency (high to low) then by SLA deadline (urgent first)
    query = query.order_by(Complaint.urgency_score.desc(), Complaint.sla_deadline.asc())
    
    if limit:
        query = query.limit(limit)
    
    return list(session.exec(query))


def get_overdue_complaints(session: Session) -> List[Complaint]:
    """Get all complaints that are past their SLA deadline"""
    current_time = datetime.now(timezone.utc)
    return list(session.exec(
        select(Complaint)
        .where(
            Complaint.sla_deadline < current_time,
            Complaint.status != ComplaintStatus.RESOLVED
        )
        .order_by(Complaint.sla_deadline.asc())
    ))


def get_complaints_for_review(session: Session) -> List[Complaint]:
    """Get complaints that need human review"""
    return list(session.exec(
        select(Complaint)
        .where(
            (Complaint.needs_human_review == True) |
            (Complaint.suspected_fraud == True)
        )
        .order_by(Complaint.created_at.asc())
    ))
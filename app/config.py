"""
CivicFix AI Configuration

All constants, enumerations, mappings, and thresholds used by the rules engine
and other system components. This centralizes configuration to make the system
easily tunable without modifying business logic.
"""

from enum import Enum
from typing import Dict, List


# Emergency keywords that trigger urgency score = 10
EMERGENCY_KEYWORDS: List[str] = [
    "live wire", 
    "open manhole", 
    "gas smell", 
    "live taar", 
    "khuli manhole"
]

# Scoring thresholds and parameters
ROOT_CAUSE_THRESHOLD = 3  # Recurrence count to trigger root cause flag
CONFIDENCE_THRESHOLD = 0.6  # AI confidence threshold for human review
SIMILARITY_THRESHOLD = 10  # imagehash hamming distance threshold
DEDUP_RADIUS_METERS = 30  # Geographic radius for duplicate detection
DEDUP_WINDOW_DAYS = 7  # Time window for duplicate detection

# File and rate limits
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
RATE_LIMIT_PER_MINUTE = 30

# RAG parameters
RAG_TOP_K = 3
RAG_SIMILARITY_THRESHOLD = 0.5

# Weather bonus thresholds (mm/h precipitation)
WEATHER_BONUS_HIGH_MM = 10  # > 10 mm/h → +2 bonus
WEATHER_BONUS_LOW_MM = 0   # > 0 mm/h → +1 bonus

# Default values
DEFAULT_BASE_SEVERITY = 3

# Vision Service severity to integer mapping
SEVERITY_TO_INT: Dict[str, int] = {
    "low": 2,
    "medium": 3,
    "high": 5,
    "critical": 6
}


class ComplaintCategory(str, Enum):
    """Enumeration of supported complaint categories"""
    POTHOLE = "pothole"
    WATER_LEAK = "water_leak"
    GARBAGE = "garbage"
    STREETLIGHT = "streetlight"
    SEWAGE = "sewage"
    ROAD_DAMAGE = "road_damage"
    OTHER = "other"


class ComplaintStatus(str, Enum):
    """Enumeration of complaint status values"""
    PENDING = "Pending"
    IN_PROGRESS = "In Progress"
    RESOLVED = "Resolved"


class PhotoType(str, Enum):
    """Enumeration of photo types for image hash tracking"""
    SUBMISSION = "submission"
    BEFORE = "before"
    AFTER = "after" 
    PROOF = "proof"


# Category to department mapping
CATEGORY_TO_DEPARTMENT: Dict[ComplaintCategory, str] = {
    ComplaintCategory.POTHOLE: "Roads Department",
    ComplaintCategory.ROAD_DAMAGE: "Roads Department",
    ComplaintCategory.WATER_LEAK: "Water & Sanitation",
    ComplaintCategory.SEWAGE: "Water & Sanitation", 
    ComplaintCategory.GARBAGE: "Solid Waste Management",
    ComplaintCategory.STREETLIGHT: "Electrical Department",
    ComplaintCategory.OTHER: "General Administration",
}

# SLA hours by department (in hours)
SLA_HOURS: Dict[str, int] = {
    "Roads Department": 72,          # 3 days
    "Water & Sanitation": 24,        # 1 day  
    "Solid Waste Management": 48,    # 2 days
    "Electrical Department": 12,     # 12 hours
    "General Administration": 168,   # 7 days
}

# Department contact information
DEPARTMENTS_DATA = [
    {
        "name": "Roads Department",
        "email": "roads@municipality.gov",
        "whatsapp_contact": "+92-300-1234567",
        "supervisor_contact": "+92-300-1234568"
    },
    {
        "name": "Water & Sanitation", 
        "email": "water@municipality.gov",
        "whatsapp_contact": "+92-300-1234569",
        "supervisor_contact": "+92-300-1234570"
    },
    {
        "name": "Solid Waste Management",
        "email": "waste@municipality.gov", 
        "whatsapp_contact": "+92-300-1234571",
        "supervisor_contact": "+92-300-1234572"
    },
    {
        "name": "Electrical Department",
        "email": "electrical@municipality.gov",
        "whatsapp_contact": "+92-300-1234573", 
        "supervisor_contact": "+92-300-1234574"
    },
    {
        "name": "General Administration",
        "email": "admin@municipality.gov",
        "whatsapp_contact": "+92-300-1234575",
        "supervisor_contact": "+92-300-1234576"
    }
]

# Mock AI responses for simulator
MOCK_EXTRACTION_RESPONSES = {
    "pothole complaint": {
        "category": ComplaintCategory.POTHOLE,
        "summary": "Large pothole causing vehicle damage",
        "sentiment": "negative", 
        "vulnerable_group_flag": False,
        "confidence": 0.8,
        "missing_field": None
    },
    "water leak": {
        "category": ComplaintCategory.WATER_LEAK,
        "summary": "Water pipe burst on main road",
        "sentiment": "negative",
        "vulnerable_group_flag": False, 
        "confidence": 0.9,
        "missing_field": None
    },
    "streetlight not working": {
        "category": ComplaintCategory.STREETLIGHT,
        "summary": "Street light pole not functioning", 
        "sentiment": "neutral",
        "vulnerable_group_flag": True,
        "confidence": 0.7,
        "missing_field": None
    }
}

MOCK_VISION_RESPONSES = {
    "default": {
        "severity": "medium",
        "description": "Moderate infrastructure damage visible in image"
    },
    "pothole": {
        "severity": "high", 
        "description": "Large pothole with visible depth and damage"
    },
    "water_leak": {
        "severity": "critical",
        "description": "Major water pipe burst with flooding"
    }
}
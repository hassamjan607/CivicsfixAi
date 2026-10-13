"""
CivicFix AI Rules Engine

Pure Python urgency scoring engine with no AI dependencies.
Implements transparent, auditable scoring logic based on configurable
thresholds and emergency keyword detection.
"""

from typing import Tuple, List
from .config import EMERGENCY_KEYWORDS, ROOT_CAUSE_THRESHOLD


def compute_urgency(
    base_severity: int,
    weather_bonus: int,
    recurrence_count: int,
    near_sensitive_place: bool,
    vulnerable_group: bool,
    text: str,
) -> Tuple[int, List[str]]:
    """
    Compute urgency score using pure Python rules.
    
    Formula: base_severity(1-6) + weather_bonus(0/+1/+2) + recurrence_bonus(0/+1/+2) 
             + sensitive_place_bonus(0/+1) + vulnerable_group_bonus(0/+1), capped at 10
    
    Emergency override: any keyword from EMERGENCY_KEYWORDS sets score=10
    
    Args:
        base_severity: Base severity score 1-6
        weather_bonus: Weather-based bonus 0, 1, or 2
        recurrence_count: Number of similar complaints
        near_sensitive_place: Boolean flag for sensitive location
        vulnerable_group: Boolean flag for vulnerable group
        text: Original complaint text for emergency keyword check
        
    Returns:
        Tuple of (urgency_score, reasons_list)
    """
    # Emergency override check first - case insensitive
    for keyword in EMERGENCY_KEYWORDS:
        if keyword.lower() in text.lower():
            return 10, ["Emergency override triggered"]
    
    # Start with base severity
    score = base_severity
    reasons = [f"Base severity: {base_severity}"]
    
    # Add weather bonus if applicable
    if weather_bonus > 0:
        score += weather_bonus
        reasons.append(f"Weather bonus: +{weather_bonus}")
    
    # Calculate recurrence bonus based on count
    recurrence_bonus = 0
    if recurrence_count >= ROOT_CAUSE_THRESHOLD:
        recurrence_bonus = 2
    elif recurrence_count > 0:
        recurrence_bonus = 1
    
    if recurrence_bonus > 0:
        score += recurrence_bonus
        reasons.append(f"Recurrence bonus: +{recurrence_bonus}")
    
    # Add sensitive place bonus
    if near_sensitive_place:
        score += 1
        reasons.append("Near sensitive place: +1")
    
    # Add vulnerable group bonus
    if vulnerable_group:
        score += 1
        reasons.append("Vulnerable group flag: +1")
    
    # Cap the score at 10
    final_score = min(score, 10)
    
    return final_score, reasons
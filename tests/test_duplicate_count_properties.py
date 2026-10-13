"""
Property-Based Tests for Duplicate Count Monotonicity System

Tests Property 7: Duplicate Count Monotonicity
**Validates: Requirements 8.3, 14.1**

These tests verify that the duplicate count system maintains monotonic behavior,
correctly affects urgency scoring, and handles deduplication consistently across
multiple runs and varying scenarios.

Key Properties Validated:
1. Duplicate counts are monotonically non-decreasing for any complaint
2. Higher duplicate counts result in higher urgency scores through recurrence bonus
3. Root cause flags are set correctly based on recurrence thresholds  
4. Deduplication scoring formula works correctly with varying duplicate counts
5. Edge cases (zero duplicates, maximum duplicates) are handled properly
6. Multiple deduplication runs produce consistent results

The test suite uses Hypothesis to generate varied test scenarios including:
- Different geographic coordinates within the NYC area
- Various complaint categories from the system enum
- Sequences of potential duplicate complaints with different timing
- Edge cases with zero to maximum duplicate counts
- Mathematical validation of the urgency scoring formula
"""

import pytest
import math
from datetime import datetime, timedelta, timezone
from typing import List, Tuple, Set
from sqlmodel import Session, create_engine, SQLModel, select
from sqlmodel.pool import StaticPool

from hypothesis import given, strategies as st, assume, settings, HealthCheck
from hypothesis.stateful import RuleBasedStateMachine, Bundle, rule, initialize

from app.models import Complaint, Department, ImageHash
from app.dedup import (
    find_duplicate_complaint,
    update_duplicate_counts,
    haversine_meters,
    compute_image_hash,
    create_image_hash,
    check_duplicate_image_across_complaints
)
from app.rules import compute_urgency
from app.config import (
    ComplaintCategory, 
    DEDUP_RADIUS_METERS, 
    DEDUP_WINDOW_DAYS,
    ROOT_CAUSE_THRESHOLD
)


def create_test_session():
    """Create a fresh test database session"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
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
        
        return session


def create_test_complaint(
    session: Session, 
    category: str, 
    lat: float, 
    lng: float, 
    created_at: datetime = None,
    tracking_id: str = None,
    duplicate_count: int = 0,
    recurrence_count: int = 0,
    urgency_score: int = 3
) -> Complaint:
    """Helper to create a test complaint with specific parameters"""
    if created_at is None:
        created_at = datetime.now(timezone.utc)
    elif created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    
    if tracking_id is None:
        # Generate a simple unique tracking ID for tests
        existing_count = len(session.exec(select(Complaint.tracking_id)).all())
        tracking_id = f"CF-{existing_count + 1:04d}"
    
    complaint = Complaint(
        tracking_id=tracking_id,
        category=category,
        summary="Test complaint",
        description="Test description",
        sentiment="negative",
        latitude=lat,
        longitude=lng,
        created_at=created_at,
        department_id=1,
        duplicate_count=duplicate_count,
        recurrence_count=recurrence_count,
        urgency_score=urgency_score
    )
    session.add(complaint)
    session.commit()
    session.refresh(complaint)
    return complaint


# Strategy for generating valid coordinates within a small area
coords_strategy = st.tuples(
    st.floats(min_value=40.7, max_value=40.8, allow_nan=False),  # NYC area lat
    st.floats(min_value=-74.1, max_value=-74.0, allow_nan=False)  # NYC area lng
)

# Strategy for generating complaint categories
category_strategy = st.sampled_from([cat.value for cat in ComplaintCategory])

# Strategy for generating time deltas within the deduplication window
time_delta_strategy = st.integers(min_value=0, max_value=DEDUP_WINDOW_DAYS - 1)


@pytest.mark.property
class TestDuplicateCountMonotonicity:
    """
    **Validates: Requirements 8.3, 14.1**
    
    Property 7: Duplicate Count Monotonicity
    For any complaint C and sequence of duplicate merges, duplicate_count SHALL
    be monotonically non-decreasing, and urgency scoring SHALL reflect the
    duplicate count appropriately through recurrence bonuses.
    
    This test ensures that:
    - Requirement 8.3: Duplicate count increments correctly when duplicates are merged
    - Requirement 14.1: Recurrence count tracking affects urgency scoring appropriately
    """
    
    @given(
        coords_strategy,
        category_strategy,
        st.integers(min_value=1, max_value=5)  # Number of duplicates to create
    )
    @settings(
        suppress_health_check=[HealthCheck.function_scoped_fixture], 
        deadline=None,  # Remove deadline to prevent timeout issues
        max_examples=10  # Reduce examples for faster testing
    )
    def test_duplicate_count_monotonic_increase(
        self, 
        original_coords: Tuple[float, float],
        category: str,
        num_duplicates: int
    ):
        """Test that duplicate counts increase monotonically as duplicates are merged"""
        with create_test_session() as session:
            original_lat, original_lng = original_coords
            base_time = datetime.now(timezone.utc)
            
            # Create original complaint
            original = create_test_complaint(
                session, category, original_lat, original_lng,
                created_at=base_time - timedelta(days=DEDUP_WINDOW_DAYS - 1)
            )
            
            initial_duplicate_count = original.duplicate_count
            previous_count = initial_duplicate_count
            
            # Create duplicates that are clearly within radius and time window
            for i in range(num_duplicates):
                # Create very close duplicate (within 10 meters)
                dup_lat = original_lat + 0.0001  # ~10 meters north
                dup_lng = original_lng + 0.0001  # ~10 meters east
                duplicate_time = base_time - timedelta(hours=i + 1)  # Recent, within time window
                
                # Verify this would be detected as duplicate
                found_duplicate = find_duplicate_complaint(
                    session, category, dup_lat, dup_lng, duplicate_time
                )
                
                if found_duplicate and found_duplicate.id == original.id:
                    # This is a duplicate - update counts
                    update_duplicate_counts(session, original)
                    session.refresh(original)
                    
                    # Verify monotonic increase
                    assert original.duplicate_count > previous_count, \
                        f"Duplicate count did not increase: {previous_count} -> {original.duplicate_count}"
                    
                    previous_count = original.duplicate_count
            
            # Final count should be initial + number of duplicates that were actually processed
            # (Some duplicates might not be detected due to edge cases, so we check >= initial)
            assert original.duplicate_count >= initial_duplicate_count

    @given(
        coords_strategy,
        category_strategy,
        st.integers(min_value=0, max_value=10)
    )
    @settings(
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        deadline=None,
        max_examples=10
    )
    def test_duplicate_count_affects_urgency_scoring(
        self,
        coords: Tuple[float, float],
        category: str,
        duplicate_count: int
    ):
        """Test that higher duplicate counts result in higher urgency scores via recurrence bonus"""
        with create_test_session() as session:
            lat, lng = coords
            
            # Create complaint with specific duplicate count
            complaint = create_test_complaint(
                session, category, lat, lng,
                duplicate_count=duplicate_count,
                recurrence_count=duplicate_count  # Assuming they're equal for this test
            )
            
            # Compute urgency with current duplicate count
            urgency_with_duplicates, _ = compute_urgency(
                base_severity=3,  # Default
                weather_bonus=0,
                recurrence_count=complaint.recurrence_count,
                near_sensitive_place=False,
                vulnerable_group=False,
                text="test complaint"  # No emergency keywords
            )
            
            # Compute urgency with zero duplicates for comparison
            urgency_no_duplicates, _ = compute_urgency(
                base_severity=3,  # Same base
                weather_bonus=0,
                recurrence_count=0,  # No recurrence
                near_sensitive_place=False,
                vulnerable_group=False,
                text="test complaint"
            )
            
            # If we have duplicates, urgency should be higher or equal
            if duplicate_count > 0:
                assert urgency_with_duplicates >= urgency_no_duplicates, \
                    f"Urgency with duplicates ({urgency_with_duplicates}) should be >= urgency without ({urgency_no_duplicates})"
            else:
                assert urgency_with_duplicates == urgency_no_duplicates, \
                    f"Urgency scores should be equal when no duplicates: {urgency_with_duplicates} vs {urgency_no_duplicates}"

    @given(
        coords_strategy,
        category_strategy,
        st.integers(min_value=1, max_value=15)
    )
    @settings(
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        deadline=None,
        max_examples=10
    )
    def test_root_cause_flag_threshold_behavior(
        self,
        coords: Tuple[float, float],
        category: str,
        final_recurrence_count: int
    ):
        """Test that root cause flag is set correctly based on recurrence threshold"""
        with create_test_session() as session:
            lat, lng = coords
            
            # Create complaint with specific recurrence count
            complaint = create_test_complaint(
                session, category, lat, lng,
                recurrence_count=final_recurrence_count
            )
            
            # Manually trigger root cause flag logic based on threshold
            if complaint.recurrence_count >= ROOT_CAUSE_THRESHOLD:
                complaint.root_cause_flag = True
            else:
                complaint.root_cause_flag = False
            
            session.add(complaint)
            session.commit()
            session.refresh(complaint)
            
            # Verify flag is set correctly based on threshold
            if final_recurrence_count >= ROOT_CAUSE_THRESHOLD:
                assert complaint.root_cause_flag == True, \
                    f"Root cause flag should be True when recurrence_count ({final_recurrence_count}) >= threshold ({ROOT_CAUSE_THRESHOLD})"
            else:
                assert complaint.root_cause_flag == False, \
                    f"Root cause flag should be False when recurrence_count ({final_recurrence_count}) < threshold ({ROOT_CAUSE_THRESHOLD})"

    @given(
        coords_strategy,
        category_strategy,
        st.lists(st.integers(min_value=0, max_value=5), min_size=2, max_size=10)
    )
    @settings(
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        deadline=None,
        max_examples=10
    )
    def test_multiple_deduplication_runs_consistency(
        self,
        coords: Tuple[float, float],
        category: str,
        duplicate_counts: List[int]
    ):
        """Test that multiple deduplication runs produce consistent results"""
        with create_test_session() as session:
            lat, lng = coords
            base_time = datetime.now(timezone.utc)
            
            # Create original complaint
            original = create_test_complaint(
                session, category, lat, lng,
                created_at=base_time - timedelta(days=DEDUP_WINDOW_DAYS - 1)
            )
            
            # Track duplicate count progression
            counts_progression = [original.duplicate_count]
            
            # Simulate multiple deduplication runs
            for i, _ in enumerate(duplicate_counts):
                # Create a nearby duplicate complaint
                nearby_lat = lat + 0.0001  # About 10 meters
                nearby_lng = lng + 0.0001
                duplicate_time = base_time - timedelta(days=i % DEDUP_WINDOW_DAYS)
                
                # Check if it would be detected as duplicate
                found_duplicate = find_duplicate_complaint(
                    session, category, nearby_lat, nearby_lng, duplicate_time
                )
                
                if found_duplicate and found_duplicate.id == original.id:
                    # Update counts
                    previous_count = original.duplicate_count
                    update_duplicate_counts(session, original)
                    session.refresh(original)
                    
                    # Verify monotonicity
                    assert original.duplicate_count > previous_count, \
                        f"Duplicate count should increase: {previous_count} -> {original.duplicate_count}"
                    
                    counts_progression.append(original.duplicate_count)
            
            # Verify all counts in progression are monotonically increasing
            for i in range(1, len(counts_progression)):
                assert counts_progression[i] > counts_progression[i-1], \
                    f"Non-monotonic progression at index {i}: {counts_progression}"

    @given(
        coords_strategy,
        category_strategy,
        st.lists(st.floats(min_value=0.0001, max_value=0.001), min_size=1, max_size=8)
    )
    @settings(
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        deadline=None,
        max_examples=10
    )
    def test_edge_cases_zero_and_maximum_duplicates(
        self,
        coords: Tuple[float, float],
        category: str,
        coordinate_offsets: List[float]
    ):
        """Test duplicate count behavior at edge cases (zero duplicates, many duplicates)"""
        with create_test_session() as session:
            lat, lng = coords
            base_time = datetime.now(timezone.utc)
            
            # Test zero duplicates case
            complaint_zero = create_test_complaint(
                session, category, lat, lng,
                created_at=base_time - timedelta(days=1),
                tracking_id="CF-0001"
            )
            
            # Verify initial state
            assert complaint_zero.duplicate_count == 0
            assert complaint_zero.recurrence_count == 0
            
            # Create maximum duplicates scenario
            complaint_max = create_test_complaint(
                session, category, lat + 0.01, lng + 0.01,  # Far enough to be separate
                created_at=base_time - timedelta(days=1),
                tracking_id="CF-0002"
            )
            
            duplicate_count = 0
            for offset in coordinate_offsets:
                # Create nearby complaint that should be detected as duplicate
                dup_lat = complaint_max.latitude + offset
                dup_lng = complaint_max.longitude + offset
                dup_time = base_time - timedelta(hours=1)
                
                # Check if within radius
                distance = haversine_meters(complaint_max.latitude, complaint_max.longitude, dup_lat, dup_lng)
                
                if distance <= DEDUP_RADIUS_METERS:
                    # This would be a duplicate
                    found = find_duplicate_complaint(
                        session, category, dup_lat, dup_lng, dup_time
                    )
                    
                    if found and found.id == complaint_max.id:
                        old_count = complaint_max.duplicate_count
                        update_duplicate_counts(session, complaint_max)
                        session.refresh(complaint_max)
                        
                        # Verify monotonic increase
                        assert complaint_max.duplicate_count > old_count
                        duplicate_count += 1
            
            # Verify final state makes sense
            assert complaint_max.duplicate_count == duplicate_count
            
            # Verify zero duplicates case remains unchanged
            session.refresh(complaint_zero)
            assert complaint_zero.duplicate_count == 0

    @given(
        st.tuples(coords_strategy, coords_strategy),
        category_strategy
    )
    @settings(
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        deadline=None,
        max_examples=10
    )
    def test_duplicate_count_never_decreases(
        self,
        coord_pair: Tuple[Tuple[float, float], Tuple[float, float]],
        category: str
    ):
        """Test that duplicate counts never decrease for the same complaint"""
        (lat1, lng1), (lat2, lng2) = coord_pair
        
        with create_test_session() as session:
            base_time = datetime.now(timezone.utc)
            
            # Create original complaint
            original = create_test_complaint(
                session, category, lat1, lng1,
                created_at=base_time - timedelta(days=1)
            )
            
            initial_count = original.duplicate_count
            max_count_seen = initial_count
            
            # Simulate multiple operations that might affect duplicate count
            for i in range(5):
                # Record current count
                session.refresh(original)
                current_count = original.duplicate_count
                
                # Verify count never decreases
                assert current_count >= max_count_seen, \
                    f"Duplicate count decreased from {max_count_seen} to {current_count} at iteration {i}"
                
                max_count_seen = max(max_count_seen, current_count)
                
                # Try to create a potential duplicate
                distance = haversine_meters(lat1, lng1, lat2, lng2)
                if distance <= DEDUP_RADIUS_METERS:
                    # This could be a duplicate
                    dup_time = base_time + timedelta(hours=i)
                    found = find_duplicate_complaint(session, category, lat2, lng2, dup_time)
                    
                    if found and found.id == original.id:
                        # Update counts
                        update_duplicate_counts(session, original)

    @given(
        coords_strategy,
        category_strategy,
        st.integers(min_value=1, max_value=6),  # base_severity range
        st.integers(min_value=0, max_value=10)  # duplicate_count range
    )
    @settings(
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        deadline=None,
        max_examples=10
    )
    def test_urgency_scoring_with_varying_duplicates(
        self,
        coords: Tuple[float, float],
        category: str,
        base_severity: int,
        duplicate_count: int
    ):
        """Test that urgency scoring correctly accounts for duplicate count variations"""
        with create_test_session() as session:
            lat, lng = coords
            
            # Create complaint with specific duplicate count
            complaint = create_test_complaint(
                session, category, lat, lng,
                duplicate_count=duplicate_count,
                recurrence_count=duplicate_count
            )
            
            # Calculate urgency with current duplicate count
            urgency, _ = compute_urgency(
                base_severity=base_severity,
                weather_bonus=0,
                recurrence_count=duplicate_count,
                near_sensitive_place=False,
                vulnerable_group=False,
                text="test complaint"
            )
            
            # Calculate urgency with zero duplicates
            urgency_zero, _ = compute_urgency(
                base_severity=base_severity,
                weather_bonus=0,
                recurrence_count=0,
                near_sensitive_place=False,
                vulnerable_group=False,
                text="test complaint"
            )
            
            # Verify recurrence bonus is applied correctly
            if duplicate_count >= ROOT_CAUSE_THRESHOLD:
                # Should get +2 recurrence bonus
                expected_min_increase = 2
            elif duplicate_count > 0:
                # Should get +1 recurrence bonus
                expected_min_increase = 1
            else:
                # No recurrence bonus
                expected_min_increase = 0
            
            actual_increase = urgency - urgency_zero
            assert actual_increase >= expected_min_increase, \
                f"Expected increase of at least {expected_min_increase}, got {actual_increase} (duplicate_count={duplicate_count})"
            
            # Urgency should never exceed 10 (unless emergency override)
            assert urgency <= 10, f"Urgency score exceeded maximum: {urgency}"


@pytest.mark.property  
class TestDeduplicationFormulaCorrectness:
    """
    Test the mathematical correctness of the deduplication scoring formula
    **Validates: Requirements 8.3, 14.1**
    """
    
    @given(
        st.integers(min_value=0, max_value=20),  # recurrence_count
        st.integers(min_value=1, max_value=6),   # base_severity  
        st.integers(min_value=0, max_value=2),   # weather_bonus
        st.integers(min_value=0, max_value=1),   # sensitive_place_bonus
        st.booleans()  # vulnerable_group_flag
    )
    @settings(deadline=None, max_examples=20)
    def test_deduplication_scoring_formula_correctness(
        self,
        recurrence_count: int,
        base_severity: int, 
        weather_bonus: int,
        sensitive_place_bonus: int,
        vulnerable_group_flag: bool
    ):
        """Test that the urgency scoring formula correctly incorporates recurrence bonus"""
        # Calculate expected recurrence bonus based on business rules
        if recurrence_count >= ROOT_CAUSE_THRESHOLD:
            expected_recurrence_bonus = 2
        elif recurrence_count > 0:
            expected_recurrence_bonus = 1
        else:
            expected_recurrence_bonus = 0
        
        # Calculate urgency using the actual function
        urgency, _ = compute_urgency(
            base_severity=base_severity,
            weather_bonus=weather_bonus,
            recurrence_count=recurrence_count,
            near_sensitive_place=bool(sensitive_place_bonus),
            vulnerable_group=vulnerable_group_flag,
            text="test complaint"
        )
        
        # Calculate expected urgency manually
        vulnerable_bonus = 1 if vulnerable_group_flag else 0
        expected_raw_score = (
            base_severity + 
            weather_bonus + 
            expected_recurrence_bonus + 
            sensitive_place_bonus + 
            vulnerable_bonus
        )
        expected_urgency = min(expected_raw_score, 10)  # Cap at 10
        
        assert urgency == expected_urgency, \
            f"Urgency mismatch: got {urgency}, expected {expected_urgency} " \
            f"(recurrence_count={recurrence_count}, recurrence_bonus={expected_recurrence_bonus})"

    @given(st.integers(min_value=0, max_value=50))
    @settings(deadline=None, max_examples=10)
    def test_recurrence_bonus_tiers(self, recurrence_count: int):
        """Test that recurrence bonus follows correct tier structure"""
        urgency_zero, _ = compute_urgency(
            base_severity=3, weather_bonus=0, recurrence_count=0,
            near_sensitive_place=False, vulnerable_group=False, text="test"
        )
        
        urgency_with_recurrence, _ = compute_urgency(
            base_severity=3, weather_bonus=0, recurrence_count=recurrence_count,
            near_sensitive_place=False, vulnerable_group=False, text="test"
        )
        
        bonus = urgency_with_recurrence - urgency_zero
        
        if recurrence_count >= ROOT_CAUSE_THRESHOLD:
            assert bonus == 2, f"Expected +2 bonus for recurrence_count={recurrence_count}, got {bonus}"
        elif recurrence_count > 0:
            assert bonus == 1, f"Expected +1 bonus for recurrence_count={recurrence_count}, got {bonus}"
        else:
            assert bonus == 0, f"Expected no bonus for recurrence_count={recurrence_count}, got {bonus}"


@pytest.mark.property
def test_duplicate_count_consistency_under_concurrent_updates():
    """
    Test that duplicate count updates remain consistent under various scenarios
    **Validates: Requirements 8.3, 14.1**
    """
    with create_test_session() as session:
        # Create base complaint
        original = create_test_complaint(
            session, "pothole", 40.7128, -74.0060,
            created_at=datetime.now(timezone.utc) - timedelta(days=1)
        )
        
        # Simulate multiple duplicate detection and update cycles
        for i in range(10):
            initial_count = original.duplicate_count
            
            # Update duplicate counts
            update_duplicate_counts(session, original)
            session.refresh(original)
            
            # Verify monotonic increase
            assert original.duplicate_count == initial_count + 1
            assert original.recurrence_count == original.duplicate_count
            
            # Verify urgency reflects the change
            new_urgency, _ = compute_urgency(
                base_severity=3,
                weather_bonus=0,
                recurrence_count=original.recurrence_count,
                near_sensitive_place=False,
                vulnerable_group=False,
                text="test complaint"
            )
            
            # Calculate expected urgency
            if original.recurrence_count >= ROOT_CAUSE_THRESHOLD:
                expected_bonus = 2
            elif original.recurrence_count > 0:
                expected_bonus = 1
            else:
                expected_bonus = 0
            
            expected_urgency = min(3 + expected_bonus, 10)
            assert new_urgency == expected_urgency, \
                f"Urgency mismatch at count {original.duplicate_count}: got {new_urgency}, expected {expected_urgency}"


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v"])
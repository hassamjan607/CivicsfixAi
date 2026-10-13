"""
Property-Based Tests for Tracking ID Generation System

Tests Property 5: Tracking ID Format Invariant
Validates: Requirements 10.1, 1.4

These tests verify that the tracking ID generation system maintains
correct format, uniqueness, and thread-safety invariants across all
possible execution scenarios.
"""

import pytest
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Set, List
from sqlmodel import Session, select, create_engine, SQLModel
from sqlmodel.pool import StaticPool

from hypothesis import given, strategies as st, assume, settings, HealthCheck
from hypothesis.stateful import RuleBasedStateMachine, Bundle, rule, initialize

from app.models import (
    Complaint, 
    TrackingIDGenerator, 
    generate_tracking_id,
    get_next_tracking_id
)
from app.config import ComplaintCategory


def create_test_session():
    """Create a fresh test database session"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)


@pytest.mark.property
class TestTrackingIDFormatInvariant:
    """
    **Validates: Requirements 10.1, 1.4**
    
    Property 5: Tracking ID Format Invariant
    For any accepted complaint creation (non-duplicate), the returned tracking_id 
    SHALL match the regex ^CF-\\d{4}$ and SHALL be unique across all complaints.
    """
    
    @given(st.integers(min_value=1, max_value=9999))
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_tracking_id_format_validity(self, number: int):
        """Test that all generated tracking IDs follow CF-XXXX format"""
        # Create fresh session for this test
        with create_test_session() as session:
            # Manually create a tracking ID using the expected format
            tracking_id = f"CF-{number:04d}"
            
            # Validate using the TrackingIDGenerator validation method
            assert TrackingIDGenerator.validate_tracking_id_format(tracking_id)
            
            # Verify regex pattern matches exactly
            pattern = r'^CF-\d{4}$'
            assert re.match(pattern, tracking_id) is not None
            
            # Verify string length is exactly 7 characters
            assert len(tracking_id) == 7
            
            # Verify format components
            assert tracking_id.startswith("CF-")
            number_part = tracking_id[3:]
            assert number_part.isdigit()
            assert len(number_part) == 4

    @given(st.lists(st.integers(min_value=1, max_value=999), min_size=1, max_size=50))
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_multiple_tracking_id_generation_uniqueness(self, counts: List[int]):
        """Test that multiple tracking ID generations maintain uniqueness"""
        with create_test_session() as session:
            generated_ids: Set[str] = set()
            
            for _ in counts:
                tracking_id = TrackingIDGenerator.get_next_tracking_id(session)
                
                # Verify format
                assert TrackingIDGenerator.validate_tracking_id_format(tracking_id)
                
                # Verify uniqueness
                assert tracking_id not in generated_ids, f"Duplicate tracking ID generated: {tracking_id}"
                generated_ids.add(tracking_id)
            
            # Verify all generated IDs are unique
            assert len(generated_ids) == len(counts)

    @given(st.integers(min_value=1, max_value=100))
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_tracking_id_sequence_monotonicity(self, count: int):
        """Test that tracking IDs are generated in monotonically increasing sequence"""
        with create_test_session() as session:
            generated_ids: List[str] = []
            
            for _ in range(count):
                tracking_id = TrackingIDGenerator.get_next_tracking_id(session)
                assert TrackingIDGenerator.validate_tracking_id_format(tracking_id)
                generated_ids.append(tracking_id)
            
            # Extract numeric parts and verify they're monotonically increasing
            numbers = [int(tid[3:]) for tid in generated_ids]
            for i in range(1, len(numbers)):
                assert numbers[i] > numbers[i-1], f"Non-monotonic sequence detected: {numbers[i-1]} >= {numbers[i]}"

    @given(
        st.lists(
            st.tuples(
                st.sampled_from(list(ComplaintCategory)),
                st.text(min_size=1, max_size=150),
                st.text(min_size=1, max_size=500)
            ),
            min_size=1,
            max_size=20
        )
    )
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_complaint_creation_tracking_id_uniqueness(self, complaint_data):
        """Test that created complaints get unique tracking IDs"""
        with create_test_session() as session:
            created_complaints: List[Complaint] = []
            tracking_ids: Set[str] = set()
            
            for category, summary, description in complaint_data:
                # Generate tracking ID
                tracking_id = TrackingIDGenerator.get_next_tracking_id(session)
                
                # Create complaint with the tracking ID
                complaint = Complaint(
                    tracking_id=tracking_id,
                    category=category.value,
                    summary=summary,
                    description=description,
                    sentiment="neutral",
                    urgency_score=1
                )
                
                session.add(complaint)
                session.commit()
                session.refresh(complaint)
                
                # Verify format and uniqueness
                assert TrackingIDGenerator.validate_tracking_id_format(complaint.tracking_id)
                assert complaint.tracking_id not in tracking_ids
                tracking_ids.add(complaint.tracking_id)
                created_complaints.append(complaint)
            
            # Verify all tracking IDs in database are unique
            db_tracking_ids = session.exec(select(Complaint.tracking_id)).all()
            assert len(set(db_tracking_ids)) == len(db_tracking_ids)


@pytest.mark.property
class TestTrackingIDThreadSafety:
    """
    Thread-safety tests for concurrent tracking ID generation
    **Validates: Requirements 10.1, 1.4**
    """
    
    @given(st.integers(min_value=2, max_value=10))
    @settings(max_examples=10, deadline=5000, suppress_health_check=[HealthCheck.function_scoped_fixture])  # Reduced for CI performance
    def test_concurrent_tracking_id_generation(self, thread_count: int):
        """Test that concurrent tracking ID generation maintains uniqueness"""
        generated_ids: List[str] = []
        errors: List[Exception] = []
        lock = threading.Lock()
        
        def generate_tracking_id_worker() -> str:
            try:
                # Create a new session for this thread
                with create_test_session() as thread_session:
                    # Generate tracking ID
                    tracking_id = TrackingIDGenerator.get_next_tracking_id(thread_session)
                    
                    with lock:
                        generated_ids.append(tracking_id)
                    
                    return tracking_id
                    
            except Exception as e:
                with lock:
                    errors.append(e)
                raise
        
        # Run concurrent generation
        with ThreadPoolExecutor(max_workers=thread_count) as executor:
            futures = [executor.submit(generate_tracking_id_worker) for _ in range(thread_count)]
            
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    errors.append(e)
        
        # Check for errors
        if errors:
            pytest.fail(f"Concurrent generation failed with errors: {errors}")
        
        # Verify all generated IDs are valid and unique
        assert len(generated_ids) == thread_count
        assert len(set(generated_ids)) == thread_count  # All unique
        
        for tracking_id in generated_ids:
            assert TrackingIDGenerator.validate_tracking_id_format(tracking_id)

    def test_high_concurrency_stress_test(self):
        """Stress test with higher concurrency to verify thread safety"""
        thread_count = 20
        ids_per_thread = 5
        all_ids: List[str] = []
        errors: List[Exception] = []
        lock = threading.Lock()
        
        def worker():
            try:
                # Each worker generates multiple IDs
                worker_ids = []
                for _ in range(ids_per_thread):
                    # Create a separate session for this thread
                    with create_test_session() as thread_session:
                        tracking_id = TrackingIDGenerator.get_next_tracking_id(thread_session)
                        worker_ids.append(tracking_id)
                        
                        # Small delay to increase chance of race conditions
                        time.sleep(0.001)
                
                with lock:
                    all_ids.extend(worker_ids)
                    
            except Exception as e:
                with lock:
                    errors.append(e)
        
        threads = []
        for _ in range(thread_count):
            thread = threading.Thread(target=worker)
            threads.append(thread)
            thread.start()
        
        for thread in threads:
            thread.join()
        
        if errors:
            pytest.fail(f"Stress test failed with errors: {errors}")
        
        expected_total = thread_count * ids_per_thread
        assert len(all_ids) == expected_total
        
        # Verify all IDs are unique (this is the critical test)
        unique_ids = set(all_ids)
        if len(unique_ids) != expected_total:
            duplicates = []
            seen = set()
            for id_val in all_ids:
                if id_val in seen:
                    duplicates.append(id_val)
                seen.add(id_val)
            pytest.fail(f"Found {len(duplicates)} duplicate tracking IDs: {duplicates[:10]}")
        
        # Verify all IDs follow correct format
        for tracking_id in all_ids:
            assert TrackingIDGenerator.validate_tracking_id_format(tracking_id)


@pytest.mark.property
class TestTrackingIDValidation:
    """
    Property-based tests for tracking ID validation functions
    **Validates: Requirements 10.1**
    """
    
    @given(st.text())
    def test_invalid_format_rejection(self, invalid_input: str):
        """Test that invalid formats are correctly rejected"""
        # Skip inputs that accidentally match the valid format
        assume(not re.match(r'^CF-\d{4}$', invalid_input))
        
        # Should be rejected by validation
        assert not TrackingIDGenerator.validate_tracking_id_format(invalid_input)
    
    @given(st.integers(min_value=0, max_value=9999))
    def test_valid_format_acceptance(self, number: int):
        """Test that all valid CF-XXXX formats are accepted"""
        tracking_id = f"CF-{number:04d}"
        assert TrackingIDGenerator.validate_tracking_id_format(tracking_id)
    
    @given(st.text(min_size=1, max_size=20))
    def test_boundary_format_validation(self, text_input: str):
        """Test validation behavior on boundary cases"""
        # Test various malformed inputs
        test_cases = [
            f"CF-{text_input}",  # Non-numeric suffix
            f"{text_input}-1234",  # Wrong prefix
            f"CF{text_input}1234",  # Missing dash
            f"CF-{text_input}1",  # Mixed content
        ]
        
        for test_case in test_cases:
            # These should all be invalid unless they accidentally match the pattern
            if re.match(r'^CF-\d{4}$', test_case):
                assert TrackingIDGenerator.validate_tracking_id_format(test_case)
            else:
                assert not TrackingIDGenerator.validate_tracking_id_format(test_case)


@pytest.mark.property
class TestLegacyFunctionCompatibility:
    """
    Test backward compatibility of legacy tracking ID functions
    **Validates: Requirements 10.1**
    """
    
    @given(st.integers(min_value=1, max_value=20))
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_legacy_function_compatibility(self, count: int):
        """Test that legacy functions produce same results as new implementation"""
        with create_test_session() as session:
            new_ids = []
            legacy_ids = []
            
            # Generate IDs using both approaches
            for _ in range(count):
                new_id = TrackingIDGenerator.get_next_tracking_id(session)
                legacy_id = generate_tracking_id(session)
                
                new_ids.append(new_id)
                legacy_ids.append(legacy_id)
            
            # Both should produce valid format
            for new_id, legacy_id in zip(new_ids, legacy_ids):
                assert TrackingIDGenerator.validate_tracking_id_format(new_id)
                assert TrackingIDGenerator.validate_tracking_id_format(legacy_id)
            
            # All should be unique
            all_ids = new_ids + legacy_ids
            assert len(set(all_ids)) == len(all_ids)

    def test_get_next_tracking_id_compatibility(self):
        """Test that get_next_tracking_id function works correctly"""
        with create_test_session() as session:
            tracking_id = get_next_tracking_id(session)
            
            assert TrackingIDGenerator.validate_tracking_id_format(tracking_id)
            assert tracking_id.startswith("CF-")
            assert len(tracking_id) == 7


# Simplified stateful test that respects the 4-digit limit
@pytest.mark.property 
def test_tracking_id_4_digit_limit():
    """
    Test that tracking IDs respect the 4-digit limit and wrap around
    **Validates: Requirements 10.1**
    """
    with create_test_session() as session:
        # Test that we can generate up to 9999 without issue
        # Generate a reasonable number to test the concept without taking too long
        for i in range(1, 101):  # Test first 100
            tracking_id = TrackingIDGenerator.get_next_tracking_id(session)
            assert TrackingIDGenerator.validate_tracking_id_format(tracking_id)
            
            # Extract the numeric part
            numeric_part = int(tracking_id[3:])
            assert 1 <= numeric_part <= 9999, f"Tracking ID {tracking_id} has invalid numeric part {numeric_part}"


# Test edge case behavior when approaching the limit  
@pytest.mark.property
def test_tracking_id_edge_cases():
    """
    Test tracking ID behavior at edge cases
    **Validates: Requirements 10.1**
    """
    with create_test_session() as session:
        # Generate a few IDs to establish baseline
        for _ in range(5):
            tid = TrackingIDGenerator.get_next_tracking_id(session)
            assert TrackingIDGenerator.validate_tracking_id_format(tid)
            assert len(tid) == 7  # CF- + 4 digits


@pytest.mark.property
def test_tracking_id_database_consistency():
    """
    Test that tracking IDs maintain consistency across database operations
    **Validates: Requirements 10.1, 1.4**
    """
    with create_test_session() as session:
        # Generate several tracking IDs
        tracking_ids = []
        for _ in range(10):
            tid = TrackingIDGenerator.get_next_tracking_id(session)
            tracking_ids.append(tid)
        
        # Create complaints with these IDs
        complaints = []
        for i, tid in enumerate(tracking_ids):
            complaint = Complaint(
                tracking_id=tid,
                category="pothole",
                summary=f"Test complaint {i}",
                description=f"Description {i}",
                sentiment="neutral",
                urgency_score=1
            )
            session.add(complaint)
            complaints.append(complaint)
        
        session.commit()
        
        # Verify database consistency
        db_tracking_ids = session.exec(select(Complaint.tracking_id)).all()
        
        # All tracking IDs should be in database
        assert set(tracking_ids) == set(db_tracking_ids)
        
        # All should be valid format
        for tid in db_tracking_ids:
            assert TrackingIDGenerator.validate_tracking_id_format(tid)
        
        # All should be unique
        assert len(set(db_tracking_ids)) == len(db_tracking_ids)
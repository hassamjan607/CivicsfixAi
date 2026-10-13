"""
Unit tests for database initialization functionality.

Tests the database setup functions including table creation,
department seeding, asset seeding, and tracking ID generation.
"""

import pytest
import os
import tempfile
from pathlib import Path
from sqlmodel import Session, create_engine, select
from app.database import (
    run_database_initialization,
    seed_departments,
    seed_sample_assets,
    initialize_tracking_sequence,
    is_database_initialized,
    get_database_stats
)
from app.models import Department, Asset, TrackingIDGenerator


@pytest.fixture
def temp_db_engine():
    """Create a temporary database engine for testing"""
    # Use in-memory database for faster tests
    engine = create_engine("sqlite:///:memory:", echo=False)
    
    # Create tables
    from sqlmodel import SQLModel
    SQLModel.metadata.create_all(engine)
    
    return engine


@pytest.fixture
def temp_data_dir():
    """Create a temporary data directory for testing"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.mark.asyncio
async def test_seed_departments(temp_db_engine):
    """Test department seeding functionality"""
    # Run the seeding
    await seed_departments(temp_db_engine)
    
    # Verify departments were created
    with Session(temp_db_engine) as session:
        departments = list(session.exec(select(Department)))
        
        # Should have 5 departments from config
        assert len(departments) == 5
        
        # Check specific departments exist
        dept_names = [dept.name for dept in departments]
        expected_names = [
            "Roads Department",
            "Water & Sanitation", 
            "Solid Waste Management",
            "Electrical Department",
            "General Administration"
        ]
        
        for expected_name in expected_names:
            assert expected_name in dept_names
        
        # Check department has contact info
        roads_dept = next(d for d in departments if d.name == "Roads Department")
        assert roads_dept.email == "roads@municipality.gov"
        assert roads_dept.whatsapp_contact == "+92-300-1234567"


@pytest.mark.asyncio
async def test_seed_departments_idempotent(temp_db_engine):
    """Test that department seeding is idempotent"""
    # Seed twice
    await seed_departments(temp_db_engine)
    await seed_departments(temp_db_engine)
    
    # Should still have exactly 5 departments
    with Session(temp_db_engine) as session:
        departments = list(session.exec(select(Department)))
        assert len(departments) == 5


@pytest.mark.asyncio
async def test_seed_sample_assets(temp_db_engine):
    """Test sample asset seeding functionality"""
    await seed_sample_assets(temp_db_engine)
    
    with Session(temp_db_engine) as session:
        assets = list(session.exec(select(Asset)))
        
        # Should have sample assets
        assert len(assets) > 0
        
        # Check asset types are valid
        asset_types = [asset.asset_type for asset in assets]
        expected_types = ["Water Pipe", "Street Light", "Road Section", "Sewage Line"]
        
        for asset_type in expected_types:
            assert asset_type in asset_types
        
        # Check coordinates are within valid ranges
        for asset in assets:
            assert -90 <= asset.latitude <= 90
            assert -180 <= asset.longitude <= 180


@pytest.mark.asyncio
async def test_seed_assets_idempotent(temp_db_engine):
    """Test that asset seeding is idempotent"""
    await seed_sample_assets(temp_db_engine)
    initial_count = get_database_stats(temp_db_engine)["assets"]
    
    # Run again - should not create duplicates
    await seed_sample_assets(temp_db_engine)
    final_count = get_database_stats(temp_db_engine)["assets"]
    
    assert initial_count == final_count


@pytest.mark.asyncio
async def test_initialize_tracking_sequence(temp_db_engine):
    """Test tracking sequence initialization"""
    await initialize_tracking_sequence(temp_db_engine)
    
    with Session(temp_db_engine) as session:
        # Should be able to generate tracking IDs
        tracking_id1 = TrackingIDGenerator.get_next_tracking_id(session)
        tracking_id2 = TrackingIDGenerator.get_next_tracking_id(session)
        
        # IDs should be properly formatted
        assert TrackingIDGenerator.validate_tracking_id_format(tracking_id1)
        assert TrackingIDGenerator.validate_tracking_id_format(tracking_id2)
        
        # IDs should be sequential (second should be exactly +1 from first)
        id1_num = int(tracking_id1.split('-')[1])
        id2_num = int(tracking_id2.split('-')[1])
        assert id2_num == id1_num + 1


def test_tracking_id_format_validation():
    """Test tracking ID format validation"""
    # Valid formats
    valid_ids = ["CF-0001", "CF-1234", "CF-9999"]
    for tid in valid_ids:
        assert TrackingIDGenerator.validate_tracking_id_format(tid)
    
    # Invalid formats
    invalid_ids = ["CF-123", "CF-12345", "CFX-0001", "CF-ABC1", "cf-0001"]
    for tid in invalid_ids:
        assert not TrackingIDGenerator.validate_tracking_id_format(tid)


def test_is_database_initialized():
    """Test database initialization status checking"""
    # Initially should be uninitialized - create fresh engine without tables
    uninit_engine = create_engine("sqlite:///:memory:", echo=False)
    status = is_database_initialized(uninit_engine)
    assert not status["tables_created"]
    assert not status["departments_seeded"]
    

def test_get_database_stats(temp_db_engine):
    """Test database statistics retrieval"""
    stats = get_database_stats(temp_db_engine)
    
    # Should return proper structure
    expected_keys = ["departments", "complaints", "assets", "status_events", "image_hashes"]
    for key in expected_keys:
        assert key in stats
        assert isinstance(stats[key], int)


@pytest.mark.asyncio
async def test_full_database_initialization(temp_db_engine, temp_data_dir):
    """Test complete database initialization process"""
    # Run full initialization
    await run_database_initialization(temp_db_engine, temp_data_dir)
    
    # Check that everything was initialized
    status = is_database_initialized(temp_db_engine)
    assert status["tables_created"]
    assert status["departments_seeded"]
    assert status["assets_seeded"]
    
    # Check statistics
    stats = get_database_stats(temp_db_engine)
    assert stats["departments"] == 5
    assert stats["assets"] > 0
    assert stats["complaints"] == 0  # No complaints initially
    
    # Verify data directory was created and populated
    data_path = Path(temp_data_dir)
    assert data_path.exists()
    
    expected_files = ["municipal_slas.txt", "contractor_warranties.txt", "escalation_policy.txt"]
    for filename in expected_files:
        file_path = data_path / filename
        assert file_path.exists()
        assert file_path.stat().st_size > 0  # File should have content


@pytest.mark.asyncio 
async def test_database_initialization_idempotent(temp_db_engine, temp_data_dir):
    """Test that full database initialization is idempotent"""
    # Run initialization twice
    await run_database_initialization(temp_db_engine, temp_data_dir)
    initial_stats = get_database_stats(temp_db_engine)
    
    await run_database_initialization(temp_db_engine, temp_data_dir)
    final_stats = get_database_stats(temp_db_engine)
    
    # Statistics should be identical
    assert initial_stats == final_stats


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
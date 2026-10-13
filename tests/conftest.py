"""
CivicFix AI Test Configuration

Pytest configuration and fixtures for the CivicFix AI test suite.
Provides test database setup, API client fixtures, and test utilities.
"""

import pytest
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

# Note: TestClient import will be enabled when httpx is installed in later tasks
# from fastapi.testclient import TestClient
# from app.main import app
# from app.models import *


@pytest.fixture(name="session")
def session_fixture():
    """Create a fresh database session for testing"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    
    with Session(engine) as session:
        yield session


# @pytest.fixture(name="client")
# def client_fixture(session: Session):
#     """Create a FastAPI test client with test database"""
#     
#     def get_session_override():
#         return session
#     
#     app.dependency_overrides[get_session] = get_session_override
#     client = TestClient(app)
#     yield client
#     app.dependency_overrides.clear()


# @pytest.fixture
# def sample_departments(session: Session):
#     """Create sample departments for testing"""
#     departments = [
#         Department(
#             name="Roads Department",
#             email="roads@test.gov",
#             whatsapp_contact="+92-300-1234567"
#         ),
#         Department(
#             name="Water & Sanitation", 
#             email="water@test.gov",
#             whatsapp_contact="+92-300-1234568"
#         ),
#     ]
#     
#     for dept in departments:
#         session.add(dept)
#     
#     session.commit()
#     return departments


# @pytest.fixture
# def sample_complaint(session: Session, sample_departments):
#     """Create a sample complaint for testing"""
#     complaint = Complaint(
#         tracking_id="CF-0001",
#         category="pothole",
#         summary="Test pothole complaint",
#         description="A large pothole on main street",
#         sentiment="negative",
#         urgency_score=5,
#         department_id=sample_departments[0].id,
#         latitude=33.6844,
#         longitude=73.0479,
#     )
#     
#     session.add(complaint)
#     session.commit()
#     session.refresh(complaint)
#     return complaint
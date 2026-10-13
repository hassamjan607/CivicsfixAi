"""
CivicFix AI Database Initialization

Database initialization, seeding, and setup functions including:
- Table creation with proper indexes
- Department seeding from config.py
- Sample asset data for testing
- RAG document preparation and sqlite-vec setup

All functions are idempotent and safe to run multiple times.
"""

import os
import sqlite3
from datetime import datetime, date, timedelta
from typing import List, Dict, Any
from sqlmodel import SQLModel, Session, create_engine, select, text
from pathlib import Path

from .models import (
    Department, Complaint, Asset, StatusEvent, ImageHash, 
    TrackingIDGenerator
)
from .config import DEPARTMENTS_DATA, ComplaintCategory, ComplaintStatus


async def create_database_tables(engine) -> None:
    """
    Create all database tables with proper indexes.
    Idempotent - safe to run multiple times.
    """
    print("🗄️  Creating database tables...")
    
    # Create all tables defined in SQLModel
    SQLModel.metadata.create_all(engine)
    
    # Create additional indexes for performance
    with Session(engine) as session:
        try:
            # Compound indexes for common query patterns
            session.exec(text("""
                CREATE INDEX IF NOT EXISTS idx_complaint_dept_status 
                ON complaint (department_id, status)
            """))
            
            session.exec(text("""
                CREATE INDEX IF NOT EXISTS idx_complaint_location 
                ON complaint (latitude, longitude) 
                WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            """))
            
            session.exec(text("""
                CREATE INDEX IF NOT EXISTS idx_complaint_created_category 
                ON complaint (created_at, category)
            """))
            
            session.exec(text("""
                CREATE INDEX IF NOT EXISTS idx_complaint_urgency_sla 
                ON complaint (urgency_score DESC, sla_deadline ASC)
            """))
            
            session.exec(text("""
                CREATE INDEX IF NOT EXISTS idx_asset_location 
                ON asset (latitude, longitude)
            """))
            
            session.exec(text("""
                CREATE INDEX IF NOT EXISTS idx_imagehash_value 
                ON imagehash (hash_value)
            """))
            
            session.exec(text("""
                CREATE INDEX IF NOT EXISTS idx_statusevent_complaint_time 
                ON statusevent (complaint_id, timestamp DESC)
            """))
            
            session.commit()
            print("✅ Database indexes created successfully")
            
        except Exception as e:
            session.rollback()
            print(f"⚠️  Index creation encountered issues: {e}")
            # Don't raise - tables are more important than indexes


async def seed_departments(engine) -> None:
    """
    Seed departments from DEPARTMENTS_DATA in config.py.
    Idempotent - updates existing departments, creates new ones.
    """
    print("🏢 Seeding departments...")
    
    with Session(engine) as session:
        try:
            departments_created = 0
            departments_updated = 0
            
            for dept_data in DEPARTMENTS_DATA:
                # Check if department already exists
                existing_dept = session.exec(
                    select(Department).where(Department.name == dept_data["name"])
                ).first()
                
                if existing_dept:
                    # Update existing department
                    existing_dept.email = dept_data["email"]
                    existing_dept.whatsapp_contact = dept_data.get("whatsapp_contact")
                    existing_dept.supervisor_contact = dept_data.get("supervisor_contact")
                    departments_updated += 1
                    print(f"   📝 Updated: {dept_data['name']}")
                else:
                    # Create new department
                    department = Department(
                        name=dept_data["name"],
                        email=dept_data["email"],
                        whatsapp_contact=dept_data.get("whatsapp_contact"),
                        supervisor_contact=dept_data.get("supervisor_contact")
                    )
                    session.add(department)
                    departments_created += 1
                    print(f"   ➕ Created: {dept_data['name']}")
            
            session.commit()
            print(f"✅ Departments seeded: {departments_created} created, {departments_updated} updated")
            
        except Exception as e:
            session.rollback()
            print(f"❌ Error seeding departments: {e}")
            raise


async def setup_sqlite_vec_extension(engine) -> None:
    """
    Setup sqlite-vec extension for RAG functionality.
    Creates vector table for document embeddings.
    Idempotent - safe to run multiple times.
    """
    print("🔍 Setting up sqlite-vec extension...")
    
    with Session(engine) as session:
        try:
            # Try to load sqlite-vec extension
            try:
                session.exec(text("SELECT load_extension('vec0')"))
                print("   📦 sqlite-vec extension loaded successfully")
            except Exception as ext_error:
                print(f"   ⚠️  Could not load sqlite-vec extension: {ext_error}")
                print("   📝 RAG functionality will be limited without vector search")
                return
            
            # Create vector table for document chunks
            session.exec(text("""
                CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
                    chunk_id INTEGER PRIMARY KEY,
                    content TEXT,
                    source_file TEXT,
                    paragraph_number INTEGER,
                    embedding(768)
                )
            """))
            
            # Create metadata table for document tracking
            session.exec(text("""
                CREATE TABLE IF NOT EXISTS document_metadata (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename TEXT UNIQUE NOT NULL,
                    file_path TEXT NOT NULL,
                    file_size INTEGER,
                    last_modified TIMESTAMP,
                    chunk_count INTEGER DEFAULT 0,
                    indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            
            session.commit()
            print("✅ sqlite-vec extension setup completed")
            
        except Exception as e:
            session.rollback()
            print(f"❌ Error setting up sqlite-vec: {e}")
            # Don't raise - system can work without RAG initially


async def seed_sample_assets(engine) -> None:
    """
    Create sample asset data for testing.
    Idempotent - only creates assets if none exist.
    """
    print("🏗️  Seeding sample assets...")
    
    with Session(engine) as session:
        try:
            # Check if assets already exist
            existing_count = session.exec(select(Asset)).first()
            if existing_count:
                print("   📋 Sample assets already exist, skipping...")
                return
            
            # Sample assets around Karachi, Lahore, and Islamabad
            sample_assets = [
                # Karachi assets
                Asset(
                    asset_type="Water Pipe",
                    latitude=24.8607,
                    longitude=67.0011,
                    warranty_expiry=date(2025, 12, 31),
                    contractor_name="Karachi Water Works"
                ),
                Asset(
                    asset_type="Street Light",
                    latitude=24.8615,
                    longitude=67.0020,
                    warranty_expiry=date(2024, 6, 30),
                    contractor_name="City Lighting Solutions"
                ),
                Asset(
                    asset_type="Road Section",
                    latitude=24.8625,
                    longitude=67.0005,
                    warranty_expiry=date(2026, 3, 15),
                    contractor_name="Metro Construction Co."
                ),
                
                # Lahore assets
                Asset(
                    asset_type="Sewage Line",
                    latitude=31.5497,
                    longitude=74.3436,
                    warranty_expiry=date(2025, 9, 20),
                    contractor_name="Punjab Sanitation Services"
                ),
                Asset(
                    asset_type="Street Light",
                    latitude=31.5504,
                    longitude=74.3428,
                    warranty_expiry=date(2024, 8, 10),
                    contractor_name="Lahore Electric Supply"
                ),
                Asset(
                    asset_type="Water Hydrant",
                    latitude=31.5510,
                    longitude=74.3445,
                    warranty_expiry=date(2027, 1, 30),
                    contractor_name="Fire Safety Systems Ltd"
                ),
                
                # Islamabad assets
                Asset(
                    asset_type="Traffic Signal",
                    latitude=33.6844,
                    longitude=73.0479,
                    warranty_expiry=date(2025, 4, 12),
                    contractor_name="Smart Traffic Solutions"
                ),
                Asset(
                    asset_type="Road Section", 
                    latitude=33.6850,
                    longitude=73.0485,
                    warranty_expiry=date(2024, 11, 25),
                    contractor_name="Capital Construction Group"
                ),
                Asset(
                    asset_type="Waste Container",
                    latitude=33.6838,
                    longitude=73.0472,
                    warranty_expiry=date(2025, 7, 18),
                    contractor_name="Green Waste Management"
                ),
                
                # Additional test assets with expired warranties
                Asset(
                    asset_type="Old Street Light",
                    latitude=24.8600,
                    longitude=67.0000,
                    warranty_expiry=date(2023, 12, 31),  # Expired
                    contractor_name="Legacy Lighting Co."
                ),
                Asset(
                    asset_type="Water Pipe",
                    latitude=31.5490,
                    longitude=74.3440,
                    warranty_expiry=None,  # No warranty
                    contractor_name="Municipal Works Dept"
                ),
            ]
            
            for asset in sample_assets:
                session.add(asset)
            
            session.commit()
            print(f"✅ Sample assets seeded: {len(sample_assets)} assets created")
            
        except Exception as e:
            session.rollback()
            print(f"❌ Error seeding sample assets: {e}")
            raise


async def prepare_rag_documents(engine, data_dir: str = "data") -> None:
    """
    Prepare RAG document setup by ensuring data directory exists
    and basic document tracking is initialized.
    Idempotent - safe to run multiple times.
    """
    print("📚 Preparing RAG documents...")
    
    try:
        # Ensure data directory exists
        data_path = Path(data_dir)
        data_path.mkdir(exist_ok=True)
        
        # Create sample regulation files if they don't exist
        sample_files = {
            "municipal_slas.txt": """Municipal Service Level Agreements

1. WATER & SANITATION DEPARTMENT
   - Water leak repairs: 24 hours maximum response time
   - Sewage blockage: 12 hours emergency response
   - Water quality complaints: 48 hours investigation

2. ROADS DEPARTMENT  
   - Pothole repairs: 72 hours for major roads, 168 hours for minor roads
   - Road damage from utilities: 48 hours temporary fix, 30 days permanent
   - Traffic signal malfunctions: 4 hours emergency response

3. SOLID WASTE MANAGEMENT
   - Garbage collection missed: 24 hours makeup collection
   - Illegal dumping cleanup: 48 hours removal
   - Waste container replacement: 72 hours

4. ELECTRICAL DEPARTMENT
   - Street light outages: 12 hours repair during monsoon, 24 hours normal
   - Public building electrical issues: 8 hours emergency response
   - New connection requests: 15 working days processing

5. GENERAL ADMINISTRATION
   - General complaints: 168 hours (7 days) acknowledgment and routing
   - Document requests: 72 hours processing
   - Public inquiries: 48 hours response
""",

            "contractor_warranties.txt": """Contractor Warranty Information

ACTIVE CONTRACTORS:

1. Karachi Water Works
   - Service Area: Karachi South, Central
   - Warranty Period: 2 years for major infrastructure, 1 year for repairs
   - Contact: +92-21-111-KWW (559)
   - Specialties: Water supply, pipeline maintenance

2. City Lighting Solutions  
   - Service Area: Karachi, Lahore metro areas
   - Warranty Period: 18 months LED fixtures, 12 months conventional
   - Contact: +92-300-LIGHTS (544487)
   - Specialties: Street lighting, public building electrical

3. Metro Construction Co.
   - Service Area: Major highways, arterial roads
   - Warranty Period: 5 years structural, 2 years surface
   - Contact: +92-42-METRO-1 (638761)
   - Specialties: Road construction, bridge maintenance

4. Punjab Sanitation Services
   - Service Area: Punjab province municipalities  
   - Warranty Period: 3 years sewage lines, 1 year cleaning services
   - Contact: +92-42-SANIT-8 (726488)
   - Specialties: Sewage systems, waste water treatment

5. Smart Traffic Solutions
   - Service Area: Islamabad, Rawalpindi
   - Warranty Period: 24 months hardware, 36 months software
   - Contact: +92-51-SMART-1 (762781)
   - Specialties: Traffic management, intelligent systems

WARRANTY TERMS:
- All warranties begin from completion/handover date
- Contractor responsible for defects arising from workmanship
- Emergency repairs covered 24/7 during warranty period
- Municipality retains 10% payment as warranty security
""",

            "escalation_policy.txt": """Complaint Escalation Policy

ESCALATION TRIGGERS:
1. SLA deadline exceeded without status update
2. Complaint marked as high urgency (score 8+) remains unassigned > 2 hours  
3. Citizen complaint filed about same issue 3+ times
4. Vulnerable group complaint (elderly, disabled, children) > 6 hours unresolved

ESCALATION LEVELS:

LEVEL 1 - Department Supervisor
- Triggered: After SLA deadline + 4 hours
- Action: Email + WhatsApp notification to department supervisor
- Response Required: 2 hours acknowledgment

LEVEL 2 - Department Head
- Triggered: Level 1 + 8 hours no response
- Action: SMS + email to department head, CC municipal secretary  
- Response Required: 4 hours with action plan

LEVEL 3 - Municipal Secretary
- Triggered: Level 2 + 12 hours no resolution
- Action: Direct notification to municipal secretary office
- Response Required: 2 hours with intervention plan

LEVEL 4 - Public Disclosure
- Triggered: Level 3 + 24 hours no resolution  
- Action: Complaint published on public dashboard with official delays
- Response Required: Immediate public response required

SPECIAL ESCALATIONS:
- Emergency keywords (live wire, gas leak, open manhole): Immediate Level 2
- Media attention: Immediate Level 3
- Safety hazard complaints: Immediate Level 2
- Recurring infrastructure failure (3+ same location): Immediate Level 2

SUPERVISOR CONTACTS:
- Roads Dept: roads.supervisor@municipality.gov, +92-300-ROADS-1
- Water & Sanitation: water.head@municipality.gov, +92-300-WATER-1  
- Waste Management: waste.manager@municipality.gov, +92-300-WASTE-1
- Electrical: electrical.chief@municipality.gov, +92-300-ELECT-1
- Administration: admin.secretary@municipality.gov, +92-300-ADMIN-1
"""
        }
        
        files_created = 0
        for filename, content in sample_files.items():
            file_path = data_path / filename
            if not file_path.exists():
                file_path.write_text(content, encoding='utf-8')
                files_created += 1
                print(f"   📄 Created: {filename}")
            else:
                print(f"   📋 Exists: {filename}")
        
        print(f"✅ RAG documents prepared: {files_created} files created")
        
        # Initialize document metadata in database
        with Session(engine) as session:
            try:
                for filename in sample_files.keys():
                    file_path = data_path / filename
                    if file_path.exists():
                        # Check if already tracked
                        try:
                            existing_check = session.exec(text(
                                "SELECT COUNT(*) FROM document_metadata WHERE filename = ?"
                            ), [filename]).first()
                            
                            if existing_check == 0:
                                session.exec(text("""
                                    INSERT OR IGNORE INTO document_metadata 
                                    (filename, file_path, file_size, last_modified)
                                    VALUES (?, ?, ?, ?)
                                """), (
                                    filename,
                                    str(file_path),
                                    file_path.stat().st_size,
                                    datetime.fromtimestamp(file_path.stat().st_mtime)
                                ))
                        except Exception as doc_error:
                            print(f"   ⚠️  Document metadata error for {filename}: {doc_error}")
                
                session.commit()
                print("✅ Document metadata initialized")
                
            except Exception as e:
                # If document_metadata table doesn't exist yet, that's okay
                print(f"   📝 Document metadata setup deferred: {e}")
        
    except Exception as e:
        print(f"❌ Error preparing RAG documents: {e}")
        raise


async def initialize_tracking_sequence(engine) -> None:
    """
    Initialize the tracking ID sequence system.
    Idempotent - safe to run multiple times.
    """
    print("🔢 Initializing tracking ID sequence...")
    
    with Session(engine) as session:
        try:
            TrackingIDGenerator.initialize_sequence(session)
            print("✅ Tracking ID sequence initialized")
            
        except Exception as e:
            print(f"❌ Error initializing tracking sequence: {e}")
            # Don't raise - the system has fallback mechanisms


async def run_database_initialization(engine, data_dir: str = "data") -> None:
    """
    Run complete database initialization including all setup tasks.
    This is the main entry point called from main.py.
    
    Args:
        engine: SQLModel database engine
        data_dir: Directory containing RAG documents
    """
    print("🚀 Starting database initialization...")
    
    try:
        # Step 1: Create tables and indexes
        await create_database_tables(engine)
        
        # Step 2: Initialize tracking sequence
        await initialize_tracking_sequence(engine)
        
        # Step 3: Seed departments
        await seed_departments(engine)
        
        # Step 4: Setup sqlite-vec extension  
        await setup_sqlite_vec_extension(engine)
        
        # Step 5: Seed sample assets
        await seed_sample_assets(engine)
        
        # Step 6: Prepare RAG documents
        await prepare_rag_documents(engine, data_dir)
        
        print("✅ Database initialization completed successfully!")
        
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        raise


# Utility functions for checking initialization status

def is_database_initialized(engine) -> Dict[str, bool]:
    """
    Check which parts of database initialization have been completed.
    Returns dict with status of each component.
    """
    status = {
        "tables_created": False,
        "departments_seeded": False,
        "assets_seeded": False,
        "sqlite_vec_setup": False,
        "rag_documents_ready": False
    }
    
    try:
        with Session(engine) as session:
            # Check tables
            try:
                session.exec(select(Department)).first()
                status["tables_created"] = True
            except:
                pass
            
            # Check departments
            try:
                dept_count = len(list(session.exec(select(Department))))
                status["departments_seeded"] = dept_count > 0
            except:
                pass
            
            # Check assets
            try:
                asset_count = len(list(session.exec(select(Asset))))
                status["assets_seeded"] = asset_count > 0
            except:
                pass
            
            # Check sqlite-vec
            try:
                session.exec(text("SELECT name FROM sqlite_master WHERE name='vec_chunks'")).first()
                status["sqlite_vec_setup"] = True
            except:
                pass
            
            # Check RAG documents
            data_path = Path("data")
            status["rag_documents_ready"] = (
                data_path.exists() and 
                (data_path / "municipal_slas.txt").exists()
            )
                
    except Exception as e:
        print(f"⚠️  Error checking initialization status: {e}")
    
    return status


def get_database_stats(engine) -> Dict[str, Any]:
    """
    Get basic statistics about the database contents.
    """
    stats = {
        "departments": 0,
        "complaints": 0,
        "assets": 0,
        "status_events": 0,
        "image_hashes": 0
    }
    
    try:
        with Session(engine) as session:
            stats["departments"] = len(list(session.exec(select(Department))))
            stats["complaints"] = len(list(session.exec(select(Complaint))))
            stats["assets"] = len(list(session.exec(select(Asset))))
            stats["status_events"] = len(list(session.exec(select(StatusEvent))))
            stats["image_hashes"] = len(list(session.exec(select(ImageHash))))
            
    except Exception as e:
        print(f"⚠️  Error getting database stats: {e}")
    
    return stats
# Implementation Plan: CivicFix AI

## Overview

CivicFix AI is a voice-first municipal complaint platform with an AI-powered backend using FastAPI, SQLite, and Groq LLM for complaint processing. The implementation follows a three-tier architecture: Next.js frontend, FastAPI backend with pure Python rules engine, and SQLite database. The system processes complaints in Urdu/English, scores urgency 1-10, detects duplicates, and routes to appropriate departments with notifications.

## Tasks

- [x] 1. Setup project structure and core dependencies
  - Create FastAPI backend structure with main.py entry point
  - Setup SQLite database with SQLModel integration
  - Configure environment variables and config.py constants
  - Initialize Next.js frontend with TypeScript and Tailwind CSS
  - Setup development dependencies and testing framework (pytest, hypothesis)
  - _Requirements: 23.1, 23.2, 24.1_

- [x] 2. Implement core data models and database layer
  - [x] 2.1 Create SQLModel table definitions in models.py
    - Define Complaint, Department, Asset, StatusEvent, ImageHash models
    - Implement tracking ID generation (CF-XXXX format)
    - Setup foreign key relationships and indexes
    - _Requirements: 23.1, 23.2, 10.1_

  - [x] 2.2 Write property test for tracking ID generation
    - **Property 5: Tracking ID Format Invariant**
    - **Validates: Requirements 10.1, 1.4**

  - [x] 2.3 Implement database initialization and seeding
    - Create database tables on startup
    - Seed departments from config.py mappings
    - Setup sqlite-vec extension for RAG functionality
    - _Requirements: 23.6, 9.1_

  - [x] 2.4 Write unit tests for model validation
    - Test field constraints and relationships
    - Test JSON serialization for urgency_reasons field
    - _Requirements: 23.1_

- [x] 3. Build urgency scoring rules engine
  - [x] 3.1 Implement pure Python rules engine in rules.py
    - Create compute_urgency function with formula implementation
    - Implement emergency keyword override logic
    - Add scoring reasons generation
    - Read all thresholds from config.py
    - _Requirements: 6.1, 6.4, 6.5, 6.7_

  - [x] 3.2 Write property test for urgency score bounds
    - **Property 1: Urgency Score Bounds and Formula Correctness**
    - **Validates: Requirements 6.1, 6.4**

  - [x] 3.3 Write property test for emergency override
    - **Property 2: Emergency Override Supremacy**
    - **Validates: Requirements 6.5**

  - [x] 3.4 Write property test for recurrence bonus tiers
    - **Property 8: Recurrence Bonus Tiers**
    - **Validates: Requirements 14.3, 14.4, 14.5**

- [ ] 4. Implement AI agent for complaint extraction
  - [ ] 4.1 Create agent.py with Groq Llama integration
    - Setup Instructor with Groq AsyncGroq client
    - Define ComplaintExtraction Pydantic schema
    - Implement extraction with confidence scoring
    - Add LiteLLM fallback for Groq failures
    - _Requirements: 11.1, 11.2, 11.4, 1.2_

  - [x] 4.2 Write property test for agent schema compliance
    - **Property 13: Agent Extraction Schema Compliance**
    - **Validates: Requirements 11.1, 1.2**

  - [x] 4.3 Write property test for single missing field follow-up
    - **Property 14: Single Missing-Field Follow-Up**
    - **Validates: Requirements 1.3**

- [ ] 5. Build context services for weather and location
  - [ ] 5.1 Implement context.py with async weather and places fetchers
    - Create get_weather_bonus function using Open-Meteo API
    - Implement get_nearby_sensitive_places using OSM Overpass
    - Add timeout handling and graceful degradation
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 5.2, 5.3_

  - [x] 5.2 Write property test for weather bonus tiers
    - **Property 4: Weather Bonus Tier Correctness**
    - **Validates: Requirements 7.2, 7.3, 7.4**

- [ ] 6. Implement duplicate detection and clustering
  - [ ] 6.1 Create dedup.py with image and location-based deduplication
    - Implement compute_image_hash using imagehash
    - Create is_duplicate_image with similarity checking
    - Add haversine_meters distance calculation
    - Implement find_duplicate_complaint with radius and time window
    - _Requirements: 8.1, 8.3, 4.4, 4.5_

  - [x] 6.2 Write property test for deduplication radius
    - **Property 6: Deduplication Radius Correctness**
    - **Validates: Requirements 8.1**

  - [x] 6.3 Write property test for duplicate count monotonicity
    - **Property 7: Duplicate Count Monotonicity**
    - **Validates: Requirements 8.3, 14.1**

  - [x] 6.4 Write property test for duplicate image detection
    - **Property 15: Duplicate Image Detection Round-Trip**
    - **Validates: Requirements 4.4, 4.5**

- [x] 7. Build vision service for photo analysis
  - [x] 7.1 Implement vision.py with Gemini Flash integration
    - Create VisionResult Pydantic model for severity and description
    - Implement photo analysis with structured prompts
    - Add face and license plate blurring using Pillow/OpenCV
    - Handle vision service failures gracefully
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 4.3_

  - [x] 7.2 Write property test for severity label mapping
    - **Property 3: Severity Label to Integer Mapping Validity**
    - **Validates: Requirements 6.2, 12.2**

  - [x] 7.3 Write property test for fraud detection
    - **Property 16: Fraud Detection via Before/After Hash Match**
    - **Validates: Requirements 15.1, 15.2**

- [ ] 8. Create notification service
  - [x] 8.1 Implement notify.py with email and WhatsApp integration
    - Setup Resend email client for department notifications
    - Implement WhatsApp Cloud API integration
    - Add retry logic with exponential backoff
    - Create escalation notification for supervisors
    - _Requirements: 9.3, 9.4, 9.5, 6.6, 13.4_

  - [ ] 8.2 Write unit tests for notification retry logic
    - Test failure scenarios and retry attempts
    - Verify no exceptions propagate to caller
    - _Requirements: 9.5_

- [ ] 9. Implement FastAPI main application and routing
  - [ ] 9.1 Create main.py with core API endpoints
    - Setup FastAPI app with CORS and middleware
    - Implement rate limiting middleware (30 requests/minute)
    - Add file size limiting middleware (5MB max)
    - Create /chat endpoint for complaint submission
    - Add /transcribe endpoint for audio processing
    - _Requirements: 1.1, 1.7, 2.1, 2.4, 24.3, 24.4_

  - [ ] 9.2 Implement complaint management endpoints
    - Create POST /complaints/submit with multipart support
    - Add GET /complaints/{tracking_id} with nearby assets
    - Implement PATCH /complaints/{id}/status for officer updates
    - _Requirements: 4.1, 4.2, 10.4, 10.5, 22.1_

  - [ ] 9.3 Write property test for file size rejection
    - **Property 22: File Size Rejection**
    - **Validates: Requirements 24.3, 2.5, 4.2**

  - [ ] 9.4 Write property test for graceful degradation
    - **Property 23: Graceful Degradation — Tracking ID Always Returned**
    - **Validates: Requirements 25.1, 25.3, 1.6**

- [ ] 10. Build officer and admin API endpoints
  - [ ] 10.1 Implement officer queue endpoints
    - Create GET /officer/complaints with sorting and filtering
    - Add complaint status update functionality
    - Implement proof photo upload handling
    - _Requirements: 18.1, 18.2, 18.3_

  - [ ] 10.2 Write property test for officer queue sort order
    - **Property 18: Officer Queue Sort Order**
    - **Validates: Requirements 18.2**

  - [ ] 10.3 Implement admin dashboard endpoints
    - Create GET /admin/heatmap for geographic visualization
    - Add GET /admin/stats for aggregate statistics
    - Implement GET /admin/complaints with comprehensive filtering
    - _Requirements: 19.1, 19.2, 19.3_

  - [ ] 10.4 Write property test for heatmap weight correctness
    - **Property 20: Heatmap Weight Correctness**
    - **Validates: Requirements 19.1**

  - [ ] 10.5 Write property test for admin filter soundness
    - **Property 19: Admin Filter Soundness**
    - **Validates: Requirements 18.3, 19.3**

- [ ] 11. Implement human review queue system
  - [ ] 11.1 Create review queue endpoints
    - Implement GET /review-queue for low-confidence submissions
    - Add POST /review/{id}/approve for manual corrections
    - Handle re-routing and re-notification after approval
    - _Requirements: 16.1, 16.2, 16.3_

  - [ ] 11.2 Write unit tests for review queue workflow
    - Test confidence threshold triggering
    - Verify officer approval flow
    - _Requirements: 11.3, 16.2_

- [ ] 12. Build RAG service for regulation queries
  - [ ] 12.1 Implement rag.py with LlamaIndex and sqlite-vec
    - Setup document indexing with FastEmbed embeddings
    - Implement query_regulations with similarity search
    - Create RegulationAnswer model with source attribution
    - Add document loading from data/ directory
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_

  - [ ] 12.2 Create POST /ask-regulations endpoint
    - Integrate RAG service with FastAPI routing
    - Handle empty results gracefully
    - Return structured answers with sources
    - _Requirements: 20.1, 20.4_

  - [ ] 12.3 Write property test for RAG source attribution
    - **Property 21: RAG Source Attribution**
    - **Validates: Requirements 20.1, 20.2**

- [ ] 13. Implement background task scheduling
  - [ ] 13.1 Setup APScheduler for SLA monitoring
    - Create SLA breach checking background job (every 15 minutes)
    - Implement complaint escalation logic
    - Add supervisor notification for breaches
    - _Requirements: 13.3, 13.4, 13.5_

  - [ ] 13.2 Write property test for SLA deadline arithmetic
    - **Property 11: SLA Deadline Arithmetic**
    - **Validates: Requirements 13.1, 13.2**

  - [ ] 13.3 Write property test for SLA escalation trigger
    - **Property 12: SLA Escalation Trigger Correctness**
    - **Validates: Requirements 13.3**

- [ ] 14. Create simulation and testing endpoints
  - [ ] 14.1 Implement POST /simulate endpoint
    - Create simulator that uses mock AI responses
    - Execute full pipeline without external API calls
    - Return complete simulated complaint record
    - _Requirements: 21.1, 21.2, 21.3_

  - [ ] 14.2 Write property test for simulator isolation
    - **Property 25: Simulator Isolation**
    - **Validates: Requirements 21.1, 21.2, 21.3**

- [ ] 15. Build Next.js frontend components
  - [ ] 15.1 Create citizen chat interface
    - Implement voice input using Web Speech API
    - Add Groq Whisper fallback for STT
    - Create voice output using speechSynthesis API
    - Build chat UI with Urdu/English support
    - _Requirements: 1.1, 2.2, 2.3, 3.1, 3.2_

  - [ ] 15.2 Build officer queue interface
    - Create complaint queue with shadcn/ui DataTable
    - Implement filtering and sorting controls
    - Add complaint detail view with status updates
    - Include proof photo upload functionality
    - _Requirements: 18.1, 18.2, 18.3_

  - [ ] 15.3 Implement admin dashboard
    - Create Leaflet.js heatmap with complaint data
    - Build statistics cards with Recharts visualizations
    - Add SLA performance tracking charts
    - Implement escalation alerts panel
    - _Requirements: 19.1, 19.2, 19.4, 19.5, 19.6_

- [ ] 16. Checkpoint - Core system functional testing
  - Ensure all API endpoints respond correctly
  - Verify complaint submission and tracking workflow
  - Test urgency scoring and duplicate detection
  - Validate notification sending
  - Ask user if questions arise

- [ ] 17. Implement advanced features and integrations
  - [ ] 17.1 Add anonymous mode functionality
    - Implement PII exclusion for anonymous complaints
    - Ensure tracking ID generation works without citizen data
    - Skip notifications when contact details are missing
    - _Requirements: 17.1, 17.2, 17.3_

  - [ ] 17.2 Write property test for anonymous mode PII exclusion
    - **Property 17: Anonymous Mode PII Exclusion**
    - **Validates: Requirements 17.1, 17.2**

  - [ ] 17.3 Implement warranty and asset lookup
    - Create nearby assets query within 30m radius
    - Add warranty status checking
    - Include contractor information in responses
    - _Requirements: 22.1, 22.2, 22.3_

  - [ ] 17.4 Write property test for nearby assets radius
    - **Property 26: Nearby Assets Radius Correctness**
    - **Validates: Requirements 22.1**

- [ ] 18. Add comprehensive error handling and security
  - [ ] 18.1 Implement category-to-department routing
    - Create department mapping from config.py
    - Ensure all categories map to valid departments
    - Handle routing after complaint creation
    - _Requirements: 9.1, 9.2_

  - [ ] 18.2 Write property test for category routing completeness
    - **Property 10: Category-to-Department Routing Completeness**
    - **Validates: Requirements 9.1, 9.2**

  - [ ] 18.3 Add root cause flag detection
    - Implement recurrence counting for duplicate complaints
    - Set root_cause_flag when threshold reached
    - Apply recurrence bonus to urgency scoring
    - _Requirements: 14.1, 14.2, 14.3_

  - [ ] 18.4 Write property test for root cause flag threshold
    - **Property 9: Root-Cause Flag Threshold**
    - **Validates: Requirements 14.2**

- [ ] 19. Implement status tracking and audit trail
  - [ ] 19.1 Create status event logging system
    - Record all complaint status transitions
    - Capture actor ID and timestamps
    - Ensure monotonic timestamp ordering
    - _Requirements: 10.6_

  - [ ] 19.2 Write property test for status event audit trail
    - **Property 24: Status Event Audit Trail**
    - **Validates: Requirements 10.6**

- [ ] 20. Final integration and testing
  - [ ] 20.1 Setup comprehensive integration tests
    - Test complete complaint submission workflow
    - Verify all AI service integrations work
    - Test error handling and fallback scenarios
    - _Requirements: 26.1, 26.2_

  - [ ] 20.2 Write end-to-end property tests
    - Test complete system with property-based scenarios
    - Verify all correctness properties hold
    - _Requirements: 26.2_

- [ ] 21. Final checkpoint - Complete system validation
  - Run all tests including property-based tests
  - Verify frontend-backend integration
  - Test voice input/output functionality
  - Validate notification systems
  - Ensure all requirements are met
  - Ask user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties from the design
- Unit tests validate specific examples and edge cases
- Checkpoints ensure incremental validation throughout development
- The system uses Python 3.11 with FastAPI, SQLModel, and SQLite
- AI services include Groq Llama 3.3 70B, Google Gemini Flash, and Groq Whisper
- Frontend uses Next.js with TypeScript, Tailwind CSS, and shadcn/ui components

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "3.2", "3.3", "3.4"] },
    { "id": 3, "tasks": ["4.1", "5.1", "6.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "5.2", "6.2", "6.3", "6.4", "7.1"] },
    { "id": 5, "tasks": ["7.2", "7.3", "8.1"] },
    { "id": 6, "tasks": ["8.2", "9.1"] },
    { "id": 7, "tasks": ["9.2", "9.3", "9.4"] },
    { "id": 8, "tasks": ["10.1", "10.3"] },
    { "id": 9, "tasks": ["10.2", "10.4", "10.5", "11.1"] },
    { "id": 10, "tasks": ["11.2", "12.1"] },
    { "id": 11, "tasks": ["12.2", "12.3", "13.1"] },
    { "id": 12, "tasks": ["13.2", "13.3", "14.1"] },
    { "id": 13, "tasks": ["14.2", "15.1"] },
    { "id": 14, "tasks": ["15.2", "15.3"] },
    { "id": 15, "tasks": ["17.1", "17.3"] },
    { "id": 16, "tasks": ["17.2", "17.4", "18.1"] },
    { "id": 17, "tasks": ["18.2", "18.3"] },
    { "id": 18, "tasks": ["18.4", "19.1"] },
    { "id": 19, "tasks": ["19.2", "20.1"] },
    { "id": 20, "tasks": ["20.2"] }
  ]
}
```
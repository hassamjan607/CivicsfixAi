# Requirements Document

## Introduction

CivicFix AI is a voice-first AI assistant that enables citizens to submit municipal complaints in Urdu or English via speech or text, optionally with a photo, and receive an immediate tracking ID. An AI agent (Groq Llama 3.3 70B + Instructor) extracts category, summary, sentiment, and urgency from the complaint; a pure-Python rules engine scores urgency 1–10 with transparent, explainable reasons; duplicate complaints within 30 metres and 7 days are merged; and complaints are auto-routed to the correct department with email/WhatsApp notifications. Three role-based views are provided: citizen chat, department-officer queue, and admin/supervisor dashboard. P1 features add weather-aware priority, photo-severity scoring via Gemini Flash, SLA escalation, fraud detection, and a human review queue. P2 features add RAG-powered regulation queries (LlamaIndex + FastEmbed + sqlite-vec), before/after photo verification, a live browser simulator, and warranty/contractor asset lookup.

The full technology stack is: FastAPI + SQLModel + SQLite (Python 3.11) for the backend; Next.js + Tailwind + shadcn/ui + Leaflet.js + Recharts for the frontend; Groq (Llama 3.3 70B) + Instructor for the AI agent; Google Gemini Flash for vision; Browser Web Speech API with Groq Whisper fallback for STT; Browser speechSynthesis for TTS; LiteLLM as an AI fallback; Resend and WhatsApp Cloud API / Twilio sandbox for notifications; imagehash + Pillow + geopy for deduplication; and httpx to Open-Meteo and OSM Overpass for context APIs.

---

## Glossary

- **System**: The CivicFix AI platform as a whole (backend + frontend + AI services).
- **Agent**: The AI conversation engine powered by Groq Llama 3.3 70B with Instructor Pydantic schemas that handles complaint extraction, classification, and follow-up questions.
- **Rules Engine**: The pure-Python urgency scoring module (`rules.py` / `config.py`) that computes urgency scores without AI inference.
- **RAG Service**: The retrieval-augmented generation pipeline built on LlamaIndex, FastEmbed, and sqlite-vec that answers regulation and SLA questions.
- **Vision Service**: The Google Gemini Flash integration (`vision.py`) that analyses complaint photos for severity and content moderation.
- **STT Service**: The speech-to-text pipeline using the Browser Web Speech API (ur-PK, en-US) with Groq Whisper as a fallback.
- **TTS Service**: The browser-side text-to-speech output via the Browser `speechSynthesis` API.
- **Dedup Service**: The duplicate-detection module using imagehash, Pillow, geopy Haversine, and SQLite to identify and merge duplicate complaints.
- **Notification Service**: The outbound notification module (`notify.py`) using Resend for email and WhatsApp Cloud API / Twilio sandbox for WhatsApp.
- **Citizen**: An end user who submits a complaint through the citizen-facing chat interface.
- **Officer**: A department employee who reviews and resolves complaints in the officer queue interface.
- **Admin**: A supervisor user who monitors the full complaint dataset via the admin dashboard.
- **Complaint**: A municipal issue record containing category, description, location, urgency score, status, and tracking ID.
- **Tracking ID**: A unique complaint identifier in the format `CF-XXXX` returned to the Citizen immediately after submission.
- **Cluster**: A group of duplicate or near-duplicate complaints merged by the Dedup Service.
- **Urgency Score**: An integer from 1 to 10 computed by the Rules Engine representing the priority of a complaint.
- **Emergency Override**: A condition triggered by keywords (live wire, open manhole, gas smell, live taar, khuli manhole) that sets the Urgency Score to 10 immediately.
- **SLA**: Service Level Agreement deadline (ranging from 2 hours to 168 hours) assigned to a Complaint by department and category.
- **Asset**: A municipal infrastructure item (pipe, road section, streetlight, etc.) stored in the `assets` table with a geolocation.
- **Human Review Queue**: A list of Complaints whose AI confidence score is below threshold, queued for manual Officer review.
- **Anonymous Mode**: A submission path in which the Citizen's personal identifiers are not stored.
- **Simulator**: A browser-only tool that exercises the complaint workflow without making real AI calls.
- **Heatmap**: A geographic density visualisation of complaints rendered with Leaflet.js and Leaflet.heat.

---

## Requirements

### Requirement 1 — Complaint Submission via Chat

**User Story:** As a Citizen, I want to submit a complaint by typing or speaking in Urdu or English, so that I can report a municipal issue without filling in a form.

#### Acceptance Criteria

1. THE System SHALL expose a `POST /chat` endpoint that accepts a JSON body containing at least a `message` field and an optional `session_id` field.
2. WHEN a `POST /chat` request is received, THE Agent SHALL extract the complaint category, one-sentence summary, sentiment label (positive/neutral/negative), and vulnerable-group flag from the message and return them in the response within 3 seconds.
3. WHEN the Agent determines that mandatory complaint fields (category, location, description) are missing after processing the message, THE Agent SHALL ask only for the single most important missing field in the response text.
4. WHILE a complaint session is active and all mandatory fields have been collected, THE System SHALL return a Tracking ID in `CF-XXXX` format in the `/chat` response immediately, before background tasks complete.
5. THE System SHALL accept messages in both Urdu (`ur-PK`) and English (`en-US`) and process them without language-selection input from the Citizen.
6. IF the Agent call fails or returns an error, THEN THE System SHALL add the complaint to the Human Review Queue and return a user-facing error message within 3 seconds, without crashing.
7. THE System SHALL enforce a rate limit on `POST /chat` so that no single client IP address can send more than 30 requests per minute.

---

### Requirement 2 — Voice Input (STT)

**User Story:** As a Citizen, I want to speak my complaint using a microphone, so that I can report issues hands-free without typing.

#### Acceptance Criteria

1. THE System SHALL expose a `POST /transcribe` endpoint that accepts an audio file upload and returns the transcribed text.
2. WHEN a `POST /transcribe` request is received, THE STT Service SHALL first attempt transcription using the Browser Web Speech API (`ur-PK` or `en-US` locale as detected).
3. IF the Browser Web Speech API is unavailable or returns an error, THEN THE STT Service SHALL transcribe the audio using Groq Whisper and return the result.
4. WHEN transcription succeeds, THE System SHALL return the transcribed text to the frontend within 5 seconds of receiving the audio file.
5. THE System SHALL reject audio uploads larger than 5 MB and return an HTTP 413 error with a descriptive message.

---

### Requirement 3 — Voice Output (TTS)

**User Story:** As a Citizen, I want the assistant's responses read aloud, so that I can interact with the system without reading.

#### Acceptance Criteria

1. THE System SHALL provide Agent response text in a format that the frontend can pass directly to the Browser `speechSynthesis` API.
2. WHEN the frontend receives an Agent response, THE TTS Service SHALL synthesise speech using the Browser `speechSynthesis` API in the language matching the Citizen's current input language.

---

### Requirement 4 — Photo Upload and Privacy Protection

**User Story:** As a Citizen, I want to attach a photo to my complaint, so that officers can see the issue clearly without my privacy being compromised.

#### Acceptance Criteria

1. THE System SHALL expose a `POST /complaints/submit` endpoint that accepts an optional image file alongside complaint fields.
2. THE System SHALL reject image uploads larger than 5 MB and return an HTTP 413 error.
3. WHEN an image is uploaded, THE Vision Service SHALL detect and blur all human faces and vehicle licence plates in the image before storing it.
4. WHEN an image is uploaded, THE Dedup Service SHALL compute a perceptual hash of the image using imagehash and compare it against all hashes stored in the `image_hashes` table.
5. IF the computed perceptual hash matches an existing hash within the defined similarity threshold, THEN THE System SHALL reject the submission as a duplicate image and return an HTTP 409 error with the Tracking ID of the original complaint.
6. WHEN an image is accepted, THE System SHALL store the hash in the `image_hashes` table alongside the complaint ID.

---

### Requirement 5 — GPS Auto-Location

**User Story:** As a Citizen, I want the system to auto-fill my location using my device GPS, so that I do not have to type my address.

#### Acceptance Criteria

1. THE System SHALL accept latitude and longitude coordinates in the `POST /chat` and `POST /complaints/submit` request bodies as optional fields.
2. WHEN coordinates are provided, THE System SHALL reverse-geocode them to a human-readable address using the OSM Overpass API via httpx and store both the coordinates and address in the Complaint record.
3. IF the OSM Overpass API is unavailable, THEN THE System SHALL store the raw coordinates without a reverse-geocoded address and continue complaint processing without error.

---

### Requirement 6 — Urgency Scoring

**User Story:** As an Officer, I want each complaint to carry an explainable urgency score from 1 to 10, so that I can prioritise the most critical issues.

#### Acceptance Criteria

1. WHEN a Complaint is created, THE Rules Engine SHALL compute an Urgency Score using the formula: `base_severity(1–6) + weather_bonus(0, +1, or +2) + recurrence_bonus(0, +1, or +2) + sensitive_place_bonus(0 or +1) + vulnerable_group_bonus(0 or +1)`, capped at 10.
2. THE Rules Engine SHALL derive `base_severity` from the Vision Service photo analysis result, mapping the Vision Service severity label to an integer in the range 1 to 6.
3. WHEN no photo is provided, THE Rules Engine SHALL use a default `base_severity` value of 3.
4. THE Rules Engine SHALL store the list of scoring reasons alongside the Urgency Score in the Complaint record, with one plain-language string per contributing factor.
5. WHEN the complaint text contains any of the keywords `live wire`, `open manhole`, `gas smell`, `live taar`, or `khuli manhole` (case-insensitive), THE Rules Engine SHALL set the Urgency Score to 10 immediately, bypassing all other formula components, and SHALL add `"Emergency override triggered"` to the reasons list.
6. IF the Urgency Score equals 10 due to Emergency Override, THEN THE Notification Service SHALL send an SMS and/or WhatsApp message to the assigned department within 60 seconds of complaint creation.
7. THE Rules Engine SHALL read all scoring thresholds and keyword lists exclusively from `config.py` so that score logic can be changed without editing `rules.py`.

---

### Requirement 7 — Weather-Aware Priority (P1)

**User Story:** As an Officer, I want complaint urgency to reflect current weather conditions, so that weather-exacerbated issues are prioritised correctly.

#### Acceptance Criteria

1. WHEN a Complaint is created and GPS coordinates are available, THE System SHALL fetch current weather data for those coordinates from the Open-Meteo API via httpx.
2. WHEN the Open-Meteo API returns a precipitation value greater than 10 mm/h, THE Rules Engine SHALL apply a `weather_bonus` of +2.
3. WHEN the Open-Meteo API returns a precipitation value greater than 0 mm/h and at most 10 mm/h, THE Rules Engine SHALL apply a `weather_bonus` of +1.
4. WHEN the Open-Meteo API returns a precipitation value of 0 mm/h, THE Rules Engine SHALL apply a `weather_bonus` of 0.
5. IF the Open-Meteo API is unavailable or returns an error, THEN THE Rules Engine SHALL apply a `weather_bonus` of 0 and continue scoring without error.

---

### Requirement 8 — Duplicate Detection and Cluster Merging

**User Story:** As an Admin, I want near-duplicate complaints automatically merged, so that officers are not overwhelmed by repeat reports of the same issue.

#### Acceptance Criteria

1. WHEN a new Complaint is submitted, THE Dedup Service SHALL query the `complaints` table for existing complaints of the same category submitted within the last 7 days whose GPS coordinates are within 30 metres of the new complaint's coordinates (Haversine distance).
2. IF one or more matching complaints are found, THEN THE System SHALL add the new Complaint to the existing Cluster rather than creating a standalone record, and SHALL return the Tracking ID of the original complaint to the Citizen along with an HTTP 200 response indicating a merge.
3. WHEN a Cluster is updated, THE System SHALL increment the `duplicate_count` field on the original Complaint record.
4. THE System SHALL store every image hash associated with a Cluster in the `image_hashes` table linked to the original complaint ID, so that future image-based duplicates are detected.

---

### Requirement 9 — Department Auto-Routing and Notifications

**User Story:** As an Officer, I want complaints routed to my department automatically, so that I receive only complaints relevant to my domain.

#### Acceptance Criteria

1. THE System SHALL maintain a category-to-department mapping in `config.py` that maps each supported complaint category to exactly one department record in the `departments` table.
2. WHEN a Complaint is created and an Urgency Score is assigned, THE System SHALL set the `department_id` field on the Complaint record according to the `config.py` category-to-department mapping.
3. WHEN a Complaint is routed to a department, THE Notification Service SHALL send an email to the department's registered address using Resend within 120 seconds of complaint creation.
4. WHEN a Complaint is routed to a department and a WhatsApp contact is registered for that department, THE Notification Service SHALL send a WhatsApp message via the WhatsApp Cloud API or Twilio sandbox within 120 seconds of complaint creation.
5. IF the Notification Service call fails, THEN THE System SHALL log the failure and schedule one retry, without blocking complaint creation or returning an error to the Citizen.

---

### Requirement 10 — Tracking ID and Status Lifecycle

**User Story:** As a Citizen, I want a tracking ID and real-time status updates for my complaint, so that I know it is being handled.

#### Acceptance Criteria

1. THE System SHALL generate a Tracking ID in the format `CF-XXXX` (where XXXX is a zero-padded four-digit sequential integer) for every accepted Complaint and return it in the `/chat` and `/complaints/submit` responses.
2. THE System SHALL support three Complaint status values: `Pending`, `In Progress`, and `Resolved`.
3. WHEN a new Complaint is created, THE System SHALL set its status to `Pending`.
4. THE System SHALL expose a `GET /complaints/{tracking_id}` endpoint that returns the current status, category, summary, urgency score, scoring reasons, and department name for the given Tracking ID.
5. THE System SHALL expose a `PATCH /complaints/{id}/status` endpoint that allows an Officer to update the Complaint status to `In Progress` or `Resolved`.
6. WHEN a Complaint status changes, THE System SHALL create a new record in the `status_events` table recording the old status, new status, timestamp, and actor ID.

---

### Requirement 11 — AI Category and Sentiment Extraction

**User Story:** As an Officer, I want the AI to extract a structured category and sentiment from each complaint, so that I do not have to read raw text to triage issues.

#### Acceptance Criteria

1. WHEN a complaint message is received at `POST /chat`, THE Agent SHALL use Instructor with a defined Pydantic schema to extract: `category` (string from an enumerated list in `config.py`), `summary` (string, maximum 150 characters), `sentiment` (one of `positive`, `neutral`, `negative`), and `vulnerable_group_flag` (boolean).
2. THE Agent SHALL return a structured JSON response conforming to the Instructor Pydantic schema; if the LLM output does not conform, Instructor SHALL retry extraction up to 2 times before returning a validation error.
3. IF the Agent extraction confidence is below the threshold defined in `config.py`, THEN THE System SHALL set `needs_human_review` to `true` on the Complaint record and add it to the Human Review Queue.
4. WHERE LiteLLM is configured as a fallback, THE System SHALL route Agent calls through LiteLLM when the primary Groq endpoint returns an HTTP 5xx error.

---

### Requirement 12 — Vision Severity Scoring (P1)

**User Story:** As an Officer, I want photos analysed for severity, so that the urgency score reflects visual evidence of the problem.

#### Acceptance Criteria

1. WHEN a photo is attached to a Complaint, THE Vision Service SHALL call Google Gemini Flash with the image and a structured prompt to extract a severity label (one of `low`, `medium`, `high`, `critical`) and a one-sentence description.
2. WHEN the Vision Service returns a severity label, THE Rules Engine SHALL map it to a `base_severity` integer: `low` → 1–2, `medium` → 3–4, `high` → 5, `critical` → 6.
3. THE Vision Service SHALL complete its analysis and update the Complaint's `base_severity` and `photo_description` fields within 10 seconds of image upload.
4. IF the Vision Service call fails or times out, THEN THE Rules Engine SHALL use the default `base_severity` of 3 and log the failure; complaint processing SHALL continue without error.

---

### Requirement 13 — SLA Tracking and Escalation (P1)

**User Story:** As an Admin, I want complaints escalated automatically when SLA deadlines are breached, so that overdue issues are not silently ignored.

#### Acceptance Criteria

1. WHEN a Complaint is created, THE System SHALL assign an SLA deadline by adding the SLA duration (in hours, from the department-and-category mapping in `config.py`) to the Complaint creation timestamp.
2. THE System SHALL support SLA durations from 2 hours to 168 hours (7 days).
3. WHEN the current time exceeds a Complaint's SLA deadline and the Complaint status is not `Resolved`, THE System SHALL set an `escalated` flag on the Complaint record.
4. WHEN a Complaint is escalated, THE Notification Service SHALL send an escalation notification to the department supervisor contact defined in `config.py`.
5. THE System SHALL check for SLA breaches on a schedule no less frequent than every 15 minutes using a background task.

---

### Requirement 14 — Recurring Problem Detection and Root-Cause Flag (P1)

**User Story:** As an Admin, I want recurring complaints at the same location to be flagged with a root-cause indicator, so that I can identify systemic infrastructure failures.

#### Acceptance Criteria

1. WHEN a Complaint is merged into a Cluster, THE System SHALL increment the `recurrence_count` field on the original Complaint record.
2. WHEN `recurrence_count` reaches the threshold defined in `config.py` (default: 3), THE System SHALL set the `root_cause_flag` boolean to `true` on the Complaint record.
3. WHEN `root_cause_flag` is `true`, THE Rules Engine SHALL apply a `recurrence_bonus` of +2 to the Urgency Score.
4. WHEN `recurrence_count` is 1 or 2 (below threshold), THE Rules Engine SHALL apply a `recurrence_bonus` of +1.
5. WHEN `recurrence_count` is 0, THE Rules Engine SHALL apply a `recurrence_bonus` of 0.

---

### Requirement 15 — Fraud Prevention (P1)

**User Story:** As an Admin, I want the system to detect fraudulent or staged complaints, so that department resources are not wasted on fake reports.

#### Acceptance Criteria

1. WHEN a before/after verification photo is uploaded for a Complaint, THE Dedup Service SHALL compute perceptual hashes for both images and compare them.
2. IF the before and after image hashes are identical within the similarity threshold, THEN THE System SHALL flag the Complaint as `suspected_fraud` and add it to the Human Review Queue.
3. THE System SHALL store both before and after image hashes in the `image_hashes` table with a `photo_type` field set to `before` or `after` respectively.

---

### Requirement 16 — Human Review Queue (P1)

**User Story:** As an Officer, I want a dedicated queue of low-confidence AI results, so that I can manually verify and correct uncertain classifications.

#### Acceptance Criteria

1. THE System SHALL expose a `GET /review-queue` endpoint that returns all Complaints where `needs_human_review` is `true` or `suspected_fraud` is `true`, ordered by creation timestamp ascending.
2. THE System SHALL expose a `POST /review/{id}/approve` endpoint that accepts corrected `category`, `summary`, `urgency_score`, and `department_id` fields, updates the Complaint record, sets `needs_human_review` to `false`, and records the reviewer's Officer ID in `status_events`.
3. WHEN an Officer submits a review approval, THE System SHALL re-trigger department routing and notifications using the corrected values.

---

### Requirement 17 — Anonymous Mode (P1)

**User Story:** As a Citizen, I want to submit a complaint anonymously, so that I can report issues without revealing my identity.

#### Acceptance Criteria

1. WHEN a `POST /complaints/submit` or `POST /chat` request includes an `anonymous: true` field, THE System SHALL not store the Citizen's name, phone number, or email address in the Complaint record.
2. WHILE Anonymous Mode is active, THE System SHALL still generate and return a Tracking ID so the Citizen can check the complaint status.
3. WHERE notification contact details are absent due to Anonymous Mode, THE System SHALL skip Citizen-facing notifications without returning an error.

---

### Requirement 18 — Officer Complaint Queue

**User Story:** As an Officer, I want a sorted queue of complaints assigned to my department, so that I can work through issues in priority order.

#### Acceptance Criteria

1. THE System SHALL expose a `GET /officer/complaints` endpoint that returns all Complaints assigned to the authenticated Officer's department.
2. WHEN the `GET /officer/complaints` endpoint is called, THE System SHALL return Complaints sorted first by Urgency Score (descending) and then by SLA deadline (ascending).
3. THE System SHALL support query parameters `status`, `category`, and `date_from` on `GET /officer/complaints` to filter the returned list.
4. WHEN an Officer uploads a proof photo via `PATCH /complaints/{id}/status`, THE System SHALL store the image, compute its hash, and associate it with the Complaint record.

---

### Requirement 19 — Admin Dashboard

**User Story:** As an Admin, I want a real-time overview of all complaints including a heatmap, SLA performance, and escalation alerts, so that I can manage department performance.

#### Acceptance Criteria

1. THE System SHALL expose a `GET /admin/heatmap` endpoint that returns an array of `{lat, lng, weight}` objects for all non-anonymous Complaints, where `weight` equals the Urgency Score.
2. THE System SHALL expose a `GET /admin/stats` endpoint that returns aggregate statistics: total complaint count, count by status, count by category, average Urgency Score, SLA breach percentage, and escalation count.
3. THE System SHALL expose a `GET /admin/complaints` endpoint that supports filtering by `status`, `category`, `department_id`, `date_from`, `date_to`, and `escalated` query parameters.
4. THE System SHALL render the heatmap on the admin frontend using Leaflet.js with the Leaflet.heat plugin.
5. THE System SHALL render SLA performance charts on the admin frontend using Recharts.
6. THE System SHALL display an escalation alert list on the admin dashboard showing all Complaints where `escalated` is `true` and status is not `Resolved`.

---

### Requirement 20 — RAG Regulation Query Endpoint (P2)

**User Story:** As a Citizen or Officer, I want to ask plain-language questions about SLAs, routing rules, and warranty policies, so that I can get accurate answers without reading policy documents.

#### Acceptance Criteria

1. THE System SHALL expose a `POST /ask-regulations` endpoint that accepts a `question` string and returns an `answer` string and a `sources` array listing the document file names and paragraph numbers used.
2. WHEN a `POST /ask-regulations` request is received, THE RAG Service SHALL embed the question using FastEmbed, query the sqlite-vec vector store, retrieve the top-3 most relevant document chunks from `municipal_slas.txt`, `contractor_warranties.txt`, and `escalation_policy.txt`, and pass them to the Agent for answer generation.
3. THE RAG Service SHALL index all documents in the `data/` directory at application startup if the vector store does not yet contain embeddings for those documents.
4. IF the vector store query returns no results above the similarity threshold defined in `config.py`, THEN THE System SHALL return a response indicating that no relevant regulation was found, without fabricating an answer.
5. THE RAG Service SHALL store embeddings in a sqlite-vec virtual table within the same SQLite database file used by SQLModel.

---

### Requirement 21 — Live Simulator (P2)

**User Story:** As a Developer or Tester, I want a browser-based simulator that exercises the full complaint workflow, so that I can demonstrate and test the system without making real AI calls.

#### Acceptance Criteria

1. THE System SHALL expose a `POST /simulate` endpoint that accepts a complaint scenario payload and executes the complaint creation, urgency scoring, deduplication, and routing logic using mock AI responses defined in `config.py`.
2. WHEN the Simulator frontend tool is used, THE System SHALL not make any calls to Groq, Gemini, Resend, or WhatsApp Cloud API.
3. THE System SHALL return a complete simulated Complaint record including Tracking ID, Urgency Score, scoring reasons, and assigned department from `POST /simulate`.

---

### Requirement 22 — Warranty and Asset Lookup (P2)

**User Story:** As an Officer, I want to see nearby assets and their warranty status when reviewing a complaint, so that I can identify which contractor is responsible for repairs.

#### Acceptance Criteria

1. WHEN a `GET /complaints/{tracking_id}` request is made and the Complaint has GPS coordinates, THE System SHALL query the `assets` table for all assets within 30 metres (Haversine distance) of the Complaint coordinates.
2. THE System SHALL include a `nearby_assets` array in the `GET /complaints/{tracking_id}` response, each entry containing asset ID, asset type, warranty expiry date, and contractor name.
3. WHERE an asset's warranty expiry date is in the future relative to the current date, THE System SHALL include a `warranty_active: true` field in the asset entry.

---

### Requirement 23 — Data Model

**User Story:** As a Developer, I want a well-defined relational data model, so that all features share consistent, queryable records.

#### Acceptance Criteria

1. THE System SHALL define the following SQLModel tables in `models.py`: `complaints`, `departments`, `assets`, `status_events`, and `image_hashes`.
2. THE `complaints` table SHALL contain at minimum: `id`, `tracking_id` (CF-XXXX), `category`, `summary`, `description`, `sentiment`, `vulnerable_group_flag`, `urgency_score`, `urgency_reasons` (JSON array), `status`, `department_id` (FK), `latitude`, `longitude`, `address`, `base_severity`, `photo_description`, `needs_human_review`, `suspected_fraud`, `anonymous`, `escalated`, `root_cause_flag`, `recurrence_count`, `duplicate_count`, `sla_deadline`, `created_at`, `updated_at`.
3. THE `status_events` table SHALL contain at minimum: `id`, `complaint_id` (FK), `old_status`, `new_status`, `actor_id`, `timestamp`.
4. THE `image_hashes` table SHALL contain at minimum: `id`, `complaint_id` (FK), `hash_value`, `photo_type` (one of `submission`, `before`, `after`, `proof`), `created_at`.
5. THE `assets` table SHALL contain at minimum: `id`, `asset_type`, `latitude`, `longitude`, `warranty_expiry`, `contractor_name`.
6. THE `departments` table SHALL contain at minimum: `id`, `name`, `email`, `whatsapp_contact`, `supervisor_contact`.

---

### Requirement 24 — Security and Configuration

**User Story:** As a Developer, I want the application to be secure by default and configurable via environment variables, so that secrets are never hard-coded.

#### Acceptance Criteria

1. THE System SHALL load all API keys, database paths, and service endpoints exclusively from environment variables defined in a `.env` file, using a `.env.example` file to document required variables.
2. THE System SHALL never log or return raw API key values in responses or log output.
3. THE System SHALL reject any file upload (image or audio) larger than 5 MB at the request parsing layer and return an HTTP 413 error before passing the file to any AI service.
4. THE System SHALL apply rate limiting to `POST /chat` at the ASGI middleware layer, returning HTTP 429 when the per-IP limit is exceeded.

---

### Requirement 25 — Graceful Degradation

**User Story:** As a Citizen, I want the system to remain functional even when an AI service is unavailable, so that my complaint is never lost.

#### Acceptance Criteria

1. IF any call to Groq, Gemini Flash, or Groq Whisper returns an HTTP 5xx error or times out after 10 seconds, THEN THE System SHALL catch the exception, set `needs_human_review` to `true` on the Complaint, add it to the Human Review Queue, and return a user-facing message acknowledging receipt without crashing.
2. WHERE LiteLLM is configured, THE System SHALL retry failed Groq calls through LiteLLM before triggering the Human Review Queue fallback.
3. THE System SHALL return a Tracking ID to the Citizen in all non-fatal error scenarios so that the Complaint can be referenced later.

---

### Requirement 26 — Testing Standards

**User Story:** As a Developer, I want tests written alongside each module, so that correctness is verified continuously throughout development.

#### Acceptance Criteria

1. THE System SHALL include a `tests/test_rules.py` file that covers all urgency scoring formula branches, Emergency Override triggering, and all edge cases at score cap (10).
2. WHEN a new backend module is implemented, THE System SHALL include at least one corresponding test file in the `tests/` directory covering the module's primary success and failure paths.
3. THE System SHALL use pytest as the test runner; all tests SHALL be runnable with `pytest --tb=short` from the project root without additional configuration.

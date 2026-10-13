# Design Document — CivicFix AI

## Overview

CivicFix AI is a voice-first municipal complaint platform. Citizens speak or type in Urdu or English; an AI agent (Groq Llama 3.3 70B + Instructor) extracts structured fields; a pure-Python rules engine scores urgency 1–10; and complaints are auto-routed with email/WhatsApp notifications. Three role-based frontends (citizen chat, officer queue, admin dashboard) are served by a FastAPI backend backed entirely by SQLite.

The core design principle is **AI extracts, Python decides**: the LLM never controls urgency, routing, or SLA outcomes — those are deterministic rules in `config.py` and `rules.py`. This makes the system auditable, testable, and resistant to prompt-injection attacks on scoring.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend                         │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Citizen Chat │  │ Officer Queue│  │ Admin Dashboard        │ │
│  │ Web Speech   │  │ shadcn/ui    │  │ Leaflet + Recharts     │ │
│  │ speechSynth  │  │ tables       │  │ heatmap, stats, alerts │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬────────────┘ │
│         └────────────────┬┘──────────────────────┘              │
└──────────────────────────┼─────────────────────────────────────┘
                           │ HTTP/JSON
┌──────────────────────────▼─────────────────────────────────────┐
│                       FastAPI (main.py)                         │
│  Rate-limit middleware │ File size guard │ CORS                 │
│                                                                  │
│  Routes: /chat  /transcribe  /complaints/submit                 │
│          /complaints/{id}  /officer/complaints                  │
│          /admin/*  /review-queue  /review/{id}/approve          │
│          /simulate  /ask-regulations                            │
└──┬───────────┬────────────┬──────────────┬──────────────────────┘
   │           │            │              │
   ▼           ▼            ▼              ▼
agent.py   vision.py    rules.py       rag.py
(Groq      (Gemini      (pure Python   (LlamaIndex
 Instructor  Flash)      no LLM)        FastEmbed
 LiteLLM)                               sqlite-vec)
   │           │            │              │
   └───────────┴────────────┴──────────────┘
                            │
                     ┌──────▼──────┐
                     │  SQLite DB   │
                     │  (SQLModel)  │
                     │  + sqlite-vec│
                     └──────┬──────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
          notify.py    context.py    dedup logic
          (Resend       (httpx to     (imagehash
           WhatsApp)     Open-Meteo   geopy
                         OSM)         Pillow)
```

**Key flows:**

1. **Complaint submission** — `/chat` → `agent.py` (extract) → `rules.py` (score) → `dedup` (merge check) → `notify.py` (background) → return tracking ID.
2. **Photo upload** — `vision.py` analyses severity + blurs PII → `dedup` computes hash → stored in `image_hashes`.
3. **RAG query** — `/ask-regulations` → `rag.py` (embed → sqlite-vec search → top-3 chunks → Groq synthesis) → response with sources.
4. **SLA escalation** — APScheduler background job every 15 min checks breached SLAs → `notify.py` alerts supervisor.

---

## Components

### `main.py` — FastAPI Application Entry Point

Wires all routes, registers ASGI rate-limit middleware (SlowAPI / custom middleware), initialises the database via SQLModel `create_all`, seeds departments from `config.py`, and starts the APScheduler for SLA checks at startup.

### `agent.py` — AI Extraction Agent

Uses `instructor.patch(groq.AsyncGroq(...))` to call Llama 3.3 70B with a strict Pydantic schema. Returns a `ComplaintExtraction` object. On Groq HTTP 5xx, retries once through LiteLLM before raising. On any exception, sets `needs_human_review=True` on the complaint.

```python
class ComplaintExtraction(BaseModel):
    category: ComplaintCategory          # Enum from config.py
    summary: str = Field(max_length=150)
    sentiment: Literal["positive", "neutral", "negative"]
    vulnerable_group_flag: bool
    missing_field: Optional[Literal["category", "location", "description"]]
    confidence: float = Field(ge=0.0, le=1.0)
```

`missing_field` drives the single-question follow-up logic. `confidence` below `config.CONFIDENCE_THRESHOLD` triggers review queue.

### `vision.py` — Photo Analysis and Privacy

Calls Google Gemini Flash (`gemini-1.5-flash`) with a structured prompt requesting severity label and one-sentence description. Uses Pillow + a face/plate detector (e.g., OpenCV Haar cascades or a lightweight model) to blur detected regions before storage. Runs as a `BackgroundTask` so the `/chat` response is not blocked.

```python
class VisionResult(BaseModel):
    severity: Literal["low", "medium", "high", "critical"]
    description: str
```

### `rules.py` — Urgency Scoring Engine

Pure Python, no AI calls, reads all thresholds from `config.py`.

```python
def compute_urgency(
    base_severity: int,       # 1–6
    weather_bonus: int,       # 0, 1, 2
    recurrence_count: int,
    near_sensitive_place: bool,
    vulnerable_group: bool,
    text: str,
) -> tuple[int, list[str]]:
    # Emergency override check first
    for kw in config.EMERGENCY_KEYWORDS:
        if kw.lower() in text.lower():
            return 10, ["Emergency override triggered"]
    score = base_severity
    reasons = [f"Base severity: {base_severity}"]
    if weather_bonus > 0:
        score += weather_bonus
        reasons.append(f"Weather bonus: +{weather_bonus}")
    recurrence_bonus = (
        2 if recurrence_count >= config.ROOT_CAUSE_THRESHOLD
        else 1 if recurrence_count > 0
        else 0
    )
    if recurrence_bonus:
        score += recurrence_bonus
        reasons.append(f"Recurrence bonus: +{recurrence_bonus}")
    if near_sensitive_place:
        score += 1
        reasons.append("Near sensitive place: +1")
    if vulnerable_group:
        score += 1
        reasons.append("Vulnerable group flag: +1")
    return min(score, 10), reasons
```

### `config.py` — Central Configuration

All constants, enumerations, and mappings that rules.py and agent.py consume:

```python
EMERGENCY_KEYWORDS = ["live wire", "open manhole", "gas smell", "live taar", "khuli manhole"]
ROOT_CAUSE_THRESHOLD = 3
CONFIDENCE_THRESHOLD = 0.6
SIMILARITY_THRESHOLD = 10        # imagehash hamming distance
DEDUP_RADIUS_METERS = 30
DEDUP_WINDOW_DAYS = 7
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
RATE_LIMIT_PER_MINUTE = 30
RAG_TOP_K = 3
RAG_SIMILARITY_THRESHOLD = 0.5

SEVERITY_TO_INT = {"low": 2, "medium": 3, "high": 5, "critical": 6}
DEFAULT_BASE_SEVERITY = 3

class ComplaintCategory(str, Enum):
    POTHOLE = "pothole"
    WATER_LEAK = "water_leak"
    GARBAGE = "garbage"
    STREETLIGHT = "streetlight"
    SEWAGE = "sewage"
    ROAD_DAMAGE = "road_damage"
    OTHER = "other"

CATEGORY_TO_DEPARTMENT: dict[ComplaintCategory, str] = {
    ComplaintCategory.POTHOLE: "Roads Department",
    ComplaintCategory.ROAD_DAMAGE: "Roads Department",
    ComplaintCategory.WATER_LEAK: "Water & Sanitation",
    ComplaintCategory.SEWAGE: "Water & Sanitation",
    ComplaintCategory.GARBAGE: "Solid Waste Management",
    ComplaintCategory.STREETLIGHT: "Electrical Department",
    ComplaintCategory.OTHER: "General Administration",
}

SLA_HOURS: dict[str, int] = {
    "Roads Department": 72,
    "Water & Sanitation": 24,
    "Solid Waste Management": 48,
    "Electrical Department": 12,
    "General Administration": 168,
}

WEATHER_BONUS_HIGH_MM = 10      # > 10 mm/h → +2
WEATHER_BONUS_LOW_MM = 0        # > 0 → +1
```

### `models.py` — SQLModel Data Model

Five tables as specified. JSON fields (`urgency_reasons`) stored as SQLite TEXT with JSON serialisation in the model validator. `tracking_id` generated as `CF-{n:04d}` using an atomic DB sequence helper.

```python
class Complaint(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    tracking_id: str = Field(unique=True, index=True)   # CF-0001
    category: str
    summary: str
    description: str
    sentiment: str
    vulnerable_group_flag: bool = False
    urgency_score: int = 0
    urgency_reasons: str = "[]"   # JSON array stored as TEXT
    status: str = "Pending"
    department_id: Optional[int] = Field(default=None, foreign_key="department.id")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    base_severity: int = 3
    photo_description: Optional[str] = None
    needs_human_review: bool = False
    suspected_fraud: bool = False
    anonymous: bool = False
    escalated: bool = False
    root_cause_flag: bool = False
    recurrence_count: int = 0
    duplicate_count: int = 0
    sla_deadline: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Department(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    email: str
    whatsapp_contact: Optional[str] = None
    supervisor_contact: Optional[str] = None

class Asset(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    asset_type: str
    latitude: float
    longitude: float
    warranty_expiry: Optional[date] = None
    contractor_name: Optional[str] = None

class StatusEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    complaint_id: int = Field(foreign_key="complaint.id")
    old_status: str
    new_status: str
    actor_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ImageHash(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    complaint_id: int = Field(foreign_key="complaint.id")
    hash_value: str
    photo_type: str   # submission | before | after | proof
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

### `context.py` — Weather and Places Context

Two async functions called in parallel via `asyncio.gather`:

```python
async def get_weather_bonus(lat: float, lng: float) -> tuple[int, str]:
    """Fetch precipitation from Open-Meteo, return (bonus, reason_string)."""

async def get_nearby_sensitive_places(lat: float, lng: float) -> bool:
    """Query OSM Overpass for hospitals, schools within 100m."""
```

Both timeout after 5 seconds; on failure they return `(0, "")` and `False` respectively.

### `notify.py` — Notification Service

```python
async def send_complaint_notification(complaint: Complaint, dept: Department) -> None:
    """Send email via Resend + WhatsApp via Cloud API. Log failure, retry once."""

async def send_escalation_notification(complaint: Complaint, dept: Department) -> None:
    """Send escalation alert to supervisor_contact."""
```

Both are wrapped in try/except. On failure: log, schedule one retry via `asyncio.create_task` with 30-second delay. Never raises to the caller.

### `rag.py` — Retrieval-Augmented Generation

Uses LlamaIndex `SimpleDirectoryReader` to load `data/` documents. Embeds with FastEmbed (`BAAI/bge-small-en-v1.5`). Stores vectors in a `sqlite-vec` virtual table (`vec_chunks`) in the same SQLite file.

```python
async def index_documents_if_needed(db_path: str, data_dir: str) -> None:
    """At startup: check if vec_chunks table is populated; if not, embed and insert."""

async def query_regulations(question: str, db_path: str) -> RegulationAnswer:
    """Embed question → cosine search → top-3 chunks → Groq synthesis → return answer + sources."""

class RegulationAnswer(BaseModel):
    answer: str
    sources: list[SourceRef]   # [{file, paragraph_number}]
```

If no chunk scores above `config.RAG_SIMILARITY_THRESHOLD`, returns `{"answer": "No relevant regulation found.", "sources": []}` without calling the LLM.

### `dedup.py` — Duplicate Detection

```python
def compute_image_hash(image_bytes: bytes) -> str:
    """Return imagehash.phash hex string."""

def is_duplicate_image(new_hash: str, existing_hashes: list[str]) -> bool:
    """True if hamming distance ≤ config.SIMILARITY_THRESHOLD for any existing hash."""

def haversine_meters(lat1, lng1, lat2, lng2) -> float:
    """Return distance in metres."""

def find_duplicate_complaint(
    session: Session, category: str, lat: float, lng: float, submitted_at: datetime
) -> Optional[Complaint]:
    """Query complaints table for match within 30m radius, 7-day window, same category."""
```

---

## API Endpoints

### `POST /chat`

**Request:**
```json
{
  "message": "string",
  "session_id": "optional string",
  "latitude": "optional float",
  "longitude": "optional float",
  "anonymous": "optional bool"
}
```

**Response (fields collected):**
```json
{
  "reply": "string",
  "tracking_id": "CF-0001",
  "status": "submitted",
  "urgency_score": 7,
  "urgency_reasons": ["Base severity: 3", "Weather bonus: +2", ...]
}
```

**Response (fields missing):**
```json
{
  "reply": "Could you tell me the location of the issue?",
  "tracking_id": null,
  "status": "collecting"
}
```

### `POST /transcribe`

Accepts `multipart/form-data` with `audio` file field. Returns `{"text": "transcribed string"}`. HTTP 413 if file > 5 MB.

### `POST /complaints/submit`

Accepts `multipart/form-data` with complaint fields + optional `image` file. Returns full complaint record including `tracking_id`. HTTP 409 on duplicate image.

### `GET /complaints/{tracking_id}`

Returns complaint record + `nearby_assets` array (from `assets` table within 30m).

### `PATCH /complaints/{id}/status`

Body: `{"status": "In Progress" | "Resolved", "actor_id": "optional string", "proof_image": "optional file"}`. Creates `status_events` record.

### `GET /officer/complaints`

Query params: `status`, `category`, `date_from`. Returns list sorted by urgency_score DESC, sla_deadline ASC.

### `GET /admin/heatmap`

Returns `[{"lat": float, "lng": float, "weight": int}]` for all non-anonymous complaints.

### `GET /admin/stats`

Returns `{total, by_status, by_category, avg_urgency, sla_breach_pct, escalation_count}`.

### `GET /admin/complaints`

Query params: `status`, `category`, `department_id`, `date_from`, `date_to`, `escalated`.

### `GET /review-queue`

Returns complaints where `needs_human_review=true` OR `suspected_fraud=true`, ordered by `created_at` ASC.

### `POST /review/{id}/approve`

Body: `{"category": "...", "summary": "...", "urgency_score": int, "department_id": int, "reviewer_id": "..."}`. Clears `needs_human_review`, re-triggers routing and notifications.

### `POST /simulate`

Body: complaint scenario payload. Runs full pipeline with mock AI responses from `config.py`. Returns complete simulated complaint record. No calls to Groq, Gemini, Resend, or WhatsApp.

### `POST /ask-regulations`

Body: `{"question": "string"}`. Returns `{"answer": "string", "sources": [{"file": "...", "paragraph": int}]}`.

---

## Data Flow: Complaint Submission

```
POST /chat
  │
  ├─► [rate limit check] → 429 if exceeded
  │
  ├─► agent.py: extract(message) → ComplaintExtraction
  │     └─ missing_field? → return clarifying question
  │
  ├─► context.py: gather(weather_bonus, sensitive_place) [async parallel]
  │
  ├─► rules.py: compute_urgency(base_severity=3, weather, ...) → (score, reasons)
  │     └─ emergency keyword? → score=10 immediately
  │
  ├─► dedup.py: find_duplicate_complaint(...) → merge? → return original tracking_id
  │
  ├─► models.py: create Complaint record, generate CF-XXXX
  │
  ├─► [BackgroundTasks]:
  │     ├─ vision.py: analyse_photo(image) → update base_severity, photo_description
  │     ├─ notify.py: send_complaint_notification(complaint, dept)
  │     └─ [if score=10] notify.py: send_escalation_notification(...)
  │
  └─► Return {reply, tracking_id, urgency_score, urgency_reasons}
```

---

## Frontend Architecture (Next.js)

### Pages / Routes

| Route | Component | Description |
|---|---|---|
| `/` | `CitizenChat` | Voice-first complaint submission chat |
| `/officer` | `OfficerQueue` | Department complaint queue with filters |
| `/admin` | `AdminDashboard` | Heatmap, stats, SLA charts, escalation alerts |
| `/admin/simulator` | `Simulator` | Developer tool, calls `POST /simulate` |

### Citizen Chat (`/`)

- `useWebSpeech` hook wraps `SpeechRecognition` for STT (`ur-PK`, `en-US`).
- `useSpeechSynthesis` hook wraps `speechSynthesis` for TTS.
- Falls back to `POST /transcribe` (Groq Whisper) if `SpeechRecognition` is unavailable.
- Tracking ID displayed prominently once returned. Status polled via `GET /complaints/{tracking_id}`.

### Officer Queue (`/officer`)

- shadcn/ui `DataTable` with server-side sorting (urgency DESC, SLA ASC).
- Filter dropdowns for status, category, date range.
- Complaint detail sheet with proof photo upload (`PATCH /complaints/{id}/status`).

### Admin Dashboard (`/admin`)

- `LeafletHeatmap` component: loads `GET /admin/heatmap`, renders via `leaflet.heat`.
- `StatsCards` component: calls `GET /admin/stats`, renders total/by-status/avg-urgency.
- `SLAChart` (Recharts `BarChart`): SLA breach percentage by department.
- `EscalationAlerts` panel: lists unresolved escalated complaints.

---

## Background Tasks and Scheduling

| Task | Trigger | Implementation |
|---|---|---|
| Vision analysis | Per complaint with photo | FastAPI `BackgroundTasks` |
| Email notification | Per complaint | FastAPI `BackgroundTasks` |
| WhatsApp notification | Per complaint | FastAPI `BackgroundTasks` |
| SLA breach check | Every 15 minutes | APScheduler `IntervalTrigger` in `main.py` |
| RAG index build | App startup | `app.on_event("startup")` |

---

## Error Handling Strategy

| Failure | Behaviour |
|---|---|
| Groq API 5xx | Retry via LiteLLM once; on second failure set `needs_human_review=True`, return tracking ID |
| Gemini Flash timeout | Use default `base_severity=3`, log failure, continue |
| Open-Meteo unavailable | `weather_bonus=0`, continue |
| OSM Overpass unavailable | Store raw coordinates, no address, continue |
| Notification send failure | Log failure, schedule one retry, never raise to caller |
| Duplicate image | HTTP 409 with original tracking ID |
| File > 5 MB | HTTP 413 at ASGI middleware before any AI call |
| Rate limit exceeded | HTTP 429 at ASGI middleware |
| Instructor schema validation failure | Retry up to 2 times; on third failure set `needs_human_review=True` |

---

## Security Design

- All secrets in `.env`; loaded with `python-dotenv`. `.env.example` documents all keys.
- Secrets never echoed in response bodies or log output — log only key names.
- File size checked at ASGI middleware (`ContentSizeLimitMiddleware`) before any route handler.
- Rate limiting via `SlowAPI` (`limits="30/minute"`, keyed by `request.client.host`).
- Anonymous mode: if `anonymous=True` in request, name/phone/email are set to `None` before DB write.
- Instructor schema enforcement prevents raw LLM text from reaching the database.

---

## Directory Structure

```
civicfix/
├── app/
│   ├── main.py          # FastAPI app, routes, startup
│   ├── agent.py         # Groq + Instructor extraction
│   ├── vision.py        # Gemini Flash photo analysis + privacy blur
│   ├── rules.py         # Pure-Python urgency scoring
│   ├── config.py        # All constants, enums, mappings
│   ├── notify.py        # Resend + WhatsApp notifications
│   ├── context.py       # Open-Meteo + OSM async fetchers
│   ├── models.py        # SQLModel table definitions
│   ├── rag.py           # LlamaIndex + FastEmbed + sqlite-vec
│   └── dedup.py         # imagehash + Haversine deduplication
├── data/
│   ├── municipal_slas.txt
│   ├── contractor_warranties.txt
│   └── escalation_policy.txt
├── frontend/            # Next.js project
│   ├── app/
│   │   ├── page.tsx          # Citizen chat
│   │   ├── officer/page.tsx  # Officer queue
│   │   ├── admin/page.tsx    # Admin dashboard
│   │   └── admin/simulator/page.tsx
│   ├── components/
│   │   ├── CitizenChat.tsx
│   │   ├── OfficerQueue.tsx
│   │   ├── AdminDashboard.tsx
│   │   ├── LeafletHeatmap.tsx
│   │   ├── SLAChart.tsx
│   │   └── Simulator.tsx
│   └── hooks/
│       ├── useWebSpeech.ts
│       └── useSpeechSynthesis.ts
├── tests/
│   ├── test_rules.py
│   ├── test_agent.py
│   ├── test_dedup.py
│   ├── test_rag.py
│   ├── test_api.py
│   └── test_models.py
├── .env.example
└── README.md
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Urgency Score Bounds and Formula Correctness

*For any* combination of `base_severity` (1–6), `weather_bonus` (0, 1, 2), `recurrence_bonus` (0, 1, 2), `sensitive_place_bonus` (0 or 1), and `vulnerable_group_bonus` (0 or 1), `compute_urgency` SHALL return a score in the closed interval [1, 10] and a non-empty reasons list with one entry per non-zero contributing factor.

**Validates: Requirements 6.1, 6.4**

---

### Property 2: Emergency Override Supremacy

*For any* complaint text containing at least one keyword from `config.EMERGENCY_KEYWORDS` (case-insensitive), `compute_urgency` SHALL return score=10 and reasons list containing exactly `"Emergency override triggered"`, regardless of all other input values.

**Validates: Requirements 6.5**

---

### Property 3: Severity Label to Integer Mapping Validity

*For any* severity label returned by the Vision Service (`"low"`, `"medium"`, `"high"`, `"critical"`), `SEVERITY_TO_INT[label]` SHALL return an integer in the range [1, 6].

**Validates: Requirements 6.2, 12.2**

---

### Property 4: Weather Bonus Tier Correctness

*For any* precipitation value `p` (non-negative float), `get_weather_bonus(p)` SHALL return +2 if `p > 10`, +1 if `0 < p ≤ 10`, and 0 if `p == 0`.

**Validates: Requirements 7.2, 7.3, 7.4**

---

### Property 5: Tracking ID Format Invariant

*For any* accepted complaint creation (non-duplicate), the returned `tracking_id` SHALL match the regex `^CF-\d{4}$` and SHALL be unique across all complaints in the database.

**Validates: Requirements 10.1, 1.4**

---

### Property 6: Deduplication Radius Correctness

*For any* pair of complaints with the same category submitted within 7 days, `find_duplicate_complaint` SHALL return the existing complaint if and only if their Haversine distance is strictly less than `config.DEDUP_RADIUS_METERS` (30 m).

**Validates: Requirements 8.1**

---

### Property 7: Duplicate Count Monotonicity

*For any* original complaint that is merged into `n` times (n ≥ 1), the `duplicate_count` field on the original record SHALL equal exactly `n` after all merges.

**Validates: Requirements 8.3, 14.1**

---

### Property 8: Recurrence Bonus Tiers

*For any* `recurrence_count` value (non-negative integer), the `recurrence_bonus` applied by `compute_urgency` SHALL be: 0 if `recurrence_count == 0`, +1 if `1 ≤ recurrence_count < config.ROOT_CAUSE_THRESHOLD`, and +2 if `recurrence_count ≥ config.ROOT_CAUSE_THRESHOLD`.

**Validates: Requirements 14.3, 14.4, 14.5**

---

### Property 9: Root-Cause Flag Threshold

*For any* complaint record, `root_cause_flag` SHALL be `true` if and only if `recurrence_count ≥ config.ROOT_CAUSE_THRESHOLD`.

**Validates: Requirements 14.2**

---

### Property 10: Category-to-Department Routing Completeness

*For any* `category` value defined in `ComplaintCategory`, `CATEGORY_TO_DEPARTMENT[category]` SHALL return a non-null department name, and after complaint creation the complaint's `department_id` SHALL correspond to that department in the `departments` table.

**Validates: Requirements 9.1, 9.2**

---

### Property 11: SLA Deadline Arithmetic

*For any* complaint record with a known department, `sla_deadline` SHALL equal `created_at + timedelta(hours=SLA_HOURS[department_name])`, and `SLA_HOURS[department_name]` SHALL be in the range [2, 168].

**Validates: Requirements 13.1, 13.2**

---

### Property 12: SLA Escalation Trigger Correctness

*For any* complaint where `datetime.utcnow() > sla_deadline` and `status != "Resolved"`, the SLA checker SHALL set `escalated = true`. *For any* complaint where `status == "Resolved"`, `escalated` SHALL NOT be set by the SLA checker regardless of the deadline.

**Validates: Requirements 13.3**

---

### Property 13: Agent Extraction Schema Compliance

*For any* non-empty complaint message processed by `agent.py`, the returned `ComplaintExtraction` SHALL have: `category` ∈ `ComplaintCategory` enum, `len(summary) ≤ 150`, `sentiment` ∈ `{"positive", "neutral", "negative"}`, and `vulnerable_group_flag` ∈ `{True, False}`.

**Validates: Requirements 11.1, 1.2**

---

### Property 14: Single Missing-Field Follow-Up

*For any* complaint message where exactly one mandatory field (category, location, or description) is absent after extraction, the `/chat` response SHALL contain exactly one clarifying question and `tracking_id` SHALL be null.

**Validates: Requirements 1.3**

---

### Property 15: Duplicate Image Detection Round-Trip

*For any* image accepted and stored (hash inserted into `image_hashes`), resubmitting the same image bytes (or a perceptually equivalent image within `config.SIMILARITY_THRESHOLD`) SHALL result in HTTP 409 with the original complaint's `tracking_id`.

**Validates: Requirements 4.4, 4.5**

---

### Property 16: Fraud Detection via Before/After Hash Match

*For any* before/after photo pair where the perceptual hash distance is ≤ `config.SIMILARITY_THRESHOLD`, `suspected_fraud` SHALL be set to `true` on the complaint record and the complaint SHALL appear in the review queue.

**Validates: Requirements 15.1, 15.2**

---

### Property 17: Anonymous Mode PII Exclusion

*For any* complaint submitted with `anonymous=True`, the stored complaint record SHALL have `None` (null) values for all citizen PII fields (name, phone, email), while `tracking_id` SHALL remain non-null.

**Validates: Requirements 17.1, 17.2**

---

### Property 18: Officer Queue Sort Order

*For any* officer queue response, the returned complaint list SHALL be sorted such that for any adjacent pair `(a, b)`: `a.urgency_score ≥ b.urgency_score`, and when `a.urgency_score == b.urgency_score`, `a.sla_deadline ≤ b.sla_deadline`.

**Validates: Requirements 18.2**

---

### Property 19: Admin Filter Soundness

*For any* call to `GET /admin/complaints` or `GET /officer/complaints` with one or more filter parameters applied, every complaint in the returned list SHALL satisfy all applied filters simultaneously (no complaint violates any active filter constraint).

**Validates: Requirements 18.3, 19.3**

---

### Property 20: Heatmap Weight Correctness

*For any* non-anonymous complaint in the database, it SHALL appear in the `GET /admin/heatmap` response with `weight` equal to its `urgency_score`, and no anonymous complaint SHALL appear in the heatmap response.

**Validates: Requirements 19.1**

---

### Property 21: RAG Source Attribution

*For any* `POST /ask-regulations` request that returns an answer (i.e., at least one chunk above `config.RAG_SIMILARITY_THRESHOLD`), the `sources` array SHALL be non-empty and every entry SHALL reference a document filename that exists in the `data/` directory.

**Validates: Requirements 20.1, 20.2**

---

### Property 22: File Size Rejection

*For any* file upload (image or audio) whose byte size exceeds `config.MAX_UPLOAD_BYTES` (5 MB), the system SHALL return HTTP 413 before invoking any AI service, and no partial data SHALL be persisted.

**Validates: Requirements 24.3, 2.5, 4.2**

---

### Property 23: Graceful Degradation — Tracking ID Always Returned

*For any* complaint submission where an AI service (Groq, Gemini, Groq Whisper) fails with an exception or HTTP 5xx, the system SHALL still return a `tracking_id` in the response (complaint created with `needs_human_review=True`) and SHALL NOT return an unhandled 500 error to the client.

**Validates: Requirements 25.1, 25.3, 1.6**

---

### Property 24: Status Event Audit Trail

*For any* complaint status transition (Pending → In Progress, In Progress → Resolved, etc.), exactly one new `status_events` record SHALL be created capturing `old_status`, `new_status`, `actor_id`, and `timestamp`, with `timestamp` monotonically non-decreasing for a given complaint.

**Validates: Requirements 10.6**

---

### Property 25: Simulator Isolation

*For any* call to `POST /simulate`, zero outbound HTTP calls SHALL be made to Groq, Gemini, Resend, or WhatsApp Cloud API endpoints, and the response SHALL include a valid `tracking_id`, `urgency_score`, `urgency_reasons`, and `department` name.

**Validates: Requirements 21.1, 21.2, 21.3**

---

### Property 26: Nearby Assets Radius Correctness

*For any* `GET /complaints/{tracking_id}` response that includes a `nearby_assets` array, every asset entry SHALL satisfy `haversine(complaint.lat, complaint.lng, asset.lat, asset.lng) ≤ 30 m`, and no asset beyond 30 m SHALL appear in the array.

**Validates: Requirements 22.1**

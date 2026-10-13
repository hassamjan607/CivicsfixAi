# CivicFix AI

AI-powered municipal complaint platform with voice-first interaction in Urdu and English.

## Overview

CivicFix AI enables citizens to submit municipal complaints via voice or text, automatically processes them using AI for categorization and urgency scoring, detects duplicates, routes to appropriate departments, and provides real-time tracking. The system includes three interfaces: citizen chat, officer queue, and admin dashboard.

## Technology Stack

### Backend
- **Python 3.11** - Runtime environment
- **FastAPI** - Web framework with async support
- **SQLModel** - Database ORM with Pydantic integration
- **SQLite + sqlite-vec** - Database with vector search
- **Groq (Llama 3.3 70B) + Instructor** - AI agent for complaint extraction
- **Google Gemini Flash** - Vision service for photo analysis
- **LiteLLM** - AI service fallback and routing

### Frontend  
- **Next.js 14** - React framework with TypeScript
- **Tailwind CSS + shadcn/ui** - Styling and UI components
- **Leaflet.js + Leaflet.heat** - Interactive maps and heatmaps
- **Recharts** - Data visualization charts
- **Web Speech API + speechSynthesis** - Voice input/output

### AI Services
- **Groq Whisper** - Speech-to-text fallback
- **FastEmbed + LlamaIndex** - RAG document querying
- **imagehash + Pillow** - Image deduplication and processing
- **geopy** - Geographic calculations

### External APIs
- **Resend** - Email notifications
- **WhatsApp Cloud API** - WhatsApp notifications  
- **Open-Meteo** - Weather data for priority scoring
- **OSM Overpass** - Location context and reverse geocoding

## Project Structure

```
civicfix/
├── app/                    # FastAPI backend
│   ├── main.py            # Application entry point
│   ├── config.py          # Configuration constants
│   ├── models.py          # SQLModel data models
│   ├── agent.py           # AI complaint extraction
│   ├── rules.py           # Pure Python urgency scoring
│   ├── vision.py          # Photo analysis service
│   ├── context.py         # Weather and location services
│   ├── notify.py          # Email/WhatsApp notifications
│   ├── dedup.py           # Duplicate detection
│   └── rag.py             # RAG document querying
├── frontend/              # Next.js frontend
│   ├── app/               # App router pages
│   ├── components/        # Reusable UI components
│   └── hooks/             # Custom React hooks
├── data/                  # RAG document corpus
├── tests/                 # Test suite
└── requirements.txt       # Python dependencies
```

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- API keys for: Groq, Google Gemini, Resend, WhatsApp Cloud API

### Backend Setup

1. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Run development server:**
   ```bash
   cd app
   python main.py
   # API available at http://localhost:8000
   ```

### Frontend Setup

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Configure environment:**
   ```bash
   echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
   ```

3. **Run development server:**
   ```bash
   npm run dev
   # Frontend available at http://localhost:3000
   ```

### Testing

Run the test suite with:
```bash
# Unit and integration tests
pytest

# Property-based tests with Hypothesis
pytest -m property

# Run with coverage
pytest --cov=app tests/
```

## API Endpoints

### Core Endpoints
- `POST /chat` - Main complaint submission via chat
- `POST /transcribe` - Audio transcription
- `POST /complaints/submit` - Direct complaint submission with files
- `GET /complaints/{tracking_id}` - Get complaint details

### Officer Interface
- `GET /officer/complaints` - Department complaint queue
- `PATCH /complaints/{id}/status` - Update complaint status

### Admin Interface  
- `GET /admin/heatmap` - Geographic complaint heatmap data
- `GET /admin/stats` - System-wide statistics
- `GET /admin/complaints` - All complaints with filtering

### Special Features
- `POST /ask-regulations` - RAG-powered regulation queries
- `POST /simulate` - Test complaint workflows
- `GET /review-queue` - Human review queue for low-confidence AI results

## Architecture Highlights

### AI-First Design
- **Agent extracts, Python decides**: AI handles natural language processing; pure Python rules handle scoring and routing
- **Graceful degradation**: System continues functioning even if AI services are unavailable
- **Confidence-based review**: Low-confidence AI extractions are queued for human review

### Duplicate Detection
- **Multi-modal approach**: Combines geographic location, time windows, and perceptual image hashing
- **Intelligent clustering**: Similar complaints are merged automatically to reduce officer workload

### Urgency Scoring
- **Transparent formula**: Base severity + weather + recurrence + location + vulnerability bonuses
- **Emergency override**: Specific keywords immediately trigger maximum urgency
- **Explainable reasons**: Each score includes plain-language justification

### Real-time Notifications
- **Multi-channel**: Email + WhatsApp notifications to departments
- **SLA monitoring**: Automatic escalation when deadlines are breached
- **Retry logic**: Robust notification delivery with exponential backoff

## Development Status

This repository contains the complete project structure for CivicFix AI. Implementation is organized into discrete tasks:

- ✅ **Task 1**: Project structure and core dependencies (COMPLETED)
- ⏳ **Task 2**: Data models and database layer
- ⏳ **Task 3**: Urgency scoring rules engine  
- ⏳ **Task 4**: AI agent for complaint extraction
- ⏳ **Tasks 5-21**: Additional features and integrations

Each task builds upon the previous ones, with comprehensive testing including unit tests, integration tests, and property-based tests using Hypothesis.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Ensure all tests pass: `pytest`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For questions or issues, please contact the development team or create an issue in the repository.
# PharmaCare AI — Production Backend

Enterprise-grade, high-performance pharmacy management and clinical AI backend powered by **FastAPI**, **Supabase PostgreSQL**, **SQLAlchemy 2.0 (asyncio)**, **Alembic**, **Pydantic v2**, and **WebSockets**.

---

## Architecture Overview

```
backend/
├── app/
│   ├── main.py                     # FastAPI application entrypoint & middleware
│   ├── core/
│   │   ├── config.py               # Pydantic Settings & environment variables
│   │   ├── security.py             # Bcrypt password hashing & JWT token management
│   │   └── permissions.py          # RBAC matrix (OWNER, MANAGER, STAFF) & tenant enforcement
│   ├── db/
│   │   ├── database.py             # Engine, metadata, and JSONB type compilation
│   │   └── session.py              # AsyncSessionLocal & per-request get_db dependency
│   ├── models/                     # SQLAlchemy 2.0 Declarative Models (18 tables)
│   ├── schemas/                    # Pydantic v2 request/response validation contracts
│   ├── services/                   # Business logic layer (Sales, Stock, Voice, ML, etc.)
│   ├── routers/                    # RESTful endpoints under /api/v1/*
│   └── websocket/                  # Real-time WebSockets hub (orders, alerts, AI)
├── alembic/                        # Async database migration environment & scripts
├── tests/                          # Comprehensive pytest test suite (14 test modules)
├── requirements.txt                # Production dependencies
├── .env.example                    # Environment template
└── pytest.ini                      # Test runner configuration
```

---

## 1. Setup & Environment

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Configure your **Supabase PostgreSQL** credentials:
   ```ini
   DATABASE_URL=postgresql+asyncpg://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
   SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
   SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   JWT_SECRET=your-64-character-random-secret
   JWT_REFRESH_SECRET=your-different-64-character-random-secret
   CORS_ORIGINS=http://localhost:5173,http://localhost:3000
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

---

## 2. Database Migrations (Alembic)

Run all schema migrations against your configured Supabase PostgreSQL database:

```bash
alembic upgrade head
```

To verify migration status:
```bash
alembic current
```

---

## 3. Running the Server

Start the local development server:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- **Interactive Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc Documentation**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **OpenAPI 3.1 Schema**: [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json)
- **Liveness Health Check**: `GET /health`
- **Database Readiness Check**: `GET /ready`

---

## 4. Running the Test Suite

Run the full automated test suite covering Auth, RBAC, Multi-Tenancy, Concurrency, Sales, Inventory, AI, Voice, and ML:

```bash
pytest -v
```

---

## 5. Security & Multi-Tenancy

- **Multi-Tenant Isolation**: Hard boundaries enforced on every query via `business_id` from the decoded JWT access token.
- **Role-Based Access Control (RBAC)**:
  - **OWNER**: Full business administration, user management, audit logs, AI preferences.
  - **MANAGER**: Product and inventory management, purchases, sales, operational reports.
  - **STAFF**: Product & inventory lookups, sales checkout, order updates.
- **Concurrency & Race Conditions**: Inventory deduction during checkout utilizes `with_for_update()` row-level database locking to guarantee stock never drops below zero under simultaneous requests.
- **Clinical Safety Expiry System**: Expired batches (`expiry_date <= today`) are strictly blocked from being sold, while remaining visible for audits and wastage reporting.
- **Multilingual Clinical Voice & AI**: Real natural language processing supporting English, Tamil, and Tanglish (e.g. *"Paracetamol stock evlo irukku?"* and *"Paracetamol 10 piece sell pannunga"*), with mandatory confirmation checkpoints on all write transactions.
- **Statistical Machine Learning**: Real demand forecasting using Ordinary Least Squares linear regression and anomaly detection. If fewer than 5 historical data points exist, an explicit insufficient-data response is returned instead of fabricated confidence values.

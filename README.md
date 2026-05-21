# Chatbot App

Simple support chatbot with a FastAPI backend and a Next.js frontend.

## What You Need

- Docker
- Python 3.12+
- Node.js 20+

## Step 1: Start the database services

From the project root, run:

```bash
docker compose up -d 
```

This starts:

- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`
- Adminer on `http://localhost:8080`

## Step 2: Set up the backend

Open a terminal in the `server` folder and let `uv` create and manage the virtual environment for you:

```bash
cd server
uv sync
```


Make sure `server/.env` exists with these values:

```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/database
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=dev-secret-key-change-in-production-immediately
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
CORS_ORIGINS=http://localhost:3000
```

Run the database seed once if you want the demo users:

```bash
uv run python seed.py
```

Start the backend server:

```bash
uv run uvicorn main:combined_app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at `http://localhost:8000`.

## Step 3: Set up the frontend

Open another terminal in the `client` folder and install dependencies if needed:

```bash
cd client
pnpm install
```

Start the Next.js app:

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`.

## Step 4: Log in

Open `http://localhost:3000/login`.

For testing, use the quick login buttons or these accounts:

- Admin: `admin@support.com`
- Support Staff 1: `staff1@support.com`
- Support Staff 2: `staff2@support.com`
- Support Staff 3: `staff3@support.com`
- Support Staff 4: `staff4@support.com`
- Support Staff 5: `staff5@support.com`

All demo accounts use the password:

```text
password123
```

## Useful Links

- Frontend: `http://localhost:3000`
- Backend health check: `http://localhost:8000/api/health`
- Adminer: `http://localhost:8080`

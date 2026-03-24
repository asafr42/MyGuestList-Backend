# MyGuestList — Backend

Node.js/Express REST API for the MyGuestList application. Connects to MongoDB, issues JWTs for authentication, and enforces per-user data isolation on every request.

---

## Stack

| Technology | Version |
|-----------|---------|
| Node.js | 18 |
| Express | 4.18 |
| MongoDB | 7.0 (Mongoose 7.5) |
| JWT | jsonwebtoken 9.0 |
| Testing | Jest 29 + Supertest |

---

## Project Structure

```
MyGuestList-Backend/
├── server.js               # Express app + route definitions
├── models/
│   ├── User.js             # User schema (email, hashed password)
│   └── Guest.js            # Guest schema (name, status, side, category, userId)
├── middleware/
│   └── auth.js             # JWT verification middleware
├── tests/
│   └── unit.test.js        # Jest unit tests (no DB required)
├── e2e/
│   ├── e2e-infra-test.sh   # 10 infrastructure checks via bash + curl
│   └── README.md
├── docker-compose.yml      # Local dev: backend + MongoDB
└── Dockerfile              # Multi-stage production image
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | — | DB health check |
| POST | `/api/auth/register` | — | Register new user, returns JWT |
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/guests` | JWT | List all guests for authenticated user |
| POST | `/api/guests` | JWT | Add a guest |
| GET | `/api/guests/stats` | JWT | Get statistics (total, confirmed, pending, declined) |
| GET | `/api/guests/:id` | JWT | Get guest by ID |
| PUT | `/api/guests/:id` | JWT | Update guest |
| DELETE | `/api/guests/:id` | JWT | Delete guest |

All JWT-protected routes filter by `userId` — users can never access each other's data.

---

## Local Development

```bash
# With Docker (recommended — includes MongoDB)
docker compose up --build

# Without Docker (requires a running MongoDB)
npm install
npm run dev
```

Create `.env`:
```
MONGO_URI=mongodb://admin:supersecretpassword@localhost:27017/myguestlist?authSource=admin
JWT_SECRET=your-secret-key
PORT=5000
```

---

## Testing

```bash
# Unit tests (no DB required)
npm test

# Integration + E2E tests (requires Docker Compose running)
docker compose up -d --build
API_URL=http://localhost:5000 bash e2e/e2e-infra-test.sh
```

The E2E script runs 10 sequential checks: registration, login, auth errors, guest CRUD, stats, and cross-user data isolation.

See [`e2e/README.md`](e2e/README.md) for full details.

---

## CI/CD Pipeline

| Job | Trigger | Description |
|-----|---------|-------------|
| `unit-tests` | push to main | Jest unit tests (no DB) |
| `integration-tests` | after unit-tests | Docker Compose + health check |
| `e2e-tests` | after integration | 10 infra checks via bash/curl |
| `build-and-publish` | after e2e | Docker build → ECR → `kubectl set image` |
| `smoke-test-prod` | after deploy | Health check against production EKS |

Pipeline blocks on any failure — a broken version never reaches ECR or EKS.

---

## Docker

```bash
docker build -t myguestlist-backend .
docker run -p 5000:5000 --env-file .env myguestlist-backend
```

Multi-stage build: installs production dependencies only, runs as non-root `node` user.

---

## Security

| Feature | Detail |
|---------|--------|
| Non-root user | `node` user in container |
| Read-only filesystem | `readOnlyRootFilesystem: true` in K8s |
| Capabilities | `drop: [ALL]` |
| Resource limits | CPU 500m / Memory 256Mi |
| Data isolation | Every query filtered by `userId` |
| Password storage | bcryptjs hashing, never stored in plaintext |

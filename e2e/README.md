# E2E Infrastructure Tests

This directory contains **End-to-End infrastructure tests** for the MyGuestList application.

> These are **not** UI/browser tests. They validate the full infrastructure stack (API → Backend → MongoDB) using `curl` and `bash` — no browser required.

## What is Tested

The test script runs **10 sequential infrastructure checks**:

| # | Test | What it validates |
|---|------|------------------|
| 1 | Backend Health | Backend container is reachable (returns 401 = alive) |
| 2 | Register User | `POST /api/auth/register` creates user and returns JWT |
| 3 | Login | `POST /api/auth/login` authenticates and returns JWT |
| 4 | Wrong Password | Returns 401 when password is incorrect |
| 5 | Empty Guest List | New user starts with empty data (data isolation) |
| 6 | Add Guest | `POST /api/guests` saves guest to MongoDB |
| 7 | DB Persistence | `GET /api/guests` retrieves the saved guest from DB |
| 8 | Stats Endpoint | `GET /api/guests/stats` returns correct totals |
| 9 | Update Guest | `PUT /api/guests/:id` updates guest status correctly |
| 10 | Data Isolation | User 2 cannot see User 1's data (security check) |

## File Structure

```
e2e/
├── README.md           ← You are here
└── e2e-infra-test.sh   ← Main test script (bash + curl)
```

## How to Run Locally

### Prerequisites
- The full stack must be running (via Docker Compose)
- `curl` installed (standard on Linux/Mac)

### Steps

```bash
# 1. Start the full stack
docker compose up -d --build

# 2. Wait for services to be ready
sleep 20

# 3. Run the E2E infrastructure tests
API_URL=http://localhost:5000 bash e2e/e2e-infra-test.sh

# 4. Tear down
docker compose down
```

### Expected Output

```
🔵 ============================================
🔵  MyGuestList - E2E Infrastructure Tests
🔵  Target: http://localhost:5000
🔵 ============================================

🔵 TEST 1: Backend is reachable...
✅ Backend is up (returned 401 Unauthorized as expected)
🔵 TEST 2: Register a new user...
✅ User registered successfully. Token received.
...
🔵 ============================================
✅ PASSED: 10
✅ FAILED: 0
✅ All 10 E2E infrastructure tests passed! 🚀
```

## How it runs in CI/CD

The E2E tests run automatically as **JOB 3** in the GitHub Actions pipeline (`.github/workflows/ci-cd.yaml`), after the integration tests pass and before the Docker images are built and pushed to ECR.

```
JOB 1: unit-tests
    ↓
JOB 2: integration-tests
    ↓
JOB 3: e2e-tests  ← This runs e2e-infra-test.sh
    ↓
JOB 4: build-and-publish (ECR)
    ↓
JOB 5: deploy-to-k8s (EKS)
```

The pipeline will **fail and stop** if any E2E test fails, preventing a broken version from being deployed to AWS.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `API_URL` | `http://localhost:5000` | Base URL of the backend API to test |

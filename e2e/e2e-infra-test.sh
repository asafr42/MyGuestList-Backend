#!/bin/bash

# ============================================================
# E2E Infrastructure Test - MyGuestList
# Tests the full stack: API → Backend → MongoDB
# ============================================================

set -e  # Exit immediately if any command fails

BASE_URL="${API_URL:-http://localhost:5000}"
PASS=0
FAIL=0

green() { echo -e "\033[32m✅ $1\033[0m"; }
red()   { echo -e "\033[31m❌ $1\033[0m"; }
blue()  { echo -e "\033[34m🔵 $1\033[0m"; }

blue "============================================"
blue " MyGuestList - E2E Infrastructure Tests"
blue " Target: $BASE_URL"
blue "============================================"

# ─── TEST 1: Backend Health ────────────────────────────────
blue "\nTEST 1: Backend is reachable..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/guests" || echo "000")
if [ "$STATUS" = "401" ]; then
  green "Backend is up (returned 401 Unauthorized as expected for unauthenticated request)"
  PASS=$((PASS+1))
else
  red "Backend unreachable or unexpected status: $STATUS"
  FAIL=$((FAIL+1))
fi

# ─── TEST 2: Register New User ────────────────────────────
blue "\nTEST 2: Register a new user..."
TIMESTAMP=$(date +%s)
EMAIL="e2e_${TIMESTAMP}@test.com"

REGISTER_RESPONSE=$(curl -sf -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"E2ETest123!\"}")

TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  green "User registered successfully. Token received."
  PASS=$((PASS+1))
else
  red "Registration failed. Response: $REGISTER_RESPONSE"
  FAIL=$((FAIL+1))
  exit 1
fi

# ─── TEST 3: Login ────────────────────────────────────────
blue "\nTEST 3: Login with registered user..."
LOGIN_RESPONSE=$(curl -sf -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"E2ETest123!\"}")

LOGIN_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$LOGIN_TOKEN" ]; then
  green "Login successful. JWT Token received."
  PASS=$((PASS+1))
  TOKEN=$LOGIN_TOKEN
else
  red "Login failed. Response: $LOGIN_RESPONSE"
  FAIL=$((FAIL+1))
fi

# ─── TEST 4: Wrong Password Returns 401 ──────────────────
blue "\nTEST 4: Wrong password returns 401..."
WRONG_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"wrongpassword\"}")

if [ "$WRONG_STATUS" = "401" ]; then
  green "Wrong password correctly rejected (401)."
  PASS=$((PASS+1))
else
  red "Expected 401 but got: $WRONG_STATUS"
  FAIL=$((FAIL+1))
fi

# ─── TEST 5: Get Empty Guest List ────────────────────────
blue "\nTEST 5: Get guests (expect empty list for new user)..."
GUESTS_RESPONSE=$(curl -sf "$BASE_URL/api/guests" \
  -H "Authorization: Bearer $TOKEN")

if echo "$GUESTS_RESPONSE" | grep -q "\[\]"; then
  green "Empty guest list returned for new user. Data isolation works!"
  PASS=$((PASS+1))
else
  red "Expected empty array. Got: $GUESTS_RESPONSE"
  FAIL=$((FAIL+1))
fi

# ─── TEST 6: Add a Guest ─────────────────────────────────
blue "\nTEST 6: Add a new guest..."
ADD_RESPONSE=$(curl -sf -X POST "$BASE_URL/api/guests" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"firstName":"E2E","lastName":"TestGuest","phone":"+972501234567","side":"Groom","category":"Friends","invitedCount":2}')

GUEST_ID=$(echo "$ADD_RESPONSE" | grep -o '"_id":"[^"]*"' | cut -d'"' -f4)

if [ -n "$GUEST_ID" ]; then
  green "Guest added successfully. ID: $GUEST_ID"
  PASS=$((PASS+1))
else
  red "Failed to add guest. Response: $ADD_RESPONSE"
  FAIL=$((FAIL+1))
fi

# ─── TEST 7: Retrieve Guest from DB ──────────────────────
blue "\nTEST 7: Retrieve guests - verify DB persistence..."
GUESTS_AFTER=$(curl -sf "$BASE_URL/api/guests" \
  -H "Authorization: Bearer $TOKEN")

if echo "$GUESTS_AFTER" | grep -q "E2E"; then
  green "Guest retrieved from MongoDB. DB persistence works!"
  PASS=$((PASS+1))
else
  red "Guest not found in DB. Response: $GUESTS_AFTER"
  FAIL=$((FAIL+1))
fi

# ─── TEST 8: Stats Endpoint ──────────────────────────────
blue "\nTEST 8: Stats endpoint returns correct totals..."
STATS=$(curl -sf "$BASE_URL/api/guests/stats" \
  -H "Authorization: Bearer $TOKEN")

if echo "$STATS" | grep -q '"totalInvited":2'; then
  green "Stats endpoint works. totalInvited=2 as expected."
  PASS=$((PASS+1))
else
  red "Stats incorrect. Response: $STATS"
  FAIL=$((FAIL+1))
fi

# ─── TEST 9: Update Guest Status ────────────────────────
blue "\nTEST 9: Update guest status to Confirmed..."
UPDATE_RESPONSE=$(curl -sf -X PUT "$BASE_URL/api/guests/$GUEST_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"Confirmed","confirmedCount":2}')

if echo "$UPDATE_RESPONSE" | grep -q '"status":"Confirmed"'; then
  green "Guest status updated to Confirmed successfully."
  PASS=$((PASS+1))
else
  red "Update failed. Response: $UPDATE_RESPONSE"
  FAIL=$((FAIL+1))
fi

# ─── TEST 10: Data Isolation Between Users ───────────────
blue "\nTEST 10: User data isolation - second user cannot see first user guests..."
REG2=$(curl -sf -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"e2e2_${TIMESTAMP}@test.com\",\"password\":\"E2ETest123!\"}")
TOKEN2=$(echo "$REG2" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

GUESTS2=$(curl -sf "$BASE_URL/api/guests" \
  -H "Authorization: Bearer $TOKEN2")

if echo "$GUESTS2" | grep -q "\[\]"; then
  green "Data isolation verified! User 2 cannot see User 1's guests."
  PASS=$((PASS+1))
else
  red "SECURITY ISSUE: User 2 can see User 1's data!"
  FAIL=$((FAIL+1))
fi

# ─── SUMMARY ─────────────────────────────────────────────
echo ""
blue "============================================"
blue " E2E Infrastructure Test Results"
blue "============================================"
green " PASSED: $PASS"
if [ "$FAIL" -gt 0 ]; then
  red " FAILED: $FAIL"
  exit 1
else
  green " FAILED: 0"
  echo ""
  green " All $PASS E2E infrastructure tests passed! 🚀"
fi

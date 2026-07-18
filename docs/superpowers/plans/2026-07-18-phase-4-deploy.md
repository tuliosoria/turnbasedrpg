# Phase 4: AWS Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. **Several steps create real, billable AWS resources and are irreversible — confirm with the user before running them.**

**Goal:** Deploy the backend (Lambda + API Gateway HTTP API + DynamoDB) to AWS via SAM in `us-east-1`, seed the campaign, host the frontend (built with `VITE_API_BASE_URL` pointing at the deployed API), and verify the live system end-to-end.

**Architecture:** SAM stack `ravenloft-winter` deploys the prebuilt esbuild bundle (`backend/dist`). Secrets (`ADMIN_CODE_HASH`, `TOKEN_SIGNING_SECRET`) are passed as `NoEcho` CloudFormation parameters via `--parameter-overrides` (never committed). The frontend is built to static assets and served by AWS Amplify Hosting. CORS is locked to the frontend origin once known.

**Tech Stack:** AWS SAM CLI, CloudFormation, DynamoDB, Lambda (nodejs22.x), API Gateway HTTP API, AWS Amplify Hosting, Node crypto for secret generation.

**Account/region:** `825081952316` / `us-east-1` (IAM user `amplify-deploy`).

---

## Task 1: Generate secrets (local, not committed)

**Files:** none committed. Secrets are written to `backend/.deploy.env` which is gitignored.

- [ ] **Step 1: Choose an admin code and generate the hash + signing secret**

The admin code is what the game master types on `/admin`. `ADMIN_CODE_HASH` must be `sha256hex(adminCode)` (matches `hashCode` in `backend/src/auth/codes.ts`).

```bash
cd /Users/jessicarosa/turnbasedrpg
ADMIN_CODE="<chosen-admin-code>"
ADMIN_CODE_HASH=$(node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" "$ADMIN_CODE")
TOKEN_SIGNING_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
cat > backend/.deploy.env <<EOF
ADMIN_CODE_HASH=$ADMIN_CODE_HASH
TOKEN_SIGNING_SECRET=$TOKEN_SIGNING_SECRET
EOF
echo "Admin code (give to the game master, store securely): $ADMIN_CODE"
```

- [ ] **Step 2: Ensure the secret file is gitignored**

`.gitignore` already ignores `.env` and `.env.*`; also add `backend/.deploy.env` explicitly:

```bash
grep -qx "backend/.deploy.env" .gitignore || echo "backend/.deploy.env" >> .gitignore
```

---

## Task 2: Build and deploy the backend (BILLABLE — confirm first)

**Files:**
- Create: `backend/samconfig.toml` (non-secret deploy settings; safe to commit)

- [ ] **Step 1: Build the self-contained Lambda bundle**

```bash
npm run build:backend      # build:shared + esbuild -> backend/dist/handler.mjs
```

- [ ] **Step 2: Create `backend/samconfig.toml` (non-secret settings only)**

```toml
version = 0.1

[default.global.parameters]
stack_name = "ravenloft-winter"

[default.deploy.parameters]
region = "us-east-1"
capabilities = "CAPABILITY_IAM"
resolve_s3 = true
confirm_changeset = false
fail_on_empty_changeset = false
```

- [ ] **Step 3: Deploy (creates DynamoDB table, Lambda, HTTP API — billable)**

```bash
cd backend
set -a; . .deploy.env; set +a
sam build
sam deploy \
  --parameter-overrides \
    "AdminCodeHash=$ADMIN_CODE_HASH" \
    "TokenSigningSecret=$TOKEN_SIGNING_SECRET" \
    "AllowedOrigin=*"
```

`AllowedOrigin=*` is used initially (the app sends no cookies — tokens travel in the `Authorization` header — so a wildcard origin is safe for MVP). It is tightened to the real frontend origin in Task 6.

- [ ] **Step 4: Capture the API base URL**

```bash
API_BASE_URL=$(aws cloudformation describe-stacks --stack-name ravenloft-winter \
  --region us-east-1 --query "Stacks[0].Outputs[?OutputKey=='ApiBaseUrl'].OutputValue" --output text)
echo "$API_BASE_URL"
```

Expected: `https://<id>.execute-api.us-east-1.amazonaws.com`.

- [ ] **Step 5: Commit the non-secret deploy config**

```bash
git add backend/samconfig.toml .gitignore
git commit -m "chore(backend): add SAM deploy config for ravenloft-winter stack"
```

---

## Task 3: Seed the campaign table (BILLABLE writes)

- [ ] **Step 1: Seed the campaign META + turn status**

```bash
cd /Users/jessicarosa/turnbasedrpg
TABLE_NAME=ravenloft-game AWS_REGION=us-east-1 CAMPAIGN_ID=winter-dead npm run seed
```

Expected: `Seeded campaign winter-dead into ravenloft-game.`

- [ ] **Step 2: Verify the seed rows exist**

```bash
aws dynamodb get-item --region us-east-1 --table-name ravenloft-game \
  --key '{"PK":{"S":"CAMPAIGN#WINTER_DEAD"},"SK":{"S":"META"}}'
aws dynamodb get-item --region us-east-1 --table-name ravenloft-game \
  --key '{"PK":{"S":"CAMPAIGN#WINTER_DEAD#TURN#001"},"SK":{"S":"META"}}'
```

Expected: both items returned; turn META has `turnStatus = OPEN`.

---

## Task 4: Backend smoke test (live API)

- [ ] **Step 1: Public endpoints**

```bash
curl -s "$API_BASE_URL/api/campaign" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.id,j.turnStatus,j.contentVersion)})"
curl -s "$API_BASE_URL/api/houses" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('houses:',j.length,'available:',j.filter(h=>h.available).length)})"
```

Expected: campaign prints `winter-dead OPEN <version>`; houses prints `houses: 6 available: 6`.

- [ ] **Step 2: Claim → login → game round-trip**

```bash
CLAIM=$(curl -s -X POST "$API_BASE_URL/api/claim-house" -H "Content-Type: application/json" -d '{"houseId":"vargen","displayName":"SmokeTest"}')
echo "$CLAIM"
PLAYER_TOKEN=$(node -e "console.log(JSON.parse(process.argv[1]).playerToken)" "$CLAIM")
curl -s "$API_BASE_URL/api/player/game" -H "Authorization: Bearer $PLAYER_TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('house:',j.houseId,'cards:',j.cards.length,'status:',j.turnStatus)})"
```

Expected: claim returns a `playerCode`/`playerToken`; game view returns `house: vargen`, a non-zero card count, `status: OPEN`.

- [ ] **Step 3: Admin login + dashboard + lock/unlock**

```bash
ADMIN_TOKEN=$(curl -s -X POST "$API_BASE_URL/api/admin/login" -H "Content-Type: application/json" -d "{\"adminCode\":\"$ADMIN_CODE\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).adminToken))")
curl -s "$API_BASE_URL/api/admin/dashboard" -H "Authorization: Bearer $ADMIN_TOKEN" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('rows:',j.rows.length,'status:',j.turnStatus)})"
curl -s -o /dev/null -w "lock:%{http_code}\n" -X POST "$API_BASE_URL/api/admin/turn/lock" -H "Authorization: Bearer $ADMIN_TOKEN"
curl -s -o /dev/null -w "unlock:%{http_code}\n" -X POST "$API_BASE_URL/api/admin/turn/unlock" -H "Authorization: Bearer $ADMIN_TOKEN"
```

Expected: dashboard returns 6 rows; `lock:204`; `unlock:204`.

- [ ] **Step 4: Clean up the smoke-test data**

```bash
aws dynamodb delete-item --region us-east-1 --table-name ravenloft-game \
  --key '{"PK":{"S":"CAMPAIGN#WINTER_DEAD"},"SK":{"S":"HOUSE#vargen"}}'
aws dynamodb delete-item --region us-east-1 --table-name ravenloft-game \
  --key '{"PK":{"S":"CAMPAIGN#WINTER_DEAD#TURN#001"},"SK":{"S":"HOUSE#vargen"}}'
# Also delete the PLAYER#<hash> profile printed by the claim response (codeHash-derived key).
```

Expected: the `vargen` claim/choice/profile rows are removed so the house is available again for real players.

---

## Task 5: Build and deploy the frontend (BILLABLE — Amplify Hosting)

**Files:**
- Create: `frontend/.env.production` (contains only the public API base URL; gitignore-safe to keep local)

- [ ] **Step 1: Point the frontend at the live API and build**

```bash
cd /Users/jessicarosa/turnbasedrpg
echo "VITE_API_BASE_URL=$API_BASE_URL" > frontend/.env.production
npm run build   # tsc -b + vite build -> frontend/dist
```

Expected: `frontend/dist/index.html` + hashed assets, built against the live API URL.

- [ ] **Step 2: Create the Amplify app + branch (manual deploy, no GitHub OAuth needed)**

```bash
APP_ID=$(aws amplify create-app --name ravenloft-winter --region us-east-1 \
  --query "app.appId" --output text)
aws amplify create-branch --app-id "$APP_ID" --branch-name main --region us-east-1
```

- [ ] **Step 3: Zip and deploy the built assets**

```bash
cd frontend/dist && zip -r ../dist.zip . && cd ..
DEPLOY=$(aws amplify create-deployment --app-id "$APP_ID" --branch-name main --region us-east-1)
JOB_ID=$(node -e "console.log(JSON.parse(process.argv[1]).jobId)" "$DEPLOY")
UPLOAD_URL=$(node -e "console.log(JSON.parse(process.argv[1]).zipUploadUrl)" "$DEPLOY")
curl -s -H "Content-Type: application/zip" --upload-file dist.zip "$UPLOAD_URL"
aws amplify start-deployment --app-id "$APP_ID" --branch-name main --job-id "$JOB_ID" --region us-east-1
```

- [ ] **Step 4: Get the frontend URL**

```bash
FRONTEND_URL="https://main.${APP_ID}.amplifyapp.com"
echo "$FRONTEND_URL"
```

Poll until the Amplify job reaches `SUCCEED`:

```bash
aws amplify get-job --app-id "$APP_ID" --branch-name main --job-id "$JOB_ID" --region us-east-1 \
  --query "job.summary.status" --output text
```

---

## Task 6: Lock CORS to the frontend origin + final verification

- [ ] **Step 1: Redeploy the backend with the real origin**

```bash
cd /Users/jessicarosa/turnbasedrpg/backend
set -a; . .deploy.env; set +a
sam deploy \
  --parameter-overrides \
    "AdminCodeHash=$ADMIN_CODE_HASH" \
    "TokenSigningSecret=$TOKEN_SIGNING_SECRET" \
    "AllowedOrigin=$FRONTEND_URL"
```

- [ ] **Step 2: Verify CORS from the frontend origin**

```bash
curl -s -i -X OPTIONS "$API_BASE_URL/api/campaign" \
  -H "Origin: $FRONTEND_URL" -H "Access-Control-Request-Method: GET" | grep -i "access-control-allow-origin"
```

Expected: `access-control-allow-origin: $FRONTEND_URL`.

- [ ] **Step 3: Manual end-to-end check in the browser**

Open `$FRONTEND_URL`, claim a house, note the player code, reload/login with it, submit a choice; open `/admin`, log in with the admin code, confirm the choice appears, lock/unlock the turn.

- [ ] **Step 4: Record the URLs**

Note `API_BASE_URL`, `FRONTEND_URL`, and `APP_ID` in the checkpoint. The admin code stays secret (never committed).

---

## Definition of done (Phase 4)

- SAM stack `ravenloft-winter` deployed in `us-east-1`; `ApiBaseUrl` output captured.
- DynamoDB table seeded; live public + player + admin smoke tests pass; smoke-test data removed.
- Frontend built against the live API and served via Amplify at `$FRONTEND_URL`.
- CORS locked to `$FRONTEND_URL`; OPTIONS preflight returns the correct allow-origin.
- Secrets never committed (`backend/.deploy.env`, `frontend/.env.production` gitignored).

#!/usr/bin/env bash
set -euo pipefail
: "${GOOGLE_CLOUD_PROJECT:?Set GOOGLE_CLOUD_PROJECT to your authorized project ID}"
: "${INSTANCE_CONNECTION_NAME:?Set the Cloud SQL project:region:instance connection name}"
: "${DB_USER:?Set the PostgreSQL database user}"
: "${DB_NAME:=cafe}"
: "${REGION:=asia-south1}"
: "${SERVICE:=common-ground-cafe}"
: "${CAFE_ID:=common-ground-live}"
: "${FIREBASE_PROJECT_ID:=$GOOGLE_CLOUD_PROJECT}"
command -v gcloud >/dev/null || { echo 'Install the Google Cloud CLI and sign in first.'; exit 1; }
cd "$(dirname "$0")/.."
# Create the Cloud SQL database/user and secrets first. Runtime needs Cloud SQL Client,
# Firebase Authentication Viewer (for revocation checks), and access to these secrets.
SECRETS='SESSION_SECRET=cafe-session-secret:latest,STAFF_ACCOUNTS_JSON=cafe-staff-accounts:latest,DB_PASSWORD=cafe-db-password:latest'
if [[ -n "${GEMINI_SECRET_NAME:-}" ]]; then SECRETS+=",GEMINI_API_KEY=${GEMINI_SECRET_NAME}:latest"; fi
gcloud run deploy "$SERVICE" --project "$GOOGLE_CLOUD_PROJECT" --region "$REGION" \
  --source . --allow-unauthenticated --port 8080 --min 0 --max 3 \
  --service-account "cafe-runtime@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com" \
  --add-cloudsql-instances "$INSTANCE_CONNECTION_NAME" \
  --set-env-vars "NODE_ENV=production,DATA_STORE=postgres,DEMO_MODE=false,CAFE_ID=${CAFE_ID},CURRENCY=inr,PUBLIC_URL=${PUBLIC_URL:?Set PUBLIC_URL},INSTANCE_CONNECTION_NAME=${INSTANCE_CONNECTION_NAME},DB_USER=${DB_USER},DB_NAME=${DB_NAME},FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID},FIREBASE_WEB_API_KEY=${FIREBASE_WEB_API_KEY:-},FIREBASE_AUTH_DOMAIN=${FIREBASE_AUTH_DOMAIN:-},FIREBASE_APP_ID=${FIREBASE_APP_ID:-}" \
  --set-secrets "$SECRETS"
DEPLOYED_CAFE_URL="$(gcloud run services describe "$SERVICE" --project "$GOOGLE_CLOUD_PROJECT" --region "$REGION" --format='value(status.url)')"
gcloud run services update "$SERVICE" --project "$GOOGLE_CLOUD_PROJECT" --region "$REGION" --update-env-vars "PUBLIC_URL=${DEPLOYED_CAFE_URL}"
printf 'Café preview: %s\n' "$DEPLOYED_CAFE_URL"

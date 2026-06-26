#!/bin/bash
# ScanVul AI CI/CD Integration Script
# Usage:
#   curl -sL https://scanvul.ai/scripts/scanvul-ci.sh | bash -s -- --url https://scanvul.ai --token <YOUR_TOKEN> --fail-on critical,high

set -e

# Default configurations
SCANVUL_URL="http://localhost:3000"
TOKEN=""
FAIL_ON="critical"
SOURCE_VALUE="."
SOURCE_TYPE="repo_url"

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --url) SCANVUL_URL="$2"; shift ;;
        --token) TOKEN="$2"; shift ;;
        --fail-on) FAIL_ON="$2"; shift ;;
        --source) SOURCE_VALUE="$2"; shift ;;
        --type) SOURCE_TYPE="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

if [ -z "$TOKEN" ]; then
    echo "❌ Error: --token is required."
    exit 1
fi

echo "🚀 Starting ScanVul AI CI integration..."
echo "🔗 Endpoint: $SCANVUL_URL"
echo "📦 Source: $SOURCE_VALUE ($SOURCE_TYPE)"

# Trigger Scan
echo "⏳ Triggering scan..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$SCANVUL_URL/api/ci/scan" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"sourceType\": \"$SOURCE_TYPE\", \"sourceValue\": \"$SOURCE_VALUE\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ne 201 ]; then
    echo "❌ Failed to trigger scan. HTTP Code: $HTTP_CODE"
    echo "Response: $BODY"
    exit 1
fi

SCAN_ID=$(echo "$BODY" | grep -o '"scanId":"[^"]*' | grep -o '[^"]*$')
echo "✅ Scan started successfully! Scan ID: $SCAN_ID"

# Polling for status
MAX_RETRIES=60 # 10 minutes (60 * 10s)
RETRY_COUNT=0
STATUS="queued"

echo "⏳ Waiting for scan to complete..."

while [[ "$STATUS" == "queued" || "$STATUS" == "running" ]]; do
    if [ "$RETRY_COUNT" -gt "$MAX_RETRIES" ]; then
        echo "❌ Scan timed out after 10 minutes."
        exit 1
    fi

    sleep 10
    RETRY_COUNT=$((RETRY_COUNT+1))

    STATUS_RESP=$(curl -s -X GET "$SCANVUL_URL/api/ci/scan/$SCAN_ID/status" \
      -H "Authorization: Bearer $TOKEN")
    
    STATUS=$(echo "$STATUS_RESP" | grep -o '"status":"[^"]*' | grep -o '[^"]*$' || echo "unknown")
    echo "   - Status: $STATUS..."
done

if [ "$STATUS" == "failed" ]; then
    echo "❌ Scan failed on the server."
    exit 1
fi

echo "✅ Scan completed!"

# Download SARIF
echo "📥 Downloading SARIF report..."
curl -s -o scanvul-results.sarif -X GET "$SCANVUL_URL/api/ci/reports/$SCAN_ID?format=sarif" \
  -H "Authorization: Bearer $TOKEN"

echo "✅ SARIF report saved to scanvul-results.sarif"

# Evaluate Policy
echo "📊 Evaluating policy (Fail on: $FAIL_ON)..."
CRITICAL_COUNT=$(grep -o '"level": "error"' scanvul-results.sarif | wc -l | tr -d ' ' || echo "0")
WARNING_COUNT=$(grep -o '"level": "warning"' scanvul-results.sarif | wc -l | tr -d ' ' || echo "0")

echo "Found $CRITICAL_COUNT Critical/High (Error) issues."
echo "Found $WARNING_COUNT Medium (Warning) issues."

if [[ "$FAIL_ON" == *"critical"* || "$FAIL_ON" == *"high"* ]]; then
    if [ "$CRITICAL_COUNT" -gt 0 ]; then
        echo "❌ Policy violation: Found $CRITICAL_COUNT Critical/High issues."
        exit 1
    fi
fi

if [[ "$FAIL_ON" == *"medium"* ]]; then
    if [ "$WARNING_COUNT" -gt 0 ]; then
        echo "❌ Policy violation: Found $WARNING_COUNT Medium issues."
        exit 1
    fi
fi

echo "✅ All policies passed! Great job."
exit 0

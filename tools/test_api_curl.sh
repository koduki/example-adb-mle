#!/bin/bash

# Configuration
# Default to a placeholder if not provided
BASE_URL=$1

if [ -z "$BASE_URL" ]; then
    echo "Usage: ./test_api_curl.sh <ORDS_BASE_URL>"
    echo "Example: ./test_api_curl.sh https://<hostname>/ords/admin/sneakerheadz"
    echo "You can find your ORDS URL in the OCI Console or by checking your ORDS deployment."
    exit 1
fi

echo "Targeting ORDS Base URL: $BASE_URL"

echo "=================================================="
echo "[1] GET /api/search (Before Purchase)"
echo "    Checking price calculation (Premium=0, Budget=50000)"
echo "--------------------------------------------------"
curl -s -X GET "$BASE_URL/api/search?premium=0&budget=50000" | jq .
echo ""

echo "=================================================="
echo "[2] POST /api/buy (Purchase Sneaker ID 1)"
echo "    Buying 'Air Jordan 1' (Size US10)"
echo "--------------------------------------------------"
# Note: ORDS Auto-PLSQL maps JSON keys to bind variables
curl -s -X POST \
     -H "Content-Type: application/json" \
     -d '{"id": 1, "size": "US10", "user": "curl_client", "premium": 0}' \
     "$BASE_URL/api/buy" | jq .
echo ""

echo "=================================================="
echo "[3] GET /api/search (After Purchase)"
echo "    Verifying stock decrement (Should see reduced stock logic if visible, or re-check DB)"
echo "--------------------------------------------------"
curl -s -X GET "$BASE_URL/api/search?premium=0&budget=50000" | jq .
echo ""

echo "Done."

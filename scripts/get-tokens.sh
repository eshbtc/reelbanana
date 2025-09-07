#!/usr/bin/env bash

# Script to help users get the required tokens for E2E testing
# This script provides instructions for obtaining App Check and ID tokens

echo "🔑 ReelBanana E2E Test Token Setup"
echo "=================================="
echo ""

echo "To run the E2E smoke test, you need two tokens:"
echo ""

echo "1️⃣ App Check Token (X-Firebase-AppCheck header):"
echo "   - Open your browser and go to: https://reel-banana-35a54.web.app"
echo "   - Open Developer Tools (F12)"
echo "   - Go to Network tab"
echo "   - Make any API call (like creating a project)"
echo "   - Look for a request to one of the backend services"
echo "   - In the request headers, find 'X-Firebase-AppCheck'"
echo "   - Copy the token value"
echo ""

echo "2️⃣ Firebase ID Token (Authorization header):"
echo "   - In the same browser session (logged in)"
echo "   - Go to Application tab in Developer Tools"
echo "   - Expand Local Storage → https://reel-banana-35a54.web.app"
echo "   - Look for 'firebase:authUser' key"
echo "   - Click on it and find the 'stsTokenManager' object"
echo "   - Copy the 'accessToken' value"
echo ""

echo "3️⃣ Set the environment variables:"
echo "   export APP_CHECK_TOKEN=\"your-app-check-token-here\""
echo "   export ID_TOKEN=\"your-firebase-id-token-here\""
echo ""

echo "4️⃣ Run the E2E test:"
echo "   ./scripts/e2e_smoke.sh"
echo ""

echo "💡 Alternative: Copy the template and fill in values:"
echo "   cp scripts/e2e-smoke-template.env scripts/.env.smoke"
echo "   # Edit .env.smoke with your tokens"
echo ""

echo "🚀 For development mode (localhost), App Check token is not required!"
echo "   Just set: export UPLOAD_BASE=\"http://localhost:8083\""
echo "   (and other services to localhost URLs)"

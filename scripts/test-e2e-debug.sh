#!/usr/bin/env bash

# Test E2E with debug token (after Firebase configuration)

echo "🧪 E2E Test with Debug Token"
echo "============================"
echo ""

echo "This script tests the E2E pipeline using the debug token."
echo "Make sure you've configured the debug token in Firebase App Check first!"
echo ""

echo "📋 Prerequisites:"
echo "1. Debug token A767DE56-7486-4A78-8073-0156488A5007 configured in Firebase Console"
echo "2. All backend services deployed and healthy"
echo ""

read -p "Have you configured the debug token in Firebase App Check? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please configure the debug token first:"
    echo "1. Go to Firebase Console → App Check"
    echo "2. Add debug token: A767DE56-7486-4A78-8073-0156488A5007"
    echo "3. Run this script again"
    exit 1
fi

echo "🚀 Running E2E test with debug token..."

export APP_CHECK_TOKEN="A767DE56-7486-4A78-8073-0156488A5007"
./scripts/e2e_smoke.sh

echo ""
echo "✅ E2E test completed!"
echo ""
echo "If the test failed with 'APP_CHECK_INVALID', the debug token"
echo "may not be properly configured in Firebase App Check."

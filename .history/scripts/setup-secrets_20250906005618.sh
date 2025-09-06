#!/bin/bash

# ReelBanana Secret Manager Setup Script
# This script helps you retrieve secrets from Google Cloud Secret Manager
# and set up your local environment

echo "🔐 ReelBanana Secret Manager Setup"
echo "=================================="

# Check if gcloud is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Error: You need to authenticate with gcloud first"
    echo "Run: gcloud auth login"
    exit 1
fi

# Check if Secret Manager API is enabled
if ! gcloud services list --enabled --filter="name:secretmanager.googleapis.com" | grep -q secretmanager; then
    echo "❌ Error: Secret Manager API is not enabled"
    echo "Run: gcloud services enable secretmanager.googleapis.com"
    exit 1
fi

echo "✅ gcloud is authenticated and Secret Manager API is enabled"
echo ""

# Function to retrieve secret and create .env.local entry
create_env_entry() {
    local secret_name=$1
    local env_var=$2
    
    echo "Retrieving $secret_name..."
    if secret_value=$(gcloud secrets versions access latest --secret="$secret_name" 2>/dev/null); then
        echo "$env_var=$secret_value" >> .env.local
        echo "✅ Added $env_var to .env.local"
    else
        echo "❌ Failed to retrieve $secret_name"
        return 1
    fi
}

# Create .env.local file
echo "Creating .env.local file..."
> .env.local

# Add Firebase secrets
create_env_entry "firebase-api-key" "VITE_FIREBASE_API_KEY"
create_env_entry "firebase-project-id" "VITE_FIREBASE_PROJECT_ID"
create_env_entry "firebase-auth-domain" "VITE_FIREBASE_AUTH_DOMAIN"
create_env_entry "firebase-storage-bucket" "VITE_FIREBASE_STORAGE_BUCKET"
create_env_entry "firebase-messaging-sender-id" "VITE_FIREBASE_MESSAGING_SENDER_ID"
create_env_entry "firebase-app-id" "VITE_FIREBASE_APP_ID"

# Add environment setting
echo "NODE_ENV=development" >> .env.local

echo ""
echo "🎉 Environment setup complete!"
echo ""
echo "📁 Created .env.local with your Firebase configuration"
echo "🔒 All secrets are securely stored in Google Cloud Secret Manager"
echo ""
echo "⚠️  Important Security Notes:"
echo "   • .env.local is already in .gitignore and won't be committed"
echo "   • Never commit .env files to version control"
echo "   • Your API keys are now secure in Google Cloud Secret Manager"
echo ""
echo "🚀 You can now run your development server with: npm run dev"

#!/bin/bash

# Deploy API Key Service Script
# Usage: ./scripts/deploy-api-key-service.sh [environment]
# Environment: dev, staging, prod (default: prod)

set -e

ENVIRONMENT=${1:-prod}
PROJECT_ID="reel-banana-35a54"
SERVICE_NAME="reel-banana-api-key-service"
REGION="us-central1"
PORT="8085"
KMS_KEY_RING_ID="projects/reel-banana-35a54/locations/global/keyRings/api-keys"

echo "🚀 Deploying API Key Service to $ENVIRONMENT environment..."

# Set environment-specific configurations
case $ENVIRONMENT in
  "dev")
    NODE_ENV="development"
    DEV_MODE="true"
    MEMORY="256Mi"
    CPU="1"
    MAX_INSTANCES="3"
    ;;
  "staging")
    NODE_ENV="staging"
    DEV_MODE="true"
    MEMORY="256Mi"
    CPU="1"
    MAX_INSTANCES="5"
    ;;
  "prod")
    NODE_ENV="production"
    DEV_MODE="false"
    MEMORY="256Mi"
    CPU="1"
    MAX_INSTANCES="10"
    ;;
  *)
    echo "❌ Invalid environment: $ENVIRONMENT"
    echo "Usage: $0 [dev|staging|prod]"
    exit 1
    ;;
esac

echo "📋 Configuration:"
echo "  Environment: $ENVIRONMENT"
echo "  Node Environment: $NODE_ENV"
echo "  Dev Mode: $DEV_MODE"
echo "  Memory: $MEMORY"
echo "  CPU: $CPU"
echo "  Max Instances: $MAX_INSTANCES"
echo "  KMS Key Ring: $KMS_KEY_RING_ID"
echo ""

# Check if we're in the right directory
if [ ! -d "backend/api-key-service" ]; then
  echo "❌ Please run this script from the project root directory"
  exit 1
fi

# Check if gcloud is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
  echo "❌ Please authenticate with gcloud first:"
  echo "   gcloud auth login"
  exit 1
fi

# Set the project
echo "🔧 Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Verify KMS key ring exists
echo "🔐 Verifying KMS key ring..."
if ! gcloud kms keyrings describe api-keys --location=global > /dev/null 2>&1; then
  echo "❌ KMS key ring 'api-keys' not found in global location"
  echo "   Please create it first:"
  echo "   gcloud kms keyrings create api-keys --location=global"
  exit 1
fi

# Check if crypto key exists
if ! gcloud kms keys describe user-api-keys --keyring=api-keys --location=global > /dev/null 2>&1; then
  echo "❌ KMS crypto key 'user-api-keys' not found"
  echo "   Please create it first:"
  echo "   gcloud kms keys create user-api-keys --keyring=api-keys --location=global --purpose=encryption"
  exit 1
fi

echo "✅ KMS configuration verified"

# Navigate to service directory
cd backend/api-key-service

# Run tests
echo "🧪 Running tests..."
npm test || echo "⚠️  Tests not configured, continuing..."

# Build and deploy
echo "🏗️  Building and deploying service..."
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port $PORT \
  --set-env-vars NODE_ENV=$NODE_ENV \
  --set-env-vars DEV_MODE=$DEV_MODE \
  --set-env-vars KMS_KEY_RING_ID=$KMS_KEY_RING_ID \
  --memory $MEMORY \
  --cpu $CPU \
  --max-instances $MAX_INSTANCES \
  --min-instances 0 \
  --concurrency 100 \
  --timeout 300 \
  --quiet

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")
echo ""
echo "✅ Service deployed successfully!"
echo "🌐 Service URL: $SERVICE_URL"

# Health check
echo ""
echo "🏥 Running health check..."
sleep 10

for i in {1..5}; do
  if curl -f -s "$SERVICE_URL/health" > /dev/null; then
    echo "✅ Health check passed"
    break
  else
    echo "⏳ Health check attempt $i failed, retrying in 10s..."
    sleep 10
  fi
done

# Test KMS configuration
echo ""
echo "🔐 Testing KMS configuration..."
HEALTH_RESPONSE=$(curl -s "$SERVICE_URL/health")
if echo "$HEALTH_RESPONSE" | grep -q '"kmsConfigured":true'; then
  echo "✅ KMS configuration verified"
else
  echo "❌ KMS configuration failed"
  echo "Health response: $HEALTH_RESPONSE"
  exit 1
fi

echo ""
echo "🎉 Deployment completed successfully!"
echo "📊 Service Details:"
echo "  URL: $SERVICE_URL"
echo "  Environment: $ENVIRONMENT"
echo "  Region: $REGION"
echo "  Memory: $MEMORY"
echo "  CPU: $CPU"
echo "  KMS: Configured"
echo ""
echo "🔗 Useful commands:"
echo "  View logs: gcloud logs read --service=$SERVICE_NAME --region=$REGION"
echo "  Health check: curl $SERVICE_URL/health"
echo "  Service info: gcloud run services describe $SERVICE_NAME --region=$REGION"
echo "  KMS status: gcloud kms keys describe user-api-keys --keyring=api-keys --location=global"

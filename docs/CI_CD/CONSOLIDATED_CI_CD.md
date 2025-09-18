# Consolidated CI/CD Pipeline Documentation

## Overview

The ReelBanana CI/CD pipeline has been consolidated from multiple workflows into a single, comprehensive `deploy-all-services.yml` workflow that handles all backend services with proper environment variables and dependency validation.

## Consolidated Workflow: `deploy-all-services.yml`

### Key Features

1. **Service Detection**: Automatically detects which services have changed
2. **Environment Variables**: Properly configures all required environment variables and secrets
3. **Dependency Validation**: Comprehensive health checks including API keys, models, and configurations
4. **Parallel Deployment**: Deploys multiple services in parallel for efficiency
5. **Rollback Capabilities**: Built-in rollback support for failed deployments

### Environment Variables by Service

#### Upload Assets Service
```yaml
INPUT_BUCKET_NAME: reel-banana-35a54.firebasestorage.app
DEV_MODE: true
```

#### Narrate Service (ElevenLabs TTS)
```yaml
INPUT_BUCKET_NAME: reel-banana-35a54.firebasestorage.app
DEV_MODE: true
ELEVENLABS_API_KEY: (from secret ELEVENLABS_API_KEY_VOICE_NEW)
```

#### Align Captions Service
```yaml
INPUT_BUCKET_NAME: reel-banana-35a54.firebasestorage.app
DEV_MODE: true
```

#### Render Service (FAL Video Generation)
```yaml
INPUT_BUCKET_NAME: reel-banana-35a54.firebasestorage.app
OUTPUT_BUCKET_NAME: reel-banana-videos-public
FAL_RENDER_MODEL: fal-ai/veo3/fast/image-to-video
RENDER_ENGINE: fal
DEV_MODE: true
FAL_RENDER_API_KEY: (from secret FAL_RENDER_API_KEY)
```

#### Compose Music Service
```yaml
GEMINI_API_KEY: (from secret GEMINI_API_KEY)
INPUT_BUCKET_NAME: reel-banana-35a54.firebasestorage.app
DEV_MODE: true
ELEVENLABS_MUSIC_API_KEY: (from secret ELEVENLABS_MUSIC_API_KEY)
```

#### API Key Service
```yaml
DEV_MODE: true
NODE_ENV: production
KMS_KEY_RING_ID: projects/reel-banana-35a54/locations/global/keyRings/api-keys
```

#### Polish Service (Video Enhancement)
```yaml
API_KEY_SERVICE_URL: (from secret API_KEY_SERVICE_URL)
FAL_MODEL_UPSCALE: (from secret FAL_MODEL_UPSCALE)
FAL_MODEL_INTERP: (from secret FAL_MODEL_INTERP)
FAL_UPSCALE_ENDPOINT: (from secret FAL_UPSCALE_ENDPOINT)
FAL_INTERP_ENDPOINT: (from secret FAL_INTERP_ENDPOINT)
OUTPUT_BUCKET_NAME: reel-banana-35a54.firebasestorage.app
DEV_MODE: true
FAL_POLISH_API_KEY: (from secret FAL_POLISH_API_KEY)
```

#### Stripe Service
```yaml
NODE_ENV: production
GOOGLE_CLOUD_PROJECT: reel-banana-35a54
STRIPE_WEBHOOK_SECRET: (from secret STRIPE_WEBHOOK_SECRET)
```

## Required GitHub Secrets

### Core Infrastructure
- `GCP_SA_KEY`: Google Cloud Service Account JSON key
- `GCP_PROJECT_ID`: reel-banana-35a54
- `GCP_REGION`: us-central1

### Storage Configuration
- `INPUT_BUCKET_NAME`: reel-banana-35a54.firebasestorage.app
- `OUTPUT_BUCKET_NAME`: reel-banana-videos-public

### API Keys and Services
- `ELEVENLABS_API_KEY_VOICE_NEW`: ElevenLabs API key for voice generation
- `ELEVENLABS_MUSIC_API_KEY`: ElevenLabs API key for music generation
- `FAL_RENDER_API_KEY`: FAL API key for video rendering
- `FAL_POLISH_API_KEY`: FAL API key for video polishing
- `GEMINI_API_KEY`: Google Gemini API key for AI features

### Service Configuration
- `FAL_RENDER_MODEL`: fal-ai/veo3/fast/image-to-video
- `RENDER_ENGINE`: fal
- `API_KEY_SERVICE_URL`: URL of the API key service
- `FAL_MODEL_UPSCALE`: FAL model for video upscaling
- `FAL_MODEL_INTERP`: FAL model for video interpolation
- `FAL_UPSCALE_ENDPOINT`: FAL upscaling endpoint
- `FAL_INTERP_ENDPOINT`: FAL interpolation endpoint
- `KMS_KEY_RING_ID`: projects/reel-banana-35a54/locations/global/keyRings/api-keys
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook secret

### KMS Setup (Required for API Key Service)
The API Key Service requires Google Cloud KMS for encrypting/decrypting user API keys:

```bash
# Create KMS key ring (if not exists)
gcloud kms keyrings create api-keys --location=global

# Create crypto key for user API keys
gcloud kms keys create user-api-keys \
  --keyring=api-keys \
  --location=global \
  --purpose=encryption

# Grant service account access to KMS
gcloud kms keys add-iam-policy-binding user-api-keys \
  --keyring=api-keys \
  --location=global \
  --member="serviceAccount:423229273041-compute@developer.gserviceaccount.com" \
  --role="roles/cloudkms.cryptoKeyEncrypterDecrypter"
```

## Comprehensive Health Checks

### Service-Specific Dependency Validation

#### Narrate Service
- ✅ ElevenLabs API key configuration
- ✅ Firebase connection
- ✅ Storage bucket access

#### Render Service
- ✅ FAL API key configuration
- ✅ FAL render model configuration
- ✅ Firebase connection
- ✅ Input/output bucket access

#### Compose Music Service
- ✅ ElevenLabs Music API key configuration
- ✅ AI configuration (Gemini)
- ✅ Firebase connection
- ✅ Storage bucket access

#### Polish Service
- ✅ API Key Service integration
- ✅ Default FAL API key configuration
- ✅ Firebase connection
- ✅ Storage bucket access

#### API Key Service
- ✅ KMS Key Ring configuration
- ✅ Firebase connection

#### Stripe Service
- ✅ Stripe API keys configuration
- ✅ Firebase connection

### Universal Checks
- ✅ Firebase connection (all services)
- ✅ Storage bucket configuration (all services)
- ✅ Service health endpoints
- ✅ Authentication and authorization

## Enhanced Monitoring Script

The `monitor-services.sh` script now includes comprehensive dependency checking:

### Available Actions

```bash
# Check basic health of all services
./scripts/monitor-services.sh check

# Get detailed status report
./scripts/monitor-services.sh status

# Comprehensive dependency validation
./scripts/monitor-services.sh dependencies

# Rollback a specific service
./scripts/monitor-services.sh rollback [service-name]
```

### Dependency Check Features

1. **Service-Specific Validation**: Checks API keys, models, and configurations for each service
2. **Firebase Connectivity**: Validates Firebase connection for all services
3. **Storage Access**: Verifies bucket configurations and access
4. **Configuration Validation**: Ensures all required environment variables are properly set
5. **Health Status**: Provides detailed health information for troubleshooting

## Deployment Process

### Automatic Deployment
1. **Change Detection**: Workflow detects which services have changed
2. **Testing**: Runs tests and security audits for changed services
3. **Deployment**: Deploys services with proper environment variables
4. **Health Checks**: Validates service health and dependencies
5. **Configuration Update**: Updates API configuration with new URLs

### Manual Deployment
```bash
# Deploy all services
gh workflow run deploy-all-services.yml

# Deploy specific service
gh workflow run deploy-all-services.yml -f service=stripe-service
```

## Rollback Procedures

### Automatic Rollback
The workflow automatically detects failed deployments and can rollback to the previous revision.

### Manual Rollback
```bash
# Rollback specific service
./scripts/monitor-services.sh rollback stripe-service

# Check rollback status
./scripts/monitor-services.sh status
```

## Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check service logs
gcloud logs read --service=reel-banana-stripe-service --region=us-central1 --limit=50

# Check service configuration
gcloud run services describe reel-banana-stripe-service --region=us-central1
```

#### Dependency Issues
```bash
# Run comprehensive dependency check
./scripts/monitor-services.sh dependencies

# Check specific service dependencies
curl -s https://reel-banana-stripe-service-423229273041.us-central1.run.app/health/detailed | jq
```

#### Environment Variable Issues
```bash
# Check service environment variables
gcloud run services describe reel-banana-stripe-service --region=us-central1 --format="value(spec.template.spec.template.spec.containers[0].env[].name,spec.template.spec.template.spec.containers[0].env[].value)"
```

## Migration from Old Workflows

### Removed Files
- `cloud-run-deploy.yml` - Consolidated into `deploy-all-services.yml`

### Benefits of Consolidation
1. **Single Source of Truth**: One workflow for all services
2. **Consistent Environment Variables**: All services use the same configuration approach
3. **Comprehensive Health Checks**: Detailed dependency validation
4. **Better Error Handling**: Improved error detection and rollback capabilities
5. **Easier Maintenance**: Single workflow to maintain and update

## Best Practices

### Development
1. **Test Locally**: Always test changes locally before pushing
2. **Environment Variables**: Ensure all required secrets are configured in GitHub
3. **Health Checks**: Use the monitoring script to validate deployments
4. **Documentation**: Update this documentation when adding new services

### Deployment
1. **Staging First**: Test in staging environment before production
2. **Dependency Validation**: Always run dependency checks after deployment
3. **Monitoring**: Watch service health for 15-30 minutes after deployment
4. **Rollback Ready**: Be prepared to rollback if issues arise

### Monitoring
1. **Regular Checks**: Run health checks every 5 minutes
2. **Dependency Validation**: Use the dependencies action for comprehensive checks
3. **Alert Thresholds**: Set up alerts for error rates > 5%
4. **Performance**: Monitor response times and resource usage

## Future Enhancements

- [ ] **Blue-Green Deployments**: Zero-downtime deployments
- [ ] **Canary Releases**: Gradual rollout of new features
- [ ] **Automated Testing**: Integration and E2E tests in CI/CD
- [ ] **Performance Testing**: Load testing in CI/CD pipeline
- [ ] **Security Scanning**: Automated vulnerability scanning
- [ ] **Cost Optimization**: Resource usage optimization and alerts

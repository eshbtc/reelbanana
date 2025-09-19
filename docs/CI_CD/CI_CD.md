# CI/CD Pipeline Documentation

## Overview

ReelBanana uses GitHub Actions for continuous integration and deployment of all backend services to Google Cloud Run. The pipeline includes automated testing, building, deployment, and monitoring.

## Services

The following services are managed by the CI/CD pipeline:

| Service | Port | Memory | CPU | Description |
|---------|------|--------|-----|-------------|
| upload-assets | 8083 | 1Gi | 1 | Image upload to Google Cloud Storage |
| narrate | 8080 | 512Mi | 1 | ElevenLabs text-to-speech generation |
| align-captions | 8081 | 512Mi | 1 | Google Speech-to-Text for SRT captions |
| render | 8082 | 2Gi | 2 | FFmpeg video assembly and effects |
| compose-music | 8084 | 512Mi | 1 | AI music generation using Firebase Genkit |
| api-key-service | 8085 | 256Mi | 1 | Encrypted API key management |
| polish | 8086 | 1Gi | 1 | Video upscaling and motion interpolation |
| stripe-service | 8087 | 512Mi | 1 | Stripe subscription management |

## Workflows

### 1. Individual Service Deployment

**File**: `.github/workflows/deploy-stripe-service.yml`

Triggers:
- Push to `main` branch with changes to `backend/stripe-service/`
- Manual workflow dispatch

Features:
- Automated testing
- Security auditing
- Health checks
- Rollback capabilities

### 2. All Services Deployment

**File**: `.github/workflows/deploy-all-services.yml`

Triggers:
- Push to `main` branch with changes to `backend/`
- Manual workflow dispatch with service selection

Features:
- Change detection (only deploys changed services)
- Parallel testing and deployment
- Comprehensive health checks
- Deployment summary with service URLs

## Local Development

### Prerequisites

1. **Google Cloud SDK**: Install and authenticate
   ```bash
   gcloud auth login
   gcloud config set project reel-banana-35a54
   ```

2. **Node.js 18+**: Required for all services

3. **Docker**: For local container testing

### Deployment Scripts

#### Deploy Individual Service
```bash
# Deploy Stripe service to production
./scripts/deploy-stripe.sh prod

# Deploy to development environment
./scripts/deploy-stripe.sh dev
```

#### Monitor All Services
```bash
# Check health of all services
./scripts/monitor-services.sh check

# Get detailed status report
./scripts/monitor-services.sh status

# Rollback a specific service
./scripts/monitor-services.sh rollback stripe-service
```

### Local Testing

```bash
# Test individual service
cd backend/stripe-service
npm test
npm run health

# Test all services
./scripts/monitor-services.sh check
```

## Environment Configuration

### Production
- **Project**: `reel-banana-35a54`
- **Region**: `us-central1`
- **Environment**: `NODE_ENV=production`
- **Secrets**: Stored in Google Cloud Secrets Manager

### Development
- **Environment**: `NODE_ENV=development`
- **Local Services**: `localhost:8080-8087`
- **Testing**: Mock data and test endpoints

## Security

### Authentication
- **Firebase App Check**: All services require valid App Check tokens
- **Google Cloud IAM**: Service accounts with minimal required permissions
- **API Keys**: Stored encrypted in Google Cloud Secrets Manager

### Secrets Management
```bash
# Store Stripe keys
gcloud secrets create stripe-live-publishable-key --data-file=-
gcloud secrets create stripe-live-secret-key --data-file=-
gcloud secrets create stripe-test-publishable-key --data-file=-
gcloud secrets create stripe-test-secret-key --data-file=-
```

## Monitoring and Observability

### Health Checks
Each service exposes health endpoints:
- `/health` - Basic health check
- `/health/detailed` - Detailed system information

### Logging
```bash
# View service logs
gcloud logs read --service=reel-banana-stripe-service --region=us-central1

# Stream logs in real-time
gcloud logs tail --service=reel-banana-stripe-service --region=us-central1
```

### Metrics
- **Response Time**: Tracked per service
- **Error Rate**: Monitored and alerted
- **Resource Usage**: CPU, memory, and request counts
- **Custom Metrics**: Business-specific KPIs

## Rollback Procedures

### Automatic Rollback
The CI/CD pipeline automatically detects failed deployments and can rollback to the previous revision.

### Manual Rollback
```bash
# Rollback specific service
./scripts/monitor-services.sh rollback stripe-service

# Check rollback status
./scripts/monitor-services.sh status
```

### Emergency Procedures
1. **Immediate**: Use monitoring script to identify issues
2. **Quick Fix**: Rollback to last known good revision
3. **Investigation**: Check logs and metrics
4. **Resolution**: Deploy fix or contact team

## Best Practices

### Development
1. **Test Locally**: Always test changes locally before pushing
2. **Small Changes**: Make incremental changes for easier debugging
3. **Documentation**: Update docs for any API changes
4. **Security**: Never commit secrets or API keys

### Deployment
1. **Staging First**: Test in staging environment before production
2. **Health Checks**: Always verify health after deployment
3. **Monitoring**: Watch metrics for 15-30 minutes after deployment
4. **Rollback Ready**: Be prepared to rollback if issues arise

### Monitoring
1. **Regular Checks**: Run health checks every 5 minutes
2. **Alert Thresholds**: Set up alerts for error rates > 5%
3. **Performance**: Monitor response times and resource usage
4. **Business Metrics**: Track user-facing metrics

## Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check logs
gcloud logs read --service=reel-banana-stripe-service --region=us-central1 --limit=50

# Check service configuration
gcloud run services describe reel-banana-stripe-service --region=us-central1
```

#### Health Check Failures
```bash
# Test health endpoint directly
curl -f https://reel-banana-stripe-service-223097908182.us-central1.run.app/health

# Check service status
./scripts/monitor-services.sh status
```

#### Authentication Issues
```bash
# Verify App Check configuration
gcloud app check tokens verify

# Check Firebase configuration
gcloud projects describe reel-banana-35a54
```

### Getting Help

1. **Check Logs**: Always start with service logs
2. **Health Checks**: Use monitoring scripts
3. **Documentation**: Refer to service-specific docs
4. **Team**: Contact development team for complex issues

## Future Improvements

- [ ] **Blue-Green Deployments**: Zero-downtime deployments
- [ ] **Canary Releases**: Gradual rollout of new features
- [ ] **Automated Testing**: Integration and E2E tests
- [ ] **Performance Testing**: Load testing in CI/CD
- [ ] **Security Scanning**: Automated vulnerability scanning
- [ ] **Cost Optimization**: Resource usage optimization

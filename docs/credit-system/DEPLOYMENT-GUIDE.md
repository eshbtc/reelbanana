# Credit System Deployment Guide

## Prerequisites

### Required Accounts & Services

- **Firebase Project**: `reel-banana-35a54`
- **Google Cloud Platform**: For Cloud Run services
- **Stripe Account**: For payment processing
- **Domain**: For production deployment

### Required Tools

- **Node.js**: v18+ 
- **npm**: v8+
- **Firebase CLI**: `npm install -g firebase-tools`
- **Google Cloud CLI**: `gcloud`
- **Git**: For version control

### Environment Setup

```bash
# Install dependencies
npm install

# Install Firebase CLI
npm install -g firebase-tools

# Install Google Cloud CLI
# Follow: https://cloud.google.com/sdk/docs/install

# Authenticate with services
firebase login
gcloud auth login
gcloud auth application-default login
```

## Environment Configuration

### Firebase Configuration

1. **Set Firebase Project**
```bash
firebase use reel-banana-35a54
```

2. **Configure Firestore Rules**
```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Usage events are private to users
    match /usage_events/{eventId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
    
    // Credit transactions are private to users
    match /credit_transactions/{transactionId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
  }
}
```

3. **Configure Firestore Indexes**
```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "usage_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "credit_transactions",
      "queryScope": "COLLECTION", 
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### Stripe Configuration

1. **Create Stripe Account**
   - Sign up at https://stripe.com
   - Complete account verification
   - Enable live mode for production

2. **Get API Keys**
```bash
# Test keys (for development)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Live keys (for production)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
```

3. **Configure Webhooks**
   - Webhook URL: `https://your-stripe-service.com/webhook`
   - Events to listen for:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `customer.subscription.created`
     - `customer.subscription.deleted`

### Google Cloud Configuration

1. **Set Project**
```bash
gcloud config set project reel-banana-35a54
```

2. **Enable APIs**
```bash
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

3. **Create Service Account**
```bash
gcloud iam service-accounts create reelbanana-credit-system \
  --display-name="ReelBanana Credit System"

gcloud projects add-iam-policy-binding reel-banana-35a54 \
  --member="serviceAccount:reelbanana-credit-system@reel-banana-35a54.iam.gserviceaccount.com" \
  --role="roles/firebase.admin"

gcloud iam service-accounts keys create service-account.json \
  --iam-account=reelbanana-credit-system@reel-banana-35a54.iam.gserviceaccount.com
```

## Environment Variables

### Backend Services

Create `.env` files for each service:

#### Stripe Service
```bash
# .env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
FIREBASE_PROJECT_ID=reel-banana-35a54
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
```

#### AI Services (Narrate, Render, etc.)
```bash
# .env
ELEVENLABS_API_KEY=sk_...
FAL_API_KEY=...
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
FIREBASE_PROJECT_ID=reel-banana-35a54
```

### Frontend
```bash
# .env.production
VITE_FIREBASE_PROJECT_ID=reel-banana-35a54
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=reel-banana-35a54.firebaseapp.com
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_TARGET_ENV=production
```

### Google Secret Manager

Store sensitive data in Secret Manager:

```bash
# Store Stripe keys
gcloud secrets create stripe-secret-key --data-file=- <<< "sk_live_..."
gcloud secrets create stripe-publishable-key --data-file=- <<< "pk_live_..."
gcloud secrets create stripe-webhook-secret --data-file=- <<< "whsec_..."

# Store API keys
gcloud secrets create elevenlabs-api-key --data-file=- <<< "sk_..."
gcloud secrets create fal-api-key --data-file=- <<< "..."
```

## Deployment Steps

### 1. Deploy Backend Services

```bash
# Deploy all services with credit system
./scripts/deploy-credit-system.sh
```

**Manual Deployment (if needed):**

```bash
# Deploy individual services
cd backend/narrate
gcloud run deploy reel-banana-narrate \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 900 \
  --set-env-vars="PROJECT_ID=reel-banana-35a54"

# Repeat for other services...
```

### 2. Deploy Firebase Functions

```bash
# Deploy Cloud Functions
firebase deploy --only functions

# Verify deployment
firebase functions:list
```

### 3. Deploy Frontend

```bash
# Build production bundle
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting

# Verify deployment
firebase hosting:sites:list
```

### 4. Configure Domain (Optional)

```bash
# Add custom domain
firebase hosting:sites:create reelbanana-production

# Configure DNS
# Add CNAME record: www -> reelbanana-production.web.app
```

## Post-Deployment Verification

### 1. Health Checks

```bash
# Check all services
curl https://reel-banana-narrate-223097908182.us-central1.run.app/health
curl https://reel-banana-render-223097908182.us-central1.run.app/health
curl https://reel-banana-compose-music-223097908182.us-central1.run.app/health
curl https://reel-banana-polish-223097908182.us-central1.run.app/health
curl https://reel-banana-align-captions-223097908182.us-central1.run.app/health
curl https://reel-banana-upload-assets-223097908182.us-central1.run.app/health
curl https://reel-banana-stripe-service-223097908182.us-central1.run.app/health
```

### 2. Test Credit System

```bash
# Run end-to-end test
node scripts/test-credit-system.js
```

### 3. Test Stripe Integration

```bash
# Test webhook endpoint
curl -X POST https://your-stripe-service.com/webhook \
  -H "Content-Type: application/json" \
  -d '{"type": "payment_intent.succeeded", "data": {"object": {"id": "test"}}}'
```

### 4. Verify Frontend

1. Visit production URL
2. Test user registration
3. Test credit purchase
4. Test AI operations
5. Verify admin dashboard

## Monitoring & Logging

### Google Cloud Logging

```bash
# View service logs
gcloud logging read "resource.type=cloud_run_revision" --limit 50

# View specific service logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=reel-banana-narrate" --limit 20
```

### Firebase Console

1. **Firestore**: Monitor database usage
2. **Functions**: Check function execution
3. **Hosting**: Monitor website performance
4. **Analytics**: Track user behavior

### Stripe Dashboard

1. **Payments**: Monitor successful/failed payments
2. **Webhooks**: Check webhook delivery
3. **Customers**: View customer data
4. **Analytics**: Track revenue metrics

## Scaling Configuration

### Cloud Run Scaling

```bash
# Configure auto-scaling
gcloud run services update reel-banana-narrate \
  --region us-central1 \
  --min-instances 1 \
  --max-instances 100 \
  --cpu-throttling \
  --concurrency 1000
```

### Firestore Scaling

- **Read/Write Limits**: Monitor usage in Firebase Console
- **Indexes**: Optimize queries with proper indexes
- **Caching**: Implement client-side caching for frequently accessed data

### CDN Configuration

```bash
# Configure Firebase Hosting CDN
firebase.json:
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=3600"
          }
        ]
      }
    ]
  }
}
```

## Security Configuration

### App Check

```typescript
// Enable App Check for production
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('your-recaptcha-site-key'),
  isTokenAutoRefreshEnabled: true
});
```

### CORS Configuration

```javascript
// Configure CORS for production domains
app.use(cors({
  origin: [
    'https://reelbanana.ai',
    'https://reel-banana-35a54.web.app',
    'https://your-custom-domain.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Firebase-AppCheck']
}));
```

### Rate Limiting

```javascript
// Configure rate limiting
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

## Backup & Recovery

### Firestore Backup

```bash
# Create backup
gcloud firestore export gs://reel-banana-backups/firestore-backup-$(date +%Y%m%d)

# Restore from backup
gcloud firestore import gs://reel-banana-backups/firestore-backup-20241201
```

### Database Migration

```bash
# Export data
firebase firestore:export ./backup

# Import data
firebase firestore:import ./backup
```

## Troubleshooting

### Common Issues

#### Service Deployment Failed
```bash
# Check build logs
gcloud builds list --limit 10

# View specific build
gcloud builds describe BUILD_ID
```

#### Stripe Webhook Not Working
```bash
# Test webhook locally
stripe listen --forward-to localhost:8087/webhook

# Check webhook logs in Stripe dashboard
```

#### Credit Operations Failing
```bash
# Check Firestore permissions
firebase firestore:rules:get

# Verify service account permissions
gcloud projects get-iam-policy reel-banana-35a54
```

### Debug Commands

```bash
# Check service status
gcloud run services list --region us-central1

# View service logs
gcloud logging read "resource.type=cloud_run_revision" --limit 100

# Test database connection
firebase firestore:get users/test-user

# Check environment variables
gcloud run services describe reel-banana-narrate --region us-central1
```

## Maintenance

### Regular Tasks

1. **Monitor Usage**: Check daily usage patterns
2. **Update Dependencies**: Keep packages up to date
3. **Review Logs**: Check for errors or anomalies
4. **Backup Data**: Regular Firestore backups
5. **Security Updates**: Apply security patches

### Performance Optimization

1. **Database Indexes**: Optimize Firestore queries
2. **Caching**: Implement Redis for frequently accessed data
3. **CDN**: Use Firebase Hosting CDN for static assets
4. **Monitoring**: Set up alerts for performance issues

---

## Support

For deployment issues:

- **Google Cloud Support**: https://cloud.google.com/support
- **Firebase Support**: https://firebase.google.com/support
- **Stripe Support**: https://support.stripe.com
- **Documentation**: This guide and inline code comments

---

*Last updated: December 2024*
*Version: 1.0.0*

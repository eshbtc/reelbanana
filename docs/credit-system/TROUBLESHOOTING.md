# Credit System Troubleshooting Guide

## Quick Diagnostics

### Health Check Commands

```bash
# Check all services
curl -s https://reel-banana-narrate-423229273041.us-central1.run.app/health | jq
curl -s https://reel-banana-render-423229273041.us-central1.run.app/health | jq
curl -s https://reel-banana-stripe-service-423229273041.us-central1.run.app/health | jq

# Check user credits
firebase firestore:get users/USER_ID

# Check recent usage events
firebase firestore:get usage_events --limit 5

# Check credit transactions
firebase firestore:get credit_transactions --limit 5
```

## Common Issues & Solutions

### 1. Credits Not Being Deducted

**Symptoms:**
- Operations complete but credits remain unchanged
- User can perform unlimited operations
- No usage events in Firestore

**Diagnosis:**
```bash
# Check if usage events are being created
firebase firestore:get usage_events --limit 10

# Check service logs for errors
gcloud logging read "resource.type=cloud_run_revision AND textPayload:\"credit\"" --limit 20
```

**Solutions:**

1. **Check Service Integration**
```javascript
// Verify credit middleware is properly imported
const { requireCredits, deductCreditsAfter, completeCreditOperation } = require('./shared/creditService');

// Verify middleware is applied to endpoints
app.post('/operation', 
  requireCredits('operationType'),
  deductCreditsAfter('operationType'),
  async (req, res) => {
    // Operation logic
  }
);
```

2. **Check Credit Completion**
```javascript
// Ensure operation completion is called
if (req.creditDeduction?.idempotencyKey) {
  await completeCreditOperation(req.creditDeduction.idempotencyKey, 'completed');
}
```

3. **Verify Firestore Permissions**
```bash
# Check Firestore rules
firebase firestore:rules:get

# Test write permissions
firebase firestore:set users/test-user { freeCredits: 100 }
```

### 2. Stripe Payment Failures

**Symptoms:**
- Credit purchase fails
- Payment method declined
- Webhook not receiving events

**Diagnosis:**
```bash
# Check Stripe webhook logs
# Go to Stripe Dashboard > Webhooks > View logs

# Test webhook endpoint
curl -X POST https://your-stripe-service.com/webhook \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: test" \
  -d '{"type": "payment_intent.succeeded", "data": {"object": {"id": "test"}}}'
```

**Solutions:**

1. **Verify Stripe Configuration**
```bash
# Check environment variables
gcloud run services describe reel-banana-stripe-service --region us-central1

# Verify API keys
curl -u sk_live_...: https://api.stripe.com/v1/charges
```

2. **Fix Webhook Configuration**
```javascript
// Ensure webhook signature verification
const sig = req.headers['stripe-signature'];
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

try {
  const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
} catch (err) {
  console.error('Webhook signature verification failed:', err.message);
  return res.status(400).send(`Webhook Error: ${err.message}`);
}
```

3. **Test Payment Flow**
```bash
# Use Stripe CLI for testing
stripe listen --forward-to localhost:8087/webhook
stripe trigger payment_intent.succeeded
```

### 3. Insufficient Credits Error

**Symptoms:**
- Users get "Insufficient credits" even with credits available
- Operations blocked incorrectly
- Admin users blocked

**Diagnosis:**
```bash
# Check user's actual credit balance
firebase firestore:get users/USER_ID

# Check pending operations
firebase firestore:get usage_events --where userId==USER_ID --where status==pending
```

**Solutions:**

1. **Check Credit Calculation**
```javascript
// Verify operation cost calculation
const requiredCredits = getOperationCost('imageGeneration', { imageCount: 5 });
console.log('Required credits:', requiredCredits);

// Check user balance
const userDoc = await db.collection('users').doc(userId).get();
const currentCredits = userDoc.data()?.freeCredits || 0;
console.log('Current credits:', currentCredits);
```

2. **Check Admin Status**
```javascript
// Verify admin bypass
const userData = userDoc.data();
const isAdmin = userData.isAdmin || false;

if (isAdmin) {
  // Admin users bypass credit checks
  return { hasCredits: true, isAdmin: true };
}
```

3. **Clear Pending Operations**
```bash
# Mark stuck operations as failed
firebase firestore:update usage_events/OPERATION_ID { status: "failed", error: "Manual cleanup" }
```

### 4. Real-time Updates Not Working

**Symptoms:**
- Credit balance doesn't update after operations
- UI shows stale data
- Purchase doesn't reflect immediately

**Diagnosis:**
```javascript
// Check if refreshCredits is being called
console.log('Refreshing credits after operation');

// Check useUserCredits hook
const { freeCredits, refreshCredits } = useUserCredits();
console.log('Current credits:', freeCredits);
```

**Solutions:**

1. **Ensure Refresh Calls**
```javascript
// Call refreshCredits after operations
const result = await generateStory(topic);
await refreshCredits(); // This should update the UI
```

2. **Check Hook Implementation**
```typescript
// Verify useUserCredits hook
const useUserCredits = () => {
  const [freeCredits, setFreeCredits] = useState(0);
  
  const refreshCredits = useCallback(async () => {
    const balance = await getCreditBalance();
    setFreeCredits(balance.available);
  }, []);
  
  return { freeCredits, refreshCredits };
};
```

3. **Force UI Update**
```javascript
// Force component re-render
window.location.reload(); // Temporary solution
```

### 5. Double Charging Issues

**Symptoms:**
- Credits deducted multiple times for same operation
- Duplicate usage events
- User charged more than expected

**Diagnosis:**
```bash
# Check for duplicate usage events
firebase firestore:get usage_events --where id==OPERATION_ID

# Check idempotency
firebase firestore:get usage_events --where userId==USER_ID --orderBy timestamp
```

**Solutions:**

1. **Verify Idempotency Keys**
```javascript
// Ensure unique idempotency keys
const idempotencyKey = `${userId}-${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Check if operation already exists
const existingOp = await db.collection('usage_events').doc(idempotencyKey).get();
if (existingOp.exists) {
  return { success: true, message: 'Operation already processed' };
}
```

2. **Use Atomic Transactions**
```javascript
// Ensure atomic credit operations
await db.runTransaction(async (transaction) => {
  const userRef = db.collection('users').doc(userId);
  const userDoc = await transaction.get(userRef);
  
  // Check and deduct credits atomically
  const currentCredits = userDoc.data()?.freeCredits || 0;
  if (currentCredits < requiredCredits) {
    throw new Error('Insufficient credits');
  }
  
  transaction.update(userRef, {
    freeCredits: currentCredits - requiredCredits
  });
});
```

### 6. Admin Bypass Not Working

**Symptoms:**
- Admin users still get credit checks
- Admin operations fail
- Admin status not recognized

**Diagnosis:**
```bash
# Check admin status in Firestore
firebase firestore:get users/ADMIN_USER_ID

# Check service logs for admin checks
gcloud logging read "textPayload:\"admin\"" --limit 10
```

**Solutions:**

1. **Verify Admin Status**
```javascript
// Check admin status in credit validation
const userDoc = await db.collection('users').doc(userId).get();
const userData = userDoc.data();
const isAdmin = userData.isAdmin || false;

console.log('User admin status:', isAdmin);
```

2. **Set Admin Status**
```bash
# Set user as admin
firebase firestore:update users/USER_ID { isAdmin: true }

# Or use the admin function
firebase functions:call setAdminStatus --data '{"email":"admin@example.com"}'
```

3. **Check Admin Middleware**
```javascript
// Ensure admin bypass in rate limiter
if (userData.isAdmin) {
  return { allowed: true, remaining: 999999 };
}
```

## Performance Issues

### 1. Slow Credit Operations

**Symptoms:**
- Credit checks take too long
- Operations timeout
- High latency

**Solutions:**

1. **Optimize Firestore Queries**
```javascript
// Use specific field queries
const userDoc = await db.collection('users').doc(userId).get();
// Instead of querying entire collection
```

2. **Implement Caching**
```javascript
// Cache user credit balance
const creditCache = new Map();
const getCachedCredits = (userId) => {
  if (creditCache.has(userId)) {
    return creditCache.get(userId);
  }
  // Fetch from Firestore and cache
};
```

3. **Batch Operations**
```javascript
// Batch multiple credit operations
const batch = db.batch();
batch.update(userRef, { freeCredits: newBalance });
batch.set(usageEventRef, usageEvent);
await batch.commit();
```

### 2. High Firestore Costs

**Symptoms:**
- Unexpected Firestore charges
- Too many read/write operations
- Inefficient queries

**Solutions:**

1. **Optimize Read Operations**
```javascript
// Read only necessary fields
const userDoc = await db.collection('users').doc(userId).get();
const credits = userDoc.data()?.freeCredits || 0;
// Instead of reading entire document
```

2. **Use Composite Indexes**
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
    }
  ]
}
```

3. **Implement Pagination**
```javascript
// Limit query results
const query = db.collection('usage_events')
  .where('userId', '==', userId)
  .orderBy('timestamp', 'desc')
  .limit(50);
```

## Security Issues

### 1. Unauthorized Credit Access

**Symptoms:**
- Users accessing other users' credits
- Admin functions accessible to regular users
- Credit manipulation

**Solutions:**

1. **Verify Firestore Rules**
```javascript
// Ensure proper access control
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}

match /usage_events/{eventId} {
  allow read, write: if request.auth != null && 
    resource.data.userId == request.auth.uid;
}
```

2. **Validate User Authentication**
```javascript
// Check authentication in all operations
const user = getCurrentUser();
if (!user) {
  throw new Error('User not authenticated');
}
```

3. **Audit Credit Operations**
```javascript
// Log all credit operations
console.log(`Credit operation: ${operation} for user ${userId}, credits: ${credits}`);
```

### 2. Stripe Security Issues

**Symptoms:**
- Unauthorized payments
- Webhook tampering
- API key exposure

**Solutions:**

1. **Verify Webhook Signatures**
```javascript
// Always verify webhook signatures
const sig = req.headers['stripe-signature'];
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

try {
  const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
} catch (err) {
  return res.status(400).send(`Webhook Error: ${err.message}`);
}
```

2. **Secure API Keys**
```bash
# Store keys in Secret Manager
gcloud secrets create stripe-secret-key --data-file=- <<< "sk_live_..."

# Use in Cloud Run
gcloud run services update reel-banana-stripe-service \
  --set-secrets="STRIPE_SECRET_KEY=stripe-secret-key:latest"
```

3. **Validate Payment Amounts**
```javascript
// Verify payment amounts match expected values
const expectedAmount = creditPackages[packageId].price;
if (paymentIntent.amount !== expectedAmount) {
  throw new Error('Payment amount mismatch');
}
```

## Monitoring & Alerts

### 1. Set Up Monitoring

```bash
# Create monitoring dashboard
gcloud monitoring dashboards create --config-from-file=monitoring-dashboard.json

# Set up alerts
gcloud alpha monitoring policies create --policy-from-file=alert-policy.yaml
```

### 2. Key Metrics to Monitor

- **Credit Operations**: Success/failure rates
- **Payment Success**: Stripe payment success rate
- **Service Health**: Response times and error rates
- **Database Usage**: Firestore read/write operations
- **User Activity**: Active users and operations

### 3. Alert Conditions

```yaml
# alert-policy.yaml
displayName: "Credit System Errors"
conditions:
  - displayName: "High error rate"
    conditionThreshold:
      filter: 'resource.type="cloud_run_revision"'
      comparison: COMPARISON_GREATER_THAN
      thresholdValue: 0.05
      duration: 300s
```

## Emergency Procedures

### 1. System Outage

```bash
# Check service status
gcloud run services list --region us-central1

# Restart failed services
gcloud run services update reel-banana-narrate --region us-central1

# Check logs for errors
gcloud logging read "severity>=ERROR" --limit 50
```

### 2. Data Corruption

```bash
# Restore from backup
gcloud firestore import gs://reel-banana-backups/firestore-backup-20241201

# Verify data integrity
firebase firestore:get users --limit 10
```

### 3. Security Breach

```bash
# Revoke compromised API keys
# Update in Stripe dashboard and redeploy services

# Check for unauthorized access
gcloud logging read "protoPayload.authenticationInfo.principalEmail!=admin@example.com" --limit 100

# Reset user sessions
firebase auth:export users.json
```

## Getting Help

### 1. Log Collection

```bash
# Collect relevant logs
gcloud logging read "resource.type=cloud_run_revision" --limit 1000 > service-logs.json
firebase firestore:export ./firestore-backup
```

### 2. Support Channels

- **Internal Team**: Slack #credit-system-support
- **Google Cloud**: https://cloud.google.com/support
- **Firebase**: https://firebase.google.com/support
- **Stripe**: https://support.stripe.com

### 3. Documentation

- **API Reference**: `docs/credit-system/API-REFERENCE.md`
- **Deployment Guide**: `docs/credit-system/DEPLOYMENT-GUIDE.md`
- **Main Documentation**: `docs/credit-system/README.md`

---

*Last updated: December 2024*
*Version: 1.0.0*

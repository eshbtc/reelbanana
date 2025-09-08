# Credit System API Reference

## Frontend API

### Credit Service (`services/creditService.ts`)

#### `reserveCredits(operation, params, metadata)`

Reserves credits for an operation with idempotency protection.

**Parameters:**
- `operation: string` - Operation type (e.g., 'storyGeneration', 'imageGeneration')
- `params: any` - Operation parameters for cost calculation
- `metadata: any` - Additional metadata for the operation

**Returns:**
```typescript
{
  success: boolean;
  idempotencyKey: string;
  creditsReserved: number;
  error?: string;
}
```

**Example:**
```typescript
const result = await reserveCredits('imageGeneration', { imageCount: 5 }, { prompt: 'hero scene' });
if (result.success) {
  // Proceed with operation
  const images = await generateImages();
  await completeCreditOperation(result.idempotencyKey, 'completed');
}
```

#### `completeCreditOperation(idempotencyKey, status, error?)`

Marks a credit operation as completed or failed.

**Parameters:**
- `idempotencyKey: string` - Unique operation identifier
- `status: 'completed' | 'failed'` - Operation status
- `error?: string` - Error message if failed

**Returns:**
```typescript
{
  success: boolean;
  error?: string;
}
```

#### `refundCredits(idempotencyKey, reason)`

Refunds credits for a failed operation.

**Parameters:**
- `idempotencyKey: string` - Unique operation identifier
- `reason: string` - Reason for refund

**Returns:**
```typescript
{
  success: boolean;
  error?: string;
}
```

#### `getCreditBalance(userId?)`

Gets user's current credit balance.

**Parameters:**
- `userId?: string` - Optional user ID (defaults to current user)

**Returns:**
```typescript
{
  total: number;
  available: number;
  pending: number;
  lastUpdated: Date;
}
```

#### `purchaseCredits(packageId, paymentMethodId)`

Purchases credits via Stripe.

**Parameters:**
- `packageId: string` - Credit package ID ('starter', 'creator', 'pro', 'studio')
- `paymentMethodId: string` - Stripe payment method ID

**Returns:**
```typescript
{
  success: boolean;
  transactionId?: string;
  creditsAdded?: number;
  error?: string;
}
```

### Usage Tracking Hook (`hooks/useUsageTracking.ts`)

#### `useUsageTracking()`

React hook for managing user credits and usage.

**Returns:**
```typescript
{
  freeCredits: number;
  totalUsage: number;
  isLoading: boolean;
  refreshCredits: () => Promise<void>;
  hasEnoughCredits: (operation: string, params?: any) => boolean;
}
```

**Example:**
```typescript
const { freeCredits, hasEnoughCredits, refreshCredits } = useUsageTracking();

const canGenerate = hasEnoughCredits('imageGeneration', { imageCount: 5 });
if (!canGenerate) {
  // Show insufficient credits message
}
```

## Backend API

### Credit Service (`backend/shared/creditService.js`)

#### `requireCredits(operation, getParams)`

Express middleware that validates user has enough credits.

**Parameters:**
- `operation: string` - Operation type
- `getParams: function` - Function to extract parameters from request

**Usage:**
```javascript
app.post('/operation', 
  requireCredits('imageGeneration', (req) => ({ imageCount: req.body.images?.length || 0 })),
  async (req, res) => {
    // Operation logic
  }
);
```

#### `deductCreditsAfter(operation, getParams)`

Express middleware that reserves credits after validation.

**Parameters:**
- `operation: string` - Operation type
- `getParams: function` - Function to extract parameters from request

**Usage:**
```javascript
app.post('/operation', 
  deductCreditsAfter('imageGeneration', (req) => ({ imageCount: req.body.images?.length || 0 })),
  async (req, res) => {
    // Credits are reserved in req.creditDeduction
    const { idempotencyKey, creditsDeducted } = req.creditDeduction;
  }
);
```

#### `checkUserCredits(userId, operation, params)`

Checks if user has sufficient credits for an operation.

**Parameters:**
- `userId: string` - User ID
- `operation: string` - Operation type
- `params: object` - Operation parameters

**Returns:**
```javascript
{
  hasCredits: boolean;
  isAdmin: boolean;
  credits: number;
  required: number;
  error?: string;
}
```

#### `deductCredits(userId, operation, params, idempotencyKey)`

Deducts credits from user account atomically.

**Parameters:**
- `userId: string` - User ID
- `operation: string` - Operation type
- `params: object` - Operation parameters
- `idempotencyKey: string` - Unique operation identifier

**Returns:**
```javascript
{
  success: boolean;
  idempotencyKey: string;
  creditsDeducted: number;
  error?: string;
}
```

#### `completeCreditOperation(idempotencyKey, status, error)`

Marks a credit operation as completed or failed.

**Parameters:**
- `idempotencyKey: string` - Unique operation identifier
- `status: string` - 'completed' or 'failed'
- `error: string` - Error message if failed

**Returns:**
```javascript
{
  success: boolean;
  error?: string;
}
```

## Stripe Service API

### Endpoints

#### `POST /purchase-credits`

Purchases credits using Stripe payment method.

**Request:**
```json
{
  "packageId": "creator",
  "paymentMethodId": "pm_1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "transactionId": "pi_1234567890",
  "creditsAdded": 500
}
```

#### `GET /subscription-status`

Gets user's subscription status and credit balance.

**Response:**
```json
{
  "hasActiveSubscription": false,
  "subscription": null,
  "creditBalance": {
    "total": 150,
    "available": 150,
    "pending": 0
  }
}
```

#### `POST /webhook`

Stripe webhook endpoint for payment events.

**Events Handled:**
- `payment_intent.succeeded` - Add credits to user
- `payment_intent.payment_failed` - Log failed payment
- `customer.subscription.created` - Activate subscription
- `customer.subscription.deleted` - Deactivate subscription

## Cost Calculator API

### Functions

#### `getOperationCost(operation, params)`

Calculates credit cost for an operation.

**Parameters:**
- `operation: string` - Operation type
- `params: object` - Operation parameters

**Returns:**
```typescript
number // Credit cost
```

**Example:**
```typescript
const cost = getOperationCost('imageGeneration', { imageCount: 5 }); // Returns 15
```

#### `validateCredits(currentCredits, requiredCredits, isAdmin)`

Validates if user has enough credits.

**Parameters:**
- `currentCredits: number` - User's current credit balance
- `requiredCredits: number` - Credits required for operation
- `isAdmin: boolean` - Whether user is admin

**Returns:**
```typescript
{
  valid: boolean;
  reason?: string;
}
```

#### `formatCredits(credits)`

Formats credit amount for display.

**Parameters:**
- `credits: number` - Credit amount

**Returns:**
```typescript
string // Formatted string (e.g., "150 credits")
```

## Error Handling

### Error Types

#### `InsufficientCreditsError`
```typescript
{
  type: 'INSUFFICIENT_CREDITS';
  message: string;
  required: number;
  available: number;
}
```

#### `OperationFailedError`
```typescript
{
  type: 'OPERATION_FAILED';
  message: string;
  idempotencyKey: string;
  refunded: boolean;
}
```

#### `PaymentFailedError`
```typescript
{
  type: 'PAYMENT_FAILED';
  message: string;
  paymentIntentId: string;
  retryable: boolean;
}
```

### Error Handling Example

```typescript
try {
  const result = await reserveCredits('imageGeneration', { imageCount: 5 });
  if (!result.success) {
    if (result.error?.includes('Insufficient credits')) {
      // Show purchase modal
      setShowCreditPurchase(true);
    } else {
      // Show generic error
      toast.error(result.error);
    }
    return;
  }
  
  // Proceed with operation
  const images = await generateImages();
  await completeCreditOperation(result.idempotencyKey, 'completed');
  
} catch (error) {
  // Handle unexpected errors
  console.error('Unexpected error:', error);
  toast.error('An unexpected error occurred');
}
```

## Rate Limiting

### Limits

- **Credit Operations**: 100 per minute per user
- **Credit Purchases**: 10 per hour per user
- **Admin Operations**: Unlimited

### Headers

All credit operations include rate limiting headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Webhooks

### Stripe Webhooks

#### Payment Succeeded
```json
{
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_1234567890",
      "metadata": {
        "firebase_uid": "user123",
        "package_id": "creator",
        "credits": "500"
      }
    }
  }
}
```

#### Payment Failed
```json
{
  "type": "payment_intent.payment_failed",
  "data": {
    "object": {
      "id": "pi_1234567890",
      "last_payment_error": {
        "message": "Your card was declined."
      }
    }
  }
}
```

## Testing

### Test Utilities

#### `createTestUser(credits)`
Creates a test user with specified credits.

#### `simulateOperation(operation, params)`
Simulates a credit operation for testing.

#### `verifyCredits(userId, expectedCredits)`
Verifies user's credit balance.

### Example Test

```typescript
describe('Credit System', () => {
  it('should deduct credits for image generation', async () => {
    const user = await createTestUser(100);
    const result = await simulateOperation('imageGeneration', { imageCount: 5 });
    
    expect(result.success).toBe(true);
    expect(result.creditsDeducted).toBe(15);
    
    const balance = await verifyCredits(user.id, 85);
    expect(balance.available).toBe(85);
  });
});
```

# Enable LTX Video Configuration

## Quick Setup (Environment Variables)

Add to your `.env` file:

```bash
# Use LTX Video as default for cost savings
FAL_RENDER_MODEL=fal-ai/ltx-video-13b-distilled/image-to-video

# Keep Veo3 as premium option
FAL_PREMIUM_MODEL=fal-ai/veo3/fast/image-to-video
```

## Backend Update (render/index.js)

Replace line 313:
```javascript
// OLD:
'fal-ai/ltxv-13b-098-distilled/image-to-video'

// NEW:
'fal-ai/ltx-video-13b-distilled/image-to-video'
```

## Frontend Update (voiceAndModelOptions.ts)

Update line 125-128 to properly categorize LTX:
```javascript
// OLD:
} else if (model.id.includes('runway') || model.id.includes('ltxv')) {
    speed = 'premium';
    quality = 'high';
    cost = 'high';

// NEW:
} else if (model.id.includes('ltx') || model.id.includes('ltxv')) {
    speed = 'fast';
    quality = 'standard';
    cost = 'low';  // 96% cheaper than Veo3!
} else if (model.id.includes('runway')) {
    speed = 'premium';
    quality = 'high';
    cost = 'high';
```

## Add Model Selection Logic

In render/index.js, before line 288, add:

```javascript
// Smart model selection based on user tier
const selectModel = (requestBody, userPlan) => {
    // Allow override from request
    if (requestBody.modelOverride) {
        return requestBody.modelOverride;
    }

    // Premium users get Veo3
    if (userPlan === 'pro' || userPlan === 'premium') {
        return process.env.FAL_PREMIUM_MODEL || 'fal-ai/veo3/fast/image-to-video';
    }

    // Everyone else gets LTX (96% cheaper!)
    return process.env.FAL_RENDER_MODEL || 'fal-ai/ltx-video-13b-distilled/image-to-video';
};
```

## Test It

1. Set environment variable:
   ```bash
   export FAL_RENDER_MODEL=fal-ai/ltx-video-13b-distilled/image-to-video
   ```

2. Run a test generation and check logs for model used

3. Compare costs:
   - Veo3: $1.20 for 8 seconds
   - LTX: $0.04 for 8 seconds
   - **Savings: 96.7%**

## Monitoring

Add logging to track savings:
```javascript
console.log(`Using model: ${modelId}`);
console.log(`Estimated cost: ${modelId.includes('ltx') ? '$0.04' : '$1.20'}`);
```
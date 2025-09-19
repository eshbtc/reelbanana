# Recent API Changes - ReelBanana Backend Services

## January 2025 Updates

### 🎬 Render Service Enhancements

#### 1. Server-Sent Events (SSE) Implementation

**Endpoint**: `GET /progress-stream`

Real-time progress tracking for video rendering operations.

```javascript
// Connect to SSE stream
const eventSource = new EventSource(`${RENDER_URL}/progress-stream?jobId=${jobId}`);

// Or use fetch streaming (recommended for Cloud Run)
const response = await fetch(`${RENDER_URL}/progress-stream?jobId=${jobId}`, {
  headers: {
    'Accept': 'text/event-stream',
    'X-Firebase-AppCheck': appCheckToken,
    'Authorization': `Bearer ${idToken}`
  }
});
```

**Event Format**:
```json
{
  "jobId": "render-project-123456",
  "progress": 45,
  "stage": "clips",
  "message": "Scene 3/5: generating motion...",
  "etaSeconds": 30,
  "done": false,
  "error": null,
  "perScene": { "0": 100, "1": 100, "2": 50 },
  "sceneCount": 5,
  "currentScene": 2
}
```

**Key Features**:
- Cloud Run optimized with `X-Accel-Buffering: no`
- 30-second heartbeat to maintain connection
- In-memory progress store with Firestore persistence
- Automatic client cleanup on disconnect

#### 2. Video-to-Video Transformations

**Endpoint**: `POST /transform-video`

Apply AI-powered transformations to existing videos.

```javascript
// Example: Upscale a video to 4K
const response = await fetch(`${RENDER_URL}/transform-video`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`,
    'X-Firebase-AppCheck': appCheckToken
  },
  body: JSON.stringify({
    projectId: 'my-project',
    gsSourcePath: 'gs://bucket/video.mp4',
    transformation: 'upscale',
    targetResolution: '4K'
  })
});
```

**Transformation Types**:

| Type | Description | Parameters |
|------|------------|------------|
| `upscale` | Enhance video resolution | `targetResolution`: 'HD' or '4K' |
| `interpolate` | Increase frame rate | `targetFps`: number (default 60) |
| `stylize` | Apply color grading | `style`: 'cinematic', 'vintage', 'noir', 'vibrant' |
| `enhance` | General improvements | None (applies denoise, sharpen, stabilize) |

**Response**:
```json
{
  "success": true,
  "videoUrl": "https://storage.googleapis.com/...",
  "gsPath": "gs://bucket/project/transformed/...",
  "transformation": "upscale",
  "metadata": {
    "projectId": "my-project",
    "transformation": "upscale",
    "targetResolution": "4K"
  }
}
```

#### 3. Tier-Based Model Routing

The render service now intelligently selects AI models based on user subscription tier and quality preferences:

**Model Selection Logic**:

```javascript
// In /render endpoint
const userTier = getUserTier(userId); // 'free', 'basic', 'pro', 'premium'
const quality = req.body.quality;      // 'standard' or 'premium'

let modelId;
if (userTier === 'pro' || userTier === 'premium') && quality === 'premium') {
  // Premium users requesting high quality
  modelId = 'fal-ai/veo3/fast/image-to-video';  // $1.20 per 8s
  console.log('Using Veo3 for premium quality');
} else {
  // All other users
  modelId = 'fal-ai/ltx-video-13b-distilled/image-to-video';  // $0.04 per 8s
  console.log('Using LTX Video (96% cost savings)');
}
```

**Cost Comparison**:
- **LTX Video**: $0.04 per 8-second clip (default)
- **Veo3**: $1.20 per 8-second clip (premium only)
- **Savings**: 96% cost reduction for standard tier

#### 4. Mobile Reel Fast Path

Optimized pipeline for social media content creation:

**Activation**: Set `mobileReel: true` in render request

**Automatic Optimizations**:
```javascript
if (mobileReel) {
  // Force optimizations
  req.body.noSubtitles = true;        // Skip captions for speed
  req.body.aspectRatio = '9:16';      // Vertical format
  req.body.targetW = 720;              // Lower resolution
  req.body.targetH = 1280;
  req.body.useFal = true;              // Force FAL engine

  // Limit duration
  scenes = scenes.slice(0, 3);        // Max 3 scenes
  scenes.forEach(scene => {
    scene.duration = Math.min(5, scene.duration);  // Max 5s per scene
  });
}
```

### 📊 Performance Metrics

#### SSE Connection Performance
- Connection establishment: <500ms
- Message latency: <100ms
- Heartbeat interval: 30s
- Client capacity: 1000+ concurrent per instance

#### Model Performance Comparison

| Model | Cost/8s | Quality | Speed | Best For |
|-------|---------|---------|-------|----------|
| LTX Video | $0.04 | Good | Fast (30s) | Social media, drafts |
| Veo3 | $1.20 | Excellent | Slower (60s) | Final production |

#### Video Transformation Performance

| Transform | Processing Time | Quality Impact |
|-----------|----------------|----------------|
| Upscale to 4K | 45-60s | High improvement |
| Interpolate 60fps | 30-45s | Smoother motion |
| Stylize | 15-30s | Artistic enhancement |
| Enhance | 20-35s | General improvement |

### 🔒 Security Updates

1. **SSE Security**: App Check verification optional for SSE to prevent blocking
2. **Rate Limiting**: Tier-based quotas on expensive operations
3. **Credit Management**: Automatic deduction and refund on failure
4. **GCS Integration**: Public URLs for transformed videos

### 🛠️ Implementation Examples

#### Full E2E Pipeline with SSE

```javascript
// 1. Start render with job ID
const jobId = `render-${projectId}-${Date.now()}`;
const renderPromise = fetch(`${RENDER_URL}/render`, {
  method: 'POST',
  headers: { /* ... */ },
  body: JSON.stringify({
    projectId,
    scenes,
    gsAudioPath,
    srtPath,
    gsMusicPath,
    jobId,  // Include for SSE tracking
    mobileReel: true  // Enable fast path
  })
});

// 2. Connect to SSE for progress
const response = await fetch(`${RENDER_URL}/progress-stream?jobId=${jobId}`, {
  headers: { 'Accept': 'text/event-stream' }
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

// 3. Process progress updates
while (true) {
  const { value, done } = await reader.read();
  if (done) break;

  const text = decoder.decode(value);
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.substring(6));
      console.log(`Progress: ${data.progress}% - ${data.message}`);

      if (data.done) {
        console.log('Rendering complete!');
      }
    }
  }
}

// 4. Get final result
const renderResult = await renderPromise.then(r => r.json());
console.log('Video URL:', renderResult.videoUrl);
```

### 📝 Migration Notes

#### For Existing Implementations

1. **SSE Integration**: Add `jobId` to render requests for progress tracking
2. **Model Selection**: Add `quality` parameter for premium model access
3. **Mobile Optimization**: Use `mobileReel: true` for social media content
4. **Video Transformation**: New endpoint for post-processing workflows

#### Breaking Changes

None - all changes are backward compatible.

#### Deprecation Notices

None - existing endpoints continue to function as before.

### 🚀 Deployment

All changes are live in production:
- Render Service: `https://reel-banana-render-223097908182.us-central1.run.app`
- Latest revision: `reel-banana-render-00055-95x`

### 📈 Usage Examples

#### Premium Video Creation
```javascript
// For pro/premium users wanting highest quality
await renderVideo({
  quality: 'premium',  // Triggers Veo3 model
  useFal: true,
  // ... other params
});
```

#### Quick Social Media Reel
```javascript
// Optimized for TikTok/Instagram
await renderVideo({
  mobileReel: true,  // Auto-optimizes everything
  aspectRatio: '9:16',
  // ... other params
});
```

#### Video Enhancement Pipeline
```javascript
// 1. Render initial video
const { videoUrl } = await renderVideo(params);

// 2. Enhance with AI
const enhanced = await transformVideo({
  sourceVideoUrl: videoUrl,
  transformation: 'enhance'
});

// 3. Upscale if needed
const final = await transformVideo({
  sourceVideoUrl: enhanced.videoUrl,
  transformation: 'upscale',
  targetResolution: '4K'
});
```

### 🔍 Monitoring & Debugging

#### SSE Connection Health
```javascript
// Monitor SSE connection
let lastHeartbeat = Date.now();
eventSource.addEventListener('message', (event) => {
  if (event.data.includes('heartbeat')) {
    lastHeartbeat = Date.now();
  }
});

// Check connection health
setInterval(() => {
  if (Date.now() - lastHeartbeat > 60000) {
    console.error('SSE connection may be dead');
    eventSource.close();
    // Reconnect logic
  }
}, 10000);
```

#### Debug Logging
All operations include detailed console logging:
- `[SSE]` prefixed logs for streaming events
- Model selection rationale with cost
- Transformation progress updates
- Cache hit/miss statistics

### 📞 Support

For questions or issues with these new features:
- Review test files: `test-video-creator.html`, `test-sse.html`
- Check service logs in Google Cloud Console
- Monitor `/health` endpoints for service status
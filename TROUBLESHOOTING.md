# ReelBanana Troubleshooting Guide

## Common Production Issues

### E2E Pipeline Failures

#### "No images found for scene X" in render service
**Symptoms**: Render service fails with asset discovery errors
**Root Cause**: ~~Bucket name mismatch - render uses `.firebasestorage.app`, others use `.appspot.com`~~ ✅ FIXED
**Fix**: ✅ Updated `backend/render/index.js` bucket configuration to use `.appspot.com`

#### Share links stop working after 1 hour
**Symptoms**: Published movies show "Video not found" errors
**Root Cause**: ~~1-hour signed URLs stored in Firestore expire~~ ✅ FIXED
**Fix**: ✅ Implemented durable URLs via `file.makePublic()` for published videos, 7-day signed URLs for drafts

#### Share button does nothing
**Symptoms**: "Share Movie" button appears but doesn't create share URLs
**Root Cause**: ~~Conditional logic disables share when `projectId` exists~~ ✅ FIXED
**Fix**: ✅ Fixed to route all sharing through publish flow to create `/share/:id` URLs

### Service-Specific Issues

#### Polish service authorization errors
**Symptoms**: 401 errors when using polish with custom API keys
**Root Cause**: ~~Double "Bearer" prefix in Authorization header forwarding~~ ✅ FIXED
**Fix**: ✅ Cleaned header forwarding in `backend/polish/index.js`

#### Missing "Using cached..." UI indicators
**Symptoms**: UI doesn't show cache status for narration/captions
**Root Cause**: ~~Services don't return `{ cached: true }` flag~~ ✅ FIXED
**Fix**: ✅ Added cache flag to early-return responses in narrate/align services

#### Music generation produces silent/broken audio
**Symptoms**: Videos have no background music or audio errors
**Root Cause**: ~~WAV buffer saved as `.mp3` with `audio/mpeg` content-type~~ ✅ FIXED
**Fix**: ✅ Save as `music.wav` with `audio/wav` content-type

### Configuration Issues

#### Services routing to wrong backends
**Symptoms**: API calls fail in production with 404/503 errors
**Root Cause**: Environment mismatch between 223097 vs 423229 project numbers
**Fix**: Set `VITE_TARGET_ENV=ai-studio` or standardize endpoint configuration

#### FFmpeg rendering failures
**Symptoms**: Video rendering fails with complex filter errors
**Root Cause**: Mixed Node versions, inconsistent FFmpeg installations
**Fix**: Standardize on Node 20, pin Docker base images

## Debugging Commands

### Check service health
```bash
# Local development
curl http://localhost:8080/health
curl http://localhost:8081/health
# ... for all services

# Production
curl https://[service-url]/health
```

### Verify bucket contents
```bash
# List project assets
gsutil ls gs://reel-banana-35a54.appspot.com/[project-id]/

# Check specific files
gsutil ls gs://reel-banana-35a54.appspot.com/[project-id]/scene-*
gsutil ls gs://reel-banana-35a54.appspot.com/[project-id]/narration.mp3
gsutil ls gs://reel-banana-35a54.appspot.com/[project-id]/captions.srt
```

### Test E2E pipeline manually
```bash
# 1. Upload test image
curl -X POST [upload-service]/upload-image \
  -H "X-Firebase-AppCheck: [token]" \
  -d '{"projectId": "test", "fileName": "test.jpg", "base64Image": "[data-uri]"}'

# 2. Generate narration
curl -X POST [narrate-service]/narrate \
  -H "X-Firebase-AppCheck: [token]" \
  -d '{"projectId": "test", "narrationScript": "Test narration"}'

# 3. Align captions
curl -X POST [align-service]/align \
  -H "X-Firebase-AppCheck: [token]" \
  -d '{"projectId": "test", "gsAudioPath": "gs://bucket/test/narration.mp3"}'

# 4. Compose music
curl -X POST [compose-service]/compose-music \
  -H "X-Firebase-AppCheck: [token]" \
  -d '{"projectId": "test", "narrationScript": "Test narration"}'

# 5. Render video
curl -X POST [render-service]/render \
  -H "X-Firebase-AppCheck: [token]" \
  -d '{"projectId": "test", "scenes": [...], "gsAudioPath": "...", "srtPath": "..."}'
```

### Validate share URLs
```bash
# Test share page loads
curl -I https://your-domain.com/share/[share-id]

# Check OG tags
curl -s https://your-domain.com/share/[share-id] | grep -E '(og:|twitter:)'
```

## Performance Monitoring

### Key Metrics to Track
- E2E pipeline success rate (target: >95%)
- Render success rate (target: >95%)  
- 95p render time (target: <5 minutes)
- Share link durability (target: 100% after 24h)
- Service 95p response times (target: <2s)

### Alerting Thresholds
- E2E success rate drops below 90%
- Any service 95p response time >5s
- Share link failures >1% 
- Cost per video >$2 (indicates API abuse)

## Emergency Procedures

### Service Outage Response
1. Check service health endpoints
2. Review Cloud Run logs for errors
3. Verify GCS bucket accessibility
4. Check Firebase Auth/App Check status
5. Rollback to last known good deployment

### Data Recovery
1. Locate project files in GCS bucket
2. Verify video file existence and accessibility
3. Regenerate signed URLs if expired
4. Re-run failed pipeline steps with same inputs

### Rate Limit Breaches
1. Identify abusive users/IPs in logs
2. Implement temporary IP blocks
3. Adjust rate limits in affected services
4. Monitor cost dashboards for budget overruns

## Development Best Practices

### Before Deploying
- [ ] Test E2E pipeline with real data
- [ ] Verify all services return 200 on `/health`
- [ ] Check bucket configuration consistency
- [ ] Validate environment variable settings
- [ ] Test share link generation and persistence

### Code Review Checklist
- [ ] Error handling with user-facing messages
- [ ] Retry logic with exponential backoff
- [ ] Input validation before expensive API calls
- [ ] Proper authorization header handling
- [ ] Cache flags for UI feedback
- [ ] Idempotency for expensive operations

*Last Updated: [Current Date]*
*See REMEDIATION_PLAN.md for systematic fixes to these issues*
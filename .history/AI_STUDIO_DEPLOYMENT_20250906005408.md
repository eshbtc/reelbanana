# AI Studio Deployment Guide for ReelBanana

This guide explains how to deploy your ReelBanana frontend on Google AI Studio and connect it to your backend services.

## 🏗️ Architecture Overview

```
AI Studio Frontend (Hosted) 
    ↓ HTTP/HTTPS API calls
Google Cloud Run Backend Services
    ↓ Data storage
Firebase/Firestore Database
```

## 📋 Prerequisites

1. ✅ Backend services deployed on Google Cloud Run
2. ✅ Firebase project configured with Firestore
3. ✅ CORS enabled on all backend services
4. ✅ Environment variables set for backend services

## 🚀 Deployment Steps

### 1. Prepare Your Frontend for AI Studio

Your frontend is already configured to work with AI Studio through the centralized API configuration:

```typescript
// config/apiConfig.ts
const AI_STUDIO_CONFIG: ApiConfig = {
  baseUrls: {
    upload: 'https://reel-banana-upload-assets-423229273041.us-central1.run.app',
    narrate: 'https://reel-banana-narrate-423229273041.us-central1.run.app',
    align: 'https://reel-banana-align-captions-423229273041.us-central1.run.app',
    render: 'https://reel-banana-render-423229273041.us-central1.run.app',
  },
  firebase: {
    // Your Firebase configuration
  },
};
```

### 2. Set Environment for AI Studio

When deploying to AI Studio, set the environment variable:

```bash
NODE_ENV=ai-studio
```

This will automatically use the AI Studio configuration with production backend URLs.

### 3. Deploy to AI Studio

1. **Upload your project** to AI Studio
2. **Set environment variables** in AI Studio:
   - `NODE_ENV=ai-studio`
3. **Build and deploy** your frontend

### 4. Verify Backend Connectivity

Your backend services should be accessible from AI Studio:

- ✅ **Upload Service**: `https://reel-banana-upload-assets-423229273041.us-central1.run.app`
- ✅ **Narrate Service**: `https://reel-banana-narrate-423229273041.us-central1.run.app`
- ✅ **Align Service**: `https://reel-banana-align-captions-423229273041.us-central1.run.app`
- ✅ **Render Service**: `https://reel-banana-render-423229273041.us-central1.run.app`

## 🔧 Backend Service Configuration

### CORS Configuration

All your backend services already have CORS enabled:

```javascript
// In each backend service
const cors = require('cors');
app.use(cors());
```

This allows your AI Studio frontend to make API calls to the backend services.

### Environment Variables Required

Make sure these are set in your Cloud Run services:

**Narrate Service:**
- `ELEVENLABS_API_KEY` - Your ElevenLabs API key

**All Services:**
- `PORT` - Service port (defaults provided)

## 🔥 Firebase Integration

Your Firebase configuration is centralized and will work from AI Studio:

```typescript
// Firebase config is automatically loaded from apiConfig
const firebaseConfig = apiConfig.firebase;
```

### Firestore Security Rules

Your current rules allow open access for development:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**⚠️ Security Note**: Consider implementing proper authentication and authorization rules for production.

## 🧪 Testing the Connection

### 1. Test Backend Services

You can test your backend services directly:

```bash
# Test upload service
curl -X POST https://reel-banana-upload-assets-423229273041.us-central1.run.app/upload-image \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test","fileName":"test.jpg","base64Image":"data:image/jpeg;base64,..."}'

# Test narrate service
curl -X POST https://reel-banana-narrate-423229273041.us-central1.run.app/narrate \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test","narrationScript":"Hello world"}'
```

### 2. Test Firebase Connection

Your Firebase service should work from AI Studio:

```typescript
import { createProject, getProject } from './services/firebaseService';

// Test creating a project
const projectId = await createProject({
  topic: "Test Topic",
  characterAndStyle: "Test Style",
  scenes: []
});
```

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure all backend services have `app.use(cors())`
   - Check that AI Studio domain is allowed

2. **API Endpoint Not Found**
   - Verify service URLs in `config/apiConfig.ts`
   - Check that services are deployed and running

3. **Firebase Connection Issues**
   - Verify Firebase configuration in `apiConfig.ts`
   - Check Firestore security rules

4. **Environment Variables**
   - Ensure `NODE_ENV=ai-studio` is set
   - Verify backend service environment variables

### Debug Mode

Enable debug logging by adding to your frontend:

```typescript
// Add to your main component
console.log('API Config:', apiConfig);
console.log('Environment:', process.env.NODE_ENV);
```

## 📊 Monitoring

### Backend Service Logs

Monitor your backend services in Google Cloud Console:

1. Go to Cloud Run
2. Select your service
3. Click "Logs" tab

### Firebase Usage

Monitor Firebase usage in the Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Check Firestore usage and performance

## 🔄 Updates and Maintenance

### Updating Backend Services

1. Make changes to backend code
2. Commit to git
3. Redeploy to Cloud Run:
   ```bash
   gcloud run deploy reel-banana-[service-name] --source ./backend/[service-name]
   ```

### Updating Frontend

1. Make changes to frontend code
2. Update in AI Studio
3. Redeploy

## 🎯 Production Considerations

1. **Security**: Implement proper Firestore security rules
2. **Authentication**: Add user authentication if needed
3. **Rate Limiting**: Consider adding rate limiting to backend services
4. **Monitoring**: Set up proper monitoring and alerting
5. **Backup**: Implement regular Firestore backups

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review backend service logs
3. Verify Firebase configuration
4. Test API endpoints directly

Your ReelBanana application is now ready for AI Studio deployment! 🎉

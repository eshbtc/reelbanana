# CLAUDE.md

This file provides comprehensive guidance to Claude Code (claude.ai/code) when working with the ReelBanana project. **Last Updated: January 2025**

## 🎬 Project Overview

**ReelBanana** is an AI-powered video creation platform that generates cinematic movies from text prompts. Users can create short films by providing a story idea, and the system automatically generates images, narration, music, and assembles everything into a polished video.

### Core Features
- **AI Story Generation**: Convert text prompts into structured movie scenes
- **Multi-Image Scenes**: Generate 3+ image variants per scene for variety
- **AI Narration**: Text-to-speech using ElevenLabs with emotion control
- **AI Music**: Background music generation using ElevenLabs Music API
- **Video Assembly**: FFmpeg-based video rendering with transitions and effects
- **Video Polish**: Optional upscaling and motion interpolation via Fal AI
- **Project Management**: Save, resume, and organize movie projects
- **Public Gallery**: Share and discover community-created movies
- **Demo Mode**: 6-second quick videos for testing

### Target Users
- **Content Creators**: Quick video content for social media
- **Educators**: Visual storytelling for lessons
- **Marketers**: Product demos and promotional videos
- **General Users**: Fun, creative video generation

## Development Commands

### Frontend Development
- `npm run dev` - Start Vite development server on http://localhost:5173
- `npm run build` - Build production assets to `dist/` folder
- `npm run preview` - Preview production build locally

### Firebase Operations
- `firebase deploy --only hosting` - Deploy frontend to Firebase Hosting
- `firebase deploy --only functions` - Deploy Cloud Functions (share handler)
- `firebase deploy` - Deploy everything (hosting + functions)

### Backend Services (Google Cloud Run)
Each backend service can be deployed individually from its directory:
```bash
cd backend/[service-name]
gcloud run deploy [service-name] --source . --platform managed --region us-central1 --allow-unauthenticated
```

**Available backend services:**
- `upload-assets` - Image upload to Google Cloud Storage (Port 8083)
- `narrate` - Text-to-speech using ElevenLabs TTS (Port 8080)
- `align-captions` - Caption timing alignment using Google Speech-to-Text (Port 8081)
- `compose-music` - AI music generation using ElevenLabs Music API (Port 8084)
- `render` - Video rendering with FFmpeg and Fal AI (Port 8082)
- `polish` - Video upscaling/interpolation via Fal AI (Port 8086)
- `api-key-service` - Secure API key management (Port 8085)

**Service Dependencies:**
- All services require `DEV_MODE=true` for development
- Services use Google Cloud Secret Manager for API keys
- All services include health checks and cache management

## Architecture Overview

### Frontend Stack
- **React 19** with TypeScript and Vite
- **Firebase** for authentication, Firestore database, and hosting
- **Tailwind CSS** for styling with custom amber theme
- **Environment-aware configuration** in `config/apiConfig.ts`
- **App Check** for security and abuse prevention
- **Responsive design** with mobile-first approach

### Backend Architecture
- **Microservices** deployed on Google Cloud Run
- **Node.js 20** services using Express framework
- **Firebase Admin SDK** for authentication and Firestore
- **Google Cloud Storage** (`reel-banana-35a54.firebasestorage.app`) for asset management
- **FFmpeg** for video processing in render service
- **Docker containers** for consistent deployment
- **Health checks** and monitoring endpoints

## 🚀 Recent Progress & Current Status

### ✅ **Phase 0: Production Blockers - COMPLETED**
- **Fixed bucket naming**: Standardized to `reel-banana-35a54.firebasestorage.app`
- **Fixed share flow**: Implemented proper `/share/:id` URLs with Firebase Functions
- **Fixed video URLs**: Using durable GCS URLs instead of expiring signed URLs
- **Fixed authorization**: Resolved double "Bearer" token issues
- **Fixed configuration**: Consistent endpoints across all services

### ✅ **Phase 1: Robustness & Reliability - COMPLETED**
- **Added retry logic**: Exponential backoff for all external API calls
- **Added timeouts**: Configurable timeouts for all services
- **Added error classification**: Proper error handling and user feedback
- **Added health checks**: Comprehensive service monitoring
- **Added cache management**: Content-based caching with lifecycle management

### ✅ **Phase 2: Security & Performance - COMPLETED**
- **Added rate limiting**: IP-based and user-based quotas
- **Added App Check**: Security tokens for all API requests
- **Added API key management**: Secure storage via Google Cloud Secret Manager
- **Added monitoring**: SLI-based success metrics
- **Added DEV_MODE**: Development-friendly environment switching

### ✅ **Recent Bug Fixes - COMPLETED**
- **Fixed image restoration**: Multiple images per scene now persist correctly
- **Fixed project loading**: Proper project ID flow between components
- **Fixed Firebase permissions**: Public gallery access issues resolved
- **Fixed storage permissions**: Authentication checks for GCS access
- **Added project naming**: Users can name projects at creation time
- **Added list view**: Sortable project list with last modified date

### AI Integration
- **Google Gemini 2.5 Flash** for story generation and image creation
- **ElevenLabs TTS** for high-quality narration with emotion control
- **ElevenLabs Music** for AI-generated background music
- **Google Speech-to-Text** for caption alignment
- **Fal AI** for video upscaling and motion interpolation
- **Custom API Keys** via secure server-side proxy for unlimited usage
- **Firebase AI Logic** for free user credits and fallback

### Key Configuration

#### Environment Selection
The application automatically selects configuration based on environment:
- **Development**: `localhost` URLs (ports 8080-8086)
- **Production**: Google Cloud Run URLs (223097908182 project)
- **AI Studio**: Alternative Cloud Run deployment (423229273041 project)

Override with `VITE_TARGET_ENV=ai-studio` for AI Studio deployment.

#### Service Integration
- `services/geminiService.ts` - Core AI service with Firebase AI Logic + API key fallback
- `config/apiConfig.ts` - Centralized API endpoint configuration
- `lib/authFetch.ts` - Authenticated API calls with App Check tokens

### Data Flow (E2E Pipeline)
1. **Story Generation**: User input → Gemini 2.5 Flash → Scene prompts
2. **Image Generation**: Scene prompts → Gemini 2.5 Flash → Base64 images → Cloud Storage (`upload-assets`)
3. **Narration**: Scene text → ElevenLabs TTS → MP3 files (`narrate`)
4. **Caption Alignment**: Audio → Google Speech-to-Text → SRT files (`align-captions`)
5. **Music Composition**: Story analysis → ElevenLabs Music → MP3 files (`compose-music`)
6. **Video Rendering**: Images + audio + captions + music → FFmpeg → MP4 (`render`)
7. **Optional Polish**: MP4 → Fal AI upscaling/interpolation → Enhanced video (`polish`)
8. **Playback & Share**: Video storage → Durable URLs → Movie player + sharing

### ✅ **Pipeline Improvements - COMPLETED**
- **Asset Discovery**: Fixed bucket naming for proper image discovery
- **Multi-Image Support**: Render now uses all generated images per scene
- **Retry Logic**: Exponential backoff for all external API calls
- **Error Handling**: Proper error classification and user feedback
- **Cache Management**: Content-based caching reduces costs and improves performance

### Caching Strategy
- **Firestore caching** for generated images (cost optimization)
- **Smart cache keys** include character refs and background images
- **70-90% cost reduction** through intelligent reuse

### Security & Authentication
- **Firebase Authentication** for user management
- **App Check** tokens for API request validation
- **Secure API key storage** via Google Cloud Secret Manager
- **Firebase ID tokens** for user identification in backend services
- **Rate Limiting**: IP-based and user-based quotas with tiered plans
- **DEV_MODE**: Development environment with disabled quotas

### ✅ **Security Improvements - COMPLETED**
- **Rate limiting**: Implemented on all expensive operations
- **App Check**: All endpoints properly protected
- **API key management**: Secure storage and rotation support
- **Authorization**: Fixed header forwarding issues
- **Monitoring**: Comprehensive security logging and alerts

### Testing & Deployment
- **✅ E2E Testing**: Automated pipeline tests via GitHub Actions
- **✅ CI/CD Pipeline**: Automated deployment with health checks
- **✅ Service Health**: Comprehensive health endpoints with dependency validation
- **✅ Independent Deployment**: Frontend/backend services deploy separately
- **✅ Monitoring**: SLI-based success metrics and alerting

### ✅ **Deployment Improvements - COMPLETED**
- **Configuration consistency**: Standardized across all environments
- **Service validation**: Health checks validate all dependencies
- **Automated rollback**: Failed deployments are automatically reverted
- **Node.js standardization**: All services use Node.js 20
- **Environment management**: DEV_MODE for development, production for live

### Development Workflow
1. **Start frontend**: `npm run dev` (http://localhost:5173)
2. **Run backend services**: Each service on ports 8080-8086
3. **Enable DEV_MODE**: Set `DEV_MODE=true` for all services
4. **Test E2E pipeline**: Automated tests via GitHub Actions
5. **Deploy services**: Individual Cloud Run deployments
6. **Deploy frontend**: Firebase Hosting deployment

## 🚨 Critical Implementation Notes for Agents

### ✅ **System Status: PRODUCTION READY**
The system is now fully functional with all critical issues resolved. All phases (0-2) have been completed successfully.

### Before Starting Any Work:
1. **Read REMEDIATION_PLAN.md** - Contains completed fixes and future roadmap
2. **Check current status** - All production blockers have been resolved
3. **Test E2E pipeline** after any service changes (upload → narrate → align → compose → render → share)

### Key Implementation Guidelines:
- **Bucket Consistency**: Always use `reel-banana-35a54.firebasestorage.app`
- **Multi-image Support**: System now properly handles multiple images per scene
- **Cache Management**: Services return `{ cached: true }` for UI indicators
- **Authentication**: All services require proper Firebase ID tokens and App Check
- **Environment Variables**: Use `DEV_MODE=true` for development

### When Working on Services:
- **Retry Logic**: All services have exponential backoff for external API calls
- **Error Handling**: Proper error classification and user feedback
- **Health Checks**: Comprehensive monitoring with dependency validation
- **Security**: App Check tokens and rate limiting are enforced
- **Caching**: Content-based caching reduces costs and improves performance

### Testing Requirements:
- **E2E Testing**: Automated pipeline tests via GitHub Actions
- **Share Links**: `/share/:id` URLs work and persist indefinitely
- **Service Health**: All `/health` endpoints return 200 with dependency status
- **Configuration**: All services use consistent bucket names and endpoints

### Monitoring Key Metrics:
- **E2E Success Rate**: >95% successful full pipelines
- **Render Success Rate**: >90% successful video renders
- **Share Link Durability**: Links remain functional indefinitely
- **Service Response Times**: <5s 95th percentile response times
- **Cache Hit Rate**: >70% for generated content

### 🔧 **Current API Keys & Secrets**
- **ElevenLabs TTS**: `ELEVENLABS_API_KEY_VOICE_NEW` (for narration)
- **ElevenLabs Music**: `ELEVENLABS_MUSIC_API_KEY` (for music generation)
- **Fal AI Render**: `FAL_RENDER_API_KEY` (for video rendering)
- **Fal AI Polish**: `FAL_POLISH_API_KEY` (for video upscaling)
- **Google Gemini**: `GEMINI_API_KEY` (for story and image generation)
- **All secrets**: Stored in Google Cloud Secret Manager with proper IAM permissions

## 📋 Quick Reference for Agents

### **Project Structure**
```
reelbanana/
├── components/          # React components (StoryboardEditor, MovieWizard, etc.)
├── services/           # Frontend services (firebaseService, geminiService, etc.)
├── backend/            # Microservices (upload-assets, narrate, render, etc.)
├── lib/                # Utilities (firebase, authFetch, appCheck)
├── config/             # API configuration (apiConfig.ts)
├── functions/          # Firebase Functions (share handler)
└── docs/               # Documentation and API specs
```

### **Key Files to Know**
- `App.tsx` - Main application component with routing
- `components/StoryboardEditor.tsx` - Main creation interface
- `components/MovieWizard.tsx` - Step-by-step movie creation
- `services/firebaseService.ts` - Project management and image restoration
- `config/apiConfig.ts` - Environment-aware API configuration
- `lib/authFetch.ts` - Authenticated API calls with App Check
- `backend/*/index.js` - Individual microservice implementations

### **Common Commands**
```bash
# Frontend development
npm run dev                    # Start dev server
npm run build                  # Build for production

# Backend services (run in separate terminals)
cd backend/narrate && npm start     # Port 8080
cd backend/align-captions && npm start  # Port 8081
cd backend/render && npm start      # Port 8082
cd backend/upload-assets && npm start   # Port 8083
cd backend/compose-music && npm start   # Port 8084
cd backend/api-key-service && npm start # Port 8085
cd backend/polish && npm start      # Port 8086

# Deployment
firebase deploy --only hosting     # Deploy frontend
firebase deploy --only functions   # Deploy Cloud Functions
```

### **Environment Variables**
- `DEV_MODE=true` - Disables quotas and enables development features
- `VITE_TARGET_ENV` - Controls which backend environment to use
- All API keys are managed via Google Cloud Secret Manager

### **Current Status: ✅ PRODUCTION READY**
The system is fully functional with all critical issues resolved. Future agents can focus on feature development and optimization rather than fixing production blockers.
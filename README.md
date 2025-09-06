<div align="center">
  <img width="1200" height="475" alt="ReelBanana Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
  
  # 🍌 ReelBanana
  
  **The Future of AI-Powered Storytelling**
  
  *Transform your ideas into professional movies in minutes with advanced AI technology*
  
  [![Live Demo](https://img.shields.io/badge/Live%20Demo-ReelBanana-brightgreen?style=for-the-badge&logo=firebase)](https://reel-banana-35a54.web.app)
  [![API Docs](https://img.shields.io/badge/API%20Documentation-OpenAPI-blue?style=for-the-badge&logo=swagger)](./docs/api/README.md)
  [![Postman](https://img.shields.io/badge/Postman%20Collection-Test%20APIs-orange?style=for-the-badge&logo=postman)](./docs/api/postman/)
</div>

## 🎬 **What is ReelBanana?**

ReelBanana is a revolutionary AI-powered storytelling platform that transforms your ideas into professional movies in minutes. Using cutting-edge AI technology, it generates stunning visuals, compelling narration, and custom musical scores to create cinematic experiences that rival professional productions.

## 🏆 **Hackathon-Winning Features**

### 🎵 **AI-Generated Musical Score**
- **Mood Analysis**: AI analyzes your story's emotional tone
- **Custom Composition**: Generates orchestral scores that match your narrative
- **Audio Mixing**: Seamlessly blends narration with background music
- **Live Service**: [Compose Music API](https://compose-music-423229273041.us-central1.run.app)

### 🎥 **Director-Level Controls**
- **Camera Movements**: Zoom in, zoom out, pan left, pan right
- **Advanced Transitions**: Fade, wipe, circle open, dissolve effects
- **Dynamic Duration**: Customizable scene timing (1-10 seconds)
- **Professional FFmpeg**: Real-time filter generation based on user choices

### 📱 **Social Sharing & Viral Growth**
- **Share Buttons**: One-click sharing with copy-to-clipboard
- **Meta Tags**: Open Graph and Twitter Card support
- **Cloud Functions**: Server-side share link handling
- **Public Gallery**: Community showcase of best movies

### 💰 **Cost Control & Performance**
- **Smart Caching**: Firestore-based image generation caching
- **70-90% Cost Reduction**: Reuses generated images for similar prompts
- **Instant Loading**: Cached content loads immediately
- **Professional Efficiency**: Enterprise-grade optimization

### 🎨 **Sophisticated Image Generation**
- **Shot Director AI**: Creates 5 sequential, cinematic prompts
- **Professional Quality**: "Cinematic, high quality, professional photograph" approach
- **Sequential Generation**: Avoids rate limiting with proper sequencing
- **Enhanced Error Handling**: Specific messages for different failure types

## 🚀 **Live Application**

### **Frontend**: [https://reel-banana-35a54.web.app](https://reel-banana-35a54.web.app)
- Complete React application with all hackathon features
- Professional UI with director controls
- Social sharing capabilities
- Public gallery showcase

### **Backend Services**:
- **Upload Assets**: [https://reel-banana-upload-assets-423229273041.us-central1.run.app](https://reel-banana-upload-assets-423229273041.us-central1.run.app)
- **Narrate**: [https://reel-banana-narrate-423229273041.us-central1.run.app](https://reel-banana-narrate-423229273041.us-central1.run.app)
- **Align Captions**: [https://reel-banana-align-captions-423229273041.us-central1.run.app](https://reel-banana-align-captions-423229273041.us-central1.run.app)
- **Render**: [https://reel-banana-render-423229273041.us-central1.run.app](https://reel-banana-render-423229273041.us-central1.run.app)
- **Compose Music**: [https://reel-banana-compose-music-423229273041.us-central1.run.app](https://reel-banana-compose-music-423229273041.us-central1.run.app)
- **Polish (Fal)**: [https://reel-banana-polish-423229273041.us-central1.run.app](https://reel-banana-polish-423229273041.us-central1.run.app)
- **Share Handler (CF)**: `/share/:id` (Firebase Function)

## 📖 API Documentation

- Full API specs and Postman collection are available under `docs/api/`:
  - OpenAPI specs: `docs/api/*.yaml`
  - Overview and usage: `docs/api/README.md`
  - Postman collection and environment: `docs/api/postman/`

## 📚 **API Documentation**

### **Complete API Reference**
- **[📖 API Documentation](./docs/api/README.md)** - Comprehensive guide to all endpoints
- **[🔗 OpenAPI Specs](./docs/api/)** - Individual service specifications
- **[📥 Postman Collection](./docs/api/postman/)** - Ready-to-use API testing

### **Available Services**
| Service | Description | OpenAPI Spec | Base URL |
|---------|-------------|--------------|---------|
| **Upload Assets** | Image upload to GCS | [📄 YAML](./docs/api/upload-assets.yaml) | https://reel-banana-upload-assets-423229273041.us-central1.run.app |
| **Narrate** | Text-to-speech narration | [📄 YAML](./docs/api/narrate.yaml) | https://reel-banana-narrate-423229273041.us-central1.run.app |
| **Align Captions** | Caption synchronization | [📄 YAML](./docs/api/align-captions.yaml) | https://reel-banana-align-captions-423229273041.us-central1.run.app |
| **Compose Music** | AI music generation | [📄 YAML](./docs/api/compose-music.yaml) | https://reel-banana-compose-music-423229273041.us-central1.run.app |
| **Render** | Video rendering | [📄 YAML](./docs/api/render.yaml) | https://reel-banana-render-423229273041.us-central1.run.app |
| **Polish (Fal)** | Video upscale/interp | — | https://reel-banana-polish-423229273041.us-central1.run.app |
| **API Key Service** | Secure key management | [📄 YAML](./docs/api/api-key-service.yaml) | https://reel-banana-api-key-service-423229273041.us-central1.run.app |

### **Quick API Test**
```bash
# Download Postman collection
curl -o ReelBanana-API.postman_collection.json https://raw.githubusercontent.com/eshbtc/reelbanana/main/docs/api/postman/ReelBanana-API.postman_collection.json

# Import into Postman and start testing!
```

## 🛠 **Technical Architecture**

### **Frontend Stack**
- **React 19** with TypeScript
- **Vite** for fast development and building
- **Firebase Hosting** for global CDN delivery
- **Tailwind CSS** for professional styling

### **Backend Microservices**
- **Node.js 18/20** with Express
- **Google Cloud Run** for serverless scaling
- **FFmpeg** for professional video processing
- **Firebase Functions** for serverless compute

### **AI & ML Integration**
- **Google Gemini 2.5 Flash** for story generation
- **Imagen 4.0** for high-quality image generation
- **Custom Music AI** for orchestral score composition
- **Advanced Prompt Engineering** for cinematic results

### **Data & Caching**
- **Firestore** for project storage and caching
- **Google Cloud Storage** for asset management
- **Intelligent Caching** for cost optimization
- **Real-time Updates** for collaborative features

## 🎯 **How It Works**

1. **📝 Story Generation**: AI creates compelling narratives from your topic
2. **🎨 Visual Creation**: Sophisticated "shot director" generates 5 cinematic images per scene
3. **🎤 Narration**: AI converts text to professional voiceover
4. **🎵 Music Composition**: AI analyzes mood and creates custom orchestral scores
5. **🎬 Video Assembly**: FFmpeg combines everything with director-level effects
6. **📱 Social Sharing**: One-click sharing with viral-ready meta tags

## 🎥 Demo Script (2 minutes)

1) Start from Template: Click “Start from Template” → pick “Superhero Banana”. A project with 4 scenes and Character & Style is loaded.
2) Character Passport: Add 1–3 reference images (small, clear face/pose). Tip shows why it improves consistency.
3) Draft Mode: Ensure “Draft (3 frames)” is selected. Generate images for Scene 1. It’s fast and quota‑friendly.
4) Style Morph: Set Style Preset (e.g., Ghibli) and Generate images for Scene 2. Note the Style badge overlay.
5) Reality Blend: Upload a background photo on Scene 3 and Generate. Note the “Blend: ON” badge and natural lighting.
6) Variant + Compare: Click “Generate Variant”, then “Compare” to show a side‑by‑side of the same scene.
7) Emotion: Choose “Excited” narration. Click “Play My Movie!” and let it render; call out smoother ducked audio.
8) Pro Polish: Enable “Pro Polish (Upscale + Interpolate)” before rendering to show crisper frames and motion (Fal service).
9) Publish: Click “Publish to Gallery”, set a title/description, publish, and copy the share link (dynamic OG preview).

## ✨ New Wow Features

- Character Passport: Upload 1–3 reference images to lock identity across scenes.
- Reality Blend: Compose your character into a user photo with matching lighting and perspective.
- Style Presets: Instantly morph scenes (Ghibli, Wes Anderson, Film Noir, Pixel Art, Claymation).
- Emotion‑Aware VO: Global emotion control adjusts narration style via ElevenLabs.
- Draft vs Final: 3 vs 5 frames per scene to balance speed and quality.
- Generate Variant + Compare: Rapid A/B side‑by‑side evaluation of a scene.
- Pro Polish (Fal): Optional upscale + motion interpolation pass.
- Dynamic Share Pages: Cloud Function reads published metadata for rich OG cards.

## 🔧 Fal Polish Service

Deploy `backend/polish` to Cloud Run with one of the following configurations:

- Model IDs (recommended):
  - `FAL_KEY` (or `FAL_API_KEY`): your Fal API key
  - `FAL_MODEL_UPSCALE`: e.g., `fal-ai/video-upscaler`, `fal-ai/topaz/upscale/video`, or `bria/video/increase-resolution`
  - `FAL_MODEL_INTERP`: frame interpolation model id (optional)
  - Optional model params:
    - `FAL_VIDEO_UPSCALE_SCALE` (for `fal-ai/video-upscaler`) — default `2`
    - `UPSCALE_FACTOR`, `TARGET_FPS` (for Topaz) — defaults `2` and `60`
    - `FAL_BRIA_DESIRED_INCREASE`, `FAL_BRIA_OUTPUT_CODEC` (for Bria) — defaults `2`, `mp4_h264`

- HTTP endpoints (alternative):
  - `FAL_API_KEY`: your Fal API key
  - `FAL_UPSCALE_ENDPOINT`: REST endpoint for upscaling (optional)
  - `FAL_INTERP_ENDPOINT`: REST endpoint for interpolation (optional)
  - Optional polling: `FAL_POLL_INTERVAL_MS`, `FAL_POLL_TIMEOUT_MS`

- Persistence (optional):
  - `OUTPUT_BUCKET_NAME`: GCS bucket for stable public URLs

Frontend toggle:
- Set `VITE_SHOW_POLISH=true` to show the “Pro Polish” checkbox.
- Set `VITE_ENABLE_POLISH=true` to enable polish calls when checked.

The frontend calls `/polish` only when the toggle is on and `VITE_ENABLE_POLISH=true`. If env vars are missing, it gracefully falls back to the original video URL.

### 🔑 Bring Your Own Fal Key (BYO)

To reduce platform costs for heavy users, you can allow Pro/Studio users to use their own Fal API key while keeping a platform key as the default.

- API‑Key Service (Cloud Run): extend to support provider‑scoped keys
  - `POST /store-api-key { provider: 'fal', apiKey }`
  - `GET /check-api-key?provider=fal`
  - `DELETE /remove-api-key?provider=fal`
  - Store encrypted; never return raw keys to clients.
- Polish service: prefer user’s Fal key when available (via verified ID token)
  - Resolve userId from Firebase ID token
  - If `provider=fal` key exists for user (and plan allows), call Fal with user key
  - Otherwise, fall back to platform `FAL_KEY`
- UI (Pro/Studio):
  - User Dashboard → “Fal API Key” field (masked) + “Use my Fal key” toggle
  - Label on Pro Polish: “Uses your Fal key if configured”

Security notes:
- Never accept or store keys on the frontend
- Enforce App Check + Firebase Auth on all write calls
- Redact sensitive headers/keys from logs

### 💳 Credits & Billing (Optional)

Implement a simple, provider‑agnostic credit system that tracks usage and debits credits with a small markup.

- Price catalog (server): versioned table by `provider + modelId + unit`
- Usage events (server): `requestId, userId, provider, modelId, operation, input_seconds, output_seconds, start_ms, end_ms, status`
- Cost = f(usage, priceCatalog); Credits = ceil(cost / credit_value)
- Idempotent charge: use requestId to avoid double charges
- Optional pre‑auth holds for long jobs

### 🧭 Plans & Gating (Optional)

Keep demo simple; add plan gating later without changing UX:

- Free (Basic): Draft only (3 frames), 480p, watermark, no Pro Polish
- Plus: Final (5 frames), 720p, Upscale (video‑upscaler)
- Pro: 1080p, Pro Polish (Topaz single‑call or two‑step), priority queue
- Studio: 4K, team, API access

Backend enforcement (render/polish):
- Cap resolution by plan; add watermark for Free
- Deny Pro Polish unless plan ≥ Pro
- Always log `provider_used: 'user' | 'platform'` for BYO keys

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+
- Firebase CLI
- Google Cloud SDK
- Gemini API Key

### **Local Development**

1. **Clone the repository**:
   ```bash
   git clone https://github.com/eshbtc/reelbanana.git
   cd reelbanana
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   # Create .env.local file
   echo "GEMINI_API_KEY=your_gemini_api_key_here" > .env.local
   ```

4. **Run locally**:
   ```bash
   npm run dev
   ```

5. **Open in browser**: [http://localhost:5173](http://localhost:5173)

### Environment & Config

- Frontend config selection is automatic:
  - Development: when served from `localhost` or `127.0.0.1`, uses local service URLs (http://localhost:8080–8086).
  - Production: when built (`import.meta.env.PROD`), uses Cloud Run URLs.
  - AI Studio: set `VITE_TARGET_ENV=ai-studio` to target the AI Studio deployment URLs.
- Firebase storage bucket now uses the canonical GCS name `reel-banana-35a54.appspot.com`.
- Pipelines expect the input bucket `oneminute-movie-in` by default; override via `INPUT_BUCKET_NAME`.

### **Deployment**

1. **Deploy Backend Services**:
   ```bash
   # Deploy music service
   cd backend/compose-music
   gcloud run deploy compose-music --source . --platform managed --region us-central1 --allow-unauthenticated
   
   # Deploy other services similarly
   ```

2. **Deploy Frontend**:
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

3. **Deploy Cloud Functions**:
   ```bash
   firebase deploy --only functions
   ```

### Service Health Checks

- Every microservice exposes a lightweight `GET /health` endpoint (no App Check required) returning JSON status.
  - Upload Assets: `${UPLOAD_BASE}/health`
  - Narrate: `${NARRATE_BASE}/health`
  - Align Captions: `${ALIGN_BASE}/health`
  - Compose Music: `${COMPOSE_BASE}/health`
  - Render: `${RENDER_BASE}/health`
  - Polish: `${POLISH_BASE}/health`
  - API Key Service: `${API_KEY_BASE}/health`
- Admin UI: open Dashboard → “Service Health” to run checks from the browser across all configured services.
  - Shows status, latency, and last checked time per service.

## 🏗 **Project Structure**

```
reelbanana/
├── components/           # React components
│   ├── SceneCard.tsx    # Director controls UI
│   ├── MoviePlayer.tsx  # Video player with sharing
│   ├── PublicGallery.tsx # Community showcase
│   └── ...
├── services/            # API services
│   ├── geminiService.ts # AI integration with caching
│   └── firebaseService.ts # Database operations
├── backend/             # Microservices
│   ├── compose-music/   # AI music generation
│   ├── render/          # Video processing
│   ├── narrate/         # Text-to-speech
│   └── ...
├── functions/           # Cloud Functions
│   └── index.js         # Social sharing handler
├── config/              # Configuration
│   └── apiConfig.ts     # Centralized API endpoints
└── types.ts             # TypeScript definitions
```

## 🎨 **Key Features in Detail**

### **Director Controls**
```typescript
// Camera movements
type CameraMovement = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'static';

// Transition effects  
type TransitionType = 'fade' | 'wipeleft' | 'wiperight' | 'circleopen' | 'dissolve' | 'none';

// Dynamic FFmpeg generation
const zoomEffect = scene.camera === 'zoom-in' 
  ? "zoompan=z='min(zoom+0.001,1.3)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720"
  : "scale=1280:720";
```

### **Smart Caching**
```typescript
// Cost control through intelligent caching
const cacheKey = generateCacheKey(mainPrompt, characterAndStyle);
const cacheSnap = await getDoc(doc(db, CACHE_COLLECTION, cacheKey));

if (cacheSnap.exists()) {
  return cacheSnap.data().imageUrls; // Instant loading
}
```

### **AI Music Generation**
```typescript
// Mood analysis and music composition
const musicPrompt = await geminiModel.generateContent(
  `Analyze the following narration script and provide a musical prompt: "${narrationScript}"`
);
```

## 🌟 **Why ReelBanana Wins Hackathons**

1. **🎬 Professional Quality**: Director-level controls rival professional video editing
2. **🤖 Multi-Modal AI**: Story + Images + Narration + Music in one pipeline
3. **💰 Cost Efficiency**: Smart caching reduces API costs by 70-90%
4. **📱 Viral Ready**: Social sharing with proper meta tags for growth
5. **⚡ Performance**: Instant loading with intelligent caching
6. **🔐 Enterprise Security**: Production-ready with Secret Manager integration
7. **🎯 User Experience**: Intuitive interface with professional results

## 🤝 **Contributing**

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 **Acknowledgments**

- **Google Gemini** for advanced AI capabilities
- **Firebase** for scalable backend infrastructure
- **Google Cloud Run** for serverless microservices
- **FFmpeg** for professional video processing
- **React** and **TypeScript** for robust frontend development

---

<div align="center">
  <strong>🍌 Made with ❤️ for the future of storytelling</strong>
  
  [Live Demo](https://reel-banana-35a54.web.app) • [GitHub](https://github.com/eshbtc/reelbanana) • [AI Studio](https://ai.studio/apps/drive/1G1sY0kiMQO4yiAmgPXBB6nlUUInRIqVT)
</div>
- ### **Characters for Demo**
- Pick a character using the “Pick a Character” button under Character & Style. We generate a few lightweight options with Gemini (Nano Banana) or load pre‑seeded demo characters.
- To avoid API calls in demos, seed Firestore collection `demo_characters`:
  - Run: `GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/seed-demo-characters.js`
  - Each doc: `name`, `description`, `images: [url]`, optional `templateId`.

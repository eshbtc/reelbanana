# 🎬 ReelBanana - AI Studio Challenge Submission

## 🚀 **Live Demo**
**URL**: https://reel-banana-35a54.web.app  
**Status**: ✅ Production Ready - No login required for demo

## 🎯 **Project Overview**
ReelBanana is an AI-powered video creation platform that transforms text prompts into professional cinematic movies using Google Gemini 2.5 Flash, ElevenLabs, and Fal AI. It showcases advanced AI capabilities in dynamic storytelling, automated creative workflows, and natural language photo editing.

## ✨ **Wow Factor Features**

### 🎨 **Consistent Character Generation**
- Upload 1-3 reference images to maintain character identity across scenes
- AI maintains visual consistency while allowing dynamic poses and expressions
- Seamless character continuity throughout multi-scene narratives

### 🎬 **Director-Level Controls**
- **Camera Movements**: Zoom in/out, pan left/right, static shots
- **Advanced Transitions**: Fade, wipe, circle open, dissolve effects
- **Style Presets**: Instantly morph scenes (Ghibli, Wes Anderson, Film Noir, Pixel Art, Claymation)
- **Reality Blend**: Compose characters into user photos with matching lighting

### 🎵 **AI-Generated Musical Score**
- Mood analysis of story emotional tone
- Custom orchestral composition using ElevenLabs Eleven Music
- Seamless audio mixing with narration
- Professional-quality background scores

### 🎥 **Professional Video Pipeline**
- **Draft Mode**: 3 frames per scene for rapid iteration
- **Final Mode**: 5 frames per scene for production quality
- **Pro Polish**: Optional upscaling and motion interpolation via Fal AI
- **Variant Generation**: A/B testing with side-by-side comparison

## 🏗️ **Technical Architecture**

### **AI Integration**
- **Google Gemini 2.5 Flash**: Story generation, prompt engineering, and image creation
- **ElevenLabs TTS**: Professional narration with emotion control
- **ElevenLabs Music**: AI-generated orchestral scores
- **Fal AI**: Video upscaling and motion interpolation
- **Google Speech-to-Text**: Caption alignment and timing

### **Backend Microservices (Google Cloud Run)**
- **upload-assets**: Image upload to Google Cloud Storage
- **narrate**: ElevenLabs text-to-speech generation
- **align-captions**: Google Speech-to-Text for SRT captions
- **compose-music**: AI music generation using ElevenLabs Eleven Music
- **render**: FFmpeg video assembly with professional effects
- **polish**: Video upscaling and motion interpolation
- **api-key-service**: Secure API key management

### **Frontend Stack**
- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS** for modern, responsive UI
- **Firebase** for authentication, hosting, and real-time collaboration

## 🎮 **Demo Instructions**

### **Quick Demo Flow (2 minutes)**
1. **Open**: https://reel-banana-35a54.web.app
2. **Start from Template**: Click "Start from Template" → pick "Superhero Banana"
3. **Character Passport**: Add 1-3 reference images for character consistency
4. **Style Morph**: Set Style Preset (e.g., Ghibli) and generate Scene 2
5. **Reality Blend**: Upload background photo on Scene 3 and generate
6. **Variant + Compare**: Generate variant and compare side-by-side
7. **Emotion Control**: Choose "Excited" narration and render
8. **Pro Polish**: Enable upscaling and motion interpolation
9. **Publish & Share**: Create public share link with OG tags

### **Demo Highlights**
- Show consistent character across different scenes
- Demonstrate style presets and reality blending
- Highlight AI-generated music and narration
- Test share links in incognito mode
- Show "Using cached..." indicators for efficiency

## 🔧 **Setup Instructions**

### **Prerequisites**
- Node.js 20+
- Google Cloud SDK
- Firebase CLI

### **Local Development**
```bash
# Clone repository
git clone https://github.com/eshbtc/reelbanana.git
cd reelbanana

# Install dependencies
npm install

# Start frontend
npm run dev

# Start backend services (in separate terminals)
cd backend/narrate && npm start     # Port 8080
cd backend/align-captions && npm start  # Port 8081
cd backend/render && npm start      # Port 8082
cd backend/upload-assets && npm start   # Port 8083
cd backend/compose-music && npm start   # Port 8084
cd backend/api-key-service && npm start # Port 8085
cd backend/polish && npm start      # Port 8086
```

### **Environment Variables**
Set the following in your environment:
- `DEV_MODE=true` for development
- API keys managed via Google Cloud Secret Manager

### **Deployment**
```bash
# Deploy frontend
firebase deploy --only hosting

# Deploy backend services
gcloud run deploy [service-name] --source . --region us-central1
```

## 📊 **System Status**
All services are healthy and production-ready:
- ✅ Upload Assets: 124ms avg response
- ✅ Narrate: 149ms avg response  
- ✅ Align Captions: 122ms avg response
- ✅ Render: 146ms avg response
- ✅ Compose Music: 125ms avg response
- ✅ Polish: 118ms avg response
- ✅ API Key Service: 94ms avg response

## 🏆 **Innovation Highlights**

### **Beyond Simple Text-to-Image**
- **Multi-modal AI Pipeline**: Story → Images → Narration → Music → Video
- **Consistent Character Generation**: Maintains identity across scenes
- **Director-Level Controls**: Professional video editing capabilities
- **Reality Integration**: Blend AI characters with real photos
- **Emotion-Aware Processing**: AI adapts narration and music to story mood

### **Real-World Impact**
- **Content Creators**: Rapid video content for social media
- **Educators**: Visual storytelling for lessons
- **Marketers**: Product demos and promotional videos
- **Entertainment**: Democratized cinematic storytelling

## 🔗 **Key URLs**
- **Main App**: https://reel-banana-35a54.web.app
- **Share Example**: https://reel-banana-35a54.web.app/share/[id]
- **Health Check**: https://reel-banana-render-223097908182.us-central1.run.app/health
- **GitHub Repository**: https://github.com/eshbtc/reelbanana

## 📝 **Gemini Integration Details**

ReelBanana leverages Gemini 2.5 Flash's advanced image generation capabilities to revolutionize storytelling through AI-powered video creation. The application uses Gemini's **consistent character generation** to maintain visual continuity across multi-scene narratives, enabling users to create cohesive cinematic experiences from simple text prompts.

**Key Gemini 2.5 Flash Features:**
- **Story Structure Generation**: Converts user prompts into structured movie scenes with detailed visual descriptions
- **Consistent Character Creation**: Generates multiple character variants while maintaining visual consistency across scenes
- **Multi-image Scene Generation**: Creates 3+ image variants per scene for visual variety and selection
- **Contextual Image Generation**: Uses scene context and character references for coherent visual storytelling

**Technical Implementation:**
The system processes user input through Gemini's natural language understanding to generate structured scene prompts, then leverages the image generation API to create consistent visual narratives. Each scene maintains character consistency while allowing for dynamic camera angles, lighting, and composition variations.

**Impact:**
This creates a seamless text-to-video pipeline where users can generate professional-quality short films without technical expertise, democratizing cinematic storytelling and enabling rapid content creation for creators, educators, and marketers.

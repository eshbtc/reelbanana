# System Architecture

This diagram shows how the Vite React app on Firebase Hosting interacts with Firebase services, Cloud Run microservices, and external providers used by ReelBanana.

```mermaid
flowchart TD
    user[User Browser] --> hosting[Firebase Hosting (Vite app)]
    hosting --> auth[Firebase Auth]
    hosting --> firestore[Firestore]
    hosting --> storage[Cloud Storage]
    hosting --> appcheck[App Check]

    hosting --> share[Firebase Functions: shareHandler (/share/:id)]

    subgraph Cloud Run Services
        upload[upload-assets]
        narrate[narrate]
        align[align-captions]
        render[render]
        compose[compose-music]
        polish[polish]
    end

    hosting --> upload
    hosting --> narrate
    hosting --> align
    hosting --> render
    hosting --> compose
    hosting --> polish

    upload --> storage
    narrate --> storage
    align --> firestore
    render --> storage
    compose --> storage
    polish --> storage

    subgraph External Providers
        tts[TTS Provider (e.g., ElevenLabs)]
        fal[Fal.ai (Upscale/Interp)]
        ai[Firebase AI Logic / Vertex AI]
        ffmpeg[FFmpeg]
    end

    narrate --> tts
    compose --> ai
    polish --> fal
    render --> ffmpeg
    share --> firestore
```

Notes
- Cloud Run services require App Check (`X-Firebase-AppCheck`) and, when applicable, Firebase ID tokens.
- `shareHandler` reads public movie metadata from Firestore and returns social meta-tag HTML.

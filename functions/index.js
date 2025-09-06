const {onRequest, onCall} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Cloud Function to handle share links
 * Generates HTML with proper meta tags for social media sharing
 * Note: This is a public endpoint, so we don't enforce App Check
 * App Check is enforced on Firestore, Storage, and AI Logic instead
 */
exports.shareHandler = onRequest(async (req, res) => {
  // Extract shareId from the path since this is a raw onRequest
  const shareId = req.path.split('/').pop();
  
  try {
    // Try fetching public movie metadata by ID for dynamic OG tags
    let title = 'Amazing Movie Created with ReelBanana';
    let description = 'Check out this incredible AI-generated movie! Created with ReelBanana - the future of storytelling.';
    let imageUrl = 'https://reel-banana-render-423229273041.us-central1.run.app/placeholder-thumbnail.jpg';
    let videoUrl = undefined;
    if (shareId) {
      try {
        const snap = await admin.firestore().doc(`public_movies/${shareId}`).get();
        if (snap.exists) {
          const data = snap.data() || {};
          title = data.title || title;
          description = data.description || description;
          if (data.thumbnailUrl) imageUrl = data.thumbnailUrl;
          videoUrl = data.videoUrl || undefined;
        }
      } catch (e) {
        console.warn('Share handler: Firestore fetch failed', e);
      }
    }
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- Open Graph Meta Tags for Social Media -->
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:url" content="${req.protocol}://${req.get('host')}/share/${shareId}">
    <meta property="og:type" content="video.other">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${imageUrl}">
    
    <!-- Standard Meta Tags -->
    <title>${title} - ReelBanana</title>
    <meta name="description" content="${description}">
    
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .container {
            text-align: center;
            max-width: 600px;
            padding: 2rem;
        }
        .logo {
            font-size: 3rem;
            font-weight: bold;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .subtitle {
            font-size: 1.2rem;
            margin-bottom: 2rem;
            opacity: 0.9;
        }
        .cta-button {
            display: inline-block;
            background: #f59e0b;
            color: white;
            padding: 1rem 2rem;
            text-decoration: none;
            border-radius: 0.5rem;
            font-weight: bold;
            font-size: 1.1rem;
            transition: background 0.3s ease;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .cta-button:hover {
            background: #d97706;
        }
        .features {
            margin-top: 3rem;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
        }
        .feature {
            background: rgba(255,255,255,0.1);
            padding: 1rem;
            border-radius: 0.5rem;
            backdrop-filter: blur(10px);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🍌 ReelBanana</div>
        <div class="subtitle">
            Someone shared an amazing AI-generated movie with you!
        </div>
        <p style="margin-bottom: 2rem; opacity: 0.8;">
            This movie was created using ReelBanana - the revolutionary AI-powered storytelling platform 
            that turns your ideas into professional movies in minutes.
        </p>
        <div style="display:flex; gap:1rem; justify-content:center; flex-wrap:wrap;">
          <a href="https://reel-banana-35a54.web.app" class="cta-button">Create Your Own Movie</a>
          ${videoUrl ? `<a href="${videoUrl}" class="cta-button" style="background:#10b981;">Watch Video</a>` : ''}
        </div>
        
        <div class="features">
            <div class="feature">
                <h3>🎬 AI-Generated</h3>
                <p>Advanced AI creates stunning visuals and narration</p>
            </div>
            <div class="feature">
                <h3>🎵 Musical Score</h3>
                <p>AI composes custom music to match your story</p>
            </div>
            <div class="feature">
                <h3>🎥 Director Controls</h3>
                <p>Professional camera movements and transitions</p>
            </div>
        </div>
    </div>
    
    <script>
        // Redirect to main app after a short delay
        setTimeout(() => {
            window.location.href = 'https://reel-banana-35a54.web.app';
        }, 10000);
    </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
    
  } catch (error) {
    console.error('Error generating share page:', error);
    res.status(500).send('Error generating share page');
  }
});

/**
 * Example callable function with App Check enforcement
 * This demonstrates how to properly enforce App Check on callable functions
 */
exports.secureDataHandler = onCall(
  {
    enforceAppCheck: true, // Reject requests with missing or invalid App Check tokens
  },
  (request) => {
    // request.app contains data from App Check, including the app ID
    console.log('App Check verified for app:', request.app.appId);
    
    // Your secure function logic here
    return {
      message: 'This is a secure endpoint protected by App Check',
      appId: request.app.appId,
      timestamp: new Date().toISOString()
    };
  }
);
// CI/CD test - Sat Sep  6 13:34:57 CDT 2025
// CI/CD test with fixed permissions - Sat Sep  6 13:39:53 CDT 2025

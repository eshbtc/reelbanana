const functions = require('firebase-functions');
const { Firestore } = require('@google-cloud/firestore');

const firestore = new Firestore();

/**
 * Cloud Function to handle share links
 * Generates HTML with proper meta tags for social media sharing
 */
exports.shareHandler = functions.https.onRequest(async (req, res) => {
  const { shareId } = req.params;
  
  try {
    // For now, we'll create a simple share page
    // In a full implementation, you'd fetch project data from Firestore
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- Open Graph Meta Tags for Social Media -->
    <meta property="og:title" content="Amazing Movie Created with ReelBanana">
    <meta property="og:description" content="Check out this incredible AI-generated movie! Created with ReelBanana - the future of storytelling.">
    <meta property="og:image" content="https://reel-banana-render-423229273041.us-central1.run.app/placeholder-thumbnail.jpg">
    <meta property="og:url" content="${req.protocol}://${req.get('host')}/share/${shareId}">
    <meta property="og:type" content="video.other">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Amazing Movie Created with ReelBanana">
    <meta name="twitter:description" content="Check out this incredible AI-generated movie! Created with ReelBanana - the future of storytelling.">
    <meta name="twitter:image" content="https://reel-banana-render-423229273041.us-central1.run.app/placeholder-thumbnail.jpg">
    
    <!-- Standard Meta Tags -->
    <title>Amazing Movie - ReelBanana</title>
    <meta name="description" content="Check out this incredible AI-generated movie! Created with ReelBanana - the future of storytelling.">
    
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
        <a href="https://reel-banana-35a54.web.app" class="cta-button">
            Create Your Own Movie
        </a>
        
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
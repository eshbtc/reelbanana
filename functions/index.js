const {onRequest, onCall} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Cloud Function to set admin status for a user
 * Usage: Call with { email: 'user@example.com', isAdmin: true }
 */
exports.setAdminStatus = onCall(async (request) => {
  const { email, isAdmin } = request.data;
  
  if (!email || typeof isAdmin !== 'boolean') {
    throw new Error('Invalid parameters: email and isAdmin required');
  }
  
  try {
    // Find user by email
    const usersRef = admin.firestore().collection('users');
    const querySnapshot = await usersRef.where('email', '==', email).get();
    
    if (querySnapshot.empty) {
      throw new Error(`User with email ${email} not found`);
    }
    
    // Update admin status
    const userDoc = querySnapshot.docs[0];
    await userDoc.ref.update({
      isAdmin: isAdmin,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return {
      success: true,
      message: `Admin status updated for ${email}: ${isAdmin}`,
      userId: userDoc.id
    };
  } catch (error) {
    console.error('Error setting admin status:', error);
    throw new Error(`Failed to set admin status: ${error.message}`);
  }
});

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
    let imageUrl = 'https://reel-banana-35a54.web.app/logo.png';
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

/**
 * listPublicMovies (fallback for gallery)
 * Public endpoint that returns a paginated list of published public_movies.
 * Uses Admin SDK; enforces safe limits and returns a minimal shape for the gallery.
 * Optional App Check verification if header is present; does not require auth.
 * Query params: limit (default 24, max 50), startAfter (createdAt ISO)
 */
exports.listPublicMovies = onRequest(async (req, res) => {
  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Firebase-AppCheck');
    if (req.method === 'OPTIONS') return res.status(204).send('');

    // Best-effort App Check verification when header present
    const appCheckHeader = req.header('X-Firebase-AppCheck');
    if (appCheckHeader) {
      try { await admin.appCheck().verifyToken(appCheckHeader); } catch (e) {
        // Non-fatal for public gallery; log and continue
        console.warn('listPublicMovies: App Check verification failed (continuing as public):', e.message);
      }
    }

    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '24'), 10) || 24));
    const startAfterIso = req.query.startAfter ? String(req.query.startAfter) : null;
    let q = admin.firestore().collection('public_movies')
      .orderBy('createdAt', 'desc')
      .limit(limit);
    if (startAfterIso) {
      const start = new Date(startAfterIso);
      if (!isNaN(start.valueOf())) {
        q = q.startAfter(start);
      }
    }

    const snap = await q.get();
    const items = snap.docs.map(d => {
      const x = d.data() || {};
      return {
        id: d.id,
        title: x.title || 'Untitled',
        description: x.description || '',
        thumbnailUrl: x.thumbnailUrl || null,
        videoUrl: x.videoUrl || null,
        createdAt: x.createdAt ? (x.createdAt.toDate ? x.createdAt.toDate().toISOString() : x.createdAt) : null,
      };
    });
    res.json({ items, count: items.length });
  } catch (e) {
    console.error('listPublicMovies error:', e);
    res.status(500).json({ code: 'INTERNAL', message: 'Failed to list public movies' });
  }
});

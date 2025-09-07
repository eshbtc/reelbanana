#!/usr/bin/env node

/**
 * Demo Preparation Script
 * Helps prepare for hackathon demo with cache warming and content generation
 */

import { runHealthChecks } from './hackathon-health-check.js';

async function prepareDemo() {
  console.log('🎬 Preparing ReelBanana Demo for Hackathon...\n');
  
  // Step 1: Health Checks
  console.log('1️⃣ Running Health Checks...');
  const healthResults = await runHealthChecks();
  
  const criticalServices = ['render', 'narrate', 'compose'];
  const criticalHealthy = criticalServices.every(service => 
    healthResults.find(r => r.service === service)?.status === 'healthy'
  );
  
  if (!criticalHealthy) {
    console.log('\n❌ Critical services are unhealthy. Fix before proceeding.');
    return;
  }
  
  console.log('\n2️⃣ Demo Preparation Checklist:');
  console.log('================================');
  
  console.log('\n📋 Pre-Demo Checklist:');
  console.log('  □ Set demo user plan to "pro" in Firestore (users/{uid}.plan = "pro")');
  console.log('  □ Verify all Cloud Run services have required environment variables:');
  console.log('    - ELEVENLABS_API_KEY or ELEVENLABS_MUSIC_API_KEY');
  console.log('    - GEMINI_API_KEY');
  console.log('    - INPUT_BUCKET_NAME');
  console.log('    - OUTPUT_BUCKET_NAME');
  console.log('  □ Test complete pipeline: upload → narrate → align → compose → render → publish → share');
  console.log('  □ Create 2-3 demo movies with different styles');
  console.log('  □ Verify share links work in incognito mode');
  console.log('  □ Confirm OG tags and Twitter cards load properly');
  
  console.log('\n🔧 Quick Test Commands:');
  console.log('======================');
  
  console.log('\n# Health Check (basic)');
  console.log('curl https://reel-banana-render-223097908182.us-central1.run.app/health');
  
  console.log('\n# SLI Dashboard (requires App Check token)');
  console.log('curl -H "X-Firebase-AppCheck: YOUR_TOKEN" \\');
  console.log('  https://reel-banana-render-223097908182.us-central1.run.app/sli-dashboard');
  
  console.log('\n# Test Share Page');
  console.log('curl -s https://reel-banana-35a54.web.app/share/YOUR_SHARE_ID | grep -E "(og:|twitter:)"');
  
  console.log('\n🎯 Demo Flow:');
  console.log('=============');
  console.log('1. Open https://reel-banana-35a54.web.app');
  console.log('2. Sign in with Google');
  console.log('3. Create new project');
  console.log('4. Add scenes with different styles');
  console.log('5. Run "Generate All"');
  console.log('6. Wait for completion');
  console.log('7. Publish and share');
  console.log('8. Test share link in incognito');
  
  console.log('\n🚨 Emergency Fallbacks:');
  console.log('=======================');
  console.log('- Music generation fails → Uses placeholder WAV');
  console.log('- Polish fails → Returns original video');
  console.log('- Cache hits → Shows "Using cached..." indicators');
  console.log('- Rate limits → Clear error messages with reset times');
  
  console.log('\n📱 Demo Tips:');
  console.log('=============');
  console.log('- Keep browser dev tools open for logs');
  console.log('- Have backup share links ready');
  console.log('- Test on different devices/browsers');
  console.log('- Show both polished and original videos');
  console.log('- Demonstrate different style presets');
  
  console.log('\n✅ Demo is ready! Good luck with your hackathon submission! 🚀');
}

// Run demo preparation
if (import.meta.url === `file://${process.argv[1]}`) {
  prepareDemo().catch(error => {
    console.error('Demo preparation failed:', error);
    process.exit(1);
  });
}

export { prepareDemo };

#!/usr/bin/env node

/**
 * Demo Test Script for ReelBanana
 * Tests the demo UI and pipeline functionality
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🎬 ReelBanana Demo Test Script');
console.log('================================\n');

// Check if we're in the right directory
if (!fs.existsSync('package.json')) {
  console.error('❌ Please run this script from the ReelBanana root directory');
  process.exit(1);
}

// Check if demo UI component exists
const demoUIPath = path.join(__dirname, '..', 'components', 'DemoUI.tsx');
if (!fs.existsSync(demoUIPath)) {
  console.error('❌ DemoUI.tsx not found. Please create it first.');
  process.exit(1);
}

console.log('✅ Demo UI component found');

// Check if all backend services are available
const services = [
  { name: 'narrate', port: 8080 },
  { name: 'align-captions', port: 8081 },
  { name: 'render', port: 8082 },
  { name: 'upload-assets', port: 8083 },
  { name: 'compose-music', port: 8084 },
  { name: 'polish', port: 8086 }
];

console.log('\n🔍 Checking backend services...');

let allServicesRunning = true;
for (const service of services) {
  try {
    const response = execSync(`curl -s http://localhost:${service.port}/health`, { 
      encoding: 'utf8',
      timeout: 5000 
    });
    if (response.includes('ok') || response.includes('healthy')) {
      console.log(`✅ ${service.name} (port ${service.port}) - Running`);
    } else {
      console.log(`⚠️  ${service.name} (port ${service.port}) - Responding but not healthy`);
      allServicesRunning = false;
    }
  } catch (error) {
    console.log(`❌ ${service.name} (port ${service.port}) - Not running`);
    allServicesRunning = false;
  }
}

if (!allServicesRunning) {
  console.log('\n⚠️  Some services are not running. Starting them...');
  
  // Start services in background
  for (const service of services) {
    try {
      const servicePath = path.join(__dirname, '..', 'backend', service.name);
      if (fs.existsSync(servicePath)) {
        console.log(`🚀 Starting ${service.name}...`);
        execSync(`cd ${servicePath} && npm start &`, { 
          stdio: 'ignore',
          detached: true 
        });
        // Wait a bit for service to start
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.log(`❌ Failed to start ${service.name}: ${error.message}`);
    }
  }
}

// Check frontend dependencies
console.log('\n📦 Checking frontend dependencies...');
try {
  execSync('npm list --depth=0', { stdio: 'pipe' });
  console.log('✅ Frontend dependencies installed');
} catch (error) {
  console.log('❌ Frontend dependencies missing. Installing...');
  execSync('npm install', { stdio: 'inherit' });
}

// Start frontend development server
console.log('\n🚀 Starting frontend development server...');
console.log('📱 Demo will be available at: http://localhost:5173/demo');
console.log('🎬 Main app will be available at: http://localhost:5173');
console.log('\n⏹️  Press Ctrl+C to stop the server\n');

try {
  execSync('npm run dev', { stdio: 'inherit' });
} catch (error) {
  console.log('\n❌ Failed to start development server');
  console.log('Error:', error.message);
  process.exit(1);
}

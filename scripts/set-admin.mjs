#!/usr/bin/env node

/**
 * Script to set admin status for a user via Cloud Function
 * Usage: node scripts/set-admin.mjs <email> <true|false>
 */

import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Firebase config
const firebaseConfig = {
  projectId: 'reel-banana-35a54',
  apiKey: 'AIzaSyBqJ8K9L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6',
  authDomain: 'reel-banana-35a54.firebaseapp.com',
  storageBucket: 'reel-banana-35a54.firebasestorage.app',
  appId: '1:123456789012:web:abcdef1234567890abcdef'
};

async function setAdminStatus(email, isAdmin) {
  try {
    console.log(`🔧 Setting admin status for: ${email} -> ${isAdmin}`);
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const functions = getFunctions(app);
    
    // Call the Cloud Function
    const setAdminStatus = httpsCallable(functions, 'setAdminStatus');
    const result = await setAdminStatus({ email, isAdmin });
    
    console.log('✅ Success!', result.data);
    
  } catch (error) {
    console.error('❌ Error setting admin status:', error);
    process.exit(1);
  }
}

// Get parameters from command line
const email = process.argv[2];
const isAdminStr = process.argv[3];

if (!email || !isAdminStr) {
  console.error('❌ Please provide email and admin status');
  console.log('Usage: node scripts/set-admin.mjs <email> <true|false>');
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  console.error('❌ Invalid email format');
  process.exit(1);
}

// Validate admin status
const isAdmin = isAdminStr.toLowerCase() === 'true';
if (isAdminStr.toLowerCase() !== 'true' && isAdminStr.toLowerCase() !== 'false') {
  console.error('❌ Admin status must be "true" or "false"');
  process.exit(1);
}

setAdminStatus(email, isAdmin);

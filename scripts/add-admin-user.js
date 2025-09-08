#!/usr/bin/env node

/**
 * Script to add admin user to Firestore
 * Usage: node scripts/add-admin-user.js <email>
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

// Firebase config
const firebaseConfig = {
  projectId: 'reel-banana-35a54',
  apiKey: 'AIzaSyBqJ8K9L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6',
  authDomain: 'reel-banana-35a54.firebaseapp.com',
  storageBucket: 'reel-banana-35a54.firebasestorage.app',
  appId: '1:123456789012:web:abcdef1234567890abcdef'
};

async function addAdminUser(email) {
  try {
    console.log(`🔧 Adding admin user: ${email}`);
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // Create a temporary user ID (we'll use email hash)
    const userId = Buffer.from(email).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    
    // Check if user already exists
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      console.log('👤 User already exists, updating admin status...');
      await setDoc(userRef, {
        isAdmin: true,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } else {
      console.log('👤 Creating new admin user...');
      await setDoc(userRef, {
        uid: userId,
        email: email,
        displayName: 'Admin User',
        isAdmin: true,
        freeCredits: 999999, // Unlimited credits for admin
        totalUsage: 0,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    
    console.log('✅ Admin user added successfully!');
    console.log(`📧 Email: ${email}`);
    console.log(`🆔 User ID: ${userId}`);
    console.log(`👑 Admin Status: true`);
    console.log(`💳 Credits: 999999 (unlimited)`);
    
  } catch (error) {
    console.error('❌ Error adding admin user:', error);
    process.exit(1);
  }
}

// Get email from command line
const email = process.argv[2];
if (!email) {
  console.error('❌ Please provide an email address');
  console.log('Usage: node scripts/add-admin-user.js <email>');
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  console.error('❌ Invalid email format');
  process.exit(1);
}

addAdminUser(email);

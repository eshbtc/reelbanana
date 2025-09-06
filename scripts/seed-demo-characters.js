#!/usr/bin/env node
// Seed a few demo characters into Firestore: collection 'demo_characters'
// Usage: GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/seed-demo-characters.js

const admin = require('firebase-admin');

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
  const db = admin.firestore();

  const demo = [
    {
      id: 'banana-hero',
      name: 'Banana Hero',
      description: 'A brave banana with a tiny red cape and bright eyes, painted in warm watercolor with soft edges.',
      images: ['https://via.placeholder.com/512x512/FFEB3B/000000?text=Banana+Hero'],
      templateId: 'superhero-banana',
    },
    {
      id: 'space-banana',
      name: 'Space Banana',
      description: 'Banana astronaut in a charming retro-futuristic suit; soft pastel sci-fi style, cozy glow.',
      images: ['https://via.placeholder.com/512x512/90CAF9/000000?text=Space+Banana'],
      templateId: 'space-banana',
    },
    {
      id: 'noir-banana',
      name: 'Detective Banana',
      description: 'Banana detective with a tiny fedora; high-contrast film noir style with dramatic shadows.',
      images: ['https://via.placeholder.com/512x512/263238/FFFFFF?text=Noir+Banana'],
      templateId: 'noir-banana',
    },
    {
      id: 'robot-sidekick',
      name: 'Robot Sidekick',
      description: 'A small friendly robot with glowing eyes; clean cel-shaded style, bright highlights.',
      images: ['https://via.placeholder.com/512x512/CFD8DC/000000?text=Robot+Sidekick'],
    },
    {
      id: 'ghibli-artist',
      name: 'Ghibli Artist',
      description: 'A gentle painter with round glasses; soft Ghibli watercolor style and warm palette.',
      images: ['https://via.placeholder.com/512x512/FFE0B2/000000?text=Ghibli+Artist']
    },
    {
      id: 'pixel-pioneer',
      name: 'Pixel Pioneer',
      description: 'A plucky explorer rendered in 16‑bit pixel art with crisp dithered shading.',
      images: ['https://via.placeholder.com/512x512/80CBC4/000000?text=Pixel+Pioneer']
    },
    {
      id: 'clay-guardian',
      name: 'Clay Guardian',
      description: 'A steadfast protector with claymation textures and soft studio lighting.',
      images: ['https://via.placeholder.com/512x512/FFCDD2/000000?text=Clay+Guardian']
    },
  ];

  for (const item of demo) {
    await db.collection('demo_characters').doc(item.id).set({
      name: item.name,
      description: item.description,
      images: item.images,
      templateId: item.templateId || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log('Seeded', item.id);
  }
  console.log('Done.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

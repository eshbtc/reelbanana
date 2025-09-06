#!/usr/bin/env node
// Upload local images to a GCS bucket and update demo_characters Firestore docs
// Usage: GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/upload-character-images.js ./characters

const path = require('path');
const fs = require('fs');
const { Storage } = require('@google-cloud/storage');
const admin = require('firebase-admin');

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Usage: node scripts/upload-character-images.js ./characters');
    process.exit(1);
  }
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  const storage = new Storage();
  const db = admin.firestore();
  const bucketName = process.env.STORAGE_BUCKET || 'reel-banana-35a54.appspot.com';
  const bucket = storage.bucket(bucketName);

  const files = fs.readdirSync(dir).filter(f => /\.(png|jpg|jpeg)$/i.test(f));
  for (const f of files) {
    const local = path.join(dir, f);
    const dest = `demo-characters/${Date.now()}-${f}`;
    const [uploaded] = await bucket.upload(local, { destination: dest, metadata: { contentType: 'image/png' } });
    await uploaded.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${dest}`;
    const id = path.basename(f, path.extname(f)).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    await db.collection('demo_characters').doc(id).set({
      name: id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      description: 'Demo character image',
      images: [publicUrl],
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log('Uploaded and registered', id, publicUrl);
  }
  console.log('Done');
}

main().catch((e) => { console.error(e); process.exit(1); });


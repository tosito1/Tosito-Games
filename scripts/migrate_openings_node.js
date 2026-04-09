const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// You need a service account key JSON file to run this locally.
// If you don't have one, I can provide a client-side snippet to run in the browser console.
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrate() {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'api', 'openings.json'), 'utf8'));
  console.log(`Loaded ${data.length} openings.`);

  const batchSize = 500;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = db.batch();
    const chunk = data.slice(i, i + batchSize);
    chunk.forEach(op => {
      const docRef = db.collection('openings').doc(op.eco);
      batch.set(docRef, op);
    });
    await batch.commit();
    console.log(`Uploaded batch ${i / batchSize + 1}`);
  }
  console.log('Migration complete!');
}

migrate().catch(console.error);

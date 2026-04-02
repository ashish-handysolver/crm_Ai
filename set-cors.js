const dotenv = require('dotenv');
const { existsSync } = require('fs');
const { Storage } = require('@google-cloud/storage');

dotenv.config();

const projectId = process.env.GCLOUD_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const bucketName = process.env.GCLOUD_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET;
const serviceAccountPath = process.env.GCLOUD_SERVICE_ACCOUNT_PATH || './service-account.json';
const serviceAccountJson = process.env.GCLOUD_SERVICE_ACCOUNT_JSON;

if (!projectId || !bucketName) {
  console.error('Missing GCLOUD_PROJECT_ID or FIREBASE_PROJECT_ID or VITE_FIREBASE_PROJECT_ID / GCLOUD_STORAGE_BUCKET or FIREBASE_STORAGE_BUCKET or VITE_FIREBASE_STORAGE_BUCKET in environment.');
  process.exit(1);
}

let storage;
if (serviceAccountJson) {
  const credentials = JSON.parse(serviceAccountJson);
  storage = new Storage({ projectId, credentials });
} else if (existsSync(serviceAccountPath)) {
  storage = new Storage({ projectId, keyFilename: serviceAccountPath });
} else {
  console.error(`No service account provided. Set GCLOUD_SERVICE_ACCOUNT_JSON or GCLOUD_SERVICE_ACCOUNT_PATH (fallback ${serviceAccountPath}).`);
  process.exit(1);
}

async function configureCors() {
  const corsConfiguration = [
    {
      origin: ['*'],
      method: ['GET', 'HEAD', 'OPTIONS'],
      responseHeader: ['Content-Type'],
      maxAgeSeconds: 3600,
    },
  ];

  console.log(`Setting CORS on bucket: ${bucketName}...`);
  await storage.bucket(bucketName).setCorsConfiguration(corsConfiguration);
  console.log('CORS configured successfully! It may take a few minutes to propagate to browsers.');
}

configureCors().catch(err => {
  console.error('Failed to set CORS config:', err);
  process.exit(1);
});

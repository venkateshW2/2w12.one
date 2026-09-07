// Backblaze B2 upload helper (S3-compatible API).
// Streams multer's file stream straight to B2 via @aws-sdk/lib-storage's
// Upload class — never buffers a whole video into memory.
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { randomUUID } = require('crypto');
const path = require('path');

function client() {
  return new S3Client({
    endpoint: process.env.B2_ENDPOINT, // e.g. https://s3.us-west-004.backblazeb2.com
    region: process.env.B2_REGION, // e.g. us-west-004 — must match the bucket's own region string
    forcePathStyle: true, // more reliable against B2 than virtual-hosted-style addressing
    // Newer AWS SDK v3 default checksum headers break against B2's S3-compatible endpoint.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId: process.env.B2_KEY_ID,
      secretAccessKey: process.env.B2_APP_KEY
    }
  });
}

function configured() {
  return !!(process.env.B2_KEY_ID && process.env.B2_APP_KEY && process.env.B2_BUCKET && process.env.B2_ENDPOINT && process.env.B2_REGION);
}

// Uploads a multer file (memory or stream) to B2 and returns its public URL.
// `folder` groups objects by kind, e.g. "audio", "video", "images".
async function uploadToB2(file, folder) {
  if (!configured()) {
    throw new Error('Backblaze B2 is not configured — set B2_KEY_ID, B2_APP_KEY, B2_BUCKET, B2_ENDPOINT, B2_REGION.');
  }
  const ext = path.extname(file.originalname) || '';
  const key = `${folder}/${randomUUID()}${ext}`; // extension preserved so classify() keeps working

  const upload = new Upload({
    client: client(),
    params: {
      Bucket: process.env.B2_BUCKET,
      Key: key,
      Body: file.buffer || file.stream,
      ContentType: file.mimetype || 'application/octet-stream'
      // No ACL param — B2's S3 compatibility layer doesn't reliably honor per-object ACLs.
      // Bucket itself must be set to Public in the B2 dashboard.
    }
  });

  await upload.done();

  const base = process.env.B2_PUBLIC_BASE_URL || `${process.env.B2_ENDPOINT}/${process.env.B2_BUCKET}`;
  return `${base.replace(/\/$/, '')}/${key}`;
}

module.exports = { uploadToB2, configured };

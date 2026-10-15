/**
 * Vercel Serverless Function: Cloudinary Upload Signature Generator
 * Securely signs Cloudinary uploads without exposing API Secret to frontend
 */

import crypto from 'crypto';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  if (!apiSecret || !apiKey || !cloudName) {
    return res.status(500).json({
      error: 'Cloudinary environment variables missing on server.',
      hint: 'Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.'
    });
  }

  try {
    const { folder = 'music-app/uploads', timestamp = Math.round(new Date().getTime() / 1000) } = req.body || {};

    // Sort parameters alphabetically
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

    return res.status(200).json({
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

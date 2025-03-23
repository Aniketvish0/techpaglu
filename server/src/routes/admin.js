// src/routes/admin.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ADMIN_SECRET } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Simple in-memory cache
const cache = {};

// Rate limiting and cooldown
let last403Time = null;

// Clear cache endpoint (for admin use)
router.post('/clear-cache', (req, res) => {
  const { secret } = req.body;

  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  Object.keys(cache).forEach(key => delete cache[key]);
  res.json({ success: true, message: 'Cache cleared successfully' });
});

// Clear cooldown endpoint (for admin use)
router.post('/clear-cooldown', (req, res) => {
  const { secret } = req.body;

  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  last403Time = null;
  try {
    fs.unlinkSync(path.join(__dirname, 'cooldown.json'));
  } catch (e) {
    console.log('No cooldown file to delete');
  }

  res.json({ success: true, message: 'Cooldown reset successfully' });
});

export default router;
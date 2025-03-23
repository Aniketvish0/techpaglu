// src/routes/health.js
import express from 'express';
import { last403Time, COOLDOWN_PERIOD } from '../services/cooldown.js';

const router = express.Router();

// Simple in-memory cache
const cache = {};

router.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    cooldown: last403Time ? {
      active: Date.now() - last403Time < COOLDOWN_PERIOD,
      remainingSeconds: Math.max(0, Math.ceil((COOLDOWN_PERIOD - (Date.now() - last403Time)) / 1000))
    } : null,
    cacheSize: Object.keys(cache).length
  });
});

export default router;
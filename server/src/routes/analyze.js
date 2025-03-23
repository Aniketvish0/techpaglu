import express from 'express';
import { analyzeTwitter } from '../services/twitter.js';
import { CACHE_TTL } from '../services/cache.js';
import { last403Time, COOLDOWN_PERIOD } from '../services/cooldown.js';

const router = express.Router();

const cache = {};

router.post('/analyze', async (req, res) => {
  const { handle } = req.body;

  if (!handle) {
    return res.status(400).json({ error: 'Twitter handle is required' });
  }
  // check the cache
  if (cache[handle] && (Date.now() - cache[handle].timestamp < CACHE_TTL)) {
    console.log(`Returning cached result for ${handle}`);
    return res.json(cache[handle].data);
  }

  try {
    const resultData = await analyzeTwitter(handle);
    // chache the result
    cache[handle] = {
      timestamp: Date.now(),
      data: resultData
    };

    res.json(resultData);
  } catch (error) {
    console.error('Error in analyze endpoint:', error);
    if (error.message.includes('403 Forbidden')) {
      return res.status(403).json({
        error: 'Twitter is temporarily blocking our requests. Please try again later.',
        retryAfter: last403Time ? Math.ceil((COOLDOWN_PERIOD - (Date.now() - last403Time)) / 1000) : 900
      });
    }
    if (error.message.includes('No tweets found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({
      error: 'Failed to analyze tweets. Please try again.',
      details: error.message
    });
  }
});

export default router;
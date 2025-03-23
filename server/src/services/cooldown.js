// src/services/cooldown.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const COOLDOWN_PERIOD = 15 * 60 * 1000; // 15 minutes

// Rate limiting and cooldown
export let last403Time = null;

try {
  if (fs.existsSync(path.join(__dirname, '../../cooldown.json'))) {
    const cooldownData = JSON.parse(fs.readFileSync(path.join(__dirname, '../../cooldown.json'), 'utf8'));
    last403Time = cooldownData.time;
  }
} catch (e) {
  console.log("No cooldown data found");
}
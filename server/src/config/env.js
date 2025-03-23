// src/config/env.js
import dotenv from 'dotenv';
dotenv.config();

export const {
  PORT,
  TWITTER_USERNAME,
  ADMIN_SECRET,
} = process.env;
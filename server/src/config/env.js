// src/config/env.js
import dotenv from 'dotenv';
dotenv.config();

export const {
  PORT,
  ADMIN_SECRET,
} = process.env;
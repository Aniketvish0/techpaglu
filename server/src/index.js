import express from 'express';
import cors from 'cors';
import { PORT } from './config/env.js';
import analyzeRoutes from './routes/analyze.js';
import adminRoutes from './routes/admin.js';
import healthRoutes from './routes/health.js';

const app = express();

app.use(cors({
  origin: 'https://techpaglu.vercel.app',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Routes
app.use('/', analyzeRoutes);
app.use('/', adminRoutes);
app.use('/', healthRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
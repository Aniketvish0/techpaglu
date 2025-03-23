import express from 'express';
import cors from 'cors';
import { PORT } from './src/config/env.js';
import analyzeRoutes from './src/routes/analyze.js';
import adminRoutes from './src/routes/admin.js';
import healthRoutes from './src/routes/health.js';

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


app.get('/test',(req,res)=>{
  res.json("I am alive");
})
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
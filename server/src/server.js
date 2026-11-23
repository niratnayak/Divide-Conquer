import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import analysisRoutes from './routes/analysis.js';
import studentRoutes from './routes/students.js';
import { notFound, errorHandler } from './middleware/error.js';
import { isLLMConfigured, llmConfig } from './services/llm.js';

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const app = express();

app.use(cors({
  origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, aiAnalysis: isLLMConfigured() }));
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/students', studentRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5000;

connectDB(process.env.MONGODB_URI)
  .then(() => app.listen(PORT, () => {
    console.log(`ResumeIQ API running on http://localhost:${PORT}`);
    console.log(isLLMConfigured()
      ? `AI resume analysis enabled (model: ${llmConfig().model})`
      : 'AI resume analysis disabled: set GROQ_API_KEY in server/.env');
  }))
  .catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });

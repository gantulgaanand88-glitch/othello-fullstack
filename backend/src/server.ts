import 'dotenv/config';

import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import http from 'http';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import { Server } from 'socket.io';

import authRoutes from './routes/auth';
import gameRoutes from './routes/game';
import leaderboardRoutes from './routes/leaderboard';
import { initializeGameSocket } from './sockets/gameSocket';

const app = express();
const server = http.createServer(app);

const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';

const allowedOrigins = clientUrl.split(',').map((u) => u.trim());

// Security headers
app.use(helmet());

app.use(
  cors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
  }),
);

// Body size limit to prevent payload abuse (1 MB)
app.use(express.json({ limit: '1mb' }));

// Rate-limit auth endpoints: 20 requests per minute per IP
const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
  },
});

initializeGameSocket(io);

async function startServer(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  const port = Number(process.env.PORT ?? 4000);

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not configured.');
  }

  await mongoose.connect(mongoUri);

  server.listen(port, '0.0.0.0', () => {
    console.log(`Backend listening on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export { app, server, io };

import 'dotenv/config';

import cors from 'cors';
import express from 'express';
import http from 'http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';

import authRoutes from './routes/auth';
import gameRoutes from './routes/game';
import leaderboardRoutes from './routes/leaderboard';
import { initializeGameSocket } from './sockets/gameSocket';

const app = express();
const server = http.createServer(app);

const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';

const allowedOrigins = clientUrl.split(',').map((u) => u.trim());

app.use(
  cors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
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

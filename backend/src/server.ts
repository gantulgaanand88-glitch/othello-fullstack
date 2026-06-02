import 'dotenv/config';

import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import http from 'http';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import { Server } from 'socket.io';
import compression from 'compression';
import pinoHttp from 'pino-http';

import authRoutes from './routes/auth';
import gameRoutes from './routes/game';
import leaderboardRoutes from './routes/leaderboard';
import privacyRoutes from './routes/privacy';
import consentRoutes from './routes/consent';
import reportRoutes from './routes/report';
import historyRoutes from './routes/history';
import profileRoutes from './routes/profile';
import { validateJwtSecret } from './middleware/auth';
import { initializeGameSocket } from './sockets/gameSocket';

const app = express();
const server = http.createServer(app);

const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
const allowedOrigins = clientUrl.split(',').map((u) => u.trim());

// Request logger
app.use(pinoHttp());

// Response compression
app.use(compression());

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

// Rate-limit game endpoints: 30 requests per minute per IP
const gameLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many game actions. Please try again later.' },
});

// Rate-limit leaderboard endpoints: 60 requests per minute per IP
const leaderboardLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many leaderboard requests. Please try again later.' },
});

app.get('/api/health', (_req, res) => {
  res.json({ status: mongoose.connection.readyState === 1 ? 'ok' : 'degraded' });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/game', gameLimiter, gameRoutes);
app.use('/api/leaderboard', leaderboardLimiter, leaderboardRoutes);
app.use('/api/privacy', privacyRoutes);
app.use('/api/consent', consentRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/profile', profileRoutes);

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

// Startup validation for JWT_SECRET (must be configured and >= 32 chars)
validateJwtSecret();

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown — Render sends SIGTERM during deploys
function gracefulShutdown(signal: string): void {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  io.close(() => {
    server.close(() => {
      mongoose.connection.close(false).then(() => {
        console.log('Server and database connections closed.');
        process.exit(0);
      });
    });
  });
  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

export { app, server, io };

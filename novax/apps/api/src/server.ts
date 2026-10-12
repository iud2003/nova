import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { Server as SocketIOServer } from 'socket.io';

import { env } from './config/env';
import { connectDB } from './config/database';
import { marketEngine } from './services/marketEngine';
import { gameService } from './services/gameService';
import { GameMode } from '@novax/shared';

// Route imports
import authRoutes from './routes/auth';
import walletRoutes from './routes/wallet';
import packageRoutes from './routes/packages';
import referralRoutes from './routes/referrals';
import marketRoutes from './routes/market';
import gameRoutes from './routes/game';

const app = express();
const server = http.createServer(app);

// Setup Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  path: env.SOCKET_PATH || '/socket.io',
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman) or matching dev origin
      callback(null, true);
    },
    credentials: true,
  })
);
app.use(cookieParser(env.COOKIE_SECRET));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/game', gameRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    market: marketEngine.getStatus(),
  });
});

// Attach socket server to game engine
gameService.setIO(io);

// Socket.IO event wiring
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Send initial market status
  socket.emit('market:status', marketEngine.getStatus());

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Market ticks broadcast via Socket.IO
marketEngine.on('market:tick', (tick) => {
  io.emit('market:tick', tick);
});

marketEngine.on('candle:update', (candle) => {
  io.emit('candle:update', candle);
});

marketEngine.on('candle:complete', (candle) => {
  io.emit('candle:complete', candle);
});

// Start background prediction round generator loop (1-minute rounds)
async function startPredictionRoundLoop() {
  console.log('🎰 Starting prediction round automated scheduler...');
  const runLoop = async () => {
    try {
      // Check if there is already an open round
      const activeRounds = await import('./models').then((m) =>
        m.GameRound.findOne({
          gameMode: GameMode.PRICE_DIRECTION,
          status: 'OPEN',
        })
      );

      if (!activeRounds) {
        // Create a 60-second price direction round
        await gameService.createRound(GameMode.PRICE_DIRECTION, 60);
      }
    } catch (err) {
      console.error('Error creating automated round:', err);
    }
  };

  await runLoop();
  // Check every 30 seconds to maintain an active round pipeline
  setInterval(runLoop, 30000);
}

// Server bootstrap
async function bootstrap() {
  try {
    console.log('🚀 Connecting to MongoDB...');
    await connectDB();

    console.log('📈 Starting Market Engine...');
    marketEngine.start();

    // Start auto rounds
    startPredictionRoundLoop();

    const PORT = parseInt(env.PORT || '5000', 10);
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                   🌟 NOVAX API SERVER 🌟                  ║
╠═══════════════════════════════════════════════════════════╣
║  API Running at:       http://localhost:${PORT}             ║
║  Health Check:         http://localhost:${PORT}/api/health  ║
║  WebSocket Path:       ${env.SOCKET_PATH}                   ║
║  Environment:          ${env.NODE_ENV}                      ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();

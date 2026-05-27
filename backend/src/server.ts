import http from 'http';
import mongoose from 'mongoose';
import { env } from './config/env';
import { createApp } from './app';
import { initSocket } from './sockets';
import { startTrendingRefreshLoop } from './services/trendingEngine';

async function start() {
  // 1. Connect to MongoDB
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
    });
    console.log('✔ MongoDB connected');
  } catch (err) {
    console.error('✘ MongoDB connection failed:', err);
    process.exit(1);
  }

  // 2. Build app + http server
  const app = createApp();
  const server = http.createServer(app);

  // 3. Attach Socket.IO
  initSocket(server);
  console.log('✔ Socket.IO initialised');

  // 4. Background workers
  const trendingHandle = startTrendingRefreshLoop();
  console.log('✔ Trending refresh loop started');

  // 5. Listen
  server.listen(env.PORT, () => {
    console.log(`✔ Server listening on http://localhost:${env.PORT}`);
    console.log(`  Environment: ${env.NODE_ENV}`);
  });

  // 6. Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down…`);
    clearInterval(trendingHandle);
    server.close(() => {
      mongoose.connection.close().then(() => {
        console.log('Closed.');
        process.exit(0);
      });
    });
    // Force-exit after 10s
    setTimeout(() => {
      console.error('Could not close in time, forcing exit');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

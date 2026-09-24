import dotenv from 'dotenv';
import app from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';

dotenv.config({ quiet: true });

const port = Number(process.env.PORT) || 5000;
let server;

async function start() {
  try {
    await connectDatabase();
    server = app.listen(port, () => {
      console.info(`API listening on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start API:', error.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.info(`${signal} received; shutting down`);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();

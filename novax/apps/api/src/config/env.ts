import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/novax'),
  JWT_ACCESS_SECRET: z.string().min(10),
  JWT_REFRESH_SECRET: z.string().min(10),
  COOKIE_SECRET: z.string().min(10),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  MARKET_MODE: z.enum(['SIMULATED', 'LIVE']).default('SIMULATED'),
  MARKET_TICK_INTERVAL_MS: z.string().default('1000'),
  MARKET_STARTING_PRICE: z.string().default('1.0000'),
  SOCKET_PATH: z.string().default('/socket.io'),
  LOG_LEVEL: z.string().default('debug'),
  DEMO_FUNDING_ENABLED: z.string().default('true'),
  INITIAL_CONVERSION_RATE: z.string().default('1.0'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

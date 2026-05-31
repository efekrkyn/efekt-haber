import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Connection URL from environment
const connectionString = process.env.DATABASE_URL!;

// Disable prefetch as it is not supported for "Transaction" pool mode in Neon Serverless
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });

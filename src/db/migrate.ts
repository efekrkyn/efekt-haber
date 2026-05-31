import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { config } from 'dotenv';
import { sql } from 'drizzle-orm';

config({ path: '.env' });

const connectionString = process.env.DATABASE_URL!;

// Prepare: false is needed for Transaction mode (pooler) but migrator requires standard connection.
// For migrations, it's safer to use non-pooling connection or just disable prefetch.
const migrationClient = postgres(connectionString, { max: 1 });

async function runMigrations() {
  console.log('⏳ Running migrations...');
  const db = drizzle(migrationClient);

  // Install vector extension before migrating so vector types work
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);

  await migrate(db, { migrationsFolder: './drizzle' });

  console.log('✅ Migrations completed');
  await migrationClient.end();
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db, sqlite } from './index.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Run migrations from the drizzle folder
const migrationsFolder = join(__dirname, '..', '..', 'drizzle');

console.log('Running migrations from:', migrationsFolder);

try {
  migrate(db, { migrationsFolder });
  console.log('✅ Migrations completed successfully');
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  sqlite.close();
}

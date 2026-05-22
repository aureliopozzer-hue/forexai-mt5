/**
 * Vercel Build Script
 *
 * Automatically switches Prisma from SQLite → PostgreSQL for Vercel deployment.
 * - If DATABASE_URL starts with "postgresql://", switches provider to "postgresql"
 * - Runs prisma generate + db push before next build
 * - If DATABASE_URL is SQLite, keeps provider as "sqlite" (local dev)
 */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const SCHEMA_PATH = 'prisma/schema.prisma';
const dbUrl = process.env.DATABASE_URL || '';

console.log('🔧 [Build] DATABASE_URL starts with:', dbUrl.substring(0, 30) + '...');

if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
  console.log('🔧 [Build] PostgreSQL detected — switching Prisma provider...');

  let schema = readFileSync(SCHEMA_PATH, 'utf-8');
  schema = schema.replace(
    /provider = "sqlite"/g,
    'provider = "postgresql"'
  );
  // Remove the SQLite comment lines
  schema = schema.replace(
    /\/\/ ⚠️ Para deploy no Vercel[\s\S]*?Supabase\.\n/,
    ''
  );
  writeFileSync(SCHEMA_PATH, schema);
  console.log('✅ [Build] Prisma provider switched to PostgreSQL');
} else {
  console.log('🔧 [Build] SQLite detected — keeping Prisma provider as-is');
}

// Generate Prisma Client
console.log('🔧 [Build] Running prisma generate...');
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
} catch {
  // Fallback if npx not available
  execSync('bunx prisma generate', { stdio: 'inherit' });
}

// Push schema to database (only for PostgreSQL — SQLite auto-creates)
if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
  console.log('🔧 [Build] Pushing schema to PostgreSQL...');
  try {
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
  } catch (e) {
    console.warn('⚠️ [Build] db push failed (may already be in sync):', e.message);
  }
}

// Build Next.js
console.log('🚀 [Build] Running next build...');
execSync('next build', { stdio: 'inherit' });

console.log('✅ [Build] Complete!');

#!/usr/bin/env node

/**
 * Admin Credentials Setup Script
 * Generates high-entropy admin credentials and writes salted scrypt hash to .env.local.
 * 
 * Usage:
 *   npm run admin:setup
 *   npm run admin:setup -- --force  (to rotate existing credentials)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env.local');

// Parse CLI flags
const args = process.argv.slice(2);
const force = args.includes('--force') || args.includes('-f') || args.includes('--rotate');
const customUsernameIndex = args.indexOf('--username');
const customUsername = customUsernameIndex !== -1 ? args[customUsernameIndex + 1] : null;

// Read existing .env.local if present
let envContent = '';
const existingVars = new Map();

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx !== -1) {
      const key = line.substring(0, eqIdx).trim();
      const val = line.substring(eqIdx + 1).trim();
      existingVars.set(key, val);
    }
  }
}

// Check if admin credentials already exist
const hasExistingCredentials = existingVars.has('ADMIN_USERNAME') && existingVars.has('ADMIN_PASSWORD_HASH');

if (hasExistingCredentials && !force) {
  console.log('\n\x1b[33m[!] Admin credentials already exist in .env.local.\x1b[0m');
  console.log('    To rotate credentials and generate a new admin account, run:');
  console.log('    \x1b[36mnpm run admin:setup -- --force\x1b[0m\n');
  process.exit(0);
}

// Generate secure random credentials
function generateSecurePassword(length = 24) {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+';
  const randomBytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[randomBytes[i] % charset.length];
  }
  return result;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return `scrypt$N=16384,r=8,p=1$${salt}$${derivedKey.toString('hex')}`;
}

// Next.js expands `$NAME` references in .env files. Escape every dollar sign
// so the stored scrypt separators survive loading through @next/env.
function serializeEnvValue(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('$', '\\$');
}

const username = customUsername || `admin_${crypto.randomBytes(4).toString('hex')}`;
const password = generateSecurePassword(24);
const passwordHash = hashPassword(password);
const sessionSecret = crypto.randomBytes(32).toString('hex');

// Update or construct .env.local content preserving all existing variables
const newKeys = {
  ADMIN_USERNAME: username,
  ADMIN_PASSWORD_HASH: serializeEnvValue(passwordHash),
  ADMIN_SESSION_SECRET: sessionSecret,
};

// Remove legacy plain-text password if present
existingVars.delete('ADMIN_PASSWORD');

// Reconstruct .env.local
const lines = [];
const processedKeys = new Set();

if (envContent) {
  for (const line of envContent.split('\n')) {
    const eqIdx = line.indexOf('=');
    if (eqIdx !== -1) {
      const key = line.substring(0, eqIdx).trim();
      if (key === 'ADMIN_PASSWORD') {
        // Skip legacy plain password
        continue;
      }
      if (newKeys[key]) {
        lines.push(`${key}=${newKeys[key]}`);
        processedKeys.add(key);
        continue;
      }
    }
    lines.push(line);
  }
}

// Append any missing newKeys
let hasSectionHeader = lines.some((l) => l.includes('# Admin Authentication'));
if (!hasSectionHeader) {
  lines.push('\n# Admin Authentication (Generated via npm run admin:setup)');
}

for (const [k, v] of Object.entries(newKeys)) {
  if (!processedKeys.has(k)) {
    lines.push(`${k}=${v}`);
  }
}

// Clean up trailing/duplicate blank lines
const cleanContent = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
fs.writeFileSync(envPath, cleanContent, { mode: 0o600 });
try {
  fs.chmodSync(envPath, 0o600);
} catch {
  // mode set if possible
}

// Display credentials once to Terminal
console.log('\n' + '='.repeat(64));
console.log('   TENSOR MACTOBER - SECURE ADMIN CREDENTIALS GENERATED');
console.log('='.repeat(64));
console.log(`\n  Username:  \x1b[32m\x1b[1m${username}\x1b[0m`);
console.log(`  Password:  \x1b[33m\x1b[1m${password}\x1b[0m\n`);
console.log('  \x1b[31m[IMPORTANT]\x1b[0m');
console.log('  1. Save these credentials in your password manager now.');
console.log('  2. They are displayed here ONLY ONCE and cannot be recovered.');
console.log('  3. The salted scrypt hash was stored securely in .env.local.');
console.log('  4. The plaintext password is NEVER written to disk or sent over network.');
console.log('='.repeat(64) + '\n');

#!/usr/bin/env node

/**
 * Student Account Setup Script
 * Creates students who can sign in to the contest (there is no open registration).
 * Stores only a salted scrypt hash; passwords are printed (or written to --out) once.
 *
 * Usage:
 *   npm run students:add -- --username aarav --name "Aarav Sharma" --student-id TS-101 [--email a@b.c] [--section "Section 1"]
 *   npm run students:add -- ... --password 'chosen-secret'   (otherwise one is generated)
 *   npm run students:add -- --username nikita --student-id 20267778 --existing
 *       (gives a login to a student already in the current event, keeping their attempts)
 *   npm run students:add -- --file students.tsv --out credentials.csv
 *       (bulk: one student per line, tab-separated: username, name, student ID, email, section;
 *        usernames or student IDs that already exist are skipped and reported; "--file -" reads stdin)
 *
 * Uses DATABASE_URL from the environment, else from .env.local. Students join the
 * current event (the newest row in `events`, same as the app).
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(path.resolve(__dirname, '..'), '.env.local');

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m) return m[1];
    }
  }
  console.error('DATABASE_URL is not set (environment or .env.local). Student accounts need Postgres.');
  process.exit(1);
}

// Same hash format as scripts/admin-setup.mjs (verified by verifyPassword)
function generatePassword(length = 12) {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) result += charset[bytes[i] % charset.length];
  return result;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$N=16384,r=8,p=1$${salt}$${key.toString('hex')}`;
}

const csv = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replaceAll('"', '""')}"` : String(v ?? ''));

/** Creates one student (or adds a login to an existing one) inside its own transaction. */
async function createStudent(client, eventId, s) {
  await client.query('BEGIN');
  try {
    const taken = await client.query('SELECT 1 FROM student_accounts WHERE lower(username) = lower($1)', [s.username]);
    if (taken.rows[0]) throw new Error(`Username "${s.username}" is already taken.`);

    let rows;
    if (s.existing) {
      ({ rows } = await client.query(
        `SELECT p.id, p.name, (sa.participant_id IS NOT NULL) AS has_login
         FROM participants p LEFT JOIN student_accounts sa ON sa.participant_id = p.id
         WHERE p.event_id = $1 AND p.student_id = $2`,
        [eventId, s.studentId]
      ));
      if (!rows[0]) throw new Error(`No student with ID ${s.studentId} in this event.`);
      if (rows[0].has_login) throw new Error(`Student ${s.studentId} already has a login.`);
    } else {
      ({ rows } = await client.query(
        `INSERT INTO participants (event_id, name, student_id, email, section, session_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (event_id, student_id) DO NOTHING
         RETURNING id, name`,
        [eventId, s.name, s.studentId, s.email || null, s.section || null, `sess_${crypto.randomBytes(16).toString('hex')}`]
      ));
      if (!rows[0]) throw new Error(`Student ID ${s.studentId} already exists in this event (use --existing to give them a login).`);
    }

    const password = s.password || generatePassword();
    await client.query('INSERT INTO student_accounts (participant_id, username, password_hash) VALUES ($1, $2, $3)', [
      rows[0].id,
      s.username,
      hashPassword(password),
    ]);
    await client.query('COMMIT');
    return { ...s, name: rows[0].name, password };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  }
}

const file = arg('file');
const existing = args.includes('--existing');
let students;
if (file) {
  students = fs
    .readFileSync(file === '-' ? 0 : file, 'utf8') // "-" reads stdin
    .split(/\r?\n/)
    .map((line) => line.split('\t').map((f) => f.trim()))
    .filter((f) => f.length >= 3 && f[0])
    .map(([username, name, studentId, email, section]) => ({ username, name, studentId, email, section }));
} else {
  const s = {
    username: arg('username')?.trim(),
    name: arg('name')?.trim(),
    // Existing students keep their student ID exactly as stored; new ones are upper-cased like registration did
    studentId: existing ? arg('student-id')?.trim() : arg('student-id')?.trim().toUpperCase(),
    email: arg('email')?.trim(),
    section: arg('section')?.trim(),
    password: arg('password'),
    existing,
  };
  if (!s.username || !s.studentId || (!s.name && !existing)) {
    console.error('Usage: npm run students:add -- --username <u> --name "<Full Name>" --student-id <ID> [--email <e>] [--section <s>] [--password <p>]');
    console.error('       npm run students:add -- --username <u> --student-id <ID> --existing [--password <p>]');
    console.error('       npm run students:add -- --file <students.tsv> [--out <credentials.csv>]');
    process.exit(1);
  }
  students = [s];
}

const client = new pg.Client({ connectionString: databaseUrl() });
try {
  await client.connect();
  const { rows: events } = await client.query('SELECT id, name FROM events ORDER BY created_at DESC LIMIT 1');
  if (!events[0]) throw new Error('No event found. Start the app once so it creates the default event.');

  const created = [];
  const failed = [];
  for (const s of students) {
    try {
      created.push(await createStudent(client, events[0].id, s));
    } catch (err) {
      failed.push(`${s.username || '?'}: ${err.message}`);
    }
  }

  if (file) {
    const out = arg('out');
    const header = 'username,password,email,name,student_id,section';
    const body = created.map((c) => [c.username, c.password, c.email, c.name, c.studentId, c.section].map(csv).join(','));
    if (out) {
      fs.writeFileSync(out, [header, ...body].join('\n') + '\n', { mode: 0o600 });
      console.log(`\n  ${created.length} students created for "${events[0].name}"; credentials written to ${out}`);
    } else {
      console.log([header, ...body].join('\n'));
    }
  } else if (created[0]) {
    const c = created[0];
    console.log(`\n  ${existing ? 'Login added' : 'Student created'} for "${events[0].name}"`);
    console.log(`  Name:      ${c.name} (${c.studentId})`);
    console.log(`  Username:  \x1b[32m\x1b[1m${c.username}\x1b[0m`);
    console.log(`  Password:  \x1b[33m\x1b[1m${c.password}\x1b[0m   (shown only once)\n`);
  }
  for (const f of failed) console.error(`\x1b[31m[!] ${f}\x1b[0m`);
  if (failed.length) process.exitCode = 1;
} catch (err) {
  console.error(`\x1b[31m[!] ${err.message}\x1b[0m`);
  process.exitCode = 1;
} finally {
  await client.end();
}

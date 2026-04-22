import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

const DANGEROUS_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'DROP TABLE', re: /\bDROP\s+TABLE\b/i },
  { name: 'DROP COLUMN', re: /\bALTER\s+TABLE\b[\s\S]*?\bDROP\s+COLUMN\b/i },
  { name: 'TRUNCATE TABLE', re: /\bTRUNCATE\s+TABLE\b/i },
  { name: 'DELETE FROM', re: /\bDELETE\s+FROM\b/i },
];

function listMigrationSqlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const sqlPath = path.join(dir, entry.name, 'migration.sql');
    if (fs.existsSync(sqlPath)) out.push(sqlPath);
  }
  return out.sort();
}

function stripSqlLineComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

function main() {
  const files = listMigrationSqlFiles(MIGRATIONS_DIR);
  if (files.length === 0) {
    console.log('No migration.sql files found.');
    return;
  }

  const violations: Array<{ file: string; pattern: string }> = [];
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf-8');
    const sql = stripSqlLineComments(raw);
    for (const p of DANGEROUS_PATTERNS) {
      if (p.re.test(sql)) {
        violations.push({ file, pattern: p.name });
      }
    }
  }

  if (violations.length > 0) {
    console.error('Destructive migration statements detected:');
    for (const v of violations) {
      console.error(`- ${v.pattern} in ${v.file}`);
    }
    process.exit(1);
  }

  console.log(`Checked ${files.length} migration(s): no destructive statements found.`);
}

main();

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { format } from 'sql-formatter';

const root = path.resolve('supabase');
const config = JSON.parse(await readFile('.sql-formatter.json', 'utf8'));
const sqlFiles = [];

async function collectSqlFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await collectSqlFiles(fullPath);
    else if (entry.isFile() && entry.name.endsWith('.sql')) sqlFiles.push(fullPath);
  }
}

await collectSqlFiles(root);

let hasUnformattedFiles = false;
for (const file of sqlFiles) {
  const source = await readFile(file, 'utf8');
  const formatted = format(source, config);
  if (formatted.trimEnd() !== source.trimEnd()) {
    console.error(`${path.relative(process.cwd(), file)} needs SQL formatting.`);
    hasUnformattedFiles = true;
  }
}

if (hasUnformattedFiles) process.exitCode = 1;
else console.log(`All ${sqlFiles.length} SQL files are formatted.`);

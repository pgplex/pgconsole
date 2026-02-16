#!/usr/bin/env node
import { readFile, writeFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const genDir = join(__dirname, '..', 'src', 'gen');

const files = await readdir(genDir);
for (const file of files.filter(f => f.endsWith('.ts'))) {
  const path = join(genDir, file);
  const content = await readFile(path, 'utf-8');
  const fixed = content.replace(/from ["'](\.[^"']+)\.js["']/g, 'from "$1"');
  if (content !== fixed) {
    await writeFile(path, fixed);
  }
}

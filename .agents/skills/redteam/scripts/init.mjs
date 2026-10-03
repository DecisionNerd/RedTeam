/**
 * Scaffold for /redteam init. Creates .redteam/ (reviews/, sessions/, config.json,
 * CONTEXT.template.md) in the project directory without overwriting existing files.
 * Usage: node init.mjs [--dir <path>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATES = fileURLToPath(new URL('../templates/', import.meta.url));
const TEMPLATE_FILES = ['config.json', 'CONTEXT.template.md'];
const SUBDIRS = ['reviews', 'sessions'];

function parseDir(argv) {
  const i = argv.indexOf('--dir');
  return path.resolve(i !== -1 && argv[i + 1] ? argv[i + 1] : process.cwd());
}

function ensureDir(dir, label) {
  if (fs.existsSync(dir)) {
    if (!fs.statSync(dir).isDirectory()) throw new Error(`${label} exists and is not a directory`);
    console.log(`exists ${label}/`);
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  console.log(`created ${label}/`);
}

function copyIfMissing(src, dest, label) {
  try {
    // COPYFILE_EXCL: never overwrite, even if the file appears after a check.
    fs.copyFileSync(src, dest, fs.constants.COPYFILE_EXCL);
    console.log(`created ${label}`);
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    console.log(`exists ${label}`);
  }
}

function main() {
  const root = parseDir(process.argv.slice(2));
  const base = path.join(root, '.redteam');
  try {
    ensureDir(base, '.redteam');
    for (const sub of SUBDIRS) {
      ensureDir(path.join(base, sub), `.redteam/${sub}`);
    }
    for (const name of TEMPLATE_FILES) {
      copyIfMissing(path.join(TEMPLATES, name), path.join(base, name), `.redteam/${name}`);
    }
    console.log(`REDTEAM_SCAFFOLD_OK ${base}`);
  } catch (err) {
    console.error(`REDTEAM_SCAFFOLD_ERROR ${err.message}`);
    process.exit(1);
  }
}

main();

#!/usr/bin/env node
/**
 * Sync: propagate package.json metadata (version, GitHub owner/repo) to plugin
 * manifests, skill frontmatter, config templates, and documentation URLs.
 * Text replacements only (no JSON.stringify) so formatting is preserved.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, readMetadata, repoTextFiles } from './lib/metadata.mjs';

const JSON_VERSION_FILES = [
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  'skills/redteam/templates/config.json',
  '.redteam/config.json',
];
const LOCK_FILE = 'package-lock.json';
const SKILL_MD = 'skills/redteam/SKILL.md';
const URL_FIELD_FILES = {
  '.claude-plugin/plugin.json': ['homepage', 'repository'],
  '.claude-plugin/marketplace.json': ['homepage'],
};

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function rewriteVersion(rel, text, meta) {
  if (JSON_VERSION_FILES.includes(rel)) {
    return text.replace(/("version":\s*")[^"]*(")/g, `$1${meta.version}$2`);
  }
  if (rel === LOCK_FILE) {
    return text
      .replace(/^(  "version": ")[^"]*(")/m, `$1${meta.version}$2`)
      .replace(/("packages": \{\n    "": \{[\s\S]*?\n      "version": ")[^"]*(")/, `$1${meta.version}$2`);
  }
  if (rel === SKILL_MD) {
    // Only touch the frontmatter block, never a `version:` line in the body.
    return text.replace(/^---\n[\s\S]*?\n---/, (fm) => fm.replace(/^version: .*$/m, `version: ${meta.version}`));
  }
  return text;
}

function rewriteUrlFields(rel, text, meta) {
  let out = text;
  for (const field of URL_FIELD_FILES[rel] ?? []) {
    out = out.replace(new RegExp(`("${field}":\\s*")[^"]*(")`, 'g'), `$1${meta.repoUrl}$2`);
  }
  return out;
}

function rewriteOwner(text, meta) {
  const repo = escapeRegExp(meta.repo);
  return text
    .replace(new RegExp(`https?://github\\.com/[A-Za-z0-9_.-]+/${repo}(?=$|[/"'\\s)\\]>.,;:#?])`, 'g'), meta.repoUrl)
    .replace(
      new RegExp(`https?://[A-Za-z0-9-]+\\.github\\.io/${repo}(?![A-Za-z0-9_-])`, 'gi'),
      meta.pagesOrigin + meta.basePath,
    )
    .replace(
      new RegExp(`((?:skills add|marketplace add) )[A-Za-z0-9][A-Za-z0-9_.-]*/${repo}(?![A-Za-z0-9_-])`, 'g'),
      `$1${meta.slug}`,
    );
}

export function planChanges() {
  const meta = readMetadata();
  const changes = [];
  // package-lock.json is not a doc-text file, but its own version must follow package.json.
  for (const file of [...repoTextFiles(), path.join(ROOT, LOCK_FILE)]) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const before = fs.readFileSync(file, 'utf8');
    let after = rewriteVersion(rel, before, meta);
    after = rewriteUrlFields(rel, after, meta);
    // The lockfile only follows the version; its github.com URLs belong to dependencies.
    if (rel !== LOCK_FILE) after = rewriteOwner(after, meta);
    if (after !== before) changes.push({ file, before, after });
  }
  return changes;
}

function main() {
  const changes = planChanges();
  for (const { file, after } of changes) {
    fs.writeFileSync(file, after);
    console.log(`synced ${path.relative(ROOT, file)}`);
  }
  if (!changes.length) console.log('metadata already in sync');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  main();
}

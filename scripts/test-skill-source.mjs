#!/usr/bin/env node
/**
 * Offline guard for the installable skill source (skills/redteam/):
 * install-ready content, provider-copy drift, init scaffold, metadata drift
 * (package.json vs. manifests and URLs), stale references.
 * Set REDTEAM_E2E=1 to also run a real `npx skills add` from this repo.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROVIDERS } from './build.mjs';
import { readMetadata, repoTextFiles } from './lib/metadata.mjs';
import { planChanges } from './sync-metadata.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = path.join(ROOT, 'skills', 'redteam');
const PLACEHOLDER = /\{\{[^}]*\}\}/;

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full));
  }
  return out.sort();
}

function exists(rel, base = SKILL) {
  return fs.existsSync(path.join(base, rel));
}

function skillCommands() {
  const md = fs.readFileSync(path.join(SKILL, 'SKILL.md'), 'utf8');
  const cmds = [...md.matchAll(/^\| `([a-z0-9-]+)(?: \[target\])?` \|/gm)].map((m) => m[1]);
  return [...new Set(cmds)];
}

function pinCommands() {
  const src = fs.readFileSync(path.join(SKILL, 'scripts', 'pin.mjs'), 'utf8');
  const body = src.match(/const VALID_COMMANDS = \[([\s\S]*?)\];/);
  assert(body, 'VALID_COMMANDS not found in scripts/pin.mjs');
  return [...body[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function checkSkillMd() {
  assert(exists('SKILL.md'), 'skills/redteam/SKILL.md is missing');
  const md = fs.readFileSync(path.join(SKILL, 'SKILL.md'), 'utf8');
  const frontmatter = md.match(/^---\n([\s\S]*?)\n---/);
  assert(frontmatter && /^name: redteam$/m.test(frontmatter[1]), 'SKILL.md frontmatter must contain "name: redteam"');
}

function checkNoPlaceholders() {
  for (const rel of listFiles(SKILL)) {
    const text = fs.readFileSync(path.join(SKILL, rel), 'utf8');
    assert(!PLACEHOLDER.test(text), `unresolved {{...}} placeholder in skills/redteam/${rel}`);
  }
}

function checkRequiredFiles() {
  const required = [
    'SKILL.md',
    'reference/principles.md',
    'reference/ttp-catalog.md',
    'reference/init.md',
    'reference/extensions-catalog.md',
    'scripts/context.mjs',
    'scripts/pin.mjs',
    'scripts/init.mjs',
    'templates/config.json',
    'templates/CONTEXT.template.md',
  ];
  for (const rel of required) assert(exists(rel), `missing skills/redteam/${rel}`);
}

function checkCommands() {
  const cmds = skillCommands();
  assert(cmds.length > 0, 'no commands found in the SKILL.md command table');
  for (const cmd of cmds) assert(exists(`reference/${cmd}.md`), `command "${cmd}" has no reference/${cmd}.md`);
  const pin = pinCommands();
  const missing = cmds.filter((c) => !pin.includes(c));
  const extra = pin.filter((c) => !cmds.includes(c));
  assert(!missing.length && !extra.length, `pin.mjs VALID_COMMANDS differs from SKILL.md table (missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'})`);
}

function checkProviderCopies() {
  const srcFiles = listFiles(SKILL);
  for (const [name, rel] of Object.entries(PROVIDERS)) {
    const dest = path.join(ROOT, rel);
    const hint = 'run `npm run build`';
    assert(fs.existsSync(dest), `provider copy ${rel} (${name}) is missing; ${hint}`);
    const destFiles = listFiles(dest);
    assert(JSON.stringify(srcFiles) === JSON.stringify(destFiles), `file list of ${rel} differs from skills/redteam; ${hint}`);
    for (const file of srcFiles) {
      const same = fs.readFileSync(path.join(SKILL, file)).equals(fs.readFileSync(path.join(dest, file)));
      assert(same, `${rel}/${file} differs from skills/redteam; ${hint}`);
    }
  }
}

function run(script, cwd) {
  return execFileSync(process.execPath, [path.join(SKILL, 'scripts', script)], { cwd, encoding: 'utf8' });
}

function checkScaffoldAndContext(tmp) {
  const out = run('init.mjs', tmp).trim();
  assert(out.split('\n').pop().startsWith('REDTEAM_SCAFFOLD_OK'), `init.mjs did not end with REDTEAM_SCAFFOLD_OK:\n${out}`);
  const rt = path.join(tmp, '.redteam');
  for (const rel of ['config.json', 'CONTEXT.template.md', 'reviews', 'sessions']) {
    assert(fs.existsSync(path.join(rt, rel)), `init.mjs did not create .redteam/${rel}`);
  }
  fs.writeFileSync(path.join(rt, 'config.json'), '{"marker":true}');
  run('init.mjs', tmp);
  assert(fs.readFileSync(path.join(rt, 'config.json'), 'utf8') === '{"marker":true}', 'init.mjs overwrote an existing .redteam/config.json');
  assert(!fs.existsSync(path.join(tmp, 'CONTEXT.md')), 'init.mjs must not create CONTEXT.md');

  const ctx = run('context.mjs', tmp);
  assert(ctx.startsWith('NO_CONTEXT_MD'), `context.mjs should start with NO_CONTEXT_MD, got: ${ctx.slice(0, 80)}`);
}

function grepFiles(files, patterns) {
  const hits = [];
  for (const file of files) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (text.includes('\0')) continue;
    for (const re of patterns) {
      if (re.test(text)) hits.push(`${path.relative(ROOT, file)} matches ${re}`);
    }
  }
  return hits;
}

function relativeToRoot(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function checkVersionSites(meta) {
  const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  const lock = readJson('package-lock.json');
  const skillMd = fs.readFileSync(path.join(SKILL, 'SKILL.md'), 'utf8');
  const sites = {
    'package-lock.json version': lock.version,
    'package-lock.json packages[""].version': lock.packages?.['']?.version,
    '.claude-plugin/plugin.json': readJson('.claude-plugin/plugin.json').version,
    '.claude-plugin/marketplace.json': readJson('.claude-plugin/marketplace.json').plugins?.[0]?.version,
    'skills/redteam/templates/config.json': readJson('skills/redteam/templates/config.json').version,
    '.redteam/config.json': readJson('.redteam/config.json').version,
    'skills/redteam/SKILL.md frontmatter': skillMd.match(/^---\n[\s\S]*?\n---/)?.[0].match(/^version: (.*)$/m)?.[1],
  };
  for (const [site, version] of Object.entries(sites)) {
    assert(version === meta.version, `${site} is ${version}, package.json is ${meta.version}; run \`npm run sync\``);
  }
}

// Any github.com/<x>/<repo>, <x>.github.io/<repo>, or "skills add <x>/<repo>" with a different owner.
function checkOwnerTokens(meta, files) {
  const repo = meta.repo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tokens = [
    { re: new RegExp(`github\\.com/([A-Za-z0-9_.-]+)/${repo}(?![A-Za-z0-9_-])`, 'g'), owner: meta.owner },
    { re: new RegExp(`([A-Za-z0-9-]+)\\.github\\.io/${repo}(?![A-Za-z0-9_-])`, 'gi'), owner: meta.owner.toLowerCase() },
    { re: new RegExp(`(?:skills|marketplace) add ([A-Za-z0-9][A-Za-z0-9_.-]*)/${repo}(?![A-Za-z0-9_-])`, 'g'), owner: meta.owner },
  ];
  const hits = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const { re, owner } of tokens) {
      for (const match of text.matchAll(re)) {
        if (match[1] !== owner) hits.push(`${relativeToRoot(file)}: ${match[0]}`);
      }
    }
  }
  assert(!hits.length, `repository owner is not ${meta.owner} (from package.json); run \`npm run sync\` or fix:\n  ${hits.join('\n  ')}`);
}

function checkMetadata() {
  const meta = readMetadata();
  const files = repoTextFiles();
  assert(files.length > 0, 'no repository files found; git is required to run this test from a checkout');
  checkVersionSites(meta);
  const drifted = planChanges().map(({ file }) => relativeToRoot(file));
  assert(!drifted.length, `metadata drift in ${drifted.join(', ')}; run \`npm run sync\``);
  checkOwnerTokens(meta, files);
}

function checkStaleReferences() {
  const self = fileURLToPath(import.meta.url);
  const files = repoTextFiles().filter((file) => file !== self);
  assert(files.length > 0, 'no repository files found; git is required to run this test from a checkout');

  const docRoots = ['docs/', 'src/content/docs/', 'chatgpt/'];
  const docFiles = files.filter((file) => {
    const rel = relativeToRoot(file);
    return rel === 'README.md' || rel === 'AGENTS.md' || docRoots.some((root) => rel.startsWith(root));
  });
  const oldPath = [/blob\/main\/skill\//, /(?<![\w-])skill\/(?:reference|SKILL\.md|scripts)/];
  const pathHits = grepFiles(docFiles, oldPath);
  assert(!pathHits.length, `docs still reference the old skill/ path:\n  ${pathHits.join('\n  ')}`);

  const stale = [/scripts_path/, /cli\/bin\/cli\.js/, /test-cli-install/, /github:(?!…)[^ \n]*RedTeam install/];
  const staleHits = grepFiles(files, stale);
  assert(!staleHits.length, `stale references to the removed installer/templating:\n  ${staleHits.join('\n  ')}`);
}

function checkE2E() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'redteam-e2e-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: tmp });
    // npx is a .cmd shim on Windows, which execFileSync cannot launch without a shell.
    execFileSync('npx', ['--yes', 'skills', 'add', ROOT, '-y', '--copy', '-a', 'claude-code'], {
      cwd: tmp,
      stdio: 'pipe',
      shell: process.platform === 'win32',
    });
    const installed = path.join(tmp, '.claude', 'skills', 'redteam', 'SKILL.md');
    assert(fs.existsSync(installed), 'e2e: .claude/skills/redteam/SKILL.md was not installed');
    assert(!PLACEHOLDER.test(fs.readFileSync(installed, 'utf8')), 'e2e: installed SKILL.md contains {{...}} placeholders');
    assert(fs.existsSync(path.join(tmp, 'skills-lock.json')), 'e2e: skills-lock.json was not written');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function main() {
  checkSkillMd();
  checkNoPlaceholders();
  checkRequiredFiles();
  checkCommands();
  checkProviderCopies();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'redteam-init-'));
  try {
    checkScaffoldAndContext(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  checkMetadata();
  checkStaleReferences();
  if (process.env.REDTEAM_E2E) checkE2E();
  console.log('Skill source test passed.');
}

main();

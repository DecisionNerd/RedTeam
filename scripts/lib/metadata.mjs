/**
 * Single reader for project metadata. package.json is the source of truth for
 * version and repository owner/name; everything else is derived from it.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const REPO_PATTERN = /github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/;
const TEXT_EXTENSIONS = new Set([
  '.md', '.mdx', '.json', '.mjs', '.js', '.cjs', '.ts', '.yml', '.yaml', '.css', '.html', '.txt',
]);
const SKIP_FILES = new Set(['package.json', 'package-lock.json']);

export function readMetadata() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const url = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  const match = REPO_PATTERN.exec(url ?? '');
  if (!match) throw new Error(`package.json repository must be a github.com URL, got: ${url}`);
  const [, owner, repo] = match;
  const pagesOrigin = `https://${owner.toLowerCase()}.github.io`;
  const basePath = `/${repo}`;
  return {
    version: pkg.version,
    owner,
    repo,
    slug: `${owner}/${repo}`,
    repoUrl: `https://github.com/${owner}/${repo}`,
    pagesOrigin,
    basePath,
    siteUrl: `${pagesOrigin}${basePath}/`,
  };
}

// Tracked plus untracked-but-not-ignored text files, as absolute paths.
export function repoTextFiles() {
  let out;
  try {
    out = execFileSync('git', ['ls-files', '-z', '-co', '--exclude-standard'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    throw new Error(`git is required to enumerate repository files (${err.message})`);
  }
  return [...new Set(out.split('\0'))]
    .filter((rel) => rel && TEXT_EXTENSIONS.has(path.extname(rel)) && !SKIP_FILES.has(rel))
    .map((rel) => path.join(ROOT, rel))
    .filter((file) => fs.existsSync(file));
}

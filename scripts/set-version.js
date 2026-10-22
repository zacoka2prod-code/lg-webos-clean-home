#!/usr/bin/env node
//
// Write a version into every place this project keeps one, so they never drift.
// version.md is the build source of truth (scripts/read-version.js); the app
// manifests are stamped from it, but keeping the sources in step keeps diffs
// honest. Run with no argument after `npm version` (the lifecycle hook), or
// `node scripts/set-version.js <x.y.z>` / `npm run version:set -- <x.y.z>`.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

function writeJson(rel, value) {
  fs.writeFileSync(path.join(root, rel), JSON.stringify(value, null, 2) + '\n');
}

// An explicit argument wins: under `npm run`, npm_package_version is the
// current version, not the one asked for.
const version = process.argv[2] || process.env.npm_package_version || readJson('package.json').version;
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Invalid version: ' + version + ' (expected x.y.z)');
  process.exit(1);
}

// build.js reads this and stamps dist/appinfo.json and the voice card.
fs.writeFileSync(path.join(root, 'version.md'), version + '\n');

// Keep npm's own version fields aligned when invoked directly rather than via
// the `version` lifecycle hook (which npm already bumped).
const pkg = readJson('package.json');
if (pkg.version !== version) {
  pkg.version = version;
  writeJson('package.json', pkg);
}
const lock = readJson('package-lock.json');
if (lock.version !== version || (lock.packages && lock.packages[''] && lock.packages[''].version !== version)) {
  lock.version = version;
  if (lock.packages && lock.packages['']) lock.packages[''].version = version;
  writeJson('package-lock.json', lock);
}

// Source manifests. build.js overrides these at pack time; syncing the sources
// keeps the checked-in defaults truthful.
for (const rel of ['appinfo.json', 'voice/overlay/appinfo.json']) {
  const info = readJson(rel);
  if (info.version !== version) {
    info.version = version;
    writeJson(rel, info);
  }
}

console.log('Version set to ' + version);

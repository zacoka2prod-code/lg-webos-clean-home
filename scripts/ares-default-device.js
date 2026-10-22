#!/usr/bin/env node

// Resolve the default ares device from ares's own config (~/.webos/*/novacom-devices.json)
// and print it as tab-separated fields for shell consumption:
//   name<TAB>host<TAB>port<TAB>user<TAB>key<TAB>password
//
// Set ARES_DEVICE to resolve a specific device instead of the default one.

const fs = require('fs');
const os = require('os');
const path = require('path');

function findConfigs(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, {withFileTypes: true});
    } catch (err) {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.name === 'novacom-devices.json') {
        out.push(full);
      }
    }
  }
  return out;
}

function loadDevices() {
  const devices = [];
  for (const config of findConfigs(path.join(os.homedir(), '.webos'))) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(config, 'utf8'));
    } catch (err) {
      continue;
    }
    if (Array.isArray(parsed)) devices.push(...parsed);
  }
  return devices;
}

function isDefault(device) {
  return device.default === true || device.default === 'true';
}

function main() {
  const wanted = process.env.ARES_DEVICE || '';
  const devices = loadDevices();

  let device;
  if (wanted) {
    device = devices.find((d) => d.name === wanted);
  } else {
    device = devices.find(isDefault);
  }

  if (!device) {
    const what = wanted ? `named "${wanted}"` : 'marked as default';
    process.stderr.write(`No ares device ${what} found under ~/.webos\n`);
    process.exit(1);
  }

  const key = (device.privateKey && (device.privateKey.openSsh || device.privateKey.openssh)) || '';
  const fields = [
    device.name || '',
    device.host || '',
    device.port || '',
    device.username || 'root',
    key,
    device.password || ''
  ];
  process.stdout.write(fields.join('\t'));
}

main();

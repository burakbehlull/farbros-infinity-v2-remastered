import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_FILE = path.join(__dirname, '..', 'data', 'yt_backups.json');

function ensureFile() {
  if (!fs.existsSync(path.dirname(BACKUP_FILE))) {
    fs.mkdirSync(path.dirname(BACKUP_FILE), { recursive: true });
  }
  if (!fs.existsSync(BACKUP_FILE)) {
    fs.writeFileSync(BACKUP_FILE, JSON.stringify({}, null, 2), 'utf-8');
  }
}

function readAll() {
  ensureFile();
  try {
    const raw = fs.readFileSync(BACKUP_FILE, 'utf-8');
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function writeAll(obj) {
  ensureFile();
  fs.writeFileSync(BACKUP_FILE, JSON.stringify(obj, null, 2), 'utf-8');
}

export function saveRoleBackup(guildId, permissionsBitfield, rolePermissionsMap) {
  const all = readAll();
  all[guildId] = {
    savedAt: Date.now(),
    permissionsBitfield: String(permissionsBitfield),
    roles: rolePermissionsMap,
  };
  writeAll(all);
  return all[guildId];
}

export function getRoleBackup(guildId) {
  const all = readAll();
  return all[guildId] || null;
}

export function clearRoleBackup(guildId) {
  const all = readAll();
  if (all[guildId]) {
    delete all[guildId];
    writeAll(all);
    return true;
  }
  return false;
}

export default {
  saveRoleBackup,
  getRoleBackup,
  clearRoleBackup,
};

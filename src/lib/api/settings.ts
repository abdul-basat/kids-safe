import { db, type DBSettings } from '../indexedDB';

export type Settings = DBSettings;

export async function getSettings(): Promise<Settings | null> {
  return db.getSettings();
}

export async function createSettings(pinHash: string): Promise<Settings> {
  const settings: Settings = {
    id: db.generateId(),
    pin_hash: pinHash,
    daily_limit_minutes: 60,
    created_at: db.getTimestamp(),
    updated_at: db.getTimestamp(),
  };
  return db.saveSettings(settings);
}

export async function updatePinHash(settingsId: string, pinHash: string): Promise<void> {
  const settings = await db.getSettings();
  if (settings && settings.id === settingsId) {
    settings.pin_hash = pinHash;
    settings.updated_at = db.getTimestamp();
    await db.saveSettings(settings);
  }
}

export async function updateDailyLimit(settingsId: string, minutes: number): Promise<void> {
  const settings = await db.getSettings();
  if (settings && settings.id === settingsId) {
    settings.daily_limit_minutes = minutes;
    settings.updated_at = db.getTimestamp();
    await db.saveSettings(settings);
  }
}

// Local PIN hashing using Web Crypto API
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'kidsafe-salt-v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPin(inputPin: string, storedHash: string): Promise<boolean> {
  const inputHash = await hashPin(inputPin);
  return inputHash === storedHash;
}

import { db, type DBSettings } from '../indexedDB';
import { generateSecureSalt, secureHash, isValidPin } from '../security';

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

export async function updatePinHash(settingsId: string, pinHash: string | null): Promise<void> {
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

// Enhanced PIN hashing with secure salt
export async function hashPin(pin: string): Promise<string> {
  // Validate PIN format
  if (!isValidPin(pin)) {
    throw new Error('Invalid PIN format');
  }
  
  // Generate secure random salt
  const salt = await generateSecureSalt();
  const hash = await secureHash(pin, salt);
  
  // Store salt and hash together (salt.hash format)
  return `${salt}.${hash}`;
}

export async function verifyPin(inputPin: string, storedHash: string): Promise<boolean> {
  // Validate input PIN format
  if (!isValidPin(inputPin)) {
    return false;
  }
  
  // Parse stored hash (salt.hash format)
  const parts = storedHash.split('.');
  if (parts.length !== 2) {
    return false;
  }
  
  const [storedSalt, storedPinHash] = parts;
  const inputHash = await secureHash(inputPin, storedSalt);
  
  return inputHash === storedPinHash;
}

// Time tracking utilities for screen time management

import { db, type DBSettings, type DBChildProfile } from './indexedDB';

/**
 * Checks if current time is within allowed viewing hours
 * @param settings - Current settings with time restrictions
 * @returns boolean indicating if viewing is allowed
 */
export function isWithinAllowedHours(settings: DBSettings): boolean {
  if (!settings.bedtime_hour || !settings.wake_time_hour) {
    return true; // No time restrictions set
  }

  const now = new Date();
  const currentHour = now.getHours();
  
  const bedtime = settings.bedtime_hour;
  const wakeTime = settings.wake_time_hour;

  // Handle overnight periods (bedtime > wake time)
  if (bedtime > wakeTime) {
    return currentHour >= bedtime || currentHour < wakeTime;
  } else {
    // Same day period (bedtime < wake time)
    return currentHour >= bedtime && currentHour < wakeTime;
  }
}

/**
 * Checks if daily time limit has been reached
 * @param settings - Current settings with time limits
 * @returns boolean indicating if time limit is reached
 */
export function isTimeLimitReached(settings: DBSettings): boolean {
  if (!settings.daily_limit_minutes) {
    return false; // No time limit set
  }

  const today = new Date().toISOString().split('T')[0];
  const lastViewedDate = settings.last_viewed_date?.split('T')[0];
  
  // Check if it's a new day
  if (lastViewedDate !== today) {
    return false;
  }

  const timeUsed = settings.daily_time_used || 0;
  return timeUsed >= settings.daily_limit_minutes;
}

/**
 * Calculates remaining time for today
 * @param settings - Current settings
 * @returns number of minutes remaining
 */
export function getRemainingTimeToday(settings: DBSettings): number {
  if (!settings.daily_limit_minutes) {
    return Infinity; // Unlimited
  }

  const today = new Date().toISOString().split('T')[0];
  const lastViewedDate = settings.last_viewed_date?.split('T')[0];
  
  // If it's a new day, full time is available
  if (lastViewedDate !== today) {
    return settings.daily_limit_minutes;
  }

  const timeUsed = settings.daily_time_used || 0;
  return Math.max(0, settings.daily_limit_minutes - timeUsed);
}

/**
 * Updates time usage for current session
 * @param settingsId - Settings ID to update
 * @param minutesToAdd - Minutes to add to usage
 */
export async function updateTimeUsage(settingsId: string, minutesToAdd: number): Promise<void> {
  const settings = await db.getSettings();
  if (!settings || settings.id !== settingsId) return;

  const today = new Date().toISOString().split('T')[0];
  const lastViewedDate = settings.last_viewed_date?.split('T')[0];

  // Reset daily counter if it's a new day
  if (lastViewedDate !== today) {
    settings.last_viewed_date = new Date().toISOString();
    settings.daily_time_used = minutesToAdd;
  } else {
    settings.daily_time_used = (settings.daily_time_used || 0) + minutesToAdd;
  }

  settings.updated_at = db.getTimestamp();
  await db.saveSettings(settings);
}

/**
 * Starts a new viewing session
 * @param settingsId - Settings ID
 */
export async function startSession(settingsId: string): Promise<void> {
  const settings = await db.getSettings();
  if (!settings || settings.id !== settingsId) return;

  settings.session_start_time = new Date().toISOString();
  settings.updated_at = db.getTimestamp();
  await db.saveSettings(settings);
}

/**
 * Ends current session and updates usage
 * @param settingsId - Settings ID
 */
export async function endSession(settingsId: string): Promise<void> {
  const settings = await db.getSettings();
  if (!settings || settings.id !== settingsId || !settings.session_start_time) return;

  const sessionStart = new Date(settings.session_start_time);
  const sessionEnd = new Date();
  const sessionMinutes = Math.floor((sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60));

  if (sessionMinutes > 0) {
    await updateTimeUsage(settingsId, sessionMinutes);
  }

  settings.session_start_time = undefined;
  settings.updated_at = db.getTimestamp();
  await db.saveSettings(settings);
}

/**
 * Gets formatted time display
 * @param minutes - Number of minutes
 * @returns formatted time string (e.g., "2h 30m" or "45m")
 */
export function formatTimeDisplay(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Checks if current day is weekend
 * @returns boolean indicating if it's Saturday or Sunday
 */
export function isWeekend(): boolean {
  const day = new Date().getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

/**
 * Gets adjusted time limit based on day type
 * @param baseLimit - Base daily limit in minutes
 * @param weekendMultiplier - Multiplier for weekends (default: 1.0)
 * @returns adjusted time limit
 */
export function getAdjustedTimeLimit(baseLimit: number, weekendMultiplier: number = 1.0): number {
  if (isWeekend()) {
    return Math.round(baseLimit * weekendMultiplier);
  }
  return baseLimit;
}
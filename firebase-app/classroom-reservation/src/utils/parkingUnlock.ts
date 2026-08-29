const STORAGE_KEY = 'owa-cbs-parking-unlocked';

function normalizePasscode(value: string): string {
  return String(value || '').trim().toUpperCase();
}

export function isParkingSessionUnlocked(passcode: string): boolean {
  const expected = normalizePasscode(passcode);
  if (!expected) return false;
  try {
    return normalizePasscode(sessionStorage.getItem(STORAGE_KEY) || '') === expected;
  } catch {
    return false;
  }
}

export function unlockParkingSession(passcode: string): void {
  const value = normalizePasscode(passcode);
  if (!value) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, value);
  } catch {
    // プライベートモード等で書けなくても、今回の画面表示は親の state で継続する
  }
}

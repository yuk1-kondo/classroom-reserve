import { SystemSettings } from './settings';

let snapshot: SystemSettings | null = null;

export function setSettingsSnapshot(s: SystemSettings | null) {
  snapshot = s ?? null;
}

export function getSettingsSnapshot(): SystemSettings | null {
  return snapshot;
}




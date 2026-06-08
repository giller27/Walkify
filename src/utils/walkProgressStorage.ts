export const WALK_PROGRESS_STORAGE_KEY = 'walkify_walk_progress';

export interface WalkProgressState {
  traveledKm: number;
  routeDistanceKm: number;
  startedAt: string;
  updatedAt: string;
  isActive: boolean;
}

function readRaw(): WalkProgressState | null {
  try {
    const raw = localStorage.getItem(WALK_PROGRESS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WalkProgressState;
    if (typeof parsed.traveledKm !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadWalkProgress(): WalkProgressState | null {
  return readRaw();
}

export function saveWalkProgress(state: WalkProgressState): void {
  localStorage.setItem(WALK_PROGRESS_STORAGE_KEY, JSON.stringify(state));
}

/** Поточна пройдена відстань (км) з localStorage. */
export function getTraveledDistanceKm(): number {
  return loadWalkProgress()?.traveledKm ?? 0;
}

export function startWalkProgressSession(routeDistanceKm: number): WalkProgressState {
  const now = new Date().toISOString();
  const state: WalkProgressState = {
    traveledKm: 0,
    routeDistanceKm,
    startedAt: now,
    updatedAt: now,
    isActive: true,
  };
  saveWalkProgress(state);
  return state;
}

export function updateWalkProgressTraveledKm(
  traveledKm: number,
  routeDistanceKm?: number
): WalkProgressState {
  const existing = loadWalkProgress();
  const now = new Date().toISOString();

  const state: WalkProgressState = {
    traveledKm: Math.max(0, traveledKm),
    routeDistanceKm: routeDistanceKm ?? existing?.routeDistanceKm ?? 0,
    startedAt: existing?.startedAt ?? now,
    updatedAt: now,
    isActive: existing?.isActive ?? true,
  };

  saveWalkProgress(state);
  return state;
}

/** Завершити активну сесію, зберегти пройдену відстань для статистики. */
export function finishWalkProgressSession(): WalkProgressState | null {
  const existing = loadWalkProgress();
  if (!existing) return null;

  const state: WalkProgressState = {
    ...existing,
    updatedAt: new Date().toISOString(),
    isActive: false,
  };
  saveWalkProgress(state);
  return state;
}

export function clearWalkProgress(): void {
  localStorage.removeItem(WALK_PROGRESS_STORAGE_KEY);
}

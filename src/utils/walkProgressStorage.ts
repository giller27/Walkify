export const WALK_PROGRESS_STORAGE_KEY = 'walkify_walk_progress';
export const WALK_PENDING_STATS_KEY = 'walkify_pending_walk_stats';

const MIN_WALK_DISTANCE_KM = 0.05;

export interface WalkProgressState {
  sessionId: string;
  traveledKm: number;
  routeDistanceKm: number;
  startedAt: string;
  updatedAt: string;
  /** Час активного руху (сек), без пауз */
  activeDurationSeconds: number;
  lastMovingAt?: string;
  lastRecordedTraveledKm?: number;
  isActive: boolean;
  syncedToServer: boolean;
  routeId?: string;
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `walk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readRaw(): WalkProgressState | null {
  try {
    const raw = localStorage.getItem(WALK_PROGRESS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WalkProgressState;
    if (typeof parsed.traveledKm !== 'number') return null;
    return {
      ...parsed,
      sessionId: parsed.sessionId ?? createSessionId(),
      syncedToServer: parsed.syncedToServer ?? false,
      activeDurationSeconds: parsed.activeDurationSeconds ?? 0,
    };
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

export function loadPendingWalkStats(): WalkProgressState[] {
  try {
    const raw = localStorage.getItem(WALK_PENDING_STATS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WalkProgressState[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s) => typeof s.traveledKm === 'number' && s.sessionId);
  } catch {
    return [];
  }
}

function savePendingWalkStats(sessions: WalkProgressState[]): void {
  localStorage.setItem(WALK_PENDING_STATS_KEY, JSON.stringify(sessions));
}

export function enqueuePendingWalkStat(state: WalkProgressState): void {
  const pending = loadPendingWalkStats().filter((s) => s.sessionId !== state.sessionId);
  pending.push({ ...state, isActive: false, syncedToServer: false });
  savePendingWalkStats(pending);
}

export function markPendingWalkStatSynced(sessionId: string): void {
  const pending = loadPendingWalkStats().filter((s) => s.sessionId !== sessionId);
  savePendingWalkStats(pending);
}

export function startWalkProgressSession(
  routeDistanceKm: number,
  routeId?: string
): WalkProgressState {
  const previous = loadWalkProgress();
  if (previous?.isActive && previous.traveledKm >= MIN_WALK_DISTANCE_KM) {
    enqueuePendingWalkStat({ ...previous, isActive: false, updatedAt: new Date().toISOString() });
  }

  const now = new Date().toISOString();
  const state: WalkProgressState = {
    sessionId: createSessionId(),
    traveledKm: 0,
    routeDistanceKm,
    startedAt: now,
    updatedAt: now,
    activeDurationSeconds: 0,
    isActive: true,
    syncedToServer: false,
    routeId,
  };
  saveWalkProgress(state);
  return state;
}

const MOVEMENT_THRESHOLD_KM = 0.005;
const MAX_SEGMENT_SECONDS = 30;

export function updateWalkProgressTraveledKm(
  traveledKm: number,
  routeDistanceKm?: number
): WalkProgressState {
  const existing = loadWalkProgress();
  const nowDate = new Date();
  const now = nowDate.toISOString();

  const prevKm = existing?.lastRecordedTraveledKm ?? existing?.traveledKm ?? 0;
  const movedKm = Math.max(0, traveledKm - prevKm);
  let activeDurationSeconds = existing?.activeDurationSeconds ?? 0;
  let lastMovingAt = existing?.lastMovingAt;

  if (movedKm >= MOVEMENT_THRESHOLD_KM) {
    const lastTickMs = lastMovingAt
      ? new Date(lastMovingAt).getTime()
      : new Date(existing?.startedAt ?? now).getTime();
    const deltaSec = Math.min(
      MAX_SEGMENT_SECONDS,
      Math.max(0, (nowDate.getTime() - lastTickMs) / 1000)
    );
    if (deltaSec > 0) {
      activeDurationSeconds += deltaSec;
    }
    lastMovingAt = now;
  }

  const state: WalkProgressState = {
    sessionId: existing?.sessionId ?? createSessionId(),
    traveledKm: Math.max(0, traveledKm),
    routeDistanceKm: routeDistanceKm ?? existing?.routeDistanceKm ?? 0,
    startedAt: existing?.startedAt ?? now,
    updatedAt: now,
    activeDurationSeconds,
    lastMovingAt,
    lastRecordedTraveledKm: Math.max(traveledKm, prevKm),
    isActive: existing?.isActive ?? true,
    syncedToServer: existing?.syncedToServer ?? false,
    routeId: existing?.routeId,
  };

  saveWalkProgress(state);
  return state;
}

/** Завершити активну сесію і поставити в чергу на синхронізацію з сервером. */
export function finishWalkProgressSession(): WalkProgressState | null {
  const existing = loadWalkProgress();
  if (!existing) return null;

  const state: WalkProgressState = {
    ...existing,
    updatedAt: new Date().toISOString(),
    isActive: false,
  };
  saveWalkProgress(state);

  if (state.traveledKm >= MIN_WALK_DISTANCE_KM) {
    enqueuePendingWalkStat(state);
  }

  return state;
}

export function clearWalkProgress(): void {
  localStorage.removeItem(WALK_PROGRESS_STORAGE_KEY);
}

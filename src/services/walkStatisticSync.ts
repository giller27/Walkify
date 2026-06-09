import { addWalkStatistic, WalkStatistic } from './supabaseService';
import {
  WalkProgressState,
  loadPendingWalkStats,
  markPendingWalkStatSynced,
} from '../utils/walkProgressStorage';
import { WALKING_SPEED_KMH } from './waypointOptimizer';

const MIN_SYNC_DISTANCE_KM = 0.05;

function getActiveDurationMinutes(state: WalkProgressState, distanceKm: number): number {
  if (state.activeDurationSeconds > 0) {
    return Math.max(1, Math.round(state.activeDurationSeconds / 60));
  }
  return Math.max(1, Math.round((distanceKm / WALKING_SPEED_KMH) * 60));
}

/** Швидкість: км / год */
function calcSpeedKmh(distanceKm: number, durationMinutes: number): number {
  if (durationMinutes <= 0) return 0;
  return parseFloat((distanceKm / (durationMinutes / 60)).toFixed(2));
}

export interface WalkSessionMeta {
  sessionId: string;
  routeDistanceKm: number;
  completionPercent: number;
}

/** Перетворити локальну сесію прогулянки у формат walk_statistics. */
export function walkProgressToWalkStatistic(state: WalkProgressState): WalkStatistic {
  const start = new Date(state.startedAt);

  const distanceKm = parseFloat(
    Math.min(state.traveledKm, state.routeDistanceKm || state.traveledKm).toFixed(2)
  );
  const durationMinutes = getActiveDurationMinutes(state, distanceKm);
  const pace = calcSpeedKmh(distanceKm, durationMinutes);

  const completionPercent =
    state.routeDistanceKm > 0
      ? Math.min(100, Math.round((state.traveledKm / state.routeDistanceKm) * 100))
      : 0;

  const meta: WalkSessionMeta = {
    sessionId: state.sessionId,
    routeDistanceKm: state.routeDistanceKm,
    completionPercent,
  };

  return {
    route_id: state.routeId,
    date: start.toISOString().split('T')[0],
    distance_km: distanceKm,
    duration_minutes: durationMinutes,
    pace,
    notes: JSON.stringify(meta),
  };
}

export async function syncWalkSessionToServer(state: WalkProgressState): Promise<void> {
  if (state.traveledKm < MIN_SYNC_DISTANCE_KM) return;
  if (state.syncedToServer) return;

  const stat = walkProgressToWalkStatistic(state);
  await addWalkStatistic(stat);
  markPendingWalkStatSynced(state.sessionId);
}

export interface SyncPendingResult {
  synced: number;
  skipped: number;
  failed: number;
}

/** Відправити всі несинхронізовані прогулянки з localStorage на сервер. */
export async function syncPendingWalkStatistics(): Promise<SyncPendingResult> {
  const pending = loadPendingWalkStats();
  const result: SyncPendingResult = { synced: 0, skipped: 0, failed: 0 };

  for (const session of pending) {
    if (session.syncedToServer) {
      result.skipped++;
      continue;
    }
    if (session.traveledKm < MIN_SYNC_DISTANCE_KM) {
      markPendingWalkStatSynced(session.sessionId);
      result.skipped++;
      continue;
    }

    try {
      await syncWalkSessionToServer(session);
      result.synced++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('not authenticated')) {
        break;
      }
      console.error('[Walkify] Помилка синхронізації статистики:', error);
      result.failed++;
    }
  }

  return result;
}

import { addWalkStatistic, WalkStatistic } from './supabaseService';
import {
  WalkProgressState,
  loadPendingWalkStats,
  markPendingWalkStatSynced,
} from '../utils/walkProgressStorage';

const MIN_SYNC_DISTANCE_KM = 0.05;

export interface WalkSessionMeta {
  sessionId: string;
  routeDistanceKm: number;
  completionPercent: number;
}

/** Перетворити локальну сесію прогулянки у формат walk_statistics. */
export function walkProgressToWalkStatistic(state: WalkProgressState): WalkStatistic {
  const start = new Date(state.startedAt);
  const end = new Date(state.updatedAt);
  const durationMs = Math.max(end.getTime() - start.getTime(), 60_000);
  const durationMinutes = Math.max(1, Math.round(durationMs / 60_000));

  const distanceKm = parseFloat(
    Math.min(state.traveledKm, state.routeDistanceKm || state.traveledKm).toFixed(2)
  );
  const pace =
    durationMinutes > 0
      ? parseFloat(((distanceKm / durationMinutes) * 60).toFixed(2))
      : 0;

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

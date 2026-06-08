import { getDistanceKm, distanceToTimeMinutes } from '../services/waypointOptimizer';

export interface RouteProgressStats {
  remainingDistanceKm: number;
  remainingTimeMinutes: number;
}

/** Cumulative path distance between point indices (inclusive start, exclusive end segment pairs) */
export function calculatePathDistanceKm(
  routePoints: [number, number][],
  fromIdx: number,
  toIdx: number
): number {
  if (routePoints.length < 2 || fromIdx >= toIdx) return 0;

  const start = Math.max(0, fromIdx);
  const end = Math.min(routePoints.length - 1, toIdx);
  let total = 0;

  for (let i = start; i < end; i++) {
    const p1 = routePoints[i];
    const p2 = routePoints[i + 1];
    total += getDistanceKm([p1[1], p1[0]], [p2[1], p2[0]]);
  }

  return total;
}

/** Remaining distance/time from current progress along the route */
export function calculateRemainingRouteStats(
  route: {
    points: [number, number][];
    steps?: { distanceMeters: number; durationSeconds: number }[];
    distanceKm: number;
    estimatedTimeMinutes: number;
  },
  progressIndex: number,
  stepIndex?: number
): RouteProgressStats {
  if (route.steps?.length && stepIndex !== undefined) {
    let distanceMeters = 0;
    let durationSeconds = 0;
    for (let i = stepIndex; i < route.steps.length; i++) {
      distanceMeters += route.steps[i].distanceMeters;
      durationSeconds += route.steps[i].durationSeconds;
    }
    return {
      remainingDistanceKm: parseFloat((distanceMeters / 1000).toFixed(2)),
      remainingTimeMinutes: Math.max(0, Math.round(durationSeconds / 60)),
    };
  }

  const remainingDistanceKm = calculatePathDistanceKm(
    route.points,
    progressIndex,
    route.points.length - 1
  );
  const remainingTimeMinutes =
    route.distanceKm > 0
      ? Math.max(0, Math.round(route.estimatedTimeMinutes * (remainingDistanceKm / route.distanceKm)))
      : distanceToTimeMinutes(remainingDistanceKm);

  return {
    remainingDistanceKm: parseFloat(remainingDistanceKm.toFixed(2)),
    remainingTimeMinutes,
  };
}

export function formatRemainingRouteSummary(
  stats: RouteProgressStats,
  difficulty?: string
): string {
  const diffStr = difficulty ? ` · ${difficulty}` : '';
  if (stats.remainingDistanceKm < 0.05) {
    return `Майже на місці${diffStr}`;
  }
  return `${stats.remainingDistanceKm} км · ~${stats.remainingTimeMinutes} хв залишилось${diffStr}`;
}

/** Find index of closest point on route to user position */
export function findClosestPointIndex(
  routePoints: [number, number][],
  userLngLat: [number, number]
): number {
  if (routePoints.length === 0) return 0;

  let minDist = Infinity;
  let closestIdx = 0;

  for (let i = 0; i < routePoints.length; i++) {
    const pt = routePoints[i];
    const dist = getDistanceKm(userLngLat, [pt[1], pt[0]]);
    if (dist < minDist) {
      minDist = dist;
      closestIdx = i;
    }
  }

  return closestIdx;
}

/** Find current step index based on proximity to step end points and route progress */
export function findCurrentStepIndex(
  steps: { endLocation: [number, number] }[],
  userLatLng: [number, number],
  routeProgressIndex: number,
  totalRoutePoints: number
): number {
  if (steps.length === 0) return 0;

  const userLngLat: [number, number] = [userLatLng[1], userLatLng[0]];
  let bestIdx = 0;

  for (let i = 0; i < steps.length; i++) {
    const stepEnd = steps[i].endLocation;
    const dist = getDistanceKm(userLngLat, [stepEnd[1], stepEnd[0]]);
    if (dist < 0.04) {
      bestIdx = Math.min(i + 1, steps.length - 1);
    }
  }

  const progressRatio = routeProgressIndex / Math.max(1, totalRoutePoints - 1);
  const stepFromProgress = Math.floor(progressRatio * steps.length);
  return Math.max(bestIdx, Math.min(stepFromProgress, steps.length - 1));
}

export function stripHtml(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, '');
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent?.trim() || '';
}

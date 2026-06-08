import { getDistanceKm } from '../services/waypointOptimizer';

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

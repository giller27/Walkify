import type { RouteResult } from '../services/routeService';
import type { SavedRoute } from '../services/supabaseService';

export function buildSavedRouteFromResult(
  route: RouteResult,
  name: string,
  description?: string
): SavedRoute {
  return {
    name: name.trim(),
    description: description?.trim() || undefined,
    points: route.points,
    waypoints: route.waypoints.map((wp) => ({
      location: wp.location,
      name: wp.name,
      type: wp.type,
      address: wp.address,
      rating: wp.rating,
      userRatingsTotal: wp.userRatingsTotal,
      externalId: wp.externalId,
      source: wp.source === 'google' ? 'google' : 'custom',
    })),
    statistics: {
      distanceKm: route.distanceKm,
      estimatedTimeMinutes: route.estimatedTimeMinutes,
    },
    preferences: {
      locations: route.locations,
      ...(route.steps ? { steps: route.steps } : {}),
    } as SavedRoute['preferences'],
    difficulty: route.difficulty,
    is_public: false,
  };
}

export function getDefaultRouteName(route: RouteResult): string {
  if (route.locations.length > 0) {
    return route.locations.slice(0, 3).join(' · ').slice(0, 80);
  }
  return `Прогулянка ${new Date().toLocaleDateString('uk-UA')}`;
}

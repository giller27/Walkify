import type { RouteResult, PoiCategory } from '../services/routeService';
import type { SavedRoute } from '../services/supabaseService';
import type { RouteDifficulty } from '../types/routeEnhancements';

type SavedWaypointType = NonNullable<SavedRoute['waypoints']>[number]['type'];

const SAVED_WAYPOINT_TYPES = new Set<SavedWaypointType>([
  'cafe', 'park', 'shop', 'restaurant', 'museum', 'library',
  'place_of_worship', 'beach', 'lake', 'river', 'custom',
]);

function toSavedWaypointType(type: PoiCategory): SavedWaypointType {
  return SAVED_WAYPOINT_TYPES.has(type as SavedWaypointType)
    ? (type as SavedWaypointType)
    : 'custom';
}

function toSavedDifficulty(difficulty?: RouteDifficulty): SavedRoute['difficulty'] {
  switch (difficulty) {
    case 'Easy':
      return 'easy';
    case 'Moderate':
      return 'moderate';
    case 'Challenging':
      return 'hard';
    default:
      return undefined;
  }
}

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
      type: toSavedWaypointType(wp.type),
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
    difficulty: toSavedDifficulty(route.difficulty),
    is_public: false,
  };
}

export function getDefaultRouteName(route: RouteResult): string {
  if (route.locations.length > 0) {
    return route.locations.slice(0, 3).join(' · ').slice(0, 80);
  }
  return `Прогулянка ${new Date().toLocaleDateString('uk-UA')}`;
}

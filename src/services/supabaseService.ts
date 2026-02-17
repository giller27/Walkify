import { createClient } from '@supabase/supabase-js';

// Ініціалізація Supabase клієнта
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Логування для дебаггінгу
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase credentials:', {
    url: !!SUPABASE_URL,
    key: !!SUPABASE_ANON_KEY,
    env: {
      importMeta: {
        url: !!import.meta.env.VITE_SUPABASE_URL,
        key: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
      }
    }
  });
  throw new Error('Missing Supabase credentials in .env.local. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    detectSessionInUrl: true,
  },
});

// ============ ТИПИ ДАНИХ ============

export interface SavedRoute {
  id?: string;
  user_id?: string;
  name: string;
  description?: string;
  points: [number, number][]; // [lat, lng]
  waypoints?: {
    location: [number, number];
    name: string;
    type:
      | 'cafe'
      | 'park'
      | 'shop'
      | 'restaurant'
      | 'museum'
      | 'library'
      | 'place_of_worship'
      | 'beach'
      | 'lake'
      | 'river'
      | 'custom';
    address?: string;
    rating?: number;
    userRatingsTotal?: number;
    photoUrl?: string;
    description?: string;
    source?: 'mapbox' | 'osm' | 'google_like' | 'custom';
  }[];
  statistics: {
    distanceKm: number;
    estimatedTimeMinutes: number;
    elevationGain?: number;
  };
  preferences?: {
    locations: string[];
    prompt?: string;
  };
  geo_json?: any;
  tags?: string[];
  difficulty?: 'easy' | 'moderate' | 'hard';
  is_public?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  total_walks?: number;
  total_distance?: number;
  total_time?: number;
  average_pace?: number;
  created_at?: string;
  updated_at?: string;
}

export interface WalkStatistic {
  id?: string;
  user_id?: string;
  route_id?: string;
  date: string;
  distance_km: number;
  duration_minutes: number;
  pace: number; // km/h
  calories?: number;
  steps?: number;
  elevation_gain?: number;
  weather?: string;
  mood?: string;
  notes?: string;
  created_at?: string;
}

// ============ АУТЕНТИФІКАЦІЯ ============

/**
 * Реєстрація нового користувача
 */
export async function signUp(email: string, password: string, fullName?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) throw error;
  
  // Створити профіль користувача
  if (data.user) {
    await createUserProfile(data.user.id, email, fullName);
  }

  return data;
}

/**
 * Вхід користувача
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

/**
 * Вхід через Google
 * Використовує VITE_SITE_URL якщо задано (для Vercel), інакше window.location.origin
 */
export async function signInWithGoogle() {
  const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
  const redirectTo = `${siteUrl.replace(/\/$/, '')}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
    },
  });

  if (error) throw error;
  
  // signInWithOAuth повертає URL для redirect, не user об'єкт
  // Користувач буде отриманий в auth callback сторінці
  return data;
}

/**
 * Вихід користувача
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Отримати поточного користувача
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

/**
 * Отримати сесію
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

/**
 * Спостерігати за змінами аутентифікації
 */
export function onAuthStateChange(callback: (user: any) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null);
  });
}

// ============ ПРОФІЛЬ КОРИСТУВАЧА ============

/**
 * Перевірити чи нікнейм унікальний
 */
export async function isEmailUnique(email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  // Якщо помилка - нікнейм унікальний
  if (error && error.code === 'PGRST116') {
    return true;
  }
  
  // Якщо дані знайдені - нікнейм не унікальний
  if (data) {
    return false;
  }
  
  // Інші помилки
  if (error) throw error;
  return true;
}

/**
 * Створити профіль користувача
 */
export async function createUserProfile(userId: string, email?: string, fullName?: string) {
  // Перевірити унікальність нікнейму
  if (email) {
    const isUnique = await isEmailUnique(email);
    if (!isUnique) {
      throw new Error(`Почта "${email}" вже використовується. Будь ласка, виберіть іншу почту.`);
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      email: email?.toLowerCase(),
      full_name: fullName || 'User',
      total_walks: 0,
      total_distance: 0,
      total_time: 0,
      average_pace: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Отримати профіль користувача за ID
 */
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    // Якщо профіль не існує, повертаємо null замість помилки
    if (error.code === 'PGRST116' || error.message?.includes('No rows found')) {
      return null;
    }
    throw error;
  }
  return data as UserProfile;
}

/**
 * Отримати профіль користувача за нікнейму
 */
export async function getUserProfileByUsername(email: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (error) {
    // Якщо профіль не існує, повертаємо null замість помилки
    if (error.code === 'PGRST116' || error.message?.includes('No rows found')) {
      return null;
    }
    throw error;
  }
  return data as UserProfile;
}

/**
 * Оновити профіль користувача
 */
export async function updateUserProfile(userId: string, updates: Partial<UserProfile>) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as UserProfile;
}

/**
 * Завантажити аватар користувача
 */
export async function uploadAvatar(userId: string, file: File) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const filePath = `${userId}/${fileName}`; // Папка за userId для RLS

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true });

  if (uploadError) throw uploadError;

  // Отримати публічний URL
  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Пошук користувачів за іменем або email
 */
export async function searchUsers(query: string): Promise<UserProfile[]> {
  const q = query?.trim();
  if (!q || q.length === 0) return [];

  try {
    const { data, error } = await supabase.rpc('search_profiles', {
      search_term: q,
    });

    if (error) {
      // Fallback to direct query if RPC doesn't exist
      const pattern = `%${q}%`;
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('profiles')
        .select('*')
        .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
        .limit(10);

      if (fallbackError) {
        console.error('Error searching users:', fallbackError);
        return [];
      }
      return (fallbackData || []) as UserProfile[];
    }

    return (data || []) as UserProfile[];
  } catch (err) {
    console.error('Error searching users:', err);
    return [];
  }
}

// ============ МАРШРУТИ ============

/**
 * Зберегти новий маршрут
 */
export async function saveRoute(route: SavedRoute) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('routes')
    .insert({
      user_id: user.id,
      name: route.name,
      description: route.description || null,
      points: route.points,
      waypoints: route.waypoints || null,
      statistics: route.statistics,
      preferences: route.preferences || null,
      geo_json: route.geo_json || null,
      tags: route.tags || [],
      difficulty: route.difficulty || 'moderate',
      is_public: route.is_public || false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Отримати всі маршрути користувача
 */
export async function getUserRoutes(userId: string) {
  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as SavedRoute[];
}

/**
 * Отримати один маршрут за ID
 */
export async function getRouteById(routeId: string) {
  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .eq('id', routeId)
    .single();

  if (error) throw error;
  return data as SavedRoute;
}

/**
 * Оновити маршрут
 */
export async function updateRoute(routeId: string, updates: Partial<SavedRoute>) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('routes')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', routeId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data as SavedRoute;
}

/**
 * Опублікувати маршрут (зробити його публічним)
 */
export async function publishRoute(routeId: string) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('routes')
    .update({
      is_public: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', routeId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data as SavedRoute;
}

/**
 * Видалити маршрут
 */
export async function deleteRoute(routeId: string) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('routes')
    .delete()
    .eq('id', routeId)
    .eq('user_id', user.id);

  if (error) throw error;
  return true;
}

/**
 * Прибрати маршрут з публічних (зробити його приватним)
 */
export async function unpublishRoute(routeId: string) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('routes')
    .update({
      is_public: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', routeId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data as SavedRoute;
}

/**
 * Отримати публічні маршрути з пошуком
 */
export async function getPublicRoutes(tags?: string[], limit: number = 50) {
  try {
    let query = supabase
      .from('routes')
      .select('*')
      .eq('is_public', true);

    if (tags && tags.length > 0) {
      query = query.contains('tags', tags);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching public routes:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error in getPublicRoutes:', err);
    return [];
  }
}

/**
 * Отримати мої опубліковані маршрути (тільки авторизованого користувача)
 */
export async function getMyPublishedRoutes() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching my published routes:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error in getMyPublishedRoutes:', err);
    return [];
  }
}

// ============ УЛЮБЛЕНІ МАРШРУТИ ============

/**
 * Додати маршрут в улюблені
 */
export async function addToFavorites(routeId: string) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('saved_favorites')
    .insert({
      user_id: user.id,
      route_id: routeId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Видалити маршрут з улюблених
 */
export async function removeFromFavorites(routeId: string) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('saved_favorites')
    .delete()
    .eq('route_id', routeId)
    .eq('user_id', user.id);

  if (error) throw error;
  return true;
}

/**
 * Отримати улюблені маршрути користувача
 */
export async function getFavoriteRoutes(userId: string) {
  try {
    // Спочатку спробуємо отримати маршрути з JOIN на профіль
    const { data, error } = await supabase
      .from('saved_favorites')
      .select('routes(*)')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching favorite routes:', error);
      // Якщо JOIN не спрацьовує, повертаємо пустий масив
      return [];
    }

    // Фільтруємо null маршрути (на випадок якщо маршрут був видалений)
    const routes = data?.filter((item: any) => item.routes !== null)
      .map((item: any) => item.routes) || [];
    
    return routes as SavedRoute[];
  } catch (err) {
    console.error('Error in getFavoriteRoutes:', err);
    return [];
  }
}

/**
 * Перевірити, чи є маршрут в улюблених
 */
export async function isFavorite(routeId: string) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return false;

  const { data, error } = await supabase
    .from('saved_favorites')
    .select('*')
    .eq('user_id', user.id)
    .eq('route_id', routeId)
    .single();

  if (error) return false;
  return !!data;
}

// ============ СТАТИСТИКА ПРОГУЛЯНОК ============

/**
 * Добавити запис статистики прогулянки
 */
export async function addWalkStatistic(stat: WalkStatistic) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('walk_statistics')
    .insert({
      user_id: user.id,
      route_id: stat.route_id || null,
      date: stat.date,
      distance_km: stat.distance_km,
      duration_minutes: stat.duration_minutes,
      pace: stat.pace,
      calories: stat.calories || null,
      steps: stat.steps || null,
      elevation_gain: stat.elevation_gain || null,
      weather: stat.weather || null,
      mood: stat.mood || null,
      notes: stat.notes || null,
    })
    .select()
    .single();

  if (error) throw error;

  // Оновити статистику профілю
  const userStats = await getUserWalkStatistics(user.id);
  const totalDistance = userStats.reduce((sum, s) => sum + s.distance_km, 0);
  const totalTime = userStats.reduce((sum, s) => sum + s.duration_minutes, 0);
  const avgSpeed = totalTime > 0 ? (totalDistance * 60) / totalTime : 0; // км/год

  await updateUserProfile(user.id, {
    total_walks: userStats.length,
    total_distance: totalDistance,
    total_time: totalTime,
    average_pace: parseFloat(avgSpeed.toFixed(2)),
  });

  return data;
}

/**
 * Отримати статистику прогулянок користувача
 */
export async function getUserWalkStatistics(userId: string) {
  const { data, error } = await supabase
    .from('walk_statistics')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) throw error;
  return (data || []) as WalkStatistic[];
}

/**
 * Отримати статистику за період
 */
export async function getWalkStatisticsByPeriod(userId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('walk_statistics')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (error) throw error;
  return (data || []) as WalkStatistic[];
}

// ============ ЕКСПОРТ МАРШРУТІВ ============

/**
 * Експортувати маршрут в GPX формат
 */
export function exportToGPX(route: SavedRoute): string {
  const timestamp = new Date().toISOString();

  const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Walkify" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(route.name)}</name>
    <desc>${escapeXml(route.description || '')}</desc>
    <time>${timestamp}</time>
  </metadata>
  <trk>
    <name>${escapeXml(route.name)}</name>
    <trkseg>`;

  const trackPoints = route.points
    .map(([lat, lng]) => `      <trkpt lat="${lat}" lon="${lng}"><time>${timestamp}</time></trkpt>`)
    .join('\n');

  const waypointsStr = (route.waypoints || [])
    .map(
      (wp) => `  <wpt lat="${wp.location[0]}" lon="${wp.location[1]}">
    <name>${escapeXml(wp.name)}</name>
    <type>${escapeXml(wp.type)}</type>
  </wpt>`
    )
    .join('\n');

  const gpxFooter = `
    </trkseg>
  </trk>
</gpx>`;

  return gpxHeader + '\n' + trackPoints + '\n' + gpxFooter + (waypointsStr ? '\n' + waypointsStr : '') + '\n';
}

/**
 * Експортувати маршрут в KML формат
 */
export function exportToKML(route: SavedRoute): string {
  const kmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(route.name)}</name>
    <description>${escapeXml(route.description || '')}</description>
    <Placemark>
      <name>${escapeXml(route.name)}</name>
      <LineString>
        <coordinates>`;

  const coordinates = route.points.map(([lat, lng]) => `${lng},${lat},0`).join('\n        ');

  const kmlFooter = `
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;

  return kmlHeader + '\n        ' + coordinates + kmlFooter;
}

/**
 * Експортувати маршрут в JSON формат
 */
export function exportToJSON(route: SavedRoute): string {
  return JSON.stringify(route, null, 2);
}

/**
 * Скачати файл маршруту
 */
export function downloadRoute(route: SavedRoute, format: 'gpx' | 'kml' | 'json' = 'gpx') {
  let content: string;
  let mimeType: string;
  let extension: string;

  switch (format) {
    case 'gpx':
      content = exportToGPX(route);
      mimeType = 'application/gpx+xml';
      extension = 'gpx';
      break;
    case 'kml':
      content = exportToKML(route);
      mimeType = 'application/vnd.google-earth.kml+xml';
      extension = 'kml';
      break;
    case 'json':
      content = exportToJSON(route);
      mimeType = 'application/json';
      extension = 'json';
      break;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${route.name.replace(/\s+/g, '_')}.${extension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Допоміжна функція
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

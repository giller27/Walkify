/// <reference types="google.maps" />

export interface PlaceDetails {
  placeId: string;
  name: string;
  address?: string;
  rating?: number;
  userRatingsTotal?: number;
  photoUrl?: string;
  openingHours?: string[];
  isOpen?: boolean;
  phone?: string;
  types?: string[];
  priceLevel?: number;
}

function getPlacesService(): google.maps.places.PlacesService {
  if (!window.google?.maps?.places) {
    throw new Error("Google Maps Places API is not loaded.");
  }
  return new google.maps.places.PlacesService(document.createElement('div'));
}

export async function geocodeAddress(address: string): Promise<{ coords: [number, number]; formattedAddress: string } | null> {
  return new Promise((resolve) => {
    if (!window.google?.maps?.Geocoder) {
      resolve(null);
      return;
    }
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        const loc = results[0].geometry.location;
        resolve({
          coords: [loc.lng(), loc.lat()],
          formattedAddress: results[0].formatted_address,
        });
      } else {
        resolve(null);
      }
    });
  });
}

export async function reverseGeocode(coords: [number, number]): Promise<string | null> {
  return new Promise((resolve) => {
    if (!window.google?.maps?.Geocoder) {
      resolve(null);
      return;
    }
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat: coords[1], lng: coords[0] } }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        resolve(results[0].formatted_address);
      } else {
        resolve(null);
      }
    });
  });
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  return new Promise((resolve) => {
    const service = getPlacesService();
    service.getDetails(
      {
        placeId,
        fields: [
          'name', 'formatted_address', 'rating', 'user_ratings_total',
          'photos', 'opening_hours', 'formatted_phone_number', 'types', 'price_level',
        ],
      },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          resolve(null);
          return;
        }

        let photoUrl: string | undefined;
        if (place.photos?.[0]) {
          photoUrl = place.photos[0].getUrl({ maxWidth: 480, maxHeight: 320 });
        }

        resolve({
          placeId,
          name: place.name || 'Невідоме місце',
          address: place.formatted_address,
          rating: place.rating,
          userRatingsTotal: place.user_ratings_total,
          photoUrl,
          openingHours: place.opening_hours?.weekday_text,
          isOpen: place.opening_hours?.isOpen?.(),
          phone: place.formatted_phone_number,
          types: place.types,
          priceLevel: place.price_level,
        });
      }
    );
  });
}

export const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  park: { label: 'Парк', emoji: '🌳' },
  cafe: { label: "Кав'ярня", emoji: '☕' },
  restaurant: { label: 'Ресторан', emoji: '🍽️' },
  bakery: { label: 'Пекарня', emoji: '🥐' },
  museum: { label: 'Музей', emoji: '🏛️' },
  art_gallery: { label: 'Галерея', emoji: '🎨' },
  library: { label: 'Бібліотека', emoji: '📚' },
  book_store: { label: 'Книгарня', emoji: '📖' },
  church: { label: 'Храм', emoji: '⛪' },
  tourist_attraction: { label: 'Визначне місце', emoji: '⭐' },
  store: { label: 'Магазин', emoji: '🛍️' },
  shopping_mall: { label: 'Торговий центр', emoji: '🏬' },
  gym: { label: 'Спортзал', emoji: '💪' },
  spa: { label: 'СПА', emoji: '🧖' },
  zoo: { label: 'Зоопарк', emoji: '🦁' },
  stadium: { label: 'Стадіон', emoji: '🏟️' },
  movie_theater: { label: 'Кінотеатр', emoji: '🎬' },
  night_club: { label: 'Бар / клуб', emoji: '🎵' },
  playground: { label: 'Майданчик', emoji: '🛝' },
  natural_feature: { label: 'Природа', emoji: '🏞️' },
  custom: { label: 'Місце', emoji: '📍' },
};

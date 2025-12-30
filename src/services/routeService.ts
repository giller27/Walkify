// Сервіс для пошуку місць та побудови маршрутів

const MAPBOX_TOKEN = "pk.eyJ1IjoiaGFsbGV5cy1jb21ldCIsImEiOiJjbWpzcmc0dzQ0NHZ1M2dxeDRyOTFtNHFxIn0.gCWJwF521jdHqD38Nn8ZsA";

export interface Place {
  name: string;
  coordinates: [number, number]; // [lng, lat]
  type: string;
  address?: string;
}

export interface RoutePoint {
  coordinates: [number, number]; // [lng, lat]
  type: 'start' | 'waypoint' | 'end';
  name?: string;
}

export interface RouteResult {
  points: [number, number][]; // [lat, lng] для сумісності з існуючим кодом
  waypoints: {
    location: [number, number]; // [lat, lng]
    name: string;
    type: 'cafe' | 'park' | 'shop' | 'custom';
  }[];
  distanceKm: number;
  estimatedTimeMinutes: number;
  locations: string[];
}

// Мапінг типів місць для пошуку
const PLACE_TYPE_MAPPING: Record<string, string> = {
  'парк': 'park',
  'кав\'ярня': 'cafe',
  'кав\'ярні': 'cafe',
  'кафе': 'cafe',
  'ресторан': 'restaurant',
  'магазин': 'shop',
  'музей': 'museum',
  'бібліотека': 'library',
  'церква': 'place_of_worship',
  'храм': 'place_of_worship',
  'пляж': 'beach',
  'озеро': 'lake',
  'річка': 'river',
};

// Мапінг типів для Mapbox
const MAPBOX_CATEGORY_MAPPING: Record<string, string> = {
  'park': 'park',
  'cafe': 'cafe',
  'restaurant': 'restaurant',
  'shop': 'shop',
  'museum': 'museum',
  'library': 'library',
  'place_of_worship': 'place_of_worship',
  'beach': 'beach',
  'lake': 'lake',
  'river': 'river',
};

/**
 * Парсить текстовий запит і витягує типи місць або конкретні назви
 */
export function parseRouteRequest(text: string): {
  destinationType: string | null;
  destinationName: string | null; // Конкретна назва будівлі/місця
  waypointTypes: string[];
  waypointNames: string[]; // Конкретні назви проміжних точок
  targetDistance?: number; // Бажана відстань маршруту в км
} {
  const lowerText = text.toLowerCase();
  let destinationType: string | null = null;
  let destinationName: string | null = null;
  const waypointTypes: string[] = [];
  const waypointNames: string[] = [];

  // Функція для перевірки, чи слово містить базову форму (враховуючи відмінки)
  const containsBaseForm = (text: string, baseForm: string): boolean => {
    const lowerText = text.toLowerCase();
    const lowerBase = baseForm.toLowerCase();
    
    // Точне співпадіння
    if (lowerText === lowerBase) return true;
    
    // Перевіряємо, чи текст містить базову форму
    if (lowerText.includes(lowerBase)) return true;
    
    // Перевіряємо різні відмінки для базової форми
    // Для іменників жіночого роду (закінчення на -а, -я)
    if (lowerBase.endsWith('а') || lowerBase.endsWith('я')) {
      const stem = lowerBase.slice(0, -1);
      const variants = [
        stem + 'и',   // родовий/давальний відмінок
        stem + 'ею',  // орудний відмінок
        stem + 'ю',   // знахідний відмінок
        stem + 'ій',  // місцевий відмінок
        stem + 'і',   // називний відмінок множини
      ];
      for (const variant of variants) {
        if (lowerText.includes(variant) && variant.length >= 3) return true;
      }
    }
    
    // Для іменників чоловічого роду (закінчення на приголосний, -ль, -нь)
    if (!lowerBase.endsWith('а') && !lowerBase.endsWith('я') && !lowerBase.endsWith('о') && !lowerBase.endsWith('е')) {
      const variants = [
        lowerBase + 'у',   // родовий/давальний відмінок
        lowerBase + 'ом',  // орудний відмінок
        lowerBase + 'і',   // місцевий відмінок
        lowerBase + 'ів',  // родовий відмінок множини
      ];
      for (const variant of variants) {
        if (lowerText.includes(variant) && variant.length >= 3) return true;
      }
    }
    
    // Для прикметників
    if (lowerBase.endsWith('ий') || lowerBase.endsWith('а') || lowerBase.endsWith('е')) {
      const stem = lowerBase.replace(/(ий|а|е)$/, '');
      const variants = [
        stem + 'ого',  // родовий відмінок
        stem + 'им',   // орудний відмінок
        stem + 'ому',  // давальний відмінок
        stem + 'ій',   // місцевий відмінок
        stem + 'ої',   // родовий відмінок жіночого роду
        stem + 'ою',   // орудний відмінок жіночого роду
      ];
      for (const variant of variants) {
        if (lowerText.includes(variant) && variant.length >= 3) return true;
      }
    }
    
    return false;
  };

  // Функція для перевірки, чи слово є типом місця
  const isPlaceType = (word: string): boolean => {
    for (const [key] of Object.entries(PLACE_TYPE_MAPPING)) {
      if (containsBaseForm(word, key)) {
        return true;
      }
    }
    return false;
  };

  // Спочатку перевіряємо, чи є конкретна назва після "до"
  // Патерни для витягування назви після "до" або "прогулянка до"
  // Покращені патерни для кращого захоплення багатослівних назв
  const specificNamePatterns = [
    /прогулянка\s+до\s+([А-Яа-яІіЇїЄєҐґA-Za-z0-9][А-Яа-яІіЇїЄєҐґA-Za-z0-9\s]{2,}?)(?:\s+з|\s+через|$|\.|,)/i,
    /до\s+([А-Яа-яІіЇїЄєҐґA-Za-z0-9][А-Яа-яІіЇїЄєҐґA-Za-z0-9\s]{2,}?)(?:\s+з|\s+через|$|\.|,)/i,
    /маршрут\s+до\s+([А-Яа-яІіЇїЄєҐґA-Za-z0-9][А-Яа-яІіЇїЄєҐґA-Za-z0-9\s]{2,}?)(?:\s+з|\s+через|$|\.|,)/i,
  ];

  for (const pattern of specificNamePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const extractedName = match[1].trim();
      const lowerExtractedName = extractedName.toLowerCase();
      
      // Перевіряємо, чи це не тип місця (парк, кав'ярня, тощо)
      // Якщо назва містить пробіли або починається з великої літери - це швидше за все конкретна назва
      const hasSpaces = extractedName.includes(' ');
      const startsWithCapital = /^[А-ЯA-Z]/.test(extractedName);
      // Якщо назва містить прикметник + іменник (наприклад, "західний автовокзал")
      const hasAdjectiveNoun = /^[А-Яа-яІіЇїЄєҐґA-Za-z]+\s+[А-Яа-яІіЇїЄєҐґA-Za-z]+/.test(extractedName);
      const isLikelySpecificName = hasSpaces || startsWithCapital || extractedName.length > 10 || hasAdjectiveNoun;
      
      let isPlaceTypeCheck = false;
      if (!isLikelySpecificName) {
        // Перевіряємо тільки якщо не схоже на конкретну назву
        isPlaceTypeCheck = isPlaceType(lowerExtractedName);
      } else {
        // Навіть якщо схоже на конкретну назву, перевіряємо чи це не просто тип місця
        // Якщо це багатослівна фраза з прикметником, це швидше за все конкретна назва
        const isJustPlaceType = !hasSpaces && !hasAdjectiveNoun && isPlaceType(lowerExtractedName);
        isPlaceTypeCheck = isJustPlaceType;
      }
      
      // Якщо це не тип місця, а конкретна назва - зберігаємо її
      if (!isPlaceTypeCheck && extractedName.length > 2) {
        destinationName = extractedName;
        break;
      }
    }
  }

  // Шукаємо ключові слова для пункту призначення (прогулянка до парку, до кав'ярні, тощо)
  // Тільки якщо не знайдено конкретну назву
  if (!destinationName) {
    const destinationPatterns = [
      /до\s+(\w+)/g,
      /прогулянка\s+до\s+(\w+)/g,
      /маршрут\s+до\s+(\w+)/g,
    ];

    for (const pattern of destinationPatterns) {
      const matches = lowerText.matchAll(pattern);
      for (const match of matches) {
        const word = match[1];
        for (const [key, value] of Object.entries(PLACE_TYPE_MAPPING)) {
          if (containsBaseForm(word, key)) {
            if (!destinationType) {
              destinationType = value;
              break;
            }
          }
        }
      }
    }

    // Якщо не знайдено через патерни, шукаємо просто за ключовими словами
    if (!destinationType) {
      for (const [key, value] of Object.entries(PLACE_TYPE_MAPPING)) {
        if (containsBaseForm(lowerText, key) && 
            !containsBaseForm(lowerText, `з ${key}`) && 
            !containsBaseForm(lowerText, `через ${key}`)) {
          destinationType = value;
          break;
        }
      }
    }
  }

  // Шукаємо конкретні назви проміжних точок після "через" або "з"
  // Патерни для витягування конкретних назв після "через" або "з"
  // Покращені патерни для кращого захоплення багатослівних назв
  const waypointNamePatterns = [
    /через\s+([А-Яа-яІіЇїЄєҐґA-Za-z0-9][А-Яа-яІіЇїЄєҐґA-Za-z0-9\s]{2,}?)(?:\s+до|\s+через|$|\.|,)/gi,
    /з\s+([А-Яа-яІіЇїЄєҐґA-Za-z0-9][А-Яа-яІіЇїЄєҐґA-Za-z0-9\s]{2,}?)(?:\s+до|\s+через|$|\.|,)/gi,
  ];

  for (const pattern of waypointNamePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match && match[1]) {
        const extractedName = match[1].trim();
        const lowerExtractedName = extractedName.toLowerCase();
        
        // Перевіряємо, чи це конкретна назва (містить пробіли, починається з великої літери, або довша за 10 символів)
        const hasSpaces = extractedName.includes(' ');
        const startsWithCapital = /^[А-ЯA-Z]/.test(extractedName);
        // Якщо назва містить прикметник + іменник (наприклад, "сімейна пекарня", "західний автовокзал")
        const hasAdjectiveNoun = /^[А-Яа-яІіЇїЄєҐґA-Za-z]+\s+[А-Яа-яІіЇїЄєҐґA-Za-z]+/.test(extractedName);
        const isLikelySpecificName = hasSpaces || startsWithCapital || extractedName.length > 10 || hasAdjectiveNoun;
        
        // Перевіряємо, чи це не просто тип місця (наприклад, "пекарня" сама по собі)
        // Якщо це багатослівна фраза з прикметником, це швидше за все конкретна назва
        const isJustPlaceType = !hasSpaces && !hasAdjectiveNoun && isPlaceType(lowerExtractedName);
        
        // Якщо це схоже на конкретну назву і не є просто типом місця
        if (isLikelySpecificName && !isJustPlaceType && extractedName.length > 2) {
          if (!waypointNames.includes(extractedName)) {
            waypointNames.push(extractedName);
          }
        } else if (!isLikelySpecificName) {
          // Якщо це не схоже на конкретну назву, перевіряємо чи це тип місця
          for (const [key, value] of Object.entries(PLACE_TYPE_MAPPING)) {
            if (containsBaseForm(lowerExtractedName, key)) {
              if (value !== destinationType && !waypointTypes.includes(value)) {
                waypointTypes.push(value);
              }
              break;
            }
          }
        }
      }
    }
  }

  // Шукаємо ключові слова для проміжних точок (з, через, з кав'ярнею)
  const waypointPatterns = [
    /з\s+(\w+)/g,
    /через\s+(\w+)/g,
    /з\s+кав['\u2019]?ярнею/g,
    /з\s+кафе/g,
    /з\s+парком/g,
    /з\s+магазином/g,
  ];

  for (const pattern of waypointPatterns) {
    const matches = lowerText.matchAll(pattern);
    for (const match of matches) {
      const word = match[1] || match[0];
      for (const [key, value] of Object.entries(PLACE_TYPE_MAPPING)) {
        if (containsBaseForm(word, key) || 
            (word.includes('кав') && value === 'cafe') ||
            (word.includes('парк') && value === 'park') ||
            (word.includes('магазин') && value === 'shop')) {
          if (value !== destinationType && !waypointTypes.includes(value)) {
            waypointTypes.push(value);
          }
        }
      }
    }
  }

  // Додаткова перевірка для явних згадок
  for (const [key, value] of Object.entries(PLACE_TYPE_MAPPING)) {
    if ((containsBaseForm(lowerText, `з ${key}`) || containsBaseForm(lowerText, `через ${key}`)) ||
        (lowerText.includes(`з ${key}`) || lowerText.includes(`через ${key}`))) {
      if (value !== destinationType && !waypointTypes.includes(value)) {
        waypointTypes.push(value);
      }
    }
  }

  // Парсимо відстань з тексту (наприклад, "5км", "5 км", "5km", "5 km")
  let targetDistance: number | undefined = undefined;
  const distancePatterns = [
    /(\d+(?:[.,]\d+)?)\s*км/gi,
    /(\d+(?:[.,]\d+)?)\s*km/gi,
    /(\d+(?:[.,]\d+)?)\s*кілометр/gi,
    /(\d+(?:[.,]\d+)?)\s*kilometer/gi,
  ];
  
  for (const pattern of distancePatterns) {
    const match = text.match(pattern);
    if (match) {
      const distanceStr = match[1].replace(',', '.');
      const distance = parseFloat(distanceStr);
      if (!isNaN(distance) && distance > 0) {
        targetDistance = distance;
        break;
      }
    }
  }

  return { destinationType, destinationName, waypointTypes, waypointNames, targetDistance };
}

/**
 * Генерує варіанти назви в різних відмінках для пошуку
 */
function generateNameVariants(name: string): string[] {
  const variants: string[] = [name]; // Додаємо оригінальну назву
  
  const lower = name.toLowerCase().trim();
  
  // Якщо назва містить прикметник + іменник (наприклад, "західний автовокзал")
  const words = lower.split(/\s+/);
  if (words.length === 2) {
    const [adjective, noun] = words;
    
    // Варіанти прикметника в різних відмінках (чоловічий рід)
    if (adjective.endsWith('ий') || adjective.endsWith('ій')) {
      const stem = adjective.slice(0, -2);
      const adjVariants = [
        adjective,        // називний: західний
        stem + 'ого',     // родовий: західного
        stem + 'ому',     // давальний: західному
        stem + 'им',      // орудний: західним
      ];
      
      // Варіанти іменника в різних відмінках (чоловічий рід)
      if (noun.endsWith('л') || noun.endsWith('ль') || noun.endsWith('нь') || noun.endsWith('ал')) {
        const nounVariants = [
          noun,           // називний: автовокзал
          noun + 'у',     // родовий/давальний: автовокзалу
          noun + 'ом',    // орудний: автовокзалом
          noun + 'і',     // місцевий: автовокзалі
        ];
        
        // Комбінуємо варіанти
        for (const adj of adjVariants) {
          for (const n of nounVariants) {
            variants.push(`${adj} ${n}`);
          }
        }
      }
    }
  } else if (words.length === 1) {
    // Одне слово
    const word = words[0];
    if (word.endsWith('л') || word.endsWith('ль') || word.endsWith('нь') || word.endsWith('ал')) {
      variants.push(
        word + 'у',
        word + 'ом',
        word + 'і',
        word + 'а'
      );
    } else if (word.endsWith('а') || word.endsWith('я')) {
      const stem = word.slice(0, -1);
      variants.push(
        stem + 'и',
        stem + 'ею',
        stem + 'і',
        stem + 'у'
      );
    }
  }
  
  // Видаляємо дублікати та повертаємо унікальні варіанти
  return [...new Set(variants)];
}

/**
 * Пошук конкретної будівлі/місця за назвою через геокодування
 * Спробує кілька варіантів назви в різних відмінках
 */
export async function findPlaceByName(
  placeName: string,
  userLocation: [number, number] // [lng, lat]
): Promise<Place | null> {
  // Генеруємо варіанти назви в різних відмінках
  const nameVariants = generateNameVariants(placeName);
  
  // Функція для пошуку за конкретною назвою
  const searchWithName = async (name: string): Promise<Place | null> => {
    try {
      // Спочатку спробуємо через Nominatim
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(name)}&` +
        `format=json&` +
        `limit=5&` +
        `bounded=1&` +
        `viewbox=${userLocation[0] - 0.1},${userLocation[1] - 0.1},${userLocation[0] + 0.1},${userLocation[1] + 0.1}&` +
        `addressdetails=1`;
      
      try {
        const nominatimResponse = await fetch(nominatimUrl, {
          headers: {
            'User-Agent': 'WalkifyApp/1.0'
          }
        });
        
        if (nominatimResponse.ok) {
          const nominatimData = await nominatimResponse.json();
          
          if (nominatimData && nominatimData.length > 0) {
            // Обчислюємо відстань до кожного місця і вибираємо найближче
            let nearestPlace: Place | null = null;
            let minDistance = Infinity;

            for (const item of nominatimData) {
              const lng = parseFloat(item.lon);
              const lat = parseFloat(item.lat);
              const distance = calculateDistance(
                userLocation[1], userLocation[0],
                lat, lng
              );

              if (distance < minDistance && distance <= 50) { // в межах 50 км
                minDistance = distance;
                nearestPlace = {
                  name: item.display_name.split(',')[0] || item.name || placeName,
                  coordinates: [lng, lat],
                  type: 'custom',
                  address: item.display_name,
                };
              }
            }

            if (nearestPlace) {
              return nearestPlace;
            }
          }
        }
      } catch (nominatimError) {
        // Продовжуємо до Mapbox
      }

      // Якщо Nominatim не спрацював, використовуємо Mapbox Geocoding API
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(name)}.json?` +
        `proximity=${userLocation[0]},${userLocation[1]}&` +
        `limit=5&` +
        `access_token=${MAPBOX_TOKEN}`;

      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      if (!data.features || data.features.length === 0) {
        return null;
      }

      // Обчислюємо відстань до кожного місця і вибираємо найближче
      let nearestPlace: Place | null = null;
      let minDistance = Infinity;

      for (const feature of data.features) {
        const [lng, lat] = feature.center as [number, number];
        const distance = calculateDistance(
          userLocation[1], userLocation[0],
          lat, lng
        );

        if (distance < minDistance && distance <= 50) { // в межах 50 км
          minDistance = distance;
          nearestPlace = {
            name: feature.text || feature.place_name || placeName,
            coordinates: [lng, lat],
            type: 'custom',
            address: feature.place_name,
          };
        }
      }

      return nearestPlace;
    } catch (error) {
      return null;
    }
  };
  
  // Спробуємо кожен варіант назви
  for (const variant of nameVariants) {
    const result = await searchWithName(variant);
    if (result) {
      return result;
    }
  }
  
  return null;
}

/**
 * Пошук найближчого місця за типом
 */
export async function findNearestPlace(
  userLocation: [number, number], // [lng, lat]
  placeType: string,
  radius: number = 5000 // радіус пошуку в метрах
): Promise<Place | null> {
  try {
    const category = MAPBOX_CATEGORY_MAPPING[placeType] || placeType;
    
    // Спочатку спробуємо через OpenStreetMap Nominatim (безкоштовний і краще для пошуку місць)
    const nominatimQuery = getNominatimQuery(category);
    if (nominatimQuery) {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(nominatimQuery)}&` +
        `format=json&` +
        `limit=10&` +
        `bounded=1&` +
        `viewbox=${userLocation[0] - 0.1},${userLocation[1] - 0.1},${userLocation[0] + 0.1},${userLocation[1] + 0.1}&` +
        `addressdetails=1`;
      
      try {
        const nominatimResponse = await fetch(nominatimUrl, {
          headers: {
            'User-Agent': 'WalkifyApp/1.0'
          }
        });
        
        if (nominatimResponse.ok) {
          const nominatimData = await nominatimResponse.json();
          
          if (nominatimData && nominatimData.length > 0) {
            // Обчислюємо відстань до кожного місця і вибираємо найближче
            let nearestPlace: Place | null = null;
            let minDistance = Infinity;

            for (const item of nominatimData) {
              const lng = parseFloat(item.lon);
              const lat = parseFloat(item.lat);
              const distance = calculateDistance(
                userLocation[1], userLocation[0],
                lat, lng
              );

              if (distance < minDistance && distance <= radius / 1000) {
                minDistance = distance;
                nearestPlace = {
                  name: item.display_name.split(',')[0] || item.name || 'Місце',
                  coordinates: [lng, lat],
                  type: category,
                  address: item.display_name,
                };
              }
            }

            if (nearestPlace) {
              return nearestPlace;
            }
          }
        }
      } catch (nominatimError) {
        console.log('Nominatim search failed, trying Mapbox...', nominatimError);
      }
    }

    // Якщо Nominatim не спрацював, використовуємо Mapbox Geocoding API
    const query = category === 'park' ? 'park' : category;
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
      `proximity=${userLocation[0]},${userLocation[1]}&` +
      `limit=10&` +
      `access_token=${MAPBOX_TOKEN}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to search places');
    }

    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      return null;
    }

    // Фільтруємо за типом, якщо можливо
    let features = data.features;
    if (category !== 'park') {
      features = features.filter((feature: any) => {
        const categories = feature.properties?.category || [];
        const placeType = feature.properties?.place_type?.[0] || '';
        return categories.some((cat: string) => 
          cat.toLowerCase().includes(category.toLowerCase())
        ) || placeType.toLowerCase().includes(category.toLowerCase());
      });
    }

    if (features.length === 0) {
      return null;
    }

    // Обчислюємо відстань до кожного місця і вибираємо найближче
    let nearestPlace: Place | null = null;
    let minDistance = Infinity;

    for (const feature of features) {
      const [lng, lat] = feature.center as [number, number];
      const distance = calculateDistance(
        userLocation[1], userLocation[0],
        lat, lng
      );

      if (distance < minDistance && distance <= radius / 1000) {
        minDistance = distance;
        nearestPlace = {
          name: feature.text || feature.place_name || 'Місце',
          coordinates: [lng, lat],
          type: category,
          address: feature.place_name,
        };
      }
    }

    return nearestPlace;
  } catch (error) {
    console.error('Error finding nearest place:', error);
    return null;
  }
}

/**
 * Отримує запит для Nominatim на основі типу місця
 */
function getNominatimQuery(category: string): string | null {
  const queries: Record<string, string> = {
    'park': 'park',
    'cafe': 'cafe',
    'restaurant': 'restaurant',
    'shop': 'shop',
    'museum': 'museum',
    'library': 'library',
    'place_of_worship': 'church',
    'beach': 'beach',
    'lake': 'lake',
    'river': 'river',
  };
  
  return queries[category] || null;
}

/**
 * Пошук проміжної точки на маршруті
 */
export async function findWaypointOnRoute(
  start: [number, number], // [lng, lat]
  end: [number, number], // [lng, lat]
  waypointType: string
): Promise<Place | null> {
  try {
    // Обчислюємо середню точку маршруту
    const midLng = (start[0] + end[0]) / 2;
    const midLat = (start[1] + end[1]) / 2;

    // Шукаємо місце поблизу середньої точки
    return await findNearestPlace([midLng, midLat], waypointType, 2000);
  } catch (error) {
    console.error('Error finding waypoint:', error);
    return null;
  }
}

/**
 * Побудова маршруту через Mapbox Directions API
 */
export async function buildRoute(
  userLocation: [number, number], // [lng, lat]
  destination: [number, number], // [lng, lat]
  waypoints: [number, number][] = [] // [lng, lat]
): Promise<RouteResult> {
  try {
    // Формуємо URL для Directions API
    let coordinates: [number, number][] = [userLocation, ...waypoints, destination];
    
    // Mapbox Directions API приймає координати у форматі lng,lat
    const coordinatesStr = coordinates.map(coord => `${coord[0]},${coord[1]}`).join(';');
    
    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinatesStr}?` +
      `geometries=geojson&` +
      `steps=true&` +
      `overview=full&` +
      `access_token=${MAPBOX_TOKEN}`;

    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to build route: ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.routes || data.routes.length === 0) {
      throw new Error('No route found');
    }

    const route = data.routes[0];
    const geometry = route.geometry;
    
    // Конвертуємо координати з [lng, lat] в [lat, lng] для сумісності
    const points: [number, number][] = geometry.coordinates.map((coord: [number, number]) => 
      [coord[1], coord[0]] // [lat, lng]
    );

    // Обчислюємо відстань та час
    const distanceKm = route.distance / 1000; // конвертуємо метри в кілометри
    const estimatedTimeMinutes = Math.round(route.duration / 60); // конвертуємо секунди в хвилини

    // Формуємо waypoints з назвами
    const waypointsWithNames = waypoints.map((wp, index) => ({
      location: [wp[1], wp[0]] as [number, number], // [lat, lng]
      name: `Проміжна точка ${index + 1}`,
      type: 'custom' as const,
    }));

    return {
      points,
      waypoints: waypointsWithNames,
      distanceKm: parseFloat(distanceKm.toFixed(2)),
      estimatedTimeMinutes,
      locations: [],
    };
  } catch (error) {
    console.error('Error building route:', error);
    throw error;
  }
}

/**
 * Подовжує маршрут до потрібної відстані, додаючи точки інтересу
 */
async function extendRouteToDistance(
  initialRoute: RouteResult,
  targetDistanceKm: number,
  userLocation: [number, number], // [lng, lat]
  destination: [number, number] // [lng, lat]
): Promise<RouteResult> {
  const currentDistance = initialRoute.distanceKm;
  
  if (currentDistance >= targetDistanceKm) {
    return initialRoute; // Маршрут вже достатньо довгий
  }
  
  const neededDistance = targetDistanceKm - currentDistance;
  const additionalWaypoints: [number, number][] = [];
  const additionalWaypointPlaces: Place[] = [];
  
  // Типи місць для додавання до маршруту
  const interestTypes = ['park', 'cafe', 'museum', 'library', 'place_of_worship'];
  
  // Спробуємо додати точки інтересу, щоб подовжити маршрут
  // Використовуємо сегменти маршруту для пошуку точок поблизу
  const routePoints = initialRoute.points;
  const segmentCount = Math.min(5, Math.floor(routePoints.length / 10)); // Розбиваємо на сегменти
  
  for (let i = 0; i < segmentCount && additionalWaypoints.length < 3; i++) {
    const segmentIndex = Math.floor((i + 1) * routePoints.length / (segmentCount + 1));
    if (segmentIndex >= routePoints.length) continue;
    
    const [lat, lng] = routePoints[segmentIndex];
    const segmentPoint: [number, number] = [lng, lat];
    
    // Шукаємо точку інтересу поблизу цього сегменту
    const interestType = interestTypes[i % interestTypes.length];
    const place = await findNearestPlace(segmentPoint, interestType, 1000);
    
    if (place && !additionalWaypointPlaces.some(p => 
      Math.abs(p.coordinates[0] - place.coordinates[0]) < 0.001 &&
      Math.abs(p.coordinates[1] - place.coordinates[1]) < 0.001
    )) {
      additionalWaypoints.push(place.coordinates);
      additionalWaypointPlaces.push(place);
    }
  }
  
  // Якщо знайшли додаткові точки, будуємо новий маршрут
  if (additionalWaypoints.length > 0) {
    // Додаємо додаткові точки до існуючих проміжних точок
    const allWaypoints = [
      ...initialRoute.waypoints.map(wp => [wp.location[1], wp.location[0]] as [number, number]),
      ...additionalWaypoints
    ];
    
    const extendedRoute = await buildRoute(userLocation, destination, allWaypoints);
    
    // Якщо новий маршрут все ще коротший, спробуємо додати ще точки
    if (extendedRoute.distanceKm < targetDistanceKm && extendedRoute.distanceKm < currentDistance * 1.5) {
      // Додаємо точки інтересу ближче до кінця маршруту
      const endSegmentIndex = Math.floor(routePoints.length * 0.7);
      if (endSegmentIndex < routePoints.length) {
        const [lat, lng] = routePoints[endSegmentIndex];
        const endSegmentPoint: [number, number] = [lng, lat];
        
        const endPlace = await findNearestPlace(endSegmentPoint, 'park', 1500);
        if (endPlace && !additionalWaypointPlaces.some(p => 
          Math.abs(p.coordinates[0] - endPlace.coordinates[0]) < 0.001 &&
          Math.abs(p.coordinates[1] - endPlace.coordinates[1]) < 0.001
        )) {
          allWaypoints.push(endPlace.coordinates);
          const finalRoute = await buildRoute(userLocation, destination, allWaypoints);
          
          // Оновлюємо waypoints з правильними назвами
          finalRoute.waypoints = [
            ...initialRoute.waypoints,
            ...additionalWaypointPlaces.map(wp => ({
              location: [wp.coordinates[1], wp.coordinates[0]] as [number, number],
              name: wp.name,
              type: (wp.type === 'cafe' ? 'cafe' : 
                     wp.type === 'park' ? 'park' : 
                     wp.type === 'shop' ? 'shop' : 'custom') as 'cafe' | 'park' | 'shop' | 'custom',
            })),
            {
              location: [endPlace.coordinates[1], endPlace.coordinates[0]] as [number, number],
              name: endPlace.name,
              type: (endPlace.type === 'park' ? 'park' : 'custom') as 'cafe' | 'park' | 'shop' | 'custom',
            }
          ];
          
          finalRoute.locations = [
            ...initialRoute.locations,
            ...additionalWaypointPlaces.map(wp => wp.name),
            endPlace.name
          ];
          
          return finalRoute;
        }
      }
      
      // Оновлюємо waypoints з правильними назвами
      extendedRoute.waypoints = [
        ...initialRoute.waypoints,
        ...additionalWaypointPlaces.map(wp => ({
          location: [wp.coordinates[1], wp.coordinates[0]] as [number, number],
          name: wp.name,
          type: (wp.type === 'cafe' ? 'cafe' : 
                 wp.type === 'park' ? 'park' : 
                 wp.type === 'shop' ? 'shop' : 'custom') as 'cafe' | 'park' | 'shop' | 'custom',
        }))
      ];
      
      extendedRoute.locations = [
        ...initialRoute.locations,
        ...additionalWaypointPlaces.map(wp => wp.name)
      ];
      
      return extendedRoute;
    }
    
    // Оновлюємо waypoints з правильними назвами
    extendedRoute.waypoints = [
      ...initialRoute.waypoints,
      ...additionalWaypointPlaces.map(wp => ({
        location: [wp.coordinates[1], wp.coordinates[0]] as [number, number],
        name: wp.name,
        type: (wp.type === 'cafe' ? 'cafe' : 
               wp.type === 'park' ? 'park' : 
               wp.type === 'shop' ? 'shop' : 'custom') as 'cafe' | 'park' | 'shop' | 'custom',
      }))
    ];
    
    extendedRoute.locations = [
      ...initialRoute.locations,
      ...additionalWaypointPlaces.map(wp => wp.name)
    ];
    
    return extendedRoute;
  }
  
  return initialRoute; // Не вдалося подовжити
}

/**
 * Генерація маршруту на основі текстового запиту
 */
export async function generateRouteFromText(
  userLocation: [number, number], // [lng, lat]
  text: string
): Promise<RouteResult> {
  const { destinationType, destinationName, waypointTypes, waypointNames, targetDistance } = parseRouteRequest(text);

  // Якщо є конкретна назва, шукаємо її напряму
  let destination: Place | null = null;
  
  if (destinationName) {
    destination = await findPlaceByName(destinationName, userLocation);
    if (!destination) {
      throw new Error(`Не вдалося знайти "${destinationName}" поблизу вас.`);
    }
  } else if (destinationType) {
    // Якщо немає конкретної назви, але є тип місця - шукаємо за типом
    destination = await findNearestPlace(userLocation, destinationType);
    if (!destination) {
      throw new Error(`Не вдалося знайти ${destinationType} поблизу вас.`);
    }
  } else {
    throw new Error('Не вдалося визначити пункт призначення. Спробуйте "прогулянка до парку", "прогулянка до СкайПарку" або подібне.');
  }

  // Знаходимо проміжні точки
  const waypoints: [number, number][] = [];
  const waypointPlaces: Place[] = [];

  // Спочатку шукаємо конкретні назви проміжних точок
  for (const waypointName of waypointNames) {
    const waypoint = await findPlaceByName(waypointName, userLocation);
    if (waypoint) {
      waypoints.push(waypoint.coordinates);
      waypointPlaces.push(waypoint);
    }
  }

  // Потім шукаємо типи місць для проміжних точок
  for (const waypointType of waypointTypes) {
    // Перевіряємо, чи вже не додали місце цього типу
    const alreadyAdded = waypointPlaces.some(wp => wp.type === waypointType);
    if (!alreadyAdded) {
      const waypoint = await findWaypointOnRoute(
        userLocation,
        destination.coordinates,
        waypointType
      );
      if (waypoint) {
        waypoints.push(waypoint.coordinates);
        waypointPlaces.push(waypoint);
      }
    }
  }

  // Будуємо маршрут
  let route = await buildRoute(userLocation, destination.coordinates, waypoints);

  // Додаємо інформацію про локації
  route.locations = [
    destination.name,
    ...waypointPlaces.map(wp => wp.name),
  ];

  // Оновлюємо waypoints з правильними назвами та типами
  route.waypoints = waypointPlaces.map((wp, index) => ({
    location: [wp.coordinates[1], wp.coordinates[0]] as [number, number], // [lat, lng]
    name: wp.name,
    type: (wp.type === 'cafe' ? 'cafe' : 
           wp.type === 'park' ? 'park' : 
           wp.type === 'shop' ? 'shop' : 'custom') as 'cafe' | 'park' | 'shop' | 'custom',
  }));

  // Якщо вказана цільова відстань і поточний маршрут коротший, подовжуємо його
  if (targetDistance && route.distanceKm < targetDistance) {
    route = await extendRouteToDistance(route, targetDistance, userLocation, destination.coordinates);
  }

  return route;
}

/**
 * Обчислення відстані між двома точками (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Радіус Землі в кілометрах
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


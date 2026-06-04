const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_KEY;

const GOOGLE_MAPS_SCRIPT_ID = "google-maps-js-api";

let googleMapsPromise: Promise<any> | null = null;

declare global {
  interface Window {
    google?: any;
    initWalkifyGoogleMaps?: () => void;
  }
}

export function getGoogleMapsApiKey(): string {
  return GOOGLE_MAPS_API_KEY || "";
}

export function loadGoogleMaps(libraries: string[] = ["places"]): Promise<any> {
  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(
      new Error("Missing Google Maps API key. Set VITE_GOOGLE_MAPS_API_KEY in your environment.")
    );
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    window.initWalkifyGoogleMaps = () => {
      resolve(window.google!.maps);
      delete window.initWalkifyGoogleMaps;
    };

    const existingScript = document.getElementById(
      GOOGLE_MAPS_SCRIPT_ID
    ) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.google!.maps));
      existingScript.addEventListener("error", () =>
        reject(new Error("Failed to load Google Maps JavaScript API."))
      );
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        GOOGLE_MAPS_API_KEY
      )}` +
      `&libraries=${encodeURIComponent(libraries.join(","))}` +
      "&callback=initWalkifyGoogleMaps";
    script.onerror = () => reject(new Error("Failed to load Google Maps JavaScript API."));

    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

/**
 * Google Maps Integration Library
 * Provides address geocoding, autocomplete, and map utilities
 */

// Types for Google Maps API responses
export interface GeocodingResult {
  address: string;
  formattedAddress: string;
  location: {
    lat: number;
    lng: number;
  };
  placeId: string;
  components: AddressComponents;
}

export interface AddressComponents {
  streetNumber?: string;
  streetName?: string;
  suburb?: string;
  city?: string;
  state?: string;
  stateShort?: string;
  postcode?: string;
  country?: string;
  countryShort?: string;
}

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

// Backend geocoding using Google Geocoding API
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.error('GOOGLE_MAPS_API_KEY not configured');
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}&region=au`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.error('Geocoding failed:', data.status);
      return null;
    }

    const result = data.results[0];
    const components = parseAddressComponents(result.address_components);

    return {
      address: address,
      formattedAddress: result.formatted_address,
      location: {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
      },
      placeId: result.place_id,
      components,
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// Reverse geocoding (coordinates to address)
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodingResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.error('GOOGLE_MAPS_API_KEY not configured');
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.error('Reverse geocoding failed:', data.status);
      return null;
    }

    const result = data.results[0];
    const components = parseAddressComponents(result.address_components);

    return {
      address: result.formatted_address,
      formattedAddress: result.formatted_address,
      location: { lat, lng },
      placeId: result.place_id,
      components,
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

// Parse Google address components into structured format
function parseAddressComponents(
  components: Array<{ long_name: string; short_name: string; types: string[] }>
): AddressComponents {
  const result: AddressComponents = {};

  for (const component of components) {
    const types = component.types;

    if (types.includes('street_number')) {
      result.streetNumber = component.long_name;
    }
    if (types.includes('route')) {
      result.streetName = component.long_name;
    }
    if (types.includes('locality')) {
      result.suburb = component.long_name;
    }
    if (types.includes('administrative_area_level_2')) {
      result.city = component.long_name;
    }
    if (types.includes('administrative_area_level_1')) {
      result.state = component.long_name;
      result.stateShort = component.short_name;
    }
    if (types.includes('postal_code')) {
      result.postcode = component.long_name;
    }
    if (types.includes('country')) {
      result.country = component.long_name;
      result.countryShort = component.short_name;
    }
  }

  return result;
}

// Format full address from components
export function formatAddress(components: AddressComponents): string {
  const parts: string[] = [];

  if (components.streetNumber && components.streetName) {
    parts.push(`${components.streetNumber} ${components.streetName}`);
  } else if (components.streetName) {
    parts.push(components.streetName);
  }

  if (components.suburb) {
    parts.push(components.suburb);
  }

  if (components.stateShort && components.postcode) {
    parts.push(`${components.stateShort} ${components.postcode}`);
  } else if (components.state) {
    parts.push(components.state);
  }

  return parts.join(', ');
}

// Calculate distance between two coordinates (Haversine formula)
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Generate static map URL for embedding
export function getStaticMapUrl(
  lat: number,
  lng: number,
  options: {
    width?: number;
    height?: number;
    zoom?: number;
    mapType?: 'roadmap' | 'satellite' | 'terrain' | 'hybrid';
    marker?: boolean;
  } = {}
): string {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return '';
  }

  const {
    width = 400,
    height = 300,
    zoom = 15,
    mapType = 'roadmap',
    marker = true,
  } = options;

  let url = `https://maps.googleapis.com/maps/api/staticmap?`;
  url += `center=${lat},${lng}`;
  url += `&zoom=${zoom}`;
  url += `&size=${width}x${height}`;
  url += `&maptype=${mapType}`;

  if (marker) {
    url += `&markers=color:red%7C${lat},${lng}`;
  }

  url += `&key=${apiKey}`;

  return url;
}

// Generate embedded map URL for iframe
export function getEmbedMapUrl(
  lat: number,
  lng: number,
  options: {
    zoom?: number;
    mapMode?: 'place' | 'view' | 'directions' | 'streetview';
  } = {}
): string {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return '';
  }

  const { zoom = 15, mapMode = 'place' } = options;

  return `https://www.google.com/maps/embed/v1/${mapMode}?key=${apiKey}&q=${lat},${lng}&zoom=${zoom}`;
}

// Australian state abbreviations
export const AU_STATES: Record<string, string> = {
  'New South Wales': 'NSW',
  Victoria: 'VIC',
  Queensland: 'QLD',
  'Western Australia': 'WA',
  'South Australia': 'SA',
  Tasmania: 'TAS',
  'Northern Territory': 'NT',
  'Australian Capital Territory': 'ACT',
};

// Validate Australian postcode
export function isValidAustralianPostcode(postcode: string): boolean {
  const postcodeNum = parseInt(postcode, 10);
  return postcodeNum >= 200 && postcodeNum <= 9999;
}

// Get state from Australian postcode
export function getStateFromPostcode(postcode: string): string | null {
  const num = parseInt(postcode, 10);

  if (num >= 200 && num <= 299) return 'ACT';
  if (num >= 2000 && num <= 2599) return 'NSW';
  if (num >= 2619 && num <= 2899) return 'NSW';
  if (num >= 2921 && num <= 2999) return 'NSW';
  if ((num >= 2600 && num <= 2618) || (num >= 2900 && num <= 2920)) return 'ACT';
  if (num >= 3000 && num <= 3999) return 'VIC';
  if (num >= 4000 && num <= 4999) return 'QLD';
  if (num >= 5000 && num <= 5799) return 'SA';
  if (num >= 6000 && num <= 6797) return 'WA';
  if (num >= 7000 && num <= 7799) return 'TAS';
  if (num >= 800 && num <= 899) return 'NT';

  return null;
}

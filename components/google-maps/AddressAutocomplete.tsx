'use client';

/**
 * Google Places Address Autocomplete Component
 * Provides address suggestions as user types
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';

interface AddressComponents {
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

export interface AddressResult {
  address: string;
  formattedAddress: string;
  location: {
    lat: number;
    lng: number;
  };
  placeId: string;
  components: AddressComponents;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect?: (result: AddressResult) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  countryRestriction?: string; // e.g., 'au' for Australia
}

// Simplified Google Maps types
interface GooglePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface GooglePlaceResult {
  formatted_address: string;
  geometry: {
    location: {
      lat: () => number;
      lng: () => number;
    };
  };
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
}

interface GoogleAutocompleteService {
  getPlacePredictions: (
    request: {
      input: string;
      componentRestrictions?: { country: string };
      types?: string[];
    },
    callback: (predictions: GooglePrediction[] | null, status: string) => void
  ) => void;
}

interface GooglePlacesService {
  getDetails: (
    request: { placeId: string; fields: string[] },
    callback: (result: GooglePlaceResult | null, status: string) => void
  ) => void;
}

declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          AutocompleteService: new () => GoogleAutocompleteService;
          PlacesService: new (element: HTMLDivElement) => GooglePlacesService;
          PlacesServiceStatus: {
            OK: string;
          };
        };
      };
    };
    initGoogleMaps?: () => void;
    googleMapsLoaded?: boolean;
  }
}

interface Prediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  placeholder = 'Enter address...',
  className = '',
  disabled = false,
  countryRestriction = 'au',
}: AddressAutocompleteProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<GoogleAutocompleteService | null>(null);
  const placesServiceRef = useRef<GooglePlacesService | null>(null);
  const placesServiceElementRef = useRef<HTMLDivElement | null>(null);

  // Load Google Maps script
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.warn('Google Maps API key not configured');
      return;
    }

    if (window.googleMapsLoaded) {
      setIsGoogleLoaded(true);
      return;
    }

    // Check if script is already loaded
    const existingScript = document.querySelector(
      'script[src*="maps.googleapis.com"]'
    );
    if (existingScript) {
      if (window.google?.maps?.places) {
        window.googleMapsLoaded = true;
        setIsGoogleLoaded(true);
      }
      return;
    }

    // Create callback
    window.initGoogleMaps = () => {
      window.googleMapsLoaded = true;
      setIsGoogleLoaded(true);
    };

    // Load script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      // Cleanup
    };
  }, []);

  // Initialize services when Google is loaded
  useEffect(() => {
    if (isGoogleLoaded && window.google?.maps?.places) {
      autocompleteServiceRef.current =
        new window.google.maps.places.AutocompleteService();

      // Create hidden element for PlacesService
      if (!placesServiceElementRef.current) {
        placesServiceElementRef.current = document.createElement('div');
      }
      placesServiceRef.current = new window.google.maps.places.PlacesService(
        placesServiceElementRef.current
      );
    }
  }, [isGoogleLoaded]);

  // Fetch predictions
  const fetchPredictions = useCallback(
    (input: string) => {
      if (!autocompleteServiceRef.current || input.length < 3) {
        setPredictions([]);
        return;
      }

      setIsLoading(true);

      autocompleteServiceRef.current.getPlacePredictions(
        {
          input,
          componentRestrictions: countryRestriction
            ? { country: countryRestriction }
            : undefined,
          types: ['address'],
        },
        (results: GooglePrediction[] | null, status: string) => {
          setIsLoading(false);

          if (
            status === window.google?.maps?.places?.PlacesServiceStatus?.OK &&
            results
          ) {
            setPredictions(
              results.map((r: GooglePrediction) => ({
                placeId: r.place_id,
                description: r.description,
                mainText: r.structured_formatting.main_text,
                secondaryText: r.structured_formatting.secondary_text,
              }))
            );
            setShowDropdown(true);
          } else {
            setPredictions([]);
          }
        }
      );
    },
    [countryRestriction]
  );

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (value && isGoogleLoaded) {
        fetchPredictions(value);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [value, isGoogleLoaded, fetchPredictions]);

  // Handle place selection
  const selectPlace = useCallback(
    (placeId: string, description: string) => {
      if (!placesServiceRef.current) {
        onChange(description);
        setShowDropdown(false);
        return;
      }

      setIsLoading(true);

      placesServiceRef.current.getDetails(
        {
          placeId,
          fields: ['formatted_address', 'geometry', 'address_components'],
        },
        (result: GooglePlaceResult | null, status: string) => {
          setIsLoading(false);

          if (
            status === window.google?.maps?.places?.PlacesServiceStatus?.OK &&
            result
          ) {
            const addressResult: AddressResult = {
              address: description,
              formattedAddress: result.formatted_address,
              location: {
                lat: result.geometry.location.lat(),
                lng: result.geometry.location.lng(),
              },
              placeId,
              components: parseAddressComponents(result.address_components),
            };

            onChange(result.formatted_address);
            onAddressSelect?.(addressResult);
          } else {
            onChange(description);
          }

          setShowDropdown(false);
          setPredictions([]);
        }
      );
    },
    [onChange, onAddressSelect]
  );

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || predictions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < predictions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && predictions[selectedIndex]) {
          selectPlace(
            predictions[selectedIndex].placeId,
            predictions[selectedIndex].description
          );
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => predictions.length > 0 && setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full pl-10 pr-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 ${
            disabled ? 'bg-muted cursor-not-allowed' : 'bg-background'
          } ${className}`}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {!isLoading && value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setPredictions([]);
              setShowDropdown(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && predictions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {predictions.map((prediction, index) => (
            <button
              key={prediction.placeId}
              type="button"
              onClick={() =>
                selectPlace(prediction.placeId, prediction.description)
              }
              className={`w-full px-4 py-2 text-left hover:bg-muted flex items-start gap-3 ${
                index === selectedIndex ? 'bg-muted' : ''
              }`}
            >
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div>
                <div className="font-medium text-sm">{prediction.mainText}</div>
                <div className="text-xs text-muted-foreground">
                  {prediction.secondaryText}
                </div>
              </div>
            </button>
          ))}
          <div className="px-4 py-2 text-xs text-muted-foreground border-t">
            Powered by Google
          </div>
        </div>
      )}

      {/* No Google Maps warning */}
      {!isGoogleLoaded &&
        !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
          <p className="text-xs text-muted-foreground mt-1">
            Address autocomplete unavailable
          </p>
        )}
    </div>
  );
}

// Helper to parse address components
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

export default AddressAutocomplete;

'use client';

/**
 * AddressAutocomplete Component
 * Uses Google Places API for address suggestions
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

interface AddressDetails {
  formatted_address: string;
  streetNumber?: string;
  street?: string;
  suburb?: string;
  city?: string;
  state?: string;
  stateShort?: string;
  country?: string;
  countryShort?: string;
  postcode?: string;
  lat?: number;
  lng?: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect?: (address: AddressDetails) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  placeholder = 'Start typing an address...',
  disabled = false,
  className,
  id,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch address suggestions
  const fetchSuggestions = useCallback(async (input: string) => {
    if (input.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(input)}`);
      const data = await response.json();

      if (data.predictions) {
        setSuggestions(data.predictions);
      }
    } catch (error) {
      console.error('Error fetching address suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced input handler
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setShowSuggestions(true);
    setSelectedIndex(-1);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce the API call
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  // Parse address components
  const parseAddressComponents = (components: AddressComponent[]): Partial<AddressDetails> => {
    const result: Partial<AddressDetails> = {};

    for (const component of components) {
      const types = component.types;

      if (types.includes('street_number')) {
        result.streetNumber = component.long_name;
      } else if (types.includes('route')) {
        result.street = component.long_name;
      } else if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
        result.suburb = component.long_name;
      } else if (types.includes('locality')) {
        result.city = component.long_name;
        if (!result.suburb) {
          result.suburb = component.long_name;
        }
      } else if (types.includes('administrative_area_level_1')) {
        result.state = component.long_name;
        result.stateShort = component.short_name;
      } else if (types.includes('country')) {
        result.country = component.long_name;
        result.countryShort = component.short_name;
      } else if (types.includes('postal_code')) {
        result.postcode = component.long_name;
      }
    }

    return result;
  };

  // Handle suggestion selection
  const handleSelectSuggestion = async (prediction: PlacePrediction) => {
    onChange(prediction.description);
    setShowSuggestions(false);
    setSuggestions([]);

    // Fetch full address details
    if (onAddressSelect) {
      try {
        const response = await fetch(`/api/places/details?place_id=${prediction.place_id}`);
        const data = await response.json();

        if (data.result) {
          const components = parseAddressComponents(data.result.address_components || []);
          const addressDetails: AddressDetails = {
            formatted_address: data.result.formatted_address,
            ...components,
            lat: data.result.geometry?.location?.lat,
            lng: data.result.geometry?.location?.lng,
          };

          onAddressSelect(addressDetails);
        }
      } catch (error) {
        console.error('Error fetching address details:', error);
      }
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (value.length >= 3) {
              setShowSuggestions(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn('pl-10', className)}
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.place_id}
              type="button"
              className={cn(
                'w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-start gap-2',
                index === selectedIndex && 'bg-gray-100 dark:bg-gray-800'
              )}
              onClick={() => handleSelectSuggestion(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div>
                {suggestion.structured_formatting ? (
                  <>
                    <span className="font-medium">
                      {suggestion.structured_formatting.main_text}
                    </span>
                    <span className="text-muted-foreground">
                      {' '}
                      {suggestion.structured_formatting.secondary_text}
                    </span>
                  </>
                ) : (
                  suggestion.description
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {showSuggestions && value.length >= 3 && suggestions.length === 0 && !isLoading && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg p-4 text-sm text-muted-foreground text-center">
          No addresses found
        </div>
      )}
    </div>
  );
}

export type { AddressDetails };

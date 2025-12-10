'use client';

/**
 * Property Map Component
 * Displays property location on Google Map
 */

import { useState, useEffect } from 'react';
import { MapPin, ExternalLink, Maximize2 } from 'lucide-react';

interface PropertyMapProps {
  address?: string;
  latitude?: number;
  longitude?: number;
  propertyName?: string;
  height?: string;
  showControls?: boolean;
  className?: string;
}

export function PropertyMap({
  address,
  latitude,
  longitude,
  propertyName,
  height = '300px',
  showControls = true,
  className = '',
}: PropertyMapProps) {
  const [mapUrl, setMapUrl] = useState<string>('');
  const [embedUrl, setEmbedUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey) {
      setError('Google Maps API key not configured');
      setIsLoading(false);
      return;
    }

    // If we have coordinates, use them directly
    if (latitude && longitude) {
      const staticUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=15&size=600x400&maptype=roadmap&markers=color:red%7C${latitude},${longitude}&key=${apiKey}`;
      const embed = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${latitude},${longitude}&zoom=15`;

      setMapUrl(staticUrl);
      setEmbedUrl(embed);
      setIsLoading(false);
      return;
    }

    // If we only have address, use it for the map
    if (address) {
      const encodedAddress = encodeURIComponent(address);
      const staticUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodedAddress}&zoom=15&size=600x400&maptype=roadmap&markers=color:red%7C${encodedAddress}&key=${apiKey}`;
      const embed = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodedAddress}&zoom=15`;

      setMapUrl(staticUrl);
      setEmbedUrl(embed);
      setIsLoading(false);
      return;
    }

    setError('No location data available');
    setIsLoading(false);
  }, [address, latitude, longitude, apiKey]);

  // Open in Google Maps
  const openInGoogleMaps = () => {
    let url: string;
    if (latitude && longitude) {
      url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    } else if (address) {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    } else {
      return;
    }
    window.open(url, '_blank');
  };

  // Get directions
  const getDirections = () => {
    let destination: string;
    if (latitude && longitude) {
      destination = `${latitude},${longitude}`;
    } else if (address) {
      destination = encodeURIComponent(address);
    } else {
      return;
    }
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
      '_blank'
    );
  };

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded-lg ${className}`}
        style={{ height }}
      >
        <div className="text-center text-muted-foreground">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded-lg animate-pulse ${className}`}
        style={{ height }}
      >
        <MapPin className="h-8 w-8 text-muted-foreground opacity-50" />
      </div>
    );
  }

  return (
    <div className={`relative rounded-lg overflow-hidden ${className}`}>
      {/* Embedded Map */}
      <iframe
        src={embedUrl}
        width="100%"
        height={height}
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title={propertyName || 'Property Location'}
      />

      {/* Controls Overlay */}
      {showControls && (
        <div className="absolute bottom-3 right-3 flex gap-2">
          <button
            onClick={openInGoogleMaps}
            className="flex items-center gap-1 px-3 py-1.5 bg-background/90 hover:bg-background text-sm rounded-md shadow-md transition-colors"
            title="Open in Google Maps"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">Open in Maps</span>
          </button>
          <button
            onClick={getDirections}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-md shadow-md hover:bg-primary/90 transition-colors"
            title="Get directions"
          >
            <Maximize2 className="h-4 w-4" />
            <span className="hidden sm:inline">Directions</span>
          </button>
        </div>
      )}

      {/* Property Name Badge */}
      {propertyName && (
        <div className="absolute top-3 left-3 px-3 py-1.5 bg-background/90 text-sm rounded-md shadow-md">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="font-medium">{propertyName}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Static Map Image Component
 * Lightweight alternative that loads faster
 */
export function StaticPropertyMap({
  address,
  latitude,
  longitude,
  width = 400,
  height = 300,
  zoom = 15,
  className = '',
}: {
  address?: string;
  latitude?: number;
  longitude?: number;
  width?: number;
  height?: number;
  zoom?: number;
  className?: string;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded-lg ${className}`}
        style={{ width, height }}
      >
        <MapPin className="h-8 w-8 text-muted-foreground opacity-50" />
      </div>
    );
  }

  let center: string;
  if (latitude && longitude) {
    center = `${latitude},${longitude}`;
  } else if (address) {
    center = encodeURIComponent(address);
  } else {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded-lg ${className}`}
        style={{ width, height }}
      >
        <MapPin className="h-8 w-8 text-muted-foreground opacity-50" />
      </div>
    );
  }

  const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=${width}x${height}&maptype=roadmap&markers=color:red%7C${center}&key=${apiKey}`;

  return (
    <img
      src={mapUrl}
      alt="Property location"
      width={width}
      height={height}
      className={`rounded-lg ${className}`}
      loading="lazy"
    />
  );
}

export default PropertyMap;

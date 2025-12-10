# PHASE 20 — GOOGLE MAPS INTEGRATION
**Monitrax Blueprint — Phase 20**
**Version:** v1.0
**Status:** ✅ IMPLEMENTED
**Implemented Date:** 2025-12-10
**Branch:** `claude/google-backend-integrations-01DaDaQEvzPyus6apSWk17wo`

---

## Overview

Google Maps Platform integration provides location services for the Properties module, including address autocomplete, geocoding, and property location visualization.

---

## Objectives

- Enable address autocomplete when entering property addresses
- Geocode addresses to coordinates (latitude/longitude)
- Store location data with properties for mapping features
- Display property locations on interactive maps
- Provide directions to properties

---

## Features Implemented

### 1. Address Autocomplete Component

**Location:** `components/google-maps/AddressAutocomplete.tsx`

- Real-time address suggestions as user types
- Restricted to Australian addresses by default
- Keyboard navigation support
- Parses address into structured components:
  - Street number & name
  - Suburb/locality
  - State (short code: NSW, VIC, etc.)
  - Postcode
  - Country

### 2. Property Map Component

**Location:** `components/google-maps/PropertyMap.tsx`

- Embedded Google Map showing property location
- "Open in Maps" button for full Google Maps experience
- "Directions" button for navigation
- Property name badge overlay
- Configurable height and controls

### 3. Geocoding API

**Endpoint:** `GET /api/geocode`

- Forward geocoding: Address → Coordinates
- Reverse geocoding: Coordinates → Address
- Returns structured address components

### 4. Backend Maps Library

**Location:** `lib/google/maps.ts`

Utilities for:
- `geocodeAddress()` - Convert address to coordinates
- `reverseGeocode()` - Convert coordinates to address
- `getStaticMapUrl()` - Generate static map image URL
- `getEmbedMapUrl()` - Generate embedded map URL
- `calculateDistance()` - Haversine distance between points
- `getStateFromPostcode()` - Australian postcode → state lookup

---

## Data Model Additions

### Property Schema Updates

```prisma
model Property {
  // ... existing fields

  // Location data (Google Maps integration)
  latitude       Float?       // Latitude coordinate
  longitude      Float?       // Longitude coordinate
  googlePlaceId  String?      // Google Places API place_id
  suburb         String?      // Suburb/locality
  state          String?      // State (e.g., NSW, VIC)
  postcode       String?      // Postal code
}
```

---

## Environment Variables

### Backend (Render)

```env
GOOGLE_MAPS_API_KEY=your-backend-api-key
```

### Frontend (Vercel)

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-frontend-api-key
```

**Note:** You can use the same API key for both, but it's more secure to:
- Restrict frontend key by HTTP referrer (your domains)
- Restrict backend key by IP or leave unrestricted (server-side only)

---

## Google Cloud APIs Required

Enable these in Google Cloud Console → APIs & Services → Library:

| API | Purpose |
|-----|---------|
| Maps JavaScript API | Frontend map display |
| Geocoding API | Address → coordinates conversion |
| Places API | Address autocomplete |

---

## Usage Examples

### Address Autocomplete in Property Form

```tsx
import { AddressAutocomplete } from '@/components/google-maps';

function PropertyForm() {
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState({ lat: 0, lng: 0 });
  const [suburb, setSuburb] = useState('');
  const [state, setState] = useState('');
  const [postcode, setPostcode] = useState('');

  return (
    <AddressAutocomplete
      value={address}
      onChange={setAddress}
      onAddressSelect={(result) => {
        setLocation(result.location);
        setSuburb(result.components.suburb || '');
        setState(result.components.stateShort || '');
        setPostcode(result.components.postcode || '');
      }}
      placeholder="Enter property address..."
    />
  );
}
```

### Property Map Display

```tsx
import { PropertyMap } from '@/components/google-maps';

function PropertyDetail({ property }) {
  return (
    <PropertyMap
      latitude={property.latitude}
      longitude={property.longitude}
      address={property.address}
      propertyName={property.name}
      height="400px"
      showControls={true}
    />
  );
}
```

### Backend Geocoding

```typescript
import { geocodeAddress } from '@/lib/google/maps';

const result = await geocodeAddress('123 Main St, Sydney NSW 2000');
// Returns: { location: { lat, lng }, components: {...}, placeId }
```

---

## Files Created

| File | Purpose |
|------|---------|
| `lib/google/maps.ts` | Backend maps utilities |
| `app/api/geocode/route.ts` | Geocoding API endpoint |
| `components/google-maps/AddressAutocomplete.tsx` | Address input component |
| `components/google-maps/PropertyMap.tsx` | Map display component |
| `components/google-maps/index.ts` | Component exports |

---

## Security Considerations

1. **API Key Restrictions**
   - Frontend key: Restrict to your domains
   - Backend key: Restrict to Geocoding API only

2. **Rate Limiting**
   - Google has default quotas per API
   - Monitor usage in Cloud Console

3. **No User Data Exposure**
   - Coordinates stored in database
   - Maps displayed via iframe (no API key exposure)

---

## Cost Estimates

### Google Maps Platform Pricing

| API | Free Tier | Then |
|-----|-----------|------|
| Maps JavaScript | $200/month credit | $7/1000 loads |
| Geocoding | $200/month credit | $5/1000 requests |
| Places Autocomplete | $200/month credit | $2.83/1000 sessions |

**Note:** Google provides $200/month free credit across all Maps APIs.

### Estimated Usage

| Scenario | Monthly Cost |
|----------|--------------|
| 100 properties, 500 map views | Free (within credit) |
| 500 properties, 5000 map views | ~$5-10 |
| 1000 properties, 10000 map views | ~$20-40 |

---

## Future Enhancements

1. **Portfolio Map View** - All properties on single map
2. **Suburb Analytics** - Property values by suburb
3. **Radius Search** - Find properties within X km
4. **Street View Integration** - Property imagery
5. **Commute Time Calculator** - Time to work/school
6. **Property Clustering** - Group nearby properties on map
7. **Heatmaps** - Rental yield by suburb

---

## Testing Checklist

- [ ] Address autocomplete shows suggestions
- [ ] Selecting address populates location fields
- [ ] Property map displays correct location
- [ ] "Open in Maps" opens Google Maps
- [ ] "Directions" opens Google Maps directions
- [ ] API handles missing/invalid addresses
- [ ] Works without API key (graceful degradation)

---

## Integration Points

### Property Add/Edit Dialog

Add `AddressAutocomplete` to replace plain text input for address field.

### Property Detail Dialog

Add `PropertyMap` component to show property location.

### Properties List Page

Add map toggle to show all properties on a portfolio map.

---

## Acceptance Criteria

Phase 20 is complete when:

1. Users can enter addresses with autocomplete suggestions
2. Addresses are geocoded and stored with coordinates
3. Properties display on embedded maps
4. "Open in Maps" and "Directions" work correctly
5. No regressions to existing property functionality

/**
 * Geocoding API
 * GET /api/geocode?address=... - Geocode an address
 * GET /api/geocode?lat=...&lng=... - Reverse geocode coordinates
 *
 * Phase N.2: Migrated from verifyToken to withPermission.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { geocodeAddress, reverseGeocode } from '@/lib/google/maps';

export const GET = withPermission('property.read', async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return NextResponse.json(
        { error: 'Google Maps API not configured' },
        { status: 503 }
      );
    }

    if (address) {
      const result = await geocodeAddress(address);
      if (!result) {
        return NextResponse.json({ error: 'Address not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, result });
    }

    if (lat && lng) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      if (isNaN(latitude) || isNaN(longitude)) {
        return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
      }
      const result = await reverseGeocode(latitude, longitude);
      if (!result) {
        return NextResponse.json({ error: 'Location not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json(
      { error: 'Missing address or coordinates' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Geocoding API error:', error);
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 500 });
  }
});

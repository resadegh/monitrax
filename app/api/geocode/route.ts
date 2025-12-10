/**
 * Geocoding API
 * GET /api/geocode?address=... - Geocode an address
 * GET /api/geocode?lat=...&lng=... - Reverse geocode coordinates
 */

import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { geocodeAddress, reverseGeocode } from '@/lib/google/maps';

export async function GET(request: Request) {
  try {
    // Verify authentication
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    // Check if API key is configured
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return NextResponse.json(
        { error: 'Google Maps API not configured' },
        { status: 503 }
      );
    }

    // Forward geocoding (address to coordinates)
    if (address) {
      const result = await geocodeAddress(address);

      if (!result) {
        return NextResponse.json(
          { error: 'Address not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        result,
      });
    }

    // Reverse geocoding (coordinates to address)
    if (lat && lng) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);

      if (isNaN(latitude) || isNaN(longitude)) {
        return NextResponse.json(
          { error: 'Invalid coordinates' },
          { status: 400 }
        );
      }

      const result = await reverseGeocode(latitude, longitude);

      if (!result) {
        return NextResponse.json(
          { error: 'Location not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        result,
      });
    }

    return NextResponse.json(
      { error: 'Missing address or coordinates' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Geocoding API error:', error);
    return NextResponse.json(
      { error: 'Geocoding failed' },
      { status: 500 }
    );
  }
}

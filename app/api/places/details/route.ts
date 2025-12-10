import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/places/details
 * Get full address details from a place_id
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const placeId = searchParams.get('place_id');

    if (!placeId) {
      return NextResponse.json(
        { error: 'place_id is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      // In development, return mock details
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json({
          result: {
            place_id: placeId,
            formatted_address: '123 Example Street, Sydney NSW 2000, Australia',
            address_components: [
              { long_name: '123', short_name: '123', types: ['street_number'] },
              { long_name: 'Example Street', short_name: 'Example St', types: ['route'] },
              { long_name: 'Sydney', short_name: 'Sydney', types: ['locality'] },
              { long_name: 'New South Wales', short_name: 'NSW', types: ['administrative_area_level_1'] },
              { long_name: 'Australia', short_name: 'AU', types: ['country'] },
              { long_name: '2000', short_name: '2000', types: ['postal_code'] },
            ],
            geometry: {
              location: { lat: -33.8688, lng: 151.2093 },
            },
          },
        });
      }
      return NextResponse.json(
        { error: 'Google Places API not configured' },
        { status: 500 }
      );
    }

    // Build Google Places Details API URL
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('fields', 'formatted_address,address_components,geometry');

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error('Google Places API request failed');
    }

    const data = await response.json();

    return NextResponse.json({
      result: data.result || null,
    });
  } catch (error) {
    console.error('Places details error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch address details' },
      { status: 500 }
    );
  }
}

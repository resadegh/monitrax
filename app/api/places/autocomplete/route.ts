import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/places/autocomplete
 * Proxy Google Places Autocomplete API to keep API key server-side
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const input = searchParams.get('input');

    if (!input || input.length < 3) {
      return NextResponse.json({ predictions: [] });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      // In development, return mock suggestions
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json({
          predictions: [
            {
              place_id: 'mock_1',
              description: `${input}, Sydney NSW, Australia`,
              structured_formatting: {
                main_text: input,
                secondary_text: 'Sydney NSW, Australia',
              },
            },
            {
              place_id: 'mock_2',
              description: `${input}, Melbourne VIC, Australia`,
              structured_formatting: {
                main_text: input,
                secondary_text: 'Melbourne VIC, Australia',
              },
            },
            {
              place_id: 'mock_3',
              description: `${input}, Brisbane QLD, Australia`,
              structured_formatting: {
                main_text: input,
                secondary_text: 'Brisbane QLD, Australia',
              },
            },
          ],
        });
      }
      return NextResponse.json(
        { error: 'Google Places API not configured' },
        { status: 500 }
      );
    }

    // Build Google Places API URL
    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', input);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('components', 'country:au|country:nz'); // Restrict to Australia and New Zealand
    url.searchParams.set('types', 'address'); // Only return addresses

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error('Google Places API request failed');
    }

    const data = await response.json();

    return NextResponse.json({
      predictions: data.predictions || [],
    });
  } catch (error) {
    console.error('Places autocomplete error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch address suggestions' },
      { status: 500 }
    );
  }
}

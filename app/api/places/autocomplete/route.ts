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
      console.warn('Places API: No API key configured (GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY)');
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
        { error: 'Google Places API not configured', predictions: [] },
        { status: 200 }
      );
    }

    // Build Google Places API URL
    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', input);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('components', 'country:au|country:nz'); // Restrict to Australia and New Zealand
    url.searchParams.set('types', 'address'); // Only return addresses

    console.log('Places API request for:', input);

    const response = await fetch(url.toString());
    const data = await response.json();

    // Check for API errors
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Places API error:', data.status, data.error_message);

      // Common error statuses
      if (data.status === 'REQUEST_DENIED') {
        console.error('Places API: Request denied. Check if Places API is enabled and API key has correct permissions.');
      } else if (data.status === 'OVER_QUERY_LIMIT') {
        console.error('Places API: Over query limit.');
      } else if (data.status === 'INVALID_REQUEST') {
        console.error('Places API: Invalid request.');
      }

      return NextResponse.json({
        predictions: [],
        error: data.error_message || `API returned status: ${data.status}`,
      });
    }

    return NextResponse.json({
      predictions: data.predictions || [],
    });
  } catch (error) {
    console.error('Places autocomplete error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch address suggestions', predictions: [] },
      { status: 200 }
    );
  }
}

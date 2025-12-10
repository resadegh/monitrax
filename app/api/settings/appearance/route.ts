import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { prisma } from '@/lib/db';

/**
 * GET /api/settings/appearance
 * Get user appearance preferences
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get or create user preferences
    let preferences = await prisma.userPreference.findUnique({
      where: { userId: auth.userId },
    });

    if (!preferences) {
      preferences = await prisma.userPreference.create({
        data: {
          userId: auth.userId,
          preferredCurrency: 'AUD',
          preferredDateFormat: 'DD/MM/YYYY',
          country: 'AU',
        },
      });
    }

    return NextResponse.json({
      currency: preferences.preferredCurrency,
      dateFormat: preferences.preferredDateFormat,
      country: preferences.country,
      // Theme is typically handled client-side via next-themes
      theme: 'system',
      showCents: true,
      compactMode: false,
      financialYearStart: preferences.country === 'AU' ? '07-01' : '04-01',
    });
  } catch (error) {
    console.error('Get appearance settings error:', error);
    return NextResponse.json(
      { error: 'Failed to get appearance settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/appearance
 * Update user appearance preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { currency, dateFormat, country } = body;

    // Validate currency
    const validCurrencies = ['AUD', 'NZD', 'USD', 'GBP', 'EUR'];
    if (currency && !validCurrencies.includes(currency)) {
      return NextResponse.json(
        { error: 'Invalid currency' },
        { status: 400 }
      );
    }

    // Validate date format
    const validDateFormats = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
    if (dateFormat && !validDateFormats.includes(dateFormat)) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    // Validate country
    const validCountries = ['AU', 'NZ', 'US', 'GB', 'EU'];
    if (country && !validCountries.includes(country)) {
      return NextResponse.json(
        { error: 'Invalid country' },
        { status: 400 }
      );
    }

    // Update or create preferences
    const preferences = await prisma.userPreference.upsert({
      where: { userId: auth.userId },
      update: {
        ...(currency && { preferredCurrency: currency }),
        ...(dateFormat && { preferredDateFormat: dateFormat }),
        ...(country && { country }),
      },
      create: {
        userId: auth.userId,
        preferredCurrency: currency || 'AUD',
        preferredDateFormat: dateFormat || 'DD/MM/YYYY',
        country: country || 'AU',
      },
    });

    return NextResponse.json({
      success: true,
      preferences: {
        currency: preferences.preferredCurrency,
        dateFormat: preferences.preferredDateFormat,
        country: preferences.country,
      },
    });
  } catch (error) {
    console.error('Update appearance settings error:', error);
    return NextResponse.json(
      { error: 'Failed to update appearance settings' },
      { status: 500 }
    );
  }
}

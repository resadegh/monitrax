import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { prisma } from '@/lib/db';

/**
 * GET /api/settings/appearance
 *
 * Returns the user's appearance preferences. After the 2026-05-08
 * settings overhaul this reads theme / showCents / compactMode /
 * financialYearStart from user_preferences (previously hardcoded).
 *
 * `next-themes` continues to own runtime theme application via cookie;
 * this route is the cross-device source of truth.
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
      taxYear: preferences.taxYear,
      theme: preferences.theme,
      showCents: preferences.showCents,
      compactMode: preferences.compactMode,
      financialYearStart: preferences.financialYearStart,
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
 *
 * Persists appearance preferences. Per CLAUDE.md §12.11 the upsert
 * here only ever touches the user's own user_preferences row (unique
 * key = userId, scope = self), and only updates fields the user
 * explicitly sent — every column update is gated on `xxx !== undefined`.
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
    const {
      currency,
      dateFormat,
      country,
      taxYear,
      theme,
      showCents,
      compactMode,
      financialYearStart,
    } = body;

    const validCurrencies = ['AUD', 'NZD', 'USD', 'GBP', 'EUR'];
    if (currency && !validCurrencies.includes(currency)) {
      return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
    }

    const validDateFormats = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
    if (dateFormat && !validDateFormats.includes(dateFormat)) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    const validCountries = ['AU', 'NZ', 'US', 'GB', 'EU'];
    if (country && !validCountries.includes(country)) {
      return NextResponse.json({ error: 'Invalid country' }, { status: 400 });
    }

    const validThemes = ['light', 'dark', 'system'];
    if (theme && !validThemes.includes(theme)) {
      return NextResponse.json({ error: 'Invalid theme' }, { status: 400 });
    }

    if (
      financialYearStart &&
      !/^\d{2}-\d{2}$/.test(String(financialYearStart))
    ) {
      return NextResponse.json(
        { error: 'financialYearStart must be MM-DD' },
        { status: 400 }
      );
    }

    if (taxYear && !/^\d{4}-\d{4}$/.test(String(taxYear))) {
      return NextResponse.json(
        { error: 'taxYear must be YYYY-YYYY (e.g. 2025-2026)' },
        { status: 400 }
      );
    }

    const preferences = await prisma.userPreference.upsert({
      where: { userId: auth.userId },
      update: {
        ...(currency !== undefined && { preferredCurrency: currency }),
        ...(dateFormat !== undefined && { preferredDateFormat: dateFormat }),
        ...(country !== undefined && { country }),
        ...(taxYear !== undefined && { taxYear }),
        ...(theme !== undefined && { theme }),
        ...(showCents !== undefined && { showCents: !!showCents }),
        ...(compactMode !== undefined && { compactMode: !!compactMode }),
        ...(financialYearStart !== undefined && { financialYearStart }),
      },
      create: {
        userId: auth.userId,
        preferredCurrency: currency || 'AUD',
        preferredDateFormat: dateFormat || 'DD/MM/YYYY',
        country: country || 'AU',
        taxYear: taxYear ?? null,
        theme: theme || 'system',
        showCents: showCents === undefined ? true : !!showCents,
        compactMode: !!compactMode,
        financialYearStart: financialYearStart || '07-01',
      },
    });

    return NextResponse.json({
      success: true,
      preferences: {
        currency: preferences.preferredCurrency,
        dateFormat: preferences.preferredDateFormat,
        country: preferences.country,
        taxYear: preferences.taxYear,
        theme: preferences.theme,
        showCents: preferences.showCents,
        compactMode: preferences.compactMode,
        financialYearStart: preferences.financialYearStart,
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

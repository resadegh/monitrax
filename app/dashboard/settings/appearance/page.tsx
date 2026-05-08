'use client';

/**
 * Appearance Settings (Phase 19.1, expanded by Settings overhaul 2026-05-08)
 *
 * Theme + display preferences. Prior to 2026-05-08 the form let users
 * toggle theme / showCents / compactMode / financialYearStart but the
 * API silently dropped every one of those fields on PUT. Now every
 * toggle persists to user_preferences via the new appearance route.
 *
 * Country + tax-year additions: Phase 20 (AU Tax Intelligence) and
 * Phase 41 (Entity Layer) are sensitive to both fields and the schema
 * already had them — they were just never UI-exposed.
 */

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Palette,
  Sun,
  Moon,
  Monitor,
  DollarSign,
  Calendar,
  Save,
  Loader2,
  CheckCircle,
  Globe,
  AlertTriangle,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/context/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

type Theme = 'light' | 'dark' | 'system';
type Country = 'AU' | 'NZ' | 'US' | 'GB' | 'EU';

interface Preferences {
  currency: string;
  dateFormat: string;
  country: Country;
  taxYear: string;
  theme: Theme;
  showCents: boolean;
  compactMode: boolean;
  financialYearStart: string;
}

const DEFAULTS: Preferences = {
  currency: 'AUD',
  dateFormat: 'DD/MM/YYYY',
  country: 'AU',
  taxYear: '',
  theme: 'system',
  showCents: true,
  compactMode: false,
  financialYearStart: '07-01',
};

// Auto-suggest a financial-year start when the country changes — but
// don't override an explicit user choice. Matches the old hardcoded
// derivation in the API GET so existing users see no change.
const FY_BY_COUNTRY: Record<Country, string> = {
  AU: '07-01',
  NZ: '04-01',
  US: '01-01',
  GB: '04-06',
  EU: '01-01',
};

const CURRENCY_BY_COUNTRY: Record<Country, string> = {
  AU: 'AUD',
  NZ: 'NZD',
  US: 'USD',
  GB: 'GBP',
  EU: 'EUR',
};

export default function AppearanceSettingsPage() {
  const { theme: localTheme, setTheme } = useTheme();
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);

  useEffect(() => {
    const loadPreferences = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/settings/appearance', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          const next: Preferences = {
            currency: data.currency || 'AUD',
            dateFormat: data.dateFormat || 'DD/MM/YYYY',
            country: (data.country as Country) || 'AU',
            taxYear: data.taxYear || '',
            theme: (data.theme as Theme) || 'system',
            showCents: data.showCents ?? true,
            compactMode: data.compactMode ?? false,
            financialYearStart: data.financialYearStart || '07-01',
          };
          setPreferences(next);
          // Sync next-themes to the persisted choice so the runtime
          // theme matches the cross-device source of truth on load.
          if (next.theme && next.theme !== localTheme) {
            setTheme(next.theme);
          }
        }
      } catch (error) {
        console.error('Failed to load appearance settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const updateTheme = (next: Theme) => {
    setTheme(next);
    setPreferences((p) => ({ ...p, theme: next }));
  };

  const updateCountry = (next: Country) => {
    setPreferences((p) => ({
      ...p,
      country: next,
      // Only auto-fill currency / FY if the user is still on defaults
      // for the previous country — otherwise respect their override.
      currency:
        p.currency === CURRENCY_BY_COUNTRY[p.country]
          ? CURRENCY_BY_COUNTRY[next]
          : p.currency,
      financialYearStart:
        p.financialYearStart === FY_BY_COUNTRY[p.country]
          ? FY_BY_COUNTRY[next]
          : p.financialYearStart,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/settings/appearance', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...preferences,
          // Empty taxYear means "clear it"; send null so the server
          // upsert nulls the column instead of trying to validate ''.
          taxYear: preferences.taxYear || null,
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to save');
      }

      setSuccessMessage('Saved');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to save'
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Theme
          </CardTitle>
          <CardDescription>
            Saved across devices once you click Save.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => updateTheme('light')}
              className={`p-4 rounded-lg border-2 transition-all ${
                preferences.theme === 'light'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              <Sun className="h-6 w-6 mx-auto mb-2" />
              <p className="text-sm font-medium">Light</p>
            </button>
            <button
              onClick={() => updateTheme('dark')}
              className={`p-4 rounded-lg border-2 transition-all ${
                preferences.theme === 'dark'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              <Moon className="h-6 w-6 mx-auto mb-2" />
              <p className="text-sm font-medium">Dark</p>
            </button>
            <button
              onClick={() => updateTheme('system')}
              className={`p-4 rounded-lg border-2 transition-all ${
                preferences.theme === 'system'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              <Monitor className="h-6 w-6 mx-auto mb-2" />
              <p className="text-sm font-medium">System</p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Locale & Tax */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Locale &amp; Tax
          </CardTitle>
          <CardDescription>
            Used by the tax engine and the financial-year boundary in
            Reports.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="country">Country</Label>
            <select
              id="country"
              value={preferences.country}
              onChange={(e) => updateCountry(e.target.value as Country)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="AU">Australia</option>
              <option value="NZ">New Zealand</option>
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="EU">Other (Eurozone)</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Tax engines and ATO/IRD-specific logic key off this field.
            </p>
          </div>
          <Separator />
          <div className="grid gap-2">
            <Label htmlFor="taxYear">Tax year (optional)</Label>
            <input
              id="taxYear"
              type="text"
              placeholder="e.g. 2025-2026"
              value={preferences.taxYear}
              onChange={(e) =>
                setPreferences({ ...preferences, taxYear: e.target.value })
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Format: YYYY-YYYY. Leave blank to use the current year
              automatically.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Currency & Formatting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Currency &amp; numbers
          </CardTitle>
          <CardDescription>
            How currencies and decimals are displayed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="currency">Currency</Label>
            <select
              id="currency"
              value={preferences.currency}
              onChange={(e) =>
                setPreferences({ ...preferences, currency: e.target.value })
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="AUD">Australian Dollar (AUD)</option>
              <option value="NZD">New Zealand Dollar (NZD)</option>
              <option value="USD">US Dollar (USD)</option>
              <option value="GBP">British Pound (GBP)</option>
              <option value="EUR">Euro (EUR)</option>
            </select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show cents</Label>
              <p className="text-sm text-muted-foreground">
                Display decimal places in currency values.
              </p>
            </div>
            <Switch
              checked={preferences.showCents}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, showCents: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Date & calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Dates &amp; financial year
          </CardTitle>
          <CardDescription>
            Date format + the start date of your financial year.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="dateFormat">Date format</Label>
            <select
              id="dateFormat"
              value={preferences.dateFormat}
              onChange={(e) =>
                setPreferences({ ...preferences, dateFormat: e.target.value })
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2024)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2024)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</option>
            </select>
          </div>
          <Separator />
          <div className="grid gap-2">
            <Label htmlFor="fyStart">Financial year starts</Label>
            <select
              id="fyStart"
              value={preferences.financialYearStart}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  financialYearStart: e.target.value,
                })
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="07-01">July 1 (Australia)</option>
              <option value="04-01">April 1 (New Zealand)</option>
              <option value="01-01">January 1 (calendar year)</option>
              <option value="04-06">April 6 (UK)</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Used for tax calculations and annual reports.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Display Options */}
      <Card>
        <CardHeader>
          <CardTitle>Display options</CardTitle>
          <CardDescription>
            Customise interface density.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Compact mode</Label>
              <p className="text-sm text-muted-foreground">
                Reduce spacing for a denser interface.
              </p>
            </div>
            <Switch
              checked={preferences.compactMode}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, compactMode: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-end gap-4">
        {successMessage && (
          <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
            <CheckCircle className="h-4 w-4" />
            {successMessage}
          </span>
        )}
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save preferences
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

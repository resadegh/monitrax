'use client';

/**
 * Phase 19.1: Appearance Settings Page
 * Theme and display preferences
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Palette, Sun, Moon, Monitor, DollarSign, Calendar, Save, Loader2 } from 'lucide-react';
import { useTheme } from 'next-themes';

export default function AppearanceSettingsPage() {
  const { theme, setTheme } = useTheme();
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    currency: 'AUD',
    dateFormat: 'DD/MM/YYYY',
    compactMode: false,
    showCents: true,
    financialYearStart: '07-01', // July 1st for Australia
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch('/api/settings/appearance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });
      alert('Appearance settings saved');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Theme Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Theme
          </CardTitle>
          <CardDescription>
            Choose your preferred color scheme
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => setTheme('light')}
              className={`p-4 rounded-lg border-2 transition-all ${
                theme === 'light'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              <Sun className="h-6 w-6 mx-auto mb-2" />
              <p className="text-sm font-medium">Light</p>
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`p-4 rounded-lg border-2 transition-all ${
                theme === 'dark'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              <Moon className="h-6 w-6 mx-auto mb-2" />
              <p className="text-sm font-medium">Dark</p>
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`p-4 rounded-lg border-2 transition-all ${
                theme === 'system'
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

      {/* Currency & Formatting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Currency & Formatting
          </CardTitle>
          <CardDescription>
            Configure how numbers and currencies are displayed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="currency">Currency</Label>
            <select
              id="currency"
              value={preferences.currency}
              onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
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
              <Label>Show Cents</Label>
              <p className="text-sm text-muted-foreground">
                Display decimal places in currency values
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

      {/* Date & Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Date & Calendar
          </CardTitle>
          <CardDescription>
            Configure date formats and financial year settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="dateFormat">Date Format</Label>
            <select
              id="dateFormat"
              value={preferences.dateFormat}
              onChange={(e) => setPreferences({ ...preferences, dateFormat: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2024)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2024)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</option>
              <option value="D MMM YYYY">D MMM YYYY (31 Dec 2024)</option>
            </select>
          </div>
          <Separator />
          <div className="grid gap-2">
            <Label htmlFor="fyStart">Financial Year Start</Label>
            <select
              id="fyStart"
              value={preferences.financialYearStart}
              onChange={(e) =>
                setPreferences({ ...preferences, financialYearStart: e.target.value })
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="07-01">July 1 (Australia)</option>
              <option value="04-01">April 1 (New Zealand)</option>
              <option value="01-01">January 1 (Calendar Year)</option>
              <option value="04-06">April 6 (UK)</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Used for tax calculations and annual reports
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Display Options */}
      <Card>
        <CardHeader>
          <CardTitle>Display Options</CardTitle>
          <CardDescription>
            Customize the interface density and layout
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Compact Mode</Label>
              <p className="text-sm text-muted-foreground">
                Reduce spacing for a denser interface
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

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Preferences
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

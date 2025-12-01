'use client';

/**
 * Phase 19.1: Notification Settings Page
 * Manage email and push notification preferences
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Bell, Mail, Smartphone, AlertTriangle, TrendingUp, Calendar, Save, Loader2 } from 'lucide-react';

interface NotificationSettings {
  email: {
    weeklyDigest: boolean;
    monthlyReport: boolean;
    alerts: boolean;
    productUpdates: boolean;
  };
  push: {
    enabled: boolean;
    cashflowAlerts: boolean;
    spendingAlerts: boolean;
    goalProgress: boolean;
    billReminders: boolean;
  };
}

export default function NotificationSettingsPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    email: {
      weeklyDigest: true,
      monthlyReport: true,
      alerts: true,
      productUpdates: false,
    },
    push: {
      enabled: true,
      cashflowAlerts: true,
      spendingAlerts: true,
      goalProgress: false,
      billReminders: true,
    },
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      alert('Notification settings saved');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Choose what emails you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Weekly Digest</Label>
              <p className="text-sm text-muted-foreground">
                Summary of your financial activity every Sunday
              </p>
            </div>
            <Switch
              checked={settings.email.weeklyDigest}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, email: { ...settings.email, weeklyDigest: checked } })
              }
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Monthly Report</Label>
              <p className="text-sm text-muted-foreground">
                Detailed monthly financial report on the 1st
              </p>
            </div>
            <Switch
              checked={settings.email.monthlyReport}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, email: { ...settings.email, monthlyReport: checked } })
              }
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Important Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Critical notifications about your finances
              </p>
            </div>
            <Switch
              checked={settings.email.alerts}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, email: { ...settings.email, alerts: checked } })
              }
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Product Updates</Label>
              <p className="text-sm text-muted-foreground">
                New features and improvements to Monitrax
              </p>
            </div>
            <Switch
              checked={settings.email.productUpdates}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, email: { ...settings.email, productUpdates: checked } })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Real-time alerts on your device
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Push Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications in your browser or mobile app
              </p>
            </div>
            <Switch
              checked={settings.push.enabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, push: { ...settings.push, enabled: checked } })
              }
            />
          </div>
          <Separator />

          {settings.push.enabled && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <div className="space-y-0.5">
                    <Label>Cashflow Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Low balance and shortfall warnings
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.push.cashflowAlerts}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, push: { ...settings.push, cashflowAlerts: checked } })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-4 w-4 text-red-500" />
                  <div className="space-y-0.5">
                    <Label>Spending Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Overspending and unusual transactions
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.push.spendingAlerts}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, push: { ...settings.push, spendingAlerts: checked } })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-4 w-4 text-green-500" />
                  <div className="space-y-0.5">
                    <Label>Goal Progress</Label>
                    <p className="text-sm text-muted-foreground">
                      Updates on your savings goals
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.push.goalProgress}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, push: { ...settings.push, goalProgress: checked } })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  <div className="space-y-0.5">
                    <Label>Bill Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Upcoming bills and payments
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.push.billReminders}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, push: { ...settings.push, billReminders: checked } })
                  }
                />
              </div>
            </>
          )}
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

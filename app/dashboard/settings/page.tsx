'use client';

/**
 * Phase 19.1: General Settings Page
 * Main settings overview with quick access to common settings
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Cloud,
  User,
  Bell,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Settings,
} from 'lucide-react';

interface SettingsStatus {
  security: {
    mfaEnabled: boolean;
    passwordAge: number; // days since last change
    sessionsCount: number;
  };
  storage: {
    provider: string;
    connected: boolean;
    documentsCount: number;
    storageUsed: number; // bytes
  };
  notifications: {
    emailEnabled: boolean;
    pushEnabled: boolean;
  };
}

export default function GeneralSettingsPage() {
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch settings status
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/settings/status');
        if (response.ok) {
          const data = await response.json();
          setStatus(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch settings status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // For now, use mock data
    setStatus({
      security: {
        mfaEnabled: false,
        passwordAge: 30,
        sessionsCount: 2,
      },
      storage: {
        provider: 'MONITRAX',
        connected: true,
        documentsCount: 12,
        storageUsed: 25 * 1024 * 1024, // 25MB
      },
      notifications: {
        emailEnabled: true,
        pushEnabled: false,
      },
    });
    setIsLoading(false);
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Account Overview
          </CardTitle>
          <CardDescription>
            Quick summary of your account settings and configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Security Status */}
          <Link href="/dashboard/settings/security">
            <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <div className="font-medium flex items-center gap-2">
                    Security
                    {status?.security.mfaEnabled ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        2FA Enabled
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        2FA Off
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {status?.security.sessionsCount} active sessions
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Link>

          {/* Storage Status */}
          <Link href="/dashboard/settings/storage">
            <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Cloud className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="font-medium flex items-center gap-2">
                    Cloud Storage
                    <Badge variant="outline">
                      {status?.storage.provider === 'MONITRAX'
                        ? 'Monitrax Storage'
                        : status?.storage.provider === 'GOOGLE_DRIVE'
                        ? 'Google Drive'
                        : status?.storage.provider === 'ICLOUD'
                        ? 'iCloud'
                        : status?.storage.provider}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {status?.storage.documentsCount} documents &middot;{' '}
                    {formatBytes(status?.storage.storageUsed || 0)} used
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Link>

          {/* Notifications Status */}
          <Link href="/dashboard/settings/notifications">
            <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="font-medium">Notifications</div>
                  <p className="text-sm text-muted-foreground">
                    Email: {status?.notifications.emailEnabled ? 'On' : 'Off'} &middot;
                    Push: {status?.notifications.pushEnabled ? 'On' : 'Off'}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Link>

          {/* Profile */}
          <Link href="/dashboard/settings/profile">
            <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <User className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="font-medium">Profile</div>
                  <p className="text-sm text-muted-foreground">
                    Update your personal information
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Link>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common settings tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/dashboard/settings/storage">
              <Button variant="outline" className="w-full justify-start">
                <Cloud className="h-4 w-4 mr-2" />
                Connect Cloud Storage
              </Button>
            </Link>
            <Link href="/dashboard/settings/security">
              <Button variant="outline" className="w-full justify-start">
                <Shield className="h-4 w-4 mr-2" />
                Enable Two-Factor Auth
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

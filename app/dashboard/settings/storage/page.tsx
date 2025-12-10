'use client';

/**
 * Phase 19.1: Cloud Storage Settings Page
 * Manage storage providers (Monitrax Cloud Storage and Local Drive)
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Cloud,
  HardDrive,
  CheckCircle,
  FolderOpen,
  Lock,
  Server,
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { LocalDriveStorageCard } from '@/components/documents/LocalDriveStorageCard';

// Storage provider configuration
interface StorageProvider {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  connected: boolean;
  isActive: boolean;
  storageUsed?: number;
  storageLimit?: number;
  available: boolean;
}

// Monitrax Cloud Storage Icon
const MonitraxCloudIcon = () => (
  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
    <Cloud className="h-5 w-5 text-white" />
  </div>
);

// Local Drive Icon
const LocalDriveIcon = () => (
  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center">
    <HardDrive className="h-5 w-5 text-white" />
  </div>
);

interface StorageHealthData {
  storage: {
    configured: { monitrax: boolean; googleCloudStorage: boolean };
    healthy: { monitrax: boolean; googleCloudStorage: boolean };
    activeProvider: string;
    googleCloudStorage?: {
      bucket: string;
      location: string;
      storageClass: string;
    };
  };
}

export default function StorageSettingsPage() {
  const { token } = useAuth();
  const [activeProvider, setActiveProvider] = useState<string>('monitrax');
  const [storageHealth, setStorageHealth] = useState<StorageHealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const providers: StorageProvider[] = [
    {
      id: 'monitrax',
      name: 'Monitrax Cloud Storage',
      description: 'Secure, scalable cloud storage powered by Google Cloud. Included with your account.',
      icon: <MonitraxCloudIcon />,
      color: 'emerald',
      connected: true,
      isActive: activeProvider === 'monitrax',
      available: true,
    },
    {
      id: 'local_drive',
      name: 'Local Drive',
      description: 'Store documents on your local computer. Files stay on your device and are not uploaded.',
      icon: <LocalDriveIcon />,
      color: 'slate',
      connected: false,
      isActive: activeProvider === 'local_drive',
      available: true,
    },
  ];

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      setIsLoading(true);

      try {
        // Fetch storage health status
        const healthRes = await fetch('/api/storage/health', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          setStorageHealth(healthData);
        }

        // Fetch user's storage settings
        const settingsRes = await fetch('/api/settings/storage', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          if (settingsData.data?.activeProvider) {
            // Normalize to lowercase for UI consistency
            setActiveProvider(settingsData.data.activeProvider.toLowerCase());
          }
        }
      } catch (error) {
        console.error('Failed to fetch storage settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const handleSetActive = async (providerId: string) => {
    try {
      const response = await fetch('/api/settings/storage/active', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ providerId }),
      });

      if (response.ok) {
        setActiveProvider(providerId);
      }
    } catch (error) {
      console.error('Failed to set active provider:', error);
    }
  };

  // Get storage status info
  const getStorageStatus = () => {
    if (!storageHealth) return null;

    const isGCSActive = storageHealth.storage.activeProvider === 'google_cloud_storage';
    const isGCSHealthy = storageHealth.storage.healthy.googleCloudStorage;

    return {
      isGCSActive,
      isGCSHealthy,
      bucket: storageHealth.storage.googleCloudStorage?.bucket,
      location: storageHealth.storage.googleCloudStorage?.location,
    };
  };

  const status = getStorageStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Storage Settings
          </CardTitle>
          <CardDescription>
            Choose where your documents are stored. Monitrax Cloud Storage provides secure,
            automatic backups. Local Drive keeps files on your computer only.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Storage Status */}
      {status && (
        <Card className={status.isGCSHealthy ? 'border-green-200 dark:border-green-800' : 'border-yellow-200 dark:border-yellow-800'}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Server className={`h-5 w-5 ${status.isGCSHealthy ? 'text-green-600' : 'text-yellow-600'}`} />
              <div className="flex-1">
                <p className="font-medium">
                  {status.isGCSHealthy ? 'Cloud Storage Connected' : 'Storage Status'}
                </p>
                {status.isGCSHealthy && status.bucket && (
                  <p className="text-sm text-muted-foreground">
                    Bucket: {status.bucket} ({status.location})
                  </p>
                )}
              </div>
              <Badge variant={status.isGCSHealthy ? 'default' : 'secondary'} className={status.isGCSHealthy ? 'bg-green-500' : ''}>
                {status.isGCSHealthy ? 'Healthy' : 'Checking...'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Storage Provider</CardTitle>
          <CardDescription>
            Choose where new documents will be stored by default
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted">
            <div className="flex items-center gap-3">
              {providers.find((p) => p.id === activeProvider)?.icon}
              <div>
                <p className="font-medium">
                  {providers.find((p) => p.id === activeProvider)?.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  All new documents will be stored here
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Storage Providers */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Available Storage Options</h3>

        {/* Monitrax Cloud Storage */}
        <Card className={activeProvider === 'monitrax' ? 'ring-2 ring-emerald-500' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <MonitraxCloudIcon />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">Monitrax Cloud Storage</h3>
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                    {activeProvider === 'monitrax' && (
                      <Badge variant="outline">Active</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Secure cloud storage powered by Google Cloud Platform. Your documents are
                    encrypted, automatically backed up, and accessible from any device.
                  </p>
                  <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Automatic backups
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Encrypted at rest and in transit
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Access from any device
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Included with your subscription
                    </li>
                  </ul>
                </div>
              </div>
              {activeProvider !== 'monitrax' && (
                <Button
                  variant="outline"
                  onClick={() => handleSetActive('monitrax')}
                >
                  Set as Active
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Local Drive Storage */}
        <LocalDriveStorageCard />
      </div>

      {/* Security Notice */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">
                Security & Privacy
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Monitrax Cloud Storage uses Google Cloud Platform infrastructure with enterprise-grade
                security. All documents are encrypted during transfer (TLS) and at rest (AES-256).
                Access is controlled via secure, time-limited signed URLs.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Folder Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Folder Organization
          </CardTitle>
          <CardDescription>
            Configure how documents are organized in your storage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Organize by Financial Year (Australian)</Label>
              <p className="text-sm text-muted-foreground">
                Group documents by Australian FY (July - June) for easy tax preparation
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-organize by category</Label>
              <p className="text-sm text-muted-foreground">
                Automatically organize documents into category folders (Receipts, Contracts, etc.)
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Include dates in filenames</Label>
              <p className="text-sm text-muted-foreground">
                Prefix filenames with upload date (e.g., 2024-01-15_document.pdf)
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

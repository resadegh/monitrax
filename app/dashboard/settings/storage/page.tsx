'use client';

/**
 * Phase 19.1: Cloud Storage Settings Page
 * Connect and manage cloud storage providers (Google Drive, iCloud, OneDrive, Local Drive)
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Cloud,
  HardDrive,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Trash2,
  RefreshCw,
  FolderOpen,
  Lock,
  Loader2,
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
  email?: string;
  storageUsed?: number;
  storageLimit?: number;
  folderPath?: string;
  lastSync?: Date;
  available: boolean; // Whether the provider is available for connection
}

// Provider icons/branding
const GoogleDriveIcon = () => (
  <svg viewBox="0 0 87.3 78" className="h-6 w-6">
    <path d="M6.6 66.85l14.3-24.75L34.7 66.85z" fill="#0066DA" />
    <path d="M57.4 0l-24 41.5-14.3-24.75L43.1 0z" fill="#00AC47" />
    <path d="M57.4 0L33.4 0 19.1 24.75 43.1 66.85 57.4 42.1z" fill="#EA4335" />
    <path d="M43.65 66.85h29.8L58.6 42.1 43.65 66.85z" fill="#00832D" />
    <path d="M73.45 66.85L87.7 42.1 57.4 0 43.1 24.75z" fill="#2684FC" />
    <path d="M43.65 66.85L57.4 42.1 87.7 42.1 73.45 66.85z" fill="#FFBA00" />
  </svg>
);

const ICloudIcon = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
    <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
  </svg>
);

const OneDriveIcon = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6">
    <path
      fill="#0078D4"
      d="M10.5 18.5c-2.5 0-4.5-2-4.5-4.5 0-2.2 1.6-4.1 3.7-4.4.5-2.5 2.7-4.1 5.3-4.1 2.9 0 5.2 2.1 5.4 4.8 1.7.5 3 2.1 3 3.9 0 2.3-1.9 4.2-4.2 4.2H10.5z"
    />
  </svg>
);

const MonitraxIcon = () => (
  <div className="h-6 w-6 rounded bg-emerald-500 flex items-center justify-center">
    <HardDrive className="h-4 w-4 text-white" />
  </div>
);

export default function StorageSettingsPage() {
  const { token } = useAuth();
  const [providers, setProviders] = useState<StorageProvider[]>([
    {
      id: 'monitrax',
      name: 'Monitrax Storage',
      description: 'Secure cloud storage included with your account',
      icon: <MonitraxIcon />,
      color: 'emerald',
      connected: true,
      isActive: true,
      storageUsed: 25 * 1024 * 1024,
      storageLimit: 1024 * 1024 * 1024, // 1GB
      available: true,
    },
    {
      id: 'google_drive',
      name: 'Google Drive',
      description: 'Store documents in your Google Drive account',
      icon: <GoogleDriveIcon />,
      color: 'blue',
      connected: false,
      isActive: false,
      available: true,
    },
    {
      id: 'icloud',
      name: 'iCloud Drive',
      description: 'Store documents in your Apple iCloud account',
      icon: <ICloudIcon />,
      color: 'gray',
      connected: false,
      isActive: false,
      available: true,
    },
    {
      id: 'onedrive',
      name: 'OneDrive',
      description: 'Store documents in your Microsoft OneDrive',
      icon: <OneDriveIcon />,
      color: 'blue',
      connected: false,
      isActive: false,
      available: true,
    },
  ]);

  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<string>('monitrax');

  useEffect(() => {
    // Fetch storage provider status from API
    const fetchProviders = async () => {
      if (!token) return;
      try {
        const response = await fetch('/api/settings/storage', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          // Update providers with API data
          if (data.data?.activeProvider) {
            setActiveProvider(data.data.activeProvider);
          }
        }
      } catch (error) {
        console.error('Failed to fetch storage settings:', error);
      }
    };

    fetchProviders();
  }, [token]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleConnect = async (providerId: string) => {
    setIsConnecting(providerId);

    try {
      // Redirect to OAuth flow
      const response = await fetch(`/api/settings/storage/connect/${providerId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.authUrl) {
          // Redirect to OAuth provider
          window.location.href = data.authUrl;
        }
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to connect storage provider');
      }
    } catch (error) {
      console.error('Failed to connect:', error);
      alert('Failed to connect storage provider');
    } finally {
      setIsConnecting(null);
    }
  };

  const handleDisconnect = async (providerId: string) => {
    try {
      const response = await fetch(`/api/settings/storage/disconnect/${providerId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setProviders((prev) =>
          prev.map((p) =>
            p.id === providerId
              ? { ...p, connected: false, isActive: false, email: undefined }
              : p
          )
        );
        // If this was the active provider, switch to Monitrax
        if (activeProvider === providerId) {
          setActiveProvider('monitrax');
        }
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleSetActive = async (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider?.connected && providerId !== 'monitrax') {
      alert('Please connect this provider first');
      return;
    }

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Cloud Storage
          </CardTitle>
          <CardDescription>
            Connect external cloud storage providers to store your documents. You can use
            Monitrax's secure storage or connect your own Google Drive, iCloud, or OneDrive
            account.
          </CardDescription>
        </CardHeader>
      </Card>

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

      {/* Local Drive Storage - Save directly to computer */}
      <LocalDriveStorageCard />

      {/* Cloud Storage Providers List */}
      <div className="space-y-4">
        {providers.map((provider) => (
          <Card key={provider.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">{provider.icon}</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{provider.name}</h3>
                      {provider.connected && (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Connected
                        </Badge>
                      )}
                      {provider.id === activeProvider && (
                        <Badge variant="outline">Active</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {provider.description}
                    </p>

                    {/* Connected account details */}
                    {provider.connected && provider.email && (
                      <p className="text-sm text-muted-foreground">
                        Connected as: {provider.email}
                      </p>
                    )}

                    {/* Storage usage for Monitrax */}
                    {provider.id === 'monitrax' &&
                      provider.storageUsed !== undefined &&
                      provider.storageLimit !== undefined && (
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Storage used</span>
                            <span>
                              {formatBytes(provider.storageUsed)} /{' '}
                              {formatBytes(provider.storageLimit)}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{
                                width: `${Math.min(
                                  (provider.storageUsed / provider.storageLimit) * 100,
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  {provider.id !== 'monitrax' && (
                    <>
                      {provider.connected ? (
                        <>
                          {provider.id !== activeProvider && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetActive(provider.id)}
                            >
                              Set as Active
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Disconnect {provider.name}?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will disconnect your {provider.name} account.
                                  Documents already stored there will remain, but new
                                  documents will use a different provider.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDisconnect(provider.id)}
                                >
                                  Disconnect
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      ) : (
                        <Button
                          onClick={() => handleConnect(provider.id)}
                          disabled={isConnecting === provider.id || !provider.available}
                        >
                          {isConnecting === provider.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            <>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Connect
                            </>
                          )}
                        </Button>
                      )}
                    </>
                  )}

                  {provider.id === 'monitrax' && activeProvider !== 'monitrax' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetActive('monitrax')}
                    >
                      Set as Active
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
                Your documents are encrypted during transfer and at rest. When using external
                providers like Google Drive or iCloud, your files are stored according to
                their respective privacy policies. Monitrax only stores references to your
                files, not the file contents themselves.
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
              <Label>Auto-organize by entity</Label>
              <p className="text-sm text-muted-foreground">
                Automatically create folders for properties, loans, etc.
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

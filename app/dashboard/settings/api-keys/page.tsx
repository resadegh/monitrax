'use client';

/**
 * Phase 19.1: API Keys Settings Page
 * Manage API access tokens
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Key, Plus, Copy, Trash2, Eye, EyeOff, AlertTriangle } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsed: Date | null;
  scopes: string[];
}

export default function ApiKeysSettingsPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    {
      id: '1',
      name: 'Development Key',
      prefix: 'mk_dev_',
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000),
      scopes: ['read', 'write'],
    },
  ]);

  const [newKeyName, setNewKeyName] = useState('');
  const [showNewKey, setShowNewKey] = useState<string | null>(null);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      alert('Please enter a name for the API key');
      return;
    }

    // Generate a mock key (in production, this would come from the API)
    const mockKey = `mk_live_${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`;

    setShowNewKey(mockKey);
    setApiKeys((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: newKeyName,
        prefix: 'mk_live_',
        createdAt: new Date(),
        lastUsed: null,
        scopes: ['read', 'write'],
      },
    ]);
    setNewKeyName('');
  };

  const handleDeleteKey = async (keyId: string) => {
    setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    alert('API key copied to clipboard');
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys
          </CardTitle>
          <CardDescription>
            Manage API keys for programmatic access to your Monitrax data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Create New Key */}
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="keyName" className="sr-only">
                Key Name
              </Label>
              <Input
                id="keyName"
                placeholder="Enter key name (e.g., Production API)"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <Button onClick={handleCreateKey}>
              <Plus className="h-4 w-4 mr-2" />
              Create Key
            </Button>
          </div>

          {/* New Key Display */}
          {showNewKey && (
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Save your API key now
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    This is the only time you'll see this key. Make sure to copy it before
                    closing this dialog.
                  </p>
                  <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-900 rounded border font-mono text-sm">
                    <code className="flex-1 break-all">{showNewKey}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyKey(showNewKey)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewKey(null)}
                  >
                    I've saved my key
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Existing Keys */}
          <div className="space-y-4">
            <h3 className="font-medium">Your API Keys</h3>
            {apiKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No API keys yet. Create one to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{key.name}</p>
                        <Badge variant="outline" className="font-mono text-xs">
                          {key.prefix}...
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Created {formatDate(key.createdAt)}</span>
                        {key.lastUsed && (
                          <span>Last used {formatDate(key.lastUsed)}</span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {key.scopes.map((scope) => (
                          <Badge key={scope} variant="secondary" className="text-xs">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the API key "{key.name}". Any
                            applications using this key will stop working immediately.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteKey(key.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Delete Key
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* API Documentation Link */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">API Documentation</h3>
              <p className="text-sm text-muted-foreground">
                Learn how to use the Monitrax API
              </p>
            </div>
            <Button variant="outline" asChild>
              <a href="/docs/api" target="_blank" rel="noopener noreferrer">
                View Docs
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

/**
 * Local Drive Storage Configuration Card
 * Allows users to configure local drive for document storage
 * Organizes files by Australian Financial Year
 */

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  HardDrive,
  FolderOpen,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Calendar,
  FileText,
  Loader2,
} from 'lucide-react';
import { useLocalDriveStorage } from '@/hooks/useLocalDriveStorage';

export function LocalDriveStorageCard() {
  const {
    isSupported,
    isConfigured,
    isLoading,
    error,
    driveInfo,
    currentFinancialYear,
    selectFolder,
    disconnect,
    refresh,
  } = useLocalDriveStorage();

  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await selectFolder();
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnect();
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Browser not supported
  if (!isSupported) {
    return (
      <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <HardDrive className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <CardTitle className="text-base">Local Drive Storage</CardTitle>
              <CardDescription>Save documents to your computer</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 text-yellow-700 dark:text-yellow-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Browser Not Supported</p>
              <p className="mt-1 text-yellow-600 dark:text-yellow-500">
                Local drive storage requires Chrome, Edge, or Opera browser.
                Safari and Firefox don't support this feature yet.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isConfigured ? 'border-green-200 dark:border-green-800' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                isConfigured
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : 'bg-muted'
              }`}
            >
              <HardDrive
                className={`h-5 w-5 ${
                  isConfigured ? 'text-green-600' : 'text-muted-foreground'
                }`}
              />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Local Drive Storage
                {isConfigured && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <Check className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Save documents directly to your computer
              </CardDescription>
            </div>
          </div>

          {isConfigured && (
            <Button
              variant="ghost"
              size="icon"
              onClick={refresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
          </div>
        )}

        {isConfigured && driveInfo ? (
          <>
            {/* Connected folder info */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{driveInfo.folderName}</span>
                <span className="text-xs text-muted-foreground">/ Monitrax</span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">{driveInfo.fileCount || 0}</p>
                    <p className="text-xs text-muted-foreground">Documents</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-500" />
                  <div>
                    <p className="text-sm font-medium">{currentFinancialYear}</p>
                    <p className="text-xs text-muted-foreground">Current FY</p>
                  </div>
                </div>
              </div>

              {driveInfo.financialYears && driveInfo.financialYears.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Financial Years:</p>
                  <div className="flex flex-wrap gap-1">
                    {driveInfo.financialYears.map((fy) => (
                      <Badge key={fy} variant="outline" className="text-xs">
                        {fy}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Folder structure preview */}
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Folder Structure:</p>
              <pre className="bg-muted p-2 rounded text-[10px] overflow-x-auto">
{`Monitrax/
├── ${currentFinancialYear}/
│   ├── Receipts/
│   ├── Statements/
│   ├── Tax Documents/
│   ├── Contracts/
│   ├── Insurance/
│   └── ...`}
              </pre>
            </div>

            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="w-full"
            >
              {isDisconnecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Disconnect Local Drive
            </Button>
          </>
        ) : (
          <>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Store your documents directly on your computer:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Organized by Australian Financial Year (July - June)</li>
                <li>Categorized folders for easy access</li>
                <li>Perfect for sharing with your accountant</li>
                <li>Works offline - documents stored locally</li>
              </ul>
            </div>

            <Button
              onClick={handleConnect}
              disabled={isConnecting || isLoading}
              className="w-full"
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FolderOpen className="h-4 w-4 mr-2" />
              )}
              Select Folder
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              You'll be asked to grant permission to read and write files
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

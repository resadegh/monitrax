/**
 * HealthModal - Drill-down modal from health badge
 * Phase 09 Health Component
 */

'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type HealthLevel = 'HEALTHY' | 'WARNING' | 'CRITICAL';

interface ModuleHealth {
  module: string;
  score: number;
  level: HealthLevel;
  issues: string[];
}

interface HealthDiagnostics {
  globalScore: number;
  globalLevel: HealthLevel;
  orphanCount: number;
  missingLinks: number;
  crossModuleConsistency: number;
  modules: ModuleHealth[];
  lastUpdated: Date;
}

interface HealthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagnostics: HealthDiagnostics;
}

const levelColors: Record<HealthLevel, string> = {
  HEALTHY: 'bg-green-500',
  WARNING: 'bg-yellow-500',
  CRITICAL: 'bg-red-500',
};

const levelBadgeColors: Record<HealthLevel, string> = {
  HEALTHY: 'bg-green-100 text-green-800',
  WARNING: 'bg-yellow-100 text-yellow-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

export function HealthModal({
  open,
  onOpenChange,
  diagnostics,
}: HealthModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Portfolio Health
            <Badge className={levelBadgeColors[diagnostics.globalLevel]}>
              {diagnostics.globalLevel}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Last updated: {diagnostics.lastUpdated.toLocaleTimeString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Global Score */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Global Health Score</span>
              <span className="text-2xl font-bold">{diagnostics.globalScore}%</span>
            </div>
            <Progress
              value={diagnostics.globalScore}
              className={cn(
                'h-3',
                diagnostics.globalScore >= 80
                  ? '[&>div]:bg-green-500'
                  : diagnostics.globalScore >= 60
                    ? '[&>div]:bg-yellow-500'
                    : '[&>div]:bg-red-500'
              )}
            />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              label="Orphan Entities"
              value={diagnostics.orphanCount}
              isWarning={diagnostics.orphanCount > 0}
            />
            <StatCard
              label="Missing Links"
              value={diagnostics.missingLinks}
              isWarning={diagnostics.missingLinks > 0}
            />
            <StatCard
              label="Consistency"
              value={`${diagnostics.crossModuleConsistency}%`}
              isWarning={diagnostics.crossModuleConsistency < 75}
            />
          </div>

          {/* Module Breakdown */}
          <div>
            <h3 className="text-sm font-medium mb-3">Module Health</h3>
            <div className="space-y-3">
              {diagnostics.modules.map((module) => (
                <ModuleHealthRow key={module.module} module={module} />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({
  label,
  value,
  isWarning,
}: {
  label: string;
  value: string | number;
  isWarning?: boolean;
}) {
  return (
    <div
      className={cn(
        'p-3 rounded-lg border text-center',
        isWarning ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200'
      )}
    >
      <p className="text-xs text-gray-500">{label}</p>
      <p
        className={cn(
          'text-lg font-semibold',
          isWarning ? 'text-yellow-700' : 'text-gray-900'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ModuleHealthRow({ module }: { module: ModuleHealth }) {
  return (
    <div className="p-3 rounded-lg border">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className={cn('w-2 h-2 rounded-full', levelColors[module.level])}
          />
          <span className="font-medium capitalize">{module.module}</span>
        </div>
        <span className="text-sm">{module.score}%</span>
      </div>
      <Progress value={module.score} className="h-1.5 mb-2" />
      {module.issues.length > 0 && (
        <ul className="text-xs text-gray-500 space-y-1">
          {module.issues.slice(0, 3).map((issue, i) => (
            <li key={i} className="flex items-center gap-1">
              <span className="text-yellow-500">•</span>
              {issue}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * useHealthModal - Hook for managing health modal state
 */
export function useHealthModal() {
  const [open, setOpen] = React.useState(false);

  const openModal = React.useCallback(() => setOpen(true), []);
  const closeModal = React.useCallback(() => setOpen(false), []);

  return { open, setOpen, openModal, closeModal };
}

export type { HealthDiagnostics, ModuleHealth, HealthLevel };

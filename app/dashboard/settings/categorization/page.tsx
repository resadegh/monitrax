'use client';

/**
 * AI Transaction Categorisation Settings (Settings overhaul 2026-05-08)
 *
 * Phase 29 shipped /api/settings/categorization but never landed a UI.
 * This page is the missing consumer surface for those controls. The
 * server validates that reviewThreshold < autoAcceptThreshold, so the
 * sliders here clamp on the client too for instant feedback.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Sparkles,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface CategorizationSettings {
  autoAcceptThreshold: number;
  reviewThreshold: number;
  enableAI: boolean;
  learnFromConfirmations: boolean;
  showConfidenceScores: boolean;
  showAIReasoning: boolean;
  defaultApplyToSimilar: boolean;
  notifyOnPendingReview: boolean;
  pendingReviewThreshold: number;
}

interface LearningStats {
  totalLearnings?: number;
  totalCorrections?: number;
  accuracy?: number;
}

const DEFAULTS: CategorizationSettings = {
  autoAcceptThreshold: 0.9,
  reviewThreshold: 0.7,
  enableAI: true,
  learnFromConfirmations: true,
  showConfidenceScores: true,
  showAIReasoning: true,
  defaultApplyToSimilar: true,
  notifyOnPendingReview: true,
  pendingReviewThreshold: 10,
};

export default function CategorizationSettingsPage() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<CategorizationSettings>(DEFAULTS);
  const [learningStats, setLearningStats] = useState<LearningStats | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/settings/categorization', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const result = await response.json();
          if (!cancelled && result.data?.settings) {
            const s = result.data.settings;
            setSettings({
              autoAcceptThreshold: s.autoAcceptThreshold ?? 0.9,
              reviewThreshold: s.reviewThreshold ?? 0.7,
              enableAI: s.enableAI ?? true,
              learnFromConfirmations: s.learnFromConfirmations ?? true,
              showConfidenceScores: s.showConfidenceScores ?? true,
              showAIReasoning: s.showAIReasoning ?? true,
              defaultApplyToSimilar: s.defaultApplyToSimilar ?? true,
              notifyOnPendingReview: s.notifyOnPendingReview ?? true,
              pendingReviewThreshold: s.pendingReviewThreshold ?? 10,
            });
            setLearningStats(result.data.learningStats || null);
          }
        }
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : 'Failed to load settings'
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const save = async () => {
    if (!token) return;
    setSaving(true);
    setSuccess(null);
    setError(null);

    // Server-side rule: reviewThreshold < autoAcceptThreshold. Mirror it.
    if (settings.reviewThreshold >= settings.autoAcceptThreshold) {
      setError('Review threshold must be lower than auto-accept threshold');
      setSaving(false);
      return;
    }

    try {
      const response = await fetch('/api/settings/categorization', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to save settings');
      }
      setSuccess('Saved');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            AI categorisation
          </CardTitle>
          <CardDescription>
            How aggressively Monitrax should categorise your transactions
            for you. Higher thresholds = more manual review, lower
            thresholds = more automation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {success && (
            <Alert className="border-green-500 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <div>
              <Label>Use AI to categorise transactions</Label>
              <p className="text-xs text-muted-foreground mt-1">
                When off, every transaction needs manual categorisation.
              </p>
            </div>
            <Switch
              checked={settings.enableAI}
              onCheckedChange={(v) =>
                setSettings({ ...settings, enableAI: v })
              }
            />
          </div>

          <div>
            <Label>
              Auto-accept threshold:{' '}
              <span className="font-mono">
                {Math.round(settings.autoAcceptThreshold * 100)}%
              </span>
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Transactions above this confidence are categorised
              automatically.
            </p>
            <input
              type="range"
              min={50}
              max={100}
              step={1}
              value={Math.round(settings.autoAcceptThreshold * 100)}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  autoAcceptThreshold: Number(e.target.value) / 100,
                })
              }
              className="w-full"
              disabled={!settings.enableAI}
            />
          </div>

          <div>
            <Label>
              Review threshold:{' '}
              <span className="font-mono">
                {Math.round(settings.reviewThreshold * 100)}%
              </span>
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Transactions between this and auto-accept get a quick review.
              Below this, you categorise them yourself.
            </p>
            <input
              type="range"
              min={30}
              max={95}
              step={1}
              value={Math.round(settings.reviewThreshold * 100)}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  reviewThreshold: Number(e.target.value) / 100,
                })
              }
              className="w-full"
              disabled={!settings.enableAI}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Learn from my corrections</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Improves accuracy over time on your specific spending.
              </p>
            </div>
            <Switch
              checked={settings.learnFromConfirmations}
              onCheckedChange={(v) =>
                setSettings({ ...settings, learnFromConfirmations: v })
              }
              disabled={!settings.enableAI}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Show confidence scores</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Display "92% confident" beside each AI categorisation.
              </p>
            </div>
            <Switch
              checked={settings.showConfidenceScores}
              onCheckedChange={(v) =>
                setSettings({ ...settings, showConfidenceScores: v })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Show AI reasoning</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Display "Categorised as Groceries because the merchant
                matches Coles" when reviewing.
              </p>
            </div>
            <Switch
              checked={settings.showAIReasoning}
              onCheckedChange={(v) =>
                setSettings({ ...settings, showAIReasoning: v })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Apply same rule to similar transactions</Label>
              <p className="text-xs text-muted-foreground mt-1">
                When you fix a category, apply it to similar transactions
                from the same merchant.
              </p>
            </div>
            <Switch
              checked={settings.defaultApplyToSimilar}
              onCheckedChange={(v) =>
                setSettings({ ...settings, defaultApplyToSimilar: v })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Notify when transactions are waiting for review</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Email digest once you have{' '}
                {settings.pendingReviewThreshold} or more pending.
              </p>
            </div>
            <Switch
              checked={settings.notifyOnPendingReview}
              onCheckedChange={(v) =>
                setSettings({ ...settings, notifyOnPendingReview: v })
              }
            />
          </div>

          <div className="pt-2">
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {learningStats && (learningStats.totalLearnings ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Learning history</CardTitle>
            <CardDescription>
              How much Monitrax has learned from your categorisations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">
                  {learningStats.totalLearnings ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  Patterns learned
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {learningStats.totalCorrections ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  Corrections you made
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {learningStats.accuracy != null
                    ? `${Math.round(learningStats.accuracy * 100)}%`
                    : '—'}
                </p>
                <p className="text-xs text-muted-foreground">Accuracy</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

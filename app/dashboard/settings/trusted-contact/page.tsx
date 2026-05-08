'use client';

/**
 * Trusted Contact Settings (Settings overhaul 2026-05-08)
 *
 * Optional second-line contact the user nominates so a future advisor
 * (Phase 32B) or family member can be looped in if the user becomes
 * unable to manage their own finances. Surfaced through Settings;
 * never auto-shared with anyone.
 *
 * Behavioural-psychologist lens: framed as "someone you trust", not
 * "next of kin" — the latter implies death; the former implies care.
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  HeartHandshake,
  Save,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface TrustedContact {
  name: string | null;
  email: string | null;
  phone: string | null;
  relationship: string | null;
  updatedAt: string | null;
}

const EMPTY: TrustedContact = {
  name: '',
  email: '',
  phone: '',
  relationship: '',
  updatedAt: null,
};

export default function TrustedContactPage() {
  const { token } = useAuth();
  const [contact, setContact] = useState<TrustedContact>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/account/trusted-contact', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) {
            setContact({
              name: data.name || '',
              email: data.email || '',
              phone: data.phone || '',
              relationship: data.relationship || '',
              updatedAt: data.updatedAt || null,
            });
          }
        }
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : 'Failed to load contact'
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
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/account/trusted-contact', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          relationship: contact.relationship,
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to save contact');
      }
      const data = await response.json();
      setContact({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        relationship: data.relationship || '',
        updatedAt: data.updatedAt || null,
      });
      setSuccess('Saved');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    if (!token) return;
    if (
      !confirm(
        'Remove your trusted contact? This will not affect your account, but no one will be listed as your second contact until you add another.'
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/account/trusted-contact', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: null,
          email: null,
          phone: null,
          relationship: null,
        }),
      });
      if (response.ok) {
        setContact(EMPTY);
        setSuccess('Trusted contact removed');
        setTimeout(() => setSuccess(null), 4000);
      } else {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to remove contact');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove contact');
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

  const hasContact = !!contact.name || !!contact.email;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HeartHandshake className="h-5 w-5" />
            Trusted contact
          </CardTitle>
          <CardDescription>
            Someone you trust to be looped in if you ever need help managing
            your finances. Optional and never auto-shared — we only ever
            contact them with your explicit permission.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tc-name">Full name</Label>
              <Input
                id="tc-name"
                value={contact.name || ''}
                placeholder="Sarah Khanna"
                onChange={(e) =>
                  setContact({ ...contact, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="tc-relationship">Relationship</Label>
              <Input
                id="tc-relationship"
                value={contact.relationship || ''}
                placeholder="Spouse, sibling, accountant…"
                onChange={(e) =>
                  setContact({ ...contact, relationship: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="tc-email">Email</Label>
              <Input
                id="tc-email"
                type="email"
                value={contact.email || ''}
                placeholder="sarah@example.com"
                onChange={(e) =>
                  setContact({ ...contact, email: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="tc-phone">Phone</Label>
              <Input
                id="tc-phone"
                type="tel"
                value={contact.phone || ''}
                placeholder="0412 345 678"
                onChange={(e) =>
                  setContact({ ...contact, phone: e.target.value })
                }
              />
            </div>
          </div>

          {contact.updatedAt && (
            <p className="text-xs text-muted-foreground">
              Last updated{' '}
              {new Date(contact.updatedAt).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
            {hasContact && (
              <Button variant="outline" onClick={clear} disabled={saving}>
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

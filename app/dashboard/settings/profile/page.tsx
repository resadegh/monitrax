'use client';

/**
 * Phase 19.1: Profile Settings Page
 * Manage user profile information
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Camera, Save, Loader2, Building, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

export default function ProfileSettingsPage() {
  const { user, token } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    mobile: '',
    phone: '',
    bio: '',
    location: '',
    timezone: 'Australia/Sydney',
  });

  // Load profile data from API
  useEffect(() => {
    const loadProfile = async () => {
      if (!token) return;

      try {
        const response = await fetch('/api/settings/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const result = await response.json();
          if (result.data) {
            setProfile({
              name: result.data.name || '',
              email: result.data.email || '',
              mobile: result.data.mobile || '',
              phone: result.data.phone || '',
              bio: result.data.bio || '',
              location: result.data.location || '',
              timezone: result.data.timezone || 'Australia/Sydney',
            });
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [token]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profile),
      });

      const result = await response.json();

      if (response.ok) {
        setSaveMessage({ type: 'success', text: 'Profile updated successfully' });
        // Update local state with returned data
        if (result.data) {
          setProfile({
            name: result.data.name || '',
            email: result.data.email || '',
            mobile: result.data.mobile || '',
            phone: result.data.phone || '',
            bio: result.data.bio || '',
            location: result.data.location || '',
            timezone: result.data.timezone || 'Australia/Sydney',
          });
        }
      } else {
        setSaveMessage({ type: 'error', text: result.error?.message || 'Failed to update profile' });
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      setSaveMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setIsSaving(false);
      // Clear message after 5 seconds
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Validate Australian mobile format
  const isValidMobile = (mobile: string) => {
    if (!mobile) return true; // Empty is valid (optional)
    const clean = mobile.replace(/\s/g, '');
    return /^(\+61|0)[4-5]\d{8}$/.test(clean);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Update your personal information and how others see you
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={undefined} />
              <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                {getInitials(profile.name || 'U')}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <Button variant="outline" size="sm">
                <Camera className="h-4 w-4 mr-2" />
                Change Photo
              </Button>
              <p className="text-xs text-muted-foreground">
                JPG, PNG or GIF. Max 2MB.
              </p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                placeholder="Enter your name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Contact support to change your email address
              </p>
            </div>

            {/* Mobile Number - Important for Bank Connections */}
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="mobile">Mobile Number (Australian)</Label>
                <Badge variant="secondary" className="text-xs">
                  <Building className="h-3 w-3 mr-1" />
                  Used for Bank Connections
                </Badge>
              </div>
              <Input
                id="mobile"
                type="tel"
                value={profile.mobile}
                onChange={(e) => setProfile({ ...profile, mobile: e.target.value })}
                placeholder="0412 345 678"
                className={!isValidMobile(profile.mobile) ? 'border-destructive' : ''}
              />
              {profile.mobile && !isValidMobile(profile.mobile) ? (
                <p className="text-xs text-destructive">
                  Please enter a valid Australian mobile (e.g., 0412345678 or +61412345678)
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Required for Open Banking connections (Basiq). Format: 04XX XXX XXX
                </p>
              )}
              {profile.mobile && isValidMobile(profile.mobile) && (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Valid mobile format
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Phone Number (Optional)</Label>
              <Input
                id="phone"
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+61 2 9000 0000"
              />
              <p className="text-xs text-muted-foreground">
                Alternative contact number (landline or international)
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={profile.location}
                onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                placeholder="Sydney, Australia"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="timezone">Timezone</Label>
              <select
                id="timezone"
                value={profile.timezone}
                onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="Australia/Sydney">Sydney (AEST/AEDT)</option>
                <option value="Australia/Melbourne">Melbourne (AEST/AEDT)</option>
                <option value="Australia/Brisbane">Brisbane (AEST)</option>
                <option value="Australia/Perth">Perth (AWST)</option>
                <option value="Australia/Adelaide">Adelaide (ACST/ACDT)</option>
                <option value="Australia/Darwin">Darwin (ACST)</option>
                <option value="Australia/Hobart">Hobart (AEST/AEDT)</option>
                <option value="Pacific/Auckland">Auckland (NZST/NZDT)</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                placeholder="Tell us about yourself..."
                rows={3}
              />
            </div>
          </div>

          {/* Save Message */}
          {saveMessage && (
            <div
              className={`p-3 rounded-lg text-sm ${
                saveMessage.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                  : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
              }`}
            >
              {saveMessage.text}
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={isSaving || (profile.mobile !== '' && !isValidMobile(profile.mobile))}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

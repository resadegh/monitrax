'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Users,
  Baby,
  Car,
  Dog,
  Utensils,
  Sparkles,
  Save,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

type LifestylePreference = 'FRUGAL' | 'MODERATE' | 'COMFORTABLE';
type DiningFrequency = 'NEVER' | 'RARELY' | 'SOMETIMES' | 'OFTEN';

interface HouseholdProfile {
  id?: string;
  adultsCount: number;
  childrenCount: number;
  childrenAges: number[];
  petsCount: number;
  petTypes: string[];
  carsCount: number;
  lifestylePreference: LifestylePreference;
  diningOutFrequency: DiningFrequency;
  hobbiesWithCosts: string;
  isComplete: boolean;
}

const VALID_PET_TYPES = ['dog', 'cat', 'bird', 'fish', 'other'];

export default function HouseholdProfilePage() {
  const { token } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [profile, setProfile] = useState<HouseholdProfile>({
    adultsCount: 1,
    childrenCount: 0,
    childrenAges: [],
    petsCount: 0,
    petTypes: [],
    carsCount: 0,
    lifestylePreference: 'MODERATE',
    diningOutFrequency: 'SOMETIMES',
    hobbiesWithCosts: '',
    isComplete: false,
  });

  // Calculate completion progress
  const calculateProgress = () => {
    let completed = 0;
    const total = 6;

    if (profile.adultsCount >= 1) completed++;
    if (profile.childrenCount === 0 || profile.childrenAges.length === profile.childrenCount) completed++;
    if (profile.petsCount === 0 || profile.petTypes.length === profile.petsCount) completed++;
    if (profile.carsCount >= 0) completed++;
    if (profile.lifestylePreference) completed++;
    if (profile.diningOutFrequency) completed++;

    return Math.round((completed / total) * 100);
  };

  // Fetch existing profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/household-profile', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setProfile({
              ...result.data,
              hobbiesWithCosts: result.data.hobbiesWithCosts || '',
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchProfile();
    }
  }, [token]);

  // Handle children count change
  const handleChildrenCountChange = (count: number) => {
    const newAges = [...profile.childrenAges];
    if (count > newAges.length) {
      // Add default ages
      while (newAges.length < count) {
        newAges.push(5);
      }
    } else {
      // Remove excess ages
      newAges.splice(count);
    }
    setProfile({ ...profile, childrenCount: count, childrenAges: newAges });
  };

  // Handle child age change
  const handleChildAgeChange = (index: number, age: number) => {
    const newAges = [...profile.childrenAges];
    newAges[index] = Math.max(0, Math.min(18, age));
    setProfile({ ...profile, childrenAges: newAges });
  };

  // Handle pets count change
  const handlePetsCountChange = (count: number) => {
    const newTypes = [...profile.petTypes];
    if (count > newTypes.length) {
      // Add default types
      while (newTypes.length < count) {
        newTypes.push('dog');
      }
    } else {
      // Remove excess types
      newTypes.splice(count);
    }
    setProfile({ ...profile, petsCount: count, petTypes: newTypes });
  };

  // Handle pet type change
  const handlePetTypeChange = (index: number, type: string) => {
    const newTypes = [...profile.petTypes];
    newTypes[index] = type;
    setProfile({ ...profile, petTypes: newTypes });
  };

  // Save profile
  const handleSave = async (redirect: boolean = false) => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/household-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profile),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save profile');
      }

      setSuccess('Profile saved successfully!');
      setProfile({ ...profile, isComplete: result.data.isComplete });

      if (redirect && result.data.isComplete) {
        setTimeout(() => {
          router.push('/dashboard/budget-analysis');
        }, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const progress = calculateProgress();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Household Profile"
        description="Tell us about your household to get accurate budget estimates"
      />

      <div className="space-y-6 max-w-4xl">
        {/* Progress indicator */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Profile Completion</span>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            {profile.isComplete && (
              <div className="flex items-center gap-2 mt-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                Profile complete
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error/Success messages */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-700 dark:text-red-300 text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-700 dark:text-green-300 text-sm">
            <CheckCircle className="h-4 w-4" />
            {success}
          </div>
        )}

        {/* Household Members */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Household Members
            </CardTitle>
            <CardDescription>
              How many people live in your household?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="adults">Number of Adults</Label>
                <Select
                  value={String(profile.adultsCount)}
                  onValueChange={(v) => setProfile({ ...profile, adultsCount: parseInt(v) })}
                >
                  <SelectTrigger id="adults">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {n === 1 ? 'adult' : 'adults'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="children">Number of Children</Label>
                <Select
                  value={String(profile.childrenCount)}
                  onValueChange={(v) => handleChildrenCountChange(parseInt(v))}
                >
                  <SelectTrigger id="children">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {n === 0 ? 'children' : n === 1 ? 'child' : 'children'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Children ages */}
            {profile.childrenCount > 0 && (
              <div className="space-y-2">
                <Label>Children&apos;s Ages</Label>
                <div className="flex flex-wrap gap-2">
                  {profile.childrenAges.map((age, index) => (
                    <div key={index} className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={18}
                        value={age}
                        onChange={(e) => handleChildAgeChange(index, parseInt(e.target.value) || 0)}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">yrs</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Ages help estimate expenses (teens cost more than toddlers)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vehicles & Pets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Vehicles & Pets
            </CardTitle>
            <CardDescription>
              These affect fuel, food, and care costs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="cars">Number of Vehicles</Label>
                <Select
                  value={String(profile.carsCount)}
                  onValueChange={(v) => setProfile({ ...profile, carsCount: parseInt(v) })}
                >
                  <SelectTrigger id="cars">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {n === 1 ? 'vehicle' : 'vehicles'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pets">Number of Pets</Label>
                <Select
                  value={String(profile.petsCount)}
                  onValueChange={(v) => handlePetsCountChange(parseInt(v))}
                >
                  <SelectTrigger id="pets">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {n === 1 ? 'pet' : 'pets'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pet types */}
            {profile.petsCount > 0 && (
              <div className="space-y-2">
                <Label>Pet Types</Label>
                <div className="flex flex-wrap gap-2">
                  {profile.petTypes.map((type, index) => (
                    <Select
                      key={index}
                      value={type}
                      onValueChange={(v) => handlePetTypeChange(index, v)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VALID_PET_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Dogs typically cost more than cats or fish
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lifestyle Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Lifestyle Preferences
            </CardTitle>
            <CardDescription>
              This helps calibrate your expense estimates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label>How would you describe your household&apos;s spending style?</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    value: 'FRUGAL' as LifestylePreference,
                    label: 'Frugal',
                    description: 'Budget-conscious, prioritize savings, minimal discretionary spending',
                  },
                  {
                    value: 'MODERATE' as LifestylePreference,
                    label: 'Moderate',
                    description: 'Balanced approach, reasonable discretionary spending',
                  },
                  {
                    value: 'COMFORTABLE' as LifestylePreference,
                    label: 'Comfortable',
                    description: 'Higher quality choices, more convenience spending',
                  },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setProfile({ ...profile, lifestylePreference: option.value })}
                    className={`p-4 rounded-lg border-2 text-left transition-colors ${
                      profile.lifestylePreference === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/50'
                    }`}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {option.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <Label>How often does your household dine out or order takeaway?</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { value: 'NEVER' as DiningFrequency, label: 'Never', description: 'Always cook at home' },
                  { value: 'RARELY' as DiningFrequency, label: 'Rarely', description: '1-2 times/month' },
                  { value: 'SOMETIMES' as DiningFrequency, label: 'Sometimes', description: 'About weekly' },
                  { value: 'OFTEN' as DiningFrequency, label: 'Often', description: 'Multiple times/week' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setProfile({ ...profile, diningOutFrequency: option.value })}
                    className={`p-3 rounded-lg border-2 text-center transition-colors ${
                      profile.diningOutFrequency === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/50'
                    }`}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-muted-foreground">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hobbies */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5" />
              Hobbies & Activities
            </CardTitle>
            <CardDescription>
              Optional: List any hobbies with regular costs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="e.g., Golf membership ($200/mo), gym ($60/mo), kids soccer ($50/mo)"
              value={profile.hobbiesWithCosts}
              onChange={(e) => setProfile({ ...profile, hobbiesWithCosts: e.target.value })}
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground mt-2">
              This helps refine your expense estimates
            </p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={() => handleSave(false)}
            disabled={saving}
            variant="outline"
            className="flex-1"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Profile
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={saving || progress < 100}
            className="flex-1"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-2" />
            )}
            Save & Continue to Budget Analysis
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

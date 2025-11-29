/**
 * PROPERTY STRATEGY PAGE
 * Phase 11 - AI Strategy Engine UI V2
 *
 * Strategy recommendations specific to a property
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EntityStrategyTab from '@/components/strategy/EntityStrategyTab';
import AiAdvisorPanel from '@/components/strategy/AiAdvisorPanel';
import {
  ArrowLeft,
  Building2,
  Bot,
  DollarSign,
  TrendingUp,
  Home,
  RefreshCw,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface Property {
  id: string;
  name: string;
  address: string;
  propertyType: string;
  currentValue: number;
  purchasePrice: number;
  rentalIncome: number;
  isInvestmentProperty: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function PropertyStrategyPage() {
  const params = useParams();
  const propertyId = params.id as string;

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAiPanel, setShowAiPanel] = useState(false);

  useEffect(() => {
    if (propertyId) {
      fetchProperty();
    }
  }, [propertyId]);

  async function fetchProperty() {
    try {
      setLoading(true);
      const response = await fetch(`/api/properties/${propertyId}`);
      if (response.ok) {
        const data = await response.json();
        setProperty(data.data || data);
      }
    } catch (error) {
      console.error('Failed to fetch property:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading property...</p>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">Property not found.</p>
        <Link href="/dashboard/properties" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
          ← Back to Properties
        </Link>
      </div>
    );
  }

  const equityGain = property.currentValue - property.purchasePrice;
  const equityGainPercent = ((equityGain / property.purchasePrice) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href={`/dashboard/properties`}
        className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Properties
      </Link>

      {/* Property Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {property.name || property.address}
                </h1>
                <p className="text-gray-500 dark:text-gray-400">{property.address}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    {property.propertyType}
                  </span>
                  {property.isInvestmentProperty && (
                    <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                      Investment
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant={showAiPanel ? 'default' : 'outline'}
              onClick={() => setShowAiPanel(!showAiPanel)}
              className={showAiPanel ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}
            >
              <Bot className="h-4 w-4 mr-2" />
              Ask AI about this property
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              <DollarSign className="h-4 w-4" />
              Current Value
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(property.currentValue)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              <TrendingUp className="h-4 w-4" />
              Equity Gain
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(equityGain)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">+{equityGainPercent}%</p>
          </CardContent>
        </Card>
        {property.rentalIncome > 0 && (
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                <Home className="h-4 w-4" />
                Rental Income
              </div>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatCurrency(property.rentalIncome)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">/month</p>
            </CardContent>
          </Card>
        )}
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              <DollarSign className="h-4 w-4" />
              Purchase Price
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(property.purchasePrice)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Strategy Recommendations */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Strategy Recommendations</CardTitle>
              <CardDescription>AI-powered recommendations for this property</CardDescription>
            </CardHeader>
            <CardContent>
              <EntityStrategyTab
                entityType="property"
                entityId={propertyId}
                entityName={property.name || property.address}
              />
            </CardContent>
          </Card>
        </div>

        {/* AI Advisor Panel */}
        {showAiPanel && (
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-purple-600" />
                  AI Advisor
                </CardTitle>
                <CardDescription>Ask questions about this property</CardDescription>
              </CardHeader>
              <CardContent>
                <AiAdvisorPanel
                  mode="entity"
                  entityId={propertyId}
                  entityType="property"
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

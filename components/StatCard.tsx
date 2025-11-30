import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'teal';
}

// Brand-aligned variant styles (see docs/blueprint/08_BRAND_UI_DESIGN)
// - green: positive/progress metrics (emerald)
// - orange: risk/warning (amber)
// - blue: informational stats (sky/info)
// - default: neutral
const variantStyles = {
  default: {
    card: 'border-l-4 border-l-gray-400 dark:border-l-gray-500 bg-card hover:shadow-md transition-all duration-200',
    icon: 'bg-muted text-muted-foreground',
  },
  blue: {
    card: 'border-l-4 border-l-sky-500 dark:border-l-sky-400 bg-card hover:shadow-md transition-all duration-200',
    icon: 'bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400',
  },
  green: {
    card: 'border-l-4 border-l-emerald-500 dark:border-l-emerald-400 bg-card hover:shadow-md transition-all duration-200',
    icon: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400',
  },
  purple: {
    card: 'border-l-4 border-l-indigo-500 dark:border-l-indigo-400 bg-card hover:shadow-md transition-all duration-200',
    icon: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400',
  },
  orange: {
    card: 'border-l-4 border-l-amber-500 dark:border-l-amber-400 bg-card hover:shadow-md transition-all duration-200',
    icon: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
  },
  pink: {
    card: 'border-l-4 border-l-pink-500 dark:border-l-pink-400 bg-card hover:shadow-md transition-all duration-200',
    icon: 'bg-pink-100 dark:bg-pink-900/50 text-pink-600 dark:text-pink-400',
  },
  teal: {
    card: 'border-l-4 border-l-teal-500 dark:border-l-teal-400 bg-card hover:shadow-md transition-all duration-200',
    icon: 'bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400',
  },
};

export function StatCard({ title, value, description, icon: Icon, trend, variant = 'default' }: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card className={styles.card}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && (
          <div className={`p-2 rounded-lg ${styles.icon}`}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-card-foreground">{value}</div>
        {(description || trend) && (
          <div className="flex items-center gap-2 mt-1">
            {trend && (
              <span className={`text-xs font-medium ${
                trend.isPositive ? 'text-success' : 'text-error'
              }`}>
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
            )}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

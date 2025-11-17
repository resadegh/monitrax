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

const variantStyles = {
  default: {
    card: 'border-l-4 border-l-slate-500 dark:border-l-slate-400 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 hover:shadow-lg dark:hover:shadow-slate-900/50 transition-all duration-300',
    icon: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
  },
  blue: {
    card: 'border-l-4 border-l-blue-500 dark:border-l-blue-400 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/50 dark:to-slate-800 hover:shadow-lg hover:shadow-blue-100 dark:hover:shadow-blue-900/50 transition-all duration-300',
    icon: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
  },
  green: {
    card: 'border-l-4 border-l-green-500 dark:border-l-green-400 bg-gradient-to-br from-green-50 to-white dark:from-green-950/50 dark:to-slate-800 hover:shadow-lg hover:shadow-green-100 dark:hover:shadow-green-900/50 transition-all duration-300',
    icon: 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400',
  },
  purple: {
    card: 'border-l-4 border-l-purple-500 dark:border-l-purple-400 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/50 dark:to-slate-800 hover:shadow-lg hover:shadow-purple-100 dark:hover:shadow-purple-900/50 transition-all duration-300',
    icon: 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400',
  },
  orange: {
    card: 'border-l-4 border-l-orange-500 dark:border-l-orange-400 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/50 dark:to-slate-800 hover:shadow-lg hover:shadow-orange-100 dark:hover:shadow-orange-900/50 transition-all duration-300',
    icon: 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400',
  },
  pink: {
    card: 'border-l-4 border-l-pink-500 dark:border-l-pink-400 bg-gradient-to-br from-pink-50 to-white dark:from-pink-950/50 dark:to-slate-800 hover:shadow-lg hover:shadow-pink-100 dark:hover:shadow-pink-900/50 transition-all duration-300',
    icon: 'bg-pink-100 dark:bg-pink-900/50 text-pink-600 dark:text-pink-400',
  },
  teal: {
    card: 'border-l-4 border-l-teal-500 dark:border-l-teal-400 bg-gradient-to-br from-teal-50 to-white dark:from-teal-950/50 dark:to-slate-800 hover:shadow-lg hover:shadow-teal-100 dark:hover:shadow-teal-900/50 transition-all duration-300',
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
        <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
        {(description || trend) && (
          <div className="flex items-center gap-2 mt-1">
            {trend && (
              <span className={`text-xs font-medium ${
                trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
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

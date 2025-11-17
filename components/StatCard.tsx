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
    card: 'border-l-4 border-l-slate-500 bg-gradient-to-br from-slate-50 to-white hover:shadow-lg transition-all duration-300',
    icon: 'bg-slate-100 text-slate-600',
  },
  blue: {
    card: 'border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white hover:shadow-lg hover:shadow-blue-100 transition-all duration-300',
    icon: 'bg-blue-100 text-blue-600',
  },
  green: {
    card: 'border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white hover:shadow-lg hover:shadow-green-100 transition-all duration-300',
    icon: 'bg-green-100 text-green-600',
  },
  purple: {
    card: 'border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white hover:shadow-lg hover:shadow-purple-100 transition-all duration-300',
    icon: 'bg-purple-100 text-purple-600',
  },
  orange: {
    card: 'border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50 to-white hover:shadow-lg hover:shadow-orange-100 transition-all duration-300',
    icon: 'bg-orange-100 text-orange-600',
  },
  pink: {
    card: 'border-l-4 border-l-pink-500 bg-gradient-to-br from-pink-50 to-white hover:shadow-lg hover:shadow-pink-100 transition-all duration-300',
    icon: 'bg-pink-100 text-pink-600',
  },
  teal: {
    card: 'border-l-4 border-l-teal-500 bg-gradient-to-br from-teal-50 to-white hover:shadow-lg hover:shadow-teal-100 transition-all duration-300',
    icon: 'bg-teal-100 text-teal-600',
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
        <div className="text-2xl font-bold">{value}</div>
        {(description || trend) && (
          <div className="flex items-center gap-2 mt-1">
            {trend && (
              <span className={`text-xs font-medium ${
                trend.isPositive ? 'text-green-600' : 'text-red-600'
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

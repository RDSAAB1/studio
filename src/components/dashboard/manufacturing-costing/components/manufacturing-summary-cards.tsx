import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Target } from 'lucide-react';

interface ManufacturingSummaryCardsProps {
  totalRevenue: number;
  totalProfit: number;
  overallProfitMargin: number;
  totalOutput: number;
  targetProfitStatus: {
    target: number;
    projected: number;
    achieved: boolean;
    difference: number;
  } | null;
}

export function ManufacturingSummaryCards({
  totalRevenue,
  totalProfit,
  overallProfitMargin,
  totalOutput,
  targetProfitStatus,
}: ManufacturingSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="text-sm font-medium text-muted-foreground mb-1">
            Total Revenue
          </div>
          <div className="text-xl font-bold">
            {formatCurrency(totalRevenue)}
          </div>
        </CardContent>
      </Card>
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="text-sm font-medium text-muted-foreground mb-1">
            Total Profit
          </div>
          <div className={`text-xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totalProfit)}
          </div>
        </CardContent>
      </Card>
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="text-sm font-medium text-muted-foreground mb-1">
            Profit Margin
          </div>
          <div className={`text-xl font-bold ${overallProfitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {overallProfitMargin.toFixed(2)}%
          </div>
        </CardContent>
      </Card>
      {targetProfitStatus ? (
        <Card className={`${targetProfitStatus.achieved ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800'}`}>
          <CardContent className="pt-4">
            <div className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Target Profit Status
            </div>
            <div className={`text-xl font-bold ${targetProfitStatus.achieved ? 'text-green-600' : 'text-yellow-600'}`}>
              {formatCurrency(targetProfitStatus.projected)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Target: {formatCurrency(targetProfitStatus.target)}
              {targetProfitStatus.difference !== 0 && (
                <span className={targetProfitStatus.achieved ? 'text-green-600' : 'text-yellow-600'}>
                  {' '}({targetProfitStatus.difference >= 0 ? '+' : ''}{formatCurrency(targetProfitStatus.difference)})
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Total Output
            </div>
            <div className="text-xl font-bold text-primary">
              {totalOutput.toFixed(2)} QTL
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


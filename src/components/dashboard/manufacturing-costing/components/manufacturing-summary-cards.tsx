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
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
      <Card className="bg-slate-50/50 border border-slate-200 shadow-none p-2 rounded-md">
        <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Total Output</div>
        <div className="text-xs font-semibold text-slate-800 mt-0.5">{totalOutput.toFixed(2)} QTL</div>
      </Card>
      
      <Card className="bg-slate-50/50 border border-slate-200 shadow-none p-2 rounded-md">
        <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Total Revenue</div>
        <div className="text-xs font-semibold text-slate-800 mt-0.5">{formatCurrency(totalRevenue)}</div>
      </Card>

      <Card className="bg-slate-50/50 border border-slate-200 shadow-none p-2 rounded-md">
        <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Total Profit</div>
        <div className={`text-xs font-bold mt-0.5 ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatCurrency(totalProfit)}
        </div>
      </Card>

      <Card className="bg-slate-50/50 border border-slate-200 shadow-none p-2 rounded-md">
        <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Profit Margin</div>
        <div className={`text-xs font-bold mt-0.5 ${overallProfitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {overallProfitMargin.toFixed(1)}%
        </div>
      </Card>

      <Card className="bg-slate-50/50 border border-slate-200 shadow-none p-2 rounded-md col-span-2 md:col-span-1">
        <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Target Profit</div>
        <div className="text-xs font-semibold text-slate-800 mt-0.5">
          {targetProfitStatus ? (
            <span className={targetProfitStatus.achieved ? 'text-green-600 font-bold' : 'text-amber-600 font-semibold'}>
              {formatCurrency(targetProfitStatus.projected)} / {formatCurrency(targetProfitStatus.target)}
            </span>
          ) : (
            '₹0 / ₹0'
          )}
        </div>
      </Card>
    </div>
  );
}

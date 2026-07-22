import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { CalculatedProduct } from '../hooks/use-manufacturing-calculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ManufacturingProductTableProps {
  products: CalculatedProduct[];
  overallTargetProfit: number;
  isLoading: boolean;
  onUpdateProduct: (id: string, field: keyof CalculatedProduct, value: string | number) => void;
  onRemoveProduct: (id: string) => void;
  canRemove: boolean;
  varietyOptions?: { value: string; label: string }[];
}

export function ManufacturingProductTable({
  products,
  overallTargetProfit,
  isLoading,
  onUpdateProduct,
  onRemoveProduct,
  canRemove,
  varietyOptions = [],
}: ManufacturingProductTableProps) {
  const cellInputClass = "w-full h-7 text-xs px-2 bg-white border border-slate-200 focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary rounded-md transition-all";
  const cellSelectTriggerClass = "w-full h-7 text-xs px-2 bg-white border border-slate-200 focus:ring-1 focus:ring-primary/20 focus:border-primary rounded-md transition-all flex items-center justify-between";

  return (
    <div className="border rounded-md overflow-x-auto bg-white">
      <Table className="min-w-full text-xs">
        <TableHeader>
          <TableRow className="h-7 bg-slate-50 border-b">
            <TableHead className="p-1 min-w-[150px] h-7 text-xs font-semibold">Product Name</TableHead>
            <TableHead className="p-1 min-w-[70px] h-7 text-xs font-semibold">Percentage (%)</TableHead>
            <TableHead className="p-1 min-w-[80px] h-7 text-xs font-semibold">Weight (QTL)</TableHead>
            <TableHead className="p-1 min-w-[90px] h-7 text-xs font-semibold">Allocated Cost</TableHead>
            <TableHead className="p-1 min-w-[90px] h-7 text-xs font-semibold">Cost per QTL</TableHead>
            <TableHead className="p-1 min-w-[90px] h-7 text-xs font-semibold">Selling Price</TableHead>
            <TableHead className="p-1 min-w-[70px] h-7 text-xs font-semibold">Sold %</TableHead>
            <TableHead className="p-1 min-w-[90px] h-7 text-xs font-semibold">Selling Amount</TableHead>
            <TableHead className="p-1 min-w-[90px] h-7 text-xs font-semibold">P/L</TableHead>
            <TableHead className="p-1 min-w-[90px] h-7 text-xs font-semibold">Remaining (QTL)</TableHead>
            <TableHead className="p-1 min-w-[90px] h-7 text-xs font-semibold">Target Profit</TableHead>
            <TableHead className="p-1 min-w-[110px] h-7 text-xs font-semibold">Next Selling Price</TableHead>
            <TableHead className="p-1 min-w-[50px] w-[50px] h-7 text-xs font-semibold text-center">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id} className="hover:bg-muted/10 h-8">
              <TableCell className="p-1">
                <Select
                  value={varietyOptions.some(opt => opt.value === product.name) ? product.name : 'manual'}
                  onValueChange={(val) => {
                    onUpdateProduct(product.id, 'name', val);
                  }}
                  disabled={isLoading}
                >
                  <SelectTrigger className={`${cellSelectTriggerClass} min-w-[140px]`}>
                    <SelectValue placeholder="Select variety" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">-- Fill Manually --</SelectItem>
                    {varietyOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(product.name === '' || product.name === 'manual' || !varietyOptions.some(opt => opt.value === product.name)) && (
                  <Input
                    value={product.name === 'manual' ? '' : product.name}
                    onChange={(e) => onUpdateProduct(product.id, 'name', e.target.value)}
                    placeholder="Enter custom name"
                    className={`${cellInputClass} min-w-[140px] mt-1`}
                    disabled={isLoading}
                  />
                )}
              </TableCell>
              <TableCell className="p-1">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={product.percentage || ''}
                  onChange={(e) => onUpdateProduct(product.id, 'percentage', parseFloat(e.target.value) || 0)}
                  placeholder="%"
                  className={`${cellInputClass} min-w-[50px]`}
                  disabled={isLoading}
                />
              </TableCell>
              <TableCell className="p-1">
                <div className="font-medium whitespace-nowrap text-xs px-1">
                  {product.weight.toFixed(2)}
                </div>
              </TableCell>
              <TableCell className="p-1">
                <div className="font-medium whitespace-nowrap text-xs px-1">
                  {formatCurrency(product.allocatedCost)}
                </div>
              </TableCell>
              <TableCell className="p-1">
                <div className="font-semibold text-primary whitespace-nowrap text-xs px-1">
                  {formatCurrency(product.costPerQtl)}
                </div>
              </TableCell>
              <TableCell className="p-1">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={product.sellingPrice || ''}
                  onChange={(e) => onUpdateProduct(product.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                  placeholder="Sold Price"
                  className={`${cellInputClass} min-w-[70px]`}
                  disabled={isLoading}
                />
              </TableCell>
              <TableCell className="p-1">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={product.soldPercentage || ''}
                  onChange={(e) => onUpdateProduct(product.id, 'soldPercentage', parseFloat(e.target.value) || 0)}
                  placeholder="%"
                  className={`${cellInputClass} min-w-[50px]`}
                  disabled={isLoading}
                />
              </TableCell>
              <TableCell className="p-1">
                <div className="font-semibold text-primary whitespace-nowrap text-xs px-1">
                  {formatCurrency((product.sellingPrice || 0) * product.weight)}
                </div>
              </TableCell>
              <TableCell className="p-1">
                <div className={`font-semibold whitespace-nowrap text-xs px-1 ${product.pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(product.pl)}
                </div>
              </TableCell>
              <TableCell className="p-1">
                <div className="font-medium whitespace-nowrap text-xs px-1">
                  {product.remainingWeight?.toFixed(2) || '0.00'}
                </div>
              </TableCell>
              <TableCell className="p-1">
                <div className="font-semibold text-slate-800 whitespace-nowrap text-xs px-1">
                  {formatCurrency(product.targetProfit || 0)}
                </div>
              </TableCell>
              <TableCell className="p-1">
                <div className="font-semibold text-emerald-600 whitespace-nowrap text-xs px-1">
                  {formatCurrency(product.nextSellingPointWithProfit || product.nextSellingPoint || 0)}
                </div>
              </TableCell>
              <TableCell className="p-1 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveProduct(product.id)}
                  disabled={!canRemove || isLoading}
                  className="text-destructive hover:text-destructive h-7 w-7 p-0 flex items-center justify-center mx-auto"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {/* Table Totals Row */}
          {products.length > 0 && (() => {
            const totalPercentage = products.reduce((sum, p) => sum + p.percentage, 0);
            const totalWeight = products.reduce((sum, p) => sum + p.weight, 0);
            const totalAllocatedCost = products.reduce((sum, p) => sum + p.allocatedCost, 0);
            const avgCostPerQtl = totalWeight > 0 ? totalAllocatedCost / totalWeight : 0;
            
            const totalSellingAmount = products.reduce((sum, p) => sum + ((p.sellingPrice || 0) * p.weight), 0);
            const avgSellingPrice = totalWeight > 0 ? totalSellingAmount / totalWeight : 0;
            
            const totalSoldWeight = products.reduce((sum, p) => sum + (p.soldWeight || 0), 0);
            const avgSoldPercentage = totalWeight > 0 ? (totalSoldWeight / totalWeight) * 100 : 0;
            
            const totalPL = products.reduce((sum, p) => sum + p.pl, 0);
            const totalRemainingWeight = products.reduce((sum, p) => sum + (p.remainingWeight || 0), 0);
            const totalTargetProfit = products.reduce((sum, p) => sum + (p.targetProfit || 0), 0);
            
            const totalRemainingCostWithProfit = products.reduce((sum, p) => {
                const remCost = p.remainingWeight * p.costPerQtl;
                const remProfit = p.targetProfit - p.pl;
                return sum + remCost + Math.max(0, remProfit);
            }, 0);
            const avgNextSellingPrice = totalRemainingWeight > 0 ? totalRemainingCostWithProfit / totalRemainingWeight : 0;

            return (
              <TableRow className="bg-slate-50 font-bold hover:bg-slate-50 border-t-2 border-slate-200 h-8">
                <TableCell className="p-1 font-bold text-slate-800 text-xs px-2.5">TOTAL</TableCell>
                <TableCell className="p-1 font-bold text-xs px-2">{totalPercentage.toFixed(1)}%</TableCell>
                <TableCell className="p-1 font-bold text-xs px-1">{totalWeight.toFixed(2)}</TableCell>
                <TableCell className="p-1 font-bold text-xs px-1">{formatCurrency(totalAllocatedCost)}</TableCell>
                <TableCell className="p-1 font-semibold text-primary text-xs px-1">{formatCurrency(avgCostPerQtl)}</TableCell>
                <TableCell className="p-1 font-bold text-xs px-2">{formatCurrency(avgSellingPrice)}</TableCell>
                <TableCell className="p-1 font-bold text-xs px-2">{avgSoldPercentage.toFixed(1)}%</TableCell>
                <TableCell className="p-1 font-semibold text-primary text-xs px-1">{formatCurrency(totalSellingAmount)}</TableCell>
                <TableCell className={`p-1 font-semibold text-xs px-1 ${totalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalPL)}
                </TableCell>
                <TableCell className="p-1 font-bold text-xs px-1">{totalRemainingWeight.toFixed(2)}</TableCell>
                <TableCell className="p-1 font-semibold text-primary text-xs px-1">{formatCurrency(totalTargetProfit)}</TableCell>
                <TableCell className="p-1 font-semibold text-emerald-600 text-xs px-1">{formatCurrency(avgNextSellingPrice)}</TableCell>
                <TableCell className="p-1" />
              </TableRow>
            );
          })()}
        </TableBody>
      </Table>
    </div>
  );
}




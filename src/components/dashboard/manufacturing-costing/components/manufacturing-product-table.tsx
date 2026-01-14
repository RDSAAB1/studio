import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { CalculatedProduct } from '../hooks/use-manufacturing-calculations';

interface ManufacturingProductTableProps {
  products: CalculatedProduct[];
  overallTargetProfit: number;
  isLoading: boolean;
  onUpdateProduct: (id: string, field: keyof CalculatedProduct, value: string | number) => void;
  onRemoveProduct: (id: string) => void;
  canRemove: boolean;
}

export function ManufacturingProductTable({
  products,
  overallTargetProfit,
  isLoading,
  onUpdateProduct,
  onRemoveProduct,
  canRemove,
}: ManufacturingProductTableProps) {
  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table className="min-w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[180px]">Product Name</TableHead>
            <TableHead className="min-w-[100px]">Percentage (%)</TableHead>
            <TableHead className="min-w-[110px]">Weight (QTL)</TableHead>
            <TableHead className="min-w-[130px]">Allocated Cost</TableHead>
            <TableHead className="min-w-[130px]">Cost per QTL</TableHead>
            <TableHead className="min-w-[130px]">Selling Price</TableHead>
            <TableHead className="min-w-[100px]">Sold %</TableHead>
            <TableHead className="min-w-[130px]">Remaining (QTL)</TableHead>
            <TableHead className="min-w-[130px]">Target Profit</TableHead>
            <TableHead className="min-w-[150px]">Next Selling Price</TableHead>
            <TableHead className="min-w-[120px]">Profit</TableHead>
            <TableHead className="min-w-[100px]">Margin %</TableHead>
            <TableHead className="min-w-[80px] w-[80px]">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell className="p-3">
                <Input
                  value={product.name}
                  onChange={(e) => onUpdateProduct(product.id, 'name', e.target.value)}
                  placeholder="Product name"
                  className="w-full min-w-[150px]"
                  disabled={isLoading}
                />
              </TableCell>
              <TableCell className="p-3">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={product.percentage || ''}
                  onChange={(e) => onUpdateProduct(product.id, 'percentage', parseFloat(e.target.value) || 0)}
                  placeholder="%"
                  className="w-full min-w-[80px]"
                  disabled={isLoading}
                />
              </TableCell>
              <TableCell className="p-3">
                <div className="font-medium whitespace-nowrap">
                  {product.weight.toFixed(2)} QTL
                </div>
              </TableCell>
              <TableCell className="p-3">
                <div className="font-medium whitespace-nowrap">
                  {formatCurrency(product.allocatedCost)}
                </div>
              </TableCell>
              <TableCell className="p-3">
                <div className="font-semibold text-primary whitespace-nowrap">
                  {formatCurrency(product.costPerQtl)}
                </div>
              </TableCell>
              <TableCell className="p-3">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={product.sellingPrice || ''}
                  onChange={(e) => onUpdateProduct(product.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                  placeholder="Sold Price"
                  className="w-full min-w-[100px]"
                  disabled={isLoading}
                />
                {product.soldWeight && product.soldWeight > 0 && product.sellingPrice && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Sold at: {formatCurrency(product.sellingPrice)}/QTL
                  </div>
                )}
              </TableCell>
              <TableCell className="p-3">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={product.soldPercentage || ''}
                  onChange={(e) => onUpdateProduct(product.id, 'soldPercentage', parseFloat(e.target.value) || 0)}
                  placeholder="%"
                  className="w-full min-w-[80px]"
                  disabled={isLoading}
                />
              </TableCell>
              <TableCell className="p-3">
                <div className="font-medium whitespace-nowrap">
                  {product.remainingWeight?.toFixed(2) || '0.00'} QTL
                  {product.soldWeight && product.soldWeight > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Sold: {product.soldWeight.toFixed(2)}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="p-3">
                <div className="font-semibold text-primary whitespace-nowrap text-lg">
                  {formatCurrency(product.targetProfit || 0)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {overallTargetProfit > 0 ? 'Distributed from overall target' : 'Set overall target profit'}
                </div>
              </TableCell>
              <TableCell className="p-3">
                <div className="font-semibold text-primary whitespace-nowrap text-lg">
                  {formatCurrency(product.nextSellingPointWithProfit || product.nextSellingPoint || 0)} / QTL
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Suggested for remaining stock
                </div>
              </TableCell>
              <TableCell className="p-3">
                <div className={`font-semibold whitespace-nowrap text-lg ${product.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(product.profit)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Net profit after all costs & expenses
                </div>
                {product.soldProfit !== undefined && product.remainingProfit !== undefined && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Sold: {formatCurrency(product.soldProfit || 0)} | Remaining: {formatCurrency(product.remainingProfit || 0)}
                  </div>
                )}
              </TableCell>
              <TableCell className="p-3">
                <div className={`font-semibold whitespace-nowrap ${product.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {product.profitMargin.toFixed(2)}%
                </div>
              </TableCell>
              <TableCell className="p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveProduct(product.id)}
                  disabled={!canRemove || isLoading}
                  className="text-destructive hover:text-destructive w-full"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}




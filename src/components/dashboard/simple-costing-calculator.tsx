"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator, DollarSign, Package, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export function SimpleCostingCalculator() {
    const [buyingRate, setBuyingRate] = useState<number>(0);
    const [expense, setExpense] = useState<number>(0);
    const [quantity, setQuantity] = useState<number>(0);

    const calculations = useMemo(() => {
        const totalPurchaseCost = buyingRate * quantity;
        const totalCost = totalPurchaseCost + expense;
        const costPerUnit = quantity > 0 ? totalCost / quantity : 0;

        return {
            totalPurchaseCost,
            totalCost,
            costPerUnit,
        };
    }, [buyingRate, expense, quantity]);

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Simple Costing Calculator
                </CardTitle>
                <CardDescription>
                    Enter buying rate, expense, and quantity to calculate total costing
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Input Fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="buyingRate" className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Buying Rate (per QTL)
                        </Label>
                        <Input
                            id="buyingRate"
                            type="number"
                            step="0.01"
                            min="0"
                            value={buyingRate || ''}
                            onChange={(e) => setBuyingRate(parseFloat(e.target.value) || 0)}
                            placeholder="Enter buying rate"
                            className="text-lg"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="expense" className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            Total Expense
                        </Label>
                        <Input
                            id="expense"
                            type="number"
                            step="0.01"
                            min="0"
                            value={expense || ''}
                            onChange={(e) => setExpense(parseFloat(e.target.value) || 0)}
                            placeholder="Enter expense"
                            className="text-lg"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="quantity" className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Quantity (QTL)
                        </Label>
                        <Input
                            id="quantity"
                            type="number"
                            step="0.01"
                            min="0"
                            value={quantity || ''}
                            onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                            placeholder="Enter quantity"
                            className="text-lg"
                        />
                    </div>
                </div>

                {/* Results */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <Card className="bg-muted/50">
                        <CardContent className="pt-6">
                            <div className="text-sm font-medium text-muted-foreground mb-2">
                                Total Purchase Cost
                            </div>
                            <div className="text-2xl font-bold">
                                {formatCurrency(calculations.totalPurchaseCost)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                {buyingRate.toFixed(2)} × {quantity.toFixed(2)} QTL
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                        <CardContent className="pt-6">
                            <div className="text-sm font-medium text-muted-foreground mb-2">
                                Total Cost
                            </div>
                            <div className="text-2xl font-bold text-primary">
                                {formatCurrency(calculations.totalCost)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                Purchase + Expense
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-primary/5 border-primary/20">
                        <CardContent className="pt-6">
                            <div className="text-sm font-medium text-muted-foreground mb-2">
                                Cost per QTL
                            </div>
                            <div className="text-2xl font-bold text-primary">
                                {formatCurrency(calculations.costPerUnit)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                Total Cost ÷ Quantity
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Calculation Breakdown */}
                {quantity > 0 && (
                    <Card className="bg-muted/30">
                        <CardContent className="pt-6">
                            <div className="text-sm font-semibold mb-3">Calculation Breakdown:</div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Purchase Cost:</span>
                                    <span className="font-medium">
                                        {formatCurrency(buyingRate)} × {quantity.toFixed(2)} QTL = {formatCurrency(calculations.totalPurchaseCost)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Expense:</span>
                                    <span className="font-medium">{formatCurrency(expense)}</span>
                                </div>
                                <div className="border-t pt-2 mt-2 flex justify-between">
                                    <span className="font-semibold">Total Cost:</span>
                                    <span className="font-bold text-lg">{formatCurrency(calculations.totalCost)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Cost per QTL:</span>
                                    <span className="font-bold text-primary">
                                        {formatCurrency(calculations.totalCost)} ÷ {quantity.toFixed(2)} = {formatCurrency(calculations.costPerUnit)}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </CardContent>
        </Card>
    );
}


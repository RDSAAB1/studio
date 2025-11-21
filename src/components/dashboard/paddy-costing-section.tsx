"use client";

import { useMemo, useState } from 'react';
import type { Customer, Expense } from '@/lib/definitions';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calculator, TrendingUp, DollarSign, Target, Lightbulb, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ProductBreakdown {
    percentage: number;
    weight: number;
    minRate: number;
    maxRate: number;
    avgRate: number;
    revenue: number;
}

interface PaddyCostingSectionProps {
    suppliers: Customer[];
    expenses: Expense[];
}

export function PaddyCostingSection({ suppliers, expenses }: PaddyCostingSectionProps) {
    // Temporary input fields for expense and target profit
    const [tempExpense, setTempExpense] = useState<number>(0);
    const [tempTargetProfit, setTempTargetProfit] = useState<number>(0);
    const [soldProduct, setSoldProduct] = useState<string>('');
    const [soldQuantity, setSoldQuantity] = useState<number>(0);
    const [soldAvgPrice, setSoldAvgPrice] = useState<number>(0);
    
    // Suggestion state
    const [currentSuggestion, setCurrentSuggestion] = useState<{
        productKey: string;
        suggestedAvgRate: number;
    } | null>(null);
    const [rejectedSuggestions, setRejectedSuggestions] = useState<Set<string>>(new Set());
    
    // Product breakdown state
    const [productBreakdown, setProductBreakdown] = useState<Record<string, ProductBreakdown>>({
        DRYING: { percentage: 0, weight: 0, minRate: 0, maxRate: 0, avgRate: 0, revenue: 0 },
        RICE: { percentage: 0, weight: 0, minRate: 0, maxRate: 0, avgRate: 0, revenue: 0 },
        HUSK: { percentage: 0, weight: 0, minRate: 0, maxRate: 0, avgRate: 0, revenue: 0 },
        BREAKED_RICE: { percentage: 0, weight: 0, minRate: 0, maxRate: 0, avgRate: 0, revenue: 0 },
        SUPER_BREAKED_RICE: { percentage: 0, weight: 0, minRate: 0, maxRate: 0, avgRate: 0, revenue: 0 },
        POLISH: { percentage: 0, weight: 0, minRate: 0, maxRate: 0, avgRate: 0, revenue: 0 },
        REJECTION: { percentage: 0, weight: 0, minRate: 0, maxRate: 0, avgRate: 0, revenue: 0 },
    });

    // Calculate Total Final Weight from Suppliers
    const totalFinalWeight = useMemo(() => {
        return suppliers.reduce((sum, supplier) => sum + (Number(supplier.weight) || 0), 0);
    }, [suppliers]);

    // Calculate Total Paddy Cost
    const totalPaddyCost = useMemo(() => {
        // Seasonal expenses
        const seasonalExpenses = expenses
            .filter(e => e.expenseNature === 'Seasonal')
            .reduce((sum, e) => sum + (e.amount || 0), 0);
        
        // Total supplier net payable (original net amount - this is what we owe suppliers)
        const totalSupplierNetPayable = suppliers.reduce((sum, s) => {
            const originalAmount = Number(s.originalNetAmount) || Number(s.netAmount) || 0;
            return sum + originalAmount;
        }, 0);
        
        return seasonalExpenses + totalSupplierNetPayable;
    }, [expenses, suppliers]);

    // Cost per QTL
    const costPerQtl = useMemo(() => {
        return totalFinalWeight > 0 ? totalPaddyCost / totalFinalWeight : 0;
    }, [totalPaddyCost, totalFinalWeight]);

    // Update product weights when percentages change
    const updateProductWeight = (productKey: string, percentage: number) => {
        const weight = (totalFinalWeight * percentage) / 100;
        setProductBreakdown(prev => ({
            ...prev,
            [productKey]: {
                ...prev[productKey],
                percentage,
                weight,
            }
        }));
    };

    // Update min/max rates
    const updateRates = (productKey: string, minRate: number, maxRate: number) => {
        const product = productBreakdown[productKey];
        // Keep existing avgRate if it's within the new range, otherwise set to midpoint
        let newAvgRate = product.avgRate;
        if (newAvgRate < minRate || newAvgRate > maxRate) {
            newAvgRate = (minRate + maxRate) / 2;
        }
        const revenue = product.weight * newAvgRate;
        
        setProductBreakdown(prev => ({
            ...prev,
            [productKey]: {
                ...prev[productKey],
                minRate,
                maxRate,
                avgRate: newAvgRate,
                revenue,
            }
        }));
    };

    // Update average rate directly (must be within min/max range)
    const updateAvgRate = (productKey: string, avgRate: number) => {
        const product = productBreakdown[productKey];
        // Ensure avgRate is within min/max bounds
        const clampedAvgRate = Math.max(product.minRate, Math.min(product.maxRate, avgRate));
        const revenue = product.weight * clampedAvgRate;
        
        setProductBreakdown(prev => ({
            ...prev,
            [productKey]: {
                ...prev[productKey],
                avgRate: clampedAvgRate,
                revenue,
            }
        }));
    };

    // Calculate total revenue
    const totalRevenue = useMemo(() => {
        return Object.values(productBreakdown).reduce((sum, product) => sum + product.revenue, 0);
    }, [productBreakdown]);

    // Calculate target profit
    const targetProfit = useMemo(() => {
        return totalRevenue - totalPaddyCost;
    }, [totalRevenue, totalPaddyCost]);

    // Price adjustment logic: If any product's avg selling price < cost per qtl, adjust others
    // BUT average price must always stay within min/max range
    const adjustedBreakdown = useMemo(() => {
        const adjusted = { ...productBreakdown };
        const products = Object.keys(adjusted);
        
        // Find products with avg rate below cost per qtl
        const belowCostProducts = products.filter(key => {
            const product = adjusted[key];
            return product.weight > 0 && product.avgRate > 0 && product.avgRate < costPerQtl;
        });
        
        if (belowCostProducts.length > 0 && costPerQtl > 0) {
            // Calculate total deficit
            let totalDeficit = 0;
            belowCostProducts.forEach(key => {
                const product = adjusted[key];
                const deficit = (costPerQtl - product.avgRate) * product.weight;
                totalDeficit += deficit;
            });
            
            // Distribute deficit to other products
            const profitableProducts = products.filter(key => {
                const product = adjusted[key];
                return product.weight > 0 && product.avgRate >= costPerQtl && !belowCostProducts.includes(key);
            });
            
            if (profitableProducts.length > 0) {
                const deficitPerQtl = totalDeficit / profitableProducts.reduce((sum, key) => 
                    sum + adjusted[key].weight, 0);
                
                profitableProducts.forEach(key => {
                    const product = adjusted[key];
                    // Calculate new average rate but clamp it within min/max bounds
                    const proposedAvgRate = product.avgRate + deficitPerQtl;
                    // IMPORTANT: Average rate must stay within min/max range
                    const newAvgRate = Math.max(product.minRate, Math.min(product.maxRate, proposedAvgRate));
                    
                    adjusted[key] = {
                        ...product,
                        avgRate: newAvgRate,
                        // Keep original min/max rates unchanged
                        revenue: product.weight * newAvgRate,
                    };
                });
            }
        }
        
        return adjusted;
    }, [productBreakdown, costPerQtl]);

    // Recalculate adjusted revenue and profit
    const adjustedRevenue = useMemo(() => {
        return Object.values(adjustedBreakdown).reduce((sum, product) => sum + product.revenue, 0);
    }, [adjustedBreakdown]);

    const adjustedProfit = useMemo(() => {
        return adjustedRevenue - totalPaddyCost;
    }, [adjustedRevenue, totalPaddyCost]);

    const profitMargin = useMemo(() => {
        return totalPaddyCost > 0 ? (adjustedProfit / totalPaddyCost) * 100 : 0;
    }, [adjustedProfit, totalPaddyCost]);

    // Calculate suggested average prices based on temp inputs
    const calculateSuggestions = useMemo(() => {
        if (!tempExpense || !tempTargetProfit || !soldProduct || !soldQuantity || !soldAvgPrice) {
            return null;
        }

        // Total required revenue = Expense + Target Profit
        const requiredRevenue = tempExpense + tempTargetProfit;
        
        // Revenue from sold product
        const soldRevenue = soldQuantity * soldAvgPrice;
        
        // Remaining revenue needed from other products
        const remainingRevenue = requiredRevenue - soldRevenue;
        
        // Calculate remaining weight (total - sold)
        const remainingWeight = totalFinalWeight - soldQuantity;
        
        if (remainingWeight <= 0 || remainingRevenue <= 0) {
            return null;
        }

        // Get products that haven't been sold and aren't rejected
        const availableProducts = Object.entries(productBreakdown)
            .filter(([key, product]) => 
                key !== soldProduct && 
                product.weight > 0 && 
                !rejectedSuggestions.has(key)
            );

        if (availableProducts.length === 0) {
            return null;
        }

        // Calculate suggested average rate for each available product
        const suggestions = availableProducts.map(([key, product]) => {
            // Distribute remaining revenue proportionally based on weight
            const totalAvailableWeight = availableProducts.reduce((sum, [, p]) => sum + p.weight, 0);
            const weightProportion = product.weight / totalAvailableWeight;
            const requiredRevenueForProduct = remainingRevenue * weightProportion;
            const suggestedAvgRate = product.weight > 0 ? requiredRevenueForProduct / product.weight : 0;
            
            // Clamp to min/max bounds
            const clampedRate = Math.max(product.minRate, Math.min(product.maxRate, suggestedAvgRate));
            
            return {
                productKey: key,
                product,
                suggestedAvgRate: clampedRate,
                requiredRevenue: requiredRevenueForProduct,
            };
        });

        return suggestions;
    }, [tempExpense, tempTargetProfit, soldProduct, soldQuantity, soldAvgPrice, totalFinalWeight, productBreakdown, rejectedSuggestions]);

    // Show next suggestion
    const showNextSuggestion = () => {
        if (!calculateSuggestions || calculateSuggestions.length === 0) {
            setCurrentSuggestion(null);
            return;
        }

        // Find first product that hasn't been suggested yet or rejected
        const nextSuggestion = calculateSuggestions.find(s => 
            !currentSuggestion || 
            (s.productKey !== currentSuggestion.productKey && !rejectedSuggestions.has(s.productKey))
        );

        if (nextSuggestion) {
            setCurrentSuggestion({
                productKey: nextSuggestion.productKey,
                suggestedAvgRate: nextSuggestion.suggestedAvgRate,
            });
        } else {
            setCurrentSuggestion(null);
        }
    };

    // Accept suggestion
    const acceptSuggestion = () => {
        if (!currentSuggestion) return;
        
        updateAvgRate(currentSuggestion.productKey, currentSuggestion.suggestedAvgRate);
        setCurrentSuggestion(null);
        // Show next suggestion after a brief delay
        setTimeout(() => showNextSuggestion(), 100);
    };

    // Reject suggestion
    const rejectSuggestion = () => {
        if (!currentSuggestion) return;
        
        setRejectedSuggestions(prev => new Set(prev).add(currentSuggestion.productKey));
        setCurrentSuggestion(null);
        // Show next suggestion
        setTimeout(() => showNextSuggestion(), 100);
    };

    // Auto-show suggestions when inputs change
    const handleInputsChange = () => {
        setRejectedSuggestions(new Set());
        setCurrentSuggestion(null);
        setTimeout(() => showNextSuggestion(), 100);
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Paddy Costing & Profit Analysis
                </CardTitle>
                <CardDescription>
                    Calculate costing per quintal and target profit based on product breakdown
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Temporary Input Section */}
                <Card className="bg-muted/50">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            Temporary Inputs for Price Suggestion
                        </CardTitle>
                        <CardDescription>
                            Enter expense, target profit, and sold product details to get price suggestions
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Total Expense</label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={tempExpense}
                                onChange={(e) => {
                                    setTempExpense(parseFloat(e.target.value) || 0);
                                    handleInputsChange();
                                }}
                                placeholder="Enter expense"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Target Profit</label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={tempTargetProfit}
                                onChange={(e) => {
                                    setTempTargetProfit(parseFloat(e.target.value) || 0);
                                    handleInputsChange();
                                }}
                                placeholder="Enter target profit"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Sold Product</label>
                            <Select
                                value={soldProduct}
                                onValueChange={(value) => {
                                    setSoldProduct(value);
                                    handleInputsChange();
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select product" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(productBreakdown).map(([key, product]) => (
                                        <SelectItem key={key} value={key}>
                                            {key.replace(/_/g, ' ')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Sold Quantity (QTL)</label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={soldQuantity}
                                onChange={(e) => {
                                    setSoldQuantity(parseFloat(e.target.value) || 0);
                                    handleInputsChange();
                                }}
                                placeholder="QTL sold"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Average Price</label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={soldAvgPrice}
                                onChange={(e) => {
                                    setSoldAvgPrice(parseFloat(e.target.value) || 0);
                                    handleInputsChange();
                                }}
                                placeholder="Avg price"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Suggestion Display */}
                {currentSuggestion && (
                    <Card className="border-2 border-primary bg-primary/5">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Lightbulb className="h-4 w-4 text-yellow-500" />
                                Price Suggestion
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="text-sm">
                                    <p className="font-medium mb-2">
                                        For <span className="text-primary font-bold">
                                            {currentSuggestion.productKey.replace(/_/g, ' ')}
                                        </span>:
                                    </p>
                                    <p className="text-lg">
                                        Suggested Average Price: <span className="font-bold text-primary">
                                            {formatCurrency(currentSuggestion.suggestedAvgRate)}
                                        </span>
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        (Range: {formatCurrency(productBreakdown[currentSuggestion.productKey].minRate)} - {formatCurrency(productBreakdown[currentSuggestion.productKey].maxRate)})
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button 
                                        onClick={acceptSuggestion}
                                        className="flex-1"
                                        variant="default"
                                    >
                                        <Check className="h-4 w-4 mr-2" />
                                        Accept
                                    </Button>
                                    <Button 
                                        onClick={rejectSuggestion}
                                        className="flex-1"
                                        variant="outline"
                                    >
                                        <X className="h-4 w-4 mr-2" />
                                        Reject
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-sm font-medium text-muted-foreground">Total Final Weight</div>
                            <div className="text-2xl font-bold">{totalFinalWeight.toFixed(2)} QTL</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-sm font-medium text-muted-foreground">Total Paddy Cost</div>
                            <div className="text-2xl font-bold">{formatCurrency(totalPaddyCost)}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-sm font-medium text-muted-foreground">Cost per QTL</div>
                            <div className="text-2xl font-bold">{formatCurrency(costPerQtl)}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-sm font-medium text-muted-foreground">Target Profit</div>
                            <div className={`text-2xl font-bold ${adjustedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(adjustedProfit)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                Margin: {profitMargin.toFixed(2)}%
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Product Breakdown Table */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Product Breakdown</h3>
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[150px]">Product</TableHead>
                                    <TableHead className="w-[120px]">Percentage</TableHead>
                                    <TableHead className="w-[120px]">Weight (QTL)</TableHead>
                                    <TableHead className="w-[120px]">Min Rate</TableHead>
                                    <TableHead className="w-[120px]">Max Rate</TableHead>
                                    <TableHead className="w-[120px]">Avg Rate (Range)</TableHead>
                                    <TableHead className="w-[150px] text-right">Revenue</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.entries(adjustedBreakdown).map(([key, product]) => {
                                    const displayName = key.replace(/_/g, ' ');
                                    const isBelowCost = product.weight > 0 && product.avgRate > 0 && product.avgRate < costPerQtl;
                                    
                                    return (
                                        <TableRow key={key} className={isBelowCost ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                                            <TableCell className="font-medium">{displayName}</TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    value={product.percentage}
                                                    onChange={(e) => {
                                                        const newPercentage = parseFloat(e.target.value) || 0;
                                                        updateProductWeight(key, newPercentage);
                                                    }}
                                                    className="w-full h-8"
                                                />
                                            </TableCell>
                                            <TableCell>{product.weight.toFixed(2)} QTL</TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={product.minRate}
                                                    onChange={(e) => {
                                                        const newMinRate = parseFloat(e.target.value) || 0;
                                                        updateRates(key, newMinRate, product.maxRate);
                                                    }}
                                                    className="w-full h-8"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={product.maxRate}
                                                    onChange={(e) => {
                                                        const newMaxRate = parseFloat(e.target.value) || 0;
                                                        updateRates(key, product.minRate, newMaxRate);
                                                    }}
                                                    className="w-full h-8"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min={product.minRate}
                                                    max={product.maxRate}
                                                    value={product.avgRate}
                                                    onChange={(e) => {
                                                        const newAvgRate = parseFloat(e.target.value) || 0;
                                                        updateAvgRate(key, newAvgRate);
                                                    }}
                                                    className={`w-full h-8 ${isBelowCost ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : ''}`}
                                                    title={`Must be between ${formatCurrency(product.minRate)} and ${formatCurrency(product.maxRate)}`}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">
                                                {formatCurrency(product.revenue)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Revenue Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Total Revenue
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{formatCurrency(adjustedRevenue)}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                Net Profit
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-3xl font-bold ${adjustedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(adjustedProfit)}
                            </div>
                            <div className="text-sm text-muted-foreground mt-2">
                                Profit Margin: {profitMargin.toFixed(2)}%
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </CardContent>
        </Card>
    );
}


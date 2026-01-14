"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calculator, DollarSign, Package, TrendingUp, Plus, Percent, Loader2, Settings } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { getManufacturingCostingRealtime, saveManufacturingCosting, type ManufacturingCostingData } from '@/lib/firestore';
import { useManufacturingCalculations, type Product } from './manufacturing-costing/hooks/use-manufacturing-calculations';
import { ManufacturingProductTable } from './manufacturing-costing/components/manufacturing-product-table';
import { ManufacturingSummaryCards } from './manufacturing-costing/components/manufacturing-summary-cards';

export function ManufacturingCosting() {
    const [buyingRate, setBuyingRate] = useState<number>(0);
    const [expense, setExpense] = useState<number>(0);
    const [quantity, setQuantity] = useState<number>(0);
    const [products, setProducts] = useState<Product[]>([
        { id: '1', name: 'Product 1', percentage: 0, sellingPrice: 0 }
    ]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
    const [costAllocationMethod, setCostAllocationMethod] = useState<'percentage' | 'value'>('value'); // 'percentage' or 'value' based
    const [overallTargetProfit, setOverallTargetProfit] = useState<number>(0); // Overall target profit for all products
    const [extraCost, setExtraCost] = useState<number>(0); // Extra cost for waste products (products that cannot be sold)
    
    // Refs to track previous values and prevent infinite loops
    const prevOverallTargetProfitRef = useRef<number>(overallTargetProfit);
    const prevQuantityRef = useRef<number>(quantity);

    // Calculate total cost
    // Note: extraCost includes only waste products (static), NOT loss from sold items (dynamic)
    const totalCost = useMemo(() => {
        const totalPurchaseCost = buyingRate * quantity;
        return totalPurchaseCost + expense + extraCost;
    }, [buyingRate, expense, quantity, extraCost]);

    // Calculate total percentage
    const totalPercentage = useMemo(() => {
        return products.reduce((sum, p) => sum + p.percentage, 0);
    }, [products]);

    // Use calculation hook
    const {
        productCalculations,
        totalRevenue,
        totalProfit,
        overallProfitMargin,
        remainingStockProfit,
        soldItemsProfit,
        totalProjectedProfit,
        targetProfitStatus,
    } = useManufacturingCalculations({
        products,
        quantity,
        totalCost,
        expense,
        totalPercentage,
        costAllocationMethod,
        overallTargetProfit,
    });

    // Calculations are now from useManufacturingCalculations hook


    const updateProduct = (id: string, field: keyof Product, value: string | number) => {
        setProducts(products.map(p => 
            p.id === id ? { ...p, [field]: value } : p
        ));
    };

    // Load data from Firestore
    useEffect(() => {
        setIsLoading(true);
        const unsubscribe = getManufacturingCostingRealtime(
            (data) => {
                if (data) {
                    setBuyingRate(data.buyingRate || 0);
                    setExpense(data.expense || 0);
                    setQuantity(data.quantity || 0);
                    setExtraCost(data.extraCost || 0);
                    if (data.products && data.products.length > 0) {
                        setProducts(data.products.map(p => ({
                            ...p,
                            targetProfit: p.targetProfit || 0
                        })));
                    }
                    if (data.costAllocationMethod) {
                        setCostAllocationMethod(data.costAllocationMethod);
                    }
                    if (data.overallTargetProfit !== undefined) {
                        setOverallTargetProfit(data.overallTargetProfit || 0);
                    }
                }
                setIsLoading(false);
            },
            (error) => {

                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    // Auto-save function with debounce (silent save)
    const saveToFirestore = useCallback(async () => {
        try {
            const currentBuyingRate = buyingRate;
            const currentExpense = expense;
            const currentQuantity = quantity;
            const currentExtraCost = extraCost;
            const currentProducts = products;
            
            await saveManufacturingCosting({
                buyingRate: currentBuyingRate,
                expense: currentExpense,
                quantity: currentQuantity,
                extraCost: currentExtraCost,
                products: currentProducts.map(p => ({
                    id: p.id,
                    name: p.name,
                    percentage: p.percentage,
                    sellingPrice: p.sellingPrice || 0,
                    soldPercentage: p.soldPercentage || 0,
                    targetProfit: p.targetProfit || 0
                })),
                costAllocationMethod,
                overallTargetProfit
            });
        } catch (error: any) {

        }
    }, [buyingRate, expense, quantity, extraCost, products, costAllocationMethod, overallTargetProfit]);

    // Auto-update individual target profits when overall target profit changes
    // Since target profit is read-only in table, always update from overall target profit
    useEffect(() => {
        if (isLoading || quantity <= 0) return;
        
        // Only update if overall target profit or quantity actually changed
        if (prevOverallTargetProfitRef.current === overallTargetProfit && 
            prevQuantityRef.current === quantity) {
            return; // No change, skip update
        }
        
        // Update refs
        prevOverallTargetProfitRef.current = overallTargetProfit;
        prevQuantityRef.current = quantity;
        
        // Calculate total initial weight for distribution
        const totalInitialWeight = products.reduce((sum, p) => {
            const pWeight = (quantity * p.percentage) / 100;
            return sum + pWeight;
        }, 0);
        
        if (totalInitialWeight > 0) {
            // Always update products with distributed target profit from overall target profit
            const updatedProducts = products.map(p => {
                const pWeight = (quantity * p.percentage) / 100;
                const initialWeightRatio = pWeight / totalInitialWeight;
                const distributedTargetProfit = overallTargetProfit > 0 
                    ? overallTargetProfit * initialWeightRatio 
                    : 0;
                
                return {
                    ...p,
                    targetProfit: distributedTargetProfit
                };
            });
            
            setProducts(updatedProducts);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [overallTargetProfit, quantity, isLoading]); // Removed 'products' from dependencies to prevent infinite loop

    // Auto-save on changes (debounced - silent)
    useEffect(() => {
        if (isLoading) return;

        // Clear existing timeout
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }

        // Set new timeout for auto-save (1 second after last change)
        const timeout = setTimeout(() => {
            saveToFirestore();
        }, 1000);

        setSaveTimeout(timeout);

        return () => {
            if (timeout) clearTimeout(timeout);
        };
    }, [buyingRate, expense, quantity, extraCost, products, costAllocationMethod, overallTargetProfit, isLoading, saveToFirestore]);

    // Update handlers
    const handleBuyingRateChange = (value: number) => {
        setBuyingRate(value);
    };

    const handleExpenseChange = (value: number) => {
        setExpense(value);
    };

    const handleQuantityChange = (value: number) => {
        setQuantity(value);
    };

    const handleAddProduct = () => {
        const newId = String(Date.now());
        setProducts([...products, { 
            id: newId, 
            name: `Product ${products.length + 1}`, 
            percentage: 0,
            sellingPrice: 0
        }]);
    };

    const handleRemoveProduct = (id: string) => {
        if (products.length > 1) {
            setProducts(products.filter(p => p.id !== id));
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Calculator className="h-5 w-5" />
                            Manufacturing Costing & Product Analysis
                        </CardTitle>
                        <CardDescription>
                            Calculate costing for multiple products from raw material with percentage breakdown
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {isLoading && (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading data...</span>
                    </div>
                )}
                {!isLoading && (
                <>
                {/* Cost Allocation Method */}
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            Cost Allocation Method
                        </CardTitle>
                        <CardDescription>
                            Choose how cost should be allocated to products
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4">
                            <Label htmlFor="allocationMethod" className="font-medium">
                                Allocation Method:
                            </Label>
                            <Select 
                                value={costAllocationMethod} 
                                onValueChange={(value: 'percentage' | 'value') => setCostAllocationMethod(value)}
                                disabled={isLoading}
                            >
                                <SelectTrigger className="w-[300px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="value">
                                        Value-Based (Based on Selling Price)
                                    </SelectItem>
                                    <SelectItem value="percentage">
                                        Percentage-Based (Based on Output %)
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="mt-3 p-3 bg-muted/50 rounded-lg text-sm">
                            {costAllocationMethod === 'value' ? (
                                <div>
                                    <p className="font-semibold mb-1">Value-Based Allocation:</p>
                                    <p className="text-muted-foreground">
                                        Cost is allocated based on product value (Selling Price × Weight). 
                                        Products with higher selling prices get more cost allocation.
                                    </p>
                                    <p className="text-muted-foreground mt-1">
                                        Example: If Product A sells at ₹100/QTL and Product B at ₹50/QTL, 
                                        Product A will get 2x more cost allocation.
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <p className="font-semibold mb-1">Percentage-Based Allocation:</p>
                                    <p className="text-muted-foreground">
                                        Cost is allocated based on output percentage only. 
                                        Each product gets cost proportional to its percentage.
                                    </p>
                                    <p className="text-muted-foreground mt-1">
                                        Example: If both products have 50% output, they get equal cost allocation 
                                        regardless of selling price.
                                    </p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Raw Material Input */}
                <Card className="bg-muted/50">
                    <CardHeader>
                        <CardTitle className="text-base">Raw Material Input</CardTitle>
                    </CardHeader>
                    <CardContent>
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
                                    onChange={(e) => handleBuyingRateChange(parseFloat(e.target.value) || 0)}
                                    disabled={isLoading}
                                    placeholder="Enter buying rate"
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
                                    onChange={(e) => handleExpenseChange(parseFloat(e.target.value) || 0)}
                                    disabled={isLoading}
                                    placeholder="Enter expense"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="quantity" className="flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    Raw Material Quantity (QTL)
                                </Label>
                                <Input
                                    id="quantity"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={quantity || ''}
                                    onChange={(e) => handleQuantityChange(parseFloat(e.target.value) || 0)}
                                    disabled={isLoading}
                                    placeholder="Enter quantity"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="extraCost" className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4" />
                                    Extra Cost (Waste)
                                </Label>
                                <Input
                                    id="extraCost"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={extraCost || ''}
                                    onChange={(e) => setExtraCost(parseFloat(e.target.value) || 0)}
                                    disabled={isLoading}
                                    placeholder="Enter extra cost"
                                />
                                <div className="text-xs text-muted-foreground">
                                    Cost for waste products (that cannot be sold)
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="bg-background">
                                <CardContent className="pt-4">
                                    <div className="text-sm font-medium text-muted-foreground mb-1">
                                        Total Cost
                                    </div>
                                    <div className="text-xl font-bold">
                                        {formatCurrency(totalCost)}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-background">
                                <CardContent className="pt-4">
                                    <div className="text-sm font-medium text-muted-foreground mb-1">
                                        Cost per QTL (Raw Material)
                                    </div>
                                    <div className="text-xl font-bold">
                                        {formatCurrency(quantity > 0 ? totalCost / quantity : 0)}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-primary/5 border-primary/20">
                                <CardContent className="pt-4">
                                    <Label htmlFor="overallTargetProfit" className="text-sm font-medium text-muted-foreground mb-2 block">
                                        Overall Target Profit
                                    </Label>
                                    <Input
                                        id="overallTargetProfit"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={overallTargetProfit || ''}
                                        onChange={(e) => setOverallTargetProfit(parseFloat(e.target.value) || 0)}
                                        placeholder="Enter target profit"
                                        className="w-full text-lg font-bold"
                                        disabled={isLoading}
                                    />
                                    <div className="text-xs text-muted-foreground mt-2">
                                        Total profit target for all remaining products
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </CardContent>
                </Card>

                {/* Products Section */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-base">Products</CardTitle>
                            <CardDescription>
                                Add products and set their output percentage
                            </CardDescription>
                        </div>
                        <Button onClick={handleAddProduct} size="sm" variant="outline" disabled={isLoading}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Product
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <ManufacturingProductTable
                                products={productCalculations}
                                overallTargetProfit={overallTargetProfit}
                                isLoading={isLoading}
                                onUpdateProduct={updateProduct}
                                onRemoveProduct={handleRemoveProduct}
                                canRemove={products.length > 1}
                            />

                            {/* Percentage Warning */}
                            {totalPercentage !== 100 && (
                                <div className={`p-3 rounded-lg border ${
                                    totalPercentage > 100 
                                        ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800' 
                                        : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800'
                                }`}>
                                    <div className="flex items-center gap-2 text-sm font-medium">
                                        <Percent className="h-4 w-4" />
                                        Total Percentage: {totalPercentage.toFixed(2)}%
                                        {totalPercentage > 100 && (
                                            <span className="text-red-600">(Exceeds 100%)</span>
                                        )}
                                        {totalPercentage < 100 && (
                                            <span className="text-yellow-600">(Less than 100%)</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            <ManufacturingSummaryCards
                                totalRevenue={totalRevenue}
                                totalProfit={totalProfit}
                                overallProfitMargin={overallProfitMargin}
                                totalOutput={productCalculations.reduce((sum, p) => sum + p.weight, 0)}
                                targetProfitStatus={targetProfitStatus}
                            />
                        </div>
                    </CardContent>
                </Card>
                </>
                )}
            </CardContent>
        </Card>
    );
}

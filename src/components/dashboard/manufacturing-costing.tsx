"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calculator, DollarSign, Package, TrendingUp, Plus, Trash2, Target, Percent, Loader2, Settings } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { getManufacturingCostingRealtime, saveManufacturingCosting, type ManufacturingCostingData } from '@/lib/firestore';

interface Product {
    id: string;
    name: string;
    percentage: number;
    sellingPrice?: number;
    soldPercentage?: number; // Percentage of product that has been sold
    targetProfit?: number; // Target profit for remaining stock
}

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

    // Calculate product breakdowns
    const productCalculations = useMemo(() => {
        if (quantity <= 0 || totalPercentage <= 0) {
            return products.map(p => ({
                ...p,
                weight: 0,
                allocatedCost: 0,
                costPerQtl: 0,
                profit: 0,
                profitMargin: 0,
                sellingPoint: 0
            }));
        }

        // Calculate weights first
        const productsWithWeights = products.map(product => ({
            ...product,
            weight: (quantity * product.percentage) / 100,
            sellingPrice: product.sellingPrice || 0
        }));

        // Calculate cost allocation based on method
        let productsWithCost: typeof productsWithWeights;
        
        if (costAllocationMethod === 'value') {
            // Value-based allocation: Based on selling price × weight ratio
            const totalValue = productsWithWeights.reduce((sum, p) => {
                return sum + (p.sellingPrice * p.weight);
            }, 0);

            productsWithCost = productsWithWeights.map(product => {
                const productValue = product.sellingPrice * product.weight;
                const valueRatio = totalValue > 0 ? productValue / totalValue : 0;
                const allocatedCost = totalCost * valueRatio;
                
                return {
                    ...product,
                    allocatedCost
                };
            });
        } else {
            // Percentage-based allocation (original method)
            productsWithCost = productsWithWeights.map(product => {
                const allocatedCost = (totalCost * product.percentage) / 100;
                return {
                    ...product,
                    allocatedCost
                };
            });
        }

        // Calculate expense allocation (same method as cost allocation)
        let productsWithExpense: typeof productsWithCost;
        if (costAllocationMethod === 'value') {
            const totalValue = productsWithCost.reduce((sum, p) => {
                const pWeight = (quantity * p.percentage) / 100;
                return sum + ((p.sellingPrice || 0) * pWeight);
            }, 0);
            productsWithExpense = productsWithCost.map(product => {
                const productValue = (product.sellingPrice || 0) * product.weight;
                const valueRatio = totalValue > 0 ? productValue / totalValue : 0;
                const allocatedExpense = expense * valueRatio;
                return {
                    ...product,
                    allocatedExpense
                };
            });
        } else {
            // Percentage-based expense allocation
            productsWithExpense = productsWithCost.map(product => {
                const allocatedExpense = (expense * product.percentage) / 100;
                return {
                    ...product,
                    allocatedExpense
                };
            });
        }

        // First pass: Calculate all products with initial suggested prices
        const calculatedProducts = productsWithExpense.map(product => {
            const weight = product.weight;
            const allocatedCost = product.allocatedCost;
            const allocatedExpense = product.allocatedExpense || 0;
            const costPerQtl = weight > 0 ? allocatedCost / weight : 0;
            const sellingPrice = product.sellingPrice || 0; // This is the price at which items were SOLD
            
            // Sold tracking calculations
            const soldPercentage = product.soldPercentage || 0;
            const soldWeight = (weight * soldPercentage) / 100;
            const remainingWeight = weight - soldWeight;
            const soldCost = (allocatedCost * soldPercentage) / 100;
            const soldExpense = (allocatedExpense * soldPercentage) / 100;
            const remainingCost = allocatedCost - soldCost;
            const remainingExpense = allocatedExpense - soldExpense;
            const nextCostPerQtl = remainingWeight > 0 ? remainingCost / remainingWeight : 0;
            
            // Calculate total investment per QTL (Cost + Expense) - Calculate once, use multiple times
            const totalInvestmentPerQtl = weight > 0 ? (allocatedCost + allocatedExpense) / weight : 0;
            
            // Calculate profit from SOLD items (using selling price entered)
            // Revenue from sold items
            const soldRevenue = sellingPrice > 0 ? sellingPrice * soldWeight : 0;
            
            // Investment for sold items (cost + expense per QTL × sold weight)
            const soldInvestment = totalInvestmentPerQtl * soldWeight;
            
            // Sold profit (this can be negative if sold at loss)
            // Profit = Revenue - (Cost + Expense)
            const soldProfit = soldRevenue - soldInvestment;
            
            // Note: Sold profit will change when sold % or sold price changes
            // But we'll calculate total profit differently to keep it fixed
            const soldProfitMargin = soldCost > 0 && sellingPrice > 0 
                ? ((sellingPrice - (soldCost / soldWeight)) / (soldCost / soldWeight)) * 100 
                : 0;
            
            // Calculate product value for cost allocation (using selling price)
            const productValue = sellingPrice * weight;
            
            // Overall profit calculation (sold + remaining)
            const totalProfit = soldProfit; // Will add remaining profit when we calculate next selling price
            
            // Target profit calculation for next selling price (for REMAINING stock)
            // TARGET PROFIT MUST BE FIXED - it should NOT change when sold % changes
            const targetProfit = product.targetProfit || 0;
            
            // Calculate overall target profit distribution (if overall target is set and individual target is not)
            // IMPORTANT: Distribute based on INITIAL weight ratio, NOT remaining weight ratio
            // This ensures target profit is FIXED and doesn't change when sold % changes
            let finalTargetProfit = targetProfit;
            if (overallTargetProfit > 0 && targetProfit === 0) {
                // Distribute overall target profit based on INITIAL weight ratio (not remaining weight)
                // This keeps target profit FIXED regardless of sold percentage
                const totalInitialWeight = productsWithCost.reduce((sum, p) => {
                    const pWeight = (quantity * p.percentage) / 100;
                    return sum + pWeight;
                }, 0);
                
                if (totalInitialWeight > 0 && weight > 0) {
                    // Use INITIAL weight ratio, not remaining weight ratio
                    const initialWeightRatio = weight / totalInitialWeight;
                    finalTargetProfit = overallTargetProfit * initialWeightRatio;
                } else {
                    // If no weight, no target profit
                    finalTargetProfit = 0;
                }
            } else if (overallTargetProfit > 0 && targetProfit > 0) {
                // If both overall and individual target profit are set, use individual (it takes priority)
                finalTargetProfit = targetProfit;
            }
            
            // Calculate next selling price for REMAINING stock
            // Formula: Next Selling Price = ((Total Investment - Sold Revenue) + Target Profit) / Remaining QTY
            // Where Total Investment = (Cost + Expense) per QTL × Total QTL
            // This ensures we cover: Cost + Expense + Loss (if any) + Target Profit
            
            // Note: totalInvestmentPerQtl and soldInvestment are already calculated above
            
            // Step 1: Calculate loss from sold items (if sold at lower price than cost+expense)
            // soldRevenue and soldInvestment are already calculated above
            const soldLoss = Math.max(0, soldInvestment - soldRevenue);
            
            // Step 2: Calculate remaining investment to recover (remaining cost + expense + loss)
            const remainingInvestment = (totalInvestmentPerQtl * remainingWeight) + soldLoss;
            
            // Step 4: Calculate required revenue (to cover investment + target profit)
            const totalRequiredForRemaining = remainingInvestment + finalTargetProfit;
            
            // Step 5: Calculate selling price
            // Next Selling Price = (Remaining Investment + Target Profit) / Remaining QTY
            const nextSellingPoint = remainingWeight > 0 ? totalRequiredForRemaining / remainingWeight : 0;
            let nextSellingPointWithProfit = nextSellingPoint; // Suggested selling price for remaining stock
            
            // Calculate profit from remaining stock
            // Revenue from remaining items at suggested price
            const remainingRevenue = nextSellingPointWithProfit * remainingWeight;
            
            // Calculate Total Profit using the formula:
            // PROFIT = Sold Profit + Remaining Profit
            // Where:
            // - Sold Profit = Sold Revenue - Sold Cost (can be negative if sold at loss)
            // - Remaining Profit = Target Profit (fixed, based on costing and target profit)
            
            // Sold Profit = Sold Revenue - Sold Cost
            // This is already calculated above as soldProfit
            
            // Remaining Profit will be calculated after shortfall distribution
            // Initially, remaining profit should be target profit (will be adjusted later)
            // But we need to ensure: Total Profit = Target Profit exactly
            // So: Remaining Profit = Target Profit - Sold Profit (for this product)
            // However, we'll adjust this after calculating total shortfall across all products
            const remainingProfit = remainingWeight > 0 ? finalTargetProfit : 0;
            
            // Total Profit = Sold Profit + Remaining Profit
            // This will be recalculated after shortfall distribution to ensure total = target
            const totalProductProfit = soldProfit + remainingProfit;
            
            // This profit ONLY changes when:
            // 1. Costing changes (if it affects target profit distribution)
            // 2. Target Profit changes (individual or overall)
            // It does NOT change when:
            // - Sold % changes (profit stays fixed, only suggested price changes)
            // - Sold Price changes (profit stays fixed, only suggested price changes)
            
            // Overall profit margin (based on total investment: cost + expense)
            const totalInvestment = allocatedCost + allocatedExpense;
            const overallProfitMargin = totalInvestment > 0
                ? (totalProductProfit / totalInvestment) * 100
                : 0;

            return {
                ...product,
                weight,
                allocatedCost,
                allocatedExpense,
                costPerQtl,
                profit: totalProductProfit, // Total profit (sold + remaining) after all costs and expenses
                profitMargin: overallProfitMargin, // Overall profit margin
                sellingPoint: costPerQtl, // Initial cost per QTL
                soldPercentage,
                soldWeight,
                remainingWeight,
                soldCost,
                soldExpense,
                remainingCost,
                remainingExpense,
                nextCostPerQtl,
                nextSellingPoint,
                nextSellingPointWithProfit,
                targetProfit: finalTargetProfit,
                productValue,
                soldRevenue,
                soldProfit,
                soldProfitMargin,
                remainingRevenue,
                remainingProfit
            };
        });
        
        // Calculate total loss/profit from sold items across all products
        const totalSoldProfit = calculatedProducts.reduce((sum, product) => {
            return sum + (product.soldProfit || 0);
        }, 0);
        
        // Calculate total target profit
        const totalTargetProfit = overallTargetProfit > 0 ? overallTargetProfit : 
            calculatedProducts.reduce((sum, p) => sum + (p.targetProfit || 0), 0);
        
        // Calculate shortfall/excess: Target Profit - Sold Profit
        // If shortfall is positive, we need to cover it from remaining products
        // If excess is negative, we have extra profit
        const profitShortfall = totalTargetProfit - totalSoldProfit;
        
        // The goal is: Total Profit = Target Profit exactly
        // Formula: Total Profit = Sold Profit + Remaining Profit = Target Profit
        // Therefore: Remaining Profit (total) = Target Profit - Sold Profit
        
        // Calculate total remaining profit needed
        const totalRemainingProfitNeeded = totalTargetProfit - totalSoldProfit;
        
        // Calculate total target profit for remaining products (for distribution ratio)
        const totalRemainingTargetProfit = calculatedProducts.reduce((sum, product) => {
            if ((product.remainingWeight || 0) > 0) {
                return sum + (product.targetProfit || 0);
            }
            return sum;
        }, 0);
        
        // Distribute the total remaining profit needed among remaining products
        // based on their target profit ratio
        return calculatedProducts.map((product) => {
            const remainingWeight = product.remainingWeight || 0;
            
            // If no remaining stock, profit = sold profit only
            if (remainingWeight <= 0) {
                return {
                    ...product,
                    remainingProfit: 0,
                    profit: product.soldProfit || 0
                };
            }
            
            // Calculate this product's share of the total remaining profit needed
            const productTargetProfit = product.targetProfit || 0;
            let remainingProfitShare = 0;
            
            if (totalRemainingTargetProfit > 0 && productTargetProfit > 0) {
                // Distribute based on target profit ratio
                remainingProfitShare = (totalRemainingProfitNeeded * productTargetProfit) / totalRemainingTargetProfit;
            } else if (overallTargetProfit > 0 && productTargetProfit === 0) {
                // If using overall target profit and individual target is 0, distribute by initial weight ratio
                const totalInitialWeight = calculatedProducts.reduce((sum, p) => {
                    if ((p.remainingWeight || 0) > 0) {
                        return sum + p.weight;
                    }
                    return sum;
                }, 0);
                
                if (totalInitialWeight > 0) {
                    const initialWeightRatio = product.weight / totalInitialWeight;
                    remainingProfitShare = totalRemainingProfitNeeded * initialWeightRatio;
                }
            }
            
            // Ensure remaining profit is not negative
            const adjustedRemainingProfit = Math.max(0, remainingProfitShare);
            
            // Total Profit = Sold Profit + Remaining Profit
            // This should equal exactly: Target Profit (for this product's share)
            const finalTotalProfit = (product.soldProfit || 0) + adjustedRemainingProfit;
            
            // Recalculate suggested price based on adjusted remaining profit
            // Formula: Next Selling Price = (Remaining Investment + Remaining Profit) / Remaining QTY
            // Where Remaining Investment = (Cost + Expense) per QTL × Remaining QTL + Loss from sold
            // Use the values already calculated in the first pass
            const remainingCost = product.remainingCost || 0;
            const remainingExpense = product.remainingExpense || 0;
            
            // Calculate sold loss: if sold at lower price than cost+expense
            // soldProfit is already calculated, so soldLoss = -soldProfit (if negative)
            const soldLoss = Math.max(0, -(product.soldProfit || 0));
            
            const remainingInvestment = remainingCost + remainingExpense + soldLoss;
            const adjustedSuggestedPrice = remainingWeight > 0
                ? (remainingInvestment + adjustedRemainingProfit) / remainingWeight
                : product.nextSellingPointWithProfit || 0;
            
            const adjustedRemainingRevenue = adjustedSuggestedPrice * remainingWeight;
            
            return {
                ...product,
                nextSellingPointWithProfit: adjustedSuggestedPrice,
                remainingRevenue: adjustedRemainingRevenue,
                remainingProfit: adjustedRemainingProfit,
                profit: finalTotalProfit
            };
        });
        
        return calculatedProducts;
    }, [products, quantity, totalCost, expense, totalPercentage, costAllocationMethod, overallTargetProfit]);

    // Total revenue and profit
    const totalRevenue = useMemo(() => {
        // Revenue from sold items + projected revenue from remaining items at suggested prices
        return productCalculations.reduce((sum, p) => {
            const soldRevenue = (p.sellingPrice || 0) * (p.soldWeight || 0);
            const remainingRevenue = (p.nextSellingPointWithProfit || 0) * (p.remainingWeight || 0);
            return sum + soldRevenue + remainingRevenue;
        }, 0);
    }, [productCalculations]);

    const totalProfit = useMemo(() => {
        // Total profit = Sold profit + Remaining profit (at suggested prices)
        return productCalculations.reduce((sum, p) => {
            return sum + (p.profit || 0);
        }, 0);
    }, [productCalculations]);

    const overallProfitMargin = useMemo(() => {
        return totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
    }, [totalProfit, totalCost]);

    // Calculate total profit from remaining stock at suggested prices
    const remainingStockProfit = useMemo(() => {
        return productCalculations.reduce((sum, product) => {
            const remainingProfit = product.remainingProfit || 0;
            return sum + remainingProfit;
        }, 0);
    }, [productCalculations]);

    // Calculate total profit from sold items
    const soldItemsProfit = useMemo(() => {
        return productCalculations.reduce((sum, product) => {
            const soldProfit = product.soldProfit || 0;
            return sum + soldProfit;
        }, 0);
    }, [productCalculations]);

    // Total profit if remaining stock sold at suggested prices
    const totalProjectedProfit = useMemo(() => {
        return soldItemsProfit + remainingStockProfit;
    }, [soldItemsProfit, remainingStockProfit]);

    // Check if target profit will be achieved
    const targetProfitStatus = useMemo(() => {
        const target = overallTargetProfit > 0 ? overallTargetProfit : 
            productCalculations.reduce((sum, p) => sum + (p.targetProfit || 0), 0);
        
        if (target === 0) return null;
        
        return {
            target,
            projected: remainingStockProfit,
            achieved: remainingStockProfit >= target,
            difference: remainingStockProfit - target
        };
    }, [remainingStockProfit, overallTargetProfit, productCalculations]);


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
                console.error('Error loading manufacturing costing:', error);
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
            console.error('Error saving manufacturing costing:', error);
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
                            {/* Products Table */}
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
                                        {productCalculations.map((product, index) => (
                                            <TableRow key={product.id}>
                                                <TableCell className="p-3">
                                                    <Input
                                                        value={product.name}
                                                        onChange={(e) => updateProduct(product.id, 'name', e.target.value)}
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
                                                        onChange={(e) => updateProduct(product.id, 'percentage', parseFloat(e.target.value) || 0)}
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
                                                        onChange={(e) => updateProduct(product.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
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
                                                        onChange={(e) => updateProduct(product.id, 'soldPercentage', parseFloat(e.target.value) || 0)}
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
                                                        onClick={() => handleRemoveProduct(product.id)}
                                                        disabled={products.length === 1 || isLoading}
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

                            {/* Summary Cards */}
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
                                <Card className="bg-primary/5 border-primary/20">
                                    <CardContent className="pt-4">
                                        <div className="text-sm font-medium text-muted-foreground mb-1">
                                            Total Output
                                        </div>
                                        <div className="text-xl font-bold text-primary">
                                            {productCalculations.reduce((sum, p) => sum + p.weight, 0).toFixed(2)} QTL
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                </>
                )}
            </CardContent>
        </Card>
    );
}


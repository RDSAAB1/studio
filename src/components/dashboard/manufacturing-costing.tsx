"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calculator, DollarSign, Package, TrendingUp, Plus, Percent, Loader2, Settings } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { getManufacturingCosting, saveManufacturingCosting, getOptionsRealtime } from '@/lib/firestore';
import { useManufacturingCalculations, type Product, type CalculatedProduct } from './manufacturing-costing/hooks/use-manufacturing-calculations';
import { ManufacturingProductTable } from './manufacturing-costing/components/manufacturing-product-table';
import { ManufacturingSummaryCards } from './manufacturing-costing/components/manufacturing-summary-cards';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/database';

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
    const [extraCostPerQtl, setExtraCostPerQtl] = useState<number>(0); // Extra cost per quintal
    const [selectedVariety, setSelectedVariety] = useState<string>("");
    const [rawVarieties, setRawVarieties] = useState<any[]>([]);

    // Subscribe to varieties list from options
    useEffect(() => {
        const unsub = getOptionsRealtime(
            "varieties",
            (options) => {
                setRawVarieties(options || []);
            },
            (err) => console.error(err)
        );
        return () => unsub();
    }, []);

    // Load suppliers (purchases) from local DB
    const allSuppliers = useLiveQuery(() => db?.suppliers.toArray()) || [];

    // Load customer sales from local DB
    const allCustomerSales = useLiveQuery(() => db?.customers.toArray()) || [];

    // Calculate varieties and their average rates/quantities dynamically
    const varietiesList = useMemo(() => {
        const grouped = allSuppliers.reduce((acc: any, s: any) => {
            const varName = s.variety || "Unknown";
            if (!acc[varName]) {
                acc[varName] = { quantity: 0, amount: 0 };
            }
            acc[varName].quantity += Number(s.netWeight) || 0;
            acc[varName].amount += Number(s.netAmount) || 0;
            return acc;
        }, {});
        
        return rawVarieties.map(opt => {
            const name = opt.name;
            const purchaseInfo = grouped[name] || { quantity: 0, amount: 0 };
            const qty = purchaseInfo.quantity;
            const amt = purchaseInfo.amount;
            const avgRate = qty > 0 ? Math.round((amt / qty) * 100) / 100 : 0;
            return {
                variety: name,
                quantity: Math.round(qty * 100) / 100,
                averageRate: avgRate
            };
        }).sort((a, b) => a.variety.localeCompare(b.variety));
    }, [allSuppliers, rawVarieties]);
    
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


    const updateProduct = (id: string, field: keyof CalculatedProduct, value: string | number) => {
        setProducts(products.map(p => {
            if (p.id !== id) return p;
            switch (field) {
                case 'name': {
                    const selectedName = String(value);
                    if (selectedName && selectedName !== 'manual') {
                        // Find matching customer sales (excluding deleted entries)
                        const matchingSales = allCustomerSales.filter(c => c.variety === selectedName && !c.isDeleted);
                        const getCustomerTotalReceivable = (c: any) => {
                             const baseAmt = Number(c.amount || 0);
                             const kartaAmt = Number(c.kartaAmount || 0);
                             const bagDedAmt = Number(c.bagWeightDeductionAmount || 0);
                             const finalAmt = baseAmt - kartaAmt - bagDedAmt;
                             const cdAmt = baseAmt * ((Number(c.cdRate || c.cd || 0)) / 100);
                             const brkAmt = (Number(c.weight || 0)) * (Number(c.brokerageRate || c.brokerage || 0));
                             const bagAmt = Number(c.bagAmount || 0);
                             const transAmt = Number(c.transportAmount || 0);
                             const kantaAmt = Number(c.kanta || 0);
                             const totalRec = finalAmt - cdAmt - brkAmt + bagAmt + transAmt + kantaAmt + Number(c.advanceFreight || 0);
                             return totalRec;
                         };

                         const totalSoldQuantity = matchingSales.reduce((sum, c) => sum + (Number(c.netWeight) || 0), 0);
                         const totalSoldAmount = matchingSales.reduce((sum, c) => sum + getCustomerTotalReceivable(c), 0);
                         const averageSellingPrice = totalSoldQuantity > 0 ? Math.round((totalSoldAmount / totalSoldQuantity) * 100) / 100 : 0;
                        
                        const productWeight = (quantity * p.percentage) / 100;
                        const soldPercentage = productWeight > 0 
                            ? Math.round(Math.min(100, (totalSoldQuantity / productWeight) * 100) * 100) / 100 
                            : 0;
                        
                        return {
                            ...p,
                            name: selectedName,
                            sellingPrice: averageSellingPrice,
                            soldPercentage: soldPercentage
                        };
                    }
                    return { ...p, name: selectedName };
                }
                case 'percentage': {
                    const newPct = Number(value);
                    const productWeight = (quantity * newPct) / 100;
                    let soldPercentage = p.soldPercentage || 0;
                    if (p.name && p.name !== 'manual') {
                        const matchingSales = allCustomerSales.filter(c => c.variety === p.name && !c.isDeleted);
                        const totalSoldQuantity = matchingSales.reduce((sum, c) => sum + (Number(c.netWeight) || 0), 0);
                        soldPercentage = productWeight > 0 
                            ? Math.round(Math.min(100, (totalSoldQuantity / productWeight) * 100) * 100) / 100 
                            : 0;
                    }
                    return { 
                        ...p, 
                        percentage: newPct,
                        soldPercentage
                    };
                }
                case 'sellingPrice':
                    return { ...p, sellingPrice: Number(value) };
                case 'soldPercentage':
                    return { ...p, soldPercentage: Number(value) };
                case 'targetProfit':
                    return { ...p, targetProfit: Number(value) };
                default:
                    return p;
            }
        }));
    };

    // Load data from DB once on mount
    useEffect(() => {
        let isMounted = true;
        setIsLoading(true);
        
        async function loadData() {
            try {
                const data = await getManufacturingCosting();
                if (isMounted && data) {
                    setBuyingRate(data.buyingRate || 0);
                    setExpense(data.expense || 0);
                    const loadedQuantity = data.quantity || 0;
                    const loadedExtraCost = data.extraCost || 0;
                    setQuantity(loadedQuantity);
                    setExtraCost(loadedExtraCost);
                    setExtraCostPerQtl(loadedQuantity > 0 ? parseFloat((loadedExtraCost / loadedQuantity).toFixed(4)) : 0);
                    setSelectedVariety(data.selectedVariety || "");
                    if (data.products && data.products.length > 0) {
                        setProducts(data.products.map(p => ({
                            ...p,
                            targetProfit: p.targetProfit || 0
                        })));
                    }
                    setCostAllocationMethod('value');
                    if (data.overallTargetProfit !== undefined) {
                        setOverallTargetProfit(data.overallTargetProfit || 0);
                    }
                }
            } catch (error) {
                console.error("Failed to load manufacturing costing data:", error);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        loadData();
        return () => {
            isMounted = false;
        };
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
                selectedVariety,
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
    }, [buyingRate, expense, quantity, extraCost, products, costAllocationMethod, overallTargetProfit, selectedVariety]);



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
    }, [buyingRate, expense, quantity, extraCost, products, costAllocationMethod, overallTargetProfit, isLoading, saveToFirestore, selectedVariety]);

    // Sync buyingRate and quantity when selectedVariety changes
    useEffect(() => {
        if (selectedVariety && selectedVariety !== "manual" && varietiesList.length > 0) {
            const found = varietiesList.find(v => v.variety === selectedVariety);
            if (found) {
                setBuyingRate(found.averageRate);
                setQuantity(found.quantity);
                setExtraCost(parseFloat((extraCostPerQtl * found.quantity).toFixed(2)));
            }
        }
    }, [selectedVariety, varietiesList, extraCostPerQtl]);

    // Update handlers
    const handleBuyingRateChange = (value: number) => {
        setBuyingRate(value);
    };

    const handleExpenseChange = (value: number) => {
        setExpense(value);
    };

    const handleQuantityChange = (value: number) => {
        setQuantity(value);
        setExtraCost(parseFloat((extraCostPerQtl * value).toFixed(2)));
    };

    const handleExtraCostChange = (value: number) => {
        setExtraCost(value);
        setExtraCostPerQtl(quantity > 0 ? parseFloat((value / quantity).toFixed(4)) : 0);
    };

    const handleExtraCostPerQtlChange = (value: number) => {
        setExtraCostPerQtl(value);
        setExtraCost(parseFloat((value * quantity).toFixed(2)));
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
        <Card className="w-full shadow-sm border border-slate-250 bg-white">
            <CardHeader className="p-3 pb-1 border-b bg-slate-50/40">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-1.5 text-sm sm:text-base font-semibold text-slate-800">
                            <Calculator className="h-4 w-4 text-slate-600" />
                            Manufacturing Costing
                        </CardTitle>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3 p-3 pt-3">
                {isLoading && (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading data...</span>
                    </div>
                )}
                {!isLoading && (
                <>
                {/* Compact Raw Material Inputs & Settings */}
                <Card className="bg-slate-50/80 shadow-none border border-slate-200 p-3">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                        <div className="space-y-1 md:col-span-6">
                            <Label htmlFor="varietySelect" className="text-xs">
                                Variety Selection (Purchases)
                            </Label>
                            <Select
                                value={selectedVariety}
                                onValueChange={(val) => setSelectedVariety(val)}
                                disabled={isLoading}
                            >
                                <SelectTrigger id="varietySelect" className="h-8 text-xs bg-white border-slate-200 shadow-sm focus:ring-primary/20">
                                    <SelectValue placeholder="Select variety" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="manual">-- Fill Manually --</SelectItem>
                                    {varietiesList.map((v) => (
                                        <SelectItem key={v.variety} value={v.variety} className="text-xs">
                                            {v.variety} ({v.quantity.toFixed(2)} QTL @ ₹{v.averageRate.toFixed(2)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-3">
                        <div className="space-y-1">
                            <Label htmlFor="buyingRate" className="text-xs">Buying Rate (₹/QTL)</Label>
                            <Input
                                id="buyingRate"
                                type="number"
                                step="0.01"
                                min="0"
                                value={buyingRate || ''}
                                onChange={(e) => {
                                    setSelectedVariety("manual");
                                    handleBuyingRateChange(parseFloat(e.target.value) || 0);
                                }}
                                disabled={isLoading}
                                className="h-8 text-xs bg-white border-slate-200 shadow-sm focus-visible:ring-primary/20 focus-visible:border-primary"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="quantity" className="text-xs">Quantity (QTL)</Label>
                            <Input
                                id="quantity"
                                type="number"
                                step="0.01"
                                min="0"
                                value={quantity || ''}
                                onChange={(e) => {
                                    setSelectedVariety("manual");
                                    handleQuantityChange(parseFloat(e.target.value) || 0);
                                }}
                                disabled={isLoading}
                                className="h-8 text-xs bg-white border-slate-200 shadow-sm focus-visible:ring-primary/20 focus-visible:border-primary"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="expense" className="text-xs">Total Expense (₹)</Label>
                            <Input
                                id="expense"
                                type="number"
                                step="0.01"
                                min="0"
                                value={expense || ''}
                                onChange={(e) => handleExpenseChange(parseFloat(e.target.value) || 0)}
                                disabled={isLoading}
                                className="h-8 text-xs bg-white border-slate-200 shadow-sm focus-visible:ring-primary/20 focus-visible:border-primary"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="extraCost" className="text-xs">Extra Cost (Waste) (₹)</Label>
                            <Input
                                id="extraCost"
                                type="number"
                                step="0.01"
                                min="0"
                                value={extraCost || ''}
                                onChange={(e) => handleExtraCostChange(parseFloat(e.target.value) || 0)}
                                disabled={isLoading}
                                className="h-8 text-xs bg-white border-slate-200 shadow-sm focus-visible:ring-primary/20 focus-visible:border-primary"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="extraCostPerQtl" className="text-xs">Extra Cost per QTL (₹)</Label>
                            <Input
                                id="extraCostPerQtl"
                                type="number"
                                step="0.01"
                                min="0"
                                value={extraCostPerQtl || ''}
                                onChange={(e) => handleExtraCostPerQtlChange(parseFloat(e.target.value) || 0)}
                                disabled={isLoading}
                                className="h-8 text-xs bg-white border-slate-200 shadow-sm focus-visible:ring-primary/20 focus-visible:border-primary"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="overallTargetProfit" className="text-xs">Target Profit (₹)</Label>
                            <Input
                                id="overallTargetProfit"
                                type="number"
                                step="0.01"
                                min="0"
                                value={overallTargetProfit || ''}
                                onChange={(e) => setOverallTargetProfit(parseFloat(e.target.value) || 0)}
                                disabled={isLoading}
                                className="h-8 text-xs font-semibold bg-white border-slate-200 shadow-sm focus-visible:ring-primary/20 focus-visible:border-primary text-slate-800"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t">
                        <Card className="bg-slate-50/50 border border-slate-200 shadow-none p-2 rounded-md">
                            <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Total Raw Material Cost</div>
                            <div className="text-xs font-bold text-slate-800 mt-0.5">{formatCurrency(totalCost)}</div>
                        </Card>
                        <Card className="bg-slate-50/50 border border-slate-200 shadow-none p-2 rounded-md">
                            <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Raw Material Cost per QTL</div>
                            <div className="text-xs font-bold text-slate-800 mt-0.5">{formatCurrency(quantity > 0 ? totalCost / quantity : 0)}</div>
                        </Card>
                    </div>
                </Card>

                {/* Products Section */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between p-2.5 pb-1">
                        <CardTitle className="text-xs font-semibold">Products</CardTitle>
                        <Button onClick={handleAddProduct} size="sm" variant="outline" className="h-7 text-xs px-2" disabled={isLoading}>
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add Product
                        </Button>
                    </CardHeader>
                    <CardContent className="p-2.5 pt-0">
                        <div className="space-y-2">
                            <ManufacturingProductTable
                                products={productCalculations}
                                overallTargetProfit={overallTargetProfit}
                                isLoading={isLoading}
                                onUpdateProduct={updateProduct}
                                onRemoveProduct={handleRemoveProduct}
                                canRemove={products.length > 1}
                                varietyOptions={varietiesList.map(v => ({ value: v.variety, label: v.variety }))}
                            />

                            {/* Percentage Warning */}
                            {totalPercentage !== 100 && (
                                <div className={`p-1.5 rounded-md border text-xs font-semibold ${
                                    totalPercentage > 100 
                                        ? 'bg-red-50 text-red-700 border-red-200' 
                                        : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}>
                                    <div className="flex items-center gap-2">
                                        <Percent className="h-3.5 w-3.5" />
                                        Total Percentage: {totalPercentage.toFixed(2)}%
                                        {totalPercentage > 100 && (
                                            <span>(Exceeds 100%)</span>
                                        )}
                                        {totalPercentage < 100 && (
                                            <span>(Less than 100%)</span>
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

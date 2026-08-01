"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calculator, DollarSign, Package, TrendingUp, Plus, Percent, Loader2, Settings, BookmarkPlus, Bookmark, Trash2, Check, FolderInput, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { formatCurrency, calculateCustomerEntry } from '@/lib/utils';
import { getManufacturingCosting, saveManufacturingCosting, getOptionsRealtime, getManufacturingPresets, saveManufacturingPresets, type ManufacturingPreset } from '@/lib/firestore';
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

    // Product Presets State
    const [presets, setPresets] = useState<ManufacturingPreset[]>([]);
    const [selectedPresetId, setSelectedPresetId] = useState<string>('none');
    const [isSavePresetOpen, setIsSavePresetOpen] = useState<boolean>(false);
    const [newPresetName, setNewPresetName] = useState<string>('');
    const [isUpdatedFeedback, setIsUpdatedFeedback] = useState<boolean>(false);

    // Load presets on mount
    useEffect(() => {
        const loadedPresets = getManufacturingPresets();
        setPresets(loadedPresets);
    }, []);

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
                             const calculated = calculateCustomerEntry(c as any, []);
                             return Number(c.netAmount || c.originalNetAmount || calculated.originalNetAmount || calculated.netAmount || 0);
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

    // Load preset products into current table
    const handleLoadPreset = (presetId: string) => {
        if (!presetId || presetId === 'none') return;
        const preset = presets.find(p => p.id === presetId);
        if (!preset || !preset.items || preset.items.length === 0) return;

        const newProducts: Product[] = preset.items.map((item, idx) => {
            const selectedName = item.name;
            let sellingPrice = item.sellingPrice || 0;
            let soldPercentage = 0;

            if (selectedName && selectedName !== 'manual') {
                const matchingSales = allCustomerSales.filter(c => c.variety === selectedName && !c.isDeleted);
                const totalSoldQuantity = matchingSales.reduce((sum, c) => sum + (Number(c.netWeight) || 0), 0);
                const getCustomerTotalReceivable = (c: any) => {
                    const calculated = calculateCustomerEntry(c as any, []);
                    return Number(c.netAmount || c.originalNetAmount || calculated.originalNetAmount || calculated.netAmount || 0);
                };

                const totalSoldAmount = matchingSales.reduce((sum, c) => sum + getCustomerTotalReceivable(c), 0);
                const averageSellingPrice = totalSoldQuantity > 0 ? Math.round((totalSoldAmount / totalSoldQuantity) * 100) / 100 : 0;
                
                if (averageSellingPrice > 0 && !sellingPrice) {
                    sellingPrice = averageSellingPrice;
                }

                const productWeight = (quantity * item.percentage) / 100;
                soldPercentage = productWeight > 0 
                    ? Math.round(Math.min(100, (totalSoldQuantity / productWeight) * 100) * 100) / 100 
                    : 0;
            }

            return {
                id: `${Date.now()}_${idx}`,
                name: item.name,
                percentage: Number(item.percentage) || 0,
                sellingPrice,
                soldPercentage,
                targetProfit: 0
            };
        });

        // Restore raw material cost & expense parameters saved with preset
        if (preset.selectedVariety !== undefined) {
            setSelectedVariety(preset.selectedVariety);
        }
        if (preset.expense !== undefined) {
            setExpense(preset.expense);
        }
        if (preset.extraCostPerQtl !== undefined && preset.extraCostPerQtl > 0) {
            setExtraCostPerQtl(preset.extraCostPerQtl);
            setExtraCost(parseFloat((preset.extraCostPerQtl * quantity).toFixed(2)));
        } else if (preset.extraCost !== undefined) {
            setExtraCost(preset.extraCost);
            setExtraCostPerQtl(quantity > 0 ? parseFloat((preset.extraCost / quantity).toFixed(4)) : 0);
        }
        if (preset.overallTargetProfit !== undefined) {
            setOverallTargetProfit(preset.overallTargetProfit);
        }

        setProducts(newProducts);
    };

    // Update currently selected preset with current table & costing data
    const handleUpdateCurrentPreset = () => {
        let targetId = selectedPresetId;
        if (!targetId || targetId === 'none') {
            if (presets.length > 0) {
                targetId = presets[0].id;
                setSelectedPresetId(targetId);
            } else {
                setIsSavePresetOpen(true);
                return;
            }
        }
        const existing = presets.find(p => p.id === targetId);
        if (!existing) return;

        const updatedPreset: ManufacturingPreset = {
            ...existing,
            selectedVariety: selectedVariety || '',
            expense: Number(expense) || 0,
            extraCost: Number(extraCost) || 0,
            extraCostPerQtl: Number(extraCostPerQtl) || 0,
            overallTargetProfit: Number(overallTargetProfit) || 0,
            items: products.map(p => ({
                name: p.name || 'Product',
                percentage: Number(p.percentage) || 0,
                sellingPrice: Number(p.sellingPrice) || 0
            }))
        };

        const updated = presets.map(p => p.id === targetId ? updatedPreset : p);
        setPresets(updated);
        saveManufacturingPresets(updated);
        setIsUpdatedFeedback(true);
        setTimeout(() => setIsUpdatedFeedback(false), 2000);
    };

    // Save current products & costing parameters as a new group preset
    const handleSaveNewPreset = () => {
        if (!newPresetName.trim()) return;
        const name = newPresetName.trim();
        const newPreset: ManufacturingPreset = {
            id: `preset_${Date.now()}`,
            name,
            createdAt: new Date().toISOString(),
            selectedVariety: selectedVariety || '',
            expense: Number(expense) || 0,
            extraCost: Number(extraCost) || 0,
            extraCostPerQtl: Number(extraCostPerQtl) || 0,
            overallTargetProfit: Number(overallTargetProfit) || 0,
            items: products.map(p => ({
                name: p.name || 'Product',
                percentage: Number(p.percentage) || 0,
                sellingPrice: Number(p.sellingPrice) || 0
            }))
        };
        const updated = [newPreset, ...presets.filter(p => p.name.toLowerCase() !== name.toLowerCase())];
        setPresets(updated);
        saveManufacturingPresets(updated);
        setSelectedPresetId(newPreset.id);
        setIsSavePresetOpen(false);
        setNewPresetName('');
    };

    // Delete a preset
    const handleDeletePreset = (presetId: string) => {
        const updated = presets.filter(p => p.id !== presetId);
        setPresets(updated);
        saveManufacturingPresets(updated);
        if (selectedPresetId === presetId) {
            setSelectedPresetId('none');
        }
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
                    <CardHeader className="p-2 border-b bg-slate-50/80">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            {/* Left Group: Title & Preset Dropdown */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5 min-w-[70px]">
                                    <Package className="h-3.5 w-3.5 text-slate-600" />
                                    Products
                                </CardTitle>
                                
                                <div className="flex items-center gap-1">
                                    <Select
                                        value={selectedPresetId}
                                        onValueChange={(val) => {
                                            setSelectedPresetId(val);
                                            handleLoadPreset(val);
                                        }}
                                        disabled={isLoading}
                                    >
                                        <SelectTrigger className="h-7 text-xs w-[180px] sm:w-[210px] bg-white border-slate-200 shadow-sm focus:ring-primary/20">
                                            <SelectValue placeholder="📁 Load Group..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none" className="text-xs text-muted-foreground">
                                                -- Select Product Group --
                                            </SelectItem>
                                            {presets.map((preset) => (
                                                <SelectItem key={preset.id} value={preset.id} className="text-xs font-medium">
                                                    📦 {preset.name} ({preset.items.length} items)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    {selectedPresetId && selectedPresetId !== 'none' && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md"
                                            onClick={() => handleDeletePreset(selectedPresetId)}
                                            title="Delete selected group"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Right Group: Action Buttons */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <Button
                                    onClick={handleUpdateCurrentPreset}
                                    size="sm"
                                    variant="outline"
                                    className={`h-7 text-xs px-2.5 shadow-sm transition-all rounded-md font-medium ${
                                        isUpdatedFeedback
                                            ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 font-semibold'
                                            : 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100'
                                    }`}
                                    disabled={isLoading || products.length === 0}
                                    title={selectedPresetId && selectedPresetId !== 'none' ? `Update "${presets.find(p => p.id === selectedPresetId)?.name}" group` : 'Update Group'}
                                >
                                    {isUpdatedFeedback ? (
                                        <>
                                            <Check className="h-3.5 w-3.5 mr-1" />
                                            Updated!
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="h-3.5 w-3.5 mr-1 text-blue-600" />
                                            Update Group
                                        </>
                                    )}
                                </Button>

                                <Button
                                    onClick={() => {
                                        setNewPresetName(selectedVariety && selectedVariety !== 'manual' ? `${selectedVariety} Group` : '');
                                        setIsSavePresetOpen(true);
                                    }}
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs px-2.5 text-slate-700 border-slate-300 hover:bg-slate-100 shadow-sm rounded-md"
                                    disabled={isLoading || products.length === 0}
                                >
                                    <BookmarkPlus className="h-3.5 w-3.5 mr-1 text-slate-600" />
                                    {selectedPresetId && selectedPresetId !== 'none' ? 'Save As New' : 'Save Group'}
                                </Button>

                                <Button
                                    onClick={handleAddProduct}
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs px-2.5 text-slate-700 border-slate-300 hover:bg-slate-100 shadow-sm rounded-md"
                                    disabled={isLoading}
                                >
                                    <Plus className="h-3.5 w-3.5 mr-1 text-slate-600" />
                                    Add Product
                                </Button>
                            </div>
                        </div>
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

                {/* Save Group Preset Dialog */}
                <Dialog open={isSavePresetOpen} onOpenChange={setIsSavePresetOpen}>
                    <DialogContent className="sm:max-w-[420px] p-4 bg-white">
                        <DialogHeader className="pb-2 border-b">
                            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                                <BookmarkPlus className="h-4 w-4 text-blue-600" />
                                Save Product Group Preset
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                Save this collection of products & percentages to reuse in other estimations.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3 py-2">
                            <div className="space-y-1">
                                <Label htmlFor="presetNameInput" className="text-xs">
                                    Group / Preset Name
                                </Label>
                                <Input
                                    id="presetNameInput"
                                    placeholder="e.g. Rice Milling Standard, Corn Processing Group..."
                                    value={newPresetName}
                                    onChange={(e) => setNewPresetName(e.target.value)}
                                    className="h-8 text-xs bg-white border-slate-200"
                                    autoFocus
                                />
                            </div>

                            {/* Cost & Expense Parameters Preview */}
                            <div className="grid grid-cols-4 gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-md text-[11px]">
                                <div>
                                    <span className="text-slate-500 block text-[10px]">Variety:</span>
                                    <span className="font-semibold text-slate-800 truncate block" title={selectedVariety || 'Manual'}>{selectedVariety && selectedVariety !== 'manual' ? selectedVariety : 'Manual'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[10px]">Expense:</span>
                                    <span className="font-semibold text-slate-800">₹{expense || 0}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[10px]">Extra Cost/QTL:</span>
                                    <span className="font-semibold text-slate-800">₹{extraCostPerQtl || 0}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[10px]">Target Profit:</span>
                                    <span className="font-semibold text-slate-800">₹{overallTargetProfit || 0}</span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-[11px] text-slate-500 font-medium">
                                    Products in this group ({products.length}):
                                </Label>
                                <div className="max-h-[140px] overflow-y-auto border rounded-md p-2 bg-slate-50 space-y-1 text-xs">
                                    {products.map((p, idx) => (
                                        <div key={idx} className="flex justify-between items-center py-0.5 border-b border-slate-200/60 last:border-0">
                                            <span className="font-medium text-slate-700">{p.name || `Product ${idx + 1}`}</span>
                                            <span className="font-semibold text-primary">{p.percentage}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="pt-2 border-t flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setIsSavePresetOpen(false)} className="h-8 text-xs">
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSaveNewPreset}
                                disabled={!newPresetName.trim()}
                                className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                <Check className="h-3.5 w-3.5 mr-1" />
                                Save Group
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                </>
                )}
            </CardContent>
        </Card>
    );
}

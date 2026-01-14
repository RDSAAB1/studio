import { useMemo } from 'react';

export interface Product {
  id: string;
  name: string;
  percentage: number;
  sellingPrice?: number;
  soldPercentage?: number;
  targetProfit?: number;
}

interface UseManufacturingCalculationsProps {
  products: Product[];
  quantity: number;
  totalCost: number;
  expense: number;
  totalPercentage: number;
  costAllocationMethod: 'percentage' | 'value';
  overallTargetProfit: number;
}

export interface CalculatedProduct extends Product {
  weight: number;
  allocatedCost: number;
  allocatedExpense: number;
  costPerQtl: number;
  profit: number;
  profitMargin: number;
  sellingPoint: number;
  soldPercentage: number;
  soldWeight: number;
  remainingWeight: number;
  soldCost: number;
  soldExpense: number;
  remainingCost: number;
  remainingExpense: number;
  nextCostPerQtl: number;
  nextSellingPoint: number;
  nextSellingPointWithProfit: number;
  targetProfit: number;
  productValue: number;
  soldRevenue: number;
  soldProfit: number;
  soldProfitMargin: number;
  remainingRevenue: number;
  remainingProfit: number;
}

export function useManufacturingCalculations({
  products,
  quantity,
  totalCost,
  expense,
  totalPercentage,
  costAllocationMethod,
  overallTargetProfit,
}: UseManufacturingCalculationsProps) {
  // Calculate product breakdowns
  const productCalculations = useMemo(() => {
    if (quantity <= 0 || totalPercentage <= 0) {
      return products.map(p => ({
        ...p,
        weight: 0,
        allocatedCost: 0,
        allocatedExpense: 0,
        costPerQtl: 0,
        profit: 0,
        profitMargin: 0,
        sellingPoint: 0,
        soldPercentage: p.soldPercentage || 0,
        soldWeight: 0,
        remainingWeight: 0,
        soldCost: 0,
        soldExpense: 0,
        remainingCost: 0,
        remainingExpense: 0,
        nextCostPerQtl: 0,
        nextSellingPoint: 0,
        nextSellingPointWithProfit: 0,
        targetProfit: 0,
        productValue: 0,
        soldRevenue: 0,
        soldProfit: 0,
        soldProfitMargin: 0,
        remainingRevenue: 0,
        remainingProfit: 0,
      })) as CalculatedProduct[];
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
      const sellingPrice = product.sellingPrice || 0;
      
      // Sold tracking calculations
      const soldPercentage = product.soldPercentage || 0;
      const soldWeight = (weight * soldPercentage) / 100;
      const remainingWeight = weight - soldWeight;
      const soldCost = (allocatedCost * soldPercentage) / 100;
      const soldExpense = (allocatedExpense * soldPercentage) / 100;
      const remainingCost = allocatedCost - soldCost;
      const remainingExpense = allocatedExpense - soldExpense;
      const nextCostPerQtl = remainingWeight > 0 ? remainingCost / remainingWeight : 0;
      
      // Calculate total investment per QTL (Cost + Expense)
      const totalInvestmentPerQtl = weight > 0 ? (allocatedCost + allocatedExpense) / weight : 0;
      
      // Calculate profit from SOLD items
      const soldRevenue = sellingPrice > 0 ? sellingPrice * soldWeight : 0;
      const soldInvestment = totalInvestmentPerQtl * soldWeight;
      const soldProfit = soldRevenue - soldInvestment;
      const soldProfitMargin = soldCost > 0 && sellingPrice > 0 
        ? ((sellingPrice - (soldCost / soldWeight)) / (soldCost / soldWeight)) * 100 
        : 0;
      
      // Calculate product value for cost allocation
      const productValue = sellingPrice * weight;
      
      // Target profit calculation
      const targetProfit = product.targetProfit || 0;
      
      // Calculate overall target profit distribution
      let finalTargetProfit = targetProfit;
      if (overallTargetProfit > 0 && targetProfit === 0) {
        const totalInitialWeight = productsWithCost.reduce((sum, p) => {
          const pWeight = (quantity * p.percentage) / 100;
          return sum + pWeight;
        }, 0);
        
        if (totalInitialWeight > 0 && weight > 0) {
          const initialWeightRatio = weight / totalInitialWeight;
          finalTargetProfit = overallTargetProfit * initialWeightRatio;
        } else {
          finalTargetProfit = 0;
        }
      } else if (overallTargetProfit > 0 && targetProfit > 0) {
        finalTargetProfit = targetProfit;
      }
      
      // Calculate next selling price for REMAINING stock
      const soldLoss = Math.max(0, soldInvestment - soldRevenue);
      const remainingInvestment = (totalInvestmentPerQtl * remainingWeight) + soldLoss;
      const totalRequiredForRemaining = remainingInvestment + finalTargetProfit;
      const nextSellingPoint = remainingWeight > 0 ? totalRequiredForRemaining / remainingWeight : 0;
      let nextSellingPointWithProfit = nextSellingPoint;
      
      // Calculate profit from remaining stock
      const remainingRevenue = nextSellingPointWithProfit * remainingWeight;
      const remainingProfit = remainingWeight > 0 ? finalTargetProfit : 0;
      const totalProductProfit = soldProfit + remainingProfit;
      
      // Overall profit margin
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
        profit: totalProductProfit,
        profitMargin: overallProfitMargin,
        sellingPoint: costPerQtl,
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
    
    // Calculate shortfall/excess
    const profitShortfall = totalTargetProfit - totalSoldProfit;
    const totalRemainingProfitNeeded = totalTargetProfit - totalSoldProfit;
    
    // Calculate total target profit for remaining products
    const totalRemainingTargetProfit = calculatedProducts.reduce((sum, product) => {
      if ((product.remainingWeight || 0) > 0) {
        return sum + (product.targetProfit || 0);
      }
      return sum;
    }, 0);
    
    // Distribute the total remaining profit needed among remaining products
    return calculatedProducts.map((product) => {
      const remainingWeight = product.remainingWeight || 0;
      
      if (remainingWeight <= 0) {
        return {
          ...product,
          remainingProfit: 0,
          profit: product.soldProfit || 0
        };
      }
      
      const productTargetProfit = product.targetProfit || 0;
      let remainingProfitShare = 0;
      
      if (totalRemainingTargetProfit > 0 && productTargetProfit > 0) {
        remainingProfitShare = (totalRemainingProfitNeeded * productTargetProfit) / totalRemainingTargetProfit;
      } else if (overallTargetProfit > 0 && productTargetProfit === 0) {
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
      
      const adjustedRemainingProfit = Math.max(0, remainingProfitShare);
      const finalTotalProfit = (product.soldProfit || 0) + adjustedRemainingProfit;
      
      // Recalculate suggested price based on adjusted remaining profit
      const remainingCost = product.remainingCost || 0;
      const remainingExpense = product.remainingExpense || 0;
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
  }, [products, quantity, totalCost, expense, totalPercentage, costAllocationMethod, overallTargetProfit]);

  // Total revenue and profit
  const totalRevenue = useMemo(() => {
    return productCalculations.reduce((sum, p) => {
      const soldRevenue = (p.sellingPrice || 0) * (p.soldWeight || 0);
      const remainingRevenue = (p.nextSellingPointWithProfit || 0) * (p.remainingWeight || 0);
      return sum + soldRevenue + remainingRevenue;
    }, 0);
  }, [productCalculations]);

  const totalProfit = useMemo(() => {
    return productCalculations.reduce((sum, p) => {
      return sum + (p.profit || 0);
    }, 0);
  }, [productCalculations]);

  const overallProfitMargin = useMemo(() => {
    return totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
  }, [totalProfit, totalCost]);

  const remainingStockProfit = useMemo(() => {
    return productCalculations.reduce((sum, product) => {
      const remainingProfit = product.remainingProfit || 0;
      return sum + remainingProfit;
    }, 0);
  }, [productCalculations]);

  const soldItemsProfit = useMemo(() => {
    return productCalculations.reduce((sum, product) => {
      const soldProfit = product.soldProfit || 0;
      return sum + soldProfit;
    }, 0);
  }, [productCalculations]);

  const totalProjectedProfit = useMemo(() => {
    return soldItemsProfit + remainingStockProfit;
  }, [soldItemsProfit, remainingStockProfit]);

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

  return {
    productCalculations,
    totalRevenue,
    totalProfit,
    overallProfitMargin,
    remainingStockProfit,
    soldItemsProfit,
    totalProjectedProfit,
    targetProfitStatus,
  };
}




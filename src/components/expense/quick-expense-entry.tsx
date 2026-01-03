"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Zap, Trash2 } from "lucide-react";
import { getExpenseTemplatesRealtime, deleteExpenseTemplate, type ExpenseTemplate } from "@/lib/firestore";

interface QuickExpenseEntryProps {
  onTemplateSelect?: (template: any) => void;
  className?: string;
  isAdvanced?: boolean;
}

// Your actual expense templates organized by categories
const QUICK_TEMPLATES = [
  // FUEL CATEGORY - Seasonal
  { name: "Petrol", category: "Fuel", subCategory: "Petrol", amount: 1000, payee: "Petrol Pump", paymentMethod: "Cash", expenseNature: "Seasonal" as const },
  { name: "Diesel", category: "Fuel", subCategory: "Diesel", amount: 1500, payee: "Diesel Pump", paymentMethod: "Cash", expenseNature: "Seasonal" as const },
  { name: "Cylinder", category: "Fuel", subCategory: "Cylinder", amount: 800, payee: "Gas Agency", paymentMethod: "Cash", expenseNature: "Seasonal" as const },
  
  // ELECTRICITY CATEGORY - Seasonal
  { name: "Electricity", category: "Electricity", subCategory: "Electricity", amount: 2500, payee: "Electricity Board", paymentMethod: "Bank Transfer", expenseNature: "Seasonal" as const },
  
  // LABOUR CATEGORY - Seasonal
  { name: "Loading", category: "Laboury", subCategory: "Loading", amount: 500, payee: "Labour", paymentMethod: "Cash", expenseNature: "Seasonal" as const },
  { name: "Unloading", category: "Laboury", subCategory: "Unloading", amount: 400, payee: "Labour", paymentMethod: "Cash", expenseNature: "Seasonal" as const },
  { name: "Repairing", category: "Laboury", subCategory: "Repairing", amount: 800, payee: "Repair Service", paymentMethod: "Cash", expenseNature: "Seasonal" as const },
  { name: "Cleaning", category: "Laboury", subCategory: "Cleaning", amount: 300, payee: "Cleaning Staff", paymentMethod: "Cash", expenseNature: "Seasonal" as const },
  
  // SPARE PARTS CATEGORY - Seasonal
  { name: "Spare Parts", category: "Spare Parts", subCategory: "Spare Parts", amount: 2000, payee: "Spare Parts Shop", paymentMethod: "Cash", expenseNature: "Seasonal" as const },
  
  // STAFF CATEGORY - Seasonal
  { name: "Salary", category: "Staff", subCategory: "Salary", amount: 15000, payee: "Staff", paymentMethod: "Bank Transfer", expenseNature: "Seasonal" as const },
  { name: "Bonus", category: "Staff", subCategory: "Bonus", amount: 5000, payee: "Staff", paymentMethod: "Bank Transfer", expenseNature: "Seasonal" as const },
  
  // OTHER CATEGORY - Seasonal
  { name: "Stationary", category: "Other", subCategory: "Stationary", amount: 300, payee: "Stationery Shop", paymentMethod: "Cash", expenseNature: "Seasonal" as const },
  { name: "Food & Snacks", category: "Other", subCategory: "Food And Snacks", amount: 200, payee: "Restaurant", paymentMethod: "Cash", expenseNature: "Seasonal" as const },
  { name: "Recharge", category: "Other", subCategory: "Recharge", amount: 100, payee: "Mobile Recharge", paymentMethod: "Cash", expenseNature: "Seasonal" as const },
  { name: "Transport", category: "Other", subCategory: "Transport", amount: 600, payee: "Transport", paymentMethod: "Cash", expenseNature: "Seasonal" as const },
  { name: "Service", category: "Other", subCategory: "Service And Maintenance", amount: 1200, payee: "Service Provider", paymentMethod: "Cash", expenseNature: "Seasonal" as const },
  
  // MACHINERY CATEGORY - Permanent
  { name: "Plant", category: "Machinery", subCategory: "Plant", amount: 50000, payee: "Machinery Supplier", paymentMethod: "Bank Transfer", expenseNature: "Permanent" as const },
  { name: "Drayer", category: "Machinery", subCategory: "Drayer", amount: 30000, payee: "Machinery Supplier", paymentMethod: "Bank Transfer", expenseNature: "Permanent" as const },
  { name: "Transports", category: "Machinery", subCategory: "Transports", amount: 25000, payee: "Transport Dealer", paymentMethod: "Bank Transfer", expenseNature: "Permanent" as const },
  
  // SETUP CATEGORY - Permanent
  { name: "Assets Purchase", category: "Setup", subCategory: "Assets Purchasing", amount: 100000, payee: "Asset Supplier", paymentMethod: "Bank Transfer", expenseNature: "Permanent" as const },
  { name: "Installation", category: "Setup", subCategory: "Assets Installation", amount: 10000, payee: "Installation Service", paymentMethod: "Cash", expenseNature: "Permanent" as const },
  { name: "Construction", category: "Setup", subCategory: "Constructions Laboury", amount: 8000, payee: "Construction Labour", paymentMethod: "Cash", expenseNature: "Permanent" as const },
  { name: "Setup Transport", category: "Setup", subCategory: "Transports", amount: 18000, payee: "Transport Dealer", paymentMethod: "Bank Transfer", expenseNature: "Permanent" as const },
  
  // PLANT CATEGORY - Permanent
  { name: "Plant Labour", category: "Plant", subCategory: "Laboury", amount: 6000, payee: "Plant Labour", paymentMethod: "Cash", expenseNature: "Permanent" as const },
  { name: "Plant Spares", category: "Plant", subCategory: "Spare Parts", amount: 15000, payee: "Plant Spare Parts", paymentMethod: "Bank Transfer", expenseNature: "Permanent" as const },
  
  // PURCHASE CATEGORY - Permanent
  { name: "Bhoosi", category: "Purchase", subCategory: "Bhoosi", amount: 20000, payee: "Bhoosi Supplier", paymentMethod: "Bank Transfer", expenseNature: "Permanent" as const },
  
  // INTEREST & LOAN CATEGORY - Permanent
  { name: "Interest & Loan", category: "Interest & Loan Payments", subCategory: "Interest & Loan Payments", amount: 25000, payee: "Bank/Lender", paymentMethod: "Bank Transfer", expenseNature: "Permanent" as const }
];

export function QuickExpenseEntry({ 
  onTemplateSelect, 
  className,
  isAdvanced = false
}: QuickExpenseEntryProps) {
  const [customTemplates, setCustomTemplates] = useState<ExpenseTemplate[]>([]);
  const [templateFilter, setTemplateFilter] = useState<'all' | 'seasonal' | 'permanent'>('all');
  
  const { toast } = useToast();

  // Load custom templates from Firestore realtime
  useEffect(() => {
    const unsubscribe = getExpenseTemplatesRealtime(
      (templates) => {
        setCustomTemplates(templates);
      },
      (error) => {

      }
    );

    return () => unsubscribe();
  }, []);

  // Handle template selection
  const handleTemplateSelect = (template: any) => {
    if (onTemplateSelect) {
      onTemplateSelect(template);
    }
  };

  // Delete custom template
  const handleDeleteTemplate = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      await deleteExpenseTemplate(templateId);
      toast({
        title: "Template Deleted",
        description: "Template removed successfully",
      });
    } catch (error) {

      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive"
      });
    }
  };

  // Combine default and custom templates
  const allTemplates = [...QUICK_TEMPLATES, ...customTemplates];

  return (
    <Card className={`${className} ${isAdvanced ? 'h-auto' : 'h-[calc(100vh-150px)]'} flex flex-col`}>
      <CardContent className="p-3 flex flex-col h-full">
        {/* Compact Header with Filter */}
        <div className="flex flex-col gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-semibold">Templates</span>
          </div>
          <div className="flex gap-1">
            <Button
              type="button"
              variant={templateFilter === 'all' ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={() => setTemplateFilter('all')}
            >
              All
            </Button>
            <Button
              type="button"
              variant={templateFilter === 'seasonal' ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={() => setTemplateFilter('seasonal')}
            >
              Seasonal
            </Button>
            <Button
              type="button"
              variant={templateFilter === 'permanent' ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={() => setTemplateFilter('permanent')}
            >
              Permanent
            </Button>
          </div>
        </div>
        
        {/* Template Grid - 4 per row */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-4 gap-2">
            {allTemplates
              .filter(t => templateFilter === 'all' || t.expenseNature.toLowerCase() === templateFilter)
              .map((template, index) => {
                const isCustomTemplate = 'id' in template && template.id;
                return (
                  <div key={`template-${index}`} className="relative group">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-16 text-xs w-full p-2 hover:bg-primary/10 hover:border-primary transition-all"
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <div className="flex flex-col items-center justify-center gap-0.5 w-full h-full">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${template.expenseNature === 'Seasonal' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                        <span className="text-[11px] font-semibold truncate w-full text-center leading-tight">{template.name}</span>
                        <span className="text-[9px] text-muted-foreground truncate w-full text-center">{template.category}</span>
                      </div>
                    </Button>
                    {isCustomTemplate && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteTemplate(template.id!, e)}
                        className="absolute -top-0.5 -right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        title="Delete"
                      >
                        <Trash2 className="h-2 w-2" />
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


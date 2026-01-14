import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import type { Customer, CustomerPayment } from "@/lib/definitions";
import { formatSrNo, toTitleCase, formatDateLocal, calculateCustomerEntry } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { bulkUpsertCustomers, addCustomer, updateCustomer } from "@/lib/firestore";

interface UseCustomerImportExportProps {
  customers: Customer[];
  paymentHistory: CustomerPayment[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
}

export function useCustomerImportExport({ 
  customers, 
  paymentHistory, 
  setCustomers 
}: UseCustomerImportExportProps) {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [importCurrent, setImportCurrent] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importStartTime, setImportStartTime] = useState<number | null>(null);

  const safeCustomers = customers || [];

  const handleExport = useCallback(() => {
    if (!safeCustomers || safeCustomers.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }

    const dataToExport = safeCustomers.map(c => {
      const calculated = calculateCustomerEntry(c, paymentHistory);
      return {
        'SR NO.': c.srNo,
        'DATE': c.date,
        'BAGS': c.bags || 0,
        'NAME': c.name,
        'COMPANY NAME': c.companyName || '',
        'ADDRESS': c.address,
        'CONTACT': c.contact,
        'GSTIN': c.gstin || '',
        'STATE NAME': c.stateName || '',
        'STATE CODE': c.stateCode || '',
        'VEHICLE NO': c.vehicleNo,
        'VARIETY': c.variety,
        'GROSS WT': c.grossWeight,
        'TIER WT': c.teirWeight,
        'NET WT': calculated.netWeight,
        'RATE': c.rate,
        'CD RATE': c.cdRate || 0,
        'CD AMOUNT': calculated.cd || 0,
        'BROKERAGE RATE': c.brokerageRate || 0,
        'BROKERAGE AMOUNT': calculated.brokerage || 0,
        'BROKERAGE INCLUDED': c.isBrokerageIncluded ? 'Yes' : 'No',
        'BAG WEIGHT KG': c.bagWeightKg || 0,
        'BAG RATE': c.bagRate || 0,
        'BAG AMOUNT': calculated.bagAmount || 0,
        'KANTA': calculated.kanta || 0,
        'AMOUNT': calculated.amount || 0,
        'NET AMOUNT': calculated.originalNetAmount || 0,
        'PAYMENT TYPE': c.paymentType,
        'SHIPPING NAME': c.shippingName || '',
        'SHIPPING COMPANY NAME': c.shippingCompanyName || '',
        'SHIPPING ADDRESS': c.shippingAddress || '',
        'SHIPPING CONTACT': c.shippingContact || '',
        'SHIPPING GSTIN': c.shippingGstin || '',
        'SHIPPING STATE NAME': c.shippingStateName || '',
        'SHIPPING STATE CODE': c.shippingStateCode || '',
        'HSN CODE': c.hsnCode || '',
        'TAX RATE': c.taxRate || 0,
        'GST INCLUDED': c.isGstIncluded ? 'Yes' : 'No',
        '9R NO': c.nineRNo || '',
        'GATE PASS NO': c.gatePassNo || '',
        'GR NO': c.grNo || '',
        'GR DATE': c.grDate || '',
        'TRANSPORT': c.transport || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");
    XLSX.writeFile(workbook, "CustomerEntries.xlsx");
    toast({ title: "Exported", description: "Customer data has been exported." });
  }, [safeCustomers, paymentHistory, toast]);

  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast({ title: "No file selected", variant: "destructive" });
      return;
    }

    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast({ title: "Invalid file type", description: "Please select an Excel file (.xlsx or .xls)", variant: "destructive" });
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setImportStatus('Reading file...');
    setImportStartTime(Date.now());

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          setIsImporting(false);
          toast({ title: "File read error", description: "Could not read the file.", variant: "destructive" });
          return;
        }

        setImportStatus('Parsing Excel file...');
        setImportProgress(5);

        const workbook = XLSX.read(data, { type: 'binary', cellNF: true, cellText: false });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          setIsImporting(false);
          toast({ title: "Invalid file", description: "The Excel file does not contain any sheets.", variant: "destructive" });
          return;
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          setIsImporting(false);
          toast({ title: "Invalid file", description: "Could not read the worksheet.", variant: "destructive" });
          return;
        }

        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });
        
        if (!json || json.length === 0) {
          setIsImporting(false);
          setImportStartTime(null);
          toast({ title: "Empty file", description: "The Excel file does not contain any data.", variant: "destructive" });
          return;
        }
        
        const totalRows = json.length;
        setImportTotal(totalRows);
        setImportStatus(`Processing ${totalRows} entries...`);
        setImportProgress(10);
        
        let nextSrNum = safeCustomers.length > 0 
          ? Math.max(...safeCustomers.map(c => parseInt(c.srNo.substring(1)) || 0)) + 1 
          : 1;

        const importedCustomers: Customer[] = [];
        const customersToUpdate: { id: string; data: Customer }[] = [];
        const processedSrNos = new Set<string>();
        let successCount = 0;
        let updateCount = 0;
        let errorCount = 0;

        // Helper function to get value from multiple possible column names
        const getValue = (item: any, ...possibleKeys: string[]): any => {
          for (const key of possibleKeys) {
            if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
              return item[key];
            }
          }
          return undefined;
        };

        for (let index = 0; index < json.length; index++) {
          const item = json[index];
          
          // Calculate progress and time estimates
          const processed = index + 1;
          const remaining = totalRows - processed;
          const progress = 10 + Math.floor((index / totalRows) * 70);
          
          // Calculate estimated time remaining
          let timeRemaining = '';
          if (importStartTime && processed > 0) {
            const elapsed = (Date.now() - importStartTime) / 1000;
            const avgTimePerItem = elapsed / processed;
            const estimatedTotal = avgTimePerItem * totalRows;
            const remainingTime = estimatedTotal - elapsed;
            
            if (remainingTime > 0) {
              if (remainingTime < 60) {
                timeRemaining = `${Math.ceil(remainingTime)}s`;
              } else if (remainingTime < 3600) {
                const minutes = Math.floor(remainingTime / 60);
                const seconds = Math.ceil(remainingTime % 60);
                timeRemaining = `${minutes}m ${seconds}s`;
              } else {
                const hours = Math.floor(remainingTime / 3600);
                const minutes = Math.floor((remainingTime % 3600) / 60);
                timeRemaining = `${hours}h ${minutes}m`;
              }
            }
          }
          
          setImportProgress(progress);
          setImportCurrent(processed);
          setImportStatus(`Processing entry ${processed} of ${totalRows}... ${remaining} remaining${timeRemaining ? ` (~${timeRemaining})` : ''}`);

          // Skip empty rows
          const name = getValue(item, 'NAME', 'name', 'Name');
          const srNo = getValue(item, 'SR NO.', 'srNo', 'SR NO', 'sr_no', 'SR_NO');
          const contact = getValue(item, 'CONTACT', 'contact', 'Contact');
          
          if (!name && !srNo && !contact) {
            continue;
          }

          try {
            // Get date from multiple possible formats
            const dateValue = getValue(item, 'DATE', 'date', 'Date');
            let dateStr: string;
            if (dateValue instanceof Date) {
              dateStr = formatDateLocal(dateValue);
            } else if (typeof dateValue === 'string') {
              if (dateValue.includes('-')) {
                const parts = dateValue.split('-');
                if (parts.length === 3) {
                  const day = parseInt(parts[0]);
                  const month = parseInt(parts[1]) - 1;
                  const year = parseInt(parts[2]);
                  const parsedDate = new Date(year, month, day);
                  if (!isNaN(parsedDate.getTime())) {
                    dateStr = formatDateLocal(parsedDate);
                  } else {
                    const standardDate = new Date(dateValue);
                    dateStr = isNaN(standardDate.getTime()) 
                      ? formatDateLocal(new Date()) 
                      : formatDateLocal(standardDate);
                  }
                } else {
                  const standardDate = new Date(dateValue);
                  dateStr = isNaN(standardDate.getTime()) 
                    ? formatDateLocal(new Date()) 
                    : formatDateLocal(standardDate);
                }
              } else {
                const parsedDate = new Date(dateValue);
                dateStr = isNaN(parsedDate.getTime()) 
                  ? formatDateLocal(new Date()) 
                  : formatDateLocal(parsedDate);
              }
            } else {
              dateStr = formatDateLocal(new Date());
            }

            // Generate SR No if not provided
            const srNoValue = srNo || getValue(item, 'SR NO.', 'srNo', 'SR NO', 'sr_no', 'SR_NO') || formatSrNo(nextSrNum++, 'C');
            let finalSrNo = srNoValue;
            if (typeof srNoValue === 'number' || (typeof srNoValue === 'string' && /^\d+$/.test(srNoValue))) {
              finalSrNo = formatSrNo(parseInt(String(srNoValue)), 'C');
            }
            
            if (processedSrNos.has(finalSrNo)) {
              continue;
            }
            processedSrNos.add(finalSrNo);
            
            const existingCustomer = safeCustomers.find(c => c.srNo === finalSrNo || c.id === finalSrNo);
            
            // Convert kg to qtl (divide by 100)
            const grossWeightKg = parseFloat(getValue(item, 'GROSS WT', 'grossWeight', 'GROSS WEIGHT', 'gross_weight', 'GROSS_WEIGHT') || 0) || 0;
            const teirWeightKg = parseFloat(getValue(item, 'TIER WT', 'teirWeight', 'TIER WEIGHT', 'teir_weight', 'TIER_WEIGHT', 'TIER WT', 'tierWeight') || 0) || 0;
            
            const grossWeight = grossWeightKg / 100;
            const teirWeight = teirWeightKg / 100;
            const calculatedWeight = grossWeight - teirWeight;

            const customerData: Customer = {
              id: finalSrNo,
              srNo: finalSrNo,
              date: dateStr,
              term: '0',
              dueDate: dateStr,
              name: toTitleCase(getValue(item, 'NAME', 'name', 'Name') || ''),
              companyName: toTitleCase(getValue(item, 'COMPANY NAME', 'companyName', 'COMPANY NAME', 'company_name', 'COMPANY_NAME') || ''),
              address: toTitleCase(getValue(item, 'ADDRESS', 'address', 'Address') || ''),
              contact: String(getValue(item, 'CONTACT', 'contact', 'Contact') || ''),
              gstin: getValue(item, 'GSTIN', 'gstin', 'GSTIN', 'gst_in', 'GST_IN') || '',
              stateName: getValue(item, 'STATE NAME', 'stateName', 'STATE NAME', 'state_name', 'STATE_NAME') || '',
              stateCode: getValue(item, 'STATE CODE', 'stateCode', 'STATE CODE', 'state_code', 'STATE_CODE') || '',
              vehicleNo: toTitleCase(getValue(item, 'VEHICLE NO', 'vehicleNo', 'VEHICLE NO', 'vehicle_no', 'VEHICLE_NO') || ''),
              variety: String(getValue(item, 'VARIETY', 'variety', 'Variety') || '').toUpperCase(),
              grossWeight: grossWeight,
              teirWeight: teirWeight,
              weight: calculatedWeight,
              netWeight: (() => {
                const netWeightValue = parseFloat(getValue(item, 'NET WT', 'netWeight', 'NET WEIGHT', 'net_weight', 'NET_WEIGHT') || calculatedWeight) || calculatedWeight;
                return netWeightValue / 100;
              })(),
              rate: parseFloat(getValue(item, 'RATE', 'rate', 'Rate') || 0) || 0,
              cdRate: parseFloat(getValue(item, 'CD RATE', 'cdRate', 'CD RATE', 'cd_rate', 'CD_RATE') || 0) || 0,
              brokerageRate: parseFloat(getValue(item, 'BROKERAGE RATE', 'brokerageRate', 'BROKERAGE RATE', 'brokerage_rate', 'BROKERAGE_RATE') || 0) || 0,
              isBrokerageIncluded: getValue(item, 'BROKERAGE INCLUDED', 'isBrokerageIncluded', 'BROKERAGE INCLUDED') === 'Yes' || 
                                   getValue(item, 'BROKERAGE INCLUDED', 'isBrokerageIncluded', 'BROKERAGE INCLUDED') === 'yes' || 
                                   getValue(item, 'BROKERAGE INCLUDED', 'isBrokerageIncluded', 'BROKERAGE INCLUDED') === true,
              bagWeightKg: (() => {
                const bagWeightValue = parseFloat(getValue(item, 'BAG WEIGHT KG', 'bagWeightKg', 'BAG WEIGHT KG', 'bag_weight_kg', 'BAG_WEIGHT_KG') || 0) || 0;
                return bagWeightValue / 100;
              })(),
              bagRate: parseFloat(getValue(item, 'BAG RATE', 'bagRate', 'BAG RATE', 'bag_rate', 'BAG_RATE') || 0) || 0,
              bags: parseFloat(getValue(item, 'BAGS', 'bags', 'Bags') || 0) || 0,
              paymentType: getValue(item, 'PAYMENT TYPE', 'paymentType', 'PAYMENT TYPE', 'payment_type', 'PAYMENT_TYPE') || 'Full',
              customerId: `${toTitleCase(getValue(item, 'NAME', 'name', 'Name') || '').toLowerCase()}|${String(getValue(item, 'CONTACT', 'contact', 'Contact') || '').toLowerCase()}`,
              shippingName: toTitleCase(getValue(item, 'SHIPPING NAME', 'shippingName', 'SHIPPING NAME', 'shipping_name', 'SHIPPING_NAME') || ''),
              shippingCompanyName: toTitleCase(getValue(item, 'SHIPPING COMPANY NAME', 'shippingCompanyName', 'SHIPPING COMPANY NAME', 'shipping_company_name', 'SHIPPING_COMPANY_NAME') || ''),
              shippingAddress: toTitleCase(getValue(item, 'SHIPPING ADDRESS', 'shippingAddress', 'SHIPPING ADDRESS', 'shipping_address', 'SHIPPING_ADDRESS') || ''),
              shippingContact: getValue(item, 'SHIPPING CONTACT', 'shippingContact', 'SHIPPING CONTACT', 'shipping_contact', 'SHIPPING_CONTACT') || '',
              shippingGstin: getValue(item, 'SHIPPING GSTIN', 'shippingGstin', 'SHIPPING GSTIN', 'shipping_gstin', 'SHIPPING_GSTIN') || '',
              shippingStateName: getValue(item, 'SHIPPING STATE NAME', 'shippingStateName', 'SHIPPING STATE NAME', 'shipping_state_name', 'SHIPPING_STATE_NAME') || '',
              shippingStateCode: getValue(item, 'SHIPPING STATE CODE', 'shippingStateCode', 'SHIPPING STATE CODE', 'shipping_state_code', 'SHIPPING_STATE_CODE') || '',
              hsnCode: getValue(item, 'HSN CODE', 'hsnCode', 'HSN CODE', 'hsn_code', 'HSN_CODE') || '1006',
              taxRate: parseFloat(getValue(item, 'TAX RATE', 'taxRate', 'TAX RATE', 'tax_rate', 'TAX_RATE') || 5) || 5,
              isGstIncluded: getValue(item, 'GST INCLUDED', 'isGstIncluded', 'GST INCLUDED') === 'Yes' || 
                            getValue(item, 'GST INCLUDED', 'isGstIncluded', 'GST INCLUDED') === 'yes' || 
                            getValue(item, 'GST INCLUDED', 'isGstIncluded', 'GST INCLUDED') === true,
              nineRNo: getValue(item, '9R NO', 'nineRNo', '9R NO', 'nine_r_no', '9R_NO') || '',
              gatePassNo: getValue(item, 'GATE PASS NO', 'gatePassNo', 'GATE PASS NO', 'gate_pass_no', 'GATE_PASS_NO') || '',
              grNo: getValue(item, 'GR NO', 'grNo', 'GR NO', 'gr_no', 'GR_NO') || '',
              grDate: getValue(item, 'GR DATE', 'grDate', 'GR DATE', 'gr_date', 'GR_DATE') || '',
              transport: getValue(item, 'TRANSPORT', 'transport', 'Transport') || '',
              barcode: '',
              receiptType: 'Cash',
              so: '',
              kartaPercentage: 0,
              kartaWeight: 0,
              kartaAmount: 0,
              labouryRate: 0,
              labouryAmount: 0,
              amount: 0,
              netAmount: 0,
              originalNetAmount: 0,
              kanta: 0,
            };

            const calculated = calculateCustomerEntry(customerData, paymentHistory);
            const finalCustomerData = { ...customerData, ...calculated };

            if (existingCustomer) {
              customersToUpdate.push({ id: existingCustomer.id, data: finalCustomerData });
              updateCount++;
            } else {
              importedCustomers.push(finalCustomerData);
              successCount++;
            }
          } catch (error) {
            errorCount++;
          }
        }
        
        setImportStatus(`Saving ${importedCustomers.length} new entries to database...`);
        setImportProgress(80);

        // Batch insert new customers
        if (importedCustomers.length > 0) {
          try {
            await bulkUpsertCustomers(importedCustomers);
            setCustomers(prev => {
              const existingIds = new Set(prev.map(c => c.id));
              const newCustomers = importedCustomers.filter(c => !existingIds.has(c.id));
              return [...newCustomers, ...prev].sort((a, b) => b.srNo.localeCompare(a.srNo));
            });
          } catch (error) {
            // Fallback to individual inserts
            for (const customer of importedCustomers) {
              try {
                await addCustomer(customer);
                setCustomers(prev => {
                  if (prev.some(c => c.id === customer.id)) {
                    return prev;
                  }
                  return [customer, ...prev].sort((a, b) => b.srNo.localeCompare(a.srNo));
                });
              } catch (err) {
                errorCount++;
                successCount--;
              }
            }
          }
        }

        // Batch update existing customers
        if (customersToUpdate.length > 0) {
          setImportStatus(`Updating ${customersToUpdate.length} existing entries...`);
          setImportProgress(90);
          
          for (const { id, data } of customersToUpdate) {
            try {
              const { id: _, ...updateData } = data as any;
              const updateSuccess = await updateCustomer(id, updateData);
              
              if (updateSuccess) {
                const updatedCustomer = { ...data, id };
                setCustomers(prev => {
                  const existingIndex = prev.findIndex(c => c.id === id);
                  if (existingIndex > -1) {
                    const newCustomers = [...prev];
                    newCustomers[existingIndex] = updatedCustomer;
                    return newCustomers;
                  }
                  return [updatedCustomer, ...prev].sort((a, b) => b.srNo.localeCompare(a.srNo));
                });
                successCount++;
              } else {
                errorCount++;
                updateCount--;
              }
            } catch (error) {
              errorCount++;
              updateCount--;
            }
          }
        }
        
        setImportProgress(100);
        setImportCurrent(importTotal);
        
        const totalTime = importStartTime ? ((Date.now() - importStartTime) / 1000).toFixed(1) : '0';
        setImportStatus(`Import completed! Total time: ${totalTime}s`);

        let message = '';
        if (updateCount > 0 && importedCustomers.length > 0) {
          message = `${importedCustomers.length} entries imported, ${updateCount} entries updated.`;
        } else if (updateCount > 0) {
          message = `${updateCount} entries updated.`;
        } else if (importedCustomers.length > 0) {
          message = `${importedCustomers.length} entries imported.`;
        }
        
        setTimeout(() => {
          setIsImporting(false);
          setImportProgress(0);
          setImportStatus('');
          setImportCurrent(0);
          setImportTotal(0);
          setImportStartTime(null);
        }, 1500);
        
        if (errorCount > 0) {
          toast({ 
            title: "Import Completed with Errors", 
            description: `${message} ${errorCount} failed.`, 
            variant: "destructive" 
          });
        } else {
          toast({ 
            title: "Import Successful", 
            description: message || `${successCount} customer entries processed.` 
          });
        }
      } catch (error) {
        setIsImporting(false);
        setImportProgress(0);
        setImportStatus('');
        toast({ title: "Import Failed", description: "Please check the file format and content.", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
    
    if (event.target) {
      event.target.value = '';
    }
  }, [safeCustomers, paymentHistory, toast, setCustomers]);

  return {
    handleImport,
    handleExport,
    isImporting,
    importProgress,
    importStatus,
    importCurrent,
    importTotal,
    importStartTime,
  };
}


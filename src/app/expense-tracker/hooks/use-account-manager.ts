import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { UseFormSetValue } from "react-hook-form";
import { toTitleCase } from "@/lib/utils";
import type { Account } from "@/lib/definitions";
import {
  getAccountsRealtime,
  addAccount,
  updateAccount,
  updateAccountTransactionsCascade,
  deleteAccount,
  updateExpensePayee,
  updateIncomePayee,
  deleteExpensesForPayee,
  deleteIncomesForPayee,
} from "@/lib/firestore";
import { saveTagOpeningBalance } from "@/lib/firestore/settings";
import { db } from "@/lib/database";

export const GST_STATE_CODES: Record<string, string> = {
  "01": "JAMMU AND KASHMIR",
  "02": "HIMACHAL PRADESH",
  "03": "PUNJAB",
  "04": "CHANDIGARH",
  "05": "UTTARAKHAND",
  "06": "HARYANA",
  "07": "DELHI",
  "08": "RAJASTHAN",
  "09": "UTTAR PRADESH",
  "10": "BIHAR",
  "11": "SIKKIM",
  "12": "ARUNACHAL PRADESH",
  "13": "NAGALAND",
  "14": "MANIPUR",
  "15": "MIZORAM",
  "16": "TRIPURA",
  "17": "MEGHALAYA",
  "18": "ASSAM",
  "19": "WEST BENGAL",
  "20": "JHARKHAND",
  "21": "ODISHA",
  "22": "CHHATTISGARH",
  "23": "MADHYA PRADESH",
  "24": "GUJARAT",
  "26": "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
  "27": "MAHARASHTRA",
  "28": "ANDHRA PRADESH",
  "29": "KARNATAKA",
  "30": "GOA",
  "31": "LAKSHADWEEP",
  "32": "KERALA",
  "33": "TAMIL NADU",
  "34": "PUDUCHERRY",
  "35": "ANDAMAN AND NICOBAR ISLANDS",
  "36": "TELANGANA",
  "37": "ANDHRA PRADESH (NEW)",
  "38": "LADAKH"
};

export function validateAndExtractGST(gst: string) {
  const cleanGst = gst.toUpperCase().trim();
  if (cleanGst.length === 0) return { isValid: true }; // Optional if empty
  
  // Format: 2-digit State, 5 letters, 4 digits, 1 letter, 1 alphanumeric, 1 Z, 1 alphanumeric
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
  
  if (cleanGst.length !== 15) {
    return { isValid: false, error: "GST number must be exactly 15 characters long." };
  }
  if (!gstRegex.test(cleanGst)) {
    return { isValid: false, error: "Invalid GST format (Example: 03ABCDE1234F1Z1)." };
  }
  
  const stateCode = cleanGst.slice(0, 2);
  const pan = cleanGst.slice(2, 12);
  const stateName = GST_STATE_CODES[stateCode] || "UNKNOWN STATE";
  
  return {
    isValid: true,
    stateCode,
    pan,
    stateName
  };
}

export interface GSTDetails {
  gstin: string;
  businessName: string;
  pan: string;
  address: string;
  entityType: string;
  natureOfBusiness: string;
  pincode: string;
  departmentCode: string;
  registrationType: string;
  registrationDate: string;
  status: 'ACTIVE' | 'INACTIVE';
  stateCode?: string;
  stateName?: string;
}

const MOCK_GST_DB: Record<string, Partial<GSTDetails>> = {
  "09AABCU9355J1Z1": {
    gstin: "09AABCU9355J1Z1",
    businessName: "UTKARSH SMALL FINANCE BANK LIMITED",
    pan: "AABCU9355J",
    address: "UTTAR PRADESH",
    entityType: "Public Limited Company",
    natureOfBusiness: "Supplier of Services",
    pincode: "221105",
    departmentCode: "SARNATH",
    registrationType: "Regular",
    registrationDate: "01/07/2017",
    status: "ACTIVE"
  }
};

export function parseClearTaxGSTText(text: string): GSTDetails | null {
  if (!text) return null;
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const details: Record<string, string> = {};
  
  const keysMap: Record<string, string> = {
    "BUSINESS NAME": "businessName",
    "PAN": "pan",
    "ADDRESS": "address",
    "ENTITY TYPE": "entityType",
    "NATURE OF BUSINESS": "natureOfBusiness",
    "PINCODE": "pincode",
    "DEPARTMENT CODE": "departmentCode",
    "REGISTRATION TYPE": "registrationType",
    "REGISTRATION DATE": "registrationDate"
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineUpper = line.toUpperCase();
    
    let matchedKey: string | null = null;
    let propName: string | null = null;
    
    for (const [key, prop] of Object.entries(keysMap)) {
      // Use regex word boundaries to prevent false substring matches (e.g. 'comPANy' matching 'PAN')
      const regex = new RegExp(`\\b${key}\\b`);
      if (regex.test(lineUpper)) {
        matchedKey = key;
        propName = prop;
        break;
      }
    }
    
    if (matchedKey && propName) {
      const separatorIdx = line.indexOf(':');
      if (separatorIdx !== -1) {
        details[propName] = line.slice(separatorIdx + 1).trim();
      } else if (line.toUpperCase() === matchedKey && i + 1 < lines.length) {
        details[propName] = lines[i + 1].trim();
      } else {
        const keyIdx = lineUpper.indexOf(matchedKey);
        const remaining = line.slice(keyIdx + matchedKey.length).trim();
        if (remaining.length > 0) {
          details[propName] = remaining;
        } else if (i + 1 < lines.length) {
          details[propName] = lines[i + 1].trim();
        }
      }
    }
  }

  if (!details.businessName) return null;

  const gstMatch = text.match(/[0-9]{2}[a-zA-Z]{5}[0-9]{4}[a-zA-Z]{1}[a-zA-Z0-9]{1}[zZ][a-zA-Z0-9]{1}/);
  const gstin = gstMatch ? gstMatch[0].toUpperCase() : "";

  let extractedPan = "";
  let extractedStateCode = "";
  let extractedStateName = "";
  if (gstin) {
    extractedStateCode = gstin.slice(0, 2);
    extractedPan = gstin.slice(2, 12);
    extractedStateName = GST_STATE_CODES[extractedStateCode] || "";
  }

  let finalAddress = (details.address || "").trim();
  if (extractedStateName && !finalAddress.toUpperCase().includes(extractedStateName.toUpperCase())) {
    finalAddress = finalAddress ? `${finalAddress}, ${extractedStateName}` : extractedStateName;
  }

  return {
    gstin,
    businessName: details.businessName,
    pan: extractedPan || details.pan || "",
    address: finalAddress.toUpperCase(),
    entityType: details.entityType || "",
    natureOfBusiness: details.natureOfBusiness || "",
    pincode: details.pincode || "",
    departmentCode: details.departmentCode || "",
    registrationType: details.registrationType || "",
    registrationDate: details.registrationDate || "",
    status: "ACTIVE",
    stateCode: extractedStateCode,
    stateName: extractedStateName
  };
}

export function parseLegalDevMultiFirms(text: string): GSTDetails[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const gstRegex = /[0-9]{2}[a-zA-Z]{5}[0-9]{4}[a-zA-Z]{1}[a-zA-Z0-9]{1}[zZ][a-zA-Z0-9]{1}/;
  const gstinRegexGlobal = /[0-9]{2}[a-zA-Z]{5}[0-9]{4}[a-zA-Z]{1}[a-zA-Z0-9]{1}[zZ][a-zA-Z0-9]{1}/g;
  
  const results: GSTDetails[] = [];

  for (const line of lines) {
    const match = line.match(gstRegex);
    if (match) {
      const gstin = match[0].toUpperCase();
      const stateCode = gstin.slice(0, 2);
      const pan = gstin.slice(2, 12);
      const stateName = GST_STATE_CODES[stateCode] || "";

      // Check if it's tab-separated or separated by multiple spaces
      const columns = line.split(/\t|\s{2,}/).map(c => c.trim()).filter(Boolean);
      if (columns.length >= 5) {
        const gstIndex = columns.findIndex(col => gstRegex.test(col));
        
        let businessName = columns[0] || "";
        let tradeName = columns[1] || "";
        let entityType = columns[2] || "";
        let registrationType = columns[3] || "";
        let status = "Active";
        let registrationDate = "";
        let natureOfBusiness = "";
        let address = "";

        if (gstIndex !== -1) {
          businessName = columns[0] || "";
          tradeName = columns[1] || "";
          
          if (gstIndex > 2) entityType = columns[gstIndex - 2];
          if (gstIndex > 1) registrationType = columns[gstIndex - 1];
          
          status = columns[gstIndex + 1] || "Active";
          registrationDate = columns[gstIndex + 2] || "";
          natureOfBusiness = columns[gstIndex + 3] || "";
          address = columns[gstIndex + 4] || "";
        }

        // Prefer Trade Name (column[1]) over Legal Name (column[0]) for account naming.
        // Trade Name is the name the business operates under (e.g. "SAHARA MOBILE SHOP").
        // Legal Name is the owner/proprietor name (e.g. "SHARIQ HASAN KHAN").
        // Only use Legal Name if Trade Name is absent or identical to it.
        const rawTrade = tradeName.trim().toUpperCase();
        const rawLegal = businessName.trim().toUpperCase();
        let primaryName: string;
        if (rawTrade && rawTrade !== rawLegal) {
          primaryName = tradeName.trim();
        } else {
          primaryName = businessName.trim();
        }

        // Deduplicate if name is doubled (e.g. "UTKARSH ... UTKARSH ...")
        let cleanedName = (primaryName || "Unknown").trim();
        const mid = Math.floor(cleanedName.length / 2);
        const firstHalf = cleanedName.substring(0, mid).trim();
        const secondHalf = cleanedName.substring(mid).trim();
        if (firstHalf.toUpperCase() === secondHalf.toUpperCase() && firstHalf.length > 3) {
          cleanedName = firstHalf;
        }

        let finalAddress = (address || "").trim();
        if (stateName && !finalAddress.toUpperCase().includes(stateName.toUpperCase())) {
          finalAddress = finalAddress ? `${finalAddress}, ${stateName}` : stateName;
        }

        results.push({
          gstin,
          businessName: cleanedName.toUpperCase(),
          pan,
          address: finalAddress.toUpperCase(),
          entityType: entityType || "Public Limited Company",
          natureOfBusiness: natureOfBusiness || "Supplier of Goods/Services",
          registrationType: registrationType || "Regular",
          registrationDate: registrationDate || "N/A",
          status: status.toUpperCase(),
          stateCode,
          stateName
        });
      } else {
        // Fallback for single space-separated line containing GSTIN
        const gstIndexInLine = line.indexOf(match[0]);
        const partBeforeGst = line.substring(0, gstIndexInLine).trim();
        const partAfterGst = line.substring(gstIndexInLine + match[0].length).trim();

        // Parse partBeforeGst
        let left = partBeforeGst;
        let registrationType = "REGULAR";
        const regTypeMatch = left.match(/\s*(REGULAR|COMPOSITION|INPUT SERVICE DISTRIBUTOR|ISD)$/i);
        if (regTypeMatch) {
          registrationType = regTypeMatch[1].toUpperCase();
          left = left.substring(0, regTypeMatch.index).trim();
        }

        let entityType = "PROPRIETORSHIP";
        const entityMatch = left.match(/\s*(PUBLIC LIMITED COMPANY|PRIVATE LIMITED COMPANY|PARTNERSHIP|PROPRIETORSHIP|LIMITED LIABILITY PARTNERSHIP|LLP|SOCIETY|TRUST|CO-OPERATIVE SOCIETY|PUBLIC COMPANY|PRIVATE COMPANY|PVT LTD|LTD|PVT\. LTD\.|PVT\. LTD)$/i);
        if (entityMatch) {
          entityType = entityMatch[1].toUpperCase();
          left = left.substring(0, entityMatch.index).trim();
        }

        let businessName = left;
        // Deduplicate if name is duplicated
        const mid = Math.floor(left.length / 2);
        const firstHalf = left.substring(0, mid).trim();
        const secondHalf = left.substring(mid).trim();
        if (firstHalf.toUpperCase() === secondHalf.toUpperCase() && firstHalf.length > 3) {
          businessName = firstHalf;
        }

        // Parse partAfterGst
        let right = partAfterGst;
        let status = "ACTIVE";
        const statusMatch = right.match(/^(ACTIVE|INACTIVE)\s+/i);
        if (statusMatch) {
          status = statusMatch[1].toUpperCase();
          right = right.substring(statusMatch[0].length).trim();
        }

        let registrationDate = "N/A";
        const dateMatch = right.match(/^(\d{2}\/\d{2}\/\d{4})\s+/);
        if (dateMatch) {
          registrationDate = dateMatch[1];
          right = right.substring(dateMatch[0].length).trim();
        }

        let address = right;
        let natureOfBusiness = "Supplier of Goods/Services";
        
        // Match known nature of business patterns at the start of right string
        const natureMatch = right.match(/^(RECIPIENT OF GOODS OR SERVICES, SUPPLIER OF SERVICES|SUPPLIER OF SERVICES, RECIPIENT OF GOODS OR SERVICES|RECIPIENT OF GOODS OR SERVICES|SUPPLIER OF SERVICES|RETAIL BUSINESS|WHOLESALE BUSINESS|MANUFACTURING|SERVICE PROVIDER)/i);
        if (natureMatch) {
          natureOfBusiness = natureMatch[0].trim();
          address = right.substring(natureMatch[0].length).trim();
        } else {
          // Fallback keyword-based matching
          const addressStartMatch = right.match(/\b(PLOT|SHOP|WARD|NEAR|SECTOR|ROAD|GALI|STREET|BUILDING|FLOOR|HOUSE|ARAZE|ARAZI|\d+)\b/i);
          if (addressStartMatch) {
            const addrIndex = right.indexOf(addressStartMatch[0]);
            natureOfBusiness = right.substring(0, addrIndex).replace(/,\s*$/, "").trim();
            address = right.substring(addrIndex).trim();
          }
        }

        let finalAddress = (address || "").trim();
        if (stateName && !finalAddress.toUpperCase().includes(stateName.toUpperCase())) {
          finalAddress = finalAddress ? `${finalAddress}, ${stateName}` : stateName;
        }

        results.push({
          gstin,
          businessName: (businessName || "Unknown").toUpperCase(),
          pan,
          address: finalAddress.toUpperCase(),
          entityType: entityType.toUpperCase(),
          natureOfBusiness: natureOfBusiness.toUpperCase(),
          registrationType: registrationType.toUpperCase(),
          registrationDate,
          status: status.toUpperCase(),
          stateCode,
          stateName
        });
      }
    }
  }

  // If we couldn't find any structured table rows, try to parse as a single firm
  if (results.length === 0) {
    const singleMatch = text.match(gstinRegexGlobal);
    if (singleMatch) {
      const gstin = singleMatch[0].toUpperCase();
      const stateCode = gstin.slice(0, 2);
      const pan = gstin.slice(2, 12);
      const stateName = GST_STATE_CODES[stateCode] || "";

      // Fallback parser for single business name
      let businessName = "";
      let address = "";
      let entityType = "";
      const nameLabels = ["TRADE NAME", "LEGAL NAME", "BUSINESS NAME", "TAXPAYER NAME", "NAME"];
      const addressLabels = ["ADDRESS", "STATE", "PRINCIPAL PLACE OF BUSINESS"];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineUpper = line.toUpperCase();
        
        // Skip header lines
        if (lineUpper.includes("LEGAL NAME") && lineUpper.includes("GST NUMBER")) {
          continue;
        }

        for (const label of nameLabels) {
          if (lineUpper.includes(label)) {
            const idx = line.indexOf(':');
            if (idx !== -1) {
              businessName = line.slice(idx + 1).trim();
            } else if (i + 1 < lines.length && !gstRegex.test(lines[i + 1])) {
              businessName = lines[i + 1].trim();
            }
            break;
          }
        }
        for (const label of addressLabels) {
          if (lineUpper.includes(label)) {
            const idx = line.indexOf(':');
            if (idx !== -1) {
              address = line.slice(idx + 1).trim();
            } else if (i + 1 < lines.length && !gstRegex.test(lines[i + 1])) {
              address = lines[i + 1].trim();
            }
            break;
          }
        }
      }

      if (!businessName) {
        for (const line of lines) {
          if (line.length > 5 && !line.includes(':') && !gstRegex.test(line)) {
            businessName = line;
            break;
          }
        }
      }

      let finalAddress = (address || "").trim();
      if (stateName && !finalAddress.toUpperCase().includes(stateName.toUpperCase())) {
        finalAddress = finalAddress ? `${finalAddress}, ${stateName}` : stateName;
      }

      results.push({
        gstin,
        businessName: (businessName || "FIRM LINKED TO PAN").toUpperCase(),
        pan,
        address: finalAddress.toUpperCase(),
        entityType: entityType || "Proprietorship",
        natureOfBusiness: "Retail Business",
        registrationType: "Regular",
        registrationDate: "N/A",
        status: "ACTIVE",
        stateCode,
        stateName
      });
    }
  }

  // Deduplicate
  const uniqueResults: GSTDetails[] = [];
  const seenGstins = new Set<string>();
  for (const item of results) {
    if (!seenGstins.has(item.gstin)) {
      seenGstins.add(item.gstin);
      uniqueResults.push(item);
    }
  }

  return uniqueResults;
}

export function parseLegalDevPANText(text: string): GSTDetails | null {
  const list = parseLegalDevMultiFirms(text);
  return list[0] || null;
}

interface AccountFormData {
  name: string;
  contact: string;
  address: string;
  nature: "" | "Permanent" | "Seasonal" | "Income" | "Direct Expense" | "Indirect Expense" | "Assets" | "Liabilities" | "Capital / Equity";
  category: string;
  subCategory: string;
  extraFieldType: 'fatherName' | 'gst' | 'pan' | 'other';
  extraFieldValue: string;
}

interface UseAccountManagerProps {
  setValue?: UseFormSetValue<any>;
  setIsSubmitting?: (value: boolean) => void;
  onAccountSelect?: (accountName: string) => void;
  handleAutoFill?: (payeeName: string) => void;
}

export function useAccountManager({
  setValue,
  setIsSubmitting,
  onAccountSelect,
  handleAutoFill,
}: UseAccountManagerProps) {
  const { toast } = useToast();
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [newAccount, setNewAccount] = useState<AccountFormData>({
    name: "",
    contact: "",
    address: "",
    nature: "Indirect Expense",
    category: "PARTY LEDGER",
    subCategory: "PARTY LEDGER",
    extraFieldType: "fatherName",
    extraFieldValue: "",
  });
  const [editAccount, setEditAccount] = useState<AccountFormData>({
    name: "",
    contact: "",
    address: "",
    nature: "Indirect Expense",
    category: "PARTY LEDGER",
    subCategory: "PARTY LEDGER",
    extraFieldType: "fatherName",
    extraFieldValue: "",
  });
  const [accounts, setAccounts] = useState<Map<string, Account>>(new Map());
  const prevSelectedAccountRef = useRef<string | null>(null);
  const prevAccountsRef = useRef<Map<string, Account>>(new Map());
  const isUpdatingRef = useRef(false);

  const [isSearchingGST, setIsSearchingGST] = useState(false);
  const [isSearchingPAN, setIsSearchingPAN] = useState(false);
  const [searchedGSTDetails, setSearchedGSTDetails] = useState<GSTDetails | null>(null);
  const [searchedFirms, setSearchedFirms] = useState<GSTDetails[]>([]);
  const lastSearchedGST = useRef<string>("");
  const lastSearchedPAN = useRef<string>("");


  // Load accounts: first from IndexedDB (instant), then subscribe to Firestore realtime
  useEffect(() => {
    const applyAccountList = (accountList: Account[]) => {
      const mappedAccounts = new Map<string, Account>();
      accountList.forEach((account) => {
        if (account?.name) {
          const normalizedName = toTitleCase(account.name.trim());
          mappedAccounts.set(normalizedName, account);
        }
      });
      setAccounts(mappedAccounts);
    };

    // Show cached/new accounts immediately so Payee dropdown is never empty when data exists
    if (typeof window !== "undefined" && db?.accounts) {
      db.accounts.toArray()
        .then(applyAccountList)
        .catch(() => {});
    }

    const unsubscribe = getAccountsRealtime(
      applyAccountList,
      () => {
        // Error handled silently
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // When accounts are added/updated/deleted (Income & Expense), refresh list from IndexedDB so new accounts show without refresh
  useEffect(() => {
    if (typeof window === "undefined" || !db?.accounts) return;
    const onAccountsChanged = async () => {
      try {
        const accountList = await db.accounts.toArray();
        const mappedAccounts = new Map<string, Account>();
        accountList.forEach((account) => {
          if (account?.name) {
            const normalizedName = toTitleCase(account.name.trim());
            mappedAccounts.set(normalizedName, account);
          }
        });
        setAccounts(mappedAccounts);
      } catch {
        // ignore
      }
    };
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ collection?: string }>).detail;
      if (detail?.collection === "accounts") void onAccountsChanged();
    };
    window.addEventListener("indexeddb:collection:changed", handler);
    return () => window.removeEventListener("indexeddb:collection:changed", handler);
  }, []);

  // Sync selected account to form fields
  useEffect(() => {
    // Prevent infinite loops
    if (isUpdatingRef.current) return;
    
    // Check if selectedAccount actually changed
    const selectedAccountChanged = selectedAccount !== prevSelectedAccountRef.current;
    
    // Check if accounts Map actually changed (compare size and keys)
    const accountsChanged = accounts.size !== prevAccountsRef.current.size ||
      Array.from(accounts.keys()).some(key => !prevAccountsRef.current.has(key)) ||
      Array.from(prevAccountsRef.current.keys()).some(key => !accounts.has(key));
    
    // Only update if something actually changed
    if (!selectedAccountChanged && !accountsChanged) {
      return;
    }
    
    isUpdatingRef.current = true;
    
    if (selectedAccount) {
      const account = accounts.get(selectedAccount);
      if (account && selectedAccountChanged && setValue) {
        if (account.contact) setValue("description", account.contact, { shouldValidate: false });
        if (account.nature) setValue("expenseNature", account.nature, { shouldValidate: false });
        if (account.category) setValue("category", account.category, { shouldValidate: false });
        if (account.subCategory) setValue("subCategory", account.subCategory, { shouldValidate: false });
      }
      if (setValue) setValue("payee", selectedAccount, { shouldValidate: true });
      
      // Call callbacks only if selectedAccount actually changed
      if (selectedAccountChanged) {
        if (handleAutoFill) {
          handleAutoFill(selectedAccount);
        }
        if (onAccountSelect) {
          onAccountSelect(selectedAccount);
        }
      }
    } else if (selectedAccountChanged) {
      // Only clear if selectedAccount actually changed to null
      if (setValue) setValue("payee", "", { shouldValidate: true });
    }
    
    // Update refs
    prevSelectedAccountRef.current = selectedAccount;
    prevAccountsRef.current = new Map(accounts);
    
    // Reset flag after state updates
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 0);
  }, [selectedAccount, accounts, setValue]); // Removed onAccountSelect and handleAutoFill from dependencies

  const handleAddAccount = useCallback(() => {
    setNewAccount({
      name: "",
      contact: "",
      address: "",
      nature: "Indirect Expense",
      category: "PARTY LEDGER",
      subCategory: "PARTY LEDGER",
      extraFieldType: "fatherName",
      extraFieldValue: "",
    });
    setSearchedGSTDetails(null);
    setIsAddAccountOpen(true);
  }, []);


  const handleSaveNewAccount = useCallback(async (customData?: AccountFormData) => {
    const data = customData || newAccount;
    if (!data.name.trim()) {
      toast({ title: "Error", description: "Please enter an account name", variant: "destructive" });
      return;
    }
    if (data.contact && data.contact.trim().length > 0 && data.contact.replace(/\D/g, '').length !== 10) {
      toast({ title: "Error", description: "Please enter a valid 10-digit mobile number", variant: "destructive" });
      return;
    }
    let extractedPan: string | undefined = searchedGSTDetails?.pan;
    let extractedStateCode: string | undefined = searchedGSTDetails?.stateCode;
    let extractedStateName: string | undefined = searchedGSTDetails?.stateName;
    let gstValue = data.extraFieldType === 'gst' && data.extraFieldValue.trim() ? data.extraFieldValue.trim() : (searchedGSTDetails?.gstin || undefined);
    let panValue = data.extraFieldType === 'pan' && data.extraFieldValue.trim() ? data.extraFieldValue.trim() : (extractedPan || undefined);

    if (data.extraFieldType === 'gst' && data.extraFieldValue.trim().length > 0) {
      const gstResult = validateAndExtractGST(data.extraFieldValue);
      if (!gstResult.isValid) {
        toast({ title: "Error", description: gstResult.error, variant: "destructive" });
        return;
      }
      extractedPan = gstResult.pan;
      extractedStateCode = gstResult.stateCode;
      extractedStateName = gstResult.stateName;
      gstValue = data.extraFieldValue.trim();
      panValue = gstResult.pan;
    } else if (data.extraFieldType === 'pan' && data.extraFieldValue.trim().length > 0) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      const panVal = data.extraFieldValue.trim().toUpperCase();
      if (panVal.length !== 10 || !panRegex.test(panVal)) {
        toast({ title: "Error", description: "Invalid PAN format (Example: ABCDE1234F).", variant: "destructive" });
        return;
      }
      panValue = panVal;
    }
    try {
      if (setIsSubmitting) setIsSubmitting(true);
      const accountData: Omit<Account, 'id'> = {
        name: data.name.trim(),
        contact: (data.contact?.trim() || "").length > 0 ? data.contact.trim() : undefined,
        address: (data.address?.trim() || "").length > 0 ? data.address.trim() : undefined,
        nature: data.nature || undefined,
        category: (data.category?.trim() || "").length > 0 ? data.category.trim() : undefined,
        subCategory: (data.subCategory?.trim() || "").length > 0 ? data.subCategory.trim() : undefined,
        fatherName: data.extraFieldType === 'fatherName' && data.extraFieldValue.trim() ? data.extraFieldValue.trim() : undefined,
        gst: gstValue,
        other: data.extraFieldType === 'other' && data.extraFieldValue.trim() ? data.extraFieldValue.trim() : undefined,
        pan: panValue,
        stateCode: extractedStateCode,
        stateName: extractedStateName,
        entityType: searchedGSTDetails?.entityType,
        natureOfBusiness: searchedGSTDetails?.natureOfBusiness,
        registrationDate: searchedGSTDetails?.registrationDate,
        openingBalance: 0,
        openingBalanceType: "Dr",
      };
      await addAccount(accountData);

      const normalized = toTitleCase(data.name.trim());
      
      // Save tag opening balance as 0 since it is removed
      const isParty = (accountData.category || "").toUpperCase().trim() === 'PARTY LEDGER' || (accountData.subCategory || "").toUpperCase().trim() === 'PARTY LEDGER';
      const tagKey = isParty ? `PARTY:${normalized.toUpperCase()}` : normalized.toUpperCase();
      await saveTagOpeningBalance(tagKey, 0, "Dr");
      
      // Dispatch event to refresh views
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event('opening_balance_updated'));
      }

      setSelectedAccount(normalized);
      if (setValue) setValue("payee", normalized, { shouldValidate: true });
      if (onAccountSelect) onAccountSelect(normalized);
      setIsAddAccountOpen(false);
      setNewAccount({ name: "", contact: "", address: "", nature: "Indirect Expense", category: "PARTY LEDGER", subCategory: "PARTY LEDGER", extraFieldType: "fatherName", extraFieldValue: "" });
      toast({ title: "Success", description: `Account "${normalized}" added successfully.` });
    } catch (error) {
      console.error("Error adding account:", error);
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to add account", variant: "destructive" });
    } finally {
      if (setIsSubmitting) setIsSubmitting(false);
    }
  }, [newAccount, setValue, toast, setIsSubmitting]);

  const handleEditAccount = useCallback(async () => {
    if (!selectedAccount) return;
    const account = accounts.get(selectedAccount);
    
    let extraFieldType: 'fatherName' | 'gst' | 'pan' | 'other' = 'fatherName';
    let extraFieldValue = '';
    
    if (account) {
      if (account.gst) {
        extraFieldType = 'gst';
        extraFieldValue = account.gst;
      } else if (account.pan) {
        extraFieldType = 'pan';
        extraFieldValue = account.pan;
      } else if (account.other) {
        extraFieldType = 'other';
        extraFieldValue = account.other;
      } else if (account.fatherName) {
        extraFieldType = 'fatherName';
        extraFieldValue = account.fatherName;
      }
    }

    if (account) {
      setEditAccount({
        name: account.name || "",
        contact: account.contact || "",
        address: account.address || "",
        nature: (account.nature as any) || "",
        category: account.category || "",
        subCategory: account.subCategory || "",
        extraFieldType,
        extraFieldValue,
      });
    } else {
      setEditAccount({
        name: selectedAccount,
        contact: "",
        address: "",
        nature: "",
        category: "",
        subCategory: "",
        extraFieldType,
        extraFieldValue,
      });
    }
    setSearchedGSTDetails(null);
    setIsEditAccountOpen(true);
  }, [selectedAccount, accounts]);


  const handleSaveEditAccount = useCallback(async (customData?: AccountFormData) => {
    const data = customData || editAccount;
    if (!selectedAccount || !data.name.trim()) {
      toast({ title: "Error", description: "Please enter an account name", variant: "destructive" });
      return;
    }
    if (data.contact && data.contact.trim().length > 0 && data.contact.replace(/\D/g, '').length !== 10) {
      toast({ title: "Error", description: "Please enter a valid 10-digit mobile number", variant: "destructive" });
      return;
    }
    let extractedPan: string | null = searchedGSTDetails?.pan || null;
    let extractedStateCode: string | null = searchedGSTDetails?.stateCode || null;
    let extractedStateName: string | null = searchedGSTDetails?.stateName || null;
    let gstValue: string | null = data.extraFieldType === 'gst' && data.extraFieldValue.trim() ? data.extraFieldValue.trim() : (searchedGSTDetails?.gstin || null);
    let panValue: string | null = data.extraFieldType === 'pan' && data.extraFieldValue.trim() ? data.extraFieldValue.trim() : (extractedPan || null);

    if (data.extraFieldType === 'gst' && data.extraFieldValue.trim().length > 0) {
      const gstResult = validateAndExtractGST(data.extraFieldValue);
      if (!gstResult.isValid) {
        toast({ title: "Error", description: gstResult.error, variant: "destructive" });
        return;
      }
      extractedPan = gstResult.pan || null;
      extractedStateCode = gstResult.stateCode || null;
      extractedStateName = gstResult.stateName || null;
      gstValue = data.extraFieldValue.trim();
      panValue = gstResult.pan || null;
    } else if (data.extraFieldType === 'pan' && data.extraFieldValue.trim().length > 0) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      const panVal = data.extraFieldValue.trim().toUpperCase();
      if (panVal.length !== 10 || !panRegex.test(panVal)) {
        toast({ title: "Error", description: "Invalid PAN format (Example: ABCDE1234F).", variant: "destructive" });
        return;
      }
      panValue = panVal;
    }

    try {
      setIsSubmitting(true);
      
      const account = accounts.get(selectedAccount);
      if (!account?.id) throw new Error("Account ID not found");
 
      const accountData: Partial<Account> & { id: string } = {
        id: account.id,
        name: toTitleCase(data.name.trim()),
        contact: data.contact.trim() || undefined,
        address: data.address.trim() || undefined,
        nature: (data.nature as any) || undefined,
        category: data.category.trim() || undefined,
        subCategory: data.subCategory.trim() || undefined,
        fatherName: data.extraFieldType === 'fatherName' ? (data.extraFieldValue.trim() || null as any) : null as any,
        gst: gstValue as any,
        other: data.extraFieldType === 'other' ? (data.extraFieldValue.trim() || null as any) : null as any,
        pan: panValue as any,
        stateCode: extractedStateCode as any,
        stateName: extractedStateName as any,
        entityType: (searchedGSTDetails?.entityType || null) as any,
        natureOfBusiness: (searchedGSTDetails?.natureOfBusiness || null) as any,
        registrationDate: (searchedGSTDetails?.registrationDate || null) as any,
      };

      // Update account in accounts collection
      await updateAccount(accountData, oldName);

      // Perform cascading updates for all fields (Name, Category, Sub-category, Nature)
      const updatedCount = await updateAccountTransactionsCascade(oldName, {
        name: oldName !== newName ? newName : undefined,
        category: accountData.category,
        subCategory: accountData.subCategory,
        nature: accountData.nature
      });

      // Update tag opening balances: delete old key if renamed
      const isPartyOld = (account.category || "").toUpperCase().trim() === 'PARTY LEDGER' || (account.subCategory || "").toUpperCase().trim() === 'PARTY LEDGER';
      const oldKey = isPartyOld ? `PARTY:${oldName.toUpperCase()}` : oldName.toUpperCase();
      
      const isPartyNew = (accountData.category || "").toUpperCase().trim() === 'PARTY LEDGER' || (accountData.subCategory || "").toUpperCase().trim() === 'PARTY LEDGER';
      const newKey = isPartyNew ? `PARTY:${newName.toUpperCase()}` : newName.toUpperCase();

      if (oldName !== newName) {
        // Clear/reset the old key
        await saveTagOpeningBalance(oldKey, 0, 'Dr');
      }
      
      // Save/update the new/current key as 0
      await saveTagOpeningBalance(newKey, 0, "Dr");
      
      // Dispatch event to refresh views
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event('opening_balance_updated'));
      }

      if (oldName !== newName) {
        setSelectedAccount(newName);
        if (setValue) setValue("payee", newName, { shouldValidate: true });
      }

      setIsEditAccountOpen(false);
      toast({ 
          title: "Success", 
          description: `Account "${newName}" updated successfully. ${updatedCount} transaction(s) were changed to match the new details.` 
      });
    } catch (error) {
      console.error("Error updating account:", error);
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to update account", variant: "destructive" });
    } finally {
      if (setIsSubmitting) setIsSubmitting(false);
    }
  }, [selectedAccount, editAccount, setValue, toast, setIsSubmitting, accounts]);

  const handleDeleteAccount = useCallback(async () => {
    if (!selectedAccount) return;

    try {
      if (setIsSubmitting) setIsSubmitting(true);
      
      const accountObj = accounts.get(selectedAccount);
      if (accountObj) {
        await deleteAccount(accountObj.id, accountObj.name);
      } else {
        await deleteAccount(selectedAccount, selectedAccount);
      }

      // Delete all transactions for this payee
      await Promise.all([deleteExpensesForPayee(selectedAccount), deleteIncomesForPayee(selectedAccount)]);

      setSelectedAccount(null);
      if (setValue) setValue("payee", "", { shouldValidate: true });
      setIsDeleteAccountOpen(false);
      toast({
        title: "Success",
        description: `Account "${selectedAccount}" and all its transactions have been deleted`,
      });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete account", variant: "destructive" });
    } finally {
      if (setIsSubmitting) setIsSubmitting(false);
    }
  }, [selectedAccount, setValue, toast, setIsSubmitting]);

  const handleSearchGST = useCallback((gstNumber: string) => {
    if (!gstNumber || gstNumber.trim().length !== 15) {
      toast({ title: "Error", description: "Please enter a valid 15-digit GST number.", variant: "destructive" });
      return;
    }
    
    lastSearchedGST.current = gstNumber.toUpperCase().trim();
    
    // Dispatch event to the Chrome Extension content script to trigger search in background
    window.dispatchEvent(new CustomEvent('START_GST_SEARCH', {
      detail: { gstin: gstNumber.toUpperCase().trim() }
    }));

    setIsSearchingGST(true);
    toast({ title: "Search Started", description: "ClearTax search running in background. Please wait..." });
  }, [toast]);

  const handleSearchPAN = useCallback((panNumber: string) => {
    if (!panNumber || panNumber.trim().length !== 10) {
      toast({ title: "Error", description: "Please enter a valid 10-character PAN card number.", variant: "destructive" });
      return;
    }
    
    lastSearchedPAN.current = panNumber.toUpperCase().trim();
    
    // Dispatch event to the Chrome Extension content script to trigger search in background
    window.dispatchEvent(new CustomEvent('START_PAN_SEARCH', {
      detail: { pan: panNumber.toUpperCase().trim() }
    }));

    setIsSearchingPAN(true);
    toast({ title: "Search Started", description: "PAN to GST search running in background. Please wait..." });
  }, [toast]);

  const handlePasteGSTText = useCallback((text: string, isEdit: boolean) => {
    const details = parseClearTaxGSTText(text);
    if (!details) {
      toast({ title: "Verification Failed", description: "Could not parse GST details. Make sure you copy the entire block.", variant: "destructive" });
      return;
    }

    setSearchedGSTDetails(details);
    
    const searchGst = lastSearchedGST.current;
    
    if (isEdit) {
      setEditAccount(prev => ({
        ...prev,
        name: details.businessName.toUpperCase(),
        address: (details.address || "").toUpperCase(),
        extraFieldType: 'gst',
        extraFieldValue: details.gstin || searchGst || prev.extraFieldValue,
      }));
    } else {
      setNewAccount(prev => ({
        ...prev,
        name: details.businessName.toUpperCase(),
        address: (details.address || "").toUpperCase(),
        extraFieldType: 'gst',
        extraFieldValue: details.gstin || searchGst || prev.extraFieldValue,
      }));
    }
  }, [toast]);

  const handlePastePANText = useCallback((text: string, isEdit: boolean) => {
    const firms = parseLegalDevMultiFirms(text);
    if (!firms || firms.length === 0) {
      toast({ title: "Verification Failed", description: "Could not parse PAN/GST details. Make sure you copy the entire block.", variant: "destructive" });
      return;
    }

    setSearchedFirms(firms);
    const details = firms[0];
    setSearchedGSTDetails(details);
    
    const searchPan = lastSearchedPAN.current;
    
    if (isEdit) {
      setEditAccount(prev => ({
        ...prev,
        name: details.businessName.toUpperCase(),
        address: (details.address || "").toUpperCase(),
        extraFieldType: 'pan',
        extraFieldValue: searchPan || details.pan || prev.extraFieldValue,
      }));
    } else {
      setNewAccount(prev => ({
        ...prev,
        name: details.businessName.toUpperCase(),
        address: (details.address || "").toUpperCase(),
        extraFieldType: 'pan',
        extraFieldValue: searchPan || details.pan || prev.extraFieldValue,
      }));
    }
  }, [toast]);

  const handleSelectFirm = useCallback((firm: GSTDetails, isEdit: boolean) => {
    setSearchedGSTDetails(firm);
    const searchPan = lastSearchedPAN.current;
    if (isEdit) {
      setEditAccount(prev => ({
        ...prev,
        name: firm.businessName.toUpperCase(),
        address: (firm.address || "").toUpperCase(),
        extraFieldType: 'pan',
        extraFieldValue: searchPan || firm.pan || prev.extraFieldValue,
      }));
    } else {
      setNewAccount(prev => ({
        ...prev,
        name: firm.businessName.toUpperCase(),
        address: (firm.address || "").toUpperCase(),
        extraFieldType: 'pan',
        extraFieldValue: searchPan || firm.pan || prev.extraFieldValue,
      }));
    }
    toast({ title: "Firm Selected", description: `Active firm switched to: ${firm.businessName}` });
  }, [toast]);

  // Listen to background Chrome Extension search completion events
  useEffect(() => {
    const handleSearchResult = (event: Event) => {
      const customEvent = event as CustomEvent<{ text: string }>;
      const text = customEvent.detail.text;
      if (text) {
        setIsSearchingGST(false);
        handlePasteGSTText(text, isEditAccountOpen);
      }
    };

    const handlePANSearchResult = (event: Event) => {
      const customEvent = event as CustomEvent<{ text: string }>;
      const text = customEvent.detail.text;
      if (text) {
        setIsSearchingPAN(false);

        // Handle "no records found" case — don't attempt to parse, just show message
        const textUpper = text.toUpperCase();
        if (
          textUpper.includes("NO RECORDS FOUND") ||
          textUpper.includes("NO GSTIN FOUND") ||
          textUpper.includes("NO GST DETAILS FOUND") ||
          textUpper.includes("INVALID PAN") ||
          textUpper.includes("NO GST LINKED")
        ) {
          toast({
            title: "Data Not Found",
            description: "No GST number is linked to this PAN card.",
            variant: "destructive",
          });
          return;
        }

        handlePastePANText(text, isEditAccountOpen);
      }
    };

    window.addEventListener('GST_SEARCH_RESULT', handleSearchResult);
    window.addEventListener('PAN_SEARCH_RESULT', handlePANSearchResult);
    return () => {
      window.removeEventListener('GST_SEARCH_RESULT', handleSearchResult);
      window.removeEventListener('PAN_SEARCH_RESULT', handlePANSearchResult);
    };
  }, [isEditAccountOpen, handlePasteGSTText, handlePastePANText]);

  const handleCancelGSTSearch = useCallback(() => {
    setIsSearchingGST(false);
    setIsSearchingPAN(false);
    window.dispatchEvent(new CustomEvent('CANCEL_GST_SEARCH'));
    window.dispatchEvent(new CustomEvent('CANCEL_PAN_SEARCH'));
    toast({ title: "Search Stopped", description: "Background searching has been cancelled." });
  }, [toast]);

  return {
    handleCancelGSTSearch,
    selectedAccount,
    setSelectedAccount,
    isAddAccountOpen,
    setIsAddAccountOpen,
    isEditAccountOpen,
    setIsEditAccountOpen,
    isDeleteAccountOpen,
    setIsDeleteAccountOpen,
    newAccount,
    setNewAccount,
    editAccount,
    setEditAccount,
    accounts,
    handleAddAccount,
    handleSaveNewAccount,
    handleEditAccount,
    handleSaveEditAccount,
    handleDeleteAccount,
    isSearchingGST,
    isSearchingPAN,
    searchedGSTDetails,
    setSearchedGSTDetails,
    searchedFirms,
    setSearchedFirms,
    handleSearchGST,
    handleSearchPAN,
    handlePasteGSTText,
    handlePastePANText,
    handleSelectFirm,
  };

}

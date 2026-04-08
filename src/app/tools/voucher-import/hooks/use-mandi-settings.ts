import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/database";
import { getMandiHeaderSettings, saveMandiHeaderSettings } from "@/lib/firestore";
import type { MandiHeaderSettings } from "@/lib/definitions";

export const HEADER_STORAGE_KEY = "mandiReportHeaderSettings";

export const defaultHeaderSettings: MandiHeaderSettings = {
  firmName: "",
  firmAddress: "",
  mandiName: "",
  licenseNo: "",
  licenseNo2: "",
  mandiType: "NON AMPC",
  registerNo: "",
  commodity: "",
  financialYear: "",
};

export function useMandiSettings() {
  const { toast } = useToast();
  const [headerSettings, setHeaderSettings] = useState<MandiHeaderSettings>(defaultHeaderSettings);
  const [isHeaderSaving, setIsHeaderSaving] = useState(false);

  useEffect(() => {
     const loadSettings = async () => {
        // 1. Try IndexedDB
        if (db) {
           const stored = await db.settings.get(HEADER_STORAGE_KEY);
           if (stored) {
              const { id, ...settings } = stored as any;
              setHeaderSettings(settings);
              return;
           }
        }
        
        // 2. Try Firestore
        try {
           const remote = await getMandiHeaderSettings();
           if (remote) {
              setHeaderSettings(remote);
              return;
           }
        } catch {}

        // 3. Try LocalStorage
        if (typeof window !== "undefined") {
           const local = localStorage.getItem(HEADER_STORAGE_KEY);
           if (local) {
              setHeaderSettings(JSON.parse(local));
           }
        }
     };
     loadSettings();
  }, []);

  const handleHeaderInputChange = <K extends keyof MandiHeaderSettings>(
    key: K,
    value: string
  ) => {
    setHeaderSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const persistHeaderSettings = async (settings: MandiHeaderSettings) => {
    if (db) {
      await db.settings.put({ id: HEADER_STORAGE_KEY, ...settings } as any);
    }
    try {
      await saveMandiHeaderSettings(settings);
    } catch {}
    if (typeof window !== "undefined") {
      window.localStorage.setItem(HEADER_STORAGE_KEY, JSON.stringify(settings));
    }
  };

  const handleSaveHeaderSettings = async () => {
    try {
      setIsHeaderSaving(true);
      await persistHeaderSettings(headerSettings);
      toast({
        title: "Header saved",
        description: "Mandi header details have been updated.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Could not save mandi header details. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsHeaderSaving(false);
    }
  };

  return {
    headerSettings,
    setHeaderSettings,
    isHeaderSaving,
    handleHeaderInputChange,
    handleSaveHeaderSettings,
  };
}

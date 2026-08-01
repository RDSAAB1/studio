import { db } from "../database";
import { createLocalSubscription } from "./core";

export interface ManufacturingPresetItem {
  name: string;
  percentage: number;
  sellingPrice?: number;
}

export interface ManufacturingPreset {
  id: string;
  name: string;
  createdAt: string;
  selectedVariety?: string;
  expense?: number;
  extraCost?: number;
  extraCostPerQtl?: number;
  overallTargetProfit?: number;
  items: ManufacturingPresetItem[];
}

export const DEFAULT_MANUFACTURING_PRESETS: ManufacturingPreset[] = [
  {
    id: 'preset-rice-standard',
    name: 'Rice Milling Standard Group',
    createdAt: new Date().toISOString(),
    items: [
      { name: 'RICE BRAN', percentage: 7.5, sellingPrice: 3200 },
      { name: 'RICE COMMON', percentage: 35, sellingPrice: 3120 },
      { name: 'CATTLE FEED', percentage: 2, sellingPrice: 1800 },
      { name: 'BREAKED RICE', percentage: 15, sellingPrice: 2400 },
      { name: 'HUSK', percentage: 20, sellingPrice: 600 },
      { name: 'OTHERS / NA', percentage: 20.5, sellingPrice: 0 },
    ]
  }
];

export function getManufacturingPresets(): ManufacturingPreset[] {
  if (typeof window === 'undefined') return DEFAULT_MANUFACTURING_PRESETS;
  try {
    const raw = localStorage.getItem('bizsuite:manufacturing_presets');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Error reading manufacturing presets:", e);
  }
  return DEFAULT_MANUFACTURING_PRESETS;
}

export function saveManufacturingPresets(presets: ManufacturingPreset[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('bizsuite:manufacturing_presets', JSON.stringify(presets));
  } catch (e) {
    console.error("Error saving manufacturing presets:", e);
  }
}

export function getManufacturingCostingRealtime(
  callback: (data: any) => void,
  onError?: (error: any) => void
) {
  return createLocalSubscription<any>(
    "manufacturingCosting",
    (data) => {
      // Return the first document (usually only one exists)
      callback(data && data.length > 0 ? data[0] : null);
    }
  );
}

export async function getManufacturingCosting() {
  try {
    const data = await db.manufacturingCosting.toArray();
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error("Error getting manufacturing costing:", error);
    return null;
  }
}

export async function saveManufacturingCosting(data: any) {
  try {
    // We use a fixed ID 'default' for the singleton config
    const doc = {
      ...data,
      id: 'default',
      updatedAt: new Date().toISOString()
    };
    await db.manufacturingCosting.put(doc);
    return { success: true };
  } catch (error) {
    console.error("Error saving manufacturing costing:", error);
    throw error;
  }
}


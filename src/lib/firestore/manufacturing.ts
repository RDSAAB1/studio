import { db } from "../database";
import { createLocalSubscription } from "./core";

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

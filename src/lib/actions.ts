"use server";

import { suggestCustomerName } from "@/ai/flows/suggest-customer-name";

export async function getSuggestedNames(partialName: string, existingNames: string[]) {
  try {
    const result = await suggestCustomerName({ partialName, existingNames });
    return result.suggestions;
  } catch (error) {
    console.error("Error fetching name suggestions:", error);
    return [];
  }
}

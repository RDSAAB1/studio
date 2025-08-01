'use server';

/**
 * @fileOverview A flow that suggests customer names based on the input.
 *
 * - suggestCustomerName - A function that suggests customer names.
 * - SuggestCustomerNameInput - The input type for the suggestCustomerName function.
 * - SuggestCustomerNameOutput - The return type for the suggestCustomerName function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestCustomerNameInputSchema = z.object({
  partialName: z.string().describe('The partial name of the customer.'),
  existingNames: z.array(z.string()).describe('The existing customer names.'),
});
export type SuggestCustomerNameInput = z.infer<typeof SuggestCustomerNameInputSchema>;

const SuggestCustomerNameOutputSchema = z.object({
  suggestions: z.array(z.string()).describe('The suggested customer names.'),
});
export type SuggestCustomerNameOutput = z.infer<typeof SuggestCustomerNameOutputSchema>;

export async function suggestCustomerName(input: SuggestCustomerNameInput): Promise<SuggestCustomerNameOutput> {
  return suggestCustomerNameFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestCustomerNamePrompt',
  input: {schema: SuggestCustomerNameInputSchema},
  output: {schema: SuggestCustomerNameOutputSchema},
  prompt: `You are a helpful assistant that suggests customer names based on a partial name and a list of existing names.

  Suggest names similar to "{{{partialName}}}", but not exactly the same as any of these existing names: {{existingNames}}.
  Return a maximum of 5 suggestions.
  If the partial name is blank, return an empty array.
  Ensure that each suggestion is in Title Case.
  Ensure that the suggestions do not have numbers in them.
  Each suggestion should be a valid name (combination of given name and family name).
  Ensure that all existing names are different than the suggested names.
  If there are no suggestions that meet these requirements, return an empty list.
  {
    "suggestions": []
  }`,
});

const suggestCustomerNameFlow = ai.defineFlow(
  {
    name: 'suggestCustomerNameFlow',
    inputSchema: SuggestCustomerNameInputSchema,
    outputSchema: SuggestCustomerNameOutputSchema,
  },
  async input => {
    if (!input.partialName) {
      return {
        suggestions: [],
      };
    }
    const {output} = await prompt(input);
    return output!;
  }
);

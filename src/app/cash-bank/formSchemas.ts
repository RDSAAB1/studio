
"use client";

import { z } from "zod";

const transferSchema = z.object({
    amount: z.coerce.number().min(1, "Amount must be greater than zero."),
    description: z.string().optional(),
    source: z.enum(['BankAccount', 'CashInHand', 'CashAtHome']),
    destination: z.enum(['BankAccount', 'CashInHand', 'CashAtHome']),
});

export const cashBankFormSchemas = {
    transferSchema
};

export type TransferValues = z.infer<typeof transferSchema>;

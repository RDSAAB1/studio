"use client";

import { z } from "zod";

const withdrawalSchema = z.object({
    amount: z.coerce.number().min(1, "Amount must be greater than zero."),
    description: z.string().optional(),
});

const depositSchema = z.object({
    amount: z.coerce.number().min(1, "Amount must be greater than zero."),
    description: z.string().optional(),
});


export const cashBankFormSchemas = {
    withdrawalSchema,
    depositSchema
};

export type WithdrawalValues = z.infer<typeof withdrawalSchema>;
export type DepositValues = z.infer<typeof depositSchema>;

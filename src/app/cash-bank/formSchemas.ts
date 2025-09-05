"use client";

import { z } from "zod";

const capitalInflowSchema = z.object({
    source: z.enum(["OwnerCapital", "BankLoan", "ExternalLoan"], {
        required_error: "Please select a source of capital.",
    }),
    destination: z.enum(["BankAccount", "CashInHand"], {
        required_error: "Please select a destination.",
    }),
    amount: z.coerce.number().min(1, "Amount must be greater than zero."),
    description: z.string().optional(),
});

const withdrawalSchema = z.object({
    amount: z.coerce.number().min(1, "Amount must be greater than zero."),
    description: z.string().optional(),
});

const depositSchema = z.object({
    amount: z.coerce.number().min(1, "Amount must be greater than zero."),
    description: z.string().optional(),
});


export const cashBankFormSchemas = {
    capitalInflowSchema,
    withdrawalSchema,
    depositSchema
};

export type CapitalInflowValues = z.infer<typeof capitalInflowSchema>;
export type WithdrawalValues = z.infer<typeof withdrawalSchema>;
export type DepositValues = z.infer<typeof depositSchema>;

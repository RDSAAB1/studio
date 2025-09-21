
"use client";

import { z } from "zod";

const transferSchema = z.object({
    amount: z.coerce.number().min(1, "Amount must be greater than zero."),
    description: z.string().optional(),
    source: z.string().min(1, "Source is required."),
    destination: z.string().min(1, "Destination is required."),
});

export const cashBankFormSchemas = {
    transferSchema
};

export type TransferValues = z.infer<typeof transferSchema>;

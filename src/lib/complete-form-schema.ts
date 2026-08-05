import { z } from "zod";

export const completeSupplierFormSchema = z.object({
    srNo: z.string(),
    date: z.date(),
    term: z.preprocess((val) => {
        if (val === '' || val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
    }, z.number().min(0).optional()),
    name: z.string().min(1, "Name is required."),
    so: z.string().optional().or(z.literal('')),
    address: z.string().optional().or(z.literal('')),
    contact: z.string().optional().or(z.literal('')).or(z.null())
        .refine((val) => {
            if (!val || typeof val !== 'string' || val.trim().length === 0) return true;
            const clean = val.trim();
            return clean.length === 10 && /^\d+$/.test(clean);
        }, {
            message: "Contact number must be exactly 10 digits or empty."
        }),
    vehicleNo: z.string().optional().or(z.literal('')),
    variety: z.string().min(1, "Variety is required."),
    grossWeight: z.preprocess((val) => {
        if (val === '' || val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
    }, z.number().min(0).optional()),
    teirWeight: z.preprocess((val) => {
        if (val === '' || val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
    }, z.number().min(0).optional()),
    rate: z.preprocess((val) => {
        if (val === '' || val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
    }, z.number().min(0).optional()),
    kartaPercentage: z.preprocess((val) => {
        if (val === '' || val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
    }, z.number().min(0).optional()),
    labouryRate: z.preprocess((val) => {
        if (val === '' || val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
    }, z.number().min(0).optional()),
    brokerage: z.preprocess((val) => {
        if (val === '' || val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
    }, z.number().min(0).optional()),
    brokerageRate: z.preprocess((val) => {
        if (val === '' || val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
    }, z.number().min(0).optional()),
    brokerageAddSubtract: z.boolean().optional(),
    brokerName: z.string().optional(),
    brokerageTxId: z.string().optional(),
    kanta: z.preprocess((val) => {
        if (val === '' || val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
    }, z.number().min(0).optional()),
    paymentType: z.string().min(1, "Payment type is required"),
    forceUnique: z.boolean().optional(),
    unit: z.string().optional(),
    isPartyReceipt: z.boolean().optional(),
});

export type CompleteSupplierFormValues = z.infer<typeof completeSupplierFormSchema>;

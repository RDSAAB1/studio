import { z } from "zod";

export const completeSupplierFormSchema = z.object({
    srNo: z.string(),
    date: z.date(),
    term: z.coerce.number().min(0),
    name: z.string().min(1, "Name is required."),
    so: z.string(),
    address: z.string(),
    contact: z.string()
        .refine((val) => {
            // Allow empty string or exactly 10 digits
            if (!val || val.trim().length === 0) return true;
            return val.length === 10 && /^\d+$/.test(val);
        }, {
            message: "Contact number must be exactly 10 digits or empty."
        }),
    vehicleNo: z.string(),
    variety: z.string().min(1, "Variety is required."),
    grossWeight: z.preprocess((val) => {
        if (val === '' || val === null || val === undefined) return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }, z.number().min(0).default(0)),
    teirWeight: z.preprocess((val) => {
        if (val === '' || val === null || val === undefined) return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }, z.number().min(0).default(0)),
    rate: z.preprocess((val) => {
        if (val === '' || val === null || val === undefined) return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }, z.number().min(0).default(0)),
    kartaPercentage: z.preprocess((val) => {
        if (val === '' || val === null || val === undefined) return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }, z.number().min(0).default(0)),
    labouryRate: z.preprocess((val) => {
        if (val === '' || val === null || val === undefined) return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }, z.number().min(0).default(0)),
    brokerage: z.preprocess((val) => {
        if (val === '' || val === null || val === undefined) return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }, z.number().min(0).default(0)),
    brokerageRate: z.preprocess((val) => {
        if (val === '' || val === null || val === undefined) return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }, z.number().min(0).default(0)),
    brokerageAddSubtract: z.boolean().optional(),
    kanta: z.preprocess((val) => {
        if (val === '' || val === null || val === undefined) return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }, z.number().min(0).default(0)),
    paymentType: z.string().min(1, "Payment type is required"),
    forceUnique: z.boolean().optional(),
});

export type CompleteSupplierFormValues = z.infer<typeof completeSupplierFormSchema>;

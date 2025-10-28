import { z } from "zod";

export const completeSupplierFormSchema = z.object({
    srNo: z.string(),
    date: z.date(),
    term: z.coerce.number().min(0),
    name: z.string().min(1, "Name is required."),
    so: z.string(),
    address: z.string(),
    contact: z.string()
        .length(10, "Contact number must be exactly 10 digits.")
        .regex(/^\d+$/, "Contact number must only contain digits."),
    vehicleNo: z.string(),
    variety: z.string().min(1, "Variety is required."),
    grossWeight: z.coerce.number().min(0),
    teirWeight: z.coerce.number().min(0),
    rate: z.coerce.number().min(0),
    kartaPercentage: z.coerce.number().min(0),
    labouryRate: z.coerce.number().min(0),
    brokerage: z.coerce.number().min(0),
    brokerageRate: z.coerce.number().min(0),
    brokerageAddSubtract: z.boolean().optional(),
    kanta: z.coerce.number().min(0),
    paymentType: z.string().min(1, "Payment type is required"),
    forceUnique: z.boolean().optional(),
});

export type CompleteSupplierFormValues = z.infer<typeof completeSupplierFormSchema>;

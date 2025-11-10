import { z } from "zod";

export const simpleSupplierFormSchema = z.object({
    srNo: z.string().min(1, "Serial number is required"),
    date: z.date(),
    name: z.string().min(1, "Name is required"),
    contact: z.string()
        .length(10, "Contact number must be exactly 10 digits")
        .regex(/^\d+$/, "Contact number must only contain digits"),
    so: z.string().optional(),
    address: z.string().optional(),
    vehicleNo: z.string().optional(),
    variety: z.string().min(1, "Variety is required"),
    grossWeight: z.coerce.number().min(0, "Weight must be positive"),
    rate: z.coerce.number().min(0, "Rate must be positive"),
});

export type SimpleSupplierFormValues = z.infer<typeof simpleSupplierFormSchema>;

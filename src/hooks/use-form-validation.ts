"use client";

import { useForm, type UseFormProps, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodSchema, ZodTypeAny } from "zod";

type AnyZodSchema = ZodSchema<any> | ZodTypeAny;

/**
 * Custom hook to integrate React Hook Form with Zod validation.
 * @param schema - The Zod schema for validation
 * @param options - Additional options for useForm (excluding resolver)
 * @returns The useForm methods
 */
export const useFormValidation = <TFieldValues extends Record<string, any>>(
  schema: AnyZodSchema,
  options?: Omit<UseFormProps<TFieldValues>, "resolver">
): UseFormReturn<TFieldValues> => {
  return useForm<TFieldValues>({
    ...options,
    resolver: zodResolver(schema),
  });
};


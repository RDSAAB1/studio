"use client";

import { z } from "zod";

export const requiredString = (message = "This field is required") =>
  z.string().min(1, message);

export const optionalString = () => z.string().optional().or(z.literal(""));

export const trimmedString = (message = "This field is required") =>
  z.string().trim().min(1, message);

export const contactNumber10Digit = (fieldLabel = "Contact number") =>
  z
    .string()
    .length(10, `${fieldLabel} must be exactly 10 digits.`)
    .regex(/^\d+$/, `${fieldLabel} must only contain digits.`);

export const nonNegativeNumber = (message = "Value must be zero or greater") =>
  z.coerce.number().min(0, message);

export const positiveAmount = (message = "Amount must be greater than 0.") =>
  z.coerce.number().min(0.01, message);

export const optionalNumber = () => z.coerce.number().optional();

export const emailAddress = () =>
  z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal(""));

export const indianGstin = () =>
  z
    .string()
    .regex(/^[0-9A-Z]{15}$/, "GSTIN must be 15 characters")
    .optional()
    .or(z.literal(""));


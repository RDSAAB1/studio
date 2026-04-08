import type { MandiReport } from "@/lib/definitions";

export type VoucherBlock = {
  voucherNo: string;
  bookNo: string;
  purchaseDate: string;
  sellerName: string;
  fatherName: string;
  village: string;
  tehsil: string;
  district: string;
  khasraNo: string;
  khasraArea: string;
  mobile: string;
  commodity: string;
  quantityQtl: number;
  ratePerQtl: number;
  grossAmount: number;
  netAmount?: number;
  mandiFee: number;
  developmentCess: number;
  totalMandiFee: number;
  traderName?: string;
  buyerFirm?: string;
  buyerLicense?: string;
  mandiName?: string;
  mandiSiteType?: string;
  mandiSiteName?: string;
};

export type PaymentBlock = {
  voucherNo: string;
  traderReceiptNo: string;
  paymentDate: string;
  bankAccount: string;
  paymentMode: string;
  transactionNumber: string;
  ifsc: string;
  paymentAmount: number;
  narration: string;
};

export type CombinedEntry = MandiReport;

export type ParseResult =
  | { success: true; voucher: VoucherBlock; payment: PaymentBlock }
  | { success: false; errors: string[] };

"use client";

import React from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { 
  Edit2, 
  Trash2, 
  Eye, 
  Printer, 
  Download, 
} from "lucide-react";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { displayDate } from "../utils/parser";
import type { CombinedEntry } from "../types";

interface EntriesTableProps {
  entries: CombinedEntry[];
  filteredEntries: CombinedEntry[];
  activeId: string | null;
  onSelect: (entry: CombinedEntry) => void;
  onDelete: (id: string) => void;
  onPreview: () => void;
  onPrint: () => void;
  onExport: () => void;
  filterFrom: Date | undefined;
  setFilterFrom: (date: Date | undefined) => void;
  filterTo: Date | undefined;
  setFilterTo: (date: Date | undefined) => void;
}

export const EntriesTable: React.FC<EntriesTableProps> = ({
  entries,
  filteredEntries,
  activeId,
  onSelect,
  onDelete,
  onPreview,
  onPrint,
  onExport,
  filterFrom,
  setFilterFrom,
  filterTo,
  setFilterTo,
}) => {
  return (
    <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden">
      <CardHeader className="border-b border-border/50 pb-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2">
               Verified Mandi Records
               <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                 {filteredEntries.length} Items
               </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Review and manage parsed voucher entries before final sync.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border border-border/30">
               <SmartDatePicker
                 value={filterFrom}
                 onChange={(val) => setFilterFrom(val instanceof Date ? val : val ? new Date(val) : undefined)}
                 placeholder="From"
                 inputClassName="h-8 w-28 text-[11px] font-bold border-0 bg-transparent"
                 returnDate={true}
               />
               <div className="w-px h-4 bg-border/50" />
               <SmartDatePicker
                 value={filterTo}
                 onChange={(val) => setFilterTo(val instanceof Date ? val : val ? new Date(val) : undefined)}
                 placeholder="To"
                 inputClassName="h-8 w-28 text-[11px] font-bold border-0 bg-transparent"
                 returnDate={true}
               />
            </div>
            <div className="flex items-center gap-2">
               <Button
                 variant="outline"
                 size="sm"
                 onClick={onPreview}
                 disabled={!filteredEntries.length}
                 className="h-8 text-[10px] font-black uppercase tracking-widest"
               >
                 <Eye className="mr-1.5 h-3.5 w-3.5" />
                 Preview
               </Button>
               <Button
                 size="sm"
                 onClick={onPrint}
                 disabled={!filteredEntries.length}
                 className="h-8 text-[10px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 shadow-blue-500/10 shadow-lg"
               >
                 <Printer className="mr-1.5 h-3.5 w-3.5" />
                 Print
               </Button>
               <Button
                 variant="outline"
                 size="sm"
                 onClick={onExport}
                 disabled={!entries.length}
                 className="h-8 text-[10px] font-black uppercase tracking-widest"
               >
                 <Download className="mr-1.5 h-3.5 w-3.5" />
                 Excel
               </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="w-full max-h-[500px] overflow-auto custom-scrollbar">
          <div className="min-w-[1800px]">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-20 shadow-sm border-b">
                <TableRow className="hover:bg-transparent border-0">
                  <TableHead className="w-12 text-center text-[10px] font-black uppercase tracking-wider h-11">#</TableHead>
                  <TableHead className="w-28 text-center text-[10px] font-black uppercase tracking-wider h-11">6R DATE</TableHead>
                  <TableHead className="min-w-[300px] text-[10px] font-black uppercase tracking-wider h-11">Farmer / Father / Address</TableHead>
                  <TableHead className="w-28 text-center text-[10px] font-black uppercase tracking-wider h-11">Mobile</TableHead>
                  <TableHead className="w-28 text-center text-[10px] font-black uppercase tracking-wider h-11">Gata No</TableHead>
                  <TableHead className="w-32 text-center text-[10px] font-black uppercase tracking-wider h-11">6R No</TableHead>
                  <TableHead className="w-24 text-right text-[10px] font-black uppercase tracking-wider h-11">QTY</TableHead>
                  <TableHead className="w-24 text-right text-[10px] font-black uppercase tracking-wider h-11">Rate</TableHead>
                  <TableHead className="w-28 text-right text-[10px] font-black uppercase tracking-wider h-11">Amount</TableHead>
                  <TableHead className="w-24 text-right text-[10px] font-black uppercase tracking-wider h-11">Fee</TableHead>
                  <TableHead className="w-24 text-right text-[10px] font-black uppercase tracking-wider h-11">Cess</TableHead>
                  <TableHead className="w-28 text-right text-[10px] font-black uppercase tracking-wider h-11">Total Fee</TableHead>
                  <TableHead className="w-28 text-center text-[10px] font-black uppercase tracking-wider h-11">Pay Date</TableHead>
                  <TableHead className="w-40 text-center text-[10px] font-black uppercase tracking-wider h-11">Account No</TableHead>
                  <TableHead className="w-32 text-center text-[10px] font-black uppercase tracking-wider h-11">IFSC</TableHead>
                  <TableHead className="w-40 text-center text-[10px] font-black uppercase tracking-wider h-11">UTR</TableHead>
                  <TableHead className="w-24 text-center text-[10px] font-black uppercase tracking-wider h-11 sticky right-0 bg-muted/80 backdrop-blur-md">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry, index) => {
                  const totalFee = entry.totalCharges || Math.round(((entry.mandiFee || 0) + (entry.developmentCess || 0)) * 100) / 100;
                  const farmerLine = [entry.sellerName, entry.fatherName ? `S/O: ${entry.fatherName}` : null, entry.village].filter(Boolean).join(", ");
                  const utrValRaw = entry.transactionNumber || entry.narration || "";
                  const cleanedUtr = utrValRaw.replace(/\D/g, "");
                  const utrDisplay = cleanedUtr && (cleanedUtr.length === 5 || cleanedUtr.length === 6) && /^\d+$/.test(cleanedUtr) ? "TRANSFER" : utrValRaw;

                  return (
                    <TableRow 
                      key={entry.id} 
                      className={`hover:bg-primary/5 transition-colors border-border/40 ${activeId === entry.id ? "bg-primary/10" : ""}`}
                    >
                      <TableCell className="text-center text-[10px] py-2 font-bold text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="text-center text-[10px] py-2 font-bold whitespace-nowrap">{displayDate(entry.purchaseDate)}</TableCell>
                      <TableCell className="py-2 text-[11px] font-bold tracking-tight">{farmerLine}</TableCell>
                      <TableCell className="text-center text-[10px] py-2 whitespace-nowrap font-medium">{entry.mobile || "—"}</TableCell>
                      <TableCell className="text-center text-[10px] py-2 whitespace-nowrap font-medium">{entry.khasraNo || "—"}</TableCell>
                      <TableCell className="text-center text-[10px] py-2 whitespace-nowrap font-black">{entry.voucherNo || "—"}</TableCell>
                      <TableCell className="text-right text-[11px] py-2 whitespace-nowrap font-bold text-primary">{(entry.quantityQtl || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-[11px] py-2 whitespace-nowrap font-medium">{(entry.ratePerQtl || 0).toFixed(0)}</TableCell>
                      <TableCell className="text-right text-[11px] py-2 whitespace-nowrap font-black">{(entry.grossAmount || 0).toFixed(0)}</TableCell>
                      <TableCell className="text-right text-[10px] py-2 whitespace-nowrap font-medium">{(entry.mandiFee || 0).toFixed(0)}</TableCell>
                      <TableCell className="text-right text-[10px] py-2 whitespace-nowrap font-medium">{(entry.developmentCess || 0).toFixed(0)}</TableCell>
                      <TableCell className="text-right text-[11px] py-2 whitespace-nowrap font-black text-blue-600">{totalFee.toFixed(0)}</TableCell>
                      <TableCell className="text-center text-[10px] py-2 font-bold whitespace-nowrap">{displayDate(entry.paymentDate)}</TableCell>
                      <TableCell className="text-center text-[10px] py-2 font-medium tracking-tighter">{entry.bankAccount || "—"}</TableCell>
                      <TableCell className="text-center text-[10px] py-2 font-medium">{entry.ifsc || "—"}</TableCell>
                      <TableCell className="text-center text-[10px] py-2 font-bold text-muted-foreground whitespace-nowrap truncate max-w-[150px]">{utrDisplay || "—"}</TableCell>
                      <TableCell className="text-center py-2 sticky right-0 bg-transparent backdrop-blur-md">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full hover:bg-primary/20 hover:text-primary transition-all" onClick={() => onSelect(entry)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive transition-all" onClick={() => onDelete(entry.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredEntries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={17} className="text-center py-24 text-muted-foreground text-xs font-bold uppercase tracking-widest opacity-50">
                      No records found in current view
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

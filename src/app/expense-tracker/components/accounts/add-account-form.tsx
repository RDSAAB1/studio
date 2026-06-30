"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DialogFooter } from "@/components/ui/dialog";
import { validateAndExtractGST, GST_STATE_CODES } from "../../hooks/use-account-manager";

interface AddAccountFormProps {
  initialAccount: any;
  onSave: (data: any) => void;
  onClose: () => void;
  isSearchingGST: boolean;
  handleSearchGST: (val: string) => void;
  searchedGSTDetails: any;
  isSubmitting: boolean;
  isSearchingPAN?: boolean;
  handleSearchPAN?: (val: string) => void;
  handlePastePANText?: (text: string, isEdit: boolean) => void;
  searchedFirms?: any[];
  handleSelectFirm?: (firm: any, isEdit: boolean) => void;
  handleCancelGSTSearch?: () => void;
}

export function AddAccountForm({
  initialAccount,
  onSave,
  onClose,
  isSearchingGST,
  handleSearchGST,
  searchedGSTDetails,
  isSubmitting,
  isSearchingPAN = false,
  handleSearchPAN,
  handlePastePANText,
  searchedFirms = [],
  handleSelectFirm,
  handleCancelGSTSearch,
}: AddAccountFormProps) {
  const [newAccount, setNewAccount] = useState(initialAccount);

  useEffect(() => {
    setNewAccount(initialAccount);
  }, [initialAccount]);

  return (
    <>
      <div className="px-6 py-4 space-y-3.5 max-h-[calc(90vh-200px)] overflow-y-auto bg-slate-50/50">
        <div className="space-y-3.5">
          <div className="space-y-1">
            <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Account Type</Label>
            <div className="flex gap-1.5">
              {[
                { value: 'PARTY LEDGER', label: 'Party Account' },
                { value: 'MASTER ACCOUNT', label: 'Master Account' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setNewAccount({
                    ...newAccount,
                    subCategory: opt.value,
                    category: opt.value,
                    nature: 'Indirect Expense',
                    accountingTag: 'Indirect Expense'
                  })}
                  className={`flex-1 h-8.5 text-[10px] font-black uppercase rounded border-2 transition-all ${
                    newAccount.subCategory === opt.value
                      ? 'bg-[#3b0764] border-[#3b0764] text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <Label htmlFor="newAccountName" className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Account Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="newAccountName"
                value={newAccount.name}
                onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value.toUpperCase() })}
                placeholder="ENTER ACCOUNT NAME..."
                className="h-8.5 text-xs bg-slate-50 border-2 border-slate-200 text-black placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary/20 font-bold"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="newAccountContact" className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Contact No.</Label>
              <Input
                id="newAccountContact"
                value={newAccount.contact}
                onChange={(e) => setNewAccount({ ...newAccount, contact: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                placeholder="ENTER MOBILE NO..."
                maxLength={10}
                className="h-8.5 text-xs bg-slate-50 border-2 border-slate-200 text-black placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary/20 font-bold"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="newAccountAddress" className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Address</Label>
            <Input
              id="newAccountAddress"
              value={newAccount.address}
              onChange={(e) => setNewAccount({ ...newAccount, address: e.target.value.toUpperCase() })}
              placeholder="ENTER FULL ADDRESS..."
              className="h-8.5 text-xs bg-slate-50 border-2 border-slate-200 text-black placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary/20 font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex gap-1.5">
              {[
                { value: 'fatherName', label: 'Father Name' },
                { value: 'gst', label: 'GST Number' },
                { value: 'pan', label: 'PAN Card' },
                { value: 'other', label: 'Other' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setNewAccount({ ...newAccount, extraFieldType: opt.value as any })}
                  className={`flex-1 h-8 text-[11px] font-black uppercase rounded border-2 transition-all ${
                    newAccount.extraFieldType === opt.value
                      ? 'bg-[#3b0764] border-[#3b0764] text-white shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 items-end">
              <div className="flex-1">
                <Input
                  id="newAccountExtraValue"
                  type="text"
                  value={newAccount.extraFieldValue || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (newAccount.extraFieldType === 'gst') {
                      setNewAccount({ ...newAccount, extraFieldValue: val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15) });
                    } else if (newAccount.extraFieldType === 'pan') {
                      setNewAccount({ ...newAccount, extraFieldValue: val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) });
                    } else {
                      setNewAccount({ ...newAccount, extraFieldValue: val.toUpperCase() });
                    }
                  }}
                  maxLength={newAccount.extraFieldType === 'gst' ? 15 : (newAccount.extraFieldType === 'pan' ? 10 : undefined)}
                  placeholder={newAccount.extraFieldType === 'gst' ? 'ENTER GST...' : (newAccount.extraFieldType === 'pan' ? 'ENTER PAN...' : (newAccount.extraFieldType === 'other' ? 'ENTER DETAILS...' : 'ENTER FATHER NAME...'))}
                  className="h-8.5 text-xs bg-slate-50 border-2 border-slate-200 text-black placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary/20 font-bold"
                />
              </div>
              {newAccount.extraFieldType === 'gst' && (
                isSearchingGST ? (
                  <Button
                    type="button"
                    onClick={handleCancelGSTSearch}
                    className="h-8 px-4 bg-rose-600 hover:bg-rose-700 !text-white font-black text-[10px] tracking-wider uppercase rounded shadow shrink-0"
                  >
                    STOP SEARCH
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => handleSearchGST(newAccount.extraFieldValue)}
                    disabled={newAccount.extraFieldValue.trim().length !== 15}
                    className="h-8 px-4 bg-[#3b0764] hover:bg-[#2e054f] !text-white font-black text-[10px] tracking-wider uppercase rounded shadow shrink-0"
                  >
                    SEARCH ON CLEARTAX
                  </Button>
                )
              )}
              {newAccount.extraFieldType === 'pan' && (
                isSearchingPAN ? (
                  <Button
                    type="button"
                    onClick={handleCancelGSTSearch}
                    className="h-8 px-4 bg-rose-600 hover:bg-rose-700 !text-white font-black text-[10px] tracking-wider uppercase rounded shadow shrink-0"
                  >
                    STOP SEARCH
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      const panVal = (newAccount.extraFieldValue || "").trim().toUpperCase();
                      if (panVal.length === 10) {
                        handleSearchPAN && handleSearchPAN(panVal);
                      }
                    }}
                    disabled={newAccount.extraFieldValue.trim().length !== 10}
                    className="h-8 px-4 bg-[#3b0764] hover:bg-[#2e054f] !text-white font-black text-[10px] tracking-wider uppercase rounded shadow shrink-0"
                  >
                    SEARCH PAN
                  </Button>
                )
              )}
            </div>
            {newAccount.extraFieldType === 'gst' && (() => {
              const res = validateAndExtractGST(newAccount.extraFieldValue);
              if (res.isValid && res.pan) {
                return (
                  <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-100 rounded-md text-[10px] text-emerald-800 font-bold space-y-0.5 animate-fadeIn">
                    <div><span className="text-emerald-600">PAN CARD NO:</span> {String(res.pan).toUpperCase()}</div>
                    <div><span className="text-emerald-600">STATE CODE:</span> {res.stateCode}</div>
                    <div><span className="text-emerald-600">STATE NAME:</span> {res.stateName}</div>
                  </div>
                );
              } else if (newAccount.extraFieldValue.trim().length > 0) {
                return (
                  <div className="mt-1.5 p-2 bg-rose-50 border border-rose-100 rounded-md text-[10px] text-rose-800 font-bold">
                    {res.error || "GST number is incomplete or invalid"}
                  </div>
                );
              }
              return null;
            })()}

            {newAccount.extraFieldType === 'pan' && (() => {
              const panRegex = new RegExp("^[A-Z]{5}[0-9]{4}[A-Z]{1}$");
              const val = newAccount.extraFieldValue.trim().toUpperCase();
              if (val.length === 10 && panRegex.test(val)) {
                return (
                  <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-100 rounded-md text-[10px] text-emerald-800 font-bold space-y-0.5 animate-fadeIn">
                    <div><span className="text-emerald-600">PAN FORMAT:</span> VALID PAN NUMBER</div>
                  </div>
                );
              } else if (val.length > 0) {
                return (
                  <div className="mt-1.5 p-2 bg-rose-50 border border-rose-100 rounded-md text-[10px] text-rose-800 font-bold">
                    Invalid PAN format (Example: ABCDE1234F)
                  </div>
                );
              }
              return null;
            })()}

            {newAccount.extraFieldType === 'pan' && isSearchingPAN && (
              <div className="mt-2 p-2.5 bg-purple-50 border border-purple-200 rounded-lg flex items-center gap-2 animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-600 shrink-0" />
                <span className="text-[10px] font-black text-purple-700 uppercase tracking-wide">Searching LegalDev in background...</span>
              </div>
            )}

            {newAccount.extraFieldType === 'pan' && searchedFirms.length > 1 && (
              <div className="mt-2.5 space-y-1.5 animate-fadeIn">
                <Label className="text-[10px] font-black text-purple-700 uppercase tracking-widest block">
                  Select Firm / Branch ({searchedFirms.length} found):
                </Label>
                <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-purple-50/50 border border-purple-200/50 rounded-xl">
                  {searchedFirms.map((firm) => {
                    const isSelected = searchedGSTDetails?.gstin === firm.gstin;
                    return (
                      <button
                        key={firm.gstin}
                        type="button"
                        onClick={() => handleSelectFirm && handleSelectFirm(firm, false)}
                        className={`text-left p-2 rounded-lg border-2 text-xs font-bold transition-all flex flex-col space-y-0.5 ${
                          isSelected
                            ? 'bg-[#3b0764] border-[#3b0764] text-white shadow-md'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex justify-between w-full items-center">
                          <span className={isSelected ? 'text-white font-black' : 'text-slate-900 font-extrabold'}>
                            {firm.businessName}
                          </span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {firm.gstin}
                          </span>
                        </div>
                        <div className={`text-[9px] truncate ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>
                          {firm.address}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(newAccount.extraFieldType === 'gst' || newAccount.extraFieldType === 'pan') && searchedGSTDetails && (
              <div className="mt-2.5 p-3 bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl space-y-2 text-xs font-bold text-slate-800 shadow-inner animate-fadeIn">
                <div className="text-[10px] font-black uppercase text-purple-700 tracking-wider pb-1 border-b border-purple-200/60 flex items-center justify-between">
                  <span>Import Success</span>
                  <Badge variant="outline" className="bg-emerald-600 hover:bg-emerald-600 text-white border-0 font-black text-[9px] px-2 py-0.5 rounded">DETAILS APPLIED</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div><span className="text-slate-400 font-medium text-[9px]">BUSINESS NAME:</span> <div className="text-purple-950 font-black uppercase">{searchedGSTDetails.businessName}</div></div>
                  <div><span className="text-slate-400 font-medium text-[9px]">GSTIN NUMBER:</span> <div className="text-purple-950 font-black uppercase">{searchedGSTDetails.gstin}</div></div>
                  <div><span className="text-slate-400 font-medium text-[9px]">PAN NUMBER:</span> <div className="text-slate-950 font-black uppercase">{searchedGSTDetails.pan}</div></div>
                  <div><span className="text-slate-400 font-medium text-[9px]">STATE CODE:</span> <div className="text-slate-950 font-black uppercase">{searchedGSTDetails.stateCode || (searchedGSTDetails.gstin || "").slice(0, 2)}</div></div>
                  <div><span className="text-slate-400 font-medium text-[9px]">STATE NAME:</span> <div className="text-slate-950 font-black uppercase">{searchedGSTDetails.stateName || GST_STATE_CODES[(searchedGSTDetails.gstin || "").slice(0, 2)] || "UTTAR PRADESH"}</div></div>
                  <div><span className="text-slate-400 font-medium text-[9px]">ADDRESS:</span> <div className="text-slate-950 font-black uppercase">{searchedGSTDetails.address}</div></div>
                  <div><span className="text-slate-400 font-medium text-[9px]">ENTITY TYPE:</span> <div className="text-slate-950 font-black uppercase">{searchedGSTDetails.entityType}</div></div>
                  <div><span className="text-slate-400 font-medium text-[9px]">NATURE OF BUSINESS:</span> <div className="text-slate-950 font-black uppercase">{searchedGSTDetails.natureOfBusiness}</div></div>
                  <div><span className="text-slate-400 font-medium text-[9px]">REGISTRATION DATE:</span> <div className="text-slate-950 font-black uppercase">{searchedGSTDetails.registrationDate || "N/A"}</div></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <DialogFooter className="px-6 py-3 border-t border-border bg-card/50 gap-2">
        <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="h-10 border-border text-foreground hover:bg-muted">
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setNewAccount({
            name: "",
            contact: "",
            address: "",
            nature: "Indirect Expense",
            category: "PARTY LEDGER",
            subCategory: "PARTY LEDGER",
            extraFieldType: "fatherName",
            extraFieldValue: ""
          })}
          disabled={isSubmitting}
          className="h-10 border-border text-foreground hover:bg-muted font-bold text-xs"
        >
          Clear Form
        </Button>
        <Button
          onClick={() => onSave(newAccount)}
          disabled={!newAccount.name.trim() || isSubmitting}
          className="h-12 px-8 bg-[#3b0764] hover:bg-[#2e054f] !text-white font-black text-lg shadow-xl disabled:bg-slate-300 disabled:!text-slate-500 transition-all ml-auto"
        >
          {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          ADD ACCOUNT
        </Button>
      </DialogFooter>
    </>
  );
}

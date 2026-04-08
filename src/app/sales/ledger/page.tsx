"use client";

import React, { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { LedgerHeader } from "./components/ledger-header";
import { AccountForm } from "./components/account-form";
import { EntryForm } from "./components/entry-form";
import { LedgerSidebar } from "./components/ledger-sidebar";
import { LedgerTable } from "./components/ledger-table";
import { CashManagement } from "./components/cash-management";
import { StatementView } from "./components/statement-view";
import { useLedgerPage } from "./hooks/use-ledger-page";
import { useStatementLogic } from "./hooks/use-statement-logic";
import { toTitleCase } from "@/lib/utils";

const LedgerPage: React.FC = () => {
  const ledger = useLedgerPage();
  
  const ledgerTotals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    ledger.displayEntries.forEach((entry) => {
      debit += entry.debit;
      credit += entry.credit;
    });
    const balance = ledger.displayEntries.length > 0 ? (ledger.displayEntries[0]?.runningBalance || 0) : 0;
    return { debit, credit, balance };
  }, [ledger.displayEntries]);

  const statement = useStatementLogic(ledger.activeAccount, ledger.displayEntries, ledgerTotals);

  const accountDropdownOptions = useMemo(() => {
    return ledger.accounts.map((account) => ({
      value: account.id,
      label: [
        account.name ? toTitleCase(account.name) : "Unnamed Account",
        account.address ? toTitleCase(account.address) : null,
        account.contact && account.contact.trim().length > 0 ? account.contact : null,
      ].filter(Boolean).join(" | "),
      data: account,
    }));
  }, [ledger.accounts]);

  return (
    <div className="flex flex-col h-full bg-background p-4 md:p-6 space-y-6 overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-border/50 shadow-sm">
        <LedgerHeader
          accountDropdownOptions={accountDropdownOptions}
          activeAccountId={ledger.activeAccountId}
          onAccountChange={(val) => ledger.setActiveAccountId(val)}
          accountsLength={ledger.accounts.length}
          showAccountForm={ledger.showAccountForm}
          onToggleAccountForm={() => ledger.setShowAccountForm(!ledger.showAccountForm)}
          saving={ledger.saving}
          onPrintLedger={statement.handlePrintLedger}
          activeAccount={ledger.activeAccount}
        />
      </div>

      {ledger.showAccountForm && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <AccountForm
            newAccount={ledger.newAccount}
            onAccountChange={ledger.setNewAccount}
            onSubmit={ledger.handleCreateAccount}
            onCancel={() => ledger.setShowAccountForm(false)}
            saving={ledger.saving}
          />
        </div>
      )}

      <Tabs defaultValue="ledger" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-fit bg-muted/50 p-1 rounded-xl mb-6">
          <TabsTrigger value="ledger" className="rounded-lg px-6 font-bold tracking-tight">Ledger</TabsTrigger>
          <TabsTrigger value="cash" className="rounded-lg px-6 font-bold tracking-tight">Cash Management</TabsTrigger>
          <TabsTrigger value="statement" className="rounded-lg px-6 font-bold tracking-tight">Daily Statement</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="flex-1 min-h-0 m-0 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
            {/* Sidebar */}
            <div className="lg:col-span-1 hidden lg:block">
              <LedgerSidebar
                accounts={ledger.accounts}
                activeAccountId={ledger.activeAccountId}
                onAccountSelect={ledger.setActiveAccountId}
                onShowAccountForm={() => ledger.setShowAccountForm(true)}
                accountDropdownOptions={accountDropdownOptions}
              />
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3 flex flex-col gap-6 min-h-0">
              <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
                {/* Entry Form */}
                <Card className="w-full xl:w-72 flex-shrink-0 order-2 xl:order-1 border-0 shadow-md bg-card/80 backdrop-blur-sm self-start">
                  <CardContent className="p-5">
                    <h4 className="text-sm font-black mb-4 uppercase tracking-widest text-primary/70">New Entry</h4>
                    <EntryForm
                      entryForm={ledger.entryForm}
                      onEntryFormChange={ledger.setEntryForm}
                      onSubmit={ledger.handleAddEntry}
                      activeAccount={ledger.activeAccount}
                      saving={ledger.saving}
                      accounts={ledger.accounts}
                      activeAccountId={ledger.activeAccountId}
                      linkAccountId={ledger.linkAccountId}
                      onLinkAccountChange={ledger.setLinkAccountId}
                      linkMode={ledger.linkMode}
                      onLinkModeChange={ledger.setLinkMode}
                    />
                  </CardContent>
                </Card>

                {/* Ledger Table */}
                <div className="flex-1 min-h-0 order-1 xl:order-2 overflow-y-auto pr-1">
                   <LedgerTable
                     displayEntries={ledger.displayEntries}
                     editingEntryId={ledger.editingEntryId}
                     editForm={ledger.editForm}
                     setEditForm={ledger.setEditForm}
                     onEdit={ledger.handleEditEntry}
                     onCancelEdit={ledger.handleCancelEdit}
                     onSaveEdit={ledger.handleSaveEdit}
                     onDelete={ledger.handleDeleteEntry}
                   />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cash" className="flex-1 min-h-0 m-0 outline-none overflow-y-auto">
          <CashManagement
            activeCashAccount={ledger.activeCashAccount}
            cashSummary={ledger.cashSummary}
            onUpdateCount={ledger.handleUpdateCashCount}
            onAddRow={ledger.handleAddCashCountRow}
            onRemoveRow={ledger.handleRemoveCashCountRow}
            onReset={ledger.handleResetCashAccount}
            onDelete={ledger.handleDeleteCashAccount}
          />
        </TabsContent>

        <TabsContent value="statement" className="flex-1 min-h-0 m-0 outline-none overflow-y-auto">
          <StatementView
            statementStart={statement.statementStart}
            setStatementStart={statement.setStatementStart}
            statementEnd={statement.statementEnd}
            setStatementEnd={statement.setStatementEnd}
            loading={statement.statementLoading}
            data={statement.statementData}
            error={statement.statementError}
            onGenerate={statement.handleGenerateStatement}
            onExport={statement.handleExportStatement}
            onPrint={statement.handlePrintLedger}
            totals={statement.statementTotals}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LedgerPage;

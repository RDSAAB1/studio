"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchActivityLog,
  fetchRecycleBin,
  restoreFromRecycleBin,
  clearAllActivityLog,
  clearAllRecycleBin,
  type ActivityLogEntry,
  type RecycleBinEntry,
  type ActivityType,
} from "@/lib/audit";
import { useToast } from "@/hooks/use-toast";
import { useErpSelectionOptional } from "@/contexts/erp-selection-context";
import { getCompanyMemberRole, getTenantMemberRole, getActiveTenant } from "@/lib/tenancy";
import { Loader2, History, RotateCcw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const PAGE_SIZE = 10;

type ActivityTab = "new" | "edit" | "delete" | "recycle";

export default function ActivityHistoryPage({ initialTab = "new" }: { initialTab?: ActivityTab }) {
  const { toast } = useToast();
  const tab = initialTab;
  const [createEntries, setCreateEntries] = useState<ActivityLogEntry[]>([]);
  const [editEntries, setEditEntries] = useState<ActivityLogEntry[]>([]);
  const [deleteEntries, setDeleteEntries] = useState<ActivityLogEntry[]>([]);
  const [recycleEntries, setRecycleEntries] = useState<RecycleBinEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<Record<string, unknown>>({});
  const [restoring, setRestoring] = useState<string | null>(null);

  const [loadFailed, setLoadFailed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [clearing, setClearing] = useState(false);
  const erp = useErpSelectionOptional();
  const selection = erp?.selection;

  useEffect(() => {
    const cid = selection?.companyId;
    if (cid) {
      getCompanyMemberRole(cid).then((r) => {
        setIsAdmin(r === "owner" || r === "admin");
      });
      return;
    }
    const tenant = getActiveTenant();
    if (tenant?.id) {
      getTenantMemberRole(tenant.id).then((r) => setIsAdmin(r === "owner" || r === "admin"));
    } else {
      setIsAdmin(false);
    }
  }, [selection?.companyId]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [createRes, editRes, deleteRes, recycleRes] = await Promise.all([
        fetchActivityLog("create", PAGE_SIZE),
        fetchActivityLog("edit", PAGE_SIZE),
        fetchActivityLog("delete", PAGE_SIZE),
        fetchRecycleBin(PAGE_SIZE),
      ]);
      const anyError = createRes.hasError || editRes.hasError || deleteRes.hasError || recycleRes.hasError;
      if (anyError) {
        setLoadFailed(true);
      }
      setCreateEntries(createRes.entries);
      setEditEntries(editRes.entries);
      setDeleteEntries(deleteRes.entries);
      setRecycleEntries(recycleRes.entries);
      setLastDoc({
        create: createRes.lastDoc,
        edit: editRes.lastDoc,
        delete: deleteRes.lastDoc,
        recycle: recycleRes.lastDoc,
      });
    } catch (e) {
      setLoadFailed(true);
      const msg = e instanceof Error ? e.message : "Failed to load history";
      toast({ title: "Failed to load history", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Reload when company/season selection changes (ERP selector in header)
  const selectionKey = selection ? `${selection.companyId}/${selection.subCompanyId}/${selection.seasonKey}` : getActiveTenant()?.id ?? "none";
  useEffect(() => {
    void loadInitial();
  }, [loadInitial, selectionKey]);

  const loadMore = async () => {
    const key = tab === "new" ? "create" : tab === "edit" ? "edit" : tab === "delete" ? "delete" : "recycle";
    const last = lastDoc[key];
    if (!last) return;

    setLoadingMore(true);
    try {
      if (key === "recycle") {
        const res = await fetchRecycleBin(PAGE_SIZE, last as any);
        setRecycleEntries((prev) => [...prev, ...res.entries]);
        setLastDoc((p) => ({ ...p, recycle: res.lastDoc }));
      } else {
        const res = await fetchActivityLog(key as ActivityType, PAGE_SIZE, last as any);
        if (key === "create") setCreateEntries((prev) => [...prev, ...res.entries]);
        else if (key === "edit") setEditEntries((prev) => [...prev, ...res.entries]);
        else setDeleteEntries((prev) => [...prev, ...res.entries]);
        setLastDoc((p) => ({ ...p, [key]: res.lastDoc }));
      }
    } catch {
      toast({ title: "Failed to load more", variant: "destructive" });
    } finally {
      setLoadingMore(false);
    }
  };

  const handleClearAllHistory = async () => {
    setClearing(true);
    try {
      const [activityCount, recycleCount] = await Promise.all([
        clearAllActivityLog(),
        clearAllRecycleBin(),
      ]);
      toast({
        title: "History cleared",
        description: `Removed ${activityCount} activity entries and ${recycleCount} recycle bin items.`,
        variant: "success",
      });
      void loadInitial();
    } catch (e) {
      toast({ title: "Failed to clear history", description: String(e), variant: "destructive" });
    } finally {
      setClearing(false);
    }
  };

  const handleRestore = async (entryId: string) => {
    setRestoring(entryId);
    try {
      const docId = await restoreFromRecycleBin(entryId);
      if (docId) {
        toast({ title: "Restored successfully", variant: "success" });
        setRecycleEntries((prev) => prev.filter((e) => e.id !== entryId));
      } else {
        toast({ title: "Restore failed", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Restore failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setRestoring(null);
    }
  };

  const hasMore = (() => {
    const key = tab === "new" ? "create" : tab === "edit" ? "edit" : tab === "delete" ? "delete" : "recycle";
    return !!lastDoc[key];
  })();

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <History className="h-8 w-8" />
            Activity History
          </h1>
          <p className="text-muted-foreground mt-1">
            Team-wide activity log — koi bhi member dekh sakta hai kisne kya kiya. Track who created, edited, or deleted entries. Restore accidentally deleted items from Recycle Bin.
          </p>
        </div>
        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={clearing}>
                {clearing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Clear All History
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear All History?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all activity log entries and empty the Recycle Bin. Restored items cannot be recovered. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearAllHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Clear All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {loadFailed && (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-muted-foreground text-center">
              Activity history load nahi ho paya. Top-right corner mein <strong>Company / Season</strong> selector se apna company aur season select karein, phir Retry karein.
            </p>
            <p className="text-sm text-muted-foreground text-center">
              Failed to load history. Please select a Company and Season from the dropdown in the header, then retry.
            </p>
            <Button onClick={() => void loadInitial()}>
              <Loader2 className={loading ? "h-4 w-4 animate-spin mr-2" : "mr-2 h-4 w-4"} />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!loadFailed && tab === "new" && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>New Entry History</CardTitle>
              <CardDescription>Recently created entries across all collections</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : createEntries.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <p className="text-muted-foreground">No new entries yet</p>
                  <p className="text-sm text-muted-foreground">Activity will appear when you add suppliers, payments, customers, or other records.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {createEntries.map((e) => (
                    <ActivityItem key={e.id} entry={e} />
                  ))}
                  {hasMore && (
                    <Button variant="outline" className="w-full" onClick={() => loadMore()} disabled={loadingMore}>
                      {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Load More
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
      )}

      {!loadFailed && tab === "edit" && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Edit History</CardTitle>
              <CardDescription>Recently edited entries</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : editEntries.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <p className="text-muted-foreground">No edits yet</p>
                  <p className="text-sm text-muted-foreground">Edit history will appear when you update existing records.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {editEntries.map((e) => (
                    <ActivityItem key={e.id} entry={e} />
                  ))}
                  {hasMore && (
                    <Button variant="outline" className="w-full" onClick={() => loadMore()} disabled={loadingMore}>
                      {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Load More
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
      )}

      {!loadFailed && tab === "delete" && (
          <Card>
            <CardHeader>
              <CardTitle>Delete History</CardTitle>
              <CardDescription>Recently deleted entries (check Recycle Bin to restore)</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : deleteEntries.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <p className="text-muted-foreground">No deletes yet</p>
                  <p className="text-sm text-muted-foreground">Delete history will appear when you remove records. Deleted items go to Recycle Bin.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {deleteEntries.map((e) => (
                    <ActivityItem key={e.id} entry={e} />
                  ))}
                  {hasMore && (
                    <Button variant="outline" className="w-full" onClick={() => loadMore()} disabled={loadingMore}>
                      {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Load More
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
      )}

      {!loadFailed && tab === "recycle" && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Recycle Bin</CardTitle>
              <CardDescription>Deleted entries that can be restored</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : recycleEntries.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <p className="text-muted-foreground">Recycle bin is empty</p>
                  <p className="text-sm text-muted-foreground">Deleted records will appear here. You can restore them if needed.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recycleEntries.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
                    >
                      <div>
                        <p className="font-medium">{e.collection} / {e.docId}</p>
                        <p className="text-sm text-muted-foreground">
                          Deleted by {e.deletedByName} on {format(new Date(e.deletedAt), "PPp")}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(e.id)}
                        disabled={!!restoring}
                      >
                        {restoring === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1" />}
                        Restore
                      </Button>
                    </div>
                  ))}
                  {hasMore && (
                    <Button variant="outline" className="w-full" onClick={() => loadMore()} disabled={loadingMore}>
                      {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Load More
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
      )}
    </div>
  );
}

function ActivityItem({ entry }: { entry: ActivityLogEntry }) {
  return (
    <div className="p-4 rounded-lg border bg-muted/30">
      <p className="font-medium">{entry.summary}</p>
      <p className="text-sm text-muted-foreground mt-1">
        {entry.collection} • <span className="font-medium text-foreground">By: {entry.userName}</span> • {format(new Date(entry.timestamp), "PPp")}
      </p>
    </div>
  );
}

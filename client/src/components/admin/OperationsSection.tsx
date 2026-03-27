import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Loader2, X, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { invalidateAdminQueries } from "./admin-utils";
import type { SyncStatus, BatchCategorizationStatus, CitationUpdateStatus } from "./admin-types";

export function OperationsSection() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [batchCategorizationStatus, setBatchCategorizationStatus] = useState<BatchCategorizationStatus | null>(null);
  const [citationStatus, setCitationStatus] = useState<CitationUpdateStatus | null>(null);
  const [batchCategorizeDialogOpen, setBatchCategorizeDialogOpen] = useState(false);
  const [batchCategorizeFilter, setBatchCategorizeFilter] = useState<"all" | "uncategorized" | "pending" | "approved">("uncategorized");
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const completionTimeout = useRef<NodeJS.Timeout | null>(null);
  const batchPollingInterval = useRef<NodeJS.Timeout | null>(null);
  const batchCompletionTimeout = useRef<NodeJS.Timeout | null>(null);
  const citationPollingInterval = useRef<NodeJS.Timeout | null>(null);
  const citationCompletionTimeout = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const fetchSyncStatus = async () => {
    try {
      const response = await apiRequest("GET", "/api/admin/sync-status");
      const data = await response.json();
      const newStatus: SyncStatus = {
        status: data.status, type: data.type, phase: data.phase, processed: data.processed,
        total: data.total, imported: data.imported, skipped: data.skipped, approved: data.approved,
        pending: data.pending, startTime: data.startTime || null, endTime: data.endTime || null,
        error: data.error, lastSuccessTime: data.lastSuccessTime || null,
      };
      setSyncStatus(newStatus);
      return newStatus;
    } catch (error) { return null; }
  };

  useEffect(() => {
    if (syncStatus?.status === "running") {
      if (completionTimeout.current) { clearTimeout(completionTimeout.current); completionTimeout.current = null; }
      pollingInterval.current = setInterval(fetchSyncStatus, 2000);
    } else {
      if (pollingInterval.current) { clearInterval(pollingInterval.current); pollingInterval.current = null; }
      if (syncStatus?.status === "completed") {
        invalidateAdminQueries();
        toast({ title: "Sync Complete", description: `Imported ${syncStatus.imported} publications (${syncStatus.approved} approved, ${syncStatus.pending} pending)` });
        if (completionTimeout.current) clearTimeout(completionTimeout.current);
        completionTimeout.current = setTimeout(() => {
          setSyncStatus((current) => current?.status === "completed" ? null : current);
        }, 5000);
      } else if (syncStatus?.status === "error") {
        toast({ title: "Sync Failed", description: syncStatus.error || "An error occurred during sync", variant: "destructive" });
      }
    }
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
      if (completionTimeout.current) clearTimeout(completionTimeout.current);
    };
  }, [syncStatus?.status]);

  const fetchBatchCategorizationStatus = async () => {
    try {
      const response = await apiRequest("GET", "/api/admin/batch-categorization/status");
      const data = await response.json();
      setBatchCategorizationStatus({
        status: data.status, filter: data.filter, phase: data.phase, processed: data.processed,
        total: data.total, success: data.success, failed: data.failed, skipped: data.skipped,
        currentPublication: data.currentPublication, startTime: data.startTime || null,
        endTime: data.endTime || null, error: data.error, etaSeconds: data.etaSeconds || null,
      });
    } catch (error) { return null; }
  };

  useEffect(() => {
    if (batchCategorizationStatus?.status === "running") {
      if (batchCompletionTimeout.current) { clearTimeout(batchCompletionTimeout.current); batchCompletionTimeout.current = null; }
      batchPollingInterval.current = setInterval(fetchBatchCategorizationStatus, 500);
    } else {
      if (batchPollingInterval.current) { clearInterval(batchPollingInterval.current); batchPollingInterval.current = null; }
      if (batchCategorizationStatus?.status === "completed") {
        batchCompletionTimeout.current = setTimeout(() => {
          invalidateAdminQueries();
          toast({ title: "Batch Categorization Complete", description: `Successfully categorized ${batchCategorizationStatus.success} publications (${batchCategorizationStatus.skipped} skipped, ${batchCategorizationStatus.failed} failed)` });
        }, 1000);
      }
    }
    return () => {
      if (batchPollingInterval.current) clearInterval(batchPollingInterval.current);
      if (batchCompletionTimeout.current) clearTimeout(batchCompletionTimeout.current);
    };
  }, [batchCategorizationStatus?.status]);

  const fetchCitationStatus = async () => {
    try {
      const response = await apiRequest("GET", "/api/admin/citation-status");
      const data = await response.json();
      setCitationStatus(data);
    } catch (error) { return null; }
  };

  useEffect(() => {
    if (citationStatus?.status === "running") {
      if (citationCompletionTimeout.current) { clearTimeout(citationCompletionTimeout.current); citationCompletionTimeout.current = null; }
      citationPollingInterval.current = setInterval(fetchCitationStatus, 1000);
    } else {
      if (citationPollingInterval.current) { clearInterval(citationPollingInterval.current); citationPollingInterval.current = null; }
      if (citationStatus?.status === "completed") {
        citationCompletionTimeout.current = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
          toast({ title: "Citation Update Complete", description: `Updated ${citationStatus.updated} of ${citationStatus.total} publications` });
        }, 1000);
      }
      if (citationStatus?.status === "error") {
        toast({ title: "Citation Update Failed", description: citationStatus.error || "Unknown error occurred", variant: "destructive" });
      }
    }
    return () => {
      if (citationPollingInterval.current) clearInterval(citationPollingInterval.current);
      if (citationCompletionTimeout.current) clearTimeout(citationCompletionTimeout.current);
    };
  }, [citationStatus?.status]);

  useEffect(() => { fetchSyncStatus(); fetchBatchCategorizationStatus(); fetchCitationStatus(); }, []);

  const handleFullSync = async () => {
    try {
      await apiRequest("POST", "/api/admin/sync-pubmed", { maxPerTerm: 5000 });
      toast({ title: "Full Sync Started", description: "Syncing all publications from PubMed. Progress will update automatically." });
      fetchSyncStatus();
    } catch (error: any) { toast({ title: "Sync Failed", description: error.message || "Failed to start full sync", variant: "destructive" }); }
  };

  const handleIncrementalSync = async () => {
    try {
      await apiRequest("POST", "/api/admin/sync-pubmed-incremental", { maxPerTerm: 5000 });
      toast({ title: "Incremental Sync Started", description: "Fetching publications from the past 12 months. Progress will update automatically." });
      fetchSyncStatus();
    } catch (error: any) { toast({ title: "Sync Failed", description: error.message || "Failed to start incremental sync", variant: "destructive" }); }
  };

  const handleCancelSync = async () => {
    try {
      await apiRequest("POST", "/api/admin/sync-cancel");
      toast({ title: "Cancellation Requested", description: "The sync will stop after the current batch completes." });
    } catch (error: any) { toast({ title: "Cancel Failed", description: error.message || "Failed to cancel sync", variant: "destructive" }); }
  };

  const handleRefetchAbstracts = async () => {
    try {
      await apiRequest("POST", "/api/admin/refetch-abstracts");
      toast({ title: "Abstract Refetch Started", description: "Fetching missing abstracts from PubMed. Progress will update automatically." });
      fetchSyncStatus();
    } catch (error: any) { toast({ title: "Refetch Failed", description: error.message || "Failed to start abstract refetch", variant: "destructive" }); }
  };

  const handleUpdateCitations = async () => {
    try {
      const response = await apiRequest("POST", "/api/admin/update-citations");
      const data = await response.json();
      if (data.success) { toast({ title: "Citation Update Started", description: data.message }); fetchCitationStatus(); }
      else { toast({ title: "Update Failed", description: data.message, variant: "destructive" }); }
    } catch (error: any) { toast({ title: "Update Failed", description: error.message || "Failed to start citation update", variant: "destructive" }); }
  };

  const handleStartBatchCategorization = async () => {
    try {
      await apiRequest("POST", "/api/admin/batch-categorization/start", { filter: batchCategorizeFilter });
      toast({ title: "Batch Categorization Started", description: "Generating ML-powered category suggestions. Progress will update automatically." });
      setBatchCategorizeDialogOpen(false);
      fetchBatchCategorizationStatus();
    } catch (error: any) { toast({ title: "Batch Categorization Failed", description: error.message || "Failed to start batch categorization", variant: "destructive" }); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#1d1d1f] dark:text-white mb-1">Operations</h2>
        <p className="text-sm text-[#6e6e73] dark:text-gray-400">Sync, categorization, and citation management</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>PubMed Sync</CardTitle>
          <CardDescription>Sync publications from PubMed Central</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-[#1d1d1f] dark:text-white">Full Sync</h3>
              <p className="text-sm text-[#6e6e73] dark:text-gray-400">Run a complete sync from 2000 to present.</p>
              <Button onClick={handleFullSync} disabled={syncStatus?.status === "running"} className="w-full">
                {syncStatus?.status === "running" && syncStatus.type === "full" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Syncing...</> : "Start Full Sync"}
              </Button>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-[#1d1d1f] dark:text-white">Incremental Sync</h3>
              <p className="text-sm text-[#6e6e73] dark:text-gray-400">Sync publications from the past 12 months.</p>
              <Button onClick={handleIncrementalSync} disabled={syncStatus?.status === "running"} variant="outline" className="w-full">
                {syncStatus?.status === "running" && syncStatus.type === "incremental" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Syncing...</> : "Sync Past 12 Months"}
              </Button>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-[#1d1d1f] dark:text-white">Refetch Abstracts</h3>
              <p className="text-sm text-[#6e6e73] dark:text-gray-400">Fetch missing abstracts using improved parser.</p>
              <Button onClick={handleRefetchAbstracts} disabled={syncStatus?.status === "running"} variant="outline" className="w-full">
                {syncStatus?.status === "running" && syncStatus.phase?.includes("abstract") ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Fetching...</> : "Refetch Missing Abstracts"}
              </Button>
            </div>
          </div>

          {syncStatus?.status === "running" && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-sm text-blue-900 dark:text-blue-100">{syncStatus.phase}</span>
                </div>
                <span className="text-sm text-blue-700 dark:text-blue-300">{syncStatus.processed}/{syncStatus.total} batches</span>
              </div>
              <Progress value={syncStatus.total > 0 ? (syncStatus.processed / syncStatus.total) * 100 : 0} className="h-2 mb-2" />
              <div className="flex items-center justify-between">
                <div className="flex gap-4 text-xs text-blue-700 dark:text-blue-300">
                  <span>Imported: {syncStatus.imported}</span>
                  <span>Skipped: {syncStatus.skipped}</span>
                  <span>Approved: {syncStatus.approved}</span>
                  <span>Pending: {syncStatus.pending}</span>
                </div>
                <Button onClick={handleCancelSync} variant="destructive" size="sm" className="ml-4">
                  <X className="mr-1 h-3 w-3" />Cancel Sync
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ML Categorization</CardTitle>
          <CardDescription>Generate ML-powered category suggestions for multiple publications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[#6e6e73] dark:text-gray-400">
            Use GPT-5 nano to automatically generate category suggestions for publications. High-confidence suggestions (&ge;80%) are auto-approved, while others are flagged for manual review.
          </p>
          <Button onClick={() => setBatchCategorizeDialogOpen(true)} disabled={batchCategorizationStatus?.status === "running"} variant="outline">
            {batchCategorizationStatus?.status === "running" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Categorizing...</> : <><Sparkles className="mr-2 h-4 w-4" />Bulk Generate Categories</>}
          </Button>

          {batchCategorizationStatus?.status === "running" && (() => {
            const percentage = batchCategorizationStatus.total > 0 ? (batchCategorizationStatus.processed / batchCategorizationStatus.total) * 100 : 0;
            let etaText = "Calculating...";
            if (batchCategorizationStatus.etaSeconds !== null && batchCategorizationStatus.etaSeconds >= 0) {
              const etaSec = batchCategorizationStatus.etaSeconds;
              etaText = etaSec < 60 ? `~${etaSec}s remaining` : `~${Math.ceil(etaSec / 60)} min${Math.ceil(etaSec / 60) > 1 ? 's' : ''} remaining`;
            }
            return (
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-600 dark:text-purple-400" />
                    <span className="font-medium text-sm text-purple-900 dark:text-purple-100">{batchCategorizationStatus.phase}</span>
                  </div>
                  <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">{percentage.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-purple-700 dark:text-purple-300">{batchCategorizationStatus.processed}/{batchCategorizationStatus.total} publications</span>
                  <span className="text-xs text-purple-600 dark:text-purple-400">{etaText}</span>
                </div>
                <Progress value={percentage} className="h-2 mb-2" />
                <div className="flex gap-4 text-xs text-purple-700 dark:text-purple-300">
                  <span>Success: {batchCategorizationStatus.success}</span>
                  <span>Skipped: {batchCategorizationStatus.skipped}</span>
                  <span>Failed: {batchCategorizationStatus.failed}</span>
                </div>
                {batchCategorizationStatus.currentPublication && (
                  <p className="mt-2 text-xs text-purple-600 dark:text-purple-400 truncate">Current: {batchCategorizationStatus.currentPublication}</p>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Citation Updates</CardTitle>
          <CardDescription>Fetch citation counts from OpenAlex for all publications with DOIs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleUpdateCitations} disabled={citationStatus?.status === "running" || syncStatus?.status === "running"} variant="outline">
            {citationStatus?.status === "running" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</> : "Update Citation Counts"}
          </Button>

          {citationStatus?.status === "running" && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-blue-900 dark:text-blue-100">{citationStatus.phase}</span>
                <span className="text-sm text-blue-700 dark:text-blue-300">{citationStatus.processed}/{citationStatus.total}</span>
              </div>
              <Progress value={citationStatus.total > 0 ? (citationStatus.processed / citationStatus.total) * 100 : 0} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={batchCategorizeDialogOpen} onOpenChange={setBatchCategorizeDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Bulk Generate Categories</DialogTitle>
            <DialogDescription>Use GPT-5 nano to generate ML-powered category suggestions for publications</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="filter-select">Select Publications</Label>
              <Select value={batchCategorizeFilter} onValueChange={(value: "all" | "uncategorized" | "pending" | "approved") => setBatchCategorizeFilter(value)}>
                <SelectTrigger id="filter-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uncategorized">Uncategorized Only (Approved publications with no categories)</SelectItem>
                  <SelectItem value="approved">All Approved Publications</SelectItem>
                  <SelectItem value="pending">Pending Publications</SelectItem>
                  <SelectItem value="all">All Publications (Pending + Approved)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>How it works:</strong> GPT-5 nano analyzes each publication's title and abstract to suggest relevant research areas. High-confidence suggestions (&ge;80%) are auto-approved, while lower confidence suggestions are flagged for manual review in the Category Review tab.
              </p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                <strong>Cost:</strong> ~$0.13 for all 2,911 publications using GPT-5 nano ($0.05/1M input, $0.40/1M output tokens)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchCategorizeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleStartBatchCategorization}>
              <Sparkles className="mr-2 h-4 w-4" />Start Categorization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

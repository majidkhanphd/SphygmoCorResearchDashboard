import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Search, Check, X, ExternalLink, Loader2, Pencil, Star, Sparkles, CheckCheck, Database, RefreshCw, BarChart3, FileText, Settings } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import { PaginationControls } from "@/components/pagination-controls";
import { RESEARCH_AREAS, RESEARCH_AREA_DISPLAY_NAMES } from "@shared/schema";
import type { Publication, SuggestedCategory } from "@shared/schema";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
  ColumnResizeMode,
} from "@tanstack/react-table";

interface SyncStatus {
  status: "idle" | "running" | "completed" | "error";
  type: "full" | "incremental" | null;
  phase: string;
  processed: number;
  total: number;
  imported: number;
  skipped: number;
  approved: number;
  pending: number;
  startTime: number | null;
  endTime: number | null;
  error: string | null;
  lastSuccessTime: number | null;
}

interface BatchCategorizationStatus {
  status: "idle" | "running" | "completed" | "error";
  filter: "all" | "uncategorized" | "pending" | "approved" | null;
  phase: string;
  processed: number;
  total: number;
  success: number;
  failed: number;
  skipped: number;
  currentPublication: string | null;
  startTime: number | null;
  endTime: number | null;
  error: string | null;
  etaSeconds: number | null;
}

interface BackupInfo {
  id: string;
  createdAt: string;
  description: string | null;
  recordCount: number;
}

type PmcPublicationWithEvidence = Publication;

function BackupRestoreSection() {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const { toast } = useToast();

  const { data: backupsData, refetch: refetchBackups } = useQuery<{ success: boolean; backups: BackupInfo[] }>({
    queryKey: ['/api/admin/backups'],
  });

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const response = await apiRequest('POST', '/api/admin/backup', {
        description: `Manual backup - ${new Date().toLocaleString()}`
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: "Backup Created", description: `Successfully backed up ${data.recordCount} publications.` });
        refetchBackups();
      } else {
        throw new Error(data.message || 'Backup failed');
      }
    } catch (err: any) {
      toast({ title: "Backup Failed", description: err.message || 'Failed to create backup', variant: "destructive" });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup) return;
    setIsRestoring(true);
    try {
      const response = await apiRequest('POST', `/api/admin/restore/${selectedBackup.id}`, { confirm: true });
      const data = await response.json();
      if (data.success) {
        toast({ title: "Restore Complete", description: `Successfully restored ${data.restoredCount} publications from backup.` });
        setRestoreDialogOpen(false);
        setSelectedBackup(null);
        queryClient.invalidateQueries({ queryKey: ['/api/admin/publications'] });
        queryClient.invalidateQueries({ queryKey: ['/api/publications'] });
      } else {
        throw new Error(data.message || 'Restore failed');
      }
    } catch (err: any) {
      toast({ title: "Restore Failed", description: err.message || 'Failed to restore from backup', variant: "destructive" });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button onClick={handleBackup} disabled={isBackingUp} data-testid="button-backup-now">
            {isBackingUp ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>) : "Backup Now"}
          </Button>
          <span className="text-sm text-[#6e6e73] dark:text-gray-400">Creates a snapshot of all publications</span>
        </div>
        {backupsData?.backups && backupsData.backups.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#6e6e73] dark:text-gray-400">Timestamp</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#6e6e73] dark:text-gray-400">Description</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#6e6e73] dark:text-gray-400">Records</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-[#6e6e73] dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {backupsData.backups.map((backup) => (
                  <tr key={backup.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30" data-testid={`row-backup-${backup.id}`}>
                    <td className="px-4 py-3 text-sm">{new Date(backup.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-[#6e6e73] dark:text-gray-400">{backup.description || '-'}</td>
                    <td className="px-4 py-3 text-sm"><Badge variant="secondary">{backup.recordCount.toLocaleString()}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => { setSelectedBackup(backup); setRestoreDialogOpen(true); }} data-testid={`button-restore-${backup.id}`}>Restore</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[#6e6e73] dark:text-gray-400">No backups available. Create one to protect your data.</p>
        )}
      </div>

      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Confirm Restore</DialogTitle>
            <DialogDescription>This will replace ALL current publications with the backup data. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          {selectedBackup && (
            <div className="py-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">Restore from:</p>
                <p className="text-sm text-amber-800 dark:text-amber-200">{new Date(selectedBackup.createdAt).toLocaleString()}</p>
                <p className="text-sm text-amber-800 dark:text-amber-200">{selectedBackup.recordCount.toLocaleString()} publications</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)} data-testid="button-cancel-restore">Cancel</Button>
            <Button variant="destructive" onClick={handleRestore} disabled={isRestoring} data-testid="button-confirm-restore">
              {isRestoring ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Restoring...</>) : "Confirm Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PubMedSyncSection({ syncStatus, onFullSync, onIncrementalSync, onRefetchAbstracts }: {
  syncStatus: SyncStatus | null;
  onFullSync: () => void;
  onIncrementalSync: () => void;
  onRefetchAbstracts: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border rounded-lg">
          <h4 className="font-medium text-sm mb-2">Full Sync</h4>
          <p className="text-xs text-[#6e6e73] dark:text-gray-400 mb-3">Complete sync from 2000 to present</p>
          <Button onClick={onFullSync} disabled={syncStatus?.status === "running"} size="sm" data-testid="button-full-sync">
            {syncStatus?.status === "running" && syncStatus.type === "full" ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Syncing...</>) : "Start Full Sync"}
          </Button>
        </div>
        <div className="p-4 border rounded-lg">
          <h4 className="font-medium text-sm mb-2">Incremental Sync</h4>
          <p className="text-xs text-[#6e6e73] dark:text-gray-400 mb-3">Sync new publications only</p>
          <Button onClick={onIncrementalSync} disabled={syncStatus?.status === "running"} variant="outline" size="sm" data-testid="button-incremental-sync">
            {syncStatus?.status === "running" && syncStatus.type === "incremental" ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Syncing...</>) : "Sync New"}
          </Button>
        </div>
        <div className="p-4 border rounded-lg">
          <h4 className="font-medium text-sm mb-2">Refetch Abstracts</h4>
          <p className="text-xs text-[#6e6e73] dark:text-gray-400 mb-3">Fetch missing abstracts</p>
          <Button onClick={onRefetchAbstracts} disabled={syncStatus?.status === "running"} variant="outline" size="sm" data-testid="button-refetch-abstracts">
            {syncStatus?.status === "running" && syncStatus.phase?.includes("abstract") ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Fetching...</>) : "Refetch"}
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
          <div className="flex gap-4 text-xs text-blue-700 dark:text-blue-300">
            <span>Imported: {syncStatus.imported}</span>
            <span>Skipped: {syncStatus.skipped}</span>
            <span>Approved: {syncStatus.approved}</span>
            <span>Pending: {syncStatus.pending}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function BatchCategorizationSection({ status, onStart }: {
  status: BatchCategorizationStatus | null;
  onStart: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#6e6e73] dark:text-gray-400">Use GPT-5 nano to automatically generate category suggestions. High-confidence suggestions (≥80%) are auto-approved.</p>
      <Button onClick={onStart} disabled={status?.status === "running"} variant="outline" data-testid="button-batch-categorize">
        {status?.status === "running" ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Categorizing...</>) : (<><Sparkles className="mr-2 h-4 w-4" />Bulk Generate Categories</>)}
      </Button>
      {status?.status === "running" && (
        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-purple-600 dark:text-purple-400" />
              <span className="font-medium text-sm text-purple-900 dark:text-purple-100">{status.phase}</span>
            </div>
            <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
              {status.total > 0 ? ((status.processed / status.total) * 100).toFixed(1) : 0}%
            </span>
          </div>
          <Progress value={status.total > 0 ? (status.processed / status.total) * 100 : 0} className="h-2 mb-2" />
          <div className="flex gap-4 text-xs text-purple-700 dark:text-purple-300">
            <span>✓ Success: {status.success}</span>
            <span>⊘ Skipped: {status.skipped}</span>
            <span>✗ Failed: {status.failed}</span>
          </div>
          {status.currentPublication && <p className="mt-2 text-xs text-purple-600 dark:text-purple-400 truncate">Current: {status.currentPublication}</p>}
        </div>
      )}
    </div>
  );
}

function StatisticsSection({ stats }: { stats: { pending: number; approved: number; rejected: number } }) {
  const total = stats.pending + stats.approved + stats.rejected;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="p-4 border rounded-lg text-center">
        <p className="text-3xl font-semibold text-[#1d1d1f] dark:text-white">{total.toLocaleString()}</p>
        <p className="text-sm text-[#6e6e73] dark:text-gray-400">Total Publications</p>
      </div>
      <div className="p-4 border rounded-lg text-center">
        <p className="text-3xl font-semibold text-green-600">{stats.approved.toLocaleString()}</p>
        <p className="text-sm text-[#6e6e73] dark:text-gray-400">Approved</p>
      </div>
      <div className="p-4 border rounded-lg text-center">
        <p className="text-3xl font-semibold text-amber-600">{stats.pending.toLocaleString()}</p>
        <p className="text-sm text-[#6e6e73] dark:text-gray-400">Pending</p>
      </div>
      <div className="p-4 border rounded-lg text-center">
        <p className="text-3xl font-semibold text-red-600">{stats.rejected.toLocaleString()}</p>
        <p className="text-sm text-[#6e6e73] dark:text-gray-400">Rejected</p>
      </div>
    </div>
  );
}

function PmcReviewSection() {
  const [syncSourceFilter, setSyncSourceFilter] = useState<string>('pmc-metadata-only');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(10);
  const { toast } = useToast();

  const offset = (currentPage - 1) * perPage;

  const { data: publicationsData, isLoading, refetch } = useQuery<{
    success: boolean;
    publications: PmcPublicationWithEvidence[];
    total: number;
    totalPages: number;
    sourceCounts: Record<string, number>;
  }>({
    queryKey: ['/api/admin/publications/by-sync-source', { source: syncSourceFilter, limit: perPage, offset }],
    queryFn: async () => {
      const response = await fetch(`/api/admin/publications/by-sync-source?source=${syncSourceFilter}&limit=${perPage}&offset=${offset}`);
      if (!response.ok) throw new Error('Failed to fetch publications');
      return response.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (publicationId: string) => {
      return await apiRequest("POST", `/api/admin/publications/${publicationId}/approve`);
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      toast({ title: "Publication Approved", description: "The publication is now visible on the website." });
    },
    onError: (error: any) => {
      toast({ title: "Approval Failed", description: error.message || "Failed to approve publication", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (publicationId: string) => {
      return await apiRequest("POST", `/api/admin/publications/${publicationId}/reject`);
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      toast({ title: "Publication Rejected", description: "The publication has been rejected." });
    },
    onError: (error: any) => {
      toast({ title: "Rejection Failed", description: error.message || "Failed to reject publication", variant: "destructive" });
    },
  });

  const getKeywordEvidenceBadges = (pub: PmcPublicationWithEvidence) => {
    const evidence = pub.keywordEvidence;
    if (!evidence) return null;
    const badges = [];
    if (evidence.inTitle) badges.push(<Badge key="title" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Title</Badge>);
    if (evidence.inAbstract) badges.push(<Badge key="abstract" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Abstract</Badge>);
    if (evidence.inBody) badges.push(<Badge key="body" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">Body</Badge>);
    if (evidence.referenceOnly) badges.push(<Badge key="reference" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Reference-Only</Badge>);
    return badges.length > 0 ? badges : null;
  };

  const getSyncSourceBadge = (syncSource: string | null) => {
    switch (syncSource) {
      case 'pmc-body-match': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Body Match</Badge>;
      case 'pmc-metadata-only': return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Metadata Only</Badge>;
      case 'pubmed-sync': return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">PubMed Sync</Badge>;
      case 'manual': return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">Manual</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">Unknown</Badge>;
    }
  };

  const publications = publicationsData?.publications || [];
  const sourceCounts = publicationsData?.sourceCounts || {};

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Label htmlFor="sync-source-filter" className="text-sm">Filter by Source:</Label>
          <Select value={syncSourceFilter} onValueChange={(value) => { setSyncSourceFilter(value); setCurrentPage(1); }}>
            <SelectTrigger id="sync-source-filter" className="w-[220px]" data-testid="select-sync-source-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pmc-metadata-only">Metadata Only ({sourceCounts['pmc-metadata-only'] || 0})</SelectItem>
              <SelectItem value="pmc-body-match">Body Match ({sourceCounts['pmc-body-match'] || 0})</SelectItem>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="pubmed-sync">PubMed Sync ({sourceCounts['pubmed-sync'] || 0})</SelectItem>
              <SelectItem value="unknown">Unknown ({sourceCounts['unknown'] || 0})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(sourceCounts).map(([source, count]) => (
            <Badge key={source} variant="outline" className="text-xs">{source}: {count}</Badge>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#0071e3]" /></div>
      ) : publications.length === 0 ? (
        <p className="text-sm text-[#6e6e73] dark:text-gray-400 py-4">No publications found for this filter.</p>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#6e6e73] dark:text-gray-400">Publication</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#6e6e73] dark:text-gray-400">Source</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#6e6e73] dark:text-gray-400">Evidence</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#6e6e73] dark:text-gray-400">Status</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-[#6e6e73] dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {publications.map((pub) => (
                  <tr key={pub.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30" data-testid={`row-pmc-review-${pub.id}`}>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="text-sm font-medium line-clamp-2">{pub.title}</div>
                        <div className="text-xs text-[#6e6e73] dark:text-gray-400 line-clamp-1">{pub.authors}</div>
                        <div className="text-xs text-[#6e6e73] dark:text-gray-400">{pub.journal} • {new Date(pub.publicationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getSyncSourceBadge(pub.syncSource)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">{getKeywordEvidenceBadges(pub) || <span className="text-xs text-[#6e6e73] dark:text-gray-400">No evidence data</span>}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={pub.status === 'approved' ? 'default' : pub.status === 'rejected' ? 'destructive' : 'secondary'}>{pub.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => pub.pubmedUrl && window.open(pub.pubmedUrl, '_blank')} className="h-8 w-8 p-0" title="View on PubMed" data-testid={`button-view-pmc-${pub.id}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        {pub.status !== 'approved' && (
                          <Button size="sm" variant="default" onClick={() => approveMutation.mutate(pub.id)} disabled={approveMutation.isPending} className="h-8 bg-green-600 hover:bg-green-700 text-white" data-testid={`button-approve-pmc-${pub.id}`}>
                            <Check className="h-4 w-4 mr-1" />Approve
                          </Button>
                        )}
                        {pub.status !== 'rejected' && (
                          <Button size="sm" variant="outline" onClick={() => rejectMutation.mutate(pub.id)} disabled={rejectMutation.isPending} className="h-8" data-testid={`button-reject-pmc-${pub.id}`}>
                            <X className="h-4 w-4 mr-1" />Reject
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#6e6e73] dark:text-gray-400">Showing {publications.length} of {publicationsData?.total || 0} publications</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} data-testid="button-prev-page-pmc">Previous</Button>
              <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= (publicationsData?.totalPages || 1)} data-testid="button-next-page-pmc">Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Admin() {
  const [mainTab, setMainTab] = useState<"operations" | "review" | "catalog">("operations");
  const [catalogTab, setCatalogTab] = useState<"pending" | "approved" | "rejected" | "featured" | "category-review">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPublication, setEditingPublication] = useState<Publication | null>(null);
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [editSuggestedCategories, setEditSuggestedCategories] = useState<string[]>([]);
  const [selectedPublications, setSelectedPublications] = useState<Set<string>>(new Set());
  const [bulkGenerateDialogOpen, setBulkGenerateDialogOpen] = useState(false);
  const [bulkGenerateUseML, setBulkGenerateUseML] = useState(true);
  const [batchCategorizeDialogOpen, setBatchCategorizeDialogOpen] = useState(false);
  const [batchCategorizeFilter, setBatchCategorizeFilter] = useState<"all" | "uncategorized" | "pending" | "approved">("uncategorized");
  const [columnResizeMode] = useState<ColumnResizeMode>("onEnd");
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [batchCategorizationStatus, setBatchCategorizationStatus] = useState<BatchCategorizationStatus | null>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const completionTimeout = useRef<NodeJS.Timeout | null>(null);
  const batchCategorizationPollingInterval = useRef<NodeJS.Timeout | null>(null);
  const batchCategorizationCompletionTimeout = useRef<NodeJS.Timeout | null>(null);
  const debouncedSearch = useDebounce(searchQuery, 400);
  const { toast } = useToast();

  useEffect(() => { setCurrentPage(1); }, [catalogTab, debouncedSearch]);

  const offset = (currentPage - 1) * perPage;
  const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';
  const queryUrl = catalogTab === "featured"
    ? `/api/admin/publications-list/featured?limit=${perPage}&offset=${offset}${searchParam}`
    : catalogTab === "category-review"
    ? `/api/admin/publications/needing-review?limit=${perPage}&offset=${offset}${searchParam}`
    : `/api/admin/publications/${catalogTab}?limit=${perPage}&offset=${offset}${searchParam}`;

  const queryKey = catalogTab === "featured"
    ? ['/api/admin/publications-list/featured', { limit: perPage, offset, search: debouncedSearch }]
    : catalogTab === "category-review"
    ? ['/api/admin/publications/needing-review', { limit: perPage, offset, search: debouncedSearch }]
    : ['/api/admin/publications', catalogTab, { limit: perPage, offset, search: debouncedSearch }];

  const { data: publicationsData, isLoading } = useQuery<{ success: boolean; publications: Publication[]; total: number; totalPages: number; currentPage: number }>({
    queryKey,
    queryFn: async () => {
      const response = await fetch(queryUrl);
      if (!response.ok) throw new Error('Failed to fetch publications');
      return response.json();
    },
  });

  const { data: statsData } = useQuery<{ success: boolean; stats: { totalByStatus: { pending: number; approved: number; rejected: number } } }>({
    queryKey: ["/api/publications/stats"],
  });

  const { data: categoryReviewData } = useQuery<{ success: boolean; total: number }>({
    queryKey: ['/api/admin/publications/needing-review/count'],
    queryFn: async () => {
      const response = await fetch('/api/admin/publications/needing-review?limit=1&offset=0');
      if (!response.ok) throw new Error('Failed to fetch category review count');
      const data = await response.json();
      return { success: true, total: data.total || 0 };
    },
  });

  const { data: featuredCountData } = useQuery<{ success: boolean; total: number }>({
    queryKey: ['/api/admin/publications-list/featured/count'],
    queryFn: async () => {
      const response = await fetch('/api/admin/publications-list/featured?limit=1&offset=0');
      if (!response.ok) throw new Error('Failed to fetch featured count');
      const data = await response.json();
      return { success: true, total: data.total || 0 };
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (publicationId: string) => await apiRequest("POST", `/api/admin/publications/${publicationId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications-list/featured"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/featured"] });
      toast({ title: "Publication Approved", description: "The publication is now visible on the website." });
    },
    onError: (error: any) => { toast({ title: "Approval Failed", description: error.message || "Failed to approve publication", variant: "destructive" }); },
  });

  const rejectMutation = useMutation({
    mutationFn: async (publicationId: string) => await apiRequest("POST", `/api/admin/publications/${publicationId}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications-list/featured"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/featured"] });
      toast({ title: "Publication Rejected", description: "The publication has been rejected." });
    },
    onError: (error: any) => { toast({ title: "Rejection Failed", description: error.message || "Failed to reject publication", variant: "destructive" }); },
  });

  const updateCategoriesMutation = useMutation({
    mutationFn: async ({ id, categories }: { id: string; categories: string[] }) => await apiRequest("PATCH", `/api/admin/publications/${id}/categories`, { categories }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications-list/featured"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
      setEditDialogOpen(false);
      setEditingPublication(null);
      toast({ title: "Publication Updated", description: "Categories updated successfully." });
    },
    onError: (error: any) => { toast({ title: "Update Failed", description: error.message || "Failed to update publication", variant: "destructive" }); },
  });

  const changeStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "pending" | "approved" | "rejected" }) => await apiRequest("PATCH", `/api/admin/publications/${id}/status`, { status }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications-list/featured"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/featured"] });
      const msgs = { pending: { title: "Moved to Pending", description: "Publication moved to pending review." }, approved: { title: "Publication Approved", description: "Publication is now visible." }, rejected: { title: "Publication Rejected", description: "Publication has been rejected." } };
      toast(msgs[variables.status]);
    },
    onError: (error: any) => { toast({ title: "Status Change Failed", description: error.message || "Failed to change status", variant: "destructive" }); },
  });

  const toggleFeaturedMutation = useMutation({
    mutationFn: async (publicationId: string) => await apiRequest("PATCH", `/api/publications/${publicationId}/featured`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications-list/featured"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications-list/featured/count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/featured"] });
      toast({ title: "Featured Status Updated", description: "The publication's featured status has been toggled." });
    },
    onError: (error: any) => { toast({ title: "Toggle Failed", description: error.message || "Failed to toggle featured status", variant: "destructive" }); },
  });

  const generateSuggestionsMutation = useMutation({
    mutationFn: async ({ id, useML = true }: { id: string; useML?: boolean }) => await apiRequest("POST", `/api/admin/publications/${id}/generate-suggestions`, { useML }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/needing-review"] });
      toast({ title: "Suggestions Generated", description: "Category suggestions have been generated for this publication." });
    },
    onError: (error: any) => { toast({ title: "Generation Failed", description: error.message || "Failed to generate suggestions", variant: "destructive" }); },
  });

  const approveCategoriesMutation = useMutation({
    mutationFn: async ({ id, categories }: { id: string; categories: string[] }) => await apiRequest("POST", `/api/admin/publications/${id}/approve-categories`, { categories, reviewerName: 'admin' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/needing-review"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
      setEditDialogOpen(false);
      setSelectedPublications(new Set());
      toast({ title: "Categories Approved", description: "Selected categories have been approved." });
    },
    onError: (error: any) => { toast({ title: "Approval Failed", description: error.message || "Failed to approve categories", variant: "destructive" }); },
  });

  const rejectSuggestionsMutation = useMutation({
    mutationFn: async (id: string) => await apiRequest("POST", `/api/admin/publications/${id}/reject-suggestions`, { reviewerName: 'admin' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/needing-review"] });
      setSelectedPublications(new Set());
      toast({ title: "Suggestions Rejected", description: "Category suggestions have been rejected." });
    },
    onError: (error: any) => { toast({ title: "Rejection Failed", description: error.message || "Failed to reject suggestions", variant: "destructive" }); },
  });

  const batchGenerateSuggestionsMutation = useMutation({
    mutationFn: async ({ publicationIds, useML = true }: { publicationIds: string[]; useML?: boolean }) => await apiRequest("POST", "/api/admin/publications/batch-generate-suggestions", { publicationIds, useML }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/needing-review"] });
      setBulkGenerateDialogOpen(false);
      setSelectedPublications(new Set());
      toast({ title: "Bulk Generation Complete", description: "Category suggestions have been generated for selected publications." });
    },
    onError: (error: any) => { toast({ title: "Bulk Generation Failed", description: error.message || "Failed to generate suggestions", variant: "destructive" }); },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (publicationIds: string[]) => {
      const promises = publicationIds.map(id => {
        const pub = filteredPublications.find(p => p.id === id);
        if (pub?.suggestedCategories) {
          const categories = pub.suggestedCategories.map(sc => sc.category);
          return apiRequest("POST", `/api/admin/publications/${id}/approve-categories`, { categories, reviewerName: 'admin' });
        }
        return Promise.resolve();
      });
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/needing-review"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
      setSelectedPublications(new Set());
      toast({ title: "Bulk Approval Complete", description: "Category suggestions have been approved for selected publications." });
    },
    onError: (error: any) => { toast({ title: "Bulk Approval Failed", description: error.message || "Failed to approve categories", variant: "destructive" }); },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: async (publicationIds: string[]) => {
      const promises = publicationIds.map(id => apiRequest("POST", `/api/admin/publications/${id}/reject-suggestions`, { reviewerName: 'admin' }));
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/needing-review"] });
      setSelectedPublications(new Set());
      toast({ title: "Bulk Rejection Complete", description: "Category suggestions have been rejected for selected publications." });
    },
    onError: (error: any) => { toast({ title: "Bulk Rejection Failed", description: error.message || "Failed to reject suggestions", variant: "destructive" }); },
  });

  const fetchSyncStatus = async () => {
    try {
      const response = await apiRequest("GET", "/api/admin/sync-status");
      const data = await response.json();
      const newStatus: SyncStatus = { status: data.status, type: data.type, phase: data.phase, processed: data.processed, total: data.total, imported: data.imported, skipped: data.skipped, approved: data.approved, pending: data.pending, startTime: data.startTime || null, endTime: data.endTime || null, error: data.error, lastSuccessTime: data.lastSuccessTime || null };
      setSyncStatus(newStatus);
      return newStatus;
    } catch (error) { console.error("Failed to fetch sync status:", error); return null; }
  };

  useEffect(() => {
    if (syncStatus?.status === "running") {
      if (completionTimeout.current) { clearTimeout(completionTimeout.current); completionTimeout.current = null; }
      pollingInterval.current = setInterval(fetchSyncStatus, 2000);
    } else {
      if (pollingInterval.current) { clearInterval(pollingInterval.current); pollingInterval.current = null; }
      if (syncStatus?.status === "completed") {
        queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/publications-list/featured"] });
        queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
        queryClient.invalidateQueries({ queryKey: ["/api/publications/featured"] });
        toast({ title: "Sync Complete", description: `Imported ${syncStatus.imported} publications (${syncStatus.approved} approved, ${syncStatus.pending} pending)` });
        if (completionTimeout.current) { clearTimeout(completionTimeout.current); }
        completionTimeout.current = setTimeout(() => { setSyncStatus((current) => current?.status === "completed" ? null : current); }, 5000);
      } else if (syncStatus?.status === "error") {
        toast({ title: "Sync Failed", description: syncStatus.error || "An error occurred during sync", variant: "destructive" });
        if (completionTimeout.current) { clearTimeout(completionTimeout.current); completionTimeout.current = null; }
      }
    }
    return () => { if (pollingInterval.current) clearInterval(pollingInterval.current); if (completionTimeout.current) clearTimeout(completionTimeout.current); };
  }, [syncStatus?.status]);

  useEffect(() => { fetchSyncStatus(); }, []);

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
      toast({ title: "Incremental Sync Started", description: "Fetching new publications since last sync. Progress will update automatically." });
      fetchSyncStatus();
    } catch (error: any) { toast({ title: "Sync Failed", description: error.message || "Failed to start incremental sync", variant: "destructive" }); }
  };

  const handleRefetchAbstracts = async () => {
    try {
      await apiRequest("POST", "/api/admin/refetch-abstracts");
      toast({ title: "Abstract Refetch Started", description: "Fetching missing abstracts from PubMed. Progress will update automatically." });
      fetchSyncStatus();
    } catch (error: any) { toast({ title: "Refetch Failed", description: error.message || "Failed to start abstract refetch", variant: "destructive" }); }
  };

  const fetchBatchCategorizationStatus = async () => {
    try {
      const response = await apiRequest("GET", "/api/admin/batch-categorization/status");
      const data = await response.json();
      const newStatus: BatchCategorizationStatus = { status: data.status, filter: data.filter, phase: data.phase, processed: data.processed, total: data.total, success: data.success, failed: data.failed, skipped: data.skipped, currentPublication: data.currentPublication, startTime: data.startTime || null, endTime: data.endTime || null, error: data.error, etaSeconds: data.etaSeconds || null };
      setBatchCategorizationStatus(newStatus);
      return newStatus;
    } catch (error) { console.error("Failed to fetch batch categorization status:", error); return null; }
  };

  useEffect(() => {
    if (batchCategorizationStatus?.status === "running") {
      if (batchCategorizationCompletionTimeout.current) { clearTimeout(batchCategorizationCompletionTimeout.current); batchCategorizationCompletionTimeout.current = null; }
      batchCategorizationPollingInterval.current = setInterval(fetchBatchCategorizationStatus, 500);
    } else {
      if (batchCategorizationPollingInterval.current) { clearInterval(batchCategorizationPollingInterval.current); batchCategorizationPollingInterval.current = null; }
      if (batchCategorizationStatus?.status === "completed") {
        batchCategorizationCompletionTimeout.current = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/needing-review"] });
          queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/needing-review/count"] });
          queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
          toast({ title: "Batch Categorization Complete", description: `Successfully categorized ${batchCategorizationStatus.success} publications (${batchCategorizationStatus.skipped} skipped, ${batchCategorizationStatus.failed} failed)` });
        }, 1000);
      }
    }
    return () => { if (batchCategorizationPollingInterval.current) clearInterval(batchCategorizationPollingInterval.current); if (batchCategorizationCompletionTimeout.current) clearTimeout(batchCategorizationCompletionTimeout.current); };
  }, [batchCategorizationStatus?.status]);

  useEffect(() => { fetchBatchCategorizationStatus(); }, []);

  const handleStartBatchCategorization = async () => {
    try {
      await apiRequest("POST", "/api/admin/batch-categorization/start", { filter: batchCategorizeFilter });
      toast({ title: "Batch Categorization Started", description: `Generating ML-powered category suggestions. Progress will update automatically.` });
      setBatchCategorizeDialogOpen(false);
      fetchBatchCategorizationStatus();
    } catch (error: any) { toast({ title: "Batch Categorization Failed", description: error.message || "Failed to start batch categorization", variant: "destructive" }); }
  };

  const openEditDialog = (publication: Publication) => {
    setEditingPublication(publication);
    setEditCategories(publication.categories || []);
    if (publication.suggestedCategories && publication.suggestedCategories.length > 0) {
      setEditSuggestedCategories(publication.suggestedCategories.map(sc => sc.category));
    } else { setEditSuggestedCategories([]); }
    setEditDialogOpen(true);
  };

  const handleSaveCategories = () => {
    if (!editingPublication) return;
    if (catalogTab === "category-review" && editingPublication.suggestedCategories && editingPublication.suggestedCategories.length > 0) {
      approveCategoriesMutation.mutate({ id: editingPublication.id, categories: editSuggestedCategories });
    } else {
      updateCategoriesMutation.mutate({ id: editingPublication.id, categories: editCategories });
    }
  };

  const toggleCategory = (category: string) => { setEditCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]); };
  const toggleSuggestedCategory = (category: string) => { setEditSuggestedCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]); };

  const handleAcceptAllSuggestions = (publication: Publication) => {
    if (!publication.suggestedCategories || publication.suggestedCategories.length === 0) return;
    const categories = publication.suggestedCategories.map(sc => sc.category);
    approveCategoriesMutation.mutate({ id: publication.id, categories });
  };

  const handleToggleSelection = (publicationId: string) => {
    setSelectedPublications(prev => {
      const newSet = new Set(prev);
      if (newSet.has(publicationId)) newSet.delete(publicationId);
      else newSet.add(publicationId);
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedPublications.size === filteredPublications.length) setSelectedPublications(new Set());
    else setSelectedPublications(new Set(filteredPublications.map(p => p.id)));
  };

  const handleBulkGenerate = () => { batchGenerateSuggestionsMutation.mutate({ publicationIds: Array.from(selectedPublications), useML: bulkGenerateUseML }); };
  const handleBulkAccept = () => { bulkApproveMutation.mutate(Array.from(selectedPublications)); };
  const handleBulkReject = () => { bulkRejectMutation.mutate(Array.from(selectedPublications)); };

  const getConfidenceBadgeClass = (confidence: number) => confidence >= 0.8 ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : confidence >= 0.6 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  const getSourceBadgeClass = (source: 'ml' | 'keyword') => source === 'ml' ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" : "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";

  const filteredPublications = publicationsData?.publications || [];
  const stats = statsData?.stats?.totalByStatus || { pending: 0, approved: 0, rejected: 0 };

  const pendingColumns = useMemo<ColumnDef<Publication>[]>(() => [
    { accessorKey: "title", header: "Title", size: 350, minSize: 200, cell: ({ row }) => (<div className="space-y-1"><div className="text-sm" data-testid={`text-title-${row.original.id}`}>{row.original.title}</div><div className="text-xs text-[#6e6e73] dark:text-gray-400 line-clamp-1" data-testid={`text-authors-${row.original.id}`}>{row.original.authors}</div></div>) },
    { accessorKey: "journal", header: "Journal", size: 150, cell: ({ row }) => (<div className="text-sm line-clamp-2" data-testid={`text-journal-${row.original.id}`}>{row.original.journal}</div>) },
    { accessorKey: "publicationDate", header: "Date", size: 120, cell: ({ row }) => (<div className="text-sm" data-testid={`text-date-${row.original.id}`}>{new Date(row.original.publicationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</div>) },
    { accessorKey: "categories", header: "Categories", size: 100, cell: ({ row }) => (<div className="flex flex-wrap gap-1">{row.original.categories && row.original.categories.length > 0 ? row.original.categories.map((category) => (<Badge key={category} variant="secondary" className="text-xs" data-testid={`badge-category-${row.original.id}-${category}`}>{RESEARCH_AREA_DISPLAY_NAMES[category] || category}</Badge>)) : (<span className="text-xs text-[#6e6e73] dark:text-gray-400">None</span>)}</div>) },
    { id: "actions", header: "Actions", size: 200, enableResizing: false, cell: ({ row }) => (<div className="flex items-center justify-end gap-2 flex-wrap"><Button size="sm" variant="ghost" onClick={() => row.original.pubmedUrl && window.open(row.original.pubmedUrl, '_blank')} className="h-8 w-8 p-0" title="View on PubMed" data-testid={`button-view-${row.original.id}`}><ExternalLink className="h-4 w-4" /></Button><Button size="sm" variant="default" onClick={() => approveMutation.mutate(row.original.id)} disabled={approveMutation.isPending} className="h-8 bg-green-600 hover:bg-green-700 text-white" data-testid={`button-approve-${row.original.id}`}><Check className="h-4 w-4 mr-1" />Approve</Button><Button size="sm" variant="outline" onClick={() => rejectMutation.mutate(row.original.id)} disabled={rejectMutation.isPending} className="h-8" data-testid={`button-reject-${row.original.id}`}><X className="h-4 w-4 mr-1" />Reject</Button><Button size="sm" variant="outline" onClick={() => openEditDialog(row.original)} className="h-8 w-8 p-0" title="Edit Categories" data-testid={`button-edit-${row.original.id}`}><Pencil className="h-4 w-4" /></Button></div>) },
  ], [approveMutation, rejectMutation]);

  const approvedRejectedColumns = useMemo<ColumnDef<Publication>[]>(() => [
    { accessorKey: "title", header: "Title", size: 350, minSize: 200, cell: ({ row }) => (<div className="space-y-1"><div className="text-sm" data-testid={`text-title-${row.original.id}`}>{row.original.title}</div><div className="text-xs text-[#6e6e73] dark:text-gray-400 line-clamp-1" data-testid={`text-authors-${row.original.id}`}>{row.original.authors}</div></div>) },
    { accessorKey: "journal", header: "Journal", size: 150, cell: ({ row }) => (<div className="text-sm line-clamp-2" data-testid={`text-journal-${row.original.id}`}>{row.original.journal}</div>) },
    { accessorKey: "publicationDate", header: "Date", size: 120, cell: ({ row }) => (<div className="text-sm" data-testid={`text-date-${row.original.id}`}>{new Date(row.original.publicationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</div>) },
    { accessorKey: "categories", header: "Categories", size: 100, cell: ({ row }) => (<div className="flex flex-wrap gap-1">{row.original.categories && row.original.categories.length > 0 ? row.original.categories.map((category) => (<Badge key={category} variant="secondary" className="text-xs" data-testid={`badge-category-${row.original.id}-${category}`}>{RESEARCH_AREA_DISPLAY_NAMES[category] || category}</Badge>)) : (<span className="text-xs text-[#6e6e73] dark:text-gray-400">None</span>)}</div>) },
    { id: "featured", header: "Featured", size: 80, cell: ({ row }) => (<Button size="sm" variant="ghost" onClick={() => toggleFeaturedMutation.mutate(row.original.id)} disabled={toggleFeaturedMutation.isPending} className={`h-8 w-8 p-0 ${row.original.isFeatured ? "text-yellow-500" : "text-gray-400"}`} title={row.original.isFeatured ? "Unmark Featured" : "Mark Featured"} data-testid={`button-featured-${row.original.id}`}><Star className="h-4 w-4" fill={row.original.isFeatured ? "currentColor" : "none"} /></Button>) },
    { id: "actions", header: "Actions", size: 160, enableResizing: false, cell: ({ row }) => (<div className="flex items-center justify-end gap-2 flex-wrap"><Button size="sm" variant="ghost" onClick={() => row.original.pubmedUrl && window.open(row.original.pubmedUrl, '_blank')} className="h-8 w-8 p-0" title="View on PubMed" data-testid={`button-view-${row.original.id}`}><ExternalLink className="h-4 w-4" /></Button><Button size="sm" variant="outline" onClick={() => openEditDialog(row.original)} className="h-8 w-8 p-0" title="Edit Categories" data-testid={`button-edit-${row.original.id}`}><Pencil className="h-4 w-4" /></Button><Select value={row.original.status} onValueChange={(status: "pending" | "approved" | "rejected") => changeStatusMutation.mutate({ id: row.original.id, status })}><SelectTrigger className="h-8 w-28" data-testid={`select-status-${row.original.id}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select></div>) },
  ], [toggleFeaturedMutation, changeStatusMutation]);

  const categoryReviewColumns = useMemo<ColumnDef<Publication>[]>(() => [
    { id: "select", header: () => (<Checkbox checked={selectedPublications.size === filteredPublications.length && filteredPublications.length > 0} onCheckedChange={handleSelectAll} data-testid="checkbox-select-all" />), size: 40, enableResizing: false, cell: ({ row }) => (<Checkbox checked={selectedPublications.has(row.original.id)} onCheckedChange={() => handleToggleSelection(row.original.id)} data-testid={`checkbox-select-${row.original.id}`} />) },
    { accessorKey: "title", header: "Title", size: 300, minSize: 200, cell: ({ row }) => (<div className="space-y-1"><div className="text-sm" data-testid={`text-title-${row.original.id}`}>{row.original.title}</div><div className="text-xs text-[#6e6e73] dark:text-gray-400 line-clamp-1" data-testid={`text-authors-${row.original.id}`}>{row.original.authors}</div></div>) },
    { accessorKey: "suggestedCategories", header: "Suggestions", size: 300, cell: ({ row }) => (<div className="flex flex-wrap gap-1">{row.original.suggestedCategories && row.original.suggestedCategories.length > 0 ? row.original.suggestedCategories.map((suggestion) => (<Badge key={suggestion.category} className={`text-xs ${getConfidenceBadgeClass(suggestion.confidence)}`} data-testid={`badge-suggestion-${row.original.id}-${suggestion.category}`}>{RESEARCH_AREA_DISPLAY_NAMES[suggestion.category] || suggestion.category} ({Math.round(suggestion.confidence * 100)}%)</Badge>)) : (<span className="text-xs text-[#6e6e73] dark:text-gray-400">No suggestions</span>)}</div>) },
    { id: "actions", header: "Actions", size: 280, enableResizing: false, cell: ({ row }) => (<div className="flex items-center justify-end gap-2 flex-wrap"><Button size="sm" variant="ghost" onClick={() => row.original.pubmedUrl && window.open(row.original.pubmedUrl, '_blank')} className="h-8 w-8 p-0" title="View on PubMed" data-testid={`button-view-${row.original.id}`}><ExternalLink className="h-4 w-4" /></Button><Button size="sm" variant="default" onClick={() => handleAcceptAllSuggestions(row.original)} disabled={approveCategoriesMutation.isPending || !row.original.suggestedCategories || row.original.suggestedCategories.length === 0} className="h-8 bg-green-600 hover:bg-green-700 text-white" data-testid={`button-accept-${row.original.id}`}><CheckCheck className="h-4 w-4 mr-1" />Accept</Button><Button size="sm" variant="outline" onClick={() => openEditDialog(row.original)} disabled={!row.original.suggestedCategories || row.original.suggestedCategories.length === 0} className="h-8" data-testid={`button-edit-approve-${row.original.id}`}><Pencil className="h-4 w-4 mr-1" />Edit & Approve</Button><Button size="sm" variant="outline" onClick={() => rejectSuggestionsMutation.mutate(row.original.id)} disabled={rejectSuggestionsMutation.isPending} className="h-8" data-testid={`button-reject-suggestions-${row.original.id}`}><X className="h-4 w-4 mr-1" />Reject</Button></div>) },
  ], [selectedPublications, filteredPublications, approveCategoriesMutation, rejectSuggestionsMutation]);

  const pendingTable = useReactTable({ data: filteredPublications, columns: pendingColumns, getCoreRowModel: getCoreRowModel(), columnResizeMode, enableColumnResizing: true });
  const approvedRejectedTable = useReactTable({ data: filteredPublications, columns: approvedRejectedColumns, getCoreRowModel: getCoreRowModel(), columnResizeMode, enableColumnResizing: true });
  const categoryReviewTable = useReactTable({ data: filteredPublications, columns: categoryReviewColumns, getCoreRowModel: getCoreRowModel(), columnResizeMode, enableColumnResizing: true });

  const renderTable = (table: ReturnType<typeof useReactTable<Publication>>) => (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ tableLayout: 'fixed', width: table.getTotalSize() }}>
        <thead className="border-b">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="h-12 px-4 text-left align-middle font-medium text-muted-foreground relative group" style={{ width: header.getSize() }}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getCanResize() && (<div onMouseDown={header.getResizeHandler()} onTouchStart={header.getResizeHandler()} className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none ${header.column.getIsResizing() ? 'bg-[#007AFF] w-1' : 'bg-transparent group-hover:bg-gray-300 dark:group-hover:bg-gray-600'}`} />)}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b transition-colors hover:bg-muted/50" data-testid={`row-publication-${row.original.id}`}>
              {row.getVisibleCells().map((cell) => (<td key={cell.id} className="p-4 align-middle" style={{ width: cell.column.getSize() }}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-black">
      <Navigation />
      <main className="max-w-[1600px] mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-[#1d1d1f] dark:text-white mb-3">Publication Admin</h1>
          <p className="text-lg text-[#6e6e73] dark:text-gray-400">Manage publications, sync data, and review content</p>
        </div>

        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "operations" | "review" | "catalog")} data-testid="tabs-main">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="operations" data-testid="tab-operations"><Settings className="h-4 w-4 mr-2" />Operations</TabsTrigger>
            <TabsTrigger value="review" data-testid="tab-review"><FileText className="h-4 w-4 mr-2" />Review</TabsTrigger>
            <TabsTrigger value="catalog" data-testid="tab-catalog"><Database className="h-4 w-4 mr-2" />Catalog</TabsTrigger>
          </TabsList>

          <TabsContent value="operations" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />Backup & Restore</CardTitle><CardDescription>Create backups and restore your publication database</CardDescription></CardHeader>
                <CardContent><BackupRestoreSection /></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5" />PubMed Sync</CardTitle><CardDescription>Sync publications from PubMed Central</CardDescription></CardHeader>
                <CardContent><PubMedSyncSection syncStatus={syncStatus} onFullSync={handleFullSync} onIncrementalSync={handleIncrementalSync} onRefetchAbstracts={handleRefetchAbstracts} /></CardContent>
              </Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />Batch Categorization</CardTitle><CardDescription>Generate ML-powered category suggestions</CardDescription></CardHeader>
                <CardContent><BatchCategorizationSection status={batchCategorizationStatus} onStart={() => setBatchCategorizeDialogOpen(true)} /></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Statistics</CardTitle><CardDescription>Publication counts and status breakdown</CardDescription></CardHeader>
                <CardContent><StatisticsSection stats={stats} /></CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="review">
            <Card>
              <CardHeader><CardTitle>PMC Review</CardTitle><CardDescription>Review publications by sync source and keyword evidence. Articles requiring review are shown by default.</CardDescription></CardHeader>
              <CardContent><PmcReviewSection /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="catalog">
            <Card className="mb-6">
              <CardHeader className="pb-3"><CardTitle>Search Publications</CardTitle><CardDescription>Filter publications by title, author, or journal</CardDescription></CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#6e6e73] h-4 w-4" />
                  <Input type="text" placeholder="Search by title, author, or journal..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" data-testid="input-search-publications" />
                </div>
                {debouncedSearch && publicationsData && (<p className="mt-2 text-sm text-[#6e6e73] dark:text-gray-400">Found {publicationsData.total} publication{publicationsData.total !== 1 ? 's' : ''} matching "{debouncedSearch}"</p>)}
              </CardContent>
            </Card>

            <Card>
              <Tabs value={catalogTab} onValueChange={(v) => setCatalogTab(v as typeof catalogTab)} data-testid="tabs-catalog">
                <CardHeader className="pb-3">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="pending" data-testid="tab-pending">Pending ({stats.pending || 0})</TabsTrigger>
                    <TabsTrigger value="approved" data-testid="tab-approved">Approved ({stats.approved || 0})</TabsTrigger>
                    <TabsTrigger value="rejected" data-testid="tab-rejected">Rejected ({stats.rejected || 0})</TabsTrigger>
                    <TabsTrigger value="featured" data-testid="tab-featured">Featured ({featuredCountData?.total || 0})</TabsTrigger>
                    <TabsTrigger value="category-review" data-testid="tab-category-review">Category Review ({categoryReviewData?.total || 0})</TabsTrigger>
                  </TabsList>
                </CardHeader>

                <TabsContent value="pending" className="mt-0">
                  <CardContent className="p-0">
                    {isLoading ? (<div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#0071e3]" /></div>) : filteredPublications.length === 0 ? (<div className="py-16 text-center"><p className="text-[#6e6e73] dark:text-gray-400">{debouncedSearch ? "No publications match your search" : "No pending publications"}</p></div>) : (<>{renderTable(pendingTable)}<div className="p-4 border-t"><PaginationControls total={publicationsData?.total || 0} currentPage={currentPage} perPage={perPage} onPageChange={setCurrentPage} onPerPageChange={setPerPage} /></div></>)}
                  </CardContent>
                </TabsContent>

                <TabsContent value="approved" className="mt-0">
                  <CardContent className="p-0">
                    {isLoading ? (<div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#0071e3]" /></div>) : filteredPublications.length === 0 ? (<div className="py-16 text-center"><p className="text-[#6e6e73] dark:text-gray-400">{debouncedSearch ? "No publications match your search" : "No approved publications"}</p></div>) : (<>{renderTable(approvedRejectedTable)}<div className="p-4 border-t"><PaginationControls total={publicationsData?.total || 0} currentPage={currentPage} perPage={perPage} onPageChange={setCurrentPage} onPerPageChange={setPerPage} /></div></>)}
                  </CardContent>
                </TabsContent>

                <TabsContent value="rejected" className="mt-0">
                  <CardContent className="p-0">
                    {isLoading ? (<div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#0071e3]" /></div>) : filteredPublications.length === 0 ? (<div className="py-16 text-center"><p className="text-[#6e6e73] dark:text-gray-400">{debouncedSearch ? "No publications match your search" : "No rejected publications"}</p></div>) : (<>{renderTable(approvedRejectedTable)}<div className="p-4 border-t"><PaginationControls total={publicationsData?.total || 0} currentPage={currentPage} perPage={perPage} onPageChange={setCurrentPage} onPerPageChange={setPerPage} /></div></>)}
                  </CardContent>
                </TabsContent>

                <TabsContent value="featured" className="mt-0">
                  <CardContent className="p-0">
                    {isLoading ? (<div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#0071e3]" /></div>) : filteredPublications.length === 0 ? (<div className="py-16 text-center"><p className="text-[#6e6e73] dark:text-gray-400">{debouncedSearch ? "No publications match your search" : "No featured publications"}</p></div>) : (<>{renderTable(approvedRejectedTable)}<div className="p-4 border-t"><PaginationControls total={publicationsData?.total || 0} currentPage={currentPage} perPage={perPage} onPageChange={setCurrentPage} onPerPageChange={setPerPage} /></div></>)}
                  </CardContent>
                </TabsContent>

                <TabsContent value="category-review" className="mt-0">
                  <CardContent className="p-0">
                    {selectedPublications.size > 0 && (
                      <div className="p-4 border-b bg-[#f5f5f7] dark:bg-gray-900">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm font-medium text-[#1d1d1f] dark:text-white">{selectedPublications.size} selected</span>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setBulkGenerateDialogOpen(true)} disabled={batchGenerateSuggestionsMutation.isPending} data-testid="button-bulk-generate"><Sparkles className="h-4 w-4 mr-1" />Bulk Generate Suggestions</Button>
                            <Button size="sm" variant="default" onClick={handleBulkAccept} disabled={bulkApproveMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white" data-testid="button-bulk-accept"><CheckCheck className="h-4 w-4 mr-1" />Accept All</Button>
                            <Button size="sm" variant="outline" onClick={handleBulkReject} disabled={bulkRejectMutation.isPending} data-testid="button-bulk-reject"><X className="h-4 w-4 mr-1" />Reject All</Button>
                          </div>
                        </div>
                      </div>
                    )}
                    {isLoading ? (<div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#0071e3]" /></div>) : filteredPublications.length === 0 ? (<div className="py-16 text-center"><p className="text-[#6e6e73] dark:text-gray-400">{debouncedSearch ? "No publications match your search" : "No publications need category review"}</p></div>) : (<>{renderTable(categoryReviewTable)}<div className="p-4 border-t"><PaginationControls total={publicationsData?.total || 0} currentPage={currentPage} perPage={perPage} onPageChange={setCurrentPage} onPerPageChange={setPerPage} /></div></>)}
                  </CardContent>
                </TabsContent>
              </Tabs>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{catalogTab === "category-review" && editingPublication?.suggestedCategories && editingPublication.suggestedCategories.length > 0 ? "Edit & Approve Categories" : "Edit Categories"}</DialogTitle>
            <DialogDescription>{catalogTab === "category-review" && editingPublication?.suggestedCategories && editingPublication.suggestedCategories.length > 0 ? "Select suggested categories to approve, or add additional ones" : "Select the research areas that apply to this publication"}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {catalogTab === "category-review" && editingPublication?.suggestedCategories && editingPublication.suggestedCategories.length > 0 ? (
              <>
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-[#1d1d1f] dark:text-white">Suggested Categories</h3>
                  {editingPublication.suggestedCategories.map((suggestion) => (
                    <div key={suggestion.category} className="flex items-center space-x-2">
                      <Checkbox id={`suggested-${suggestion.category}`} checked={editSuggestedCategories.includes(suggestion.category)} onCheckedChange={() => toggleSuggestedCategory(suggestion.category)} data-testid={`checkbox-suggested-${suggestion.category}`} />
                      <Label htmlFor={`suggested-${suggestion.category}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2">
                        {RESEARCH_AREA_DISPLAY_NAMES[suggestion.category]}
                        <Badge className={`text-xs ${getConfidenceBadgeClass(suggestion.confidence)}`}>{Math.round(suggestion.confidence * 100)}%</Badge>
                        <Badge className={`text-xs ${getSourceBadgeClass(suggestion.source)}`}>{suggestion.source === 'ml' ? 'ML' : 'Keyword'}</Badge>
                      </Label>
                    </div>
                  ))}
                </div>
                <div className="space-y-3 pt-4 border-t">
                  <h3 className="font-medium text-sm text-[#1d1d1f] dark:text-white">Add Other Categories</h3>
                  {RESEARCH_AREAS.filter(area => !editingPublication.suggestedCategories?.some(sc => sc.category === area)).map((area) => (
                    <div key={area} className="flex items-center space-x-2">
                      <Checkbox id={`additional-${area}`} checked={editSuggestedCategories.includes(area)} onCheckedChange={() => toggleSuggestedCategory(area)} data-testid={`checkbox-additional-${area}`} />
                      <Label htmlFor={`additional-${area}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">{RESEARCH_AREA_DISPLAY_NAMES[area]}</Label>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                {RESEARCH_AREAS.map((area) => (
                  <div key={area} className="flex items-center space-x-2">
                    <Checkbox id={area} checked={editCategories.includes(area)} onCheckedChange={() => toggleCategory(area)} data-testid={`checkbox-category-${area}`} />
                    <Label htmlFor={area} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">{RESEARCH_AREA_DISPLAY_NAMES[area]}</Label>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} data-testid="button-cancel-edit">Cancel</Button>
            <Button onClick={handleSaveCategories} disabled={updateCategoriesMutation.isPending || approveCategoriesMutation.isPending} data-testid="button-save-categories">
              {(updateCategoriesMutation.isPending || approveCategoriesMutation.isPending) ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : (catalogTab === "category-review" && editingPublication?.suggestedCategories && editingPublication.suggestedCategories.length > 0 ? "Approve Selected" : "Save Changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkGenerateDialogOpen} onOpenChange={setBulkGenerateDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader><DialogTitle>Bulk Generate Suggestions</DialogTitle><DialogDescription>Generate category suggestions for {selectedPublications.size} selected publication{selectedPublications.size !== 1 ? 's' : ''}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="use-ml" checked={bulkGenerateUseML} onCheckedChange={(checked) => setBulkGenerateUseML(checked as boolean)} data-testid="checkbox-use-ml" />
              <Label htmlFor="use-ml" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">Use ML-based suggestions (recommended)</Label>
            </div>
            <p className="text-sm text-[#6e6e73] dark:text-gray-400">{bulkGenerateUseML ? "ML-based suggestions use advanced models to analyze publication content and provide high-confidence category recommendations." : "Keyword-based suggestions use simple keyword matching from publication titles and abstracts."}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkGenerateDialogOpen(false)} data-testid="button-cancel-bulk-generate">Cancel</Button>
            <Button onClick={handleBulkGenerate} disabled={batchGenerateSuggestionsMutation.isPending} data-testid="button-confirm-bulk-generate">{batchGenerateSuggestionsMutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>) : "Generate Suggestions"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchCategorizeDialogOpen} onOpenChange={setBatchCategorizeDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Bulk Generate Categories</DialogTitle><DialogDescription>Use GPT-5 nano to generate ML-powered category suggestions for publications</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="filter-select">Select Publications</Label>
              <Select value={batchCategorizeFilter} onValueChange={(value: "all" | "uncategorized" | "pending" | "approved") => setBatchCategorizeFilter(value)}>
                <SelectTrigger id="filter-select" data-testid="select-batch-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="uncategorized">Uncategorized Only (Approved publications with no categories)</SelectItem>
                  <SelectItem value="approved">All Approved Publications</SelectItem>
                  <SelectItem value="pending">Pending Publications</SelectItem>
                  <SelectItem value="all">All Publications (Pending + Approved)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100"><strong>How it works:</strong> GPT-5 nano analyzes each publication's title and abstract to suggest relevant research areas. High-confidence suggestions (≥80%) are auto-approved, while lower confidence suggestions are flagged for manual review in the Category Review tab.</p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-900 dark:text-amber-100"><strong>Cost:</strong> ~$0.13 for all 2,911 publications using GPT-5 nano ($0.05/1M input, $0.40/1M output tokens)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchCategorizeDialogOpen(false)} data-testid="button-cancel-batch-categorize">Cancel</Button>
            <Button onClick={handleStartBatchCategorization} data-testid="button-confirm-batch-categorize"><Sparkles className="mr-2 h-4 w-4" />Start Categorization</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
import { Search, Check, X, ExternalLink, Loader2, Pencil, Star, Sparkles, CheckCheck } from "lucide-react";
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

interface CitationUpdateStatus {
  status: "idle" | "running" | "completed" | "error";
  phase: string;
  processed: number;
  total: number;
  updated: number;
  startTime: number | null;
  endTime: number | null;
  error: string | null;
  lastSuccessTime: number | null;
}

interface AbstractRefreshStatus {
  status: "idle" | "running" | "completed" | "error";
  phase: string;
  processed: number;
  total: number;
  updated: number;
  failed: number;
  startTime: number | null;
  endTime: number | null;
  error: string | null;
  lastSuccessTime: number | null;
}

export default function Admin() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected" | "featured" | "category-review">("pending");
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

  // Reset to page 1 when tab or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, debouncedSearch]);

  const offset = (currentPage - 1) * perPage;
  
  // Build query URLs with search parameter
  const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';
  const queryUrl = activeTab === "featured" 
    ? `/api/admin/publications-list/featured?limit=${perPage}&offset=${offset}${searchParam}`
    : activeTab === "category-review"
    ? `/api/admin/publications/needing-review?limit=${perPage}&offset=${offset}${searchParam}`
    : `/api/admin/publications/${activeTab}?limit=${perPage}&offset=${offset}${searchParam}`;

  // Include search in query key for proper caching
  const queryKey = activeTab === "featured"
    ? ['/api/admin/publications-list/featured', { limit: perPage, offset, search: debouncedSearch }]
    : activeTab === "category-review"
    ? ['/api/admin/publications/needing-review', { limit: perPage, offset, search: debouncedSearch }]
    : ['/api/admin/publications', activeTab, { limit: perPage, offset, search: debouncedSearch }];

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

  // Query for category review count
  const { data: categoryReviewData } = useQuery<{ success: boolean; total: number }>({
    queryKey: ['/api/admin/publications/needing-review/count'],
    queryFn: async () => {
      const response = await fetch('/api/admin/publications/needing-review?limit=1&offset=0');
      if (!response.ok) throw new Error('Failed to fetch category review count');
      const data = await response.json();
      return { success: true, total: data.total || 0 };
    },
  });

  // Query for featured publications count
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
    mutationFn: async (publicationId: string) => {
      return await apiRequest("POST", `/api/admin/publications/${publicationId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications-list/featured"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/featured"] });
      toast({
        title: "Publication Approved",
        description: "The publication is now visible on the website.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve publication",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (publicationId: string) => {
      return await apiRequest("POST", `/api/admin/publications/${publicationId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications-list/featured"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/featured"] });
      toast({
        title: "Publication Rejected",
        description: "The publication has been rejected.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Rejection Failed",
        description: error.message || "Failed to reject publication",
        variant: "destructive",
      });
    },
  });

  const updateCategoriesMutation = useMutation({
    mutationFn: async ({ id, categories }: { id: string; categories: string[] }) => {
      return await apiRequest("PATCH", `/api/admin/publications/${id}/categories`, {
        categories,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications-list/featured"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/featured"] });
      setEditDialogOpen(false);
      setEditingPublication(null);
      toast({
        title: "Publication Updated",
        description: "Categories updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update publication",
        variant: "destructive",
      });
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "pending" | "approved" | "rejected" }) => {
      return await apiRequest("PATCH", `/api/admin/publications/${id}/status`, {
        status,
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications-list/featured"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/featured"] });
      const statusMessages = {
        pending: { title: "Publication Moved to Pending", description: "The publication has been moved to pending review." },
        approved: { title: "Publication Approved", description: "The publication is now visible on the website." },
        rejected: { title: "Publication Rejected", description: "The publication has been rejected." },
      };
      toast(statusMessages[variables.status]);
    },
    onError: (error: any) => {
      toast({
        title: "Status Change Failed",
        description: error.message || "Failed to change publication status",
        variant: "destructive",
      });
    },
  });

  const toggleFeaturedMutation = useMutation({
    mutationFn: async (publicationId: string) => {
      return await apiRequest("PATCH", `/api/publications/${publicationId}/featured`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications-list/featured"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications-list/featured/count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/featured"] });
      toast({
        title: "Featured Status Updated",
        description: "The publication's featured status has been toggled.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Toggle Failed",
        description: error.message || "Failed to toggle featured status",
        variant: "destructive",
      });
    },
  });

  // Category Suggestion Mutations
  const generateSuggestionsMutation = useMutation({
    mutationFn: async ({ id, useML = true }: { id: string; useML?: boolean }) => {
      return await apiRequest("POST", `/api/admin/publications/${id}/generate-suggestions`, { useML });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/needing-review"] });
      toast({
        title: "Suggestions Generated",
        description: "Category suggestions have been generated for this publication.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate suggestions",
        variant: "destructive",
      });
    },
  });

  const approveCategoriesMutation = useMutation({
    mutationFn: async ({ id, categories }: { id: string; categories: string[] }) => {
      return await apiRequest("POST", `/api/admin/publications/${id}/approve-categories`, { 
        categories, 
        reviewerName: 'admin' 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/needing-review"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
      setEditDialogOpen(false);
      setSelectedPublications(new Set());
      toast({
        title: "Categories Approved",
        description: "Selected categories have been approved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve categories",
        variant: "destructive",
      });
    },
  });

  const rejectSuggestionsMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/admin/publications/${id}/reject-suggestions`, { 
        reviewerName: 'admin' 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/needing-review"] });
      setSelectedPublications(new Set());
      toast({
        title: "Suggestions Rejected",
        description: "Category suggestions have been rejected.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Rejection Failed",
        description: error.message || "Failed to reject suggestions",
        variant: "destructive",
      });
    },
  });

  const batchGenerateSuggestionsMutation = useMutation({
    mutationFn: async ({ publicationIds, useML = true }: { publicationIds: string[]; useML?: boolean }) => {
      return await apiRequest("POST", "/api/admin/publications/batch-generate-suggestions", { 
        publicationIds, 
        useML 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/needing-review"] });
      setBulkGenerateDialogOpen(false);
      setSelectedPublications(new Set());
      toast({
        title: "Bulk Generation Complete",
        description: "Category suggestions have been generated for selected publications.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Bulk Generation Failed",
        description: error.message || "Failed to generate suggestions",
        variant: "destructive",
      });
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (publicationIds: string[]) => {
      const promises = publicationIds.map(id => {
        const pub = filteredPublications.find(p => p.id === id);
        if (pub?.suggestedCategories) {
          const categories = pub.suggestedCategories.map(sc => sc.category);
          return apiRequest("POST", `/api/admin/publications/${id}/approve-categories`, { 
            categories, 
            reviewerName: 'admin' 
          });
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
      toast({
        title: "Bulk Approval Complete",
        description: "Category suggestions have been approved for selected publications.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Bulk Approval Failed",
        description: error.message || "Failed to approve categories",
        variant: "destructive",
      });
    },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: async (publicationIds: string[]) => {
      const promises = publicationIds.map(id =>
        apiRequest("POST", `/api/admin/publications/${id}/reject-suggestions`, { reviewerName: 'admin' })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/needing-review"] });
      setSelectedPublications(new Set());
      toast({
        title: "Bulk Rejection Complete",
        description: "Category suggestions have been rejected for selected publications.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Bulk Rejection Failed",
        description: error.message || "Failed to reject suggestions",
        variant: "destructive",
      });
    },
  });

  // Poll sync status
  const fetchSyncStatus = async () => {
    try {
      const response = await apiRequest("GET", "/api/admin/sync-status");
      const data = await response.json();
      
      // Extract status fields from response (API returns {success, status, type, ...})
      const newStatus: SyncStatus = {
        status: data.status,
        type: data.type,
        phase: data.phase,
        processed: data.processed,
        total: data.total,
        imported: data.imported,
        skipped: data.skipped,
        approved: data.approved,
        pending: data.pending,
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        error: data.error,
        lastSuccessTime: data.lastSuccessTime || null,
      };
      
      setSyncStatus(newStatus);
      return newStatus;
    } catch (error) {
      console.error("Failed to fetch sync status:", error);
      return null;
    }
  };

  // Start polling when sync is running
  useEffect(() => {
    if (syncStatus?.status === "running") {
      // Clear any completion timeout from previous sync
      if (completionTimeout.current) {
        clearTimeout(completionTimeout.current);
        completionTimeout.current = null;
      }
      
      // Poll every 2 seconds
      pollingInterval.current = setInterval(fetchSyncStatus, 2000);
    } else {
      // Stop polling if sync is not running
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }

      // If sync just completed, refresh stats and all admin queries
      if (syncStatus?.status === "completed") {
        queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/publications-list/featured"] });
        queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
        queryClient.invalidateQueries({ queryKey: ["/api/publications/featured"] });

        toast({
          title: "Sync Complete",
          description: `Imported ${syncStatus.imported} publications (${syncStatus.approved} approved, ${syncStatus.pending} pending)`,
        });

        // Clear any existing completion timeout
        if (completionTimeout.current) {
          clearTimeout(completionTimeout.current);
        }
        
        // Reset status after showing completion (only if still completed)
        completionTimeout.current = setTimeout(() => {
          setSyncStatus((current) => {
            // Only clear if still completed (not if a new sync started)
            if (current?.status === "completed") {
              return null;
            }
            return current;
          });
        }, 5000);
      } else if (syncStatus?.status === "error") {
        toast({
          title: "Sync Failed",
          description: syncStatus.error || "An error occurred during sync",
          variant: "destructive",
        });
        
        // Clear any existing completion timeout
        if (completionTimeout.current) {
          clearTimeout(completionTimeout.current);
          completionTimeout.current = null;
        }
      }
    }

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
      if (completionTimeout.current) {
        clearTimeout(completionTimeout.current);
      }
    };
  }, [syncStatus?.status]);

  // Fetch status on mount
  useEffect(() => {
    fetchSyncStatus();
  }, []);

  const handleFullSync = async () => {
    try {
      await apiRequest("POST", "/api/admin/sync-pubmed", {
        maxPerTerm: 5000,
      });
      toast({
        title: "Full Sync Started",
        description: "Syncing all publications from PubMed. Progress will update automatically.",
      });
      // Start polling immediately
      fetchSyncStatus();
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to start full sync",
        variant: "destructive",
      });
    }
  };

  const handleIncrementalSync = async () => {
    try {
      await apiRequest("POST", "/api/admin/sync-pubmed-incremental", {
        maxPerTerm: 5000,
      });
      toast({
        title: "Incremental Sync Started",
        description: "Fetching new publications since last sync. Progress will update automatically.",
      });
      // Start polling immediately
      fetchSyncStatus();
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to start incremental sync",
        variant: "destructive",
      });
    }
  };

  const handleRefetchAbstracts = async () => {
    try {
      await apiRequest("POST", "/api/admin/refetch-abstracts");
      toast({
        title: "Abstract Refetch Started",
        description: "Fetching missing abstracts from PubMed. Progress will update automatically.",
      });
      // Start polling immediately
      fetchSyncStatus();
    } catch (error: any) {
      toast({
        title: "Refetch Failed",
        description: error.message || "Failed to start abstract refetch",
        variant: "destructive",
      });
    }
  };

  const [citationStatus, setCitationStatus] = useState<CitationUpdateStatus | null>(null);
  const citationPollingInterval = useRef<NodeJS.Timeout | null>(null);
  const citationCompletionTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const fetchCitationStatus = async () => {
    try {
      const response = await apiRequest("GET", "/api/admin/citation-status");
      const data = await response.json();
      setCitationStatus(data);
      return data;
    } catch (error) {
      console.error("Failed to fetch citation status:", error);
      return null;
    }
  };

  useEffect(() => {
    if (citationStatus?.status === "running") {
      if (citationCompletionTimeout.current) {
        clearTimeout(citationCompletionTimeout.current);
        citationCompletionTimeout.current = null;
      }
      citationPollingInterval.current = setInterval(fetchCitationStatus, 1000);
    } else {
      if (citationPollingInterval.current) {
        clearInterval(citationPollingInterval.current);
        citationPollingInterval.current = null;
      }
      if (citationStatus?.status === "completed") {
        citationCompletionTimeout.current = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
          toast({
            title: "Citation Update Complete",
            description: `Updated ${citationStatus.updated} of ${citationStatus.total} publications`,
          });
        }, 1000);
      }
      if (citationStatus?.status === "error") {
        toast({
          title: "Citation Update Failed",
          description: citationStatus.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    }
    return () => {
      if (citationPollingInterval.current) {
        clearInterval(citationPollingInterval.current);
      }
      if (citationCompletionTimeout.current) {
        clearTimeout(citationCompletionTimeout.current);
      }
    };
  }, [citationStatus?.status]);

  useEffect(() => {
    fetchCitationStatus();
  }, []);
  
  const handleUpdateCitations = async () => {
    try {
      const response = await apiRequest("POST", "/api/admin/update-citations");
      const data = await response.json();
      if (data.success) {
        toast({
          title: "Citation Update Started",
          description: data.message,
        });
        fetchCitationStatus();
      } else {
        toast({
          title: "Update Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to start citation update",
        variant: "destructive",
      });
    }
  };

  // Abstract refresh status tracking
  const [abstractRefreshStatus, setAbstractRefreshStatus] = useState<AbstractRefreshStatus | null>(null);
  const abstractRefreshPollingInterval = useRef<NodeJS.Timeout | null>(null);
  const abstractRefreshCompletionTimeout = useRef<NodeJS.Timeout | null>(null);

  const fetchAbstractRefreshStatus = async () => {
    try {
      const response = await apiRequest("GET", "/api/admin/abstract-refresh-status");
      const data = await response.json();
      setAbstractRefreshStatus(data);
      return data;
    } catch (error) {
      console.error("Failed to fetch abstract refresh status:", error);
      return null;
    }
  };

  useEffect(() => {
    if (abstractRefreshStatus?.status === "running") {
      if (abstractRefreshCompletionTimeout.current) {
        clearTimeout(abstractRefreshCompletionTimeout.current);
        abstractRefreshCompletionTimeout.current = null;
      }
      abstractRefreshPollingInterval.current = setInterval(fetchAbstractRefreshStatus, 1000);
    } else {
      if (abstractRefreshPollingInterval.current) {
        clearInterval(abstractRefreshPollingInterval.current);
        abstractRefreshPollingInterval.current = null;
      }
      if (abstractRefreshStatus?.status === "completed") {
        abstractRefreshCompletionTimeout.current = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
          toast({
            title: "Abstract Refresh Complete",
            description: `Updated ${abstractRefreshStatus.updated} abstracts (${abstractRefreshStatus.failed} failed)`,
          });
        }, 1000);
      }
      if (abstractRefreshStatus?.status === "error") {
        toast({
          title: "Abstract Refresh Failed",
          description: abstractRefreshStatus.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    }
    return () => {
      if (abstractRefreshPollingInterval.current) {
        clearInterval(abstractRefreshPollingInterval.current);
      }
      if (abstractRefreshCompletionTimeout.current) {
        clearTimeout(abstractRefreshCompletionTimeout.current);
      }
    };
  }, [abstractRefreshStatus?.status]);

  useEffect(() => {
    fetchAbstractRefreshStatus();
  }, []);

  const handleRefreshAbstracts = async () => {
    try {
      const response = await apiRequest("POST", "/api/admin/refresh-abstracts");
      const data = await response.json();
      if (data.success) {
        toast({
          title: "Abstract Refresh Started",
          description: data.message,
        });
        fetchAbstractRefreshStatus();
      } else {
        toast({
          title: "Refresh Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Refresh Failed",
        description: error.message || "Failed to start abstract refresh",
        variant: "destructive",
      });
    }
  };

  // Poll batch categorization status
  const fetchBatchCategorizationStatus = async () => {
    try {
      const response = await apiRequest("GET", "/api/admin/batch-categorization/status");
      const data = await response.json();
      
      const newStatus: BatchCategorizationStatus = {
        status: data.status,
        filter: data.filter,
        phase: data.phase,
        processed: data.processed,
        total: data.total,
        success: data.success,
        failed: data.failed,
        skipped: data.skipped,
        currentPublication: data.currentPublication,
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        error: data.error,
        etaSeconds: data.etaSeconds || null,
      };
      
      setBatchCategorizationStatus(newStatus);
      return newStatus;
    } catch (error) {
      console.error("Failed to fetch batch categorization status:", error);
      return null;
    }
  };

  // Start polling when batch categorization is running
  useEffect(() => {
    if (batchCategorizationStatus?.status === "running") {
      if (batchCategorizationCompletionTimeout.current) {
        clearTimeout(batchCategorizationCompletionTimeout.current);
        batchCategorizationCompletionTimeout.current = null;
      }
      
      batchCategorizationPollingInterval.current = setInterval(fetchBatchCategorizationStatus, 500);
    } else {
      if (batchCategorizationPollingInterval.current) {
        clearInterval(batchCategorizationPollingInterval.current);
        batchCategorizationPollingInterval.current = null;
      }
      
      if (batchCategorizationStatus?.status === "completed") {
        batchCategorizationCompletionTimeout.current = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/needing-review"] });
          queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/needing-review/count"] });
          queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
          
          toast({
            title: "Batch Categorization Complete",
            description: `Successfully categorized ${batchCategorizationStatus.success} publications (${batchCategorizationStatus.skipped} skipped, ${batchCategorizationStatus.failed} failed)`,
          });
        }, 1000);
      }
    }
    
    return () => {
      if (batchCategorizationPollingInterval.current) {
        clearInterval(batchCategorizationPollingInterval.current);
      }
      if (batchCategorizationCompletionTimeout.current) {
        clearTimeout(batchCategorizationCompletionTimeout.current);
      }
    };
  }, [batchCategorizationStatus?.status]);

  // Fetch batch categorization status on mount
  useEffect(() => {
    fetchBatchCategorizationStatus();
  }, []);

  const handleStartBatchCategorization = async () => {
    try {
      await apiRequest("POST", "/api/admin/batch-categorization/start", {
        filter: batchCategorizeFilter,
      });
      toast({
        title: "Batch Categorization Started",
        description: `Generating ML-powered category suggestions. Progress will update automatically.`,
      });
      setBatchCategorizeDialogOpen(false);
      fetchBatchCategorizationStatus();
    } catch (error: any) {
      toast({
        title: "Batch Categorization Failed",
        description: error.message || "Failed to start batch categorization",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (publication: Publication) => {
    setEditingPublication(publication);
    setEditCategories(publication.categories || []);
    // If has suggested categories, pre-select them for Edit & Approve
    if (publication.suggestedCategories && publication.suggestedCategories.length > 0) {
      setEditSuggestedCategories(publication.suggestedCategories.map(sc => sc.category));
    } else {
      setEditSuggestedCategories([]);
    }
    setEditDialogOpen(true);
  };

  const handleSaveCategories = () => {
    if (!editingPublication) return;
    
    // If on category review tab and has suggested categories, use approve mutation
    if (activeTab === "category-review" && editingPublication.suggestedCategories && editingPublication.suggestedCategories.length > 0) {
      approveCategoriesMutation.mutate({
        id: editingPublication.id,
        categories: editSuggestedCategories,
      });
    } else {
      updateCategoriesMutation.mutate({
        id: editingPublication.id,
        categories: editCategories,
      });
    }
  };

  const toggleCategory = (category: string) => {
    setEditCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleSuggestedCategory = (category: string) => {
    setEditSuggestedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleAcceptAllSuggestions = (publication: Publication) => {
    if (!publication.suggestedCategories || publication.suggestedCategories.length === 0) return;
    const categories = publication.suggestedCategories.map(sc => sc.category);
    approveCategoriesMutation.mutate({
      id: publication.id,
      categories,
    });
  };

  const handleToggleSelection = (publicationId: string) => {
    setSelectedPublications(prev => {
      const newSet = new Set(prev);
      if (newSet.has(publicationId)) {
        newSet.delete(publicationId);
      } else {
        newSet.add(publicationId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedPublications.size === filteredPublications.length) {
      setSelectedPublications(new Set());
    } else {
      setSelectedPublications(new Set(filteredPublications.map(p => p.id)));
    }
  };

  const handleBulkGenerate = () => {
    const ids = Array.from(selectedPublications);
    batchGenerateSuggestionsMutation.mutate({
      publicationIds: ids,
      useML: bulkGenerateUseML,
    });
  };

  const handleBulkAccept = () => {
    const ids = Array.from(selectedPublications);
    bulkApproveMutation.mutate(ids);
  };

  const handleBulkReject = () => {
    const ids = Array.from(selectedPublications);
    bulkRejectMutation.mutate(ids);
  };

  const getConfidenceBadgeClass = (confidence: number) => {
    if (confidence >= 0.8) {
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    } else if (confidence >= 0.6) {
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    } else {
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const getSourceBadgeClass = (source: 'ml' | 'keyword') => {
    if (source === 'ml') {
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    } else {
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    }
  };

  // Memoize filtered publications to prevent recomputing on every render
  // No need for client-side filtering - backend now handles search
  const filteredPublications = publicationsData?.publications || [];

  const stats = statsData?.stats?.totalByStatus || { pending: 0, approved: 0, rejected: 0 };

  const pendingColumns = useMemo<ColumnDef<Publication>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        size: 350,
        minSize: 200,
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="text-sm" data-testid={`text-title-${row.original.id}`}>
              {row.original.title}
            </div>
            <div className="text-xs text-[#6e6e73] dark:text-gray-400 line-clamp-1" data-testid={`text-authors-${row.original.id}`}>
              {row.original.authors}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "journal",
        header: "Journal",
        size: 150,
        cell: ({ row }) => (
          <div className="text-sm line-clamp-2" data-testid={`text-journal-${row.original.id}`}>
            {row.original.journal}
          </div>
        ),
      },
      {
        accessorKey: "publicationDate",
        header: "Date",
        size: 120,
        cell: ({ row }) => (
          <div className="text-sm" data-testid={`text-date-${row.original.id}`}>
            {new Date(row.original.publicationDate).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short' 
            })}
          </div>
        ),
      },
      {
        accessorKey: "categories",
        header: "Categories",
        size: 100,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.categories && row.original.categories.length > 0 ? (
              row.original.categories.map((category) => (
                <Badge key={category} variant="secondary" className="text-xs" data-testid={`badge-category-${row.original.id}-${category}`}>
                  {RESEARCH_AREA_DISPLAY_NAMES[category] || category}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-[#6e6e73] dark:text-gray-400">None</span>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        size: 350,
        enableResizing: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => row.original.pubmedUrl && window.open(row.original.pubmedUrl, '_blank')}
              className="h-8 w-8 p-0"
              title="View on PubMed"
              data-testid={`button-view-${row.original.id}`}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openEditDialog(row.original)}
              className="h-8 w-8 p-0"
              title="Edit Categories"
              data-testid={`button-edit-${row.original.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {(!row.original.suggestedCategories || row.original.suggestedCategories.length === 0) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateSuggestionsMutation.mutate({ id: row.original.id, useML: true })}
                disabled={generateSuggestionsMutation.isPending}
                className="h-8"
                title="Generate category suggestions"
                data-testid={`button-generate-${row.original.id}`}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Generate
              </Button>
            )}
            <Button
              size="sm"
              variant="default"
              onClick={() => approveMutation.mutate(row.original.id)}
              disabled={approveMutation.isPending}
              className="h-8 bg-green-600 hover:bg-green-700 text-white"
              data-testid={`button-approve-${row.original.id}`}
            >
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => rejectMutation.mutate(row.original.id)}
              disabled={rejectMutation.isPending}
              className="h-8"
              data-testid={`button-reject-${row.original.id}`}
            >
              <X className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        ),
      },
    ],
    [approveMutation, rejectMutation, generateSuggestionsMutation]
  );

  const approvedRejectedColumns = useMemo<ColumnDef<Publication>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        size: 350,
        minSize: 200,
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="text-sm" data-testid={`text-title-${row.original.id}`}>
              {row.original.title}
            </div>
            <div className="text-xs text-[#6e6e73] dark:text-gray-400 line-clamp-1" data-testid={`text-authors-${row.original.id}`}>
              {row.original.authors}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "journal",
        header: "Journal",
        size: 150,
        cell: ({ row }) => (
          <div className="text-sm line-clamp-2" data-testid={`text-journal-${row.original.id}`}>
            {row.original.journal}
          </div>
        ),
      },
      {
        accessorKey: "publicationDate",
        header: "Date",
        size: 120,
        cell: ({ row }) => (
          <div className="text-sm" data-testid={`text-date-${row.original.id}`}>
            {new Date(row.original.publicationDate).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short' 
            })}
          </div>
        ),
      },
      {
        accessorKey: "categories",
        header: "Categories",
        size: 100,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.categories && row.original.categories.length > 0 ? (
              row.original.categories.map((category) => (
                <Badge key={category} variant="secondary" className="text-xs" data-testid={`badge-category-${row.original.id}-${category}`}>
                  {RESEARCH_AREA_DISPLAY_NAMES[category] || category}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-[#6e6e73] dark:text-gray-400">None</span>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        size: 350,
        enableResizing: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => row.original.pubmedUrl && window.open(row.original.pubmedUrl, '_blank')}
              className="h-8 w-8 p-0"
              title="View on PubMed"
              data-testid={`button-view-${row.original.id}`}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={row.original.isFeatured === 1 ? "default" : "ghost"}
              onClick={() => toggleFeaturedMutation.mutate(row.original.id)}
              disabled={toggleFeaturedMutation.isPending}
              className="h-8 w-8 p-0"
              title={row.original.isFeatured === 1 ? "Remove from Featured" : "Add to Featured"}
              data-testid={`button-feature-${row.original.id}`}
            >
              <Star className={`h-4 w-4 ${row.original.isFeatured === 1 ? 'fill-current' : ''}`} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openEditDialog(row.original)}
              className="h-8 w-8 p-0"
              title="Edit Categories"
              data-testid={`button-edit-${row.original.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {(!row.original.suggestedCategories || row.original.suggestedCategories.length === 0) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateSuggestionsMutation.mutate({ id: row.original.id, useML: true })}
                disabled={generateSuggestionsMutation.isPending}
                className="h-8"
                title="Generate category suggestions"
                data-testid={`button-generate-${row.original.id}`}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Generate
              </Button>
            )}
            <Select
              value={activeTab}
              onValueChange={(value) => changeStatusMutation.mutate({ id: row.original.id, status: value as "pending" | "approved" | "rejected" })}
              disabled={changeStatusMutation.isPending}
            >
              <SelectTrigger className="h-8 w-[140px]" data-testid={`select-status-${row.original.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approved" data-testid="option-status-approved">Approved</SelectItem>
                <SelectItem value="pending" data-testid="option-status-pending">Move to Pending</SelectItem>
                <SelectItem value="rejected" data-testid="option-status-rejected">Reject</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ),
      },
    ],
    [activeTab, changeStatusMutation, toggleFeaturedMutation, generateSuggestionsMutation]
  );

  // Category Review Columns
  const categoryReviewColumns = useMemo<ColumnDef<Publication>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={selectedPublications.size === filteredPublications.length && filteredPublications.length > 0}
            onCheckedChange={handleSelectAll}
            aria-label="Select all"
            data-testid="checkbox-select-all"
          />
        ),
        size: 50,
        enableResizing: false,
        cell: ({ row }) => (
          <Checkbox
            checked={selectedPublications.has(row.original.id)}
            onCheckedChange={() => handleToggleSelection(row.original.id)}
            aria-label="Select row"
            data-testid={`checkbox-select-${row.original.id}`}
          />
        ),
      },
      {
        accessorKey: "title",
        header: "Publication",
        size: 300,
        minSize: 200,
        cell: ({ row }) => (
          <div className="space-y-2">
            <div className="text-sm font-medium" data-testid={`text-title-${row.original.id}`}>
              {row.original.title}
            </div>
            <div className="text-xs text-[#6e6e73] dark:text-gray-400 line-clamp-1" data-testid={`text-authors-${row.original.id}`}>
              {row.original.authors}
            </div>
            <div className="text-xs text-[#6e6e73] dark:text-gray-400">
              {row.original.journal} • {new Date(row.original.publicationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "reviewReason",
        header: "Review Reason",
        size: 150,
        cell: ({ row }) => {
          const hasCategories = row.original.categories && row.original.categories.length > 0;
          const hasSuggestions = row.original.suggestedCategories && row.original.suggestedCategories.length > 0;
          const hasLowConfidence = hasSuggestions && row.original.suggestedCategories && row.original.suggestedCategories.some(s => s.confidence < 0.8);
          
          let reason = "";
          let badgeClass = "";
          
          if (!hasCategories && !hasSuggestions) {
            reason = "Uncategorized";
            badgeClass = "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
          } else if (hasLowConfidence) {
            reason = "Low Confidence";
            badgeClass = "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
          } else if (row.original.categoryReviewStatus === 'pending_review') {
            reason = "Pending Review";
            badgeClass = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
          } else {
            reason = "Needs Review";
            badgeClass = "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
          }
          
          return (
            <Badge className={`text-xs ${badgeClass}`} data-testid={`badge-reason-${row.original.id}`}>
              {reason}
            </Badge>
          );
        },
      },
      {
        accessorKey: "categories",
        header: "Current Categories",
        size: 180,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.categories && row.original.categories.length > 0 ? (
              row.original.categories.map((category) => (
                <Badge key={category} variant="secondary" className="text-xs" data-testid={`badge-current-category-${row.original.id}-${category}`}>
                  {RESEARCH_AREA_DISPLAY_NAMES[category] || category}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-[#6e6e73] dark:text-gray-400">None</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "suggestedCategories",
        header: "Suggested Categories",
        size: 280,
        cell: ({ row }) => (
          <div className="space-y-2">
            {row.original.suggestedCategories && row.original.suggestedCategories.length > 0 ? (
              row.original.suggestedCategories.map((suggestion, idx) => (
                <div key={idx} className="flex items-center gap-2 flex-wrap">
                  <Badge 
                    className={`text-xs ${getConfidenceBadgeClass(suggestion.confidence)}`}
                    data-testid={`badge-suggested-${row.original.id}-${suggestion.category}`}
                  >
                    {suggestion.confidence >= 0.8 && <Check className="h-3 w-3 mr-1" />}
                    {RESEARCH_AREA_DISPLAY_NAMES[suggestion.category] || suggestion.category}
                    <span className="ml-1 opacity-75">({Math.round(suggestion.confidence * 100)}%)</span>
                  </Badge>
                  <Badge 
                    className={`text-xs ${getSourceBadgeClass(suggestion.source)}`}
                    data-testid={`badge-source-${row.original.id}-${suggestion.category}`}
                  >
                    {suggestion.source === 'ml' ? 'ML' : 'Keyword'}
                  </Badge>
                </div>
              ))
            ) : (
              <span className="text-xs text-[#6e6e73] dark:text-gray-400">No suggestions</span>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        size: 400,
        enableResizing: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => row.original.pubmedUrl && window.open(row.original.pubmedUrl, '_blank')}
              className="h-8 w-8 p-0"
              title="View on PubMed"
              data-testid={`button-view-${row.original.id}`}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => handleAcceptAllSuggestions(row.original)}
              disabled={approveCategoriesMutation.isPending || !row.original.suggestedCategories || row.original.suggestedCategories.length === 0}
              className="h-8 bg-green-600 hover:bg-green-700 text-white"
              data-testid={`button-accept-${row.original.id}`}
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openEditDialog(row.original)}
              disabled={!row.original.suggestedCategories || row.original.suggestedCategories.length === 0}
              className="h-8"
              data-testid={`button-edit-approve-${row.original.id}`}
            >
              <Pencil className="h-4 w-4 mr-1" />
              Edit & Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => rejectSuggestionsMutation.mutate(row.original.id)}
              disabled={rejectSuggestionsMutation.isPending}
              className="h-8"
              data-testid={`button-reject-suggestions-${row.original.id}`}
            >
              <X className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        ),
      },
    ],
    [selectedPublications, filteredPublications, approveCategoriesMutation, rejectSuggestionsMutation]
  );

  const pendingTable = useReactTable({
    data: filteredPublications,
    columns: pendingColumns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode,
    enableColumnResizing: true,
  });

  const approvedRejectedTable = useReactTable({
    data: filteredPublications,
    columns: approvedRejectedColumns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode,
    enableColumnResizing: true,
  });

  const categoryReviewTable = useReactTable({
    data: filteredPublications,
    columns: categoryReviewColumns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode,
    enableColumnResizing: true,
  });

  const renderTable = (table: ReturnType<typeof useReactTable<Publication>>) => (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ tableLayout: 'fixed', width: table.getTotalSize() }}>
        <thead className="border-b">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="h-12 px-4 text-left align-middle font-medium text-muted-foreground relative group"
                  style={{ width: header.getSize() }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none ${
                        header.column.getIsResizing() 
                          ? 'bg-[#007AFF] w-1' 
                          : 'bg-transparent group-hover:bg-gray-300 dark:group-hover:bg-gray-600'
                      }`}
                    />
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b transition-colors hover:bg-muted/50" data-testid={`row-publication-${row.original.id}`}>
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="p-4 align-middle"
                  style={{ width: cell.column.getSize() }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
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
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-[#1d1d1f] dark:text-white mb-3">
            Publication Admin
          </h1>
          <p className="text-lg text-[#6e6e73] dark:text-gray-400">
            Review and manage publications
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>PubMed Sync</CardTitle>
            <CardDescription>Sync publications from PubMed Central</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <h3 className="font-medium mb-2 text-sm text-[#1d1d1f] dark:text-white">Full Sync</h3>
                <p className="text-sm text-[#6e6e73] dark:text-gray-400 mb-3">
                  Run a complete sync from 2000 to present. This will fetch all SphygmoCor publications from PubMed Central.
                </p>
                <Button 
                  onClick={handleFullSync} 
                  disabled={syncStatus?.status === "running"}
                  className="w-full sm:w-auto"
                  data-testid="button-full-sync"
                >
                  {syncStatus?.status === "running" && syncStatus.type === "full" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    "Start Full Sync"
                  )}
                </Button>
              </div>
              <div className="flex-1">
                <h3 className="font-medium mb-2 text-sm text-[#1d1d1f] dark:text-white">Incremental Sync</h3>
                <p className="text-sm text-[#6e6e73] dark:text-gray-400 mb-3">
                  Sync only new publications since the most recent one in your database. Faster and more efficient.
                </p>
                <Button 
                  onClick={handleIncrementalSync} 
                  disabled={syncStatus?.status === "running"}
                  variant="outline"
                  className="w-full sm:w-auto"
                  data-testid="button-incremental-sync"
                >
                  {syncStatus?.status === "running" && syncStatus.type === "incremental" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    "Sync New Publications"
                  )}
                </Button>
              </div>
              <div className="flex-1">
                <h3 className="font-medium mb-2 text-sm text-[#1d1d1f] dark:text-white">Refetch Abstracts</h3>
                <p className="text-sm text-[#6e6e73] dark:text-gray-400 mb-3">
                  Fetch missing abstracts for publications that don't have them. Uses improved parser.
                </p>
                <Button 
                  onClick={handleRefetchAbstracts} 
                  disabled={syncStatus?.status === "running"}
                  variant="outline"
                  className="w-full sm:w-auto"
                  data-testid="button-refetch-abstracts"
                >
                  {syncStatus?.status === "running" && syncStatus.phase?.includes("abstract") ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Fetching...
                    </>
                  ) : (
                    "Refetch Missing Abstracts"
                  )}
                </Button>
              </div>
              <div className="flex-1">
                <h3 className="font-medium mb-2 text-sm text-[#1d1d1f] dark:text-white">Update Citations</h3>
                <p className="text-sm text-[#6e6e73] dark:text-gray-400 mb-3">
                  Fetch citation counts from OpenAlex for all publications with DOIs.
                </p>
                <Button 
                  onClick={handleUpdateCitations} 
                  disabled={citationStatus?.status === "running" || syncStatus?.status === "running"}
                  variant="outline"
                  className="w-full sm:w-auto"
                  data-testid="button-update-citations"
                >
                  {citationStatus?.status === "running" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Citation Counts"
                  )}
                </Button>
                {citationStatus?.status === "running" && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-blue-900 dark:text-blue-100">{citationStatus.phase}</span>
                      <span className="text-sm text-blue-700 dark:text-blue-300">
                        {citationStatus.processed}/{citationStatus.total}
                      </span>
                    </div>
                    <Progress 
                      value={citationStatus.total > 0 ? (citationStatus.processed / citationStatus.total) * 100 : 0} 
                      className="h-2"
                    />
                  </div>
                )}
              </div>
            </div>
            
            {/* Abstract Refresh Section */}
            <div className="flex flex-col sm:flex-row gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex-1">
                <h3 className="font-medium mb-2 text-sm text-[#1d1d1f] dark:text-white">Refresh All Abstracts</h3>
                <p className="text-sm text-[#6e6e73] dark:text-gray-400 mb-3">
                  Re-fetch all abstracts from PubMed to fix any corrupted or missing text. Use this if abstracts appear incomplete.
                </p>
                <Button 
                  onClick={handleRefreshAbstracts} 
                  disabled={abstractRefreshStatus?.status === "running" || syncStatus?.status === "running"}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  {abstractRefreshStatus?.status === "running" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    "Refresh All Abstracts"
                  )}
                </Button>
                {abstractRefreshStatus?.status === "running" && (
                  <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-purple-900 dark:text-purple-100">{abstractRefreshStatus.phase}</span>
                      <span className="text-sm text-purple-700 dark:text-purple-300">
                        {abstractRefreshStatus.processed}/{abstractRefreshStatus.total}
                      </span>
                    </div>
                    <Progress 
                      value={abstractRefreshStatus.total > 0 ? (abstractRefreshStatus.processed / abstractRefreshStatus.total) * 100 : 0} 
                      className="h-2"
                    />
                    <div className="flex gap-4 mt-2 text-xs text-purple-700 dark:text-purple-300">
                      <span>Updated: {abstractRefreshStatus.updated}</span>
                      <span>Failed: {abstractRefreshStatus.failed}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Progress Display */}
            {syncStatus?.status === "running" && (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                    <span className="font-medium text-sm text-blue-900 dark:text-blue-100">{syncStatus.phase}</span>
                  </div>
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    {syncStatus.processed}/{syncStatus.total} batches
                  </span>
                </div>
                <Progress 
                  value={syncStatus.total > 0 ? (syncStatus.processed / syncStatus.total) * 100 : 0} 
                  className="h-2 mb-2"
                />
                <div className="flex gap-4 text-xs text-blue-700 dark:text-blue-300">
                  <span>Imported: {syncStatus.imported}</span>
                  <span>Skipped: {syncStatus.skipped}</span>
                  <span>Approved: {syncStatus.approved}</span>
                  <span>Pending: {syncStatus.pending}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Batch Categorization</CardTitle>
            <CardDescription>Generate ML-powered category suggestions for multiple publications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-[#6e6e73] dark:text-gray-400 mb-3">
                  Use GPT-5 nano to automatically generate category suggestions for publications. High-confidence suggestions (≥80%) are auto-approved, while others are flagged for manual review.
                </p>
                <Button 
                  onClick={() => setBatchCategorizeDialogOpen(true)} 
                  disabled={batchCategorizationStatus?.status === "running"}
                  variant="outline"
                  className="w-full sm:w-auto"
                  data-testid="button-batch-categorize"
                >
                  {batchCategorizationStatus?.status === "running" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Categorizing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Bulk Generate Categories
                    </>
                  )}
                </Button>
              </div>
              
              {/* Progress Display */}
              {batchCategorizationStatus?.status === "running" && (() => {
                const percentage = batchCategorizationStatus.total > 0 
                  ? (batchCategorizationStatus.processed / batchCategorizationStatus.total) * 100 
                  : 0;
                
                // Use backend-calculated ETA for stability
                let etaText = "Calculating...";
                if (batchCategorizationStatus.etaSeconds !== null && batchCategorizationStatus.etaSeconds >= 0) {
                  const etaSec = batchCategorizationStatus.etaSeconds;
                  if (etaSec < 60) {
                    etaText = `~${etaSec}s remaining`;
                  } else {
                    const mins = Math.ceil(etaSec / 60);
                    etaText = `~${mins} min${mins > 1 ? 's' : ''} remaining`;
                  }
                }
                
                return (
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-purple-600 dark:text-purple-400" />
                        <span className="font-medium text-sm text-purple-900 dark:text-purple-100">{batchCategorizationStatus.phase}</span>
                      </div>
                      <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-purple-700 dark:text-purple-300">
                        {batchCategorizationStatus.processed}/{batchCategorizationStatus.total} publications
                      </span>
                      <span className="text-xs text-purple-600 dark:text-purple-400">
                        {etaText}
                      </span>
                    </div>
                    <Progress 
                      value={percentage} 
                      className="h-2 mb-2"
                    />
                    <div className="flex gap-4 text-xs text-purple-700 dark:text-purple-300">
                      <span>✓ Success: {batchCategorizationStatus.success}</span>
                      <span>⊘ Skipped: {batchCategorizationStatus.skipped}</span>
                      <span>✗ Failed: {batchCategorizationStatus.failed}</span>
                    </div>
                    {batchCategorizationStatus.currentPublication && (
                      <p className="mt-2 text-xs text-purple-600 dark:text-purple-400 truncate">
                        Current: {batchCategorizationStatus.currentPublication}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Search Publications</CardTitle>
            <CardDescription>Filter publications by title, author, or journal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#6e6e73] h-4 w-4" />
              <Input
                type="text"
                placeholder="Search by title, author, or journal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-publications"
              />
            </div>
            {debouncedSearch && publicationsData && (
              <p className="mt-2 text-sm text-[#6e6e73] dark:text-gray-400">
                Found {publicationsData.total} publication{publicationsData.total !== 1 ? 's' : ''} matching "{debouncedSearch}"
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "pending" | "approved" | "rejected" | "featured" | "category-review")} data-testid="tabs-status">
            <CardHeader className="pb-3">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="pending" data-testid="tab-pending">
                  Pending ({stats.pending || 0})
                </TabsTrigger>
                <TabsTrigger value="approved" data-testid="tab-approved">
                  Approved ({stats.approved || 0})
                </TabsTrigger>
                <TabsTrigger value="rejected" data-testid="tab-rejected">
                  Rejected ({stats.rejected || 0})
                </TabsTrigger>
                <TabsTrigger value="featured" data-testid="tab-featured">
                  Featured ({featuredCountData?.total || 0})
                </TabsTrigger>
                <TabsTrigger value="category-review" data-testid="tab-category-review">
                  Category Review ({categoryReviewData?.total || 0})
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="pending" className="mt-0">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-[#0071e3]" />
                  </div>
                ) : filteredPublications.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-[#6e6e73] dark:text-gray-400">
                      {debouncedSearch ? "No publications match your search" : "No pending publications"}
                    </p>
                  </div>
                ) : (
                  <>
                    {renderTable(pendingTable)}
                    <div className="p-4 border-t">
                      <PaginationControls
                        total={publicationsData?.total || 0}
                        currentPage={currentPage}
                        perPage={perPage}
                        onPageChange={setCurrentPage}
                        onPerPageChange={setPerPage}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </TabsContent>

            <TabsContent value="approved" className="mt-0">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-[#0071e3]" />
                  </div>
                ) : filteredPublications.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-[#6e6e73] dark:text-gray-400">
                      {debouncedSearch ? "No publications match your search" : "No approved publications"}
                    </p>
                  </div>
                ) : (
                  <>
                    {renderTable(approvedRejectedTable)}
                    <div className="p-4 border-t">
                      <PaginationControls
                        total={publicationsData?.total || 0}
                        currentPage={currentPage}
                        perPage={perPage}
                        onPageChange={setCurrentPage}
                        onPerPageChange={setPerPage}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </TabsContent>

            <TabsContent value="rejected" className="mt-0">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-[#0071e3]" />
                  </div>
                ) : filteredPublications.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-[#6e6e73] dark:text-gray-400">
                      {debouncedSearch ? "No publications match your search" : "No rejected publications"}
                    </p>
                  </div>
                ) : (
                  <>
                    {renderTable(approvedRejectedTable)}
                    <div className="p-4 border-t">
                      <PaginationControls
                        total={publicationsData?.total || 0}
                        currentPage={currentPage}
                        perPage={perPage}
                        onPageChange={setCurrentPage}
                        onPerPageChange={setPerPage}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </TabsContent>

            <TabsContent value="featured" className="mt-0">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-[#0071e3]" />
                  </div>
                ) : filteredPublications.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-[#6e6e73] dark:text-gray-400">
                      {debouncedSearch ? "No publications match your search" : "No featured publications"}
                    </p>
                  </div>
                ) : (
                  <>
                    {renderTable(approvedRejectedTable)}
                    <div className="p-4 border-t">
                      <PaginationControls
                        total={publicationsData?.total || 0}
                        currentPage={currentPage}
                        perPage={perPage}
                        onPageChange={setCurrentPage}
                        onPerPageChange={setPerPage}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </TabsContent>

            <TabsContent value="category-review" className="mt-0">
              <CardContent className="p-0">
                {selectedPublications.size > 0 && (
                  <div className="p-4 border-b bg-[#f5f5f7] dark:bg-gray-900">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-medium text-[#1d1d1f] dark:text-white">
                        {selectedPublications.size} selected
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setBulkGenerateDialogOpen(true)}
                          disabled={batchGenerateSuggestionsMutation.isPending}
                          data-testid="button-bulk-generate"
                        >
                          <Sparkles className="h-4 w-4 mr-1" />
                          Bulk Generate Suggestions
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={handleBulkAccept}
                          disabled={bulkApproveMutation.isPending}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          data-testid="button-bulk-accept"
                        >
                          <CheckCheck className="h-4 w-4 mr-1" />
                          Bulk Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleBulkReject}
                          disabled={bulkRejectMutation.isPending}
                          data-testid="button-bulk-reject"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Bulk Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-[#0071e3]" />
                  </div>
                ) : filteredPublications.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-[#6e6e73] dark:text-gray-400">
                      {debouncedSearch ? "No publications match your search" : "No publications need category review"}
                    </p>
                  </div>
                ) : (
                  <>
                    {renderTable(categoryReviewTable)}
                    <div className="p-4 border-t">
                      <PaginationControls
                        total={publicationsData?.total || 0}
                        currentPage={currentPage}
                        perPage={perPage}
                        onPageChange={setCurrentPage}
                        onPerPageChange={setPerPage}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </main>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {activeTab === "category-review" && editingPublication?.suggestedCategories && editingPublication.suggestedCategories.length > 0
                ? "Edit & Approve Categories"
                : "Edit Categories"}
            </DialogTitle>
            <DialogDescription>
              {activeTab === "category-review" && editingPublication?.suggestedCategories && editingPublication.suggestedCategories.length > 0
                ? "Select suggested categories to approve, or add additional ones"
                : "Select the research areas that apply to this publication"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {activeTab === "category-review" && editingPublication?.suggestedCategories && editingPublication.suggestedCategories.length > 0 ? (
              <>
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-[#1d1d1f] dark:text-white">Suggested Categories</h3>
                  {editingPublication.suggestedCategories.map((suggestion) => (
                    <div key={suggestion.category} className="flex items-center space-x-2">
                      <Checkbox
                        id={`suggested-${suggestion.category}`}
                        checked={editSuggestedCategories.includes(suggestion.category)}
                        onCheckedChange={() => toggleSuggestedCategory(suggestion.category)}
                        data-testid={`checkbox-suggested-${suggestion.category}`}
                      />
                      <Label
                        htmlFor={`suggested-${suggestion.category}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                      >
                        {RESEARCH_AREA_DISPLAY_NAMES[suggestion.category]}
                        <Badge className={`text-xs ${getConfidenceBadgeClass(suggestion.confidence)}`}>
                          {Math.round(suggestion.confidence * 100)}%
                        </Badge>
                        <Badge className={`text-xs ${getSourceBadgeClass(suggestion.source)}`}>
                          {suggestion.source === 'ml' ? 'ML' : 'Keyword'}
                        </Badge>
                      </Label>
                    </div>
                  ))}
                </div>
                <div className="space-y-3 pt-4 border-t">
                  <h3 className="font-medium text-sm text-[#1d1d1f] dark:text-white">Add Other Categories</h3>
                  {RESEARCH_AREAS.filter(area => !editingPublication.suggestedCategories?.some(sc => sc.category === area)).map((area) => (
                    <div key={area} className="flex items-center space-x-2">
                      <Checkbox
                        id={`additional-${area}`}
                        checked={editSuggestedCategories.includes(area)}
                        onCheckedChange={() => toggleSuggestedCategory(area)}
                        data-testid={`checkbox-additional-${area}`}
                      />
                      <Label
                        htmlFor={`additional-${area}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {RESEARCH_AREA_DISPLAY_NAMES[area]}
                      </Label>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                {RESEARCH_AREAS.map((area) => (
                  <div key={area} className="flex items-center space-x-2">
                    <Checkbox
                      id={area}
                      checked={editCategories.includes(area)}
                      onCheckedChange={() => toggleCategory(area)}
                      data-testid={`checkbox-category-${area}`}
                    />
                    <Label
                      htmlFor={area}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {RESEARCH_AREA_DISPLAY_NAMES[area]}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button 
              onClick={handleSaveCategories} 
              disabled={updateCategoriesMutation.isPending || approveCategoriesMutation.isPending}
              data-testid="button-save-categories"
            >
              {(updateCategoriesMutation.isPending || approveCategoriesMutation.isPending) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                activeTab === "category-review" && editingPublication?.suggestedCategories && editingPublication.suggestedCategories.length > 0
                  ? "Approve Selected"
                  : "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkGenerateDialogOpen} onOpenChange={setBulkGenerateDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Bulk Generate Suggestions</DialogTitle>
            <DialogDescription>
              Generate category suggestions for {selectedPublications.size} selected publication{selectedPublications.size !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="use-ml"
                checked={bulkGenerateUseML}
                onCheckedChange={(checked) => setBulkGenerateUseML(checked as boolean)}
                data-testid="checkbox-use-ml"
              />
              <Label
                htmlFor="use-ml"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Use ML-based suggestions (recommended)
              </Label>
            </div>
            <p className="text-sm text-[#6e6e73] dark:text-gray-400">
              {bulkGenerateUseML
                ? "ML-based suggestions use advanced models to analyze publication content and provide high-confidence category recommendations."
                : "Keyword-based suggestions use simple keyword matching from publication titles and abstracts."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkGenerateDialogOpen(false)} data-testid="button-cancel-bulk-generate">
              Cancel
            </Button>
            <Button 
              onClick={handleBulkGenerate} 
              disabled={batchGenerateSuggestionsMutation.isPending}
              data-testid="button-confirm-bulk-generate"
            >
              {batchGenerateSuggestionsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Suggestions"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchCategorizeDialogOpen} onOpenChange={setBatchCategorizeDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Bulk Generate Categories</DialogTitle>
            <DialogDescription>
              Use GPT-5 nano to generate ML-powered category suggestions for publications
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="filter-select">Select Publications</Label>
              <Select value={batchCategorizeFilter} onValueChange={(value: "all" | "uncategorized" | "pending" | "approved") => setBatchCategorizeFilter(value)}>
                <SelectTrigger id="filter-select" data-testid="select-batch-filter">
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
                <strong>How it works:</strong> GPT-5 nano analyzes each publication's title and abstract to suggest relevant research areas. High-confidence suggestions (≥80%) are auto-approved, while lower confidence suggestions are flagged for manual review in the Category Review tab.
              </p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                <strong>Cost:</strong> ~$0.13 for all 2,911 publications using GPT-5 nano ($0.05/1M input, $0.40/1M output tokens)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchCategorizeDialogOpen(false)} data-testid="button-cancel-batch-categorize">
              Cancel
            </Button>
            <Button 
              onClick={handleStartBatchCategorization} 
              data-testid="button-confirm-batch-categorize"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Start Categorization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * In-memory sync status tracker for PubMed synchronization
 * Singleton pattern to track ongoing sync operations
 */

export type SyncStatus = "idle" | "running" | "completed" | "error" | "cancelled";

export interface SyncState {
  status: SyncStatus;
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
  cancelRequested: boolean;
  dryRun?: boolean;
}

export interface SyncHistoryEntry {
  id: string;
  type: "full" | "incremental";
  status: SyncStatus;
  startTime: number;
  endTime: number | null;
  imported: number;
  skipped: number;
  approved: number;
  pending: number;
  error: string | null;
  dryRun: boolean;
}

class SyncTracker {
  private state: SyncState = {
    status: "idle",
    type: null,
    phase: "Idle",
    processed: 0,
    total: 0,
    imported: 0,
    skipped: 0,
    approved: 0,
    pending: 0,
    startTime: null,
    endTime: null,
    error: null,
    cancelRequested: false,
    dryRun: false,
  };

  private lastSuccessTime: number | null = null;
  private history: SyncHistoryEntry[] = [];
  private maxHistorySize: number = 50;

  isRunning(): boolean {
    return this.state.status === "running";
  }

  isCancelRequested(): boolean {
    return this.state.cancelRequested;
  }

  requestCancel(): boolean {
    if (!this.isRunning()) {
      return false;
    }
    this.state.cancelRequested = true;
    this.state.phase = "Cancelling...";
    console.log("[SYNC] Cancel requested by user");
    return true;
  }

  cancelled() {
    this.state.status = "cancelled";
    this.state.phase = "Sync cancelled by user";
    this.state.endTime = Date.now();
    this.state.cancelRequested = false;
    console.log("[SYNC] Sync cancelled successfully");
    this.addToHistory();
  }

  start(type: "full" | "incremental", dryRun: boolean = false) {
    if (this.isRunning()) {
      throw new Error("Sync is already running. Please wait for it to complete.");
    }

    this.state = {
      status: "running",
      type,
      phase: "Starting sync...",
      processed: 0,
      total: 0,
      imported: 0,
      skipped: 0,
      approved: 0,
      pending: 0,
      startTime: Date.now(),
      endTime: null,
      error: null,
      cancelRequested: false,
      dryRun,
    };
  }

  private addToHistory() {
    if (!this.state.type || !this.state.startTime) return;

    const entry: SyncHistoryEntry = {
      id: `${this.state.type}-${this.state.startTime}`,
      type: this.state.type,
      status: this.state.status,
      startTime: this.state.startTime,
      endTime: this.state.endTime,
      imported: this.state.imported,
      skipped: this.state.skipped,
      approved: this.state.approved,
      pending: this.state.pending,
      error: this.state.error,
      dryRun: this.state.dryRun || false,
    };

    this.history.unshift(entry);
    
    // Keep only the most recent entries
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize);
    }
    
    console.log(`[SYNC] Added to history: ${entry.id} (${entry.status})`);
  }

  updatePhase(phase: string) {
    if (this.state.status === "running") {
      this.state.phase = phase;
    }
  }

  updateProgress(processed: number, total: number) {
    if (this.state.status === "running") {
      this.state.processed = processed;
      this.state.total = total;
    }
  }

  updateStats(imported: number, skipped: number, approved: number, pending: number) {
    if (this.state.status === "running") {
      this.state.imported = imported;
      this.state.skipped = skipped;
      this.state.approved = approved;
      this.state.pending = pending;
    }
  }

  complete() {
    if (this.state.status === "running") {
      this.state.status = "completed";
      this.state.phase = this.state.dryRun ? "Dry run complete" : "Sync complete";
      this.state.endTime = Date.now();
      if (!this.state.dryRun) {
        this.lastSuccessTime = Date.now();
      }
      this.addToHistory();
    }
  }

  error(errorMessage: string) {
    this.state.status = "error";
    this.state.phase = "Sync failed";
    this.state.endTime = Date.now();
    this.state.error = errorMessage;
    this.addToHistory();
  }

  reset() {
    this.state = {
      status: "idle",
      type: null,
      phase: "Idle",
      processed: 0,
      total: 0,
      imported: 0,
      skipped: 0,
      approved: 0,
      pending: 0,
      startTime: null,
      endTime: null,
      error: null,
      cancelRequested: false,
    };
  }

  getStatus(): SyncState & { lastSuccessTime: number | null } {
    return {
      ...this.state,
      lastSuccessTime: this.lastSuccessTime,
    };
  }

  getHistory(limit: number = 20): SyncHistoryEntry[] {
    return this.history.slice(0, limit);
  }

  clearHistory() {
    this.history = [];
  }
}

// Export singleton instance
export const syncTracker = new SyncTracker();

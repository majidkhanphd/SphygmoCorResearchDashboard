/**
 * In-memory sync status tracker for PubMed synchronization
 * Singleton pattern to track ongoing sync operations
 */

export type SyncStatus = "idle" | "running" | "completed" | "error";

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
  };

  private lastSuccessTime: number | null = null;

  isRunning(): boolean {
    return this.state.status === "running";
  }

  start(type: "full" | "incremental") {
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
    };
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
      this.state.phase = "Sync complete";
      this.state.endTime = Date.now();
      this.lastSuccessTime = Date.now();
    }
  }

  error(errorMessage: string) {
    this.state.status = "error";
    this.state.phase = "Sync failed";
    this.state.endTime = Date.now();
    this.state.error = errorMessage;
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
    };
  }

  getStatus(): SyncState & { lastSuccessTime: number | null } {
    return {
      ...this.state,
      lastSuccessTime: this.lastSuccessTime,
    };
  }
}

// Export singleton instance
export const syncTracker = new SyncTracker();

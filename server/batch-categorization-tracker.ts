/**
 * In-memory state tracker for batch ML categorization
 * Singleton pattern to track ongoing categorization operations
 */

export type BatchCategorizationStatus = "idle" | "running" | "completed" | "error";

export interface BatchCategorizationState {
  status: BatchCategorizationStatus;
  filter: "all" | "uncategorized" | "pending" | "approved" | null;
  phase: string;
  processed: number;
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  startTime: number | null;
  endTime: number | null;
  error: string | null;
  currentPublication: string | null;
  etaSeconds: number | null;
}

class BatchCategorizationTracker {
  private state: BatchCategorizationState = {
    status: "idle",
    filter: null,
    phase: "Idle",
    processed: 0,
    total: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    startTime: null,
    endTime: null,
    error: null,
    currentPublication: null,
    etaSeconds: null,
  };

  isRunning(): boolean {
    return this.state.status === "running";
  }

  start(filter: "all" | "uncategorized" | "pending" | "approved", total: number) {
    if (this.isRunning()) {
      throw new Error("Batch categorization is already running. Please wait for it to complete.");
    }

    this.state = {
      status: "running",
      filter,
      phase: "Starting batch categorization...",
      processed: 0,
      total,
      successful: 0,
      failed: 0,
      skipped: 0,
      startTime: Date.now(),
      endTime: null,
      error: null,
      currentPublication: null,
      etaSeconds: null,
    };
  }

  updatePhase(phase: string) {
    if (this.state.status === "running") {
      this.state.phase = phase;
    }
  }

  updateProgress(processed: number, currentPublication: string | null = null) {
    if (this.state.status === "running") {
      this.state.processed = processed;
      this.state.currentPublication = currentPublication;
      
      // Calculate ETA based on server-side timing
      if (this.state.startTime && processed > 0) {
        const elapsedMs = Date.now() - this.state.startTime;
        const avgMsPerPub = elapsedMs / processed;
        const remainingPubs = this.state.total - processed;
        const etaMs = avgMsPerPub * remainingPubs;
        this.state.etaSeconds = Math.ceil(etaMs / 1000);
      } else {
        this.state.etaSeconds = null;
      }
    }
  }

  incrementSuccess() {
    if (this.state.status === "running") {
      this.state.successful++;
    }
  }

  incrementFailed() {
    if (this.state.status === "running") {
      this.state.failed++;
    }
  }

  incrementSkipped() {
    if (this.state.status === "running") {
      this.state.skipped++;
    }
  }

  incrementBatch(success: number, failed: number, skipped: number) {
    if (this.state.status === "running") {
      this.state.successful += success;
      this.state.failed += failed;
      this.state.skipped += skipped;
    }
  }

  complete() {
    if (this.state.status === "running") {
      this.state.status = "completed";
      this.state.phase = "Batch categorization complete";
      this.state.endTime = Date.now();
      this.state.currentPublication = null;
    }
  }

  error(errorMessage: string) {
    this.state.status = "error";
    this.state.phase = "Batch categorization failed";
    this.state.endTime = Date.now();
    this.state.error = errorMessage;
    this.state.currentPublication = null;
  }

  reset() {
    this.state = {
      status: "idle",
      filter: null,
      phase: "Idle",
      processed: 0,
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      startTime: null,
      endTime: null,
      error: null,
      currentPublication: null,
      etaSeconds: null,
    };
  }

  getStatus(): BatchCategorizationState {
    return { ...this.state };
  }
}

// Export singleton instance
export const batchCategorizationTracker = new BatchCategorizationTracker();

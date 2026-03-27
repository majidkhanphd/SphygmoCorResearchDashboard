import { storage } from "./storage";
import type { TaskProgress, TaskStats } from "@shared/schema";

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

const TASK_TYPE = "batch_categorization";

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

  private initialized: boolean = false;
  private persistQueue: Promise<void> = Promise.resolve();

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const task = await storage.getBackgroundTask(TASK_TYPE);
      if (task) {
        const progress = task.progress as TaskProgress | null;
        const stats = task.stats as TaskStats | null;
        this.state = {
          status: (task.status as BatchCategorizationStatus) || "idle",
          filter: (stats?.filter as BatchCategorizationState["filter"]) || null,
          phase: task.phase || "Idle",
          processed: progress?.processed || 0,
          total: progress?.total || 0,
          successful: stats?.successful || 0,
          failed: stats?.failed || 0,
          skipped: stats?.skipped || 0,
          startTime: task.startTime ? task.startTime.getTime() : null,
          endTime: task.endTime ? task.endTime.getTime() : null,
          error: task.error || null,
          currentPublication: null,
          etaSeconds: null,
        };
      }
      this.initialized = true;
      console.log(`[BATCH_CAT] Initialized from database: status=${this.state.status}`);
    } catch (err) {
      console.error("[BATCH_CAT] Failed to initialize from database:", err);
      this.initialized = true;
    }
  }

  private enqueuePersist(): void {
    this.persistQueue = this.persistQueue.then(() => this.doPersist()).catch((err) => {
      console.error("[BATCH_CAT] Failed to persist state:", err);
    });
  }

  private async awaitPersist(): Promise<void> {
    const p = this.persistQueue.then(() => this.doPersist()).catch((err) => {
      console.error("[BATCH_CAT] Failed to persist state:", err);
    });
    this.persistQueue = p;
    await p;
  }

  private async doPersist(): Promise<void> {
    await storage.upsertBackgroundTask(TASK_TYPE, {
      status: this.state.status,
      phase: this.state.phase,
      progress: { processed: this.state.processed, total: this.state.total } satisfies TaskProgress,
      stats: {
        filter: this.state.filter,
        successful: this.state.successful,
        failed: this.state.failed,
        skipped: this.state.skipped,
      } satisfies TaskStats,
      error: this.state.error,
      startTime: this.state.startTime ? new Date(this.state.startTime) : null,
      endTime: this.state.endTime ? new Date(this.state.endTime) : null,
    });
  }

  isRunning(): boolean {
    return this.state.status === "running";
  }

  async start(filter: "all" | "uncategorized" | "pending" | "approved", total: number) {
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
    await this.awaitPersist();
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

  persistProgress() {
    this.enqueuePersist();
  }

  async complete() {
    if (this.state.status === "running") {
      this.state.status = "completed";
      this.state.phase = "Batch categorization complete";
      this.state.endTime = Date.now();
      this.state.currentPublication = null;
      await this.awaitPersist();
    }
  }

  async error(errorMessage: string) {
    this.state.status = "error";
    this.state.phase = "Batch categorization failed";
    this.state.endTime = Date.now();
    this.state.error = errorMessage;
    this.state.currentPublication = null;
    await this.awaitPersist();
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
    this.enqueuePersist();
  }

  getStatus(): BatchCategorizationState {
    return { ...this.state };
  }
}

export const batchCategorizationTracker = new BatchCategorizationTracker();

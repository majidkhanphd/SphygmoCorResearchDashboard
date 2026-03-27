import { storage } from "./storage";
import type { TaskProgress, TaskStats, TaskHistoryEntry } from "@shared/schema";

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

const TASK_TYPE = "pubmed_sync";

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
          status: (task.status as SyncStatus) || "idle",
          type: (stats?.type as "full" | "incremental" | null) || null,
          phase: task.phase || "Idle",
          processed: progress?.processed || 0,
          total: progress?.total || 0,
          imported: stats?.imported || 0,
          skipped: stats?.skipped || 0,
          approved: stats?.approved || 0,
          pending: stats?.pending || 0,
          startTime: task.startTime ? task.startTime.getTime() : null,
          endTime: task.endTime ? task.endTime.getTime() : null,
          error: task.error || null,
          cancelRequested: false,
          dryRun: stats?.dryRun || false,
        };
        this.lastSuccessTime = task.lastSuccessTime ? task.lastSuccessTime.getTime() : null;
        this.history = (task.history as SyncHistoryEntry[]) || [];
      }
      this.initialized = true;
      console.log(`[SYNC] Initialized from database: status=${this.state.status}`);
    } catch (err) {
      console.error("[SYNC] Failed to initialize from database:", err);
      this.initialized = true;
    }
  }

  private enqueuePersist(): void {
    this.persistQueue = this.persistQueue.then(() => this.doPersist()).catch((err) => {
      console.error("[SYNC] Failed to persist state:", err);
    });
  }

  private async awaitPersist(): Promise<void> {
    const p = this.persistQueue.then(() => this.doPersist()).catch((err) => {
      console.error("[SYNC] Failed to persist state:", err);
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
        type: this.state.type,
        imported: this.state.imported,
        skipped: this.state.skipped,
        approved: this.state.approved,
        pending: this.state.pending,
        dryRun: this.state.dryRun,
      } satisfies TaskStats,
      error: this.state.error,
      startTime: this.state.startTime ? new Date(this.state.startTime) : null,
      endTime: this.state.endTime ? new Date(this.state.endTime) : null,
      lastSuccessTime: this.lastSuccessTime ? new Date(this.lastSuccessTime) : null,
      history: this.history as TaskHistoryEntry[],
    });
  }

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
    this.enqueuePersist();
    return true;
  }

  async cancelled() {
    this.state.status = "cancelled";
    this.state.phase = "Sync cancelled by user";
    this.state.endTime = Date.now();
    this.state.cancelRequested = false;
    console.log("[SYNC] Sync cancelled successfully");
    this.addToHistory();
    await this.awaitPersist();
  }

  async start(type: "full" | "incremental", dryRun: boolean = false) {
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
    await this.awaitPersist();
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

  persistProgress() {
    this.enqueuePersist();
  }

  async complete() {
    if (this.state.status === "running") {
      this.state.status = "completed";
      this.state.phase = this.state.dryRun ? "Dry run complete" : "Sync complete";
      this.state.endTime = Date.now();
      if (!this.state.dryRun) {
        this.lastSuccessTime = Date.now();
      }
      this.addToHistory();
      await this.awaitPersist();
    }
  }

  async error(errorMessage: string) {
    this.state.status = "error";
    this.state.phase = "Sync failed";
    this.state.endTime = Date.now();
    this.state.error = errorMessage;
    this.addToHistory();
    await this.awaitPersist();
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
    this.enqueuePersist();
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
    this.enqueuePersist();
  }
}

export const syncTracker = new SyncTracker();

import { storage } from "./storage";
import type { TaskProgress, TaskStats } from "@shared/schema";

export type CitationUpdateStatus = "idle" | "running" | "completed" | "error";

export interface CitationUpdateState {
  status: CitationUpdateStatus;
  phase: string;
  processed: number;
  total: number;
  updated: number;
  startTime: number | null;
  endTime: number | null;
  error: string | null;
}

const TASK_TYPE = "citation_update";

class CitationUpdateTracker {
  private state: CitationUpdateState = {
    status: "idle",
    phase: "Idle",
    processed: 0,
    total: 0,
    updated: 0,
    startTime: null,
    endTime: null,
    error: null,
  };

  private lastSuccessTime: number | null = null;
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
          status: (task.status as CitationUpdateStatus) || "idle",
          phase: task.phase || "Idle",
          processed: progress?.processed || 0,
          total: progress?.total || 0,
          updated: stats?.updated || 0,
          startTime: task.startTime ? task.startTime.getTime() : null,
          endTime: task.endTime ? task.endTime.getTime() : null,
          error: task.error || null,
        };
        this.lastSuccessTime = task.lastSuccessTime ? task.lastSuccessTime.getTime() : null;
      }
      this.initialized = true;
      console.log(`[CITATION] Initialized from database: status=${this.state.status}`);
    } catch (err) {
      console.error("[CITATION] Failed to initialize from database:", err);
      this.initialized = true;
    }
  }

  private enqueuePersist(): void {
    this.persistQueue = this.persistQueue.then(() => this.doPersist()).catch((err) => {
      console.error("[CITATION] Failed to persist state:", err);
    });
  }

  private async awaitPersist(): Promise<void> {
    const p = this.persistQueue.then(() => this.doPersist()).catch((err) => {
      console.error("[CITATION] Failed to persist state:", err);
    });
    this.persistQueue = p;
    await p;
  }

  private async doPersist(): Promise<void> {
    await storage.upsertBackgroundTask(TASK_TYPE, {
      status: this.state.status,
      phase: this.state.phase,
      progress: { processed: this.state.processed, total: this.state.total } satisfies TaskProgress,
      stats: { updated: this.state.updated } satisfies TaskStats,
      error: this.state.error,
      startTime: this.state.startTime ? new Date(this.state.startTime) : null,
      endTime: this.state.endTime ? new Date(this.state.endTime) : null,
      lastSuccessTime: this.lastSuccessTime ? new Date(this.lastSuccessTime) : null,
    });
  }

  isRunning(): boolean {
    return this.state.status === "running";
  }

  async start(total: number) {
    if (this.isRunning()) {
      throw new Error("Citation update is already running. Please wait for it to complete.");
    }

    this.state = {
      status: "running",
      phase: "Fetching citation counts from OpenAlex...",
      processed: 0,
      total,
      updated: 0,
      startTime: Date.now(),
      endTime: null,
      error: null,
    };
    await this.awaitPersist();
  }

  updatePhase(phase: string) {
    if (this.state.status === "running") {
      this.state.phase = phase;
    }
  }

  updateProgress(processed: number, updated: number) {
    if (this.state.status === "running") {
      this.state.processed = processed;
      this.state.updated = updated;
    }
  }

  persistProgress() {
    this.enqueuePersist();
  }

  async complete() {
    if (this.state.status === "running") {
      this.state.status = "completed";
      this.state.phase = "Update complete";
      this.state.endTime = Date.now();
      this.lastSuccessTime = Date.now();
      await this.awaitPersist();
      
      setTimeout(() => this.reset(), 60000);
    }
  }

  async error(errorMessage: string) {
    this.state.status = "error";
    this.state.phase = "Update failed";
    this.state.endTime = Date.now();
    this.state.error = errorMessage;
    await this.awaitPersist();
    
    setTimeout(() => this.reset(), 60000);
  }

  reset() {
    this.state = {
      status: "idle",
      phase: "Idle",
      processed: 0,
      total: 0,
      updated: 0,
      startTime: null,
      endTime: null,
      error: null,
    };
    this.enqueuePersist();
  }

  getStatus(): CitationUpdateState & { lastSuccessTime: number | null } {
    return {
      ...this.state,
      lastSuccessTime: this.lastSuccessTime,
    };
  }
}

export const citationTracker = new CitationUpdateTracker();

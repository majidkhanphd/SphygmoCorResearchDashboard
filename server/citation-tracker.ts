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

  isRunning(): boolean {
    return this.state.status === "running";
  }

  start(total: number) {
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

  complete() {
    if (this.state.status === "running") {
      this.state.status = "completed";
      this.state.phase = "Update complete";
      this.state.endTime = Date.now();
      this.lastSuccessTime = Date.now();
      
      setTimeout(() => this.reset(), 60000);
    }
  }

  error(errorMessage: string) {
    this.state.status = "error";
    this.state.phase = "Update failed";
    this.state.endTime = Date.now();
    this.state.error = errorMessage;
    
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
  }

  getStatus(): CitationUpdateState & { lastSuccessTime: number | null } {
    return {
      ...this.state,
      lastSuccessTime: this.lastSuccessTime,
    };
  }
}

export const citationTracker = new CitationUpdateTracker();

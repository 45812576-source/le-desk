/**
 * ConnectionManager: tracks backend reachability with 6-state FSM.
 * States: disconnected → connecting → ready → closing → disconnected
 *                                           ↘ failed → (retry) → connecting
 */

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "initializing"
  | "ready"
  | "closing"
  | "failed";

type Listener = (state: ConnectionState) => void;

class ConnectionManager {
  private state: ConnectionState = "disconnected";
  private retryCount = 0;
  private maxRetries = 5;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<Listener>();

  getState(): ConnectionState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setState(next: ConnectionState) {
    if (this.state === next) return;
    this.state = next;
    this.listeners.forEach((fn) => fn(next));
  }

  async connect(): Promise<void> {
    if (this.state === "ready" || this.state === "connecting") return;
    this.clearRetry();
    this.setState("connecting");
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const resp = await fetch("/api/proxy/health", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (resp.ok || resp.status === 404) {
        // 404 just means /health route doesn't exist — backend is reachable
        this.retryCount = 0;
        this.setState("ready");
      } else {
        throw new Error(`HTTP ${resp.status}`);
      }
    } catch {
      this.setState("failed");
      this.scheduleReconnect();
    }
  }

  disconnect() {
    this.clearRetry();
    this.setState("disconnected");
  }

  /** Call this when an SSE stream errors out */
  handleStreamError() {
    if (this.state === "ready") {
      this.setState("failed");
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.retryCount >= this.maxRetries) return;
    this.retryCount++;
    const delay = Math.min(1000 * 2 ** this.retryCount, 30000);
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  private clearRetry() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }
}

export const connectionManager = new ConnectionManager();

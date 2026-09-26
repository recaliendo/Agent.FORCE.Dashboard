import { spawn, type ChildProcess } from 'node:child_process';

/**
 * A minimal MCP client over stdio: newline-delimited JSON-RPC 2.0, which is
 * how every stdio MCP server (ofw-mcp included) speaks. Only the three calls
 * the dashboard needs — initialize, tools/list, tools/call.
 *
 * The server is started lazily on first use and kept running, because
 * ofw-mcp's first call pays for login and cache open; later searches are
 * instant.
 */

export interface McpServerSpec {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

export interface ToolCallResult {
  isError: boolean;
  text: string;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

const PROTOCOL_VERSION = '2025-06-18';

export class McpStdioClient {
  private proc: ChildProcess | null = null;
  private ready: Promise<void> | null = null;
  private buffer = '';
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private tools: string[] | null = null;
  /** The server's last stderr lines — the only place a startup failure explains itself. */
  private stderrTail: string[] = [];

  constructor(private readonly spec: McpServerSpec, private readonly timeoutMs = 120_000) {}

  start(): Promise<void> {
    if (this.ready === null) {
      this.ready = this.boot().catch((error: unknown) => {
        this.stop();
        throw error;
      });
    }
    return this.ready;
  }

  private async boot(): Promise<void> {
    const proc = spawn(this.spec.command, this.spec.args, {
      env: this.spec.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      // npx is a .cmd shim on Windows and cannot be spawned without a shell.
      shell: process.platform === 'win32',
      windowsHide: true
    });
    this.proc = proc;

    proc.stdout?.setEncoding('utf8');
    proc.stdout?.on('data', (chunk: string) => this.onData(chunk));
    proc.stderr?.setEncoding('utf8');
    proc.stderr?.on('data', (chunk: string) => {
      this.stderrTail = [...this.stderrTail, ...chunk.split('\n').filter(Boolean)].slice(-8);
    });
    const failAll = (reason: string) => {
      const detail = this.stderrTail.length ? `\n${this.stderrTail.join('\n')}` : '';
      for (const [id, p] of this.pending) {
        clearTimeout(p.timer);
        p.reject(new Error(`${reason}${detail}`));
        this.pending.delete(id);
      }
      this.proc = null;
      this.ready = null;
      this.tools = null;
    };
    proc.on('error', (error) => failAll(`Could not start the OFW connector (${this.describe()}): ${error.message}`));
    proc.on('exit', (code) => failAll(`The OFW connector exited (code ${code ?? 'unknown'}).`));

    await this.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'agent-force-dashboard', version: '0.1.0' }
    });
    this.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  }

  /** The command line, for error messages. Never includes env (credentials live there). */
  describe(): string {
    return [this.spec.command, ...this.spec.args].join(' ');
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let newline = this.buffer.indexOf('\n');
    while (newline !== -1) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      newline = this.buffer.indexOf('\n');
      if (!line) continue;
      let message: { id?: number; result?: unknown; error?: { message?: string } };
      try {
        message = JSON.parse(line);
      } catch {
        continue; // Not protocol output; a stdio server should never do this, but don't die on it.
      }
      if (typeof message.id !== 'number') continue; // A notification or a request from the server.
      const p = this.pending.get(message.id);
      if (!p) continue;
      clearTimeout(p.timer);
      this.pending.delete(message.id);
      if (message.error) p.reject(new Error(message.error.message ?? 'The OFW connector returned an error.'));
      else p.resolve(message.result);
    }
  }

  private send(message: Record<string, unknown>): void {
    if (!this.proc?.stdin?.writable) throw new Error('The OFW connector is not running.');
    this.proc.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private request(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`The OFW connector did not answer "${method}" within ${Math.round(this.timeoutMs / 1000)}s.`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.send({ jsonrpc: '2.0', id, method, params });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error as Error);
      }
    });
  }

  async listTools(): Promise<string[]> {
    await this.start();
    if (this.tools === null) {
      const result = (await this.request('tools/list', {})) as { tools?: Array<{ name: string }> };
      this.tools = (result.tools ?? []).map((t) => t.name);
    }
    return this.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    await this.start();
    const result = (await this.request('tools/call', { name, arguments: args })) as {
      isError?: boolean;
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (result.content ?? [])
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text as string)
      .join('\n');
    return { isError: result.isError === true, text };
  }

  stop(): void {
    this.proc?.kill();
    this.proc = null;
    this.ready = null;
    this.tools = null;
  }
}

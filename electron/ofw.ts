import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readRequest } from './ofw-policy.js';
import { localNaturalSearch } from './ofw-nlp/search.js';
import { redact } from './qwenDoctor.js';

type ToolResult = { isError?: boolean; content?: unknown; structuredContent?: unknown };

/** A tool result's JSON payload: structured content, else the first parseable text block. */
function payloadOf(result: ToolResult): Record<string, unknown> | undefined {
  if (result.structuredContent && typeof result.structuredContent === 'object') return result.structuredContent as Record<string, unknown>;
  for (const block of (result.content as {type:string;text?:string}[] | undefined) ?? []) {
    if (block.type === 'text' && block.text) { try { return JSON.parse(block.text); } catch { /* not JSON */ } }
  }
  return undefined;
}

/** Environment for the connector: everything it needs, minus the model's secrets. */
export function connectorEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined || /^(LLM|LLAMA)_/.test(key)) continue;
    out[key] = value;
  }
  return {
    ...out,
    OFW_WRITE_MODE: 'none', OFW_ALLOW_MARK_READ: 'false', OFW_FETCH_UNREAD_BODIES: 'false', OFW_CALENDAR_WRITES: 'false', OFW_DEBUG_LOG: 'false'
  };
}

/** The last lines a child wrote to stderr, capped, for error messages. */
export class StderrTail {
  private lines: string[] = [];
  private partial = '';
  constructor(private readonly maxLines = 20) {}
  push(chunk: Buffer | string) {
    const text = this.partial + chunk.toString();
    const parts = text.split(/\r?\n/);
    this.partial = parts.pop()?.slice(-2000) ?? '';
    // The connector's startup banner is noise, and anything else may carry a credential.
    for (const line of parts) if (line.trim() && !/^\[ofw-mcp\] This project/.test(line)) this.lines.push(redact(line.slice(0, 500)));
    if (this.lines.length > this.maxLines) this.lines.splice(0, this.lines.length - this.maxLines);
  }
  last(): string | undefined {
    const all = [...this.lines, this.partial].filter((l) => l.trim());
    return all[all.length - 1];
  }
}

export class OfwConnection {
  private client?: Client;
  private stderr = new StderrTail();
  private opening?: Promise<Client>;
  private toolNames = new Set<string>();
  constructor(private configFile: string) {}
  private async connect(): Promise<Client> {
    if (this.client) return this.client;
    if (this.opening) return this.opening;
    this.opening = (async () => {
      let config: {nodePath:string;launcherPath:string};
      try { config=JSON.parse(await readFile(this.configFile,'utf8')); }
      catch { throw new Error('OFW is not configured. Create ofw.local.json as described in docs/OFW-INTEGRATION.md to select your local read-only connector.'); }
      if (!path.isAbsolute(config.nodePath) || !path.isAbsolute(config.launcherPath)) throw new Error('OFW configuration requires absolute local paths.');
      const transport = new StdioClientTransport({command:config.nodePath,args:[config.launcherPath],stderr:'pipe',env:connectorEnv(process.env)});
      // stderr must be read continuously: an unread pipe fills (~64 KB of
      // connector warnings) and then blocks the connector mid-request.
      this.stderr = new StderrTail();
      const tail = this.stderr;
      transport.stderr?.on('data', (chunk: Buffer) => tail.push(chunk));
      const client = new Client({name:'agent-force-ofw',version:'0.1.0'});
      let writeTools = false;
      try {
        await client.connect(transport);
        const roster=await client.listTools();
        if(roster.tools.some(t=>/^ofw_(send|save|delete|upload|create|update)_/.test(t.name))) { writeTools = true; throw new Error('write tools'); }
        this.toolNames=new Set(roster.tools.map(t=>t.name));
        client.onclose=()=>{if(this.client===client)this.client=undefined;};
        this.client=client;
        return client;
      } catch (error) {
        await client.close().catch(() => undefined);
        if (writeTools) throw new Error('The connector exposes write tools. Configure OFW_WRITE_MODE=none before connecting.');
        const detail = tail.last() ?? (error instanceof Error ? error.message : '');
        throw new Error(`Could not start a verified read-only OFW connector. Check the configured Node and launcher paths.${detail ? ` Connector said: ${detail.slice(0, 300)}` : ''}`);
      }
    })();
    try { return await this.opening; } finally { this.opening=undefined; }
  }
  async request(action:unknown,input:unknown) {
    const request=readRequest(action,input);
    const client=await this.connect();
    if(request.name==='ofw_search_messages' && !this.toolNames.has('ofw_search_messages')) {
      // An older connector without natural-language search: rank its messages here.
      return localNaturalSearch(async (name, args) => {
        const listed=await client.callTool({name, arguments: args} as any, {timeout: 180000}) as ToolResult;
        const data=payloadOf(listed);
        if(data) return data;
        throw new Error(listed.isError ? 'OFW could not complete this read. Check your login, then retry.' : 'The connector returned no data.');
      }, request.arguments as any);
    }
    const result=await client.callTool(request as any, {timeout: 180000});
    if(result.isError && request.name==='ofw_search_messages') {
      // "Not verified" is a non-answer the panel explains and offers to fix — return it, don't throw.
      const refusal=payloadOf(result as ToolResult);
      if(refusal && typeof refusal.result==='string') return refusal;
    }
    if(result.isError) {
      const detail=payloadOf(result as ToolResult);
      const reason=typeof detail?.reason==='string'?detail.reason:undefined;
      const remedy=typeof detail?.remedy==='string'?detail.remedy:undefined;
      if(reason||remedy) throw new Error([reason,remedy].filter(Boolean).join(' '));
      if(typeof detail?.error==='string') throw new Error(detail.error);
      // A plain-text error (e.g. "OFW login failed: 403 Forbidden") is the message itself.
      const text=((result.content as {type:string;text?:string}[] | undefined) ?? []).find(b=>b.type==='text'&&b.text)?.text?.trim();
      throw new Error(text ? text.slice(0, 300) : 'OFW could not complete this read. Check your login, then retry.');
    }
    if(action==='connect') return {connected:true,readOnly:true,checkedAt:new Date().toISOString(),naturalLanguageSearch:this.toolNames.has('ofw_search_messages')?'connector':'local'};
    const data=payloadOf(result as ToolResult);
    if(data) return data;
    const text=((result.content as {type:string;text?:string}[] | undefined) ?? []).find(b=>b.type==='text'&&b.text)?.text;
    return text ? {note:text} : {note:'No structured content returned.'};
  }
  async close(){ await this.client?.close(); this.client=undefined; }
}

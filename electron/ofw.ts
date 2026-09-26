import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readRequest } from './ofw-policy.js';

export class OfwConnection {
  private client?: Client;
  private opening?: Promise<Client>;
  constructor(private configFile: string) {}
  private async connect(): Promise<Client> {
    if (this.client) return this.client;
    if (this.opening) return this.opening;
    this.opening = (async () => {
      let config: {nodePath:string;launcherPath:string};
      try { config=JSON.parse(await readFile(this.configFile,'utf8')); }
      catch { throw new Error('OFW is not configured. Follow docs/OFW.md to select your local read-only connector.'); }
      if (!path.isAbsolute(config.nodePath) || !path.isAbsolute(config.launcherPath)) throw new Error('OFW configuration requires absolute local paths.');
      const transport = new StdioClientTransport({command:config.nodePath,args:[config.launcherPath],stderr:'pipe',env:{
        ...Object.fromEntries(Object.entries(process.env).filter((p):p is [string,string]=>p[1]!==undefined)),
        OFW_WRITE_MODE:'none',OFW_ALLOW_MARK_READ:'false',OFW_FETCH_UNREAD_BODIES:'false',OFW_CALENDAR_WRITES:'false',OFW_DEBUG_LOG:'false'
      }});
      const client = new Client({name:'agent-force-ofw',version:'0.1.0'});
      try {
        await client.connect(transport);
        const roster=await client.listTools();
        if(roster.tools.some(t=>/^ofw_(send|save|delete|upload|create|update)_/.test(t.name))) throw new Error('The connector exposes write tools. Configure OFW_WRITE_MODE=none before connecting.');
        client.onclose=()=>{if(this.client===client)this.client=undefined;};
        this.client=client;
        return client;
      } catch { await client.close(); throw new Error('Could not start a verified read-only OFW connector. Check the configured Node and launcher paths.'); }
    })();
    try { return await this.opening; } finally { this.opening=undefined; }
  }
  async request(action:unknown,input:unknown) {
    const request=readRequest(action,input);
    const client=await this.connect();
    const result=await client.callTool(request as any, {timeout: 180000});
    if(result.isError) {
      const text = (result.content as {type:string;text?:string}[]).find((block) => block.type === 'text' && block.text)?.text;
      if (text) {
        try {
          const detail = JSON.parse(text) as Record<string, unknown>;
          const reason = typeof detail.reason === 'string' ? detail.reason : undefined;
          const remedy = typeof detail.remedy === 'string' ? detail.remedy : undefined;
          if (reason || remedy) throw new Error([reason, remedy].filter(Boolean).join(' '));
          if (typeof detail.error === 'string') throw new Error(detail.error);
        } catch (error) {
          if (error instanceof Error && error.message) throw error;
        }
      }
      throw new Error('OFW could not complete this read. Check your login, then retry.');
    }
    if(action==='connect') return {connected:true,readOnly:true,checkedAt:new Date().toISOString()};
    if(result.structuredContent) return result.structuredContent;
    for(const block of result.content as {type:string;text?:string}[]) {
      if(block.type==='text' && block.text) { try{return JSON.parse(block.text);}catch{return {note:block.text};} }
    }
    return {note:'No structured content returned.'};
  }
  async close(){ await this.client?.close(); this.client=undefined; }
}

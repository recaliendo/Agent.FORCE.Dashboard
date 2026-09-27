#!/usr/bin/env node
// Minimal MCP stdio server standing in for the OFW connector in tests.
// FAKE_OFW_MODE: 'flood' writes ~1 MB to stderr before answering (an unread
// stderr pipe would block it); 'write-tools' advertises a write tool;
// 'crash' prints a reason and exits before the handshake.
import readline from 'node:readline';

const mode = process.env.FAKE_OFW_MODE || 'ok';
if (mode === 'crash') {
  process.stderr.write('[ofw-mcp] This project was developed and is maintained by AI.\n');
  process.stderr.write('OFW auth: login failed with password=hunter2secret (403)\n');
  process.exit(3);
}
process.stderr.write('[ofw-mcp] This project was developed and is maintained by AI.\n');
const send = (msg) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`);
const tools = [
  { name: 'ofw_get_profile', inputSchema: { type: 'object' } },
  { name: 'ofw_list_messages', inputSchema: { type: 'object' } },
  ...(mode === 'write-tools' ? [{ name: 'ofw_send_message', inputSchema: { type: 'object' } }] : [])
];
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  let req;
  try { req = JSON.parse(line); } catch { return; }
  if (req.method === 'initialize') {
    send({ id: req.id, result: { protocolVersion: req.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'fake-ofw', version: '0' } } });
  } else if (req.method === 'tools/list') {
    send({ id: req.id, result: { tools } });
  } else if (req.method === 'tools/call') {
    if (mode === 'flood') {
      const line = `${'warning: lenient parse '.repeat(40)}\n`;
      for (let i = 0; i < 1200; i++) process.stderr.write(line); // ~1.1 MB
    }
    const env = { hasLlmKey: Boolean(process.env.LLM_API_KEY || process.env.LLAMA_API_KEY), writeMode: process.env.OFW_WRITE_MODE };
    send({ id: req.id, result: { content: [{ type: 'text', text: JSON.stringify({ tool: req.params.name, env }) }] } });
  } else if (req.id !== undefined) {
    send({ id: req.id, result: {} });
  }
});

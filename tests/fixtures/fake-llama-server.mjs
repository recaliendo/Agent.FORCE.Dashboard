#!/usr/bin/env node
// Stands in for llama-server.exe: records how it was launched, then serves
// /v1/models (503 "Loading model" for FAKE_LOAD_MS first, like the real one).
import http from 'node:http';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const port = Number(args[args.indexOf('--port') + 1]);
writeFileSync(process.env.FAKE_LLAMA_RECORD, JSON.stringify({ args, envKey: process.env.LLAMA_API_KEY ?? null }));
const readyAt = Date.now() + Number(process.env.FAKE_LOAD_MS || 0);
http.createServer((req, res) => {
  const loading = Date.now() < readyAt;
  res.writeHead(loading ? 503 : 200, { 'content-type': 'application/json' });
  res.end(loading ? '{"error":{"code":503,"message":"Loading model"}}' : '{"data":[]}');
}).listen(port, '127.0.0.1');

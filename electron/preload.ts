import { contextBridge, ipcRenderer } from 'electron';
import type { OfwSearchRequest } from './ofw/contract.js';

contextBridge.exposeInMainWorld('agentForce', {
  openExternal: (target: string) => ipcRenderer.invoke('agent-force:open-external', target),
  revealPath: (target: string) => ipcRenderer.invoke('agent-force:reveal-path', target),
  runCommand: (command: string) => ipcRenderer.invoke('agent-force:run-command', command),
  getPlatform: () => ipcRenderer.invoke('agent-force:get-platform'),
  ofwStatus: () => ipcRenderer.invoke('agent-force:ofw-status'),
  ofwSearch: (request: OfwSearchRequest) => ipcRenderer.invoke('agent-force:ofw-search', request)
});

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('agentForce', {
  openExternal: (target: string) => ipcRenderer.invoke('agent-force:open-external', target),
  revealPath: (target: string) => ipcRenderer.invoke('agent-force:reveal-path', target),
  runCommand: (command: string) => ipcRenderer.invoke('agent-force:run-command', command),
  getPlatform: () => ipcRenderer.invoke('agent-force:get-platform'),
  qwenConfig: () => ipcRenderer.invoke('agent-force:qwen-config'),
  qwenHealth: () => ipcRenderer.invoke('agent-force:qwen-health'),
  qwenChat: (messages: unknown[]) => ipcRenderer.invoke('agent-force:qwen-chat', messages),
  qwenStreamChat: (requestId: string, messages: unknown[], onEvent: (event: unknown) => void) => {
    const channel = `agent-force:qwen-stream:${requestId}`;
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => onEvent(payload);
    ipcRenderer.on(channel, listener);
    ipcRenderer.invoke('agent-force:qwen-stream-chat', requestId, messages).catch((error) => {
      onEvent({ type: 'error', error: error instanceof Error ? error.message : 'Qwen stream request failed.' });
    });
    return () => ipcRenderer.removeListener(channel, listener);
  }
});

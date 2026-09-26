import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('agentForce', {
  openExternal: (target: string) => ipcRenderer.invoke('agent-force:open-external', target),
  revealPath: (target: string) => ipcRenderer.invoke('agent-force:reveal-path', target),
  runCommand: (command: string) => ipcRenderer.invoke('agent-force:run-command', command),
  getPlatform: () => ipcRenderer.invoke('agent-force:get-platform'),
  ofw: (action: string, input?: Record<string, unknown>) => ipcRenderer.invoke('agent-force:ofw', action, input),
  qwenConfig: () => ipcRenderer.invoke('agent-force:qwen-config'),
  qwenHealth: () => ipcRenderer.invoke('agent-force:qwen-health'),
  qwenChat: (messages: unknown[]) => ipcRenderer.invoke('agent-force:qwen-chat', messages),
  ofwChatContext: (question: string) => ipcRenderer.invoke('agent-force:ofw-chat-context', question),
  ofwAnalyze: (requestId: string, request: Record<string, unknown>, onEvent: (event: unknown) => void) =>
    subscribeStream('agent-force:ofw-analyze', requestId, request, onEvent),
  qwenStreamChat: (requestId: string, messages: unknown[], onEvent: (event: unknown) => void) =>
    subscribeStream('agent-force:qwen-stream-chat', requestId, messages, onEvent)
});

/**
 * Listen on a request's stream channel, start it, and return a disposer that
 * cancels it if it has not finished. Qwen chat and grounded OFW analysis share
 * the channel format and cancellation.
 */
function subscribeStream(invokeChannel: string, requestId: string, payload: unknown, onEvent: (event: unknown) => void) {
  const channel = `agent-force:qwen-stream:${requestId}`;
  let settled = false;
  const listener = (_event: Electron.IpcRendererEvent, message: unknown) => {
    if (message && typeof message === 'object' && 'type' in message) {
      const type = (message as { type?: unknown }).type;
      if (type === 'done' || type === 'error') settled = true;
    }
    onEvent(message);
  };
  ipcRenderer.on(channel, listener);
  ipcRenderer.invoke(invokeChannel, requestId, payload).catch((error) => {
    settled = true;
    onEvent({ type: 'error', error: error instanceof Error ? error.message : 'Qwen stream request failed.' });
  });
  return () => {
    if (!settled) ipcRenderer.send('agent-force:qwen-cancel', requestId);
    ipcRenderer.removeListener(channel, listener);
  };
}

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('agentForce', {
  openExternal: (target: string) => ipcRenderer.invoke('agent-force:open-external', target),
  revealPath: (target: string) => ipcRenderer.invoke('agent-force:reveal-path', target),
  runCommand: (command: string) => ipcRenderer.invoke('agent-force:run-command', command),
  getPlatform: () => ipcRenderer.invoke('agent-force:get-platform'),
  pentestpal: (request: unknown) => ipcRenderer.invoke('agent-force:pentestpal', request),
  ofw: (action: string, input?: Record<string, unknown>) => ipcRenderer.invoke('agent-force:ofw', action, input),
  qwenConfig: () => ipcRenderer.invoke('agent-force:qwen-config'),
  qwenHealth: () => ipcRenderer.invoke('agent-force:qwen-health'),
  qwenDoctor: (appBuild?: string) => ipcRenderer.invoke('agent-force:qwen-doctor', appBuild),
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
  ipcRenderer.invoke(invokeChannel, requestId, payload).then((result: unknown) => {
    // A request refused before streaming (bad id, untrusted sender) returns
    // ok:false without an event; surface it so the UI never waits forever.
    const r = result as { ok?: unknown; error?: unknown } | undefined;
    if (!settled && r && r.ok === false) {
      settled = true;
      onEvent({ type: 'error', error: typeof r.error === 'string' ? r.error : 'Qwen stream request failed.' });
    }
  }, (error) => {
    if (settled) return;
    settled = true;
    onEvent({ type: 'error', error: error instanceof Error ? error.message : 'Qwen stream request failed.' });
  });
  return () => {
    if (!settled) ipcRenderer.send('agent-force:qwen-cancel', requestId);
    ipcRenderer.removeListener(channel, listener);
  };
}

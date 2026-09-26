export interface SseDataParser {
  push(chunk: Uint8Array): void;
  finish(): void;
}

export function createSseDataParser(onData: (data: string) => void): SseDataParser {
  const decoder = new TextDecoder();
  let textBuffer = '';
  let dataLines: string[] = [];

  function dispatchEvent() {
    if (!dataLines.length) return;
    onData(dataLines.join('\n'));
    dataLines = [];
  }

  function processLine(rawLine: string) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (!line) {
      dispatchEvent();
      return;
    }
    if (line.startsWith(':') || !line.startsWith('data:')) return;
    const value = line.slice(5);
    dataLines.push(value.startsWith(' ') ? value.slice(1) : value);
  }

  function drainCompleteLines() {
    let newlineIndex = textBuffer.indexOf('\n');
    while (newlineIndex >= 0) {
      processLine(textBuffer.slice(0, newlineIndex));
      textBuffer = textBuffer.slice(newlineIndex + 1);
      newlineIndex = textBuffer.indexOf('\n');
    }
  }

  return {
    push(chunk) {
      textBuffer += decoder.decode(chunk, { stream: true });
      drainCompleteLines();
    },
    finish() {
      textBuffer += decoder.decode();
      drainCompleteLines();
      if (textBuffer) {
        processLine(textBuffer);
        textBuffer = '';
      }
      dispatchEvent();
    }
  };
}

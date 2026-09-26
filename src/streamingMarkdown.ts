export type MarkdownBlockType = 'paragraph' | 'heading' | 'unordered-list' | 'ordered-list' | 'code';

export interface MarkdownBlock {
  type: MarkdownBlockType;
  text?: string;
  level?: number;
  items?: string[];
  pending?: boolean;
}

export interface MarkdownStreamCache {
  source: string;
  parsedLength: number;
  blocks: MarkdownBlock[];
  fenceLines: string[] | null;
}

export interface MarkdownStreamResult {
  cache: MarkdownStreamCache;
  blocks: MarkdownBlock[];
}

export function createMarkdownStreamCache(): MarkdownStreamCache {
  return { source: '', parsedLength: 0, blocks: [], fenceLines: null };
}

function appendListItem(cache: MarkdownStreamCache, type: 'unordered-list' | 'ordered-list', item: string) {
  const last = cache.blocks[cache.blocks.length - 1];
  if (last?.type === type) {
    last.items = [...(last.items ?? []), item];
  } else {
    cache.blocks.push({ type, items: [item] });
  }
}

function appendStableLine(cache: MarkdownStreamCache, line: string) {
  if (line.startsWith('```')) {
    if (cache.fenceLines) {
      cache.blocks.push({ type: 'code', text: cache.fenceLines.join('\n') });
      cache.fenceLines = null;
    } else {
      cache.fenceLines = [];
    }
    return;
  }

  if (cache.fenceLines) {
    cache.fenceLines.push(line);
    return;
  }

  const heading = /^(#{1,3})\s+(.+)$/.exec(line);
  if (heading) {
    cache.blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
    return;
  }

  const unordered = /^[-*]\s+(.+)$/.exec(line);
  if (unordered) {
    appendListItem(cache, 'unordered-list', unordered[1]);
    return;
  }

  const ordered = /^\d+[.]\s+(.+)$/.exec(line);
  if (ordered) {
    appendListItem(cache, 'ordered-list', ordered[1]);
    return;
  }

  if (line.trim()) cache.blocks.push({ type: 'paragraph', text: line });
}

export function updateMarkdownStream(
  previous: MarkdownStreamCache,
  content: string,
  complete: boolean
): MarkdownStreamResult {
  const cache = content.startsWith(previous.source) ? previous : createMarkdownStreamCache();
  cache.source = content;

  const finalLineBreak = content.lastIndexOf('\n');
  const stableEnd = complete ? content.length : finalLineBreak + 1;
  const stableChunk = content.slice(cache.parsedLength, stableEnd);

  if (stableChunk) {
    const lines = stableChunk.split('\n');
    if (stableChunk.endsWith('\n')) lines.pop();
    lines.forEach((line) => appendStableLine(cache, line));
    cache.parsedLength = stableEnd;
  }

  const blocks: MarkdownBlock[] = cache.blocks.map((block) => ({
    ...block,
    items: block.items ? [...block.items] : undefined
  }));
  const pending = content.slice(cache.parsedLength);

  if (cache.fenceLines) {
    blocks.push({
      type: 'code',
      text: [...cache.fenceLines, pending].filter(Boolean).join('\n'),
      pending: !complete
    });
  } else if (pending) {
    blocks.push({ type: 'paragraph', text: pending, pending: true });
  }

  return { cache, blocks };
}

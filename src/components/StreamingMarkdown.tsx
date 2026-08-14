import { useRef, type ReactNode } from 'react';
import { createMarkdownStreamCache, updateMarkdownStream } from '../streamingMarkdown';

function renderInline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    return part;
  });
}

export function StreamingMarkdown({ content, complete }: { content: string; complete: boolean }) {
  const cacheRef = useRef(createMarkdownStreamCache());
  const result = updateMarkdownStream(cacheRef.current, content, complete);
  cacheRef.current = result.cache;

  return (
    <div className="streaming-markdown">
      {result.blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === 'heading') {
          if (block.level === 1) return <h1 key={key}>{renderInline(block.text ?? '')}</h1>;
          if (block.level === 2) return <h2 key={key}>{renderInline(block.text ?? '')}</h2>;
          return <h3 key={key}>{renderInline(block.text ?? '')}</h3>;
        }
        if (block.type === 'unordered-list') {
          return <ul key={key}>{block.items?.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ul>;
        }
        if (block.type === 'ordered-list') {
          return <ol key={key}>{block.items?.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ol>;
        }
        if (block.type === 'code') return <pre key={key}><code>{block.text}</code></pre>;
        return <p key={key} className={block.pending ? 'markdown-pending' : ''}>{renderInline(block.text ?? '')}</p>;
      })}
    </div>
  );
}

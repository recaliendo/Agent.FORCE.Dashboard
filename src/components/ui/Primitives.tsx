import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  variant = 'secondary',
  icon,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; icon?: ReactNode }) {
  return (
    <button className={`ui-button ui-button-${variant} ${className}`.trim()} {...props}>
      {icon}
      {children}
    </button>
  );
}

export function Card({ className = '', children, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`ui-card ${className}`.trim()} {...props}>{children}</section>;
}

export function Badge({ tone = 'neutral', className = '', children, ...props }: HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  return <span className={`ui-badge ui-badge-${tone} ${className}`.trim()} {...props}>{children}</span>;
}

export function StatusDot({ tone = 'neutral', label }: { tone?: 'neutral' | 'success' | 'warning' | 'danger'; label: string }) {
  return <span className={`ui-status-dot ui-status-${tone}`} role="status"><i aria-hidden="true" />{label}</span>;
}

export function StatTile({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="ui-stat-tile">
      <strong>{value}</strong>
      <span>{label}</span>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export function ListRow({ title, detail, action }: { title: ReactNode; detail?: ReactNode; action?: ReactNode }) {
  return (
    <div className="ui-list-row">
      <div><strong>{title}</strong>{detail ? <span>{detail}</span> : null}</div>
      {action}
    </div>
  );
}

export function EmptyState({ title = 'No data available', detail }: { title?: string; detail?: ReactNode }) {
  return (
    <div className="ui-empty-state" role="status">
      <strong>{title}</strong>
      {detail ? <span>{detail}</span> : null}
    </div>
  );
}

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
  badge?: number;
}

export function Tabs<T extends string>({ items, activeId, onChange, label }: {
  items: TabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <nav className="ui-tabs" aria-label={label} role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={activeId === item.id}
          className={activeId === item.id ? 'active' : ''}
          onClick={() => onChange(item.id)}
        >
          {item.icon}
          <span>{item.label}</span>
          {Boolean(item.badge) && (
            <i className="tab-badge" aria-label={`${item.badge} attention item${item.badge === 1 ? '' : 's'}`}>{item.badge}</i>
          )}
        </button>
      ))}
    </nav>
  );
}

export function ActionCard({ label, reason, onAction, rationale }: {
  label: string;
  reason: string;
  onAction: () => void;
  rationale?: string;
}) {
  return (
    <Card className="action-card">
      <div>
        <span className="action-card-label">Next best action</span>
        <h2>{label}</h2>
        <p>{reason}</p>
        <div className="action-rationale" data-qwen-rationale-slot aria-live="polite">
          <strong>Qwen rationale</strong>
          <span>{rationale ?? 'Available on request; deterministic readiness remains the source of action ranking.'}</span>
        </div>
      </div>
      <Button variant="primary" onClick={onAction}>{label}</Button>
    </Card>
  );
}

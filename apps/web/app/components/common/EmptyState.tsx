import type { ReactNode } from "react";

type EmptyStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  muted?: boolean;
};

export function EmptyState({
  eyebrow,
  title,
  description,
  action,
  muted = false
}: EmptyStateProps) {
  return (
    <div className={`empty-state${muted ? " muted" : ""}`}>
      <div className="empty-state-illustration" aria-hidden="true">
        <span className="empty-state-chip" />
        <span className="empty-state-table" />
      </div>
      <p className="eyebrow">{eyebrow}</p>
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}

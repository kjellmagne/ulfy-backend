"use client";

import { ReactNode } from "react";
import { Info, Loader2 } from "lucide-react";

export function PageHeader({ title, description, meta }: { title: string; description?: string; meta?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {meta && <div className="page-meta">{meta}</div>}
    </div>
  );
}

export function PanelHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="panel-header">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="panel-actions">{actions}</div>}
    </div>
  );
}

export function FieldLabel({ children, help }: { children: ReactNode; help?: string }) {
  return (
    <label className="field-label">
      <span>{children}</span>
      {help && <InfoTip text={help} />}
    </label>
  );
}

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="info-tip" tabIndex={0} aria-label={text}>
      <Info size={14} />
      <span role="tooltip">{text}</span>
    </span>
  );
}

export function StatusBadge({ status }: { status?: string | null }) {
  const value = status ?? "unknown";
  return <span className={`badge status-${value}`}>{value}</span>;
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {message && <span>{message}</span>}
    </div>
  );
}

export function LoadingPanel({ label = "Loading" }: { label?: string }) {
  return (
    <div className="panel loading-panel">
      <Loader2 size={18} />
      <span>{label}</span>
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "success" | "danger"; children: ReactNode }) {
  return <div className={`alert ${tone}`}>{children}</div>;
}

"use client";

import { ReactNode, useEffect, useId } from "react";
import { Info, Loader2, X } from "lucide-react";

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

export function EmptyState({ title, message, icon, action }: { title: string; message?: string; icon?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      {icon && <div style={{ fontSize: '36px', marginBottom: '12px' }}>{icon}</div>}
      <strong>{title}</strong>
      {message && <span>{message}</span>}
      {action && <div style={{ marginTop: '20px' }}>{action}</div>}
    </div>
  );
}

export function LoadingPanel({ label = "Loading" }: { label?: string }) {
  return (
    <div className="loading-panel">
      <Loader2 size={18} />
      <span>{label}</span>
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "success" | "danger"; children: ReactNode }) {
  return <div className={`alert ${tone}`}>{children}</div>;
}

export function Modal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  wide = false
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </section>
    </div>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return <div className="card" style={style}>{children}</div>;
}

export function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="panel-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function StatCard({ label, value, icon, sub }: { label: string; value: number | string; icon: ReactNode; sub?: string }) {
  return (
    <div className="metric-card">
      <div className="metric-topline">
        <div className="metric-label">{label}</div>
        <span className="metric-icon">{icon}</span>
      </div>
      <div className="metric-value">{value}</div>
      {sub && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '5px' }}>{sub}</div>}
    </div>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="usage-track">
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

"use client";

import { ButtonHTMLAttributes, ReactNode, RefObject, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

export function FormSection({ title, description, children, actions }: { title: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="form-section">
      <div className="form-section-header">
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="panel-actions">{actions}</div>}
      </div>
      <div className="form-section-body">{children}</div>
    </section>
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
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <span
      ref={anchorRef}
      className="info-tip"
      tabIndex={0}
      aria-label={text}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setOpen((current) => !current);
      }}
    >
      <Info size={14} />
      <FloatingTooltip text={text} anchorRef={anchorRef} open={open} />
    </span>
  );
}

function FloatingTooltip({ text, anchorRef, open }: { text: string; anchorRef: RefObject<HTMLElement | null>; open: boolean }) {
  const [position, setPosition] = useState<{ left: number; top: number; placement: "top" | "bottom" } | null>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const hasRoomAbove = rect.top > 72;
      const tooltipWidth = Math.min(440, window.innerWidth - 32);
      const minLeft = 16 + tooltipWidth / 2;
      const maxLeft = window.innerWidth - 16 - tooltipWidth / 2;
      const centeredLeft = rect.left + rect.width / 2;
      setPosition({
        left: Math.min(Math.max(centeredLeft, minLeft), maxLeft),
        top: hasRoomAbove ? rect.top - 8 : rect.bottom + 8,
        placement: hasRoomAbove ? "top" : "bottom"
      });
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [anchorRef, open]);

  if (!open || !position || typeof document === "undefined") return null;

  return createPortal(
    <span
      id={tooltipId}
      className={`floating-tooltip ${position.placement}`}
      role="tooltip"
      style={{ left: position.left, top: position.top }}
    >
      {text}
    </span>,
    document.body
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

export function IconAction({
  label,
  tone = "secondary",
  children,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  tone?: "primary" | "secondary" | "danger";
  children: ReactNode;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const isDisabled = Boolean(props.disabled);

  return (
    <button
      {...props}
      ref={anchorRef}
      type={type}
      className={["icon-action", `tone-${tone}`, className].filter(Boolean).join(" ")}
      aria-label={label}
      onMouseEnter={(event) => {
        props.onMouseEnter?.(event);
        if (!isDisabled) setTooltipOpen(true);
      }}
      onMouseLeave={(event) => {
        props.onMouseLeave?.(event);
        setTooltipOpen(false);
      }}
      onFocus={(event) => {
        props.onFocus?.(event);
        if (!isDisabled) setTooltipOpen(true);
      }}
      onBlur={(event) => {
        props.onBlur?.(event);
        setTooltipOpen(false);
      }}
    >
      <span className="sr-only">{label}</span>
      {children}
      <FloatingTooltip text={label} anchorRef={anchorRef} open={tooltipOpen && !isDisabled} />
    </button>
  );
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

export function SidePanel({
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
    <div className="side-panel-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className={`side-panel${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="side-panel-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close panel">
            <X size={18} />
          </button>
        </div>
        <div className="side-panel-body">{children}</div>
        {footer && <div className="side-panel-footer">{footer}</div>}
      </aside>
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
      {sub && <div className="metric-subtitle">{sub}</div>}
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

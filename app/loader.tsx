"use client";

/**
 * One spinner for the whole app, so every wait looks the same instead of the
 * page filling in piece by piece.
 */
export function ChoirLoader({ label = "Loading…", variant = "block" }: { label?: string; variant?: "block" | "page" | "panel" }) {
  return (
    <div className={`choir-loader choir-loader-${variant}`} role="status" aria-live="polite">
      <span className="choir-spinner" aria-hidden="true" />
      <span className="choir-loader-label">{label}</span>
    </div>
  );
}

/** A small spinner that sits inside a button while its action is running. */
export function ButtonSpinner() {
  return <span className="button-spinner" aria-hidden="true" />;
}

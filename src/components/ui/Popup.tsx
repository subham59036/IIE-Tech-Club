/**
 * components/ui/Popup.tsx
 * Confirm dialog (yes/no) and Alert dialog (ok).
 * Usage:
 *   <Popup type="confirm" message="Delete this?" onConfirm={…} onCancel={…} />
 *   <Popup type="alert"   message="Saved!"       onClose={…} />
 */

"use client";

import Button from "./Button";

interface ConfirmPopupProps {
  type:      "confirm";
  message:   string;
  onConfirm: () => void;
  onCancel:  () => void;
  loading?:  boolean;
  confirmLabel?: string;
  danger?:   boolean;
}

interface AlertPopupProps {
  type:    "alert";
  message: string;
  onClose: () => void;
  variant?: "success" | "error" | "info";
}

type PopupProps = ConfirmPopupProps | AlertPopupProps;

const ICONS = {
  success: "✓",
  error:   "✕",
  info:    "ℹ",
};

export default function Popup(props: PopupProps) {
  if (props.type === "confirm") {
    const { message, onConfirm, onCancel, loading, confirmLabel = "Confirm", danger = false } = props;
    return (
      <div className="popup-overlay">
        <div className="popup-box max-w-sm">
          <p className="text-sm text-slate-300 mb-6 text-center leading-relaxed">{message}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="secondary" onClick={onCancel} disabled={loading} size="sm">Cancel</Button>
            <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading} size="sm">
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { message, onClose, variant = "info" } = props;
  const colors = {
    success: "text-green-400",
    error:   "text-red-400",
    info:    "text-indigo-400",
  };

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-box max-w-sm text-center">
        <div className={`text-3xl mb-3 ${colors[variant]}`}>{ICONS[variant]}</div>
        <p className="text-sm text-slate-300 mb-5 leading-relaxed">{message}</p>
        <Button variant="primary" onClick={onClose} size="sm">OK</Button>
      </div>
    </div>
  );
}

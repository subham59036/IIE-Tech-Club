/**
 * components/ui/Modal.tsx
 * Generic modal overlay wrapper with title + close button.
 * Usage: <Modal title="Add Admin" onClose={() => setOpen(false)}> …form… </Modal>
 */

"use client";

import React, { useEffect } from "react";

interface ModalProps {
  title:    string;
  onClose:  () => void;
  children: React.ReactNode;
  width?:   string; // e.g. "max-w-lg"
}

export default function Modal({ title, onClose, children, width = "max-w-md" }: ModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="popup-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`popup-box ${width} w-full`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

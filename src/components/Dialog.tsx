import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface DialogProps {
  label: string;
  className: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
}

export function Dialog({ label, className, onClose, children, busy = false }: DialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog ref={dialog} className={className} aria-label={label} aria-busy={busy}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      {children}
    </dialog>
  );
}

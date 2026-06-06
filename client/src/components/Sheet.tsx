import { ReactNode, useEffect } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Max width on desktop. Default ~480px. */
  maxWidth?: string;
  footer?: ReactNode;
};

export function Sheet({ open, onClose, title, children, maxWidth = '480px', footer }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex md:items-center md:justify-center items-end">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fadein"
        onClick={onClose}
      />
      {/* panel */}
      <div
        className="relative glass-strong w-full md:w-auto md:mx-4 max-h-[92vh] flex flex-col animate-rise md:animate-popin overflow-hidden"
        style={{
          maxWidth,
        }}
      >
        {/* drag handle mobile only */}
        <div className="md:hidden flex justify-center pt-2">
          <div className="w-10 h-1.5 rounded-full bg-black/20 dark:bg-white/20" />
        </div>
        {title !== undefined && (
          <div className="px-5 pt-3 md:pt-5 pb-2 flex items-center gap-3">
            <div className="font-display text-lg font-semibold flex-1 min-w-0 truncate">{title}</div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-full w-9 h-9 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 spring"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M6 6l12 12M18 6l-6 6-6 6" /></svg>
            </button>
          </div>
        )}
        <div className="px-5 py-3 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-white/10 dark:border-white/5 flex items-center justify-end gap-2 bg-black/0">
            {footer}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rise { from { transform: translateY(20%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes popin { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-fadein { animation: fadein 180ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .animate-rise { animation: rise 260ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .animate-popin { animation: popin 220ms cubic-bezier(0.22, 1, 0.36, 1) both; }
      `}</style>
    </div>
  );
}

export function ConfirmDialog({
  open, onClose, onConfirm,
  title, message, confirmLabel = 'OK', cancelLabel = 'Cancel', danger = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} maxWidth="420px"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>{cancelLabel}</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={() => { onConfirm(); onClose(); }}>
            {confirmLabel}
          </button>
        </>
      }
    >
      {message && <p className="text-sm muted leading-relaxed">{message}</p>}
    </Sheet>
  );
}

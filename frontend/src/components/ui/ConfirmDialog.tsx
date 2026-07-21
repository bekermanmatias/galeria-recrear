import { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'success';
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const accent = tone === 'danger' ? '#DC2626' : '#15803D';
  const soft = tone === 'danger' ? '#FEF2F2' : '#F0FDF4';
  const Icon = tone === 'danger' ? AlertTriangle : CheckCircle2;

  return (
    <div
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background: 'rgba(15, 23, 42, .55)',
        backdropFilter: 'blur(3px)',
        animation: 'fadeIn .16s ease-out',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        style={{
          width: 'min(100%, 430px)',
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
          borderRadius: 14,
          background: '#fff',
          boxShadow: '0 24px 60px rgba(15, 23, 42, .24)',
          animation: 'modalIn .18s ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '24px 24px 18px' }}>
          <div style={{ width: 42, height: 42, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 12, background: soft, color: accent }}>
            <Icon size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 id="confirm-dialog-title" style={{ margin: '1px 0 7px', color: '#1A4B77', fontSize: 18 }}>{title}</h3>
            <p id="confirm-dialog-description" style={{ margin: 0, color: '#64748B', fontSize: 13, lineHeight: 1.55 }}>{description}</p>
          </div>
          <button aria-label="Cerrar" disabled={busy} onClick={onCancel} style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', border: 0, borderRadius: '50%', background: '#F8FAFC', color: '#64748B', cursor: busy ? 'not-allowed' : 'pointer' }}>
            <X size={17} />
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid #EEF2F7', background: '#FAFCFE' }}>
          <button disabled={busy} onClick={onCancel} style={{ padding: '10px 16px', border: '1px solid #DCE3EB', borderRadius: 7, background: '#fff', color: '#475569', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}>
            {cancelLabel}
          </button>
          <button ref={confirmRef} disabled={busy} onClick={onConfirm} style={{ minWidth: 108, padding: '10px 16px', border: 0, borderRadius: 7, background: accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: busy ? .65 : 1 }}>
            {busy ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes modalIn { from { opacity: 0; transform: translateY(8px) scale(.985) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  );
}

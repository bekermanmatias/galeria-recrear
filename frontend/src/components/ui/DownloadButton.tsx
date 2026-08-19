import { useState, type CSSProperties, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { saveDownload } from '../../lib/download';

type Props = {
  load: () => Promise<Blob>;
  name: string;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  title?: string;
  ariaLabel?: string;
  compact?: boolean;
  onClick?: () => void;
};

export default function DownloadButton({ load, name, children, style, className, title, ariaLabel, compact, onClick }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const download = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      saveDownload(await load(), name);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo preparar la descarga.');
    } finally {
      setBusy(false);
    }
  };
  return <>
    <button type="button" className={className} onClick={() => { onClick?.(); void download(); }} disabled={busy} title={busy ? 'Preparando descarga…' : title} aria-label={ariaLabel} aria-busy={busy} style={{ ...style, cursor: busy ? 'wait' : style?.cursor, opacity: busy ? .7 : style?.opacity }}>
      {busy ? <><LoaderCircle size={compact ? 16 : 15} className="download-spinner"/><span className={compact ? 'sr-only' : undefined}>Preparando descarga…</span></> : children}
    </button>
    {error && <span role="alert" style={{ display: 'block', color: '#B91C1C', fontSize: 12, marginTop: 6 }}>{error}</span>}
  </>;
}

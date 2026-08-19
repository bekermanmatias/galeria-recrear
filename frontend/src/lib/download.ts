export async function fetchDownload(url: string, init?: RequestInit): Promise<Blob> {
  const response = await fetch(url, { credentials: 'include', ...init });
  if (!response.ok) throw new Error('No se pudo preparar la descarga. Intentá nuevamente.');
  return response.blob();
}

export function saveDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function downloadFile(url: string, name: string, init?: RequestInit) {
  saveDownload(await fetchDownload(url, init), name);
}

const activeControls = new Map<HTMLElement, string>();

function isDownloadControl(element: Element | null) {
  const control = element?.closest<HTMLElement>('button, a');
  if (!control) return false;
  const href = control instanceof HTMLAnchorElement ? control.href : '';
  const label = `${control.textContent ?? ''} ${control.getAttribute('title') ?? ''} ${control.getAttribute('aria-label') ?? ''}`;
  return /\/download(?:$|\?)/.test(href) || /descargar/i.test(label);
}

function setBusy(control: HTMLElement) {
  if (activeControls.has(control)) return;
  activeControls.set(control, control.innerHTML);
  if (control instanceof HTMLButtonElement) control.disabled = true;
  control.setAttribute('aria-busy', 'true');
  control.style.pointerEvents = 'none';
  control.style.cursor = 'wait';
  control.style.opacity = '.7';
  control.innerHTML = '<span class="download-spinner" aria-hidden="true">◌</span><span> Preparando descarga…</span>';
}

function restore(control: HTMLElement, error?: string) {
  const original = activeControls.get(control);
  if (original === undefined) return;
  activeControls.delete(control);
  control.innerHTML = original;
  if (control instanceof HTMLButtonElement) control.disabled = false;
  control.removeAttribute('aria-busy');
  control.style.pointerEvents = '';
  control.style.cursor = '';
  control.style.opacity = '';
  if (error) {
    const alert = document.createElement('span');
    alert.setAttribute('role', 'alert');
    alert.textContent = error;
    alert.style.cssText = 'display:block;color:#B91C1C;font-size:12px;margin-top:6px;';
    control.insertAdjacentElement('afterend', alert);
    window.setTimeout(() => alert.remove(), 6_000);
  }
}

export function finishPendingDownloads(error?: string) {
  [...activeControls.keys()].forEach(control => restore(control, error));
}

export function installDownloadFeedback() {
  if (typeof document === 'undefined' || document.documentElement.dataset.downloadFeedback) return;
  document.documentElement.dataset.downloadFeedback = 'true';
  document.addEventListener('click', event => {
    const control = isDownloadControl(event.target as Element);
    if (!control || activeControls.has(control)) return;
    if (control instanceof HTMLAnchorElement && /\/download(?:$|\?)/.test(control.href)) {
      event.preventDefault();
      setBusy(control);
      void downloadFile(control.href, control.download || 'recrear-descarga')
        .then(() => restore(control))
        .catch(() => restore(control, 'No se pudo preparar la descarga. Intentá nuevamente.'));
      return;
    }
    setBusy(control);
  }, true);
}

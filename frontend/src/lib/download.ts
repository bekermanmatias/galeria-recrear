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

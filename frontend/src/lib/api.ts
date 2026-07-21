const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export type Role = 'ADMIN' | 'COORDINATOR' | 'PARENT';
export interface SessionUser { id: string; name: string; email: string; role: Role; }
export interface School { id: string; name: string; code: string; bot_code: string; start_date?: string | null; end_date?: string | null; active?: boolean; coordinator_ids?: string[]; coordinators?: string[]; }
export interface CatalogItem { id: string; name: string; bot_code: string; active?: boolean; sort_order?: number; }
export interface AdminUser { id: string; name: string; email: string; role: Role; active: boolean; school_ids?: string[]; }
export interface LotSummary { id: string; event_date: string; school_id: string; school_name: string; activity_name: string; shift_name: string; version_id: string; version_number: number; status: string; approved_count: number; submitted_at?: string | null; version_created_at?: string | null; }
export interface Media { id: string; kind: 'IMAGE' | 'VIDEO'; status: string; original_name: string; mime_type: string; size_bytes: number; purge_after?: string | null; }

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    if (!response.ok) throw new Error('No se pudo completar la solicitud');
    return await response.blob() as T;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || 'No se pudo completar la solicitud');
  return data as T;
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...init.headers },
    ...init,
  });
  return parseResponse<T>(response);
}

export const adminRequest = <T>(path: string, init: RequestInit = {}) => request<T>(`/admin${path}`, init);

export const api = {
  login: (email: string, password: string) => request<{ user: SessionUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  me: () => request<{ user: SessionUser }>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) => request<void>('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  mySchools: () => request<{ items: School[] }>('/lots/my-schools'),
  catalogs: (schoolId: string) => request<{ activities: CatalogItem[]; shifts: CatalogItem[] }>(`/lots/catalogs?schoolId=${schoolId}`),
  lots: (status?: string) => request<{ items: LotSummary[] }>(`/lots${status ? `?status=${status}` : ''}`),
  lot: (id: string) => request<{ lot: LotSummary; version: { id: string; status: string; version_number: number }; media: Media[] }>(`/lots/${id}`),
  createLot: (body: { schoolId: string; activityId: string; shiftId: string; eventDate: string }) => request<{ lotId: string; versionId: string; existing: boolean }>('/lots', { method: 'POST', body: JSON.stringify(body) }),
  uploadMedia: (lotId: string, file: File) => { const body = new FormData(); body.append('file', file); return request<{ id: string }>(`/lots/${lotId}/media`, { method: 'POST', body }); },
  submitLot: (lotId: string) => request<void>(`/lots/${lotId}/submit`, { method: 'POST' }),
  reopenLot: (lotId: string) => request<void>(`/lots/${lotId}/reopen`, { method: 'POST' }),
  approveLot: (lotId: string) => request<void>(`/lots/${lotId}/approve`, { method: 'POST' }),
  moderateMedia: (mediaId: string, action: 'reject' | 'restore') => request<void>(`/lots/media/${mediaId}/moderation`, { method: 'PATCH', body: JSON.stringify({ action }) }),
  downloadZip: (mediaIds: string[]) => request<Blob>('/media/downloads/zip', { method: 'POST', body: JSON.stringify({ mediaIds }) }),
  contentUrl: (mediaId: string) => `${API_URL}/media/${mediaId}/content`,
  thumbnailUrl: (mediaId: string) => `${API_URL}/media/${mediaId}/thumbnail`,
  downloadUrl: (mediaId: string) => `${API_URL}/media/${mediaId}/download`,
};







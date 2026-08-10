const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export type Role = 'ADMIN' | 'COORDINATOR' | 'PARENT';
export interface SessionUser { id: string; name: string; email: string; role: Role; permissions?: PermissionMatrix; isAdmin?: boolean; }
export interface School { id: string; name: string; code: string; bot_code: string; start_date?: string | null; end_date?: string | null; active?: boolean; coordinator_ids?: string[]; coordinators?: string[]; public_link_active?: boolean | null; public_link_generated_at?: string | null; public_link_revoked_at?: string | null; public_link_token?: string | null; }
export interface Departure { id: string; type: 'MICRO' | 'AEREO'; name: string; destination: string; event_date: string; start_date: string; end_date: string; active: boolean; archived_at?: string | null; public_code?: string; public_access_active?: boolean; school_ids?: string[]; school_names?: string[]; school_codes?: string[]; coordinator_ids?: string[]; coordinator_names?: string[]; lot_count?: number; }
export interface CatalogItem { id: string; name: string; bot_code: string; active?: boolean; sort_order?: number; }
export interface AdminUser { id: string; name: string; email: string; role: Role; active: boolean; school_ids?: string[]; departure_ids?: string[]; departure_names?: string[]; custom_permission_count?: number; has_global_access?: boolean; permission_mode?: 'GLOBAL' | 'DEFAULT' | 'CUSTOM'; }
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';
export type PermissionModule = 'departures' | 'lots' | 'moderation' | 'gallery' | 'activities' | 'schools' | 'passengers' | 'users' | 'imports';
export type PermissionMatrix = Record<PermissionModule, Record<PermissionAction, boolean>>;
export interface UserPermissions { role: Role; customized: boolean; permissions: PermissionMatrix; }
export interface LotSummary { id: string; event_date: string; school_id: string | null; school_name: string; departure_id?: string; departure_name?: string; departure_destination?: string; departure_type?: 'MICRO' | 'AEREO'; departure_public_code?: string | null; school_names?: string[]; activity_id?: string | null; activity_name: string; album_name?: string; shift_name: string; version_id: string; version_number: number; status: string; approved_count: number; submitted_at?: string | null; version_created_at?: string | null; created_by_name?: string | null; created_by_id?: string | null; cover_media?: Media[]; }
export interface Media { id: string; kind: 'IMAGE' | 'VIDEO'; status: string; original_name: string; mime_type: string; size_bytes: number; uploaded_by_name?: string | null; uploaded_at?: string | null; purge_after?: string | null; watermark_status?: string | null; watermark_error?: string | null; }
export interface MediaProcessing { id: string; status: string; watermark_status: string | null; watermark_error: string | null; watermark_attempts: number; }
export interface PassengerAssociation { id:string; name:string; code?:string|null; type?:'MICRO'|'AEREO'; }
export interface Passenger { id:string; external_number?:string|null; full_name:string; document_type:string; document_number:string; birth_date?:string|null; document_expires_at?:string|null; country?:string|null; passenger_status?:string|null; bonus?:string|null; phone?:string|null; mobile?:string|null; email?:string|null; active:boolean; created_at?:string; updated_at:string; deactivated_at?:string|null; schools?:PassengerAssociation[]; departures?:PassengerAssociation[]; wristband_code?:string|null; wristband_linked_at?:string|null; }
export interface DeparturePassenger extends Passenger { school_id: string; school_name: string; school_code: string; }
export interface DeparturePassengerSchool { id: string; name: string; code: string; passenger_count: number; }
export interface DeparturePassengerData { departure: Pick<Departure, 'id'|'name'|'type'|'destination'|'start_date'|'end_date'|'active'>; schools: DeparturePassengerSchool[]; total: number; items: DeparturePassenger[]; page: number; pageSize: number; }
export interface PassengerInput { externalNumber?: string | null; fullName: string; documentType: string; documentNumber: string; birthDate?: string | null; documentExpiresAt?: string | null; country?: string | null; passengerStatus?: string | null; bonus?: string | null; phone?: string | null; mobile?: string | null; email?: string | null; active?: boolean; }

export interface PassengerImport { id:string; file_name:string; total_rows:number; created_rows:number; updated_rows:number; rejected_rows:number; created_at:string; imported_by_name:string; school_id?:string|null; school_code?:string|null; school_name?:string|null; }
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const wait = (milliseconds: number) => new Promise<void>(resolve => window.setTimeout(resolve, milliseconds));

async function retryTransientUpload<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const retryable = !(error instanceof ApiError) || error.status >= 500 || error.status === 429;
      if (!retryable || attempt === 2) throw error;
      await wait(1000 * 2 ** attempt);
    }
  }
  throw lastError;
}

function readApiError(data: unknown): { code?: string; message: string } {
  const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const nested = payload.error && typeof payload.error === 'object'
    ? (payload.error as Record<string, unknown>)
    : undefined;

  const message = typeof nested?.message === 'string'
    ? nested.message
    : typeof payload.error === 'string'
      ? payload.error
      : typeof payload.message === 'string'
        ? payload.message
        : 'No se pudo completar la solicitud. Intentá nuevamente.';

  const code = typeof nested?.code === 'string'
    ? nested.code
    : typeof payload.code === 'string'
      ? payload.code
      : undefined;

  return { code, message };
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    if (!response.ok) {
      throw new ApiError(response.status, undefined, 'No se pudo completar la solicitud. Intentá nuevamente.');
    }
    return await response.blob() as T;
  }

  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = readApiError(data);
    throw new ApiError(response.status, error.code, error.message);
  }

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

export async function publicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
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
  myDepartures: () => request<{ items: Departure[] }>('/lots/my-departures'),
  catalogs: () => request<{ activities: CatalogItem[]; shifts: CatalogItem[] }>('/lots/catalogs'),
  lots: (status?: string, pageSize = 100) => request<{ items: LotSummary[] }>(`/lots?pageSize=${pageSize}${status ? `&status=${status}` : ''}`),
  lot: (id: string) => request<{ lot: LotSummary; version: { id: string; status: string; version_number: number }; media: Media[] }>(`/lots/${id}`),
  createLot: (body: { departureId?: string; schoolId?: string; activityId?: string | null; eventDate: string; albumName?: string }) => request<{ lotId: string; versionId: string; existing: boolean }>('/lots', { method: 'POST', body: JSON.stringify(body) }),
  uploadMedia: (lotId: string, file: File) => retryTransientUpload(() => { const body = new FormData(); body.append('file', file); return request<{ id: string; status: string }>(`/lots/${lotId}/media`, { method: 'POST', body }); }),
  retryWatermark: (lotId: string, mediaId: string) => request<void>(`/lots/${lotId}/media/${mediaId}/watermark/retry`, { method: 'POST' }),
  submitLot: (lotId: string) => request<void>(`/lots/${lotId}/submit`, { method: 'POST' }),
  reopenLot: (lotId: string) => request<void>(`/lots/${lotId}/reopen`, { method: 'POST' }),
  renameLot: (lotId: string, albumName: string) => request<{ id: string; title: string }>(`/lots/${lotId}`, { method: 'PATCH', body: JSON.stringify({ albumName }) }),
  deleteLot: (lotId: string) => request<void>(`/lots/${lotId}`, { method: 'DELETE' }),
  approveLot: (lotId: string) => request<void>(`/lots/${lotId}/approve`, { method: 'POST' }),
  rejectLot: (lotId: string) => request<void>(`/lots/${lotId}/reject`, { method: 'POST' }),
  moderateMedia: (mediaId: string, action: 'reject' | 'restore') => request<void>(`/lots/media/${mediaId}/moderation`, { method: 'PATCH', body: JSON.stringify({ action }) }),
  departurePassengers: (departureId: string, options: { schoolId?: string; q?: string } = {}) => { const params = new URLSearchParams(); if (options.schoolId) params.set('schoolId', options.schoolId); if (options.q) params.set('q', options.q); const suffix = params.size ? `?${params}` : ''; return request<DeparturePassengerData>(`/departures/${departureId}/passengers${suffix}`); },
  availableDeparturePassengers: (departureId: string, schoolId: string, q = '') => request<{ items: Passenger[] }>(`/departures/${departureId}/schools/${schoolId}/passengers/available${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  addDeparturePassenger: (departureId: string, passengerId: string, schoolId: string) => request<void>(`/departures/${departureId}/passengers/${passengerId}`, { method: 'POST', body: JSON.stringify({ schoolId }) }),
  createDeparturePassenger: (departureId: string, schoolId: string, passenger: PassengerInput) => request<{ id: string }>(`/departures/${departureId}/passengers`, { method: 'POST', body: JSON.stringify({ schoolId, passenger }) }),
  previewDeparturePassengerImport: (departureId: string, schoolId: string, file: File) => { const body = new FormData(); body.append('schoolId', schoolId); body.append('file', file); return request<{ valid:boolean; totalRows:number; validRows:number; errors:{row:number;field:string;message:string}[]; summary:{create:number;update:number;associate:number;rejected:number} }>(`/departures/${departureId}/passengers/import/preview`, { method: 'POST', body }); },
  commitDeparturePassengerImport: (departureId: string, schoolId: string, file: File) => { const body = new FormData(); body.append('schoolId', schoolId); body.append('file', file); return request<{ created:number;updated:number;associated:number }>(`/departures/${departureId}/passengers/import/commit`, { method: 'POST', body }); },
  removeDeparturePassenger: (departureId: string, passengerId: string) => request<void>(`/departures/${departureId}/passengers/${passengerId}`, { method: 'DELETE' }),  downloadZip: (mediaIds: string[]) => request<Blob>('/media/downloads/zip', { method: 'POST', body: JSON.stringify({ mediaIds }) }),
  linkWristband: (passengerId: string, code: string) => adminRequest<{ id: string; wristband_code: string; wristband_linked_at: string }>(`/passengers/${passengerId}/wristband`, { method: 'POST', body: JSON.stringify({ code }) }),
  unlinkWristband: (passengerId: string) => adminRequest<void>(`/passengers/${passengerId}/wristband`, { method: 'DELETE' }),
  scanWristband: (code: string) => adminRequest<Passenger & { schools: PassengerAssociation[]; departures: PassengerAssociation[] }>(`/passengers/scan/${encodeURIComponent(code)}`),
  contentUrl: (mediaId: string) => `${API_URL}/media/${mediaId}/content`,
  thumbnailUrl: (mediaId: string) => `${API_URL}/media/${mediaId}/thumbnail`,
  downloadUrl: (mediaId: string) => `${API_URL}/media/${mediaId}/download`,
};







export const publicGalleryApi = {
  school: (token: string) => publicRequest<{ school: { id: string; name: string }; items: LotSummary[] }>(`/public/${encodeURIComponent(token)}`),
  lot: (token: string, lotId: string) => publicRequest<{ lot: LotSummary; media: Media[] }>(`/public/${encodeURIComponent(token)}/lots/${lotId}`),
  downloadZip: (token: string, mediaIds: string[]) => publicRequest<Blob>(`/public/${encodeURIComponent(token)}/downloads/zip`, { method: 'POST', body: JSON.stringify({ mediaIds }) }),
  contentUrl: (token: string, mediaId: string) => `${API_URL}/public/${encodeURIComponent(token)}/media/${mediaId}/content`,
  thumbnailUrl: (token: string, mediaId: string) => `${API_URL}/public/${encodeURIComponent(token)}/media/${mediaId}/thumbnail`,
  downloadUrl: (token: string, mediaId: string) => `${API_URL}/public/${encodeURIComponent(token)}/media/${mediaId}/download`,
};

export interface PublicDeparture { id: string; public_code: string; name: string; destination: string; type: 'MICRO' | 'AEREO'; event_date: string; start_date: string; end_date: string; }
export const publicDepartureApi = {
  departure: (code: string) => publicRequest<{ departure: PublicDeparture; items: LotSummary[] }>(`/public/departures/${encodeURIComponent(code)}`),
  lot: (code: string, lotId: string) => publicRequest<{ lot: LotSummary; media: Media[] }>(`/public/departures/${encodeURIComponent(code)}/lots/${lotId}`),
  downloadZip: (code: string, mediaIds: string[]) => publicRequest<Blob>(`/public/departures/${encodeURIComponent(code)}/downloads/zip`, { method: 'POST', body: JSON.stringify({ mediaIds }) }),
  contentUrl: (code: string, mediaId: string) => `${API_URL}/public/departures/${encodeURIComponent(code)}/media/${mediaId}/content`,
  thumbnailUrl: (code: string, mediaId: string) => `${API_URL}/public/departures/${encodeURIComponent(code)}/media/${mediaId}/thumbnail`,
  downloadUrl: (code: string, mediaId: string) => `${API_URL}/public/departures/${encodeURIComponent(code)}/media/${mediaId}/download`,
};

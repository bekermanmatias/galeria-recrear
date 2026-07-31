import * as XLSX from 'xlsx';
import { z } from 'zod';
import { AppError } from './errors.js';

export const passengerSchema = z.object({
  externalNumber: z.string().max(80).optional().nullable(),
  fullName: z.string().trim().min(2).max(240),
  documentType: z.string().trim().min(1).max(40),
  documentNumber: z.string().trim().min(1).max(80),
  birthDate: z.string().date().optional().nullable(),
  documentExpiresAt: z.string().date().optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  passengerStatus: z.string().max(100).optional().nullable(),
  bonus: z.string().max(100).optional().nullable(),
  phone: z.string().max(80).optional().nullable(),
  mobile: z.string().max(80).optional().nullable(),
  email: z.string().email().max(320).optional().nullable(),
  active: z.boolean().optional(),
});

export type PassengerInput = z.infer<typeof passengerSchema>;
export type ImportIssue = { row: number; field: string; message: string };

const headers = {
  externalNumber: 'Nro', fullName: 'Pasajero', documentType: 'Tipo', documentNumber: 'Número',
  birthDate: 'F.Nac.', documentExpiresAt: 'Fecha Vencimiento Documento', country: 'Pais',
  passengerStatus: 'Estado', bonus: 'Bonificacion', phone: 'Telefono', mobile: 'Celular', email: 'Correo Electronico',
} as const;

function normalize(value: unknown) { return String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\./g, '').replace(/\s+/g, ' '); }
function text(value: unknown) { const result = String(value ?? '').trim(); return result || null; }
function date(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') { const parsed = XLSX.SSF.parse_date_code(value); if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`; }
  const source = String(value).trim(); const match = source.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(source) ? source : null;
}

export function parsePassengerWorkbook(buffer: Buffer) {
  let workbook: XLSX.WorkBook;
  try { workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true }); } catch { throw new AppError(400, 'INVALID_EXCEL', 'No se pudo leer el archivo de Excel'); }
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ''];
  if (!sheet) throw new AppError(400, 'EMPTY_EXCEL', 'El archivo no contiene una hoja válida');
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
  const displayMatrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });
  const normalizedHeaders = (matrix[0] ?? []).map(normalize);
  const column = (header: string) => normalizedHeaders.findIndex(value => value === normalize(header));
  const columns = Object.fromEntries(Object.entries(headers).map(([key, header]) => [key, column(header)])) as Record<keyof typeof headers, number>;
  const missing = ['Pasajero', 'Tipo', 'Número'].filter(header => column(header) < 0);
  if (missing.length) throw new AppError(400, 'INVALID_EXCEL_HEADERS', `Faltan columnas obligatorias: ${missing.join(', ')}`);

  const errors: ImportIssue[] = []; const rows: PassengerInput[] = []; const documentKeys = new Set<string>();
  matrix.slice(1).forEach((cells, index) => {
    if (!(cells ?? []).some(value => text(value) !== null)) return;
    const row = index + 2; const displayCells = displayMatrix[index + 1] ?? cells;
    const get = (key: keyof typeof headers) => columns[key] < 0 ? null : cells[columns[key]]; const getText = (key: keyof typeof headers) => columns[key] < 0 ? null : displayCells[columns[key]];
    const birthDate = date(get('birthDate')); const documentExpiresAt = date(get('documentExpiresAt'));
    const invalidDate = Boolean(text(get('birthDate')) && !birthDate) || Boolean(text(get('documentExpiresAt')) && !documentExpiresAt);
    if (text(get('birthDate')) && !birthDate) errors.push({ row, field: headers.birthDate, message: 'Fecha inválida' });
    if (text(get('documentExpiresAt')) && !documentExpiresAt) errors.push({ row, field: headers.documentExpiresAt, message: 'Fecha inválida' });
    if (invalidDate) return;
    const candidate = { externalNumber: text(getText('externalNumber')), fullName: text(getText('fullName')) ?? '', documentType: text(getText('documentType'))?.toUpperCase() ?? '', documentNumber: text(getText('documentNumber')) ?? '', birthDate, documentExpiresAt, country: text(getText('country')), passengerStatus: text(getText('passengerStatus')), bonus: text(getText('bonus')), phone: text(getText('phone')), mobile: text(getText('mobile')), email: text(getText('email'))?.toLowerCase() ?? null };
    const parsed = passengerSchema.safeParse(candidate);
    if (!parsed.success) for (const issue of parsed.error.issues) errors.push({ row, field: String(issue.path[0] ?? 'fila'), message: issue.message });
    else {
      const key = `${parsed.data.documentType}\u001F${parsed.data.documentNumber}`;
      if (documentKeys.has(key)) errors.push({ row, field: 'N?mero', message: 'Documento repetido dentro del archivo' });
      else { documentKeys.add(key); rows.push(parsed.data); }
    }
  });
  return { rows, errors, totalRows: Math.max(0, matrix.length - 1) };
}

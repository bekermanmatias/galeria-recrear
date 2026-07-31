import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parsePassengerWorkbook } from './passengers.js';

function workbook(rows: unknown[][]) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  return XLSX.write({ SheetNames: ['Pasajeros'], Sheets: { Pasajeros: sheet } }, { type: 'buffer', bookType: 'xlsx' });
}

describe('importación de pasajeros', () => {
  it('interpreta fechas de Excel y conserva documentos como texto', () => {
    const result = parsePassengerWorkbook(workbook([
      ['Nro', 'Pasajero', 'Tipo', 'Número', 'F.Nac.', 'Correo Electronico'],
      ['001', 'Ana Pérez', 'DNI', '00123456', 36526, 'ana@example.com'],
    ]));
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ externalNumber: '001', documentNumber: '00123456', birthDate: '2000-01-01' });
  });

  it('rechaza encabezados obligatorios ausentes', () => {
    expect(() => parsePassengerWorkbook(workbook([['Pasajero', 'Tipo'], ['Ana Pérez', 'DNI']]))).toThrow('Faltan columnas obligatorias');
  });
});

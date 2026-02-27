import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Articulo } from '../types';
import * as XLSX from 'xlsx';

interface CsvActionsProps {
  articulos: Articulo[];
  onImportSuccess: (message: string) => void;
  onImportError: (error: string) => void;
}

type RowArticulo = Partial<Articulo>;

export default function CsvActions({ articulos, onImportSuccess, onImportError }: CsvActionsProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normaliza encabezados: "Imagen URL" -> "imagen_url", trims, lower, espacios->underscore
  const normalizeHeader = (h: string) =>
    String(h ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');

  // Convierte valores numéricos
  const toNumberOrNull = (v: any) => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number.parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const toIntOrNull = (v: any) => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number.parseInt(String(v), 10);
    return Number.isFinite(n) ? n : null;
  };

  // Sanitiza strings
  const toTextOrNull = (v: any) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  };

  // Valida que mínimo exista nombre (tu DB lo exige NOT NULL)
  const validateRow = (row: RowArticulo, rowIndexHuman: number) => {
    if (!row.nombre || String(row.nombre).trim() === '') {
      throw new Error(`Fila ${rowIndexHuman}: "nombre" es obligatorio.`);
    }
  };

  // ---- CSV robusto (soporta comillas y comas dentro de campos) ----
  const parseCSV = (csvText: string): RowArticulo[] => {
    const rows = csvText
      .split(/\r?\n/)
      .filter((row) => row.trim() !== '');

    if (rows.length < 2) throw new Error('El CSV debe tener encabezados y al menos una fila de datos.');

    const parseLine = (line: string) => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current);
      return result.map((x) => x.trim());
    };

    const headers = parseLine(rows[0]).map(normalizeHeader);

    const parsed: RowArticulo[] = [];

    for (let i = 1; i < rows.length; i++) {
      const values = parseLine(rows[i]);
      if (values.length !== headers.length) {
        throw new Error(`Fila ${i + 1}: Número de columnas no coincide con los encabezados.`);
      }

      const row: any = {};

      headers.forEach((h, idx) => {
        const raw = values[idx];
        const value = raw === '' ? null : raw;

        switch (h) {
          case 'precio':
            row.precio = toNumberOrNull(value);
            if (value !== null && row.precio === null) throw new Error(`Fila ${i + 1}, columna precio: Valor numérico inválido.`);
            break;
          case 'stock':
            row.stock = toIntOrNull(value);
            if (value !== null && row.stock === null) throw new Error(`Fila ${i + 1}, columna stock: Valor numérico inválido.`);
            break;
          case 'id':
            // nunca importar id
            break;
          default:
            row[h] = toTextOrNull(value);
            break;
        }
      });

      validateRow(row, i + 1);
      parsed.push(row);
    }

    return parsed;
  };

  // ---- XLSX (Excel) ----
  const parseXLSX = async (file: File): Promise<RowArticulo[]> => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('El archivo Excel no tiene hojas.');

    const sheet = workbook.Sheets[sheetName];

    // Convierte a matriz (filas/columnas) para controlar headers
    const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!matrix || matrix.length < 2) {
      throw new Error('El Excel debe tener encabezados y al menos una fila de datos.');
    }

    const headersRaw = matrix[0].map((h) => normalizeHeader(String(h)));
    const dataRows = matrix.slice(1);

    const parsed: RowArticulo[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const rowArr = dataRows[i];
      // si la fila está completamente vacía, la ignoramos
      const isEmpty = rowArr.every((c) => String(c ?? '').trim() === '');
      if (isEmpty) continue;

      const row: any = {};

      headersRaw.forEach((h, idx) => {
        const value = rowArr[idx];

        switch (h) {
          case 'precio':
            row.precio = toNumberOrNull(value);
            if (String(value ?? '').trim() !== '' && row.precio === null) {
              throw new Error(`Fila ${i + 2}, columna precio: Valor numérico inválido.`);
            }
            break;
          case 'stock':
            row.stock = toIntOrNull(value);
            if (String(value ?? '').trim() !== '' && row.stock === null) {
              throw new Error(`Fila ${i + 2}, columna stock: Valor numérico inválido.`);
            }
            break;
          case 'id':
            // nunca importar id
            break;
          default:
            row[h] = toTextOrNull(value);
            break;
        }
      });

      validateRow(row, i + 2); // +2 porque fila 1 es header
      parsed.push(row);
    }

    return parsed;
  };

  // Import masivo en lotes
  const insertInBatches = async (rows: RowArticulo[]) => {
    const BATCH_SIZE = 100;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('articulos').insert(batch);
      if (error) throw error;
    }
  };

  // Import (CSV o XLSX)
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const name = file.name.toLowerCase();

    setIsImporting(true);
    try {
      let parsedData: RowArticulo[] = [];

      if (name.endsWith('.csv')) {
        const text = await file.text();
        parsedData = parseCSV(text);
      } else if (name.endsWith('.xlsx')) {
        parsedData = await parseXLSX(file);
      } else {
        throw new Error('Formato no soportado. Sube un archivo .csv o .xlsx');
      }

      if (parsedData.length === 0) {
        throw new Error('No se encontraron filas válidas para importar.');
      }

      await insertInBatches(parsedData);

      onImportSuccess(`Se importaron ${parsedData.length} productos correctamente.`);
    } catch (error) {
      onImportError(error instanceof Error ? error.message : 'Error desconocido al importar.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Export a CSV (sin cambios funcionales)
  const handleExport = () => {
    if (!articulos || articulos.length === 0) {
      onImportError('No hay productos para exportar.');
      return;
    }

    setIsExporting(true);

    try {
      const headers = ['id', 'nombre', 'marca', 'modelo', 'precio', 'stock', 'descripcion', 'imagen_url', 'categoria', 'link'];

      const sanitizeText = (text: any): string => {
        if (text == null) return '';
        return String(text).replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '');
      };

      const rows = articulos.map((art) => [
        art.id || '',
        `"${sanitizeText(art.nombre)}"`,
        `"${sanitizeText(art.marca)}"`,
        `"${sanitizeText(art.modelo)}"`,
        art.precio || 0,
        art.stock || 0,
        `"${sanitizeText(art.descripcion)}"`,
        `"${sanitizeText(art.imagen_url)}"`,
        `"${sanitizeText(art.categoria)}"`,
        art.link ? `"${sanitizeText(art.link)}"` : ''
      ]);

      const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = `inventario_${new Date().toISOString().split('T')[0]}.csv`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        onImportSuccess('Archivo CSV exportado correctamente.');
      } catch {
        window.open(url, '_blank');
        onImportSuccess('Archivo CSV abierto en nueva pestaña.');
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 200);
      }
    } catch (error) {
      onImportError(`Error al exportar el archivo CSV: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      {/* Botón Importar */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx"
          onChange={handleImport}
          className="hidden"
          id="csv-import"
        />
        <label
          htmlFor="csv-import"
          className={`inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all cursor-pointer ${
            isImporting ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isImporting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              Importando...
            </>
          ) : (
            <>
              📥 Importar CSV/Excel
            </>
          )}
        </label>
      </div>

      {/* Botón Exportar */}
      <button
        onClick={handleExport}
        disabled={isExporting}
        className={`inline-flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all ${
          isExporting ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {isExporting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            Exportando...
          </>
        ) : (
          <>
            📤 Exportar CSV
          </>
        )}
      </button>
    </div>
  );
}
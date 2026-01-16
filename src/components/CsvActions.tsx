import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Articulo } from '../types';

interface CsvActionsProps {
  articulos: Articulo[];
  onImportSuccess: (message: string) => void;
  onImportError: (error: string) => void;
}

export default function CsvActions({ articulos, onImportSuccess, onImportError }: CsvActionsProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Función para parsear CSV
  const parseCSV = (csvText: string): Partial<Articulo>[] => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) throw new Error('El CSV debe tener al menos una fila de encabezados y una fila de datos.');

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredHeaders = ['nombre', 'marca', 'modelo', 'precio', 'stock', 'descripcion', 'imagen_url', 'categoria'];

    // Verificar encabezados requeridos
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new Error(`Faltan columnas requeridas: ${missingHeaders.join(', ')}`);
    }

    const parsedData: Partial<Articulo>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length !== headers.length) {
        throw new Error(`Fila ${i + 1}: Número de columnas no coincide con los encabezados.`);
      }

      const row: Partial<Articulo> = {};
      headers.forEach((header, index) => {
        const value = values[index];
        switch (header) {
          case 'precio':
          case 'stock':
            const numValue = parseFloat(value);
            if (isNaN(numValue)) throw new Error(`Fila ${i + 1}, columna ${header}: Valor numérico inválido.`);
            row[header as keyof Articulo] = numValue as any;
            break;
          default:
            row[header as keyof Articulo] = value as any;
        }
      });

      // Validaciones básicas
      if (!row.nombre || !row.marca || !row.modelo || row.precio === undefined || row.stock === undefined || !row.descripcion || !row.imagen_url || !row.categoria) {
        throw new Error(`Fila ${i + 1}: Faltan datos requeridos.`);
      }

      parsedData.push(row as Articulo);
    }

    return parsedData;
  };

  // Función para importar CSV
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      onImportError('Por favor selecciona un archivo CSV válido.');
      return;
    }

    setIsImporting(true);
    try {
      const text = await file.text();
      const parsedData = parseCSV(text);

      // Insertar en Supabase
      const { error } = await supabase.from('articulos').insert(parsedData);

      if (error) throw error;

      onImportSuccess(`Se importaron ${parsedData.length} productos correctamente.`);
    } catch (error) {
      onImportError(error instanceof Error ? error.message : 'Error desconocido al importar.');
    } finally {
      setIsImporting(false);
      // Limpiar input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Función para exportar a CSV
  const handleExport = () => {
    console.log('Exporting articulos:', articulos);
    if (!articulos || articulos.length === 0) {
      onImportError('No hay productos para exportar.');
      return;
    }

    setIsExporting(true);

    try {
      // Encabezados
      const headers = ['id', 'nombre', 'marca', 'modelo', 'precio', 'stock', 'descripcion', 'imagen_url', 'categoria', 'link'];

      // Función helper para sanitizar texto
      const sanitizeText = (text: any): string => {
        if (text == null) return '';
        return String(text).replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '');
      };

      // Crear filas
      const rows = articulos.map(art => {
        console.log('Processing article:', art);
        return [
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
        ];
      });

      console.log('Generated rows:', rows);

      // Combinar
      const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
      console.log('CSV content length:', csvContent.length);
      console.log('CSV content preview:', csvContent.substring(0, 200));

      // Crear blob y descargar
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = `inventario_${new Date().toISOString().split('T')[0]}.csv`;
        link.style.display = 'none';

        // Agregar al DOM y hacer click
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        onImportSuccess('Archivo CSV exportado correctamente.');
      } catch (downloadError) {
        console.error('Download error:', downloadError);
        // Fallback para navegadores que no soportan download
        window.open(url, '_blank');
        onImportSuccess('Archivo CSV abierto en nueva pestaña.');
      } finally {
        // Limpiar URL después de un breve delay
        setTimeout(() => URL.revokeObjectURL(url), 100);
      }
    } catch (error) {
      console.error('Export error:', error);
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
          accept=".csv"
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
              📥 Importar CSV
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
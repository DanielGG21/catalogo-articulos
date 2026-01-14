import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase' // Tu conexión
import type { Articulo } from '../types'      // Tu interface

const SHEET_ANIM_MS = 300;
  
function Catalogo() {
  // 1. Definimos el ESTADO (como una propiedad privada en C# que refresca la vista al cambiar)
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [cargando, setCargando] = useState(true);

  // Estado para el detalle ampliado
  const [articuloSeleccionado, setArticuloSeleccionado] = useState<Articulo | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [mostrarSheet, setMostrarSheet] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastActiveElRef = useRef<HTMLElement | null>(null);

  const abrirDetalles = useCallback((item: Articulo) => {
    lastActiveElRef.current = document.activeElement as HTMLElement | null;
    setArticuloSeleccionado(item);
    setMostrarSheet(true);
    setCopiado(false);
    // Pequeño delay para que el navegador renderice primero en translate-x-full
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setDetalleAbierto(true);
        // Mover foco al diálogo (WCAG 2.4.3 / 2.4.7)
        window.setTimeout(() => closeBtnRef.current?.focus(), 0);
      });
    });
  }, []);

  const cerrarDetalles = useCallback(() => {
    setDetalleAbierto(false);
    // Mantener montado el sheet durante la animación de cierre
    window.setTimeout(() => {
      setMostrarSheet(false);
      setArticuloSeleccionado(null);
      setCopiado(false);
      // Restaurar foco al elemento que abrió el diálogo
      lastActiveElRef.current?.focus?.();
    }, SHEET_ANIM_MS);
  }, []);

  const copiarLink = useCallback((link?: string) => {
    if (!link) return;
    navigator.clipboard?.writeText(link).then(() => {
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1500);
    }).catch(() => {
      // Fallback silencioso
      const textarea = document.createElement('textarea');
      textarea.value = link;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1500);
    });
  }, []);

  // 2. Función para obtener los datos
  async function obtenerArticulos() {
    try {
      setCargando(true);
      const { data, error } = await supabase
        .from('articulos') // Nombre de tu tabla
        .select('*');     // Traer todas las columnas

      if (error) throw error;
      if (data) setArticulos(data);
    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      setCargando(false);
    }
  }

  // 3. useEffect: Se ejecuta automáticamente cuando la página carga
  useEffect(() => {
    obtenerArticulos();
  }, []);

  // Efecto para prevenir scroll del body y cerrar con Escape cuando el detalle está abierto
  useEffect(() => {
    if (detalleAbierto) {
      document.body.style.overflow = 'hidden';
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') cerrarDetalles();
      };
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = 'unset';
        document.removeEventListener('keydown', handleEscape);
      };
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [detalleAbierto, cerrarDetalles]);


  if (cargando) return <div className="text-center mt-20">Cargando catálogo...</div>;

  return (
    <main className="min-h-screen bg-gray-50 p-8" aria-label="Catálogo">
      <header className="max-w-6xl mx-auto mb-10">
        <h1 className="text-4xl font-extrabold text-gray-900">Catálogo de Artículos</h1>
        <p className="text-gray-500">Explora nuestros productos disponibles</p>
      </header>

      {/* 4. GRID: Aquí mostramos los artículos */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {articulos.map((item) => (
          <div key={item.id} className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-shadow overflow-hidden border border-gray-100">
            {/* Imagen del artículo */}
            <div className="h-48 overflow-hidden bg-gray-200">
              <img 
                src={item.imagen_url || 'https://via.placeholder.com/400'} 
                alt={item.nombre}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Info del artículo */}
            <div className="p-6">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{item.nombre}</h3>
                  <p className="text-sm text-blue-600 font-medium">{item.marca} - {item.modelo}</p>
                </div>
                <span className="bg-green-100 text-green-700 text-sm font-bold px-3 py-1 rounded-full">
                  ${item.precio}
                </span>
              </div>
              
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                {item.descripcion}
              </p>
              
              <div className="flex justify-between items-center border-t pt-4">
                <span className={`text-sm font-semibold ${item.stock > 0 ? 'text-gray-500' : 'text-red-500'}`}>
                  {item.stock > 0 ? `${item.stock} disponibles` : 'Agotado'}
                </span>
                <button 
                  onClick={() => abrirDetalles(item)}
                  className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                  aria-label={`Ver detalles de ${item.nombre}`}
                >
                  Ver detalles
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Side Sheet (si hay artículo seleccionado) */}
      {mostrarSheet && articuloSeleccionado && (
        <>
          {/* Overlay */}
          <div
            className={`fixed inset-0 bg-black/10 z-40 transition-opacity duration-300 ease-in-out motion-reduce:transition-none ${
              detalleAbierto ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={cerrarDetalles}
            aria-hidden="true"
          />

          {/* Panel */}
          <div
            className={`fixed top-0 right-0 h-full w-full max-w-3xl bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out motion-reduce:transition-none overflow-y-auto ${
              detalleAbierto ? 'translate-x-0' : 'translate-x-full pointer-events-none'
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="detalle-producto-title"
          >
            {/* Header del Side Sheet */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10 shadow-sm">
              <h2 id="detalle-producto-title" className="text-2xl font-bold text-gray-800">
                Detalles del Producto
              </h2>
              <button
                onClick={cerrarDetalles}
                type="button"
                ref={closeBtnRef}
                className="text-gray-500 hover:text-gray-700 font-bold text-2xl w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Cerrar detalles"
              >
                ×
              </button>
            </div>

            {/* Contenido del Side Sheet */}
            <div className="p-6 md:p-8">
              {/* Imagen Completa */}
              <div className="mb-8">
                <div className="w-full h-96 bg-gray-100 rounded-2xl overflow-hidden shadow-lg">
                  <img 
                    src={articuloSeleccionado.imagen_url || 'https://via.placeholder.com/800x600'} 
                    alt={articuloSeleccionado.nombre}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/800x600?text=Imagen+no+disponible';
                    }}
                  />
                </div>
              </div>

              {/* Información Principal */}
              <div className="space-y-6">
                {/* Nombre, Categoría y Precio */}
                <div className="border-b border-gray-200 pb-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-3xl font-extrabold text-gray-900 mb-2">
                        {articuloSeleccionado.nombre}
                      </h3>
                      <p className="text-lg text-blue-600 font-semibold">
                        {articuloSeleccionado.marca} - {articuloSeleccionado.modelo}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
                          {articuloSeleccionado.categoria || 'Sin categoría'}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-4xl font-bold text-green-600 mb-1">
                        ${articuloSeleccionado.precio.toLocaleString()}
                      </p>
                      <span className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${
                        articuloSeleccionado.stock > 0 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {articuloSeleccionado.stock > 0 
                          ? `✓ ${articuloSeleccionado.stock} disponibles` 
                          : '✗ Agotado'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Descripción Completa */}
                <div>
                  <h4 className="text-xl font-bold text-gray-800 mb-4">Descripción</h4>
                  <p className="text-gray-700 leading-relaxed text-lg whitespace-pre-wrap">
                    {articuloSeleccionado.descripcion}
                  </p>
                </div>

                {/* Información Adicional */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-200">
                  <div className="bg-gray-50 rounded-xl p-6">
                    <p className="text-sm text-gray-500 mb-2 font-medium">Marca</p>
                    <p className="text-lg font-semibold text-gray-800">{articuloSeleccionado.marca}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-6">
                    <p className="text-sm text-gray-500 mb-2 font-medium">Modelo</p>
                    <p className="text-lg font-semibold text-gray-800">{articuloSeleccionado.modelo}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-6">
                    <p className="text-sm text-gray-500 mb-2 font-medium">Precio</p>
                    <p className="text-lg font-semibold text-green-600">${articuloSeleccionado.precio.toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-6">
                    <p className="text-sm text-gray-500 mb-2 font-medium">Stock Disponible</p>
                    <p className={`text-lg font-semibold ${
                      articuloSeleccionado.stock > 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {articuloSeleccionado.stock > 0 ? `${articuloSeleccionado.stock} unidades` : 'Agotado'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-6 md:col-span-2">
                    <p className="text-sm text-gray-500 mb-2 font-medium"></p>
                    {articuloSeleccionado.link ? (
                      <button
                        type="button"
                        onClick={() => copiarLink(articuloSeleccionado.link)}
                        className="group inline-flex w-full items-center justify-between gap-4 rounded-2xl bg-gray-900/90 px-6 py-5 text-white shadow-sm hover:bg-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        title="Clic para copiar el vínculo"
                        aria-label="Copiar vínculo del producto"
                      >
                        <span className="inline-flex items-center gap-4">
                          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                            {/* Icono copiar (SVG inline) */}
                            <svg
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              aria-hidden="true"
                              className="text-white/90"
                            >
                              <path
                                d="M8 8V6.5C8 5.67157 8.67157 5 9.5 5H18.5C19.3284 5 20 5.67157 20 6.5V15.5C20 16.3284 19.3284 17 18.5 17H17"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                              <path
                                d="M6.5 8H15.5C16.3284 8 17 8.67157 17 9.5V18.5C17 19.3284 16.3284 20 15.5 20H6.5C5.67157 20 5 19.3284 5 18.5V9.5C5 8.67157 5.67157 8 6.5 8Z"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                            </svg>
                          </span>
                          <span className="text-xl font-semibold">
                            {copiado ? 'Copiado' : 'Copiar vínculo'}
                          </span>
                        </span>
                        <span className="text-sm text-white/70 group-hover:text-white/80">
                          {copiado ? 'Listo' : ''}
                        </span>
                      </button>
                    ) : (
                      <span className="text-sm text-gray-400">Sin link</span>
                    )}
                    <p className="text-xs text-green-600 mt-2" role="status" aria-live="polite">
                      {copiado ? 'Vínculo copiado al portapapeles' : ''}
                    </p>
                  </div>
                </div>

                {/* Botón de Cerrar */}
                <div className="pt-6 border-t border-gray-200">
                  <button
                    onClick={cerrarDetalles}
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-4 rounded-xl transition-all focus:outline-none focus:ring-4 focus:ring-gray-300"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  )
}

export default Catalogo

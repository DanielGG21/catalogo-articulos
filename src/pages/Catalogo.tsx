import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { Articulo } from '../types'

const SHEET_ANIM_MS = 300;

function Catalogo() {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [cargando, setCargando] = useState(true);

  // --- ESTADOS DE FILTRADO ---
  const [precioMax, setPrecioMax] = useState<number>(1000);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  // --- ESTADOS DE DETALLE ---
  const [articuloSeleccionado, setArticuloSeleccionado] = useState<Articulo | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [mostrarSheet, setMostrarSheet] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastActiveElRef = useRef<HTMLElement | null>(null);

  // Obtener categorías únicas para los filtros
  const categoriasUnicas = useMemo(() => {
    const cats = articulos.map(a => a.categoria).filter(Boolean);
    return Array.from(new Set(cats));
  }, [articulos]);

  // Lógica de filtrado
  const articulosFiltrados = useMemo(() => {
    return articulos.filter(art => {
      const coincideBusqueda = art.nombre.toLowerCase().includes(busqueda.toLowerCase());
      const coincidePrecio = art.precio <= precioMax;
      const coincideCategoria = categoriaSeleccionada ? art.categoria === categoriaSeleccionada : true;
      return coincideBusqueda && coincidePrecio && coincideCategoria;
    });
  }, [articulos, busqueda, precioMax, categoriaSeleccionada]);

  async function obtenerArticulos() {
    try {
      setCargando(true);
      const { data, error } = await supabase.from('articulos').select('*');
      if (error) throw error;
      if (data) setArticulos(data);
    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { obtenerArticulos(); }, []);

  // --- FUNCIONES DE DETALLE ---
  const abrirDetalles = useCallback((item: Articulo) => {
    lastActiveElRef.current = document.activeElement as HTMLElement | null;
    setArticuloSeleccionado(item);
    setMostrarSheet(true);
    setCopiado(false);
    setTimeout(() => {
      setDetalleAbierto(true);
      closeBtnRef.current?.focus();
    }, 10);
  }, []);

  const cerrarDetalles = useCallback(() => {
    setDetalleAbierto(false);
    window.setTimeout(() => {
      setMostrarSheet(false);
      setArticuloSeleccionado(null);
      lastActiveElRef.current?.focus?.();
    }, SHEET_ANIM_MS);
  }, []);

  const copiarLink = useCallback((link?: string) => {
    if (!link) return;
    navigator.clipboard?.writeText(link).then(() => {
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1500);
    });
  }, []);

  // Cerrar con tecla Escape
  useEffect(() => {
    if (detalleAbierto) {
      const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrarDetalles(); };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [detalleAbierto, cerrarDetalles]);

  if (cargando) return <div className="text-center mt-20 animate-pulse font-bold text-blue-600">Cargando catálogo...</div>;

  return (
    <main className="min-h-screen bg-white p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row gap-8">
        
        {/* --- SIDEBAR DE FILTROS --- */}
        <aside className="w-full md:w-72 flex-shrink-0 space-y-8">
          <h2 className="text-2xl font-black text-gray-800 flex items-center justify-between">
            Filtrar por <span className="text-sm">⚡</span>
          </h2>
          
          <div className="space-y-8">
            {/* Filtro Precio */}
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <div className="flex justify-between text-xs font-bold uppercase text-gray-400 mb-4">
                <span>Rango máximo</span>
                <span className="text-blue-600">${precioMax}</span>
              </div>
              <input 
                type="range" min="0" max="2000" step="10"
                value={precioMax}
                onChange={(e) => setPrecioMax(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Filtro Categoría */}
            <div>
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Categorías</h3>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => setCategoriaSeleccionada(null)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${!categoriaSeleccionada ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  TODOS
                </button>
                {categoriasUnicas.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setCategoriaSeleccionada(cat === categoriaSeleccionada ? null : cat)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${categoriaSeleccionada === cat ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Buscador Rápido */}
            <div>
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Buscar producto</h3>
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Escribe el nombre..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full p-4 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </aside>

        {/* --- GRID DE PRODUCTOS (4 COLUMNAS) --- */}
        <section className="flex-1">
          <header className="mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-4xl font-black text-gray-900 mb-2">Catálogo</h1>
              <p className="text-gray-400 font-medium">Mostrando {articulosFiltrados.length} artículos encontrados</p>
            </div>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {articulosFiltrados.map((item) => (
              <div 
                key={item.id} 
                className="group bg-white rounded-3xl border border-gray-100 p-4 hover:shadow-2xl hover:shadow-gray-200 transition-all duration-500"
              >
                <div className="aspect-square rounded-2xl bg-gray-50 overflow-hidden mb-4 relative">
                  <img 
                    src={item.imagen_url || 'https://via.placeholder.com/400'} 
                    alt={item.nombre}
                    className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute top-2 left-2">
                    <span className="bg-white/80 backdrop-blur-md text-[10px] font-black px-2 py-1 rounded-lg uppercase text-gray-500 border border-white/50">
                      {item.categoria || 'Gral'}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-gray-800 line-clamp-2 min-h-[40px] leading-tight uppercase">
                    {item.nombre}
                  </h3>
                  <p className="text-lg font-black text-blue-600">${item.precio.toFixed(2)}</p>
                  
                  <button 
                    onClick={() => abrirDetalles(item)}
                    className="w-full py-3 mt-2 rounded-xl bg-gray-900 text-white text-xs font-bold opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300"
                  >
                    VER DETALLES
                  </button>
                </div>
              </div>
            ))}
          </div>

          {articulosFiltrados.length === 0 && (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <p className="text-gray-400 font-bold">No se encontraron productos con estos filtros</p>
            </div>
          )}
        </section>
      </div>

      {/* --- PANEL DE DETALLE (MUESTRA TODA LA INFO) --- */}
      {mostrarSheet && articuloSeleccionado && (
        <>
          <div 
            className={`fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${detalleAbierto ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
            onClick={cerrarDetalles} 
          />
          
          <div className={`fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 transform transition-transform duration-500 ease-out overflow-y-auto ${detalleAbierto ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="sticky top-0 bg-white/80 backdrop-blur-md p-6 flex justify-between items-center border-b border-gray-100 z-10">
              <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Detalles del Artículo</h2>
              <button 
                onClick={cerrarDetalles} ref={closeBtnRef}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-8 space-y-8">
              {/* Imagen Grande */}
              <div className="w-full aspect-video bg-gray-50 rounded-3xl overflow-hidden border border-gray-100">
                <img 
                  src={articuloSeleccionado.imagen_url} 
                  className="w-full h-full object-contain p-6" 
                />
              </div>

              {/* Info Principal */}
              <div className="space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-[10px] font-black uppercase mb-2 inline-block">
                      {articuloSeleccionado.categoria || 'Sin categoría'}
                    </span>
                    <h3 className="text-3xl font-black text-gray-900 leading-tight">
                      {articuloSeleccionado.nombre}
                    </h3>
                    <p className="text-lg text-gray-400 font-bold">
                      {articuloSeleccionado.marca} — {articuloSeleccionado.modelo}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-black text-blue-600">${articuloSeleccionado.precio.toLocaleString()}</p>
                    <span className={`inline-block mt-2 px-3 py-1 rounded-lg text-xs font-bold ${articuloSeleccionado.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {articuloSeleccionado.stock > 0 ? `✓ ${articuloSeleccionado.stock} disponibles` : '✗ Agotado'}
                    </span>
                  </div>
                </div>

                <div className="h-px bg-gray-100 w-full" />

                {/* Descripción */}
                <div>
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Descripción</h4>
                  <p className="text-gray-700 leading-relaxed text-lg whitespace-pre-wrap">
                    {articuloSeleccionado.descripcion}
                  </p>
                </div>

                {/* Grid de Datos Técnicos */}
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Marca</p>
                    <p className="font-bold text-gray-800">{articuloSeleccionado.marca}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Modelo</p>
                    <p className="font-bold text-gray-800">{articuloSeleccionado.modelo}</p>
                  </div>
                </div>

                {/* Botón de Link / Copiar */}
                {articuloSeleccionado.link && (
                  <div className="pt-6">
                    <button
                      onClick={() => copiarLink(articuloSeleccionado.link)}
                      className="w-full flex items-center justify-between p-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <span className="bg-white/20 p-2 rounded-lg">🔗</span>
                        <span className="font-bold">{copiado ? '¡LINK COPIADO!' : 'COPIAR LINK DEL PRODUCTO'}</span>
                      </div>
                      <span className="text-white/60 group-hover:text-white transition-colors">
                        {copiado ? '✓' : '→'}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Botón de Cierre Inferior */}
              <button 
                onClick={cerrarDetalles}
                className="w-full py-4 text-sm font-black text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest"
              >
                Cerrar vista detallada
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  )
}

export default Catalogo
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { Articulo } from '../types'

const SHEET_ANIM_MS = 300;

function Catalogo() {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [cargando, setCargando] = useState(true);

  // --- ESTADOS DE FILTRADO ---
  const [precioMax, setPrecioMax] = useState<number>(0);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  // --- ESTADOS DE DETALLE ---
  const [articuloSeleccionado, setArticuloSeleccionado] = useState<Articulo | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [mostrarSheet, setMostrarSheet] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastActiveElRef = useRef<HTMLElement | null>(null);

  // ✅ Precio máximo dinámico (según el artículo más caro) + redondeo bonito
  const precioMaximoRedondeado = useMemo(() => {
    if (articulos.length === 0) return 0;
    const maxReal = Math.max(...articulos.map(a => Number(a.precio) || 0));
    if (!Number.isFinite(maxReal) || maxReal <= 0) return 0;
    return Math.ceil(maxReal / 100) * 100; // redondea a múltiplos de 100
  }, [articulos]);

  // ✅ Al cargar artículos, setea el slider al máximo real
  useEffect(() => {
    if (precioMaximoRedondeado > 0) {
      setPrecioMax(precioMaximoRedondeado);
    }
  }, [precioMaximoRedondeado]);

  const categoriasUnicas = useMemo(() => {
    const cats = articulos.map(a => a.categoria).filter(Boolean);
    return Array.from(new Set(cats));
  }, [articulos]);

  const articulosFiltrados = useMemo(() => {
    return articulos.filter(art => {
      const coincideBusqueda = art.nombre.toLowerCase().includes(busqueda.toLowerCase());
      const coincidePrecio = (Number(art.precio) || 0) <= precioMax;
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

  if (cargando) return <div className="text-center mt-20 animate-pulse font-bold text-blue-600">Cargando catálogo...</div>;

  return (
    <main className="min-h-screen bg-white p-3 md:p-8">
      <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row gap-6 md:gap-8">
        
        {/* --- SIDEBAR DE FILTROS --- */}
        <aside className="w-full md:w-72 flex-shrink-0 space-y-6 md:space-y-8">
          <h2 className="text-xl md:text-2xl font-black text-gray-800 flex items-center justify-between">
            Filtrar por <span className="text-sm">⚡</span>
          </h2>
          
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <div className="flex justify-between text-[10px] font-bold uppercase text-gray-400 mb-3">
                <span>Rango máx.</span>
                <span className="text-blue-600">${precioMax.toLocaleString()}</span>
              </div>

              <input 
                type="range"
                min="0"
                max={precioMaximoRedondeado || 0}
                step={precioMaximoRedondeado > 5000 ? 100 : 10}
                value={precioMax}
                onChange={(e) => setPrecioMax(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                disabled={precioMaximoRedondeado === 0}
              />
            </div>

            <div>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Categorías</h3>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => setCategoriaSeleccionada(null)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${!categoriaSeleccionada ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                  TODOS
                </button>
                {categoriasUnicas.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setCategoriaSeleccionada(cat === categoriaSeleccionada ? null : cat)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all ${categoriaSeleccionada === cat ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="hidden md:block">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Buscar</h3>
              <input 
                type="text"
                placeholder="Nombre..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full p-3 bg-gray-50 border-none rounded-xl text-sm outline-none"
              />
            </div>
          </div>
        </aside>

        {/* --- GRID DE PRODUCTOS (2 COLUMNAS EN MÓVIL) --- */}
        <section className="flex-1">
          <header className="mb-6">
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 leading-none">Catálogo</h1>
            <p className="text-gray-400 text-xs md:text-sm mt-2 font-medium">{articulosFiltrados.length} artículos</p>
          </header>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
            {articulosFiltrados.map((item) => (
              <div 
                key={item.id} 
                className="group bg-white rounded-2xl md:rounded-3xl border border-gray-100 p-2 md:p-4 hover:shadow-xl transition-all duration-300"
              >
                <div className="aspect-square rounded-xl md:rounded-2xl bg-gray-50 overflow-hidden mb-3 relative">
                  <img 
                    src={item.imagen_url || 'https://via.placeholder.com/400'} 
                    alt={item.nombre}
                    className="w-full h-full object-contain p-2 md:p-4 group-hover:scale-105 transition-transform"
                  />
                </div>
                
                <div className="space-y-1 text-center md:text-left">
                  <h3 className="text-[10px] md:text-xs font-bold text-gray-800 line-clamp-2 min-h-[30px] md:min-h-[40px] uppercase leading-tight">
                    {item.nombre}
                  </h3>
                  <p className="text-sm md:text-lg font-black text-blue-600">${Number(item.precio).toFixed(2)}</p>
                  
                  <button 
                    onClick={() => abrirDetalles(item)}
                    className="w-full py-2 md:py-3 mt-1 rounded-lg md:rounded-xl bg-gray-900 text-white text-[9px] md:text-xs font-bold"
                  >
                    VER DETALLES
                  </button>
                </div>
              </div>
            ))}
          </div>

          {articulosFiltrados.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm font-bold">Sin resultados</div>
          )}
        </section>
      </div>

      {/* --- PANEL DE DETALLE --- */}
      {mostrarSheet && articuloSeleccionado && (
        <>
          <div className={`fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 transition-opacity ${detalleAbierto ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={cerrarDetalles} />
          <div className={`fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 transform transition-transform duration-500 overflow-y-auto ${detalleAbierto ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="sticky top-0 bg-white p-4 flex justify-between items-center border-b z-10">
              <h2 className="text-sm font-black uppercase">Detalle</h2>
              <button onClick={cerrarDetalles} ref={closeBtnRef} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">✕</button>
            </div>
            <div className="p-6 md:p-8 space-y-6">
              <div className="w-full aspect-square bg-gray-50 rounded-2xl overflow-hidden">
                <img src={articuloSeleccionado.imagen_url} className="w-full h-full object-contain p-4" />
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl md:text-3xl font-black text-gray-900 uppercase leading-none">{articuloSeleccionado.nombre}</h3>
                <div className="flex justify-between items-center">
                  <p className="text-3xl font-black text-blue-600">${articuloSeleccionado.precio}</p>
                  <span className="text-xs font-bold px-2 py-1 bg-green-100 text-green-700 rounded">{articuloSeleccionado.stock} disponibles</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-3 bg-gray-50 rounded-lg"><b>MARCA:</b> {articuloSeleccionado.marca}</div>
                    <div className="p-3 bg-gray-50 rounded-lg"><b>MODELO:</b> {articuloSeleccionado.modelo}</div>
                </div>
                <p className="text-gray-600 text-sm md:text-base leading-relaxed">{articuloSeleccionado.descripcion}</p>
                {articuloSeleccionado.link && (
                  <button onClick={() => copiarLink(articuloSeleccionado.link)} className="w-full p-4 bg-blue-600 text-white rounded-xl font-bold flex justify-between items-center uppercase text-xs">
                    <span>{copiado ? '¡Copiado!' : 'Copiar Link'}</span>
                    <span>🔗</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  )
}

export default Catalogo
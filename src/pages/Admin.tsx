import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase'; //
import { useNavigate } from 'react-router-dom'; //
import type { Articulo } from '../types';

const SHEET_ANIM_MS = 300;

// --- COMPONENTE ADMIN ---
export default function Admin() {
  const [articulos, setarticulos] = useState<Articulo[]>([]);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true); // AGREGADO: Estado para evitar que se vea el panel antes de validar
  const [bottomSheetAbierto, setBottomSheetAbierto] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastActiveElRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();

  const [formulario, setFormulario] = useState({
    nombre: '', marca: '', modelo: '', precio: null as number | null, stock: null as number | null, descripcion: '', imagen_url: '', categoria: '', link: ''
  });

  // Función para limpiar formulario
  const limpiarFormulario = useCallback(() => {
    setEditandoId(null);
    setFormulario({ nombre: '', marca: '', modelo: '', precio: null, stock: null, descripcion: '', imagen_url: '', categoria: '', link: '' });
  }, []);

  // Función para cerrar bottom sheet
  const cerrarBottomSheet = useCallback(() => {
    setBottomSheetAbierto(false);
    // Mantener montado el sheet durante la animación de cierre
    window.setTimeout(() => {
      limpiarFormulario();
      lastActiveElRef.current?.focus?.();
    }, SHEET_ANIM_MS);
  }, [limpiarFormulario]);

  // MODIFICADO: El useEffect ahora primero valida si el usuario tiene permiso
  useEffect(() => {
    const validarSesion = async () => {
      const { data: { session } } = await supabase.auth.getSession(); //
      
      if (!session) {
        // Si no hay llave de acceso, lo mandamos al login de inmediato
        navigate('/login'); 
      } else {
        // Si la sesión es válida, quitamos la pantalla de carga y pedimos los datos
        setCargando(false);
        fetcharticulos();
      }
    };
    validarSesion();
  }, [navigate]);

  // Efecto para manejar el scroll del body y la tecla Escape
  useEffect(() => {
    if (bottomSheetAbierto) {
      // Prevenir scroll del body cuando el side sheet está abierto
      document.body.style.overflow = 'hidden';
      
      // Función para cerrar con Escape
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          cerrarBottomSheet();
        }
      };
      
      document.addEventListener('keydown', handleEscape);
      
      return () => {
        document.body.style.overflow = 'unset';
        document.removeEventListener('keydown', handleEscape);
      };
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [bottomSheetAbierto, cerrarBottomSheet]);

  async function fetcharticulos() {
    const { data } = await supabase.from('articulos').select('*').order('id', { ascending: false });
    if (data) setarticulos(data);
  }

  // --- FUNCIÓN PARA ELIMINAR (Sin cambios) ---
  const eliminarProducto = async (id: number) => {
    const confirmar = confirm("¿Estás seguro de eliminar este artículo?");
    if (!confirmar) return;

    const { error } = await supabase.from('articulos').delete().eq('id', id);

    if (error) {
      setMensaje("Error al eliminar: " + error.message);
    } else {
      setarticulos(articulos.filter(art => art.id !== id));
      setMensaje("Artículo eliminado correctamente.");
    }
  };

  // --- FUNCIÓN PARA EDITAR ---
  const seleccionarParaEditar = (art: Articulo) => {
    lastActiveElRef.current = document.activeElement as HTMLElement | null;
    setEditandoId(art.id);
    setFormulario({ ...art });
    setBottomSheetAbierto(true);
    window.setTimeout(() => closeBtnRef.current?.focus(), 0);
  };

  // Función para abrir bottom sheet para nuevo producto
  const abrirNuevoProducto = () => {
    lastActiveElRef.current = document.activeElement as HTMLElement | null;
    limpiarFormulario();
    setBottomSheetAbierto(true);
    window.setTimeout(() => closeBtnRef.current?.focus(), 0);
  };

  // --- FUNCIÓN PARA GUARDAR ---
  const guardarCambios = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);
    
    if (editandoId) {
      const { error } = await supabase.from('articulos').update(formulario).eq('id', editandoId);
      if (!error) {
        fetcharticulos();
        cerrarBottomSheet();
        setMensaje("Producto actualizado correctamente.");
      } else {
        setMensaje("Error al actualizar: " + error.message);
      }
    } else {
      const { error } = await supabase.from('articulos').insert([formulario]);
      if (!error) {
        fetcharticulos();
        cerrarBottomSheet();
        setMensaje("Producto guardado correctamente.");
      } else {
        setMensaje("Error al guardar: " + error.message);
      }
    }
  };

  // AGREGADO: Mientras se verifica la sesión, mostramos este mensaje protector
  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
          <p className="text-lg font-semibold text-gray-600">Verificando acceso de administrador...</p>
        </div>
      </div>
    );
  }

  // Calcular estadísticas
  const totalProductos = articulos.length;
  const totalStock = articulos.reduce((sum, art) => sum + art.stock, 0);
  const valorInventario = articulos.reduce((sum, art) => sum + (art.precio * art.stock), 0);
  const productosSinStock = articulos.filter(art => art.stock === 0).length;

  // Búsqueda y paginación para la tabla
  const busquedaNormalizada = busqueda.toLowerCase().trim();
  const articulosFiltrados = articulos.filter((art) => {
    if (!busquedaNormalizada) return true;
    const texto = `${art.nombre} ${art.marca} ${art.modelo} ${art.categoria ?? ''}`.toLowerCase();
    return texto.includes(busquedaNormalizada);
  });

  const ITEMS_POR_PAGINA = 10;
  const totalPaginas = Math.max(1, Math.ceil(articulosFiltrados.length / ITEMS_POR_PAGINA));
  const paginaSegura = Math.min(Math.max(1, paginaActual), totalPaginas);
  const indiceInicio = (paginaSegura - 1) * ITEMS_POR_PAGINA;
  const articulosPagina = articulosFiltrados.slice(indiceInicio, indiceInicio + ITEMS_POR_PAGINA);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Mensajes accesibles (WCAG 4.1.3) */}
        <div role="status" aria-live="polite" className="sr-only">
          {mensaje ?? ''}
        </div>
        {mensaje && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800">
            {mensaje}
          </div>
        )}
        
        {/* Header Mejorado */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-6">
          <div className="mb-6">
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
              Panel de Control
            </h1>
            <p className="text-gray-500">Gestión completa de inventario</p>
          </div>

          {/* Estadísticas Rápidas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-sm text-gray-500 mb-2 font-medium">Total Productos</p>
              <p className="text-3xl font-bold text-gray-800">{totalProductos}</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-sm text-gray-500 mb-2 font-medium">Stock Total</p>
              <p className="text-3xl font-bold text-gray-800">{totalStock}</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-sm text-gray-500 mb-2 font-medium">Valor Inventario</p>
              <p className="text-2xl font-bold text-gray-800">${valorInventario.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-sm text-gray-500 mb-2 font-medium">Sin Stock</p>
              <p className="text-3xl font-bold text-gray-800">{productosSinStock}</p>
            </div>
          </div>
        </div>

        {/* Botón para abrir side sheet - Nuevo Producto */}
        <div className="mb-6">
          <button
            onClick={abrirNuevoProducto}
            type="button"
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center gap-2"
          >
            <span>➕</span> Nuevo Producto
          </button>
        </div>

        {/* Side Sheet - Overlay */}
        <div 
          className={`fixed inset-0 bg-black/10 z-40 transition-opacity duration-300 ease-in-out motion-reduce:transition-none ${
            bottomSheetAbierto ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={cerrarBottomSheet}
          aria-hidden="true"
        />

        {/* Side Sheet - Panel */}
        <div 
          className={`fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out motion-reduce:transition-none overflow-y-auto ${
            bottomSheetAbierto ? 'translate-x-0' : 'translate-x-full pointer-events-none'
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="side-sheet-title"
        >
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10">
            <div>
              <h2 id="side-sheet-title" className="text-2xl font-bold text-gray-800">
                {editandoId ? (
                  <span className="flex items-center gap-2">
                    <span className="text-orange-500">✏️</span> Editando Producto
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="text-blue-500">➕</span> Nuevo Producto
                  </span>
                )}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {editandoId ? 'Modifica los datos del producto seleccionado' : 'Completa todos los campos para agregar un nuevo artículo'}
              </p>
            </div>
            <button
              onClick={cerrarBottomSheet}
              type="button"
              ref={closeBtnRef}
              className="text-gray-500 hover:text-gray-700 font-bold text-2xl w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Cerrar panel"
            >
              ×
            </button>
          </div>

          <div className="p-6 md:p-8">
          <form onSubmit={guardarCambios} className="space-y-6" aria-describedby="form-ayuda">
            <p id="form-ayuda" className="sr-only">
              Completa los campos obligatorios marcados con asterisco y guarda el producto.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nombre */}
              <div className="space-y-2">
                <label htmlFor="nombre" className="block text-sm font-semibold text-gray-700">
                  Nombre del Producto <span className="text-red-500">*</span>
                </label>
                <input 
                  id="nombre"
                  type="text" 
                  placeholder="Ej: Laptop HP Pavilion" 
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none" 
                  value={formulario.nombre} 
                  onChange={e => setFormulario({...formulario, nombre: e.target.value})} 
                  required 
                />
              </div>

              {/* Marca */}
              <div className="space-y-2">
                <label htmlFor="marca" className="block text-sm font-semibold text-gray-700">
                  Marca <span className="text-red-500">*</span>
                </label>
                <input 
                  id="marca"
                  type="text" 
                  placeholder="Ej: HP, Dell, Samsung" 
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none" 
                  value={formulario.marca} 
                  onChange={e => setFormulario({...formulario, marca: e.target.value})} 
                  required 
                />
              </div>

              {/* Modelo */}
              <div className="space-y-2">
                <label htmlFor="modelo" className="block text-sm font-semibold text-gray-700">
                  Modelo <span className="text-red-500">*</span>
                </label>
                <input 
                  id="modelo"
                  type="text" 
                  placeholder="Ej: 15-dw2000la" 
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none" 
                  value={formulario.modelo} 
                  onChange={e => setFormulario({...formulario, modelo: e.target.value})} 
                  required 
                />
              </div>

              {/* Categoría */}
              <div className="space-y-2">
                <label htmlFor="categoria" className="block text-sm font-semibold text-gray-700">
                  Categoría <span className="text-red-500">*</span>
                </label>
                <input 
                  id="categoria"
                  type="text" 
                  placeholder="Ej: Papelería, Electrónica" 
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none" 
                  value={formulario.categoria} 
                  onChange={e => setFormulario({...formulario, categoria: e.target.value})} 
                  required 
                />
              </div>

              {/* Link */}
              <div className="space-y-2">
                <label htmlFor="link" className="block text-sm font-semibold text-gray-700">
                  Link / URL del producto
                </label>
                <input 
                  id="link"
                  type="url" 
                  placeholder="https://tutienda.com/articulo" 
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none" 
                  value={formulario.link} 
                  onChange={e => setFormulario({...formulario, link: e.target.value})} 
                />
              </div>

              {/* Precio */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Precio (USD) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">$</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0"
                    placeholder="0.00" 
                    className="w-full p-3 pl-8 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none" 
                    value={formulario.precio ?? ''} 
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormulario({ ...formulario, precio: v === '' ? null : Number(v) });
                    }} 
                    required 
                  />
                </div>
              </div>

              {/* Stock */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Stock Disponible <span className="text-red-500">*</span>
                </label>
                <input 
                  type="number" 
                  min="0"
                  placeholder="0" 
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none" 
                  value={formulario.stock ?? ''} 
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormulario({ ...formulario, stock: v === '' ? null : Number(v) });
                  }} 
                  required 
                />
                {formulario.stock === 0 && formulario.stock !== null && (
                  <p className="text-xs text-orange-500"> El producto quedará sin stock</p>
                )}
              </div>

              {/* URL de Imagen */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  URL de Imagen <span className="text-red-500">*</span>
                </label>
                <input 
                  type="url" 
                  placeholder="https://ejemplo.com/imagen.jpg" 
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none" 
                  value={formulario.imagen_url} 
                  onChange={e => setFormulario({...formulario, imagen_url: e.target.value})} 
                  required 
                />
              </div>
            </div>

            {/* Preview de Imagen */}
            {formulario.imagen_url && (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Vista Previa de Imagen</label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 bg-gray-50 flex justify-center">
                  <img 
                    src={formulario.imagen_url} 
                    alt="Preview" 
                    className="max-h-48 rounded-lg shadow-md object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Imagen+no+disponible';
                    }}
                  />
                </div>
              </div>
            )}

            {/* Descripción */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Descripción del Producto <span className="text-red-500">*</span>
              </label>
              <textarea 
                placeholder="Describe las características principales del producto..." 
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none resize-none" 
                rows={4} 
                value={formulario.descripcion} 
                onChange={e => setFormulario({...formulario, descripcion: e.target.value})} 
                required 
              />
              <p className="text-xs text-gray-500">{formulario.descripcion.length} caracteres</p>
            </div>
          
              {/* Botones de Acción */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button 
                  type="submit" 
                  className={`flex-1 p-4 rounded-xl font-bold text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all focus:outline-none focus:ring-4 focus:ring-blue-300 ${
                    editandoId 
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700' 
                      : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
                  }`}
                >
                  {editandoId ? '💾 ACTUALIZAR PRODUCTO' : ' GUARDAR PRODUCTO'}
                </button>
                <button 
                  type="button"
                  onClick={cerrarBottomSheet}
                  className="px-6 p-4 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Lista de Productos Mejorada */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <span></span> Inventario de Productos
              </h2>
              <p className="text-sm text-gray-500 mt-1">Gestiona todos tus productos desde aquí</p>
            </div>
            {/* Buscador */}
            <div className="w-full max-w-xs">
              <label htmlFor="buscador-productos" className="sr-only">
                Buscar productos por nombre, marca, modelo o categoría
              </label>
              <div className="relative">
                <input
                  id="buscador-productos"
                  type="search"
                  className="w-full rounded-xl border border-gray-300 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Buscar productos..."
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    setPaginaActual(1);
                  }}
                />
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                  
                </span>
              </div>
            </div>
          </div>

          {articulosFiltrados.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-xl font-semibold text-gray-600 mb-2">No hay productos registrados</p>
              <p className="text-gray-500">Comienza agregando tu primer producto usando el formulario de arriba</p>
            </div>
          ) : (
            <>
            <div className="overflow-x-auto text-sm">
              <table className="w-full table-fixed">
                <caption className="sr-only">
                  Inventario de productos con acciones para editar y eliminar.
                </caption>
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th scope="col" className="p-4 text-xs font-bold text-gray-600 uppercase tracking-wider">ID</th>
                    <th scope="col" className="p-4 text-xs font-bold text-gray-600 uppercase tracking-wider">Imagen</th>
                    <th scope="col" className="p-4 text-xs font-bold text-gray-600 uppercase tracking-wider">Producto</th>
                    <th scope="col" className="p-4 text-xs font-bold text-gray-600 uppercase tracking-wider">Marca/Modelo</th>
                    <th scope="col" className="p-4 text-xs font-bold text-gray-600 uppercase tracking-wider">Categoría</th>
                    <th scope="col" className="p-4 text-xs font-bold text-gray-600 uppercase tracking-wider">Precio</th>
                    <th scope="col" className="p-4 text-xs font-bold text-gray-600 uppercase tracking-wider">Stock</th>
                    <th scope="col" className="p-4 text-xs font-bold text-gray-600 uppercase tracking-wider w-56">Descripción</th>
                    <th scope="col" className="p-4 text-xs font-bold text-gray-600 uppercase tracking-wider w-28">Link</th>
                    <th scope="col" className="p-4 text-xs font-bold text-gray-600 uppercase tracking-wider text-right w-40">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {articulosPagina.map((art) => (
                    <tr key={art.id} className="hover:bg-blue-50 transition-colors">
                      <td className="p-4">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-semibold text-sm">
                          {art.id}
                        </span>
                      </td>
                      <td className="p-4">
                        {art.imagen_url ? (
                          <img 
                            src={art.imagen_url} 
                            alt={art.nombre} 
                            className="w-20 h-20 object-cover rounded-xl shadow-md border-2 border-gray-200" 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/80?text=Sin+imagen';
                            }}
                          />
                        ) : (
                          <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl flex items-center justify-center text-xs text-gray-500 font-semibold shadow-inner">
                            Sin imagen
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-gray-800 text-sm">{art.nombre}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-sm font-semibold text-gray-700">{art.marca}</p>
                        <p className="text-xs text-gray-500">{art.modelo}</p>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-semibold text-xs">
                          {art.categoria || 'Sin categoría'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-700 font-bold text-sm">
                          ${art.precio.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full font-semibold text-sm ${
                          art.stock > 0 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {art.stock > 0 ? `✓ ${art.stock}` : '✗ Agotado'}
                        </span>
                      </td>
                      <td className="p-4 w-56">
                        <p className="text-sm text-gray-600 max-w-[12rem] truncate" title={art.descripcion}>
                          {art.descripcion}
                        </p>
                      </td>
                      <td className="p-4 w-28">
                        {art.link ? (
                          <a
                            href={art.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm font-semibold underline whitespace-nowrap"
                          >
                            Ver link
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">Sin link</span>
                        )}
                      </td>
                      <td className="p-4 w-40">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button 
                            onClick={() => seleccionarParaEditar(art)} 
                            className="min-w-[88px] px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-xs md:text-sm transition-all shadow-md hover:shadow-lg"
                          >
                            Editar
                          </button>
                          <button 
                            onClick={() => eliminarProducto(art.id)} 
                            className="min-w-[88px] px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-xs md:text-sm transition-all shadow-md hover:shadow-lg"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div className="flex flex-col gap-3 px-4 py-3 border-t border-gray-200 md:flex-row md:items-center md:justify-between text-sm">
              <p className="text-gray-600">
                Mostrando{' '}
                {articulosFiltrados.length === 0 ? 0 : indiceInicio + 1}
                {'–'}
                {Math.min(indiceInicio + ITEMS_POR_PAGINA, articulosFiltrados.length)} de {articulosFiltrados.length} productos
              </p>
              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaginaActual((prev) => Math.max(1, prev - 1))}
                  disabled={paginaSegura === 1}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                    paginaSegura === 1
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                  aria-label="Página anterior"
                >
                  Anterior
                </button>
                <span className="text-gray-600 text-xs">
                  Página {paginaSegura} de {totalPaginas}
                </span>
                <button
                  type="button"
                  onClick={() => setPaginaActual((prev) => Math.min(totalPaginas, prev + 1))}
                  disabled={paginaSegura === totalPaginas || articulosFiltrados.length === 0}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                    paginaSegura === totalPaginas || articulosFiltrados.length === 0
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                  aria-label="Página siguiente"
                >
                  Siguiente
                </button>
              </div>
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const estaEnAdmin = location.pathname === '/admin';

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex justify-between items-center">
        
        {/* Lado Izquierdo: Logo */}
        <Link to="/" className="text-2xl font-black text-blue-600 tracking-tighter hover:opacity-80 transition">
          TECH<span className="text-gray-900">SHOP</span>
        </Link>

        {/* Lado Derecho: Enlaces */}
        <div className="flex items-center gap-6">
          <Link to="/" className="text-sm font-bold text-gray-500 hover:text-blue-600 transition">
            Ver Catálogo
          </Link>
          
          {!estaEnAdmin && (
            <Link 
              to="/admin" 
              className="bg-gray-900 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-gray-800 transition shadow-lg shadow-gray-200"
            >
              Panel Gestor
            </Link>
          )}

          {estaEnAdmin && (
            <button 
              onClick={cerrarSesion}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-xl"
            >
              Cerrar Sesión
            </button>
          )}
        </div>

      </div>
    </nav>
  );
}
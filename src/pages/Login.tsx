import { useState } from 'react';
import { supabase } from '../lib/supabase'; // Conexión con la nube
import { useNavigate } from 'react-router-dom'; // Para saltar de página

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    // Aquí le preguntamos a Supabase: "¿Este usuario es real?"
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);

    if (authError) {
      setError("Datos incorrectos: " + authError.message);
    } else {
      // Si todo es correcto, nos manda a la página de adminfisico
      navigate('/admin'); 
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-blue-50">
      <main className="w-full max-w-sm">
        <form 
          onSubmit={handleLogin} 
          className="bg-white p-10 rounded-2xl shadow-2xl"
          noValidate
          aria-labelledby="login-heading"
        >
          <h1 id="login-heading" className="text-3xl font-bold mb-8 text-center text-gray-800">
            Acceso Admin
          </h1>
          
          {error && (
            <div 
              role="alert"
              aria-live="assertive"
              className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700"
            >
              <strong className="font-semibold">Error:</strong> {error}
            </div>
          )}

          <div className="mb-4">
            <label 
              htmlFor="email-input"
              className="block mb-2 text-sm font-semibold text-gray-700"
            >
              Correo electrónico
            </label>
            <input 
              id="email-input"
              type="email" 
              name="email"
              autoComplete="email"
              placeholder="ejemplo@correo.com" 
              className={`w-full p-4 border-2 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all ${
                error ? 'border-red-300' : 'border-gray-100'
              }`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby={error ? "error-message" : undefined}
              aria-invalid={error ? "true" : "false"}
              aria-required="true"
              required
            />
          </div>

          <div className="mb-8">
            <label 
              htmlFor="password-input"
              className="block mb-2 text-sm font-semibold text-gray-700"
            >
              Contraseña
            </label>
            <input 
              id="password-input"
              type="password" 
              name="password"
              autoComplete="current-password"
              placeholder="Ingresa tu contraseña" 
              className={`w-full p-4 border-2 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all ${
                error ? 'border-red-300' : 'border-gray-100'
              }`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={error ? "error-message" : undefined}
              aria-invalid={error ? "true" : "false"}
              aria-required="true"
              required
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 focus:bg-blue-700 text-white font-black py-4 rounded-xl transition-transform active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? 'Iniciando sesión...' : 'ENTRAR'}
          </button>
        </form>
      </main>
    </div>
  );
}
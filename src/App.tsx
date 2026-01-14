import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Catalogo from './pages/Catalogo';
import Login from './pages/Login';
import Admin from './pages/Admin';
import Navbar from './components/Navbar';

function App() {
  return (
    <BrowserRouter>
    <Navbar />
      
      <Routes>
        {/* Cuando la URL es http://localhost:5173/ */}
        <Route path="/" element={<Catalogo />} />
        
        {/* Cuando la URL es http://localhost:5173/login */}
        <Route path="/login" element={<Login />} />
        
        {/* Cuando lleguemos al panel de control */}
        <Route path="/admin" element={<><Admin /><div className="p-10 text-2xl font-bold text-green-600"></div></>} />  {/* <Admin /> es el componente Admin */}
      </Routes>
    </BrowserRouter>
  );
}

export default App; // ESTA LÍNEA ES VITAL
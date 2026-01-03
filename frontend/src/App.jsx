import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Shopping from './pages/Shopping';
import History from './pages/History';
import AcceptInvite from './pages/AcceptInvite';
import Settings from './pages/Settings';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
// 1. ADICIONADO: Importar useEffect aqui
import { useContext, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

// --- COMPONENTE DE ROTA PRIVADA BLINDADO ---
const PrivateRoute = ({ children }) => {
  const { signed, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50 dark:bg-[#0F172A]">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-teal-600" />
            <p className="text-gray-500 font-medium text-sm animate-pulse">Carregando sua casa...</p>
        </div>
      </div>
    );
  }

  if (!signed) {
    return <Navigate to="/login" />;
  }

  return children;
};

function App() {
  // 2. ADICIONADO: Lógica para injetar o Favicon e Título
  useEffect(() => {
    // Tenta achar o link do favicon existente
    let link = document.querySelector("link[rel~='icon']");
    
    // Se não existir, cria um novo
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    
    // Define a imagem (Certifique-se que favicon.png está na pasta 'public')
    link.href = '../public/domo.svg';
    
    // Define o título da aba
    document.title = "Domo - Gestão Financeira";
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Toaster position="top-center" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />
            
            {/* Rotas Protegidas */}
            <Route path="/app" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/inventory" element={<PrivateRoute><Inventory /></PrivateRoute>} />
            <Route path="/shopping" element={<PrivateRoute><Shopping /></PrivateRoute>} />
            <Route path="/history" element={<PrivateRoute><History /></PrivateRoute>} />  
            <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
            <Route path="/accept-invite/:token" element={<AcceptInvite />} />
            {/* Redirecionamento padrão */}
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
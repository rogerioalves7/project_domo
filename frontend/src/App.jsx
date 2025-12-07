import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Shopping from './pages/Shopping'; // Certifique-se que está importado
import History from './pages/History';
import AcceptInvite from './pages/AcceptInvite';
import Settings from './pages/Settings';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { useContext } from 'react';
import { Loader2 } from 'lucide-react'; // Ícone de loading

// --- COMPONENTE DE ROTA PRIVADA BLINDADO ---
const PrivateRoute = ({ children }) => {
  const { signed, loading } = useContext(AuthContext);

  // 1. Se estiver carregando o localStorage, mostra tela de espera
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

  // 2. Se terminou de carregar e NÃO tem usuário, vai pro Login
  if (!signed) {
    return <Navigate to="/login" />;
  }

  // 3. Se tem usuário, libera o acesso
  return children;
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Toaster position="top-center" />
          <Routes>
            <Route path="/login" element={<Login />} />
            
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
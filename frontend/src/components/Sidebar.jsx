import { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import logoImg from '../assets/logo.png';
import { 
  Home, BarChart3, Box, ShoppingCart, Settings, LogOut 
} from 'lucide-react';

export default function Sidebar() {
  const { signOut } = useContext(AuthContext);

  const navItems = [
    { icon: Home, label: 'Início', path: '/app' },
    { icon: BarChart3, label: 'Histórico', path: '/history' },
    { icon: Box, label: 'Estoque', path: '/inventory' },
    { icon: ShoppingCart, label: 'Compras', path: '/shopping' },
    { icon: Settings, label: 'Configurações', path: '/settings' },
  ];

  return (
    <aside className="hidden md:flex w-64 flex-col h-full border-r transition-colors shrink-0
                      bg-white border-gray-200 
                      dark:bg-[#1E293B] dark:border-slate-800">
      
      {/* HEADER DA SIDEBAR */}
      <div className="h-40 flex items-center justify-center border-b border-gray-100 dark:border-slate-800 shrink-0 p-4">
        
        {/* CONTAINER DO LOGO */}
        {/* bg-white: Fundo Branco */}
        {/* border border-gray-200: Borda para separar o branco do branco */}
        {/* shadow-lg: Sombra para destacar o retângulo */}
        <div className="bg-white dark:bg-white p-6 rounded-[25px] flex items-center justify-center shadow-lg border border-gray-200 dark:border-slate-600 transition-all hover:scale-105">
            <img 
                src={logoImg} 
                alt="Logo Domo" 
                className="h-20 w-auto object-contain" 
            />
        </div>

      </div>

      {/* NAVEGAÇÃO */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.path}
            className={({ isActive }) => `
              flex items-center px-4 py-3 rounded-xl transition-all font-medium
              ${isActive 
                ? 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400 shadow-sm' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
              }
            `}
          >
            <item.icon size={20} className="mr-3" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* FOOTER (Logout) */}
      <div className="p-4 border-t border-gray-100 dark:border-slate-800 shrink-0">
        <button 
          onClick={signOut}
          className="flex items-center w-full px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors font-medium"
        >
          <LogOut size={20} className="mr-3" />
          Sair do Sistema
        </button>
      </div>
    </aside>
  );
}
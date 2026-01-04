import { NavLink } from 'react-router-dom';
import { Home, BarChart3, Box, ShoppingCart, Settings, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function MobileMenu() {
  const { theme, toggleTheme } = useTheme();
  
  // Função auxiliar para classes de estilo ativo/inativo
  const linkClass = ({ isActive }) => 
    `flex flex-col items-center space-y-1 transition-colors duration-200 ${
      isActive 
        ? 'text-teal-600 dark:text-teal-400' 
        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
    }`;

  return (
    <nav className="fixed bottom-0 left-0 w-full pb-safe pt-2 z-50 border-t transition-colors md:hidden bg-white border-gray-200 dark:bg-[#1E293B] dark:border-slate-800">
      <div className="grid grid-cols-6 justify-items-center items-center h-16 w-full max-w-md mx-auto">
          
          <NavLink to="/app" className={linkClass}>
            <Home size={22} />
            <span className="text-[10px]">Início</span>
          </NavLink>

          {/* Link temporário para Histórico (pode manter rota /history mesmo que não exista ainda) */}
          <NavLink to="/history" className={linkClass}>
            <BarChart3 size={22} />
            <span className="text-[10px]">Hist.</span>
          </NavLink>

          <NavLink to="/inventory" className={linkClass}>
            <Box size={22} />
            <span className="text-[10px]">Estoque</span>
          </NavLink>

          <NavLink to="/shopping" className={linkClass}>
            <ShoppingCart size={22} />
            <span className="text-[10px]">Compras</span>
          </NavLink>

          <button onClick={toggleTheme} className="bg-white dark:bg-[#1E293B] flex flex-col items-center space-y-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200">
            {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
            <span className="text-[10px]">Tema</span>
          </button>

          <NavLink to="/settings" className={linkClass}>
            <Settings size={22} />
            <span className="text-[10px]">Config.</span>
          </NavLink>

      </div>
    </nav>
  );
}
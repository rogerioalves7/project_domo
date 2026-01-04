import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity">
      
      {/* Container: Branco no Light, Slate-800 no Dark */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up border border-gray-100 dark:border-slate-700">
        
        {/* Cabeçalho */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-slate-700">
          {/* Título: Preto no Light, Branco no Dark */}
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">{title}</h3>
          
          <button 
            onClick={onClose}
            className="bg-white dark:bg-[#1E293B] p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-4">
          {children}
        </div>

      </div>
    </div>
  );
}
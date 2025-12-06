export default function Input({ icon: Icon, ...props }) {
  return (
    <div className="relative">
      {Icon && (
        <div className="absolute left-3 top-3.5 text-gray-400 dark:text-slate-400 pointer-events-none z-10">
          <Icon size={20} />
        </div>
      )}

      <input
        {...props}
        className={`w-full py-3 pr-4 rounded-xl 
                    
                    /* TEMA CLARO (Padrão) */
                    bg-white border border-gray-200 text-gray-900 placeholder-gray-400
                    
                    /* TEMA ESCURO (Dark Mode) */
                    dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:placeholder-slate-500
                    
                    /* ESTADOS COMUNS */
                    focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent 
                    transition-all font-medium text-lg
                    disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:text-gray-500
                    
                    ${Icon ? 'pl-10' : 'pl-4'}
                   `}
      />
    </div>
  );
}
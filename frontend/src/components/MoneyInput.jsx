import CurrencyInput from 'react-currency-input-field';

export default function MoneyInput({ value, onValueChange, placeholder = "0,00", disabled = false }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-3 text-gray-400 dark:text-slate-400 font-medium z-10 pointer-events-none">
        R$
      </span>

      <CurrencyInput
        id="input-money"
        name="input-money"
        placeholder={placeholder}
        decimalsLimit={2}
        decimalScale={2}
        intlConfig={{ locale: 'pt-BR', currency: 'BRL' }}
        prefix="" 
        value={value}
        onValueChange={(val) => onValueChange(val)}
        disabled={disabled}
        className={`w-full pl-10 pr-4 py-3 rounded-xl 
                    
                    /* TEMA CLARO */
                    bg-white border border-gray-200 text-gray-900 placeholder-gray-400
                    
                    /* TEMA ESCURO */
                    dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:placeholder-slate-500
                    
                    focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent 
                    transition-all font-mono text-lg font-semibold
                    disabled:bg-gray-100 dark:disabled:bg-slate-800
                   `}
      />
    </div>
  );
}
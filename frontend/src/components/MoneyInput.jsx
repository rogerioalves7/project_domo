import { DollarSign } from 'lucide-react';

export default function MoneyInput({ value, onValueChange, placeholder }) {
  
  const handleChange = (e) => {
    let rawValue = e.target.value.replace(/\D/g, '');
    if (rawValue === '') rawValue = '0';
    const intValue = parseInt(rawValue, 10);
    const floatValue = intValue / 100;
    onValueChange(floatValue);
  };

  const formatDisplay = (val) => {
    if (val === '' || val === null || val === undefined) return '0,00';
    const numberVal = typeof val === 'string' ? parseFloat(val) : val;
    return numberVal.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <div className="relative">
      {/* Símbolo R$: Menor e com menos padding no mobile */}
      <div className="absolute inset-y-0 left-0 pl-2 md:pl-3 flex items-center pointer-events-none">
        <span className="text-gray-500 font-bold text-[10px] md:text-sm">R$</span>
      </div>
      
      <input
        type="text"
        inputMode="numeric"
        // AJUSTES MOBILE:
        // pl-7 (mobile) vs pl-10 (desktop) -> Aproxima o texto do R$
        // text-xs (mobile) vs text-sm (desktop) -> Fonte menor
        // py-2 (mobile) vs py-3 (desktop) -> Altura menor
        className="w-full pl-7 md:pl-10 pr-2 md:pr-4 py-2 md:py-3 rounded-xl bg-white border border-gray-200 text-gray-900 dark:bg-slate-900 dark:border-slate-700 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all font-mono font-medium text-right text-xs md:text-sm"
        placeholder={placeholder || "0,00"}
        value={formatDisplay(value)}
        onChange={handleChange}
      />
    </div>
  );
}
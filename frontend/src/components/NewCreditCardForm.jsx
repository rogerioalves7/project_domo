import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import MoneyInput from './MoneyInput';
import Input from './Input';
import { CreditCard, Calendar, ArrowLeft, Trash2 } from 'lucide-react';

export default function NewCreditCardForm({ onSuccess, onBack, initialData = null }) {
  const [name, setName] = useState('');
  const [limitTotal, setLimitTotal] = useState('');
  const [limitAvailable, setLimitAvailable] = useState(''); // <--- Novo Estado
  const [closingDay, setClosingDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [isShared, setIsShared] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setLimitTotal(initialData.limit_total);
      setLimitAvailable(initialData.limit_available); // <--- Carrega na edição
      setClosingDay(initialData.closing_day);
      setDueDay(initialData.due_day);
      setIsShared(initialData.is_shared);
    }
  }, [initialData]);

  // Efeito de conveniência: Ao digitar o Limite Total, se o Disponível estiver vazio, preenche igual.
  useEffect(() => {
    if (!initialData && limitTotal && !limitAvailable) {
        setLimitAvailable(limitTotal);
    }
  }, [limitTotal]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const finalLimitTotal = typeof limitTotal === 'string' ? parseFloat(limitTotal.replace(',', '.')) : limitTotal;
      const finalLimitAvailable = typeof limitAvailable === 'string' ? parseFloat(limitAvailable.replace(',', '.')) : limitAvailable;

      const payload = {
        name,
        limit_total: finalLimitTotal || 0,
        limit_available: finalLimitAvailable || 0, // <--- Envia para API
        closing_day: parseInt(closingDay),
        due_day: parseInt(dueDay),
        is_shared: isShared
      };

      if (initialData) {
        await api.put(`/credit-cards/${initialData.id}/`, payload);
        toast.success("Cartão atualizado!");
      } else {
        await api.post('/credit-cards/', payload);
        toast.success("Cartão criado!");
      }

      onSuccess();

    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar cartão.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (confirm("Deseja excluir este cartão?")) {
        try {
            setLoading(true);
            await api.delete(`/credit-cards/${initialData.id}/`);
            toast.success("Cartão excluído.");
            onSuccess();
        } catch (error) {
            toast.error("Erro ao excluir.");
        }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      
      <div className="flex justify-between items-center mb-2">
         {onBack && (
            <button 
                type="button" 
                onClick={onBack}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
            >
                <ArrowLeft size={16} className="mr-1" /> Voltar
            </button>
         )}
         {initialData && (
            <button type="button" onClick={handleDelete} className="text-red-500 p-1">
                <Trash2 size={18} />
            </button>
         )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Apelido do Cartão</label>
        <Input 
          type="text" 
          required
          placeholder="Ex: Nubank Violeta..."
          value={name}
          onChange={e => setName(e.target.value)}
          icon={CreditCard}
        />
      </div>

      {/* Grid para os Limites */}
      <div className="grid grid-cols-2 gap-4">
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Limite Total</label>
            <MoneyInput 
                value={limitTotal}
                onValueChange={(val) => setLimitTotal(val)}
                placeholder="0,00"
            />
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Limite Disponível</label>
            <MoneyInput 
                value={limitAvailable}
                onValueChange={(val) => setLimitAvailable(val)}
                placeholder="0,00"
            />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dia Fechamento</label>
            <Input 
                type="number" 
                min="1" max="31"
                required
                value={closingDay}
                onChange={e => setClosingDay(e.target.value)}
                icon={Calendar}
            />
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dia Vencimento</label>
            <Input 
                type="number" 
                min="1" max="31"
                required
                value={dueDay}
                onChange={e => setDueDay(e.target.value)}
                icon={Calendar}
            />
        </div>
      </div>

      <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700">
        <div className="flex flex-col">
            <span className="font-medium text-gray-700 dark:text-gray-200">Compartilhar?</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Visível para toda a casa</span>
        </div>
        
        <button
            type="button"
            onClick={() => setIsShared(!isShared)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isShared ? 'bg-teal-500' : 'bg-gray-300 dark:bg-slate-600'
            }`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isShared ? 'translate-x-6' : 'translate-x-1'
                }`}
            />
        </button>
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className="w-full bg-teal-600 text-white font-bold py-3 rounded-xl hover:bg-teal-500 active:scale-95 transition disabled:opacity-50"
      >
        {loading ? 'Salvando...' : (initialData ? 'Atualizar Cartão' : 'Salvar Cartão')}
      </button>

    </form>
  );
}
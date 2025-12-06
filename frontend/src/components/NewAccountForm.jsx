import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import MoneyInput from './MoneyInput';
import Input from './Input';
import { CreditCard, ArrowLeft, Trash2 } from 'lucide-react';

// Aceitamos a prop 'initialData' para preencher o form se for edição
export default function AccountForm({ onSuccess, onBack, initialData = null }) {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [isShared, setIsShared] = useState(true);
  const [loading, setLoading] = useState(false);

  // Se houver dados iniciais (Modo Edição), preenchemos os estados
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setBalance(initialData.balance); // MoneyInput aceita número float ou string
      setIsShared(initialData.is_shared);
    }
  }, [initialData]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      // Converte vírgula para ponto se for string, ou mantém se já for número
      const finalBalance = typeof balance === 'string' 
        ? parseFloat(balance.replace(',', '.')) 
        : balance;

      if (initialData) {
        // --- MODO EDIÇÃO (PUT) ---
        await api.put(`/accounts/${initialData.id}/`, {
          name,
          balance: finalBalance || 0,
          is_shared: isShared
        });
        toast.success("Conta atualizada!");
      } else {
        // --- MODO CRIAÇÃO (POST) ---
        await api.post('/accounts/', {
          name,
          balance: finalBalance || 0,
          is_shared: isShared
        });
        toast.success("Conta criada!");
      }
      
      onSuccess();

    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar conta.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (confirm("Tem certeza que deseja excluir esta conta? O histórico será perdido.")) {
        try {
            setLoading(true);
            await api.delete(`/accounts/${initialData.id}/`);
            toast.success("Conta excluída.");
            onSuccess();
        } catch (error) {
            toast.error("Erro ao excluir.");
            setLoading(false);
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
        
        {/* Botão de Excluir (Só aparece na edição) */}
        {initialData && (
            <button 
                type="button"
                onClick={handleDelete}
                className="text-red-500 hover:text-red-600 p-1 rounded transition"
                title="Excluir Conta"
            >
                <Trash2 size={18} />
            </button>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome da Conta</label>
        <Input 
          type="text" 
          required
          placeholder="Ex: Nubank, Carteira..."
          value={name}
          onChange={e => setName(e.target.value)}
          icon={CreditCard}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Saldo Atual</label>
        <MoneyInput 
            value={balance}
            onValueChange={(val) => setBalance(val)}
        />
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
        {loading ? 'Salvando...' : (initialData ? 'Atualizar Conta' : 'Salvar Conta')}
      </button>

    </form>
  );
}
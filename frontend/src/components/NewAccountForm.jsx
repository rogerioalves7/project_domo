import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import MoneyInput from './MoneyInput';
import { Wallet, Save, Trash2, X, Users, Lock, TrendingDown } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function NewAccountForm({ onSuccess, onBack, initialData = null }) {
  const { theme } = useTheme();
  
  // Inicializamos com string vazia para o useEffect controlar o preenchimento
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [limit, setLimit] = useState(''); // <--- CORREÇÃO: Inicializa vazio para evitar conflitos
  const [isShared, setIsShared] = useState(false);
  const [loading, setLoading] = useState(false);

  // --- 1. CARREGAR DADOS (CORREÇÃO DE CARGA) ---
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setIsShared(initialData.is_shared);
      
      // Carrega o Saldo
      if (initialData.balance !== undefined) {
          setBalance(initialData.balance);
      }
      
      // Carrega o Limite (CORREÇÃO DO PONTO C ESTENDIDA)
      if (initialData.limit !== undefined) {
          setLimit(initialData.limit);
      }
    }
  }, [initialData]);

  // --- LÓGICA DE EXCLUSÃO (MANTIDA) ---
  async function executeDelete(toastId) {
    toast.dismiss(toastId);
    setLoading(true);
    const loadingToast = toast.loading("Excluindo conta...");

    try {
      await api.delete(`/accounts/${initialData.id}/`);
      toast.success("Conta excluída com sucesso!", { id: loadingToast });
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível excluir. Verifique transações vinculadas.", { id: loadingToast });
      setLoading(false);
    }
  }

  function confirmDelete() {
    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[260px] p-1">
        <div className="flex items-start gap-3">
            <div className="bg-rose-100 p-2 rounded-full text-rose-500"><Trash2 size={20} /></div>
            <div>
                <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">Excluir Conta?</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Isso pode afetar o histórico financeiro vinculado.</p>
            </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-700 mt-1">
          <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition">Cancelar</button>
          <button onClick={() => executeDelete(t.id)} className="px-3 py-1.5 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-lg shadow-sm transition">Sim, excluir</button>
        </div>
      </div>
    ), { 
        duration: Infinity, position: 'top-center',
        style: { background: theme === 'dark' ? '#1E293B' : '#fff', color: theme === 'dark' ? '#fff' : '#333' }
    });
  }

  // --- LÓGICA DE SALVAR (CORREÇÃO DE ENVIO) ---
  async function handleSubmit(e) {
    e.preventDefault();
    if (!name) return toast.error("O nome da conta é obrigatório.");

    setLoading(true);
    try {
      // Função auxiliar robusta para converter string formatada (1.000,00) em float (1000.00)
      const parseCurrency = (val) => {
          if (typeof val === 'number') return val;
          if (!val) return 0;
          return parseFloat(val.toString().replace(/\./g, '').replace(',', '.'));
      };

      const payload = {
        name,
        balance: parseCurrency(balance), // Limpa o saldo
        limit: parseCurrency(limit),     // Limpa o limite (CORREÇÃO APLICADA)
        is_shared: isShared
      };

      if (initialData) {
        await api.patch(`/accounts/${initialData.id}/`, payload);
        toast.success("Conta atualizada!");
      } else {
        await api.post('/accounts/', payload);
        toast.success("Conta criada!");
      }
      
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar conta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      
      {/* Cabeçalho Visual (LAYOUT ANTIGO PRESERVADO) */}
      <div className="flex items-center gap-3 p-4 bg-teal-50 dark:bg-teal-900/20 rounded-xl border border-teal-100 dark:border-teal-900/30">
        <div className="p-3 bg-teal-100 dark:bg-teal-800 rounded-full text-teal-600 dark:text-teal-300">
            <Wallet size={24} />
        </div>
        <div>
            <h3 className="font-bold text-teal-900 dark:text-teal-100">
                {initialData ? 'Editar Conta' : 'Nova Conta'}
            </h3>
            <p className="text-xs text-teal-600 dark:text-teal-400">
                Gerencie seus saldos bancários ou carteiras.
            </p>
        </div>
      </div>

      {/* Campos */}
      <div className="space-y-4">
        <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Nome da Conta</label>
            <input 
                type="text" 
                placeholder="Ex: Nubank, Carteira, Cofre..." 
                className="w-full p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 transition-all font-medium dark:text-white"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
            />
        </div>

        {/* GRID PARA SALDO E LIMITE */}
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Saldo Atual</label>
                <MoneyInput 
                    value={balance} 
                    onValueChange={setBalance} 
                    placeholder="0,00"
                />
            </div>
            <div>
                <div className="flex items-center gap-1 mb-1 ml-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase">Limite</label>
                    <span className="text-[10px] bg-gray-100 dark:bg-slate-700 text-gray-500 px-1.5 py-0.5 rounded" title="Cheque Especial">Opcional</span>
                </div>
                {/* MoneyInput agora recebe e envia dados controlados pela função parseCurrency no submit */}
                <MoneyInput 
                    value={limit} 
                    onValueChange={setLimit} 
                    placeholder="0,00"
                />
            </div>
        </div>
        
        {/* Dica visual sobre o poder de compra */}
        {((typeof limit === 'number' && limit > 0) || (typeof limit === 'string' && limit !== '' && limit !== '0,00')) && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 text-xs text-emerald-700 dark:text-emerald-400">
                <TrendingDown size={14} />
                <span>Poder de compra total: <strong>Saldo + Limite</strong></span>
            </div>
        )}

        {/* Toggle Compartilhado */}
        <div 
            onClick={() => setIsShared(!isShared)}
            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all
            ${isShared 
                ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' 
                : 'bg-gray-50 border-gray-200 dark:bg-slate-900 dark:border-slate-700'}`}
        >
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${isShared ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500 dark:bg-slate-800'}`}>
                    {isShared ? <Users size={18}/> : <Lock size={18}/>}
                </div>
                <div>
                    <p className={`text-sm font-bold ${isShared ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>
                        {isShared ? 'Conta Familiar' : 'Conta Privada'}
                    </p>
                    <p className="text-[10px] text-gray-500">
                        {isShared ? 'Visível para todos da casa' : 'Visível apenas para você'}
                    </p>
                </div>
            </div>
            <div className={`w-10 h-6 rounded-full p-1 transition-colors ${isShared ? 'bg-blue-500' : 'bg-gray-300 dark:bg-slate-600'}`}>
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${isShared ? 'translate-x-4' : ''}`} />
            </div>
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="flex gap-3 pt-2">
        {onBack && (
            <button 
                type="button" 
                onClick={onBack}
                className="p-3 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition"
            >
                <X size={20} />
            </button>
        )}

        {initialData && (
            <button 
                type="button" 
                onClick={confirmDelete}
                className="p-3 rounded-xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50 transition"
                title="Excluir Conta"
            >
                <Trash2 size={20} />
            </button>
        )}

        <button 
            type="submit" 
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-teal-200 dark:shadow-none transition-all active:scale-95 disabled:opacity-70"
        >
            {loading ? 'Salvando...' : <><Save size={20} /> Salvar Conta</>}
        </button>
      </div>

    </form>
  );
}
import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import MoneyInput from './MoneyInput';
import Input from './Input';
import { FileText, Calendar, ArrowLeft, Trash2, Tag, Plus } from 'lucide-react';

export default function NewRecurringBillForm({ onSuccess, onBack, onManageCategories, initialData = null }) {
  const [name, setName] = useState('');
  const [baseValue, setBaseValue] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [category, setCategory] = useState(''); 
  
  const [categoriesList, setCategoriesList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Carrega categorias ao montar
  useEffect(() => {
    async function loadCats() {
        try {
            const response = await api.get('/categories/');
            setCategoriesList(response.data);
            
            if (!initialData && response.data.length > 0 && !category) {
                setCategory(response.data[0].id);
            }
        } catch (e) {
            console.error("Erro ao carregar categorias", e);
            toast.error("Erro ao carregar lista de categorias");
        }
    }
    loadCats();
  }, []);

  // Preenche dados na edição
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setBaseValue(initialData.base_value);
      setDueDay(initialData.due_day);
      setCategory(initialData.category ? parseInt(initialData.category) : ''); 
    }
  }, [initialData]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const finalValue = typeof baseValue === 'string' ? parseFloat(baseValue.replace(',', '.')) : baseValue;

      const payload = {
        name,
        base_value: finalValue || 0,
        due_day: parseInt(dueDay),
        category: category ? parseInt(category) : null 
      };

      if (initialData) {
        await api.put(`/recurring-bills/${initialData.id}/`, payload);
        toast.success("Conta atualizada!");
      } else {
        await api.post('/recurring-bills/', payload);
        toast.success("Conta criada!");
      }
      onSuccess();

    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  // --- NOVA LÓGICA DE EXCLUSÃO COM TOAST ---
  function handleDelete() {
    // Dispara um toast customizado que não some sozinho (duration: Infinity)
    // até o usuário clicar em uma das opções
    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[200px]">
        <div className="font-medium text-gray-800">
          Remover esta conta recorrente?
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => {
              toast.dismiss(t.id); // Fecha o toast
            }}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              toast.dismiss(t.id); // Fecha o toast
              confirmDelete();     // Executa a exclusão
            }}
            className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition shadow-sm"
          >
            Sim, remover
          </button>
        </div>
      </div>
    ), { 
      duration: 5000, 
      position: 'top-center',
      style: {
        background: '#fff',
        border: '1px solid #e5e7eb',
        padding: '16px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      }
    });
  }

  // Função que realmente chama a API após a confirmação no Toast
  async function confirmDelete() {
    try {
        setLoading(true);
        await api.delete(`/recurring-bills/${initialData.id}/`);
        toast.success("Recorrência removida.", {
            icon: '🗑️',
            style: {
                borderRadius: '10px',
                background: '#333',
                color: '#fff',
            },
        });
        onSuccess();
    } catch (error) {
        console.error(error);
        toast.error("Erro ao remover.");
        setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      
      <div className="flex justify-between items-center mb-2">
         {onBack && (
            <button type="button" onClick={onBack} className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition">
                <ArrowLeft size={16} className="mr-1" /> Voltar
            </button>
         )}
         
         {initialData && (
            <button 
                type="button" 
                onClick={handleDelete} // Agora chama a função do Toast
                className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-full transition"
                title="Excluir"
            >
                <Trash2 size={18} />
            </button>
         )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome da Conta</label>
        <Input type="text" required placeholder="Ex: Aluguel..." value={name} onChange={e => setName(e.target.value)} icon={FileText} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor Base</label>
            <MoneyInput value={baseValue} onValueChange={setBaseValue} placeholder="0,00" />
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dia Vencimento</label>
            <Input type="number" min="1" max="31" required placeholder="Ex: 10" value={dueDay} onChange={e => setDueDay(e.target.value)} icon={Calendar} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria</label>
        <div className="flex gap-2">
            <div className="relative flex-1">
                <Tag className="absolute left-3 top-3.5 text-gray-400 pointer-events-none z-10" size={20} />
                <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl appearance-none bg-white border border-gray-200 text-gray-900 dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                    <option value="">Sem categoria</option>
                    {categoriesList.map(cat => (
                        <option key={cat.id} value={cat.id}>
                            {cat.name} ({cat.type === 'EXPENSE' ? 'Despesa' : 'Receita'})
                        </option>
                    ))}
                </select>
            </div>
            {/* BOTÃO PARA GERENCIAR CATEGORIAS */}
            <button 
                type="button"
                onClick={onManageCategories}
                className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 p-3 rounded-xl transition border border-gray-200 dark:border-slate-700"
                title="Criar Categoria"
            >
                <Plus size={24} />
            </button>
        </div>
      </div>

      <button type="submit" disabled={loading} className="w-full bg-teal-600 text-white font-bold py-3 rounded-xl hover:bg-teal-500 active:scale-95 transition disabled:opacity-50">
        {loading ? 'Salvando...' : (initialData ? 'Atualizar' : 'Salvar')}
      </button>

    </form>
  );
}
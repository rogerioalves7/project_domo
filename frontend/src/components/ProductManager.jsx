import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import toast from 'react-hot-toast';
import Input from './Input';
import MoneyInput from './MoneyInput';
import { Package, Plus, Trash2, ArrowLeft, Minus, Tag, DollarSign, Hash, Ruler, WifiOff } from 'lucide-react';

export default function ProductManager({ onBack }) {
  const queryClient = useQueryClient();
  
  // Estados do Formulário
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('un');
  const [price, setPrice] = useState('');
  const [minQty, setMinQty] = useState('1');

  // --- 1. LEITURA (CACHE COMPARTILHADO) ---
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/products/').then(res => res.data),
    staleTime: 1000 * 60 * 60, // 1 hora de cache (dados estáticos)
  });

  // --- 2. MUTAÇÃO DE CRIAÇÃO (OFFLINE-FIRST) ---
  const createMutation = useMutation({
    mutationFn: (newProduct) => api.post('/products/', newProduct),
    retry: 3,
    
    onMutate: async (newProduct) => {
      await queryClient.cancelQueries({ queryKey: ['products'] });
      const previousProducts = queryClient.getQueryData(['products']);

      const optimisticProduct = {
        id: `temp-${Date.now()}`,
        ...newProduct,
        is_offline: true
      };

      queryClient.setQueryData(['products'], (old) => {
        return old 
          ? [optimisticProduct, ...old].sort((a, b) => a.name.localeCompare(b.name)) 
          : [optimisticProduct];
      });

      setName('');
      setPrice('');
      setMinQty('1');
      toast.success("Produto cadastrado!");

      return { previousProducts };
    },

    onError: (err, newProduct, context) => {
      toast.error("Sem conexão. Produto salvo localmente.", { icon: <WifiOff size={18}/> });
      console.warn("Erro ao criar produto (Offline):", err);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });

  // --- 3. MUTAÇÃO DE EXCLUSÃO ---
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/products/${id}/`),
    onMutate: async (id) => {
        await queryClient.cancelQueries({ queryKey: ['products'] });
        const previousProducts = queryClient.getQueryData(['products']);
        queryClient.setQueryData(['products'], old => old.filter(p => p.id !== id));
        return { previousProducts };
    },
    onError: (err, id, context) => {
        queryClient.setQueryData(['products'], context.previousProducts);
        toast.error("Erro ao excluir produto.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
    onSuccess: () => toast.success("Excluído.", { icon: '🗑️' })
  });

  // --- HANDLERS ---

  const handleCreate = (e) => {
    e.preventDefault();
    if (!name) return toast.error("Nome é obrigatório");

    const finalPrice = price ? (typeof price === 'string' ? parseFloat(price.replace(',', '.')) : price) : 0;

    createMutation.mutate({ 
        name, 
        measure_unit: unit,
        estimated_price: finalPrice,
        min_quantity: parseFloat(minQty) || 1 
    });
  };

  const handleDelete = (id) => {
    // Se for temporário, remove sem perguntar (menos atrito)
    if (String(id).startsWith('temp-')) {
        queryClient.setQueryData(['products'], old => old.filter(p => p.id !== id));
        toast.success("Removido.");
        return;
    }

    // CORREÇÃO: TOAST CUSTOMIZADO DE CONFIRMAÇÃO
    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[240px]">
        <div className="flex items-start gap-3">
            <div className="bg-red-100 p-2 rounded-full text-red-500"><Trash2 size={20}/></div>
            <div>
                <p className="font-bold text-gray-800 text-sm">Excluir Produto?</p>
                <p className="text-xs text-gray-500 mt-1">Isso removerá "{products.find(p => p.id === id)?.name}" do catálogo permanentemente.</p>
            </div>
        </div>
        <div className="flex gap-2 mt-1">
          <button 
            onClick={() => toast.dismiss(t.id)}
            className="flex-1 px-3 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            Cancelar
          </button>
          <button 
            onClick={() => {
              deleteMutation.mutate(id);
              toast.dismiss(t.id);
            }}
            className="flex-1 px-3 py-2 text-xs font-bold text-white bg-red-500 rounded-lg hover:bg-red-600 transition shadow-sm shadow-red-200"
          >
            Sim, Excluir
          </button>
        </div>
      </div>
    ), { 
        duration: 5000, 
        position: 'top-center',
        style: { padding: '12px', borderRadius: '16px' }
    });
  };

  const handleStep = (delta) => {
    const val = parseFloat(minQty) || 0;
    const newVal = val + delta;
    if (newVal < 0) return;
    setMinQty(String(newVal));
  };

  return (
    <div className="space-y-6">
        
        {/* Cabeçalho */}
        <div className="flex items-center mb-4">
            <button 
                onClick={onBack}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
            >
                <ArrowLeft size={16} className="mr-1" /> Voltar
            </button>
            <h3 className="ml-auto font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <Package size={18} className="text-teal-500"/> Catálogo de Produtos
            </h3>
        </div>

        {/* Formulário de Criação Rápida */}
        <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-1">
                <Plus size={12}/> Novo Produto
            </h4>
            
            <form onSubmit={handleCreate} className="space-y-3">
                
                {/* Campo Nome */}
                <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1 flex items-center gap-1">
                        <Tag size={10}/> Nome do Produto
                    </label>
                    <Input 
                        placeholder="Ex: Leite, Arroz..." 
                        value={name} 
                        onChange={e => setName(e.target.value)}
                        icon={Package}
                    />
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                    
                    {/* Campo Preço */}
                    <div className="col-span-1">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1 flex items-center gap-1">
                            <DollarSign size={10}/> Preço Est.
                        </label>
                        <MoneyInput 
                            placeholder="0,00" 
                            value={price} 
                            onValueChange={setPrice} 
                        />
                    </div>
                    
                    {/* Campo Mínimo */}
                    <div className="col-span-1">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1 flex items-center gap-1">
                            <Hash size={10}/> Mínimo
                        </label>
                        <div className="flex items-center h-[54px] w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-teal-500 transition-all">
                            <button 
                                type="button"
                                onClick={() => handleStep(-1)}
                                className="h-full px-2 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                <Minus size={14} strokeWidth={2.5} />
                            </button>
                            <input 
                                type="number" 
                                placeholder="1"
                                className="w-full h-full text-center bg-transparent border-none text-gray-800 dark:text-white font-bold outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={minQty}
                                onChange={e => setMinQty(e.target.value)}
                            />
                            <button 
                                type="button"
                                onClick={() => handleStep(1)}
                                className="h-full px-2 flex items-center justify-center text-teal-500 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                            >
                                <Plus size={14} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>

                    {/* Campo Unidade */}
                    <div className="col-span-1">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1 flex items-center gap-1">
                            <Ruler size={10}/> Unidade
                        </label>
                        <select 
                            value={unit}
                            onChange={e => setUnit(e.target.value)}
                            className="w-full h-[54px] px-3 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 text-sm font-medium"
                        >
                            <option value="un">un</option>
                            <option value="kg">kg</option>
                            <option value="L">L</option>
                            <option value="cx">cx</option>
                            <option value="pct">pct</option>
                            <option value="g">g</option>
                            <option value="ml">ml</option>
                        </select>
                    </div>
                </div>

                <button 
                    type="submit" 
                    disabled={createMutation.isPending}
                    className={`w-full h-[50px] flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl transition shadow-sm active:scale-95 ${createMutation.isPending ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                    <Plus size={20} /> 
                    {createMutation.isPending ? 'Salvando...' : 'Cadastrar Produto'}
                </button>
            </form>
        </div>

        {/* Lista de Produtos Existentes */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scroll-smooth">
            {products.length === 0 && !isLoading && (
                <p className="text-center text-gray-400 text-xs py-4">Nenhum produto no catálogo.</p>
            )}
            
            {products.map(prod => (
                <div key={prod.id} className={`flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg group hover:border-teal-200 dark:hover:border-teal-800 transition-colors ${String(prod.id).startsWith('temp') ? 'opacity-70' : ''}`}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400">
                            <Package size={18} />
                        </div>
                        <div>
                            <p className="text-gray-800 dark:text-gray-200 font-bold text-sm">
                                {prod.name}
                                {String(prod.id).startsWith('temp') && <span className="ml-2 text-[9px] text-orange-500 bg-orange-100 px-1 rounded border border-orange-200">OFFLINE</span>}
                            </p>
                            <p className="text-[10px] text-gray-500 flex gap-2">
                                <span>Mín: <b>{prod.min_quantity} {prod.measure_unit}</b></span>
                                <span>•</span>
                                <span>Est: <b>R$ {Number(prod.estimated_price).toFixed(2)}</b></span>
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleDelete(prod.id)} 
                        className="text-gray-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                        title="Excluir produto"
                    >
                        <Trash2 size={16}/>
                    </button>
                </div>
            ))}
        </div>
    </div>
  );
}
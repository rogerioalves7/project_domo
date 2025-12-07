import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
// Removi o Input dos imports pois vamos usar o HTML direto, mas mantive caso use para outros campos futuros
import { Package, AlertCircle, Save, ArrowLeft, Trash2, Plus, Minus } from 'lucide-react';

export default function NewInventoryItemForm({ onSuccess, onBack, onCreateProduct, initialData = null }) {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [minQuantity, setMinQuantity] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadProducts() {
        try {
            const response = await api.get('/products/');
            setProducts(response.data);
            if (!initialData && response.data.length > 0) {
                setProductId(response.data[0].id);
            }
        } catch (e) {
            console.error("Erro ao carregar produtos");
        }
    }
    loadProducts();
  }, []);

  useEffect(() => {
    if (initialData) {
        setProductId(initialData.product);
        setQuantity(initialData.quantity);
        setMinQuantity(initialData.min_quantity);
    }
  }, [initialData]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        product: productId,
        quantity: parseFloat(quantity),
      };

      if (initialData) {
          payload.min_quantity = parseFloat(minQuantity);
          await api.put(`/inventory/${initialData.id}/`, payload);
          toast.success("Item atualizado!");
      } else {
          await api.post('/inventory/', payload);
          toast.success("Item adicionado ao estoque!");
      }
      onSuccess();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar item.");
    } finally {
      setLoading(false);
    }
  }

  function handleDelete() {
    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[200px]">
        <div className="font-medium text-gray-800">Remover do estoque?</div>
        <div className="flex gap-2 justify-end">
          <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded">Cancelar</button>
          <button onClick={() => { toast.dismiss(t.id); confirmDelete(); }} className="px-3 py-1.5 text-sm bg-red-500 text-white rounded">Remover</button>
        </div>
      </div>
    ), { duration: 5000, position: 'top-center' });
  }

  async function confirmDelete() {
    try {
        setLoading(true);
        await api.delete(`/inventory/${initialData.id}/`);
        toast.success("Item removido.", { icon: '🗑️' });
        onSuccess();
    } catch (error) {
        toast.error("Erro ao remover.");
        setLoading(false);
    }
  }

  // Helper para incrementar/decrementar
  const handleStep = (setter, currentVal, delta) => {
    const val = parseFloat(currentVal) || 0;
    const newVal = val + delta;
    if (newVal < 0) return;
    setter(newVal);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      
      <div className="flex justify-between items-center mb-2">
         {onBack && (
            <button type="button" onClick={onBack} className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition">
                <ArrowLeft size={16} className="mr-1" /> Voltar
            </button>
         )}
         {initialData && (
            <button type="button" onClick={handleDelete} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition">
                <Trash2 size={18} />
            </button>
         )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Produto</label>
        <div className="relative">
            <Package className="absolute left-3 top-3.5 text-gray-400 pointer-events-none z-10" size={20} />
            <select
                value={productId}
                onChange={e => setProductId(e.target.value)}
                disabled={!!initialData}
                className="w-full pl-10 pr-4 py-3 rounded-xl appearance-none bg-white border border-gray-200 text-gray-900 dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
            >
                {products.length === 0 && <option>Nenhum produto cadastrado</option>}
                {products.map(prod => (
                    <option key={prod.id} value={prod.id}>{prod.name} ({prod.measure_unit})</option>
                ))}
            </select>
        </div>
        {!initialData && (
            <button type="button" onClick={onCreateProduct} className="text-xs text-teal-600 dark:text-teal-400 mt-1.5 ml-1 font-medium hover:underline focus:outline-none">
                + Cadastrar novo produto
            </button>
        )}
      </div>

      <div className={`grid gap-4 ${initialData ? 'grid-cols-2' : 'grid-cols-1'}`}>
        
        {/* INPUT QTD ATUAL (STEPPER INTEGRADO) */}
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Qtd Atual</label>
            <div className="flex items-center h-[50px] w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden focus-within:ring-2 focus-within:ring-teal-500 transition-all">
                <button 
                    type="button"
                    onClick={() => handleStep(setQuantity, quantity, -1)}
                    className="h-full px-4 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <Minus size={18} strokeWidth={2.5} />
                </button>
                <input 
                    type="number" 
                    step="0.1"
                    required
                    className="w-full h-full text-center bg-transparent border-none text-gray-800 dark:text-white font-bold outline-none text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                />
                <button 
                    type="button"
                    onClick={() => handleStep(setQuantity, quantity, 1)}
                    className="h-full px-4 flex items-center justify-center text-teal-500 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                >
                    <Plus size={18} strokeWidth={2.5} />
                </button>
            </div>
        </div>

        {/* INPUT MÍNIMO (STEPPER INTEGRADO - SÓ NA EDIÇÃO) */}
        {initialData && (
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mínimo</label>
                <div className="flex items-center h-[50px] w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden focus-within:ring-2 focus-within:ring-teal-500 transition-all">
                    <button 
                        type="button"
                        onClick={() => handleStep(setMinQuantity, minQuantity, -1)}
                        className="h-full px-4 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <Minus size={18} strokeWidth={2.5} />
                    </button>
                    <input 
                        type="number" 
                        step="0.1"
                        required
                        className="w-full h-full text-center bg-transparent border-none text-gray-800 dark:text-white font-bold outline-none text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={minQuantity}
                        onChange={e => setMinQuantity(e.target.value)}
                    />
                    <button 
                        type="button"
                        onClick={() => handleStep(setMinQuantity, minQuantity, 1)}
                        className="h-full px-4 flex items-center justify-center text-teal-500 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                    >
                        <Plus size={18} strokeWidth={2.5} />
                    </button>
                </div>
            </div>
        )}
      </div>

      <button type="submit" disabled={loading} className="w-full bg-teal-600 text-white font-bold py-3.5 rounded-xl hover:bg-teal-500 active:scale-95 transition flex items-center justify-center gap-2 shadow-sm">
        <Save size={20} /> {loading ? 'Salvando...' : (initialData ? 'Atualizar Item' : 'Adicionar ao Estoque')}
      </button>

    </form>
  );
}
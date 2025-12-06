import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Input from './Input';
import { Package, AlertCircle, Save, ArrowLeft, Trash2 } from 'lucide-react';

export default function NewInventoryItemForm({ onSuccess, onBack, initialData = null }) {
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
        min_quantity: parseFloat(minQuantity)
      };

      if (initialData) {
        await api.put(`/inventory/${initialData.id}/`, payload);
        toast.success("Item atualizado!");
      } else {
        await api.post('/inventory/', payload);
        toast.success("Item adicionado ao estoque!");
      }
      onSuccess();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar item. Verifique se já não existe no estoque.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (confirm("Remover este item do estoque?")) {
        try {
            setLoading(true);
            await api.delete(`/inventory/${initialData.id}/`);
            toast.success("Item removido.");
            onSuccess();
        } catch (error) {
            toast.error("Erro ao remover.");
        }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      
      <div className="flex justify-between items-center mb-2">
         {onBack && (
            <button type="button" onClick={onBack} className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition">
                <ArrowLeft size={16} className="mr-1" /> Voltar
            </button>
         )}
         {initialData && (
            <button type="button" onClick={handleDelete} className="text-red-500 p-1"><Trash2 size={18} /></button>
         )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Produto</label>
        <div className="relative">
            <Package className="absolute left-3 top-3.5 text-gray-400 pointer-events-none z-10" size={20} />
            <select
                value={productId}
                onChange={e => setProductId(e.target.value)}
                disabled={!!initialData} // Não pode trocar o produto na edição, melhor excluir e criar outro
                className="w-full pl-10 pr-4 py-3 rounded-xl appearance-none bg-white border border-gray-200 text-gray-900 dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
            >
                {products.length === 0 && <option>Nenhum produto cadastrado</option>}
                {products.map(prod => (
                    <option key={prod.id} value={prod.id}>{prod.name} ({prod.measure_unit})</option>
                ))}
            </select>
        </div>
        {/* Link para criar produto (Placeholder por enquanto) */}
        <p className="text-xs text-teal-600 mt-1 text-right cursor-pointer hover:underline">Novo Produto?</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Qtd Atual</label>
            <Input type="number" step="0.1" required value={quantity} onChange={e => setQuantity(e.target.value)} />
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mínimo (Alerta)</label>
            <Input type="number" step="0.1" required value={minQuantity} onChange={e => setMinQuantity(e.target.value)} icon={AlertCircle} />
        </div>
      </div>

      <button type="submit" disabled={loading} className="w-full bg-teal-600 text-white font-bold py-3 rounded-xl hover:bg-teal-500 active:scale-95 transition flex items-center justify-center gap-2">
        <Save size={20} /> {loading ? 'Salvando...' : 'Salvar no Estoque'}
      </button>

    </form>
  );
}
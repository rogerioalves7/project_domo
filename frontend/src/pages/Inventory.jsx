import { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import Modal from '../components/Modal';
import NewInventoryItemForm from '../components/NewInventoryItemForm';
import ProductManager from '../components/ProductManager'; // <--- IMPORT NOVO
import { 
  Home, BarChart3, Box, ShoppingCart, Settings, Plus, Minus, Search, Package, AlertTriangle, List
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Inventory() {
  const { theme, toggleTheme } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalView, setModalView] = useState('ITEM_FORM'); // 'ITEM_FORM' ou 'PRODUCT_MANAGER'
  const [editingItem, setEditingItem] = useState(null);

  async function loadInventory() {
    setLoading(true);
    try {
      const response = await api.get('/inventory/');
      setItems(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInventory();
  }, []);

  async function updateQuantity(item, delta) {
    const newQty = parseFloat(item.quantity) + delta;
    if (newQty < 0) return;

    const oldItems = [...items];
    setItems(items.map(i => i.id === item.id ? { ...i, quantity: newQty } : i));

    try {
        await api.patch(`/inventory/${item.id}/`, { quantity: newQty });
    } catch (error) {
        setItems(oldItems);
        toast.error("Erro ao atualizar.");
    }
  }

  const handleEdit = (item) => {
    setEditingItem(item);
    setModalView('ITEM_FORM');
    setIsModalOpen(true);
  };

  const openNewItem = () => {
    setEditingItem(null);
    setModalView('ITEM_FORM');
    setIsModalOpen(true);
  };

  const openProductManager = () => {
    setModalView('PRODUCT_MANAGER');
    setIsModalOpen(true);
  }

  const filteredItems = items.filter(item => 
    item.product_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex w-screen h-screen overflow-hidden font-sans transition-colors duration-300 bg-gray-50 text-gray-900 dark:bg-[#0F172A] dark:text-gray-100">
      
      <div className="hidden md:block h-full shrink-0 relative z-20">
         <Sidebar />
      </div>

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        <div className="flex-1 overflow-y-auto w-full scroll-smooth">
            
            <header className="px-4 py-6 md:px-8 md:py-8 shrink-0">
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Estoque</h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Gerencie sua despensa</p>
                    </div>
                    <div className="flex gap-2">
                        {/* Botão de Catálogo */}
                        <button onClick={openProductManager} className="bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 p-3 rounded-xl shadow border border-gray-200 dark:border-slate-700 transition active:scale-95" title="Gerenciar Produtos">
                            <List size={24} />
                        </button>
                        {/* Botão de Adicionar ao Estoque */}
                        <button onClick={openNewItem} className="bg-teal-600 hover:bg-teal-500 text-white p-3 rounded-xl shadow-lg transition active:scale-95">
                            <Plus size={24} />
                        </button>
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="Buscar item..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                    />
                </div>
            </header>

            <main className="px-4 md:px-8 pb-32 md:pb-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredItems.map(item => {
                        const isLow = parseFloat(item.quantity) <= parseFloat(item.min_quantity);
                        return (
                            <div key={item.id} className={`relative p-4 rounded-2xl border transition-all bg-white dark:bg-[#1E293B] ${isLow ? 'border-rose-300 dark:border-rose-800 ring-1 ring-rose-100 dark:ring-rose-900/20' : 'border-gray-100 dark:border-slate-700'}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3" onClick={() => handleEdit(item)}>
                                        <div className={`p-3 rounded-full ${isLow ? 'bg-rose-100 text-rose-500 dark:bg-rose-900/30' : 'bg-teal-50 text-teal-600 dark:bg-teal-900/30'}`}>
                                            <Package size={24} />
                                        </div>
                                        <div className="cursor-pointer">
                                            <h3 className="font-bold text-lg leading-tight">{item.product_name}</h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Mínimo: {item.min_quantity} {item.product_unit}</p>
                                        </div>
                                    </div>
                                    {isLow && <AlertTriangle size={18} className="text-rose-500 animate-pulse" />}
                                </div>

                                <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-800/50 rounded-xl p-2">
                                    <button onClick={() => updateQuantity(item, -1)} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-200 rounded-lg shadow-sm active:scale-90 transition"><Minus size={18} /></button>
                                    <div className="text-center">
                                        <span className={`text-xl font-bold ${isLow ? 'text-rose-600 dark:text-rose-400' : 'text-gray-800 dark:text-white'}`}>{item.quantity}</span>
                                        <span className="text-xs text-gray-400 block -mt-1">{item.product_unit}</span>
                                    </div>
                                    <button onClick={() => updateQuantity(item, 1)} className="w-10 h-10 flex items-center justify-center bg-teal-600 text-white rounded-lg shadow-sm active:scale-90 transition"><Plus size={18} /></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {filteredItems.length === 0 && <div className="text-center py-10 text-gray-400"><Package size={48} className="mx-auto mb-3 opacity-50" /><p>Nenhum item encontrado no estoque.</p></div>}
            </main>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 w-full pb-safe pt-2 z-40 border-t transition-colors md:hidden bg-white border-gray-200 dark:bg-[#1E293B] dark:border-slate-800">
        <div className="flex justify-between items-center px-6 h-16 w-full">
            <NavLink to="/app" className={({isActive}) => `flex flex-col items-center space-y-1 ${isActive ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400'}`}><Home size={22} /><span className="text-[10px]">Início</span></NavLink>
            <div className="flex flex-col items-center space-y-1 text-gray-400"><BarChart3 size={22} /><span className="text-[10px]">Hist.</span></div>
            <NavLink to="/inventory" className={({isActive}) => `flex flex-col items-center space-y-1 ${isActive ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400'}`}><Box size={22} /><span className="text-[10px]">Estoque</span></NavLink>
            <div className="flex flex-col items-center space-y-1 text-gray-400"><ShoppingCart size={22} /><span className="text-[10px]">Compras</span></div>
            <div className="flex flex-col items-center space-y-1 text-gray-400"><Settings size={22} /><span className="text-[10px]">Config.</span></div>
        </div>
      </nav>

      {/* Modal Inteligente */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={modalView === 'PRODUCT_MANAGER' ? '' : (editingItem ? "Editar Item" : "Adicionar ao Estoque")}
      >
        {modalView === 'ITEM_FORM' && (
            <NewInventoryItemForm 
                initialData={editingItem} 
                onSuccess={() => { setIsModalOpen(false); loadInventory(); }} 
                // Permite ir para o cadastro de produtos direto do form também
                onBack={null} 
            />
        )}
        
        {modalView === 'PRODUCT_MANAGER' && (
            <ProductManager onBack={() => setModalView('ITEM_FORM')} />
        )}
      </Modal>

    </div>
  );
}
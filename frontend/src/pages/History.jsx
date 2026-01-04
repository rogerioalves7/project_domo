import { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import MobileMenu from '../components/MobileMenu';
import FinancialCharts from '../components/charts/FinancialCharts'; 
import { 
  History as HistoryIcon, Calendar, ArrowUpRight, ArrowDownLeft, 
  Search, ShoppingBag, Filter, X, Wallet, CreditCard
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

export default function History() {
  const { theme } = useTheme();
  
  // --- ESTADOS DE DADOS ---
  const [allTransactions, setAllTransactions] = useState([]);
  const [categories, setCategories] = useState([]); 
  const [accounts, setAccounts] = useState([]); 
  const [cards, setCards] = useState([]); 
  const [loading, setLoading] = useState(true);

  // --- ESTADOS DE FILTRO ---
  const [filterPeriod, setFilterPeriod] = useState('MONTH'); 
  const [searchTerm, setSearchTerm] = useState(''); 
  const [selectedCategory, setSelectedCategory] = useState(''); 
  const [selectedSource, setSelectedSource] = useState(''); 

  // --- CARREGAMENTO ---
  useEffect(() => {
    async function loadData() {
      try {
        const [transRes, catRes, accRes, cardRes] = await Promise.all([
            api.get('/transactions/'),
            api.get('/categories/'),
            api.get('/accounts/'),
            api.get('/credit-cards/')
        ]);
        
        setAllTransactions(transRes.data);
        setCategories(catRes.data);
        setAccounts(accRes.data);
        setCards(cardRes.data);

      } catch (error) {
        console.error("Erro ao carregar histórico", error);
        toast.error("Erro ao carregar dados.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // --- LÓGICA DE FILTRAGEM ---
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    
    return allTransactions.filter(t => {
      const tDate = new Date(t.date + 'T12:00:00'); 
      
      // 1. Filtro de Período
      let passPeriod = true;
      if (filterPeriod === 'MONTH') {
        passPeriod = tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
      } else if (filterPeriod === 'YEAR') {
        passPeriod = tDate.getFullYear() === now.getFullYear();
      }

      // 2. Filtro de Categoria
      let passCategory = true;
      if (selectedCategory) {
        passCategory = String(t.category) === String(selectedCategory);
      }

      // 3. Filtro de Origem
      let passSource = true;
      if (selectedSource) {
        const [type, id] = selectedSource.split('_'); 
        
        if (type === 'ACC') {
            passSource = String(t.account) === id;
        } else if (type === 'CARD') {
            passSource = String(t.card_id) === id;
        }
      }

      // 4. Filtro de Descrição
      const searchLower = searchTerm.toLowerCase();
      const passDescription = searchTerm === '' || 
                              t.description.toLowerCase().includes(searchLower) ||
                              (t.account_name && t.account_name.toLowerCase().includes(searchLower));

      return passPeriod && passCategory && passSource && passDescription;
    });
  }, [allTransactions, filterPeriod, searchTerm, selectedCategory, selectedSource]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedSource('');
  };

  // Classe utilitária para as opções do select ficarem legíveis
  const optionClass = "bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200";

  return (
    <div className="flex w-screen h-screen overflow-hidden font-sans bg-gray-50 dark:bg-[#0F172A] dark:text-gray-100 transition-colors duration-300">
      <div className="hidden md:block h-full shrink-0 relative z-20"><Sidebar /></div>

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        <div className="flex-1 overflow-y-auto w-full scroll-smooth">
            
            <header className="px-4 py-6 md:px-8 md:py-8 shrink-0 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <HistoryIcon className="text-teal-500" /> Histórico Financeiro
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                        Analise suas movimentações e entenda seus hábitos.
                    </p>
                </div>
                <div className="w-full md:w-auto flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-x-auto">
                    <button onClick={() => setFilterPeriod('MONTH')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${filterPeriod === 'MONTH' ? 'bg-teal-600 text-white shadow-md' : 'bg-white dark:bg-[#1E293B] text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>Este Mês</button>
                    <button onClick={() => setFilterPeriod('YEAR')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${filterPeriod === 'YEAR' ? 'bg-teal-600 text-white shadow-md' : 'bg-white dark:bg-[#1E293B] text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>Este Ano</button>
                    <button onClick={() => setFilterPeriod('ALL')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${filterPeriod === 'ALL' ? 'bg-teal-600 text-white shadow-md' : 'bg-white dark:bg-[#1E293B] text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>Tudo</button>
                </div>
            </header>

            <main className="px-4 md:px-8 pb-32 md:pb-10 space-y-6">
                
                {filteredTransactions.length > 0 && filterPeriod !== 'ALL' && (
                    <div className="animate-fade-in-up">
                        <FinancialCharts transactions={filteredTransactions} period={filterPeriod} />
                    </div>
                )}

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
                    
                    {/* BARRA DE FILTROS */}
                    <div className="p-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30 flex flex-col md:flex-row gap-3">
                        
                        <div className="flex-1 flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-teal-500 transition-all shadow-sm">
                            <Search className="text-gray-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="Filtrar por descrição..." 
                                className="flex-1 bg-transparent outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400 text-sm"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && <button onClick={() => setSearchTerm('')}><X size={14} className="text-gray-400 hover:text-gray-600"/></button>}
                        </div>

                        {/* FILTRO DE ORIGEM (CONTA OU CARTÃO) */}
                        <div className="flex-1 md:max-w-[220px] flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-teal-500 transition-all shadow-sm relative">
                            {selectedSource.startsWith('CARD') ? <CreditCard className="text-purple-500" size={18} /> : <Wallet className="text-gray-400" size={18} />}
                            
                            <select 
                                className="flex-1 bg-transparent outline-none text-gray-700 dark:text-gray-200 text-sm appearance-none cursor-pointer"
                                value={selectedSource}
                                onChange={e => setSelectedSource(e.target.value)}
                            >
                                <option value="" className={optionClass}>Todas as Contas</option>
                                
                                <optgroup label="Contas / Carteiras" className={optionClass}>
                                    {accounts.map(acc => (
                                        <option key={`ACC_${acc.id}`} value={`ACC_${acc.id}`} className={optionClass}>
                                            {acc.name}
                                        </option>
                                    ))}
                                </optgroup>

                                <optgroup label="Cartões de Crédito" className={optionClass}>
                                    {cards.map(card => (
                                        <option key={`CARD_${card.id}`} value={`CARD_${card.id}`} className={optionClass}>
                                            {card.name}
                                        </option>
                                    ))}
                                </optgroup>
                            </select>
                            
                            {selectedSource && <button onClick={() => setSelectedSource('')} className="absolute right-8"><X size={14} className="text-gray-400 hover:text-gray-600"/></button>}
                        </div>

                        {/* FILTRO DE CATEGORIA */}
                        <div className="flex-1 md:max-w-[200px] flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-teal-500 transition-all shadow-sm relative">
                            <Filter className="text-gray-400" size={18} />
                            <select 
                                className="flex-1 bg-transparent outline-none text-gray-700 dark:text-gray-200 text-sm appearance-none cursor-pointer"
                                value={selectedCategory}
                                onChange={e => setSelectedCategory(e.target.value)}
                            >
                                <option value="" className={optionClass}>Todas as Categorias</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id} className={optionClass}>{cat.name}</option>
                                ))}
                            </select>
                            {selectedCategory && <button onClick={() => setSelectedCategory('')} className="absolute right-8"><X size={14} className="text-gray-400 hover:text-gray-600"/></button>}
                        </div>

                        {(searchTerm || selectedCategory || selectedSource) && (
                            <button onClick={clearFilters} className="px-4 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition">Limpar</button>
                        )}
                    </div>

                    <div className="divide-y divide-gray-100 dark:divide-slate-700">
                        {loading ? (<div className="p-12 text-center"><p className="text-gray-400 animate-pulse">Carregando histórico...</p></div>) : filteredTransactions.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center">
                                <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-full mb-3 text-gray-400"><ShoppingBag size={32} /></div>
                                <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhuma movimentação encontrada.</p>
                            </div>
                        ) : (
                            filteredTransactions.map(t => {
                                const isExpense = t.type === 'EXPENSE';
                                return (
                                    <div key={t.id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition flex justify-between items-center group">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-full ${isExpense ? 'bg-rose-50 text-rose-500 dark:bg-rose-900/20' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20'} group-hover:scale-110 transition-transform`}>
                                                {isExpense ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800 dark:text-gray-200 text-sm md:text-base">{t.description}</p>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><Calendar size={12}/> {new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                                                    {t.category_name && <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 font-medium border border-gray-200 dark:border-slate-600">{t.category_name}</span>}
                                                    {t.items && t.items.length > 0 && <span className="text-[10px] text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 rounded border border-indigo-100 dark:border-indigo-800 font-bold">{t.items.length} itens</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`font-bold text-sm md:text-base block ${isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{isExpense ? '- ' : '+ '} R$ {Number(t.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                            <p className="text-[10px] text-gray-400 mt-1">{t.account_name ? t.account_name : t.invoice ? 'Cartão de Crédito' : 'Outros'}</p>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            </main>
        </div>
      </div>
      <MobileMenu />
    </div>
  );
}
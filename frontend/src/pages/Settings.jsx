import { useEffect, useState, useContext } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import MobileMenu from '../components/MobileMenu';
import Modal from '../components/Modal';
import CategoryManager from '../components/CategoryManager';
import NewRecurringBillForm from '../components/NewRecurringBillForm';
import SecuritySettings from '../components/SecuritySettings';

import { 
  Settings as SettingsIcon, Users, Moon, Sun, LogOut, Trash2, 
  Shield, Tag, User, Mail, Send, Crown, Calendar, Edit2, Plus, 
  AlertTriangle, Loader2, X, Clock // <--- Adicionado Clock e X
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Settings() {
  const { signOut, user } = useContext(AuthContext);
  const { theme, toggleTheme } = useTheme();
  
  // --- ESTADOS DE DADOS ---
  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]); // <--- NOVO ESTADO
  const [recurringBills, setRecurringBills] = useState([]);
  const [houseInfo, setHouseInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [amIMaster, setAmIMaster] = useState(false);
  
  // --- ESTADOS DE UI ---
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [cancelingInvite, setCancelingInvite] = useState(null); // ID do convite sendo cancelado
  
  // Modais e Navegação
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [lastModal, setLastModal] = useState(null); 
  
  const [editingBill, setEditingBill] = useState(null);

  useEffect(() => {
    loadSettingsData();
  }, []);

  useEffect(() => {
    if (user && members.length > 0) {
        const myRecord = members.find(m => 
            (m.user_name && user.username && m.user_name.toLowerCase() === user.username.toLowerCase()) ||
            (user.email && m.user_name && m.user_name.toLowerCase() === user.email.toLowerCase())
        );
        if (myRecord && (myRecord.role === 'MASTER' || myRecord.role === 'ADMIN')) {
            setAmIMaster(true);
        } else {
            setAmIMaster(false);
        }
    }
  }, [user, members]);

  async function loadSettingsData() {
    try {
      // Adicionada a chamada para /invitations/
      const [houseRes, membersRes, billsRes, invitesRes] = await Promise.all([
        api.get('/houses/'),
        api.get('/members/'),
        api.get('/recurring-bills/'),
        api.get('/invitations/') // <--- BUSCA CONVITES
      ]);

      if (houseRes.data.length > 0) setHouseInfo(houseRes.data[0]);
      setMembers(membersRes.data);
      setRecurringBills(billsRes.data);
      setPendingInvites(invitesRes.data); // <--- SALVA NO ESTADO

    } catch (error) {
      console.error(error);
      // Não damos toast de erro aqui para não poluir se falhar algo não crítico
    } finally {
      setLoading(false);
    }
  }

  // --- ACTIONS ---
  async function sendInvite() {
    if (!inviteEmail) return;
    setSendingInvite(true);
    try {
        await api.post('/invitations/', { email: inviteEmail });
        toast.success(`Convite enviado para ${inviteEmail}!`);
        setInviteEmail('');
        loadSettingsData(); // Recarrega para mostrar na lista
    } catch (error) {
        toast.error(error.response?.data?.error || "Erro ao enviar convite.");
    } finally {
        setSendingInvite(false);
    }
  }

  // NOVA FUNÇÃO: Cancelar convite
  async function cancelInvite(inviteId) {
      setCancelingInvite(inviteId);
      try {
          await api.delete(`/invitations/${inviteId}/`);
          toast.success("Convite cancelado.");
          setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
      } catch (error) {
          toast.error("Erro ao cancelar convite.");
      } finally {
          setCancelingInvite(null);
      }
  }

  const handleEditBill = (bill) => { setEditingBill(bill); setIsRecurringModalOpen(true); };
  const handleNewBill = () => { setEditingBill(null); setIsRecurringModalOpen(true); };

  async function executeMemberRemoval(memberId, toastId) {
    toast.dismiss(toastId);
    try { await api.delete(`/members/${memberId}/`); toast.success("Membro removido!"); loadSettingsData(); } 
    catch (error) { toast.error("Erro ao remover."); }
  }

  function removeMember(memberId) {
    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[250px]">
        <p className="font-bold text-sm text-gray-800 dark:text-white">Remover membro?</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1 text-xs rounded bg-gray-200 text-gray-700">Cancelar</button>
          <button onClick={() => executeMemberRemoval(memberId, t.id)} className="px-3 py-1 text-xs text-white bg-red-500 rounded">Confirmar</button>
        </div>
      </div>
    ));
  }

  // --- ZONA DE PERIGO ---
  function handleDangerAction() {
    if (!houseInfo) return;
    const isDelete = amIMaster;
    
    const toastStyle = theme === 'dark' ? {
        background: '#1E293B', 
        color: '#F8FAFC',      
        border: '1px solid #334155' 
    } : {
        background: '#FFFFFF',
        color: '#0F172A',
        border: '1px solid #E2E8F0'
    };

    toast((t) => (
      <div className="flex flex-col gap-3 max-w-sm">
        <div className="flex items-start gap-3">
             <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full text-red-600 dark:text-red-400 shrink-0">
                <AlertTriangle size={20}/>
             </div>
             <div>
                 <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                     {isDelete ? "Excluir Casa Definitivamente?" : "Sair da Casa?"}
                 </h4>
                 <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                     {isDelete 
                        ? "Esta ação apagará TODOS os dados, contas e registros financeiros permanentemente. Não há como desfazer." 
                        : "Você perderá acesso aos dados desta casa até ser convidado novamente."}
                 </p>
             </div>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <button 
            onClick={() => toast.dismiss(t.id)} 
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 transition"
          >
            Cancelar
          </button>
          <button 
            onClick={() => executeDangerAction(t.id, isDelete)} 
            className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition shadow-sm"
          >
            {isDelete ? "Sim, Excluir Tudo" : "Sim, Sair"}
          </button>
        </div>
      </div>
    ), { 
        duration: 6000,
        style: toastStyle,
        position: 'top-center'
    });
  }

  async function executeDangerAction(toastId, isDelete) {
    toast.dismiss(toastId);
    try {
        if(isDelete) await api.delete(`/houses/${houseInfo.id}/`);
        else await api.post(`/houses/${houseInfo.id}/leave/`);
        
        toast.success(isDelete ? "Casa excluída." : "Você saiu.");
        setTimeout(signOut, 1000);
    } catch(e) { toast.error("Erro na operação."); }
  }

  const openCategoryFromRecurring = () => {
      setLastModal('recurring');
      setIsRecurringModalOpen(false);
      setIsCategoryModalOpen(true);
  };

  const closeCategoryModal = () => {
      setIsCategoryModalOpen(false);
      if (lastModal === 'recurring') {
          setIsRecurringModalOpen(true);
          setLastModal(null);
      }
  };

  return (
    <div className="flex w-screen h-screen overflow-hidden font-sans bg-gray-50 dark:bg-[#0F172A] dark:text-gray-100">
      <div className="hidden md:block h-full shrink-0 relative z-20"><Sidebar /></div>

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        <div className="flex-1 overflow-y-auto w-full scroll-smooth">
            <header className="px-4 py-6 md:px-8 md:py-8 shrink-0">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <SettingsIcon className="text-teal-500" /> Configurações
                </h1>
            </header>

            <main className="px-4 md:px-8 pb-32 md:pb-10 space-y-6">
                
                {/* 1. PERFIL */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-teal-400 to-blue-500 flex items-center justify-center text-white font-bold text-xl shadow-md">
                            {user?.username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                {user?.username}
                                {amIMaster && <Crown size={16} className="text-yellow-500" title="Master"/>}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
                        </div>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                        <button onClick={toggleTheme} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />} <span className="text-sm font-medium">{theme === 'dark' ? 'Claro' : 'Escuro'}</span>
                        </button>
                        <button onClick={signOut} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition">
                            <LogOut size={18} /> <span className="text-sm font-bold">Sair</span>
                        </button>
                    </div>
                </div>

                {/* 2. SISTEMA E SEGURANÇA */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col justify-center">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-4"><Shield className="text-purple-500" size={20} /> Sistema</h3>
                        <button onClick={() => { setLastModal(null); setIsCategoryModalOpen(true); }} className={`w-full flex items-center justify-between p-4 rounded-xl border transition group ${theme === 'dark' ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-purple-900/20 text-purple-400' : 'bg-purple-50 text-purple-600'}`}><Tag size={20} /></div>
                                <div className="text-left"><p className={`font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>Gerir Categorias</p><p className="text-xs text-gray-500">Edite ou exclua categorias</p></div>
                            </div>
                            <span className="text-gray-400 group-hover:translate-x-1 transition">→</span>
                        </button>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col justify-center">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-4"><Shield className="text-teal-500" size={20} /> Segurança</h3>
                        <button onClick={() => setIsSecurityModalOpen(true)} className={`w-full flex items-center justify-between p-4 rounded-xl border transition group ${theme === 'dark' ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-teal-900/20 text-teal-400' : 'bg-teal-50 text-teal-600'}`}><Shield size={20} /></div>
                                <div className="text-left"><p className={`font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>Segurança da Conta</p><p className="text-xs text-gray-500">Alterar senha ou e-mail</p></div>
                            </div>
                            <span className="text-gray-400 group-hover:translate-x-1 transition">→</span>
                        </button>
                    </div>
                </div>

                {/* 3. MEMBROS DA CASA */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
                        <Users className="text-blue-500" size={20} /> Membros
                    </h3>
                    
                    {/* Lista de Membros Atuais */}
                    <div className="space-y-3 mb-6">
                        {loading ? <p className="text-gray-400 text-sm">Carregando...</p> : members.length === 0 ? <p className="text-gray-400 text-sm">Nenhum membro.</p> : members.map(member => (
                            <div key={member.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-100 dark:border-slate-700/50">
                                <div className="flex items-center gap-3">
                                    <div className="bg-gray-200 dark:bg-slate-700 p-2 rounded-full text-gray-600 dark:text-gray-300"><User size={18} /></div>
                                    <div>
                                        <p className="font-bold text-sm text-gray-700 dark:text-gray-200">{member.user_name} {member.user_name === user.username && "(Você)"}</p>
                                        <p className="text-xs text-gray-400">{(member.role === 'MASTER' || member.role === 'ADMIN') ? '👑 Master' : 'Membro'}</p>
                                    </div>
                                </div>
                                {amIMaster && member.user_name !== user.username && (
                                    <button onClick={() => removeMember(member.id)} className="p-2 text-gray-400 hover:text-rose-500 transition"><Trash2 size={18} /></button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* SEÇÃO DE CONVITES (Só Master vê) */}
                    {amIMaster && (
                        <div className="pt-4 border-t border-gray-100 dark:border-slate-700 block">
                            
                            {/* Lista de Convites Pendentes */}
                            {pendingInvites.length > 0 && (
                                <div className="mb-4">
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 flex items-center gap-1">
                                        <Clock size={12} /> Convites Pendentes
                                    </label>
                                    <div className="space-y-2">
                                        {pendingInvites.map(invite => (
                                            <div key={invite.id} className="flex justify-between items-center p-2.5 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/20 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <Mail size={14} className="text-yellow-600 dark:text-yellow-500"/>
                                                    <span className="text-sm text-gray-700 dark:text-gray-300">{invite.email}</span>
                                                </div>
                                                <button 
                                                    onClick={() => cancelInvite(invite.id)}
                                                    disabled={cancelingInvite === invite.id}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                                                    title="Cancelar convite"
                                                >
                                                    {cancelingInvite === invite.id ? <Loader2 size={14} className="animate-spin"/> : <X size={14}/>}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Formulário de Novo Convite */}
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 flex items-center gap-1">
                                <Mail size={12} /> Convidar Novo Membro
                            </label>
                            <div className="flex gap-2 w-full">
                                <input 
                                    type="email" placeholder="email@exemplo.com" 
                                    className="flex-1 p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white transition-all min-w-0" 
                                    value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} 
                                />
                                <button onClick={sendInvite} disabled={!inviteEmail || sendingInvite} className="px-6 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-300 disabled:dark:bg-slate-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap">
                                    {sendingInvite ? <Loader2 className="animate-spin" size={18}/> : <><Send size={16}/> Enviar</>}
                                </button>
                            </div>
                            <p className="text-xs text-gray-400 mt-2">O usuário receberá um link por e-mail para se juntar à sua casa.</p>
                        </div>
                    )}
                </div>

                {/* 4. CONTAS FIXAS */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <Calendar className="text-orange-500" size={20} /> Contas Fixas
                        </h3>
                        <button 
                            onClick={handleNewBill} 
                            className="bg-orange-600 text-white px-3 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-orange-500 transition shadow-sm"
                        >
                            <Plus size={16} /> <span className="hidden sm:inline">Nova</span>
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="text-xs uppercase text-gray-500 bg-gray-50 dark:bg-slate-900/50 dark:text-gray-400">
                                <tr>
                                    <th className="px-4 py-3 rounded-l-lg">Nome</th>
                                    <th className="px-4 py-3">Dia</th>
                                    <th className="px-4 py-3">Valor</th>
                                    <th className="px-4 py-3 text-right rounded-r-lg">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                {recurringBills.map(bill => (
                                    <tr key={bill.id}>
                                        <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-200">
                                            {bill.name}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">
                                            Dia {bill.due_day}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-200">
                                            R$ {Number(bill.base_value).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                        </td>
                                        <td className="px-4 py-3 text-right bg-white dark:bg-[#1E293B]">
                                            <button onClick={() => handleEditBill(bill)} className="bg-white dark:bg-[#1E293B]">
                                                <Edit2 size={16} className="text-gray-400 hover:text-teal-500 transition"/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {recurringBills.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="text-center py-4 text-gray-400">
                                            Nenhuma conta fixa cadastrada.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 5. ZONA DE PERIGO */}
                <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-6 border border-red-100 dark:border-red-900/20 shadow-sm">
                    <h3 className="text-lg font-bold text-red-700 dark:text-red-400 flex items-center gap-2 mb-2"><AlertTriangle size={20} /> Zona de Perigo</h3>
                    <p className="text-sm text-red-600/80 dark:text-red-400/70 mb-4">
                        {amIMaster 
                         ? "Atenção: Ao excluir a casa, todos os dados, contas, registros e históricos serão apagados permanentemente para todos os membros." 
                         : "Ao sair da casa, você perderá acesso aos dados compartilhados."}
                    </p>
                    <button onClick={handleDangerAction} className={`px-4 py-2 rounded-xl font-bold text-white text-sm ${amIMaster ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-500 hover:bg-orange-600'}`}>
                        {amIMaster ? "Excluir Casa" : "Sair da Casa"}
                    </button>
                </div>

            </main>
        </div>
      </div>
      <MobileMenu />
      
      {/* MODALS COM NAVEGAÇÃO CORRIGIDA */}
      <Modal isOpen={isCategoryModalOpen} onClose={closeCategoryModal} title="Categorias">
          <CategoryManager onBack={closeCategoryModal} />
      </Modal>

      <Modal isOpen={isRecurringModalOpen} onClose={() => setIsRecurringModalOpen(false)} title={editingBill ? "Editar" : "Nova"}>
          <NewRecurringBillForm 
            initialData={editingBill} 
            onSuccess={() => { setIsRecurringModalOpen(false); loadSettingsData(); }} 
            onManageCategories={openCategoryFromRecurring} 
          />
      </Modal>

      <Modal isOpen={isSecurityModalOpen} onClose={() => setIsSecurityModalOpen(false)} title="Segurança da Conta">
          <SecuritySettings />
      </Modal>
    
    </div>
  );
}
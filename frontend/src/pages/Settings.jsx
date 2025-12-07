import { useEffect, useState, useContext } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import MobileMenu from '../components/MobileMenu';
import Modal from '../components/Modal';
import CategoryManager from '../components/CategoryManager';
import { 
  Settings as SettingsIcon, Users, Moon, Sun, LogOut, Trash2, 
  Shield, Tag, User, Mail, Send, Clock, XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Settings() {
  const { signOut, user } = useContext(AuthContext);
  const { theme, toggleTheme } = useTheme();
  
  // --- ESTADOS ---
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]); // Lista de convites pendentes
  const [houseInfo, setHouseInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false); // Modal de Categorias

  // --- CARREGAMENTO DE DADOS ---
  useEffect(() => {
    loadSettingsData();
  }, []);

  async function loadSettingsData() {
    try {
      // Carrega tudo em paralelo: Casa, Membros e Convites Pendentes
      const [houseRes, membersRes, invitesRes] = await Promise.all([
        api.get('/houses/'),
        api.get('/members/'),
        api.get('/invitations/')
      ]);

      if (houseRes.data.length > 0) setHouseInfo(houseRes.data[0]);
      setMembers(membersRes.data);
      setInvitations(invitesRes.data); // Atualiza lista de pendentes

    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar configurações.");
    } finally {
      setLoading(false);
    }
  }

  // --- AÇÕES DE MEMBROS ---

  async function removeMember(memberId) {
    if (!confirm("Tem a certeza que deseja remover este membro da casa?")) return;

    try {
      await api.delete(`/members/${memberId}/`);
      toast.success("Membro removido.");
      loadSettingsData();
    } catch (error) {
      toast.error("Erro ao remover membro (verifique permissões).");
    }
  }

  // --- AÇÕES DE CONVITE ---

  async function sendInvite() {
    if (!inviteEmail) return;
    setSendingInvite(true);
    
    try {
        await api.post('/invitations/', { email: inviteEmail });
        toast.success("Convite enviado com sucesso!");
        setInviteEmail('');
        loadSettingsData(); // Recarrega para mostrar na lista de pendentes
    } catch (error) {
        console.error(error);
        toast.error(error.response?.data?.error || "Erro ao enviar convite.");
    } finally {
        setSendingInvite(false);
    }
  }

  async function cancelInvite(id) {
    // Substitui o confirm() padrão por um toast interativo
    toast((t) => (
      <div className="flex flex-col gap-3 p-2">
        <p className="font-bold text-center">Deseja realmente cancelar este convite?</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-sm font-bold"
          >
            Não
          </button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              await api.delete(`/invitations/${id}/`);
              toast.success("Convite cancelado.");
              loadSettingsData();
            }}
            className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold"
          >
            Sim, cancelar
          </button>
        </div>
      </div>
    ), { duration: 6000 }); // Duração maior para dar tempo de responder
  }

  // --- RENDERIZAÇÃO ---
  return (
    <div className="flex w-screen h-screen overflow-hidden font-sans bg-gray-50 dark:bg-[#0F172A] dark:text-gray-100">
      
      <div className="hidden md:block h-full shrink-0 relative z-20">
         <Sidebar />
      </div>

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        <div className="flex-1 overflow-y-auto w-full scroll-smooth">
            
            <header className="px-4 py-6 md:px-8 md:py-8 shrink-0">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <SettingsIcon className="text-teal-500" /> Configurações
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie a sua casa e preferências.</p>
            </header>

            <main className="px-4 md:px-8 pb-32 md:pb-10 space-y-6">
                
                {/* 1. CARTÃO DE PERFIL E TEMA */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-teal-400 to-blue-500 flex items-center justify-center text-white font-bold text-xl shadow-md">
                            {user?.username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">{user?.username}</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {houseInfo ? `Casa: ${houseInfo.name}` : 'Membro da Casa'}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto">
                        <button 
                            onClick={toggleTheme}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                            <span className="text-sm font-medium">{theme === 'dark' ? 'Claro' : 'Escuro'}</span>
                        </button>
                        
                        <button 
                            onClick={signOut}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition border border-rose-100 dark:border-rose-900/30"
                        >
                            <LogOut size={18} />
                            <span className="text-sm font-bold">Sair</span>
                        </button>
                    </div>
                </div>

                {/* 2. MEMBROS E CONVITES */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
                        <Users className="text-blue-500" size={20} /> Membros da Casa
                    </h3>

                    {/* Lista de Membros Ativos */}
                    <div className="space-y-3">
                        {loading ? <p className="text-gray-400 text-sm">Carregando...</p> : members.map(member => (
                            <div key={member.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-100 dark:border-slate-700/50">
                                <div className="flex items-center gap-3">
                                    <div className="bg-gray-200 dark:bg-slate-700 p-2 rounded-full text-gray-600 dark:text-gray-300">
                                        <User size={18} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-gray-700 dark:text-gray-200">
                                            {member.user_name || "Utilizador"} 
                                            {member.user_name === user.username && " (Você)"}
                                        </p>
                                        <p className="text-xs text-gray-400">{member.role === 'ADMIN' ? 'Administrador' : 'Membro'}</p>
                                    </div>
                                </div>
                                
                                {member.user_name !== user.username && (
                                    <button 
                                        onClick={() => removeMember(member.id)} 
                                        className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition"
                                        title="Remover da casa"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    
                    {/* Área de Envio de Convite */}
                    <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-700">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                            <Mail size={12} /> Convidar novo membro
                        </label>
                        <div className="flex gap-2">
                            <input 
                                type="email" 
                                placeholder="digite.o@email.com"
                                className="flex-1 p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 text-sm transition-all"
                                value={inviteEmail}
                                onChange={e => setInviteEmail(e.target.value)}
                            />
                            <button 
                                onClick={sendInvite}
                                disabled={!inviteEmail || sendingInvite}
                                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition flex items-center gap-2"
                            >
                                <Send size={16} /> 
                                <span className="hidden md:inline">{sendingInvite ? 'Enviando...' : 'Enviar'}</span>
                            </button>
                        </div>
                    </div>

                    {/* LISTA DE CONVITES PENDENTES */}
                    {invitations.length > 0 && (
                        <div className="mt-4 space-y-2 animate-fade-in-down">
                            <h4 className="text-[10px] font-bold text-yellow-600 dark:text-yellow-500 uppercase mb-2 flex items-center gap-1">
                                <Clock size={12} /> Aguardando Aceite ({invitations.length})
                            </h4>
                            {invitations.map(invite => (
                                <div key={invite.id} className="flex justify-between items-center p-2.5 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl border border-yellow-100 dark:border-yellow-900/20">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="p-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500 rounded-full">
                                            <Mail size={14} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-gray-700 dark:text-gray-200 truncate">{invite.email}</p>
                                            <p className="text-[10px] text-gray-400">Enviado em {new Date(invite.created_at).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => cancelInvite(invite.id)}
                                        className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition"
                                        title="Cancelar convite"
                                    >
                                        <XCircle size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 3. SISTEMA E DADOS */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
                        <Shield className="text-purple-500" size={20} /> Sistema e Dados
                    </h3>
                    
                    <div className="space-y-2">
                        <button 
                            onClick={() => setIsModalOpen(true)}
                            className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg">
                                    <Tag size={20} />
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-gray-700 dark:text-gray-200">Gerir Categorias</p>
                                    <p className="text-xs text-gray-500">Edite ou exclua categorias financeiras</p>
                                </div>
                            </div>
                            <span className="text-gray-400 group-hover:translate-x-1 transition">→</span>
                        </button>
                    </div>
                </div>

            </main>
        </div>
      </div>

      <MobileMenu />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Categorias">
         <CategoryManager onBack={() => setIsModalOpen(false)} />
      </Modal>

    </div>
  );
}
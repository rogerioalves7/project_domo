import { createContext, useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

export const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); 

  useEffect(() => {
    async function loadStorageData() {
      const storagedToken = localStorage.getItem('@MyHome:token');
      const storagedUser = localStorage.getItem('@MyHome:user');

      if (storagedToken && storagedUser) {
        try {
            api.defaults.headers.Authorization = `Token ${storagedToken}`;
            setUser(JSON.parse(storagedUser));
        } catch (error) {
            signOut();
        }
      }
      setLoading(false); 
    }
    loadStorageData();
  }, []);

  // --- NOVA LÓGICA DE JOIN ---
  async function checkPendingInvite() {
      const token = localStorage.getItem('pending_invite_token');
      if (token) {
          try {
              await api.post('/invitations/join/', { token });
              toast.success("Você entrou na casa do convite!");
          } catch (error) {
              console.error("Erro no join:", error);
              toast.error("Falha ao entrar na casa do convite.");
          } finally {
              localStorage.removeItem('pending_invite_token');
          }
      }
  }

  async function signIn({ username, password }) {
    try {
      const response = await api.post('api-token-auth/', { username, password });
      const { token } = response.data;
      
      handleLoginSuccess(token, username);
      
      // Checa convite APÓS login
      await checkPendingInvite();

    } catch (error) {
      console.error(error);
      toast.error("Erro ao fazer login.");
      throw error;
    }
  }

  async function signUp({ username, email, password, first_name }) { // <--- Adicione first_name aqui
    try {
      const response = await api.post('/register/', {
        username,
        email,
        password,
        first_name // <--- E certifique-se de enviá-lo aqui
      });
        
    } catch (error) {
        console.error(error);
        toast.error(error.response?.data?.error || "Erro ao criar conta.");
        throw error;
    }
  }

  function handleLoginSuccess(token, username) {
      localStorage.setItem('@MyHome:token', token);
      localStorage.setItem('@MyHome:user', JSON.stringify({ username }));
      api.defaults.headers.Authorization = `Token ${token}`;
      setUser({ username });
  }

  function signOut() {
    localStorage.clear(); // Limpa tudo, inclusive tokens pendentes
    api.defaults.headers.Authorization = undefined;
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ signed: !!user, user, signIn, signUp, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
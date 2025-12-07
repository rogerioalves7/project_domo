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
            localStorage.clear();
            setUser(null);
        }
      }
      setLoading(false); 
    }
    loadStorageData();
  }, []);

  async function signIn({ username, password }) {
    try {
      const response = await api.post('api-token-auth/', { username, password });
      const { token } = response.data;
      handleLoginSuccess(token, username);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao fazer login. Verifique seus dados.");
      throw error;
    }
  }

  // --- NOVA FUNÇÃO DE REGISTRO ---
  async function signUp({ username, email, password, invitation_token }) {
    try {
        const response = await api.post('/register/', { username, email, password, invitation_token });
        const { token } = response.data;
        
        // Já loga o usuário automaticamente após criar a conta
        handleLoginSuccess(token, username);
        toast.success("Conta criada com sucesso!");
        
    } catch (error) {
        console.error(error);
        // Pega a mensagem de erro específica do backend se existir
        const msg = error.response?.data?.error || "Erro ao criar conta.";
        toast.error(msg);
        throw error;
    }
  }

  // Helper para evitar repetição de código
  function handleLoginSuccess(token, username) {
      localStorage.setItem('@MyHome:token', token);
      localStorage.setItem('@MyHome:user', JSON.stringify({ username }));
      api.defaults.headers.Authorization = `Token ${token}`;
      setUser({ username });
  }

  function signOut() {
    localStorage.clear();
    api.defaults.headers.Authorization = undefined;
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ signed: !!user, user, signIn, signUp, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
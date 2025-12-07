import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react'; 

export default function AcceptInvite() {
    const { token } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        // Redireciona imediatamente para o cadastro, passando o token como parâmetro
        if (token) {
            navigate(`/login?invite=${token}`, { replace: true });
        } else {
            navigate('/login');
        }
    }, [token, navigate]);

    // Exibe um loading rápido enquanto redireciona
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-[#0F172A]">
            <Loader2 className="w-12 h-12 text-teal-600 animate-spin" />
            <p className="mt-4 text-gray-600 dark:text-gray-300">A processar convite...</p>
        </div>
    );
}
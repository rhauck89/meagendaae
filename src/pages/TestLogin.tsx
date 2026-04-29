import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const TestLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setUser(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
  };

  if (loading && !user) return <div className="p-8">Carregando...</div>;

  return (
    <div className="p-8 max-w-md mx-auto space-y-6 font-sans">
      <h1 className="text-2xl font-bold border-b pb-2">Página de Teste - Supabase Auth</h1>
      
      {user ? (
        <div className="bg-green-50 p-4 rounded border border-green-200 space-y-4">
          <p className="text-green-800 font-medium">Logado como: <span className="font-bold">{user.email}</span></p>
          <p className="text-xs text-green-600">ID: {user.id}</p>
          <button 
            onClick={handleLogout}
            className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 transition-colors"
          >
            Sair (Logout)
          </button>
        </div>
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <p className="text-sm text-gray-600 italic">Insira credenciais de admin/profissional para testar o isolamento.</p>
          <div className="space-y-2">
            <label className="block text-sm font-medium">Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">Senha</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          {error && <p className="text-red-600 text-sm font-bold">{error}</p>}
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar (signInWithPassword)'}
          </button>
        </form>
      )}

      <div className="mt-8 p-4 bg-gray-100 rounded text-xs text-gray-500">
        <p>Esta página não utiliza:</p>
        <ul className="list-disc ml-4 mt-2">
          <li>AuthProvider / AuthContext</li>
          <li>useAuth / useUserRole hooks</li>
          <li>DashboardLayout</li>
          <li>Redirecionamentos automáticos</li>
        </ul>
      </div>
    </div>
  );
};

export default TestLogin;

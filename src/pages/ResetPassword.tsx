import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Scissors, CheckCircle } from 'lucide-react';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isRecovery, setIsRecovery] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event from the auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    // Check if we already have a session (user clicked the link)
    const checkHash = () => {
      const hash = window.location.hash;
      if (hash && hash.includes('type=recovery')) {
        setIsRecovery(true);
      }
    };
    checkHash();

    return () => subscription.unsubscribe();
  }, []);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (password.length < 6) newErrors.password = 'A senha deve ter no mínimo 6 caracteres.';
    if (password !== confirmPassword) newErrors.confirm = 'As senhas não coincidem.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success('Senha atualizada com sucesso!');
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch {
      toast.error('Erro ao atualizar senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery && !done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-14 h-14 bg-primary rounded-2xl flex items-center justify-center">
              <Scissors className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-2xl font-display">Recuperar Senha</CardTitle>
              <CardDescription>Carregando...</CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-14 h-14 bg-primary rounded-2xl flex items-center justify-center">
            {done ? <CheckCircle className="h-7 w-7 text-primary-foreground" /> : <Scissors className="h-7 w-7 text-primary-foreground" />}
          </div>
          <div>
            <CardTitle className="text-2xl font-display">
              {done ? 'Senha Atualizada' : 'Nova Senha'}
            </CardTitle>
            <CardDescription>
              {done ? 'Redirecionando para o painel...' : 'Defina sua nova senha'}
            </CardDescription>
          </div>
        </CardHeader>
        {!done && (
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })); }}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                />
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setErrors(p => ({ ...p, confirm: '' })); }}
                  placeholder="Repita a senha"
                  autoComplete="new-password"
                />
                {errors.confirm && <p className="text-sm text-destructive">{errors.confirm}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Atualizando...' : 'Atualizar senha'}
              </Button>
            </form>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default ResetPassword;

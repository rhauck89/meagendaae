import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import SettingsBreadcrumb from '@/components/SettingsBreadcrumb';

const SettingsSecurity = () => {
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword.length < 8) {
      toast.error('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('As senhas não conferem.');
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
      if (error) throw error;
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      toast.success('Senha alterada com sucesso.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar senha.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsBreadcrumb current="Segurança" />
      <div>
        <h2 className="text-xl font-display font-bold">Segurança</h2>
        <p className="text-sm text-muted-foreground">Gerencie a segurança da sua conta</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <Lock className="h-5 w-5" /> Alterar Senha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">Confirmar nova senha</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                autoComplete="new-password"
                placeholder="Repita a nova senha"
              />
            </div>
          </div>
          <Button onClick={handlePasswordChange} disabled={passwordLoading}>
            {passwordLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
            {passwordLoading ? 'Alterando...' : 'Salvar nova senha'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsSecurity;


import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const testEmailSending = async (email: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: email,
        type: 'company_welcome',
        data: { name: 'Admin Agendaê' }
      }
    });

    if (error) throw error;
    toast.success('E-mail de teste enviado com sucesso!');
    return data;
  } catch (err) {
    console.error('Erro no teste de e-mail:', err);
    toast.error('Falha ao enviar e-mail de teste.');
  }
};

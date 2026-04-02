import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Users, Percent, DollarSign, Settings, Copy, ExternalLink, Mail, KeyRound, MessageCircle, Pencil, UserX, UserCheck, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import ProfessionalPanel from '@/components/ProfessionalPanel';

const ROLE_TITLES = ['Barbeiro', 'Cabeleireira', 'Esteticista', 'Manicure', 'Recepcionista'];

const Team = () => {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedCollaborator, setSelectedCollaborator] = useState<any>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string; link: string } | null>(null);
  const [inviteCredentials, setInviteCredentials] = useState<{ email: string; password: string } | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('active');

  // Edit modal state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', collaborator_type: 'commissioned' as string, commission_type: 'percentage' as string, commission_value: '' as string | number });

  // Disable/Delete confirm state
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [disableTarget, setDisableTarget] = useState<any>(null);
  const [cannotDeleteDialogOpen, setCannotDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    whatsapp: '',
    role_title: 'Barbeiro',
    collaborator_type: 'commissioned' as 'partner' | 'commissioned' | 'independent',
    payment_type: 'percentage' as 'percentage' | 'fixed' | 'none',
    commission_value: 10,
  });

  const teamQueryKey = ['collaborators', companyId];

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('slug, business_type')
        .eq('id', companyId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: collaborators = [], refetch } = useQuery({
    queryKey: teamQueryKey,
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collaborators')
        .select('*, profile:profiles(*)')
        .eq('company_id', companyId!)
        .order('created_at');

      if (error) throw error;
      return data ?? [];
    },
  });

  const activeCollaborators = collaborators.filter((c) => c.active !== false);
  const disabledCollaborators = collaborators.filter((c) => c.active === false);

  const resetForm = () => {
    setForm({
      name: '',
      email: '',
      whatsapp: '',
      role_title: 'Barbeiro',
      collaborator_type: 'commissioned',
      payment_type: 'percentage',
      commission_value: 10,
    });
    setCreatedCredentials(null);
  };

  const refreshTeam = async () => {
    await queryClient.invalidateQueries({ queryKey: teamQueryKey });
    await refetch();
  };

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  const handleAdd = async () => {
    if (!form.email.trim() || !form.name.trim()) {
      return toast.error('Preencha todos os campos');
    }

    if (!companyId) {
      return toast.error('Empresa não encontrada');
    }

    try {
      const tempPassword = `${crypto.randomUUID().slice(0, 8)}A1!`;
      const professionalSlug = generateSlug(form.name);

      const response = await supabase.functions.invoke('create-collaborator', {
        body: {
          name: form.name.trim(),
          email: form.email.trim(),
          whatsapp: form.whatsapp.trim() || null,
          company_id: companyId,
          collaborator_type: form.collaborator_type,
          payment_type: form.payment_type,
          commission_value: form.payment_type === 'none' ? 0 : form.commission_value,
          role: 'collaborator',
          role_title: form.role_title,
          slug: professionalSlug,
          temp_password: tempPassword,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao criar colaborador');
      }

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Erro ao criar colaborador');
      }

      const businessPrefix = company?.business_type === 'esthetic' ? 'estetica' : 'barbearia';
      const bookingLink = `${window.location.origin}/${businessPrefix}/${company?.slug}/${professionalSlug}`;

      setCreatedCredentials({
        email: form.email.trim(),
        password: tempPassword,
        link: bookingLink,
      });

      toast.success('Profissional adicionado com sucesso!');
      await refreshTeam();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar colaborador');
    }
  };

  const handleSendInvite = async (collaborator: any) => {
    const email = collaborator.profile?.email;
    const userId = collaborator.profile?.user_id;
    if (!email) return toast.error('Email não encontrado');

    setLoadingAction(`invite-${collaborator.id}`);
    try {
      const response = await supabase.functions.invoke('invite-team-member', {
        body: { action: 'invite', email, user_id: userId },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success) throw new Error(response.data?.error || 'Erro ao gerar convite');

      setInviteCredentials({ email, password: response.data.temp_password });
      setInviteDialogOpen(true);
      toast.success('Credenciais temporárias geradas!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar convite');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleResetPassword = async (collaborator: any) => {
    const email = collaborator.profile?.email;
    const userId = collaborator.profile?.user_id;
    if (!email) return toast.error('Email não encontrado');

    setLoadingAction(`reset-${collaborator.id}`);
    try {
      const response = await supabase.functions.invoke('invite-team-member', {
        body: { action: 'reset_password', email, user_id: userId },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success) throw new Error(response.data?.error || 'Erro ao resetar senha');

      toast.success('Email de redefinição de senha enviado!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao resetar senha');
    } finally {
      setLoadingAction(null);
    }
  };

  const openEditDialog = (collaborator: any) => {
    setEditTarget(collaborator);
    setEditForm({
      name: collaborator.profile?.full_name || '',
      email: collaborator.profile?.email || '',
      collaborator_type: collaborator.collaborator_type || 'commissioned',
      commission_type: collaborator.commission_type || 'none',
      commission_value: collaborator.commission_value || 0,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    if (!editForm.name.trim()) return toast.error('Nome é obrigatório');

    try {
      // Update profile
      await supabase
        .from('profiles')
        .update({ full_name: editForm.name.trim(), email: editForm.email.trim() })
        .eq('id', editTarget.profile_id);

      // Update collaborator
      const commissionType = editForm.commission_type as 'percentage' | 'fixed' | 'none';
      await supabase
        .from('collaborators')
        .update({
          collaborator_type: editForm.collaborator_type as any,
          commission_type: commissionType,
          commission_value: commissionType === 'none' ? 0 : editForm.commission_value,
        } as any)
        .eq('id', editTarget.id);

      toast.success('Profissional atualizado!');
      setEditDialogOpen(false);
      await refreshTeam();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar');
    }
  };

  const handleDisable = async (collaborator: any) => {
    try {
      await supabase
        .from('collaborators')
        .update({ active: false } as any)
        .eq('id', collaborator.id);
      toast.success('Profissional desabilitado');
      setDisableDialogOpen(false);
      await refreshTeam();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao desabilitar');
    }
  };

  const handleEnable = async (collaborator: any) => {
    try {
      await supabase
        .from('collaborators')
        .update({ active: true } as any)
        .eq('id', collaborator.id);
      toast.success('Profissional reabilitado!');
      await refreshTeam();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao reabilitar');
    }
  };

  const handleDeleteAttempt = async (collaborator: any) => {
    // Check if professional has appointments
    const { count } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('professional_id', collaborator.profile_id);

    if (count && count > 0) {
      setDeleteTarget(collaborator);
      setCannotDeleteDialogOpen(true);
    } else {
      setDeleteTarget(collaborator);
      setDeleteConfirmOpen(true);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    try {
      // Delete collaborator record
      await supabase.from('collaborators').delete().eq('id', deleteTarget.id);
      toast.success('Profissional excluído');
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
      await refreshTeam();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const paymentLabel = (type: string, value: number) => {
    if (type === 'percentage') return `${value}%`;
    if (type === 'fixed') return `R$ ${Number(value).toFixed(2)}/serviço`;
    return 'Sem comissão';
  };

  const getCollaboratorProfileLink = (collaborator: any) => {
    if (!company) return '';
    const businessPrefix = company.business_type === 'esthetic' ? 'estetica' : 'barbearia';
    const slug = collaborator.slug || generateSlug(collaborator.profile?.full_name || '');
    return `${window.location.origin}/perfil/${businessPrefix}/${company.slug}/${slug}`;
  };

  const renderCollaboratorCard = (collaborator: any, isDisabled: boolean) => {
    const profileLink = getCollaboratorProfileLink(collaborator);
    return (
      <Card key={collaborator.id} className={isDisabled ? 'opacity-60' : ''}>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-bold text-primary shrink-0">
              {collaborator.profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{collaborator.profile?.full_name}</p>
              <p className="text-sm text-muted-foreground">{collaborator.profile?.email}</p>
            </div>
            {!isDisabled && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setSelectedCollaborator(collaborator); setPanelOpen(true); }}
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {collaborator.collaborator_type === 'partner' ? 'Sócio' : collaborator.collaborator_type === 'independent' ? 'Independente' : 'Comissionado'}
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              {collaborator.commission_type === 'percentage' && <><Percent className="h-3 w-3" /> {paymentLabel(collaborator.commission_type, collaborator.commission_value)}</>}
              {collaborator.commission_type === 'fixed' && <><DollarSign className="h-3 w-3" /> {paymentLabel(collaborator.commission_type, collaborator.commission_value)}</>}
              {collaborator.commission_type === 'none' && paymentLabel(collaborator.commission_type, collaborator.commission_value)}
            </Badge>
            {isDisabled && <Badge variant="destructive">Desabilitado</Badge>}
          </div>

          {isDisabled ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEnable(collaborator)}>
                <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Reabilitar
              </Button>
              <Button variant="destructive" size="sm" className="flex-1" onClick={() => handleDeleteAttempt(collaborator)}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
              </Button>
            </div>
          ) : (
            <>
              {/* Edit & Disable */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditDialog(collaborator)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => { setDisableTarget(collaborator); setDisableDialogOpen(true); }}>
                  <UserX className="mr-1.5 h-3.5 w-3.5" /> Desabilitar
                </Button>
              </div>

              {/* Access management */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={loadingAction === `invite-${collaborator.id}`}
                  onClick={() => handleSendInvite(collaborator)}
                >
                  <Mail className="mr-1.5 h-3.5 w-3.5" />
                  {loadingAction === `invite-${collaborator.id}` ? 'Gerando...' : 'Enviar convite'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={loadingAction === `reset-${collaborator.id}`}
                  onClick={() => handleResetPassword(collaborator)}
                >
                  <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                  {loadingAction === `reset-${collaborator.id}` ? 'Enviando...' : 'Resetar senha'}
                </Button>
              </div>

              {profileLink && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-[7]"
                    onClick={() => window.open(profileLink, '_blank')}
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Ver página pública
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-[3]"
                    onClick={() => {
                      navigator.clipboard.writeText(profileLink);
                      toast.success('Link do profissional copiado');
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold">Equipe</h2>
          <p className="text-sm text-muted-foreground">Gerencie profissionais do seu estabelecimento</p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Adicionar Profissional
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {createdCredentials ? 'Profissional Criado!' : 'Novo Profissional'}
              </DialogTitle>
            </DialogHeader>

            {createdCredentials ? (() => {
              const loginUrl = `${window.location.origin}/auth`;
              const fullMessage = `🔐 *Acesso ao sistema*\n\n📎 Link de login: ${loginUrl}\n📧 Email: ${createdCredentials.email}\n🔑 Senha temporária: ${createdCredentials.password}\n\n📌 Link de agendamento:\n${createdCredentials.link}\n\n⚠️ Troque sua senha após o primeiro login.`;
              const whatsAppUrl = `https://wa.me/?text=${encodeURIComponent(fullMessage)}`;
              return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Envie esses dados para o profissional acessar o sistema:</p>
                <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Link de login</p>
                    <p className="font-mono text-xs break-all">{loginUrl}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email de acesso</p>
                    <p className="font-mono text-sm">{createdCredentials.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Senha temporária</p>
                    <p className="font-mono text-sm">{createdCredentials.password}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Link de agendamento</p>
                    <p className="font-mono text-xs break-all">{createdCredentials.link}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">O profissional pode alterar a senha após o primeiro login.</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() =>
                      copyToClipboard(fullMessage, 'Dados de acesso')
                    }
                  >
                    <Copy className="mr-2 h-4 w-4" /> Copiar acesso
                  </Button>
                  <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" asChild>
                    <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="mr-2 h-4 w-4" /> Enviar via WhatsApp
                    </a>
                  </Button>
                </div>
                <Button variant="ghost" className="w-full" onClick={() => { setDialogOpen(false); resetForm(); }}>
                  Fechar
                </Button>
              </div>
              );
            })() : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="(31) 99999-9999" />
                </div>
                <div className="space-y-2">
                  <Label>Função</Label>
                  <Select value={form.role_title} onValueChange={(v) => setForm({ ...form, role_title: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLE_TITLES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.collaborator_type} onValueChange={(value) => setForm({ ...form, collaborator_type: value as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="partner">Sócio</SelectItem>
                      <SelectItem value="commissioned">Comissionado</SelectItem>
                      <SelectItem value="independent">Independente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Forma de pagamento</Label>
                  <Select value={form.payment_type} onValueChange={(value) => setForm({ ...form, payment_type: value as 'percentage' | 'fixed' | 'none' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentual</SelectItem>
                      <SelectItem value="fixed">Valor fixo</SelectItem>
                      <SelectItem value="none">Sem comissão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.payment_type === 'percentage' && (
                  <div className="space-y-2">
                    <Label>Comissão (%)</Label>
                    <Input
                      type="number"
                      value={form.commission_value}
                      onChange={(e) => setForm({ ...form, commission_value: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                )}
                {form.payment_type === 'fixed' && (
                  <div className="space-y-2">
                    <Label>Valor por serviço (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.commission_value}
                      onChange={(e) => setForm({ ...form, commission_value: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                )}
                <Button onClick={handleAdd} className="w-full">Adicionar</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">Ativos ({activeCollaborators.length})</TabsTrigger>
          <TabsTrigger value="disabled">Desabilitados ({disabledCollaborators.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {activeCollaborators.map((c) => renderCollaboratorCard(c, false))}
            {activeCollaborators.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                <Users className="mx-auto mb-3 h-12 w-12 opacity-40" />
                <p>Nenhum profissional ativo</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="disabled">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {disabledCollaborators.map((c) => renderCollaboratorCard(c, true))}
            {disabledCollaborators.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                <Users className="mx-auto mb-3 h-12 w-12 opacity-40" />
                <p>Nenhum profissional desabilitado</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Professional Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Profissional</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={editForm.collaborator_type} onValueChange={(v) => setEditForm({ ...editForm, collaborator_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="partner">Sócio</SelectItem>
                  <SelectItem value="commissioned">Comissionado</SelectItem>
                  <SelectItem value="independent">Independente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Forma de comissão</Label>
              <Select value={editForm.commission_type} onValueChange={(v) => setEditForm({ ...editForm, commission_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentual</SelectItem>
                  <SelectItem value="fixed">Valor fixo</SelectItem>
                  <SelectItem value="none">Sem comissão</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editForm.commission_type === 'percentage' && (
              <div className="space-y-2">
                <Label>Comissão (%)</Label>
                <Input type="number" value={editForm.commission_value} onChange={(e) => setEditForm({ ...editForm, commission_value: parseFloat(e.target.value) || 0 })} />
              </div>
            )}
            {editForm.commission_type === 'fixed' && (
              <div className="space-y-2">
                <Label>Valor por serviço (R$)</Label>
                <Input type="number" step="0.01" value={editForm.commission_value} onChange={(e) => setEditForm({ ...editForm, commission_value: parseFloat(e.target.value) || 0 })} />
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSaveEdit}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Disable Confirmation */}
      <AlertDialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desabilitar profissional?</AlertDialogTitle>
            <AlertDialogDescription>
              O profissional não aparecerá na agenda, não poderá receber novos agendamentos e ficará oculto na página pública. O histórico será mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => disableTarget && handleDisable(disableTarget)}>
              Desabilitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cannot Delete Dialog */}
      <AlertDialog open={cannotDeleteDialogOpen} onOpenChange={setCannotDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Não é possível excluir</AlertDialogTitle>
            <AlertDialogDescription>
              Este profissional não pode ser excluído porque já possui registros no sistema. Para manter a integridade dos relatórios e histórico financeiro, utilize a opção "Desabilitar profissional".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setCannotDeleteDialogOpen(false); if (deleteTarget) handleDisable(deleteTarget); }}>
              Desabilitar profissional
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir profissional?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O profissional será removido permanentemente do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirmed} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite credentials dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Credenciais de Acesso</DialogTitle>
          </DialogHeader>
          {inviteCredentials && (() => {
            const loginUrl = `${window.location.origin}/auth`;
            const fullMessage = `🔐 *Acesso ao sistema*\n\n📎 Link de login: ${loginUrl}\n📧 Email: ${inviteCredentials.email}\n🔑 Senha temporária: ${inviteCredentials.password}\n\n⚠️ Troque sua senha após o primeiro login.`;
            const whatsAppUrl = `https://wa.me/?text=${encodeURIComponent(fullMessage)}`;
            return (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Envie esses dados para o profissional acessar o sistema:
              </p>
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Link de login</p>
                  <p className="font-mono text-xs break-all">{loginUrl}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-mono text-sm">{inviteCredentials.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Senha temporária</p>
                  <p className="font-mono text-sm">{inviteCredentials.password}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                O profissional pode alterar a senha após o primeiro login.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => copyToClipboard(fullMessage, 'Credenciais')}
                >
                  <Copy className="mr-2 h-4 w-4" /> Copiar acesso
                </Button>
                <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" asChild>
                  <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" /> Enviar via WhatsApp
                  </a>
                </Button>
              </div>
              <Button variant="ghost" className="w-full" onClick={() => setInviteDialogOpen(false)}>
                Fechar
              </Button>
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {selectedCollaborator && (
        <ProfessionalPanel
          collaborator={selectedCollaborator}
          open={panelOpen}
          onOpenChange={setPanelOpen}
          onUpdated={refreshTeam}
        />
      )}
    </div>
  );
};

export default Team;

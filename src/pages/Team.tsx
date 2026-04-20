import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRefreshData } from '@/hooks/useRefreshData';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Users, Percent, DollarSign, Settings, Copy, ExternalLink, Mail, KeyRound, MessageCircle, Pencil, UserX, UserCheck, Trash2, CalendarOff, ChevronLeft, ChevronRight, Check, Clock, Wallet, Crown, Lock, MoreVertical, Calendar as CalendarIcon, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import ProfessionalPanel from '@/components/ProfessionalPanel';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { commissionLabel } from '@/lib/financial-engine';

const ROLE_TITLES = ['Barbeiro', 'Cabeleireira', 'Esteticista', 'Manicure', 'Recepcionista'];
const WIZARD_STEPS = 5;

const Team = () => {
  const { companyId, user } = useAuth();
  const queryClient = useQueryClient();
  const { refresh } = useRefreshData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedCollaborator, setSelectedCollaborator] = useState<any>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string; link: string } | null>(null);
  const [inviteCredentials, setInviteCredentials] = useState<{ email: string; password: string } | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Edit modal state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', collaborator_type: 'commissioned' as string, commission_type: 'percentage' as string, commission_value: '' as string | number, booking_mode: 'hybrid' as string, grid_interval: 15 as number, break_time: 0 as number });

  // Disable/Delete confirm state
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [disableTarget, setDisableTarget] = useState<any>(null);
  const [cannotDeleteDialogOpen, setCannotDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Absence modal state
  const [absenceDialogOpen, setAbsenceDialogOpen] = useState(false);
  const [absenceTarget, setAbsenceTarget] = useState<any>(null);
  const [absenceForm, setAbsenceForm] = useState({ absence_start: '', absence_end: '', absence_type: 'ferias' });

  // Wizard step state
  const [wizardStep, setWizardStep] = useState(1);

  const [form, setForm] = useState({
    name: '',
    email: '',
    whatsapp: '',
    role_title: 'Barbeiro',
    collaborator_type: 'commissioned' as 'partner' | 'commissioned' | 'independent',
    payment_type: 'percentage' as 'percentage' | 'fixed' | 'none' | 'own_revenue',
    commission_value: '' as string | number,
    booking_mode: 'hybrid' as string,
    grid_interval: 15 as number,
    break_time: 0 as number,
    selectedServiceIds: [] as string[],
    has_system_access: true,
    is_admin_self: false,
    use_company_banner: true,
    schedule_from_company: true,
  });

  // Fetch company services for step 3
  const { data: companyServices = [] } = useQuery({
    queryKey: ['company-services', companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name, duration_minutes, price')
        .eq('company_id', companyId!)
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const teamQueryKey = ['collaborators', companyId];

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('slug, business_type, booking_mode, fixed_slot_interval, owner_id, prof_perm_booking_mode, prof_perm_grid_interval')
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

  // Aggregated appointments query — fetch today's appointments for all professionals at once
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const professionalIds = collaborators.map((c) => c.profile_id).filter(Boolean);

  const { data: appointmentsAgg = {} } = useQuery({
    queryKey: ['team-appointments-agg', companyId, professionalIds.join(',')],
    enabled: Boolean(companyId) && professionalIds.length > 0,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('appointments')
        .select('id, professional_id, start_time, end_time, status')
        .eq('company_id', companyId!)
        .in('professional_id', professionalIds)
        .gte('start_time', todayStart.toISOString())
        .lte('start_time', todayEnd.toISOString())
        .in('status', ['pending', 'confirmed'] as any)
        .order('start_time');
      if (error) throw error;
      const map: Record<string, { todayCount: number; next: string | null }> = {};
      for (const a of data ?? []) {
        const pid = (a as any).professional_id as string;
        if (!pid) continue;
        if (!map[pid]) map[pid] = { todayCount: 0, next: null };
        map[pid].todayCount += 1;
        if (!map[pid].next && (a as any).start_time >= nowIso) {
          map[pid].next = (a as any).start_time;
        }
      }
      return map;
    },
    staleTime: 60_000,
  });

  // Available role titles for filter
  const availableRoles = Array.from(
    new Set(
      collaborators
        .map((c) => (c.profile as any)?.role_title)
        .filter((r): r is string => Boolean(r) && r.trim().length > 0)
    )
  ).sort();

  const matchesFilters = (c: any) => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const name = (c.profile?.full_name || '').toLowerCase();
      const email = (c.profile?.email || '').toLowerCase();
      if (!name.includes(q) && !email.includes(q)) return false;
    }
    if (roleFilter !== 'all') {
      const role = (c.profile as any)?.role_title || '';
      if (role !== roleFilter) return false;
    }
    return true;
  };

  const filteredActive = activeCollaborators.filter(matchesFilters);
  const filteredDisabled = disabledCollaborators.filter(matchesFilters);

  const resetForm = () => {
    setForm({
      name: '',
      email: '',
      whatsapp: '',
      role_title: 'Barbeiro',
      collaborator_type: 'commissioned',
      payment_type: 'percentage',
      commission_value: '',
      booking_mode: 'hybrid',
      grid_interval: 15,
      break_time: 0,
      selectedServiceIds: [],
      has_system_access: true,
      is_admin_self: false,
      use_company_banner: true,
      schedule_from_company: true,
    });
    setCreatedCredentials(null);
    setWizardStep(1);
  };

  const refreshTeam = async () => {
    refresh('team');
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
    if (!form.name.trim()) {
      return toast.error('Preencha o nome');
    }

    if (form.has_system_access && !form.is_admin_self && !form.email.trim()) {
      return toast.error('Preencha o email de acesso');
    }

    if (!companyId) {
      return toast.error('Empresa não encontrada');
    }

    try {
      const tempPassword = `${crypto.randomUUID().slice(0, 8)}A1!`;
      const professionalSlug = generateSlug(form.name);

      const bookingMode = form.schedule_from_company ? (company?.booking_mode || 'hybrid') : form.booking_mode;
      const gridInterval = form.schedule_from_company ? (company?.fixed_slot_interval || 15) : form.grid_interval;

      const response = await supabase.functions.invoke('create-collaborator', {
        body: {
          name: form.name.trim(),
          email: form.is_admin_self ? (user?.email || '') : form.email.trim(),
          whatsapp: form.whatsapp.trim() || null,
          company_id: companyId,
          collaborator_type: form.collaborator_type,
          payment_type: form.payment_type,
          commission_value: form.payment_type === 'none' || form.payment_type === 'own_revenue' ? 0 : (Number(form.commission_value) || 0),
          role: 'collaborator',
          role_title: form.role_title,
          slug: professionalSlug,
          temp_password: tempPassword,
          booking_mode: bookingMode,
          grid_interval: gridInterval,
          break_time: form.break_time,
          service_ids: form.selectedServiceIds,
          has_system_access: form.has_system_access,
          is_admin_self: form.is_admin_self,
          use_company_banner: form.use_company_banner,
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

      if (form.has_system_access && !form.is_admin_self) {
        setCreatedCredentials({
          email: form.email.trim(),
          password: tempPassword,
          link: bookingLink,
        });
      } else {
        setDialogOpen(false);
        resetForm();
      }

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
      commission_value: collaborator.commission_value || '',
      booking_mode: (collaborator as any).booking_mode || 'hybrid',
      grid_interval: (collaborator as any).grid_interval || 15,
      break_time: (collaborator as any).break_time || 0,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    if (!editForm.name.trim()) return toast.error('Nome é obrigatório');

    try {
      await supabase
        .from('profiles')
        .update({ full_name: editForm.name.trim(), email: editForm.email.trim() })
        .eq('id', editTarget.profile_id);

      const commissionType = editForm.commission_type as 'percentage' | 'fixed' | 'none' | 'own_revenue';
      const updateData: any = {
        collaborator_type: editForm.collaborator_type as any,
        commission_type: commissionType as any,
        commission_value: commissionType === 'none' || commissionType === 'own_revenue' ? 0 : (Number(editForm.commission_value) || 0),
        break_time: editForm.break_time,
      };
      // Only allow booking_mode change if permitted
      if ((company as any)?.prof_perm_booking_mode) {
        updateData.booking_mode = editForm.booking_mode;
      }
      // Only allow grid_interval change if permitted
      if ((company as any)?.prof_perm_grid_interval) {
        updateData.grid_interval = editForm.grid_interval;
      }
      await supabase
        .from('collaborators')
        .update(updateData)
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
      await supabase.from('collaborators').delete().eq('id', deleteTarget.id);
      toast.success('Profissional excluído');
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
      await refreshTeam();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    }
  };

  const openAbsenceDialog = (collaborator: any) => {
    setAbsenceTarget(collaborator);
    setAbsenceForm({
      absence_start: (collaborator as any).absence_start || '',
      absence_end: (collaborator as any).absence_end || '',
      absence_type: (collaborator as any).absence_type || 'ferias',
    });
    setAbsenceDialogOpen(true);
  };

  const handleSaveAbsence = async () => {
    if (!absenceTarget) return;
    if (!absenceForm.absence_start || !absenceForm.absence_end) return toast.error('Defina as datas de início e fim');
    if (absenceForm.absence_start > absenceForm.absence_end) return toast.error('Data de início deve ser antes da data de fim');

    try {
      await supabase
        .from('collaborators')
        .update({
          absence_start: absenceForm.absence_start,
          absence_end: absenceForm.absence_end,
          absence_type: absenceForm.absence_type,
        } as any)
        .eq('id', absenceTarget.id);
      toast.success('Ausência configurada!');
      setAbsenceDialogOpen(false);
      await refreshTeam();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar ausência');
    }
  };

  const handleRemoveAbsence = async (collaborator: any) => {
    try {
      await supabase
        .from('collaborators')
        .update({
          absence_start: null,
          absence_end: null,
          absence_type: null,
        } as any)
        .eq('id', collaborator.id);
      toast.success('Ausência removida!');
      await refreshTeam();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover ausência');
    }
  };

  const isCurrentlyAbsent = (collaborator: any) => {
    const start = (collaborator as any).absence_start;
    const end = (collaborator as any).absence_end;
    if (!start || !end) return false;
    const today = new Date().toISOString().split('T')[0];
    return today >= start && today <= end;
  };

  const absenceTypeLabel = (type: string) => {
    const labels: Record<string, string> = { ferias: 'Férias', folga: 'Folga', recesso: 'Recesso', ausente: 'Ausente' };
    return labels[type] || type;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const paymentLabel = (type: string, value: number) => {
    if (type === 'own_revenue') return 'Receita própria';
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
    const hasAccess = (collaborator as any).has_system_access !== false;
    const isAbsent = !isDisabled && isCurrentlyAbsent(collaborator);
    const isOwner = collaborator.profile?.user_id === company?.owner_id;
    const agg = (appointmentsAgg as any)[collaborator.profile_id] as { todayCount: number; next: string | null } | undefined;
    const todayCount = agg?.todayCount ?? 0;
    const nextTime = agg?.next
      ? new Date(agg.next).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : null;
    return (
      <Card key={collaborator.id} className={isDisabled ? 'opacity-60' : ''}>
        <CardContent className="p-5 space-y-4">
          {/* Header: avatar + name + role */}
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14 shrink-0">
              <AvatarImage src={collaborator.profile?.avatar_url || undefined} alt={collaborator.profile?.full_name || ''} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                {collaborator.profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{collaborator.profile?.full_name}</p>
              <p className="text-sm text-muted-foreground truncate">
                {(collaborator.profile as any)?.role_title || (isOwner ? 'Administrador' : 'Profissional')}
              </p>
              {collaborator.profile?.email && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{collaborator.profile.email}</p>
              )}
            </div>
          </div>

          {/* Indicators row — só para ativos e não ausentes */}
          {!isDisabled && !isAbsent && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Hoje</p>
                <p className="text-sm font-semibold flex items-center gap-1">
                  <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                  {todayCount} {todayCount === 1 ? 'atendimento' : 'atendimentos'}
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Próximo</p>
                <p className="text-sm font-semibold flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  {nextTime || '—'}
                </p>
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-1.5">
            {isOwner && (
              <Badge className="flex items-center gap-1 bg-amber-100 text-amber-800 border-amber-300">
                <Crown className="h-3 w-3" /> Administrador
              </Badge>
            )}
            <Badge variant="outline">
              {collaborator.collaborator_type === 'partner' ? 'Sócio' : collaborator.collaborator_type === 'independent' ? 'Independente' : 'Comissionado'}
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              {collaborator.commission_type === 'own_revenue' && <><Wallet className="h-3 w-3" /> Receita própria</>}
              {collaborator.commission_type === 'percentage' && <><Percent className="h-3 w-3" /> {paymentLabel(collaborator.commission_type, collaborator.commission_value)}</>}
              {collaborator.commission_type === 'fixed' && <><DollarSign className="h-3 w-3" /> {paymentLabel(collaborator.commission_type, collaborator.commission_value)}</>}
              {collaborator.commission_type === 'none' && paymentLabel(collaborator.commission_type, collaborator.commission_value)}
            </Badge>
            {!hasAccess && (
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                <Lock className="h-3 w-3" /> Sem acesso
              </Badge>
            )}
            {isDisabled && <Badge variant="destructive">Desabilitado</Badge>}
            {isAbsent && (
              <Badge variant="secondary" className="flex items-center gap-1 bg-amber-100 text-amber-800 border-amber-300">
                <CalendarOff className="h-3 w-3" /> {absenceTypeLabel((collaborator as any).absence_type)} até {(collaborator as any).absence_end}
              </Badge>
            )}
          </div>

          {/* Actions */}
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
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditDialog(collaborator)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => { setSelectedCollaborator(collaborator); setPanelOpen(true); }}
              >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" /> Agenda
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="px-2.5" aria-label="Mais opções">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {hasAccess && (
                    <>
                      <DropdownMenuLabel>Acesso</DropdownMenuLabel>
                      <DropdownMenuItem
                        disabled={loadingAction === `invite-${collaborator.id}`}
                        onClick={() => handleSendInvite(collaborator)}
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        {loadingAction === `invite-${collaborator.id}` ? 'Gerando...' : 'Enviar convite'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={loadingAction === `reset-${collaborator.id}`}
                        onClick={() => handleResetPassword(collaborator)}
                      >
                        <KeyRound className="mr-2 h-4 w-4" />
                        {loadingAction === `reset-${collaborator.id}` ? 'Enviando...' : 'Resetar senha'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {profileLink && (
                    <>
                      <DropdownMenuLabel>Página pública</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => window.open(profileLink, '_blank')}>
                        <ExternalLink className="mr-2 h-4 w-4" /> Abrir página
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(profileLink); toast.success('Link copiado!'); }}>
                        <Copy className="mr-2 h-4 w-4" /> Copiar link
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuLabel>Ausência</DropdownMenuLabel>
                  {isAbsent ? (
                    <DropdownMenuItem onClick={() => handleRemoveAbsence(collaborator)}>
                      <CalendarOff className="mr-2 h-4 w-4" /> Remover ausência
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => openAbsenceDialog(collaborator)}>
                      <CalendarOff className="mr-2 h-4 w-4" /> Definir ausência
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => { setDisableTarget(collaborator); setDisableDialogOpen(true); }}
                  >
                    <UserX className="mr-2 h-4 w-4" /> Desabilitar profissional
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const bookingModeLabel = (mode: string) => {
    if (mode === 'intelligent') return 'Inteligente';
    if (mode === 'fixed_grid') return 'Grade fixa';
    return 'Híbrida';
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
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {createdCredentials ? 'Profissional Criado!' : `Novo Profissional — Etapa ${wizardStep} de ${WIZARD_STEPS}`}
              </DialogTitle>
            </DialogHeader>

            {createdCredentials ? (() => {
              const loginUrl = `${window.location.origin}/auth`;
              const fullMessage = `🔐 *Acesso ao sistema*\n\n📎 Link de login: ${loginUrl}\n📧 Email: ${createdCredentials.email}\n🔑 Senha temporária: ${createdCredentials.password}\n\n📌 Link de agendamento:\n${createdCredentials.link}\n\n⚠️ Troque sua senha após o primeiro login.`;
              const whatsAppUrl = buildWhatsAppUrl('', fullMessage);
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
                  <Button variant="outline" className="flex-1" onClick={() => copyToClipboard(fullMessage, 'Dados de acesso')}>
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
                {/* Step indicators */}
                <div className="flex items-center gap-2 justify-center">
                  {Array.from({ length: WIZARD_STEPS }, (_, i) => i + 1).map((s) => (
                    <div key={s} className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-semibold ${s === wizardStep ? 'bg-primary text-primary-foreground' : s < wizardStep ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {s < wizardStep ? <Check className="h-4 w-4" /> : s}
                    </div>
                  ))}
                </div>

                {/* Step 1: Basic Info */}
                {wizardStep === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome *</Label>
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome completo" />
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
                      <Select value={form.payment_type} onValueChange={(value) => setForm({ ...form, payment_type: value as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="own_revenue">Receita própria</SelectItem>
                          <SelectItem value="percentage">Percentual</SelectItem>
                          <SelectItem value="fixed">Valor fixo</SelectItem>
                          <SelectItem value="none">Sem comissão</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.payment_type === 'own_revenue' && (
                        <p className="text-xs text-muted-foreground">100% da receita pertence ao profissional. Não entra no faturamento da empresa.</p>
                      )}
                    </div>
                    {form.payment_type === 'percentage' && (
                      <div className="space-y-2">
                        <Label>Comissão (%)</Label>
                        <Input type="number" value={form.commission_value} onChange={(e) => setForm({ ...form, commission_value: e.target.value })} placeholder="Ex: 10" />
                      </div>
                    )}
                    {form.payment_type === 'fixed' && (
                      <div className="space-y-2">
                        <Label>Valor por serviço (R$)</Label>
                        <Input type="number" step="0.01" value={form.commission_value} onChange={(e) => setForm({ ...form, commission_value: e.target.value })} placeholder="Ex: 25.00" />
                      </div>
                    )}
                    <Button className="w-full" onClick={() => {
                      if (!form.name.trim()) return toast.error('Preencha o nome');
                      setWizardStep(2);
                    }}>
                      Próximo <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Step 2: System Access */}
                {wizardStep === 2 && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Configure o acesso ao sistema para este profissional.</p>
                    
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="text-sm font-medium">Acesso ao sistema</p>
                        <p className="text-xs text-muted-foreground">O profissional terá login e painel próprio</p>
                      </div>
                      <Switch
                        checked={form.has_system_access}
                        onCheckedChange={(checked) => setForm({ ...form, has_system_access: checked, is_admin_self: checked ? form.is_admin_self : false })}
                      />
                    </div>

                    {form.has_system_access && (
                      <>
                        <div className="flex items-center gap-3 p-3 rounded-lg border">
                          <Checkbox
                            id="admin-self"
                            checked={form.is_admin_self}
                            onCheckedChange={(checked) => setForm({ ...form, is_admin_self: !!checked, email: !!checked ? '' : form.email })}
                          />
                          <div>
                            <Label htmlFor="admin-self" className="text-sm font-medium cursor-pointer">Este profissional sou eu (Administrador)</Label>
                            <p className="text-xs text-muted-foreground">Vincula ao seu login atual, sem criar nova conta</p>
                          </div>
                        </div>

                        {!form.is_admin_self && (
                          <div className="space-y-2">
                            <Label>Email de acesso *</Label>
                            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
                          </div>
                        )}
                      </>
                    )}

                    {!form.has_system_access && (
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">O profissional aparecerá na agenda e página pública, mas não terá login no sistema.</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setWizardStep(1)}>
                        <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                      </Button>
                      <Button className="flex-1" onClick={() => {
                        if (form.has_system_access && !form.is_admin_self && !form.email.trim()) {
                          return toast.error('Preencha o email de acesso');
                        }
                        setWizardStep(3);
                      }}>
                        Próximo <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 3: Schedule Config */}
                {wizardStep === 3 && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Configure como a agenda do profissional irá funcionar.</p>
                    
                     <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="text-sm font-medium">Usar padrão da empresa</p>
                        <p className="text-xs text-muted-foreground">Aplica as configurações de agenda da empresa</p>
                      </div>
                      <Switch
                        checked={form.schedule_from_company}
                        onCheckedChange={(checked) => setForm({ ...form, schedule_from_company: checked })}
                        disabled={!(company as any)?.prof_perm_booking_mode && !(company as any)?.prof_perm_grid_interval}
                      />
                    </div>

                    {!(company as any)?.prof_perm_booking_mode && !(company as any)?.prof_perm_grid_interval && (
                      <div className="p-3 rounded-lg bg-muted/50 border flex items-center gap-2 text-xs text-muted-foreground">
                        <Lock className="h-3 w-3 shrink-0" />
                        Configuração definida pela empresa. O administrador não liberou personalização.
                      </div>
                    )}

                    {!form.schedule_from_company && (
                      <>
                        {(company as any)?.prof_perm_booking_mode ? (
                          <div className="space-y-2">
                            <Label>Modo de agendamento</Label>
                            <Select value={form.booking_mode} onValueChange={(v) => setForm({ ...form, booking_mode: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="intelligent">
                                  <div className="flex flex-col items-start">
                                    <span>Inteligente</span>
                                    <span className="text-xs text-muted-foreground">Horários calculados dinamicamente</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="fixed_grid">
                                  <div className="flex flex-col items-start">
                                    <span>Grade fixa</span>
                                    <span className="text-xs text-muted-foreground">Intervalos fixos de horário</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="hybrid">
                                  <div className="flex flex-col items-start">
                                    <span>Híbrida (recomendado)</span>
                                    <span className="text-xs text-muted-foreground">Grade fixa com validação de duração</span>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className="p-3 rounded-lg bg-muted/50 border space-y-1">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Lock className="h-3 w-3" /> Gerenciado pelo administrador
                            </div>
                            <p className="text-sm">Modo: <span className="font-medium">{bookingModeLabel((company as any)?.booking_mode || 'fixed_grid')}</span></p>
                          </div>
                        )}
                        {(company as any)?.prof_perm_grid_interval ? (
                          (form.booking_mode === 'fixed_grid' || form.booking_mode === 'hybrid') && (
                            <div className="space-y-2">
                              <Label>Intervalo da grade (minutos)</Label>
                              <Select value={String(form.grid_interval)} onValueChange={(v) => setForm({ ...form, grid_interval: Number(v) })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="15">15 minutos</SelectItem>
                                  <SelectItem value="30">30 minutos</SelectItem>
                                  <SelectItem value="45">45 minutos</SelectItem>
                                  <SelectItem value="60">60 minutos</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )
                        ) : (
                          <div className="p-3 rounded-lg bg-muted/50 border space-y-1">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Lock className="h-3 w-3" /> Gerenciado pelo administrador
                            </div>
                            <p className="text-sm">Intervalo: <span className="font-medium">{(company as any)?.fixed_slot_interval || 15} minutos</span></p>
                          </div>
                        )}
                      </>
                    )}

                    <div className="space-y-2">
                      <Label>Intervalo entre atendimentos (minutos)</Label>
                      <Input type="number" min={0} max={60} value={form.break_time} onChange={(e) => setForm({ ...form, break_time: Number(e.target.value) || 0 })} placeholder="Ex: 5" />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setWizardStep(2)}>
                        <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                      </Button>
                      <Button className="flex-1" onClick={() => setWizardStep(4)}>
                        Próximo <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 4: Visual Config + Services */}
                {wizardStep === 4 && (
                  <div className="space-y-4">
                    <p className="text-sm font-medium">Configuração visual</p>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="text-sm font-medium">Capa do perfil</p>
                        <p className="text-xs text-muted-foreground">
                          {form.use_company_banner ? 'Usar banner da empresa' : 'Capa personalizada'}
                        </p>
                      </div>
                      <Switch
                        checked={!form.use_company_banner}
                        onCheckedChange={(checked) => setForm({ ...form, use_company_banner: !checked })}
                      />
                    </div>
                    {form.use_company_banner && (
                      <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 p-3">O profissional usará o banner da empresa no seu perfil público.</p>
                    )}
                    {!form.use_company_banner && (
                      <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 p-3">O profissional poderá definir uma capa personalizada no seu perfil.</p>
                    )}

                    <div className="border-t pt-4">
                      <p className="text-sm font-medium mb-2">Serviços</p>
                      <p className="text-xs text-muted-foreground mb-3">Selecione os serviços que este profissional realiza.</p>
                      {companyServices.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum serviço cadastrado. Você pode vincular depois.</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {companyServices.map((svc: any) => (
                            <label key={svc.id} className="flex items-center gap-3 p-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors">
                              <Checkbox
                                checked={form.selectedServiceIds.includes(svc.id)}
                                onCheckedChange={(checked) => {
                                  setForm(prev => ({
                                    ...prev,
                                    selectedServiceIds: checked
                                      ? [...prev.selectedServiceIds, svc.id]
                                      : prev.selectedServiceIds.filter(id => id !== svc.id),
                                  }));
                                }}
                              />
                              <div className="flex-1">
                                <p className="text-sm font-medium">{svc.name}</p>
                                <p className="text-xs text-muted-foreground">R$ {Number(svc.price).toFixed(2)} • {svc.duration_minutes} min</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setWizardStep(3)}>
                        <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                      </Button>
                      <Button className="flex-1" onClick={() => setWizardStep(5)}>
                        Próximo <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 5: Confirmation */}
                {wizardStep === 5 && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Revise os dados antes de confirmar.</p>
                    <div className="rounded-lg border bg-muted/50 p-4 space-y-3 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Nome</span><span className="font-medium">{form.name}</span></div>
                      {form.has_system_access && !form.is_admin_self && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{form.email}</span></div>
                      )}
                      {form.is_admin_self && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Vínculo</span><span className="font-medium text-primary">Administrador</span></div>
                      )}
                      {form.whatsapp && <div className="flex justify-between"><span className="text-muted-foreground">WhatsApp</span><span className="font-medium">{form.whatsapp}</span></div>}
                      <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><span className="font-medium">{form.collaborator_type === 'partner' ? 'Sócio' : form.collaborator_type === 'independent' ? 'Independente' : 'Comissionado'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Pagamento</span><span className="font-medium">{paymentLabel(form.payment_type, Number(form.commission_value) || 0)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Acesso</span><span className="font-medium">{form.has_system_access ? (form.is_admin_self ? 'Admin vinculado' : 'Com login') : 'Sem acesso'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Agenda</span><span className="font-medium">{form.schedule_from_company ? 'Padrão da empresa' : bookingModeLabel(form.booking_mode)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Capa</span><span className="font-medium">{form.use_company_banner ? 'Da empresa' : 'Personalizada'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Serviços</span><span className="font-medium">{form.selectedServiceIds.length > 0 ? `${form.selectedServiceIds.length} selecionado(s)` : 'Nenhum'}</span></div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setWizardStep(4)}>
                        <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                      </Button>
                      <Button className="flex-1" onClick={handleAdd}>
                        <Check className="mr-2 h-4 w-4" /> Confirmar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & filters */}
      {collaborators.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome ou email"
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 rounded-md p-0.5 text-muted-foreground hover:bg-muted"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {availableRoles.length > 0 && (
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="sm:w-[200px]">
                <SelectValue placeholder="Todos os cargos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os cargos</SelectItem>
                {availableRoles.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">Ativos ({filteredActive.length})</TabsTrigger>
          <TabsTrigger value="disabled">Desabilitados ({filteredDisabled.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {activeCollaborators.length === 0 ? (
            <div className="col-span-full py-16 text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-primary/60" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Nenhum profissional cadastrado</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                Adicione um profissional para começar a agendar clientes
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Adicionar profissional
              </Button>
            </div>
          ) : filteredActive.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Search className="mx-auto mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm">Nenhum profissional encontrado com os filtros atuais.</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => { setSearchQuery(''); setRoleFilter('all'); }}
              >
                Limpar filtros
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredActive.map((c) => renderCollaboratorCard(c, false))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="disabled">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredDisabled.map((c) => renderCollaboratorCard(c, true))}
            {filteredDisabled.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                <Users className="mx-auto mb-3 h-12 w-12 opacity-40" />
                <p>{disabledCollaborators.length === 0 ? 'Nenhum profissional desabilitado' : 'Nenhum resultado para os filtros atuais'}</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Professional Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
                  <SelectItem value="own_revenue">Receita própria</SelectItem>
                  <SelectItem value="percentage">Percentual</SelectItem>
                  <SelectItem value="fixed">Valor fixo</SelectItem>
                  <SelectItem value="none">Sem comissão</SelectItem>
                </SelectContent>
              </Select>
              {editForm.commission_type === 'own_revenue' && (
                <p className="text-xs text-muted-foreground">100% da receita pertence ao profissional.</p>
              )}
            </div>
            {editForm.commission_type === 'percentage' && (
              <div className="space-y-2">
                <Label>Comissão (%)</Label>
                <Input type="number" value={editForm.commission_value} onChange={(e) => setEditForm({ ...editForm, commission_value: e.target.value })} placeholder="Ex: 10" />
              </div>
            )}
            {editForm.commission_type === 'fixed' && (
              <div className="space-y-2">
                <Label>Valor por serviço (R$)</Label>
                <Input type="number" step="0.01" value={editForm.commission_value} onChange={(e) => setEditForm({ ...editForm, commission_value: e.target.value })} placeholder="Ex: 25.00" />
              </div>
            )}

            {/* Scheduling Configuration */}
            <div className="border-t pt-4 space-y-3">
              <Label className="font-semibold text-sm">Configuração de Agenda</Label>
              
              {/* Booking Mode */}
              {(company as any)?.prof_perm_booking_mode ? (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Modo de agendamento</Label>
                  <Select value={editForm.booking_mode} onValueChange={(v) => setEditForm({ ...editForm, booking_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intelligent">Inteligente</SelectItem>
                      <SelectItem value="fixed_grid">Grade fixa</SelectItem>
                      <SelectItem value="hybrid">Híbrida (recomendado)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-muted/50 border space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" /> Gerenciado pelo administrador
                  </div>
                  <p className="text-sm">Modo: <span className="font-medium">{bookingModeLabel((company as any)?.booking_mode || 'fixed_grid')}</span></p>
                </div>
              )}

              {/* Grid Interval */}
              {(editForm.booking_mode === 'fixed_grid' || editForm.booking_mode === 'hybrid' || (company as any)?.booking_mode === 'fixed_grid' || (company as any)?.booking_mode === 'hybrid') && (
                <>
                  {(company as any)?.prof_perm_grid_interval ? (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Intervalo da grade (minutos)</Label>
                      <Select value={String(editForm.grid_interval)} onValueChange={(v) => setEditForm({ ...editForm, grid_interval: Number(v) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 minutos</SelectItem>
                          <SelectItem value="30">30 minutos</SelectItem>
                          <SelectItem value="45">45 minutos</SelectItem>
                          <SelectItem value="60">60 minutos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-muted/50 border space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Lock className="h-3 w-3" /> Gerenciado pelo administrador
                      </div>
                      <p className="text-sm">Intervalo: <span className="font-medium">{(company as any)?.fixed_slot_interval || 15} minutos</span></p>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Intervalo entre atendimentos (minutos)</Label>
                <Input type="number" min={0} max={60} value={editForm.break_time} onChange={(e) => setEditForm({ ...editForm, break_time: Number(e.target.value) || 0 })} placeholder="Ex: 5" />
              </div>
            </div>

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
            const whatsAppUrl = buildWhatsAppUrl('', fullMessage);
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

      {/* Absence Dialog */}
      <Dialog open={absenceDialogOpen} onOpenChange={setAbsenceDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Definir Ausência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de ausência</Label>
              <Select value={absenceForm.absence_type} onValueChange={(v) => setAbsenceForm({ ...absenceForm, absence_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ferias">Férias</SelectItem>
                  <SelectItem value="folga">Folga</SelectItem>
                  <SelectItem value="recesso">Recesso</SelectItem>
                  <SelectItem value="ausente">Ausente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data de início</Label>
              <Input type="date" value={absenceForm.absence_start} onChange={(e) => setAbsenceForm({ ...absenceForm, absence_start: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Data de término</Label>
              <Input type="date" value={absenceForm.absence_end} onChange={(e) => setAbsenceForm({ ...absenceForm, absence_end: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setAbsenceDialogOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSaveAbsence}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Professional Panel */}
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

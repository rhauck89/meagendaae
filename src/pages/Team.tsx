import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
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
import { Plus, Users, Percent, DollarSign, Settings, Copy, ExternalLink, Mail, KeyRound, MessageCircle, Pencil, UserX, UserCheck, Trash2, CalendarOff, ChevronLeft, ChevronRight, Check, Clock, Wallet, Crown, Lock, MoreVertical, Calendar as CalendarIcon, Search, X, Briefcase, Globe, Link2, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { buildWhatsAppUrl, trackWhatsAppClick } from '@/lib/whatsapp';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { commissionLabel } from '@/lib/financial-engine';
import {
  BUSINESS_MODEL_LABELS,
  BUSINESS_MODEL_DESCRIPTIONS,
  RENT_CYCLE_LABELS,
  PARTNER_REVENUE_MODE_LABELS,
  deriveLegacyFields,
  formFromCollaborator,
  modelBadgeLabel,
  type BusinessModel,
  type BusinessModelForm,
  type PartnerRevenueMode,
  type RentCycle,
} from '@/lib/business-model';

const ROLE_TITLES = ['Barbeiro', 'Cabeleireira', 'Esteticista', 'Manicure', 'Recepcionista', 'Atendente', 'Gerente', 'Administrativo'];
const SYSTEM_ROLES = {
  admin_principal: { label: 'Admin Principal', icon: Crown, color: 'bg-amber-100 text-amber-800 border-amber-300' },
  admin: { label: 'Admin', icon: Shield, color: 'bg-blue-100 text-blue-800 border-blue-300' },
  admin_financeiro: { label: 'Admin Financeiro', icon: DollarSign, color: 'bg-green-100 text-green-800 border-green-300' },
  manager: { label: 'Gerente', icon: Briefcase, color: 'bg-purple-100 text-purple-800 border-purple-300' },
  receptionist: { label: 'Recepcionista', icon: Users, color: 'bg-orange-100 text-orange-800 border-orange-300' },
  administrative: { label: 'Administrativo', icon: Briefcase, color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  collaborator: { label: 'Profissional', icon: Users, color: 'bg-slate-100 text-slate-800 border-slate-300' },
};

const PERMISSION_PRESETS: Record<string, any> = {
  admin: {
    agenda: { view: true, create: true, edit: true, delete: true },
    services: { view: true, create: true, edit: true, delete: true },
    team: { view: true, create: true, edit: true, delete: true },
    clients: { view: true, create: true, edit: true, delete: true },
    whatsapp: { view: true },
    subscriptions: { view: true, create: true, edit: true, delete: true },
    events: { view: true, create: true, edit: true, delete: true },
    promotions: { view: true, create: true, edit: true, delete: true },
    loyalty: { view: true, create: true, edit: true, delete: true },
    requests: { view: true, create: true, edit: true, delete: true },
    finance: { view: true, create: true, edit: true, delete: true, view_values: true },
    settings: { view: true, edit: true },
    reports: { view: true }
  },
  manager: {
    agenda: { view: true, create: true, edit: true, delete: true },
    services: { view: true, create: true, edit: true, delete: true },
    team: { view: true, create: true, edit: true, delete: false },
    clients: { view: true, create: true, edit: true, delete: true },
    whatsapp: { view: true },
    subscriptions: { view: true, create: true, edit: true, delete: false },
    events: { view: true, create: true, edit: true, delete: true },
    promotions: { view: true, create: true, edit: true, delete: true },
    loyalty: { view: true, create: true, edit: true, delete: true },
    requests: { view: true, create: true, edit: true, delete: true },
    finance: { view: true, create: false, edit: false, delete: false, view_values: true },
    settings: { view: true, edit: false },
    reports: { view: true }
  },
  receptionist: {
    agenda: { view: true, create: true, edit: true, delete: false },
    services: { view: true, create: false, edit: false, delete: false },
    team: { view: true, create: false, edit: false, delete: false },
    clients: { view: true, create: true, edit: true, delete: false },
    whatsapp: { view: true },
    subscriptions: { view: false },
    events: { view: true, create: true, edit: true, delete: false },
    promotions: { view: true },
    loyalty: { view: true },
    requests: { view: true, create: true, edit: true, delete: false },
    finance: { view: false },
    settings: { view: false },
    reports: { view: false }
  },
  collaborator: {
    agenda: { view: true, create: false, edit: false, delete: false },
    services: { view: false },
    team: { view: false },
    clients: { view: true, create: false, edit: false, delete: false },
    whatsapp: { view: false },
    subscriptions: { view: false },
    events: { view: false },
    promotions: { view: false },
    loyalty: { view: false },
    requests: { view: true },
    finance: { view: false },
    settings: { view: false },
    reports: { view: false }
  }
};

const SYSTEM_ROLE_PRESETS: Record<string, any> = {
  admin: PERMISSION_PRESETS.admin,
  manager: PERMISSION_PRESETS.manager,
  receptionist: PERMISSION_PRESETS.receptionist,
  attendant: PERMISSION_PRESETS.receptionist,
  atendente: PERMISSION_PRESETS.receptionist,
  administrative: PERMISSION_PRESETS.admin,
  collaborator: PERMISSION_PRESETS.collaborator
};
const WIZARD_STEPS = 5;

const PAYMENT_METHOD_OPTIONS = [
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'outro', label: 'Outro' },
];

const NON_PROVIDER_SYSTEM_ROLES = ['receptionist', 'manager', 'administrative', 'admin', 'admin_financeiro', 'atendente'];
const isNonProviderSystemRole = (role?: string | null) => Boolean(role && (NON_PROVIDER_SYSTEM_ROLES.includes(role) || role === 'attendant'));

const PERMISSION_MODULE_LABELS: Record<string, string> = {
  agenda: 'Agenda',
  services: 'Serviços',
  team: 'Equipe',
  clients: 'Clientes',
  whatsapp: 'WhatsApp Center',
  subscriptions: 'Assinaturas',
  events: 'Agenda Aberta',
  promotions: 'Promoções',
  loyalty: 'Fidelidade',
  requests: 'Solicitações',
  finance: 'Financeiro',
  settings: 'Configurações',
  reports: 'Relatórios',
};

const Team = () => {
  const { companyId, user } = useAuth();
  const queryClient = useQueryClient();
  const { refresh } = useRefreshData();
  const [dialogOpen, setDialogOpen] = useState(false);
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
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    collaborator_type: 'commissioned' as string,
    commission_type: 'percentage' as string,
    commission_value: '' as string | number,
    booking_mode: 'hybrid' as string,
    grid_interval: 15 as number,
    break_time: 0 as number,
    use_company_banner: true as boolean,
    is_service_provider: true,
    salary_amount: '',
    salary_payment_day: '',
    salary_next_due_date: '',
    salary_recurrence: 'monthly',
    salary_payment_method: 'pix',
    salary_auto_expense: false,
    system_role: 'collaborator',
    permissions: PERMISSION_PRESETS.collaborator as any,
  });
  // New unified business model form
  const [editBM, setEditBM] = useState<BusinessModelForm>({
    business_model: 'employee',
    commission_type: 'percentage',
    commission_value: 0,
    partner_revenue_mode: null,
    partner_equity_percent: 0,
    rent_amount: 0,
    rent_cycle: 'monthly',
  });
  // Edit dialog: services & public page (single source of truth)
  const [editAssignedServiceIds, setEditAssignedServiceIds] = useState<string[]>([]);
  const [editServiceSearch, setEditServiceSearch] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editSlugDirty, setEditSlugDirty] = useState(false);

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

  // Unified business model form for the create wizard
  const [wizardBM, setWizardBM] = useState<BusinessModelForm>({
    business_model: 'employee',
    commission_type: 'percentage',
    commission_value: 0,
    partner_revenue_mode: null,
    partner_equity_percent: 0,
    rent_amount: 0,
    rent_cycle: 'monthly',
  });

  const [form, setForm] = useState({
    name: '',
    email: '',
    whatsapp: '',
    role_title: 'Barbeiro',
    booking_mode: 'hybrid' as string,
    grid_interval: 15 as number,
    break_time: 0 as number,
    selectedServiceIds: [] as string[],
    has_system_access: true,
    is_admin_self: false,
    use_company_banner: true,
    schedule_from_company: true,
    system_role: 'collaborator' as string,
    is_service_provider: true,
    permissions: PERMISSION_PRESETS.collaborator as any,
    salary_amount: '',
    salary_payment_day: '',
    salary_next_due_date: '',
    salary_recurrence: 'monthly',
    salary_payment_method: 'pix',
    salary_auto_expense: false,
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

  // Remove auto-selection of services to respect the "unselected by default" rule
  // We keep the wizardStep condition if we needed any other initialization, 
  // but for services, we want it empty by default for new professionals.


  const teamQueryKey = ['collaborators', companyId];

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('slug, business_type, booking_mode, fixed_slot_interval, user_id, prof_perm_booking_mode, prof_perm_grid_interval')
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
      console.log('[TEAM] Fetching collaborators for company:', companyId);
      // Separation of concerns: Fetch collaborators first to avoid profile join issues
      const { data: colabs, error: colabsError } = await supabase
        .from('collaborators')
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at');

      if (colabsError) {
        console.error('[TEAM] Error fetching collaborators:', colabsError);
        throw colabsError;
      }

      if (!colabs || colabs.length === 0) {
        console.log('[TEAM] No collaborators found');
        return [];
      }

      // Fetch profiles separately for these collaborators
      const profileIds = colabs.map(c => c.profile_id).filter(Boolean);
      console.log('[TEAM] Fetching profiles for IDs:', profileIds.length);
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', profileIds);

      if (profilesError) {
        console.warn('[TEAM] Warning fetching profiles:', profilesError);
      }

      // Merge data
      const enriched = colabs.map(c => ({
        ...c,
        profile: profiles?.find(p => p.id === c.profile_id) || null
      }));

      console.log('[TEAM] Collaborators processed:', enriched.length);
      return enriched;
    },
  });

  const activeCollaborators = collaborators.filter((c) => c.active !== false);
  const disabledCollaborators = collaborators.filter((c) => c.active === false);

  // Aggregated appointments query — fetch today's appointments for all professionals at once
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const professionalIds = collaborators
    .filter((c) => c.is_service_provider !== false)
    .map((c) => c.profile_id)
    .filter(Boolean);

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
      booking_mode: 'hybrid',
      grid_interval: 15,
      break_time: 0,
      selectedServiceIds: [],
      has_system_access: true,
      is_admin_self: false,
      use_company_banner: true,
      schedule_from_company: true,
      system_role: 'collaborator',
      is_service_provider: true,
      permissions: PERMISSION_PRESETS.collaborator,
      salary_amount: '',
      salary_payment_day: '',
      salary_next_due_date: '',
      salary_recurrence: 'monthly',
      salary_payment_method: 'pix',
      salary_auto_expense: false,
    });
    setWizardBM({
      business_model: 'employee',
      commission_type: 'percentage',
      commission_value: 0,
      partner_revenue_mode: null,
      partner_equity_percent: 0,
      rent_amount: 0,
      rent_cycle: 'monthly',
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

  const applyServiceProviderMode = (isServiceProvider: boolean) => {
    setForm((prev) => ({
      ...prev,
      is_service_provider: isServiceProvider,
      selectedServiceIds: isServiceProvider ? prev.selectedServiceIds : [],
      system_role: isServiceProvider ? 'collaborator' : (prev.system_role === 'collaborator' ? 'receptionist' : prev.system_role),
      permissions: isServiceProvider
        ? PERMISSION_PRESETS.collaborator
        : (prev.system_role === 'collaborator' ? PERMISSION_PRESETS.receptionist : prev.permissions),
    }));
  };

  const handleSystemRoleChange = (role: string) => {
    const isProviderRole = role === 'collaborator';
    setForm((prev) => ({
      ...prev,
      system_role: role,
      is_service_provider: isProviderRole,
      selectedServiceIds: isProviderRole ? prev.selectedServiceIds : [],
      permissions: PERMISSION_PRESETS[role] || prev.permissions,
    }));
  };

  const buildSalaryPayload = () => ({
    salary_amount: Number(form.salary_amount) || 0,
    salary_payment_day: form.salary_payment_day ? Number(form.salary_payment_day) : null,
    salary_next_due_date: form.salary_next_due_date || null,
    salary_recurrence: form.salary_recurrence,
    salary_payment_method: form.salary_payment_method || null,
    salary_auto_expense: form.salary_auto_expense,
  });

  const ensureSalaryExpense = async ({
    profileId,
    memberName,
    amount,
    dueDate,
    recurrence,
    paymentMethod,
  }: {
    profileId: string;
    memberName: string;
    amount: number;
    dueDate?: string | null;
    recurrence: string;
    paymentMethod?: string | null;
  }) => {
    if (!companyId || !profileId || amount <= 0) return;

    let { data: category, error: categoryError } = await supabase
      .from('company_expense_categories')
      .select('id')
      .eq('company_id', companyId)
      .in('name', ['Salário', 'Salários', 'Salarios'])
      .limit(1)
      .maybeSingle();

    if (categoryError) throw categoryError;

    if (!category) {
      const { data: newCategory, error: newCategoryError } = await supabase
        .from('company_expense_categories')
        .insert({
          company_id: companyId,
          name: 'Salários',
          type: 'expense',
          description: 'Despesas de salário e pagamentos fixos da equipe',
        })
        .select('id')
        .single();

      if (newCategoryError) throw newCategoryError;
      category = newCategory;
    }

    const expenseDate = dueDate || new Date().toISOString().slice(0, 10);
    const sourceToken = `salary_profile_id:${profileId}`;
    const notes = `Despesa gerada automaticamente pelo cadastro de membro da equipe. Recorrência: ${recurrence || 'monthly'}. ${sourceToken}`;

    const { data: existingExpense, error: existingError } = await supabase
      .from('company_expenses')
      .select('id')
      .eq('company_id', companyId)
      .ilike('notes', `%${sourceToken}%`)
      .maybeSingle();

    if (existingError) throw existingError;

    const payload = {
      company_id: companyId,
      description: `Salário - ${memberName}`,
      amount,
      expense_date: expenseDate,
      due_date: expenseDate,
      status: 'pending',
      category_id: category?.id,
      is_recurring: recurrence !== 'none',
      recurrence_type: recurrence === 'weekly' ? 'weekly' : 'monthly',
      recurrence_interval: recurrence === 'biweekly' ? 2 : 1,
      notes,
      created_by: user?.id || null,
      payment_method: paymentMethod || null,
    };

    if (existingExpense?.id) {
      const { error } = await supabase.from('company_expenses').update(payload as any).eq('id', existingExpense.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('company_expenses').insert(payload as any);
      if (error) throw error;
    }

    await Promise.all([
      supabase.from('collaborators').update({ salary_expense_category_id: category?.id } as any).eq('company_id', companyId).eq('profile_id', profileId),
      supabase.from('company_collaborators').update({ salary_expense_category_id: category?.id } as any).eq('company_id', companyId).eq('profile_id', profileId),
    ]);
  };

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

    setLoadingAction('creating');
    try {
      const tempPassword = `${crypto.randomUUID().slice(0, 8)}A1!`;
      const professionalSlug = generateSlug(form.name);

      const bookingMode = form.schedule_from_company ? (company?.booking_mode || 'hybrid') : form.booking_mode;
      const gridInterval = form.schedule_from_company ? (company?.fixed_slot_interval || 15) : form.grid_interval;

      const legacy = deriveLegacyFields(wizardBM);
      const paymentType = form.is_service_provider ? legacy.commission_type : 'none';

      const response = await supabase.functions.invoke('create-collaborator', {
        body: {
          name: form.name.trim(),
          email: form.is_admin_self ? (user?.email || '') : form.email.trim(),
          whatsapp: form.whatsapp.trim() || null,
          company_id: companyId,
          collaborator_type: form.is_service_provider ? legacy.collaborator_type : 'commissioned',
          payment_type: paymentType,
          commission_value: form.is_service_provider ? legacy.commission_value : 0,
          business_model: form.is_service_provider ? wizardBM.business_model : 'employee',
          partner_revenue_mode: form.is_service_provider ? wizardBM.partner_revenue_mode : null,
          partner_equity_percent: form.is_service_provider ? (wizardBM.partner_equity_percent || 0) : 0,
          rent_amount: form.is_service_provider ? (wizardBM.rent_amount || 0) : 0,
          rent_cycle: form.is_service_provider ? wizardBM.rent_cycle : 'monthly',
          role: 'collaborator',
          role_title: form.role_title,
          slug: professionalSlug,
          temp_password: tempPassword,
          booking_mode: bookingMode,
          grid_interval: gridInterval,
          break_time: form.break_time,
          service_ids: form.is_service_provider ? form.selectedServiceIds : [],
          has_system_access: form.has_system_access,
          is_admin_self: form.is_admin_self,
          system_role: form.is_admin_self ? 'admin_principal' : form.system_role,
          use_company_banner: form.use_company_banner,
          is_service_provider: form.is_service_provider,
          permissions: form.permissions,
          ...buildSalaryPayload(),
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao criar colaborador');
      }

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Erro ao criar colaborador');
      }

      const createdProfileId = response.data?.collaborator?.profile_id;
      if (!form.is_service_provider && form.salary_auto_expense && Number(form.salary_amount) > 0 && createdProfileId) {
        await ensureSalaryExpense({
          profileId: createdProfileId,
          memberName: form.name.trim(),
          amount: Number(form.salary_amount) || 0,
          dueDate: form.salary_next_due_date || null,
          recurrence: form.salary_recurrence,
          paymentMethod: form.salary_payment_method,
        });
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
      console.error('[TEAM] Error adding collaborator:', err);
      toast.error(err.message || 'Erro ao criar colaborador');
    } finally {
      setLoadingAction(null);
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
    setEditBM(formFromCollaborator(collaborator));

      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success) throw new Error(response.data?.error || 'Erro ao resetar senha');

      toast.success('Email de redefinição de senha enviado!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao resetar senha');
    } finally {
      setLoadingAction(null);
    }
  };

  const openEditDialog = async (collaborator: any) => {
    const systemRole = collaborator.system_role || (collaborator.is_service_provider === false ? 'receptionist' : 'collaborator');
    const mustBeAdministrative = isNonProviderSystemRole(systemRole);
    const isServiceProvider = mustBeAdministrative ? false : collaborator.is_service_provider !== false;
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
      use_company_banner: (collaborator as any).use_company_banner ?? true,
      is_service_provider: isServiceProvider,
      salary_amount: (collaborator as any).salary_amount ? String((collaborator as any).salary_amount) : '',
      salary_payment_day: (collaborator as any).salary_payment_day ? String((collaborator as any).salary_payment_day) : '',
      salary_next_due_date: (collaborator as any).salary_next_due_date || '',
      salary_recurrence: (collaborator as any).salary_recurrence || 'monthly',
      salary_payment_method: (collaborator as any).salary_payment_method || 'pix',
      salary_auto_expense: (collaborator as any).salary_auto_expense || false,
      system_role: systemRole,
      permissions: collaborator.permissions && Object.keys(collaborator.permissions).length > 0
        ? collaborator.permissions
        : (PERMISSION_PRESETS[systemRole] || PERMISSION_PRESETS.receptionist),
    });
    setEditServiceSearch('');
    setEditSlugDirty(false);
    setEditSlug(collaborator.slug || generateSlug(collaborator.profile?.full_name || ''));
    setEditAssignedServiceIds([]);
    setEditDialogOpen(true);
    // Load assigned services only for service providers
    try {
      if (!isServiceProvider) return;
      const { data } = await supabase
        .from('service_professionals')
        .select('service_id')
        .eq('professional_id', collaborator.profile_id);
      setEditAssignedServiceIds((data || []).map((r: any) => r.service_id));
    } catch {
      // silent — fallback to empty
    }
  };

  const toggleEditService = async (serviceId: string, checked: boolean) => {
    if (!editTarget) return;
    const profileId = editTarget.profile_id;
    try {
      if (checked) {
        await supabase.from('service_professionals').insert({
          service_id: serviceId,
          professional_id: profileId,
          company_id: companyId,
        } as any);
        setEditAssignedServiceIds((prev) => [...prev, serviceId]);
      } else {
        await supabase
          .from('service_professionals')
          .delete()
          .eq('service_id', serviceId)
          .eq('professional_id', profileId);
        setEditAssignedServiceIds((prev) => prev.filter((id) => id !== serviceId));
      }
    } catch (e: any) {
      toast.error('Erro ao atualizar serviço');
    }
  };

  const saveEditSlug = async () => {
    if (!editTarget) return;
    const cleanSlug = editSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/(^-|-$)/g, '');
    if (!cleanSlug) return toast.error('Identificador inválido');
    try {
      await supabase.from('collaborators').update({ slug: cleanSlug } as any).eq('id', editTarget.id);
      setEditSlug(cleanSlug);
      setEditSlugDirty(false);
      toast.success('Link atualizado');
      await refreshTeam();
    } catch (e: any) {
      toast.error('Erro ao salvar identificador');
    }
  };

  const editPublicLink = (() => {
    if (!editTarget || !company || !editSlug) return '';
    const prefix = company.business_type === 'esthetic' ? 'estetica' : 'barbearia';
    return `${window.location.origin}/${prefix}/${company.slug}/${editSlug}`;
  })();

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    if (!editForm.name.trim()) return toast.error('Nome é obrigatório');

    try {
      await supabase
        .from('profiles')
        .update({ full_name: editForm.name.trim(), email: editForm.email.trim() })
        .eq('id', editTarget.profile_id);

      // Derive legacy fields from the unified business model so the
      // financial engine and reports keep working unchanged.
      const legacy = deriveLegacyFields(editBM);
      const editIsProvider = !isNonProviderSystemRole(editForm.system_role) && editForm.is_service_provider !== false;
      const updateData: any = {
        business_model: editIsProvider ? editBM.business_model : 'employee',
        partner_revenue_mode: editIsProvider ? editBM.partner_revenue_mode : null,
        partner_equity_percent: editIsProvider ? (editBM.partner_equity_percent || 0) : 0,
        rent_amount: editIsProvider ? (editBM.rent_amount || 0) : 0,
        rent_cycle: editIsProvider ? editBM.rent_cycle : 'monthly',
        collaborator_type: editIsProvider ? (legacy.collaborator_type as any) : 'commissioned',
        commission_type: editIsProvider ? (legacy.commission_type as any) : 'none',
        commission_value: editIsProvider ? legacy.commission_value : 0,
        break_time: editForm.break_time,
        use_company_banner: editForm.use_company_banner,
        system_role: editForm.system_role,
        permissions: editForm.permissions,
        is_service_provider: editIsProvider,
        salary_amount: editIsProvider ? 0 : (Number(editForm.salary_amount) || 0),
        salary_payment_day: !editIsProvider && editForm.salary_payment_day ? Number(editForm.salary_payment_day) : null,
        salary_next_due_date: !editIsProvider && editForm.salary_next_due_date ? editForm.salary_next_due_date : null,
        salary_recurrence: editIsProvider ? 'none' : editForm.salary_recurrence,
        salary_payment_method: editIsProvider ? null : editForm.salary_payment_method,
        salary_auto_expense: !editIsProvider && editForm.salary_auto_expense,
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

      await supabase
        .from('company_collaborators')
        .update({
          is_service_provider: editIsProvider,
          permissions: editForm.permissions,
          salary_amount: updateData.salary_amount,
          salary_payment_day: updateData.salary_payment_day,
          salary_next_due_date: updateData.salary_next_due_date,
          salary_recurrence: updateData.salary_recurrence,
          salary_payment_method: updateData.salary_payment_method,
          salary_auto_expense: updateData.salary_auto_expense,
        } as any)
        .eq('company_id', companyId!)
        .eq('profile_id', editTarget.profile_id);

      if (!editIsProvider && updateData.salary_auto_expense && Number(updateData.salary_amount) > 0) {
        await ensureSalaryExpense({
          profileId: editTarget.profile_id,
          memberName: editForm.name.trim(),
          amount: Number(updateData.salary_amount) || 0,
          dueDate: updateData.salary_next_due_date,
          recurrence: updateData.salary_recurrence,
          paymentMethod: updateData.salary_payment_method,
        });
      }

      if (!editIsProvider) {
        await supabase
          .from('service_professionals')
          .delete()
          .eq('professional_id', editTarget.profile_id);
      }

      toast.success(editIsProvider ? 'Profissional atualizado!' : 'Membro atualizado!');
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
    const isOwner = collaborator.profile?.user_id === company?.user_id;
    const agg = (appointmentsAgg as any)[collaborator.profile_id] as { todayCount: number; next: string | null } | undefined;
    const todayCount = agg?.todayCount ?? 0;
    const nextTime = agg?.next
      ? new Date(agg.next).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : null;
    const statusLabel = isDisabled ? 'Desabilitado' : isAbsent ? 'Ausente' : 'Ativo';
    const actionsMenu = (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Mais opções">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {isDisabled ? (
            <>
              <DropdownMenuItem onClick={() => handleEnable(collaborator)}>
                <UserCheck className="mr-2 h-4 w-4" /> Reabilitar
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => handleDeleteAttempt(collaborator)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </DropdownMenuItem>
            </>
          ) : (
            <>
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
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
    return (
      <Card key={collaborator.id} className={`overflow-hidden border-border/70 bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${isDisabled ? 'opacity-70' : ''}`}>
        <CardContent className="p-0">
          <div className="grid gap-0 lg:grid-cols-[minmax(260px,1.45fr)_minmax(130px,0.75fr)_minmax(130px,0.75fr)_minmax(220px,1.1fr)_minmax(190px,0.9fr)]">
            <div className="flex min-w-0 items-center gap-4 p-4 sm:p-5">
              <Avatar className="h-16 w-16 shrink-0 ring-2 ring-primary/10">
                <AvatarImage src={collaborator.profile?.avatar_url || undefined} alt={collaborator.profile?.full_name || ''} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                  {collaborator.profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground">{collaborator.profile?.full_name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {(collaborator.profile as any)?.role_title || (isOwner ? 'Administrador' : 'Profissional')}
                </p>
                {collaborator.profile?.email && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{collaborator.profile.email}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 border-t px-4 py-3 sm:px-5 lg:border-l lg:border-t-0">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Hoje</p>
                <p className="text-lg font-semibold leading-tight">{todayCount}</p>
                <p className="text-xs text-muted-foreground">{todayCount === 1 ? 'atendimento' : 'atendimentos'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t px-4 py-3 sm:px-5 lg:border-l lg:border-t-0">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Próximo</p>
                <p className="text-lg font-semibold leading-tight">{!isDisabled && !isAbsent ? (nextTime || 'Sem horário') : 'Sem horário'}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3 sm:px-5 lg:border-l lg:border-t-0">
              {hasAccess && (collaborator as any).system_role && SYSTEM_ROLES[(collaborator as any).system_role as keyof typeof SYSTEM_ROLES] && (
                <Badge className={`flex items-center gap-1 rounded-full px-3 py-1 ${(SYSTEM_ROLES as any)[(collaborator as any).system_role].color}`}>
                  {(() => {
                    const RoleIcon = (SYSTEM_ROLES as any)[(collaborator as any).system_role].icon;
                    return <RoleIcon className="h-3 w-3" />;
                  })()}
                  {(SYSTEM_ROLES as any)[(collaborator as any).system_role].label}
                </Badge>
              )}
              <Badge variant="outline" className="flex items-center gap-1 rounded-full px-3 py-1">
                <Briefcase className="h-3 w-3" /> {modelBadgeLabel(collaborator)}
              </Badge>
              {!hasAccess && (
                <Badge variant="outline" className="flex items-center gap-1 rounded-full px-3 py-1 text-xs">
                  <Lock className="h-3 w-3" /> Sem acesso
                </Badge>
              )}
              {isAbsent && (
                <Badge variant="secondary" className="flex items-center gap-1 rounded-full border-amber-300 bg-amber-100 px-3 py-1 text-amber-800">
                  <CalendarOff className="h-3 w-3" /> {absenceTypeLabel((collaborator as any).absence_type)} até {(collaborator as any).absence_end}
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-5 lg:border-l lg:border-t-0">
              <div className="flex items-center gap-3">
                <Switch
                  checked={!isDisabled}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      handleEnable(collaborator);
                    } else {
                      setDisableTarget(collaborator);
                      setDisableDialogOpen(true);
                    }
                  }}
                />
                <div className="flex items-center gap-2 text-sm">
                  <span className={`h-2.5 w-2.5 rounded-full ${isDisabled ? 'bg-destructive' : isAbsent ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <span className={isDisabled ? 'text-destructive' : isAbsent ? 'text-amber-700' : 'text-emerald-700'}>{statusLabel}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openEditDialog(collaborator)} aria-label="Editar profissional">
                  <Pencil className="h-4 w-4" />
                </Button>
                {actionsMenu}
              </div>
            </div>
          </div>
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
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-display font-bold">Equipe</h2>
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
            <Button className="w-full sm:w-auto">
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
              const fullMessage = `” *Acesso ao sistema*\n\n“Ž Link de login: ${loginUrl}\n“§ Email: ${createdCredentials.email}\n”‘ Senha temporária: ${createdCredentials.password}\n\n“Œ Link de agendamento:\n${createdCredentials.link}\n\nâš ï¸ Troque sua senha após o primeiro login.`;
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
                    <a href={whatsAppUrl} onClick={() => trackWhatsAppClick('team-invite')} target="_blank" rel="noopener noreferrer">
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

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Tipo de membro</Label>
                        <Select
                          value={form.system_role}
                          onValueChange={handleSystemRoleChange}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(SYSTEM_ROLES)
                              .filter(([key]) => key !== 'admin_principal')
                              .map(([key, role]) => (
                                <SelectItem key={key} value={key}>
                                  <div className="flex items-center gap-2">
                                    <role.icon className="h-4 w-4" />
                                    {role.label}
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="text-sm font-medium">Este membro presta serviços?</p>
                          <p className="text-xs text-muted-foreground">Habilita agenda, serviços e comissões</p>
                        </div>
                        <Switch
                          checked={form.is_service_provider}
                          onCheckedChange={(checked) => applyServiceProviderMode(Boolean(checked))}
                        />
                      </div>
                    </div>

                    {!form.is_service_provider && (
                      <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
                        <div>
                          <Label className="text-sm font-medium">Pagamento fixo do membro</Label>
                          <p className="text-xs text-muted-foreground">
                            Use para recepcionistas, atendentes, gerentes ou administrativos. Isso não altera o painel do profissional prestador.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-xs">Valor do salário/pagamento (R$)</Label>
                            <Input type="number" step="0.01" min="0" value={form.salary_amount} onChange={(e) => setForm({ ...form, salary_amount: e.target.value })} placeholder="Ex: 1800.00" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Dia de vencimento</Label>
                            <Input type="number" min="1" max="31" value={form.salary_payment_day} onChange={(e) => setForm({ ...form, salary_payment_day: e.target.value })} placeholder="Ex: 5" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Próximo vencimento</Label>
                            <Input type="date" value={form.salary_next_due_date} onChange={(e) => setForm({ ...form, salary_next_due_date: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Repetição</Label>
                            <Select value={form.salary_recurrence} onValueChange={(v) => setForm({ ...form, salary_recurrence: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sem repetição</SelectItem>
                                <SelectItem value="weekly">Semanal</SelectItem>
                                <SelectItem value="biweekly">Quinzenal</SelectItem>
                                <SelectItem value="monthly">Mensal</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-xs">Forma de pagamento</Label>
                            <Select value={form.salary_payment_method} onValueChange={(v) => setForm({ ...form, salary_payment_method: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {PAYMENT_METHOD_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border bg-background p-3">
                          <div>
                            <p className="text-sm font-medium">Enviar para despesas</p>
                            <p className="text-xs text-muted-foreground">Cria uma despesa pendente na categoria Salários após confirmar o cadastro.</p>
                          </div>
                          <Switch checked={form.salary_auto_expense} onCheckedChange={(checked) => setForm({ ...form, salary_auto_expense: Boolean(checked) })} />
                        </div>
                      </div>
                    )}

                    {form.is_service_provider && (
                      <>
                        <div className="space-y-2">
                          <Label>💰 Modelo Comercial</Label>
                          <Select
                            value={wizardBM.business_model}
                            onValueChange={(v) => setWizardBM({ ...wizardBM, business_model: v as BusinessModel })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(Object.keys(BUSINESS_MODEL_LABELS) as BusinessModel[]).map((bm) => (
                                <SelectItem key={bm} value={bm}>{BUSINESS_MODEL_LABELS[bm]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                            {BUSINESS_MODEL_DESCRIPTIONS[wizardBM.business_model]}
                          </div>
                        </div>

                        {wizardBM.business_model === 'employee' && (
                          <div className="space-y-3 rounded-lg border p-4">
                            <Label className="text-sm font-medium">Como ele é remunerado?</Label>
                            <Select
                              value={wizardBM.commission_type}
                              onValueChange={(v) => setWizardBM({ ...wizardBM, commission_type: v as any })}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Salário fixo (controlado fora do sistema)</SelectItem>
                                <SelectItem value="percentage">Comissão %</SelectItem>
                                <SelectItem value="fixed">Valor fixo por serviço</SelectItem>
                              </SelectContent>
                            </Select>
                            {wizardBM.commission_type === 'percentage' && (
                              <div className="space-y-2">
                                <Label className="text-xs">Comissão do profissional (%)</Label>
                                <Input
                                  type="number"
                                  value={wizardBM.commission_value || ''}
                                  onChange={(e) => setWizardBM({ ...wizardBM, commission_value: Number(e.target.value) || 0 })}
                                  placeholder="Ex: 30"
                                />
                              </div>
                            )}
                            {wizardBM.commission_type === 'fixed' && (
                              <div className="space-y-2">
                                <Label className="text-xs">Valor por serviço (R$)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={wizardBM.commission_value || ''}
                                  onChange={(e) => setWizardBM({ ...wizardBM, commission_value: Number(e.target.value) || 0 })}
                                  placeholder="Ex: 25.00"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {/* Parceiro com comissão */}
                    {wizardBM.business_model === 'partner_commission' && (
                      <div className="space-y-3 rounded-lg border p-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">% do profissional</Label>
                          <Input
                            type="number"
                            value={wizardBM.commission_value || ''}
                            onChange={(e) => setWizardBM({ ...wizardBM, commission_value: Number(e.target.value) || 0 })}
                            placeholder="Ex: 60"
                          />
                          <p className="text-xs text-muted-foreground">
                            A empresa fica com {Math.max(0, 100 - (Number(wizardBM.commission_value) || 0))}% de cada atendimento.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Aluguel de cadeira */}
                    {wizardBM.business_model === 'chair_rental' && (
                      <div className="space-y-3 rounded-lg border p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Periodicidade</Label>
                            <Select
                              value={wizardBM.rent_cycle || 'monthly'}
                              onValueChange={(v) => setWizardBM({ ...wizardBM, rent_cycle: v as RentCycle })}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(Object.keys(RENT_CYCLE_LABELS) as RentCycle[]).map((c) => (
                                  <SelectItem key={c} value={c}>{RENT_CYCLE_LABELS[c]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Valor do aluguel (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={wizardBM.rent_amount || ''}
                              onChange={(e) => setWizardBM({ ...wizardBM, rent_amount: Number(e.target.value) || 0 })}
                              placeholder="Ex: 800.00"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          A receita dos serviços fica 100% com o profissional. O aluguel deve ser lançado manualmente em Contas a Receber.
                        </p>
                      </div>
                    )}

                    {/* Sócio Investidor */}
                    {wizardBM.business_model === 'investor_partner' && (
                      <div className="space-y-3 rounded-lg border p-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">% de participação societária</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={wizardBM.partner_equity_percent || ''}
                            onChange={(e) => setWizardBM({ ...wizardBM, partner_equity_percent: Number(e.target.value) || 0 })}
                            placeholder="Ex: 25"
                          />
                        </div>
                      </div>
                    )}

                    {/* Sócio Operacional */}
                    {wizardBM.business_model === 'operating_partner' && (
                      <div className="space-y-3 rounded-lg border p-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Receita dos atendimentos</Label>
                          <Select
                            value={wizardBM.partner_revenue_mode || 'individual'}
                            onValueChange={(v) => setWizardBM({ ...wizardBM, partner_revenue_mode: v as PartnerRevenueMode })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(Object.keys(PARTNER_REVENUE_MODE_LABELS) as PartnerRevenueMode[]).map((m) => (
                                <SelectItem key={m} value={m}>{PARTNER_REVENUE_MODE_LABELS[m]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {wizardBM.partner_revenue_mode === 'percent_to_company' && (
                          <div className="space-y-2">
                            <Label className="text-xs">% que fica com o sócio</Label>
                            <Input
                              type="number"
                              value={wizardBM.commission_value || ''}
                              onChange={(e) => setWizardBM({ ...wizardBM, commission_value: Number(e.target.value) || 0 })}
                              placeholder="Ex: 70"
                            />
                            <p className="text-xs text-muted-foreground">
                              A empresa fica com {Math.max(0, 100 - (Number(wizardBM.commission_value) || 0))}% de cada atendimento.
                            </p>
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label className="text-xs">% societário (opcional)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={wizardBM.partner_equity_percent || ''}
                            onChange={(e) => setWizardBM({ ...wizardBM, partner_equity_percent: Number(e.target.value) || 0 })}
                            placeholder="Ex: 50"
                          />
                          <p className="text-xs text-muted-foreground">
                            Usado para divisão futura do lucro da empresa (relatório).
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Externo */}
                    {wizardBM.business_model === 'external' && (
                      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                        Este profissional usa apenas a agenda. Nenhum campo financeiro é necessário.
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
                        {(() => {
                          const alreadyLinked = collaborators.find(c => c.profile?.user_id === user?.id);
                          if (alreadyLinked) {
                            return (
                              <div className="p-3 rounded-lg border bg-amber-50/50 border-amber-200">
                                <p className="text-sm font-medium text-amber-800">Seu login já está vinculado ao profissional {alreadyLinked.profile?.full_name}</p>
                                <p className="text-xs text-amber-700 mt-1">Para criar outro administrador, convide um novo usuário informando o e-mail dele abaixo.</p>
                              </div>
                            );
                          }
                          return (
                            <div className="flex items-center gap-3 p-3 rounded-lg border">
                              <Checkbox
                                id="admin-self"
                                checked={form.is_admin_self}
                                onCheckedChange={(checked) => setForm({ ...form, is_admin_self: !!checked, email: !!checked ? '' : form.email })}
                              />
                              <div>
                                <Label htmlFor="admin-self" className="text-sm font-medium cursor-pointer">Vincular ao meu login atual</Label>
                                <p className="text-xs text-muted-foreground">Usar minha conta neste profissional, sem criar nova conta</p>
                              </div>
                            </div>
                          );
                        })()}

                        {!form.is_admin_self && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Email de acesso *</Label>
                              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
                            </div>
                            
                            <div className="space-y-2">
                              <Label>Nível de permissão</Label>
                              <Select 
                                value={form.system_role} 
                                onValueChange={handleSystemRoleChange}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Object.entries(SYSTEM_ROLES)
                                    .filter(([key]) => key !== 'admin_principal')
                                    .map(([key, role]) => (
                                      <SelectItem key={key} value={key}>
                                        <div className="flex items-center gap-2">
                                          <role.icon className="h-4 w-4" />
                                          {role.label}
                                        </div>
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                        
                        <div className="space-y-4 mt-6 border-t pt-4">
                          <Label className="text-base font-bold">Permissões de acesso</Label>
                          <p className="text-xs text-muted-foreground mb-4">
                            Configure o que este membro pode acessar no painel administrativo.
                          </p>
                          
                          <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
                            {Object.entries(form.permissions || {}).map(([module, perms]: [string, any]) => (
                              <div key={module} className="space-y-3 p-3 rounded-lg border bg-muted/30">
                                <div className="flex items-center justify-between border-b pb-2 mb-2">
                                  <span className="font-bold text-sm uppercase tracking-wider">{PERMISSION_MODULE_LABELS[module] || module}</span>
                                  <Switch 
                                    checked={perms.view}
                                    onCheckedChange={(checked) => {
                                      const newPerms = { ...form.permissions };
                                      newPerms[module] = { ...newPerms[module], view: checked };
                                      setForm({ ...form, permissions: newPerms });
                                    }}
                                  />
                                </div>
                                {perms.view && (
                                  <div className="grid grid-cols-2 gap-4">
                                    {['create', 'edit', 'delete', 'view_values'].map((action) => {
                                      if (action === 'view_values' && module !== 'finance') return null;
                                      if (['whatsapp', 'reports', 'settings'].includes(module) && action !== 'edit' && action !== 'view_values') return null;
                                      
                                      const label = action === 'create' ? 'Criar' : 
                                                    action === 'edit' ? 'Editar' : 
                                                    action === 'delete' ? 'Excluir' : 'Ver valores';
                                      
                                      return (
                                        <div key={action} className="flex items-center gap-2">
                                          <Checkbox 
                                            id={`perm-${module}-${action}`}
                                            checked={perms[action] || false}
                                            onCheckedChange={(checked) => {
                                              const newPerms = { ...form.permissions };
                                              newPerms[module] = { ...newPerms[module], [action]: !!checked };
                                              setForm({ ...form, permissions: newPerms });
                                            }}
                                          />
                                          <Label htmlFor={`perm-${module}-${action}`} className="text-xs font-medium cursor-pointer">
                                            {label}
                                          </Label>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
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
                        setWizardStep(form.is_service_provider ? 3 : 5);
                      }}>
                        Próximo <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 3: Schedule Config */}
                {wizardStep === 3 && form.is_service_provider && (
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
                        {(() => {
                          const effectiveMode = (company as any)?.prof_perm_booking_mode
                            ? form.booking_mode
                            : ((company as any)?.booking_mode || 'fixed_grid');
                          const showsGrid = effectiveMode === 'fixed_grid' || effectiveMode === 'hybrid';
                          if ((company as any)?.prof_perm_grid_interval) {
                            return showsGrid ? (
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
                            ) : null;
                          }
                          return (
                            <div className="p-3 rounded-lg bg-muted/50 border space-y-1">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Lock className="h-3 w-3" /> Gerenciado pelo administrador
                              </div>
                              {showsGrid ? (
                                <p className="text-sm">Grade da agenda: <span className="font-medium">{(company as any)?.fixed_slot_interval || 15} min</span></p>
                              ) : (
                                <p className="text-sm">Horários dinâmicos por serviço</p>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    )}

                    <div className="space-y-2">
                      <Label>Intervalo entre clientes (minutos)</Label>
                      <Select value={String(form.break_time)} onValueChange={(v) => setForm({ ...form, break_time: Number(v) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Sem intervalo</SelectItem>
                          <SelectItem value="5">5 minutos</SelectItem>
                          <SelectItem value="10">10 minutos</SelectItem>
                          <SelectItem value="15">15 minutos</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Tempo de respiro entre um atendimento e outro.</p>
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
                {wizardStep === 4 && form.is_service_provider && (
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
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium">Serviços ({companyServices.length} disponíveis)</p>
                          <p className="text-xs text-muted-foreground">{form.selectedServiceIds.length} de {companyServices.length} selecionados</p>
                        </div>
                      </div>

                      {companyServices.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum serviço cadastrado. Você pode vincular depois.</p>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/30 sticky top-0 z-10">
                            <Checkbox
                              id="select-all-wizard"
                              checked={companyServices.length > 0 && form.selectedServiceIds.length === companyServices.length}
                              onCheckedChange={(checked) => {
                                setForm(prev => ({
                                  ...prev,
                                  selectedServiceIds: checked 
                                    ? companyServices.map((s: any) => s.id) 
                                    : []
                                }));
                              }}
                            />
                            <Label htmlFor="select-all-wizard" className="text-sm font-bold cursor-pointer flex-1">
                              {companyServices.length > 0 && form.selectedServiceIds.length === companyServices.length ? 'Desmarcar todos' : 'Selecionar todos'}
                            </Label>

                          </div>

                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1 mt-2">
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
                                  <p className="text-xs text-muted-foreground">R$ {Number(svc.price).toFixed(2)} — {svc.duration_minutes} min</p>
                                </div>
                              </label>
                            ))}
                          </div>
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
                      <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><span className="font-medium">{form.is_service_provider ? 'Profissional prestador' : ((SYSTEM_ROLES as any)[form.system_role]?.label || 'Membro administrativo')}</span></div>
                      {form.is_service_provider && <div className="flex justify-between"><span className="text-muted-foreground">Modelo Comercial</span><span className="font-medium">{BUSINESS_MODEL_LABELS[wizardBM.business_model]}</span></div>}
                      {form.is_service_provider && wizardBM.business_model === 'partner_commission' && Number(wizardBM.commission_value) > 0 && (
                        <div className="flex justify-between"><span className="text-muted-foreground">% profissional</span><span className="font-medium">{wizardBM.commission_value}%</span></div>
                      )}
                      {form.is_service_provider && wizardBM.business_model === 'employee' && wizardBM.commission_type !== 'none' && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Remuneração</span><span className="font-medium">{wizardBM.commission_type === 'percentage' ? `${wizardBM.commission_value}%` : `R$ ${Number(wizardBM.commission_value).toFixed(2)}/serviço`}</span></div>
                      )}
                      {form.is_service_provider && wizardBM.business_model === 'chair_rental' && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Aluguel</span><span className="font-medium">R$ {Number(wizardBM.rent_amount).toFixed(2)} ({RENT_CYCLE_LABELS[wizardBM.rent_cycle || 'monthly']})</span></div>
                      )}
                      {form.is_service_provider && wizardBM.business_model === 'operating_partner' && wizardBM.partner_revenue_mode && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Receita</span><span className="font-medium">{PARTNER_REVENUE_MODE_LABELS[wizardBM.partner_revenue_mode]}</span></div>
                      )}
                      {form.is_service_provider && wizardBM.business_model === 'investor_partner' && Number(wizardBM.partner_equity_percent) > 0 && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Participação</span><span className="font-medium">{wizardBM.partner_equity_percent}%</span></div>
                      )}
                      <div className="flex justify-between"><span className="text-muted-foreground">Acesso</span><span className="font-medium">{form.has_system_access ? (form.is_admin_self ? 'Admin vinculado' : 'Com login') : 'Sem acesso'}</span></div>
                      {form.is_service_provider && <div className="flex justify-between"><span className="text-muted-foreground">Agenda</span><span className="font-medium">{form.schedule_from_company ? 'Padrão da empresa' : bookingModeLabel(form.booking_mode)}</span></div>}
                      {form.is_service_provider && <div className="flex justify-between"><span className="text-muted-foreground">Capa</span><span className="font-medium">{form.use_company_banner ? 'Da empresa' : 'Personalizada'}</span></div>}
                      {form.is_service_provider && <div className="flex justify-between"><span className="text-muted-foreground">Serviços</span><span className="font-medium">{form.selectedServiceIds.length > 0 ? `${form.selectedServiceIds.length} selecionado(s)` : 'Nenhum'}</span></div>}
                      {!form.is_service_provider && Number(form.salary_amount) > 0 && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Pagamento fixo</span><span className="font-medium">R$ {Number(form.salary_amount).toFixed(2)}</span></div>
                      )}
                      {!form.is_service_provider && form.salary_auto_expense && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Despesa</span><span className="font-medium">Será criada em Salários</span></div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setWizardStep(form.is_service_provider ? 4 : 2)}>
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
        <TabsList className="w-full grid grid-cols-2 sm:inline-flex sm:w-auto">
          <TabsTrigger value="active" className="text-xs sm:text-sm">Ativos ({filteredActive.length})</TabsTrigger>
          <TabsTrigger value="disabled" className="text-xs sm:text-sm">Desabilitados ({filteredDisabled.length})</TabsTrigger>
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
            <div className="space-y-3">
              {filteredActive.map((c) => renderCollaboratorCard(c, false))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="disabled">
          <div className="space-y-3">
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
        <DialogContent className="max-w-2xl w-[calc(100vw-1rem)] sm:w-full max-h-[95vh] sm:max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11 sm:h-12 sm:w-12 shrink-0 ring-2 ring-primary/10">
                <AvatarImage src={editTarget?.profile?.avatar_url || ''} alt={editForm.name} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {(editForm.name || '?').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <DialogTitle className="text-base sm:text-lg leading-tight truncate">
                  {editForm.name || 'Editar membro'}
                </DialogTitle>
                <p className="text-xs text-muted-foreground truncate">{editForm.email || 'Sem e-mail'}</p>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="personal" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 pt-4 border-b">
              <TabsList className={`w-full grid ${editForm.is_service_provider ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-3'} h-auto bg-transparent p-0 gap-1`}>
                <TabsTrigger value="personal" className="data-[state=active]:bg-muted text-xs sm:text-sm">
                  Pessoal
                </TabsTrigger>
                <TabsTrigger value="model" className="data-[state=active]:bg-muted text-xs sm:text-sm">
                  Modelo Comercial
                </TabsTrigger>
                {editForm.is_service_provider && (
                  <>
                    <TabsTrigger value="schedule" className="data-[state=active]:bg-muted text-xs sm:text-sm">
                      Agenda
                    </TabsTrigger>
                    <TabsTrigger value="services" className="data-[state=active]:bg-muted text-xs sm:text-sm">
                      Serviços
                    </TabsTrigger>
                    <TabsTrigger value="public" className="data-[state=active]:bg-muted text-xs sm:text-sm">
                      Página
                    </TabsTrigger>
                  </>
                )}
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* SECTION 1: Personal data */}
              <TabsContent value="personal" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Nome do profissional"
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Usado para login no sistema (quando o acesso estiver habilitado).
                  </p>
                </div>
              </TabsContent>

              {/* SECTION 2: Modelo Comercial (unificado) */}
              <TabsContent value="model" className="mt-0 space-y-5">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">Este membro presta serviços?</p>
                    <p className="text-xs text-muted-foreground">Desative apenas para recepcionistas, atendentes, gerentes ou administrativos.</p>
                  </div>
                  <Switch
                    checked={editForm.is_service_provider && !isNonProviderSystemRole(editForm.system_role)}
                    disabled={isNonProviderSystemRole(editForm.system_role)}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, is_service_provider: Boolean(checked) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Função no painel</Label>
                  <Select
                    value={editForm.system_role}
                    onValueChange={(role) => {
                      const isProvider = role === 'collaborator';
                      setEditForm({
                        ...editForm,
                        system_role: role,
                        is_service_provider: isProvider,
                        permissions: SYSTEM_ROLE_PRESETS[role] || editForm.permissions,
                      });
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(SYSTEM_ROLES)
                        .filter(([key]) => key !== 'admin_principal')
                        .map(([key, role]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <role.icon className="h-4 w-4" />
                              {role.label}
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {isNonProviderSystemRole(editForm.system_role) && (
                    <p className="text-xs text-amber-600 font-medium">
                      Esta função é administrativa e não cria perfil público nem agenda própria. Este usuário não aparecerá na página pública da empresa.
                    </p>
                  )}
                </div>

                {!editForm.is_service_provider && (
                  <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
                    <Label className="text-sm font-medium">Pagamento fixo do membro</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Valor do salário/pagamento (R$)</Label>
                        <Input type="number" step="0.01" min="0" value={editForm.salary_amount} onChange={(e) => setEditForm({ ...editForm, salary_amount: e.target.value })} placeholder="Ex: 1800.00" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Dia de vencimento</Label>
                        <Input type="number" min="1" max="31" value={editForm.salary_payment_day} onChange={(e) => setEditForm({ ...editForm, salary_payment_day: e.target.value })} placeholder="Ex: 5" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Próximo vencimento</Label>
                        <Input type="date" value={editForm.salary_next_due_date} onChange={(e) => setEditForm({ ...editForm, salary_next_due_date: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Repetição</Label>
                        <Select value={editForm.salary_recurrence} onValueChange={(v) => setEditForm({ ...editForm, salary_recurrence: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem repetição</SelectItem>
                            <SelectItem value="weekly">Semanal</SelectItem>
                            <SelectItem value="biweekly">Quinzenal</SelectItem>
                            <SelectItem value="monthly">Mensal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label className="text-xs">Forma de pagamento</Label>
                        <Select value={editForm.salary_payment_method} onValueChange={(v) => setEditForm({ ...editForm, salary_payment_method: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHOD_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border bg-background p-3">
                      <div>
                        <p className="text-sm font-medium">Enviar para despesas</p>
                        <p className="text-xs text-muted-foreground">Mantém este pagamento identificado para lançamento em Salários.</p>
                      </div>
                      <Switch checked={editForm.salary_auto_expense} onCheckedChange={(checked) => setEditForm({ ...editForm, salary_auto_expense: Boolean(checked) })} />
                    </div>
                  </div>
                )}

                {!editForm.is_service_provider && (
                  <div className="space-y-4 rounded-lg border p-4">
                    <div>
                      <Label className="text-sm font-semibold">Permissões de acesso</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Defina exatamente quais menus e ações este membro pode usar no painel administrativo.
                      </p>
                    </div>
                    <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                      {Object.entries(editForm.permissions || {}).map(([module, perms]: [string, any]) => (
                        <div key={module} className="space-y-3 p-3 rounded-lg border bg-muted/30">
                          <div className="flex items-center justify-between border-b pb-2">
                            <span className="font-bold text-xs uppercase tracking-wider">{PERMISSION_MODULE_LABELS[module] || module}</span>
                            <Switch
                              checked={Boolean(perms.view)}
                              onCheckedChange={(checked) => {
                                const next = { ...editForm.permissions };
                                next[module] = { ...next[module], view: Boolean(checked) };
                                setEditForm({ ...editForm, permissions: next });
                              }}
                            />
                          </div>
                          {perms.view && (
                            <div className="grid grid-cols-2 gap-3">
                              {['create', 'edit', 'delete', 'view_values'].map((action) => {
                                if (action === 'view_values' && module !== 'finance') return null;
                                if (['whatsapp', 'reports', 'settings'].includes(module) && action !== 'edit' && action !== 'view_values') return null;
                                const label = action === 'create' ? 'Criar' : action === 'edit' ? 'Editar' : action === 'delete' ? 'Excluir' : 'Ver valores';
                                return (
                                  <div key={action} className="flex items-center gap-2">
                                    <Checkbox
                                      id={`edit-perm-${module}-${action}`}
                                      checked={Boolean(perms[action])}
                                      onCheckedChange={(checked) => {
                                        const next = { ...editForm.permissions };
                                        next[module] = { ...next[module], [action]: Boolean(checked) };
                                        setEditForm({ ...editForm, permissions: next });
                                      }}
                                    />
                                    <Label htmlFor={`edit-perm-${module}-${action}`} className="text-xs cursor-pointer">
                                      {label}
                                    </Label>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {editForm.is_service_provider && (
                <>
                <div className="space-y-2">
                  <Label>Tipo de relação com a empresa</Label>
                  <Select
                    value={editBM.business_model}
                    onValueChange={(v) => setEditBM({ ...editBM, business_model: v as BusinessModel })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(BUSINESS_MODEL_LABELS) as BusinessModel[]).map((bm) => (
                        <SelectItem key={bm} value={bm}>{BUSINESS_MODEL_LABELS[bm]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                    {BUSINESS_MODEL_DESCRIPTIONS[editBM.business_model]}
                  </div>
                </div>

                {/* Funcionário */}
                {editBM.business_model === 'employee' && (
                  <div className="space-y-3 rounded-lg border p-4">
                    <Label className="text-sm font-medium">Como ele é remunerado?</Label>
                    <Select
                      value={editBM.commission_type}
                      onValueChange={(v) => setEditBM({ ...editBM, commission_type: v as any })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Salário fixo (controlado fora do sistema)</SelectItem>
                        <SelectItem value="percentage">Comissão %</SelectItem>
                        <SelectItem value="fixed">Valor fixo por serviço</SelectItem>
                      </SelectContent>
                    </Select>
                    {editBM.commission_type === 'percentage' && (
                      <div className="space-y-2">
                        <Label className="text-xs">Comissão do profissional (%)</Label>
                        <Input
                          type="number"
                          value={editBM.commission_value || ''}
                          onChange={(e) => setEditBM({ ...editBM, commission_value: Number(e.target.value) || 0 })}
                          placeholder="Ex: 30"
                        />
                      </div>
                    )}
                    {editBM.commission_type === 'fixed' && (
                      <div className="space-y-2">
                        <Label className="text-xs">Valor por serviço (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editBM.commission_value || ''}
                          onChange={(e) => setEditBM({ ...editBM, commission_value: Number(e.target.value) || 0 })}
                          placeholder="Ex: 25.00"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Parceiro com comissão */}
                {editBM.business_model === 'partner_commission' && (
                  <div className="space-y-3 rounded-lg border p-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">% do profissional</Label>
                      <Input
                        type="number"
                        value={editBM.commission_value || ''}
                        onChange={(e) => setEditBM({ ...editBM, commission_value: Number(e.target.value) || 0 })}
                        placeholder="Ex: 60"
                      />
                      <p className="text-xs text-muted-foreground">
                        A empresa fica com {Math.max(0, 100 - (Number(editBM.commission_value) || 0))}% de cada atendimento.
                      </p>
                    </div>
                  </div>
                )}

                {/* Aluguel de cadeira */}
                {editBM.business_model === 'chair_rental' && (
                  <div className="space-y-3 rounded-lg border p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Periodicidade</Label>
                        <Select
                          value={editBM.rent_cycle || 'monthly'}
                          onValueChange={(v) => setEditBM({ ...editBM, rent_cycle: v as RentCycle })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.keys(RENT_CYCLE_LABELS) as RentCycle[]).map((c) => (
                              <SelectItem key={c} value={c}>{RENT_CYCLE_LABELS[c]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Valor do aluguel (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editBM.rent_amount || ''}
                          onChange={(e) => setEditBM({ ...editBM, rent_amount: Number(e.target.value) || 0 })}
                          placeholder="Ex: 800.00"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      A receita dos serviços fica 100% com o profissional. O aluguel deve ser lançado manualmente em Contas a Receber.
                    </p>
                  </div>
                )}

                {/* Sócio Investidor */}
                {editBM.business_model === 'investor_partner' && (
                  <div className="space-y-3 rounded-lg border p-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">% de participação societária</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editBM.partner_equity_percent || ''}
                        onChange={(e) => setEditBM({ ...editBM, partner_equity_percent: Number(e.target.value) || 0 })}
                        placeholder="Ex: 25"
                      />
                    </div>
                  </div>
                )}

                {/* Sócio Operacional */}
                {editBM.business_model === 'operating_partner' && (
                  <div className="space-y-3 rounded-lg border p-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Receita dos atendimentos</Label>
                      <Select
                        value={editBM.partner_revenue_mode || 'individual'}
                        onValueChange={(v) => setEditBM({ ...editBM, partner_revenue_mode: v as PartnerRevenueMode })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(PARTNER_REVENUE_MODE_LABELS) as PartnerRevenueMode[]).map((m) => (
                            <SelectItem key={m} value={m}>{PARTNER_REVENUE_MODE_LABELS[m]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {editBM.partner_revenue_mode === 'percent_to_company' && (
                      <div className="space-y-2">
                        <Label className="text-xs">% que fica com o sócio</Label>
                        <Input
                          type="number"
                          value={editBM.commission_value || ''}
                          onChange={(e) => setEditBM({ ...editBM, commission_value: Number(e.target.value) || 0 })}
                          placeholder="Ex: 70"
                        />
                        <p className="text-xs text-muted-foreground">
                          A empresa fica com {Math.max(0, 100 - (Number(editBM.commission_value) || 0))}% de cada atendimento.
                        </p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-xs">% societário (opcional)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editBM.partner_equity_percent || ''}
                        onChange={(e) => setEditBM({ ...editBM, partner_equity_percent: Number(e.target.value) || 0 })}
                        placeholder="Ex: 50"
                      />
                      <p className="text-xs text-muted-foreground">
                        Usado para divisão futura do lucro da empresa (relatório).
                      </p>
                    </div>
                  </div>
                )}

                {/* Externo */}
                {editBM.business_model === 'external' && (
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                    Este profissional usa apenas a agenda. Nenhum campo financeiro é necessário.
                  </div>
                )}

                </>
                )}

                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {editTarget?.has_system_access ? (
                      <><UserCheck className="h-4 w-4 text-emerald-600" /> Acesso ao sistema ativo</>
                    ) : (
                      <><Lock className="h-4 w-4 text-muted-foreground" /> Sem acesso ao sistema</>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {editTarget?.has_system_access
                      ? 'Este profissional pode entrar no painel com seu e-mail.'
                      : 'Este profissional não tem login. Use as ações do card para conceder acesso.'}
                  </p>
                </div>
              </TabsContent>

              {/* SECTION 4: Schedule */}
              <TabsContent value="schedule" className="mt-0 space-y-4">
                {/* Booking Mode */}
                {(company as any)?.prof_perm_booking_mode ? (
                  <div className="space-y-2">
                    <Label>Modo de agendamento</Label>
                    <Select
                      value={editForm.booking_mode}
                      onValueChange={(v) => setEditForm({ ...editForm, booking_mode: v })}
                    >
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
                    <p className="text-sm">
                      Modo: <span className="font-medium">{bookingModeLabel((company as any)?.booking_mode || 'fixed_grid')}</span>
                    </p>
                  </div>
                )}

                {/* Grid Interval / Mode display */}
                {(() => {
                  const effectiveMode = (company as any)?.prof_perm_booking_mode
                    ? editForm.booking_mode
                    : ((company as any)?.booking_mode || 'fixed_grid');
                  const showsGrid = effectiveMode === 'fixed_grid' || effectiveMode === 'hybrid';
                  if ((company as any)?.prof_perm_grid_interval) {
                    return showsGrid ? (
                      <div className="space-y-2">
                        <Label>Intervalo da grade</Label>
                        <Select
                          value={String(editForm.grid_interval)}
                          onValueChange={(v) => setEditForm({ ...editForm, grid_interval: Number(v) })}
                        >
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
                      <div className="p-3 rounded-lg bg-muted/50 border">
                        <p className="text-sm">Horários dinâmicos por serviço</p>
                        <p className="text-xs text-muted-foreground">A grade não se aplica no modo Inteligente.</p>
                      </div>
                    );
                  }
                  return (
                    <div className="p-3 rounded-lg bg-muted/50 border space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Lock className="h-3 w-3" /> Gerenciado pelo administrador
                      </div>
                      {showsGrid ? (
                        <p className="text-sm">
                          Grade da agenda: <span className="font-medium">{(company as any)?.fixed_slot_interval || 15} min</span>
                        </p>
                      ) : (
                        <p className="text-sm">Horários dinâmicos por serviço</p>
                      )}
                    </div>
                  );
                })()}

                <div className="space-y-2">
                  <Label>Intervalo entre clientes (minutos)</Label>
                  <Select
                    value={String(editForm.break_time)}
                    onValueChange={(v) => setEditForm({ ...editForm, break_time: Number(v) })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Sem intervalo</SelectItem>
                      <SelectItem value="5">5 minutos</SelectItem>
                      <SelectItem value="10">10 minutos</SelectItem>
                      <SelectItem value="15">15 minutos</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Tempo de respiro entre um atendimento e outro (não altera a grade da agenda).
                  </p>
                </div>
              </TabsContent>

              {/* SECTION 5: Services */}
              <TabsContent value="services" className="mt-0 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-primary/10 p-2 shrink-0">
                    <Briefcase className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <Label className="text-sm font-semibold">Serviços atendidos</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {editAssignedServiceIds.length} de {companyServices.length} selecionados
                    </p>

                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar serviço..."
                      value={editServiceSearch}
                      onChange={(e) => setEditServiceSearch(e.target.value)}
                      className="pl-9 pr-8 h-9"
                    />
                    {editServiceSearch && (
                      <button
                        type="button"
                        onClick={() => setEditServiceSearch('')}
                        className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                        aria-label="Limpar busca"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  
                  {companyServices.length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-9 whitespace-nowrap"
                      onClick={async () => {
                        const allIds = companyServices.map((s: any) => s.id);
                        const allSelected = allIds.every(id => editAssignedServiceIds.includes(id));
                        
                        try {
                          if (allSelected) {
                            // Deselect all
                            await supabase
                              .from('service_professionals')
                              .delete()
                              .eq('professional_id', editTarget.profile_id);
                            setEditAssignedServiceIds([]);
                            toast.success('Todos os serviços removidos');
                          } else {
                            // Select all (only those not already assigned)
                            const toAdd = allIds.filter(id => !editAssignedServiceIds.includes(id));
                            if (toAdd.length > 0) {
                              const inserts = toAdd.map(id => ({
                                service_id: id,
                                professional_id: editTarget.profile_id,
                                company_id: companyId,
                              }));
                              await supabase.from('service_professionals').insert(inserts as any);
                            }
                            setEditAssignedServiceIds(allIds);
                            toast.success('Todos os serviços vinculados');
                          }
                        } catch (err) {
                          toast.error('Erro ao atualizar serviços');
                        }
                      }}
                    >
                      {companyServices.map((s: any) => s.id).every(id => editAssignedServiceIds.includes(id)) 
                        ? 'Desmarcar todos' 
                        : 'Selecionar todos'}
                    </Button>
                  )}
                </div>


                <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
                  {(() => {
                    const q = editServiceSearch.trim().toLowerCase();
                    const filtered = q
                      ? companyServices.filter((s: any) => (s.name || '').toLowerCase().includes(q))
                      : companyServices;
                    if (filtered.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground text-center py-6">
                          {companyServices.length === 0
                            ? 'Nenhum serviço cadastrado. Crie serviços primeiro em Serviços.'
                            : 'Nenhum serviço encontrado.'}
                        </p>
                      );
                    }
                    return filtered.map((svc: any) => {
                      const isAssigned = editAssignedServiceIds.includes(svc.id);
                      return (
                        <label
                          key={svc.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border cursor-pointer hover:bg-muted/60"
                        >
                          <Checkbox
                            checked={isAssigned}
                            onCheckedChange={(checked) => toggleEditService(svc.id, !!checked)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{svc.name}</p>
                            <p className="text-xs text-muted-foreground">
                              R$ {Number(svc.price).toFixed(2)} — {svc.duration_minutes} min
                            </p>
                          </div>
                        </label>
                      );
                    });
                  })()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Apenas serviços marcados aparecem na agenda e na página pública deste profissional.
                </p>
              </TabsContent>

              {/* SECTION 6: Public page */}
              <TabsContent value="public" className="mt-0 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-primary/10 p-2 shrink-0">
                    <Globe className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <Label className="text-sm font-semibold">Página pública</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Link exclusivo para agendamentos deste profissional.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Identificador (slug)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={editSlug}
                      onChange={(e) => { setEditSlug(e.target.value); setEditSlugDirty(true); }}
                      placeholder="ex: joao"
                      className="h-9"
                    />
                    <Button size="sm" onClick={saveEditSlug} disabled={!editSlugDirty}>
                      Salvar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use apenas letras minúsculas, números e hifens.
                  </p>
                </div>

                <div className="space-y-4 pt-2 border-t mt-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Banner da página</Label>
                      <p className="text-[10px] text-muted-foreground">
                        {editForm.use_company_banner ? 'Usando capa padrão da empresa' : 'Usando capa personalizada do profissional'}
                      </p>
                    </div>
                    <Switch
                      checked={!editForm.use_company_banner}
                      onCheckedChange={(checked) => setEditForm({ ...editForm, use_company_banner: !checked })}
                    />
                  </div>
                </div>

                {editPublicLink && (
                  <div className="space-y-2">
                    <Label className="text-xs flex items-center gap-1">
                      <Link2 className="h-3 w-3" /> Link de agendamento
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input value={editPublicLink} readOnly className="bg-muted text-sm h-9" />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => { navigator.clipboard.writeText(editPublicLink); toast.success('Link copiado!'); }}
                        aria-label="Copiar link"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" asChild aria-label="Abrir link">
                        <a href={editPublicLink} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                    {editSlugDirty && (
                      <p className="text-xs text-amber-600">
                        Salve o identificador para atualizar o link.
                      </p>
                    )}
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>

          <div className="flex flex-col-reverse sm:flex-row gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t bg-muted/30 sticky bottom-0">
            <Button variant="outline" className="flex-1" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleSaveEdit}>
              Salvar alterações
            </Button>
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
            const fullMessage = `🔐 *Acesso ao sistema*\n\n📌 Link de login: ${loginUrl}\n📧 Email: ${inviteCredentials.email}\n🔑 Senha temporária: ${inviteCredentials.password}\n\n⚠️ Troque sua senha após o primeiro login.`;
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
                  <a href={whatsAppUrl} onClick={() => trackWhatsAppClick('team-invite')} target="_blank" rel="noopener noreferrer">
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

    </div>
  );
};

export default Team;

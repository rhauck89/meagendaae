import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useUserTicketCounts } from '@/hooks/useSupportTicketCounts';
import { usePlatformMessages } from '@/hooks/usePlatformMessages';
import { useCompanyBrandInfo } from '@/hooks/useCompanyBrandInfo';
import {
  Calendar, Scissors, Users, BarChart3, Settings, LogOut, Menu, X, User, UserCheck,
  PartyPopper, Megaphone, MessageSquare, ChevronDown, Building2, Clock, Zap, Palette, Globe, CreditCard, Bell, HelpCircle, Info, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import CompanySetup from './CompanySetup';
import { OnboardingPopup } from './OnboardingPopup';
import { PlatformLogo } from './PlatformLogo';
import { PlatformFooter } from './PlatformFooter';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const adminNavItems = [
  { href: '/dashboard', icon: Calendar, label: 'Agenda' },
  { href: '/dashboard/services', icon: Scissors, label: 'Serviços' },
  { href: '/dashboard/team', icon: Users, label: 'Equipe' },
  { href: '/dashboard/clients', icon: UserCheck, label: 'Clientes' },
  { href: '/dashboard/events', icon: PartyPopper, label: 'Agenda Aberta' },
  { href: '/dashboard/promotions', icon: Megaphone, label: 'Promoções' },
  { href: '/dashboard/reports', icon: BarChart3, label: 'Relatórios' },
];

const settingsSubItems = [
  { href: '/dashboard/settings/general', icon: Settings, label: 'Geral' },
  { href: '/dashboard/settings/company', icon: Building2, label: 'Empresa' },
  { href: '/dashboard/settings/schedule', icon: Clock, label: 'Agenda' },
  { href: '/dashboard/settings/automation', icon: Zap, label: 'Automação' },
  { href: '/dashboard/settings/branding', icon: Palette, label: 'Branding' },
  { href: '/dashboard/settings/domain', icon: Globe, label: 'Domínio' },
  { href: '/dashboard/settings/plan', icon: CreditCard, label: 'Plano' },
];

const professionalNavItems = [
  { href: '/dashboard', icon: Calendar, label: 'Minha Agenda' },
  { href: '/dashboard/services', icon: Scissors, label: 'Meus Serviços' },
  { href: '/dashboard/profile', icon: User, label: 'Meu Perfil' },
];

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile, companyId, signOut, loading: authLoading } = useAuth();
  const { isAdmin } = useUserRole();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const unreadTickets = useUserTicketCounts();
  const { data: platformMessages, dismiss: dismissMessage } = usePlatformMessages();
  const totalNotifications = (unreadTickets || 0) + (platformMessages?.length || 0);

  const isSettingsActive = location.pathname.startsWith('/dashboard/settings');
  const [settingsOpen, setSettingsOpen] = useState(isSettingsActive);

  const navItems = isAdmin ? adminNavItems : professionalNavItems;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (!authLoading && !companyId) {
    return <CompanySetup onComplete={() => { window.location.reload(); }} />;
  }

  const renderNavLink = (item: { href: string; icon: any; label: string }, badge?: number) => {
    const isActive = location.pathname === item.href || (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
    return (
      <Link
        key={item.href}
        to={item.href}
        onClick={() => setSidebarOpen(false)}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          isActive ? 'bg-sidebar-accent/15 text-sidebar-primary' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/12 hover:text-sidebar-foreground'
        )}
      >
        <item.icon className="h-5 w-5" />
        <span className="flex-1">{item.label}</span>
        {badge != null && badge > 0 && (
          <span className="min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
            {badge}
          </span>
        )}
      </Link>
    );
  };

  const currentLabel = (() => {
    if (isSettingsActive) {
      const sub = settingsSubItems.find(i => location.pathname === i.href);
      return sub ? `Configurações / ${sub.label}` : 'Configurações';
    }
    return navItems.find(i => location.pathname === i.href || (i.href !== '/dashboard' && location.pathname.startsWith(i.href)))?.label
      || (location.pathname === '/dashboard/profile' ? 'Meu Perfil' : location.pathname === '/dashboard/support' ? 'Suporte' : 'Dashboard');
  })();

  return (
    <div className="min-h-screen flex bg-background">
      {sidebarOpen && <div className="fixed inset-0 bg-foreground/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={cn('fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform lg:translate-x-0', sidebarOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-sidebar-primary rounded-xl flex items-center justify-center"><Scissors className="h-5 w-5 text-sidebar-primary-foreground" /></div>
          <span className="font-display font-bold text-lg">AgendaPro</span>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}><X className="h-5 w-5" /></button>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map(item => renderNavLink(item))}

          {isAdmin && (
            <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
              <CollapsibleTrigger className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full',
                isSettingsActive ? 'bg-sidebar-accent/15 text-sidebar-primary' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/12 hover:text-sidebar-foreground'
              )}>
                <Settings className="h-5 w-5" />
                <span className="flex-1 text-left">Configurações</span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', settingsOpen && 'rotate-180')} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-0.5 mt-0.5">
                {settingsSubItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                        isActive ? 'bg-sidebar-accent/15 text-sidebar-primary font-medium' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/12 hover:text-sidebar-foreground'
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}

          {renderNavLink({ href: '/dashboard/profile', icon: User, label: 'Meu Perfil' })}

          <div className="pt-2 mt-2 border-t border-sidebar-border">
            <p className="px-3 py-1.5 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider">Ajuda</p>
            {renderNavLink({ href: '/dashboard/help', icon: HelpCircle, label: 'Tutoriais' })}
            {isAdmin && renderNavLink({ href: '/dashboard/support', icon: MessageSquare, label: 'Suporte' }, unreadTickets)}
          </div>
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-sidebar-accent/20 rounded-full flex items-center justify-center text-sm font-semibold">
              {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name || 'Usuário'}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate">{profile?.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/12">
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen lg:ml-64">
        <header className="h-16 border-b flex items-center px-4 lg:px-8 bg-card">
          <button className="lg:hidden mr-4" onClick={() => setSidebarOpen(true)}><Menu className="h-6 w-6" /></button>
          <h1 className="text-lg font-display font-semibold flex-1">{currentLabel}</h1>
          <Popover>
            <PopoverTrigger asChild>
              <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
                <Bell className="h-5 w-5 text-muted-foreground" />
                {totalNotifications > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                    {totalNotifications}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-3 border-b"><h3 className="font-semibold text-sm">Notificações</h3></div>
              <ScrollArea className="max-h-80">
                {unreadTickets > 0 && (
                  <button onClick={() => navigate('/dashboard/support')} className="w-full text-left px-3 py-2.5 hover:bg-muted border-b flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm">{unreadTickets} ticket(s) com atualização</span>
                  </button>
                )}
                {platformMessages?.map((msg: any) => (
                  <div key={msg.id} className="px-3 py-2.5 border-b last:border-0">
                    <div className="flex items-start gap-2">
                      {msg.type === 'warning' ? <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" /> : <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{msg.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{msg.content}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(msg.created_at), 'dd/MM/yyyy HH:mm')}</p>
                      </div>
                      <button onClick={() => dismissMessage(msg.id)} className="text-muted-foreground hover:text-foreground shrink-0 p-0.5" title="Dispensar">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {totalNotifications === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-6">Nenhuma notificação</p>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </header>
        <div className="flex-1 p-3 sm:p-4 lg:p-8 overflow-auto overflow-x-hidden">
          {platformMessages && platformMessages.length > 0 && (
            <div className="mb-4 space-y-2">
              {platformMessages.slice(0, 3).map((msg: any) => (
                <div key={msg.id} className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border text-sm',
                  msg.type === 'warning' ? 'bg-warning/5 border-warning/20' : 'bg-primary/5 border-primary/20'
                )}>
                  {msg.type === 'warning' ? <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" /> : <Megaphone className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{msg.title}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{msg.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(msg.created_at), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                  <button onClick={() => dismissMessage(msg.id)} className="text-muted-foreground hover:text-foreground shrink-0 p-1" title="Dispensar">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {children}
        </div>
      </main>
      <OnboardingPopup />
    </div>
  );
};

export default DashboardLayout;

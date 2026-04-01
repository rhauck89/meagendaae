import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import {
  Calendar,
  Scissors,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  UserCheck,
  PartyPopper,
  Megaphone,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import CompanySetup from './CompanySetup';

const adminNavItems = [
  { href: '/dashboard', icon: Calendar, label: 'Agenda' },
  { href: '/dashboard/services', icon: Scissors, label: 'Serviços' },
  { href: '/dashboard/team', icon: Users, label: 'Equipe' },
  { href: '/dashboard/clients', icon: UserCheck, label: 'Clientes' },
  { href: '/dashboard/events', icon: PartyPopper, label: 'Agenda Aberta' },
  { href: '/dashboard/promotions', icon: Megaphone, label: 'Promoções' },
  { href: '/dashboard/reports', icon: BarChart3, label: 'Relatórios' },
  { href: '/dashboard/support', icon: MessageSquare, label: 'Suporte' },
  { href: '/dashboard/settings', icon: Settings, label: 'Configurações' },
  { href: '/dashboard/profile', icon: User, label: 'Meu Perfil' },
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

  const navItems = isAdmin ? adminNavItems : professionalNavItems;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (!authLoading && !companyId) {
    return (
      <CompanySetup
        onComplete={() => {
          window.location.reload();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform lg:translate-x-0 lg:static',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-sidebar-primary rounded-xl flex items-center justify-center">
            <Scissors className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-display font-bold text-lg">AgendaPro</span>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.href ||
              (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-sidebar-accent rounded-full flex items-center justify-center text-sm font-semibold">
              {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name || 'Usuário'}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate">{profile?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 border-b flex items-center px-4 lg:px-8 bg-card">
          <button className="lg:hidden mr-4" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-display font-semibold">
            {navItems.find(
              (i) =>
                location.pathname === i.href ||
                (i.href !== '/dashboard' && location.pathname.startsWith(i.href))
            )?.label || 'Dashboard'}
          </h1>
        </header>
        <div className="flex-1 p-4 lg:p-8 overflow-auto">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;

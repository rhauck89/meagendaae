import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSupportTicketCounts } from '@/hooks/useSupportTicketCounts';
import {
  LayoutDashboard, Building2, CreditCard, DollarSign, BarChart3, Settings, LogOut, Menu, X,
  ShieldCheck, MessageSquare, Bell, Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/super-admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/super-admin/companies', icon: Building2, label: 'Empresas' },
  { href: '/super-admin/plans', icon: CreditCard, label: 'Planos' },
  { href: '/super-admin/finance', icon: DollarSign, label: 'Financeiro' },
  { href: '/super-admin/reports', icon: BarChart3, label: 'Relatórios' },
  { href: '/super-admin/support', icon: MessageSquare, label: 'Suporte' },
  { href: '/super-admin/tutorials', icon: Video, label: 'Tutoriais' },
  { href: '/super-admin/messages', icon: Megaphone, label: 'Mensagens' },
  { href: '/super-admin/settings', icon: Settings, label: 'Configurações' },
];

const SuperAdminLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const ticketCounts = useSupportTicketCounts(true);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen flex bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform lg:translate-x-0 lg:static',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-destructive/10 rounded-xl flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-destructive" />
          </div>
          <span className="font-display font-bold text-lg">Super Admin</span>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href || (item.href !== '/super-admin' && location.pathname.startsWith(item.href));
            const badge = item.href === '/super-admin/support' ? ticketCounts.total_pending : 0;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive ? 'bg-sidebar-accent text-sidebar-primary' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="flex-1">{item.label}</span>
                {badge > 0 && (
                  <span className="min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                    {badge}
                  </span>
                )}
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
              <p className="text-sm font-medium truncate">{profile?.full_name || 'Admin'}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate">{profile?.email}</p>
            </div>
          </div>
          <div className="space-y-1">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent">
              <LayoutDashboard className="h-4 w-4 mr-2" /> Ir ao Dashboard
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent">
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 border-b flex items-center px-4 lg:px-8 bg-card">
          <button className="lg:hidden mr-4" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-display font-semibold flex-1">
            {navItems.find(i => location.pathname === i.href || (i.href !== '/super-admin' && location.pathname.startsWith(i.href)))?.label || 'Super Admin'}
          </h1>
          {ticketCounts.total_pending > 0 && (
            <button
              onClick={() => navigate('/super-admin/support')}
              className="relative p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                {ticketCounts.total_pending}
              </span>
            </button>
          )}
        </header>
        <div className="flex-1 p-4 lg:p-8 overflow-auto">{children}</div>
      </main>
    </div>
  );
};

export default SuperAdminLayout;

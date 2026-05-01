import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

interface RequireRoleProps {
  role: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const RequireRole = ({ role, children, fallback }: RequireRoleProps) => {
  const { user, loading, roles } = useAuth();
  
  useEffect(() => {
    const count = (window as any)._trace_RequireRole = ((window as any)._trace_RequireRole || 0) + 1;
    console.log('[SUPER_ADMIN_RENDER_TRACE]', { component: `RequireRole(${role})`, count, loading, hasUser: !!user, roles: roles?.join(','), timestamp: Date.now() });
  });


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!roles.includes(role)) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Acesso não autorizado</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default RequireRole;

import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

interface RequireRoleProps {
  role: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const RequireRole = ({ role, children, fallback }: RequireRoleProps) => {
  const { user, loading, roles } = useAuth();

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

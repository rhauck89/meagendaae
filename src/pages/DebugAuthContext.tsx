import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';

const DebugAuthContext = () => {
  const { user, profile, companyId, roles, loginMode, loading: authLoading } = useAuth();
  const [rpcResult, setRpcResult] = useState<any>(null);
  const [rpcError, setRpcError] = useState<any>(null);
  const [userCompanies, setUserCompanies] = useState<any>(null);
  const [companiesError, setCompaniesError] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDebug = async () => {
    setLoading(true);
    setRpcError(null);
    setCompaniesError(null);
    
    try {
      const { data: context, error: ctxError } = await supabase.rpc('get_current_user_context');
      setRpcResult(context);
      setRpcError(ctxError);

      const { data: companies, error: compError } = await supabase.rpc('get_user_companies');
      setUserCompanies(companies);
      setCompaniesError(compError);
    } catch (err: any) {
      console.error('Debug run failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      runDebug();
    }
  }, [user]);

  if (authLoading) {
    return <div className="p-8">Carregando AuthContext...</div>;
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Debug Auth Context</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>AuthContext State</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><strong>User ID:</strong> {user?.id || 'null'}</p>
            <p><strong>Email:</strong> {user?.email || 'null'}</p>
            <p><strong>Company ID:</strong> <span className={companyId ? "text-green-600 font-bold" : "text-red-600 font-bold"}>{companyId || 'null'}</span></p>
            <p><strong>Roles:</strong> {JSON.stringify(roles)}</p>
            <p><strong>Login Mode:</strong> {loginMode || 'null'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile Object</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(profile, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Live RPC: get_current_user_context</CardTitle>
          <Button size="sm" onClick={runDebug} disabled={loading}>
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Atualizar'}
          </Button>
        </CardHeader>
        <CardContent>
          {rpcError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>RPC Error</AlertTitle>
              <AlertDescription>{rpcError.message}</AlertDescription>
            </Alert>
          )}
          <pre className="text-xs bg-muted p-2 rounded overflow-auto">
            {JSON.stringify(rpcResult, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live RPC: get_user_companies</CardTitle>
        </CardHeader>
        <CardContent>
          {companiesError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>RPC Error</AlertTitle>
              <AlertDescription>{companiesError.message}</AlertDescription>
            </Alert>
          )}
          <pre className="text-xs bg-muted p-2 rounded overflow-auto">
            {JSON.stringify(userCompanies, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Timestamp: {new Date().toISOString()}
      </div>
    </div>
  );
};

export default DebugAuthContext;
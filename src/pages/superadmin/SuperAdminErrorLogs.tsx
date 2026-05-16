import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, AlertCircle, Terminal, Building2, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';

export default function SuperAdminErrorLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_error_logs')
        .select(`
          *,
          company:companies(name),
          profile:profiles!app_error_logs_user_id_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const searchLower = searchTerm.toLowerCase();
    return (
      log.context?.toLowerCase().includes(searchLower) ||
      log.technical_message?.toLowerCase().includes(searchLower) ||
      log.friendly_message?.toLowerCase().includes(searchLower) ||
      log.company?.name?.toLowerCase().includes(searchLower) ||
      log.profile?.full_name?.toLowerCase().includes(searchLower) ||
      log.profile?.email?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Logs de Erros</h1>
          <p className="text-muted-foreground">Monitoramento centralizado de imprevistos no sistema.</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por contexto, erro, empresa ou usuário..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Data</TableHead>
                <TableHead>Tela/Ação</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Erro Técnico</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">Carregando logs...</TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">Nenhum log encontrado.</TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLog(log)}>
                    <TableCell className="text-xs font-mono">
                      {format(new Date(log.created_at), 'dd/MM/yy HH:mm:ss', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase">
                        {log.context}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {log.friendly_message}
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate text-xs font-mono text-destructive">
                      {log.technical_message}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        {log.company?.name || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Badge variant="secondary" className="cursor-pointer">Ver</Badge>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh]">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <AlertCircle className="h-5 w-5 text-destructive" />
                              Detalhes do Erro
                            </DialogTitle>
                            <DialogDescription>
                              ID: {log.id}
                            </DialogDescription>
                          </DialogHeader>
                          
                          <ScrollArea className="mt-4 pr-4">
                            <div className="space-y-6 pb-6">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="space-y-1">
                                  <span className="text-muted-foreground font-medium">Data/Hora</span>
                                  <p>{format(new Date(log.created_at), "PPPP 'às' HH:mm:ss", { locale: ptBR })}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-muted-foreground font-medium">Contexto</span>
                                  <p className="font-mono bg-muted p-1 rounded text-xs inline-block">{log.context}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-muted-foreground font-medium">Empresa</span>
                                  <p>{log.company?.name || 'Não informada'}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-muted-foreground font-medium">Usuário</span>
                                  <p>{log.profile?.full_name || 'Anônimo'}</p>
                                  {log.profile?.email && <p className="text-xs text-muted-foreground">{log.profile.email}</p>}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                  <Terminal className="h-4 w-4" />
                                  Mensagem para o Usuário
                                </h4>
                                <div className="p-3 bg-muted rounded-lg text-sm italic">
                                  "{log.friendly_message}"
                                </div>
                              </div>

                              <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-destructive">Erro Técnico</h4>
                                <pre className="p-3 bg-destructive/5 text-destructive border border-destructive/20 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                                  {log.technical_message}
                                  {log.error_code && `\n\nCode: ${log.error_code}`}
                                  {log.error_name && `\nName: ${log.error_name}`}
                                </pre>
                              </div>

                              {log.stack && (
                                <div className="space-y-2">
                                  <h4 className="text-sm font-semibold">Stack Trace</h4>
                                  <pre className="p-3 bg-slate-900 text-slate-300 rounded-lg text-[10px] font-mono overflow-x-auto whitespace-pre-wrap max-h-[300px]">
                                    {log.stack}
                                  </pre>
                                </div>
                              )}

                              {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <div className="space-y-2">
                                  <h4 className="text-sm font-semibold">Metadados</h4>
                                  <pre className="p-3 bg-muted rounded-lg text-[10px] font-mono overflow-x-auto">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

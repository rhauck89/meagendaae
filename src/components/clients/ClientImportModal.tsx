import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Upload, AlertCircle, CheckCircle2, XCircle, Info, Loader2, Users } from 'lucide-react';
import Papa from 'papaparse';
import { formatWhatsApp, isValidWhatsApp } from '@/lib/whatsapp';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ClientImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  onImportSuccess: () => void;
}

type Step = 'upload' | 'mapping' | 'preview' | 'importing';

interface RawRow {
  [key: string]: string;
}

interface ColumnMapping {
  name: string;
  whatsapp: string;
  email: string;
  birth_date: string;
  notes: string;
}

interface PreviewRow {
  name: string;
  whatsapp: string;
  email?: string;
  birth_date?: string;
  notes?: string;
  status: 'ready' | 'error' | 'duplicate' | 'incomplete';
  errorDetails?: string;
}

const AUTO_MAPPING_RULES: Record<keyof ColumnMapping, string[]> = {
  name: ['nome', 'cliente', 'name', 'full_name', 'nome completo'],
  whatsapp: ['whatsapp', 'telefone', 'celular', 'phone', 'contato', 'tel'],
  email: ['email', 'e-mail', 'mail'],
  birth_date: ['nascimento', 'data_nascimento', 'aniversario', 'birth_date', 'data de nascimento'],
  notes: ['observacoes', 'notes', 'comentarios', 'observação', 'obs'],
};

export function ClientImportModal({ open, onOpenChange, companyId, onImportSuccess }: ClientImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    name: '',
    whatsapp: '',
    email: '',
    birth_date: '',
    notes: '',
  });
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open]);

  const resetState = () => {
    setStep('upload');
    setHeaders([]);
    setRawData([]);
    setMapping({ name: '', whatsapp: '', email: '', birth_date: '', notes: '' });
    setPreviewData([]);
    setIsProcessing(false);
  };

  const downloadTemplate = () => {
    const csv = Papa.unparse([
      {
        nome: 'Exemplo da Silva',
        whatsapp: '31999999999',
        email: 'exemplo@gmail.com',
        data_nascimento: '1990-05-15',
        observacoes: 'Gosta de café e corte baixo',
      },
    ]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'modelo_importacao_clientes.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fileHeaders = results.meta.fields || [];
        setHeaders(fileHeaders);
        setRawData(results.data as RawRow[]);
        
        // Auto-mapping
        const newMapping = { ...mapping };
        fileHeaders.forEach(header => {
          const lowerHeader = header.toLowerCase().trim();
          Object.entries(AUTO_MAPPING_RULES).forEach(([key, aliases]) => {
            if (aliases.includes(lowerHeader) && !newMapping[key as keyof ColumnMapping]) {
              newMapping[key as keyof ColumnMapping] = header;
            }
          });
        });
        
        setMapping(newMapping);
        setStep('mapping');
      },
      error: (error) => {
        toast.error(`Erro ao ler arquivo: ${error.message}`);
      }
    });
  };

  const generatePreview = async () => {
    if (!mapping.name || !mapping.whatsapp) {
      toast.error('Mapeie pelo menos Nome e WhatsApp');
      return;
    }

    setIsProcessing(true);
    
    // Fetch existing WhatsApps to check for duplicates
    const { data: existingClients } = await supabase
      .from('clients')
      .select('whatsapp')
      .eq('company_id', companyId);
    
    const existingWas = new Set(existingClients?.map(c => c.whatsapp) || []);

    const preview: PreviewRow[] = rawData.map(row => {
      const name = row[mapping.name]?.trim();
      const rawWa = row[mapping.whatsapp]?.trim();
      const whatsapp = formatWhatsApp(rawWa);
      const email = mapping.email ? row[mapping.email]?.trim() : undefined;
      const birth_date = mapping.birth_date ? row[mapping.birth_date]?.trim() : undefined;
      const notes = mapping.notes ? row[mapping.notes]?.trim() : undefined;

      if (!name) return { name: '', whatsapp, status: 'error', errorDetails: 'Nome obrigatório' };
      if (!whatsapp || !isValidWhatsApp(whatsapp)) return { name, whatsapp: rawWa || '', status: 'error', errorDetails: 'WhatsApp inválido' };
      
      if (existingWas.has(whatsapp)) {
        return { name, whatsapp, email, birth_date, notes, status: 'duplicate', errorDetails: 'Já cadastrado' };
      }

      const isIncomplete = !email || !birth_date;
      return {
        name,
        whatsapp,
        email,
        birth_date,
        notes,
        status: isIncomplete ? 'incomplete' : 'ready'
      };
    });

    setPreviewData(preview);
    setIsProcessing(false);
    setStep('preview');
  };

  const handleImport = async () => {
    const toImport = previewData.filter(p => p.status === 'ready' || p.status === 'incomplete');
    if (toImport.length === 0) {
      toast.error('Nenhum cliente válido para importar');
      return;
    }

    setIsProcessing(true);
    setStep('importing');

    try {
      const { error } = await supabase.from('clients').insert(
        toImport.map(p => ({
          company_id: companyId,
          name: p.name,
          whatsapp: p.whatsapp,
          email: p.email || null,
          birth_date: p.birth_date || null,
          notes: p.notes || null,
          opt_in_whatsapp: true,
          registration_complete: !!(p.email && p.birth_date)
        }))
      );

      if (error) throw error;

      toast.success(`${toImport.length} clientes importados com sucesso!`);
      onImportSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Erro na importação: ${error.message}`);
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Clientes</DialogTitle>
          <DialogDescription>
            Siga os passos abaixo para importar sua base de clientes via CSV.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden py-4">
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 space-y-4">
              <div className="bg-primary/10 p-4 rounded-full">
                <Upload className="h-12 w-12 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium">Arraste seu arquivo CSV ou clique para selecionar</p>
                <p className="text-sm text-muted-foreground">Apenas arquivos .csv são suportados</p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <Upload className="h-4 w-4" /> Selecionar Arquivo
                </Button>
                <Button variant="outline" onClick={downloadTemplate} className="gap-2">
                  <Download className="h-4 w-4" /> Baixar Modelo
                </Button>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".csv" 
                className="hidden" 
              />
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(Object.keys(AUTO_MAPPING_RULES) as Array<keyof ColumnMapping>).map((key) => (
                  <div key={key} className="space-y-2">
                    <Label className="capitalize">
                      {key === 'name' ? 'Nome *' : 
                       key === 'whatsapp' ? 'WhatsApp *' : 
                       key === 'birth_date' ? 'Data de Nascimento' : 
                       key === 'email' ? 'E-mail' : 'Observações'}
                    </Label>
                    <Select 
                      value={mapping[key]} 
                      onValueChange={(val) => setMapping(m => ({ ...m, [key]: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a coluna..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">--- Não importar ---</SelectItem>
                        {headers.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="bg-muted/50 p-4 rounded-lg flex gap-3">
                <Info className="h-5 w-5 text-blue-500 shrink-0" />
                <p className="text-sm">
                  Nós tentamos mapear as colunas automaticamente, mas você pode ajustar se necessário. 
                  <strong> Nome e WhatsApp são obrigatórios.</strong>
                </p>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="flex flex-col h-full space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatsCard 
                  label="Prontos" 
                  value={previewData.filter(p => p.status === 'ready' || p.status === 'incomplete').length} 
                  icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
                />
                <StatsCard 
                  label="Duplicados" 
                  value={previewData.filter(p => p.status === 'duplicate').length} 
                  icon={<AlertCircle className="h-4 w-4 text-amber-500" />}
                />
                <StatsCard 
                  label="Erros" 
                  value={previewData.filter(p => p.status === 'error').length} 
                  icon={<XCircle className="h-4 w-4 text-red-500" />}
                />
                <StatsCard 
                  label="Total" 
                  value={previewData.length} 
                  icon={<Users className="h-4 w-4 text-blue-500" />}
                />
              </div>

              <ScrollArea className="flex-1 border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Obs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <StatusBadge status={row.status} error={row.errorDetails} />
                        </TableCell>
                        <TableCell className="font-medium">{row.name || '-'}</TableCell>
                        <TableCell>{row.whatsapp || '-'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {row.errorDetails || row.notes || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <div className="text-center">
                <p className="text-lg font-medium">Importando clientes...</p>
                <p className="text-sm text-muted-foreground">Por favor, não feche esta janela.</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {step === 'upload' && (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          )}
          {step === 'mapping' && (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('upload')}>Voltar</Button>
              <Button onClick={generatePreview} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Verificar Dados
              </Button>
            </div>
          )}
          {step === 'preview' && (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('mapping')} disabled={isProcessing}>Voltar</Button>
              <Button onClick={handleImport} disabled={isProcessing || previewData.filter(p => p.status === 'ready' || p.status === 'incomplete').length === 0}>
                Importar {previewData.filter(p => p.status === 'ready' || p.status === 'incomplete').length} Clientes
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatsCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-muted/50 p-3 rounded-lg border flex items-center justify-between">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
      {icon}
    </div>
  );
}

function StatusBadge({ status, error }: { status: PreviewRow['status']; error?: string }) {
  switch (status) {
    case 'ready':
      return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/10 border-green-200">Pronto</Badge>;
    case 'incomplete':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/10 border-blue-200 gap-1 cursor-help">
                <Info className="h-3 w-3" /> Incompleto
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Importar sem e-mail ou nascimento</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    case 'duplicate':
      return <Badge variant="outline" className="text-amber-600 border-amber-200">{error}</Badge>;
    case 'error':
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {error}</Badge>;
    default:
      return null;
  }
}

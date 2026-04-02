import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const FinanceCategories = () => {
  const { companyId } = useAuth();
  const [expCats, setExpCats] = useState<any[]>([]);
  const [revCats, setRevCats] = useState<any[]>([]);
  const [expOpen, setExpOpen] = useState(false);
  const [revOpen, setRevOpen] = useState(false);
  const [expName, setExpName] = useState('');
  const [revName, setRevName] = useState('');

  useEffect(() => {
    if (companyId) { fetchExpCats(); fetchRevCats(); }
  }, [companyId]);

  const fetchExpCats = async () => {
    const { data } = await supabase.from('company_expense_categories').select('*').eq('company_id', companyId!).order('name');
    if (data) setExpCats(data);
  };
  const fetchRevCats = async () => {
    const { data } = await supabase.from('company_revenue_categories').select('*').eq('company_id', companyId!).order('name');
    if (data) setRevCats(data);
  };

  const addExpCat = async () => {
    if (!expName.trim()) return;
    await supabase.from('company_expense_categories').insert({ company_id: companyId!, name: expName.trim() });
    toast.success('Categoria criada'); setExpName(''); setExpOpen(false); fetchExpCats();
  };
  const addRevCat = async () => {
    if (!revName.trim()) return;
    await supabase.from('company_revenue_categories').insert({ company_id: companyId!, name: revName.trim() });
    toast.success('Categoria criada'); setRevName(''); setRevOpen(false); fetchRevCats();
  };

  const deleteExpCat = async (id: string) => {
    await supabase.from('company_expense_categories').delete().eq('id', id);
    toast.success('Removida'); fetchExpCats();
  };
  const deleteRevCat = async (id: string) => {
    await supabase.from('company_revenue_categories').delete().eq('id', id);
    toast.success('Removida'); fetchRevCats();
  };

  const renderTable = (items: any[], onDelete: (id: string) => void, onAdd: () => void, open: boolean, setOpen: (v: boolean) => void, name: string, setName: (v: string) => void, label: string) => (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" /> Nova Categoria</Button></DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Nova Categoria de {label}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
              <Button onClick={onAdd} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">Nenhuma categoria</TableCell></TableRow>
          ) : items.map(c => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell><Button variant="ghost" size="icon" onClick={() => onDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold">Categorias</h2>
        <p className="text-sm text-muted-foreground">Gerencie categorias de receitas e despesas</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="expense">
            <TabsList className="mb-4">
              <TabsTrigger value="expense">Despesas</TabsTrigger>
              <TabsTrigger value="revenue">Receitas</TabsTrigger>
            </TabsList>
            <TabsContent value="expense">
              {renderTable(expCats, deleteExpCat, addExpCat, expOpen, setExpOpen, expName, setExpName, 'Despesa')}
            </TabsContent>
            <TabsContent value="revenue">
              {renderTable(revCats, deleteRevCat, addRevCat, revOpen, setRevOpen, revName, setRevName, 'Receita')}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceCategories;

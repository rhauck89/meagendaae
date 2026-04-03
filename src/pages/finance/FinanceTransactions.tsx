import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowDownCircle, ArrowUpCircle, CalendarIcon, RotateCcw } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { startOfMonth, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Transaction {
  id: string; type: 'revenue' | 'expense'; description: string; amount: number; date: string; category?: string; is_automatic?: boolean;
}

const FinanceTransactions = () => {
  const { companyId } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(new Date());

  useEffect(() => {
    if (companyId) fetchAll();
  }, [companyId, startDate, endDate]);

  const fetchAll = async () => {
    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(endDate, 'yyyy-MM-dd');

    const [{ data: revs }, { data: exps }] = await Promise.all([
      supabase.from('company_revenues').select('id, description, amount, revenue_date, is_automatic, category:company_revenue_categories(name)').eq('company_id', companyId!).gte('revenue_date', start).lte('revenue_date', end),
      supabase.from('company_expenses').select('id, description, amount, expense_date, is_recurring, category:company_expense_categories(name)').eq('company_id', companyId!).gte('expense_date', start).lte('expense_date', end),
    ]);

    const all: Transaction[] = [];
    revs?.forEach(r => all.push({ id: r.id, type: 'revenue', description: r.description, amount: Number(r.amount), date: r.revenue_date, category: (r.category as any)?.name, is_automatic: r.is_automatic }));
    exps?.forEach(e => all.push({ id: e.id, type: 'expense', description: e.description, amount: Number(e.amount), date: e.expense_date, category: (e.category as any)?.name }));
    all.sort((a, b) => b.date.localeCompare(a.date));
    setTransactions(all);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold">Movimentações</h2>
        <p className="text-sm text-muted-foreground">Todas as receitas e despesas no período</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full sm:w-[150px] justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{format(startDate, 'dd/MM/yyyy')}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={startDate} onSelect={d => d && setStartDate(d)} className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
            <span className="text-muted-foreground">—</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full sm:w-[150px] justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{format(endDate, 'dd/MM/yyyy')}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={endDate} onSelect={d => d && setEndDate(d)} disabled={d => d < startDate} className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
            <Button variant="ghost" size="sm" onClick={() => { setStartDate(startOfMonth(new Date())); setEndDate(new Date()); }}><RotateCcw className="h-3 w-3 mr-1" /> Resetar</Button>
          </div>
        </CardContent>
      </Card>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma movimentação no período</TableCell></TableRow>
                ) : transactions.map(t => (
                  <TableRow key={t.id}>
                    <TableCell>
                      {t.type === 'revenue' ? <ArrowUpCircle className="h-4 w-4 text-success" /> : <ArrowDownCircle className="h-4 w-4 text-destructive" />}
                    </TableCell>
                    <TableCell>{format(new Date(t.date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="break-words">{t.description}</TableCell>
                    <TableCell className="text-muted-foreground">{t.category || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={t.type === 'revenue' ? 'default' : 'destructive'} className="text-xs">
                        {t.type === 'revenue' ? (t.is_automatic ? 'Receita auto' : 'Receita') : 'Despesa'}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn('text-right font-semibold', t.type === 'revenue' ? 'text-success' : 'text-destructive')}>
                      {t.type === 'expense' ? '- ' : ''}R$ {t.amount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {transactions.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhuma movimentação no período</CardContent></Card>
        ) : transactions.map(t => (
          <Card key={t.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  {t.type === 'revenue' ? <ArrowUpCircle className="h-4 w-4 text-success shrink-0" /> : <ArrowDownCircle className="h-4 w-4 text-destructive shrink-0" />}
                  <span className="font-medium text-sm break-words">{t.description}</span>
                </div>
                <span className={cn('font-semibold text-sm shrink-0', t.type === 'revenue' ? 'text-success' : 'text-destructive')}>
                  {t.type === 'expense' ? '- ' : ''}R$ {t.amount.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{format(new Date(t.date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                <span>•</span>
                <span>{t.category || '—'}</span>
                <Badge variant={t.type === 'revenue' ? 'default' : 'destructive'} className="text-[10px] ml-auto">
                  {t.type === 'revenue' ? (t.is_automatic ? 'Receita auto' : 'Receita') : 'Despesa'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default FinanceTransactions;

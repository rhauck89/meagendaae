import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFinancialPrivacy } from '@/contexts/FinancialPrivacyContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  CalendarIcon, 
  RotateCcw, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Filter,
  Users,
  Briefcase,
  CreditCard,
  Layers,
  ArrowUpDown,
  User
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { startOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Transaction {
  id: string;
  type: 'revenue' | 'expense';
  description: string;
  amount: number;
  date: string;
  category?: string;
  is_automatic?: boolean;
  professional?: string;
  service?: string;
  client?: string;
  payment_method?: string;
  origin: 'Automática' | 'Manual' | 'Cashback' | 'Taxa Extra' | 'Promoção' | 'Ajuste';
  service_count?: number;
}

const FinanceTransactions = () => {
  const { companyId } = useAuth();
  const { maskValue } = useFinancialPrivacy();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(new Date());
  
  // Filters
  const [filters, setFilters] = useState({
    client: 'Todos',
    professional: 'Todos',
    service: 'Todos',
    payment_method: 'Todos',
    origin: 'Todos',
  });

  // Sorting
  const [sort, setSort] = useState<{ key: keyof Transaction, direction: 'asc' | 'desc' }>({
    key: 'date',
    direction: 'desc'
  });

  useEffect(() => {
    if (companyId) fetchAll();
  }, [companyId, startDate, endDate]);

  const fetchAll = async () => {
    setLoading(true);
    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(endDate, 'yyyy-MM-dd');

    const [{ data: revs }, { data: exps }] = await Promise.all([
      supabase.from('company_revenues')
        .select(`
          id, 
          description, 
          amount, 
          revenue_date, 
          is_automatic, 
          payment_method,
          client_name,
          professional_name,
          service_name,
          category:company_revenue_categories(name),
          appointment:appointments(
            appointment_services(count)
          )
        `)
        .eq('company_id', companyId!)
        .gte('revenue_date', start)
        .lte('revenue_date', end),
      supabase.from('company_expenses')
        .select('id, description, amount, expense_date, is_recurring, category:company_expense_categories(name)')
        .eq('company_id', companyId!)
        .gte('expense_date', start)
        .lte('expense_date', end),
    ]);

    const all: Transaction[] = [];
    
    revs?.forEach(r => {
      const categoryName = (r.category as any)?.name;
      let origin: Transaction['origin'] = r.is_automatic ? 'Automática' : 'Manual';
      
      if (categoryName === 'Cashback') origin = 'Cashback';
      else if (categoryName === 'Taxa Extra') origin = 'Taxa Extra';
      else if (categoryName === 'Promoções' || categoryName === 'Promoção') origin = 'Promoção';
      else if (categoryName === 'Ajuste') origin = 'Ajuste';

      const serviceCount = (r.appointment as any)?.appointment_services?.[0]?.count || 1;

      all.push({ 
        id: r.id, 
        type: 'revenue', 
        description: r.description, 
        amount: Number(r.amount), 
        date: r.revenue_date, 
        category: categoryName, 
        is_automatic: r.is_automatic,
        client: r.client_name || (r.description.includes(' — ') ? r.description.split(' — ')[0] : 'Manual'),
        professional: r.professional_name || 'Admin',
        service: r.service_name || (r.description.includes(' — ') ? r.description.split(' — ')[1] : r.description),
        payment_method: r.payment_method || 'Pendente',
        origin: origin,
        service_count: serviceCount
      });
    });

    exps?.forEach(e => {
      all.push({ 
        id: e.id, 
        type: 'expense', 
        description: e.description, 
        amount: Number(e.amount), 
        date: e.expense_date, 
        category: (e.category as any)?.name,
        origin: 'Manual',
        payment_method: 'Saída'
      });
    });

    setTransactions(all);
    setLoading(false);
  };

  const handleSort = (key: keyof Transaction) => {
    setSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        if (filters.client !== 'Todos' && t.client !== filters.client) return false;
        if (filters.professional !== 'Todos' && t.professional !== filters.professional) return false;
        if (filters.service !== 'Todos' && t.service !== filters.service) return false;
        if (filters.payment_method !== 'Todos' && t.payment_method !== filters.payment_method) return false;
        if (filters.origin !== 'Todos' && t.origin !== filters.origin) return false;
        return true;
      })
      .sort((a, b) => {
        const valA = a[sort.key] ?? '';
        const valB = b[sort.key] ?? '';
        
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sort.direction === 'asc' ? valA - valB : valB - valA;
        }
        
        return sort.direction === 'asc' 
          ? String(valA).localeCompare(String(valB)) 
          : String(valB).localeCompare(String(valA));
      });
  }, [transactions, filters, sort]);

  const totals = useMemo(() => {
    const totalAmount = filteredTransactions.reduce((acc, t) => {
      return acc + (t.type === 'revenue' ? t.amount : -t.amount);
    }, 0);
    return {
      count: filteredTransactions.length,
      amount: totalAmount
    };
  }, [filteredTransactions]);

  const filterOptions = useMemo(() => {
    const opts = {
      clients: new Set<string>(),
      professionals: new Set<string>(),
      services: new Set<string>(),
      payment_methods: new Set<string>(),
    };

    transactions.forEach(t => {
      if (t.client) opts.clients.add(t.client);
      if (t.professional) opts.professionals.add(t.professional);
      if (t.service) opts.services.add(t.service);
      if (t.payment_method) opts.payment_methods.add(t.payment_method);
    });

    return {
      clients: Array.from(opts.clients).sort(),
      professionals: Array.from(opts.professionals).sort(),
      services: Array.from(opts.services).sort(),
      payment_methods: Array.from(opts.payment_methods).sort(),
    };
  }, [transactions]);

  const FilterHeader = ({ 
    label, 
    options, 
    filterKey 
  }: { 
    label: string, 
    options: string[], 
    filterKey: keyof typeof filters 
  }) => {
    const selected = filters[filterKey];
    return (
      <Popover>
        <PopoverTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors group select-none py-2 px-1 rounded-md hover:bg-muted/50 w-full">
            <span className="font-bold text-xs uppercase tracking-wider">{label}</span>
            <ChevronDown className={cn("h-3 w-3 transition-transform shrink-0", selected !== 'Todos' ? "text-primary" : "text-muted-foreground")} />
            {selected !== 'Todos' && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="space-y-1 max-h-60 overflow-y-auto scrollbar-thin">
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn("w-full justify-start text-xs font-normal", selected === 'Todos' && "bg-accent text-accent-foreground")}
              onClick={() => setFilters(prev => ({ ...prev, [filterKey]: 'Todos' }))}
            >
              <Check className={cn("mr-2 h-3 w-3 opacity-0", selected === 'Todos' && "opacity-100")} />
              Todos
            </Button>
            {options.map(opt => (
              <Button 
                key={opt}
                variant="ghost" 
                size="sm" 
                className={cn("w-full justify-start text-xs font-normal", selected === opt && "bg-accent text-accent-foreground")}
                onClick={() => setFilters(prev => ({ ...prev, [filterKey]: opt }))}
              >
                <Check className={cn("mr-2 h-3 w-3 opacity-0", selected === opt && "opacity-100")} />
                {opt}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  const SortableHeader = ({ 
    label, 
    sortKey,
    className
  }: { 
    label: string, 
    sortKey: keyof Transaction,
    className?: string
  }) => {
    const isActive = sort.key === sortKey;
    return (
      <TableHead className={cn("cursor-pointer hover:text-foreground transition-colors group select-none", className)} onClick={() => handleSort(sortKey)}>
        <div className="flex items-center gap-1.5 py-2 px-1 rounded-md hover:bg-muted/50">
          <span className="font-bold text-xs uppercase tracking-wider">{label}</span>
          <div className="flex flex-col opacity-30 group-hover:opacity-100 transition-opacity">
            <ChevronUp className={cn("h-2.5 w-2.5 -mb-1", isActive && sort.direction === 'asc' ? "text-primary opacity-100" : "")} />
            <ChevronDown className={cn("h-2.5 w-2.5", isActive && sort.direction === 'desc' ? "text-primary opacity-100" : "")} />
          </div>
        </div>
      </TableHead>
    );
  }

  const DateHeader = ({ label }: { label: string }) => {
    return (
      <TableHead className="w-[140px] p-0">
        <Popover>
          <PopoverTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors group select-none py-2 px-3 rounded-md hover:bg-muted/50">
              <span className="font-bold text-xs uppercase tracking-wider">{label}</span>
              <CalendarIcon className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm font-bold">Filtrar por Período</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setStartDate(startOfMonth(new Date())); setEndDate(new Date()); }}>
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[10px] text-muted-foreground uppercase">Início</span>
                  <Calendar mode="single" selected={startDate} onSelect={d => d && setStartDate(d)} className="rounded-md border shadow-sm pointer-events-auto" locale={ptBR} />
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] text-muted-foreground uppercase">Fim</span>
                  <Calendar mode="single" selected={endDate} onSelect={d => d && setEndDate(d)} disabled={d => d < startDate} className="rounded-md border shadow-sm pointer-events-auto" locale={ptBR} />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </TableHead>
    );
  };

  const OriginBadge = ({ origin }: { origin?: Transaction['origin'] }) => {
    if (!origin) return null;
    const variants: Record<string, string> = {
      'Automática': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200',
      'Manual': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border-gray-200',
      'Cashback': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200',
      'Taxa Extra': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200',
      'Promoção': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200',
      'Ajuste': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200'
    };
    return (
      <Badge variant="outline" className={cn("text-[10px] font-medium px-2 py-0.5", variants[origin])}>
        {origin}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold">Movimentações</h2>
          <p className="text-sm text-muted-foreground italic">Controle financeiro detalhado e transparente</p>
        </div>
        
        <div className="flex items-center gap-4 bg-background/50 backdrop-blur-sm p-4 rounded-xl border border-border shadow-sm">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Resultados</p>
            <p className="text-xl font-display font-bold leading-none">{totals.count}</p>
          </div>
          <div className="w-px h-8 bg-border/50" />
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Total Filtrado</p>
            <p className={cn("text-xl font-display font-bold leading-none", totals.amount >= 0 ? "text-success" : "text-destructive")}>
              {maskValue(totals.amount)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 lg:hidden">
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 bg-background shadow-sm"
          onClick={() => { 
            setStartDate(startOfMonth(new Date())); 
            setEndDate(new Date());
            setFilters({ client: 'Todos', professional: 'Todos', service: 'Todos', payment_method: 'Todos', origin: 'Todos' });
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" /> 
          Resetar Filtros
        </Button>
        
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 bg-background shadow-sm">
              <Filter className="h-3.5 w-3.5" />
              Opções de Filtro
              {Object.values(filters).some(v => v !== 'Todos') && (
                <Badge className="h-5 w-5 rounded-full p-0 flex items-center justify-center">
                  {Object.values(filters).filter(v => v !== 'Todos').length}
                </Badge>
              )}
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Filtros Avançados</DrawerTitle>
            </DrawerHeader>
            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-muted-foreground"><User className="h-3.5 w-3.5 text-primary" /> Cliente</label>
                <select 
                  className="w-full border rounded-lg p-3 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  value={filters.client}
                  onChange={(e) => setFilters(f => ({ ...f, client: e.target.value }))}
                >
                  <option value="Todos">Todos os clientes</option>
                  {filterOptions.clients.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-muted-foreground"><Users className="h-3.5 w-3.5 text-primary" /> Profissional</label>
                <select 
                  className="w-full border rounded-lg p-3 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  value={filters.professional}
                  onChange={(e) => setFilters(f => ({ ...f, professional: e.target.value }))}
                >
                  <option value="Todos">Todos os profissionais</option>
                  {filterOptions.professionals.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-muted-foreground"><Briefcase className="h-3.5 w-3.5 text-primary" /> Serviço</label>
                <select 
                  className="w-full border rounded-lg p-3 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  value={filters.service}
                  onChange={(e) => setFilters(f => ({ ...f, service: e.target.value }))}
                >
                  <option value="Todos">Todos os serviços</option>
                  {filterOptions.services.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-muted-foreground"><CreditCard className="h-3.5 w-3.5 text-primary" /> Pagamento</label>
                <select 
                  className="w-full border rounded-lg p-3 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  value={filters.payment_method}
                  onChange={(e) => setFilters(f => ({ ...f, payment_method: e.target.value }))}
                >
                  <option value="Todos">Todas as formas de pagamento</option>
                  {filterOptions.payment_methods.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                </select>
              </div>
            </div>
            <DrawerFooter className="pt-2 border-t">
              <DrawerClose asChild>
                <Button className="w-full h-12 text-base font-bold">Aplicar Filtros</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Desktop table */}
      <Card className="hidden lg:block border shadow-sm overflow-hidden bg-background">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40 border-b">
                <TableRow className="hover:bg-transparent">
                  <DateHeader label="Data" />
                  <TableHead>
                    <FilterHeader label="Cliente" options={filterOptions.clients} filterKey="client" />
                  </TableHead>
                  <TableHead>
                    <FilterHeader label="Profissional" options={filterOptions.professionals} filterKey="professional" />
                  </TableHead>
                  <TableHead>
                    <FilterHeader label="Serviço" options={filterOptions.services} filterKey="service" />
                  </TableHead>
                  <SortableHeader label="Valor" sortKey="amount" className="text-right w-[140px]" />
                  <SortableHeader label="Tipo" sortKey="origin" className="w-[140px]" />
                  <TableHead className="w-[180px]">
                    <FilterHeader label="Pagamento" options={filterOptions.payment_methods} filterKey="payment_method" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-24 text-muted-foreground font-medium">Carregando movimentações...</TableCell></TableRow>
                ) : filteredTransactions.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-16 font-medium">Nenhuma movimentação encontrada com os filtros atuais</TableCell></TableRow>
                ) : filteredTransactions.map(t => (
                  <TableRow key={t.id} className="group hover:bg-muted/30 transition-colors border-b last:border-0">
                    <TableCell className="text-xs font-bold text-muted-foreground whitespace-nowrap px-4">
                      {format(new Date(t.date + 'T12:00:00'), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {t.client || '—'}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {t.professional || '—'}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-foreground/90">
                      {t.service ? (
                        <div className="flex items-center gap-2">
                          {t.service}
                          {t.service_count && t.service_count > 1 && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1 leading-none font-bold">+{t.service_count - 1}</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic text-xs truncate max-w-[200px] inline-block">{t.description}</span>
                      )}
                    </TableCell>
                    <TableCell className={cn('text-right font-bold text-sm px-4', t.type === 'revenue' ? 'text-success' : 'text-destructive')}>
                      {t.type === 'expense' ? '- ' : ''}{maskValue(t.amount)}
                    </TableCell>
                    <TableCell>
                      <OriginBadge origin={t.origin} />
                    </TableCell>
                    <TableCell className="px-4">
                      <Badge variant="outline" className="text-[10px] font-bold bg-muted/20 border-border/50 uppercase tracking-tighter">
                        {t.payment_method || '—'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile/Tablet View */}
      <div className="lg:hidden space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <p className="font-medium animate-pulse">Organizando finanças...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <Card className="border-dashed shadow-none"><CardContent className="p-12 text-center text-muted-foreground font-medium">Nenhuma movimentação encontrada</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredTransactions.map(t => (
              <Card key={t.id} className="overflow-hidden border border-border/60 hover:border-primary/30 transition-colors shadow-sm bg-background group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3">
                      <div className={cn("p-2 rounded-xl mt-1 shrink-0", t.type === 'revenue' ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                        {t.type === 'revenue' ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-sm text-foreground leading-tight truncate">
                          {t.service || t.description}
                          {t.service_count && t.service_count > 1 && ` (+${t.service_count - 1})`}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] font-bold text-muted-foreground">{format(new Date(t.date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                          <span className="text-[10px] text-muted-foreground/50">•</span>
                          <span className="text-[11px] font-medium text-primary/80">{t.professional || 'Admin'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className={cn('font-display font-bold text-base tracking-tight', t.type === 'revenue' ? 'text-success' : 'text-destructive')}>
                        {t.type === 'expense' ? '- ' : ''}{maskValue(t.amount)}
                      </span>
                      <OriginBadge origin={t.origin} />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-dashed border-border/50">
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {t.payment_method || '—'}
                      </span>
                    </div>
                    <div className="text-[10px] font-medium text-muted-foreground/40 font-mono tracking-tighter">
                      ID #{t.id.slice(0, 8)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FinanceTransactions;

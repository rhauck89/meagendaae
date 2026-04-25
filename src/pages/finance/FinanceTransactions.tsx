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
  Search,
  Users,
  Briefcase,
  CreditCard,
  Layers,
  Target
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { startOfMonth, format, isSunday } from 'date-fns';
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
  payment_method?: string;
  origin?: 'Automática' | 'Manual' | 'Cashback' | 'Taxa Extra' | 'Promoção' | 'Ajuste';
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
    professional: 'Todos',
    service: 'Todos',
    payment_method: 'Todos',
    origin: 'Todos',
    category: 'Todos'
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
          category:company_revenue_categories(name),
          professional:profiles(full_name),
          service:services(name),
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
      else if (categoryName === 'Promoções') origin = 'Promoção';
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
        professional: (r.professional as any)?.full_name,
        service: (r.service as any)?.name,
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
        category: (e.category as any)?.name 
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
        if (filters.professional !== 'Todos' && t.professional !== filters.professional) return false;
        if (filters.service !== 'Todos' && t.service !== filters.service) return false;
        if (filters.payment_method !== 'Todos' && t.payment_method !== filters.payment_method) return false;
        if (filters.origin !== 'Todos' && t.origin !== filters.origin) return false;
        if (filters.category !== 'Todos' && t.category !== filters.category) return false;
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
      professionals: new Set<string>(),
      services: new Set<string>(),
      payment_methods: new Set<string>(),
      origins: new Set<string>(),
      categories: new Set<string>()
    };

    transactions.forEach(t => {
      if (t.professional) opts.professionals.add(t.professional);
      if (t.service) opts.services.add(t.service);
      if (t.payment_method) opts.payment_methods.add(t.payment_method);
      if (t.origin) opts.origins.add(t.origin);
      if (t.category) opts.categories.add(t.category);
    });

    return {
      professionals: Array.from(opts.professionals).sort(),
      services: Array.from(opts.services).sort(),
      payment_methods: Array.from(opts.payment_methods).sort(),
      origins: Array.from(opts.origins).sort(),
      categories: Array.from(opts.categories).sort()
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
          <div className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors group">
            {label}
            <ChevronDown className={cn("h-3 w-3 transition-transform", selected !== 'Todos' ? "text-primary" : "text-muted-foreground")} />
            {selected !== 'Todos' && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="space-y-1 max-h-60 overflow-y-auto">
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
        <div className="flex items-center gap-1">
          {label}
          <div className="flex flex-col opacity-30 group-hover:opacity-100 transition-opacity">
            <ChevronUp className={cn("h-2.5 w-2.5 -mb-1", isActive && sort.direction === 'asc' ? "text-primary opacity-100" : "")} />
            <ChevronDown className={cn("h-2.5 w-2.5", isActive && sort.direction === 'desc' ? "text-primary opacity-100" : "")} />
          </div>
        </div>
      </TableHead>
    );
  }

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
      <Badge variant="outline" className={cn("text-[10px] font-medium px-1.5 py-0", variants[origin])}>
        {origin}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold">Movimentações</h2>
          <p className="text-sm text-muted-foreground">Painel inteligente de análise financeira</p>
        </div>
        
        <div className="flex items-center gap-4 bg-muted/40 p-3 rounded-lg border border-border/50">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Resultados</p>
            <p className="text-lg font-bold">{totals.count}</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Filtrado</p>
            <p className={cn("text-lg font-bold", totals.amount >= 0 ? "text-success" : "text-destructive")}>
              {maskValue(totals.amount)}
            </p>
          </div>
        </div>
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
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { 
                setStartDate(startOfMonth(new Date())); 
                setEndDate(new Date());
                setFilters({ professional: 'Todos', service: 'Todos', payment_method: 'Todos', origin: 'Todos', category: 'Todos' });
              }}
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Resetar
            </Button>

            <div className="ml-auto md:hidden">
              <Drawer>
                <DrawerTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Filtrar
                    {Object.values(filters).some(v => v !== 'Todos') && (
                      <Badge className="h-5 w-5 rounded-full p-0 flex items-center justify-center">
                        {Object.values(filters).filter(v => v !== 'Todos').length}
                      </Badge>
                    )}
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader>
                    <DrawerTitle>Filtros</DrawerTitle>
                  </DrawerHeader>
                  <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
                    <div className="space-y-2">
                      <label className="text-xs font-medium flex items-center gap-2 text-muted-foreground"><Users className="h-3 w-3" /> Profissional</label>
                      <select 
                        className="w-full border rounded-md p-2 text-sm bg-background"
                        value={filters.professional}
                        onChange={(e) => setFilters(f => ({ ...f, professional: e.target.value }))}
                      >
                        <option value="Todos">Todos</option>
                        {filterOptions.professionals.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium flex items-center gap-2 text-muted-foreground"><Briefcase className="h-3 w-3" /> Serviço</label>
                      <select 
                        className="w-full border rounded-md p-2 text-sm bg-background"
                        value={filters.service}
                        onChange={(e) => setFilters(f => ({ ...f, service: e.target.value }))}
                      >
                        <option value="Todos">Todos</option>
                        {filterOptions.services.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium flex items-center gap-2 text-muted-foreground"><CreditCard className="h-3 w-3" /> Pagamento</label>
                      <select 
                        className="w-full border rounded-md p-2 text-sm bg-background"
                        value={filters.payment_method}
                        onChange={(e) => setFilters(f => ({ ...f, payment_method: e.target.value }))}
                      >
                        <option value="Todos">Todos</option>
                        {filterOptions.payment_methods.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium flex items-center gap-2 text-muted-foreground"><Layers className="h-3 w-3" /> Origem</label>
                      <select 
                        className="w-full border rounded-md p-2 text-sm bg-background"
                        value={filters.origin}
                        onChange={(e) => setFilters(f => ({ ...f, origin: e.target.value }))}
                      >
                        <option value="Todos">Todos</option>
                        {filterOptions.origins.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium flex items-center gap-2 text-muted-foreground"><Target className="h-3 w-3" /> Categoria</label>
                      <select 
                        className="w-full border rounded-md p-2 text-sm bg-background"
                        value={filters.category}
                        onChange={(e) => setFilters(f => ({ ...f, category: e.target.value }))}
                      >
                        <option value="Todos">Todos</option>
                        {filterOptions.categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <DrawerFooter>
                    <DrawerClose asChild>
                      <Button className="w-full">Aplicar</Button>
                    </DrawerClose>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Desktop table */}
      <Card className="hidden lg:block overflow-hidden border-none shadow-md">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10"></TableHead>
                  <SortableHeader label="Data" sortKey="date" className="w-[100px]" />
                  <SortableHeader label="Cliente / Descrição" sortKey="description" />
                  <TableHead className="w-[150px]">
                    <FilterHeader label="Profissional" options={filterOptions.professionals} filterKey="professional" />
                  </TableHead>
                  <TableHead className="w-[150px]">
                    <FilterHeader label="Serviço" options={filterOptions.services} filterKey="service" />
                  </TableHead>
                  <TableHead className="w-[120px]">
                    <FilterHeader label="Categoria" options={filterOptions.categories} filterKey="category" />
                  </TableHead>
                  <TableHead className="w-[120px]">
                    <FilterHeader label="Origem" options={filterOptions.origins} filterKey="origin" />
                  </TableHead>
                  <TableHead className="w-[120px]">
                    <FilterHeader label="Pagamento" options={filterOptions.payment_methods} filterKey="payment_method" />
                  </TableHead>
                  <SortableHeader label="Valor" sortKey="amount" className="text-right w-[120px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-20">Carregando movimentações...</TableCell></TableRow>
                ) : filteredTransactions.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-12">Nenhuma movimentação encontrada com os filtros atuais</TableCell></TableRow>
                ) : filteredTransactions.map(t => (
                  <TableRow key={t.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell>
                      {t.type === 'revenue' ? (
                        <div className="bg-success/10 p-1.5 rounded-full w-fit">
                          <ArrowUpCircle className="h-4 w-4 text-success" />
                        </div>
                      ) : (
                        <div className="bg-destructive/10 p-1.5 rounded-full w-fit">
                          <ArrowDownCircle className="h-4 w-4 text-destructive" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-muted-foreground">
                      {format(new Date(t.date + 'T12:00:00'), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{t.description}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.professional || '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.service ? (
                        <div className="flex items-center gap-1.5">
                          {t.service}
                          {t.service_count && t.service_count > 1 && (
                            <Badge variant="secondary" className="text-[9px] h-4 px-1 leading-none">+{t.service_count - 1}</Badge>
                          )}
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.category || '—'}
                    </TableCell>
                    <TableCell>
                      <OriginBadge origin={t.origin} />
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {t.type === 'revenue' ? (
                        <Badge variant="outline" className="text-[10px] bg-background">
                          {t.payment_method || '—'}
                        </Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell className={cn('text-right font-bold text-sm', t.type === 'revenue' ? 'text-success' : 'text-destructive')}>
                      {t.type === 'expense' ? '- ' : ''}{maskValue(t.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Tablet/Smaller Laptop View */}
      <Card className="hidden md:block lg:hidden overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <SortableHeader label="Data" sortKey="date" />
                <SortableHeader label="Descrição" sortKey="description" />
                <SortableHeader label="Valor" sortKey="amount" className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map(t => (
                <TableRow key={t.id}>
                  <TableCell>
                    {t.type === 'revenue' ? <ArrowUpCircle className="h-4 w-4 text-success" /> : <ArrowDownCircle className="h-4 w-4 text-destructive" />}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {format(new Date(t.date + 'T12:00:00'), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{t.description}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <OriginBadge origin={t.origin} />
                      <Badge variant="outline" className="text-[9px]">{t.payment_method}</Badge>
                      {t.professional && <Badge variant="secondary" className="text-[9px]">{t.professional}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className={cn('text-right font-bold text-sm', t.type === 'revenue' ? 'text-success' : 'text-destructive')}>
                    {t.type === 'expense' ? '- ' : ''}{maskValue(t.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <p className="text-center py-10 text-muted-foreground">Carregando...</p>
        ) : filteredTransactions.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhuma movimentação encontrada</CardContent></Card>
        ) : filteredTransactions.map(t => (
          <Card key={t.id} className="overflow-hidden border-l-4 border-l-primary/10 group active:scale-[0.98] transition-transform">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn("p-1.5 rounded-full", t.type === 'revenue' ? "bg-success/10" : "bg-destructive/10")}>
                    {t.type === 'revenue' ? <ArrowUpCircle className="h-4 w-4 text-success shrink-0" /> : <ArrowDownCircle className="h-4 w-4 text-destructive shrink-0" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm leading-tight">{t.description}</span>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(t.date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className={cn('font-bold text-base', t.type === 'revenue' ? 'text-success' : 'text-destructive')}>
                    {t.type === 'expense' ? '- ' : ''}{maskValue(t.amount)}
                  </span>
                  <Badge variant="outline" className="text-[9px] h-4 mt-0.5">{t.payment_method || '—'}</Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dashed">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] uppercase text-muted-foreground font-medium">Profissional</span>
                  <span className="text-xs font-medium truncate">{t.professional || '—'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] uppercase text-muted-foreground font-medium">Serviço</span>
                  <span className="text-xs font-medium truncate">
                    {t.service || '—'}
                    {t.service_count && t.service_count > 1 && ` +${t.service_count - 1}`}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-muted/50">
                <div className="flex items-center gap-2">
                  <OriginBadge origin={t.origin} />
                  <span className="text-[10px] text-muted-foreground">{t.category}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  ID: #{t.id.slice(0, 4)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default FinanceTransactions;
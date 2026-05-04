
import React, { useState } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription,
  SheetClose
} from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  BarChart3, 
  Clock, 
  Calendar as CalendarIcon, 
  X, 
  TrendingUp, 
  Users, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Flame,
  Moon,
  Ban,
  Filter
} from 'lucide-react';

import { 
  format, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth,
  subDays,
  parseISO
} from 'date-fns';

import { ptBR } from 'date-fns/locale';
import { useOccupancyData, OccupancyPeriod } from '@/hooks/useOccupancyData';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  AreaChart, 
  Area 
} from 'recharts';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


interface OccupancyDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  professionals: any[];
}

export const OccupancyDrawer = ({ open, onOpenChange, companyId, professionals }: OccupancyDrawerProps) => {
  const [period, setPeriod] = useState<OccupancyPeriod>('month');
  const [professionalId, setProfessionalId] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  });

  const { loading, data } = useOccupancyData({
    companyId,
    professionalId,
    dateRange,
    period
  });

  const handlePeriodChange = (val: string) => {
    const p = val as OccupancyPeriod;
    setPeriod(p);
    const now = new Date();
    if (p === 'day') {
      setDateRange({ start: startOfDay(now), end: endOfDay(now) });
    } else if (p === 'week') {
      setDateRange({ start: startOfWeek(now, { locale: ptBR }), end: endOfWeek(now, { locale: ptBR }) });
    } else if (p === 'month') {
      setDateRange({ start: startOfMonth(now), end: endOfMonth(now) });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[600px] overflow-y-auto bg-muted/30 p-0 sm:p-0 border-l [&>button]:hidden">
        <div className="flex flex-col h-full">
          <SheetHeader className="p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] bg-white border-b sticky top-0 z-10 shadow-sm text-left">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <SheetTitle className="text-2xl font-display font-bold flex items-center gap-2">
                  <BarChart3 className="h-6 w-6 text-primary" />
                  Taxa de Ocupação
                </SheetTitle>
                <SheetDescription>
                  Relatório detalhado de produtividade e capacidade
                </SheetDescription>
              </div>
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 -mr-2 -mt-2 rounded-full hover:bg-muted transition-colors">
                  <X className="h-6 w-6 text-muted-foreground" />
                </Button>
              </SheetClose>
            </div>

            <div className="flex flex-wrap gap-3 mt-6">
              <div className="flex-1 min-w-[140px]">
                <Tabs value={period} onValueChange={handlePeriodChange} className="w-full">
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="day">Dia</TabsTrigger>
                    <TabsTrigger value="week">Semana</TabsTrigger>
                    <TabsTrigger value="month">Mês</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="flex-1 min-w-[140px]">
                <Select value={professionalId} onValueChange={setProfessionalId}>
                  <SelectTrigger className="bg-white">
                    <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Profissional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Profissionais</SelectItem>
                    {professionals.map(p => (
                      <SelectItem key={p.profile_id} value={p.profile_id}>
                        {p.profile?.full_name || 'Profissional'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 p-6 space-y-6 pb-20">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground animate-pulse">Calculando métricas reais...</p>
              </div>
            ) : data ? (
              <>
                {/* Main Metric Card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-primary text-primary-foreground border-none shadow-lg overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <TrendingUp className="h-24 w-24" />
                    </div>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium opacity-90 uppercase tracking-wider">Ocupação Atual</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-display font-black">{data.summary.occupancyRate}%</span>
                        <Badge variant="secondary" className="bg-white/20 text-white border-none">
                          {data.summary.totalOccupiedSlots} / {data.summary.totalAvailableSlots} slots
                        </Badge>
                      </div>
                      <p className="text-xs mt-4 opacity-80">
                        Baseado em horários totais disponíveis vs. agendamentos confirmados
                      </p>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-2 gap-3">
                    <Card className="bg-white border-none shadow-sm">
                      <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <Users className="h-5 w-5 text-accent mb-2" />
                        <span className="text-2xl font-bold">{data.summary.totalOccupiedSlots}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Ocupados</span>
                      </CardContent>
                    </Card>
                    <Card className="bg-white border-none shadow-sm">
                      <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <Clock className="h-5 w-5 text-success mb-2" />
                        <span className="text-2xl font-bold">{data.summary.freeSlots}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Livres</span>
                      </CardContent>
                    </Card>
                    <Card className="bg-white border-none shadow-sm">
                      <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <XCircle className="h-5 w-5 text-destructive mb-2" />
                        <span className="text-2xl font-bold">{data.summary.cancelled}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Cancelados</span>
                      </CardContent>
                    </Card>
                    <Card className="bg-white border-none shadow-sm">
                      <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <RefreshCw className="h-5 w-5 text-warning mb-2" />
                        <span className="text-2xl font-bold">{data.summary.rescheduled}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Reagendados</span>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Graph */}
                <Card className="bg-white border-none shadow-sm overflow-hidden">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Tendência de Ocupação
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.dailyStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10 }}
                            tickFormatter={(str) => format(parseISO(str), 'dd/MM')} 
                          />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} unit="%" />
                          <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            labelFormatter={(str) => format(parseISO(str), "dd 'de' MMMM", { locale: ptBR })}
                          />
                          <Area type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorRate)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Specific Insights */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-white border-none shadow-sm">
                    <CardHeader className="pb-3 border-b border-muted/50">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Flame className="h-4 w-4 text-orange-500" />
                        Horários de Pico
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                      {data.peaks.mostRequested.length > 0 ? (
                        data.peaks.mostRequested.map((p: any, i: number) => (
                          <div key={p.hour} className="flex items-center justify-between">
                            <span className="text-sm font-medium">{p.hour}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-muted-foreground">{p.count} agend.</span>
                              <div className={cn("h-1.5 rounded-full bg-orange-500", i === 0 ? "w-12" : i === 1 ? "w-8" : "w-4")} />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Dados insuficientes</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-none shadow-sm">
                    <CardHeader className="pb-3 border-b border-muted/50">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Moon className="h-4 w-4 text-slate-500" />
                        Menor Procura
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                      {data.peaks.leastRequested.length > 0 ? (
                        data.peaks.leastRequested.map((p: any, i: number) => (
                          <div key={p.hour} className="flex items-center justify-between">
                            <span className="text-sm font-medium">{p.hour}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-muted-foreground">{p.count} agend.</span>
                              <div className={cn("h-1.5 rounded-full bg-slate-300", i === 0 ? "w-4" : i === 1 ? "w-3" : "w-2")} />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Dados insuficientes</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Day/Week Highlights */}
                {data.highlights.bestDay && (
                  <Card className="bg-success/5 border border-success/20">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-success" />
                        </div>
                        <div>
                          <p className="text-xs text-success font-bold uppercase tracking-wider">Melhor Dia do Período</p>
                          <p className="text-sm font-semibold capitalize">
                            {format(parseISO(data.highlights.bestDay.date), "EEEE, dd/MM", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-success">{data.highlights.bestDay.rate}%</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Ocupação</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* View Mode Specifics */}
                {period === 'day' && (
                  <Card className="bg-white border-none shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold">Visão Detalhada do Dia</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground uppercase">Disponíveis</p>
                          <p className="text-lg font-bold">{data.summary.totalAvailableSlots}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground uppercase">Agendados</p>
                          <p className="text-lg font-bold">{data.summary.totalOccupiedSlots}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground uppercase">Cancelados</p>
                          <p className="text-lg font-bold">{data.summary.cancelled}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground uppercase">Livres</p>
                          <p className="text-lg font-bold">{data.summary.freeSlots}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default OccupancyDrawer;


import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  Download, 
  Search, 
  Filter, 
  Calendar as CalendarIcon,
  TrendingUp,
  MousePointer2,
  Eye,
  Trophy,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import BannerDetailDialog from './BannerDetailDialog';

const ReportsTab = () => {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    activeBanners: 0,
    totalImpressions: 0,
    totalClicks: 0,
    avgCtr: 0,
    bestCtrBanner: null as any,
    mostImpressionsBanner: null as any,
    mostClicksBanner: null as any
  });

  // Filters
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [filters, setFilters] = useState({
    status: 'all',
    position: 'all',
    state: 'all',
    city: '',
    category: 'all',
    advertiser: '',
    bannerId: 'all'
  });

  const fetchReport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_marketplace_banner_report', {
        p_start_date: dateRange.from.toISOString(),
        p_end_date: dateRange.to.toISOString(),
        p_status: filters.status === 'all' ? null : filters.status,
        p_position: filters.position === 'all' ? null : filters.position,
        p_state: filters.state === 'all' ? null : filters.state,
        p_city: filters.city || null,
        p_category: filters.category === 'all' ? null : filters.category,
        p_advertiser: filters.advertiser || null,
        p_banner_id: filters.bannerId === 'all' ? null : filters.bannerId
      });

      if (error) throw error;

      if (data) {
        setReportData(data);
        
        // Calculate Summary
        const active = data.filter((b: any) => b.r_status === 'active').length;
        const impressions = data.reduce((acc: number, b: any) => acc + Number(b.r_impressions), 0);
        const clicks = data.reduce((acc: number, b: any) => acc + Number(b.r_clicks), 0);
        const avgCtr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        
        const bestCtr = [...data].sort((a, b) => b.r_ctr - a.r_ctr)[0];
        const mostImp = [...data].sort((a, b) => Number(b.r_impressions) - Number(a.r_impressions))[0];
        const mostClicks = [...data].sort((a, b) => Number(b.r_clicks) - Number(a.r_clicks))[0];

        setSummary({
          activeBanners: active,
          totalImpressions: impressions,
          totalClicks: clicks,
          avgCtr: avgCtr,
          bestCtrBanner: bestCtr,
          mostImpressionsBanner: mostImp,
          mostClicksBanner: mostClicks
        });
      }
    } catch (error: any) {
      console.error('Error fetching report:', error);
      toast.error('Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [dateRange]); // Refetch when date changes, for other filters we'll use a button

  const handleExportCSV = () => {
    if (reportData.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const headers = [
      'Campanha', 'Anunciante', 'Posição', 'Estado', 'Cidade', 'Categoria', 
      'Status', 'Impressões', 'Cliques', 'CTR %', 'Data Início', 'Data Fim', 
      'Modelo Comercial', 'Limite Imp.', 'Limite Cliques'
    ];

    const rows = reportData.map(b => [
      b.r_name,
      b.r_client_name || '-',
      b.r_position,
      b.r_state || 'Nacional',
      b.r_city || 'Todas',
      b.r_category || 'Todas',
      b.r_status,
      b.r_impressions,
      b.r_clicks,
      b.r_ctr.toFixed(2),
      format(new Date(b.r_start_date), 'dd/MM/yyyy'),
      format(new Date(b.r_end_date), 'dd/MM/yyyy'),
      b.r_sale_model,
      b.r_limit_impressions || 'Ilimitado',
      b.r_limit_clicks || 'Ilimitado'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_marketplace_${format(new Date(), 'dd_MM_yyyy')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Relatório exportado com sucesso');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-success/10 text-success border-success/20">Ativo</Badge>;
      case 'scheduled': return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Programado</Badge>;
      case 'paused': return <Badge variant="secondary">Pausado</Badge>;
      case 'ended': return <Badge variant="outline">Encerrado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Período</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-[240px] justify-start text-left font-normal gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, 'dd/MM/yyyy')} - {format(dateRange.to, 'dd/MM/yyyy')}
                        </>
                      ) : (
                        format(dateRange.from, 'dd/MM/yyyy')
                      )
                    ) : (
                      <span>Selecionar período</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range: any) => {
                      if (range?.from && range?.to) {
                        setDateRange(range);
                      } else if (range?.from) {
                        setDateRange({ from: range.from, to: range.from });
                      }
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Status</Label>
              <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="scheduled">Programado</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                  <SelectItem value="ended">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Posição</Label>
              <Select value={filters.position} onValueChange={(v) => setFilters({...filters, position: v})}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Posição" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="hero_secondary">Hero Secundário</SelectItem>
                  <SelectItem value="between_sections">Entre Seções</SelectItem>
                  <SelectItem value="category_page">Página de Categoria</SelectItem>
                  <SelectItem value="footer">Rodapé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Estado</Label>
              <Select value={filters.state} onValueChange={(v) => setFilters({...filters, state: v})}>
                <SelectTrigger className="w-[120px] h-9">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="SP">São Paulo</SelectItem>
                  <SelectItem value="RJ">Rio de Janeiro</SelectItem>
                  <SelectItem value="MG">Minas Gerais</SelectItem>
                  <SelectItem value="PR">Paraná</SelectItem>
                  <SelectItem value="RS">Rio Grande do Sul</SelectItem>
                  <SelectItem value="SC">Santa Catarina</SelectItem>
                  <SelectItem value="DF">Distrito Federal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 flex-1 min-w-[150px]">
              <Label className="text-xs">Anunciante</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Nome do cliente..." 
                  className="pl-9 h-9" 
                  value={filters.advertiser}
                  onChange={(e) => setFilters({...filters, advertiser: e.target.value})}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={fetchReport} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Filter className="h-4 w-4 mr-2" />}
                Filtrar
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" /> Exportar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Ativos</p>
            <p className="text-xl font-bold">{summary.activeBanners}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Impressões</p>
            <p className="text-xl font-bold">{summary.totalImpressions > 9999 ? (summary.totalImpressions / 1000).toFixed(1) + 'k' : summary.totalImpressions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Cliques</p>
            <p className="text-xl font-bold">{summary.totalClicks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">CTR Médio</p>
            <p className="text-xl font-bold">{summary.avgCtr.toFixed(2)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Melhor CTR</p>
            <p className="text-xs font-bold truncate" title={summary.bestCtrBanner?.r_name}>
              {summary.bestCtrBanner?.r_name || '-'}
            </p>
            <p className="text-sm font-bold text-success">{summary.bestCtrBanner?.r_ctr.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Mais Impressões</p>
            <p className="text-xs font-bold truncate" title={summary.mostImpressionsBanner?.r_name}>
              {summary.mostImpressionsBanner?.r_name || '-'}
            </p>
            <p className="text-sm font-bold text-primary">{summary.mostImpressionsBanner?.r_impressions || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Mais Cliques</p>
            <p className="text-xs font-bold truncate" title={summary.mostClicksBanner?.r_name}>
              {summary.mostClicksBanner?.r_name || '-'}
            </p>
            <p className="text-sm font-bold text-success">{summary.mostClicksBanner?.r_clicks || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Performance por Banner
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            {reportData.length} banners encontrados
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Anunciante</TableHead>
                  <TableHead>Posição</TableHead>
                  <TableHead>Região</TableHead>
                  <TableHead className="text-right">Impressões</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Carregando dados...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : reportData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      Nenhum banner encontrado para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  reportData.map((banner) => (
                    <TableRow key={banner.r_banner_id}>
                      <TableCell className="font-medium">{banner.r_name}</TableCell>
                      <TableCell>{banner.r_client_name || '-'}</TableCell>
                      <TableCell className="text-xs uppercase text-muted-foreground">{banner.r_position}</TableCell>
                      <TableCell>
                        <div className="text-xs">
                          {banner.r_city ? banner.r_city : 'Todas'} / {banner.r_state ? banner.r_state : 'Brasil'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{Number(banner.r_impressions).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(banner.r_clicks).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {banner.r_ctr.toFixed(2)}%
                      </TableCell>
                      <TableCell>{getStatusBadge(banner.r_status)}</TableCell>
                      <TableCell>
                        <BannerDetailDialog 
                          bannerId={banner.r_banner_id} 
                          dateRange={dateRange}
                          trigger={
                            <Button variant="ghost" size="icon">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsTab;

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { 
  Eye, 
  MousePointer2, 
  TrendingUp, 
  Calendar, 
  MapPin, 
  Link as LinkIcon,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface BannerDetailDialogProps {
  bannerId: string;
  dateRange: { from: Date; to: Date };
  trigger: React.ReactNode;
}

const BannerDetailDialog = ({ bannerId, dateRange, trigger }: BannerDetailDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<any>(null);
  const [dailyStats, setDailyStats] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Banner Info
      const { data: bannerData, error: bannerError } = await supabase
        .from('marketplace_banners')
        .select('*')
        .eq('id', bannerId)
        .single();
      
      if (bannerError) throw bannerError;
      setBanner(bannerData);

      // 2. Fetch Daily Stats via RPC
      const { data: statsData, error: statsError } = await supabase.rpc('get_marketplace_banner_daily_stats', {
        p_banner_id: bannerId,
        p_start_date: dateRange.from.toISOString(),
        p_end_date: dateRange.to.toISOString()
      });

      if (statsError) throw statsError;
      setDailyStats(statsData || []);
    } catch (error) {
      console.error('Error fetching banner details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formattedStats = dailyStats.map(stat => ({
    date: format(new Date(stat.r_stat_date), 'dd/MM'),
    impressions: Number(stat.r_impressions),
    clicks: Number(stat.r_clicks),
    ctr: stat.r_ctr
  }));

  return (
    <Dialog onOpenChange={(open) => open && fetchData()}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detalhes do Banner: {banner?.name}
            {banner && <Badge variant={banner.status === 'active' ? 'default' : 'secondary'}>{banner.status}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg"><Eye className="h-5 w-5 text-primary" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Impressões</p>
                    <p className="text-xl font-bold">{dailyStats.reduce((acc, s) => acc + Number(s.r_impressions), 0).toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-2 bg-success/10 rounded-lg"><MousePointer2 className="h-5 w-5 text-success" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Cliques</p>
                    <p className="text-xl font-bold">{dailyStats.reduce((acc, s) => acc + Number(s.r_clicks), 0).toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-2 bg-warning/10 rounded-lg"><TrendingUp className="h-5 w-5 text-warning" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">CTR Médio</p>
                    <p className="text-xl font-bold">
                      {dailyStats.length > 0 
                        ? (dailyStats.reduce((acc, s) => acc + s.r_ctr, 0) / dailyStats.length).toFixed(2) 
                        : '0.00'}%
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="charts">
              <TabsList>
                <TabsTrigger value="charts">Gráficos</TabsTrigger>
                <TabsTrigger value="data">Dados Diários</TabsTrigger>
                <TabsTrigger value="info">Informações</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>

              <TabsContent value="charts" className="space-y-6 py-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Impressões e Cliques</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={formattedStats}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" />
                        <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="impressions" name="Impressões" fill="#8884d8" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="right" dataKey="clicks" name="Cliques" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Evolução CTR (%)</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={formattedStats}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="ctr" name="CTR %" stroke="#f59e0b" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="data" className="py-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Impressões</TableHead>
                        <TableHead className="text-right">Cliques</TableHead>
                        <TableHead className="text-right">CTR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...dailyStats].reverse().map((stat, i) => (
                        <TableRow key={i}>
                          <TableCell>{format(new Date(stat.r_stat_date), 'dd/MM/yyyy')}</TableCell>
                          <TableCell className="text-right">{Number(stat.r_impressions).toLocaleString()}</TableCell>
                          <TableCell className="text-right">{Number(stat.r_clicks).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-medium">{stat.r_ctr.toFixed(2)}%</TableCell>
                        </TableRow>
                      ))}
                      {dailyStats.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Sem dados para o período.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="info" className="py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Configurações</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4" /> Início:</span>
                        <span>{banner?.start_date ? format(new Date(banner.start_date), 'dd/MM/yyyy') : '-'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4" /> Fim:</span>
                        <span>{banner?.end_date ? format(new Date(banner.end_date), 'dd/MM/yyyy') : '-'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2"><MapPin className="h-4 w-4" /> Posição:</span>
                        <span className="uppercase text-xs font-medium">{banner?.position}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2"><LinkIcon className="h-4 w-4" /> Link:</span>
                        <a href={banner?.destination_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[150px]">
                          {banner?.destination_link || 'Nenhum'}
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Limites e Entrega</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Modelo Comercial:</span>
                        <span>{banner?.sale_model === 'fixed_period' ? 'Período Fixo' : banner?.sale_model}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Limite Impressões:</span>
                        <span>{banner?.limit_impressions || 'Ilimitado'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Limite Cliques:</span>
                        <span>{banner?.limit_clicks || 'Ilimitado'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Peso na Rotação:</span>
                        <span>{banner?.rotation_weight}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="py-4 space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Desktop</Label>
                    <div className="border rounded-lg overflow-hidden bg-muted/30">
                      {banner?.desktop_image_url ? (
                        <img src={banner.desktop_image_url} alt="Desktop Preview" className="w-full h-auto max-h-[300px] object-contain" />
                      ) : (
                        <div className="py-12 text-center text-muted-foreground">Sem imagem desktop</div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Mobile</Label>
                    <div className="border rounded-lg overflow-hidden bg-muted/30 max-w-[300px] mx-auto">
                      {banner?.mobile_image_url ? (
                        <img src={banner.mobile_image_url} alt="Mobile Preview" className="w-full h-auto object-contain" />
                      ) : (
                        <div className="py-12 text-center text-muted-foreground">Sem imagem mobile</div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BannerDetailDialog;

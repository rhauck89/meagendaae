import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, GripVertical, Video } from 'lucide-react';
import { toast } from 'sonner';

interface TutorialVideo {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string;
  menu_reference: string | null;
  sort_order: number;
  active: boolean;
}

const SuperAdminTutorials = () => {
  const [videos, setVideos] = useState<TutorialVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TutorialVideo | null>(null);
  const [form, setForm] = useState({ title: '', description: '', youtube_url: '', menu_reference: '', sort_order: 0, active: true });

  const fetchVideos = async () => {
    const { data } = await supabase.from('tutorial_videos').select('*').order('sort_order');
    if (data) setVideos(data as TutorialVideo[]);
    setLoading(false);
  };

  useEffect(() => { fetchVideos(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', description: '', youtube_url: '', menu_reference: '', sort_order: videos.length, active: true });
    setModalOpen(true);
  };

  const openEdit = (v: TutorialVideo) => {
    setEditing(v);
    setForm({ title: v.title, description: v.description || '', youtube_url: v.youtube_url, menu_reference: v.menu_reference || '', sort_order: v.sort_order, active: v.active });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.youtube_url) { toast.error('Preencha título e URL do YouTube'); return; }
    if (editing) {
      const { error } = await supabase.from('tutorial_videos').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id);
      if (error) { toast.error('Erro ao atualizar'); return; }
      toast.success('Tutorial atualizado');
    } else {
      const { error } = await supabase.from('tutorial_videos').insert(form);
      if (error) { toast.error('Erro ao criar'); return; }
      toast.success('Tutorial criado');
    }
    setModalOpen(false);
    fetchVideos();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este tutorial?')) return;
    await supabase.from('tutorial_videos').delete().eq('id', id);
    toast.success('Tutorial excluído');
    fetchVideos();
  };

  const toggleActive = async (v: TutorialVideo) => {
    await supabase.from('tutorial_videos').update({ active: !v.active }).eq('id', v.id);
    fetchVideos();
  };

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-display font-semibold">🎬 Tutoriais</h2>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo Tutorial</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {videos.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum tutorial cadastrado</TableCell></TableRow>
              ) : videos.map(v => (
                <TableRow key={v.id}>
                  <TableCell className="text-muted-foreground">{v.sort_order}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{v.title}</p>
                      {v.description && <p className="text-xs text-muted-foreground line-clamp-1">{v.description}</p>}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{v.menu_reference || '—'}</Badge></TableCell>
                  <TableCell>
                    <Switch checked={v.active} onCheckedChange={() => toggleActive(v)} />
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Tutorial' : 'Novo Tutorial'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Como agendar um horário" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve descrição do tutorial" rows={2} />
            </div>
            <div>
              <Label>URL do YouTube *</Label>
              <Input value={form.youtube_url} onChange={e => setForm(f => ({ ...f, youtube_url: e.target.value }))} placeholder="https://www.youtube.com/watch?v=..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Referência do Menu</Label>
                <Input value={form.menu_reference} onChange={e => setForm(f => ({ ...f, menu_reference: e.target.value }))} placeholder="Agenda, Serviços..." />
              </div>
              <div>
                <Label>Ordem</Label>
                <Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
              <Label>Ativo</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>{editing ? 'Salvar' : 'Criar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminTutorials;

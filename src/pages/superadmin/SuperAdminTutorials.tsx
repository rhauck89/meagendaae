import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Video, FolderOpen, ChevronDown, ChevronRight, Image, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface TutorialCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
}

interface TutorialVideo {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string;
  menu_reference: string | null;
  sort_order: number;
  active: boolean;
  category_id: string | null;
  thumbnail_url: string | null;
  duration: string | null;
  visible_for: string;
}

const visibleForLabels: Record<string, string> = {
  all: 'Todos',
  empresa: 'Empresa',
  profissional: 'Profissional',
};

const SuperAdminTutorials = () => {
  const [categories, setCategories] = useState<TutorialCategory[]>([]);
  const [videos, setVideos] = useState<TutorialVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('videos');

  // Category modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<TutorialCategory | null>(null);
  const [catForm, setCatForm] = useState({ name: '', slug: '', description: '', icon: '', sort_order: 0, is_active: true });

  // Video modal
  const [vidModalOpen, setVidModalOpen] = useState(false);
  const [editingVid, setEditingVid] = useState<TutorialVideo | null>(null);
  const [vidForm, setVidForm] = useState({ title: '', description: '', youtube_url: '', category_id: '', sort_order: 0, active: true, duration: '', visible_for: 'all', thumbnail_url: '' });
  const [uploading, setUploading] = useState(false);

  // Expanded categories in tree view
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchAll = async () => {
    const [catRes, vidRes] = await Promise.all([
      supabase.from('tutorial_categories').select('*').order('sort_order'),
      supabase.from('tutorial_videos').select('*').order('sort_order'),
    ]);
    if (catRes.data) setCategories(catRes.data as TutorialCategory[]);
    if (vidRes.data) setVideos(vidRes.data as TutorialVideo[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Category CRUD ──
  const openCreateCat = () => {
    setEditingCat(null);
    setCatForm({ name: '', slug: '', description: '', icon: '', sort_order: categories.length, is_active: true });
    setCatModalOpen(true);
  };

  const openEditCat = (c: TutorialCategory) => {
    setEditingCat(c);
    setCatForm({ name: c.name, slug: c.slug, description: c.description || '', icon: c.icon || '', sort_order: c.sort_order, is_active: c.is_active });
    setCatModalOpen(true);
  };

  const handleSaveCat = async () => {
    if (!catForm.name || !catForm.slug) { toast.error('Preencha nome e slug'); return; }
    const payload = { ...catForm, updated_at: new Date().toISOString() };
    if (editingCat) {
      const { error } = await supabase.from('tutorial_categories').update(payload).eq('id', editingCat.id);
      if (error) { toast.error('Erro ao atualizar categoria'); return; }
      toast.success('Categoria atualizada');
    } else {
      const { error } = await supabase.from('tutorial_categories').insert(payload);
      if (error) { toast.error('Erro ao criar categoria'); return; }
      toast.success('Categoria criada');
    }
    setCatModalOpen(false);
    fetchAll();
  };

  const handleDeleteCat = async (id: string) => {
    if (!confirm('Excluir esta categoria? Os vídeos ficarão sem categoria.')) return;
    await supabase.from('tutorial_categories').delete().eq('id', id);
    toast.success('Categoria excluída');
    fetchAll();
  };

  // ── Video CRUD ──
  const openCreateVid = (categoryId?: string) => {
    setEditingVid(null);
    setVidForm({ title: '', description: '', youtube_url: '', category_id: categoryId || '', sort_order: videos.length, active: true, duration: '', visible_for: 'all', thumbnail_url: '' });
    setVidModalOpen(true);
  };

  const openEditVid = (v: TutorialVideo) => {
    setEditingVid(v);
    setVidForm({
      title: v.title,
      description: v.description || '',
      youtube_url: v.youtube_url,
      category_id: v.category_id || '',
      sort_order: v.sort_order,
      active: v.active,
      duration: v.duration || '',
      visible_for: v.visible_for || 'all',
      thumbnail_url: v.thumbnail_url || '',
    });
    setVidModalOpen(true);
  };

  const handleUploadThumb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Tamanho máximo: 2MB'); return; }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `thumbnails/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('tutorial-thumbnails').upload(path, file);
    if (error) { toast.error('Erro no upload'); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('tutorial-thumbnails').getPublicUrl(path);
    setVidForm(f => ({ ...f, thumbnail_url: urlData.publicUrl }));
    setUploading(false);
    toast.success('Thumbnail enviada');
  };

  const handleSaveVid = async () => {
    if (!vidForm.title || !vidForm.youtube_url) { toast.error('Preencha título e URL'); return; }
    const payload: any = {
      title: vidForm.title,
      description: vidForm.description || null,
      youtube_url: vidForm.youtube_url,
      category_id: vidForm.category_id || null,
      sort_order: vidForm.sort_order,
      active: vidForm.active,
      duration: vidForm.duration || null,
      visible_for: vidForm.visible_for,
      thumbnail_url: vidForm.thumbnail_url || null,
      updated_at: new Date().toISOString(),
    };
    if (editingVid) {
      const { error } = await supabase.from('tutorial_videos').update(payload).eq('id', editingVid.id);
      if (error) { toast.error('Erro ao atualizar'); return; }
      toast.success('Tutorial atualizado');
    } else {
      const { error } = await supabase.from('tutorial_videos').insert(payload);
      if (error) { toast.error('Erro ao criar'); return; }
      toast.success('Tutorial criado');
    }
    setVidModalOpen(false);
    fetchAll();
  };

  const handleDeleteVid = async (id: string) => {
    if (!confirm('Excluir este tutorial?')) return;
    await supabase.from('tutorial_videos').delete().eq('id', id);
    toast.success('Tutorial excluído');
    fetchAll();
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getYoutubeThumbnail = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^&?\s]+)/);
    return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : '';
  };

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Carregando...</p></div>;

  const uncategorized = videos.filter(v => !v.category_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-display font-semibold">🎬 Tutoriais</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openCreateCat}>
            <FolderOpen className="h-4 w-4 mr-2" /> Nova Categoria
          </Button>
          <Button onClick={() => openCreateVid()}>
            <Plus className="h-4 w-4 mr-2" /> Novo Tutorial
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="videos">Árvore de Tutoriais</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
        </TabsList>

        {/* ── TREE VIEW ── */}
        <TabsContent value="videos" className="space-y-3 mt-4">
          {categories.map(cat => {
            const catVideos = videos.filter(v => v.category_id === cat.id).sort((a, b) => a.sort_order - b.sort_order);
            const isOpen = expanded.has(cat.id);
            return (
              <Card key={cat.id}>
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleExpand(cat.id)}
                >
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {cat.icon && <span>{cat.icon}</span>}
                      <span className="font-semibold text-sm">{cat.name}</span>
                      <Badge variant="secondary" className="text-xs">{catVideos.length} vídeos</Badge>
                      {!cat.is_active && <Badge variant="outline" className="text-xs text-muted-foreground">Inativa</Badge>}
                    </div>
                    {cat.description && <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>}
                  </div>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => openCreateVid(cat.id)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEditCat(cat)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteCat(cat.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                {isOpen && (
                  <CardContent className="pt-0 pb-3 px-4">
                    {catVideos.length === 0 ? (
                      <p className="text-xs text-muted-foreground pl-8">Nenhum vídeo nesta categoria</p>
                    ) : (
                      <div className="space-y-2 pl-8">
                        {catVideos.map(v => (
                          <VideoRow key={v.id} video={v} onEdit={openEditVid} onDelete={handleDeleteVid} getThumb={getYoutubeThumbnail} />
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}

          {uncategorized.length > 0 && (
            <Card>
              <div className="p-4">
                <span className="font-semibold text-sm text-muted-foreground">Sem categoria</span>
                <Badge variant="secondary" className="text-xs ml-2">{uncategorized.length}</Badge>
              </div>
              <CardContent className="pt-0 pb-3 px-4">
                <div className="space-y-2 pl-4">
                  {uncategorized.map(v => (
                    <VideoRow key={v.id} video={v} onEdit={openEditVid} onDelete={handleDeleteVid} getThumb={getYoutubeThumbnail} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── CATEGORIES TAB ── */}
        <TabsContent value="categories" className="space-y-3 mt-4">
          {categories.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhuma categoria cadastrada</p>
          ) : categories.map(c => (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-sm w-6 text-center">{c.sort_order}</span>
                  {c.icon && <span>{c.icon}</span>}
                  <div>
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.is_active ? 'default' : 'outline'} className="text-xs">
                    {c.is_active ? 'Ativa' : 'Inativa'}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => openEditCat(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteCat(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* ── CATEGORY MODAL ── */}
      <Dialog open={catModalOpen} onOpenChange={setCatModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCat ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={catForm.name} onChange={e => {
                const name = e.target.value;
                setCatForm(f => ({ ...f, name, slug: editingCat ? f.slug : name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') }));
              }} placeholder="Primeiros Passos" />
            </div>
            <div>
              <Label>Slug *</Label>
              <Input value={catForm.slug} onChange={e => setCatForm(f => ({ ...f, slug: e.target.value }))} placeholder="primeiros-passos" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ícone (emoji)</Label>
                <Input value={catForm.icon} onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))} placeholder="📚" />
              </div>
              <div>
                <Label>Ordem</Label>
                <Input type="number" value={catForm.sort_order} onChange={e => setCatForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={catForm.is_active} onCheckedChange={v => setCatForm(f => ({ ...f, is_active: v }))} />
              <Label>Ativa</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCatModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveCat}>{editingCat ? 'Salvar' : 'Criar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── VIDEO MODAL ── */}
      <Dialog open={vidModalOpen} onOpenChange={setVidModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingVid ? 'Editar Tutorial' : 'Novo Tutorial'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={vidForm.title} onChange={e => setVidForm(f => ({ ...f, title: e.target.value }))} placeholder="Como agendar um horário" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={vidForm.description} onChange={e => setVidForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div>
              <Label>URL do YouTube *</Label>
              <Input value={vidForm.youtube_url} onChange={e => setVidForm(f => ({ ...f, youtube_url: e.target.value }))} placeholder="https://www.youtube.com/watch?v=..." />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={vidForm.category_id} onValueChange={v => setVidForm(f => ({ ...f, category_id: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Thumbnail</Label>
              <div className="flex items-center gap-3 mt-1">
                {vidForm.thumbnail_url ? (
                  <img src={vidForm.thumbnail_url} alt="thumb" className="w-32 h-18 rounded object-cover border" />
                ) : (
                  <div className="w-32 h-18 rounded border flex items-center justify-center bg-muted">
                    <Image className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <label className="cursor-pointer">
                  <div className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                    <Upload className="h-4 w-4" />
                    {uploading ? 'Enviando...' : 'Enviar thumbnail'}
                  </div>
                  <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleUploadThumb} disabled={uploading} />
                </label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">1280×720px recomendado. Máx 2MB.</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Ordem</Label>
                <Input type="number" value={vidForm.sort_order} onChange={e => setVidForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Duração</Label>
                <Input value={vidForm.duration} onChange={e => setVidForm(f => ({ ...f, duration: e.target.value }))} placeholder="5:30" />
              </div>
              <div>
                <Label>Visível para</Label>
                <Select value={vidForm.visible_for} onValueChange={v => setVidForm(f => ({ ...f, visible_for: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="empresa">Empresa</SelectItem>
                    <SelectItem value="profissional">Profissional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={vidForm.active} onCheckedChange={v => setVidForm(f => ({ ...f, active: v }))} />
              <Label>Ativo</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setVidModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveVid}>{editingVid ? 'Salvar' : 'Criar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Video Row Component ──
function VideoRow({ video, onEdit, onDelete, getThumb }: {
  video: TutorialVideo;
  onEdit: (v: TutorialVideo) => void;
  onDelete: (id: string) => void;
  getThumb: (url: string) => string;
}) {
  const thumb = video.thumbnail_url || getThumb(video.youtube_url);
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group">
      <div className="w-20 h-12 rounded overflow-hidden bg-muted shrink-0">
        {thumb && <img src={thumb} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{video.title}</p>
          {video.duration && <span className="text-xs text-muted-foreground shrink-0">{video.duration}</span>}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {!video.active && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
          <Badge variant="secondary" className="text-[10px]">{visibleForLabels[video.visible_for] || 'Todos'}</Badge>
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(video)}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(video.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
      </div>
    </div>
  );
}

export default SuperAdminTutorials;

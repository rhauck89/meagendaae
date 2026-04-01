import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, PlayCircle, Video } from 'lucide-react';
import SettingsBreadcrumb from '@/components/SettingsBreadcrumb';

interface TutorialVideo {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string;
  menu_reference: string | null;
  sort_order: number;
}

const getYoutubeEmbedUrl = (url: string) => {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^&?\s]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : url;
};

const getYoutubeThumbnail = (url: string) => {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^&?\s]+)/);
  return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : '';
};

const HelpCenter = () => {
  const [videos, setVideos] = useState<TutorialVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<TutorialVideo | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('tutorial_videos')
        .select('id, title, description, youtube_url, menu_reference, sort_order')
        .eq('active', true)
        .order('sort_order');
      if (data) setVideos(data as TutorialVideo[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = videos.filter(v =>
    v.title.toLowerCase().includes(search.toLowerCase()) ||
    (v.description || '').toLowerCase().includes(search.toLowerCase()) ||
    (v.menu_reference || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-semibold flex items-center gap-2">
          <Video className="h-6 w-6 text-primary" /> Central de Ajuda
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Aprenda a usar o sistema com nossos tutoriais em vídeo.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar tutoriais..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {selectedVideo && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{selectedVideo.title}</h3>
              <button onClick={() => setSelectedVideo(null)} className="text-sm text-muted-foreground hover:text-foreground">Fechar ✕</button>
            </div>
            <div className="aspect-video rounded-lg overflow-hidden bg-muted">
              <iframe
                src={getYoutubeEmbedUrl(selectedVideo.youtube_url)}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={selectedVideo.title}
              />
            </div>
            {selectedVideo.description && <p className="text-sm text-muted-foreground mt-3">{selectedVideo.description}</p>}
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Video className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum tutorial encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(v => (
            <Card
              key={v.id}
              className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
              onClick={() => setSelectedVideo(v)}
            >
              <div className="relative aspect-video bg-muted">
                <img
                  src={getYoutubeThumbnail(v.youtube_url)}
                  alt={v.title}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-foreground/10 hover:bg-foreground/20 transition-colors">
                  <PlayCircle className="h-12 w-12 text-background/90" />
                </div>
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm line-clamp-1">{v.title}</h3>
                {v.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{v.description}</p>}
                {v.menu_reference && (
                  <Badge variant="outline" className="text-xs mt-2">{v.menu_reference}</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default HelpCenter;

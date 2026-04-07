import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, PlayCircle, Video, CheckCircle2, X } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

interface TutorialCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
}

interface TutorialVideo {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string;
  category_id: string | null;
  sort_order: number;
  thumbnail_url: string | null;
  duration: string | null;
  visible_for: string;
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
  const [categories, setCategories] = useState<TutorialCategory[]>([]);
  const [videos, setVideos] = useState<TutorialVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<TutorialVideo | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const { isProfessional, isCollaborator } = useUserRole();

  // Determine visibility filter based on role
  const visibilityFilter = (isProfessional || isCollaborator) ? 'profissional' : 'empresa';

  useEffect(() => {
    const load = async () => {
      const [catRes, vidRes] = await Promise.all([
        supabase.from('tutorial_categories').select('id, name, slug, description, icon, sort_order').eq('is_active', true).order('sort_order'),
        supabase.from('tutorial_videos').select('id, title, description, youtube_url, category_id, sort_order, thumbnail_url, duration, visible_for').eq('active', true).order('sort_order'),
      ]);
      if (catRes.data) setCategories(catRes.data as TutorialCategory[]);
      if (vidRes.data) setVideos(vidRes.data as TutorialVideo[]);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: progress } = await supabase
          .from('user_tutorial_progress')
          .select('video_id')
          .eq('user_id', user.id);
        if (progress) setCompletedIds(new Set(progress.map(p => p.video_id)));
      }
      setLoading(false);
    };
    load();
  }, []);

  const markCompleted = async (videoId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || completedIds.has(videoId)) return;
    await supabase.from('user_tutorial_progress').upsert(
      { user_id: user.id, video_id: videoId },
      { onConflict: 'user_id,video_id' }
    );
    setCompletedIds(prev => new Set(prev).add(videoId));
  };

  // Filter by visibility and search
  const filteredVideos = videos.filter(v => {
    if (v.visible_for !== 'all' && v.visible_for !== visibilityFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    const cat = categories.find(c => c.id === v.category_id);
    return v.title.toLowerCase().includes(q) ||
      (v.description || '').toLowerCase().includes(q) ||
      (cat?.name || '').toLowerCase().includes(q);
  });

  const categorizedGroups = categories
    .map(cat => ({
      category: cat,
      videos: filteredVideos.filter(v => v.category_id === cat.id),
    }))
    .filter(g => g.videos.length > 0);

  const uncategorized = filteredVideos.filter(v => !v.category_id);

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
          placeholder="Buscar tutorial..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Video player modal */}
      {selectedVideo && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{selectedVideo.title}</h3>
              <button onClick={() => setSelectedVideo(null)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                Fechar <X className="h-4 w-4" />
              </button>
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

      {/* Categorized sections */}
      {categorizedGroups.map(({ category, videos: catVids }) => (
        <div key={category.id} className="space-y-3">
          <div className="flex items-center gap-2">
            {category.icon && <span className="text-lg">{category.icon}</span>}
            <h3 className="font-semibold text-base">{category.name}</h3>
            {category.description && <span className="text-xs text-muted-foreground">— {category.description}</span>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {catVids.map(v => (
              <VideoCard
                key={v.id}
                video={v}
                completed={completedIds.has(v.id)}
                onSelect={() => { setSelectedVideo(v); markCompleted(v.id); }}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Uncategorized */}
      {uncategorized.length > 0 && (
        <div className="space-y-3">
          {categorizedGroups.length > 0 && (
            <h3 className="font-semibold text-base text-muted-foreground">Outros</h3>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {uncategorized.map(v => (
              <VideoCard
                key={v.id}
                video={v}
                completed={completedIds.has(v.id)}
                onSelect={() => { setSelectedVideo(v); markCompleted(v.id); }}
              />
            ))}
          </div>
        </div>
      )}

      {filteredVideos.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Video className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum tutorial encontrado</p>
        </div>
      )}
    </div>
  );
};

function VideoCard({ video, completed, onSelect }: {
  video: TutorialVideo;
  completed: boolean;
  onSelect: () => void;
}) {
  const thumb = video.thumbnail_url || getYoutubeThumbnail(video.youtube_url);
  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow overflow-hidden ${completed ? 'ring-2 ring-success/30' : ''}`}
      onClick={onSelect}
    >
      <div className="relative aspect-video bg-muted">
        {thumb && (
          <img
            src={thumb}
            alt={video.title}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-foreground/10 hover:bg-foreground/20 transition-colors">
          {completed ? (
            <CheckCircle2 className="h-12 w-12 text-success" />
          ) : (
            <PlayCircle className="h-12 w-12 text-background/90" />
          )}
        </div>
        {video.duration && (
          <span className="absolute bottom-2 right-2 bg-foreground/80 text-background text-xs px-1.5 py-0.5 rounded">{video.duration}</span>
        )}
      </div>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5">
          <h3 className="font-semibold text-sm line-clamp-1 flex-1">{video.title}</h3>
          {completed && <CheckCircle2 className="h-4 w-4 text-success shrink-0" />}
        </div>
        {video.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{video.description}</p>}
      </CardContent>
    </Card>
  );
}

export default HelpCenter;

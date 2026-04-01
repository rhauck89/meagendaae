import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, PlayCircle } from 'lucide-react';

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

export const OnboardingPopup = () => {
  const [videos, setVideos] = useState<TutorialVideo[]>([]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: onboarding } = await supabase
        .from('user_onboarding')
        .select('completed')
        .eq('user_id', user.id)
        .maybeSingle();

      if (onboarding?.completed) { setChecked(true); return; }

      const { data: vids } = await supabase
        .from('tutorial_videos')
        .select('id, title, description, youtube_url, menu_reference, sort_order')
        .eq('active', true)
        .order('sort_order');

      if (vids && vids.length > 0) {
        setVideos(vids as TutorialVideo[]);
        setOpen(true);
      }

      // Create onboarding record if doesn't exist
      if (!onboarding) {
        await supabase.from('user_onboarding').insert({ user_id: user.id, completed: false });
      }
      setChecked(true);
    };
    check();
  }, []);

  const markVideoCompleted = async (videoId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_tutorial_progress').upsert(
      { user_id: user.id, video_id: videoId },
      { onConflict: 'user_id,video_id' }
    );
  };

  const handleComplete = async () => {
    // Mark current video as completed
    if (videos[step]) await markVideoCompleted(videos[step].id);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('user_onboarding').update({ completed: true, completed_at: new Date().toISOString() }).eq('user_id', user.id);
    }
    setOpen(false);
  };

  const handleSkip = () => {
    handleComplete();
  };

  if (!checked || videos.length === 0) return null;

  const current = videos[step];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleComplete(); }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-primary" />
              Tutorial {step + 1} de {videos.length}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="px-6">
          <h3 className="text-lg font-semibold">{current.title}</h3>
          {current.description && <p className="text-sm text-muted-foreground mt-1">{current.description}</p>}
        </div>

        <div className="px-6 py-4">
          <div className="aspect-video rounded-lg overflow-hidden bg-muted">
            <iframe
              src={getYoutubeEmbedUrl(current.youtube_url)}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={current.title}
            />
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pb-2">
          {videos.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
          ))}
        </div>

        <div className="flex items-center justify-between p-6 pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={handleSkip}>Pular tutorial</Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
            )}
            {step < videos.length - 1 ? (
              <Button size="sm" onClick={async () => { await markVideoCompleted(videos[step].id); setStep(s => s + 1); }}>
                Próximo <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleComplete}>
                Concluir 🎉
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingPopup;

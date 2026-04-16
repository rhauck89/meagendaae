import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PlayCircle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'tutorial_progress_completed';

const TutorialProgressWidget = () => {
  const [total, setTotal] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === 'true') {
      setHidden(true);
      setLoading(false);
      return;
    }

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count: totalCount } = await supabase
        .from('tutorial_videos')
        .select('id', { count: 'exact', head: true })
        .eq('active', true);

      const { count: completedCount } = await supabase
        .from('user_tutorial_progress')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const t = totalCount || 0;
      const c = completedCount || 0;
      setTotal(t);
      setCompleted(c);

      if (t > 0 && c >= t) {
        localStorage.setItem(STORAGE_KEY, 'true');
        setFadingOut(true);
        setTimeout(() => setHidden(true), 300);
      }

      setLoading(false);
    };
    load();
  }, []);

  if (loading || total === 0 || hidden) return null;

  const percent = Math.round((completed / total) * 100);
  const allDone = completed >= total;

  return (
    <Card
      className={cn(
        'cursor-pointer hover:shadow-md transition-all duration-300',
        fadingOut ? 'opacity-0' : 'opacity-100'
      )}
      onClick={() => navigate('/dashboard/help')}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          {allDone ? (
            <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
          ) : (
            <PlayCircle className="h-5 w-5 text-primary shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {allDone ? 'Tutoriais concluídos!' : 'Progresso dos tutoriais'}
            </p>
            <p className="text-xs text-muted-foreground">
              {completed} / {total} etapas concluídas
            </p>
          </div>
          <span className="text-sm font-bold text-primary">{percent}%</span>
        </div>
        <Progress value={percent} className="h-2" />
      </CardContent>
    </Card>
  );
};

export default TutorialProgressWidget;

export const resetTutorialProgress = () => {
  localStorage.removeItem(STORAGE_KEY);
};

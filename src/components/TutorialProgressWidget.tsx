import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PlayCircle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TutorialProgressWidget = () => {
  const [total, setTotal] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
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

      setTotal(totalCount || 0);
      setCompleted(completedCount || 0);
      setLoading(false);
    };
    load();
  }, []);

  if (loading || total === 0) return null;

  const percent = Math.round((completed / total) * 100);
  const allDone = completed >= total;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
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

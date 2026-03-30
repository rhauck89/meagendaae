import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, Save, Camera, Instagram, Link2, Loader2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ProfilePage = () => {
  const { user, profile, companyId } = useAuth();
  const { profileId } = useUserRole();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [copied, setCopied] = useState(false);
  const [bookingLink, setBookingLink] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    whatsapp: '',
    bio: '',
    avatar_url: '',
    social_instagram: '',
  });

  useEffect(() => {
    if (profile) {
      const socialLinks = (profile as any).social_links || {};
      setForm({
        full_name: profile.full_name || '',
        email: profile.email || '',
        whatsapp: profile.whatsapp || '',
        bio: (profile as any).bio || '',
        avatar_url: profile.avatar_url || '',
        social_instagram: socialLinks.instagram || '',
        social_website: socialLinks.website || '',
      });
    }
  }, [profile]);

  useEffect(() => {
    if (profileId) fetchReviews();
  }, [profileId]);

  const fetchReviews = async () => {
    const { data } = await supabase
      .from('reviews')
      .select(`
        *,
        appointment:appointments!reviews_appointment_id_fkey(
          client:clients!appointments_client_id_fkey(name),
          appointment_services(service:services(name))
        )
      `)
      .eq('professional_id', profileId!)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      setReviews(data);
      if (data.length > 0) {
        setAvgRating(data.reduce((s, r) => s + r.rating, 0) / data.length);
      }
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 2MB');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setForm(prev => ({ ...prev, avatar_url: avatarUrl }));
      toast.success('Foto atualizada!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar foto');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const socialLinks = {
        instagram: form.social_instagram || null,
        website: form.social_website || null,
      };

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name,
          email: form.email,
          whatsapp: form.whatsapp,
          bio: form.bio as any,
          social_links: socialLinks as any,
        })
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Perfil atualizado com sucesso');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? 'fill-warning text-warning' : 'text-muted-foreground/30'}`}
      />
    ));
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Profile Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-display">Meu Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={form.avatar_url} />
                <AvatarFallback className="text-2xl font-display">
                  {form.full_name?.charAt(0)?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <Button
                variant="outline"
                size="icon"
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full shadow-md"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div>
              <p className="font-medium">{form.full_name || 'Seu nome'}</p>
              <p className="text-sm text-muted-foreground">
                Clique no ícone da câmera para alterar a foto
              </p>
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome completo</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Fale um pouco sobre você e sua experiência..."
              rows={3}
            />
          </div>

          {/* Social Links */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Redes Sociais</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="instagram" className="flex items-center gap-1.5 text-sm">
                  <Instagram className="h-4 w-4" /> Instagram
                </Label>
                <Input
                  id="instagram"
                  value={form.social_instagram}
                  onChange={(e) => setForm({ ...form, social_instagram: e.target.value })}
                  placeholder="@seuusuario"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website" className="flex items-center gap-1.5 text-sm">
                  <Globe className="h-4 w-4" /> Website
                </Label>
                <Input
                  id="website"
                  value={form.social_website}
                  onChange={(e) => setForm({ ...form, social_website: e.target.value })}
                  placeholder="https://seusite.com"
                />
              </div>
            </div>
          </div>

          <Button onClick={handleSave} disabled={loading} className="w-full md:w-auto">
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Salvando...' : 'Salvar Perfil'}
          </Button>
        </CardContent>
      </Card>

      {/* Reviews */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Star className="h-5 w-5" /> Minhas Avaliações
            </CardTitle>
            {reviews.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex">{renderStars(Math.round(avgRating))}</div>
                <span className="text-sm text-muted-foreground">
                  {avgRating.toFixed(1)} ({reviews.length} {reviews.length === 1 ? 'avaliação' : 'avaliações'})
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma avaliação ainda
            </p>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <div key={review.id} className="p-4 rounded-xl border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {review.appointment?.client?.name || 'Cliente'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {review.appointment?.appointment_services?.map((s: any) => s.service?.name).join(', ')}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(review.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex">{renderStars(review.rating)}</div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-muted-foreground mt-1">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;

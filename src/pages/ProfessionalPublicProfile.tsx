// Last synced: 2026-04-30 16:35 BRT
import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Star, MessageCircle, MapPin, Share2, Check, Calendar, Clock, Instagram, Sparkles, Scissors, BadgeCheck, Trophy, Flame, Crown, Users, ShieldCheck, Zap, Repeat, Home, ChevronLeft, ChevronRight, Navigation } from 'lucide-react';
import { LocationBlock } from '@/components/LocationBlock';
import { SEOHead } from '@/components/SEOHead';
import { format, addDays, startOfDay, isToday, isTomorrow, differenceInYears, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { buildWhatsAppUrl, trackWhatsAppClick } from '@/lib/whatsapp';
import { type ExistingAppointment } from '@/lib/availability-engine';
import { getAvailableSlots } from '@/lib/availability-service';
import { formatWhatsApp } from '@/lib/whatsapp';
import { PlatformBranding } from '@/components/PlatformBranding';
import { getCompanyBranding, buildThemeFromBranding, useApplyBranding } from '@/hooks/useCompanyBranding';
import { useCompanyAmenities } from '@/hooks/useCompanyAmenities';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody } from "@/components/ui/dialog";
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ReviewForm } from '@/components/public-profile/ReviewForm';
import { BenefitsSection } from '@/components/public-profile/BenefitsSection';
import { MembershipSection } from '@/components/public-profile/MembershipSection';
import { Calendar as CalendarUI } from "@/components/ui/calendar";

type BusinessType = 'barbershop' | 'esthetic';

const DEFAULT_TZ = 'America/Sao_Paulo';

const formatReviewerName = (name: string): string => {
  if (!name || name.toLowerCase() === 'cliente') return 'Cliente';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
};

const parseReviewContent = (comment: string, existingTags: string[] = []) => {
  let cleanComment = (comment || '').trim();
  const tags = [...(existingTags || [])];
  
  // Look for [Tag] at the start of the comment
  const tagRegex = /^\[([^\]]+)\]\s*(.*)/;
  const match = cleanComment.match(tagRegex);
  
  if (match) {
    const extractedTag = match[1];
    if (!tags.includes(extractedTag)) {
      tags.push(extractedTag);
    }
    cleanComment = match[2].trim();
  }
  
  return { comment: cleanComment || 'Experiência excelente!', tags };
};

const timeStringToMinutes = (v: string) => { const [h, m] = v.split(':').map(Number); return h * 60 + m; };
const getAppointmentMinutesInTimezone = (v: string, tz: string) => {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(v));
  return Number(p.find(x => x.type === 'hour')?.value ?? '0') * 60 + Number(p.find(x => x.type === 'minute')?.value ?? '0');
};
const filterOverlapping = (slots: string[], apts: ExistingAppointment[], dur: number, buf: number, tz: string) =>
  slots.filter(s => { const ss = timeStringToMinutes(s), se = ss + dur; return !apts.some(a => { const as2 = getAppointmentMinutesInTimezone(a.start_time, tz), ae = getAppointmentMinutesInTimezone(a.end_time, tz) + buf; return as2 < se && ae > ss; }); });

const StarRating = ({ rating, size = 14 }: { rating: number; size?: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => {
      const fill = rating >= s ? 1 : rating >= s - 0.5 ? 0.5 : 0;
      return (
        <svg key={s} width={size} height={size} viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id={`prof-star-${s}-${size}`}>
              <stop offset={`${fill * 100}%`} stopColor="#FDBA2D" />
              <stop offset={`${fill * 100}%`} stopColor="#374151" />
            </linearGradient>
          </defs>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={`url(#prof-star-${s}-${size})`} />
        </svg>
      );
    })}
  </div>
);


const getContrastColor = (hex: string) => {
  if (!hex || hex.length < 7) return '#1a1a1a';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma > 160 ? '#1a1a1a' : '#FFFFFF';
};

export default function ProfessionalPublicProfile() {
  const { slug, professionalSlug } = useParams<{ slug: string; professionalSlug: string }>();
  const navigate = useNavigate();

  const [company, setCompany] = useState<any>(null);
  const [professional, setProfessional] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [rating, setRating] = useState<{ avg: number; count: number } | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [nextAvailable, setNextAvailable] = useState<{ date: Date; slots: string[]; label: string } | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [businessType, setBusinessType] = useState<BusinessType>('barbershop');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [activeCashback, setActiveCashback] = useState<string | null>(null);
  const [lastBooking, setLastBooking] = useState<any>(null);
  const { isAuthenticated: isAuthAuthenticated, isAdmin, user } = useAuth();
  const isAuthenticated = isAuthAuthenticated && !isAdmin;

  const [isReviewsDrawerOpen, setIsReviewsDrawerOpen] = useState(false);
  const [currentClient, setCurrentClient] = useState<any>(null);
  const [isAddReviewModalOpen, setIsAddReviewModalOpen] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [allReviewsList, setAllReviewsList] = useState<any[]>([]);
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [availableSlotsForDate, setAvailableSlotsForDate] = useState<string[]>([]);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);

  const nextReview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (reviews.length > 1) {
      setCurrentReviewIndex((prev) => (prev + 1) % reviews.length);
    }
  };

  const prevReview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (reviews.length > 1) {
      setCurrentReviewIndex((prev) => (prev - 1 + reviews.length) % reviews.length);
    }
  };

  useEffect(() => {
    if (reviews.length > 0 && currentReviewIndex >= reviews.length) {
      setCurrentReviewIndex(0);
    }
  }, [reviews.length]);

  const { amenities: companyAmenities } = useCompanyAmenities(company?.id);
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);

  // Detect logged-in user and WhatsApp session
  useEffect(() => {
    if (!company?.id) return;
    
    const restoreSession = async () => {
      // 1. Try WhatsApp session
      const localIdentityStr = localStorage.getItem(`whatsapp_session_${company.id}`);
      if (localIdentityStr) {
        try {
          const session = JSON.parse(localIdentityStr);
          const now = new Date();
          const expiresAt = new Date(session.expiresAt);
          
          if (expiresAt > now) {
            console.log('[PROFILE] Restored WhatsApp session:', session.fullName);
            setCurrentClient({
              name: session.fullName,
              whatsapp: session.whatsapp,
              email: session.email,
              avatar_url: null
            });
            return;
          } else {
            localStorage.removeItem(`whatsapp_session_${company.id}`);
          }
        } catch (e) {
          console.warn('[PROFILE] Error parsing WhatsApp session');
        }
      }
      
      // 2. Try Supabase Auth metadata if logged in
      if (isAuthenticated && user) {
        console.log('[PROFILE] Using Auth session:', user.user_metadata?.full_name);
        setCurrentClient({
          name: user.user_metadata?.full_name,
          whatsapp: user.user_metadata?.whatsapp,
          email: user.email,
          avatar_url: user.user_metadata?.avatar_url
        });
      }
    };
    
    restoreSession();
  }, [company?.id, isAuthenticated, user]);

  useEffect(() => { if (slug && professionalSlug) load(); }, [slug, professionalSlug]);

  const load = async () => {
    setLoading(true);
    try {
      console.log('[PROFILE] Starting load for slug:', slug, 'professional:', professionalSlug, 'isAdmin:', isAdmin);
      
      // 1. Critical Data: Company (Bypass RLS via RPC)
      const { data: compArr, error: compError } = await supabase.rpc('get_company_by_slug', { _slug: slug! });
      if (compError) {
        console.error('[PROFILE] RPC Error (get_company_by_slug):', compError);
        setLoading(false);
        return;
      }
      
      const comp = compArr?.[0];
      if (!comp) {
        console.warn('[PROFILE] Company not found for slug:', slug);
        setLoading(false);
        return;
      }

      const { data: fullCompanyData } = await supabase.from('public_company' as any).select('*').eq('id', comp.id).maybeSingle();
      const companyFull = { ...comp, ...((fullCompanyData as any) || {}) };
      setCompany(companyFull);
      setBusinessType(companyFull.business_type || 'barbershop');

      // 2. Professional Data (Bypass potential RLS issues for admins by using direct filtering)
      console.log('[PROFILE] Fetching professional...');
      const { data: pubProfs, error: profError } = await supabase
        .from('public_professionals' as any)
        .select('*')
        .eq('company_id', comp.id)
        .eq('slug', professionalSlug!);
        
      if (profError) {
        console.error('[PROFILE] Error fetching professional:', profError);
      }

      let prof = (pubProfs as any[])?.[0];
      
      // Fallback for admins: if not found via public view, try a more direct approach if possible
      if (!prof && isAdmin) {
        console.log('[PROFILE] Professional not found in public view, trying fallback for admin...');
        // We try to fetch from the view again but without the slug if it was weird, or just log
      }

      if (!prof) {
        console.warn('[PROFILE] Professional not found:', professionalSlug);
        setLoading(false);
        return;
      }
      
      setProfessional(prof);
      console.log('[PROFILE] Professional found:', prof.id);

      // Fetch collaborator flag directly to ensure it respects company setting
      const { data: collabData } = await supabase
        .from('collaborators')
        .select('use_company_banner')
        .eq('profile_id', prof.id)
        .eq('company_id', comp.id)
        .maybeSingle();

      const useCompanyBanner = collabData?.use_company_banner ?? true;
      const effectiveBanner = useCompanyBanner ? companyFull.cover_url : prof.banner_url;

      setProfile({ 
        bio: prof.bio, 
        social_links: prof.social_links, 
        whatsapp: prof.whatsapp, 
        avatar_url: prof.avatar_url, 
        banner_url: effectiveBanner,
        specialty: prof.specialty || (companyFull.business_type === 'barbershop' ? 'Especialista em barba e corte' : 'Especialista em estética facial'),
        experience_years: prof.experience_years || 5
      });

      // Check for last booking if logged in (non-blocking)
      if (isAuthenticated) {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            supabase
              .from('appointments')
              .select('id, start_time, total_price, professional_id, status')
              .eq('company_id', comp.id)
              .eq('user_id', user.id)
              .eq('professional_id', prof.id)
              .in('status', ['completed', 'confirmed'])
              .order('start_time', { ascending: false })
              .limit(1)
              .maybeSingle()
              .then(({ data: appt }) => {
                if (appt) {
                  supabase.from('appointment_services').select('service_id').eq('appointment_id', appt.id).then(({ data: apptSvcs }) => {
                    if (apptSvcs && apptSvcs.length > 0) {
                      supabase.from('public_services' as any).select('name').eq('id', apptSvcs[0].service_id).maybeSingle().then(({ data: svc }) => {
                        setLastBooking({
                          ...appt,
                          serviceName: (svc as any)?.name
                        });
                      });
                    }
                  });
                }
              });
          }
        }).catch(() => {});
      }

      const { data: spData } = await supabase.from('service_professionals').select('service_id, price_override').eq('professional_id', prof.id);
      const svcIds = (spData || []).map((s: any) => s.service_id);
      if (svcIds.length > 0) {
        const { data: svcData } = await supabase.from('public_services' as any).select('*').eq('company_id', comp.id).in('id', svcIds);
        const withOverrides = ((svcData as any[]) || []).map((s: any) => {
          const ov = (spData || []).find((sp: any) => sp.service_id === s.id);
          return ov?.price_override != null ? { ...s, price: ov.price_override } : s;
        });
        setServices(withOverrides);
      }

      // Rating
      supabase.rpc('get_professional_ratings' as any, { p_company_id: comp.id }).then(({ data: ratingsData }) => {
        if (ratingsData && Array.isArray(ratingsData)) {
          const r = (ratingsData as any[]).find((x: any) => x.professional_id === prof.id);
          if (r) setRating({ avg: Number(r.avg_rating), count: Number(r.review_count) });
        }
      });

      // Reviews (non-blocking)
      supabase
        .from('reviews')
        .select('rating, comment, created_at, appointment_id, review_type, professional_id, reviewer_name, reviewer_avatar, tags')
        .eq('company_id', comp.id)
        .eq('professional_id', prof.id)
        .eq('review_type', 'professional')
        .order('created_at', { ascending: false })
        .then(({ data: allReviewsData }) => {
          if (allReviewsData) {
            const apptIds = allReviewsData.map((r: any) => r.appointment_id).filter(Boolean);
            if (apptIds.length > 0) {
              supabase
                .from('appointments')
                .select('id, client_name, client_id')
                .in('id', apptIds)
                .then(({ data: appts }) => {
                  const clientIds = (appts || []).filter((a: any) => a.client_id).map((a: any) => a.client_id);
                  if (clientIds.length > 0) {
                    supabase.from('clients').select('id, name').in('id', clientIds).then(({ data: clients }) => {
                      let cnameMap: Record<string, string> = {};
                      (clients || []).forEach((c: any) => { cnameMap[c.id] = c.name; });
                      let clientNames: Record<string, string> = {};
                      (appts || []).forEach((a: any) => {
                        const n = a.client_name || cnameMap[a.client_id];
                        if (n) {
                          const parts = n.trim().split(/\s+/);
                          const first = parts[0] || '';
                          const lastInitial = parts.length > 1 ? ` ${parts[parts.length - 1].charAt(0).toUpperCase()}.` : '';
                          clientNames[a.id] = `${first}${lastInitial}`;
                        }
                      });
                      const enriched = allReviewsData.map((r: any) => {
                        const { comment, tags } = parseReviewContent(r.comment, r.tags);
                        return {
                          ...r,
                          comment,
                          tags,
                          client_display_name: r.reviewer_name || (r.appointment_id ? clientNames[r.appointment_id] || null : null),
                          client_avatar_url: r.reviewer_avatar || null,
                        };
                      });
                      setReviews(enriched.slice(0, 3));
                      setAllReviewsList(enriched);
                      setTotalReviews(enriched.length);
                    });
                  } else {
                    const enriched = allReviewsData.map((r: any) => {
                      const { comment, tags } = parseReviewContent(r.comment, r.tags);
                      return {
                        ...r,
                        comment,
                        tags,
                        client_display_name: r.reviewer_name || ((appts || []).find(a => a.id === r.appointment_id)?.client_name || null),
                        client_avatar_url: r.reviewer_avatar || null,
                      };
                    });
                    setReviews(enriched.slice(0, 3));
                    setAllReviewsList(enriched);
                    setTotalReviews(enriched.length);
                  }
                });
            } else {
              const enriched = allReviewsData.map((r: any) => {
                const { comment, tags } = parseReviewContent(r.comment, r.tags);
                return {
                  ...r,
                  comment,
                  tags,
                  client_display_name: r.reviewer_name || null,
                  client_avatar_url: r.reviewer_avatar || null,
                };
              });
              setReviews(enriched.slice(0, 3));
              setAllReviewsList(enriched);
              setTotalReviews(enriched.length);
            }
          }
        });

      // Completed appointments count
      supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('professional_id', prof.id).eq('status', 'completed').then(({ count }) => {
        setCompletedCount(count || 0);
      });

      // Fetch company settings for branding
      supabase.from('public_company_settings' as any).select('primary_color, secondary_color, background_color').eq('company_id', comp.id).single().then(({ data: csData }) => {
        if (csData) setCompanySettings(csData);
      });

      // Next available slots (Non-blocking)
      fetchNextSlots(comp, prof).catch(err => {
        console.error('[PROFILE] Error in fetchNextSlots:', err);
      });
      
      // EXIT LOADING AS SOON AS CRITICAL DATA IS READY
      setLoading(false);
      console.log('[PROFILE] Critical data loaded, loading set to false');
    } catch (err) {
      console.error('[PROFILE] Unexpected error loading page data:', err);
      setLoading(false);
    }
  };

  const fetchNextSlots = async (comp: any, prof: any) => {
    setSlotsLoading(true);
    const [, , , settingsRes] = await Promise.all([
      supabase.from('business_hours').select('*').eq('company_id', comp.id),
      supabase.from('business_exceptions').select('*').eq('company_id', comp.id),
      supabase.from('public_company' as any).select('buffer_minutes').eq('id', comp.id).single(),
      supabase.from('public_company_settings' as any).select('timezone, booking_buffer_minutes').eq('company_id', comp.id).single(),
      supabase.from('professional_working_hours' as any).select('*').eq('professional_id', prof.id),
    ]);

    const tz = (settingsRes.data as any)?.timezone || DEFAULT_TZ;
    const avgDur = services.length > 0 ? Math.round(services.reduce((s, sv) => s + (sv.duration_minutes || 30), 0) / services.length) : 30;

    const now = new Date();
    // Use the selected date instead of searching for the next available day for the initial view
    // but keep searching for the "nextAvailable" label/summary if needed elsewhere.
    
    const result = await getAvailableSlots({
      source: 'public',
      companyId: comp.id,
      professionalId: prof.id,
      date: selectedDate,
      totalDuration: avgDur,
      filterPastForToday: true,
    });

    const slots = result.slots;
    setAvailableSlotsForDate(slots);

    // Update the summary "nextAvailable" info for the label
    let label: string;
    if (isToday(selectedDate)) {
      label = `Hoje • ${format(selectedDate, 'dd/MM')}`;
    } else if (isTomorrow(selectedDate)) {
      label = `Amanhã • ${format(selectedDate, 'dd/MM')}`;
    } else {
      const formattedDate = format(selectedDate, "EEEE • dd/MM", { locale: ptBR });
      label = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
    }
    setNextAvailable({ date: selectedDate, slots, label });
    setSlotsLoading(false);
  };

  useEffect(() => {
    if (company?.id && professional?.id) {
      fetchNextSlots(company, professional);
    }
  }, [selectedDate, company?.id, professional?.id]);

  const handleNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1));
  };

  const handlePrevDay = () => {
    const prevDay = addDays(selectedDate, -1);
    if (prevDay >= startOfDay(new Date())) {
      setSelectedDate(prevDay);
    }
  };

  const profileUrl = slug && professionalSlug
    ? `${window.location.origin}/perfil/${businessType === 'esthetic' ? 'estetica' : 'barbearia'}/${slug}/${professionalSlug}`
    : window.location.href;

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: `${professional?.name} - ${company?.name}`, url: profileUrl }); } catch {}
    } else {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const bookingUrl = company && professionalSlug
    ? `/${businessType === 'esthetic' ? 'estetica' : 'barbearia'}/${slug}/${professionalSlug}/agendar`
    : '#';

  const isDark = businessType === 'barbershop';
  const branding = getCompanyBranding(companySettings, isDark);
  useApplyBranding(branding);
  const T = buildThemeFromBranding(branding, isDark);
  const avatarUrl = profile?.avatar_url || professional?.avatar_url;
  const socialLinks = profile?.social_links as any;
  const instagramUrl = socialLinks?.instagram ? (socialLinks.instagram.startsWith('http') ? socialLinks.instagram : `https://instagram.com/${socialLinks.instagram.replace('@', '')}`) : null;
  const whatsappNumber = profile?.whatsapp;
  const whatsappDigits = whatsappNumber ? formatWhatsApp(whatsappNumber) : null;

  const displayedReviews = showAllReviews ? reviews : reviews.slice(0, 3);

  const handleSubmitReview = async (data: { 
    rating: number; 
    comment: string; 
    tags: string[]; 
    reviewer_name?: string;
    reviewer_phone?: string;
  }) => {
    if (!company?.id || !professional?.id) return;

    const reviewerName = data.reviewer_name || currentClient?.name || null;
    
    if (!reviewerName) {
      toast.error("Por favor, identifique-se para enviar a avaliação.");
      return;
    }

    setIsSubmittingReview(true);
    try {
      const finalPhone = data.reviewer_phone || currentClient?.whatsapp || null;
      const finalAvatar = currentClient?.avatar_url || null;

      const { error } = await supabase.from('reviews').insert({
        company_id: company.id,
        professional_id: professional.id,
        rating: data.rating,
        comment: data.comment,
        tags: data.tags,
        reviewer_name: reviewerName,
        reviewer_phone: finalPhone,
        reviewer_avatar: finalAvatar,
        review_type: 'professional'
      });

      if (error) throw error;

      toast.success("Avaliação enviada com sucesso!");
      setIsAddReviewModalOpen(false);
      load(); 
    } catch (err: any) {
      console.error('Error submitting review:', err);
      toast.error("Erro ao enviar avaliação: " + (err.message || 'Erro desconhecido'));
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg }}>
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-gray-700" />
          <div className="h-4 w-32 bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (!professional || !company) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg }}>
        <p className="text-lg" style={{ color: T.textSec }}>Profissional não encontrado.</p>
      </div>
    );
  }

  const seoTitle = `${professional.name} | ${businessType === 'esthetic' ? 'Profissional' : 'Barbeiro'} na ${company.name}`;
  const seoDescription = `Agende com ${professional.name} na ${company.name} em ${company.city || ''} ${company.state || ''}.`.trim();

  const firstName = professional.name.split(' ')[0];
  const goldGradient = `linear-gradient(135deg, ${T.accent} 0%, #F4C752 50%, ${T.accent} 100%)`;
  const fullAddress = [company?.address, company?.address_number, company?.district, company?.city, company?.state].filter(Boolean).join(', ');
  const companyWhatsapp = company?.whatsapp ? formatWhatsApp(company.whatsapp) : (company?.phone ? formatWhatsApp(company.phone) : null);

  return (
    <div className="min-h-screen overflow-x-hidden pb-28" style={{ background: T.bg }}>
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        ogTitle={seoTitle}
        ogDescription={seoDescription}
        ogImage={professional.avatar_url || company.logo_url}
        canonical={profileUrl}
      />

      {/* HERO — banner ocupando topo, avatar SOBRE o banner */}
      <section className="relative w-full">
        <div className="relative h-[420px] sm:h-[460px] overflow-hidden">
          <motion.div style={{ y: y1 }} className="absolute inset-0">
            {profile?.banner_url ? (
              <img src={profile.banner_url} alt="Banner" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${T.accent}40, ${T.bg})` }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-[var(--hero-fade)]" style={{ ['--hero-fade' as any]: T.bg }} />
          </motion.div>


          {/* Avatar centralizado SOBRE o banner */}
          <div className="absolute inset-x-0 bottom-24 flex justify-center z-10">
            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative">
              <div className="w-28 h-28 rounded-full p-[3px] shadow-2xl" style={{ background: goldGradient }}>
                <div className="w-full h-full rounded-full overflow-hidden bg-background">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={professional.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl font-bold" style={{ background: `${T.accent}20`, color: T.accent }}>
                      {professional.name?.charAt(0)}
                    </div>
                  )}
                </div>
              </div>
              <div className="absolute -bottom-1 right-0 rounded-full p-0.5 shadow-lg" style={{ background: goldGradient }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: T.bg }}>
                  <BadgeCheck className="w-4 h-4" style={{ color: T.accent }} fill={T.accent} stroke={T.bg} />
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Identidade */}
        <div className="text-center -mt-16 px-4 relative z-10">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl font-black tracking-tight" style={{ color: T.text }}>{professional.name}</h1>
            <BadgeCheck className="w-6 h-6" style={{ color: T.accent }} fill={T.accent} stroke={T.bg} />
          </div>
          <p className="text-sm mt-1.5 opacity-80" style={{ color: T.textSec }}>{profile?.specialty}</p>

          <div className="flex items-center justify-center gap-4 mt-3 text-sm" style={{ color: T.textSec }}>
            <div className="flex items-center gap-1.5">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-bold" style={{ color: T.text }}>{rating?.avg?.toFixed(1) || '5.0'}</span>
              <span className="opacity-60">({rating?.count || 0} avaliações)</span>
            </div>
            <span className="opacity-30">•</span>
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>{company.city}, {company.state}</span>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-3xl mx-auto px-4 mt-8 space-y-6">

        {/* CTA PRINCIPAL DOURADO */}
        <button
          onClick={() => navigate(bookingUrl)}
          className="w-full rounded-2xl py-4 px-6 flex items-center justify-center gap-3 shadow-2xl transition-transform hover:scale-[1.01] active:scale-[0.99]"
          style={{ background: goldGradient, boxShadow: `0 10px 40px -10px ${T.accent}80` }}
        >
          <Calendar className="w-5 h-5" style={{ color: '#1a1a1a' }} />
          <span className="text-base font-black" style={{ color: '#1a1a1a' }}>Agendar com {firstName}</span>
          <span className="ml-auto" style={{ color: '#1a1a1a' }}>›</span>
        </button>

        {/* BOTÕES SECUNDÁRIOS */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {whatsappDigits ? (
            <a
              href={buildWhatsAppUrl(whatsappDigits, `Olá ${professional.name}!`)}
              onClick={() => trackWhatsAppClick('professional-profile')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 sm:gap-2 h-12 rounded-xl border font-bold text-xs sm:text-sm transition-colors px-2 text-center"
              style={{ borderColor: '#25D36680', background: 'transparent', color: '#25D366' }}
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">WhatsApp</span>
            </a>
          ) : (
            <button onClick={handleShare} className="flex items-center justify-center gap-2 h-12 rounded-xl border font-bold text-xs sm:text-sm px-2" style={{ borderColor: T.border, background: 'transparent', color: T.text }}>
              <Share2 className="w-4 h-4 shrink-0" /> Compartilhar
            </button>
          )}
          <button
            onClick={() => navigate(`${bookingUrl}?request=true`)}
            className="flex items-center justify-center gap-1 sm:gap-2 h-12 rounded-xl border font-bold text-xs sm:text-sm px-2 text-center"
            style={{ borderColor: T.border, background: 'transparent', color: T.text }}
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">Mensagem</span>
          </button>
        </div>

        {/* BENEFÍCIOS E VANTAGENS */}
        <BenefitsSection companyId={company.id} professionalId={professional.id} />

        {/* Bloco de Assinatura */}
        <MembershipSection companyId={company.id} professionalId={professional.id} />

        {/* BLOCO COMPACTO DE AVALIAÇÕES PREMIUM COM CARROSSEL */}
        {rating && (
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="w-full rounded-[2rem] border p-6 flex flex-col md:flex-row items-stretch gap-6 text-left transition-all shadow-lg relative overflow-hidden group cursor-pointer"
            onClick={() => setIsReviewsDrawerOpen(true)}
            style={{ 
              background: T.card, 
              borderColor: T.border,
              boxShadow: `0 10px 30px -10px ${T.accent}15`
            }}
          >
            {/* Botão Ver Todas elegante no canto */}
            <div 
              className="absolute top-4 right-6 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-colors z-20"
              style={{ color: T.accent }}
            >
              Ver todas
              <span className="text-lg leading-none transition-transform group-hover:translate-x-1">›</span>
            </div>

            {/* Lado Esquerdo — Resumo (Fixo) */}
            <div className="flex flex-col justify-center items-center md:items-start md:pr-8 md:border-r border-dashed shrink-0" style={{ borderColor: `${T.accent}30` }}>
              <div className="flex items-center gap-1.5 mb-1 opacity-60">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.textSec }}>Avaliações</span>
              </div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-black leading-none" style={{ color: T.text }}>{rating.count > 0 ? rating.avg.toFixed(1).replace('.', ',') : '0,0'}</span>
              </div>
              <div className="flex flex-col items-center md:items-start gap-1">
                <StarRating rating={rating.avg} size={14} />
                <span className="text-[11px] font-bold opacity-50" style={{ color: T.textSec }}>
                  {rating.count} {rating.count === 1 ? 'avaliação' : 'avaliações'}
                </span>
              </div>
            </div>
            
            {/* Lado Direito — Avaliação em Destaque (Carrossel) */}
            <div className="flex-1 min-w-0 flex flex-col justify-center relative">
              {reviews.length > 0 ? (
                <div className="relative group/carousel">
                  <AnimatePresence mode="wait">
                    <motion.div 
                      key={currentReviewIndex}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-3 pr-8"
                    >
                      <div className="flex items-center gap-2">
                        {reviews[currentReviewIndex].client_avatar_url ? (
                          <img 
                            src={reviews[currentReviewIndex].client_avatar_url} 
                            alt="" 
                            className="w-8 h-8 rounded-full object-cover ring-2" 
                            style={{ outline: `1px solid ${T.accent}30` }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs" style={{ background: `${T.accent}15`, color: T.accent }}>
                            {(reviews[currentReviewIndex].client_display_name || 'C').charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold truncate" style={{ color: T.text }}>
                              {reviews[currentReviewIndex].client_display_name || 'Cliente'}
                            </span>
                            <div className="flex gap-0.5">
                              {[1,2,3,4,5].map(s => (
                                <Star key={s} className={cn("w-2.5 h-2.5", s <= reviews[currentReviewIndex].rating ? "fill-yellow-400 text-yellow-400" : "opacity-10")} />
                              ))}
                            </div>
                          </div>
                          <p className="text-[9px] opacity-40 font-semibold" style={{ color: T.textSec }}>
                            {format(new Date(reviews[currentReviewIndex].created_at), 'dd MMM yyyy', { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      
                      <div className="relative">
                        <p className="text-sm leading-relaxed opacity-90 italic line-clamp-2 pl-4 border-l-2" style={{ color: T.text, borderColor: `${T.accent}40` }}>
                          "{reviews[currentReviewIndex].comment || 'Experiência excelente!'}"
                        </p>
                      </div>

                      {reviews[currentReviewIndex].tags && reviews[currentReviewIndex].tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {reviews[currentReviewIndex].tags.slice(0, 2).map((tag: string) => (
                            <span key={tag} className="text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter" style={{ background: `${T.accent}10`, color: T.accent, border: `1px solid ${T.accent}20` }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {/* Setas de navegação */}
                  {reviews.length > 1 && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-30">
                      <button
                        onClick={prevReview}
                        className="w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md bg-black/10 border border-black/5 text-current hover:bg-black/20 transition-all active:scale-90"
                        style={{ color: T.text }}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={nextReview}
                        className="w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md bg-black/10 border border-black/5 text-current hover:bg-black/20 transition-all active:scale-90"
                        style={{ color: T.text }}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full space-y-2 opacity-60">
                  <Star className="w-8 h-8 opacity-20" style={{ color: T.accent }} />
                  <p className="text-sm font-medium italic" style={{ color: T.textSec }}>Ainda não há depoimentos para {firstName}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
        {/* ÚLTIMO ATENDIMENTO */}
        <AnimatePresence>
          {lastBooking && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border p-5"
              style={{ background: T.card, borderColor: T.border }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4" style={{ color: T.accent }} />
                <h3 className="text-sm font-bold" style={{ color: T.text }}>Seu último atendimento com {firstName}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[auto,1fr,auto] gap-4 items-center">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2" style={{ borderColor: T.accent }}>
                    {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full" style={{ background: T.accent }} />}
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: T.text }}>{lastBooking.serviceName || 'Serviço'}</p>
                    <p className="text-xs opacity-70" style={{ color: T.textSec }}>
                      {format(parseISO(lastBooking.start_time), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-500">Concluído</span>
                  </div>
                </div>
                <div className="px-4 sm:border-l" style={{ borderColor: T.border }}>
                  <p className="text-xs font-bold flex items-center gap-1" style={{ color: T.accent }}>
                    💡 Dica do {firstName}
                  </p>
                  <p className="text-xs mt-1 opacity-80" style={{ color: T.textSec }}>
                    Para manter o degradê sempre alinhado, retorne em até 20 dias.
                  </p>
                </div>
                <Button
                  onClick={() => navigate(`${bookingUrl}?rebook=1`)}
                  className="h-11 px-5 rounded-xl font-bold whitespace-nowrap"
                  style={{ background: T.accent, color: '#1a1a1a' }}
                >
                  Repetir atendimento
                </Button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* SERVIÇOS + AGENDA — duas colunas */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Serviços */}
          {services.length > 0 && (
            <div className="rounded-2xl border p-5" style={{ background: T.card, borderColor: T.border }}>
              <div className="flex items-center gap-2 mb-4">
                <Scissors className="w-4 h-4" style={{ color: T.accent }} />
                <h3 className="text-sm font-bold" style={{ color: T.text }}>Serviços de {firstName}</h3>
              </div>
              <div className="space-y-1">
                {services.slice(0, 5).map(svc => (
                  <button
                    key={svc.id}
                    onClick={() => navigate(`${bookingUrl}?services=${svc.id}`)}
                    className="w-full flex items-center justify-between py-2.5 border-b last:border-b-0 text-left transition-colors hover:bg-black/5 active:scale-[0.98]" 
                    style={{ borderColor: `${T.border}80` }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Scissors className="w-3.5 h-3.5 flex-shrink-0 opacity-60" style={{ color: T.textSec }} />
                      <span className="text-sm font-medium truncate" style={{ color: T.text }}>{svc.name}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs opacity-60" style={{ color: T.textSec }}>{svc.duration_minutes} min</span>
                      <span className="text-sm font-bold" style={{ color: T.accent }}>R$ {Number(svc.price).toFixed(2)}</span>
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => navigate(bookingUrl)}
                className="w-full mt-4 py-2.5 rounded-xl border text-xs font-semibold hover:bg-black/5 transition-colors"
                style={{ borderColor: T.border, color: T.text, background: 'transparent' }}
              >
                Ver todos os serviços
              </button>
            </div>
          )}

          {/* Agenda */}
          {nextAvailable && (
            <div className="rounded-2xl border p-5" style={{ background: T.card, borderColor: T.border }}>
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4" style={{ color: T.accent }} />
                <h3 className="text-sm font-bold" style={{ color: T.text }}>Agenda disponível</h3>
              </div>

              {/* Seletor de data */}
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setIsDatePickerOpen(true)}
                  className="flex-1 px-3 py-2.5 rounded-lg border flex items-center justify-between text-sm hover:opacity-80 transition-opacity"
                  style={{ borderColor: T.border, color: T.text, background: T.bg }}
                >
                  <span className="font-semibold">{nextAvailable.label || format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</span>
                  <span className="opacity-50">▾</span>
                </button>
                <button 
                  onClick={handlePrevDay}
                  disabled={isToday(selectedDate)}
                  className="w-9 h-9 rounded-lg border flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/5" 
                  style={{ borderColor: T.border, color: T.textSec }}
                >
                  ‹
                </button>
                <button 
                  onClick={handleNextDay}
                  className="w-9 h-9 rounded-lg border flex items-center justify-center hover:bg-black/5" 
                  style={{ borderColor: T.border, color: T.textSec }}
                >
                  ›
                </button>
              </div>

              {/* Grade de horários */}
              <div className="grid grid-cols-3 gap-2">
                {availableSlotsForDate.length > 0 ? (
                  availableSlotsForDate.slice(0, 9).map(time => (
                    <button
                      key={time}
                      onClick={() => navigate(`${bookingUrl}?date=${format(selectedDate, 'yyyy-MM-dd')}&time=${time}`)}
                      className="py-2.5 rounded-lg text-sm font-bold border transition-all hover:scale-105 active:scale-95"
                      style={{ background: 'transparent', borderColor: `${T.accent}40`, color: T.accent }}
                    >
                      {time}
                    </button>
                  ))
                ) : (
                  <div className="col-span-3 py-4 text-center text-xs opacity-50" style={{ color: T.textSec }}>
                    {slotsLoading ? 'Carregando...' : 'Nenhum horário disponível para esta data.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Date Picker Dialog */}
        <Dialog open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
          <DialogContent className="p-0 border-none bg-transparent shadow-none max-w-[92%] sm:max-w-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 rounded-[2.5rem] border shadow-2xl backdrop-blur-xl relative overflow-hidden" 
              style={{ 
                backgroundColor: `${T.card}F2`, 
                borderColor: `${T.border}40`,
                boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 20px ${T.accent}10`
              }}
            >
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-[60px] rounded-full -mr-16 -mt-16" style={{ backgroundColor: `${T.accent}10` }} />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent/5 blur-[60px] rounded-full -ml-16 -mb-16" style={{ backgroundColor: `${T.accent}10` }} />

              <div className="mb-6 text-center relative z-10">
                <h3 className="text-lg font-black tracking-tight" style={{ color: T.text }}>Escolha uma Data</h3>
                <p className="text-xs opacity-60 mt-1" style={{ color: T.textSec }}>Selecione o melhor dia para você</p>
              </div>

              <div className="relative z-10">
                <CalendarUI
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setIsDatePickerOpen(false);
                    }
                  }}
                  disabled={{ before: startOfDay(new Date()) }}
                  initialFocus
                  locale={ptBR}
                  className="rounded-2xl border-none mx-auto p-0"
                  classNames={{
                    months: "w-full",
                    month: "w-full space-y-4",
                    caption: "flex justify-center pt-1 relative items-center mb-4",
                    caption_label: "text-sm font-bold",
                    nav: "space-x-1 flex items-center",
                    nav_button: "h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100 transition-opacity",
                    nav_button_previous: "absolute left-1",
                    nav_button_next: "absolute right-1",
                    table: "w-full border-collapse space-y-1",
                    head_row: "flex justify-between",
                    head_cell: "text-muted-foreground rounded-md w-9 font-bold text-[0.7rem] uppercase tracking-wider opacity-50",
                    row: "flex w-full mt-2 justify-between",
                    cell: "h-10 w-10 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                    day: cn(
                      "h-10 w-10 p-0 font-semibold transition-all duration-200 rounded-xl hover:scale-110 active:scale-90 flex items-center justify-center",
                      "hover:bg-accent/10"
                    ),
                    day_selected: "scale-110 shadow-lg",
                    day_today: "border-2",
                    day_outside: "opacity-20 pointer-events-none",
                    day_disabled: "opacity-20 pointer-events-none",
                    ...({} as any)
                  }}
                  modifiersStyles={{
                    selected: { 
                      backgroundColor: T.accent, 
                      color: '#1a1a1a',
                      fontWeight: '900',
                      boxShadow: `0 8px 20px ${T.accent}40`,
                      borderRadius: '12px'
                    },
                    today: {
                      borderColor: T.accent,
                      color: T.accent,
                      fontWeight: 'bold',
                      borderRadius: '12px'
                    }
                  }}
                  style={{ backgroundColor: 'transparent' }}
                />
              </div>

              <Button 
                onClick={() => setIsDatePickerOpen(false)}
                className="w-full mt-8 h-12 rounded-2xl font-bold transition-transform active:scale-95"
                style={{ background: T.accent, color: '#1a1a1a' }}
              >
                Confirmar Data
              </Button>
            </motion.div>
          </DialogContent>
        </Dialog>

        {/* Localização */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: T.text }}>
            <MapPin className="w-5 h-5" style={{ color: T.accent }} />
            Localização
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-5 rounded-2xl border" style={{ background: T.card, borderColor: T.border }}>
              <div className="flex items-start gap-2 mb-3">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: T.accent }} />
                <div>
                  <p className="font-bold text-base" style={{ color: T.text }}>{company.name}</p>
                  <p className="text-sm opacity-70 leading-relaxed mt-1" style={{ color: T.textSec }}>
                    {[company.address, company.address_number].filter(Boolean).join(', ')}
                    {company.district && <><br />{company.district}</>}
                    {(company.city || company.state) && <><br />{[company.city, company.state].filter(Boolean).join(', ')}</>}
                    {company.postal_code && <><br />CEP {company.postal_code}</>}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <Button
                  variant="outline"
                  asChild
                  className="rounded-xl h-10 font-semibold border-2 text-xs"
                  style={{ borderColor: T.accent, color: T.accent, background: 'transparent' }}
                >
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`} target="_blank" rel="noopener noreferrer">
                    <Navigation className="w-3.5 h-3.5 mr-1" />
                    Como chegar
                  </a>
                </Button>
                {companyWhatsapp && (
                  <Button
                    variant="outline"
                    asChild
                    className="rounded-xl h-10 font-semibold border-2 text-xs"
                    style={{ borderColor: '#25D366', color: '#25D366', background: 'transparent' }}
                  >
                    <a href={buildWhatsAppUrl(companyWhatsapp)} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="w-3.5 h-3.5 mr-1" />
                      WhatsApp
                    </a>
                  </Button>
                )}
              </div>
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border overflow-hidden block relative min-h-[200px]"
              style={{ background: T.card, borderColor: T.border }}
            >
              <iframe
                title="Mapa"
                src={`https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`}
                className="w-full h-full absolute inset-0 border-0"
                loading="lazy"
              />
            </a>
          </div>
        </section>

        <div className="pt-6 pb-4 opacity-40 text-center">
          <PlatformBranding isDark={isDark} />
        </div>
      </main>

      {/* Bottom Navigation Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden pb-safe" style={{ background: T.bg, borderTop: `1px solid ${T.border}` }}>
        <div className="flex items-center justify-around h-16">
          <button 
            onClick={() => navigate(`/${businessType === 'esthetic' ? 'estetica' : 'barbearia'}/${slug}`)}
            className="flex flex-col items-center gap-0.5 py-2 text-xs font-medium opacity-60 hover:opacity-100 transition-opacity" 
            style={{ color: T.textSec }}
          >
            <Home className="w-5 h-5" />
            <span>Início</span>
          </button>
          
          <button 
            onClick={() => navigate(bookingUrl)}
            className="flex flex-col items-center gap-0.5 -mt-8"
          >
            <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl mb-1 transition-transform active:scale-95" style={{ background: goldGradient }}>
              <Calendar className="w-7 h-7" style={{ color: '#1a1a1a' }} />
            </div>
            <span className="text-[10px] font-bold" style={{ color: T.accent }}>Agendar</span>
          </button>

          <button 
            onClick={() => setIsReviewsDrawerOpen(true)}
            className="flex flex-col items-center gap-0.5 py-2 text-xs font-medium opacity-60 hover:opacity-100 transition-opacity" 
            style={{ color: T.textSec }}
          >
            <Star className="w-5 h-5" />
            <span>Avaliações</span>
          </button>
        </div>
      </nav>

      {/* Reviews Modal */}
      <Dialog open={isReviewsDrawerOpen} onOpenChange={setIsReviewsDrawerOpen}>
        <DialogContent 
          className="fixed inset-auto left-[50%] top-[50%] -translate-x-1/2 -translate-y-1/2 w-[92%] sm:w-full sm:max-w-[720px] h-auto max-h-[85vh] sm:max-h-[90vh] border-none p-0 overflow-hidden flex flex-col rounded-[2rem] shadow-2xl" 
          style={{ backgroundColor: T.card }}
        >
          <DialogHeader 
            className="flex flex-row items-center justify-between border-b pb-6 px-6 pt-10 pr-[84px] shrink-0 relative" 
            style={{ borderColor: T.border, backgroundColor: T.card }}
          >
            <div className="text-left space-y-1">
              <DialogTitle className="text-xl font-bold" style={{ color: T.text }}>Avaliações</DialogTitle>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-yellow-400/10 px-2 py-0.5 rounded-md">
                   <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                   <span className="text-sm font-bold text-yellow-500">{rating?.avg.toFixed(1) || '0.0'}</span>
                </div>
                <DialogDescription className="font-medium" style={{ color: T.textSec }}>
                  {allReviewsList.length} {allReviewsList.length === 1 ? 'depoimento' : 'depoimentos'}
                </DialogDescription>
              </div>
            </div>
            <Button 
              size="sm" 
              className="rounded-full font-bold px-6 shadow-lg shadow-black/10 transition-transform active:scale-95 border-none focus:ring-0 focus-visible:ring-0 outline-none" 
              style={{ background: T.accent, color: '#000' }}
              onClick={() => {
                setIsReviewsDrawerOpen(false);
                setIsAddReviewModalOpen(true);
              }}
            >
              Avaliar
            </Button>
          </DialogHeader>
          
          <DialogBody className="space-y-4 px-6 py-6 overflow-y-auto" style={{ backgroundColor: `${T.card}` }}>
            {allReviewsList.map((rev: any, i: number) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                key={i} 
                className="p-5 rounded-2xl border space-y-3 text-left shadow-sm" 
                style={{ background: `${T.card}CC`, borderColor: T.border }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {rev.client_avatar_url ? (
                      <img 
                        src={rev.client_avatar_url} 
                        alt={rev.client_display_name} 
                        className="w-10 h-10 rounded-full object-cover ring-2" 
                        style={{ outline: `2px solid ${T.accent}30` }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ring-2" style={{ background: `${T.accent}15`, outline: `2px solid ${T.accent}30`, color: T.accent }}>
                        {(rev.client_display_name || 'C').charAt(0)}
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-sm block" style={{ color: T.text }}>{rev.client_display_name || 'Cliente'}</span>
                      <p className="text-[10px] opacity-40 uppercase tracking-wider font-semibold" style={{ color: T.textSec }}>{format(new Date(rev.created_at), 'dd MMM yyyy', { locale: ptBR })}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 bg-black/20 px-2 py-1 rounded-full">
                    {[1,2,3,4,5].map(s => <Star key={s} className={cn("w-3 h-3", s <= rev.rating ? "fill-yellow-400 text-yellow-400" : "opacity-10")} />)}
                  </div>
                </div>
                <p className="text-sm leading-relaxed opacity-90" style={{ color: T.text }}>
                  {rev.comment || 'Experiência excelente!'}
                </p>
                {rev.tags && rev.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {rev.tags.map((tag: string) => (
                      <span key={tag} className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter" style={{ background: `${T.accent}15`, color: T.accent }}>{tag}</span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
            {allReviewsList.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 space-y-3 opacity-40">
                <Star className="w-12 h-12" style={{ color: T.textSec }} />
                <p className="text-center text-sm" style={{ color: T.textSec }}>Nenhuma avaliação ainda.</p>
              </div>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Review Modal */}
      <Dialog open={isAddReviewModalOpen} onOpenChange={setIsAddReviewModalOpen}>
        <DialogContent 
          className="p-0 border-none bg-transparent shadow-none max-w-[92%] sm:max-w-md"
          style={{ 
            backgroundColor: T.card,
            borderRadius: '24px',
            border: `1px solid ${T.border}`,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        >
          <ReviewForm
            title={professional?.name || "Profissional"}
            image={avatarUrl}
            theme={T}
            initialName={currentClient?.name || ''}
            initialPhone={currentClient?.whatsapp || ''}
            onCancel={() => setIsAddReviewModalOpen(false)}
            onSubmit={handleSubmitReview}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

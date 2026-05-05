import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface BannerProps {
  banner: any;
  className?: string;
}

// Track impressions in memory to avoid duplicates during the same session/page load
const trackedImpressions = new Set<string>();

export const MarketplaceBanner = ({ banner, className }: BannerProps) => {
  const isMobile = useIsMobile();
  const hasTrackedImpression = useRef(false);

  useEffect(() => {
    if (!banner || hasTrackedImpression.current) return;

    const trackImpression = async () => {
      // Also check the global set to be safe across re-renders/component remounts
      if (trackedImpressions.has(banner.id)) {
        hasTrackedImpression.current = true;
        return;
      }

      try {
        const { error } = await supabase.from('marketplace_banner_events').insert({
          banner_id: banner.id,
          event_type: 'impression',
          metadata: {
            viewport: isMobile ? 'mobile' : 'desktop',
            url: window.location.href
          }
        });

        if (!error) {
          trackedImpressions.add(banner.id);
          hasTrackedImpression.current = true;
        }
      } catch (err) {
        console.error('Error tracking banner impression:', err);
      }
    };

    trackImpression();
  }, [banner, isMobile]);

  const handleClick = async () => {
    if (!banner) return;

    try {
      // We don't wait for this to complete before navigating
      supabase.from('marketplace_banner_events').insert({
        banner_id: banner.id,
        event_type: 'click',
        metadata: {
          viewport: isMobile ? 'mobile' : 'desktop',
          url: window.location.href
        }
      }).then(({ error }) => {
        if (error) console.error('Error tracking banner click:', error);
      });

      if (banner.destination_link) {
        if (banner.open_in_new_tab) {
          window.open(banner.destination_link, '_blank', 'noopener,noreferrer');
        } else {
          window.location.href = banner.destination_link;
        }
      }
    } catch (err) {
      console.error('Error handling banner click:', err);
    }
  };

  if (!banner) return null;

  const imageUrl = (isMobile && banner.mobile_image_url) ? banner.mobile_image_url : banner.desktop_image_url;

  return (
    <div 
      className={cn(
        "relative rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300",
        className
      )}
      onClick={handleClick}
    >
      <img 
        src={imageUrl} 
        alt={banner.name} 
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        onError={(e) => {
          // Fallback if image fails
          e.currentTarget.src = 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=2070&auto=format&fit=crop';
          e.currentTarget.classList.add('opacity-50', 'grayscale');
        }}
      />
      
      {/* Optional: Add a subtle overlay for better text visibility if we had any text overlays */}
      <div className="absolute inset-0 bg-black/5 group-hover:bg-black/0 transition-colors" />
    </div>
  );
};

import React from 'react';
import { Promotion } from '@/pages/Promotions';
import { format, parseISO } from 'date-fns';

interface PromotionInstagramArtProps {
  promotion: Promotion;
  companyName: string;
  companyLogo?: string | null;
  services: any[];
  professionals: any[];
  publicProfileUrl: string;
  availableSlots?: string[];
  backgroundImageUrl?: string | null;
  isPreview?: boolean;
  primaryColor?: string;
  layout?: 'auto' | 'photo' | 'minimal';
}

export const PromotionInstagramArt = React.forwardRef<HTMLDivElement, PromotionInstagramArtProps>(
  ({ promotion, companyName, companyLogo, services, professionals, publicProfileUrl, availableSlots, backgroundImageUrl, isPreview, primaryColor = '#eab308', layout = 'auto' }, ref) => {
    const promoServiceIds = promotion.service_ids || (promotion.service_id ? [promotion.service_id] : []);
    const promoSvcs = services.filter(s => promoServiceIds.includes(s.id));
    
    const servicesText = (() => {
      if (promoServiceIds.length === 0 || promoServiceIds.length >= services.length) {
        return 'Todos os serviços';
      }
      if (promoSvcs.length === 1) {
        return promoSvcs[0].name;
      }
      return promoSvcs.length > 3 
        ? `${promoSvcs.slice(0, 3).map(s => s.name).join(', ')}...`
        : promoSvcs.map(s => s.name).join(', ');
    })();

    const profNames = promotion.professional_ids?.map(pid => {
      const p = professionals.find((pr: any) => pr.profile_id === pid);
      return p?.profiles?.full_name || '';
    }).filter(Boolean) || [];

    const professionalsText = profNames.length > 0 ? profNames.join(' & ') : companyName;

    const discountLabel = (() => {
      if (promotion.discount_type === 'percentage') {
        const text = `${promotion.discount_value}% OFF`;
        if (promoServiceIds.length === 0 || promoServiceIds.length >= services.length) return `${text} em tudo`;
        if (promoSvcs.length === 1) return `${text} em ${promoSvcs[0].name}`;
        return `${text} em ${promoServiceIds.length} serviços`;
      }
      if (promotion.discount_type === 'fixed_amount') {
        const text = `R$ ${promotion.discount_value} OFF`;
        if (promoSvcs.length === 1) return `${text} em ${promoSvcs[0].name}`;
        return text;
      }
      return 'Preço Especial';
    })();

    const hasValidPrice = promotion.promotion_price && Number(promotion.promotion_price) > 0;
    const hasOriginalPrice = promotion.original_price && Number(promotion.original_price) > 0;

    const containerStyle: React.CSSProperties = {
      width: '1080px',
      height: '1920px',
      backgroundColor: '#000',
      backgroundImage: layout === 'photo' && backgroundImageUrl 
        ? `linear-gradient(to top, ${primaryColor}dd 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.2) 100%), url(${backgroundImageUrl})`
        : layout === 'auto' 
          ? `linear-gradient(135deg, ${primaryColor} 0%, #000000 100%)`
          : 'linear-gradient(135deg, #1a1a1a 0%, #000000 100%)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: layout === 'photo' ? 'flex-end' : 'space-between',
      padding: layout === 'photo' ? '100px 60px 150px' : '100px 60px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      position: isPreview ? 'relative' : 'absolute',
      left: isPreview ? '0' : '-5000px',
      top: 0,
      transform: isPreview ? 'scale(0.3)' : 'none',
      transformOrigin: 'top center',
      zIndex: isPreview ? 10 : -1,
      overflow: 'hidden',
    };

    const badgeStyle: React.CSSProperties = {
      display: 'inline-block',
      backgroundColor: primaryColor,
      color: '#000',
      padding: '15px 45px',
      borderRadius: '50px',
      fontSize: '44px',
      fontWeight: '900',
      marginBottom: '40px',
      textTransform: 'uppercase',
      boxShadow: '0 10px 20px rgba(0,0,0,0.3)',
      textAlign: 'center',
      maxWidth: '900px',
    };

    return (
      <div ref={ref} style={containerStyle}>
        {/* Decorativos para layout auto */}
        {layout === 'auto' && !backgroundImageUrl && (
          <>
            <div style={{
              position: 'absolute',
              top: '-100px',
              right: '-100px',
              width: '700px',
              height: '700px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${primaryColor}33 0%, transparent 70%)`,
              zIndex: 0
            }} />
            <div style={{
              position: 'absolute',
              bottom: '-100px',
              left: '-100px',
              width: '800px',
              height: '800px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${primaryColor}26 0%, transparent 70%)`,
              zIndex: 0
            }} />
          </>
        )}

        {/* Top Section - Logo & Name */}
        {(layout === 'auto' || layout === 'minimal') && (
          <div style={{ zIndex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {companyLogo ? (
              <img src={companyLogo} alt="Logo" style={{ width: '180px', height: '180px', objectFit: 'contain', marginBottom: '30px', borderRadius: '30px', backgroundColor: 'white', padding: '15px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }} />
            ) : (
              <div style={{ width: '120px', height: '120px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '40px', fontSize: '60px', fontWeight: 'bold', border: '2px solid rgba(255,255,255,0.2)' }}>
                {companyName.charAt(0)}
              </div>
            )}
            <h2 style={{ fontSize: '48px', fontWeight: '600', margin: 0, color: 'white', textAlign: 'center', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>{professionalsText}</h2>
          </div>
        )}

        {/* Content Section */}
        <div style={{ zIndex: 1, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={badgeStyle}>
            {discountLabel}
          </div>

          <h1 style={{ 
            fontSize: layout === 'minimal' ? '140px' : '110px', 
            fontWeight: '900', 
            lineHeight: '1', 
            margin: '0 0 40px 0', 
            textTransform: 'uppercase', 
            letterSpacing: '-2px', 
            textShadow: '0 4px 20px rgba(0,0,0,0.6)',
            maxWidth: '1000px',
            wordBreak: 'break-word'
          }}>
            {promotion.title}
          </h1>
          
          {layout !== 'minimal' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '20px', marginBottom: '60px' }}>
              <div style={{ backgroundColor: 'rgba(0,0,0,0.4)', padding: '20px 40px', borderRadius: '25px', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '24px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '2px' }}>Serviços Inclusos</p>
                <p style={{ margin: 0, fontSize: '38px', fontWeight: '800' }}>{servicesText}</p>
              </div>
            </div>
          )}

          {/* Pricing Section */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '50px', marginBottom: '60px' }}>
            {hasOriginalPrice && hasValidPrice && (
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '38px', color: 'rgba(255,255,255,0.5)', textDecoration: 'line-through' }}>R$ {Number(promotion.original_price).toFixed(2)}</p>
                <p style={{ margin: 0, fontSize: '28px', color: 'rgba(255,255,255,0.5)', fontWeight: 'bold' }}>DE</p>
              </div>
            )}
            {hasValidPrice && (
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '150px', fontWeight: '900', color: primaryColor, lineHeight: '0.9', textShadow: '0 4px 30px rgba(0,0,0,0.5)' }}>R$ {Number(promotion.promotion_price).toFixed(2)}</p>
                <p style={{ margin: 0, fontSize: '40px', fontWeight: '900', color: primaryColor, textTransform: 'uppercase' }}>Por apenas</p>
              </div>
            )}
          </div>

          {availableSlots && availableSlots.length > 0 && layout !== 'minimal' && (
            <div style={{ marginBottom: '60px', width: '100%' }}>
              <p style={{ margin: '0 0 20px 0', fontSize: '32px', color: 'rgba(255,255,255,0.8)', fontWeight: 'bold' }}>Horários disponíveis:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '15px' }}>
                {availableSlots.slice(0, 6).map(slot => (
                  <div key={slot} style={{ backgroundColor: `${primaryColor}33`, border: `2px solid ${primaryColor}`, padding: '12px 30px', borderRadius: '15px', fontSize: '32px', fontWeight: '900', color: '#fff', backdropFilter: 'blur(5px)' }}>
                    {slot}
                  </div>
                ))}
                {availableSlots.length > 6 && <div style={{ padding: '12px 20px', fontSize: '30px', color: 'rgba(255,255,255,0.7)', fontWeight: 'bold' }}>+ {availableSlots.length - 6} mais</div>}
              </div>
            </div>
          )}

          <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '25px 50px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.1)', display: 'inline-block' }}>
            <p style={{ margin: 0, fontSize: '32px', color: 'rgba(255,255,255,0.9)' }}>
              Válido até <strong>{format(parseISO(promotion.end_date), 'dd/MM/yyyy')}</strong>
            </p>
          </div>
        </div>

        {/* Footer Section - CTA only */}
        <div style={{ zIndex: 1, width: '100%', textAlign: 'center', marginTop: layout === 'photo' ? '60px' : '0' }}>
          <div style={{ 
            backgroundColor: '#fff', 
            color: '#000', 
            padding: '40px 80px', 
            borderRadius: '100px', 
            fontSize: '48px', 
            fontWeight: '900', 
            display: 'inline-block', 
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)', 
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            RESERVE SEU HORÁRIO
          </div>
          {layout === 'photo' && (
            <div style={{ marginTop: '40px', fontSize: '36px', fontWeight: '800', opacity: 0.9 }}>
              {companyName}
            </div>
          )}
        </div>
      </div>
    );
  }
);

PromotionInstagramArt.displayName = 'PromotionInstagramArt';

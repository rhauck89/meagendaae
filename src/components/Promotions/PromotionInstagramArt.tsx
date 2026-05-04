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
  ({ promotion, companyName, companyLogo, services, professionals, publicProfileUrl, availableSlots, backgroundImageUrl, isPreview }, ref) => {
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
      if (promotion.discount_type === 'percentage') return `${promotion.discount_value}% OFF`;
      if (promotion.discount_type === 'fixed_amount') return `R$ ${promotion.discount_value} OFF`;
      return 'Preço Especial';
    })();

    const containerStyle: React.CSSProperties = {
      width: '1080px',
      height: '1920px',
      backgroundColor: '#000',
      backgroundImage: backgroundImageUrl 
        ? `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.8)), url(${backgroundImageUrl})`
        : 'linear-gradient(135deg, #1a1a1a 0%, #000000 100%)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '100px 60px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      position: isPreview ? 'relative' : 'absolute',
      left: isPreview ? '0' : '-5000px',
      top: 0,
      transform: isPreview ? 'scale(0.3)' : 'none',
      transformOrigin: 'top center',
      zIndex: isPreview ? 10 : -1,
    };

    return (
      <div ref={ref} style={containerStyle}>
        {!backgroundImageUrl && (
          <>
            <div style={{
              position: 'absolute',
              top: '-100px',
              right: '-100px',
              width: '500px',
              height: '500px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(234, 179, 8, 0.2) 0%, transparent 70%)',
              zIndex: 0
            }} />
            <div style={{
              position: 'absolute',
              bottom: '-100px',
              left: '-100px',
              width: '600px',
              height: '600px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(234, 179, 8, 0.15) 0%, transparent 70%)',
              zIndex: 0
            }} />
          </>
        )}

        <div style={{ zIndex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {companyLogo ? (
            <img src={companyLogo} alt="Logo" style={{ width: '180px', height: '180px', objectFit: 'contain', marginBottom: '30px', borderRadius: '20px', backgroundColor: 'white', padding: '10px' }} />
          ) : (
            <div style={{ width: '120px', height: '120px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '40px', fontSize: '48px', fontWeight: 'bold' }}>
              {companyName.charAt(0)}
            </div>
          )}
          <h2 style={{ fontSize: '42px', fontWeight: '500', margin: 0, color: 'rgba(255,255,255,0.9)', textAlign: 'center', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>{professionalsText}</h2>
        </div>

        <div style={{ zIndex: 1, width: '100%', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', backgroundColor: '#eab308', color: '#000', padding: '10px 40px', borderRadius: '50px', fontSize: '42px', fontWeight: '900', marginBottom: '40px', textTransform: 'uppercase', boxShadow: '0 10px 20px rgba(0,0,0,0.3)' }}>
            {discountLabel}
          </div>
          <h1 style={{ fontSize: '120px', fontWeight: '900', lineHeight: '0.9', margin: '0 0 50px 0', textTransform: 'uppercase', letterSpacing: '-3px', textShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>
            {promotion.title}
          </h1>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '20px', marginBottom: '70px' }}>
            <div style={{ backgroundColor: 'rgba(0,0,0,0.5)', padding: '25px 50px', borderRadius: '25px', border: '2px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}>
              <p style={{ margin: 0, fontSize: '24px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 'bold' }}>Serviços</p>
              <p style={{ margin: 0, fontSize: '36px', fontWeight: 'bold' }}>{servicesText}</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '50px', marginBottom: '70px' }}>
            {promotion.original_price && (
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '36px', color: 'rgba(255,255,255,0.5)', textDecoration: 'line-through' }}>R$ {Number(promotion.original_price).toFixed(2)}</p>
                <p style={{ margin: 0, fontSize: '28px', color: 'rgba(255,255,255,0.5)' }}>De</p>
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '140px', fontWeight: '900', color: '#eab308', lineHeight: '1', textShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>R$ {Number(promotion.promotion_price).toFixed(2)}</p>
              <p style={{ margin: 0, fontSize: '36px', fontWeight: 'bold', color: '#eab308' }}>Por apenas</p>
            </div>
          </div>

          {availableSlots && availableSlots.length > 0 && (
            <div style={{ marginBottom: '70px' }}>
              <p style={{ margin: '0 0 25px 0', fontSize: '32px', color: 'rgba(255,255,255,0.8)', fontWeight: 'bold' }}>Horários disponíveis:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '15px' }}>
                {availableSlots.slice(0, 6).map(slot => (
                  <div key={slot} style={{ backgroundColor: 'rgba(234, 179, 8, 0.2)', border: '2px solid #eab308', padding: '15px 35px', borderRadius: '15px', fontSize: '34px', fontWeight: '900', color: '#fff', backdropFilter: 'blur(5px)' }}>
                    {slot}
                  </div>
                ))}
                {availableSlots.length > 6 && <div style={{ padding: '15px 20px', fontSize: '32px', color: 'rgba(255,255,255,0.8)', fontWeight: 'bold' }}>+ {availableSlots.length - 6} horários</div>}
              </div>
            </div>
          )}

          <div style={{ backgroundColor: 'rgba(0,0,0,0.4)', padding: '30px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.1)', display: 'inline-block' }}>
            <p style={{ margin: 0, fontSize: '30px', color: 'rgba(255,255,255,0.9)' }}>
              Válido até <strong>{format(parseISO(promotion.end_date), 'dd/MM/yyyy')}</strong>
            </p>
          </div>
        </div>

        <div style={{ zIndex: 1, width: '100%', textAlign: 'center' }}>
          <div style={{ backgroundColor: '#fff', color: '#000', padding: '35px 70px', borderRadius: '100px', fontSize: '44px', fontWeight: '900', marginBottom: '45px', display: 'inline-block', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', textTransform: 'uppercase' }}>
            Agende pelo perfil
          </div>
          <p style={{ margin: 0, fontSize: '36px', fontWeight: 'bold', color: 'rgba(255,255,255,0.8)', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
            {publicProfileUrl.replace(/^https?:\/\//, '')}
          </p>
        </div>
      </div>
    );
  }
);

PromotionInstagramArt.displayName = 'PromotionInstagramArt';

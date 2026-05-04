import React from 'react';
import { Promotion } from '@/pages/Promotions';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PromotionInstagramArtProps {
  promotion: Promotion;
  companyName: string;
  companyLogo?: string | null;
  services: any[];
  professionals: any[];
  publicProfileUrl: string;
  availableSlots?: string[];
}

export const PromotionInstagramArt = React.forwardRef<HTMLDivElement, PromotionInstagramArtProps>(
  ({ promotion, companyName, companyLogo, services, professionals, publicProfileUrl, availableSlots }, ref) => {
    const promoServiceIds = promotion.service_ids || (promotion.service_id ? [promotion.service_id] : []);
    const promoSvcs = services.filter(s => promoServiceIds.includes(s.id));
    
    const servicesText = (() => {
      if (promoServiceIds.length === 0 || promoServiceIds.length >= services.length) {
        return 'Todos os serviços';
      }
      if (promoSvcs.length === 1) {
        return promoSvcs[0].name;
      }
      return promoSvcs.map(s => s.name).join(', ');
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

    return (
      <div
        ref={ref}
        style={{
          width: '1080px',
          height: '1920px',
          backgroundColor: '#000',
          backgroundImage: 'linear-gradient(135deg, #1a1a1a 0%, #000000 100%)',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '100px 60px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'absolute',
          left: '-5000px', // Hide from view
          top: 0,
        }}
      >
        {/* Background Decorative Elements */}
        <div style={{
          position: 'absolute',
          top: '-100px',
          right: '-100px',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(var(--primary-rgb, 234, 179, 8), 0.2) 0%, transparent 70%)',
          zIndex: 0
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-100px',
          left: '-100px',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(var(--primary-rgb, 234, 179, 8), 0.15) 0%, transparent 70%)',
          zIndex: 0
        }} />

        <div style={{ zIndex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {companyLogo ? (
            <img src={companyLogo} alt="Logo" style={{ width: '200px', height: '200px', objectFit: 'contain', marginBottom: '40px', borderRadius: '20px' }} />
          ) : (
            <div style={{ width: '120px', height: '120px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '40px', fontSize: '48px', fontWeight: 'bold' }}>
              {companyName.charAt(0)}
            </div>
          )}
          <h2 style={{ fontSize: '48px', fontWeight: '500', margin: 0, color: 'rgba(255,255,255,0.8)', textAlign: 'center' }}>{professionalsText}</h2>
        </div>

        <div style={{ zIndex: 1, width: '100%', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', backgroundColor: '#eab308', color: '#000', padding: '10px 30px', borderRadius: '50px', fontSize: '36px', fontWeight: '800', marginBottom: '30px', textTransform: 'uppercase' }}>
            {discountLabel}
          </div>
          <h1 style={{ fontSize: '110px', fontWeight: '900', lineHeight: '1', margin: '0 0 40px 0', textTransform: 'uppercase', letterSpacing: '-2px' }}>
            {promotion.title}
          </h1>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '20px', marginBottom: '60px' }}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '20px 40px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p style={{ margin: 0, fontSize: '24px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', marginBottom: '10px' }}>Serviços</p>
              <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>{servicesText}</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '40px', marginBottom: '60px' }}>
            {promotion.original_price && (
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '32px', color: 'rgba(255,255,255,0.4)', textDecoration: 'line-through' }}>R$ {Number(promotion.original_price).toFixed(2)}</p>
                <p style={{ margin: 0, fontSize: '24px', color: 'rgba(255,255,255,0.4)' }}>De</p>
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '120px', fontWeight: '900', color: '#eab308' }}>R$ {Number(promotion.promotion_price).toFixed(2)}</p>
              <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#eab308' }}>Por apenas</p>
            </div>
          </div>

          {availableSlots && availableSlots.length > 0 && (
            <div style={{ marginBottom: '60px' }}>
              <p style={{ margin: '0 0 20px 0', fontSize: '28px', color: 'rgba(255,255,255,0.6)' }}>Horários disponíveis:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '15px' }}>
                {availableSlots.slice(0, 6).map(slot => (
                  <div key={slot} style={{ backgroundColor: 'rgba(234, 179, 8, 0.15)', border: '2px solid rgba(234, 179, 8, 0.5)', padding: '15px 30px', borderRadius: '15px', fontSize: '32px', fontWeight: 'bold', color: '#eab308' }}>
                    {slot}
                  </div>
                ))}
                {availableSlots.length > 6 && <div style={{ padding: '15px 20px', fontSize: '32px', color: 'rgba(255,255,255,0.6)' }}>+ {availableSlots.length - 6} horários</div>}
              </div>
            </div>
          )}

          <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '30px', borderRadius: '30px' }}>
            <p style={{ margin: 0, fontSize: '28px', color: 'rgba(255,255,255,0.7)' }}>
              Válido de <strong>{format(parseISO(promotion.start_date), 'dd/MM/yyyy')}</strong> até <strong>{format(parseISO(promotion.end_date), 'dd/MM/yyyy')}</strong>
            </p>
          </div>
        </div>

        <div style={{ zIndex: 1, width: '100%', textAlign: 'center' }}>
          <div style={{ backgroundColor: '#fff', color: '#000', padding: '30px 60px', borderRadius: '100px', fontSize: '40px', fontWeight: '800', marginBottom: '40px', display: 'inline-block', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            AGENDE PELO PERFIL
          </div>
          <p style={{ margin: 0, fontSize: '32px', fontWeight: '500', color: 'rgba(255,255,255,0.6)' }}>
            {publicProfileUrl.replace(/^https?:\/\//, '')}
          </p>
        </div>
      </div>
    );
  }
);

PromotionInstagramArt.displayName = 'PromotionInstagramArt';

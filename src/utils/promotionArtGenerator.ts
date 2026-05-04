import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface PromotionArtData {
  title: string;
  discount_type: string;
  discount_value: number;
  original_price: number | null;
  promotion_price: number;
  end_date: string;
  service_ids: string[];
  professional_ids?: string[];
  services: any[];
  professionals: any[];
  companyName: string;
  companyLogo?: string | null;
  publicProfileUrl: string;
  availableSlots?: string[];
  backgroundImageUrl?: string | null;
  primaryColor?: string;
  layout?: 'auto' | 'photo' | 'minimal';
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => {
      console.error(`Error loading image: ${src}`, err);
      reject(err);
    };
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  for (const word of words) {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && line !== '') {
      ctx.fillText(line.trim(), x, currentY);
      line = word + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
  return currentY + lineHeight;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function generatePromotionArt(data: PromotionArtData): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  const primaryColor = data.primaryColor || '#eab308';
  const layout = data.layout || 'auto';

  console.log('Generating promotion art...', { title: data.title, layout, primaryColor });

  // 1. Draw Background
  if (layout === 'photo' && data.backgroundImageUrl) {
    try {
      const bgImg = await loadImage(data.backgroundImageUrl);
      const scale = Math.max(canvas.width / bgImg.width, canvas.height / bgImg.height);
      const x = (canvas.width / 2) - (bgImg.width / 2) * scale;
      const y = (canvas.height / 2) - (bgImg.height / 2) * scale;
      ctx.drawImage(bgImg, x, y, bgImg.width * scale, bgImg.height * scale);
      
      // Gradient overlay: Bottom-up
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.2)');
      grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.4)');
      grad.addColorStop(1, primaryColor + 'dd'); // primary color at bottom
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } catch (err) {
      console.warn('Failed to load background image, using default gradient', err);
      drawDefaultGradient(ctx, canvas, primaryColor, layout);
    }
  } else {
    drawDefaultGradient(ctx, canvas, primaryColor, layout);
  }

  function drawDefaultGradient(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, color: string, layout: string) {
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    if (layout === 'auto') {
      grad.addColorStop(0, color);
      grad.addColorStop(1, '#000000');
    } else {
      grad.addColorStop(0, '#1a1a1a');
      grad.addColorStop(1, '#000000');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (layout === 'auto') {
      // Decorative circles
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.arc(canvas.width, 0, 700, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.beginPath();
      ctx.arc(0, canvas.height, 800, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  let topOffset = 150;

  // 2. Logo & Professionals Section (Top for auto and minimal)
  if (layout === 'auto' || layout === 'minimal') {
    if (data.companyLogo) {
      try {
        const logoImg = await loadImage(data.companyLogo);
        const logoSize = 180;
        const logoX = (canvas.width - logoSize) / 2;
        
        ctx.fillStyle = '#FFFFFF';
        roundRect(ctx, logoX - 15, topOffset - 15, logoSize + 30, logoSize + 30, 30);
        ctx.fill();
        
        ctx.drawImage(logoImg, logoX, topOffset, logoSize, logoSize);
        topOffset += logoSize + 60;
      } catch (err) {
        topOffset += 180;
      }
    } else {
      const size = 120;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, topOffset + size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.stroke();
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 60px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(data.companyName.charAt(0).toUpperCase(), canvas.width / 2, topOffset + size / 2);
      topOffset += size + 60;
    }

    const profNames = data.professional_ids?.map(pid => {
      const p = data.professionals.find((pr: any) => pr.profile_id === pid);
      return p?.profiles?.full_name || '';
    }).filter(Boolean) || [];
    const professionalsText = profNames.length > 0 ? profNames.join(' & ') : data.companyName;

    ctx.fillStyle = 'white';
    ctx.font = '600 48px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText(professionalsText, canvas.width / 2, topOffset);
    ctx.shadowBlur = 0;
    topOffset += 150;
  } else {
    // For photo layout, content is bottom-aligned
    topOffset = canvas.height - 1100;
  }

  // 3. Discount Badge
  const promoServiceIds = data.service_ids || [];
  const promoSvcs = data.services.filter(s => promoServiceIds.includes(s.id));
  
  const discountLabel = (() => {
    if (data.discount_type === 'percentage') {
      const text = `${data.discount_value}% OFF`;
      if (promoServiceIds.length === 0 || promoServiceIds.length >= data.services.length) return `${text} EM TUDO`;
      if (promoSvcs.length === 1) return `${text} EM ${promoSvcs[0].name.toUpperCase()}`;
      return `${text} EM ${promoServiceIds.length} SERVIÇOS`;
    }
    if (data.discount_type === 'fixed_amount') {
      const text = `R$ ${data.discount_value} OFF`;
      if (promoSvcs.length === 1) return `${text} EM ${promoSvcs[0].name.toUpperCase()}`;
      return text;
    }
    return 'PREÇO ESPECIAL';
  })();

  ctx.font = '900 44px system-ui, -apple-system, sans-serif';
  const labelWidth = Math.min(900, ctx.measureText(discountLabel).width + 100);
  const labelHeight = 85;
  ctx.fillStyle = primaryColor;
  roundRect(ctx, (canvas.width - labelWidth) / 2, topOffset, labelWidth, labelHeight, 42);
  ctx.fill();
  
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(discountLabel, canvas.width / 2, topOffset + labelHeight / 2);

  // 4. Title
  topOffset += labelHeight + 60;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `900 ${layout === 'minimal' ? '140px' : '110px'} system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 20;
  topOffset = wrapText(ctx, data.title.toUpperCase(), canvas.width / 2, topOffset, 1000, layout === 'minimal' ? 140 : 110);
  ctx.shadowBlur = 0;

  // 5. Services (Only for non-minimal)
  if (layout !== 'minimal') {
    const servicesText = (() => {
      if (promoServiceIds.length === 0 || promoServiceIds.length >= data.services.length) {
        return 'Todos os serviços';
      }
      if (promoSvcs.length === 1) {
        return promoSvcs[0].name;
      }
      return promoSvcs.length > 3 
        ? `${promoSvcs.slice(0, 3).map(s => s.name).join(', ')}...`
        : promoSvcs.map(s => s.name).join(', ');
    })();

    topOffset += 40;
    ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
    const svcLabel = 'SERVIÇOS INCLUSOS';
    const svcTextWidth = Math.max(ctx.measureText(servicesText).width, ctx.measureText(svcLabel).width) + 80;
    const svcHeight = 130;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    roundRect(ctx, (canvas.width - svcTextWidth) / 2, topOffset, svcTextWidth, svcHeight, 25);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
    ctx.fillText(svcLabel, canvas.width / 2, topOffset + 40);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 38px system-ui, -apple-system, sans-serif';
    ctx.fillText(servicesText, canvas.width / 2, topOffset + 85);
    topOffset += svcHeight + 60;
  } else {
    topOffset += 40;
  }

  // 6. Prices
  const hasValidPrice = data.promotion_price && Number(data.promotion_price) > 0;
  const hasOriginalPrice = data.original_price && Number(data.original_price) > 0;

  if (hasValidPrice) {
    const priceGroupY = topOffset;
    if (hasOriginalPrice) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '38px system-ui, -apple-system, sans-serif';
      const origText = `R$ ${Number(data.original_price).toFixed(2)}`;
      const origMetrics = ctx.measureText(origText);
      
      // DE R$ XX,XX
      ctx.fillText(origText, canvas.width / 2 - 150, priceGroupY + 60);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2 - 150 - origMetrics.width / 2 - 5, priceGroupY + 45);
      ctx.lineTo(canvas.width / 2 - 150 + origMetrics.width / 2 + 5, priceGroupY + 45);
      ctx.stroke();
      
      ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
      ctx.fillText('DE', canvas.width / 2 - 150, priceGroupY + 100);

      // PROMO PRICE
      ctx.fillStyle = primaryColor;
      ctx.font = '900 150px system-ui, -apple-system, sans-serif';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 30;
      ctx.fillText(`R$ ${Number(data.promotion_price).toFixed(2)}`, canvas.width / 2 + 150, priceGroupY + 60);
      ctx.shadowBlur = 0;
      
      ctx.font = '900 40px system-ui, -apple-system, sans-serif';
      ctx.fillText('POR APENAS', canvas.width / 2 + 150, priceGroupY + 120);
      topOffset += 200;
    } else {
      ctx.fillStyle = primaryColor;
      ctx.font = '900 150px system-ui, -apple-system, sans-serif';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 30;
      ctx.fillText(`R$ ${Number(data.promotion_price).toFixed(2)}`, canvas.width / 2, priceGroupY + 60);
      ctx.shadowBlur = 0;
      
      ctx.font = '900 40px system-ui, -apple-system, sans-serif';
      ctx.fillText('POR APENAS', canvas.width / 2, priceGroupY + 120);
      topOffset += 200;
    }
  }

  // 7. Slots (Non-minimal)
  if (data.availableSlots && data.availableSlots.length > 0 && layout !== 'minimal') {
    topOffset += 20;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
    ctx.fillText('Horários disponíveis:', canvas.width / 2, topOffset);
    
    topOffset += 50;
    const slotList = data.availableSlots.slice(0, 6);
    const slotW = 180;
    const slotH = 70;
    const gapX = 20;
    const gapY = 20;
    
    const totalSlots = slotList.length;
    const rows = totalSlots > 3 ? 2 : 1;
    
    slotList.forEach((slot, i) => {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const numInRow = row === 0 ? Math.min(totalSlots, 3) : totalSlots - 3;
      const rowW = (numInRow * slotW) + ((numInRow - 1) * gapX);
      const startX = (canvas.width - rowW) / 2;
      
      const x = startX + col * (slotW + gapX);
      const y = topOffset + row * (slotH + gapY);
      
      ctx.fillStyle = primaryColor + '33';
      roundRect(ctx, x, y, slotW, slotH, 15);
      ctx.fill();
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 32px system-ui, -apple-system, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(slot, x + slotW / 2, y + slotH / 2);
    });
    topOffset += (rows * (slotH + gapY)) + 40;
  }

  // 8. Expiration
  ctx.textBaseline = 'top';
  const expDate = format(parseISO(data.end_date), 'dd/MM/yyyy');
  const expText = `Válido até ${expDate}`;
  ctx.font = '32px system-ui, -apple-system, sans-serif';
  const expWidth = ctx.measureText(expText).width + 100;
  const expHeight = 85;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  roundRect(ctx, (canvas.width - expWidth) / 2, topOffset, expWidth, expHeight, 42);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.stroke();
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillText(expText, canvas.width / 2, topOffset + 42);

  // 9. Footer CTA
  const footerY = canvas.height - 300;
  const ctaText = 'RESERVE SEU HORÁRIO';
  ctx.font = '900 48px system-ui, -apple-system, sans-serif';
  const ctaWidth = ctx.measureText(ctaText).width + 160;
  const ctaHeight = 110;
  
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 40;
  roundRect(ctx, (canvas.width - ctaWidth) / 2, footerY, ctaWidth, ctaHeight, 55);
  ctx.fill();
  ctx.shadowBlur = 0;
  
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'middle';
  ctx.fillText(ctaText, canvas.width / 2, footerY + ctaHeight / 2);

  if (layout === 'photo') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '800 36px system-ui, -apple-system, sans-serif';
    ctx.fillText(data.companyName.toUpperCase(), canvas.width / 2, footerY + ctaHeight + 60);
  }

  return canvas.toDataURL('image/png');
}
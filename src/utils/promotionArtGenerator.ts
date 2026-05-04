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

  console.log('Generating promotion art...', { title: data.title, bg: !!data.backgroundImageUrl });

  // 1. Draw Background
  if (data.backgroundImageUrl) {
    try {
      const bgImg = await loadImage(data.backgroundImageUrl);
      // Object fit cover logic
      const scale = Math.max(canvas.width / bgImg.width, canvas.height / bgImg.height);
      const x = (canvas.width / 2) - (bgImg.width / 2) * scale;
      const y = (canvas.height / 2) - (bgImg.height / 2) * scale;
      ctx.drawImage(bgImg, x, y, bgImg.width * scale, bgImg.height * scale);
      
      // Overlay gradient
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } catch (err) {
      console.warn('Failed to load background image, using default gradient', err);
      drawDefaultGradient(ctx, canvas);
    }
  } else {
    drawDefaultGradient(ctx, canvas);
  }

  function drawDefaultGradient(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#1a1a1a');
    grad.addColorStop(1, '#000000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative circles
    ctx.fillStyle = 'rgba(234, 179, 8, 0.1)';
    ctx.beginPath();
    ctx.arc(canvas.width, 0, 500, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(234, 179, 8, 0.08)';
    ctx.beginPath();
    ctx.arc(0, canvas.height, 600, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Draw Logo
  let topOffset = 150;
  if (data.companyLogo) {
    try {
      const logoImg = await loadImage(data.companyLogo);
      const logoSize = 200;
      const logoX = (canvas.width - logoSize) / 2;
      
      // White background for logo
      ctx.fillStyle = '#FFFFFF';
      roundRect(ctx, logoX - 10, topOffset - 10, logoSize + 20, logoSize + 20, 20);
      ctx.fill();
      
      ctx.drawImage(logoImg, logoX, topOffset, logoSize, logoSize);
      topOffset += logoSize + 60;
    } catch (err) {
      console.warn('Failed to load logo', err);
      drawLogoPlaceholder(data.companyName);
      topOffset += 180;
    }
  } else {
    drawLogoPlaceholder(data.companyName);
    topOffset += 180;
  }

  function drawLogoPlaceholder(name: string) {
    const size = 150;
    const x = (canvas.width - size) / 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, topOffset + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 60px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.charAt(0).toUpperCase(), canvas.width / 2, topOffset + size / 2);
  }

  // 3. Professionals Text
  const profNames = data.professional_ids?.map(pid => {
    const p = data.professionals.find((pr: any) => pr.profile_id === pid);
    return p?.profiles?.full_name || '';
  }).filter(Boolean) || [];
  const professionalsText = profNames.length > 0 ? profNames.join(' & ') : data.companyName;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = '500 48px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 10;
  ctx.fillText(professionalsText, canvas.width / 2, topOffset);
  ctx.shadowBlur = 0;

  // 4. Discount Badge
  topOffset += 150;
  const discountLabel = (() => {
    if (data.discount_type === 'percentage') return `${data.discount_value}% OFF`;
    if (data.discount_type === 'fixed_amount') return `R$ ${data.discount_value} OFF`;
    return 'PREÇO ESPECIAL';
  })();

  ctx.font = '900 48px system-ui, -apple-system, sans-serif';
  const labelWidth = ctx.measureText(discountLabel).width + 100;
  const labelHeight = 80;
  ctx.fillStyle = '#eab308';
  roundRect(ctx, (canvas.width - labelWidth) / 2, topOffset - labelHeight / 2 - 10, labelWidth, labelHeight, 40);
  ctx.fill();
  
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(discountLabel, canvas.width / 2, topOffset + 2);

  // 5. Title
  topOffset += 180;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 130px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 20;
  topOffset = wrapText(ctx, data.title.toUpperCase(), canvas.width / 2, topOffset, 950, 130);
  ctx.shadowBlur = 0;

  // 6. Services
  const promoSvcs = data.services.filter(s => data.service_ids.includes(s.id));
  const servicesText = (() => {
    if (data.service_ids.length === 0 || data.service_ids.length >= data.services.length) {
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
  ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
  const svcLabel = 'SERVIÇOS';
  const svcTextWidth = Math.max(ctx.measureText(servicesText).width, ctx.measureText(svcLabel).width) + 100;
  const svcHeight = 140;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  roundRect(ctx, (canvas.width - svcTextWidth) / 2, topOffset, svcTextWidth, svcHeight, 30);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
  ctx.fillText(svcLabel, canvas.width / 2, topOffset + 45);
  
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 42px system-ui, -apple-system, sans-serif';
  ctx.fillText(servicesText, canvas.width / 2, topOffset + 95);

  // 7. Prices
  topOffset += svcHeight + 80;
  if (data.original_price) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '42px system-ui, -apple-system, sans-serif';
    const origText = `R$ ${Number(data.original_price).toFixed(2)}`;
    ctx.fillText(origText, canvas.width / 2, topOffset);
    
    // Strikethrough
    const metrics = ctx.measureText(origText);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - metrics.width / 2 - 10, topOffset - 15);
    ctx.lineTo(canvas.width / 2 + metrics.width / 2 + 10, topOffset - 15);
    ctx.stroke();
    
    topOffset += 60;
    ctx.font = '32px system-ui, -apple-system, sans-serif';
    ctx.fillText('De', canvas.width / 2, topOffset);
    topOffset += 80;
  }

  ctx.fillStyle = '#eab308';
  ctx.font = '900 160px system-ui, -apple-system, sans-serif';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 20;
  ctx.fillText(`R$ ${Number(data.promotion_price).toFixed(2)}`, canvas.width / 2, topOffset);
  ctx.shadowBlur = 0;
  
  topOffset += 110;
  ctx.font = 'bold 42px system-ui, -apple-system, sans-serif';
  ctx.fillText('POR APENAS', canvas.width / 2, topOffset);

  // 8. Slots
  if (data.availableSlots && data.availableSlots.length > 0) {
    topOffset += 100;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    ctx.fillText('Horários disponíveis:', canvas.width / 2, topOffset);
    
    topOffset += 60;
    const slotList = data.availableSlots.slice(0, 6);
    const slotXGap = 30;
    const slotYGap = 20;
    const slotW = 180;
    const slotH = 70;
    
    const rows = slotList.length > 3 ? 2 : 1;
    const startY = topOffset;
    
    slotList.forEach((slot, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const totalInRow = row === 0 ? Math.min(slotList.length, 3) : slotList.length - 3;
      const rowWidth = (totalInRow * slotW) + ((totalInRow - 1) * slotXGap);
      const startX = (canvas.width - rowWidth) / 2;
      
      const x = startX + col * (slotW + slotXGap);
      const y = startY + row * (slotH + slotYGap);
      
      ctx.fillStyle = 'rgba(234, 179, 8, 0.2)';
      roundRect(ctx, x, y, slotW, slotH, 15);
      ctx.fill();
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(slot, x + slotW / 2, y + slotH / 2);
    });
    
    if (data.availableSlots.length > 6) {
      topOffset += (rows * (slotH + slotYGap)) + 20;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
      ctx.fillText(`+ ${data.availableSlots.length - 6} horários`, canvas.width / 2, topOffset);
    } else {
      topOffset += rows * (slotH + slotYGap);
    }
  }

  // 9. Expiration
  topOffset += 80;
  ctx.textBaseline = 'top';
  const expDate = format(parseISO(data.end_date), 'dd/MM/yyyy');
  const expText = `Válido até ${expDate}`;
  ctx.font = '36px system-ui, -apple-system, sans-serif';
  const expWidth = ctx.measureText(expText).width + 80;
  const expHeight = 80;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  roundRect(ctx, (canvas.width - expWidth) / 2, topOffset, expWidth, expHeight, 40);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.stroke();
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillText(expText, canvas.width / 2, topOffset + 40);

  // 10. Footer CTA
  const footerY = canvas.height - 250;
  const ctaText = 'AGENDE PELO PERFIL';
  ctx.font = '900 48px system-ui, -apple-system, sans-serif';
  const ctaWidth = ctx.measureText(ctaText).width + 120;
  const ctaHeight = 100;
  
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, (canvas.width - ctaWidth) / 2, footerY, ctaWidth, ctaHeight, 50);
  ctx.fill();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 40;
  
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'middle';
  ctx.fillText(ctaText, canvas.width / 2, footerY + ctaHeight / 2);
  ctx.shadowBlur = 0;
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = 'bold 40px system-ui, -apple-system, sans-serif';
  const urlText = data.publicProfileUrl.replace(/^https?:\/\//, '');
  ctx.fillText(urlText, canvas.width / 2, footerY + ctaHeight + 60);

  const finalUrl = canvas.toDataURL('image/png');
  console.log('Art generated successfully, dataUrl length:', finalUrl.length);
  return finalUrl;
}

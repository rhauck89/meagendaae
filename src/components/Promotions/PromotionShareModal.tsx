import React, { useState, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Promotion } from '@/pages/Promotions';
import { Instagram, MessageCircle, Copy, Download, Loader2, Check } from 'lucide-react';
import { toPng } from 'html-to-image';
import { PromotionInstagramArt } from './PromotionInstagramArt';
import { toast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';

interface PromotionShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotion: Promotion | null;
  companyName: string;
  companyLogo?: string | null;
  companySlug: string;
  businessType: string;
  services: any[];
  professionals: any[];
  availableSlots?: string[];
}

export function PromotionShareModal({
  open,
  onOpenChange,
  promotion,
  companyName,
  companyLogo,
  companySlug,
  businessType,
  services,
  professionals,
  availableSlots
}: PromotionShareModalProps) {
  const [activeTab, setActiveTab] = useState<'options' | 'instagram' | 'whatsapp'>('options');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const artRef = useRef<HTMLDivElement>(null);

  const routeType = businessType === 'esthetic' ? 'estetica' : 'barbearia';
  
  const publicProfileUrl = useMemo(() => {
    if (!promotion) return '';
    const baseUrl = `${window.location.origin}/${routeType}/${companySlug}`;
    
    // If only one professional is associated, link to their profile
    if (promotion.professional_ids?.length === 1) {
      const prof = professionals.find(p => p.profile_id === promotion.professional_ids![0]);
      if (prof?.slug) {
        return `${baseUrl}/${prof.slug}`;
      }
    }
    
    return baseUrl;
  }, [promotion, routeType, companySlug, professionals]);

  const whatsappMessage = useMemo(() => {
    if (!promotion) return '';

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

    const discountLabel = promotion.discount_type === 'percentage' 
      ? `${promotion.discount_value}% OFF` 
      : `R$ ${promotion.discount_value} de desconto`;

    return `🔥 Promoção especial na ${companyName}!

*${promotion.title}*
${discountLabel} em serviços selecionados

📅 Válida de ${format(parseISO(promotion.start_date), 'dd/MM/yyyy')} até ${format(parseISO(promotion.end_date), 'dd/MM/yyyy')}
✂️ Serviços: ${servicesText}
💰 ${promotion.original_price ? `De R$ ${Number(promotion.original_price).toFixed(2)} por ` : ''}*R$ ${Number(promotion.promotion_price).toFixed(2)}*

Agende pelo perfil:
${publicProfileUrl}`;
  }, [promotion, companyName, publicProfileUrl, services]);

  const handleGenerateArt = async () => {
    if (!artRef.current) return;
    setGenerating(true);
    try {
      // Use toPng to generate the image
      const dataUrl = await toPng(artRef.current, {
        width: 1080,
        height: 1920,
        cacheBust: true,
      });
      
      const link = document.createElement('a');
      link.download = `promocao-${promotion?.title || 'art'}.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: 'Arte gerada com sucesso!' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao gerar arte', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(whatsappMessage);
    setCopied(true);
    toast({ title: 'Texto copiado!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, '_blank');
  };

  if (!promotion) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Divulgar Promoção</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4 pt-4">
          {activeTab === 'options' && (
            <div className="grid grid-cols-1 gap-3">
              <Button 
                variant="outline" 
                className="h-20 justify-start gap-4 px-6 border-2 hover:border-primary hover:bg-primary/5"
                onClick={() => setActiveTab('instagram')}
              >
                <div className="bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 p-2 rounded-lg text-white">
                  <Instagram className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <p className="font-bold">Gerar arte Instagram</p>
                  <p className="text-xs text-muted-foreground">Imagem 1080x1920 para Stories</p>
                </div>
              </Button>

              <Button 
                variant="outline" 
                className="h-20 justify-start gap-4 px-6 border-2 hover:border-emerald-500 hover:bg-emerald-50"
                onClick={() => setActiveTab('whatsapp')}
              >
                <div className="bg-emerald-500 p-2 rounded-lg text-white">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <p className="font-bold">Mensagem WhatsApp</p>
                  <p className="text-xs text-muted-foreground">Texto pronto para enviar ou copiar</p>
                </div>
              </Button>

              <Button 
                variant="outline" 
                className="h-20 justify-start gap-4 px-6 border-2 hover:border-primary hover:bg-primary/5"
                onClick={handleCopyText}
              >
                <div className="bg-primary p-2 rounded-lg text-white">
                  <Copy className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <p className="font-bold">Copiar apenas texto</p>
                  <p className="text-xs text-muted-foreground">Copia o resumo para a área de transferência</p>
                </div>
              </Button>
            </div>
          )}

          {activeTab === 'instagram' && (
            <div className="space-y-4">
              <div className="aspect-[9/16] w-full max-w-[200px] mx-auto bg-muted rounded-lg border-2 border-dashed flex items-center justify-center text-center p-4">
                <div>
                  <Instagram className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">A arte será gerada com as informações da promoção.</p>
                </div>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Dica: A imagem terá alta resolução (1080x1920) ideal para Stories.
              </p>
              
              {/* Hidden art component for capture */}
              <PromotionInstagramArt 
                ref={artRef}
                promotion={promotion}
                companyName={companyName}
                companyLogo={companyLogo}
                services={services}
                professionals={professionals}
                publicProfileUrl={publicProfileUrl}
              />

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setActiveTab('options')}>Voltar</Button>
                <Button className="flex-1 gap-2" onClick={handleGenerateArt} disabled={generating}>
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Baixar Imagem
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'whatsapp' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Prévia da mensagem:</p>
                <Textarea 
                  value={whatsappMessage} 
                  readOnly 
                  rows={10} 
                  className="text-sm bg-muted resize-none focus-visible:ring-0"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setActiveTab('options')}>Voltar</Button>
                <Button variant="outline" className="flex-1 gap-2" onClick={handleCopyText}>
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  Copiar
                </Button>
                <Button className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSendWhatsApp}>
                  <MessageCircle className="h-4 w-4" />
                  Enviar
                </Button>
              </div>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Promotion } from '@/pages/Promotions';
import { Instagram, MessageCircle, Copy, Download, Loader2, Check, Camera, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { generatePromotionArt } from '@/utils/promotionArtGenerator';
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
  primaryColor?: string;
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
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const routeType = businessType === 'esthetic' ? 'estetica' : 'barbearia';
  
  const publicProfileUrl = useMemo(() => {
    if (!promotion) return '';
    const baseUrl = `${window.location.origin}/${routeType}/${companySlug}`;
    
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

    const slotsText = availableSlots && availableSlots.length > 0
      ? `\n📅 Horários disponíveis: ${availableSlots.join(', ')}`
      : '';

    return `🔥 Promoção especial na ${companyName}!

*${promotion.title}*
${discountLabel} em serviços selecionados
${slotsText}
📅 Válida até ${format(parseISO(promotion.end_date), 'dd/MM/yyyy')}
✂️ Serviços: ${servicesText}
💰 ${promotion.original_price ? `De R$ ${Number(promotion.original_price).toFixed(2)} por ` : ''}*R$ ${Number(promotion.promotion_price).toFixed(2)}*

Agende pelo perfil:
${publicProfileUrl}`;
  }, [promotion, companyName, publicProfileUrl, services, availableSlots]);

  // Generate preview whenever promotion or background changes
  useEffect(() => {
    if (activeTab === 'instagram' && promotion) {
      generatePreview();
    }
  }, [activeTab, promotion, backgroundImage]);

  const generatePreview = async () => {
    if (!promotion) return;
    setIsGeneratingPreview(true);
    setPreviewUrl(null);
    
    try {
      console.log('Starting preview generation...', { backgroundImage: !!backgroundImage });
      const dataUrl = await generatePromotionArt({
        title: promotion.title,
        discount_type: promotion.discount_type || '',
        discount_value: promotion.discount_value || 0,
        original_price: promotion.original_price ? Number(promotion.original_price) : null,
        promotion_price: Number(promotion.promotion_price),
        end_date: promotion.end_date,
        service_ids: promotion.service_ids || (promotion.service_id ? [promotion.service_id] : []),
        professional_ids: promotion.professional_ids,
        services,
        professionals,
        companyName,
        companyLogo,
        publicProfileUrl,
        availableSlots,
        backgroundImageUrl: backgroundImage
      });

      if (!dataUrl || !dataUrl.startsWith('data:image/png;base64,')) {
        throw new Error('DataURL inválido gerado');
      }

      setPreviewUrl(dataUrl);
    } catch (err) {
      console.error('Error generating preview:', err);
      toast({ title: 'Erro ao gerar prévia', variant: 'destructive' });
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleGenerateArt = async () => {
    if (!previewUrl) return;
    setGenerating(true);
    try {
      const link = document.createElement('a');
      link.download = `promocao-${promotion?.title || 'art'}.png`;
      link.href = previewUrl;
      link.click();
      toast({ title: 'Arte baixada com sucesso!' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao baixar arte', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setBackgroundImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-4 border-b flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            {activeTab !== 'options' && (
              <Button variant="ghost" size="icon" onClick={() => setActiveTab('options')} className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle className="text-lg">Divulgar Promoção</DialogTitle>
          </div>
        </DialogHeader>

        <DialogBody className="flex-1 overflow-y-auto p-4 space-y-4">
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
                  <p className="font-bold text-base">Arte Instagram (Stories)</p>
                  <p className="text-xs text-muted-foreground">Imagem 1080x1920 com sua foto ou arte auto</p>
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
                  <p className="font-bold text-base">Mensagem WhatsApp</p>
                  <p className="text-xs text-muted-foreground">Texto formatado para converter agendamentos</p>
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
                  <p className="font-bold text-base">Copiar texto simples</p>
                  <p className="text-xs text-muted-foreground">Apenas o conteúdo para colar onde quiser</p>
                </div>
              </Button>
            </div>
          )}

          {activeTab === 'instagram' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-4">
                <div className="relative aspect-[9/16] w-full max-w-[240px] bg-muted rounded-xl border-2 overflow-hidden shadow-xl mx-auto">
                  {isGeneratingPreview && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-20 backdrop-blur-sm">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                      <p className="text-xs font-medium">Gerando arte...</p>
                    </div>
                  )}
                  
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                      <Instagram className="h-10 w-10 text-muted-foreground mb-3 opacity-20" />
                      <p className="text-xs text-muted-foreground">Aguarde a geração do preview...</p>
                    </div>
                  )}

                  {/* Capture logic moved to canvas utility */}
                </div>

                <div className="grid grid-cols-2 gap-2 w-full">
                  <Button 
                    variant={!backgroundImage ? "default" : "outline"} 
                    className="gap-2"
                    onClick={() => setBackgroundImage(null)}
                  >
                    <ImageIcon className="h-4 w-4" />
                    Automática
                  </Button>
                  <Button 
                    variant={backgroundImage ? "default" : "outline"} 
                    className="gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4" />
                    {backgroundImage ? "Trocar Foto" : "Usar Foto"}
                  </Button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    capture="environment"
                    onChange={handlePhotoUpload}
                  />
                </div>
              </div>

              <div className="pt-2 border-t flex gap-2">
                <Button 
                  className="flex-1 gap-2 h-12 text-base font-bold" 
                  onClick={handleGenerateArt} 
                  disabled={generating || !previewUrl || isGeneratingPreview}
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Gerando Arquivo...
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5" />
                      Baixar Imagem (Stories)
                    </>
                  )}
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
                  className="text-sm bg-muted resize-none focus-visible:ring-0 leading-relaxed"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2" onClick={handleCopyText}>
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  Copiar
                </Button>
                <Button className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSendWhatsApp}>
                  <MessageCircle className="h-4 w-4" />
                  Enviar WhatsApp
                </Button>
              </div>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export type CropMode = 'avatar' | 'cover';

interface ImageCropDialogProps {
  open: boolean;
  imageSrc: string;
  mode: CropMode;
  onClose: () => void;
  onConfirm: (croppedBlob: Blob) => void;
}

const MAX_BLOB_SIZE = 10 * 1024 * 1024; // 10MB

const CONFIG: Record<CropMode, { aspect: number; outputW: number; outputH: number; shape: 'round' | 'rect'; title: string; description: string }> = {
  avatar: { aspect: 1, outputW: 512, outputH: 512, shape: 'round', title: 'Ajustar foto de perfil', description: 'Ajuste sua foto e clique em "Confirmar foto" para salvar.' },
  cover:  { aspect: 3, outputW: 1200, outputH: 400, shape: 'rect', title: 'Ajustar foto de capa', description: 'Posicione a imagem na área desejada e confirme.' },
};

function createCroppedImage(imageSrc: string, pixelCrop: Area, w: number, h: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context failed'));
      ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Blob creation failed'))),
        'image/jpeg',
        0.9,
      );
    };
    image.onerror = reject;
    image.src = imageSrc;
  });
}

const ImageCropDialog = ({ open, imageSrc, mode, onClose, onConfirm }: ImageCropDialogProps) => {
  const cfg = CONFIG[mode];
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedArea) return;
    setProcessing(true);
    try {
      const blob = await createCroppedImage(imageSrc, croppedArea, cfg.outputW, cfg.outputH);
      if (blob.size > MAX_BLOB_SIZE) {
        toast.error('Imagem resultante muito grande. Tente aproximar mais o corte.');
        return;
      }
      onConfirm(blob);
    } catch {
      toast.error('Erro ao processar imagem. Tente novamente.');
    } finally {
      setProcessing(false);
    }
  };

  const aspectClass = mode === 'cover' ? 'aspect-[3/1]' : 'aspect-square';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !processing && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden z-[60]">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>{cfg.title}</DialogTitle>
          <DialogDescription className="text-xs">{cfg.description}</DialogDescription>
        </DialogHeader>

        <div className={`relative w-full ${aspectClass} bg-black`}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={cfg.aspect}
            cropShape={cfg.shape}
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />

          {mode === 'cover' && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
              <div
                className="border-2 border-dashed border-white/40 rounded-md"
                style={{ width: '60%', height: '70%' }}
              />
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/60 bg-black/40 px-2 py-0.5 rounded">
                Área segura
              </span>
            </div>
          )}
        </div>

        <div className="px-6 py-3 flex items-center gap-3">
          <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.05}
            onValueChange={([v]) => setZoom(v)}
            className="flex-1"
          />
          <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>

        <DialogFooter className="p-4 pt-2 gap-2 relative z-20">
          <Button variant="outline" onClick={onClose} disabled={processing}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={processing}>
            {processing ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Salvando imagem...</>
            ) : (
              <><Check className="h-4 w-4 mr-1" /> Confirmar foto</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImageCropDialog;

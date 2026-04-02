import { useState, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, Check, X } from 'lucide-react';

export type CropMode = 'avatar' | 'cover';

interface ImageCropDialogProps {
  open: boolean;
  imageSrc: string;
  mode: CropMode;
  onClose: () => void;
  onConfirm: (croppedBlob: Blob) => void;
}

const CONFIG: Record<CropMode, { aspect: number; outputW: number; outputH: number; shape: 'round' | 'rect'; title: string }> = {
  avatar: { aspect: 1, outputW: 512, outputH: 512, shape: 'round', title: 'Ajustar foto de perfil' },
  cover:  { aspect: 3, outputW: 1200, outputH: 400, shape: 'rect', title: 'Ajustar foto de capa' },
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
      onConfirm(blob);
    } catch {
      // handled by parent
    } finally {
      setProcessing(false);
    }
  };

  const aspectClass = mode === 'cover' ? 'aspect-[3/1]' : 'aspect-square';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>{cfg.title}</DialogTitle>
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

          {/* Safe zone guide for cover */}
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

        <DialogFooter className="p-4 pt-2 gap-2">
          <Button variant="outline" onClick={onClose} disabled={processing}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={processing}>
            <Check className="h-4 w-4 mr-1" /> {processing ? 'Processando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImageCropDialog;

import { useState, useCallback, useEffect } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AvatarCropDialogProps {
  open: boolean;
  imageSrc: string;
  onClose: () => void;
  onConfirm: (croppedBlob: Blob) => void;
}

const OUTPUT_SIZE = 512;
const MAX_BLOB_SIZE = 10 * 1024 * 1024;

function createCroppedImage(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context failed'));

      ctx.drawImage(
        image,
        pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
        0, 0, OUTPUT_SIZE, OUTPUT_SIZE,
      );

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

const AvatarCropDialog = ({ open, imageSrc, onClose, onConfirm }: AvatarCropDialogProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    if (open && imageSrc) {
      setImageLoading(true);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    }
  }, [open, imageSrc]);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedArea) return;
    setProcessing(true);
    try {
      const blob = await createCroppedImage(imageSrc, croppedArea);
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

  const isBusy = imageLoading || processing;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isBusy && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden z-[60]">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>Ajustar foto</DialogTitle>
          <DialogDescription className="text-xs">
            Ajuste sua foto e clique em "Confirmar foto" para salvar.
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full aspect-square bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            onMediaLoaded={() => setImageLoading(false)}
          />
          <div
            className={cn(
              'absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm transition-opacity duration-300',
              isBusy ? 'opacity-100' : 'opacity-0 pointer-events-none',
            )}
            aria-hidden={!isBusy}
            aria-live="polite"
          >
            <Loader2 className="h-8 w-8 text-white animate-spin" />
            <p className="text-sm font-medium text-white">
              {processing ? 'Salvando sua foto...' : 'Preparando sua foto...'}
            </p>
            <div className="w-32 h-1 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full w-1/2 bg-white/80 rounded-full animate-pulse" />
            </div>
          </div>
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

export default AvatarCropDialog;

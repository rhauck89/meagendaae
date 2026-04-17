import { useState, useCallback, useEffect } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ModalLoadingOverlay } from '@/components/ui/modal-loading-overlay';
import { ZoomIn, ZoomOut, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
      setCroppedArea(null);
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
      <DialogContent className="p-0">
        <DialogHeader>
          <DialogTitle>Ajustar foto</DialogTitle>
          <DialogDescription className="text-xs">
            Ajuste sua foto e clique em "Confirmar foto" para salvar.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="p-0">
          <div
            className="relative w-full bg-black"
            style={{ height: 'min(60vh, 400px)' }}
          >
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
          </div>

          <div className="px-6 py-3 flex items-center gap-3">
            <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.05}
              onValueChange={([v]) => setZoom(v)}
              disabled={isBusy}
              className="flex-1"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isBusy}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isBusy || !croppedArea}>
            {processing ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Salvando...</>
            ) : imageLoading ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Preparando...</>
            ) : (
              <><Check className="h-4 w-4 mr-1" /> Confirmar foto</>
            )}
          </Button>
        </DialogFooter>

        <ModalLoadingOverlay
          visible={isBusy}
          message={processing ? 'Salvando sua foto...' : 'Preparando sua foto...'}
        />
      </DialogContent>
    </Dialog>
  );
};

export default AvatarCropDialog;

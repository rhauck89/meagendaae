import React, { useState } from 'react';
import { Star, MessageCircle, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ReviewFormProps {
  onCancel: () => void;
  onSubmit: (rating: number, comment: string) => Promise<void>;
  theme: any;
  title: string;
}

export function ReviewForm({ onCancel, onSubmit, theme: T, title }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleRate = (r: number) => setRating(r);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Por favor, selecione uma nota.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(rating, comment);
    } catch (err) {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-bold" style={{ color: T.text }}>{title}</h3>
        <p className="text-sm opacity-60" style={{ color: T.textSec }}>Sua opinião ajuda outros clientes e o estabelecimento.</p>
      </div>

      <div className="flex justify-center gap-2 py-4">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            onClick={() => handleRate(s)}
            className="transition-transform hover:scale-110 active:scale-95"
          >
            <Star
              className={cn("w-10 h-10 transition-colors", s <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-600")}
            />
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium opacity-70" style={{ color: T.textSec }}>
          Seu comentário (opcional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Conte como foi sua experiência..."
          className="w-full min-h-[120px] p-4 rounded-2xl border resize-none focus:ring-2 outline-none transition-all"
          style={{ background: T.bg, borderColor: T.border, color: T.text }}
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1 h-12 rounded-xl"
          style={{ borderColor: T.border, color: T.text, background: 'transparent' }}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="flex-1 h-12 rounded-xl font-bold"
          style={{ background: T.accent, color: '#000' }}
        >
          {submitting ? "Enviando..." : "Enviar Avaliação"}
        </Button>
      </div>
    </div>
  );
}

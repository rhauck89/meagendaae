import React, { useState } from 'react';
import { Star, Send, X, StarHalf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface ReviewFormProps {
  onCancel: () => void;
  onSubmit: (rating: number, comment: string) => Promise<void>;
  theme: any;
  title: string;
  subtitle?: string;
  image?: string;
}

export function ReviewForm({ onCancel, onSubmit, theme: T, title, subtitle, image }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const tags = ["Atendimento", "Ambiente", "Serviço", "Pontualidade"];

  const handleRate = (r: number) => setRating(r);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Por favor, selecione uma nota.");
      return;
    }
    setSubmitting(true);
    
    // Combine tags with comment if tags are selected
    const finalComment = selectedTags.length > 0 
      ? `[${selectedTags.join(', ')}] ${comment}`.trim()
      : comment.trim();

    try {
      await onSubmit(rating, finalComment);
    } catch (err) {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative w-full max-w-md mx-auto overflow-hidden">
      {/* Header with Background Pattern/Gradient */}
      <div 
        className="absolute top-0 left-0 w-full h-32 opacity-20"
        style={{ 
          background: `linear-gradient(135deg, ${T.accent} 0%, transparent 100%)`,
        }}
      />

      <div className="relative pt-8 pb-6 px-6 sm:px-8 space-y-6">
        {/* Close Button */}
        <button 
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 rounded-full transition-colors hover:bg-white/10"
          style={{ color: T.text }}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Profile/Logo Section */}
        <div className="flex flex-col items-center text-center space-y-3">
          {image ? (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative"
            >
              <img 
                src={image} 
                alt={title} 
              className="w-20 h-20 rounded-2xl object-cover shadow-2xl ring-4"
              style={{ outline: `4px solid ${T.accent}33`, outlineOffset: '-4px' }}
            />
              <div 
                className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg"
                style={{ background: T.accent }}
              >
                <Star className="w-4 h-4 text-black fill-black" />
              </div>
            </motion.div>
          ) : (
            <div 
              className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl ring-4"
              style={{ background: `${T.accent}15`, outline: `4px solid ${T.accent}33`, outlineOffset: '-4px', color: T.accent }}
            >
              <Star className="w-10 h-10 fill-current" />
            </div>
          )}
          
          <div className="space-y-1">
            <h3 className="text-2xl font-bold tracking-tight" style={{ color: T.text }}>{title}</h3>
            <p className="text-sm font-medium opacity-70" style={{ color: T.textSec }}>
              {subtitle || "Sua opinião ajuda outros clientes a escolherem o melhor!"}
            </p>
          </div>
        </div>

        {/* Star Rating Section */}
        <div className="flex flex-col items-center space-y-2 py-2">
          <div className="flex justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((s) => {
              const isActive = s <= (hoverRating || rating);
              const currentRating = hoverRating || rating;
              
              // Progressive glow values
              const intensities = [0, 0.3, 0.45, 0.6, 0.8, 1.0];
              const sizes = [0, 8, 12, 16, 20, 28];
              
              return (
                <motion.button
                  key={s}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onMouseEnter={() => setHoverRating(s)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => handleRate(s)}
                  className="relative group p-1"
                >
                  <Star
                    className="w-10 h-10 transition-all duration-300"
                    style={{ 
                      color: isActive ? '#FACC15' : `${T.text}20`,
                      fill: isActive ? '#FACC15' : 'transparent',
                      filter: isActive
                        ? `drop-shadow(0 0 ${sizes[currentRating]}px rgba(250, 204, 21, ${intensities[currentRating]}))`
                        : 'none'
                    }}
                  />
                </motion.button>
              );
            })}
          </div>
          <AnimatePresence mode="wait">
            {(hoverRating || rating) > 0 && (
              <motion.span
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: '#FACC15' }}
              >
                {["Muito Ruim", "Poderia Melhorar", "Bom", "Muito Bom", "Excelente!"][(hoverRating || rating) - 1]}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Tags Section */}
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-50 px-1" style={{ color: T.textSec }}>
            Destaques positivos
          </p>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-semibold transition-all border",
                  selectedTags.includes(tag) 
                    ? "shadow-lg scale-105" 
                    : "opacity-60 hover:opacity-100"
                )}
                style={{ 
                  background: selectedTags.includes(tag) ? T.accent : 'transparent',
                  borderColor: selectedTags.includes(tag) ? T.accent : `${T.text}20`,
                  color: selectedTags.includes(tag) ? '#000' : T.text
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Comment Section */}
        <div className="space-y-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Conte um pouco sobre sua experiência (opcional)..."
            className="w-full min-h-[120px] p-4 rounded-2xl border text-sm resize-none outline-none transition-all shadow-inner custom-textarea"
            style={{ 
              background: T.card, 
              borderColor: `${T.border}80`, 
              color: T.text,
            } as any}
          />
          <style>
            {`
              .custom-textarea::placeholder {
                color: ${T.textSec}99 !important;
                opacity: 0.7;
              }
              .custom-textarea:focus {
                border-color: ${T.accent} !important;
                box-shadow: 0 0 0 4px ${T.accent}33 !important;
              }
            `}
          </style>
        </div>

        {/* Actions Section */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="ghost"
            onClick={onCancel}
            className="flex-1 h-14 rounded-2xl font-bold transition-all hover:bg-white/5"
            style={{ color: T.textSec }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="flex-1 h-14 rounded-2xl font-bold shadow-xl shadow-accent/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ 
              background: rating > 0 ? T.accent : `${T.text}10`, 
              color: rating > 0 ? '#000' : `${T.text}40` 
            }}
          >
            {submitting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                <span>Enviando...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                <span>Enviar avaliação</span>
              </div>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

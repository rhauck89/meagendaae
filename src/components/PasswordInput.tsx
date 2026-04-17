import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Check, X, Sparkles, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  /** Show rules + strength meter + generator. Default true. */
  showStrength?: boolean;
  autoComplete?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

interface StrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  colorClass: string;
  barClass: string;
}

const COMMON_PATTERNS = [
  /^(.)\1+$/, // all same char
  /^(0123|1234|2345|3456|4567|5678|6789|7890|abcd|qwer|asdf)/i,
  /^(123456|password|senha|qwerty|admin|111111|000000|123123|abc123)/i,
];

export function evaluatePasswordStrength(password: string): StrengthResult {
  if (!password) {
    return { score: 0, label: '', colorClass: 'text-muted-foreground', barClass: 'bg-muted' };
  }

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  // Penalize common patterns
  if (COMMON_PATTERNS.some((re) => re.test(password))) score = Math.min(score, 1);
  if (password.length < 8) score = Math.min(score, 1);

  // Cap at 4
  const finalScore = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;

  const map: Record<number, Omit<StrengthResult, 'score'>> = {
    0: { label: 'Muito fraca', colorClass: 'text-destructive', barClass: 'bg-destructive' },
    1: { label: 'Fraca', colorClass: 'text-destructive', barClass: 'bg-destructive' },
    2: { label: 'Razoável', colorClass: 'text-amber-600 dark:text-amber-400', barClass: 'bg-amber-500' },
    3: { label: 'Forte', colorClass: 'text-emerald-600 dark:text-emerald-400', barClass: 'bg-emerald-500' },
    4: { label: 'Muito forte', colorClass: 'text-emerald-600 dark:text-emerald-400', barClass: 'bg-emerald-600' },
  };

  return { score: finalScore, ...map[finalScore] };
}

export function generateStrongPassword(length = 16): string {
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const nums = '23456789';
  const symbols = '!@#$%&*?-_';
  const all = lower + upper + nums + symbols;

  const random = (set: string) => set[Math.floor(Math.random() * set.length)];

  // Guarantee at least one of each
  const chars = [random(lower), random(upper), random(nums), random(symbols)];
  for (let i = chars.length; i < length; i++) chars.push(random(all));

  // Shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

export const PasswordInput = ({
  id = 'password',
  value,
  onChange,
  placeholder = 'Mínimo 8 caracteres',
  label = 'Senha',
  showStrength = true,
  autoComplete = 'new-password',
  onKeyDown,
  disabled,
}: Props) => {
  const [show, setShow] = useState(false);
  const strength = useMemo(() => evaluatePasswordStrength(value), [value]);

  const checks = useMemo(() => {
    return {
      length: value.length >= 8,
      mix: /[a-z]/.test(value) && /[A-Z]/.test(value),
      number: /\d/.test(value),
      notCommon: value.length > 0 && !COMMON_PATTERNS.some((re) => re.test(value)),
    };
  }, [value]);

  const handleGenerate = async () => {
    const pwd = generateStrongPassword(16);
    onChange(pwd);
    setShow(true);
    try {
      await navigator.clipboard.writeText(pwd);
      toast.success('Senha forte gerada e copiada para a área de transferência 🔐');
    } catch {
      toast.success('Senha forte gerada — copie e guarde em local seguro');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="flex items-center gap-1">
          <Lock className="h-3 w-3" /> {label}
        </Label>
        {showStrength && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={disabled}
            className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1 disabled:opacity-50"
          >
            <Sparkles className="h-3 w-3" /> Gerar senha segura
          </button>
        )}
      </div>

      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onKeyDown={onKeyDown}
          disabled={disabled}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          className="absolute right-0 top-0 h-full w-10 text-muted-foreground hover:text-foreground"
          aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>

      {showStrength && value.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  i < strength.score ? strength.barClass : 'bg-muted',
                )}
              />
            ))}
          </div>
          <p className={cn('text-xs font-medium', strength.colorClass)}>
            Força: {strength.label}
          </p>
        </div>
      )}

      {showStrength && (
        <ul className="text-xs space-y-1 pt-1">
          <Rule ok={checks.length} text="Pelo menos 8 caracteres" />
          <Rule ok={checks.mix} text="Misture maiúsculas e minúsculas" />
          <Rule ok={checks.number} text="Inclua pelo menos um número" />
          <Rule ok={checks.notCommon} text="Não pode ser uma senha comum (ex: 123456)" />
        </ul>
      )}
    </div>
  );
};

const Rule = ({ ok, text }: { ok: boolean; text: string }) => (
  <li className={cn('flex items-center gap-1.5', ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
    {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
    <span>{text}</span>
  </li>
);

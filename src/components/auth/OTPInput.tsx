
import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
}

export function OTPInput({ 
  length = 6, 
  value, 
  onChange, 
  onComplete,
  disabled = false 
}: OTPInputProps) {
  const [digits, setDigits] = useState<string[]>(new Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const valDigits = value.split('').slice(0, length);
    const newDigits = new Array(length).fill('');
    valDigits.forEach((d, i) => newDigits[i] = d);
    setDigits(newDigits);
  }, [value, length]);

  const handleInput = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = val;
    
    const newVal = newDigits.join('');
    onChange(newVal);

    if (val && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    
    if (newVal.length === length) {
      onComplete?.(newVal);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, length);
    if (pastedData) {
      onChange(pastedData);
      if (pastedData.length === length) {
        onComplete?.(pastedData);
      }
      // Focus last filled or next empty
      const nextIndex = Math.min(pastedData.length, length - 1);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <div className="flex justify-between gap-2 sm:gap-4" onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={el => inputRefs.current[i] = el}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          autoFocus={i === 0}
          onChange={(e) => handleInput(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={cn(
            "w-full h-14 sm:h-16 text-center text-2xl font-black rounded-2xl border-2 transition-all outline-none",
            "bg-white/5 border-white/10 text-white placeholder:text-white/20",
            "focus:border-emerald-500/50 focus:bg-emerald-500/5 focus:ring-4 focus:ring-emerald-500/10",
            digit ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
      ))}
    </div>
  );
}


## Plan: Fix availability engine zero-slot issue

### Root causes identified:
1. **`totalDuration` may be 0** — if `selectedServices` doesn't match loaded `services` after filtering, `reduce` returns 0 → engine exits immediately
2. **No data-ready guard** — `calculateSlots` runs before `businessHours` or `professionalHours` are fully loaded
3. **Professional hours fallback** — when professional has no custom hours, engine correctly falls back to company hours, but company hours may be empty

### Changes:

**1. `src/pages/Booking.tsx`** — Add comprehensive debug logging and data-ready guards:
- Log `selectedServices`, `totalDuration`, loaded `services` IDs at each step transition
- In `calculateSlots`: guard against `totalDuration <= 0` with user-facing warning
- In `calculateSlots`: guard against empty `businessHours` — if empty, log error and show message
- Add debug log in `fetchProfessionals` showing service_professionals linkage
- Ensure `professionalHours` state is set before `calculateSlots` runs (already in deps, but add explicit guard)

**2. `src/lib/availability-engine.ts`** — Enhanced debug output:
- Log `professional_id` (add as optional param)
- Log all `activeHours` entries with their day/open/close/closed status
- Log when falling back from professional to company hours
- Log the exact `dayOfWeek` being searched and whether it was found

**3. `src/pages/Booking.tsx`** — Ensure slot calculation waits for all data:
- Add `businessHours.length > 0` check before calling `calculateAvailableSlots`
- If both `businessHours` and `professionalHours` are empty, show "Horários não configurados" instead of "Nenhum horário disponível"
- Pass `totalDuration` as dependency to the `useEffect` that triggers `calculateSlots`

### Security:
- Existing findings unchanged — no new vulnerabilities introduced by logging changes

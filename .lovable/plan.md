## Status Overview
The current system displays a generic \"PROMO\" badge for all types of promotions. The payment modal for completing an appointment doesn't always pre-fill existing discounts (promotion, cashback, manual) correctly, and the financial logic needs to ensure commissions are calculated based on the original gross price, not the net price after discounts.

## Proposed Changes

### 1. Administrative Agenda UI (Ajuste 1)
- Modify `UnifiedAppointmentCard.tsx` to distinguish between promotion types when `isAdmin` is true.
- Display specific badges: \"Cashback\", \"Pontuação\", \"Desconto\" based on `promotion_type` or metadata.
- Ensure the public view remains unchanged (showing \"PROMO\").

### 2. Appointment Completion Modal (Ajuste 2)
- Update `Dashboard.tsx` to ensure `completeTarget` data is fully utilized when opening the `completeDialogOpen` modal.
- Pre-fill `completeCustomAmount`, `completePromoDiscount`, `completeCashbackUsed`, and `completeManualDiscount` with values already stored in the appointment record.
- Update the modal UI to display the original gross value clearly below the client name and in the breakdown.

### 3. Financial Logic & Database (Ajuste 2)
- Update the `updateStatus` function in `Dashboard.tsx`:
  - Recalculate commission based on `original_price` (gross) instead of `netPrice`.
  - Ensure `company_revenues` records the reason for R$ 0.00 payments in the notes.
  - Fix any potential `NaN` or 0-value issues when multiple discounts are applied.
- Add a database migration to:
  - Add `discount_reason` or similar tracking if needed, although current `notes` field might suffice (will refine if needed).
  - Ensure existing appointments have consistent `original_price` and `final_price` values.

### 4. Technical Details
- **Files to modify**:
  - `src/components/appointments/UnifiedAppointmentCard.tsx` (UI Badges)
  - `src/pages/Dashboard.tsx` (Modal pre-fill and `updateStatus` logic)
  - `src/lib/financial-engine.ts` (Ensure it supports gross vs net distinction if used elsewhere)
- **Database**:
  - Migration to ensure data consistency for reporting.

## Validation Plan
1. Create appointment (R$ 35) with R$ 35 cashback.
2. Verify modal shows: Original R$ 35, Cashback R$ 35, To Pay R$ 0.
3. Confirm payment and check `company_revenues`:
   - Amount: 0
   - Notes: \"Abatido por cashback\"
   - (Verification of professional commission calculation)
4. Repeat for other discount types (Manual, Promotion, Subscription).

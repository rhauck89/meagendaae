The current implementation of the appointment completion modal uses the `total_price` or `original_price` stored in the `appointments` table as the "Original Value". However, `total_price` often already includes discounts (e.g., from promotions), and `original_price` is not always updated correctly. The correct approach is to sum the base prices of all linked services from the `services` table to determine the true gross value.

### User Review Required

> [!IMPORTANT]
> This change will ensure that professional commissions are calculated based on the full service price, even when customers use discounts or promotions.

### Proposed Changes

#### 1. Data Fetching Update
- Modify the Supabase queries in `src/pages/Dashboard.tsx` to include the `price` field from the `services` table within `appointment_services`.

#### 2. Calculation Logic
- In `openCompleteModal`, calculate the true `grossAmount` by summing up `service.price` for all items in `appointment_services`.
- If no services are linked, fallback to the current stored price.

#### 3. Modal UI & State
- Update `completeCustomAmount` (which represents the original/gross value in the modal) to use this calculated gross amount.
- Automatically calculate `completePromoDiscount` as the difference between the calculated gross amount and the `final_price` of the appointment, if a promotion is linked.
- Improve the observation field to automatically include details about applied benefits (Cashback, Promotion name, etc.).

#### 4. Financial Consistency
- Ensure `updateStatus` and the subsequent revenue creation use these corrected gross and net values.
- Maintain professional commission calculation on the corrected gross amount.

### Technical Details
- Updated files: `src/pages/Dashboard.tsx`
- Database: No schema changes, just fetching existing fields (`services.price`).
- Logic:
  ```typescript
  const calculatedGross = apt.appointment_services?.reduce(
    (acc, s) => acc + (Number(s.service?.price) || 0), 0
  ) || Number(apt.original_price || apt.total_price);
  ```
- Abatements calculation:
  - If `promotion_id` exists: `promoDiscount = calculatedGross - final_price`.
  - Handle cashback and manual discounts similarly based on existing fields.

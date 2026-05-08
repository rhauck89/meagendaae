I will synchronize the project with the specific commit requested and ensure all validations are in place for the Double Cashback and Double Points promotions.

### Technical Details
- **Git Synchronization**: The project is already on commit `65dd001e40727152036a101bfe97e691b7fd123c`, which includes the fixes for public booking incentive detection.
- **Database Migrations**: Verified that the latest migrations (including `process_appointment_cashback` with multiplier logic and `public_promotions.metadata`) are already applied in the database.
- **Incentive Logic**: The code in `src/pages/Booking.tsx` has been verified to prioritize incentive promotions over common discounts and correctly persist `promotion_id`.
- **UI Validation**: The booking confirmation screen already contains the logic to display "Cashback em Dobro" and "Pontos em Dobro" with base and final values.
- **Build and Deploy**: I will execute a final build and update the preview.

### Implementation Steps
1. **Verify Git State**: Confirming current HEAD is `65dd001e40727152036a101bfe97e691b7fd123c`.
2. **Verify Migrations**: Running a check to ensure `public_promotions.metadata` and updated `process_appointment_cashback` are active.
3. **Build**: Running `npm run build` to ensure project integrity.
4. **Publish**: Updating the preview for final testing.

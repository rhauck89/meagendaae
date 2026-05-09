I will synchronize the project with the latest GitHub main branch and deploy the necessary components to production, ensuring all recent fixes for signup, finance, and cashback are active.

### Exploration
- I have verified the current git history and found that the local repository is already at commit `0f44f9e2ace6e3369e170777155d726a8a342ee5`, which includes several of the requested fixes.
- I will verify the latest changes on GitHub main (commit `cf5b186e`) and manually apply any critical code changes if they are missing from the current local state.
- I have confirmed the contents of the required migration `20260509170000_fix_cashback_rpc_return_amount_alias.sql` and the Edge Function `auth-handler`.
- I have inspected the finance-related components (`FinanceDashboard.tsx`, `FinanceReports.tsx`, etc.) and confirmed they are ready to use `final_price` with `total_price` as a fallback.

### Implementation
- **Database Migration**: Apply `supabase/migrations/20260509170000_fix_cashback_rpc_return_amount_alias.sql` to fix the cashback RPC return values and logic.
- **Edge Function Deployment**: Deploy the latest version of the `auth-handler` Edge Function to ensure improved error handling for signup (using JSON error bodies).
- **Frontend Code Sync**: Ensure the frontend logic for finance and cashback display matches the latest main branch requirements.
- **Finance Logic**: Verify that the automatic revenue update logic in `Dashboard.tsx` correctly prevents duplicates and uses the correct pricing.

### Validation
- **Auth Handler**: Call the Edge Function to verify it returns structured JSON errors instead of generic Supabase error messages.
- **Cashback**: Verify the RPC return schema (`generated`, `amount`, `total_amount`) to ensure it matches what the dashboard expects (avoiding `NaN`).
- **Revenue Consistency**: Verify the insertion/update logic for `company_revenues` to ensure no duplicates are created when re-completing an appointment.
- **Finance Screens**: Check that `getAppointmentRevenue` is used consistently across finance pages to handle `final_price` correctly.
- **Build**: Run a production build to ensure overall project health.

### Technical Details
- Migration: `supabase/migrations/20260509170000_fix_cashback_rpc_return_amount_alias.sql`
- Edge Function: `supabase/functions/auth-handler/index.ts`
- Key Frontend Changes:
  - `src/pages/Dashboard.tsx`: Revenue deduplication and cashback display.
  - `src/lib/financial-engine.ts`: Pricing fallback logic.
  - `src/pages/finance/*`: Reporting using the new logic.

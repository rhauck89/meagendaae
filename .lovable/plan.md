The goal is to fix the `ProfessionalDrawer` component used in the Admin Finance Commissions screen to ensure it correctly displays "Ranking de Serviços", "Top Clientes", and "Histórico do Período". Currently, it seems to be missing `companyId` filtering and uses a simplified query that doesn't account for multiple services per appointment or different status filters.

### Proposed Changes

#### 1. Update `ProfessionalDrawer` Props
- Add `companyId` and `status` to `ProfessionalDrawerProps` to allow more precise filtering.
- Update `ProfessionalDrawer` usage in `FinanceCommissions.tsx` to pass these new props.

#### 2. Enhance Data Fetching in `ProfessionalDrawer.tsx`
- **Query Improvements**:
    - Filter by `company_id`.
    - Use the `status` prop (defaulting to 'completed' if not provided) instead of hardcoding it.
    - Fetch related `appointment_services` with their `services` names to support appointments with multiple services.
    - Fetch client name through the `clients` table relationship.
- **Data Processing**:
    - Correctly handle multiple services per appointment in the "Ranking de Serviços" and "Histórico do Período".
    - If multiple services exist, join their names with commas for the history view.
    - Use `final_price` with a fallback to `total_price` for revenue calculations.
    - Group by service name for the "Ranking de Serviços".
    - Group by client name for the "Top Clientes".

#### 3. Component UI Updates
- Ensure the "Histórico do Período" displays the joined service names.
- Verify that the groupings for ranking and top clients use the enhanced data processing logic.

### Technical Details
- **File**: `src/components/admin/financial/ProfessionalDrawer.tsx`
- **File**: `src/pages/finance/FinanceCommissions.tsx`
- **Query**:
  ```typescript
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select(`
      id,
      total_price,
      final_price,
      start_time,
      status,
      client_name,
      client:clients!appointments_client_id_fkey(name),
      appointment_services(
        service:services(name)
      )
    `)
    .eq('professional_id', professional.id)
    .eq('company_id', companyId)
    .eq('status', status)
    .gte('start_time', startDate.toISOString())
    .lte('start_time', endDate.toISOString())
    .order('start_time', { ascending: false });
  ```
- **Revenue Calculation**: Continue using `getAppointmentRevenue(a)` which handles the `final_price` vs `total_price` logic correctly.

### Validation Plan
- Open Dashboard Admin > Financeiro > Comissões.
- Select a professional (e.g., Cristiano Campos).
- Verify that the drawer opens and displays:
    - Service ranking matching the professional's total services.
    - Top clients with correct counts and values.
    - Appointment history showing all services performed in the period.
- Ensure values match the main table summary.

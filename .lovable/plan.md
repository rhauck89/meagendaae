The user wants to remove non-functional UI elements from the Subscriptions area to improve visual clarity.

### Visual Cleanup Tasks

1.  **Subscriptions Dashboard**
    *   File: `src/components/subscriptions/SubscriptionsDashboard.tsx`
    *   Action: Remove the "Ver todos alertas" (See all alerts) button inside the "Alertas importantes" (Important alerts) card.

2.  **Subscriptions Charges**
    *   File: `src/components/subscriptions/ChargesTab.tsx`
    *   Action: 
        *   Remove the three-dot actions menu for charges with status "paid" (`pago`), as it only contains a non-functional "Ver Comprovante" option.
        *   Conditionally render the "Ações" (Actions) column header and cells: only show them if there is at least one charge in the current list that is NOT paid (since only unpaid charges have a functional "Pago" button).

3.  **Subscriptions Plans**
    *   File: `src/components/subscriptions/PlansTab.tsx`
    *   Action: Audit the component for any non-functional buttons. Based on the current code, the "Editar", "Ativar/Desativar", and "Excluir" actions are functional. I will ensure no other placeholders exist.

### Technical Details

*   **Dashboard**: Locate line 172 in `SubscriptionsDashboard.tsx` and delete the button element.
*   **Charges**: 
    *   Calculate `const hasActions = filteredCharges.some(charge => charge.status !== 'paid')`.
    *   Use `hasActions` to conditionally render the `<TableHead className="text-right">Ações</TableHead>` and the corresponding `<TableCell>` for each row.
*   **Plans**: No immediate non-functional buttons found, but will double-check for any `DropdownMenuItem` without an `onClick` or with a placeholder handler.

### Validation
*   Run `npm run build` to ensure no regressions.
*   Verify the UI changes in the preview.

---
**Note**: No database or logic changes will be made as per instructions.

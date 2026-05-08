The user wants to refine the logic for displaying payment and next due date status in the **Subscriptions > Subscribers** screen.

### Analysis of requirements:
1.  **Payment Status: "Em dia"** - When all charges are paid, the subscriber should appear as "Em dia" (Current). Currently, if there is no open charge, it falls back to a calculation that might be showing "Atrasado" if not careful.
2.  **Next Due Date Calculation** - If there is no open charge, calculate the next due date based on the billing cycle and billing day.
3.  **Immediate Refresh** - Ensure that marking a charge as paid in **Subscriptions > Charges** immediately updates the **Subscribers** tab and the **Dashboard**.

### Proposed changes:

**1. `src/components/subscriptions/SubscribersTab.tsx`**
*   Refine `getPaymentState` to explicitly return 'current' if no open charge exists.
*   Update `getDueLabel` to handle the case where all charges are paid more gracefully, calculating the next period's due date and showing it as a future event.
*   Ensure `getNextBillingDate` logic is robust for different billing cycles (monthly/yearly).
*   Add a listener for `refresh-charges` (or similar) to trigger a refresh when a charge is paid in the other tab, if not already present. Actually, `ChargesTab.tsx` already dispatches `refresh-subscribers`, so the event name is correct.

**2. `src/components/subscriptions/ChargesTab.tsx`**
*   Verify that `handleMarkAsPaid` dispatches the correct events. (Current code shows it dispatches `refresh-subscription-dashboard` and `refresh-subscribers`).

**3. `src/components/subscriptions/SubscriptionsDashboard.tsx`**
*   Ensure stats calculation for "overdue" correctly ignores paid charges and focuses on the current state.

### Technical details:
*   In `SubscribersTab.tsx`, the `getOpenCharge` function finds the first non-paid charge. If it returns `null`, the UI should reflect that the user is "Em dia".
*   The `getNextBillingDate` function will be used to show when the next charge *will* be generated if none exists yet.

### Validation:
*   Run `npm run build` to ensure no syntax errors.
*   The user will manually test the flow as described.

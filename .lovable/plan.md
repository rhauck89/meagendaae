
## Fix: Replace create_appointment RPC and update booking flow

### 1. Database Migration
Replace `create_appointment` function with the user's provided implementation:
- Drop existing function (all signatures)
- Create new function with 9 required parameters (no `p_status` param — hardcoded to `'confirmed'`)
- Validates client exists before inserting
- Sets `search_path = public`

### 2. Update Booking.tsx (line ~666-677)
- Remove `p_status` parameter from the RPC call (no longer accepted)
- Add `p_notes: null` parameter (now required)
- Add debug log before the call: `console.log("CLIENT ID USED FOR BOOKING:", clientId)`
- Ensure `clientId` is always passed (never null) since the new function requires it

### 3. Guard: prevent booking without client_id
Add a check before calling `create_appointment`: if `!clientId`, throw an error saying client registration failed. This prevents the FK constraint violation.



## Fix: Booking appointment creation failing due to RLS

**Root cause:** The booking page does `.insert().select().single()` on appointments. The `.select()` requires a public SELECT policy which doesn't exist. Also, `client_id` is resolved but never added to `appointmentData`.

**Plan:**

### 1. Update `create_appointment` RPC to accept all booking fields
Add parameters: `p_client_name`, `p_client_whatsapp`, `p_total_price`, `p_status` to the existing `create_appointment` SECURITY DEFINER function. This bypasses RLS entirely and returns just the UUID.

### 2. Update Booking.tsx to use `create_appointment` RPC
- Add `client_id: clientId` to the appointment data
- Replace `.from('appointments').insert().select().single()` with `supabase.rpc('create_appointment', {...})`
- Use the returned UUID directly as `appointmentId`

### 3. Fix `appointment_services` INSERT for public users
The current `appointment_services` public INSERT policy checks `a.client_id IS NULL`, but now `client_id` will be set. Create a new SECURITY DEFINER RPC `create_appointment_services` or update the policy to allow public insert when appointment exists.

**Simpler alternative for step 3:** Update the public INSERT policy on `appointment_services` to just check that the appointment exists (remove the `client_id IS NULL` check).

### 4. Clean up redundant policies
Remove the overly permissive `"public can create appointments"` policy with `WITH CHECK (true)` since the RPC handles creation securely.


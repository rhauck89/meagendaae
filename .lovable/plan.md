I will perform a data cleanup for the partially created user with email Igorjardel26@gmail.com.

### Steps:
1. **Delete from public.profiles**: Remove the profile record associated with user ID `945b644e-615c-43eb-9132-7ddd2351b280`.
2. **Delete from auth.users**: Remove the authentication record to allow the email to be reused for a new signup.
3. **Verification**: Confirm that no records remain in the tracked tables for this user.

### Technical Details:
- The user ID was identified as `945b644e-615c-43eb-9132-7ddd2351b280`.
- I have verified that no records exist in `companies`, `user_onboarding`, `user_roles`, `collaborators`, or `user_tutorial_progress` for this user.
- I will use a SQL migration to ensure the deletion from the `auth` schema is successful.

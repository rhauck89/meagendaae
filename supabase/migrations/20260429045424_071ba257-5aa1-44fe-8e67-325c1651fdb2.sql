CREATE OR REPLACE FUNCTION public.link_client_to_user(p_user_id uuid, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 DECLARE
   v_user_email text;
   v_user_role text;
   v_count integer := 0;
   v_orphan record;
   v_existing_id uuid;
 BEGIN
   -- OBRIGATÓRIO: Verificar se o usuário é realmente um cliente
   SELECT role INTO v_user_role FROM public.profiles WHERE user_id = p_user_id LIMIT 1;
   
   IF v_user_role <> 'client' THEN
     RETURN 0;
   END IF;

   IF p_email IS NULL OR p_email = '' THEN
     SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
   ELSE
     v_user_email := lower(trim(p_email));
   END IF;
                                                                                                                                        
   -- Iterate orphan candidates one by one, per company, so we never violate                                                            
   -- the unique (user_id, company_id) index.                                                                                           
   FOR v_orphan IN                                                                                                                      
     SELECT id, company_id                                                                                                              
     FROM public.clients                                                                                                                
     WHERE user_id IS NULL                                                                                                              
       AND (                                                                                                                            
         (p_phone IS NOT NULL AND p_phone <> '' AND whatsapp = p_phone)                                                                 
         OR (v_user_email IS NOT NULL AND v_user_email <> '' AND lower(email) = v_user_email)                                           
       )                                                                                                                                
   LOOP                                                                                                                                 
     -- Skip if this user already has a client in that company                                                                          
     SELECT id INTO v_existing_id                                                                                                       
     FROM public.clients                                                                                                                
     WHERE user_id = p_user_id AND company_id = v_orphan.company_id                                                                     
     LIMIT 1;                                                                                                                           
                                                                                                                                        
     IF v_existing_id IS NULL THEN                                                                                                      
       UPDATE public.clients                                                                                                            
       SET user_id = p_user_id                                                                                                          
       WHERE id = v_orphan.id                                                                                                           
         AND user_id IS NULL;                                                                                                           
       v_count := v_count + 1;                                                                                                          
     END IF;                                                                                                                            
   END LOOP;                                                                                                                            
                                                                                                                                        
   RETURN v_count;                                                                                                                      
 END;                                                                                                                                   
 $function$;
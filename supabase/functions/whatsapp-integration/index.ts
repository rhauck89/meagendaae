import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, companyId, phone, message } = await req.json()
    const EVOLUTION_URL = Deno.env.get('EVOLUTION_API_URL')
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')

    if (!EVOLUTION_URL || !EVOLUTION_API_KEY) {
      console.error("Missing Evolution API configuration")
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Configuração do WhatsApp não encontrada no servidor" 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      })
    }

    // Standardize instance name
    let instanceName = `company_${companyId}`
    console.log("PROCESSING ACTION:", action, "FOR COMPANY:", companyId)
    console.log("INSTANCE NAME:", instanceName)

    if (action === 'create-instance' || action === 'get-qr') {
      // 3. CHECK EXISTING INSTANCE IN DB
      const { data: existingInstance } = await supabaseClient
        .from('whatsapp_instances')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle()

      if (existingInstance) {
        instanceName = existingInstance.instance_name
        console.log("REUSING EXISTING INSTANCE:", instanceName)
      }

      // Check if instance already exists in Evolution API
      const checkRes = await fetch(`${EVOLUTION_URL}/instance/fetchInstances?instanceName=${instanceName}`, {
        headers: { 'apikey': EVOLUTION_API_KEY }
      })
      
      let instanceExists = false
      if (checkRes.ok) {
        const instances = await checkRes.json()
        instanceExists = Array.isArray(instances) && instances.some((i: any) => i.instance.instanceName === instanceName)
      }

      if (!instanceExists) {
        console.log("CREATING NEW INSTANCE IN EVOLUTION:", instanceName)
        const createRes = await fetch(`${EVOLUTION_URL}/instance/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY
          },
          body: JSON.stringify({
            instanceName: instanceName,
            token: "agenda-e-token", // Optional token
            qrcode: true
          })
        })

        if (!createRes.ok) {
          const errorData = await createRes.json()
          console.error("CREATE ERROR:", errorData)
          
          // 4. FALLBACK ON DUPLICATION
          if (errorData.errors?.[0]?.includes("already exists") || createRes.status === 403) {
            instanceName = `company_${companyId}_${Date.now()}`
            console.log("FALLBACK INSTANCE NAME:", instanceName)
            
            const fallbackCreateRes = await fetch(`${EVOLUTION_URL}/instance/create`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
              },
              body: JSON.stringify({
                instanceName: instanceName,
                qrcode: true
              })
            })
            
            if (!fallbackCreateRes.ok) {
              return new Response(JSON.stringify({ 
                success: false, 
                error: "Falha ao criar instância de fallback" 
              }), { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200 
              })
            }
          } else {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Falha ao criar instância no WhatsApp" 
            }), { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200 
            })
          }
        }
      }

      // 10. SAVE OR UPDATE IN DB
      await supabaseClient.from('whatsapp_instances').upsert({
        company_id: companyId,
        instance_name: instanceName,
        status: 'connecting',
        updated_at: new Date().toISOString()
      })

      // 6. CAPTURE QR CODE
      console.log("FETCHING QR CODE FOR:", instanceName)
      const qrRes = await fetch(`${EVOLUTION_URL}/instance/connect/${instanceName}`, {
        headers: { 'apikey': EVOLUTION_API_KEY }
      })

      let qrBase64 = null
      if (qrRes.ok) {
        const qrData = await qrRes.json()
        qrBase64 = qrData.base64 || qrData.qrcode?.base64 || qrData.code
        console.log("QR RECEBIDO:", qrBase64 ? "Sim (base64)" : "Não")
      }

      // 7. STANDARDIZED RESPONSE
      return new Response(JSON.stringify({
        success: true,
        instanceName,
        qrcode: qrBase64 || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    if (action === 'send-message') {
      // 1. CORREÇÃO DO NUMBER (STRING)
      const formattedPhone = String(phone).replace(/\D/g, '')
      console.log("SENDING MESSAGE TO:", formattedPhone)

      const sendRes = await fetch(`${EVOLUTION_URL}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY
        },
        body: JSON.stringify({
          number: formattedPhone,
          options: {
            delay: 1200,
            presence: "composing",
            linkPreview: false
          },
          textMessage: {
            text: message
          }
        })
      })

      const sendData = await sendRes.json()
      console.log("SEND RESULT:", sendData)

      return new Response(JSON.stringify({
        success: sendRes.ok,
        data: sendData
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: "Ação não suportada" 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })

  } catch (error) {
    console.error("GLOBAL ERROR:", error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })
  }
})

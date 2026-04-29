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

    const requestBody = await req.json()
    const { action, companyId, phone, message, text } = requestBody
    
    // Check for correct secret names
    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_BASE_URL') || Deno.env.get('EVOLUTION_API_URL')
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')

    console.log("ACTION RECEBIDA:", action);
    console.log("EVOLUTION_API_URL:", EVOLUTION_API_URL);
    console.log("EVOLUTION_API_KEY EXISTS:", !!EVOLUTION_API_KEY);

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      console.error("Missing Evolution API configuration. Found URL:", !!EVOLUTION_API_URL, "Key:", !!EVOLUTION_API_KEY)
      return new Response(JSON.stringify({ 
        success: false, 
        error: "ENV_NOT_CONFIGURED" 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      })
    }

    // Clean URL: remove trailing slash if exists
    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, '')
    const instanceName = `company_${companyId}`

    // 1. PADRONIZAR AÇÕES
    switch (action) {
      case "create":
      case "get-qr":
      case "get-status":
      case "logout":
      case "send-message":
      case "send-test": // Frontend uses send-test in service.ts
        break;
      default:
        console.error("INVALID ACTION:", action);
        return new Response(JSON.stringify({ 
          success: false, 
          error: "INVALID_ACTION" 
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        })
    }

    // Helper for Evolution API calls with validation
    const callEvolution = async (endpoint: string, method = 'GET', body: any = null) => {
      const url = `${baseUrl}${endpoint}`
      console.log(`CALLING EVOLUTION: ${method} ${url}`)
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY
        },
        body: body ? JSON.stringify(body) : null
      })

      console.log("RESPONSE STATUS:", response.status)
      const rawText = await response.text()
      console.log("RAW RESPONSE:", rawText.substring(0, 200))

      if (rawText.trim().startsWith('<')) {
        console.error("EVOLUTION RETURNED HTML INSTEAD OF JSON")
        return { error: "EVOLUTION_API_INVALID_RESPONSE", status: response.status }
      }

      try {
        return JSON.parse(rawText)
      } catch (e) {
        console.error("FAILED TO PARSE JSON:", e)
        return { error: "JSON_PARSE_ERROR", status: response.status }
      }
    }

    if (action === 'create' || action === 'get-qr') {
      // Check if instance already exists in Evolution API
      const instances = await callEvolution('/instance/fetchInstances')
      let instanceExists = false
      
      if (Array.isArray(instances)) {
        instanceExists = instances.some((i: any) => i.instance.instanceName === instanceName)
      }

      if (!instanceExists && action === 'create') {
        console.log("CREATING NEW INSTANCE IN EVOLUTION:", instanceName)
        const createResult = await callEvolution('/instance/create', 'POST', {
          instanceName: instanceName,
          token: "agenda-e-token",
          qrcode: true
        })

        if (createResult.error) {
          return new Response(JSON.stringify({ success: false, error: createResult.error }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          })
        }
      }

      // Update local DB
      await supabaseClient.from('whatsapp_instances').upsert({
        company_id: companyId,
        instance_name: instanceName,
        status: 'connecting',
        updated_at: new Date().toISOString()
      })

      // Always try to get QR code for these actions
      console.log("FETCHING QR CODE FOR:", instanceName)
      const qrData = await callEvolution(`/instance/connect/${instanceName}`)
      
      let qrcode = null
      if (qrData) {
        qrcode = qrData.base64 || qrData.qrcode?.base64 || qrData.code
        
        // Fallback to /instance/qrcode if connect didn't give base64
        if (!qrcode) {
           console.log("FALLBACK TO /instance/qrcode")
           const fallbackQr = await callEvolution(`/instance/qrcode/${instanceName}`)
           qrcode = fallbackQr?.base64 || fallbackQr?.qrcode?.base64
        }
      }

      return new Response(JSON.stringify({
        success: true,
        instanceName,
        qrcode: qrcode || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    if (action === 'get-status') {
      const statusData = await callEvolution(`/instance/connectionState/${instanceName}`)
      let mappedStatus = 'disconnected'
      
      if (statusData?.instance?.state === 'open') {
        mappedStatus = 'connected'
      } else if (statusData?.instance?.state === 'connecting') {
        mappedStatus = 'connecting'
      }

      return new Response(JSON.stringify({
        success: true,
        instanceName,
        mappedStatus,
        data: statusData
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    if (action === 'logout') {
      await callEvolution(`/instance/logout/${instanceName}`, 'DELETE')
      await supabaseClient.from('whatsapp_instances').delete().eq('company_id', companyId)
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    if (action === 'send-message' || action === 'send-test') {
      const targetPhone = String(phone || "").replace(/\D/g, '')
      const targetMessage = message || text
      
      if (!targetPhone || !targetMessage) {
        return new Response(JSON.stringify({ success: false, error: "MISSING_PARAMS" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        })
      }

      const sendResult = await callEvolution(`/message/sendText/${instanceName}`, 'POST', {
        number: targetPhone,
        options: {
          delay: 1200,
          presence: "composing",
          linkPreview: false
        },
        textMessage: {
          text: targetMessage
        }
      })

      return new Response(JSON.stringify({
        success: !sendResult.error,
        data: sendResult
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    return new Response(JSON.stringify({ success: false, error: "INVALID_ACTION" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error("GLOBAL ERROR:", error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || "INTERNAL_ERROR"
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })
  }
})

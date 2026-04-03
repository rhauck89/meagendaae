import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Web Push helpers using Web Crypto API (no npm dependency needed)
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ArrayToBase64Url(array: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < array.length; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createJWT(
  privateKeyBase64Url: string,
  publicKeyBase64Url: string,
  audience: string,
  subject: string
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 86400,
    sub: subject,
  };

  const headerB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key
  const privateKeyBytes = base64UrlToUint8Array(privateKeyBase64Url);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: privateKeyBase64Url,
    x: uint8ArrayToBase64Url(base64UrlToUint8Array(publicKeyBase64Url).slice(1, 33)),
    y: uint8ArrayToBase64Url(base64UrlToUint8Array(publicKeyBase64Url).slice(33, 65)),
  };

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format if needed
  const sigArray = new Uint8Array(signature);
  const sigB64 = uint8ArrayToBase64Url(sigArray);

  return `${unsignedToken}.${sigB64}`;
}

async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const localPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  );

  // Import client public key
  const clientPublicKey = await crypto.subtle.importKey(
    "raw",
    base64UrlToUint8Array(p256dhKey),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientPublicKey },
      localKeyPair.privateKey,
      256
    )
  );

  const authSecretBytes = base64UrlToUint8Array(authSecret);

  // HKDF for auth info
  const authInfo = new Uint8Array([
    ...new TextEncoder().encode("WebPush: info\0"),
    ...base64UrlToUint8Array(p256dhKey),
    ...localPublicKeyRaw,
  ]);

  const authHkdfKey = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, [
    "deriveBits",
  ]);

  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: authSecretBytes, info: authInfo },
      authHkdfKey,
      256
    )
  );

  // Content encryption key
  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const ikmKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const cek = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: cekInfo },
      ikmKey,
      128
    )
  );

  // Nonce
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");
  const nonce = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
      ikmKey,
      96
    )
  );

  // Encrypt
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);

  const payloadBytes = new TextEncoder().encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2; // padding delimiter

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, paddedPayload)
  );

  // Build aes128gcm content encoding header + ciphertext
  const recordSize = new ArrayBuffer(4);
  new DataView(recordSize).setUint32(0, encrypted.length + 86);

  const header = new Uint8Array([
    ...salt,
    ...new Uint8Array(recordSize),
    65, // key length
    ...localPublicKeyRaw,
  ]);

  const body = new Uint8Array(header.length + encrypted.length);
  body.set(header);
  body.set(encrypted, header.length);

  return { ciphertext: body, salt, localPublicKey: localPublicKeyRaw };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;

    // Verify caller is service role or authenticated user
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === serviceKey;

    if (!isServiceRole) {
      const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const { user_id, title, body: messageBody, url } = body;

    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: "user_id and title are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch subscriptions using service role
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: subscriptions } = await adminClient
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No subscriptions found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title,
      body: messageBody || "",
      url: url || "/dashboard",
    });

    console.log(`[send-push] VAPID_PUBLIC_KEY (first 20 chars): ${vapidPublicKey.substring(0, 20)}...`);
    console.log(`[send-push] Found ${subscriptions.length} subscription(s) for user ${user_id}`);

    let sent = 0;
    let failed = 0;
    const results: Array<{ id: string; endpoint: string; status: number | string; error?: string }> = [];

    for (const sub of subscriptions) {
      try {
        const endpoint = sub.endpoint;
        const audience = new URL(endpoint).origin;
        const subject = "mailto:contato@meagendaae.com";

        console.log(`[send-push] Sending to sub ${sub.id}, endpoint: ${endpoint.substring(0, 80)}...`);

        const jwt = await createJWT(vapidPrivateKey, vapidPublicKey, audience, subject);
        const { ciphertext } = await encryptPayload(payload, sub.p256dh, sub.auth);

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            TTL: "86400",
          },
          body: ciphertext,
        });

        const responseText = await response.text();
        console.log(`[send-push] Response for ${sub.id}: status=${response.status}, body=${responseText}`);

        if (response.status === 201 || response.status === 200) {
          sent++;
          results.push({ id: sub.id, endpoint: endpoint.substring(0, 80), status: response.status });
        } else if (response.status === 410 || response.status === 404) {
          await adminClient.from("push_subscriptions").delete().eq("id", sub.id);
          failed++;
          results.push({ id: sub.id, endpoint: endpoint.substring(0, 80), status: response.status, error: "Subscription expired, removed" });
        } else {
          failed++;
          results.push({ id: sub.id, endpoint: endpoint.substring(0, 80), status: response.status, error: responseText });
        }
      } catch (err) {
        console.error(`[send-push] Exception for ${sub.id}:`, err);
        failed++;
        results.push({ id: sub.id, endpoint: "unknown", status: "error", error: String(err) });
      }
    }

    console.log(`[send-push] Done: sent=${sent}, failed=${failed}`);

    return new Response(JSON.stringify({ sent, failed, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-push error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

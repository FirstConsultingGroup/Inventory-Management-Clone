import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// CORS response helper
function corsResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE, PUT, PATCH",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}

serve(async (req) => {
  const GAS_WEB_APP_URL = Deno.env.get("GAS_WEB_APP_URL");

  // Handle preflight request for CORS
  if (req.method === "OPTIONS") {
    return corsResponse({}, 200);
  }

  // Restrict to POST requests
  if (req.method !== "POST") {
    return corsResponse({
      error: "Method not allowed"
    }, 405);
  }

  let body;
  try {
    body = await req.json();
    console.log("Sending payload:", JSON.stringify(body, null, 2));

    // Validate payload
    if (!body || Object.keys(body).length === 0) {
      return corsResponse({
        success: false,
        error: "No data received in request body"
      }, 400);
    }

    // Validate required fields
    const { to, subject, purchaseOrderData } = body;
    if (!to || !subject || !purchaseOrderData) {
      return corsResponse({
        success: false,
        error: "Missing required fields",
        received: {
          to: !!to,
          subject: !!subject,
          purchaseOrderData: !!purchaseOrderData
        }
      }, 400);
    }

  } catch (error) {
    console.error("Error parsing request body:", error);
    return corsResponse({
      success: false,
      error: "Invalid JSON in request body",
      details: error.message
    }, 400);
  }

  try {
    const gasRes = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const contentType = gasRes.headers.get("content-type") || "";
    const text = await gasRes.text();
    let result;

    try {
      result = JSON.parse(text);
    } catch (parseError) {
      console.error("Error parsing GAS response:", parseError);
      return corsResponse({
        success: false,
        error: "Failed to parse GAS response",
        debug: {
          responsePreview: text.slice(0, 200),
          contentType
        }
      }, 500);
    }

    return corsResponse(result, gasRes.status);
  } catch (error) {
    console.error("Error communicating with GAS:", error);
    return corsResponse({
      success: false,
      error: "Proxy failed",
      details: error.message
    }, 500);
  }
});
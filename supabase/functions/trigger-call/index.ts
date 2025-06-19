import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
const VAPI_API_URL = "https://api.vapi.ai/call/phone";
const PROJECT_ID = "evoogvazubdyjapdzvpt";

// Define CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, assistantId } = await req.json();
    
    // Use the provided assistantId or fall back to default
    const defaultAssistantId = "40664072-59ad-4106-9d5d-1fd5ed5dacbe"; // You can update this default
    const finalAssistantId = assistantId || defaultAssistantId;
    
    // Get the Supabase client with admin privileges
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Initialize Supabase client
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    
    // Fetch the lead data
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();
    
    if (leadError || !lead) {
      console.error("Error fetching lead:", leadError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Failed to fetch lead data",
          error: leadError 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    // Check if lead has a phone_id assigned
    if (!lead.phone_id) {
      return new Response(
        JSON.stringify({ 
          success: false,
          message: "This lead does not have a phone ID assigned"
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Check if lead call has already been initiated or completed
    if (lead.status !== "Pending") {
      return new Response(
        JSON.stringify({ 
          success: false,
          message: `This lead already has status: ${lead.status}. Cannot initiate another call.`
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Prepare the payload for Vapi
    const payload = {
      assistantId: finalAssistantId, // Now uses the dynamic or default assistant ID
      assistantOverrides: {
        variableValues: {
          Name: lead.name,
          Phone: lead.phone_number
        },
        metadata: {
          contactId: lead.id
        },
        voicemailDetection: {
          provider: "twilio",
          voicemailDetectionTypes: ["machine_end_beep"],
          enabled: true,
          machineDetectionTimeout: 30,
          machineDetectionSpeechThreshold: 2400,
          machineDetectionSpeechEndThreshold: 1800,
          machineDetectionSilenceTimeout: 5000
        },
        analysisPlan: {
          structuredDataPlan: {
            enabled: true
          },
          summaryPlan: {
            enabled: true
          },
          successEvaluationPlan: {
            enabled: true
          }
        }
        // Removed webhookUrl property as it's causing the API error
      },
      phoneNumberId: lead.phone_id,
      customer: {
        name: lead.name,
        number: lead.phone_number
      }
    };

    console.log("Making request to Vapi API:", JSON.stringify(payload, null, 2));
    
    // Make the API call to Vapi
    const response = await fetch(VAPI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${VAPI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });
    
    const responseData = await response.json();
    
    // Update lead status in database
    if (response.ok) {
      // Update lead status to "In Progress"
      await supabaseAdmin
        .from("leads")
        .update({ 
          status: "In Progress",
          disposition: "Call initiated" 
        })
        .eq("id", leadId);
        
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Call initiated successfully",
          data: responseData 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    } else {
      // Update lead status to indicate failure
      await supabaseAdmin
        .from("leads")
        .update({ 
          status: "Failed",
          disposition: `API Error: ${responseData.message || "Unknown error"}` 
        })
        .eq("id", leadId);
        
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Failed to initiate call",
          error: responseData 
        }),
        { 
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
  } catch (error) {
    console.error("Error in trigger-call function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: "Internal server error",
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

// Helper to create a Supabase client (correctly importing from esm.sh instead of relying on a local helper)
function createClient(supabaseUrl: string, supabaseKey: string) {
  return {
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: any) => ({
          single: () => fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}&${column}=eq.${value}`, {
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json"
            }
          }).then(res => res.json()).then(data => ({ data: data[0], error: null }))
        }),
        single: () => fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}`, {
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json"
          }
        }).then(res => res.json()).then(data => ({ data: data[0], error: null }))
      }),
      update: (updates: any) => ({
        eq: (column: string, value: any) => fetch(`${supabaseUrl}/rest/v1/${table}?${column}=eq.${value}`, {
          method: "PATCH",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
          },
          body: JSON.stringify(updates)
        }).then(res => ({ data: {}, error: null }))
      })
    })
  };
}

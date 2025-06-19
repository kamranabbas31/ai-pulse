
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
const VAPI_API_URL = "https://api.vapi.ai/call/phone";

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
    const defaultAssistantId = "48b1e44a-c1ff-4f4e-a9e0-7b1e03f197ea";
    const finalAssistantId = assistantId || defaultAssistantId;
    
    // Get the Supabase client with admin privileges
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Initialize Supabase client properly
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    
    console.log(`Processing call for lead ID: ${leadId}`);
    
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
    
    console.log(`Lead found: ${lead.name}, Phone: ${lead.phone_number}, Status: ${lead.status}`);
    
    // Check if lead has a phone_id assigned
    if (!lead.phone_id) {
      console.log("Lead has no phone ID assigned");
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
      console.log(`Lead status is ${lead.status}, cannot initiate call`);
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
      assistantId: finalAssistantId,
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
      },
      phoneNumberId: lead.phone_id,
      customer: {
        name: lead.name,
        number: lead.phone_number
      }
    };

    console.log("Making request to Vapi API for lead:", lead.name);
    
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
    console.log(`VAPI response status: ${response.status}`, responseData);
    
    // Update lead status in database
    if (response.ok) {
      console.log("VAPI call successful, updating lead status to In Progress");
      
      // Update lead status to "In Progress"
      const { error: updateError } = await supabaseAdmin
        .from("leads")
        .update({ 
          status: "In Progress",
          disposition: "Call initiated" 
        })
        .eq("id", leadId);
        
      if (updateError) {
        console.error("Error updating lead status:", updateError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "Call initiated but failed to update lead status",
            error: updateError 
          }),
          { 
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
      
      console.log("Lead status updated successfully");
        
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
      console.error("VAPI call failed:", responseData);
      
      // Update lead status to indicate failure
      const { error: updateError } = await supabaseAdmin
        .from("leads")
        .update({ 
          status: "Failed",
          disposition: `API Error: ${responseData.message || "Unknown error"}` 
        })
        .eq("id", leadId);
        
      if (updateError) {
        console.error("Error updating lead status after failure:", updateError);
      }
        
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

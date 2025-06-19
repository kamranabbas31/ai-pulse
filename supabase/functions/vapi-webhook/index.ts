import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    // Get the raw request body as text first to avoid truncation issues
    const rawBody = await req.text();
    console.log("Received raw webhook body length:", rawBody.length);

    // Parse the webhook payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
      console.log("Successfully parsed JSON payload");
    } catch (e) {
      console.error("Error parsing JSON:", e);
      console.log("Raw payload first 1000 chars:", rawBody.substring(0, 1000));
      return new Response(
        JSON.stringify({ success: false, message: "Invalid JSON payload" }),
        { 
          status: 200, // Still return 200 to acknowledge receipt
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    // Log important parts of the payload without truncating
    console.log("Payload keys at root level:", Object.keys(payload));
    if (payload.message) {
      console.log("Message keys:", Object.keys(payload.message));
      if (payload.message.artifact) {
        console.log("Artifact keys:", Object.keys(payload.message.artifact));
      }
    }
    
    // Get the Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Initialize Supabase client
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    
    // Try different approaches to extract critical information
    let contactId = null;
    let phoneNumber = null;
    let disposition = "Unknown";
    let duration = 0;
    let status = "Completed";
    
    // Extract contactId from various possible locations
    contactId = extractContactId(payload);
    console.log("Extracted contactId:", contactId);
    
    // Extract phone number from various possible locations
    phoneNumber = extractPhoneNumber(payload);
    console.log("Extracted phone number:", phoneNumber);
    
    // Extract disposition using new logic
    disposition = extractDisposition(payload);
    console.log("Extracted disposition:", disposition);
    
    // Extract call duration
    duration = extractDuration(payload);
    console.log("Extracted duration in seconds:", duration);
    const durationMinutes = duration / 60;
    
    // Calculate cost based on duration (in minutes)
    const cost = calculateCallCost(durationMinutes);
    console.log(`Calculated cost: $${cost.toFixed(2)} for ${durationMinutes.toFixed(1)} minutes`);
    
    // Determine call status
    status = determineCallStatus(payload);
    console.log("Call status determined as:", status);
    
    // If no contactId but we have a phone number, look up the lead
    if (!contactId && phoneNumber) {
      console.log(`No contactId found, trying to find lead by phone number: ${phoneNumber}`);
      
      const leadResult = await findLeadByPhoneNumber(supabaseAdmin, phoneNumber);
      if (leadResult) {
        contactId = leadResult.id;
        console.log(`Found lead with phone ${phoneNumber}, id: ${contactId}`);
      } else {
        // Try to extract customer name as fallback
        const customerName = extractCustomerName(payload);
        if (customerName && phoneNumber) {
          console.log(`Trying to find lead with name: ${customerName} and phone pattern`);
          const leadByNameResult = await findLeadByNameAndPhone(supabaseAdmin, customerName, phoneNumber);
          if (leadByNameResult) {
            contactId = leadByNameResult.id;
            console.log(`Found lead with name ${customerName}, id: ${contactId}`);
          }
        }
      }
    }
    
    if (!contactId && !phoneNumber) {
      console.error("No contactId or phone number could be extracted from webhook payload");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Failed to find contact information in webhook" 
        }),
        { 
          status: 200, // Still return 200 to acknowledge receipt
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    // Update the lead in the database if we have a contactId
    if (contactId) {
      console.log(`Updating lead ${contactId} with status: ${status}, disposition: ${disposition}, duration: ${durationMinutes.toFixed(2)}, cost: ${cost.toFixed(2)}`);
      
      const { data, error } = await supabaseAdmin
        .from("leads")
        .update({
          status,
          disposition,
          duration: durationMinutes, // Store as minutes
          cost
        })
        .eq("id", contactId)
        .select();
      
      if (error) {
        console.error("Error updating lead:", error);
        return new Response(
          JSON.stringify({ success: false, message: "Failed to update lead", error: error.message }),
          { 
            status: 200, // Still return 200 to acknowledge receipt
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
      
      console.log(`Successfully updated lead ${contactId}:`, data);
    } else {
      console.warn("Webhook received without contactId and couldn't find matching lead");
    }
    
    // Always return a success to Vapi
    return new Response(
      JSON.stringify({ success: true, message: "Webhook processed successfully" }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: "Failed to process webhook",
        error: error.message 
      }),
      { 
        status: 200, // Still return 200 so Vapi doesn't retry
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

// Extract contactId from various locations in the payload
function extractContactId(payload) {
  // Try all possible paths to find contactId
  if (payload.metadata && payload.metadata.contactId) {
    return payload.metadata.contactId;
  }
  
  if (payload.message && payload.message.artifact && 
      payload.message.artifact.assistantOverrides && 
      payload.message.artifact.assistantOverrides.metadata && 
      payload.message.artifact.assistantOverrides.metadata.contactId) {
    return payload.message.artifact.assistantOverrides.metadata.contactId;
  }
  
  if (payload.assistantOverrides && payload.assistantOverrides.metadata && 
      payload.assistantOverrides.metadata.contactId) {
    return payload.assistantOverrides.metadata.contactId;
  }
  
  if (payload.customer && payload.customer.contactId) {
    return payload.customer.contactId;
  }
  
  // Look in assistantOverrides top level of the message
  if (payload.message && payload.message.assistantOverrides && 
      payload.message.assistantOverrides.metadata && 
      payload.message.assistantOverrides.metadata.contactId) {
    return payload.message.assistantOverrides.metadata.contactId;
  }

  // Check inside vapi-specific structures
  if (payload.message && payload.message.metadata && payload.message.metadata.contactId) {
    return payload.message.metadata.contactId;
  }

  return null;
}

// Extract phone number from various locations in the payload
function extractPhoneNumber(payload) {
  if (payload.customer && payload.customer.number) {
    return payload.customer.number;
  }
  
  if (payload.message && payload.message.artifact && 
      payload.message.artifact.customer && payload.message.artifact.customer.number) {
    return payload.message.artifact.customer.number;
  }
  
  if (payload.message && payload.message.customer && payload.message.customer.number) {
    return payload.message.customer.number;
  }

  // Try to extract from any "to" field
  if (payload.to) {
    return payload.to;
  }

  if (payload.message && payload.message.to) {
    return payload.message.to;
  }

  return null;
}

// Extract customer name if available
function extractCustomerName(payload) {
  if (payload.customer && payload.customer.name) {
    return payload.customer.name;
  }
  
  if (payload.message && payload.message.artifact && 
      payload.message.artifact.customer && payload.message.artifact.customer.name) {
    return payload.message.artifact.customer.name;
  }
  
  if (payload.message && payload.message.customer && payload.message.customer.name) {
    return payload.message.customer.name;
  }

  return null;
}

// Updated disposition extraction function
function extractDisposition(payload) {
  let endReason = null;
  let summary = null;
  let transcript = null;
  
  // Extract end_reason
  if (payload.endedReason) {
    endReason = payload.endedReason;
  } else if (payload.message && payload.message.endedReason) {
    endReason = payload.message.endedReason;
  } else if (payload.end_reason) {
    endReason = payload.end_reason;
  } else if (payload.message && payload.message.end_reason) {
    endReason = payload.message.end_reason;
  }
  
  // Extract summary
  if (payload.message && payload.message.analysis && payload.message.analysis.summary) {
    summary = payload.message.analysis.summary;
  } else if (payload.analysis && payload.analysis.summary) {
    summary = payload.analysis.summary;
  } else if (payload.summary) {
    summary = payload.summary;
  }
  
  // Extract transcript
  if (payload.message && payload.message.transcript) {
    transcript = payload.message.transcript;
  } else if (payload.transcript) {
    transcript = payload.transcript;
  }
  
  console.log("End reason:", endReason);
  console.log("Summary:", summary ? summary.substring(0, 100) + "..." : "None");
  console.log("Transcript available:", transcript ? "Yes" : "No");
  
  // Combine summary and transcript for analysis
  const content = (summary || "") + " " + (transcript || "");
  const lowerContent = content.toLowerCase();
  
  // Check for Answering Machine first
  if (lowerContent.includes("leave a message") || 
      lowerContent.includes("at the tone") ||
      lowerContent.includes("voicemail") ||
      lowerContent.includes("can't take your call") ||
      lowerContent.includes("after the beep") ||
      endReason?.toLowerCase().includes("voicemail")) {
    return "Answering Machine";
  }
  
  // Check for No Answer
  if (endReason?.toLowerCase().includes("customer did not answer") ||
      endReason?.toLowerCase().includes("customer-did-not-answer") ||
      endReason?.toLowerCase().includes("twilio failed connection") ||
      endReason?.toLowerCase().includes("no-answer") ||
      endReason?.toLowerCase().includes("no_answer")) {
    return "No Answer";
  }
  
  // Check for Warm Transfer - Education
  if (endReason?.toLowerCase().includes("assistant forwarded call") ||
      endReason?.toLowerCase().includes("assistant-forwarded-call")) {
    if (lowerContent.includes("education consultant") ||
        lowerContent.includes("education advisor") ||
        lowerContent.includes("forwarded to education") ||
        lowerContent.includes("transferred to education")) {
      return "Warm Transfer - Education";
    }
    
    // Check for Warm Transfer - Job
    if (lowerContent.includes("job consultant") ||
        lowerContent.includes("job advisor") ||
        lowerContent.includes("forwarded to job") ||
        lowerContent.includes("transferred to job")) {
      return "Warm Transfer - Job";
    }
    
    // Generic warm transfer if we can't determine type
    return "Warm Transfer";
  }
  
  // Check for Do Not Contact
  if (lowerContent.includes("do not call") ||
      lowerContent.includes("don't call") ||
      lowerContent.includes("remove me") ||
      lowerContent.includes("stop calling") ||
      lowerContent.includes("take me off") ||
      lowerContent.includes("unsubscribe")) {
    return "Do Not Contact";
  }
  
  // Check for Language Barrier
  if (lowerContent.includes("language barrier") ||
      lowerContent.includes("no english") ||
      lowerContent.includes("don't speak english") ||
      lowerContent.includes("habla español") ||
      lowerContent.includes("communication issue") ||
      lowerContent.includes("language problem")) {
    return "Language Barrier";
  }
  
  // Check for Not Qualified
  if (lowerContent.includes("not qualified") ||
      lowerContent.includes("qualification failed") ||
      lowerContent.includes("no high school diploma") ||
      lowerContent.includes("no ged") ||
      lowerContent.includes("under 18") ||
      lowerContent.includes("not a us citizen") ||
      lowerContent.includes("no green card") ||
      lowerContent.includes("currently enrolled in school") ||
      lowerContent.includes("currently enrolled in college") ||
      lowerContent.includes("still in school") ||
      lowerContent.includes("still in college")) {
    return "Not Qualified";
  }
  
  // Check for Not Interested
  if (lowerContent.includes("not interested") ||
      lowerContent.includes("no thanks") ||
      lowerContent.includes("not right now") ||
      lowerContent.includes("not looking") ||
      lowerContent.includes("not for me") ||
      lowerContent.includes("don't want")) {
    return "Not Interested";
  }
  
  // Check for Hang Up based on end reason
  if (endReason?.toLowerCase().includes("customer ended call") ||
      endReason?.toLowerCase().includes("customer-ended-call")) {
    // If customer ended call but we haven't matched other categories, it's likely a hang up
    return "Hang Up";
  }
  
  // Default fallback
  if (endReason) {
    return `Other: ${endReason}`;
  }
  
  return "Unknown";
}

// Extract call duration from various possible locations
function extractDuration(payload) {
  if (payload.durationSeconds) {
    return payload.durationSeconds;
  } 
  
  if (payload.message && payload.message.durationSeconds) {
    return payload.message.durationSeconds;
  }
  
  if (payload.duration) {
    return payload.duration;
  }
  
  if (payload.message && payload.message.duration) {
    return payload.message.duration;
  }
  
  return 0;
}

// Determine call status based on payload
function determineCallStatus(payload) {
  if (payload.success === false || (payload.message && payload.message.success === false)) {
    return "Failed";
  }
  
  // Look for specific status indicators
  if (payload.status && typeof payload.status === 'string') {
    if (payload.status.toLowerCase().includes('fail')) {
      return "Failed";
    }
  }
  
  return "Completed";
}

// Helper function to calculate call cost
function calculateCallCost(durationMinutes) {
  // $0.99 per minute
  const minuteRate = 0.99;
  return durationMinutes * minuteRate;
}

// Helper function to find a lead by phone number
async function findLeadByPhoneNumber(supabase, phoneNumber) {
  // Try exact match first
  const { data, error } = await supabase
    .from("leads")
    .select("id, phone_number")
    .eq("phone_number", phoneNumber)
    .limit(1);
    
  if (!error && data && data.length > 0) {
    return data[0];
  }
  
  // If no exact match, try cleaning and normalizing the phone number
  const cleanedPhoneNumber = phoneNumber.replace(/\D/g, '');
  const lastTenDigits = cleanedPhoneNumber.slice(-10);
  
  console.log(`No exact match found, trying with cleaned number: ${cleanedPhoneNumber} and last 10 digits: ${lastTenDigits}`);
  
  // Try searching with LIKE on the last 10 digits
  const { data: data2, error: error2 } = await supabase
    .from("leads")
    .select("id, phone_number")
    .ilike("phone_number", `%${lastTenDigits}%`)
    .limit(1);
    
  if (!error2 && data2 && data2.length > 0) {
    console.log(`Found lead with pattern matching on last 10 digits: ${lastTenDigits}`);
    return data2[0];
  }
  
  // As a last resort, try each lead and compare the cleaned numbers
  console.log("Trying more advanced phone number matching...");
  const { data: allLeads, error: leadsError } = await supabase
    .from("leads")
    .select("id, phone_number")
    .limit(25);  // Increased limit to check more leads
    
  if (!leadsError && allLeads) {
    for (const lead of allLeads) {
      if (!lead.phone_number) continue;
      
      const leadCleanNumber = lead.phone_number.replace(/\D/g, '');
      const leadLastDigits = leadCleanNumber.slice(-10);
      
      // Try various matching patterns
      if (leadCleanNumber === cleanedPhoneNumber || 
          leadLastDigits === lastTenDigits ||
          leadCleanNumber.endsWith(lastTenDigits) || 
          cleanedPhoneNumber.endsWith(leadLastDigits)) {
        console.log(`Found matching lead by comparing cleaned numbers: ${lead.id}`);
        return lead;
      }
    }
  }
  
  console.log("No matching lead found after all attempts");
  return null;
}

// Helper function to find a lead by name and partial phone match
async function findLeadByNameAndPhone(supabase, name, phoneNumber) {
  const cleanedPhoneNumber = phoneNumber.replace(/\D/g, '');
  const lastFourDigits = cleanedPhoneNumber.slice(-4);
  
  console.log(`Looking for lead with name '${name}' and last 4 digits '${lastFourDigits}'`);
  
  // Get leads with the same name
  const { data, error } = await supabase
    .from("leads")
    .select("id, name, phone_number")
    .ilike("name", `%${name}%`)
    .limit(10);
    
  if (error || !data || data.length === 0) {
    console.log(`No leads found with name similar to '${name}'`);
    return null;
  }
  
  // Check if any of these leads have matching phone number patterns
  for (const lead of data) {
    if (!lead.phone_number) continue;
    
    const leadCleanNumber = lead.phone_number.replace(/\D/g, '');
    if (leadCleanNumber.endsWith(lastFourDigits)) {
      console.log(`Found lead with matching name and last 4 digits: ${lead.id}`);
      return lead;
    }
  }
  
  console.log(`No leads found with matching name and phone digits`);
  return null;
}

// Helper to create a Supabase client
function createClient(supabaseUrl, supabaseKey) {
  return {
    from: (table) => ({
      select: (columns) => ({
        eq: (column, value) => ({
          single: () => fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}&${column}=eq.${encodeURIComponent(value)}`, {
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json"
            }
          }).then(res => res.json()).then(data => ({ data: data[0], error: null })),
          limit: (n) => fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}&${column}=eq.${encodeURIComponent(value)}&limit=${n}`, {
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json"
            }
          }).then(res => res.json()).then(data => ({ data, error: null })),
        }),
        ilike: (column, value) => ({
          limit: (n) => fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}&${column}=ilike.${encodeURIComponent(value)}&limit=${n}`, {
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json"
            }
          }).then(res => res.json()).then(data => ({ data, error: null }))
        }),
        limit: (n) => fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}&limit=${n}`, {
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json"
          }
        }).then(res => res.json()).then(data => ({ data, error: null })),
        single: () => fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}`, {
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json"
          }
        }).then(res => res.json()).then(data => ({ data: data[0], error: null }))
      }),
      update: (updates) => ({
        eq: (column, value) => ({
          select: () => fetch(`${supabaseUrl}/rest/v1/${table}?${column}=eq.${encodeURIComponent(value)}`, {
            method: "PATCH",
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
              "Prefer": "return=representation"
            },
            body: JSON.stringify(updates)
          })
          .then(res => {
            if (res.status === 204) {
              return { data: {}, error: null };
            }
            return res.json()
              .then(data => ({ data, error: null }))
              .catch(err => ({ data: null, error: err }));
          })
          .catch(err => ({ data: null, error: err }))
        })
      })
    })
  };
}

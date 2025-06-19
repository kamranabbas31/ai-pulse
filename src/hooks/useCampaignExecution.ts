
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Lead {
  id: string;
  name: string;
  phone_number: string;
  phone_id: string | null;
  status: string;
  disposition: string | null;
  duration: number;
  cost: number;
  campaign_id?: string;
  recording_url?: string | null;
}

export const useCampaignExecution = (leads: Lead[], stats: any) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [selectedPacing, setSelectedPacing] = useState("1");

  const triggerCall = async (leadId: string) => {
    try {
      setIsCallInProgress(true);
      
      const leadToCall = leads.find(lead => lead.id === leadId);
      
      if (leadToCall && leadToCall.status !== 'Pending') {
        toast.error(`Cannot call lead: ${leadToCall.name}. Lead status is ${leadToCall.status}`);
        setIsCallInProgress(false);
        return;
      }
      
      const response = await supabase.functions.invoke('trigger-call', {
        body: { leadId }
      });
      
      if (response.error) {
        toast.error(`Failed to initiate call: ${response.error.message}`);
        console.error("Error initiating call:", response.error);
      } else if (response.data.success) {
        toast.success("Call initiated successfully");
        
        const { error: updateError } = await supabase
          .from('leads')
          .update({
            status: 'In Progress',
            disposition: 'Call initiated'
          })
          .eq('id', leadId);
          
        if (updateError) {
          console.error("Error updating lead status:", updateError);
        }
      } else {
        toast.error(response.data.message || "Failed to initiate call");
      }
    } catch (err) {
      console.error("Error triggering call:", err);
      toast.error("Failed to initiate call");
    } finally {
      setIsCallInProgress(false);
    }
  };

  const startExecution = () => {
    const pendingLeads = leads.filter(lead => {
      const isPending = lead.status === 'Pending';
      const hasPhoneId = lead.phone_id !== null;
      return isPending && hasPhoneId;
    });
    
    if (pendingLeads.length === 0) {
      toast.error("No pending leads with phone IDs available to process");
      return;
    }
    
    setIsExecuting(true);
    toast.success(`Started processing ${pendingLeads.length} pending leads`);
    
    const pacingInterval = (1 / parseInt(selectedPacing, 10)) * 1000;
    let currentIndex = 0;
    
    const id = setInterval(async () => {
      if (currentIndex >= pendingLeads.length) {
        console.log(`Finished processing all ${pendingLeads.length} leads`);
        clearInterval(id);
        setIntervalId(null);
        setIsExecuting(false);
        toast.success("Campaign execution completed");
        return;
      }
      
      const currentLead = pendingLeads[currentIndex];
      
      if (!isCallInProgress) {
        try {
          await triggerCall(currentLead.id);
        } catch (error) {
          console.error(`Error processing lead ${currentLead.name}:`, error);
        }
      }
      
      currentIndex++;
    }, pacingInterval);
    
    setIntervalId(id);
  };

  const stopExecution = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    setIsExecuting(false);
    toast.info("Stopped execution");
  };

  const toggleExecution = () => {
    if (!isExecuting) {
      startExecution();
    } else {
      stopExecution();
    }
  };

  const triggerSingleCall = async (leadId: string) => {
    if (isCallInProgress) {
      toast.info("A call is already in progress, please wait");
      return;
    }
    
    await triggerCall(leadId);
  };

  useEffect(() => {
    if (leads.length > 0 && isExecuting) {
      const pendingLeads = leads.filter(lead => lead.status === 'Pending' && lead.phone_id !== null);
      const inProgressLeads = leads.filter(lead => lead.status === 'In Progress');
      
      if (pendingLeads.length === 0 && inProgressLeads.length === 0 && stats.completed > 0) {
        stopExecution();
        
        toast.success("Campaign Finished!", {
          description: `Successfully completed ${stats.completed} calls with ${stats.failed} failures.`,
          duration: 5000,
        });
      }
    }
  }, [leads, isExecuting, stats.completed, stats.failed]);

  return {
    isExecuting,
    isCallInProgress,
    selectedPacing,
    setSelectedPacing,
    toggleExecution,
    triggerSingleCall,
    stopExecution
  };
};

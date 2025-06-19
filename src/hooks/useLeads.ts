
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

interface LeadStats {
  completed: number;
  inProgress: number;
  remaining: number;
  failed: number;
  totalDuration: number;
  totalCost: number;
}

export const useLeads = (isViewingCampaign: boolean, isDashboardInitialized: boolean) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats>({
    completed: 0,
    inProgress: 0,
    remaining: 0,
    failed: 0,
    totalDuration: 0,
    totalCost: 0,
  });
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const updateStats = (leadsData: Lead[]) => {
    const completed = leadsData.filter(lead => lead.status === 'Completed').length || 0;
    const inProgress = leadsData.filter(lead => lead.status === 'In Progress').length || 0;
    const failed = leadsData.filter(lead => lead.status === 'Failed').length || 0;
    const remaining = leadsData.filter(lead => lead.status === 'Pending').length || 0;
    const totalDuration = leadsData.reduce((sum, lead) => sum + (lead.duration || 0), 0) || 0;
    const totalCost = leadsData.reduce((sum, lead) => sum + (lead.cost || 0), 0) || 0;
    
    setStats({
      completed,
      inProgress,
      remaining,
      failed,
      totalDuration,
      totalCost,
    });
  };

  const fetchLeads = async () => {
    if (isViewingCampaign) return;
    
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error("Error fetching leads:", error);
      toast.error("Failed to fetch leads");
      return;
    }
    
    if (data && data.length > 0) {
      const mostRecentTimestamp = data[0].created_at;
      const fiveSecondsAgo = new Date(mostRecentTimestamp);
      fiveSecondsAgo.setSeconds(fiveSecondsAgo.getSeconds() - 5);
      
      const recentLeads = data.filter(lead => 
        new Date(lead.created_at) >= fiveSecondsAgo
      );
      
      setLeads(recentLeads);
      updateStats(recentLeads || []);
    }
  };

  const resetDashboardData = () => {
    setLeads([]);
    setStats({
      completed: 0,
      inProgress: 0,
      remaining: 0,
      failed: 0,
      totalDuration: 0,
      totalCost: 0,
    });
  };

  useEffect(() => {
    if (!isViewingCampaign && isDashboardInitialized) {
      fetchLeads();
      
      const interval = setInterval(() => {
        if (!isViewingCampaign && isDashboardInitialized) {
          fetchLeads();
        }
      }, 5000);
      
      setRefreshInterval(interval);
    }
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [isViewingCampaign, isDashboardInitialized]);

  useEffect(() => {
    if (!isViewingCampaign && isDashboardInitialized) {
      const subscription = supabase
        .channel('public:leads')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'leads' 
        }, payload => {
          console.log('Change received:', payload);
          fetchLeads();
        })
        .subscribe();
        
      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [isViewingCampaign, isDashboardInitialized]);

  return {
    leads,
    setLeads,
    stats,
    setStats,
    fetchLeads,
    updateStats,
    resetDashboardData
  };
};

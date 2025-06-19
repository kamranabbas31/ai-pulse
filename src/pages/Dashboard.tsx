
import { FC, useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { parseCSV } from "@/utils/csvParser";
import { supabase } from "@/integrations/supabase/client";
import { 
  fetchCampaignById, 
  createEmptyCampaign,
  addLeadsToCampaign,
  fetchLeadsForCampaign,
  resetLeads
} from "@/services/campaignService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLeads } from "@/hooks/useLeads";
import { useCampaignExecution } from "@/hooks/useCampaignExecution";
import StatsGrid from "@/components/dashboard/StatsGrid";
import ControlsSection from "@/components/dashboard/ControlsSection";
import LeadsTable from "@/components/dashboard/LeadsTable";
import SearchBar from "@/components/dashboard/SearchBar";

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

const Dashboard: FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const campaignId = searchParams.get('campaignId');
  
  const [isUploading, setIsUploading] = useState(false);
  const [showNewCampaignDialog, setShowNewCampaignDialog] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<any>(null);
  const [isViewingCampaign, setIsViewingCampaign] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [currentCampaignId, setCurrentCampaignId] = useState<string | null>(null);
  const [isDashboardInitialized, setIsDashboardInitialized] = useState(false);

  const { 
    leads, 
    setLeads, 
    stats, 
    setStats, 
    fetchLeads, 
    updateStats, 
    resetDashboardData 
  } = useLeads(isViewingCampaign, isDashboardInitialized);

  const {
    isExecuting,
    isCallInProgress,
    selectedPacing,
    setSelectedPacing,
    toggleExecution,
    triggerSingleCall
  } = useCampaignExecution(leads, stats);

  // Load campaign data if campaignId is present in URL
  useEffect(() => {
    if (campaignId) {
      loadCampaignData(campaignId);
      setIsDashboardInitialized(true);
    } else {
      setIsViewingCampaign(false);
      setIsDashboardInitialized(false);
      resetDashboardData();
    }
  }, [campaignId]);

  // Apply search filter to leads
  useEffect(() => {
    if (!isSearchActive) {
      setFilteredLeads(leads);
    } else if (searchTerm) {
      const filtered = leads.filter(lead => 
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        lead.phone_number.includes(searchTerm) ||
        lead.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.disposition && lead.disposition.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredLeads(filtered);
    }
  }, [leads, searchTerm, isSearchActive]);

  const loadCampaignData = async (id: string) => {
    try {
      setIsViewingCampaign(true);
      setIsDashboardInitialized(true);
      
      const campaign = await fetchCampaignById(id);
      setActiveCampaign(campaign);
      
      setStats({
        completed: campaign.completed || 0,
        inProgress: campaign.in_progress || 0,
        remaining: campaign.remaining || 0,
        failed: campaign.failed || 0,
        totalDuration: campaign.duration || 0,
        totalCost: campaign.cost || 0,
      });
      
      const leads = await fetchLeadsForCampaign(id);
      
      setLeads(leads);
      setFilteredLeads(leads);
      setCampaignName(campaign.name || "");
      document.title = `${campaign.name || "Campaign"} - Call Manager`;
      
      toast.success(`Loaded campaign: ${campaign.name}`);
    } catch (error) {
      console.error("Error loading campaign data:", error);
      toast.error("Failed to load campaign data");
      clearCampaignView();
    }
  };

  const clearCampaignView = () => {
    navigate('/', { replace: true });
    setIsViewingCampaign(false);
    setActiveCampaign(null);
    document.title = "Dashboard - Call Manager";
    resetDashboardData();
    setIsDashboardInitialized(false);
  };

  const getAvailablePhoneId = async () => {
    const { data, error } = await supabase.rpc('get_available_phone_id');
    
    if (error) {
      console.error("Error getting available phone ID:", error);
      return null;
    }
    
    return data;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const parsedLeads = parseCSV(content);
          
          if (parsedLeads.length === 0) {
            toast.error("No valid leads found in the CSV");
            setIsUploading(false);
            return;
          }
          
          if (currentCampaignId) {
            const formattedLeads = [];
            
            for (const lead of parsedLeads) {
              const phoneId = await getAvailablePhoneId();
              
              formattedLeads.push({
                name: lead.name,
                phone_number: lead.phoneNumber,
                phone_id: phoneId,
                status: phoneId ? 'Pending' : 'Failed',
                disposition: phoneId ? null : 'No available phone ID'
              });
            }
            
            const updatedCampaign = await addLeadsToCampaign(currentCampaignId, formattedLeads);
            
            if (updatedCampaign) {
              toast.success(`Successfully uploaded ${formattedLeads.length} leads to campaign`);
              
              await loadCampaignData(currentCampaignId);
              
              setCurrentCampaignId(null);
              setShowUploadDialog(false);
              setIsDashboardInitialized(true);
            }
          } else {
            setIsDashboardInitialized(true);
            
            let successCount = 0;
            let errorCount = 0;
            
            await resetLeads();
            resetDashboardData();
            
            for (const lead of parsedLeads) {
              try {
                const phoneId = await getAvailablePhoneId();
                
                const { error } = await supabase.from('leads').insert({
                  name: lead.name,
                  phone_number: lead.phoneNumber,
                  phone_id: phoneId,
                  status: phoneId ? 'Pending' : 'Failed',
                  disposition: phoneId ? null : 'No available phone ID'
                });
                
                if (error) {
                  console.error("Error inserting lead:", error);
                  errorCount++;
                } else {
                  successCount++;
                }
              } catch (err) {
                console.error("Error processing lead:", err);
                errorCount++;
              }
            }
            
            if (successCount > 0) {
              toast.success(`Successfully uploaded ${successCount} leads`);
            }
            
            if (errorCount > 0) {
              toast.error(`Failed to upload ${errorCount} leads`);
            }
            
            fetchLeads();
          }
        } catch (err) {
          console.error("Error parsing CSV:", err);
          toast.error("Failed to parse CSV file. Make sure it has Name and Phone columns.");
        }
        
        setIsUploading(false);
      };
      
      reader.readAsText(file);
    } catch (err) {
      console.error("Error reading file:", err);
      toast.error("Failed to read file");
      setIsUploading(false);
    }
    
    e.target.value = '';
  };

  const handleNewCampaign = () => {
    setShowNewCampaignDialog(true);
    setCampaignName(`Campaign ${new Date().toLocaleDateString()}`);
  };

  const handleCreateNewCampaign = async () => {
    try {
      if (!campaignName.trim()) {
        toast.error("Please enter a valid campaign name");
        return;
      }
      
      resetDashboardData();
      
      const campaign = await createEmptyCampaign(campaignName);
      
      if (campaign) {
        toast.success(`Campaign "${campaignName}" created successfully`);
        setShowNewCampaignDialog(false);
        
        setCurrentCampaignId(campaign.id);
        setShowUploadDialog(true);
        setIsDashboardInitialized(true);
        
        navigate(`/?campaignId=${campaign.id}`, { replace: true });
      } else {
        toast.error("Failed to create campaign");
      }
    } catch (error) {
      console.error("Error creating campaign:", error);
      toast.error("An error occurred while creating the campaign");
    }
  };

  const handleSearch = () => {
    const hasSearchTerm = !!searchTerm.trim();
    setIsSearchActive(hasSearchTerm);
    
    if (hasSearchTerm) {
      const filtered = leads.filter(lead => 
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        lead.phone_number.includes(searchTerm) ||
        lead.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.disposition && lead.disposition.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      
      setFilteredLeads(filtered);
      
      if (filtered.length === 0) {
        toast.info("No matching leads found");
      } else {
        toast.success(`Found ${filtered.length} matching leads`);
      }
    } else {
      setFilteredLeads(leads);
      toast.info("Showing all leads");
    }
  };

  const clearSearch = () => {
    setSearchTerm("");
    setIsSearchActive(false);
    setFilteredLeads(leads);
    toast.info("Search cleared");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col space-y-2">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary">Call Manager</h1>
            {isViewingCampaign && activeCampaign ? (
              <>
                <div className="flex items-center mt-4 space-x-2">
                  <h2 className="text-2xl font-bold text-gray-800">Campaign: {activeCampaign.name}</h2>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearCampaignView}
                  >
                    Back to Dashboard
                  </Button>
                </div>
                <p className="text-muted-foreground">
                  Campaign created on {new Date(activeCampaign.created_at).toLocaleDateString()}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-800 mt-4">Dashboard</h2>
                <p className="text-muted-foreground">Manage and monitor your AI outbound calling campaigns.</p>
              </>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {isViewingCampaign ? (
              <Button 
                variant="outline" 
                onClick={() => {
                  setCurrentCampaignId(activeCampaign.id);
                  setShowUploadDialog(true);
                }}
              >
                <FileUp className="h-4 w-4 mr-2" />
                Add Leads
              </Button>
            ) : (
              <>
                {isDashboardInitialized && (
                  <Button variant="outline" onClick={fetchLeads}>
                    Refresh Data
                  </Button>
                )}
                <Button className="bg-primary" onClick={handleNewCampaign}>+ New Campaign</Button>
              </>
            )}
          </div>
        </div>
      </div>

      <StatsGrid stats={stats} />

      <ControlsSection
        isViewingCampaign={isViewingCampaign}
        isDashboardInitialized={isDashboardInitialized}
        isExecuting={isExecuting}
        isCallInProgress={isCallInProgress}
        isUploading={isUploading}
        selectedPacing={selectedPacing}
        setSelectedPacing={setSelectedPacing}
        toggleExecution={toggleExecution}
        handleFileUpload={handleFileUpload}
        activeCampaign={activeCampaign}
        setCurrentCampaignId={setCurrentCampaignId}
        setShowUploadDialog={setShowUploadDialog}
      />

      <div className="bg-white shadow-sm rounded-lg border overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">
              {isViewingCampaign ? 'Campaign Leads' : 'Call Log'}
            </h3>
            <SearchBar
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              handleSearch={handleSearch}
              clearSearch={clearSearch}
              isSearchActive={isSearchActive}
            />
          </div>
        </div>
        <LeadsTable
          leads={filteredLeads}
          isDashboardInitialized={isDashboardInitialized}
          isSearchActive={isSearchActive}
          searchTerm={searchTerm}
          isViewingCampaign={isViewingCampaign}
          isCallInProgress={isCallInProgress}
          triggerSingleCall={triggerSingleCall}
        />
      </div>

      {/* New Campaign Dialog */}
      <Dialog open={showNewCampaignDialog} onOpenChange={setShowNewCampaignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input 
                id="campaign-name" 
                value={campaignName} 
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Enter campaign name"
                autoFocus
              />
            </div>
            <p className="text-sm text-muted-foreground">
              This will create a new empty campaign. You'll be prompted to upload leads afterward.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCampaignDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateNewCampaign}>Create Campaign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Leads Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Leads</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p>Upload a CSV file with leads for your {currentCampaignId ? 'campaign' : 'dashboard'}.</p>
            <Button 
              className="flex items-center space-x-2 w-full" 
              variant="outline" 
              onClick={() => document.getElementById('campaign-file-upload')?.click()}
              disabled={isUploading}
            >
              <FileUp className="h-4 w-4" />
              <span>{isUploading ? "Uploading..." : "Select CSV File"}</span>
            </Button>
            <input 
              id="campaign-file-upload" 
              type="file" 
              accept=".csv" 
              className="hidden" 
              onChange={handleFileUpload} 
              disabled={isUploading}
            />
            <p className="text-xs text-muted-foreground">
              CSV must include columns for Lead Name and Phone Number
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowUploadDialog(false);
                setCurrentCampaignId(null);
              }}
            >
              Skip Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;

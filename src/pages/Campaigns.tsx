import { FC, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { fetchCampaigns } from "@/services/campaignService";
import { downloadCampaignReport } from "@/services/reportService";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  file_name: string | null;
  status: string;
  leads_count: number;
  completed: number;
  in_progress: number;
  remaining: number;
  failed: number;
  duration: number;
  cost: number;
  created_at: string;
}

const Campaigns: FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    setIsLoading(true);
    try {
      const data = await fetchCampaigns();
      console.log("Loaded campaigns:", data);
      setCampaigns(data);
    } catch (error) {
      console.error("Error loading campaigns:", error);
      toast.error("Failed to load campaigns");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in-progress":
        return <Badge className="bg-blue-500 hover:bg-blue-600">In Progress</Badge>;
      case "completed":
        return <Badge className="bg-green-500 hover:bg-green-600">Completed</Badge>;
      case "stopped":
        return <Badge variant="outline" className="text-gray-500 border-gray-300">Stopped</Badge>;
      case "paused":
        return <Badge variant="outline" className="text-amber-500 border-amber-300">Paused</Badge>;
      case "pending":
        return <Badge variant="outline" className="text-purple-500 border-purple-300">Pending</Badge>;
      case "partial":
        return <Badge className="bg-amber-500 hover:bg-amber-600">Partial</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleCampaignClick = (campaignId: string) => {
    navigate(`/?campaignId=${campaignId}`);
  };

  const handleDownloadReport = async (campaignId: string, campaignName: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent row click when downloading
    await downloadCampaignReport(campaignId, campaignName);
  };

  const handleRefresh = () => {
    loadCampaigns();
    toast.success("Campaigns refreshed");
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex flex-col space-y-2">
          <h2 className="text-2xl font-bold">Campaigns</h2>
          <p className="text-muted-foreground">View and manage your calling campaigns</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" className="ml-auto">
          Refresh
        </Button>
      </div>

      <div className="bg-white shadow-sm rounded-lg border overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Campaign History</h3>
          <p className="text-sm text-muted-foreground">List of all your uploaded campaign files and their statuses</p>
        </div>
        <div className="p-0">
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead>
                <tr className="border-b">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Campaign Name</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">File Name</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Leads</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Completed</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">In Progress</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Remaining</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Failed</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Duration (min)</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Cost ($)</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Date Created</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr className="h-[100px]">
                    <td colSpan={12} className="text-center text-muted-foreground">
                      Loading campaigns...
                    </td>
                  </tr>
                ) : campaigns.length > 0 ? (
                  campaigns.map((campaign) => (
                    <tr 
                      key={campaign.id} 
                      className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleCampaignClick(campaign.id)}
                    >
                      <td className="p-4 align-middle">{campaign.name}</td>
                      <td className="p-4 align-middle">{campaign.file_name || '-'}</td>
                      <td className="p-4 align-middle">{getStatusBadge(campaign.status)}</td>
                      <td className="p-4 align-middle">{campaign.leads_count}</td>
                      <td className="p-4 align-middle">{campaign.completed}</td>
                      <td className="p-4 align-middle">{campaign.in_progress}</td>
                      <td className="p-4 align-middle">{campaign.remaining}</td>
                      <td className="p-4 align-middle">{campaign.failed}</td>
                      <td className="p-4 align-middle">{campaign.duration.toFixed(1)}</td>
                      <td className="p-4 align-middle">${campaign.cost.toFixed(2)}</td>
                      <td className="p-4 align-middle">{formatDate(campaign.created_at)}</td>
                      <td className="p-4 align-middle">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handleDownloadReport(campaign.id, campaign.name, e)}
                          className="flex items-center gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="h-[100px]">
                    <td colSpan={12} className="text-center text-muted-foreground">
                      No campaigns found. Create a new campaign to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Campaigns;

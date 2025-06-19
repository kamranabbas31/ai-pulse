
import { FC } from 'react';
import { FileUp, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ControlsSectionProps {
  isViewingCampaign: boolean;
  isDashboardInitialized: boolean;
  isExecuting: boolean;
  isCallInProgress: boolean;
  isUploading: boolean;
  selectedPacing: string;
  setSelectedPacing: (value: string) => void;
  toggleExecution: () => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  activeCampaign?: any;
  setCurrentCampaignId: (id: string) => void;
  setShowUploadDialog: (show: boolean) => void;
}

const ControlsSection: FC<ControlsSectionProps> = ({
  isViewingCampaign,
  isDashboardInitialized,
  isExecuting,
  isCallInProgress,
  isUploading,
  selectedPacing,
  setSelectedPacing,
  toggleExecution,
  handleFileUpload,
  activeCampaign,
  setCurrentCampaignId,
  setShowUploadDialog
}) => {
  if (isViewingCampaign) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="p-6 bg-white shadow-sm rounded-lg border">
          <h3 className="text-lg font-semibold mb-2">Campaign Actions</h3>
          <p className="text-sm text-muted-foreground mb-4">Manage this campaign</p>
          <div className="flex flex-col space-y-4">
            <Button 
              className="flex items-center space-x-2" 
              variant="outline" 
              onClick={() => {
                setCurrentCampaignId(activeCampaign.id);
                setShowUploadDialog(true);
              }}
            >
              <FileUp className="h-4 w-4 mr-2" />
              Add More Leads
            </Button>

            <Button 
              className={`${isExecuting ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"} w-full`} 
              onClick={toggleExecution}
              disabled={isCallInProgress}
            >
              {isExecuting ? (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Stop Campaign
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Campaign
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="p-6 bg-white shadow-sm rounded-lg border">
          <h3 className="text-lg font-semibold mb-2">Pacing Controls</h3>
          <p className="text-sm text-muted-foreground mb-4">Set the rate of outbound calls</p>
          <div className="flex flex-col space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Call Pacing (calls/sec)</label>
              <Select 
                value={selectedPacing} 
                onValueChange={setSelectedPacing}
                disabled={isExecuting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select pacing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 call/sec</SelectItem>
                  <SelectItem value="2">2 calls/sec</SelectItem>
                  <SelectItem value="3">3 calls/sec</SelectItem>
                  <SelectItem value="5">5 calls/sec</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white shadow-sm rounded-lg border">
          <h3 className="text-lg font-semibold mb-2">Campaign Status</h3>
          <p className="text-sm text-muted-foreground mb-4">Current campaign details</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-medium">{activeCampaign?.status || "Unknown"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created:</span>
              <span className="font-medium">{activeCampaign ? new Date(activeCampaign.created_at).toLocaleDateString() : "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Leads:</span>
              <span className="font-medium">{activeCampaign?.leads_count || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Conversion Rate:</span>
              <span className="font-medium">
                {activeCampaign && activeCampaign.leads_count > 0
                  ? `${Math.round((activeCampaign.completed / activeCampaign.leads_count) * 100)}%`
                  : "0%"}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="p-6 bg-white shadow-sm rounded-lg border">
        <h3 className="text-lg font-semibold mb-2">File Upload</h3>
        <p className="text-sm text-muted-foreground mb-4">Upload a CSV file with lead data</p>
        <div className="flex flex-col space-y-4">
          <Button 
            className="flex items-center space-x-2" 
            variant="outline" 
            onClick={() => document.getElementById('file-upload')?.click()}
            disabled={isUploading}
          >
            <FileUp className="h-4 w-4" />
            <span>{isUploading ? "Uploading..." : "Upload CSV"}</span>
          </Button>
          <input 
            id="file-upload" 
            type="file" 
            accept=".csv" 
            className="hidden" 
            onChange={handleFileUpload} 
            disabled={isUploading}
          />
          <p className="text-xs text-muted-foreground">CSV must include columns for Lead Name and Phone Number</p>
        </div>
      </div>

      <div className="p-6 bg-white shadow-sm rounded-lg border">
        <h3 className="text-lg font-semibold mb-2">Pacing Controls</h3>
        <p className="text-sm text-muted-foreground mb-4">Set the rate of outbound calls</p>
        <div className="flex flex-col space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Call Pacing (calls/sec)</label>
            <Select 
              value={selectedPacing} 
              onValueChange={setSelectedPacing}
              disabled={isExecuting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select pacing" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 call/sec</SelectItem>
                <SelectItem value="2">2 calls/sec</SelectItem>
                <SelectItem value="3">3 calls/sec</SelectItem>
                <SelectItem value="5">5 calls/sec</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="p-6 bg-white shadow-sm rounded-lg border">
        <h3 className="text-lg font-semibold mb-2">Call Execution</h3>
        <p className="text-sm text-muted-foreground mb-4">Control the calling queue</p>
        <div className="flex flex-col space-y-4">
          <Button 
            className={`${isExecuting ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"} w-full`} 
            onClick={toggleExecution}
            disabled={isCallInProgress || !isDashboardInitialized}
          >
            {isExecuting ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Stop Execution
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Execution
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">Upload a CSV file and click Start to begin calling</p>
        </div>
      </div>
    </div>
  );
};

export default ControlsSection;

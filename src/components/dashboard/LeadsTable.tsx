
import { FC, useState } from 'react';
import { Phone, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
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

interface LeadsTableProps {
  leads: Lead[];
  isDashboardInitialized: boolean;
  isSearchActive: boolean;
  searchTerm: string;
  isViewingCampaign: boolean;
  isCallInProgress: boolean;
  triggerSingleCall: (leadId: string) => void;
}

const LeadsTable: FC<LeadsTableProps> = ({
  leads,
  isDashboardInitialized,
  isSearchActive,
  searchTerm,
  isViewingCampaign,
  isCallInProgress,
  triggerSingleCall
}) => {
  const [playingLeadId, setPlayingLeadId] = useState<string | null>(null);

  const handlePlayRecording = (leadId: string) => {
    setPlayingLeadId(playingLeadId === leadId ? null : leadId);
  };

  return (
    <div className="bg-white shadow-sm rounded-lg border overflow-hidden">
      <div className="p-6 border-b">
        <h3 className="text-lg font-semibold">
          {isViewingCampaign ? 'Campaign Leads' : 'Call Log'}
        </h3>
      </div>
      <div className="p-4">
        <div className="relative w-full overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead Name</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Disposition</TableHead>
                <TableHead>Duration (min)</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Recording</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isDashboardInitialized && leads.length > 0 ? (
                leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>{lead.name}</TableCell>
                    <TableCell>{lead.phone_number}</TableCell>
                    <TableCell>{lead.status}</TableCell>
                    <TableCell>{lead.disposition || '-'}</TableCell>
                    <TableCell>{lead.duration?.toFixed(1) || '0.0'}</TableCell>
                    <TableCell>${lead.cost?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell>
                      {lead.recording_url ? (
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePlayRecording(lead.id)}
                            className="flex items-center gap-2"
                          >
                            <Volume2 className="h-4 w-4" />
                            {playingLeadId === lead.id ? 'Hide Player' : 'Play Recording'}
                          </Button>
                          {playingLeadId === lead.id && (
                            <div className="mt-2">
                              <audio 
                                controls 
                                className="w-full max-w-xs"
                                src={lead.recording_url}
                                onError={() => {
                                  toast.error("Failed to load recording");
                                }}
                              >
                                Your browser does not support the audio element.
                              </audio>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No recording</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {lead.status === 'Pending' && lead.phone_id && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => triggerSingleCall(lead.id)}
                          disabled={isCallInProgress}
                        >
                          <Phone className="h-4 w-4 mr-1" /> Call
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="h-[100px]">
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    {searchTerm && isSearchActive 
                      ? "No matching leads found." 
                      : isViewingCampaign 
                        ? "No leads found for this campaign." 
                        : isDashboardInitialized
                          ? "No leads found. Upload a CSV file to get started."
                          : "Create a new campaign to get started."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default LeadsTable;

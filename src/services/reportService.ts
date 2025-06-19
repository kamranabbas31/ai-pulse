
import * as XLSX from 'xlsx';
import { fetchLeadsForCampaign } from './campaignService';
import { toast } from 'sonner';

export const downloadCampaignReport = async (campaignId: string, campaignName: string) => {
  try {
    // Fetch leads for the campaign
    const leads = await fetchLeadsForCampaign(campaignId);
    
    if (!leads || leads.length === 0) {
      toast.error("No leads found for this campaign");
      return;
    }

    // Format the data for Excel
    const excelData = leads.map(lead => ({
      'Lead Name': lead.name || '',
      'Phone Number': lead.phone_number || '',
      'Status': lead.status || '',
      'Disposition': lead.disposition || '',
      'Duration (minutes)': lead.duration ? lead.duration.toFixed(2) : '0.00',
      'Cost ($)': lead.cost ? lead.cost.toFixed(2) : '0.00',
      'Created Date': lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '',
      'Updated Date': lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : '',
      'Notes': lead.notes || ''
    }));

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Auto-size columns
    const columnWidths = [
      { wch: 20 }, // Lead Name
      { wch: 15 }, // Phone Number
      { wch: 12 }, // Status
      { wch: 20 }, // Disposition
      { wch: 15 }, // Duration
      { wch: 10 }, // Cost
      { wch: 12 }, // Created Date
      { wch: 12 }, // Updated Date
      { wch: 30 }  // Notes
    ];
    worksheet['!cols'] = columnWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Campaign Results');

    // Generate filename
    const sanitizedCampaignName = campaignName.replace(/[^a-z0-9]/gi, '_');
    const filename = `${sanitizedCampaignName}_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Download the file
    XLSX.writeFile(workbook, filename);
    
    toast.success(`Report downloaded: ${filename}`);
  } catch (error) {
    console.error('Error generating campaign report:', error);
    toast.error('Failed to generate campaign report');
  }
};

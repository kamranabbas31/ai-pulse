
export const parseCSV = (content: string): { name: string, phoneNumber: string }[] => {
  const lines = content.split('\n');
  
  // Skip empty file
  if (lines.length === 0) {
    return [];
  }
  
  // Find header row and handle quoted values
  const parseRow = (row: string): string[] => {
    const values: string[] = [];
    let inQuote = false;
    let currentValue = '';
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    
    // Push the last value
    if (currentValue.length > 0) {
      values.push(currentValue.trim());
    }
    
    return values;
  };

  const headers = parseRow(lines[0]).map(header => header.trim().toLowerCase());
  
  // Try to find name and phone columns
  const nameIndex = headers.findIndex(header => 
    header === 'name' || 
    header === 'lead name' || 
    header.includes('name') ||
    header === 'contact');
  
  const phoneIndex = headers.findIndex(header => 
    header === 'phone' || 
    header === 'phone number' || 
    header.includes('phone') ||
    header === 'mobile' ||
    header === 'telephone' ||
    header === 'cell');
  
  if (nameIndex === -1 || phoneIndex === -1) {
    throw new Error('CSV must include columns for Name and Phone Number');
  }
  
  // Parse data rows
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      const values = parseRow(line);
      if (values.length >= Math.max(nameIndex, phoneIndex) + 1) {
        const name = values[nameIndex].trim();
        let phoneNumber = values[phoneIndex].trim();
        
        // Normalize phone number format (remove non-numeric characters except +)
        phoneNumber = phoneNumber.replace(/[^\d+]/g, '');
        
        // Add +1 if the number doesn't already start with +
        if (phoneNumber && !phoneNumber.startsWith('+')) {
          phoneNumber = '+1' + phoneNumber;
        }
        
        if (name && phoneNumber) {
          results.push({ name, phoneNumber });
        }
      }
    }
  }
  
  return results;
};

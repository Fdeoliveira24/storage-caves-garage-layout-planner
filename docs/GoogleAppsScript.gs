/**
 * Google Apps Script for Storage Caves Garage Layout Planner
 * Client Management System Integration
 * 
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Sheet named "Buford"
 * 2. Go to script.google.com and create a new project
 * 3. Replace the default code with this script
 * 4. Deploy as web app:
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the web app URL to your app's sync settings
 */

// Configuration
const SHEET_NAME = 'Buford';
const HEADERS = ['ID', 'Name', 'Email', 'Phone', 'Unit Preference', 'Follow Up Date', 'Notes', 'Assigned Layouts', 'Created Date', 'Updated Date'];

/**
 * Handle GET requests (fetch clients)
 */
function doGet(e) {
  try {
    console.log('GET request received');
    
    const sheet = getOrCreateSheet();
    const clients = getClientsFromSheet(sheet);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        data: clients,
        message: `Fetched ${clients.length} clients`
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      
  } catch (error) {
    console.error('GET Error:', error);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
  }
}

/**
 * Handle POST requests (sync clients)
 */
function doPost(e) {
  try {
    console.log('POST request received');
    
    // Parse request data
    const requestData = JSON.parse(e.postData.contents);
    const clients = requestData.clients || [];
    
    console.log(`Syncing ${clients.length} clients`);
    
    const sheet = getOrCreateSheet();
    syncClientsToSheet(sheet, clients);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        data: clients,
        message: `Synced ${clients.length} clients successfully`
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      
  } catch (error) {
    console.error('POST Error:', error);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
  }
}

/**
 * Handle OPTIONS requests (CORS preflight)
 */
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}

/**
 * Get or create the Buford sheet
 */
function getOrCreateSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  // Try to get existing sheet
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  
  // Create sheet if it doesn't exist
  if (!sheet) {
    console.log('Creating new sheet:', SHEET_NAME);
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    
    // Add headers
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

/**
 * Get all clients from the sheet
 */
function getClientsFromSheet(sheet) {
  const dataRange = sheet.getDataRange();
  
  if (dataRange.getNumRows() <= 1) {
    return []; // Only headers or empty sheet
  }
  
  const values = dataRange.getValues();
  const headers = values[0];
  const clients = [];
  
  // Convert rows to client objects
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const client = {};
    
    headers.forEach((header, index) => {
      const value = row[index];
      
      switch (header) {
        case 'ID':
          client.id = value || '';
          break;
        case 'Name':
          client.name = value || '';
          break;
        case 'Email':
          client.email = value || '';
          break;
        case 'Phone':
          client.phone = value || '';
          break;
        case 'Unit Preference':
          client.unitPreference = value || '';
          break;
        case 'Follow Up Date':
          client.followUpDate = value ? formatDate(value) : '';
          break;
        case 'Notes':
          client.notes = value || '';
          break;
        case 'Assigned Layouts':
          client.assignedLayouts = value ? value.split(',').map(s => s.trim()) : [];
          break;
        case 'Created Date':
          client.createdDate = value ? formatDate(value) : '';
          break;
        case 'Updated Date':
          client.updatedDate = value ? formatDate(value) : '';
          break;
      }
    });
    
    // Only add client if it has required fields
    if (client.id && client.name) {
      clients.push(client);
    }
  }
  
  return clients;
}

/**
 * Sync clients to the sheet
 */
function syncClientsToSheet(sheet, clients) {
  // Clear existing data (keep headers)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  
  if (clients.length === 0) {
    return;
  }
  
  // Prepare data rows
  const rows = clients.map(client => [
    client.id || '',
    client.name || '',
    client.email || '',
    client.phone || '',
    client.unitPreference || '',
    client.followUpDate || '',
    client.notes || '',
    (client.assignedLayouts || []).join(', '),
    client.createdDate || '',
    client.updatedDate || new Date().toISOString()
  ]);
  
  // Write data to sheet
  const range = sheet.getRange(2, 1, rows.length, HEADERS.length);
  range.setValues(rows);
  
  console.log(`Synced ${clients.length} clients to sheet`);
}

/**
 * Format date for consistent output
 */
function formatDate(date) {
  if (!date) return '';
  
  try {
    if (typeof date === 'string') {
      return date; // Already formatted
    }
    
    return date.toISOString ? date.toISOString() : new Date(date).toISOString();
  } catch (error) {
    console.error('Date formatting error:', error);
    return '';
  }
}

/**
 * Test function to verify setup
 */
function testScript() {
  console.log('Testing Google Apps Script setup...');
  
  try {
    const sheet = getOrCreateSheet();
    console.log('Sheet created/found successfully:', sheet.getName());
    
    // Test with sample data
    const sampleClients = [
      {
        id: 'test-' + Date.now(),
        name: 'Test Client',
        email: 'test@example.com',
        phone: '555-0123',
        unitPreference: 'Units A - 22\'×55\'',
        followUpDate: '2025-12-10',
        notes: 'Test client for script verification',
        assignedLayouts: ['layout1'],
        createdDate: new Date().toISOString(),
        updatedDate: new Date().toISOString()
      }
    ];
    
    syncClientsToSheet(sheet, sampleClients);
    console.log('Sample data synced successfully');
    
    const fetchedClients = getClientsFromSheet(sheet);
    console.log('Fetched clients:', fetchedClients.length);
    
    return true;
    
  } catch (error) {
    console.error('Test failed:', error);
    return false;
  }
}
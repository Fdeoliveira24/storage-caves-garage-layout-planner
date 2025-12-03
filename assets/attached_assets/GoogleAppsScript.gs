/**
 * Storage Caves Client Database - Apps Script API
 * Handles sync between Client CMS and Google Sheets
 */

// Configuration
const SHEET_NAME = 'Sheet1'; // Change if you renamed your sheet
const HEADER_ROW = 1;

/**
 * Handle GET requests (fetch all clients)
 */
function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return createResponse(false, 'Sheet not found');
    }
    
    const data = sheet.getDataRange().getValues();
    
    // Skip header row
    if (data.length <= 1) {
      return createResponse(true, 'No clients found', []);
    }
    
    // Convert rows to client objects
    const clients = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Skip empty rows
      if (!row[0]) continue;
      
      clients.push({
        id: row[0],
        name: row[1],
        email: row[2],
        phone: row[3],
        unitPreference: row[4],
        followUpDate: row[5],
        notes: row[6],
        createdDate: row[7]
      });
    }
    
    return createResponse(true, 'Clients fetched successfully', clients);
    
  } catch (error) {
    return createResponse(false, 'Error fetching clients: ' + error.toString());
  }
}

/**
 * Handle POST requests (sync clients from CMS to Sheets)
 */
function doPost(e) {
  try {
    // Parse incoming data
    const postData = JSON.parse(e.postData.contents);
    const clients = postData.clients;
    
    if (!Array.isArray(clients)) {
      return createResponse(false, 'Invalid data format: clients must be an array');
    }
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return createResponse(false, 'Sheet not found');
    }
    
    // Clear existing data (except header)
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }
    
    // Add new data
    if (clients.length > 0) {
      const rows = clients.map(client => [
        client.id || '',
        client.name || '',
        client.email || '',
        client.phone || '',
        client.unitPreference || '',
        client.followUpDate || '',
        client.notes || '',
        client.createdDate || new Date().toISOString()
      ]);
      
      sheet.getRange(2, 1, rows.length, 8).setValues(rows);
    }
    
    return createResponse(true, `Successfully synced ${clients.length} client(s)`, {
      syncedCount: clients.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return createResponse(false, 'Error syncing clients: ' + error.toString());
  }
}

/**
 * Create standardized JSON response (CORS is handled by deployment settings)
 */
function createResponse(success, message, data = null) {
  const response = {
    success: success,
    message: message,
    timestamp: new Date().toISOString()
  };
  
  if (data !== null) {
    response.data = data;
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Test function - run this to verify setup
 */
function testSetup() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    Logger.log('ERROR: Sheet not found!');
    return;
  }
  
  Logger.log('✅ Sheet found: ' + sheet.getName());
  Logger.log('✅ Spreadsheet ID: ' + SpreadsheetApp.getActiveSpreadsheet().getId());
  Logger.log('✅ Current rows: ' + sheet.getLastRow());
  
  // Test adding sample data
  const testClient = [
    'test-123',
    'Test Client',
    'test@example.com',
    '(555) 123-4567',
    'fp-unit-a',
    '2025-12-15',
    'Test notes',
    new Date().toISOString()
  ];
  
  sheet.appendRow(testClient);
  Logger.log('✅ Test client added successfully!');
  Logger.log('✅ Setup complete - ready for deployment!');
}

/**
 * DEPLOYMENT INSTRUCTIONS:
 * 
 * 1. Copy this entire script to your Google Apps Script project
 * 2. Save the project
 * 3. Click "Deploy" > "New deployment"
 * 4. Choose type: "Web app"
 * 5. Set these settings:
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Click "Deploy"
 * 7. Copy the web app URL
 * 8. Paste the URL in your app's sync settings
 * 
 * Note: CORS headers are automatically handled by Google Apps Script 
 * when deployed as a web app with "Anyone" access.
 */
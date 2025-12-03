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
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      const errorResponse = {
        success: false,
        message: 'Sheet not found',
        timestamp: new Date().toISOString()
      };
      output.setContent(JSON.stringify(errorResponse));
      return output;
    }
    
    const data = sheet.getDataRange().getValues();
    
    // Skip header row
    if (data.length <= 1) {
      const response = {
        success: true,
        message: 'No clients found',
        data: [],
        timestamp: new Date().toISOString()
      };
      output.setContent(JSON.stringify(response));
      return output;
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
    
    const response = {
      success: true,
      message: 'Clients fetched successfully',
      data: clients,
      timestamp: new Date().toISOString()
    };
    output.setContent(JSON.stringify(response));
    return output;
    
  } catch (error) {
    const errorResponse = {
      success: false,
      message: 'Error fetching clients: ' + error.toString(),
      timestamp: new Date().toISOString()
    };
    output.setContent(JSON.stringify(errorResponse));
    return output;
  }
}

/**
 * Handle POST requests (sync clients from CMS to Sheets)
 */
function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    // Parse incoming data
    const postData = JSON.parse(e.postData.contents);
    const clients = postData.clients;
    
    if (!Array.isArray(clients)) {
      const errorResponse = {
        success: false,
        message: 'Invalid data format: clients must be an array',
        timestamp: new Date().toISOString()
      };
      output.setContent(JSON.stringify(errorResponse));
      return output;
    }
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      const errorResponse = {
        success: false,
        message: 'Sheet not found',
        timestamp: new Date().toISOString()
      };
      output.setContent(JSON.stringify(errorResponse));
      return output;
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
    
    const response = {
      success: true,
      message: `Successfully synced ${clients.length} client(s)`,
      data: {
        syncedCount: clients.length,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };
    output.setContent(JSON.stringify(response));
    return output;
    
  } catch (error) {
    const errorResponse = {
      success: false,
      message: 'Error syncing clients: ' + error.toString(),
      timestamp: new Date().toISOString()
    };
    output.setContent(JSON.stringify(errorResponse));
    return output;
  }
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
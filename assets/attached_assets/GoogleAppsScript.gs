/**
 * Storage Caves Client Database - Apps Script API (CORS FIX VERSION)
 * Handles sync between Client CMS and Google Sheets
 * 
 * CORS FIX: Uses GET requests with URL parameters to avoid preflight
 */

// Configuration
const SHEET_NAME = 'Buford'; // Your sheet name

/**
 * Get the correct sheet
 */
function findSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Log all available sheets for debugging
  const sheets = ss.getSheets();
  Logger.log(`Available sheets: ${sheets.map(s => s.getName()).join(', ')}`);
  
  // Try exact name first
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (sheet) {
    Logger.log(`Found exact match: ${SHEET_NAME}`);
    return sheet;
  }
  
  // Try other common names
  const possibleNames = ['Sheet1', 'Clients', 'Data'];
  for (const name of possibleNames) {
    sheet = ss.getSheetByName(name);
    if (sheet) {
      Logger.log(`Found alternative sheet: ${name}`);
      return sheet;
    }
  }
  
  // Use first sheet as fallback
  if (sheets.length > 0) {
    Logger.log(`Using first sheet as fallback: ${sheets[0].getName()}`);
    return sheets[0];
  }
  
  Logger.log('ERROR: No sheets found at all!');
  return null;
}

/**
 * Handle ALL requests (GET only to avoid CORS preflight)
 */
function doGet(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const action = e.parameter.action || 'fetch';
    
    if (action === 'sync') {
      return handleSync(e, output);
    } else if (action === 'fetch') {
      return handleFetch(e, output);
    } else {
      const errorResponse = {
        success: false,
        message: 'Invalid action. Use action=sync or action=fetch',
        timestamp: new Date().toISOString()
      };
      output.setContent(JSON.stringify(errorResponse));
      return output;
    }
    
  } catch (error) {
    const errorResponse = {
      success: false,
      message: 'Error: ' + error.toString(),
      timestamp: new Date().toISOString()
    };
    output.setContent(JSON.stringify(errorResponse));
    return output;
  }
}

/**
 * Handle sync (write to sheet)
 */
function handleSync(e, output) {
  try {
    // Get data from URL parameter
    const dataParam = e.parameter.data;
    
    if (!dataParam) {
      const errorResponse = {
        success: false,
        message: 'No data provided. Use ?action=sync&data=...',
        timestamp: new Date().toISOString()
      };
      output.setContent(JSON.stringify(errorResponse));
      return output;
    }
    
    // Parse the data
    const clients = JSON.parse(decodeURIComponent(dataParam));
    
    if (!Array.isArray(clients)) {
      const errorResponse = {
        success: false,
        message: 'Invalid data format: clients must be an array',
        timestamp: new Date().toISOString()
      };
      output.setContent(JSON.stringify(errorResponse));
      return output;
    }
    
    const sheet = findSheet();
    
    if (!sheet) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheets = ss.getSheets();
      const errorResponse = {
        success: false,
        message: `Sheet not found. Tried: '${SHEET_NAME}', 'Sheet1', 'Clients', 'Data'. Available sheets: ${sheets.map(s => s.getName()).join(', ')}`,
        debug: {
          spreadsheetId: ss.getId(),
          spreadsheetName: ss.getName(),
          availableSheets: sheets.map(s => s.getName()),
          searchedFor: SHEET_NAME
        },
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
    
    // Add new data with enhanced unit preference handling
    if (clients.length > 0) {
      const rows = clients.map(client => {
        // Convert unit preference ID to user-friendly label if needed
        let unitDisplay = client.unitPreference || '';
        
        // Common unit ID to label mappings
        const unitMappings = {
          'fp-unit-a': 'Unit A (12×24)',
          'fp-unit-b': 'Unit B (12×30)', 
          'fp-unit-c': 'Unit C (14×30)',
          'fp-unit-d': 'Unit D (14×35)',
          'fp-unit-e': 'Unit E (16×35)',
          'fp-unit-f': 'Unit F (20×35)'
        };
        
        // Use mapped label if ID found, otherwise use original value
        if (unitMappings[unitDisplay]) {
          unitDisplay = unitMappings[unitDisplay];
        }
        
        return [
          client.id || '',
          client.name || '',
          client.email || '',
          client.phone || '',
          unitDisplay,
          client.followUpDate || '',
          client.notes || '',
          client.createdDate || new Date().toISOString()
        ];
      });
      
      sheet.getRange(2, 1, rows.length, 8).setValues(rows);
    }
    
    const response = {
      success: true,
      message: `Successfully synced ${clients.length} client(s)`,
      data: {
        syncedCount: clients.length,
        sheetName: sheet.getName()
      },
      timestamp: new Date().toISOString()
    };
    output.setContent(JSON.stringify(response));
    return output;
    
  } catch (error) {
    const errorResponse = {
      success: false,
      message: 'Sync error: ' + error.toString(),
      timestamp: new Date().toISOString()
    };
    output.setContent(JSON.stringify(errorResponse));
    return output;
  }
}

/**
 * Handle fetch (read from sheet)
 */
function handleFetch(e, output) {
  try {
    const sheet = findSheet();
    
    if (!sheet) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheets = ss.getSheets();
      const errorResponse = {
        success: false,
        message: `Sheet not found. Tried: '${SHEET_NAME}', 'Sheet1', 'Clients', 'Data'. Available sheets: ${sheets.map(s => s.getName()).join(', ')}`,
        debug: {
          spreadsheetId: ss.getId(),
          spreadsheetName: ss.getName(),
          availableSheets: sheets.map(s => s.getName()),
          searchedFor: SHEET_NAME
        },
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
      sheetName: sheet.getName(),
      timestamp: new Date().toISOString()
    };
    output.setContent(JSON.stringify(response));
    return output;
    
  } catch (error) {
    const errorResponse = {
      success: false,
      message: 'Fetch error: ' + error.toString(),
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('=== Google Sheets Debug Info ===');
  Logger.log('Spreadsheet ID: ' + ss.getId());
  Logger.log('Spreadsheet Name: ' + ss.getName());
  
  const sheets = ss.getSheets();
  Logger.log('Total sheets: ' + sheets.length);
  
  sheets.forEach((sheet, index) => {
    Logger.log(`Sheet ${index + 1}: "${sheet.getName()}" (${sheet.getLastRow()} rows)`);
  });
  
  const sheet = findSheet();
  
  if (!sheet) {
    Logger.log('❌ ERROR: No suitable sheet found!');
    Logger.log('Available sheets: ' + sheets.map(s => s.getName()).join(', '));
    return false;
  }
  
  Logger.log('✅ Using sheet: ' + sheet.getName());
  Logger.log('✅ Current rows: ' + sheet.getLastRow());
  
  // Test adding sample data
  const testClient = [
    'test-' + Date.now(),
    'Test Client',
    'test@example.com',
    '(555) 123-4567',
    'fp-unit-a',
    '2025-12-15',
    'Test notes',
    new Date().toISOString()
  ];
  
  try {
    sheet.appendRow(testClient);
    Logger.log('✅ Test client added successfully!');
    Logger.log('✅ Setup complete - ready for deployment!');
    return true;
  } catch (error) {
    Logger.log('❌ Error adding test data: ' + error.toString());
    return false;
  }
}

/**
 * Quick debug test - run this to check current sheet status
 */
function debugSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('=== DEBUG SHEET INFO ===');
  Logger.log('Spreadsheet ID: ' + ss.getId());
  Logger.log('Spreadsheet Name: ' + ss.getName());
  Logger.log('SHEET_NAME constant: ' + SHEET_NAME);
  
  const sheets = ss.getSheets();
  Logger.log('Total sheets: ' + sheets.length);
  
  sheets.forEach((sheet, index) => {
    Logger.log(`Sheet ${index + 1}: "${sheet.getName()}" (${sheet.getLastRow()} rows)`);
    Logger.log(`  - Exact match with SHEET_NAME: ${sheet.getName() === SHEET_NAME}`);
  });
  
  const foundSheet = findSheet();
  if (foundSheet) {
    Logger.log('✅ findSheet() found: ' + foundSheet.getName());
  } else {
    Logger.log('❌ findSheet() returned null');
  }
}
function testAPI() {
  Logger.log('=== Testing API Functions ===');
  
  // Test fetch
  Logger.log('\n--- Testing Fetch ---');
  const fetchResult = doGet({ parameter: { action: 'fetch' } });
  Logger.log('Fetch result: ' + fetchResult.getContent());
  
  // Test sync with sample data
  Logger.log('\n--- Testing Sync ---');
  const sampleClients = [
    {
      id: 'test-api-1',
      name: 'API Test Client',
      email: 'api@test.com',
      phone: '(555) 999-8888',
      unitPreference: 'fp-unit-a',
      followUpDate: '2025-12-10',
      notes: 'API test',
      createdDate: new Date().toISOString()
    }
  ];
  
  const dataParam = encodeURIComponent(JSON.stringify(sampleClients));
  const syncResult = doGet({ parameter: { action: 'sync', data: dataParam } });
  Logger.log('Sync result: ' + syncResult.getContent());
  
  Logger.log('\n✅ API test complete!');
}

/**
 * DEPLOYMENT INSTRUCTIONS:
 * 
 * 1. Replace the old script with this new version
 * 2. Save the project (Ctrl+S)
 * 3. Run testAPI() to verify it works
 * 4. Click "Deploy" > "New deployment"
 * 5. Choose type: "Web app"
 * 6. Settings:
 *    - Description: "Storage Caves Client Sync - CORS Fix v2"
 *    - Execute as: Me (your-email@gmail.com)
 *    - Who has access: Anyone
 * 7. Click "Deploy"
 * 8. Copy the new web app URL
 * 9. Update GoogleSheetsSync.js with the new URL
 * 
 * IMPORTANT: Make sure you create a NEW deployment, not a test deployment!
 */
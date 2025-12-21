# Client Management System (CMS) - User Guide

## Overview

The Client CMS allows you to manage client information and track which clients are interested in or assigned to specific storage unit layouts.

## Features

### 1. **Add New Client**

Click "New Client" button to add a client with:

- Name (required)
- Email (validated and sanitized)
- Phone (sanitized for safety)
- Unit Preference (dropdown of available units)
- Follow-up Date (cannot be in the past for new clients)
- Notes

### 2. **Search & Filter**

Type in the search box to filter clients by:

- Name
- Email
- Phone number
- Unit preference
- Notes content

The search is **case-insensitive** and searches across all fields simultaneously.

### 3. **View Client Details**

Click the eye icon (👁️) to view:

- Full client information
- Assigned layouts count
- All contact details
- Notes

### 4. **Edit Client**

Click the edit icon (✏️) to modify client information.

- When editing, past dates ARE allowed for follow-up dates
- All fields are pre-filled with current values

### 5. **Assign to Layout** 🔗

**What it does:**

- Links the client to the currently active/saved layout
- Tracks which clients are interested in which unit configurations
- Prevents duplicate assignments (shows info message if already assigned)
- Displays assignment count in client details view

**How to use:**

1. Create or load a layout in the main app
2. Save the layout (this creates a layout ID)
3. Open Client Management panel
4. Click the link icon (🔗) next to the client you want to assign
5. Success message will show: "✓ Assigned 'Client Name' to Layout Name"

**Use cases:**

- Track which clients are interested in specific storage unit sizes
- Associate multiple clients with the same layout
- Assign the same client to multiple layouts (for comparison)
- Generate reports on unit popularity based on client assignments

### 6. **Delete Client**

Click the trash icon (🗑️) to permanently delete a client.

- Confirmation dialog will appear
- Action cannot be undone

### 7. **Import/Export**

#### Import

- **Import JSON**: Import clients from a JSON file (previous exports)
- **Import CSV**: Import clients from a CSV file
  - Required columns: name, email, phone, unitPreference, notes, followUpDate
  - Name column is required, others are optional

#### Export

- **Export JSON**: Export all clients to JSON format (preserves all data including IDs and assignment history)
- **Export CSV**: Export all clients to CSV format (for use in Excel/Google Sheets)

## Security Features

### XSS Protection

- All user input is HTML-escaped before display
- Email addresses are sanitized (only valid characters allowed)
- Phone numbers are sanitized (only numbers, spaces, dashes, parentheses, plus signs)

### Validation

- Email format validation
- Name is required
- Follow-up dates for new clients cannot be in the past
- Past dates allowed when editing existing clients

## Color Scheme

The Client CMS uses **Storage Caves brand colors**:

- Primary: Red (#E74C3C)
- Text: Dark Graphite (#1A1A1A)
- Accents: Gray tones matching the main app

## Technical Details

### Storage

- Client data is stored in browser localStorage
- Storage key: `storage-caves-clients`
- Auto-saves on every change
- Data persists across browser sessions

### Layout Assignment

- Layout IDs are tracked in the client's `layoutIds` array
- When a client is assigned to a layout, the layout ID is added to this array
- The system prevents duplicate assignments
- EventBus emits `client:assigned` event for other features to listen

### Search Algorithm

- Searches across: name, email, phone, unitPreference, notes
- Case-insensitive
- Real-time filtering (updates as you type)
- Shows "No clients yet" when no matches found

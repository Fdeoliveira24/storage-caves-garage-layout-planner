# 🔍 Modal Debug Guide - Mobile Double Modal Issue

## Problem
On mobile devices, clicking the project name to rename it shows TWO modal prompts instead of one.
The desktop version works correctly after the fix.

## Debug Tools Added

### 1. Console Logging in Modal.js
Added comprehensive logging to track:
- When `showPrompt()` is called (with stack trace)
- When a prompt is blocked by the guard
- When a prompt closes and clears the guard flag

### 2. Console Logging in App.js (Desktop Handler)
Tracks when the desktop rename button is clicked.

### 3. Console Logging in MobileUIManager.js (Mobile Handler)
Tracks when the mobile project name is clicked.

### 4. Test Page
Created `test-modal-debug.html` to simulate the issue in isolation.

## How to Debug

### On Mobile Device:
1. Open the app on your phone
2. Open Chrome DevTools (inspect mode)
3. Go to Console tab
4. Click the project name to rename it
5. Watch the console output

### What to Look For:

**Expected Output (Working):**
```
[MobileUI] 📱 Mobile project name clicked
[MobileUI] Stack trace: ...
[Modal] showPrompt called with title: Rename Layout
[Modal] ✓ Opening prompt: Rename Layout
[MobileUI] Prompt returned value: <name>
[Modal] Closing prompt, value: <name>
[Modal] ✓ Prompt closed, guard flag cleared
```

**Problem Output (Double Modal):**
```
[MobileUI] 📱 Mobile project name clicked
[Modal] showPrompt called with title: Rename Layout
[Modal] ✓ Opening prompt: Rename Layout

[App] 🖥️ Desktop rename button clicked   <-- THIS SHOULD NOT APPEAR!
[Modal] showPrompt called with title: Rename Project
[Modal] ⚠️ BLOCKED: Prompt already open   <-- Guard working, but why called?
```

OR:

```
[MobileUI] 📱 Mobile project name clicked
[Modal] showPrompt called with title: Rename Layout
[Modal] ✓ Opening prompt: Rename Layout
[Modal] Closing prompt, value: <name>
[Modal] ✓ Prompt closed, guard flag cleared

[Modal] showPrompt called with title: Rename Layout  <-- CALLED AGAIN!
[Modal] ✓ Opening prompt: Rename Layout
```

## Possible Causes

### 1. **Event Bubbling**
The mobile click might be bubbling up to trigger the desktop button.
- **Check:** Look for `[App] 🖥️ Desktop rename button clicked` in console
- **Fix:** Add `e.stopPropagation()` in mobile handler

### 2. **Double Event Listener**
The mobile handler might be attached twice.
- **Check:** Count how many times `[MobileUI] 📱 Mobile project name clicked` appears
- **Fix:** Ensure `setupProjectName()` is only called once

### 3. **Desktop Element Visible on Mobile**
The desktop rename button might still be clickable despite being "hidden".
- **Check:** Inspect elements and verify `.header` has `display: none`
- **Fix:** Ensure CSS properly hides desktop elements

### 4. **State Change Trigger**
Setting the state might trigger another prompt.
- **Check:** Look for timing between `this.state.set` and second prompt
- **Fix:** Remove event listeners from state changes

### 5. **Modal Not Clearing Properly**
The guard flag might not be clearing between calls.
- **Check:** Look for "Prompt closed, guard flag cleared" messages
- **Fix:** Already added, should work

## Quick Fix Commands

Copy and paste in console to test theories:

```javascript
// Check if desktop button is hidden
console.log('Desktop button display:', getComputedStyle(document.querySelector('.header')).display);

// Check for multiple event listeners
console.log('Mobile name element:', document.getElementById('mobile-project-name'));

// Check guard flag status
console.log('Guard flag:', Modal._currentPrompt);

// Monitor all clicks
document.body.addEventListener('click', (e) => {
  console.log('CLICK on:', e.target.tagName, e.target.className, e.target.id);
}, true);
```

## Next Steps

1. **Open mobile app with DevTools**
2. **Click project name to rename**
3. **Copy console output and send it to me**
4. **I'll identify the exact cause and fix it**

The console logs will show us exactly where the second modal call is coming from!

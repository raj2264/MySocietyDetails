# Visitor Approval System Implementation Guide

This document describes the implementation of the resident approval flow for visitors in the MySociety App.

## Overview

The new visitor approval system supports two different visitor approval workflows:

1. **Pre-approved visitors**
   - Added by residents in advance through the resident app
   - Have access codes and can check in immediately
   - Don't require additional approval

2. **Guard-entered visitors**
   - Added by guards when visitors arrive
   - Always require resident approval before check-in
   - Guards can search for residents by name when adding visitors
   - Access codes are not shown to guards until resident approval

3. **Repeat visitors**
   - Visitors who have previously visited the same resident and were approved
   - Are automatically approved on subsequent visits only when added by residents
   - This applies only to resident-added visitors, not guard-entered ones

## Database Changes

The implementation adds the following to the `visitors` table:
- `approval_status` - Tracks the approval state ('pending', 'approved', 'rejected')
- `is_checked_in` - Boolean flag to track check-in status more efficiently

## Setup Instructions

### Database Migration

1. Run the migration script to apply the database changes:

```bash
npm run db:migrate
```

This will:
- Create the necessary SQL function for migrations
- Add the required columns to the visitors table
- Create database triggers for notifications

### Components Modified

1. **GuardDashboardScreen.js**
   - Added resident search and selection
   - Updated the visitor registration form to require approval
   - Modified check-in process to respect approval status
   - Improved UI with helper text explaining approval workflows
   - Removed access code from success message for pending visitors

2. **VisitorCard.js**
   - Added approve/reject buttons for pending visitors
   - Updated status display to show pending/rejected states
   - Modified sharing and view pass behaviors based on approval status

3. **VisitorsScreen.js**
   - Added handler for approval status changes
   - Implemented auto-approval for other pending visits by the same visitor

4. **VisitorForm.js**
   - Updated to explicitly set visitors added by residents as pre-approved

## Flow Description

### Pre-approved Visitor Flow (Resident App)
1. Resident adds a visitor through the app
2. Visitor is automatically marked as 'approved'
3. Resident shares access code with visitor
4. Visitor presents access code to guard for check-in
5. Guard verifies code and checks visitor in immediately

### Guard-entered Visitor Flow
1. Guard selects "Manual Entry" on the dashboard
2. Guard enters visitor details and can search for a resident
3. Guard submits the visitor for approval
4. For all guard-entered visitors:
   - The visitor is added with "pending" approval status
   - The resident receives a notification requesting approval
   - The visitor cannot check in until approved
   - Access code is not shown to the guard

### Repeat Visitor Auto-approval (Resident App Only)
1. When a visitor is added by a resident who has previously been approved
2. Other pending visits by the same visitor are auto-approved
3. This applies only to visitors added through the resident app, not guard-entered visitors

### Resident Approval Process
1. Resident opens the Visitors section in the app
2. Pending visitors display "Pending Approval" status
3. Approve/reject buttons are shown for pending visitors
4. Approval updates the status and notifies the guard
5. Rejection blocks the visitor from checking in

### Check-in Process
1. Guard scans or enters the visitor's access code
2. System verifies:
   - Code is valid and not expired
   - Visitor approval status:
     - Pre-approved visitors (added by residents) can check in immediately
     - Pending visitors must wait for approval
     - Rejected visitors cannot check in
3. If approved, check-in proceeds
4. If pending or rejected, appropriate message is shown

## Testing

1. Test both approval workflows:
   - Pre-approved visitor flow (added by resident)
   - Guard-entered visitor flow (all require approval)
2. Test the guard's manual entry with and without resident selection
3. Verify the unit number auto-fills correctly when selecting a resident
4. Test the resident approval process (approve and reject)
5. Verify that only approved visitors can check in
6. Verify that guards cannot see access codes for pending visitors
7. Test edge cases:
   - Expired codes
   - Already checked-in visitors
   - Rejected visitors attempting check-in 
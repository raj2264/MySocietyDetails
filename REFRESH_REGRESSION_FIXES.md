# Pull-to-Refresh Regression Fixes

## Problem
When users pulled down to refresh on any screen with RefreshControl, it triggered the global 12s spinner timeout on the main loading state, causing the full-screen ActivityIndicator spinner to show for 12 seconds even though the RefreshControl component was already displaying its own refresh spinner.

## Root Cause
The `loadData()` functions on refresh-enabled screens were calling `setLoading(true)` when user initiated a refresh. This state change triggered the `useNoStuckLoading` hook's 12-second timeout, creating an unintended spinner display over the RefreshControl spinner.

## Solution
Applied **isRefresh parameter pattern** to 5 critical high-traffic screens:

### 1. **PaymentsScreen.js**
- Modified `loadPayments(isRefresh = false)` to conditionally manage loading state
- Only calls `setLoading()` when NOT refreshing (initial load)
- `onRefresh()` now calls `loadPayments(true)` to preserve RefreshControl behavior

### 2. **ComplaintsScreen.js**  
- Modified `fetchComplaints(isRefresh = false)` with same pattern
- Error early-returns only clear loading if NOT refreshing
- `handleRefresh()` now passes `true` parameter

### 3. **NotificationsScreen.js**
- Modified `loadNotifications(isRefresh = false)`
- `useFocusEffect` calls with `false` (default)
- `handleRefresh()` calls with `true`

### 4. **AnnouncementsScreen.js**
- Modified `fetchAnnouncements(isRefresh = false)`
- Respects isRefresh parameter for all loading state changes
- Polling still works normally

### 5. **Previously Fixed**
- **VisitorsScreen.js** ✓
- **MyBookingsScreen.js** ✓

## Pattern Applied
```javascript
// Before (causes regression)
const loadData = async () => {
  try {
    setLoading(true);  // ← Triggers 12s timeout unnecessarily
    // ... fetch
  } finally {
    setLoading(false);
  }
};

const handleRefresh = () => {
  setRefreshing(true);
  loadData();  // ← Calls setLoading(true), timeout fires
  setRefreshing(false);
};
```

```javascript
// After (fixed)
const loadData = async (isRefresh = false) => {
  try {
    if (!isRefresh) {
      setLoading(true);  // Only set on initial load
    }
    // ... fetch
  } finally {
    if (!isRefresh) {
      setLoading(false);  // Only manage on initial load
    }
    setRefreshing(false);  // RefreshControl always clears its state
  }
};

const handleRefresh = () => {
  setRefreshing(true);
  loadData(true);  // ← Passes true, skips loading state changes
  setRefreshing(false);
};
```

## Remaining Screens to Fix (11 screens)
Still using old pattern and will show 12s spinner on pull-to-refresh:
- app/ev-charging.js
- screens/ApartmentListingsScreen.js
- screens/BillsScreen.js (has built-in `showLoader` pattern - may not need fix)
- screens/CARequestScreen.js
- screens/GuardDashboardScreen.js
- screens/GuardProfileScreen.js
- screens/GuardVisitorsScreen.js
- screens/MeetingsScreen.js
- screens/PollsScreen.js
- screens/SecurityContactsScreen.js
- screens/ServicesScreen.js

## Testing Checklist
- [ ] Pull-to-refresh on all 5 fixed screens shows RefreshControl spinner only (no full-screen spinner)
- [ ] Initial screen loads still show full-screen spinner during load
- [ ] Refresh data successfully updates without timeout interference
- [ ] No regression in animation timing
- [ ] No additional fullscreen spinners appearing unintentionally

## Files Modified
- `screens/PaymentsScreen.js` - loadPayments() + onRefresh()
- `screens/ComplaintsScreen.js` - fetchComplaints() + handleRefresh() + useFocusEffect()
- `screens/NotificationsScreen.js` - loadNotifications() + handleRefresh() + useFocusEffect()
- `screens/AnnouncementsScreen.js` - fetchAnnouncements() + handleRefresh() + useFocusEffect()

## Implementation Date
Applied as continuation of spinner timeout protection rollout

## Related Fixes
- Global auth loading timeout: 10s (AuthContext.js)
- Screen-level loading timeout: 12s (useNoStuckLoading hook)
- Background resident data recovery (AuthContext.js effect)

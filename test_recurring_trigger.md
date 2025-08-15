# Recurring Events Trigger Logic Test

## How the Event-Driven Maintenance Works

The system now uses **precise end datetime comparison** instead of simple date matching.

### Trigger Logic:
1. **End DateTime Calculation**: 
   - If event has `end_date` and `end_time`: Uses `end_date T end_time:00`
   - If event has only `end_date`: Uses `end_date T 23:59:00` 
   - If event has only `end_time`: Uses `start_date T end_time:00`
   - If neither: Uses `start_date T 23:59:00`

2. **Expiry Check**: 
   - Compares calculated end datetime with current server time
   - If `calculated_end_datetime <= NOW()` then event is expired

3. **Maintenance Trigger**:
   - When an expired recurring event is detected, it triggers series maintenance
   - New events are generated to maintain 4 weeks ahead
   - Only triggers once per series to avoid duplicates

### Example:
- Recurring event: "2025-08-15" from "12:00" to "13:00" 
- End datetime: `2025-08-15T13:00:00`
- Current time: `2025-08-15T13:01:00`
- Status: **EXPIRED** → Triggers maintenance

### Test Scenarios:
- ✅ Event ends at 13:00, current time 13:01 → Maintenance triggered
- ❌ Event ends at 13:00, current time 12:59 → No maintenance
- ✅ All-day event on 2025-08-14, current time 2025-08-15 00:00:01 → Maintenance triggered

This ensures maintenance only happens when events actually finish, not at arbitrary scheduled times.
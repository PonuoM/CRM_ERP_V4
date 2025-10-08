# Implementation Summary: Customer Lifecycle Status Transitions and Do Dashboard

## Overview
This document summarizes the changes made to implement the customer lifecycle status transitions and Do dashboard functionality according to the detailed requirements provided.

## Changes Made

### 1. TelesaleDashboard.tsx
- Implemented proper Do dashboard logic with four categories:
  - Upcoming follow-ups (due within 2 days)
  - Expiring ownership (within 5 days)
  - Daily distribution customers (assigned today with no activity)
  - New customers (with no activity)
- Added badge counters for each category
- Improved filtering logic to work with the Do dashboard requirements
- Added helper functions to calculate days until expiration and check for customer activities

### 2. App.tsx
- Enhanced `handleLogCall` function to properly update customer lifecycle status:
  - Sets status to "FollowUp" when creating a follow-up appointment
  - Transitions from "New" to "Old" on first call without follow-up
- Enhanced `handleAddAppointment` function:
  - Sets customer lifecycle status to "FollowUp" when creating an appointment
- Enhanced `handleCompleteAppointment` function:
  - Properly transitions customer lifecycle status when all appointments are completed
  - Moves from "FollowUp" to "Old3Months" if customer has orders
  - Moves from "FollowUp" to "Old" if customer has no orders
- Removed followUpDate when all appointments are completed

### 3. CustomerDetailPage.tsx
- Fixed "Follow-up next time" display logic to only show when there are pending appointments
- Added visual checkmark indicator for completed appointments
- Improved appointment table to show status clearly

### 4. Database Schema (schema.sql)
- Added indexes for better query performance:
  - Customer lifecycle status
  - Customer ownership expiration
  - Customer assignment
  - Appointment dates and status
  - Activity timestamps

### 5. API (index.php)
- Added new `handle_do_dashboard` endpoint to efficiently fetch Do dashboard data
- Implemented proper filtering logic on the server side

### 6. API Services (api.ts)
- Added `listDoDashboard` function to fetch Do dashboard data

## Customer Lifecycle Status Transitions Implemented

### New Customer Flow
```
ลูกค้าใหม่ → (โทรแล้ว) ลูกค้าเก่า → (มีนัด) ลูกค้าติดตาม → (ขายได้) ลูกค้าเก่า 3 เดือน
```

### Old 3 Months Customer Flow
```
ลูกค้าเก่า 3 เดือน → (ขายได้อีก) ลูกค้าเก่า 3 เดือน
ลูกค้าเก่า 3 เดือน → (ไม่มีนัด + พ้น 90 วัน) ลูกค้าเก่า
ลูกค้าเก่า 3 เดือน → (มีนัด) ลูกค้าติดตาม
```

### Follow-up Customer Flow
```
ลูกค้าติดตาม → (ปิดนัด + ขายได้) ลูกค้าเก่า 3 เดือน
ลูกค้าติดตาม → (ปิดนัด + ไม่ขาย) ลูกค้าเก่า
ลูกค้าติดตาม → (ปิดนัดเก่า + ตั้งนัดใหม่) ลูกค้าติดตาม (ต่อ)
```

### Daily Distribution Customer Flow
```
ลูกค้าแจกรายวัน → (ขายได้) ลูกค้าเก่า 3 เดือน
ลูกค้าแจกรายวัน → (ไม่ขาย + ไม่มีนัด) ลูกค้าเก่า
ลูกค้าแจกรายวัน → (มีนัด) ลูกค้าติดตาม
```

## Do Dashboard Categories

1. **Upcoming Follow-ups** (นัดติดตามถึงกำหนด/ใกล้ถึง)
   - Entry: Follow-up with due_at ≤ today+2 days
   - Exit: Appointment closed (completed/cancelled/postponed)
   - Sorting: Overdue → Today → Tomorrow → In 2 days

2. **Expiring Ownership** (สิทธิ์ดูแลใกล้หมดอายุ)
   - Entry: assignment.expire_at within 5 days
   - Exit: Successfully renewed (sold → reset to 90 days or first appointment of cycle → +90 days)
   - Sorting: expire_at nearest first, with Grade tie-breaker

3. **Daily Distribution** (ลูกค้าแจกรายวัน)
   - Entry: Distributed today with no activity
   - Exit: Any first activity (call/result/appointment/order)
   - Sorting: Latest assigned first, with Grade tie-breaker

4. **New Customers** (ลูกค้าใหม่)
   - Entry: First assigned with no activity
   - Exit: Any first activity (call/appointment/order)
   - Sorting: Latest assigned first, with Grade tie-breaker

## Priority Rules
1. Upcoming Follow-ups (Overdue→Soon)
2. Expiring Ownership
3. Daily Distribution
4. New Customers

## Quick Actions Implemented
- Call button → Opens call log modal
- Create appointment → Opens appointment modal
- Create order → Opens order creation form
- Postpone/Close appointment (for appointment category)

## Auto-refresh
The Do dashboard will automatically refresh every 60 seconds to ensure real-time updates.

## Data Points Used
- followups(due_at, status)
- assignments(expire_at, first_followup_bonus_used)
- distribution_logs (for daily distribution today)
- activity_logs (call_log_created, followup_created, order_created) since assignment
- customer_metrics(grade, heat_status)
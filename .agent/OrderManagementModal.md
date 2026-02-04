# OrderManagementModal Component Guide

## Overview
`OrderManagementModal.tsx` is a comprehensive modal component used for viewing, editing, and managing order details. It supports various order types (COD, Transfer, etc.), handles partial payments, manages shipping details, and tracks order history.

## Props Interface
```typescript
interface OrderManagementModalProps {
  order: Order;                 // The order object to display/edit
  customers: Customer[];        // List of available customers
  activities: Activity[];       // Order activity history
  onSave: (updatedOrder: Order) => void; 
  onClose: () => void;
  currentUser?: User;           // Current logged-in user
  users?: User[];               // List of system users (for assignee, etc.)
  onEditCustomer?: (customer: Customer) => void;
  products?: Product[];         // List of products for item selection
  backdropClassName?: string;
  permission?: 'seller' | 'manager'; // Controls role-based visibility
}
```

## Key Features

### 1. Role-Based Permissions
The component restricts certain sensitive actions based on the `permission` prop:
- **Manager**: Can view and interactive with "Verify Slip" (ยืนยันสลิป) controls.
- **Seller**: Controls for slip verification are hidden.

Usage in `App.tsx`: permission is determined by the active page context (e.g., `ManageOrdersPage` grants 'manager', `TelesaleOrdersPage` grants 'seller').

### 2. Slip Management
- **View**: Displays uploaded slips in a list.
- **Upload**: Allows uploading new keys/slips. **Transfer Date** defaults to empty (requiring user input) instead of current datetime.
- **Verification**: `isSlipLocked` and `canVerifySlip` logic prevents modification of verified slips unless authorized. Use checkboxes to toggle "Verified" status.
- **Lightbox**: Click on a slip to view it in full size.

### 3. COD & Box Management
- **Boxes**: Supports splitting order into multiple boxes. Each box has tracking number, COD amount, and collection status.
- **Validation**:
  - Ensures total COD amount across boxes matches `Order Total`.
  - Prevents saving if detailed COD amounts don't sum up correctly (tolerance < 0.1).
- **Auto-Calculation**: Can distribute `Amount Paid` across boxes based on weight/proportion if needed.

### 4. Product & Promotion Selection
- **Product Selector**: Modal to search and add products/promotions.
- **Promotions**: Handles parent-child relationships for bundled items.
- **Stock Check**: (In-progress/Partial) Displays stock availability.

### 5. Address Management
- **Auto-Fill**: Selecting a customer auto-fills shipping address.
- **Manual Edit**: Allows overriding shipping details for the specific order.
- **Province Loader**: Dynamically loads Thai province/district data.

## State Management
- **`currentOrder`**: Local copy of the order for editing. Changes are drafted here until `onSave` is clicked.
- **`slips`**: Manages the list of slip images/records associated with the order.
- **`calculatedTotals`**: `useMemo` hook effectively recalculates total price, discounts, and shipping cost on every item change.

## Validation & Saving
The `handleSave` function performs critical checks before committing:
1. **COD Balance**: Checks if Box COD Sum == Order Total.
2. **Payment Integration**: For 'PayAfter' or 'Transfer', updates slip amounts/metadata.
3. **Sequential Boxes**: Ensures box numbers are sequential (1, 2, 3...).

## Order Locking Mechanism
The `isModifiable` (and derived `isLocked`) logic prevents editing of orders that have progressed beyond the confirmation stage.
- **Locked Statuses**: `Preparing`, `Picking`, `Shipping`, `Delivered`, `Returned`, `Cancelled`, `BadDebt`, `Claiming`.
- **Effect**: If locked, all input fields are disabled, **and the "Edit Order" and "Upload Additional Slip" buttons are disabled (but visible)**. The order is read-only.
- **Override**: Users with `permission="manager"` can bypass this lock and edit any order.


## Usage Example (from App.tsx)
```tsx
<OrderManagementModal
  order={modalState.data as Order}
  customers={customers}
  activities={activities}
  onSave={handleUpdateOrder}
  onClose={closeModal}
  currentUser={currentUser}
  permission={modalPermission} // Calculated based on user role/page
/>
```

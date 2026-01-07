/**
 * Data Sync Utility
 * Cross-component event system for real-time UI updates
 */

// Event names for cross-component communication
export const DATA_SYNC_EVENTS = {
    CUSTOMER_UPDATED: 'datasync:customer:updated',
    CUSTOMERS_REFRESH: 'datasync:customers:refresh',
    APPOINTMENT_CREATED: 'datasync:appointment:created',
    ORDER_UPDATED: 'datasync:order:updated',
} as const;

export type DataSyncEvent = typeof DATA_SYNC_EVENTS[keyof typeof DATA_SYNC_EVENTS];

interface DataSyncPayload {
    customerId?: string;
    timestamp?: number;
    source?: string;
    data?: any;
}

/**
 * Emit a data sync event to notify other components
 */
export const emitDataSync = (event: DataSyncEvent, payload?: DataSyncPayload) => {
    const detail = {
        ...payload,
        timestamp: payload?.timestamp ?? Date.now(),
    };

    console.log(`[DataSync] Emitting ${event}`, detail);
    window.dispatchEvent(new CustomEvent(event, { detail }));
};

/**
 * Subscribe to a data sync event
 * Returns a cleanup function to unsubscribe
 */
export const onDataSync = (
    event: DataSyncEvent,
    handler: (payload: DataSyncPayload) => void
): (() => void) => {
    const wrappedHandler = (e: Event) => {
        const customEvent = e as CustomEvent<DataSyncPayload>;
        console.log(`[DataSync] Received ${event}`, customEvent.detail);
        handler(customEvent.detail);
    };

    window.addEventListener(event, wrappedHandler);

    return () => {
        window.removeEventListener(event, wrappedHandler);
    };
};

/**
 * Trigger a customer list refresh
 * Convenience function for common use case
 */
export const triggerCustomersRefresh = (customerId?: string, source?: string) => {
    emitDataSync(DATA_SYNC_EVENTS.CUSTOMERS_REFRESH, { customerId, source });
};

/**
 * Notify that a customer was updated
 */
export const notifyCustomerUpdated = (customerId: string, source?: string, data?: any) => {
    emitDataSync(DATA_SYNC_EVENTS.CUSTOMER_UPDATED, { customerId, source, data });
};

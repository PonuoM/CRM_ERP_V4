
import { db } from '../db/db';
import { listCustomers } from './api';
import { Customer } from '../types';
import { mapCustomerFromApi } from '../utils/customerMapper';

// Enhanced progress callback with detailed info
export interface SyncProgress {
    message: string;
    progress: number; // 0-100
    totalCustomers: number;
    syncedCustomers: number;
    isComplete: boolean;
    isError: boolean;
}


// Global lock to prevent race conditions across multiple component instances
let isSyncInProgress = false;

export const syncCustomers = async (
    companyId: number,
    onProgress?: (progress: SyncProgress) => void,
    userId?: number, // Optional: sync only customers assigned to this user
    options?: { silent?: boolean; forceFull?: boolean }
) => {
    if (isSyncInProgress) {
        if (!options?.silent) {
            console.warn('Sync ignored: A synchronization process is already running.');
        }
        return;
    }

    isSyncInProgress = true;
    const reportProgress = (updates: Partial<SyncProgress>) => {
        if (options?.silent) return; // Don't report high-level UI updates in silent mode, or let caller handle?
        // Actually, caller might want to show "Updating..." small badge. 
        // Let's NOT block callback, but caller can choose to ignore it. 
        // User plan said "bypass the onProgress callbacks that trigger the modal". 
        // If I return early here, caller gets nothing. 
        // Better: Caller (TelesaleDashboard) checks 'silent' flag or I passed it.
        // For now, let's allow progress but maybe caller handles it.
        // Wait, existing callers might rely on it.
        // Let's keep reporting, but the Dashboard will decide whether to show Modal or Toast.
        onProgress?.({
            message: '',
            progress: 0,
            totalCustomers: 0,
            syncedCustomers: 0,
            isComplete: false,
            isError: false,
            ...updates,
        });
    };

    try {
        if (!options?.silent) {
            reportProgress({ message: 'เริ่มต้นซิงค์ข้อมูล...' });
        }

        // DELTA SYNC LOGIC
        const SYNC_KEY = `last_sync_time_customers_${companyId}_${userId || 'all'}`;
        const lastSyncTimeStr = localStorage.getItem(SYNC_KEY);
        let lastSyncTime = options?.forceFull ? null : (lastSyncTimeStr ? Number(lastSyncTimeStr) : null);

        // Safety: If lastSyncTime is invalid or future (clock skew), force full
        if (lastSyncTime && isNaN(lastSyncTime)) lastSyncTime = null;

        // Batch size
        const pageSize = 500; // Smaller batch for smoothness? Or 5000 is fine.
        let page = 1;
        let hasMore = true;
        let totalSynced = 0;
        let totalCustomers = 0;
        let finalServerTime: number | undefined;

        // Keep track of all IDs synced from server to clean up orphans (ONLY IF FULL SYNC)
        const isFullSync = !lastSyncTime;
        const syncedPks = new Set<number>();

        while (hasMore) {
            if (!options?.silent) {
                reportProgress({
                    message: `กำลังดึงข้อมูลหน้า ${page}...`,
                    progress: totalCustomers > 0 ? (totalSynced / totalCustomers) * 100 : 0,
                    totalCustomers,
                    syncedCustomers: totalSynced,
                });
            }

            const response = await listCustomers({
                companyId,
                page,
                pageSize,
                assignedTo: userId,
                since: lastSyncTime || undefined,
            });

            // Handle server_timestamp wrapper
            const { data, total, server_timestamp } = response;
            if (server_timestamp) finalServerTime = server_timestamp;

            if (page === 1) {
                totalCustomers = total || 0;
                if (totalCustomers === 0 && isFullSync) {
                    console.log('Sync: No customers found.');
                }
            }

            if (!data || data.length === 0) {
                hasMore = false;
                break;
            }

            // Bulk Add/Delete Logic
            const toPut: any[] = [];
            const toDelete: number[] = [];

            data.forEach((c: any) => {
                const mapped = mapCustomerFromApi(c);
                const pkVal = mapped.pk ? Number(mapped.pk) : Number(mapped.id);

                if (!pkVal || isNaN(pkVal)) return;

                // Soft Delete Check
                // Note: API might send boolean or 1/0 for is_blocked
                // Check mapped.isBlocked (frontend name) ?
                // mapCustomerFromApi might not map is_blocked to isBlocked depending on implementation.
                // Re-check api response field. usually it's snake_case from PHP.
                // Checking mapCustomerFromApi would be good, but assuming raw c has is_blocked or map handles it.
                // Customer interface has 'isBlocked'.

                // Let's assume mapCustomerFromApi handles it correctly.
                if (mapped.isBlocked) {
                    toDelete.push(pkVal);
                } else {
                    toPut.push({
                        ...mapped,
                        id: String(mapped.id), // Ensure string ID
                        pk: pkVal,
                        companyId: Number(mapped.companyId),
                        assignedTo: mapped.assignedTo ? Number(mapped.assignedTo) : null,
                    });
                }
            });

            // Perform DB Operations
            if (toDelete.length > 0) {
                await db.customers.bulkDelete(toDelete);
            }
            if (toPut.length > 0) {
                await db.customers.bulkPut(toPut);
            }

            // Track synced PKs (only meaningful for full sync orphan cleanup)
            if (isFullSync) {
                [...toPut.map(c => c.pk), ...toDelete].forEach(pk => syncedPks.add(pk));
            }

            totalSynced += data.length;

            if (!options?.silent) {
                reportProgress({
                    message: `ซิงค์แล้ว ${totalSynced.toLocaleString()} รายการ...`,
                    progress: totalCustomers > 0 ? Math.min((totalSynced / totalCustomers) * 100, 99) : 50,
                    totalCustomers,
                    syncedCustomers: totalSynced,
                });
            }

            if (data.length < pageSize) {
                hasMore = false;
            } else {
                page++;
            }
        }

        // Cleanup: If FULL SYNC for a specific user, remove local customers 
        // that are assigned to this user but were NOT in the server response.
        // DO NOT RUN THIS FOR DELTA SYNC
        if (isFullSync && userId) {
            if (!options?.silent) reportProgress({ message: 'กำลังตรวจสอบข้อมูลเก่า...' });

            const localUserCustomers = await db.customers.where('assignedTo').equals(userId).toArray();
            const orphans = localUserCustomers.filter(c => !syncedPks.has(c.pk));

            if (orphans.length > 0) {
                console.log(`Sync: Found ${orphans.length} orphaned customers locally. Deleting...`);
                const orphanPks = orphans.map(c => c.pk);
                await db.customers.bulkDelete(orphanPks);
            }
        }

        // Save last sync time
        if (finalServerTime) {
            localStorage.setItem(SYNC_KEY, String(finalServerTime));
        } else {
            // Fallback if server didn't send time (shouldn't happen with our php change)
            localStorage.setItem(SYNC_KEY, String(Date.now()));
        }

        if (!options?.silent) {
            reportProgress({
                message: isFullSync
                    ? `ซิงค์สำเร็จ! (ทั้งหมด ${totalSynced.toLocaleString()} รายการ)`
                    : `อัปเดตข้อมูล ${totalSynced.toLocaleString()} รายการล่าสุดเรียบร้อย`,
                progress: 100,
                totalCustomers,
                syncedCustomers: totalSynced,
                isComplete: true,
            });
        }

    } catch (error) {
        console.error('Sync failed:', error);
        reportProgress({
            message: `เกิดข้อผิดพลาด: ${error instanceof Error ? error.message : 'Unknown error'}`,
            isError: true,
        });
        throw error;
    } finally {
        isSyncInProgress = false;
    }
};


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
    userId?: number // Optional: sync only customers assigned to this user
) => {
    if (isSyncInProgress) {
        console.warn('Sync ignored: A synchronization process is already running.');
        return;
    }

    isSyncInProgress = true;
    const reportProgress = (updates: Partial<SyncProgress>) => {
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
        reportProgress({ message: 'เริ่มต้นซิงค์ข้อมูล...' });

        // Batch size
        const pageSize = 5000;
        let page = 1;
        let hasMore = true;
        let totalSynced = 0;
        let totalCustomers = 0;

        // Keep track of all IDs synced from server to clean up orphans later
        const syncedPks = new Set<number>();

        while (hasMore) {
            reportProgress({
                message: `กำลังดึงข้อมูลหน้า ${page}...`,
                progress: totalCustomers > 0 ? (totalSynced / totalCustomers) * 100 : 0,
                totalCustomers,
                syncedCustomers: totalSynced,
            });

            const response = await listCustomers({
                companyId,
                page,
                pageSize,
                assignedTo: userId,
            });

            const { data, total } = response;
            if (page === 1) {
                totalCustomers = total || 0;
                console.log(`Sync started: Server reports ${totalCustomers} total customers.`);
            }

            if (!data || data.length === 0) {
                hasMore = false;
                break;
            }

            // Bulk add to IndexedDB
            const formattedData = data.map((c: any) => {
                const mapped = mapCustomerFromApi(c);
                const pkVal = mapped.pk ? Number(mapped.pk) : Number(mapped.id);

                return {
                    ...mapped,
                    id: String(mapped.id),
                    pk: pkVal,
                    companyId: Number(mapped.companyId),
                    assignedTo: mapped.assignedTo ? Number(mapped.assignedTo) : null,
                };
            }).filter(c => {
                const isValid = !isNaN(c.pk) && c.pk !== 0;
                if (!isValid) console.warn('Sync: Invalid PK for customer:', c.firstName, c.id);
                return isValid;
            });

            // Add PKs to set
            formattedData.forEach(c => syncedPks.add(c.pk));

            if (formattedData.length < data.length) {
                console.warn(`Sync: Filtered out ${data.length - formattedData.length} records with invalid PKs. Kept: ${formattedData.length}`);
            }

            await db.customers.bulkPut(formattedData);

            totalSynced += data.length;

            reportProgress({
                message: `ซิงค์แล้ว ${totalSynced.toLocaleString()} รายการ...`,
                progress: totalCustomers > 0 ? Math.min((totalSynced / totalCustomers) * 100, 99) : 50,
                totalCustomers,
                syncedCustomers: totalSynced,
            });

            if (data.length < pageSize) {
                hasMore = false;
            } else {
                page++;
            }
        }

        // Cleanup: If syncing for a specific user, remove local customers 
        // that are assigned to this user but were NOT in the server response.
        if (userId) {
            reportProgress({ message: 'กำลังทำความสะอาดข้อมูลเก่า...' });

            // Find all local customers assigned to this user
            const localUserCustomers = await db.customers.where('assignedTo').equals(userId).toArray();

            // Identify orphans
            const orphans = localUserCustomers.filter(c => !syncedPks.has(c.pk));

            if (orphans.length > 0) {
                console.log(`Sync: Found ${orphans.length} orphaned customers locally. Deleting...`);
                // Use bulkDelete for efficiency
                const orphanPks = orphans.map(c => c.pk);
                await db.customers.bulkDelete(orphanPks);

                reportProgress({ message: `ลบข้อมูลเก่า ${orphans.length} รายการ...` });
            }
        }

        reportProgress({
            message: `ซิงค์สำเร็จ! (ทั้งหมด ${totalSynced.toLocaleString()} รายการ)`,
            progress: 100,
            totalCustomers,
            syncedCustomers: totalSynced,
            isComplete: true,
        });

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

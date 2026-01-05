
import Dexie, { Table } from 'dexie';
import { Customer } from '../types';

export class CRMERPDatabase extends Dexie {
    customers!: Table<Customer, number>;

    constructor() {
        super('CRMERP_Client_Store'); // Renamed to force fresh creation

        // Version 1 of new DB with correct PK (pk)
        this.version(1).stores({
            customers: 'pk, customerId, customerRefId, id, firstName, lastName, phone, email, province, companyId, assignedTo, dateAssigned, dateRegistered, ownershipExpires, lifecycleStatus, behavioralStatus, grade, totalPurchases, totalCalls, last_call_date, upcoming_appointment_date, latest_order_date, latest_order_creator_id, [firstName+lastName], [assignedTo+lifecycleStatus]'
        });
    }
}

export const db = new CRMERPDatabase();

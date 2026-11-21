import { Customer, Product, Lorry, Order } from '../types';
import { LorryService, OrderService } from './api';

export interface QueuedOfflineBill {
  localId: string;
  orderNumber: string;
  lorryId?: string;
  payload: any;
  createdAt: string;
  customerName: string;
  totalAmount: number;
  itemsCount: number;
  paymentMethod: string;
  synced?: boolean;
  syncError?: string;
}

export interface CachedRepData {
  customers: Customer[];
  products: Product[];
  lorries: Lorry[];
  lorryStocks: Record<string, { stock: number; freeStock: number }>;
  cachedAt: string;
}

const STORAGE_KEYS = {
  PENDING_BILLS: 'distributor_offline_pending_bills',
  CACHE_DATA: 'distributor_offline_rep_cache',
  LAST_SYNC: 'distributor_offline_last_sync'
};

export const OfflineSyncService = {
  /**
   * Check if browser currently has active internet connection
   */
  isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  },

  /**
   * Cache critical billing data for offline use
   */
  cacheRepData(data: {
    customers: Customer[];
    products: Product[];
    lorries: Lorry[];
    lorryStockMap?: Map<string, { stock: number; freeStock: number }>;
  }): void {
    try {
      const lorryStocksRecord: Record<string, { stock: number; freeStock: number }> = {};
      if (data.lorryStockMap) {
        data.lorryStockMap.forEach((val, key) => {
          lorryStocksRecord[key] = val;
        });
      }

      const cache: CachedRepData = {
        customers: data.customers,
        products: data.products,
        lorries: data.lorries,
        lorryStocks: lorryStocksRecord,
        cachedAt: new Date().toISOString()
      };

      localStorage.setItem(STORAGE_KEYS.CACHE_DATA, JSON.stringify(cache));
    } catch (e) {
      console.warn('[OfflineSync] Failed to cache rep data in localStorage', e);
    }
  },

  /**
   * Load cached data when offline
   */
  getCachedRepData(): CachedRepData | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CACHE_DATA);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[OfflineSync] Failed to read cached rep data', e);
      return null;
    }
  },

  /**
   * Get all pending bills waiting to be synced
   */
  getPendingBills(): QueuedOfflineBill[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PENDING_BILLS);
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (e) {
      console.warn('[OfflineSync] Failed to read pending bills', e);
      return [];
    }
  },

  /**
   * Enqueue a new offline bill
   */
  saveOfflineBill(bill: QueuedOfflineBill): void {
    try {
      const existing = this.getPendingBills();
      existing.push(bill);
      localStorage.setItem(STORAGE_KEYS.PENDING_BILLS, JSON.stringify(existing));
    } catch (e) {
      console.error('[OfflineSync] Failed to save offline bill to localStorage', e);
    }
  },

  /**
   * Remove a synced bill from queue
   */
  removePendingBill(localId: string): void {
    try {
      const existing = this.getPendingBills();
      const filtered = existing.filter(b => b.localId !== localId);
      localStorage.setItem(STORAGE_KEYS.PENDING_BILLS, JSON.stringify(filtered));
    } catch (e) {
      console.error('[OfflineSync] Failed to remove pending bill', e);
    }
  },

  /**
   * Synchronize all pending offline bills with backend database
   */
  async syncAllPendingBills(
    onProgress?: (synced: number, total: number) => void
  ): Promise<{ success: boolean; syncedCount: number; errors: string[] }> {
    const pending = this.getPendingBills();
    if (pending.length === 0) {
      return { success: true, syncedCount: 0, errors: [] };
    }

    let syncedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < pending.length; i++) {
      const bill = pending[i];
      try {
        if (bill.lorryId) {
          await LorryService.enterDriverBill(bill.lorryId, bill.payload);
        } else {
          await OrderService.create(bill.payload);
        }

        // Successfully synced on server
        syncedCount++;
        this.removePendingBill(bill.localId);
        if (onProgress) {
          onProgress(syncedCount, pending.length);
        }
      } catch (err: any) {
        console.error(`[OfflineSync] Failed syncing bill ${bill.orderNumber}:`, err);
        const errMsg = err.response?.data?.error || err.message || 'Unknown network error';
        errors.push(`${bill.orderNumber}: ${errMsg}`);
        // If it's a persistent validation error (not network error), we record it on the bill
        bill.syncError = errMsg;
      }
    }

    // Save updated pending list if some had errors
    const remaining = this.getPendingBills();
    if (remaining.length > 0) {
      localStorage.setItem(STORAGE_KEYS.PENDING_BILLS, JSON.stringify(remaining));
    }

    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());

    return {
      success: errors.length === 0,
      syncedCount,
      errors
    };
  }
};


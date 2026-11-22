import { Customer, Product, Lorry, Order } from '../types';
import { LorryService, OrderService } from './api';
import { Network } from '@capacitor/network';

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

const INITIAL_OFFLINE_FALLBACK_DATA: CachedRepData = {
  cachedAt: new Date().toISOString(),
  customers: [
    {
      id: 'cust-1',
      code: 'CUST-001',
      name: 'Apex Supermart & Provisions',
      companyName: 'Apex Retail Ltd',
      phone: '+94 77 123 4567',
      deliveryAddress: '448 Galle Road, Colombo 03',
      city: 'Colombo',
      pricingTier: 'STANDARD',
      discountPercentage: 0,
      creditLimit: 75000,
      outstandingBalance: 12500,
      maxCreditInvoices: 3,
      latitude: 6.8961,
      longitude: 79.8576,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      creditRisk: {
        averageDaysToPay: 12,
        reliability: 'EXCELLENT',
        reliabilityLabel: 'Prompt Payer',
        isCreditBlocked: false,
        maxCreditDays: 30,
        aging: {
          current: 12500,
          days16to30: 0,
          days31to60: 0,
          over60: 0,
          totalOverdue: 0,
          oldestUnpaidDays: 8,
          unpaidBillsCount: 1
        }
      }
    },
    {
      id: 'cust-2',
      code: 'CUST-002',
      name: 'Grand Central Stores',
      companyName: 'Central Traders PLC',
      phone: '+94 71 889 2234',
      deliveryAddress: '12 Kandy Highway, Kadawatha',
      city: 'Kadawatha',
      pricingTier: 'WHOLESALE',
      discountPercentage: 3,
      creditLimit: 120000,
      outstandingBalance: 34000,
      maxCreditInvoices: 4,
      latitude: 7.0014,
      longitude: 79.9542,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      creditRisk: {
        averageDaysToPay: 18,
        reliability: 'GOOD',
        reliabilityLabel: 'Good Standing',
        isCreditBlocked: false,
        maxCreditDays: 30,
        aging: {
          current: 34000,
          days16to30: 0,
          days31to60: 0,
          over60: 0,
          totalOverdue: 0,
          oldestUnpaidDays: 14,
          unpaidBillsCount: 2
        }
      }
    },
    {
      id: 'cust-3',
      code: 'CUST-003',
      name: 'Sunil Grocery & Mart',
      companyName: 'Sunil Stores',
      phone: '+94 76 554 9912',
      deliveryAddress: '88 High Level Road, Nugegoda',
      city: 'Nugegoda',
      pricingTier: 'STANDARD',
      discountPercentage: 0,
      creditLimit: 50000,
      outstandingBalance: 0,
      maxCreditInvoices: 3,
      latitude: 6.8652,
      longitude: 79.8997,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      creditRisk: {
        averageDaysToPay: 7,
        reliability: 'EXCELLENT',
        reliabilityLabel: 'Prompt Payer',
        isCreditBlocked: false,
        maxCreditDays: 30,
        aging: {
          current: 0,
          days16to30: 0,
          days31to60: 0,
          over60: 0,
          totalOverdue: 0,
          oldestUnpaidDays: 0,
          unpaidBillsCount: 0
        }
      }
    }
  ],
  products: [
    {
      id: 'prod-1',
      sku: 'MCH-MAR-400',
      barcode: '4792024001',
      name: 'Munchee Marie Biscuits 400g',
      category: 'Biscuits',
      unit: 'PKT',
      unitPrice: 380,
      costPrice: 320,
      currentStock: 450,
      freeStock: 50,
      minStockAlert: 20,
      freeRatioBuy: 10,
      freeRatioGet: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod-2',
      sku: 'ANC-MLK-400',
      barcode: '4792024002',
      name: 'Anchor Full Cream Milk Powder 400g',
      category: 'Dairy',
      unit: 'PKT',
      unitPrice: 1150,
      costPrice: 980,
      currentStock: 280,
      freeStock: 25,
      minStockAlert: 15,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod-3',
      sku: 'WAT-TEA-200',
      barcode: '4792024003',
      name: 'Watawala Kahata Tea 200g',
      category: 'Beverages',
      unit: 'PKT',
      unitPrice: 420,
      costPrice: 360,
      currentStock: 350,
      freeStock: 30,
      minStockAlert: 20,
      freeRatioBuy: 10,
      freeRatioGet: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod-4',
      sku: 'SUN-SOP-110',
      barcode: '4792024004',
      name: 'Sunlight Lemon Soap 110g',
      category: 'Personal Care',
      unit: 'BAR',
      unitPrice: 160,
      costPrice: 135,
      currentStock: 600,
      freeStock: 60,
      minStockAlert: 30,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod-5',
      sku: 'MLB-LEMP-200',
      barcode: '4792024005',
      name: 'Maliban Lemon Puff 200g',
      category: 'Biscuits',
      unit: 'PKT',
      unitPrice: 260,
      costPrice: 215,
      currentStock: 300,
      freeStock: 30,
      minStockAlert: 15,
      freeRatioBuy: 12,
      freeRatioGet: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  lorries: [
    {
      id: 'lorry-1',
      vehicleNumber: 'WP ND-4589',
      driverName: 'Saman Kumara',
      driverPhone: '0773669913',
      routeId: 'route-1',
      status: 'ACTIVE',
      route: {
        id: 'route-1',
        code: 'RT-01',
        name: 'Route 1 - Kandy & Central Highway',
        description: 'Colombo to Kandy distribution highway'
      },
      lorryStocks: [
        {
          id: 'ls-1',
          lorryId: 'lorry-1',
          productId: 'prod-1',
          product: {
            id: 'prod-1',
            sku: 'MCH-MAR-400',
            name: 'Munchee Marie Biscuits 400g',
            category: 'Biscuits',
            unit: 'PKT',
            unitPrice: 380,
            costPrice: 320,
            currentStock: 450,
            freeStock: 50,
            minStockAlert: 20,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          quantity: 120,
          freeQuantity: 12,
          updatedAt: new Date().toISOString()
        },
        {
          id: 'ls-2',
          lorryId: 'lorry-1',
          productId: 'prod-2',
          product: {
            id: 'prod-2',
            sku: 'ANC-MLK-400',
            name: 'Anchor Full Cream Milk Powder 400g',
            category: 'Dairy',
            unit: 'PKT',
            unitPrice: 1150,
            costPrice: 980,
            currentStock: 280,
            freeStock: 25,
            minStockAlert: 15,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          quantity: 60,
          freeQuantity: 6,
          updatedAt: new Date().toISOString()
        },
        {
          id: 'ls-3',
          lorryId: 'lorry-1',
          productId: 'prod-3',
          product: {
            id: 'prod-3',
            sku: 'WAT-TEA-200',
            name: 'Watawala Kahata Tea 200g',
            category: 'Beverages',
            unit: 'PKT',
            unitPrice: 420,
            costPrice: 360,
            currentStock: 350,
            freeStock: 30,
            minStockAlert: 20,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          quantity: 80,
          freeQuantity: 8,
          updatedAt: new Date().toISOString()
        },
        {
          id: 'ls-4',
          lorryId: 'lorry-1',
          productId: 'prod-4',
          product: {
            id: 'prod-4',
            sku: 'SUN-SOP-110',
            name: 'Sunlight Lemon Soap 110g',
            category: 'Personal Care',
            unit: 'BAR',
            unitPrice: 160,
            costPrice: 135,
            currentStock: 600,
            freeStock: 60,
            minStockAlert: 30,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          quantity: 150,
          freeQuantity: 15,
          updatedAt: new Date().toISOString()
        },
        {
          id: 'ls-5',
          lorryId: 'lorry-1',
          productId: 'prod-5',
          product: {
            id: 'prod-5',
            sku: 'MLB-LEMP-200',
            name: 'Maliban Lemon Puff 200g',
            category: 'Biscuits',
            unit: 'PKT',
            unitPrice: 260,
            costPrice: 215,
            currentStock: 300,
            freeStock: 30,
            minStockAlert: 15,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          quantity: 90,
          freeQuantity: 9,
          updatedAt: new Date().toISOString()
        }
      ]
    }
  ],
  lorryStocks: {
    'prod-1': { stock: 120, freeStock: 12 },
    'prod-2': { stock: 60, freeStock: 6 },
    'prod-3': { stock: 80, freeStock: 8 },
    'prod-4': { stock: 150, freeStock: 15 },
    'prod-5': { stock: 90, freeStock: 9 }
  }
};

// Global mutex to prevent concurrent sync loops from running in parallel
let isGlobalSyncRunning = false;
const inFlightSyncIds = new Set<string>();

export const OfflineSyncService = {
  /**
   * Check if browser or native device currently has active internet connection
   */
  isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  },

  /**
   * Listen for network reconnection on Web, Electron, and Android via Capacitor Network
   * Debounced to prevent simultaneous dual-event triggers from window.online and Capacitor Network
   */
  initNetworkListener(onStatusChange: (connected: boolean) => void): () => void {
    let lastStatus: boolean | null = null;
    let debounceTimer: any = null;

    const dispatchStatus = (connected: boolean) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (lastStatus !== connected) {
          lastStatus = connected;
          onStatusChange(connected);
        }
      }, 350);
    };

    const handleOnline = () => dispatchStatus(true);
    const handleOffline = () => dispatchStatus(false);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    let removeCapacitorListener: (() => void) | null = null;
    try {
      Network.addListener('networkStatusChange', status => {
        dispatchStatus(status.connected);
      }).then(handle => {
        removeCapacitorListener = () => handle.remove();
      });
    } catch (e) {
      // Ignored outside native environment
    }

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
      if (removeCapacitorListener) removeCapacitorListener();
    };
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
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('[OfflineSync] Failed to read cached rep data', e);
    }
    // Return initial built-in offline dataset if no network sync has occurred yet
    return INITIAL_OFFLINE_FALLBACK_DATA;
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
   * Guarded with isGlobalSyncRunning mutex to prevent parallel duplicate execution
   */
  async syncAllPendingBills(
    onProgress?: (synced: number, total: number) => void
  ): Promise<{ success: boolean; syncedCount: number; errors: string[] }> {
    if (isGlobalSyncRunning) {
      console.log('[OfflineSync] Sync is already active in another thread/cycle, skipping parallel invocation.');
      return { success: true, syncedCount: 0, errors: [] };
    }

    isGlobalSyncRunning = true;
    try {
      const pending = this.getPendingBills();
      if (pending.length === 0) {
        return { success: true, syncedCount: 0, errors: [] };
      }

      let syncedCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < pending.length; i++) {
        const bill = pending[i];
        if (inFlightSyncIds.has(bill.localId)) {
          continue;
        }

        inFlightSyncIds.add(bill.localId);

        try {
          // Guarantee unique paperBillNumber is attached for backend idempotency
          if (!bill.payload.paperBillNumber) {
            bill.payload.paperBillNumber = bill.orderNumber;
          }

          if (bill.lorryId) {
            await LorryService.enterDriverBill(bill.lorryId, bill.payload);
          } else {
            await OrderService.create(bill.payload);
          }

          // Successfully synced on server
          syncedCount++;
          this.removePendingBill(bill.localId);
          inFlightSyncIds.delete(bill.localId);
          if (onProgress) {
            onProgress(syncedCount, pending.length);
          }
        } catch (err: any) {
          inFlightSyncIds.delete(bill.localId);
          console.error(`[OfflineSync] Failed syncing bill ${bill.orderNumber}:`, err);
          const errMsg = err.response?.data?.error || err.message || 'Unknown network error';
          
          // If server reports it already exists or was created, safely remove it from pending
          if (errMsg.toLowerCase().includes('already exists') || errMsg.toLowerCase().includes('duplicate')) {
            console.log(`[OfflineSync] Bill ${bill.orderNumber} was already acknowledged by server, removing from queue.`);
            this.removePendingBill(bill.localId);
            syncedCount++;
          } else {
            errors.push(`${bill.orderNumber}: ${errMsg}`);
            bill.syncError = errMsg;
          }
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
    } finally {
      isGlobalSyncRunning = false;
    }
  }
};


import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  Search,
  AlertCircle,
  ShoppingBag,
  Layers,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Printer,
  Truck,
  CreditCard,
  LogOut,
  Check,
  RotateCcw,
  Target,
  Calendar,
  Award,
  X,
  Flame,
  Receipt,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  MapPin,
  Navigation,
  Compass,
  Sparkles,
  Clock,
  Milestone,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Camera,
  Barcode,
  MoreHorizontal,
  ChevronRight,
  Radio,
  Wallet,
  Boxes,
  Package,
  ArrowLeftRight,
  Lock,
  Wifi,
  WifiOff,
  BarChart3,
  Gift,
  Tag,
  UserCheck,
  UserX,
  FileText,
  Zap
} from 'lucide-react';
import {
  Customer,
  Product,
  Lorry,
  Order,
  User,
  CustomerPayment,
  RepTargetProgress,
  RouteOptimizationResult,
  OptimizedStop,
  RouteStatusResult,
  PreOrder,
  RepAttendanceStatus,
  RepSalarySlipPreview
} from '../types';
import { CustomerService, LorryService, ProductService, OrderService, AuthService, MapService, RouteService, PreOrderService, RepAttendanceService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';
import { CustomerModal } from '../components/CustomerModal';
import { RepBillsSummaryModal } from '../components/RepBillsSummaryModal';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { CreditRiskBadge, CustomerAgingCard } from '../components/CreditRiskBadge';
import { AdminPasscodeModal } from '../components/AdminPasscodeModal';
import { CustomerReceiptModal } from '../components/CustomerReceiptModal';
import { RepDirectCollectionModal } from '../components/RepDirectCollectionModal';
import { RepDirectReturnsModal } from '../components/RepDirectReturnsModal';
import { LorryStockExchangeModal } from '../components/LorryStockExchangeModal';
import { FontSizeButton, FontSizeInlineStepper } from '../components/FontSizeControl';
import { OfflineSyncService, QueuedOfflineBill } from '../services/offlineSync';
import { executeSystemPrint } from '../utils/bluetoothPrinter';
import { resolveTierUnitPrice } from '../utils/pricing';
import { EmptyBottleBar, EmptyBottleState } from '../components/EmptyBottleBar';

interface CartItem {
  productId: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  originalUnitPrice: number;
  isManualPrice?: boolean;
  isTierPrice?: boolean;
  activeTierMinQty?: number;
  availableStock: number;
  quantity: number;
  freeQuantity: number;
  manualFree?: boolean;
  discountType?: '%' | 'Rs';
  discountPercent?: number;
  discountAmount?: number;
}

interface RepBillingProps {
  onViewInvoice?: (order: Order) => void;
  onExitToMenu?: () => void;
  initialLorryId?: string;
  user?: User;
  onLogout?: () => void;
}

export const RepBilling: React.FC<RepBillingProps> = ({
  onViewInvoice,
  onExitToMenu: _onExitToMenu,
  initialLorryId,
  user,
  onLogout
}) => {
  const { formatMoney } = useCurrency();

  // Current Step: 1 = Customer, 2 = Cart, 3 = Brand, 4 = Products, 5 = Checkout
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Global Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lorries, setLorries] = useState<Lorry[]>([]);
  const [selectedLorryId, setSelectedLorryId] = useState<string>(initialLorryId || '');
  const [loading, setLoading] = useState<boolean>(true);

  // Step 1: Customer
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // Guard: Rep cannot enter cart or billing steps without first selecting a customer
  useEffect(() => {
    if (currentStep > 1 && !selectedCustomerId) {
      setCurrentStep(1);
    }
  }, [currentStep, selectedCustomerId]);
  const [billingMethod, setBillingMethod] = useState<'NORMAL' | 'BILL_TO_BILL'>('NORMAL');
  const [customerUnpaidBills, setCustomerUnpaidBills] = useState<Order[]>([]);
  const [settlePrevAmount, setSettlePrevAmount] = useState<string>('');
  const [collectPrevBill, setCollectPrevBill] = useState<boolean>(false);

  // Step 2 & Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Step 3: Brand
  const [selectedBrand, setSelectedBrand] = useState<string>('');

  // Step 4: Product Search
  const [itemSearch, setItemSearch] = useState<string>('');

  // Step 5: Checkout
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT' | 'CHEQUE'>('CREDIT');
  const [chequeNumber, setChequeNumber] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [chequeDate, setChequeDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  // Bill Discount State
  const [billDiscountType, setBillDiscountType] = useState<'%' | 'Rs'>('%');
  const [billDiscountValue, setBillDiscountValue] = useState<number>(0);
  const [billDiscountManual, setBillDiscountManual] = useState<boolean>(false);
  const [openItemDiscounts, setOpenItemDiscounts] = useState<Record<string, boolean>>({});
  const [useReturnCredit, setUseReturnCredit] = useState<boolean>(true);
  const [bottleState, setBottleState] = useState<EmptyBottleState>({
    returnedGood: 0,
    damaged: 0,
    missing: 0,
    chargeMissing: false
  });
  const [notes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [checkoutSuccessOrder, setCheckoutSuccessOrder] = useState<Order | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Credit Stop Override State
  const [showAdminPasscodeModal, setShowAdminPasscodeModal] = useState<boolean>(false);
  const [adminOverridePasscode, setAdminOverridePasscode] = useState<string | null>(null);
  const [authorizedByName, setAuthorizedByName] = useState<string | null>(null);

  // Rep Attendance & Salary Slip State
  const [attendanceStatus, setAttendanceStatus] = useState<RepAttendanceStatus | null>(null);
  const [checkingInOut, setCheckingInOut] = useState<boolean>(false);
  const [showSalarySlipModal, setShowSalarySlipModal] = useState<boolean>(false);
  const [salarySlip, setSalarySlip] = useState<RepSalarySlipPreview | null>(null);
  const [loadingSalarySlip, setLoadingSalarySlip] = useState<boolean>(false);

  // Shift Hub (•••) Modal State (Apple iOS Style)
  const [showShiftHubModal, setShowShiftHubModal] = useState<boolean>(false);

  // Add Customer Modal State
  const [showAddCustomerModal, setShowAddCustomerModal] = useState<boolean>(false);

  // Direct Collection & Direct Returns Modal States (Ultra-clean Mobile Options)
  const [showDirectCollectionModal, setShowDirectCollectionModal] = useState<boolean>(false);
  const [showDirectReturnsModal, setShowDirectReturnsModal] = useState<boolean>(false);
  const [activeReceiptPayment, setActiveReceiptPayment] = useState<CustomerPayment | null>(null);

  // Pre-Orders & Advance Bookings State
  const [customerPreOrders, setCustomerPreOrders] = useState<PreOrder[]>([]);
  const [fulfilledPreOrderIds, setFulfilledPreOrderIds] = useState<string[]>([]);
  const [showPreOrderModal, setShowPreOrderModal] = useState<boolean>(false);
  const [preOrderProductId, setPreOrderProductId] = useState<string>('');
  const [preOrderQty, setPreOrderQty] = useState<number>(1);
  const [preOrderNotes, setPreOrderNotes] = useState<string>('');
  const [submittingPreOrder, setSubmittingPreOrder] = useState<boolean>(false);

  // Finished Bills State & Filters
  type BillsDatePreset = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'all' | 'custom';
  const [finishedBills, setFinishedBills] = useState<Order[]>([]);
  const [loadingFinishedBills, setLoadingFinishedBills] = useState<boolean>(false);
  const [showFinishedBillsModal, setShowFinishedBillsModal] = useState<boolean>(false);
  const [billsViewMode, setBillsViewMode] = useState<'BILLS' | 'ITEMS'>('BILLS');
  const [billsSearch, setBillsSearch] = useState<string>('');
  const [itemSearchQuery, setItemSearchQuery] = useState<string>('');
  const [itemSortFilter, setItemSortFilter] = useState<'QTY_DESC' | 'REVENUE_DESC' | 'NAME'>('QTY_DESC');
  const [billsFilter, setBillsFilter] = useState<'ALL' | 'CASH' | 'CREDIT' | 'CHEQUE'>('ALL');
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
  const [showSummaryBillModal, setShowSummaryBillModal] = useState<boolean>(false);

  // Date Range Filter State for Finished Bills
  const [billsDatePreset, setBillsDatePreset] = useState<BillsDatePreset>('today');
  const [billsDateRange, setBillsDateRange] = useState<{ from: string; to: string }>(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  });
  const [customBillsStart, setCustomBillsStart] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [customBillsEnd, setCustomBillsEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Smart Route Optimization & Geofenced Visit State
  const [routeOptimization, setRouteOptimization] = useState<RouteOptimizationResult | null>(null);
  const [loadingRoute, setLoadingRoute] = useState<boolean>(false);
  const [routeViewMode, setRouteViewMode] = useState<'SMART_SEQUENCE' | 'ALL_CUSTOMERS'>('SMART_SEQUENCE');
  const [routeStatus, setRouteStatus] = useState<RouteStatusResult | null>(null);
  const [showSkippedModal, setShowSkippedModal] = useState<boolean>(false);
  const [autoCheckinToast, setAutoCheckinToast] = useState<string | null>(null);

  // Available Lorry Stock Page State (Dedicated full-screen ultra-clean view)
  const [showStockPage, setShowStockPage] = useState<boolean>(false);
  const [showExchangeModal, setShowExchangeModal] = useState<boolean>(false);
  const [stockSearch, setStockSearch] = useState<string>('');
  const [stockCategoryFilter, setStockCategoryFilter] = useState<string>('ALL');
  const [stockSortFilter, setStockSortFilter] = useState<'STOCK_DESC' | 'STOCK_ASC' | 'NAME' | 'PRICE'>('STOCK_DESC');
  const [stockPageToast, setStockPageToast] = useState<string | null>(null);
  const [isRefreshingStock, setIsRefreshingStock] = useState<boolean>(false);

  // Offline Billing & Auto-Sync Engine
  const [isOnline, setIsOnline] = useState<boolean>(() => OfflineSyncService.isOnline());
  const [pendingBillsCount, setPendingBillsCount] = useState<number>(() => OfflineSyncService.getPendingBills().length);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusToast, setSyncStatusToast] = useState<string | null>(null);

  // Synchronous ref guards to prevent accidental double-clicks or parallel sync executions
  const isSubmittingCheckoutRef = useRef<boolean>(false);
  const isSyncingPendingRef = useRef<boolean>(false);

  const handleSyncPending = async () => {
    if (isSyncingPendingRef.current || isSyncing) return;
    const pending = OfflineSyncService.getPendingBills();
    if (pending.length === 0) return;

    isSyncingPendingRef.current = true;
    setIsSyncing(true);
    setSyncStatusToast(`🔄 Syncing ${pending.length} offline bill(s)...`);

    try {
      const res = await OfflineSyncService.syncAllPendingBills();
      const remaining = OfflineSyncService.getPendingBills().length;
      setPendingBillsCount(remaining);

      if (res.syncedCount > 0) {
        setSyncStatusToast(`✓ Synced ${res.syncedCount} bill(s) with central server!`);
        setTimeout(() => setSyncStatusToast(null), 3500);
        loadTargets(selectedLorryId || undefined);
        loadFinishedBills(selectedLorryId || undefined);
      } else if (res.errors.length > 0) {
        setSyncStatusToast(`⚠️ Sync failed for ${res.errors.length} bill(s). Check connection.`);
        setTimeout(() => setSyncStatusToast(null), 4000);
      } else {
        setSyncStatusToast(null);
      }
    } catch (err) {
      console.warn('[Sync Error]', err);
      setSyncStatusToast('⚠️ Sync error. Will auto-retry.');
      setTimeout(() => setSyncStatusToast(null), 3500);
    } finally {
      setIsSyncing(false);
      isSyncingPendingRef.current = false;
    }
  };

  useEffect(() => {
    // Cross-platform network listener (Web, Desktop, and Android Native Capacitor)
    const cleanupNetwork = OfflineSyncService.initNetworkListener(connected => {
      setIsOnline(connected);
      if (connected) {
        handleSyncPending();
      }
    });

    // Background safety interval: Auto-sync every 30 seconds if bills are pending
    const timer = setInterval(() => {
      if (OfflineSyncService.isOnline() && OfflineSyncService.getPendingBills().length > 0 && !isSyncing) {
        handleSyncPending();
      }
    }, 30000);

    return () => {
      cleanupNetwork();
      clearInterval(timer);
    };
  }, []);

  // Next Stop Hero Card Minimized State (toggled via ••• button next to Next Stop badge)
  const [isNextStopMinimized, setIsNextStopMinimized] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rep_next_stop_minimized') === 'true';
    } catch {
      return false;
    }
  });

  const toggleNextStopMinimized = () => {
    setIsNextStopMinimized(prev => {
      const next = !prev;
      try {
        localStorage.setItem('rep_next_stop_minimized', String(next));
      } catch { }
      return next;
    });
  };

  // Live GPS Beacon State (Broadcast driver location to office fleet map)
  // STRICT: Only mobile sales reps on route (role === 'REP') are allowed to broadcast vehicle GPS!
  const isRepRole = user?.role === 'REP';
  type GpsGateStatus = 'CHECKING' | 'GRANTED' | 'DENIED' | 'UNSUPPORTED';
  const [gpsStatus, setGpsStatus] = useState<GpsGateStatus>(isRepRole ? 'CHECKING' : 'GRANTED');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isVerifyingGps, setIsVerifyingGps] = useState<boolean>(false);
  const [isGpsActive, setIsGpsActive] = useState<boolean>(isRepRole);
  const [currentGpsCoords, setCurrentGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [lastGpsSyncTime, setLastGpsSyncTime] = useState<Date | null>(null);

  // Mandatory GPS Access Verifier for Sales Reps
  const verifyAndEnableGps = (showToastOnSuccess = false) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('UNSUPPORTED');
      setGpsError('Geolocation is not supported by your mobile browser. Please use Chrome or Safari.');
      return;
    }

    setIsVerifyingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (Math.abs(lat) > 0.001 || Math.abs(lng) > 0.001) {
          setCurrentGpsCoords({ lat, lng });
          setGpsStatus('GRANTED');
          setIsGpsActive(true);
          setLastGpsSyncTime(new Date());

          const lorryToUpdate = selectedLorryId || initialLorryId || user?.lorryId;
          if (lorryToUpdate) {
            const payload = {
              latitude: lat,
              longitude: lng,
              speed: pos.coords.speed != null && pos.coords.speed >= 0 ? Math.round(pos.coords.speed * 3.6) : null,
              heading: pos.coords.heading != null && !isNaN(pos.coords.heading) && pos.coords.heading >= 0 ? Math.round(pos.coords.heading) : null,
              userId: user?.id
            };
            MapService.updateDriverLocation(lorryToUpdate, payload)
              .then((res: any) => {
                const visitedShop = res?.autoVisitedShop || res?.data?.autoVisitedShop;
                if (visitedShop) {
                  setAutoCheckinToast(`📍 Arrived at "${visitedShop}" — Geofence Verified!`);
                  setTimeout(() => setAutoCheckinToast(null), 7000);
                  loadOptimizedRoute(undefined, { lat, lng });
                }
              })
              .catch(err => console.warn('[Driver GPS Initial Beacon] Update failed:', err));
          }

          if (showToastOnSuccess) {
            setAutoCheckinToast('🟢 GPS live signal verified & coordinates refreshed!');
            setTimeout(() => setAutoCheckinToast(null), 4000);
          }
        } else {
          setGpsStatus('DENIED');
          setGpsError('Invalid GPS coordinates received. Please ensure your device has a clear GPS view.');
        }
        setIsVerifyingGps(false);
      },
      err => {
        console.warn('[Mandatory GPS Check] Error:', err);
        setIsVerifyingGps(false);
        setGpsStatus('DENIED');
        if (err.code === 1) {
          setGpsError('Location permission denied. Please enable location in your browser and phone settings.');
        } else if (err.code === 2) {
          setGpsError('GPS signal unavailable. Please ensure GPS / Location is switched ON in your phone settings.');
        } else if (err.code === 3) {
          setGpsError('GPS request timed out. Please check your phone settings and try again.');
        } else {
          setGpsError(err.message || 'Unable to access GPS location.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Auto-verify GPS on mount for mobile Reps
  useEffect(() => {
    if (isRepRole) {
      verifyAndEnableGps();
    }
  }, [isRepRole]);

  // Load AI TSP Optimized Route for current lorry
  const loadOptimizedRoute = async (targetLorry?: Lorry, coords?: { lat: number; lng: number } | null) => {
    const l = targetLorry || selectedLorry;
    if (!l?.routeId) return;
    try {
      setLoadingRoute(true);
      const activeCoords = coords !== undefined ? coords : currentGpsCoords;
      const opt = await RouteService.getOptimizedRoute(l.routeId, {
        lorryId: l.id,
        currentLatitude: activeCoords?.lat,
        currentLongitude: activeCoords?.lng
      });
      setRouteOptimization(opt);

      // Audit status (visited vs skipped stores)
      const statusRes = await LorryService.getRouteStatus(l.id);
      setRouteStatus(statusRes);
    } catch (err) {
      console.warn('[Smart Route] Failed to load route optimization:', err);
    } finally {
      setLoadingRoute(false);
    }
  };

  // Launch universal turn-by-turn navigation (Google Maps web/app intent)
  const handleNavigateToCustomer = (customer: Customer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (customer.latitude != null && customer.longitude != null) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${customer.latitude},${customer.longitude}&travelmode=driving`;
      window.open(url, '_blank');
    } else {
      alert(`No GPS coordinates registered for ${customer.name}. You can pin this store from the Live Fleet Map.`);
    }
  };

  // Camera Barcode Scanner Modal State
  const [showBarcodeScanner, setShowBarcodeScanner] = useState<boolean>(false);

  // Handle scanned barcode or SKU code
  const handleBarcodeScanned = async (code: string): Promise<boolean> => {
    const cleanCode = code.trim().toLowerCase();

    // 1. Try instant local match in lorry-loaded products only
    let matchedProduct = lorryProducts.find(
      p =>
        (p.sku && p.sku.toLowerCase() === cleanCode) ||
        (p.barcode && p.barcode.toLowerCase() === cleanCode) ||
        p.id.toLowerCase() === cleanCode
    );

    // 2. If not found locally, query server scan lookup
    if (!matchedProduct) {
      try {
        const scanRes = await ProductService.scanBarcode(code.trim(), selectedLorryId || undefined);
        if (scanRes && scanRes.found && scanRes.product) {
          matchedProduct = scanRes.product;
          setProducts(prev => (prev.some(p => p.id === scanRes.product.id) ? prev : [...prev, scanRes.product]));
        }
      } catch (err) {
        console.warn('[Scan Barcode] Server lookup error:', err);
      }
    }

    if (!matchedProduct) {
      return false;
    }

    // Add 1 unit of product to cart
    addToCart(matchedProduct, 1);
    return true;
  };

  // Background GPS Ping Effect (STRICTLY for mobile Sales Reps on route)
  useEffect(() => {
    // 1. Strict Guard: Admins/backoffice staff must NEVER broadcast office location as a lorry!
    if (!user || user.role !== 'REP') {
      return;
    }
    // 2. Must be actively enabled and have a valid target lorry
    if (!selectedLorryId || !isGpsActive) {
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    let isMounted = true;
    let watchId: number | null = null;

    // 1. Instant Real-Time GPS Cutoff Watcher
    // If driver swipes down notification bar and turns off Location/GPS, this fires within ~1 second!
    if (navigator.geolocation.watchPosition) {
      watchId = navigator.geolocation.watchPosition(
        pos => {
          if (!isMounted) return;
          if (pos.coords.latitude && pos.coords.longitude) {
            // Keep coordinates live
            setCurrentGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          }
        },
        err => {
          console.warn('[Real-Time GPS Watcher] Cutoff detected:', err.message);
          if (isMounted && isRepRole && (err.code === 1 || err.code === 2)) {
            setGpsStatus('DENIED');
            setGpsError(
              err.code === 1
                ? 'Location permission was turned off. Turn GPS back on to continue invoicing.'
                : 'Device GPS was turned off. Please re-enable Location in phone settings to continue.'
            );
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
      );
    }

    // 2. Browser Permission Status Change Listener
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(status => {
        status.onchange = () => {
          if (!isMounted) return;
          if (status.state === 'denied') {
            setGpsStatus('DENIED');
            setGpsError('Location permission was revoked in browser settings. Turn GPS back on to continue.');
          }
        };
      }).catch(() => { });
    }

    const pingLocation = () => {
      if (!isGpsActive || !isMounted) return;

      navigator.geolocation.getCurrentPosition(
        pos => {
          if (!isMounted) return;
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          // Reject invalid coordinates
          if (Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001) return;

          const payload = {
            latitude: lat,
            longitude: lng,
            speed: pos.coords.speed != null && pos.coords.speed >= 0 ? Math.round(pos.coords.speed * 3.6) : null,
            heading: pos.coords.heading != null && !isNaN(pos.coords.heading) && pos.coords.heading >= 0 ? Math.round(pos.coords.heading) : null,
            userId: user.id
          };

          setCurrentGpsCoords({ lat, lng });
          MapService.updateDriverLocation(selectedLorryId, payload)
            .then((res: any) => {
              if (isMounted) {
                setLastGpsSyncTime(new Date());
                const visitedShop = res?.autoVisitedShop || res?.data?.autoVisitedShop;
                if (visitedShop) {
                  setAutoCheckinToast(`📍 Arrived at "${visitedShop}" — Geofence Verified!`);
                  setTimeout(() => setAutoCheckinToast(null), 7000);
                  loadOptimizedRoute(undefined, { lat, lng });
                }
              }
            })
            .catch(err => console.warn('[Driver GPS Beacon] Update failed:', err));
        },
        err => {
          console.warn('[Driver GPS Beacon] Geolocation error:', err.message);
          // If rep revoked permission or turned off location midway through shift, re-lock the screen!
          if (isMounted && isRepRole && (err.code === 1 || err.code === 2)) {
            setGpsStatus('DENIED');
            setGpsError(
              err.code === 1
                ? 'Location permission was turned off. Turn GPS back on to continue invoicing.'
                : 'GPS signal lost or turned off. Please re-enable location.'
            );
          }
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
      );
    };

    pingLocation();
    const interval = setInterval(pingLocation, 15000); // sync every 15s for live route tracking
    return () => {
      isMounted = false;
      clearInterval(interval);
      if (watchId !== null && navigator.geolocation.clearWatch) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [selectedLorryId, isGpsActive, user]);

  const getBillsRangeForPreset = (
    preset: BillsDatePreset,
    customS?: string,
    customE?: string
  ): { from: string; to: string } => {
    const now = new Date();
    if (preset === 'all') {
      return { from: '', to: '' };
    }
    if (preset === 'yesterday') {
      const yStart = new Date(now);
      yStart.setDate(yStart.getDate() - 1);
      yStart.setHours(0, 0, 0, 0);
      const yEnd = new Date(now);
      yEnd.setDate(yEnd.getDate() - 1);
      yEnd.setHours(23, 59, 59, 999);
      return { from: yStart.toISOString(), to: yEnd.toISOString() };
    }
    if (preset === 'thisWeek') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(d.setDate(diff));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(now);
      weekEnd.setHours(23, 59, 59, 999);
      return { from: weekStart.toISOString(), to: weekEnd.toISOString() };
    }
    if (preset === 'thisMonth') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const monthEnd = new Date(now);
      monthEnd.setHours(23, 59, 59, 999);
      return { from: monthStart.toISOString(), to: monthEnd.toISOString() };
    }
    if (preset === 'custom') {
      const s = customS || customBillsStart;
      const e = customE || customBillsEnd;
      const cStart = new Date(s);
      cStart.setHours(0, 0, 0, 0);
      const cEnd = new Date(e);
      cEnd.setHours(23, 59, 59, 999);
      return { from: cStart.toISOString(), to: cEnd.toISOString() };
    }
    // Default 'today'
    const tStart = new Date(now);
    tStart.setHours(0, 0, 0, 0);
    const tEnd = new Date(now);
    tEnd.setHours(23, 59, 59, 999);
    return { from: tStart.toISOString(), to: tEnd.toISOString() };
  };

  const billsDateRangeLabel = useMemo(() => {
    if (billsDatePreset === 'today') return 'Today';
    if (billsDatePreset === 'yesterday') return 'Yesterday';
    if (billsDatePreset === 'thisWeek') return 'This Week';
    if (billsDatePreset === 'thisMonth') return 'This Month';
    if (billsDatePreset === 'all') return 'All Time';
    return `${customBillsStart} to ${customBillsEnd}`;
  }, [billsDatePreset, customBillsStart, customBillsEnd]);

  const loadFinishedBills = async (
    lorryIdToUse?: string,
    rangeToUse?: { from: string; to: string }
  ) => {
    try {
      setLoadingFinishedBills(true);
      const targetLorry = lorryIdToUse || selectedLorryId || initialLorryId;
      const activeRange = rangeToUse !== undefined ? rangeToUse : billsDateRange;
      const orders = await OrderService.getAll(
        undefined,
        targetLorry || undefined,
        undefined,
        activeRange.from || activeRange.to ? undefined : 300,
        activeRange.from || undefined,
        activeRange.to || undefined
      );
      setFinishedBills(orders);
    } catch (err) {
      console.error('Failed to load finished bills', err);
    } finally {
      setLoadingFinishedBills(false);
    }
  };

  const handleDatePresetChange = (newPreset: BillsDatePreset) => {
    setBillsDatePreset(newPreset);
    if (newPreset !== 'custom') {
      const range = getBillsRangeForPreset(newPreset);
      setBillsDateRange(range);
      loadFinishedBills(undefined, range);
    }
  };

  const handleApplyCustomDates = () => {
    if (!customBillsStart || !customBillsEnd) return;
    const range = getBillsRangeForPreset('custom', customBillsStart, customBillsEnd);
    setBillsDateRange(range);
    loadFinishedBills(undefined, range);
  };

  // Targets Modal State
  const [showTargetModal, setShowTargetModal] = useState<boolean>(false);
  const [targetProgress, setTargetProgress] = useState<RepTargetProgress | null>(null);
  const [loadingTargets, setLoadingTargets] = useState<boolean>(false);

  const loadTargets = async (lorryIdToUse?: string) => {
    try {
      setLoadingTargets(true);
      const userFromStorage = (() => {
        try {
          const s = localStorage.getItem('distributor_auth_user');
          return s ? JSON.parse(s) : null;
        } catch {
          return null;
        }
      })();
      const activeUser = user || userFromStorage;
      const data = await AuthService.getMyTargets({
        userId: activeUser?.id,
        lorryId: lorryIdToUse || selectedLorryId || initialLorryId || activeUser?.lorryId
      });
      setTargetProgress(data);
    } catch (err) {
      console.error('Failed to load rep targets', err);
    } finally {
      setLoadingTargets(false);
    }
  };

  const loadAttendanceStatus = async (lorryId?: string) => {
    try {
      const lid = lorryId || selectedLorryId;
      const status = await RepAttendanceService.getTodayStatus({
        userId: user?.id,
        lorryId: lid || undefined
      });
      setAttendanceStatus(status);
    } catch (err) {
      console.warn('Failed to load rep attendance status', err);
    }
  };

  const handleCheckIn = async () => {
    try {
      setCheckingInOut(true);
      let latitude: number | undefined;
      let longitude: number | undefined;
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const pos: any = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 6000,
              enableHighAccuracy: true
            });
          });
          latitude = pos?.coords?.latitude;
          longitude = pos?.coords?.longitude;
        } catch {
          // Non-blocking geolocation
        }
      }

      const res = await RepAttendanceService.checkIn({
        userId: user?.id,
        lorryId: selectedLorryId || undefined,
        latitude,
        longitude
      });
      setSyncStatusToast(res.message || 'Morning check-in recorded successfully!');
      setTimeout(() => setSyncStatusToast(null), 3500);
      await loadAttendanceStatus();
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || 'Failed to check in');
    } finally {
      setCheckingInOut(false);
    }
  };

  const handleCheckOut = async () => {
    if (!window.confirm('Are you sure you want to Check Out and conclude today’s field shift? Your duty hours will be recorded for payroll.')) {
      return;
    }
    try {
      setCheckingInOut(true);
      let latitude: number | undefined;
      let longitude: number | undefined;
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const pos: any = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 6000,
              enableHighAccuracy: true
            });
          });
          latitude = pos?.coords?.latitude;
          longitude = pos?.coords?.longitude;
        } catch {
          // Non-blocking geolocation
        }
      }

      const res = await RepAttendanceService.checkOut({
        userId: user?.id,
        lorryId: selectedLorryId || undefined,
        latitude,
        longitude
      });
      setSyncStatusToast(`Shift completed: ${res.dutyHours} hrs worked (${res.otHours} hrs OT)`);
      setTimeout(() => setSyncStatusToast(null), 4000);
      await loadAttendanceStatus();
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || 'Failed to check out');
    } finally {
      setCheckingInOut(false);
    }
  };

  const handleOpenSalarySlip = async () => {
    setShowSalarySlipModal(true);
    setLoadingSalarySlip(true);
    try {
      const data = await RepAttendanceService.getCurrentSalarySlip({
        userId: user?.id,
        lorryId: selectedLorryId || undefined
      });
      setSalarySlip(data);
    } catch (err) {
      console.error('Failed to load salary slip preview', err);
    } finally {
      setLoadingSalarySlip(false);
    }
  };

  useEffect(() => {
    loadData();
    loadTargets();
    loadFinishedBills();
    loadAttendanceStatus();
  }, []);

  useEffect(() => {
    if (selectedLorryId) {
      loadAttendanceStatus(selectedLorryId);
    }
  }, [selectedLorryId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [custList, prodList, lorryList] = await Promise.all([
        CustomerService.getAll(),
        ProductService.getAll(),
        LorryService.getAll()
      ]);

      const activeProducts = prodList.filter(p => !p.isRawMaterial);
      setCustomers(custList);
      setProducts(activeProducts);
      setLorries(lorryList);

      // Save to offline cache
      OfflineSyncService.cacheRepData({
        customers: custList,
        products: activeProducts,
        lorries: lorryList,
        lorryStockMap
      });

      if (initialLorryId && lorryList.some(l => l.id === initialLorryId)) {
        setSelectedLorryId(initialLorryId);
        loadTargets(initialLorryId);
        const l = lorryList.find(x => x.id === initialLorryId);
        if (l) loadOptimizedRoute(l);
      } else if (lorryList.length > 0 && !selectedLorryId) {
        setSelectedLorryId(lorryList[0].id);
        loadTargets(lorryList[0].id);
        loadOptimizedRoute(lorryList[0]);
      } else {
        loadTargets();
      }
    } catch (err) {
      console.error('Failed to load rep billing data from server, falling back to offline cache:', err);
      const cached = OfflineSyncService.getCachedRepData();
      if (cached && cached.customers?.length > 0) {
        setCustomers(cached.customers);
        setProducts(cached.products);
        setLorries(cached.lorries);
        if (cached.lorries.length > 0 && !selectedLorryId) {
          setSelectedLorryId(cached.lorries[0].id);
        }
        setAutoCheckinToast('📶 Working offline — Using saved lorry stock & customer data');
        setTimeout(() => setAutoCheckinToast(null), 4000);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLorryId && lorries.length > 0) {
      const l = lorries.find(x => x.id === selectedLorryId);
      if (l) {
        loadOptimizedRoute(l);
      }
    }
  }, [selectedLorryId, lorries]);

  const selectedLorry = lorries.find(l => l.id === selectedLorryId);
  const lorryStockMap = useMemo(() => {
    const map = new Map<string, { stock: number; freeStock: number }>();
    if (selectedLorry && Array.isArray(selectedLorry.lorryStocks)) {
      selectedLorry.lorryStocks.forEach(s => map.set(s.productId, { stock: s.quantity, freeStock: s.freeQuantity || 0 }));
    }
    return map;
  }, [selectedLorry]);

  // Only show products that are physically loaded on this lorry (stock > 0)
  const lorryProducts = useMemo(() => {
    if (lorryStockMap.size === 0) return [];
    return products.filter(p => {
      const info = lorryStockMap.get(p.id);
      return info !== undefined && info.stock > 0;
    });
  }, [products, lorryStockMap]);

  // Available Lorry Stock Stats for Dedicated Stock Page
  const stockPageStats = useMemo(() => {
    let totalPaidQty = 0;
    let totalFreeQty = 0;
    let totalValuation = 0;

    lorryProducts.forEach(p => {
      const s = lorryStockMap.get(p.id);
      const paid = s?.stock || 0;
      const free = s?.freeStock || 0;
      totalPaidQty += paid;
      totalFreeQty += free;
      totalValuation += paid * p.unitPrice;
    });

    return {
      itemCount: lorryProducts.length,
      totalPaidQty,
      totalFreeQty,
      totalValuation
    };
  }, [lorryProducts, lorryStockMap]);

  // Available Stock Categories for filtering
  const stockCategories = useMemo(() => {
    const map = new Map<string, number>();
    lorryProducts.forEach(p => {
      const cat = p.category?.trim() || 'General';
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [lorryProducts]);

  // Filtered & Sorted Stock for the Dedicated Stock Page
  const filteredStockProducts = useMemo(() => {
    return lorryProducts
      .filter(p => {
        if (stockCategoryFilter !== 'ALL' && p.category.toLowerCase() !== stockCategoryFilter.toLowerCase()) {
          return false;
        }
        if (stockSearch.trim()) {
          const q = stockSearch.toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchSku = p.sku.toLowerCase().includes(q);
          const matchBarcode = p.barcode ? p.barcode.toLowerCase().includes(q) : false;
          const matchCategory = p.category.toLowerCase().includes(q);
          return matchName || matchSku || matchBarcode || matchCategory;
        }
        return true;
      })
      .sort((a, b) => {
        const aStock = lorryStockMap.get(a.id)?.stock || 0;
        const bStock = lorryStockMap.get(b.id)?.stock || 0;
        if (stockSortFilter === 'STOCK_DESC') return bStock - aStock;
        if (stockSortFilter === 'STOCK_ASC') return aStock - bStock;
        if (stockSortFilter === 'PRICE') return b.unitPrice - a.unitPrice;
        return a.name.localeCompare(b.name);
      });
  }, [lorryProducts, lorryStockMap, stockCategoryFilter, stockSearch, stockSortFilter]);

  // Refresh Lorry Stock Live
  const handleRefreshStock = async () => {
    setIsRefreshingStock(true);
    try {
      await loadData();
      setStockPageToast('🟢 Floating stock refreshed from server!');
      setTimeout(() => setStockPageToast(null), 3000);
    } catch {
      setStockPageToast('⚠️ Failed to refresh stock.');
      setTimeout(() => setStockPageToast(null), 3000);
    } finally {
      setIsRefreshingStock(false);
    }
  };

  // Print Stock Sheet for Lorry
  const handlePrintStock = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      executeSystemPrint();
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lorry Stock - ${selectedLorry?.vehicleNumber || 'Lorry'}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 16px; font-size: 12px; color: #0f172a; }
            h2 { margin: 0 0 4px 0; font-size: 16px; }
            p { margin: 2px 0 8px 0; color: #475569; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border-bottom: 1px solid #cbd5e1; padding: 6px 4px; text-align: left; }
            th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; }
            .num { text-align: right; font-family: monospace; }
            .total { font-weight: bold; background: #e2e8f0; }
          </style>
        </head>
        <body>
          <h2>M&S Enterprises - Lorry Stock Available to Bill</h2>
          <p>Vehicle: <strong>${selectedLorry?.vehicleNumber || 'Lorry'}</strong> | Driver: <strong>${selectedLorry?.driverName || 'Driver'}</strong></p>
          <p>Date: ${new Date().toLocaleString('en-GB')}</p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Category</th>
                <th class="num">Unit Price</th>
                <th class="num">Available</th>
                <th class="num">Free Stock</th>
                <th class="num">Valuation</th>
              </tr>
            </thead>
            <tbody>
              ${filteredStockProducts.map((p, idx) => {
      const s = lorryStockMap.get(p.id);
      const paid = s?.stock || 0;
      const free = s?.freeStock || 0;
      return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td><strong>${p.name}</strong><br/><span style="color:#64748b;font-size:10px">${p.sku}</span></td>
                    <td>${p.category}</td>
                    <td class="num">${formatMoney(p.unitPrice)}</td>
                    <td class="num" style="font-weight:bold;color:#047857">${paid} ${p.unit}</td>
                    <td class="num">${free > 0 ? `${free} Free` : '-'}</td>
                    <td class="num">${formatMoney(paid * p.unitPrice)}</td>
                  </tr>
                `;
    }).join('')}
              <tr class="total">
                <td colspan="4">TOTALS (${stockPageStats.itemCount} SKUs)</td>
                <td class="num">${stockPageStats.totalPaidQty} Units</td>
                <td class="num">${stockPageStats.totalFreeQty} Free</td>
                <td class="num">${formatMoney(stockPageStats.totalValuation)}</td>
              </tr>
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // When customer changes, fetch unpaid bills and pending pre-orders
  useEffect(() => {
    if (selectedCustomerId) {
      CustomerService.getUnpaidBills(selectedCustomerId)
        .then(bills => {
          setCustomerUnpaidBills(bills);
          if (bills.length > 0 && bills[0]) {
            setBillingMethod('BILL_TO_BILL');
            const first = bills[0];
            const due = (first.balanceAmount ?? 0) > 0 ? (first.balanceAmount ?? 0) : Math.max(0, first.netTotal - (first.paidAmount || 0));
            setSettlePrevAmount(due.toString());
            setCollectPrevBill(true);
          } else {
            setBillingMethod('NORMAL');
            setSettlePrevAmount('');
            setCollectPrevBill(false);
          }
        })
        .catch(() => {
          setCustomerUnpaidBills([]);
          setBillingMethod('NORMAL');
          setSettlePrevAmount('');
          setCollectPrevBill(false);
        });

      // Fetch pending pre-orders for this customer
      PreOrderService.getByCustomer(selectedCustomerId, 'PENDING')
        .then(pos => setCustomerPreOrders(Array.isArray(pos) ? pos : []))
        .catch(() => setCustomerPreOrders([]));
    } else {
      setCustomerUnpaidBills([]);
      setCustomerPreOrders([]);
      setFulfilledPreOrderIds([]);
    }
  }, [selectedCustomerId]);

  const handleAddPreOrderToCart = (preOrderId: string, item: any) => {
    const prod = products.find(p => p.id === item.productId) || item.product;
    if (!prod) return;
    const stockInfo = lorryStockMap.get(item.productId);
    const availableLorryStock = stockInfo?.stock || 0;
    if (availableLorryStock <= 0) {
      alert(`Cannot add ${prod.name} to bill: 0 floating stock currently available on this lorry.`);
      return;
    }
    const qtyToAdd = Math.min(item.quantity, availableLorryStock);

    // Add to cart using established helper
    addToCart(prod, qtyToAdd);

    if (!fulfilledPreOrderIds.includes(preOrderId)) {
      setFulfilledPreOrderIds(prev => [...prev, preOrderId]);
    }
    setAutoCheckinToast(`✓ Added ${prod.name} (×${qtyToAdd}) from Pre-Order to bill`);
    setTimeout(() => setAutoCheckinToast(null), 3500);
  };

  const handleCreatePreOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setErrorMessage('Please select a customer first to take a pre-order.');
      return;
    }
    if (!preOrderProductId) {
      setErrorMessage('Please select a product to pre-order.');
      return;
    }
    try {
      setSubmittingPreOrder(true);
      await PreOrderService.create({
        customerId: selectedCustomerId,
        lorryId: selectedLorryId || undefined,
        userId: user?.id,
        source: 'REP',
        notes: preOrderNotes.trim() || undefined,
        items: [{ productId: preOrderProductId, quantity: preOrderQty }]
      });
      setShowPreOrderModal(false);
      setPreOrderProductId('');
      setPreOrderQty(1);
      setPreOrderNotes('');
      setAutoCheckinToast('✓ Pre-order recorded! Will prompt on next store visit.');
      setTimeout(() => setAutoCheckinToast(null), 4000);

      const pos = await PreOrderService.getByCustomer(selectedCustomerId, 'PENDING');
      setCustomerPreOrders(Array.isArray(pos) ? pos : []);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Error recording pre-order');
    } finally {
      setSubmittingPreOrder(false);
    }
  };

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const query = customerSearch.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(query) ||
      (c.phone && c.phone.toLowerCase().includes(query)) ||
      (c.code && c.code.toLowerCase().includes(query)) ||
      (c.deliveryAddress && c.deliveryAddress.toLowerCase().includes(query))
    );
  }, [customers, customerSearch]);

  // Optimized stops with search filtering
  const routeStopsList = useMemo(() => {
    if (!routeOptimization || !routeOptimization.stops || routeOptimization.stops.length === 0) {
      return null;
    }
    if (!customerSearch.trim()) {
      return routeOptimization.stops;
    }
    const q = customerSearch.toLowerCase();
    return routeOptimization.stops.filter(
      s =>
        s.customer.name.toLowerCase().includes(q) ||
        (s.customer.phone && s.customer.phone.toLowerCase().includes(q)) ||
        (s.customer.code && s.customer.code.toLowerCase().includes(q)) ||
        (s.customer.deliveryAddress && s.customer.deliveryAddress.toLowerCase().includes(q))
    );
  }, [routeOptimization, customerSearch]);

  // Distinct Brands (only from lorry-loaded items)
  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    lorryProducts.forEach(p => {
      if (p.category && p.category.trim()) {
        brands.add(p.category.trim());
      }
    });
    return Array.from(brands).sort();
  }, [lorryProducts]);

  // Brand products (only lorry-loaded)
  const brandProducts = useMemo(() => {
    if (!selectedBrand) return [];
    return lorryProducts.filter(p => {
      const matchBrand = p.category.toLowerCase() === selectedBrand.toLowerCase();
      if (!matchBrand) return false;
      if (!itemSearch.trim()) return true;
      const q = itemSearch.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    });
  }, [lorryProducts, selectedBrand, itemSearch]);

  // Cart Management
  const addToCart = (product: Product, qty: number = 1) => {
    if (!selectedCustomerId) {
      alert('Please select a customer first before adding items to cart.');
      return;
    }
    const stockInfo = lorryStockMap.get(product.id);
    const lorryStock = stockInfo ? stockInfo.stock : product.currentStock;
    if (lorryStock <= 0) {
      return;
    }
    const buyRatio = product.freeRatioBuy || 0;
    const getRatio = product.freeRatioGet || 0;
    const calcFree = (q: number) => (buyRatio > 0 && getRatio > 0 && q > 0 ? Math.floor(q / buyRatio) * getRatio : 0);

    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        const nextQty = existing.quantity + qty;
        if (qty > 0 && nextQty > lorryStock) {
          return prev; // Block adding more than available lorry stock
        }
        if (nextQty <= 0 && (existing.freeQuantity || 0) <= 0) {
          return prev.filter(i => i.productId !== product.id);
        }
        const safeQty = Math.min(lorryStock, Math.max(0, nextQty));
        const resolved = resolveTierUnitPrice(product, safeQty, {
          manualPrice: existing.unitPrice,
          isManual: existing.isManualPrice
        });
        return prev.map(i => i.productId === product.id ? {
          ...i,
          quantity: safeQty,
          unitPrice: resolved.unitPrice,
          isTierPrice: resolved.isTierPrice,
          activeTierMinQty: resolved.activeTier?.minQty,
          freeQuantity: existing.manualFree ? existing.freeQuantity : calcFree(safeQty)
        } : i);
      }
      const initialQty = Math.min(lorryStock, Math.max(1, qty));
      const resolved = resolveTierUnitPrice(product, initialQty);
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          category: product.category,
          unit: product.unit,
          unitPrice: resolved.unitPrice,
          originalUnitPrice: product.unitPrice,
          isTierPrice: resolved.isTierPrice,
          activeTierMinQty: resolved.activeTier?.minQty,
          isManualPrice: false,
          availableStock: lorryStock,
          quantity: initialQty,
          freeQuantity: calcFree(initialQty),
          manualFree: false,
          discountPercent: 0
        }
      ];
    });
  };

  const addFreeToCart = (product: Product, freeQty: number = 1) => {
    if (!selectedCustomerId) {
      alert('Please select a customer first before adding items to cart.');
      return;
    }
    const stockInfo = lorryStockMap.get(product.id);
    const regularStock = stockInfo ? stockInfo.stock : product.currentStock;
    const freeStock = stockInfo ? (stockInfo.freeStock || 0) : (product.freeStock || 0);
    const totalLorryStock = regularStock + freeStock;
    if (totalLorryStock <= 0) {
      return;
    }

    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        const currentBilled = existing.quantity || 0;
        const currentFree = existing.freeQuantity || 0;
        if (currentBilled + currentFree + freeQty > totalLorryStock) {
          return prev; // Block adding free units beyond available lorry stock
        }
        const nextFree = currentFree + freeQty;
        return prev.map(i => i.productId === product.id ? {
          ...i,
          freeQuantity: Math.max(0, nextFree),
          manualFree: true
        } : i);
      }
      if (freeQty > totalLorryStock) {
        return prev;
      }
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          category: product.category,
          unit: product.unit,
          unitPrice: product.unitPrice,
          originalUnitPrice: product.unitPrice,
          availableStock: regularStock,
          quantity: 0,
          freeQuantity: Math.min(totalLorryStock, Math.max(1, freeQty)),
          manualFree: true,
          discountPercent: 0
        }
      ];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    const product = products.find(p => p.id === productId);
    const stockInfo = lorryStockMap.get(productId);
    const lorryStock = stockInfo ? stockInfo.stock : (product?.currentStock ?? Infinity);
    const buyRatio = product?.freeRatioBuy || 0;
    const getRatio = product?.freeRatioGet || 0;
    const calcFree = (q: number) => (buyRatio > 0 && getRatio > 0 && q > 0 ? Math.floor(q / buyRatio) * getRatio : 0);

    setCart(prev =>
      prev
        .map(i => {
          if (i.productId === productId) {
            const next = i.quantity + delta;
            if (delta > 0 && next > lorryStock) {
              return i; // Hard blocker: Cannot exceed available lorry stock
            }
            const safeQty = Math.min(lorryStock, Math.max(0, next));
            const freeQty = i.manualFree ? i.freeQuantity : calcFree(safeQty);
            if (safeQty <= 0 && freeQty <= 0) {
              return null;
            }
            const resolved = product
              ? resolveTierUnitPrice(product, safeQty, {
                  manualPrice: i.unitPrice,
                  isManual: i.isManualPrice
                })
              : { unitPrice: i.unitPrice, isTierPrice: false, activeTier: null };

            return {
              ...i,
              quantity: safeQty,
              unitPrice: resolved.unitPrice,
              isTierPrice: resolved.isTierPrice,
              activeTierMinQty: resolved.activeTier?.minQty,
              freeQuantity: freeQty
            };
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const setCartItemQty = (productId: string, qty: number) => {
    const product = products.find(p => p.id === productId);
    const stockInfo = lorryStockMap.get(productId);
    const lorryStock = stockInfo ? stockInfo.stock : (product?.currentStock ?? Infinity);
    const buyRatio = product?.freeRatioBuy || 0;
    const getRatio = product?.freeRatioGet || 0;
    const calcFree = (q: number) => (buyRatio > 0 && getRatio > 0 && q > 0 ? Math.floor(q / buyRatio) * getRatio : 0);

    setCart(prev =>
      prev
        .map(i => {
          if (i.productId === productId) {
            const safeQty = Math.min(lorryStock, Math.max(0, qty));
            const freeQty = i.manualFree ? i.freeQuantity : calcFree(safeQty);
            if (safeQty <= 0 && freeQty <= 0) {
              return null;
            }
            const resolved = product
              ? resolveTierUnitPrice(product, safeQty, {
                  manualPrice: i.unitPrice,
                  isManual: i.isManualPrice
                })
              : { unitPrice: i.unitPrice, isTierPrice: false, activeTier: null };

            return {
              ...i,
              quantity: safeQty,
              unitPrice: resolved.unitPrice,
              isTierPrice: resolved.isTierPrice,
              activeTierMinQty: resolved.activeTier?.minQty,
              freeQuantity: freeQty
            };
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const setCartItemUnitPrice = (productId: string, newPrice: number) => {
    setCart(prev =>
      prev.map(i => {
        if (i.productId === productId) {
          const safePrice = Math.max(0, newPrice);
          return {
            ...i,
            unitPrice: safePrice,
            isManualPrice: true,
            isTierPrice: false,
            activeTierMinQty: undefined
          };
        }
        return i;
      })
    );
  };

  const updateCartFreeQty = (productId: string, delta: number) => {
    const product = products.find(p => p.id === productId);
    const stockInfo = lorryStockMap.get(productId);
    const regularStock = stockInfo ? stockInfo.stock : (product?.currentStock ?? 0);
    const freeStock = stockInfo ? (stockInfo.freeStock || 0) : (product?.freeStock || 0);
    const totalLorryStock = regularStock + freeStock;

    setCart(prev =>
      prev
        .map(i => {
          if (i.productId === productId) {
            const currentBilled = i.quantity || 0;
            const currentFree = i.freeQuantity || 0;
            if (delta > 0 && currentBilled + currentFree + delta > totalLorryStock) {
              return i; // Block exceeding total lorry stock
            }
            const nextFree = Math.max(0, currentFree + delta);
            if (nextFree <= 0 && currentBilled <= 0) {
              return null;
            }
            return {
              ...i,
              freeQuantity: nextFree,
              manualFree: true
            };
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const setCartItemFreeQty = (productId: string, freeQty: number) => {
    const product = products.find(p => p.id === productId);
    const stockInfo = lorryStockMap.get(productId);
    const regularStock = stockInfo ? stockInfo.stock : (product?.currentStock ?? 0);
    const freeStock = stockInfo ? (stockInfo.freeStock || 0) : (product?.freeStock || 0);
    const totalLorryStock = regularStock + freeStock;

    setCart(prev =>
      prev
        .map(i => {
          if (i.productId === productId) {
            const maxFree = Math.max(0, totalLorryStock - (i.quantity || 0));
            const safeFree = Math.min(maxFree, Math.max(0, freeQty));
            if (safeFree <= 0 && i.quantity <= 0) {
              return null;
            }
            return {
              ...i,
              freeQuantity: safeFree,
              manualFree: true
            };
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const resetCartItemFreeQty = (productId: string) => {
    const product = products.find(p => p.id === productId);
    const buyRatio = product?.freeRatioBuy || 0;
    const getRatio = product?.freeRatioGet || 0;
    const calcFree = (q: number) => (buyRatio > 0 && getRatio > 0 && q > 0 ? Math.floor(q / buyRatio) * getRatio : 0);

    setCart(prev =>
      prev.map(i => {
        if (i.productId === productId) {
          return {
            ...i,
            freeQuantity: calcFree(i.quantity),
            manualFree: false
          };
        }
        return i;
      })
    );
  };

  const removeCartItem = (productId: string) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
  };

  // Auto-sync customer default discount to bill discount when customer changes (unless manually adjusted)
  useEffect(() => {
    if (selectedCustomer && !billDiscountManual) {
      setBillDiscountType('%');
      setBillDiscountValue(selectedCustomer.discountPercentage || 0);
    }
  }, [selectedCustomerId, selectedCustomer, billDiscountManual]);

  const toggleItemDiscountOpen = (productId: string) => {
    setOpenItemDiscounts(prev => ({ ...prev, [productId]: !prev[productId] }));
  };

  const setCartItemDiscountType = (productId: string, type: '%' | 'Rs') => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        return { ...item, discountType: type };
      }
      return item;
    }));
  };

  const setCartItemDiscountVal = (productId: string, val: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        if (item.discountType === 'Rs') {
          return { ...item, discountAmount: val, discountPercent: 0 };
        } else {
          return { ...item, discountPercent: val, discountAmount: 0 };
        }
      }
      return item;
    }));
  };

  const clearCartItemDiscount = (productId: string) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        return { ...item, discountPercent: 0, discountAmount: 0 };
      }
      return item;
    }));
  };

  const calculateCartItemDiscount = (item: CartItem) => {
    const itemGross = item.unitPrice * (item.quantity || 0);
    if (itemGross <= 0) return 0;
    if (item.discountType === 'Rs') {
      return Math.min(itemGross, item.discountAmount || 0);
    }
    const pct = Math.min(100, Math.max(0, item.discountPercent || 0));
    return (itemGross * pct) / 100;
  };

  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const totalItemDiscounts = useMemo(() => {
    return cart.reduce((sum, item) => sum + calculateCartItemDiscount(item), 0);
  }, [cart]);

  const subtotalAfterItemDiscounts = Math.max(0, cartSubtotal - totalItemDiscounts);

  const billDiscountAmount = useMemo(() => {
    if (billDiscountType === 'Rs') {
      return Math.min(subtotalAfterItemDiscounts, billDiscountValue || 0);
    }
    const pct = Math.min(100, Math.max(0, billDiscountValue || 0));
    return (subtotalAfterItemDiscounts * pct) / 100;
  }, [subtotalAfterItemDiscounts, billDiscountType, billDiscountValue]);

  const billDiscountPercentage = useMemo(() => {
    if (billDiscountType === '%') return billDiscountValue || 0;
    return subtotalAfterItemDiscounts > 0 ? (billDiscountAmount / subtotalAfterItemDiscounts) * 100 : 0;
  }, [subtotalAfterItemDiscounts, billDiscountType, billDiscountValue, billDiscountAmount]);

  const totalDiscountAmount = totalItemDiscounts + billDiscountAmount;

  const totalItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const totalFreeItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.freeQuantity || 0), 0);
  }, [cart]);

  const availableReturnCredit = selectedCustomer?.returnCreditBalance || 0;
  const appliedReturnCredit = useMemo(() => {
    if (!useReturnCredit || availableReturnCredit <= 0) return 0;
    const grossAfterDiscounts = Math.max(0, cartSubtotal - totalDiscountAmount);
    return Math.min(availableReturnCredit, grossAfterDiscounts);
  }, [useReturnCredit, availableReturnCredit, cartSubtotal, totalDiscountAmount]);

  const { deliveredBottles, bottleDepositRate } = useMemo(() => {
    let total = 0;
    let rate = 120;
    for (const item of cart) {
      const prod = products.find(p => p.id === item.productId);
      if (prod?.isReturnableBottle) {
        const perUnit = prod.bottlesPerUnit && prod.bottlesPerUnit > 0 ? prod.bottlesPerUnit : 1;
        total += (item.quantity + (item.freeQuantity || 0)) * perUnit;
        if (prod.bottleDepositFee && prod.bottleDepositFee > 0) {
          rate = prod.bottleDepositFee;
        }
      }
    }
    return { deliveredBottles: total, bottleDepositRate: rate };
  }, [cart, products]);

  const bottleChargeAmount = useMemo(() => {
    return (bottleState.damaged + (bottleState.chargeMissing ? bottleState.missing : 0)) * bottleDepositRate;
  }, [bottleState, bottleDepositRate]);

  const finalTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - totalDiscountAmount - appliedReturnCredit) + bottleChargeAmount;
  }, [cartSubtotal, totalDiscountAmount, appliedReturnCredit, bottleChargeAmount]);

  // Date-filtered bills (filtered by selected date range)
  const dateFilteredBills = useMemo(() => {
    return finishedBills.filter(bill => {
      if (billsDatePreset !== 'all' && billsDateRange.from && billsDateRange.to) {
        const billTime = new Date(bill.createdAt).getTime();
        const start = new Date(billsDateRange.from).getTime();
        const end = new Date(billsDateRange.to).getTime();
        if (billTime < start || billTime > end) {
          return false;
        }
      }
      return true;
    });
  }, [finishedBills, billsDatePreset, billsDateRange]);

  // Finished Bills Filter & Summary
  const filteredFinishedBills = useMemo(() => {
    return dateFilteredBills.filter(bill => {
      if (billsFilter !== 'ALL' && bill.paymentMethod !== billsFilter) {
        return false;
      }
      if (billsSearch.trim()) {
        const q = billsSearch.toLowerCase();
        const matchesSlip = (bill.paperBillNumber || '').toLowerCase().includes(q);
        const matchesOrder = bill.orderNumber.toLowerCase().includes(q);
        const matchesCust = (bill.customer?.name || '').toLowerCase().includes(q);
        const matchesShop = (bill.customer?.companyName || '').toLowerCase().includes(q);
        const matchesCode = (bill.customer?.code || '').toLowerCase().includes(q);
        const matchesPhone = (bill.customer?.phone || '').toLowerCase().includes(q);
        return matchesSlip || matchesOrder || matchesCust || matchesShop || matchesCode || matchesPhone;
      }
      return true;
    });
  }, [dateFilteredBills, billsFilter, billsSearch]);

  const finishedBillsSummary = useMemo(() => {
    const totalBills = filteredFinishedBills.length;
    const totalValue = filteredFinishedBills.reduce((acc: number, b: Order) => acc + (b.netTotal || 0), 0);
    const totalCash = filteredFinishedBills.reduce((acc: number, b: Order) => acc + (b.cashReceived || 0), 0);
    const cashBills = filteredFinishedBills.filter((b: Order) => b.paymentMethod === 'CASH');
    const creditBills = filteredFinishedBills.filter((b: Order) => b.paymentMethod === 'CREDIT');
    const chequeBills = filteredFinishedBills.filter((b: Order) => b.paymentMethod === 'CHEQUE');
    const totalCheque = chequeBills.reduce((acc: number, b: Order) => acc + (b.netTotal || 0), 0);
    const totalCredit = filteredFinishedBills.reduce((acc: number, b: Order) => {
      if (b.paymentMethod === 'CHEQUE') return acc;
      return acc + (b.balanceAmount !== undefined ? b.balanceAmount : Math.max(0, (b.netTotal || 0) - (b.cashReceived || 0)));
    }, 0);
    return {
      totalBills,
      totalValue,
      totalCash,
      totalCredit,
      totalCheque,
      cashCount: cashBills.length,
      creditCount: creditBills.length,
      chequeCount: chequeBills.length
    };
  }, [filteredFinishedBills]);

  // Item-Wise Sales Aggregation for Agent View (Filtered seamlessly by billsDateRange & billsFilter)
  const itemWiseSalesData = useMemo(() => {
    const map = new Map<
      string,
      {
        productId: string;
        sku: string;
        name: string;
        category: string;
        unit: string;
        unitPrice: number;
        soldQuantity: number;
        freeQuantity: number;
        totalQuantity: number;
        totalRevenue: number;
        billsCount: number;
      }
    >();

    dateFilteredBills.forEach((bill: Order) => {
      if (billsFilter !== 'ALL' && bill.paymentMethod !== billsFilter) {
        return;
      }

      bill.items?.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId) || item.product;
        const prodId = item.productId || prod?.id || item.product?.id || 'unknown';
        const name = prod?.name || item.product?.name || 'Unknown Item';
        const sku = prod?.sku || item.product?.sku || 'SKU';
        const category = prod?.category || item.product?.category || 'General';
        const unit = prod?.unit || item.product?.unit || 'units';
        const unitPrice = item.unitPrice || prod?.unitPrice || 0;
        const lineTotal = item.lineTotal !== undefined ? item.lineTotal : (item.quantity * unitPrice);

        const existing = map.get(prodId);
        if (existing) {
          existing.soldQuantity += item.quantity;
          existing.freeQuantity += item.freeQuantity || 0;
          existing.totalQuantity += item.quantity + (item.freeQuantity || 0);
          existing.totalRevenue += lineTotal;
          existing.billsCount += 1;
        } else {
          map.set(prodId, {
            productId: prodId,
            sku,
            name,
            category,
            unit,
            unitPrice,
            soldQuantity: item.quantity,
            freeQuantity: item.freeQuantity || 0,
            totalQuantity: item.quantity + (item.freeQuantity || 0),
            totalRevenue: lineTotal,
            billsCount: 1
          });
        }
      });
    });

    const allAggregated = Array.from(map.values());
    const totalSoldUnits = allAggregated.reduce((sum, i) => sum + i.soldQuantity, 0);
    const totalFreeUnits = allAggregated.reduce((sum, i) => sum + i.freeQuantity, 0);
    const totalRevenue = allAggregated.reduce((sum, i) => sum + i.totalRevenue, 0);

    // Apply item-specific search
    const filtered = itemSearchQuery.trim()
      ? allAggregated.filter((it) => {
        const q = itemSearchQuery.toLowerCase();
        return (
          it.name.toLowerCase().includes(q) ||
          it.sku.toLowerCase().includes(q) ||
          it.category.toLowerCase().includes(q)
        );
      })
      : allAggregated;

    // Apply sort
    filtered.sort((a, b) => {
      if (itemSortFilter === 'QTY_DESC') return b.soldQuantity - a.soldQuantity;
      if (itemSortFilter === 'REVENUE_DESC') return b.totalRevenue - a.totalRevenue;
      return a.name.localeCompare(b.name);
    });

    return {
      items: filtered,
      totalSKUs: allAggregated.length,
      filteredSKUs: filtered.length,
      totalSoldUnits,
      totalFreeUnits,
      totalRevenue
    };
  }, [dateFilteredBills, billsFilter, itemSearchQuery, itemSortFilter, products]);

  // Checkout submission
  const handleFinalCheckout = async () => {
    if (isSubmittingCheckoutRef.current || submitting) {
      console.warn('[RepBilling] Checkout submission in progress, ignoring duplicate tap.');
      return;
    }

    if (!selectedCustomerId) {
      setErrorMessage('Please select a customer first.');
      setCurrentStep(1);
      return;
    }
    if (cart.length === 0) {
      setErrorMessage('Please add at least one product to the cart.');
      setCurrentStep(3);
      return;
    }

    if (paymentMethod === 'CHEQUE') {
      if (!chequeNumber.trim()) {
        setErrorMessage('Please enter the Cheque Number.');
        return;
      }
      if (!bankName.trim()) {
        setErrorMessage('Please enter or select the Bank Name.');
        return;
      }
    }

    if (paymentMethod === 'CREDIT' && selectedCustomer?.creditRisk?.isCreditBlocked && !adminOverridePasscode) {
      setShowAdminPasscodeModal(true);
      return;
    }

    isSubmittingCheckoutRef.current = true;
    try {
      setSubmitting(true);
      setErrorMessage(null);

      const itemsPayload = cart.map(item => {
        const itemGross = item.unitPrice * (item.quantity || 0);
        let itemDiscAmount = 0;
        let itemDiscPercent = 0;
        if (item.discountType === 'Rs') {
          itemDiscAmount = Math.min(itemGross, item.discountAmount || 0);
          itemDiscPercent = itemGross > 0 ? (itemDiscAmount / itemGross) * 100 : 0;
        } else {
          itemDiscPercent = Math.min(100, Math.max(0, item.discountPercent || 0));
          itemDiscAmount = (itemGross * itemDiscPercent) / 100;
        }
        return {
          productId: item.productId,
          quantity: item.quantity,
          freeQuantity: item.freeQuantity || 0,
          unitPrice: item.unitPrice,
          discountPercent: itemDiscPercent,
          discountAmount: itemDiscAmount
        };
      });

      const previousBillsPayload =
        billingMethod === 'BILL_TO_BILL' && collectPrevBill && customerUnpaidBills.length > 0 && customerUnpaidBills[0]
          ? [
            {
              orderId: customerUnpaidBills[0].id,
              amount: parseFloat(settlePrevAmount) || 0,
              paymentMethod: paymentMethod === 'CREDIT' ? 'CASH' : paymentMethod
            }
          ]
          : [];

      // Generate a globally unique client reference ID for idempotency deduplication
      const clientBillRef = `BILL-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

      const orderPayload: any = {
        paperBillNumber: clientBillRef,
        customerId: selectedCustomerId,
        paymentMethod,
        items: itemsPayload,
        discountAmount: billDiscountAmount,
        discountPercentage: billDiscountPercentage,
        appliedCreditAmount: appliedReturnCredit > 0 ? appliedReturnCredit : undefined,
        notes: notes.trim() || undefined,
        settlePreviousBills: previousBillsPayload,
        latitude: currentGpsCoords?.lat,
        longitude: currentGpsCoords?.lng,
        adminOverridePasscode: adminOverridePasscode || undefined,
        fulfilledPreOrderIds: fulfilledPreOrderIds.length > 0 ? fulfilledPreOrderIds : undefined,
        bottleExchange:
          deliveredBottles > 0 || bottleState.returnedGood > 0 || bottleState.damaged > 0 || bottleState.missing > 0
            ? {
                deliveredBottles,
                returnedGoodBottles: bottleState.returnedGood,
                damagedBottles: bottleState.damaged,
                missingBottles: bottleState.missing,
                chargeMissing: bottleState.chargeMissing,
                bottleDepositRate
              }
            : undefined
      };

      if (paymentMethod === 'CHEQUE') {
        orderPayload.chequeNumber = chequeNumber.trim();
        orderPayload.bankName = bankName.trim();
        orderPayload.chequeDate = chequeDate || undefined;
      }

      let createdOrder: Order;
      const isCurrentlyOffline = !navigator.onLine;

      const createOfflineOrder = (): Order => {
        const queuedBill: QueuedOfflineBill = {
          localId: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          orderNumber: clientBillRef,
          lorryId: selectedLorryId || undefined,
          payload: { ...orderPayload, paperBillNumber: clientBillRef },
          createdAt: new Date().toISOString(),
          customerName: selectedCustomer?.name || 'Customer',
          totalAmount: finalTotal,
          itemsCount: totalItemsCount,
          paymentMethod
        };
        OfflineSyncService.saveOfflineBill(queuedBill);
        setPendingBillsCount(OfflineSyncService.getPendingBills().length);

        return {
          id: queuedBill.localId,
          orderNumber: queuedBill.orderNumber,
          customerId: selectedCustomerId,
          customer: selectedCustomer!,
          lorryId: selectedLorryId || null,
          lorry: selectedLorry || null,
          status: 'DELIVERED',
          paymentStatus: paymentMethod === 'CREDIT' ? 'UNPAID' : 'PAID',
          paymentMethod,
          chequeNumber: chequeNumber.trim() || null,
          bankName: bankName.trim() || null,
          chequeDate: chequeDate || null,
          subtotal: cartSubtotal,
          discountAmount: totalDiscountAmount,
          appliedCreditAmount: appliedReturnCredit > 0 ? appliedReturnCredit : undefined,
          taxAmount: 0,
          netTotal: finalTotal,
          cashReceived: paymentMethod === 'CASH' ? finalTotal : 0,
          paidAmount: paymentMethod === 'CASH' ? finalTotal : 0,
          balanceAmount: paymentMethod === 'CREDIT' ? finalTotal : 0,
          notes: notes.trim() || null,
          latitude: currentGpsCoords?.lat || null,
          longitude: currentGpsCoords?.lng || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: cart.map(item => ({
            id: `item_${Date.now()}_${item.productId}`,
            orderId: queuedBill.localId,
            productId: item.productId,
            product: products.find(p => p.id === item.productId)!,
            quantity: item.quantity,
            freeQuantity: item.freeQuantity || 0,
            unitPrice: item.unitPrice,
            lineTotal: item.unitPrice * item.quantity
          }))
        };
      };

      if (!isCurrentlyOffline) {
        try {
          if (selectedLorryId) {
            createdOrder = await LorryService.enterDriverBill(selectedLorryId, orderPayload);
          } else {
            createdOrder = await OrderService.create(orderPayload);
          }
        } catch (apiErr: any) {
          const isNetErr = !apiErr.response || apiErr.code === 'ERR_NETWORK' || apiErr.message?.toLowerCase().includes('network') || apiErr.message?.toLowerCase().includes('failed to fetch');
          if (isNetErr) {
            createdOrder = createOfflineOrder();
          } else {
            throw apiErr;
          }
        }
      } else {
        createdOrder = createOfflineOrder();
      }

      setCheckoutSuccessOrder(createdOrder);

      // Deduct from local lorry stock in memory immediately (live UI update for next bill & stock views)
      if (selectedLorryId) {
        setLorries(prev => prev.map(l => {
          if (l.id === selectedLorryId && Array.isArray(l.lorryStocks)) {
            return {
              ...l,
              lorryStocks: l.lorryStocks.map(ls => {
                const cartItem = cart.find(ci => ci.productId === ls.productId);
                if (cartItem) {
                  return {
                    ...ls,
                    quantity: Math.max(0, ls.quantity - cartItem.quantity),
                    freeQuantity: Math.max(0, (ls.freeQuantity || 0) - (cartItem.freeQuantity || 0))
                  };
                }
                return ls;
              })
            };
          }
          return l;
        }));
      }

      // Decrement customer's locally cached return credit if applied
      if (appliedReturnCredit > 0 && selectedCustomerId) {
        setCustomers(prev => prev.map(c => {
          if (c.id === selectedCustomerId) {
            return {
              ...c,
              returnCreditBalance: Math.max(0, (c.returnCreditBalance || 0) - appliedReturnCredit)
            };
          }
          return c;
        }));
      }
      if (navigator.onLine) {
        await Promise.all([
          loadTargets(selectedLorryId || undefined),
          loadFinishedBills(selectedLorryId || undefined),
          loadOptimizedRoute(),
          LorryService.getAll().then(updatedLorries => {
            if (Array.isArray(updatedLorries) && updatedLorries.length > 0) {
              setLorries(updatedLorries);
              OfflineSyncService.cacheRepData({
                customers,
                products,
                lorries: updatedLorries,
                lorryStockMap
              });
            }
          }).catch(err => console.warn('Lorry stock live reload warning:', err))
        ]);
      } else {
        setFinishedBills(prev => [createdOrder, ...prev]);
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to complete bill.');
    } finally {
      setSubmitting(false);
      isSubmittingCheckoutRef.current = false;
    }
  };

  const handleStartNewBill = () => {
    setCart([]);
    setBottleState({ returnedGood: 0, damaged: 0, missing: 0, chargeMissing: false });
    setSelectedCustomerId('');
    setAdminOverridePasscode(null);
    setAuthorizedByName(null);
    setShowAdminPasscodeModal(false);
    setBillingMethod('NORMAL');
    setCustomerUnpaidBills([]);
    setSettlePrevAmount('');
    setCollectPrevBill(false);
    setChequeNumber('');
    setBankName('');
    setChequeDate(new Date().toISOString().split('T')[0]);
    setCheckoutSuccessOrder(null);
    setCurrentStep(1);
    setCustomerSearch('');
    setItemSearch('');
    loadTargets(selectedLorryId || undefined);
    loadFinishedBills(selectedLorryId || undefined);
    loadOptimizedRoute();
    if (navigator.onLine) {
      LorryService.getAll().then(updatedLorries => {
        if (Array.isArray(updatedLorries) && updatedLorries.length > 0) {
          setLorries(updatedLorries);
        }
      }).catch(err => console.warn('Lorry stock reload on new bill warning:', err));
    }
  };

  const handleCancelCheckout = () => {
    if (window.confirm('Are you sure you want to cancel this bill? The current cart items will be cleared.')) {
      handleStartNewBill();
    }
  };

  const stepLabels = ['Customer', 'Cart', 'Brand', 'Items', 'Checkout'];

  if (loading) {
    return (
      <div className="flex-1 min-h-[80vh] flex items-center justify-center text-slate-400 text-xs">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  // MANDATORY GPS GATE: Sales Reps cannot pass or enter until mobile GPS is active and authorized!
  // Ultra-Minimal Apple iOS Style Pure Black Lock Screen
  if (isRepRole && gpsStatus !== 'GRANTED') {
    return (
      <div className="min-h-screen w-full flex flex-col justify-between bg-black text-white select-none px-6 py-8 sm:p-10 font-sans">
        {/* Top Minimal Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
              <Truck className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-medium text-zinc-400">
              {selectedLorry?.vehicleNumber || user?.lorry?.vehicleNumber || 'Route Lorry'}
            </span>
          </div>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition cursor-pointer flex items-center gap-1.5 py-1 px-2.5 rounded-full hover:bg-zinc-900"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>
          )}
        </div>

        {/* Center Minimalist Apple Card */}
        <div className="my-auto max-w-sm mx-auto w-full text-center flex flex-col items-center">
          {/* Apple-style Location Glyph */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full bg-zinc-900/90 border border-zinc-800 flex items-center justify-center shadow-2xl">
              <Navigation className="w-8 h-8 text-white -rotate-45 fill-white/20" />
            </div>
            {isVerifyingGps && (
              <div className="absolute inset-0 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            )}
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 text-[11px] font-medium tracking-wide mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>GPS Required</span>
          </div>

          <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
            Enable Location
          </h2>

          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-xs mb-8">
            Live GPS is required during your shift to track deliveries, verify store visits, and update the fleet map.
          </p>

          {/* Error Message (Apple Alert Style) */}
          {gpsError && (
            <div className="w-full text-left p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-zinc-300 mb-6 text-xs backdrop-blur-md">
              <div className="flex items-center gap-2 mb-2 text-rose-400 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{gpsError}</span>
              </div>
              <ol className="text-[11px] text-zinc-400 space-y-1 list-decimal list-inside pl-1">
                <li>Turn ON Location in phone settings</li>
                <li>Tap 🔒 in browser bar & allow location</li>
                <li>Tap below to re-verify</li>
              </ol>
            </div>
          )}

          {/* Apple Solid White Action Button */}
          <button
            type="button"
            onClick={() => verifyAndEnableGps()}
            disabled={isVerifyingGps}
            className="w-full py-3.5 px-6 rounded-full bg-white hover:bg-zinc-200 active:scale-98 text-black font-semibold text-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-white/5"
          >
            {isVerifyingGps ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Connecting to GPS...</span>
              </>
            ) : (
              <span>Turn On GPS</span>
            )}
          </button>
        </div>

        {/* Minimal Bottom Brand */}
        <div className="text-center text-[11px] text-zinc-600">
          <span>Active shift telemetry &bull; Private & secure</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#F8FAFC] text-slate-900 select-none pb-20">
      {/* 1. SINGLE UNIFIED SLIM HEADER (APPLE iOS MINIMAL STYLE) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3.5 sm:px-5 py-2.5 flex items-center justify-between shadow-2xs">
        {/* Left: Rep Identity & Route + Tap-to-toggle GPS Beacon Pill */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8.5 h-8.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
            <Truck className="w-4.5 h-4.5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                {user?.fullName || 'Route Rep'}
              </h1>
              {user?.role === 'REP' && (
                <button
                  type="button"
                  onClick={() => verifyAndEnableGps(true)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border transition cursor-pointer shrink-0 bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                  title="GPS broadcasting live to office map (Tap to refresh coordinates)"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>GPS Live</span>
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
              <span className="font-semibold text-slate-700">{selectedLorry?.vehicleNumber || 'Route Lorry'}</span>
              {selectedLorry?.route && (
                <span className="text-slate-500"> • {selectedLorry.route.name || selectedLorry.route.code}</span>
              )}
            </p>
          </div>
        </div>

        {/* Right: Only 4 Ergonomic Touch Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Offline Sync Button & Status Badge */}
          {pendingBillsCount > 0 && (
            <button
              type="button"
              onClick={handleSyncPending}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 active:scale-95 text-white transition shadow-2xs cursor-pointer border border-amber-600 animate-pulse"
              title={`${pendingBillsCount} offline bills ready to sync with cloud. Click to sync now.`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden xs:inline sm:inline">Sync</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-white text-amber-700">
                {pendingBillsCount}
              </span>
            </button>
          )}

          {!isOnline && (
            <div
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-800 text-amber-400 text-[11px] font-bold border border-slate-700"
              title="No internet connection. Working in offline mode. Bills will sync when connection returns."
            >
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Offline</span>
            </div>
          )}

          {/* Quick Available Stock to Bill Button */}
          <button
            type="button"
            onClick={() => setShowStockPage(true)}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer border bg-slate-100 text-slate-700 border-slate-200/80 hover:bg-slate-200"
            title="View Available Stock to Bill"
          >
            <Boxes className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden xs:inline sm:inline">Stock</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-blue-100 text-blue-700">
              {lorryProducts.length}
            </span>
          </button>

          {/* Quick Item-Wise Sales Button with Date Filter */}
          <button
            type="button"
            onClick={() => {
              setBillsViewMode('ITEMS');
              loadFinishedBills();
              setShowFinishedBillsModal(true);
            }}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer border bg-emerald-50 text-emerald-800 border-emerald-200/90 hover:bg-emerald-100"
            title="View Item-Wise Sales & Quantities with Date Filter"
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden xs:inline sm:inline">Item Sales</span>
            {itemWiseSalesData.items.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-emerald-200/80 text-emerald-900">
                {itemWiseSalesData.items.length}
              </span>
            )}
          </button>

          {/* Quick Barcode Scanner Icon */}
          <button
            type="button"
            onClick={() => setShowBarcodeScanner(true)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 hover:text-slate-900 transition shadow-2xs cursor-pointer border border-slate-200/60"
            title="Scan Product Barcode"
            aria-label="Scan Product Barcode"
          >
            <Camera className="w-4 h-4 text-slate-700" />
          </button>

          {/* Quick Cart Action Button - Locked until customer is selected */}
          <button
            type="button"
            disabled={!selectedCustomerId}
            onClick={() => setCurrentStep(2)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs border ${!selectedCustomerId
              ? 'bg-slate-100 text-slate-400 border-slate-200/60 opacity-60 cursor-not-allowed select-none'
              : cart.length > 0
                ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/20 active:scale-95 cursor-pointer'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 active:scale-95 cursor-pointer'
              }`}
            title={!selectedCustomerId ? 'Locked: Select a customer first' : 'View Cart'}
          >
            {!selectedCustomerId ? (
              <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            ) : (
              <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>Cart</span>
            {selectedCustomerId && totalItemsCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${cart.length > 0 ? 'bg-white text-blue-700' : 'bg-slate-300 text-slate-800'
                }`}>
                {totalItemsCount}
              </span>
            )}
          </button>

          {/* Display Font Size Quick Toggle */}
          <FontSizeButton showLabel />

          {/* Shift Hub (•••) Consolidated Menu Button */}
          <button
            type="button"
            onClick={() => setShowShiftHubModal(true)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 hover:text-slate-900 transition shadow-2xs cursor-pointer border border-slate-200/60 relative"
            title="Shift Hub & Route Menu"
            aria-label="Shift Hub Menu"
          >
            <MoreHorizontal className="w-4 h-4 text-slate-700" />
            {(finishedBills.length > 0 || (targetProgress && targetProgress.dailyPercentage > 0)) && (
              <span className="w-2 h-2 rounded-full bg-blue-600 absolute top-1.5 right-1.5 ring-2 ring-white" />
            )}
          </button>
        </div>
      </header>

      {/* Floating Sync Toast */}
      {syncStatusToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2 rounded-2xl shadow-xl text-xs font-bold border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
          <span>{syncStatusToast}</span>
        </div>
      )}

      {/* 2. MINIMAL SLIM PROGRESS BAR (24px) */}
      <div className="bg-white border-b border-slate-200/60 px-4 py-2">
        <div className="max-w-2xl mx-auto flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
          <span className="text-blue-600 uppercase tracking-wider">
            {stepLabels[currentStep - 1]}
          </span>
          <span className="font-mono text-slate-400">Step {currentStep} / 5</span>
        </div>
        <div className="max-w-2xl mx-auto w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-blue-600 h-full rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* 2b. REP SHIFT ATTENDANCE BAR (ULTRA CLEAN, MINIMAL & FUNCTIONAL) */}
      {attendanceStatus && (
        <div className="bg-slate-50 border-b border-slate-200/70 px-3.5 sm:px-4 py-1.5 transition">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
            {!attendanceStatus.isCheckedIn ? (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Clock className="w-3 h-3" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-slate-800">Ready to start route shift?</span>
                    <span className="text-[10px] text-slate-500 hidden sm:inline ml-1.5">• Auto-marks HR attendance</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleCheckIn}
                    disabled={checkingInOut}
                    className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] font-bold shadow-2xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {checkingInOut ? <RefreshCw className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                    <span>Check In</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenSalarySlip}
                    className="px-2 py-1 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold shadow-2xs active:scale-95 transition flex items-center gap-1 cursor-pointer"
                    title="View My Salary Slip"
                  >
                    <FileText className="w-3 h-3 text-blue-600" />
                    <span>Payslip</span>
                  </button>
                </div>
              </>
            ) : !attendanceStatus.isCheckedOut ? (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-700 truncate">
                    <span className="font-bold text-slate-900">Shift Active</span>
                    <span className="text-slate-400">•</span>
                    <span>In at <strong className="text-slate-900 font-semibold">{attendanceStatus.checkInTime}</strong></span>
                    {attendanceStatus.dutyHours > 0 && (
                      <>
                        <span className="text-slate-400">•</span>
                        <span className="font-mono text-blue-600 font-bold">{attendanceStatus.dutyHours.toFixed(1)}h</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleCheckOut}
                    disabled={checkingInOut}
                    className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="Conclude route shift & calculate overtime hours"
                  >
                    {checkingInOut ? <RefreshCw className="w-3 h-3 animate-spin text-rose-600" /> : <LogOut className="w-3 h-3 text-rose-600" />}
                    <span>Check Out</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenSalarySlip}
                    className="px-2 py-1 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-slate-700 border border-slate-200 text-[11px] font-bold shadow-2xs transition flex items-center gap-1 cursor-pointer"
                    title="View My Salary Slip"
                  >
                    <FileText className="w-3 h-3 text-blue-600" />
                    <span>Payslip</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <div className="text-[11px] text-slate-600 truncate">
                    <span className="font-bold text-slate-800">Shift Concluded:</span> {attendanceStatus.checkInTime} – {attendanceStatus.checkOutTime}
                    <span className="font-mono text-slate-500 ml-1 font-semibold">({attendanceStatus.dutyHours.toFixed(1)}h{attendanceStatus.otHours > 0 ? ` • ${attendanceStatus.otHours.toFixed(1)}h OT` : ''})</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleOpenSalarySlip}
                  className="px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-slate-700 border border-slate-200 text-[11px] font-bold shadow-2xs transition flex items-center gap-1 cursor-pointer shrink-0"
                  title="View My Salary Slip"
                >
                  <FileText className="w-3 h-3 text-blue-600" />
                  <span>Payslip</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="max-w-2xl mx-auto w-full px-4 mt-3">
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-rose-700 text-xs font-medium">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-500 font-bold ml-2">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 3. STEP VIEWS (Clean, Single Page, Minimal Text) */}
      <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-3">
        {/* ======================================================== */}
        {/* STEP 1: SELECT CUSTOMER */}
        {/* ======================================================== */}
        {currentStep === 1 && (
          <div className="space-y-3">
            {/* Rep Sales Target Goal Widget */}
            {user?.monthlyTarget && user.monthlyTarget > 0 ? (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-2.5 flex items-center justify-between text-xs shadow-2xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <Target className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block text-[11px]">Monthly Goal</span>
                    <span className="text-[10px] text-slate-500 font-medium">Daily: {formatMoney(user.dailyTarget || 0)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded-lg shadow-2xs border border-blue-100 text-xs inline-block">
                    {formatMoney(user.monthlyTarget)}
                  </span>
                  {user.targetNewClients ? (
                    <span className="block text-[9px] text-slate-400 font-medium mt-0.5">Target: {user.targetNewClients} new shops</span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Geofence Auto-Checkin Floating Toast */}
            {autoCheckinToast && (
              <div className="p-3 bg-emerald-600 text-white rounded-2xl flex items-center justify-between text-xs font-bold shadow-md animate-in slide-in-from-top duration-300">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0" />
                  <span className="truncate">{autoCheckinToast}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoCheckinToast(null)}
                  className="text-white/80 hover:text-white px-2 py-0.5 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* AI TSP Next Recommended Stop Hero Card */}
            {routeOptimization?.nextStop && !customerSearch && (
              isNextStopMinimized ? (
                /* MINIMIZED SLIM NEXT STOP PILL */
                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 text-white rounded-2xl p-2.5 px-3.5 shadow-md border border-blue-400/30 flex items-center justify-between gap-2.5 transition-all duration-200">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[9.5px] font-bold tracking-wider uppercase border border-white/20">
                        <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                        <span>Next #{routeOptimization.nextStop.sequence}</span>
                      </div>

                      {/* Three Dots Button to Expand */}
                      <button
                        type="button"
                        onClick={toggleNextStopMinimized}
                        className="w-5 h-5 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white flex items-center justify-center transition border border-white/20 shadow-2xs cursor-pointer shrink-0"
                        title="Expand Next Stop details"
                        aria-label="Expand Next Stop card"
                      >
                        <MoreHorizontal className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="min-w-0 truncate">
                      <span className="font-bold text-xs text-white truncate mr-1.5">
                        {routeOptimization.nextStop.customer.name}
                      </span>
                      <span className="text-[10px] text-blue-200 font-mono">
                        (~{routeOptimization.nextStop.estimatedDriveTimeMinutes}m • {routeOptimization.nextStop.distanceFromPrevKm}km)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {routeOptimization.nextStop.customer.latitude != null && (
                      <button
                        type="button"
                        onClick={e => handleNavigateToCustomer(routeOptimization.nextStop!.customer, e)}
                        className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
                        title="Navigate in Google Maps"
                      >
                        <Navigation className="w-3 h-3 fill-white" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId(routeOptimization.nextStop!.customer.id);
                        setCurrentStep(2);
                      }}
                      className="py-1 px-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs transition flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <Receipt className="w-3 h-3" />
                      <span>Start</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* FULL EXPANDED HERO CARD */
                <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 text-white rounded-2xl p-4 shadow-md border border-blue-400/30 relative overflow-hidden transition-all duration-200">
                  <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />

                  {/* Header Badge with Three Dots Minimize Button */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-bold tracking-wider uppercase border border-white/20">
                        <Sparkles className="w-3 h-3 text-amber-300" />
                        <span>Next Stop • #{routeOptimization.nextStop.sequence}</span>
                      </div>

                      {/* Three Dots Button next to Next Stop Badge to Minimize */}
                      <button
                        type="button"
                        onClick={toggleNextStopMinimized}
                        className="w-6 h-6 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white flex items-center justify-center transition border border-white/20 shadow-2xs cursor-pointer shrink-0"
                        title="Minimize Next Stop card"
                        aria-label="Minimize Next Stop card"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-bold bg-black/30 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                      <Clock className="w-3 h-3 text-blue-200" />
                      <span>~{routeOptimization.nextStop.estimatedDriveTimeMinutes}m</span>
                      <span className="text-white/60">•</span>
                      <span>{routeOptimization.nextStop.distanceFromPrevKm} km</span>
                    </div>
                  </div>

                  {/* Store Name & Location */}
                  <div className="mb-3">
                    <h3 className="text-base font-bold text-white tracking-tight leading-snug break-words">
                      {routeOptimization.nextStop.customer.name}
                    </h3>
                    <p className="text-xs text-blue-100/90 font-medium truncate mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                      <span>{routeOptimization.nextStop.customer.deliveryAddress || routeOptimization.nextStop.customer.city || 'On delivery route'}</span>
                      {routeOptimization.nextStop.customer.phone && (
                        <>
                          <span className="text-blue-300">•</span>
                          <span>{routeOptimization.nextStop.customer.phone}</span>
                        </>
                      )}
                    </p>
                  </div>

                  {/* Geofence Status Badge */}
                  <div className="mb-3">
                    {routeOptimization.nextStop.isWithinGeofence ? (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 text-xs font-bold animate-pulse">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        <span>📍 Within 50m Geofence (Verified Stop)</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 text-blue-100 text-[11px] font-medium">
                        <Compass className="w-3 h-3 text-blue-300" />
                        <span>
                          {routeOptimization.nextStop.distanceFromCurrentKm < 900
                            ? (routeOptimization.nextStop.distanceFromCurrentKm >= 1
                              ? `${routeOptimization.nextStop.distanceFromCurrentKm.toFixed(1)} km away from lorry`
                              : `${Math.round(routeOptimization.nextStop.distanceFromCurrentKm * 1000)}m away from lorry`)
                            : 'En route on assigned delivery track'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Turn-by-Turn & Quick Bill Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={e => handleNavigateToCustomer(routeOptimization.nextStop!.customer, e)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-slate-100 active:scale-95 font-bold text-xs shadow-sm transition cursor-pointer"
                    >
                      <Navigation className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />
                      <span>Navigate (Maps)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId(routeOptimization.nextStop!.customer.id);
                        setCurrentStep(2);
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95 font-bold text-xs shadow-sm transition cursor-pointer"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Start Bill</span>
                    </button>
                  </div>
                </div>
              )
            )}

            {/* Smart Route Intelligence Strip & View Switcher */}
            {routeOptimization && (
              <div className="p-3 bg-black border border-slate-800 rounded-2xl space-y-2.5 shadow-md text-white">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Compass className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="font-bold text-white truncate">
                      {routeOptimization.routeName || routeOptimization.routeCode}
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="font-bold text-blue-400">
                      {routeOptimization.visitedCount} / {routeOptimization.totalCount} Visited
                    </span>
                  </div>

                  {routeOptimization.savedDistanceKm > 0 && (
                    <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-700/60 px-2 py-0.5 rounded-lg shrink-0">
                      Saved {routeOptimization.savedDistanceKm} km ({routeOptimization.savedPercentage}% Fuel)
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${routeOptimization.totalCount > 0
                        ? (routeOptimization.visitedCount / routeOptimization.totalCount) * 100
                        : 0
                        }%`
                    }}
                  />
                </div>

                {/* Mode Switcher */}
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setRouteViewMode('SMART_SEQUENCE')}
                    className={`py-1.5 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${routeViewMode === 'SMART_SEQUENCE'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-900 text-white hover:bg-slate-800 border border-slate-800 shadow-2xs'
                      }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-300" />
                    <span>Optimized Route</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRouteViewMode('ALL_CUSTOMERS')}
                    className={`py-1.5 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${routeViewMode === 'ALL_CUSTOMERS'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-900 text-white hover:bg-slate-800 border border-slate-800 shadow-2xs'
                      }`}
                  >
                    <Users className="w-3.5 h-3.5 text-slate-300" />
                    <span>All Stores ({customers.length})</span>
                  </button>
                </div>
              </div>
            )}

            {/* Search Input & Quick (+) Add Customer Button */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  placeholder="Search store name, phone or town..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
                {customerSearch && (
                  <button
                    type="button"
                    onClick={() => setCustomerSearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold w-4 h-4 flex items-center justify-center cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowAddCustomerModal(true)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition shrink-0 cursor-pointer"
                title="Add New Customer to Database"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span className="hidden sm:inline">Add Customer</span>
              </button>
            </div>

            {/* Empty State when no customer matches */}
            {((routeViewMode === 'SMART_SEQUENCE' && routeStopsList ? routeStopsList.length : filteredCustomers.length) === 0) && (
              <div className="p-6 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-2.5 my-2 shadow-2xs">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">No stores found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {customerSearch ? `No store matches "${customerSearch}"` : 'Your store list is empty'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Register New Customer</span>
                </button>
              </div>
            )}

            {/* Customer List (Rendered by Smart Route Sequence or Standard List) */}
            <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-0.5">
              {routeViewMode === 'SMART_SEQUENCE' && routeStopsList ? (
                // SMART TSP ROUTE SEQUENCE LIST
                routeStopsList.map(stop => {
                  const customer = stop.customer;
                  const isSelected = customer.id === selectedCustomerId;
                  const balance = customer.outstandingBalance || 0;
                  const hasDue = balance > 0;
                  const isVisited = stop.status === 'VISITED';
                  const isNext = stop.status === 'NEXT';

                  return (
                    <div
                      key={customer.id}
                      onClick={() => setSelectedCustomerId(customer.id)}
                      className={`cursor-pointer p-3 rounded-2xl border transition-all duration-150 flex items-start gap-2.5 shadow-xs ${isSelected
                        ? 'border-blue-600 bg-blue-100/85 ring-2 ring-blue-500/80 shadow-sm'
                        : isNext
                          ? 'border-indigo-300 bg-indigo-100/75 hover:border-indigo-400 hover:bg-indigo-100/90'
                          : isVisited
                            ? 'border-slate-300/90 bg-slate-200/75 hover:bg-slate-200'
                            : 'border-slate-300/90 bg-slate-200/75 hover:bg-slate-200 hover:border-slate-400'
                        }`}
                    >
                      {/* Sequence / Visited Indicator */}
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 transition shadow-2xs ${isVisited
                          ? 'bg-emerald-100 text-emerald-700'
                          : isNext
                            ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-200'
                            : 'bg-white text-slate-700 border border-slate-300'
                          }`}
                      >
                        {isVisited ? '✓' : `#${stop.sequence}`}
                      </div>

                      {/* Store Details: Completely Visible Name & Ultra-Clean Balanced Layout */}
                      <div className="min-w-0 flex-1 space-y-1">
                        {/* Top Line: Full Customer Name (Completely Visible) + "Good" Badge immediately next to it */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs text-slate-900 leading-snug break-words">
                            {customer.name}
                          </span>
                          <div className="shrink-0">
                            <CreditRiskBadge creditRisk={customer.creditRisk} compact />
                          </div>
                          {isNext && (
                            <span className="shrink-0 text-[9px] font-bold text-indigo-700 bg-indigo-200/80 px-1.5 py-0.2 rounded-md">
                              Next
                            </span>
                          )}
                          {stop.isWithinGeofence && (
                            <span className="shrink-0 text-[9px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.2 rounded-md animate-pulse">
                              📍 Here
                            </span>
                          )}
                        </div>

                        {/* Subtitle Line: Code • City/Address • Distance + Due Balance */}
                        <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-slate-600 font-medium">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {customer.code && (
                              <>
                                <span className="font-mono text-slate-500 text-[10px] shrink-0">
                                  {customer.code}
                                </span>
                                <span className="text-slate-400 shrink-0">•</span>
                              </>
                            )}
                            <span className="text-slate-700 font-semibold">{customer.city || customer.deliveryAddress || customer.phone || 'Angoda'}</span>
                            {stop.distanceFromCurrentKm != null && stop.distanceFromCurrentKm < 900 && (
                              <>
                                <span className="text-slate-400 shrink-0">•</span>
                                <span className="font-mono text-slate-600 text-[10.5px] shrink-0 font-medium">
                                  {stop.distanceFromCurrentKm >= 1
                                    ? `${stop.distanceFromCurrentKm.toFixed(1)} km`
                                    : `${Math.round(stop.distanceFromCurrentKm * 1000)}m`}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Due balance pill on subtitle row */}
                          {hasDue ? (
                            <span className="text-[10.5px] font-bold text-rose-700 bg-rose-50 border border-rose-200/90 px-2 py-0.5 rounded-lg font-mono shrink-0 shadow-2xs">
                              Due: {formatMoney(balance)}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-lg shrink-0 shadow-2xs">
                              Clear
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right Action Icons (Navigation & Selection Radio) */}
                      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                        {/* One-Tap Turn-by-Turn Navigation */}
                        {customer.latitude != null && customer.longitude != null && (
                          <button
                            type="button"
                            onClick={e => handleNavigateToCustomer(customer, e)}
                            className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition cursor-pointer shadow-2xs"
                            title="Navigate in Google Maps"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition shadow-2xs ${isSelected
                            ? 'bg-blue-600 text-white'
                            : 'border-2 border-slate-300 bg-white'
                            }`}
                        >
                          {isSelected && '✓'}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                // STANDARD ALL STORES LIST
                filteredCustomers.map(customer => {
                  const isSelected = customer.id === selectedCustomerId;
                  const balance = customer.outstandingBalance || 0;
                  const hasDue = balance > 0;

                  return (
                    <div
                      key={customer.id}
                      onClick={() => setSelectedCustomerId(customer.id)}
                      className={`cursor-pointer p-3 rounded-2xl border transition-all duration-150 flex items-start gap-2.5 shadow-xs ${isSelected
                        ? 'border-blue-600 bg-blue-100/85 ring-2 ring-blue-500/80 shadow-sm'
                        : 'border-slate-300/90 bg-slate-200/75 hover:bg-slate-200 hover:border-slate-400'
                        }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        {/* Top Line: Full Customer Name (Completely Visible) + "Good" Badge */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs text-slate-900 leading-snug break-words">
                            {customer.name}
                          </span>
                          <div className="shrink-0">
                            <CreditRiskBadge creditRisk={customer.creditRisk} compact />
                          </div>
                        </div>

                        {/* Subtitle Line: Code • City/Address + Due Balance */}
                        <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-slate-600 font-medium">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {customer.code && (
                              <>
                                <span className="font-mono text-slate-500 text-[10px] shrink-0">
                                  {customer.code}
                                </span>
                                <span className="text-slate-400 shrink-0">•</span>
                              </>
                            )}
                            <span className="text-slate-700 font-semibold">{customer.city || customer.deliveryAddress || customer.phone || 'No phone'}</span>
                          </div>

                          {hasDue ? (
                            <span className="text-[10.5px] font-bold text-rose-700 bg-rose-50 border border-rose-200/90 px-2 py-0.5 rounded-lg font-mono shrink-0 shadow-2xs">
                              Due: {formatMoney(balance)}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-lg shrink-0 shadow-2xs">
                              Clear
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                        {/* One-Tap Turn-by-Turn Navigation */}
                        {customer.latitude != null && customer.longitude != null && (
                          <button
                            type="button"
                            onClick={e => handleNavigateToCustomer(customer, e)}
                            className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition cursor-pointer shadow-2xs"
                            title="Navigate in Google Maps"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition shadow-2xs ${isSelected
                            ? 'bg-blue-600 text-white'
                            : 'border-2 border-slate-300 bg-white'
                            }`}
                        >
                          {isSelected && '✓'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selected Customer Inline Drawer (Only if selected) */}
            {selectedCustomer && (
              <div className="p-3 bg-slate-200/90 border border-slate-300 rounded-2xl space-y-2.5 shadow-xs animate-in fade-in">
                {/* Method Switcher */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBillingMethod('NORMAL')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition ${billingMethod === 'NORMAL'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white/90 text-slate-700 hover:bg-white border border-slate-300/80 shadow-2xs'
                      }`}
                  >
                    Normal Bill
                  </button>

                  <button
                    type="button"
                    onClick={() => setBillingMethod('BILL_TO_BILL')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${billingMethod === 'BILL_TO_BILL'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white/90 text-slate-700 hover:bg-white border border-slate-300/80 shadow-2xs'
                      }`}
                  >
                    <span>Bill-to-Bill</span>
                    {customerUnpaidBills.length > 0 && (
                      <span className="px-1.5 py-0.2 bg-white/20 text-[10px] rounded-full">
                        {customerUnpaidBills.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* If Bill-to-Bill: Simple Collection Row */}
                {billingMethod === 'BILL_TO_BILL' && customerUnpaidBills.length > 0 && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-2 text-xs">
                    <label className="flex items-center gap-1.5 font-bold text-amber-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={collectPrevBill}
                        onChange={e => setCollectPrevBill(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span>Collect Old Bill</span>
                    </label>

                    {collectPrevBill && (
                      <div className="flex items-center gap-1 font-mono">
                        <span className="text-slate-500 font-bold">Rs.</span>
                        <input
                          type="number"
                          value={settlePrevAmount}
                          onChange={e => setSettlePrevAmount(e.target.value)}
                          className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-right font-bold text-xs text-slate-900"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Direct Actions on Selected Customer */}
                <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowDirectCollectionModal(true)}
                    className="py-2 px-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 active:scale-95 text-emerald-800 text-[11px] font-bold flex items-center justify-center gap-1 border border-emerald-200/80 transition cursor-pointer"
                  >
                    <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">Collect</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDirectReturnsModal(true)}
                    className="py-2 px-1.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 active:scale-95 text-amber-800 text-[11px] font-bold flex items-center justify-center gap-1 border border-amber-200/80 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">Return</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPreOrderModal(true)}
                    className="py-2 px-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100/80 active:scale-95 text-indigo-800 text-[11px] font-bold flex items-center justify-center gap-1 border border-indigo-200/80 transition cursor-pointer"
                    title="Take an advance pre-order for an out-of-stock item"
                  >
                    <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="truncate">Pre-Order</span>
                  </button>
                </div>

                {/* Pending Pre-Orders Alert Card */}
                {customerPreOrders.length > 0 && (
                  <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="text-xs font-bold text-indigo-950">
                          Pending Pre-Orders ({customerPreOrders.length})
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full">
                        Advance Bookings
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {customerPreOrders.map(po => (
                        <div key={po.id} className="bg-white p-2.5 rounded-xl border border-indigo-100/90 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between text-[10.5px] text-slate-500 font-mono">
                            <span className="font-bold text-slate-800">{po.preOrderNumber}</span>
                            <span>{new Date(po.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="divide-y divide-slate-100">
                            {po.items.map(item => {
                              const stockInfo = lorryStockMap.get(item.productId);
                              const lorryStock = stockInfo?.stock || 0;
                              const inStock = lorryStock > 0;
                              const alreadyInCart = cart.some(c => c.productId === item.productId);

                              return (
                                <div key={item.id} className="pt-1.5 pb-0.5 flex items-center justify-between gap-2 text-xs">
                                  <div className="min-w-0 flex-1">
                                    <span className="font-semibold text-slate-800 block truncate text-xs">
                                      {item.product?.name}
                                    </span>
                                    <div className="flex items-center gap-2 text-[10px] mt-0.5">
                                      <span className="text-slate-500 font-mono">Ordered: {item.quantity} u</span>
                                      <span>•</span>
                                      {inStock ? (
                                        <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                                          On Lorry: {lorryStock} u
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded font-medium">
                                          0 on Lorry (Out of Stock)
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="shrink-0">
                                    {inStock && !alreadyInCart && (
                                      <button
                                        type="button"
                                        onClick={() => handleAddPreOrderToCart(po.id, item)}
                                        className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition active:scale-95 cursor-pointer flex items-center gap-1"
                                      >
                                        <Plus className="w-3 h-3" /> Add to Cart
                                      </button>
                                    )}
                                    {alreadyInCart && (
                                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                                        ✓ In Cart
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Next Step Button */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(cart.length > 0 ? 2 : 3)}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition active:scale-[0.99]"
                >
                  <span>{cart.length > 0 ? 'Go to Cart' : 'Select Brand & Products'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 2: VIEW CART */}
        {/* ======================================================== */}
        {currentStep === 2 && (
          <div className="space-y-3">
            {cart.length === 0 ? (
              <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
                <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">Cart is empty</p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBarcodeScanner(true)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-blue-400" />
                    <span>Scan Barcode</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                  >
                    + Add Products
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Cart Action Header with Scan Barcode Button */}
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-bold text-slate-700">
                    Cart Items ({totalItemsCount})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowBarcodeScanner(true)}
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer active:scale-95"
                    title="Scan more product barcodes with camera"
                  >
                    <Camera className="w-3.5 h-3.5 text-blue-400" />
                    <span>Scan (+1)</span>
                  </button>
                </div>

                {cart.map(item => {
                  const itemGross = item.unitPrice * item.quantity;
                  const itemDiscount = calculateCartItemDiscount(item);
                  const lineTotal = Math.max(0, itemGross - itemDiscount);
                  const isPureFree = item.quantity === 0 && (item.freeQuantity || 0) > 0;
                  const isDiscountOpen = Boolean(openItemDiscounts[item.productId] || itemDiscount > 0);
                  const stockInfo = lorryStockMap.get(item.productId);
                  const regularStock = stockInfo ? stockInfo.stock : (item.availableStock ?? 0);
                  const freeStock = stockInfo ? (stockInfo.freeStock || 0) : 0;
                  const totalPhysicalStock = regularStock + freeStock;
                  const totalInCart = (item.quantity || 0) + (item.freeQuantity || 0);
                  const remainingStock = Math.max(0, totalPhysicalStock - totalInCart);
                  const maxBilledAllowed = Math.max(0, totalPhysicalStock - (item.freeQuantity || 0));
                  const maxFreeAllowed = Math.max(0, totalPhysicalStock - (item.quantity || 0));

                  return (
                    <div
                      key={item.productId}
                      className="p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-2.5 transition hover:border-slate-300"
                    >
                      {/* Top Row: Product Info & Line Total & Delete */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                            {isPureFree && (
                              <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase tracking-wider">
                                Free Promo Gift
                              </span>
                            )}
                            {item.isTierPrice && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200/80">
                                <Zap className="w-2.5 h-2.5 text-emerald-600" />
                                <span>Tier Price: {formatMoney(item.unitPrice)}/unit{item.activeTierMinQty ? ` (≥${item.activeTierMinQty})` : ''}</span>
                              </span>
                            )}
                            {item.isManualPrice && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200/80">
                                Custom Price
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span className={`font-semibold ${item.isTierPrice ? 'text-emerald-700 font-bold' : 'text-slate-700'}`}>
                              {formatMoney(item.unitPrice)}
                            </span>
                            <span>/ {item.unit}</span>
                            {item.isTierPrice && item.originalUnitPrice > item.unitPrice && (
                              <span className="text-[10px] text-slate-400 line-through">
                                {formatMoney(item.originalUnitPrice)}
                              </span>
                            )}
                            {totalPhysicalStock !== undefined && (
                              <span className="text-slate-400 inline-flex items-center gap-1">
                                <span>• Lorry Stock: {totalPhysicalStock}</span>
                                <span className={`font-semibold ${remainingStock === 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                                  ({remainingStock} left)
                                </span>
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <span className="font-mono font-bold text-xs text-slate-900 block">
                              {item.quantity > 0 ? formatMoney(lineTotal) : 'Rs. 0.00'}
                            </span>
                            {itemDiscount > 0 && (
                              <span className="text-[10px] font-mono text-amber-600 line-through block">
                                {formatMoney(itemGross)}
                              </span>
                            )}
                            {item.freeQuantity > 0 && (
                              <span className="text-[10px] font-semibold text-emerald-600 block">
                                +{item.freeQuantity} Free
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCartItem(item.productId)}
                            className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Bottom Row: Ultra-clean dual controls (Billed Qty + Free Issue Qty + Discount Trigger) */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 bg-slate-50/70 -mx-3 -mb-3 px-3 py-2 rounded-b-2xl flex-wrap">
                        {/* Left: Billed Quantity */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Billed:</span>
                          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.productId, -1)}
                              className="w-6 h-6 bg-slate-50 hover:bg-slate-100 rounded flex items-center justify-center font-bold text-slate-700 text-xs active:scale-95 transition cursor-pointer"
                              title="Decrease billed quantity"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max={maxBilledAllowed}
                              value={item.quantity === 0 ? '0' : item.quantity}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                setCartItemQty(item.productId, isNaN(val) ? 0 : Math.min(maxBilledAllowed, Math.max(0, val)));
                              }}
                              onFocus={(e) => e.target.select()}
                              className="w-10 h-6 bg-transparent text-center font-mono font-bold text-xs text-slate-900 focus:outline-none focus:bg-blue-50/50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              disabled={item.quantity >= maxBilledAllowed}
                              onClick={() => updateCartQty(item.productId, 1)}
                              className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs transition ${
                                item.quantity >= maxBilledAllowed
                                  ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 active:scale-95 cursor-pointer'
                              }`}
                              title={item.quantity >= maxBilledAllowed ? 'No more physical stock on lorry' : 'Increase billed quantity'}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Right: Free Issue & Discount Controls */}
                        <div className="flex items-center gap-2">
                          {/* Free Issue Control */}
                          <div className="flex items-center gap-1">
                            {item.freeQuantity > 0 ? (
                              <div className="flex items-center bg-emerald-50 border border-emerald-300 rounded-lg p-0.5 shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => updateCartFreeQty(item.productId, -1)}
                                  className="w-6 h-6 bg-white hover:bg-emerald-100 rounded flex items-center justify-center font-bold text-emerald-800 text-xs active:scale-95 transition cursor-pointer"
                                  title="Decrease free issue units"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  max={maxFreeAllowed}
                                  value={item.freeQuantity}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                    setCartItemFreeQty(item.productId, isNaN(val) ? 0 : Math.min(maxFreeAllowed, Math.max(0, val)));
                                  }}
                                  onFocus={(e) => e.target.select()}
                                  className="w-9 h-6 bg-transparent text-center font-mono font-bold text-xs text-emerald-900 focus:outline-none focus:bg-white rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button
                                  type="button"
                                  disabled={(item.freeQuantity || 0) >= maxFreeAllowed}
                                  onClick={() => updateCartFreeQty(item.productId, 1)}
                                  className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs transition ${
                                    (item.freeQuantity || 0) >= maxFreeAllowed
                                      ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                      : 'bg-white hover:bg-emerald-100 text-emerald-800 active:scale-95 cursor-pointer'
                                  }`}
                                  title={(item.freeQuantity || 0) >= maxFreeAllowed ? 'No more physical stock on lorry' : 'Increase free issue units'}
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={maxFreeAllowed <= 0}
                                onClick={() => updateCartFreeQty(item.productId, 1)}
                                className={`px-2 py-1 rounded-lg border font-bold text-[10px] flex items-center gap-1 transition shadow-2xs ${
                                  maxFreeAllowed <= 0
                                    ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed opacity-60'
                                    : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 active:scale-95 cursor-pointer'
                                }`}
                                title={maxFreeAllowed <= 0 ? 'No stock left on lorry' : 'Add free promotional units for this item'}
                              >
                                <Plus className="w-2.5 h-2.5" />
                                <span>Free</span>
                              </button>
                            )}
                          </div>

                          {/* Quick Discount Trigger Button (when micro-row not expanded) */}
                          {!isDiscountOpen && (
                            <button
                              type="button"
                              onClick={() => toggleItemDiscountOpen(item.productId)}
                              className="px-2 py-1 rounded-lg bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-slate-600 hover:text-amber-700 font-bold text-[10px] flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-2xs"
                              title="Add item-wise discount"
                            >
                              <Tag className="w-2.5 h-2.5 text-amber-600" />
                              <span>+ Disc</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expandable Item Discount Micro-Bar */}
                      {isDiscountOpen && (
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-dashed border-slate-200 mt-2">
                          <div className="flex items-center gap-1.5">
                            <Tag className="w-3 h-3 text-amber-600" />
                            <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">Item Disc:</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="inline-flex rounded-lg bg-slate-100 border border-slate-200 p-0.5 text-[10px] font-bold">
                              <button
                                type="button"
                                onClick={() => setCartItemDiscountType(item.productId, '%')}
                                className={`px-1.5 py-0.5 rounded transition cursor-pointer ${item.discountType !== 'Rs' ? 'bg-amber-500 text-white shadow-2xs' : 'text-slate-600'
                                  }`}
                              >
                                %
                              </button>
                              <button
                                type="button"
                                onClick={() => setCartItemDiscountType(item.productId, 'Rs')}
                                className={`px-1.5 py-0.5 rounded transition cursor-pointer ${item.discountType === 'Rs' ? 'bg-amber-500 text-white shadow-2xs' : 'text-slate-600'
                                  }`}
                              >
                                Rs
                              </button>
                            </div>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={item.discountType === 'Rs' ? (item.discountAmount ?? '') : (item.discountPercent ?? '')}
                              onChange={(e) => setCartItemDiscountVal(item.productId, parseFloat(e.target.value) || 0)}
                              className="w-14 h-6 bg-white border border-slate-200 rounded-lg text-center font-mono font-bold text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            {itemDiscount > 0 && (
                              <span className="text-[10px] font-mono font-bold text-amber-700">
                                (-{formatMoney(itemDiscount)})
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                clearCartItemDiscount(item.productId);
                                setOpenItemDiscounts(prev => ({ ...prev, [item.productId]: false }));
                              }}
                              className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 text-xs transition cursor-pointer"
                              title="Clear / Close discount"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Subtotal Bar */}
                <div className="p-3 bg-slate-100 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between font-bold">
                    <div>
                      <span className="text-slate-700">Total ({totalItemsCount} billed)</span>
                      {totalFreeItemsCount > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          +{totalFreeItemsCount} Free
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-sm text-blue-600">{formatMoney(cartSubtotal - totalItemDiscounts)}</span>
                  </div>
                  {totalItemDiscounts > 0 && (
                    <div className="flex items-center justify-between text-[11px] text-amber-700 font-semibold pt-1 border-t border-slate-200">
                      <span>Item Discounts Applied:</span>
                      <span className="font-mono">-{formatMoney(totalItemDiscounts)}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    + Add More
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(5)}
                    className="py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-xs flex items-center justify-center gap-1"
                  >
                    <span>Checkout</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 3: SELECT BRAND */}
        {/* ======================================================== */}
        {currentStep === 3 && (
          <div className="space-y-3">
            {availableBrands.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-1">
                <Truck className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-amber-800">No items loaded on this lorry</p>
                <p className="text-xs text-amber-600">The morning lorry load has not been done yet, or no stock is available on this vehicle.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {availableBrands.map(brand => {
                  const count = lorryProducts.filter(p => p.category.toLowerCase() === brand.toLowerCase()).length;
                  return (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => {
                        setSelectedBrand(brand);
                        setItemSearch('');
                        setCurrentStep(4);
                      }}
                      className="p-3.5 bg-white border border-slate-200 hover:border-blue-500 rounded-xl text-left shadow-2xs flex flex-col justify-between h-24 active:scale-[0.98] transition"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <Layers className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xs text-slate-900 truncate">{brand}</h3>
                        <p className="text-[10px] text-slate-400 font-medium">{count} Items</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(cart.length > 0 ? 2 : 1)}
                className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600"
              >
                ← Back
              </button>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="py-2 px-3 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  View Cart ({totalItemsCount}) →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 4: SELECT ITEM FOR BRAND */}
        {/* ======================================================== */}
        {currentStep === 4 && (
          <div className="space-y-3">
            {/* Top Bar with Brand Badge & Search */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="text-xs font-bold text-blue-600 flex items-center gap-1 shrink-0"
              >
                ← Brands
              </button>
              <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg truncate">
                {selectedBrand}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={itemSearch}
                  onChange={e => setItemSearch(e.target.value)}
                  placeholder={`Search ${selectedBrand}...`}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowBarcodeScanner(true)}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition shrink-0 cursor-pointer active:scale-95"
                title="Scan Barcode with Camera"
              >
                <Camera className="w-3.5 h-3.5 text-blue-400" />
                <span>Scan</span>
              </button>
            </div>

            {/* Products List */}
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-0.5">
              {brandProducts.map(product => {
                const stockInfo = lorryStockMap.get(product.id);
                const regularStock = stockInfo ? stockInfo.stock : product.currentStock;
                const freeStock = stockInfo ? stockInfo.freeStock : (product.freeStock || 0);
                const totalPhysicalStock = regularStock + freeStock;
                const inCart = cart.find(i => i.productId === product.id);
                const inCartBilled = inCart ? (inCart.quantity || 0) : 0;
                const inCartFree = inCart ? (inCart.freeQuantity || 0) : 0;
                const inCartTotal = inCartBilled + inCartFree;
                const remainingStock = Math.max(0, totalPhysicalStock - inCartTotal);
                const maxBilledAllowed = Math.max(0, totalPhysicalStock - inCartFree);
                const maxFreeAllowed = Math.max(0, totalPhysicalStock - inCartBilled);

                return (
                  <div
                    key={product.id}
                    className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{product.name}</h4>
                      <p className="text-[11px] text-slate-500 font-mono">
                        <span className="font-bold text-blue-600">{formatMoney(product.unitPrice)}</span>
                        <span className="ml-1 text-slate-500">
                          • Stock: {totalPhysicalStock}
                          {inCart && inCartTotal > 0 && (
                            <span className={`ml-1 font-semibold ${remainingStock === 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                              ({remainingStock} left)
                            </span>
                          )}
                        </span>
                        {freeStock > 0 && (
                          <span className="ml-1 text-emerald-700 font-bold bg-emerald-50 px-1 rounded">+{freeStock} Free</span>
                        )}
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {inCart ? (
                        <>
                          <div className="flex items-center bg-blue-50 border border-blue-200 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => updateCartQty(product.id, -1)}
                              className="w-7 h-7 bg-white rounded flex items-center justify-center font-bold text-blue-700 text-xs shadow-2xs hover:bg-blue-100 active:scale-95 transition cursor-pointer"
                              title="Decrease quantity"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max={maxBilledAllowed}
                              value={inCart.quantity === 0 ? '0' : inCart.quantity}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                setCartItemQty(product.id, isNaN(val) ? 0 : Math.min(maxBilledAllowed, Math.max(0, val)));
                              }}
                              onFocus={(e) => e.target.select()}
                              className="w-9 h-7 bg-transparent text-center font-mono font-bold text-xs text-blue-900 focus:outline-none focus:bg-white focus:rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              disabled={inCartBilled >= maxBilledAllowed}
                              onClick={() => addToCart(product, 1)}
                              className={`w-7 h-7 rounded flex items-center justify-center font-bold text-xs shadow-2xs transition ${
                                inCartBilled >= maxBilledAllowed
                                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 cursor-pointer'
                              }`}
                              title={inCartBilled >= maxBilledAllowed ? 'No more physical stock on lorry' : 'Increase quantity'}
                            >
                              +
                            </button>
                          </div>

                          {inCart.freeQuantity > 0 ? (
                            <button
                              type="button"
                              disabled={inCartFree >= maxFreeAllowed}
                              onClick={() => updateCartFreeQty(product.id, 1)}
                              className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold transition shadow-2xs flex items-center gap-0.5 ${
                                inCartFree >= maxFreeAllowed
                                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 active:scale-95 cursor-pointer'
                              }`}
                              title={inCartFree >= maxFreeAllowed ? 'No more physical stock on lorry' : 'Tap to increase free units (+1)'}
                            >
                              <Gift className="w-3 h-3 text-emerald-600" />
                              <span>+{inCart.freeQuantity}F</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={maxFreeAllowed <= 0}
                              onClick={() => updateCartFreeQty(product.id, 1)}
                              className={`px-2 py-1.5 rounded-lg border text-[10px] font-semibold transition flex items-center gap-0.5 ${
                                maxFreeAllowed <= 0
                                  ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed opacity-60'
                                  : 'bg-slate-50 hover:bg-emerald-50 border-slate-200 hover:border-emerald-300 text-slate-500 hover:text-emerald-700 active:scale-95 cursor-pointer'
                              }`}
                              title={maxFreeAllowed <= 0 ? 'No stock left on lorry' : 'Add free issue'}
                            >
                              <Gift className="w-3 h-3" />
                              <span>+Free</span>
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={totalPhysicalStock <= 0}
                            onClick={() => addToCart(product, 1)}
                            className={`py-1 px-3 font-bold text-xs rounded-lg shadow-xs transition ${
                              totalPhysicalStock <= 0
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 cursor-pointer'
                            }`}
                          >
                            {totalPhysicalStock <= 0 ? 'No Stock' : '+ Add'}
                          </button>
                          <button
                            type="button"
                            disabled={totalPhysicalStock <= 0}
                            onClick={() => addFreeToCart(product, 1)}
                            className={`py-1 px-2 border font-bold text-[11px] rounded-lg shadow-2xs transition ${
                              totalPhysicalStock <= 0
                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 active:scale-95 cursor-pointer'
                            }`}
                            title={totalPhysicalStock <= 0 ? 'No stock on lorry' : 'Add as 100% Free Promo Gift'}
                          >
                            + Free
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sticky Bottom Actions */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="py-2.5 px-3.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700"
              >
                ← Other Brands
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                disabled={cart.length === 0}
                className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
              >
                <span>View Cart ({totalItemsCount})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 5: FINAL CHECKOUT */}
        {/* ======================================================== */}
        {currentStep === 5 && (
          <div className="space-y-3">
            {/* Top Navigation & Cancel Header */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                <span>Back to Cart</span>
              </button>

              <button
                type="button"
                onClick={handleCancelCheckout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
              >
                <X className="w-3.5 h-3.5 text-rose-600" />
                <span>Cancel Bill</span>
              </button>
            </div>

            {/* Customer Pill */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Customer</p>
                <h3 className="text-xs font-bold text-slate-900">{selectedCustomer?.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold text-[11px] rounded-lg"
              >
                + Add Product
              </button>
            </div>

            {/* Items Summary Table */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase pb-1 border-b border-slate-100 flex justify-between">
                <span>Items ({cart.length})</span>
                <span>Price</span>
              </div>

              {cart.map(item => {
                const itemGross = item.unitPrice * item.quantity;
                const itemDisc = calculateCartItemDiscount(item);
                const lineTot = Math.max(0, itemGross - itemDisc);

                return (
                  <div key={item.productId} className="flex items-center justify-between text-xs py-0.5">
                    <div className="flex items-center gap-1.5 truncate pr-2">
                      <span className="text-slate-800 font-medium truncate">
                        {item.name} × {item.quantity}
                      </span>
                      {item.freeQuantity > 0 && (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold shrink-0">
                          +{item.freeQuantity} Free
                        </span>
                      )}
                      {itemDisc > 0 && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold shrink-0">
                          -{formatMoney(itemDisc)}
                        </span>
                      )}
                    </div>
                    <span className="font-mono font-bold text-slate-900 shrink-0">
                      {item.quantity > 0 ? formatMoney(lineTot) : 'Rs. 0.00'}
                    </span>
                  </div>
                );
              })}
              {totalFreeItemsCount > 0 && (
                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-emerald-700 font-semibold">
                  <span className="flex items-center gap-1">
                    <Gift className="w-3.5 h-3.5" />
                    <span>Total Free Promotional Items:</span>
                  </span>
                  <span className="font-bold">+{totalFreeItemsCount} Units (Rs. 0.00)</span>
                </div>
              )}
            </div>

            {/* Empty Bottle Exchange & Deposit Bar (Shown only if bottled items or customer bottle debt exist) */}
            <EmptyBottleBar
              deliveredBottles={deliveredBottles}
              customerBottleBalance={selectedCustomer?.emptyBottleBalance || 0}
              depositRate={bottleDepositRate}
              value={bottleState}
              onChange={setBottleState}
              compact
            />

            {/* Payment Method Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Payment Method</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['CASH', 'CREDIT', 'CHEQUE'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(m);
                      if (m === 'CREDIT' && selectedCustomer?.creditRisk?.isCreditBlocked && !adminOverridePasscode) {
                        setShowAdminPasscodeModal(true);
                      }
                    }}
                    className={`py-2 rounded-lg text-xs font-bold transition ${paymentMethod === m
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600'
                      }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Credit Stop Status & Admin Passcode Authorization */}
            {paymentMethod === 'CREDIT' && selectedCustomer?.creditRisk?.isCreditBlocked && (
              adminOverridePasscode ? (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold text-emerald-900 block leading-tight">
                        Credit Stop Override Authorized
                      </span>
                      <span className="text-[10px] text-emerald-700">
                        Authorized by {authorizedByName || 'Admin Master PIN'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminOverridePasscode(null);
                      setAuthorizedByName(null);
                    }}
                    className="text-[10px] text-emerald-800 hover:text-emerald-950 font-bold underline bg-white/60 px-2 py-1 rounded-md"
                  >
                    Revoke
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-center justify-between gap-2 text-xs animate-fadeIn shadow-2xs">
                  <div className="flex items-start gap-2 min-w-0">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="font-bold text-rose-900 block leading-tight">
                        Hard Credit Stop Active
                      </span>
                      <span className="text-[10px] text-rose-700 block truncate">
                        {selectedCustomer?.creditRisk?.blockReason || 'Customer has bills >30 days overdue. Admin PIN required.'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdminPasscodeModal(true)}
                    className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-bold text-xs rounded-lg shrink-0 shadow-2xs transition"
                  >
                    Enter PIN
                  </button>
                </div>
              )
            )}

            {/* Cheque Details Card */}
            {paymentMethod === 'CHEQUE' && (
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2.5 animate-fadeIn shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                    Customer Cheque Details
                  </span>
                  <span className="text-[10px] text-blue-600 font-semibold bg-white px-2 py-0.5 rounded-md border border-blue-200">
                    Wired to Admin
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">
                      Cheque Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={chequeNumber}
                      onChange={(e) => setChequeNumber(e.target.value)}
                      placeholder="e.g. 049182"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">
                      Cheque Maturity Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={chequeDate}
                      onChange={(e) => setChequeDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    Bank Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Enter or select bank..."
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 mb-1.5"
                  />
                  {/* Quick Bank Chips */}
                  <div className="flex flex-wrap gap-1">
                    {['Commercial Bank', 'BOC', 'Sampath Bank', 'HNB', "People's Bank", 'Seylan Bank', 'NDB'].map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBankName(b)}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${bankName === b
                          ? 'bg-blue-600 text-white font-bold'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Return Credit Balance Available (1-Click Auto Deduction on Next Bill) */}
            {availableReturnCredit > 0 && (
              <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 rounded-xl space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-xs font-bold text-amber-900">
                      Return Credit Available: {formatMoney(availableReturnCredit)}
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useReturnCredit}
                      onChange={(e) => setUseReturnCredit(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between text-[11px] text-amber-800 pt-1 border-t border-amber-200/60">
                  <span>{useReturnCredit ? 'Applying credit to this bill' : 'Credit deduction disabled'}</span>
                  <span className="font-mono font-bold">
                    {useReturnCredit ? `-${formatMoney(appliedReturnCredit)}` : formatMoney(availableReturnCredit)}
                  </span>
                </div>
              </div>
            )}

            {/* Total Bill Discount Control Card */}
            <div className="p-3 bg-gradient-to-r from-amber-50/80 to-orange-50/60 border border-amber-200/90 rounded-xl space-y-2 animate-fadeIn shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs font-bold text-amber-900">Total Bill Discount</span>
                  {selectedCustomer?.discountPercentage && selectedCustomer.discountPercentage > 0 && !billDiscountManual && (
                    <span className="px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-800 text-[9px] font-bold">
                      Default {selectedCustomer.discountPercentage}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="inline-flex rounded-lg bg-white border border-amber-300 p-0.5 text-[10px] font-bold shadow-2xs">
                    <button
                      type="button"
                      onClick={() => {
                        setBillDiscountType('%');
                        setBillDiscountManual(true);
                      }}
                      className={`px-2 py-0.5 rounded transition cursor-pointer ${billDiscountType === '%' ? 'bg-amber-500 text-white shadow-2xs' : 'text-slate-600'
                        }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBillDiscountType('Rs');
                        setBillDiscountManual(true);
                      }}
                      className={`px-2 py-0.5 rounded transition cursor-pointer ${billDiscountType === 'Rs' ? 'bg-amber-500 text-white shadow-2xs' : 'text-slate-600'
                        }`}
                    >
                      Rs
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={billDiscountValue === 0 && !billDiscountManual ? '' : billDiscountValue}
                    onChange={(e) => {
                      setBillDiscountValue(Math.max(0, parseFloat(e.target.value) || 0));
                      setBillDiscountManual(true);
                    }}
                    className="w-16 h-7 bg-white border border-amber-300 rounded-lg text-center font-mono font-bold text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
              {(totalItemDiscounts > 0 || billDiscountAmount > 0) && (
                <div className="pt-1.5 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-amber-900">
                  <span>
                    {totalItemDiscounts > 0 ? `Item Disc: -${formatMoney(totalItemDiscounts)} | ` : ''}
                    Bill Disc: -{formatMoney(billDiscountAmount)}
                  </span>
                  <span className="font-mono font-bold text-amber-700">
                    Total Disc: -{formatMoney(totalDiscountAmount)}
                  </span>
                </div>
              )}
            </div>

            {/* Final Total Card */}
            <div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Final Amount</span>
                <span className="font-mono text-xl font-bold text-white">{formatMoney(finalTotal)}</span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-800 rounded text-blue-400">
                {paymentMethod}
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              disabled={submitting}
              onClick={handleFinalCheckout}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-[0.99] transition disabled:opacity-60 cursor-pointer"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing Bill...</span>
                </span>
              ) : (
                <>
                  <span>Confirm & Issue Bill</span>
                  <Check className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Bottom Actions: Back to Cart & Cancel Bill */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setCurrentStep(2)}
                className="py-2.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98 disabled:opacity-50"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                <span>Back to Cart</span>
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={handleCancelCheckout}
                className="py-2.5 px-3 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98 disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5 text-rose-500" />
                <span>Cancel Bill</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SUCCESS MODAL POPUP */}
      {checkoutSuccessOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 text-center border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-0.5">Bill Issued Successfully!</h3>
            <p className="text-xs text-slate-500 font-mono mb-2">
              #{checkoutSuccessOrder.paperBillNumber || checkoutSuccessOrder.orderNumber} • {formatMoney(checkoutSuccessOrder.netTotal)}
            </p>
            {checkoutSuccessOrder.orderNumber.startsWith('OFF-') && (
              <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-xl text-center text-[11px] text-amber-900 font-medium">
                ⚡ <strong>Saved Offline</strong> — Stored safely in local memory. Will automatically sync to cloud when internet is available.
              </div>
            )}
            {checkoutSuccessOrder.paymentMethod === 'CHEQUE' && (
              <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-xl text-left text-[11px] text-blue-900 font-mono flex items-center justify-between">
                <span>Cheque: #{checkoutSuccessOrder.chequeNumber || 'N/A'}</span>
                <span className="font-sans font-bold text-blue-700">{checkoutSuccessOrder.bankName || 'Cheque Payment'}</span>
              </div>
            )}

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onViewInvoice?.(checkoutSuccessOrder)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print 80mm Receipt Slip</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  loadFinishedBills();
                  setShowFinishedBillsModal(true);
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5 text-blue-600" />
                <span>View All Finished Bills ({finishedBills.length})</span>
              </button>

              <button
                type="button"
                onClick={handleStartNewBill}
                className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Next Customer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REP TARGETS & GOALS MODAL POPUP */}
      {showTargetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-100 space-y-4 my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center shadow-2xs">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Sales Targets & Performance
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {targetProgress?.repName || user?.fullName || 'Sales Rep'} • {selectedLorry?.vehicleNumber || 'Route Van'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowTargetModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingTargets && !targetProgress ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Calculating performance...
              </div>
            ) : (
              <div className="space-y-3.5">
                {/* 1. TODAY'S DAILY TARGET CARD */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/70 to-orange-50/50 border border-amber-200/80 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-amber-600" />
                      <span className="font-bold text-xs text-amber-950 uppercase tracking-wider">
                        Today's Target
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-900 bg-white px-2 py-0.5 rounded-lg border border-amber-200 shadow-2xs">
                      Goal: {formatMoney(targetProgress?.dailyTarget || 0)}
                    </span>
                  </div>

                  {/* Daily Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full bg-amber-200/70 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${(targetProgress?.dailyPercentage || 0) >= 100
                          ? 'bg-emerald-500'
                          : 'bg-gradient-to-r from-amber-500 to-orange-500'
                          }`}
                        style={{ width: `${Math.min(100, targetProgress?.dailyPercentage || 0)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                      <span>
                        Achieved Today: <strong className="text-slate-900">{formatMoney(targetProgress?.achievedToday || 0)}</strong>
                      </span>
                      <span className={(targetProgress?.dailyPercentage || 0) >= 100 ? 'text-emerald-700 font-bold' : 'text-amber-800 font-bold'}>
                        {targetProgress?.dailyPercentage || 0}%
                      </span>
                    </div>
                  </div>

                  {/* Daily Sub-stats */}
                  <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Today's Bills: <strong className="text-slate-800">{targetProgress?.todayBillsCount || 0}</strong></span>
                    {(targetProgress?.dailyRemaining || 0) > 0 ? (
                      <span className="text-amber-700 font-medium">To Goal: <strong>{formatMoney(targetProgress?.dailyRemaining || 0)}</strong></span>
                    ) : (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" /> Target Reached!
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. MONTHLY TARGET CARD */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-blue-50/50 border border-indigo-200/80 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      <span className="font-bold text-xs text-indigo-950 uppercase tracking-wider">
                        Monthly Target
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-indigo-900 bg-white px-2 py-0.5 rounded-lg border border-indigo-200 shadow-2xs">
                      Goal: {formatMoney(targetProgress?.monthlyTarget || 0)}
                    </span>
                  </div>

                  {/* Monthly Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full bg-indigo-200/70 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${(targetProgress?.monthlyPercentage || 0) >= 100
                          ? 'bg-emerald-500'
                          : (targetProgress?.monthlyPercentage || 0) >= 50
                            ? 'bg-indigo-600'
                            : 'bg-blue-500'
                          }`}
                        style={{ width: `${Math.min(100, targetProgress?.monthlyPercentage || 0)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                      <span>
                        Billed This Month: <strong className="text-slate-900">{formatMoney(targetProgress?.achievedMonth || 0)}</strong>
                      </span>
                      <span className={(targetProgress?.monthlyPercentage || 0) >= 100 ? 'text-emerald-700 font-bold' : 'text-indigo-800 font-bold'}>
                        {targetProgress?.monthlyPercentage || 0}%
                      </span>
                    </div>
                  </div>

                  {/* Monthly Sub-stats */}
                  <div className="pt-2 border-t border-indigo-200/60 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Month Invoices: <strong className="text-slate-800">{targetProgress?.monthBillsCount || 0}</strong></span>
                    {(targetProgress?.monthlyRemaining || 0) > 0 ? (
                      <span className="text-indigo-700 font-medium">To Goal: <strong>{formatMoney(targetProgress?.monthlyRemaining || 0)}</strong></span>
                    ) : (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-emerald-600" /> Target Smashed!
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. NEW CLIENTS TARGET (IF CONFIGURED) */}
                {Boolean(targetProgress?.targetNewClients && targetProgress.targetNewClients > 0) && (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-slate-700">New Retail Outlets Target</span>
                    </div>
                    <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200 font-mono text-[11px]">
                      {targetProgress?.targetNewClients} shops / month
                    </span>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowTargetModal(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
            >
              Close & Return to Billing
            </button>
          </div>
        </div>
      )}

      {/* QUICK ADD CUSTOMER MODAL FOR REP */}
      <CustomerModal
        customer={null}
        isOpen={showAddCustomerModal}
        onClose={() => setShowAddCustomerModal(false)}
        defaultRouteId={selectedLorry?.routeId || user?.lorry?.routeId || undefined}
        onSaved={async (newCust) => {
          try {
            const updatedList = await CustomerService.getAll();
            setCustomers(updatedList);
            if (newCust?.id) {
              setSelectedCustomerId(newCust.id);
              setCustomerSearch('');
            }
            loadTargets();
          } catch (e) {
            console.error('Failed to reload customers', e);
          }
        }}
      />

      {/* FINISHED BILLS HISTORY MODAL (MINIMAL, NEAT, CLEAN) */}
      {showFinishedBillsModal && (
        <div className={`fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in ${showSummaryBillModal ? 'print:hidden' : ''}`}>
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-2xs shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Finished Sales Bills
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {selectedLorry?.vehicleNumber || 'Route Lorry'} • {filteredFinishedBills.length} Bills ({billsDateRangeLabel})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowSummaryBillModal(true)}
                  disabled={filteredFinishedBills.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs transition shadow-2xs active:scale-95 cursor-pointer"
                  title="Print Summary Bill (80mm Thermal Receipt)"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Summary</span>
                </button>

                <button
                  type="button"
                  onClick={() => loadFinishedBills()}
                  disabled={loadingFinishedBills}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition cursor-pointer"
                  title="Refresh bills"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingFinishedBills ? 'animate-spin text-blue-600' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowFinishedBillsModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Top KPI Metrics Strip (Minimal, clean, neat) */}
            <div className="p-3 sm:px-5 bg-slate-50/80 border-b border-slate-100 shrink-0 space-y-2">
              <div className={`grid ${finishedBillsSummary.totalCheque > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-2 text-center`}>
                <div className="p-2 rounded-xl bg-white border border-slate-200/60 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Sales</span>
                  <span className="font-mono font-bold text-xs sm:text-sm text-slate-900">{formatMoney(finishedBillsSummary.totalValue)}</span>
                </div>
                <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-200/80 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block tracking-wider">Cash Collected</span>
                  <span className="font-mono font-bold text-xs sm:text-sm text-emerald-800">{formatMoney(finishedBillsSummary.totalCash)}</span>
                </div>
                {finishedBillsSummary.totalCheque > 0 && (
                  <div className="p-2 rounded-xl bg-blue-50/70 border border-blue-200/80 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-blue-700 block tracking-wider">Cheques ({finishedBillsSummary.chequeCount})</span>
                    <span className="font-mono font-bold text-xs sm:text-sm text-blue-800">{formatMoney(finishedBillsSummary.totalCheque)}</span>
                  </div>
                )}
                <div className="p-2 rounded-xl bg-rose-50/70 border border-rose-200/80 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-rose-700 block tracking-wider">Credit Given</span>
                  <span className="font-mono font-bold text-xs sm:text-sm text-rose-800">{formatMoney(finishedBillsSummary.totalCredit)}</span>
                </div>
              </div>

              {filteredFinishedBills.length > 0 && (
                <div className="flex items-center justify-between px-2 pt-0.5 text-xs text-slate-500">
                  <span className="text-[11px] font-medium">
                    Showing {filteredFinishedBills.length} of {dateFilteredBills.length} bills ({billsDateRangeLabel})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSummaryBillModal(true)}
                    className="text-blue-600 hover:text-blue-800 font-bold text-xs flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Printer className="w-3 h-3" />
                    <span>View 80mm Summary Slip</span>
                  </button>
                </div>
              )}
            </div>

            {/* View Mode Toggle: Bills Ledger vs. Item-Wise Sales Table */}
            <div className="px-3 sm:px-5 pt-3 pb-2 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center p-1 bg-slate-200/80 rounded-xl w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setBillsViewMode('BILLS')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${billsViewMode === 'BILLS'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <Receipt className="w-3.5 h-3.5 text-blue-600" />
                  <span>Bills Ledger ({filteredFinishedBills.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBillsViewMode('ITEMS')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${billsViewMode === 'ITEMS'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <Boxes className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Item-Wise Sales ({itemWiseSalesData.items.length} SKUs)</span>
                </button>
              </div>

              {billsViewMode === 'ITEMS' && itemWiseSalesData.items.length > 0 && (
                <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-slate-600 shrink-0">
                  <span>Units: <strong className="text-blue-700">{itemWiseSalesData.totalSoldUnits}</strong></span>
                  <span>•</span>
                  <span>Total: <strong className="text-emerald-700">{formatMoney(itemWiseSalesData.totalRevenue)}</strong></span>
                </div>
              )}
            </div>

            {/* Filter & Search Bar */}
            <div className="p-3 sm:px-5 border-b border-slate-100 space-y-2.5 bg-white shrink-0">
              {/* Search & Sort Bar */}
              {billsViewMode === 'BILLS' ? (
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={billsSearch}
                    onChange={(e) => setBillsSearch(e.target.value)}
                    placeholder="Search by customer, shop, slip #, or amount..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {billsSearch && (
                    <button
                      onClick={() => setBillsSearch('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={itemSearchQuery}
                      onChange={(e) => setItemSearchQuery(e.target.value)}
                      placeholder="Search product name, SKU, or category..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {itemSearchQuery && (
                      <button
                        onClick={() => setItemSearchQuery('')}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0 overflow-x-auto pb-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase pr-0.5">Sort:</span>
                    <button
                      type="button"
                      onClick={() => setItemSortFilter('QTY_DESC')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${itemSortFilter === 'QTY_DESC'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      Qty Sold
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemSortFilter('REVENUE_DESC')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${itemSortFilter === 'REVENUE_DESC'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      Revenue
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemSortFilter('NAME')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${itemSortFilter === 'NAME'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      A-Z
                    </button>
                  </div>
                </div>
              )}

              {/* Date Range Filter Row */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 pr-0.5 shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Date:</span>
                  </div>

                  {(
                    [
                      { id: 'today', label: 'Today' },
                      { id: 'yesterday', label: 'Yesterday' },
                      { id: 'thisWeek', label: 'This Week' },
                      { id: 'thisMonth', label: 'This Month' },
                      { id: 'all', label: 'All Time' },
                      { id: 'custom', label: 'Custom' }
                    ] as const
                  ).map(dp => {
                    const isActive = billsDatePreset === dp.id;
                    return (
                      <button
                        key={dp.id}
                        type="button"
                        onClick={() => handleDatePresetChange(dp.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${isActive
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                      >
                        {dp.label}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Date Pickers */}
                {billsDatePreset === 'custom' && (
                  <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200/80 animate-in fade-in text-xs">
                    <input
                      type="date"
                      value={customBillsStart}
                      onChange={(e) => setCustomBillsStart(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-slate-400 text-xs font-medium">to</span>
                    <input
                      type="date"
                      value={customBillsEnd}
                      onChange={(e) => setCustomBillsEnd(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCustomDates}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer ml-auto sm:ml-0"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>

              {/* Payment Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                <span className="text-[11px] font-bold text-slate-500 pr-0.5 shrink-0">
                  Payment:
                </span>
                {(['ALL', 'CASH', 'CREDIT', 'CHEQUE'] as const).map(tab => {
                  const count = tab === 'ALL'
                    ? dateFilteredBills.length
                    : dateFilteredBills.filter(b => b.paymentMethod === tab).length;

                  const activeStyles =
                    tab === 'CASH'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : tab === 'CREDIT'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : tab === 'CHEQUE'
                          ? 'bg-orange-600 text-white shadow-2xs'
                          : 'bg-slate-900 text-white shadow-2xs';

                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setBillsFilter(tab)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer ${billsFilter === tab
                        ? activeStyles
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      <span>{tab === 'ALL' ? 'All' : tab}</span>
                      <span className={`text-[10px] font-mono px-1 rounded-full ${billsFilter === tab ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* View Mode Content: Bills List OR Item-Wise Sales Table */}
            {billsViewMode === 'BILLS' ? (
              /* Finished Bills Scrollable List */
              <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2.5 bg-slate-50/50">
                {loadingFinishedBills && finishedBills.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span>Loading finished bills...</span>
                  </div>
                ) : filteredFinishedBills.length === 0 ? (
                  <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
                    <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">No finished bills found</p>
                    <p className="text-[11px] text-slate-400">
                      {billsSearch || billsFilter !== 'ALL'
                        ? 'No bills match your active search or filter.'
                        : 'Completed sales bills will appear here with full line details and reprint options.'}
                    </p>
                  </div>
                ) : (
                  filteredFinishedBills.map(bill => {
                    const isExpanded = expandedBillId === bill.id;
                    const totalItemsQty = bill.items.reduce((acc, i) => acc + i.quantity, 0);
                    const totalFreeQty = bill.items.reduce((acc, i) => acc + (i.freeQuantity || 0), 0);
                    const creditDue = Math.max(0, bill.netTotal - (bill.cashReceived || 0));

                    // Color Themes:
                    // Cash bills: Light Green
                    // Cheque bills & Partial Credit bills: Light Orange
                    // Pure Credit bills: Light Red
                    const isCash = bill.paymentMethod === 'CASH';
                    const isCheque = bill.paymentMethod === 'CHEQUE';
                    const isPartialCredit = bill.paymentMethod === 'CREDIT' && bill.paymentStatus === 'PARTIAL';

                    const theme = isCash
                      ? {
                        container: 'bg-emerald-50/70 border-emerald-200/90 hover:border-emerald-300',
                        badge: 'bg-emerald-100 text-emerald-800 border-emerald-300/80',
                        tag: 'bg-white text-emerald-950 border-emerald-200',
                        itemsBox: 'bg-emerald-100/40 border border-emerald-200/60 text-emerald-900',
                        button: 'bg-emerald-100/70 hover:bg-emerald-200/80 text-emerald-800 border-emerald-300/60',
                        divider: 'border-emerald-200/60',
                        expandedBox: 'bg-white border-emerald-200',
                        label: 'CASH'
                      }
                      : isCheque || isPartialCredit
                        ? {
                          container: 'bg-orange-50/70 border-orange-200/90 hover:border-orange-300',
                          badge: 'bg-orange-100 text-orange-900 border-orange-300/80',
                          tag: 'bg-white text-orange-950 border-orange-200',
                          itemsBox: 'bg-orange-100/40 border border-orange-200/60 text-orange-900',
                          button: 'bg-orange-100/70 hover:bg-orange-200/80 text-orange-900 border-orange-300/60',
                          divider: 'border-orange-200/60',
                          expandedBox: 'bg-white border-orange-200',
                          label: isCheque ? 'CHEQUE' : 'PARTIAL CREDIT'
                        }
                        : {
                          container: 'bg-rose-50/70 border-rose-200/90 hover:border-rose-300',
                          badge: 'bg-rose-100 text-rose-900 border-rose-300/80',
                          tag: 'bg-white text-rose-950 border-rose-200',
                          itemsBox: 'bg-rose-100/40 border border-rose-200/60 text-rose-900',
                          button: 'bg-rose-100/70 hover:bg-rose-200/80 text-rose-900 border-rose-300/60',
                          divider: 'border-rose-200/60',
                          expandedBox: 'bg-white border-rose-200',
                          label: 'CREDIT'
                        };

                    return (
                      <div
                        key={bill.id}
                        className={`rounded-2xl border p-3.5 shadow-2xs transition space-y-2.5 ${theme.container}`}
                      >
                        {/* Top Row: Slip #, Time & Net Total */}
                        <div className={`flex items-start justify-between gap-2 border-b pb-2 ${theme.divider}`}>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded-lg border shadow-3xs ${theme.tag}`}>
                                #{bill.paperBillNumber || bill.orderNumber}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${theme.badge}`}>
                                {theme.label}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-mono mt-1">
                              {new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(bill.createdAt).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="font-mono font-bold text-sm sm:text-base text-slate-900 block">
                              {formatMoney(bill.netTotal)}
                            </span>
                            {creditDue > 0 ? (
                              <span className="text-[10px] font-bold text-rose-600 font-mono">
                                Due: {formatMoney(creditDue)}
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-emerald-600">
                                Paid in full
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Customer Row */}
                        <div className="flex items-center justify-between text-xs">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-800 truncate">
                              {bill.customer.name}
                              {bill.customer.code ? (
                                <span className="text-[10px] text-slate-400 font-mono font-normal ml-1">
                                  [{bill.customer.code}]
                                </span>
                              ) : null}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {bill.customer.companyName || bill.customer.deliveryAddress || bill.customer.city || 'Standard Outlet'}
                            </p>
                          </div>
                        </div>

                        {/* Items Summary & Expand Trigger */}
                        <div className={`rounded-xl p-2 flex items-center justify-between text-[11px] ${theme.itemsBox}`}>
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-semibold text-slate-800">{bill.items.length} Products</span>
                            <span>•</span>
                            <span>{totalItemsQty} units</span>
                            {totalFreeQty > 0 && (
                              <span className="text-emerald-700 font-bold bg-emerald-100/70 px-1.5 py-0.2 rounded text-[10px]">
                                +{totalFreeQty} Free
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
                            className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-0.5 shrink-0 ml-2 cursor-pointer"
                          >
                            <span>{isExpanded ? 'Hide' : 'Items'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        {/* Expanded Items Breakdown */}
                        {isExpanded && (
                          <div className={`border rounded-xl p-2.5 space-y-1.5 text-xs animate-in fade-in ${theme.expandedBox}`}>
                            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100">
                              <span>Item Name</span>
                              <span>Line Total</span>
                            </div>
                            {bill.items.map(item => (
                              <div key={item.id} className="flex justify-between text-[11px] leading-tight">
                                <div className="min-w-0 pr-2">
                                  <span className="font-medium text-slate-800 block truncate">{item.product.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {item.quantity} {item.product.unit || 'pcs'} x {formatMoney(item.unitPrice)}
                                    {item.freeQuantity > 0 && (
                                      <span className="text-emerald-600 font-bold ml-1">+{item.freeQuantity} Free</span>
                                    )}
                                  </span>
                                </div>
                                <span className="font-mono font-bold text-slate-800 shrink-0">
                                  {formatMoney(item.lineTotal)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Action Buttons: 1-Tap 80mm Print */}
                        <div className="pt-1 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onViewInvoice?.(bill);
                            }}
                            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-3xs ${theme.button}`}
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>View & Print 80mm Receipt</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* Item-Wise Sales Table (Clean, Mobile-optimized & responsive) */
              <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 bg-slate-50/50">
                {/* 4 Mini Summary Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">SKUs Sold</span>
                    <span className="font-mono font-bold text-sm text-slate-900">{itemWiseSalesData.totalSKUs} Products</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-blue-600 block tracking-wider">Billed Units</span>
                    <span className="font-mono font-bold text-sm text-blue-700">{itemWiseSalesData.totalSoldUnits} units</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-emerald-600 block tracking-wider">Free Scheme</span>
                    <span className="font-mono font-bold text-sm text-emerald-700">+{itemWiseSalesData.totalFreeUnits} Free</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 block tracking-wider">Total Sales</span>
                    <span className="font-mono font-bold text-sm text-emerald-800">{formatMoney(itemWiseSalesData.totalRevenue)}</span>
                  </div>
                </div>

                {loadingFinishedBills && itemWiseSalesData.items.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                    <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    <span>Loading item-wise sales...</span>
                  </div>
                ) : itemWiseSalesData.items.length === 0 ? (
                  <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
                    <Boxes className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">No item sales recorded for {billsDateRangeLabel}</p>
                    <p className="text-[11px] text-slate-400">
                      {itemSearchQuery || billsFilter !== 'ALL'
                        ? 'No product matches your active search or payment filter.'
                        : 'Products billed to customers in this date range will automatically appear here with total units and revenue.'}
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs min-w-[560px]">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <th className="py-2.5 px-3 w-8">#</th>
                            <th className="py-2.5 px-3">Product Name & SKU</th>
                            <th className="py-2.5 px-2 text-right">Unit Price</th>
                            <th className="py-2.5 px-2 text-center">Billed Qty</th>
                            <th className="py-2.5 px-2 text-center">Free Qty</th>
                            <th className="py-2.5 px-2 text-center">Total Units</th>
                            <th className="py-2.5 px-3 text-right">Total Revenue</th>
                            <th className="py-2.5 px-3 text-right">% Share</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {itemWiseSalesData.items.map((item, idx) => {
                            const share = itemWiseSalesData.totalRevenue > 0
                              ? ((item.totalRevenue / itemWiseSalesData.totalRevenue) * 100).toFixed(1)
                              : '0.0';

                            return (
                              <tr key={item.productId} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-bold text-slate-800 leading-tight">
                                    {item.name}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="font-mono text-[10px] text-slate-400">{item.sku}</span>
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                                      {item.category}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                                  {formatMoney(item.unitPrice)}
                                </td>
                                <td className="py-2.5 px-2 text-center font-bold text-slate-900 font-mono">
                                  {item.soldQuantity} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                                </td>
                                <td className="py-2.5 px-2 text-center font-mono">
                                  {item.freeQuantity > 0 ? (
                                    <span className="inline-block px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                      +{item.freeQuantity}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-2 text-center font-bold text-blue-700 font-mono">
                                  {item.totalQuantity}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold font-mono text-slate-900">
                                  {formatMoney(item.totalRevenue)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-500 text-[11px]">
                                  <div className="inline-flex items-center gap-1">
                                    <span>{share}%</span>
                                    <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:inline-block">
                                      <div
                                        className="h-full bg-emerald-500 rounded-full"
                                        style={{ width: `${Math.min(100, parseFloat(share))}%` }}
                                      />
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-200 text-xs">
                            <td colSpan={3} className="py-2.5 px-3 text-slate-800">
                              TOTALS ({itemWiseSalesData.items.length} Products)
                            </td>
                            <td className="py-2.5 px-2 text-center text-slate-900 font-mono">
                              {itemWiseSalesData.totalSoldUnits}
                            </td>
                            <td className="py-2.5 px-2 text-center text-emerald-800 font-mono">
                              {itemWiseSalesData.totalFreeUnits > 0 ? `+${itemWiseSalesData.totalFreeUnits}` : '0'}
                            </td>
                            <td className="py-2.5 px-2 text-center text-blue-800 font-mono">
                              {itemWiseSalesData.totalSoldUnits + itemWiseSalesData.totalFreeUnits}
                            </td>
                            <td className="py-2.5 px-3 text-right text-emerald-800 font-mono">
                              {formatMoney(itemWiseSalesData.totalRevenue)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              100%
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="p-3 border-t border-slate-100 bg-white shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFinishedBillsModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Close & Return
              </button>

              <button
                type="button"
                onClick={() => setShowSummaryBillModal(true)}
                disabled={filteredFinishedBills.length === 0}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>{billsViewMode === 'ITEMS' ? 'Print Item-Wise Summary' : 'Print Summary Bill'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMART ROUTE & SKIPPED SHOPS AUDIT MODAL */}
      {showSkippedModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Delivery Route & Visit Audit</h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {routeStatus?.route?.name || selectedLorry?.vehicleNumber || 'Assigned Delivery Territory'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSkippedModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Metrics Ribbon */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border-b border-slate-200/80 text-center">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Scheduled</span>
                <span className="text-lg font-black text-slate-800 font-mono">
                  {routeStatus?.totalCustomers ?? routeOptimization?.totalCount ?? 0}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-2xs">
                <span className="block text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Visited</span>
                <span className="text-lg font-black text-emerald-600 font-mono">
                  {routeStatus?.visitedCount ?? routeOptimization?.visitedCount ?? 0}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-amber-200 bg-amber-50/30 shadow-2xs">
                <span className="block text-[10px] font-bold text-amber-700 uppercase tracking-wider">Remaining</span>
                <span className="text-lg font-black text-amber-600 font-mono">
                  {routeStatus?.unvisitedCount ?? ((routeOptimization?.totalCount || 0) - (routeOptimization?.visitedCount || 0))}
                </span>
              </div>
            </div>

            {/* Skipped / Incomplete Warning */}
            {(routeStatus?.unvisitedCount ?? 0) > 0 && (
              <div className="mx-3 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Driver Accountability Warning</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    {routeStatus?.unvisitedCount} scheduled shops on today's delivery run have not been verified with GPS geofence check-in or bill issuance yet.
                  </p>
                </div>
              </div>
            )}

            {/* Shops List */}
            <div className="p-3 overflow-y-auto space-y-2 flex-1">
              <p className="text-xs font-bold text-slate-700 px-1">
                Remaining Stores ({routeStatus?.unvisitedCustomers.length || 0})
              </p>

              {(!routeStatus?.unvisitedCustomers || routeStatus.unvisitedCustomers.length === 0) ? (
                <div className="p-6 text-center bg-emerald-50/50 border border-emerald-200 rounded-xl">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-emerald-900">All Scheduled Stores Visited!</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">Great job! 100% route completion verified.</p>
                </div>
              ) : (
                routeStatus.unvisitedCustomers.map(cust => (
                  <div
                    key={cust.id}
                    className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2.5 shadow-2xs hover:border-slate-300 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900 truncate">{cust.name}</span>
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded-full">
                          Pending
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {cust.deliveryAddress || cust.city || cust.phone || 'Angoda'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {cust.latitude != null && cust.longitude != null && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowSkippedModal(false);
                            handleNavigateToCustomer(cust as any);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>Navigate</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomerId(cust.id);
                          setShowSkippedModal(false);
                          setCurrentStep(2);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                      >
                        <Receipt className="w-3 h-3" />
                        <span>Bill Shop</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-200 bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={() => setShowSkippedModal(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REP'S BILLS SUMMARY PRINT MODAL (80mm Thermal & Bluetooth) */}
      <RepBillsSummaryModal
        isOpen={showSummaryBillModal}
        onClose={() => setShowSummaryBillModal(false)}
        allBills={finishedBills}
        filteredBills={filteredFinishedBills}
        activeFilter={billsFilter}
        dateRangeLabel={billsDateRangeLabel}
        lorry={selectedLorry}
        user={user}
      />

      {/* CAMERA BARCODE & QR CODE SCANNER MODAL */}
      <BarcodeScannerModal
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScanned}
        title="Mobile Barcode Scanner"
        subtitle="Aim camera at product barcode or QR code"
      />

      {/* HARD CREDIT STOP ADMIN PASSCODE MODAL */}
      <AdminPasscodeModal
        isOpen={showAdminPasscodeModal}
        customer={selectedCustomer}
        onClose={() => setShowAdminPasscodeModal(false)}
        onAuthorize={(pin, authName) => {
          setAdminOverridePasscode(pin);
          setAuthorizedByName(authName);
          setShowAdminPasscodeModal(false);
        }}
        onSwitchToCash={() => {
          setPaymentMethod('CASH');
          setShowAdminPasscodeModal(false);
        }}
        onSwitchToCheque={() => {
          setPaymentMethod('CHEQUE');
          setShowAdminPasscodeModal(false);
        }}
      />

      {/* APPLE iOS STYLE SHIFT HUB BOTTOM SHEET / MODAL */}
      {showShiftHubModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            {/* iOS Pull indicator handle (mobile) */}
            <div className="pt-2.5 pb-1 flex justify-center sm:hidden">
              <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-700 text-white flex items-center justify-center shadow-xs">
                  <Truck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-tight">Shift Hub & Route Menu</h2>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    {selectedLorry?.vehicleNumber || 'Route Lorry'} {selectedLorry?.route ? `• ${selectedLorry.route.name}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowShiftHubModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center text-sm font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Hub Content */}
            <div className="p-4 space-y-3.5 overflow-y-auto">
              {/* GPS Live Telemetry Card */}
              {user?.role === 'REP' && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-100 text-emerald-600">
                      <Radio className="w-5 h-5 animate-pulse" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800">Office Fleet Tracking</span>
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      </div>
                      <p className="text-[10px] text-slate-600 truncate mt-0.5">
                        Live GPS broadcast active (Enforced by company)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      verifyAndEnableGps(true);
                      setShowShiftHubModal(false);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 border bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs"
                  >
                    Refresh GPS
                  </button>
                </div>
              )}

              {/* Navigation & Operational Hub Action List */}
              <div className="space-y-2">
                {/* 0. Available Stock on Lorry to Bill */}
                <button
                  type="button"
                  onClick={() => {
                    setShowStockPage(true);
                    setShowShiftHubModal(false);
                  }}
                  className="w-full p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition flex items-center justify-between text-left group shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                      <Boxes className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">Available Stock to Bill</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                          {lorryProducts.length} Items Loaded
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        View all floating items, quantities, and prices loaded on {selectedLorry?.vehicleNumber || 'this lorry'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition" />
                </button>

                {/* 0b. Exchange Stock with Another Lorry */}
                <button
                  type="button"
                  onClick={() => {
                    setShowExchangeModal(true);
                    setShowShiftHubModal(false);
                  }}
                  className="w-full p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-purple-400 hover:bg-purple-50/30 transition flex items-center justify-between text-left group shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                      <ArrowLeftRight className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">Exchange Stock Between Lorries</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700">
                          Transfer
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Transfer or swap items with another lorry on route when stock runs low
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition" />
                </button>

                {/* 0c. Cloud Sync & Offline Bills */}
                <button
                  type="button"
                  onClick={() => {
                    handleSyncPending();
                    setShowShiftHubModal(false);
                  }}
                  className="w-full p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 transition flex items-center justify-between text-left group shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                      <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">Cloud Sync & Offline Bills</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${pendingBillsCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                          {pendingBillsCount > 0 ? `${pendingBillsCount} Pending Sync` : 'All Synced'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {isOnline ? 'Connected to cloud. Tap to sync now.' : 'Offline mode. Bills saved locally until connection restores.'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition" />
                </button>

                {/* 1. Route Stops & Geofenced Sequence */}
                <button
                  type="button"
                  onClick={() => {
                    loadOptimizedRoute();
                    setShowSkippedModal(true);
                    setShowShiftHubModal(false);
                  }}
                  className="w-full p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition flex items-center justify-between text-left group shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                      <Milestone className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">Smart Route & Sequence</span>
                        {routeStatus && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700">
                            {routeStatus.visitedCount}/{routeStatus.totalCustomers} Visited
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Optimized stop order, geofence check-ins, and shop list
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition" />
                </button>

                {/* 2. Rep Sales Targets & Progress */}
                <button
                  type="button"
                  onClick={() => {
                    loadTargets();
                    setShowTargetModal(true);
                    setShowShiftHubModal(false);
                  }}
                  className="w-full p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-purple-400 hover:bg-purple-50/30 transition flex items-center justify-between text-left group shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">Sales Target & Commission</span>
                        {targetProgress && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700">
                            {Math.round(targetProgress.dailyPercentage)}% Achieved
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Daily & monthly sales targets, quotas and incentives
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition" />
                </button>

                {/* 2b. Rep Attendance & Monthly Salary Slip */}
                <button
                  type="button"
                  onClick={() => {
                    handleOpenSalarySlip();
                    setShowShiftHubModal(false);
                  }}
                  className="w-full p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 transition flex items-center justify-between text-left group shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">My Attendance & Salary Slip</span>
                        {attendanceStatus && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            attendanceStatus.isCheckedOut ? 'bg-slate-100 text-slate-700' : attendanceStatus.isCheckedIn ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {attendanceStatus.isCheckedOut ? 'Concluded' : attendanceStatus.isCheckedIn ? 'Shift Active' : 'Not Checked In'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Live worked days, route sales commission, overtime &amp; net salary preview
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition" />
                </button>

                {/* 3. Invoices & Daily Sales Ledger */}
                <button
                  type="button"
                  onClick={() => {
                    setBillsViewMode('BILLS');
                    loadFinishedBills();
                    setShowFinishedBillsModal(true);
                    setShowShiftHubModal(false);
                  }}
                  className="w-full p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 transition flex items-center justify-between text-left group shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">Today's Invoices & Bills</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                          {finishedBills.length} Bill{finishedBills.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Reprint invoices, view summary report, and verify collections
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition" />
                </button>

                {/* 3b. Item-Wise Sales Breakdown */}
                <button
                  type="button"
                  onClick={() => {
                    setBillsViewMode('ITEMS');
                    loadFinishedBills();
                    setShowFinishedBillsModal(true);
                    setShowShiftHubModal(false);
                  }}
                  className="w-full p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 transition flex items-center justify-between text-left group shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">Item-Wise Sales & Quantities</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                          {itemWiseSalesData.items.length} SKUs
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Breakdown of units sold, free scheme issues, and revenue per item with date filters
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition" />
                </button>

                {/* 4. Direct Outstanding Collection (Cash / Cheque) */}
                <button
                  type="button"
                  onClick={() => {
                    setShowShiftHubModal(false);
                    setShowDirectCollectionModal(true);
                  }}
                  className="w-full p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 transition flex items-center justify-between text-left group shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800">Direct Outstanding Collection</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Collect cash, cheque or transfer directly from shop credit
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition" />
                </button>

                {/* 5. Direct Returns Collection (Damage / Resale) */}
                <button
                  type="button"
                  onClick={() => {
                    setShowShiftHubModal(false);
                    setShowDirectReturnsModal(true);
                  }}
                  className="w-full p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 transition flex items-center justify-between text-left group shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                      <RotateCcw className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800">Direct Returns Collection</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Collect damaged or resale returns &amp; issue credit note
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition" />
                </button>
              </div>

              {/* Display Font Size Control */}
              <div className="pt-1">
                <FontSizeInlineStepper />
              </div>

              {/* End Shift & Logout */}
              {onLogout && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowShiftHubModal(false);
                      onLogout();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-98 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 border border-rose-200 transition cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-600" />
                    <span>End Shift & Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DIRECT OUTSTANDING COLLECTION MODAL */}
      <RepDirectCollectionModal
        isOpen={showDirectCollectionModal}
        onClose={() => setShowDirectCollectionModal(false)}
        customer={selectedCustomer}
        customers={customers}
        onSelectCustomer={(c) => setSelectedCustomerId(c.id)}
        lorry={selectedLorry || null}
        user={user}
        onPaymentSuccess={(payment) => {
          setActiveReceiptPayment(payment);
          loadData();
        }}
      />

      {/* DIRECT RETURNS COLLECTION MODAL */}
      <RepDirectReturnsModal
        isOpen={showDirectReturnsModal}
        onClose={() => setShowDirectReturnsModal(false)}
        customer={selectedCustomer}
        customers={customers}
        onSelectCustomer={(c) => setSelectedCustomerId(c.id)}
        products={products}
        lorry={selectedLorry || null}
        user={user}
        onReturnSuccess={(order) => {
          if (onViewInvoice) {
            onViewInvoice(order);
          }
          // Immediately deduct any replacement items from local lorry stock in memory (zero UI delay)
          if (selectedLorryId && Array.isArray(order.items) && order.items.length > 0) {
            setLorries(prev => prev.map(l => {
              if (l.id === selectedLorryId && Array.isArray(l.lorryStocks)) {
                return {
                  ...l,
                  lorryStocks: l.lorryStocks.map(ls => {
                    const swappedItem = order.items.find((oi: any) => oi.productId === ls.productId);
                    if (swappedItem) {
                      return {
                        ...ls,
                        quantity: Math.max(0, ls.quantity - swappedItem.quantity)
                      };
                    }
                    return ls;
                  })
                };
              }
              return l;
            }));
          }
          loadData();
          LorryService.getAll().then(updated => {
            if (Array.isArray(updated) && updated.length > 0) setLorries(updated);
          }).catch(() => {});
        }}
      />

      {/* CUSTOMER PAYMENT RECEIPT MODAL */}
      {activeReceiptPayment && (
        <CustomerReceiptModal
          isOpen={!!activeReceiptPayment}
          payment={activeReceiptPayment}
          customer={activeReceiptPayment.customer || selectedCustomer}
          onClose={() => setActiveReceiptPayment(null)}
        />
      )}

      {/* ======================================================== */}
      {/* ULTRA-CLEAN FULL PAGE: AVAILABLE STOCK TO BILL */}
      {/* ======================================================== */}
      {showStockPage && (
        <div className="fixed inset-0 z-50 bg-[#F1F3F6] flex flex-col overflow-hidden animate-in fade-in duration-150">
          {/* Toast Notification */}
          {stockPageToast && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-900 text-white rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <span>{stockPageToast}</span>
            </div>
          )}

          {/* Sticky Header Bar */}
          <header className="bg-white border-b border-slate-200 px-4 py-3 shrink-0 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setShowStockPage(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer border border-slate-200"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight leading-tight truncate">
                    Available Stock to Bill
                  </h1>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                    {selectedLorry?.vehicleNumber || 'Route Lorry'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium truncate">
                  {selectedLorry?.route ? `${selectedLorry.route.name} • ` : ''}Driver: {selectedLorry?.driverName || 'Assigned Driver'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleRefreshStock}
                disabled={isRefreshingStock}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 transition cursor-pointer border border-slate-200"
                title="Refresh Live Floating Stock"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingStock ? 'animate-spin text-blue-600' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => setShowExchangeModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 active:scale-95 text-purple-700 text-xs font-bold transition cursor-pointer border border-purple-200"
                title="Exchange or transfer stock with another lorry"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-purple-600" />
                <span>Exchange</span>
              </button>

              <button
                type="button"
                onClick={handlePrintStock}
                className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold transition cursor-pointer border border-slate-200"
                title="Print Lorry Stock Inventory Sheet"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>

              <button
                type="button"
                onClick={() => setShowStockPage(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-bold transition cursor-pointer"
                aria-label="Close Stock View"
              >
                ✕
              </button>
            </div>
          </header>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 max-w-4xl w-full mx-auto space-y-4">
            {/* 4 KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Loaded Items
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-extrabold text-slate-900 tracking-tight">
                    {stockPageStats.itemCount}
                  </span>
                  <span className="text-xs font-bold text-slate-400">SKUs</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Available Paid
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-extrabold text-emerald-600 tracking-tight">
                    {stockPageStats.totalPaidQty}
                  </span>
                  <span className="text-xs font-bold text-emerald-700">Units</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Free Issue Stock
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-extrabold text-blue-600 tracking-tight">
                    {stockPageStats.totalFreeQty}
                  </span>
                  <span className="text-xs font-bold text-blue-700">Free</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Lorry Valuation
                </span>
                <div className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight truncate">
                  {formatMoney(stockPageStats.totalValuation)}
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs space-y-2.5">
              <div className="flex flex-col sm:flex-row gap-2">
                {/* Search Box */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={stockSearch}
                    onChange={e => setStockSearch(e.target.value)}
                    placeholder="Search by product name, SKU or barcode..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {stockSearch && (
                    <button
                      type="button"
                      onClick={() => setStockSearch('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold w-4 h-4 flex items-center justify-center cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Sort Dropdown */}
                <div className="shrink-0 flex items-center gap-1.5">
                  <select
                    value={stockSortFilter}
                    onChange={e => setStockSortFilter(e.target.value as any)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="STOCK_DESC">Highest Stock First</option>
                    <option value="STOCK_ASC">Lowest Stock First</option>
                    <option value="PRICE">Price (High to Low)</option>
                    <option value="NAME">Name (A-Z)</option>
                  </select>
                </div>
              </div>

              {/* Brand / Category Chips */}
              {stockCategories.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setStockCategoryFilter('ALL')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${stockCategoryFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    All Items ({lorryProducts.length})
                  </button>
                  {stockCategories.map(cat => (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setStockCategoryFilter(cat.name)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-1.5 ${stockCategoryFilter.toLowerCase() === cat.name.toLowerCase()
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      <span>{cat.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${stockCategoryFilter.toLowerCase() === cat.name.toLowerCase()
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 text-slate-700'
                        }`}>
                        {cat.count}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Stock Cards List */}
            {filteredStockProducts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-2">
                <Boxes className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">
                  {stockSearch || stockCategoryFilter !== 'ALL'
                    ? 'No matching products found'
                    : 'No Stock Loaded on This Lorry'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {stockSearch || stockCategoryFilter !== 'ALL'
                    ? 'Try adjusting your search query or brand filter.'
                    : 'Use the Morning Lorry Load module to dispatch items to this lorry before billing.'}
                </p>
                {(stockSearch || stockCategoryFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setStockSearch('');
                      setStockCategoryFilter('ALL');
                    }}
                    className="mt-2 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredStockProducts.map(product => {
                  const s = lorryStockMap.get(product.id);
                  const paid = s?.stock || 0;
                  const free = s?.freeStock || 0;
                  const hasScheme = (product.freeRatioBuy || 0) > 0 && (product.freeRatioGet || 0) > 0;
                  const isLow = paid > 0 && paid <= (product.minStockAlert || 10);
                  const cartItem = cart.find(c => c.productId === product.id);

                  return (
                    <div
                      key={product.id}
                      className="bg-white rounded-2xl border border-slate-200/90 p-3.5 hover:border-slate-300 transition shadow-2xs flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1.5">
                        {/* Top meta tags */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            {product.sku}
                          </span>
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-md">
                            {product.category}
                          </span>
                        </div>

                        {/* Product Title */}
                        <h4 className="text-sm font-bold text-slate-900 leading-snug">
                          {product.name}
                        </h4>

                        {/* Price & Unit & Scheme */}
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="font-extrabold text-slate-900">
                            {formatMoney(product.unitPrice)}
                          </span>
                          <span className="text-slate-400 font-medium">/ {product.unit}</span>
                          {hasScheme && (
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200/80 px-1.5 py-0.2 rounded-md">
                              Buy {product.freeRatioBuy} + {product.freeRatioGet} Free
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stock Pill & Action Row */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className={`px-2.5 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1.5 ${isLow
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}>
                            <span className={`w-2 h-2 rounded-full ${isLow ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                            <span>{paid} {product.unit}</span>
                          </div>

                          {free > 0 && (
                            <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-xl">
                              +{free} Free
                            </span>
                          )}
                        </div>

                        {/* Action: Add to Cart if customer selected, or Select to Bill */}
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedCustomerId) {
                              setStockPageToast('⚠️ Please select a customer first before adding items to cart');
                              setTimeout(() => setStockPageToast(null), 3000);
                              return;
                            }
                            addToCart(product, 1);
                            setStockPageToast(`✓ Added 1x "${product.name}" to cart`);
                            setTimeout(() => setStockPageToast(null), 2500);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 active:scale-95 cursor-pointer shadow-2xs ${!selectedCustomerId
                            ? 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                            : cartItem
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                        >
                          {!selectedCustomerId ? (
                            <>
                              <Lock className="w-3.5 h-3.5 text-slate-400" />
                              <span>Select Shop First</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5 stroke-[3]" />
                              <span>{cartItem ? `In Cart (${cartItem.quantity})` : 'Add to Bill'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lorry Stock Exchange Modal */}
      <LorryStockExchangeModal
        isOpen={showExchangeModal}
        onClose={() => setShowExchangeModal(false)}
        defaultFromLorryId={selectedLorryId || initialLorryId || user?.lorryId || ''}
        onSuccess={() => {
          loadData();
          setStockPageToast('✓ Stock successfully transferred/exchanged!');
          setTimeout(() => setStockPageToast(null), 3500);
        }}
      />

      {/* TAKE PRE-ORDER MODAL (MOBILE REP PORTAL) */}
      {showPreOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-scaleUp">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>Pre-Order: {selectedCustomer?.name || 'Customer'}</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Book out-of-stock items for next route visit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreOrderModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePreOrder} className="p-4 space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Product to Book <span className="text-rose-500">*</span>
                </label>
                <select
                  value={preOrderProductId}
                  onChange={e => setPreOrderProductId(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose Item from Catalog --</option>
                  {products.map(p => {
                    const lStock = lorryStockMap.get(p.id)?.stock || 0;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} {lStock <= 0 ? '(0 on Lorry - Out of Stock)' : `(${lStock} on Lorry)`}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Requested Quantity <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={preOrderQty}
                  onChange={e => setPreOrderQty(parseInt(e.target.value, 10) || 1)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Customer Remarks / Target Date
                </label>
                <input
                  type="text"
                  value={preOrderNotes}
                  onChange={e => setPreOrderNotes(e.target.value)}
                  placeholder="e.g. Bring on next route run"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPreOrderModal(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPreOrder}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {submittingPreOrder ? 'Saving...' : 'Confirm Pre-Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* REP SALARY SLIP PREVIEW MODAL */}
      {showSalarySlipModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            {/* iOS Handle (Mobile) */}
            <div className="pt-2.5 pb-1 flex justify-center sm:hidden">
              <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
            </div>

            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">My Salary &amp; Route Commission</h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    {salarySlip ? `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][(salarySlip.period?.month || 1) - 1]} ${salarySlip.period?.year}` : 'Current Month Slip'} &bull; Live Payroll Preview
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSalarySlipModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center text-sm font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              {loadingSalarySlip ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="text-xs font-semibold">Calculating live route earnings &amp; attendance...</span>
                </div>
              ) : !salarySlip ? (
                <div className="py-8 text-center text-slate-500">
                  <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="font-semibold">Employee profile not linked</p>
                  <p className="text-[11px] text-slate-400 mt-1">Please make sure this Rep user is linked to an Employee record in HR.</p>
                </div>
              ) : (
                <>
                  {/* Rep Identity Banner */}
                  <div className="p-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-100 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{salarySlip.employee?.fullName || user?.fullName}</p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {salarySlip.employee?.employeeNumber || 'REP-EMP'} &bull; {salarySlip.employee?.designation || 'Sales Representative'}
                      </p>
                    </div>
                    {selectedLorry?.vehicleNumber && (
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Assigned Lorry</span>
                        <span className="font-bold text-slate-800 text-xs font-mono">{selectedLorry.vehicleNumber}</span>
                      </div>
                    )}
                  </div>

                  {/* 3 Metric Mini Cards */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider">Days Worked</span>
                      <span className="text-base font-extrabold text-slate-900 font-mono mt-0.5 block">
                        {salarySlip.attendanceMetrics?.workedDays ?? 0}
                        <span className="text-[10px] text-slate-400 font-normal"> / 26d</span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider">OT Hours</span>
                      <span className="text-base font-extrabold text-blue-600 font-mono mt-0.5 block">
                        {(salarySlip.attendanceMetrics?.totalOtHours ?? 0).toFixed(1)}
                        <span className="text-[10px] text-slate-400 font-normal"> hrs</span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider">Commission</span>
                      <span className="text-base font-extrabold text-emerald-600 font-mono mt-0.5 block truncate">
                        {formatMoney(salarySlip.earnings?.salesCommission ?? 0)}
                      </span>
                    </div>
                  </div>

                  {/* Route Sales Note */}
                  <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-emerald-900">
                      <Target className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Route Sales Total: <strong>{formatMoney(salarySlip.earnings?.monthlySalesTotal ?? 0)}</strong></span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-200/80 text-emerald-900 font-mono font-bold text-[10px]">
                      {salarySlip.earnings?.commissionRate ?? 1.5}% Rate
                    </span>
                  </div>

                  {/* Earnings & Deductions Breakdown */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                    {/* Earnings Group */}
                    <div className="p-3 space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Earnings</p>
                      <div className="flex justify-between items-center text-slate-700">
                        <span>Basic Salary</span>
                        <span className="font-mono font-semibold">{formatMoney(salarySlip.earnings?.basicSalary ?? 0)}</span>
                      </div>
                      {(salarySlip.earnings?.salesCommission ?? 0) > 0 && (
                        <div className="flex justify-between items-center text-emerald-700">
                          <span>Route Sales Commission ({salarySlip.earnings?.commissionRate ?? 1.5}%)</span>
                          <span className="font-mono font-bold">+{formatMoney(salarySlip.earnings?.salesCommission ?? 0)}</span>
                        </div>
                      )}
                      {(salarySlip.earnings?.otAmount ?? 0) > 0 && (
                        <div className="flex justify-between items-center text-blue-700">
                          <span>Overtime Pay ({(salarySlip.attendanceMetrics?.totalOtHours ?? 0).toFixed(1)} hrs)</span>
                          <span className="font-mono font-semibold">+{formatMoney(salarySlip.earnings?.otAmount ?? 0)}</span>
                        </div>
                      )}
                      {(salarySlip.earnings?.allowances ?? 0) > 0 && (
                        <div className="flex justify-between items-center text-slate-700">
                          <span>Fixed Allowances (Travel / Food)</span>
                          <span className="font-mono font-semibold">+{formatMoney(salarySlip.earnings?.allowances ?? 0)}</span>
                        </div>
                      )}
                      <div className="pt-1 border-t border-slate-100 flex justify-between items-center text-slate-900 font-bold">
                        <span>Gross Earnings</span>
                        <span className="font-mono">{formatMoney(salarySlip.earnings?.grossEarnings ?? 0)}</span>
                      </div>
                    </div>

                    {/* Deductions Group */}
                    <div className="p-3 space-y-1.5 bg-slate-50/40">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Deductions</p>
                      {(salarySlip.deductions?.epfDeduction ?? 0) > 0 && (
                        <div className="flex justify-between items-center text-slate-600">
                          <span>EPF (8% Employee Contribution)</span>
                          <span className="font-mono text-rose-600 font-semibold">-{formatMoney(salarySlip.deductions?.epfDeduction ?? 0)}</span>
                        </div>
                      )}
                      {(salarySlip.deductions?.advancesDeducted ?? 0) > 0 && (
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Salary Advances Drawn This Month</span>
                          <span className="font-mono text-rose-600 font-semibold">-{formatMoney(salarySlip.deductions?.advancesDeducted ?? 0)}</span>
                        </div>
                      )}
                      {(salarySlip.deductions?.otherDeductions ?? 0) > 0 && (
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Other Deductions</span>
                          <span className="font-mono text-rose-600 font-semibold">-{formatMoney(salarySlip.deductions?.otherDeductions ?? 0)}</span>
                        </div>
                      )}
                      <div className="pt-1 border-t border-slate-100 flex justify-between items-center text-slate-700 font-semibold">
                        <span>Total Deductions</span>
                        <span className="font-mono text-rose-600 font-bold">-{formatMoney(salarySlip.deductions?.totalDeductions ?? 0)}</span>
                      </div>
                    </div>

                    {/* Net Take-Home Pay Pill */}
                    <div className="p-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-100 block">Net Estimated Take-Home Pay</span>
                        <span className="text-[11px] text-emerald-100 font-medium">After all EPF &amp; advance deductions</span>
                      </div>
                      <span className="text-xl font-extrabold font-mono tracking-tight">
                        {formatMoney(salarySlip.netPayable ?? 0)}
                      </span>
                    </div>
                  </div>

                  {/* Informational Employer Contributions */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[10.5px] text-slate-500 flex items-center justify-between">
                    <span>Employer Benefits Paid:</span>
                    <span className="font-medium text-slate-700 font-mono">
                      EPF (12%): {formatMoney(salarySlip.deductions?.employerEpf ?? 0)} &bull; ETF (3%): {formatMoney(salarySlip.deductions?.employerEtf ?? 0)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => executeSystemPrint()}
                className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Slip</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSalarySlipModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition active:scale-95 cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
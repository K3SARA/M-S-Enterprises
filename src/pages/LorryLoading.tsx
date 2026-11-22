import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Truck,
  Plus,
  PackageCheck,
  CheckCircle2,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  Boxes,
  Compass,
  RotateCcw,
  ArrowLeftRight,
  ArrowDownToLine,
  Search,
  X,
  Package,
  ChevronDown
} from 'lucide-react';
import { Lorry, Product, LorryLoading as LorryLoadingType } from '../types';
import { LorryService, ProductService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';
import { LorryStockExchangeModal } from '../components/LorryStockExchangeModal';

interface LoadingRow {
  productId: string;
  quantity: number;
  freeQuantity?: number;
}

// Ultra neat and clean searchable product dropdown for each row
const SearchableProductSelect: React.FC<{
  value: string;
  onChange: (productId: string) => void;
  availableProducts: Product[];
  warehouseProducts: Product[];
  mode?: 'LOAD' | 'UNLOAD';
}> = ({ value, onChange, availableProducts, warehouseProducts, mode = 'LOAD' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const selectedProduct = warehouseProducts.find(p => p.id === value);
  const matchedInAvailable = availableProducts.find(p => p.id === value);

  // Available options: available in stock + the currently selected product if not in available
  const options = useMemo(() => {
    let list = availableProducts;
    if (value && !availableProducts.some(p => p.id === value)) {
      const existing = warehouseProducts.find(p => p.id === value);
      if (existing) list = [existing, ...list];
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase().trim();
    return list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)
    );
  }, [availableProducts, warehouseProducts, value, search]);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Clickable Row Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3.5 py-2.5 text-left text-sm flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs transition-all cursor-pointer min-h-[44px]"
      >
        {selectedProduct ? (
          <div className="flex items-center justify-between w-full min-w-0 gap-3">
            <span className="font-semibold text-slate-800 truncate text-sm">
              {selectedProduct.name}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-mono font-medium px-2.5 py-1 rounded-lg ${
                mode === 'UNLOAD' ? 'text-amber-900 bg-amber-50 border border-amber-200/70' : 'text-slate-700 bg-slate-100'
              }`}>
                {mode === 'UNLOAD' ? 'Lorry:' : 'Qty:'} <strong className="font-bold">{matchedInAvailable ? matchedInAvailable.currentStock : selectedProduct.currentStock}</strong>
              </span>
              <span className="text-xs font-mono font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg">
                {mode === 'UNLOAD' ? 'Lorry Free:' : 'Free:'} <strong className="text-emerald-700 font-bold">{matchedInAvailable ? (matchedInAvailable.freeStock || 0) : (selectedProduct.freeStock || 0)}</strong>
              </span>
            </div>
          </div>
        ) : (
          <span className="text-slate-400 font-normal">
            {mode === 'UNLOAD' ? '-- Choose Item from Lorry to Unload --' : '-- Choose In-Stock Item to Load --'}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-64 overflow-hidden z-40 flex flex-col">
          {/* Mini Search Filter */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search item name..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Ultra Neat and Clean List */}
          <div className="overflow-y-auto divide-y divide-slate-100/90 max-h-52">
            {options.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                {mode === 'UNLOAD' ? 'No items available on this lorry' : 'No matching in-stock items found'}
              </div>
            ) : (
              options.map((p) => {
                const isSelected = p.id === value;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onChange(p.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full text-left py-2.5 px-4 hover:bg-blue-50/70 transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                      isSelected ? 'bg-blue-50/90' : 'bg-white'
                    }`}
                  >
                    <span className={`text-sm truncate mr-2 ${isSelected ? 'font-bold text-blue-700' : 'font-medium text-slate-800'}`}>
                      {p.name}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-mono font-medium px-2.5 py-1 rounded-lg ${
                        mode === 'UNLOAD' ? 'text-amber-900 bg-amber-50 border border-amber-200/70' : 'text-slate-700 bg-slate-100'
                      }`}>
                        {mode === 'UNLOAD' ? 'Lorry:' : 'Qty:'} <strong className="font-bold">{p.currentStock}</strong>
                      </span>
                      <span className="text-xs font-mono font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg">
                        {mode === 'UNLOAD' ? 'Free:' : 'Free:'} <strong className="text-emerald-700 font-bold">{p.freeStock || 0}</strong>
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const LorryLoading: React.FC = () => {
  const { formatMoney } = useCurrency();
  const [lorries, setLorries] = useState<Lorry[]>([]);
  const [selectedLorryId, setSelectedLorryId] = useState<string>('');
  const [warehouseProducts, setWarehouseProducts] = useState<Product[]>([]);
  const [activeLoading, setActiveLoading] = useState<LorryLoadingType | null>(null);
  const [operationMode, setOperationMode] = useState<'LOAD' | 'UNLOAD'>('LOAD');
  const [loadingRows, setLoadingRows] = useState<LoadingRow[]>([
    { productId: '', quantity: 0, freeQuantity: 0 }
  ]);
  const [unloadingRows, setUnloadingRows] = useState<LoadingRow[]>([
    { productId: '', quantity: 0, freeQuantity: 0 }
  ]);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showExchangeModal, setShowExchangeModal] = useState<boolean>(false);

  // Quick Search & Add State
  const [quickSearchQuery, setQuickSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close search popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedLorry = lorries.find(l => l.id === selectedLorryId);

  // Filter warehouse products to ONLY those with available stock (> 0 paid or > 0 free)
  const availableWarehouseProducts = useMemo(() => {
    return warehouseProducts.filter(p => (p.currentStock > 0 || (p.freeStock || 0) > 0));
  }, [warehouseProducts]);

  // Filter lorry products to ONLY those with available stock on board (> 0 paid or > 0 free)
  const availableLorryProducts = useMemo(() => {
    if (!selectedLorry || !Array.isArray(selectedLorry.lorryStocks)) return [];
    return selectedLorry.lorryStocks
      .filter(s => (s.quantity > 0) || ((s.freeQuantity || 0) > 0))
      .map(s => ({
        ...s.product,
        currentStock: s.quantity,
        freeStock: s.freeQuantity || 0
      }));
  }, [selectedLorry]);

  // Matching products for quick search bar
  const quickSearchResults = useMemo(() => {
    const list = operationMode === 'LOAD' ? availableWarehouseProducts : availableLorryProducts;
    const q = quickSearchQuery.trim().toLowerCase();
    if (!q) {
      return list.slice(0, 10);
    }
    return list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  }, [operationMode, availableWarehouseProducts, availableLorryProducts, quickSearchQuery]);

  const handleAddProductFromSearch = (product: Product) => {
    if (operationMode === 'LOAD') {
      const emptyIndex = loadingRows.findIndex(r => !r.productId);
      if (emptyIndex !== -1) {
        const updated = [...loadingRows];
        updated[emptyIndex] = { ...updated[emptyIndex], productId: product.id };
        setLoadingRows(updated);
      } else {
        setLoadingRows(prev => [...prev, { productId: product.id, quantity: 0, freeQuantity: 0 }]);
      }
    } else {
      const emptyIndex = unloadingRows.findIndex(r => !r.productId);
      if (emptyIndex !== -1) {
        const updated = [...unloadingRows];
        updated[emptyIndex] = { ...updated[emptyIndex], productId: product.id };
        setUnloadingRows(updated);
      } else {
        setUnloadingRows(prev => [...prev, { productId: product.id, quantity: 0, freeQuantity: 0 }]);
      }
    }
    setQuickSearchQuery('');
    setIsSearchOpen(false);
  };

  // Draft persistence
  const DRAFT_KEY = 'distributor_lorry_loading_draft';
  const [hasDraft, setHasDraft] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem(DRAFT_KEY);
    } catch {
      return false;
    }
  });

  // Restore draft on initial load
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.selectedLorryId) setSelectedLorryId(d.selectedLorryId);
        if (Array.isArray(d.loadingRows) && d.loadingRows.length > 0) {
          setLoadingRows(d.loadingRows);
        }
        if (d.notes) setNotes(d.notes);
        setHasDraft(true);
      }
    } catch (e) {
      console.warn('Failed to restore loading draft', e);
    }
  }, []);

  // Auto-save draft on any changes
  useEffect(() => {
    const hasContent =
      notes.trim() !== '' ||
      loadingRows.some(r => r.productId !== '' && r.quantity > 0);

    if (hasContent) {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            selectedLorryId,
            loadingRows,
            notes
          })
        );
        setHasDraft(true);
      } catch (e) {}
    }
  }, [selectedLorryId, loadingRows, notes]);

  const handleClearLoadingForm = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
    setLoadingRows([{ productId: '', quantity: 0 }]);
    setNotes('');
    setHasDraft(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [lorryList, productList] = await Promise.all([
        LorryService.getAll(),
        ProductService.getAll()
      ]);
      setLorries(lorryList);
      setWarehouseProducts(productList.filter(p => !p.isRawMaterial));

      if (lorryList.length > 0 && !selectedLorryId) {
        setSelectedLorryId(lorryList[0].id);
        fetchActiveLoading(lorryList[0].id);
      }
    } catch (err: any) {
      setErrorMessage('Failed to load fleet or inventory data.');
    }
  };

  const fetchActiveLoading = async (lorryId: string) => {
    try {
      const loading = await LorryService.getCurrentLoading(lorryId);
      setActiveLoading(loading);
    } catch (err) {
      setActiveLoading(null);
    }
  };

  const handleLorryChange = (lorryId: string) => {
    setSelectedLorryId(lorryId);
    fetchActiveLoading(lorryId);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const addRow = () => {
    if (operationMode === 'LOAD') {
      setLoadingRows([...loadingRows, { productId: '', quantity: 0, freeQuantity: 0 }]);
    } else {
      setUnloadingRows([...unloadingRows, { productId: '', quantity: 0, freeQuantity: 0 }]);
    }
  };

  const updateRow = (index: number, field: keyof LoadingRow, value: any) => {
    if (operationMode === 'LOAD') {
      const updated = [...loadingRows];
      updated[index] = { ...updated[index], [field]: value };
      setLoadingRows(updated);
    } else {
      const updated = [...unloadingRows];
      updated[index] = { ...updated[index], [field]: value };
      setUnloadingRows(updated);
    }
  };

  const removeRow = (index: number) => {
    if (operationMode === 'LOAD') {
      if (loadingRows.length === 1) {
        setLoadingRows([{ productId: '', quantity: 0, freeQuantity: 0 }]);
        return;
      }
      setLoadingRows(loadingRows.filter((_, i) => i !== index));
    } else {
      if (unloadingRows.length === 1) {
        setUnloadingRows([{ productId: '', quantity: 0, freeQuantity: 0 }]);
        return;
      }
      setUnloadingRows(unloadingRows.filter((_, i) => i !== index));
    }
  };

  const calculateTotalUnits = () => {
    const rows = operationMode === 'LOAD' ? loadingRows : unloadingRows;
    return rows.reduce((sum, r) => sum + (parseInt(r.quantity as any, 10) || 0) + (parseInt(r.freeQuantity as any, 10) || 0), 0);
  };

  const calculateTotalEstimatedValue = () => {
    const rows = operationMode === 'LOAD' ? loadingRows : unloadingRows;
    return rows.reduce((sum, r) => {
      const p = warehouseProducts.find(item => item.id === r.productId);
      const totalUnits = (parseInt(r.quantity as any, 10) || 0) + (parseInt(r.freeQuantity as any, 10) || 0);
      return sum + (p ? p.unitPrice * totalUnits : 0);
    }, 0);
  };

  const handleUnloadAllLorryStock = () => {
    if (!availableLorryProducts || availableLorryProducts.length === 0) {
      alert(`Lorry ${selectedLorry?.vehicleNumber} currently has 0 floating stock to unload.`);
      return;
    }
    setOperationMode('UNLOAD');
    setUnloadingRows(
      availableLorryProducts.map(p => ({
        productId: p.id,
        quantity: p.currentStock || 0,
        freeQuantity: p.freeStock || 0
      }))
    );
  };

  const handleQuickUnloadItem = (productId: string) => {
    const stock = selectedLorry?.lorryStocks?.find(s => s.productId === productId);
    if (!stock) return;
    setOperationMode('UNLOAD');
    setUnloadingRows([
      {
        productId,
        quantity: stock.quantity || 0,
        freeQuantity: stock.freeQuantity || 0
      }
    ]);
  };

  const handleConfirmLoading = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const validRows = loadingRows.filter(r => r.productId && ((r.quantity > 0) || ((r.freeQuantity || 0) > 0)));
    if (validRows.length === 0) {
      setErrorMessage('Please add at least one product with a quantity greater than zero.');
      return;
    }

    // Verify warehouse inventory
    for (const row of validRows) {
      const prod = warehouseProducts.find(p => p.id === row.productId);
      if (prod) {
        if (prod.currentStock < row.quantity) {
          setErrorMessage(
            `Cannot load ${row.quantity} regular units of "${prod.name}". Only ${prod.currentStock} ${prod.unit} available in warehouse.`
          );
          return;
        }
        if ((row.freeQuantity || 0) > (prod.freeStock || 0)) {
          setErrorMessage(
            `Cannot load ${row.freeQuantity} free issue units of "${prod.name}". Only ${prod.freeStock || 0} ${prod.unit} free stock available in warehouse.`
          );
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      const res = await LorryService.loadMorningStock(selectedLorryId, {
        items: validRows.map(r => ({
          productId: r.productId,
          quantity: r.quantity || 0,
          freeQuantity: r.freeQuantity || 0
        })),
        notes: notes.trim() || undefined
      });

      setSuccessMessage(
        `Successfully loaded ${res.totalLoadedItems} units into Lorry ${selectedLorry?.vehicleNumber}! Warehouse stock deducted.`
      );
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch (e) {}
      setHasDraft(false);
      setLoadingRows([{ productId: '', quantity: 0, freeQuantity: 0 }]);
      setNotes('');

      // Refresh data
      await loadData();
      await fetchActiveLoading(selectedLorryId);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Error executing morning loading.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmUnloading = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const validRows = unloadingRows.filter(r => r.productId && ((r.quantity > 0) || ((r.freeQuantity || 0) > 0)));
    if (validRows.length === 0) {
      setErrorMessage('Please add at least one product with an unload quantity greater than zero.');
      return;
    }

    // Verify lorry inventory
    for (const row of validRows) {
      const lorryStock = selectedLorry?.lorryStocks?.find(s => s.productId === row.productId);
      const availQty = lorryStock?.quantity || 0;
      const availFree = lorryStock?.freeQuantity || 0;
      const prodName = lorryStock?.product?.name || 'Product';

      if (row.quantity > availQty) {
        setErrorMessage(
          `Cannot unload ${row.quantity} regular units of "${prodName}". Only ${availQty} available on Lorry ${selectedLorry?.vehicleNumber}.`
        );
        return;
      }
      if ((row.freeQuantity || 0) > availFree) {
        setErrorMessage(
          `Cannot unload ${row.freeQuantity} free issue units of "${prodName}". Only ${availFree} available on Lorry ${selectedLorry?.vehicleNumber}.`
        );
        return;
      }
    }

    try {
      setSubmitting(true);
      const res = await LorryService.unloadMorningStock(selectedLorryId, {
        items: validRows.map(r => ({
          productId: r.productId,
          quantity: r.quantity || 0,
          freeQuantity: r.freeQuantity || 0
        })),
        notes: notes.trim() || undefined
      });

      setSuccessMessage(
        `✓ ${res.message || `Successfully unloaded ${res.totalUnloadedItems} units from Lorry ${selectedLorry?.vehicleNumber} back to Central Warehouse!`}`
      );
      setUnloadingRows([{ productId: '', quantity: 0, freeQuantity: 0 }]);
      setNotes('');

      // Refresh data
      await loadData();
      await fetchActiveLoading(selectedLorryId);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Error executing lorry unloading.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
            <Boxes className="w-4 h-4" />
            <span>Step 2: Morning Dispatch Workflow</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Morning Lorry Loading
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Transfer bulk items from Central Warehouse into the 3 route lorries before daily departure.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOperationMode(prev => prev === 'LOAD' ? 'UNLOAD' : 'LOAD')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-2xl shadow-2xs transition-all active:scale-95 cursor-pointer border ${
              operationMode === 'UNLOAD'
                ? 'text-amber-800 bg-amber-100/90 border-amber-300 ring-2 ring-amber-400/40'
                : 'text-amber-700 bg-amber-50 hover:bg-amber-100/80 border-amber-200/90'
            }`}
            title="Switch between Morning Loading and Lorry Unloading"
          >
            <ArrowDownToLine className="w-4 h-4 text-amber-600" />
            <span>{operationMode === 'UNLOAD' ? 'Mode: Unloading (Active)' : 'Unload from Lorry'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowExchangeModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/90 rounded-2xl shadow-2xs transition-all active:scale-95 cursor-pointer"
            title="Transfer or swap inventory between two lorries on route"
          >
            <ArrowLeftRight className="w-4 h-4 text-purple-600" />
            <span>Exchange Between Lorries</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-medium bg-white px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl border border-slate-200/80 shadow-2xs">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600 font-medium">
              Today: {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 sm:p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs sm:text-sm font-medium animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 sm:p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs sm:text-sm font-medium animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Lorry Selector Cards (3 Lorries) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {lorries.map((lorry) => {
          const isSelected = lorry.id === selectedLorryId;
          const floatingUnits = lorry.lorryStocks?.reduce((sum, s) => sum + s.quantity, 0) || 0;
          return (
            <button
              key={lorry.id}
              onClick={() => handleLorryChange(lorry.id)}
              className={`text-left p-5 rounded-3xl border transition-all duration-150 flex flex-col justify-between ${isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20 ring-2 ring-blue-600 ring-offset-2'
                  : 'bg-white text-slate-800 border-slate-200/80 hover:border-slate-300 shadow-2xs'
                }`}
            >
              <div className="flex items-start justify-between w-full mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isSelected ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'
                      }`}
                  >
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-mono text-xs font-bold uppercase tracking-wider block">
                      {lorry.vehicleNumber}
                    </span>
                    <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                      {lorry.driverName}
                    </span>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                    }`}
                >
                  {lorry.status}
                </span>
              </div>

              <div
                className={`pt-3 border-t text-xs space-y-1 ${isSelected ? 'border-white/20 text-blue-100' : 'border-slate-100 text-slate-500'
                  }`}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  <Compass className="w-3.5 h-3.5" />
                  <span>{lorry.route?.name || 'Unassigned Route'}</span>
                </div>
                <div className="flex items-center justify-between font-medium pt-1">
                  <span>Current Floating Stock:</span>
                  <span className={`font-bold ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                    {floatingUnits} Units
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Form & Lorry Stock Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Loading Sheet Entry Form (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 space-y-5">
          {/* Segmented Mode Selector: Load vs Unload */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
            <div className="inline-flex p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-2xs">
              <button
                type="button"
                onClick={() => setOperationMode('LOAD')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  operationMode === 'LOAD'
                    ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Boxes className="w-3.5 h-3.5 text-blue-600" />
                <span>Morning Load (Warehouse → Lorry)</span>
              </button>
              <button
                type="button"
                onClick={() => setOperationMode('UNLOAD')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  operationMode === 'UNLOAD'
                    ? 'bg-white text-amber-800 shadow-sm ring-1 ring-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowDownToLine className="w-3.5 h-3.5 text-amber-600" />
                <span>Unload to Warehouse (Lorry → Warehouse)</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-xl border ${
                operationMode === 'LOAD'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                  : 'bg-amber-50 text-amber-800 border-amber-200/60'
              }`}>
                {operationMode === 'LOAD'
                  ? `${availableWarehouseProducts.length} In-Stock Items`
                  : `${availableLorryProducts.length} Lorry Stock Items`}
              </span>
              <button
                type="button"
                onClick={addRow}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                  operationMode === 'LOAD'
                    ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                    : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
                }`}
              >
                <Plus className="w-3.5 h-3.5" /> Add Product Line
              </button>
            </div>
          </div>

          {/* Dynamic Mode Title Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0.5">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {operationMode === 'LOAD' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
                    <span>Morning Stock Issue to {selectedLorry?.vehicleNumber}</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                    <span>Unload Stock from {selectedLorry?.vehicleNumber} to Central Warehouse</span>
                  </>
                )}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {operationMode === 'LOAD'
                  ? `Route: ${selectedLorry?.route?.name || 'Unassigned'} • Driver: ${selectedLorry?.driverName || 'N/A'}`
                  : `Return unsold, surplus, or return items from lorry back into central warehouse inventory.`}
              </p>
            </div>

            {operationMode === 'UNLOAD' && availableLorryProducts.length > 0 && (
              <button
                type="button"
                onClick={handleUnloadAllLorryStock}
                className="text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100/90 border border-amber-200/90 px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-center shrink-0 active:scale-95"
              >
                <ArrowDownToLine className="w-3.5 h-3.5 text-amber-700" />
                <span>Fill All {availableLorryProducts.length} Items on Lorry</span>
              </button>
            )}
          </div>

          {/* Quick Search & 1-Click Add Bar */}
          <div ref={searchContainerRef} className="relative z-20">
            <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 rounded-2xl shadow-2xs border ${
              operationMode === 'LOAD'
                ? 'bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-slate-50 border-blue-200/80'
                : 'bg-gradient-to-r from-amber-50/80 via-orange-50/40 to-slate-50 border-amber-200/80'
            }`}>
              <div className="relative flex-1">
                <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                  operationMode === 'LOAD' ? 'text-blue-500' : 'text-amber-600'
                }`} />
                <input
                  type="text"
                  value={quickSearchQuery}
                  onChange={(e) => {
                    setQuickSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  placeholder={
                    operationMode === 'LOAD'
                      ? `Search warehouse stock by name or SKU to quickly add... (${availableWarehouseProducts.length} available)`
                      : `Search lorry stock by name or SKU to quickly unload... (${availableLorryProducts.length} items on lorry)`
                  }
                  className={`w-full pl-10 pr-9 py-2 bg-white rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 shadow-2xs border ${
                    operationMode === 'LOAD' ? 'border-blue-200/90 focus:ring-blue-500' : 'border-amber-200/90 focus:ring-amber-500'
                  }`}
                />
                {quickSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setQuickSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsSearchOpen(prev => !prev)}
                className={`px-3 py-2 text-xs font-semibold bg-white rounded-xl transition-colors shrink-0 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer border ${
                  operationMode === 'LOAD'
                    ? 'text-blue-700 hover:bg-blue-50 border-blue-200/80'
                    : 'text-amber-800 hover:bg-amber-50 border-amber-200/80'
                }`}
              >
                <Search className={`w-3.5 h-3.5 ${operationMode === 'LOAD' ? 'text-blue-600' : 'text-amber-700'}`} />
                <span>
                  {isSearchOpen
                    ? 'Hide Search List'
                    : operationMode === 'LOAD'
                      ? 'Browse In-Stock Items'
                      : 'Browse Lorry Items'}
                </span>
              </button>
            </div>

            {/* Live Search Results / Quick-Add Dropdown */}
            {isSearchOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-72 overflow-hidden z-30 flex flex-col">
                <div className="overflow-y-auto divide-y divide-slate-100/90 max-h-72">
                  {quickSearchResults.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      {operationMode === 'LOAD'
                        ? `No in-stock warehouse products match "${quickSearchQuery}".`
                        : `No items on lorry match "${quickSearchQuery}".`}
                    </div>
                  ) : (
                    quickSearchResults.map((prod) => {
                      const activeRows = operationMode === 'LOAD' ? loadingRows : unloadingRows;
                      const isAlreadyAdded = activeRows.some(r => r.productId === prod.id);
                      return (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => handleAddProductFromSearch(prod)}
                          className={`w-full text-left py-2.5 px-4 transition-colors flex items-center justify-between gap-3 group cursor-pointer bg-white ${
                            operationMode === 'LOAD' ? 'hover:bg-blue-50/70' : 'hover:bg-amber-50/70'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-sm font-semibold truncate ${
                              operationMode === 'LOAD' ? 'text-slate-800 group-hover:text-blue-700' : 'text-slate-800 group-hover:text-amber-800'
                            }`}>
                              {prod.name}
                            </span>
                            {isAlreadyAdded && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded shrink-0">
                                In Sheet
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs font-mono font-medium px-2.5 py-1 rounded-lg ${
                              operationMode === 'UNLOAD' ? 'text-amber-900 bg-amber-50 border border-amber-200/70' : 'text-slate-700 bg-slate-100'
                            }`}>
                              {operationMode === 'UNLOAD' ? 'Lorry Paid:' : 'Qty:'} <strong className="font-bold">{prod.currentStock}</strong>
                            </span>
                            <span className="text-xs font-mono font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg">
                              {operationMode === 'UNLOAD' ? 'Lorry Free:' : 'Free:'} <strong className="text-emerald-700 font-bold">{prod.freeStock || 0}</strong>
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <form onSubmit={operationMode === 'LOAD' ? handleConfirmLoading : handleConfirmUnloading} className="space-y-4">
            <div className="space-y-3">
              {(operationMode === 'LOAD' ? loadingRows : unloadingRows).map((row, index) => {
                const selectedProd = warehouseProducts.find(p => p.id === row.productId);
                const lorryStock = selectedLorry?.lorryStocks?.find(s => s.productId === row.productId);
                const maxPaid = operationMode === 'LOAD'
                  ? (selectedProd?.currentStock || 0)
                  : (lorryStock?.quantity || 0);
                const maxFree = operationMode === 'LOAD'
                  ? (selectedProd?.freeStock || 0)
                  : (lorryStock?.freeQuantity || 0);

                return (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row items-center gap-3 p-3.5 bg-slate-50 border border-slate-200/70 rounded-2xl"
                  >
                    {/* Ultra Neat and Clean In-Stock Product Dropdown */}
                    <div className="flex-1 w-full">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                        {operationMode === 'LOAD' ? 'Product (In-Stock Only)' : 'Product (On Lorry Only)'}
                      </label>
                      <SearchableProductSelect
                        value={row.productId}
                        onChange={(id) => updateRow(index, 'productId', id)}
                        availableProducts={operationMode === 'LOAD' ? availableWarehouseProducts : availableLorryProducts}
                        warehouseProducts={warehouseProducts}
                        mode={operationMode}
                      />
                    </div>

                    {/* Quantity to Load / Unload (Paid) */}
                    <div className="w-full sm:w-28">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                        {operationMode === 'LOAD' ? 'Paid Qty' : 'Unload Paid'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={maxPaid || 9999}
                        value={row.quantity !== undefined ? row.quantity : ''}
                        onChange={(e) => updateRow(index, 'quantity', parseInt(e.target.value, 10) || 0)}
                        placeholder="0"
                        className={`w-full bg-white border rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 text-center ${
                          operationMode === 'LOAD' ? 'border-slate-200 focus:ring-blue-500' : 'border-amber-200 focus:ring-amber-500'
                        }`}
                      />
                    </div>

                    {/* Free Issue to Load / Unload */}
                    <div className="w-full sm:w-28">
                      <label className="text-xs font-bold text-emerald-700 uppercase tracking-wider block mb-1.5">
                        {operationMode === 'LOAD' ? '+Free Qty' : 'Unload Free'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={maxFree || 9999}
                        value={row.freeQuantity !== undefined && row.freeQuantity !== 0 ? row.freeQuantity : ''}
                        onChange={(e) => updateRow(index, 'freeQuantity', parseInt(e.target.value, 10) || 0)}
                        placeholder="0"
                        title={operationMode === 'LOAD' ? 'Free issue stock to load (Cost: Rs. 0.00)' : 'Free issue stock to unload back to warehouse'}
                        className="w-full bg-emerald-50/60 border border-emerald-300 rounded-xl px-3 py-2.5 text-sm font-bold font-mono text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center"
                      />
                    </div>

                    {/* Stock available badge & Remove */}
                    <div className="flex items-center gap-2 self-end sm:self-center pt-2 sm:pt-4">
                      {selectedProd && (
                        <div className="flex flex-col text-right">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                              operationMode === 'LOAD'
                                ? (selectedProd.currentStock >= row.quantity ? 'bg-slate-200 text-slate-700' : 'bg-rose-100 text-rose-700')
                                : ((lorryStock?.quantity || 0) >= row.quantity ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700')
                            }`}
                          >
                            {operationMode === 'LOAD' ? `Paid: ${selectedProd.currentStock}` : `Lorry: ${lorryStock?.quantity || 0}`}
                          </span>
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-mono mt-0.5"
                          >
                            {operationMode === 'LOAD' ? `Free: ${selectedProd.freeStock || 0}` : `Free: ${lorryStock?.freeQuantity || 0}`}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-white transition-colors cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">
                {operationMode === 'LOAD' ? 'Dispatch Notes / Loading Gate Pass Remarks' : 'Unloading Remarks / Return Reason'}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  operationMode === 'LOAD'
                    ? 'e.g. Standard morning load for Route 1 Colombo South'
                    : 'e.g. Returned unsold stock / route completed / vehicle service'
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Summary & Dispatch Action */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    {operationMode === 'LOAD' ? 'Total Units to Load' : 'Total Units to Unload'}
                  </span>
                  <span className={`text-xl font-bold font-mono ${
                    operationMode === 'LOAD' ? 'text-slate-900' : 'text-amber-900'
                  }`}>
                    {calculateTotalUnits()} Units
                  </span>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Estimated Stock Value
                  </span>
                  <span className={`text-xl font-bold font-mono ${
                    operationMode === 'LOAD' ? 'text-blue-600' : 'text-amber-700'
                  }`}>
                    {formatMoney(calculateTotalEstimatedValue())}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {operationMode === 'LOAD' && hasDraft && (
                  <button
                    type="button"
                    onClick={handleClearLoadingForm}
                    className="px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Clear current loading draft"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                )}

                {operationMode === 'LOAD' ? (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 sm:flex-initial px-6 py-3 bg-[#0071E3] hover:bg-blue-600 active:scale-[0.99] text-white text-xs font-bold rounded-2xl shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>{submitting ? 'Transferring Stock...' : 'Confirm & Load Lorry'}</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 sm:flex-initial px-6 py-3 bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white text-xs font-bold rounded-2xl shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <ArrowDownToLine className="w-4 h-4" />
                    <span>{submitting ? 'Unloading Stock...' : 'Confirm & Unload to Warehouse'}</span>
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Current Lorry Inventory & Active Loading Card (1 Col) */}
        <div className="space-y-4">
          {/* Active Gate Pass status */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Today's Active Loading
                </h3>
              </div>
              {activeLoading && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200/60">
                  {activeLoading.status}
                </span>
              )}
            </div>

            {activeLoading ? (
              <div className="space-y-3">
                <div className="bg-slate-50 p-3 rounded-2xl space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500 font-medium">
                    <span>Gate Pass #:</span>
                    <span className="font-mono font-bold text-slate-900">{activeLoading.loadingNumber}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 font-medium">
                    <span>Loaded Units (This Lorry):</span>
                    <span className="font-bold text-slate-900">{activeLoading.totalLoadedItems}</span>
                  </div>
                  
                  {/* Total Units from all three lorries */}
                  <div className="flex justify-between items-center py-2 px-2.5 bg-blue-50/90 border border-blue-200/80 rounded-xl my-1.5 shadow-2xs">
                    <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs">
                      <Truck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Total Units (All 3 Lorries):</span>
                    </div>
                    <span className="font-mono font-bold text-blue-700 text-sm">
                      {lorries.reduce((acc, l) => {
                        const lLoaded = l.loadings?.[0]?.status !== 'SETTLED' ? (l.loadings?.[0]?.totalLoadedItems || 0) : 0;
                        const lFloating = l.lorryStocks?.reduce((sum, s) => sum + s.quantity, 0) || 0;
                        return acc + (lLoaded > 0 ? lLoaded : lFloating);
                      }, 0)} Units
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-500 font-medium">
                    <span>Sold via Bills:</span>
                    <span className="font-bold text-emerald-600">{activeLoading.totalSoldItems}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 font-medium">
                    <span>Total Sales:</span>
                    <span className="font-bold text-blue-600">{formatMoney(activeLoading.totalSalesAmount)}</span>
                  </div>

                  {/* All 3 Lorries Units Breakdown */}
                  <div className="pt-2 border-t border-slate-200/70 mt-1 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      All 3 Lorries Loaded Units:
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {lorries.map((l) => {
                        const lLoaded = l.loadings?.[0]?.status !== 'SETTLED' ? (l.loadings?.[0]?.totalLoadedItems || 0) : 0;
                        const lFloating = l.lorryStocks?.reduce((sum, s) => sum + s.quantity, 0) || 0;
                        const count = lLoaded > 0 ? lLoaded : lFloating;
                        const isCurrent = l.id === selectedLorryId;
                        return (
                          <div
                            key={l.id}
                            className={`p-1.5 rounded-lg text-center border text-[11px] ${
                              isCurrent
                                ? 'bg-blue-100/70 border-blue-300 font-bold text-blue-900 shadow-2xs'
                                : 'bg-white border-slate-200/70 text-slate-700'
                            }`}
                          >
                            <span className="font-mono text-[9px] block text-slate-400 truncate">{l.vehicleNumber}</span>
                            <span className="font-mono font-bold">{count} u</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Loaded Items Breakdown:
                  </span>
                  {activeLoading.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-1.5 px-2 bg-white border border-slate-100 rounded-xl text-xs"
                    >
                      <span className="font-medium text-slate-800 truncate max-w-[130px]">
                        {item.product.name}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] font-mono">
                        <span className="text-slate-500">{item.loadedQty} loaded</span>
                        <span className="text-emerald-600 font-bold">({item.soldQty} sold)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-400 space-y-3">
                <Boxes className="w-8 h-8 mx-auto text-slate-300" />
                <div>
                  <p className="font-medium text-slate-700">No active loading sheet for this lorry today.</p>
                  <p className="text-[11px] text-slate-400">Fill items above to dispatch this lorry.</p>
                </div>
                
                {/* Total across 3 lorries even if current lorry is empty */}
                <div className="bg-slate-50 p-3 rounded-2xl text-left border border-slate-100 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-blue-600" />
                      Total Units (All 3 Lorries):
                    </span>
                    <span className="font-mono font-bold text-blue-700">
                      {lorries.reduce((acc, l) => {
                        const lLoaded = l.loadings?.[0]?.status !== 'SETTLED' ? (l.loadings?.[0]?.totalLoadedItems || 0) : 0;
                        const lFloating = l.lorryStocks?.reduce((sum, s) => sum + s.quantity, 0) || 0;
                        return acc + (lLoaded > 0 ? lLoaded : lFloating);
                      }, 0)} Units
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {lorries.map((l) => {
                      const lLoaded = l.loadings?.[0]?.status !== 'SETTLED' ? (l.loadings?.[0]?.totalLoadedItems || 0) : 0;
                      const lFloating = l.lorryStocks?.reduce((sum, s) => sum + s.quantity, 0) || 0;
                      const count = lLoaded > 0 ? lLoaded : lFloating;
                      return (
                        <div key={l.id} className="bg-white p-1.5 rounded-lg border border-slate-200/70 text-center text-[11px]">
                          <span className="font-mono text-[9px] text-slate-400 block truncate">{l.vehicleNumber}</span>
                          <span className="font-mono font-bold text-slate-800">{count} u</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Current Floating Inventory on Lorry */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600" />
                Floating Inventory Inside Lorry
              </h3>
              {availableLorryProducts.length > 0 && (
                <button
                  type="button"
                  onClick={handleUnloadAllLorryStock}
                  className="text-[11px] font-bold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100/90 px-2.5 py-1 rounded-xl border border-amber-200/80 flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-2xs"
                  title="Unload all floating items from this lorry back to warehouse"
                >
                  <ArrowDownToLine className="w-3 h-3 text-amber-600" />
                  <span>Unload All</span>
                </button>
              )}
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {selectedLorry?.lorryStocks && selectedLorry.lorryStocks.length > 0 ? (
                selectedLorry.lorryStocks
                  .filter(s => s.quantity > 0 || (s.freeQuantity || 0) > 0)
                  .map((stock) => (
                    <div
                      key={stock.id}
                      className="flex items-center justify-between py-2 px-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl text-xs transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-semibold text-slate-800 block truncate">{stock.product.name}</span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                          <span className="font-mono">{stock.product.sku}</span>
                          {(stock.freeQuantity || 0) > 0 && (
                            <span className="font-mono font-medium text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200/60">
                              +{stock.freeQuantity} Free
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-slate-900 px-2 py-0.5 bg-white border border-slate-200 rounded-lg">
                          {stock.quantity} {stock.product.unit}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuickUnloadItem(stock.productId)}
                          className="px-2 py-1 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                          title="Unload this product into warehouse"
                        >
                          <ArrowDownToLine className="w-3 h-3 text-amber-600" />
                          <span>Unload</span>
                        </button>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">
                  Lorry has 0 floating inventory currently.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lorry Stock Exchange Modal */}
      <LorryStockExchangeModal
        isOpen={showExchangeModal}
        onClose={() => setShowExchangeModal(false)}
        defaultFromLorryId={selectedLorryId}
        onSuccess={() => {
          loadData();
          if (selectedLorryId) {
            fetchActiveLoading(selectedLorryId);
          }
        }}
      />
    </div>
  );
};

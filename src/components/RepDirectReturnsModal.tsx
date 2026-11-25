import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  RotateCcw,
  Search,
  Plus,
  Trash2,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Receipt,
  ArrowRight,
  Loader2,
  PackageCheck,
  History,
  Tag,
  ArrowLeftRight,
  Package,
  Check
} from 'lucide-react';
import { Customer, Lorry, Order, Product, ReturnableProduct, User } from '../types';
import { CustomerService, LorryService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

interface ReturnLine {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  maxReturnableQty: number;
  returnType: 'DAMAGE' | 'RESALE';
  reason: string;
  billRef?: string;
  isReturnableBottle?: boolean;
  bottleDepositFee?: number;
  chargeBottleFine?: boolean;
}

interface ReplacementLine {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  availableLorryQty: number;
}

interface RepDirectReturnsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  customers: Customer[];
  onSelectCustomer: (c: Customer) => void;
  products?: Product[];
  lorry: Lorry | null;
  user?: User;
  onReturnSuccess: (order: Order) => void;
}

export const RepDirectReturnsModal: React.FC<RepDirectReturnsModalProps> = ({
  isOpen,
  onClose,
  customer,
  customers,
  onSelectCustomer,
  products = [],
  lorry,
  user,
  onReturnSuccess
}) => {
  const { formatMoney } = useCurrency();

  const [searchShop, setSearchShop] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [returnLines, setReturnLines] = useState<ReturnLine[]>([]);
  const [paperBillNumber, setPaperBillNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settlement method: 'NEXT_BILL_CREDIT' (Default: no replacement, amount goes to customer's next bill)
  // or 'REPLACE_NOW' (Item-for-item / basket exchange)
  const [settlementMethod, setSettlementMethod] = useState<'NEXT_BILL_CREDIT' | 'REPLACE_NOW'>('NEXT_BILL_CREDIT');
  const [replacementLines, setReplacementLines] = useState<ReplacementLine[]>([]);
  const [replacementSearch, setReplacementSearch] = useState('');
  const [exchangePaymentMethod, setExchangePaymentMethod] = useState<'CASH' | 'CREDIT' | 'CHEQUE'>('CASH');

  // Returnable products state (strictly fetched from completed customer bills)
  const [returnableProducts, setReturnableProducts] = useState<ReturnableProduct[]>([]);
  const [loadingReturnables, setLoadingReturnables] = useState(false);

  // Load returnable products whenever customer changes
  useEffect(() => {
    if (customer?.id && isOpen) {
      setLoadingReturnables(true);
      setError(null);
      CustomerService.getReturnableProducts(customer.id)
        .then(data => {
          setReturnableProducts(Array.isArray(data) ? data : []);
        })
        .catch(err => {
          console.error('Failed to load returnable products:', err);
          setReturnableProducts([]);
        })
        .finally(() => setLoadingReturnables(false));
    } else {
      setReturnableProducts([]);
    }
  }, [customer?.id, isOpen]);

  // Available stock on lorry for replacement items
  const lorryAvailableProducts = useMemo(() => {
    if (!lorry?.lorryStocks) return [];
    return lorry.lorryStocks
      .filter(ls => ls.quantity > 0)
      .map(ls => {
        const p = products.find(prod => prod.id === ls.productId) || ls.product;
        return {
          id: ls.productId,
          sku: p?.sku || ls.productId.slice(0, 8),
          name: p?.name || ls.product?.name || 'Product',
          unit: p?.unit || ls.product?.unit || 'Pcs',
          unitPrice: p?.unitPrice || ls.product?.unitPrice || 0,
          availableLorryQty: ls.quantity
        };
      })
      .filter(p => p.availableLorryQty > 0);
  }, [lorry?.lorryStocks, products]);

  // Filtered replacement items for picker
  const filteredReplacementProducts = useMemo(() => {
    if (!replacementSearch.trim()) return lorryAvailableProducts;
    const q = replacementSearch.toLowerCase().trim();
    return lorryAvailableProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)
    );
  }, [lorryAvailableProducts, replacementSearch]);

  if (!isOpen) return null;

  // Values calculation
  const totalReturnValue = returnLines.reduce((acc, line) => acc + (line.quantity * line.unitPrice), 0);
  const totalReturnUnits = returnLines.reduce((acc, line) => acc + line.quantity, 0);

  const totalReplacementValue = replacementLines.reduce((acc, line) => acc + (line.quantity * line.unitPrice), 0);
  const totalReplacementUnits = replacementLines.reduce((acc, line) => acc + line.quantity, 0);

  // Bottle Damage Fine calculations (Rs. 120/bottle for broken glass on returnable products)
  const totalBottleDamageFine = returnLines.reduce((acc, line) => {
    if (line.returnType === 'DAMAGE' && line.isReturnableBottle && line.chargeBottleFine !== false) {
      return acc + (line.quantity * (line.bottleDepositFee || 120));
    }
    return acc;
  }, 0);

  const totalDamagedBottlesCount = returnLines.reduce((acc, line) => {
    if (line.returnType === 'DAMAGE' && line.isReturnableBottle && line.chargeBottleFine !== false) {
      return acc + line.quantity;
    }
    return acc;
  }, 0);

  const totalReplacementBottlesCount = replacementLines.reduce((acc, line) => {
    const p = products.find(prod => prod.id === line.productId);
    if (p?.isReturnableBottle) {
      return acc + line.quantity;
    }
    return acc;
  }, 0);

  // Net calculations for exchange (accounting for product values + bottle glass damage fines)
  const rawProductDifference = totalReplacementValue - totalReturnValue;
  const netPayable = Math.max(0, rawProductDifference + totalBottleDamageFine);
  const surplusCreditToNextBill = Math.max(0, totalReturnValue - totalReplacementValue - totalBottleDamageFine);

  // Filter returnable products matching search query
  const filteredReturnables = returnableProducts.filter(rp => {
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase();
    return (
      rp.product.name.toLowerCase().includes(q) ||
      (rp.product.sku && rp.product.sku.toLowerCase().includes(q))
    );
  });

  // Shop filter
  const filteredCustomers = customers.filter(c => {
    if (!searchShop.trim()) return true;
    const q = searchShop.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    );
  });

  const handleAddReturnable = (rp: ReturnableProduct) => {
    setError(null);
    const existingIndex = returnLines.findIndex(l => l.productId === rp.productId);

    if (existingIndex >= 0) {
      const updated = [...returnLines];
      if (updated[existingIndex].quantity + 1 > rp.maxReturnableQty) {
        setError(`Cannot return more than ${rp.maxReturnableQty} ${rp.product.unit || 'units'} (total purchased in completed bills).`);
        return;
      }
      updated[existingIndex].quantity += 1;
      setReturnLines(updated);
    } else {
      if (rp.maxReturnableQty <= 0) {
        setError(`All purchased units of "${rp.product.name}" have already been returned.`);
        return;
      }

      const recentBill = rp.bills[0];
      const billRef = recentBill ? (recentBill.paperBillNumber || recentBill.orderNumber) : undefined;
      const fullProd = products.find(p => p.id === rp.productId) || rp.product;
      const isBottle = Boolean(fullProd?.isReturnableBottle);
      const bottleFee = typeof fullProd?.bottleDepositFee === 'number' ? fullProd.bottleDepositFee : 120;

      setReturnLines([
        ...returnLines,
        {
          productId: rp.productId,
          sku: rp.product.sku,
          name: rp.product.name,
          unit: rp.product.unit || 'Pcs',
          quantity: 1,
          unitPrice: rp.latestUnitPrice || rp.product.unitPrice || 0,
          maxReturnableQty: rp.maxReturnableQty,
          returnType: 'DAMAGE',
          reason: 'Market return / Expired',
          billRef,
          isReturnableBottle: isBottle,
          bottleDepositFee: bottleFee,
          chargeBottleFine: isBottle
        }
      ]);
    }
    setProductSearch('');
  };

  const handleToggleBottleFine = (index: number) => {
    const updated = [...returnLines];
    updated[index].chargeBottleFine = updated[index].chargeBottleFine === false;
    setReturnLines(updated);
  };

  const handleOneClickSwap = (returnLine: ReturnLine) => {
    const lorryItem = lorryAvailableProducts.find(p => p.id === returnLine.productId);
    if (!lorryItem) {
      setError(`"${returnLine.name}" is not currently in lorry stock.`);
      return;
    }
    setSettlementMethod('REPLACE_NOW');
    const existingIdx = replacementLines.findIndex(l => l.productId === returnLine.productId);
    if (existingIdx >= 0) {
      const updated = [...replacementLines];
      const targetQty = Math.min(lorryItem.availableLorryQty, returnLine.quantity);
      updated[existingIdx].quantity = targetQty;
      setReplacementLines(updated);
    } else {
      setReplacementLines([
        ...replacementLines,
        {
          productId: lorryItem.id,
          sku: lorryItem.sku,
          name: lorryItem.name,
          unit: lorryItem.unit,
          quantity: Math.min(lorryItem.availableLorryQty, returnLine.quantity),
          unitPrice: lorryItem.unitPrice,
          availableLorryQty: lorryItem.availableLorryQty
        }
      ]);
    }
  };

  const handleUpdateReturnQty = (index: number, delta: number) => {
    setError(null);
    const updated = [...returnLines];
    const target = updated[index];
    const newQty = target.quantity + delta;

    if (newQty <= 0) {
      updated.splice(index, 1);
    } else if (newQty > target.maxReturnableQty) {
      setError(`Maximum returnable for "${target.name}" is ${target.maxReturnableQty} ${target.unit} based on completed bills.`);
      return;
    } else {
      target.quantity = newQty;
    }
    setReturnLines(updated);
  };

  const handleRemoveReturnLine = (index: number) => {
    const updated = [...returnLines];
    updated.splice(index, 1);
    setReturnLines(updated);
  };

  const handleTypeToggle = (index: number, type: 'DAMAGE' | 'RESALE') => {
    const updated = [...returnLines];
    updated[index].returnType = type;
    if (type === 'DAMAGE' && updated[index].reason === 'Good condition resale') {
      updated[index].reason = 'Market return / Expired';
    } else if (type === 'RESALE' && updated[index].reason === 'Market return / Expired') {
      updated[index].reason = 'Good condition resale';
    }
    setReturnLines(updated);
  };

  const handleReasonQuickTag = (index: number, reason: string) => {
    const updated = [...returnLines];
    updated[index].reason = reason;
    setReturnLines(updated);
  };

  // Replacement items handlers
  const handleAddReplacement = (prod: any) => {
    setError(null);
    const existingIndex = replacementLines.findIndex(l => l.productId === prod.id);
    if (existingIndex >= 0) {
      const updated = [...replacementLines];
      if (updated[existingIndex].quantity + 1 > prod.availableLorryQty) {
        setError(`Only ${prod.availableLorryQty} ${prod.unit} of "${prod.name}" available on lorry.`);
        return;
      }
      updated[existingIndex].quantity += 1;
      setReplacementLines(updated);
    } else {
      setReplacementLines([
        ...replacementLines,
        {
          productId: prod.id,
          sku: prod.sku,
          name: prod.name,
          unit: prod.unit,
          quantity: 1,
          unitPrice: prod.unitPrice,
          availableLorryQty: prod.availableLorryQty
        }
      ]);
    }
    setReplacementSearch('');
  };

  const handleUpdateReplacementQty = (index: number, delta: number) => {
    setError(null);
    const updated = [...replacementLines];
    const target = updated[index];
    const newQty = target.quantity + delta;

    if (newQty <= 0) {
      updated.splice(index, 1);
    } else if (newQty > target.availableLorryQty) {
      setError(`Cannot load more than ${target.availableLorryQty} ${target.unit} of "${target.name}" available on lorry.`);
      return;
    } else {
      target.quantity = newQty;
    }
    setReplacementLines(updated);
  };

  const handleRemoveReplacementLine = (index: number) => {
    const updated = [...replacementLines];
    updated.splice(index, 1);
    setReplacementLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) {
      setError('Please select a customer shop.');
      return;
    }
    if (returnLines.length === 0) {
      setError('Please add at least one returned product from completed bills.');
      return;
    }
    if (!lorry?.id) {
      setError('Active lorry is required to accept returns.');
      return;
    }

    if (settlementMethod === 'REPLACE_NOW' && replacementLines.length === 0) {
      setError('Please select at least one replacement item from lorry stock, or choose "Credit to Next Bill".');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const isExchange = settlementMethod === 'REPLACE_NOW' && replacementLines.length > 0;

      const payload: any = {
        customerId: customer.id,
        paperBillNumber: paperBillNumber.trim() || undefined,
        items: isExchange
          ? replacementLines.map(l => ({
              productId: l.productId,
              quantity: l.quantity,
              freeQuantity: 0,
              unitPrice: l.unitPrice
            }))
          : [],
        returnItems: returnLines.map(line => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          returnType: line.returnType,
          reason: line.reason
        })),
        bottleExchange: (totalDamagedBottlesCount > 0 || totalReplacementBottlesCount > 0) ? {
          deliveredBottles: totalReplacementBottlesCount,
          returnedGoodBottles: 0,
          damagedBottles: totalDamagedBottlesCount,
          missingBottles: 0,
          chargeMissing: false,
          bottleChargeAmount: totalBottleDamageFine
        } : undefined,
        paymentMethod: netPayable > 0 ? exchangePaymentMethod : 'CASH',
        cashReceived: netPayable > 0 && exchangePaymentMethod === 'CASH' ? netPayable : 0,
        isExchangeOrder: isExchange,
        notes: isExchange
          ? `Item Exchange (${user?.fullName || lorry?.driverName || 'Rep'})${totalBottleDamageFine > 0 ? ` | Broken Bottle Fee: Rs. ${totalBottleDamageFine}` : ''}${paperBillNumber ? ` | Ref: ${paperBillNumber}` : ''}`
          : `Direct Return Credit Note (${user?.fullName || lorry?.driverName || 'Rep'}) - To Next Bill${totalBottleDamageFine > 0 ? ` | Broken Bottle Fee: Rs. ${totalBottleDamageFine}` : ''}${paperBillNumber ? ` | Ref: ${paperBillNumber}` : ''}`
      };

      const createdOrder = await LorryService.enterDriverBill(lorry.id, payload);

      onReturnSuccess(createdOrder);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to submit return.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* iOS Pull Handle on Mobile */}
        <div className="pt-2.5 pb-1 flex justify-center sm:hidden">
          <div className="w-12 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <RotateCcw className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900 tracking-tight">
                Direct Returns & Exchanges
              </h2>
              <p className="text-[11px] text-slate-400">Return items for replacement or next-bill credit</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-semibold animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Customer Selection Card */}
          {!customer ? (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Select Customer Shop</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search shop name, code, or phone..."
                  value={searchShop}
                  onChange={e => setSearchShop(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>
              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {filteredCustomers.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectCustomer(c)}
                    className="w-full text-left p-2.5 hover:bg-slate-50 flex items-center justify-between text-xs transition cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{c.name}</div>
                      <div className="text-[10px] text-slate-400">{c.code || c.phone || 'Customer'}</div>
                    </div>
                    {(c.returnCreditBalance || 0) > 0 && (
                      <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        Credit: {formatMoney(c.returnCreditBalance || 0)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900">{customer.name}</span>
                  {customer.code && (
                    <span className="text-[10px] font-mono text-slate-400">({customer.code})</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {customer.phone || customer.deliveryAddress || 'Selected Customer'}
                </div>
              </div>
              {(customer.returnCreditBalance || 0) > 0 && (
                <div className="text-right">
                  <div className="text-[10px] font-medium text-slate-400">Available Credit</div>
                  <div className="text-xs font-bold font-mono text-emerald-700">
                    {formatMoney(customer.returnCreditBalance || 0)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 1: Eligible Return Items */}
          {customer && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>1. Eligible Items (From Past Bills)</span>
                </label>
                {returnableProducts.length > 0 && (
                  <span className="text-[10px] font-medium text-slate-500">
                    {returnableProducts.length} items purchased
                  </span>
                )}
              </div>

              {loadingReturnables ? (
                <div className="p-4 text-center bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" />
                  <p className="text-xs text-slate-400">Loading purchase history...</p>
                </div>
              ) : returnableProducts.length === 0 ? (
                <div className="p-4 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-1">
                  <p className="text-xs font-semibold text-slate-700">No past purchase history</p>
                  <p className="text-[11px] text-slate-400">
                    Only products previously billed can be returned.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {/* Clean Search Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search purchased items..."
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 transition"
                    />
                  </div>

                  {/* Purchased Items List */}
                  <div className="border border-slate-200/80 rounded-2xl bg-white divide-y divide-slate-100 max-h-36 overflow-y-auto">
                    {filteredReturnables.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">No matching items</div>
                    ) : (
                      filteredReturnables.map(rp => {
                        const inCart = returnLines.find(l => l.productId === rp.productId);
                        const isMaxed = inCart && inCart.quantity >= rp.maxReturnableQty;
                        const isZeroAvailable = rp.maxReturnableQty <= 0;

                        return (
                          <div
                            key={rp.productId}
                            onClick={() => {
                              if (!isMaxed && !isZeroAvailable) handleAddReturnable(rp);
                            }}
                            className={`p-2.5 px-3 flex items-center justify-between text-xs transition ${
                              isMaxed || isZeroAvailable
                                ? 'bg-slate-50/70 opacity-50 cursor-not-allowed'
                                : 'hover:bg-slate-50 cursor-pointer'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-semibold text-slate-900 truncate">{rp.product.name}</div>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                                <span className="font-mono">{rp.product.sku}</span>
                                <span>•</span>
                                <span>Billed: {rp.totalPurchasedQty}</span>
                                <span>•</span>
                                <span className="text-slate-600 font-medium">Max: {rp.maxReturnableQty}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono font-bold text-slate-700 text-xs">
                                {formatMoney(rp.latestUnitPrice)}
                              </span>
                              <button
                                type="button"
                                disabled={isMaxed || isZeroAvailable}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${
                                  isMaxed
                                    ? 'bg-slate-100 text-slate-400'
                                    : isZeroAvailable
                                    ? 'bg-slate-100 text-slate-400'
                                    : 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer'
                                }`}
                              >
                                {isMaxed ? 'Max' : isZeroAvailable ? 'Ret’d' : '+ Add'}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Selected Return Lines */}
          {returnLines.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Selected for Return ({returnLines.length})</span>
                <span className="font-mono font-bold text-slate-900">Total: {formatMoney(totalReturnValue)}</span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                {returnLines.map((line, idx) => {
                  const lorryStockItem = lorryAvailableProducts.find(p => p.id === line.productId);
                  const isSwapped = replacementLines.some(r => r.productId === line.productId);

                  return (
                    <div key={line.productId} className="p-3 bg-white border border-slate-200/90 rounded-2xl space-y-2.5 shadow-2xs">
                      {/* Top Row: Name, Unit Price, Delete */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 truncate">{line.name}</div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                            <span className="font-mono">{line.sku}</span>
                            <span>•</span>
                            <span>Max returnable: {line.maxReturnableQty}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold font-mono text-slate-900">
                            {formatMoney(line.quantity * line.unitPrice)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveReturnLine(idx)}
                            className="p-1 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Middle Row: Condition + Stepper */}
                      <div className="flex items-center justify-between gap-2">
                        {/* Condition Segment */}
                        <div className="inline-flex p-0.5 bg-slate-100 rounded-lg text-[10px] font-medium">
                          <button
                            type="button"
                            onClick={() => handleTypeToggle(idx, 'DAMAGE')}
                            className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                              line.returnType === 'DAMAGE'
                                ? 'bg-rose-500 text-white font-bold shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Damaged
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTypeToggle(idx, 'RESALE')}
                            className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                              line.returnType === 'RESALE'
                                ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Good Resale
                          </button>
                        </div>

                        {/* Minimal Stepper */}
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-0.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateReturnQty(idx, -1)}
                            className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:bg-white text-xs font-bold cursor-pointer"
                          >
                            -
                          </button>
                          <span className="font-mono font-bold text-xs text-slate-900 min-w-5 text-center">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateReturnQty(idx, 1)}
                            disabled={line.quantity >= line.maxReturnableQty}
                            className={`w-5 h-5 flex items-center justify-center rounded text-xs font-bold cursor-pointer ${
                              line.quantity >= line.maxReturnableQty
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-slate-600 hover:bg-white'
                            }`}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Reason Pills */}
                      <div className="flex items-center gap-1 flex-wrap">
                        {['Expired', 'Leakage/Dented', 'Slow Moving', 'Excess'].map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleReasonQuickTag(idx, tag)}
                            className={`text-[9.5px] px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                              line.reason === tag
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200/70'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>

                      {/* Bottle Damage Fine & 1-Click Swap Row */}
                      {line.isReturnableBottle && (
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                          {line.returnType === 'DAMAGE' ? (
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span>🍾</span>
                              <span className="text-slate-600">Broken Glass Fine:</span>
                              <strong className={`font-mono font-bold ${line.chargeBottleFine !== false ? 'text-amber-800' : 'text-slate-400 line-through'}`}>
                                {formatMoney((line.bottleDepositFee || 120) * line.quantity)}
                              </strong>
                              <button
                                type="button"
                                onClick={() => handleToggleBottleFine(idx)}
                                className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md transition cursor-pointer ${
                                  line.chargeBottleFine !== false
                                    ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                              >
                                {line.chargeBottleFine !== false ? 'Fine Applied ✓' : 'Waived'}
                              </button>
                            </div>
                          ) : (
                            <div className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                              <span>🍾</span>
                              <span>Intact Glass Bottle (No fee)</span>
                            </div>
                          )}

                          {lorryStockItem && (
                            <button
                              type="button"
                              onClick={() => handleOneClickSwap(line)}
                              className={`text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer ${
                                isSwapped
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60'
                              }`}
                            >
                              <ArrowLeftRight className="w-3 h-3 text-blue-600" />
                              <span>{isSwapped ? 'Swapped with Lorry ✓' : `Swap with Lorry (${lorryStockItem.availableLorryQty})`}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: Settlement Method Switcher */}
          {returnLines.length > 0 && (
            <div className="space-y-2.5 pt-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                2. Settlement Method
              </label>

              {/* Segmented iOS-style Pill Switcher */}
              <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSettlementMethod('NEXT_BILL_CREDIT')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    settlementMethod === 'NEXT_BILL_CREDIT'
                      ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5 text-slate-600" />
                  <span>Credit to Next Bill</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettlementMethod('REPLACE_NOW')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    settlementMethod === 'REPLACE_NOW'
                      ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />
                  <span>Replace with Items</span>
                </button>
              </div>

              {/* View A: Credit to Next Bill */}
              {settlementMethod === 'NEXT_BILL_CREDIT' && (
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center">
                      <Tag className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Credit to Next Bill</span>
                      <span className="text-[11px] text-slate-500">
                        {totalBottleDamageFine > 0
                          ? `Rs. ${totalReturnValue.toLocaleString()} return minus Rs. ${totalBottleDamageFine.toLocaleString()} bottle fine`
                          : 'Applied automatically to customer’s next delivery'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Net Credit</div>
                    <div className="text-sm font-extrabold font-mono text-emerald-700">
                      {formatMoney(Math.max(0, totalReturnValue - totalBottleDamageFine))}
                    </div>
                  </div>
                </div>
              )}

              {/* View B: Replace with Items Now */}
              {settlementMethod === 'REPLACE_NOW' && (
                <div className="space-y-2.5 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-slate-600" />
                      <span>Lorry Replacement Items</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {lorryAvailableProducts.length} in lorry
                    </span>
                  </div>

                  {/* Lorry Search */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search lorry stock..."
                      value={replacementSearch}
                      onChange={e => setReplacementSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                    />
                  </div>

                  {/* Available Lorry Items List */}
                  <div className="border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 max-h-32 overflow-y-auto">
                    {filteredReplacementProducts.length === 0 ? (
                      <div className="p-2.5 text-center text-xs text-slate-400">
                        No in-stock replacement items found
                      </div>
                    ) : (
                      filteredReplacementProducts.map(prod => {
                        const inList = replacementLines.find(l => l.productId === prod.id);
                        const isMaxed = inList && inList.quantity >= prod.availableLorryQty;
                        return (
                          <div
                            key={prod.id}
                            onClick={() => {
                              if (!isMaxed) handleAddReplacement(prod);
                            }}
                            className={`p-2 px-3 flex items-center justify-between text-xs transition ${
                              isMaxed ? 'bg-slate-50 opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 cursor-pointer'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <span className="font-semibold text-slate-800 truncate block">{prod.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">Stock: {prod.availableLorryQty} {prod.unit}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono font-bold text-slate-700 text-xs">{formatMoney(prod.unitPrice)}</span>
                              <button
                                type="button"
                                disabled={isMaxed}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  isMaxed ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-slate-800'
                                }`}
                              >
                                {isMaxed ? 'Loaded' : '+ Add'}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Selected Replacement Items */}
                  {replacementLines.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Replacement Items ({replacementLines.length})
                      </span>
                      <div className="space-y-1 max-h-28 overflow-y-auto pr-0.5">
                        {replacementLines.map((rep, idx) => (
                          <div key={rep.productId} className="p-2 bg-white border border-slate-200/80 rounded-xl flex items-center justify-between gap-2 text-xs">
                            <span className="font-medium text-slate-800 truncate">{rep.name}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateReplacementQty(idx, -1)}
                                  className="w-4 h-4 flex items-center justify-center text-slate-600 font-bold"
                                >
                                  -
                                </button>
                                <span className="font-mono font-bold text-xs px-1.5">{rep.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateReplacementQty(idx, 1)}
                                  className="w-4 h-4 flex items-center justify-center text-slate-600 font-bold"
                                >
                                  +
                                </button>
                              </div>
                              <span className="font-mono font-bold text-slate-900">{formatMoney(rep.quantity * rep.unitPrice)}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveReplacementLine(idx)}
                                className="text-slate-300 hover:text-rose-500 p-0.5"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Exchange Net Settlement Summary */}
                  <div className="p-3 bg-white border border-slate-200/90 rounded-xl space-y-1 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Returned goods:</span>
                      <span className="font-mono font-semibold text-slate-700">-{formatMoney(totalReturnValue)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Replacement items:</span>
                      <span className="font-mono font-semibold text-slate-700">+{formatMoney(totalReplacementValue)}</span>
                    </div>
                    {totalBottleDamageFine > 0 && (
                      <div className="flex justify-between text-amber-900">
                        <span>🍾 Bottle damage fee ({totalDamagedBottlesCount}):</span>
                        <span className="font-mono font-bold">+{formatMoney(totalBottleDamageFine)}</span>
                      </div>
                    )}
                    <div className="pt-1.5 border-t border-slate-100 flex justify-between items-center font-bold">
                      <span className="text-slate-800">Net Balance:</span>
                      {netPayable === 0 && surplusCreditToNextBill === 0 ? (
                        <span className="text-emerald-700 font-mono text-[11px]">
                          Even Swap (Rs. 0.00)
                        </span>
                      ) : netPayable > 0 ? (
                        <span className="text-rose-600 font-mono">
                          Customer pays: {formatMoney(netPayable)}
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-mono">
                          Credit to next bill: {formatMoney(surplusCreditToNextBill)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Payment selector if customer owes difference */}
                  {netPayable > 0 && (
                    <div className="space-y-1 pt-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Payment for Difference</label>
                      <div className="grid grid-cols-3 gap-1">
                        {(['CASH', 'CREDIT', 'CHEQUE'] as const).map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setExchangePaymentMethod(m)}
                            className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                              exchangePaymentMethod === m
                                ? 'bg-slate-900 text-white shadow-2xs'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Reference Book / Paper Slip (Optional) */}
          {returnLines.length > 0 && (
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Physical Slip # (Optional)</label>
              <input
                type="text"
                placeholder="e.g. RET-0042 / EXC-012"
                value={paperBillNumber}
                onChange={e => setPaperBillNumber(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-mono font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
          )}

          {/* Submit Action Button */}
          {returnLines.length > 0 && (
            <button
              type="submit"
              disabled={loading || returnLines.length === 0}
              className={`w-full py-3 rounded-2xl text-xs font-bold text-white shadow-sm flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer ${
                loading || returnLines.length === 0
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-slate-900 hover:bg-black'
              }`}
            >
              {loading ? (
                <span>Processing...</span>
              ) : settlementMethod === 'REPLACE_NOW' ? (
                <>
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>
                    Confirm Exchange • {netPayable > 0 ? `Pay ${formatMoney(netPayable)}` : 'Complete Swap'}
                  </span>
                  <Check className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <Tag className="w-3.5 h-3.5" />
                  <span>Issue Next-Bill Credit • {formatMoney(Math.max(0, totalReturnValue - totalBottleDamageFine))}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}

        </form>

      </div>
    </div>
  );
};

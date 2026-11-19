import React, { useState, useEffect } from 'react';
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
  History
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

  if (!isOpen) return null;

  const totalReturnValue = returnLines.reduce((acc, line) => acc + (line.quantity * line.unitPrice), 0);
  const totalUnits = returnLines.reduce((acc, line) => acc + line.quantity, 0);

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
          billRef
        }
      ]);
    }
    setProductSearch('');
  };

  const handleUpdateQty = (index: number, delta: number) => {
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

  const handleRemoveLine = (index: number) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) {
      setError('Please select a customer shop.');
      return;
    }
    if (returnLines.length === 0) {
      setError('Please add at least one return product from the customer\'s completed bills.');
      return;
    }
    if (!lorry?.id) {
      setError('Active lorry is required to accept returns.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload = {
        customerId: customer.id,
        paperBillNumber: paperBillNumber.trim() || undefined,
        items: [], // Pure returns collection without sales
        returnItems: returnLines.map(line => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          returnType: line.returnType,
          reason: line.reason
        })),
        paymentMethod: 'CASH' as const,
        cashReceived: 0,
        notes: `Direct Return Collection (${user?.fullName || lorry?.driverName || 'Rep'})`
      };

      const createdOrder = await LorryService.enterDriverBill(lorry.id, payload);

      onReturnSuccess(createdOrder);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to submit return collection.');
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

        {/* Minimal Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-2xs">
              <RotateCcw className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>Direct Returns Collection</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 uppercase tracking-wider">
                  Credit Note
                </span>
              </h2>
              <p className="text-[11px] text-slate-500">Collect returns only from completed customer bills</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          
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
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search shop name, code, or phone..."
                  value={searchShop}
                  onChange={e => setSearchShop(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {filteredCustomers.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectCustomer(c)}
                    className="w-full text-left p-2.5 hover:bg-amber-50/50 flex items-center justify-between text-xs transition cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{c.name}</div>
                      <div className="text-[10px] text-slate-400">{c.code || c.phone || 'Customer'}</div>
                    </div>
                    {c.outstandingBalance > 0 && (
                      <span className="font-mono text-[11px] font-bold text-rose-600">
                        Due: {formatMoney(c.outstandingBalance)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-amber-50/50 border border-amber-200/70 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900">{customer.name}</span>
                  {customer.code && (
                    <span className="text-[10px] font-mono text-slate-400">({customer.code})</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {customer.phone || customer.deliveryAddress || 'On delivery route'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Due</div>
                <div className="text-xs font-bold font-mono text-slate-700">
                  {formatMoney(customer.outstandingBalance || 0)}
                </div>
              </div>
            </div>
          )}

          {/* Section: Select Eligible Purchased Products */}
          {customer && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span>Purchased Products (Completed Bills)</span>
                </label>
                {returnableProducts.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    {returnableProducts.length} Eligible Items
                  </span>
                )}
              </div>

              {loadingReturnables ? (
                <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-amber-600" />
                  <p className="text-xs text-slate-500">Checking completed bills for {customer.name}...</p>
                </div>
              ) : returnableProducts.length === 0 ? (
                <div className="p-5 text-center bg-amber-50/40 border border-dashed border-amber-200 rounded-2xl space-y-1.5">
                  <History className="w-6 h-6 mx-auto text-amber-500" />
                  <p className="text-xs font-bold text-amber-900">No completed bills found</p>
                  <p className="text-[11px] text-amber-700 max-w-sm mx-auto">
                    This customer has no past delivered bills. Only products previously purchased in completed bills can be returned.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Search within purchased items */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search purchased items by name or SKU..."
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* Purchased Items List */}
                  <div className="border border-slate-200 rounded-2xl bg-white divide-y divide-slate-100 max-h-48 overflow-y-auto shadow-2xs">
                    {filteredReturnables.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">No matching purchased items</div>
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
                            className={`p-2.5 flex items-center justify-between text-xs transition ${
                              isMaxed || isZeroAvailable
                                ? 'bg-slate-50/80 opacity-60 cursor-not-allowed'
                                : 'hover:bg-amber-50/60 cursor-pointer'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-bold text-slate-900 truncate">{rp.product.name}</div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                                <span>{rp.product.sku}</span>
                                <span>•</span>
                                <span className="text-emerald-700 font-medium">
                                  Billed: {rp.totalPurchasedQty} {rp.product.unit || 'pcs'}
                                </span>
                                {rp.totalReturnedQty > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="text-amber-700">Ret'd: {rp.totalReturnedQty}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right">
                                <div className="font-mono font-bold text-slate-700">
                                  {formatMoney(rp.latestUnitPrice)}
                                </div>
                                <div className="text-[9.5px] font-bold text-amber-800">
                                  Max: {rp.maxReturnableQty} {rp.product.unit || 'pcs'}
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={isMaxed || isZeroAvailable}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                                  isMaxed
                                    ? 'bg-slate-200 text-slate-500'
                                    : isZeroAvailable
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer'
                                }`}
                              >
                                {isMaxed ? 'Max In List' : isZeroAvailable ? 'Fully Returned' : '+ Return'}
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

          {/* Return Lines List */}
          {returnLines.length > 0 ? (
            <div className="space-y-2.5">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>Items Selected for Return ({returnLines.length})</span>
                <span className="text-amber-700">{totalUnits} units total</span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                {returnLines.map((line, idx) => (
                  <div key={line.productId} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                    
                    {/* Top Row: Name, SKU, Remove */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{line.name}</div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
                          <span>{line.sku}</span>
                          {line.billRef && (
                            <>
                              <span>•</span>
                              <span className="text-blue-600">Bill: {line.billRef}</span>
                            </>
                          )}
                          <span>•</span>
                          <span className="text-amber-700">Max: {line.maxReturnableQty}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Middle Row: Return Condition & Stepper */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      {/* Condition Pill */}
                      <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-lg text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => handleTypeToggle(idx, 'DAMAGE')}
                          className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                            line.returnType === 'DAMAGE'
                              ? 'bg-rose-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          💥 Damaged
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTypeToggle(idx, 'RESALE')}
                          className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                            line.returnType === 'RESALE'
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          ✨ Resale
                        </button>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2 py-0.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(idx, -1)}
                          className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-900 font-bold cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold text-xs text-slate-900 min-w-5 text-center">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(idx, 1)}
                          className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-900 font-bold cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      {/* Line Value */}
                      <div className="font-mono font-bold text-xs text-slate-900 ml-auto">
                        {formatMoney(line.quantity * line.unitPrice)}
                      </div>
                    </div>

                    {/* Quick Reason Tags */}
                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                      {['Expired', 'Leakage/Dented', 'Slow Moving', 'Excess'].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleReasonQuickTag(idx, tag)}
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md border transition cursor-pointer ${
                            line.reason === tag
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>

                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl">
              <RotateCcw className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">No return products selected</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {customer ? 'Choose items from the completed bills list above' : 'Select a customer shop to view their eligible items'}
              </p>
            </div>
          )}

          {/* Optional Slip / Reference Number */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Physical Slip / Book # (Optional)</label>
            <input
              type="text"
              placeholder="e.g. RET-0042"
              value={paperBillNumber}
              onChange={e => setPaperBillNumber(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium focus:bg-white focus:outline-none"
            />
          </div>

          {/* Credit Summary Card */}
          {returnLines.length > 0 && (
            <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-900">Total Return Credit</div>
                <div className="text-[11px] text-amber-700 mt-0.5">
                  Deducts automatically from shop's pending balance
                </div>
              </div>
              <div className="text-lg font-black font-mono text-amber-900">
                {formatMoney(totalReturnValue)}
              </div>
            </div>
          )}

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={loading || returnLines.length === 0}
            className={`w-full py-3 rounded-2xl text-xs font-bold text-white shadow-sm flex items-center justify-center gap-2 transition active:scale-[0.98] ${
              loading || returnLines.length === 0
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20 cursor-pointer'
            }`}
          >
            {loading ? (
              <span>Recording Returns...</span>
            ) : (
              <>
                <Receipt className="w-4 h-4" />
                <span>Confirm Returns • {formatMoney(totalReturnValue)}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>

        </form>

      </div>
    </div>
  );
};

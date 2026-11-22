import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Plus,
  Filter,
  Boxes,
  Truck,
  Calendar,
  X,
  FileSpreadsheet,
  PackageCheck,
  ChevronDown,
  User,
  ShoppingBag,
  ArrowRight
} from 'lucide-react';
import { PreOrder, Customer, Product, Route, Lorry } from '../types';
import { PreOrderService, CustomerService, ProductService, RouteService, LorryService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

export const PreOrders: React.FC = () => {
  const { formatMoney } = useCurrency();

  const [preOrders, setPreOrders] = useState<PreOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [lorries, setLorries] = useState<Lorry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'FULFILLED' | 'CANCELLED'>('PENDING');
  const [routeFilter, setRouteFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [selectedPreOrder, setSelectedPreOrder] = useState<PreOrder | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State for New Pre-Order
  const [formCustomerId, setFormCustomerId] = useState<string>('');
  const [formLorryId, setFormLorryId] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formRows, setFormRows] = useState<Array<{ productId: string; quantity: number; unitPrice: number }>>([
    { productId: '', quantity: 1, unitPrice: 0 }
  ]);
  const [submittingForm, setSubmittingForm] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pos, custs, prods, rts, lrs] = await Promise.all([
        PreOrderService.getAll(),
        CustomerService.getAll(),
        ProductService.getAll(),
        RouteService.getAll(),
        LorryService.getAll()
      ]);
      setPreOrders(pos);
      setCustomers(custs);
      setProducts(prods.filter(p => !p.isRawMaterial));
      setRoutes(rts);
      setLorries(lrs);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to load pre-orders' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const pendingOrders = preOrders.filter(p => p.status === 'PENDING');
    const totalPendingUnits = pendingOrders.reduce((sum, p) => sum + (p.totalItemsCount || 0), 0);
    const totalPendingValue = pendingOrders.reduce((sum, p) => sum + (p.totalEstimatedValue || 0), 0);
    const readyToFulfill = pendingOrders.filter(p => p.hasAvailableStock).length;

    return {
      pendingCount: pendingOrders.length,
      totalPendingUnits,
      totalPendingValue,
      readyToFulfill,
      fulfilledCount: preOrders.filter(p => p.status === 'FULFILLED').length
    };
  }, [preOrders]);

  // Filtered List
  const filteredPreOrders = useMemo(() => {
    return preOrders.filter(po => {
      if (statusFilter !== 'ALL' && po.status !== statusFilter) return false;
      if (routeFilter !== 'ALL' && po.customer?.routeId !== routeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNum = po.preOrderNumber.toLowerCase().includes(q);
        const matchesCust = (po.customer?.name || '').toLowerCase().includes(q) || (po.customer?.code || '').toLowerCase().includes(q);
        const matchesItems = po.items.some(i => i.product.name.toLowerCase().includes(q) || i.product.sku.toLowerCase().includes(q));
        if (!matchesNum && !matchesCust && !matchesItems) return false;
      }

      return true;
    });
  }, [preOrders, statusFilter, routeFilter, searchQuery]);

  const handleFulfill = async (id: string) => {
    if (!window.confirm('Mark this pre-order as fulfilled?')) return;
    try {
      await PreOrderService.fulfill(id);
      showToast('success', 'Pre-order marked as fulfilled.');
      loadData();
    } catch (err: any) {
      showToast('error', err.response?.data?.error || err.message || 'Error fulfilling pre-order');
    }
  };

  const handleCancel = async (id: string) => {
    const reason = window.prompt('Enter cancellation reason (optional):');
    if (reason === null) return;
    try {
      await PreOrderService.cancel(id, reason);
      showToast('success', 'Pre-order cancelled.');
      loadData();
    } catch (err: any) {
      showToast('error', err.response?.data?.error || err.message || 'Error cancelling pre-order');
    }
  };

  // Create Form Helpers
  const handleAddFormRow = () => {
    setFormRows(prev => [...prev, { productId: '', quantity: 1, unitPrice: 0 }]);
  };

  const handleRemoveFormRow = (index: number) => {
    if (formRows.length === 1) return;
    setFormRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleFormRowChange = (index: number, field: string, val: any) => {
    setFormRows(prev => {
      const updated = [...prev];
      if (field === 'productId') {
        const prod = products.find(p => p.id === val);
        updated[index] = {
          ...updated[index],
          productId: val,
          unitPrice: prod?.unitPrice || 0
        };
      } else {
        updated[index] = { ...updated[index], [field]: val };
      }
      return updated;
    });
  };

  const handleCreatePreOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerId) {
      showToast('error', 'Please select a customer');
      return;
    }
    const validRows = formRows.filter(r => r.productId && r.quantity > 0);
    if (validRows.length === 0) {
      showToast('error', 'Please add at least one product with quantity > 0');
      return;
    }

    try {
      setSubmittingForm(true);
      await PreOrderService.create({
        customerId: formCustomerId,
        lorryId: formLorryId || undefined,
        source: 'OFFICE',
        notes: formNotes.trim() || undefined,
        items: validRows.map(r => ({
          productId: r.productId,
          quantity: r.quantity,
          unitPrice: r.unitPrice
        }))
      });

      showToast('success', 'Pre-order created successfully.');
      setShowCreateModal(false);
      setFormCustomerId('');
      setFormLorryId('');
      setFormNotes('');
      setFormRows([{ productId: '', quantity: 1, unitPrice: 0 }]);
      loadData();
    } catch (err: any) {
      showToast('error', err.response?.data?.error || err.message || 'Failed to create pre-order');
    } finally {
      setSubmittingForm(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 p-4 rounded-2xl shadow-xl border flex items-center gap-3 text-xs sm:text-sm font-semibold transition-all animate-fadeIn ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">
            <Clock className="w-4 h-4" />
            <span>Demand & Booking Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Pre-Orders & Advance Bookings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Track customer orders for items currently out of stock. Fulfill seamlessly when stock arrives.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-bold rounded-2xl shadow-sm transition-all cursor-pointer self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          <span>New Pre-Order</span>
        </button>
      </div>

      {/* KPI Stats Cards (Ultra Clean) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-white rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Pending Bookings
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-indigo-600">
              {stats.pendingCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">orders</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Units Backlogged
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {stats.totalPendingUnits}
            </span>
            <span className="text-xs text-slate-500 font-medium">units</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Ready to Fulfill
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-600">
              {stats.readyToFulfill}
            </span>
            <span className="text-xs text-emerald-700/80 font-medium font-mono">in warehouse</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Est. Booking Value
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-slate-900 truncate">
              {formatMoney(stats.totalPendingValue)}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Segmented Status Tabs */}
        <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200/70 shrink-0 overflow-x-auto">
          {(['PENDING', 'FULFILLED', 'CANCELLED', 'ALL'] as const).map(tab => {
            const isActive = statusFilter === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/70'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'PENDING' ? `Pending (${stats.pendingCount})` : tab}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-md">
          {/* Route filter */}
          <select
            value={routeFilter}
            onChange={e => setRouteFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs font-semibold rounded-2xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
          >
            <option value="ALL">All Routes</option>
            {routes.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>

          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search pre-order #, customer, item..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pre-Orders Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 font-medium">
            Loading pre-orders and inventory availability...
          </div>
        ) : filteredPreOrders.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Clock className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No pre-orders found</p>
            <p className="text-xs text-slate-400">
              {statusFilter === 'PENDING'
                ? 'All customer pre-orders are currently fulfilled.'
                : 'No orders match the selected filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Pre-Order #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer & Route</th>
                  <th className="py-3 px-4">Ordered Items</th>
                  <th className="py-3 px-4">Warehouse Stock Status</th>
                  <th className="py-3 px-4">Est. Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredPreOrders.map(po => {
                  const isPending = po.status === 'PENDING';
                  const isFulfilled = po.status === 'FULFILLED';
                  const isCancelled = po.status === 'CANCELLED';

                  return (
                    <tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* PreOrder # */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-slate-900 block">
                          {po.preOrderNumber}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          {po.source === 'REP' ? (
                            <>
                              <Truck className="w-3 h-3 text-blue-500" />
                              <span>via Rep ({po.lorry?.vehicleNumber || 'Lorry'})</span>
                            </>
                          ) : (
                            <>
                              <FileSpreadsheet className="w-3 h-3 text-slate-500" />
                              <span>Office Entry</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(po.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block truncate max-w-[180px]">
                          {po.customer?.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {po.customer?.code} • {po.customer?.route?.name || 'Unassigned'}
                        </span>
                      </td>

                      {/* Ordered Items */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1 max-w-[220px]">
                          {po.items.map(i => (
                            <div key={i.id} className="flex items-center justify-between text-[11px] gap-2">
                              <span className="truncate text-slate-800">{i.product?.name}</span>
                              <span className="font-mono font-bold text-slate-900 shrink-0">
                                × {i.quantity}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Warehouse Stock Availability */}
                      <td className="py-3.5 px-4">
                        {isPending ? (
                          po.hasAvailableStock ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Ready to Fulfill</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Awaiting Warehouse Stock</span>
                            </span>
                          )
                        ) : isFulfilled ? (
                          <span className="text-[11px] text-slate-500 font-mono">
                            Delivered on bill
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">Cancelled</span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {formatMoney(po.totalEstimatedValue || 0)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block ${
                            isPending
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/70'
                              : isFulfilled
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {po.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleFulfill(po.id)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-lg border border-emerald-200 transition-all cursor-pointer"
                              title="Mark this pre-order as fulfilled"
                            >
                              Fulfill
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancel(po.id)}
                              className="px-2 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                              title="Cancel pre-order"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create Pre-Order */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-scaleUp">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>Take New Pre-Order</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Book out-of-stock items for future fulfillment.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePreOrder} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Customer Selector */}
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Customer <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formCustomerId}
                  onChange={e => setFormCustomerId(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code || c.city})
                    </option>
                  ))}
                </select>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-600">
                    Pre-Ordered Products <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddFormRow}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Product
                  </button>
                </div>

                <div className="space-y-2">
                  {formRows.map((row, index) => {
                    const selProd = products.find(p => p.id === row.productId);
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-2xl border border-slate-200/70"
                      >
                        <div className="flex-1 min-w-0">
                          <select
                            value={row.productId}
                            onChange={e => handleFormRowChange(index, 'productId', e.target.value)}
                            required
                            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">-- Select Product --</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} (Stock: {p.currentStock})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="w-20 shrink-0">
                          <input
                            type="number"
                            min="1"
                            value={row.quantity}
                            onChange={e => handleFormRowChange(index, 'quantity', parseInt(e.target.value, 10) || 1)}
                            placeholder="Qty"
                            className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-bold text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveFormRow(index)}
                          disabled={formRows.length === 1}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded-lg disabled:opacity-30"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Booking Remarks / Target Date
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="e.g. Needs 5 cases once fresh production arrives on Thursday"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingForm}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {submittingForm ? 'Saving...' : 'Confirm Pre-Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeftRight,
  Truck,
  Plus,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  FileText,
  Boxes
} from 'lucide-react';
import { Lorry, Product, LorryStockTransfer } from '../types';
import { LorryService, LorryTransferService, ProductService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

interface TransferItemRow {
  productId: string;
  quantity: number;
  freeQuantity?: number;
}

interface LorryStockExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultFromLorryId?: string;
  defaultToLorryId?: string;
  onSuccess?: () => void;
}

export const LorryStockExchangeModal: React.FC<LorryStockExchangeModalProps> = ({
  isOpen,
  onClose,
  defaultFromLorryId,
  defaultToLorryId,
  onSuccess
}) => {
  const { formatMoney } = useCurrency();

  // Mode: TRANSFER (A -> B), SWAP (A <-> B), or HISTORY
  const [activeTab, setActiveTab] = useState<'TRANSFER' | 'SWAP' | 'HISTORY'>('TRANSFER');

  const [lorries, setLorries] = useState<Lorry[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Selected Lorries
  const [fromLorryId, setFromLorryId] = useState<string>(defaultFromLorryId || '');
  const [toLorryId, setToLorryId] = useState<string>(defaultToLorryId || '');

  // Forward Items (From A -> To B)
  const [forwardItems, setForwardItems] = useState<TransferItemRow[]>([
    { productId: '', quantity: 0, freeQuantity: 0 }
  ]);

  // Reverse Items for Mutual Exchange (From B -> To A)
  const [reverseItems, setReverseItems] = useState<TransferItemRow[]>([
    { productId: '', quantity: 0, freeQuantity: 0 }
  ]);

  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    transferNumber: string;
    message: string;
  } | null>(null);

  // Past Transfer History
  const [transferHistory, setTransferHistory] = useState<LorryStockTransfer[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Load Lorries and Products
  useEffect(() => {
    if (!isOpen) return;
    loadData();
  }, [isOpen]);

  const loadData = async () => {
    try {
      setLoadingInitial(true);
      const [lorryList, productList] = await Promise.all([
        LorryService.getAll(),
        ProductService.getAll()
      ]);
      setLorries(lorryList);
      setProducts(productList.filter(p => !p.isRawMaterial));

      if (lorryList.length >= 2) {
        if (!fromLorryId && defaultFromLorryId) {
          setFromLorryId(defaultFromLorryId);
        } else if (!fromLorryId) {
          setFromLorryId(lorryList[0].id);
        }

        if (!toLorryId && defaultToLorryId && defaultToLorryId !== defaultFromLorryId) {
          setToLorryId(defaultToLorryId);
        } else if (!toLorryId) {
          const alternate = lorryList.find(l => l.id !== (defaultFromLorryId || lorryList[0].id));
          if (alternate) setToLorryId(alternate.id);
        }
      }
    } catch {
      setErrorMessage('Failed to load lorry fleet data.');
    } finally {
      setLoadingInitial(false);
    }
  };

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const data = await LorryTransferService.getTransfers({ limit: 30 });
      setTransferHistory(data);
    } catch {
      console.warn('Failed to load transfer history');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      loadHistory();
    }
  }, [activeTab]);

  const fromLorry = useMemo(() => lorries.find(l => l.id === fromLorryId), [lorries, fromLorryId]);
  const toLorry = useMemo(() => lorries.find(l => l.id === toLorryId), [lorries, toLorryId]);

  // Stock maps for live available counts
  const fromStockMap = useMemo(() => {
    const map = new Map<string, { stock: number; freeStock: number }>();
    if (fromLorry?.lorryStocks) {
      fromLorry.lorryStocks.forEach(s => map.set(s.productId, { stock: s.quantity, freeStock: s.freeQuantity || 0 }));
    }
    return map;
  }, [fromLorry]);

  const toStockMap = useMemo(() => {
    const map = new Map<string, { stock: number; freeStock: number }>();
    if (toLorry?.lorryStocks) {
      toLorry.lorryStocks.forEach(s => map.set(s.productId, { stock: s.quantity, freeStock: s.freeQuantity || 0 }));
    }
    return map;
  }, [toLorry]);

  // Products available on From Lorry
  const fromLorryProducts = useMemo(() => {
    return products.filter(p => {
      const s = fromStockMap.get(p.id);
      return s !== undefined && s.stock > 0;
    });
  }, [products, fromStockMap]);

  // Products available on To Lorry
  const toLorryProducts = useMemo(() => {
    return products.filter(p => {
      const s = toStockMap.get(p.id);
      return s !== undefined && s.stock > 0;
    });
  }, [products, toStockMap]);

  // Handlers for Forward Items
  const addForwardItem = () => {
    setForwardItems(prev => [...prev, { productId: '', quantity: 0, freeQuantity: 0 }]);
  };

  const updateForwardItem = (index: number, field: keyof TransferItemRow, value: any) => {
    setForwardItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeForwardItem = (index: number) => {
    setForwardItems(prev => {
      if (prev.length === 1) return [{ productId: '', quantity: 0, freeQuantity: 0 }];
      return prev.filter((_, i) => i !== index);
    });
  };

  // Handlers for Reverse Items (Swap)
  const addReverseItem = () => {
    setReverseItems(prev => [...prev, { productId: '', quantity: 0, freeQuantity: 0 }]);
  };

  const updateReverseItem = (index: number, field: keyof TransferItemRow, value: any) => {
    setReverseItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeReverseItem = (index: number) => {
    setReverseItems(prev => {
      if (prev.length === 1) return [{ productId: '', quantity: 0, freeQuantity: 0 }];
      return prev.filter((_, i) => i !== index);
    });
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fromLorryId || !toLorryId) {
      setErrorMessage('Please select both the Source and Destination lorries.');
      return;
    }

    if (fromLorryId === toLorryId) {
      setErrorMessage('Source and Destination lorries must be different.');
      return;
    }

    const validForward = forwardItems.filter(i => i.productId && ((i.quantity || 0) > 0 || (i.freeQuantity || 0) > 0));
    const validReverse = activeTab === 'SWAP'
      ? reverseItems.filter(i => i.productId && ((i.quantity || 0) > 0 || (i.freeQuantity || 0) > 0))
      : [];

    if (validForward.length === 0 && validReverse.length === 0) {
      setErrorMessage('Please add at least one item with a quantity to transfer.');
      return;
    }

    // Validate quantities against stock
    for (const item of validForward) {
      const avail = fromStockMap.get(item.productId)?.stock || 0;
      if (item.quantity > avail) {
        const prod = products.find(p => p.id === item.productId);
        setErrorMessage(`Lorry ${fromLorry?.vehicleNumber} only has ${avail} units of "${prod?.name || 'Item'}" available.`);
        return;
      }
    }

    if (activeTab === 'SWAP') {
      for (const item of validReverse) {
        const avail = toStockMap.get(item.productId)?.stock || 0;
        if (item.quantity > avail) {
          const prod = products.find(p => p.id === item.productId);
          setErrorMessage(`Lorry ${toLorry?.vehicleNumber} only has ${avail} units of "${prod?.name || 'Item'}" available.`);
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      const res = await LorryTransferService.transferStock({
        fromLorryId,
        toLorryId,
        items: validForward,
        exchangeItems: validReverse,
        notes: notes.trim() || undefined
      });

      setSuccessResult({
        transferNumber: res.transferNumber,
        message: activeTab === 'SWAP'
          ? `Mutual stock exchange completed between ${fromLorry?.vehicleNumber} and ${toLorry?.vehicleNumber}!`
          : `Items transferred successfully from ${fromLorry?.vehicleNumber} to ${toLorry?.vehicleNumber}!`
      });

      // Reload fresh stock
      await loadData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Stock exchange failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintSlip = (transferNumber: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Stock Transfer Slip - ${transferNumber}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 18px; font-size: 12px; }
            h2 { margin: 0 0 4px 0; font-size: 16px; }
            p { margin: 3px 0; color: #475569; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; }
            th, td { border-bottom: 1px solid #cbd5e1; padding: 6px 4px; text-align: left; }
            th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; }
            .num { text-align: right; font-family: monospace; }
          </style>
        </head>
        <body>
          <h2>M&S Enterprises - Lorry Stock Transfer Slip</h2>
          <p>Slip Number: <strong>${transferNumber}</strong></p>
          <p>Date: ${new Date().toLocaleString('en-GB')}</p>
          <p>Source Lorry: <strong>${fromLorry?.vehicleNumber}</strong> (${fromLorry?.driverName})</p>
          <p>Destination Lorry: <strong>${toLorry?.vehicleNumber}</strong> (${toLorry?.driverName})</p>
          ${notes ? `<p>Notes: ${notes}</p>` : ''}
          <table>
            <thead>
              <tr><th>#</th><th>Direction</th><th>Item Name</th><th class="num">Paid Qty</th><th class="num">Free Qty</th></tr>
            </thead>
            <tbody>
              ${forwardItems.filter(i => i.productId && i.quantity > 0).map((i, idx) => {
                const prod = products.find(p => p.id === i.productId);
                return `<tr><td>${idx + 1}</td><td>${fromLorry?.vehicleNumber} ➔ ${toLorry?.vehicleNumber}</td><td>${prod?.name || 'Item'}</td><td class="num">${i.quantity}</td><td class="num">${i.freeQuantity || 0}</td></tr>`;
              }).join('')}
              ${activeTab === 'SWAP' ? reverseItems.filter(i => i.productId && i.quantity > 0).map((i, idx) => {
                const prod = products.find(p => p.id === i.productId);
                return `<tr><td>${idx + 1}</td><td>${toLorry?.vehicleNumber} ➔ ${fromLorry?.vehicleNumber}</td><td>${prod?.name || 'Item'}</td><td class="num">${i.quantity}</td><td class="num">${i.freeQuantity || 0}</td></tr>`;
              }).join('') : ''}
            </tbody>
          </table>
          <br/><br/>
          <p style="margin-top:30px">Driver Signature (${fromLorry?.driverName}): ____________________</p>
          <p style="margin-top:20px">Receiver Signature (${toLorry?.driverName}): ____________________</p>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleResetForNew = () => {
    setSuccessResult(null);
    setErrorMessage(null);
    setForwardItems([{ productId: '', quantity: 0, freeQuantity: 0 }]);
    setReverseItems([{ productId: '', quantity: 0, freeQuantity: 0 }]);
    setNotes('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[94vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Lorry Stock Exchange & Transfer
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Move or swap floating inventory directly between two delivery lorries
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-bold transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector: Send, Swap, or History */}
        {!successResult && (
          <div className="px-5 pt-3 pb-2 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('TRANSFER')}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'TRANSFER'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Send Stock (One-Way)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('SWAP')}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'SWAP'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Mutual Exchange (Swap)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('HISTORY')}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ml-auto ${
                activeTab === 'HISTORY'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Past Transfers</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs font-bold text-rose-700">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button type="button" onClick={() => setErrorMessage(null)} className="text-rose-500 font-bold ml-2">
                ✕
              </button>
            </div>
          )}

          {/* Success Screen */}
          {successResult ? (
            <div className="p-6 text-center space-y-4 bg-emerald-50/50 border border-emerald-200 rounded-3xl">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-200/80 text-emerald-800">
                  {successResult.transferNumber}
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-2">
                  Exchange Successfully Recorded!
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                  {successResult.message} Both lorries' floating inventories and settlement ledgers have been updated live.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => handlePrintSlip(successResult.transferNumber)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-slate-700" />
                  <span>Print Transfer Slip</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetForNew}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  New Transfer / Exchange
                </button>
              </div>
            </div>
          ) : activeTab === 'HISTORY' ? (
            /* ======================================================== */
            /* TAB: PAST TRANSFERS HISTORY */
            /* ======================================================== */
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Recent Lorry Stock Transfers
                </h3>
                <button
                  type="button"
                  onClick={loadHistory}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800"
                >
                  Refresh
                </button>
              </div>

              {loadingHistory ? (
                <div className="p-8 text-center text-xs text-slate-400 font-medium">Loading transfer records...</div>
              ) : transferHistory.length === 0 ? (
                <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center space-y-1">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No transfer history found</p>
                  <p className="text-[11px] text-slate-400">Transfers between lorries will appear here for audit.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transferHistory.map(tr => (
                    <div
                      key={tr.id}
                      className="p-3 bg-white border border-slate-200/90 rounded-2xl space-y-2 shadow-2xs hover:border-slate-300 transition"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                            {tr.transferNumber}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500 font-medium">
                            {new Date(tr.transferredAt).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>

                        <span className="text-[11px] font-bold text-slate-700">
                          {tr.items.length} Items Moved
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3 text-xs pt-1 border-t border-slate-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-slate-800">{tr.fromLorry?.vehicleNumber || 'From Lorry'}</span>
                          <span className="text-blue-600 font-extrabold">➔</span>
                          <span className="font-bold text-slate-800">{tr.toLorry?.vehicleNumber || 'To Lorry'}</span>
                        </div>

                        {tr.notes && (
                          <span className="text-[11px] text-slate-500 italic truncate max-w-xs">
                            "{tr.notes}"
                          </span>
                        )}
                      </div>

                      {/* Items details */}
                      <div className="bg-slate-50 p-2 rounded-xl text-[11px] space-y-1">
                        {tr.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-slate-700">
                            <span>
                              {item.direction === 'REVERSE' ? '⇄ [Swap] ' : '➔ '}
                              <strong>{item.product?.name || 'Item'}</strong>
                            </span>
                            <span className="font-mono font-bold">
                              {item.quantity} Units {item.freeQuantity > 0 ? `(+${item.freeQuantity} Free)` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ======================================================== */
            /* TAB: SEND OR SWAP FORM */
            /* ======================================================== */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Lorry Selection Visual Pair */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
                {/* Source Lorry Card */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-600">
                      1. From Lorry (Giving Stock)
                    </span>
                    <Truck className="w-4 h-4 text-blue-600" />
                  </div>

                  <select
                    value={fromLorryId}
                    onChange={e => setFromLorryId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer"
                  >
                    <option value="">-- Choose Giving Lorry --</option>
                    {lorries.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.vehicleNumber} ({l.driverName}) - {l.route?.name || 'Route'}
                      </option>
                    ))}
                  </select>

                  {fromLorry && (
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                      <span>Loaded: <strong>{fromLorryProducts.length} Products</strong></span>
                      <span>Driver: <strong>{fromLorry.driverName}</strong></span>
                    </div>
                  )}
                </div>

                {/* Destination Lorry Card */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-600">
                      2. To Lorry (Receiving Stock)
                    </span>
                    <Truck className="w-4 h-4 text-emerald-600" />
                  </div>

                  <select
                    value={toLorryId}
                    onChange={e => setToLorryId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer"
                  >
                    <option value="">-- Choose Receiving Lorry --</option>
                    {lorries.map(l => (
                      <option key={l.id} value={l.id} disabled={l.id === fromLorryId}>
                        {l.vehicleNumber} ({l.driverName}) {l.id === fromLorryId ? '(Source)' : ''}
                      </option>
                    ))}
                  </select>

                  {toLorry && (
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                      <span>Loaded: <strong>{toLorryProducts.length} Products</strong></span>
                      <span>Driver: <strong>{toLorry.driverName}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              {/* 1. Forward Transfer Items Section (From A -> To B) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                      ➔
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      Items from {fromLorry?.vehicleNumber || 'Source Lorry'} to {toLorry?.vehicleNumber || 'Destination'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={addForwardItem}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {forwardItems.map((row, idx) => {
                    const avail = row.productId ? (fromStockMap.get(row.productId)?.stock || 0) : 0;
                    const availFree = row.productId ? (fromStockMap.get(row.productId)?.freeStock || 0) : 0;

                    return (
                      <div
                        key={idx}
                        className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                      >
                        {/* Product Picker */}
                        <div className="flex-1 min-w-0">
                          <select
                            value={row.productId}
                            onChange={e => updateForwardItem(idx, 'productId', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          >
                            <option value="">-- Choose Product on Lorry --</option>
                            {fromLorryProducts.map(p => {
                              const s = fromStockMap.get(p.id)?.stock || 0;
                              return (
                                <option key={p.id} value={p.id}>
                                  {p.name} (Available: {s} {p.unit}) - {formatMoney(p.unitPrice)}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* Quantity Inputs */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Paid:</span>
                            <input
                              type="number"
                              min="0"
                              max={avail}
                              value={row.quantity || ''}
                              onChange={e => updateForwardItem(idx, 'quantity', parseInt(e.target.value, 10) || 0)}
                              placeholder="0"
                              className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {avail > 0 && (
                              <span className="text-[10px] text-slate-400 font-mono">/ {avail}</span>
                            )}
                          </div>

                          {availFree > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-blue-600 uppercase">Free:</span>
                              <input
                                type="number"
                                min="0"
                                max={availFree}
                                value={row.freeQuantity || ''}
                                onChange={e => updateForwardItem(idx, 'freeQuantity', parseInt(e.target.value, 10) || 0)}
                                placeholder="0"
                                className="w-14 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-blue-700 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => removeForwardItem(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            title="Remove row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Reverse Items Section (Only in Mutual Exchange / Swap Mode) */}
              {activeTab === 'SWAP' && (
                <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center">
                        ⇄
                      </span>
                      <span className="text-xs font-bold text-amber-900">
                        Exchange Items: {toLorry?.vehicleNumber || 'Destination Lorry'} gives back to {fromLorry?.vehicleNumber || 'Source'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={addReverseItem}
                      className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Return Item</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {reverseItems.map((row, idx) => {
                      const avail = row.productId ? (toStockMap.get(row.productId)?.stock || 0) : 0;
                      const availFree = row.productId ? (toStockMap.get(row.productId)?.freeStock || 0) : 0;

                      return (
                        <div
                          key={idx}
                          className="p-2.5 bg-white border border-amber-200/80 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                        >
                          {/* Product Picker on To Lorry */}
                          <div className="flex-1 min-w-0">
                            <select
                              value={row.productId}
                              onChange={e => updateReverseItem(idx, 'productId', e.target.value)}
                              className="w-full bg-amber-50/30 border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                            >
                              <option value="">-- Choose Product to give in exchange --</option>
                              {toLorryProducts.map(p => {
                                const s = toStockMap.get(p.id)?.stock || 0;
                                return (
                                  <option key={p.id} value={p.id}>
                                    {p.name} (Available: {s} {p.unit}) - {formatMoney(p.unitPrice)}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {/* Quantity Inputs */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Paid:</span>
                              <input
                                type="number"
                                min="0"
                                max={avail}
                                value={row.quantity || ''}
                                onChange={e => updateReverseItem(idx, 'quantity', parseInt(e.target.value, 10) || 0)}
                                placeholder="0"
                                className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                              />
                              {avail > 0 && (
                                <span className="text-[10px] text-slate-400 font-mono">/ {avail}</span>
                              )}
                            </div>

                            {availFree > 0 && (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-bold text-blue-600 uppercase">Free:</span>
                                <input
                                  type="number"
                                  min="0"
                                  max={availFree}
                                  value={row.freeQuantity || ''}
                                  onChange={e => updateReverseItem(idx, 'freeQuantity', parseInt(e.target.value, 10) || 0)}
                                  placeholder="0"
                                  className="w-14 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-blue-700 text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => removeReverseItem(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                              title="Remove row"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Transfer Notes */}
              <div>
                <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Exchange Notes / Location (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Swapped at Kadugannawa junction to replenish bread stocks"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>
                    {submitting
                      ? 'Processing Transfer...'
                      : activeTab === 'SWAP'
                      ? 'Confirm Mutual Stock Exchange'
                      : 'Confirm Stock Transfer'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};


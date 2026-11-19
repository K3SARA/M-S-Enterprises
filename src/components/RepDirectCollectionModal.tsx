import React, { useState, useEffect } from 'react';
import {
  X,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Search,
  Building2,
  Calendar,
  CreditCard,
  ChevronDown,
  ArrowRight
} from 'lucide-react';
import { Customer, CustomerPayment, Lorry, Order, User } from '../types';
import { CustomerService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

interface RepDirectCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  customers: Customer[];
  onSelectCustomer: (c: Customer) => void;
  lorry: Lorry | null;
  user?: User;
  onPaymentSuccess: (payment: CustomerPayment) => void;
}

export const RepDirectCollectionModal: React.FC<RepDirectCollectionModalProps> = ({
  isOpen,
  onClose,
  customer,
  customers,
  onSelectCustomer,
  lorry,
  user,
  onPaymentSuccess
}) => {
  const { formatMoney } = useCurrency();

  const [searchShop, setSearchShop] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CHEQUE' | 'BANK_TRANSFER'>('CASH');
  const [chequeNumber, setChequeNumber] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [chequeDate, setChequeDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [unpaidBills, setUnpaidBills] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setPaymentMethod('CASH');
      setChequeNumber('');
      setBankName('');
      setChequeDate(new Date().toISOString().split('T')[0]);
      setNotes('');

      if (customer) {
        if (customer.outstandingBalance > 0) {
          setAmount(customer.outstandingBalance.toString());
        } else {
          setAmount('');
        }
        CustomerService.getUnpaidBills(customer.id)
          .then(setUnpaidBills)
          .catch(() => setUnpaidBills([]));
      } else {
        setAmount('');
        setUnpaidBills([]);
      }
    }
  }, [isOpen, customer]);

  if (!isOpen) return null;

  const outstanding = customer?.outstandingBalance || 0;
  const numAmount = parseFloat(amount) || 0;
  const remaining = Math.max(0, outstanding - numAmount);

  const handleQuickAmount = (val: number) => {
    setAmount(val > 0 ? val.toString() : '');
  };

  const filteredCustomers = customers.filter(c => {
    if (!searchShop.trim()) return true;
    const q = searchShop.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.city && c.city.toLowerCase().includes(q))
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) {
      setError('Please select a customer first.');
      return;
    }
    if (numAmount <= 0) {
      setError('Please enter a valid positive payment amount.');
      return;
    }
    if (paymentMethod === 'CHEQUE' && !chequeNumber.trim()) {
      setError('Cheque Number is required for cheque payments.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const collector = user?.fullName || lorry?.driverName || 'Route Sales Rep';

      const res = await CustomerService.recordPayment(customer.id, {
        amount: numAmount,
        paymentMethod,
        chequeNumber: chequeNumber.trim() || undefined,
        bankName: bankName.trim() || undefined,
        chequeDate: chequeDate || undefined,
        notes: notes.trim() || undefined,
        collectedBy: collector,
        lorryId: lorry?.id || undefined
      });

      onPaymentSuccess(res.payment);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to record collection payment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* iOS Pull Handle on Mobile */}
        <div className="pt-2.5 pb-1 flex justify-center sm:hidden">
          <div className="w-12 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Minimal Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs">
              <Wallet className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>Direct Outstanding Collection</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                  Mobile
                </span>
              </h2>
              <p className="text-[11px] text-slate-500">Collect payment against shop credit balance</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-semibold animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
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
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {filteredCustomers.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400 font-medium">No shops found</div>
                ) : (
                  filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelectCustomer(c)}
                      className="w-full text-left p-2.5 hover:bg-emerald-50/50 flex items-center justify-between text-xs transition"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{c.name}</div>
                        <div className="text-[10px] text-slate-400">{c.code || c.phone || 'Angoda'}</div>
                      </div>
                      <div className="text-right">
                        {c.outstandingBalance > 0 ? (
                          <span className="font-mono font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded text-[11px]">
                            {formatMoney(c.outstandingBalance)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-bold">Clear</span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50/60 border border-emerald-100 flex items-center justify-between">
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
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Due Balance</div>
                <div className="text-sm font-black font-mono text-rose-600">
                  {formatMoney(outstanding)}
                </div>
              </div>
            </div>
          )}

          {/* Payment Method Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  paymentMethod === 'CASH'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>💵 Cash</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('CHEQUE')}
                className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  paymentMethod === 'CHEQUE'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>📑 Cheque</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('BANK_TRANSFER')}
                className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  paymentMethod === 'BANK_TRANSFER'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>🏦 Transfer</span>
              </button>
            </div>
          </div>

          {/* Amount Input & Quick Chips */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Collected Amount
              </label>
              {outstanding > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickAmount(outstanding)}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition"
                  >
                    Full Due
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAmount(Math.round(outstanding / 2))}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  >
                    50%
                  </button>
                </div>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 font-bold text-slate-400 text-sm">Rs.</span>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-lg font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            {outstanding > 0 && numAmount > 0 && (
              <div className="text-[11px] text-slate-500 flex items-center justify-between px-1">
                <span>Remaining Due:</span>
                <span className="font-mono font-bold text-slate-700">{formatMoney(remaining)}</span>
              </div>
            )}
          </div>

          {/* Cheque Specific Fields */}
          {paymentMethod === 'CHEQUE' && (
            <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-2xl space-y-2.5 animate-fadeIn">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-amber-900 uppercase">Cheque No. *</label>
                  <input
                    type="text"
                    placeholder="CHQ-00123"
                    value={chequeNumber}
                    onChange={e => setChequeNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-amber-200 rounded-lg text-xs font-mono font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-amber-900 uppercase">Bank Name</label>
                  <input
                    type="text"
                    placeholder="BOC / Commercial"
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-amber-200 rounded-lg text-xs font-medium focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-amber-900 uppercase">Cheque Realization Date</label>
                <input
                  type="date"
                  value={chequeDate}
                  onChange={e => setChequeDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-amber-200 rounded-lg text-xs font-medium focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Unpaid Bills Summary (Collapsible if present) */}
          {unpaidBills.length > 0 && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>Bills Being Settled ({unpaidBills.length})</span>
                <span className="text-emerald-700">Auto-allocated FIFO</span>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {unpaidBills.map(b => {
                  const billDue = (b.balanceAmount ?? 0) > 0 ? (b.balanceAmount ?? 0) : Math.max(0, b.netTotal - (b.paidAmount || 0));
                  return (
                    <div key={b.id} className="flex items-center justify-between text-[11px] font-mono text-slate-600">
                      <span>{b.orderNumber}</span>
                      <span className="font-bold text-slate-800">{formatMoney(billDue)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Optional Note */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Notes / Reference (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Collected on shop counter"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
            />
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={loading || numAmount <= 0}
            className={`w-full py-3 rounded-2xl text-xs font-bold text-white shadow-sm flex items-center justify-center gap-2 transition active:scale-[0.98] ${
              loading || numAmount <= 0
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
            }`}
          >
            {loading ? (
              <span>Recording Payment...</span>
            ) : (
              <>
                <Receipt className="w-4 h-4" />
                <span>Confirm Collection • {formatMoney(numAmount)}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>

        </form>

      </div>
    </div>
  );
};

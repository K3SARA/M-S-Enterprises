import React, { useState, useEffect, useMemo } from 'react';
import {
  Landmark,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  RefreshCw,
  Trash2,
  X,
  ChevronDown,
  Wallet,
  TrendingUp,
  TrendingDown,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Search,
  Calendar,
  Edit2
} from 'lucide-react';
import { BankService } from '../services/api';
import { BankAccount, BankTransaction, BankSummary, BankTransactionType, BankTransactionCategory } from '../types';
import { useCurrency } from '../context/CurrencyContext';

// ─── Helpers ────────────────────────────────────────────
const ACCOUNT_COLORS = [
  '#0C3B9B', '#059669', '#DC2626', '#D97706', '#7C3AED', '#0891B2', '#BE185D', '#374151'
];

const CATEGORIES: { value: string; label: string; forType: BankTransactionType[] }[] = [
  { value: 'CASH_DEPOSIT',      label: 'Cash Deposit',       forType: ['DEPOSIT'] },
  { value: 'CHEQUE_DEPOSIT',    label: 'Cheque Deposit',     forType: ['DEPOSIT'] },
  { value: 'CUSTOMER_PAYMENT',  label: 'Customer Payment',   forType: ['DEPOSIT'] },
  { value: 'LOAN_RECEIVED',     label: 'Loan Received',      forType: ['DEPOSIT'] },
  { value: 'SUPPLIER_PAYMENT',  label: 'Supplier Payment',   forType: ['WITHDRAWAL'] },
  { value: 'SALARY',            label: 'Staff Salary',       forType: ['WITHDRAWAL'] },
  { value: 'EXPENSE',           label: 'Business Expense',   forType: ['WITHDRAWAL'] },
  { value: 'LOAN_REPAYMENT',    label: 'Loan Repayment',     forType: ['WITHDRAWAL'] },
  { value: 'TRANSFER',          label: 'Internal Transfer',  forType: ['TRANSFER_OUT'] },
  { value: 'OTHER',             label: 'Other',              forType: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER_OUT'] },
];

const TYPE_META: Record<BankTransactionType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  DEPOSIT:      { label: 'Money In',  icon: ArrowDownLeft,  color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  WITHDRAWAL:   { label: 'Money Out', icon: ArrowUpRight,   color: 'text-rose-700',    bg: 'bg-rose-50 border-rose-200' },
  TRANSFER_OUT: { label: 'Transfer',  icon: ArrowLeftRight, color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
  TRANSFER_IN:  { label: 'Transfer',  icon: ArrowLeftRight, color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
};

const fmt = (n: number, formatMoney: (n: number) => string) => formatMoney(n);

const today = () => new Date().toISOString().split('T')[0];

// ─── Add Account Modal ───────────────────────────────────
interface AccountModalProps {
  editing: BankAccount | null;
  onClose: () => void;
  onSave: () => void;
}
const AccountModal: React.FC<AccountModalProps> = ({ editing, onClose, onSave }) => {
  const [name, setName]         = useState(editing?.name ?? '');
  const [bankName, setBankName] = useState(editing?.bankName ?? '');
  const [accNum, setAccNum]     = useState(editing?.accountNumber ?? '');
  const [accType, setAccType]   = useState(editing?.accountType ?? 'CURRENT');
  const [balance, setBalance]   = useState(editing?.balance?.toString() ?? '0');
  const [color, setColor]       = useState(editing?.color ?? ACCOUNT_COLORS[0]);
  const [notes, setNotes]       = useState(editing?.notes ?? '');
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');

  const handleSave = async () => {
    if (!name.trim() || !bankName.trim() || !accNum.trim()) { setErr('Fill all required fields.'); return; }
    setSaving(true); setErr('');
    try {
      if (editing) {
        await BankService.updateAccount(editing.id, { name, bankName, accountNumber: accNum, accountType: accType as any, color, notes });
      } else {
        await BankService.createAccount({ name, bankName, accountNumber: accNum, accountType: accType as any, balance: Number(balance), color, notes });
      }
      onSave();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-lg">{editing ? 'Edit Account' : 'New Bank Account'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Account Label *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Main Operating Account"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Bank Name *</label>
              <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. Commercial Bank"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Account Type</label>
              <select value={accType} onChange={e => setAccType(e.target.value as 'CURRENT' | 'SAVINGS' | 'CASH')}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white">
                <option value="CURRENT">Current</option>
                <option value="SAVINGS">Savings</option>
                <option value="CASH">Cash / Petty Cash</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Account Number *</label>
              <input value={accNum} onChange={e => setAccNum(e.target.value)} placeholder="123456789"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
            </div>
            {!editing && (
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Opening Balance</label>
                <input type="number" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0.00"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Card Colour</label>
            <div className="flex gap-2 flex-wrap">
              {ACCOUNT_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{ background: c }}
                  className={`w-8 h-8 rounded-xl transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Branch name, purpose, etc."
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
          </div>
        </div>

        {err && <p className="text-xs text-rose-600 font-semibold bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-2xl bg-[#0C3B9B] text-white text-sm font-bold hover:bg-[#0A3386] transition disabled:opacity-50">
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Add Transaction Modal ───────────────────────────────
interface TxnModalProps {
  accounts: BankAccount[];
  defaultAccountId?: string;
  onClose: () => void;
  onSave: () => void;
}
const TxnModal: React.FC<TxnModalProps> = ({ accounts, defaultAccountId, onClose, onSave }) => {
  const [accountId, setAccountId] = useState(defaultAccountId || accounts[0]?.id || '');
  const [type, setType]           = useState<BankTransactionType>('DEPOSIT');
  const [amount, setAmount]       = useState('');
  const [category, setCategory]   = useState<BankTransactionCategory>('CASH_DEPOSIT');
  const [description, setDesc]    = useState('');
  const [reference, setRef]       = useState('');
  const [date, setDate]           = useState(today());
  const [toAccountId, setToAcc]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');

  const availableCategories = CATEGORIES.filter(c => c.forType.includes(type));

  useEffect(() => {
    const first = availableCategories[0];
    if (first) setCategory(first.value as BankTransactionCategory);
  }, [type]);

  const handleSave = async () => {
    if (!accountId || !amount || !description.trim()) { setErr('Fill all required fields.'); return; }
    if (type === 'TRANSFER_OUT' && !toAccountId) { setErr('Select a destination account for the transfer.'); return; }
    if (type === 'TRANSFER_OUT' && toAccountId === accountId) { setErr('Source and destination cannot be the same.'); return; }
    setSaving(true); setErr('');
    try {
      await BankService.addTransaction({
        accountId, type, amount: Number(amount), category, description,
        reference: reference || undefined,
        transactedAt: date,
        transferToAccountId: type === 'TRANSFER_OUT' ? toAccountId : undefined,
      });
      onSave();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const TYPE_BUTTONS: { type: BankTransactionType; label: string; icon: React.ComponentType<{ className?: string }>; active: string }[] = [
    { type: 'DEPOSIT',      label: 'Money In',  icon: ArrowDownLeft,  active: 'bg-emerald-600 text-white' },
    { type: 'WITHDRAWAL',   label: 'Money Out', icon: ArrowUpRight,   active: 'bg-rose-600 text-white' },
    { type: 'TRANSFER_OUT', label: 'Transfer',  icon: ArrowLeftRight, active: 'bg-blue-600 text-white' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-lg">New Transaction</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500"><X className="w-5 h-5" /></button>
        </div>

        {/* Type Toggle */}
        <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-2xl">
          {TYPE_BUTTONS.map(tb => {
            const Icon = tb.icon;
            return (
              <button key={tb.type} onClick={() => setType(tb.type)}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${type === tb.type ? tb.active + ' shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                <Icon className="w-3.5 h-3.5" />{tb.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">
              {type === 'TRANSFER_OUT' ? 'From Account' : 'Account'} *
            </label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white">
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {type === 'TRANSFER_OUT' && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">To Account *</label>
              <select value={toAccountId} onChange={e => setToAcc(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white">
                <option value="">— Select Destination —</option>
                {accounts.filter(a => a.id !== accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Amount (Rs.) *</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value as BankTransactionCategory)}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white">
              {availableCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Description *</label>
            <input value={description} onChange={e => setDesc(e.target.value)} placeholder="What is this for?"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Reference # (optional)</label>
            <input value={reference} onChange={e => setRef(e.target.value)} placeholder="Cheque #, Slip #, Invoice #"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
          </div>
        </div>

        {err && <p className="text-xs text-rose-600 font-semibold bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className={`flex-1 py-2.5 rounded-2xl text-white text-sm font-bold transition disabled:opacity-50 ${
              type === 'DEPOSIT' ? 'bg-emerald-600 hover:bg-emerald-700' :
              type === 'WITHDRAWAL' ? 'bg-rose-600 hover:bg-rose-700' :
              'bg-blue-600 hover:bg-blue-700'}`}>
            {saving ? 'Saving…' : 'Record Transaction'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main BankController Page ────────────────────────────
export const BankController: React.FC = () => {
  const { formatMoney } = useCurrency();

  const [accounts, setAccounts]         = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [summary, setSummary]           = useState<BankSummary | null>(null);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  // Filters
  const [selectedAccount, setSelectedAccount] = useState<string>('ALL');
  const [typeFilter, setTypeFilter]           = useState<string>('ALL');
  const [search, setSearch]                   = useState('');
  const [fromDate, setFromDate]               = useState('');
  const [toDate, setToDate]                   = useState('');

  // Modals
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [showAddTxn, setShowAddTxn]         = useState(false);
  const [txnAccountId, setTxnAccountId]     = useState<string | undefined>();
  const [confirmDeleteTxn, setConfirmDeleteTxn] = useState<BankTransaction | null>(null);
  const [deletingTxn, setDeletingTxn]           = useState(false);
  const [toast, setToast]                       = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const loadAll = async (soft = false) => {
    try {
      if (soft) setRefreshing(true); else setLoading(true);
      const params: any = {};
      if (selectedAccount !== 'ALL') params.accountId = selectedAccount;
      if (typeFilter !== 'ALL') params.type = typeFilter;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;

      const [accs, txns, sum] = await Promise.all([
        BankService.getAccounts(),
        BankService.getTransactions(params),
        BankService.getSummary(),
      ]);
      setAccounts(accs);
      setTransactions(txns);
      setSummary(sum);
    } catch {
      showToast('Failed to load bank data.', false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadAll(); }, [selectedAccount, typeFilter, fromDate, toDate]);

  const filtered = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.toLowerCase();
    return transactions.filter(t =>
      t.description.toLowerCase().includes(q) ||
      (t.reference || '').toLowerCase().includes(q) ||
      (t.account?.name || '').toLowerCase().includes(q)
    );
  }, [transactions, search]);

  const handleDeleteTxn = async () => {
    if (!confirmDeleteTxn) return;
    setDeletingTxn(true);
    try {
      await BankService.deleteTransaction(confirmDeleteTxn.id);
      setConfirmDeleteTxn(null);
      showToast('Transaction removed.');
      loadAll(true);
    } catch {
      showToast('Could not delete transaction.', false);
    } finally {
      setDeletingTxn(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Archive this account? All its transactions remain.')) return;
    try {
      await BankService.deleteAccount(id);
      showToast('Account archived.');
      loadAll(true);
    } catch {
      showToast('Could not archive account.', false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Landmark className="w-10 h-10 text-slate-300 mx-auto animate-pulse" />
          <p className="text-sm text-slate-400 font-medium">Loading bank data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold transition-all ${toast.ok ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Landmark className="w-6 h-6 text-[#0C3B9B]" /> Bank Controller
          </h1>
          <p className="text-sm text-slate-400 font-medium mt-0.5">Track your money across all bank accounts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => loadAll(true)} disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => { setShowAddTxn(true); setTxnAccountId(undefined); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0C3B9B] text-white text-sm font-bold hover:bg-[#0A3386] transition shadow-sm shadow-blue-900/20">
            <Plus className="w-4 h-4" /> Add Transaction
          </button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Balance', value: summary.totalBalance, icon: Wallet, color: 'text-[#0C3B9B]', bg: 'bg-blue-50' },
            { label: 'Accounts', value: summary.accountCount, icon: CreditCard, color: 'text-slate-700', bg: 'bg-slate-100', isCount: true },
            { label: 'Money In (Month)', value: summary.monthIn, icon: TrendingDown, color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { label: 'Money Out (Month)', value: summary.monthOut, icon: TrendingUp, color: 'text-rose-700', bg: 'bg-rose-50' },
          ].map(card => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs">
                <div className={`w-8 h-8 rounded-xl ${card.bg} flex items-center justify-center mb-2`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{card.label}</p>
                <p className={`text-lg font-extrabold ${card.color} tracking-tight`}>
                  {(card as any).isCount ? card.value : fmt(card.value as number, formatMoney)}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Account Cards ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Accounts</h2>
          <button onClick={() => { setEditingAccount(null); setShowAddAccount(true); }}
            className="flex items-center gap-1.5 text-xs font-bold text-[#0C3B9B] hover:underline">
            <Plus className="w-3.5 h-3.5" /> New Account
          </button>
        </div>
        {accounts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
            <Landmark className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">No bank accounts yet.</p>
            <button onClick={() => setShowAddAccount(true)} className="mt-3 text-sm font-bold text-[#0C3B9B] hover:underline">Add your first account →</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.map(acc => (
              <div key={acc.id} style={{ borderTopColor: acc.color }}
                className="bg-white rounded-2xl border border-slate-100 border-t-4 p-4 shadow-xs hover:shadow-sm transition group">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm truncate">{acc.name}</p>
                    <p className="text-xs text-slate-400 font-medium">{acc.bankName} · {acc.accountType}</p>
                    <p className="text-xs text-slate-300 font-mono mt-0.5">{acc.accountNumber}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <button onClick={() => { setEditingAccount(acc); setShowAddAccount(true); }}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteAccount(acc.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xl font-extrabold text-slate-900 tracking-tight">{formatMoney(acc.balance)}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-slate-400">{acc._count?.transactions ?? 0} transactions</span>
                  <button
                    onClick={() => { setTxnAccountId(acc.id); setShowAddTxn(true); }}
                    style={{ color: acc.color, borderColor: acc.color + '33' }}
                    className="text-xs font-bold px-2.5 py-1 rounded-lg border hover:opacity-80 transition">
                    + Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Transaction Ledger ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Transaction History</h2>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-100 p-3.5 mb-3 flex flex-wrap gap-3 shadow-xs">
          {/* Account filter */}
          <div className="relative min-w-[160px]">
            <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}
              className="w-full border border-slate-200 rounded-xl pl-3 pr-7 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white appearance-none">
              <option value="ALL">All Accounts</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Type filter */}
          <div className="flex gap-1.5">
            {(['ALL', 'DEPOSIT', 'WITHDRAWAL', 'TRANSFER_OUT', 'TRANSFER_IN'] as const).map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${typeFilter === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {t === 'ALL' ? 'All' : t === 'DEPOSIT' ? '↓ In' : t === 'WITHDRAWAL' ? '↑ Out' : '⇄ Transfer'}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            <span className="text-slate-300 text-xs">–</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            {(fromDate || toDate) && (
              <button onClick={() => { setFromDate(''); setToDate(''); }} className="text-xs text-rose-500 font-semibold hover:underline">Clear</button>
            )}
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center">
            <p className="text-sm text-slate-400 font-medium">No transactions found.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            <div className="divide-y divide-slate-50">
              {filtered.map(txn => {
                const isIn = ['DEPOSIT', 'TRANSFER_IN'].includes(txn.type);
                const meta = TYPE_META[txn.type] || TYPE_META.DEPOSIT;
                const Icon = meta.icon;
                const dateStr = new Date(txn.transactedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
                return (
                  <div key={txn.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition group">
                    {/* Type Icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${meta.bg}`}>
                      <Icon className={`w-4 h-4 ${meta.color}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{txn.description}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {txn.account && (
                          <span className="text-xs text-slate-400 font-medium">{txn.account.name}</span>
                        )}
                        {txn.reference && (
                          <span className="text-xs font-mono text-slate-400">#{txn.reference}</span>
                        )}
                        <span className="text-xs text-slate-300">{dateStr}</span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-extrabold ${isIn ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isIn ? '+' : '−'}{formatMoney(txn.amount)}
                      </p>
                      <p className="text-xs text-slate-300 font-medium">bal {formatMoney(txn.balanceAfter)}</p>
                    </div>

                    {/* Delete */}
                    <button onClick={() => setConfirmDeleteTxn(txn)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition opacity-0 group-hover:opacity-100 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showAddAccount && (
        <AccountModal
          editing={editingAccount}
          onClose={() => { setShowAddAccount(false); setEditingAccount(null); }}
          onSave={() => { setShowAddAccount(false); setEditingAccount(null); showToast(editingAccount ? 'Account updated.' : 'Account added.'); loadAll(true); }}
        />
      )}

      {showAddTxn && (
        <TxnModal
          accounts={accounts}
          defaultAccountId={txnAccountId}
          onClose={() => setShowAddTxn(false)}
          onSave={() => { setShowAddTxn(false); showToast('Transaction recorded.'); loadAll(true); }}
        />
      )}

      {/* Delete Confirm */}
      {confirmDeleteTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-5 text-center">
            <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Remove Transaction?</h3>
              <p className="text-sm text-slate-500 mt-1">"{confirmDeleteTxn.description}" — {formatMoney(confirmDeleteTxn.amount)}</p>
              <p className="text-xs text-slate-400 mt-1">The account balance will be reversed automatically.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDeleteTxn(null)} className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Keep It</button>
              <button onClick={handleDeleteTxn} disabled={deletingTxn}
                className="flex-1 py-2.5 rounded-2xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition disabled:opacity-50">
                {deletingTxn ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


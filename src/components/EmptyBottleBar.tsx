import React from 'react';
import { Minus, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';

export interface EmptyBottleState {
  returnedGood: number;
  damaged: number;
  missing: number;
  chargeMissing: boolean;
}

interface EmptyBottleBarProps {
  deliveredBottles: number;
  customerBottleBalance: number;
  depositRate?: number;
  value: EmptyBottleState;
  onChange: (next: EmptyBottleState) => void;
  compact?: boolean;
}

export const EmptyBottleBar: React.FC<EmptyBottleBarProps> = ({
  deliveredBottles,
  customerBottleBalance,
  depositRate = 120,
  value,
  onChange,
  compact = false,
}) => {
  const { formatMoney } = useCurrency();

  // Keep UI completely hidden if no bottle products in cart and customer owes 0 bottles
  if (deliveredBottles <= 0 && customerBottleBalance <= 0) {
    return null;
  }

  const totalCharge = (value.damaged + (value.chargeMissing ? value.missing : 0)) * depositRate;

  const updateField = (field: 'returnedGood' | 'damaged' | 'missing', nextVal: number) => {
    const clean = Math.max(0, nextVal);
    onChange({ ...value, [field]: clean });
  };

  const handleQuickAllReturned = () => {
    onChange({
      ...value,
      returnedGood: deliveredBottles,
      damaged: 0,
      missing: 0,
    });
  };

  return (
    <div className={`bg-cyan-50/50 border border-cyan-200/80 rounded-2xl ${compact ? 'p-3' : 'p-4'} space-y-3`}>
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">🍾</span>
          <div>
            <span className="text-xs font-bold text-cyan-950 uppercase tracking-wider">
              Empty Bottles (හිස් බෝතල්)
            </span>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] font-medium text-cyan-800">
              {deliveredBottles > 0 && (
                <span>
                  Delivered: <strong className="font-mono">{deliveredBottles}</strong>
                </span>
              )}
              {customerBottleBalance > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-semibold">
                  Shop Owes: {customerBottleBalance} btls
                </span>
              )}
            </div>
          </div>
        </div>

        {deliveredBottles > 0 && (
          <button
            type="button"
            onClick={handleQuickAllReturned}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white hover:bg-cyan-100/70 text-cyan-800 border border-cyan-200 text-[11px] font-bold shadow-2xs transition cursor-pointer"
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>All Good ({deliveredBottles})</span>
          </button>
        )}
      </div>

      {/* 3-Column Minimal Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* Good Empties Returned */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Good Returned
            </span>
            <span className="text-[10px] font-semibold text-emerald-600">No Fee</span>
          </div>
          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() => updateField('returnedGood', value.returnedGood - 1)}
              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <input
              type="number"
              min="0"
              value={value.returnedGood || ''}
              placeholder="0"
              onChange={(e) => updateField('returnedGood', parseInt(e.target.value, 10) || 0)}
              className="w-full text-center font-mono text-sm font-bold text-slate-900 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => updateField('returnedGood', value.returnedGood + 1)}
              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Damaged Empties */}
        <div className="bg-white border border-amber-200/90 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Damaged (පළුදු)
            </span>
            <span className="text-[10px] font-mono font-bold text-amber-700">
              {formatMoney(depositRate)}/ea
            </span>
          </div>
          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() => updateField('damaged', value.damaged - 1)}
              className="w-7 h-7 rounded-lg bg-amber-50 hover:bg-amber-100 flex items-center justify-center text-amber-800 transition cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <input
              type="number"
              min="0"
              value={value.damaged || ''}
              placeholder="0"
              onChange={(e) => updateField('damaged', parseInt(e.target.value, 10) || 0)}
              className="w-full text-center font-mono text-sm font-bold text-amber-900 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => updateField('damaged', value.damaged + 1)}
              className="w-7 h-7 rounded-lg bg-amber-50 hover:bg-amber-100 flex items-center justify-center text-amber-800 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Missing / Lost Empties */}
        <div className="bg-white border border-rose-200/90 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
              Missing (අස්ථානගත)
            </span>
            <button
              type="button"
              onClick={() => onChange({ ...value, chargeMissing: !value.chargeMissing })}
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide transition cursor-pointer ${
                value.chargeMissing
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              title="Toggle between charging Rs. 120 on this bill or adding to shop bottle debt"
            >
              {value.chargeMissing ? `Charge ${formatMoney(depositRate)}` : 'Add Debt'}
            </button>
          </div>
          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() => updateField('missing', value.missing - 1)}
              className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-800 transition cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <input
              type="number"
              min="0"
              value={value.missing || ''}
              placeholder="0"
              onChange={(e) => updateField('missing', parseInt(e.target.value, 10) || 0)}
              className="w-full text-center font-mono text-sm font-bold text-rose-900 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => updateField('missing', value.missing + 1)}
              className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-800 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Total Bottle Fee Strip */}
      {totalCharge > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-amber-100/70 border border-amber-300/60 rounded-xl text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-amber-900">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>
              Bottle Fee ({value.damaged > 0 ? `${value.damaged} damaged` : ''}
              {value.damaged > 0 && value.chargeMissing && value.missing > 0 ? ' + ' : ''}
              {value.chargeMissing && value.missing > 0 ? `${value.missing} missing` : ''} @ {formatMoney(depositRate)})
            </span>
          </span>
          <span className="font-mono font-bold text-amber-950">
            +{formatMoney(totalCharge)}
          </span>
        </div>
      )}
    </div>
  );
};


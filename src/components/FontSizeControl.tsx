import React, { useState } from 'react';
import { Type, Plus, Minus, RotateCcw, X, Check } from 'lucide-react';
import { useFontSize, FONT_SIZE_PRESETS, PRESET_ORDER, FontSizeLevel } from '../context/FontSizeContext';

interface FontSizeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FontSizeModal: React.FC<FontSizeModalProps> = ({ isOpen, onClose }) => {
  const {
    fontSizeLevel,
    preset,
    setFontSizeLevel,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    canIncrease,
    canDecrease
  } = useFontSize();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* iOS Pull Handle on Mobile */}
        <div className="pt-2.5 pb-1 flex justify-center sm:hidden">
          <div className="w-12 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#0C3B9B] flex items-center justify-center">
              <Type className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 tracking-tight">Display Text Size</h3>
              <p className="text-[11px] text-slate-400">Scale text for mobile and field readability</p>
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

        <div className="p-4 sm:p-5 space-y-4">
          {/* Main Stepper Control */}
          <div className="flex items-center justify-between bg-slate-100/80 p-2 rounded-2xl">
            <button
              type="button"
              onClick={decreaseFontSize}
              disabled={!canDecrease}
              className={`w-12 h-11 flex items-center justify-center rounded-xl bg-white shadow-2xs font-extrabold text-sm transition active:scale-95 cursor-pointer ${
                canDecrease
                  ? 'text-slate-800 hover:bg-slate-50 border border-slate-200/80'
                  : 'text-slate-300 cursor-not-allowed border border-transparent'
              }`}
              title="Decrease Font Size (A-)"
            >
              <div className="flex items-center gap-0.5">
                <Minus className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">A</span>
              </div>
            </button>

            <div className="text-center px-3">
              <div className="text-base font-extrabold text-slate-900 font-mono tracking-tight">
                {preset.percentage}%
              </div>
              <div className="text-[11px] font-bold text-[#0C3B9B] uppercase tracking-wider">
                {preset.label}
              </div>
            </div>

            <button
              type="button"
              onClick={increaseFontSize}
              disabled={!canIncrease}
              className={`w-12 h-11 flex items-center justify-center rounded-xl bg-white shadow-2xs font-extrabold text-sm transition active:scale-95 cursor-pointer ${
                canIncrease
                  ? 'text-slate-800 hover:bg-slate-50 border border-slate-200/80'
                  : 'text-slate-300 cursor-not-allowed border border-transparent'
              }`}
              title="Increase Font Size (A+)"
            >
              <div className="flex items-center gap-0.5">
                <span className="text-xs font-bold">A</span>
                <Plus className="w-3.5 h-3.5" />
              </div>
            </button>
          </div>

          {/* Quick Preset Selector Chips */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Presets
            </label>
            <div className="grid grid-cols-5 gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/80">
              {PRESET_ORDER.map(level => {
                const item = FONT_SIZE_PRESETS[level];
                const isSelected = fontSizeLevel === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setFontSizeLevel(level)}
                    className={`py-1.5 rounded-lg text-[11px] font-bold transition flex flex-col items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'bg-[#0C3B9B] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                    }`}
                  >
                    <span>{item.percentage}%</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Live Preview
            </div>
            <div className="font-bold text-slate-900 truncate">
              Cinnamon Milk Tea 850g
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-xs font-medium">Lorry Stock: 10 Boxes</span>
              <span className="font-mono font-bold text-[#0C3B9B]">Rs. 1,750.00</span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={resetFontSize}
              disabled={fontSizeLevel === 'standard'}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer ${
                fontSizeLevel !== 'standard'
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  : 'text-slate-300 cursor-not-allowed'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Default</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Done</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const FontSizeButton: React.FC<{
  className?: string;
  showLabel?: boolean;
}> = ({ className = '', showLabel = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { preset } = useFontSize();

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-bold transition cursor-pointer border shadow-2xs active:scale-95 ${className || 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/80'}`}
        title={`Text Size: ${preset.percentage}% (${preset.label}). Tap to increase/decrease font size.`}
        aria-label="Adjust font size"
      >
        <span className="font-extrabold tracking-tight flex items-baseline">
          <span className="text-xs">A</span>
          <span className="text-[10px] -ml-0.5 font-bold">a</span>
        </span>
        {showLabel && (
          <span className="text-[10px] font-mono text-slate-500 font-bold ml-0.5">
            {preset.percentage}%
          </span>
        )}
      </button>

      <FontSizeModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};

export const FontSizeInlineStepper: React.FC = () => {
  const { preset, increaseFontSize, decreaseFontSize, resetFontSize, canIncrease, canDecrease, fontSizeLevel } = useFontSize();

  return (
    <div className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-2xl space-y-2 shadow-2xs">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
        <span className="flex items-center gap-1.5 text-[11px]">
          <Type className="w-3.5 h-3.5 text-[#0C3B9B]" /> Text Font Size
        </span>
        <span className="text-[11px] font-bold text-[#0C3B9B] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 font-mono">
          {preset.percentage}%
        </span>
      </div>

      <div className="flex items-center justify-between gap-1.5">
        <button
          type="button"
          onClick={decreaseFontSize}
          disabled={!canDecrease}
          className={`flex-1 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold transition flex items-center justify-center gap-1 shadow-2xs cursor-pointer ${
            canDecrease ? 'text-slate-700 hover:bg-slate-100 active:scale-95' : 'text-slate-300 cursor-not-allowed'
          }`}
          title="Decrease font size"
        >
          <Minus className="w-3 h-3" />
          <span>A-</span>
        </button>

        <button
          type="button"
          onClick={resetFontSize}
          disabled={fontSizeLevel === 'standard'}
          className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition cursor-pointer border ${
            fontSizeLevel !== 'standard'
              ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              : 'bg-transparent text-slate-300 border-transparent cursor-not-allowed'
          }`}
          title="Reset to 100%"
        >
          Reset
        </button>

        <button
          type="button"
          onClick={increaseFontSize}
          disabled={!canIncrease}
          className={`flex-1 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold transition flex items-center justify-center gap-1 shadow-2xs cursor-pointer ${
            canIncrease ? 'text-slate-700 hover:bg-slate-100 active:scale-95' : 'text-slate-300 cursor-not-allowed'
          }`}
          title="Increase font size"
        >
          <span>A+</span>
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};


import React, { useRef, useState } from 'react';
import { X, Printer, CheckCircle2, Bluetooth, Loader2, Check } from 'lucide-react';
import { CustomerPayment, Customer } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import {
  executeSystemPrint,
  printPaymentReceiptToBluetooth,
  build80mmEscPosPaymentReceipt,
  getLastUsedPrinter
} from '../utils/bluetoothPrinter';
import { BluetoothPrinterModal } from './BluetoothPrinterModal';
import { Capacitor } from '@capacitor/core';

interface CustomerReceiptModalProps {
  payment: CustomerPayment | null;
  customer?: Customer | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerReceiptModal: React.FC<CustomerReceiptModalProps> = ({
  payment,
  customer,
  isOpen,
  onClose
}) => {
  const { formatMoney } = useCurrency();
  const receiptRef = useRef<HTMLDivElement>(null);

  const [btStatus, setBtStatus] = useState<string | null>(null);
  const [btLoading, setBtLoading] = useState(false);
  const [btSuccess, setBtSuccess] = useState(false);
  const [showBtPicker, setShowBtPicker] = useState(false);
  const [receiptBytes, setReceiptBytes] = useState<Uint8Array | null>(null);

  if (!isOpen || !payment) return null;

  const handlePrint = () => {
    executeSystemPrint();
  };

  const handleBluetoothPrint = async () => {
    if (!payment) return;
    const bytes = build80mmEscPosPaymentReceipt(payment);
    setReceiptBytes(bytes);

    if (Capacitor.isNativePlatform()) {
      const last = getLastUsedPrinter();
      if (!last) {
        setShowBtPicker(true);
        return;
      }
    }

    setBtLoading(true);
    setBtStatus('Connecting Bluetooth printer...');
    setBtSuccess(false);

    try {
      const result = await printPaymentReceiptToBluetooth(
        payment,
        null,
        (status) => setBtStatus(status)
      );

      if (result.success) {
        setBtSuccess(true);
        setTimeout(() => {
          setBtStatus(null);
          setBtLoading(false);
          setBtSuccess(false);
        }, 3000);
      } else if (result.needsPicker) {
        setBtLoading(false);
        setBtStatus(null);
        setShowBtPicker(true);
      } else {
        setBtLoading(false);
        setBtStatus(result.message);
        setTimeout(() => setBtStatus(null), 4000);
      }
    } catch (err: any) {
      setBtLoading(false);
      setBtStatus(err?.message || 'Bluetooth printing failed');
      setTimeout(() => setBtStatus(null), 4000);
    }
  };

  const cust = customer || payment.customer;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 print:hidden">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Official Payment Receipt</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Receipt Body */}
        <div ref={receiptRef} className="p-6 space-y-5 overflow-y-auto print:p-0">
          {/* Business Header */}
          <div className="text-center pb-4 border-b border-dashed border-slate-200">
            <div className="flex justify-center mb-1.5">
              <img
                src="/ms-logo.png"
                alt="M&S Enterprises"
                className="w-16 h-16 object-contain rounded-xl border border-slate-100 shadow-2xs"
              />
            </div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
              M&S Enterprises
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              115/1A1, Udumulla Road, Himbutana, Angoda • Tel: 0773669913 / 0707077551
            </p>
            <div className="mt-2 inline-block px-3 py-1 bg-emerald-50 text-emerald-700 font-mono font-bold text-xs rounded-full border border-emerald-200/60">
              Receipt: {payment.receiptNumber}
            </div>
          </div>

          {/* Amount Hero */}
          <div className="text-center py-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Amount Received
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 font-mono">
              {formatMoney(payment.amount)}
            </span>
            <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-slate-500 font-semibold">
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-mono text-[11px]">
                {payment.paymentMethod}
              </span>
              <span>• PAID & SETTLED</span>
            </div>
          </div>

          {/* Customer & Payment Meta Details */}
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-400 font-medium">Customer / Client:</span>
              <span className="font-bold text-slate-900 text-right">
                {cust?.name || 'Customer'}
                {cust?.code ? ` (${cust.code})` : ''}
              </span>
            </div>

            {cust?.companyName && (
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Company / Store:</span>
                <span className="font-semibold text-slate-700 text-right">{cust.companyName}</span>
              </div>
            )}

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-400 font-medium">Date & Time:</span>
              <span className="font-medium text-slate-800">
                {new Date(payment.createdAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>

            {payment.chequeNumber && (
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Cheque Number:</span>
                <span className="font-mono font-bold text-blue-700">
                  {payment.chequeNumber} {payment.bankName ? `(${payment.bankName})` : ''}
                </span>
              </div>
            )}

            {payment.reference && (
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Reference Slip:</span>
                <span className="font-mono font-bold text-purple-700">{payment.reference}</span>
              </div>
            )}

            {payment.collectedBy && (
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Collected By:</span>
                <span className="font-semibold text-slate-800">{payment.collectedBy}</span>
              </div>
            )}

            {payment.notes && (
              <div className="py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-medium block mb-0.5">Remarks:</span>
                <span className="text-slate-700 italic">{payment.notes}</span>
              </div>
            )}
          </div>

          {/* Footer acknowledgement */}
          <div className="pt-4 text-center text-[10px] text-slate-400 border-t border-dashed border-slate-200 space-y-1">
            <p>Thank you for your business & prompt settlement.</p>
            <p className="font-mono text-[9px]">Authorized System Generated Voucher</p>
            <div className="pt-2 text-[9px] text-slate-500 font-mono">
              <p className="font-semibold">Powered By J&amp;co. Software Solution</p>
              <p>+94 77 065 4279</p>
            </div>
          </div>
        </div>

        {/* Live Bluetooth Status Banner */}
        {btStatus && (
          <div className={`px-4 py-2 text-xs font-medium flex items-center gap-2 border-t print:hidden ${
            btSuccess
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-indigo-50 text-indigo-800'
          }`}>
            {btSuccess ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <Bluetooth className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            )}
            <span className="truncate">{btStatus}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleBluetoothPrint}
            disabled={btLoading}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {btLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Bluetooth className="w-3.5 h-3.5" />
            )}
            <span>Bluetooth 80mm</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-[#0071E3] hover:bg-blue-600 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Receipt</span>
          </button>
        </div>
      </div>

      {/* Bluetooth Printer Device Picker Modal */}
      <BluetoothPrinterModal
        isOpen={showBtPicker}
        onClose={() => setShowBtPicker(false)}
        rawBytes={receiptBytes || undefined}
        onSelectAndPrint={async (address) => {
          if (!payment) return;
          const res = await printPaymentReceiptToBluetooth(
            payment,
            null,
            undefined,
            address
          );
          if (!res.success) {
            throw new Error(res.message);
          }
          setBtSuccess(true);
          setTimeout(() => setBtSuccess(false), 3000);
        }}
      />
    </div>
  );
};

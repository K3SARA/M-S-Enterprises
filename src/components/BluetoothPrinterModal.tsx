import React, { useState, useEffect } from 'react';
import {
  X,
  Bluetooth,
  Printer,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  ExternalLink
} from 'lucide-react';
import {
  NativeBluetoothPrinter,
  BluetoothDeviceInfo,
  getLastUsedPrinter,
  saveLastUsedPrinter,
  uint8ArrayToBase64
} from '../utils/bluetoothPrinter';
import { Capacitor } from '@capacitor/core';

interface BluetoothPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAndPrint?: (address: string) => Promise<void>;
  rawBytes?: Uint8Array;
}

export const BluetoothPrinterModal: React.FC<BluetoothPrinterModalProps> = ({
  isOpen,
  onClose,
  onSelectAndPrint,
  rawBytes
}) => {
  const [devices, setDevices] = useState<BluetoothDeviceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string>(() => {
    return getLastUsedPrinter()?.address || '';
  });
  const [printing, setPrinting] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);

  const requestPermission = async () => {
    try {
      if (NativeBluetoothPrinter.requestBluetoothPermission) {
        await NativeBluetoothPrinter.requestBluetoothPermission();
      } else if (NativeBluetoothPrinter.requestPermissions) {
        await NativeBluetoothPrinter.requestPermissions();
      }
      setTimeout(() => {
        fetchDevices();
      }, 500);
    } catch (e: any) {
      console.warn('Could not request permission:', e);
    }
  };

  const handleOpenSettings = async () => {
    try {
      if (NativeBluetoothPrinter.openAppSettings) {
        await NativeBluetoothPrinter.openAppSettings();
      }
    } catch (e: any) {
      console.warn('Could not open settings:', e);
    }
  };

  const fetchDevices = async () => {
    if (!Capacitor.isNativePlatform()) {
      setError('Native Bluetooth printer scan is only available inside the Android mobile app.');
      return;
    }

    setLoading(true);
    setError(null);
    setNeedsPermission(false);
    try {
      const avail = await NativeBluetoothPrinter.isAvailable();
      if (!avail.supported) {
        setError('Bluetooth hardware is not supported on this device.');
        setLoading(false);
        return;
      }
      if (!avail.enabled) {
        setError('Bluetooth is turned off. Please turn on Bluetooth in your phone settings.');
        setLoading(false);
        return;
      }

      if (!avail.hasPermission) {
        setNeedsPermission(true);
        try {
          if (NativeBluetoothPrinter.requestBluetoothPermission) {
            await NativeBluetoothPrinter.requestBluetoothPermission();
          } else if (NativeBluetoothPrinter.requestPermissions) {
            await NativeBluetoothPrinter.requestPermissions();
          }
        } catch {}
      }

      const res = await NativeBluetoothPrinter.getPairedDevices();
      const list = res.devices || [];
      setDevices(list);
      setNeedsPermission(false);

      // Auto-select if last used matches or if only 1 printer found
      const last = getLastUsedPrinter();
      if (last && list.some(d => d.address === last.address)) {
        setSelectedAddress(last.address);
      } else {
        const firstPrinter = list.find(d => d.isPrinter);
        if (firstPrinter) {
          setSelectedAddress(firstPrinter.address);
        } else if (list.length === 1) {
          setSelectedAddress(list[0].address);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch Bluetooth devices:', err);
      const msg = err?.message || 'Failed to scan paired Bluetooth devices.';
      setError(msg);
      if (msg.toLowerCase().includes('permission')) {
        setNeedsPermission(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDevices();
      setPrintSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectPrinter = (dev: BluetoothDeviceInfo) => {
    setSelectedAddress(dev.address);
    saveLastUsedPrinter(dev.address, dev.name);
  };

  const handlePrint = async () => {
    if (!selectedAddress) {
      setError('Please select a paired Bluetooth printer from the list.');
      return;
    }

    setPrinting(true);
    setError(null);
    setPrintSuccess(false);

    try {
      if (onSelectAndPrint) {
        await onSelectAndPrint(selectedAddress);
      } else if (rawBytes) {
        const b64 = uint8ArrayToBase64(rawBytes);
        await NativeBluetoothPrinter.printBytes({ address: selectedAddress, bytesBase64: b64 });
      }
      setPrintSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Bluetooth printing failed.');
    } finally {
      setPrinting(false);
    }
  };

  const handleRawBtPrint = async () => {
    if (!rawBytes) return;
    try {
      const b64 = uint8ArrayToBase64(rawBytes);
      await NativeBluetoothPrinter.printRawBt({ bytesBase64: b64 });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'RawBT service failed or not installed.');
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Bluetooth className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 leading-tight">Bluetooth Thermal Printer</h3>
              <p className="text-[10px] text-slate-500">80mm ESC/POS Mobile Receipt</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pairing Instructions Banner */}
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
          <p className="font-semibold text-slate-800 flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5 text-blue-600" />
            <span>How to connect your printer:</span>
          </p>
          <ol className="list-decimal list-inside space-y-0.5 text-[10.5px] text-slate-500 pl-1">
            <li>Turn on your portable 80mm thermal printer.</li>
            <li>Go to phone <strong>Settings &rarr; Bluetooth</strong> and Pair (PIN: 0000 or 1234).</li>
            <li>Select the printer below and tap <strong>Print</strong>.</li>
          </ol>
        </div>

        {/* Paired Device List */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Paired Devices
            </span>
            <button
              type="button"
              onClick={fetchDevices}
              disabled={loading}
              className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-0.5">
            {loading ? (
              <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                <span>Scanning paired printers...</span>
              </div>
            ) : devices.length === 0 ? (
              <div className="py-5 px-3 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-500 space-y-1">
                <Printer className="w-6 h-6 mx-auto text-slate-400 stroke-[1.5]" />
                <p className="font-semibold text-slate-700">No Paired Printers Found</p>
                <p className="text-[10px] text-slate-400">
                  Please open Android Bluetooth Settings, pair your printer, and tap Refresh.
                </p>
              </div>
            ) : (
              devices.map((dev) => {
                const isSelected = selectedAddress === dev.address;
                return (
                  <button
                    key={dev.address}
                    type="button"
                    onClick={() => handleSelectPrinter(dev)}
                    className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <Printer className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <div className="text-xs truncate flex items-center gap-1.5">
                          <span>{dev.name || 'Unnamed Device'}</span>
                          {dev.isPrinter && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-100 text-indigo-700 font-semibold">
                              Thermal
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 truncate">
                          {dev.address}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Status / Error Message */}
        {error && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="leading-tight">{error}</span>
            </div>
            {needsPermission && (
              <div className="flex items-center gap-2 pt-1 border-t border-rose-200/60">
                <button
                  type="button"
                  onClick={requestPermission}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700 transition cursor-pointer"
                >
                  Allow Nearby Devices
                </button>
                <button
                  type="button"
                  onClick={handleOpenSettings}
                  className="px-2.5 py-1 rounded-lg bg-white border border-rose-300 text-rose-700 text-[11px] font-semibold hover:bg-rose-100 transition cursor-pointer"
                >
                  Open App Settings
                </button>
              </div>
            )}
          </div>
        )}

        {printSuccess && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">Printed successfully to 80mm thermal printer!</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handlePrint}
            disabled={printing || !selectedAddress}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {printing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Connecting &amp; Printing...</span>
              </>
            ) : (
              <>
                <Printer className="w-3.5 h-3.5" />
                <span>Print to Selected Printer</span>
              </>
            )}
          </button>

          {/* RawBT Fallback Button */}
          {rawBytes && (
            <button
              type="button"
              onClick={handleRawBtPrint}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              title="Print via RawBT Print Service app (Android)"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>Print via RawBT Service (Fallback)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


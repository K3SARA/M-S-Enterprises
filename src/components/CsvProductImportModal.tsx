import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Layers,
  ArrowRight
} from 'lucide-react';
import { Product } from '../types';
import { ProductService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

interface CsvProductImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
  existingProducts: Product[];
}

interface ParsedProductRow {
  rowNumber: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  costPrice: number;
  unitPrice: number;
  currentStock: number;
  freeStock: number;
  minStockAlert: number;
  barcode?: string;
  priceTiers?: string;
  isExisting: boolean;
  isValid: boolean;
  errorMessage?: string;
}

export const CsvProductImportModal: React.FC<CsvProductImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  existingProducts
}) => {
  const { formatMoney } = useCurrency();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [stockMode, setStockMode] = useState<'OVERWRITE' | 'INCREMENT'>('OVERWRITE');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    errors?: string[];
  } | null>(null);

  if (!isOpen) return null;

  // Existing SKUs lookup set (case-insensitive)
  const existingSkuMap = new Map<string, Product>();
  existingProducts.forEach(p => {
    if (p.sku) existingSkuMap.set(p.sku.trim().toUpperCase(), p);
  });

  // 1. Download CSV Sample Template
  const handleDownloadTemplate = () => {
    const headers = [
      'SKU',
      'Name',
      'Category',
      'Unit',
      'CostPrice',
      'UnitPrice',
      'CurrentStock',
      'FreeStock',
      'MinStockAlert',
      'Barcode',
      'PriceTiers'
    ];

    const sampleRows = [
      ['MS-OIL-01', 'Virgin Coconut Oil 1L', 'Edible Oils', 'Bottle', '850.00', '1150.00', '50', '5', '10', '4791234567890', '5:1100|10:1050'],
      ['MS-FLR-02', 'All Purpose Wheat Flour 1kg', 'Baking Essentials', 'Pack', '220.00', '290.00', '120', '12', '15', '4791234567891', '10:280|25:270'],
      ['MS-SP-03', 'Ground Black Pepper 100g', 'Spices & Seasoning', 'Pack', '180.00', '240.00', '75', '0', '10', '4791234567892', ''],
      ['MS-TEA-04', 'Pure Ceylon Premium Tea 400g', 'Beverages', 'Box', '650.00', '850.00', '90', '10', '10', '4791234567893', '12:800|24:760']
    ];

    const csvContent = [
      headers.join(','),
      ...sampleRows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'ms_inventory_bulk_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Simple CSV Line Parser that respects quoted fields with commas
  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // Normalize column header keys
  const normalizeHeaderKey = (header: string): string => {
    const clean = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (['sku', 'code', 'itemcode', 'productcode'].includes(clean)) return 'sku';
    if (['name', 'productname', 'itemname', 'title', 'description'].includes(clean)) return 'name';
    if (['category', 'cat', 'group'].includes(clean)) return 'category';
    if (['unit', 'uom', 'pack'].includes(clean)) return 'unit';
    if (['costprice', 'cost', 'purchaseprice', 'buyingprice'].includes(clean)) return 'costPrice';
    if (['unitprice', 'sellingprice', 'price', 'saleprice', 'rate'].includes(clean)) return 'unitPrice';
    if (['currentstock', 'stock', 'quantity', 'qty', 'paidstock'].includes(clean)) return 'currentStock';
    if (['freestock', 'freepcs', 'promotionalstock', 'freeunits', 'freeqty'].includes(clean)) return 'freeStock';
    if (['minstockalert', 'minstock', 'minalert', 'alertqty', 'reorderlevel'].includes(clean)) return 'minStockAlert';
    if (['barcode', 'barcodeno', 'ean', 'upc'].includes(clean)) return 'barcode';
    if (['pricetiers', 'tiers', 'pricingtiers', 'volumetiers', 'volumepricing', 'tierprices', 'breaks'].includes(clean)) return 'priceTiers';
    return clean;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        setImportResult({
          success: false,
          message: 'The selected CSV file appears to be empty or contains only a header line.'
        });
        return;
      }

      // Header parsing
      const rawHeaders = parseCsvLine(lines[0]);
      const headerMap: { [index: number]: string } = {};
      rawHeaders.forEach((h, index) => {
        headerMap[index] = normalizeHeaderKey(h);
      });

      const parsed: ParsedProductRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const rowVals = parseCsvLine(lines[i]);
        if (rowVals.length === 0 || rowVals.every(v => v === '')) continue;

        const rowObj: any = {};
        rowVals.forEach((val, idx) => {
          const key = headerMap[idx];
          if (key) rowObj[key] = val;
        });

        const sku = String(rowObj.sku || '').trim().toUpperCase();
        const name = String(rowObj.name || '').trim();
        const category = String(rowObj.category || 'General').trim();
        const unit = String(rowObj.unit || 'Unit').trim();
        const costPrice = parseFloat(rowObj.costPrice || '0') || 0;
        const unitPrice = parseFloat(rowObj.unitPrice || '0') || 0;
        const currentStock = parseInt(rowObj.currentStock || '0', 10) || 0;
        const freeStock = parseInt(rowObj.freeStock || '0', 10) || 0;
        const minStockAlert = parseInt(rowObj.minStockAlert || '10', 10) || 10;
        const barcode = rowObj.barcode ? String(rowObj.barcode).trim() : undefined;
        const priceTiers = rowObj.priceTiers ? String(rowObj.priceTiers).trim() : undefined;

        const isExisting = existingSkuMap.has(sku);
        let isValid = true;
        let errorMessage = '';

        if (!sku) {
          isValid = false;
          errorMessage = 'Missing SKU';
        } else if (!name) {
          isValid = false;
          errorMessage = 'Missing Product Name';
        } else if (unitPrice < 0) {
          isValid = false;
          errorMessage = 'Selling price cannot be negative';
        }

        parsed.push({
          rowNumber: i + 1,
          sku,
          name,
          category,
          unit,
          costPrice,
          unitPrice,
          currentStock,
          freeStock,
          minStockAlert,
          barcode,
          priceTiers,
          isExisting,
          isValid,
          errorMessage
        });
      }

      setParsedRows(parsed);
    };

    reader.readAsText(file);
  };

  // Perform bulk import submission
  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      alert('No valid product rows to import.');
      return;
    }

    try {
      setIsSubmitting(true);
      setImportResult(null);

      const payload = {
        products: validRows.map(r => ({
          sku: r.sku,
          name: r.name,
          category: r.category,
          unit: r.unit,
          costPrice: r.costPrice,
          unitPrice: r.unitPrice,
          currentStock: r.currentStock,
          freeStock: r.freeStock,
          minStockAlert: r.minStockAlert,
          barcode: r.barcode,
          priceTiers: r.priceTiers
        })),
        stockMode
      };

      const res = await ProductService.bulkImport(payload);
      setImportResult({
        success: true,
        message: res.message,
        errors: res.errors
      });

      onImportSuccess();
    } catch (err: any) {
      setImportResult({
        success: false,
        message: err.response?.data?.error || err.message || 'Failed to complete CSV import.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const newCount = parsedRows.filter(r => r.isValid && !r.isExisting).length;
  const updateCount = parsedRows.filter(r => r.isValid && r.isExisting).length;
  const errorCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col border border-slate-200/80 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Bulk Stock & Product CSV Import</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 tracking-wide uppercase">
                  Admin Only
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Rapidly create new products or update warehouse stock levels from a spreadsheet.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">

          {/* Download Sample Template & Quick Help */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-blue-50/60 border border-blue-100">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                Standard CSV Columns
              </h3>
              <p className="text-[11px] text-blue-700">
                Headers supported: <span className="font-mono font-medium">SKU, Name, Category, Unit, CostPrice, UnitPrice, CurrentStock, FreeStock, MinStockAlert, Barcode</span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-white hover:bg-blue-50 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 transition shadow-2xs shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Download Sample CSV
            </button>
          </div>

          {/* File Upload Dropzone */}
          <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 text-center bg-slate-50/50 hover:bg-blue-50/20 transition cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-100/70 text-blue-600 flex items-center justify-center mb-2">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {fileName ? fileName : 'Click to select or drag and drop your .CSV file'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports Microsoft Excel, Google Sheets, or any comma-separated values file (.csv)
            </p>
          </div>

          {/* Stock Mode Options (When rows are parsed) */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-slate-500" />
                For Existing Items in Database, choose stock handling mode:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                  stockMode === 'OVERWRITE'
                    ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}>
                  <input
                    type="radio"
                    name="stockMode"
                    value="OVERWRITE"
                    checked={stockMode === 'OVERWRITE'}
                    onChange={() => setStockMode('OVERWRITE')}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Overwrite Physical Stock</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Sets warehouse stock exactly equal to the CSV quantity (Recommended for stock audit take).
                    </div>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                  stockMode === 'INCREMENT'
                    ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}>
                  <input
                    type="radio"
                    name="stockMode"
                    value="INCREMENT"
                    checked={stockMode === 'INCREMENT'}
                    onChange={() => setStockMode('INCREMENT')}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Add / Increment to Stock</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Adds the CSV quantity on top of existing on-hand stock (Recommended for inbound bulk shipments).
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Validation & Preview Summary */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Data Preview & Verification ({parsedRows.length} rows detected)
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                    +{newCount} New
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                    ↻ {updateCount} Updates
                  </span>
                  {errorCount > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800">
                      ⚠ {errorCount} Invalid
                    </span>
                  )}
                </div>
              </div>

              {/* Scrollable Preview Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 sticky top-0 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Cost Price</th>
                      <th className="py-2.5 px-3 text-right">Selling Price</th>
                      <th className="py-2.5 px-3 text-right">Paid Stock</th>
                      <th className="py-2.5 px-3 text-right">Free Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {parsedRows.map((row) => (
                      <tr 
                        key={row.rowNumber}
                        className={!row.isValid ? 'bg-rose-50/60' : row.isExisting ? 'bg-blue-50/20' : 'hover:bg-slate-50'}
                      >
                        <td className="py-2 px-3">
                          {!row.isValid ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-200 text-rose-900" title={row.errorMessage}>
                              Error: {row.errorMessage}
                            </span>
                          ) : row.isExisting ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                              Update Existing
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              New Product
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900">{row.sku}</td>
                        <td className="py-2 px-3">{row.name}</td>
                        <td className="py-2 px-3 text-slate-500">{row.category}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">{formatMoney(row.costPrice)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatMoney(row.unitPrice)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{row.currentStock} {row.unit}</td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-700">+{row.freeStock} Free</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import Result Notification */}
          {importResult && (
            <div className={`p-4 rounded-2xl flex items-start gap-3 border ${
              importResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {importResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="text-xs sm:text-sm font-bold">{importResult.message}</div>
                {importResult.errors && importResult.errors.length > 0 && (
                  <ul className="text-xs list-disc pl-4 space-y-0.5 text-rose-700">
                    {importResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200/60 transition"
          >
            Cancel
          </button>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting || parsedRows.filter(r => r.isValid).length === 0}
              onClick={handleExecuteImport}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 text-white shadow-sm transition ${
                isSubmitting || parsedRows.filter(r => r.isValid).length === 0
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-[#0071E3] hover:bg-blue-600 active:scale-[0.98]'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Importing Products...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  Import {parsedRows.filter(r => r.isValid).length} Products Now
                  <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};


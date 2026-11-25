import React, { useState, useEffect } from 'react';
import { X, Check, Layers, Package, Sparkles, Building2, Plus, Trash2, Tag, Zap } from 'lucide-react';
import { Product, Supplier, ProductPriceTier } from '../types';
import { ProductService, SupplierService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

interface ProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaultIsRawMaterial?: boolean;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  isOpen,
  onClose,
  onSaved,
  defaultIsRawMaterial = false
}) => {
  const { currencyConfig } = useCurrency();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    name: '',
    category: 'Beverages',
    unit: 'Case',
    unitPrice: '',
    costPrice: '',
    currentStock: '0',
    freeStock: '0',
    minStockAlert: '10',
    freeRatioBuy: '0',
    freeRatioGet: '0',
    isRawMaterial: false,
    isReturnableBottle: false,
    bottlesPerUnit: '24',
    bottleDepositFee: '120',
    supplierId: ''
  });
  const [priceTiers, setPriceTiers] = useState<Array<{ id?: string; minQty: string; unitPrice: string }>>([]);
  const [quickTierText, setQuickTierText] = useState<string>('');
  const [showQuickFill, setShowQuickFill] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    SupplierService.getAll()
      .then(setSuppliers)
      .catch(err => console.warn('Failed to load suppliers in ProductModal:', err));
  }, []);

  useEffect(() => {
    if (product) {
      setFormData({
        sku: product.sku,
        barcode: product.barcode || '',
        name: product.name,
        category: product.category,
        unit: product.unit,
        unitPrice: product.isRawMaterial ? '' : product.unitPrice.toString(),
        costPrice: product.costPrice.toString(),
        currentStock: product.currentStock.toString(),
        freeStock: (product.freeStock || 0).toString(),
        minStockAlert: product.minStockAlert.toString(),
        freeRatioBuy: (product.freeRatioBuy || 0).toString(),
        freeRatioGet: (product.freeRatioGet || 0).toString(),
        isRawMaterial: Boolean(product.isRawMaterial),
        isReturnableBottle: Boolean(product.isReturnableBottle),
        bottlesPerUnit: (product.bottlesPerUnit && product.bottlesPerUnit > 0 ? product.bottlesPerUnit : 24).toString(),
        bottleDepositFee: (product.bottleDepositFee !== undefined && product.bottleDepositFee !== null ? product.bottleDepositFee : 120).toString(),
        supplierId: product.supplierId || ''
      });
      const tiers = (product.priceTiers || []).map(t => ({
        id: t.id,
        minQty: String(t.minQty),
        unitPrice: String(t.unitPrice)
      }));
      setPriceTiers(tiers);
    } else {
      setFormData({
        sku: '',
        barcode: '',
        name: '',
        category: defaultIsRawMaterial ? 'Raw Materials' : 'Beverages',
        unit: defaultIsRawMaterial ? 'Kg' : 'Case',
        unitPrice: '',
        costPrice: '',
        currentStock: '0',
        freeStock: '0',
        minStockAlert: '10',
        freeRatioBuy: '0',
        freeRatioGet: '0',
        isRawMaterial: defaultIsRawMaterial,
        isReturnableBottle: false,
        bottlesPerUnit: '24',
        bottleDepositFee: '120',
        supplierId: ''
      });
      setPriceTiers([]);
    }
    setError(null);
    setShowQuickFill(false);
  }, [product, isOpen, defaultIsRawMaterial]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.sku.trim()) {
      setError('Please provide SKU / Code and Item Name.');
      return;
    }

    if (!formData.isRawMaterial && !formData.unitPrice) {
      setError('Please provide Unit Selling Price for finished goods.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const validTiers = formData.isRawMaterial ? [] : priceTiers
        .map(t => ({ minQty: parseInt(String(t.minQty), 10), unitPrice: parseFloat(String(t.unitPrice)) }))
        .filter(t => t.minQty > 1 && t.unitPrice > 0);

      const qtySet = new Set<number>();
      for (const t of validTiers) {
        if (qtySet.has(t.minQty)) {
          setError(`Duplicate volume tier with Minimum Quantity ${t.minQty}. Each tier must have a unique quantity.`);
          setLoading(false);
          return;
        }
        qtySet.add(t.minQty);
      }

      const payload = {
        sku: formData.sku.trim().toUpperCase(),
        barcode: formData.barcode.trim() || undefined,
        name: formData.name.trim(),
        category: formData.category.trim() || (formData.isRawMaterial ? 'Raw Materials' : 'General'),
        unit: formData.unit.trim() || (formData.isRawMaterial ? 'Kg' : 'Unit'),
        unitPrice: formData.isRawMaterial ? 0 : parseFloat(formData.unitPrice || '0'),
        costPrice: parseFloat(formData.costPrice || '0'),
        currentStock: parseInt(formData.currentStock || '0', 10),
        freeStock: parseInt(formData.freeStock || '0', 10),
        minStockAlert: parseInt(formData.minStockAlert || '10', 10),
        freeRatioBuy: formData.isRawMaterial ? 0 : (parseInt(formData.freeRatioBuy, 10) || 0),
        freeRatioGet: formData.isRawMaterial ? 0 : (parseInt(formData.freeRatioGet, 10) || 0),
        isRawMaterial: formData.isRawMaterial,
        isReturnableBottle: formData.isRawMaterial ? false : formData.isReturnableBottle,
        bottlesPerUnit: formData.isReturnableBottle ? Math.max(1, parseInt(formData.bottlesPerUnit || '1', 10)) : 1,
        bottleDepositFee: formData.isReturnableBottle ? (parseFloat(formData.bottleDepositFee || '120') || 120) : 120,
        supplierId: formData.supplierId || null,
        priceTiers: validTiers
      };

      if (product) {
        await ProductService.update(product.id, payload);
      } else {
        await ProductService.create(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-900">
              {product 
                ? (formData.isRawMaterial ? 'Edit Raw Material' : 'Edit Product Details')
                : (formData.isRawMaterial ? 'Add Raw Material / Component' : 'Add Finished Good Item')}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {formData.isRawMaterial 
                ? 'Manufacturing ingredient or packaging component (no selling price)' 
                : 'Sellable product for sales bills and delivery fleet'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-700 text-xs px-5 sm:px-7 py-2.5 font-medium border-b border-rose-100 shrink-0">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-4 overflow-y-auto">
          {/* Item Classification Segmented Control */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Item Classification
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    isRawMaterial: false,
                    category: prev.category === 'Raw Materials' ? 'Beverages' : prev.category,
                    unit: ['Kg', 'g', 'Litre', 'ml'].includes(prev.unit) ? 'Case' : prev.unit
                  }));
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  !formData.isRawMaterial
                    ? 'bg-white text-blue-600 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Finished Good (Sellable)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    isRawMaterial: true,
                    category: prev.category === 'Beverages' ? 'Raw Materials' : prev.category,
                    unit: prev.unit === 'Case' ? 'Kg' : prev.unit,
                    unitPrice: ''
                  }));
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  formData.isRawMaterial
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Raw Material (Manufacturing)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                SKU / Code *
              </label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                placeholder={formData.isRawMaterial ? 'e.g. RAW-01' : 'e.g. BEV-003'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Barcode (EAN-13/UPC)
              </label>
              <input
                type="text"
                value={formData.barcode}
                onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="e.g. 479201100234"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                placeholder={formData.isRawMaterial ? 'e.g. Ingredients' : 'e.g. Beverages'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              {formData.isRawMaterial ? 'Raw Material / Component Name *' : 'Product Description / Name *'}
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder={formData.isRawMaterial ? 'e.g. Refined Cane Sugar' : 'e.g. Premium Cold Brew Coffee'}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
            />
          </div>

          {/* Supplier / Principal FMCG Brand Assignment */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Supplier / Principal Brand
            </label>
            <select
              value={formData.supplierId}
              onChange={e => setFormData({ ...formData, supplierId: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
            >
              <option value="">-- No Supplier (Local / In-House Manufactured) --</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Links this SKU to the Supplier so they can monitor sales and lorry distribution in their Supplier Portal.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Unit Type
              </label>
              <select
                value={formData.unit}
                onChange={e => setFormData({ ...formData, unit: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              >
                {formData.isRawMaterial ? (
                  <>
                    <option value="Kg">Kg (Kilogram)</option>
                    <option value="g">g (Gram)</option>
                    <option value="Litre">Litre</option>
                    <option value="ml">ml (Millilitre)</option>
                    <option value="Pieces">Pieces</option>
                    <option value="Roll">Roll</option>
                    <option value="Meter">Meter</option>
                    <option value="Bag">Bag</option>
                    <option value="Box">Box</option>
                    <option value="Unit">Unit</option>
                  </>
                ) : (
                  <>
                    <option value="Case">Case</option>
                    <option value="Box">Box</option>
                    <option value="Carton">Carton</option>
                    <option value="Bag">Bag</option>
                    <option value="Pack">Pack</option>
                    <option value="Unit">Unit</option>
                  </>
                )}
              </select>
            </div>

            {formData.isRawMaterial ? (
              <div className="sm:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-purple-700 block mb-1">
                  Purchase / Cost Price ({currencyConfig.symbol}) *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={formData.costPrice}
                  onChange={e => setFormData({ ...formData, costPrice: e.target.value })}
                  placeholder="0.00"
                  className="w-full bg-purple-50/40 border border-purple-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Acquisition cost per {formData.unit} (used to compute recipe batch costs)
                </span>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Sale Price ({currencyConfig.symbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.unitPrice}
                    onChange={e => setFormData({ ...formData, unitPrice: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Cost Price ({currencyConfig.symbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.costPrice}
                    onChange={e => setFormData({ ...formData, costPrice: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                  />
                </div>
              </>
            )}
          </div>

          {/* Raw Material Info Banner */}
          {formData.isRawMaterial && (
            <div className="p-3 bg-purple-50 border border-purple-100 rounded-2xl flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-purple-900">
                  No Selling Price Required
                </p>
                <p className="text-[11px] text-purple-700 mt-0.5 leading-relaxed">
                  Raw materials are used for recipe formulation in manufacturing runs. They are deducted from inventory during batch production and are excluded from retail billing.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-1">
            {!product && (
              <>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Starting Paid Stock ({formData.unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.currentStock}
                    onChange={e => setFormData({ ...formData, currentStock: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-emerald-700 block">
                      Free Issue Stock
                    </label>
                    <span className="text-[10px] font-bold px-1 rounded bg-emerald-100 text-emerald-800 font-mono">
                      Cost: 0
                    </span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    value={formData.freeStock}
                    onChange={e => setFormData({ ...formData, freeStock: e.target.value })}
                    placeholder="0"
                    className="w-full bg-emerald-50/50 border border-emerald-300 rounded-xl px-3 py-2 text-sm font-semibold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </>
            )}
            <div className="col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Low Stock Alert Threshold ({formData.unit})
              </label>
              <input
                type="number"
                step="any"
                value={formData.minStockAlert}
                onChange={e => setFormData({ ...formData, minStockAlert: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              />
            </div>
          </div>

          {/* Trade Promotion / Free Issue Scheme (Finished goods only) */}
          {!formData.isRawMaterial && (
            <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                  Trade Promotion Scheme (Free Issue Offer)
                </span>
                <span className="text-[10px] text-blue-600 font-semibold bg-blue-100/70 px-2 py-0.5 rounded-full">
                  Optional
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Buy Target (Units)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.freeRatioBuy}
                    onChange={e => setFormData({ ...formData, freeRatioBuy: e.target.value })}
                    placeholder="e.g. 10"
                    className="w-full bg-white border border-blue-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Get Free (Units)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.freeRatioGet}
                    onChange={e => setFormData({ ...formData, freeRatioGet: e.target.value })}
                    placeholder="e.g. 1"
                    className="bg-white border border-blue-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500">
                {parseInt(formData.freeRatioBuy, 10) > 0 && parseInt(formData.freeRatioGet, 10) > 0
                  ? `Active offer: Buy ${formData.freeRatioBuy} get ${formData.freeRatioGet} Free. Office Bill Entry will auto-suggest free units.`
                  : 'No default offer. Free issues can still be entered manually during bill entry.'}
              </p>
            </div>
          )}

          {/* Volume-Based Tiered Unit Pricing (Quantity Breaks) */}
          {!formData.isRawMaterial && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Tag className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      Volume Pricing Tiers (Quantity Breaks)
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1.5 font-normal hidden sm:inline">
                      • Base: {currencyConfig.symbol}{parseFloat(formData.unitPrice || '0').toFixed(2)} (Qty 1)
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowQuickFill(!showQuickFill)}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-0.5 rounded-lg transition"
                  >
                    {showQuickFill ? 'Hide Quick-Fill' : '⚡ Quick-Fill'}
                  </button>
                  {priceTiers.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {priceTiers.length} {priceTiers.length === 1 ? 'Tier' : 'Tiers'}
                    </span>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-tight">
                Dynamically switch the per-unit selling price in Rep Mobile Billing &amp; Office Bill Entry when line item quantity reaches bulk milestones.
              </p>

              {/* Quick-Fill Box */}
              {showQuickFill && (
                <div className="p-2.5 bg-blue-50/70 border border-blue-200/70 rounded-xl space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-bold text-blue-900 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-blue-600" /> Bulk Quantity Presets
                    </span>
                    <span className="text-[10px] text-blue-600">Calculates % discounts from base price</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const base = parseFloat(formData.unitPrice || '0');
                        if (!base) {
                          setError('Please fill Base Unit Price first before applying presets.');
                          return;
                        }
                        setPriceTiers([
                          { minQty: '5', unitPrice: (base * 0.95).toFixed(2) },
                          { minQty: '10', unitPrice: (base * 0.90).toFixed(2) },
                          { minQty: '25', unitPrice: (base * 0.85).toFixed(2) }
                        ]);
                        setShowQuickFill(false);
                      }}
                      className="px-2 py-1 bg-white hover:bg-blue-100/80 border border-blue-200 rounded-lg text-[10.5px] font-semibold text-blue-800 transition active:scale-95"
                    >
                      5 (-5%) &bull; 10 (-10%) &bull; 25 (-15%)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const base = parseFloat(formData.unitPrice || '0');
                        if (!base) {
                          setError('Please fill Base Unit Price first before applying presets.');
                          return;
                        }
                        setPriceTiers([
                          { minQty: '12', unitPrice: (base * 0.92).toFixed(2) },
                          { minQty: '24', unitPrice: (base * 0.88).toFixed(2) }
                        ]);
                        setShowQuickFill(false);
                      }}
                      className="px-2 py-1 bg-white hover:bg-blue-100/80 border border-blue-200 rounded-lg text-[10.5px] font-semibold text-blue-800 transition active:scale-95"
                    >
                      Dozens: 12 (-8%) &bull; 24 (-12%)
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1 border-t border-blue-200/50">
                    <input
                      type="text"
                      placeholder="Paste e.g. 5:40, 10:38 or 5:40|10:38"
                      value={quickTierText}
                      onChange={e => setQuickTierText(e.target.value)}
                      className="flex-1 bg-white border border-blue-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!quickTierText.trim()) return;
                        const tokens = quickTierText.split(/[|,;]+/).map(s => s.trim()).filter(Boolean);
                        const parsed: Array<{ minQty: string; unitPrice: string }> = [];
                        for (const token of tokens) {
                          const parts = token.split(/[:=\->]+/).map(s => s.trim());
                          if (parts.length >= 2) {
                            const m = parseInt(parts[0], 10);
                            const p = parseFloat(parts[1]);
                            if (m > 1 && p > 0) {
                              parsed.push({ minQty: String(m), unitPrice: String(p) });
                            }
                          }
                        }
                        if (parsed.length > 0) {
                          setPriceTiers(parsed);
                          setQuickTierText('');
                          setShowQuickFill(false);
                        } else {
                          setError('Invalid format. Use format "MinQty:UnitPrice", e.g. 5:40, 10:38');
                        }
                      }}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}

              {/* Tiers List */}
              {priceTiers.length === 0 ? (
                <div className="p-3 text-center rounded-xl bg-white border border-dashed border-slate-200 text-slate-400">
                  <p className="text-xs font-medium">No volume tiers active.</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Base price applies regardless of cart quantity.</p>
                  <button
                    type="button"
                    onClick={() => {
                      const base = parseFloat(formData.unitPrice || '0');
                      const suggested = base > 0 ? (base * 0.95).toFixed(2) : '';
                      setPriceTiers([{ minQty: '5', unitPrice: suggested }]);
                    }}
                    className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition border border-emerald-200 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add First Volume Tier</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                    <span className="col-span-4">Min Qty (≥)</span>
                    <span className="col-span-4">Unit Price ({currencyConfig.symbol})</span>
                    <span className="col-span-3 text-right">Savings</span>
                    <span className="col-span-1"></span>
                  </div>

                  <div className="space-y-1.5">
                    {priceTiers.map((tier, idx) => {
                      const basePrice = parseFloat(formData.unitPrice || '0');
                      const tPrice = parseFloat(String(tier.unitPrice) || '0');
                      const diff = basePrice > 0 && tPrice > 0 ? basePrice - tPrice : 0;
                      const pct = basePrice > 0 && diff > 0 ? Math.round((diff / basePrice) * 100) : 0;

                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-xl border border-slate-200/90 shadow-2xs"
                        >
                          <div className="col-span-4">
                            <input
                              type="number"
                              min="2"
                              step="1"
                              value={tier.minQty}
                              onChange={e => {
                                const next = [...priceTiers];
                                next[idx].minQty = e.target.value;
                                setPriceTiers(next);
                              }}
                              placeholder="e.g. 5"
                              required
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                            />
                          </div>

                          <div className="col-span-4">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={tier.unitPrice}
                              onChange={e => {
                                const next = [...priceTiers];
                                next[idx].unitPrice = e.target.value;
                                setPriceTiers(next);
                              }}
                              placeholder="0.00"
                              required
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                            />
                          </div>

                          <div className="col-span-3 text-right">
                            {diff > 0 ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/80">
                                -{pct}%
                              </span>
                            ) : diff < 0 ? (
                              <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                +{Math.abs(pct)}%
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">
                                Base
                              </span>
                            )}
                          </div>

                          <div className="col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                const next = priceTiers.filter((_, i) => i !== idx);
                                setPriceTiers(next);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                              title="Delete Tier"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const lastQty = priceTiers.length > 0 ? parseInt(String(priceTiers[priceTiers.length - 1].minQty), 10) : 1;
                        const nextMin = (isNaN(lastQty) ? 1 : lastQty) + 5;
                        const base = parseFloat(formData.unitPrice || '0');
                        const suggested = base > 0 ? Math.max(1, base * 0.90).toFixed(2) : '';
                        setPriceTiers([...priceTiers, { minQty: String(nextMin), unitPrice: suggested }]);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold shadow-2xs transition active:scale-95 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Add Tier Row</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPriceTiers([])}
                      className="text-[11px] text-slate-400 hover:text-rose-600 font-medium transition"
                    >
                      Clear All Tiers
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Returnable Glass Bottle Configuration */}
          {!formData.isRawMaterial && (
            <div className="bg-cyan-50/40 rounded-2xl p-4 border border-cyan-200/70 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label htmlFor="isReturnableBottle" className="text-xs font-bold uppercase tracking-wider text-cyan-900 flex items-center gap-1.5 cursor-pointer">
                    <span>🍾</span> Returnable Glass Bottle Product
                  </label>
                  <p className="text-[11px] text-cyan-700/80 mt-0.5">
                    Track empty bottle returns &amp; charge Rs. 120/- for damaged or missing bottles
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    id="isReturnableBottle"
                    type="checkbox"
                    checked={formData.isReturnableBottle}
                    onChange={e => setFormData({ ...formData, isReturnableBottle: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600" />
                </label>
              </div>

              {formData.isReturnableBottle && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-cyan-200/60">
                  <div>
                    <label className="text-[11px] font-bold text-cyan-800 uppercase tracking-wider block mb-1">
                      Bottles Per {formData.unit || 'Unit'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.bottlesPerUnit}
                      onChange={e => setFormData({ ...formData, bottlesPerUnit: e.target.value })}
                      placeholder="e.g. 24"
                      className="w-full bg-white border border-cyan-200 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-cyan-800 uppercase tracking-wider block mb-1">
                      Damaged / Missing Fee (Rs.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.bottleDepositFee}
                      onChange={e => setFormData({ ...formData, bottleDepositFee: e.target.value })}
                      placeholder="120.00"
                      className="w-full bg-white border border-cyan-200 rounded-xl px-3 py-1.5 text-sm font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-2.5 text-white rounded-xl text-sm font-semibold shadow-sm transition flex items-center gap-1.5 ${
                formData.isRawMaterial 
                  ? 'bg-purple-600 hover:bg-purple-700' 
                  : 'bg-[#0071E3] hover:bg-[#0077ED]'
              }`}
            >
              <Check className="w-4 h-4" /> 
              {loading 
                ? 'Saving...' 
                : (product 
                    ? (formData.isRawMaterial ? 'Update Raw Material' : 'Save Product') 
                    : (formData.isRawMaterial ? 'Add Raw Material' : 'Add Product')
                  )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

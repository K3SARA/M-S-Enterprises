import { Product, ProductPriceTier } from '../types';

export interface TierPriceResolution {
  unitPrice: number;
  isTierPrice: boolean;
  activeTier: ProductPriceTier | null;
  basePrice: number;
  savingsPerUnit: number;
}

/**
 * Resolves the applicable per-unit selling price for a product based on cart quantity and volume breaks.
 *
 * Rule:
 * 1. If rep/cashier manually overrode the price (isManualPrice = true), keep manual override.
 * 2. If product has priceTiers, find the highest minQty tier where minQty <= quantity.
 * 3. Otherwise, use product.unitPrice as base default.
 */
export function resolveTierUnitPrice(
  product: Pick<Product, 'unitPrice'> & { priceTiers?: ProductPriceTier[] },
  quantity: number,
  options?: {
    manualPrice?: number;
    isManual?: boolean;
  }
): TierPriceResolution {
  const basePrice = Number(product.unitPrice) || 0;

  // 1. Manual override guard
  if (options?.isManual && typeof options.manualPrice === 'number' && options.manualPrice >= 0) {
    return {
      unitPrice: options.manualPrice,
      isTierPrice: false,
      activeTier: null,
      basePrice,
      savingsPerUnit: Math.max(0, basePrice - options.manualPrice)
    };
  }

  // 2. Volume-based tiered quantity breaks
  if (product.priceTiers && Array.isArray(product.priceTiers) && product.priceTiers.length > 0 && quantity > 0) {
    const sorted = [...product.priceTiers].sort((a, b) => Number(b.minQty) - Number(a.minQty));
    const matchedTier = sorted.find(t => quantity >= Number(t.minQty));

    if (matchedTier) {
      const tierPrice = Number(matchedTier.unitPrice) || basePrice;
      return {
        unitPrice: tierPrice,
        isTierPrice: true,
        activeTier: matchedTier,
        basePrice,
        savingsPerUnit: Math.max(0, basePrice - tierPrice)
      };
    }
  }

  // 3. Default base price
  return {
    unitPrice: basePrice,
    isTierPrice: false,
    activeTier: null,
    basePrice,
    savingsPerUnit: 0
  };
}


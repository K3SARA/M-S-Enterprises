/**
 * Bluetooth Thermal Printer (80mm / ESC-POS) Utility
 * Supports:
 * 1. Web Bluetooth API for direct wireless printing to portable thermal receipt printers
 * 2. ESC/POS command generation optimized for 80mm rolls (42-48 character width)
 * 3. Fallback to System Print Spooler / Android Bluetooth Print Services (RawBT, Bluetooth Print)
 */

import { Order, SystemSettings, CustomerPayment } from '../types';
import { registerPlugin, Capacitor } from '@capacitor/core';

export interface BluetoothDeviceInfo {
  name: string;
  address: string;
  isPrinter?: boolean;
}

export interface BluetoothPrinterPluginInterface {
  isAvailable(): Promise<{ supported: boolean; enabled: boolean; hasPermission: boolean }>;
  getPairedDevices(): Promise<{ devices: BluetoothDeviceInfo[] }>;
  requestPermissions?(): Promise<any>;
  requestBluetoothPermission?(): Promise<{ requested: boolean; hasPermission: boolean }>;
  openAppSettings?(): Promise<{ opened: boolean }>;
  printBytes(options: { address: string; bytesBase64: string }): Promise<{ success: boolean; message: string }>;
  printRawBt(options: { bytesBase64: string }): Promise<{ success: boolean; message: string }>;
  printSystem(): Promise<{ success: boolean }>;
}

export const NativeBluetoothPrinter = registerPlugin<BluetoothPrinterPluginInterface>('BluetoothPrinter');

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function getLastUsedPrinter(): { address: string; name: string } | null {
  try {
    const address = localStorage.getItem('ms_last_bt_printer_address');
    const name = localStorage.getItem('ms_last_bt_printer_name') || 'Bluetooth Printer';
    if (address) return { address, name };
  } catch {}
  return null;
}

export function saveLastUsedPrinter(address: string, name: string): void {
  try {
    localStorage.setItem('ms_last_bt_printer_address', address);
    localStorage.setItem('ms_last_bt_printer_name', name);
  } catch {}
}

export async function executeSystemPrint(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeBluetoothPrinter.printSystem();
      return;
    } catch (e) {
      console.warn('Native printSystem failed, fallback to window.print', e);
    }
  }
  window.print();
}

// Standard 80mm thermal receipt character width (Font A: 42-48 chars, using 42 for safe margins)
const RECEIPT_WIDTH = 42;

// Standard Bluetooth thermal printer GATT service & characteristic UUIDs
const BLUETOOTH_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer Service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // Common ESC/POS Serial (Xprinter, Rongta, MPT, GOOJPRT)
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent
  '0000ff00-0000-1000-8000-00805f9b34fb',
];

// Basic ESC/POS byte commands
const ESC = 0x1b;
const GS = 0x1d;

const COMMANDS = {
  INIT: [ESC, 0x40], // Initialize printer
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
  DOUBLE_WIDTH: [ESC, 0x21, 0x20],
  DOUBLE_SIZE: [ESC, 0x21, 0x30],
  NORMAL_SIZE: [ESC, 0x21, 0x00],
  LINE_FEED: [0x0a],
  PAPER_FEED_3: [ESC, 0x64, 0x03],
  PAPER_FEED_5: [ESC, 0x64, 0x05],
  PARTIAL_CUT: [GS, 0x56, 0x41, 0x10],
};

/**
 * Check if Web Bluetooth is supported in the current browser/environment
 */
export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Format string into two columns aligned left and right for 80mm (42 columns)
 */
function padTwoColumns(left: string, right: string, width = RECEIPT_WIDTH): string {
  const leftTrim = left.trim();
  const rightTrim = right.trim();
  const spaces = width - leftTrim.length - rightTrim.length;
  if (spaces <= 0) {
    // If text exceeds width, put right on next line
    return `${leftTrim}\n${' '.repeat(Math.max(0, width - rightTrim.length))}${rightTrim}`;
  }
  return `${leftTrim}${' '.repeat(spaces)}${rightTrim}`;
}

/**
 * Divider line helper
 */
function dividerLine(char = '-', width = RECEIPT_WIDTH): string {
  return char.repeat(width);
}

/**
 * Encode string to Uint8Array using ASCII / Windows-1252 compatible encoding
 */
function encodeText(text: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(text);
}

/**
 * Build ESC/POS Byte Buffer for 80mm Thermal Receipt
 */
export function build80mmEscPosReceipt(order: Order, settings?: SystemSettings | null): Uint8Array {
  const chunks: number[] = [];

  const addBytes = (bytes: number[]) => {
    for (const b of bytes) chunks.push(b);
  };

  const addText = (text: string) => {
    const encoded = encodeText(text);
    for (let i = 0; i < encoded.length; i++) {
      chunks.push(encoded[i]);
    }
  };

  const addLine = (text = '') => {
    addText(text);
    addBytes(COMMANDS.LINE_FEED);
  };

  // 1. Initialize
  addBytes(COMMANDS.INIT);

  // 2. Header (Centered, bold)
  addBytes(COMMANDS.ALIGN_CENTER);
  addBytes(COMMANDS.DOUBLE_SIZE);
  addBytes(COMMANDS.BOLD_ON);
  addLine(settings?.companyName || 'M&S Enterprises');
  addBytes(COMMANDS.NORMAL_SIZE);
  addBytes(COMMANDS.BOLD_OFF);

  addLine(settings?.address || '115/1A1, Udumulla Road, Himbutana, Angoda');
  addLine(`Tel: ${settings?.phone || '0773669913 / 0707077551'}`);
  if (settings?.registrationNumber) {
    addLine(`Reg/VAT: ${settings.registrationNumber}`);
  }

  const isPureReturn = (!order.items || order.items.length === 0) && (order.returns && order.returns.length > 0);
  const isExchange = order.isExchangeOrder || ((order.items && order.items.length > 0) && (order.returns && order.returns.length > 0));

  addLine(dividerLine('='));
  addBytes(COMMANDS.BOLD_ON);
  if (isExchange) {
    addLine('*** GOODS RETURN & EXCHANGE SLIP ***');
  } else if (isPureReturn || order.orderNumber?.startsWith('RET-')) {
    addLine('*** GOODS RETURN CREDIT VOUCHER ***');
  } else {
    addLine('*** SALES BILL / DELIVERY RECEIPT ***');
  }
  addBytes(COMMANDS.BOLD_OFF);
  addLine(dividerLine('='));

  // 3. Bill & Lorry Metadata (Left aligned)
  addBytes(COMMANDS.ALIGN_LEFT);
  const dateStr = new Date(order.createdAt).toLocaleDateString();
  const timeStr = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  addLine(padTwoColumns(`Date: ${dateStr} ${timeStr}`, `Status: ${order.paymentStatus}`));
  addLine(padTwoColumns(`Bill #: ${order.paperBillNumber || order.orderNumber}`, `Ref: ${order.orderNumber}`));

  if (order.lorry) {
    addLine(`Lorry: ${order.lorry.vehicleNumber} | Driver: ${order.lorry.driverName}`);
    if (order.route?.name || order.lorry.route?.name) {
      addLine(`Route: ${order.route?.name || order.lorry.route?.name}`);
    }
  }

  // 4. Customer Information
  addLine(dividerLine('-'));
  addBytes(COMMANDS.BOLD_ON);
  addLine(`Customer: ${order.customer?.name || 'Walk-in Customer'} ${order.customer?.code ? `[${order.customer.code}]` : ''}`);
  addBytes(COMMANDS.BOLD_OFF);
  if (order.customer?.companyName) {
    addLine(`Shop: ${order.customer.companyName}`);
  }
  if (order.customer?.deliveryAddress || order.customer?.city) {
    addLine(`Addr: ${order.customer.deliveryAddress || order.customer.city}`);
  }
  if (order.customer?.phone) {
    addLine(`Phone: ${order.customer.phone}`);
  }
  addLine(dividerLine('-'));

  // 5. Line Items Header
  addBytes(COMMANDS.BOLD_ON);
  addLine(padTwoColumns('ITEM DESCRIPTION', 'TOTAL'));
  addLine(padTwoColumns(' QTY x PRICE', ''));
  addBytes(COMMANDS.BOLD_OFF);
  addLine(dividerLine('-'));

  // 6. Items
  let totalFreeQty = 0;
  (order.items || []).forEach((item) => {
    // Line 1: Item Name (truncated if exceeds width)
    const nameStr = (item.product?.name || 'Item').slice(0, RECEIPT_WIDTH);
    addLine(nameStr);

    // Line 2: Qty x UnitPrice and Line Total
    const qtyPrice = `  ${item.quantity} ${item.product?.unit || 'pcs'} x Rs.${item.unitPrice.toFixed(2)}`;
    const lineTot = `Rs.${item.lineTotal.toFixed(2)}`;
    addLine(padTwoColumns(qtyPrice, lineTot));

    // Item Discount line
    if (item.discountAmount && item.discountAmount > 0) {
      const discPercentStr = item.discountPercent && item.discountPercent > 0 ? ` (${item.discountPercent.toFixed(1)}%)` : '';
      addLine(`  >> ITEM DISC${discPercentStr}: -Rs.${item.discountAmount.toFixed(2)}`);
    }

    // Promotional Free Issue line
    if (item.freeQuantity && item.freeQuantity > 0) {
      totalFreeQty += item.freeQuantity;
      addBytes(COMMANDS.BOLD_ON);
      addLine(`  >> FREE PROMO: +${item.freeQuantity} ${item.product?.unit || 'pcs'} (Rs.0.00)`);
      addBytes(COMMANDS.BOLD_OFF);
    }
  });

  // Returned Goods Section
  if (order.returns && order.returns.length > 0) {
    addLine(dividerLine('-'));
    addBytes(COMMANDS.BOLD_ON);
    addLine(padTwoColumns('RETURNED / DAMAGED GOODS', 'CREDIT'));
    addBytes(COMMANDS.BOLD_OFF);
    addLine(dividerLine('-'));
    order.returns.forEach(ret => {
      const tag = ret.returnType === 'DAMAGE' ? '[DMG]' : '[RET]';
      addLine(`${tag} ${(ret.product?.name || 'Item').slice(0, RECEIPT_WIDTH - 6)}`);
      const lineDeduct = `  ${ret.quantity} pcs x Rs.${ret.unitPrice.toFixed(2)}`;
      const retTot = `-Rs.${ret.total.toFixed(2)}`;
      addLine(padTwoColumns(lineDeduct, retTot));
    });
  }

  addLine(dividerLine('-'));

  // 7. Totals & Payment Breakdown
  addLine(padTwoColumns('Subtotal:', `Rs.${order.subtotal.toFixed(2)}`));

  if (totalFreeQty > 0) {
    addLine(padTwoColumns('Promotional Units:', `${totalFreeQty} Free pcs`));
  }

  if (order.discountAmount > 0) {
    addLine(padTwoColumns('Discount:', `-Rs.${order.discountAmount.toFixed(2)}`));
  }

  if (order.returnAmount && order.returnAmount > 0) {
    addLine(padTwoColumns('Return Deductions:', `-Rs.${order.returnAmount.toFixed(2)}`));
  }

  if (order.appliedCreditAmount && order.appliedCreditAmount > 0) {
    addLine(padTwoColumns('Prior Return Credit Applied:', `-Rs.${order.appliedCreditAmount.toFixed(2)}`));
  }

  if (order.customer?.returnCreditBalance && order.customer.returnCreditBalance > 0) {
    addLine(padTwoColumns('Next Bill Credit Balance:', `Rs.${order.customer.returnCreditBalance.toFixed(2)}`));
  }

  addLine(dividerLine('='));
  addBytes(COMMANDS.BOLD_ON);
  addBytes(COMMANDS.DOUBLE_HEIGHT);
  addLine(padTwoColumns('NET TOTAL:', `Rs.${order.netTotal.toFixed(2)}`));
  addBytes(COMMANDS.NORMAL_SIZE);
  addBytes(COMMANDS.BOLD_OFF);
  addLine(dividerLine('='));

  addLine(padTwoColumns('Payment Method:', `${order.paymentMethod || 'CASH'}`));
  const cashRec = order.cashReceived || 0;
  addLine(padTwoColumns('Amount Paid:', `Rs.${cashRec.toFixed(2)}`));

  const balance = order.netTotal - cashRec;
  if (balance > 0) {
    addBytes(COMMANDS.BOLD_ON);
    addLine(padTwoColumns('Credit Balance Due:', `Rs.${balance.toFixed(2)}`));
    addBytes(COMMANDS.BOLD_OFF);
  } else if (cashRec > order.netTotal) {
    addLine(padTwoColumns('Change Returned:', `Rs.${(cashRec - order.netTotal).toFixed(2)}`));
  }

  if (order.notes) {
    addLine(dividerLine('-'));
    addLine(`Notes: ${order.notes}`);
  }

  // 8. Footer Notice / Policy
  addLine(dividerLine('-'));
  addBytes(COMMANDS.ALIGN_CENTER);
  if (settings?.invoiceFooterNote) {
    addLine(settings.invoiceFooterNote);
  } else {
    addLine('Goods received in satisfactory condition.');
    addLine('Thank you for your business!');
  }

  // 9. Signatures Tear-off
  addBytes(COMMANDS.ALIGN_LEFT);
  addLine('');
  addLine(padTwoColumns('Delivered By (Driver):', 'Received By (Shop):'));
  addLine('');
  addLine(padTwoColumns('____________________', '____________________'));
  addLine(padTwoColumns(order.lorry?.driverName || 'Driver Sign', 'Customer Stamp / Sign'));

  // 10. Software Provider Branding
  addBytes(COMMANDS.ALIGN_CENTER);
  addLine('');
  addLine('Powered By J&co. Software Solution');
  addLine('+94 77 065 4279');

  // 11. Feed and Cut
  addLine('');
  addLine(dividerLine('.'));
  addBytes(COMMANDS.PAPER_FEED_5);
  addBytes(COMMANDS.PARTIAL_CUT);

  return new Uint8Array(chunks);
}

/**
 * Direct Print to Bluetooth Thermal Printer using Web Bluetooth API
 */
export interface RepBillsSummaryData {
  repName?: string;
  repPhone?: string;
  vehicleNumber?: string;
  routeName?: string;
  driverName?: string;
  dateStr?: string;
  filterLabel?: string;
  bills: Order[];
  summary: {
    totalBills: number;
    totalValue: number;
    totalCash: number;
    totalCredit: number;
    cashCount: number;
    creditCount: number;
    chequeCount?: number;
    totalCheque?: number;
  };
  productSummary?: {
    name: string;
    unit: string;
    quantity: number;
    freeQuantity: number;
    totalValue: number;
  }[];
}

/**
 * Build ESC/POS Byte Buffer for 80mm Rep Bills Summary Slip
 */
export function build80mmEscPosBillsSummary(
  data: RepBillsSummaryData,
  settings?: SystemSettings | null
): Uint8Array {
  const chunks: number[] = [];

  const addBytes = (bytes: number[]) => {
    for (const b of bytes) chunks.push(b);
  };

  const addText = (text: string) => {
    const encoded = encodeText(text);
    for (let i = 0; i < encoded.length; i++) {
      chunks.push(encoded[i]);
    }
  };

  const addLine = (text = '') => {
    addText(text);
    addBytes(COMMANDS.LINE_FEED);
  };

  // 1. Initialize
  addBytes(COMMANDS.INIT);

  // 2. Header
  addBytes(COMMANDS.ALIGN_CENTER);
  addBytes(COMMANDS.DOUBLE_SIZE);
  addBytes(COMMANDS.BOLD_ON);
  addLine(settings?.companyName || 'M&S Enterprises');
  addBytes(COMMANDS.NORMAL_SIZE);
  addBytes(COMMANDS.BOLD_OFF);

  addLine(settings?.address || '115/1A1, Udumulla Road, Himbutana, Angoda');
  addLine(`Tel: ${settings?.phone || '0773669913 / 0707077551'}`);
  if (settings?.registrationNumber) {
    addLine(`Reg/VAT: ${settings.registrationNumber}`);
  }

  addLine(dividerLine('='));
  addBytes(COMMANDS.BOLD_ON);
  addLine('*** SALES REP BILLS SUMMARY ***');
  addBytes(COMMANDS.BOLD_OFF);
  addLine(dividerLine('='));

  // 3. Metadata
  addBytes(COMMANDS.ALIGN_LEFT);
  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  addLine(padTwoColumns(`Date: ${dateStr} ${timeStr}`, `Bills: ${data.bills.length}`));
  addLine(padTwoColumns(`Rep: ${data.repName || 'Sales Rep'}`, `Van: ${data.vehicleNumber || 'Route Lorry'}`));
  if (data.routeName) {
    addLine(`Route: ${data.routeName}`);
  }
  if (data.driverName) {
    addLine(`Driver: ${data.driverName}`);
  }
  if (data.filterLabel && data.filterLabel !== 'ALL') {
    addLine(`Filtered By: ${data.filterLabel} BILLS ONLY`);
  }
  addLine(dividerLine('-'));

  // 4. Financial KPI Box
  addBytes(COMMANDS.BOLD_ON);
  addBytes(COMMANDS.DOUBLE_HEIGHT);
  addLine(padTwoColumns('TOTAL SALES:', `Rs.${data.summary.totalValue.toFixed(2)}`));
  addBytes(COMMANDS.NORMAL_SIZE);
  addBytes(COMMANDS.BOLD_OFF);
  addLine(dividerLine('-'));

  addLine(padTwoColumns('CASH COLLECTED:', `Rs.${data.summary.totalCash.toFixed(2)}`));
  addLine(padTwoColumns('  Cash Bills Count:', `${data.summary.cashCount} bills`));
  addLine(padTwoColumns('CREDIT GIVEN:', `Rs.${data.summary.totalCredit.toFixed(2)}`));
  addLine(padTwoColumns('  Credit Bills Count:', `${data.summary.creditCount} bills`));
  if (data.summary.totalCheque && data.summary.totalCheque > 0) {
    addLine(padTwoColumns('CHEQUES COLLECTED:', `Rs.${data.summary.totalCheque.toFixed(2)}`));
    addLine(padTwoColumns('  Cheque Bills Count:', `${data.summary.chequeCount || 0} bills`));
  }
  addLine(dividerLine('='));

  // 5. Bills Listing
  addBytes(COMMANDS.BOLD_ON);
  addLine(`*** BILLS BREAKDOWN (${data.bills.length} BILLS) ***`);
  addLine(padTwoColumns('SLIP# / TIME', 'AMOUNT'));
  addLine(padTwoColumns(' CUSTOMER [MODE]', 'STATUS / DUE'));
  addBytes(COMMANDS.BOLD_OFF);
  addLine(dividerLine('-'));

  data.bills.forEach((bill, idx) => {
    const slip = bill.paperBillNumber ? `#${bill.paperBillNumber}` : bill.orderNumber;
    const time = new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const net = `Rs.${bill.netTotal.toFixed(2)}`;
    addLine(padTwoColumns(`${idx + 1}. ${slip} (${time})`, net));

    const custName = (bill.customer?.companyName || bill.customer?.name || 'Customer').slice(0, 24);
    const creditDue = Math.max(0, bill.netTotal - (bill.cashReceived || 0));
    const statusStr =
      bill.paymentMethod === 'CASH'
        ? '[CASH] PAID'
        : bill.paymentMethod === 'CHEQUE'
        ? '[CHQ] RECORDED'
        : creditDue > 0
        ? `[CR] Due: Rs.${creditDue.toFixed(2)}`
        : '[CR] CLEARED';

    addLine(padTwoColumns(`   ${custName}`, statusStr));
  });

  addLine(dividerLine('-'));

  // 6. Product-wise aggregate units sold
  if (data.productSummary && data.productSummary.length > 0) {
    addBytes(COMMANDS.BOLD_ON);
    addLine('*** PRODUCT SALES SUMMARY ***');
    addLine(padTwoColumns('ITEM DESCRIPTION', 'QTY [FREE]'));
    addBytes(COMMANDS.BOLD_OFF);
    addLine(dividerLine('-'));

    let totalSoldUnits = 0;
    let totalFreeUnits = 0;

    data.productSummary.forEach((prod) => {
      totalSoldUnits += prod.quantity;
      totalFreeUnits += prod.freeQuantity || 0;
      const name = prod.name.slice(0, 26);
      const qtyStr = `${prod.quantity} ${prod.unit || 'pcs'}${
        prod.freeQuantity ? ` (+${prod.freeQuantity}F)` : ''
      }`;
      addLine(padTwoColumns(name, qtyStr));
      addLine(padTwoColumns(`   Total Value:`, `Rs.${prod.totalValue.toFixed(2)}`));
    });

    addLine(dividerLine('-'));
    addBytes(COMMANDS.BOLD_ON);
    addLine(
      padTwoColumns(
        'TOTAL UNITS SOLD:',
        `${totalSoldUnits} pcs${totalFreeUnits > 0 ? ` (+${totalFreeUnits} Free)` : ''}`
      )
    );
    addBytes(COMMANDS.BOLD_OFF);
    addLine(dividerLine('='));
  }

  // 7. Signatures
  addLine('');
  addBytes(COMMANDS.ALIGN_LEFT);
  addLine(padTwoColumns('Rep Signature:', 'Supervisor / Cashier:'));
  addLine('');
  addLine(padTwoColumns('____________________', '____________________'));
  addLine(padTwoColumns(data.repName || 'Sales Rep', 'Store / Cash Office'));
  addLine('');

  // 8. Footer Notice
  addBytes(COMMANDS.ALIGN_CENTER);
  addLine('*** END OF ROUTE SUMMARY ***');
  addLine('Generated from Sales Rep Billing App');
  addLine('');
  addLine('Powered By J&co. Software Solution');
  addLine('+94 77 065 4279');
  addLine(dividerLine('.'));

  // 9. Feed and Cut
  addBytes(COMMANDS.PAPER_FEED_5);
  addBytes(COMMANDS.PARTIAL_CUT);

  return new Uint8Array(chunks);
}

/**
 * Build ESC/POS Byte Buffer for 80mm Official Payment Collection Receipt
 */
export function build80mmEscPosPaymentReceipt(
  payment: CustomerPayment,
  settings?: SystemSettings | null
): Uint8Array {
  const chunks: number[] = [];
  const addBytes = (bytes: number[]) => { for (const b of bytes) chunks.push(b); };
  const addText = (text: string) => {
    const encoded = encodeText(text);
    for (let i = 0; i < encoded.length; i++) chunks.push(encoded[i]);
  };
  const addLine = (text = '') => {
    addText(text);
    addBytes(COMMANDS.LINE_FEED);
  };

  addBytes(COMMANDS.INIT);
  addBytes(COMMANDS.ALIGN_CENTER);
  addBytes(COMMANDS.DOUBLE_SIZE);
  addBytes(COMMANDS.BOLD_ON);
  addLine(settings?.companyName || 'M&S Enterprises');
  addBytes(COMMANDS.NORMAL_SIZE);
  addBytes(COMMANDS.BOLD_OFF);
  addLine(settings?.address || '115/1A1, Udumulla Road, Himbutana, Angoda');
  addLine(`Tel: ${settings?.phone || '0773669913 / 0707077551'}`);
  addLine(dividerLine('='));
  addBytes(COMMANDS.BOLD_ON);
  addLine('*** OFFICIAL PAYMENT RECEIPT ***');
  addBytes(COMMANDS.BOLD_OFF);
  addLine(dividerLine('='));

  addBytes(COMMANDS.ALIGN_LEFT);
  const dateStr = new Date(payment.createdAt).toLocaleDateString();
  const timeStr = new Date(payment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  addLine(padTwoColumns(`Date: ${dateStr} ${timeStr}`, `Receipt #: ${payment.receiptNumber}`));
  addLine(dividerLine('-'));

  addBytes(COMMANDS.BOLD_ON);
  addLine(`Customer: ${payment.customer?.name || 'Customer'} [${payment.customer?.code || ''}]`);
  addBytes(COMMANDS.BOLD_OFF);
  if (payment.customer?.companyName) {
    addLine(`Shop: ${payment.customer.companyName}`);
  }
  addLine(dividerLine('-'));

  addBytes(COMMANDS.BOLD_ON);
  addBytes(COMMANDS.DOUBLE_HEIGHT);
  addLine(padTwoColumns('AMOUNT RECEIVED:', `Rs.${payment.amount.toFixed(2)}`));
  addBytes(COMMANDS.NORMAL_SIZE);
  addBytes(COMMANDS.BOLD_OFF);
  addLine(dividerLine('='));

  addLine(padTwoColumns('Payment Mode:', payment.paymentMethod || 'CASH'));
  if (payment.paymentMethod === 'CHEQUE') {
    if (payment.chequeNumber) addLine(padTwoColumns('Cheque Number:', payment.chequeNumber));
    if (payment.bankName) addLine(padTwoColumns('Bank Name:', payment.bankName));
    if (payment.chequeDate) addLine(padTwoColumns('Cheque Date:', new Date(payment.chequeDate).toLocaleDateString()));
  }

  if (payment.notes) {
    addLine(`Remarks: ${payment.notes}`);
  }

  addLine(dividerLine('-'));
  addBytes(COMMANDS.ALIGN_CENTER);
  addLine('Thank you for your prompt settlement!');
  addLine('');
  addBytes(COMMANDS.ALIGN_LEFT);
  addLine(padTwoColumns('Collector Sign:', 'Customer Seal / Sign:'));
  addLine('');
  addLine(padTwoColumns('____________________', '____________________'));
  addLine('');
  addBytes(COMMANDS.ALIGN_CENTER);
  addLine('Powered By J&co. Software Solution');
  addLine('+94 77 065 4279');
  addLine(dividerLine('.'));
  addBytes(COMMANDS.PAPER_FEED_5);
  addBytes(COMMANDS.PARTIAL_CUT);

  return new Uint8Array(chunks);
}

/**
 * Shared helper to send ESC/POS byte array to Bluetooth printer (Android Native + Web Bluetooth)
 */
export async function sendEscPosToBluetoothDevice(
  receiptData: Uint8Array,
  onStatusChange?: (status: string) => void,
  targetAddress?: string
): Promise<{ success: boolean; message: string; needsPicker?: boolean; devices?: BluetoothDeviceInfo[] }> {
  // 1. Android Native Bluetooth SPP Printing
  if (Capacitor.isNativePlatform()) {
    try {
      onStatusChange?.('Checking Bluetooth...');
      const avail = await NativeBluetoothPrinter.isAvailable();
      if (!avail.supported) {
        return { success: false, message: 'Bluetooth hardware not detected on this device.' };
      }
      if (!avail.enabled) {
        return { success: false, message: 'Bluetooth is turned off. Please turn on Bluetooth in Android settings.' };
      }

      onStatusChange?.('Scanning paired printers...');
      const pairedRes = await NativeBluetoothPrinter.getPairedDevices();
      const devices = pairedRes.devices || [];

      if (devices.length === 0) {
        return {
          success: false,
          needsPicker: true,
          devices: [],
          message: 'No paired Bluetooth devices found. Please pair your 80mm printer in phone Bluetooth settings (PIN: 0000 or 1234).'
        };
      }

      let chosenDevice: BluetoothDeviceInfo | undefined;

      if (targetAddress) {
        chosenDevice = devices.find(d => d.address === targetAddress);
      } else {
        const last = getLastUsedPrinter();
        if (last) {
          chosenDevice = devices.find(d => d.address === last.address);
        }
        if (!chosenDevice) {
          chosenDevice = devices.find(d => d.isPrinter);
        }
        if (!chosenDevice && devices.length === 1) {
          chosenDevice = devices[0];
        }
      }

      if (!chosenDevice) {
        return {
          success: false,
          needsPicker: true,
          devices,
          message: 'Please select your Bluetooth printer from the list.'
        };
      }

      onStatusChange?.(`Connecting to ${chosenDevice.name || 'Printer'}...`);
      const base64Data = uint8ArrayToBase64(receiptData);
      const printRes = await NativeBluetoothPrinter.printBytes({
        address: chosenDevice.address,
        bytesBase64: base64Data
      });

      saveLastUsedPrinter(chosenDevice.address, chosenDevice.name);
      onStatusChange?.('Printed successfully!');
      return { success: true, message: printRes.message || `Printed to ${chosenDevice.name}!` };
    } catch (nativeErr: any) {
      console.error('Native Bluetooth print error:', nativeErr);
      return {
        success: false,
        message: nativeErr?.message || 'Bluetooth printing failed. Please check printer power and pairing.'
      };
    }
  }

  // 2. Web Browser Fallback (Chrome Web Bluetooth)
  if (!isWebBluetoothSupported()) {
    return {
      success: false,
      message: 'Web Bluetooth is not supported on this browser. Please use System Print.'
    };
  }

  try {
    onStatusChange?.('Searching for Bluetooth printer...');

    const nav = navigator as any;
    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: BLUETOOTH_PRINTER_SERVICES
    });

    if (!device) {
      return { success: false, message: 'No Bluetooth printer was selected.' };
    }

    onStatusChange?.(`Connecting to ${device.name || 'Bluetooth Printer'}...`);

    const server = await device.gatt?.connect();
    if (!server) {
      return { success: false, message: 'Could not connect to Bluetooth printer GATT server.' };
    }

    onStatusChange?.('Locating printer communication channel...');

    let writeCharacteristic: any = null;

    for (const serviceUuid of BLUETOOTH_PRINTER_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writeCharacteristic = char;
            break;
          }
        }
      } catch {
        // continue
      }
      if (writeCharacteristic) break;
    }

    if (!writeCharacteristic && server.getPrimaryServices) {
      try {
        const allServices = await server.getPrimaryServices();
        for (const s of allServices) {
          const chars = await s.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              writeCharacteristic = c;
              break;
            }
          }
          if (writeCharacteristic) break;
        }
      } catch {
        // ignore
      }
    }

    if (!writeCharacteristic) {
      throw new Error('Could not find a writable Bluetooth channel on this printer.');
    }

    onStatusChange?.('Sending data to 80mm thermal printer...');

    const CHUNK_SIZE = 100;
    for (let i = 0; i < receiptData.length; i += CHUNK_SIZE) {
      const chunk = receiptData.slice(i, i + CHUNK_SIZE);
      if (writeCharacteristic.writeValueWithoutResponse) {
        await writeCharacteristic.writeValueWithoutResponse(chunk);
      } else {
        await writeCharacteristic.writeValue(chunk);
      }
      await new Promise(r => setTimeout(r, 25));
    }

    onStatusChange?.('Printed successfully!');

    setTimeout(() => {
      try {
        device.gatt?.disconnect();
      } catch {}
    }, 1000);

    return { success: true, message: 'Receipt printed successfully to Bluetooth printer!' };
  } catch (error: any) {
    console.error('Bluetooth printing error:', error);
    if (error.name === 'NotFoundError') {
      return { success: false, message: 'Bluetooth pairing cancelled.' };
    }
    return {
      success: false,
      message: error.message || 'Failed to print via Bluetooth. Please use System Print.'
    };
  }
}

/**
 * Direct Print Single Invoice to Bluetooth Thermal Printer
 */
export async function printToBluetoothThermalPrinter(
  order: Order,
  settings?: SystemSettings | null,
  onStatusChange?: (status: string) => void,
  targetAddress?: string
): Promise<{ success: boolean; message: string; needsPicker?: boolean; devices?: BluetoothDeviceInfo[] }> {
  try {
    const receiptData = build80mmEscPosReceipt(order, settings);
    return await sendEscPosToBluetoothDevice(receiptData, onStatusChange, targetAddress);
  } catch (err: any) {
    return { success: false, message: err?.message || 'Bluetooth printing failed' };
  }
}

/**
 * Direct Print Rep's Bills Summary to Bluetooth Thermal Printer
 */
export async function printBillsSummaryToBluetooth(
  data: RepBillsSummaryData,
  settings?: SystemSettings | null,
  onStatusChange?: (status: string) => void,
  targetAddress?: string
): Promise<{ success: boolean; message: string; needsPicker?: boolean; devices?: BluetoothDeviceInfo[] }> {
  try {
    const summaryBytes = build80mmEscPosBillsSummary(data, settings);
    return await sendEscPosToBluetoothDevice(summaryBytes, onStatusChange, targetAddress);
  } catch (err: any) {
    return { success: false, message: err?.message || 'Bluetooth printing failed' };
  }
}

/**
 * Direct Print Customer Payment Collection Voucher to Bluetooth Thermal Printer
 */
export async function printPaymentReceiptToBluetooth(
  payment: CustomerPayment,
  settings?: SystemSettings | null,
  onStatusChange?: (status: string) => void,
  targetAddress?: string
): Promise<{ success: boolean; message: string; needsPicker?: boolean; devices?: BluetoothDeviceInfo[] }> {
  try {
    const receiptBytes = build80mmEscPosPaymentReceipt(payment, settings);
    return await sendEscPosToBluetoothDevice(receiptBytes, onStatusChange, targetAddress);
  } catch (err: any) {
    return { success: false, message: err?.message || 'Bluetooth printing failed' };
  }
}

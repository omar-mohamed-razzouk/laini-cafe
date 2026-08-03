import { Invoice } from "@workspace/api-client-react";
import { getSettings } from "@/lib/settings";

interface PrintReceiptProps {
  invoice: Invoice;
  sessionInfo?: {
    resourceName: string;
    type: string;
    startTime: string;
    guestCount?: number | null;
  };
  onClose: () => void;
}

export function PrintReceipt({ invoice, sessionInfo, onClose }: PrintReceiptProps) {
  const settings = getSettings();

  const handlePrint = () => {
    window.print();
  };

  const paymentMethodLabel: Record<string, string> = {
    cash: "كاش / Cash",
    card: "بطاقة / Card",
    mixed: "مختلط / Mixed",
  };

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #receipt-print-area, #receipt-print-area * { visibility: visible !important; }
          #receipt-print-area {
            position: fixed !important;
            top: 0; left: 0;
            width: 80mm;
            font-size: 12px;
            font-family: 'Courier New', monospace;
            color: #000;
            background: #fff;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex flex-col gap-4">
        {/* Screen preview */}
        <div
          id="receipt-print-area"
          className="bg-white text-black font-mono text-xs p-4 rounded-lg border border-gray-300 max-w-[320px] mx-auto w-full"
          dir="ltr"
        >
          {/* Header */}
          <div className="text-center border-b border-dashed border-gray-400 pb-3 mb-3">
            <div className="font-bold text-base">{settings.cafeName}</div>
            <div className="text-sm">{settings.cafeNameAr}</div>
            {settings.phone && <div className="text-xs">{settings.phone}</div>}
            {settings.address && <div className="text-xs">{settings.address}</div>}
          </div>

          {/* Invoice info */}
          <div className="border-b border-dashed border-gray-400 pb-3 mb-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span>Invoice #</span>
              <span className="font-bold">{invoice.id}</span>
            </div>
            <div className="flex justify-between">
              <span>Date</span>
              <span>{new Date(invoice.createdAt).toLocaleDateString("ar-SY-u-nu-latn")}</span>
            </div>
            <div className="flex justify-between">
              <span>Time</span>
              <span>{new Date(invoice.createdAt).toLocaleTimeString("ar-SY-u-nu-latn", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            {sessionInfo && (
              <>
                <div className="flex justify-between">
                  <span>Table/Room</span>
                  <span className="font-bold">{sessionInfo.resourceName}</span>
                </div>
                {sessionInfo.guestCount && (
                  <div className="flex justify-between">
                    <span>Guests</span>
                    <span>{sessionInfo.guestCount}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Start</span>
                  <span>{new Date(sessionInfo.startTime).toLocaleTimeString("ar-SY-u-nu-latn", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="flex justify-between">
                  <span>End</span>
                  <span>{new Date(invoice.createdAt).toLocaleTimeString("ar-SY-u-nu-latn", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </>
            )}
            {invoice.customerName && (
              <div className="flex justify-between">
                <span>Customer</span>
                <span>{invoice.customerName}</span>
              </div>
            )}
          </div>

          {/* Items */}
          {invoice.items && invoice.items.length > 0 && (
            <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
              <div className="font-bold mb-2 text-center">─── ITEMS ───</div>
              {(invoice.items as Array<{ description: string; quantity: number; unitPrice: number; subtotal: number }>).map((item, i) => {
                const isPerPerson = item.description.includes("لكل شخص");
                return (
                  <div key={i} className="mb-1">
                    <div className="flex justify-between">
                      <span className="flex-1 truncate">{item.description}</span>
                      <span>{item.subtotal.toLocaleString("en-US")}</span>
                    </div>
                    <div className="text-gray-500 text-[10px]">
                      {isPerPerson
                        ? `${item.quantity} أشخاص × ${item.unitPrice.toLocaleString("en-US")} لكل شخص`
                        : `${item.quantity} × ${item.unitPrice.toLocaleString("en-US")}`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Totals */}
          <div className="border-b border-dashed border-gray-400 pb-3 mb-3 space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{invoice.subtotal.toLocaleString("en-US")} SYP</span>
            </div>
            {(invoice.discountAmount ?? 0) > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Discount ({invoice.discountPercent ?? 0}%)</span>
                <span>-{(invoice.discountAmount ?? 0).toLocaleString("en-US")} SYP</span>
              </div>
            )}
            {(invoice.tax ?? 0) > 0 && (
              <div className="flex justify-between">
                <span>Tax</span>
                <span>{(invoice.tax ?? 0).toLocaleString("en-US")} SYP</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm border-t border-gray-400 pt-1 mt-1">
              <span>TOTAL</span>
              <span>{invoice.total.toLocaleString("en-US")} SYP</span>
            </div>
            <div className="flex justify-between">
              <span>Payment</span>
              <span>{paymentMethodLabel[invoice.paymentMethod] ?? invoice.paymentMethod}</span>
            </div>
            {invoice.amountPaid != null && (
              <div className="flex justify-between">
                <span>Paid</span>
                <span>{invoice.amountPaid.toLocaleString("en-US")} SYP</span>
              </div>
            )}
            {invoice.change != null && invoice.change > 0 && (
              <div className="flex justify-between font-bold">
                <span>Change</span>
                <span>{invoice.change.toLocaleString("en-US")} SYP</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-500">
            {settings.receiptFooter}
          </div>
          <div className="text-center text-[10px] text-gray-400 mt-1">
            Powered by BrewDesk
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 no-print justify-center">
          <button
            onClick={handlePrint}
            className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg font-bold text-sm hover:bg-primary/90 transition-colors"
          >
            🖨️ طباعة الفاتورة
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-muted text-foreground py-3 rounded-lg font-bold text-sm hover:bg-muted/70 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </>
  );
}

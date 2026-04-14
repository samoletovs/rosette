import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "rosette-pdf-unlocked";
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/TODO_REPLACE_WITH_REAL_LINK";

interface PaywallModalProps {
  onClose: () => void;
  onUnlocked: () => void;
}

function isUnlocked(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

function unlock(): void {
  localStorage.setItem(STORAGE_KEY, "true");
}

export function usePaywall() {
  const [showPaywall, setShowPaywall] = useState(false);
  const [unlocked, setUnlocked] = useState(isUnlocked);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "true" || params.get("session_id")) {
      unlock();
      setUnlocked(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("paid");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.pathname);
    }
  }, []);

  const requestDownload = useCallback((onDownload: () => void) => {
    if (unlocked) {
      onDownload();
    } else {
      setShowPaywall(true);
    }
  }, [unlocked]);

  const handleUnlocked = useCallback(() => {
    unlock();
    setUnlocked(true);
    setShowPaywall(false);
  }, []);

  return {
    showPaywall,
    unlocked,
    requestDownload,
    closePaywall: () => setShowPaywall(false),
    handleUnlocked,
  };
}

export function PaywallModal({ onClose, onUnlocked }: PaywallModalProps) {
  const handlePay = () => {
    const returnUrl = encodeURIComponent(window.location.origin + "?paid=true");
    const url = `${STRIPE_PAYMENT_LINK}?client_reference_id=rosette-pdf&success_url=${returnUrl}`;
    window.open(url, "_blank");
  };

  useEffect(() => {
    const handleFocus = () => {
      if (isUnlocked()) {
        onUnlocked();
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [onUnlocked]);

  return (
    <div className="paywall-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="PDF export paywall">
      <div className="paywall-modal" onClick={(e) => e.stopPropagation()}>
        <button className="paywall-close" onClick={onClose} aria-label="Close">&times;</button>

        <div className="paywall-icon">📄</div>
        <h2 className="paywall-title">Professional Electrical Plan</h2>
        <p className="paywall-desc">
          Get your complete A3 PDF with room layouts, circuit diagrams, wiring plans,
          and bill of materials — ready for your electrician.
        </p>

        <ul className="paywall-features">
          <li>✓ A3 landscape format — print-ready</li>
          <li>✓ Room-by-room socket layouts</li>
          <li>✓ Circuit diagram with breaker sizing</li>
          <li>✓ Wiring plan with cable routes</li>
          <li>✓ Bill of materials with quantities</li>
          <li>✓ Country-specific standards compliance</li>
        </ul>

        <button className="btn primary paywall-pay-btn" onClick={handlePay}>
          Pay €5 — Download PDF
        </button>

        <p className="paywall-note">
          One-time payment · Secure checkout via Stripe · Instant download after payment
        </p>
      </div>
    </div>
  );
}

import React from "react";
import { usePhonePolicy, isMaskedPhone } from "../hooks/usePhonePolicy";

interface CustomerPhoneProps {
  value?: string | null;
  /** Shown when the customer simply has no number on file. Defaults to an em dash. */
  emptyText?: string;
  className?: string;
}

/**
 * A customer's phone number, or a marker that it is deliberately withheld.
 *
 * The server already replaces the number with a placeholder word before it reaches the browser, so
 * rendering the raw value would fill a column with that word repeated on every row — which reads
 * as a data fault rather than a policy. This shows a lock instead, and says why on hover.
 *
 * Use this anywhere a customer number is displayed. Where the number is fed to something that
 * expects digits — a tel: link, a formatter, a validator — guard with isMaskedPhone() instead.
 */
export const CustomerPhone: React.FC<CustomerPhoneProps> = ({
  value,
  emptyText = "—",
  className = "",
}) => {
  const policy = usePhonePolicy();
  const raw = (value ?? "").trim();

  if (raw === "") {
    return <span className={`text-gray-400 ${className}`}>{emptyText}</span>;
  }

  if (isMaskedPhone(raw, policy)) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-gray-400 ${className}`}
        title="เบอร์ลูกค้าถูกซ่อนไว้ กดปุ่มโทรเพื่อติดต่อลูกค้า"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 1 1 8 0v4" />
        </svg>
        <span className="tabular-nums tracking-wider">••• ••• ••••</span>
      </span>
    );
  }

  return <span className={className}>{raw}</span>;
};

export default CustomerPhone;

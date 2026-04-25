"use client";

import { useState } from "react";

interface FAQItem {
  q: string;
  a: string;
}

function FAQItem({ q, a }: FAQItem) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          width: "100%", display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", gap: 20,
          padding: "1.3rem 0", background: "none", border: "none",
          cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        }}
      >
        <span style={{ fontSize: "0.93rem", fontWeight: 600, color: "var(--fg)", lineHeight: 1.45, letterSpacing: "-0.012em" }}>{q}</span>
        <span aria-hidden="true" style={{ fontSize: "1.1rem", color: "var(--fg-muted)", flexShrink: 0, marginTop: 1, lineHeight: 1, fontWeight: 300 }}>{open ? "−" : "+"}</span>
      </button>
      <div
        role="region"
        style={{ overflow: "hidden", maxHeight: open ? 400 : 0, transition: "max-height .38s ease" }}
      >
        <p style={{ fontSize: "0.87rem", color: "var(--fg-secondary)", lineHeight: 1.82, paddingBottom: "1.3rem" }}>{a}</p>
      </div>
    </div>
  );
}

export function FAQAccordion({ items }: { items: FAQItem[] }) {
  return (
    <div style={{ borderTop: "1px solid var(--border)" }}>
      {items.map((item, i) => (
        <FAQItem key={i} q={item.q} a={item.a} />
      ))}
    </div>
  );
}
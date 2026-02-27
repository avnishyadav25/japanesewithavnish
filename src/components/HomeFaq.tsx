"use client";

import { useState } from "react";

interface FaqItem {
  q: string;
  a: string;
}

export function HomeFaq({ items }: { items: FaqItem[] | null }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!items?.length) return null;

  return (
    <div className="card p-5">
      <h2 className="font-heading text-2xl font-bold text-charcoal mb-6">FAQ</h2>
      <div className="divide-y divide-[#EEEEEE]">
        {items.map((item, i) => (
          <div
            key={i}
            className="py-4 first:pt-0 cursor-pointer min-h-[52px] flex flex-col justify-center"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
          >
            <div className="flex justify-between items-start gap-4">
              <h3 className="font-bold text-charcoal text-[15px]">{item.q}</h3>
              <span className="text-secondary text-lg shrink-0">
                {openIndex === i ? "−" : "+"}
              </span>
            </div>
            {openIndex === i && (
              <p className="text-secondary text-[14px] mt-3 leading-relaxed">{item.a}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

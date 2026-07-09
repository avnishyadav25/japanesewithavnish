"use client";

import { useState } from "react";
import { CheckoutDrawer } from "@/components/checkout/CheckoutDrawer";

type Plan = {
  id: string;
  name: string;
  slug: string;
  billing_type: "monthly" | "yearly" | "lifetime";
  price_inr: number;
  price_usd: number;
  features: string[];
  is_popular: boolean;
};

export function HomePricingSection({ plans, defaultCurrency = "INR" }: { plans: Plan[]; defaultCurrency?: "INR" | "USD" }) {
  const [currency, setCurrency] = useState<"INR" | "USD">(defaultCurrency);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setIsDrawerOpen(true);
  };

  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 bg-[#FAF8F5] border-t border-[var(--divider)]">
      <div className="max-w-5xl mx-auto space-y-12">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-[10px] font-bold tracking-widest text-[#D0021B] uppercase bg-[#FFF7F7] px-3 py-1 rounded-full border border-[#D0021B]/10">
            Premium Access Pass
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-charcoal">
            Simple, Transparent Pricing Pass
          </h2>
          <p className="text-secondary text-sm">
            Unlock all curriculum levels, vocabulary guides, grammar pathways, streaks, and badges with a premium pass.
          </p>
        </div>

        {/* Currency Selector */}
        <div className="flex justify-center">
          <div className="bg-white border border-[var(--divider)] p-1 rounded-full flex gap-1 shadow-sm">
            <button
              type="button"
              onClick={() => setCurrency("INR")}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                currency === "INR"
                  ? "bg-[#D0021B] text-white shadow-sm"
                  : "text-secondary hover:text-charcoal"
              }`}
            >
              🇮🇳 India (INR)
            </button>
            <button
              type="button"
              onClick={() => setCurrency("USD")}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                currency === "USD"
                  ? "bg-[#D0021B] text-white shadow-sm"
                  : "text-secondary hover:text-charcoal"
              }`}
            >
              🌐 Global (USD)
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid md:grid-cols-3 gap-6 items-stretch pt-4">
          {plans.map((plan) => {
            const formattedPrice =
              currency === "USD"
                ? `$${(plan.price_usd / 100).toFixed(2)}`
                : `₹${(plan.price_inr / 100).toLocaleString("en-IN")}`;

            const periodLabel =
              plan.billing_type === "monthly"
                ? " 30-day access"
                : plan.billing_type === "yearly"
                ? " 365-day access"
                : " lifetime access";

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col justify-between bg-white border rounded-3xl p-6 shadow-sm transition-all hover:shadow-md duration-300 ${
                  plan.is_popular
                    ? "border-[#D0021B] ring-2 ring-[#D0021B]/15 scale-102 z-10"
                    : "border-[var(--divider)]"
                }`}
              >
                {plan.is_popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#D0021B] text-white text-[9px] uppercase font-black tracking-widest px-3 py-1 rounded-full shadow-sm">
                    Most Popular
                  </span>
                )}

                <div className="space-y-4">
                  {/* Pass Category & Price */}
                  <div>
                    <h3 className="font-heading text-sm font-black text-charcoal">{plan.name}</h3>
                    <div className="flex items-baseline mt-2">
                      <span className="text-2xl sm:text-3xl font-black text-charcoal">{formattedPrice}</span>
                      <span className="text-secondary text-[11px] ml-1.5 font-bold">{periodLabel}</span>
                    </div>
                  </div>

                  <hr className="border-[var(--divider)]" />

                  {/* Standard features checklist */}
                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start text-xs text-secondary">
                        <span className="text-[#D0021B] mr-2 font-bold">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6">
                  <button
                    type="button"
                    onClick={() => handleSelectPlan(plan)}
                    className={`w-full py-3 px-4 font-bold rounded-2xl transition duration-200 text-xs text-center ${
                      plan.is_popular
                        ? "bg-[#D0021B] text-white hover:bg-[#D0021B]/95 shadow-sm"
                        : "bg-[#FAF8F5] text-charcoal hover:bg-[var(--divider)] border border-[var(--divider)]"
                    }`}
                  >
                    Unlock Premium Pass
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Fixed-duration access prop bar */}
        <div className="bg-white border border-[var(--divider)] rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left space-y-1">
            <h4 className="font-heading text-xs font-bold text-charcoal">One-Time Fixed-Duration Access</h4>
            <p className="text-secondary text-[11px]">
              Monthly and Yearly passes are one-time purchases for 30-day and 365-day access. No automatic renewal.
            </p>
          </div>
          <div className="flex flex-col gap-0.5 items-center shrink-0">
            <span className="text-[10px] text-secondary font-bold">Secured by</span>
            <span className="text-xs font-black tracking-widest text-[#D0021B] uppercase">
              {currency === "USD" ? "STRIPE" : "RAZORPAY"}
            </span>
          </div>
        </div>

      </div>

      {selectedPlan && (
        <CheckoutDrawer
          open={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          product={{
            id: selectedPlan.slug,
            name: selectedPlan.name,
            slug: selectedPlan.slug,
            price_paise: currency === "USD" ? selectedPlan.price_usd : selectedPlan.price_inr,
          }}
          currency={currency}
          isPlan
        />
      )}
    </section>
  );
}

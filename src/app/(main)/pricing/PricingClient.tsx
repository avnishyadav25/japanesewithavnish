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

export function PricingClient({ plans, defaultCurrency = "INR" }: { plans: Plan[]; defaultCurrency?: "INR" | "USD" }) {
  const [currency, setCurrency] = useState<"INR" | "USD">(defaultCurrency);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setIsDrawerOpen(true);
  };

  return (
    <div className="min-h-screen bg-[var(--base)] py-20 px-4 sm:px-6 lg:px-8 japanese-wave-bg">
      <div className="max-w-5xl mx-auto space-y-16">
        
        {/* Hero Header */}
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <span className="px-4 py-1.5 bg-[#D0021B]/10 text-[#D0021B] font-bold text-xs uppercase tracking-widest rounded-full">
            Premium Access Pass
          </span>
          <h1 className="font-heading text-4xl sm:text-5xl font-black text-charcoal tracking-tight">
            Unlock Unlimited Japanese Learning
          </h1>
          <p className="text-secondary text-base sm:text-lg leading-relaxed">
            Start free for life with 2 lessons free every day, so you can keep learning Japanese consistently.
          </p>
        </div>

        <div className="bg-white border border-[var(--divider)] rounded-3xl p-6 sm:p-8 shadow-card">
          <div className="grid gap-5 md:grid-cols-[1.2fr_0.8fr] md:items-center">
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-widest text-[#D0021B]">
                Free for life
              </p>
              <h2 className="font-heading text-2xl font-black text-charcoal">
                Learn Japanese every day without paying
              </h2>
              <p className="text-secondary text-sm leading-relaxed font-black">
                Free users can access 2 lessons daily. Premium Pass is only for learners who want unlimited daily lesson access.
              </p>
            </div>
            <div className="rounded-2xl bg-[#FFF7F7] border border-[#D0021B]/15 p-5">
              <ul className="space-y-3 text-sm text-secondary">
                <li className="flex gap-2">
                  <span className="font-bold text-[#D0021B]">✓</span>
                  <span>2 free lessons every day</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-[#D0021B]">✓</span>
                  <span>Resets every day at midnight IST</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-[#D0021B]">✓</span>
                  <span>Premium unlocks unlimited daily lesson access</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Currency Toggle Switcher */}
        <div className="flex justify-center">
          <div className="bg-white border border-[var(--divider)] p-1.5 rounded-full flex gap-1 shadow-sm">
            <button
              type="button"
              onClick={() => setCurrency("INR")}
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all duration-200 ${
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
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all duration-200 ${
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
        <div className="grid md:grid-cols-3 gap-8 items-stretch">
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
                className={`relative flex flex-col justify-between bg-white border rounded-3xl p-8 shadow-card transition-all hover:shadow-hover duration-300 ${
                  plan.is_popular
                    ? "border-[#D0021B] ring-2 ring-[#D0021B]/20 scale-105 md:scale-105 z-10"
                    : "border-[var(--divider)]"
                }`}
              >
                {plan.is_popular && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#D0021B] text-white text-[10px] uppercase font-black tracking-widest px-4 py-1 rounded-full shadow-sm">
                    Most Popular
                  </span>
                )}

                <div className="space-y-6">
                  {/* Title & Price */}
                  <div className="space-y-2">
                    <h3 className="font-heading text-lg font-bold text-charcoal">{plan.name}</h3>
                    <div className="flex items-baseline">
                      <span className="text-3xl sm:text-4xl font-black text-charcoal">{formattedPrice}</span>
                      <span className="text-secondary text-sm ml-1.5 font-semibold">{periodLabel}</span>
                    </div>
                  </div>

                  <hr className="border-[var(--divider)]" />

                  {/* Features List */}
                  <ul className="space-y-4">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start text-sm text-secondary">
                        <span className="text-[#D0021B] mr-2.5 font-bold mt-0.5">✓</span>
                        <span className="leading-snug">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-8">
                  <button
                    type="button"
                    onClick={() => handleSelectPlan(plan)}
                    className={`w-full py-3 px-4 font-bold rounded-2xl transition duration-200 text-sm text-center ${
                      plan.is_popular
                        ? "bg-[#D0021B] text-white hover:bg-[#D0021B]/95 shadow-md"
                        : "bg-[#FAF8F5] text-charcoal hover:bg-[var(--divider)] border border-[var(--divider)]"
                    }`}
                  >
                    Get Started
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Value Prop banner */}
        <div className="bg-[#FAF8F5] border border-[var(--divider)] rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h4 className="font-heading text-lg font-bold text-charcoal">
              {currency === "USD" ? "International Payments via Razorpay" : "One-Time Fixed-Duration Access"}
            </h4>
            <p className="text-secondary text-sm leading-relaxed max-w-xl">
              {currency === "USD"
                ? "Global Premium Passes are one-time purchases through Razorpay international checkout. PayPal may appear when enabled for your account."
                : "Monthly and Yearly passes are one-time purchases for 30-day and 365-day access. No automatic renewal or cancellation workflow needed."}
            </p>
          </div>
          <div className="flex flex-col gap-1 items-center shrink-0">
            <span className="text-xs text-secondary">Secured by</span>
            <span className="text-sm font-black tracking-widest text-[#D0021B] uppercase">
              RAZORPAY
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
    </div>
  );
}

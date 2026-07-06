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
            Choose a premium pass to bypass daily lesson limits, access advanced mock exams, and build your daily routine tools.
          </p>
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
                ? "/ month"
                : plan.billing_type === "yearly"
                ? "/ year"
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
            <h4 className="font-heading text-lg font-bold text-charcoal">7-Day Free Trial Available</h4>
            <p className="text-secondary text-sm leading-relaxed max-w-xl">
              Monthly and Yearly plans include a 7-day free trial. Try all tools and lessons complete with practice quizzes, streaks, and scoreboards risk-free.
            </p>
          </div>
          <div className="flex flex-col gap-1 items-center shrink-0">
            <span className="text-xs text-secondary">Secured by</span>
            <span className="text-sm font-black tracking-widest text-[#D0021B] uppercase">
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
    </div>
  );
}

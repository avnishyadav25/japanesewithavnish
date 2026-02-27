import Link from "next/link";
import { SEVEN_DAY_PLANS } from "@/data/start-here-plans";
import type { JLPTLevel } from "@/data/jlpt-levels";

interface JLPTSevenDayPlanProps {
  level: JLPTLevel;
}

export function JLPTSevenDayPlan({ level }: JLPTSevenDayPlanProps) {
  const planLevel = level === "mega" ? "n5" : level;
  const steps = SEVEN_DAY_PLANS[planLevel] || SEVEN_DAY_PLANS.n5;
  const levelLabel = level === "mega" ? "Mega" : level.toUpperCase();

  return (
    <div className="card p-5 bg-white">
      <h3 className="font-heading font-bold text-charcoal mb-3">
        Your 7-day starter plan ({levelLabel})
      </h3>
      <ul className="space-y-1.5 text-secondary text-sm mb-4">
        {steps.map((step, i) => (
          <li key={i}>• {step}</li>
        ))}
      </ul>
      <Link href="/quiz" className="text-primary text-sm font-medium hover:underline">
        Not sure? Take the quiz →
      </Link>
    </div>
  );
}

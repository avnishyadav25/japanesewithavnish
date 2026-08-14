import Link from "next/link";
import { OrderResendForm } from "./OrderResendForm";

export const metadata = {
  title: "Resend order confirmation | Japanese with Avnish",
  description: "Request a new order confirmation email if you didn’t receive it.",
};

export default function OrderResendPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">Resend order confirmation</h1>
      <p className="text-secondary text-sm mb-6">
        Enter your order ID and the email you used at checkout. We’ll send the confirmation email again (max once every 15 minutes).
      </p>
      <OrderResendForm />
      <p className="mt-6 text-sm text-secondary">
        <Link href="/" className="text-primary hover:underline">Back to home</Link>
      </p>
    </div>
  );
}

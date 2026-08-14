import Link from "next/link";

export default function PaymentPendingPage() {
  return (
    <div className="bg-[#FAF8F5] py-12 sm:py-20 px-4 sm:px-6">
      <div className="max-w-[800px] mx-auto">
        <div className="card p-8 sm:p-12 text-center">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-charcoal mb-4">
            Payment pending
          </h1>
          <p className="text-secondary mb-4">
            If you completed the payment, it may take a minute to confirm.
          </p>
          <p className="text-secondary mb-8">
            You can check your library now, or try the payment again if you
            closed the Razorpay window.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link href="/library" className="btn-secondary">
              Go to Store
            </Link>
            <Link href="/store" className="btn-primary">
              Back to Store
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


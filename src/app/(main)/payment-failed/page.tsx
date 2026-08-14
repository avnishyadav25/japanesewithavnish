import Link from "next/link";

export default function PaymentFailedPage() {
  return (
    <div className="bg-[#FAF8F5] py-12 sm:py-20 px-4 sm:px-6">
      <div className="max-w-[800px] mx-auto">
        <div className="card p-8 sm:p-12 text-center">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-charcoal mb-4">
            Payment failed or cancelled
          </h1>
          <p className="text-secondary mb-4">
            Your payment didn&apos;t go through or was cancelled before completion.
          </p>
          <p className="text-secondary mb-8">
            You can try the payment again from the store page or contact support
            using the email on the site if you&apos;re not sure what happened.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link href="/store" className="btn-primary">
              Try payment again
            </Link>
            <Link href="/learn" className="btn-secondary">
              Continue learning
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


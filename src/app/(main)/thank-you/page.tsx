import { ThankYouContent } from "./ThankYouContent";

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const params = await searchParams;
  const orderId = typeof params?.order === "string" ? params.order : undefined;

  return (
    <div className="bg-[#FAF8F5] py-12 sm:py-20 px-4 sm:px-6">
      <div className="max-w-[1100px] mx-auto">
        <ThankYouContent orderId={orderId} />
      </div>
    </div>
  );
}

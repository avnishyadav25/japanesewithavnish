import { redirect } from "next/navigation";

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  await searchParams;
  redirect("/learn/dashboard?payment=success");
}

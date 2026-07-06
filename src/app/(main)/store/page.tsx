import { redirect } from "next/navigation";

export default function StorePage() {
  redirect("/");
}
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { LibraryContent } from "./LibraryContent";

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/login?redirect=/library");
  }

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-10">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-2">My Library</h1>
          <p className="text-secondary">Your purchased bundles. Download your materials below.</p>
        </div>
        <LibraryContent userEmail={user.email} />
        <p className="text-secondary text-sm mt-8">
          <Link href="/" className="hover:text-primary">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}

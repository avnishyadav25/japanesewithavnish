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
    <div className="py-16 px-4 sm:px-6">
      <div className="max-w-[1100px] mx-auto">
        <h1 className="text-3xl font-bold text-charcoal mb-4">My Library</h1>
        <p className="text-secondary mb-8">
          Your purchased bundles. Download your materials below.
        </p>
        <LibraryContent userEmail={user.email} />
        <p className="text-secondary text-sm mt-8">
          <Link href="/" className="hover:text-primary">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}

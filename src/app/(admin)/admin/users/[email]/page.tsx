"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { SendEmailPanel } from "@/components/admin/SendEmailPanel";
import { UserActivityTrace } from "@/components/admin/UserActivityTrace";

type UserDetail = {
  email: string;
  recommended_level: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean | null;
  role: string | null;
  last_login_at: string | null;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  xp: number;
  points: number;
  premium_until: string | null;
  is_lifetime: boolean;
  subscription_status: string | null;
  trial_ends_at: string | null;
  email_verified_at: string | null;
  verification_sent_at: string | null;
  learned_count: number;
  is_test_user: boolean;
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const emailParam = params?.email;
  const email = emailParam ? decodeURIComponent(emailParam as string) : "";

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [msg, setMsg] = useState("");

  // Input States
  const [xpInput, setXpInput] = useState("");
  const [pointsInput, setPointsInput] = useState("");
  const [badgeSlugInput, setBadgeSlugInput] = useState("");

  const fetchUser = () => {
    setLoading(true);
    fetch(`/api/admin/students/${encodeURIComponent(email)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load user profile");
        return r.json();
      })
      .then(setUser)
      .catch((e) => setMsg(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (email) fetchUser();
  }, [email]);

  const handleUpdate = async (fields: Record<string, any>) => {
    setUpdating(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/students/${encodeURIComponent(email)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      fetchUser();
      setMsg("✅ Action processed successfully!");
    } catch (err: any) {
      setMsg(`❌ Error: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleResendVerification = async () => {
    setUpdating(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/students/${encodeURIComponent(email)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resend_verification: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to send verification email");
      setMsg(data.alreadyVerified ? "Email is already verified." : "Verification email sent to user.");
      fetchUser();
    } catch (err: any) {
      setMsg(`Error: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleSuspendToggle = () => {
    if (!user) return;
    const nextActive = !user.is_active;
    if (nextActive) {
      handleUpdate({ is_active: true });
    } else {
      if (confirm(`Are you sure you want to suspend user "${email}"?`)) {
        handleUpdate({ is_active: false });
      }
    }
  };

  const handleResetProgress = () => {
    if (confirm("⚠️ WARNING: This will permanently delete ALL lesson progress, reviews, XP, points, and badges for this user. This cannot be undone! Are you sure?")) {
      handleUpdate({ reset_progress: true });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
        <p className="text-secondary text-sm">Loading profile details...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF8F5] p-6 text-center">
        <h2 className="font-heading font-black text-xl text-charcoal mb-2">User Profile Not Found</h2>
        <p className="text-secondary text-sm mb-4">No profile matches details for: {email}</p>
        <button onClick={() => router.push("/admin/users")} className="btn-primary">
          Back to Users
        </button>
      </div>
    );
  }

  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.display_name || "—";
  const now = new Date();
  const isPremiumUser = user.is_lifetime || (user.premium_until && new Date(user.premium_until) > now);
  const isTrialUser = !isPremiumUser && user.subscription_status === "trialing";

  return (
    <div className="space-y-6 page-enter pb-12">
      <AdminPageHeader
        title={name !== "—" ? name : email}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Users", href: "/admin/users" },
          { label: email },
        ]}
      />

      {msg && (
        <div className="p-4 bg-white border border-[var(--divider)] rounded-2xl text-xs font-semibold shadow-sm">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: User stats & info cards */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Section 1: Profile card */}
          <AdminCard>
            <h3 className="font-heading font-bold text-charcoal text-sm mb-4">Profile Credentials</h3>
            <dl className="grid grid-cols-2 gap-y-3 gap-x-6 text-xs">
              <div>
                <dt className="text-secondary font-bold uppercase text-[9px] tracking-wider">Email</dt>
                <dd className="text-charcoal font-medium mt-1">{user.email}</dd>
              </div>
              <div>
                <dt className="text-secondary font-bold uppercase text-[9px] tracking-wider">Display Name</dt>
                <dd className="text-charcoal font-medium mt-1">{user.display_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-secondary font-bold uppercase text-[9px] tracking-wider">First Name</dt>
                <dd className="text-charcoal font-medium mt-1">{user.first_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-secondary font-bold uppercase text-[9px] tracking-wider">Last Name</dt>
                <dd className="text-charcoal font-medium mt-1">{user.last_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-secondary font-bold uppercase text-[9px] tracking-wider">Account Role</dt>
                <dd className="text-primary font-bold mt-1 uppercase text-[10px]">{user.role || "student"}</dd>
              </div>
              <div>
                <dt className="text-secondary font-bold uppercase text-[9px] tracking-wider">Last Login</dt>
                <dd className="text-charcoal mt-1">{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "—"}</dd>
              </div>
              <div>
                <dt className="text-secondary font-bold uppercase text-[9px] tracking-wider">Email Verification</dt>
                <dd className={`mt-1 font-semibold ${user.email_verified_at ? "text-green-700" : "text-primary"}`}>
                  {user.email_verified_at ? `Verified ${new Date(user.email_verified_at).toLocaleDateString()}` : "Not verified"}
                </dd>
              </div>
              <div>
                <dt className="text-secondary font-bold uppercase text-[9px] tracking-wider">Verification Sent</dt>
                <dd className="text-charcoal mt-1">{user.verification_sent_at ? new Date(user.verification_sent_at).toLocaleString() : "—"}</dd>
              </div>
            </dl>
          </AdminCard>

          {/* Section 2: Premium status card */}
          <AdminCard>
            <h3 className="font-heading font-bold text-charcoal text-sm mb-4">Entitlements & Subscription Tiers</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="border border-[var(--divider)] rounded-2xl p-4 bg-[var(--base)]">
                <span className="text-[10px] text-secondary font-bold uppercase block">Current Pass Status</span>
                <span className="text-sm font-black text-charcoal mt-1.5 block">
                  {isPremiumUser ? (
                    <span className="text-[#C8A35F] font-bold">★ Premium</span>
                  ) : isTrialUser ? (
                    <span className="text-[#C8A35F] font-bold">Trial Mode</span>
                  ) : (
                    <span className="text-secondary font-medium">Free Plan</span>
                  )}
                </span>
              </div>
              <div className="border border-[var(--divider)] rounded-2xl p-4 bg-[var(--base)]">
                <span className="text-[10px] text-secondary font-bold uppercase block">Premium Until</span>
                <span className="text-xs font-semibold text-charcoal mt-2 block">
                  {user.is_lifetime ? "♾️ Lifetime" : user.premium_until ? new Date(user.premium_until).toLocaleDateString() : "Not Subscribed"}
                </span>
              </div>
              <div className="border border-[var(--divider)] rounded-2xl p-4 bg-[var(--base)]">
                <span className="text-[10px] text-secondary font-bold uppercase block">Trial Ends At</span>
                <span className="text-xs font-semibold text-charcoal mt-2 block">
                  {user.trial_ends_at ? new Date(user.trial_ends_at).toLocaleDateString() : "—"}
                </span>
              </div>
            </div>
          </AdminCard>

          {/* Section 3: Progress & Gamification */}
          <AdminCard>
            <h3 className="font-heading font-bold text-charcoal text-sm mb-4">Learning Progress & Gamification</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="border border-[var(--divider)] rounded-2xl p-3">
                <span className="text-[9px] text-secondary font-bold uppercase block">Active Level</span>
                <span className="text-lg font-black text-charcoal mt-1 block">{user.recommended_level || "—"}</span>
              </div>
              <div className="border border-[var(--divider)] rounded-2xl p-3">
                <span className="text-[9px] text-secondary font-bold uppercase block">Streak Days</span>
                <span className="text-lg font-black text-charcoal mt-1 block">🔥 {user.current_streak}</span>
              </div>
              <div className="border border-[var(--divider)] rounded-2xl p-3">
                <span className="text-[9px] text-secondary font-bold uppercase block">Lessons Completed</span>
                <span className="text-lg font-black text-charcoal mt-1 block">{user.learned_count}</span>
              </div>
              <div className="border border-[var(--divider)] rounded-2xl p-3">
                <span className="text-[9px] text-secondary font-bold uppercase block">XP / Points</span>
                <span className="text-lg font-black text-primary mt-1 block">{user.xp} / {user.points}</span>
              </div>
            </div>
          </AdminCard>

          {/* Section 4: Send email */}
          <AdminCard>
            <h3 className="font-heading font-bold text-charcoal text-sm mb-4">Send Email</h3>
            <SendEmailPanel email={email} />
          </AdminCard>

          {/* Section 5: Activity trace */}
          <AdminCard>
            <h3 className="font-heading font-bold text-charcoal text-sm mb-4">Activity Trace</h3>
            <UserActivityTrace email={email} />
          </AdminCard>

        </div>

        {/* Right Column: Admin Actions Drawer */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Admin controls */}
          <AdminCard>
            <h3 className="font-heading font-bold text-charcoal text-sm mb-4">Administrative Controls</h3>
            <div className="space-y-4">
              
              {/* Premium Access Grants */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase text-secondary">Premium Pass Grant</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleUpdate({ is_lifetime: true })}
                    disabled={updating}
                    className="py-2 border border-[var(--divider)] hover:border-primary text-charcoal rounded-xl text-xs font-semibold transition"
                  >
                    Grant Lifetime
                  </button>
                  <button
                    onClick={() => {
                      const nextDate = new Date();
                      nextDate.setDate(nextDate.getDate() + 30);
                      handleUpdate({ premium_until: nextDate.toISOString(), is_lifetime: false });
                    }}
                    disabled={updating}
                    className="py-2 border border-[var(--divider)] hover:border-primary text-charcoal rounded-xl text-xs font-semibold transition"
                  >
                    Grant 30 Days
                  </button>
                </div>
                {isPremiumUser && (
                  <button
                    onClick={() => handleUpdate({ premium_until: null, is_lifetime: false })}
                    disabled={updating}
                    className="w-full py-2 bg-primary/10 border border-primary/20 hover:bg-primary/15 text-primary rounded-xl text-xs font-semibold transition"
                  >
                    Revoke Premium Access
                  </button>
                )}
              </div>

              {/* Adjust Gamification values */}
              <div className="border-t border-[var(--divider)] pt-4 space-y-3">
                <label className="block text-[10px] font-bold uppercase text-secondary">Adjust Rewards Balances</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      placeholder="XP value"
                      value={xpInput}
                      onChange={(e) => setXpInput(e.target.value)}
                      className="w-full h-9 px-3 border border-[var(--divider)] rounded-xl text-xs focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (!xpInput) return;
                      handleUpdate({ xp: Number(xpInput) });
                      setXpInput("");
                    }}
                    disabled={updating}
                    className="h-9 px-3 bg-charcoal text-white rounded-xl text-xs font-bold font-heading"
                  >
                    Set XP
                  </button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      placeholder="Points value"
                      value={pointsInput}
                      onChange={(e) => setPointsInput(e.target.value)}
                      className="w-full h-9 px-3 border border-[var(--divider)] rounded-xl text-xs focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (!pointsInput) return;
                      handleUpdate({ points: Number(pointsInput) });
                      setPointsInput("");
                    }}
                    disabled={updating}
                    className="h-9 px-3 bg-charcoal text-white rounded-xl text-xs font-bold font-heading"
                  >
                    Set Pts
                  </button>
                </div>
              </div>

              {/* Award Badges manually */}
              <div className="border-t border-[var(--divider)] pt-4 space-y-2">
                <label className="block text-[10px] font-bold uppercase text-secondary">Award Badge Achievement</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. n5-starter"
                    value={badgeSlugInput}
                    onChange={(e) => setBadgeSlugInput(e.target.value)}
                    className="flex-1 h-9 px-3 border border-[var(--divider)] rounded-xl text-xs focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      if (!badgeSlugInput) return;
                      handleUpdate({ award_badge_slug: badgeSlugInput });
                      setBadgeSlugInput("");
                    }}
                    disabled={updating}
                    className="h-9 px-3 bg-charcoal text-white rounded-xl text-xs font-bold font-heading"
                  >
                    Award Badge
                  </button>
                </div>
              </div>

              {/* Test user flag */}
              <div className="border-t border-[var(--divider)] pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!user.is_test_user}
                    disabled={updating}
                    onChange={(e) => handleUpdate({ is_test_user: e.target.checked })}
                    className="accent-primary"
                  />
                  <span className="text-xs font-semibold text-charcoal">Test user</span>
                </label>
                <p className="text-[10px] text-secondary mt-1">
                  Excluded from the public scoreboard and from winning the monthly top-3 leaderboard reward. Still reachable via newsletter test-sends.
                </p>
              </div>

              {/* Safety & Login tools */}
              <div className="border-t border-[var(--divider)] pt-4 space-y-2">
                <label className="block text-[10px] font-bold uppercase text-secondary">Account Actions</label>
                <div className="space-y-2">
                  <button
                    onClick={handleSuspendToggle}
                    disabled={updating}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold font-heading transition ${user.is_active === false ? "bg-green-700 text-white hover:bg-green-800" : "bg-primary text-white hover:bg-primary/95"}`}
                  >
                    {user.is_active === false ? "Activate User" : "Suspend User"}
                  </button>
                  {!user.email_verified_at && (
                    <button
                      onClick={handleResendVerification}
                      disabled={updating}
                      className="w-full py-2.5 border border-[var(--divider)] hover:border-charcoal text-charcoal rounded-xl text-xs font-bold font-heading transition"
                    >
                      Resend Verification Email
                    </button>
                  )}
                  <button
                    onClick={handleResetProgress}
                    disabled={updating}
                    className="w-full py-2.5 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 rounded-xl text-xs font-bold font-heading transition"
                  >
                    Reset Learner Progress
                  </button>
                </div>
              </div>

            </div>
          </AdminCard>

        </div>

      </div>
    </div>
  );
}

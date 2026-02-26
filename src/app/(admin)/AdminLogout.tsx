"use client";

export function AdminLogout() {
  async function handleLogout() {
    await fetch("/api/auth/admin-logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="text-secondary hover:text-primary text-sm transition"
    >
      Logout
    </button>
  );
}

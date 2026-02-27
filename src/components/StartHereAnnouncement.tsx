import Link from "next/link";

interface AnnouncementConfig {
  enabled?: boolean;
  message?: string;
  href?: string;
}

export function StartHereAnnouncement({ config }: { config: AnnouncementConfig | null }) {
  if (!config?.enabled || !config?.message) return null;

  return (
    <div
      className="h-10 flex items-center justify-center px-4 border-b border-[#EEEEEE]"
      style={{ background: "#FFF7F7", color: "#1A1A1A", fontSize: "14px" }}
    >
      {config.href ? (
        <Link
          href={config.href}
          className="font-semibold hover:underline"
          style={{ color: "#D0021B", fontSize: "14px" }}
        >
          {config.message}
        </Link>
      ) : (
        <span>{config.message}</span>
      )}
    </div>
  );
}

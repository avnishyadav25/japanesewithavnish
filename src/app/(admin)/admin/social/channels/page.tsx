import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { MaybeSocialIcon } from "@/components/icons/SocialIcons";
import { listChannels } from "@/lib/social/channels";
import { capabilityReport, hasAutoPostAdapter } from "@/lib/social/adapters";
import { socialCryptoConfigured } from "@/lib/social/secrets";
import { ChannelRow } from "./ChannelRow";

export const dynamic = "force-dynamic";

/**
 * Every channel, and why each one can or cannot post by itself.
 *
 * The reason column is the point. Auto-post is off almost everywhere, and "off because the Meta
 * app has not been through Advanced Access review" is something you can act on, where a greyed
 * out button is just a mystery.
 */
export default async function SocialChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;
  const channels = await listChannels();
  const reports = new Map(capabilityReport(channels).map((r) => [r.channelId, r]));
  const cryptoReady = socialCryptoConfigured();

  return (
    <div>
      <AdminPageHeader
        title="Channels"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Social", href: "/admin/social" },
          { label: "Channels" },
        ]}
      />

      {connected && (
        <AdminCard className="mb-6 border-l-4 border-green-500">
          <p className="text-sm text-charcoal">
            Connected <strong>{connected}</strong>. Auto-post is still off — connecting an account and letting it
            publish on its own are separate decisions, so flip the toggle when you are ready.
          </p>
        </AdminCard>
      )}
      {error && (
        <AdminCard className="mb-6 border-l-4 border-primary">
          <p className="text-sm text-charcoal">{decodeURIComponent(error)}</p>
        </AdminCard>
      )}

      {!cryptoReady && (
        <AdminCard className="mb-6 border-l-4 border-amber-400">
          <p className="text-sm text-charcoal font-semibold mb-1">SOCIAL_TOKEN_KEY is not set</p>
          <p className="text-sm text-secondary">
            OAuth tokens are stored sealed with AES-256-GCM, so no channel can be connected until this key exists.
            Generate one with <code className="text-xs">openssl rand -base64 32</code>, then set it in{" "}
            <code className="text-xs">.env.local</code> <strong>and</strong> in the GitHub Actions secrets the
            publish worker runs with — if only the app has it, the app will look healthy while the worker cannot
            publish anything.
          </p>
        </AdminCard>
      )}

      <AdminCard>
        <p className="text-xs text-secondary mb-4">
          Everything defaults to the manual path: copy the text, post it, paste the live URL back. That works today
          on every platform. Auto-post switches on per channel, once its platform approval lands.
        </p>
        <div className="divide-y divide-[var(--divider)]">
          {channels.map((channel) => (
            <div key={channel.id} className="py-4 flex flex-wrap items-start gap-4">
              <div className="flex items-center gap-2.5 w-44 shrink-0">
                <MaybeSocialIcon platform={channel.platform} className="w-4 h-4 text-charcoal" />
                <div>
                  <div className="text-sm font-medium text-charcoal">{channel.label}</div>
                  {channel.handle && <div className="text-xs text-secondary">@{channel.handle}</div>}
                </div>
              </div>

              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-badge ${
                      reports.get(channel.id)?.autoPost
                        ? "bg-green-100 text-green-800"
                        : "bg-base text-secondary"
                    }`}
                  >
                    {reports.get(channel.id)?.autoPost ? "auto-post on" : "manual"}
                  </span>
                  {channel.externalAccountName && (
                    <span className="text-xs text-secondary">connected as {channel.externalAccountName}</span>
                  )}
                </div>
                <p className="text-xs text-secondary leading-relaxed">{reports.get(channel.id)?.reason}</p>
              </div>

              <ChannelRow
                channelId={channel.id}
                platform={channel.platform}
                autoPostEnabled={channel.autoPostEnabled}
                hasCredentials={channel.hasCredentials}
                canConnect={hasAutoPostAdapter(channel.platform) && cryptoReady}
              />
            </div>
          ))}
        </div>
      </AdminCard>
    </div>
  );
}

import { useState } from "react";
import type {
  CreativeDeliveryState,
  CreativeFunnelStage,
  CreativeItem,
  CreativePerformanceTag,
} from "@/lib/creatives.functions";
import { currency, nfmt, operadoraFromCampaign, pctfmt } from "@/lib/dashboard-utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Building2,
  Check,
  Clock,
  ExternalLink,
  Film,
  FlaskConical,
  GitCompareArrows,
  Image as ImageIcon,
  Layers,
  Maximize2,
  Megaphone,
  Minus,
  TrendingDown,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export type InferredCreativeFormat = {
  key: "video" | "carousel" | "static" | "ad";
  label: "Vídeo/Reels" | "Carrossel" | "Estático" | "Anúncio";
  Icon: LucideIcon;
  badgeClass: string;
  accentClass: string;
};

export function inferCreativeFormat(
  item: Pick<CreativeItem, "ad_name" | "title" | "body">,
): InferredCreativeFormat {
  const haystack = `${item.ad_name ?? ""} ${item.title ?? ""}`.toLowerCase();

  if (
    /reel|reels|video|vídeo|vid\b|vsl|motion|stories|story|mp4|mov|ugcs?|\bv\d+\b/.test(
      haystack,
    )
  ) {
    return {
      key: "video",
      label: "Vídeo/Reels",
      Icon: Film,
      badgeClass:
        "bg-violet-500/12 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/25",
      accentClass: "from-violet-500/10 via-primary/5 to-transparent",
    };
  }

  if (/carrossel|carousel|cards|galeria|sequencia|sequência/.test(haystack)) {
    return {
      key: "carousel",
      label: "Carrossel",
      Icon: Layers,
      badgeClass:
        "bg-sky-500/12 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/25",
      accentClass: "from-sky-500/10 via-primary/5 to-transparent",
    };
  }

  if (
    /estatico|estático|static|img|imagem|feed|post|banner|arte|card\b|criativo\s*\d+|ad\s*\d+/.test(
      haystack,
    )
  ) {
    return {
      key: "static",
      label: "Estático",
      Icon: ImageIcon,
      badgeClass:
        "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/25",
      accentClass: "from-indigo-500/10 via-primary/5 to-transparent",
    };
  }

  return {
    key: "ad",
    label: "Anúncio",
    Icon: Megaphone,
    badgeClass:
      "bg-primary/12 text-primary ring-1 ring-primary/25",
    accentClass: "from-primary/10 via-muted/40 to-transparent",
  };
}

export const DELIVERY_STATE_META: Record<
  CreativeDeliveryState,
  {
    label: string;
    className: string;
    isLive: boolean;
  }
> = {
  active: {
    label: "Em veiculação",
    className:
      "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/25",
    isLive: true,
  },
  campaign_paused: {
    label: "Campanha pausada",
    className:
      "bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/25",
    isLive: false,
  },
  adset_paused: {
    label: "Conjunto pausado",
    className:
      "bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/25",
    isLive: false,
  },
  ad_paused: {
    label: "Pausado",
    className:
      "bg-muted text-muted-foreground ring-1 ring-border",
    isLive: false,
  },
  issues: {
    label: "Com pendência",
    className:
      "bg-red-500/12 text-red-700 dark:text-red-300 ring-1 ring-red-500/25",
    isLive: false,
  },
  archived: {
    label: "Arquivado",
    className:
      "bg-muted text-muted-foreground ring-1 ring-border",
    isLive: false,
  },
};

export const PERFORMANCE_TAG_META: Record<
  CreativePerformanceTag,
  {
    label: string;
    className: string;
    Icon: LucideIcon;
  }
> = {
  champion: {
    label: "Campeão",
    className:
      "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/25",
    Icon: Trophy,
  },
  scalable: {
    label: "Escalável",
    className:
      "bg-sky-500/12 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/25",
    Icon: TrendingUp,
  },
  testing: {
    label: "Em teste",
    className:
      "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/25",
    Icon: FlaskConical,
  },
  attention: {
    label: "Atenção",
    className:
      "bg-red-500/12 text-red-700 dark:text-red-300 ring-1 ring-red-500/25",
    Icon: AlertTriangle,
  },
  idle_active: {
    label: "Ativo s/ gasto no período",
    className:
      "bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/25",
    Icon: Clock,
  },
};

export const STAGE_STEP_TONE: Record<string, string> = {
  novo: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  qualificado: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  tentativa: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  contatado: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  negociacao: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  venda: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  perdido: "bg-red-500/15 text-red-700 dark:text-red-300",
};

export const STAGE_BAR_FILL: Record<string, string> = {
  novo: "bg-sky-500",
  qualificado: "bg-indigo-500",
  tentativa: "bg-amber-500",
  contatado: "bg-violet-500",
  negociacao: "bg-orange-500",
  venda: "bg-emerald-500",
  perdido: "bg-red-500",
};

export function DeliveryBadge({
  item,
  compact = false,
}: {
  item: Pick<CreativeItem, "is_serving_now" | "delivery_state">;
  compact?: boolean;
}) {
  const stateKey: CreativeDeliveryState = item.is_serving_now
    ? "active"
    : item.delivery_state;
  const meta = DELIVERY_STATE_META[stateKey] ?? DELIVERY_STATE_META.ad_paused;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        compact ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-0.5 text-[11px]",
        meta.className,
      )}
    >
      {meta.isLive ? (
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-65" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
        </span>
      ) : (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" aria-hidden="true" />
      )}
      {meta.label}
    </span>
  );
}

export function PerformanceTagBadge({
  tag,
  compact = false,
}: {
  tag: CreativePerformanceTag;
  compact?: boolean;
}) {
  const meta = PERFORMANCE_TAG_META[tag] ?? PERFORMANCE_TAG_META.testing;
  const Icon = meta.Icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap",
        compact ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-0.5 text-[11px]",
        meta.className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export function CplVsBenchmarkChip({
  cpl,
  avgCpl,
  compact = false,
}: {
  cpl: number | null;
  avgCpl: number | null;
  compact?: boolean;
}) {
  if (cpl == null || cpl <= 0 || avgCpl == null || avgCpl <= 0) return null;
  const diffPct = ((cpl - avgCpl) / avgCpl) * 100;
  const rounded = Math.round(diffPct);

  if (Math.abs(rounded) <= 1) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full bg-muted font-medium text-muted-foreground ring-1 ring-border tabular-nums whitespace-nowrap",
          compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[10.5px]",
        )}
        title={`CPL alinhado à média da conta (${currency(avgCpl)})`}
      >
        = média
      </span>
    );
  }

  const toneClass =
    rounded < 0
      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/25"
      : rounded <= 25
        ? "bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/25"
        : "bg-red-500/12 text-red-700 dark:text-red-300 ring-1 ring-red-500/25";

  const sign = rounded > 0 ? `+${rounded}%` : `${rounded}%`;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium tabular-nums whitespace-nowrap",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[10.5px]",
        toneClass,
      )}
      title={`Comparado ao CPL médio da conta (${currency(avgCpl)})`}
    >
      {sign} vs média
    </span>
  );
}

export function DeltaBadge({
  pct,
  invertGood = false,
  showLabel = false,
}: {
  pct: number | null;
  invertGood?: boolean;
  showLabel?: boolean;
}) {
  if (pct == null || !Number.isFinite(pct)) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground tabular-nums">
        <Minus className="h-3 w-3 shrink-0" aria-hidden="true" />
        {showLabel ? "s/ base ant." : "—"}
      </span>
    );
  }

  const isPositive = pct >= 0;
  const isGood = invertGood ? pct <= 0 : pct >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums",
        Math.abs(pct) < 0.5
          ? "text-muted-foreground"
          : isGood
            ? "text-emerald-700 dark:text-emerald-300"
            : "text-red-700 dark:text-red-300",
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {pct > 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`}
      {showLabel && (
        <span className="ml-0.5 font-normal text-muted-foreground">vs ant.</span>
      )}
    </span>
  );
}

export type CreativeCardProps = {
  item: CreativeItem;
  stages: CreativeFunnelStage[];
  avgCpl: number | null;
  totalSpend: number;
  isSelected: boolean;
  selectionDisabled?: boolean;
  selectionIndex?: number;
  onToggleSelect: (adId: string) => void;
};

export function CreativeCard({
  item,
  stages,
  avgCpl,
  totalSpend,
  isSelected,
  selectionDisabled = false,
  selectionIndex,
  onToggleSelect,
}: CreativeCardProps) {
  const [failedMediaUrl, setFailedMediaUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const rawMediaUrl = item.image_url || item.thumbnail_url;
  const validMediaUrl =
    rawMediaUrl && failedMediaUrl !== rawMediaUrl ? rawMediaUrl : null;

  const format = inferCreativeFormat(item);
  const FormatIcon = format.Icon;
  const operadora = operadoraFromCampaign(item.campaign_name);
  const hasOperadora = operadora && operadora !== "—";

  const spendSharePct =
    totalSpend > 0 && item.spend > 0
      ? Math.min(100, (item.spend / totalSpend) * 100)
      : 0;

  const funnelStages = stages.filter((s) => s.step_name !== "perdido");

  return (
    <>
      <article
        className={cn(
          "bento-card flex h-full flex-col justify-between transition-all duration-200",
          isSelected
            ? "ring-2 ring-primary border-primary/50 shadow-md"
            : "hover:border-primary/35",
        )}
      >
        <div>
          {/* Top Status & Performance Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/25 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <DeliveryBadge item={item} compact />
              <PerformanceTagBadge tag={item.performance_tag} compact />
            </div>

            {selectionIndex != null && selectionIndex >= 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 font-mono text-[10.5px] font-semibold text-primary-foreground tabular-nums">
                #{selectionIndex + 1}
              </span>
            )}
          </div>

          {/* Smart Header / Executive Preview */}
          {validMediaUrl ? (
            <div className="group relative overflow-hidden border-b border-border/70 bg-muted/40">
              <div className="relative aspect-[16/9] w-full overflow-hidden">
                <img
                  src={validMediaUrl}
                  alt={`Mídia do criativo ${item.ad_name}`}
                  loading="lazy"
                  onError={() => setFailedMediaUrl(rawMediaUrl)}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md bg-card/92 px-2 py-0.5 text-[10.5px] font-medium shadow-xs backdrop-blur-xs",
                        format.badgeClass,
                      )}
                    >
                      <FormatIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                      {format.label}
                    </span>
                    {hasOperadora && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card/92 px-2 py-0.5 text-[10.5px] font-semibold text-foreground shadow-xs backdrop-blur-xs">
                        <Building2 className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
                        {operadora}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    aria-label={`Ampliar mídia do criativo ${item.ad_name}`}
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-card/92 text-foreground shadow-xs backdrop-blur-xs transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 bg-card px-4 py-3">
                <h4
                  className="line-clamp-2 font-display text-[15px] font-semibold leading-snug text-foreground"
                  title={item.ad_name}
                >
                  {item.ad_name}
                </h4>
                {(item.title || item.body) && (
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {item.title ? `${item.title} — ` : ""}
                    {item.body ?? ""}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-muted-foreground">
                  <div className="truncate" title={item.campaign_name}>
                    <span className="font-medium text-foreground/80">Campanha:</span>{" "}
                    {item.campaign_name}
                  </div>
                  <div className="truncate" title={item.adset_name}>
                    <span className="font-medium text-foreground/80">Conjunto:</span>{" "}
                    {item.adset_name}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Structured Executive Preview when thumbnail_url is null or fails */
            <div
              className={cn(
                "relative border-b border-border/70 bg-gradient-to-br p-4",
                format.accentClass,
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-semibold",
                      format.badgeClass,
                    )}
                  >
                    <FormatIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {format.label}
                  </span>

                  {hasOperadora && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card/85 px-2 py-0.5 text-[10.5px] font-semibold text-foreground">
                      <Building2 className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
                      {operadora}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  aria-label={`Ver detalhes completos do criativo ${item.ad_name}`}
                  title="Inspecionar detalhes do anúncio"
                  className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-card/80 text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-3 space-y-1.5">
                <h4
                  className="line-clamp-2 font-display text-[15px] font-semibold leading-snug text-foreground"
                  title={item.ad_name}
                >
                  {item.ad_name}
                </h4>

                {(item.title || item.body) && (
                  <p className="line-clamp-2 rounded-lg border border-border/60 bg-card/70 px-2.5 py-1.5 text-xs leading-relaxed text-muted-foreground">
                    {item.title && (
                      <span className="font-medium text-foreground">{item.title}: </span>
                    )}
                    {item.body}
                  </p>
                )}
              </div>

              {/* Structured Adset + Campaign Metadata */}
              <div className="mt-3 grid grid-cols-1 gap-1 rounded-lg border border-border/70 bg-card/80 px-3 py-2 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="shrink-0 font-medium text-muted-foreground">Campanha</span>
                  <span
                    className="truncate font-medium text-foreground"
                    title={item.campaign_name}
                  >
                    {item.campaign_name}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="shrink-0 font-medium text-muted-foreground">Conjunto</span>
                  <span
                    className="truncate text-muted-foreground"
                    title={item.adset_name}
                  >
                    {item.adset_name}
                  </span>
                </div>
              </div>

              {/* Subtle Spend Share Bar */}
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-[10.5px] text-muted-foreground tabular-nums">
                  <span>Share de investimento no período</span>
                  <span className="font-medium text-foreground">
                    {pctfmt(spendSharePct, 1)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.max(spendSharePct > 0 ? 3 : 0, spendSharePct)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Primary Metrics Grid */}
          <div className="grid grid-cols-3 divide-x divide-border/70 border-b border-border/70 bg-card">
            {/* Investimento */}
            <div className="p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Investimento
              </p>
              <p className="mt-1 font-display text-base font-bold text-foreground tabular-nums sm:text-[17px]">
                {currency(item.spend)}
              </p>
              <div className="mt-1">
                <DeltaBadge pct={item.spend_delta_pct} />
              </div>
            </div>

            {/* Leads (CRM vs Meta) */}
            <div className="p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Leads
              </p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <p className="font-display text-base font-bold text-foreground tabular-nums sm:text-[17px]">
                  {nfmt(item.leads)}
                </p>
                <DeltaBadge pct={item.leads_delta_pct} />
              </div>
              <p
                className="mt-1 truncate text-[10.5px] text-muted-foreground tabular-nums"
                title={`CRM Bitrix: ${nfmt(item.leads_crm)} leads · Meta Ads: ${nfmt(item.leads_meta)} leads`}
              >
                <span className="font-medium text-foreground/85">
                  CRM {nfmt(item.leads_crm)}
                </span>{" "}
                · Meta {nfmt(item.leads_meta)}
              </p>
            </div>

            {/* CPL + vs avg_cpl */}
            <div className="p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                CPL
              </p>
              <p className="mt-1 font-display text-base font-bold text-foreground tabular-nums sm:text-[17px]">
                {item.cpl != null && item.cpl > 0 ? currency(item.cpl) : "—"}
              </p>
              <div className="mt-1">
                {item.cpl != null && item.cpl > 0 ? (
                  <CplVsBenchmarkChip cpl={item.cpl} avgCpl={avgCpl} compact />
                ) : (
                  <span className="text-[10.5px] text-muted-foreground">sem CPL</span>
                )}
              </div>
            </div>
          </div>

          {/* Secondary Media & Commercial Metrics */}
          <div className="grid grid-cols-4 gap-2 border-b border-border/70 bg-muted/20 px-4 py-2.5 text-center tabular-nums">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                CTR
              </p>
              <p className="mt-0.5 text-xs font-semibold text-foreground">
                {item.impressions > 0 ? pctfmt(item.ctr, 2) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                CPC
              </p>
              <p className="mt-0.5 text-xs font-semibold text-foreground">
                {item.clicks > 0 ? currency(item.cpc) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Valor
              </p>
              <p
                className={cn(
                  "mt-0.5 truncate text-xs font-semibold",
                  item.valor_gerado > 0
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-muted-foreground",
                )}
                title={item.valor_gerado > 0 ? currency(item.valor_gerado) : "Sem receita atribuída"}
              >
                {item.valor_gerado > 0 ? currency(item.valor_gerado) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                ROAS
              </p>
              <p
                className={cn(
                  "mt-0.5 text-xs font-semibold",
                  item.roas != null && item.roas >= 1
                    ? "text-emerald-700 dark:text-emerald-300"
                    : item.roas != null && item.roas > 0
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-muted-foreground",
                )}
              >
                {item.roas != null && item.roas > 0 ? `${item.roas.toFixed(2)}×` : "—"}
              </p>
            </div>
          </div>

          {/* Mini Bitrix Funnel Progression Strip */}
          <div className="px-4 py-3">
            <div className="mb-1.5 flex items-center justify-between text-[10.5px]">
              <span className="font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Avanço no Funil Bitrix
              </span>
              <span className="text-muted-foreground tabular-nums">
                {item.leads_crm > 0
                  ? `${nfmt(item.leads_crm)} deal${item.leads_crm === 1 ? "" : "s"} CRM`
                  : `${nfmt(item.impressions)} imp.`}
              </span>
            </div>

            {funnelStages.length > 0 && item.leads_crm > 0 ? (
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                {funnelStages.slice(0, 6).map((stage) => {
                  const count = item.funnel_counts?.[stage.step_name] ?? 0;
                  const rate = item.funnel_rates?.[stage.step_name] ?? 0;
                  const fillClass = STAGE_BAR_FILL[stage.step_name] ?? "bg-primary";
                  return (
                    <div
                      key={stage.step_name}
                      className="rounded-md border border-border/70 bg-muted/30 px-1.5 py-1 text-left"
                      title={`${stage.label}: ${nfmt(count)} deals (${pctfmt(rate, 1)} dos leads CRM)`}
                    >
                      <p className="truncate text-[9.5px] font-medium text-muted-foreground">
                        {stage.label}
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold text-foreground tabular-nums">
                        {nfmt(count)}
                        <span className="ml-0.5 text-[9.5px] font-normal text-muted-foreground">
                          ({Math.round(rate)}%)
                        </span>
                      </p>
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full", fillClass)}
                          style={{ width: `${Math.min(100, rate)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2 text-[11px] text-muted-foreground">
                {item.spend > 0
                  ? "Sem deals atribuídos no Bitrix CRM neste período."
                  : "Aguardando investimento ou atribuição de leads no período."}
              </div>
            )}
          </div>
        </div>

        {/* Footer Action Bar: Compare Checkbox/Button */}
        <div className="flex items-center justify-between gap-2 border-t border-border/70 bg-muted/15 px-4 py-2.5">
          <span className="truncate font-mono text-[10.5px] text-muted-foreground tabular-nums">
            ID {item.ad_id.slice(-8)}
          </span>

          <Button
            type="button"
            size="sm"
            variant={isSelected ? "default" : "outline"}
            disabled={!isSelected && selectionDisabled}
            onClick={() => onToggleSelect(item.ad_id)}
            aria-pressed={isSelected}
            title={
              !isSelected && selectionDisabled
                ? "Limite de 4 criativos por comparação — remova um da barra de seleção para trocar"
                : isSelected
                  ? "Remover da comparação"
                  : "Adicionar à comparação lado a lado"
            }
            className={cn(
              "h-9 min-w-[124px] cursor-pointer gap-1.5 text-xs font-medium transition",
              !isSelected && "border-border bg-card hover:border-primary/40 hover:bg-muted/60",
            )}
          >
            {isSelected ? (
              <>
                <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Selecionado
              </>
            ) : (
              <>
                <GitCompareArrows className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Comparar
              </>
            )}
          </Button>
        </div>
      </article>

      {/* Media & Full Creative Metadata Inspection Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-border bg-card text-card-foreground">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <DeliveryBadge item={item} compact />
              <PerformanceTagBadge tag={item.performance_tag} compact />
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                  format.badgeClass,
                )}
              >
                <FormatIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                {format.label}
              </span>
            </div>
            <DialogTitle className="mt-2 font-display text-lg leading-snug text-foreground">
              {item.ad_name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Campanha: {item.campaign_name} · Conjunto: {item.adset_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {validMediaUrl && (
              <div className="overflow-hidden rounded-xl border border-border bg-muted/40">
                <img
                  src={validMediaUrl}
                  alt={item.ad_name}
                  className="max-h-[420px] w-full object-contain"
                />
              </div>
            )}

            {(item.title || item.body) && (
              <div className="space-y-1.5 rounded-xl border border-border bg-muted/30 p-3.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Texto / Copy do Anúncio
                </p>
                {item.title && (
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                )}
                {item.body && (
                  <p className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-border bg-muted/25 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Investimento
                </p>
                <p className="mt-1 font-display text-base font-bold tabular-nums">
                  {currency(item.spend)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/25 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Leads (CRM / Meta)
                </p>
                <p className="mt-1 font-display text-base font-bold tabular-nums">
                  {nfmt(item.leads)}{" "}
                  <span className="font-sans text-xs font-normal text-muted-foreground">
                    ({nfmt(item.leads_crm)} / {nfmt(item.leads_meta)})
                  </span>
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/25 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  CPL
                </p>
                <p className="mt-1 font-display text-base font-bold tabular-nums">
                  {item.cpl != null && item.cpl > 0 ? currency(item.cpl) : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/25 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Impressões / CTR
                </p>
                <p className="mt-1 font-display text-base font-bold tabular-nums">
                  {nfmt(item.impressions)} · {pctfmt(item.ctr, 2)}
                </p>
              </div>
            </div>

            {item.link_url && (
              <div className="flex justify-end">
                <a
                  href={item.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  Abrir URL de destino <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

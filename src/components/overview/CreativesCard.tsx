"use client";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { getMetaCreatives, type MetaCreativesData } from "@/lib/meta.functions";
import { cn } from "@/lib/utils";
import { currency, nfmt, pctfmt } from "@/lib/dashboard-utils";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  DELETED: "Excluído",
  ARCHIVED: "Arquivado",
  CAMPAIGN_PAUSED: "Campanha pausada",
  ADSET_PAUSED: "Conjunto pausado",
};

export function CreativesCard() {
  const creativesFn = useServerFn(getMetaCreatives);
  const creativesQuery = useQuery({
    queryKey: ["meta-creatives"],
    queryFn: () => creativesFn(),
  });

  const data = creativesQuery.data as MetaCreativesData | undefined;
  const ads = data?.ads ?? [];
  const stages = data?.stages ?? [];

  // Sort state
  const [sortKey, setSortKey] = useState<string>("valor_gerado");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterText, setFilterText] = useState("");

  const filtered = useMemo(() => {
    let list = [...ads];
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      list = list.filter(
        (a) =>
          a.ad_name?.toLowerCase().includes(q) ||
          a.campaign_name?.toLowerCase().includes(q) ||
          a.body?.toLowerCase().includes(q) ||
          a.title?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey] ?? 0;
      const bv = (b as Record<string, unknown>)[sortKey] ?? 0;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "desc" ? bv - av : av - bv;
      }
      return sortDir === "desc"
        ? String(bv).localeCompare(String(av))
        : String(av).localeCompare(String(bv));
    });
    return list;
  }, [ads, sortKey, sortDir, filterText]);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortKey !== col) return <span className="text-gray-400 ml-1">↕</span>;
    return <span className="text-brand ml-1">{sortDir === "desc" ? "↓" : "↑"}</span>;
  }

  const thCls = "px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wider cursor-pointer select-none hover:text-gray-700";

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎨</span>
          <h2 className="font-semibold text-gray-900">Criativos</h2>
          <span className="text-xs text-gray-400">{ads.length} criativos</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Buscar..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30 w-48"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className={thCls} onClick={() => toggleSort("ad_name")}>
                Criativo <SortIcon col="ad_name" />
              </th>
              <th className={thCls} onClick={() => toggleSort("campaign_name")}>
                Campanha <SortIcon col="campaign_name" />
              </th>
              <th className={thCls} onClick={() => toggleSort("ad_status")}>
                Status <SortIcon col="ad_status" />
              </th>
              <th className={thCls + " text-right"} onClick={() => toggleSort("spend")}>
                Spend <SortIcon col="spend" />
              </th>
              <th className={thCls + " text-right"} onClick={() => toggleSort("impressions")}>
                Impressões <SortIcon col="impressions" />
              </th>
              <th className={thCls + " text-right"} onClick={() => toggleSort("ctr")}>
                CTR <SortIcon col="ctr" />
              </th>
              <th className={thCls + " text-right"} onClick={() => toggleSort("leads")}>
                Leads <SortIcon col="leads" />
              </th>
              <th className={thCls + " text-right"} onClick={() => toggleSort("valor_gerado")}>
                Valor <SortIcon col="valor_gerado" />
              </th>
              <th className={thCls + " text-right"} onClick={() => toggleSort("cpl")}>
                CPL <SortIcon col="cpl" />
              </th>
              <th className={thCls + " text-right"} onClick={() => toggleSort("roas")}>
                ROAS <SortIcon col="roas" />
              </th>
              {stages.map((s) => (
                <th
                  key={s.step_name}
                  className={thCls + " text-right"}
                  onClick={() => toggleSort(`funnel_${s.step_name}`)}
                >
                  %{s.step_name} <SortIcon col={`funnel_${s.step_name}`} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10 + stages.length} className="text-center py-10 text-gray-400">
                  {creativesQuery.isLoading
                    ? "Carregando..."
                    : "Nenhum criativo encontrado."}
                </td>
              </tr>
            )}
            {filtered.map((ad) => {
              const statusColor =
                ad.ad_status === "ACTIVE"
                  ? "bg-green-100 text-green-700"
                  : ad.ad_status === "PAUSED"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-gray-100 text-gray-500";
              const statusLabel = STATUS_LABELS[ad.ad_status ?? ""] ?? ad.ad_status ?? "—";

              return (
                <tr key={ad.creative_id} className="hover:bg-gray-50/60 transition-colors">
                  {/* Criativo */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {ad.thumbnail_url ? (
                        <img
                          src={ad.thumbnail_url}
                          alt="thumbnail"
                          className="w-10 h-10 rounded-lg object-cover border border-gray-100 flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-brand/10 text-brand flex items-center justify-center text-xs flex-shrink-0">
                          {ad.body ? ad.body.slice(0, 2).toUpperCase() : "??"}
                        </div>
                      )}
                      <div className="min-w-0 max-w-[160px]">
                        <p className="font-medium text-gray-800 truncate text-xs">
                          {ad.ad_name || "Sem nome"}
                        </p>
                        {ad.title && (
                          <p className="text-gray-400 truncate text-[10px] mt-0.5">{ad.title}</p>
                        )}
                        {ad.body && (
                          <p className="text-gray-400 truncate text-[10px] mt-0.5">{ad.body.slice(0, 50)}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* Campanha */}
                  <td className="px-3 py-2.5 text-gray-600 text-xs">
                    <span className="truncate max-w-[120px] block">{ad.campaign_name || "—"}</span>
                  </td>
                  {/* Status */}
                  <td className="px-3 py-2.5">
                    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium", statusColor)}>
                      {statusLabel}
                    </span>
                  </td>
                  {/* Spend */}
                  <td className="px-3 py-2.5 text-right font-medium text-gray-800">
                    {currency(ad.spend)}
                  </td>
                  {/* Impressões */}
                  <td className="px-3 py-2.5 text-right text-gray-600">
                    {nfmt(ad.impressions)}
                  </td>
                  {/* CTR */}
                  <td className="px-3 py-2.5 text-right text-gray-600">
                    {ad.ctr != null ? pctfmt(ad.ctr) : "—"}
                  </td>
                  {/* Leads */}
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                    {nfmt(ad.leads)}
                  </td>
                  {/* Valor */}
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                    {ad.valor_gerado > 0 ? currency(ad.valor_gerado) : "—"}
                  </td>
                  {/* CPL */}
                  <td className="px-3 py-2.5 text-right text-gray-600">
                    {ad.cpl != null && ad.cpl > 0 ? currency(ad.cpl) : "—"}
                  </td>
                  {/* ROAS */}
                  <td className="px-3 py-2.5 text-right">
                    {ad.roas != null ? (
                      <span className={cn(
                        "font-medium",
                        ad.roas >= 1 ? "text-green-600" : "text-red-500"
                      )}>
                        {ad.roas.toFixed(2)}×
                      </span>
                    ) : "—"}
                  </td>
                  {/* Funil rates */}
                  {stages.map((s) => {
                    const rate = ad.funnel_rates?.[s.step_name];
                    if (rate == null) return (
                      <td key={s.step_name} className="px-3 py-2.5 text-right text-gray-300">—</td>
                    );
                    return (
                      <td key={s.step_name} className="px-3 py-2.5 text-right">
                        <div>
                          <span className={cn(
                            "font-medium text-xs",
                            rate >= 50 ? "text-green-600" : rate >= 20 ? "text-yellow-600" : "text-gray-400"
                          )}>
                            {pctfmt(rate)}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {filtered.length} de {ads.length} criativos
        </p>
        <p className="text-xs text-gray-400">
          Últimos 30 dias
        </p>
      </div>
    </div>
  );
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchUnsortedDeals, KEEPINCRM_TARGET_FUNNEL_IDS } from "@/lib/keepincrm";

export const maxDuration = 300;

/**
 * Диагностика: показывает что реально приходит из CRM и что у нас уже есть.
 * Не делает upsert — только считает. Это безопасно нажимать.
 */
export async function GET() {
  try {
    const { active, archivedCrmIds } = await fetchUnsortedDeals({ stopAtCrmId: 0 });

    const crmIds = active.map((d) => d.crmId);
    const fabricMatched = await db.fabricOrder.findMany({
      where: { crmId: { in: crmIds } },
      select: { crmId: true, status: true },
    });
    const fabricByCrmId = new Map<number, string>();
    for (const f of fabricMatched) if (f.crmId) fabricByCrmId.set(f.crmId, f.status);

    const decided = await db.unsortedDeal.findMany({
      where: {
        crmId: { in: crmIds },
        OR: [{ processedAt: { not: null } }, { dismissedAt: { not: null } }],
      },
      select: { crmId: true, processedAt: true, dismissedAt: true },
    });
    const processedSet = new Set(decided.filter((d) => d.processedAt).map((d) => d.crmId));
    const dismissedSet = new Set(decided.filter((d) => d.dismissedAt).map((d) => d.crmId));

    const unsortedActive = await db.unsortedDeal.count({
      where: { processedAt: null, dismissedAt: null },
    });

    const wouldImport = active.filter(
      (d) =>
        !fabricByCrmId.has(d.crmId) &&
        !processedSet.has(d.crmId) &&
        !dismissedSet.has(d.crmId)
    );

    const breakdownByStatus: Record<string, number> = {};
    for (const s of fabricByCrmId.values()) {
      breakdownByStatus[s] = (breakdownByStatus[s] || 0) + 1;
    }

    return NextResponse.json({
      targetFunnels: KEEPINCRM_TARGET_FUNNEL_IDS,
      crmActiveInTargetFunnels: active.length,
      crmArchivedInTargetFunnels: archivedCrmIds.length,
      alreadyInFabricOrder: fabricByCrmId.size,
      breakdownByStatus,
      alreadyProcessedInUnsorted: processedSet.size,
      alreadyDismissedInUnsorted: dismissedSet.size,
      unsortedActiveNow: unsortedActive,
      wouldImportOnFullSync: wouldImport.length,
      samples: {
        firstFromCrm: active.slice(0, 3).map((d) => ({
          crmId: d.crmId,
          title: d.crmTitle,
          funnelId: d.funnelId,
          stageName: d.stageName,
        })),
        firstWouldImport: wouldImport.slice(0, 3).map((d) => ({
          crmId: d.crmId,
          title: d.crmTitle,
          funnelId: d.funnelId,
          stageName: d.stageName,
        })),
      },
    });
  } catch (error: any) {
    console.error("Diag error:", error);
    return NextResponse.json(
      { error: error?.message || "Diag failed" },
      { status: 500 }
    );
  }
}

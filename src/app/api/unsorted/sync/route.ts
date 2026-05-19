import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchUnsortedDeals } from "@/lib/keepincrm";

export const maxDuration = 300;

/**
 * Запускает импорт активных сделок KeepinCRM (воронки 1 и 8) в таблицу UnsortedDeal.
 *
 * Инкрементальный режим: берём max(crmId) среди уже импортированных в UnsortedDeal
 * И среди FabricOrder, и тянем только сделки с id больше этого максимума.
 *
 * Сделки, уже находящиеся в FabricOrder, пропускаются (уже в работе).
 * Сделки, помеченные processedAt/dismissedAt в UnsortedDeal — НЕ переоткрываются.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;

    let stopAtCrmId = 0;
    if (!force) {
      const [unsortedMax, fabricMax] = await Promise.all([
        db.unsortedDeal.aggregate({ _max: { crmId: true } }),
        db.fabricOrder.aggregate({ _max: { crmId: true } }),
      ]);
      stopAtCrmId = Math.max(
        unsortedMax._max.crmId ?? 0,
        fabricMax._max.crmId ?? 0
      );
    }

    const fetched = await fetchUnsortedDeals({ stopAtCrmId });

    // crmId, уже находящиеся в FabricOrder — не дублируем как unsorted.
    const fabricCrmIds = new Set(
      (
        await db.fabricOrder.findMany({
          where: { crmId: { in: fetched.map((d) => d.crmId) } },
          select: { crmId: true },
        })
      )
        .map((r) => r.crmId)
        .filter((v): v is number => v !== null && v !== undefined)
    );

    // crmId, уже отмеченные processedAt/dismissedAt — не воскрешаем.
    const decidedCrmIds = new Set(
      (
        await db.unsortedDeal.findMany({
          where: {
            crmId: { in: fetched.map((d) => d.crmId) },
            OR: [
              { processedAt: { not: null } },
              { dismissedAt: { not: null } },
            ],
          },
          select: { crmId: true },
        })
      ).map((r) => r.crmId)
    );

    let imported = 0;
    let skipped = 0;
    let updated = 0;

    for (const deal of fetched) {
      if (fabricCrmIds.has(deal.crmId) || decidedCrmIds.has(deal.crmId)) {
        skipped += 1;
        continue;
      }

      const existing = await db.unsortedDeal.findUnique({
        where: { crmId: deal.crmId },
        select: { id: true },
      });

      await db.unsortedDeal.upsert({
        where: { crmId: deal.crmId },
        create: {
          crmId: deal.crmId,
          crmTitle: deal.crmTitle,
          crmComment: deal.crmComment,
          funnelId: deal.funnelId,
          funnelTitle: deal.funnelTitle,
          stageId: deal.stageId,
          stageName: deal.stageName,
          fabric: deal.fabric,
          model: deal.model,
          modules: deal.modules,
          orderNumber: deal.orderNumber || null,
        },
        update: {
          crmTitle: deal.crmTitle,
          crmComment: deal.crmComment,
          funnelId: deal.funnelId,
          funnelTitle: deal.funnelTitle,
          stageId: deal.stageId,
          stageName: deal.stageName,
          fabric: deal.fabric,
          model: deal.model,
          modules: deal.modules,
          orderNumber: deal.orderNumber || null,
        },
      });

      if (existing) updated += 1;
      else imported += 1;
    }

    return NextResponse.json({
      fetchedFromCrm: fetched.length,
      imported,
      updated,
      skipped,
      stopAtCrmId,
      mode: force ? "full" : "incremental",
    });
  } catch (error: any) {
    console.error("Error syncing unsorted deals:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to sync" },
      { status: 500 }
    );
  }
}

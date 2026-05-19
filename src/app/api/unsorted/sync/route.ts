import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchUnsortedDeals } from "@/lib/keepincrm";

export const maxDuration = 300;

/**
 * Bulk-импорт активных сделок KeepinCRM (воронки 1 и 8) в UnsortedDeal.
 *
 * Алгоритм:
 *  1. Параллельно тянем все страницы CRM (см. fetchUnsortedDeals).
 *     Получаем active (result=null) и archivedCrmIds (result!=null).
 *  2. Удаляем из UnsortedDeal те, что в CRM теперь архивные
 *     (если у нас они ещё не processed/dismissed).
 *  3. Bulk createMany для новых активных.
 *  4. Bulk update для уже существующих активных (свежие title/comment/etc).
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

    const { active: fetched, archivedCrmIds } = await fetchUnsortedDeals({ stopAtCrmId });

    // Чистим в БД те, что в CRM теперь архивные. Не трогаем processed/dismissed —
    // там пользователь уже принял решение.
    let cleanedArchived = 0;
    if (archivedCrmIds.length > 0) {
      const r = await db.unsortedDeal.deleteMany({
        where: {
          crmId: { in: archivedCrmIds },
          processedAt: null,
          dismissedAt: null,
        },
      });
      cleanedArchived = r.count;
    }

    if (fetched.length === 0) {
      return NextResponse.json({
        fetchedFromCrm: 0,
        imported: 0,
        updated: 0,
        skippedInFabric: 0,
        skippedDecided: 0,
        cleanedArchived,
        archivedSeenInCrm: archivedCrmIds.length,
        stopAtCrmId,
        mode: force ? "full" : "incremental",
      });
    }

    const allCrmIds = fetched.map((d) => d.crmId);

    // Bulk: какие из них уже в FabricOrder.
    const fabricMatched = await db.fabricOrder.findMany({
      where: { crmId: { in: allCrmIds } },
      select: { crmId: true },
    });
    const fabricCrmIds = new Set(
      fabricMatched.map((r) => r.crmId).filter((v): v is number => v != null)
    );

    // Bulk: какие из них уже в UnsortedDeal (с пометками или без).
    const existingUnsorted = await db.unsortedDeal.findMany({
      where: { crmId: { in: allCrmIds } },
      select: { crmId: true, processedAt: true, dismissedAt: true },
    });
    const existingByCrmId = new Map(existingUnsorted.map((e) => [e.crmId, e]));

    // Разделяем: skip / новые / обновляемые.
    const toCreate: typeof fetched = [];
    const toUpdate: typeof fetched = [];
    let skippedInFabric = 0;
    let skippedDecided = 0;

    for (const deal of fetched) {
      if (fabricCrmIds.has(deal.crmId)) {
        skippedInFabric += 1;
        continue;
      }
      const existing = existingByCrmId.get(deal.crmId);
      if (existing && (existing.processedAt || existing.dismissedAt)) {
        skippedDecided += 1;
        continue;
      }
      if (existing) toUpdate.push(deal);
      else toCreate.push(deal);
    }

    if (toCreate.length > 0) {
      await db.unsortedDeal.createMany({
        data: toCreate.map((d) => ({
          crmId: d.crmId,
          crmTitle: d.crmTitle,
          crmComment: d.crmComment,
          funnelId: d.funnelId,
          funnelTitle: d.funnelTitle,
          stageId: d.stageId,
          stageName: d.stageName,
          fabric: d.fabric,
          model: d.model,
          modules: d.modules,
          orderNumber: d.orderNumber || null,
        })),
        skipDuplicates: true,
      });
    }

    if (toUpdate.length > 0) {
      const BATCH = 20;
      for (let i = 0; i < toUpdate.length; i += BATCH) {
        const slice = toUpdate.slice(i, i + BATCH);
        await Promise.all(
          slice.map((d) =>
            db.unsortedDeal.update({
              where: { crmId: d.crmId },
              data: {
                crmTitle: d.crmTitle,
                crmComment: d.crmComment,
                funnelId: d.funnelId,
                funnelTitle: d.funnelTitle,
                stageId: d.stageId,
                stageName: d.stageName,
                fabric: d.fabric,
                model: d.model,
                modules: d.modules,
                orderNumber: d.orderNumber || null,
              },
            })
          )
        );
      }
    }

    return NextResponse.json({
      fetchedFromCrm: fetched.length,
      imported: toCreate.length,
      updated: toUpdate.length,
      skippedInFabric,
      skippedDecided,
      cleanedArchived,
      archivedSeenInCrm: archivedCrmIds.length,
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

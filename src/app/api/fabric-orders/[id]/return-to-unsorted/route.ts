import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Возвращает FabricOrder обратно в «Не разобранные»:
 *   - удаляет FabricOrder
 *   - оживляет соответствующий UnsortedDeal (сбрасывает processedAt/dismissedAt)
 *     или создаёт его, если не было (например, FabricOrder был создан до того,
 *     как мы добавили unsorted-страницу)
 *
 * Ограничения:
 *   - только статус PENDING (после ORDERED ткань физически едет, нет смысла
 *     возвращать в очередь на разбор)
 *   - только заказы с crmId (вручную добавленные без CRM возвращать некуда)
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const order = await db.fabricOrder.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.status !== "PENDING") {
      return NextResponse.json(
        { error: "Вернуть можно только из статуса «Нужно заказать»" },
        { status: 400 }
      );
    }
    if (!order.crmId) {
      return NextResponse.json(
        { error: "Этот заказ не связан с CRM — возвращать его некуда" },
        { status: 400 }
      );
    }

    await db.unsortedDeal.upsert({
      where: { crmId: order.crmId },
      create: {
        crmId: order.crmId,
        crmTitle: order.crmTitle ?? order.orderNumber,
        crmComment: order.crmComment,
        funnelId: order.funnelId ?? 0,
        funnelTitle: null,
        stageId: null,
        stageName: null,
        fabric: order.fabricName,
        model: order.model,
        modules: order.modules,
        orderNumber: order.orderNumber,
      },
      update: {
        processedAt: null,
        dismissedAt: null,
        // Свежие данные — на случай если их редактировали в трекере, чтобы
        // на /unsorted показалось последнее, что пользователь видел.
        fabric: order.fabricName,
        model: order.model,
        modules: order.modules,
        crmComment: order.crmComment,
      },
    });

    await db.fabricOrder.delete({ where: { id } });

    return NextResponse.json({ ok: true, crmId: order.crmId });
  } catch (error: any) {
    console.error("Error returning to unsorted:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to return" },
      { status: 500 }
    );
  }
}

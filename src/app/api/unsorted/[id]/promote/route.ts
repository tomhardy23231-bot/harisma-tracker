import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Превращает сырую сделку из UnsortedDeal в полноценный FabricOrder со статусом PENDING.
 * Помечает UnsortedDeal.processedAt — чтобы при следующем импорте она не появилась снова.
 *
 * Тело запроса (необязательно — иначе берём значения из самого UnsortedDeal):
 *   { fabricName?: string; meters: number; model?: string; modules?: string }
 *
 * meters обязателен, так как в CRM-сделке его нет — пользователь должен указать.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const deal = await db.unsortedDeal.findUnique({ where: { id } });
    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }
    if (deal.processedAt) {
      return NextResponse.json(
        { error: "Deal already promoted" },
        { status: 409 }
      );
    }

    const fabricName = (body.fabricName ?? deal.fabric ?? "").toString().trim();
    if (!fabricName) {
      return NextResponse.json(
        { error: "fabricName is required (укажите ткань)" },
        { status: 400 }
      );
    }

    const metersRaw = body.meters;
    const meters = typeof metersRaw === "number" ? metersRaw : parseFloat(metersRaw);
    if (!Number.isFinite(meters) || meters <= 0) {
      return NextResponse.json(
        { error: "meters must be a positive number (укажите метраж)" },
        { status: 400 }
      );
    }

    // Если crmId уже есть в FabricOrder — нельзя дублировать.
    const dup = await db.fabricOrder.findFirst({
      where: { crmId: deal.crmId },
      select: { id: true },
    });
    if (dup) {
      // Помечаем как обработанную чтобы не висела в списке.
      await db.unsortedDeal.update({
        where: { id: deal.id },
        data: { processedAt: new Date() },
      });
      return NextResponse.json(
        { error: "FabricOrder для этого CRM-заказа уже существует", fabricOrderId: dup.id },
        { status: 409 }
      );
    }

    const fabricOrder = await db.fabricOrder.create({
      data: {
        orderNumber: deal.orderNumber ?? String(deal.crmId),
        fabricName,
        meters,
        model: (body.model ?? deal.model) || null,
        modules: (body.modules ?? deal.modules) || null,
        status: "PENDING",
        crmId: deal.crmId,
        crmTitle: deal.crmTitle,
        crmComment: deal.crmComment,
        funnelId: deal.funnelId,
      },
    });

    await db.unsortedDeal.update({
      where: { id: deal.id },
      data: { processedAt: new Date() },
    });

    return NextResponse.json(fabricOrder);
  } catch (error: any) {
    console.error("Error promoting unsorted deal:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to promote" },
      { status: 500 }
    );
  }
}

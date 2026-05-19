import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Поставить заказ в ожидание с причиной.
 *
 * Body: { reason: string, days?: number }
 *   reason — причина (например «нет ткани»). Обязательно.
 *   days   — на сколько дней рассчитано ожидание (по умолчанию 7). После
 *            истечения этого срока заказ начинает считаться «просроченным»
 *            и попадает в счётчик уведомлений в навигации.
 *
 * Не меняет основной статус (PENDING/ORDERED/…), это параллельный флаг.
 * Если заказ уже в ожидании — обновляет причину и сбрасывает waitingUntil.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    const days = Number.isFinite(body?.days) && body.days > 0 ? Math.floor(body.days) : 7;

    if (!reason) {
      return NextResponse.json({ error: "reason is required" }, { status: 400 });
    }

    const order = await db.fabricOrder.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const now = new Date();
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const updated = await db.fabricOrder.update({
      where: { id },
      data: {
        waitingReason: reason,
        waitingSince: order.waitingSince ?? now, // не перезатираем дату начала
        waitingUntil: until,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error setting waiting:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to set waiting" },
      { status: 500 }
    );
  }
}

/**
 * Снять ожидание.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updated = await db.fabricOrder.update({
      where: { id },
      data: {
        waitingReason: null,
        waitingSince: null,
        waitingUntil: null,
      },
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error clearing waiting:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to clear waiting" },
      { status: 500 }
    );
  }
}

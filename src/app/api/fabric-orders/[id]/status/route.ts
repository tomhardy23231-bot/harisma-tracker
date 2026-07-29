import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { OrderStatus } from "@prisma/client";

/** Этапы в порядке движения заказа. Индекс в массиве = номер этапа. */
const STAGE_ORDER: OrderStatus[] = ["PENDING", "ORDERED", "ARRIVED", "ARCHIVED"];

/** Дата, которой фиксируется наступление этапа. У PENDING своей даты нет — это createdAt. */
const STAGE_DATE: Partial<Record<OrderStatus, "orderedAt" | "arrivedAt" | "archivedAt">> = {
  ORDERED: "orderedAt",
  ARRIVED: "arrivedAt",
  ARCHIVED: "archivedAt",
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !STAGE_ORDER.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    const current = await db.fabricOrder.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const from = STAGE_ORDER.indexOf(current.status);
    const to = STAGE_ORDER.indexOf(status as OrderStatus);

    const data: Record<string, unknown> = { status: status as OrderStatus };

    if (to > from) {
      // Вперёд — фиксируем дату наступления нового этапа.
      const field = STAGE_DATE[status as OrderStatus];
      if (field) data[field] = new Date();
    } else if (to < from) {
      // Назад — снимаем отметки всех этапов после нового. Иначе заказ,
      // возвращённый из архива, остаётся с archivedAt и продолжает считаться
      // закрытым в аналитике, а «История» показывает не пройденные этапы.
      // Дату самого нового этапа НЕ трогаем: заказ через него уже проходил,
      // и перезапись затёрла бы реальный день заказа/поступления.
      for (const stage of STAGE_ORDER.slice(to + 1)) {
        const field = STAGE_DATE[stage];
        if (field) data[field] = null;
      }
    }

    const order = await db.fabricOrder.update({
      where: { id },
      data,
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error updating fabric order status:", error);
    return NextResponse.json(
      { error: "Failed to update fabric order status" },
      { status: 500 }
    );
  }
}

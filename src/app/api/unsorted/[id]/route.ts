import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Скрыть сделку — пометить dismissedAt. Не удаляем строку, чтобы при следующем
 * импорте она не появилась снова.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updated = await db.unsortedDeal.update({
      where: { id },
      data: { dismissedAt: new Date() },
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error dismissing unsorted deal:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to dismiss" },
      { status: 500 }
    );
  }
}

/**
 * Точечное обновление полей перед промоушеном — чтобы пользователь мог
 * подправить fabric/model/modules прямо на странице "Не разобранные".
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.fabric !== undefined) data.fabric = body.fabric || null;
    if (body.model !== undefined) data.model = body.model || null;
    if (body.modules !== undefined) data.modules = body.modules || null;
    if (body.crmComment !== undefined) data.crmComment = body.crmComment || null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No data to update" }, { status: 400 });
    }

    const updated = await db.unsortedDeal.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error updating unsorted deal:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update" },
      { status: 500 }
    );
  }
}

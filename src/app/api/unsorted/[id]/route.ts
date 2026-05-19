import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { updateKeepinCrmFields, type CrmFieldUpdate } from "@/lib/keepincrm";

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
 * Редактирование полей сделки. По умолчанию изменения СИНКАЮТСЯ в CRM —
 * пользователь правит «Не разобранные», и эти же значения попадают в KeepinCRM
 * (custom_fields: Ткань/Модель/Модули + deal.comment).
 *
 * Поведение синка идентично PATCH /api/fabric-orders/[id]: best-effort,
 * ошибка CRM не валит локальный апдейт.
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

    const before = await db.unsortedDeal.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await db.unsortedDeal.update({ where: { id }, data });

    // Синк в CRM — только те поля, что реально изменились.
    if (before.crmId) {
      const crmUpdate: CrmFieldUpdate = {};
      if (data.crmComment !== undefined && data.crmComment !== before.crmComment) {
        crmUpdate.comment = data.crmComment as string | null;
      }
      if (data.fabric !== undefined && data.fabric !== before.fabric) {
        crmUpdate.fabric = data.fabric as string | null;
      }
      if (data.model !== undefined && data.model !== before.model) {
        crmUpdate.model = data.model as string | null;
      }
      if (data.modules !== undefined && data.modules !== before.modules) {
        crmUpdate.modules = data.modules as string | null;
      }
      if (Object.keys(crmUpdate).length > 0) {
        try {
          await updateKeepinCrmFields(before.crmId, crmUpdate);
        } catch (err) {
          console.error("CRM sync failed (non-fatal):", err);
        }
      }
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error updating unsorted deal:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update" },
      { status: 500 }
    );
  }
}

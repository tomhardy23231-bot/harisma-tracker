import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";

interface UpdatePayload {
  status?: OrderStatus;
  comment?: string | null;
  crmComment?: string | null;
  fabricName?: string;
  meters?: number;
  model?: string | null;
  modules?: string | null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updateData: UpdatePayload = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.comment !== undefined) updateData.comment = body.comment;
    if (body.fabricName !== undefined) {
      if (typeof body.fabricName !== "string" || body.fabricName.trim() === "") {
        return new Response(
          JSON.stringify({ message: "fabricName cannot be empty" }),
          { status: 400 }
        );
      }
      updateData.fabricName = body.fabricName.trim();
    }
    if (body.meters !== undefined) {
      const m = typeof body.meters === "number" ? body.meters : parseFloat(body.meters);
      if (!Number.isFinite(m) || m <= 0) {
        return new Response(
          JSON.stringify({ message: "meters must be a positive number" }),
          { status: 400 }
        );
      }
      updateData.meters = m;
    }
    if (body.model !== undefined) updateData.model = body.model || null;
    if (body.modules !== undefined) updateData.modules = body.modules || null;
    if (body.crmComment !== undefined) updateData.crmComment = body.crmComment || null;

    if (Object.keys(updateData).length === 0) {
      return new Response(
        JSON.stringify({ message: "No data to update" }),
        { status: 400 }
      );
    }

    const record = await db.fabricOrder.update({
      where: { id },
      data: updateData,
    });
    return Response.json(record);
  } catch (error) {
    console.error("Error updating order:", JSON.stringify(error, null, 2));
    return new Response(
      JSON.stringify({ message: "Error updating order", error }),
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.fabricOrder.delete({
      where: { id },
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting order:", JSON.stringify(error, null, 2));
    return new Response(
      JSON.stringify({ message: "Error deleting order", error }),
      { status: 500 }
    );
  }
}

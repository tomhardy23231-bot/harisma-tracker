import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status, comment } = await req.json();

    const updateData: { status?: OrderStatus; comment?: string } = {};
    if (status) {
      updateData.status = status;
    }
    if (comment !== undefined) {
      updateData.comment = comment;
    }

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

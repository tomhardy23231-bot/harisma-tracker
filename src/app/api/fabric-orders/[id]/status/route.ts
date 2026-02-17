import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { OrderStatus } from "@prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !["PENDING", "ORDERED", "ARRIVED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    const order = await db.fabricOrder.update({
      where: { id },
      data: {
        status: status as OrderStatus,
      },
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

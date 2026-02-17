import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { comment } = body;

    const order = await db.fabricOrder.update({
      where: { id },
      data: {
        comment: comment || null,
      },
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error updating fabric order comment:", error);
    return NextResponse.json(
      { error: "Failed to update fabric order comment" },
      { status: 500 }
    );
  }
}

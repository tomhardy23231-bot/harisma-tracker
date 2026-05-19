import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const deals = await db.unsortedDeal.findMany({
      where: {
        processedAt: null,
        dismissedAt: null,
      },
      orderBy: { crmId: "desc" },
    });
    return NextResponse.json(deals);
  } catch (error) {
    console.error("Error fetching unsorted deals:", error);
    return NextResponse.json(
      { error: "Failed to fetch unsorted deals" },
      { status: 500 }
    );
  }
}

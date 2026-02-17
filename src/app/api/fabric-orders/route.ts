import { db } from "@/lib/db";

export async function GET() {
  try {
    const data = await db.fabricOrder.findMany();
    return Response.json(data);
  } catch (error) {
    console.error("Error fetching orders:", JSON.stringify(error, null, 2));
    return new Response(JSON.stringify({ message: "Error fetching orders", error }), { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const record = await db.fabricOrder.create({ data });
    return Response.json(record);
  } catch (error) {
    console.error("Error creating order:", JSON.stringify(error, null, 2));
    return new Response(JSON.stringify({ message: "Error creating order", error }), { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const data = await req.json();
    const { id, ...rest } = data;
    const record = await db.fabricOrder.update({ where: { id }, data: rest });
    return Response.json(record);
  } catch (error) {
    console.error("Error updating order:", JSON.stringify(error, null, 2));
    return new Response(JSON.stringify({ message: "Error updating order", error }), { status: 500 });
  }
}

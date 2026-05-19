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

    // Если этот заказ соответствует сделке из «Не разобранных» — помечаем
    // её processedAt, чтобы она пропала со страницы и не вернулась при следующем
    // импорте. Это закрывает кейс ручного добавления через crmId из формы.
    if (typeof record.crmId === "number") {
      await db.unsortedDeal.updateMany({
        where: {
          crmId: record.crmId,
          processedAt: null,
          dismissedAt: null,
        },
        data: { processedAt: new Date() },
      });
    }

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

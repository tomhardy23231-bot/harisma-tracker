
const KEEPINCRM_API_URL = "https://api.keepincrm.com/v1";

if (!process.env.KEEPINCRM_API_KEY) {
  throw new Error("Missing KEEPINCRM_API_KEY environment variable");
}
const KEEPINCRM_API_KEY: string = process.env.KEEPINCRM_API_KEY;

function pickCustomField(deal: any, ...titles: string[]): string | null {
  const cf = deal?.custom_fields;
  if (cf && typeof cf === "object") {
    for (const t of titles) {
      const v = cf[t];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  const detailed = deal?.custom_fields_detailed;
  if (Array.isArray(detailed)) {
    for (const t of titles) {
      const found = detailed.find((f: any) => f?.title === t);
      if (found?.value && typeof found.value === "string" && found.value.trim()) {
        return found.value.trim();
      }
    }
  }
  return null;
}

export async function getKeepinCrmDeal(id: number) {
  const response = await fetch(`${KEEPINCRM_API_URL}/agreements/${id}`, {
    headers: {
      "X-Auth-Token": KEEPINCRM_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch deal ${id} from KeepinCRM`);
  }

  const deal = await response.json();
  console.log("🔥 KeepinCRM Full Response:", JSON.stringify(deal, null, 2));

  const orderNumberRegex = /#(\d+)|\((\d+)\)/;
  const match = deal.title?.match(orderNumberRegex);
  const orderNumber = match ? (match[1] || match[2]) : deal.title;

  const fabric = pickCustomField(deal, "Ткань");
  const model = pickCustomField(deal, "МОДЕЛЬ", "Модель");
  const modules = pickCustomField(deal, "МОДУЛИ", "Модули");
  const crmComment = (typeof deal.comment === "string" && deal.comment.trim())
    ? deal.comment
    : pickCustomField(deal, "Коментар", "Комментарий");

  return {
    title: deal.title as string,
    crmTitle: deal.title as string,
    crmComment,
    funnelId: deal.funnel ? deal.funnel.id : null,
    orderNumber,
    fabric,
    model,
    modules,
  };
}

export async function updateKeepinCrmStage(crmId: number, funnelId: number) {
  let stageId;
  if (funnelId === 8) {
    stageId = 73;
  } else if (funnelId === 1) {
    stageId = 1;
  } else {
    return;
  }

  const response = await fetch(`${KEEPINCRM_API_URL}/agreements/${crmId}`, {
    method: "PUT",
    headers: {
      "X-Auth-Token": KEEPINCRM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ stage_id: stageId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update deal ${crmId} in KeepinCRM`);
  }

  return response.json();
}


const KEEPINCRM_API_URL = "https://api.keepincrm.com/v1";
const KEEPINCRM_API_KEY = process.env.KEEPINCRM_API_KEY;

if (!KEEPINCRM_API_KEY) {
  throw new Error("Missing KEEPINCRM_API_KEY environment variable");
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

  // Regex to match "#12345" or "(12345)"
  const orderNumberRegex = /#(\d+)|\((\d+)\)/;
  const match = deal.title.match(orderNumberRegex);
  // capture group 1 is for #, group 2 is for ()
  const orderNumber = match ? (match[1] || match[2]) : deal.title;

  return {
    title: deal.title,
    crmTitle: deal.title,
    crmComment: deal.custom_fields?.['Коментар'] || null,
    funnelId: deal.funnel ? deal.funnel.id : null,
    orderNumber,
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

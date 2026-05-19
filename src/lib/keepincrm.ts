const KEEPINCRM_API_URL = "https://api.keepincrm.com/v1";
const TARGET_FUNNEL_IDS = [1, 8] as const;
export const KEEPINCRM_TARGET_FUNNEL_IDS = TARGET_FUNNEL_IDS;

function getApiKey(): string {
  const key = process.env.KEEPINCRM_API_KEY;
  if (!key) throw new Error("Missing KEEPINCRM_API_KEY environment variable");
  return key;
}

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

function parseOrderNumber(title: string | undefined | null): string {
  if (!title) return "";
  const match = title.match(/#(\d+)|\((\d+)\)/);
  return match ? (match[1] || match[2]) : title;
}

interface NormalizedDeal {
  crmId: number;
  crmTitle: string;
  crmComment: string | null;
  funnelId: number;
  funnelTitle: string | null;
  stageId: number | null;
  stageName: string | null;
  orderNumber: string;
  fabric: string | null;
  model: string | null;
  modules: string | null;
}

function normalizeDeal(deal: any): NormalizedDeal {
  const funnel = deal?.funnel ?? deal?.stage?.funnel ?? null;
  const stage = deal?.stage ?? null;
  const crmComment = (typeof deal?.comment === "string" && deal.comment.trim())
    ? deal.comment
    : pickCustomField(deal, "Коментар", "Комментарий");

  return {
    crmId: deal.id,
    crmTitle: deal.title ?? "",
    crmComment,
    funnelId: funnel?.id ?? 0,
    funnelTitle: funnel?.title ?? null,
    stageId: stage?.id ?? deal?.stage_id ?? null,
    stageName: stage?.name ?? null,
    orderNumber: parseOrderNumber(deal.title),
    fabric: pickCustomField(deal, "Ткань"),
    model: pickCustomField(deal, "МОДЕЛЬ", "Модель"),
    modules: pickCustomField(deal, "МОДУЛИ", "Модули"),
  };
}

export async function getKeepinCrmDeal(id: number) {
  const response = await fetch(`${KEEPINCRM_API_URL}/agreements/${id}`, {
    headers: { "X-Auth-Token": getApiKey() },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch deal ${id} from KeepinCRM`);
  }

  const deal = await response.json();
  const n = normalizeDeal(deal);

  return {
    title: n.crmTitle,
    crmTitle: n.crmTitle,
    crmComment: n.crmComment,
    funnelId: n.funnelId || null,
    orderNumber: n.orderNumber,
    fabric: n.fabric,
    model: n.model,
    modules: n.modules,
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
      "X-Auth-Token": getApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ stage_id: stageId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update deal ${crmId} in KeepinCRM`);
  }

  return response.json();
}

export interface CrmFieldUpdate {
  comment?: string | null;
  fabric?: string | null;
  model?: string | null;
  modules?: string | null;
}

/**
 * Синкает изменения полей сделки обратно в KeepinCRM.
 * comment — отправляется как deal.comment.
 * fabric/model/modules — отправляются как custom_fields (массив {name,value}).
 * Кастомные поля должны быть предсозданы в настройках CRM с такими же названиями.
 */
export async function updateKeepinCrmFields(crmId: number, update: CrmFieldUpdate) {
  const body: Record<string, unknown> = {};

  if (update.comment !== undefined) {
    body.comment = update.comment ?? "";
  }

  const customFields: Array<{ name: string; value: string }> = [];
  if (update.fabric !== undefined) {
    customFields.push({ name: "Ткань", value: update.fabric ?? "" });
  }
  if (update.model !== undefined) {
    customFields.push({ name: "Модель", value: update.model ?? "" });
  }
  if (update.modules !== undefined) {
    customFields.push({ name: "Модули", value: update.modules ?? "" });
  }
  if (customFields.length > 0) {
    body.custom_fields = customFields;
  }

  if (Object.keys(body).length === 0) return null;

  const response = await fetch(`${KEEPINCRM_API_URL}/agreements/${crmId}`, {
    method: "PATCH",
    headers: {
      "X-Auth-Token": getApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Failed to PATCH deal ${crmId}: ${response.status} ${text}`);
  }

  return response.json().catch(() => null);
}

export interface ImportProgress {
  pagesFetched: number;
  totalPages: number;
  totalCount: number;
  matchedTargetFunnels: number;
}

export interface ImportedDeal extends NormalizedDeal {
  raw: any;
}

/**
 * Итеративно тянет активные (result=null) сделки из KeepinCRM и
 * возвращает только те, что входят в целевые воронки.
 *
 * stopAtCrmId — если задан, останавливаемся как только увидим сделку
 * с crmId <= stopAtCrmId (инкрементальный синк, новые сделки сверху).
 *
 * maxPages — страховка от бесконечного цикла (по умолчанию без лимита).
 */
export async function fetchUnsortedDeals(opts: {
  stopAtCrmId?: number;
  maxPages?: number;
  onProgress?: (p: ImportProgress) => void;
} = {}): Promise<ImportedDeal[]> {
  const apiKey = getApiKey();
  const { stopAtCrmId = 0, maxPages = Infinity, onProgress } = opts;
  const matched: ImportedDeal[] = [];

  let page = 1;
  let totalPages = 1;
  let totalCount = 0;

  while (page <= totalPages && page <= maxPages) {
    const res = await fetch(`${KEEPINCRM_API_URL}/agreements?page=${page}`, {
      headers: { "X-Auth-Token": apiKey },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch agreements page ${page}: ${res.status}`);
    }
    const data: any = await res.json();
    totalPages = data?.pagination?.total_pages ?? totalPages;
    totalCount = data?.pagination?.total_count ?? totalCount;

    const items: any[] = Array.isArray(data?.items) ? data.items : [];
    let reachedStop = false;

    for (const item of items) {
      if (stopAtCrmId && typeof item.id === "number" && item.id <= stopAtCrmId) {
        reachedStop = true;
        break;
      }
      const n = normalizeDeal(item);
      if (!TARGET_FUNNEL_IDS.includes(n.funnelId as 1 | 8)) continue;
      matched.push({ ...n, raw: item });
    }

    onProgress?.({
      pagesFetched: page,
      totalPages,
      totalCount,
      matchedTargetFunnels: matched.length,
    });

    if (reachedStop) break;
    page += 1;
  }

  return matched;
}

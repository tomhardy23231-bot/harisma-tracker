const KEEPINCRM_API_URL = "https://api.keepincrm.com/v1";
const TARGET_FUNNEL_IDS = [1, 8] as const;
export const KEEPINCRM_TARGET_FUNNEL_IDS = TARGET_FUNNEL_IDS;

/**
 * Архивная сделка KeepinCRM = поле `result` ≠ null
 * (significant values: "archived" | "successful" | "failed").
 * API `GET /agreements` БЕЗ q[result_eq] возвращает И активные, И архивные —
 * мы фильтруем сами и поднимаем список архивных, чтобы убрать из UnsortedDeal
 * те, что были импортированы раньше и потом отправлены в архив CRM.
 */
function isArchivedDeal(deal: any): boolean {
  return deal?.result !== null && deal?.result !== undefined;
}

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

/**
 * Переводит сделку в стадию «Розібрано»:
 *   воронка 1 → stage 110
 *   воронка 8 → stage 111
 * Вызывается при промоушене из «Не разобранных» в «Нужно заказать»,
 * чтобы в CRM сделка тоже сразу ушла на стадию «разобрано».
 */
export async function updateKeepinCrmStageToSorted(crmId: number, funnelId: number) {
  let stageId: number | null = null;
  if (funnelId === 1) stageId = 110;
  else if (funnelId === 8) stageId = 111;
  if (stageId === null) return null;

  const response = await fetch(`${KEEPINCRM_API_URL}/agreements/${crmId}`, {
    method: "PUT",
    headers: {
      "X-Auth-Token": getApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ stage_id: stageId }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Failed to set stage Розібрано on deal ${crmId}: ${response.status} ${text}`);
  }

  return response.json().catch(() => null);
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

export interface FetchUnsortedResult {
  /** Активные (result=null) сделки целевых воронок — кандидаты на импорт. */
  active: ImportedDeal[];
  /** crmId сделок в наших воронках, у которых result != null (архивные в CRM). */
  archivedCrmIds: number[];
  /** Был ли полный обход (true) или прерван по stopAtCrmId (false). */
  fullScan: boolean;
}

async function fetchAgreementsPage(page: number, apiKey: string): Promise<any> {
  const res = await fetch(`${KEEPINCRM_API_URL}/agreements?page=${page}`, {
    headers: { "X-Auth-Token": apiKey },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch agreements page ${page}: ${res.status}`);
  }
  return res.json();
}

/**
 * Итеративно тянет активные (result=null) сделки из KeepinCRM и
 * возвращает только те, что входят в целевые воронки.
 *
 * Стратегия: сначала тянем страницу 1 чтобы узнать totalPages,
 * затем остальные страницы параллельно пачками по `concurrency` штук.
 * Это в N раз быстрее, чем sequential.
 *
 * stopAtCrmId — инкрементальный режим: страницы тянутся пока не появится
 * страница, где минимальный crmId <= stopAtCrmId. Тогда мы понимаем,
 * что дошли до уже импортированного, и обрываем (не отправляем дальше).
 * Когда stopAtCrmId = 0 (force-режим), тянем все страницы.
 */
export async function fetchUnsortedDeals(opts: {
  stopAtCrmId?: number;
  maxPages?: number;
  concurrency?: number;
  onProgress?: (p: ImportProgress) => void;
} = {}): Promise<FetchUnsortedResult> {
  const apiKey = getApiKey();
  const { stopAtCrmId = 0, maxPages = Infinity, concurrency = 6, onProgress } = opts;

  // 1. Первый запрос — узнаём totalPages и сразу разбираем page 1.
  const first = await fetchAgreementsPage(1, apiKey);
  const totalPages = Math.min(first?.pagination?.total_pages ?? 1, maxPages);
  const totalCount = first?.pagination?.total_count ?? 0;

  const byPage = new Map<number, any[]>();
  byPage.set(1, Array.isArray(first?.items) ? first.items : []);

  // 2. Остальные страницы параллельно батчами.
  // Если включён инкрементальный режим — обрываемся когда увидим страницу
  // с минимальным id <= stopAtCrmId (значит дальше всё уже импортировано).
  let stopReached = false;
  let pageCursor = 2;

  while (pageCursor <= totalPages && !stopReached) {
    const batch: number[] = [];
    for (let i = 0; i < concurrency && pageCursor + i <= totalPages; i++) {
      batch.push(pageCursor + i);
    }
    pageCursor += batch.length;

    const results = await Promise.all(batch.map((p) => fetchAgreementsPage(p, apiKey)));
    for (let i = 0; i < results.length; i++) {
      const pageNum = batch[i];
      const items: any[] = Array.isArray(results[i]?.items) ? results[i].items : [];
      byPage.set(pageNum, items);

      if (stopAtCrmId > 0) {
        // Считаем минимальный id на странице — если он <= stopAtCrmId,
        // на этой странице уже есть импортированные. Дальше не идём.
        const minId = items.reduce(
          (m, it) => (typeof it.id === "number" ? Math.min(m, it.id) : m),
          Number.POSITIVE_INFINITY
        );
        if (minId <= stopAtCrmId) stopReached = true;
      }
    }

    onProgress?.({
      pagesFetched: byPage.size,
      totalPages,
      totalCount,
      matchedTargetFunnels: 0,
    });
  }

  // 3. Склейка + фильтр.
  // Разделяем сделки целевых воронок на:
  //   active        — result === null, идут на импорт
  //   archivedCrmIds — result !== null, нужны чтобы убрать из БД, если когда-то
  //                    были импортированы и потом ушли в архив CRM
  const active: ImportedDeal[] = [];
  const archivedCrmIds: number[] = [];
  const sortedPages = [...byPage.keys()].sort((a, b) => a - b);
  for (const p of sortedPages) {
    const items = byPage.get(p) ?? [];
    for (const item of items) {
      if (stopAtCrmId > 0 && typeof item.id === "number" && item.id <= stopAtCrmId) continue;
      const n = normalizeDeal(item);
      if (!TARGET_FUNNEL_IDS.includes(n.funnelId as 1 | 8)) continue;
      if (isArchivedDeal(item)) {
        archivedCrmIds.push(n.crmId);
      } else {
        active.push({ ...n, raw: item });
      }
    }
  }

  onProgress?.({
    pagesFetched: byPage.size,
    totalPages,
    totalCount,
    matchedTargetFunnels: active.length,
  });

  return {
    active,
    archivedCrmIds,
    fullScan: !stopReached && byPage.size >= totalPages,
  };
}

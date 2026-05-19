// Хелперы для построения ссылок на веб-интерфейс KeepinCRM (то что открывается в браузере).
// Не путать с src/lib/keepincrm.ts — там серверный код, обращается к API.
// Этот файл можно безопасно импортировать из клиентских компонентов.
//
// URL веб-интерфейса использует hash-routing: https://charisma.keepincrm.com/#/app/agreements/{id}.
// База (поддомен) задаётся переменной NEXT_PUBLIC_KEEPINCRM_WEB_URL — на случай если
// у тенанта другой адрес.

const DEFAULT_WEB_BASE = "https://charisma.keepincrm.com";

function getWebBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_KEEPINCRM_WEB_URL;
  if (fromEnv && fromEnv.trim()) return fromEnv.replace(/\/+$/, "");
  return DEFAULT_WEB_BASE;
}

export function keepinCrmDealUrl(crmId: number | string): string {
  return `${getWebBase()}/#/app/agreements/${crmId}`;
}

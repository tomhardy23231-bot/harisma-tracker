'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Sparkles, ArrowRight, Inbox, RefreshCw, Hourglass, Bell, Edit3, Undo2, Palette,
  ExternalLink, Link2, LayoutGrid, Filter, MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const CHANGELOG_VERSION = '2026-05-19-v3'
const STORAGE_KEY = 'harisma-changelog-seen'

type Change = {
  icon: typeof Inbox
  tone: string
  title: string
  description: string
  rules?: string[]
}

const changes: Change[] = [
  {
    icon: ExternalLink,
    tone: 'bg-blue-100 text-blue-700',
    title: 'Кнопка «Открыть в CRM» в модалках заказов',
    description:
      'В любой модалке заказа (и обычной, и из «Не разобранных») в левом нижнем углу появилась синяя кнопка — открывает эту же сделку в KeepinCRM в новой вкладке. Больше не надо копировать CRM ID и искать руками.',
  },
  {
    icon: Link2,
    tone: 'bg-cyan-100 text-cyan-700',
    title: 'Smart-детектор дубликатов на «Нужно заказать»',
    description:
      'Если две и больше PENDING-сделки на одну и ту же ткань — на карточках появляется бирюзовый бейдж «×N». Кликаешь — открывается список всех дубликатов с общим метражом, чтобы оформить одной заявкой поставщику.',
    rules: [
      'Сравниваются названия тканей нечувствительно к регистру/пробелам/точкам.',
      'Учитываются только PENDING (после ORDERED ткани уже едут).',
      'Заказы в «Ожидании» в подсчёт не идут.',
      'В диалоге каждая позиция кликабельна → открывается её модалка. Рядом — кнопка «CRM».',
    ],
  },
  {
    icon: LayoutGrid,
    tone: 'bg-slate-900 text-white',
    title: 'Единый стиль карточек во всей системе',
    description:
      'Раньше на «Нужно заказать / Заказано / Складе / Архиве» была обычная таблица, а на «Не разобранных» — карточки. Теперь везде карточки в едином стиле: цветная полоса слева по воронке (зелёная = Харизма, фиолетовая = MebelMarket, серая = ручной заказ), белая карточка с тенью.',
    rules: [
      'Комментарий к заказу теперь виден прямо на карточке — жёлтая полоса снизу, в две строки.',
      'Все кнопки действий (Заказано / На складе / В архив / ⋮ меню) — те же что были.',
    ],
  },
  {
    icon: Filter,
    tone: 'bg-emerald-100 text-emerald-700',
    title: 'Фильтр по воронке на «Не разобранных»',
    description:
      'В шапке появились три таблетки: «Все · Харизма · MebelMarket» со счётчиками. Кликнул — список фильтруется по воронке. Выбор запоминается между перезагрузками.',
    rules: [
      'Счётчики учитывают текущий поиск.',
      'Бейджи воронок на карточках теперь подписаны по-человечески: «Харизма» и «MebelMarket» (вместо «Воронка 1/8»).',
    ],
  },
  {
    icon: MessageSquare,
    tone: 'bg-amber-100 text-amber-800',
    title: 'Мелочи UX',
    description:
      'На мобильном открытие модалки в «Не разобранных» больше не вылетает клавиатура (раньше первое поле автофокусилось). Контент тянется до 1800px на широких мониторах вместо ~1536px — меньше пустоты по бокам.',
  },
  {
    icon: Inbox,
    tone: 'bg-orange-100 text-orange-700',
    title: 'Новая вкладка «Не разобранные»',
    description:
      'Подтягиваем активные сделки из CRM (воронки 1 и 8) одним кликом. Архивные из CRM не попадают.',
    rules: [
      'Кнопка «Импорт из CRM» — тянет только новые сделки с прошлого раза.',
      'Кнопка «Полный» — перетягивает ВСЁ с нуля (используй если что-то пропустилось).',
      'Тыкаешь на строку → открывается модалка. Вписываешь метраж, проверяешь ткань/модель/модули, жмёшь «В работу». Заказ переходит в «Нужно заказать».',
      'Если сделка не относится к тебе — нажми «Скрыть». Она больше не появится здесь даже при следующем импорте.',
    ],
  },
  {
    icon: RefreshCw,
    tone: 'bg-emerald-100 text-emerald-700',
    title: 'Изменения в трекере уходят обратно в CRM',
    description:
      'Если правишь ткань, модель, модули или CRM-комментарий — те же значения сразу записываются в KeepinCRM. Не нужно дублировать вручную.',
    rules: [
      'В модалке «Не разобранных» появилась кнопка «Сохранить» — она видна когда что-то поменял. Жмёшь — данные уходят в CRM и в трекер.',
      'В карточке обычного заказа правка тех же полей синкается автоматически после сохранения.',
      'Внутренний комментарий (жёлтый) НЕ уходит в CRM — это твоя заметка только для трекера.',
    ],
  },
  {
    icon: Hourglass,
    tone: 'bg-amber-100 text-amber-800',
    title: 'Статус «Ожидание» и страница «В ожидании»',
    description:
      'Если у заказа проблема (нет ткани, ждём поставщика, и т.д.) — поставь его в ожидание с причиной. Все такие заказы собраны на вкладке «Ожидание».',
    rules: [
      'В ⋮ у любого заказа → «В ожидание…». Вводишь причину и срок (3/7/14/30 дней или своё).',
      'Когда срок истёк — заказ становится «просроченным» (красный бейдж вместо жёлтого).',
      'Из «Ожидания» можно «Продлить» (на новый срок с обновлённой причиной) или «Снять» (заказ возвращается в обычный поток).',
      'Сам статус заказа (PENDING/ORDERED/ARRIVED) не меняется — ожидание это параллельный флаг.',
    ],
  },
  {
    icon: Bell,
    tone: 'bg-rose-100 text-rose-700',
    title: 'Уведомления о просроченных ожиданиях',
    description:
      'В правом верхнем углу — колокольчик. Серый когда ничего нет, жёлтый когда есть ожидания, КРАСНЫЙ когда есть просроченные.',
    rules: [
      'По клику открывается список — видны все ожидания, сверху самые старые.',
      'Просто закрыть уведомление НЕЛЬЗЯ — только «Продлить» (если ещё ждём) или «Снять» (если разрулили).',
      'Это специально: чтобы зависшие заказы не уходили из поля зрения.',
    ],
  },
  {
    icon: Undo2,
    tone: 'bg-blue-100 text-blue-700',
    title: 'Можно вернуть заказ в «Не разобранные»',
    description:
      'Если случайно перенёс не ту сделку в «Нужно заказать» — её можно вернуть обратно. ⋮ → «Вернуть в «Не разобранные»».',
    rules: [
      'Работает только из статуса «Нужно заказать». После «Заказано» — нельзя, ткань уже едет.',
      'Только для заказов с привязкой к CRM (для добавленных вручную возвращать некуда).',
    ],
  },
  {
    icon: Palette,
    tone: 'bg-violet-100 text-violet-700',
    title: 'Цвет воронок',
    description:
      'На странице «Не разобранные» каждая карточка имеет цветную полосу слева: фиолетовая = воронка 8 (MebelMarket), зелёная = воронка 1.',
    rules: [
      'Тот же цвет — в бейдже «Воронка 1/8» рядом с номером заказа.',
    ],
  },
  {
    icon: Edit3,
    tone: 'bg-slate-900 text-white',
    title: 'Автосвязь при ручном добавлении',
    description:
      'Если на главной добавляешь заказ через CRM ID — соответствующая сделка автоматически пропадает с «Не разобранных», чтобы не висеть там зря.',
  },
]

export function WhatsNewModal() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const seen = localStorage.getItem(STORAGE_KEY)
      if (seen !== CHANGELOG_VERSION) setOpen(true)
    } catch {
      /* localStorage недоступен — просто не показываем */
    }
  }, [])

  const handleClose = () => {
    try { localStorage.setItem(STORAGE_KEY, CHANGELOG_VERSION) } catch { /* ignore */ }
    setOpen(false)
  }

  if (!mounted) return null

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden bg-slate-100 border-slate-300 max-w-full w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-3xl rounded-none sm:rounded-2xl flex flex-col"
      >
        <DialogHeader className="px-6 py-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0 ring-1 ring-white/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="text-[10px] uppercase tracking-widest font-semibold opacity-70 text-left">
                Большое обновление · {CHANGELOG_VERSION}
              </p>
              <DialogTitle className="text-xl sm:text-2xl font-bold text-left">
                Единый стиль, дубликаты и кнопка «Открыть в CRM»
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-300 text-left pt-0.5">
                Что нового и как этим пользоваться
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-3">
          {changes.map((c, i) => {
            const Icon = c.icon
            return (
              <div
                key={i}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <div className="flex gap-3 p-3 sm:p-4">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", c.tone)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 leading-tight">{c.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{c.description}</p>
                  </div>
                </div>
                {c.rules && c.rules.length > 0 && (
                  <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-1 border-t border-slate-100 bg-slate-50/50">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1.5 mt-2">
                      Как это работает
                    </p>
                    <ul className="space-y-1">
                      {c.rules.map((rule, ri) => (
                        <li key={ri} className="flex items-start gap-2 text-sm text-slate-700 leading-relaxed">
                          <span className="text-slate-400 mt-0.5">·</span>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="p-4 bg-slate-200 border-t border-slate-300 shrink-0">
          <Button
            onClick={handleClose}
            className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white text-base font-semibold gap-2"
          >
            Понятно, начать работу
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

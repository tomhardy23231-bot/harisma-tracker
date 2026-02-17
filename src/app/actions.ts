'use server'

import { getKeepinCrmDeal as getDeal, updateKeepinCrmStage as updateStage } from '@/lib/keepincrm'

export async function getKeepinCrmDeal(id: number) {
  return await getDeal(id)
}

export async function updateKeepinCrmStage(crmId: number, funnelId: number) {
  return await updateStage(crmId, funnelId)
}

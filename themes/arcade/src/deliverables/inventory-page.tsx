import { DELIVERABLE_PARAM, useHostSearchParams } from '@automatos/theme-sdk'

import { Bag } from './bag'
import { ItemWindow } from './item-window'
import { isDeliverableId } from './links'

/**
 * Arcade's /deliverables (theme.json "pages"): the bag, or, for the host's own link to one Deliverable
 * (/deliverables?deliverable=<id>), that item's window. A link that names no Deliverable shows the bag with a quiet
 * line. Links carrying ?tab=, ?post= or ?artifact_type= keep the host's own page (theme.json keepCorePage), so the
 * host's other sections stay reachable.
 */

export const BAD_LINK = "That link doesn't name an item, so here's your bag."

export function InventoryPage() {
  const asked = useHostSearchParams().get(DELIVERABLE_PARAM) || null
  if (asked !== null && isDeliverableId(asked)) return <ItemWindow key={asked} id={asked} />
  return <Bag notice={asked === null ? undefined : BAD_LINK} />
}

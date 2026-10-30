import { useMemo, useState } from 'react'
import { CHAT_HREF, HostLink, useMissions } from '@automatos/theme-sdk'

import { AutoSprite } from '../art/pixel-art'
import { placeMarkers } from '../art/world-map'
import { MapView } from './map-view'
import { QuestWindow } from './quest-window'
import { firstQuest, missionStatus, questCount } from './quests'
import styles from './quests.module.css'
import ui from '../ui/ui.module.css'

/**
 * Arcade's own page, /x/quests (theme.json "routes"): the workspace's Missions (the SDK's useMissions, polled as the
 * host's list is) as markers on the overworld map, one region per state, each on a tile a stable hash of its id
 * picks; a marker opens its quest window. With no Missions the map says so: "The map is quiet."
 */

export const MAP_LABEL = 'Quest map'
export const WORLD_MAP = 'World map'
export const MAP_LOADING = 'Unfolding the map…'
export const MAP_FAILED = "Couldn't load the map."
export const RETRY = 'Try again'
export const QUIET_TITLE = 'The map is quiet.'
export const QUIET_LINE = 'Start a quest from the chat.'
export const GO_TO_CHAT = 'Go to chat'
/** The most Missions the map asks for: one constant, so the host's query keeps its key. */
const MISSION_FILTERS = Object.freeze({ limit: 50 })

function Quiet() {
  return (
    <div className={styles.quiet}>
      <AutoSprite state="sleeping" view="large" />
      <p className={ui.title}>{QUIET_TITLE}</p>
      <p className={ui.note}>{QUIET_LINE}</p>
      <HostLink href={CHAT_HREF} className={ui.button}>
        {GO_TO_CHAT}
      </HostLink>
    </div>
  )
}

export function QuestsPage() {
  const { data, error, refetch } = useMissions(MISSION_FILTERS)
  const missions = useMemo(() => data?.missions ?? [], [data])
  const spots = useMemo(
    () => placeMarkers(missions.map((mission) => ({ id: mission.id, region: missionStatus(mission).region }))),
    [missions],
  )
  const [picked, setPicked] = useState<string | null>(null)
  const selected = missions.find((mission) => mission.id === picked) ?? missions.find((mission) => mission.id === firstQuest(missions))
  return (
    <div className={styles.page} data-has-quest={selected ? 'true' : undefined}>
      <section className={`${ui.window} ${styles.mapWindow}`} aria-label={MAP_LABEL} aria-busy={data === null && error === null ? true : undefined}>
        <div className={styles.mapHead}>
          <h1 className={ui.label}>{WORLD_MAP}</h1>
          {data !== null && <span className={ui.aside}>{questCount(missions.length)}</span>}
        </div>
        <div className={styles.mapFrame}>
          {data === null && error === null && <p className={ui.note}>{MAP_LOADING}</p>}
          {data === null && error !== null && (
            <div className={styles.quiet}>
              <p className={ui.alert}>{MAP_FAILED}</p>
              <button type="button" className={ui.secondary} onClick={refetch}>{RETRY}</button>
            </div>
          )}
          {data !== null && (missions.length === 0 ? <Quiet /> : <MapView missions={missions} spots={spots} selected={selected?.id ?? null} onSelect={setPicked} />)}
        </div>
      </section>
      {selected && <QuestWindow key={selected.id} mission={selected} />}
    </div>
  )
}

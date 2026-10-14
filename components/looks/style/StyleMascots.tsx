// The style page's mascot slot: Auto's 12 states, each with the ring the page draws under him
// in this Look (lib/mascot/ring.ts) and its colour in words. The slots are stand-ins, not the
// clips, so the page doesn't load 12 videos or light the page glow.

import { swatchStyle } from "@/components/looks/swatchStyle";
import { SHELLS } from "@/lib/looks/catalogue";
import { mascotSlots } from "@/lib/looks/style";
import type { Look } from "@/lib/looks/types";

import gallery from "./gallery.module.css";
import styles from "./style.module.css";

export const MASCOT_LABEL = "Mascot slot · 12 states · ring drawn by the page";

export function StyleMascots({ look }: { readonly look: Look }) {
  return (
    <section className={styles.section} aria-label={MASCOT_LABEL}>
      <h2 className={styles.label}>{MASCOT_LABEL}</h2>
      <ul className={gallery.slots}>
        {mascotSlots(look).map((slot) => (
          <li key={slot.state} className={gallery.slotItem}>
            <span className={gallery.slot} style={swatchStyle({ "--slot-ring": slot.ring })} aria-hidden="true">
              <span className={gallery.slotRing} />
            </span>
            <span className={gallery.slotName}>{slot.state}</span>
            <span className={gallery.slotWhen}>{slot.when}</span>
            <span className={gallery.slotColour}>
              ring {slot.tone} · {slot.ring}
            </span>
          </li>
        ))}
      </ul>
      <p className={styles.note}>
        Sizes: 220 desktop companion · 380 first open · 84 phone strip. Video: .webm (VP9 alpha) everywhere, .mp4
        (HEVC alpha) for Safari and iOS. Auto&apos;s shell is a filter over the clip: {SHELLS[look.shell].name}.
      </p>
    </section>
  );
}

// The empty chat (mock 06): Auto big, playing hello on the first open in a browser
// session, "Hi, I'm Auto." and three examples that fill the message box.

import { AutoMascot } from "@/components/mascot/AutoMascot";
import type { MascotName } from "@/lib/mascot/types";

import styles from "./first-open.module.css";

export const HELLO_TITLE = "Hi, I'm Auto.";
export const HELLO_LINE = "Your Automatos, the fun way";
export const EXAMPLES = [
  "Plan my revision week",
  "Write captions for our bake sale",
  "Budget a weekend in Lisbon",
] as const;

/** The headline says these in words already; other states (a nap, a snag) keep their caption. */
const SAID_BY_HEADLINE: ReadonlySet<MascotName> = new Set<MascotName>(["hello", "idle", "listening"]);

export interface FirstOpenHeroProps {
  readonly state: MascotName;
  readonly onClipEnded: (state: MascotName) => void;
  readonly caption?: string;
  readonly detail?: string;
  /** The headline and the line under it; Auto's own unless the chat is another agent's. */
  readonly title?: string;
  readonly line?: string;
}

export function FirstOpenHero({
  state,
  onClipEnded,
  caption,
  detail,
  title = HELLO_TITLE,
  line = HELLO_LINE,
}: FirstOpenHeroProps) {
  return (
    <section className={styles.hero} aria-label="Say hello">
      <AutoMascot
        state={state}
        onClipEnded={onClipEnded}
        caption={caption}
        detail={detail}
        size="large"
        showCaption={!SAID_BY_HEADLINE.has(state)}
      />
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.line}>{line}</p>
    </section>
  );
}

export function ExampleChips({ onPick }: { readonly onPick: (text: string) => void }) {
  return (
    <ul className={styles.chips} aria-label="Examples to try">
      {EXAMPLES.map((example) => (
        <li key={example}>
          <button type="button" className={styles.chip} onClick={() => onPick(example)}>
            {example}
          </button>
        </li>
      ))}
    </ul>
  );
}

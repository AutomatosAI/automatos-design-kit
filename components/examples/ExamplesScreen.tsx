"use client";

// The Examples page (PRD-004 K-008): the four example skins in skins/, each with its picture
// (assets/preview.png), what it is, and "Start from this", which opens the editor on it. Starting
// replaces the draft as one step, so Undo in the editor brings the old one back.

import Link from "next/link";

import { BASE_LABELS, TONE_LABELS } from "@/components/skins/ColourRow";
import { EXAMPLE_SKINS, examplePreviewUrl, startFromHref, type ExampleSkin } from "@/lib/skins/examples";
import { MASCOT_MODE_LABELS } from "@/lib/skins/mascot";

import styles from "./examples.module.css";

export const EXAMPLES_HEADING = "Examples";
export const START_FROM_THIS = "Start from this";
/** The preview pictures are 960 × 540 (scripts/draw-previews.mjs). */
const PICTURE_WIDTH = 960;
const PICTURE_HEIGHT = 540;

function tonesText(example: ExampleSkin): string {
  // "Light only", or "Light and dark": only the first word keeps its capital.
  const tones = example.draft.tones.map((tone, index) => (index === 0 ? TONE_LABELS[tone] : TONE_LABELS[tone].toLowerCase()));
  return tones.length === 1 ? `${tones[0]} only` : tones.join(" and ");
}

/** "Studio base · Light and dark · Mascot: Auto". */
export function exampleFacts(example: ExampleSkin): string {
  const { base, mascot } = example.draft;
  return `${BASE_LABELS[base]} base · ${tonesText(example)} · Mascot: ${MASCOT_MODE_LABELS[mascot.mode]}`;
}

function ExampleCard({ example }: { readonly example: ExampleSkin }) {
  const headingId = `example-${example.slug}`;
  return (
    <article className={styles.card} aria-labelledby={headingId}>
      {/* A local picture served by app/examples/[slug]/preview.png: nothing for next/image to optimise. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.picture}
        src={examplePreviewUrl(example.slug)}
        alt={`${example.draft.meta.name} on Studio-shaped parts: sidebar, cards, chat, buttons and a chart.`}
        width={PICTURE_WIDTH}
        height={PICTURE_HEIGHT}
      />
      <div className={styles.body}>
        <h2 id={headingId} className={styles.name}>
          {example.draft.meta.name}
        </h2>
        <p className={styles.facts}>{exampleFacts(example)}</p>
        <p className={styles.description}>{example.draft.meta.description}</p>
        <p className={styles.folder}>skins/{example.slug}</p>
        <Link href={startFromHref(example.slug)} className={styles.start} aria-describedby={headingId}>
          {START_FROM_THIS}
        </Link>
      </div>
    </article>
  );
}

export function ExamplesScreen() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.heading}>{EXAMPLES_HEADING}</h1>
        <p className={styles.lead}>
          Four skins to start from and learn from. Each is a folder in skins/ that passes npm run validate. Start from one
          in the editor, or copy its folder and make it yours.
        </p>
      </header>
      <div className={styles.grid}>
        {EXAMPLE_SKINS.map((example) => (
          <ExampleCard key={example.slug} example={example} />
        ))}
      </div>
    </main>
  );
}

"use client";

// The live style page (PRD-002 L-007, the Ember style sheet in docs/design/ember/screens/
// ember-12 and -13): the active Look's colours with live contrast, its type, the spacing and
// radii, the components and Auto's 12 states, and the motion. Everything is computed from
// useLook().look, so it redraws as soon as the Look changes anywhere in the app.

import Link from "next/link";
import { useState } from "react";

import { LookNotice, failed, type Notice } from "@/components/looks/LookNotice";
import { useLook } from "@/components/looks/LookProvider";
import { rootBlock } from "@/lib/looks/style";

import { StyleColour } from "./StyleColour";
import { StyleComponents } from "./StyleComponents";
import { StyleMascots } from "./StyleMascots";
import { StyleMotion } from "./StyleMotion";
import { StyleScale } from "./StyleScale";
import { StyleType } from "./StyleType";
import styles from "./style.module.css";

export const STYLE_HEADING = "Style sheet";
export const COPY_TOKENS = "Copy tokens";

/** A notice about one copy: it is hidden once the Look (so the block) has changed. */
interface CopyNotice {
  readonly block: string;
  readonly notice: Notice;
}

function useCopyTokens() {
  const { look } = useLook();
  const block = rootBlock(look);
  const [copied, setCopied] = useState<CopyNotice | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(block);
      setCopied({ block, notice: { kind: "done", text: `Copied ${look.name}'s tokens as a :root block.` } });
    } catch (error) {
      console.error("[looks] copying the tokens failed", error);
      setCopied({ block, notice: failed("The tokens weren't copied.", ["The browser blocked the clipboard."]) });
    }
  };

  return { notice: copied?.block === block ? copied.notice : null, copy };
}

export function StyleScreen() {
  const { look } = useLook();
  const { notice, copy } = useCopyTokens();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headingText}>
          <h1 className={styles.heading}>{STYLE_HEADING}</h1>
          <p className={styles.lead}>
            Every value here comes from {look.name}, the active look. Change the look and this page redraws.
          </p>
        </div>
        <div className={styles.actions}>
          <Link href="/looks" className={styles.linkButton}>
            Back to Looks
          </Link>
          <button type="button" className={styles.copyButton} onClick={() => void copy()}>
            {COPY_TOKENS}
          </button>
        </div>
      </header>
      <LookNotice notice={notice} />
      <div className={styles.sheet}>
        <StyleColour look={look} />
        <div className={styles.columns}>
          <StyleType look={look} />
          <div className={styles.stack}>
            <StyleScale />
            <StyleMotion />
          </div>
        </div>
        <StyleComponents />
        <StyleMascots look={look} />
      </div>
    </main>
  );
}

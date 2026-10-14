// One preview frame: a made-up Studio screen with every component the gallery shows. The frame
// is the kit's stand-in for Studio's <html>: it carries Studio's own classes (`studio` for the
// Studio base, `dark` for Dark), which pick the Studio or Classic shapes in the CSS, and the
// data attributes the scoped skin CSS is written for (lib/skins/preview.ts), which set the
// tokens. Everything inside is drawn on plain elements: a picture, nothing to focus or press.

import type { ReactNode } from "react";

import type { SkinBase, Tone } from "@/lib/skins/format";
import { PREVIEW_ATTRIBUTE, TONE_ATTRIBUTE, studioClasses } from "@/lib/skins/preview";

import { GalleryChart } from "./GalleryChart";
import { GalleryChat } from "./GalleryChat";
import { GalleryModal, GalleryToasts } from "./GalleryOverlays";
import { GalleryButtons, GalleryCards, GalleryControls, GalleryTable } from "./GalleryParts";
import { GalleryPageHead, GallerySidebar } from "./GalleryShell";
import styles from "./frame.module.css";

export function GallerySection({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className={styles.section}>
      <p className={styles.sectionLabel}>{label}</p>
      {children}
    </div>
  );
}

export interface GalleryFrameProps {
  /** The frame's name and caption ("Your skin", or Studio as it ships). */
  readonly label: string;
  /** The value of data-skin-preview: a base palette id, then the draft's id when the skin is on. */
  readonly skins: string;
  readonly base: SkinBase;
  readonly tone: Tone;
}

export function GalleryFrame({ label, skins, base, tone }: GalleryFrameProps) {
  const attributes = { [PREVIEW_ATTRIBUTE]: skins, [TONE_ATTRIBUTE]: tone };
  const className = [styles.frame, ...studioClasses(base, tone)].join(" ");
  return (
    <figure className={className} aria-label={label} {...attributes}>
      <figcaption className={styles.caption}>{label}</figcaption>
      <div className={styles.app}>
        <GallerySidebar />
        <div className={styles.content}>
          <GalleryPageHead />
          <GallerySection label="Chat ledger">
            <GalleryChat />
          </GallerySection>
          <GallerySection label="Cards">
            <GalleryCards />
          </GallerySection>
          <GallerySection label="Table">
            <GalleryTable />
          </GallerySection>
          <GallerySection label="Buttons">
            <GalleryButtons />
          </GallerySection>
          <GallerySection label="Fields">
            <GalleryControls />
          </GallerySection>
          <GallerySection label="Modal and toasts">
            <div className={styles.overlays}>
              <GalleryModal />
              <GalleryToasts />
            </div>
          </GallerySection>
          <GallerySection label="Charts">
            <GalleryChart />
          </GallerySection>
        </div>
      </div>
    </figure>
  );
}

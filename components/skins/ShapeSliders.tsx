"use client";

// Shape: the corner radius Studio's components use (--radius) and the skin's glow (--skin-glow),
// both in whole pixels. A drag is one undo step.

import { useId } from "react";

import { GLOW_MAX, GLOW_MIN, RADIUS_MAX, RADIUS_MIN } from "@/lib/skins/format";
import { setShape, type DraftShape, type SkinDraft } from "@/lib/skins/model";

import type { EditDraft } from "./ColourRow";
import styles from "./editor.module.css";

export const SHAPE_HEADING = "Shape";

interface SliderProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onChange: (value: number) => void;
  readonly onDone: () => void;
}

function Slider({ label, value, min, max, onChange, onDone }: SliderProps) {
  const id = useId();
  return (
    <div className={styles.slider}>
      <div className={styles.sliderHead}>
        <label htmlFor={id}>{label}</label>
        {/* Not an <output>: that is a live status, and a drag would announce every pixel. */}
        <span className={styles.sliderValue}>{value} px</span>
      </div>
      <input
        id={id}
        className={styles.range}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-valuetext={`${value} px`}
        onChange={(event) => onChange(Number(event.target.value))}
        onBlur={onDone}
        onPointerUp={onDone}
      />
    </div>
  );
}

export interface ShapeSlidersProps {
  readonly draft: SkinDraft;
  readonly onEdit: EditDraft;
  readonly onEndGroup: () => void;
}

export function ShapeSliders({ draft, onEdit, onEndGroup }: ShapeSlidersProps) {
  const headingId = useId();
  const change = (key: keyof DraftShape) => (value: number) =>
    onEdit(
      (current: SkinDraft) => setShape(current, key === "radius" ? { radius: value } : { glow: value }),
      `shape:${key}`,
    );
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.sectionTitle}>
        {SHAPE_HEADING}
      </h2>
      <Slider
        label="Radius"
        value={draft.shape.radius}
        min={RADIUS_MIN}
        max={RADIUS_MAX}
        onChange={change("radius")}
        onDone={onEndGroup}
      />
      <Slider
        label="Glow"
        value={draft.shape.glow}
        min={GLOW_MIN}
        max={GLOW_MAX}
        onChange={change("glow")}
        onDone={onEndGroup}
      />
    </section>
  );
}

// The style page's Components gallery, drawn with the app's own component styles so it shows
// exactly what the active Look produces: your message and Auto's answer, tool lines (running,
// done, failed), the receipts box, a Deliverable card, filter chips (on, off, focus) and the
// message box with Send and Stop. It is a picture: nothing here is a real button or link.

import chat from "@/components/chat/chat.module.css";
import composer from "@/components/chat/composer.module.css";
import { TypeBadge } from "@/components/deliverables/TypeBadge";
import looks from "@/components/looks/looks.module.css";

import gallery from "./gallery.module.css";
import styles from "./style.module.css";

export const COMPONENTS_LABEL = "Components";

function Messages() {
  return (
    <figure className={gallery.component}>
      <figcaption className={gallery.componentLabel}>message · yours outlined, Auto&apos;s unboxed</figcaption>
      <p className={looks.previewBubble}>Make me a shortlist?</p>
      <p className={looks.previewAnswer}>
        Three make the cut. My pick is the <strong className={looks.previewHighlight}>Vivobook</strong>.
      </p>
    </figure>
  );
}

function Tools() {
  return (
    <figure className={gallery.component}>
      <figcaption className={gallery.componentLabel}>tool line · running / done / failed</figcaption>
      <ul className={chat.toolLines}>
        <li className={chat.toolLine} data-tone="running">
          <span className={chat.spinner} aria-hidden="true" />
          <span>Reading 4 pages</span>
        </li>
        <li className={chat.toolLine} data-tone="done">
          <span className={chat.mark} aria-hidden="true">✓</span>
          <span>Read 4 pages · 3.4 s</span>
        </li>
        <li className={chat.toolLine} data-tone="failed">
          <span className={chat.mark} aria-hidden="true">✕</span>
          <span>Web search didn&apos;t answer</span>
        </li>
      </ul>
    </figure>
  );
}

function ReceiptsBox() {
  return (
    <figure className={gallery.component}>
      <figcaption className={gallery.componentLabel}>receipts</figcaption>
      <div className={chat.receipts}>
        <p className={chat.receiptsTitle}>What Auto did</p>
        <ul className={chat.receiptList}>
          <li className={chat.receipt} data-tone="done">
            <span className={chat.receiptLine}>
              <span className={chat.mark} aria-hidden="true">✓</span>
              <span>Searched the web · 5 results</span>
            </span>
          </li>
          <li className={chat.receipt} data-tone="done">
            <span className={chat.receiptLine}>
              <span className={chat.mark} aria-hidden="true">✓</span>
              <span>Made a report: Laptop shortlist</span>
              <span className={chat.badge}>Done</span>
            </span>
          </li>
        </ul>
      </div>
    </figure>
  );
}

function Deliverable() {
  return (
    <figure className={gallery.component}>
      <figcaption className={gallery.componentLabel}>Deliverable card</figcaption>
      <div className={chat.deliverable}>
        <span className={chat.deliverableTile} data-kind="report" aria-hidden="true" />
        <div className={chat.deliverableText}>
          <p className={chat.deliverableTitle}>Laptop shortlist</p>
          <p className={chat.deliverableMeta}>
            <TypeBadge kind="report" />
            just now
          </p>
        </div>
        <span className={chat.openButton}>Open</span>
      </div>
    </figure>
  );
}

function Chips() {
  return (
    <figure className={gallery.component}>
      <figcaption className={gallery.componentLabel}>filter chip · on / off / focus</figcaption>
      <div className={gallery.chips}>
        <span className={gallery.chip} data-state="on">
          All
        </span>
        <span className={gallery.chip} data-state="off">
          Reports
        </span>
        <span className={gallery.chip} data-state="focus">
          Images
        </span>
      </div>
    </figure>
  );
}

function MessageBoxes() {
  return (
    <figure className={gallery.component}>
      <figcaption className={gallery.componentLabel}>message box · Send / Stop</figcaption>
      <div className={composer.box}>
        <span className={gallery.placeholder}>Message Auto</span>
        <span className={composer.send}>Send</span>
      </div>
      <div className={composer.box}>
        <span className={gallery.placeholder}>Message Auto</span>
        <span className={composer.stop}>
          <span className={composer.stopIcon} aria-hidden="true" />
          Stop
        </span>
      </div>
    </figure>
  );
}

export function StyleComponents() {
  return (
    <section className={styles.section} aria-label={COMPONENTS_LABEL}>
      <h2 className={styles.label}>{COMPONENTS_LABEL}</h2>
      <div className={gallery.gallery}>
        <Messages />
        <Tools />
        <ReceiptsBox />
        <Deliverable />
        <Chips />
        <MessageBoxes />
      </div>
    </section>
  );
}

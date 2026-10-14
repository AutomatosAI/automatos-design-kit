"use client";

// A loaded Deliverable (mock 05): title, type badge, date and "Made by", the content,
// and the side panel. On phones the panel follows the content and its two actions sit
// in a bar at the bottom of the screen.

import type { ApiClient } from "@/lib/client/api";
import type { Deliverable } from "@/lib/client/types";
import { contentView, detailDate, detailTitle, madeLine } from "@/lib/deliverables/detail";
import { kindOf } from "@/lib/deliverables/shelf";

import { DeliverableContent } from "./DeliverableContent";
import { DetailPanel } from "./DetailPanel";
import styles from "./detail.module.css";
import { TypeBadge } from "./TypeBadge";

export interface DeliverableViewProps {
  readonly deliverable: Deliverable;
  readonly client: ApiClient;
  readonly now: Date;
}

export function DeliverableView({ deliverable, client, now }: DeliverableViewProps) {
  const kind = kindOf(deliverable);
  const title = detailTitle(deliverable);
  const date = detailDate(deliverable.createdAt, now);

  return (
    <div className={styles.layout}>
      <article className={styles.article}>
        <header className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.meta}>
            <TypeBadge kind={kind} />
            {date && <time dateTime={deliverable.createdAt ?? undefined}>{date}</time>}
            {date && <span aria-hidden="true">·</span>}
            <span>{madeLine(deliverable.agentName)}</span>
          </p>
        </header>
        <DeliverableContent
          view={contentView(deliverable)}
          deliverable={deliverable}
          kind={kind}
          title={title}
          client={client}
        />
      </article>
      <DetailPanel deliverable={deliverable} kind={kind} title={title} date={date} />
    </div>
  );
}

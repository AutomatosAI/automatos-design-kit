"use client";

// One Deliverable on the shelf (mock 04): the thumbnail (or a printed sheet when
// it has none), the title, the type badge and the date. The whole card opens it.

import Link from "next/link";
import { useState } from "react";

import { useThumbnail } from "@/hooks/useThumbnail";
import { deliverableHref, UNTITLED } from "@/lib/chat/deliverables";
import type { ApiClient } from "@/lib/client/api";
import type { Deliverable } from "@/lib/client/types";
import { kindOf, shelfDate } from "@/lib/deliverables/shelf";

import kinds from "./kinds.module.css";
import styles from "./shelf.module.css";
import { TypeBadge } from "./TypeBadge";

export interface ShelfCardProps {
  readonly deliverable: Deliverable;
  readonly client: ApiClient;
  readonly now: Date;
  /** The newest on the shelf gets the spotlight. */
  readonly newest: boolean;
}

export function ShelfCard({ deliverable, client, now, newest }: ShelfCardProps) {
  const kind = kindOf(deliverable);
  const thumbnail = useThumbnail(client, deliverable.id);
  const [broken, setBroken] = useState(false);
  const title = deliverable.title.trim() || UNTITLED;
  const date = shelfDate(deliverable.createdAt, now);
  const onThumbnailError = () => {
    console.warn(`[shelf] the thumbnail for Deliverable ${deliverable.id} didn't load, showing a sheet instead`);
    setBroken(true);
  };

  return (
    <li className={styles.item} data-newest={newest ? "true" : undefined}>
      <Link href={deliverableHref(deliverable.id)} className={styles.card}>
        <div className={`${styles.thumb} ${kinds.kindTile}`} data-kind={kind} data-testid="shelf-thumb">
          {thumbnail && !broken && (
            // A blob: URL from the API client, which next/image can't optimise.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnail} alt="" className={styles.thumbImage} onError={onThumbnailError} />
          )}
          {newest && <span className={styles.newest}>Newest</span>}
        </div>
        <div className={styles.cardText}>
          <h2 className={styles.cardTitle}>{title}</h2>
          <p className={styles.cardMeta}>
            <TypeBadge kind={kind} />
            {date && <time dateTime={deliverable.createdAt ?? undefined}>{date}</time>}
          </p>
        </div>
      </Link>
    </li>
  );
}

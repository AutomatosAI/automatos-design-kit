// Studio's frame around a page, drawn: the sidebar (groups, an active item, counts), the page
// header, the stats bar and the filter tabs. One markup for both bases; shell.module.css gives
// the Studio shapes under the frame's `studio` class (Studio's cc-headrow, cc-stats, cc-tabs and
// sh-item) and the Classic ones otherwise (a bold title, stat cards, a tab list).

import { ACTIVE_NAV_ITEM, FILTER_TABS, PAGE_HEADER, SIDEBAR_GROUPS, STATS } from "./content";
import styles from "./shell.module.css";

export function GallerySidebar() {
  return (
    <div className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.glyph} aria-hidden="true" />
        <span className={styles.brandName}>Automatos</span>
      </div>
      <div className={styles.workspace}>
        <span className={styles.mark}>A</span>
        <span className={styles.workspaceName}>Acme workspace</span>
      </div>
      {SIDEBAR_GROUPS.map(({ group, items }) => (
        <div key={group} className={styles.group}>
          <p className={styles.groupName}>{group}</p>
          {items.map((item) => (
            <span
              key={item.label}
              className={item.label === ACTIVE_NAV_ITEM ? styles.navActive : styles.navItem}
              data-current={item.label === ACTIVE_NAV_ITEM ? "page" : undefined}
            >
              <span className={styles.navIcon} aria-hidden="true" />
              <span className={styles.navLabel}>{item.label}</span>
              {item.count && <span className={item.alert ? styles.countAlert : styles.count}>{item.count}</span>}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function PageHeader() {
  return (
    <div className={styles.headRow}>
      <div className={styles.head}>
        <p className={styles.eyebrow}>{PAGE_HEADER.eyebrow}</p>
        <p className={styles.pageTitle}>
          {PAGE_HEADER.title} <span className={styles.titleAccent}>{PAGE_HEADER.accent}</span>
        </p>
        <p className={styles.sub}>{PAGE_HEADER.sub}</p>
      </div>
      <span className={styles.headAction}>{PAGE_HEADER.action}</span>
    </div>
  );
}

function StatsBar() {
  return (
    <div className={styles.stats}>
      {STATS.map((stat) => (
        <div key={stat.label} className={styles.stat} data-tone={stat.tone}>
          <span className={styles.statLabel}>
            <span className={styles.statDot} aria-hidden="true" />
            {stat.label}
          </span>
          <span className={styles.statValue}>{stat.value}</span>
          <span className={styles.statDelta}>{stat.delta}</span>
        </div>
      ))}
    </div>
  );
}

function FilterTabs() {
  return (
    <div className={styles.tabs}>
      {FILTER_TABS.map((tab, index) => (
        <span key={tab.label} className={index === 0 ? styles.tabActive : styles.tab}>
          {tab.label}
          <span className={styles.tabCount}>{tab.count}</span>
        </span>
      ))}
    </div>
  );
}

export function GalleryPageHead() {
  return (
    <div className={styles.page}>
      <PageHeader />
      <StatsBar />
      <FilterTabs />
    </div>
  );
}

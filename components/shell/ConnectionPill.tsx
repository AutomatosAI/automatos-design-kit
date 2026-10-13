import styles from "./shell.module.css";

export type ConnectionStatus = "checking" | "connected" | "down";

export function connectionLabel(status: ConnectionStatus, host?: string): string {
  switch (status) {
    case "connected":
      return host ? `Connected · ${host}` : "Connected";
    case "down":
      return "Not running";
    case "checking":
      return "Checking…";
  }
}

export function ConnectionPill({ status, host }: { readonly status: ConnectionStatus; readonly host?: string }) {
  return (
    <div className={styles.connection} role="status">
      <span className={styles.dot} data-status={status} aria-hidden="true" />
      {connectionLabel(status, host)}
    </div>
  );
}

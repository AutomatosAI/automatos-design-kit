// hello plays on the first open of Play in a browser session (mascot-states.md). The
// session remembers it in sessionStorage; where that is blocked (a private window, a
// sandbox), it plays once per page load instead.

export const HELLO_KEY = "automatos-play:hello-played";

let playedWithoutStorage = false;

function sessionStore(): Storage {
  return window.sessionStorage;
}

/** True once per browser session: the caller dispatches app-open. Later calls say false. */
export function claimFirstOpen(storage: () => Storage = sessionStore): boolean {
  try {
    const store = storage();
    if (store.getItem(HELLO_KEY) !== null) return false;
    store.setItem(HELLO_KEY, "1");
    return true;
  } catch (error) {
    console.warn("[mascot] sessionStorage isn't available, so hello plays once per page load:", error);
    if (playedWithoutStorage) return false;
    playedWithoutStorage = true;
    return true;
  }
}

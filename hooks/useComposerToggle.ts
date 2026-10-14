"use client";

// An in-page composer behind a header button (New Mission, New Task): open shows it,
// hide closes it and puts focus back on the button that opened it.

import { useCallback, useEffect, useRef, useState } from "react";

export function useComposerToggle() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => {
    refocus.current = true;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (open || !refocus.current) return;
    refocus.current = false;
    button.current?.focus();
  }, [open]);

  return { open, show, hide, button };
}

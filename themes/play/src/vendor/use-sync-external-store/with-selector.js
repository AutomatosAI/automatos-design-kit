/**
 * @license React
 * use-sync-external-store-with-selector.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Vendored from use-sync-external-store 1.2.0 (cjs/use-sync-external-store-with-selector.development.js,
// the build zustand 4.4.1 reads) as an ES module. The logic is unchanged; the CommonJS wrapper, the
// DevTools module markers and the Object.is polyfill are left out (the host's React is 19, which has
// useSyncExternalStore and Object.is), and the memoised selector is its own function.
import { useDebugValue, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

// The selector, memoised on the snapshot: a snapshot seen last time gives the selection given last time.
function memoizedSelectorFor(selector, isEqual, inst) {
  var hasMemo = false;
  var memoizedSnapshot;
  var memoizedSelection;
  return function (nextSnapshot) {
    if (!hasMemo) {
      // The first time the hook is called, there is no memoized result.
      hasMemo = true;
      memoizedSnapshot = nextSnapshot;
      var firstSelection = selector(nextSnapshot);
      // Even if the selector has changed, the currently rendered selection may be equal to the new
      // selection. Reuse the current value if possible, to preserve downstream memoizations.
      if (isEqual !== undefined && inst.hasValue && isEqual(inst.value, firstSelection)) {
        memoizedSelection = inst.value;
        return inst.value;
      }
      memoizedSelection = firstSelection;
      return firstSelection;
    }
    // The snapshot is the same as last time: reuse the previous selection.
    if (Object.is(memoizedSnapshot, nextSnapshot)) return memoizedSelection;
    // The snapshot has changed, so compute a new selection. If a custom isEqual says the data has not
    // changed, return the previous selection, so React can bail out of rendering.
    var nextSelection = selector(nextSnapshot);
    if (isEqual !== undefined && isEqual(memoizedSelection, nextSelection)) return memoizedSelection;
    memoizedSnapshot = nextSnapshot;
    memoizedSelection = nextSelection;
    return nextSelection;
  };
}

// Same as useSyncExternalStore, but supports selector and isEqual arguments.
export function useSyncExternalStoreWithSelector(subscribe, getSnapshot, getServerSnapshot, selector, isEqual) {
  // Use this to track the rendered snapshot.
  var instRef = useRef(null);
  if (instRef.current === null) instRef.current = { hasValue: false, value: null };
  var inst = instRef.current;
  var getters = useMemo(function () {
    var memoizedSelector = memoizedSelectorFor(selector, isEqual, inst);
    var getSelection = function () {
      return memoizedSelector(getSnapshot());
    };
    var getServerSelection = getServerSnapshot === undefined ? undefined : function () {
      return memoizedSelector(getServerSnapshot());
    };
    return [getSelection, getServerSelection];
  }, [getSnapshot, getServerSnapshot, selector, isEqual]);
  var value = useSyncExternalStore(subscribe, getters[0], getters[1]);
  useEffect(function () {
    inst.hasValue = true;
    inst.value = value;
  }, [value]);
  useDebugValue(value);
  return value;
}

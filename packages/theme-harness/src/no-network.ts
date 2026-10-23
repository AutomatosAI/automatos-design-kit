/**
 * PRD-261 B-02b: the harness's second setup file (vitest-preset.ts names it after src/setup.ts). Before each
 * test file, the global fetch and XMLHttpRequest are swapped for ones that throw (src/internal/network.ts),
 * in jsdom and in node alike, so a theme's tests never reach a network.
 */
import { refuseNetwork } from './internal/network.ts'

refuseNetwork()

import {
  ACCENTS,
  ACCENT_KEYS,
  GROUND_KEYS,
  LIGHT_KEYS,
  SHELL_KEYS,
  TYPE_STYLE_KEYS,
} from "./catalogue";
import {
  GLOW_SCALE,
  accentTextVars,
  accentVars,
  fontVars,
  groundVars,
  lightVars,
  rgbList,
  shellVars,
  type CssVars,
} from "./css";
import { DEFAULT_LOOK } from "./presets";
import { ACTIVE_LOOK_KEY } from "./storage";
import { GLOW_MAX, GLOW_MIN } from "./types";

// The inline <head> script that applies the stored Look before first paint (PRD-002 FR-5).
// Its body is a constant, built here at build time from the catalogue through the same
// builders as lookToCssVars(). The only runtime input is the stored active Look, and it is
// used only after every field is checked against the catalogue's own keys. Never put user
// text into this string.

function table<K extends string>(keys: readonly K[], vars: (key: K) => CssVars): Readonly<Record<string, CssVars>> {
  return Object.fromEntries(keys.map((key) => [key, vars(key)]));
}

/** Every catalogue entry's CSS variables, keyed the way the script reads them. */
export function prepaintTable() {
  const { ground, accent, font, shell, light, glow } = DEFAULT_LOOK;
  return {
    g: table(GROUND_KEYS, groundVars),
    a: table(ACCENT_KEYS, accentVars),
    x: Object.fromEntries(GROUND_KEYS.map((key) => [key, table(ACCENT_KEYS, (other) => accentTextVars(key, other))])),
    f: table(TYPE_STYLE_KEYS, fontVars),
    s: table(SHELL_KEYS, shellVars),
    l: table(LIGHT_KEYS, lightVars),
    r: Object.fromEntries(ACCENT_KEYS.map((key) => [key, rgbList(ACCENTS[key].hex)])),
    d: { ground, accent, font, shell, light, glow },
  };
}

/** JSON that can sit inside a <script> element: no "</script>", no line separators. */
function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

// A blocked or corrupt store falls back to the default Look on purpose: LookProvider reads the
// same store after hydration and logs why.
export const LOOK_PREPAINT_SCRIPT = `(function(){
var T=${scriptSafeJson(prepaintTable())},d=document.documentElement,own=Object.prototype.hasOwnProperty;
function has(o,k){return typeof k==="string"&&own.call(o,k);}
function valid(l){return l!==null&&typeof l==="object"&&has(T.g,l.ground)&&has(T.a,l.accent)&&has(T.f,l.font)&&has(T.s,l.shell)&&has(T.l,l.light)&&typeof l.glow==="number"&&l.glow%1===0&&l.glow>=${GLOW_MIN}&&l.glow<=${GLOW_MAX};}
function put(v){for(var k in v){if(own.call(v,k)){d.style.setProperty(k,v[k]);}}}
var l=null;
try{l=JSON.parse(window.localStorage.getItem(${JSON.stringify(ACTIVE_LOOK_KEY)})||"null");}catch(e){l=null;}
if(!valid(l)){l=T.d;}
put(T.g[l.ground]);put(T.a[l.accent]);put(T.x[l.ground][l.accent]);put(T.f[l.font]);put(T.s[l.shell]);put(T.l[l.light]);
d.style.setProperty("--glow","rgba("+T.r[l.accent]+","+l.glow/${GLOW_SCALE}+")");
})();`;

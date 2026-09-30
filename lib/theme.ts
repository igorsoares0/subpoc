// Theme preference. Light is the default regardless of prefers-color-scheme;
// "system" follows the OS. The inline script in app/layout.tsx applies the
// saved value before paint — keep the storage key and logic in sync with it.

export type ThemePref = "light" | "dark" | "system"

const KEY = "theme"
const media = () => window.matchMedia("(prefers-color-scheme: dark)")

export function getThemePref(): ThemePref {
  try {
    const t = localStorage.getItem(KEY)
    if (t === "dark" || t === "system") return t
  } catch {}
  return "light"
}

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && media().matches)
  if (dark) document.documentElement.setAttribute("data-theme", "dark")
  else document.documentElement.removeAttribute("data-theme")
}

let unwatch: (() => void) | null = null

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref)
  } catch {}
  apply(pref)
  watchSystemTheme()
}

// While on "system", follow OS changes live.
export function watchSystemTheme() {
  unwatch?.()
  unwatch = null
  if (getThemePref() !== "system") return
  const m = media()
  const onChange = () => apply("system")
  m.addEventListener("change", onChange)
  unwatch = () => m.removeEventListener("change", onChange)
}

/** Tiny DOM helpers. Everything user-typed goes in through textContent or value, never innerHTML. */

type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...kids: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(props)) {
    if (val === undefined || val === null || val === false) continue;
    if (key === 'class') node.className = String(val);
    else if (key.startsWith('on') && typeof val === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), val as EventListener);
    } else if (key in node) (node as unknown as Record<string, unknown>)[key] = val;
    else node.setAttribute(key, String(val));
  }
  for (const k of kids) {
    if (k === null || k === undefined || k === false) continue;
    node.append(typeof k === 'string' ? document.createTextNode(k) : k);
  }
  return node;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function $(sel: string, root: ParentNode = document): HTMLElement {
  const found = root.querySelector<HTMLElement>(sel);
  if (!found) throw new Error(`Missing element: ${sel}`);
  return found;
}

export function loadJSON<T>(key: string, fallback: T, check: (v: unknown) => v is T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return check(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function parseNum(v: string): number {
  const n = parseFloat(v.replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

export function money(n: number, currency = '₦'): string {
  const sign = n < 0 ? '-' : '';
  return (
    sign +
    currency +
    Math.abs(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

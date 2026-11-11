import type { SiteContent } from '../../src/types.mjs';
/** Minimal DOM contract also used by deterministic preview tests. */
export interface PreviewElement {
  tagName?: string; nodeName?: string; textContent?: string | null;
  children?: ArrayLike<PreviewElement>; childElementCount?: number;
  style?: { setProperty(name: string, value: string): void };
  getAttribute?(name: string): string | null;
  setAttribute?(name: string, value: string): void;
}
export interface PreviewDocument {
  title?: string; documentElement?: PreviewElement | null; body?: PreviewElement | null;
  querySelectorAll?(selector: string): ArrayLike<PreviewElement> | null;
  querySelector?(selector: string): PreviewElement | null;
}
// Live preview overrides for Website Studio.
//
// The preview iframes render the exact generated template markup. This module
// rewrites only the fields the user configured (brand, headline, description,
// accent color, contact email) so Studio can show the same layout with the
// visitor's own copy. It never changes structure, classes or inline styles
// beyond the single accent custom property.

const MAILTO = "mailto:";
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Description paragraphs used by the generated layouts. Order matters: only
// the first selector that matches a text-only element is written, so a new
// template must be added here explicitly instead of guessing with "first p".
const DESCRIPTION_PARAGRAPHS = [
  '[data-site-description]',
  "section.hero > p",
  "p.lead",
  ".orbit-hero > div > p",
  ".studio-lede > p",
  ".board-header > div > p",
  ".console-heading > div > h1 + p",
];

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function selectAll(doc: PreviewDocument | null | undefined, selector: string): PreviewElement[] {
  if (!doc || typeof doc.querySelectorAll !== "function") return [];
  const found = doc.querySelectorAll(selector);
  return found ? Array.from(found) : [];
}

function selectOne(doc: PreviewDocument | null | undefined, selector: string) {
  if (!doc || typeof doc.querySelector !== "function") return null;
  return doc.querySelector(selector) || null;
}

function readAttribute(element: PreviewElement | null, name: string) {
  if (!element) return null;
  if (typeof element.getAttribute === "function") return element.getAttribute(name);
  const value: unknown = Reflect.get(element, name);
  return typeof value === "string" ? value : null;
}

function writeAttribute(element: PreviewElement | null, name: string, value: string) {
  if (!element) return;
  if (typeof element.setAttribute === "function") element.setAttribute(name, value);
  else Reflect.set(element, name, value);
}

function hasElementChildren(element: PreviewElement | null | undefined) {
  if (!element) return false;
  if (typeof element.childElementCount === "number")
    return element.childElementCount > 0;
  const children = element.children;
  return Boolean(children && typeof children.length === "number" && children.length > 0);
}

function writeText(element: PreviewElement | null, value: string) {
  if (!element || !value || hasElementChildren(element)) return;
  element.textContent = value;
}

function writeAccent(doc: PreviewDocument, accent: string) {
  if (!accent) return;
  for (const element of [doc.documentElement, doc.body]) {
    const style = element && element.style;
    if (style && typeof style.setProperty === "function")
      style.setProperty("--accent", accent);
  }
}

function writeBrand(doc: PreviewDocument, brand: string) {
  if (!brand) return;
  for (const element of selectAll(doc, ".brand")) {
    if (!hasElementChildren(element)) {
      element.textContent = brand;
      continue;
    }
    // Wordmark markup (icon plus label) keeps its structure: rewrite only a
    // direct text-only span, which is the generated brand label.
    const wordmark = firstTextOnlyChild(element, "span");
    if (wordmark) wordmark.textContent = brand;
  }
}

function firstTextOnlyChild(element: PreviewElement | null, tagName: string) {
  const children = element && element.children;
  if (!children) return null;
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (!child) continue;
    const name = String(child.tagName || child.nodeName || "").toLowerCase();
    if (name === tagName && !hasElementChildren(child)) return child;
  }
  return null;
}

function writeHeadline(doc: PreviewDocument, headline: string) {
  if (!headline) return;
  const heading = selectOne(doc, "main h1") || selectOne(doc, "h1");
  writeText(heading, headline);
}

function writeDescription(doc: PreviewDocument, description: string) {
  if (!description) return;
  const meta = selectOne(doc, 'meta[name="description"]');
  if (meta) writeAttribute(meta, "content", description);
  for (const element of selectAll(doc, ".footer > span"))
    writeText(element, description);
  for (const selector of DESCRIPTION_PARAGRAPHS) {
    const [paragraph] = selectAll(doc, selector);
    if (!paragraph || hasElementChildren(paragraph)) continue;
    paragraph.textContent = description;
    return;
  }
}

function writeTitle(doc: PreviewDocument, brand: string, headline: string) {
  const parts = [brand, headline].filter(Boolean);
  if (parts.length && typeof doc === "object" && doc) doc.title = parts.join(" — ");
}

function writeContactEmail(doc: PreviewDocument, email: string) {
  if (!email) return;
  for (const link of selectAll(doc, 'a[href^="mailto:"]')) {
    const current = readAttribute(link, "href");
    if (typeof current !== "string" || !current.startsWith(MAILTO)) {
      writeAttribute(link, "href", MAILTO + email);
    } else {
      // Keep any subject/body query of the generated link and swap the address.
      const rest = current.slice(MAILTO.length);
      const cut = rest.search(/[?#]/);
      writeAttribute(link, "href", MAILTO + email + (cut === -1 ? "" : rest.slice(cut)));
    }
    const label = typeof link.textContent === "string" ? link.textContent.trim() : "";
    if (EMAIL_SHAPE.test(label)) writeText(link, email);
  }
}

export function applyPreviewConfig(doc: PreviewDocument | null | undefined, config: SiteContent = {}) {
  if (!doc) return;
  const brand = text(config.brand);
  const headline = text(config.headline);
  const description = text(config.description);
  const accent = text(config.accent);
  const contactEmail = text(config.contactEmail);
  writeAccent(doc, accent);
  writeBrand(doc, brand);
  writeHeadline(doc, headline);
  writeDescription(doc, description);
  writeTitle(doc, brand, headline);
  writeContactEmail(doc, contactEmail);
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPreviewConfig, type PreviewElement } from '../templates/studio/preview-apply.js';
interface ElementFixture extends PreviewElement {
  tagName: string; textContent: string; innerHTML: string; childElementCount: number; children: ElementFixture[];
  style: {properties: Map<string,string>;setProperty(name:string,value:string):void};
  attributes: Map<string,string>;getAttribute(name:string):string|null;setAttribute(name:string,value:string):void;
}
function makeElement({tagName='span',text='',childrenElements=[],innerHTML,attributes={}}: {
  tagName?:string;text?:string;childrenElements?:ElementFixture[];innerHTML?:string;attributes?:Record<string,string>
}={}):ElementFixture {
 const values=new Map(Object.entries(attributes));
 return {tagName,textContent:text,innerHTML:innerHTML===undefined?text:innerHTML,childElementCount:childrenElements.length,children:childrenElements,
  style:{properties:new Map<string,string>(),setProperty(name,value){this.properties.set(name,String(value));}},
  getAttribute(name){return values.get(name)??null;},setAttribute(name,value){values.set(name,String(value));},attributes:values};
}
interface DocumentSpec {
 title?:string;brands?:ElementFixture[];mainHeading?:ElementFixture|null;heading?:ElementFixture|null;meta?:ElementFixture|null;footerSpans?:ElementFixture[];mailtos?:ElementFixture[];paragraphs?:Record<string,ElementFixture[]>;documentElement?:ElementFixture|null;body?:ElementFixture|null;
}
function makeDocument(spec:DocumentSpec={}) {
 const brands=spec.brands||[],mainHeading=spec.mainHeading||null,fallbackHeading=spec.heading||null,meta=spec.meta||null,footerSpans=spec.footerSpans||[],mailtos=spec.mailtos||[],paragraphs=spec.paragraphs||{};
 return {title:spec.title||'',documentElement:spec.documentElement===undefined?makeElement():spec.documentElement,body:spec.body===undefined?makeElement():spec.body,
  querySelectorAll(selector:string){if(selector==='.brand')return brands;if(selector==='.footer > span')return footerSpans;if(selector==='a[href^="mailto:"]')return mailtos;return paragraphs[selector]||[];},
  querySelector(selector:string){if(selector==='main h1')return mainHeading;if(selector==='h1')return fallbackHeading||mainHeading;if(selector==='meta[name="description"]')return meta;return null;}};
}

const copy = {
  brand: "North Star",
  headline: "Make the next clear thing.",
  description: "A small studio for identities, websites and useful products.",
  accent: "#c3462c",
  contactEmail: "hi@northstar.example",
};

test("preview applies brand, headline, description, accent and title", () => {
  const headerBrand = makeElement({ text: "Orbit" });
  const footerBrand = makeElement({ text: "Orbit" });
  const heading = makeElement({ text: "Your next release starts here." });
  const heroParagraph = makeElement({ text: "Original example copy." });
  const meta = makeElement({ attributes: { content: "Original example copy." } });
  const footerSpan = makeElement({ text: "Original example copy." });
  const doc = makeDocument({
    title: "Orbit — Your next release starts here.",
    brands: [headerBrand, footerBrand],
    mainHeading: heading,
    meta,
    footerSpans: [footerSpan],
    paragraphs: { "section.hero > p": [heroParagraph] },
  });
  applyPreviewConfig(doc, copy);
  assert.equal(headerBrand.textContent, copy.brand);
  assert.equal(footerBrand.textContent, copy.brand);
  assert.equal(heading.textContent, copy.headline);
  assert.equal(heroParagraph.textContent, copy.description);
  assert.equal(meta.getAttribute("content"), copy.description);
  assert.equal(footerSpan.textContent, copy.description);
  assert.equal(doc.title, copy.brand + " — " + copy.headline);
  assert.equal(doc.documentElement!.style.properties.get("--accent"), copy.accent);
  assert.equal(doc.body!.style.properties.get("--accent"), copy.accent);
});

test("preview writes the text-only wordmark span of icon brands", () => {
  const icon = makeElement({ tagName: "svg", innerHTML: "<path></path>" });
  const wordmark = makeElement({ tagName: "span", text: "Paperplane" });
  const plainFooterBrand = makeElement({ text: "Paperplane" });
  const brand = makeElement({
    tagName: "a",
    childrenElements: [icon, wordmark],
    innerHTML: "<svg><path></path></svg><span>Paperplane</span>",
  });
  const doc = makeDocument({ brands: [brand, plainFooterBrand] });
  applyPreviewConfig(doc, copy);
  assert.equal(wordmark.textContent, copy.brand);
  assert.equal(plainFooterBrand.textContent, copy.brand);
  assert.equal(icon.innerHTML, "<path></path>");
  assert.match(brand.innerHTML, /<svg><path><\/path><\/svg>/);
});

test('description overrides keep nested footer wordmarks and target the explicit landing description', () => {
  const wordmark = makeElement({tagName:'span',text:'Littlebrief'});
  const footer = makeElement({tagName:'a',childrenElements:[makeElement({tagName:'svg'}),wordmark]});
  const description = makeElement({tagName:'p',text:'Original copy.'});
  const doc = makeDocument({brands:[footer],paragraphs:{'.footer span':[wordmark],'[data-site-description]':[description]}});
  applyPreviewConfig(doc,copy);
  assert.equal(wordmark.textContent,copy.brand);
  assert.equal(description.textContent,copy.description);
});

test("preview updates exactly one description paragraph from the known layouts", () => {
  const lead = makeElement({ text: "Original lead copy." });
  const studioLede = makeElement({ text: "Original studio copy." });
  const doc = makeDocument({
    paragraphs: { "p.lead": [lead], ".studio-lede > p": [studioLede] },
  });
  applyPreviewConfig(doc, copy);
  assert.equal(lead.textContent, copy.description);
  assert.equal(studioLede.textContent, "Original studio copy.");
});

test("preview skips a description paragraph that holds child elements", () => {
  const decorated = makeElement({
    childrenElements: [makeElement({ tagName: "em" }), makeElement({ tagName: "span" })],
    innerHTML: "<em>Original</em><span>copy.</span>",
  });
  const boardParagraph = makeElement({ text: "Dashboard copy." });
  const doc = makeDocument({
    paragraphs: {
      "section.hero > p": [decorated],
      ".board-header > div > p": [boardParagraph],
    },
  });
  applyPreviewConfig(doc, copy);
  assert.equal(decorated.textContent, "");
  assert.match(decorated.innerHTML, /<em>Original<\/em>/);
  assert.equal(boardParagraph.textContent, copy.description);
});

test("preview rewrites mailto links and keeps generated subject queries", () => {
  const plain = makeElement({ attributes: { href: "mailto:hello@example.com" }, text: "Contact" });
  const withQuery = makeElement({
    attributes: { href: "mailto:hello@example.com?subject=Hi&body=Hello" },
    text: "Discuss this service",
  });
  const addressLabel = makeElement({
    attributes: { href: "mailto:hello@example.com" },
    text: "hello@example.com",
  });
  const doc = makeDocument({ mailtos: [plain, withQuery, addressLabel] });
  applyPreviewConfig(doc, copy);
  assert.equal(plain.getAttribute("href"), "mailto:" + copy.contactEmail);
  assert.equal(
    withQuery.getAttribute("href"),
    "mailto:" + copy.contactEmail + "?subject=Hi&body=Hello",
  );
  assert.equal(plain.textContent, "Contact");
  assert.equal(withQuery.textContent, "Discuss this service");
  assert.equal(addressLabel.getAttribute("href"), "mailto:" + copy.contactEmail);
  assert.equal(addressLabel.textContent, copy.contactEmail);
});

test("preview never rewrites elements that hold child elements", () => {
  const iconBrand = makeElement({
    tagName: "a",
    childrenElements: [makeElement({ tagName: "svg", innerHTML: "<path></path>" })],
    innerHTML: "<svg><path></path></svg>",
  });
  const heading = makeElement({
    childrenElements: [makeElement({ tagName: "span" }), makeElement({ tagName: "em" })],
    innerHTML: "<span>Makes</span><em>things</em>",
  });
  const footerSpan = makeElement({
    childrenElements: [makeElement({ tagName: "b" })],
    innerHTML: "<b>Example</b>",
  });
  const link = makeElement({
    childrenElements: [makeElement({ tagName: "svg", innerHTML: "<path></path>" })],
    innerHTML: "<svg><path></path></svg>",
    attributes: { href: "mailto:hello@example.com" },
  });
  const before = [iconBrand.innerHTML, heading.innerHTML, footerSpan.innerHTML, link.innerHTML];
  const doc = makeDocument({
    brands: [iconBrand],
    mainHeading: heading,
    footerSpans: [footerSpan],
    mailtos: [link],
  });
  applyPreviewConfig(doc, copy);
  assert.deepEqual(
    [iconBrand.innerHTML, heading.innerHTML, footerSpan.innerHTML, link.innerHTML],
    before,
  );
  assert.equal(iconBrand.textContent, "");
  assert.equal(heading.textContent, "");
  assert.equal(footerSpan.textContent, "");
  assert.equal(link.textContent, "");
  assert.equal(link.getAttribute("href"), "mailto:" + copy.contactEmail);
});

test("preview skips empty and missing fields without writing placeholders", () => {
  const brand = makeElement({ text: "Orbit" });
  const heading = makeElement({ text: "Original headline." });
  const paragraph = makeElement({ text: "Original description." });
  const meta = makeElement({ attributes: { content: "Original description." } });
  const footerSpan = makeElement({ text: "Original description." });
  const link = makeElement({
    attributes: { href: "mailto:hello@example.com" },
    text: "Contact",
  });
  const doc = makeDocument({
    title: "Orbit — Original headline.",
    brands: [brand],
    mainHeading: heading,
    meta,
    footerSpans: [footerSpan],
    mailtos: [link],
    paragraphs: { "section.hero > p": [paragraph] },
  });
  applyPreviewConfig(doc, {});
  applyPreviewConfig(doc, {
    brand: "   ",
    headline: "",
    description: " ",
    accent: "",
    contactEmail: "\t",
  });
  assert.equal(brand.textContent, "Orbit");
  assert.equal(heading.textContent, "Original headline.");
  assert.equal(paragraph.textContent, "Original description.");
  assert.equal(meta.getAttribute("content"), "Original description.");
  assert.equal(footerSpan.textContent, "Original description.");
  assert.equal(link.getAttribute("href"), "mailto:hello@example.com");
  assert.equal(link.textContent, "Contact");
  assert.equal(doc.title, "Orbit — Original headline.");
  assert.equal(doc.documentElement!.style.properties.size, 0);
  assert.equal(doc.body!.style.properties.size, 0);
});

test("preview builds a title from whichever fields exist", () => {
  const brandOnly = makeDocument({ title: "Old title" });
  applyPreviewConfig(brandOnly, { brand: "North Star" });
  assert.equal(brandOnly.title, "North Star");
  const headlineOnly = makeDocument({ title: "Old title" });
  applyPreviewConfig(headlineOnly, { headline: "A new headline." });
  assert.equal(headlineOnly.title, "A new headline.");
});

test("preview tolerates documents without body or source markup", () => {
  const doc = { title: "Bare title" };
  applyPreviewConfig(doc, copy);
  assert.equal(doc.title, copy.brand + " — " + copy.headline);
  assert.doesNotThrow(() => applyPreviewConfig(null, copy));
  assert.doesNotThrow(() => applyPreviewConfig(undefined, undefined));
  const noBody = makeDocument({ documentElement: null, body: null });
  assert.doesNotThrow(() => applyPreviewConfig(noBody, copy));
});

test("preview falls back to the first heading when main has none", () => {
  const fallback = makeElement({ text: "Fallback heading." });
  const doc = makeDocument({ heading: fallback });
  applyPreviewConfig(doc, { headline: "Replacement heading." });
  assert.equal(fallback.textContent, "Replacement heading.");
});

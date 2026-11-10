import type { StudioCatalog, StudioTemplate } from '../../../src/types.mjs';
import { applyPreviewConfig } from "./preview-apply.js";
const catalog = await (await fetch("/catalog.json")).json() as StudioCatalog;
interface Selectors {
  '#project': HTMLInputElement;
  '#brand': HTMLInputElement;
  '#headline': HTMLInputElement;
  '#accent': HTMLInputElement;
  '#email': HTMLInputElement;
  '#amount': HTMLInputElement;
  '#template-search': HTMLInputElement;
  '#payment': HTMLSelectElement;
  '#stack': HTMLSelectElement;
  '#currency': HTMLSelectElement;
  '#recipe': HTMLSelectElement;
  '#description': HTMLTextAreaElement;
  '#project-form': HTMLFormElement;
  '.preview-dialog': HTMLDialogElement;
  '.command-details': HTMLDetailsElement;
  '#live-frame': HTMLIFrameElement;
  '#open-preview': HTMLAnchorElement;
}
function $<S extends keyof Selectors>(selector: S): Selectors[S] | null;
function $<T extends HTMLElement = HTMLElement>(selector: string): T | null;
function $(selector: string): HTMLElement | null { return document.querySelector<HTMLElement>(selector); }
function required<S extends keyof Selectors>(selector: S): Selectors[S];
function required<T extends HTMLElement = HTMLElement>(selector: string): T;
function required(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error('Missing template element: ' + selector);
  return element;
}
const $$ = <T extends HTMLElement = HTMLElement>(selector: string): T[] => [...document.querySelectorAll<T>(selector)];
const quote = (s: string) => "'" + String(s).replaceAll("'", "'\\''") + "'";
const form = required("#project-form"),
  dialog = required(".preview-dialog");
let selected = catalog.templates.find((t) => t.id === "pulse")!,
  filter = "all",
  previewed = selected,
  device = "desktop";
function status(text: string) {
  required("#copy-status").textContent = text;
}
function configuration() {
  return {
    schemaVersion: 1,
    name: required("#project").value,
    design: { preset: "editorial", template: selected.id },
    site: {
      brand: required("#brand").value,
      headline: required("#headline").value,
      description: required("#description").value,
      accent: required("#accent").value,
      contactEmail: required("#email").value,
    },
    payments: {
      mode: required("#payment").value,
      ...(required("#payment").value === "none"
        ? {}
        : {
            product: {
              amount: Number(required("#amount").value),
              currency: required("#currency").value,
            },
          }),
    },
    deploy: { provider: required("#stack").value, tier: "preview" },
  };
}
function siteSettings() {
  return {
    brand: required("#brand").value,
    headline: required("#headline").value,
    description: required("#description").value,
    accent: required("#accent").value,
    contactEmail: required("#email").value,
  };
}
const wiredFrames = new WeakSet();
function applyToFrame(frame: HTMLIFrameElement | null) {
  if (!frame) return;
  const run = () => {
    try {
      const frameDocument = frame.contentDocument;
      if (!frameDocument || frameDocument.readyState === "loading") return;
      if (frame.id === "live-frame" && !dialog.open) return;
      applyPreviewConfig(frameDocument, siteSettings());
    } catch {
      // Cross-origin or sandboxed preview: keep the example unchanged.
    }
  };
  if (!wiredFrames.has(frame)) {
    wiredFrames.add(frame);
    frame.addEventListener("load", run);
  }
  run();
}
function visiblePreviewFrames() {
  const frames = [];
  const live = $("#live-frame");
  if (dialog.open && live) frames.push(live);
  for (const card of $$(".template-card"))
    if (!card.hidden) {
      const frame = card.querySelector("iframe");
      if (frame) frames.push(frame);
    }
  return frames;
}
function applyPreviewNow() {
  for (const frame of visiblePreviewFrames()) applyToFrame(frame);
}
let previewTimer = 0;
function schedulePreviewApply() {
  clearTimeout(previewTimer);
  previewTimer = window.setTimeout(applyPreviewNow, 120);
}
function addPreviewNote() {
  if (!dialog || dialog.querySelector("[data-preview-note]")) return;
  const meta = dialog.querySelector("header > div:first-child");
  if (!meta || typeof document.createElement !== "function") return;
  const note = document.createElement("span");
  note.className = "preview-note";
  note.setAttribute("data-preview-note", "");
  note.textContent = "Preview uses your brand and copy.";
  meta.append(note);
}
function update() {
  const stack = catalog.stacks.find((s) => s.id === required("#stack").value)!;
  [...required("#payment").options].forEach(
    (o) => (o.disabled = !stack.payments.some(mode => mode === o.value)),
  );
  if (!stack.payments.some(mode => mode === required("#payment").value))
    required("#payment").value = "none";
  const config = configuration(),
    payment = catalog.payments.find((p) => p.id === config.payments.mode)!;
  required("#stack-note").textContent = stack.runtime;
  required("#payment-note").textContent = payment.description;
  required("#product-settings").hidden = config.payments.mode === "none";
  required("#amount").disabled = config.payments.mode === "none";
  required("#currency").disabled = config.payments.mode === "none";
  required("#data-note").textContent = stack.data;
  required("#compatibility").textContent = "Compatible combination";
  required("#command").textContent =
    "npx --yes opc-harness@" +
    catalog.version +
    " create --dir " +
    quote("./" + config.name) +
    " --name " +
    quote(config.name) +
    " --template " +
    selected.id +
    " --stack " +
    stack.id +
    " --payment " +
    config.payments.mode +
    " --brand " +
    quote(config.site.brand) +
    " --headline " +
    quote(config.site.headline) +
    " --description " +
    quote(config.site.description) +
    " --accent " +
    quote(config.site.accent) +
    " --email " +
    quote(config.site.contactEmail) +
    (config.payments.product
      ? " --amount " +
        config.payments.product.amount +
        " --currency " +
        config.payments.product.currency
      : "") +
    " --host both";
  required("#agent-prompt").textContent =
    "Create a website in ./" +
    config.name +
    " using OPC Harness. Use the " +
    selected.id +
    " template exactly as shown in the gallery, with the " +
    stack.name +
    " stack and " +
    payment.name +
    " payment module. Brand: " +
    config.site.brand +
    ". Headline: " +
    config.site.headline +
    ". Preserve the template layout and interactions. Implement the included workflow and run the relevant checks. Ask for account configuration together when needed.";
  status("");
}
function selectTemplate(t: StudioTemplate, applyDefaults = true) {
  selected = t;
  required("#selected-name").textContent = t.name;
  required("#selected-type").textContent = catalog.frontends.find(
    (f) => f.id === t.type,
  )!.name;
  required("#selected-description").textContent = t.description;
  if (applyDefaults) {
    required("#brand").value = t.brand;
    required("#headline").value = t.headline;
    required("#description").value = t.descriptionText;
    required("#accent").value = t.accent;
    const stack = catalog.stacks.find((s) => s.id === required("#stack").value)!;
    required("#payment").value = stack.payments.includes(t.payment)
      ? t.payment
      : "none";
  }
  $$("[data-select]").forEach((b) => {
    const active = b.dataset.select === t.id;
    b.setAttribute("aria-pressed", String(active));
    b.textContent = active ? "Selected" : "Use template";
    b.closest("article")!.classList.toggle("is-selected", active);
  });
  const refs = required("#references");
  refs.replaceChildren();
  for (const r of t.references) {
    const a = document.createElement("a");
    a.href = r.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = r.name;
    const p = document.createElement("p");
    p.textContent = r.note;
    refs.append(a, p);
  }
  if (!t.references.length) {
    const p = document.createElement("p");
    p.textContent =
      "Open the selected OPC example to inspect this layout directly.";
    refs.append(p);
  }
  update();
  schedulePreviewApply();
}
function filterTemplates() {
  let count = 0;
  const query = required("#template-search").value.toLowerCase();
  $$(".template-card").forEach((card) => {
    const t = catalog.templates.find((t) => t.id === card.dataset.template)!;
    const visible =
      (filter === "all" || t.type === filter) &&
      [t.id, t.name, t.description, ...t.features]
        .join(" ")
        .toLowerCase()
        .includes(query);
    card.hidden = !visible;
    if (visible) count++;
  });
  required("#catalog-count").textContent = count + " matching templates";
  required("#no-templates").hidden = count > 0;
  schedulePreviewApply();
}
$$("[data-filter]").forEach(
  (b) =>
    (b.onclick = () => {
      filter = b.dataset.filter || "all";
      $$("[data-filter]").forEach((x) => {
        x.classList.toggle("active", x === b);
        x.setAttribute("aria-pressed", String(x === b));
      });
      required("#category-title").textContent =
        filter === "all"
          ? "All templates"
          : catalog.frontends.find((x) => x.id === filter)!.name;
      filterTemplates();
    }),
);
required("#template-search").oninput = filterTemplates;
$$("[data-select]").forEach(
  (b) =>
    (b.onclick = () =>
      selectTemplate(catalog.templates.find((t) => t.id === b.dataset.select)!)),
);
required("#stack").onchange = () => {
  update();
};
required("#payment").onchange = update;
for (const id of [
  "project",
  "brand",
  "headline",
  "description",
  "accent",
  "email",
  "amount",
  "currency",
])
  required("#" + id).oninput = update;
for (const id of ["brand", "headline", "description", "accent", "email"])
  required("#" + id).addEventListener("input", schedulePreviewApply);
required("#recipe").onchange = () => {
  const r = catalog.recipes.find((x) => x.id === required("#recipe").value);
  if (!r) return;
  required("#stack").value = r.stack;
  selectTemplate(catalog.templates.find((t) => t.id === r.template)!);
  required("#payment").value = r.payment;
  update();
};
async function copy(text: string | null, message: string) {
  try {
    await navigator.clipboard.writeText(text || "");
    status(message);
  } catch {
    status("Open View command & agent prompt, then select and copy the text.");
    required(".command-details").open = true;
  }
}
form.onsubmit = async (event) => {
  event.preventDefault();
  await copy(
    required("#command").textContent,
    "Create command copied. Run it from your workspace.",
  );
};
required("#copy-prompt").onclick = () => {
  if (form.reportValidity())
    copy(
      required("#agent-prompt").textContent,
      "Agent prompt copied. Paste it into Codex or Claude Code.",
    );
};
required("#download-config").onclick = () => {
  if (!form.reportValidity()) return;
  const blob = new Blob([JSON.stringify(configuration(), null, 2) + "\n"], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "opc-project.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status(
    "Config downloaded. Run: opc-harness create --dir ./" +
      required("#project").value +
      " --project-config ./opc-project.json --host both",
  );
};
function fitLive() {
  const available = required(".live-preview").clientWidth - 32,
    width = device === "mobile" ? 390 : 1280;
  const scale = Math.min(1, available / width);
  const frame = required("#live-frame");
  frame.style.width = width + "px";
  frame.style.height =
    Math.max(650, (required(".live-preview").clientHeight - 24) / scale) + "px";
  frame.style.transform = "scale(" + scale + ")";
  frame.style.marginBottom = -frame.offsetHeight * (1 - scale) + "px";
}
function showPreview(t: StudioTemplate) {
  previewed = t;
  required("#preview-title").textContent = t.name;
  required("#preview-info").textContent = catalog.frontends.find(
    (f) => f.id === t.type,
  )!.name;
  required("#live-frame").src = t.preview;
  required("#open-preview").href = t.preview;
  dialog.showModal();
  fitLive();
  applyToFrame($("#live-frame"));
}
$$("[data-preview]").forEach(
  (b) =>
    (b.onclick = () =>
      showPreview(catalog.templates.find((t) => t.id === b.dataset.preview)!)),
);
required("#preview-selection").onclick = () => showPreview(selected);
required("#close-preview").onclick = () => {
  dialog.close();
  required("#live-frame").src = "about:blank";
};
required("#use-preview").onclick = () => {
  selectTemplate(previewed);
  dialog.close();
  required("#live-frame").src = "about:blank";
};
$$("[data-device]").forEach(
  (b) =>
    (b.onclick = () => {
      device = b.dataset.device || "desktop";
      $$("[data-device]").forEach((x) =>
        x.setAttribute("aria-pressed", String(x === b)),
      );
      fitLive();
      applyToFrame($("#live-frame"));
    }),
);
const resize = new ResizeObserver(() => {
  $$(".preview-frame").forEach((frame) => {
    frame.querySelector("iframe")!.style.transform =
      "scale(" + frame.clientWidth / 1280 + ")";
    frame.style.height = frame.clientWidth * 0.59 + "px";
  });
  if (dialog.open) fitLive();
});
$$(".preview-frame").forEach((x) => resize.observe(x));
resize.observe(required(".live-preview"));
selectTemplate(selected);
addPreviewNote();
$$<HTMLIFrameElement>(".preview-frame iframe, #live-frame").forEach(applyToFrame);
const query = new URLSearchParams(location.search),
  type = query.get("type"),
  template = query.get("template");
if (catalog.frontends.some((f) => f.id === type))
  document.querySelector<HTMLElement>('[data-filter="' + type + '"]')!.click();
if (catalog.templates.some((t) => t.id === template))
  selectTemplate(catalog.templates.find((t) => t.id === template)!);
filterTemplates();

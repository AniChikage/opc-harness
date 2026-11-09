const catalog = await (await fetch("/catalog.json")).json();
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const quote = (s) => "'" + String(s).replaceAll("'", "'\\''") + "'";
const form = $("#project-form"),
  dialog = $(".preview-dialog");
let selected = catalog.templates.find((t) => t.id === "pulse"),
  filter = "all",
  previewed = selected,
  device = "desktop";
function status(text) {
  $("#copy-status").textContent = text;
}
function configuration() {
  return {
    schemaVersion: 1,
    name: $("#project").value,
    design: { preset: "editorial", template: selected.id },
    site: {
      brand: $("#brand").value,
      headline: $("#headline").value,
      description: $("#description").value,
      accent: $("#accent").value,
      contactEmail: $("#email").value,
    },
    payments: {
      mode: $("#payment").value,
      ...($("#payment").value === "none"
        ? {}
        : {
            product: {
              amount: Number($("#amount").value),
              currency: $("#currency").value,
            },
          }),
    },
    deploy: { provider: $("#stack").value, tier: "preview" },
  };
}
function update() {
  const stack = catalog.stacks.find((s) => s.id === $("#stack").value);
  [...$("#payment").options].forEach(
    (o) => (o.disabled = !stack.payments.includes(o.value)),
  );
  if (!stack.payments.includes($("#payment").value))
    $("#payment").value = "none";
  const config = configuration(),
    payment = catalog.payments.find((p) => p.id === config.payments.mode);
  $("#stack-note").textContent = stack.runtime;
  $("#payment-note").textContent = payment.description;
  $("#product-settings").hidden = config.payments.mode === "none";
  $("#amount").disabled = config.payments.mode === "none";
  $("#currency").disabled = config.payments.mode === "none";
  $("#data-note").textContent = stack.data;
  $("#compatibility").textContent = "Compatible combination";
  $("#command").textContent =
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
  $("#agent-prompt").textContent =
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
function selectTemplate(t, applyDefaults = true) {
  selected = t;
  $("#selected-name").textContent = t.name;
  $("#selected-type").textContent = catalog.frontends.find(
    (f) => f.id === t.type,
  ).name;
  $("#selected-description").textContent = t.description;
  if (applyDefaults) {
    $("#brand").value = t.brand;
    $("#headline").value = t.headline;
    $("#description").value = t.descriptionText;
    $("#accent").value = t.accent;
    const stack = catalog.stacks.find((s) => s.id === $("#stack").value);
    $("#payment").value = stack.payments.includes(t.payment)
      ? t.payment
      : "none";
  }
  $$("[data-select]").forEach((b) => {
    const active = b.dataset.select === t.id;
    b.setAttribute("aria-pressed", String(active));
    b.textContent = active ? "Selected" : "Use template";
    b.closest("article").classList.toggle("is-selected", active);
  });
  const refs = $("#references");
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
}
function filterTemplates() {
  let count = 0;
  const query = $("#template-search").value.toLowerCase();
  $$(".template-card").forEach((card) => {
    const t = catalog.templates.find((t) => t.id === card.dataset.template);
    const visible =
      (filter === "all" || t.type === filter) &&
      [t.name, t.description, ...t.features]
        .join(" ")
        .toLowerCase()
        .includes(query);
    card.hidden = !visible;
    if (visible) count++;
  });
  $("#catalog-count").textContent = count + " matching templates";
  $("#no-templates").hidden = count > 0;
}
$$("[data-filter]").forEach(
  (b) =>
    (b.onclick = () => {
      filter = b.dataset.filter;
      $$("[data-filter]").forEach((x) => {
        x.classList.toggle("active", x === b);
        x.setAttribute("aria-pressed", String(x === b));
      });
      $("#category-title").textContent =
        filter === "all"
          ? "All templates"
          : catalog.frontends.find((x) => x.id === filter).name;
      filterTemplates();
    }),
);
$("#template-search").oninput = filterTemplates;
$$("[data-select]").forEach(
  (b) =>
    (b.onclick = () =>
      selectTemplate(catalog.templates.find((t) => t.id === b.dataset.select))),
);
$("#stack").onchange = () => {
  update();
};
$("#payment").onchange = update;
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
  $("#" + id).oninput = update;
$("#recipe").onchange = () => {
  const r = catalog.recipes.find((x) => x.id === $("#recipe").value);
  if (!r) return;
  $("#stack").value = r.stack;
  selectTemplate(catalog.templates.find((t) => t.id === r.template));
  $("#payment").value = r.payment;
  update();
};
async function copy(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    status(message);
  } catch {
    status("Open View command & agent prompt, then select and copy the text.");
    $(".command-details").open = true;
  }
}
form.onsubmit = async (event) => {
  event.preventDefault();
  await copy(
    $("#command").textContent,
    "Create command copied. Run it from your workspace.",
  );
};
$("#copy-prompt").onclick = () => {
  if (form.reportValidity())
    copy(
      $("#agent-prompt").textContent,
      "Agent prompt copied. Paste it into Codex or Claude Code.",
    );
};
$("#download-config").onclick = () => {
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
      $("#project").value +
      " --project-config ./opc-project.json --host both",
  );
};
function fitLive() {
  const available = $(".live-preview").clientWidth - 32,
    width = device === "mobile" ? 390 : 1280;
  const scale = Math.min(1, available / width);
  const frame = $("#live-frame");
  frame.style.width = width + "px";
  frame.style.height =
    Math.max(650, ($(".live-preview").clientHeight - 24) / scale) + "px";
  frame.style.transform = "scale(" + scale + ")";
  frame.style.marginBottom = -frame.offsetHeight * (1 - scale) + "px";
}
function showPreview(t) {
  previewed = t;
  $("#preview-title").textContent = t.name;
  $("#preview-info").textContent = catalog.frontends.find(
    (f) => f.id === t.type,
  ).name;
  $("#live-frame").src = t.preview;
  $("#open-preview").href = t.preview;
  dialog.showModal();
  fitLive();
}
$$("[data-preview]").forEach(
  (b) =>
    (b.onclick = () =>
      showPreview(catalog.templates.find((t) => t.id === b.dataset.preview))),
);
$("#preview-selection").onclick = () => showPreview(selected);
$("#close-preview").onclick = () => {
  dialog.close();
  $("#live-frame").src = "about:blank";
};
$("#use-preview").onclick = () => {
  selectTemplate(previewed);
  dialog.close();
  $("#live-frame").src = "about:blank";
};
$$("[data-device]").forEach(
  (b) =>
    (b.onclick = () => {
      device = b.dataset.device;
      $$("[data-device]").forEach((x) =>
        x.setAttribute("aria-pressed", String(x === b)),
      );
      fitLive();
    }),
);
const resize = new ResizeObserver(() => {
  $$(".preview-frame").forEach((frame) => {
    frame.querySelector("iframe").style.transform =
      "scale(" + frame.clientWidth / 1280 + ")";
    frame.style.height = frame.clientWidth * 0.59 + "px";
  });
  if (dialog.open) fitLive();
});
$$(".preview-frame").forEach((x) => resize.observe(x));
resize.observe($(".live-preview"));
selectTemplate(selected);
const query = new URLSearchParams(location.search),
  type = query.get("type"),
  template = query.get("template");
if (catalog.frontends.some((f) => f.id === type))
  document.querySelector('[data-filter="' + type + '"]').click();
if (catalog.templates.some((t) => t.id === template))
  selectTemplate(catalog.templates.find((t) => t.id === template));
filterTemplates();

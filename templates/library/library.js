const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const key = "opc." + document.body.dataset.template;
const read = (name, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key + "." + name)) ?? fallback;
  } catch {
    return fallback;
  }
};
const save = (name, value) => {
  try {
    localStorage.setItem(key + "." + name, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};
const download = (text, name, type) => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const dialog = $("#detail-dialog");
function details(title, description) {
  $("#detail-title").textContent = title;
  $("#detail-description").textContent = description;
  dialog.showModal();
}
$("[data-close]")?.addEventListener("click", () => dialog.close());
$$("[data-title]").forEach((b) =>
  b.addEventListener("click", () =>
    details(b.dataset.title, b.dataset.description),
  ),
);
let category = "All",
  savedOnly = false;
const saved = new Set(read("favorites", []));
function filter() {
  const query = ($("#search")?.value || "").toLowerCase();
  let count = 0;
  $$("[data-item]").forEach((item) => {
    const match =
      (category === "All" || item.dataset.category === category) &&
      item.textContent.toLowerCase().includes(query) &&
      (!savedOnly || saved.has(item.dataset.key));
    item.hidden = !match;
    if (match) count++;
  });
  if ($("#result-count"))
    $("#result-count").textContent =
      count + (count === 1 ? " resource" : " resources");
  if ($("#empty-results")) $("#empty-results").hidden = count !== 0;
}
$$("[data-filter]").forEach((b) =>
  b.addEventListener("click", () => {
    category = b.dataset.filter;
    $$("[data-filter]").forEach((x) => {
      x.classList.toggle("active", x === b);
      x.setAttribute("aria-pressed", String(x === b));
    });
    if ($("#tasks")) renderTasks();
    else filter();
  }),
);
$("#search")?.addEventListener("input", () => {
  if ($("#tasks")) renderTasks();
  else if (document.body.dataset.template === "docs") filterDocs();
  else filter();
});
$$(".save-resource").forEach((b) => {
  const id = b.closest("[data-key]").dataset.key;
  const update = () => {
    b.setAttribute("aria-pressed", String(saved.has(id)));
    b.textContent = saved.has(id) ? "Saved" : "Save";
  };
  update();
  b.addEventListener("click", () => {
    saved.has(id) ? saved.delete(id) : saved.add(id);
    save("favorites", [...saved]);
    update();
    filter();
  });
});
$("[data-saved]")?.addEventListener("click", (event) => {
  savedOnly = !savedOnly;
  event.currentTarget.setAttribute("aria-pressed", String(savedOnly));
  filter();
});
filter();
const tour = [
  [
    "Your starting point",
    "One idea worth making.",
    "Write the problem, the people it affects, and the outcome that would help them.",
  ],
  [
    "The first useful version",
    "A smaller scope. A clearer plan.",
    "Choose one complete path from the first input to a useful result. Set everything else aside for now.",
  ],
  [
    "Ready to share",
    "A brief you can take with you.",
    "Export the current plan with a launch checklist and one next experiment.",
  ],
];
$$("[data-tour]").forEach((b) =>
  b.addEventListener("click", () => {
    const row = tour[Number(b.dataset.tour)];
    ["#tour-step", "#tour-title", "#tour-copy"].forEach(
      (id, i) => ($(id).textContent = row[i]),
    );
    $$("[data-tour]").forEach((x) =>
      x.setAttribute("aria-pressed", String(x === b)),
    );
  }),
);
const docData = $("#doc-data") ? JSON.parse($("#doc-data").textContent) : [];
$$("[data-doc]").forEach((b) =>
  b.addEventListener("click", () => {
    const article = docData[Number(b.dataset.doc)];
    const heading = document.createElement("h2"),
      p = document.createElement("p");
    heading.textContent = article.name;
    p.textContent = article.description;
    $("#doc-article").replaceChildren(heading, p);
    $$("[data-doc]").forEach((x) => {
      x.classList.toggle("active", x === b);
      x.setAttribute("aria-current", x === b ? "page" : "false");
    });
  }),
);
function filterDocs() {
  const query = $("#search").value.toLowerCase();
  let count = 0;
  $$("[data-doc]").forEach((b) => {
    const article = docData[Number(b.dataset.doc)];
    b.hidden = !(article.name + " " + article.description)
      .toLowerCase()
      .includes(query);
    if (!b.hidden) count++;
  });
  $("#search-status").textContent = count
    ? count + (count === 1 ? " guide" : " guides")
    : "No matching guides.";
}
$("[data-copy-code]")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#code-example").textContent);
    $("#copy-status").textContent = "Outline copied.";
  } catch {
    $("#copy-status").textContent = "Select and copy the command above.";
  }
});
let tasks = read(
  "tasks",
  $("#task-data")
    ? JSON.parse($("#task-data").textContent)
    : [
        {
          id: "first",
          name: "Define the first useful version",
          status: "Planned",
        },
        { id: "second", name: "Build the main path", status: "In progress" },
        { id: "third", name: "Write the project brief", status: "Done" },
      ],
);
function renderTasks() {
  const tbody = $("#tasks");
  if (!tbody) return;
  const query = ($("#search")?.value || "").toLowerCase();
  tbody.replaceChildren();
  const visible = tasks.filter(
    (t) =>
      (category === "All" || t.status === category) &&
      t.name.toLowerCase().includes(query),
  );
  for (const task of visible) {
    const tr = document.createElement("tr"),
      name = document.createElement("td"),
      status = document.createElement("td"),
      action = document.createElement("td"),
      select = document.createElement("select"),
      remove = document.createElement("button");
    name.textContent = task.name;
    select.setAttribute("aria-label", "Status for " + task.name);
    for (const label of ["Planned", "In progress", "Done"]) {
      const o = document.createElement("option");
      o.value = label;
      o.textContent = label;
      o.selected = task.status === label;
      select.append(o);
    }
    select.addEventListener("change", () => {
      task.status = select.value;
      persistTasks("Task updated.");
    });
    remove.textContent = "Delete";
    remove.setAttribute("aria-label", "Delete " + task.name);
    remove.addEventListener("click", () => {
      tasks = tasks.filter((x) => x.id !== task.id);
      persistTasks("Task deleted.");
    });
    status.append(select);
    action.append(remove);
    tr.append(name, status, action);
    tbody.append(tr);
  }
  if (!visible.length) {
    const tr = document.createElement("tr"),
      td = document.createElement("td");
    td.colSpan = 3;
    td.textContent = "No matching tasks. Add one above or change the filter.";
    tr.append(td);
    tbody.append(tr);
  }
}
function persistTasks(message) {
  const stored = save("tasks", tasks);
  renderTasks();
  $("#task-status").textContent = stored
    ? message
    : message +
      " Browser storage is unavailable; export a copy before leaving.";
}
$("#task-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = event.currentTarget.elements.task;
  const name = input.value.trim();
  if (!name) return;
  tasks.push({ id: crypto.randomUUID(), name, status: "Planned" });
  input.value = "";
  persistTasks("Task added.");
});
renderTasks();
$("[data-export-tasks]")?.addEventListener("click", () => {
  const csv = (v) => '"' + v.replaceAll('"', '""') + '"';
  download(
    "Task,Status\r\n" +
      tasks
        .map((t) =>
          [t.name, t.status]
            .map((v) => csv(/^[=+@\-\t\r]/.test(v) ? "'" + v : v))
            .join(","),
        )
        .join("\r\n"),
    "tasks.csv",
    "text/csv",
  );
  $("#task-status").textContent = "Tasks exported.";
});
$("[data-calendar]")?.addEventListener("click", () => {
  const event = JSON.parse($("#event-data").textContent),
    escape = (value) =>
      String(value)
        .replaceAll("\\", "\\\\")
        .replace(/\r?\n/g, "\\n")
        .replaceAll(",", "\\,")
        .replaceAll(";", "\\;"),
    stamp = (value) =>
      new Date(value)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OPC Harness//Event template//EN",
    "BEGIN:VEVENT",
    "UID:" + crypto.randomUUID() + "@templates.example",
    "DTSTAMP:" + stamp(Date.now()),
    "DTSTART:" + stamp(event.startsAt),
    "DTEND:" + stamp(event.endsAt),
    "SUMMARY:" + escape(event.name),
    "DESCRIPTION:" + escape(event.description),
    "LOCATION:" + escape(event.location),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  download(lines.join("\r\n") + "\r\n", "event.ics", "text/calendar");
  $("#calendar-status").textContent =
    "Calendar downloaded. This saves the agenda, not an event registration.";
});
// Orbit product preview: content changes are tied to the selected step.
const orbitSteps = [
  {
    title: "Make space for the idea.",
    description: "Write down who it helps and what gets easier for them.",
    checks: [
      "One real problem",
      "A person who needs it",
      "A useful first result",
    ],
  },
  {
    title: "Choose the smallest useful version.",
    description:
      "Keep the first release focused enough to finish and learn from.",
    checks: [
      "One core workflow",
      "Observable acceptance criteria",
      "Later ideas set aside",
    ],
  },
  {
    title: "Leave with a concrete next step.",
    description:
      "Export your brief and use it to guide the next small experiment.",
    checks: [
      "Review the main path",
      "Export the current brief",
      "Share one useful version",
    ],
  },
];
$$("[data-orbit]").forEach((b) =>
  b.addEventListener("click", () => {
    const step = orbitSteps[Number(b.dataset.orbit)];
    $("#orbit-title").textContent = step.title;
    $("#orbit-description").textContent = step.description;
    $("#orbit-checks").replaceChildren(
      ...step.checks.map((text) => {
        const li = document.createElement("li");
        li.textContent = text;
        return li;
      }),
    );
    $$("[data-orbit]").forEach((x) =>
      x.setAttribute("aria-pressed", String(x === b)),
    );
  }),
);
// Sidecar is intentionally browser-local; no fictitious shared backend or email delivery.
if ($("#contacts-body")) {
  const stages = ["New", "In conversation", "Ready"];
  const initial = [
    {
      id: "sample-1",
      name: "Alex Morgan",
      email: "alex@example.com",
      stage: "In conversation",
      note: "Review the brief next week.",
    },
    {
      id: "sample-2",
      name: "Sam Rivera",
      email: "sam@example.com",
      stage: "New",
      note: "Send a first project outline.",
    },
    {
      id: "sample-3",
      name: "Jordan Lee",
      email: "jordan@example.com",
      stage: "Ready",
      note: "The first version has a clear scope.",
    },
  ];
  const stored = read("contacts", initial);
  let contacts = Array.isArray(stored)
    ? stored.filter(
        (x) =>
          x &&
          typeof x.id === "string" &&
          typeof x.name === "string" &&
          typeof x.email === "string" &&
          stages.includes(x.stage) &&
          typeof x.note === "string",
      )
    : initial;
  const form = $("#contact-form"),
    status = $("#contact-status");
  function resetContact() {
    form.reset();
    form.elements.contactId.value = "";
    $("#contact-form-title").textContent = "Add a contact";
    $("#contact-save").textContent = "Add contact";
    $("#contact-cancel").hidden = true;
  }
  function editContact(contact) {
    form.elements.contactId.value = contact.id;
    for (const field of ["name", "email", "stage", "note"])
      form.elements[field].value = contact[field];
    $("#contact-form-title").textContent = "Edit contact";
    $("#contact-save").textContent = "Save changes";
    $("#contact-cancel").hidden = false;
    form.elements.name.focus();
  }
  function renderContacts() {
    const query = $("#contact-search").value.toLowerCase(),
      stage = $("#contact-filter").value;
    const visible = contacts.filter(
      (x) =>
        (stage === "All stages" || x.stage === stage) &&
        [x.name, x.email, x.note].join(" ").toLowerCase().includes(query),
    );
    $("#contact-total").textContent = contacts.length;
    $("#contact-open").textContent = contacts.filter(
      (x) => x.stage === "In conversation",
    ).length;
    $("#contact-ready").textContent = contacts.filter(
      (x) => x.stage === "Ready",
    ).length;
    const tbody = $("#contacts-body");
    tbody.replaceChildren();
    for (const contact of visible) {
      const tr = document.createElement("tr");
      for (const value of [contact.name, contact.email, contact.stage]) {
        const td = document.createElement("td");
        if (value === contact.stage) {
          const badge = document.createElement("span");
          badge.className = "contact-badge";
          badge.textContent = value;
          td.append(badge);
        } else td.textContent = value;
        tr.append(td);
      }
      const actions = document.createElement("td");
      for (const [label, action] of [
        ["Edit", () => editContact(contact)],
        [
          "Delete",
          () => {
            contacts = contacts.filter((x) => x.id !== contact.id);
            if (form.elements.contactId.value === contact.id) resetContact();
            persistContacts("Contact deleted.");
          },
        ],
      ]) {
        const b = document.createElement("button");
        b.textContent = label;
        b.setAttribute("aria-label", label + " " + contact.name);
        b.onclick = action;
        actions.append(b);
      }
      tr.append(actions);
      tbody.append(tr);
    }
    if (!visible.length) {
      const tr = document.createElement("tr"),
        td = document.createElement("td");
      td.colSpan = 4;
      td.textContent =
        "No matching contacts. Add a contact or change your filters.";
      tr.append(td);
      tbody.append(tr);
    }
  }
  function persistContacts(message) {
    const stored = save("contacts", contacts);
    renderContacts();
    status.textContent =
      message +
      (stored
        ? ""
        : " Browser storage is unavailable; export a copy before leaving.");
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = Object.fromEntries(new FormData(form));
    const contact = {
      id: value.contactId || crypto.randomUUID(),
      name: value.name.trim(),
      email: value.email.trim(),
      stage: value.stage,
      note: value.note.trim(),
    };
    if (!contact.name || !contact.email || !stages.includes(contact.stage))
      return;
    const index = contacts.findIndex((x) => x.id === contact.id);
    if (index >= 0) contacts[index] = contact;
    else contacts.push(contact);
    resetContact();
    persistContacts(index >= 0 ? "Contact updated." : "Contact added.");
  });
  $("#contact-cancel").onclick = resetContact;
  $("#contact-search").oninput = renderContacts;
  $("#contact-filter").onchange = renderContacts;
  $$("[data-export-contacts]").forEach(
    (b) =>
      (b.onclick = () => {
        const cell = (value) =>
          '"' +
          (/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll(
            '"',
            '""',
          ) +
          '"';
        download(
          "Name,Email,Stage,Note\r\n" +
            contacts
              .map((x) =>
                [x.name, x.email, x.stage, x.note].map(cell).join(","),
              )
              .join("\r\n"),
          "contacts.csv",
          "text/csv",
        );
        status.textContent = "Contacts exported.";
      }),
  );
  renderContacts();
}

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

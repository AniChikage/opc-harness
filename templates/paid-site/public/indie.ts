import { stageBrief, type BriefInput } from './brief-handoff.js';

const template = document.body.dataset.template;
const query = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector);
const all = <T extends Element = HTMLElement>(selector: string) => [...document.querySelectorAll<T>(selector)];
function status(selector: string, text: string, error = false) {
  const node = query(selector);
  if (node) { node.textContent = text; node.classList.toggle('error', error); }
}
function continueBrief(brief: BriefInput, message: string) {
  try {
    if (stageBrief(sessionStorage, location.href, brief)) {
      location.assign(new URL('workspace.html#workspace', location.href)); return;
    }
  } catch { /* Browser storage may be disabled. Keep the user's inputs visible. */ }
  status(message, 'This browser blocked draft transfer. Keep a copy of your text, then open the workspace above.', true);
}
const reading: BriefInput = {
  idea: 'A small reading notebook to keep the passages worth remembering close at hand.',
  audience: 'Readers who want to put useful ideas into practice.',
  outcome: 'Save one useful passage and decide what to try next.',
};
const workshop: BriefInput = {
  idea: 'A simple website for a weekend workshop.',
  audience: 'People who want to learn and get hands-on practice.',
  outcome: 'Help people sign up and show what to expect.',
};
function petal() {
  const note = query<HTMLTextAreaElement>('#petal-note'), output = query('#petal-result');
  if (!note || !output) return;
  let mode = 'clarify';
  function apply() {
    if (!note || !output) return;
    const text = note.value.trim();
    if (!text) { status('#petal-status', 'Write an idea before applying a writing mode.', true); return; }
    const normalized = text.replace(/\s+/g, ' ');
    output.textContent = mode === 'shorten'
      ? normalized.length <= 150 ? normalized : normalized.slice(0, 147).trimEnd() + '…'
      : mode === 'checklist'
        ? text.split(/\n+|(?<=[.!?])\s+/).map(item => item.trim()).filter(Boolean).map(item => '• ' + item).join('\n')
        : normalized;
    status('#petal-status', { clarify: 'Spacing cleaned up. Your meaning is unchanged.', shorten: 'A shorter excerpt of your idea. No AI service is called.', checklist: 'Your sentences, arranged as a checklist.' }[mode] || 'Preview updated.');
  }
  query<HTMLFormElement>('#petal-form')?.addEventListener('submit', event => { event.preventDefault(); apply(); });
  all<HTMLButtonElement>('[data-petal-mode]').forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.petalMode || 'clarify';
    all('[data-petal-mode]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    apply();
  }));
  query('#petal-reset')?.addEventListener('click', () => { note.value = reading.idea; apply(); });
  query('#petal-continue')?.addEventListener('click', () => {
    if (!note.reportValidity()) return;
    continueBrief(note.value.trim() === reading.idea ? reading : {
      idea: note.value,
      audience: 'The people this project is intended to help.',
      outcome: 'Create the smallest useful version of this idea.',
    }, '#petal-status');
  });
}
function gauge() {
  query<HTMLFormElement>('#gauge-start')?.addEventListener('submit', event => {
    event.preventDefault();
    const input = query<HTMLInputElement>('#gauge-idea');
    if (input?.reportValidity()) continueBrief({idea:input.value,audience:'The people this project is intended to help.',outcome:'Ship a focused first version.'}, '#gauge-start-status');
  });
  const inputs = all<HTMLInputElement>('[data-release-task]');
  const show = query<HTMLInputElement>('#gauge-show-done');
  function update() {
    const done = inputs.filter(input => input.checked).length;
    const percent = Math.round(done / inputs.length * 100);
    const remaining = inputs.length - done;
    const values: Record<string, string> = { '#gauge-percent': `${percent}%`, '#gauge-complete': `${done} of ${inputs.length}`, '#gauge-remaining': `${remaining} ${remaining === 1 ? 'task' : 'tasks'}` };
    for (const [selector, text] of Object.entries(values)) { const node = query(selector); if (node) node.textContent = text; }
    inputs.forEach(input => {
      const row = input.closest<HTMLElement>('.release-task');
      if (row) { row.hidden = !show?.checked && input.checked; const label = row.querySelector('.task-state'); if (label) label.textContent = input.checked ? 'Done' : 'To do'; }
    });
    let cumulative = 0;
    const points = ['35 120', ...inputs.map((input, i) => { if (input.checked) cumulative += 25; return `${190 + i * 155} ${120 - cumulative}`; })];
    query('#gauge-line')?.setAttribute('d', 'M' + points.join(' '));
    query('#gauge-area')?.setAttribute('d', 'M' + points.join(' ') + 'V120Z');
    query('#gauge-chart')?.setAttribute('aria-label', `Readiness is ${percent} percent`);
    status('#gauge-status', `${done} of ${inputs.length} sample tasks complete.${done === inputs.length ? ' All sample tasks are ready.' : ''}`);
  }
  inputs.forEach(input => input.addEventListener('change', update));
  show?.addEventListener('change', update);
  query('#gauge-reset')?.addEventListener('click', () => { inputs.forEach((input, i) => { input.checked = i < 3; }); if (show) show.checked = true; update(); });
  update();
}
function scribble() {
  const form = query<HTMLFormElement>('#scribble-form');
  if (!form) return;
  const fields = { idea: query<HTMLTextAreaElement>('#scribble-idea')!, audience: query<HTMLTextAreaElement>('#scribble-audience')!, outcome: query<HTMLTextAreaElement>('#scribble-outcome')! };
  const values = (): BriefInput => ({ idea: fields.idea.value, audience: fields.audience.value, outcome: fields.outcome.value });
  form.addEventListener('input', () => {
    const input = values();
    for (const field of ['idea', 'audience', 'outcome'] as const) {
      const node = query(`[data-brief-preview="${field}"]`); if (node) node.textContent = input[field].trim() || 'Your answer will appear here.';
    }
  });
  form.addEventListener('submit', event => { event.preventDefault(); if (form.reportValidity()) continueBrief(values(), '#scribble-status'); });
}
function letterline() {
  all<HTMLButtonElement>('[data-note]').forEach(button => button.addEventListener('click', () => continueBrief(button.dataset.note === 'reading' ? reading : workshop, '#letter-status')));
}
function nocturne() {
  const stage = query<HTMLElement>('.nocturne-stage');
  if (!stage) return;
  const buttons = all<HTMLButtonElement>('[data-walkthrough-step]');
  const captions = ['Put your thoughts in one place.', 'Give the idea a focused first version.', 'Take a plan you can build on.'];
  const titles = ['A rough idea, written down.', 'A little structure. A clearer direction.', 'A brief, ready for your next step.'];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let step = 0, paused = reduced.matches, visible = true, focused = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function render() {
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === step)));
    all<HTMLElement>('[data-scene]').forEach(scene => { scene.hidden = Number(scene.dataset.scene) !== step; });
    const caption = query('#walkthrough-caption'), title = query('#walkthrough-title'), progress = query('#walkthrough-progress');
    if (caption) caption.textContent = captions[step]; if (title) title.textContent = titles[step]; if (progress) progress.textContent = `0${step + 1} / 03`;
    const motion = query('#walkthrough-motion');
    if (motion) { motion.textContent = paused ? 'Play animation' : 'Pause animation'; motion.setAttribute('aria-pressed', String(paused)); }
  }
  function schedule() {
    clearTimeout(timer);
    if (!paused && visible && !focused && !document.hidden) timer = setTimeout(() => { step = (step + 1) % 3; render(); schedule(); }, 3200);
  }
  buttons.forEach((button, i) => button.addEventListener('click', () => { step = i; render(); schedule(); }));
  query('#walkthrough-motion')?.addEventListener('click', () => { paused = !paused; render(); schedule(); });
  reduced.addEventListener('change', () => { paused = reduced.matches; render(); schedule(); });
  document.addEventListener('visibilitychange', schedule);
  stage.addEventListener('focusin', () => { focused = true; schedule(); });
  stage.addEventListener('focusout', () => { focused = false; schedule(); });
  const observer = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; schedule(); }, { threshold: 0 });
  observer.observe(stage);
  window.addEventListener('pagehide', () => { clearTimeout(timer); observer.disconnect(); });
  render(); schedule();
}
if (template === 'petal') petal();
if (template === 'gauge') gauge();
if (template === 'scribble') scribble();
if (template === 'letterline') letterline();
if (template === 'nocturne') nocturne();

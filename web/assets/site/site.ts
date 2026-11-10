// OPC Harness site: live previews, delivery comparisons and copy buttons.

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const DEFAULT_RATIO = 0.625;

/* ---------- live template previews ---------- */

function scaleScreens() {
  for (const screen of document.querySelectorAll<HTMLElement>("[data-screen]")) {
    const width = screen.clientWidth;
    if (!width) continue;
    const reference = Number(screen.dataset.ref || 1280);
    const ratio = Number(screen.dataset.ratio || DEFAULT_RATIO);
    screen.style.height = Math.round(width * ratio) + "px";
    const frame = screen.querySelector("iframe");
    if (frame) frame.style.transform = "scale(" + width / reference + ")";
  }
}

let scaleTimer = 0;
function scheduleScale() {
  clearTimeout(scaleTimer);
  scaleTimer = window.setTimeout(scaleScreens, 80);
}

scaleScreens();
window.addEventListener("resize", scheduleScale);
if (document.fonts && document.fonts.ready)
  document.fonts.ready.then(scheduleScale).catch(() => {});
for (const frame of document.querySelectorAll("[data-screen] iframe"))
  frame.addEventListener("load", scheduleScale, { once: true });

/* ---------- copy buttons ---------- */

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  }
}

document.addEventListener("click", async (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLElement>("[data-copy]");
  if (!button) return;
  const value = button.getAttribute("data-copy") || "";
  const original = button.textContent;
  const copied = await copyText(value);
  button.textContent = copied ? "Copied" : "Copy failed";
  setTimeout(() => {
    button.textContent = original;
  }, 1600);
});


/* ---------- compare a delivery path ---------- */

const comparisonTabs = [...document.querySelectorAll<HTMLButtonElement>('[data-compare]')];
function selectComparison(tab: HTMLButtonElement, focus = false) {
  const panel = document.getElementById(tab.getAttribute('aria-controls') || '');
  if (!panel) return;
  for (const item of comparisonTabs) {
    const active = item === tab;
    item.setAttribute('aria-selected', String(active));
    item.tabIndex = active ? 0 : -1;
    const target = document.getElementById(item.getAttribute('aria-controls') || '');
    if (target) {
      target.hidden = !active;
      target.classList.remove('comparison-enter');
    }
  }
  if (!reduceMotion) panel.classList.add('comparison-enter');
  if (focus) tab.focus();
  const announcement = document.querySelector('.comparison-announcement');
  if (announcement) announcement.textContent = tab.dataset.compare === 'deploy' ? 'Deployment workflow selected.' : tab.dataset.compare![0].toUpperCase() + tab.dataset.compare!.slice(1) + ' workflow selected.';
  requestAnimationFrame(scaleScreens);
}
for (const [index, tab] of comparisonTabs.entries()) {
  tab.addEventListener('click', () => selectComparison(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % comparisonTabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + comparisonTabs.length) % comparisonTabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = comparisonTabs.length - 1;
    else return;
    event.preventDefault();
    selectComparison(comparisonTabs[next], true);
  });
}

/* ---------- an automatic, repeating delivery demonstration ---------- */

const workflowDemo = document.querySelector<HTMLElement>('[data-workflow-demo]');
if (workflowDemo) {
  const demo = workflowDemo;
  function required<T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = demo): T {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error('Missing workflow element: ' + selector);
    return element;
  }
  // Compare repeated manual decisions with reusing an already configured path.
  // These are illustration timings, not measured website build times.
  const duration = 6000, phaseLength = 600, deliveryLength = phaseLength * 3;
  const manualStageLength = 1600, manualPromptLength = manualStageLength / 2;
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const rows = [...demo.querySelectorAll<HTMLElement>('[data-demo-stage]')];
  const manualStages = [
    { waiting: 'Choose a design', prompts: ['Describe the layout.', 'Fix the spacing.'], statuses: ['Describing design', 'Revising design'], done: 'Design approved' },
    { waiting: 'Waiting on design', prompts: ['Add Stripe Checkout.', 'Check the webhook.'], statuses: ['Connecting payments', 'Checking webhook'], done: 'Payment flow checked' },
    { waiting: 'Waiting on payments', prompts: ['Set up Cloudflare.', 'Verify the live URL.'], statuses: ['Setting up deployment', 'Verifying preview'], done: 'Preview verified' },
  ];
  const manualDeliveryLength = manualStageLength * manualStages.length;
  const stages = [
    { waiting: 'Finished design', active: 'Applying design', done: 'Design applied' },
    { waiting: 'Stripe test recipe', active: 'Wiring payments', done: 'Stripe recipe ready' },
    { waiting: 'Deploy + verify', active: 'Preparing preview', done: 'Preview verified' },
  ];
  const manualCells = rows.map(row => ({
    cell: required('[data-manual-state]', row),
    line: required('.overview-manual-line', row),
    icon: required('[data-manual-icon]', row),
  }));
  const manualOutcome = required('[data-demo-manual-outcome]');
  const manualTrack = required('[data-manual-progress]');
  const manualPercent = required('[data-demo-manual-percent]');
  const track = required('[data-harness-progress]');
  const percent = required('[data-demo-percent]');
  const outcome = required('[data-demo-outcome]');
  let elapsed = motionPreference.matches ? duration : 0;
  let inView = true, frame = 0, startedAt = 0, cycles = 0;

  const smooth = (value: number) => {
    const bounded = Math.max(0, Math.min(1, value));
    return bounded * bounded * (3 - 2 * bounded);
  };

  function paint(time: number) {
    // A frame timestamp can slightly precede the request made in this frame.
    time = Math.max(0, time);
    const motionOpacity = motionPreference.matches ? 1 : Math.min(
      cycles ? smooth(time / 180) : 1,
      smooth((duration - time) / 450),
    );
    // Reset only after the changing layers fade; the content stays readable.
    demo.style.setProperty('--motion-opacity', String(motionOpacity));
    const delivered = time >= deliveryLength;
    const deliveryProgress = Math.min(1, time / deliveryLength);
    const progressPercent = delivered ? 100 : Math.min(99, Math.floor(deliveryProgress * 100));
    demo.style.setProperty('--demo-progress', String(deliveryProgress));
    track.setAttribute('aria-valuenow', String(progressPercent));
    percent.textContent = progressPercent + '%';
    const manualDelivered = time >= manualDeliveryLength;
    const manualProgress = Math.min(1, time / manualDeliveryLength);
    const manualProgressPercent = manualDelivered ? 100 : Math.min(99, Math.floor(manualProgress * 100));
    demo.style.setProperty('--manual-progress', String(manualProgress));
    demo.dataset.manualComplete = String(manualDelivered);
    manualTrack.setAttribute('aria-valuenow', String(manualProgressPercent));
    manualPercent.textContent = manualProgressPercent + '%';
    let manualStatus = 'Preview ready';
    let manualStatusOpacity = motionPreference.matches ? 1 : smooth((time - manualDeliveryLength) / 120);
    manualCells.forEach(({ cell, line, icon }, index) => {
      const stage = manualStages[index];
      const local = time - index * manualStageLength;
      const state = local < 0 ? 'waiting' : local >= manualStageLength ? 'done' : 'active';
      cell.dataset.manualState = state;
      let message, opacity;
      if (state === 'waiting') {
        message = stage.waiting;
        opacity = smooth(-local / 120);
      } else if (state === 'done') {
        message = stage.done;
        opacity = smooth((local - manualStageLength) / 120);
      } else {
        const prompt = Math.min(stage.prompts.length - 1, Math.floor(local / manualPromptLength));
        const promptTime = local - prompt * manualPromptLength;
        message = stage.prompts[prompt];
        opacity = Math.min(
          index || prompt ? smooth(promptTime / 120) : 1,
          smooth((manualPromptLength - promptTime) / 120),
        );
        manualStatus = stage.statuses[prompt];
        manualStatusOpacity = opacity;
      }
      if (line.textContent !== message) line.textContent = message;
      line.style.opacity = String(motionOpacity * (motionPreference.matches ? 1 : opacity));
      icon.textContent = state === 'done' ? '✓' : state === 'active' ? '↻' : '·';
      rows[index].style.setProperty('--retry-turn', (motionPreference.matches || state !== 'active' ? 0 : smooth((local % manualPromptLength) / 450) * 360) + 'deg');
    });
    if (manualOutcome.textContent !== manualStatus) manualOutcome.textContent = manualStatus;
    manualOutcome.style.opacity = String(motionOpacity * manualStatusOpacity);
    rows.forEach((row, index) => {
      const local = time - index * phaseLength;
      const progress = Math.max(0, Math.min(1, local / phaseLength));
      const state = local < 0 ? 'waiting' : progress >= 1 ? 'done' : 'active';
      row.dataset.demoRowState = state;
      row.style.setProperty('--row-progress', String(motionPreference.matches ? Number(progress > 0) : progress));
      const label = required('[data-demo-result]', row);
      if (label.textContent !== stages[index][state]) label.textContent = stages[index][state];
      required('.overview-check', row).textContent = progress >= 1 ? '✓' : state === 'active' ? '→' : '·';
    });
    demo.dataset.demoState = delivered ? 'complete' : 'playing';
    const currentStage = Math.min(stages.length - 1, Math.floor(time / phaseLength));
    const result = delivered ? 'Preview ready' : stages[currentStage].active;
    if (outcome.textContent !== result) outcome.textContent = result;
  }

  function stop() {
    if (!frame) return;
    const total = Math.max(0, elapsed + performance.now() - startedAt);
    cycles += Math.floor(total / duration);
    elapsed = total % duration;
    cancelAnimationFrame(frame);
    frame = 0;
    paint(elapsed);
  }

  function tick(now: number) {
    const total = Math.max(0, elapsed + now - startedAt);
    const time = total % duration;
    if (total >= duration) {
      cycles += Math.floor(total / duration);
      elapsed = time;
      startedAt = now;
    }
    paint(time);
    frame = requestAnimationFrame(tick);
  }

  function reconcile() {
    if (motionPreference.matches) {
      stop();
      elapsed = duration;
      paint(duration);
      return;
    }
    if (inView && !document.hidden) {
      if (!frame) {
        if (elapsed >= duration) {
          elapsed = 0;
          cycles = 0;
        }
        startedAt = performance.now();
        frame = requestAnimationFrame(tick);
      }
    } else stop();
  }

  document.addEventListener('visibilitychange', reconcile);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting && entries[0].intersectionRatio >= 0.15;
      reconcile();
    }, { threshold: 0.15 }).observe(demo);
  }
  motionPreference.addEventListener('change', reconcile);
  paint(elapsed);
  reconcile();
}

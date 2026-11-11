import type { TemplateDefinition, Reference } from './types.mjs';

export const INDIE_IDS = ['petal', 'gauge', 'scribble', 'letterline', 'nocturne'] as const;
export type IndieTemplateId = typeof INDIE_IDS[number];
export const isIndieTemplate = (id: string): id is IndieTemplateId =>
  (INDIE_IDS as readonly string[]).includes(id);

export const INDIE_TEMPLATES: readonly TemplateDefinition[] = [
  { id: 'petal', name: 'Petal', category: 'Landing',
    description: 'A soft pink native-tool landing with an editable brief preview and three working writing modes.',
    brand: 'Petal', headline: 'Give your ideas a softer landing.',
    descriptionText: 'Turn scattered ideas into a useful project brief, so you can start with clarity and move forward faster.',
    accent: '#b03d7c', payment: 'none', features: ['Editable preview', 'Writing modes', 'Draft handoff', 'Brief workspace'] },
  { id: 'gauge', name: 'Gauge', category: 'Landing',
    description: 'A warm, data-led product page with a working release checklist and computed readiness chart.',
    brand: 'Gauge', headline: 'Know what is ready to ship.',
    descriptionText: 'Turn scattered ideas into a useful project brief so you can plan, build, and ship with clarity.',
    accent: '#b95032', payment: 'none', features: ['Quick-start form', 'Live checklist', 'Readiness chart', 'Brief workspace'] },
  { id: 'scribble', name: 'Littlebrief', category: 'Landing',
    description: 'An airy hand-drawn form page with a live three-question brief and a safe handoff to the editor.',
    brand: 'Littlebrief', headline: 'Small questions. Clearer ideas.',
    descriptionText: 'Turn scattered ideas into a useful project brief in just a few simple questions.',
    accent: '#2759bb', payment: 'none', features: ['Original vector doodles', 'Live form preview', 'Draft handoff', 'Brief workspace'] },
  { id: 'letterline', name: 'Letterline', category: 'Landing',
    description: 'A quiet editorial landing with oversized type, readable sample notes and no decorative dashboard.',
    brand: 'Letterline', headline: 'Less noise. More focus. Better ideas.',
    descriptionText: 'Turn scattered ideas into a useful project brief you can share, build on, and use right away.',
    accent: '#1a54c4', payment: 'none', features: ['Editorial typography', 'Expandable notes', 'Sample brief handoff', 'Brief workspace'] },
  { id: 'nocturne', name: 'Nocturne', category: 'Landing',
    description: 'A premium dark product page with an automatic, accessible three-stage animated walkthrough.',
    brand: 'Nocturne', headline: 'A clearer story for every new idea.',
    descriptionText: 'Turn scattered ideas into a useful project brief so you can move from a first thought to a shared plan, faster.',
    accent: '#7e4bd7', payment: 'none', features: ['Automatic walkthrough', 'Step controls', 'Reduced motion support', 'Brief workspace'] },
];

// Independent visual references, shown only in the catalogue, never in generated sites.
export const INDIE_REFERENCES: Record<IndieTemplateId, Reference[]> = {
  petal: [{ name: '#03 · Snapok', url: 'https://snapok.app/', note: 'Soft pink native-product composition. Original brand, copy, vector assets and brief-editing behavior.' }],
  gauge: [{ name: '#06 · DataFast', url: 'https://datafa.st/', note: 'Warm white, strong type and a product-led dashboard. The preview uses a local sample checklist, not analytics or revenue claims.' }],
  scribble: [{ name: '#16 · Tally', url: 'https://tally.so/', note: 'White space, friendly form rhythm and drawn accents. Original pencil, kite and paper marks; no source illustrations.' }],
  letterline: [{ name: '#18 · Buttondown', url: 'https://buttondown.com/', note: 'Sparse editorial typography and blue accents. Original project-note content; no newsletter subscription backend is implied.' }],
  nocturne: [{ name: '#19 · Screen Studio', url: 'https://screen.studio/', note: 'Black, violet and a large product demonstration. Original code-native walkthrough, not the source video or a native app.' }],
};

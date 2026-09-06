/*
 * GEOTECH HR — Design System Builder
 *
 * Run once inside Figma. It builds the portal's design system as real, editable
 * Figma objects: paint styles, text styles, and components for every primitive
 * the application actually uses.
 *
 * Everything here is read straight out of src/styles/theme.css and
 * src/app/App.tsx, so what you get in Figma matches what ships.
 *
 * Two palettes are created side by side on purpose:
 *   Implemented — the corporate blue the app renders today
 *   GEOTECH     — the official gold/graphite brand identity
 * The audit flagged that these disagree. Seeing both is the point; pick one.
 */

// ─── Tokens ────────────────────────────────────────────────────────────────
// Values below are the real ones. Do not "tidy" them without changing theme.css.

const IMPLEMENTED = {
  background: '#F5F7FA',
  foreground: '#14181F',
  card: '#FFFFFF',
  primary: '#1D4E89',
  'primary-foreground': '#FFFFFF',
  secondary: '#F1F4F8',
  muted: '#F1F4F8',
  'muted-foreground': '#64748B',
  accent: '#EDF2FB',
  'accent-foreground': '#1D4E89',
  destructive: '#B91C1C',
  'destructive-foreground': '#FFFFFF',
  border: '#E2E8F0',
  'input-background': '#FFFFFF',
  ring: '#1D4E89',
};

// From the logo artwork. See GEO EGYPT BRANDING MATERIALS.
const GEOTECH = {
  gold: '#A0840D',
  'gold-dark': '#6D5B07',
  graphite: '#626366',
  charcoal: '#231F20',
  silver: '#929497',
};

// Status colours, taken from the badge and alert components in App.tsx.
const STATUS = {
  'status-pending': '#B45309',
  'status-pending-bg': '#FEF3C7',
  'status-approved': '#15803D',
  'status-approved-bg': '#DCFCE7',
  'status-rejected': '#B91C1C',
  'status-rejected-bg': '#FEE2E2',
  'status-active': '#15803D',
  'status-inactive': '#64748B',
};

const RADIUS = { sm: 4, md: 6, lg: 8, xl: 12, full: 999 };

// The type scale the app renders, in px.
const TEXT_STYLES = [
  { name: 'Display / 2xl',    size: 24, weight: 'Semi Bold', lh: 32 },
  { name: 'Heading / xl',     size: 20, weight: 'Semi Bold', lh: 28 },
  { name: 'Heading / lg',     size: 18, weight: 'Semi Bold', lh: 26 },
  { name: 'Body / base',      size: 16, weight: 'Regular',   lh: 24 },
  { name: 'Body / sm',        size: 14, weight: 'Regular',   lh: 20 },
  { name: 'Label / sm',       size: 14, weight: 'Medium',    lh: 20 },
  { name: 'Caption / xs',     size: 12, weight: 'Regular',   lh: 16 },
  { name: 'Caption / xs bold',size: 12, weight: 'Semi Bold', lh: 16 },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

function solid(hex) {
  return [{ type: 'SOLID', color: hexToRgb(hex) }];
}

let FONT = { family: 'Inter', style: 'Regular' };

async function loadFonts() {
  // Graphik is the brand face but is not on Figma's free font list, so the file
  // is built in Inter and the designer swaps the family once. Falls back again
  // to Roboto if this workspace has neither.
  const candidates = ['Inter', 'Roboto'];
  const weights = ['Regular', 'Medium', 'Semi Bold', 'Bold'];

  for (const family of candidates) {
    try {
      for (const style of weights) {
        await figma.loadFontAsync({ family, style });
      }
      FONT = { family, style: 'Regular' };
      return family;
    } catch (e) {
      // try the next family
    }
  }
  throw new Error('Could not load Inter or Roboto in this workspace.');
}

function text(content, opts) {
  const o = opts || {};
  const node = figma.createText();
  node.fontName = { family: FONT.family, style: o.weight || 'Regular' };
  node.characters = content;
  node.fontSize = o.size || 14;
  if (o.color) node.fills = solid(o.color);
  if (o.width) {
    node.resize(o.width, node.height);
    node.textAutoResize = 'HEIGHT';
  }
  return node;
}

function frame(name, opts) {
  const o = opts || {};
  const f = figma.createFrame();
  f.name = name;
  f.layoutMode = o.direction || 'VERTICAL';
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = o.fixedWidth ? 'FIXED' : 'AUTO';
  if (o.fixedWidth) f.resize(o.fixedWidth, f.height);
  f.itemSpacing = o.gap === undefined ? 8 : o.gap;
  f.paddingTop = f.paddingBottom = o.padY === undefined ? 0 : o.padY;
  f.paddingLeft = f.paddingRight = o.padX === undefined ? 0 : o.padX;
  f.cornerRadius = o.radius || 0;
  f.counterAxisAlignItems = o.align || 'MIN';
  f.primaryAxisAlignItems = o.justify || 'MIN';
  f.fills = o.fill ? solid(o.fill) : [];
  if (o.stroke) {
    f.strokes = solid(o.stroke);
    f.strokeWeight = 1;
  }
  return f;
}

// ─── Styles ────────────────────────────────────────────────────────────────

function createPaintStyles() {
  let count = 0;
  const groups = [
    ['Implemented', IMPLEMENTED],
    ['GEOTECH Brand', GEOTECH],
    ['Status', STATUS],
  ];

  for (const [group, tokens] of groups) {
    for (const key of Object.keys(tokens)) {
      const style = figma.createPaintStyle();
      style.name = group + '/' + key;
      style.paints = solid(tokens[key]);
      count++;
    }
  }
  return count;
}

async function createTextStyles() {
  for (const spec of TEXT_STYLES) {
    const style = figma.createTextStyle();
    style.name = spec.name;
    style.fontName = { family: FONT.family, style: spec.weight };
    style.fontSize = spec.size;
    style.lineHeight = { value: spec.lh, unit: 'PIXELS' };
  }
  return TEXT_STYLES.length;
}

// ─── Component builders ────────────────────────────────────────────────────
// Each returns a frame that is turned into a Figma component by the caller.

function buildButton(variant, size) {
  const paddings = { sm: [12, 8], md: [16, 10], lg: [20, 12] };
  const sizes = { sm: 12, md: 14, lg: 16 };
  const look = {
    primary:     { fill: IMPLEMENTED.primary,   fg: '#FFFFFF', stroke: null },
    secondary:   { fill: '#FFFFFF',             fg: IMPLEMENTED.foreground, stroke: IMPLEMENTED.border },
    ghost:       { fill: null,                  fg: IMPLEMENTED['muted-foreground'], stroke: null },
    destructive: { fill: IMPLEMENTED.destructive, fg: '#FFFFFF', stroke: null },
  }[variant];

  const f = frame('Button / ' + variant + ' / ' + size, {
    direction: 'HORIZONTAL',
    gap: 6,
    padX: paddings[size][0],
    padY: paddings[size][1],
    radius: RADIUS.lg,
    fill: look.fill,
    stroke: look.stroke,
    align: 'CENTER',
    justify: 'CENTER',
  });
  f.appendChild(text(variant[0].toUpperCase() + variant.slice(1), {
    size: sizes[size], weight: 'Medium', color: look.fg,
  }));
  return f;
}

function buildInput(state) {
  const wrap = frame('Input / ' + state, { gap: 6, fixedWidth: 320 });

  wrap.appendChild(text('Employee ID', {
    size: 14, weight: 'Medium', color: IMPLEMENTED.foreground,
  }));

  const box = frame('field', {
    direction: 'HORIZONTAL',
    padX: 12, padY: 10,
    radius: RADIUS.lg,
    fill: '#FFFFFF',
    stroke: state === 'error' ? IMPLEMENTED.destructive : IMPLEMENTED.border,
    fixedWidth: 320,
    align: 'CENTER',
  });
  box.appendChild(text(state === 'filled' ? 'EMP-00001' : 'e.g. EMP-00125', {
    size: 14,
    color: state === 'filled' ? IMPLEMENTED.foreground : IMPLEMENTED['muted-foreground'],
  }));
  wrap.appendChild(box);

  if (state === 'error') {
    wrap.appendChild(text('Employee ID is required.', {
      size: 12, color: IMPLEMENTED.destructive,
    }));
  }
  return wrap;
}

function buildBadge(kind) {
  const map = {
    pending:  ['status-pending', 'status-pending-bg', 'Pending'],
    approved: ['status-approved', 'status-approved-bg', 'Approved'],
    rejected: ['status-rejected', 'status-rejected-bg', 'Rejected'],
    active:   ['status-approved', 'status-approved-bg', 'Active'],
    inactive: ['status-inactive', 'muted', 'Inactive'],
  }[kind];

  const bg = map[1] === 'muted' ? IMPLEMENTED.muted : STATUS[map[1]];
  const f = frame('Badge / ' + kind, {
    direction: 'HORIZONTAL',
    padX: 10, padY: 4,
    radius: RADIUS.full,
    fill: bg,
    align: 'CENTER', justify: 'CENTER',
  });
  f.appendChild(text(map[2], { size: 12, weight: 'Medium', color: STATUS[map[0]] }));
  return f;
}

function buildAlert(variant) {
  const map = {
    error:   [IMPLEMENTED.destructive, '#FEE2E2', 'Invalid Employee ID or password.'],
    success: [STATUS['status-approved'], '#DCFCE7', 'Request submitted successfully'],
    warning: [STATUS['status-pending'], '#FEF3C7', 'Your balance is nearly exhausted.'],
    info:    [IMPLEMENTED.primary, IMPLEMENTED.accent, 'Approval stays with the management chain.'],
  }[variant];

  const f = frame('Alert / ' + variant, {
    padX: 16, padY: 12, radius: RADIUS.lg, fill: map[1], fixedWidth: 420,
  });
  f.appendChild(text(map[2], { size: 14, color: map[0], width: 388 }));
  return f;
}

function buildBalanceCard() {
  const f = frame('Balance Card', {
    padX: 16, padY: 16, radius: RADIUS.xl, gap: 6,
    fill: '#FFFFFF', stroke: IMPLEMENTED.border, fixedWidth: 260,
  });

  const head = frame('head', {
    direction: 'HORIZONTAL', fixedWidth: 228,
    justify: 'SPACE_BETWEEN', align: 'CENTER', gap: 8,
  });
  head.appendChild(text('Annual Leave', { size: 14, weight: 'Medium', color: IMPLEMENTED.foreground }));
  head.appendChild(text('12', { size: 24, weight: 'Semi Bold', color: IMPLEMENTED.foreground }));
  f.appendChild(head);

  f.appendChild(text('days left of 14', { size: 12, color: IMPLEMENTED['muted-foreground'] }));

  const bar = frame('bar', { fixedWidth: 228, radius: RADIUS.full, fill: IMPLEMENTED.border });
  bar.resize(228, 6);
  bar.counterAxisSizingMode = 'FIXED';
  bar.primaryAxisSizingMode = 'FIXED';
  const fill = frame('used', { fill: IMPLEMENTED.primary, radius: RADIUS.full });
  fill.resize(80, 6);
  fill.primaryAxisSizingMode = 'FIXED';
  fill.counterAxisSizingMode = 'FIXED';
  bar.appendChild(fill);
  f.appendChild(bar);

  f.appendChild(text('0 used · 2 awaiting approval', { size: 12, color: IMPLEMENTED['muted-foreground'] }));
  return f;
}

function buildPermissionChip() {
  const f = frame('Permission Chip', {
    direction: 'HORIZONTAL', gap: 6, padX: 10, padY: 5,
    radius: RADIUS.full, fill: IMPLEMENTED.muted, stroke: IMPLEMENTED.border,
    align: 'CENTER',
  });
  f.appendChild(text('3h 56m left', { size: 12, weight: 'Medium', color: IMPLEMENTED['muted-foreground'] }));
  return f;
}

function buildApprovalStep(state) {
  const colors = {
    done:    [STATUS['status-approved'], 'Direct Manager approved'],
    current: [IMPLEMENTED.primary, 'Pending technical manager approval'],
    future:  [IMPLEMENTED['muted-foreground'], 'General Manager approval'],
    failed:  [IMPLEMENTED.destructive, 'Technical Manager rejected'],
  }[state];

  const row = frame('Approval Step / ' + state, {
    direction: 'HORIZONTAL', gap: 12, align: 'MIN', fixedWidth: 320,
  });

  const dot = frame('dot', { radius: RADIUS.full, fill: colors[0] });
  dot.resize(24, 24);
  dot.primaryAxisSizingMode = 'FIXED';
  dot.counterAxisSizingMode = 'FIXED';
  row.appendChild(dot);

  const body = frame('body', { gap: 2 });
  body.appendChild(text(colors[1], { size: 14, weight: 'Medium', color: IMPLEMENTED.foreground }));
  body.appendChild(text('Khaled Nabil', { size: 12, color: IMPLEMENTED['muted-foreground'] }));
  row.appendChild(body);
  return row;
}

// ─── Page assembly ─────────────────────────────────────────────────────────

function section(page, title, subtitle, y) {
  const heading = text(title, { size: 24, weight: 'Semi Bold', color: IMPLEMENTED.foreground });
  heading.x = 0; heading.y = y;
  page.appendChild(heading);

  const sub = text(subtitle, { size: 14, color: IMPLEMENTED['muted-foreground'] });
  sub.x = 0; sub.y = y + 34;
  page.appendChild(sub);

  return y + 72;
}

function placeRow(page, nodes, x, y, gap) {
  let cx = x;
  let tallest = 0;
  for (const n of nodes) {
    page.appendChild(n);
    n.x = cx;
    n.y = y;
    cx += n.width + (gap || 16);
    tallest = Math.max(tallest, n.height);
  }
  return y + tallest + 40;
}

function componentise(node) {
  const c = figma.createComponentFromNode(node);
  return c;
}

async function main() {
  const family = await loadFonts();

  const page = figma.createPage();
  page.name = 'GEOTECH HR — Design System';
  await figma.setCurrentPageAsync(page);

  const paints = createPaintStyles();
  const texts = await createTextStyles();

  let y = 0;

  // Title
  const title = text('GEOTECH HR Portal — Design System', {
    size: 32, weight: 'Bold', color: IMPLEMENTED.foreground,
  });
  title.x = 0; title.y = y;
  page.appendChild(title);
  y += 48;

  const note = text(
    'Generated from src/styles/theme.css and src/app/App.tsx. ' +
    paints + ' paint styles and ' + texts + ' text styles were created — open the ' +
    'Local styles panel to see them. Built in ' + family + '; the brand face is Graphik, ' +
    'so swap the family on the text styles once the font is installed.',
    { size: 14, color: IMPLEMENTED['muted-foreground'], width: 760 }
  );
  note.x = 0; note.y = y;
  page.appendChild(note);
  y += note.height + 56;

  // Palettes
  y = section(page, 'Colour', 'Two palettes. The app renders the blue one today; the gold is the real GEOTECH identity.', y);

  for (const [label, tokens] of [['Implemented (in the app today)', IMPLEMENTED], ['GEOTECH brand (official)', GEOTECH], ['Status', STATUS]]) {
    const lbl = text(label, { size: 14, weight: 'Medium', color: IMPLEMENTED.foreground });
    lbl.x = 0; lbl.y = y;
    page.appendChild(lbl);
    y += 26;

    const swatches = Object.keys(tokens).map((key) => {
      const s = frame(key, { gap: 6 });
      const chip = frame('chip', { fill: tokens[key], radius: RADIUS.md, stroke: IMPLEMENTED.border });
      chip.resize(112, 64);
      chip.primaryAxisSizingMode = 'FIXED';
      chip.counterAxisSizingMode = 'FIXED';
      s.appendChild(chip);
      s.appendChild(text(key, { size: 11, weight: 'Medium', color: IMPLEMENTED.foreground }));
      s.appendChild(text(tokens[key].toUpperCase(), { size: 10, color: IMPLEMENTED['muted-foreground'] }));
      return s;
    });

    // Wrap at eight per row.
    for (let i = 0; i < swatches.length; i += 8) {
      y = placeRow(page, swatches.slice(i, i + 8), 0, y, 16) - 16;
    }
    y += 32;
  }

  // Buttons
  y = section(page, 'Buttons', 'Four variants, three sizes. Padding and radius match the Button component.', y);
  for (const variant of ['primary', 'secondary', 'ghost', 'destructive']) {
    const row = ['sm', 'md', 'lg'].map((size) => componentise(buildButton(variant, size)));
    y = placeRow(page, row, 0, y, 16);
  }

  // Inputs
  y = section(page, 'Inputs', 'Default, filled and error. The error state is what validation renders.', y);
  y = placeRow(page, ['default', 'filled', 'error'].map((s) => componentise(buildInput(s))), 0, y, 32);

  // Badges
  y = section(page, 'Status badges', 'Request status and account status.', y);
  y = placeRow(page, ['pending', 'approved', 'rejected', 'active', 'inactive'].map((k) => componentise(buildBadge(k))), 0, y, 16);

  // Alerts
  y = section(page, 'Alerts', 'Inline messages. Copy shown is the real copy from the app.', y);
  y = placeRow(page, ['error', 'success', 'warning', 'info'].map((v) => componentise(buildAlert(v))), 0, y, 24);

  // Balance + chip
  y = section(page, 'Balances', 'The employee dashboard cards and the always-on permission chip.', y);
  y = placeRow(page, [componentise(buildBalanceCard()), componentise(buildPermissionChip())], 0, y, 32);

  // Approval chain
  y = section(page, 'Approval chain', 'One row per stage. Done, current, future and rejected.', y);
  y = placeRow(page, ['done', 'current', 'future', 'failed'].map((s) => componentise(buildApprovalStep(s))), 0, y, 32);

  figma.viewport.scrollAndZoomIntoView(page.children);
  figma.notify(
    'Design system built: ' + paints + ' paint styles, ' + texts + ' text styles, and components.',
    { timeout: 6000 }
  );
  figma.closePlugin();
}

main().catch((err) => {
  figma.notify('Failed: ' + err.message, { error: true, timeout: 8000 });
  figma.closePlugin();
});

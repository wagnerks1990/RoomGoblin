// One owner for title, subtitle, body, timer geometry and fitted font sizes.
// All measurements are untransformed CSS layout pixels on the 1920x1080 stage.
export const LAYOUT_REVISION = 'dynamic-fit-20260921-6';
export const FONT_CAPS = Object.freeze({title:220, subtitle:140, body:180, timer:180});
const READABLE_MIN = 12;
const STAGE_HEIGHT = 1080;
const VERTICAL_MARGIN = 30;
const COMPONENT_GAP = 14;
const HORIZONTAL_GUTTER = 18;
const finite = (value, fallback) => value == null || value === '' || !Number.isFinite(Number(value)) ? fallback : Number(value);
export const bounded = (value, fallback, min, max) => Math.max(min, Math.min(max, finite(value, fallback)));

function componentCap(value, fallback, globalCap, autoFit = true) {
  const configured = bounded(value, fallback, 1, 2000);
  return autoFit === false ? configured : globalCap;
}

function establishStructuralStyles(nodes) {
  const {title, titleRegion, subtitle, subtitleRegion, text, textLayer,
    timerRegion, timerOverlay, timerLabel, timerValue} = nodes;
  for (const box of [titleRegion, subtitleRegion, textLayer, timerRegion]) {
    box.style.left = `${HORIZONTAL_GUTTER}px`;
    box.style.right = `${HORIZONTAL_GUTTER}px`;
    box.style.minWidth = '0';
    box.style.minHeight = '0';
    box.style.overflow = 'hidden';
    box.style.justifyContent = 'center';
  }
  for (const el of [title, subtitle, text]) {
    el.style.width = '100%';
    el.style.maxWidth = 'none';
    el.style.maxHeight = 'none';
    el.style.height = 'auto';
    el.style.minWidth = '0';
    el.style.minHeight = '0';
    el.style.flex = '0 0 auto';
    el.style.overflow = 'visible';
    el.style.margin = '0';
    el.style.lineHeight = '1.2';
  }
  title.style.whiteSpace = 'nowrap';
  title.style.overflowWrap = 'normal';
  title.style.wordBreak = 'normal';
  subtitle.style.whiteSpace = 'nowrap';
  subtitle.style.overflowWrap = 'normal';
  subtitle.style.wordBreak = 'normal';
  text.style.whiteSpace = 'break-spaces';
  text.style.overflowWrap = 'anywhere';
  text.style.wordBreak = 'break-word';
  text.style.padding = '0';
  Object.assign(timerRegion.style, {
    position:'absolute', display:'flex',
    alignItems:'center', justifyContent:'center', zIndex:'10000', pointerEvents:'none'
  });
  Object.assign(timerOverlay.style, {
    position:'static', top:'auto', bottom:'auto', transform:'none', minWidth:'0',
    maxWidth:'100%', maxHeight:'none', height:'auto', flex:'0 0 auto', margin:'0',
    padding:'.18em .55em', overflow:'visible', lineHeight:'1.2', width:'max-content', boxSizing:'border-box'
  });
  timerLabel.style.lineHeight = '1.2';
  timerValue.style.lineHeight = '1.2';
}

function available(box) {
  const s = getComputedStyle(box);
  return {
    width: Math.max(0, box.clientWidth - parseFloat(s.paddingLeft || 0) - parseFloat(s.paddingRight || 0)),
    height: Math.max(0, box.clientHeight - parseFloat(s.paddingTop || 0) - parseFloat(s.paddingBottom || 0))
  };
}

function naturalSize(el, box, fontSize = null, unconstrainedWidth = false) {
  if (typeof document === 'undefined' || typeof el?.cloneNode !== 'function') return null;
  const a = available(box);
  if (a.width <= 0) return null;
  const host = el.closest?.('#stage') || document.body;
  if (!host) return null;
  const computed = getComputedStyle(el);
  const probe = el.cloneNode(true);
  Object.assign(probe.style, {
    position:'absolute', left:'-100000px', top:'0', visibility:'hidden',
    pointerEvents:'none', transform:'none', transformOrigin:'center center',
    maxHeight:'none', height:'auto', minWidth:'0', minHeight:'0', flex:'none',
    margin:'0', boxSizing:computed.boxSizing, fontFamily:computed.fontFamily,
    fontWeight:computed.fontWeight, fontStyle:computed.fontStyle,
    fontSize:`${fontSize ?? (parseFloat(computed.fontSize) || 12)}px`,
    // Preserve the unitless author value when available. getComputedStyle()
    // resolves line-height to pixels based on the element's *previous* fitted
    // font size, which makes a new dynamic layout depend on command/reload
    // history instead of only the current content/state.
    lineHeight:el.style.lineHeight || computed.lineHeight,
    letterSpacing:computed.letterSpacing,
    wordSpacing:computed.wordSpacing, whiteSpace:computed.whiteSpace,
    overflowWrap:computed.overflowWrap, wordBreak:computed.wordBreak,
    textAlign:computed.textAlign, padding:el.style.padding || computed.padding,
    borderWidth:computed.borderWidth, borderStyle:computed.borderStyle
  });
  if (unconstrainedWidth) {
    probe.style.width = 'max-content';
    probe.style.maxWidth = 'none';
  } else if (el.id === 'timerOverlay') {
    probe.style.width = 'max-content';
    probe.style.maxWidth = `${a.width}px`;
  } else {
    probe.style.width = `${a.width}px`;
    probe.style.maxWidth = 'none';
  }
  host.appendChild(probe);
  const result = {
    width: Math.max(probe.scrollWidth, probe.offsetWidth),
    height: Math.max(probe.scrollHeight, probe.offsetHeight)
  };
  probe.remove();
  return result;
}

function renderedContained(el, box) {
  if (typeof box?.getBoundingClientRect !== 'function' || typeof el?.getBoundingClientRect !== 'function' || typeof document === 'undefined') return true;
  const br = box.getBoundingClientRect();
  const tolerance = 0.75;
  const inside = r => r.left >= br.left - tolerance && r.top >= br.top - tolerance &&
    r.right <= br.right + tolerance && r.bottom <= br.bottom + tolerance;
  const er = el.getBoundingClientRect();
  if (!inside(er)) return false;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (!walker.currentNode.textContent || !walker.currentNode.textContent.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(walker.currentNode);
    for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0 && !inside(r)) return false;
  }
  return true;
}

export function fits(el, box) {
  const a = available(box);
  if (a.width <= 0 || a.height <= 0) return false;
  if (Math.max(el.scrollWidth, el.offsetWidth) > a.width + 0.5 ||
      Math.max(el.scrollHeight, el.offsetHeight) > a.height + 0.5) return false;
  if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 0.5) return false;
  if (el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 0.5) return false;
  const natural = naturalSize(el, box);
  if (natural && (natural.width > a.width + 0.5 || natural.height > a.height + 0.5)) return false;
  return renderedContained(el, box);
}

export function fitElement(el, box, cap) {
  cap = bounded(cap, 64, 1, 2000);
  el.style.transform = '';
  if (!el.textContent.trim()) {
    el.style.fontSize = '12px';
    return {fontSize:12, scale:1, status:'empty'};
  }
  if (box.clientWidth <= 0 || box.clientHeight <= 0) return {fontSize:1, scale:1, status:'unmeasurable'};
  let low = 4, high = Math.floor(cap * 4), best = 4;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    el.style.fontSize = `${mid / 4}px`;
    if (fits(el, box)) { best = mid; low = mid + 1; } else { high = mid - 1; }
  }
  let fontSize = best / 4;
  el.style.fontSize = `${fontSize}px`;

  let guard = 0;
  while (!fits(el, box) && fontSize > 1 && guard++ < 512) {
    fontSize = Math.max(1, fontSize - 0.25);
    el.style.fontSize = `${fontSize}px`;
  }

  let scale = 1;
  if (!fits(el, box)) {
    const a = available(box);
    const natural = naturalSize(el, box) || {};
    scale = Math.min(1,
      a.width / Math.max(1, natural.width || el.scrollWidth, el.offsetWidth),
      a.height / Math.max(1, natural.height || el.scrollHeight, el.offsetHeight)) * 0.985;
    const align = getComputedStyle(box).alignItems;
    el.style.transformOrigin = `center ${align === 'flex-start' ? 'top' : align === 'flex-end' ? 'bottom' : 'center'}`;
    el.style.transform = `scale(${scale})`;
    while (!renderedContained(el, box) && scale > 0.05 && guard++ < 768) {
      scale *= 0.985;
      el.style.transform = `scale(${scale})`;
    }
  }
  return {fontSize, scale, status:fontSize * scale < READABLE_MIN ? 'below-readable-minimum' : 'fit'};
}

function allocateHeights(items, availableHeight) {
  if (!items.length) return [];
  const mins = items.map(item => item.minHeight);
  const minTotal = mins.reduce((a,b) => a + b, 0);
  if (minTotal >= availableHeight) {
    const ratio = availableHeight / Math.max(1, minTotal);
    return mins.map(v => Math.max(1, v * ratio));
  }

  let heights = mins.slice();
  let extra = availableHeight - minTotal;
  const demands = items.map((item, i) => Math.max(0, item.desired - mins[i]));
  const weightedDemand = demands.map((d, i) => d * items[i].weight);
  const demandTotal = weightedDemand.reduce((a,b) => a + b, 0);

  if (demandTotal > 0) {
    const spend = Math.min(extra, demands.reduce((a,b) => a + b, 0));
    heights = heights.map((h, i) => h + spend * (weightedDemand[i] / demandTotal));
    extra -= spend;
  }

  if (extra > 0) {
    const bodyIndex = items.findIndex(item => item.name === 'body');
    if (bodyIndex >= 0) {
      heights[bodyIndex] += extra;
    } else {
      const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
      heights = heights.map((h, i) => h + extra * (items[i].weight / totalWeight));
    }
  }
  return heights;
}

export function createDisplayLayout(nodes, getState) {
  const {stage, title, titleRegion, subtitle, subtitleRegion, text, textLayer,
    timerRegion, timerOverlay, timerLabel, timerValue} = nodes;
  establishStructuralStyles(nodes);
  let frame = null, previousKey = '', fontEpoch = 0, passCount = 0;
  let fontStatus = 'loading', disposed = false, report = {};
  stage.dataset.renderer = LAYOUT_REVISION;
  stage.dataset.fontStatus = fontStatus;

  function region(el, top, height, visible = true) {
    el.style.top = `${top}px`;
    el.style.bottom = 'auto';
    el.style.height = `${Math.max(1, height)}px`;
    el.style.display = visible ? 'flex' : 'none';
  }

  function buildItems(state, timer) {
    const titleOpts = state.titleOptions || {};
    const subtitleOpts = state.subtitleOptions || {};
    const textOpts = state.textOptions || {};
    textLayer.style.alignItems = textOpts.position === 'top' ? 'flex-start' : textOpts.position === 'bottom' ? 'flex-end' : 'center';

    const items = [];
    if (title.textContent.trim()) items.push({
      name:'title', el:title, box:titleRegion,
      cap:componentCap(titleOpts.size,92,FONT_CAPS.title,titleOpts.autoFit!==false),
      minHeight:70, weight:1.05, singleLine:true
    });
    if (subtitle.textContent.trim()) items.push({
      name:'subtitle', el:subtitle, box:subtitleRegion,
      cap:componentCap(subtitleOpts.size,44,FONT_CAPS.subtitle,subtitleOpts.autoFit!==false),
      minHeight:50, weight:0.8, singleLine:true
    });
    if (text.textContent.trim()) items.push({
      name:'body', el:text, box:textLayer,
      cap:componentCap(textOpts.size,64,FONT_CAPS.body,textOpts.autoFit!==false),
      minHeight:120, weight:2.2
    });
    if (timer.visible) items.push({
      name:'timer', el:timerOverlay, box:timerRegion,
      cap:componentCap(timer.fontSize,64,FONT_CAPS.timer,timer.autoFit!==false),
      minHeight:105, weight:1
    });

    const timerPos = ['top','center','bottom'].includes(timer.position) ? timer.position : 'bottom';
    if (timer.visible) {
      const timerItem = items.find(item => item.name === 'timer');
      const withoutTimer = items.filter(item => item.name !== 'timer');
      if (timerPos === 'top') return [timerItem, ...withoutTimer];
      if (timerPos === 'center') {
        const bodyIndex = withoutTimer.findIndex(item => item.name === 'body');
        if (bodyIndex >= 0) return [...withoutTimer.slice(0, bodyIndex), timerItem, ...withoutTimer.slice(bodyIndex)];
        return [...withoutTimer, timerItem];
      }
      return [...withoutTimer, timerItem];
    }
    return items;
  }

  function applyGeometry(items) {
    const boxes = {title:titleRegion, subtitle:subtitleRegion, body:textLayer, timer:timerRegion};
    const active = new Set(items.map(item => item.name));
    for (const [name, box] of Object.entries(boxes)) if (!active.has(name)) region(box, VERTICAL_MARGIN, 1, false);
    if (!items.length) return;

    const availableHeight = STAGE_HEIGHT - (VERTICAL_MARGIN * 2) - (COMPONENT_GAP * Math.max(0, items.length - 1));
    const heights = allocateHeights(items, availableHeight);
    let top = VERTICAL_MARGIN;
    items.forEach((item, i) => {
      region(item.box, top, heights[i], true);
      top += heights[i] + COMPONENT_GAP;
    });
  }

  function fitTimer(timer) {
    timerRegion.hidden = !timer.visible;
    if (!timer.visible) return {fontSize:0, scale:1, status:'hidden'};
    timerOverlay.style.borderWidth = `${bounded(timer.borderWidth,4,0,24)}px`;
    const actual = timerValue.textContent;
    timerValue.textContent = '8888888888888:88:88';
    const cap = componentCap(timer.fontSize,64,FONT_CAPS.timer,timer.autoFit!==false);
    const result = fitElement(timerOverlay, timerRegion, cap);
    timerValue.textContent = actual;
    if (!fits(timerOverlay, timerRegion)) return fitElement(timerOverlay, timerRegion, result.fontSize);
    return result;
  }

  function run() {
    frame = null;
    if (disposed || fontStatus === 'loading') return;
    const state = getState(), timer = state.timerState || {};
    const key = JSON.stringify([title.textContent, subtitle.textContent, text.textContent,
      state.titleOptions, state.subtitleOptions, state.textOptions,
      !!timer.visible, timer.label || '', timer.position || 'bottom', timer.fontSize,
      timer.autoFit, timer.borderWidth, fontEpoch]);
    if (key === previousKey) return;

    timerRegion.hidden = !timer.visible;
    timerOverlay.style.display = timer.visible ? 'block' : 'none';
    const items = buildItems(state, timer);
    // Every layout pass starts from the same canonical font geometry. Without
    // this reset, a replay/reload can estimate the next layout from a font size
    // produced by the previous pass, making identical state render differently.
    for (const item of items) {
      item.el.style.transform = '';
      item.el.style.fontSize = `${item.cap}px`;
      // Region allocation is intentionally independent of the element's
      // current fitted DOM geometry. Active headings/timer keep their compact
      // minimum bands and the body receives otherwise-unused room; the fitter
      // then solves each object's font size inside that deterministic geometry.
      item.desired = item.minHeight;
    }
    applyGeometry(items);

    const components = {};
    for (const item of items) {
      components[item.name] = item.name === 'timer'
        ? fitTimer(timer)
        : fitElement(item.el, item.box, item.cap);
    }
    for (const name of ['title','subtitle','body','timer']) {
      if (!components[name]) components[name] = {fontSize:0, scale:1, status:'hidden'};
    }

    previousKey = key;
    passCount++;
    for (const [name, el] of Object.entries({title:titleRegion,subtitle:subtitleRegion,body:textLayer,timer:timerRegion})) {
      components[name].region = {x:el.offsetLeft, y:el.offsetTop, width:el.clientWidth, height:el.clientHeight};
    }
    report = {
      revision:LAYOUT_REVISION, passCount, fontStatus, dynamic:true,
      order:items.map(item => item.name), components
    };
    stage.dataset.layout = items.map(item => `${item.name}:${components[item.name].fontSize || 0}px`).join(';');
    stage.dataset.layoutPasses = String(passCount);
    stage.dataset.fitWarning = Object.values(components).some(c => c.status === 'below-readable-minimum') ? 'content-too-dense' : '';
  }

  function request() {
    if (!disposed && frame === null) frame = requestAnimationFrame(run);
  }
  function fontsChanged() { fontEpoch++; previousKey = ''; request(); }
  function finishFonts() {
    if (disposed) return;
    fontStatus = document.fonts?.check('16px "Classroom Display"') ? 'ready' : 'fallback';
    stage.dataset.fontStatus = fontStatus;
    fontsChanged();
  }
  const fontTimeout = setTimeout(finishFonts, 3000);
  if (document.fonts) {
    Promise.all([document.fonts.load('16px "Classroom Display"'), document.fonts.load('700 16px "Classroom Display"')])
      .then(() => document.fonts.ready).then(finishFonts, finishFonts).finally(() => clearTimeout(fontTimeout));
    document.fonts.addEventListener?.('loadingdone', fontsChanged);
  } else finishFonts();
  request();
  return {
    request,
    snapshot:() => ({...report, revision:LAYOUT_REVISION, fontStatus, passCount}),
    dispose() {
      disposed = true; clearTimeout(fontTimeout);
      if (frame !== null) cancelAnimationFrame(frame);
      document.fonts?.removeEventListener?.('loadingdone', fontsChanged);
    }
  };
}

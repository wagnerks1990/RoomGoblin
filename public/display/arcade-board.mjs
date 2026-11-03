// Native, transient arcade view. All learner values enter as text, never HTML.
const number = (v, max = 999999999) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
const label = (v, max = 100) => String(v || '').slice(0, max);
const score = v => number(v).toLocaleString('en-US');
function node(tag, cls, text) {
  const el = document.createElement(tag); el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}
function savedLabel(at, now) {
  if (!at) return 'Checkpoint saved';
  const minutes = Math.max(0, Math.floor((now - at) / 60000));
  return minutes < 2 ? 'Just saved' : minutes < 60 ? `Saved ${minutes}m ago` : 'Saved earlier';
}
export function createArcadeBoard(stage) {
  const host = node('section', 'arcade-board'); host.hidden = true;
  host.setAttribute('aria-label', 'Live arcade leaderboard'); stage.append(host);
  let signature = '', previous = new Map();
  function clear() { host.hidden = true; signature = ''; previous.clear(); host.replaceChildren(); }
  function render(input) {
    if (!input || input.version !== 1) { clear(); return; }
    const rows = (Array.isArray(input.rows) ? input.rows : []).slice(0, 8);
    const key = JSON.stringify(input);
    if (!host.hidden && key === signature) return;
    signature = key; host.hidden = false;
    const header = node('header', 'arcade-header');
    const heading = node('div', 'arcade-heading');
    heading.append(node('div', 'arcade-eyebrow', 'ROOMGOBLIN  /  CONTINUING CAMPAIGN'), node('h1', '', label(input.title) || 'Arcade leaderboard'));
    const live = node('div', 'arcade-live', input.waiting ? 'NEXT CLASS • STAND BY' : `${label(input.period, 60) || 'CLASS ARCADE'} • LIVE UPDATES`);
    header.append(heading, live);
    const main = node('div', 'arcade-main'), feature = node('aside', 'arcade-feature');
    const art = node('img', 'arcade-gorilla'); art.src = '/display/arcade-gorilla.svg'; art.alt = 'Arcade gorilla with a barrel';
    feature.append(art);
    const leader = input.leader;
    feature.append(node('div', 'arcade-eyebrow', leader ? 'TOP OF THE TOWER' : 'READY TO CLIMB?'));
    feature.append(node('h2', 'arcade-leader', leader ? label(leader.firstName, 60) : 'Your next checkpoint'));
    feature.append(node('div', 'arcade-hero-score', leader ? score(leader.arcadeScore) : 'GAME ON'));
    feature.append(node('div', 'arcade-feature-caption', leader ? `ARCADE POINTS  ·  LEVEL ${number(leader.level, 99)}` : 'Answer. Play. Save. Level up.'));
    feature.append(node('p', 'arcade-feature-note', 'Your campaign continues across assignments. Keep climbing!'));
    const ladder = node('section', 'arcade-ladder');
    const columns = node('div', 'arcade-columns');
    for (const text of ['RANK / PLAYER', 'ARCADE POINTS', 'LEVEL / STAGE', 'QUESTION PROGRESS']) columns.append(node('span', '', text));
    ladder.append(columns);
    const list = node('ol', 'arcade-rows'); list.start = number(input.offset, 100) + 1;
    const now = number(input.generatedAt, Number.MAX_SAFE_INTEGER) || Date.now(), next = new Map();
    rows.forEach((r, i) => {
      const rank = number(input.offset, 100) + i + 1, row = node('li', 'arcade-row');
      const identity = `${label(r.firstName, 60)}|${label(r.period, 30)}|${rank}`;
      const last = previous.get(identity), current = number(r.arcadeScore); next.set(identity, current);
      if (last !== undefined && current > last) row.classList.add('arcade-score-up');
      const who = node('div', 'arcade-who'), badge = node('span', 'arcade-rank', String(rank).padStart(2, '0'));
      const person = node('div', 'arcade-person'); person.append(node('strong', '', label(r.firstName, 60) || 'Student'), node('span', '', `${label(r.period, 30)} · ${savedLabel(number(r.lastActivityAt, Number.MAX_SAFE_INTEGER), now)}`));
      who.append(badge, person);
      const points = node('strong', 'arcade-points', score(current));
      const level = node('div', 'arcade-level'); level.append(node('strong', '', `L${number(r.level, 99) || 1}`), node('span', '', `STAGE ${number(r.board, 4) || 1}`));
      const progress = node('div', 'arcade-progress'), total = number(r.total, 100000), answered = Math.min(total, number(r.answered, 100000));
      const bar = node('div', 'arcade-progress-track'), fill = node('div', 'arcade-progress-fill'); fill.style.width = `${total ? answered / total * 100 : 0}%`; bar.append(fill);
      progress.append(node('strong', '', `${answered} / ${total}`), bar, node('span', '', `${number(r.completed, 1000)} assignment${r.completed === 1 ? '' : 's'} complete`));
      row.append(who, points, level, progress); list.append(row);
    });
    previous = next; ladder.append(list);
    if (!rows.length) ladder.append(node('div', 'arcade-empty', input.waiting ? 'The leaderboard follows the scheduled class.\nSaved points and levels stay with each player.' : 'Your name belongs here.\nSave a question checkpoint to join the board.'));
    const footer = node('footer', 'arcade-footer');
    footer.append(node('span', '', `${number(input.count, 100)} PLAYERS  ·  ${rows.length ? `RANKS ${number(input.offset, 100) + 1}–${number(input.offset, 100) + rows.length}` : 'AWAITING CHECKPOINTS'}`), node('span', '', 'ARCADE SCORES + PROGRESS  •  GRADES STAY PRIVATE'), node('span', 'arcade-ticker', 'ANSWER → PLAY → LEVEL UP'));
    main.append(feature, ladder); host.replaceChildren(header, main, footer);
  }
  return {render, clear};
}

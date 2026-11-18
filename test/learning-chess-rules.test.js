'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {START,parse,fen,legal,apply,uci,play,outcome,checked,claimable,historyOf,canMate,lockedPawns}=require('../src/learning-chess');
const moves=position=>legal(parse(position)).map(uci);
const castles='r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
const changed=(position,requested)=>{const s=parse(position),move=legal(s).find(m=>uci(m)===requested);assert.ok(move,requested+' must be legal in the fixture');return apply(s,move);};

test('FIDE movement tree matches established starting and castling-rich positions',()=>{
 const perft=(s,d)=>d?legal(s).reduce((total,m)=>total+perft(apply(s,m),d-1),0):1;
 assert.equal(perft(parse(START),3),8902);
 assert.equal(perft(parse('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'),3),97862);
});

test('both colors can castle on either side with correct resulting king and rook squares',()=>{
 for(const [turn,move,king,rook] of [['w','e1g1','g1','f1'],['w','e1c1','c1','d1'],['b','e8g8','g8','f8'],['b','e8c8','c8','d8']]){
  const s=changed(castles.replace(' w ',' '+turn+' '),move);
  const at=square=>s.b[(8-Number(square[1]))*16+'abcdefgh'.indexOf(square[0])];
  assert.equal(at(king),turn==='w'?'K':'k');assert.equal(at(rook),turn==='w'?'R':'r');
  assert.equal(s.c&(turn==='w'?3:12),0);
 }
});

test('castling is forbidden when the king starts, crosses, or finishes in check',()=>{
 for(const position of [
  '4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1',
  '4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1',
  '4k1r1/8/8/8/8/8/8/R3K2R w KQ - 0 1',
 ])assert.ok(!moves(position).includes('e1g1'),position);
 for(const position of ['3rk3/8/8/8/8/8/8/R3K2R w KQ - 0 1','2r1k3/8/8/8/8/8/8/R3K2R w KQ - 0 1'])assert.ok(!moves(position).includes('e1c1'),position);
});

test('attacking a rook or the queenside b-file does not itself forbid castling',()=>{
 assert.ok(moves('4k2r/8/8/8/8/8/8/R3K2R w KQ - 0 1').includes('e1g1'));
 assert.ok(moves('1r2k3/8/8/8/8/8/8/R3K2R w KQ - 0 1').includes('e1c1'));
 assert.ok(!moves('4k3/8/8/8/8/8/8/RN2K2R w KQ - 0 1').includes('e1c1'));
 assert.ok(moves('4k3/8/8/8/8/8/8/RN2K2R w KQ - 0 1').includes('e1g1'));
});

test('moving a king or rook away and back never restores its castling right',()=>{
 let s=parse(castles);
 for(const move of ['e1f1','a8a7','f1e1','a7a8'])s=changed(fen(s),move);
 assert.ok(!legal(s).map(uci).includes('e1g1'));assert.ok(!legal(s).map(uci).includes('e1c1'));
 s=parse(castles);for(const move of ['h1h2','a8a7','h2h1','a7a8'])s=changed(fen(s),move);
 assert.ok(!legal(s).map(uci).includes('e1g1'));assert.ok(legal(s).map(uci).includes('e1c1'));
 s=changed(castles.replace(' w ',' b '),'h8h1');assert.equal(s.c&1,0,'capturing the original rook removes its right');
});

test('en passant removes the passed pawn, expires immediately, and respects discovered check',()=>{
 const capture=play(START,['e2e4','a7a6','e4e5','d7d5'],'e5d6');
 const s=parse(capture.fen);assert.equal(s.b[(8-5)*16+3],'.');assert.equal(s.b[(8-6)*16+3],'P');
 const expired=historyOf(['e2e4','a7a6','e4e5','d7d5','g1f3','a6a5']).at(-1);assert.ok(!legal(expired).map(uci).includes('e5d6'));
 assert.ok(!moves('4r1k1/8/8/3pP3/8/8/8/4K3 w - d6 0 1').includes('e5d6'));
 assert.ok(!moves('7k/8/8/r3Pp1K/8/8/8/8 w - f6 0 2').includes('e5f6'),'removing both adjacent pawns must not expose a horizontal rook check');
 const checkedPosition=parse('7k/8/8/3pP3/4K3/8/8/8 w - d6 0 1');assert.equal(checked(checkedPosition),true);assert.ok(legal(checkedPosition).map(uci).includes('e5d6'));
});

test('every legal promotion type is explicit, including captures and black promotion',()=>{
 for(const type of ['q','r','b','n']){
  assert.ok(moves('7k/P7/8/8/8/8/8/7K w - - 0 1').includes('a7a8'+type));
  assert.ok(moves('1r5k/P7/8/8/8/8/8/7K w - - 0 1').includes('a7b8'+type));
  assert.ok(moves('7k/8/8/8/8/8/p7/7K b - - 0 1').includes('a2a1'+type));
 }
 assert.ok(!moves('7k/P7/8/8/8/8/8/7K w - - 0 1').includes('a7a8'));
 assert.throws(()=>play('7k/P7/8/8/8/8/8/7K w - - 0 1',[],'a7a8k'),{status:400});
});

test('movement, blocking, pinned pieces and adjacent kings are enforced',()=>{
 const initial=moves(START);assert.ok(initial.includes('g1f3'));for(const move of ['a1a4','f1b5','e2f3','e2e5'])assert.ok(!initial.includes(move));
 assert.ok(!moves('4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1').includes('e2d2'));
 assert.ok(!moves('8/8/8/8/8/4k3/8/4K3 w - - 0 1').includes('e1e2'));
 assert.ok(!moves('4k3/4b3/8/2K5/8/8/8/4R3 w - - 0 1').includes('c5d6'),'a pinned enemy bishop still attacks squares for king safety');
 assert.ok(!moves('7k/8/8/8/4P3/8/8/7K w - - 0 1').includes('e4e3'));
});

test('checkmate and stalemate are distinct, and completed games reject further moves',()=>{
 const m=play(START,['f2f3','e7e5','g2g4'],'d8h4');assert.deepEqual(m.outcome,{status:'finished',result:'black',reason:'checkmate'});
 assert.throws(()=>play(START,['f2f3','e7e5','g2g4','d8h4'],'a2a3'),{status:409});
 assert.deepEqual(outcome([parse('7k/5K2/6Q1/8/8/8/8/8 b - - 0 1')]),{status:'finished',result:'draw',reason:'stalemate'});
});

test('threefold is claimable while fifth repetition ends automatically',()=>{
 const cycle=['g1f3','g8f6','f3g1','f6g8'];
 const three=historyOf([...cycle,...cycle]);assert.equal(claimable(three).repetition,true);assert.equal(outcome(three).status,'active');
 const five=historyOf([...cycle,...cycle,...cycle,...cycle]);assert.equal(outcome(five).result,'draw');assert.equal(outcome(five).reason,'automatic draw');
});

test('repetition includes turn, castling rights and only legally usable en passant',()=>{
 const s=parse(START);assert.equal(claimable([s,s,s]).repetition,true);
 assert.equal(claimable([s,{...s,t:-s.t},s]).repetition,false);
 assert.equal(claimable([s,{...s,c:0},s]).repetition,false);
 const fakeEp={...s,ep:(8-3)*16+4};assert.equal(claimable([s,fakeEp,s]).repetition,true);
 const real=parse('7k/8/8/3pP3/8/8/8/7K w - d6 0 1');assert.equal(claimable([real,{...real,ep:-1},real]).repetition,false);
 const pinned=parse('4r1k1/8/8/3pP3/8/8/8/4K3 w - d6 0 1');assert.equal(claimable([pinned,{...pinned,ep:-1},pinned]).repetition,true);
});

test('50-move claims and 75-move automatic draws use halfmoves and reset on pawn moves or captures',()=>{
 const position='7k/8/8/8/8/8/R7/K7 w - - ';
 const fifty=parse(position+'100 1');assert.equal(claimable([fifty]).fiftyMove,true);assert.equal(outcome([fifty]).status,'active');
 assert.equal(claimable([parse(position+'99 1')]).fiftyMove,false);assert.equal(outcome([parse(position+'150 1')]).reason,'automatic draw');
 assert.equal(parse(play('7k/8/8/8/8/8/RP6/K7 w - - 99 1',[],'b2b3').fen).half,0);
 assert.equal(parse(play('7k/p7/8/8/8/8/R7/K7 w - - 99 1',[],'a2a7').fen).half,0);
 assert.equal(play('7k/8/5KQ1/8/8/8/8/8 w - - 149 1',[],'g6g7').outcome.reason,'checkmate');
});

test('common dead material and proved locked-pawn barriers are draws without declaring live minor-piece games dead',()=>{
 for(const position of ['7k/8/8/8/8/8/8/K7 w - - 0 1','7k/8/8/8/8/8/8/KN6 w - - 0 1','7k/8/8/8/8/8/8/KB6 w - - 0 1'])assert.equal(outcome([parse(position)]).reason,'insufficient material');
 assert.equal(outcome([parse('7k/8/8/8/8/8/8/KNN5 w - - 0 1')]).status,'active','two knights can mate with cooperation');
 const barrier=parse('7k/8/3p4/2pPp3/1pP1Pp1p/pP3PpP/P5P1/K7 w - - 0 1');assert.equal(lockedPawns(barrier),true);assert.equal(outcome([barrier]).reason,'dead position');
 assert.equal(lockedPawns(parse('7k/8/3p4/2pPp3/1pP1Pp1p/pP3P1P/P5P1/K7 w - - 0 1')),false,'an opening or reachable capture invalidates the barrier proof');
});

test('resignation and clock mating-possibility helpers distinguish a bare king and live attacking material',()=>{
 const queen=parse('7k/8/8/8/8/8/1Q6/K7 w - - 0 1');assert.equal(canMate(queen,-1),false);assert.equal(canMate(queen,1),true);
 assert.equal(canMate(parse('7k/8/8/8/8/8/8/KN6 w - - 0 1'),1),false);
 assert.equal(canMate(parse('7k/8/8/8/8/8/8/KNN5 w - - 0 1'),1),true);
});

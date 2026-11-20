'use strict';
// Classroom challenge names are not measured human/FIDE ratings. Legacy saved
// beginner/standard/advanced games keep their existing lightweight engine IDs.
const PROFILES=Object.freeze(Object.fromEntries([
 ['normal','Normal',3,200,30000],
 ['intermediate','Intermediate',7,350,75000],
 ['stockfish-advanced','Advanced',12,500,150000],
 ['expert','Expert',16,700,300000],
 ['master','Master',19,1000,600000],
 ['grandmaster','Grandmaster',20,1200,1000000],
].map(([id,label,skill,movetime,nodes])=>[id,Object.freeze({id,label,skill,movetime,nodes})])));
const LEVELS=Object.freeze(Object.keys(PROFILES));
function profile(id){if(typeof id!=='string'||!Object.hasOwn(PROFILES,id))throw Object.assign(Error('Choose an available computer level.'),{status:400});return PROFILES[id];}
function optionCommands(id){const p=profile(id);return ['setoption name Threads value 1','setoption name Hash value 32','setoption name Ponder value false','setoption name MultiPV value 1','setoption name UCI_Chess960 value false','setoption name UCI_LimitStrength value false','setoption name Skill Level value '+p.skill];}
module.exports={PROFILES,LEVELS,profile,optionCommands};

'use strict';

// A fixed, reviewed curriculum case. Do not reuse the IPv4 grading criteria.
const RUBRIC=Object.freeze({claim:[0,4,8],evidence:[0,2,4],reasoning:[0,1,3],reply:[0,2,5]});
const CASE=Object.freeze({
 id:'it1-u03-c01-os-selection-v1',title:'OS Selection: Requirements Before Price',points:20,
 courseLabel:'IT I · UNIT 3 · CLASS 01',
 prompt:'A purchasing team chooses the cheapest operating system because every computer has 16 GB RAM. The business application is Windows-only and the stated deployment requires domain join. Explain two missing compatibility checks and a justified edition decision. A colleague proposes choosing an edition by desktop appearance; improve that proposal with a testable requirement.',
 initialDirections:'Write 3–5 sentences with two accurate lesson terms, evidence-based reasoning, and one meaningful limitation. Explain two missing compatibility checks and justify the OS edition.',
 replyDirections:'Reply in 2–3 sentences that improve a real classmate’s test, evidence, or reasoning. If no peer post is available, use the independent case response. Do not invent a classmate’s comment.',
 initialPlaceholder:'Use the application and domain-join requirements to justify your choice. Identify missing checks and one limit of the evidence.',
 alternate:'Independent case response: A colleague proposes choosing an OS edition by its desktop appearance. Improve the proposal with a testable requirement.',
 alternateLabel:'Independent case response: Choosing an edition by appearance',
 criterionLabels:{claim:'Reasoning',evidence:'Vocabulary',reasoning:'Limitation',reply:'Improvement'},
 scoreLevels:RUBRIC,
 rubric:{claim:'8: supported edition decision using the Windows-only application and domain-join requirements, with two missing compatibility checks; 4: plausible decision with incomplete support; 0: missing or contradicts the case.',evidence:'4: two accurate relevant lesson terms used meaningfully; 2: one accurate term or a minor error; 0: missing or materially incorrect.',reasoning:'3: specific meaningful uncertainty; 1: vague but relevant limitation; 0: missing or unsupported certainty.',reply:'5: specific useful peer or independent-case improvement supported by a reason or test; 2: relevant but incomplete suggestion; 0: missing, invented peer, incorrect, or simple agreement.'}
});
module.exports={CASE,RUBRIC};

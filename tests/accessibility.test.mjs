import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
for(const [id,label] of [['intro','introTitle'],['helpPane','helpTitle'],['finish','finishTitle'],['garagePane','garageTitle'],['routePane','routesTitle'],['journalPane','journalTitle'],['photoPane','photoTitle'],['encounterPane','encounterTitle']]){
 const tag=html.match(new RegExp('<[a-z]+[^>]*id="'+id+'"[^>]*>'))?.[0];
 assert.ok(tag,'Dialog missing '+id);
 assert.match(tag,/role="dialog"/);
 assert.match(tag,/aria-modal="true"/);
 assert.ok(tag.includes('aria-labelledby="'+label+'"'));
 assert.ok(html.includes('id="'+label+'"'));
}
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);assert.equal(new Set(ids).size,ids.length,'unique HTML IDs');
assert.match(html,/<canvas\b[^>]*id="game"[^>]*tabindex="0"/,'driving canvas can receive keyboard focus');
const implicitLabels=[...html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)].map(match=>match[1]);
for(const match of html.matchAll(/<input\b[^>]*id="([^"]+)"[^>]*>/g))assert(html.includes('for="'+match[1]+'"')||/aria-label=/.test(match[0])||implicitLabels.some(label=>label.includes('id="'+match[1]+'"')),'input labelled: '+match[1]);
console.log('PASS: 8 dialog semantics, unique IDs, labelled controls and keyboard canvas (static inspection only)');

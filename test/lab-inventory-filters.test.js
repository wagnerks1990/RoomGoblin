'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('public/controller/lab.html','utf8');
const filter=source.slice(source.indexOf('function visibleComputers(){'),source.indexOf('function render(){'));
const selection=source.slice(source.indexOf('function selectAll(on){'),source.indexOf('function targets(){'));
function harness(){
 const context={inventory:{computers:[{id:'a',name:'Desk Alpha',user:'Student One',ip:'10.0.0.1',online:true},{id:'b',name:'Desk Beta',user:'Student Two',ip:'10.0.0.2',online:false},{id:'c',hostname:'Teacher',online:true}]},computerSearch:{value:''},computerStatus:{value:'all'},computerGrid:{dataset:{}},selected:new Set(),render(){}};
 vm.createContext(context);vm.runInContext(filter+selection,context);return context;
}
test('agent inventory combines case-insensitive search and status without losing full inventory',()=>{
 const c=harness();c.computerSearch.value=' STUDENT ';assert.equal(c.visibleComputers().length,2);
 c.computerStatus.value='offline';assert.equal(c.visibleComputers()[0].id,'b');
 c.computerSearch.value='10.0.0.1';assert.equal(c.visibleComputers().length,0);
 assert.equal(c.inventory.computers.length,3);
});
test('selection operates on visible computers, including an existing selected-only filter',()=>{
 const c=harness();c.selected.add('b');c.computerStatus.value='selected';c.selectAll(true);assert.deepEqual([...c.selected],['b']);
 c.computerStatus.value='all';c.computerSearch.value='Desk';c.selectOnline();assert.deepEqual([...c.selected],['a']);
 c.selectAll(true);assert.deepEqual([...c.selected],['a','b']);
 c.selectAll(false);assert.equal(c.selected.size,0);
});
test('density accepts only supported layouts',()=>{
 const c=harness();c.setComputerDensity('comfortable');assert.equal(c.computerGrid.dataset.density,'comfortable');
 c.setComputerDensity('unexpected');assert.equal(c.computerGrid.dataset.density,'compact');
});

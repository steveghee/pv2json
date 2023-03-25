var fs   = require('fs');
var linq = require('linq');

var tthen = Date.now();
var fi1   = process.argv[2];
var d1    = JSON.parse(fs.readFileSync(fi1,'utf8'));

var fi2   = process.argv[3];
var d2    = JSON.parse(fs.readFileSync(fi2,'utf8'));

console.log('there are ' + d1.length + ' items in ' + fi1);
console.log('there are ' + d2.length + ' items in ' + fi2);
//what is in d1 and not in d2
var except = linq.from(d1).except(d2,"$.path").toArray();
console.log(except);
console.log(except.length);
//what is in d1 AND d2
//var intersect = linq.from(d1).intersect(d2,"$.path").toArray();
//console.log(intersect);
//console.log(intersect.length);
   

var fs = require('fs');
var pv = require('./pvjsmeta.js');

if (process.argv.length < 3) {
    console.log("usage : pvjsonfind filename - list attributes in file");
    console.log("        pvjsonfind filename attribute-name - list all nodes with attribute");
    console.log("        pvjsonfind filename attribute-name [compare value [value2]]");
    console.log("        - compare can be start,like,same,eq,lt,gt");
    console.log("        - start,like,same,unlike : string comparison");
    console.log("        - eq,ne,lt,gt : numeric comparison");
    console.log("        - in,out : numeric range comparison");
    console.log("        - before,after : date/time comparison comparison");
    process.exit(1);
}

var tthen = Date.now();
var fi  = process.argv[2];
var pvs = JSON.parse(fs.readFileSync(fi,'utf8'));

var iroot = pvs.components.length - 1;
var imap =0; for (var id in pvs.idmap) imap+=1;
console.log('there are ' + iroot + ' components, ' + imap + ' instances');

var meta = new pv.pvmeta(pvs);

if (process.argv.length < 4) {
    var res = meta.properties();
    var tdelta = Date.now() - tthen;
    if (res != undefined) {
        console.log(res);
        console.log(res.length + ' results (in ' + tdelta + 'ms)');
    }
}
else {
    var pname = process.argv[3].toLowerCase();
    var lval = undefined, op=undefined, rval=undefined;
    if (process.argv.length > 4) {
        if (process.argv.length > 5) {
            lval = process.argv[5].toLowerCase();
            op   = process.argv[4].toLowerCase();
        } 
        if (process.argv.length > 6) { 
            rval = process.argv[6].toLowerCase();
            console.log('searching for ' + pname + " " + op + " " + lval + " " + rval);            
        } else {
            console.log('searching for ' + pname + " " + op + " " + lval);
            
        }
    }

    var res = meta.byName(pname,lval,op,rval);
    var tdelta = Date.now() - tthen;
    if (res != undefined) {
        console.log(res);
        console.log(res.length + ' results (in ' + tdelta + 'ms)');
    }
}
   

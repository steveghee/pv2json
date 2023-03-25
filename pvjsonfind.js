// SG
// pvjsonfind v2
//
var fs = require('fs');
var linq=require('linq');

if (process.argv.length < 3) {
    console.log("usage : pvjsonfind filename - list attributes in file");
    console.log("        pvjsonfind filename attribute-name - list all nodes with attribute");
    console.log("        pvjsonfind filename attribute-name [compare value [value2]]");
    console.log("        - compare can be :-");
    console.log("          - start,like,same,unlike : string comparison");
    console.log("          - eq,ne,ge,le,lt,gt      : numeric comparison");
    console.log("          - in,out                 : numeric range comparison");
    console.log("          - before,after           : date/time comparison");
    process.exit(1);
}

var fi  = process.argv[2];
var pvs = JSON.parse(fs.readFileSync(fi,'utf8'));

var iroot = pvs.components.length - 1;
console.log('there are ' + iroot + ' components');

var cmds = {
    "starts": function (a, b) { return a.search(b) === 0 },
    "not"  :  function (a, b) { return a != b },
    "same"  : function (a, b) { return a === b },
    "like"  : function (a, b) { return a.search(b) >= 0 },
    "unlike": function (a, b) { return a.search(b) < 0 },
    "eq"    : function (a, b) { return parseFloat(a) === parseFloat(b) },
    "ne"    : function (a, b) { return parseFloat(a) !=  parseFloat(b) },
    "le"    : function (a, b) { return parseFloat(a) <=  parseFloat(b) },
    "ge"    : function (a, b) { return parseFloat(a) >=  parseFloat(b) },
    "lt"    : function (a, b) { return parseFloat(a)  <  parseFloat(b) },
    "gt"    : function (a, b) { return parseFloat(a)  >  parseFloat(b) },
    "in"    : function (a,b,c){ var pa = parseFloat(a); return  (pa > parseFloat(b) && pa < parseFloat(c)) },
    "out"   : function (a,b,c){ var pa = parseFloat(a); return !(pa > parseFloat(b) && pa < parseFloat(c)) },
    "before": function (a,b)  { var pa = Date.parse(a); var pb = Date.parse(b); return pa < pb; },
    "after" : function (a,b)  { var pa = Date.parse(a); var pb = Date.parse(b); return pa > pb; },
};

if (process.argv.length < 4) {
    // we have a file but no params. let's list out the
    // set of unique property names
    props = linq.from(pvs.components)
                .where (function(cmp) { return cmp.properties != undefined })
                .select(function(s) { 
                    var names = linq.from(s.properties)
                                    .select(function(n) { return n.key})
                                    .toArray();
            
                    var instances = linq.from(s.children)
                                        .where (function(c) { return c.properties != undefined; })
                                        .select(function(c) {
                                            var inames = linq.from(c.properties)
                                                             .select(function(n) { return n.key})
                                                             .toArray();
                                            return inames;
                                        })
                                        .toArray();
                
                    var result = linq.from(names)
                                     .union(instances)
                                     .toArray();
                    return result;;
                })
                .toArray();
    
    // now count these up    
    var unique=new Object();
    props.forEach(function (a) {
        if (a != undefined && a instanceof Array) a.forEach(function (b) {
            if (b instanceof Array) {
                b.forEach(function(c){
                    if (unique[c] === undefined)
                         unique[c] = 1;
                    else
                        unique[c] += 1;
                });
            }
            else {
                if (unique[b] === undefined)
                    unique[b] = 1;
                else
                    unique[b] += 1;
            }
        });
    });
        
    // unsorted list, but doesnt trip out the heap!
    var order = new Array();
    for (var key in unique) {
        if (unique.hasOwnProperty(key)) {
            order.push({name:key, count:unique[key]});
        }
    }
    
    // finally, sort by name (or value)
    var oot = linq.from(order)
                  .orderBy('$.name')
                //.orderBy("$.value")
                  .select(function(n) { return n; }) //return {name:n.key, count:n.value};})
                  .toArray();
              
    // sorted list of property name:count          
    console.log(oot);
}
else {
    // we have a property name  
    var pname = process.argv[3].toLowerCase();
    var props = undefined;
  
    // do we have a property value?
    if (process.argv.length > 4) {
        var pval, comparer, rval=undefined;
        if (process.argv.length > 5) {
            pval = process.argv[5].toLowerCase();

            //yes, so lets look for name < value  
            compstr  = process.argv[4];
            comparer = cmds[compstr];
            console.log('searching for ' + pname + " " + compstr + " " + pval);
        }
        else {
            pval = process.argv[4].toLowerCase();

            //yes, so lets look for name==value  
            console.log('searching for ' + pname + " = " + pval);
            comparer = cmds["eq"];
        }
        if (process.argv.length > 6) 
            rval = process.argv[6].toLowerCase();
            
        var pps = [];
        pvs.components.forEach(function(cmp) {
            var kids = linq.from(cmp.children)
                           .where(function (c) {
                               var cref = pvs.components[c.cidref];
                               return cref.properties        != undefined &&
                                      cref.properties[pname] != undefined &&
                                      comparer(cref.properties[pname],pval,rval); })
                           .select(function (s) { 
                               return { cid: s.cidref, par:cmp.cid, vid:s.vid, key: pname, value: pvs.components[s.cidref].properties[pname] };})
                           .toArray();
            kids.forEach(function(a) { pps.push(a)});
        });
  
        var ips = [];
        pvs.components.forEach(function(cmp) {
            var kids = linq.from(cmp.children)
            .where(function (c) {
                               return c.properties        != undefined &&
                                      c.properties[pname] != undefined &&
                                      comparer(c.properties[pname],pval,rval); })
                           .select(function(s) { 
                               return { cid: s.cidref, par:cmp.cid, vid:s.vid, key: pname, value: s.properties[pname] };})
                           .toArray();   
            kids.forEach(function(a) { ips.push(a)});
        });
        props = linq.from(pps).union(ips).toArray();
    }
    else { 
        console.log('searching for ' + pname);  
        var pps = [];
        pvs.components.forEach(function(cmp) {
            var kids = linq.from(cmp.children)
                           .where(function (c) {
                               var cref = pvs.components[c.cidref];
                               return cref.properties        != undefined &&
                                      cref.properties[pname] != undefined ; })
                           .select(function (s) { 
                               return { cid: s.cidref, par:cmp.cid, vid:s.vid, key: pname, value: pvs.components[s.cidref].properties[pname] };})
                           .toArray();
            kids.forEach(function(a) { pps.push(a)});
        });
//        console.log(pps);   
  
        var ips = [];
        pvs.components.forEach(function(cmp) {
            var kids = linq.from(cmp.children)
            .where(function (c) {
                               return c.properties        != undefined &&
                                      c.properties[pname] != undefined ; })
                           .select(function(s) { 
                               return { cid: s.cidref, par:cmp.cid, vid:s.vid, key: pname, value: s.properties[pname] };})
                           .toArray();   
            kids.forEach(function(a) { ips.push(a)});
        });
//        console.log(ips);   
        props = linq.from(pps).union(ips).toArray();
        console.log(props);
    }
    //console.log(props);
    if (props != undefined) {  
        console.log('found ' + props.length);
        var inst = linq.from(pvs.idmap)
                       //.join(props,"map=>map.value.cid","id=>id.cid","outer,inner=>{path:outer.key, key:inner.key, value:inner.value}")
                       .join(props,"map=>map.value.cid+'/'+map.value.par+'/'+map.value.vid","id=>id.cid+'/'+id.par+'/'+id.vid","outer,inner=>{path:outer.key, key:inner.key, value:inner.value}")
                       .select(function(s) { return s; })
                       .toArray();
        console.log(inst); 
        console.log('found ' + inst.length);
    }
    else 
        console.log('no results');
}

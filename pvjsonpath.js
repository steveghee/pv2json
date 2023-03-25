// SG
// pvjsonpath v2
//
var fs = require('fs');
var linq=require('linq');

if (process.argv.length < 3) {
    console.log("usage : pvjsonpath filename - list item paths in file");
    console.log("        pvjsonpath filename path - list all attributes for the specified instance");
    process.exit(1);
}

var fi  = process.argv[2];
var pvs = JSON.parse(fs.readFileSync(fi,'utf8'));

var iroot = pvs.components.length - 1;
console.log('there are ' + iroot + ' components');

if (process.argv.length < 4) {
    // we have a file but no params. let's list out the
    // set of unique property names
    comps = linq.from(pvs.idmap)
                .select(function(s) { 
                    return s;
                })
                .toArray();
    
              
    // sorted list of property name:count          
    console.log(comps);
}
else {
    // we have a path  
    var path   = process.argv[3].toLowerCase();
    var props  = undefined;
    var psplit = path.split('/');
    var vidref = psplit[psplit.length-1];
    
    console.log('searching for ' + path);
    
    var comp = linq.from(pvs.idmap)
                   .where(function(cmp) { return (cmp.key != undefined &&
                                                  cmp.key.toLowerCase() == path.toLowerCase()) })
                       .select(function(s) {
                        return s;
                    })
                   .toArray();
    
    var cid = comp[0].value.cid; //pvs.idmap[path].cid;
    //console.log('root component is ' + cid);
    
    // get the properties from the root component
    var inst = linq.from(pvs.idmap)
                   .where(function(cmp) { return (cmp.value != undefined &&
                                                  cmp.value.cid === cid);})
                   .select(function(s) { return s; })
                   .toArray();
        
    if (inst.length > 1)    
        console.log('note: there are ' + inst.length  + ' instances of component ' + cid);    
    props = pvs.components[cid].properties;
    
    // now find the specific instance - it can have properties / overrides
    var pid = comp[0].value.par;
    var kdx = comp[0].value.idx;
    
    if (pid != undefined && kdx != undefined) {
        
        //console.log('looking for child '+ kdx + ' of parent ' + pid);
        
        var kid = pvs.components[pid].children[kdx];
        if (kid.properties != undefined) {
            for(var p in kid.properties) {
                props[p] = kid.properties[p];
            }
        }
        
    }
    
    // now print out the properies
    if (props != undefined) {  
        //console.log(props);
        var filter = (process.argv.length>4) ? process.argv[4].toLowerCase() : undefined;
        var prop = filter != undefined ? props[filter] : undefined;
        console.log(prop != undefined ? filter+": '"+prop+"'" : props); 
    }
    else 
        console.log('no results');
}

var fs = require('fs');
var linq=require('linq');

if (process.argv.length < 3) {
    console.log("usage : pvjsonfind filename - list attributes in file");
    process.exit(1);
}

var fi  = process.argv[2];
var pvs = JSON.parse(fs.readFileSync(fi,'utf8'));

var iroot = pvs.components.length - 1;

var rootid = pvs.idmap['/'].cid;
var root = pvs.components[rootid];
var counter = new Object(); //Array();
for (var i=0; i<root.children.length; i++) {
    var cmp = pvs.components[root.children[i].cidref];
    var namelist = cmp.properties.name.split(' /');
    var checker = namelist[namelist.length-1];// pick the last item
    if (counter[checker] === undefined) {
        counter[checker] = new Array();
    }
    counter[checker].push(cmp);
}
//build a new component array
var newcomps = new Array();
// push the originals (but not the old root)... 
for (var k=0; k<rootid; k++) {
  newcomps.push(pvs.components[k]);
}
// now push the new 'collectors'
var newkids = new Array();
var newid = rootid ;
for(idx in counter) {
    var mykids = new Array();
    // reference my children
    counter[idx].forEach(function(kid) {
       mykids.push({ cidref:kid.cid, vid:kid.cid });                  
    });
    // add myself to the comp list    
    newcomps.push( { 
        cid: newid, children:mykids, properties: { name: idx }
    });
    // and add myself as a child to the new root    
    newkids.push({ cidref:newid, vid:newid++});    
};
// finally push the old root, but with new child structure
newcomps.push(root);
root.children = newkids;

/*
var fo = process.argv[3];
console.log(fo);
if (fo === undefined)
    console.log(JSON.stringify(pvs));
else
    fs.writeFile(fo, JSON.stringify(pvs,null,'\t'), function(err){
        		if (err) throw err;
        		console.log('Done!');
    });
*/
console.log('<PV_FILE type="PVS" version="0302">');
console.log('<section_index>');
console.log('  <internal_section type="2"/>');
console.log('  <internal_section type="3"/>');
console.log('</section_index>');
console.log('<section_structure>');

// write out components
newcomps.forEach(function(cmp) {
    console.log('  <component name="' + cmp.properties.name + '">');
    if (cmp.children != undefined) {
        cmp.children.forEach(function(kid) {
            console.log('    <component_instance index="' + kid.cidref +'" id="' + kid.vid + '"/>');
        });
    }
    if (cmp.shape != undefined) { 
        var olname = cmp.shape.replace(".json",".ol");
        console.log('    <shape_source file_name="' + olname + '"/>'); 
    }
    console.log('  </component>');                   
});

console.log('</section_structure>');
console.log('<section_properties>');
console.log('  <property_component_ref index_offset="' + (rootid+1) + '">');
for(prop in root.properties) {
    console.log('    <property name="' + prop + '" value="' + root.properties[prop] + '"/>');
}
console.log('  </property_component_ref>');
console.log('</section_properties>');
console.log('</PV_FILE>');

// SG
// json2pvs
//
var fs = require('fs');

if (process.argv.length < 3) {
    console.log("usage : json2pvs filename [outname]");
    process.exit(1);
}

var fi  = process.argv[2];
var pvs = JSON.parse(fs.readFileSync(fi,'utf8'));

var iroot = pvs.components.length - 1;
console.log('there are ' + iroot + ' components');

function writeHeader(fo) {
    
    var s = '<PV_FILE type="PVS" version="0302">\n';
    s    += '<section_index>\n  <internal_section type="2"/>\n</section_index>\n';
    s    += '<section_structure>';
    if (fo != undefined) fo.write(s); else console.log(s);
    if (fo != undefined) fo.write('\n'); 
}
function writeFooter(fo) {
    
    var s = '</section_structure>\n</PV_FILE>';
    if (fo != undefined) fo.write(s); else console.log(s);
    if (fo != undefined) fo.write('\n'); 
}

function writeBox(box){
    var s='"';
    for(var i=0;i<3;i++) {
        s += box.min[i]+',';
    }
    for(var j=0;j<3;j++) {
        s += box.max[j];
        if (j<2) s+= (',');
    }
    s += '"';
    return s;
}

function writeLocation(loc) {
    var s='';
    if (loc.position != undefined) {
        s+=' translation="'+loc.position[0]+','+loc.position[1]+','+loc.position[2]+'"';
    }
    if (loc.orientation != undefined) {
        s+=' orientation="';
        for(var i=0;i<9;i++) {
            s+=loc.orientation.matrix[i];
            if (i<8) s+=',';
        }
        s+='"';
    }
    return s;
}

var outstream = undefined;
if (process.argv.length > 3) {
    
    var fo  = process.argv[3];
    outstream = fs.createWriteStream(fo);

}

writeHeader(outstream);

var nameattr='name';
if (process.argv.length > 4) nameattr = process.argv[4];

for(var i=0;i<pvs.components.length;i++) {
        
    var c = pvs.components[i];
        
    var s = '  <component name="'+c.properties[nameattr]+'">';
    if (c.shape != undefined) {
        s += '\n    <shape_source file_name="'+c.shape.replace('.json','.ol')+'" bbox='+writeBox(c.bbox)+'/>';
    }
    if (c.children != undefined) c.children.forEach(function(kid) {
        s += '\n    <component_instance index="'+kid.cidref+'"';
        if (kid.location != undefined)       s += writeLocation(kid.location);                                            
        if (!kid.vid.includes('PV-AUTO-ID')) s += ' id="'+kid.vid+'"';
        s += '/>';
    });
    s += '\n  </component>';
    if (outstream != undefined) outstream.write(s); else console.log(s);
    if (outstream != undefined) outstream.write('\n'); 
}
    
writeFooter(outstream);

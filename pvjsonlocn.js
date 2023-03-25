var fs = require('fs');
var matrix = require('./matrix.js');

if (process.argv.length < 3) {
    console.log("usage : pvjsonlocn filename - list locations in file");
    console.log("        pvjsonlocn filename path - list location of specified instance");
    process.exit(1);
}

var fi= process.argv[2];
var pvs = JSON.parse(fs.readFileSync(fi,'utf8'));
var pvj = new Object();

function traverse(node, position, path, isolate, anchor) {
    if (node.children != undefined) {
        node.children.forEach(function(kid) {
            var child = pvs.components[kid.cidref];
            var m = new matrix.Matrix4();
            if (kid.location != undefined) {
                 if (kid.location.orientation != undefined) 
                    m.RotateA(kid.location.orientation.matrix);
                if (kid.location.position != undefined)
                    m.TranslateV(kid.location.position);
            }
            if (position != undefined)
                m.Multiply(position.m);
                
            var ech = path[path.length-1];
            var idpath;
            if (ech != '/') 
                idpath = path + "/" + kid.vid;
            else 
                idpath = path + kid.vid;
            traverse(child, m, idpath, isolate, anchor);
        });
    }
        
    var inst = new Object();
    var pname = node.properties["name"];
    inst.name = pname != undefined ? pname : "undefined";
  
    if (isolate != undefined && isolate != path)
        return null;
        
    pvj[path] = inst;
    if (position != undefined) 
        inst.location = position.ToPosEuler(true); 
            
}

var iroot = pvs.components.length - 1;
var root  = pvs.components[iroot];
var path  = process.argv[3];
var anchor= process.argv[4];
if (path === '*') path = undefined;
traverse(root, undefined, "/", path, anchor);
var fo = process.argv[5];
//console.log(fo);
if (fo === undefined)
    console.log(JSON.stringify(pvj,null,'\t'));
else
    fs.writeFile(fo, JSON.stringify(pvj,null,'\t'), function(err){
        if (err) throw err;
        console.log('Done!');
    })



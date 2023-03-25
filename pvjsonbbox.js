var fs     = require('fs');
var matrix = require('./matrix.js');

if (process.argv.length < 3) {
    console.log("usage : pvjsonbbox filename - list all the bounding boxes in file");
    console.log("        pvjsonbbox filename path - list the bounding boxes for the specified instance");
    console.log("        pvjsonbbox filename path anchor - list the specified anchor");
    console.log("        - anchor is a 3-character patter that defines the position of the anchor point in each dimension xyz :-");
    console.log("          - t = top");
    console.log("          - c = center");
    console.log("          - b = bottom");
    console.log("        - so for example ctc = center(x), top(y), center(z)");
    console.log("        - path can be '*' to show all specified anchor for all items");
    process.exit(1);
}

var fi  = process.argv[2];
var pvs = JSON.parse(fs.readFileSync(fi,'utf8'));
var pvj = new Object();

function traverse(node, position, path, isolate, anchor) {
    var cbox = undefined;
    if (node.children != undefined) {
        cbox = new matrix.BBox();
        node.children.forEach(function(kid) {
            var child = pvs.components[kid.cidref];
            var m     = new matrix.Matrix4();
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
                
            cbox.Envelope(traverse(child, m, idpath, isolate, anchor));
            //console.log(path+' '+cbox.ToString());    
        });
    }
        
    if (node.shape != undefined) {    
        if (node.bbox != undefined) {
            var box   = new matrix.BBox().Set(node.bbox.min, node.bbox.max);
            var inst  = new Object();
            var pname = node.properties["name"];
            inst.name = pname != undefined ? pname : "undefined";
            
            if (anchor != undefined)
                inst.anchors = new Object(); //Array();
                
            if (isolate != undefined && isolate != path) {
                // compute it (for parents) but don't log it        
            } else {
                pvj[path] = inst;
            }
            
            if (position != undefined) {
                var tbox = box.Transform(position);
                
                if (anchor != undefined) {
                    // all the anchors (including centers)
                    tbox.EnumerateAll(function(c,v) {                  
                    //or just the corners
                    //tbox.EnumerateCorners(function(c,v) {                                 
                
                      inst.anchors[c] = v.v;
                    }, anchor);
                } else {
                    inst.min = tbox.min;
                    inst.max = tbox.max;    
                }
                //console.log(path+' 1 '+tbox.ToString());    
                return tbox;    
            } else {
                if (anchor != undefined) {
                    box.EnumerateAll(function(c,v) {  
                    //box.EnumerateCorners(function(c,v) {                                 
                       inst.anchors[c] = v.v;
                    }, anchor);
                } else {
                    inst.min = box.min;
                    inst.max = box.max;    
                }
                //console.log(path+' 2 '+tbox.ToString());    
                return box;    
            }
        } else return undefined;
    } else if (cbox != undefined) {
        var inst  = new Object();
        var pname = node.properties["name"];
        inst.name = pname != undefined ? pname : "undefined";
        
        if (anchor != undefined) 
            inst.anchors = new Object(); //Array();
            
        if (isolate != undefined && isolate != path) {
            // compute it (for parents) but don't log it        
        } else {
            pvj[path] = inst;
        }
        
        // note all the children are already transformed to our space
        // so no we just use this box
        if (anchor != undefined) {
            cbox.EnumerateAll(function(c,v) {  
            //cbox.EnumerateCorners(function(c,v) {                                 
                 inst.anchors[c] = v.v;
            }, anchor);
        } else {
            inst.min = cbox.min;
            inst.max = cbox.max;    
        }
        //console.log(path+' 3 '+cbox.ToString());    
        return cbox;    
    } else 
        return undefined;    
}

var iroot  = pvs.components.length - 1;
var root   = pvs.components[iroot];
var path   = process.argv[3];
var anchor = process.argv[4];

if (path === '*') path = undefined;
traverse(root, undefined, "/", path, anchor);

var fo = process.argv[5];
if (fo === undefined)
    console.log(JSON.stringify(pvj,null,'\t'));
else
    fs.writeFile(fo, JSON.stringify(pvj), function(err){
        if (err) throw err;
        console.log('Done!');
    })



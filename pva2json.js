// SG
// pva2json v1
//
var fs = require('fs');
var x2j= require('xml2js');
var linq=require('linq');
var matrix = require('./matrix.js');

var cmps = new Array();
var minimal = process.argv.length >4;

function traverse(root, map, path, visibility) {
    
    //console.log (root);
    
    function nonzero(a) {
        // is this a position or orientation
        if (a.a != undefined) {
            // orientation
            if (parseFloat(a.a) != 0.0) {
                // turn into eulers
                var m = new matrix.Matrix4().Rotate([a.x,a.y,a.z],a.a);
                return m.ToEuler(true);
            }
            else 
                return undefined;
            
        } else {
            // position
            if (parseFloat(a.x) != 0.0 && parseFloat(a.y) != 0.0 && parseFloat(a.z) != 0.0)
                return a;
            else 
                return undefined;
        }
    }
    
    var tid = (root.$ != undefined) ? root.$.id : '';
    var idpath;
    if (path != '/') 
        idpath = path + "/" + tid
    else 
        idpath = path + tid;
    
    var node = new Object();    
        
    var cvis = visibility; // inherited state    
    if (root.visible != undefined) {
        // write out visibility IF the state changes    
        if (root.visible[0].$.self != visibility) {
            node.visibility = root.visible[0].$;
            map[idpath] = node;
        }
        // pass down inherited CHILD state
        cvis = root.visible[0].$.child;
    }
    
    // does this node define any positional changes?
    if (root.position != undefined || root.orientation != undefined) {
        // we should only write these if they are DIFFERENT to the defaults
        // which would mean processing this list after having loaded the 
        // master structure
        
        // for now, lets check for non-zero
        node.position    = nonzero(root.position[0].$);
        node.orientation = nonzero(root.orientation[0].$);
        if (node.position != undefined || node.orientation != undefined)
            map[idpath] = node;
    }
    
    if (root.component != undefined && root.component.length > 0) {
	root.component.forEach(function(child) {
      	    traverse(child,map,idpath, cvis);
	});	
    }
    return map;
}

var all = new Object();
all.views = new Array();
all.idmap = new Object();

function convert(pvs) {
    var top = pvs["pva"];    
    var set = top.set;
    var map = new Object();
    for (var ri in set[0].component) {
        var root= set[0].component[ri];
        traverse(root, map, '', undefined);
    }
    console.log(set[0].$.name);
    all.views.push(map);
    all.idmap[set[0].$.name] = all.views.length - 1;
}


function processPva(fi,fn) {
  // fi = file in
  //var fi= process.argv[2];
  var parser = new x2j.Parser();
  fs.readFile(fi, function(err, data) {
    //console.log('read file ok');
    parser.parseString(data, function (err, result) {
        var pvs = JSON.stringify(result);
        convert(result);
        if (fn!=undefined) fn();
    });
  });
}

var counter = 0;
function readFiles(dirname, rootfile, onError) {
  fs.readdir(dirname, function(err, filenames) {
    if (err) {
      onError(err);
      return;
    }
    var toProcess = new Array();
    filenames.forEach(function(filename) {
      if (filename.startsWith(rootfile) && filename.endsWith('.pva')) toProcess.push(filename);                
    });
    counter = toProcess.length;
    console.log('there are ' + counter + ' files to process');    

    for(var i=0; i < toProcess.length; i++) {
        processPva(toProcess[i], function() {
          counter = counter - 1;        
          if (counter === 0) {
              var fo  = process.argv[3];
              if (fo === undefined)
                console.log(JSON.stringify(all,null,'\t'));
              else
                fs.writeFile(fo, JSON.stringify(all,null,'\t'), function(err){
                        if (err) throw err;
        		console.log('Done!');
                })
          }
        });
    }
  });
}
  
var fi  = process.argv[2];
readFiles('.', fi);


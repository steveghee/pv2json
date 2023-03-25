// SG
// pvs2json v1
//
var fs = require('fs');
var x2j= require('xml2js');
var linq=require('linq');
var matrix = require('./matrix.js');

var cmps = new Array();
var minimal = process.argv.length >4;

function bounds(arr) {
	if (arr != undefined) {
		var box = new Object();
		box.min = new Array();
		box.max = new Array();
		for (var i=0; i<3; i++) {
			box.min.push(arr[i]);
			box.max.push(arr[i+3]);
		}
		return box;
	}
	return undefined;
}

function coords(str,clamp) {	
  if (str != undefined) {
    var posar = new Array();
    str.split(",").forEach(function(coord) {
        var p = parseFloat(coord);
        if (clamp != undefined && clamp===true && p < 0.000001 &&  p > -0.000001) {
            p = 0;
        }
	posar.push(p);
    });
    return posar;
  }
  return undefined;
}

function buildLocation($) {	
    if (!minimal && (($.orientation != undefined) || ($.translation != undefined))) {
        var location = new Object();        	    
        location.position = coords($.translation);
        if ($.orientation != undefined) {
            location.orientation = new Object();
            location.orientation.matrix = coords($.orientation);
            location.orientation.euler  = new matrix.Matrix4().RotateA(location.orientation.matrix).ToEuler(true);
        }
        return location;
    }
    return undefined;
}

function format(id) {
    if (id < 10) return  '@@PV-AUTO-ID@@00' + id;
    if (id < 100) return '@@PV-AUTO-ID@@0' + id;
    return               '@@PV-AUTO-ID@@'+id;
}

function traverse(root, map, path) {
	if (map === undefined)
	    map = new Object();
	map[path]=root.cid;
	if (root.children != undefined && root.children.length > 0) {
	    root.children.forEach(function(child) {
                var ech = path[path.length-1];
	    	var idpath;
                if (ech != '/') 
                    idpath = path + "/" + child.vid;
                else 
                    idpath = path + child.vid;
	    	traverse(cmps[child.cidref],map,idpath);
	    });	
	}
	return map;
}
function traverse2(root, map, path,parent,kid) {
	if (map === undefined)
	    map = new Object();
            map[path] = { 
                cid: root.cid, 
                par:(parent != undefined)?parent.cid : undefined,
                vid:(kid    != undefined)?kid.vid : undefined
            };
	if (root.children != undefined && root.children.length > 0) {
	    root.children.forEach(function(child) {
                var ech = path[path.length-1];
	    	var idpath;
                if (ech != '/') 
                    idpath = path + "/" + child.vid;
                else 
                    idpath = path + child.vid;
	    	traverse2(cmps[child.cidref],map,idpath,root,child);
	    });	
	}
	return map;
}
function traverse3(root, map, path,parent,kididx,vid) {
	if (map === undefined)
	    map = new Object();
            map[path] = { 
                cid: root.cid, 
                par:(parent != undefined)?parent.cid : undefined,
                idx:(kididx != undefined)?kididx     : undefined,
                vid:(vid    != undefined)?vid        : undefined
            };
	if (root.children != undefined && root.children.length > 0) {
	    for (var kididx in root.children) {
                var child = root.children[kididx];
                var ech = path[path.length-1];
	    	var idpath;
                if (ech != '/') 
                    idpath = path + "/" + child.vid;
                else 
                    idpath = path + child.vid;
	    	traverse3(cmps[child.cidref],map,idpath,root,kididx,child.vid);
	    }	
	}
	return map;
}

function show(msg, cns) {
    console.log(msg);
    for (c in cns) { console.log(c + "<" + cns[c].ToString()); }
}



function gatherboxes(files) {
	var ba = new Array();
	files.forEach(function(f) {
		if (f.bbox != undefined) {
			f.bbox.min.forEach(function(min) { ba.push(min); });
			f.bbox.max.forEach(function(max) { ba.push(max); });
		}
	});
	return ba;
}

function convert(pvs) {
    var top = pvs["PV_FILE"];    
    var proxy  = top.section_structure[0].component_proxy;
    var struct = top.section_structure[0].component;
    var props  = top.section_properties; 
    
    // we're going to read the structure and property sections and merge them
    var fils = new Array();
    var root = undefined;
    var cid  = 0;
    
    // fist up we have component_proxy items, which are extenal pvs references
    // these reference a file in a magic directory, not the current folder but also no specified
    // path.  Ideally the external pvs (json) file would be included inline
    // for now, we will insert the empty node as this will ensure the rest of the file can be parsed 
    // correctly
    if (proxy != undefined && proxy.length > 0) {
        console.log('please note : pvs2json does not support nested pvs files');
        for (var i=0; i< proxy.length; i++) {
            var comp    = proxy[i];
            cmp         = new Object();
            cmp.cid     = cid++;
            cmp.fileref = comp.$.file_name;
            cmps.push(cmp);
        }
    }
    
    // now read in the remainder - note we offset the base ID based on the proxys
    for (var i=0; i< struct.length; i++) {
        //console.log("index = "+i);
        var cmp = new Object();
        
        var comp = struct[i];
        cmp.cid = i + cid;
                
        var shp = comp.shape_source;
        if (!minimal && shp != undefined) {
            cmp.shape = shp[0].$.file_name.replace(".ol", ".json");
            cmp.bbox  = bounds(coords(shp[0].$.bbox));
        }
        
        var ist = comp.component_instance;
        if (ist != undefined) {
            cmp.children = new Array();
            var tid = 0;
            ist.forEach(function(inst) {
                var iidx = parseInt(inst.$.index);
                cmp.children.push(
                    {
            	    cidref  : iidx,
                    vid     : (inst.$.id != undefined) ? inst.$.id : format(tid),
                    location: buildLocation(inst.$)
            	    }
                );
                tid += 1;
            });
        }
        // add property bucket    
        cmp.properties = new Object();
        // throw in the object name by default
        cmp.properties['name'] = comp.$.name.replace(/ /g,'_').toLowerCase().trim();
        // we'll get the other properties later...
        
        root = cmp;
        cmps.push(cmp);
    }
    console.log('there are ' + cmps.length + ' components');
    
    var psx = 1;
    props.forEach(function(p){
        var idx = 0;          
        //console.log('section ' + top.section_index[0].internal_section[psx++].$.description);
    	p.property_component_ref.forEach(function(q){
            if (q.$ != undefined) idx += q.$.index_offset-1; 
            //instance properties                             
            if (q.property_instance_ref != undefined) {
                var cidx = 0;
    	        q.property_instance_ref.forEach(function(r){
                    if (r.$ != undefined) cidx += r.$.index_offset-1; 
                    if (r.property != undefined) {
    	                r.property.forEach(function(s){
                            var inst = cmps[idx].children[cidx];
                            if (inst.properties === undefined) 
                                inst.properties = new Object();
                            inst.properties[s.$.name.toLowerCase()]=s.$.value.toLowerCase().trim();
                            //console.log('instance '+cidx+' of component '+idx+' has property '+s.$.name+' = ' + s.$.value);    
                        });
                    }
                    cidx+=1;    
                });
            }
                
            //component properties    
            if (q.property != undefined) {
                q.property.forEach(function (r) {
                    var pname = encodeURIComponent(r.$.name.toLowerCase());
                    if (cmps[idx].properties === undefined)
                        cmps[idx].properties = new Array();
                    //cmps[idx].properties[pname] = r.$.value.toLowerCase().trim();
                    cmps[idx].properties[r.$.name.toLowerCase().replace(/ /g,'_')] = r.$.value.toLowerCase().trim();
                    //console.log('component '+idx+' has property '+r.$.name+' = ' + r.$.value);    
                });
            }
            idx+=1;
    	});
    });

    var all = new Object();
    all.components = cmps;
    
    // now traverse the structure and build up a map of id path to comp id
    // new version with additional info in the map (used by jsonpath util)
    all.idmap = traverse3(root,undefined,"/",undefined);
    // original version (different map output)
    //all.idmap = traverse(root,undefined,"/");
    
    /*
      some experimentation with linqjs
      
    var files = new linq.from(all.idmap)
    .where(function(w) { return cmps[w.value].shape != undefined; })
    .select(function(s) { 
    	var cmp = cmps[s.value];
     	return { 
        	shape: cmp.shape, 
    	    bbox: cmp.bbox,
    	    idpath : s.key
    	}
    })
    .orderBy(function(o) {
    	if (o.bbox != undefined) {
    	  var dm = o.bbox.min;
    	  var dx = o.bbox.max;
    	  var dg = ((dx[0]-dm[0])*(dx[0]-dm[0])) +
    	           ((dx[1]-dm[1])*(dx[1]-dm[1])) + 
    	           ((dx[2]-dm[2])*(dx[2]-dm[2])) ;
    	  return -dg; // reverse the order
        }
    })
    .toArray();
    // now reband this data into 3 long arrays;
    all.opt = {
    	olfiles: new linq.from(files).select(function(s){return s.shape}).toArray(),
    	idpaths: new linq.from(files).select(function(s){return s.idpath}).toArray(),
    	bboxs  : gatherboxes(files)
    }
    */

    return all;
}

// fi = file in
var fi= process.argv[2];
var parser = new x2j.Parser();
fs.readFile(fi, function(err, data) {
    //console.log('read file ok',fi,data,err);
    parser.parseString(data, function (err, result) {
        var pvs = JSON.stringify(result);
        //console.log(pvs);             
        var all = convert(result);
        var fo  = process.argv[3];
        if (fo === undefined)
            console.log(JSON.stringify(all,null,'\t'));
        else
            fs.writeFile(fo, JSON.stringify(all), function(err){
        		if (err) throw err;
        		console.log('Done!');
            })
    });
});
    

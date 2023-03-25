// utility to search jsonified pvs property descriptions
//
var linq=require('linq');
var matrix = require('./matrix.js');


var cmds = {
    "starts": function (a, b) { return a.search(b) === 0 },
    "not"  :  function (a, b) { return a != b },
    "same"  : function (a, b) { return a === b },
    "like"  : function (a, b) { return a.search(b) >= 0 },
    "unlike": function (a, b) { return a.search(b) < 0 },
    "eq"    : function (a, b) { return parseFloat(a) === parseFloat(b) },
    "ne"    : function (a, b) { return parseFloat(a) !=  parseFloat(b) },
    "lt"    : function (a, b) { return parseFloat(a)  <  parseFloat(b) },
    "gt"    : function (a, b) { return parseFloat(a)  >  parseFloat(b) },
    "in"    : function (a,b,c){ var pa = parseFloat(a); return  (pa >= parseFloat(b) && pa <= parseFloat(c)) },
    "out"   : function (a,b,c){ var pa = parseFloat(a); return !(pa >= parseFloat(b) && pa <= parseFloat(c)) },
    "before": function (a,b)  { var pa = Date.parse(a); var pb = Date.parse(b); return pa < pb; },
    "after" : function (a,b)  { var pa = Date.parse(a); var pb = Date.parse(b); return pa > pb; },
};

function traverse(node, position, path, isolate, anchor, inst) {
    var cbox = undefined;    
    if (node.children != undefined) {
if (inst.properties === undefined) inst.properties = {};
if (inst.properties.__class === undefined) inst.properties.__class = 'asm';
else inst.properties.__class += ' asm';

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
                
            // save this for future access
            kid.global = {}; kid.global.matrix = m;
            
            var ech = path[path.length-1];
            var idpath;
            if (ech != '/') 
                idpath = path + "/" + kid.vid;
            else 
                idpath = path + kid.vid;
                
            cbox.Envelope(traverse(child, m, idpath, isolate, anchor, kid));
        });
    } else node.properties.__class = '';

if (inst.properties === undefined) inst.properties = {};
inst.properties.__$ = (node.properties != undefined) ? node.properties['name'] : undefined;
inst.properties.__path = path;    

    if (node.shape != undefined) {
if (inst.properties.__class === undefined) inst.properties.__class = 'part';
else inst.properties.__class += ' part';
        if (node.bbox != undefined) {
            var box   = new matrix.BBox().Set(node.bbox.min, node.bbox.max);
            
            if (inst.global === undefined)
                inst.global = {};
            if (anchor != undefined)
                inst.global.anchors = {};
                
            if (position != undefined) {
                var tbox = box.Transform(position);
                
                if (anchor != undefined) {
                    // all the anchors (including centers)
                    tbox.EnumerateAll(function(c,v) {                  
                    //or just the corners
                    //tbox.EnumerateCorners(function(c,v) {                                 
                
                      inst.global.anchors[c] = v.v;
                    }, anchor);
                } 
                inst.global.min  = tbox.min;
                inst.global.max  = tbox.max; 
                inst.global.size = tbox.Size();
inst.properties.__size = inst.global.size;                
                return tbox;    
            } else {
                if (anchor != undefined) {
                    box.EnumerateAll(function(c,v) {  
                    //box.EnumerateCorners(function(c,v) {                                 
                       inst.global.anchors[c] = v.v;
                    }, anchor);
                }
                
                inst.global.min  = box.min;
                inst.global.max  = box.max;    
                inst.global.size = box.Size();
inst.properties.__size = inst.global.size;                
                
                return box;    
            }
        } else return undefined;
    } else if (cbox != undefined) {
        
        if (inst.global === undefined)
            inst.global = {};
        if (anchor != undefined) 
            inst.global.anchors = {};
        
        // note all the children are already transformed to our space
        // so no we just use this box
        if (anchor != undefined) {
            cbox.EnumerateAll(function(c,v) {  
            //cbox.EnumerateCorners(function(c,v) {                                 
                 inst.global.anchors[c] = v.v;
            }, anchor);
        } 
        inst.global.min  = cbox.min;
        inst.global.max  = cbox.max;    
        inst.global.size = cbox.Size();
inst.properties.__size = inst.global.size;                
        
        return cbox;    
    } else 
        return undefined;    
}


function metaitem(pvp,data) {
    this.data = data;
    this.pvp  = pvp;
    
    this.locn = function() {
        var idmap = this.pvp.idmap;
        var components = this.pvp.components;
        
        comps = linq.from(this.data)
                    .select(function(item) {
                        var psplit = item.path.split('/');
                        var vidref = psplit[psplit.length-1];
                        var cid    = idmap[item.path].cid;
                        var par    = idmap[item.path].par;
                        
                        var pps = {};
                        if (par != undefined) {
                            var kid = components[par].children[ idmap[item.path].idx] ;
                            pps.locn = kid.global.matrix;
                        } else {
                            var kid = components[cid];
                            pps.box = kid.global.matrix;
                        }
                        return { path: item.path, 
                                  key: 'locn', 
                                value: { matrix:pps.locn }}; 
                    })
                    .toArray();
        return comps;
    }
    
    this.box = function() {
        var idmap = this.pvp.idmap;
        var components = this.pvp.components;
        
        comps = linq.from(this.data)
                    .select(function(item) {
                        var psplit = item.path.split('/');
                        var vidref = psplit[psplit.length-1];
                        var cid    = idmap[item.path].cid;
                        var par    = idmap[item.path].par;
                        
                        var pps = {};
                        if (par != undefined) {
                            var kid = components[par].children[ idmap[item.path].idx] ;
                            pps.box = new matrix.BBox().Set(kid.global.min, kid.global.max);
                        } else {
                            var kid = components[cid];
                            pps.box = new matrix.BBox().Set(kid.global.min, kid.global.max);
                        }
                        return { path: item.path, 
                                  key: 'box', 
                                value: { min:pps.box.min, max:pps.box.max} }; 
                    })
                    .toArray();
        return comps;
    }
    
    this.anchor = function(anchor) {
        var idmap = this.pvp.idmap;
        var components = this.pvp.components;
        
        comps = linq.from(this.data)
                    .select(function(item) {
                        var psplit = item.path.split('/');
                        var vidref = psplit[psplit.length-1];
                        var cid    = idmap[item.path].cid; 
                        var par    = idmap[item.path].par;
                        
                        var pps = {};
                        if (par != undefined) {
                            var kid = components[par].children[ idmap[item.path].idx] ;
                            pps.anchor = (anchor != undefined) ? kid.global.anchors[anchor] : kid.global.anchors;
                        } else {
                            var kid = components[cid];
                            pps.anchor = (anchor != undefined) ? kid.global.anchors[anchor] : kid.global.anchors;
                        }
                        return { path: item.path, 
                                  key: 'anchor', 
                                value: pps.anchor }; 
                    })
                    .toArray();
        return comps;
    }

    this.get = function(name) {
        var props = undefined;
        var idmap = this.pvp.idmap;
        var components = this.pvp.components;
        
        comps = linq.from(this.data)
                    .select(function(item) {
                        var psplit = item.path.split('/');
                        var vidref = psplit[psplit.length-1];
                        var cid = idmap[item.path].cid; 
                        
                        var pps = {};
                        for(var p in components[cid].properties) {
                            if (name !=undefined) {
                                if (p === name) pps[p] = components[cid].properties[p];
                            } else {
                                pps[p] = components[cid].properties[p];
                            }
                        }
                        components.forEach(function(cmp) {
                            if (cmp.children != undefined) cmp.children.forEach(function(kid) { 
                                if (kid.cidref === cid && 
                                    kid.vid    === vidref &&
                                    kid.properties != undefined) {
                                
                                    for (var p in kid.properties) {
                                        if (name !=undefined) {
                                            if (p === name) pps[p] = kid.properties[p];
                                        } else {
                                                 pps[p] = kid.properties[p];
                                        }
                                    }
                                }
                            });
                        });          
                            
                        return { path: item.path, 
                                  key: (name != undefined) ? name      : 'properties', 
                                value: (name != undefined) ? pps[name] : pps }; 
                    })
                    .toArray();
        return comps;
    }
    
    this.select = function() {
        return this.data;
    }

}

function metadata(pvp,data) {
    this.data = data;
    this.pvp  = pvp;
    
    this.lower = function(v) {
        if (v === undefined) return v;
        if (typeof v == 'string' || v instanceof String)
            return v.toLowerCase();
        return v;
    }
    
    this.compare = function(comparer, rval, lval) {
        var prval = this.lower(rval);
        var plval = this.lower(lval);
        var pps = linq.from(this.data)
                      .where(function (cmp) {
                          return (cmp.value != undefined &&
                                  comparer(cmp.value,prval,plval)) })
                      .select(function (s) { return { cid: s.cid, par:s.par, vid:s.vid, key: s.key, value: s.value }; })
                      .toArray();
        return new metadata(this.pvp, pps);
    }
    
    this.select = function() {
        if (this.data != undefined) {  
            var inst = linq.from(this.pvp.idmap)
                           .join(this.data,"map=>map.value.cid+'/'+map.value.par+'/'+map.value.vid","id=>id.cid+'/'+id.par+'/'+id.vid","outer,inner=>{path:outer.key, key:inner.key, value:inner.value}")
                            //.join(this.data, "map=>map.value.cid","id=>id.cid","outer,inner=>{path:outer.key,key:inner.key, value:inner.value}")
                           .select(function(s) { return s; })
                           .toArray();
            return inst;               
        }
    }
    
    this.count = function() {
        return (this.data != undefined) ? this.data.length : undefined;
    }
    
    this.get = function(name) {
        var res = new metaitem(this.pvp, this.select());
        return res.get(name);
    }
    
    this.withProperty = function(name) {
        // we have a property name  
        var pname = name.toLowerCase();
        var props = [];
        var tdata = this.data;
        
        var pps = linq.from(this.data)
                      .where(function(c) { 
                             var cref = pvs.components[c.cid];
                             return cref.properties        != undefined &&
                                    cref.properties[pname] != undefined 
                         })
                      .select(function(s) { 
                              return { cid: s.cid, par:s.par, vid:s.vid, key: pname, value: pvs.components[s.cid].properties[pname] };
                         })
                      .toArray();
        var ips = [];
                  linq.from(this.data)
                      .select(function(c) { 
                           var par = c.par;
                           var pref = pvs.components[par];
                           var kids = linq.from(pref.children)
                                          .where(function(d) {
                                                 return c.cid               === d.cidref &&
                                                        c.vid               === d.vid &&
                                                        d.properties        !=  undefined &&
                                                        d.properties[pname] !=  undefined 
                                           })
                                          .select(function(s) { 
                                                  return {cid:s.cidref, par:par, vid:s.vid, key:pname, value:s.properties[pname] }; } )
                                          .toArray();
                           kids.forEach(function(a) { ips.push(a); } );
                                           
                       })
                      .toArray();
        props = linq.from(pps).union(ips).toArray();
        return new metadata(this.pvp, props);
    }
    
    this.distanceFrom = function(x,y,z) {
        // w  
        var point = new matrix.Vector4().Set3(x,y,z);
        var components = this.pvp.components;
        var comps = [];
                  linq.from(this.data)
                      .select(function(c) { 
                           var par = c.par;
                           var pref = pvs.components[par];
                           var kids = linq.from(pref.children)
                                          .where(function(d) {
                                                 return c.cid    === d.cidref &&
                                                        c.vid    === d.vid &&
                                                        d.global  != undefined 
                                           })
                                          .select(function(s) {
                                               var ptest = new matrix.Vector4().Set3a(s.global.anchors.ccc);
                                               var pdist = ptest.Sub(point).Length();
                                     
                                               return { cid:s.cidref, par:par, vid:s.vid, key: 'distance', value: pdist };
                                            })
                                            
                                          .toArray();
                           kids.forEach(function(a) { comps.push(a); } );
                                           
                       })
                      .toArray();
        return new metadata(this.pvp, comps);
    }
    
    for(cmd in cmds) {
        this[cmd] = ( function(cmp) { 
                     return function(rval,lval) { 
                         return this.compare(cmds[cmp],rval,lval); } 
                    })(cmd);
    }
}

function pvmeta(pvs) {
    this.pvp  = pvs;
    
    var iroot  = pvs.components.length - 1;
    var root   = pvs.components[iroot];
    
    // build the spatial map (bbox etc.)
    traverse(root, undefined, "/", undefined, "*", root);
             
    this.properties = function() {
        var props = linq.from(this.pvp.components)
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
        return oot;
    }
    
    this.withProperty = function(name) {
        // we have a property name  
        var pname = name.toLowerCase();
        var props = undefined;
        
        var pps = [];
        pvs.components.forEach(function(cmp) {
            var kids = linq.from(cmp.children)
                           .where(function (c) {
                               var cref = pvs.components[c.cidref];
                               return cref.properties        != undefined &&
                                      cref.properties[pname] != undefined })
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
                                      c.properties[pname] != undefined })
                           .select(function(s) { 
                               return { cid: s.cidref, par:cmp.cid, vid:s.vid, key: pname, value: s.properties[pname] };})
                           .toArray();   
            kids.forEach(function(a) { ips.push(a)});
        });
        props = linq.from(pps).union(ips).toArray();
        return new metadata(this.pvp, props);
    }
    
    this.atPath = function(path) {
        return new metaitem(this.pvp,[{ path:path }] );
    }
    
    this.withAncestor = function(path) {
        // path could be a previous select() result (list of paths) ir a single string
            var kids = linq.from(pvs.idmap)
                           .where(function (c) { 
                             if (path instanceof Array) {
                                 path.forEach(function(p) { 
//                                   console.log('testing '+c.key+' against path = ' + p.path);
                                   if (c.key.startsWith(p.path)) return true;              
                                 });         
                             } else {
                               if (c.key!= undefined && c.key.startsWith(path)) return true;
                             }
                             return false;
                           })
                               .select(function (s) { 
                               return { cid: s.value.cid, par:s.value.par, vid:s.value.vid, key: path, value: s.key };})
                           .toArray();
        return new metadata(this.pvp,kids );
    }
    
    this.paths = function() {
        var pa = new Array();
        for (key in pvs.idmap) pa.push(key);
        return pa;
    }
    
    this.distanceFrom = function(x,y,z) {
        // w  
        var point = new matrix.Vector4().Set3(x,y,z);
        var props = undefined;
        var ips = [];
        this.pvp.components.forEach(function(cmp) {
            var kids = linq.from(cmp.children)
                           .where (function(c) { if (c.global != undefined &&
                                                     c.global.anchors != undefined) {
                                                     return true;
                                                 }
                                                 else return false;
                                               })
                               .select(function(s) { 
                                       var ptest = new matrix.Vector4().Set3a(s.global.anchors.ccc);
                                       var pdist = ptest.Sub(point).Length();
                               return {cid:s.cidref, par:cmp.cid, vid:s.vid, key:'distance', value:pdist}; })
                           .toArray();   
            kids.forEach(function(a) { ips.push(a)});
        });
        props = linq.from(ips).toArray();
        return new metadata(this.pvp, props);
    }
}
exports.pvmeta = pvmeta;

var fs  = require('fs');
var fi  = process.argv[2];
var pvs = JSON.parse(fs.readFileSync(fi,'utf8'));
var m   = new pvmeta(pvs);
//var res = m.withProperty('weight_type'); //byName('name','31c','like');
//var n   = res.in('3','6').withProperty('name').select();

//var n = m.withProperty('weight').select();
var n = m.withProperty('weight').gt('10000').get('name');
//var n = m.withProperty('weight').lt('0.00001').gt(0).withProperty('feature_id').select();
//var n = m.withProperty('feature_id').eq('32').get('name');
//var n = m.withProperty('weight').lt('3').get('name');//.select();
//var n = m.withProperty('name').like('keeper').get('weight');
//var n = m.withProperty('ptc_wm_modified_on').before('2019-01-01').select();
//var n = m.withProperty('part_lifecyclestate').unlike('in work').select();
//var n = m.withProperty('feature_id').eq(32).select();
//var n = m.withProperty('weight').in(0.000020,0.000030).get('name');
//var n = m.withProperty('weight').in(0.000006,0.00001).select();
//var n = m.atPath('/4898').get();
//var b = m.withProperty('__class').like('part').withProperty('__size').gt(1).select();
//var b = m.withProperty('__class').like('part').withProperty('__class').like('asm').select();
//var b = m.withProperty('__class').select();
console.log(n);
//var n = m.withAncestor(b).select();
//console.log(n); //.get('name'));

//var n = m.atPath('/36/2/28').get(); 
var n = m.atPath('/71').box(); //get('name');
var n = m.atPath('/71').anchor('ccc'); //get('name');
var n = m.atPath('/71').locn(); //get('name');
//var n = m.distanceFrom(0,0,0).lt(0.0666).select();
//var n = m.withProperty('name').like('keeper').distanceFrom(0,0,0).lt(0.34).select();
//console.log(n);
//console.log(n[0].value.max);
//console.log(n.length);

// SG
// pvi2json v1
//
var fs  = require('fs');
var x2j = require('xml2js');

var cmps = new Array();
var all  = new Object();
all.sequences = [];

function getv(r,n) {
   if (r === undefined) return undefined; 
   var rval = undefined;
   // assumes an object/array of properties of the form $ { type, name, value }
   r.forEach(function(p) {
       if (p.$.name === n) {
          rval = (p.$.value != undefined) ? p.$.value : p._;
       }
   });
   return rval;
}

function processSymbols(step,tags) {
    
    var used = undefined;
    
    // we need to look through the various shapeInstance references to see if 
    // symbols are referenced anywhere
    var silp = step['galaxy_3di:step_shapeInstanceLocationPair'];
    if (silp != undefined) silp.forEach(function(i) {
        var idref  = getv(i['galaxy_3di:property'],'step_shapeInstanceEbom');
        var sidref = idref!= undefined ? idref.split('/')[1] : undefined;                                 
        if (tags[sidref] != undefined) { 
            if (used === undefined) used = {};
            used[sidref] = tags[sidref];
        }
    });
        
    var sivp = step['galaxy_3di:step_shapeInstanceVisibilityPair'];
    if (sivp != undefined) sivp.forEach(function(i) {
        var idref  = getv(i['galaxy_3di:property'],'step_shapeInstanceEbom');
        var sidref = idref!= undefined ? idref.split('/')[1] : undefined;                                 
        if (tags[sidref] != undefined) { 
            if (used === undefined) used = {};
            used[sidref] = tags[sidref];
        }
    });
        
    return used;
}

function showTags(used) {
    var notes = [];
    // this is an array
    for(var n in used) {
        notes.push(used[n]);
    };
    return notes;
}

function processAnim(data,fn) {
  var parser = new x2j.Parser();
  //console.log(data);  
  parser.parseString(data, function (err, result) {
    var kmin=0;
    var kmax=0;
    var heroes={};
    var annots={};
    
    var ts = result.pvm.timeline[0].$.timescale;
    // we need to run through all the containers, wihch can contain 
    // containers or item tracks, and find all the time keys
    result.pvm.timeline[0].containertrack.forEach(function(t) {
      if (t.containertrack != undefined)                                            
      t.containertrack.forEach(function(c) {
        if (c.itemtrack!=undefined)                       
        c.itemtrack.forEach(function(i) {
          if (i.selectionitem != undefined) {
            var item = i.selectionitem[0].$; 
            if (item.sbomIdPath != undefined) heroes[item.sbomIdPath] = item;                  
            if (item.annotation != undefined) annots[item.annotation] = item;
          }
          i.propertytrack.forEach(function(p) {
            if (p.key != undefined) p.key.forEach(function(k) {
              var kt=parseInt(k.$.time);
              if (kt < kmin) kmin = kt;
              if (kt > kmax) kmax = kt;
            });
          });
        });
      });
      if (t.itemtrack != undefined) t.itemtrack.forEach(function(i) {
        //console.log(i.$);                                         
        if (i.selectionitem != undefined) {
          var item = i.selectionitem[0].$; 
          if (item.sbomIdPath != undefined) heroes[item.sbomIdPath] = item;                  
          if (item.annotation != undefined) annots[item.annotation] = item;
        }
        i.propertytrack.forEach(function(p) {
          if (p.key != undefined) p.key.forEach(function(k) {
            var kt=parseInt(k.$.time);
            if (kt < kmin) kmin = kt;
            if (kt > kmax) kmax = kt;
          });
        });
      });
    });

    // assume for now its in ms
    if (fn != undefined) 
      fn(kmin/1000,kmax/1000,heroes,annots);
  });
}

function convert(pvi,filename) {
    var fig = pvi['galaxy_3di:figure'];
    if (fig === undefined) return false;
    //console.log(fig);
    var seq = fig['galaxy_3di:sequence'];
    //if (seq === undefined) return false; // true
    
    var nseq = { src:filename };
    
    var annots = fig['galaxy_3di:annotations'];
    var tags   = {};
    //console.log('annots',annots);
    if (annots.length > 0) {
        
        var symbols = annots[0]['galaxy_3di:symbol3d'];
        if (symbols != undefined) {
            nseq.tools = [];
            symbols.forEach(function(a) {
//                console.log(a);            
                if (a['galaxy_3di:sequencerTag'] != undefined) {
                    var tagid   = getv(a['galaxy_3di:property'],'ID');
                    tags[tagid] = getv(a['galaxy_3di:sequencerTag'][0]['galaxy_3di:property'],'sequencerTagDescription');
                    nseq.tools.push( 
                                  { 
                                      name       : getv(a['galaxy_3di:property'],'title'),
                                      description: getv(a['galaxy_3di:property'],'description'),
                                  } );
                } else {
                    nseq.tools.push( 
                                  { 
                                      name       : getv(a['galaxy_3di:property'],'title'),
                                      description: getv(a['galaxy_3di:property'],'description'),
                                  } );
                }
            });
        } else console.log('there are no 3d symbols');
    }
    //console.log(tags);
    
    // what if there are no sequences?
    if (seq != undefined) {
    // TODO : this can crash if there are no seqeunces
    var stepcount = parseInt(getv(seq[0]['galaxy_3di:property'], 'stepcount'));
    var stepcount = seq[0]['galaxy_3di:sequence_step'].length;
    console.log('there are '+stepcount+' steps');
    if (stepcount > 0) 
      nseq.steps = [];
      
    for (var sc = 0; sc < stepcount; sc++) {
      var step = seq[0]['galaxy_3di:sequence_step'][sc];
      //console.log('step',step);  
      var used = processSymbols(step,tags);
      if (used != undefined) console.log('symbols used',used); 
      
      if (sc > 0 && used != undefined) {
          
        // how do we find the timeline?
        if (step['galaxy_3di:animation::Timeline'] != undefined) {
          console.log('reading timeline');
          var encodedAnim = step['galaxy_3di:animation::Timeline'][0]['galaxy_3di:property'];
          processAnim(decodeURI(encodedAnim[0].$.value),function(kmin,kmax,heroes,annots) {
                      
            nseq.steps.push( { 
                name        : getv(step['galaxy_3di:property'],'step_name'),
                heroes      : heroes,            
                annotations : annots,
                ack         : getv(step['galaxy_3di:property'],'step_acknowledge'),
                duration    : kmax - kmin, //parseFloat(getv(step['galaxy_3di:property'],'step_duration')),
                description : getv(step['galaxy_3di:property'],'step_description'),
                notes       : showTags(used)
            });
          });
        } else {
          nseq.steps.push( { 
                name        : getv(step['galaxy_3di:property'],'step_name'),
                heroes      : undefined,            
                ack         : getv(step['galaxy_3di:property'],'step_acknowledge'),
                duration    : parseFloat(getv(step['galaxy_3di:property'],'step_duration')),
                description : getv(step['galaxy_3di:property'],'step_description'),
                notes       : showTags(used)
          });
        }
          
      } else if (sc > 0) {
                
        // how do we find the timeline?
        if (step['galaxy_3di:animation::Timeline'] != undefined) {
          var encodedAnim = step['galaxy_3di:animation::Timeline'][0]['galaxy_3di:property'];
          processAnim(decodeURI(encodedAnim[0].$.value),function(kmin,kmax,heroes,annots) {
                
            nseq.steps.push( { 
                name        : getv(step['galaxy_3di:property'],'step_name'),
                heroes      : heroes,            
                annotations : annots,
                ack         : getv(step['galaxy_3di:property'],'step_acknowledge'),
                duration    : kmax - kmin, //parseFloat(getv(step['galaxy_3di:property'],'step_duration')),
                description : getv(step['galaxy_3di:property'],'step_description')
            });
          });
        } else {
          nseq.steps.push( { 
                name        : getv(step['galaxy_3di:property'],'step_name'),
                ack         : getv(step['galaxy_3di:property'],'step_acknowledge'),
                duration    : parseFloat(getv(step['galaxy_3di:property'],'step_duration')),
                description : getv(step['galaxy_3di:property'],'step_description')
          });

        }
      } else {
        /* we dont show step 0, but we do use its title as the name for ths sequence
        */
        nseq.name = getv(step['galaxy_3di:property'],'step_name');
      }
    }
    
    }
    
    // finally, is there an itemlist?
    var items = fig['galaxy_3di:itemslist'];
    //console.log(items);
    if (items != undefined) {
        var _items = { cols:[], items:[] };
        
        var cols = items[0]['galaxy_3di:columns'];
        cols[0]['galaxy_3di:column'].forEach(function(col) {
          _items.cols.push( getv(col['galaxy_3di:property'],'property'));
        });
            
        // this is an array
        var itemlist = items[0]['galaxy_3di:item'];
        if (itemlist != undefined) itemlist.forEach(function(item) {
                         
          var _item = {};
          _items.cols.forEach(function(col) {
            switch (col) {
              case 'ITEM_SORT_ORDER':
                _item[col] = getv(item['galaxy_3di:property'],'index');
                break;
              case 'ITEM_INDEX':
                _item[col] = getv(item['galaxy_3di:property'],'label');
                break;
              case 'ITEM_NAME':
                _item[col] = getv(item['galaxy_3di:property'],'item_tag');
                break;
              case 'ITEM_COUNT':
                _item[col] = item['galaxy_3di:property_array'][0].$.count;
                _item['ITEM_PATHS'] = item['galaxy_3di:property_array'][0]['galaxy_3di:property'];
                break;
              default:
                break;  
            }
        });
        _items.items.push(_item);   
      });
      nseq.itemlist = _items.items.length > 0 ? _items : undefined;
    }
    
    all.sequences.push(nseq);
    
    
    return true;
}


function processPvi(fi,fn) {
  // fi = file in
  // var fi= process.argv[2];
  var parser = new x2j.Parser();
  fs.readFile(fi, function(err, data) {
    console.log('read file ok');
    parser.parseString(data, function (err, result) {
      var ok = convert(result,fi);
      if (ok === true && fn!=undefined) fn();
    });
  });
}

var counter = 0;
function readFile(filenames,rootfile) {
    var toProcess = new Array();
    filenames.forEach(function(filename) {
      if (rootfile != undefined && filename.startsWith(rootfile) && filename.endsWith('.pvi')) toProcess.push(filename);                
      else if (filename.endsWith('.pvi')) toProcess.push(filename);                
    });
    counter = toProcess.length;
    console.log('there are ' + counter + ' files to process');    

    for(var i=0; i < toProcess.length; i++) {
//        console.log(toProcess[i]);
        processPvi(toProcess[i], function() {
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
}
function readFiles(dirname, rootfile, onError) {
  fs.readdir(dirname, function(err, filenames) {
    if (err) {
      onError(err);
      return;
    }
    readFile(filenames,rootfile);
  });
}

var fi  = process.argv[2];
// if the user specifies a specific .pvi file, process that one file
if (fi != undefined && fi.endsWith(".pvi")) readFile([fi]);
// otherwise read the entire directory
else readFiles('.', fi);


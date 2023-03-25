// SG
// pvi2json v1
//
var fs  = require('fs');
var x2j = require('xml2js');

var all  = {};

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

function convert(pvi) {
  var figures = pvi['import3di']['figures'];
  if (figures === undefined) return false;
  
  if (figures.length > 0) {
        
    for (var sc = 0; sc < figures[0].figure.length; sc++) {
      var fig   = figures[0].figure[sc];
      var figid = fig.name[0];  
       
      // finally, is there an itemlist?
      var ilist = [];
      var slist = "";
      var items = fig['itemlist'];
      if (items[0].item != undefined) {
        for (var ic=0; ic < items[0].item.length; ic++) {
          var item = items[0].item[ic];
          ilist.push( { itm:item.itmlabel[0], name:item.itmtag[0], qty:item.itmgroup[0].$.qty, refitm:item.itmgroup[0].refitm.map(x => x.$.sbomidpath)});  
          for(var rc=0;rc<item.itmgroup[0].$.qty;rc++) {
            slist = slist + (slist.length>0?",":"") + item.itmgroup[0].refitm[rc].$.sbomidpath;
          }
        }
      }
      if (slist.length > 0) 
      all[figid] = ilist; //slist;
      
    }
  }
  return true;
}

function processPvi(fi,fn) {
  // fi = file in
  // var fi= process.argv[2];
  var parser = new x2j.Parser();
  fs.readFile(fi, function(err, data) {
    console.log('read file ok');
    parser.parseString(data, function (err, result) {
      var ok = convert(result);
      if (ok === true && fn!=undefined) fn();
    });
  });
}

var counter = 1;
function readFile(filename) {
    
    processPvi(filename, function() {
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
if (fi != undefined) readFile(fi);


// SG
// ol2json v1
//
var fs = require('fs');
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


function readBlock(inp,block) {
  var remainder = inp;
  //console.log('+'+remainder);
  var eidx = remainder.indexOf('}');
  var content = "";
  block.content = [];
  while(eidx>0) {
      
    // a block is defined as "name (optional id) { content }"
    // blocks can be recursive i.e. blocks can contain blocks
    var sidx = remainder.indexOf(' ');
    var name = remainder.substring(0,sidx);
    //console.log('name='+name);
    var remainder = remainder.substring(sidx+1);
    //console.log('>'+remainder);
    var optid = remainder.indexOf('(') === 0;
    if (optid === true) {
      var oidx = remainder.indexOf(')');
      optid = remainder.substring(1,oidx);
      //console.log(' ('+optid+')');
      remainder = remainder.substring(oidx+2);
    } else {
      optid="";
    }
      
    // next char could be {
    var bidx = remainder.indexOf('{');
    eidx = remainder.indexOf('}');
    
    //console.log(bidx+' '+eidx+' '+block.content);
    if (bidx===0) {
      var nblk = {name:name, id:optid}
      block.content.push(nblk);  
      remainder = readBlock(remainder.substring(bidx+2),nblk);
//      remainder = rblk.str;
    }
    else {
      if (eidx<bidx || bidx===-1) {
        content = content + name.replace(/"/g,'');
      }
    }
     
    eidx = remainder.indexOf('}');
  }
  //console.log('end of '+block.name + '('+content+')');
  //block.str = remainder.substring(eidx+2); // rest of string to process 
  if (content != "") block.content.push(content);
  return remainder.substring(eidx+2);
}


var olf = {};
function processBlocks(blk) {
    var mats={};
    var texs={};
    var apps={};
    function findBlk(bk,bnm) {
        if (bk === undefined) return undefined;
        for (var j=0;j<bk.length;j++) {
          if (bk[j].name === bnm) {
              //console.log(bk[j].content[0]);
              return bk[j].content;
          }
      }
      return undefined;
    }
    function find(bk,bnm) {
        if (bk === undefined) return undefined;
        for (var j=0;j<bk.length;j++) {
          if (bk[j].name === bnm) {
              //console.log(bk[j].content[0]);
              return bk[j].content[0];
          }
      }
      return undefined;
    }
    function buildMaterial(bk) {
        var mc = mats[bk];
        if (mc === undefined) return mc;
        var mat = {};
        for(var k=0;k<mc.length;k++)
          mat[mc[k].name] = mc[k].content[0];
        return mat;
    }
    function buildTexture(bk) {
        var mc = texs[bk];
        if (mc === undefined) return mc;
        var mat = {};
        for(var k=0;k<mc.length;k++)
          mat[mc[k].name] = mc[k].content[0];
        return mat;
    }
    function buildAppearance(bk) {
        var app = {};
        app.material           = buildMaterial(find(bk,'material')          );
        app.diffuseTexture     = buildTexture (find(bk,'diffuseTexture')    );
        app.diffuseModulate    = buildTexture (find(bk,'diffuseModulate')   );
        app.opacityTexture     = buildTexture (find(bk,'opacityTexture')    );
        app.environmentTexture = buildTexture (find(bk,'environmentTexture'));
        app.bumpTexture        = buildTexture (find(bk,'bumpTexture')       );
        return app;
    }
    function buildFace(pblk) {
        var vcnt=find(pblk,'vertexCount');
        var mref=find(findBlk(findBlk(pblk,'lod'),'mesh'),'appearance');
        
        var props = {};
        var anm  = apps[mref];
        if (anm != undefined)
            props.appearance = apps[mref].name;
             
        props.vertices = vcnt;  
          
        olf.faces.push({properties:props});
    }
    // run over the structure and find all the useful data ; repackage it in olf
    // main features of ol file are body (bbox), shape section (poly), 
    // geom section, attr section
    
    // lets get some basic attribute values, e.g. version number
    var v = findBlk(blk.content[0].content,'version');
    olf.version = { major: find(v,'majorVersion'),
                    minor: find(v,'minorVersion') };
                
    //find the 'body' block (bbox)            
    var b    = findBlk(blk.content[1].content,'body');
    olf.bbox = find(b,'boundingBox');
    
    // find the appearance block - typically the body)
    olf.appearances = {};
    for(var i=1;i<blk.content[1].content.length;i++) {
        var tblk = blk.content[1].content[i];
        //console.log(tblk.name);
        switch (tblk.name) {
            case 'material':
              mats[tblk.id] = tblk.content;
              break;
            case 'texture':
              texs[tblk.id] = tblk.content;
              break;
            case 'appearance':
              var anm = find(tblk.content,'name');
              var aid = tblk.id;
              console.log('material['+aid+']='+anm);
              apps[aid] = {name:anm, mat:buildAppearance(tblk.content)};  
              olf.appearances[anm] = apps[aid].mat;
              break;
            default:
            break;
        }
    }
    
    //are the faces defined in the body (typical single representation, flattened, no analytic etc.)?
    olf.faces = [];
    var faces = findBlk(b,'polyform');    
    if (faces != undefined) {
        buildFace(faces);
    }
    else {    
        // now get the main geom block (with faces that USE materials, and attributes)
        for(var i=0;i<blk.content[2].content.length;i++) {
            var tblk = blk.content[2].content[i];
            if (tblk.name === 'region') {
                var sblk = findBlk(tblk.content,'shell');
                for (var j=0;j<sblk.length;j++) {
                    if(sblk[j].name === 'face') {
                        var pblk = findBlk(sblk[j].content,'polyform');
                        buildFace(pblk);
                  }
                }
            }
        }
    }
    return olf;
};

// fi = file in
var fi= process.argv[2];
fs.readFile(fi, {encoding: 'utf-8'}, function(err, data) {
    console.log('read file ok');
    // remove all tabs, spaces, newlines
    var result = data.replace(/\n/g,' ').replace(/    /g,' ').replace(/   /g,' ').replace(/  /g,' ').replace(/\t/g,' ');
    result     = result.replace(/   /g,' ').replace(/  /g,' ').replace(/\t/g,' ');
    //console.log(result);
    
    // skip header
    var result = result.substring(result.indexOf(' ')+1);
    var fblk = {name:'file'};
    var ol = readBlock(result,fblk);
    //console.log(JSON.stringify(fblk));
    var all = processBlocks(fblk);
    var fo  = process.argv[3];
    if (fo === undefined)
        console.log(JSON.stringify(all));
    else
        fs.writeFile(fo, JSON.stringify(all,null,'\t'), function(err){
    		if (err) throw err;
      		console.log('Done!');
        })
});
    

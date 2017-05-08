//modules
var fs = require('fs');
var path = require('path');
var mc = require('./mc');
var walk = require('./walk').walk;

//common
var inFile=name=>new Promise((done, fail) => fs.readFile( name, 'utf8', (err, data) => err ? fail( err ) : done( data ) ) )
var outFile=name=>text=>new Promise((done,ex)=>fs.writeFile(name,text,err=>err?ex(err):done(text)))
var toJson=a=>JSON.stringify(a,null,2);
var parseJson=a=>JSON.parse(a);
var text2array=text=>text.split(/\r\n?|\n/);
var array2text=(a,text)=>(text='',a.forEach(i=>text+=i+'\n'),text.slice(0,-1));

Object.prototype.filter = function( predicate, obj ) {
    var result = {};
    obj = obj || this
    for (var key in obj) {
        if (obj.hasOwnProperty(key) && predicate(obj[key],key)) {
            result[key] = obj[key];
        }
    }
    return result;
};


//begin

var extendFrom=name=>ch=>inFile(name).then(text2array).then(l=>(ch.forEach(i=>l[i.id]=mc.build(i)),l))

var stripConf=a=>a.map(i=>{
  var obj = { name: i.name };
  if ( i.number != undefined )
    obj.number = i.number;
  ( i.changed || {} ).filter((val,name)=>{
      if ( val )
        obj[name] =  i[name];
  });
  return obj;
});

var outText=a=>{
  var text='';
  a.forEach(i=>text+=(i.disabled&&'//'||'')+i.name+(i.value?' '+i.value:'')+'\n')
  return text;
}

var remap=a=>{
  var objs={};
  a.forEach(i=>(objs[i.name]=objs[i.name]||[]).push(i))
  return objs;
}
var addNumber=a=>{
  var map=remap(a);
  var numbers={};
  return a.map(i=>{
    return map[i.name].length==1?i:(numbers[i.name]=numbers[i.name]||0,i.number=numbers[i.name]++,i)
  })
}

var setConfig=(target,file)=>a=>{
  var map=remap(a);
  return target.then(t=>{
    var undef=[];
    var res=t.map(i=>{
      var o=map[i.name];
      if (!o){
        undef.push(i.line);
        return;
      }
      var o=o[Math.min(i.number||0,o.length-1)];
      if (o){
        var changed={};
        if ( changed.disabled = o.disabled != i.disabled )
          o.disabled = i.disabled;
        if ( i.value  != undefined || o.value  != undefined )
          if ( changed.value = (o.value || '').trim() != (i.value || '').trim() )
            o.value = i.value;
        if ( i.comment != undefined || o.comment != undefined )
          if ( changed.comment = ( o.comment || '' ).trim() != ( i.comment || '' ).trim() )
            o.comment = i.comment;
        if ( changed.disabled || changed.value || changed.comment )
          o.changed=changed;
      }
      return o;
    }).filter(i=>i)
    if (undef.length&&file){
        console.log('undefined for:',file);
        var p=path.parse(file);
        Promise
        .resolve(array2text(undef))
        .then(outFile(path.join(p.dir,p.name+'.not')))
//        .then(a=>console.log('saved'))
    }
    return res;
  })
}

var remapNum=a=>{
  var objs={};
  a.forEach(i=>(objs[i.name]=objs[i.name]||[])[i.number||0]=i)
  return objs;
}
var loadConfig=a=>target=>{
//  var map=remap(a);
  return a.then((cfg,map)=>(map=remapNum(cfg),target.map(i=>{
      var o=map[i.name];
      if( o && ( o = o[i.number||0] ) ) {
        i.changed = {};
        ['disabled','value','comment','number']
          .map(f=>i.changed[f] = o[f] != undefined ? ( i[f] = o[f] ) : 0 );
      }
      return i;
    })
  ))
}
var onlyChanged=a=>a.filter(i=>i.changed);



var makeJson=file=>{
    var p=path.parse(file);
    var conf = inFile(file).then(mc.h2json);
    return inFile(path.join('./Marlin',p.base))
    .then(mc.h2json)
    .then(addNumber)
    .then(setConfig(conf.then(addNumber),file))
    .then(onlyChanged)
//    .then(addNumber)
    .then(stripConf)
    .then(toJson)
    .then(outFile(path.join(p.dir,p.name+'.json')))
    .then(a=>console.log('done json: ',file))
    .catch(a=>console.log('fail json: ',file,a))
}


var makeH=file=>{
    var p=path.parse(file);
    var baseName=path.join('./Marlin',p.name+'.h');
    return inFile(baseName)
    .then(mc.h2json)
    .then(addNumber)
    .then(loadConfig(inFile(file).then(parseJson)))
    .then(onlyChanged)
    .then(extendFrom(baseName))
    .then(array2text)
    .then(outFile(path.join(p.dir,p.name+'.h')))
    .then(a=>console.log('done h: ',file))
    .catch(a=>console.log('fail h: ',file,a))
}

var doJson=a=>
walk('./Marlin/example_configurations')
.then(f=>f.filter(a=>/Configuration(_adv)?\.h/.test(a)))
.then(f=>Promise.all(f.map(makeJson)))
.then(a=>(console.log('done ALL json'),a))

var doH=a=>
walk('./Marlin/example_configurations')
.then(f=>f.filter(a=>/Configuration(_adv)?\.json/.test(a)))
.then(f=>Promise.all(f.map(makeH)))
.then(a=>console.log('done ALL h'))

Promise.resolve()
.then(process.argv.indexOf('json')<0?1:doJson)
.then(process.argv.indexOf('h')<0?1:doH)



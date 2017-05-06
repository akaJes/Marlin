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

//begin

var extendFrom=name=>ch=>inFile(name).then(text2array).then(l=>(ch.forEach(i=>l[i.id]=mc.build(i)),l))

var outLength=a=>(console.log(a.length),a);
var outObject=a=>(console.log(a),a);
var getEnabled=a=>a.filter(i=>!i.disabled)
var outNames=a=>(a.forEach(i=>console.log(i.name,i.value||'')),a)
var filter=name=>a=>a.filter(i=>name==i.name)

var stripConf=a=>a.map(i=>{
  var obj={name:i.name}
  if ( i.number != undefined )
    obj.number = i.number
  if ( i.changed ) {
    if ( i.changed.enable )
      obj.disabled =  i.disabled;
    if ( i.changed.value )
      obj.value =  i.value;
    if ( i.changed.comment )
      obj.comment =  i.comment;
  }
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
// console.log(file)
  var map=remap(a);
  return target.then(t=>{
    var undef=[];
    var res=t.map(i=>{
      if (!map[i.name]){
        undef.push(i.line);
        return;
      }
      var num=i.number&&i.number<map[i.name].length?i.number:0,o=map[i.name][num];
//      if (num) console.log(i.name)
      if (o){
        var changed={};
        if ( changed.enable = o.disabled != i.disabled )
          o.disabled = i.disabled;
        if ( i.value  != undefined || o.value  != undefined )
          if ( changed.value = (o.value||'').trim() != (i.value||'').trim() )
            o.value = i.value;
        if ( i.comment != undefined || o.comment != undefined )
          if ( changed.comment = ( o.comment || '' ).trim() != ( i.comment || '' ).trim() )
            o.value=i.value;
        if ( changed.enable || changed.value || changed.comment ){
          o.changed=changed;
        }
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

var extendBase=target=>a=>{ //obsolete
  var map=remap(a);
  return target.then(t=>t.map(i=>{
      if (map[i.name]){
        var num=i.number&&i.number<map[i.name].length?i.number:0,o=map[i.name][num];
//        if (num) console.log(i.name)
        if (o.disabled != undefined)
          i.disabled=o.disabled;
        if (o.value != undefined)
          i.value=o.value;
        if (o.comment != undefined)
          i.comment=o.comment;
        if (o.nubmer != undefined)
          i.nubmer = o.nubmer
      }
      return i;
    })
  )
}
var remapNum=a=>{
  var objs={};
  a.forEach(i=>(objs[i.name]=objs[i.name]||[])[i.number||0]=i)
  return objs;
}
var loadConfig=a=>target=>{
//  var map=remap(a);
  return a.then((cfg,map)=>(map=remapNum(cfg),target.map(i=>{
      var o=map[i.name]
      if (o){
        var o=o[i.number||0]||o[o.length-1];
        if (o){
          var changed={};
          if (changed.enable = o.disabled != undefined)
            i.disabled=o.disabled;
          if (changed.value = o.value != undefined)
            i.value=o.value;
          if (changed.comment = o.comment != undefined)
            i.comment=o.comment;
          if (o.nubmer != undefined)
            i.nubmer = o.nubmer
          i.changed=changed;
        }
      }
      return i;
    })
  ))
}

var onlyChanged=a=>a.filter(i=>i.changed);

Object.prototype.filter = function( predicate, obj ) {
    var result = {};
    obj = obj || this
    for (var key in obj) {
        if (obj.hasOwnProperty(key) && predicate(obj[key])) {
            result[key] = obj[key];
        }
    }
    return result;
};


if(1)
walk('./Marlin/example_configurations').then(function(result){
//console.log(result);
  result=result.filter(a=>/Configuration(_adv)?\.h/.test(a))
  var all=[];
  result
  //.splice(0,1)
  .forEach(function(file){
    var p=path.parse(file);
    var conf = inFile(file).then(mc.h2json);
    var base = inFile(path.join('./Marlin',p.base)).then(mc.h2json);
    var over=base
    .then(setConfig(conf.then(addNumber),file))
    .then(onlyChanged)
    .then(addNumber)
    .then(stripConf)
    .then(toJson)
    .then(outFile(path.join(p.dir,p.name+'.json')))
    .then(a=>console.log('done: ',file))
    .catch(a=>console.log('fail: ',file,a))
    all.push(over);
  })
  return Promise.all(all);
})
.then(a=>console.log('done ALL json'))
.then(ob=>walk('./Marlin/example_configurations')).then(function(result){
  var all=[];
  result=result.filter(a=>/Configuration(_adv)?\.json/.test(a))
  result
//  .splice(0,1)
  .forEach(function(file){
    var p=path.parse(file);
//    var base = inFile(baseName).then(mc.h2json);
    var baseName=path.join('./Marlin',p.name+'.h');
    var base = inFile(baseName).then(mc.h2json);
    var over = base
    .then(addNumber)
    .then(loadConfig(inFile(file).then(parseJson)))
    .then(onlyChanged)
    .then(extendFrom(baseName))
    .then(array2text)
    .then(outFile(path.join(p.dir,p.name+'.h')))
    .then(a=>console.log('done: ',file))
    .catch(a=>console.log('fail: ',file,a))
    all.push(over);
  })
  return Promise.all(all);
})
.then(a=>console.log('done ALL'))




//vars

if(0){
var suff = '';//'_adv';
var baseName='./Marlin/Configuration'+suff+'.h';
var testName='./Marlin/example_configurations/Cartesio/Configuration'+suff+'.h';

var base = inFile(baseName).then(mc.h2json);
var test = inFile(testName).then(mc.h2json);
//var extendFrom=name=>ch=>h2array(name).then(l=>(ch.forEach(i=>l[i.id]=mc.build(i)),l))
base
.then(outLength)
//.then(getEnabled)
//.then(outLength)
.then(addNumber)
.then(remap)
.then(o=>o.filter(i=>i.length>1))
.then(c=>(console.log(c),c))
//.then(outNames);

var prep=
base
.then(setConfig(test.then(addNumber)))
.then(onlyChanged)

prep
.then(stripConf)
.then(toJson)
.then(outFile('base-test.json'))

var base = inFile(baseName).then(mc.h2json);

inFile('base-test.json')
.then(parseJson)
.then(extendBase(base.then(addNumber)))

.then(extendFrom(baseName))
.then(array2text)
.then(outFile('base-test-r.h'))

var base = inFile(baseName).then(mc.h2json);
base
.then(addNumber)
.then(loadConfig(inFile('base-test.json').then(parseJson)))
.then(onlyChanged)

.then(extendFrom(baseName))
.then(array2text)
.then(outFile('base-test-r2.h'))


prep
.then(extendFrom(baseName))
.then(array2text)
.then(outFile('base-test.h'))

prep
.then(outText)
.then(outFile('base-test'))

base
//.then(getEnabled)
//.then(filter('MAX_MEASUREMENT_DELAY'))
//.then(outObject)
.then(outText)
//.then(c=>(console.log(c),c))
.then(outFile('base'))

test
//.then(getEnabled)
.then(outText)
.then(outFile('test'))
//.then(outFileOld('testo'))
}

/*

//var base = h2json(baseName);
//var test = h2json(testName);
function h2json(file){
  return new Promise(function(done,ex){
    fs.readFile(file,'utf8',function(err, data){
      if ( err ) return ex( err )
      mc.h2json(data).then(done).catch(ex);
    })
  })
}
function h2array(file){
  return new Promise(function(done,ex){
    fs.readFile(file,'utf8',function(err, data){
      if ( err ) ex( err )
//      var lines=data.match(/[^\r\n]+/g)
      var lines=data.split(/\r\n?|\n/);
      done(lines);
    })
  })
}
function file2json(file){
  return new Promise(function(done,ex){
    fs.readFile(file,'utf8',function(err, data){
      if ( err ) ex( err )
      done( JSON.parse(data) )
    })
  })
}

var outFileOld=function(name){
  return function(text){
    return new Promise(function(done,ex){
      return fs.writeFile(name,text,function(err){
        return err?ex(err):done(text)
      })
    })
  }
}
*/
/*
var array2text=a=>{
  var text='';
  a.forEach(i=>text+=i+'\n')
  return text;
}*/


import './style.css';

import $ from 'jquery';        //make jquery() available as $
import Meta from './meta.js';  //bundle the input to this program

//default values
const DEFAULT_REF = '_';       //use this if no ref query param
const N_UNI_SELECT = 4;        //switching threshold between radio & select
const N_MULTI_SELECT = 4;      //switching threshold between checkbox & select

/*************************** Utility Routines **************************/

/** Return `ref` query parameter from window.location */
function getRef() {
  const url = new URL(window.location);
  const params = url.searchParams;
  return params && params.get('ref');
}

/** Return window.location url with `ref` query parameter set to `ref` */
function makeRefUrl(ref) {
  const url = new URL(window.location);
  url.searchParams.set('ref', ref);
  return url.toString();
}

/** Return a jquery-wrapped element for tag and attr */
function makeElement(tag, attr={}) {
  const $e = $(`<${tag}/>`);
  Object.entries(attr).forEach(([k, v]) => $e.attr(k, v));
  return $e;
}

/** Given a list path of accessors, return Meta[path].  Handle
 *  occurrences of '.' and '..' within path.
 */
function access(path) {
  const normalized = path.reduce((acc, p) => {
    if (p === '.') {
      return acc;
    }
    else if (p === '..') {
      return acc.length === 0 ? acc : acc.slice(0, -1)
    }
    else {
      return acc.concat(p);
    }
  }, []);
  return normalized.reduce((m, p) => m[p], Meta);
}

/** Return an id constructed from list path */
function makeId(path) { return ('/' + path.join('/')); }

function getType(meta) {
  return meta.type || 'block';
}

/** Return a jquery-wrapped element <tag meta.attr>items</tag>
 *  where items are the recursive rendering of meta.items.
 *  The returned element is also appended to $element.
 */
function items(tag, meta, path, $element) {
  const $e = makeElement(tag, meta.attr);
  (meta.items || []).
    forEach((item, i) => render(path.concat('items', i), $e));
  $element.append($e);
  return $e;
}

/************************** Event Handlers *****************************/
function optionstag(meta,i){
  const $opt = makeElement("option",{"value" : meta.items[i].key}).text(meta.items[i].text)
  return $opt

}
//@TODO

/********************** Type Routine Common Handling *******************/

//@TODO


/***************************** Type Routines ***************************/

//A type handling function has the signature (meta, path, $element) =>
//void.  It will append the HTML corresponding to meta (which is
//Meta[path]) to $element.

function block(meta, path, $element) { items('div', meta, path, $element); }

function form(meta, path, $element) {
  const $form = items('form', meta, path, $element);
  $form.submit(function(event) {
    event.preventDefault();
    const $form = $(this);
    //@TODO
    const results = $form.serializeArray();
    let rslt = {};
    let i=0;
    while(i<results.length){
      var aa = $('[name='+results[i].name+']', $form);
      if($(aa).attr("multiple") || $(aa).attr("type") !== "checkbox") {
        rslt[results[i].name] = results[i].value;
      } else {
        if(!rslt[results[i].name]) {
            rslt[results[i].name].push(results[i].value);
            rslt[results[i].name] = [results[i].value];
           } else {
             rslt[results[i].name] = [results[i].value];
             rslt[results[i].name].push(results[i].value);
           }
      }
      i++;
    }
    console.log(JSON.stringify(rslt, null, 2));
  });
}

function header(meta, path, $element) {
  const $e = makeElement(`h${meta.level || 1}`, meta.attr);
  $e.text(meta.text || '');
  $element.append($e);
}

function input(meta, path, $element) {
  //@TODO
  //console.log(meta.attr)
  const id = makeId(path)
  var req;
  if(meta.required == true){
    req = meta.text+"*"
  }
  else{
    req = meta.text
  }
  const $label = makeElement("label",{for:id}).text(req)
  $element.append($label)
  const $div = makeElement("div",{})
  var typedef={}
  if(meta.subType === undefined){
    typedef["type"] = 'text'
  }
  else{
    typedef["type"] = meta.subType
  }
  
  Object.assign(meta.attr,{"id":id,type:typedef["type"]})
  const $inp = makeElement("input",meta.attr)
  
  
  const $diver = makeElement("div",{"class":"error","id":id+"-err"})
  $div.append($inp)
  $div.append($diver)
  $div.append($inp);
  if(meta.required){
    const $errorDiv = makeElement('div',{"class":"error","id":id+"-err"})
    $div.append($errorDiv);
    $inp.blur(function () {
      onBlurOfReqdInput(this,meta);
    });
  }

  $element.append($div)
}
  //$element.append($div)  


function onBlurOfReqdInput(ele,meta)
{
  if($(ele).val().trim())
  {
    $(ele).next().text("");
  }
  else
  {
    $(ele).next().text("The field"+meta.text+" must be specified.");
  }
}

function link(meta, path, $element) {
  const parentType = getType(access(path.concat('..')));
  const { text='', ref=DEFAULT_REF } = meta;
  const attr = Object.assign({}, meta.attr||{}, { href: makeRefUrl(ref) });
  $element.append(makeElement('a', attr).text(text));
}

function multiSelect(meta, path, $element) {
  //@TODO
   
  var id = makeId(path)
  var req;
  if(meta.required == true){
    req = meta.text+"*"
  }
  else{
    req = meta.text
  }
  
  const $label = makeElement("label",{for:id}).text(req)
  $element.append($label)
  const $div = makeElement("div",{})
  const $errorDiv = makeElement('div',{"class":"error","id":id+"-err"})
  console.log(meta.items.length)
  if (meta.items.length > (N_UNI_SELECT || 4)){
    Object.assign(meta.attr,{multiple:"multiple"})
    const $select = makeElement("select",meta.attr)
    let i=0
    while(i<meta.items.length){
      let $opt = optionstag(meta,i)
      $select.append($opt)
      i++
    }
    $div.append($select)
  } 
  else {
    const $classdiv = makeElement('div',{"class":"fieldset"})
    var atrrs = [];
    for(let i=0; i<meta.items.length; i++){

      atrrs["id"] = id+"-"+i
      atrrs["type"] = "checkbox"
      atrrs["values"] = meta.items[i].key
      Object.assign(meta.attr,atrrs)

      const $label = makeElement('label',{"for":id}).text(meta.items[i].key)
      const $checkbox = makeElement('input',meta.attr)
      $classdiv.append($label)
      $classdiv.append($checkbox)
    }
    
    $div.append($classdiv)
    $div.append($errorDiv)
  }
  $element.append($div)
  
}

function para(meta, path, $element) { items('p', meta, path, $element); }

function segment(meta, path, $element) {
  if (meta.text !== undefined) {
    $element.append(makeElement('span', meta.attr).text(meta.text));
  }
  else {
    items('span', meta, path, $element);
  }
}


function submit(meta, path, $element) {
  //@TODO
  const $div = makeElement("div",{})
  $element.append($div)

  let sub = Object.assign({},meta.attr,{type:"submit"})
  if(meta.text !==undefined) {
    var $button = makeElement("button",sub).text(meta.text)
  }
  else{
    var $button = makeElement("button",sub).text("submit")
  }

  //console.log(meta.text)
  $element.append($button)
  
}

function uniSelect(meta, path, $element) {
  //@TODO
  
  var id = makeId(path)
  var req;
  if(meta.required == true){
    req = meta.text+"*"
  }
  else{
    req = meta.text
  }
  
  const $label = makeElement("label",{for:id}).text(req)
  $element.append($label)
  const $div = makeElement("div",{})
   const $error_div = makeElement("div",{"class":"error","id":id+"-err"})
  console.log(meta.items.length)
  if (meta.items.length > (N_UNI_SELECT || 4)){
    const $select = makeElement("select",meta.attr)
    let i=0
    while(i<meta.items.length){
      let $opt = optionstag(meta,i)
      $select.append($opt)
      i++
    }
    $div.append($select)
    $div.append($error_div)
  } 
  else {
    const $classdiv = makeElement('div',{"class":"fieldset"})
    var atrrs = [];
    for(let i=0; i<meta.items.length; i++){

      atrrs["id"] = id+"-"+i
      atrrs["type"] = "radio"
      atrrs["values"] = meta.items[i].key
      Object.assign(meta.attr,atrrs)

      const $label = makeElement('label',{"for":id}).text(meta.items[i].key)
      const $radio_input = makeElement('input',meta.attr)
      $classdiv.append($label)
      $classdiv.append($radio_input)
    }
    $div.append($classdiv)
  }
  // const $select = makeElement("select",meta.attr)
  $element.append($div)
  

}


//map from type to type handling function.  
const FNS = {
  block,
  form,
  header,
  input,
  link,
  multiSelect,
  para,
  segment,
  submit,
  uniSelect,
  onBlurOfReqdInput,
};

/*************************** Top-Level Code ****************************/

function render(path, $element=$('body')) {
  const meta = access(path);
  if (!meta) {
    $element.append(`<p>Path ${makeId(path)} not found</p>`);
  }
  else {
    const type = getType(meta);
    const fn = FNS[type];
    if (fn) {
      fn(meta, path, $element);
    }
    else {
      $element.append(`<p>type ${type} not supported</p>`);
    }
  }
}

function go() {
  const ref = getRef() || DEFAULT_REF;
  render([ ref ]);
}

go();
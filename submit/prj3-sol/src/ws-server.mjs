import assert from 'assert';
//import cors from 'cors';
import express from 'express';
import bodyParser from 'body-parser';
import querystring from 'querystring';

import ModelError from './model-error.mjs';

//not all codes necessary
const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;

const BASE = 'api';

export default function serve(port, meta, model) {
  const app = express();
  app.locals.port = port;
  app.locals.meta = meta;
  app.locals.model = model;
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}

function setupRoutes(app) {
  //app.use(cors());

  //pseudo-handlers used to set up defaults for req
  app.use(bodyParser.json());      //always parse request bodies as JSON
  app.use(reqSelfUrl, reqBaseUrl); //set useful properties in req

  //application routes
  app.get(`/${BASE}`, doBase(app));
  //@TODO: add other application routes
  app.post(`/${BASE}/carts`,doCreate(app));
  app.patch(`/${BASE}/carts/:id`, doUpdate(app));
  app.get(`/${BASE}/books/:isbn`, doGet(app));
  app.get(`/${BASE}/carts/:id`, dogetCart(app));
  app.get(`/${BASE}/books`,doList(app));
  //must be last
  app.use(do404(app));
  app.use(doErrors(app));
}

/****************************** Handlers *******************************/

/** Sets selfUrl property on req to complete URL of req,
 *  including query parameters.
 */
function reqSelfUrl(req, res, next) {
  const port = req.app.locals.port;
  req.selfUrl = `${req.protocol}://${req.hostname}:${port}${req.originalUrl}`;
  next();  //absolutely essential
}

/** Sets baseUrl property on req to complete URL of BASE. */
function reqBaseUrl(req, res, next) {
  const port = req.app.locals.port;
  req.baseUrl = `${req.protocol}://${req.hostname}:${port}/${BASE}`;
  next(); //absolutely essential
}

function doBase(app) {
  return function(req, res) { 
    try {
      const links = [
        { rel: 'self', name: 'self', href: req.selfUrl,},
        //@TODO add links for book and cart collections
        { rel: 'collection', name: 'books', href: req.selfUrl+"/books",},
        { rel: 'collection', name: 'carts', href: req.selfUrl+"/carts",}
      ];
      res.json({ links });
    }
    catch (err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  };
}

//@TODO: Add handlers for other application routes

function doCreate(app){
  return errorWrap(async function(req, res) {
    try {
      const results = await app.locals.model.newCart({});
      res.append('Location', requestUrl(req) + '/'+ results);
      res.sendStatus(CREATED)
      res.end()
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

function doUpdate(app) {
  return errorWrap(async function(req, res) {
    try {
      const patch = Object.assign({}, req.body);
      patch.cartId = req.params.id;
      console.log(patch)
      const results = await app.locals.model.cartItem(patch);
      res.sendStatus(OK);
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

function doGet(app) {
  return errorWrap(async function(req, res) {
    try {
      const response_json = {links: [{ href: req.selfUrl, rel: 'self', name: 'self'}]};
      const isbn = req.params.isbn;
      const results = await app.locals.model.findBooks({ isbn: isbn });
      console.log(results.length )
      if (results.length === 0) {
        res.json( {
          "errors" : [
            {
              "code" : "BAD_ID",
              "message" : "no book for isbn "+isbn,
              "name" : "isbn"
            }
          ],
          "status" : 404
        });
      }
      else {
        response_json.results = results
        res.json(response_json);
      }
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}


function dogetCart(app) {
  return errorWrap(async function(req, res) {
    try {
      const response_json = {_lastModified:"",links: [{ href: req.selfUrl, rel: 'self', name: 'self'}],};
      const id = req.params.id;
      const results = await app.locals.model.getCart({ cartId: id });
      //console.log(results )
      if (results.length === 0) {
        res.json( {
          "errors" : [
            {
              "code" : "BAD_ID",
              "message" : "cart id not found "+id,
              "name" : "cartId"
            }
          ],
          "status" : 404
        });
      }
      else {

        response_json._lastModified = results._lastModified
        delete results._lastModified
        let out = []
        for (var key of Object.keys(results)) {

            let temp = { }
            temp["links"] = [ { rel: 'item', name: 'book',href: req.baseUrl+"/books/"+key} ]
            temp["sku"] = key;
            temp["nUnits"] = results[key]
            out.push(temp)
        }
        response_json.results = out

        res.json(response_json)
      }
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}


function doList(app) {
  return errorWrap(async function(req, res) {
    const response_json = {links: [{ href: req.selfUrl, rel: 'self', name: 'self'}],};
    const q = req.query || {};
    try {
      const count = Number(q["_count"] || 5);
      const index = Number(q["_index"] || 0);


      const param_query = Object.assign({},q,{_count: Number(count) + 1 })

      if(Object.keys(q).length === 0){
        res.json(
            {
              "errors" : [
                {
                  "code" : "FORM_ERROR",
                  "message" : "At least one search field must be specified.",
                  "name" : ""
                }
              ],
              "status" : 400
            }
        )
      }

      else{

        const temp = await app.locals.model.findBooks(param_query);

        const results = temp.slice(0,param_query._count -1) //remove last one in the array 0 to 4

        results.forEach(element => element["links"] = [{
          "href" : req.baseUrl+"/books/"+element["isbn"],
          "name" : "book",
          "rel" : "details"
        }]);
        response_json.results = results



        if(temp.length === param_query._count){
          let next_idx =  index + count;

          const next_param = querystring.stringify(Object.assign({}, q, { _index: next_idx }));
          const nextAPI = req.baseUrl+"/books?"+next_param
          response_json.links.push({  href: nextAPI, name: 'next',rel: 'next' });
        }
        if(q["_index"] > 0){
          console.log(q)
          let prev_idx = q["_index"] - count
          if(prev_idx < 0){
            prev_idx = 0
          }
          const prev_param = querystring.stringify(Object.assign({}, q, { _index: prev_idx }));
          const prevAPI = req.baseUrl+"/books?"+prev_param
          response_json.links.push({  href: prevAPI, name: 'prev' ,rel: 'prev'});
        }
        res.json(response_json);
      }
    }
    catch (err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}



/** Default handler for when there is no route for a particular method
 *  and path.
 */
function do404(app) {
  return async function(req, res) {
    const message = `${req.method} not supported for ${req.originalUrl}`;
    const result = {
      status: NOT_FOUND,
      errors: [	{ code: 'NOT_FOUND', message, }, ],
    };
    res.type('text').
	status(404).
	json(result);
  };
}


/** Ensures a server error results in nice JSON sent back to client
 *  with details logged on console.
 */ 
function doErrors(app) {
  return async function(err, req, res, next) {
    const result = {
      status: SERVER_ERROR,
      errors: [ { code: 'SERVER_ERROR', message: err.message } ],
    };
    res.status(SERVER_ERROR).json(result);
    console.error(err);
  };
}


/** Set up error handling for handler by wrapping it in a
 *  try-catch with chaining to error handler on error.
 */
function errorWrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    }
    catch (err) {
      next(err);
    }
  };
}

/*************************** Mapping Errors ****************************/

const ERROR_MAP = {
  BAD_ID: NOT_FOUND,
}

/** Map domain/internal errors into suitable HTTP errors.  Return'd
 *  object will have a "status" property corresponding to HTTP status
 *  code and an errors property containing list of error objects
 *  with code, message and name properties.
 */
function mapError(err) {
  const isDomainError =
    (err instanceof Array && err.length > 0 && err[0] instanceof ModelError);
  const status =
    isDomainError ? (ERROR_MAP[err[0].code] || BAD_REQUEST) : SERVER_ERROR;
  const errors =
	isDomainError
	? err.map(e => ({ code: e.code, message: e.message, name: e.name }))
        : [ { code: 'SERVER_ERROR', message: err.toString(), } ];
  if (!isDomainError) console.error(err);
  return { status, errors };
} 

/****************************** Utilities ******************************/

/** Return original URL for req */
function requestUrl(req) {
  const port = req.app.locals.port;
  return `${req.protocol}://${req.hostname}:${port}${req.originalUrl}`;
}

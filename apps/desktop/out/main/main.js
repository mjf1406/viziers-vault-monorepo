import { app, BrowserWindow } from "electron";
import path__default from "path";
import os from "os";
import s__default from "fs";
import net from "net";
import tls from "tls";
import crypto$1 from "crypto";
import Stream, { Readable } from "stream";
import { performance as performance$1 } from "perf_hooks";
import crypto$2 from "node:crypto";
import fs from "node:fs";
import { createServer } from "http";
import { Http2ServerRequest } from "http2";
var compose = (middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i2) {
      if (i2 <= index) {
        throw new Error("next() called multiple times");
      }
      index = i2;
      let res;
      let isError = false;
      let handler;
      if (middleware[i2]) {
        handler = middleware[i2][0][0];
        context.req.routeIndex = i2;
      } else {
        handler = i2 === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i2 + 1));
        } catch (err2) {
          if (err2 instanceof Error && onError) {
            context.error = err2;
            res = await onError(err2, context);
            isError = true;
          } else {
            throw err2;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
  };
};
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();
var parseBody = async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
};
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
var handleParsingAllValues = (form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
};
var handleParsingNestedValues = (form, key, value) => {
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
};
var splitPath = (path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
};
var splitRoutingPath = (routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
};
var extractGroupsFromPath = (path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
};
var replaceGroupMarks = (paths, groups) => {
  for (let i2 = groups.length - 1; i2 >= 0; i2--) {
    const [mark] = groups[i2];
    for (let j3 = paths.length - 1; j3 >= 0; j3--) {
      if (paths[j3].includes(mark)) {
        paths[j3] = paths[j3].replace(mark, groups[i2][1]);
        break;
      }
    }
  }
  return paths;
};
var patternCache = {};
var getPattern = (label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey2 = `${label}#${next}`;
    if (!patternCache[cacheKey2]) {
      if (match2[2]) {
        patternCache[cacheKey2] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey2, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey2] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey2];
  }
  return null;
};
var tryDecode = (str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
};
var tryDecodeURI = (str) => tryDecode(str, decodeURI);
var getPath = (request) => {
  const url = request.url;
  const start2 = url.indexOf("/", url.indexOf(":") + 4);
  let i2 = start2;
  for (; i2 < url.length; i2++) {
    const charCode = url.charCodeAt(i2);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i2);
      const hashIndex = url.indexOf("#", i2);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start2, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start2, i2);
};
var getPathNoStrict = (request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
};
var mergePath = (base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
};
var checkOptionalParameter = (path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v2, i2, a2) => a2.indexOf(v2) === i2);
};
var _decodeURI = (value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
};
var _getQueryParam = (url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name2 = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name2 = _decodeURI(name2);
    }
    keyIndex = nextKeyIndex;
    if (name2 === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name2] && Array.isArray(results[name2]))) {
        results[name2] = [];
      }
      results[name2].push(value);
    } else {
      results[name2] ??= value;
    }
  }
  return key ? results[key] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key) => {
  return _getQueryParam(url, key, true);
};
var decodeURIComponent_ = decodeURIComponent;
var tryDecodeURIComponent = (str) => tryDecode(str, decodeURIComponent_);
var HonoRequest = class {
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name2) {
    if (name2) {
      return this.raw.headers.get(name2) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return this.bodyCache.parsedBody ??= await parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body2) => {
        if (anyCachedKey === "json") {
          body2 = JSON.stringify(body2);
        }
        return new Response(body2)[key]();
      });
    }
    return bodyCache[key] = raw[key]();
  };
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text2) => JSON.parse(text2));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};
var HtmlEscapedCallbackPhase = {
  Stringify: 1
};
var resolveCallback = async (str, phase, preserveCallbacks, context, buffer2) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer2) {
    buffer2[0] += str;
  } else {
    buffer2 = [str];
  }
  const resStr = Promise.all(callbacks.map((c2) => c2({ phase, buffer: buffer2, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer2))
    ).then(() => buffer2[0])
  );
  {
    return resStr;
  }
};
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = (contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
};
var createResponseInstance = (body2, init2) => new Response(body2, init2);
var Context = class {
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k2, v2] of this.#res.headers.entries()) {
        if (k2 === "content-type") {
          continue;
        }
        if (k2 === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k2, v2);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = (...args2) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args2);
  };
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = (layout) => this.#layout = layout;
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = () => this.#layout;
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = (name2, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name2);
    } else if (options?.append) {
      headers.append(name2, value);
    } else {
      headers.set(name2, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k2, v2] of Object.entries(headers)) {
        if (typeof v2 === "string") {
          responseHeaders.set(k2, v2);
        } else {
          responseHeaders.delete(k2);
          for (const v22 of v2) {
            responseHeaders.append(k2, v22);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders });
  }
  newResponse = (...args2) => this.#newResponse(...args2);
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = (text2, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text2) : this.#newResponse(
      text2,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  };
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = (object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  };
  html = (html, arg, headers) => {
    const res = (html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = (location2, status) => {
    const locationString = String(location2);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  };
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = () => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  };
};
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
};
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";
var notFoundHandler = (c2) => {
  return c2.text("404 Not Found", 404);
};
var errorHandler = (err2, c2) => {
  if ("getResponse" in err2) {
    const res = err2.getResponse();
    return c2.newResponse(res.body, res);
  }
  console.error(err2);
  return c2.text("Internal Server Error", 500);
};
var Hono$1 = class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args2) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args2.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p2 of [path].flat()) {
        this.#path = p2;
        for (const m2 of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m2.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r2) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r2.handler;
      } else {
        handler = async (c2, next) => (await compose([], app2.errorHandler)(c2, () => r2.handler(c2, next))).res;
        handler[COMPOSED_HANDLER] = r2.handler;
      }
      subApp.#addRoute(r2.method, r2.path, handler);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = (request) => request;
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c2) => {
      const options2 = optionHandler(c2);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c2) => {
      let executionContext = void 0;
      try {
        executionContext = c2.executionCtx;
      } catch {
      }
      return [c2.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = async (c2, next) => {
      const res = await applicationHandler(replaceRequest(c2.req.raw), ...getOptions(c2));
      if (res) {
        return res;
      }
      await next();
    };
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r2 = { basePath: this._basePath, path, method, handler };
    this.router.add(method, path, [handler, r2]);
    this.routes.push(r2);
  }
  #handleError(err2, c2) {
    if (err2 instanceof Error) {
      return this.errorHandler(err2, c2);
    }
    throw err2;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c2 = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c2, async () => {
          c2.res = await this.#notFoundHandler(c2);
        });
      } catch (err2) {
        return this.#handleError(err2, c2);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c2.finalized ? c2.res : this.#notFoundHandler(c2))
      ).catch((err2) => this.#handleError(err2, c2)) : res ?? this.#notFoundHandler(c2);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c2);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err2) {
        return this.#handleError(err2, c2);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  };
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
};
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = (method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  };
  this.match = match2;
  return match2(method, path);
}
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a2, b2) {
  if (a2.length === 1) {
    return b2.length === 1 ? a2 < b2 ? -1 : 1 : -1;
  }
  if (b2.length === 1) {
    return 1;
  }
  if (a2 === ONLY_WILDCARD_REG_EXP_STR || a2 === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b2 === ONLY_WILDCARD_REG_EXP_STR || b2 === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a2 === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b2 === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a2.length === b2.length ? a2 < b2 ? -1 : 1 : b2.length - a2.length;
}
var Node$1 = class _Node {
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name2 = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name2 && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k2) => k2 !== ONLY_WILDCARD_REG_EXP_STR && k2 !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name2 !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name2 !== "") {
        paramMap.push([name2, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k2) => k2.length > 1 && k2 !== ONLY_WILDCARD_REG_EXP_STR && k2 !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k2) => {
      const c2 = this.#children[k2];
      return (typeof c2.#varIndex === "number" ? `(${k2})@${c2.#varIndex}` : regExpMetaChars.has(k2) ? `\\${k2}` : k2) + c2.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};
var Trie = class {
  #context = { varIndex: 0 };
  #root = new Node$1();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i2 = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m2) => {
        const mark = `@\\${i2}`;
        groups[i2] = [mark, m2];
        i2++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i2 = groups.length - 1; i2 >= 0; i2--) {
      const [mark] = groups[i2];
      for (let j3 = tokens.length - 1; j3 >= 0; j3--) {
        if (tokens[j3].indexOf(mark) !== -1) {
          tokens[j3] = tokens[j3].replace(mark, groups[i2][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_2, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_2, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i2 = 0, j3 = -1, len = routesWithStaticPathFlag.length; i2 < len; i2++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i2];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h2]) => [h2, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j3++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j3, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j3] = handlers.map(([h2, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h2, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i2 = 0, len = handlerData.length; i2 < len; i2++) {
    for (let j3 = 0, len2 = handlerData[i2].length; j3 < len2; j3++) {
      const map = handlerData[i2][j3]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k2 = 0, len3 = keys.length; k2 < len3; k2++) {
        map[keys[k2]] = paramReplacementMap[map[keys[k2]]];
      }
    }
  }
  const handlerMap = [];
  for (const i2 in indexReplacementMap) {
    handlerMap[i2] = handlerData[indexReplacementMap[i2]];
  }
  return [regexp, handlerMap, staticMap];
}
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k2 of Object.keys(middleware).sort((a2, b2) => b2.length - a2.length)) {
    if (buildWildcardRegExp(k2).test(path)) {
      return [...middleware[k2]];
    }
  }
  return void 0;
}
var RegExpRouter = class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p2) => {
          handlerMap[method][p2] = [...handlerMap[METHOD_NAME_ALL][p2]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re2 = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m2) => {
          middleware[m2][path] ||= findMiddleware(middleware[m2], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m2) => {
        if (method === METHOD_NAME_ALL || method === m2) {
          Object.keys(middleware[m2]).forEach((p2) => {
            re2.test(p2) && middleware[m2][p2].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m2) => {
        if (method === METHOD_NAME_ALL || method === m2) {
          Object.keys(routes[m2]).forEach(
            (p2) => re2.test(p2) && routes[m2][p2].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i2 = 0, len = paths.length; i2 < len; i2++) {
      const path2 = paths[i2];
      Object.keys(routes).forEach((m2) => {
        if (method === METHOD_NAME_ALL || method === m2) {
          routes[m2][path2] ||= [
            ...findMiddleware(middleware[m2], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m2][path2].push([handler, paramCount - len + i2 + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r2) => {
      const ownRoute = r2[method] ? Object.keys(r2[method]).map((path) => [path, r2[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r2[METHOD_NAME_ALL]).map((path) => [path, r2[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};
var SmartRouter = class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init2) {
    this.#routers = init2.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i2 = 0;
    let res;
    for (; i2 < len; i2++) {
      const router = routers[i2];
      try {
        for (let i22 = 0, len2 = routes.length; i22 < len2; i22++) {
          router.add(...routes[i22]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i2 === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = (children) => {
  for (const _2 in children) {
    return true;
  }
  return false;
};
var Node = class _Node2 {
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m2 = /* @__PURE__ */ Object.create(null);
      m2[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m2];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts2 = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i2 = 0, len = parts2.length; i2 < len; i2++) {
      const p2 = parts2[i2];
      const nextP = parts2[i2 + 1];
      const pattern = getPattern(p2, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p2;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v2, i2, a2) => a2.indexOf(v2) === i2),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i2 = 0, len = node.#methods.length; i2 < len; i2++) {
      const m2 = node.#methods[i2];
      const handlerSet = m2[method] || m2[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i22 = 0, len2 = handlerSet.possibleKeys.length; i22 < len2; i22++) {
            const key = handlerSet.possibleKeys[i22];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts2 = splitPath(path);
    const curNodesQueue = [];
    const len = parts2.length;
    let partOffsets = null;
    for (let i2 = 0; i2 < len; i2++) {
      const part = parts2[i2];
      const isLast = i2 === len - 1;
      const tempNodes = [];
      for (let j3 = 0, len2 = curNodes.length; j3 < len2; j3++) {
        const node = curNodes[j3];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k2 = 0, len3 = node.#patterns.length; k2 < len3; k2++) {
          const pattern = node.#patterns[k2];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name2, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p2 = 0; p2 < len; p2++) {
                partOffsets[p2] = offset;
                offset += parts2[p2].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i2]);
            const m2 = matcher.exec(restPathString);
            if (m2) {
              params[name2] = m2[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m2[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name2] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a2, b2) => {
        return a2.score - b2.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};
var TrieRouter = class {
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i2 = 0, len = results.length; i2 < len; i2++) {
        this.#node.insert(method, results[i2], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};
var Hono = class extends Hono$1 {
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};
function createHealthRoute() {
  const app2 = new Hono();
  app2.get("/health", (c2) => c2.json({ ok: true }));
  return app2;
}
function createConfigRoute(runtimeConfig) {
  const app2 = new Hono();
  app2.get("/config", (c2) => c2.json(runtimeConfig));
  return app2;
}
const entityKind = Symbol.for("drizzle:entityKind");
function is(value, type) {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (value instanceof type) {
    return true;
  }
  if (!Object.prototype.hasOwnProperty.call(type, entityKind)) {
    throw new Error(
      `Class "${type.name ?? "<unknown>"}" doesn't look like a Drizzle entity. If this is incorrect and the class is provided by Drizzle, please report this as a bug.`
    );
  }
  let cls = Object.getPrototypeOf(value).constructor;
  if (cls) {
    while (cls) {
      if (entityKind in cls && cls[entityKind] === type[entityKind]) {
        return true;
      }
      cls = Object.getPrototypeOf(cls);
    }
  }
  return false;
}
class Column {
  constructor(table, config) {
    this.table = table;
    this.config = config;
    this.name = config.name;
    this.keyAsName = config.keyAsName;
    this.notNull = config.notNull;
    this.default = config.default;
    this.defaultFn = config.defaultFn;
    this.onUpdateFn = config.onUpdateFn;
    this.hasDefault = config.hasDefault;
    this.primary = config.primaryKey;
    this.isUnique = config.isUnique;
    this.uniqueName = config.uniqueName;
    this.uniqueType = config.uniqueType;
    this.dataType = config.dataType;
    this.columnType = config.columnType;
    this.generated = config.generated;
    this.generatedIdentity = config.generatedIdentity;
  }
  static [entityKind] = "Column";
  name;
  keyAsName;
  primary;
  notNull;
  default;
  defaultFn;
  onUpdateFn;
  hasDefault;
  isUnique;
  uniqueName;
  uniqueType;
  dataType;
  columnType;
  enumValues = void 0;
  generated = void 0;
  generatedIdentity = void 0;
  config;
  mapFromDriverValue(value) {
    return value;
  }
  mapToDriverValue(value) {
    return value;
  }
  // ** @internal */
  shouldDisableInsert() {
    return this.config.generated !== void 0 && this.config.generated.type !== "byDefault";
  }
}
class ColumnBuilder {
  static [entityKind] = "ColumnBuilder";
  config;
  constructor(name2, dataType, columnType) {
    this.config = {
      name: name2,
      keyAsName: name2 === "",
      notNull: false,
      default: void 0,
      hasDefault: false,
      primaryKey: false,
      isUnique: false,
      uniqueName: void 0,
      uniqueType: void 0,
      dataType,
      columnType,
      generated: void 0
    };
  }
  /**
   * Changes the data type of the column. Commonly used with `json` columns. Also, useful for branded types.
   *
   * @example
   * ```ts
   * const users = pgTable('users', {
   * 	id: integer('id').$type<UserId>().primaryKey(),
   * 	details: json('details').$type<UserDetails>().notNull(),
   * });
   * ```
   */
  $type() {
    return this;
  }
  /**
   * Adds a `not null` clause to the column definition.
   *
   * Affects the `select` model of the table - columns *without* `not null` will be nullable on select.
   */
  notNull() {
    this.config.notNull = true;
    return this;
  }
  /**
   * Adds a `default <value>` clause to the column definition.
   *
   * Affects the `insert` model of the table - columns *with* `default` are optional on insert.
   *
   * If you need to set a dynamic default value, use {@link $defaultFn} instead.
   */
  default(value) {
    this.config.default = value;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Adds a dynamic default value to the column.
   * The function will be called when the row is inserted, and the returned value will be used as the column value.
   *
   * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
   */
  $defaultFn(fn2) {
    this.config.defaultFn = fn2;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Alias for {@link $defaultFn}.
   */
  $default = this.$defaultFn;
  /**
   * Adds a dynamic update value to the column.
   * The function will be called when the row is updated, and the returned value will be used as the column value if none is provided.
   * If no `default` (or `$defaultFn`) value is provided, the function will be called when the row is inserted as well, and the returned value will be used as the column value.
   *
   * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
   */
  $onUpdateFn(fn2) {
    this.config.onUpdateFn = fn2;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Alias for {@link $onUpdateFn}.
   */
  $onUpdate = this.$onUpdateFn;
  /**
   * Adds a `primary key` clause to the column definition. This implicitly makes the column `not null`.
   *
   * In SQLite, `integer primary key` implicitly makes the column auto-incrementing.
   */
  primaryKey() {
    this.config.primaryKey = true;
    this.config.notNull = true;
    return this;
  }
  /** @internal Sets the name of the column to the key within the table definition if a name was not given. */
  setName(name2) {
    if (this.config.name !== "")
      return;
    this.config.name = name2;
  }
}
const TableName = Symbol.for("drizzle:Name");
class ForeignKeyBuilder {
  static [entityKind] = "PgForeignKeyBuilder";
  /** @internal */
  reference;
  /** @internal */
  _onUpdate = "no action";
  /** @internal */
  _onDelete = "no action";
  constructor(config, actions) {
    this.reference = () => {
      const { name: name2, columns, foreignColumns } = config();
      return { name: name2, columns, foreignTable: foreignColumns[0].table, foreignColumns };
    };
    if (actions) {
      this._onUpdate = actions.onUpdate;
      this._onDelete = actions.onDelete;
    }
  }
  onUpdate(action) {
    this._onUpdate = action === void 0 ? "no action" : action;
    return this;
  }
  onDelete(action) {
    this._onDelete = action === void 0 ? "no action" : action;
    return this;
  }
  /** @internal */
  build(table) {
    return new ForeignKey(table, this);
  }
}
class ForeignKey {
  constructor(table, builder) {
    this.table = table;
    this.reference = builder.reference;
    this.onUpdate = builder._onUpdate;
    this.onDelete = builder._onDelete;
  }
  static [entityKind] = "PgForeignKey";
  reference;
  onUpdate;
  onDelete;
  getName() {
    const { name: name2, columns, foreignColumns } = this.reference();
    const columnNames = columns.map((column) => column.name);
    const foreignColumnNames = foreignColumns.map((column) => column.name);
    const chunks = [
      this.table[TableName],
      ...columnNames,
      foreignColumns[0].table[TableName],
      ...foreignColumnNames
    ];
    return name2 ?? `${chunks.join("_")}_fk`;
  }
}
function iife(fn2, ...args2) {
  return fn2(...args2);
}
function uniqueKeyName(table, columns) {
  return `${table[TableName]}_${columns.join("_")}_unique`;
}
function parsePgArrayValue(arrayString, startFrom, inQuotes) {
  for (let i2 = startFrom; i2 < arrayString.length; i2++) {
    const char2 = arrayString[i2];
    if (char2 === "\\") {
      i2++;
      continue;
    }
    if (char2 === '"') {
      return [arrayString.slice(startFrom, i2).replace(/\\/g, ""), i2 + 1];
    }
    if (inQuotes) {
      continue;
    }
    if (char2 === "," || char2 === "}") {
      return [arrayString.slice(startFrom, i2).replace(/\\/g, ""), i2];
    }
  }
  return [arrayString.slice(startFrom).replace(/\\/g, ""), arrayString.length];
}
function parsePgNestedArray(arrayString, startFrom = 0) {
  const result = [];
  let i2 = startFrom;
  let lastCharIsComma = false;
  while (i2 < arrayString.length) {
    const char2 = arrayString[i2];
    if (char2 === ",") {
      if (lastCharIsComma || i2 === startFrom) {
        result.push("");
      }
      lastCharIsComma = true;
      i2++;
      continue;
    }
    lastCharIsComma = false;
    if (char2 === "\\") {
      i2 += 2;
      continue;
    }
    if (char2 === '"') {
      const [value2, startFrom2] = parsePgArrayValue(arrayString, i2 + 1, true);
      result.push(value2);
      i2 = startFrom2;
      continue;
    }
    if (char2 === "}") {
      return [result, i2 + 1];
    }
    if (char2 === "{") {
      const [value2, startFrom2] = parsePgNestedArray(arrayString, i2 + 1);
      result.push(value2);
      i2 = startFrom2;
      continue;
    }
    const [value, newStartFrom] = parsePgArrayValue(arrayString, i2, false);
    result.push(value);
    i2 = newStartFrom;
  }
  return [result, i2];
}
function parsePgArray(arrayString) {
  const [result] = parsePgNestedArray(arrayString, 1);
  return result;
}
function makePgArray(array) {
  return `{${array.map((item) => {
    if (Array.isArray(item)) {
      return makePgArray(item);
    }
    if (typeof item === "string") {
      return `"${item.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    }
    return `${item}`;
  }).join(",")}}`;
}
class PgColumnBuilder extends ColumnBuilder {
  foreignKeyConfigs = [];
  static [entityKind] = "PgColumnBuilder";
  array(size2) {
    return new PgArrayBuilder(this.config.name, this, size2);
  }
  references(ref, actions = {}) {
    this.foreignKeyConfigs.push({ ref, actions });
    return this;
  }
  unique(name2, config) {
    this.config.isUnique = true;
    this.config.uniqueName = name2;
    this.config.uniqueType = config?.nulls;
    return this;
  }
  generatedAlwaysAs(as) {
    this.config.generated = {
      as,
      type: "always",
      mode: "stored"
    };
    return this;
  }
  /** @internal */
  buildForeignKeys(column, table) {
    return this.foreignKeyConfigs.map(({ ref, actions }) => {
      return iife(
        (ref2, actions2) => {
          const builder = new ForeignKeyBuilder(() => {
            const foreignColumn = ref2();
            return { columns: [column], foreignColumns: [foreignColumn] };
          });
          if (actions2.onUpdate) {
            builder.onUpdate(actions2.onUpdate);
          }
          if (actions2.onDelete) {
            builder.onDelete(actions2.onDelete);
          }
          return builder.build(table);
        },
        ref,
        actions
      );
    });
  }
  /** @internal */
  buildExtraConfigColumn(table) {
    return new ExtraConfigColumn(table, this.config);
  }
}
class PgColumn extends Column {
  constructor(table, config) {
    if (!config.uniqueName) {
      config.uniqueName = uniqueKeyName(table, [config.name]);
    }
    super(table, config);
    this.table = table;
  }
  static [entityKind] = "PgColumn";
}
class ExtraConfigColumn extends PgColumn {
  static [entityKind] = "ExtraConfigColumn";
  getSQLType() {
    return this.getSQLType();
  }
  indexConfig = {
    order: this.config.order ?? "asc",
    nulls: this.config.nulls ?? "last",
    opClass: this.config.opClass
  };
  defaultConfig = {
    order: "asc",
    nulls: "last",
    opClass: void 0
  };
  asc() {
    this.indexConfig.order = "asc";
    return this;
  }
  desc() {
    this.indexConfig.order = "desc";
    return this;
  }
  nullsFirst() {
    this.indexConfig.nulls = "first";
    return this;
  }
  nullsLast() {
    this.indexConfig.nulls = "last";
    return this;
  }
  /**
   * ### PostgreSQL documentation quote
   *
   * > An operator class with optional parameters can be specified for each column of an index.
   * The operator class identifies the operators to be used by the index for that column.
   * For example, a B-tree index on four-byte integers would use the int4_ops class;
   * this operator class includes comparison functions for four-byte integers.
   * In practice the default operator class for the column's data type is usually sufficient.
   * The main point of having operator classes is that for some data types, there could be more than one meaningful ordering.
   * For example, we might want to sort a complex-number data type either by absolute value or by real part.
   * We could do this by defining two operator classes for the data type and then selecting the proper class when creating an index.
   * More information about operator classes check:
   *
   * ### Useful links
   * https://www.postgresql.org/docs/current/sql-createindex.html
   *
   * https://www.postgresql.org/docs/current/indexes-opclass.html
   *
   * https://www.postgresql.org/docs/current/xindex.html
   *
   * ### Additional types
   * If you have the `pg_vector` extension installed in your database, you can use the
   * `vector_l2_ops`, `vector_ip_ops`, `vector_cosine_ops`, `vector_l1_ops`, `bit_hamming_ops`, `bit_jaccard_ops`, `halfvec_l2_ops`, `sparsevec_l2_ops` options, which are predefined types.
   *
   * **You can always specify any string you want in the operator class, in case Drizzle doesn't have it natively in its types**
   *
   * @param opClass
   * @returns
   */
  op(opClass) {
    this.indexConfig.opClass = opClass;
    return this;
  }
}
class PgArrayBuilder extends PgColumnBuilder {
  static [entityKind] = "PgArrayBuilder";
  constructor(name2, baseBuilder, size2) {
    super(name2, "array", "PgArray");
    this.config.baseBuilder = baseBuilder;
    this.config.size = size2;
  }
  /** @internal */
  build(table) {
    const baseColumn = this.config.baseBuilder.build(table);
    return new PgArray(
      table,
      this.config,
      baseColumn
    );
  }
}
class PgArray extends PgColumn {
  constructor(table, config, baseColumn, range) {
    super(table, config);
    this.baseColumn = baseColumn;
    this.range = range;
    this.size = config.size;
  }
  size;
  static [entityKind] = "PgArray";
  getSQLType() {
    return `${this.baseColumn.getSQLType()}[${typeof this.size === "number" ? this.size : ""}]`;
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      value = parsePgArray(value);
    }
    return value.map((v2) => this.baseColumn.mapFromDriverValue(v2));
  }
  mapToDriverValue(value, isNestedArray = false) {
    const a2 = value.map(
      (v2) => v2 === null ? null : is(this.baseColumn, PgArray) ? this.baseColumn.mapToDriverValue(v2, true) : this.baseColumn.mapToDriverValue(v2)
    );
    if (isNestedArray)
      return a2;
    return makePgArray(a2);
  }
}
const isPgEnumSym = Symbol.for("drizzle:isPgEnum");
function isPgEnum(obj) {
  return !!obj && typeof obj === "function" && isPgEnumSym in obj && obj[isPgEnumSym] === true;
}
class Subquery {
  static [entityKind] = "Subquery";
  constructor(sql2, selection, alias, isWith = false) {
    this._ = {
      brand: "Subquery",
      sql: sql2,
      selectedFields: selection,
      alias,
      isWith
    };
  }
  // getSQL(): SQL<unknown> {
  // 	return new SQL([this]);
  // }
}
class WithSubquery extends Subquery {
  static [entityKind] = "WithSubquery";
}
const tracer = {
  startActiveSpan(name2, fn2) {
    {
      return fn2();
    }
  }
};
const ViewBaseConfig = Symbol.for("drizzle:ViewBaseConfig");
const Schema = Symbol.for("drizzle:Schema");
const Columns = Symbol.for("drizzle:Columns");
const ExtraConfigColumns = Symbol.for("drizzle:ExtraConfigColumns");
const OriginalName = Symbol.for("drizzle:OriginalName");
const BaseName = Symbol.for("drizzle:BaseName");
const IsAlias = Symbol.for("drizzle:IsAlias");
const ExtraConfigBuilder = Symbol.for("drizzle:ExtraConfigBuilder");
const IsDrizzleTable = Symbol.for("drizzle:IsDrizzleTable");
class Table {
  static [entityKind] = "Table";
  /** @internal */
  static Symbol = {
    Name: TableName,
    Schema,
    OriginalName,
    Columns,
    ExtraConfigColumns,
    BaseName,
    IsAlias,
    ExtraConfigBuilder
  };
  /**
   * @internal
   * Can be changed if the table is aliased.
   */
  [TableName];
  /**
   * @internal
   * Used to store the original name of the table, before any aliasing.
   */
  [OriginalName];
  /** @internal */
  [Schema];
  /** @internal */
  [Columns];
  /** @internal */
  [ExtraConfigColumns];
  /**
   *  @internal
   * Used to store the table name before the transformation via the `tableCreator` functions.
   */
  [BaseName];
  /** @internal */
  [IsAlias] = false;
  /** @internal */
  [IsDrizzleTable] = true;
  /** @internal */
  [ExtraConfigBuilder] = void 0;
  constructor(name2, schema2, baseName) {
    this[TableName] = this[OriginalName] = name2;
    this[Schema] = schema2;
    this[BaseName] = baseName;
  }
}
function getTableName(table) {
  return table[TableName];
}
function getTableUniqueName(table) {
  return `${table[Schema] ?? "public"}.${table[TableName]}`;
}
function isSQLWrapper(value) {
  return value !== null && value !== void 0 && typeof value.getSQL === "function";
}
function mergeQueries(queries) {
  const result = { sql: "", params: [] };
  for (const query of queries) {
    result.sql += query.sql;
    result.params.push(...query.params);
    if (query.typings?.length) {
      if (!result.typings) {
        result.typings = [];
      }
      result.typings.push(...query.typings);
    }
  }
  return result;
}
class StringChunk {
  static [entityKind] = "StringChunk";
  value;
  constructor(value) {
    this.value = Array.isArray(value) ? value : [value];
  }
  getSQL() {
    return new SQL([this]);
  }
}
class SQL {
  constructor(queryChunks) {
    this.queryChunks = queryChunks;
  }
  static [entityKind] = "SQL";
  /** @internal */
  decoder = noopDecoder;
  shouldInlineParams = false;
  append(query) {
    this.queryChunks.push(...query.queryChunks);
    return this;
  }
  toQuery(config) {
    return tracer.startActiveSpan("drizzle.buildSQL", (span) => {
      const query = this.buildQueryFromSourceParams(this.queryChunks, config);
      span?.setAttributes({
        "drizzle.query.text": query.sql,
        "drizzle.query.params": JSON.stringify(query.params)
      });
      return query;
    });
  }
  buildQueryFromSourceParams(chunks, _config) {
    const config = Object.assign({}, _config, {
      inlineParams: _config.inlineParams || this.shouldInlineParams,
      paramStartIndex: _config.paramStartIndex || { value: 0 }
    });
    const {
      casing,
      escapeName,
      escapeParam,
      prepareTyping,
      inlineParams,
      paramStartIndex
    } = config;
    return mergeQueries(chunks.map((chunk) => {
      if (is(chunk, StringChunk)) {
        return { sql: chunk.value.join(""), params: [] };
      }
      if (is(chunk, Name)) {
        return { sql: escapeName(chunk.value), params: [] };
      }
      if (chunk === void 0) {
        return { sql: "", params: [] };
      }
      if (Array.isArray(chunk)) {
        const result = [new StringChunk("(")];
        for (const [i2, p2] of chunk.entries()) {
          result.push(p2);
          if (i2 < chunk.length - 1) {
            result.push(new StringChunk(", "));
          }
        }
        result.push(new StringChunk(")"));
        return this.buildQueryFromSourceParams(result, config);
      }
      if (is(chunk, SQL)) {
        return this.buildQueryFromSourceParams(chunk.queryChunks, {
          ...config,
          inlineParams: inlineParams || chunk.shouldInlineParams
        });
      }
      if (is(chunk, Table)) {
        const schemaName = chunk[Table.Symbol.Schema];
        const tableName = chunk[Table.Symbol.Name];
        return {
          sql: schemaName === void 0 || chunk[IsAlias] ? escapeName(tableName) : escapeName(schemaName) + "." + escapeName(tableName),
          params: []
        };
      }
      if (is(chunk, Column)) {
        const columnName = casing.getColumnCasing(chunk);
        if (_config.invokeSource === "indexes") {
          return { sql: escapeName(columnName), params: [] };
        }
        const schemaName = chunk.table[Table.Symbol.Schema];
        return {
          sql: chunk.table[IsAlias] || schemaName === void 0 ? escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName) : escapeName(schemaName) + "." + escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName),
          params: []
        };
      }
      if (is(chunk, View)) {
        const schemaName = chunk[ViewBaseConfig].schema;
        const viewName = chunk[ViewBaseConfig].name;
        return {
          sql: schemaName === void 0 || chunk[ViewBaseConfig].isAlias ? escapeName(viewName) : escapeName(schemaName) + "." + escapeName(viewName),
          params: []
        };
      }
      if (is(chunk, Param)) {
        if (is(chunk.value, Placeholder)) {
          return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
        }
        const mappedValue = chunk.value === null ? null : chunk.encoder.mapToDriverValue(chunk.value);
        if (is(mappedValue, SQL)) {
          return this.buildQueryFromSourceParams([mappedValue], config);
        }
        if (inlineParams) {
          return { sql: this.mapInlineParam(mappedValue, config), params: [] };
        }
        let typings = ["none"];
        if (prepareTyping) {
          typings = [prepareTyping(chunk.encoder)];
        }
        return { sql: escapeParam(paramStartIndex.value++, mappedValue), params: [mappedValue], typings };
      }
      if (is(chunk, Placeholder)) {
        return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
      }
      if (is(chunk, SQL.Aliased) && chunk.fieldAlias !== void 0) {
        return { sql: escapeName(chunk.fieldAlias), params: [] };
      }
      if (is(chunk, Subquery)) {
        if (chunk._.isWith) {
          return { sql: escapeName(chunk._.alias), params: [] };
        }
        return this.buildQueryFromSourceParams([
          new StringChunk("("),
          chunk._.sql,
          new StringChunk(") "),
          new Name(chunk._.alias)
        ], config);
      }
      if (isPgEnum(chunk)) {
        if (chunk.schema) {
          return { sql: escapeName(chunk.schema) + "." + escapeName(chunk.enumName), params: [] };
        }
        return { sql: escapeName(chunk.enumName), params: [] };
      }
      if (isSQLWrapper(chunk)) {
        if (chunk.shouldOmitSQLParens?.()) {
          return this.buildQueryFromSourceParams([chunk.getSQL()], config);
        }
        return this.buildQueryFromSourceParams([
          new StringChunk("("),
          chunk.getSQL(),
          new StringChunk(")")
        ], config);
      }
      if (inlineParams) {
        return { sql: this.mapInlineParam(chunk, config), params: [] };
      }
      return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
    }));
  }
  mapInlineParam(chunk, { escapeString }) {
    if (chunk === null) {
      return "null";
    }
    if (typeof chunk === "number" || typeof chunk === "boolean") {
      return chunk.toString();
    }
    if (typeof chunk === "string") {
      return escapeString(chunk);
    }
    if (typeof chunk === "object") {
      const mappedValueAsString = chunk.toString();
      if (mappedValueAsString === "[object Object]") {
        return escapeString(JSON.stringify(chunk));
      }
      return escapeString(mappedValueAsString);
    }
    throw new Error("Unexpected param value: " + chunk);
  }
  getSQL() {
    return this;
  }
  as(alias) {
    if (alias === void 0) {
      return this;
    }
    return new SQL.Aliased(this, alias);
  }
  mapWith(decoder) {
    this.decoder = typeof decoder === "function" ? { mapFromDriverValue: decoder } : decoder;
    return this;
  }
  inlineParams() {
    this.shouldInlineParams = true;
    return this;
  }
  /**
   * This method is used to conditionally include a part of the query.
   *
   * @param condition - Condition to check
   * @returns itself if the condition is `true`, otherwise `undefined`
   */
  if(condition) {
    return condition ? this : void 0;
  }
}
class Name {
  constructor(value) {
    this.value = value;
  }
  static [entityKind] = "Name";
  brand;
  getSQL() {
    return new SQL([this]);
  }
}
function isDriverValueEncoder(value) {
  return typeof value === "object" && value !== null && "mapToDriverValue" in value && typeof value.mapToDriverValue === "function";
}
const noopDecoder = {
  mapFromDriverValue: (value) => value
};
const noopEncoder = {
  mapToDriverValue: (value) => value
};
({
  ...noopDecoder,
  ...noopEncoder
});
class Param {
  /**
   * @param value - Parameter value
   * @param encoder - Encoder to convert the value to a driver parameter
   */
  constructor(value, encoder = noopEncoder) {
    this.value = value;
    this.encoder = encoder;
  }
  static [entityKind] = "Param";
  brand;
  getSQL() {
    return new SQL([this]);
  }
}
function sql(strings, ...params) {
  const queryChunks = [];
  if (params.length > 0 || strings.length > 0 && strings[0] !== "") {
    queryChunks.push(new StringChunk(strings[0]));
  }
  for (const [paramIndex, param2] of params.entries()) {
    queryChunks.push(param2, new StringChunk(strings[paramIndex + 1]));
  }
  return new SQL(queryChunks);
}
((sql2) => {
  function empty() {
    return new SQL([]);
  }
  sql2.empty = empty;
  function fromList(list) {
    return new SQL(list);
  }
  sql2.fromList = fromList;
  function raw(str) {
    return new SQL([new StringChunk(str)]);
  }
  sql2.raw = raw;
  function join(chunks, separator) {
    const result = [];
    for (const [i2, chunk] of chunks.entries()) {
      if (i2 > 0 && separator !== void 0) {
        result.push(separator);
      }
      result.push(chunk);
    }
    return new SQL(result);
  }
  sql2.join = join;
  function identifier(value) {
    return new Name(value);
  }
  sql2.identifier = identifier;
  function placeholder2(name2) {
    return new Placeholder(name2);
  }
  sql2.placeholder = placeholder2;
  function param2(value, encoder) {
    return new Param(value, encoder);
  }
  sql2.param = param2;
})(sql || (sql = {}));
((SQL2) => {
  class Aliased {
    constructor(sql2, fieldAlias) {
      this.sql = sql2;
      this.fieldAlias = fieldAlias;
    }
    static [entityKind] = "SQL.Aliased";
    /** @internal */
    isSelectionField = false;
    getSQL() {
      return this.sql;
    }
    /** @internal */
    clone() {
      return new Aliased(this.sql, this.fieldAlias);
    }
  }
  SQL2.Aliased = Aliased;
})(SQL || (SQL = {}));
class Placeholder {
  constructor(name2) {
    this.name = name2;
  }
  static [entityKind] = "Placeholder";
  getSQL() {
    return new SQL([this]);
  }
}
function fillPlaceholders(params, values2) {
  return params.map((p2) => {
    if (is(p2, Placeholder)) {
      if (!(p2.name in values2)) {
        throw new Error(`No value for placeholder "${p2.name}" was provided`);
      }
      return values2[p2.name];
    }
    if (is(p2, Param) && is(p2.value, Placeholder)) {
      if (!(p2.value.name in values2)) {
        throw new Error(`No value for placeholder "${p2.value.name}" was provided`);
      }
      return p2.encoder.mapToDriverValue(values2[p2.value.name]);
    }
    return p2;
  });
}
const IsDrizzleView = Symbol.for("drizzle:IsDrizzleView");
class View {
  static [entityKind] = "View";
  /** @internal */
  [ViewBaseConfig];
  /** @internal */
  [IsDrizzleView] = true;
  constructor({ name: name2, schema: schema2, selectedFields, query }) {
    this[ViewBaseConfig] = {
      name: name2,
      originalName: name2,
      schema: schema2,
      selectedFields,
      query,
      isExisting: !query,
      isAlias: false
    };
  }
  getSQL() {
    return new SQL([this]);
  }
}
Column.prototype.getSQL = function() {
  return new SQL([this]);
};
Table.prototype.getSQL = function() {
  return new SQL([this]);
};
Subquery.prototype.getSQL = function() {
  return new SQL([this]);
};
class ColumnAliasProxyHandler {
  constructor(table) {
    this.table = table;
  }
  static [entityKind] = "ColumnAliasProxyHandler";
  get(columnObj, prop) {
    if (prop === "table") {
      return this.table;
    }
    return columnObj[prop];
  }
}
class TableAliasProxyHandler {
  constructor(alias, replaceOriginalName) {
    this.alias = alias;
    this.replaceOriginalName = replaceOriginalName;
  }
  static [entityKind] = "TableAliasProxyHandler";
  get(target, prop) {
    if (prop === Table.Symbol.IsAlias) {
      return true;
    }
    if (prop === Table.Symbol.Name) {
      return this.alias;
    }
    if (this.replaceOriginalName && prop === Table.Symbol.OriginalName) {
      return this.alias;
    }
    if (prop === ViewBaseConfig) {
      return {
        ...target[ViewBaseConfig],
        name: this.alias,
        isAlias: true
      };
    }
    if (prop === Table.Symbol.Columns) {
      const columns = target[Table.Symbol.Columns];
      if (!columns) {
        return columns;
      }
      const proxiedColumns = {};
      Object.keys(columns).map((key) => {
        proxiedColumns[key] = new Proxy(
          columns[key],
          new ColumnAliasProxyHandler(new Proxy(target, this))
        );
      });
      return proxiedColumns;
    }
    const value = target[prop];
    if (is(value, Column)) {
      return new Proxy(value, new ColumnAliasProxyHandler(new Proxy(target, this)));
    }
    return value;
  }
}
function aliasedTable(table, tableAlias) {
  return new Proxy(table, new TableAliasProxyHandler(tableAlias, false));
}
function aliasedTableColumn(column, tableAlias) {
  return new Proxy(
    column,
    new ColumnAliasProxyHandler(new Proxy(column.table, new TableAliasProxyHandler(tableAlias, false)))
  );
}
function mapColumnsInAliasedSQLToAlias(query, alias) {
  return new SQL.Aliased(mapColumnsInSQLToAlias(query.sql, alias), query.fieldAlias);
}
function mapColumnsInSQLToAlias(query, alias) {
  return sql.join(query.queryChunks.map((c2) => {
    if (is(c2, Column)) {
      return aliasedTableColumn(c2, alias);
    }
    if (is(c2, SQL)) {
      return mapColumnsInSQLToAlias(c2, alias);
    }
    if (is(c2, SQL.Aliased)) {
      return mapColumnsInAliasedSQLToAlias(c2, alias);
    }
    return c2;
  }));
}
function mapResultRow(columns, row, joinsNotNullableMap) {
  const nullifyMap = {};
  const result = columns.reduce(
    (result2, { path, field }, columnIndex) => {
      let decoder;
      if (is(field, Column)) {
        decoder = field;
      } else if (is(field, SQL)) {
        decoder = field.decoder;
      } else {
        decoder = field.sql.decoder;
      }
      let node = result2;
      for (const [pathChunkIndex, pathChunk] of path.entries()) {
        if (pathChunkIndex < path.length - 1) {
          if (!(pathChunk in node)) {
            node[pathChunk] = {};
          }
          node = node[pathChunk];
        } else {
          const rawValue = row[columnIndex];
          const value = node[pathChunk] = rawValue === null ? null : decoder.mapFromDriverValue(rawValue);
          if (joinsNotNullableMap && is(field, Column) && path.length === 2) {
            const objectName = path[0];
            if (!(objectName in nullifyMap)) {
              nullifyMap[objectName] = value === null ? getTableName(field.table) : false;
            } else if (typeof nullifyMap[objectName] === "string" && nullifyMap[objectName] !== getTableName(field.table)) {
              nullifyMap[objectName] = false;
            }
          }
        }
      }
      return result2;
    },
    {}
  );
  if (joinsNotNullableMap && Object.keys(nullifyMap).length > 0) {
    for (const [objectName, tableName] of Object.entries(nullifyMap)) {
      if (typeof tableName === "string" && !joinsNotNullableMap[tableName]) {
        result[objectName] = null;
      }
    }
  }
  return result;
}
function orderSelectedFields(fields, pathPrefix) {
  return Object.entries(fields).reduce((result, [name2, field]) => {
    if (typeof name2 !== "string") {
      return result;
    }
    const newPath = pathPrefix ? [...pathPrefix, name2] : [name2];
    if (is(field, Column) || is(field, SQL) || is(field, SQL.Aliased)) {
      result.push({ path: newPath, field });
    } else if (is(field, Table)) {
      result.push(...orderSelectedFields(field[Table.Symbol.Columns], newPath));
    } else {
      result.push(...orderSelectedFields(field, newPath));
    }
    return result;
  }, []);
}
function haveSameKeys(left, right) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (const [index, key] of leftKeys.entries()) {
    if (key !== rightKeys[index]) {
      return false;
    }
  }
  return true;
}
function mapUpdateSet(table, values2) {
  const entries = Object.entries(values2).filter(([, value]) => value !== void 0).map(([key, value]) => {
    if (is(value, SQL) || is(value, Column)) {
      return [key, value];
    } else {
      return [key, new Param(value, table[Table.Symbol.Columns][key])];
    }
  });
  if (entries.length === 0) {
    throw new Error("No values to set");
  }
  return Object.fromEntries(entries);
}
function applyMixins(baseClass, extendedClasses) {
  for (const extendedClass of extendedClasses) {
    for (const name2 of Object.getOwnPropertyNames(extendedClass.prototype)) {
      if (name2 === "constructor")
        continue;
      Object.defineProperty(
        baseClass.prototype,
        name2,
        Object.getOwnPropertyDescriptor(extendedClass.prototype, name2) || /* @__PURE__ */ Object.create(null)
      );
    }
  }
}
function getTableColumns(table) {
  return table[Table.Symbol.Columns];
}
function getTableLikeName(table) {
  return is(table, Subquery) ? table._.alias : is(table, View) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : table[Table.Symbol.IsAlias] ? table[Table.Symbol.Name] : table[Table.Symbol.BaseName];
}
function getColumnNameAndConfig(a2, b2) {
  return {
    name: typeof a2 === "string" && a2.length > 0 ? a2 : "",
    config: typeof a2 === "object" ? a2 : b2
  };
}
function isConfig(data) {
  if (typeof data !== "object" || data === null)
    return false;
  if (data.constructor.name !== "Object")
    return false;
  if ("logger" in data) {
    const type = typeof data["logger"];
    if (type !== "boolean" && (type !== "object" || typeof data["logger"]["logQuery"] !== "function") && type !== "undefined")
      return false;
    return true;
  }
  if ("schema" in data) {
    const type = typeof data["schema"];
    if (type !== "object" && type !== "undefined")
      return false;
    return true;
  }
  if ("casing" in data) {
    const type = typeof data["casing"];
    if (type !== "string" && type !== "undefined")
      return false;
    return true;
  }
  if ("mode" in data) {
    if (data["mode"] !== "default" || data["mode"] !== "planetscale" || data["mode"] !== void 0)
      return false;
    return true;
  }
  if ("connection" in data) {
    const type = typeof data["connection"];
    if (type !== "string" && type !== "object" && type !== "undefined")
      return false;
    return true;
  }
  if ("client" in data) {
    const type = typeof data["client"];
    if (type !== "object" && type !== "function" && type !== "undefined")
      return false;
    return true;
  }
  if (Object.keys(data).length === 0)
    return true;
  return false;
}
class PgIntColumnBaseBuilder extends PgColumnBuilder {
  static [entityKind] = "PgIntColumnBaseBuilder";
  generatedAlwaysAsIdentity(sequence) {
    if (sequence) {
      const { name: name2, ...options } = sequence;
      this.config.generatedIdentity = {
        type: "always",
        sequenceName: name2,
        sequenceOptions: options
      };
    } else {
      this.config.generatedIdentity = {
        type: "always"
      };
    }
    this.config.hasDefault = true;
    this.config.notNull = true;
    return this;
  }
  generatedByDefaultAsIdentity(sequence) {
    if (sequence) {
      const { name: name2, ...options } = sequence;
      this.config.generatedIdentity = {
        type: "byDefault",
        sequenceName: name2,
        sequenceOptions: options
      };
    } else {
      this.config.generatedIdentity = {
        type: "byDefault"
      };
    }
    this.config.hasDefault = true;
    this.config.notNull = true;
    return this;
  }
}
class PgBigInt53Builder extends PgIntColumnBaseBuilder {
  static [entityKind] = "PgBigInt53Builder";
  constructor(name2) {
    super(name2, "number", "PgBigInt53");
  }
  /** @internal */
  build(table) {
    return new PgBigInt53(table, this.config);
  }
}
class PgBigInt53 extends PgColumn {
  static [entityKind] = "PgBigInt53";
  getSQLType() {
    return "bigint";
  }
  mapFromDriverValue(value) {
    if (typeof value === "number") {
      return value;
    }
    return Number(value);
  }
}
class PgBigInt64Builder extends PgIntColumnBaseBuilder {
  static [entityKind] = "PgBigInt64Builder";
  constructor(name2) {
    super(name2, "bigint", "PgBigInt64");
  }
  /** @internal */
  build(table) {
    return new PgBigInt64(
      table,
      this.config
    );
  }
}
class PgBigInt64 extends PgColumn {
  static [entityKind] = "PgBigInt64";
  getSQLType() {
    return "bigint";
  }
  // eslint-disable-next-line unicorn/prefer-native-coercion-functions
  mapFromDriverValue(value) {
    return BigInt(value);
  }
}
function bigint(a2, b2) {
  const { name: name2, config } = getColumnNameAndConfig(a2, b2);
  if (config.mode === "number") {
    return new PgBigInt53Builder(name2);
  }
  return new PgBigInt64Builder(name2);
}
class PgBigSerial53Builder extends PgColumnBuilder {
  static [entityKind] = "PgBigSerial53Builder";
  constructor(name2) {
    super(name2, "number", "PgBigSerial53");
    this.config.hasDefault = true;
    this.config.notNull = true;
  }
  /** @internal */
  build(table) {
    return new PgBigSerial53(
      table,
      this.config
    );
  }
}
class PgBigSerial53 extends PgColumn {
  static [entityKind] = "PgBigSerial53";
  getSQLType() {
    return "bigserial";
  }
  mapFromDriverValue(value) {
    if (typeof value === "number") {
      return value;
    }
    return Number(value);
  }
}
class PgBigSerial64Builder extends PgColumnBuilder {
  static [entityKind] = "PgBigSerial64Builder";
  constructor(name2) {
    super(name2, "bigint", "PgBigSerial64");
    this.config.hasDefault = true;
  }
  /** @internal */
  build(table) {
    return new PgBigSerial64(
      table,
      this.config
    );
  }
}
class PgBigSerial64 extends PgColumn {
  static [entityKind] = "PgBigSerial64";
  getSQLType() {
    return "bigserial";
  }
  // eslint-disable-next-line unicorn/prefer-native-coercion-functions
  mapFromDriverValue(value) {
    return BigInt(value);
  }
}
function bigserial(a2, b2) {
  const { name: name2, config } = getColumnNameAndConfig(a2, b2);
  if (config.mode === "number") {
    return new PgBigSerial53Builder(name2);
  }
  return new PgBigSerial64Builder(name2);
}
class PgBooleanBuilder extends PgColumnBuilder {
  static [entityKind] = "PgBooleanBuilder";
  constructor(name2) {
    super(name2, "boolean", "PgBoolean");
  }
  /** @internal */
  build(table) {
    return new PgBoolean(table, this.config);
  }
}
class PgBoolean extends PgColumn {
  static [entityKind] = "PgBoolean";
  getSQLType() {
    return "boolean";
  }
}
function boolean(name2) {
  return new PgBooleanBuilder(name2 ?? "");
}
class PgCharBuilder extends PgColumnBuilder {
  static [entityKind] = "PgCharBuilder";
  constructor(name2, config) {
    super(name2, "string", "PgChar");
    this.config.length = config.length;
    this.config.enumValues = config.enum;
  }
  /** @internal */
  build(table) {
    return new PgChar(
      table,
      this.config
    );
  }
}
class PgChar extends PgColumn {
  static [entityKind] = "PgChar";
  length = this.config.length;
  enumValues = this.config.enumValues;
  getSQLType() {
    return this.length === void 0 ? `char` : `char(${this.length})`;
  }
}
function char(a2, b2 = {}) {
  const { name: name2, config } = getColumnNameAndConfig(a2, b2);
  return new PgCharBuilder(name2, config);
}
class PgCidrBuilder extends PgColumnBuilder {
  static [entityKind] = "PgCidrBuilder";
  constructor(name2) {
    super(name2, "string", "PgCidr");
  }
  /** @internal */
  build(table) {
    return new PgCidr(table, this.config);
  }
}
class PgCidr extends PgColumn {
  static [entityKind] = "PgCidr";
  getSQLType() {
    return "cidr";
  }
}
function cidr(name2) {
  return new PgCidrBuilder(name2 ?? "");
}
class PgCustomColumnBuilder extends PgColumnBuilder {
  static [entityKind] = "PgCustomColumnBuilder";
  constructor(name2, fieldConfig, customTypeParams) {
    super(name2, "custom", "PgCustomColumn");
    this.config.fieldConfig = fieldConfig;
    this.config.customTypeParams = customTypeParams;
  }
  /** @internal */
  build(table) {
    return new PgCustomColumn(
      table,
      this.config
    );
  }
}
class PgCustomColumn extends PgColumn {
  static [entityKind] = "PgCustomColumn";
  sqlName;
  mapTo;
  mapFrom;
  constructor(table, config) {
    super(table, config);
    this.sqlName = config.customTypeParams.dataType(config.fieldConfig);
    this.mapTo = config.customTypeParams.toDriver;
    this.mapFrom = config.customTypeParams.fromDriver;
  }
  getSQLType() {
    return this.sqlName;
  }
  mapFromDriverValue(value) {
    return typeof this.mapFrom === "function" ? this.mapFrom(value) : value;
  }
  mapToDriverValue(value) {
    return typeof this.mapTo === "function" ? this.mapTo(value) : value;
  }
}
function customType(customTypeParams) {
  return (a2, b2) => {
    const { name: name2, config } = getColumnNameAndConfig(a2, b2);
    return new PgCustomColumnBuilder(name2, config, customTypeParams);
  };
}
class PgDateColumnBaseBuilder extends PgColumnBuilder {
  static [entityKind] = "PgDateColumnBaseBuilder";
  defaultNow() {
    return this.default(sql`now()`);
  }
}
class PgDateBuilder extends PgDateColumnBaseBuilder {
  static [entityKind] = "PgDateBuilder";
  constructor(name2) {
    super(name2, "date", "PgDate");
  }
  /** @internal */
  build(table) {
    return new PgDate(table, this.config);
  }
}
class PgDate extends PgColumn {
  static [entityKind] = "PgDate";
  getSQLType() {
    return "date";
  }
  mapFromDriverValue(value) {
    return new Date(value);
  }
  mapToDriverValue(value) {
    return value.toISOString();
  }
}
class PgDateStringBuilder extends PgDateColumnBaseBuilder {
  static [entityKind] = "PgDateStringBuilder";
  constructor(name2) {
    super(name2, "string", "PgDateString");
  }
  /** @internal */
  build(table) {
    return new PgDateString(
      table,
      this.config
    );
  }
}
class PgDateString extends PgColumn {
  static [entityKind] = "PgDateString";
  getSQLType() {
    return "date";
  }
}
function date(a2, b2) {
  const { name: name2, config } = getColumnNameAndConfig(a2, b2);
  if (config?.mode === "date") {
    return new PgDateBuilder(name2);
  }
  return new PgDateStringBuilder(name2);
}
class PgDoublePrecisionBuilder extends PgColumnBuilder {
  static [entityKind] = "PgDoublePrecisionBuilder";
  constructor(name2) {
    super(name2, "number", "PgDoublePrecision");
  }
  /** @internal */
  build(table) {
    return new PgDoublePrecision(
      table,
      this.config
    );
  }
}
class PgDoublePrecision extends PgColumn {
  static [entityKind] = "PgDoublePrecision";
  getSQLType() {
    return "double precision";
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      return Number.parseFloat(value);
    }
    return value;
  }
}
function doublePrecision(name2) {
  return new PgDoublePrecisionBuilder(name2 ?? "");
}
class PgInetBuilder extends PgColumnBuilder {
  static [entityKind] = "PgInetBuilder";
  constructor(name2) {
    super(name2, "string", "PgInet");
  }
  /** @internal */
  build(table) {
    return new PgInet(table, this.config);
  }
}
class PgInet extends PgColumn {
  static [entityKind] = "PgInet";
  getSQLType() {
    return "inet";
  }
}
function inet(name2) {
  return new PgInetBuilder(name2 ?? "");
}
class PgIntegerBuilder extends PgIntColumnBaseBuilder {
  static [entityKind] = "PgIntegerBuilder";
  constructor(name2) {
    super(name2, "number", "PgInteger");
  }
  /** @internal */
  build(table) {
    return new PgInteger(table, this.config);
  }
}
class PgInteger extends PgColumn {
  static [entityKind] = "PgInteger";
  getSQLType() {
    return "integer";
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      return Number.parseInt(value);
    }
    return value;
  }
}
function integer(name2) {
  return new PgIntegerBuilder(name2 ?? "");
}
class PgIntervalBuilder extends PgColumnBuilder {
  static [entityKind] = "PgIntervalBuilder";
  constructor(name2, intervalConfig) {
    super(name2, "string", "PgInterval");
    this.config.intervalConfig = intervalConfig;
  }
  /** @internal */
  build(table) {
    return new PgInterval(table, this.config);
  }
}
class PgInterval extends PgColumn {
  static [entityKind] = "PgInterval";
  fields = this.config.intervalConfig.fields;
  precision = this.config.intervalConfig.precision;
  getSQLType() {
    const fields = this.fields ? ` ${this.fields}` : "";
    const precision = this.precision ? `(${this.precision})` : "";
    return `interval${fields}${precision}`;
  }
}
function interval(a2, b2 = {}) {
  const { name: name2, config } = getColumnNameAndConfig(a2, b2);
  return new PgIntervalBuilder(name2, config);
}
class PgJsonBuilder extends PgColumnBuilder {
  static [entityKind] = "PgJsonBuilder";
  constructor(name2) {
    super(name2, "json", "PgJson");
  }
  /** @internal */
  build(table) {
    return new PgJson(table, this.config);
  }
}
class PgJson extends PgColumn {
  static [entityKind] = "PgJson";
  constructor(table, config) {
    super(table, config);
  }
  getSQLType() {
    return "json";
  }
  mapToDriverValue(value) {
    return JSON.stringify(value);
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }
}
function json(name2) {
  return new PgJsonBuilder(name2 ?? "");
}
class PgJsonbBuilder extends PgColumnBuilder {
  static [entityKind] = "PgJsonbBuilder";
  constructor(name2) {
    super(name2, "json", "PgJsonb");
  }
  /** @internal */
  build(table) {
    return new PgJsonb(table, this.config);
  }
}
class PgJsonb extends PgColumn {
  static [entityKind] = "PgJsonb";
  constructor(table, config) {
    super(table, config);
  }
  getSQLType() {
    return "jsonb";
  }
  mapToDriverValue(value) {
    return JSON.stringify(value);
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }
}
function jsonb(name2) {
  return new PgJsonbBuilder(name2 ?? "");
}
class PgLineBuilder extends PgColumnBuilder {
  static [entityKind] = "PgLineBuilder";
  constructor(name2) {
    super(name2, "array", "PgLine");
  }
  /** @internal */
  build(table) {
    return new PgLineTuple(
      table,
      this.config
    );
  }
}
class PgLineTuple extends PgColumn {
  static [entityKind] = "PgLine";
  getSQLType() {
    return "line";
  }
  mapFromDriverValue(value) {
    const [a2, b2, c2] = value.slice(1, -1).split(",");
    return [Number.parseFloat(a2), Number.parseFloat(b2), Number.parseFloat(c2)];
  }
  mapToDriverValue(value) {
    return `{${value[0]},${value[1]},${value[2]}}`;
  }
}
class PgLineABCBuilder extends PgColumnBuilder {
  static [entityKind] = "PgLineABCBuilder";
  constructor(name2) {
    super(name2, "json", "PgLineABC");
  }
  /** @internal */
  build(table) {
    return new PgLineABC(
      table,
      this.config
    );
  }
}
class PgLineABC extends PgColumn {
  static [entityKind] = "PgLineABC";
  getSQLType() {
    return "line";
  }
  mapFromDriverValue(value) {
    const [a2, b2, c2] = value.slice(1, -1).split(",");
    return { a: Number.parseFloat(a2), b: Number.parseFloat(b2), c: Number.parseFloat(c2) };
  }
  mapToDriverValue(value) {
    return `{${value.a},${value.b},${value.c}}`;
  }
}
function line(a2, b2) {
  const { name: name2, config } = getColumnNameAndConfig(a2, b2);
  if (!config?.mode || config.mode === "tuple") {
    return new PgLineBuilder(name2);
  }
  return new PgLineABCBuilder(name2);
}
class PgMacaddrBuilder extends PgColumnBuilder {
  static [entityKind] = "PgMacaddrBuilder";
  constructor(name2) {
    super(name2, "string", "PgMacaddr");
  }
  /** @internal */
  build(table) {
    return new PgMacaddr(table, this.config);
  }
}
class PgMacaddr extends PgColumn {
  static [entityKind] = "PgMacaddr";
  getSQLType() {
    return "macaddr";
  }
}
function macaddr(name2) {
  return new PgMacaddrBuilder(name2 ?? "");
}
class PgMacaddr8Builder extends PgColumnBuilder {
  static [entityKind] = "PgMacaddr8Builder";
  constructor(name2) {
    super(name2, "string", "PgMacaddr8");
  }
  /** @internal */
  build(table) {
    return new PgMacaddr8(table, this.config);
  }
}
class PgMacaddr8 extends PgColumn {
  static [entityKind] = "PgMacaddr8";
  getSQLType() {
    return "macaddr8";
  }
}
function macaddr8(name2) {
  return new PgMacaddr8Builder(name2 ?? "");
}
class PgNumericBuilder extends PgColumnBuilder {
  static [entityKind] = "PgNumericBuilder";
  constructor(name2, precision, scale) {
    super(name2, "string", "PgNumeric");
    this.config.precision = precision;
    this.config.scale = scale;
  }
  /** @internal */
  build(table) {
    return new PgNumeric(table, this.config);
  }
}
class PgNumeric extends PgColumn {
  static [entityKind] = "PgNumeric";
  precision;
  scale;
  constructor(table, config) {
    super(table, config);
    this.precision = config.precision;
    this.scale = config.scale;
  }
  mapFromDriverValue(value) {
    if (typeof value === "string")
      return value;
    return String(value);
  }
  getSQLType() {
    if (this.precision !== void 0 && this.scale !== void 0) {
      return `numeric(${this.precision}, ${this.scale})`;
    } else if (this.precision === void 0) {
      return "numeric";
    } else {
      return `numeric(${this.precision})`;
    }
  }
}
class PgNumericNumberBuilder extends PgColumnBuilder {
  static [entityKind] = "PgNumericNumberBuilder";
  constructor(name2, precision, scale) {
    super(name2, "number", "PgNumericNumber");
    this.config.precision = precision;
    this.config.scale = scale;
  }
  /** @internal */
  build(table) {
    return new PgNumericNumber(
      table,
      this.config
    );
  }
}
class PgNumericNumber extends PgColumn {
  static [entityKind] = "PgNumericNumber";
  precision;
  scale;
  constructor(table, config) {
    super(table, config);
    this.precision = config.precision;
    this.scale = config.scale;
  }
  mapFromDriverValue(value) {
    if (typeof value === "number")
      return value;
    return Number(value);
  }
  mapToDriverValue = String;
  getSQLType() {
    if (this.precision !== void 0 && this.scale !== void 0) {
      return `numeric(${this.precision}, ${this.scale})`;
    } else if (this.precision === void 0) {
      return "numeric";
    } else {
      return `numeric(${this.precision})`;
    }
  }
}
class PgNumericBigIntBuilder extends PgColumnBuilder {
  static [entityKind] = "PgNumericBigIntBuilder";
  constructor(name2, precision, scale) {
    super(name2, "bigint", "PgNumericBigInt");
    this.config.precision = precision;
    this.config.scale = scale;
  }
  /** @internal */
  build(table) {
    return new PgNumericBigInt(
      table,
      this.config
    );
  }
}
class PgNumericBigInt extends PgColumn {
  static [entityKind] = "PgNumericBigInt";
  precision;
  scale;
  constructor(table, config) {
    super(table, config);
    this.precision = config.precision;
    this.scale = config.scale;
  }
  mapFromDriverValue = BigInt;
  mapToDriverValue = String;
  getSQLType() {
    if (this.precision !== void 0 && this.scale !== void 0) {
      return `numeric(${this.precision}, ${this.scale})`;
    } else if (this.precision === void 0) {
      return "numeric";
    } else {
      return `numeric(${this.precision})`;
    }
  }
}
function numeric(a2, b2) {
  const { name: name2, config } = getColumnNameAndConfig(a2, b2);
  const mode = config?.mode;
  return mode === "number" ? new PgNumericNumberBuilder(name2, config?.precision, config?.scale) : mode === "bigint" ? new PgNumericBigIntBuilder(name2, config?.precision, config?.scale) : new PgNumericBuilder(name2, config?.precision, config?.scale);
}
class PgPointTupleBuilder extends PgColumnBuilder {
  static [entityKind] = "PgPointTupleBuilder";
  constructor(name2) {
    super(name2, "array", "PgPointTuple");
  }
  /** @internal */
  build(table) {
    return new PgPointTuple(
      table,
      this.config
    );
  }
}
class PgPointTuple extends PgColumn {
  static [entityKind] = "PgPointTuple";
  getSQLType() {
    return "point";
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      const [x2, y2] = value.slice(1, -1).split(",");
      return [Number.parseFloat(x2), Number.parseFloat(y2)];
    }
    return [value.x, value.y];
  }
  mapToDriverValue(value) {
    return `(${value[0]},${value[1]})`;
  }
}
class PgPointObjectBuilder extends PgColumnBuilder {
  static [entityKind] = "PgPointObjectBuilder";
  constructor(name2) {
    super(name2, "json", "PgPointObject");
  }
  /** @internal */
  build(table) {
    return new PgPointObject(
      table,
      this.config
    );
  }
}
class PgPointObject extends PgColumn {
  static [entityKind] = "PgPointObject";
  getSQLType() {
    return "point";
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      const [x2, y2] = value.slice(1, -1).split(",");
      return { x: Number.parseFloat(x2), y: Number.parseFloat(y2) };
    }
    return value;
  }
  mapToDriverValue(value) {
    return `(${value.x},${value.y})`;
  }
}
function point(a2, b2) {
  const { name: name2, config } = getColumnNameAndConfig(a2, b2);
  if (!config?.mode || config.mode === "tuple") {
    return new PgPointTupleBuilder(name2);
  }
  return new PgPointObjectBuilder(name2);
}
function hexToBytes(hex) {
  const bytes = [];
  for (let c2 = 0; c2 < hex.length; c2 += 2) {
    bytes.push(Number.parseInt(hex.slice(c2, c2 + 2), 16));
  }
  return new Uint8Array(bytes);
}
function bytesToFloat64(bytes, offset) {
  const buffer2 = new ArrayBuffer(8);
  const view = new DataView(buffer2);
  for (let i2 = 0; i2 < 8; i2++) {
    view.setUint8(i2, bytes[offset + i2]);
  }
  return view.getFloat64(0, true);
}
function parseEWKB(hex) {
  const bytes = hexToBytes(hex);
  let offset = 0;
  const byteOrder = bytes[offset];
  offset += 1;
  const view = new DataView(bytes.buffer);
  const geomType = view.getUint32(offset, byteOrder === 1);
  offset += 4;
  if (geomType & 536870912) {
    view.getUint32(offset, byteOrder === 1);
    offset += 4;
  }
  if ((geomType & 65535) === 1) {
    const x2 = bytesToFloat64(bytes, offset);
    offset += 8;
    const y2 = bytesToFloat64(bytes, offset);
    offset += 8;
    return [x2, y2];
  }
  throw new Error("Unsupported geometry type");
}
class PgGeometryBuilder extends PgColumnBuilder {
  static [entityKind] = "PgGeometryBuilder";
  constructor(name2) {
    super(name2, "array", "PgGeometry");
  }
  /** @internal */
  build(table) {
    return new PgGeometry(
      table,
      this.config
    );
  }
}
class PgGeometry extends PgColumn {
  static [entityKind] = "PgGeometry";
  getSQLType() {
    return "geometry(point)";
  }
  mapFromDriverValue(value) {
    return parseEWKB(value);
  }
  mapToDriverValue(value) {
    return `point(${value[0]} ${value[1]})`;
  }
}
class PgGeometryObjectBuilder extends PgColumnBuilder {
  static [entityKind] = "PgGeometryObjectBuilder";
  constructor(name2) {
    super(name2, "json", "PgGeometryObject");
  }
  /** @internal */
  build(table) {
    return new PgGeometryObject(
      table,
      this.config
    );
  }
}
class PgGeometryObject extends PgColumn {
  static [entityKind] = "PgGeometryObject";
  getSQLType() {
    return "geometry(point)";
  }
  mapFromDriverValue(value) {
    const parsed = parseEWKB(value);
    return { x: parsed[0], y: parsed[1] };
  }
  mapToDriverValue(value) {
    return `point(${value.x} ${value.y})`;
  }
}
function geometry(a2, b2) {
  const { name: name2, config } = getColumnNameAndConfig(a2, b2);
  if (!config?.mode || config.mode === "tuple") {
    return new PgGeometryBuilder(name2);
  }
  return new PgGeometryObjectBuilder(name2);
}
class PgRealBuilder extends PgColumnBuilder {
  static [entityKind] = "PgRealBuilder";
  constructor(name2, length) {
    super(name2, "number", "PgReal");
    this.config.length = length;
  }
  /** @internal */
  build(table) {
    return new PgReal(table, this.config);
  }
}
class PgReal extends PgColumn {
  static [entityKind] = "PgReal";
  constructor(table, config) {
    super(table, config);
  }
  getSQLType() {
    return "real";
  }
  mapFromDriverValue = (value) => {
    if (typeof value === "string") {
      return Number.parseFloat(value);
    }
    return value;
  };
}
function real(name2) {
  return new PgRealBuilder(name2 ?? "");
}
class PgSerialBuilder extends PgColumnBuilder {
  static [entityKind] = "PgSerialBuilder";
  constructor(name2) {
    super(name2, "number", "PgSerial");
    this.config.hasDefault = true;
    this.config.notNull = true;
  }
  /** @internal */
  build(table) {
    return new PgSerial(table, this.config);
  }
}
class PgSerial extends PgColumn {
  static [entityKind] = "PgSerial";
  getSQLType() {
    return "serial";
  }
}
function serial(name2) {
  return new PgSerialBuilder(name2 ?? "");
}
class PgSmallIntBuilder extends PgIntColumnBaseBuilder {
  static [entityKind] = "PgSmallIntBuilder";
  constructor(name2) {
    super(name2, "number", "PgSmallInt");
  }
  /** @internal */
  build(table) {
    return new PgSmallInt(table, this.config);
  }
}
class PgSmallInt extends PgColumn {
  static [entityKind] = "PgSmallInt";
  getSQLType() {
    return "smallint";
  }
  mapFromDriverValue = (value) => {
    if (typeof value === "string") {
      return Number(value);
    }
    return value;
  };
}
function smallint(name2) {
  return new PgSmallIntBuilder(name2 ?? "");
}
class PgSmallSerialBuilder extends PgColumnBuilder {
  static [entityKind] = "PgSmallSerialBuilder";
  constructor(name2) {
    super(name2, "number", "PgSmallSerial");
    this.config.hasDefault = true;
    this.config.notNull = true;
  }
  /** @internal */
  build(table) {
    return new PgSmallSerial(
      table,
      this.config
    );
  }
}
class PgSmallSerial extends PgColumn {
  static [entityKind] = "PgSmallSerial";
  getSQLType() {
    return "smallserial";
  }
}
function smallserial(name2) {
  return new PgSmallSerialBuilder(name2 ?? "");
}
class PgTextBuilder extends PgColumnBuilder {
  static [entityKind] = "PgTextBuilder";
  constructor(name2, config) {
    super(name2, "string", "PgText");
    this.config.enumValues = config.enum;
  }
  /** @internal */
  build(table) {
    return new PgText(table, this.config);
  }
}
class PgText extends PgColumn {
  static [entityKind] = "PgText";
  enumValues = this.config.enumValues;
  getSQLType() {
    return "text";
  }
}
function text(a2, b2 = {}) {
  const { name: name2, config } = getColumnNameAndConfig(a2, b2);
  return new PgTextBuilder(name2, config);
}
class PgTimeBuilder extends PgDateColumnBaseBuilder {
  constructor(name2, withTimezone, precision) {
    super(name2, "string", "PgTime");
    this.withTimezone = withTimezone;
    this.precision = precision;
    this.config.withTimezone = withTimezone;
    this.config.precision = precision;
  }
  static [entityKind] = "PgTimeBuilder";
  /** @internal */
  build(table) {
    return new PgTime(table, this.config);
  }
}
class PgTime extends PgColumn {
  static [entityKind] = "PgTime";
  withTimezone;
  precision;
  constructor(table, config) {
    super(table, config);
    this.withTimezone = config.withTimezone;
    this.precision = config.precision;
  }
  getSQLType() {
    const precision = this.precision === void 0 ? "" : `(${this.precision})`;
    return `time${precision}${this.withTimezone ? " with time zone" : ""}`;
  }
}
function time(a2, b2 = {}) {
  const { name: name2, config } = getColumnNameAndConfig(a2, b2);
  return new PgTimeBuilder(name2, config.withTimezone ?? false, config.precision);
}
class PgTimestampBuilder extends PgDateColumnBaseBuilder {
  static [entityKind] = "PgTimestampBuilder";
  constructor(name2, withTimezone, precision) {
    super(name2, "date", "PgTimestamp");
    this.config.withTimezone = withTimezone;
    this.config.precision = precision;
  }
  /** @internal */
  build(table) {
    return new PgTimestamp(table, this.config);
  }
}
class PgTimestamp extends PgColumn {
  static [entityKind] = "PgTimestamp";
  withTimezone;
  precision;
  constructor(table, config) {
    super(table, config);
    this.withTimezone = config.withTimezone;
    this.precision = config.precision;
  }
  getSQLType() {
    const precision = this.precision === void 0 ? "" : ` (${this.precision})`;
    return `timestamp${precision}${this.withTimezone ? " with time zone" : ""}`;
  }
  mapFromDriverValue = (value) => {
    return new Date(this.withTimezone ? value : value + "+0000");
  };
  mapToDriverValue = (value) => {
    return value.toISOString();
  };
}
class PgTimestampStringBuilder extends PgDateColumnBaseBuilder {
  static [entityKind] = "PgTimestampStringBuilder";
  constructor(name2, withTimezone, precision) {
    super(name2, "string", "PgTimestampString");
    this.config.withTimezone = withTimezone;
    this.config.precision = precision;
  }
  /** @internal */
  build(table) {
    return new PgTimestampString(
      table,
      this.config
    );
  }
}
class PgTimestampString extends PgColumn {
  static [entityKind] = "PgTimestampString";
  withTimezone;
  precision;
  constructor(table, config) {
    super(table, config);
    this.withTimezone = config.withTimezone;
    this.precision = config.precision;
  }
  getSQLType() {
    const precision = this.precision === void 0 ? "" : `(${this.precision})`;
    return `timestamp${precision}${this.withTimezone ? " with time zone" : ""}`;
  }
}
function timestamp(a2, b2 = {}) {
  const { name: name2, config } = getColumnNameAndConfig(a2, b2);
  if (config?.mode === "string") {
    return new PgTimestampStringBuilder(name2, config.withTimezone ?? false, config.precision);
  }
  return new PgTimestampBuilder(name2, config?.withTimezone ?? false, config?.precision);
}
class PgUUIDBuilder extends PgColumnBuilder {
  static [entityKind] = "PgUUIDBuilder";
  constructor(name2) {
    super(name2, "string", "PgUUID");
  }
  /**
   * Adds `default gen_random_uuid()` to the column definition.
   */
  defaultRandom() {
    return this.default(sql`gen_random_uuid()`);
  }
  /** @internal */
  build(table) {
    return new PgUUID(table, this.config);
  }
}
class PgUUID extends PgColumn {
  static [entityKind] = "PgUUID";
  getSQLType() {
    return "uuid";
  }
}
function uuid(name2) {
  return new PgUUIDBuilder(name2 ?? "");
}
class PgVarcharBuilder extends PgColumnBuilder {
  static [entityKind] = "PgVarcharBuilder";
  constructor(name2, config) {
    super(name2, "string", "PgVarchar");
    this.config.length = config.length;
    this.config.enumValues = config.enum;
  }
  /** @internal */
  build(table) {
    return new PgVarchar(
      table,
      this.config
    );
  }
}
class PgVarchar extends PgColumn {
  static [entityKind] = "PgVarchar";
  length = this.config.length;
  enumValues = this.config.enumValues;
  getSQLType() {
    return this.length === void 0 ? `varchar` : `varchar(${this.length})`;
  }
}
function varchar(a2, b2 = {}) {
  const { name: name2, config } = getColumnNameAndConfig(a2, b2);
  return new PgVarcharBuilder(name2, config);
}
class PgBinaryVectorBuilder extends PgColumnBuilder {
  static [entityKind] = "PgBinaryVectorBuilder";
  constructor(name2, config) {
    super(name2, "string", "PgBinaryVector");
    this.config.dimensions = config.dimensions;
  }
  /** @internal */
  build(table) {
    return new PgBinaryVector(
      table,
      this.config
    );
  }
}
class PgBinaryVector extends PgColumn {
  static [entityKind] = "PgBinaryVector";
  dimensions = this.config.dimensions;
  getSQLType() {
    return `bit(${this.dimensions})`;
  }
}
function bit(a2, b2) {
  const { name: name2, config } = getColumnNameAndConfig(a2, b2);
  return new PgBinaryVectorBuilder(name2, config);
}
class PgHalfVectorBuilder extends PgColumnBuilder {
  static [entityKind] = "PgHalfVectorBuilder";
  constructor(name2, config) {
    super(name2, "array", "PgHalfVector");
    this.config.dimensions = config.dimensions;
  }
  /** @internal */
  build(table) {
    return new PgHalfVector(
      table,
      this.config
    );
  }
}
class PgHalfVector extends PgColumn {
  static [entityKind] = "PgHalfVector";
  dimensions = this.config.dimensions;
  getSQLType() {
    return `halfvec(${this.dimensions})`;
  }
  mapToDriverValue(value) {
    return JSON.stringify(value);
  }
  mapFromDriverValue(value) {
    return value.slice(1, -1).split(",").map((v2) => Number.parseFloat(v2));
  }
}
function halfvec(a2, b2) {
  const { name: name2, config } = getColumnNameAndConfig(a2, b2);
  return new PgHalfVectorBuilder(name2, config);
}
class PgSparseVectorBuilder extends PgColumnBuilder {
  static [entityKind] = "PgSparseVectorBuilder";
  constructor(name2, config) {
    super(name2, "string", "PgSparseVector");
    this.config.dimensions = config.dimensions;
  }
  /** @internal */
  build(table) {
    return new PgSparseVector(
      table,
      this.config
    );
  }
}
class PgSparseVector extends PgColumn {
  static [entityKind] = "PgSparseVector";
  dimensions = this.config.dimensions;
  getSQLType() {
    return `sparsevec(${this.dimensions})`;
  }
}
function sparsevec(a2, b2) {
  const { name: name2, config } = getColumnNameAndConfig(a2, b2);
  return new PgSparseVectorBuilder(name2, config);
}
class PgVectorBuilder extends PgColumnBuilder {
  static [entityKind] = "PgVectorBuilder";
  constructor(name2, config) {
    super(name2, "array", "PgVector");
    this.config.dimensions = config.dimensions;
  }
  /** @internal */
  build(table) {
    return new PgVector(
      table,
      this.config
    );
  }
}
class PgVector extends PgColumn {
  static [entityKind] = "PgVector";
  dimensions = this.config.dimensions;
  getSQLType() {
    return `vector(${this.dimensions})`;
  }
  mapToDriverValue(value) {
    return JSON.stringify(value);
  }
  mapFromDriverValue(value) {
    return value.slice(1, -1).split(",").map((v2) => Number.parseFloat(v2));
  }
}
function vector(a2, b2) {
  const { name: name2, config } = getColumnNameAndConfig(a2, b2);
  return new PgVectorBuilder(name2, config);
}
class QueryPromise {
  static [entityKind] = "QueryPromise";
  [Symbol.toStringTag] = "QueryPromise";
  catch(onRejected) {
    return this.then(void 0, onRejected);
  }
  finally(onFinally) {
    return this.then(
      (value) => {
        onFinally?.();
        return value;
      },
      (reason) => {
        onFinally?.();
        throw reason;
      }
    );
  }
  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }
}
class SelectionProxyHandler {
  static [entityKind] = "SelectionProxyHandler";
  config;
  constructor(config) {
    this.config = { ...config };
  }
  get(subquery, prop) {
    if (prop === "_") {
      return {
        ...subquery["_"],
        selectedFields: new Proxy(
          subquery._.selectedFields,
          this
        )
      };
    }
    if (prop === ViewBaseConfig) {
      return {
        ...subquery[ViewBaseConfig],
        selectedFields: new Proxy(
          subquery[ViewBaseConfig].selectedFields,
          this
        )
      };
    }
    if (typeof prop === "symbol") {
      return subquery[prop];
    }
    const columns = is(subquery, Subquery) ? subquery._.selectedFields : is(subquery, View) ? subquery[ViewBaseConfig].selectedFields : subquery;
    const value = columns[prop];
    if (is(value, SQL.Aliased)) {
      if (this.config.sqlAliasedBehavior === "sql" && !value.isSelectionField) {
        return value.sql;
      }
      const newValue = value.clone();
      newValue.isSelectionField = true;
      return newValue;
    }
    if (is(value, SQL)) {
      if (this.config.sqlBehavior === "sql") {
        return value;
      }
      throw new Error(
        `You tried to reference "${prop}" field from a subquery, which is a raw SQL field, but it doesn't have an alias declared. Please add an alias to the field using ".as('alias')" method.`
      );
    }
    if (is(value, Column)) {
      if (this.config.alias) {
        return new Proxy(
          value,
          new ColumnAliasProxyHandler(
            new Proxy(
              value.table,
              new TableAliasProxyHandler(this.config.alias, this.config.replaceOriginalName ?? false)
            )
          )
        );
      }
      return value;
    }
    if (typeof value !== "object" || value === null) {
      return value;
    }
    return new Proxy(value, new SelectionProxyHandler(this.config));
  }
}
class PgDeleteBase extends QueryPromise {
  constructor(table, session2, dialect, withList) {
    super();
    this.session = session2;
    this.dialect = dialect;
    this.config = { table, withList };
  }
  static [entityKind] = "PgDelete";
  config;
  /**
   * Adds a `where` clause to the query.
   *
   * Calling this method will delete only those rows that fulfill a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/delete}
   *
   * @param where the `where` clause.
   *
   * @example
   * You can use conditional operators and `sql function` to filter the rows to be deleted.
   *
   * ```ts
   * // Delete all cars with green color
   * await db.delete(cars).where(eq(cars.color, 'green'));
   * // or
   * await db.delete(cars).where(sql`${cars.color} = 'green'`)
   * ```
   *
   * You can logically combine conditional operators with `and()` and `or()` operators:
   *
   * ```ts
   * // Delete all BMW cars with a green color
   * await db.delete(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
   *
   * // Delete all cars with the green or blue color
   * await db.delete(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
   * ```
   */
  where(where) {
    this.config.where = where;
    return this;
  }
  returning(fields = this.config.table[Table.Symbol.Columns]) {
    this.config.returningFields = fields;
    this.config.returning = orderSelectedFields(fields);
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildDeleteQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(name2) {
    return tracer.startActiveSpan("drizzle.prepareQuery", () => {
      return this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), this.config.returning, name2, true);
    });
  }
  prepare(name2) {
    return this._prepare(name2);
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute = (placeholderValues) => {
    return tracer.startActiveSpan("drizzle.operation", () => {
      return this._prepare().execute(placeholderValues, this.authToken);
    });
  };
  /** @internal */
  getSelectedFields() {
    return this.config.returningFields ? new Proxy(
      this.config.returningFields,
      new SelectionProxyHandler({
        alias: getTableName(this.config.table),
        sqlAliasedBehavior: "alias",
        sqlBehavior: "error"
      })
    ) : void 0;
  }
  $dynamic() {
    return this;
  }
}
function toSnakeCase(input) {
  const words = input.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? [];
  return words.map((word) => word.toLowerCase()).join("_");
}
function toCamelCase(input) {
  const words = input.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? [];
  return words.reduce((acc, word, i2) => {
    const formattedWord = i2 === 0 ? word.toLowerCase() : `${word[0].toUpperCase()}${word.slice(1)}`;
    return acc + formattedWord;
  }, "");
}
function noopCase(input) {
  return input;
}
class CasingCache {
  static [entityKind] = "CasingCache";
  /** @internal */
  cache = {};
  cachedTables = {};
  convert;
  constructor(casing) {
    this.convert = casing === "snake_case" ? toSnakeCase : casing === "camelCase" ? toCamelCase : noopCase;
  }
  getColumnCasing(column) {
    if (!column.keyAsName)
      return column.name;
    const schema2 = column.table[Table.Symbol.Schema] ?? "public";
    const tableName = column.table[Table.Symbol.OriginalName];
    const key = `${schema2}.${tableName}.${column.name}`;
    if (!this.cache[key]) {
      this.cacheTable(column.table);
    }
    return this.cache[key];
  }
  cacheTable(table) {
    const schema2 = table[Table.Symbol.Schema] ?? "public";
    const tableName = table[Table.Symbol.OriginalName];
    const tableKey = `${schema2}.${tableName}`;
    if (!this.cachedTables[tableKey]) {
      for (const column of Object.values(table[Table.Symbol.Columns])) {
        const columnKey = `${tableKey}.${column.name}`;
        this.cache[columnKey] = this.convert(column.name);
      }
      this.cachedTables[tableKey] = true;
    }
  }
  clearCache() {
    this.cache = {};
    this.cachedTables = {};
  }
}
class DrizzleError extends Error {
  static [entityKind] = "DrizzleError";
  constructor({ message, cause }) {
    super(message);
    this.name = "DrizzleError";
    this.cause = cause;
  }
}
class TransactionRollbackError extends DrizzleError {
  static [entityKind] = "TransactionRollbackError";
  constructor() {
    super({ message: "Rollback" });
  }
}
function getPgColumnBuilders() {
  return {
    bigint,
    bigserial,
    boolean,
    char,
    cidr,
    customType,
    date,
    doublePrecision,
    inet,
    integer,
    interval,
    json,
    jsonb,
    line,
    macaddr,
    macaddr8,
    numeric,
    point,
    geometry,
    real,
    serial,
    smallint,
    smallserial,
    text,
    time,
    timestamp,
    uuid,
    varchar,
    bit,
    halfvec,
    sparsevec,
    vector
  };
}
const InlineForeignKeys = Symbol.for("drizzle:PgInlineForeignKeys");
const EnableRLS = Symbol.for("drizzle:EnableRLS");
class PgTable extends Table {
  static [entityKind] = "PgTable";
  /** @internal */
  static Symbol = Object.assign({}, Table.Symbol, {
    InlineForeignKeys,
    EnableRLS
  });
  /**@internal */
  [InlineForeignKeys] = [];
  /** @internal */
  [EnableRLS] = false;
  /** @internal */
  [Table.Symbol.ExtraConfigBuilder] = void 0;
  /** @internal */
  [Table.Symbol.ExtraConfigColumns] = {};
}
function pgTableWithSchema(name2, columns, extraConfig, schema2, baseName = name2) {
  const rawTable = new PgTable(name2, schema2, baseName);
  const parsedColumns = typeof columns === "function" ? columns(getPgColumnBuilders()) : columns;
  const builtColumns = Object.fromEntries(
    Object.entries(parsedColumns).map(([name22, colBuilderBase]) => {
      const colBuilder = colBuilderBase;
      colBuilder.setName(name22);
      const column = colBuilder.build(rawTable);
      rawTable[InlineForeignKeys].push(...colBuilder.buildForeignKeys(column, rawTable));
      return [name22, column];
    })
  );
  const builtColumnsForExtraConfig = Object.fromEntries(
    Object.entries(parsedColumns).map(([name22, colBuilderBase]) => {
      const colBuilder = colBuilderBase;
      colBuilder.setName(name22);
      const column = colBuilder.buildExtraConfigColumn(rawTable);
      return [name22, column];
    })
  );
  const table = Object.assign(rawTable, builtColumns);
  table[Table.Symbol.Columns] = builtColumns;
  table[Table.Symbol.ExtraConfigColumns] = builtColumnsForExtraConfig;
  return Object.assign(table, {
    enableRLS: () => {
      table[PgTable.Symbol.EnableRLS] = true;
      return table;
    }
  });
}
const pgTable = (name2, columns, extraConfig) => {
  return pgTableWithSchema(name2, columns, extraConfig, void 0);
};
class PrimaryKeyBuilder {
  static [entityKind] = "PgPrimaryKeyBuilder";
  /** @internal */
  columns;
  /** @internal */
  name;
  constructor(columns, name2) {
    this.columns = columns;
    this.name = name2;
  }
  /** @internal */
  build(table) {
    return new PrimaryKey(table, this.columns, this.name);
  }
}
class PrimaryKey {
  constructor(table, columns, name2) {
    this.table = table;
    this.columns = columns;
    this.name = name2;
  }
  static [entityKind] = "PgPrimaryKey";
  columns;
  name;
  getName() {
    return this.name ?? `${this.table[PgTable.Symbol.Name]}_${this.columns.map((column) => column.name).join("_")}_pk`;
  }
}
function bindIfParam(value, column) {
  if (isDriverValueEncoder(column) && !isSQLWrapper(value) && !is(value, Param) && !is(value, Placeholder) && !is(value, Column) && !is(value, Table) && !is(value, View)) {
    return new Param(value, column);
  }
  return value;
}
const eq = (left, right) => {
  return sql`${left} = ${bindIfParam(right, left)}`;
};
const ne$1 = (left, right) => {
  return sql`${left} <> ${bindIfParam(right, left)}`;
};
function and(...unfilteredConditions) {
  const conditions = unfilteredConditions.filter(
    (c2) => c2 !== void 0
  );
  if (conditions.length === 0) {
    return void 0;
  }
  if (conditions.length === 1) {
    return new SQL(conditions);
  }
  return new SQL([
    new StringChunk("("),
    sql.join(conditions, new StringChunk(" and ")),
    new StringChunk(")")
  ]);
}
function or$1(...unfilteredConditions) {
  const conditions = unfilteredConditions.filter(
    (c2) => c2 !== void 0
  );
  if (conditions.length === 0) {
    return void 0;
  }
  if (conditions.length === 1) {
    return new SQL(conditions);
  }
  return new SQL([
    new StringChunk("("),
    sql.join(conditions, new StringChunk(" or ")),
    new StringChunk(")")
  ]);
}
function not(condition) {
  return sql`not ${condition}`;
}
const gt$1 = (left, right) => {
  return sql`${left} > ${bindIfParam(right, left)}`;
};
const gte = (left, right) => {
  return sql`${left} >= ${bindIfParam(right, left)}`;
};
const lt$1 = (left, right) => {
  return sql`${left} < ${bindIfParam(right, left)}`;
};
const lte = (left, right) => {
  return sql`${left} <= ${bindIfParam(right, left)}`;
};
function inArray(column, values2) {
  if (Array.isArray(values2)) {
    if (values2.length === 0) {
      return sql`false`;
    }
    return sql`${column} in ${values2.map((v2) => bindIfParam(v2, column))}`;
  }
  return sql`${column} in ${bindIfParam(values2, column)}`;
}
function notInArray(column, values2) {
  if (Array.isArray(values2)) {
    if (values2.length === 0) {
      return sql`true`;
    }
    return sql`${column} not in ${values2.map((v2) => bindIfParam(v2, column))}`;
  }
  return sql`${column} not in ${bindIfParam(values2, column)}`;
}
function isNull(value) {
  return sql`${value} is null`;
}
function isNotNull(value) {
  return sql`${value} is not null`;
}
function exists(subquery) {
  return sql`exists ${subquery}`;
}
function notExists(subquery) {
  return sql`not exists ${subquery}`;
}
function between(column, min, max) {
  return sql`${column} between ${bindIfParam(min, column)} and ${bindIfParam(
    max,
    column
  )}`;
}
function notBetween(column, min, max) {
  return sql`${column} not between ${bindIfParam(
    min,
    column
  )} and ${bindIfParam(max, column)}`;
}
function like(column, value) {
  return sql`${column} like ${value}`;
}
function notLike(column, value) {
  return sql`${column} not like ${value}`;
}
function ilike(column, value) {
  return sql`${column} ilike ${value}`;
}
function notIlike(column, value) {
  return sql`${column} not ilike ${value}`;
}
function asc(column) {
  return sql`${column} asc`;
}
function desc(column) {
  return sql`${column} desc`;
}
class Relation {
  constructor(sourceTable, referencedTable, relationName) {
    this.sourceTable = sourceTable;
    this.referencedTable = referencedTable;
    this.relationName = relationName;
    this.referencedTableName = referencedTable[Table.Symbol.Name];
  }
  static [entityKind] = "Relation";
  referencedTableName;
  fieldName;
}
class Relations {
  constructor(table, config) {
    this.table = table;
    this.config = config;
  }
  static [entityKind] = "Relations";
}
class One extends Relation {
  constructor(sourceTable, referencedTable, config, isNullable) {
    super(sourceTable, referencedTable, config?.relationName);
    this.config = config;
    this.isNullable = isNullable;
  }
  static [entityKind] = "One";
  withFieldName(fieldName) {
    const relation = new One(
      this.sourceTable,
      this.referencedTable,
      this.config,
      this.isNullable
    );
    relation.fieldName = fieldName;
    return relation;
  }
}
class Many extends Relation {
  constructor(sourceTable, referencedTable, config) {
    super(sourceTable, referencedTable, config?.relationName);
    this.config = config;
  }
  static [entityKind] = "Many";
  withFieldName(fieldName) {
    const relation = new Many(
      this.sourceTable,
      this.referencedTable,
      this.config
    );
    relation.fieldName = fieldName;
    return relation;
  }
}
function getOperators() {
  return {
    and,
    between,
    eq,
    exists,
    gt: gt$1,
    gte,
    ilike,
    inArray,
    isNull,
    isNotNull,
    like,
    lt: lt$1,
    lte,
    ne: ne$1,
    not,
    notBetween,
    notExists,
    notLike,
    notIlike,
    notInArray,
    or: or$1,
    sql
  };
}
function getOrderByOperators() {
  return {
    sql,
    asc,
    desc
  };
}
function extractTablesRelationalConfig(schema2, configHelpers) {
  if (Object.keys(schema2).length === 1 && "default" in schema2 && !is(schema2["default"], Table)) {
    schema2 = schema2["default"];
  }
  const tableNamesMap = {};
  const relationsBuffer = {};
  const tablesConfig = {};
  for (const [key, value] of Object.entries(schema2)) {
    if (is(value, Table)) {
      const dbName = getTableUniqueName(value);
      const bufferedRelations = relationsBuffer[dbName];
      tableNamesMap[dbName] = key;
      tablesConfig[key] = {
        tsName: key,
        dbName: value[Table.Symbol.Name],
        schema: value[Table.Symbol.Schema],
        columns: value[Table.Symbol.Columns],
        relations: bufferedRelations?.relations ?? {},
        primaryKey: bufferedRelations?.primaryKey ?? []
      };
      for (const column of Object.values(
        value[Table.Symbol.Columns]
      )) {
        if (column.primary) {
          tablesConfig[key].primaryKey.push(column);
        }
      }
      const extraConfig = value[Table.Symbol.ExtraConfigBuilder]?.(value[Table.Symbol.ExtraConfigColumns]);
      if (extraConfig) {
        for (const configEntry of Object.values(extraConfig)) {
          if (is(configEntry, PrimaryKeyBuilder)) {
            tablesConfig[key].primaryKey.push(...configEntry.columns);
          }
        }
      }
    } else if (is(value, Relations)) {
      const dbName = getTableUniqueName(value.table);
      const tableName = tableNamesMap[dbName];
      const relations2 = value.config(
        configHelpers(value.table)
      );
      let primaryKey;
      for (const [relationName, relation] of Object.entries(relations2)) {
        if (tableName) {
          const tableConfig = tablesConfig[tableName];
          tableConfig.relations[relationName] = relation;
        } else {
          if (!(dbName in relationsBuffer)) {
            relationsBuffer[dbName] = {
              relations: {},
              primaryKey
            };
          }
          relationsBuffer[dbName].relations[relationName] = relation;
        }
      }
    }
  }
  return { tables: tablesConfig, tableNamesMap };
}
function createOne(sourceTable) {
  return function one(table, config) {
    return new One(
      sourceTable,
      table,
      config,
      config?.fields.reduce((res, f2) => res && f2.notNull, true) ?? false
    );
  };
}
function createMany(sourceTable) {
  return function many(referencedTable, config) {
    return new Many(sourceTable, referencedTable, config);
  };
}
function normalizeRelation(schema2, tableNamesMap, relation) {
  if (is(relation, One) && relation.config) {
    return {
      fields: relation.config.fields,
      references: relation.config.references
    };
  }
  const referencedTableTsName = tableNamesMap[getTableUniqueName(relation.referencedTable)];
  if (!referencedTableTsName) {
    throw new Error(
      `Table "${relation.referencedTable[Table.Symbol.Name]}" not found in schema`
    );
  }
  const referencedTableConfig = schema2[referencedTableTsName];
  if (!referencedTableConfig) {
    throw new Error(`Table "${referencedTableTsName}" not found in schema`);
  }
  const sourceTable = relation.sourceTable;
  const sourceTableTsName = tableNamesMap[getTableUniqueName(sourceTable)];
  if (!sourceTableTsName) {
    throw new Error(
      `Table "${sourceTable[Table.Symbol.Name]}" not found in schema`
    );
  }
  const reverseRelations = [];
  for (const referencedTableRelation of Object.values(
    referencedTableConfig.relations
  )) {
    if (relation.relationName && relation !== referencedTableRelation && referencedTableRelation.relationName === relation.relationName || !relation.relationName && referencedTableRelation.referencedTable === relation.sourceTable) {
      reverseRelations.push(referencedTableRelation);
    }
  }
  if (reverseRelations.length > 1) {
    throw relation.relationName ? new Error(
      `There are multiple relations with name "${relation.relationName}" in table "${referencedTableTsName}"`
    ) : new Error(
      `There are multiple relations between "${referencedTableTsName}" and "${relation.sourceTable[Table.Symbol.Name]}". Please specify relation name`
    );
  }
  if (reverseRelations[0] && is(reverseRelations[0], One) && reverseRelations[0].config) {
    return {
      fields: reverseRelations[0].config.references,
      references: reverseRelations[0].config.fields
    };
  }
  throw new Error(
    `There is not enough information to infer relation "${sourceTableTsName}.${relation.fieldName}"`
  );
}
function createTableRelationsHelpers(sourceTable) {
  return {
    one: createOne(sourceTable),
    many: createMany(sourceTable)
  };
}
function mapRelationalRow(tablesConfig, tableConfig, row, buildQueryResultSelection, mapColumnValue = (value) => value) {
  const result = {};
  for (const [
    selectionItemIndex,
    selectionItem
  ] of buildQueryResultSelection.entries()) {
    if (selectionItem.isJson) {
      const relation = tableConfig.relations[selectionItem.tsKey];
      const rawSubRows = row[selectionItemIndex];
      const subRows = typeof rawSubRows === "string" ? JSON.parse(rawSubRows) : rawSubRows;
      result[selectionItem.tsKey] = is(relation, One) ? subRows && mapRelationalRow(
        tablesConfig,
        tablesConfig[selectionItem.relationTableTsKey],
        subRows,
        selectionItem.selection,
        mapColumnValue
      ) : subRows.map(
        (subRow) => mapRelationalRow(
          tablesConfig,
          tablesConfig[selectionItem.relationTableTsKey],
          subRow,
          selectionItem.selection,
          mapColumnValue
        )
      );
    } else {
      const value = mapColumnValue(row[selectionItemIndex]);
      const field = selectionItem.field;
      let decoder;
      if (is(field, Column)) {
        decoder = field;
      } else if (is(field, SQL)) {
        decoder = field.decoder;
      } else {
        decoder = field.sql.decoder;
      }
      result[selectionItem.tsKey] = value === null ? null : decoder.mapFromDriverValue(value);
    }
  }
  return result;
}
class PgViewBase extends View {
  static [entityKind] = "PgViewBase";
}
class PgDialect {
  static [entityKind] = "PgDialect";
  /** @internal */
  casing;
  constructor(config) {
    this.casing = new CasingCache(config?.casing);
  }
  async migrate(migrations, session2, config) {
    const migrationsTable = typeof config === "string" ? "__drizzle_migrations" : config.migrationsTable ?? "__drizzle_migrations";
    const migrationsSchema = typeof config === "string" ? "drizzle" : config.migrationsSchema ?? "drizzle";
    const migrationTableCreate = sql`
			CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at bigint
			)
		`;
    await session2.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(migrationsSchema)}`);
    await session2.execute(migrationTableCreate);
    const dbMigrations = await session2.all(
      sql`select id, hash, created_at from ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} order by created_at desc limit 1`
    );
    const lastDbMigration = dbMigrations[0];
    await session2.transaction(async (tx) => {
      for await (const migration of migrations) {
        if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis) {
          for (const stmt of migration.sql) {
            await tx.execute(sql.raw(stmt));
          }
          await tx.execute(
            sql`insert into ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} ("hash", "created_at") values(${migration.hash}, ${migration.folderMillis})`
          );
        }
      }
    });
  }
  escapeName(name2) {
    return `"${name2}"`;
  }
  escapeParam(num) {
    return `$${num + 1}`;
  }
  escapeString(str) {
    return `'${str.replace(/'/g, "''")}'`;
  }
  buildWithCTE(queries) {
    if (!queries?.length)
      return void 0;
    const withSqlChunks = [sql`with `];
    for (const [i2, w2] of queries.entries()) {
      withSqlChunks.push(sql`${sql.identifier(w2._.alias)} as (${w2._.sql})`);
      if (i2 < queries.length - 1) {
        withSqlChunks.push(sql`, `);
      }
    }
    withSqlChunks.push(sql` `);
    return sql.join(withSqlChunks);
  }
  buildDeleteQuery({ table, where, returning, withList }) {
    const withSql = this.buildWithCTE(withList);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
    const whereSql = where ? sql` where ${where}` : void 0;
    return sql`${withSql}delete from ${table}${whereSql}${returningSql}`;
  }
  buildUpdateSet(table, set) {
    const tableColumns = table[Table.Symbol.Columns];
    const columnNames = Object.keys(tableColumns).filter(
      (colName) => set[colName] !== void 0 || tableColumns[colName]?.onUpdateFn !== void 0
    );
    const setSize = columnNames.length;
    return sql.join(columnNames.flatMap((colName, i2) => {
      const col = tableColumns[colName];
      const value = set[colName] ?? sql.param(col.onUpdateFn(), col);
      const res = sql`${sql.identifier(this.casing.getColumnCasing(col))} = ${value}`;
      if (i2 < setSize - 1) {
        return [res, sql.raw(", ")];
      }
      return [res];
    }));
  }
  buildUpdateQuery({ table, set, where, returning, withList, from, joins }) {
    const withSql = this.buildWithCTE(withList);
    const tableName = table[PgTable.Symbol.Name];
    const tableSchema = table[PgTable.Symbol.Schema];
    const origTableName = table[PgTable.Symbol.OriginalName];
    const alias = tableName === origTableName ? void 0 : tableName;
    const tableSql = sql`${tableSchema ? sql`${sql.identifier(tableSchema)}.` : void 0}${sql.identifier(origTableName)}${alias && sql` ${sql.identifier(alias)}`}`;
    const setSql = this.buildUpdateSet(table, set);
    const fromSql = from && sql.join([sql.raw(" from "), this.buildFromTable(from)]);
    const joinsSql = this.buildJoins(joins);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: !from })}` : void 0;
    const whereSql = where ? sql` where ${where}` : void 0;
    return sql`${withSql}update ${tableSql} set ${setSql}${fromSql}${joinsSql}${whereSql}${returningSql}`;
  }
  /**
   * Builds selection SQL with provided fields/expressions
   *
   * Examples:
   *
   * `select <selection> from`
   *
   * `insert ... returning <selection>`
   *
   * If `isSingleTable` is true, then columns won't be prefixed with table name
   */
  buildSelection(fields, { isSingleTable = false } = {}) {
    const columnsLen = fields.length;
    const chunks = fields.flatMap(({ field }, i2) => {
      const chunk = [];
      if (is(field, SQL.Aliased) && field.isSelectionField) {
        chunk.push(sql.identifier(field.fieldAlias));
      } else if (is(field, SQL.Aliased) || is(field, SQL)) {
        const query = is(field, SQL.Aliased) ? field.sql : field;
        if (isSingleTable) {
          chunk.push(
            new SQL(
              query.queryChunks.map((c2) => {
                if (is(c2, PgColumn)) {
                  return sql.identifier(this.casing.getColumnCasing(c2));
                }
                return c2;
              })
            )
          );
        } else {
          chunk.push(query);
        }
        if (is(field, SQL.Aliased)) {
          chunk.push(sql` as ${sql.identifier(field.fieldAlias)}`);
        }
      } else if (is(field, Column)) {
        if (isSingleTable) {
          chunk.push(sql.identifier(this.casing.getColumnCasing(field)));
        } else {
          chunk.push(field);
        }
      }
      if (i2 < columnsLen - 1) {
        chunk.push(sql`, `);
      }
      return chunk;
    });
    return sql.join(chunks);
  }
  buildJoins(joins) {
    if (!joins || joins.length === 0) {
      return void 0;
    }
    const joinsArray = [];
    for (const [index, joinMeta] of joins.entries()) {
      if (index === 0) {
        joinsArray.push(sql` `);
      }
      const table = joinMeta.table;
      const lateralSql = joinMeta.lateral ? sql` lateral` : void 0;
      if (is(table, PgTable)) {
        const tableName = table[PgTable.Symbol.Name];
        const tableSchema = table[PgTable.Symbol.Schema];
        const origTableName = table[PgTable.Symbol.OriginalName];
        const alias = tableName === origTableName ? void 0 : joinMeta.alias;
        joinsArray.push(
          sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${tableSchema ? sql`${sql.identifier(tableSchema)}.` : void 0}${sql.identifier(origTableName)}${alias && sql` ${sql.identifier(alias)}`} on ${joinMeta.on}`
        );
      } else if (is(table, View)) {
        const viewName = table[ViewBaseConfig].name;
        const viewSchema = table[ViewBaseConfig].schema;
        const origViewName = table[ViewBaseConfig].originalName;
        const alias = viewName === origViewName ? void 0 : joinMeta.alias;
        joinsArray.push(
          sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${viewSchema ? sql`${sql.identifier(viewSchema)}.` : void 0}${sql.identifier(origViewName)}${alias && sql` ${sql.identifier(alias)}`} on ${joinMeta.on}`
        );
      } else {
        joinsArray.push(
          sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${table} on ${joinMeta.on}`
        );
      }
      if (index < joins.length - 1) {
        joinsArray.push(sql` `);
      }
    }
    return sql.join(joinsArray);
  }
  buildFromTable(table) {
    if (is(table, Table) && table[Table.Symbol.IsAlias]) {
      let fullName = sql`${sql.identifier(table[Table.Symbol.OriginalName])}`;
      if (table[Table.Symbol.Schema]) {
        fullName = sql`${sql.identifier(table[Table.Symbol.Schema])}.${fullName}`;
      }
      return sql`${fullName} ${sql.identifier(table[Table.Symbol.Name])}`;
    }
    return table;
  }
  buildSelectQuery({
    withList,
    fields,
    fieldsFlat,
    where,
    having,
    table,
    joins,
    orderBy,
    groupBy,
    limit,
    offset,
    lockingClause,
    distinct,
    setOperators
  }) {
    const fieldsList = fieldsFlat ?? orderSelectedFields(fields);
    for (const f2 of fieldsList) {
      if (is(f2.field, Column) && getTableName(f2.field.table) !== (is(table, Subquery) ? table._.alias : is(table, PgViewBase) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : getTableName(table)) && !((table2) => joins?.some(
        ({ alias }) => alias === (table2[Table.Symbol.IsAlias] ? getTableName(table2) : table2[Table.Symbol.BaseName])
      ))(f2.field.table)) {
        const tableName = getTableName(f2.field.table);
        throw new Error(
          `Your "${f2.path.join("->")}" field references a column "${tableName}"."${f2.field.name}", but the table "${tableName}" is not part of the query! Did you forget to join it?`
        );
      }
    }
    const isSingleTable = !joins || joins.length === 0;
    const withSql = this.buildWithCTE(withList);
    let distinctSql;
    if (distinct) {
      distinctSql = distinct === true ? sql` distinct` : sql` distinct on (${sql.join(distinct.on, sql`, `)})`;
    }
    const selection = this.buildSelection(fieldsList, { isSingleTable });
    const tableSql = this.buildFromTable(table);
    const joinsSql = this.buildJoins(joins);
    const whereSql = where ? sql` where ${where}` : void 0;
    const havingSql = having ? sql` having ${having}` : void 0;
    let orderBySql;
    if (orderBy && orderBy.length > 0) {
      orderBySql = sql` order by ${sql.join(orderBy, sql`, `)}`;
    }
    let groupBySql;
    if (groupBy && groupBy.length > 0) {
      groupBySql = sql` group by ${sql.join(groupBy, sql`, `)}`;
    }
    const limitSql = typeof limit === "object" || typeof limit === "number" && limit >= 0 ? sql` limit ${limit}` : void 0;
    const offsetSql = offset ? sql` offset ${offset}` : void 0;
    const lockingClauseSql = sql.empty();
    if (lockingClause) {
      const clauseSql = sql` for ${sql.raw(lockingClause.strength)}`;
      if (lockingClause.config.of) {
        clauseSql.append(
          sql` of ${sql.join(
            Array.isArray(lockingClause.config.of) ? lockingClause.config.of : [lockingClause.config.of],
            sql`, `
          )}`
        );
      }
      if (lockingClause.config.noWait) {
        clauseSql.append(sql` no wait`);
      } else if (lockingClause.config.skipLocked) {
        clauseSql.append(sql` skip locked`);
      }
      lockingClauseSql.append(clauseSql);
    }
    const finalQuery = sql`${withSql}select${distinctSql} ${selection} from ${tableSql}${joinsSql}${whereSql}${groupBySql}${havingSql}${orderBySql}${limitSql}${offsetSql}${lockingClauseSql}`;
    if (setOperators.length > 0) {
      return this.buildSetOperations(finalQuery, setOperators);
    }
    return finalQuery;
  }
  buildSetOperations(leftSelect, setOperators) {
    const [setOperator, ...rest] = setOperators;
    if (!setOperator) {
      throw new Error("Cannot pass undefined values to any set operator");
    }
    if (rest.length === 0) {
      return this.buildSetOperationQuery({ leftSelect, setOperator });
    }
    return this.buildSetOperations(
      this.buildSetOperationQuery({ leftSelect, setOperator }),
      rest
    );
  }
  buildSetOperationQuery({
    leftSelect,
    setOperator: { type, isAll, rightSelect, limit, orderBy, offset }
  }) {
    const leftChunk = sql`(${leftSelect.getSQL()}) `;
    const rightChunk = sql`(${rightSelect.getSQL()})`;
    let orderBySql;
    if (orderBy && orderBy.length > 0) {
      const orderByValues = [];
      for (const singleOrderBy of orderBy) {
        if (is(singleOrderBy, PgColumn)) {
          orderByValues.push(sql.identifier(singleOrderBy.name));
        } else if (is(singleOrderBy, SQL)) {
          for (let i2 = 0; i2 < singleOrderBy.queryChunks.length; i2++) {
            const chunk = singleOrderBy.queryChunks[i2];
            if (is(chunk, PgColumn)) {
              singleOrderBy.queryChunks[i2] = sql.identifier(chunk.name);
            }
          }
          orderByValues.push(sql`${singleOrderBy}`);
        } else {
          orderByValues.push(sql`${singleOrderBy}`);
        }
      }
      orderBySql = sql` order by ${sql.join(orderByValues, sql`, `)} `;
    }
    const limitSql = typeof limit === "object" || typeof limit === "number" && limit >= 0 ? sql` limit ${limit}` : void 0;
    const operatorChunk = sql.raw(`${type} ${isAll ? "all " : ""}`);
    const offsetSql = offset ? sql` offset ${offset}` : void 0;
    return sql`${leftChunk}${operatorChunk}${rightChunk}${orderBySql}${limitSql}${offsetSql}`;
  }
  buildInsertQuery({ table, values: valuesOrSelect, onConflict, returning, withList, select: select2, overridingSystemValue_ }) {
    const valuesSqlList = [];
    const columns = table[Table.Symbol.Columns];
    const colEntries = Object.entries(columns).filter(([_2, col]) => !col.shouldDisableInsert());
    const insertOrder = colEntries.map(
      ([, column]) => sql.identifier(this.casing.getColumnCasing(column))
    );
    if (select2) {
      const select22 = valuesOrSelect;
      if (is(select22, SQL)) {
        valuesSqlList.push(select22);
      } else {
        valuesSqlList.push(select22.getSQL());
      }
    } else {
      const values2 = valuesOrSelect;
      valuesSqlList.push(sql.raw("values "));
      for (const [valueIndex, value] of values2.entries()) {
        const valueList = [];
        for (const [fieldName, col] of colEntries) {
          const colValue = value[fieldName];
          if (colValue === void 0 || is(colValue, Param) && colValue.value === void 0) {
            if (col.defaultFn !== void 0) {
              const defaultFnResult = col.defaultFn();
              const defaultValue = is(defaultFnResult, SQL) ? defaultFnResult : sql.param(defaultFnResult, col);
              valueList.push(defaultValue);
            } else if (!col.default && col.onUpdateFn !== void 0) {
              const onUpdateFnResult = col.onUpdateFn();
              const newValue = is(onUpdateFnResult, SQL) ? onUpdateFnResult : sql.param(onUpdateFnResult, col);
              valueList.push(newValue);
            } else {
              valueList.push(sql`default`);
            }
          } else {
            valueList.push(colValue);
          }
        }
        valuesSqlList.push(valueList);
        if (valueIndex < values2.length - 1) {
          valuesSqlList.push(sql`, `);
        }
      }
    }
    const withSql = this.buildWithCTE(withList);
    const valuesSql = sql.join(valuesSqlList);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
    const onConflictSql = onConflict ? sql` on conflict ${onConflict}` : void 0;
    const overridingSql = overridingSystemValue_ === true ? sql`overriding system value ` : void 0;
    return sql`${withSql}insert into ${table} ${insertOrder} ${overridingSql}${valuesSql}${onConflictSql}${returningSql}`;
  }
  buildRefreshMaterializedViewQuery({ view, concurrently, withNoData }) {
    const concurrentlySql = concurrently ? sql` concurrently` : void 0;
    const withNoDataSql = withNoData ? sql` with no data` : void 0;
    return sql`refresh materialized view${concurrentlySql} ${view}${withNoDataSql}`;
  }
  prepareTyping(encoder) {
    if (is(encoder, PgJsonb) || is(encoder, PgJson)) {
      return "json";
    } else if (is(encoder, PgNumeric)) {
      return "decimal";
    } else if (is(encoder, PgTime)) {
      return "time";
    } else if (is(encoder, PgTimestamp) || is(encoder, PgTimestampString)) {
      return "timestamp";
    } else if (is(encoder, PgDate) || is(encoder, PgDateString)) {
      return "date";
    } else if (is(encoder, PgUUID)) {
      return "uuid";
    } else {
      return "none";
    }
  }
  sqlToQuery(sql2, invokeSource) {
    return sql2.toQuery({
      casing: this.casing,
      escapeName: this.escapeName,
      escapeParam: this.escapeParam,
      escapeString: this.escapeString,
      prepareTyping: this.prepareTyping,
      invokeSource
    });
  }
  // buildRelationalQueryWithPK({
  // 	fullSchema,
  // 	schema,
  // 	tableNamesMap,
  // 	table,
  // 	tableConfig,
  // 	queryConfig: config,
  // 	tableAlias,
  // 	isRoot = false,
  // 	joinOn,
  // }: {
  // 	fullSchema: Record<string, unknown>;
  // 	schema: TablesRelationalConfig;
  // 	tableNamesMap: Record<string, string>;
  // 	table: PgTable;
  // 	tableConfig: TableRelationalConfig;
  // 	queryConfig: true | DBQueryConfig<'many', true>;
  // 	tableAlias: string;
  // 	isRoot?: boolean;
  // 	joinOn?: SQL;
  // }): BuildRelationalQueryResult<PgTable, PgColumn> {
  // 	// For { "<relation>": true }, return a table with selection of all columns
  // 	if (config === true) {
  // 		const selectionEntries = Object.entries(tableConfig.columns);
  // 		const selection: BuildRelationalQueryResult<PgTable, PgColumn>['selection'] = selectionEntries.map((
  // 			[key, value],
  // 		) => ({
  // 			dbKey: value.name,
  // 			tsKey: key,
  // 			field: value as PgColumn,
  // 			relationTableTsKey: undefined,
  // 			isJson: false,
  // 			selection: [],
  // 		}));
  // 		return {
  // 			tableTsKey: tableConfig.tsName,
  // 			sql: table,
  // 			selection,
  // 		};
  // 	}
  // 	// let selection: BuildRelationalQueryResult<PgTable, PgColumn>['selection'] = [];
  // 	// let selectionForBuild = selection;
  // 	const aliasedColumns = Object.fromEntries(
  // 		Object.entries(tableConfig.columns).map(([key, value]) => [key, aliasedTableColumn(value, tableAlias)]),
  // 	);
  // 	const aliasedRelations = Object.fromEntries(
  // 		Object.entries(tableConfig.relations).map(([key, value]) => [key, aliasedRelation(value, tableAlias)]),
  // 	);
  // 	const aliasedFields = Object.assign({}, aliasedColumns, aliasedRelations);
  // 	let where, hasUserDefinedWhere;
  // 	if (config.where) {
  // 		const whereSql = typeof config.where === 'function' ? config.where(aliasedFields, operators) : config.where;
  // 		where = whereSql && mapColumnsInSQLToAlias(whereSql, tableAlias);
  // 		hasUserDefinedWhere = !!where;
  // 	}
  // 	where = and(joinOn, where);
  // 	// const fieldsSelection: { tsKey: string; value: PgColumn | SQL.Aliased; isExtra?: boolean }[] = [];
  // 	let joins: Join[] = [];
  // 	let selectedColumns: string[] = [];
  // 	// Figure out which columns to select
  // 	if (config.columns) {
  // 		let isIncludeMode = false;
  // 		for (const [field, value] of Object.entries(config.columns)) {
  // 			if (value === undefined) {
  // 				continue;
  // 			}
  // 			if (field in tableConfig.columns) {
  // 				if (!isIncludeMode && value === true) {
  // 					isIncludeMode = true;
  // 				}
  // 				selectedColumns.push(field);
  // 			}
  // 		}
  // 		if (selectedColumns.length > 0) {
  // 			selectedColumns = isIncludeMode
  // 				? selectedColumns.filter((c) => config.columns?.[c] === true)
  // 				: Object.keys(tableConfig.columns).filter((key) => !selectedColumns.includes(key));
  // 		}
  // 	} else {
  // 		// Select all columns if selection is not specified
  // 		selectedColumns = Object.keys(tableConfig.columns);
  // 	}
  // 	// for (const field of selectedColumns) {
  // 	// 	const column = tableConfig.columns[field]! as PgColumn;
  // 	// 	fieldsSelection.push({ tsKey: field, value: column });
  // 	// }
  // 	let initiallySelectedRelations: {
  // 		tsKey: string;
  // 		queryConfig: true | DBQueryConfig<'many', false>;
  // 		relation: Relation;
  // 	}[] = [];
  // 	// let selectedRelations: BuildRelationalQueryResult<PgTable, PgColumn>['selection'] = [];
  // 	// Figure out which relations to select
  // 	if (config.with) {
  // 		initiallySelectedRelations = Object.entries(config.with)
  // 			.filter((entry): entry is [typeof entry[0], NonNullable<typeof entry[1]>] => !!entry[1])
  // 			.map(([tsKey, queryConfig]) => ({ tsKey, queryConfig, relation: tableConfig.relations[tsKey]! }));
  // 	}
  // 	const manyRelations = initiallySelectedRelations.filter((r) =>
  // 		is(r.relation, Many)
  // 		&& (schema[tableNamesMap[r.relation.referencedTable[Table.Symbol.Name]]!]?.primaryKey.length ?? 0) > 0
  // 	);
  // 	// If this is the last Many relation (or there are no Many relations), we are on the innermost subquery level
  // 	const isInnermostQuery = manyRelations.length < 2;
  // 	const selectedExtras: {
  // 		tsKey: string;
  // 		value: SQL.Aliased;
  // 	}[] = [];
  // 	// Figure out which extras to select
  // 	if (isInnermostQuery && config.extras) {
  // 		const extras = typeof config.extras === 'function'
  // 			? config.extras(aliasedFields, { sql })
  // 			: config.extras;
  // 		for (const [tsKey, value] of Object.entries(extras)) {
  // 			selectedExtras.push({
  // 				tsKey,
  // 				value: mapColumnsInAliasedSQLToAlias(value, tableAlias),
  // 			});
  // 		}
  // 	}
  // 	// Transform `fieldsSelection` into `selection`
  // 	// `fieldsSelection` shouldn't be used after this point
  // 	// for (const { tsKey, value, isExtra } of fieldsSelection) {
  // 	// 	selection.push({
  // 	// 		dbKey: is(value, SQL.Aliased) ? value.fieldAlias : tableConfig.columns[tsKey]!.name,
  // 	// 		tsKey,
  // 	// 		field: is(value, Column) ? aliasedTableColumn(value, tableAlias) : value,
  // 	// 		relationTableTsKey: undefined,
  // 	// 		isJson: false,
  // 	// 		isExtra,
  // 	// 		selection: [],
  // 	// 	});
  // 	// }
  // 	let orderByOrig = typeof config.orderBy === 'function'
  // 		? config.orderBy(aliasedFields, orderByOperators)
  // 		: config.orderBy ?? [];
  // 	if (!Array.isArray(orderByOrig)) {
  // 		orderByOrig = [orderByOrig];
  // 	}
  // 	const orderBy = orderByOrig.map((orderByValue) => {
  // 		if (is(orderByValue, Column)) {
  // 			return aliasedTableColumn(orderByValue, tableAlias) as PgColumn;
  // 		}
  // 		return mapColumnsInSQLToAlias(orderByValue, tableAlias);
  // 	});
  // 	const limit = isInnermostQuery ? config.limit : undefined;
  // 	const offset = isInnermostQuery ? config.offset : undefined;
  // 	// For non-root queries without additional config except columns, return a table with selection
  // 	if (
  // 		!isRoot
  // 		&& initiallySelectedRelations.length === 0
  // 		&& selectedExtras.length === 0
  // 		&& !where
  // 		&& orderBy.length === 0
  // 		&& limit === undefined
  // 		&& offset === undefined
  // 	) {
  // 		return {
  // 			tableTsKey: tableConfig.tsName,
  // 			sql: table,
  // 			selection: selectedColumns.map((key) => ({
  // 				dbKey: tableConfig.columns[key]!.name,
  // 				tsKey: key,
  // 				field: tableConfig.columns[key] as PgColumn,
  // 				relationTableTsKey: undefined,
  // 				isJson: false,
  // 				selection: [],
  // 			})),
  // 		};
  // 	}
  // 	const selectedRelationsWithoutPK:
  // 	// Process all relations without primary keys, because they need to be joined differently and will all be on the same query level
  // 	for (
  // 		const {
  // 			tsKey: selectedRelationTsKey,
  // 			queryConfig: selectedRelationConfigValue,
  // 			relation,
  // 		} of initiallySelectedRelations
  // 	) {
  // 		const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
  // 		const relationTableName = relation.referencedTable[Table.Symbol.Name];
  // 		const relationTableTsName = tableNamesMap[relationTableName]!;
  // 		const relationTable = schema[relationTableTsName]!;
  // 		if (relationTable.primaryKey.length > 0) {
  // 			continue;
  // 		}
  // 		const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
  // 		const joinOn = and(
  // 			...normalizedRelation.fields.map((field, i) =>
  // 				eq(
  // 					aliasedTableColumn(normalizedRelation.references[i]!, relationTableAlias),
  // 					aliasedTableColumn(field, tableAlias),
  // 				)
  // 			),
  // 		);
  // 		const builtRelation = this.buildRelationalQueryWithoutPK({
  // 			fullSchema,
  // 			schema,
  // 			tableNamesMap,
  // 			table: fullSchema[relationTableTsName] as PgTable,
  // 			tableConfig: schema[relationTableTsName]!,
  // 			queryConfig: selectedRelationConfigValue,
  // 			tableAlias: relationTableAlias,
  // 			joinOn,
  // 			nestedQueryRelation: relation,
  // 		});
  // 		const field = sql`${sql.identifier(relationTableAlias)}.${sql.identifier('data')}`.as(selectedRelationTsKey);
  // 		joins.push({
  // 			on: sql`true`,
  // 			table: new Subquery(builtRelation.sql as SQL, {}, relationTableAlias),
  // 			alias: relationTableAlias,
  // 			joinType: 'left',
  // 			lateral: true,
  // 		});
  // 		selectedRelations.push({
  // 			dbKey: selectedRelationTsKey,
  // 			tsKey: selectedRelationTsKey,
  // 			field,
  // 			relationTableTsKey: relationTableTsName,
  // 			isJson: true,
  // 			selection: builtRelation.selection,
  // 		});
  // 	}
  // 	const oneRelations = initiallySelectedRelations.filter((r): r is typeof r & { relation: One } =>
  // 		is(r.relation, One)
  // 	);
  // 	// Process all One relations with PKs, because they can all be joined on the same level
  // 	for (
  // 		const {
  // 			tsKey: selectedRelationTsKey,
  // 			queryConfig: selectedRelationConfigValue,
  // 			relation,
  // 		} of oneRelations
  // 	) {
  // 		const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
  // 		const relationTableName = relation.referencedTable[Table.Symbol.Name];
  // 		const relationTableTsName = tableNamesMap[relationTableName]!;
  // 		const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
  // 		const relationTable = schema[relationTableTsName]!;
  // 		if (relationTable.primaryKey.length === 0) {
  // 			continue;
  // 		}
  // 		const joinOn = and(
  // 			...normalizedRelation.fields.map((field, i) =>
  // 				eq(
  // 					aliasedTableColumn(normalizedRelation.references[i]!, relationTableAlias),
  // 					aliasedTableColumn(field, tableAlias),
  // 				)
  // 			),
  // 		);
  // 		const builtRelation = this.buildRelationalQueryWithPK({
  // 			fullSchema,
  // 			schema,
  // 			tableNamesMap,
  // 			table: fullSchema[relationTableTsName] as PgTable,
  // 			tableConfig: schema[relationTableTsName]!,
  // 			queryConfig: selectedRelationConfigValue,
  // 			tableAlias: relationTableAlias,
  // 			joinOn,
  // 		});
  // 		const field = sql`case when ${sql.identifier(relationTableAlias)} is null then null else json_build_array(${
  // 			sql.join(
  // 				builtRelation.selection.map(({ field }) =>
  // 					is(field, SQL.Aliased)
  // 						? sql`${sql.identifier(relationTableAlias)}.${sql.identifier(field.fieldAlias)}`
  // 						: is(field, Column)
  // 						? aliasedTableColumn(field, relationTableAlias)
  // 						: field
  // 				),
  // 				sql`, `,
  // 			)
  // 		}) end`.as(selectedRelationTsKey);
  // 		const isLateralJoin = is(builtRelation.sql, SQL);
  // 		joins.push({
  // 			on: isLateralJoin ? sql`true` : joinOn,
  // 			table: is(builtRelation.sql, SQL)
  // 				? new Subquery(builtRelation.sql, {}, relationTableAlias)
  // 				: aliasedTable(builtRelation.sql, relationTableAlias),
  // 			alias: relationTableAlias,
  // 			joinType: 'left',
  // 			lateral: is(builtRelation.sql, SQL),
  // 		});
  // 		selectedRelations.push({
  // 			dbKey: selectedRelationTsKey,
  // 			tsKey: selectedRelationTsKey,
  // 			field,
  // 			relationTableTsKey: relationTableTsName,
  // 			isJson: true,
  // 			selection: builtRelation.selection,
  // 		});
  // 	}
  // 	let distinct: PgSelectConfig['distinct'];
  // 	let tableFrom: PgTable | Subquery = table;
  // 	// Process first Many relation - each one requires a nested subquery
  // 	const manyRelation = manyRelations[0];
  // 	if (manyRelation) {
  // 		const {
  // 			tsKey: selectedRelationTsKey,
  // 			queryConfig: selectedRelationQueryConfig,
  // 			relation,
  // 		} = manyRelation;
  // 		distinct = {
  // 			on: tableConfig.primaryKey.map((c) => aliasedTableColumn(c as PgColumn, tableAlias)),
  // 		};
  // 		const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
  // 		const relationTableName = relation.referencedTable[Table.Symbol.Name];
  // 		const relationTableTsName = tableNamesMap[relationTableName]!;
  // 		const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
  // 		const joinOn = and(
  // 			...normalizedRelation.fields.map((field, i) =>
  // 				eq(
  // 					aliasedTableColumn(normalizedRelation.references[i]!, relationTableAlias),
  // 					aliasedTableColumn(field, tableAlias),
  // 				)
  // 			),
  // 		);
  // 		const builtRelationJoin = this.buildRelationalQueryWithPK({
  // 			fullSchema,
  // 			schema,
  // 			tableNamesMap,
  // 			table: fullSchema[relationTableTsName] as PgTable,
  // 			tableConfig: schema[relationTableTsName]!,
  // 			queryConfig: selectedRelationQueryConfig,
  // 			tableAlias: relationTableAlias,
  // 			joinOn,
  // 		});
  // 		const builtRelationSelectionField = sql`case when ${
  // 			sql.identifier(relationTableAlias)
  // 		} is null then '[]' else json_agg(json_build_array(${
  // 			sql.join(
  // 				builtRelationJoin.selection.map(({ field }) =>
  // 					is(field, SQL.Aliased)
  // 						? sql`${sql.identifier(relationTableAlias)}.${sql.identifier(field.fieldAlias)}`
  // 						: is(field, Column)
  // 						? aliasedTableColumn(field, relationTableAlias)
  // 						: field
  // 				),
  // 				sql`, `,
  // 			)
  // 		})) over (partition by ${sql.join(distinct.on, sql`, `)}) end`.as(selectedRelationTsKey);
  // 		const isLateralJoin = is(builtRelationJoin.sql, SQL);
  // 		joins.push({
  // 			on: isLateralJoin ? sql`true` : joinOn,
  // 			table: isLateralJoin
  // 				? new Subquery(builtRelationJoin.sql as SQL, {}, relationTableAlias)
  // 				: aliasedTable(builtRelationJoin.sql as PgTable, relationTableAlias),
  // 			alias: relationTableAlias,
  // 			joinType: 'left',
  // 			lateral: isLateralJoin,
  // 		});
  // 		// Build the "from" subquery with the remaining Many relations
  // 		const builtTableFrom = this.buildRelationalQueryWithPK({
  // 			fullSchema,
  // 			schema,
  // 			tableNamesMap,
  // 			table,
  // 			tableConfig,
  // 			queryConfig: {
  // 				...config,
  // 				where: undefined,
  // 				orderBy: undefined,
  // 				limit: undefined,
  // 				offset: undefined,
  // 				with: manyRelations.slice(1).reduce<NonNullable<typeof config['with']>>(
  // 					(result, { tsKey, queryConfig: configValue }) => {
  // 						result[tsKey] = configValue;
  // 						return result;
  // 					},
  // 					{},
  // 				),
  // 			},
  // 			tableAlias,
  // 		});
  // 		selectedRelations.push({
  // 			dbKey: selectedRelationTsKey,
  // 			tsKey: selectedRelationTsKey,
  // 			field: builtRelationSelectionField,
  // 			relationTableTsKey: relationTableTsName,
  // 			isJson: true,
  // 			selection: builtRelationJoin.selection,
  // 		});
  // 		// selection = builtTableFrom.selection.map((item) =>
  // 		// 	is(item.field, SQL.Aliased)
  // 		// 		? { ...item, field: sql`${sql.identifier(tableAlias)}.${sql.identifier(item.field.fieldAlias)}` }
  // 		// 		: item
  // 		// );
  // 		// selectionForBuild = [{
  // 		// 	dbKey: '*',
  // 		// 	tsKey: '*',
  // 		// 	field: sql`${sql.identifier(tableAlias)}.*`,
  // 		// 	selection: [],
  // 		// 	isJson: false,
  // 		// 	relationTableTsKey: undefined,
  // 		// }];
  // 		// const newSelectionItem: (typeof selection)[number] = {
  // 		// 	dbKey: selectedRelationTsKey,
  // 		// 	tsKey: selectedRelationTsKey,
  // 		// 	field,
  // 		// 	relationTableTsKey: relationTableTsName,
  // 		// 	isJson: true,
  // 		// 	selection: builtRelationJoin.selection,
  // 		// };
  // 		// selection.push(newSelectionItem);
  // 		// selectionForBuild.push(newSelectionItem);
  // 		tableFrom = is(builtTableFrom.sql, PgTable)
  // 			? builtTableFrom.sql
  // 			: new Subquery(builtTableFrom.sql, {}, tableAlias);
  // 	}
  // 	if (selectedColumns.length === 0 && selectedRelations.length === 0 && selectedExtras.length === 0) {
  // 		throw new DrizzleError(`No fields selected for table "${tableConfig.tsName}" ("${tableAlias}")`);
  // 	}
  // 	let selection: BuildRelationalQueryResult<PgTable, PgColumn>['selection'];
  // 	function prepareSelectedColumns() {
  // 		return selectedColumns.map((key) => ({
  // 			dbKey: tableConfig.columns[key]!.name,
  // 			tsKey: key,
  // 			field: tableConfig.columns[key] as PgColumn,
  // 			relationTableTsKey: undefined,
  // 			isJson: false,
  // 			selection: [],
  // 		}));
  // 	}
  // 	function prepareSelectedExtras() {
  // 		return selectedExtras.map((item) => ({
  // 			dbKey: item.value.fieldAlias,
  // 			tsKey: item.tsKey,
  // 			field: item.value,
  // 			relationTableTsKey: undefined,
  // 			isJson: false,
  // 			selection: [],
  // 		}));
  // 	}
  // 	if (isRoot) {
  // 		selection = [
  // 			...prepareSelectedColumns(),
  // 			...prepareSelectedExtras(),
  // 		];
  // 	}
  // 	if (hasUserDefinedWhere || orderBy.length > 0) {
  // 		tableFrom = new Subquery(
  // 			this.buildSelectQuery({
  // 				table: is(tableFrom, PgTable) ? aliasedTable(tableFrom, tableAlias) : tableFrom,
  // 				fields: {},
  // 				fieldsFlat: selectionForBuild.map(({ field }) => ({
  // 					path: [],
  // 					field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field,
  // 				})),
  // 				joins,
  // 				distinct,
  // 			}),
  // 			{},
  // 			tableAlias,
  // 		);
  // 		selectionForBuild = selection.map((item) =>
  // 			is(item.field, SQL.Aliased)
  // 				? { ...item, field: sql`${sql.identifier(tableAlias)}.${sql.identifier(item.field.fieldAlias)}` }
  // 				: item
  // 		);
  // 		joins = [];
  // 		distinct = undefined;
  // 	}
  // 	const result = this.buildSelectQuery({
  // 		table: is(tableFrom, PgTable) ? aliasedTable(tableFrom, tableAlias) : tableFrom,
  // 		fields: {},
  // 		fieldsFlat: selectionForBuild.map(({ field }) => ({
  // 			path: [],
  // 			field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field,
  // 		})),
  // 		where,
  // 		limit,
  // 		offset,
  // 		joins,
  // 		orderBy,
  // 		distinct,
  // 	});
  // 	return {
  // 		tableTsKey: tableConfig.tsName,
  // 		sql: result,
  // 		selection,
  // 	};
  // }
  buildRelationalQueryWithoutPK({
    fullSchema,
    schema: schema2,
    tableNamesMap,
    table,
    tableConfig,
    queryConfig: config,
    tableAlias,
    nestedQueryRelation,
    joinOn
  }) {
    let selection = [];
    let limit, offset, orderBy = [], where;
    const joins = [];
    if (config === true) {
      const selectionEntries = Object.entries(tableConfig.columns);
      selection = selectionEntries.map(([key, value]) => ({
        dbKey: value.name,
        tsKey: key,
        field: aliasedTableColumn(value, tableAlias),
        relationTableTsKey: void 0,
        isJson: false,
        selection: []
      }));
    } else {
      const aliasedColumns = Object.fromEntries(
        Object.entries(tableConfig.columns).map(([key, value]) => [key, aliasedTableColumn(value, tableAlias)])
      );
      if (config.where) {
        const whereSql = typeof config.where === "function" ? config.where(aliasedColumns, getOperators()) : config.where;
        where = whereSql && mapColumnsInSQLToAlias(whereSql, tableAlias);
      }
      const fieldsSelection = [];
      let selectedColumns = [];
      if (config.columns) {
        let isIncludeMode = false;
        for (const [field, value] of Object.entries(config.columns)) {
          if (value === void 0) {
            continue;
          }
          if (field in tableConfig.columns) {
            if (!isIncludeMode && value === true) {
              isIncludeMode = true;
            }
            selectedColumns.push(field);
          }
        }
        if (selectedColumns.length > 0) {
          selectedColumns = isIncludeMode ? selectedColumns.filter((c2) => config.columns?.[c2] === true) : Object.keys(tableConfig.columns).filter((key) => !selectedColumns.includes(key));
        }
      } else {
        selectedColumns = Object.keys(tableConfig.columns);
      }
      for (const field of selectedColumns) {
        const column = tableConfig.columns[field];
        fieldsSelection.push({ tsKey: field, value: column });
      }
      let selectedRelations = [];
      if (config.with) {
        selectedRelations = Object.entries(config.with).filter((entry) => !!entry[1]).map(([tsKey, queryConfig]) => ({ tsKey, queryConfig, relation: tableConfig.relations[tsKey] }));
      }
      let extras;
      if (config.extras) {
        extras = typeof config.extras === "function" ? config.extras(aliasedColumns, { sql }) : config.extras;
        for (const [tsKey, value] of Object.entries(extras)) {
          fieldsSelection.push({
            tsKey,
            value: mapColumnsInAliasedSQLToAlias(value, tableAlias)
          });
        }
      }
      for (const { tsKey, value } of fieldsSelection) {
        selection.push({
          dbKey: is(value, SQL.Aliased) ? value.fieldAlias : tableConfig.columns[tsKey].name,
          tsKey,
          field: is(value, Column) ? aliasedTableColumn(value, tableAlias) : value,
          relationTableTsKey: void 0,
          isJson: false,
          selection: []
        });
      }
      let orderByOrig = typeof config.orderBy === "function" ? config.orderBy(aliasedColumns, getOrderByOperators()) : config.orderBy ?? [];
      if (!Array.isArray(orderByOrig)) {
        orderByOrig = [orderByOrig];
      }
      orderBy = orderByOrig.map((orderByValue) => {
        if (is(orderByValue, Column)) {
          return aliasedTableColumn(orderByValue, tableAlias);
        }
        return mapColumnsInSQLToAlias(orderByValue, tableAlias);
      });
      limit = config.limit;
      offset = config.offset;
      for (const {
        tsKey: selectedRelationTsKey,
        queryConfig: selectedRelationConfigValue,
        relation
      } of selectedRelations) {
        const normalizedRelation = normalizeRelation(schema2, tableNamesMap, relation);
        const relationTableName = getTableUniqueName(relation.referencedTable);
        const relationTableTsName = tableNamesMap[relationTableName];
        const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
        const joinOn2 = and(
          ...normalizedRelation.fields.map(
            (field2, i2) => eq(
              aliasedTableColumn(normalizedRelation.references[i2], relationTableAlias),
              aliasedTableColumn(field2, tableAlias)
            )
          )
        );
        const builtRelation = this.buildRelationalQueryWithoutPK({
          fullSchema,
          schema: schema2,
          tableNamesMap,
          table: fullSchema[relationTableTsName],
          tableConfig: schema2[relationTableTsName],
          queryConfig: is(relation, One) ? selectedRelationConfigValue === true ? { limit: 1 } : { ...selectedRelationConfigValue, limit: 1 } : selectedRelationConfigValue,
          tableAlias: relationTableAlias,
          joinOn: joinOn2,
          nestedQueryRelation: relation
        });
        const field = sql`${sql.identifier(relationTableAlias)}.${sql.identifier("data")}`.as(selectedRelationTsKey);
        joins.push({
          on: sql`true`,
          table: new Subquery(builtRelation.sql, {}, relationTableAlias),
          alias: relationTableAlias,
          joinType: "left",
          lateral: true
        });
        selection.push({
          dbKey: selectedRelationTsKey,
          tsKey: selectedRelationTsKey,
          field,
          relationTableTsKey: relationTableTsName,
          isJson: true,
          selection: builtRelation.selection
        });
      }
    }
    if (selection.length === 0) {
      throw new DrizzleError({ message: `No fields selected for table "${tableConfig.tsName}" ("${tableAlias}")` });
    }
    let result;
    where = and(joinOn, where);
    if (nestedQueryRelation) {
      let field = sql`json_build_array(${sql.join(
        selection.map(
          ({ field: field2, tsKey, isJson }) => isJson ? sql`${sql.identifier(`${tableAlias}_${tsKey}`)}.${sql.identifier("data")}` : is(field2, SQL.Aliased) ? field2.sql : field2
        ),
        sql`, `
      )})`;
      if (is(nestedQueryRelation, Many)) {
        field = sql`coalesce(json_agg(${field}${orderBy.length > 0 ? sql` order by ${sql.join(orderBy, sql`, `)}` : void 0}), '[]'::json)`;
      }
      const nestedSelection = [{
        dbKey: "data",
        tsKey: "data",
        field: field.as("data"),
        isJson: true,
        relationTableTsKey: tableConfig.tsName,
        selection
      }];
      const needsSubquery = limit !== void 0 || offset !== void 0 || orderBy.length > 0;
      if (needsSubquery) {
        result = this.buildSelectQuery({
          table: aliasedTable(table, tableAlias),
          fields: {},
          fieldsFlat: [{
            path: [],
            field: sql.raw("*")
          }],
          where,
          limit,
          offset,
          orderBy,
          setOperators: []
        });
        where = void 0;
        limit = void 0;
        offset = void 0;
        orderBy = [];
      } else {
        result = aliasedTable(table, tableAlias);
      }
      result = this.buildSelectQuery({
        table: is(result, PgTable) ? result : new Subquery(result, {}, tableAlias),
        fields: {},
        fieldsFlat: nestedSelection.map(({ field: field2 }) => ({
          path: [],
          field: is(field2, Column) ? aliasedTableColumn(field2, tableAlias) : field2
        })),
        joins,
        where,
        limit,
        offset,
        orderBy,
        setOperators: []
      });
    } else {
      result = this.buildSelectQuery({
        table: aliasedTable(table, tableAlias),
        fields: {},
        fieldsFlat: selection.map(({ field }) => ({
          path: [],
          field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field
        })),
        joins,
        where,
        limit,
        offset,
        orderBy,
        setOperators: []
      });
    }
    return {
      tableTsKey: tableConfig.tsName,
      sql: result,
      selection
    };
  }
}
class TypedQueryBuilder {
  static [entityKind] = "TypedQueryBuilder";
  /** @internal */
  getSelectedFields() {
    return this._.selectedFields;
  }
}
class PgSelectBuilder {
  static [entityKind] = "PgSelectBuilder";
  fields;
  session;
  dialect;
  withList = [];
  distinct;
  constructor(config) {
    this.fields = config.fields;
    this.session = config.session;
    this.dialect = config.dialect;
    if (config.withList) {
      this.withList = config.withList;
    }
    this.distinct = config.distinct;
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  /**
   * Specify the table, subquery, or other target that you're
   * building a select query against.
   *
   * {@link https://www.postgresql.org/docs/current/sql-select.html#SQL-FROM | Postgres from documentation}
   */
  from(source) {
    const isPartialSelect = !!this.fields;
    const src = source;
    let fields;
    if (this.fields) {
      fields = this.fields;
    } else if (is(src, Subquery)) {
      fields = Object.fromEntries(
        Object.keys(src._.selectedFields).map((key) => [key, src[key]])
      );
    } else if (is(src, PgViewBase)) {
      fields = src[ViewBaseConfig].selectedFields;
    } else if (is(src, SQL)) {
      fields = {};
    } else {
      fields = getTableColumns(src);
    }
    return new PgSelectBase({
      table: src,
      fields,
      isPartialSelect,
      session: this.session,
      dialect: this.dialect,
      withList: this.withList,
      distinct: this.distinct
    }).setToken(this.authToken);
  }
}
class PgSelectQueryBuilderBase extends TypedQueryBuilder {
  static [entityKind] = "PgSelectQueryBuilder";
  _;
  config;
  joinsNotNullableMap;
  tableName;
  isPartialSelect;
  session;
  dialect;
  constructor({ table, fields, isPartialSelect, session: session2, dialect, withList, distinct }) {
    super();
    this.config = {
      withList,
      table,
      fields: { ...fields },
      distinct,
      setOperators: []
    };
    this.isPartialSelect = isPartialSelect;
    this.session = session2;
    this.dialect = dialect;
    this._ = {
      selectedFields: fields
    };
    this.tableName = getTableLikeName(table);
    this.joinsNotNullableMap = typeof this.tableName === "string" ? { [this.tableName]: true } : {};
  }
  createJoin(joinType) {
    return (table, on2) => {
      const baseTableName = this.tableName;
      const tableName = getTableLikeName(table);
      if (typeof tableName === "string" && this.config.joins?.some((join) => join.alias === tableName)) {
        throw new Error(`Alias "${tableName}" is already used in this query`);
      }
      if (!this.isPartialSelect) {
        if (Object.keys(this.joinsNotNullableMap).length === 1 && typeof baseTableName === "string") {
          this.config.fields = {
            [baseTableName]: this.config.fields
          };
        }
        if (typeof tableName === "string" && !is(table, SQL)) {
          const selection = is(table, Subquery) ? table._.selectedFields : is(table, View) ? table[ViewBaseConfig].selectedFields : table[Table.Symbol.Columns];
          this.config.fields[tableName] = selection;
        }
      }
      if (typeof on2 === "function") {
        on2 = on2(
          new Proxy(
            this.config.fields,
            new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
          )
        );
      }
      if (!this.config.joins) {
        this.config.joins = [];
      }
      this.config.joins.push({ on: on2, table, joinType, alias: tableName });
      if (typeof tableName === "string") {
        switch (joinType) {
          case "left": {
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
          case "right": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false])
            );
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "inner": {
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "full": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false])
            );
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
        }
      }
      return this;
    };
  }
  /**
   * Executes a `left join` operation by adding another table to the current query.
   *
   * Calling this method associates each row of the table with the corresponding row from the joined table, if a match is found. If no matching row exists, it sets all columns of the joined table to null.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#left-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User; pets: Pet | null }[] = await db.select()
   *   .from(users)
   *   .leftJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number; petId: number | null }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .leftJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  leftJoin = this.createJoin("left");
  /**
   * Executes a `right join` operation by adding another table to the current query.
   *
   * Calling this method associates each row of the joined table with the corresponding row from the main table, if a match is found. If no matching row exists, it sets all columns of the main table to null.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#right-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User | null; pets: Pet }[] = await db.select()
   *   .from(users)
   *   .rightJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number | null; petId: number }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .rightJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  rightJoin = this.createJoin("right");
  /**
   * Executes an `inner join` operation, creating a new table by combining rows from two tables that have matching values.
   *
   * Calling this method retrieves rows that have corresponding entries in both joined tables. Rows without matching entries in either table are excluded, resulting in a table that includes only matching pairs.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#inner-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User; pets: Pet }[] = await db.select()
   *   .from(users)
   *   .innerJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number; petId: number }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .innerJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  innerJoin = this.createJoin("inner");
  /**
   * Executes a `full join` operation by combining rows from two tables into a new table.
   *
   * Calling this method retrieves all rows from both main and joined tables, merging rows with matching values and filling in `null` for non-matching columns.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#full-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User | null; pets: Pet | null }[] = await db.select()
   *   .from(users)
   *   .fullJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number | null; petId: number | null }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .fullJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  fullJoin = this.createJoin("full");
  createSetOperator(type, isAll) {
    return (rightSelection) => {
      const rightSelect = typeof rightSelection === "function" ? rightSelection(getPgSetOperators()) : rightSelection;
      if (!haveSameKeys(this.getSelectedFields(), rightSelect.getSelectedFields())) {
        throw new Error(
          "Set operator error (union / intersect / except): selected fields are not the same or are in a different order"
        );
      }
      this.config.setOperators.push({ type, isAll, rightSelect });
      return this;
    };
  }
  /**
   * Adds `union` set operator to the query.
   *
   * Calling this method will combine the result sets of the `select` statements and remove any duplicate rows that appear across them.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#union}
   *
   * @example
   *
   * ```ts
   * // Select all unique names from customers and users tables
   * await db.select({ name: users.name })
   *   .from(users)
   *   .union(
   *     db.select({ name: customers.name }).from(customers)
   *   );
   * // or
   * import { union } from 'drizzle-orm/pg-core'
   *
   * await union(
   *   db.select({ name: users.name }).from(users),
   *   db.select({ name: customers.name }).from(customers)
   * );
   * ```
   */
  union = this.createSetOperator("union", false);
  /**
   * Adds `union all` set operator to the query.
   *
   * Calling this method will combine the result-set of the `select` statements and keep all duplicate rows that appear across them.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#union-all}
   *
   * @example
   *
   * ```ts
   * // Select all transaction ids from both online and in-store sales
   * await db.select({ transaction: onlineSales.transactionId })
   *   .from(onlineSales)
   *   .unionAll(
   *     db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
   *   );
   * // or
   * import { unionAll } from 'drizzle-orm/pg-core'
   *
   * await unionAll(
   *   db.select({ transaction: onlineSales.transactionId }).from(onlineSales),
   *   db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
   * );
   * ```
   */
  unionAll = this.createSetOperator("union", true);
  /**
   * Adds `intersect` set operator to the query.
   *
   * Calling this method will retain only the rows that are present in both result sets and eliminate duplicates.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#intersect}
   *
   * @example
   *
   * ```ts
   * // Select course names that are offered in both departments A and B
   * await db.select({ courseName: depA.courseName })
   *   .from(depA)
   *   .intersect(
   *     db.select({ courseName: depB.courseName }).from(depB)
   *   );
   * // or
   * import { intersect } from 'drizzle-orm/pg-core'
   *
   * await intersect(
   *   db.select({ courseName: depA.courseName }).from(depA),
   *   db.select({ courseName: depB.courseName }).from(depB)
   * );
   * ```
   */
  intersect = this.createSetOperator("intersect", false);
  /**
   * Adds `intersect all` set operator to the query.
   *
   * Calling this method will retain only the rows that are present in both result sets including all duplicates.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#intersect-all}
   *
   * @example
   *
   * ```ts
   * // Select all products and quantities that are ordered by both regular and VIP customers
   * await db.select({
   *   productId: regularCustomerOrders.productId,
   *   quantityOrdered: regularCustomerOrders.quantityOrdered
   * })
   * .from(regularCustomerOrders)
   * .intersectAll(
   *   db.select({
   *     productId: vipCustomerOrders.productId,
   *     quantityOrdered: vipCustomerOrders.quantityOrdered
   *   })
   *   .from(vipCustomerOrders)
   * );
   * // or
   * import { intersectAll } from 'drizzle-orm/pg-core'
   *
   * await intersectAll(
   *   db.select({
   *     productId: regularCustomerOrders.productId,
   *     quantityOrdered: regularCustomerOrders.quantityOrdered
   *   })
   *   .from(regularCustomerOrders),
   *   db.select({
   *     productId: vipCustomerOrders.productId,
   *     quantityOrdered: vipCustomerOrders.quantityOrdered
   *   })
   *   .from(vipCustomerOrders)
   * );
   * ```
   */
  intersectAll = this.createSetOperator("intersect", true);
  /**
   * Adds `except` set operator to the query.
   *
   * Calling this method will retrieve all unique rows from the left query, except for the rows that are present in the result set of the right query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#except}
   *
   * @example
   *
   * ```ts
   * // Select all courses offered in department A but not in department B
   * await db.select({ courseName: depA.courseName })
   *   .from(depA)
   *   .except(
   *     db.select({ courseName: depB.courseName }).from(depB)
   *   );
   * // or
   * import { except } from 'drizzle-orm/pg-core'
   *
   * await except(
   *   db.select({ courseName: depA.courseName }).from(depA),
   *   db.select({ courseName: depB.courseName }).from(depB)
   * );
   * ```
   */
  except = this.createSetOperator("except", false);
  /**
     * Adds `except all` set operator to the query.
     *
     * Calling this method will retrieve all rows from the left query, except for the rows that are present in the result set of the right query.
     *
     * See docs: {@link https://orm.drizzle.team/docs/set-operations#except-all}
     *
     * @example
     *
     * ```ts
     * // Select all products that are ordered by regular customers but not by VIP customers
     * await db.select({
     *   productId: regularCustomerOrders.productId,
     *   quantityOrdered: regularCustomerOrders.quantityOrdered,
     * })
     * .from(regularCustomerOrders)
     * .exceptAll(
     *   db.select({
     *     productId: vipCustomerOrders.productId,
     *     quantityOrdered: vipCustomerOrders.quantityOrdered,
     *   })
     *   .from(vipCustomerOrders)
     * );
     * // or
     * import { exceptAll } from 'drizzle-orm/pg-core'
     
  // -- CommonJS Shims --
  import __cjs_mod__ from 'node:module';
  const __filename = import.meta.filename;
  const __dirname = import.meta.dirname;
  const require = __cjs_mod__.createRequire(import.meta.url);
  *
     * await exceptAll(
     *   db.select({
     *     productId: regularCustomerOrders.productId,
     *     quantityOrdered: regularCustomerOrders.quantityOrdered
     *   })
     *   .from(regularCustomerOrders),
     *   db.select({
     *     productId: vipCustomerOrders.productId,
     *     quantityOrdered: vipCustomerOrders.quantityOrdered
     *   })
     *   .from(vipCustomerOrders)
     * );
     * ```
     */
  exceptAll = this.createSetOperator("except", true);
  /** @internal */
  addSetOperators(setOperators) {
    this.config.setOperators.push(...setOperators);
    return this;
  }
  /**
   * Adds a `where` clause to the query.
   *
   * Calling this method will select only those rows that fulfill a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#filtering}
   *
   * @param where the `where` clause.
   *
   * @example
   * You can use conditional operators and `sql function` to filter the rows to be selected.
   *
   * ```ts
   * // Select all cars with green color
   * await db.select().from(cars).where(eq(cars.color, 'green'));
   * // or
   * await db.select().from(cars).where(sql`${cars.color} = 'green'`)
   * ```
   *
   * You can logically combine conditional operators with `and()` and `or()` operators:
   *
   * ```ts
   * // Select all BMW cars with a green color
   * await db.select().from(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
   *
   * // Select all cars with the green or blue color
   * await db.select().from(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
   * ```
   */
  where(where) {
    if (typeof where === "function") {
      where = where(
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
        )
      );
    }
    this.config.where = where;
    return this;
  }
  /**
   * Adds a `having` clause to the query.
   *
   * Calling this method will select only those rows that fulfill a specified condition. It is typically used with aggregate functions to filter the aggregated data based on a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#aggregations}
   *
   * @param having the `having` clause.
   *
   * @example
   *
   * ```ts
   * // Select all brands with more than one car
   * await db.select({
   * 	brand: cars.brand,
   * 	count: sql<number>`cast(count(${cars.id}) as int)`,
   * })
   *   .from(cars)
   *   .groupBy(cars.brand)
   *   .having(({ count }) => gt(count, 1));
   * ```
   */
  having(having) {
    if (typeof having === "function") {
      having = having(
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
        )
      );
    }
    this.config.having = having;
    return this;
  }
  groupBy(...columns) {
    if (typeof columns[0] === "function") {
      const groupBy = columns[0](
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
        )
      );
      this.config.groupBy = Array.isArray(groupBy) ? groupBy : [groupBy];
    } else {
      this.config.groupBy = columns;
    }
    return this;
  }
  orderBy(...columns) {
    if (typeof columns[0] === "function") {
      const orderBy = columns[0](
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
        )
      );
      const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
      if (this.config.setOperators.length > 0) {
        this.config.setOperators.at(-1).orderBy = orderByArray;
      } else {
        this.config.orderBy = orderByArray;
      }
    } else {
      const orderByArray = columns;
      if (this.config.setOperators.length > 0) {
        this.config.setOperators.at(-1).orderBy = orderByArray;
      } else {
        this.config.orderBy = orderByArray;
      }
    }
    return this;
  }
  /**
   * Adds a `limit` clause to the query.
   *
   * Calling this method will set the maximum number of rows that will be returned by this query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
   *
   * @param limit the `limit` clause.
   *
   * @example
   *
   * ```ts
   * // Get the first 10 people from this query.
   * await db.select().from(people).limit(10);
   * ```
   */
  limit(limit) {
    if (this.config.setOperators.length > 0) {
      this.config.setOperators.at(-1).limit = limit;
    } else {
      this.config.limit = limit;
    }
    return this;
  }
  /**
   * Adds an `offset` clause to the query.
   *
   * Calling this method will skip a number of rows when returning results from this query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
   *
   * @param offset the `offset` clause.
   *
   * @example
   *
   * ```ts
   * // Get the 10th-20th people from this query.
   * await db.select().from(people).offset(10).limit(10);
   * ```
   */
  offset(offset) {
    if (this.config.setOperators.length > 0) {
      this.config.setOperators.at(-1).offset = offset;
    } else {
      this.config.offset = offset;
    }
    return this;
  }
  /**
   * Adds a `for` clause to the query.
   *
   * Calling this method will specify a lock strength for this query that controls how strictly it acquires exclusive access to the rows being queried.
   *
   * See docs: {@link https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE}
   *
   * @param strength the lock strength.
   * @param config the lock configuration.
   */
  for(strength, config = {}) {
    this.config.lockingClause = { strength, config };
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildSelectQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  as(alias) {
    return new Proxy(
      new Subquery(this.getSQL(), this.config.fields, alias),
      new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
    );
  }
  /** @internal */
  getSelectedFields() {
    return new Proxy(
      this.config.fields,
      new SelectionProxyHandler({ alias: this.tableName, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
    );
  }
  $dynamic() {
    return this;
  }
}
class PgSelectBase extends PgSelectQueryBuilderBase {
  static [entityKind] = "PgSelect";
  /** @internal */
  _prepare(name2) {
    const { session: session2, config, dialect, joinsNotNullableMap, authToken } = this;
    if (!session2) {
      throw new Error("Cannot execute a query on a query builder. Please use a database instance instead.");
    }
    return tracer.startActiveSpan("drizzle.prepareQuery", () => {
      const fieldsList = orderSelectedFields(config.fields);
      const query = session2.prepareQuery(dialect.sqlToQuery(this.getSQL()), fieldsList, name2, true);
      query.joinsNotNullableMap = joinsNotNullableMap;
      return query.setToken(authToken);
    });
  }
  /**
   * Create a prepared statement for this query. This allows
   * the database to remember this query for the given session
   * and call it by name, rather than specifying the full query.
   *
   * {@link https://www.postgresql.org/docs/current/sql-prepare.html | Postgres prepare documentation}
   */
  prepare(name2) {
    return this._prepare(name2);
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute = (placeholderValues) => {
    return tracer.startActiveSpan("drizzle.operation", () => {
      return this._prepare().execute(placeholderValues, this.authToken);
    });
  };
}
applyMixins(PgSelectBase, [QueryPromise]);
function createSetOperator(type, isAll) {
  return (leftSelect, rightSelect, ...restSelects) => {
    const setOperators = [rightSelect, ...restSelects].map((select2) => ({
      type,
      isAll,
      rightSelect: select2
    }));
    for (const setOperator of setOperators) {
      if (!haveSameKeys(leftSelect.getSelectedFields(), setOperator.rightSelect.getSelectedFields())) {
        throw new Error(
          "Set operator error (union / intersect / except): selected fields are not the same or are in a different order"
        );
      }
    }
    return leftSelect.addSetOperators(setOperators);
  };
}
const getPgSetOperators = () => ({
  union,
  unionAll,
  intersect,
  intersectAll,
  except,
  exceptAll
});
const union = createSetOperator("union", false);
const unionAll = createSetOperator("union", true);
const intersect = createSetOperator("intersect", false);
const intersectAll = createSetOperator("intersect", true);
const except = createSetOperator("except", false);
const exceptAll = createSetOperator("except", true);
class QueryBuilder {
  static [entityKind] = "PgQueryBuilder";
  dialect;
  dialectConfig;
  constructor(dialect) {
    this.dialect = is(dialect, PgDialect) ? dialect : void 0;
    this.dialectConfig = is(dialect, PgDialect) ? void 0 : dialect;
  }
  $with = (alias, selection) => {
    const queryBuilder = this;
    const as = (qb) => {
      if (typeof qb === "function") {
        qb = qb(queryBuilder);
      }
      return new Proxy(
        new WithSubquery(
          qb.getSQL(),
          selection ?? ("getSelectedFields" in qb ? qb.getSelectedFields() ?? {} : {}),
          alias,
          true
        ),
        new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
      );
    };
    return { as };
  };
  with(...queries) {
    const self2 = this;
    function select2(fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: void 0,
        dialect: self2.getDialect(),
        withList: queries
      });
    }
    function selectDistinct(fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: void 0,
        dialect: self2.getDialect(),
        distinct: true
      });
    }
    function selectDistinctOn(on2, fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: void 0,
        dialect: self2.getDialect(),
        distinct: { on: on2 }
      });
    }
    return { select: select2, selectDistinct, selectDistinctOn };
  }
  select(fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: void 0,
      dialect: this.getDialect()
    });
  }
  selectDistinct(fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: void 0,
      dialect: this.getDialect(),
      distinct: true
    });
  }
  selectDistinctOn(on2, fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: void 0,
      dialect: this.getDialect(),
      distinct: { on: on2 }
    });
  }
  // Lazy load dialect to avoid circular dependency
  getDialect() {
    if (!this.dialect) {
      this.dialect = new PgDialect(this.dialectConfig);
    }
    return this.dialect;
  }
}
class PgInsertBuilder {
  constructor(table, session2, dialect, withList, overridingSystemValue_) {
    this.table = table;
    this.session = session2;
    this.dialect = dialect;
    this.withList = withList;
    this.overridingSystemValue_ = overridingSystemValue_;
  }
  static [entityKind] = "PgInsertBuilder";
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  overridingSystemValue() {
    this.overridingSystemValue_ = true;
    return this;
  }
  values(values2) {
    values2 = Array.isArray(values2) ? values2 : [values2];
    if (values2.length === 0) {
      throw new Error("values() must be called with at least one value");
    }
    const mappedValues = values2.map((entry) => {
      const result = {};
      const cols = this.table[Table.Symbol.Columns];
      for (const colKey of Object.keys(entry)) {
        const colValue = entry[colKey];
        result[colKey] = is(colValue, SQL) ? colValue : new Param(colValue, cols[colKey]);
      }
      return result;
    });
    return new PgInsertBase(
      this.table,
      mappedValues,
      this.session,
      this.dialect,
      this.withList,
      false,
      this.overridingSystemValue_
    ).setToken(this.authToken);
  }
  select(selectQuery) {
    const select2 = typeof selectQuery === "function" ? selectQuery(new QueryBuilder()) : selectQuery;
    if (!is(select2, SQL) && !haveSameKeys(this.table[Columns], select2._.selectedFields)) {
      throw new Error(
        "Insert select error: selected fields are not the same or are in a different order compared to the table definition"
      );
    }
    return new PgInsertBase(this.table, select2, this.session, this.dialect, this.withList, true);
  }
}
class PgInsertBase extends QueryPromise {
  constructor(table, values2, session2, dialect, withList, select2, overridingSystemValue_) {
    super();
    this.session = session2;
    this.dialect = dialect;
    this.config = { table, values: values2, withList, select: select2, overridingSystemValue_ };
  }
  static [entityKind] = "PgInsert";
  config;
  returning(fields = this.config.table[Table.Symbol.Columns]) {
    this.config.returningFields = fields;
    this.config.returning = orderSelectedFields(fields);
    return this;
  }
  /**
   * Adds an `on conflict do nothing` clause to the query.
   *
   * Calling this method simply avoids inserting a row as its alternative action.
   *
   * See docs: {@link https://orm.drizzle.team/docs/insert#on-conflict-do-nothing}
   *
   * @param config The `target` and `where` clauses.
   *
   * @example
   * ```ts
   * // Insert one row and cancel the insert if there's a conflict
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoNothing();
   *
   * // Explicitly specify conflict target
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoNothing({ target: cars.id });
   * ```
   */
  onConflictDoNothing(config = {}) {
    if (config.target === void 0) {
      this.config.onConflict = sql`do nothing`;
    } else {
      let targetColumn = "";
      targetColumn = Array.isArray(config.target) ? config.target.map((it2) => this.dialect.escapeName(this.dialect.casing.getColumnCasing(it2))).join(",") : this.dialect.escapeName(this.dialect.casing.getColumnCasing(config.target));
      const whereSql = config.where ? sql` where ${config.where}` : void 0;
      this.config.onConflict = sql`(${sql.raw(targetColumn)})${whereSql} do nothing`;
    }
    return this;
  }
  /**
   * Adds an `on conflict do update` clause to the query.
   *
   * Calling this method will update the existing row that conflicts with the row proposed for insertion as its alternative action.
   *
   * See docs: {@link https://orm.drizzle.team/docs/insert#upserts-and-conflicts}
   *
   * @param config The `target`, `set` and `where` clauses.
   *
   * @example
   * ```ts
   * // Update the row if there's a conflict
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoUpdate({
   *     target: cars.id,
   *     set: { brand: 'Porsche' }
   *   });
   *
   * // Upsert with 'where' clause
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoUpdate({
   *     target: cars.id,
   *     set: { brand: 'newBMW' },
   *     targetWhere: sql`${cars.createdAt} > '2023-01-01'::date`,
   *   });
   * ```
   */
  onConflictDoUpdate(config) {
    if (config.where && (config.targetWhere || config.setWhere)) {
      throw new Error(
        'You cannot use both "where" and "targetWhere"/"setWhere" at the same time - "where" is deprecated, use "targetWhere" or "setWhere" instead.'
      );
    }
    const whereSql = config.where ? sql` where ${config.where}` : void 0;
    const targetWhereSql = config.targetWhere ? sql` where ${config.targetWhere}` : void 0;
    const setWhereSql = config.setWhere ? sql` where ${config.setWhere}` : void 0;
    const setSql = this.dialect.buildUpdateSet(this.config.table, mapUpdateSet(this.config.table, config.set));
    let targetColumn = "";
    targetColumn = Array.isArray(config.target) ? config.target.map((it2) => this.dialect.escapeName(this.dialect.casing.getColumnCasing(it2))).join(",") : this.dialect.escapeName(this.dialect.casing.getColumnCasing(config.target));
    this.config.onConflict = sql`(${sql.raw(targetColumn)})${targetWhereSql} do update set ${setSql}${whereSql}${setWhereSql}`;
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildInsertQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(name2) {
    return tracer.startActiveSpan("drizzle.prepareQuery", () => {
      return this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), this.config.returning, name2, true);
    });
  }
  prepare(name2) {
    return this._prepare(name2);
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute = (placeholderValues) => {
    return tracer.startActiveSpan("drizzle.operation", () => {
      return this._prepare().execute(placeholderValues, this.authToken);
    });
  };
  /** @internal */
  getSelectedFields() {
    return this.config.returningFields ? new Proxy(
      this.config.returningFields,
      new SelectionProxyHandler({
        alias: getTableName(this.config.table),
        sqlAliasedBehavior: "alias",
        sqlBehavior: "error"
      })
    ) : void 0;
  }
  $dynamic() {
    return this;
  }
}
class PgRefreshMaterializedView extends QueryPromise {
  constructor(view, session2, dialect) {
    super();
    this.session = session2;
    this.dialect = dialect;
    this.config = { view };
  }
  static [entityKind] = "PgRefreshMaterializedView";
  config;
  concurrently() {
    if (this.config.withNoData !== void 0) {
      throw new Error("Cannot use concurrently and withNoData together");
    }
    this.config.concurrently = true;
    return this;
  }
  withNoData() {
    if (this.config.concurrently !== void 0) {
      throw new Error("Cannot use concurrently and withNoData together");
    }
    this.config.withNoData = true;
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildRefreshMaterializedViewQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(name2) {
    return tracer.startActiveSpan("drizzle.prepareQuery", () => {
      return this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), void 0, name2, true);
    });
  }
  prepare(name2) {
    return this._prepare(name2);
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute = (placeholderValues) => {
    return tracer.startActiveSpan("drizzle.operation", () => {
      return this._prepare().execute(placeholderValues, this.authToken);
    });
  };
}
class PgUpdateBuilder {
  constructor(table, session2, dialect, withList) {
    this.table = table;
    this.session = session2;
    this.dialect = dialect;
    this.withList = withList;
  }
  static [entityKind] = "PgUpdateBuilder";
  authToken;
  setToken(token) {
    this.authToken = token;
    return this;
  }
  set(values2) {
    return new PgUpdateBase(
      this.table,
      mapUpdateSet(this.table, values2),
      this.session,
      this.dialect,
      this.withList
    ).setToken(this.authToken);
  }
}
class PgUpdateBase extends QueryPromise {
  constructor(table, set, session2, dialect, withList) {
    super();
    this.session = session2;
    this.dialect = dialect;
    this.config = { set, table, withList, joins: [] };
    this.tableName = getTableLikeName(table);
    this.joinsNotNullableMap = typeof this.tableName === "string" ? { [this.tableName]: true } : {};
  }
  static [entityKind] = "PgUpdate";
  config;
  tableName;
  joinsNotNullableMap;
  from(source) {
    const src = source;
    const tableName = getTableLikeName(src);
    if (typeof tableName === "string") {
      this.joinsNotNullableMap[tableName] = true;
    }
    this.config.from = src;
    return this;
  }
  getTableLikeFields(table) {
    if (is(table, PgTable)) {
      return table[Table.Symbol.Columns];
    } else if (is(table, Subquery)) {
      return table._.selectedFields;
    }
    return table[ViewBaseConfig].selectedFields;
  }
  createJoin(joinType) {
    return (table, on2) => {
      const tableName = getTableLikeName(table);
      if (typeof tableName === "string" && this.config.joins.some((join) => join.alias === tableName)) {
        throw new Error(`Alias "${tableName}" is already used in this query`);
      }
      if (typeof on2 === "function") {
        const from = this.config.from && !is(this.config.from, SQL) ? this.getTableLikeFields(this.config.from) : void 0;
        on2 = on2(
          new Proxy(
            this.config.table[Table.Symbol.Columns],
            new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
          ),
          from && new Proxy(
            from,
            new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
          )
        );
      }
      this.config.joins.push({ on: on2, table, joinType, alias: tableName });
      if (typeof tableName === "string") {
        switch (joinType) {
          case "left": {
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
          case "right": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false])
            );
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "inner": {
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "full": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false])
            );
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
        }
      }
      return this;
    };
  }
  leftJoin = this.createJoin("left");
  rightJoin = this.createJoin("right");
  innerJoin = this.createJoin("inner");
  fullJoin = this.createJoin("full");
  /**
   * Adds a 'where' clause to the query.
   *
   * Calling this method will update only those rows that fulfill a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/update}
   *
   * @param where the 'where' clause.
   *
   * @example
   * You can use conditional operators and `sql function` to filter the rows to be updated.
   *
   * ```ts
   * // Update all cars with green color
   * await db.update(cars).set({ color: 'red' })
   *   .where(eq(cars.color, 'green'));
   * // or
   * await db.update(cars).set({ color: 'red' })
   *   .where(sql`${cars.color} = 'green'`)
   * ```
   *
   * You can logically combine conditional operators with `and()` and `or()` operators:
   *
   * ```ts
   * // Update all BMW cars with a green color
   * await db.update(cars).set({ color: 'red' })
   *   .where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
   *
   * // Update all cars with the green or blue color
   * await db.update(cars).set({ color: 'red' })
   *   .where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
   * ```
   */
  where(where) {
    this.config.where = where;
    return this;
  }
  returning(fields) {
    if (!fields) {
      fields = Object.assign({}, this.config.table[Table.Symbol.Columns]);
      if (this.config.from) {
        const tableName = getTableLikeName(this.config.from);
        if (typeof tableName === "string" && this.config.from && !is(this.config.from, SQL)) {
          const fromFields = this.getTableLikeFields(this.config.from);
          fields[tableName] = fromFields;
        }
        for (const join of this.config.joins) {
          const tableName2 = getTableLikeName(join.table);
          if (typeof tableName2 === "string" && !is(join.table, SQL)) {
            const fromFields = this.getTableLikeFields(join.table);
            fields[tableName2] = fromFields;
          }
        }
      }
    }
    this.config.returningFields = fields;
    this.config.returning = orderSelectedFields(fields);
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildUpdateQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(name2) {
    const query = this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), this.config.returning, name2, true);
    query.joinsNotNullableMap = this.joinsNotNullableMap;
    return query;
  }
  prepare(name2) {
    return this._prepare(name2);
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute = (placeholderValues) => {
    return this._prepare().execute(placeholderValues, this.authToken);
  };
  /** @internal */
  getSelectedFields() {
    return this.config.returningFields ? new Proxy(
      this.config.returningFields,
      new SelectionProxyHandler({
        alias: getTableName(this.config.table),
        sqlAliasedBehavior: "alias",
        sqlBehavior: "error"
      })
    ) : void 0;
  }
  $dynamic() {
    return this;
  }
}
class PgCountBuilder extends SQL {
  constructor(params) {
    super(PgCountBuilder.buildEmbeddedCount(params.source, params.filters).queryChunks);
    this.params = params;
    this.mapWith(Number);
    this.session = params.session;
    this.sql = PgCountBuilder.buildCount(
      params.source,
      params.filters
    );
  }
  sql;
  token;
  static [entityKind] = "PgCountBuilder";
  [Symbol.toStringTag] = "PgCountBuilder";
  session;
  static buildEmbeddedCount(source, filters) {
    return sql`(select count(*) from ${source}${sql.raw(" where ").if(filters)}${filters})`;
  }
  static buildCount(source, filters) {
    return sql`select count(*) as count from ${source}${sql.raw(" where ").if(filters)}${filters};`;
  }
  /** @intrnal */
  setToken(token) {
    this.token = token;
    return this;
  }
  then(onfulfilled, onrejected) {
    return Promise.resolve(this.session.count(this.sql, this.token)).then(
      onfulfilled,
      onrejected
    );
  }
  catch(onRejected) {
    return this.then(void 0, onRejected);
  }
  finally(onFinally) {
    return this.then(
      (value) => {
        onFinally?.();
        return value;
      },
      (reason) => {
        onFinally?.();
        throw reason;
      }
    );
  }
}
class RelationalQueryBuilder {
  constructor(fullSchema, schema2, tableNamesMap, table, tableConfig, dialect, session2) {
    this.fullSchema = fullSchema;
    this.schema = schema2;
    this.tableNamesMap = tableNamesMap;
    this.table = table;
    this.tableConfig = tableConfig;
    this.dialect = dialect;
    this.session = session2;
  }
  static [entityKind] = "PgRelationalQueryBuilder";
  findMany(config) {
    return new PgRelationalQuery(
      this.fullSchema,
      this.schema,
      this.tableNamesMap,
      this.table,
      this.tableConfig,
      this.dialect,
      this.session,
      config ? config : {},
      "many"
    );
  }
  findFirst(config) {
    return new PgRelationalQuery(
      this.fullSchema,
      this.schema,
      this.tableNamesMap,
      this.table,
      this.tableConfig,
      this.dialect,
      this.session,
      config ? { ...config, limit: 1 } : { limit: 1 },
      "first"
    );
  }
}
class PgRelationalQuery extends QueryPromise {
  constructor(fullSchema, schema2, tableNamesMap, table, tableConfig, dialect, session2, config, mode) {
    super();
    this.fullSchema = fullSchema;
    this.schema = schema2;
    this.tableNamesMap = tableNamesMap;
    this.table = table;
    this.tableConfig = tableConfig;
    this.dialect = dialect;
    this.session = session2;
    this.config = config;
    this.mode = mode;
  }
  static [entityKind] = "PgRelationalQuery";
  /** @internal */
  _prepare(name2) {
    return tracer.startActiveSpan("drizzle.prepareQuery", () => {
      const { query, builtQuery } = this._toSQL();
      return this.session.prepareQuery(
        builtQuery,
        void 0,
        name2,
        true,
        (rawRows, mapColumnValue) => {
          const rows = rawRows.map(
            (row) => mapRelationalRow(this.schema, this.tableConfig, row, query.selection, mapColumnValue)
          );
          if (this.mode === "first") {
            return rows[0];
          }
          return rows;
        }
      );
    });
  }
  prepare(name2) {
    return this._prepare(name2);
  }
  _getQuery() {
    return this.dialect.buildRelationalQueryWithoutPK({
      fullSchema: this.fullSchema,
      schema: this.schema,
      tableNamesMap: this.tableNamesMap,
      table: this.table,
      tableConfig: this.tableConfig,
      queryConfig: this.config,
      tableAlias: this.tableConfig.tsName
    });
  }
  /** @internal */
  getSQL() {
    return this._getQuery().sql;
  }
  _toSQL() {
    const query = this._getQuery();
    const builtQuery = this.dialect.sqlToQuery(query.sql);
    return { query, builtQuery };
  }
  toSQL() {
    return this._toSQL().builtQuery;
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute() {
    return tracer.startActiveSpan("drizzle.operation", () => {
      return this._prepare().execute(void 0, this.authToken);
    });
  }
}
class PgRaw extends QueryPromise {
  constructor(execute, sql2, query, mapBatchResult) {
    super();
    this.execute = execute;
    this.sql = sql2;
    this.query = query;
    this.mapBatchResult = mapBatchResult;
  }
  static [entityKind] = "PgRaw";
  /** @internal */
  getSQL() {
    return this.sql;
  }
  getQuery() {
    return this.query;
  }
  mapResult(result, isFromBatch) {
    return isFromBatch ? this.mapBatchResult(result) : result;
  }
  _prepare() {
    return this;
  }
  /** @internal */
  isResponseInArrayMode() {
    return false;
  }
}
class PgDatabase {
  constructor(dialect, session2, schema2) {
    this.dialect = dialect;
    this.session = session2;
    this._ = schema2 ? {
      schema: schema2.schema,
      fullSchema: schema2.fullSchema,
      tableNamesMap: schema2.tableNamesMap,
      session: session2
    } : {
      schema: void 0,
      fullSchema: {},
      tableNamesMap: {},
      session: session2
    };
    this.query = {};
    if (this._.schema) {
      for (const [tableName, columns] of Object.entries(this._.schema)) {
        this.query[tableName] = new RelationalQueryBuilder(
          schema2.fullSchema,
          this._.schema,
          this._.tableNamesMap,
          schema2.fullSchema[tableName],
          columns,
          dialect,
          session2
        );
      }
    }
  }
  static [entityKind] = "PgDatabase";
  query;
  /**
   * Creates a subquery that defines a temporary named result set as a CTE.
   *
   * It is useful for breaking down complex queries into simpler parts and for reusing the result set in subsequent parts of the query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
   *
   * @param alias The alias for the subquery.
   *
   * Failure to provide an alias will result in a DrizzleTypeError, preventing the subquery from being referenced in other queries.
   *
   * @example
   *
   * ```ts
   * // Create a subquery with alias 'sq' and use it in the select query
   * const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
   *
   * const result = await db.with(sq).select().from(sq);
   * ```
   *
   * To select arbitrary SQL values as fields in a CTE and reference them in other CTEs or in the main query, you need to add aliases to them:
   *
   * ```ts
   * // Select an arbitrary SQL value as a field in a CTE and reference it in the main query
   * const sq = db.$with('sq').as(db.select({
   *   name: sql<string>`upper(${users.name})`.as('name'),
   * })
   * .from(users));
   *
   * const result = await db.with(sq).select({ name: sq.name }).from(sq);
   * ```
   */
  $with = (alias, selection) => {
    const self2 = this;
    const as = (qb) => {
      if (typeof qb === "function") {
        qb = qb(new QueryBuilder(self2.dialect));
      }
      return new Proxy(
        new WithSubquery(
          qb.getSQL(),
          selection ?? ("getSelectedFields" in qb ? qb.getSelectedFields() ?? {} : {}),
          alias,
          true
        ),
        new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
      );
    };
    return { as };
  };
  $count(source, filters) {
    return new PgCountBuilder({ source, filters, session: this.session });
  }
  /**
   * Incorporates a previously defined CTE (using `$with`) into the main query.
   *
   * This method allows the main query to reference a temporary named result set.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
   *
   * @param queries The CTEs to incorporate into the main query.
   *
   * @example
   *
   * ```ts
   * // Define a subquery 'sq' as a CTE using $with
   * const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
   *
   * // Incorporate the CTE 'sq' into the main query and select from it
   * const result = await db.with(sq).select().from(sq);
   * ```
   */
  with(...queries) {
    const self2 = this;
    function select2(fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: self2.session,
        dialect: self2.dialect,
        withList: queries
      });
    }
    function selectDistinct(fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: self2.session,
        dialect: self2.dialect,
        withList: queries,
        distinct: true
      });
    }
    function selectDistinctOn(on2, fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: self2.session,
        dialect: self2.dialect,
        withList: queries,
        distinct: { on: on2 }
      });
    }
    function update(table) {
      return new PgUpdateBuilder(table, self2.session, self2.dialect, queries);
    }
    function insert(table) {
      return new PgInsertBuilder(table, self2.session, self2.dialect, queries);
    }
    function delete_(table) {
      return new PgDeleteBase(table, self2.session, self2.dialect, queries);
    }
    return { select: select2, selectDistinct, selectDistinctOn, update, insert, delete: delete_ };
  }
  select(fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: this.session,
      dialect: this.dialect
    });
  }
  selectDistinct(fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: this.session,
      dialect: this.dialect,
      distinct: true
    });
  }
  selectDistinctOn(on2, fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: this.session,
      dialect: this.dialect,
      distinct: { on: on2 }
    });
  }
  /**
   * Creates an update query.
   *
   * Calling this method without `.where()` clause will update all rows in a table. The `.where()` clause specifies which rows should be updated.
   *
   * Use `.set()` method to specify which values to update.
   *
   * See docs: {@link https://orm.drizzle.team/docs/update}
   *
   * @param table The table to update.
   *
   * @example
   *
   * ```ts
   * // Update all rows in the 'cars' table
   * await db.update(cars).set({ color: 'red' });
   *
   * // Update rows with filters and conditions
   * await db.update(cars).set({ color: 'red' }).where(eq(cars.brand, 'BMW'));
   *
   * // Update with returning clause
   * const updatedCar: Car[] = await db.update(cars)
   *   .set({ color: 'red' })
   *   .where(eq(cars.id, 1))
   *   .returning();
   * ```
   */
  update(table) {
    return new PgUpdateBuilder(table, this.session, this.dialect);
  }
  /**
   * Creates an insert query.
   *
   * Calling this method will create new rows in a table. Use `.values()` method to specify which values to insert.
   *
   * See docs: {@link https://orm.drizzle.team/docs/insert}
   *
   * @param table The table to insert into.
   *
   * @example
   *
   * ```ts
   * // Insert one row
   * await db.insert(cars).values({ brand: 'BMW' });
   *
   * // Insert multiple rows
   * await db.insert(cars).values([{ brand: 'BMW' }, { brand: 'Porsche' }]);
   *
   * // Insert with returning clause
   * const insertedCar: Car[] = await db.insert(cars)
   *   .values({ brand: 'BMW' })
   *   .returning();
   * ```
   */
  insert(table) {
    return new PgInsertBuilder(table, this.session, this.dialect);
  }
  /**
   * Creates a delete query.
   *
   * Calling this method without `.where()` clause will delete all rows in a table. The `.where()` clause specifies which rows should be deleted.
   *
   * See docs: {@link https://orm.drizzle.team/docs/delete}
   *
   * @param table The table to delete from.
   *
   * @example
   *
   * ```ts
   * // Delete all rows in the 'cars' table
   * await db.delete(cars);
   *
   * // Delete rows with filters and conditions
   * await db.delete(cars).where(eq(cars.color, 'green'));
   *
   * // Delete with returning clause
   * const deletedCar: Car[] = await db.delete(cars)
   *   .where(eq(cars.id, 1))
   *   .returning();
   * ```
   */
  delete(table) {
    return new PgDeleteBase(table, this.session, this.dialect);
  }
  refreshMaterializedView(view) {
    return new PgRefreshMaterializedView(view, this.session, this.dialect);
  }
  authToken;
  execute(query) {
    const sequel = typeof query === "string" ? sql.raw(query) : query.getSQL();
    const builtQuery = this.dialect.sqlToQuery(sequel);
    const prepared = this.session.prepareQuery(
      builtQuery,
      void 0,
      void 0,
      false
    );
    return new PgRaw(
      () => prepared.execute(void 0, this.authToken),
      sequel,
      builtQuery,
      (result) => prepared.mapResult(result, true)
    );
  }
  transaction(transaction, config) {
    return this.session.transaction(transaction, config);
  }
}
class PgPreparedQuery {
  constructor(query) {
    this.query = query;
  }
  authToken;
  getQuery() {
    return this.query;
  }
  mapResult(response, _isFromBatch) {
    return response;
  }
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  static [entityKind] = "PgPreparedQuery";
  /** @internal */
  joinsNotNullableMap;
}
class PgSession {
  constructor(dialect) {
    this.dialect = dialect;
  }
  static [entityKind] = "PgSession";
  /** @internal */
  execute(query, token) {
    return tracer.startActiveSpan("drizzle.operation", () => {
      const prepared = tracer.startActiveSpan("drizzle.prepareQuery", () => {
        return this.prepareQuery(
          this.dialect.sqlToQuery(query),
          void 0,
          void 0,
          false
        );
      });
      return prepared.setToken(token).execute(void 0, token);
    });
  }
  all(query) {
    return this.prepareQuery(
      this.dialect.sqlToQuery(query),
      void 0,
      void 0,
      false
    ).all();
  }
  /** @internal */
  async count(sql2, token) {
    const res = await this.execute(sql2, token);
    return Number(
      res[0]["count"]
    );
  }
}
class PgTransaction extends PgDatabase {
  constructor(dialect, session2, schema2, nestedIndex = 0) {
    super(dialect, session2, schema2);
    this.schema = schema2;
    this.nestedIndex = nestedIndex;
  }
  static [entityKind] = "PgTransaction";
  rollback() {
    throw new TransactionRollbackError();
  }
  /** @internal */
  getTransactionConfigSQL(config) {
    const chunks = [];
    if (config.isolationLevel) {
      chunks.push(`isolation level ${config.isolationLevel}`);
    }
    if (config.accessMode) {
      chunks.push(config.accessMode);
    }
    if (typeof config.deferrable === "boolean") {
      chunks.push(config.deferrable ? "deferrable" : "not deferrable");
    }
    return sql.raw(chunks.join(" "));
  }
  setTransaction(config) {
    return this.session.execute(sql`set transaction ${this.getTransactionConfigSQL(config)}`);
  }
}
const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
const localProfile = pgTable("local_profile", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("Local User"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
const schema = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  account,
  localProfile,
  notes,
  session,
  user,
  verification
}, Symbol.toStringTag, { value: "Module" }));
const originCache = /* @__PURE__ */ new Map(), originStackCache = /* @__PURE__ */ new Map(), originError = Symbol("OriginError");
const CLOSE = {};
class Query extends Promise {
  constructor(strings, args2, handler, canceller, options = {}) {
    let resolve, reject;
    super((a2, b2) => {
      resolve = a2;
      reject = b2;
    });
    this.tagged = Array.isArray(strings.raw);
    this.strings = strings;
    this.args = args2;
    this.handler = handler;
    this.canceller = canceller;
    this.options = options;
    this.state = null;
    this.statement = null;
    this.resolve = (x2) => (this.active = false, resolve(x2));
    this.reject = (x2) => (this.active = false, reject(x2));
    this.active = false;
    this.cancelled = null;
    this.executed = false;
    this.signature = "";
    this[originError] = this.handler.debug ? new Error() : this.tagged && cachedError(this.strings);
  }
  get origin() {
    return (this.handler.debug ? this[originError].stack : this.tagged && originStackCache.has(this.strings) ? originStackCache.get(this.strings) : originStackCache.set(this.strings, this[originError].stack).get(this.strings)) || "";
  }
  static get [Symbol.species]() {
    return Promise;
  }
  cancel() {
    return this.canceller && (this.canceller(this), this.canceller = null);
  }
  simple() {
    this.options.simple = true;
    this.options.prepare = false;
    return this;
  }
  async readable() {
    this.simple();
    this.streaming = true;
    return this;
  }
  async writable() {
    this.simple();
    this.streaming = true;
    return this;
  }
  cursor(rows = 1, fn2) {
    this.options.simple = false;
    if (typeof rows === "function") {
      fn2 = rows;
      rows = 1;
    }
    this.cursorRows = rows;
    if (typeof fn2 === "function")
      return this.cursorFn = fn2, this;
    let prev;
    return {
      [Symbol.asyncIterator]: () => ({
        next: () => {
          if (this.executed && !this.active)
            return { done: true };
          prev && prev();
          const promise = new Promise((resolve, reject) => {
            this.cursorFn = (value) => {
              resolve({ value, done: false });
              return new Promise((r2) => prev = r2);
            };
            this.resolve = () => (this.active = false, resolve({ done: true }));
            this.reject = (x2) => (this.active = false, reject(x2));
          });
          this.execute();
          return promise;
        },
        return() {
          prev && prev(CLOSE);
          return { done: true };
        }
      })
    };
  }
  describe() {
    this.options.simple = false;
    this.onlyDescribe = this.options.prepare = true;
    return this;
  }
  stream() {
    throw new Error(".stream has been renamed to .forEach");
  }
  forEach(fn2) {
    this.forEachFn = fn2;
    this.handle();
    return this;
  }
  raw() {
    this.isRaw = true;
    return this;
  }
  values() {
    this.isRaw = "values";
    return this;
  }
  async handle() {
    !this.executed && (this.executed = true) && await 1 && this.handler(this);
  }
  execute() {
    this.handle();
    return this;
  }
  then() {
    this.handle();
    return super.then.apply(this, arguments);
  }
  catch() {
    this.handle();
    return super.catch.apply(this, arguments);
  }
  finally() {
    this.handle();
    return super.finally.apply(this, arguments);
  }
}
function cachedError(xs) {
  if (originCache.has(xs))
    return originCache.get(xs);
  const x2 = Error.stackTraceLimit;
  Error.stackTraceLimit = 4;
  originCache.set(xs, new Error());
  Error.stackTraceLimit = x2;
  return originCache.get(xs);
}
class PostgresError extends Error {
  constructor(x2) {
    super(x2.message);
    this.name = this.constructor.name;
    Object.assign(this, x2);
  }
}
const Errors = {
  connection,
  postgres,
  generic,
  notSupported
};
function connection(x2, options, socket) {
  const { host, port } = socket || options;
  const error = Object.assign(
    new Error("write " + x2 + " " + (options.path || host + ":" + port)),
    {
      code: x2,
      errno: x2,
      address: options.path || host
    },
    options.path ? {} : { port }
  );
  Error.captureStackTrace(error, connection);
  return error;
}
function postgres(x2) {
  const error = new PostgresError(x2);
  Error.captureStackTrace(error, postgres);
  return error;
}
function generic(code, message) {
  const error = Object.assign(new Error(code + ": " + message), { code });
  Error.captureStackTrace(error, generic);
  return error;
}
function notSupported(x2) {
  const error = Object.assign(
    new Error(x2 + " (B) is not supported"),
    {
      code: "MESSAGE_NOT_SUPPORTED",
      name: x2
    }
  );
  Error.captureStackTrace(error, notSupported);
  return error;
}
const types = {
  string: {
    to: 25,
    from: null,
    // defaults to string
    serialize: (x2) => "" + x2
  },
  number: {
    to: 0,
    from: [21, 23, 26, 700, 701],
    serialize: (x2) => "" + x2,
    parse: (x2) => +x2
  },
  json: {
    to: 114,
    from: [114, 3802],
    serialize: (x2) => JSON.stringify(x2),
    parse: (x2) => JSON.parse(x2)
  },
  boolean: {
    to: 16,
    from: 16,
    serialize: (x2) => x2 === true ? "t" : "f",
    parse: (x2) => x2 === "t"
  },
  date: {
    to: 1184,
    from: [1082, 1114, 1184],
    serialize: (x2) => (x2 instanceof Date ? x2 : new Date(x2)).toISOString(),
    parse: (x2) => new Date(x2)
  },
  bytea: {
    to: 17,
    from: 17,
    serialize: (x2) => "\\x" + Buffer.from(x2).toString("hex"),
    parse: (x2) => Buffer.from(x2.slice(2), "hex")
  }
};
class NotTagged {
  then() {
    notTagged();
  }
  catch() {
    notTagged();
  }
  finally() {
    notTagged();
  }
}
class Identifier extends NotTagged {
  constructor(value) {
    super();
    this.value = escapeIdentifier(value);
  }
}
class Parameter extends NotTagged {
  constructor(value, type, array) {
    super();
    this.value = value;
    this.type = type;
    this.array = array;
  }
}
class Builder extends NotTagged {
  constructor(first, rest) {
    super();
    this.first = first;
    this.rest = rest;
  }
  build(before, parameters, types2, options) {
    const keyword = builders.map(([x2, fn2]) => ({ fn: fn2, i: before.search(x2) })).sort((a2, b2) => a2.i - b2.i).pop();
    return keyword.i === -1 ? escapeIdentifiers(this.first, options) : keyword.fn(this.first, this.rest, parameters, types2, options);
  }
}
function handleValue(x2, parameters, types2, options) {
  let value = x2 instanceof Parameter ? x2.value : x2;
  if (value === void 0) {
    x2 instanceof Parameter ? x2.value = options.transform.undefined : value = x2 = options.transform.undefined;
    if (value === void 0)
      throw Errors.generic("UNDEFINED_VALUE", "Undefined values are not allowed");
  }
  return "$" + types2.push(
    x2 instanceof Parameter ? (parameters.push(x2.value), x2.array ? x2.array[x2.type || inferType(x2.value)] || x2.type || firstIsString(x2.value) : x2.type) : (parameters.push(x2), inferType(x2))
  );
}
const defaultHandlers = typeHandlers(types);
function stringify(q2, string, value, parameters, types2, options) {
  for (let i2 = 1; i2 < q2.strings.length; i2++) {
    string += stringifyValue(string, value, parameters, types2, options) + q2.strings[i2];
    value = q2.args[i2];
  }
  return string;
}
function stringifyValue(string, value, parameters, types2, o2) {
  return value instanceof Builder ? value.build(string, parameters, types2, o2) : value instanceof Query ? fragment(value, parameters, types2, o2) : value instanceof Identifier ? value.value : value && value[0] instanceof Query ? value.reduce((acc, x2) => acc + " " + fragment(x2, parameters, types2, o2), "") : handleValue(value, parameters, types2, o2);
}
function fragment(q2, parameters, types2, options) {
  q2.fragment = true;
  return stringify(q2, q2.strings[0], q2.args[0], parameters, types2, options);
}
function valuesBuilder(first, parameters, types2, columns, options) {
  return first.map(
    (row) => "(" + columns.map(
      (column) => stringifyValue("values", row[column], parameters, types2, options)
    ).join(",") + ")"
  ).join(",");
}
function values(first, rest, parameters, types2, options) {
  const multi = Array.isArray(first[0]);
  const columns = rest.length ? rest.flat() : Object.keys(multi ? first[0] : first);
  return valuesBuilder(multi ? first : [first], parameters, types2, columns, options);
}
function select(first, rest, parameters, types2, options) {
  typeof first === "string" && (first = [first].concat(rest));
  if (Array.isArray(first))
    return escapeIdentifiers(first, options);
  let value;
  const columns = rest.length ? rest.flat() : Object.keys(first);
  return columns.map((x2) => {
    value = first[x2];
    return (value instanceof Query ? fragment(value, parameters, types2, options) : value instanceof Identifier ? value.value : handleValue(value, parameters, types2, options)) + " as " + escapeIdentifier(options.transform.column.to ? options.transform.column.to(x2) : x2);
  }).join(",");
}
const builders = Object.entries({
  values,
  in: (...xs) => {
    const x2 = values(...xs);
    return x2 === "()" ? "(null)" : x2;
  },
  select,
  as: select,
  returning: select,
  "\\(": select,
  update(first, rest, parameters, types2, options) {
    return (rest.length ? rest.flat() : Object.keys(first)).map(
      (x2) => escapeIdentifier(options.transform.column.to ? options.transform.column.to(x2) : x2) + "=" + stringifyValue("values", first[x2], parameters, types2, options)
    );
  },
  insert(first, rest, parameters, types2, options) {
    const columns = rest.length ? rest.flat() : Object.keys(Array.isArray(first) ? first[0] : first);
    return "(" + escapeIdentifiers(columns, options) + ")values" + valuesBuilder(Array.isArray(first) ? first : [first], parameters, types2, columns, options);
  }
}).map(([x2, fn2]) => [new RegExp("((?:^|[\\s(])" + x2 + "(?:$|[\\s(]))(?![\\s\\S]*\\1)", "i"), fn2]);
function notTagged() {
  throw Errors.generic("NOT_TAGGED_CALL", "Query not called as a tagged template literal");
}
const serializers = defaultHandlers.serializers;
const parsers = defaultHandlers.parsers;
function firstIsString(x2) {
  if (Array.isArray(x2))
    return firstIsString(x2[0]);
  return typeof x2 === "string" ? 1009 : 0;
}
const mergeUserTypes = function(types2) {
  const user2 = typeHandlers(types2 || {});
  return {
    serializers: Object.assign({}, serializers, user2.serializers),
    parsers: Object.assign({}, parsers, user2.parsers)
  };
};
function typeHandlers(types2) {
  return Object.keys(types2).reduce((acc, k2) => {
    types2[k2].from && [].concat(types2[k2].from).forEach((x2) => acc.parsers[x2] = types2[k2].parse);
    if (types2[k2].serialize) {
      acc.serializers[types2[k2].to] = types2[k2].serialize;
      types2[k2].from && [].concat(types2[k2].from).forEach((x2) => acc.serializers[x2] = types2[k2].serialize);
    }
    return acc;
  }, { parsers: {}, serializers: {} });
}
function escapeIdentifiers(xs, { transform: { column } }) {
  return xs.map((x2) => escapeIdentifier(column.to ? column.to(x2) : x2)).join(",");
}
const escapeIdentifier = function escape(str) {
  return '"' + str.replace(/"/g, '""').replace(/\./g, '"."') + '"';
};
const inferType = function inferType2(x2) {
  return x2 instanceof Parameter ? x2.type : x2 instanceof Date ? 1184 : x2 instanceof Uint8Array ? 17 : x2 === true || x2 === false ? 16 : typeof x2 === "bigint" ? 20 : Array.isArray(x2) ? inferType2(x2[0]) : 0;
};
const escapeBackslash = /\\/g;
const escapeQuote = /"/g;
function arrayEscape(x2) {
  return x2.replace(escapeBackslash, "\\\\").replace(escapeQuote, '\\"');
}
const arraySerializer = function arraySerializer2(xs, serializer, options, typarray) {
  if (Array.isArray(xs) === false)
    return xs;
  if (!xs.length)
    return "{}";
  const first = xs[0];
  const delimiter = typarray === 1020 ? ";" : ",";
  if (Array.isArray(first) && !first.type)
    return "{" + xs.map((x2) => arraySerializer2(x2, serializer, options, typarray)).join(delimiter) + "}";
  return "{" + xs.map((x2) => {
    if (x2 === void 0) {
      x2 = options.transform.undefined;
      if (x2 === void 0)
        throw Errors.generic("UNDEFINED_VALUE", "Undefined values are not allowed");
    }
    return x2 === null ? "null" : '"' + arrayEscape(serializer ? serializer(x2.type ? x2.value : x2) : "" + x2) + '"';
  }).join(delimiter) + "}";
};
const arrayParserState = {
  i: 0,
  char: null,
  str: "",
  quoted: false,
  last: 0
};
const arrayParser = function arrayParser2(x2, parser, typarray) {
  arrayParserState.i = arrayParserState.last = 0;
  return arrayParserLoop(arrayParserState, x2, parser, typarray);
};
function arrayParserLoop(s2, x2, parser, typarray) {
  const xs = [];
  const delimiter = typarray === 1020 ? ";" : ",";
  for (; s2.i < x2.length; s2.i++) {
    s2.char = x2[s2.i];
    if (s2.quoted) {
      if (s2.char === "\\") {
        s2.str += x2[++s2.i];
      } else if (s2.char === '"') {
        xs.push(parser ? parser(s2.str) : s2.str);
        s2.str = "";
        s2.quoted = x2[s2.i + 1] === '"';
        s2.last = s2.i + 2;
      } else {
        s2.str += s2.char;
      }
    } else if (s2.char === '"') {
      s2.quoted = true;
    } else if (s2.char === "{") {
      s2.last = ++s2.i;
      xs.push(arrayParserLoop(s2, x2, parser, typarray));
    } else if (s2.char === "}") {
      s2.quoted = false;
      s2.last < s2.i && xs.push(parser ? parser(x2.slice(s2.last, s2.i)) : x2.slice(s2.last, s2.i));
      s2.last = s2.i + 1;
      break;
    } else if (s2.char === delimiter && s2.p !== "}" && s2.p !== '"') {
      xs.push(parser ? parser(x2.slice(s2.last, s2.i)) : x2.slice(s2.last, s2.i));
      s2.last = s2.i + 1;
    }
    s2.p = s2.char;
  }
  s2.last < s2.i && xs.push(parser ? parser(x2.slice(s2.last, s2.i + 1)) : x2.slice(s2.last, s2.i + 1));
  return xs;
}
const toCamel = (x2) => {
  let str = x2[0];
  for (let i2 = 1; i2 < x2.length; i2++)
    str += x2[i2] === "_" ? x2[++i2].toUpperCase() : x2[i2];
  return str;
};
const toPascal = (x2) => {
  let str = x2[0].toUpperCase();
  for (let i2 = 1; i2 < x2.length; i2++)
    str += x2[i2] === "_" ? x2[++i2].toUpperCase() : x2[i2];
  return str;
};
const toKebab = (x2) => x2.replace(/_/g, "-");
const fromCamel = (x2) => x2.replace(/([A-Z])/g, "_$1").toLowerCase();
const fromPascal = (x2) => (x2.slice(0, 1) + x2.slice(1).replace(/([A-Z])/g, "_$1")).toLowerCase();
const fromKebab = (x2) => x2.replace(/-/g, "_");
function createJsonTransform(fn2) {
  return function jsonTransform(x2, column) {
    return typeof x2 === "object" && x2 !== null && (column.type === 114 || column.type === 3802) ? Array.isArray(x2) ? x2.map((x3) => jsonTransform(x3, column)) : Object.entries(x2).reduce((acc, [k2, v2]) => Object.assign(acc, { [fn2(k2)]: jsonTransform(v2, column) }), {}) : x2;
  };
}
toCamel.column = { from: toCamel };
toCamel.value = { from: createJsonTransform(toCamel) };
fromCamel.column = { to: fromCamel };
const camel = { ...toCamel };
camel.column.to = fromCamel;
toPascal.column = { from: toPascal };
toPascal.value = { from: createJsonTransform(toPascal) };
fromPascal.column = { to: fromPascal };
const pascal = { ...toPascal };
pascal.column.to = fromPascal;
toKebab.column = { from: toKebab };
toKebab.value = { from: createJsonTransform(toKebab) };
fromKebab.column = { to: fromKebab };
const kebab = { ...toKebab };
kebab.column.to = fromKebab;
class Result extends Array {
  constructor() {
    super();
    Object.defineProperties(this, {
      count: { value: null, writable: true },
      state: { value: null, writable: true },
      command: { value: null, writable: true },
      columns: { value: null, writable: true },
      statement: { value: null, writable: true }
    });
  }
  static get [Symbol.species]() {
    return Array;
  }
}
function Queue(initial = []) {
  let xs = initial.slice();
  let index = 0;
  return {
    get length() {
      return xs.length - index;
    },
    remove: (x2) => {
      const index2 = xs.indexOf(x2);
      return index2 === -1 ? null : (xs.splice(index2, 1), x2);
    },
    push: (x2) => (xs.push(x2), x2),
    shift: () => {
      const out2 = xs[index++];
      if (index === xs.length) {
        index = 0;
        xs = [];
      } else {
        xs[index - 1] = void 0;
      }
      return out2;
    }
  };
}
const size = 256;
let buffer = Buffer.allocUnsafe(size);
const messages = "BCcDdEFfHPpQSX".split("").reduce((acc, x2) => {
  const v2 = x2.charCodeAt(0);
  acc[x2] = () => {
    buffer[0] = v2;
    b$2.i = 5;
    return b$2;
  };
  return acc;
}, {});
const b$2 = Object.assign(reset, messages, {
  N: String.fromCharCode(0),
  i: 0,
  inc(x2) {
    b$2.i += x2;
    return b$2;
  },
  str(x2) {
    const length = Buffer.byteLength(x2);
    fit(length);
    b$2.i += buffer.write(x2, b$2.i, length, "utf8");
    return b$2;
  },
  i16(x2) {
    fit(2);
    buffer.writeUInt16BE(x2, b$2.i);
    b$2.i += 2;
    return b$2;
  },
  i32(x2, i2) {
    if (i2 || i2 === 0) {
      buffer.writeUInt32BE(x2, i2);
      return b$2;
    }
    fit(4);
    buffer.writeUInt32BE(x2, b$2.i);
    b$2.i += 4;
    return b$2;
  },
  z(x2) {
    fit(x2);
    buffer.fill(0, b$2.i, b$2.i + x2);
    b$2.i += x2;
    return b$2;
  },
  raw(x2) {
    buffer = Buffer.concat([buffer.subarray(0, b$2.i), x2]);
    b$2.i = buffer.length;
    return b$2;
  },
  end(at2 = 1) {
    buffer.writeUInt32BE(b$2.i - at2, at2);
    const out2 = buffer.subarray(0, b$2.i);
    b$2.i = 0;
    buffer = Buffer.allocUnsafe(size);
    return out2;
  }
});
function fit(x2) {
  if (buffer.length - b$2.i < x2) {
    const prev = buffer, length = prev.length;
    buffer = Buffer.allocUnsafe(length + (length >> 1) + x2);
    prev.copy(buffer);
  }
}
function reset() {
  b$2.i = 0;
  return b$2;
}
let uid = 1;
const Sync = b$2().S().end(), Flush = b$2().H().end(), SSLRequest = b$2().i32(8).i32(80877103).end(8), ExecuteUnnamed = Buffer.concat([b$2().E().str(b$2.N).i32(0).end(), Sync]), DescribeUnnamed = b$2().D().str("S").str(b$2.N).end(), noop$1 = () => {
};
const retryRoutines = /* @__PURE__ */ new Set([
  "FetchPreparedStatement",
  "RevalidateCachedQuery",
  "transformAssignedExpr"
]);
const errorFields = {
  83: "severity_local",
  // S
  86: "severity",
  // V
  67: "code",
  // C
  77: "message",
  // M
  68: "detail",
  // D
  72: "hint",
  // H
  80: "position",
  // P
  112: "internal_position",
  // p
  113: "internal_query",
  // q
  87: "where",
  // W
  115: "schema_name",
  // s
  116: "table_name",
  // t
  99: "column_name",
  // c
  100: "data type_name",
  // d
  110: "constraint_name",
  // n
  70: "file",
  // F
  76: "line",
  // L
  82: "routine"
  // R
};
function Connection(options, queues = {}, { onopen = noop$1, onend = noop$1, onclose = noop$1 } = {}) {
  const {
    sslnegotiation,
    ssl,
    max,
    user: user2,
    host,
    port,
    database,
    parsers: parsers2,
    transform,
    onnotice,
    onnotify,
    onparameter,
    max_pipeline,
    keep_alive,
    backoff: backoff2,
    target_session_attrs
  } = options;
  const sent = Queue(), id = uid++, backend = { pid: null, secret: null }, idleTimer = timer(end, options.idle_timeout), lifeTimer = timer(end, options.max_lifetime), connectTimer = timer(connectTimedOut, options.connect_timeout);
  let socket = null, cancelMessage, errorResponse = null, result = new Result(), incoming = Buffer.alloc(0), needsTypes = options.fetch_types, backendParameters = {}, statements = {}, statementId = Math.random().toString(36).slice(2), statementCount = 1, closedTime = 0, remaining = 0, hostIndex = 0, retries = 0, length = 0, delay = 0, rows = 0, serverSignature = null, nextWriteTimer = null, terminated = false, incomings = null, results = null, initial = null, ending = null, stream = null, chunk = null, ended = null, nonce = null, query = null, final = null;
  const connection2 = {
    queue: queues.closed,
    idleTimer,
    connect(query2) {
      initial = query2;
      reconnect();
    },
    terminate,
    execute,
    cancel,
    end,
    count: 0,
    id
  };
  queues.closed && queues.closed.push(connection2);
  return connection2;
  async function createSocket() {
    let x2;
    try {
      x2 = options.socket ? await Promise.resolve(options.socket(options)) : new net.Socket();
    } catch (e) {
      error(e);
      return;
    }
    x2.on("error", error);
    x2.on("close", closed);
    x2.on("drain", drain);
    return x2;
  }
  async function cancel({ pid, secret }, resolve, reject) {
    try {
      cancelMessage = b$2().i32(16).i32(80877102).i32(pid).i32(secret).end(16);
      await connect();
      socket.once("error", reject);
      socket.once("close", resolve);
    } catch (error2) {
      reject(error2);
    }
  }
  function execute(q2) {
    if (terminated)
      return queryError(q2, Errors.connection("CONNECTION_DESTROYED", options));
    if (stream)
      return queryError(q2, Errors.generic("COPY_IN_PROGRESS", "You cannot execute queries during copy"));
    if (q2.cancelled)
      return;
    try {
      q2.state = backend;
      query ? sent.push(q2) : (query = q2, query.active = true);
      build(q2);
      return write(toBuffer(q2)) && !q2.describeFirst && !q2.cursorFn && sent.length < max_pipeline && (!q2.options.onexecute || q2.options.onexecute(connection2));
    } catch (error2) {
      sent.length === 0 && write(Sync);
      errored(error2);
      return true;
    }
  }
  function toBuffer(q2) {
    if (q2.parameters.length >= 65534)
      throw Errors.generic("MAX_PARAMETERS_EXCEEDED", "Max number of parameters (65534) exceeded");
    return q2.options.simple ? b$2().Q().str(q2.statement.string + b$2.N).end() : q2.describeFirst ? Buffer.concat([describe(q2), Flush]) : q2.prepare ? q2.prepared ? prepared(q2) : Buffer.concat([describe(q2), prepared(q2)]) : unnamed(q2);
  }
  function describe(q2) {
    return Buffer.concat([
      Parse(q2.statement.string, q2.parameters, q2.statement.types, q2.statement.name),
      Describe("S", q2.statement.name)
    ]);
  }
  function prepared(q2) {
    return Buffer.concat([
      Bind(q2.parameters, q2.statement.types, q2.statement.name, q2.cursorName),
      q2.cursorFn ? Execute("", q2.cursorRows) : ExecuteUnnamed
    ]);
  }
  function unnamed(q2) {
    return Buffer.concat([
      Parse(q2.statement.string, q2.parameters, q2.statement.types),
      DescribeUnnamed,
      prepared(q2)
    ]);
  }
  function build(q2) {
    const parameters = [], types2 = [];
    const string = stringify(q2, q2.strings[0], q2.args[0], parameters, types2, options);
    !q2.tagged && q2.args.forEach((x2) => handleValue(x2, parameters, types2, options));
    q2.prepare = options.prepare && ("prepare" in q2.options ? q2.options.prepare : true);
    q2.string = string;
    q2.signature = q2.prepare && types2 + string;
    q2.onlyDescribe && delete statements[q2.signature];
    q2.parameters = q2.parameters || parameters;
    q2.prepared = q2.prepare && q2.signature in statements;
    q2.describeFirst = q2.onlyDescribe || parameters.length && !q2.prepared;
    q2.statement = q2.prepared ? statements[q2.signature] : { string, types: types2, name: q2.prepare ? statementId + statementCount++ : "" };
    typeof options.debug === "function" && options.debug(id, string, parameters, types2);
  }
  function write(x2, fn2) {
    chunk = chunk ? Buffer.concat([chunk, x2]) : Buffer.from(x2);
    if (chunk.length >= 1024)
      return nextWrite(fn2);
    nextWriteTimer === null && (nextWriteTimer = setImmediate(nextWrite));
    return true;
  }
  function nextWrite(fn2) {
    const x2 = socket.write(chunk, fn2);
    nextWriteTimer !== null && clearImmediate(nextWriteTimer);
    chunk = nextWriteTimer = null;
    return x2;
  }
  function connectTimedOut() {
    errored(Errors.connection("CONNECT_TIMEOUT", options, socket));
    socket.destroy();
  }
  async function secure() {
    if (sslnegotiation !== "direct") {
      write(SSLRequest);
      const canSSL = await new Promise((r2) => socket.once("data", (x2) => r2(x2[0] === 83)));
      if (!canSSL && ssl === "prefer")
        return connected();
    }
    const options2 = {
      socket,
      servername: net.isIP(socket.host) ? void 0 : socket.host
    };
    if (sslnegotiation === "direct")
      options2.ALPNProtocols = ["postgresql"];
    if (ssl === "require" || ssl === "allow" || ssl === "prefer")
      options2.rejectUnauthorized = false;
    else if (typeof ssl === "object")
      Object.assign(options2, ssl);
    socket.removeAllListeners();
    socket = tls.connect(options2);
    socket.on("secureConnect", connected);
    socket.on("error", error);
    socket.on("close", closed);
    socket.on("drain", drain);
  }
  function drain() {
    !query && onopen(connection2);
  }
  function data(x2) {
    if (incomings) {
      incomings.push(x2);
      remaining -= x2.length;
      if (remaining > 0)
        return;
    }
    incoming = incomings ? Buffer.concat(incomings, length - remaining) : incoming.length === 0 ? x2 : Buffer.concat([incoming, x2], incoming.length + x2.length);
    while (incoming.length > 4) {
      length = incoming.readUInt32BE(1);
      if (length >= incoming.length) {
        remaining = length - incoming.length;
        incomings = [incoming];
        break;
      }
      try {
        handle2(incoming.subarray(0, length + 1));
      } catch (e) {
        query && (query.cursorFn || query.describeFirst) && write(Sync);
        errored(e);
      }
      incoming = incoming.subarray(length + 1);
      remaining = 0;
      incomings = null;
    }
  }
  async function connect() {
    terminated = false;
    backendParameters = {};
    socket || (socket = await createSocket());
    if (!socket)
      return;
    connectTimer.start();
    if (options.socket)
      return ssl ? secure() : connected();
    socket.on("connect", ssl ? secure : connected);
    if (options.path)
      return socket.connect(options.path);
    socket.ssl = ssl;
    socket.connect(port[hostIndex], host[hostIndex]);
    socket.host = host[hostIndex];
    socket.port = port[hostIndex];
    hostIndex = (hostIndex + 1) % port.length;
  }
  function reconnect() {
    setTimeout(connect, closedTime ? Math.max(0, closedTime + delay - performance$1.now()) : 0);
  }
  function connected() {
    try {
      statements = {};
      needsTypes = options.fetch_types;
      statementId = Math.random().toString(36).slice(2);
      statementCount = 1;
      lifeTimer.start();
      socket.on("data", data);
      keep_alive && socket.setKeepAlive && socket.setKeepAlive(true, 1e3 * keep_alive);
      const s2 = StartupMessage();
      write(s2);
    } catch (err2) {
      error(err2);
    }
  }
  function error(err2) {
    if (connection2.queue === queues.connecting && options.host[retries + 1])
      return;
    errored(err2);
    while (sent.length)
      queryError(sent.shift(), err2);
  }
  function errored(err2) {
    stream && (stream.destroy(err2), stream = null);
    query && queryError(query, err2);
    initial && (queryError(initial, err2), initial = null);
  }
  function queryError(query2, err2) {
    if (query2.reserve)
      return query2.reject(err2);
    if (!err2 || typeof err2 !== "object")
      err2 = new Error(err2);
    "query" in err2 || "parameters" in err2 || Object.defineProperties(err2, {
      stack: { value: err2.stack + query2.origin.replace(/.*\n/, "\n"), enumerable: options.debug },
      query: { value: query2.string, enumerable: options.debug },
      parameters: { value: query2.parameters, enumerable: options.debug },
      args: { value: query2.args, enumerable: options.debug },
      types: { value: query2.statement && query2.statement.types, enumerable: options.debug }
    });
    query2.reject(err2);
  }
  function end() {
    return ending || (!connection2.reserved && onend(connection2), !connection2.reserved && !initial && !query && sent.length === 0 ? (terminate(), new Promise((r2) => socket && socket.readyState !== "closed" ? socket.once("close", r2) : r2())) : ending = new Promise((r2) => ended = r2));
  }
  function terminate() {
    terminated = true;
    if (stream || query || initial || sent.length)
      error(Errors.connection("CONNECTION_DESTROYED", options));
    clearImmediate(nextWriteTimer);
    if (socket) {
      socket.removeListener("data", data);
      socket.removeListener("connect", connected);
      socket.readyState === "open" && socket.end(b$2().X().end());
    }
    ended && (ended(), ending = ended = null);
  }
  async function closed(hadError) {
    incoming = Buffer.alloc(0);
    remaining = 0;
    incomings = null;
    clearImmediate(nextWriteTimer);
    socket.removeListener("data", data);
    socket.removeListener("connect", connected);
    idleTimer.cancel();
    lifeTimer.cancel();
    connectTimer.cancel();
    socket.removeAllListeners();
    socket = null;
    if (initial)
      return reconnect();
    !hadError && (query || sent.length) && error(Errors.connection("CONNECTION_CLOSED", options, socket));
    closedTime = performance$1.now();
    hadError && options.shared.retries++;
    delay = (typeof backoff2 === "function" ? backoff2(options.shared.retries) : backoff2) * 1e3;
    onclose(connection2, Errors.connection("CONNECTION_CLOSED", options, socket));
  }
  function handle2(xs, x2 = xs[0]) {
    (x2 === 68 ? DataRow : (
      // D
      x2 === 100 ? CopyData : (
        // d
        x2 === 65 ? NotificationResponse : (
          // A
          x2 === 83 ? ParameterStatus : (
            // S
            x2 === 90 ? ReadyForQuery : (
              // Z
              x2 === 67 ? CommandComplete : (
                // C
                x2 === 50 ? BindComplete : (
                  // 2
                  x2 === 49 ? ParseComplete : (
                    // 1
                    x2 === 116 ? ParameterDescription : (
                      // t
                      x2 === 84 ? RowDescription : (
                        // T
                        x2 === 82 ? Authentication : (
                          // R
                          x2 === 110 ? NoData : (
                            // n
                            x2 === 75 ? BackendKeyData : (
                              // K
                              x2 === 69 ? ErrorResponse : (
                                // E
                                x2 === 115 ? PortalSuspended : (
                                  // s
                                  x2 === 51 ? CloseComplete : (
                                    // 3
                                    x2 === 71 ? CopyInResponse : (
                                      // G
                                      x2 === 78 ? NoticeResponse : (
                                        // N
                                        x2 === 72 ? CopyOutResponse : (
                                          // H
                                          x2 === 99 ? CopyDone : (
                                            // c
                                            x2 === 73 ? EmptyQueryResponse : (
                                              // I
                                              x2 === 86 ? FunctionCallResponse : (
                                                // V
                                                x2 === 118 ? NegotiateProtocolVersion : (
                                                  // v
                                                  x2 === 87 ? CopyBothResponse : (
                                                    // W
                                                    /* c8 ignore next */
                                                    UnknownMessage
                                                  )
                                                )
                                              )
                                            )
                                          )
                                        )
                                      )
                                    )
                                  )
                                )
                              )
                            )
                          )
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    ))(xs);
  }
  function DataRow(x2) {
    let index = 7;
    let length2;
    let column;
    let value;
    const row = query.isRaw ? new Array(query.statement.columns.length) : {};
    for (let i2 = 0; i2 < query.statement.columns.length; i2++) {
      column = query.statement.columns[i2];
      length2 = x2.readInt32BE(index);
      index += 4;
      value = length2 === -1 ? null : query.isRaw === true ? x2.subarray(index, index += length2) : column.parser === void 0 ? x2.toString("utf8", index, index += length2) : column.parser.array === true ? column.parser(x2.toString("utf8", index + 1, index += length2)) : column.parser(x2.toString("utf8", index, index += length2));
      query.isRaw ? row[i2] = query.isRaw === true ? value : transform.value.from ? transform.value.from(value, column) : value : row[column.name] = transform.value.from ? transform.value.from(value, column) : value;
    }
    query.forEachFn ? query.forEachFn(transform.row.from ? transform.row.from(row) : row, result) : result[rows++] = transform.row.from ? transform.row.from(row) : row;
  }
  function ParameterStatus(x2) {
    const [k2, v2] = x2.toString("utf8", 5, x2.length - 1).split(b$2.N);
    backendParameters[k2] = v2;
    if (options.parameters[k2] !== v2) {
      options.parameters[k2] = v2;
      onparameter && onparameter(k2, v2);
    }
  }
  function ReadyForQuery(x2) {
    if (query) {
      if (errorResponse) {
        query.retried ? errored(query.retried) : query.prepared && retryRoutines.has(errorResponse.routine) ? retry(query, errorResponse) : errored(errorResponse);
      } else {
        query.resolve(results || result);
      }
    } else if (errorResponse) {
      errored(errorResponse);
    }
    query = results = errorResponse = null;
    result = new Result();
    connectTimer.cancel();
    if (initial) {
      if (target_session_attrs) {
        if (!backendParameters.in_hot_standby || !backendParameters.default_transaction_read_only)
          return fetchState();
        else if (tryNext(target_session_attrs, backendParameters))
          return terminate();
      }
      if (needsTypes) {
        initial.reserve && (initial = null);
        return fetchArrayTypes();
      }
      initial && !initial.reserve && execute(initial);
      options.shared.retries = retries = 0;
      initial = null;
      return;
    }
    while (sent.length && (query = sent.shift()) && (query.active = true, query.cancelled))
      Connection(options).cancel(query.state, query.cancelled.resolve, query.cancelled.reject);
    if (query)
      return;
    connection2.reserved ? !connection2.reserved.release && x2[5] === 73 ? ending ? terminate() : (connection2.reserved = null, onopen(connection2)) : connection2.reserved() : ending ? terminate() : onopen(connection2);
  }
  function CommandComplete(x2) {
    rows = 0;
    for (let i2 = x2.length - 1; i2 > 0; i2--) {
      if (x2[i2] === 32 && x2[i2 + 1] < 58 && result.count === null)
        result.count = +x2.toString("utf8", i2 + 1, x2.length - 1);
      if (x2[i2 - 1] >= 65) {
        result.command = x2.toString("utf8", 5, i2);
        result.state = backend;
        break;
      }
    }
    final && (final(), final = null);
    if (result.command === "BEGIN" && max !== 1 && !connection2.reserved)
      return errored(Errors.generic("UNSAFE_TRANSACTION", "Only use sql.begin, sql.reserved or max: 1"));
    if (query.options.simple)
      return BindComplete();
    if (query.cursorFn) {
      result.count && query.cursorFn(result);
      write(Sync);
    }
  }
  function ParseComplete() {
    query.parsing = false;
  }
  function BindComplete() {
    !result.statement && (result.statement = query.statement);
    result.columns = query.statement.columns;
  }
  function ParameterDescription(x2) {
    const length2 = x2.readUInt16BE(5);
    for (let i2 = 0; i2 < length2; ++i2)
      !query.statement.types[i2] && (query.statement.types[i2] = x2.readUInt32BE(7 + i2 * 4));
    query.prepare && (statements[query.signature] = query.statement);
    query.describeFirst && !query.onlyDescribe && (write(prepared(query)), query.describeFirst = false);
  }
  function RowDescription(x2) {
    if (result.command) {
      results = results || [result];
      results.push(result = new Result());
      result.count = null;
      query.statement.columns = null;
    }
    const length2 = x2.readUInt16BE(5);
    let index = 7;
    let start2;
    query.statement.columns = Array(length2);
    for (let i2 = 0; i2 < length2; ++i2) {
      start2 = index;
      while (x2[index++] !== 0) ;
      const table = x2.readUInt32BE(index);
      const number = x2.readUInt16BE(index + 4);
      const type = x2.readUInt32BE(index + 6);
      query.statement.columns[i2] = {
        name: transform.column.from ? transform.column.from(x2.toString("utf8", start2, index - 1)) : x2.toString("utf8", start2, index - 1),
        parser: parsers2[type],
        table,
        number,
        type
      };
      index += 18;
    }
    result.statement = query.statement;
    if (query.onlyDescribe)
      return query.resolve(query.statement), write(Sync);
  }
  async function Authentication(x2, type = x2.readUInt32BE(5)) {
    (type === 3 ? AuthenticationCleartextPassword : type === 5 ? AuthenticationMD5Password : type === 10 ? SASL : type === 11 ? SASLContinue : type === 12 ? SASLFinal : type !== 0 ? UnknownAuth : noop$1)(x2, type);
  }
  async function AuthenticationCleartextPassword() {
    const payload = await Pass();
    write(
      b$2().p().str(payload).z(1).end()
    );
  }
  async function AuthenticationMD5Password(x2) {
    const payload = "md5" + await md5(
      Buffer.concat([
        Buffer.from(await md5(await Pass() + user2)),
        x2.subarray(9)
      ])
    );
    write(
      b$2().p().str(payload).z(1).end()
    );
  }
  async function SASL() {
    nonce = (await crypto$1.randomBytes(18)).toString("base64");
    b$2().p().str("SCRAM-SHA-256" + b$2.N);
    const i2 = b$2.i;
    write(b$2.inc(4).str("n,,n=*,r=" + nonce).i32(b$2.i - i2 - 4, i2).end());
  }
  async function SASLContinue(x2) {
    const res = x2.toString("utf8", 9).split(",").reduce((acc, x3) => (acc[x3[0]] = x3.slice(2), acc), {});
    const saltedPassword = await crypto$1.pbkdf2Sync(
      await Pass(),
      Buffer.from(res.s, "base64"),
      parseInt(res.i),
      32,
      "sha256"
    );
    const clientKey = await hmac(saltedPassword, "Client Key");
    const auth = "n=*,r=" + nonce + ",r=" + res.r + ",s=" + res.s + ",i=" + res.i + ",c=biws,r=" + res.r;
    serverSignature = (await hmac(await hmac(saltedPassword, "Server Key"), auth)).toString("base64");
    const payload = "c=biws,r=" + res.r + ",p=" + xor(
      clientKey,
      Buffer.from(await hmac(await sha256(clientKey), auth))
    ).toString("base64");
    write(
      b$2().p().str(payload).end()
    );
  }
  function SASLFinal(x2) {
    if (x2.toString("utf8", 9).split(b$2.N, 1)[0].slice(2) === serverSignature)
      return;
    errored(Errors.generic("SASL_SIGNATURE_MISMATCH", "The server did not return the correct signature"));
    socket.destroy();
  }
  function Pass() {
    return Promise.resolve(
      typeof options.pass === "function" ? options.pass() : options.pass
    );
  }
  function NoData() {
    result.statement = query.statement;
    result.statement.columns = [];
    if (query.onlyDescribe)
      return query.resolve(query.statement), write(Sync);
  }
  function BackendKeyData(x2) {
    backend.pid = x2.readUInt32BE(5);
    backend.secret = x2.readUInt32BE(9);
  }
  async function fetchArrayTypes() {
    needsTypes = false;
    const types2 = await new Query([`
      select b.oid, b.typarray
      from pg_catalog.pg_type a
      left join pg_catalog.pg_type b on b.oid = a.typelem
      where a.typcategory = 'A'
      group by b.oid, b.typarray
      order by b.oid
    `], [], execute);
    types2.forEach(({ oid, typarray }) => addArrayType(oid, typarray));
  }
  function addArrayType(oid, typarray) {
    if (!!options.parsers[typarray] && !!options.serializers[typarray]) return;
    const parser = options.parsers[oid];
    options.shared.typeArrayMap[oid] = typarray;
    options.parsers[typarray] = (xs) => arrayParser(xs, parser, typarray);
    options.parsers[typarray].array = true;
    options.serializers[typarray] = (xs) => arraySerializer(xs, options.serializers[oid], options, typarray);
  }
  function tryNext(x2, xs) {
    return x2 === "read-write" && xs.default_transaction_read_only === "on" || x2 === "read-only" && xs.default_transaction_read_only === "off" || x2 === "primary" && xs.in_hot_standby === "on" || x2 === "standby" && xs.in_hot_standby === "off" || x2 === "prefer-standby" && xs.in_hot_standby === "off" && options.host[retries];
  }
  function fetchState() {
    const query2 = new Query([`
      show transaction_read_only;
      select pg_catalog.pg_is_in_recovery()
    `], [], execute, null, { simple: true });
    query2.resolve = ([[a2], [b2]]) => {
      backendParameters.default_transaction_read_only = a2.transaction_read_only;
      backendParameters.in_hot_standby = b2.pg_is_in_recovery ? "on" : "off";
    };
    query2.execute();
  }
  function ErrorResponse(x2) {
    if (query) {
      (query.cursorFn || query.describeFirst) && write(Sync);
      errorResponse = Errors.postgres(parseError(x2));
    } else {
      errored(Errors.postgres(parseError(x2)));
    }
  }
  function retry(q2, error2) {
    delete statements[q2.signature];
    q2.retried = error2;
    execute(q2);
  }
  function NotificationResponse(x2) {
    if (!onnotify)
      return;
    let index = 9;
    while (x2[index++] !== 0) ;
    onnotify(
      x2.toString("utf8", 9, index - 1),
      x2.toString("utf8", index, x2.length - 1)
    );
  }
  async function PortalSuspended() {
    try {
      const x2 = await Promise.resolve(query.cursorFn(result));
      rows = 0;
      x2 === CLOSE ? write(Close(query.portal)) : (result = new Result(), write(Execute("", query.cursorRows)));
    } catch (err2) {
      write(Sync);
      query.reject(err2);
    }
  }
  function CloseComplete() {
    result.count && query.cursorFn(result);
    query.resolve(result);
  }
  function CopyInResponse() {
    stream = new Stream.Writable({
      autoDestroy: true,
      write(chunk2, encoding, callback) {
        socket.write(b$2().d().raw(chunk2).end(), callback);
      },
      destroy(error2, callback) {
        callback(error2);
        socket.write(b$2().f().str(error2 + b$2.N).end());
        stream = null;
      },
      final(callback) {
        socket.write(b$2().c().end());
        final = callback;
        stream = null;
      }
    });
    query.resolve(stream);
  }
  function CopyOutResponse() {
    stream = new Stream.Readable({
      read() {
        socket.resume();
      }
    });
    query.resolve(stream);
  }
  function CopyBothResponse() {
    stream = new Stream.Duplex({
      autoDestroy: true,
      read() {
        socket.resume();
      },
      /* c8 ignore next 11 */
      write(chunk2, encoding, callback) {
        socket.write(b$2().d().raw(chunk2).end(), callback);
      },
      destroy(error2, callback) {
        callback(error2);
        socket.write(b$2().f().str(error2 + b$2.N).end());
        stream = null;
      },
      final(callback) {
        socket.write(b$2().c().end());
        final = callback;
      }
    });
    query.resolve(stream);
  }
  function CopyData(x2) {
    stream && (stream.push(x2.subarray(5)) || socket.pause());
  }
  function CopyDone() {
    stream && stream.push(null);
    stream = null;
  }
  function NoticeResponse(x2) {
    onnotice ? onnotice(parseError(x2)) : console.log(parseError(x2));
  }
  function EmptyQueryResponse() {
  }
  function FunctionCallResponse() {
    errored(Errors.notSupported("FunctionCallResponse"));
  }
  function NegotiateProtocolVersion() {
    errored(Errors.notSupported("NegotiateProtocolVersion"));
  }
  function UnknownMessage(x2) {
    console.error("Postgres.js : Unknown Message:", x2[0]);
  }
  function UnknownAuth(x2, type) {
    console.error("Postgres.js : Unknown Auth:", type);
  }
  function Bind(parameters, types2, statement = "", portal = "") {
    let prev, type;
    b$2().B().str(portal + b$2.N).str(statement + b$2.N).i16(0).i16(parameters.length);
    parameters.forEach((x2, i2) => {
      if (x2 === null)
        return b$2.i32(4294967295);
      type = types2[i2];
      parameters[i2] = x2 = type in options.serializers ? options.serializers[type](x2) : "" + x2;
      prev = b$2.i;
      b$2.inc(4).str(x2).i32(b$2.i - prev - 4, prev);
    });
    b$2.i16(0);
    return b$2.end();
  }
  function Parse(str, parameters, types2, name2 = "") {
    b$2().P().str(name2 + b$2.N).str(str + b$2.N).i16(parameters.length);
    parameters.forEach((x2, i2) => b$2.i32(types2[i2] || 0));
    return b$2.end();
  }
  function Describe(x2, name2 = "") {
    return b$2().D().str(x2).str(name2 + b$2.N).end();
  }
  function Execute(portal = "", rows2 = 0) {
    return Buffer.concat([
      b$2().E().str(portal + b$2.N).i32(rows2).end(),
      Flush
    ]);
  }
  function Close(portal = "") {
    return Buffer.concat([
      b$2().C().str("P").str(portal + b$2.N).end(),
      b$2().S().end()
    ]);
  }
  function StartupMessage() {
    return cancelMessage || b$2().inc(4).i16(3).z(2).str(
      Object.entries(Object.assign(
        {
          user: user2,
          database,
          client_encoding: "UTF8"
        },
        options.connection
      )).filter(([, v2]) => v2).map(([k2, v2]) => k2 + b$2.N + v2).join(b$2.N)
    ).z(2).end(0);
  }
}
function parseError(x2) {
  const error = {};
  let start2 = 5;
  for (let i2 = 5; i2 < x2.length - 1; i2++) {
    if (x2[i2] === 0) {
      error[errorFields[x2[start2]]] = x2.toString("utf8", start2 + 1, i2);
      start2 = i2 + 1;
    }
  }
  return error;
}
function md5(x2) {
  return crypto$1.createHash("md5").update(x2).digest("hex");
}
function hmac(key, x2) {
  return crypto$1.createHmac("sha256", key).update(x2).digest();
}
function sha256(x2) {
  return crypto$1.createHash("sha256").update(x2).digest();
}
function xor(a2, b2) {
  const length = Math.max(a2.length, b2.length);
  const buffer2 = Buffer.allocUnsafe(length);
  for (let i2 = 0; i2 < length; i2++)
    buffer2[i2] = a2[i2] ^ b2[i2];
  return buffer2;
}
function timer(fn2, seconds) {
  seconds = typeof seconds === "function" ? seconds() : seconds;
  if (!seconds)
    return { cancel: noop$1, start: noop$1 };
  let timer2;
  return {
    cancel() {
      timer2 && (clearTimeout(timer2), timer2 = null);
    },
    start() {
      timer2 && clearTimeout(timer2);
      timer2 = setTimeout(done, seconds * 1e3, arguments);
    }
  };
  function done(args2) {
    fn2.apply(null, args2);
    timer2 = null;
  }
}
const noop = () => {
};
function Subscribe(postgres2, options) {
  const subscribers = /* @__PURE__ */ new Map(), slot = "postgresjs_" + Math.random().toString(36).slice(2), state = {};
  let connection2, stream, ended = false;
  const sql2 = subscribe.sql = postgres2({
    ...options,
    transform: { column: {}, value: {}, row: {} },
    max: 1,
    fetch_types: false,
    idle_timeout: null,
    max_lifetime: null,
    connection: {
      ...options.connection,
      replication: "database"
    },
    onclose: async function() {
      if (ended)
        return;
      stream = null;
      state.pid = state.secret = void 0;
      connected(await init2(sql2, slot, options.publications));
      subscribers.forEach((event) => event.forEach(({ onsubscribe }) => onsubscribe()));
    },
    no_subscribe: true
  });
  const end = sql2.end, close = sql2.close;
  sql2.end = async () => {
    ended = true;
    stream && await new Promise((r2) => (stream.once("close", r2), stream.end()));
    return end();
  };
  sql2.close = async () => {
    stream && await new Promise((r2) => (stream.once("close", r2), stream.end()));
    return close();
  };
  return subscribe;
  async function subscribe(event, fn2, onsubscribe = noop, onerror = noop) {
    event = parseEvent(event);
    if (!connection2)
      connection2 = init2(sql2, slot, options.publications);
    const subscriber = { fn: fn2, onsubscribe };
    const fns = subscribers.has(event) ? subscribers.get(event).add(subscriber) : subscribers.set(event, /* @__PURE__ */ new Set([subscriber])).get(event);
    const unsubscribe = () => {
      fns.delete(subscriber);
      fns.size === 0 && subscribers.delete(event);
    };
    return connection2.then((x2) => {
      connected(x2);
      onsubscribe();
      stream && stream.on("error", onerror);
      return { unsubscribe, state, sql: sql2 };
    });
  }
  function connected(x2) {
    stream = x2.stream;
    state.pid = x2.state.pid;
    state.secret = x2.state.secret;
  }
  async function init2(sql3, slot2, publications) {
    if (!publications)
      throw new Error("Missing publication names");
    const xs = await sql3.unsafe(
      `CREATE_REPLICATION_SLOT ${slot2} TEMPORARY LOGICAL pgoutput NOEXPORT_SNAPSHOT`
    );
    const [x2] = xs;
    const stream2 = await sql3.unsafe(
      `START_REPLICATION SLOT ${slot2} LOGICAL ${x2.consistent_point} (proto_version '1', publication_names '${publications}')`
    ).writable();
    const state2 = {
      lsn: Buffer.concat(x2.consistent_point.split("/").map((x3) => Buffer.from(("00000000" + x3).slice(-8), "hex")))
    };
    stream2.on("data", data);
    stream2.on("error", error);
    stream2.on("close", sql3.close);
    return { stream: stream2, state: xs.state };
    function error(e) {
      console.error("Unexpected error during logical streaming - reconnecting", e);
    }
    function data(x3) {
      if (x3[0] === 119) {
        parse(x3.subarray(25), state2, sql3.options.parsers, handle2, options.transform);
      } else if (x3[0] === 107 && x3[17]) {
        state2.lsn = x3.subarray(1, 9);
        pong();
      }
    }
    function handle2(a2, b2) {
      const path = b2.relation.schema + "." + b2.relation.table;
      call("*", a2, b2);
      call("*:" + path, a2, b2);
      b2.relation.keys.length && call("*:" + path + "=" + b2.relation.keys.map((x3) => a2[x3.name]), a2, b2);
      call(b2.command, a2, b2);
      call(b2.command + ":" + path, a2, b2);
      b2.relation.keys.length && call(b2.command + ":" + path + "=" + b2.relation.keys.map((x3) => a2[x3.name]), a2, b2);
    }
    function pong() {
      const x3 = Buffer.alloc(34);
      x3[0] = "r".charCodeAt(0);
      x3.fill(state2.lsn, 1);
      x3.writeBigInt64BE(BigInt(Date.now() - Date.UTC(2e3, 0, 1)) * BigInt(1e3), 25);
      stream2.write(x3);
    }
  }
  function call(x2, a2, b2) {
    subscribers.has(x2) && subscribers.get(x2).forEach(({ fn: fn2 }) => fn2(a2, b2, x2));
  }
}
function Time(x2) {
  return new Date(Date.UTC(2e3, 0, 1) + Number(x2 / BigInt(1e3)));
}
function parse(x2, state, parsers2, handle2, transform) {
  const char2 = (acc, [k2, v2]) => (acc[k2.charCodeAt(0)] = v2, acc);
  Object.entries({
    R: (x3) => {
      let i2 = 1;
      const r2 = state[x3.readUInt32BE(i2)] = {
        schema: x3.toString("utf8", i2 += 4, i2 = x3.indexOf(0, i2)) || "pg_catalog",
        table: x3.toString("utf8", i2 + 1, i2 = x3.indexOf(0, i2 + 1)),
        columns: Array(x3.readUInt16BE(i2 += 2)),
        keys: []
      };
      i2 += 2;
      let columnIndex = 0, column;
      while (i2 < x3.length) {
        column = r2.columns[columnIndex++] = {
          key: x3[i2++],
          name: transform.column.from ? transform.column.from(x3.toString("utf8", i2, i2 = x3.indexOf(0, i2))) : x3.toString("utf8", i2, i2 = x3.indexOf(0, i2)),
          type: x3.readUInt32BE(i2 += 1),
          parser: parsers2[x3.readUInt32BE(i2)],
          atttypmod: x3.readUInt32BE(i2 += 4)
        };
        column.key && r2.keys.push(column);
        i2 += 4;
      }
    },
    Y: () => {
    },
    // Type
    O: () => {
    },
    // Origin
    B: (x3) => {
      state.date = Time(x3.readBigInt64BE(9));
      state.lsn = x3.subarray(1, 9);
    },
    I: (x3) => {
      let i2 = 1;
      const relation = state[x3.readUInt32BE(i2)];
      const { row } = tuples(x3, relation.columns, i2 += 7, transform);
      handle2(row, {
        command: "insert",
        relation
      });
    },
    D: (x3) => {
      let i2 = 1;
      const relation = state[x3.readUInt32BE(i2)];
      i2 += 4;
      const key = x3[i2] === 75;
      handle2(
        key || x3[i2] === 79 ? tuples(x3, relation.columns, i2 += 3, transform).row : null,
        {
          command: "delete",
          relation,
          key
        }
      );
    },
    U: (x3) => {
      let i2 = 1;
      const relation = state[x3.readUInt32BE(i2)];
      i2 += 4;
      const key = x3[i2] === 75;
      const xs = key || x3[i2] === 79 ? tuples(x3, relation.columns, i2 += 3, transform) : null;
      xs && (i2 = xs.i);
      const { row } = tuples(x3, relation.columns, i2 + 3, transform);
      handle2(row, {
        command: "update",
        relation,
        key,
        old: xs && xs.row
      });
    },
    T: () => {
    },
    // Truncate,
    C: () => {
    }
    // Commit
  }).reduce(char2, {})[x2[0]](x2);
}
function tuples(x2, columns, xi, transform) {
  let type, column, value;
  const row = transform.raw ? new Array(columns.length) : {};
  for (let i2 = 0; i2 < columns.length; i2++) {
    type = x2[xi++];
    column = columns[i2];
    value = type === 110 ? null : type === 117 ? void 0 : column.parser === void 0 ? x2.toString("utf8", xi + 4, xi += 4 + x2.readUInt32BE(xi)) : column.parser.array === true ? column.parser(x2.toString("utf8", xi + 5, xi += 4 + x2.readUInt32BE(xi))) : column.parser(x2.toString("utf8", xi + 4, xi += 4 + x2.readUInt32BE(xi)));
    transform.raw ? row[i2] = transform.raw === true ? value : transform.value.from ? transform.value.from(value, column) : value : row[column.name] = transform.value.from ? transform.value.from(value, column) : value;
  }
  return { i: xi, row: transform.row.from ? transform.row.from(row) : row };
}
function parseEvent(x2) {
  const xs = x2.match(/^(\*|insert|update|delete)?:?([^.]+?\.?[^=]+)?=?(.+)?/i) || [];
  if (!xs)
    throw new Error("Malformed subscribe pattern: " + x2);
  const [, command, path, key] = xs;
  return (command || "*") + (path ? ":" + (path.indexOf(".") === -1 ? "public." + path : path) : "") + (key ? "=" + key : "");
}
function largeObject(sql2, oid, mode = 131072 | 262144) {
  return new Promise(async (resolve, reject) => {
    await sql2.begin(async (sql3) => {
      let finish;
      !oid && ([{ oid }] = await sql3`select lo_creat(-1) as oid`);
      const [{ fd }] = await sql3`select lo_open(${oid}, ${mode}) as fd`;
      const lo = {
        writable,
        readable,
        close: () => sql3`select lo_close(${fd})`.then(finish),
        tell: () => sql3`select lo_tell64(${fd})`,
        read: (x2) => sql3`select loread(${fd}, ${x2}) as data`,
        write: (x2) => sql3`select lowrite(${fd}, ${x2})`,
        truncate: (x2) => sql3`select lo_truncate64(${fd}, ${x2})`,
        seek: (x2, whence = 0) => sql3`select lo_lseek64(${fd}, ${x2}, ${whence})`,
        size: () => sql3`
          select
            lo_lseek64(${fd}, location, 0) as position,
            seek.size
          from (
            select
              lo_lseek64($1, 0, 2) as size,
              tell.location
            from (select lo_tell64($1) as location) tell
          ) seek
        `
      };
      resolve(lo);
      return new Promise(async (r2) => finish = r2);
      async function readable({
        highWaterMark = 2048 * 8,
        start: start2 = 0,
        end = Infinity
      } = {}) {
        let max = end - start2;
        start2 && await lo.seek(start2);
        return new Stream.Readable({
          highWaterMark,
          async read(size2) {
            const l2 = size2 > max ? size2 - max : size2;
            max -= size2;
            const [{ data }] = await lo.read(l2);
            this.push(data);
            if (data.length < size2)
              this.push(null);
          }
        });
      }
      async function writable({
        highWaterMark = 2048 * 8,
        start: start2 = 0
      } = {}) {
        start2 && await lo.seek(start2);
        return new Stream.Writable({
          highWaterMark,
          write(chunk, encoding, callback) {
            lo.write(chunk).then(() => callback(), callback);
          }
        });
      }
    }).catch(reject);
  });
}
Object.assign(Postgres, {
  PostgresError,
  toPascal,
  pascal,
  toCamel,
  camel,
  toKebab,
  kebab,
  fromPascal,
  fromCamel,
  fromKebab,
  BigInt: {
    to: 20,
    from: [20],
    parse: (x2) => BigInt(x2),
    // eslint-disable-line
    serialize: (x2) => x2.toString()
  }
});
function Postgres(a2, b2) {
  const options = parseOptions(a2, b2), subscribe = options.no_subscribe || Subscribe(Postgres, { ...options });
  let ending = false;
  const queries = Queue(), connecting = Queue(), reserved = Queue(), closed = Queue(), ended = Queue(), open = Queue(), busy = Queue(), full = Queue(), queues = { connecting, closed };
  const connections = [...Array(options.max)].map(() => Connection(options, queues, { onopen, onend, onclose }));
  const sql2 = Sql(handler);
  Object.assign(sql2, {
    get parameters() {
      return options.parameters;
    },
    largeObject: largeObject.bind(null, sql2),
    subscribe,
    CLOSE,
    END: CLOSE,
    PostgresError,
    options,
    reserve,
    listen,
    begin,
    close,
    end
  });
  return sql2;
  function Sql(handler2) {
    handler2.debug = options.debug;
    Object.entries(options.types).reduce((acc, [name2, type]) => {
      acc[name2] = (x2) => new Parameter(x2, type.to);
      return acc;
    }, typed);
    Object.assign(sql22, {
      types: typed,
      typed,
      unsafe,
      notify,
      array,
      json: json2,
      file
    });
    return sql22;
    function typed(value, type) {
      return new Parameter(value, type);
    }
    function sql22(strings, ...args2) {
      const query = strings && Array.isArray(strings.raw) ? new Query(strings, args2, handler2, cancel) : typeof strings === "string" && !args2.length ? new Identifier(options.transform.column.to ? options.transform.column.to(strings) : strings) : new Builder(strings, args2);
      return query;
    }
    function unsafe(string, args2 = [], options2 = {}) {
      arguments.length === 2 && !Array.isArray(args2) && (options2 = args2, args2 = []);
      const query = new Query([string], args2, handler2, cancel, {
        prepare: false,
        ...options2,
        simple: "simple" in options2 ? options2.simple : args2.length === 0
      });
      return query;
    }
    function file(path, args2 = [], options2 = {}) {
      arguments.length === 2 && !Array.isArray(args2) && (options2 = args2, args2 = []);
      const query = new Query([], args2, (query2) => {
        s__default.readFile(path, "utf8", (err2, string) => {
          if (err2)
            return query2.reject(err2);
          query2.strings = [string];
          handler2(query2);
        });
      }, cancel, {
        ...options2,
        simple: "simple" in options2 ? options2.simple : args2.length === 0
      });
      return query;
    }
  }
  async function listen(name2, fn2, onlisten) {
    const listener = { fn: fn2, onlisten };
    const sql22 = listen.sql || (listen.sql = Postgres({
      ...options,
      max: 1,
      idle_timeout: null,
      max_lifetime: null,
      fetch_types: false,
      onclose() {
        Object.entries(listen.channels).forEach(([name22, { listeners }]) => {
          delete listen.channels[name22];
          Promise.all(listeners.map((l2) => listen(name22, l2.fn, l2.onlisten).catch(() => {
          })));
        });
      },
      onnotify(c2, x2) {
        c2 in listen.channels && listen.channels[c2].listeners.forEach((l2) => l2.fn(x2));
      }
    }));
    const channels = listen.channels || (listen.channels = {}), exists2 = name2 in channels;
    if (exists2) {
      channels[name2].listeners.push(listener);
      const result2 = await channels[name2].result;
      listener.onlisten && listener.onlisten();
      return { state: result2.state, unlisten };
    }
    channels[name2] = { result: sql22`listen ${sql22.unsafe('"' + name2.replace(/"/g, '""') + '"')}`, listeners: [listener] };
    const result = await channels[name2].result;
    listener.onlisten && listener.onlisten();
    return { state: result.state, unlisten };
    async function unlisten() {
      if (name2 in channels === false)
        return;
      channels[name2].listeners = channels[name2].listeners.filter((x2) => x2 !== listener);
      if (channels[name2].listeners.length)
        return;
      delete channels[name2];
      return sql22`unlisten ${sql22.unsafe('"' + name2.replace(/"/g, '""') + '"')}`;
    }
  }
  async function notify(channel, payload) {
    return await sql2`select pg_notify(${channel}, ${"" + payload})`;
  }
  async function reserve() {
    const queue = Queue();
    const c2 = open.length ? open.shift() : await new Promise((resolve, reject) => {
      const query = { reserve: resolve, reject };
      queries.push(query);
      closed.length && connect(closed.shift(), query);
    });
    move(c2, reserved);
    c2.reserved = () => queue.length ? c2.execute(queue.shift()) : move(c2, reserved);
    c2.reserved.release = true;
    const sql22 = Sql(handler2);
    sql22.release = () => {
      c2.reserved = null;
      onopen(c2);
    };
    return sql22;
    function handler2(q2) {
      c2.queue === full ? queue.push(q2) : c2.execute(q2) || move(c2, full);
    }
  }
  async function begin(options2, fn2) {
    !fn2 && (fn2 = options2, options2 = "");
    const queries2 = Queue();
    let savepoints = 0, connection2, prepare = null;
    try {
      await sql2.unsafe("begin " + options2.replace(/[^a-z ]/ig, ""), [], { onexecute }).execute();
      return await Promise.race([
        scope(connection2, fn2),
        new Promise((_2, reject) => connection2.onclose = reject)
      ]);
    } catch (error) {
      throw error;
    }
    async function scope(c2, fn22, name2) {
      const sql22 = Sql(handler2);
      sql22.savepoint = savepoint;
      sql22.prepare = (x2) => prepare = x2.replace(/[^a-z0-9$-_. ]/gi);
      let uncaughtError, result;
      name2 && await sql22`savepoint ${sql22(name2)}`;
      try {
        result = await new Promise((resolve, reject) => {
          const x2 = fn22(sql22);
          Promise.resolve(Array.isArray(x2) ? Promise.all(x2) : x2).then(resolve, reject);
        });
        if (uncaughtError)
          throw uncaughtError;
      } catch (e) {
        await (name2 ? sql22`rollback to ${sql22(name2)}` : sql22`rollback`);
        throw e instanceof PostgresError && e.code === "25P02" && uncaughtError || e;
      }
      if (!name2) {
        prepare ? await sql22`prepare transaction '${sql22.unsafe(prepare)}'` : await sql22`commit`;
      }
      return result;
      function savepoint(name22, fn3) {
        if (name22 && Array.isArray(name22.raw))
          return savepoint((sql3) => sql3.apply(sql3, arguments));
        arguments.length === 1 && (fn3 = name22, name22 = null);
        return scope(c2, fn3, "s" + savepoints++ + (name22 ? "_" + name22 : ""));
      }
      function handler2(q2) {
        q2.catch((e) => uncaughtError || (uncaughtError = e));
        c2.queue === full ? queries2.push(q2) : c2.execute(q2) || move(c2, full);
      }
    }
    function onexecute(c2) {
      connection2 = c2;
      move(c2, reserved);
      c2.reserved = () => queries2.length ? c2.execute(queries2.shift()) : move(c2, reserved);
    }
  }
  function move(c2, queue) {
    c2.queue.remove(c2);
    queue.push(c2);
    c2.queue = queue;
    queue === open ? c2.idleTimer.start() : c2.idleTimer.cancel();
    return c2;
  }
  function json2(x2) {
    return new Parameter(x2, 3802);
  }
  function array(x2, type) {
    if (!Array.isArray(x2))
      return array(Array.from(arguments));
    return new Parameter(x2, type || (x2.length ? inferType(x2) || 25 : 0), options.shared.typeArrayMap);
  }
  function handler(query) {
    if (ending)
      return query.reject(Errors.connection("CONNECTION_ENDED", options, options));
    if (open.length)
      return go(open.shift(), query);
    if (closed.length)
      return connect(closed.shift(), query);
    busy.length ? go(busy.shift(), query) : queries.push(query);
  }
  function go(c2, query) {
    return c2.execute(query) ? move(c2, busy) : move(c2, full);
  }
  function cancel(query) {
    return new Promise((resolve, reject) => {
      query.state ? query.active ? Connection(options).cancel(query.state, resolve, reject) : query.cancelled = { resolve, reject } : (queries.remove(query), query.cancelled = true, query.reject(Errors.generic("57014", "canceling statement due to user request")), resolve());
    });
  }
  async function end({ timeout = null } = {}) {
    if (ending)
      return ending;
    await 1;
    let timer2;
    return ending = Promise.race([
      new Promise((r2) => timeout !== null && (timer2 = setTimeout(destroy, timeout * 1e3, r2))),
      Promise.all(connections.map((c2) => c2.end()).concat(
        listen.sql ? listen.sql.end({ timeout: 0 }) : [],
        subscribe.sql ? subscribe.sql.end({ timeout: 0 }) : []
      ))
    ]).then(() => clearTimeout(timer2));
  }
  async function close() {
    await Promise.all(connections.map((c2) => c2.end()));
  }
  async function destroy(resolve) {
    await Promise.all(connections.map((c2) => c2.terminate()));
    while (queries.length)
      queries.shift().reject(Errors.connection("CONNECTION_DESTROYED", options));
    resolve();
  }
  function connect(c2, query) {
    move(c2, connecting);
    c2.connect(query);
    return c2;
  }
  function onend(c2) {
    move(c2, ended);
  }
  function onopen(c2) {
    if (queries.length === 0)
      return move(c2, open);
    let max = Math.ceil(queries.length / (connecting.length + 1)), ready = true;
    while (ready && queries.length && max-- > 0) {
      const query = queries.shift();
      if (query.reserve)
        return query.reserve(c2);
      ready = c2.execute(query);
    }
    ready ? move(c2, busy) : move(c2, full);
  }
  function onclose(c2, e) {
    move(c2, closed);
    c2.reserved = null;
    c2.onclose && (c2.onclose(e), c2.onclose = null);
    options.onclose && options.onclose(c2.id);
    queries.length && connect(c2, queries.shift());
  }
}
function parseOptions(a2, b2) {
  if (a2 && a2.shared)
    return a2;
  const env = process.env, o2 = (!a2 || typeof a2 === "string" ? b2 : a2) || {}, { url, multihost } = parseUrl(a2), query = [...url.searchParams].reduce((a22, [b22, c2]) => (a22[b22] = c2, a22), {}), host = o2.hostname || o2.host || multihost || url.hostname || env.PGHOST || "localhost", port = o2.port || url.port || env.PGPORT || 5432, user2 = o2.user || o2.username || url.username || env.PGUSERNAME || env.PGUSER || osUsername();
  o2.no_prepare && (o2.prepare = false);
  query.sslmode && (query.ssl = query.sslmode, delete query.sslmode);
  "timeout" in o2 && (console.log("The timeout option is deprecated, use idle_timeout instead"), o2.idle_timeout = o2.timeout);
  query.sslrootcert === "system" && (query.ssl = "verify-full");
  const ints = ["idle_timeout", "connect_timeout", "max_lifetime", "max_pipeline", "backoff", "keep_alive"];
  const defaults = {
    max: globalThis.Cloudflare ? 3 : 10,
    ssl: false,
    sslnegotiation: null,
    idle_timeout: null,
    connect_timeout: 30,
    max_lifetime,
    max_pipeline: 100,
    backoff,
    keep_alive: 60,
    prepare: true,
    debug: false,
    fetch_types: true,
    publications: "alltables",
    target_session_attrs: null
  };
  return {
    host: Array.isArray(host) ? host : host.split(",").map((x2) => x2.split(":")[0]),
    port: Array.isArray(port) ? port : host.split(",").map((x2) => parseInt(x2.split(":")[1] || port)),
    path: o2.path || host.indexOf("/") > -1 && host + "/.s.PGSQL." + port,
    database: o2.database || o2.db || (url.pathname || "").slice(1) || env.PGDATABASE || user2,
    user: user2,
    pass: o2.pass || o2.password || url.password || env.PGPASSWORD || "",
    ...Object.entries(defaults).reduce(
      (acc, [k2, d2]) => {
        const value = k2 in o2 ? o2[k2] : k2 in query ? query[k2] === "disable" || query[k2] === "false" ? false : query[k2] : env["PG" + k2.toUpperCase()] || d2;
        acc[k2] = typeof value === "string" && ints.includes(k2) ? +value : value;
        return acc;
      },
      {}
    ),
    connection: {
      application_name: env.PGAPPNAME || "postgres.js",
      ...o2.connection,
      ...Object.entries(query).reduce((acc, [k2, v2]) => (k2 in defaults || (acc[k2] = v2), acc), {})
    },
    types: o2.types || {},
    target_session_attrs: tsa(o2, url, env),
    onnotice: o2.onnotice,
    onnotify: o2.onnotify,
    onclose: o2.onclose,
    onparameter: o2.onparameter,
    socket: o2.socket,
    transform: parseTransform(o2.transform || { undefined: void 0 }),
    parameters: {},
    shared: { retries: 0, typeArrayMap: {} },
    ...mergeUserTypes(o2.types)
  };
}
function tsa(o2, url, env) {
  const x2 = o2.target_session_attrs || url.searchParams.get("target_session_attrs") || env.PGTARGETSESSIONATTRS;
  if (!x2 || ["read-write", "read-only", "primary", "standby", "prefer-standby"].includes(x2))
    return x2;
  throw new Error("target_session_attrs " + x2 + " is not supported");
}
function backoff(retries) {
  return (0.5 + Math.random() / 2) * Math.min(3 ** retries / 100, 20);
}
function max_lifetime() {
  return 60 * (30 + Math.random() * 30);
}
function parseTransform(x2) {
  return {
    undefined: x2.undefined,
    column: {
      from: typeof x2.column === "function" ? x2.column : x2.column && x2.column.from,
      to: x2.column && x2.column.to
    },
    value: {
      from: typeof x2.value === "function" ? x2.value : x2.value && x2.value.from,
      to: x2.value && x2.value.to
    },
    row: {
      from: typeof x2.row === "function" ? x2.row : x2.row && x2.row.from,
      to: x2.row && x2.row.to
    }
  };
}
function parseUrl(url) {
  if (!url || typeof url !== "string")
    return { url: { searchParams: /* @__PURE__ */ new Map() } };
  let host = url;
  host = host.slice(host.indexOf("://") + 3).split(/[?/]/)[0];
  host = decodeURIComponent(host.slice(host.indexOf("@") + 1));
  const urlObj = new URL(url.replace(host, host.split(",")[0]));
  return {
    url: {
      username: decodeURIComponent(urlObj.username),
      password: decodeURIComponent(urlObj.password),
      host: urlObj.host,
      hostname: urlObj.hostname,
      port: urlObj.port,
      pathname: urlObj.pathname,
      searchParams: urlObj.searchParams
    },
    multihost: host.indexOf(",") > -1 && host
  };
}
function osUsername() {
  try {
    return os.userInfo().username;
  } catch (_2) {
    return process.env.USERNAME || process.env.USER || process.env.LOGNAME;
  }
}
class ConsoleLogWriter {
  static [entityKind] = "ConsoleLogWriter";
  write(message) {
    console.log(message);
  }
}
class DefaultLogger {
  static [entityKind] = "DefaultLogger";
  writer;
  constructor(config) {
    this.writer = config?.writer ?? new ConsoleLogWriter();
  }
  logQuery(query, params) {
    const stringifiedParams = params.map((p2) => {
      try {
        return JSON.stringify(p2);
      } catch {
        return String(p2);
      }
    });
    const paramsStr = stringifiedParams.length ? ` -- params: [${stringifiedParams.join(", ")}]` : "";
    this.writer.write(`Query: ${query}${paramsStr}`);
  }
}
class NoopLogger {
  static [entityKind] = "NoopLogger";
  logQuery() {
  }
}
var p = Object.create;
var i = Object.defineProperty;
var c = Object.getOwnPropertyDescriptor;
var f = Object.getOwnPropertyNames;
var l$2 = Object.getPrototypeOf, s$1 = Object.prototype.hasOwnProperty;
var a = (t) => {
  throw TypeError(t);
};
var _$1 = (t, e, o2) => e in t ? i(t, e, { enumerable: true, configurable: true, writable: true, value: o2 }) : t[e] = o2;
var d = (t, e) => () => (t && (e = t(t = 0)), e);
var D$1 = (t, e) => () => (e || t((e = { exports: {} }).exports, e), e.exports), F$1 = (t, e) => {
  for (var o2 in e) i(t, o2, { get: e[o2], enumerable: true });
}, g$4 = (t, e, o2, m2) => {
  if (e && typeof e == "object" || typeof e == "function") for (let r2 of f(e)) !s$1.call(t, r2) && r2 !== o2 && i(t, r2, { get: () => e[r2], enumerable: !(m2 = c(e, r2)) || m2.enumerable });
  return t;
};
var L$2 = (t, e, o2) => (o2 = t != null ? p(l$2(t)) : {}, g$4(i(o2, "default", { value: t, enumerable: true }), t));
var P$1 = (t, e, o2) => _$1(t, typeof e != "symbol" ? e + "" : e, o2), n = (t, e, o2) => e.has(t) || a("Cannot " + o2);
var h$1 = (t, e, o2) => (n(t, e, "read from private field"), o2 ? o2.call(t) : e.get(t)), R$2 = (t, e, o2) => e.has(t) ? a("Cannot add the same private member more than once") : e instanceof WeakSet ? e.add(t) : e.set(t, o2), x$2 = (t, e, o2, m2) => (n(t, e, "write to private field"), e.set(t, o2), o2), T = (t, e, o2) => (n(t, e, "access private method"), o2);
var U$1 = (t, e, o2, m2) => ({ set _(r2) {
  x$2(t, e, r2);
}, get _() {
  return h$1(t, e, m2);
} });
var u$1 = d(() => {
});
var hn = {};
F$1(hn, { ABSTIME: () => Et, ACLITEM: () => Vt, BIT: () => Wt, BOOL: () => be, BPCHAR: () => _e$1, BYTEA: () => ge$1, CHAR: () => gt, CID: () => St, CIDR: () => Tt, CIRCLE: () => Ut, DATE: () => He$1, FLOAT4: () => je$1, FLOAT8: () => Qe$1, GTSVECTOR: () => rn, INET: () => kt, INT2: () => ve, INT4: () => Ge, INT8: () => we, INTERVAL: () => vt, JSON: () => Ae$1, JSONB: () => Ye, MACADDR: () => Ot, MACADDR8: () => Nt, MONEY: () => Lt, NUMERIC: () => Qt, OID: () => We$1, PATH: () => Mt, PG_DEPENDENCIES: () => en, PG_LSN: () => Xt, PG_NDISTINCT: () => Zt, PG_NODE_TREE: () => Bt, POLYGON: () => Rt, REFCURSOR: () => _t, REGCLASS: () => Yt, REGCONFIG: () => sn, REGDICTIONARY: () => an, REGNAMESPACE: () => on, REGOPER: () => Ht, REGOPERATOR: () => qt, REGPROC: () => wt, REGPROCEDURE: () => zt, REGROLE: () => un, REGTYPE: () => $t, RELTIME: () => Ct, SMGR: () => It, TEXT: () => F, TID: () => At, TIME: () => Ft, TIMESTAMP: () => qe$1, TIMESTAMPTZ: () => xe, TIMETZ: () => Gt, TINTERVAL: () => Pt, TSQUERY: () => nn, TSVECTOR: () => tn, TXID_SNAPSHOT: () => Jt, UUID: () => Kt, VARBIT: () => jt, VARCHAR: () => ze, XID: () => xt, XML: () => Dt, arrayParser: () => yn, arraySerializer: () => Ke$1, parseType: () => ue, parsers: () => ln, serializers: () => cn, types: () => $e });
u$1();
var ht = globalThis.JSON.parse, bt = globalThis.JSON.stringify, be = 16, ge$1 = 17, gt = 18, we = 20, ve = 21, Ge = 23, wt = 24, F = 25, We$1 = 26, At = 27, xt = 28, St = 29, Ae$1 = 114, Dt = 142, Bt = 194, It = 210, Mt = 602, Rt = 604, Tt = 650, je$1 = 700, Qe$1 = 701, Et = 702, Ct = 703, Pt = 704, Ut = 718, Nt = 774, Lt = 790, Ot = 829, kt = 869, Vt = 1033, _e$1 = 1042, ze = 1043, He$1 = 1082, Ft = 1083, qe$1 = 1114, xe = 1184, vt = 1186, Gt = 1266, Wt = 1560, jt = 1562, Qt = 1700, _t = 1790, zt = 2202, Ht = 2203, qt = 2204, Yt = 2205, $t = 2206, Kt = 2950, Jt = 2970, Xt = 3220, Zt = 3361, en = 3402, tn = 3614, nn = 3615, rn = 3642, sn = 3734, an = 3769, Ye = 3802, on = 4089, un = 4096, $e = { string: { to: F, from: [F, ze, _e$1], serialize: (e) => {
  if (typeof e == "string") return e;
  if (typeof e == "number") return e.toString();
  throw new Error("Invalid input for string type");
}, parse: (e) => e }, number: { to: 0, from: [ve, Ge, We$1, je$1, Qe$1], serialize: (e) => e.toString(), parse: (e) => +e }, bigint: { to: we, from: [we], serialize: (e) => e.toString(), parse: (e) => {
  let t = BigInt(e);
  return t < Number.MIN_SAFE_INTEGER || t > Number.MAX_SAFE_INTEGER ? t : Number(t);
} }, json: { to: Ae$1, from: [Ae$1, Ye], serialize: (e) => typeof e == "string" ? e : bt(e), parse: (e) => ht(e) }, boolean: { to: be, from: [be], serialize: (e) => {
  if (typeof e != "boolean") throw new Error("Invalid input for boolean type");
  return e ? "t" : "f";
}, parse: (e) => e === "t" }, date: { to: xe, from: [He$1, qe$1, xe], serialize: (e) => {
  if (typeof e == "string") return e;
  if (typeof e == "number") return new Date(e).toISOString();
  if (e instanceof Date) return e.toISOString();
  throw new Error("Invalid input for date type");
}, parse: (e) => new Date(e) }, bytea: { to: ge$1, from: [ge$1], serialize: (e) => {
  if (!(e instanceof Uint8Array)) throw new Error("Invalid input for bytea type");
  return "\\x" + Array.from(e).map((t) => t.toString(16).padStart(2, "0")).join("");
}, parse: (e) => {
  let t = e.slice(2);
  return Uint8Array.from({ length: t.length / 2 }, (n2, r2) => parseInt(t.substring(r2 * 2, (r2 + 1) * 2), 16));
} } }, Se = pn($e), ln = Se.parsers, cn = Se.serializers;
function ue(e, t, n2) {
  if (e === null) return null;
  let r2 = n2?.[t] ?? Se.parsers[t];
  return r2 ? r2(e, t) : e;
}
function pn(e) {
  return Object.keys(e).reduce(({ parsers: t, serializers: n2 }, r2) => {
    let { to: i2, from: a2, serialize: u2, parse: d2 } = e[r2];
    return n2[i2] = u2, n2[r2] = u2, t[r2] = d2, Array.isArray(a2) ? a2.forEach((c2) => {
      t[c2] = d2, n2[c2] = u2;
    }) : (t[a2] = d2, n2[a2] = u2), { parsers: t, serializers: n2 };
  }, { parsers: {}, serializers: {} });
}
var dn = /\\/g, fn = /"/g;
function mn(e) {
  return e.replace(dn, "\\\\").replace(fn, '\\"');
}
function Ke$1(e, t, n2) {
  if (Array.isArray(e) === false) return e;
  if (!e.length) return "{}";
  let r2 = e[0], i2 = n2 === 1020 ? ";" : ",";
  return Array.isArray(r2) ? `{${e.map((a2) => Ke$1(a2, t, n2)).join(i2)}}` : `{${e.map((a2) => (a2 === void 0 && (a2 = null), a2 === null ? "null" : '"' + mn(t ? t(a2) : a2.toString()) + '"')).join(i2)}}`;
}
var he = { i: 0, char: null, str: "", quoted: false, last: 0, p: null };
function yn(e, t, n2) {
  return he.i = he.last = 0, Je(he, e, t, n2)[0];
}
function Je(e, t, n2, r2) {
  let i2 = [], a2 = r2 === 1020 ? ";" : ",";
  for (; e.i < t.length; e.i++) {
    if (e.char = t[e.i], e.quoted) e.char === "\\" ? e.str += t[++e.i] : e.char === '"' ? (i2.push(n2 ? n2(e.str) : e.str), e.str = "", e.quoted = t[e.i + 1] === '"', e.last = e.i + 2) : e.str += e.char;
    else if (e.char === '"') e.quoted = true;
    else if (e.char === "{") e.last = ++e.i, i2.push(Je(e, t, n2, r2));
    else if (e.char === "}") {
      e.quoted = false, e.last < e.i && i2.push(n2 ? n2(t.slice(e.last, e.i)) : t.slice(e.last, e.i)), e.last = e.i + 1;
      break;
    } else e.char === a2 && e.p !== "}" && e.p !== '"' && (i2.push(n2 ? n2(t.slice(e.last, e.i)) : t.slice(e.last, e.i)), e.last = e.i + 1);
    e.p = e.char;
  }
  return e.last < e.i && i2.push(n2 ? n2(t.slice(e.last, e.i + 1)) : t.slice(e.last, e.i + 1)), i2;
}
var wn = {};
F$1(wn, { parseDescribeStatementResults: () => De, parseResults: () => bn });
u$1();
function bn(e, t, n2, r2) {
  let i2 = [], a2 = { rows: [], fields: [] }, u2 = 0, d2 = { ...t, ...n2?.parsers };
  return e.forEach((c2) => {
    switch (c2.name) {
      case "rowDescription": {
        let V2 = c2;
        a2.fields = V2.fields.map((T2) => ({ name: T2.name, dataTypeID: T2.dataTypeID }));
        break;
      }
      case "dataRow": {
        if (!a2) break;
        let V2 = c2;
        n2?.rowMode === "array" ? a2.rows.push(V2.fields.map((T2, ie2) => ue(T2, a2.fields[ie2].dataTypeID, d2))) : a2.rows.push(Object.fromEntries(V2.fields.map((T2, ie2) => [a2.fields[ie2].name, ue(T2, a2.fields[ie2].dataTypeID, d2)])));
        break;
      }
      case "commandComplete": {
        u2 += gn(c2), i2.push({ ...a2, affectedRows: u2, ...r2 ? { blob: r2 } : {} }), a2 = { rows: [], fields: [] };
        break;
      }
    }
  }), i2.length === 0 && i2.push({ affectedRows: 0, rows: [], fields: [] }), i2;
}
function gn(e) {
  let t = e.text.split(" ");
  switch (t[0]) {
    case "INSERT":
      return parseInt(t[2], 10);
    case "UPDATE":
    case "DELETE":
    case "COPY":
      return parseInt(t[1], 10);
    default:
      return 0;
  }
}
function De(e) {
  let t = e.find((n2) => n2.name === "parameterDescription");
  return t ? t.dataTypeIDs : [];
}
var Ue$1 = {};
F$1(Ue$1, { AuthenticationCleartextPassword: () => G$1, AuthenticationMD5Password: () => W$1, AuthenticationOk: () => v, AuthenticationSASL: () => j$1, AuthenticationSASLContinue: () => Q, AuthenticationSASLFinal: () => _, BackendKeyDataMessage: () => J$1, CommandCompleteMessage: () => ee$1, CopyDataMessage: () => z$1, CopyResponse: () => H$2, DataRowMessage: () => te$1, DatabaseError: () => E, Field: () => q, NoticeMessage: () => ne, NotificationResponseMessage: () => X, ParameterDescriptionMessage: () => $$1, ParameterStatusMessage: () => K$1, ReadyForQueryMessage: () => Z$1, RowDescriptionMessage: () => Y$1, bindComplete: () => Ie$1, closeComplete: () => Me, copyDone: () => Pe$1, emptyQuery: () => Ce, noData: () => Re, parseComplete: () => Be, portalSuspended: () => Te$1, replicationStart: () => Ee });
u$1();
var Be = { name: "parseComplete", length: 5 }, Ie$1 = { name: "bindComplete", length: 5 }, Me = { name: "closeComplete", length: 5 }, Re = { name: "noData", length: 5 }, Te$1 = { name: "portalSuspended", length: 5 }, Ee = { name: "replicationStart", length: 4 }, Ce = { name: "emptyQuery", length: 4 }, Pe$1 = { name: "copyDone", length: 4 }, v = class {
  constructor(t) {
    this.length = t;
    this.name = "authenticationOk";
  }
}, G$1 = class G2 {
  constructor(t) {
    this.length = t;
    this.name = "authenticationCleartextPassword";
  }
}, W$1 = class W2 {
  constructor(t, n2) {
    this.length = t;
    this.salt = n2;
    this.name = "authenticationMD5Password";
  }
}, j$1 = class j2 {
  constructor(t, n2) {
    this.length = t;
    this.mechanisms = n2;
    this.name = "authenticationSASL";
  }
}, Q = class {
  constructor(t, n2) {
    this.length = t;
    this.data = n2;
    this.name = "authenticationSASLContinue";
  }
}, _ = class {
  constructor(t, n2) {
    this.length = t;
    this.data = n2;
    this.name = "authenticationSASLFinal";
  }
}, E = class extends Error {
  constructor(n2, r2, i2) {
    super(n2);
    this.length = r2;
    this.name = i2;
  }
}, z$1 = class z2 {
  constructor(t, n2) {
    this.length = t;
    this.chunk = n2;
    this.name = "copyData";
  }
}, H$2 = class H2 {
  constructor(t, n2, r2, i2) {
    this.length = t;
    this.name = n2;
    this.binary = r2;
    this.columnTypes = new Array(i2);
  }
}, q = class {
  constructor(t, n2, r2, i2, a2, u2, d2) {
    this.name = t;
    this.tableID = n2;
    this.columnID = r2;
    this.dataTypeID = i2;
    this.dataTypeSize = a2;
    this.dataTypeModifier = u2;
    this.format = d2;
  }
}, Y$1 = class Y2 {
  constructor(t, n2) {
    this.length = t;
    this.fieldCount = n2;
    this.name = "rowDescription";
    this.fields = new Array(this.fieldCount);
  }
}, $$1 = class $2 {
  constructor(t, n2) {
    this.length = t;
    this.parameterCount = n2;
    this.name = "parameterDescription";
    this.dataTypeIDs = new Array(this.parameterCount);
  }
}, K$1 = class K2 {
  constructor(t, n2, r2) {
    this.length = t;
    this.parameterName = n2;
    this.parameterValue = r2;
    this.name = "parameterStatus";
  }
}, J$1 = class J2 {
  constructor(t, n2, r2) {
    this.length = t;
    this.processID = n2;
    this.secretKey = r2;
    this.name = "backendKeyData";
  }
}, X = class {
  constructor(t, n2, r2, i2) {
    this.length = t;
    this.processId = n2;
    this.channel = r2;
    this.payload = i2;
    this.name = "notification";
  }
}, Z$1 = class Z2 {
  constructor(t, n2) {
    this.length = t;
    this.status = n2;
    this.name = "readyForQuery";
  }
}, ee$1 = class ee2 {
  constructor(t, n2) {
    this.length = t;
    this.text = n2;
    this.name = "commandComplete";
  }
}, te$1 = class te2 {
  constructor(t, n2) {
    this.length = t;
    this.fields = n2;
    this.name = "dataRow";
    this.fieldCount = n2.length;
  }
}, ne = class {
  constructor(t, n2) {
    this.length = t;
    this.message = n2;
    this.name = "notice";
  }
};
var zn = {};
F$1(zn, { Parser: () => ye, messages: () => Ue$1, serialize: () => O$1 });
u$1();
u$1();
u$1();
u$1();
function C$1(e) {
  let t = e.length;
  for (let n2 = e.length - 1; n2 >= 0; n2--) {
    let r2 = e.charCodeAt(n2);
    r2 > 127 && r2 <= 2047 ? t++ : r2 > 2047 && r2 <= 65535 && (t += 2), r2 >= 56320 && r2 <= 57343 && n2--;
  }
  return t;
}
var b$1, g$3, U, ce$2, N, x$1, le, P, Xe, R$1 = class R2 {
  constructor(t = 256) {
    this.size = t;
    R$2(this, x$1);
    R$2(this, b$1);
    R$2(this, g$3, 5);
    R$2(this, U, false);
    R$2(this, ce$2, new TextEncoder());
    R$2(this, N, 0);
    x$2(this, b$1, T(this, x$1, le).call(this, t));
  }
  addInt32(t) {
    return T(this, x$1, P).call(this, 4), h$1(this, b$1).setInt32(h$1(this, g$3), t, h$1(this, U)), x$2(this, g$3, h$1(this, g$3) + 4), this;
  }
  addInt16(t) {
    return T(this, x$1, P).call(this, 2), h$1(this, b$1).setInt16(h$1(this, g$3), t, h$1(this, U)), x$2(this, g$3, h$1(this, g$3) + 2), this;
  }
  addCString(t) {
    return t && this.addString(t), T(this, x$1, P).call(this, 1), h$1(this, b$1).setUint8(h$1(this, g$3), 0), U$1(this, g$3)._++, this;
  }
  addString(t = "") {
    let n2 = C$1(t);
    return T(this, x$1, P).call(this, n2), h$1(this, ce$2).encodeInto(t, new Uint8Array(h$1(this, b$1).buffer, h$1(this, g$3))), x$2(this, g$3, h$1(this, g$3) + n2), this;
  }
  add(t) {
    return T(this, x$1, P).call(this, t.byteLength), new Uint8Array(h$1(this, b$1).buffer).set(new Uint8Array(t), h$1(this, g$3)), x$2(this, g$3, h$1(this, g$3) + t.byteLength), this;
  }
  flush(t) {
    let n2 = T(this, x$1, Xe).call(this, t);
    return x$2(this, g$3, 5), x$2(this, b$1, T(this, x$1, le).call(this, this.size)), new Uint8Array(n2);
  }
};
b$1 = /* @__PURE__ */ new WeakMap(), g$3 = /* @__PURE__ */ new WeakMap(), U = /* @__PURE__ */ new WeakMap(), ce$2 = /* @__PURE__ */ new WeakMap(), N = /* @__PURE__ */ new WeakMap(), x$1 = /* @__PURE__ */ new WeakSet(), le = function(t) {
  return new DataView(new ArrayBuffer(t));
}, P = function(t) {
  if (h$1(this, b$1).byteLength - h$1(this, g$3) < t) {
    let r2 = h$1(this, b$1).buffer, i2 = r2.byteLength + (r2.byteLength >> 1) + t;
    x$2(this, b$1, T(this, x$1, le).call(this, i2)), new Uint8Array(h$1(this, b$1).buffer).set(new Uint8Array(r2));
  }
}, Xe = function(t) {
  if (t) {
    h$1(this, b$1).setUint8(h$1(this, N), t);
    let n2 = h$1(this, g$3) - (h$1(this, N) + 1);
    h$1(this, b$1).setInt32(h$1(this, N) + 1, n2, h$1(this, U));
  }
  return h$1(this, b$1).buffer.slice(t ? 0 : 5, h$1(this, g$3));
};
var m = new R$1(), An = (e) => {
  m.addInt16(3).addInt16(0);
  for (let r2 of Object.keys(e)) m.addCString(r2).addCString(e[r2]);
  m.addCString("client_encoding").addCString("UTF8");
  let t = m.addCString("").flush(), n2 = t.byteLength + 4;
  return new R$1().addInt32(n2).add(t).flush();
}, xn = () => {
  let e = new DataView(new ArrayBuffer(8));
  return e.setInt32(0, 8, false), e.setInt32(4, 80877103, false), new Uint8Array(e.buffer);
}, Sn = (e) => m.addCString(e).flush(112), Dn = (e, t) => (m.addCString(e).addInt32(C$1(t)).addString(t), m.flush(112)), Bn = (e) => m.addString(e).flush(112), In = (e) => m.addCString(e).flush(81), Mn = [], Rn = (e) => {
  let t = e.name ?? "";
  t.length > 63 && (console.error("Warning! Postgres only supports 63 characters for query names."), console.error("You supplied %s (%s)", t, t.length), console.error("This can cause conflicts and silent errors executing queries"));
  let n2 = m.addCString(t).addCString(e.text).addInt16(e.types?.length ?? 0);
  return e.types?.forEach((r2) => n2.addInt32(r2)), m.flush(80);
}, L$1 = new R$1();
var Tn = (e, t) => {
  for (let n2 = 0; n2 < e.length; n2++) {
    let r2 = t ? t(e[n2], n2) : e[n2];
    if (r2 === null) m.addInt16(0), L$1.addInt32(-1);
    else if (r2 instanceof ArrayBuffer || ArrayBuffer.isView(r2)) {
      let i2 = ArrayBuffer.isView(r2) ? r2.buffer.slice(r2.byteOffset, r2.byteOffset + r2.byteLength) : r2;
      m.addInt16(1), L$1.addInt32(i2.byteLength), L$1.add(i2);
    } else m.addInt16(0), L$1.addInt32(C$1(r2)), L$1.addString(r2);
  }
}, En = (e = {}) => {
  let t = e.portal ?? "", n2 = e.statement ?? "", r2 = e.binary ?? false, i2 = e.values ?? Mn, a2 = i2.length;
  return m.addCString(t).addCString(n2), m.addInt16(a2), Tn(i2, e.valueMapper), m.addInt16(a2), m.add(L$1.flush()), m.addInt16(r2 ? 1 : 0), m.flush(66);
}, Cn = new Uint8Array([69, 0, 0, 0, 9, 0, 0, 0, 0, 0]), Pn = (e) => {
  if (!e || !e.portal && !e.rows) return Cn;
  let t = e.portal ?? "", n2 = e.rows ?? 0, r2 = C$1(t), i2 = 4 + r2 + 1 + 4, a2 = new DataView(new ArrayBuffer(1 + i2));
  return a2.setUint8(0, 69), a2.setInt32(1, i2, false), new TextEncoder().encodeInto(t, new Uint8Array(a2.buffer, 5)), a2.setUint8(r2 + 5, 0), a2.setUint32(a2.byteLength - 4, n2, false), new Uint8Array(a2.buffer);
}, Un = (e, t) => {
  let n2 = new DataView(new ArrayBuffer(16));
  return n2.setInt32(0, 16, false), n2.setInt16(4, 1234, false), n2.setInt16(6, 5678, false), n2.setInt32(8, e, false), n2.setInt32(12, t, false), new Uint8Array(n2.buffer);
}, Ne = (e, t) => {
  let n2 = new R$1();
  return n2.addCString(t), n2.flush(e);
}, Nn = m.addCString("P").flush(68), Ln = m.addCString("S").flush(68), On = (e) => e.name ? Ne(68, `${e.type}${e.name ?? ""}`) : e.type === "P" ? Nn : Ln, kn = (e) => {
  let t = `${e.type}${e.name ?? ""}`;
  return Ne(67, t);
}, Vn = (e) => m.add(e).flush(100), Fn = (e) => Ne(102, e), pe$1 = (e) => new Uint8Array([e, 0, 0, 0, 4]), vn = pe$1(72), Gn = pe$1(83), Wn = pe$1(88), jn = pe$1(99), O$1 = { startup: An, password: Sn, requestSsl: xn, sendSASLInitialResponseMessage: Dn, sendSCRAMClientFinalMessage: Bn, query: In, parse: Rn, bind: En, execute: Pn, describe: On, close: kn, flush: () => vn, sync: () => Gn, end: () => Wn, copyData: Vn, copyDone: () => jn, copyFail: Fn, cancel: Un };
u$1();
u$1();
var Le = { text: 0, binary: 1 };
u$1();
var Qn = new ArrayBuffer(0), M, w$1, fe, me$1, re$1, de = class {
  constructor(t = 0) {
    R$2(this, M, new DataView(Qn));
    R$2(this, w$1);
    R$2(this, fe, "utf-8");
    R$2(this, me$1, new TextDecoder(h$1(this, fe)));
    R$2(this, re$1, false);
    x$2(this, w$1, t);
  }
  setBuffer(t, n2) {
    x$2(this, w$1, t), x$2(this, M, new DataView(n2));
  }
  int16() {
    let t = h$1(this, M).getInt16(h$1(this, w$1), h$1(this, re$1));
    return x$2(this, w$1, h$1(this, w$1) + 2), t;
  }
  byte() {
    let t = h$1(this, M).getUint8(h$1(this, w$1));
    return U$1(this, w$1)._++, t;
  }
  int32() {
    let t = h$1(this, M).getInt32(h$1(this, w$1), h$1(this, re$1));
    return x$2(this, w$1, h$1(this, w$1) + 4), t;
  }
  string(t) {
    return h$1(this, me$1).decode(this.bytes(t));
  }
  cstring() {
    let t = h$1(this, w$1), n2 = t;
    for (; h$1(this, M).getUint8(n2++) !== 0; ) ;
    let r2 = this.string(n2 - t - 1);
    return x$2(this, w$1, n2), r2;
  }
  bytes(t) {
    let n2 = h$1(this, M).buffer.slice(h$1(this, w$1), h$1(this, w$1) + t);
    return x$2(this, w$1, h$1(this, w$1) + t), new Uint8Array(n2);
  }
};
M = /* @__PURE__ */ new WeakMap(), w$1 = /* @__PURE__ */ new WeakMap(), fe = /* @__PURE__ */ new WeakMap(), me$1 = /* @__PURE__ */ new WeakMap(), re$1 = /* @__PURE__ */ new WeakMap();
var Oe = 1, _n = 4, Ze = Oe + _n, et = new ArrayBuffer(0);
var A, S, D, o$1, l$1, tt, nt, rt, st, it, at, ot, ke$1, ut, lt, ct, pt, dt, ft, mt, yt, Ve$1, ye = class {
  constructor() {
    R$2(this, l$1);
    R$2(this, A, new DataView(et));
    R$2(this, S, 0);
    R$2(this, D, 0);
    R$2(this, o$1, new de());
  }
  parse(t, n2) {
    T(this, l$1, tt).call(this, ArrayBuffer.isView(t) ? t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength) : t);
    let r2 = h$1(this, D) + h$1(this, S), i2 = h$1(this, D);
    for (; i2 + Ze <= r2; ) {
      let a2 = h$1(this, A).getUint8(i2), u2 = h$1(this, A).getUint32(i2 + Oe, false), d2 = Oe + u2;
      if (d2 + i2 <= r2) {
        let c2 = T(this, l$1, nt).call(this, i2 + Ze, a2, u2, h$1(this, A).buffer);
        n2(c2), i2 += d2;
      } else break;
    }
    i2 === r2 ? (x$2(this, A, new DataView(et)), x$2(this, S, 0), x$2(this, D, 0)) : (x$2(this, S, r2 - i2), x$2(this, D, i2));
  }
};
A = /* @__PURE__ */ new WeakMap(), S = /* @__PURE__ */ new WeakMap(), D = /* @__PURE__ */ new WeakMap(), o$1 = /* @__PURE__ */ new WeakMap(), l$1 = /* @__PURE__ */ new WeakSet(), tt = function(t) {
  if (h$1(this, S) > 0) {
    let n2 = h$1(this, S) + t.byteLength;
    if (n2 + h$1(this, D) > h$1(this, A).byteLength) {
      let i2;
      if (n2 <= h$1(this, A).byteLength && h$1(this, D) >= h$1(this, S)) i2 = h$1(this, A).buffer;
      else {
        let a2 = h$1(this, A).byteLength * 2;
        for (; n2 >= a2; ) a2 *= 2;
        i2 = new ArrayBuffer(a2);
      }
      new Uint8Array(i2).set(new Uint8Array(h$1(this, A).buffer, h$1(this, D), h$1(this, S))), x$2(this, A, new DataView(i2)), x$2(this, D, 0);
    }
    new Uint8Array(h$1(this, A).buffer).set(new Uint8Array(t), h$1(this, D) + h$1(this, S)), x$2(this, S, n2);
  } else x$2(this, A, new DataView(t)), x$2(this, D, 0), x$2(this, S, t.byteLength);
}, nt = function(t, n2, r2, i2) {
  switch (n2) {
    case 50:
      return Ie$1;
    case 49:
      return Be;
    case 51:
      return Me;
    case 110:
      return Re;
    case 115:
      return Te$1;
    case 99:
      return Pe$1;
    case 87:
      return Ee;
    case 73:
      return Ce;
    case 68:
      return T(this, l$1, dt).call(this, t, r2, i2);
    case 67:
      return T(this, l$1, st).call(this, t, r2, i2);
    case 90:
      return T(this, l$1, rt).call(this, t, r2, i2);
    case 65:
      return T(this, l$1, ut).call(this, t, r2, i2);
    case 82:
      return T(this, l$1, yt).call(this, t, r2, i2);
    case 83:
      return T(this, l$1, ft).call(this, t, r2, i2);
    case 75:
      return T(this, l$1, mt).call(this, t, r2, i2);
    case 69:
      return T(this, l$1, Ve$1).call(this, t, r2, i2, "error");
    case 78:
      return T(this, l$1, Ve$1).call(this, t, r2, i2, "notice");
    case 84:
      return T(this, l$1, lt).call(this, t, r2, i2);
    case 116:
      return T(this, l$1, pt).call(this, t, r2, i2);
    case 71:
      return T(this, l$1, at).call(this, t, r2, i2);
    case 72:
      return T(this, l$1, ot).call(this, t, r2, i2);
    case 100:
      return T(this, l$1, it).call(this, t, r2, i2);
    default:
      return new E("received invalid response: " + n2.toString(16), r2, "error");
  }
}, rt = function(t, n2, r2) {
  h$1(this, o$1).setBuffer(t, r2);
  let i2 = h$1(this, o$1).string(1);
  return new Z$1(n2, i2);
}, st = function(t, n2, r2) {
  h$1(this, o$1).setBuffer(t, r2);
  let i2 = h$1(this, o$1).cstring();
  return new ee$1(n2, i2);
}, it = function(t, n2, r2) {
  let i2 = r2.slice(t, t + (n2 - 4));
  return new z$1(n2, new Uint8Array(i2));
}, at = function(t, n2, r2) {
  return T(this, l$1, ke$1).call(this, t, n2, r2, "copyInResponse");
}, ot = function(t, n2, r2) {
  return T(this, l$1, ke$1).call(this, t, n2, r2, "copyOutResponse");
}, ke$1 = function(t, n2, r2, i2) {
  h$1(this, o$1).setBuffer(t, r2);
  let a2 = h$1(this, o$1).byte() !== 0, u2 = h$1(this, o$1).int16(), d2 = new H$2(n2, i2, a2, u2);
  for (let c2 = 0; c2 < u2; c2++) d2.columnTypes[c2] = h$1(this, o$1).int16();
  return d2;
}, ut = function(t, n2, r2) {
  h$1(this, o$1).setBuffer(t, r2);
  let i2 = h$1(this, o$1).int32(), a2 = h$1(this, o$1).cstring(), u2 = h$1(this, o$1).cstring();
  return new X(n2, i2, a2, u2);
}, lt = function(t, n2, r2) {
  h$1(this, o$1).setBuffer(t, r2);
  let i2 = h$1(this, o$1).int16(), a2 = new Y$1(n2, i2);
  for (let u2 = 0; u2 < i2; u2++) a2.fields[u2] = T(this, l$1, ct).call(this);
  return a2;
}, ct = function() {
  let t = h$1(this, o$1).cstring(), n2 = h$1(this, o$1).int32(), r2 = h$1(this, o$1).int16(), i2 = h$1(this, o$1).int32(), a2 = h$1(this, o$1).int16(), u2 = h$1(this, o$1).int32(), d2 = h$1(this, o$1).int16() === 0 ? Le.text : Le.binary;
  return new q(t, n2, r2, i2, a2, u2, d2);
}, pt = function(t, n2, r2) {
  h$1(this, o$1).setBuffer(t, r2);
  let i2 = h$1(this, o$1).int16(), a2 = new $$1(n2, i2);
  for (let u2 = 0; u2 < i2; u2++) a2.dataTypeIDs[u2] = h$1(this, o$1).int32();
  return a2;
}, dt = function(t, n2, r2) {
  h$1(this, o$1).setBuffer(t, r2);
  let i2 = h$1(this, o$1).int16(), a2 = new Array(i2);
  for (let u2 = 0; u2 < i2; u2++) {
    let d2 = h$1(this, o$1).int32();
    a2[u2] = d2 === -1 ? null : h$1(this, o$1).string(d2);
  }
  return new te$1(n2, a2);
}, ft = function(t, n2, r2) {
  h$1(this, o$1).setBuffer(t, r2);
  let i2 = h$1(this, o$1).cstring(), a2 = h$1(this, o$1).cstring();
  return new K$1(n2, i2, a2);
}, mt = function(t, n2, r2) {
  h$1(this, o$1).setBuffer(t, r2);
  let i2 = h$1(this, o$1).int32(), a2 = h$1(this, o$1).int32();
  return new J$1(n2, i2, a2);
}, yt = function(t, n2, r2) {
  h$1(this, o$1).setBuffer(t, r2);
  let i2 = h$1(this, o$1).int32();
  switch (i2) {
    case 0:
      return new v(n2);
    case 3:
      return new G$1(n2);
    case 5:
      return new W$1(n2, h$1(this, o$1).bytes(4));
    case 10: {
      let a2 = [];
      for (; ; ) {
        let u2 = h$1(this, o$1).cstring();
        if (u2.length === 0) return new j$1(n2, a2);
        a2.push(u2);
      }
    }
    case 11:
      return new Q(n2, h$1(this, o$1).string(n2 - 8));
    case 12:
      return new _(n2, h$1(this, o$1).string(n2 - 8));
    default:
      throw new Error("Unknown authenticationOk message type " + i2);
  }
}, Ve$1 = function(t, n2, r2, i2) {
  h$1(this, o$1).setBuffer(t, r2);
  let a2 = {}, u2 = h$1(this, o$1).string(1);
  for (; u2 !== "\0"; ) a2[u2] = h$1(this, o$1).cstring(), u2 = h$1(this, o$1).string(1);
  let d2 = a2.M, c2 = i2 === "notice" ? new ne(n2, d2) : new E(d2, n2, i2);
  return c2.severity = a2.S, c2.code = a2.C, c2.detail = a2.D, c2.hint = a2.H, c2.position = a2.P, c2.internalPosition = a2.p, c2.internalQuery = a2.q, c2.where = a2.W, c2.schema = a2.s, c2.table = a2.t, c2.column = a2.c, c2.dataType = a2.d, c2.constraint = a2.n, c2.file = a2.F, c2.line = a2.L, c2.routine = a2.R, c2;
};
u$1();
var Fe$1 = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string", se$1;
async function Rr() {
  if (Fe$1 || se$1) return;
  let e = new URL("./postgres.wasm", import.meta.url);
  se$1 = fetch(e);
}
var k$1;
async function Tr(e, t) {
  if (t || k$1) return WebAssembly.instantiate(t || k$1, e), { instance: await WebAssembly.instantiate(t || k$1, e), module: t || k$1 };
  let n2 = new URL("./postgres.wasm", import.meta.url);
  if (Fe$1) {
    let i2 = await (await import("fs/promises")).readFile(n2), { module: a2, instance: u2 } = await WebAssembly.instantiate(i2, e);
    return k$1 = a2, { instance: u2, module: a2 };
  } else {
    se$1 || (se$1 = fetch(n2));
    let r2 = await se$1, { module: i2, instance: a2 } = await WebAssembly.instantiateStreaming(r2, e);
    return k$1 = i2, { instance: a2, module: i2 };
  }
}
async function Er() {
  let e = new URL("./postgres.data", import.meta.url);
  return Fe$1 ? (await (await import("fs/promises")).readFile(e)).buffer : (await fetch(e)).arrayBuffer();
}
function Nr(e) {
  let t;
  return e.startsWith('"') && e.endsWith('"') ? t = e.substring(1, e.length - 1) : t = e.toLowerCase(), t;
}
u$1();
var o = { part: "part", container: "container" };
function s(t, r2, ...e) {
  let a2 = t.length - 1, p2 = e.length - 1;
  if (p2 !== -1) {
    if (p2 === 0) {
      t[a2] = t[a2] + e[0] + r2;
      return;
    }
    t[a2] = t[a2] + e[0], t.push(...e.slice(1, p2)), t.push(e[p2] + r2);
  }
}
function y(t, ...r2) {
  let e = [t[0]];
  e.raw = [t.raw[0]];
  let a2 = [];
  for (let p2 = 0; p2 < r2.length; p2++) {
    let n2 = r2[p2], i2 = p2 + 1;
    if (n2?._templateType === o.part) {
      s(e, t[i2], n2.str), s(e.raw, t.raw[i2], n2.str);
      continue;
    }
    if (n2?._templateType === o.container) {
      s(e, t[i2], ...n2.strings), s(e.raw, t.raw[i2], ...n2.strings.raw), a2.push(...n2.values);
      continue;
    }
    e.push(t[i2]), e.raw.push(t.raw[i2]), a2.push(n2);
  }
  return { _templateType: "container", strings: e, values: a2 };
}
function g$2(t, ...r2) {
  let { strings: e, values: a2 } = y(t, ...r2);
  return { query: [e[0], ...a2.flatMap((p2, n2) => [`$${n2 + 1}`, e[n2 + 1]])].join(""), params: a2 };
}
u$1();
var b, u, r, l, g$1, h, R, z = class {
  constructor() {
    R$2(this, r);
    this.serializers = { ...cn };
    this.parsers = { ...ln };
    R$2(this, b, false);
    R$2(this, u, false);
  }
  async _initArrayTypes({ force: t = false } = {}) {
    if (h$1(this, b) && !t) return;
    x$2(this, b, true);
    let e = await this.query(`
      SELECT b.oid, b.typarray
      FROM pg_catalog.pg_type a
      LEFT JOIN pg_catalog.pg_type b ON b.oid = a.typelem
      WHERE a.typcategory = 'A'
      GROUP BY b.oid, b.typarray
      ORDER BY b.oid
    `);
    for (let s2 of e.rows) this.serializers[s2.typarray] = (i2) => Ke$1(i2, this.serializers[s2.oid], s2.typarray), this.parsers[s2.typarray] = (i2) => yn(i2, this.parsers[s2.oid], s2.typarray);
  }
  async refreshArrayTypes() {
    await this._initArrayTypes({ force: true });
  }
  async query(t, e, s2) {
    return await this._checkReady(), await this._runExclusiveTransaction(async () => await T(this, r, g$1).call(this, t, e, s2));
  }
  async sql(t, ...e) {
    let { query: s2, params: i2 } = g$2(t, ...e);
    return await this.query(s2, i2);
  }
  async exec(t, e) {
    return await this._checkReady(), await this._runExclusiveTransaction(async () => await T(this, r, h).call(this, t, e));
  }
  async describeQuery(t, e) {
    try {
      await T(this, r, l).call(this, O$1.parse({ text: t, types: e?.paramTypes }), e);
      let s2 = await T(this, r, l).call(this, O$1.describe({ type: "S" }), e), i2 = s2.messages.find((n2) => n2.name === "parameterDescription"), c2 = s2.messages.find((n2) => n2.name === "rowDescription"), y2 = i2?.dataTypeIDs.map((n2) => ({ dataTypeID: n2, serializer: this.serializers[n2] })) ?? [], m2 = c2?.fields.map((n2) => ({ name: n2.name, dataTypeID: n2.dataTypeID, parser: this.parsers[n2.dataTypeID] })) ?? [];
      return { queryParams: y2, resultFields: m2 };
    } finally {
      await T(this, r, l).call(this, O$1.sync(), e);
    }
  }
  async transaction(t) {
    return await this._checkReady(), await this._runExclusiveTransaction(async () => {
      await T(this, r, h).call(this, "BEGIN"), x$2(this, u, true);
      let e = false, s2 = () => {
        if (e) throw new Error("Transaction is closed");
      }, i2 = { query: async (c2, y2, m2) => (s2(), await T(this, r, g$1).call(this, c2, y2, m2)), sql: async (c2, ...y2) => {
        let { query: m2, params: n2 } = g$2(c2, ...y2);
        return await T(this, r, g$1).call(this, m2, n2);
      }, exec: async (c2, y2) => (s2(), await T(this, r, h).call(this, c2, y2)), rollback: async () => {
        s2(), await T(this, r, h).call(this, "ROLLBACK"), e = true;
      }, get closed() {
        return e;
      } };
      try {
        let c2 = await t(i2);
        return e || (e = true, await T(this, r, h).call(this, "COMMIT")), x$2(this, u, false), c2;
      } catch (c2) {
        throw e || await T(this, r, h).call(this, "ROLLBACK"), x$2(this, u, false), c2;
      }
    });
  }
  async runExclusive(t) {
    return await this._runExclusiveQuery(t);
  }
};
b = /* @__PURE__ */ new WeakMap(), u = /* @__PURE__ */ new WeakMap(), r = /* @__PURE__ */ new WeakSet(), l = async function(t, e = {}) {
  return await this.execProtocol(t, { ...e, syncToFs: false });
}, g$1 = async function(t, e = [], s2) {
  return await this._runExclusiveQuery(async () => {
    T(this, r, R).call(this, "runQuery", t, e, s2), await this._handleBlob(s2?.blob);
    let i2;
    try {
      let { messages: y2 } = await T(this, r, l).call(this, O$1.parse({ text: t, types: s2?.paramTypes }), s2), m2 = De((await T(this, r, l).call(this, O$1.describe({ type: "S" }), s2)).messages), n2 = e.map((T2, B) => {
        let x2 = m2[B];
        if (T2 == null) return null;
        let _2 = s2?.serializers?.[x2] ?? this.serializers[x2];
        return _2 ? _2(T2) : T2.toString();
      });
      i2 = [...y2, ...(await T(this, r, l).call(this, O$1.bind({ values: n2 }), s2)).messages, ...(await T(this, r, l).call(this, O$1.describe({ type: "P" }), s2)).messages, ...(await T(this, r, l).call(this, O$1.execute({}), s2)).messages];
    } finally {
      await T(this, r, l).call(this, O$1.sync(), s2);
    }
    await this._cleanupBlob(), h$1(this, u) || await this.syncToFs();
    let c2 = await this._getWrittenBlob();
    return bn(i2, this.parsers, s2, c2)[0];
  });
}, h = async function(t, e) {
  return await this._runExclusiveQuery(async () => {
    T(this, r, R).call(this, "runExec", t, e), await this._handleBlob(e?.blob);
    let s2;
    try {
      s2 = (await T(this, r, l).call(this, O$1.query(t), e)).messages;
    } finally {
      await T(this, r, l).call(this, O$1.sync(), e);
    }
    this._cleanupBlob(), h$1(this, u) || await this.syncToFs();
    let i2 = await this._getWrittenBlob();
    return bn(s2, this.parsers, e, i2);
  });
}, R = function(...t) {
  this.debug > 0 && console.log(...t);
};
var w = D$1(($r, l2) => {
  u$1();
  var j3 = 9007199254740991, B = /* @__PURE__ */ function(r2) {
    return r2;
  }();
  function mr(r2) {
    return r2 === B;
  }
  function q2(r2) {
    return typeof r2 == "string" || Object.prototype.toString.call(r2) == "[object String]";
  }
  function lr(r2) {
    return Object.prototype.toString.call(r2) == "[object Date]";
  }
  function N2(r2) {
    return r2 !== null && typeof r2 == "object";
  }
  function U2(r2) {
    return typeof r2 == "function";
  }
  function fr(r2) {
    return typeof r2 == "number" && r2 > -1 && r2 % 1 == 0 && r2 <= j3;
  }
  function yr(r2) {
    return Object.prototype.toString.call(r2) == "[object Array]";
  }
  function Y3(r2) {
    return N2(r2) && !U2(r2) && fr(r2.length);
  }
  function D2(r2) {
    return Object.prototype.toString.call(r2) == "[object ArrayBuffer]";
  }
  function gr(r2, e) {
    return Array.prototype.map.call(r2, e);
  }
  function hr(r2, e) {
    var t = B;
    return U2(e) && Array.prototype.every.call(r2, function(s2, a2, n2) {
      var o2 = e(s2, a2, n2);
      return o2 && (t = s2), !o2;
    }), t;
  }
  function Sr(r2) {
    return Object.assign.apply(null, arguments);
  }
  function W3(r2) {
    var e, t, s2;
    if (q2(r2)) {
      for (t = r2.length, s2 = new Uint8Array(t), e = 0; e < t; e++) s2[e] = r2.charCodeAt(e) & 255;
      return s2;
    }
    return D2(r2) ? new Uint8Array(r2) : N2(r2) && D2(r2.buffer) ? new Uint8Array(r2.buffer) : Y3(r2) ? new Uint8Array(r2) : N2(r2) && U2(r2.toString) ? W3(r2.toString()) : new Uint8Array();
  }
  l2.exports.MAX_SAFE_INTEGER = j3;
  l2.exports.isUndefined = mr;
  l2.exports.isString = q2;
  l2.exports.isObject = N2;
  l2.exports.isDateTime = lr;
  l2.exports.isFunction = U2;
  l2.exports.isArray = yr;
  l2.exports.isArrayLike = Y3;
  l2.exports.isArrayBuffer = D2;
  l2.exports.map = gr;
  l2.exports.find = hr;
  l2.exports.extend = Sr;
  l2.exports.toUint8Array = W3;
});
var x = D$1((Qr, X2) => {
  u$1();
  var M2 = "\0";
  X2.exports = { NULL_CHAR: M2, TMAGIC: "ustar" + M2 + "00", OLDGNU_MAGIC: "ustar  " + M2, REGTYPE: 0, LNKTYPE: 1, SYMTYPE: 2, CHRTYPE: 3, BLKTYPE: 4, DIRTYPE: 5, FIFOTYPE: 6, CONTTYPE: 7, TSUID: parseInt("4000", 8), TSGID: parseInt("2000", 8), TSVTX: parseInt("1000", 8), TUREAD: parseInt("0400", 8), TUWRITE: parseInt("0200", 8), TUEXEC: parseInt("0100", 8), TGREAD: parseInt("0040", 8), TGWRITE: parseInt("0020", 8), TGEXEC: parseInt("0010", 8), TOREAD: parseInt("0004", 8), TOWRITE: parseInt("0002", 8), TOEXEC: parseInt("0001", 8), TPERMALL: parseInt("0777", 8), TPERMMASK: parseInt("0777", 8) };
});
var L = D$1((ee3, f2) => {
  u$1();
  var K3 = w(), p2 = x(), Fr = 512, I = p2.TPERMALL, V2 = 0, Z3 = 0, _2 = [["name", 100, 0, function(r2, e) {
    return v2(r2[e[0]], e[1]);
  }, function(r2, e, t) {
    return A2(r2.slice(e, e + t[1]));
  }], ["mode", 8, 100, function(r2, e) {
    var t = r2[e[0]] || I;
    return t = t & p2.TPERMMASK, P2(t, e[1], I);
  }, function(r2, e, t) {
    var s2 = S2(r2.slice(e, e + t[1]));
    return s2 &= p2.TPERMMASK, s2;
  }], ["uid", 8, 108, function(r2, e) {
    return P2(r2[e[0]], e[1], V2);
  }, function(r2, e, t) {
    return S2(r2.slice(e, e + t[1]));
  }], ["gid", 8, 116, function(r2, e) {
    return P2(r2[e[0]], e[1], Z3);
  }, function(r2, e, t) {
    return S2(r2.slice(e, e + t[1]));
  }], ["size", 12, 124, function(r2, e) {
    return P2(r2.data.length, e[1]);
  }, function(r2, e, t) {
    return S2(r2.slice(e, e + t[1]));
  }], ["modifyTime", 12, 136, function(r2, e) {
    return k2(r2[e[0]], e[1]);
  }, function(r2, e, t) {
    return z3(r2.slice(e, e + t[1]));
  }], ["checksum", 8, 148, function(r2, e) {
    return "        ";
  }, function(r2, e, t) {
    return S2(r2.slice(e, e + t[1]));
  }], ["type", 1, 156, function(r2, e) {
    return "" + (parseInt(r2[e[0]], 10) || 0) % 8;
  }, function(r2, e, t) {
    return (parseInt(String.fromCharCode(r2[e]), 10) || 0) % 8;
  }], ["linkName", 100, 157, function(r2, e) {
    return "";
  }, function(r2, e, t) {
    return A2(r2.slice(e, e + t[1]));
  }], ["ustar", 8, 257, function(r2, e) {
    return p2.TMAGIC;
  }, function(r2, e, t) {
    return br(A2(r2.slice(e, e + t[1]), true));
  }, function(r2, e) {
    return r2[e[0]] == p2.TMAGIC || r2[e[0]] == p2.OLDGNU_MAGIC;
  }], ["owner", 32, 265, function(r2, e) {
    return v2(r2[e[0]], e[1]);
  }, function(r2, e, t) {
    return A2(r2.slice(e, e + t[1]));
  }], ["group", 32, 297, function(r2, e) {
    return v2(r2[e[0]], e[1]);
  }, function(r2, e, t) {
    return A2(r2.slice(e, e + t[1]));
  }], ["majorNumber", 8, 329, function(r2, e) {
    return "";
  }, function(r2, e, t) {
    return S2(r2.slice(e, e + t[1]));
  }], ["minorNumber", 8, 337, function(r2, e) {
    return "";
  }, function(r2, e, t) {
    return S2(r2.slice(e, e + t[1]));
  }], ["prefix", 131, 345, function(r2, e) {
    return v2(r2[e[0]], e[1]);
  }, function(r2, e, t) {
    return A2(r2.slice(e, e + t[1]));
  }], ["accessTime", 12, 476, function(r2, e) {
    return k2(r2[e[0]], e[1]);
  }, function(r2, e, t) {
    return z3(r2.slice(e, e + t[1]));
  }], ["createTime", 12, 488, function(r2, e) {
    return k2(r2[e[0]], e[1]);
  }, function(r2, e, t) {
    return z3(r2.slice(e, e + t[1]));
  }]], $3 = function(r2) {
    var e = r2[r2.length - 1];
    return e[2] + e[1];
  }(_2);
  function br(r2) {
    if (r2.length == 8) {
      var e = r2.split("");
      if (e[5] == p2.NULL_CHAR) return (e[6] == " " || e[6] == p2.NULL_CHAR) && (e[6] = "0"), (e[7] == " " || e[7] == p2.NULL_CHAR) && (e[7] = "0"), e = e.join(""), e == p2.TMAGIC ? e : r2;
      if (e[7] == p2.NULL_CHAR) return e[5] == p2.NULL_CHAR && (e[5] = " "), e[6] == p2.NULL_CHAR && (e[6] = " "), e == p2.OLDGNU_MAGIC ? e : r2;
    }
    return r2;
  }
  function v2(r2, e) {
    return e -= 1, K3.isUndefined(r2) && (r2 = ""), r2 = ("" + r2).substr(0, e), r2 + p2.NULL_CHAR;
  }
  function P2(r2, e, t) {
    for (t = parseInt(t) || 0, e -= 1, r2 = (parseInt(r2) || t).toString(8).substr(-e, e); r2.length < e; ) r2 = "0" + r2;
    return r2 + p2.NULL_CHAR;
  }
  function k2(r2, e) {
    if (K3.isDateTime(r2)) r2 = Math.floor(1 * r2 / 1e3);
    else if (r2 = parseInt(r2, 10), isFinite(r2)) {
      if (r2 <= 0) return "";
    } else r2 = Math.floor(1 * /* @__PURE__ */ new Date() / 1e3);
    return P2(r2, e, 0);
  }
  function A2(r2, e) {
    var t = String.fromCharCode.apply(null, r2);
    if (e) return t;
    var s2 = t.indexOf(p2.NULL_CHAR);
    return s2 >= 0 ? t.substr(0, s2) : t;
  }
  function S2(r2) {
    var e = String.fromCharCode.apply(null, r2);
    return parseInt(e.replace(/^0+$/g, ""), 8) || 0;
  }
  function z3(r2) {
    return r2.length == 0 || r2[0] == 0 ? null : new Date(1e3 * S2(r2));
  }
  function Tr2(r2, e, t) {
    var s2 = parseInt(e, 10) || 0, a2 = Math.min(s2 + $3, r2.length), n2 = 0, o2 = 0, i2 = 0;
    t && _2.every(function(y2) {
      return y2[0] == "checksum" ? (o2 = s2 + y2[2], i2 = o2 + y2[1], false) : true;
    });
    for (var u2 = 32, c2 = s2; c2 < a2; c2++) {
      var m2 = c2 >= o2 && c2 < i2 ? u2 : r2[c2];
      n2 = (n2 + m2) % 262144;
    }
    return n2;
  }
  f2.exports.recordSize = Fr;
  f2.exports.defaultFileMode = I;
  f2.exports.defaultUid = V2;
  f2.exports.defaultGid = Z3;
  f2.exports.posixHeader = _2;
  f2.exports.effectiveHeaderSize = $3;
  f2.exports.calculateChecksum = Tr2;
  f2.exports.formatTarString = v2;
  f2.exports.formatTarNumber = P2;
  f2.exports.formatTarDateTime = k2;
  f2.exports.parseTarString = A2;
  f2.exports.parseTarNumber = S2;
  f2.exports.parseTarDateTime = z3;
});
var er = D$1((ne2, rr) => {
  u$1();
  var Ar = x(), O2 = w(), F2 = L();
  function J3(r2) {
    return F2.recordSize;
  }
  function Q2(r2) {
    return Math.ceil(r2.data.length / F2.recordSize) * F2.recordSize;
  }
  function Er2(r2) {
    var e = 0;
    return r2.forEach(function(t) {
      e += J3() + Q2(t);
    }), e += F2.recordSize * 2, new Uint8Array(e);
  }
  function Pr(r2, e, t) {
    t = parseInt(t) || 0;
    var s2 = t;
    F2.posixHeader.forEach(function(u2) {
      for (var c2 = u2[3](e, u2), m2 = c2.length, y2 = 0; y2 < m2; y2 += 1) r2[s2 + y2] = c2.charCodeAt(y2) & 255;
      s2 += u2[1];
    });
    var a2 = O2.find(F2.posixHeader, function(u2) {
      return u2[0] == "checksum";
    });
    if (a2) {
      var n2 = F2.calculateChecksum(r2, t, true), o2 = F2.formatTarNumber(n2, a2[1] - 2) + Ar.NULL_CHAR + " ";
      s2 = t + a2[2];
      for (var i2 = 0; i2 < o2.length; i2 += 1) r2[s2] = o2.charCodeAt(i2) & 255, s2++;
    }
    return t + J3();
  }
  function wr(r2, e, t) {
    return t = parseInt(t, 10) || 0, r2.set(e.data, t), t + Q2(e);
  }
  function xr(r2) {
    r2 = O2.map(r2, function(s2) {
      return O2.extend({}, s2, { data: O2.toUint8Array(s2.data) });
    });
    var e = Er2(r2), t = 0;
    return r2.forEach(function(s2) {
      t = Pr(e, s2, t), t = wr(e, s2, t);
    }), e;
  }
  rr.exports.tar = xr;
});
var nr = D$1((oe2, tr) => {
  u$1();
  var vr = x(), G3 = w(), h2 = L(), Nr2 = { extractData: true, checkHeader: true, checkChecksum: true, checkFileSize: true }, Ur = { size: true, checksum: true, ustar: true }, R3 = { unexpectedEndOfFile: "Unexpected end of file.", fileCorrupted: "File is corrupted.", checksumCheckFailed: "Checksum check failed." };
  function kr(r2) {
    return h2.recordSize;
  }
  function zr(r2) {
    return Math.ceil(r2 / h2.recordSize) * h2.recordSize;
  }
  function Or(r2, e) {
    for (var t = e, s2 = Math.min(r2.length, e + h2.recordSize * 2), a2 = t; a2 < s2; a2++) if (r2[a2] != 0) return false;
    return true;
  }
  function Cr(r2, e, t) {
    if (r2.length - e < h2.recordSize) {
      if (t.checkFileSize) throw new Error(R3.unexpectedEndOfFile);
      return null;
    }
    e = parseInt(e) || 0;
    var s2 = {}, a2 = e;
    if (h2.posixHeader.forEach(function(i2) {
      s2[i2[0]] = i2[4](r2, a2, i2), a2 += i2[1];
    }), s2.type != 0 && (s2.size = 0), t.checkHeader && h2.posixHeader.forEach(function(i2) {
      if (G3.isFunction(i2[5]) && !i2[5](s2, i2)) {
        var u2 = new Error(R3.fileCorrupted);
        throw u2.data = { offset: e + i2[2], field: i2[0] }, u2;
      }
    }), t.checkChecksum) {
      var n2 = h2.calculateChecksum(r2, e, true);
      if (n2 != s2.checksum) {
        var o2 = new Error(R3.checksumCheckFailed);
        throw o2.data = { offset: e, header: s2, checksum: n2 }, o2;
      }
    }
    return s2;
  }
  function Dr(r2, e, t, s2) {
    return s2.extractData ? t.size <= 0 ? new Uint8Array() : r2.slice(e, e + t.size) : null;
  }
  function Mr(r2, e) {
    var t = {};
    return h2.posixHeader.forEach(function(s2) {
      var a2 = s2[0];
      Ur[a2] || (t[a2] = r2[a2]);
    }), t.isOldGNUFormat = r2.ustar == vr.OLDGNU_MAGIC, e && (t.data = e), t;
  }
  function Ir(r2, e) {
    e = G3.extend({}, Nr2, e);
    for (var t = [], s2 = 0, a2 = r2.length; a2 - s2 >= h2.recordSize; ) {
      r2 = G3.toUint8Array(r2);
      var n2 = Cr(r2, s2, e);
      if (!n2) break;
      s2 += kr();
      var o2 = Dr(r2, s2, n2, e);
      if (t.push(Mr(n2, o2)), s2 += zr(n2.size), Or(r2, s2)) break;
    }
    return t;
  }
  tr.exports.untar = Ir;
});
var or = D$1((se2, ir) => {
  u$1();
  var _r = w(), Lr = x(), Rr2 = er(), Gr = nr();
  _r.extend(ir.exports, Rr2, Gr, Lr);
});
u$1();
u$1();
var g = L$2(or());
async function H$1(r2, e, t = "pgdata", s2 = "auto") {
  let a2 = Br(r2, e), [n2, o2] = await qr(a2, s2), i2 = t + (o2 ? ".tar.gz" : ".tar"), u2 = o2 ? "application/x-gzip" : "application/x-tar";
  return typeof File < "u" ? new File([n2], i2, { type: u2 }) : new Blob([n2], { type: u2 });
}
var Hr = ["application/x-gtar", "application/x-tar+gzip", "application/x-gzip", "application/gzip"];
async function ce$1(r2, e, t) {
  let s2 = new Uint8Array(await e.arrayBuffer()), a2 = typeof File < "u" && e instanceof File ? e.name : void 0;
  (Hr.includes(e.type) || a2?.endsWith(".tgz") || a2?.endsWith(".tar.gz")) && (s2 = await ar(s2));
  let o2;
  try {
    o2 = (0, g.untar)(s2);
  } catch (i2) {
    if (i2 instanceof Error && i2.message.includes("File is corrupted")) s2 = await ar(s2), o2 = (0, g.untar)(s2);
    else throw i2;
  }
  for (let i2 of o2) {
    let u2 = t + i2.name, c2 = u2.split("/").slice(0, -1);
    for (let m2 = 1; m2 <= c2.length; m2++) {
      let y2 = c2.slice(0, m2).join("/");
      r2.analyzePath(y2).exists || r2.mkdir(y2);
    }
    i2.type === g.REGTYPE ? (r2.writeFile(u2, i2.data), r2.utime(u2, sr(i2.modifyTime), sr(i2.modifyTime))) : i2.type === g.DIRTYPE && r2.mkdir(u2);
  }
}
function jr(r2, e) {
  let t = [], s2 = (a2) => {
    r2.readdir(a2).forEach((o2) => {
      if (o2 === "." || o2 === "..") return;
      let i2 = a2 + "/" + o2, u2 = r2.stat(i2), c2 = r2.isFile(u2.mode) ? r2.readFile(i2, { encoding: "binary" }) : new Uint8Array(0);
      t.push({ name: i2.substring(e.length), mode: u2.mode, size: u2.size, type: r2.isFile(u2.mode) ? g.REGTYPE : g.DIRTYPE, modifyTime: u2.mtime, data: c2 }), r2.isDir(u2.mode) && s2(i2);
    });
  };
  return s2(e), t;
}
function Br(r2, e) {
  let t = jr(r2, e);
  return (0, g.tar)(t);
}
async function qr(r2, e = "auto") {
  if (e === "none") return [r2, false];
  if (typeof CompressionStream < "u") return [await Yr(r2), true];
  if (typeof process < "u" && process.versions && process.versions.node) return [await Wr(r2), true];
  if (e === "auto") return [r2, false];
  throw new Error("Compression not supported in this environment");
}
async function Yr(r2) {
  let e = new CompressionStream("gzip"), t = e.writable.getWriter(), s2 = e.readable.getReader();
  t.write(r2), t.close();
  let a2 = [];
  for (; ; ) {
    let { value: i2, done: u2 } = await s2.read();
    if (u2) break;
    i2 && a2.push(i2);
  }
  let n2 = new Uint8Array(a2.reduce((i2, u2) => i2 + u2.length, 0)), o2 = 0;
  return a2.forEach((i2) => {
    n2.set(i2, o2), o2 += i2.length;
  }), n2;
}
async function Wr(r2) {
  let { promisify: e } = await import("util"), { gzip: t } = await import("zlib");
  return await e(t)(r2);
}
async function ar(r2) {
  if (typeof CompressionStream < "u") return await Xr(r2);
  if (typeof process < "u" && process.versions && process.versions.node) return await Kr(r2);
  throw new Error("Unsupported environment for decompression");
}
async function Xr(r2) {
  let e = new DecompressionStream("gzip"), t = e.writable.getWriter(), s2 = e.readable.getReader();
  t.write(r2), t.close();
  let a2 = [];
  for (; ; ) {
    let { value: i2, done: u2 } = await s2.read();
    if (u2) break;
    i2 && a2.push(i2);
  }
  let n2 = new Uint8Array(a2.reduce((i2, u2) => i2 + u2.length, 0)), o2 = 0;
  return a2.forEach((i2) => {
    n2.set(i2, o2), o2 += i2.length;
  }), n2;
}
async function Kr(r2) {
  let { promisify: e } = await import("util"), { gunzip: t } = await import("zlib");
  return await e(t)(r2);
}
function sr(r2) {
  return r2 ? typeof r2 == "number" ? r2 : Math.floor(r2.getTime() / 1e3) : Math.floor(Date.now() / 1e3);
}
var Vr = "/tmp/pglite", C = Vr + "/base", ur = class {
  constructor(e) {
    this.dataDir = e;
  }
  async init(e, t) {
    return this.pg = e, { emscriptenOpts: t };
  }
  async syncToFs(e) {
  }
  async initialSyncFs() {
  }
  async closeFs() {
  }
  async dumpTar(e, t) {
    return H$1(this.pg.Module.FS, C, e, t);
  }
}, cr = class {
  constructor(e, { debug: t = false } = {}) {
    this.dataDir = e, this.debug = t;
  }
  async syncToFs(e) {
  }
  async initialSyncFs() {
  }
  async closeFs() {
  }
  async dumpTar(e, t) {
    return H$1(this.pg.Module.FS, C, e, t);
  }
  async init(e, t) {
    return this.pg = e, { emscriptenOpts: { ...t, preRun: [...t.preRun || [], (a2) => {
      let n2 = Zr(a2, this);
      a2.FS.mkdir(C), a2.FS.mount(n2, {}, C);
    }] } };
  }
}, pr = { EBADF: 8, EBADFD: 127, EEXIST: 20, EINVAL: 28, EISDIR: 31, ENODEV: 43, ENOENT: 44, ENOTDIR: 54, ENOTEMPTY: 55 }, Zr = (r2, e) => {
  let t = r2.FS, s2 = e.debug ? console.log : null, a2 = { tryFSOperation(n2) {
    try {
      return n2();
    } catch (o2) {
      throw o2.code ? o2.code === "UNKNOWN" ? new t.ErrnoError(pr.EINVAL) : new t.ErrnoError(o2.code) : o2;
    }
  }, mount(n2) {
    return a2.createNode(null, "/", 16895, 0);
  }, syncfs(n2, o2, i2) {
  }, createNode(n2, o2, i2, u2) {
    if (!t.isDir(i2) && !t.isFile(i2)) throw new t.ErrnoError(28);
    let c2 = t.createNode(n2, o2, i2);
    return c2.node_ops = a2.node_ops, c2.stream_ops = a2.stream_ops, c2;
  }, getMode: function(n2) {
    return s2?.("getMode", n2), a2.tryFSOperation(() => e.lstat(n2).mode);
  }, realPath: function(n2) {
    let o2 = [];
    for (; n2.parent !== n2; ) o2.push(n2.name), n2 = n2.parent;
    return o2.push(n2.mount.opts.root), o2.reverse(), o2.join("/");
  }, node_ops: { getattr(n2) {
    s2?.("getattr", a2.realPath(n2));
    let o2 = a2.realPath(n2);
    return a2.tryFSOperation(() => {
      let i2 = e.lstat(o2);
      return { ...i2, dev: 0, ino: n2.id, nlink: 1, rdev: n2.rdev, atime: new Date(i2.atime), mtime: new Date(i2.mtime), ctime: new Date(i2.ctime) };
    });
  }, setattr(n2, o2) {
    s2?.("setattr", a2.realPath(n2), o2);
    let i2 = a2.realPath(n2);
    a2.tryFSOperation(() => {
      o2.mode !== void 0 && e.chmod(i2, o2.mode), o2.size !== void 0 && e.truncate(i2, o2.size), o2.timestamp !== void 0 && e.utimes(i2, o2.timestamp, o2.timestamp), o2.size !== void 0 && e.truncate(i2, o2.size);
    });
  }, lookup(n2, o2) {
    s2?.("lookup", a2.realPath(n2), o2);
    let i2 = [a2.realPath(n2), o2].join("/"), u2 = a2.getMode(i2);
    return a2.createNode(n2, o2, u2);
  }, mknod(n2, o2, i2, u2) {
    s2?.("mknod", a2.realPath(n2), o2, i2, u2);
    let c2 = a2.createNode(n2, o2, i2, u2), m2 = a2.realPath(c2);
    return a2.tryFSOperation(() => (t.isDir(c2.mode) ? e.mkdir(m2, { mode: i2 }) : e.writeFile(m2, "", { mode: i2 }), c2));
  }, rename(n2, o2, i2) {
    s2?.("rename", a2.realPath(n2), a2.realPath(o2), i2);
    let u2 = a2.realPath(n2), c2 = [a2.realPath(o2), i2].join("/");
    a2.tryFSOperation(() => {
      e.rename(u2, c2);
    }), n2.name = i2;
  }, unlink(n2, o2) {
    s2?.("unlink", a2.realPath(n2), o2);
    let i2 = [a2.realPath(n2), o2].join("/");
    try {
      e.unlink(i2);
    } catch {
    }
  }, rmdir(n2, o2) {
    s2?.("rmdir", a2.realPath(n2), o2);
    let i2 = [a2.realPath(n2), o2].join("/");
    return a2.tryFSOperation(() => {
      e.rmdir(i2);
    });
  }, readdir(n2) {
    s2?.("readdir", a2.realPath(n2));
    let o2 = a2.realPath(n2);
    return a2.tryFSOperation(() => e.readdir(o2));
  }, symlink(n2, o2, i2) {
    throw s2?.("symlink", a2.realPath(n2), o2, i2), new t.ErrnoError(63);
  }, readlink(n2) {
    throw s2?.("readlink", a2.realPath(n2)), new t.ErrnoError(63);
  } }, stream_ops: { open(n2) {
    s2?.("open stream", a2.realPath(n2.node));
    let o2 = a2.realPath(n2.node);
    return a2.tryFSOperation(() => {
      t.isFile(n2.node.mode) && (n2.shared.refcount = 1, n2.nfd = e.open(o2));
    });
  }, close(n2) {
    return s2?.("close stream", a2.realPath(n2.node)), a2.tryFSOperation(() => {
      t.isFile(n2.node.mode) && n2.nfd && --n2.shared.refcount === 0 && e.close(n2.nfd);
    });
  }, dup(n2) {
    s2?.("dup stream", a2.realPath(n2.node)), n2.shared.refcount++;
  }, read(n2, o2, i2, u2, c2) {
    return s2?.("read stream", a2.realPath(n2.node), i2, u2, c2), u2 === 0 ? 0 : a2.tryFSOperation(() => e.read(n2.nfd, o2, i2, u2, c2));
  }, write(n2, o2, i2, u2, c2) {
    return s2?.("write stream", a2.realPath(n2.node), i2, u2, c2), a2.tryFSOperation(() => e.write(n2.nfd, o2.buffer, i2, u2, c2));
  }, llseek(n2, o2, i2) {
    s2?.("llseek stream", a2.realPath(n2.node), o2, i2);
    let u2 = o2;
    if (i2 === 1 ? u2 += n2.position : i2 === 2 && t.isFile(n2.node.mode) && a2.tryFSOperation(() => {
      let c2 = e.fstat(n2.nfd);
      u2 += c2.size;
    }), u2 < 0) throw new t.ErrnoError(28);
    return u2;
  }, mmap(n2, o2, i2, u2, c2) {
    if (s2?.("mmap stream", a2.realPath(n2.node), o2, i2, u2, c2), !t.isFile(n2.node.mode)) throw new t.ErrnoError(pr.ENODEV);
    let m2 = r2.mmapAlloc(o2);
    return a2.stream_ops.read(n2, r2.HEAP8, m2, o2, i2), { ptr: m2, allocated: true };
  }, msync(n2, o2, i2, u2, c2) {
    return s2?.("msync stream", a2.realPath(n2.node), i2, u2, c2), a2.stream_ops.write(n2, o2, 0, u2, i2), 0;
  } } };
  return a2;
};
u$1();
u$1();
u$1();
var He = new Error("request for lock canceled"), We = function(e, t, r2, a2) {
  function o2(s2) {
    return s2 instanceof r2 ? s2 : new r2(function(l2) {
      l2(s2);
    });
  }
  return new (r2 || (r2 = Promise))(function(s2, l2) {
    function n2(p2) {
      try {
        m2(a2.next(p2));
      } catch (d2) {
        l2(d2);
      }
    }
    function _2(p2) {
      try {
        m2(a2.throw(p2));
      } catch (d2) {
        l2(d2);
      }
    }
    function m2(p2) {
      p2.done ? s2(p2.value) : o2(p2.value).then(n2, _2);
    }
    m2((a2 = a2.apply(e, [])).next());
  });
}, ce = class {
  constructor(t, r2 = He) {
    this._value = t, this._cancelError = r2, this._weightedQueues = [], this._weightedWaiters = [];
  }
  acquire(t = 1) {
    if (t <= 0) throw new Error(`invalid weight ${t}: must be positive`);
    return new Promise((r2, a2) => {
      this._weightedQueues[t - 1] || (this._weightedQueues[t - 1] = []), this._weightedQueues[t - 1].push({ resolve: r2, reject: a2 }), this._dispatch();
    });
  }
  runExclusive(t, r2 = 1) {
    return We(this, void 0, void 0, function* () {
      let [a2, o2] = yield this.acquire(r2);
      try {
        return yield t(a2);
      } finally {
        o2();
      }
    });
  }
  waitForUnlock(t = 1) {
    if (t <= 0) throw new Error(`invalid weight ${t}: must be positive`);
    return new Promise((r2) => {
      this._weightedWaiters[t - 1] || (this._weightedWaiters[t - 1] = []), this._weightedWaiters[t - 1].push(r2), this._dispatch();
    });
  }
  isLocked() {
    return this._value <= 0;
  }
  getValue() {
    return this._value;
  }
  setValue(t) {
    this._value = t, this._dispatch();
  }
  release(t = 1) {
    if (t <= 0) throw new Error(`invalid weight ${t}: must be positive`);
    this._value += t, this._dispatch();
  }
  cancel() {
    this._weightedQueues.forEach((t) => t.forEach((r2) => r2.reject(this._cancelError))), this._weightedQueues = [];
  }
  _dispatch() {
    var t;
    for (let r2 = this._value; r2 > 0; r2--) {
      let a2 = (t = this._weightedQueues[r2 - 1]) === null || t === void 0 ? void 0 : t.shift();
      if (!a2) continue;
      let o2 = this._value, s2 = r2;
      this._value -= r2, r2 = this._value + 1, a2.resolve([o2, this._newReleaser(s2)]);
    }
    this._drainUnlockWaiters();
  }
  _newReleaser(t) {
    let r2 = false;
    return () => {
      r2 || (r2 = true, this.release(t));
    };
  }
  _drainUnlockWaiters() {
    for (let t = this._value; t > 0; t--) this._weightedWaiters[t - 1] && (this._weightedWaiters[t - 1].forEach((r2) => r2()), this._weightedWaiters[t - 1] = []);
  }
}, je = function(e, t, r2, a2) {
  function o2(s2) {
    return s2 instanceof r2 ? s2 : new r2(function(l2) {
      l2(s2);
    });
  }
  return new (r2 || (r2 = Promise))(function(s2, l2) {
    function n2(p2) {
      try {
        m2(a2.next(p2));
      } catch (d2) {
        l2(d2);
      }
    }
    function _2(p2) {
      try {
        m2(a2.throw(p2));
      } catch (d2) {
        l2(d2);
      }
    }
    function m2(p2) {
      p2.done ? s2(p2.value) : o2(p2.value).then(n2, _2);
    }
    m2((a2 = a2.apply(e, [])).next());
  });
}, H = class {
  constructor(t) {
    this._semaphore = new ce(1, t);
  }
  acquire() {
    return je(this, void 0, void 0, function* () {
      let [, t] = yield this._semaphore.acquire();
      return t;
    });
  }
  runExclusive(t) {
    return this._semaphore.runExclusive(() => t());
  }
  isLocked() {
    return this._semaphore.isLocked();
  }
  waitForUnlock() {
    return this._semaphore.waitForUnlock();
  }
  release() {
    this._semaphore.isLocked() && this._semaphore.release();
  }
  cancel() {
    return this._semaphore.cancel();
  }
};
u$1();
var Ie = L$2(or());
async function ge(e) {
  if (Fe$1) {
    let t = await import("fs"), r2 = await import("zlib"), { Writable: a2 } = await import("stream"), { pipeline: o2 } = await import("stream/promises");
    if (!t.existsSync(e)) throw new Error(`Extension bundle not found: ${e}`);
    let s2 = r2.createGunzip(), l2 = [];
    return await o2(t.createReadStream(e), s2, new a2({ write(n2, _2, m2) {
      l2.push(n2), m2();
    } })), new Blob(l2);
  } else {
    let t = await fetch(e.toString());
    if (!t.ok || !t.body) return null;
    if (t.headers.get("Content-Encoding") === "gzip") return t.blob();
    {
      let r2 = new DecompressionStream("gzip");
      return new Response(t.body.pipeThrough(r2)).blob();
    }
  }
}
async function Pe(e, t) {
  for (let r2 in e.pg_extensions) {
    let a2;
    try {
      a2 = await e.pg_extensions[r2];
    } catch (o2) {
      console.error("Failed to fetch extension:", r2, o2);
      continue;
    }
    if (a2) {
      let o2 = new Uint8Array(await a2.arrayBuffer());
      Ve(e, r2, o2, t);
    } else console.error("Could not get binary data for extension:", r2);
  }
}
function Ve(e, t, r2, a2) {
  Ie.default.untar(r2).forEach((s2) => {
    if (!s2.name.startsWith(".")) {
      let l2 = e.WASM_PREFIX + "/" + s2.name;
      if (s2.name.endsWith(".so")) {
        let n2 = (...m2) => {
          a2("pgfs:ext OK", l2, m2);
        }, _2 = (...m2) => {
          a2("pgfs:ext FAIL", l2, m2);
        };
        e.FS.createPreloadedFile(Ke(l2), s2.name.split("/").pop().slice(0, -3), s2.data, true, true, n2, _2, false);
      } else e.FS.writeFile(l2, s2.data);
    }
  });
}
function Ke(e) {
  let t = e.lastIndexOf("/");
  return t > 0 ? e.slice(0, t) : e;
}
u$1();
u$1();
var ee = class extends ur {
  async init(t, r2) {
    return this.pg = t, { emscriptenOpts: { ...r2, preRun: [...r2.preRun || [], (o2) => {
      let s2 = o2.FS.filesystems.IDBFS;
      o2.FS.mkdir("/pglite"), o2.FS.mkdir(`/pglite/${this.dataDir}`), o2.FS.mount(s2, {}, `/pglite/${this.dataDir}`), o2.FS.symlink(`/pglite/${this.dataDir}`, C);
    }] } };
  }
  initialSyncFs() {
    return new Promise((t, r2) => {
      this.pg.Module.FS.syncfs(true, (a2) => {
        a2 ? r2(a2) : t();
      });
    });
  }
  syncToFs(t) {
    return new Promise((r2, a2) => {
      this.pg.Module.FS.syncfs(false, (o2) => {
        o2 ? a2(o2) : r2();
      });
    });
  }
  async closeFs() {
    let t = this.pg.Module.FS.filesystems.IDBFS.dbs[this.dataDir];
    t && t.close(), this.pg.Module.FS.quit();
  }
};
u$1();
var te = class extends ur {
  async closeFs() {
    this.pg.Module.FS.quit();
  }
};
function Fe(e) {
  let t;
  if (e?.startsWith("file://")) {
    if (e = e.slice(7), !e) throw new Error("Invalid dataDir, must be a valid path");
    t = "nodefs";
  } else e?.startsWith("idb://") ? (e = e.slice(6), t = "idbfs") : e?.startsWith("opfs-ahp://") ? (e = e.slice(11), t = "opfs-ahp") : !e || e?.startsWith("memory://") ? t = "memoryfs" : t = "nodefs";
  return { dataDir: e, fsType: t };
}
async function Ae(e, t) {
  let r2;
  if (e && t === "nodefs") {
    let { NodeFS: a2 } = await import("./nodefs-CQnthieD.js");
    r2 = new a2(e);
  } else if (e && t === "idbfs") r2 = new ee(e);
  else if (e && t === "opfs-ahp") {
    let { OpfsAhpFS: a2 } = await import("./opfs-ahp-BY1YPwzB.js");
    r2 = new a2(e);
  } else r2 = new te();
  return r2;
}
u$1();
u$1();
var Qe = (() => {
  var _scriptName = import.meta.url;
  return async function(moduleArg = {}) {
    var moduleRtn, Module = moduleArg, readyPromiseResolve, readyPromiseReject, readyPromise = new Promise((e, t) => {
      readyPromiseResolve = e, readyPromiseReject = t;
    }), ENVIRONMENT_IS_WEB = typeof window == "object", ENVIRONMENT_IS_WORKER = typeof WorkerGlobalScope < "u", ENVIRONMENT_IS_NODE = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string" && process.type != "renderer";
    if (ENVIRONMENT_IS_NODE) {
      let { createRequire: e } = await import("module"), t = import.meta.url;
      t.startsWith("data:") && (t = "/");
      var require = e(t);
    }
    Module.expectedDataFileDownloads ?? (Module.expectedDataFileDownloads = 0), Module.expectedDataFileDownloads++, (() => {
      var e = typeof ENVIRONMENT_IS_PTHREAD < "u" && ENVIRONMENT_IS_PTHREAD, t = typeof ENVIRONMENT_IS_WASM_WORKER < "u" && ENVIRONMENT_IS_WASM_WORKER;
      if (e || t) return;
      var r2 = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string";
      function a2(o2) {
        typeof window == "object" ? window.encodeURIComponent(window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/")) + "/") : typeof process > "u" && typeof location < "u" && encodeURIComponent(location.pathname.substring(0, location.pathname.lastIndexOf("/")) + "/");
        var l2 = "postgres.data", n2 = "postgres.data", _2 = Module.locateFile ? Module.locateFile(n2, "") : n2, m2 = o2.remote_package_size;
        function p2(u2, w2, h2, S2) {
          if (r2) {
            require("fs").readFile(u2, (M2, y2) => {
              M2 ? S2(M2) : h2(y2.buffer);
            });
            return;
          }
          Module.dataFileDownloads ?? (Module.dataFileDownloads = {}), fetch(u2).catch((M2) => Promise.reject(new Error(`Network Error: ${u2}`, { cause: M2 }))).then((M2) => {
            if (!M2.ok) return Promise.reject(new Error(`${M2.status}: ${M2.url}`));
            if (!M2.body && M2.arrayBuffer) return M2.arrayBuffer().then(h2);
            let y2 = M2.body.getReader(), x2 = () => y2.read().then(X2).catch((R3) => Promise.reject(new Error(`Unexpected error while handling : ${M2.url} ${R3}`, { cause: R3 }))), E2 = [], b2 = M2.headers, T2 = Number(b2.get("Content-Length") ?? w2), D2 = 0, X2 = ({ done: R3, value: z3 }) => {
              if (R3) {
                let P2 = new Uint8Array(E2.map((A2) => A2.length).reduce((A2, Re2) => A2 + Re2, 0)), U2 = 0;
                for (let A2 of E2) P2.set(A2, U2), U2 += A2.length;
                h2(P2.buffer);
              } else {
                E2.push(z3), D2 += z3.length, Module.dataFileDownloads[u2] = { loaded: D2, total: T2 };
                let P2 = 0, U2 = 0;
                for (let A2 of Object.values(Module.dataFileDownloads)) P2 += A2.loaded, U2 += A2.total;
                return Module.setStatus?.(`Downloading data... (${P2}/${U2})`), x2();
              }
            };
            return Module.setStatus?.("Downloading data..."), x2();
          });
        }
        function d2(u2) {
          console.error("package error:", u2);
        }
        var g2 = null, c2 = Module.getPreloadedPackage ? Module.getPreloadedPackage(_2, m2) : null;
        c2 || p2(_2, m2, (u2) => {
          g2 ? (g2(u2), g2 = null) : c2 = u2;
        }, d2);
        function f2(u2) {
          function w2(x2, E2) {
            if (!x2) throw E2 + new Error().stack;
          }
          u2.FS_createPath("/", "home", true, true), u2.FS_createPath("/home", "web_user", true, true), u2.FS_createPath("/", "tmp", true, true), u2.FS_createPath("/tmp", "pglite", true, true), u2.FS_createPath("/tmp/pglite", "bin", true, true), u2.FS_createPath("/tmp/pglite", "lib", true, true), u2.FS_createPath("/tmp/pglite/lib", "postgresql", true, true), u2.FS_createPath("/tmp/pglite/lib/postgresql", "pgxs", true, true), u2.FS_createPath("/tmp/pglite/lib/postgresql/pgxs", "config", true, true), u2.FS_createPath("/tmp/pglite/lib/postgresql/pgxs", "src", true, true), u2.FS_createPath("/tmp/pglite/lib/postgresql/pgxs/src", "makefiles", true, true), u2.FS_createPath("/tmp/pglite/lib/postgresql/pgxs/src", "test", true, true), u2.FS_createPath("/tmp/pglite/lib/postgresql/pgxs/src/test", "isolation", true, true), u2.FS_createPath("/tmp/pglite/lib/postgresql/pgxs/src/test", "regress", true, true), u2.FS_createPath("/tmp/pglite", "share", true, true), u2.FS_createPath("/tmp/pglite/share", "postgresql", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql", "extension", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql", "timezone", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql/timezone", "Africa", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql/timezone", "America", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql/timezone/America", "Argentina", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql/timezone/America", "Indiana", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql/timezone/America", "Kentucky", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql/timezone/America", "North_Dakota", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql/timezone", "Antarctica", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql/timezone", "Arctic", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql/timezone", "Asia", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql/timezone", "Atlantic", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql/timezone", "Australia", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql/timezone", "Brazil", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql/timezone", "Canada", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql/timezone", "Chile", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql/timezone", "Etc", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql/timezone", "Europe", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql/timezone", "Indian", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql/timezone", "Mexico", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql/timezone", "Pacific", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql/timezone", "US", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql", "timezonesets", true, true), u2.FS_createPath("/tmp/pglite/share/postgresql", "tsearch_data", true, true);
          function h2(x2, E2, b2) {
            this.start = x2, this.end = E2, this.audio = b2;
          }
          h2.prototype = { requests: {}, open: function(x2, E2) {
            this.name = E2, this.requests[E2] = this, u2.addRunDependency(`fp ${this.name}`);
          }, send: function() {
          }, onload: function() {
            var x2 = this.byteArray.subarray(this.start, this.end);
            this.finish(x2);
          }, finish: function(x2) {
            var E2 = this;
            u2.FS_createDataFile(this.name, null, x2, true, true, true), u2.removeRunDependency(`fp ${E2.name}`), this.requests[this.name] = null;
          } };
          for (var S2 = o2.files, M2 = 0; M2 < S2.length; ++M2) new h2(S2[M2].start, S2[M2].end, S2[M2].audio || 0).open("GET", S2[M2].filename);
          function y2(x2) {
            w2(x2, "Loading data file failed."), w2(x2.constructor.name === ArrayBuffer.name, "bad input to processPackageData");
            var E2 = new Uint8Array(x2);
            h2.prototype.byteArray = E2;
            for (var b2 = o2.files, T2 = 0; T2 < b2.length; ++T2) h2.prototype.requests[b2[T2].filename].onload();
            u2.removeRunDependency("datafile_postgres.data");
          }
          u2.addRunDependency("datafile_postgres.data"), u2.preloadResults ?? (u2.preloadResults = {}), u2.preloadResults[l2] = { fromCache: false }, c2 ? (y2(c2), c2 = null) : g2 = y2;
        }
        Module.calledRun ? f2(Module) : (Module.preRun ?? (Module.preRun = [])).push(f2);
      }
      a2({ files: [{ filename: "/home/web_user/.pgpass", start: 0, end: 204 }, { filename: "/tmp/pglite/bin/initdb", start: 204, end: 216 }, { filename: "/tmp/pglite/bin/postgres", start: 216, end: 228 }, { filename: "/tmp/pglite/lib/postgresql/cyrillic_and_mic.so", start: 228, end: 20397 }, { filename: "/tmp/pglite/lib/postgresql/dict_snowball.so", start: 20397, end: 1581299 }, { filename: "/tmp/pglite/lib/postgresql/euc2004_sjis2004.so", start: 1581299, end: 1592382 }, { filename: "/tmp/pglite/lib/postgresql/euc_cn_and_mic.so", start: 1592382, end: 1599256 }, { filename: "/tmp/pglite/lib/postgresql/euc_jp_and_sjis.so", start: 1599256, end: 1622931 }, { filename: "/tmp/pglite/lib/postgresql/euc_kr_and_mic.so", start: 1622931, end: 1630057 }, { filename: "/tmp/pglite/lib/postgresql/euc_tw_and_big5.so", start: 1630057, end: 1651566 }, { filename: "/tmp/pglite/lib/postgresql/latin2_and_win1250.so", start: 1651566, end: 1660345 }, { filename: "/tmp/pglite/lib/postgresql/latin_and_mic.so", start: 1660345, end: 1668272 }, { filename: "/tmp/pglite/lib/postgresql/libpqwalreceiver.so", start: 1668272, end: 2186522 }, { filename: "/tmp/pglite/lib/postgresql/pgoutput.so", start: 2186522, end: 2303364 }, { filename: "/tmp/pglite/lib/postgresql/pgxs/config/install-sh", start: 2303364, end: 2317361 }, { filename: "/tmp/pglite/lib/postgresql/pgxs/config/missing", start: 2317361, end: 2318709 }, { filename: "/tmp/pglite/lib/postgresql/pgxs/src/Makefile.global", start: 2318709, end: 2354956 }, { filename: "/tmp/pglite/lib/postgresql/pgxs/src/Makefile.port", start: 2354956, end: 2355232 }, { filename: "/tmp/pglite/lib/postgresql/pgxs/src/Makefile.shlib", start: 2355232, end: 2371270 }, { filename: "/tmp/pglite/lib/postgresql/pgxs/src/makefiles/pgxs.mk", start: 2371270, end: 2386198 }, { filename: "/tmp/pglite/lib/postgresql/pgxs/src/nls-global.mk", start: 2386198, end: 2393083 }, { filename: "/tmp/pglite/lib/postgresql/pgxs/src/test/isolation/isolationtester.cjs", start: 2393083, end: 2589770 }, { filename: "/tmp/pglite/lib/postgresql/pgxs/src/test/isolation/pg_isolation_regress.cjs", start: 2589770, end: 2742128 }, { filename: "/tmp/pglite/lib/postgresql/pgxs/src/test/regress/pg_regress.cjs", start: 2742128, end: 2894476 }, { filename: "/tmp/pglite/lib/postgresql/plpgsql.so", start: 2894476, end: 3653241 }, { filename: "/tmp/pglite/password", start: 3653241, end: 3653250 }, { filename: "/tmp/pglite/share/postgresql/errcodes.txt", start: 3653250, end: 3686708 }, { filename: "/tmp/pglite/share/postgresql/extension/plpgsql--1.0.sql", start: 3686708, end: 3687366 }, { filename: "/tmp/pglite/share/postgresql/extension/plpgsql.control", start: 3687366, end: 3687559 }, { filename: "/tmp/pglite/share/postgresql/fix-CVE-2024-4317.sql", start: 3687559, end: 3693324 }, { filename: "/tmp/pglite/share/postgresql/information_schema.sql", start: 3693324, end: 3808299 }, { filename: "/tmp/pglite/share/postgresql/pg_hba.conf.sample", start: 3808299, end: 3813924 }, { filename: "/tmp/pglite/share/postgresql/pg_ident.conf.sample", start: 3813924, end: 3816564 }, { filename: "/tmp/pglite/share/postgresql/pg_service.conf.sample", start: 3816564, end: 3817168 }, { filename: "/tmp/pglite/share/postgresql/postgres.bki", start: 3817168, end: 4761272 }, { filename: "/tmp/pglite/share/postgresql/postgresql.conf.sample", start: 4761272, end: 4790919 }, { filename: "/tmp/pglite/share/postgresql/psqlrc.sample", start: 4790919, end: 4791197 }, { filename: "/tmp/pglite/share/postgresql/snowball_create.sql", start: 4791197, end: 4835373 }, { filename: "/tmp/pglite/share/postgresql/sql_features.txt", start: 4835373, end: 4871054 }, { filename: "/tmp/pglite/share/postgresql/system_constraints.sql", start: 4871054, end: 4879949 }, { filename: "/tmp/pglite/share/postgresql/system_functions.sql", start: 4879949, end: 4903264 }, { filename: "/tmp/pglite/share/postgresql/system_views.sql", start: 4903264, end: 4953537 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Abidjan", start: 4953537, end: 4953667 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Accra", start: 4953667, end: 4953797 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Addis_Ababa", start: 4953797, end: 4953988 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Algiers", start: 4953988, end: 4954458 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Asmara", start: 4954458, end: 4954649 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Asmera", start: 4954649, end: 4954840 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Bamako", start: 4954840, end: 4954970 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Bangui", start: 4954970, end: 4955150 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Banjul", start: 4955150, end: 4955280 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Bissau", start: 4955280, end: 4955429 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Blantyre", start: 4955429, end: 4955560 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Brazzaville", start: 4955560, end: 4955740 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Bujumbura", start: 4955740, end: 4955871 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Cairo", start: 4955871, end: 4957180 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Casablanca", start: 4957180, end: 4959099 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Ceuta", start: 4959099, end: 4959661 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Conakry", start: 4959661, end: 4959791 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Dakar", start: 4959791, end: 4959921 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Dar_es_Salaam", start: 4959921, end: 4960112 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Djibouti", start: 4960112, end: 4960303 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Douala", start: 4960303, end: 4960483 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/El_Aaiun", start: 4960483, end: 4962313 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Freetown", start: 4962313, end: 4962443 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Gaborone", start: 4962443, end: 4962574 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Harare", start: 4962574, end: 4962705 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Johannesburg", start: 4962705, end: 4962895 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Juba", start: 4962895, end: 4963353 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Kampala", start: 4963353, end: 4963544 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Khartoum", start: 4963544, end: 4964002 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Kigali", start: 4964002, end: 4964133 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Kinshasa", start: 4964133, end: 4964313 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Lagos", start: 4964313, end: 4964493 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Libreville", start: 4964493, end: 4964673 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Lome", start: 4964673, end: 4964803 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Luanda", start: 4964803, end: 4964983 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Lubumbashi", start: 4964983, end: 4965114 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Lusaka", start: 4965114, end: 4965245 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Malabo", start: 4965245, end: 4965425 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Maputo", start: 4965425, end: 4965556 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Maseru", start: 4965556, end: 4965746 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Mbabane", start: 4965746, end: 4965936 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Mogadishu", start: 4965936, end: 4966127 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Monrovia", start: 4966127, end: 4966291 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Nairobi", start: 4966291, end: 4966482 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Ndjamena", start: 4966482, end: 4966642 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Niamey", start: 4966642, end: 4966822 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Nouakchott", start: 4966822, end: 4966952 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Ouagadougou", start: 4966952, end: 4967082 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Porto-Novo", start: 4967082, end: 4967262 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Sao_Tome", start: 4967262, end: 4967435 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Timbuktu", start: 4967435, end: 4967565 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Tripoli", start: 4967565, end: 4967996 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Tunis", start: 4967996, end: 4968445 }, { filename: "/tmp/pglite/share/postgresql/timezone/Africa/Windhoek", start: 4968445, end: 4969083 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Adak", start: 4969083, end: 4970052 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Anchorage", start: 4970052, end: 4971029 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Anguilla", start: 4971029, end: 4971206 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Antigua", start: 4971206, end: 4971383 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Araguaina", start: 4971383, end: 4971975 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Argentina/Buenos_Aires", start: 4971975, end: 4972683 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Argentina/Catamarca", start: 4972683, end: 4973391 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Argentina/ComodRivadavia", start: 4973391, end: 4974099 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Argentina/Cordoba", start: 4974099, end: 4974807 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Argentina/Jujuy", start: 4974807, end: 4975497 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Argentina/La_Rioja", start: 4975497, end: 4976214 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Argentina/Mendoza", start: 4976214, end: 4976922 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Argentina/Rio_Gallegos", start: 4976922, end: 4977630 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Argentina/Salta", start: 4977630, end: 4978320 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Argentina/San_Juan", start: 4978320, end: 4979037 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Argentina/San_Luis", start: 4979037, end: 4979754 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Argentina/Tucuman", start: 4979754, end: 4980480 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Argentina/Ushuaia", start: 4980480, end: 4981188 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Aruba", start: 4981188, end: 4981365 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Asuncion", start: 4981365, end: 4982249 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Atikokan", start: 4982249, end: 4982398 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Atka", start: 4982398, end: 4983367 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Bahia", start: 4983367, end: 4984049 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Bahia_Banderas", start: 4984049, end: 4984777 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Barbados", start: 4984777, end: 4985055 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Belem", start: 4985055, end: 4985449 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Belize", start: 4985449, end: 4986494 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Blanc-Sablon", start: 4986494, end: 4986671 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Boa_Vista", start: 4986671, end: 4987101 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Bogota", start: 4987101, end: 4987280 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Boise", start: 4987280, end: 4988279 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Buenos_Aires", start: 4988279, end: 4988987 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Cambridge_Bay", start: 4988987, end: 4989870 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Campo_Grande", start: 4989870, end: 4990822 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Cancun", start: 4990822, end: 4991351 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Caracas", start: 4991351, end: 4991541 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Catamarca", start: 4991541, end: 4992249 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Cayenne", start: 4992249, end: 4992400 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Cayman", start: 4992400, end: 4992549 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Chicago", start: 4992549, end: 4994303 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Chihuahua", start: 4994303, end: 4994994 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Ciudad_Juarez", start: 4994994, end: 4995712 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Coral_Harbour", start: 4995712, end: 4995861 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Cordoba", start: 4995861, end: 4996569 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Costa_Rica", start: 4996569, end: 4996801 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Creston", start: 4996801, end: 4997041 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Cuiaba", start: 4997041, end: 4997975 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Curacao", start: 4997975, end: 4998152 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Danmarkshavn", start: 4998152, end: 4998599 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Dawson", start: 4998599, end: 4999628 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Dawson_Creek", start: 4999628, end: 5000311 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Denver", start: 5000311, end: 5001353 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Detroit", start: 5001353, end: 5002252 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Dominica", start: 5002252, end: 5002429 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Edmonton", start: 5002429, end: 5003399 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Eirunepe", start: 5003399, end: 5003835 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/El_Salvador", start: 5003835, end: 5004011 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Ensenada", start: 5004011, end: 5005036 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Fort_Nelson", start: 5005036, end: 5006484 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Fort_Wayne", start: 5006484, end: 5007015 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Fortaleza", start: 5007015, end: 5007499 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Glace_Bay", start: 5007499, end: 5008379 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Godthab", start: 5008379, end: 5009344 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Goose_Bay", start: 5009344, end: 5010924 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Grand_Turk", start: 5010924, end: 5011777 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Grenada", start: 5011777, end: 5011954 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Guadeloupe", start: 5011954, end: 5012131 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Guatemala", start: 5012131, end: 5012343 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Guayaquil", start: 5012343, end: 5012522 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Guyana", start: 5012522, end: 5012703 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Halifax", start: 5012703, end: 5014375 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Havana", start: 5014375, end: 5015492 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Hermosillo", start: 5015492, end: 5015778 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Indiana/Indianapolis", start: 5015778, end: 5016309 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Indiana/Knox", start: 5016309, end: 5017325 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Indiana/Marengo", start: 5017325, end: 5017892 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Indiana/Petersburg", start: 5017892, end: 5018575 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Indiana/Tell_City", start: 5018575, end: 5019097 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Indiana/Vevay", start: 5019097, end: 5019466 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Indiana/Vincennes", start: 5019466, end: 5020024 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Indiana/Winamac", start: 5020024, end: 5020636 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Indianapolis", start: 5020636, end: 5021167 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Inuvik", start: 5021167, end: 5021984 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Iqaluit", start: 5021984, end: 5022839 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Jamaica", start: 5022839, end: 5023178 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Jujuy", start: 5023178, end: 5023868 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Juneau", start: 5023868, end: 5024834 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Kentucky/Louisville", start: 5024834, end: 5026076 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Kentucky/Monticello", start: 5026076, end: 5027048 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Knox_IN", start: 5027048, end: 5028064 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Kralendijk", start: 5028064, end: 5028241 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/La_Paz", start: 5028241, end: 5028411 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Lima", start: 5028411, end: 5028694 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Los_Angeles", start: 5028694, end: 5029988 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Louisville", start: 5029988, end: 5031230 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Lower_Princes", start: 5031230, end: 5031407 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Maceio", start: 5031407, end: 5031909 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Managua", start: 5031909, end: 5032204 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Manaus", start: 5032204, end: 5032616 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Marigot", start: 5032616, end: 5032793 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Martinique", start: 5032793, end: 5032971 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Matamoros", start: 5032971, end: 5033408 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Mazatlan", start: 5033408, end: 5034126 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Mendoza", start: 5034126, end: 5034834 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Menominee", start: 5034834, end: 5035751 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Merida", start: 5035751, end: 5036405 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Metlakatla", start: 5036405, end: 5037e3 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Mexico_City", start: 5037e3, end: 5037773 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Miquelon", start: 5037773, end: 5038323 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Moncton", start: 5038323, end: 5039816 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Monterrey", start: 5039816, end: 5040460 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Montevideo", start: 5040460, end: 5041429 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Montreal", start: 5041429, end: 5043146 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Montserrat", start: 5043146, end: 5043323 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Nassau", start: 5043323, end: 5045040 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/New_York", start: 5045040, end: 5046784 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Nipigon", start: 5046784, end: 5048501 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Nome", start: 5048501, end: 5049476 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Noronha", start: 5049476, end: 5049960 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/North_Dakota/Beulah", start: 5049960, end: 5051003 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/North_Dakota/Center", start: 5051003, end: 5051993 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/North_Dakota/New_Salem", start: 5051993, end: 5052983 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Nuuk", start: 5052983, end: 5053948 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Ojinaga", start: 5053948, end: 5054657 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Panama", start: 5054657, end: 5054806 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Pangnirtung", start: 5054806, end: 5055661 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Paramaribo", start: 5055661, end: 5055848 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Phoenix", start: 5055848, end: 5056088 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Port-au-Prince", start: 5056088, end: 5056653 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Port_of_Spain", start: 5056653, end: 5056830 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Porto_Acre", start: 5056830, end: 5057248 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Porto_Velho", start: 5057248, end: 5057642 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Puerto_Rico", start: 5057642, end: 5057819 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Punta_Arenas", start: 5057819, end: 5059037 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Rainy_River", start: 5059037, end: 5060331 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Rankin_Inlet", start: 5060331, end: 5061138 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Recife", start: 5061138, end: 5061622 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Regina", start: 5061622, end: 5062260 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Resolute", start: 5062260, end: 5063067 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Rio_Branco", start: 5063067, end: 5063485 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Rosario", start: 5063485, end: 5064193 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Santa_Isabel", start: 5064193, end: 5065218 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Santarem", start: 5065218, end: 5065627 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Santiago", start: 5065627, end: 5066981 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Santo_Domingo", start: 5066981, end: 5067298 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Sao_Paulo", start: 5067298, end: 5068250 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Scoresbysund", start: 5068250, end: 5069234 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Shiprock", start: 5069234, end: 5070276 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Sitka", start: 5070276, end: 5071232 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/St_Barthelemy", start: 5071232, end: 5071409 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/St_Johns", start: 5071409, end: 5073287 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/St_Kitts", start: 5073287, end: 5073464 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/St_Lucia", start: 5073464, end: 5073641 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/St_Thomas", start: 5073641, end: 5073818 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/St_Vincent", start: 5073818, end: 5073995 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Swift_Current", start: 5073995, end: 5074363 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Tegucigalpa", start: 5074363, end: 5074557 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Thule", start: 5074557, end: 5075012 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Thunder_Bay", start: 5075012, end: 5076729 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Tijuana", start: 5076729, end: 5077754 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Toronto", start: 5077754, end: 5079471 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Tortola", start: 5079471, end: 5079648 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Vancouver", start: 5079648, end: 5080978 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Virgin", start: 5080978, end: 5081155 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Whitehorse", start: 5081155, end: 5082184 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Winnipeg", start: 5082184, end: 5083478 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Yakutat", start: 5083478, end: 5084424 }, { filename: "/tmp/pglite/share/postgresql/timezone/America/Yellowknife", start: 5084424, end: 5085394 }, { filename: "/tmp/pglite/share/postgresql/timezone/Antarctica/Casey", start: 5085394, end: 5085681 }, { filename: "/tmp/pglite/share/postgresql/timezone/Antarctica/Davis", start: 5085681, end: 5085878 }, { filename: "/tmp/pglite/share/postgresql/timezone/Antarctica/DumontDUrville", start: 5085878, end: 5086032 }, { filename: "/tmp/pglite/share/postgresql/timezone/Antarctica/Macquarie", start: 5086032, end: 5087008 }, { filename: "/tmp/pglite/share/postgresql/timezone/Antarctica/Mawson", start: 5087008, end: 5087160 }, { filename: "/tmp/pglite/share/postgresql/timezone/Antarctica/McMurdo", start: 5087160, end: 5088203 }, { filename: "/tmp/pglite/share/postgresql/timezone/Antarctica/Palmer", start: 5088203, end: 5089090 }, { filename: "/tmp/pglite/share/postgresql/timezone/Antarctica/Rothera", start: 5089090, end: 5089222 }, { filename: "/tmp/pglite/share/postgresql/timezone/Antarctica/South_Pole", start: 5089222, end: 5090265 }, { filename: "/tmp/pglite/share/postgresql/timezone/Antarctica/Syowa", start: 5090265, end: 5090398 }, { filename: "/tmp/pglite/share/postgresql/timezone/Antarctica/Troll", start: 5090398, end: 5090575 }, { filename: "/tmp/pglite/share/postgresql/timezone/Antarctica/Vostok", start: 5090575, end: 5090745 }, { filename: "/tmp/pglite/share/postgresql/timezone/Arctic/Longyearbyen", start: 5090745, end: 5091450 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Aden", start: 5091450, end: 5091583 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Almaty", start: 5091583, end: 5092201 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Amman", start: 5092201, end: 5093129 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Anadyr", start: 5093129, end: 5093872 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Aqtau", start: 5093872, end: 5094478 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Aqtobe", start: 5094478, end: 5095093 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Ashgabat", start: 5095093, end: 5095468 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Ashkhabad", start: 5095468, end: 5095843 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Atyrau", start: 5095843, end: 5096459 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Baghdad", start: 5096459, end: 5097089 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Bahrain", start: 5097089, end: 5097241 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Baku", start: 5097241, end: 5097985 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Bangkok", start: 5097985, end: 5098137 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Barnaul", start: 5098137, end: 5098890 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Beirut", start: 5098890, end: 5099622 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Bishkek", start: 5099622, end: 5100240 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Brunei", start: 5100240, end: 5100560 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Calcutta", start: 5100560, end: 5100780 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Chita", start: 5100780, end: 5101530 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Choibalsan", start: 5101530, end: 5102149 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Chongqing", start: 5102149, end: 5102542 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Chungking", start: 5102542, end: 5102935 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Colombo", start: 5102935, end: 5103182 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Dacca", start: 5103182, end: 5103413 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Damascus", start: 5103413, end: 5104647 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Dhaka", start: 5104647, end: 5104878 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Dili", start: 5104878, end: 5105048 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Dubai", start: 5105048, end: 5105181 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Dushanbe", start: 5105181, end: 5105547 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Famagusta", start: 5105547, end: 5106487 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Gaza", start: 5106487, end: 5108933 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Harbin", start: 5108933, end: 5109326 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Hebron", start: 5109326, end: 5111790 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Ho_Chi_Minh", start: 5111790, end: 5112026 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Hong_Kong", start: 5112026, end: 5112801 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Hovd", start: 5112801, end: 5113395 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Irkutsk", start: 5113395, end: 5114155 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Istanbul", start: 5114155, end: 5115355 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Jakarta", start: 5115355, end: 5115603 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Jayapura", start: 5115603, end: 5115774 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Jerusalem", start: 5115774, end: 5116848 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Kabul", start: 5116848, end: 5117007 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Kamchatka", start: 5117007, end: 5117734 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Karachi", start: 5117734, end: 5118e3 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Kashgar", start: 5118e3, end: 5118133 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Kathmandu", start: 5118133, end: 5118294 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Katmandu", start: 5118294, end: 5118455 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Khandyga", start: 5118455, end: 5119230 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Kolkata", start: 5119230, end: 5119450 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Krasnoyarsk", start: 5119450, end: 5120191 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Kuala_Lumpur", start: 5120191, end: 5120447 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Kuching", start: 5120447, end: 5120767 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Kuwait", start: 5120767, end: 5120900 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Macao", start: 5120900, end: 5121691 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Macau", start: 5121691, end: 5122482 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Magadan", start: 5122482, end: 5123233 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Makassar", start: 5123233, end: 5123423 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Manila", start: 5123423, end: 5123661 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Muscat", start: 5123661, end: 5123794 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Nicosia", start: 5123794, end: 5124391 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Novokuznetsk", start: 5124391, end: 5125117 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Novosibirsk", start: 5125117, end: 5125870 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Omsk", start: 5125870, end: 5126611 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Oral", start: 5126611, end: 5127236 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Phnom_Penh", start: 5127236, end: 5127388 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Pontianak", start: 5127388, end: 5127635 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Pyongyang", start: 5127635, end: 5127818 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Qatar", start: 5127818, end: 5127970 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Qostanay", start: 5127970, end: 5128594 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Qyzylorda", start: 5128594, end: 5129218 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Rangoon", start: 5129218, end: 5129405 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Riyadh", start: 5129405, end: 5129538 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Saigon", start: 5129538, end: 5129774 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Sakhalin", start: 5129774, end: 5130529 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Samarkand", start: 5130529, end: 5130895 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Seoul", start: 5130895, end: 5131310 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Shanghai", start: 5131310, end: 5131703 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Singapore", start: 5131703, end: 5131959 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Srednekolymsk", start: 5131959, end: 5132701 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Taipei", start: 5132701, end: 5133212 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Tashkent", start: 5133212, end: 5133578 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Tbilisi", start: 5133578, end: 5134207 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Tehran", start: 5134207, end: 5135019 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Tel_Aviv", start: 5135019, end: 5136093 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Thimbu", start: 5136093, end: 5136247 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Thimphu", start: 5136247, end: 5136401 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Tokyo", start: 5136401, end: 5136614 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Tomsk", start: 5136614, end: 5137367 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Ujung_Pandang", start: 5137367, end: 5137557 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Ulaanbaatar", start: 5137557, end: 5138151 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Ulan_Bator", start: 5138151, end: 5138745 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Urumqi", start: 5138745, end: 5138878 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Ust-Nera", start: 5138878, end: 5139649 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Vientiane", start: 5139649, end: 5139801 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Vladivostok", start: 5139801, end: 5140543 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Yakutsk", start: 5140543, end: 5141284 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Yangon", start: 5141284, end: 5141471 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Yekaterinburg", start: 5141471, end: 5142231 }, { filename: "/tmp/pglite/share/postgresql/timezone/Asia/Yerevan", start: 5142231, end: 5142939 }, { filename: "/tmp/pglite/share/postgresql/timezone/Atlantic/Azores", start: 5142939, end: 5144392 }, { filename: "/tmp/pglite/share/postgresql/timezone/Atlantic/Bermuda", start: 5144392, end: 5145416 }, { filename: "/tmp/pglite/share/postgresql/timezone/Atlantic/Canary", start: 5145416, end: 5145894 }, { filename: "/tmp/pglite/share/postgresql/timezone/Atlantic/Cape_Verde", start: 5145894, end: 5146069 }, { filename: "/tmp/pglite/share/postgresql/timezone/Atlantic/Faeroe", start: 5146069, end: 5146510 }, { filename: "/tmp/pglite/share/postgresql/timezone/Atlantic/Faroe", start: 5146510, end: 5146951 }, { filename: "/tmp/pglite/share/postgresql/timezone/Atlantic/Jan_Mayen", start: 5146951, end: 5147656 }, { filename: "/tmp/pglite/share/postgresql/timezone/Atlantic/Madeira", start: 5147656, end: 5149109 }, { filename: "/tmp/pglite/share/postgresql/timezone/Atlantic/Reykjavik", start: 5149109, end: 5149239 }, { filename: "/tmp/pglite/share/postgresql/timezone/Atlantic/South_Georgia", start: 5149239, end: 5149371 }, { filename: "/tmp/pglite/share/postgresql/timezone/Atlantic/St_Helena", start: 5149371, end: 5149501 }, { filename: "/tmp/pglite/share/postgresql/timezone/Atlantic/Stanley", start: 5149501, end: 5150290 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/ACT", start: 5150290, end: 5151194 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/Adelaide", start: 5151194, end: 5152115 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/Brisbane", start: 5152115, end: 5152404 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/Broken_Hill", start: 5152404, end: 5153345 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/Canberra", start: 5153345, end: 5154249 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/Currie", start: 5154249, end: 5155252 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/Darwin", start: 5155252, end: 5155486 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/Eucla", start: 5155486, end: 5155800 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/Hobart", start: 5155800, end: 5156803 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/LHI", start: 5156803, end: 5157495 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/Lindeman", start: 5157495, end: 5157820 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/Lord_Howe", start: 5157820, end: 5158512 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/Melbourne", start: 5158512, end: 5159416 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/NSW", start: 5159416, end: 5160320 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/North", start: 5160320, end: 5160554 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/Perth", start: 5160554, end: 5160860 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/Queensland", start: 5160860, end: 5161149 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/South", start: 5161149, end: 5162070 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/Sydney", start: 5162070, end: 5162974 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/Tasmania", start: 5162974, end: 5163977 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/Victoria", start: 5163977, end: 5164881 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/West", start: 5164881, end: 5165187 }, { filename: "/tmp/pglite/share/postgresql/timezone/Australia/Yancowinna", start: 5165187, end: 5166128 }, { filename: "/tmp/pglite/share/postgresql/timezone/Brazil/Acre", start: 5166128, end: 5166546 }, { filename: "/tmp/pglite/share/postgresql/timezone/Brazil/DeNoronha", start: 5166546, end: 5167030 }, { filename: "/tmp/pglite/share/postgresql/timezone/Brazil/East", start: 5167030, end: 5167982 }, { filename: "/tmp/pglite/share/postgresql/timezone/Brazil/West", start: 5167982, end: 5168394 }, { filename: "/tmp/pglite/share/postgresql/timezone/CET", start: 5168394, end: 5169015 }, { filename: "/tmp/pglite/share/postgresql/timezone/CST6CDT", start: 5169015, end: 5169966 }, { filename: "/tmp/pglite/share/postgresql/timezone/Canada/Atlantic", start: 5169966, end: 5171638 }, { filename: "/tmp/pglite/share/postgresql/timezone/Canada/Central", start: 5171638, end: 5172932 }, { filename: "/tmp/pglite/share/postgresql/timezone/Canada/Eastern", start: 5172932, end: 5174649 }, { filename: "/tmp/pglite/share/postgresql/timezone/Canada/Mountain", start: 5174649, end: 5175619 }, { filename: "/tmp/pglite/share/postgresql/timezone/Canada/Newfoundland", start: 5175619, end: 5177497 }, { filename: "/tmp/pglite/share/postgresql/timezone/Canada/Pacific", start: 5177497, end: 5178827 }, { filename: "/tmp/pglite/share/postgresql/timezone/Canada/Saskatchewan", start: 5178827, end: 5179465 }, { filename: "/tmp/pglite/share/postgresql/timezone/Canada/Yukon", start: 5179465, end: 5180494 }, { filename: "/tmp/pglite/share/postgresql/timezone/Chile/Continental", start: 5180494, end: 5181848 }, { filename: "/tmp/pglite/share/postgresql/timezone/Chile/EasterIsland", start: 5181848, end: 5183022 }, { filename: "/tmp/pglite/share/postgresql/timezone/Cuba", start: 5183022, end: 5184139 }, { filename: "/tmp/pglite/share/postgresql/timezone/EET", start: 5184139, end: 5184636 }, { filename: "/tmp/pglite/share/postgresql/timezone/EST", start: 5184636, end: 5184747 }, { filename: "/tmp/pglite/share/postgresql/timezone/EST5EDT", start: 5184747, end: 5185698 }, { filename: "/tmp/pglite/share/postgresql/timezone/Egypt", start: 5185698, end: 5187007 }, { filename: "/tmp/pglite/share/postgresql/timezone/Eire", start: 5187007, end: 5188503 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT", start: 5188503, end: 5188614 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT+0", start: 5188614, end: 5188725 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT+1", start: 5188725, end: 5188838 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT+10", start: 5188838, end: 5188952 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT+11", start: 5188952, end: 5189066 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT+12", start: 5189066, end: 5189180 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT+2", start: 5189180, end: 5189293 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT+3", start: 5189293, end: 5189406 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT+4", start: 5189406, end: 5189519 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT+5", start: 5189519, end: 5189632 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT+6", start: 5189632, end: 5189745 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT+7", start: 5189745, end: 5189858 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT+8", start: 5189858, end: 5189971 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT+9", start: 5189971, end: 5190084 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT-0", start: 5190084, end: 5190195 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT-1", start: 5190195, end: 5190309 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT-10", start: 5190309, end: 5190424 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT-11", start: 5190424, end: 5190539 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT-12", start: 5190539, end: 5190654 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT-13", start: 5190654, end: 5190769 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT-14", start: 5190769, end: 5190884 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT-2", start: 5190884, end: 5190998 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT-3", start: 5190998, end: 5191112 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT-4", start: 5191112, end: 5191226 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT-5", start: 5191226, end: 5191340 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT-6", start: 5191340, end: 5191454 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT-7", start: 5191454, end: 5191568 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT-8", start: 5191568, end: 5191682 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT-9", start: 5191682, end: 5191796 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/GMT0", start: 5191796, end: 5191907 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/Greenwich", start: 5191907, end: 5192018 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/UCT", start: 5192018, end: 5192129 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/UTC", start: 5192129, end: 5192240 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/Universal", start: 5192240, end: 5192351 }, { filename: "/tmp/pglite/share/postgresql/timezone/Etc/Zulu", start: 5192351, end: 5192462 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Amsterdam", start: 5192462, end: 5193565 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Andorra", start: 5193565, end: 5193954 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Astrakhan", start: 5193954, end: 5194680 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Athens", start: 5194680, end: 5195362 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Belfast", start: 5195362, end: 5196961 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Belgrade", start: 5196961, end: 5197439 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Berlin", start: 5197439, end: 5198144 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Bratislava", start: 5198144, end: 5198867 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Brussels", start: 5198867, end: 5199970 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Bucharest", start: 5199970, end: 5200631 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Budapest", start: 5200631, end: 5201397 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Busingen", start: 5201397, end: 5201894 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Chisinau", start: 5201894, end: 5202649 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Copenhagen", start: 5202649, end: 5203354 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Dublin", start: 5203354, end: 5204850 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Gibraltar", start: 5204850, end: 5206070 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Guernsey", start: 5206070, end: 5207669 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Helsinki", start: 5207669, end: 5208150 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Isle_of_Man", start: 5208150, end: 5209749 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Istanbul", start: 5209749, end: 5210949 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Jersey", start: 5210949, end: 5212548 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Kaliningrad", start: 5212548, end: 5213452 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Kiev", start: 5213452, end: 5214010 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Kirov", start: 5214010, end: 5214745 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Kyiv", start: 5214745, end: 5215303 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Lisbon", start: 5215303, end: 5216757 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Ljubljana", start: 5216757, end: 5217235 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/London", start: 5217235, end: 5218834 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Luxembourg", start: 5218834, end: 5219937 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Madrid", start: 5219937, end: 5220834 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Malta", start: 5220834, end: 5221762 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Mariehamn", start: 5221762, end: 5222243 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Minsk", start: 5222243, end: 5223051 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Monaco", start: 5223051, end: 5224156 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Moscow", start: 5224156, end: 5225064 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Nicosia", start: 5225064, end: 5225661 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Oslo", start: 5225661, end: 5226366 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Paris", start: 5226366, end: 5227471 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Podgorica", start: 5227471, end: 5227949 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Prague", start: 5227949, end: 5228672 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Riga", start: 5228672, end: 5229366 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Rome", start: 5229366, end: 5230313 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Samara", start: 5230313, end: 5231045 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/San_Marino", start: 5231045, end: 5231992 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Sarajevo", start: 5231992, end: 5232470 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Saratov", start: 5232470, end: 5233196 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Simferopol", start: 5233196, end: 5234061 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Skopje", start: 5234061, end: 5234539 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Sofia", start: 5234539, end: 5235131 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Stockholm", start: 5235131, end: 5235836 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Tallinn", start: 5235836, end: 5236511 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Tirane", start: 5236511, end: 5237115 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Tiraspol", start: 5237115, end: 5237870 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Ulyanovsk", start: 5237870, end: 5238630 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Uzhgorod", start: 5238630, end: 5239188 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Vaduz", start: 5239188, end: 5239685 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Vatican", start: 5239685, end: 5240632 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Vienna", start: 5240632, end: 5241290 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Vilnius", start: 5241290, end: 5241966 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Volgograd", start: 5241966, end: 5242719 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Warsaw", start: 5242719, end: 5243642 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Zagreb", start: 5243642, end: 5244120 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Zaporozhye", start: 5244120, end: 5244678 }, { filename: "/tmp/pglite/share/postgresql/timezone/Europe/Zurich", start: 5244678, end: 5245175 }, { filename: "/tmp/pglite/share/postgresql/timezone/Factory", start: 5245175, end: 5245288 }, { filename: "/tmp/pglite/share/postgresql/timezone/GB", start: 5245288, end: 5246887 }, { filename: "/tmp/pglite/share/postgresql/timezone/GB-Eire", start: 5246887, end: 5248486 }, { filename: "/tmp/pglite/share/postgresql/timezone/GMT", start: 5248486, end: 5248597 }, { filename: "/tmp/pglite/share/postgresql/timezone/GMT+0", start: 5248597, end: 5248708 }, { filename: "/tmp/pglite/share/postgresql/timezone/GMT-0", start: 5248708, end: 5248819 }, { filename: "/tmp/pglite/share/postgresql/timezone/GMT0", start: 5248819, end: 5248930 }, { filename: "/tmp/pglite/share/postgresql/timezone/Greenwich", start: 5248930, end: 5249041 }, { filename: "/tmp/pglite/share/postgresql/timezone/HST", start: 5249041, end: 5249153 }, { filename: "/tmp/pglite/share/postgresql/timezone/Hongkong", start: 5249153, end: 5249928 }, { filename: "/tmp/pglite/share/postgresql/timezone/Iceland", start: 5249928, end: 5250058 }, { filename: "/tmp/pglite/share/postgresql/timezone/Indian/Antananarivo", start: 5250058, end: 5250249 }, { filename: "/tmp/pglite/share/postgresql/timezone/Indian/Chagos", start: 5250249, end: 5250401 }, { filename: "/tmp/pglite/share/postgresql/timezone/Indian/Christmas", start: 5250401, end: 5250553 }, { filename: "/tmp/pglite/share/postgresql/timezone/Indian/Cocos", start: 5250553, end: 5250740 }, { filename: "/tmp/pglite/share/postgresql/timezone/Indian/Comoro", start: 5250740, end: 5250931 }, { filename: "/tmp/pglite/share/postgresql/timezone/Indian/Kerguelen", start: 5250931, end: 5251083 }, { filename: "/tmp/pglite/share/postgresql/timezone/Indian/Mahe", start: 5251083, end: 5251216 }, { filename: "/tmp/pglite/share/postgresql/timezone/Indian/Maldives", start: 5251216, end: 5251368 }, { filename: "/tmp/pglite/share/postgresql/timezone/Indian/Mauritius", start: 5251368, end: 5251547 }, { filename: "/tmp/pglite/share/postgresql/timezone/Indian/Mayotte", start: 5251547, end: 5251738 }, { filename: "/tmp/pglite/share/postgresql/timezone/Indian/Reunion", start: 5251738, end: 5251871 }, { filename: "/tmp/pglite/share/postgresql/timezone/Iran", start: 5251871, end: 5252683 }, { filename: "/tmp/pglite/share/postgresql/timezone/Israel", start: 5252683, end: 5253757 }, { filename: "/tmp/pglite/share/postgresql/timezone/Jamaica", start: 5253757, end: 5254096 }, { filename: "/tmp/pglite/share/postgresql/timezone/Japan", start: 5254096, end: 5254309 }, { filename: "/tmp/pglite/share/postgresql/timezone/Kwajalein", start: 5254309, end: 5254528 }, { filename: "/tmp/pglite/share/postgresql/timezone/Libya", start: 5254528, end: 5254959 }, { filename: "/tmp/pglite/share/postgresql/timezone/MET", start: 5254959, end: 5255580 }, { filename: "/tmp/pglite/share/postgresql/timezone/MST", start: 5255580, end: 5255691 }, { filename: "/tmp/pglite/share/postgresql/timezone/MST7MDT", start: 5255691, end: 5256642 }, { filename: "/tmp/pglite/share/postgresql/timezone/Mexico/BajaNorte", start: 5256642, end: 5257667 }, { filename: "/tmp/pglite/share/postgresql/timezone/Mexico/BajaSur", start: 5257667, end: 5258385 }, { filename: "/tmp/pglite/share/postgresql/timezone/Mexico/General", start: 5258385, end: 5259158 }, { filename: "/tmp/pglite/share/postgresql/timezone/NZ", start: 5259158, end: 5260201 }, { filename: "/tmp/pglite/share/postgresql/timezone/NZ-CHAT", start: 5260201, end: 5261009 }, { filename: "/tmp/pglite/share/postgresql/timezone/Navajo", start: 5261009, end: 5262051 }, { filename: "/tmp/pglite/share/postgresql/timezone/PRC", start: 5262051, end: 5262444 }, { filename: "/tmp/pglite/share/postgresql/timezone/PST8PDT", start: 5262444, end: 5263395 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Apia", start: 5263395, end: 5263802 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Auckland", start: 5263802, end: 5264845 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Bougainville", start: 5264845, end: 5265046 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Chatham", start: 5265046, end: 5265854 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Chuuk", start: 5265854, end: 5266008 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Easter", start: 5266008, end: 5267182 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Efate", start: 5267182, end: 5267524 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Enderbury", start: 5267524, end: 5267696 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Fakaofo", start: 5267696, end: 5267849 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Fiji", start: 5267849, end: 5268245 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Funafuti", start: 5268245, end: 5268379 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Galapagos", start: 5268379, end: 5268554 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Gambier", start: 5268554, end: 5268686 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Guadalcanal", start: 5268686, end: 5268820 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Guam", start: 5268820, end: 5269170 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Honolulu", start: 5269170, end: 5269391 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Johnston", start: 5269391, end: 5269612 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Kanton", start: 5269612, end: 5269784 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Kiritimati", start: 5269784, end: 5269958 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Kosrae", start: 5269958, end: 5270200 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Kwajalein", start: 5270200, end: 5270419 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Majuro", start: 5270419, end: 5270553 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Marquesas", start: 5270553, end: 5270692 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Midway", start: 5270692, end: 5270838 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Nauru", start: 5270838, end: 5271021 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Niue", start: 5271021, end: 5271175 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Norfolk", start: 5271175, end: 5271422 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Noumea", start: 5271422, end: 5271620 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Pago_Pago", start: 5271620, end: 5271766 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Palau", start: 5271766, end: 5271914 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Pitcairn", start: 5271914, end: 5272067 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Pohnpei", start: 5272067, end: 5272201 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Ponape", start: 5272201, end: 5272335 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Port_Moresby", start: 5272335, end: 5272489 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Rarotonga", start: 5272489, end: 5272895 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Saipan", start: 5272895, end: 5273245 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Samoa", start: 5273245, end: 5273391 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Tahiti", start: 5273391, end: 5273524 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Tarawa", start: 5273524, end: 5273658 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Tongatapu", start: 5273658, end: 5273895 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Truk", start: 5273895, end: 5274049 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Wake", start: 5274049, end: 5274183 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Wallis", start: 5274183, end: 5274317 }, { filename: "/tmp/pglite/share/postgresql/timezone/Pacific/Yap", start: 5274317, end: 5274471 }, { filename: "/tmp/pglite/share/postgresql/timezone/Poland", start: 5274471, end: 5275394 }, { filename: "/tmp/pglite/share/postgresql/timezone/Portugal", start: 5275394, end: 5276848 }, { filename: "/tmp/pglite/share/postgresql/timezone/ROC", start: 5276848, end: 5277359 }, { filename: "/tmp/pglite/share/postgresql/timezone/ROK", start: 5277359, end: 5277774 }, { filename: "/tmp/pglite/share/postgresql/timezone/Singapore", start: 5277774, end: 5278030 }, { filename: "/tmp/pglite/share/postgresql/timezone/Turkey", start: 5278030, end: 5279230 }, { filename: "/tmp/pglite/share/postgresql/timezone/UCT", start: 5279230, end: 5279341 }, { filename: "/tmp/pglite/share/postgresql/timezone/US/Alaska", start: 5279341, end: 5280318 }, { filename: "/tmp/pglite/share/postgresql/timezone/US/Aleutian", start: 5280318, end: 5281287 }, { filename: "/tmp/pglite/share/postgresql/timezone/US/Arizona", start: 5281287, end: 5281527 }, { filename: "/tmp/pglite/share/postgresql/timezone/US/Central", start: 5281527, end: 5283281 }, { filename: "/tmp/pglite/share/postgresql/timezone/US/East-Indiana", start: 5283281, end: 5283812 }, { filename: "/tmp/pglite/share/postgresql/timezone/US/Eastern", start: 5283812, end: 5285556 }, { filename: "/tmp/pglite/share/postgresql/timezone/US/Hawaii", start: 5285556, end: 5285777 }, { filename: "/tmp/pglite/share/postgresql/timezone/US/Indiana-Starke", start: 5285777, end: 5286793 }, { filename: "/tmp/pglite/share/postgresql/timezone/US/Michigan", start: 5286793, end: 5287692 }, { filename: "/tmp/pglite/share/postgresql/timezone/US/Mountain", start: 5287692, end: 5288734 }, { filename: "/tmp/pglite/share/postgresql/timezone/US/Pacific", start: 5288734, end: 5290028 }, { filename: "/tmp/pglite/share/postgresql/timezone/US/Samoa", start: 5290028, end: 5290174 }, { filename: "/tmp/pglite/share/postgresql/timezone/UTC", start: 5290174, end: 5290285 }, { filename: "/tmp/pglite/share/postgresql/timezone/Universal", start: 5290285, end: 5290396 }, { filename: "/tmp/pglite/share/postgresql/timezone/W-SU", start: 5290396, end: 5291304 }, { filename: "/tmp/pglite/share/postgresql/timezone/WET", start: 5291304, end: 5291798 }, { filename: "/tmp/pglite/share/postgresql/timezone/Zulu", start: 5291798, end: 5291909 }, { filename: "/tmp/pglite/share/postgresql/timezonesets/Africa.txt", start: 5291909, end: 5298882 }, { filename: "/tmp/pglite/share/postgresql/timezonesets/America.txt", start: 5298882, end: 5309889 }, { filename: "/tmp/pglite/share/postgresql/timezonesets/Antarctica.txt", start: 5309889, end: 5311023 }, { filename: "/tmp/pglite/share/postgresql/timezonesets/Asia.txt", start: 5311023, end: 5319334 }, { filename: "/tmp/pglite/share/postgresql/timezonesets/Atlantic.txt", start: 5319334, end: 5322867 }, { filename: "/tmp/pglite/share/postgresql/timezonesets/Australia", start: 5322867, end: 5324002 }, { filename: "/tmp/pglite/share/postgresql/timezonesets/Australia.txt", start: 5324002, end: 5327386 }, { filename: "/tmp/pglite/share/postgresql/timezonesets/Default", start: 5327386, end: 5354636 }, { filename: "/tmp/pglite/share/postgresql/timezonesets/Etc.txt", start: 5354636, end: 5355886 }, { filename: "/tmp/pglite/share/postgresql/timezonesets/Europe.txt", start: 5355886, end: 5364668 }, { filename: "/tmp/pglite/share/postgresql/timezonesets/India", start: 5364668, end: 5365261 }, { filename: "/tmp/pglite/share/postgresql/timezonesets/Indian.txt", start: 5365261, end: 5366522 }, { filename: "/tmp/pglite/share/postgresql/timezonesets/Pacific.txt", start: 5366522, end: 5370290 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/danish.stop", start: 5370290, end: 5370714 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/dutch.stop", start: 5370714, end: 5371167 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/english.stop", start: 5371167, end: 5371789 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/finnish.stop", start: 5371789, end: 5373368 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/french.stop", start: 5373368, end: 5374173 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/german.stop", start: 5374173, end: 5375522 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/hungarian.stop", start: 5375522, end: 5376749 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/hunspell_sample.affix", start: 5376749, end: 5376992 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/hunspell_sample_long.affix", start: 5376992, end: 5377625 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/hunspell_sample_long.dict", start: 5377625, end: 5377723 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/hunspell_sample_num.affix", start: 5377723, end: 5378185 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/hunspell_sample_num.dict", start: 5378185, end: 5378314 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/ispell_sample.affix", start: 5378314, end: 5378779 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/ispell_sample.dict", start: 5378779, end: 5378860 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/italian.stop", start: 5378860, end: 5380514 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/nepali.stop", start: 5380514, end: 5384775 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/norwegian.stop", start: 5384775, end: 5385626 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/portuguese.stop", start: 5385626, end: 5386893 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/russian.stop", start: 5386893, end: 5388128 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/spanish.stop", start: 5388128, end: 5390306 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/swedish.stop", start: 5390306, end: 5390865 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/synonym_sample.syn", start: 5390865, end: 5390938 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/thesaurus_sample.ths", start: 5390938, end: 5391411 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/turkish.stop", start: 5391411, end: 5391671 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/unaccent.rules", start: 5391671, end: 5401610 }, { filename: "/tmp/pglite/share/postgresql/tsearch_data/xsyn_sample.rules", start: 5401610, end: 5401749 }], remote_package_size: 5401749 });
    })();
    var moduleOverrides = Object.assign({}, Module), arguments_ = [], thisProgram = "./this.program", quit_ = (e, t) => {
      throw t;
    }, scriptDirectory = "";
    function locateFile(e) {
      return Module.locateFile ? Module.locateFile(e, scriptDirectory) : scriptDirectory + e;
    }
    var readAsync, readBinary;
    if (ENVIRONMENT_IS_NODE) {
      var fs = require("fs"), nodePath = require("path");
      import.meta.url.startsWith("data:") || (scriptDirectory = nodePath.dirname(require("url").fileURLToPath(import.meta.url)) + "/"), readBinary = (e) => {
        e = isFileURI(e) ? new URL(e) : e;
        var t = fs.readFileSync(e);
        return t;
      }, readAsync = async (e, t = true) => {
        e = isFileURI(e) ? new URL(e) : e;
        var r2 = fs.readFileSync(e, t ? void 0 : "utf8");
        return r2;
      }, !Module.thisProgram && process.argv.length > 1 && (thisProgram = process.argv[1].replace(/\\/g, "/")), arguments_ = process.argv.slice(2), quit_ = (e, t) => {
        throw process.exitCode = e, t;
      };
    } else (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && (ENVIRONMENT_IS_WORKER ? scriptDirectory = self.location.href : typeof document < "u" && document.currentScript && (scriptDirectory = document.currentScript.src), _scriptName && (scriptDirectory = _scriptName), scriptDirectory.startsWith("blob:") ? scriptDirectory = "" : scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1), readAsync = async (e) => {
      var t = await fetch(e, { credentials: "same-origin" });
      if (t.ok) return t.arrayBuffer();
      throw new Error(t.status + " : " + t.url);
    });
    var out = Module.print || console.log.bind(console), err = Module.printErr || console.error.bind(console);
    Object.assign(Module, moduleOverrides), moduleOverrides = null, Module.arguments && (arguments_ = Module.arguments), Module.thisProgram && (thisProgram = Module.thisProgram);
    var dynamicLibraries = Module.dynamicLibraries || [], wasmBinary = Module.wasmBinary;
    var wasmMemory, ABORT = false, EXITSTATUS;
    function assert(e, t) {
      e || abort(t);
    }
    var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAP64, HEAPF64;
    function updateMemoryViews() {
      var e = wasmMemory.buffer;
      Module.HEAP8 = HEAP8 = new Int8Array(e), Module.HEAP16 = HEAP16 = new Int16Array(e), Module.HEAPU8 = HEAPU8 = new Uint8Array(e), Module.HEAPU16 = HEAPU16 = new Uint16Array(e), Module.HEAP32 = HEAP32 = new Int32Array(e), Module.HEAPU32 = HEAPU32 = new Uint32Array(e), Module.HEAPF32 = HEAPF32 = new Float32Array(e), Module.HEAPF64 = HEAPF64 = new Float64Array(e), Module.HEAP64 = HEAP64 = new BigInt64Array(e), Module.HEAPU64 = new BigUint64Array(e);
    }
    if (Module.wasmMemory) wasmMemory = Module.wasmMemory;
    else {
      var INITIAL_MEMORY = Module.INITIAL_MEMORY || 134217728;
      wasmMemory = new WebAssembly.Memory({ initial: INITIAL_MEMORY / 65536, maximum: 32768 });
    }
    updateMemoryViews();
    var __ATPRERUN__ = [], __ATINIT__ = [], __ATMAIN__ = [], __ATPOSTRUN__ = [], __RELOC_FUNCS__ = [], runtimeInitialized = false;
    function preRun() {
      if (Module.preRun) for (typeof Module.preRun == "function" && (Module.preRun = [Module.preRun]); Module.preRun.length; ) addOnPreRun(Module.preRun.shift());
      callRuntimeCallbacks(__ATPRERUN__);
    }
    function initRuntime() {
      runtimeInitialized = true, callRuntimeCallbacks(__RELOC_FUNCS__), !Module.noFSInit && !FS.initialized && FS.init(), FS.ignorePermissions = false, SOCKFS.root = FS.mount(SOCKFS, {}, null), PIPEFS.root = FS.mount(PIPEFS, {}, null), callRuntimeCallbacks(__ATINIT__);
    }
    function preMain() {
      callRuntimeCallbacks(__ATMAIN__);
    }
    function postRun() {
      if (Module.postRun) for (typeof Module.postRun == "function" && (Module.postRun = [Module.postRun]); Module.postRun.length; ) addOnPostRun(Module.postRun.shift());
      callRuntimeCallbacks(__ATPOSTRUN__);
    }
    function addOnPreRun(e) {
      __ATPRERUN__.unshift(e);
    }
    function addOnInit(e) {
      __ATINIT__.unshift(e);
    }
    function addOnPostRun(e) {
      __ATPOSTRUN__.unshift(e);
    }
    var runDependencies = 0, dependenciesFulfilled = null;
    function addRunDependency(e) {
      runDependencies++, Module.monitorRunDependencies?.(runDependencies);
    }
    function removeRunDependency(e) {
      if (runDependencies--, Module.monitorRunDependencies?.(runDependencies), runDependencies == 0 && dependenciesFulfilled) {
        var t = dependenciesFulfilled;
        dependenciesFulfilled = null, t();
      }
    }
    function abort(e) {
      Module.onAbort?.(e), e = "Aborted(" + e + ")", err(e), ABORT = true, e += ". Build with -sASSERTIONS for more info.";
      var t = new WebAssembly.RuntimeError(e);
      throw readyPromiseReject(t), t;
    }
    var dataURIPrefix = "data:application/octet-stream;base64,", isDataURI = (e) => e.startsWith(dataURIPrefix), isFileURI = (e) => e.startsWith("file://");
    function findWasmBinary() {
      if (Module.locateFile) {
        var e = "postgres.wasm";
        return isDataURI(e) ? e : locateFile(e);
      }
      return new URL("postgres.wasm", import.meta.url).href;
    }
    var wasmBinaryFile;
    function getBinarySync(e) {
      if (e == wasmBinaryFile && wasmBinary) return new Uint8Array(wasmBinary);
      if (readBinary) return readBinary(e);
      throw "both async and sync fetching of the wasm failed";
    }
    async function getWasmBinary(e) {
      if (!wasmBinary) try {
        var t = await readAsync(e);
        return new Uint8Array(t);
      } catch {
      }
      return getBinarySync(e);
    }
    async function instantiateArrayBuffer(e, t) {
      try {
        var r2 = await getWasmBinary(e), a2 = await WebAssembly.instantiate(r2, t);
        return a2;
      } catch (o2) {
        err(`failed to asynchronously prepare wasm: ${o2}`), abort(o2);
      }
    }
    async function instantiateAsync(e, t, r2) {
      if (!e && typeof WebAssembly.instantiateStreaming == "function" && !isDataURI(t) && !ENVIRONMENT_IS_NODE && typeof fetch == "function") try {
        var a2 = fetch(t, { credentials: "same-origin" }), o2 = await WebAssembly.instantiateStreaming(a2, r2);
        return o2;
      } catch (s2) {
        err(`wasm streaming compile failed: ${s2}`), err("falling back to ArrayBuffer instantiation");
      }
      return instantiateArrayBuffer(t, r2);
    }
    function getWasmImports() {
      return { env: wasmImports, wasi_snapshot_preview1: wasmImports, "GOT.mem": new Proxy(wasmImports, GOTHandler), "GOT.func": new Proxy(wasmImports, GOTHandler) };
    }
    async function createWasm() {
      function e(o2, s2) {
        wasmExports = o2.exports, wasmExports = relocateExports(wasmExports, 16777216);
        var l2 = getDylinkMetadata(s2);
        return l2.neededDynlibs && (dynamicLibraries = l2.neededDynlibs.concat(dynamicLibraries)), mergeLibSymbols(wasmExports), LDSO.init(), loadDylibs(), addOnInit(wasmExports.__wasm_call_ctors), __RELOC_FUNCS__.push(wasmExports.__wasm_apply_data_relocs), removeRunDependency(), wasmExports;
      }
      addRunDependency();
      function t(o2) {
        e(o2.instance, o2.module);
      }
      var r2 = getWasmImports();
      if (Module.instantiateWasm) try {
        return Module.instantiateWasm(r2, e);
      } catch (o2) {
        err(`Module.instantiateWasm callback failed with error: ${o2}`), readyPromiseReject(o2);
      }
      wasmBinaryFile ?? (wasmBinaryFile = findWasmBinary());
      try {
        var a2 = await instantiateAsync(wasmBinary, wasmBinaryFile, r2);
        return t(a2), a2;
      } catch (o2) {
        readyPromiseReject(o2);
        return;
      }
    }
    var ASM_CONSTS = { 18792944: (e) => {
      Module.is_worker = typeof WorkerGlobalScope < "u" && self instanceof WorkerGlobalScope, Module.FD_BUFFER_MAX = e, Module.emscripten_copy_to = console.warn;
    }, 18793117: () => {
      Module.postMessage = function(t) {
        console.log("# 1252: onCustomMessage:", __FILE__, t);
      };
    }, 18793242: () => {
      if (Module.is_worker) {
        let t = function(r2) {
          console.log("onCustomMessage:", r2);
        };
        Module.onCustomMessage = t;
      } else Module.postMessage = function(r2) {
        switch (r2.type) {
          case "raw": {
            stringToUTF8(r2.data, shm_rawinput, Module.FD_BUFFER_MAX);
            break;
          }
          case "stdin": {
            stringToUTF8(r2.data, 1, Module.FD_BUFFER_MAX);
            break;
          }
          case "rcon": {
            stringToUTF8(r2.data, shm_rcon, Module.FD_BUFFER_MAX);
            break;
          }
          default:
            console.warn("custom_postMessage?", r2);
        }
      };
    } };
    function is_web_env() {
      try {
        if (window) return 1;
      } catch {
        return 0;
      }
    }
    is_web_env.sig = "i";
    class ExitStatus {
      constructor(t) {
        P$1(this, "name", "ExitStatus");
        this.message = `Program terminated with exit(${t})`, this.status = t;
      }
    }
    var GOT = {}, currentModuleWeakSymbols = /* @__PURE__ */ new Set([]), GOTHandler = { get(e, t) {
      var r2 = GOT[t];
      return r2 || (r2 = GOT[t] = new WebAssembly.Global({ value: "i32", mutable: true })), currentModuleWeakSymbols.has(t) || (r2.required = true), r2;
    } }, callRuntimeCallbacks = (e) => {
      for (; e.length > 0; ) e.shift()(Module);
    }, UTF8Decoder = typeof TextDecoder < "u" ? new TextDecoder() : void 0, UTF8ArrayToString = (e, t = 0, r2 = NaN) => {
      for (var a2 = t + r2, o2 = t; e[o2] && !(o2 >= a2); ) ++o2;
      if (o2 - t > 16 && e.buffer && UTF8Decoder) return UTF8Decoder.decode(e.subarray(t, o2));
      for (var s2 = ""; t < o2; ) {
        var l2 = e[t++];
        if (!(l2 & 128)) {
          s2 += String.fromCharCode(l2);
          continue;
        }
        var n2 = e[t++] & 63;
        if ((l2 & 224) == 192) {
          s2 += String.fromCharCode((l2 & 31) << 6 | n2);
          continue;
        }
        var _2 = e[t++] & 63;
        if ((l2 & 240) == 224 ? l2 = (l2 & 15) << 12 | n2 << 6 | _2 : l2 = (l2 & 7) << 18 | n2 << 12 | _2 << 6 | e[t++] & 63, l2 < 65536) s2 += String.fromCharCode(l2);
        else {
          var m2 = l2 - 65536;
          s2 += String.fromCharCode(55296 | m2 >> 10, 56320 | m2 & 1023);
        }
      }
      return s2;
    }, getDylinkMetadata = (e) => {
      var t = 0, r2 = 0;
      function a2() {
        return e[t++];
      }
      function o2() {
        for (var P2 = 0, U2 = 1; ; ) {
          var A2 = e[t++];
          if (P2 += (A2 & 127) * U2, U2 *= 128, !(A2 & 128)) break;
        }
        return P2;
      }
      function s2() {
        var P2 = o2();
        return t += P2, UTF8ArrayToString(e, t - P2, P2);
      }
      function l2(P2, U2) {
        if (P2) throw new Error(U2);
      }
      var n2 = "dylink.0";
      if (e instanceof WebAssembly.Module) {
        var _2 = WebAssembly.Module.customSections(e, n2);
        _2.length === 0 && (n2 = "dylink", _2 = WebAssembly.Module.customSections(e, n2)), l2(_2.length === 0, "need dylink section"), e = new Uint8Array(_2[0]), r2 = e.length;
      } else {
        var m2 = new Uint32Array(new Uint8Array(e.subarray(0, 24)).buffer), p2 = m2[0] == 1836278016;
        l2(!p2, "need to see wasm magic number"), l2(e[8] !== 0, "need the dylink section to be first"), t = 9;
        var d2 = o2();
        r2 = t + d2, n2 = s2();
      }
      var g2 = { neededDynlibs: [], tlsExports: /* @__PURE__ */ new Set(), weakImports: /* @__PURE__ */ new Set() };
      if (n2 == "dylink") {
        g2.memorySize = o2(), g2.memoryAlign = o2(), g2.tableSize = o2(), g2.tableAlign = o2();
        for (var c2 = o2(), f2 = 0; f2 < c2; ++f2) {
          var u2 = s2();
          g2.neededDynlibs.push(u2);
        }
      } else {
        l2(n2 !== "dylink.0");
        for (var w2 = 1, h2 = 2, S2 = 3, M2 = 4, y2 = 256, x2 = 3, E2 = 1; t < r2; ) {
          var b2 = a2(), T2 = o2();
          if (b2 === w2) g2.memorySize = o2(), g2.memoryAlign = o2(), g2.tableSize = o2(), g2.tableAlign = o2();
          else if (b2 === h2) for (var c2 = o2(), f2 = 0; f2 < c2; ++f2) u2 = s2(), g2.neededDynlibs.push(u2);
          else if (b2 === S2) for (var D2 = o2(); D2--; ) {
            var X2 = s2(), R3 = o2();
            R3 & y2 && g2.tlsExports.add(X2);
          }
          else if (b2 === M2) for (var D2 = o2(); D2--; ) {
            s2();
            var X2 = s2(), R3 = o2();
            (R3 & x2) == E2 && g2.weakImports.add(X2);
          }
          else t += T2;
        }
      }
      return g2;
    };
    function getValue(e, t = "i8") {
      switch (t.endsWith("*") && (t = "*"), t) {
        case "i1":
          return HEAP8[e];
        case "i8":
          return HEAP8[e];
        case "i16":
          return HEAP16[e >> 1];
        case "i32":
          return HEAP32[e >> 2];
        case "i64":
          return HEAP64[e >> 3];
        case "float":
          return HEAPF32[e >> 2];
        case "double":
          return HEAPF64[e >> 3];
        case "*":
          return HEAPU32[e >> 2];
        default:
          abort(`invalid type for getValue: ${t}`);
      }
    }
    var newDSO = (e, t, r2) => {
      var a2 = { refcount: 1 / 0, name: e, exports: r2, global: true };
      return LDSO.loadedLibsByName[e] = a2, t != null && (LDSO.loadedLibsByHandle[t] = a2), a2;
    }, LDSO = { loadedLibsByName: {}, loadedLibsByHandle: {}, init() {
      newDSO("__main__", 0, wasmImports);
    } }, ___heap_base = 23144432, alignMemory = (e, t) => Math.ceil(e / t) * t, getMemory = (e) => {
      if (runtimeInitialized) return _calloc(e, 1);
      var t = ___heap_base, r2 = t + alignMemory(e, 16);
      return ___heap_base = r2, GOT.__heap_base.value = r2, t;
    }, isInternalSym = (e) => ["__cpp_exception", "__c_longjmp", "__wasm_apply_data_relocs", "__dso_handle", "__tls_size", "__tls_align", "__set_stack_limits", "_emscripten_tls_init", "__wasm_init_tls", "__wasm_call_ctors", "__start_em_asm", "__stop_em_asm", "__start_em_js", "__stop_em_js"].includes(e) || e.startsWith("__em_js__"), uleb128Encode = (e, t) => {
      e < 128 ? t.push(e) : t.push(e % 128 | 128, e >> 7);
    }, sigToWasmTypes = (e) => {
      for (var t = { i: "i32", j: "i64", f: "f32", d: "f64", e: "externref", p: "i32" }, r2 = { parameters: [], results: e[0] == "v" ? [] : [t[e[0]]] }, a2 = 1; a2 < e.length; ++a2) r2.parameters.push(t[e[a2]]);
      return r2;
    }, generateFuncType = (e, t) => {
      var r2 = e.slice(0, 1), a2 = e.slice(1), o2 = { i: 127, p: 127, j: 126, f: 125, d: 124, e: 111 };
      t.push(96), uleb128Encode(a2.length, t);
      for (var s2 = 0; s2 < a2.length; ++s2) t.push(o2[a2[s2]]);
      r2 == "v" ? t.push(0) : t.push(1, o2[r2]);
    }, convertJsFunctionToWasm = (e, t) => {
      if (typeof WebAssembly.Function == "function") return new WebAssembly.Function(sigToWasmTypes(t), e);
      var r2 = [1];
      generateFuncType(t, r2);
      var a2 = [0, 97, 115, 109, 1, 0, 0, 0, 1];
      uleb128Encode(r2.length, a2), a2.push(...r2), a2.push(2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0);
      var o2 = new WebAssembly.Module(new Uint8Array(a2)), s2 = new WebAssembly.Instance(o2, { e: { f: e } }), l2 = s2.exports.f;
      return l2;
    }, wasmTableMirror = [], wasmTable = new WebAssembly.Table({ initial: 5360, element: "anyfunc" }), getWasmTableEntry = (e) => {
      var t = wasmTableMirror[e];
      return t || (e >= wasmTableMirror.length && (wasmTableMirror.length = e + 1), wasmTableMirror[e] = t = wasmTable.get(e)), t;
    }, updateTableMap = (e, t) => {
      if (functionsInTableMap) for (var r2 = e; r2 < e + t; r2++) {
        var a2 = getWasmTableEntry(r2);
        a2 && functionsInTableMap.set(a2, r2);
      }
    }, functionsInTableMap, getFunctionAddress = (e) => (functionsInTableMap || (functionsInTableMap = /* @__PURE__ */ new WeakMap(), updateTableMap(0, wasmTable.length)), functionsInTableMap.get(e) || 0), freeTableIndexes = [], getEmptyTableSlot = () => {
      if (freeTableIndexes.length) return freeTableIndexes.pop();
      try {
        wasmTable.grow(1);
      } catch (e) {
        throw e instanceof RangeError ? "Unable to grow wasm table. Set ALLOW_TABLE_GROWTH." : e;
      }
      return wasmTable.length - 1;
    }, setWasmTableEntry = (e, t) => {
      wasmTable.set(e, t), wasmTableMirror[e] = wasmTable.get(e);
    }, addFunction = (e, t) => {
      var r2 = getFunctionAddress(e);
      if (r2) return r2;
      var a2 = getEmptyTableSlot();
      try {
        setWasmTableEntry(a2, e);
      } catch (s2) {
        if (!(s2 instanceof TypeError)) throw s2;
        var o2 = convertJsFunctionToWasm(e, t);
        setWasmTableEntry(a2, o2);
      }
      return functionsInTableMap.set(e, a2), a2;
    }, updateGOT = (e, t) => {
      for (var r2 in e) if (!isInternalSym(r2)) {
        var a2 = e[r2];
        GOT[r2] || (GOT[r2] = new WebAssembly.Global({ value: "i32", mutable: true })), GOT[r2].value == 0 && (typeof a2 == "function" ? GOT[r2].value = addFunction(a2) : typeof a2 == "number" ? GOT[r2].value = a2 : err(`unhandled export type for '${r2}': ${typeof a2}`));
      }
    }, relocateExports = (e, t, r2) => {
      var a2 = {};
      for (var o2 in e) {
        var s2 = e[o2];
        typeof s2 == "object" && (s2 = s2.value), typeof s2 == "number" && (s2 += t), a2[o2] = s2;
      }
      return updateGOT(a2), a2;
    }, isSymbolDefined = (e) => {
      var t = wasmImports[e];
      return !(!t || t.stub);
    }, dynCall = (e, t, r2 = []) => {
      var a2 = getWasmTableEntry(t)(...r2);
      return a2;
    }, stackSave = () => _emscripten_stack_get_current(), stackRestore = (e) => __emscripten_stack_restore(e), createInvokeFunction = (e) => (t, ...r2) => {
      var a2 = stackSave();
      try {
        return dynCall(e, t, r2);
      } catch (o2) {
        if (stackRestore(a2), o2 !== o2 + 0) throw o2;
        if (_setThrew(1, 0), e[0] == "j") return 0n;
      }
    }, resolveGlobalSymbol = (e, t = false) => {
      var r2;
      return isSymbolDefined(e) ? r2 = wasmImports[e] : e.startsWith("invoke_") && (r2 = wasmImports[e] = createInvokeFunction(e.split("_")[1])), { sym: r2, name: e };
    }, UTF8ToString = (e, t) => e ? UTF8ArrayToString(HEAPU8, e, t) : "", loadWebAssemblyModule = (binary, flags, libName, localScope, handle) => {
      var metadata = getDylinkMetadata(binary);
      currentModuleWeakSymbols = metadata.weakImports;
      function loadModule() {
        var firstLoad = !handle || !HEAP8[handle + 8];
        if (firstLoad) {
          var memAlign = Math.pow(2, metadata.memoryAlign), memoryBase = metadata.memorySize ? alignMemory(getMemory(metadata.memorySize + memAlign), memAlign) : 0, tableBase = metadata.tableSize ? wasmTable.length : 0;
          handle && (HEAP8[handle + 8] = 1, HEAPU32[handle + 12 >> 2] = memoryBase, HEAP32[handle + 16 >> 2] = metadata.memorySize, HEAPU32[handle + 20 >> 2] = tableBase, HEAP32[handle + 24 >> 2] = metadata.tableSize);
        } else memoryBase = HEAPU32[handle + 12 >> 2], tableBase = HEAPU32[handle + 20 >> 2];
        var tableGrowthNeeded = tableBase + metadata.tableSize - wasmTable.length;
        tableGrowthNeeded > 0 && wasmTable.grow(tableGrowthNeeded);
        var moduleExports;
        function resolveSymbol(e) {
          var t = resolveGlobalSymbol(e).sym;
          return !t && localScope && (t = localScope[e]), t || (t = moduleExports[e]), t;
        }
        var proxyHandler = { get(e, t) {
          switch (t) {
            case "__memory_base":
              return memoryBase;
            case "__table_base":
              return tableBase;
          }
          if (t in wasmImports && !wasmImports[t].stub) return wasmImports[t];
          if (!(t in e)) {
            var r2;
            e[t] = (...a2) => (r2 || (r2 = resolveSymbol(t)), r2(...a2));
          }
          return e[t];
        } }, proxy = new Proxy({}, proxyHandler), info = { "GOT.mem": new Proxy({}, GOTHandler), "GOT.func": new Proxy({}, GOTHandler), env: proxy, wasi_snapshot_preview1: proxy };
        function postInstantiation(module, instance) {
          updateTableMap(tableBase, metadata.tableSize), moduleExports = relocateExports(instance.exports, memoryBase), flags.allowUndefined || reportUndefinedSymbols();
          function addEmAsm(addr, body) {
            for (var args = [], arity = 0; arity < 16 && body.indexOf("$" + arity) != -1; arity++) args.push("$" + arity);
            args = args.join(",");
            var func = `(${args}) => { ${body} };`;
            ASM_CONSTS[start] = eval(func);
          }
          if ("__start_em_asm" in moduleExports) for (var start = moduleExports.__start_em_asm, stop = moduleExports.__stop_em_asm; start < stop; ) {
            var jsString = UTF8ToString(start);
            addEmAsm(start, jsString), start = HEAPU8.indexOf(0, start) + 1;
          }
          function addEmJs(name, cSig, body) {
            var jsArgs = [];
            if (cSig = cSig.slice(1, -1), cSig != "void") {
              cSig = cSig.split(",");
              for (var i in cSig) {
                var jsArg = cSig[i].split(" ").pop();
                jsArgs.push(jsArg.replaceAll("*", ""));
              }
            }
            var func = `(${jsArgs}) => ${body};`;
            moduleExports[name] = eval(func);
          }
          for (var name in moduleExports) if (name.startsWith("__em_js__")) {
            var start = moduleExports[name], jsString = UTF8ToString(start), parts = jsString.split("<::>");
            addEmJs(name.replace("__em_js__", ""), parts[0], parts[1]), delete moduleExports[name];
          }
          var applyRelocs = moduleExports.__wasm_apply_data_relocs;
          applyRelocs && (runtimeInitialized ? applyRelocs() : __RELOC_FUNCS__.push(applyRelocs));
          var init = moduleExports.__wasm_call_ctors;
          return init && (runtimeInitialized ? init() : __ATINIT__.push(init)), moduleExports;
        }
        if (flags.loadAsync) {
          if (binary instanceof WebAssembly.Module) {
            var instance = new WebAssembly.Instance(binary, info);
            return Promise.resolve(postInstantiation(binary, instance));
          }
          return WebAssembly.instantiate(binary, info).then((e) => postInstantiation(e.module, e.instance));
        }
        var module = binary instanceof WebAssembly.Module ? binary : new WebAssembly.Module(binary), instance = new WebAssembly.Instance(module, info);
        return postInstantiation(module, instance);
      }
      return flags.loadAsync ? metadata.neededDynlibs.reduce((e, t) => e.then(() => loadDynamicLibrary(t, flags, localScope)), Promise.resolve()).then(loadModule) : (metadata.neededDynlibs.forEach((e) => loadDynamicLibrary(e, flags, localScope)), loadModule());
    }, mergeLibSymbols = (e, t) => {
      for (var [r2, a2] of Object.entries(e)) {
        let o2 = (l2) => {
          isSymbolDefined(l2) || (wasmImports[l2] = a2);
        };
        o2(r2);
        let s2 = "__main_argc_argv";
        r2 == "main" && o2(s2), r2 == s2 && o2("main");
      }
    }, asyncLoad = async (e) => {
      var t = await readAsync(e);
      return new Uint8Array(t);
    }, preloadPlugins = Module.preloadPlugins || [], registerWasmPlugin = () => {
      var e = { promiseChainEnd: Promise.resolve(), canHandle: (t) => !Module.noWasmDecoding && t.endsWith(".so"), handle: (t, r2, a2, o2) => {
        e.promiseChainEnd = e.promiseChainEnd.then(() => loadWebAssemblyModule(t, { loadAsync: true, nodelete: true }, r2, {})).then((s2) => {
          preloadedWasm[r2] = s2, a2(t);
        }, (s2) => {
          err(`failed to instantiate wasm: ${r2}: ${s2}`), o2();
        });
      } };
      preloadPlugins.push(e);
    }, preloadedWasm = {};
    function loadDynamicLibrary(e, t = { global: true, nodelete: true }, r2, a2) {
      var o2 = LDSO.loadedLibsByName[e];
      if (o2) return t.global ? o2.global || (o2.global = true, mergeLibSymbols(o2.exports)) : r2 && Object.assign(r2, o2.exports), t.nodelete && o2.refcount !== 1 / 0 && (o2.refcount = 1 / 0), o2.refcount++, a2 && (LDSO.loadedLibsByHandle[a2] = o2), t.loadAsync ? Promise.resolve(true) : true;
      o2 = newDSO(e, a2, "loading"), o2.refcount = t.nodelete ? 1 / 0 : 1, o2.global = t.global;
      function s2() {
        if (a2) {
          var _2 = HEAPU32[a2 + 28 >> 2], m2 = HEAPU32[a2 + 32 >> 2];
          if (_2 && m2) {
            var p2 = HEAP8.slice(_2, _2 + m2);
            return t.loadAsync ? Promise.resolve(p2) : p2;
          }
        }
        var d2 = locateFile(e);
        if (t.loadAsync) return asyncLoad(d2);
        if (!readBinary) throw new Error(`${d2}: file not found, and synchronous loading of external files is not available`);
        return readBinary(d2);
      }
      function l2() {
        var _2 = preloadedWasm[e];
        return _2 ? t.loadAsync ? Promise.resolve(_2) : _2 : t.loadAsync ? s2().then((m2) => loadWebAssemblyModule(m2, t, e, r2, a2)) : loadWebAssemblyModule(s2(), t, e, r2, a2);
      }
      function n2(_2) {
        o2.global ? mergeLibSymbols(_2) : r2 && Object.assign(r2, _2), o2.exports = _2;
      }
      return t.loadAsync ? l2().then((_2) => (n2(_2), true)) : (n2(l2()), true);
    }
    var reportUndefinedSymbols = () => {
      for (var [e, t] of Object.entries(GOT)) if (t.value == 0) {
        var r2 = resolveGlobalSymbol(e, true).sym;
        if (!r2 && !t.required) continue;
        if (typeof r2 == "function") t.value = addFunction(r2, r2.sig);
        else if (typeof r2 == "number") t.value = r2;
        else throw new Error(`bad export type for '${e}': ${typeof r2}`);
      }
    }, loadDylibs = () => {
      if (!dynamicLibraries.length) {
        reportUndefinedSymbols();
        return;
      }
      addRunDependency(), dynamicLibraries.reduce((e, t) => e.then(() => loadDynamicLibrary(t, { loadAsync: true, global: true, nodelete: true, allowUndefined: true })), Promise.resolve()).then(() => {
        reportUndefinedSymbols(), removeRunDependency();
      });
    }, noExitRuntime = Module.noExitRuntime || true;
    function setValue(e, t, r2 = "i8") {
      switch (r2.endsWith("*") && (r2 = "*"), r2) {
        case "i1":
          HEAP8[e] = t;
          break;
        case "i8":
          HEAP8[e] = t;
          break;
        case "i16":
          HEAP16[e >> 1] = t;
          break;
        case "i32":
          HEAP32[e >> 2] = t;
          break;
        case "i64":
          HEAP64[e >> 3] = BigInt(t);
          break;
        case "float":
          HEAPF32[e >> 2] = t;
          break;
        case "double":
          HEAPF64[e >> 3] = t;
          break;
        case "*":
          HEAPU32[e >> 2] = t;
          break;
        default:
          abort(`invalid type for setValue: ${r2}`);
      }
    }
    var ___assert_fail = (e, t, r2, a2) => abort(`Assertion failed: ${UTF8ToString(e)}, at: ` + [t ? UTF8ToString(t) : "unknown filename", r2, a2 ? UTF8ToString(a2) : "unknown function"]);
    ___assert_fail.sig = "vppip";
    var ___call_sighandler = (e, t) => getWasmTableEntry(e)(t);
    ___call_sighandler.sig = "vpi";
    var ___memory_base = new WebAssembly.Global({ value: "i32", mutable: false }, 16777216), ___stack_pointer = new WebAssembly.Global({ value: "i32", mutable: true }, 23144432), PATH = { isAbs: (e) => e.charAt(0) === "/", splitPath: (e) => {
      var t = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
      return t.exec(e).slice(1);
    }, normalizeArray: (e, t) => {
      for (var r2 = 0, a2 = e.length - 1; a2 >= 0; a2--) {
        var o2 = e[a2];
        o2 === "." ? e.splice(a2, 1) : o2 === ".." ? (e.splice(a2, 1), r2++) : r2 && (e.splice(a2, 1), r2--);
      }
      if (t) for (; r2; r2--) e.unshift("..");
      return e;
    }, normalize: (e) => {
      var t = PATH.isAbs(e), r2 = e.substr(-1) === "/";
      return e = PATH.normalizeArray(e.split("/").filter((a2) => !!a2), !t).join("/"), !e && !t && (e = "."), e && r2 && (e += "/"), (t ? "/" : "") + e;
    }, dirname: (e) => {
      var t = PATH.splitPath(e), r2 = t[0], a2 = t[1];
      return !r2 && !a2 ? "." : (a2 && (a2 = a2.substr(0, a2.length - 1)), r2 + a2);
    }, basename: (e) => {
      if (e === "/") return "/";
      e = PATH.normalize(e), e = e.replace(/\/$/, "");
      var t = e.lastIndexOf("/");
      return t === -1 ? e : e.substr(t + 1);
    }, join: (...e) => PATH.normalize(e.join("/")), join2: (e, t) => PATH.normalize(e + "/" + t) }, initRandomFill = () => {
      if (typeof crypto == "object" && typeof crypto.getRandomValues == "function") return (a2) => crypto.getRandomValues(a2);
      if (ENVIRONMENT_IS_NODE) try {
        var e = require("crypto"), t = e.randomFillSync;
        if (t) return (a2) => e.randomFillSync(a2);
        var r2 = e.randomBytes;
        return (a2) => (a2.set(r2(a2.byteLength)), a2);
      } catch {
      }
      abort("initRandomDevice");
    }, randomFill = (e) => (randomFill = initRandomFill())(e), PATH_FS = { resolve: (...e) => {
      for (var t = "", r2 = false, a2 = e.length - 1; a2 >= -1 && !r2; a2--) {
        var o2 = a2 >= 0 ? e[a2] : FS.cwd();
        if (typeof o2 != "string") throw new TypeError("Arguments to path.resolve must be strings");
        if (!o2) return "";
        t = o2 + "/" + t, r2 = PATH.isAbs(o2);
      }
      return t = PATH.normalizeArray(t.split("/").filter((s2) => !!s2), !r2).join("/"), (r2 ? "/" : "") + t || ".";
    }, relative: (e, t) => {
      e = PATH_FS.resolve(e).substr(1), t = PATH_FS.resolve(t).substr(1);
      function r2(m2) {
        for (var p2 = 0; p2 < m2.length && m2[p2] === ""; p2++) ;
        for (var d2 = m2.length - 1; d2 >= 0 && m2[d2] === ""; d2--) ;
        return p2 > d2 ? [] : m2.slice(p2, d2 - p2 + 1);
      }
      for (var a2 = r2(e.split("/")), o2 = r2(t.split("/")), s2 = Math.min(a2.length, o2.length), l2 = s2, n2 = 0; n2 < s2; n2++) if (a2[n2] !== o2[n2]) {
        l2 = n2;
        break;
      }
      for (var _2 = [], n2 = l2; n2 < a2.length; n2++) _2.push("..");
      return _2 = _2.concat(o2.slice(l2)), _2.join("/");
    } }, FS_stdin_getChar_buffer = [], lengthBytesUTF8 = (e) => {
      for (var t = 0, r2 = 0; r2 < e.length; ++r2) {
        var a2 = e.charCodeAt(r2);
        a2 <= 127 ? t++ : a2 <= 2047 ? t += 2 : a2 >= 55296 && a2 <= 57343 ? (t += 4, ++r2) : t += 3;
      }
      return t;
    }, stringToUTF8Array = (e, t, r2, a2) => {
      if (!(a2 > 0)) return 0;
      for (var o2 = r2, s2 = r2 + a2 - 1, l2 = 0; l2 < e.length; ++l2) {
        var n2 = e.charCodeAt(l2);
        if (n2 >= 55296 && n2 <= 57343) {
          var _2 = e.charCodeAt(++l2);
          n2 = 65536 + ((n2 & 1023) << 10) | _2 & 1023;
        }
        if (n2 <= 127) {
          if (r2 >= s2) break;
          t[r2++] = n2;
        } else if (n2 <= 2047) {
          if (r2 + 1 >= s2) break;
          t[r2++] = 192 | n2 >> 6, t[r2++] = 128 | n2 & 63;
        } else if (n2 <= 65535) {
          if (r2 + 2 >= s2) break;
          t[r2++] = 224 | n2 >> 12, t[r2++] = 128 | n2 >> 6 & 63, t[r2++] = 128 | n2 & 63;
        } else {
          if (r2 + 3 >= s2) break;
          t[r2++] = 240 | n2 >> 18, t[r2++] = 128 | n2 >> 12 & 63, t[r2++] = 128 | n2 >> 6 & 63, t[r2++] = 128 | n2 & 63;
        }
      }
      return t[r2] = 0, r2 - o2;
    };
    function intArrayFromString(e, t, r2) {
      var a2 = lengthBytesUTF8(e) + 1, o2 = new Array(a2), s2 = stringToUTF8Array(e, o2, 0, o2.length);
      return o2.length = s2, o2;
    }
    var FS_stdin_getChar = () => {
      if (!FS_stdin_getChar_buffer.length) {
        var e = null;
        if (ENVIRONMENT_IS_NODE) {
          var t = 256, r2 = Buffer.alloc(t), a2 = 0, o2 = process.stdin.fd;
          try {
            a2 = fs.readSync(o2, r2, 0, t);
          } catch (s2) {
            if (s2.toString().includes("EOF")) a2 = 0;
            else throw s2;
          }
          a2 > 0 && (e = r2.slice(0, a2).toString("utf-8"));
        } else typeof window < "u" && typeof window.prompt == "function" && (e = window.prompt("Input: "), e !== null && (e += `
`));
        if (!e) return null;
        FS_stdin_getChar_buffer = intArrayFromString(e);
      }
      return FS_stdin_getChar_buffer.shift();
    }, TTY = { ttys: [], init() {
    }, shutdown() {
    }, register(e, t) {
      TTY.ttys[e] = { input: [], output: [], ops: t }, FS.registerDevice(e, TTY.stream_ops);
    }, stream_ops: { open(e) {
      var t = TTY.ttys[e.node.rdev];
      if (!t) throw new FS.ErrnoError(43);
      e.tty = t, e.seekable = false;
    }, close(e) {
      e.tty.ops.fsync(e.tty);
    }, fsync(e) {
      e.tty.ops.fsync(e.tty);
    }, read(e, t, r2, a2, o2) {
      if (!e.tty || !e.tty.ops.get_char) throw new FS.ErrnoError(60);
      for (var s2 = 0, l2 = 0; l2 < a2; l2++) {
        var n2;
        try {
          n2 = e.tty.ops.get_char(e.tty);
        } catch {
          throw new FS.ErrnoError(29);
        }
        if (n2 === void 0 && s2 === 0) throw new FS.ErrnoError(6);
        if (n2 == null) break;
        s2++, t[r2 + l2] = n2;
      }
      return s2 && (e.node.atime = Date.now()), s2;
    }, write(e, t, r2, a2, o2) {
      if (!e.tty || !e.tty.ops.put_char) throw new FS.ErrnoError(60);
      try {
        for (var s2 = 0; s2 < a2; s2++) e.tty.ops.put_char(e.tty, t[r2 + s2]);
      } catch {
        throw new FS.ErrnoError(29);
      }
      return a2 && (e.node.mtime = e.node.ctime = Date.now()), s2;
    } }, default_tty_ops: { get_char(e) {
      return FS_stdin_getChar();
    }, put_char(e, t) {
      t === null || t === 10 ? (out(UTF8ArrayToString(e.output)), e.output = []) : t != 0 && e.output.push(t);
    }, fsync(e) {
      e.output && e.output.length > 0 && (out(UTF8ArrayToString(e.output)), e.output = []);
    }, ioctl_tcgets(e) {
      return { c_iflag: 25856, c_oflag: 5, c_cflag: 191, c_lflag: 35387, c_cc: [3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
    }, ioctl_tcsets(e, t, r2) {
      return 0;
    }, ioctl_tiocgwinsz(e) {
      return [24, 80];
    } }, default_tty1_ops: { put_char(e, t) {
      t === null || t === 10 ? (err(UTF8ArrayToString(e.output)), e.output = []) : t != 0 && e.output.push(t);
    }, fsync(e) {
      e.output && e.output.length > 0 && (err(UTF8ArrayToString(e.output)), e.output = []);
    } } }, zeroMemory = (e, t) => {
      HEAPU8.fill(0, e, e + t);
    }, mmapAlloc = (e) => {
      e = alignMemory(e, 65536);
      var t = _emscripten_builtin_memalign(65536, e);
      return t && zeroMemory(t, e), t;
    }, MEMFS = { ops_table: null, mount(e) {
      return MEMFS.createNode(null, "/", 16895, 0);
    }, createNode(e, t, r2, a2) {
      if (FS.isBlkdev(r2) || FS.isFIFO(r2)) throw new FS.ErrnoError(63);
      MEMFS.ops_table || (MEMFS.ops_table = { dir: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr, lookup: MEMFS.node_ops.lookup, mknod: MEMFS.node_ops.mknod, rename: MEMFS.node_ops.rename, unlink: MEMFS.node_ops.unlink, rmdir: MEMFS.node_ops.rmdir, readdir: MEMFS.node_ops.readdir, symlink: MEMFS.node_ops.symlink }, stream: { llseek: MEMFS.stream_ops.llseek } }, file: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr }, stream: { llseek: MEMFS.stream_ops.llseek, read: MEMFS.stream_ops.read, write: MEMFS.stream_ops.write, allocate: MEMFS.stream_ops.allocate, mmap: MEMFS.stream_ops.mmap, msync: MEMFS.stream_ops.msync } }, link: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr, readlink: MEMFS.node_ops.readlink }, stream: {} }, chrdev: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr }, stream: FS.chrdev_stream_ops } });
      var o2 = FS.createNode(e, t, r2, a2);
      return FS.isDir(o2.mode) ? (o2.node_ops = MEMFS.ops_table.dir.node, o2.stream_ops = MEMFS.ops_table.dir.stream, o2.contents = {}) : FS.isFile(o2.mode) ? (o2.node_ops = MEMFS.ops_table.file.node, o2.stream_ops = MEMFS.ops_table.file.stream, o2.usedBytes = 0, o2.contents = null) : FS.isLink(o2.mode) ? (o2.node_ops = MEMFS.ops_table.link.node, o2.stream_ops = MEMFS.ops_table.link.stream) : FS.isChrdev(o2.mode) && (o2.node_ops = MEMFS.ops_table.chrdev.node, o2.stream_ops = MEMFS.ops_table.chrdev.stream), o2.atime = o2.mtime = o2.ctime = Date.now(), e && (e.contents[t] = o2, e.atime = e.mtime = e.ctime = o2.atime), o2;
    }, getFileDataAsTypedArray(e) {
      return e.contents ? e.contents.subarray ? e.contents.subarray(0, e.usedBytes) : new Uint8Array(e.contents) : new Uint8Array(0);
    }, expandFileStorage(e, t) {
      var r2 = e.contents ? e.contents.length : 0;
      if (!(r2 >= t)) {
        var a2 = 1024 * 1024;
        t = Math.max(t, r2 * (r2 < a2 ? 2 : 1.125) >>> 0), r2 != 0 && (t = Math.max(t, 256));
        var o2 = e.contents;
        e.contents = new Uint8Array(t), e.usedBytes > 0 && e.contents.set(o2.subarray(0, e.usedBytes), 0);
      }
    }, resizeFileStorage(e, t) {
      if (e.usedBytes != t) if (t == 0) e.contents = null, e.usedBytes = 0;
      else {
        var r2 = e.contents;
        e.contents = new Uint8Array(t), r2 && e.contents.set(r2.subarray(0, Math.min(t, e.usedBytes))), e.usedBytes = t;
      }
    }, node_ops: { getattr(e) {
      var t = {};
      return t.dev = FS.isChrdev(e.mode) ? e.id : 1, t.ino = e.id, t.mode = e.mode, t.nlink = 1, t.uid = 0, t.gid = 0, t.rdev = e.rdev, FS.isDir(e.mode) ? t.size = 4096 : FS.isFile(e.mode) ? t.size = e.usedBytes : FS.isLink(e.mode) ? t.size = e.link.length : t.size = 0, t.atime = new Date(e.atime), t.mtime = new Date(e.mtime), t.ctime = new Date(e.ctime), t.blksize = 4096, t.blocks = Math.ceil(t.size / t.blksize), t;
    }, setattr(e, t) {
      for (let r2 of ["mode", "atime", "mtime", "ctime"]) t[r2] && (e[r2] = t[r2]);
      t.size !== void 0 && MEMFS.resizeFileStorage(e, t.size);
    }, lookup(e, t) {
      throw MEMFS.doesNotExistError;
    }, mknod(e, t, r2, a2) {
      return MEMFS.createNode(e, t, r2, a2);
    }, rename(e, t, r2) {
      var a2;
      try {
        a2 = FS.lookupNode(t, r2);
      } catch {
      }
      if (a2) {
        if (FS.isDir(e.mode)) for (var o2 in a2.contents) throw new FS.ErrnoError(55);
        FS.hashRemoveNode(a2);
      }
      delete e.parent.contents[e.name], t.contents[r2] = e, e.name = r2, t.ctime = t.mtime = e.parent.ctime = e.parent.mtime = Date.now();
    }, unlink(e, t) {
      delete e.contents[t], e.ctime = e.mtime = Date.now();
    }, rmdir(e, t) {
      var r2 = FS.lookupNode(e, t);
      for (var a2 in r2.contents) throw new FS.ErrnoError(55);
      delete e.contents[t], e.ctime = e.mtime = Date.now();
    }, readdir(e) {
      return [".", "..", ...Object.keys(e.contents)];
    }, symlink(e, t, r2) {
      var a2 = MEMFS.createNode(e, t, 41471, 0);
      return a2.link = r2, a2;
    }, readlink(e) {
      if (!FS.isLink(e.mode)) throw new FS.ErrnoError(28);
      return e.link;
    } }, stream_ops: { read(e, t, r2, a2, o2) {
      var s2 = e.node.contents;
      if (o2 >= e.node.usedBytes) return 0;
      var l2 = Math.min(e.node.usedBytes - o2, a2);
      if (l2 > 8 && s2.subarray) t.set(s2.subarray(o2, o2 + l2), r2);
      else for (var n2 = 0; n2 < l2; n2++) t[r2 + n2] = s2[o2 + n2];
      return l2;
    }, write(e, t, r2, a2, o2, s2) {
      if (t.buffer === HEAP8.buffer && (s2 = false), !a2) return 0;
      var l2 = e.node;
      if (l2.mtime = l2.ctime = Date.now(), t.subarray && (!l2.contents || l2.contents.subarray)) {
        if (s2) return l2.contents = t.subarray(r2, r2 + a2), l2.usedBytes = a2, a2;
        if (l2.usedBytes === 0 && o2 === 0) return l2.contents = t.slice(r2, r2 + a2), l2.usedBytes = a2, a2;
        if (o2 + a2 <= l2.usedBytes) return l2.contents.set(t.subarray(r2, r2 + a2), o2), a2;
      }
      if (MEMFS.expandFileStorage(l2, o2 + a2), l2.contents.subarray && t.subarray) l2.contents.set(t.subarray(r2, r2 + a2), o2);
      else for (var n2 = 0; n2 < a2; n2++) l2.contents[o2 + n2] = t[r2 + n2];
      return l2.usedBytes = Math.max(l2.usedBytes, o2 + a2), a2;
    }, llseek(e, t, r2) {
      var a2 = t;
      if (r2 === 1 ? a2 += e.position : r2 === 2 && FS.isFile(e.node.mode) && (a2 += e.node.usedBytes), a2 < 0) throw new FS.ErrnoError(28);
      return a2;
    }, allocate(e, t, r2) {
      MEMFS.expandFileStorage(e.node, t + r2), e.node.usedBytes = Math.max(e.node.usedBytes, t + r2);
    }, mmap(e, t, r2, a2, o2) {
      if (!FS.isFile(e.node.mode)) throw new FS.ErrnoError(43);
      var s2, l2, n2 = e.node.contents;
      if (!(o2 & 2) && n2 && n2.buffer === HEAP8.buffer) l2 = false, s2 = n2.byteOffset;
      else {
        if (l2 = true, s2 = mmapAlloc(t), !s2) throw new FS.ErrnoError(48);
        n2 && ((r2 > 0 || r2 + t < n2.length) && (n2.subarray ? n2 = n2.subarray(r2, r2 + t) : n2 = Array.prototype.slice.call(n2, r2, r2 + t)), HEAP8.set(n2, s2));
      }
      return { ptr: s2, allocated: l2 };
    }, msync(e, t, r2, a2, o2) {
      return MEMFS.stream_ops.write(e, t, 0, a2, r2, false), 0;
    } } }, FS_createDataFile = (e, t, r2, a2, o2, s2) => {
      FS.createDataFile(e, t, r2, a2, o2, s2);
    }, FS_handledByPreloadPlugin = (e, t, r2, a2) => {
      typeof Browser < "u" && Browser.init();
      var o2 = false;
      return preloadPlugins.forEach((s2) => {
        o2 || s2.canHandle(t) && (s2.handle(e, t, r2, a2), o2 = true);
      }), o2;
    }, FS_createPreloadedFile = (e, t, r2, a2, o2, s2, l2, n2, _2, m2) => {
      var p2 = t ? PATH_FS.resolve(PATH.join2(e, t)) : e;
      function g2(c2) {
        function f2(u2) {
          m2?.(), n2 || FS_createDataFile(e, t, u2, a2, o2, _2), s2?.(), removeRunDependency();
        }
        FS_handledByPreloadPlugin(c2, p2, f2, () => {
          l2?.(), removeRunDependency();
        }) || f2(c2);
      }
      addRunDependency(), typeof r2 == "string" ? asyncLoad(r2).then(g2, l2) : g2(r2);
    }, FS_modeStringToFlags = (e) => {
      var t = { r: 0, "r+": 2, w: 577, "w+": 578, a: 1089, "a+": 1090 }, r2 = t[e];
      if (typeof r2 > "u") throw new Error(`Unknown file open mode: ${e}`);
      return r2;
    }, FS_getMode = (e, t) => {
      var r2 = 0;
      return e && (r2 |= 365), t && (r2 |= 146), r2;
    }, IDBFS = { dbs: {}, indexedDB: () => {
      if (typeof indexedDB < "u") return indexedDB;
      var e = null;
      return typeof window == "object" && (e = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB), e;
    }, DB_VERSION: 21, DB_STORE_NAME: "FILE_DATA", queuePersist: (e) => {
      function t() {
        e.idbPersistState === "again" ? r2() : e.idbPersistState = 0;
      }
      function r2() {
        e.idbPersistState = "idb", IDBFS.syncfs(e, false, t);
      }
      e.idbPersistState ? e.idbPersistState === "idb" && (e.idbPersistState = "again") : e.idbPersistState = setTimeout(r2, 0);
    }, mount: (e) => {
      var t = MEMFS.mount(e);
      if (e?.opts?.autoPersist) {
        t.idbPersistState = 0;
        var r2 = t.node_ops;
        t.node_ops = Object.assign({}, t.node_ops), t.node_ops.mknod = (a2, o2, s2, l2) => {
          var n2 = r2.mknod(a2, o2, s2, l2);
          return n2.node_ops = t.node_ops, n2.idbfs_mount = t.mount, n2.memfs_stream_ops = n2.stream_ops, n2.stream_ops = Object.assign({}, n2.stream_ops), n2.stream_ops.write = (_2, m2, p2, d2, g2, c2) => (_2.node.isModified = true, n2.memfs_stream_ops.write(_2, m2, p2, d2, g2, c2)), n2.stream_ops.close = (_2) => {
            var m2 = _2.node;
            if (m2.isModified && (IDBFS.queuePersist(m2.idbfs_mount), m2.isModified = false), m2.memfs_stream_ops.close) return m2.memfs_stream_ops.close(_2);
          }, n2;
        }, t.node_ops.mkdir = (...a2) => (IDBFS.queuePersist(t.mount), r2.mkdir(...a2)), t.node_ops.rmdir = (...a2) => (IDBFS.queuePersist(t.mount), r2.rmdir(...a2)), t.node_ops.symlink = (...a2) => (IDBFS.queuePersist(t.mount), r2.symlink(...a2)), t.node_ops.unlink = (...a2) => (IDBFS.queuePersist(t.mount), r2.unlink(...a2)), t.node_ops.rename = (...a2) => (IDBFS.queuePersist(t.mount), r2.rename(...a2));
      }
      return t;
    }, syncfs: (e, t, r2) => {
      IDBFS.getLocalSet(e, (a2, o2) => {
        if (a2) return r2(a2);
        IDBFS.getRemoteSet(e, (s2, l2) => {
          if (s2) return r2(s2);
          var n2 = t ? l2 : o2, _2 = t ? o2 : l2;
          IDBFS.reconcile(n2, _2, r2);
        });
      });
    }, quit: () => {
      Object.values(IDBFS.dbs).forEach((e) => e.close()), IDBFS.dbs = {};
    }, getDB: (e, t) => {
      var r2 = IDBFS.dbs[e];
      if (r2) return t(null, r2);
      var a2;
      try {
        a2 = IDBFS.indexedDB().open(e, IDBFS.DB_VERSION);
      } catch (o2) {
        return t(o2);
      }
      if (!a2) return t("Unable to connect to IndexedDB");
      a2.onupgradeneeded = (o2) => {
        var s2 = o2.target.result, l2 = o2.target.transaction, n2;
        s2.objectStoreNames.contains(IDBFS.DB_STORE_NAME) ? n2 = l2.objectStore(IDBFS.DB_STORE_NAME) : n2 = s2.createObjectStore(IDBFS.DB_STORE_NAME), n2.indexNames.contains("timestamp") || n2.createIndex("timestamp", "timestamp", { unique: false });
      }, a2.onsuccess = () => {
        r2 = a2.result, IDBFS.dbs[e] = r2, t(null, r2);
      }, a2.onerror = (o2) => {
        t(o2.target.error), o2.preventDefault();
      };
    }, getLocalSet: (e, t) => {
      var r2 = {};
      function a2(_2) {
        return _2 !== "." && _2 !== "..";
      }
      function o2(_2) {
        return (m2) => PATH.join2(_2, m2);
      }
      for (var s2 = FS.readdir(e.mountpoint).filter(a2).map(o2(e.mountpoint)); s2.length; ) {
        var l2 = s2.pop(), n2;
        try {
          n2 = FS.stat(l2);
        } catch (_2) {
          return t(_2);
        }
        FS.isDir(n2.mode) && s2.push(...FS.readdir(l2).filter(a2).map(o2(l2))), r2[l2] = { timestamp: n2.mtime };
      }
      return t(null, { type: "local", entries: r2 });
    }, getRemoteSet: (e, t) => {
      var r2 = {};
      IDBFS.getDB(e.mountpoint, (a2, o2) => {
        if (a2) return t(a2);
        try {
          var s2 = o2.transaction([IDBFS.DB_STORE_NAME], "readonly");
          s2.onerror = (_2) => {
            t(_2.target.error), _2.preventDefault();
          };
          var l2 = s2.objectStore(IDBFS.DB_STORE_NAME), n2 = l2.index("timestamp");
          n2.openKeyCursor().onsuccess = (_2) => {
            var m2 = _2.target.result;
            if (!m2) return t(null, { type: "remote", db: o2, entries: r2 });
            r2[m2.primaryKey] = { timestamp: m2.key }, m2.continue();
          };
        } catch (_2) {
          return t(_2);
        }
      });
    }, loadLocalEntry: (e, t) => {
      var r2, a2;
      try {
        var o2 = FS.lookupPath(e);
        a2 = o2.node, r2 = FS.stat(e);
      } catch (s2) {
        return t(s2);
      }
      return FS.isDir(r2.mode) ? t(null, { timestamp: r2.mtime, mode: r2.mode }) : FS.isFile(r2.mode) ? (a2.contents = MEMFS.getFileDataAsTypedArray(a2), t(null, { timestamp: r2.mtime, mode: r2.mode, contents: a2.contents })) : t(new Error("node type not supported"));
    }, storeLocalEntry: (e, t, r2) => {
      try {
        if (FS.isDir(t.mode)) FS.mkdirTree(e, t.mode);
        else if (FS.isFile(t.mode)) FS.writeFile(e, t.contents, { canOwn: true });
        else return r2(new Error("node type not supported"));
        FS.chmod(e, t.mode), FS.utime(e, t.timestamp, t.timestamp);
      } catch (a2) {
        return r2(a2);
      }
      r2(null);
    }, removeLocalEntry: (e, t) => {
      try {
        var r2 = FS.stat(e);
        FS.isDir(r2.mode) ? FS.rmdir(e) : FS.isFile(r2.mode) && FS.unlink(e);
      } catch (a2) {
        return t(a2);
      }
      t(null);
    }, loadRemoteEntry: (e, t, r2) => {
      var a2 = e.get(t);
      a2.onsuccess = (o2) => r2(null, o2.target.result), a2.onerror = (o2) => {
        r2(o2.target.error), o2.preventDefault();
      };
    }, storeRemoteEntry: (e, t, r2, a2) => {
      try {
        var o2 = e.put(r2, t);
      } catch (s2) {
        a2(s2);
        return;
      }
      o2.onsuccess = (s2) => a2(), o2.onerror = (s2) => {
        a2(s2.target.error), s2.preventDefault();
      };
    }, removeRemoteEntry: (e, t, r2) => {
      var a2 = e.delete(t);
      a2.onsuccess = (o2) => r2(), a2.onerror = (o2) => {
        r2(o2.target.error), o2.preventDefault();
      };
    }, reconcile: (e, t, r2) => {
      var a2 = 0, o2 = [];
      Object.keys(e.entries).forEach((d2) => {
        var g2 = e.entries[d2], c2 = t.entries[d2];
        (!c2 || g2.timestamp.getTime() != c2.timestamp.getTime()) && (o2.push(d2), a2++);
      });
      var s2 = [];
      if (Object.keys(t.entries).forEach((d2) => {
        e.entries[d2] || (s2.push(d2), a2++);
      }), !a2) return r2(null);
      var l2 = false, n2 = e.type === "remote" ? e.db : t.db, _2 = n2.transaction([IDBFS.DB_STORE_NAME], "readwrite"), m2 = _2.objectStore(IDBFS.DB_STORE_NAME);
      function p2(d2) {
        if (d2 && !l2) return l2 = true, r2(d2);
      }
      _2.onerror = _2.onabort = (d2) => {
        p2(d2.target.error), d2.preventDefault();
      }, _2.oncomplete = (d2) => {
        l2 || r2(null);
      }, o2.sort().forEach((d2) => {
        t.type === "local" ? IDBFS.loadRemoteEntry(m2, d2, (g2, c2) => {
          if (g2) return p2(g2);
          IDBFS.storeLocalEntry(d2, c2, p2);
        }) : IDBFS.loadLocalEntry(d2, (g2, c2) => {
          if (g2) return p2(g2);
          IDBFS.storeRemoteEntry(m2, d2, c2, p2);
        });
      }), s2.sort().reverse().forEach((d2) => {
        t.type === "local" ? IDBFS.removeLocalEntry(d2, p2) : IDBFS.removeRemoteEntry(m2, d2, p2);
      });
    } }, ERRNO_CODES = { EPERM: 63, ENOENT: 44, ESRCH: 71, EINTR: 27, EIO: 29, ENXIO: 60, E2BIG: 1, ENOEXEC: 45, EBADF: 8, ECHILD: 12, EAGAIN: 6, EWOULDBLOCK: 6, ENOMEM: 48, EACCES: 2, EFAULT: 21, ENOTBLK: 105, EBUSY: 10, EEXIST: 20, EXDEV: 75, ENODEV: 43, ENOTDIR: 54, EISDIR: 31, EINVAL: 28, ENFILE: 41, EMFILE: 33, ENOTTY: 59, ETXTBSY: 74, EFBIG: 22, ENOSPC: 51, ESPIPE: 70, EROFS: 69, EMLINK: 34, EPIPE: 64, EDOM: 18, ERANGE: 68, ENOMSG: 49, EIDRM: 24, ECHRNG: 106, EL2NSYNC: 156, EL3HLT: 107, EL3RST: 108, ELNRNG: 109, EUNATCH: 110, ENOCSI: 111, EL2HLT: 112, EDEADLK: 16, ENOLCK: 46, EBADE: 113, EBADR: 114, EXFULL: 115, ENOANO: 104, EBADRQC: 103, EBADSLT: 102, EDEADLOCK: 16, EBFONT: 101, ENOSTR: 100, ENODATA: 116, ETIME: 117, ENOSR: 118, ENONET: 119, ENOPKG: 120, EREMOTE: 121, ENOLINK: 47, EADV: 122, ESRMNT: 123, ECOMM: 124, EPROTO: 65, EMULTIHOP: 36, EDOTDOT: 125, EBADMSG: 9, ENOTUNIQ: 126, EBADFD: 127, EREMCHG: 128, ELIBACC: 129, ELIBBAD: 130, ELIBSCN: 131, ELIBMAX: 132, ELIBEXEC: 133, ENOSYS: 52, ENOTEMPTY: 55, ENAMETOOLONG: 37, ELOOP: 32, EOPNOTSUPP: 138, EPFNOSUPPORT: 139, ECONNRESET: 15, ENOBUFS: 42, EAFNOSUPPORT: 5, EPROTOTYPE: 67, ENOTSOCK: 57, ENOPROTOOPT: 50, ESHUTDOWN: 140, ECONNREFUSED: 14, EADDRINUSE: 3, ECONNABORTED: 13, ENETUNREACH: 40, ENETDOWN: 38, ETIMEDOUT: 73, EHOSTDOWN: 142, EHOSTUNREACH: 23, EINPROGRESS: 26, EALREADY: 7, EDESTADDRREQ: 17, EMSGSIZE: 35, EPROTONOSUPPORT: 66, ESOCKTNOSUPPORT: 137, EADDRNOTAVAIL: 4, ENETRESET: 39, EISCONN: 30, ENOTCONN: 53, ETOOMANYREFS: 141, EUSERS: 136, EDQUOT: 19, ESTALE: 72, ENOTSUP: 138, ENOMEDIUM: 148, EILSEQ: 25, EOVERFLOW: 61, ECANCELED: 11, ENOTRECOVERABLE: 56, EOWNERDEAD: 62, ESTRPIPE: 135 }, NODEFS = { isWindows: false, staticInit() {
      NODEFS.isWindows = !!process.platform.match(/^win/);
      var e = process.binding("constants");
      e.fs && (e = e.fs), NODEFS.flagsForNodeMap = { 1024: e.O_APPEND, 64: e.O_CREAT, 128: e.O_EXCL, 256: e.O_NOCTTY, 0: e.O_RDONLY, 2: e.O_RDWR, 4096: e.O_SYNC, 512: e.O_TRUNC, 1: e.O_WRONLY, 131072: e.O_NOFOLLOW };
    }, convertNodeCode(e) {
      var t = e.code;
      return ERRNO_CODES[t];
    }, tryFSOperation(e) {
      try {
        return e();
      } catch (t) {
        throw t.code ? t.code === "UNKNOWN" ? new FS.ErrnoError(28) : new FS.ErrnoError(NODEFS.convertNodeCode(t)) : t;
      }
    }, mount(e) {
      return NODEFS.createNode(null, "/", NODEFS.getMode(e.opts.root), 0);
    }, createNode(e, t, r2, a2) {
      if (!FS.isDir(r2) && !FS.isFile(r2) && !FS.isLink(r2)) throw new FS.ErrnoError(28);
      var o2 = FS.createNode(e, t, r2);
      return o2.node_ops = NODEFS.node_ops, o2.stream_ops = NODEFS.stream_ops, o2;
    }, getMode(e) {
      return NODEFS.tryFSOperation(() => {
        var t = fs.lstatSync(e).mode;
        return NODEFS.isWindows && (t |= (t & 292) >> 2), t;
      });
    }, realPath(e) {
      for (var t = []; e.parent !== e; ) t.push(e.name), e = e.parent;
      return t.push(e.mount.opts.root), t.reverse(), PATH.join(...t);
    }, flagsForNode(e) {
      e &= -2097153, e &= -2049, e &= -32769, e &= -524289, e &= -65537;
      var t = 0;
      for (var r2 in NODEFS.flagsForNodeMap) e & r2 && (t |= NODEFS.flagsForNodeMap[r2], e ^= r2);
      if (e) throw new FS.ErrnoError(28);
      return t;
    }, node_ops: { getattr(e) {
      var t = NODEFS.realPath(e), r2;
      return NODEFS.tryFSOperation(() => r2 = fs.lstatSync(t)), NODEFS.isWindows && (r2.blksize || (r2.blksize = 4096), r2.blocks || (r2.blocks = (r2.size + r2.blksize - 1) / r2.blksize | 0), r2.mode |= (r2.mode & 292) >> 2), { dev: r2.dev, ino: r2.ino, mode: r2.mode, nlink: r2.nlink, uid: r2.uid, gid: r2.gid, rdev: r2.rdev, size: r2.size, atime: r2.atime, mtime: r2.mtime, ctime: r2.ctime, blksize: r2.blksize, blocks: r2.blocks };
    }, setattr(e, t) {
      var r2 = NODEFS.realPath(e);
      NODEFS.tryFSOperation(() => {
        if (t.mode !== void 0) {
          var a2 = t.mode;
          NODEFS.isWindows && (a2 &= 384), fs.chmodSync(r2, a2), e.mode = t.mode;
        }
        if (t.atime || t.mtime) {
          var o2 = t.atime && new Date(t.atime), s2 = t.mtime && new Date(t.mtime);
          fs.utimesSync(r2, o2, s2);
        }
        t.size !== void 0 && fs.truncateSync(r2, t.size);
      });
    }, lookup(e, t) {
      var r2 = PATH.join2(NODEFS.realPath(e), t), a2 = NODEFS.getMode(r2);
      return NODEFS.createNode(e, t, a2);
    }, mknod(e, t, r2, a2) {
      var o2 = NODEFS.createNode(e, t, r2, a2), s2 = NODEFS.realPath(o2);
      return NODEFS.tryFSOperation(() => {
        FS.isDir(o2.mode) ? fs.mkdirSync(s2, o2.mode) : fs.writeFileSync(s2, "", { mode: o2.mode });
      }), o2;
    }, rename(e, t, r2) {
      var a2 = NODEFS.realPath(e), o2 = PATH.join2(NODEFS.realPath(t), r2);
      try {
        FS.unlink(o2);
      } catch {
      }
      NODEFS.tryFSOperation(() => fs.renameSync(a2, o2)), e.name = r2;
    }, unlink(e, t) {
      var r2 = PATH.join2(NODEFS.realPath(e), t);
      NODEFS.tryFSOperation(() => fs.unlinkSync(r2));
    }, rmdir(e, t) {
      var r2 = PATH.join2(NODEFS.realPath(e), t);
      NODEFS.tryFSOperation(() => fs.rmdirSync(r2));
    }, readdir(e) {
      var t = NODEFS.realPath(e);
      return NODEFS.tryFSOperation(() => fs.readdirSync(t));
    }, symlink(e, t, r2) {
      var a2 = PATH.join2(NODEFS.realPath(e), t);
      NODEFS.tryFSOperation(() => fs.symlinkSync(r2, a2));
    }, readlink(e) {
      var t = NODEFS.realPath(e);
      return NODEFS.tryFSOperation(() => fs.readlinkSync(t));
    }, statfs(e) {
      var t = NODEFS.tryFSOperation(() => fs.statfsSync(e));
      return t.frsize = t.bsize, t;
    } }, stream_ops: { open(e) {
      var t = NODEFS.realPath(e.node);
      NODEFS.tryFSOperation(() => {
        FS.isFile(e.node.mode) && (e.shared.refcount = 1, e.nfd = fs.openSync(t, NODEFS.flagsForNode(e.flags)));
      });
    }, close(e) {
      NODEFS.tryFSOperation(() => {
        FS.isFile(e.node.mode) && e.nfd && --e.shared.refcount === 0 && fs.closeSync(e.nfd);
      });
    }, dup(e) {
      e.shared.refcount++;
    }, read(e, t, r2, a2, o2) {
      return a2 === 0 ? 0 : NODEFS.tryFSOperation(() => fs.readSync(e.nfd, new Int8Array(t.buffer, r2, a2), 0, a2, o2));
    }, write(e, t, r2, a2, o2) {
      return NODEFS.tryFSOperation(() => fs.writeSync(e.nfd, new Int8Array(t.buffer, r2, a2), 0, a2, o2));
    }, llseek(e, t, r2) {
      var a2 = t;
      if (r2 === 1 ? a2 += e.position : r2 === 2 && FS.isFile(e.node.mode) && NODEFS.tryFSOperation(() => {
        var o2 = fs.fstatSync(e.nfd);
        a2 += o2.size;
      }), a2 < 0) throw new FS.ErrnoError(28);
      return a2;
    }, mmap(e, t, r2, a2, o2) {
      if (!FS.isFile(e.node.mode)) throw new FS.ErrnoError(43);
      var s2 = mmapAlloc(t);
      return NODEFS.stream_ops.read(e, HEAP8, s2, t, r2), { ptr: s2, allocated: true };
    }, msync(e, t, r2, a2, o2) {
      return NODEFS.stream_ops.write(e, t, 0, a2, r2, false), 0;
    } } }, FS = { root: null, mounts: [], devices: {}, streams: [], nextInode: 1, nameTable: null, currentPath: "/", initialized: false, ignorePermissions: true, ErrnoError: class {
      constructor(e) {
        P$1(this, "name", "ErrnoError");
        this.errno = e;
      }
    }, filesystems: null, syncFSRequests: 0, readFiles: {}, FSStream: class {
      constructor() {
        P$1(this, "shared", {});
      }
      get object() {
        return this.node;
      }
      set object(e) {
        this.node = e;
      }
      get isRead() {
        return (this.flags & 2097155) !== 1;
      }
      get isWrite() {
        return (this.flags & 2097155) !== 0;
      }
      get isAppend() {
        return this.flags & 1024;
      }
      get flags() {
        return this.shared.flags;
      }
      set flags(e) {
        this.shared.flags = e;
      }
      get position() {
        return this.shared.position;
      }
      set position(e) {
        this.shared.position = e;
      }
    }, FSNode: class {
      constructor(e, t, r2, a2) {
        P$1(this, "node_ops", {});
        P$1(this, "stream_ops", {});
        P$1(this, "readMode", 365);
        P$1(this, "writeMode", 146);
        P$1(this, "mounted", null);
        e || (e = this), this.parent = e, this.mount = e.mount, this.id = FS.nextInode++, this.name = t, this.mode = r2, this.rdev = a2, this.atime = this.mtime = this.ctime = Date.now();
      }
      get read() {
        return (this.mode & this.readMode) === this.readMode;
      }
      set read(e) {
        e ? this.mode |= this.readMode : this.mode &= ~this.readMode;
      }
      get write() {
        return (this.mode & this.writeMode) === this.writeMode;
      }
      set write(e) {
        e ? this.mode |= this.writeMode : this.mode &= ~this.writeMode;
      }
      get isFolder() {
        return FS.isDir(this.mode);
      }
      get isDevice() {
        return FS.isChrdev(this.mode);
      }
    }, lookupPath(e, t = {}) {
      if (!e) return { path: "", node: null };
      t.follow_mount ?? (t.follow_mount = true), PATH.isAbs(e) || (e = FS.cwd() + "/" + e);
      e: for (var r2 = 0; r2 < 40; r2++) {
        for (var a2 = e.split("/").filter((m2) => !!m2 && m2 !== "."), o2 = FS.root, s2 = "/", l2 = 0; l2 < a2.length; l2++) {
          var n2 = l2 === a2.length - 1;
          if (n2 && t.parent) break;
          if (a2[l2] === "..") {
            s2 = PATH.dirname(s2), o2 = o2.parent;
            continue;
          }
          s2 = PATH.join2(s2, a2[l2]);
          try {
            o2 = FS.lookupNode(o2, a2[l2]);
          } catch (m2) {
            if (m2?.errno === 44 && n2 && t.noent_okay) return { path: s2 };
            throw m2;
          }
          if (FS.isMountpoint(o2) && (!n2 || t.follow_mount) && (o2 = o2.mounted.root), FS.isLink(o2.mode) && (!n2 || t.follow)) {
            if (!o2.node_ops.readlink) throw new FS.ErrnoError(52);
            var _2 = o2.node_ops.readlink(o2);
            PATH.isAbs(_2) || (_2 = PATH.dirname(s2) + "/" + _2), e = _2 + "/" + a2.slice(l2 + 1).join("/");
            continue e;
          }
        }
        return { path: s2, node: o2 };
      }
      throw new FS.ErrnoError(32);
    }, getPath(e) {
      for (var t; ; ) {
        if (FS.isRoot(e)) {
          var r2 = e.mount.mountpoint;
          return t ? r2[r2.length - 1] !== "/" ? `${r2}/${t}` : r2 + t : r2;
        }
        t = t ? `${e.name}/${t}` : e.name, e = e.parent;
      }
    }, hashName(e, t) {
      for (var r2 = 0, a2 = 0; a2 < t.length; a2++) r2 = (r2 << 5) - r2 + t.charCodeAt(a2) | 0;
      return (e + r2 >>> 0) % FS.nameTable.length;
    }, hashAddNode(e) {
      var t = FS.hashName(e.parent.id, e.name);
      e.name_next = FS.nameTable[t], FS.nameTable[t] = e;
    }, hashRemoveNode(e) {
      var t = FS.hashName(e.parent.id, e.name);
      if (FS.nameTable[t] === e) FS.nameTable[t] = e.name_next;
      else for (var r2 = FS.nameTable[t]; r2; ) {
        if (r2.name_next === e) {
          r2.name_next = e.name_next;
          break;
        }
        r2 = r2.name_next;
      }
    }, lookupNode(e, t) {
      var r2 = FS.mayLookup(e);
      if (r2) throw new FS.ErrnoError(r2);
      for (var a2 = FS.hashName(e.id, t), o2 = FS.nameTable[a2]; o2; o2 = o2.name_next) {
        var s2 = o2.name;
        if (o2.parent.id === e.id && s2 === t) return o2;
      }
      return FS.lookup(e, t);
    }, createNode(e, t, r2, a2) {
      var o2 = new FS.FSNode(e, t, r2, a2);
      return FS.hashAddNode(o2), o2;
    }, destroyNode(e) {
      FS.hashRemoveNode(e);
    }, isRoot(e) {
      return e === e.parent;
    }, isMountpoint(e) {
      return !!e.mounted;
    }, isFile(e) {
      return (e & 61440) === 32768;
    }, isDir(e) {
      return (e & 61440) === 16384;
    }, isLink(e) {
      return (e & 61440) === 40960;
    }, isChrdev(e) {
      return (e & 61440) === 8192;
    }, isBlkdev(e) {
      return (e & 61440) === 24576;
    }, isFIFO(e) {
      return (e & 61440) === 4096;
    }, isSocket(e) {
      return (e & 49152) === 49152;
    }, flagsToPermissionString(e) {
      var t = ["r", "w", "rw"][e & 3];
      return e & 512 && (t += "w"), t;
    }, nodePermissions(e, t) {
      return FS.ignorePermissions ? 0 : t.includes("r") && !(e.mode & 292) || t.includes("w") && !(e.mode & 146) || t.includes("x") && !(e.mode & 73) ? 2 : 0;
    }, mayLookup(e) {
      if (!FS.isDir(e.mode)) return 54;
      var t = FS.nodePermissions(e, "x");
      return t || (e.node_ops.lookup ? 0 : 2);
    }, mayCreate(e, t) {
      if (!FS.isDir(e.mode)) return 54;
      try {
        var r2 = FS.lookupNode(e, t);
        return 20;
      } catch {
      }
      return FS.nodePermissions(e, "wx");
    }, mayDelete(e, t, r2) {
      var a2;
      try {
        a2 = FS.lookupNode(e, t);
      } catch (s2) {
        return s2.errno;
      }
      var o2 = FS.nodePermissions(e, "wx");
      if (o2) return o2;
      if (r2) {
        if (!FS.isDir(a2.mode)) return 54;
        if (FS.isRoot(a2) || FS.getPath(a2) === FS.cwd()) return 10;
      } else if (FS.isDir(a2.mode)) return 31;
      return 0;
    }, mayOpen(e, t) {
      return e ? FS.isLink(e.mode) ? 32 : FS.isDir(e.mode) && (FS.flagsToPermissionString(t) !== "r" || t & 512) ? 31 : FS.nodePermissions(e, FS.flagsToPermissionString(t)) : 44;
    }, MAX_OPEN_FDS: 4096, nextfd() {
      for (var e = 0; e <= FS.MAX_OPEN_FDS; e++) if (!FS.streams[e]) return e;
      throw new FS.ErrnoError(33);
    }, getStreamChecked(e) {
      var t = FS.getStream(e);
      if (!t) throw new FS.ErrnoError(8);
      return t;
    }, getStream: (e) => FS.streams[e], createStream(e, t = -1) {
      return e = Object.assign(new FS.FSStream(), e), t == -1 && (t = FS.nextfd()), e.fd = t, FS.streams[t] = e, e;
    }, closeStream(e) {
      FS.streams[e] = null;
    }, dupStream(e, t = -1) {
      var r2 = FS.createStream(e, t);
      return r2.stream_ops?.dup?.(r2), r2;
    }, chrdev_stream_ops: { open(e) {
      var t = FS.getDevice(e.node.rdev);
      e.stream_ops = t.stream_ops, e.stream_ops.open?.(e);
    }, llseek() {
      throw new FS.ErrnoError(70);
    } }, major: (e) => e >> 8, minor: (e) => e & 255, makedev: (e, t) => e << 8 | t, registerDevice(e, t) {
      FS.devices[e] = { stream_ops: t };
    }, getDevice: (e) => FS.devices[e], getMounts(e) {
      for (var t = [], r2 = [e]; r2.length; ) {
        var a2 = r2.pop();
        t.push(a2), r2.push(...a2.mounts);
      }
      return t;
    }, syncfs(e, t) {
      typeof e == "function" && (t = e, e = false), FS.syncFSRequests++, FS.syncFSRequests > 1 && err(`warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`);
      var r2 = FS.getMounts(FS.root.mount), a2 = 0;
      function o2(l2) {
        return FS.syncFSRequests--, t(l2);
      }
      function s2(l2) {
        if (l2) return s2.errored ? void 0 : (s2.errored = true, o2(l2));
        ++a2 >= r2.length && o2(null);
      }
      r2.forEach((l2) => {
        if (!l2.type.syncfs) return s2(null);
        l2.type.syncfs(l2, e, s2);
      });
    }, mount(e, t, r2) {
      var a2 = r2 === "/", o2 = !r2, s2;
      if (a2 && FS.root) throw new FS.ErrnoError(10);
      if (!a2 && !o2) {
        var l2 = FS.lookupPath(r2, { follow_mount: false });
        if (r2 = l2.path, s2 = l2.node, FS.isMountpoint(s2)) throw new FS.ErrnoError(10);
        if (!FS.isDir(s2.mode)) throw new FS.ErrnoError(54);
      }
      var n2 = { type: e, opts: t, mountpoint: r2, mounts: [] }, _2 = e.mount(n2);
      return _2.mount = n2, n2.root = _2, a2 ? FS.root = _2 : s2 && (s2.mounted = n2, s2.mount && s2.mount.mounts.push(n2)), _2;
    }, unmount(e) {
      var t = FS.lookupPath(e, { follow_mount: false });
      if (!FS.isMountpoint(t.node)) throw new FS.ErrnoError(28);
      var r2 = t.node, a2 = r2.mounted, o2 = FS.getMounts(a2);
      Object.keys(FS.nameTable).forEach((l2) => {
        for (var n2 = FS.nameTable[l2]; n2; ) {
          var _2 = n2.name_next;
          o2.includes(n2.mount) && FS.destroyNode(n2), n2 = _2;
        }
      }), r2.mounted = null;
      var s2 = r2.mount.mounts.indexOf(a2);
      r2.mount.mounts.splice(s2, 1);
    }, lookup(e, t) {
      return e.node_ops.lookup(e, t);
    }, mknod(e, t, r2) {
      var a2 = FS.lookupPath(e, { parent: true }), o2 = a2.node, s2 = PATH.basename(e);
      if (!s2 || s2 === "." || s2 === "..") throw new FS.ErrnoError(28);
      var l2 = FS.mayCreate(o2, s2);
      if (l2) throw new FS.ErrnoError(l2);
      if (!o2.node_ops.mknod) throw new FS.ErrnoError(63);
      return o2.node_ops.mknod(o2, s2, t, r2);
    }, statfs(e) {
      var t = { bsize: 4096, frsize: 4096, blocks: 1e6, bfree: 5e5, bavail: 5e5, files: FS.nextInode, ffree: FS.nextInode - 1, fsid: 42, flags: 2, namelen: 255 }, r2 = FS.lookupPath(e, { follow: true }).node;
      return r2?.node_ops.statfs && Object.assign(t, r2.node_ops.statfs(r2.mount.opts.root)), t;
    }, create(e, t = 438) {
      return t &= 4095, t |= 32768, FS.mknod(e, t, 0);
    }, mkdir(e, t = 511) {
      return t &= 1023, t |= 16384, FS.mknod(e, t, 0);
    }, mkdirTree(e, t) {
      for (var r2 = e.split("/"), a2 = "", o2 = 0; o2 < r2.length; ++o2) if (r2[o2]) {
        a2 += "/" + r2[o2];
        try {
          FS.mkdir(a2, t);
        } catch (s2) {
          if (s2.errno != 20) throw s2;
        }
      }
    }, mkdev(e, t, r2) {
      return typeof r2 > "u" && (r2 = t, t = 438), t |= 8192, FS.mknod(e, t, r2);
    }, symlink(e, t) {
      if (!PATH_FS.resolve(e)) throw new FS.ErrnoError(44);
      var r2 = FS.lookupPath(t, { parent: true }), a2 = r2.node;
      if (!a2) throw new FS.ErrnoError(44);
      var o2 = PATH.basename(t), s2 = FS.mayCreate(a2, o2);
      if (s2) throw new FS.ErrnoError(s2);
      if (!a2.node_ops.symlink) throw new FS.ErrnoError(63);
      return a2.node_ops.symlink(a2, o2, e);
    }, rename(e, t) {
      var r2 = PATH.dirname(e), a2 = PATH.dirname(t), o2 = PATH.basename(e), s2 = PATH.basename(t), l2, n2, _2;
      if (l2 = FS.lookupPath(e, { parent: true }), n2 = l2.node, l2 = FS.lookupPath(t, { parent: true }), _2 = l2.node, !n2 || !_2) throw new FS.ErrnoError(44);
      if (n2.mount !== _2.mount) throw new FS.ErrnoError(75);
      var m2 = FS.lookupNode(n2, o2), p2 = PATH_FS.relative(e, a2);
      if (p2.charAt(0) !== ".") throw new FS.ErrnoError(28);
      if (p2 = PATH_FS.relative(t, r2), p2.charAt(0) !== ".") throw new FS.ErrnoError(55);
      var d2;
      try {
        d2 = FS.lookupNode(_2, s2);
      } catch {
      }
      if (m2 !== d2) {
        var g2 = FS.isDir(m2.mode), c2 = FS.mayDelete(n2, o2, g2);
        if (c2) throw new FS.ErrnoError(c2);
        if (c2 = d2 ? FS.mayDelete(_2, s2, g2) : FS.mayCreate(_2, s2), c2) throw new FS.ErrnoError(c2);
        if (!n2.node_ops.rename) throw new FS.ErrnoError(63);
        if (FS.isMountpoint(m2) || d2 && FS.isMountpoint(d2)) throw new FS.ErrnoError(10);
        if (_2 !== n2 && (c2 = FS.nodePermissions(n2, "w"), c2)) throw new FS.ErrnoError(c2);
        FS.hashRemoveNode(m2);
        try {
          n2.node_ops.rename(m2, _2, s2), m2.parent = _2;
        } catch (f2) {
          throw f2;
        } finally {
          FS.hashAddNode(m2);
        }
      }
    }, rmdir(e) {
      var t = FS.lookupPath(e, { parent: true }), r2 = t.node, a2 = PATH.basename(e), o2 = FS.lookupNode(r2, a2), s2 = FS.mayDelete(r2, a2, true);
      if (s2) throw new FS.ErrnoError(s2);
      if (!r2.node_ops.rmdir) throw new FS.ErrnoError(63);
      if (FS.isMountpoint(o2)) throw new FS.ErrnoError(10);
      r2.node_ops.rmdir(r2, a2), FS.destroyNode(o2);
    }, readdir(e) {
      var t = FS.lookupPath(e, { follow: true }), r2 = t.node;
      if (!r2.node_ops.readdir) throw new FS.ErrnoError(54);
      return r2.node_ops.readdir(r2);
    }, unlink(e) {
      var t = FS.lookupPath(e, { parent: true }), r2 = t.node;
      if (!r2) throw new FS.ErrnoError(44);
      var a2 = PATH.basename(e), o2 = FS.lookupNode(r2, a2), s2 = FS.mayDelete(r2, a2, false);
      if (s2) throw new FS.ErrnoError(s2);
      if (!r2.node_ops.unlink) throw new FS.ErrnoError(63);
      if (FS.isMountpoint(o2)) throw new FS.ErrnoError(10);
      r2.node_ops.unlink(r2, a2), FS.destroyNode(o2);
    }, readlink(e) {
      var t = FS.lookupPath(e), r2 = t.node;
      if (!r2) throw new FS.ErrnoError(44);
      if (!r2.node_ops.readlink) throw new FS.ErrnoError(28);
      return r2.node_ops.readlink(r2);
    }, stat(e, t) {
      var r2 = FS.lookupPath(e, { follow: !t }), a2 = r2.node;
      if (!a2) throw new FS.ErrnoError(44);
      if (!a2.node_ops.getattr) throw new FS.ErrnoError(63);
      return a2.node_ops.getattr(a2);
    }, lstat(e) {
      return FS.stat(e, true);
    }, chmod(e, t, r2) {
      var a2;
      if (typeof e == "string") {
        var o2 = FS.lookupPath(e, { follow: !r2 });
        a2 = o2.node;
      } else a2 = e;
      if (!a2.node_ops.setattr) throw new FS.ErrnoError(63);
      a2.node_ops.setattr(a2, { mode: t & 4095 | a2.mode & -4096, ctime: Date.now() });
    }, lchmod(e, t) {
      FS.chmod(e, t, true);
    }, fchmod(e, t) {
      var r2 = FS.getStreamChecked(e);
      FS.chmod(r2.node, t);
    }, chown(e, t, r2, a2) {
      var o2;
      if (typeof e == "string") {
        var s2 = FS.lookupPath(e, { follow: !a2 });
        o2 = s2.node;
      } else o2 = e;
      if (!o2.node_ops.setattr) throw new FS.ErrnoError(63);
      o2.node_ops.setattr(o2, { timestamp: Date.now() });
    }, lchown(e, t, r2) {
      FS.chown(e, t, r2, true);
    }, fchown(e, t, r2) {
      var a2 = FS.getStreamChecked(e);
      FS.chown(a2.node, t, r2);
    }, truncate(e, t) {
      if (t < 0) throw new FS.ErrnoError(28);
      var r2;
      if (typeof e == "string") {
        var a2 = FS.lookupPath(e, { follow: true });
        r2 = a2.node;
      } else r2 = e;
      if (!r2.node_ops.setattr) throw new FS.ErrnoError(63);
      if (FS.isDir(r2.mode)) throw new FS.ErrnoError(31);
      if (!FS.isFile(r2.mode)) throw new FS.ErrnoError(28);
      var o2 = FS.nodePermissions(r2, "w");
      if (o2) throw new FS.ErrnoError(o2);
      r2.node_ops.setattr(r2, { size: t, timestamp: Date.now() });
    }, ftruncate(e, t) {
      var r2 = FS.getStreamChecked(e);
      if (!(r2.flags & 2097155)) throw new FS.ErrnoError(28);
      FS.truncate(r2.node, t);
    }, utime(e, t, r2) {
      var a2 = FS.lookupPath(e, { follow: true }), o2 = a2.node;
      o2.node_ops.setattr(o2, { atime: t, mtime: r2 });
    }, open(e, t, r2 = 438) {
      if (e === "") throw new FS.ErrnoError(44);
      t = typeof t == "string" ? FS_modeStringToFlags(t) : t, t & 64 ? r2 = r2 & 4095 | 32768 : r2 = 0;
      var a2;
      if (typeof e == "object") a2 = e;
      else {
        var o2 = FS.lookupPath(e, { follow: !(t & 131072), noent_okay: true });
        a2 = o2.node, e = o2.path;
      }
      var s2 = false;
      if (t & 64) if (a2) {
        if (t & 128) throw new FS.ErrnoError(20);
      } else a2 = FS.mknod(e, r2, 0), s2 = true;
      if (!a2) throw new FS.ErrnoError(44);
      if (FS.isChrdev(a2.mode) && (t &= -513), t & 65536 && !FS.isDir(a2.mode)) throw new FS.ErrnoError(54);
      if (!s2) {
        var l2 = FS.mayOpen(a2, t);
        if (l2) throw new FS.ErrnoError(l2);
      }
      t & 512 && !s2 && FS.truncate(a2, 0), t &= -131713;
      var n2 = FS.createStream({ node: a2, path: FS.getPath(a2), flags: t, seekable: true, position: 0, stream_ops: a2.stream_ops, ungotten: [], error: false });
      return n2.stream_ops.open && n2.stream_ops.open(n2), Module.logReadFiles && !(t & 1) && (e in FS.readFiles || (FS.readFiles[e] = 1)), n2;
    }, close(e) {
      if (FS.isClosed(e)) throw new FS.ErrnoError(8);
      e.getdents && (e.getdents = null);
      try {
        e.stream_ops.close && e.stream_ops.close(e);
      } catch (t) {
        throw t;
      } finally {
        FS.closeStream(e.fd);
      }
      e.fd = null;
    }, isClosed(e) {
      return e.fd === null;
    }, llseek(e, t, r2) {
      if (FS.isClosed(e)) throw new FS.ErrnoError(8);
      if (!e.seekable || !e.stream_ops.llseek) throw new FS.ErrnoError(70);
      if (r2 != 0 && r2 != 1 && r2 != 2) throw new FS.ErrnoError(28);
      return e.position = e.stream_ops.llseek(e, t, r2), e.ungotten = [], e.position;
    }, read(e, t, r2, a2, o2) {
      if (a2 < 0 || o2 < 0) throw new FS.ErrnoError(28);
      if (FS.isClosed(e)) throw new FS.ErrnoError(8);
      if ((e.flags & 2097155) === 1) throw new FS.ErrnoError(8);
      if (FS.isDir(e.node.mode)) throw new FS.ErrnoError(31);
      if (!e.stream_ops.read) throw new FS.ErrnoError(28);
      var s2 = typeof o2 < "u";
      if (!s2) o2 = e.position;
      else if (!e.seekable) throw new FS.ErrnoError(70);
      var l2 = e.stream_ops.read(e, t, r2, a2, o2);
      return s2 || (e.position += l2), l2;
    }, write(e, t, r2, a2, o2, s2) {
      if (a2 < 0 || o2 < 0) throw new FS.ErrnoError(28);
      if (FS.isClosed(e)) throw new FS.ErrnoError(8);
      if (!(e.flags & 2097155)) throw new FS.ErrnoError(8);
      if (FS.isDir(e.node.mode)) throw new FS.ErrnoError(31);
      if (!e.stream_ops.write) throw new FS.ErrnoError(28);
      e.seekable && e.flags & 1024 && FS.llseek(e, 0, 2);
      var l2 = typeof o2 < "u";
      if (!l2) o2 = e.position;
      else if (!e.seekable) throw new FS.ErrnoError(70);
      var n2 = e.stream_ops.write(e, t, r2, a2, o2, s2);
      return l2 || (e.position += n2), n2;
    }, allocate(e, t, r2) {
      if (FS.isClosed(e)) throw new FS.ErrnoError(8);
      if (t < 0 || r2 <= 0) throw new FS.ErrnoError(28);
      if (!(e.flags & 2097155)) throw new FS.ErrnoError(8);
      if (!FS.isFile(e.node.mode) && !FS.isDir(e.node.mode)) throw new FS.ErrnoError(43);
      if (!e.stream_ops.allocate) throw new FS.ErrnoError(138);
      e.stream_ops.allocate(e, t, r2);
    }, mmap(e, t, r2, a2, o2) {
      if (a2 & 2 && !(o2 & 2) && (e.flags & 2097155) !== 2) throw new FS.ErrnoError(2);
      if ((e.flags & 2097155) === 1) throw new FS.ErrnoError(2);
      if (!e.stream_ops.mmap) throw new FS.ErrnoError(43);
      if (!t) throw new FS.ErrnoError(28);
      return e.stream_ops.mmap(e, t, r2, a2, o2);
    }, msync(e, t, r2, a2, o2) {
      return e.stream_ops.msync ? e.stream_ops.msync(e, t, r2, a2, o2) : 0;
    }, ioctl(e, t, r2) {
      if (!e.stream_ops.ioctl) throw new FS.ErrnoError(59);
      return e.stream_ops.ioctl(e, t, r2);
    }, readFile(e, t = {}) {
      if (t.flags = t.flags || 0, t.encoding = t.encoding || "binary", t.encoding !== "utf8" && t.encoding !== "binary") throw new Error(`Invalid encoding type "${t.encoding}"`);
      var r2, a2 = FS.open(e, t.flags), o2 = FS.stat(e), s2 = o2.size, l2 = new Uint8Array(s2);
      return FS.read(a2, l2, 0, s2, 0), t.encoding === "utf8" ? r2 = UTF8ArrayToString(l2) : t.encoding === "binary" && (r2 = l2), FS.close(a2), r2;
    }, writeFile(e, t, r2 = {}) {
      r2.flags = r2.flags || 577;
      var a2 = FS.open(e, r2.flags, r2.mode);
      if (typeof t == "string") {
        var o2 = new Uint8Array(lengthBytesUTF8(t) + 1), s2 = stringToUTF8Array(t, o2, 0, o2.length);
        FS.write(a2, o2, 0, s2, void 0, r2.canOwn);
      } else if (ArrayBuffer.isView(t)) FS.write(a2, t, 0, t.byteLength, void 0, r2.canOwn);
      else throw new Error("Unsupported data type");
      FS.close(a2);
    }, cwd: () => FS.currentPath, chdir(e) {
      var t = FS.lookupPath(e, { follow: true });
      if (t.node === null) throw new FS.ErrnoError(44);
      if (!FS.isDir(t.node.mode)) throw new FS.ErrnoError(54);
      var r2 = FS.nodePermissions(t.node, "x");
      if (r2) throw new FS.ErrnoError(r2);
      FS.currentPath = t.path;
    }, createDefaultDirectories() {
      FS.mkdir("/tmp"), FS.mkdir("/home"), FS.mkdir("/home/web_user");
    }, createDefaultDevices() {
      FS.mkdir("/dev"), FS.registerDevice(FS.makedev(1, 3), { read: () => 0, write: (a2, o2, s2, l2, n2) => l2, llseek: () => 0 }), FS.mkdev("/dev/null", FS.makedev(1, 3)), TTY.register(FS.makedev(5, 0), TTY.default_tty_ops), TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops), FS.mkdev("/dev/tty", FS.makedev(5, 0)), FS.mkdev("/dev/tty1", FS.makedev(6, 0));
      var e = new Uint8Array(1024), t = 0, r2 = () => (t === 0 && (t = randomFill(e).byteLength), e[--t]);
      FS.createDevice("/dev", "random", r2), FS.createDevice("/dev", "urandom", r2), FS.mkdir("/dev/shm"), FS.mkdir("/dev/shm/tmp");
    }, createSpecialDirectories() {
      FS.mkdir("/proc");
      var e = FS.mkdir("/proc/self");
      FS.mkdir("/proc/self/fd"), FS.mount({ mount() {
        var t = FS.createNode(e, "fd", 16895, 73);
        return t.stream_ops = { llseek: MEMFS.stream_ops.llseek }, t.node_ops = { lookup(r2, a2) {
          var o2 = +a2, s2 = FS.getStreamChecked(o2), l2 = { parent: null, mount: { mountpoint: "fake" }, node_ops: { readlink: () => s2.path }, id: o2 + 1 };
          return l2.parent = l2, l2;
        }, readdir() {
          return Array.from(FS.streams.entries()).filter(([r2, a2]) => a2).map(([r2, a2]) => r2.toString());
        } }, t;
      } }, {}, "/proc/self/fd");
    }, createStandardStreams(e, t, r2) {
      e ? FS.createDevice("/dev", "stdin", e) : FS.symlink("/dev/tty", "/dev/stdin"), t ? FS.createDevice("/dev", "stdout", null, t) : FS.symlink("/dev/tty", "/dev/stdout"), r2 ? FS.createDevice("/dev", "stderr", null, r2) : FS.symlink("/dev/tty1", "/dev/stderr");
      FS.open("/dev/stdin", 0);
      FS.open("/dev/stdout", 1);
      FS.open("/dev/stderr", 1);
    }, staticInit() {
      FS.nameTable = new Array(4096), FS.mount(MEMFS, {}, "/"), FS.createDefaultDirectories(), FS.createDefaultDevices(), FS.createSpecialDirectories(), FS.filesystems = { MEMFS, IDBFS, NODEFS };
    }, init(e, t, r2) {
      FS.initialized = true, e ?? (e = Module.stdin), t ?? (t = Module.stdout), r2 ?? (r2 = Module.stderr), FS.createStandardStreams(e, t, r2);
    }, quit() {
      FS.initialized = false, _fflush(0);
      for (var e = 0; e < FS.streams.length; e++) {
        var t = FS.streams[e];
        t && FS.close(t);
      }
    }, findObject(e, t) {
      var r2 = FS.analyzePath(e, t);
      return r2.exists ? r2.object : null;
    }, analyzePath(e, t) {
      try {
        var r2 = FS.lookupPath(e, { follow: !t });
        e = r2.path;
      } catch {
      }
      var a2 = { isRoot: false, exists: false, error: 0, name: null, path: null, object: null, parentExists: false, parentPath: null, parentObject: null };
      try {
        var r2 = FS.lookupPath(e, { parent: true });
        a2.parentExists = true, a2.parentPath = r2.path, a2.parentObject = r2.node, a2.name = PATH.basename(e), r2 = FS.lookupPath(e, { follow: !t }), a2.exists = true, a2.path = r2.path, a2.object = r2.node, a2.name = r2.node.name, a2.isRoot = r2.path === "/";
      } catch (o2) {
        a2.error = o2.errno;
      }
      return a2;
    }, createPath(e, t, r2, a2) {
      e = typeof e == "string" ? e : FS.getPath(e);
      for (var o2 = t.split("/").reverse(); o2.length; ) {
        var s2 = o2.pop();
        if (s2) {
          var l2 = PATH.join2(e, s2);
          try {
            FS.mkdir(l2);
          } catch {
          }
          e = l2;
        }
      }
      return l2;
    }, createFile(e, t, r2, a2, o2) {
      var s2 = PATH.join2(typeof e == "string" ? e : FS.getPath(e), t), l2 = FS_getMode(a2, o2);
      return FS.create(s2, l2);
    }, createDataFile(e, t, r2, a2, o2, s2) {
      var l2 = t;
      e && (e = typeof e == "string" ? e : FS.getPath(e), l2 = t ? PATH.join2(e, t) : e);
      var n2 = FS_getMode(a2, o2), _2 = FS.create(l2, n2);
      if (r2) {
        if (typeof r2 == "string") {
          for (var m2 = new Array(r2.length), p2 = 0, d2 = r2.length; p2 < d2; ++p2) m2[p2] = r2.charCodeAt(p2);
          r2 = m2;
        }
        FS.chmod(_2, n2 | 146);
        var g2 = FS.open(_2, 577);
        FS.write(g2, r2, 0, r2.length, 0, s2), FS.close(g2), FS.chmod(_2, n2);
      }
    }, createDevice(e, t, r2, a2) {
      var n2;
      var o2 = PATH.join2(typeof e == "string" ? e : FS.getPath(e), t), s2 = FS_getMode(!!r2, !!a2);
      (n2 = FS.createDevice).major ?? (n2.major = 64);
      var l2 = FS.makedev(FS.createDevice.major++, 0);
      return FS.registerDevice(l2, { open(_2) {
        _2.seekable = false;
      }, close(_2) {
        a2?.buffer?.length && a2(10);
      }, read(_2, m2, p2, d2, g2) {
        for (var c2 = 0, f2 = 0; f2 < d2; f2++) {
          var u2;
          try {
            u2 = r2();
          } catch {
            throw new FS.ErrnoError(29);
          }
          if (u2 === void 0 && c2 === 0) throw new FS.ErrnoError(6);
          if (u2 == null) break;
          c2++, m2[p2 + f2] = u2;
        }
        return c2 && (_2.node.atime = Date.now()), c2;
      }, write(_2, m2, p2, d2, g2) {
        for (var c2 = 0; c2 < d2; c2++) try {
          a2(m2[p2 + c2]);
        } catch {
          throw new FS.ErrnoError(29);
        }
        return d2 && (_2.node.mtime = _2.node.ctime = Date.now()), c2;
      } }), FS.mkdev(o2, s2, l2);
    }, forceLoadFile(e) {
      if (e.isDevice || e.isFolder || e.link || e.contents) return true;
      if (typeof XMLHttpRequest < "u") throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
      try {
        e.contents = readBinary(e.url), e.usedBytes = e.contents.length;
      } catch {
        throw new FS.ErrnoError(29);
      }
    }, createLazyFile(e, t, r2, a2, o2) {
      class s2 {
        constructor() {
          P$1(this, "lengthKnown", false);
          P$1(this, "chunks", []);
        }
        get(c2) {
          if (!(c2 > this.length - 1 || c2 < 0)) {
            var f2 = c2 % this.chunkSize, u2 = c2 / this.chunkSize | 0;
            return this.getter(u2)[f2];
          }
        }
        setDataGetter(c2) {
          this.getter = c2;
        }
        cacheLength() {
          var c2 = new XMLHttpRequest();
          if (c2.open("HEAD", r2, false), c2.send(null), !(c2.status >= 200 && c2.status < 300 || c2.status === 304)) throw new Error("Couldn't load " + r2 + ". Status: " + c2.status);
          var f2 = Number(c2.getResponseHeader("Content-length")), u2, w2 = (u2 = c2.getResponseHeader("Accept-Ranges")) && u2 === "bytes", h2 = (u2 = c2.getResponseHeader("Content-Encoding")) && u2 === "gzip", S2 = 1024 * 1024;
          w2 || (S2 = f2);
          var M2 = (x2, E2) => {
            if (x2 > E2) throw new Error("invalid range (" + x2 + ", " + E2 + ") or no bytes requested!");
            if (E2 > f2 - 1) throw new Error("only " + f2 + " bytes available! programmer error!");
            var b2 = new XMLHttpRequest();
            if (b2.open("GET", r2, false), f2 !== S2 && b2.setRequestHeader("Range", "bytes=" + x2 + "-" + E2), b2.responseType = "arraybuffer", b2.overrideMimeType && b2.overrideMimeType("text/plain; charset=x-user-defined"), b2.send(null), !(b2.status >= 200 && b2.status < 300 || b2.status === 304)) throw new Error("Couldn't load " + r2 + ". Status: " + b2.status);
            return b2.response !== void 0 ? new Uint8Array(b2.response || []) : intArrayFromString(b2.responseText || "");
          }, y2 = this;
          y2.setDataGetter((x2) => {
            var E2 = x2 * S2, b2 = (x2 + 1) * S2 - 1;
            if (b2 = Math.min(b2, f2 - 1), typeof y2.chunks[x2] > "u" && (y2.chunks[x2] = M2(E2, b2)), typeof y2.chunks[x2] > "u") throw new Error("doXHR failed!");
            return y2.chunks[x2];
          }), (h2 || !f2) && (S2 = f2 = 1, f2 = this.getter(0).length, S2 = f2, out("LazyFiles on gzip forces download of the whole file when length is accessed")), this._length = f2, this._chunkSize = S2, this.lengthKnown = true;
        }
        get length() {
          return this.lengthKnown || this.cacheLength(), this._length;
        }
        get chunkSize() {
          return this.lengthKnown || this.cacheLength(), this._chunkSize;
        }
      }
      if (typeof XMLHttpRequest < "u") {
        if (!ENVIRONMENT_IS_WORKER) throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
        var l2 = new s2(), n2 = { isDevice: false, contents: l2 };
      } else var n2 = { isDevice: false, url: r2 };
      var _2 = FS.createFile(e, t, n2, a2, o2);
      n2.contents ? _2.contents = n2.contents : n2.url && (_2.contents = null, _2.url = n2.url), Object.defineProperties(_2, { usedBytes: { get: function() {
        return this.contents.length;
      } } });
      var m2 = {}, p2 = Object.keys(_2.stream_ops);
      p2.forEach((g2) => {
        var c2 = _2.stream_ops[g2];
        m2[g2] = (...f2) => (FS.forceLoadFile(_2), c2(...f2));
      });
      function d2(g2, c2, f2, u2, w2) {
        var h2 = g2.node.contents;
        if (w2 >= h2.length) return 0;
        var S2 = Math.min(h2.length - w2, u2);
        if (h2.slice) for (var M2 = 0; M2 < S2; M2++) c2[f2 + M2] = h2[w2 + M2];
        else for (var M2 = 0; M2 < S2; M2++) c2[f2 + M2] = h2.get(w2 + M2);
        return S2;
      }
      return m2.read = (g2, c2, f2, u2, w2) => (FS.forceLoadFile(_2), d2(g2, c2, f2, u2, w2)), m2.mmap = (g2, c2, f2, u2, w2) => {
        FS.forceLoadFile(_2);
        var h2 = mmapAlloc(c2);
        if (!h2) throw new FS.ErrnoError(48);
        return d2(g2, HEAP8, h2, c2, f2), { ptr: h2, allocated: true };
      }, _2.stream_ops = m2, _2;
    } }, SYSCALLS = { DEFAULT_POLLMASK: 5, calculateAt(e, t, r2) {
      if (PATH.isAbs(t)) return t;
      var a2;
      if (e === -100) a2 = FS.cwd();
      else {
        var o2 = SYSCALLS.getStreamFromFD(e);
        a2 = o2.path;
      }
      if (t.length == 0) {
        if (!r2) throw new FS.ErrnoError(44);
        return a2;
      }
      return a2 + "/" + t;
    }, doStat(e, t, r2) {
      var a2 = e(t);
      HEAP32[r2 >> 2] = a2.dev, HEAP32[r2 + 4 >> 2] = a2.mode, HEAPU32[r2 + 8 >> 2] = a2.nlink, HEAP32[r2 + 12 >> 2] = a2.uid, HEAP32[r2 + 16 >> 2] = a2.gid, HEAP32[r2 + 20 >> 2] = a2.rdev, HEAP64[r2 + 24 >> 3] = BigInt(a2.size), HEAP32[r2 + 32 >> 2] = 4096, HEAP32[r2 + 36 >> 2] = a2.blocks;
      var o2 = a2.atime.getTime(), s2 = a2.mtime.getTime(), l2 = a2.ctime.getTime();
      return HEAP64[r2 + 40 >> 3] = BigInt(Math.floor(o2 / 1e3)), HEAPU32[r2 + 48 >> 2] = o2 % 1e3 * 1e3 * 1e3, HEAP64[r2 + 56 >> 3] = BigInt(Math.floor(s2 / 1e3)), HEAPU32[r2 + 64 >> 2] = s2 % 1e3 * 1e3 * 1e3, HEAP64[r2 + 72 >> 3] = BigInt(Math.floor(l2 / 1e3)), HEAPU32[r2 + 80 >> 2] = l2 % 1e3 * 1e3 * 1e3, HEAP64[r2 + 88 >> 3] = BigInt(a2.ino), 0;
    }, doMsync(e, t, r2, a2, o2) {
      if (!FS.isFile(t.node.mode)) throw new FS.ErrnoError(43);
      if (a2 & 2) return 0;
      var s2 = HEAPU8.slice(e, e + r2);
      FS.msync(t, s2, o2, r2, a2);
    }, getStreamFromFD(e) {
      var t = FS.getStreamChecked(e);
      return t;
    }, varargs: void 0, getStr(e) {
      var t = UTF8ToString(e);
      return t;
    } }, ___syscall__newselect = function(e, t, r2, a2, o2) {
      try {
        for (var s2 = 0, l2 = t ? HEAP32[t >> 2] : 0, n2 = t ? HEAP32[t + 4 >> 2] : 0, _2 = r2 ? HEAP32[r2 >> 2] : 0, m2 = r2 ? HEAP32[r2 + 4 >> 2] : 0, p2 = a2 ? HEAP32[a2 >> 2] : 0, d2 = a2 ? HEAP32[a2 + 4 >> 2] : 0, g2 = 0, c2 = 0, f2 = 0, u2 = 0, w2 = 0, h2 = 0, S2 = (t ? HEAP32[t >> 2] : 0) | (r2 ? HEAP32[r2 >> 2] : 0) | (a2 ? HEAP32[a2 >> 2] : 0), M2 = (t ? HEAP32[t + 4 >> 2] : 0) | (r2 ? HEAP32[r2 + 4 >> 2] : 0) | (a2 ? HEAP32[a2 + 4 >> 2] : 0), y2 = (z3, P2, U2, A2) => z3 < 32 ? P2 & A2 : U2 & A2, x2 = 0; x2 < e; x2++) {
          var E2 = 1 << x2 % 32;
          if (y2(x2, S2, M2, E2)) {
            var b2 = SYSCALLS.getStreamFromFD(x2), T2 = SYSCALLS.DEFAULT_POLLMASK;
            if (b2.stream_ops.poll) {
              var D2 = -1;
              if (o2) {
                var X2 = t ? HEAP32[o2 >> 2] : 0, R3 = t ? HEAP32[o2 + 4 >> 2] : 0;
                D2 = (X2 + R3 / 1e6) * 1e3;
              }
              T2 = b2.stream_ops.poll(b2, D2);
            }
            T2 & 1 && y2(x2, l2, n2, E2) && (x2 < 32 ? g2 = g2 | E2 : c2 = c2 | E2, s2++), T2 & 4 && y2(x2, _2, m2, E2) && (x2 < 32 ? f2 = f2 | E2 : u2 = u2 | E2, s2++), T2 & 2 && y2(x2, p2, d2, E2) && (x2 < 32 ? w2 = w2 | E2 : h2 = h2 | E2, s2++);
          }
        }
        return t && (HEAP32[t >> 2] = g2, HEAP32[t + 4 >> 2] = c2), r2 && (HEAP32[r2 >> 2] = f2, HEAP32[r2 + 4 >> 2] = u2), a2 && (HEAP32[a2 >> 2] = w2, HEAP32[a2 + 4 >> 2] = h2), s2;
      } catch (z3) {
        if (typeof FS > "u" || z3.name !== "ErrnoError") throw z3;
        return -z3.errno;
      }
    };
    ___syscall__newselect.sig = "iipppp";
    var SOCKFS = { websocketArgs: {}, callbacks: {}, on(e, t) {
      SOCKFS.callbacks[e] = t;
    }, emit(e, t) {
      SOCKFS.callbacks[e]?.(t);
    }, mount(e) {
      return SOCKFS.websocketArgs = Module.websocket || {}, (Module.websocket ?? (Module.websocket = {})).on = SOCKFS.on, FS.createNode(null, "/", 16895, 0);
    }, createSocket(e, t, r2) {
      t &= -526337;
      var a2 = t == 1;
      if (a2 && r2 && r2 != 6) throw new FS.ErrnoError(66);
      var o2 = { family: e, type: t, protocol: r2, server: null, error: null, peers: {}, pending: [], recv_queue: [], sock_ops: SOCKFS.websocket_sock_ops }, s2 = SOCKFS.nextname(), l2 = FS.createNode(SOCKFS.root, s2, 49152, 0);
      l2.sock = o2;
      var n2 = FS.createStream({ path: s2, node: l2, flags: 2, seekable: false, stream_ops: SOCKFS.stream_ops });
      return o2.stream = n2, o2;
    }, getSocket(e) {
      var t = FS.getStream(e);
      return !t || !FS.isSocket(t.node.mode) ? null : t.node.sock;
    }, stream_ops: { poll(e) {
      var t = e.node.sock;
      return t.sock_ops.poll(t);
    }, ioctl(e, t, r2) {
      var a2 = e.node.sock;
      return a2.sock_ops.ioctl(a2, t, r2);
    }, read(e, t, r2, a2, o2) {
      var s2 = e.node.sock, l2 = s2.sock_ops.recvmsg(s2, a2);
      return l2 ? (t.set(l2.buffer, r2), l2.buffer.length) : 0;
    }, write(e, t, r2, a2, o2) {
      var s2 = e.node.sock;
      return s2.sock_ops.sendmsg(s2, t, r2, a2);
    }, close(e) {
      var t = e.node.sock;
      t.sock_ops.close(t);
    } }, nextname() {
      return SOCKFS.nextname.current || (SOCKFS.nextname.current = 0), `socket[${SOCKFS.nextname.current++}]`;
    }, websocket_sock_ops: { createPeer(e, t, r2) {
      var a2;
      if (typeof t == "object" && (a2 = t, t = null, r2 = null), a2) if (a2._socket) t = a2._socket.remoteAddress, r2 = a2._socket.remotePort;
      else {
        var o2 = /ws[s]?:\/\/([^:]+):(\d+)/.exec(a2.url);
        if (!o2) throw new Error("WebSocket URL must be in the format ws(s)://address:port");
        t = o2[1], r2 = parseInt(o2[2], 10);
      }
      else try {
        var s2 = "ws:#".replace("#", "//"), l2 = "binary", n2 = void 0;
        if (SOCKFS.websocketArgs.url && (s2 = SOCKFS.websocketArgs.url), SOCKFS.websocketArgs.subprotocol ? l2 = SOCKFS.websocketArgs.subprotocol : SOCKFS.websocketArgs.subprotocol === null && (l2 = "null"), s2 === "ws://" || s2 === "wss://") {
          var _2 = t.split("/");
          s2 = s2 + _2[0] + ":" + r2 + "/" + _2.slice(1).join("/");
        }
        l2 !== "null" && (l2 = l2.replace(/^ +| +$/g, "").split(/ *, */), n2 = l2);
        var m2;
        ENVIRONMENT_IS_NODE ? m2 = require("ws") : m2 = WebSocket, a2 = new m2(s2, n2), a2.binaryType = "arraybuffer";
      } catch {
        throw new FS.ErrnoError(23);
      }
      var p2 = { addr: t, port: r2, socket: a2, msg_send_queue: [] };
      return SOCKFS.websocket_sock_ops.addPeer(e, p2), SOCKFS.websocket_sock_ops.handlePeerEvents(e, p2), e.type === 2 && typeof e.sport < "u" && p2.msg_send_queue.push(new Uint8Array([255, 255, 255, 255, 112, 111, 114, 116, (e.sport & 65280) >> 8, e.sport & 255])), p2;
    }, getPeer(e, t, r2) {
      return e.peers[t + ":" + r2];
    }, addPeer(e, t) {
      e.peers[t.addr + ":" + t.port] = t;
    }, removePeer(e, t) {
      delete e.peers[t.addr + ":" + t.port];
    }, handlePeerEvents(e, t) {
      var r2 = true, a2 = function() {
        e.connecting = false, SOCKFS.emit("open", e.stream.fd);
        try {
          for (var s2 = t.msg_send_queue.shift(); s2; ) t.socket.send(s2), s2 = t.msg_send_queue.shift();
        } catch {
          t.socket.close();
        }
      };
      function o2(s2) {
        if (typeof s2 == "string") {
          var l2 = new TextEncoder();
          s2 = l2.encode(s2);
        } else {
          if (assert(s2.byteLength !== void 0), s2.byteLength == 0) return;
          s2 = new Uint8Array(s2);
        }
        var n2 = r2;
        if (r2 = false, n2 && s2.length === 10 && s2[0] === 255 && s2[1] === 255 && s2[2] === 255 && s2[3] === 255 && s2[4] === 112 && s2[5] === 111 && s2[6] === 114 && s2[7] === 116) {
          var _2 = s2[8] << 8 | s2[9];
          SOCKFS.websocket_sock_ops.removePeer(e, t), t.port = _2, SOCKFS.websocket_sock_ops.addPeer(e, t);
          return;
        }
        e.recv_queue.push({ addr: t.addr, port: t.port, data: s2 }), SOCKFS.emit("message", e.stream.fd);
      }
      ENVIRONMENT_IS_NODE ? (t.socket.on("open", a2), t.socket.on("message", function(s2, l2) {
        l2 && o2(new Uint8Array(s2).buffer);
      }), t.socket.on("close", function() {
        SOCKFS.emit("close", e.stream.fd);
      }), t.socket.on("error", function(s2) {
        e.error = 14, SOCKFS.emit("error", [e.stream.fd, e.error, "ECONNREFUSED: Connection refused"]);
      })) : (t.socket.onopen = a2, t.socket.onclose = function() {
        SOCKFS.emit("close", e.stream.fd);
      }, t.socket.onmessage = function(l2) {
        o2(l2.data);
      }, t.socket.onerror = function(s2) {
        e.error = 14, SOCKFS.emit("error", [e.stream.fd, e.error, "ECONNREFUSED: Connection refused"]);
      });
    }, poll(e) {
      if (e.type === 1 && e.server) return e.pending.length ? 65 : 0;
      var t = 0, r2 = e.type === 1 ? SOCKFS.websocket_sock_ops.getPeer(e, e.daddr, e.dport) : null;
      return (e.recv_queue.length || !r2 || r2 && r2.socket.readyState === r2.socket.CLOSING || r2 && r2.socket.readyState === r2.socket.CLOSED) && (t |= 65), (!r2 || r2 && r2.socket.readyState === r2.socket.OPEN) && (t |= 4), (r2 && r2.socket.readyState === r2.socket.CLOSING || r2 && r2.socket.readyState === r2.socket.CLOSED) && (e.connecting ? t |= 4 : t |= 16), t;
    }, ioctl(e, t, r2) {
      switch (t) {
        case 21531:
          var a2 = 0;
          return e.recv_queue.length && (a2 = e.recv_queue[0].data.length), HEAP32[r2 >> 2] = a2, 0;
        default:
          return 28;
      }
    }, close(e) {
      if (e.server) {
        try {
          e.server.close();
        } catch {
        }
        e.server = null;
      }
      for (var t = Object.keys(e.peers), r2 = 0; r2 < t.length; r2++) {
        var a2 = e.peers[t[r2]];
        try {
          a2.socket.close();
        } catch {
        }
        SOCKFS.websocket_sock_ops.removePeer(e, a2);
      }
      return 0;
    }, bind(e, t, r2) {
      if (typeof e.saddr < "u" || typeof e.sport < "u") throw new FS.ErrnoError(28);
      if (e.saddr = t, e.sport = r2, e.type === 2) {
        e.server && (e.server.close(), e.server = null);
        try {
          e.sock_ops.listen(e, 0);
        } catch (a2) {
          if (a2.name !== "ErrnoError" || a2.errno !== 138) throw a2;
        }
      }
    }, connect(e, t, r2) {
      if (e.server) throw new FS.ErrnoError(138);
      if (typeof e.daddr < "u" && typeof e.dport < "u") {
        var a2 = SOCKFS.websocket_sock_ops.getPeer(e, e.daddr, e.dport);
        if (a2) throw a2.socket.readyState === a2.socket.CONNECTING ? new FS.ErrnoError(7) : new FS.ErrnoError(30);
      }
      var o2 = SOCKFS.websocket_sock_ops.createPeer(e, t, r2);
      e.daddr = o2.addr, e.dport = o2.port, e.connecting = true;
    }, listen(e, t) {
      if (!ENVIRONMENT_IS_NODE) throw new FS.ErrnoError(138);
      if (e.server) throw new FS.ErrnoError(28);
      var r2 = require("ws").Server, a2 = e.saddr;
      e.server = new r2({ host: a2, port: e.sport }), SOCKFS.emit("listen", e.stream.fd), e.server.on("connection", function(o2) {
        if (e.type === 1) {
          var s2 = SOCKFS.createSocket(e.family, e.type, e.protocol), l2 = SOCKFS.websocket_sock_ops.createPeer(s2, o2);
          s2.daddr = l2.addr, s2.dport = l2.port, e.pending.push(s2), SOCKFS.emit("connection", s2.stream.fd);
        } else SOCKFS.websocket_sock_ops.createPeer(e, o2), SOCKFS.emit("connection", e.stream.fd);
      }), e.server.on("close", function() {
        SOCKFS.emit("close", e.stream.fd), e.server = null;
      }), e.server.on("error", function(o2) {
        e.error = 23, SOCKFS.emit("error", [e.stream.fd, e.error, "EHOSTUNREACH: Host is unreachable"]);
      });
    }, accept(e) {
      if (!e.server || !e.pending.length) throw new FS.ErrnoError(28);
      var t = e.pending.shift();
      return t.stream.flags = e.stream.flags, t;
    }, getname(e, t) {
      var r2, a2;
      if (t) {
        if (e.daddr === void 0 || e.dport === void 0) throw new FS.ErrnoError(53);
        r2 = e.daddr, a2 = e.dport;
      } else r2 = e.saddr || 0, a2 = e.sport || 0;
      return { addr: r2, port: a2 };
    }, sendmsg(e, t, r2, a2, o2, s2) {
      if (e.type === 2) {
        if ((o2 === void 0 || s2 === void 0) && (o2 = e.daddr, s2 = e.dport), o2 === void 0 || s2 === void 0) throw new FS.ErrnoError(17);
      } else o2 = e.daddr, s2 = e.dport;
      var l2 = SOCKFS.websocket_sock_ops.getPeer(e, o2, s2);
      if (e.type === 1 && (!l2 || l2.socket.readyState === l2.socket.CLOSING || l2.socket.readyState === l2.socket.CLOSED)) throw new FS.ErrnoError(53);
      ArrayBuffer.isView(t) && (r2 += t.byteOffset, t = t.buffer);
      var n2 = t.slice(r2, r2 + a2);
      if (!l2 || l2.socket.readyState !== l2.socket.OPEN) return e.type === 2 && (!l2 || l2.socket.readyState === l2.socket.CLOSING || l2.socket.readyState === l2.socket.CLOSED) && (l2 = SOCKFS.websocket_sock_ops.createPeer(e, o2, s2)), l2.msg_send_queue.push(n2), a2;
      try {
        return l2.socket.send(n2), a2;
      } catch {
        throw new FS.ErrnoError(28);
      }
    }, recvmsg(e, t) {
      if (e.type === 1 && e.server) throw new FS.ErrnoError(53);
      var r2 = e.recv_queue.shift();
      if (!r2) {
        if (e.type === 1) {
          var a2 = SOCKFS.websocket_sock_ops.getPeer(e, e.daddr, e.dport);
          if (!a2) throw new FS.ErrnoError(53);
          if (a2.socket.readyState === a2.socket.CLOSING || a2.socket.readyState === a2.socket.CLOSED) return null;
          throw new FS.ErrnoError(6);
        }
        throw new FS.ErrnoError(6);
      }
      var o2 = r2.data.byteLength || r2.data.length, s2 = r2.data.byteOffset || 0, l2 = r2.data.buffer || r2.data, n2 = Math.min(t, o2), _2 = { buffer: new Uint8Array(l2, s2, n2), addr: r2.addr, port: r2.port };
      if (e.type === 1 && n2 < o2) {
        var m2 = o2 - n2;
        r2.data = new Uint8Array(l2, s2 + n2, m2), e.recv_queue.unshift(r2);
      }
      return _2;
    } } }, getSocketFromFD = (e) => {
      var t = SOCKFS.getSocket(e);
      if (!t) throw new FS.ErrnoError(8);
      return t;
    }, inetNtop4 = (e) => (e & 255) + "." + (e >> 8 & 255) + "." + (e >> 16 & 255) + "." + (e >> 24 & 255), inetNtop6 = (e) => {
      var t = "", r2 = 0, a2 = 0, o2 = 0, s2 = 0, l2 = 0, n2 = 0, _2 = [e[0] & 65535, e[0] >> 16, e[1] & 65535, e[1] >> 16, e[2] & 65535, e[2] >> 16, e[3] & 65535, e[3] >> 16], m2 = true, p2 = "";
      for (n2 = 0; n2 < 5; n2++) if (_2[n2] !== 0) {
        m2 = false;
        break;
      }
      if (m2) {
        if (p2 = inetNtop4(_2[6] | _2[7] << 16), _2[5] === -1) return t = "::ffff:", t += p2, t;
        if (_2[5] === 0) return t = "::", p2 === "0.0.0.0" && (p2 = ""), p2 === "0.0.0.1" && (p2 = "1"), t += p2, t;
      }
      for (r2 = 0; r2 < 8; r2++) _2[r2] === 0 && (r2 - o2 > 1 && (l2 = 0), o2 = r2, l2++), l2 > a2 && (a2 = l2, s2 = r2 - a2 + 1);
      for (r2 = 0; r2 < 8; r2++) {
        if (a2 > 1 && _2[r2] === 0 && r2 >= s2 && r2 < s2 + a2) {
          r2 === s2 && (t += ":", s2 === 0 && (t += ":"));
          continue;
        }
        t += Number(_ntohs(_2[r2] & 65535)).toString(16), t += r2 < 7 ? ":" : "";
      }
      return t;
    }, readSockaddr = (e, t) => {
      var r2 = HEAP16[e >> 1], a2 = _ntohs(HEAPU16[e + 2 >> 1]), o2;
      switch (r2) {
        case 2:
          if (t !== 16) return { errno: 28 };
          o2 = HEAP32[e + 4 >> 2], o2 = inetNtop4(o2);
          break;
        case 10:
          if (t !== 28) return { errno: 28 };
          o2 = [HEAP32[e + 8 >> 2], HEAP32[e + 12 >> 2], HEAP32[e + 16 >> 2], HEAP32[e + 20 >> 2]], o2 = inetNtop6(o2);
          break;
        default:
          return { errno: 5 };
      }
      return { family: r2, addr: o2, port: a2 };
    }, inetPton4 = (e) => {
      for (var t = e.split("."), r2 = 0; r2 < 4; r2++) {
        var a2 = Number(t[r2]);
        if (isNaN(a2)) return null;
        t[r2] = a2;
      }
      return (t[0] | t[1] << 8 | t[2] << 16 | t[3] << 24) >>> 0;
    }, jstoi_q = (e) => parseInt(e), inetPton6 = (e) => {
      var t, r2, a2, o2, s2 = /^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i, l2 = [];
      if (!s2.test(e)) return null;
      if (e === "::") return [0, 0, 0, 0, 0, 0, 0, 0];
      for (e.startsWith("::") ? e = e.replace("::", "Z:") : e = e.replace("::", ":Z:"), e.indexOf(".") > 0 ? (e = e.replace(new RegExp("[.]", "g"), ":"), t = e.split(":"), t[t.length - 4] = jstoi_q(t[t.length - 4]) + jstoi_q(t[t.length - 3]) * 256, t[t.length - 3] = jstoi_q(t[t.length - 2]) + jstoi_q(t[t.length - 1]) * 256, t = t.slice(0, t.length - 2)) : t = e.split(":"), a2 = 0, o2 = 0, r2 = 0; r2 < t.length; r2++) if (typeof t[r2] == "string") if (t[r2] === "Z") {
        for (o2 = 0; o2 < 8 - t.length + 1; o2++) l2[r2 + o2] = 0;
        a2 = o2 - 1;
      } else l2[r2 + a2] = _htons(parseInt(t[r2], 16));
      else l2[r2 + a2] = t[r2];
      return [l2[1] << 16 | l2[0], l2[3] << 16 | l2[2], l2[5] << 16 | l2[4], l2[7] << 16 | l2[6]];
    }, DNS = { address_map: { id: 1, addrs: {}, names: {} }, lookup_name(e) {
      var t = inetPton4(e);
      if (t !== null || (t = inetPton6(e), t !== null)) return e;
      var r2;
      if (DNS.address_map.addrs[e]) r2 = DNS.address_map.addrs[e];
      else {
        var a2 = DNS.address_map.id++;
        assert(a2 < 65535, "exceeded max address mappings of 65535"), r2 = "172.29." + (a2 & 255) + "." + (a2 & 65280), DNS.address_map.names[r2] = e, DNS.address_map.addrs[e] = r2;
      }
      return r2;
    }, lookup_addr(e) {
      return DNS.address_map.names[e] ? DNS.address_map.names[e] : null;
    } }, getSocketAddress = (e, t) => {
      var r2 = readSockaddr(e, t);
      if (r2.errno) throw new FS.ErrnoError(r2.errno);
      return r2.addr = DNS.lookup_addr(r2.addr) || r2.addr, r2;
    };
    function ___syscall_bind(e, t, r2, a2, o2, s2) {
      try {
        var l2 = getSocketFromFD(e), n2 = getSocketAddress(t, r2);
        return l2.sock_ops.bind(l2, n2.addr, n2.port), 0;
      } catch (_2) {
        if (typeof FS > "u" || _2.name !== "ErrnoError") throw _2;
        return -_2.errno;
      }
    }
    ___syscall_bind.sig = "iippiii";
    function ___syscall_chdir(e) {
      try {
        return e = SYSCALLS.getStr(e), FS.chdir(e), 0;
      } catch (t) {
        if (typeof FS > "u" || t.name !== "ErrnoError") throw t;
        return -t.errno;
      }
    }
    ___syscall_chdir.sig = "ip";
    function ___syscall_chmod(e, t) {
      try {
        return e = SYSCALLS.getStr(e), FS.chmod(e, t), 0;
      } catch (r2) {
        if (typeof FS > "u" || r2.name !== "ErrnoError") throw r2;
        return -r2.errno;
      }
    }
    ___syscall_chmod.sig = "ipi";
    function ___syscall_connect(e, t, r2, a2, o2, s2) {
      try {
        var l2 = getSocketFromFD(e), n2 = getSocketAddress(t, r2);
        return l2.sock_ops.connect(l2, n2.addr, n2.port), 0;
      } catch (_2) {
        if (typeof FS > "u" || _2.name !== "ErrnoError") throw _2;
        return -_2.errno;
      }
    }
    ___syscall_connect.sig = "iippiii";
    function ___syscall_dup(e) {
      try {
        var t = SYSCALLS.getStreamFromFD(e);
        return FS.dupStream(t).fd;
      } catch (r2) {
        if (typeof FS > "u" || r2.name !== "ErrnoError") throw r2;
        return -r2.errno;
      }
    }
    ___syscall_dup.sig = "ii";
    function ___syscall_dup3(e, t, r2) {
      try {
        var a2 = SYSCALLS.getStreamFromFD(e);
        if (a2.fd === t) return -28;
        if (t < 0 || t >= FS.MAX_OPEN_FDS) return -8;
        var o2 = FS.getStream(t);
        return o2 && FS.close(o2), FS.dupStream(a2, t).fd;
      } catch (s2) {
        if (typeof FS > "u" || s2.name !== "ErrnoError") throw s2;
        return -s2.errno;
      }
    }
    ___syscall_dup3.sig = "iiii";
    function ___syscall_faccessat(e, t, r2, a2) {
      try {
        if (t = SYSCALLS.getStr(t), t = SYSCALLS.calculateAt(e, t), r2 & -8) return -28;
        var o2 = FS.lookupPath(t, { follow: true }), s2 = o2.node;
        if (!s2) return -44;
        var l2 = "";
        return r2 & 4 && (l2 += "r"), r2 & 2 && (l2 += "w"), r2 & 1 && (l2 += "x"), l2 && FS.nodePermissions(s2, l2) ? -2 : 0;
      } catch (n2) {
        if (typeof FS > "u" || n2.name !== "ErrnoError") throw n2;
        return -n2.errno;
      }
    }
    ___syscall_faccessat.sig = "iipii";
    var ___syscall_fadvise64 = (e, t, r2, a2) => 0;
    ___syscall_fadvise64.sig = "iijji";
    var INT53_MAX = 9007199254740992, INT53_MIN = -9007199254740992, bigintToI53Checked = (e) => e < INT53_MIN || e > INT53_MAX ? NaN : Number(e);
    function ___syscall_fallocate(e, t, r2, a2) {
      r2 = bigintToI53Checked(r2), a2 = bigintToI53Checked(a2);
      try {
        if (isNaN(r2)) return 61;
        var o2 = SYSCALLS.getStreamFromFD(e);
        return FS.allocate(o2, r2, a2), 0;
      } catch (s2) {
        if (typeof FS > "u" || s2.name !== "ErrnoError") throw s2;
        return -s2.errno;
      }
    }
    ___syscall_fallocate.sig = "iiijj";
    var syscallGetVarargI = () => {
      var e = HEAP32[+SYSCALLS.varargs >> 2];
      return SYSCALLS.varargs += 4, e;
    }, syscallGetVarargP = syscallGetVarargI;
    function ___syscall_fcntl64(e, t, r2) {
      SYSCALLS.varargs = r2;
      try {
        var a2 = SYSCALLS.getStreamFromFD(e);
        switch (t) {
          case 0: {
            var o2 = syscallGetVarargI();
            if (o2 < 0) return -28;
            for (; FS.streams[o2]; ) o2++;
            var s2;
            return s2 = FS.dupStream(a2, o2), s2.fd;
          }
          case 1:
          case 2:
            return 0;
          case 3:
            return a2.flags;
          case 4: {
            var o2 = syscallGetVarargI();
            return a2.flags |= o2, 0;
          }
          case 12: {
            var o2 = syscallGetVarargP(), l2 = 0;
            return HEAP16[o2 + l2 >> 1] = 2, 0;
          }
          case 13:
          case 14:
            return 0;
        }
        return -28;
      } catch (n2) {
        if (typeof FS > "u" || n2.name !== "ErrnoError") throw n2;
        return -n2.errno;
      }
    }
    ___syscall_fcntl64.sig = "iiip";
    function ___syscall_fdatasync(e) {
      try {
        var t = SYSCALLS.getStreamFromFD(e);
        return 0;
      } catch (r2) {
        if (typeof FS > "u" || r2.name !== "ErrnoError") throw r2;
        return -r2.errno;
      }
    }
    ___syscall_fdatasync.sig = "ii";
    function ___syscall_fstat64(e, t) {
      try {
        var r2 = SYSCALLS.getStreamFromFD(e);
        return SYSCALLS.doStat(FS.stat, r2.path, t);
      } catch (a2) {
        if (typeof FS > "u" || a2.name !== "ErrnoError") throw a2;
        return -a2.errno;
      }
    }
    ___syscall_fstat64.sig = "iip";
    function ___syscall_ftruncate64(e, t) {
      t = bigintToI53Checked(t);
      try {
        return isNaN(t) ? 61 : (FS.ftruncate(e, t), 0);
      } catch (r2) {
        if (typeof FS > "u" || r2.name !== "ErrnoError") throw r2;
        return -r2.errno;
      }
    }
    ___syscall_ftruncate64.sig = "iij";
    var stringToUTF8 = (e, t, r2) => stringToUTF8Array(e, HEAPU8, t, r2);
    function ___syscall_getcwd(e, t) {
      try {
        if (t === 0) return -28;
        var r2 = FS.cwd(), a2 = lengthBytesUTF8(r2) + 1;
        return t < a2 ? -68 : (stringToUTF8(r2, e, t), a2);
      } catch (o2) {
        if (typeof FS > "u" || o2.name !== "ErrnoError") throw o2;
        return -o2.errno;
      }
    }
    ___syscall_getcwd.sig = "ipp";
    function ___syscall_getdents64(e, t, r2) {
      try {
        var a2 = SYSCALLS.getStreamFromFD(e);
        a2.getdents || (a2.getdents = FS.readdir(a2.path));
        for (var o2 = 280, s2 = 0, l2 = FS.llseek(a2, 0, 1), n2 = Math.floor(l2 / o2), _2 = Math.min(a2.getdents.length, n2 + Math.floor(r2 / o2)), m2 = n2; m2 < _2; m2++) {
          var p2, d2, g2 = a2.getdents[m2];
          if (g2 === ".") p2 = a2.node.id, d2 = 4;
          else if (g2 === "..") {
            var c2 = FS.lookupPath(a2.path, { parent: true });
            p2 = c2.node.id, d2 = 4;
          } else {
            var f2;
            try {
              f2 = FS.lookupNode(a2.node, g2);
            } catch (u2) {
              if (u2?.errno === 28) continue;
              throw u2;
            }
            p2 = f2.id, d2 = FS.isChrdev(f2.mode) ? 2 : FS.isDir(f2.mode) ? 4 : FS.isLink(f2.mode) ? 10 : 8;
          }
          HEAP64[t + s2 >> 3] = BigInt(p2), HEAP64[t + s2 + 8 >> 3] = BigInt((m2 + 1) * o2), HEAP16[t + s2 + 16 >> 1] = 280, HEAP8[t + s2 + 18] = d2, stringToUTF8(g2, t + s2 + 19, 256), s2 += o2;
        }
        return FS.llseek(a2, m2 * o2, 0), s2;
      } catch (u2) {
        if (typeof FS > "u" || u2.name !== "ErrnoError") throw u2;
        return -u2.errno;
      }
    }
    ___syscall_getdents64.sig = "iipp";
    var writeSockaddr = (e, t, r2, a2, o2) => {
      switch (t) {
        case 2:
          r2 = inetPton4(r2), zeroMemory(e, 16), o2 && (HEAP32[o2 >> 2] = 16), HEAP16[e >> 1] = t, HEAP32[e + 4 >> 2] = r2, HEAP16[e + 2 >> 1] = _htons(a2);
          break;
        case 10:
          r2 = inetPton6(r2), zeroMemory(e, 28), o2 && (HEAP32[o2 >> 2] = 28), HEAP32[e >> 2] = t, HEAP32[e + 8 >> 2] = r2[0], HEAP32[e + 12 >> 2] = r2[1], HEAP32[e + 16 >> 2] = r2[2], HEAP32[e + 20 >> 2] = r2[3], HEAP16[e + 2 >> 1] = _htons(a2);
          break;
        default:
          return 5;
      }
      return 0;
    };
    function ___syscall_getsockname(e, t, r2, a2, o2, s2) {
      try {
        var l2 = getSocketFromFD(e), n2 = writeSockaddr(t, l2.family, DNS.lookup_name(l2.saddr || "0.0.0.0"), l2.sport, r2);
        return 0;
      } catch (_2) {
        if (typeof FS > "u" || _2.name !== "ErrnoError") throw _2;
        return -_2.errno;
      }
    }
    ___syscall_getsockname.sig = "iippiii";
    function ___syscall_getsockopt(e, t, r2, a2, o2, s2) {
      try {
        var l2 = getSocketFromFD(e);
        return t === 1 && r2 === 4 ? (HEAP32[a2 >> 2] = l2.error, HEAP32[o2 >> 2] = 4, l2.error = null, 0) : -50;
      } catch (n2) {
        if (typeof FS > "u" || n2.name !== "ErrnoError") throw n2;
        return -n2.errno;
      }
    }
    ___syscall_getsockopt.sig = "iiiippi";
    function ___syscall_ioctl(e, t, r2) {
      SYSCALLS.varargs = r2;
      try {
        var a2 = SYSCALLS.getStreamFromFD(e);
        switch (t) {
          case 21509:
            return a2.tty ? 0 : -59;
          case 21505: {
            if (!a2.tty) return -59;
            if (a2.tty.ops.ioctl_tcgets) {
              var o2 = a2.tty.ops.ioctl_tcgets(a2), s2 = syscallGetVarargP();
              HEAP32[s2 >> 2] = o2.c_iflag || 0, HEAP32[s2 + 4 >> 2] = o2.c_oflag || 0, HEAP32[s2 + 8 >> 2] = o2.c_cflag || 0, HEAP32[s2 + 12 >> 2] = o2.c_lflag || 0;
              for (var l2 = 0; l2 < 32; l2++) HEAP8[s2 + l2 + 17] = o2.c_cc[l2] || 0;
              return 0;
            }
            return 0;
          }
          case 21510:
          case 21511:
          case 21512:
            return a2.tty ? 0 : -59;
          case 21506:
          case 21507:
          case 21508: {
            if (!a2.tty) return -59;
            if (a2.tty.ops.ioctl_tcsets) {
              for (var s2 = syscallGetVarargP(), n2 = HEAP32[s2 >> 2], _2 = HEAP32[s2 + 4 >> 2], m2 = HEAP32[s2 + 8 >> 2], p2 = HEAP32[s2 + 12 >> 2], d2 = [], l2 = 0; l2 < 32; l2++) d2.push(HEAP8[s2 + l2 + 17]);
              return a2.tty.ops.ioctl_tcsets(a2.tty, t, { c_iflag: n2, c_oflag: _2, c_cflag: m2, c_lflag: p2, c_cc: d2 });
            }
            return 0;
          }
          case 21519: {
            if (!a2.tty) return -59;
            var s2 = syscallGetVarargP();
            return HEAP32[s2 >> 2] = 0, 0;
          }
          case 21520:
            return a2.tty ? -28 : -59;
          case 21531: {
            var s2 = syscallGetVarargP();
            return FS.ioctl(a2, t, s2);
          }
          case 21523: {
            if (!a2.tty) return -59;
            if (a2.tty.ops.ioctl_tiocgwinsz) {
              var g2 = a2.tty.ops.ioctl_tiocgwinsz(a2.tty), s2 = syscallGetVarargP();
              HEAP16[s2 >> 1] = g2[0], HEAP16[s2 + 2 >> 1] = g2[1];
            }
            return 0;
          }
          case 21524:
            return a2.tty ? 0 : -59;
          case 21515:
            return a2.tty ? 0 : -59;
          default:
            return -28;
        }
      } catch (c2) {
        if (typeof FS > "u" || c2.name !== "ErrnoError") throw c2;
        return -c2.errno;
      }
    }
    ___syscall_ioctl.sig = "iiip";
    function ___syscall_lstat64(e, t) {
      try {
        return e = SYSCALLS.getStr(e), SYSCALLS.doStat(FS.lstat, e, t);
      } catch (r2) {
        if (typeof FS > "u" || r2.name !== "ErrnoError") throw r2;
        return -r2.errno;
      }
    }
    ___syscall_lstat64.sig = "ipp";
    function ___syscall_mkdirat(e, t, r2) {
      try {
        return t = SYSCALLS.getStr(t), t = SYSCALLS.calculateAt(e, t), FS.mkdir(t, r2, 0), 0;
      } catch (a2) {
        if (typeof FS > "u" || a2.name !== "ErrnoError") throw a2;
        return -a2.errno;
      }
    }
    ___syscall_mkdirat.sig = "iipi";
    function ___syscall_newfstatat(e, t, r2, a2) {
      try {
        t = SYSCALLS.getStr(t);
        var o2 = a2 & 256, s2 = a2 & 4096;
        return a2 = a2 & -6401, t = SYSCALLS.calculateAt(e, t, s2), SYSCALLS.doStat(o2 ? FS.lstat : FS.stat, t, r2);
      } catch (l2) {
        if (typeof FS > "u" || l2.name !== "ErrnoError") throw l2;
        return -l2.errno;
      }
    }
    ___syscall_newfstatat.sig = "iippi";
    function ___syscall_openat(e, t, r2, a2) {
      SYSCALLS.varargs = a2;
      try {
        t = SYSCALLS.getStr(t), t = SYSCALLS.calculateAt(e, t);
        var o2 = a2 ? syscallGetVarargI() : 0;
        return FS.open(t, r2, o2).fd;
      } catch (s2) {
        if (typeof FS > "u" || s2.name !== "ErrnoError") throw s2;
        return -s2.errno;
      }
    }
    ___syscall_openat.sig = "iipip";
    var PIPEFS = { BUCKET_BUFFER_SIZE: 8192, mount(e) {
      return FS.createNode(null, "/", 16895, 0);
    }, createPipe() {
      var e = { buckets: [], refcnt: 2 };
      e.buckets.push({ buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE), offset: 0, roffset: 0 });
      var t = PIPEFS.nextname(), r2 = PIPEFS.nextname(), a2 = FS.createNode(PIPEFS.root, t, 4096, 0), o2 = FS.createNode(PIPEFS.root, r2, 4096, 0);
      a2.pipe = e, o2.pipe = e;
      var s2 = FS.createStream({ path: t, node: a2, flags: 0, seekable: false, stream_ops: PIPEFS.stream_ops });
      a2.stream = s2;
      var l2 = FS.createStream({ path: r2, node: o2, flags: 1, seekable: false, stream_ops: PIPEFS.stream_ops });
      return o2.stream = l2, { readable_fd: s2.fd, writable_fd: l2.fd };
    }, stream_ops: { poll(e) {
      var t = e.node.pipe;
      if ((e.flags & 2097155) === 1) return 260;
      if (t.buckets.length > 0) for (var r2 = 0; r2 < t.buckets.length; r2++) {
        var a2 = t.buckets[r2];
        if (a2.offset - a2.roffset > 0) return 65;
      }
      return 0;
    }, ioctl(e, t, r2) {
      return 28;
    }, fsync(e) {
      return 28;
    }, read(e, t, r2, a2, o2) {
      for (var s2 = e.node.pipe, l2 = 0, n2 = 0; n2 < s2.buckets.length; n2++) {
        var _2 = s2.buckets[n2];
        l2 += _2.offset - _2.roffset;
      }
      var m2 = t.subarray(r2, r2 + a2);
      if (a2 <= 0) return 0;
      if (l2 == 0) throw new FS.ErrnoError(6);
      for (var p2 = Math.min(l2, a2), d2 = p2, g2 = 0, n2 = 0; n2 < s2.buckets.length; n2++) {
        var c2 = s2.buckets[n2], f2 = c2.offset - c2.roffset;
        if (p2 <= f2) {
          var u2 = c2.buffer.subarray(c2.roffset, c2.offset);
          p2 < f2 ? (u2 = u2.subarray(0, p2), c2.roffset += p2) : g2++, m2.set(u2);
          break;
        } else {
          var u2 = c2.buffer.subarray(c2.roffset, c2.offset);
          m2.set(u2), m2 = m2.subarray(u2.byteLength), p2 -= u2.byteLength, g2++;
        }
      }
      return g2 && g2 == s2.buckets.length && (g2--, s2.buckets[g2].offset = 0, s2.buckets[g2].roffset = 0), s2.buckets.splice(0, g2), d2;
    }, write(e, t, r2, a2, o2) {
      var s2 = e.node.pipe, l2 = t.subarray(r2, r2 + a2), n2 = l2.byteLength;
      if (n2 <= 0) return 0;
      var _2 = null;
      s2.buckets.length == 0 ? (_2 = { buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE), offset: 0, roffset: 0 }, s2.buckets.push(_2)) : _2 = s2.buckets[s2.buckets.length - 1], assert(_2.offset <= PIPEFS.BUCKET_BUFFER_SIZE);
      var m2 = PIPEFS.BUCKET_BUFFER_SIZE - _2.offset;
      if (m2 >= n2) return _2.buffer.set(l2, _2.offset), _2.offset += n2, n2;
      m2 > 0 && (_2.buffer.set(l2.subarray(0, m2), _2.offset), _2.offset += m2, l2 = l2.subarray(m2, l2.byteLength));
      for (var p2 = l2.byteLength / PIPEFS.BUCKET_BUFFER_SIZE | 0, d2 = l2.byteLength % PIPEFS.BUCKET_BUFFER_SIZE, g2 = 0; g2 < p2; g2++) {
        var c2 = { buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE), offset: PIPEFS.BUCKET_BUFFER_SIZE, roffset: 0 };
        s2.buckets.push(c2), c2.buffer.set(l2.subarray(0, PIPEFS.BUCKET_BUFFER_SIZE)), l2 = l2.subarray(PIPEFS.BUCKET_BUFFER_SIZE, l2.byteLength);
      }
      if (d2 > 0) {
        var c2 = { buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE), offset: l2.byteLength, roffset: 0 };
        s2.buckets.push(c2), c2.buffer.set(l2);
      }
      return n2;
    }, close(e) {
      var t = e.node.pipe;
      t.refcnt--, t.refcnt === 0 && (t.buckets = null);
    } }, nextname() {
      return PIPEFS.nextname.current || (PIPEFS.nextname.current = 0), "pipe[" + PIPEFS.nextname.current++ + "]";
    } };
    function ___syscall_pipe(e) {
      try {
        if (e == 0) throw new FS.ErrnoError(21);
        var t = PIPEFS.createPipe();
        return HEAP32[e >> 2] = t.readable_fd, HEAP32[e + 4 >> 2] = t.writable_fd, 0;
      } catch (r2) {
        if (typeof FS > "u" || r2.name !== "ErrnoError") throw r2;
        return -r2.errno;
      }
    }
    ___syscall_pipe.sig = "ip";
    function ___syscall_poll(e, t, r2) {
      try {
        for (var a2 = 0, o2 = 0; o2 < t; o2++) {
          var s2 = e + 8 * o2, l2 = HEAP32[s2 >> 2], n2 = HEAP16[s2 + 4 >> 1], _2 = 32, m2 = FS.getStream(l2);
          m2 && (_2 = SYSCALLS.DEFAULT_POLLMASK, m2.stream_ops.poll && (_2 = m2.stream_ops.poll(m2, -1))), _2 &= n2 | 8 | 16, _2 && a2++, HEAP16[s2 + 6 >> 1] = _2;
        }
        return a2;
      } catch (p2) {
        if (typeof FS > "u" || p2.name !== "ErrnoError") throw p2;
        return -p2.errno;
      }
    }
    ___syscall_poll.sig = "ipii";
    function ___syscall_readlinkat(e, t, r2, a2) {
      try {
        if (t = SYSCALLS.getStr(t), t = SYSCALLS.calculateAt(e, t), a2 <= 0) return -28;
        var o2 = FS.readlink(t), s2 = Math.min(a2, lengthBytesUTF8(o2)), l2 = HEAP8[r2 + s2];
        return stringToUTF8(o2, r2, a2 + 1), HEAP8[r2 + s2] = l2, s2;
      } catch (n2) {
        if (typeof FS > "u" || n2.name !== "ErrnoError") throw n2;
        return -n2.errno;
      }
    }
    ___syscall_readlinkat.sig = "iippp";
    function ___syscall_recvfrom(e, t, r2, a2, o2, s2) {
      try {
        var l2 = getSocketFromFD(e), n2 = l2.sock_ops.recvmsg(l2, r2);
        if (!n2) return 0;
        if (o2) var _2 = writeSockaddr(o2, l2.family, DNS.lookup_name(n2.addr), n2.port, s2);
        return HEAPU8.set(n2.buffer, t), n2.buffer.byteLength;
      } catch (m2) {
        if (typeof FS > "u" || m2.name !== "ErrnoError") throw m2;
        return -m2.errno;
      }
    }
    ___syscall_recvfrom.sig = "iippipp";
    function ___syscall_renameat(e, t, r2, a2) {
      try {
        return t = SYSCALLS.getStr(t), a2 = SYSCALLS.getStr(a2), t = SYSCALLS.calculateAt(e, t), a2 = SYSCALLS.calculateAt(r2, a2), FS.rename(t, a2), 0;
      } catch (o2) {
        if (typeof FS > "u" || o2.name !== "ErrnoError") throw o2;
        return -o2.errno;
      }
    }
    ___syscall_renameat.sig = "iipip";
    function ___syscall_rmdir(e) {
      try {
        return e = SYSCALLS.getStr(e), FS.rmdir(e), 0;
      } catch (t) {
        if (typeof FS > "u" || t.name !== "ErrnoError") throw t;
        return -t.errno;
      }
    }
    ___syscall_rmdir.sig = "ip";
    function ___syscall_sendto(e, t, r2, a2, o2, s2) {
      try {
        var l2 = getSocketFromFD(e);
        if (!o2) return FS.write(l2.stream, HEAP8, t, r2);
        var n2 = getSocketAddress(o2, s2);
        return l2.sock_ops.sendmsg(l2, HEAP8, t, r2, n2.addr, n2.port);
      } catch (_2) {
        if (typeof FS > "u" || _2.name !== "ErrnoError") throw _2;
        return -_2.errno;
      }
    }
    ___syscall_sendto.sig = "iippipp";
    function ___syscall_socket(e, t, r2) {
      try {
        var a2 = SOCKFS.createSocket(e, t, r2);
        return a2.stream.fd;
      } catch (o2) {
        if (typeof FS > "u" || o2.name !== "ErrnoError") throw o2;
        return -o2.errno;
      }
    }
    ___syscall_socket.sig = "iiiiiii";
    function ___syscall_stat64(e, t) {
      try {
        return e = SYSCALLS.getStr(e), SYSCALLS.doStat(FS.stat, e, t);
      } catch (r2) {
        if (typeof FS > "u" || r2.name !== "ErrnoError") throw r2;
        return -r2.errno;
      }
    }
    ___syscall_stat64.sig = "ipp";
    function ___syscall_symlinkat(e, t, r2) {
      try {
        return e = SYSCALLS.getStr(e), r2 = SYSCALLS.getStr(r2), r2 = SYSCALLS.calculateAt(t, r2), FS.symlink(e, r2), 0;
      } catch (a2) {
        if (typeof FS > "u" || a2.name !== "ErrnoError") throw a2;
        return -a2.errno;
      }
    }
    ___syscall_symlinkat.sig = "ipip";
    function ___syscall_truncate64(e, t) {
      t = bigintToI53Checked(t);
      try {
        return isNaN(t) ? 61 : (e = SYSCALLS.getStr(e), FS.truncate(e, t), 0);
      } catch (r2) {
        if (typeof FS > "u" || r2.name !== "ErrnoError") throw r2;
        return -r2.errno;
      }
    }
    ___syscall_truncate64.sig = "ipj";
    function ___syscall_unlinkat(e, t, r2) {
      try {
        return t = SYSCALLS.getStr(t), t = SYSCALLS.calculateAt(e, t), r2 === 0 ? FS.unlink(t) : r2 === 512 ? FS.rmdir(t) : abort("Invalid flags passed to unlinkat"), 0;
      } catch (a2) {
        if (typeof FS > "u" || a2.name !== "ErrnoError") throw a2;
        return -a2.errno;
      }
    }
    ___syscall_unlinkat.sig = "iipi";
    var ___table_base = new WebAssembly.Global({ value: "i32", mutable: false }, 1), __abort_js = () => abort("");
    __abort_js.sig = "v";
    var ENV = {}, stackAlloc = (e) => __emscripten_stack_alloc(e), stringToUTF8OnStack = (e) => {
      var t = lengthBytesUTF8(e) + 1, r2 = stackAlloc(t);
      return stringToUTF8(e, r2, t), r2;
    }, dlSetError = (e) => {
      var t = stackSave(), r2 = stringToUTF8OnStack(e);
      ___dl_seterr(r2, 0), stackRestore(t);
    }, dlopenInternal = (e, t) => {
      var r2 = UTF8ToString(e + 36), a2 = HEAP32[e + 4 >> 2];
      r2 = PATH.normalize(r2);
      var o2 = !!(a2 & 256), s2 = o2 ? null : {}, l2 = { global: o2, nodelete: !!(a2 & 4096), loadAsync: t.loadAsync };
      try {
        return loadDynamicLibrary(r2, l2, s2, e);
      } catch (n2) {
        return dlSetError(`Could not load dynamic lib: ${r2}
${n2}`), 0;
      }
    }, __dlopen_js = (e) => dlopenInternal(e, { loadAsync: false });
    __dlopen_js.sig = "pp";
    var __dlsym_js = (e, t, r2) => {
      t = UTF8ToString(t);
      var a2, o2, s2 = LDSO.loadedLibsByHandle[e];
      if (!s2.exports.hasOwnProperty(t) || s2.exports[t].stub) return dlSetError(`Tried to lookup unknown symbol "${t}" in dynamic lib: ${s2.name}`), 0;
      if (o2 = Object.keys(s2.exports).indexOf(t), a2 = s2.exports[t], typeof a2 == "function") {
        var l2 = getFunctionAddress(a2);
        l2 ? a2 = l2 : (a2 = addFunction(a2, a2.sig), HEAPU32[r2 >> 2] = o2);
      }
      return a2;
    };
    __dlsym_js.sig = "pppp";
    var __emscripten_memcpy_js = (e, t, r2) => HEAPU8.copyWithin(e, t, t + r2);
    __emscripten_memcpy_js.sig = "vppp";
    var runtimeKeepaliveCounter = 0, __emscripten_runtime_keepalive_clear = () => {
      noExitRuntime = false, runtimeKeepaliveCounter = 0;
    };
    __emscripten_runtime_keepalive_clear.sig = "v";
    var __emscripten_system = (e) => {
      if (ENVIRONMENT_IS_NODE) {
        if (!e) return 1;
        var t = UTF8ToString(e);
        if (!t.length) return 0;
        var r2 = require("child_process"), a2 = r2.spawnSync(t, [], { shell: true, stdio: "inherit" }), o2 = (l2, n2) => l2 << 8 | n2;
        if (a2.status === null) {
          var s2 = (l2) => {
            switch (l2) {
              case "SIGHUP":
                return 1;
              case "SIGQUIT":
                return 3;
              case "SIGFPE":
                return 8;
              case "SIGKILL":
                return 9;
              case "SIGALRM":
                return 14;
              case "SIGTERM":
                return 15;
              default:
                return 2;
            }
          };
          return o2(0, s2(a2.signal));
        }
        return o2(a2.status, 0);
      }
      return e ? -52 : 0;
    };
    __emscripten_system.sig = "ip";
    var __emscripten_throw_longjmp = () => {
      throw 1 / 0;
    };
    __emscripten_throw_longjmp.sig = "v";
    function __gmtime_js(e, t) {
      e = bigintToI53Checked(e);
      var r2 = new Date(e * 1e3);
      HEAP32[t >> 2] = r2.getUTCSeconds(), HEAP32[t + 4 >> 2] = r2.getUTCMinutes(), HEAP32[t + 8 >> 2] = r2.getUTCHours(), HEAP32[t + 12 >> 2] = r2.getUTCDate(), HEAP32[t + 16 >> 2] = r2.getUTCMonth(), HEAP32[t + 20 >> 2] = r2.getUTCFullYear() - 1900, HEAP32[t + 24 >> 2] = r2.getUTCDay();
      var a2 = Date.UTC(r2.getUTCFullYear(), 0, 1, 0, 0, 0, 0), o2 = (r2.getTime() - a2) / (1e3 * 60 * 60 * 24) | 0;
      HEAP32[t + 28 >> 2] = o2;
    }
    __gmtime_js.sig = "vjp";
    var isLeapYear = (e) => e % 4 === 0 && (e % 100 !== 0 || e % 400 === 0), MONTH_DAYS_LEAP_CUMULATIVE = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335], MONTH_DAYS_REGULAR_CUMULATIVE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334], ydayFromDate = (e) => {
      var t = isLeapYear(e.getFullYear()), r2 = t ? MONTH_DAYS_LEAP_CUMULATIVE : MONTH_DAYS_REGULAR_CUMULATIVE, a2 = r2[e.getMonth()] + e.getDate() - 1;
      return a2;
    };
    function __localtime_js(e, t) {
      e = bigintToI53Checked(e);
      var r2 = new Date(e * 1e3);
      HEAP32[t >> 2] = r2.getSeconds(), HEAP32[t + 4 >> 2] = r2.getMinutes(), HEAP32[t + 8 >> 2] = r2.getHours(), HEAP32[t + 12 >> 2] = r2.getDate(), HEAP32[t + 16 >> 2] = r2.getMonth(), HEAP32[t + 20 >> 2] = r2.getFullYear() - 1900, HEAP32[t + 24 >> 2] = r2.getDay();
      var a2 = ydayFromDate(r2) | 0;
      HEAP32[t + 28 >> 2] = a2, HEAP32[t + 36 >> 2] = -(r2.getTimezoneOffset() * 60);
      var o2 = new Date(r2.getFullYear(), 0, 1), s2 = new Date(r2.getFullYear(), 6, 1).getTimezoneOffset(), l2 = o2.getTimezoneOffset(), n2 = (s2 != l2 && r2.getTimezoneOffset() == Math.min(l2, s2)) | 0;
      HEAP32[t + 32 >> 2] = n2;
    }
    __localtime_js.sig = "vjp";
    function __mmap_js(e, t, r2, a2, o2, s2, l2) {
      o2 = bigintToI53Checked(o2);
      try {
        if (isNaN(o2)) return 61;
        var n2 = SYSCALLS.getStreamFromFD(a2), _2 = FS.mmap(n2, e, o2, t, r2), m2 = _2.ptr;
        return HEAP32[s2 >> 2] = _2.allocated, HEAPU32[l2 >> 2] = m2, 0;
      } catch (p2) {
        if (typeof FS > "u" || p2.name !== "ErrnoError") throw p2;
        return -p2.errno;
      }
    }
    __mmap_js.sig = "ipiiijpp";
    function __munmap_js(e, t, r2, a2, o2, s2) {
      s2 = bigintToI53Checked(s2);
      try {
        var l2 = SYSCALLS.getStreamFromFD(o2);
        r2 & 2 && SYSCALLS.doMsync(e, l2, t, a2, s2);
      } catch (n2) {
        if (typeof FS > "u" || n2.name !== "ErrnoError") throw n2;
        return -n2.errno;
      }
    }
    __munmap_js.sig = "ippiiij";
    var timers = {}, handleException = (e) => {
      if (e instanceof ExitStatus || e == "unwind") return EXITSTATUS;
      quit_(1, e);
    }, keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0, _proc_exit = (e) => {
      EXITSTATUS = e, keepRuntimeAlive() || (Module.onExit?.(e), ABORT = true), quit_(e, new ExitStatus(e));
    };
    _proc_exit.sig = "vi";
    var exitJS = (e, t) => {
      EXITSTATUS = e, _proc_exit(e);
    }, _exit = exitJS;
    _exit.sig = "vi";
    var maybeExit = () => {
      if (!keepRuntimeAlive()) try {
        _exit(EXITSTATUS);
      } catch (e) {
        handleException(e);
      }
    }, callUserCallback = (e) => {
      if (!ABORT) try {
        e(), maybeExit();
      } catch (t) {
        handleException(t);
      }
    }, _emscripten_get_now = () => performance.now();
    _emscripten_get_now.sig = "d";
    var __setitimer_js = (e, t) => {
      if (timers[e] && (clearTimeout(timers[e].id), delete timers[e]), !t) return 0;
      var r2 = setTimeout(() => {
        delete timers[e], callUserCallback(() => __emscripten_timeout(e, _emscripten_get_now()));
      }, t);
      return timers[e] = { id: r2, timeout_ms: t }, 0;
    };
    __setitimer_js.sig = "iid";
    var __tzset_js = (e, t, r2, a2) => {
      var o2 = (/* @__PURE__ */ new Date()).getFullYear(), s2 = new Date(o2, 0, 1), l2 = new Date(o2, 6, 1), n2 = s2.getTimezoneOffset(), _2 = l2.getTimezoneOffset(), m2 = Math.max(n2, _2);
      HEAPU32[e >> 2] = m2 * 60, HEAP32[t >> 2] = +(n2 != _2);
      var p2 = (c2) => {
        var f2 = c2 >= 0 ? "-" : "+", u2 = Math.abs(c2), w2 = String(Math.floor(u2 / 60)).padStart(2, "0"), h2 = String(u2 % 60).padStart(2, "0");
        return `UTC${f2}${w2}${h2}`;
      }, d2 = p2(n2), g2 = p2(_2);
      _2 < n2 ? (stringToUTF8(d2, r2, 17), stringToUTF8(g2, a2, 17)) : (stringToUTF8(d2, a2, 17), stringToUTF8(g2, r2, 17));
    };
    __tzset_js.sig = "vpppp";
    var _emscripten_date_now = () => Date.now();
    _emscripten_date_now.sig = "d";
    var checkWasiClock = (e) => e >= 0 && e <= 3;
    function _clock_time_get(e, t, r2) {
      if (!checkWasiClock(e)) return 28;
      var a2;
      if (e === 0) a2 = _emscripten_date_now();
      else a2 = _emscripten_get_now();
      var o2 = Math.round(a2 * 1e3 * 1e3);
      return HEAP64[r2 >> 3] = BigInt(o2), 0;
    }
    _clock_time_get.sig = "iijp";
    var readEmAsmArgsArray = [], readEmAsmArgs = (e, t) => {
      readEmAsmArgsArray.length = 0;
      for (var r2; r2 = HEAPU8[e++]; ) {
        var a2 = r2 != 105;
        a2 &= r2 != 112, t += a2 && t % 8 ? 4 : 0, readEmAsmArgsArray.push(r2 == 112 ? HEAPU32[t >> 2] : r2 == 106 ? HEAP64[t >> 3] : r2 == 105 ? HEAP32[t >> 2] : HEAPF64[t >> 3]), t += a2 ? 8 : 4;
      }
      return readEmAsmArgsArray;
    }, runEmAsmFunction = (e, t, r2) => {
      var a2 = readEmAsmArgs(t, r2);
      return ASM_CONSTS[e](...a2);
    }, _emscripten_asm_const_int = (e, t, r2) => runEmAsmFunction(e, t, r2);
    _emscripten_asm_const_int.sig = "ippp";
    var _emscripten_force_exit = (e) => {
      __emscripten_runtime_keepalive_clear(), _exit(e);
    };
    _emscripten_force_exit.sig = "vi";
    var getHeapMax = () => 2147483648, growMemory = (e) => {
      var t = wasmMemory.buffer, r2 = (e - t.byteLength + 65535) / 65536 | 0;
      try {
        return wasmMemory.grow(r2), updateMemoryViews(), 1;
      } catch {
      }
    }, _emscripten_resize_heap = (e) => {
      var t = HEAPU8.length;
      e >>>= 0;
      var r2 = getHeapMax();
      if (e > r2) return false;
      for (var a2 = 1; a2 <= 4; a2 *= 2) {
        var o2 = t * (1 + 0.2 / a2);
        o2 = Math.min(o2, e + 100663296);
        var s2 = Math.min(r2, alignMemory(Math.max(e, o2), 65536)), l2 = growMemory(s2);
        if (l2) return true;
      }
      return false;
    };
    _emscripten_resize_heap.sig = "ip";
    var _emscripten_set_main_loop_timing = (e, t) => {
      if (MainLoop.timingMode = e, MainLoop.timingValue = t, !MainLoop.func) return 1;
      if (MainLoop.running || (MainLoop.running = true), e == 0) MainLoop.scheduler = function() {
        var l2 = Math.max(0, MainLoop.tickStartTime + t - _emscripten_get_now()) | 0;
        setTimeout(MainLoop.runner, l2);
      }, MainLoop.method = "timeout";
      else if (e == 1) MainLoop.scheduler = function() {
        MainLoop.requestAnimationFrame(MainLoop.runner);
      }, MainLoop.method = "rAF";
      else if (e == 2) {
        if (typeof MainLoop.setImmediate > "u") if (typeof setImmediate > "u") {
          var r2 = [], a2 = "setimmediate", o2 = (s2) => {
            (s2.data === a2 || s2.data.target === a2) && (s2.stopPropagation(), r2.shift()());
          };
          addEventListener("message", o2, true), MainLoop.setImmediate = (s2) => {
            r2.push(s2), ENVIRONMENT_IS_WORKER ? (Module.setImmediates ?? (Module.setImmediates = []), Module.setImmediates.push(s2), postMessage({ target: a2 })) : postMessage(a2, "*");
          };
        } else MainLoop.setImmediate = setImmediate;
        MainLoop.scheduler = function() {
          MainLoop.setImmediate(MainLoop.runner);
        }, MainLoop.method = "immediate";
      }
      return 0;
    };
    _emscripten_set_main_loop_timing.sig = "iii";
    var MainLoop = { running: false, scheduler: null, method: "", currentlyRunningMainloop: 0, func: null, arg: 0, timingMode: 0, timingValue: 0, currentFrameNumber: 0, queue: [], preMainLoop: [], postMainLoop: [], pause() {
      MainLoop.scheduler = null, MainLoop.currentlyRunningMainloop++;
    }, resume() {
      MainLoop.currentlyRunningMainloop++;
      var e = MainLoop.timingMode, t = MainLoop.timingValue, r2 = MainLoop.func;
      MainLoop.func = null, setMainLoop(r2, 0, false, MainLoop.arg, true), _emscripten_set_main_loop_timing(e, t), MainLoop.scheduler();
    }, updateStatus() {
      if (Module.setStatus) {
        var e = Module.statusMessage || "Please wait...", t = MainLoop.remainingBlockers ?? 0, r2 = MainLoop.expectedBlockers ?? 0;
        t ? t < r2 ? Module.setStatus("{message} ({expected - remaining}/{expected})") : Module.setStatus(e) : Module.setStatus("");
      }
    }, init() {
      Module.preMainLoop && MainLoop.preMainLoop.push(Module.preMainLoop), Module.postMainLoop && MainLoop.postMainLoop.push(Module.postMainLoop);
    }, runIter(e) {
      if (!ABORT) {
        for (var t of MainLoop.preMainLoop) if (t() === false) return;
        callUserCallback(e);
        for (var r2 of MainLoop.postMainLoop) r2();
      }
    }, nextRAF: 0, fakeRequestAnimationFrame(e) {
      var t = Date.now();
      if (MainLoop.nextRAF === 0) MainLoop.nextRAF = t + 1e3 / 60;
      else for (; t + 2 >= MainLoop.nextRAF; ) MainLoop.nextRAF += 1e3 / 60;
      var r2 = Math.max(MainLoop.nextRAF - t, 0);
      setTimeout(e, r2);
    }, requestAnimationFrame(e) {
      if (typeof requestAnimationFrame == "function") {
        requestAnimationFrame(e);
        return;
      }
      var t = MainLoop.fakeRequestAnimationFrame;
      t(e);
    } }, setMainLoop = (e, t, r2, a2, o2) => {
      MainLoop.func = e, MainLoop.arg = a2;
      var s2 = MainLoop.currentlyRunningMainloop;
      function l2() {
        return s2 < MainLoop.currentlyRunningMainloop ? (maybeExit(), false) : true;
      }
      if (MainLoop.running = false, MainLoop.runner = function() {
        if (!ABORT) {
          if (MainLoop.queue.length > 0) {
            var m2 = MainLoop.queue.shift();
            if (m2.func(m2.arg), MainLoop.remainingBlockers) {
              var p2 = MainLoop.remainingBlockers, d2 = p2 % 1 == 0 ? p2 - 1 : Math.floor(p2);
              m2.counted ? MainLoop.remainingBlockers = d2 : (d2 = d2 + 0.5, MainLoop.remainingBlockers = (8 * p2 + d2) / 9);
            }
            if (MainLoop.updateStatus(), !l2()) return;
            setTimeout(MainLoop.runner, 0);
            return;
          }
          if (l2()) {
            if (MainLoop.currentFrameNumber = MainLoop.currentFrameNumber + 1 | 0, MainLoop.timingMode == 1 && MainLoop.timingValue > 1 && MainLoop.currentFrameNumber % MainLoop.timingValue != 0) {
              MainLoop.scheduler();
              return;
            } else MainLoop.timingMode == 0 && (MainLoop.tickStartTime = _emscripten_get_now());
            MainLoop.runIter(e), l2() && MainLoop.scheduler();
          }
        }
      }, o2 || (t && t > 0 ? _emscripten_set_main_loop_timing(0, 1e3 / t) : _emscripten_set_main_loop_timing(1, 1), MainLoop.scheduler()), r2) throw "unwind";
    }, _emscripten_set_main_loop = (e, t, r2) => {
      var a2 = getWasmTableEntry(e);
      setMainLoop(a2, t, r2);
    };
    _emscripten_set_main_loop.sig = "vpii";
    var getExecutableName = () => thisProgram || "./this.program", getEnvStrings = () => {
      if (!getEnvStrings.strings) {
        var e = (typeof navigator == "object" && navigator.languages && navigator.languages[0] || "C").replace("-", "_") + ".UTF-8", t = { USER: "web_user", LOGNAME: "web_user", PATH: "/", PWD: "/", HOME: "/home/web_user", LANG: e, _: getExecutableName() };
        for (var r2 in ENV) ENV[r2] === void 0 ? delete t[r2] : t[r2] = ENV[r2];
        var a2 = [];
        for (var r2 in t) a2.push(`${r2}=${t[r2]}`);
        getEnvStrings.strings = a2;
      }
      return getEnvStrings.strings;
    }, stringToAscii = (e, t) => {
      for (var r2 = 0; r2 < e.length; ++r2) HEAP8[t++] = e.charCodeAt(r2);
      HEAP8[t] = 0;
    }, _environ_get = (e, t) => {
      var r2 = 0;
      return getEnvStrings().forEach((a2, o2) => {
        var s2 = t + r2;
        HEAPU32[e + o2 * 4 >> 2] = s2, stringToAscii(a2, s2), r2 += a2.length + 1;
      }), 0;
    };
    _environ_get.sig = "ipp";
    var _environ_sizes_get = (e, t) => {
      var r2 = getEnvStrings();
      HEAPU32[e >> 2] = r2.length;
      var a2 = 0;
      return r2.forEach((o2) => a2 += o2.length + 1), HEAPU32[t >> 2] = a2, 0;
    };
    _environ_sizes_get.sig = "ipp";
    function _fd_close(e) {
      try {
        var t = SYSCALLS.getStreamFromFD(e);
        return FS.close(t), 0;
      } catch (r2) {
        if (typeof FS > "u" || r2.name !== "ErrnoError") throw r2;
        return r2.errno;
      }
    }
    _fd_close.sig = "ii";
    function _fd_fdstat_get(e, t) {
      try {
        var r2 = 0, a2 = 0, o2 = 0, s2 = SYSCALLS.getStreamFromFD(e), l2 = s2.tty ? 2 : FS.isDir(s2.mode) ? 3 : FS.isLink(s2.mode) ? 7 : 4;
        return HEAP8[t] = l2, HEAP16[t + 2 >> 1] = o2, HEAP64[t + 8 >> 3] = BigInt(r2), HEAP64[t + 16 >> 3] = BigInt(a2), 0;
      } catch (n2) {
        if (typeof FS > "u" || n2.name !== "ErrnoError") throw n2;
        return n2.errno;
      }
    }
    _fd_fdstat_get.sig = "iip";
    var doReadv = (e, t, r2, a2) => {
      for (var o2 = 0, s2 = 0; s2 < r2; s2++) {
        var l2 = HEAPU32[t >> 2], n2 = HEAPU32[t + 4 >> 2];
        t += 8;
        var _2 = FS.read(e, HEAP8, l2, n2, a2);
        if (_2 < 0) return -1;
        if (o2 += _2, _2 < n2) break;
        typeof a2 < "u" && (a2 += _2);
      }
      return o2;
    };
    function _fd_pread(e, t, r2, a2, o2) {
      a2 = bigintToI53Checked(a2);
      try {
        if (isNaN(a2)) return 61;
        var s2 = SYSCALLS.getStreamFromFD(e), l2 = doReadv(s2, t, r2, a2);
        return HEAPU32[o2 >> 2] = l2, 0;
      } catch (n2) {
        if (typeof FS > "u" || n2.name !== "ErrnoError") throw n2;
        return n2.errno;
      }
    }
    _fd_pread.sig = "iippjp";
    var doWritev = (e, t, r2, a2) => {
      for (var o2 = 0, s2 = 0; s2 < r2; s2++) {
        var l2 = HEAPU32[t >> 2], n2 = HEAPU32[t + 4 >> 2];
        t += 8;
        var _2 = FS.write(e, HEAP8, l2, n2, a2);
        if (_2 < 0) return -1;
        if (o2 += _2, _2 < n2) break;
        typeof a2 < "u" && (a2 += _2);
      }
      return o2;
    };
    function _fd_pwrite(e, t, r2, a2, o2) {
      a2 = bigintToI53Checked(a2);
      try {
        if (isNaN(a2)) return 61;
        var s2 = SYSCALLS.getStreamFromFD(e), l2 = doWritev(s2, t, r2, a2);
        return HEAPU32[o2 >> 2] = l2, 0;
      } catch (n2) {
        if (typeof FS > "u" || n2.name !== "ErrnoError") throw n2;
        return n2.errno;
      }
    }
    _fd_pwrite.sig = "iippjp";
    function _fd_read(e, t, r2, a2) {
      try {
        var o2 = SYSCALLS.getStreamFromFD(e), s2 = doReadv(o2, t, r2);
        return HEAPU32[a2 >> 2] = s2, 0;
      } catch (l2) {
        if (typeof FS > "u" || l2.name !== "ErrnoError") throw l2;
        return l2.errno;
      }
    }
    _fd_read.sig = "iippp";
    function _fd_seek(e, t, r2, a2) {
      t = bigintToI53Checked(t);
      try {
        if (isNaN(t)) return 61;
        var o2 = SYSCALLS.getStreamFromFD(e);
        return FS.llseek(o2, t, r2), HEAP64[a2 >> 3] = BigInt(o2.position), o2.getdents && t === 0 && r2 === 0 && (o2.getdents = null), 0;
      } catch (s2) {
        if (typeof FS > "u" || s2.name !== "ErrnoError") throw s2;
        return s2.errno;
      }
    }
    _fd_seek.sig = "iijip";
    function _fd_sync(e) {
      try {
        var t = SYSCALLS.getStreamFromFD(e);
        return t.stream_ops?.fsync ? t.stream_ops.fsync(t) : 0;
      } catch (r2) {
        if (typeof FS > "u" || r2.name !== "ErrnoError") throw r2;
        return r2.errno;
      }
    }
    _fd_sync.sig = "ii";
    function _fd_write(e, t, r2, a2) {
      try {
        var o2 = SYSCALLS.getStreamFromFD(e), s2 = doWritev(o2, t, r2);
        return HEAPU32[a2 >> 2] = s2, 0;
      } catch (l2) {
        if (typeof FS > "u" || l2.name !== "ErrnoError") throw l2;
        return l2.errno;
      }
    }
    _fd_write.sig = "iippp";
    var _getaddrinfo = (e, t, r2, a2) => {
      var o2 = 0, s2 = 0, l2 = 0, n2 = 0, _2 = 0, m2 = 0, p2;
      function d2(g2, c2, f2, u2, w2, h2) {
        var S2, M2, y2, x2;
        return M2 = g2 === 10 ? 28 : 16, w2 = g2 === 10 ? inetNtop6(w2) : inetNtop4(w2), S2 = _malloc(M2), x2 = writeSockaddr(S2, g2, w2, h2), assert(!x2), y2 = _malloc(32), HEAP32[y2 + 4 >> 2] = g2, HEAP32[y2 + 8 >> 2] = c2, HEAP32[y2 + 12 >> 2] = f2, HEAPU32[y2 + 24 >> 2] = u2, HEAPU32[y2 + 20 >> 2] = S2, g2 === 10 ? HEAP32[y2 + 16 >> 2] = 28 : HEAP32[y2 + 16 >> 2] = 16, HEAP32[y2 + 28 >> 2] = 0, y2;
      }
      if (r2 && (l2 = HEAP32[r2 >> 2], n2 = HEAP32[r2 + 4 >> 2], _2 = HEAP32[r2 + 8 >> 2], m2 = HEAP32[r2 + 12 >> 2]), _2 && !m2 && (m2 = _2 === 2 ? 17 : 6), !_2 && m2 && (_2 = m2 === 17 ? 2 : 1), m2 === 0 && (m2 = 6), _2 === 0 && (_2 = 1), !e && !t) return -2;
      if (l2 & -1088 || r2 !== 0 && HEAP32[r2 >> 2] & 2 && !e) return -1;
      if (l2 & 32) return -2;
      if (_2 !== 0 && _2 !== 1 && _2 !== 2) return -7;
      if (n2 !== 0 && n2 !== 2 && n2 !== 10) return -6;
      if (t && (t = UTF8ToString(t), s2 = parseInt(t, 10), isNaN(s2))) return l2 & 1024 ? -2 : -8;
      if (!e) return n2 === 0 && (n2 = 2), l2 & 1 || (n2 === 2 ? o2 = _htonl(2130706433) : o2 = [0, 0, 0, _htonl(1)]), p2 = d2(n2, _2, m2, null, o2, s2), HEAPU32[a2 >> 2] = p2, 0;
      if (e = UTF8ToString(e), o2 = inetPton4(e), o2 !== null) if (n2 === 0 || n2 === 2) n2 = 2;
      else if (n2 === 10 && l2 & 8) o2 = [0, 0, _htonl(65535), o2], n2 = 10;
      else return -2;
      else if (o2 = inetPton6(e), o2 !== null) if (n2 === 0 || n2 === 10) n2 = 10;
      else return -2;
      return o2 != null ? (p2 = d2(n2, _2, m2, e, o2, s2), HEAPU32[a2 >> 2] = p2, 0) : l2 & 4 ? -2 : (e = DNS.lookup_name(e), o2 = inetPton4(e), n2 === 0 ? n2 = 2 : n2 === 10 && (o2 = [0, 0, _htonl(65535), o2]), p2 = d2(n2, _2, m2, null, o2, s2), HEAPU32[a2 >> 2] = p2, 0);
    };
    _getaddrinfo.sig = "ipppp";
    var _getnameinfo = (e, t, r2, a2, o2, s2, l2) => {
      var n2 = readSockaddr(e, t);
      if (n2.errno) return -6;
      var _2 = n2.port, m2 = n2.addr, p2 = false;
      if (r2 && a2) {
        var d2;
        if (l2 & 1 || !(d2 = DNS.lookup_addr(m2))) {
          if (l2 & 8) return -2;
        } else m2 = d2;
        var g2 = stringToUTF8(m2, r2, a2);
        g2 + 1 >= a2 && (p2 = true);
      }
      if (o2 && s2) {
        _2 = "" + _2;
        var g2 = stringToUTF8(_2, o2, s2);
        g2 + 1 >= s2 && (p2 = true);
      }
      return p2 ? -12 : 0;
    };
    _getnameinfo.sig = "ipipipii";
    var stringToNewUTF8 = (e) => {
      var t = lengthBytesUTF8(e) + 1, r2 = _malloc(t);
      return r2 && stringToUTF8(e, r2, t), r2;
    }, getCFunc = (e) => {
      var t = Module["_" + e];
      return t;
    }, writeArrayToMemory = (e, t) => {
      HEAP8.set(e, t);
    }, ccall = (e, t, r2, a2, o2) => {
      var s2 = { string: (f2) => {
        var u2 = 0;
        return f2 != null && f2 !== 0 && (u2 = stringToUTF8OnStack(f2)), u2;
      }, array: (f2) => {
        var u2 = stackAlloc(f2.length);
        return writeArrayToMemory(f2, u2), u2;
      } };
      function l2(f2) {
        return t === "string" ? UTF8ToString(f2) : t === "boolean" ? !!f2 : f2;
      }
      var n2 = getCFunc(e), _2 = [], m2 = 0;
      if (a2) for (var p2 = 0; p2 < a2.length; p2++) {
        var d2 = s2[r2[p2]];
        d2 ? (m2 === 0 && (m2 = stackSave()), _2[p2] = d2(a2[p2])) : _2[p2] = a2[p2];
      }
      var g2 = n2(..._2);
      function c2(f2) {
        return m2 !== 0 && stackRestore(m2), l2(f2);
      }
      return g2 = c2(g2), g2;
    }, cwrap = (e, t, r2, a2) => {
      var o2 = !r2 || r2.every((l2) => l2 === "number" || l2 === "boolean"), s2 = t !== "string";
      return s2 && o2 && !a2 ? getCFunc(e) : (...l2) => ccall(e, t, r2, l2);
    }, FS_createPath = FS.createPath, FS_unlink = (e) => FS.unlink(e), FS_createLazyFile = FS.createLazyFile, FS_createDevice = FS.createDevice, setTempRet0 = (e) => __emscripten_tempret_set(e), _setTempRet0 = setTempRet0;
    Module._setTempRet0 = _setTempRet0;
    var getTempRet0 = (e) => __emscripten_tempret_get(), _getTempRet0 = getTempRet0;
    Module._getTempRet0 = _getTempRet0, registerWasmPlugin(), FS.createPreloadedFile = FS_createPreloadedFile, FS.staticInit(), Module.FS_createPath = FS.createPath, Module.FS_createDataFile = FS.createDataFile, Module.FS_createPreloadedFile = FS.createPreloadedFile, Module.FS_unlink = FS.unlink, Module.FS_createLazyFile = FS.createLazyFile, Module.FS_createDevice = FS.createDevice, MEMFS.doesNotExistError = new FS.ErrnoError(44), MEMFS.doesNotExistError.stack = "<generic error, no stack>", ENVIRONMENT_IS_NODE && NODEFS.staticInit(), Module.requestAnimationFrame = MainLoop.requestAnimationFrame, Module.pauseMainLoop = MainLoop.pause, Module.resumeMainLoop = MainLoop.resume, MainLoop.init();
    var wasmImports = { __assert_fail: ___assert_fail, __call_sighandler: ___call_sighandler, __heap_base: ___heap_base, __indirect_function_table: wasmTable, __memory_base: ___memory_base, __stack_pointer: ___stack_pointer, __syscall__newselect: ___syscall__newselect, __syscall_bind: ___syscall_bind, __syscall_chdir: ___syscall_chdir, __syscall_chmod: ___syscall_chmod, __syscall_connect: ___syscall_connect, __syscall_dup: ___syscall_dup, __syscall_dup3: ___syscall_dup3, __syscall_faccessat: ___syscall_faccessat, __syscall_fadvise64: ___syscall_fadvise64, __syscall_fallocate: ___syscall_fallocate, __syscall_fcntl64: ___syscall_fcntl64, __syscall_fdatasync: ___syscall_fdatasync, __syscall_fstat64: ___syscall_fstat64, __syscall_ftruncate64: ___syscall_ftruncate64, __syscall_getcwd: ___syscall_getcwd, __syscall_getdents64: ___syscall_getdents64, __syscall_getsockname: ___syscall_getsockname, __syscall_getsockopt: ___syscall_getsockopt, __syscall_ioctl: ___syscall_ioctl, __syscall_lstat64: ___syscall_lstat64, __syscall_mkdirat: ___syscall_mkdirat, __syscall_newfstatat: ___syscall_newfstatat, __syscall_openat: ___syscall_openat, __syscall_pipe: ___syscall_pipe, __syscall_poll: ___syscall_poll, __syscall_readlinkat: ___syscall_readlinkat, __syscall_recvfrom: ___syscall_recvfrom, __syscall_renameat: ___syscall_renameat, __syscall_rmdir: ___syscall_rmdir, __syscall_sendto: ___syscall_sendto, __syscall_socket: ___syscall_socket, __syscall_stat64: ___syscall_stat64, __syscall_symlinkat: ___syscall_symlinkat, __syscall_truncate64: ___syscall_truncate64, __syscall_unlinkat: ___syscall_unlinkat, __table_base: ___table_base, _abort_js: __abort_js, _dlopen_js: __dlopen_js, _dlsym_js: __dlsym_js, _emscripten_memcpy_js: __emscripten_memcpy_js, _emscripten_runtime_keepalive_clear: __emscripten_runtime_keepalive_clear, _emscripten_system: __emscripten_system, _emscripten_throw_longjmp: __emscripten_throw_longjmp, _gmtime_js: __gmtime_js, _localtime_js: __localtime_js, _mmap_js: __mmap_js, _munmap_js: __munmap_js, _setitimer_js: __setitimer_js, _tzset_js: __tzset_js, clock_time_get: _clock_time_get, emscripten_asm_const_int: _emscripten_asm_const_int, emscripten_date_now: _emscripten_date_now, emscripten_force_exit: _emscripten_force_exit, emscripten_get_now: _emscripten_get_now, emscripten_resize_heap: _emscripten_resize_heap, emscripten_set_main_loop: _emscripten_set_main_loop, environ_get: _environ_get, environ_sizes_get: _environ_sizes_get, exit: _exit, fd_close: _fd_close, fd_fdstat_get: _fd_fdstat_get, fd_pread: _fd_pread, fd_pwrite: _fd_pwrite, fd_read: _fd_read, fd_seek: _fd_seek, fd_sync: _fd_sync, fd_write: _fd_write, getTempRet0: _getTempRet0, getaddrinfo: _getaddrinfo, getnameinfo: _getnameinfo, invoke_di, invoke_i, invoke_id, invoke_ii, invoke_iii, invoke_iiii, invoke_iiiii, invoke_iiiiii, invoke_iiiiiii, invoke_iiiiiiii, invoke_iiiiiiiii, invoke_iiiiiiiiii, invoke_iiiiiiiiiiiiiiiii, invoke_iiiiiji, invoke_iiiij, invoke_iiiijii, invoke_iiij, invoke_iiji, invoke_ij, invoke_ijiiiii, invoke_ijiiiiii, invoke_ji, invoke_jii, invoke_jiiii, invoke_jiiiii, invoke_jiiiiiiii, invoke_v, invoke_vi, invoke_vid, invoke_vii, invoke_viii, invoke_viiii, invoke_viiiii, invoke_viiiiii, invoke_viiiiiii, invoke_viiiiiiii, invoke_viiiiiiiii, invoke_viiiiiiiiiiii, invoke_viiij, invoke_viij, invoke_viiji, invoke_viijii, invoke_viijiiii, invoke_vij, invoke_viji, invoke_vijiji, invoke_vj, invoke_vji, is_web_env, memory: wasmMemory, proc_exit: _proc_exit, setTempRet0: _setTempRet0 }, wasmExports;
    createWasm();
    Module._ScanKeywordLookup = (e, t) => (Module._ScanKeywordLookup = wasmExports.ScanKeywordLookup)(e, t);
    Module._pg_snprintf = (e, t, r2, a2) => (Module._pg_snprintf = wasmExports.pg_snprintf)(e, t, r2, a2);
    Module._strlen = (e) => (Module._strlen = wasmExports.strlen)(e);
    Module._memset = (e, t, r2) => (Module._memset = wasmExports.memset)(e, t, r2);
    Module._strchr = (e, t) => (Module._strchr = wasmExports.strchr)(e, t);
    Module._PQserverVersion = (e) => (Module._PQserverVersion = wasmExports.PQserverVersion)(e);
    Module._strstr = (e, t) => (Module._strstr = wasmExports.strstr)(e, t);
    Module._pg_fprintf = (e, t, r2) => (Module._pg_fprintf = wasmExports.pg_fprintf)(e, t, r2);
    Module._strspn = (e, t) => (Module._strspn = wasmExports.strspn)(e, t);
    var _malloc = Module._malloc = (e) => (_malloc = Module._malloc = wasmExports.malloc)(e);
    Module._pg_strcasecmp = (e, t) => (Module._pg_strcasecmp = wasmExports.pg_strcasecmp)(e, t);
    Module._strcmp = (e, t) => (Module._strcmp = wasmExports.strcmp)(e, t);
    Module._free = (e) => (Module._free = wasmExports.free)(e);
    Module._pg_tolower = (e) => (Module._pg_tolower = wasmExports.pg_tolower)(e);
    Module._memchr = (e, t, r2) => (Module._memchr = wasmExports.memchr)(e, t, r2);
    Module._getenv = (e) => (Module._getenv = wasmExports.getenv)(e);
    Module._fileno = (e) => (Module._fileno = wasmExports.fileno)(e);
    Module._isatty = (e) => (Module._isatty = wasmExports.isatty)(e);
    Module._strdup = (e) => (Module._strdup = wasmExports.strdup)(e);
    Module.___errno_location = () => (Module.___errno_location = wasmExports.__errno_location)();
    var _fflush = Module._fflush = (e) => (_fflush = Module._fflush = wasmExports.fflush)(e);
    Module._pg_vsnprintf = (e, t, r2, a2) => (Module._pg_vsnprintf = wasmExports.pg_vsnprintf)(e, t, r2, a2);
    Module._pg_malloc_extended = (e, t) => (Module._pg_malloc_extended = wasmExports.pg_malloc_extended)(e, t);
    Module._PageInit = (e, t, r2) => (Module._PageInit = wasmExports.PageInit)(e, t, r2);
    Module._pg_checksum_page = (e, t) => (Module._pg_checksum_page = wasmExports.pg_checksum_page)(e, t);
    Module._errstart = (e, t) => (Module._errstart = wasmExports.errstart)(e, t);
    Module._errcode = (e) => (Module._errcode = wasmExports.errcode)(e);
    Module._errmsg = (e, t) => (Module._errmsg = wasmExports.errmsg)(e, t);
    Module._errfinish = (e, t, r2) => (Module._errfinish = wasmExports.errfinish)(e, t, r2);
    Module._PageAddItemExtended = (e, t, r2, a2, o2) => (Module._PageAddItemExtended = wasmExports.PageAddItemExtended)(e, t, r2, a2, o2);
    Module._errstart_cold = (e, t) => (Module._errstart_cold = wasmExports.errstart_cold)(e, t);
    Module._puts = (e) => (Module._puts = wasmExports.puts)(e);
    Module._errmsg_internal = (e, t) => (Module._errmsg_internal = wasmExports.errmsg_internal)(e, t);
    Module._memmove = (e, t, r2) => (Module._memmove = wasmExports.memmove)(e, t, r2);
    Module._memcpy = (e, t, r2) => (Module._memcpy = wasmExports.memcpy)(e, t, r2);
    Module._palloc = (e) => (Module._palloc = wasmExports.palloc)(e);
    Module._pfree = (e) => (Module._pfree = wasmExports.pfree)(e);
    Module._PageGetFreeSpace = (e) => (Module._PageGetFreeSpace = wasmExports.PageGetFreeSpace)(e);
    Module._PageGetExactFreeSpace = (e) => (Module._PageGetExactFreeSpace = wasmExports.PageGetExactFreeSpace)(e);
    Module._PageGetHeapFreeSpace = (e) => (Module._PageGetHeapFreeSpace = wasmExports.PageGetHeapFreeSpace)(e);
    Module._PageIndexMultiDelete = (e, t, r2) => (Module._PageIndexMultiDelete = wasmExports.PageIndexMultiDelete)(e, t, r2);
    Module._PageIndexTupleOverwrite = (e, t, r2, a2) => (Module._PageIndexTupleOverwrite = wasmExports.PageIndexTupleOverwrite)(e, t, r2, a2);
    Module._ItemPointerEquals = (e, t) => (Module._ItemPointerEquals = wasmExports.ItemPointerEquals)(e, t);
    Module._ItemPointerCompare = (e, t) => (Module._ItemPointerCompare = wasmExports.ItemPointerCompare)(e, t);
    Module._add_size = (e, t) => (Module._add_size = wasmExports.add_size)(e, t);
    Module._ShmemInitStruct = (e, t, r2) => (Module._ShmemInitStruct = wasmExports.ShmemInitStruct)(e, t, r2);
    Module._s_init_lock_sema = (e, t) => (Module._s_init_lock_sema = wasmExports.s_init_lock_sema)(e, t);
    Module._LWLockAcquire = (e, t) => (Module._LWLockAcquire = wasmExports.LWLockAcquire)(e, t);
    Module._LWLockRelease = (e) => (Module._LWLockRelease = wasmExports.LWLockRelease)(e);
    Module._on_shmem_exit = (e, t) => (Module._on_shmem_exit = wasmExports.on_shmem_exit)(e, t);
    Module._tas_sema = (e) => (Module._tas_sema = wasmExports.tas_sema)(e);
    Module._s_lock = (e, t, r2, a2) => (Module._s_lock = wasmExports.s_lock)(e, t, r2, a2);
    Module._s_unlock_sema = (e) => (Module._s_unlock_sema = wasmExports.s_unlock_sema)(e);
    Module._StartTransactionCommand = () => (Module._StartTransactionCommand = wasmExports.StartTransactionCommand)();
    Module._CommitTransactionCommand = () => (Module._CommitTransactionCommand = wasmExports.CommitTransactionCommand)();
    Module._WaitLatch = (e, t, r2, a2) => (Module._WaitLatch = wasmExports.WaitLatch)(e, t, r2, a2);
    Module._ResetLatch = (e) => (Module._ResetLatch = wasmExports.ResetLatch)(e);
    Module._ProcessInterrupts = () => (Module._ProcessInterrupts = wasmExports.ProcessInterrupts)();
    Module._MemoryContextAlloc = (e, t) => (Module._MemoryContextAlloc = wasmExports.MemoryContextAlloc)(e, t);
    Module._AllocateDir = (e) => (Module._AllocateDir = wasmExports.AllocateDir)(e);
    Module._ReadDir = (e, t) => (Module._ReadDir = wasmExports.ReadDir)(e, t);
    Module._strncmp = (e, t, r2) => (Module._strncmp = wasmExports.strncmp)(e, t, r2);
    Module._unlink = (e) => (Module._unlink = wasmExports.unlink)(e);
    Module._errcode_for_file_access = () => (Module._errcode_for_file_access = wasmExports.errcode_for_file_access)();
    Module._FreeDir = (e) => (Module._FreeDir = wasmExports.FreeDir)(e);
    Module._pg_prng_uint32 = (e) => (Module._pg_prng_uint32 = wasmExports.pg_prng_uint32)(e);
    Module._dsm_create = (e, t) => (Module._dsm_create = wasmExports.dsm_create)(e, t);
    Module._dsm_attach = (e) => (Module._dsm_attach = wasmExports.dsm_attach)(e);
    Module._dsm_detach = (e) => (Module._dsm_detach = wasmExports.dsm_detach)(e);
    Module._dsm_segment_address = (e) => (Module._dsm_segment_address = wasmExports.dsm_segment_address)(e);
    Module._dsm_segment_handle = (e) => (Module._dsm_segment_handle = wasmExports.dsm_segment_handle)(e);
    Module._MemoryContextAllocZero = (e, t) => (Module._MemoryContextAllocZero = wasmExports.MemoryContextAllocZero)(e, t);
    Module._read = (e, t, r2) => (Module._read = wasmExports.read)(e, t, r2);
    Module._hash_create = (e, t, r2, a2) => (Module._hash_create = wasmExports.hash_create)(e, t, r2, a2);
    Module._hash_destroy = (e) => (Module._hash_destroy = wasmExports.hash_destroy)(e);
    Module._hash_seq_init = (e, t) => (Module._hash_seq_init = wasmExports.hash_seq_init)(e, t);
    Module._hash_seq_search = (e) => (Module._hash_seq_search = wasmExports.hash_seq_search)(e);
    Module._hash_search = (e, t, r2, a2) => (Module._hash_search = wasmExports.hash_search)(e, t, r2, a2);
    Module._initStringInfo = (e) => (Module._initStringInfo = wasmExports.initStringInfo)(e);
    Module._appendStringInfo = (e, t, r2) => (Module._appendStringInfo = wasmExports.appendStringInfo)(e, t, r2);
    Module._GetCurrentTimestamp = () => (Module._GetCurrentTimestamp = wasmExports.GetCurrentTimestamp)();
    Module._pg_usleep = (e) => (Module._pg_usleep = wasmExports.pg_usleep)(e);
    Module._errdetail = (e, t) => (Module._errdetail = wasmExports.errdetail)(e, t);
    Module._TransactionIdDidCommit = (e) => (Module._TransactionIdDidCommit = wasmExports.TransactionIdDidCommit)(e);
    Module._TransactionIdPrecedes = (e, t) => (Module._TransactionIdPrecedes = wasmExports.TransactionIdPrecedes)(e, t);
    Module._XLogBeginInsert = () => (Module._XLogBeginInsert = wasmExports.XLogBeginInsert)();
    Module._XLogRegisterData = (e, t) => (Module._XLogRegisterData = wasmExports.XLogRegisterData)(e, t);
    Module._XLogInsert = (e, t) => (Module._XLogInsert = wasmExports.XLogInsert)(e, t);
    Module._ConditionVariableInit = (e) => (Module._ConditionVariableInit = wasmExports.ConditionVariableInit)(e);
    Module._ConditionVariableCancelSleep = () => (Module._ConditionVariableCancelSleep = wasmExports.ConditionVariableCancelSleep)();
    Module._ConditionVariableSleep = (e, t) => (Module._ConditionVariableSleep = wasmExports.ConditionVariableSleep)(e, t);
    Module.___wasm_setjmp = (e, t, r2) => (Module.___wasm_setjmp = wasmExports.__wasm_setjmp)(e, t, r2);
    Module.___wasm_setjmp_test = (e, t) => (Module.___wasm_setjmp_test = wasmExports.__wasm_setjmp_test)(e, t);
    Module._pg_re_throw = () => (Module._pg_re_throw = wasmExports.pg_re_throw)();
    Module._emscripten_longjmp = (e, t) => (Module._emscripten_longjmp = wasmExports.emscripten_longjmp)(e, t);
    Module._procsignal_sigusr1_handler = (e) => (Module._procsignal_sigusr1_handler = wasmExports.procsignal_sigusr1_handler)(e);
    Module._close = (e) => (Module._close = wasmExports.close)(e);
    Module._ReleaseExternalFD = () => (Module._ReleaseExternalFD = wasmExports.ReleaseExternalFD)();
    Module._fcntl = (e, t, r2) => (Module._fcntl = wasmExports.fcntl)(e, t, r2);
    Module._pqsignal = (e, t) => (Module._pqsignal = wasmExports.pqsignal)(e, t);
    Module._write = (e, t, r2) => (Module._write = wasmExports.write)(e, t, r2);
    Module._AddWaitEventToSet = (e, t, r2, a2, o2) => (Module._AddWaitEventToSet = wasmExports.AddWaitEventToSet)(e, t, r2, a2, o2);
    Module._clock_gettime = (e, t) => (Module._clock_gettime = wasmExports.clock_gettime)(e, t);
    Module._poll = (e, t, r2) => (Module._poll = wasmExports.poll)(e, t, r2);
    Module._WaitLatchOrSocket = (e, t, r2, a2, o2) => (Module._WaitLatchOrSocket = wasmExports.WaitLatchOrSocket)(e, t, r2, a2, o2);
    Module._GetNumRegisteredWaitEvents = (e) => (Module._GetNumRegisteredWaitEvents = wasmExports.GetNumRegisteredWaitEvents)(e);
    Module._ShmemInitHash = (e, t, r2, a2, o2) => (Module._ShmemInitHash = wasmExports.ShmemInitHash)(e, t, r2, a2, o2);
    Module._InitMaterializedSRF = (e, t) => (Module._InitMaterializedSRF = wasmExports.InitMaterializedSRF)(e, t);
    Module._cstring_to_text = (e) => (Module._cstring_to_text = wasmExports.cstring_to_text)(e);
    Module._Int64GetDatum = (e) => (Module._Int64GetDatum = wasmExports.Int64GetDatum)(e);
    Module._tuplestore_putvalues = (e, t, r2, a2) => (Module._tuplestore_putvalues = wasmExports.tuplestore_putvalues)(e, t, r2, a2);
    Module._shm_toc_allocate = (e, t) => (Module._shm_toc_allocate = wasmExports.shm_toc_allocate)(e, t);
    Module._shm_toc_insert = (e, t, r2) => (Module._shm_toc_insert = wasmExports.shm_toc_insert)(e, t, r2);
    Module._shm_toc_lookup = (e, t, r2) => (Module._shm_toc_lookup = wasmExports.shm_toc_lookup)(e, t, r2);
    Module._superuser_arg = (e) => (Module._superuser_arg = wasmExports.superuser_arg)(e);
    Module._superuser = () => (Module._superuser = wasmExports.superuser)();
    Module._GetUserId = () => (Module._GetUserId = wasmExports.GetUserId)();
    Module._has_privs_of_role = (e, t) => (Module._has_privs_of_role = wasmExports.has_privs_of_role)(e, t);
    Module._errmsg_plural = (e, t, r2, a2) => (Module._errmsg_plural = wasmExports.errmsg_plural)(e, t, r2, a2);
    Module._errhint = (e, t) => (Module._errhint = wasmExports.errhint)(e, t);
    Module._fstat = (e, t) => (Module._fstat = wasmExports.fstat)(e, t);
    Module._ftruncate = (e, t) => (Module._ftruncate = wasmExports.ftruncate)(e, t);
    Module._RequestAddinShmemSpace = (e) => (Module._RequestAddinShmemSpace = wasmExports.RequestAddinShmemSpace)(e);
    Module._hash_estimate_size = (e, t) => (Module._hash_estimate_size = wasmExports.hash_estimate_size)(e, t);
    Module._pg_sprintf = (e, t, r2) => (Module._pg_sprintf = wasmExports.pg_sprintf)(e, t, r2);
    Module._SetConfigOption = (e, t, r2, a2) => (Module._SetConfigOption = wasmExports.SetConfigOption)(e, t, r2, a2);
    Module._pg_printf = (e, t) => (Module._pg_printf = wasmExports.pg_printf)(e, t);
    Module._before_shmem_exit = (e, t) => (Module._before_shmem_exit = wasmExports.before_shmem_exit)(e, t);
    Module._cancel_before_shmem_exit = (e, t) => (Module._cancel_before_shmem_exit = wasmExports.cancel_before_shmem_exit)(e, t);
    Module._pg_qsort = (e, t, r2, a2) => (Module._pg_qsort = wasmExports.pg_qsort)(e, t, r2, a2);
    Module._TransactionIdIsInProgress = (e) => (Module._TransactionIdIsInProgress = wasmExports.TransactionIdIsInProgress)(e);
    Module._TransactionIdIsCurrentTransactionId = (e) => (Module._TransactionIdIsCurrentTransactionId = wasmExports.TransactionIdIsCurrentTransactionId)(e);
    Module._RecoveryInProgress = () => (Module._RecoveryInProgress = wasmExports.RecoveryInProgress)();
    Module._GetOldestNonRemovableTransactionId = (e) => (Module._GetOldestNonRemovableTransactionId = wasmExports.GetOldestNonRemovableTransactionId)(e);
    Module._GetCurrentCommandId = (e) => (Module._GetCurrentCommandId = wasmExports.GetCurrentCommandId)(e);
    Module._BackendXidGetPid = (e) => (Module._BackendXidGetPid = wasmExports.BackendXidGetPid)(e);
    Module._lappend_int = (e, t) => (Module._lappend_int = wasmExports.lappend_int)(e, t);
    Module._index_close = (e, t) => (Module._index_close = wasmExports.index_close)(e, t);
    Module._table_close = (e, t) => (Module._table_close = wasmExports.table_close)(e, t);
    Module._CommandCounterIncrement = () => (Module._CommandCounterIncrement = wasmExports.CommandCounterIncrement)();
    Module._GetActiveSnapshot = () => (Module._GetActiveSnapshot = wasmExports.GetActiveSnapshot)();
    Module._ScanKeyInit = (e, t, r2, a2, o2) => (Module._ScanKeyInit = wasmExports.ScanKeyInit)(e, t, r2, a2, o2);
    Module._table_open = (e, t) => (Module._table_open = wasmExports.table_open)(e, t);
    Module._systable_beginscan = (e, t, r2, a2, o2, s2) => (Module._systable_beginscan = wasmExports.systable_beginscan)(e, t, r2, a2, o2, s2);
    Module._systable_getnext = (e) => (Module._systable_getnext = wasmExports.systable_getnext)(e);
    Module._systable_endscan = (e) => (Module._systable_endscan = wasmExports.systable_endscan)(e);
    Module._index_open = (e, t) => (Module._index_open = wasmExports.index_open)(e, t);
    Module._systable_beginscan_ordered = (e, t, r2, a2, o2) => (Module._systable_beginscan_ordered = wasmExports.systable_beginscan_ordered)(e, t, r2, a2, o2);
    Module._systable_getnext_ordered = (e, t) => (Module._systable_getnext_ordered = wasmExports.systable_getnext_ordered)(e, t);
    Module._systable_endscan_ordered = (e) => (Module._systable_endscan_ordered = wasmExports.systable_endscan_ordered)(e);
    Module._heap_form_tuple = (e, t, r2) => (Module._heap_form_tuple = wasmExports.heap_form_tuple)(e, t, r2);
    Module._heap_freetuple = (e) => (Module._heap_freetuple = wasmExports.heap_freetuple)(e);
    Module._AllocSetContextCreateInternal = (e, t, r2, a2, o2) => (Module._AllocSetContextCreateInternal = wasmExports.AllocSetContextCreateInternal)(e, t, r2, a2, o2);
    Module._list_free_deep = (e) => (Module._list_free_deep = wasmExports.list_free_deep)(e);
    Module._lappend = (e, t) => (Module._lappend = wasmExports.lappend)(e, t);
    Module._LockBuffer = (e, t) => (Module._LockBuffer = wasmExports.LockBuffer)(e, t);
    Module._GetFreeIndexPage = (e) => (Module._GetFreeIndexPage = wasmExports.GetFreeIndexPage)(e);
    Module._RecordFreeIndexPage = (e, t) => (Module._RecordFreeIndexPage = wasmExports.RecordFreeIndexPage)(e, t);
    Module._IndexFreeSpaceMapVacuum = (e) => (Module._IndexFreeSpaceMapVacuum = wasmExports.IndexFreeSpaceMapVacuum)(e);
    Module._UnlockReleaseBuffer = (e) => (Module._UnlockReleaseBuffer = wasmExports.UnlockReleaseBuffer)(e);
    Module._smgropen = (e, t) => (Module._smgropen = wasmExports.smgropen)(e, t);
    Module._smgrsetowner = (e, t) => (Module._smgrsetowner = wasmExports.smgrsetowner)(e, t);
    Module._RelationGetNumberOfBlocksInFork = (e, t) => (Module._RelationGetNumberOfBlocksInFork = wasmExports.RelationGetNumberOfBlocksInFork)(e, t);
    Module._ReleaseBuffer = (e) => (Module._ReleaseBuffer = wasmExports.ReleaseBuffer)(e);
    Module._GetRecordedFreeSpace = (e, t) => (Module._GetRecordedFreeSpace = wasmExports.GetRecordedFreeSpace)(e, t);
    Module._smgrexists = (e, t) => (Module._smgrexists = wasmExports.smgrexists)(e, t);
    Module._ReadBufferExtended = (e, t, r2, a2, o2) => (Module._ReadBufferExtended = wasmExports.ReadBufferExtended)(e, t, r2, a2, o2);
    Module._MarkBufferDirty = (e) => (Module._MarkBufferDirty = wasmExports.MarkBufferDirty)(e);
    Module._log_newpage_buffer = (e, t) => (Module._log_newpage_buffer = wasmExports.log_newpage_buffer)(e, t);
    Module._copy_file = (e, t) => (Module._copy_file = wasmExports.copy_file)(e, t);
    Module._fd_fsync_fname = (e, t) => (Module._fd_fsync_fname = wasmExports.fd_fsync_fname)(e, t);
    Module._OpenTransientFile = (e, t) => (Module._OpenTransientFile = wasmExports.OpenTransientFile)(e, t);
    Module._CloseTransientFile = (e) => (Module._CloseTransientFile = wasmExports.CloseTransientFile)(e);
    Module._hash_bytes = (e, t) => (Module._hash_bytes = wasmExports.hash_bytes)(e, t);
    Module._pstrdup = (e) => (Module._pstrdup = wasmExports.pstrdup)(e);
    Module._repalloc = (e, t) => (Module._repalloc = wasmExports.repalloc)(e, t);
    Module._wasm_OpenPipeStream = (e, t) => (Module._wasm_OpenPipeStream = wasmExports.wasm_OpenPipeStream)(e, t);
    Module._access = (e, t) => (Module._access = wasmExports.access)(e, t);
    Module._fopen = (e, t) => (Module._fopen = wasmExports.fopen)(e, t);
    Module._fiprintf = (e, t, r2) => (Module._fiprintf = wasmExports.fiprintf)(e, t, r2);
    Module._fclose = (e) => (Module._fclose = wasmExports.fclose)(e);
    Module._fsync_fname_ext = (e, t, r2, a2) => (Module._fsync_fname_ext = wasmExports.fsync_fname_ext)(e, t, r2, a2);
    Module._fd_durable_rename = (e, t, r2) => (Module._fd_durable_rename = wasmExports.fd_durable_rename)(e, t, r2);
    Module._rename = (e, t) => (Module._rename = wasmExports.rename)(e, t);
    Module._strlcpy = (e, t, r2) => (Module._strlcpy = wasmExports.strlcpy)(e, t, r2);
    Module._dup = (e) => (Module._dup = wasmExports.dup)(e);
    Module._open = (e, t, r2) => (Module._open = wasmExports.open)(e, t, r2);
    Module._AcquireExternalFD = () => (Module._AcquireExternalFD = wasmExports.AcquireExternalFD)();
    Module._realloc = (e, t) => (Module._realloc = wasmExports.realloc)(e, t);
    Module._stat = (e, t) => (Module._stat = wasmExports.stat)(e, t);
    Module._pwrite = (e, t, r2, a2) => (Module._pwrite = wasmExports.pwrite)(e, t, r2, a2);
    Module._lseek = (e, t, r2) => (Module._lseek = wasmExports.lseek)(e, t, r2);
    Module._AllocateFile = (e, t) => (Module._AllocateFile = wasmExports.AllocateFile)(e, t);
    Module._GetCurrentSubTransactionId = () => (Module._GetCurrentSubTransactionId = wasmExports.GetCurrentSubTransactionId)();
    Module._FreeFile = (e) => (Module._FreeFile = wasmExports.FreeFile)(e);
    Module._pclose = (e) => (Module._pclose = wasmExports.pclose)(e);
    Module._ClosePipeStream = (e) => (Module._ClosePipeStream = wasmExports.ClosePipeStream)(e);
    Module._pg_prng_uint64_range = (e, t, r2) => (Module._pg_prng_uint64_range = wasmExports.pg_prng_uint64_range)(e, t, r2);
    Module._AtEOSubXact_Files = (e, t, r2) => (Module._AtEOSubXact_Files = wasmExports.AtEOSubXact_Files)(e, t, r2);
    Module._pre_format_elog_string = (e, t) => (Module._pre_format_elog_string = wasmExports.pre_format_elog_string)(e, t);
    Module._format_elog_string = (e, t) => (Module._format_elog_string = wasmExports.format_elog_string)(e, t);
    Module._list_free = (e) => (Module._list_free = wasmExports.list_free)(e);
    Module._guc_malloc = (e, t) => (Module._guc_malloc = wasmExports.guc_malloc)(e, t);
    Module._MemoryContextDelete = (e) => (Module._MemoryContextDelete = wasmExports.MemoryContextDelete)(e);
    Module._strtoul = (e, t, r2) => (Module._strtoul = wasmExports.strtoul)(e, t, r2);
    Module._hash_get_num_entries = (e) => (Module._hash_get_num_entries = wasmExports.hash_get_num_entries)(e);
    Module._LWLockInitialize = (e, t) => (Module._LWLockInitialize = wasmExports.LWLockInitialize)(e, t);
    Module._PrefetchBuffer = (e, t, r2, a2) => (Module._PrefetchBuffer = wasmExports.PrefetchBuffer)(e, t, r2, a2);
    Module._LockBufHdr = (e) => (Module._LockBufHdr = wasmExports.LockBufHdr)(e);
    Module._ReadBuffer = (e, t) => (Module._ReadBuffer = wasmExports.ReadBuffer)(e, t);
    Module._pgstat_assoc_relation = (e) => (Module._pgstat_assoc_relation = wasmExports.pgstat_assoc_relation)(e);
    Module._ExtendBufferedRel = (e, t, r2, a2) => (Module._ExtendBufferedRel = wasmExports.ExtendBufferedRel)(e, t, r2, a2);
    Module._LockBufferForCleanup = (e) => (Module._LockBufferForCleanup = wasmExports.LockBufferForCleanup)(e);
    Module._smgrread = (e, t, r2, a2) => (Module._smgrread = wasmExports.smgrread)(e, t, r2, a2);
    Module._LockRelationForExtension = (e, t) => (Module._LockRelationForExtension = wasmExports.LockRelationForExtension)(e, t);
    Module._UnlockRelationForExtension = (e, t) => (Module._UnlockRelationForExtension = wasmExports.UnlockRelationForExtension)(e, t);
    Module._BufferGetBlockNumber = (e) => (Module._BufferGetBlockNumber = wasmExports.BufferGetBlockNumber)(e);
    Module._bsearch = (e, t, r2, a2, o2) => (Module._bsearch = wasmExports.bsearch)(e, t, r2, a2, o2);
    Module._set_errcontext_domain = (e) => (Module._set_errcontext_domain = wasmExports.set_errcontext_domain)(e);
    Module._errcontext_msg = (e, t) => (Module._errcontext_msg = wasmExports.errcontext_msg)(e, t);
    Module._GetAccessStrategy = (e) => (Module._GetAccessStrategy = wasmExports.GetAccessStrategy)(e);
    Module._FreeAccessStrategy = (e) => (Module._FreeAccessStrategy = wasmExports.FreeAccessStrategy)(e);
    Module._ConditionalLockBuffer = (e) => (Module._ConditionalLockBuffer = wasmExports.ConditionalLockBuffer)(e);
    Module._TestForOldSnapshot_impl = (e, t) => (Module._TestForOldSnapshot_impl = wasmExports.TestForOldSnapshot_impl)(e, t);
    var _calloc = Module._calloc = (e, t) => (_calloc = Module._calloc = wasmExports.calloc)(e, t);
    Module._have_free_buffer = () => (Module._have_free_buffer = wasmExports.have_free_buffer)();
    Module._palloc0 = (e) => (Module._palloc0 = wasmExports.palloc0)(e);
    Module._resetStringInfo = (e) => (Module._resetStringInfo = wasmExports.resetStringInfo)(e);
    Module._appendStringInfoChar = (e, t) => (Module._appendStringInfoChar = wasmExports.appendStringInfoChar)(e, t);
    Module._appendBinaryStringInfo = (e, t, r2) => (Module._appendBinaryStringInfo = wasmExports.appendBinaryStringInfo)(e, t, r2);
    Module._errdetail_internal = (e, t) => (Module._errdetail_internal = wasmExports.errdetail_internal)(e, t);
    Module._strcpy = (e, t) => (Module._strcpy = wasmExports.strcpy)(e, t);
    Module._LWLockRegisterTranche = (e, t) => (Module._LWLockRegisterTranche = wasmExports.LWLockRegisterTranche)(e, t);
    Module._GetNamedLWLockTranche = (e) => (Module._GetNamedLWLockTranche = wasmExports.GetNamedLWLockTranche)(e);
    Module._LWLockNewTrancheId = () => (Module._LWLockNewTrancheId = wasmExports.LWLockNewTrancheId)();
    Module._RequestNamedLWLockTranche = (e, t) => (Module._RequestNamedLWLockTranche = wasmExports.RequestNamedLWLockTranche)(e, t);
    Module._pg_prng_double = (e) => (Module._pg_prng_double = wasmExports.pg_prng_double)(e);
    Module._getpid = () => (Module._getpid = wasmExports.getpid)();
    Module._GetTransactionSnapshot = () => (Module._GetTransactionSnapshot = wasmExports.GetTransactionSnapshot)();
    Module._ConditionVariableSignal = (e) => (Module._ConditionVariableSignal = wasmExports.ConditionVariableSignal)(e);
    Module._LockPage = (e, t, r2) => (Module._LockPage = wasmExports.LockPage)(e, t, r2);
    Module._UnlockPage = (e, t, r2) => (Module._UnlockPage = wasmExports.UnlockPage)(e, t, r2);
    Module._pgstat_progress_update_param = (e, t) => (Module._pgstat_progress_update_param = wasmExports.pgstat_progress_update_param)(e, t);
    Module._list_make1_impl = (e, t) => (Module._list_make1_impl = wasmExports.list_make1_impl)(e, t);
    Module._psprintf = (e, t) => (Module._psprintf = wasmExports.psprintf)(e, t);
    Module._smgrtruncate = (e, t, r2, a2) => (Module._smgrtruncate = wasmExports.smgrtruncate)(e, t, r2, a2);
    Module._log = (e) => (Module._log = wasmExports.log)(e);
    Module._pairingheap_allocate = (e, t) => (Module._pairingheap_allocate = wasmExports.pairingheap_allocate)(e, t);
    Module._pairingheap_add = (e, t) => (Module._pairingheap_add = wasmExports.pairingheap_add)(e, t);
    Module._pairingheap_first = (e) => (Module._pairingheap_first = wasmExports.pairingheap_first)(e);
    Module._pairingheap_remove_first = (e) => (Module._pairingheap_remove_first = wasmExports.pairingheap_remove_first)(e);
    Module._bloom_create = (e, t, r2) => (Module._bloom_create = wasmExports.bloom_create)(e, t, r2);
    Module._bloom_free = (e) => (Module._bloom_free = wasmExports.bloom_free)(e);
    Module._bloom_add_element = (e, t, r2) => (Module._bloom_add_element = wasmExports.bloom_add_element)(e, t, r2);
    Module._hash_bytes_extended = (e, t, r2) => (Module._hash_bytes_extended = wasmExports.hash_bytes_extended)(e, t, r2);
    Module._bloom_lacks_element = (e, t, r2) => (Module._bloom_lacks_element = wasmExports.bloom_lacks_element)(e, t, r2);
    Module._bloom_prop_bits_set = (e) => (Module._bloom_prop_bits_set = wasmExports.bloom_prop_bits_set)(e);
    Module._pg_popcount = (e, t) => (Module._pg_popcount = wasmExports.pg_popcount)(e, t);
    Module._memcmp = (e, t, r2) => (Module._memcmp = wasmExports.memcmp)(e, t, r2);
    Module._bms_make_singleton = (e) => (Module._bms_make_singleton = wasmExports.bms_make_singleton)(e);
    Module._bms_add_members = (e, t) => (Module._bms_add_members = wasmExports.bms_add_members)(e, t);
    Module._bms_add_member = (e, t) => (Module._bms_add_member = wasmExports.bms_add_member)(e, t);
    Module._bms_del_member = (e, t) => (Module._bms_del_member = wasmExports.bms_del_member)(e, t);
    Module._check_stack_depth = () => (Module._check_stack_depth = wasmExports.check_stack_depth)();
    Module._parser_errposition = (e, t) => (Module._parser_errposition = wasmExports.parser_errposition)(e, t);
    Module._makeVar = (e, t, r2, a2, o2, s2) => (Module._makeVar = wasmExports.makeVar)(e, t, r2, a2, o2, s2);
    Module._bms_union = (e, t) => (Module._bms_union = wasmExports.bms_union)(e, t);
    Module._varstr_levenshtein_less_equal = (e, t, r2, a2, o2, s2, l2, n2, _2) => (Module._varstr_levenshtein_less_equal = wasmExports.varstr_levenshtein_less_equal)(e, t, r2, a2, o2, s2, l2, n2, _2);
    Module._SearchSysCacheExists = (e, t, r2, a2, o2) => (Module._SearchSysCacheExists = wasmExports.SearchSysCacheExists)(e, t, r2, a2, o2);
    Module._MemoryContextAllocZeroAligned = (e, t) => (Module._MemoryContextAllocZeroAligned = wasmExports.MemoryContextAllocZeroAligned)(e, t);
    Module._makeString = (e) => (Module._makeString = wasmExports.makeString)(e);
    Module._addRTEPermissionInfo = (e, t) => (Module._addRTEPermissionInfo = wasmExports.addRTEPermissionInfo)(e, t);
    Module._copyObjectImpl = (e) => (Module._copyObjectImpl = wasmExports.copyObjectImpl)(e);
    Module._exprType = (e) => (Module._exprType = wasmExports.exprType)(e);
    Module._lappend_oid = (e, t) => (Module._lappend_oid = wasmExports.lappend_oid)(e, t);
    Module._exprTypmod = (e) => (Module._exprTypmod = wasmExports.exprTypmod)(e);
    Module._exprLocation = (e) => (Module._exprLocation = wasmExports.exprLocation)(e);
    Module._CreateTemplateTupleDesc = (e) => (Module._CreateTemplateTupleDesc = wasmExports.CreateTemplateTupleDesc)(e);
    Module._TupleDescInitEntry = (e, t, r2, a2, o2, s2) => (Module._TupleDescInitEntry = wasmExports.TupleDescInitEntry)(e, t, r2, a2, o2, s2);
    Module._TupleDescInitEntryCollation = (e, t, r2) => (Module._TupleDescInitEntryCollation = wasmExports.TupleDescInitEntryCollation)(e, t, r2);
    Module._typenameTypeIdAndMod = (e, t, r2, a2) => (Module._typenameTypeIdAndMod = wasmExports.typenameTypeIdAndMod)(e, t, r2, a2);
    Module._format_type_be = (e) => (Module._format_type_be = wasmExports.format_type_be)(e);
    Module._list_concat = (e, t) => (Module._list_concat = wasmExports.list_concat)(e, t);
    Module._list_copy = (e) => (Module._list_copy = wasmExports.list_copy)(e);
    Module._relation_open = (e, t) => (Module._relation_open = wasmExports.relation_open)(e, t);
    Module._relation_close = (e, t) => (Module._relation_close = wasmExports.relation_close)(e, t);
    Module._makeTargetEntry = (e, t, r2, a2) => (Module._makeTargetEntry = wasmExports.makeTargetEntry)(e, t, r2, a2);
    Module._get_attname = (e, t, r2) => (Module._get_attname = wasmExports.get_attname)(e, t, r2);
    Module._SearchSysCache2 = (e, t, r2) => (Module._SearchSysCache2 = wasmExports.SearchSysCache2)(e, t, r2);
    Module._ReleaseSysCache = (e) => (Module._ReleaseSysCache = wasmExports.ReleaseSysCache)(e);
    Module._RangeVarGetRelidExtended = (e, t, r2, a2, o2) => (Module._RangeVarGetRelidExtended = wasmExports.RangeVarGetRelidExtended)(e, t, r2, a2, o2);
    Module._pg_mbstrlen_with_len = (e, t) => (Module._pg_mbstrlen_with_len = wasmExports.pg_mbstrlen_with_len)(e, t);
    Module._errposition = (e) => (Module._errposition = wasmExports.errposition)(e);
    Module._numeric_in = (e) => (Module._numeric_in = wasmExports.numeric_in)(e);
    Module._DirectFunctionCall3Coll = (e, t, r2, a2, o2) => (Module._DirectFunctionCall3Coll = wasmExports.DirectFunctionCall3Coll)(e, t, r2, a2, o2);
    Module._bit_in = (e) => (Module._bit_in = wasmExports.bit_in)(e);
    Module._NameListToString = (e) => (Module._NameListToString = wasmExports.NameListToString)(e);
    Module._appendStringInfoString = (e, t) => (Module._appendStringInfoString = wasmExports.appendStringInfoString)(e, t);
    Module._lookup_type_cache = (e, t) => (Module._lookup_type_cache = wasmExports.lookup_type_cache)(e, t);
    Module._CacheRegisterSyscacheCallback = (e, t, r2) => (Module._CacheRegisterSyscacheCallback = wasmExports.CacheRegisterSyscacheCallback)(e, t, r2);
    Module._SearchSysCache1 = (e, t) => (Module._SearchSysCache1 = wasmExports.SearchSysCache1)(e, t);
    Module._list_make2_impl = (e, t, r2) => (Module._list_make2_impl = wasmExports.list_make2_impl)(e, t, r2);
    Module._get_base_element_type = (e) => (Module._get_base_element_type = wasmExports.get_base_element_type)(e);
    Module._downcase_truncate_identifier = (e, t, r2) => (Module._downcase_truncate_identifier = wasmExports.downcase_truncate_identifier)(e, t, r2);
    Module._pg_database_encoding_max_length = () => (Module._pg_database_encoding_max_length = wasmExports.pg_database_encoding_max_length)();
    Module._truncate_identifier = (e, t, r2) => (Module._truncate_identifier = wasmExports.truncate_identifier)(e, t, r2);
    Module._scanner_isspace = (e) => (Module._scanner_isspace = wasmExports.scanner_isspace)(e);
    Module._get_typcollation = (e) => (Module._get_typcollation = wasmExports.get_typcollation)(e);
    Module._list_delete_cell = (e, t) => (Module._list_delete_cell = wasmExports.list_delete_cell)(e, t);
    Module._makeTypeNameFromNameList = (e) => (Module._makeTypeNameFromNameList = wasmExports.makeTypeNameFromNameList)(e);
    Module._SysCacheGetAttrNotNull = (e, t, r2) => (Module._SysCacheGetAttrNotNull = wasmExports.SysCacheGetAttrNotNull)(e, t, r2);
    Module._text_to_cstring = (e) => (Module._text_to_cstring = wasmExports.text_to_cstring)(e);
    Module._stringToNode = (e) => (Module._stringToNode = wasmExports.stringToNode)(e);
    Module._bms_is_member = (e, t) => (Module._bms_is_member = wasmExports.bms_is_member)(e, t);
    Module._bms_free = (e) => (Module._bms_free = wasmExports.bms_free)(e);
    Module._core_yylex = (e, t, r2) => (Module._core_yylex = wasmExports.core_yylex)(e, t, r2);
    Module._getc = (e) => (Module._getc = wasmExports.getc)(e);
    Module._ferror = (e) => (Module._ferror = wasmExports.ferror)(e);
    Module._fread = (e, t, r2, a2) => (Module._fread = wasmExports.fread)(e, t, r2, a2);
    Module._clearerr = (e) => (Module._clearerr = wasmExports.clearerr)(e);
    Module._scanner_init = (e, t, r2, a2) => (Module._scanner_init = wasmExports.scanner_init)(e, t, r2, a2);
    Module._scanner_finish = (e) => (Module._scanner_finish = wasmExports.scanner_finish)(e);
    Module._get_namespace_name = (e) => (Module._get_namespace_name = wasmExports.get_namespace_name)(e);
    Module._lookup_rowtype_tupdesc = (e, t) => (Module._lookup_rowtype_tupdesc = wasmExports.lookup_rowtype_tupdesc)(e, t);
    Module._DecrTupleDescRefCount = (e) => (Module._DecrTupleDescRefCount = wasmExports.DecrTupleDescRefCount)(e);
    Module._relation_openrv = (e, t) => (Module._relation_openrv = wasmExports.relation_openrv)(e, t);
    Module._errdetail_relkind_not_supported = (e) => (Module._errdetail_relkind_not_supported = wasmExports.errdetail_relkind_not_supported)(e);
    Module._object_aclcheck = (e, t, r2, a2) => (Module._object_aclcheck = wasmExports.object_aclcheck)(e, t, r2, a2);
    Module._aclcheck_error = (e, t, r2) => (Module._aclcheck_error = wasmExports.aclcheck_error)(e, t, r2);
    Module._pg_class_aclcheck = (e, t, r2) => (Module._pg_class_aclcheck = wasmExports.pg_class_aclcheck)(e, t, r2);
    Module._get_relkind_objtype = (e) => (Module._get_relkind_objtype = wasmExports.get_relkind_objtype)(e);
    Module._list_make3_impl = (e, t, r2, a2) => (Module._list_make3_impl = wasmExports.list_make3_impl)(e, t, r2, a2);
    Module._quote_qualified_identifier = (e, t) => (Module._quote_qualified_identifier = wasmExports.quote_qualified_identifier)(e, t);
    Module._table_openrv = (e, t) => (Module._table_openrv = wasmExports.table_openrv)(e, t);
    Module._equal = (e, t) => (Module._equal = wasmExports.equal)(e, t);
    Module._RelationGetIndexList = (e) => (Module._RelationGetIndexList = wasmExports.RelationGetIndexList)(e);
    Module._pg_detoast_datum = (e) => (Module._pg_detoast_datum = wasmExports.pg_detoast_datum)(e);
    Module._SysCacheGetAttr = (e, t, r2, a2) => (Module._SysCacheGetAttr = wasmExports.SysCacheGetAttr)(e, t, r2, a2);
    Module._deconstruct_array_builtin = (e, t, r2, a2, o2) => (Module._deconstruct_array_builtin = wasmExports.deconstruct_array_builtin)(e, t, r2, a2, o2);
    Module._untransformRelOptions = (e) => (Module._untransformRelOptions = wasmExports.untransformRelOptions)(e);
    Module._transformExpr = (e, t, r2) => (Module._transformExpr = wasmExports.transformExpr)(e, t, r2);
    Module._get_rel_namespace = (e) => (Module._get_rel_namespace = wasmExports.get_rel_namespace)(e);
    Module._get_rel_name = (e) => (Module._get_rel_name = wasmExports.get_rel_name)(e);
    Module._makeRangeVar = (e, t, r2) => (Module._makeRangeVar = wasmExports.makeRangeVar)(e, t, r2);
    Module._makeDefElem = (e, t, r2) => (Module._makeDefElem = wasmExports.makeDefElem)(e, t, r2);
    Module._makeRangeVarFromNameList = (e) => (Module._makeRangeVarFromNameList = wasmExports.makeRangeVarFromNameList)(e);
    Module._coerce_to_target_type = (e, t, r2, a2, o2, s2, l2, n2) => (Module._coerce_to_target_type = wasmExports.coerce_to_target_type)(e, t, r2, a2, o2, s2, l2, n2);
    Module._LookupTypeName = (e, t, r2, a2) => (Module._LookupTypeName = wasmExports.LookupTypeName)(e, t, r2, a2);
    Module._GetSysCacheOid = (e, t, r2, a2, o2, s2) => (Module._GetSysCacheOid = wasmExports.GetSysCacheOid)(e, t, r2, a2, o2, s2);
    Module._construct_array_builtin = (e, t, r2) => (Module._construct_array_builtin = wasmExports.construct_array_builtin)(e, t, r2);
    Module._get_collation_oid = (e, t) => (Module._get_collation_oid = wasmExports.get_collation_oid)(e, t);
    Module._typeStringToTypeName = (e, t) => (Module._typeStringToTypeName = wasmExports.typeStringToTypeName)(e, t);
    Module._raw_parser = (e, t) => (Module._raw_parser = wasmExports.raw_parser)(e, t);
    Module._errsave_start = (e, t) => (Module._errsave_start = wasmExports.errsave_start)(e, t);
    Module._errsave_finish = (e, t, r2, a2) => (Module._errsave_finish = wasmExports.errsave_finish)(e, t, r2, a2);
    Module._defGetBoolean = (e) => (Module._defGetBoolean = wasmExports.defGetBoolean)(e);
    Module._list_delete_last = (e) => (Module._list_delete_last = wasmExports.list_delete_last)(e);
    Module._format_type_with_typemod = (e, t) => (Module._format_type_with_typemod = wasmExports.format_type_with_typemod)(e, t);
    Module._list_member = (e, t) => (Module._list_member = wasmExports.list_member)(e, t);
    Module._list_member_int = (e, t) => (Module._list_member_int = wasmExports.list_member_int)(e, t);
    Module._list_sort = (e, t) => (Module._list_sort = wasmExports.list_sort)(e, t);
    Module._get_element_type = (e) => (Module._get_element_type = wasmExports.get_element_type)(e);
    Module._makeBoolean = (e) => (Module._makeBoolean = wasmExports.makeBoolean)(e);
    Module._makeInteger = (e) => (Module._makeInteger = wasmExports.makeInteger)(e);
    Module._makeTypeName = (e) => (Module._makeTypeName = wasmExports.makeTypeName)(e);
    Module._list_make4_impl = (e, t, r2, a2, o2) => (Module._list_make4_impl = wasmExports.list_make4_impl)(e, t, r2, a2, o2);
    Module._isxdigit = (e) => (Module._isxdigit = wasmExports.isxdigit)(e);
    Module._strip_implicit_coercions = (e) => (Module._strip_implicit_coercions = wasmExports.strip_implicit_coercions)(e);
    Module._SearchSysCacheList = (e, t, r2, a2, o2) => (Module._SearchSysCacheList = wasmExports.SearchSysCacheList)(e, t, r2, a2, o2);
    Module._ReleaseCatCacheList = (e) => (Module._ReleaseCatCacheList = wasmExports.ReleaseCatCacheList)(e);
    Module._get_sortgroupref_tle = (e, t) => (Module._get_sortgroupref_tle = wasmExports.get_sortgroupref_tle)(e, t);
    Module._type_is_rowtype = (e) => (Module._type_is_rowtype = wasmExports.type_is_rowtype)(e);
    Module._bms_next_member = (e, t) => (Module._bms_next_member = wasmExports.bms_next_member)(e, t);
    Module._MemoryContextReset = (e) => (Module._MemoryContextReset = wasmExports.MemoryContextReset)(e);
    Module._abort = () => (Module._abort = wasmExports.abort)();
    Module._heap_getnext = (e, t) => (Module._heap_getnext = wasmExports.heap_getnext)(e, t);
    Module._OidOutputFunctionCall = (e, t) => (Module._OidOutputFunctionCall = wasmExports.OidOutputFunctionCall)(e, t);
    Module._atoi = (e) => (Module._atoi = wasmExports.atoi)(e);
    Module._GetConfigOption = (e, t, r2) => (Module._GetConfigOption = wasmExports.GetConfigOption)(e, t, r2);
    Module._pg_strong_random = (e, t) => (Module._pg_strong_random = wasmExports.pg_strong_random)(e, t);
    Module._pg_prng_seed_check = (e) => (Module._pg_prng_seed_check = wasmExports.pg_prng_seed_check)(e);
    Module._pg_prng_seed = (e, t) => (Module._pg_prng_seed = wasmExports.pg_prng_seed)(e, t);
    Module._fputc = (e, t) => (Module._fputc = wasmExports.fputc)(e, t);
    Module._time = (e) => (Module._time = wasmExports.time)(e);
    Module._TimestampDifferenceMilliseconds = (e, t) => (Module._TimestampDifferenceMilliseconds = wasmExports.TimestampDifferenceMilliseconds)(e, t);
    Module._ProcessConfigFile = (e) => (Module._ProcessConfigFile = wasmExports.ProcessConfigFile)(e);
    Module._send = (e, t, r2, a2) => (Module._send = wasmExports.send)(e, t, r2, a2);
    Module._parse_bool = (e, t) => (Module._parse_bool = wasmExports.parse_bool)(e, t);
    Module._enlargeStringInfo = (e, t) => (Module._enlargeStringInfo = wasmExports.enlargeStringInfo)(e, t);
    Module._BackgroundWorkerInitializeConnectionByOid = (e, t, r2) => (Module._BackgroundWorkerInitializeConnectionByOid = wasmExports.BackgroundWorkerInitializeConnectionByOid)(e, t, r2);
    Module._BackgroundWorkerUnblockSignals = () => (Module._BackgroundWorkerUnblockSignals = wasmExports.BackgroundWorkerUnblockSignals)();
    Module._pg_getnameinfo_all = (e, t, r2, a2, o2, s2, l2) => (Module._pg_getnameinfo_all = wasmExports.pg_getnameinfo_all)(e, t, r2, a2, o2, s2, l2);
    Module._gai_strerror = (e) => (Module._gai_strerror = wasmExports.gai_strerror)(e);
    Module._SignalHandlerForConfigReload = (e) => (Module._SignalHandlerForConfigReload = wasmExports.SignalHandlerForConfigReload)(e);
    Module._fwrite = (e, t, r2, a2) => (Module._fwrite = wasmExports.fwrite)(e, t, r2, a2);
    Module._SignalHandlerForShutdownRequest = (e) => (Module._SignalHandlerForShutdownRequest = wasmExports.SignalHandlerForShutdownRequest)(e);
    Module._EmitErrorReport = () => (Module._EmitErrorReport = wasmExports.EmitErrorReport)();
    Module._FlushErrorState = () => (Module._FlushErrorState = wasmExports.FlushErrorState)();
    Module._die = (e) => (Module._die = wasmExports.die)(e);
    Module._MultiXactIdPrecedes = (e, t) => (Module._MultiXactIdPrecedes = wasmExports.MultiXactIdPrecedes)(e, t);
    Module._CreateTupleDescCopy = (e) => (Module._CreateTupleDescCopy = wasmExports.CreateTupleDescCopy)(e);
    Module._pgstat_report_activity = (e, t) => (Module._pgstat_report_activity = wasmExports.pgstat_report_activity)(e, t);
    Module._DirectFunctionCall2Coll = (e, t, r2, a2) => (Module._DirectFunctionCall2Coll = wasmExports.DirectFunctionCall2Coll)(e, t, r2, a2);
    Module._RegisterBackgroundWorker = (e) => (Module._RegisterBackgroundWorker = wasmExports.RegisterBackgroundWorker)(e);
    Module._RegisterDynamicBackgroundWorker = (e, t) => (Module._RegisterDynamicBackgroundWorker = wasmExports.RegisterDynamicBackgroundWorker)(e, t);
    Module._WaitForBackgroundWorkerStartup = (e, t) => (Module._WaitForBackgroundWorkerStartup = wasmExports.WaitForBackgroundWorkerStartup)(e, t);
    Module._WaitForBackgroundWorkerShutdown = (e) => (Module._WaitForBackgroundWorkerShutdown = wasmExports.WaitForBackgroundWorkerShutdown)(e);
    Module._GetXLogReplayRecPtr = (e) => (Module._GetXLogReplayRecPtr = wasmExports.GetXLogReplayRecPtr)(e);
    Module._gettimeofday = (e, t) => (Module._gettimeofday = wasmExports.gettimeofday)(e, t);
    Module._sscanf = (e, t, r2) => (Module._sscanf = wasmExports.sscanf)(e, t, r2);
    Module._get_call_result_type = (e, t, r2) => (Module._get_call_result_type = wasmExports.get_call_result_type)(e, t, r2);
    Module._HeapTupleHeaderGetDatum = (e) => (Module._HeapTupleHeaderGetDatum = wasmExports.HeapTupleHeaderGetDatum)(e);
    Module._wal_segment_close = (e) => (Module._wal_segment_close = wasmExports.wal_segment_close)(e);
    Module._wal_segment_open = (e, t, r2) => (Module._wal_segment_open = wasmExports.wal_segment_open)(e, t, r2);
    Module._GetFlushRecPtr = (e) => (Module._GetFlushRecPtr = wasmExports.GetFlushRecPtr)(e);
    Module._XLogReadRecord = (e, t) => (Module._XLogReadRecord = wasmExports.XLogReadRecord)(e, t);
    Module._RmgrNotFound = (e) => (Module._RmgrNotFound = wasmExports.RmgrNotFound)(e);
    Module._CacheRegisterRelcacheCallback = (e, t) => (Module._CacheRegisterRelcacheCallback = wasmExports.CacheRegisterRelcacheCallback)(e, t);
    Module._free_attrmap = (e) => (Module._free_attrmap = wasmExports.free_attrmap)(e);
    Module._BuildIndexInfo = (e) => (Module._BuildIndexInfo = wasmExports.BuildIndexInfo)(e);
    Module._hash_seq_term = (e) => (Module._hash_seq_term = wasmExports.hash_seq_term)(e);
    Module._PushActiveSnapshot = (e) => (Module._PushActiveSnapshot = wasmExports.PushActiveSnapshot)(e);
    Module._PopActiveSnapshot = () => (Module._PopActiveSnapshot = wasmExports.PopActiveSnapshot)();
    Module._MakePerTupleExprContext = (e) => (Module._MakePerTupleExprContext = wasmExports.MakePerTupleExprContext)(e);
    Module._ExecInitExpr = (e, t) => (Module._ExecInitExpr = wasmExports.ExecInitExpr)(e, t);
    Module._FreeExecutorState = (e) => (Module._FreeExecutorState = wasmExports.FreeExecutorState)(e);
    Module._list_member_oid = (e, t) => (Module._list_member_oid = wasmExports.list_member_oid)(e, t);
    Module._MemoryContextStrdup = (e, t) => (Module._MemoryContextStrdup = wasmExports.MemoryContextStrdup)(e, t);
    Module._pq_getmsgint = (e, t) => (Module._pq_getmsgint = wasmExports.pq_getmsgint)(e, t);
    Module._CreateExecutorState = () => (Module._CreateExecutorState = wasmExports.CreateExecutorState)();
    Module._ExecInitRangeTable = (e, t, r2) => (Module._ExecInitRangeTable = wasmExports.ExecInitRangeTable)(e, t, r2);
    Module._getTypeInputInfo = (e, t, r2) => (Module._getTypeInputInfo = wasmExports.getTypeInputInfo)(e, t, r2);
    Module._ExecStoreVirtualTuple = (e) => (Module._ExecStoreVirtualTuple = wasmExports.ExecStoreVirtualTuple)(e);
    Module._execute_attr_map_slot = (e, t, r2) => (Module._execute_attr_map_slot = wasmExports.execute_attr_map_slot)(e, t, r2);
    Module._slot_getsomeattrs_int = (e, t) => (Module._slot_getsomeattrs_int = wasmExports.slot_getsomeattrs_int)(e, t);
    Module._GetUserNameFromId = (e, t) => (Module._GetUserNameFromId = wasmExports.GetUserNameFromId)(e, t);
    Module._makeStringInfo = () => (Module._makeStringInfo = wasmExports.makeStringInfo)();
    Module._list_member_xid = (e, t) => (Module._list_member_xid = wasmExports.list_member_xid)(e, t);
    Module._lappend_xid = (e, t) => (Module._lappend_xid = wasmExports.lappend_xid)(e, t);
    Module._tuplestore_end = (e) => (Module._tuplestore_end = wasmExports.tuplestore_end)(e);
    Module._quote_literal_cstr = (e) => (Module._quote_literal_cstr = wasmExports.quote_literal_cstr)(e);
    Module._MakeSingleTupleTableSlot = (e, t) => (Module._MakeSingleTupleTableSlot = wasmExports.MakeSingleTupleTableSlot)(e, t);
    Module._ExecDropSingleTupleTableSlot = (e) => (Module._ExecDropSingleTupleTableSlot = wasmExports.ExecDropSingleTupleTableSlot)(e);
    Module._tuplestore_tuple_count = (e) => (Module._tuplestore_tuple_count = wasmExports.tuplestore_tuple_count)(e);
    Module._quote_identifier = (e) => (Module._quote_identifier = wasmExports.quote_identifier)(e);
    Module._BeginCopyFrom = (e, t, r2, a2, o2, s2, l2, n2) => (Module._BeginCopyFrom = wasmExports.BeginCopyFrom)(e, t, r2, a2, o2, s2, l2, n2);
    Module._array_contains_nulls = (e) => (Module._array_contains_nulls = wasmExports.array_contains_nulls)(e);
    Module._format_procedure = (e) => (Module._format_procedure = wasmExports.format_procedure)(e);
    Module._pg_detoast_datum_packed = (e) => (Module._pg_detoast_datum_packed = wasmExports.pg_detoast_datum_packed)(e);
    Module._cstring_to_text_with_len = (e, t) => (Module._cstring_to_text_with_len = wasmExports.cstring_to_text_with_len)(e, t);
    Module._GenerationContextCreate = (e, t, r2, a2, o2) => (Module._GenerationContextCreate = wasmExports.GenerationContextCreate)(e, t, r2, a2, o2);
    Module._BeginInternalSubTransaction = (e) => (Module._BeginInternalSubTransaction = wasmExports.BeginInternalSubTransaction)(e);
    Module._RollbackAndReleaseCurrentSubTransaction = () => (Module._RollbackAndReleaseCurrentSubTransaction = wasmExports.RollbackAndReleaseCurrentSubTransaction)();
    Module._CopyErrorData = () => (Module._CopyErrorData = wasmExports.CopyErrorData)();
    Module._FreeErrorData = (e) => (Module._FreeErrorData = wasmExports.FreeErrorData)(e);
    Module._RelidByRelfilenumber = (e, t) => (Module._RelidByRelfilenumber = wasmExports.RelidByRelfilenumber)(e, t);
    Module._RelationIdGetRelation = (e) => (Module._RelationIdGetRelation = wasmExports.RelationIdGetRelation)(e);
    Module._heap_deform_tuple = (e, t, r2, a2) => (Module._heap_deform_tuple = wasmExports.heap_deform_tuple)(e, t, r2, a2);
    Module._RelationClose = (e) => (Module._RelationClose = wasmExports.RelationClose)(e);
    Module._nocachegetattr = (e, t, r2) => (Module._nocachegetattr = wasmExports.nocachegetattr)(e, t, r2);
    Module._XLogReaderAllocate = (e, t, r2, a2) => (Module._XLogReaderAllocate = wasmExports.XLogReaderAllocate)(e, t, r2, a2);
    Module._XLogReaderFree = (e) => (Module._XLogReaderFree = wasmExports.XLogReaderFree)(e);
    Module._OutputPluginPrepareWrite = (e, t) => (Module._OutputPluginPrepareWrite = wasmExports.OutputPluginPrepareWrite)(e, t);
    Module._OutputPluginWrite = (e, t) => (Module._OutputPluginWrite = wasmExports.OutputPluginWrite)(e, t);
    Module._OutputPluginUpdateProgress = (e, t) => (Module._OutputPluginUpdateProgress = wasmExports.OutputPluginUpdateProgress)(e, t);
    Module._replorigin_by_oid = (e, t, r2) => (Module._replorigin_by_oid = wasmExports.replorigin_by_oid)(e, t, r2);
    Module._logicalrep_write_begin = (e, t) => (Module._logicalrep_write_begin = wasmExports.logicalrep_write_begin)(e, t);
    Module._logicalrep_write_commit = (e, t, r2) => (Module._logicalrep_write_commit = wasmExports.logicalrep_write_commit)(e, t, r2);
    Module._logicalrep_write_begin_prepare = (e, t) => (Module._logicalrep_write_begin_prepare = wasmExports.logicalrep_write_begin_prepare)(e, t);
    Module._logicalrep_write_prepare = (e, t, r2) => (Module._logicalrep_write_prepare = wasmExports.logicalrep_write_prepare)(e, t, r2);
    Module._logicalrep_write_commit_prepared = (e, t, r2) => (Module._logicalrep_write_commit_prepared = wasmExports.logicalrep_write_commit_prepared)(e, t, r2);
    Module._logicalrep_write_rollback_prepared = (e, t, r2, a2) => (Module._logicalrep_write_rollback_prepared = wasmExports.logicalrep_write_rollback_prepared)(e, t, r2, a2);
    Module._logicalrep_write_stream_prepare = (e, t, r2) => (Module._logicalrep_write_stream_prepare = wasmExports.logicalrep_write_stream_prepare)(e, t, r2);
    Module._logicalrep_write_origin = (e, t, r2) => (Module._logicalrep_write_origin = wasmExports.logicalrep_write_origin)(e, t, r2);
    Module._logicalrep_write_insert = (e, t, r2, a2, o2, s2) => (Module._logicalrep_write_insert = wasmExports.logicalrep_write_insert)(e, t, r2, a2, o2, s2);
    Module._logicalrep_write_update = (e, t, r2, a2, o2, s2, l2) => (Module._logicalrep_write_update = wasmExports.logicalrep_write_update)(e, t, r2, a2, o2, s2, l2);
    Module._logicalrep_write_delete = (e, t, r2, a2, o2, s2) => (Module._logicalrep_write_delete = wasmExports.logicalrep_write_delete)(e, t, r2, a2, o2, s2);
    Module._logicalrep_write_truncate = (e, t, r2, a2, o2, s2) => (Module._logicalrep_write_truncate = wasmExports.logicalrep_write_truncate)(e, t, r2, a2, o2, s2);
    Module._logicalrep_write_message = (e, t, r2, a2, o2, s2, l2) => (Module._logicalrep_write_message = wasmExports.logicalrep_write_message)(e, t, r2, a2, o2, s2, l2);
    Module._logicalrep_write_rel = (e, t, r2, a2) => (Module._logicalrep_write_rel = wasmExports.logicalrep_write_rel)(e, t, r2, a2);
    Module._logicalrep_write_typ = (e, t, r2) => (Module._logicalrep_write_typ = wasmExports.logicalrep_write_typ)(e, t, r2);
    Module._logicalrep_write_stream_start = (e, t, r2) => (Module._logicalrep_write_stream_start = wasmExports.logicalrep_write_stream_start)(e, t, r2);
    Module._logicalrep_write_stream_stop = (e) => (Module._logicalrep_write_stream_stop = wasmExports.logicalrep_write_stream_stop)(e);
    Module._logicalrep_write_stream_commit = (e, t, r2) => (Module._logicalrep_write_stream_commit = wasmExports.logicalrep_write_stream_commit)(e, t, r2);
    Module._logicalrep_write_stream_abort = (e, t, r2, a2, o2, s2) => (Module._logicalrep_write_stream_abort = wasmExports.logicalrep_write_stream_abort)(e, t, r2, a2, o2, s2);
    Module._ProcessWalRcvInterrupts = () => (Module._ProcessWalRcvInterrupts = wasmExports.ProcessWalRcvInterrupts)();
    Module._timestamptz_to_str = (e) => (Module._timestamptz_to_str = wasmExports.timestamptz_to_str)(e);
    Module._GetDatabaseEncodingName = () => (Module._GetDatabaseEncodingName = wasmExports.GetDatabaseEncodingName)();
    Module._PQconnectStartParams = (e, t, r2) => (Module._PQconnectStartParams = wasmExports.PQconnectStartParams)(e, t, r2);
    Module._PQstatus = (e) => (Module._PQstatus = wasmExports.PQstatus)(e);
    Module._PQsocket = (e) => (Module._PQsocket = wasmExports.PQsocket)(e);
    Module._PQconnectPoll = (e) => (Module._PQconnectPoll = wasmExports.PQconnectPoll)(e);
    Module._PQconnectionUsedPassword = (e) => (Module._PQconnectionUsedPassword = wasmExports.PQconnectionUsedPassword)(e);
    Module._PQfinish = (e) => (Module._PQfinish = wasmExports.PQfinish)(e);
    Module._PQresultStatus = (e) => (Module._PQresultStatus = wasmExports.PQresultStatus)(e);
    Module._PQclear = (e) => (Module._PQclear = wasmExports.PQclear)(e);
    Module._PQerrorMessage = (e) => (Module._PQerrorMessage = wasmExports.PQerrorMessage)(e);
    Module._pchomp = (e) => (Module._pchomp = wasmExports.pchomp)(e);
    Module._PQnfields = (e) => (Module._PQnfields = wasmExports.PQnfields)(e);
    Module._PQntuples = (e) => (Module._PQntuples = wasmExports.PQntuples)(e);
    Module._PQgetvalue = (e, t, r2) => (Module._PQgetvalue = wasmExports.PQgetvalue)(e, t, r2);
    Module._pg_strtoint32 = (e) => (Module._pg_strtoint32 = wasmExports.pg_strtoint32)(e);
    Module._PQconsumeInput = (e) => (Module._PQconsumeInput = wasmExports.PQconsumeInput)(e);
    Module._pg_lsn_in = (e) => (Module._pg_lsn_in = wasmExports.pg_lsn_in)(e);
    Module._DirectFunctionCall1Coll = (e, t, r2) => (Module._DirectFunctionCall1Coll = wasmExports.DirectFunctionCall1Coll)(e, t, r2);
    Module._PQgetisnull = (e, t, r2) => (Module._PQgetisnull = wasmExports.PQgetisnull)(e, t, r2);
    Module._tuplestore_begin_heap = (e, t, r2) => (Module._tuplestore_begin_heap = wasmExports.tuplestore_begin_heap)(e, t, r2);
    Module._TupleDescGetAttInMetadata = (e) => (Module._TupleDescGetAttInMetadata = wasmExports.TupleDescGetAttInMetadata)(e);
    Module._BuildTupleFromCStrings = (e, t) => (Module._BuildTupleFromCStrings = wasmExports.BuildTupleFromCStrings)(e, t);
    Module._tuplestore_puttuple = (e, t) => (Module._tuplestore_puttuple = wasmExports.tuplestore_puttuple)(e, t);
    Module._PQresultErrorField = (e, t) => (Module._PQresultErrorField = wasmExports.PQresultErrorField)(e, t);
    Module._PQsendQuery = (e, t) => (Module._PQsendQuery = wasmExports.PQsendQuery)(e, t);
    Module._PQisBusy = (e) => (Module._PQisBusy = wasmExports.PQisBusy)(e);
    Module._PQgetResult = (e) => (Module._PQgetResult = wasmExports.PQgetResult)(e);
    Module._ResourceOwnerDelete = (e) => (Module._ResourceOwnerDelete = wasmExports.ResourceOwnerDelete)(e);
    Module._CreateDestReceiver = (e) => (Module._CreateDestReceiver = wasmExports.CreateDestReceiver)(e);
    Module._defGetString = (e) => (Module._defGetString = wasmExports.defGetString)(e);
    Module._pg_md5_encrypt = (e, t, r2, a2, o2) => (Module._pg_md5_encrypt = wasmExports.pg_md5_encrypt)(e, t, r2, a2, o2);
    Module._plain_crypt_verify = (e, t, r2, a2) => (Module._plain_crypt_verify = wasmExports.plain_crypt_verify)(e, t, r2, a2);
    Module._pg_b64_enc_len = (e) => (Module._pg_b64_enc_len = wasmExports.pg_b64_enc_len)(e);
    Module._pg_b64_encode = (e, t, r2, a2) => (Module._pg_b64_encode = wasmExports.pg_b64_encode)(e, t, r2, a2);
    Module._pg_b64_dec_len = (e) => (Module._pg_b64_dec_len = wasmExports.pg_b64_dec_len)(e);
    Module._pg_b64_decode = (e, t, r2, a2) => (Module._pg_b64_decode = wasmExports.pg_b64_decode)(e, t, r2, a2);
    Module._pg_hmac_create = (e) => (Module._pg_hmac_create = wasmExports.pg_hmac_create)(e);
    Module._pg_hmac_init = (e, t, r2) => (Module._pg_hmac_init = wasmExports.pg_hmac_init)(e, t, r2);
    Module._pg_hmac_update = (e, t, r2) => (Module._pg_hmac_update = wasmExports.pg_hmac_update)(e, t, r2);
    Module._pg_hmac_final = (e, t, r2) => (Module._pg_hmac_final = wasmExports.pg_hmac_final)(e, t, r2);
    Module._pg_hmac_error = (e) => (Module._pg_hmac_error = wasmExports.pg_hmac_error)(e);
    Module._pg_hmac_free = (e) => (Module._pg_hmac_free = wasmExports.pg_hmac_free)(e);
    Module._scram_H = (e, t, r2, a2, o2) => (Module._scram_H = wasmExports.scram_H)(e, t, r2, a2, o2);
    Module._pg_saslprep = (e, t) => (Module._pg_saslprep = wasmExports.pg_saslprep)(e, t);
    Module._scram_build_secret = (e, t, r2, a2, o2, s2, l2) => (Module._scram_build_secret = wasmExports.scram_build_secret)(e, t, r2, a2, o2, s2, l2);
    Module._scram_SaltedPassword = (e, t, r2, a2, o2, s2, l2, n2) => (Module._scram_SaltedPassword = wasmExports.scram_SaltedPassword)(e, t, r2, a2, o2, s2, l2, n2);
    Module._scram_ServerKey = (e, t, r2, a2, o2) => (Module._scram_ServerKey = wasmExports.scram_ServerKey)(e, t, r2, a2, o2);
    Module._strtol = (e, t, r2) => (Module._strtol = wasmExports.strtol)(e, t, r2);
    Module._replace_percent_placeholders = (e, t, r2, a2) => (Module._replace_percent_placeholders = wasmExports.replace_percent_placeholders)(e, t, r2, a2);
    Module._fgets = (e, t, r2) => (Module._fgets = wasmExports.fgets)(e, t, r2);
    Module._explicit_bzero = (e, t) => (Module._explicit_bzero = wasmExports.explicit_bzero)(e, t);
    Module._wait_result_to_str = (e) => (Module._wait_result_to_str = wasmExports.wait_result_to_str)(e);
    Module._pg_strip_crlf = (e) => (Module._pg_strip_crlf = wasmExports.pg_strip_crlf)(e);
    Module._geteuid = () => (Module._geteuid = wasmExports.geteuid)();
    Module._getpeereid = (e, t, r2) => (Module._getpeereid = wasmExports.getpeereid)(e, t, r2);
    Module._pg_getaddrinfo_all = (e, t, r2, a2) => (Module._pg_getaddrinfo_all = wasmExports.pg_getaddrinfo_all)(e, t, r2, a2);
    Module._socket = (e, t, r2) => (Module._socket = wasmExports.socket)(e, t, r2);
    Module._connect = (e, t, r2) => (Module._connect = wasmExports.connect)(e, t, r2);
    Module._recv = (e, t, r2, a2) => (Module._recv = wasmExports.recv)(e, t, r2, a2);
    Module._pg_freeaddrinfo_all = (e, t) => (Module._pg_freeaddrinfo_all = wasmExports.pg_freeaddrinfo_all)(e, t);
    Module._pq_sendtext = (e, t, r2) => (Module._pq_sendtext = wasmExports.pq_sendtext)(e, t, r2);
    Module._pq_sendfloat4 = (e, t) => (Module._pq_sendfloat4 = wasmExports.pq_sendfloat4)(e, t);
    Module._pq_sendfloat8 = (e, t) => (Module._pq_sendfloat8 = wasmExports.pq_sendfloat8)(e, t);
    Module._pq_begintypsend = (e) => (Module._pq_begintypsend = wasmExports.pq_begintypsend)(e);
    Module._pq_endtypsend = (e) => (Module._pq_endtypsend = wasmExports.pq_endtypsend)(e);
    Module._pq_getmsgfloat4 = (e) => (Module._pq_getmsgfloat4 = wasmExports.pq_getmsgfloat4)(e);
    Module._pq_getmsgfloat8 = (e) => (Module._pq_getmsgfloat8 = wasmExports.pq_getmsgfloat8)(e);
    Module._pq_getmsgtext = (e, t, r2) => (Module._pq_getmsgtext = wasmExports.pq_getmsgtext)(e, t, r2);
    Module._feof = (e) => (Module._feof = wasmExports.feof)(e);
    Module._pg_mb2wchar_with_len = (e, t, r2) => (Module._pg_mb2wchar_with_len = wasmExports.pg_mb2wchar_with_len)(e, t, r2);
    Module._pg_regcomp = (e, t, r2, a2, o2) => (Module._pg_regcomp = wasmExports.pg_regcomp)(e, t, r2, a2, o2);
    Module._pg_regerror = (e, t, r2, a2) => (Module._pg_regerror = wasmExports.pg_regerror)(e, t, r2, a2);
    Module._get_role_oid = (e, t) => (Module._get_role_oid = wasmExports.get_role_oid)(e, t);
    Module._strcat = (e, t) => (Module._strcat = wasmExports.strcat)(e, t);
    Module._sigemptyset = (e) => (Module._sigemptyset = wasmExports.sigemptyset)(e);
    Module._be_lo_unlink = (e) => (Module._be_lo_unlink = wasmExports.be_lo_unlink)(e);
    Module._object_ownercheck = (e, t, r2) => (Module._object_ownercheck = wasmExports.object_ownercheck)(e, t, r2);
    Module._text_to_cstring_buffer = (e, t, r2) => (Module._text_to_cstring_buffer = wasmExports.text_to_cstring_buffer)(e, t, r2);
    Module._setsockopt = (e, t, r2, a2, o2) => (Module._setsockopt = wasmExports.setsockopt)(e, t, r2, a2, o2);
    Module._getsockname = (e, t, r2) => (Module._getsockname = wasmExports.getsockname)(e, t, r2);
    Module._pq_recvbuf_fill = (e, t) => (Module._pq_recvbuf_fill = wasmExports.pq_recvbuf_fill)(e, t);
    Module._getsockopt = (e, t, r2, a2, o2) => (Module._getsockopt = wasmExports.getsockopt)(e, t, r2, a2, o2);
    Module._getmissingattr = (e, t, r2) => (Module._getmissingattr = wasmExports.getmissingattr)(e, t, r2);
    Module._get_rel_relkind = (e) => (Module._get_rel_relkind = wasmExports.get_rel_relkind)(e);
    Module._MemoryContextSetIdentifier = (e, t) => (Module._MemoryContextSetIdentifier = wasmExports.MemoryContextSetIdentifier)(e, t);
    Module._MemoryContextSetParent = (e, t) => (Module._MemoryContextSetParent = wasmExports.MemoryContextSetParent)(e, t);
    Module._find_base_rel = (e, t) => (Module._find_base_rel = wasmExports.find_base_rel)(e, t);
    Module._bms_equal = (e, t) => (Module._bms_equal = wasmExports.bms_equal)(e, t);
    Module._bms_num_members = (e) => (Module._bms_num_members = wasmExports.bms_num_members)(e);
    Module._fmgr_info_copy = (e, t, r2) => (Module._fmgr_info_copy = wasmExports.fmgr_info_copy)(e, t, r2);
    Module._fmgr_info_cxt = (e, t, r2) => (Module._fmgr_info_cxt = wasmExports.fmgr_info_cxt)(e, t, r2);
    Module._get_typlenbyvalalign = (e, t, r2, a2) => (Module._get_typlenbyvalalign = wasmExports.get_typlenbyvalalign)(e, t, r2, a2);
    Module._deconstruct_array = (e, t, r2, a2, o2, s2, l2, n2) => (Module._deconstruct_array = wasmExports.deconstruct_array)(e, t, r2, a2, o2, s2, l2, n2);
    Module._datumCopy = (e, t, r2) => (Module._datumCopy = wasmExports.datumCopy)(e, t, r2);
    Module._qsort_arg = (e, t, r2, a2, o2) => (Module._qsort_arg = wasmExports.qsort_arg)(e, t, r2, a2, o2);
    Module._FunctionCall2Coll = (e, t, r2, a2) => (Module._FunctionCall2Coll = wasmExports.FunctionCall2Coll)(e, t, r2, a2);
    Module._datumIsEqual = (e, t, r2, a2) => (Module._datumIsEqual = wasmExports.datumIsEqual)(e, t, r2, a2);
    Module._bms_overlap = (e, t) => (Module._bms_overlap = wasmExports.bms_overlap)(e, t);
    Module._ExecPrepareExpr = (e, t) => (Module._ExecPrepareExpr = wasmExports.ExecPrepareExpr)(e, t);
    Module._RegisterSnapshot = (e) => (Module._RegisterSnapshot = wasmExports.RegisterSnapshot)(e);
    Module._UnregisterSnapshot = (e) => (Module._UnregisterSnapshot = wasmExports.UnregisterSnapshot)(e);
    Module._get_fn_expr_argtype = (e, t) => (Module._get_fn_expr_argtype = wasmExports.get_fn_expr_argtype)(e, t);
    Module._get_opfamily_member = (e, t, r2, a2) => (Module._get_opfamily_member = wasmExports.get_opfamily_member)(e, t, r2, a2);
    Module._init_MultiFuncCall = (e) => (Module._init_MultiFuncCall = wasmExports.init_MultiFuncCall)(e);
    Module._per_MultiFuncCall = (e) => (Module._per_MultiFuncCall = wasmExports.per_MultiFuncCall)(e);
    Module._end_MultiFuncCall = (e, t) => (Module._end_MultiFuncCall = wasmExports.end_MultiFuncCall)(e, t);
    Module._textToQualifiedNameList = (e) => (Module._textToQualifiedNameList = wasmExports.textToQualifiedNameList)(e);
    Module._FunctionCall1Coll = (e, t, r2) => (Module._FunctionCall1Coll = wasmExports.FunctionCall1Coll)(e, t, r2);
    Module._DirectFunctionCall4Coll = (e, t, r2, a2, o2, s2) => (Module._DirectFunctionCall4Coll = wasmExports.DirectFunctionCall4Coll)(e, t, r2, a2, o2, s2);
    Module._pg_mblen = (e) => (Module._pg_mblen = wasmExports.pg_mblen)(e);
    Module._tsearch_readline_begin = (e, t) => (Module._tsearch_readline_begin = wasmExports.tsearch_readline_begin)(e, t);
    Module._tsearch_readline = (e) => (Module._tsearch_readline = wasmExports.tsearch_readline)(e);
    Module._t_isspace = (e) => (Module._t_isspace = wasmExports.t_isspace)(e);
    Module._lowerstr = (e) => (Module._lowerstr = wasmExports.lowerstr)(e);
    Module._tsearch_readline_end = (e) => (Module._tsearch_readline_end = wasmExports.tsearch_readline_end)(e);
    Module._t_isdigit = (e) => (Module._t_isdigit = wasmExports.t_isdigit)(e);
    Module._pnstrdup = (e, t) => (Module._pnstrdup = wasmExports.pnstrdup)(e, t);
    Module._get_tsearch_config_filename = (e, t) => (Module._get_tsearch_config_filename = wasmExports.get_tsearch_config_filename)(e, t);
    Module._lookup_ts_dictionary_cache = (e) => (Module._lookup_ts_dictionary_cache = wasmExports.lookup_ts_dictionary_cache)(e);
    Module._FunctionCall4Coll = (e, t, r2, a2, o2, s2) => (Module._FunctionCall4Coll = wasmExports.FunctionCall4Coll)(e, t, r2, a2, o2, s2);
    Module._t_isalnum = (e) => (Module._t_isalnum = wasmExports.t_isalnum)(e);
    Module._isalnum = (e) => (Module._isalnum = wasmExports.isalnum)(e);
    Module._pg_any_to_server = (e, t, r2) => (Module._pg_any_to_server = wasmExports.pg_any_to_server)(e, t, r2);
    Module._lowerstr_with_len = (e, t) => (Module._lowerstr_with_len = wasmExports.lowerstr_with_len)(e, t);
    Module._tolower = (e) => (Module._tolower = wasmExports.tolower)(e);
    Module._readstoplist = (e, t, r2) => (Module._readstoplist = wasmExports.readstoplist)(e, t, r2);
    Module._searchstoplist = (e, t) => (Module._searchstoplist = wasmExports.searchstoplist)(e, t);
    Module._GetDatabaseEncoding = () => (Module._GetDatabaseEncoding = wasmExports.GetDatabaseEncoding)();
    Module._vacuum_delay_point = () => (Module._vacuum_delay_point = wasmExports.vacuum_delay_point)();
    Module._get_restriction_variable = (e, t, r2, a2, o2, s2) => (Module._get_restriction_variable = wasmExports.get_restriction_variable)(e, t, r2, a2, o2, s2);
    Module._get_attstatsslot = (e, t, r2, a2, o2) => (Module._get_attstatsslot = wasmExports.get_attstatsslot)(e, t, r2, a2, o2);
    Module._free_attstatsslot = (e) => (Module._free_attstatsslot = wasmExports.free_attstatsslot)(e);
    Module._Float8GetDatum = (e) => (Module._Float8GetDatum = wasmExports.Float8GetDatum)(e);
    Module._ExecReScan = (e) => (Module._ExecReScan = wasmExports.ExecReScan)(e);
    Module._ExecAsyncResponse = (e) => (Module._ExecAsyncResponse = wasmExports.ExecAsyncResponse)(e);
    Module._ExecAsyncRequestDone = (e, t) => (Module._ExecAsyncRequestDone = wasmExports.ExecAsyncRequestDone)(e, t);
    Module._ExecAsyncRequestPending = (e) => (Module._ExecAsyncRequestPending = wasmExports.ExecAsyncRequestPending)(e);
    Module._tuplesort_end = (e) => (Module._tuplesort_end = wasmExports.tuplesort_end)(e);
    Module._ExecInitExprList = (e, t) => (Module._ExecInitExprList = wasmExports.ExecInitExprList)(e, t);
    Module._fmgr_info = (e, t) => (Module._fmgr_info = wasmExports.fmgr_info)(e, t);
    Module._get_typlenbyval = (e, t, r2) => (Module._get_typlenbyval = wasmExports.get_typlenbyval)(e, t, r2);
    Module._ExecForceStoreHeapTuple = (e, t, r2) => (Module._ExecForceStoreHeapTuple = wasmExports.ExecForceStoreHeapTuple)(e, t, r2);
    Module._tuplesort_performsort = (e) => (Module._tuplesort_performsort = wasmExports.tuplesort_performsort)(e);
    Module._tuplesort_begin_heap = (e, t, r2, a2, o2, s2, l2, n2, _2) => (Module._tuplesort_begin_heap = wasmExports.tuplesort_begin_heap)(e, t, r2, a2, o2, s2, l2, n2, _2);
    Module._MemoryContextMemAllocated = (e, t) => (Module._MemoryContextMemAllocated = wasmExports.MemoryContextMemAllocated)(e, t);
    Module._tuplesort_gettupleslot = (e, t, r2, a2, o2) => (Module._tuplesort_gettupleslot = wasmExports.tuplesort_gettupleslot)(e, t, r2, a2, o2);
    Module._tuplesort_puttupleslot = (e, t) => (Module._tuplesort_puttupleslot = wasmExports.tuplesort_puttupleslot)(e, t);
    Module._ExecStoreAllNullTuple = (e) => (Module._ExecStoreAllNullTuple = wasmExports.ExecStoreAllNullTuple)(e);
    Module._MakeExpandedObjectReadOnlyInternal = (e) => (Module._MakeExpandedObjectReadOnlyInternal = wasmExports.MakeExpandedObjectReadOnlyInternal)(e);
    Module._BlessTupleDesc = (e) => (Module._BlessTupleDesc = wasmExports.BlessTupleDesc)(e);
    Module._pg_detoast_datum_copy = (e) => (Module._pg_detoast_datum_copy = wasmExports.pg_detoast_datum_copy)(e);
    Module._construct_md_array = (e, t, r2, a2, o2, s2, l2, n2, _2) => (Module._construct_md_array = wasmExports.construct_md_array)(e, t, r2, a2, o2, s2, l2, n2, _2);
    Module._ArrayGetNItems = (e, t) => (Module._ArrayGetNItems = wasmExports.ArrayGetNItems)(e, t);
    Module._construct_empty_array = (e) => (Module._construct_empty_array = wasmExports.construct_empty_array)(e);
    Module._DatumGetEOHP = (e) => (Module._DatumGetEOHP = wasmExports.DatumGetEOHP)(e);
    Module._expanded_record_fetch_tupdesc = (e) => (Module._expanded_record_fetch_tupdesc = wasmExports.expanded_record_fetch_tupdesc)(e);
    Module._expanded_record_fetch_field = (e, t, r2) => (Module._expanded_record_fetch_field = wasmExports.expanded_record_fetch_field)(e, t, r2);
    Module._execute_attr_map_tuple = (e, t) => (Module._execute_attr_map_tuple = wasmExports.execute_attr_map_tuple)(e, t);
    Module._MemoryContextAllocExtended = (e, t, r2) => (Module._MemoryContextAllocExtended = wasmExports.MemoryContextAllocExtended)(e, t, r2);
    Module._lookup_rowtype_tupdesc_domain = (e, t, r2) => (Module._lookup_rowtype_tupdesc_domain = wasmExports.lookup_rowtype_tupdesc_domain)(e, t, r2);
    Module._MemoryContextGetParent = (e) => (Module._MemoryContextGetParent = wasmExports.MemoryContextGetParent)(e);
    Module._DeleteExpandedObject = (e) => (Module._DeleteExpandedObject = wasmExports.DeleteExpandedObject)(e);
    Module._InstrAlloc = (e, t, r2) => (Module._InstrAlloc = wasmExports.InstrAlloc)(e, t, r2);
    Module._ExprEvalPushStep = (e, t) => (Module._ExprEvalPushStep = wasmExports.ExprEvalPushStep)(e, t);
    Module._getTypeOutputInfo = (e, t, r2) => (Module._getTypeOutputInfo = wasmExports.getTypeOutputInfo)(e, t, r2);
    Module._ExecInitExprWithParams = (e, t) => (Module._ExecInitExprWithParams = wasmExports.ExecInitExprWithParams)(e, t);
    Module._ExecOpenScanRelation = (e, t, r2) => (Module._ExecOpenScanRelation = wasmExports.ExecOpenScanRelation)(e, t, r2);
    Module._FreeExprContext = (e, t) => (Module._FreeExprContext = wasmExports.FreeExprContext)(e, t);
    Module._CreateExprContext = (e) => (Module._CreateExprContext = wasmExports.CreateExprContext)(e);
    Module._ExecGetReturningSlot = (e, t) => (Module._ExecGetReturningSlot = wasmExports.ExecGetReturningSlot)(e, t);
    Module._build_attrmap_by_name_if_req = (e, t, r2) => (Module._build_attrmap_by_name_if_req = wasmExports.build_attrmap_by_name_if_req)(e, t, r2);
    Module._ExecGetResultRelCheckAsUser = (e, t) => (Module._ExecGetResultRelCheckAsUser = wasmExports.ExecGetResultRelCheckAsUser)(e, t);
    Module._InstrEndLoop = (e) => (Module._InstrEndLoop = wasmExports.InstrEndLoop)(e);
    Module._ExecStoreHeapTuple = (e, t, r2) => (Module._ExecStoreHeapTuple = wasmExports.ExecStoreHeapTuple)(e, t, r2);
    Module._get_partition_ancestors = (e) => (Module._get_partition_ancestors = wasmExports.get_partition_ancestors)(e);
    Module._pull_varattnos = (e, t, r2) => (Module._pull_varattnos = wasmExports.pull_varattnos)(e, t, r2);
    Module._ExecFindJunkAttributeInTlist = (e, t) => (Module._ExecFindJunkAttributeInTlist = wasmExports.ExecFindJunkAttributeInTlist)(e, t);
    Module._visibilitymap_get_status = (e, t, r2) => (Module._visibilitymap_get_status = wasmExports.visibilitymap_get_status)(e, t, r2);
    Module._index_deform_tuple = (e, t, r2, a2) => (Module._index_deform_tuple = wasmExports.index_deform_tuple)(e, t, r2, a2);
    Module._LaunchParallelWorkers = (e) => (Module._LaunchParallelWorkers = wasmExports.LaunchParallelWorkers)(e);
    Module._standard_ExecutorStart = (e, t) => (Module._standard_ExecutorStart = wasmExports.standard_ExecutorStart)(e, t);
    Module._GetCommandTagName = (e) => (Module._GetCommandTagName = wasmExports.GetCommandTagName)(e);
    Module._standard_ExecutorRun = (e, t, r2, a2) => (Module._standard_ExecutorRun = wasmExports.standard_ExecutorRun)(e, t, r2, a2);
    Module._EnterParallelMode = () => (Module._EnterParallelMode = wasmExports.EnterParallelMode)();
    Module._ExitParallelMode = () => (Module._ExitParallelMode = wasmExports.ExitParallelMode)();
    Module._standard_ExecutorFinish = (e) => (Module._standard_ExecutorFinish = wasmExports.standard_ExecutorFinish)(e);
    Module._standard_ExecutorEnd = (e) => (Module._standard_ExecutorEnd = wasmExports.standard_ExecutorEnd)(e);
    Module._MakeTupleTableSlot = (e, t) => (Module._MakeTupleTableSlot = wasmExports.MakeTupleTableSlot)(e, t);
    Module._CreateParallelContext = (e, t, r2) => (Module._CreateParallelContext = wasmExports.CreateParallelContext)(e, t, r2);
    Module._InitializeParallelDSM = (e) => (Module._InitializeParallelDSM = wasmExports.InitializeParallelDSM)(e);
    Module._WaitForParallelWorkersToFinish = (e) => (Module._WaitForParallelWorkersToFinish = wasmExports.WaitForParallelWorkersToFinish)(e);
    Module._DestroyParallelContext = (e) => (Module._DestroyParallelContext = wasmExports.DestroyParallelContext)(e);
    Module._SPI_connect = () => (Module._SPI_connect = wasmExports.SPI_connect)();
    Module._SPI_connect_ext = (e) => (Module._SPI_connect_ext = wasmExports.SPI_connect_ext)(e);
    Module._SPI_finish = () => (Module._SPI_finish = wasmExports.SPI_finish)();
    Module._SPI_commit = () => (Module._SPI_commit = wasmExports.SPI_commit)();
    Module._ReThrowError = (e) => (Module._ReThrowError = wasmExports.ReThrowError)(e);
    Module._SPI_commit_and_chain = () => (Module._SPI_commit_and_chain = wasmExports.SPI_commit_and_chain)();
    Module._SPI_rollback = () => (Module._SPI_rollback = wasmExports.SPI_rollback)();
    Module._SPI_rollback_and_chain = () => (Module._SPI_rollback_and_chain = wasmExports.SPI_rollback_and_chain)();
    Module._SPI_execute = (e, t, r2) => (Module._SPI_execute = wasmExports.SPI_execute)(e, t, r2);
    Module._EnsurePortalSnapshotExists = () => (Module._EnsurePortalSnapshotExists = wasmExports.EnsurePortalSnapshotExists)();
    Module._SPI_freetuptable = (e) => (Module._SPI_freetuptable = wasmExports.SPI_freetuptable)(e);
    Module._ReleaseCachedPlan = (e, t) => (Module._ReleaseCachedPlan = wasmExports.ReleaseCachedPlan)(e, t);
    Module._SPI_exec = (e, t) => (Module._SPI_exec = wasmExports.SPI_exec)(e, t);
    Module._SPI_execute_extended = (e, t) => (Module._SPI_execute_extended = wasmExports.SPI_execute_extended)(e, t);
    Module._makeParamList = (e) => (Module._makeParamList = wasmExports.makeParamList)(e);
    Module._SPI_execp = (e, t, r2, a2) => (Module._SPI_execp = wasmExports.SPI_execp)(e, t, r2, a2);
    Module._SPI_execute_plan_extended = (e, t) => (Module._SPI_execute_plan_extended = wasmExports.SPI_execute_plan_extended)(e, t);
    Module._SPI_execute_plan_with_paramlist = (e, t, r2, a2) => (Module._SPI_execute_plan_with_paramlist = wasmExports.SPI_execute_plan_with_paramlist)(e, t, r2, a2);
    Module._SPI_prepare = (e, t, r2) => (Module._SPI_prepare = wasmExports.SPI_prepare)(e, t, r2);
    Module._SPI_prepare_extended = (e, t) => (Module._SPI_prepare_extended = wasmExports.SPI_prepare_extended)(e, t);
    Module._SPI_keepplan = (e) => (Module._SPI_keepplan = wasmExports.SPI_keepplan)(e);
    Module._SPI_freeplan = (e) => (Module._SPI_freeplan = wasmExports.SPI_freeplan)(e);
    Module._SPI_copytuple = (e) => (Module._SPI_copytuple = wasmExports.SPI_copytuple)(e);
    Module._SPI_returntuple = (e, t) => (Module._SPI_returntuple = wasmExports.SPI_returntuple)(e, t);
    Module._SPI_fnumber = (e, t) => (Module._SPI_fnumber = wasmExports.SPI_fnumber)(e, t);
    Module._SPI_fname = (e, t) => (Module._SPI_fname = wasmExports.SPI_fname)(e, t);
    Module._SPI_getvalue = (e, t, r2) => (Module._SPI_getvalue = wasmExports.SPI_getvalue)(e, t, r2);
    Module._SPI_getbinval = (e, t, r2, a2) => (Module._SPI_getbinval = wasmExports.SPI_getbinval)(e, t, r2, a2);
    Module._SPI_gettype = (e, t) => (Module._SPI_gettype = wasmExports.SPI_gettype)(e, t);
    Module._SPI_gettypeid = (e, t) => (Module._SPI_gettypeid = wasmExports.SPI_gettypeid)(e, t);
    Module._SPI_getrelname = (e) => (Module._SPI_getrelname = wasmExports.SPI_getrelname)(e);
    Module._SPI_palloc = (e) => (Module._SPI_palloc = wasmExports.SPI_palloc)(e);
    Module._SPI_datumTransfer = (e, t, r2) => (Module._SPI_datumTransfer = wasmExports.SPI_datumTransfer)(e, t, r2);
    Module._datumTransfer = (e, t, r2) => (Module._datumTransfer = wasmExports.datumTransfer)(e, t, r2);
    Module._SPI_cursor_open_with_paramlist = (e, t, r2, a2) => (Module._SPI_cursor_open_with_paramlist = wasmExports.SPI_cursor_open_with_paramlist)(e, t, r2, a2);
    Module._SPI_cursor_parse_open = (e, t, r2) => (Module._SPI_cursor_parse_open = wasmExports.SPI_cursor_parse_open)(e, t, r2);
    Module._SPI_cursor_find = (e) => (Module._SPI_cursor_find = wasmExports.SPI_cursor_find)(e);
    Module._SPI_cursor_fetch = (e, t, r2) => (Module._SPI_cursor_fetch = wasmExports.SPI_cursor_fetch)(e, t, r2);
    Module._SPI_scroll_cursor_fetch = (e, t, r2) => (Module._SPI_scroll_cursor_fetch = wasmExports.SPI_scroll_cursor_fetch)(e, t, r2);
    Module._SPI_scroll_cursor_move = (e, t, r2) => (Module._SPI_scroll_cursor_move = wasmExports.SPI_scroll_cursor_move)(e, t, r2);
    Module._SPI_cursor_close = (e) => (Module._SPI_cursor_close = wasmExports.SPI_cursor_close)(e);
    Module._SPI_result_code_string = (e) => (Module._SPI_result_code_string = wasmExports.SPI_result_code_string)(e);
    Module._SPI_plan_get_plan_sources = (e) => (Module._SPI_plan_get_plan_sources = wasmExports.SPI_plan_get_plan_sources)(e);
    Module._SPI_plan_get_cached_plan = (e) => (Module._SPI_plan_get_cached_plan = wasmExports.SPI_plan_get_cached_plan)(e);
    Module._geterrposition = () => (Module._geterrposition = wasmExports.geterrposition)();
    Module._internalerrposition = (e) => (Module._internalerrposition = wasmExports.internalerrposition)(e);
    Module._internalerrquery = (e) => (Module._internalerrquery = wasmExports.internalerrquery)(e);
    Module._SPI_register_trigger_data = (e) => (Module._SPI_register_trigger_data = wasmExports.SPI_register_trigger_data)(e);
    Module._EOH_get_flat_size = (e) => (Module._EOH_get_flat_size = wasmExports.EOH_get_flat_size)(e);
    Module._EOH_flatten_into = (e, t, r2) => (Module._EOH_flatten_into = wasmExports.EOH_flatten_into)(e, t, r2);
    Module._ExecFetchSlotHeapTuple = (e, t, r2) => (Module._ExecFetchSlotHeapTuple = wasmExports.ExecFetchSlotHeapTuple)(e, t, r2);
    Module._InputFunctionCall = (e, t, r2, a2) => (Module._InputFunctionCall = wasmExports.InputFunctionCall)(e, t, r2, a2);
    Module._convert_tuples_by_position = (e, t, r2) => (Module._convert_tuples_by_position = wasmExports.convert_tuples_by_position)(e, t, r2);
    Module._SetTuplestoreDestReceiverParams = (e, t, r2, a2, o2, s2) => (Module._SetTuplestoreDestReceiverParams = wasmExports.SetTuplestoreDestReceiverParams)(e, t, r2, a2, o2, s2);
    Module._detoast_external_attr = (e) => (Module._detoast_external_attr = wasmExports.detoast_external_attr)(e);
    Module._bms_nonempty_difference = (e, t) => (Module._bms_nonempty_difference = wasmExports.bms_nonempty_difference)(e, t);
    Module._table_parallelscan_estimate = (e, t) => (Module._table_parallelscan_estimate = wasmExports.table_parallelscan_estimate)(e, t);
    Module._table_parallelscan_initialize = (e, t, r2) => (Module._table_parallelscan_initialize = wasmExports.table_parallelscan_initialize)(e, t, r2);
    Module._table_beginscan_parallel = (e, t) => (Module._table_beginscan_parallel = wasmExports.table_beginscan_parallel)(e, t);
    Module._BufferUsageAccumDiff = (e, t, r2) => (Module._BufferUsageAccumDiff = wasmExports.BufferUsageAccumDiff)(e, t, r2);
    Module._WalUsageAccumDiff = (e, t, r2) => (Module._WalUsageAccumDiff = wasmExports.WalUsageAccumDiff)(e, t, r2);
    Module._InstrUpdateTupleCount = (e, t) => (Module._InstrUpdateTupleCount = wasmExports.InstrUpdateTupleCount)(e, t);
    Module._tuplesort_reset = (e) => (Module._tuplesort_reset = wasmExports.tuplesort_reset)(e);
    Module._get_call_expr_argtype = (e, t) => (Module._get_call_expr_argtype = wasmExports.get_call_expr_argtype)(e, t);
    Module._get_typtype = (e) => (Module._get_typtype = wasmExports.get_typtype)(e);
    Module._pull_var_clause = (e, t) => (Module._pull_var_clause = wasmExports.pull_var_clause)(e, t);
    Module._bms_is_subset = (e, t) => (Module._bms_is_subset = wasmExports.bms_is_subset)(e, t);
    Module._bms_membership = (e) => (Module._bms_membership = wasmExports.bms_membership)(e);
    Module._make_restrictinfo = (e, t, r2, a2, o2, s2, l2, n2, _2, m2) => (Module._make_restrictinfo = wasmExports.make_restrictinfo)(e, t, r2, a2, o2, s2, l2, n2, _2, m2);
    Module._GetSysCacheHashValue = (e, t, r2, a2, o2) => (Module._GetSysCacheHashValue = wasmExports.GetSysCacheHashValue)(e, t, r2, a2, o2);
    Module._tlist_member = (e, t) => (Module._tlist_member = wasmExports.tlist_member)(e, t);
    Module._add_path = (e, t) => (Module._add_path = wasmExports.add_path)(e, t);
    Module._contain_mutable_functions = (e) => (Module._contain_mutable_functions = wasmExports.contain_mutable_functions)(e);
    Module._make_orclause = (e) => (Module._make_orclause = wasmExports.make_orclause)(e);
    Module._extract_actual_clauses = (e, t) => (Module._extract_actual_clauses = wasmExports.extract_actual_clauses)(e, t);
    Module._cost_sort = (e, t, r2, a2, o2, s2, l2, n2, _2) => (Module._cost_sort = wasmExports.cost_sort)(e, t, r2, a2, o2, s2, l2, n2, _2);
    Module._pathkeys_contained_in = (e, t) => (Module._pathkeys_contained_in = wasmExports.pathkeys_contained_in)(e, t);
    Module._change_plan_targetlist = (e, t, r2) => (Module._change_plan_targetlist = wasmExports.change_plan_targetlist)(e, t, r2);
    Module._make_foreignscan = (e, t, r2, a2, o2, s2, l2, n2) => (Module._make_foreignscan = wasmExports.make_foreignscan)(e, t, r2, a2, o2, s2, l2, n2);
    Module._list_member_ptr = (e, t) => (Module._list_member_ptr = wasmExports.list_member_ptr)(e, t);
    Module._clamp_row_est = (e) => (Module._clamp_row_est = wasmExports.clamp_row_est)(e);
    Module._standard_planner = (e, t, r2, a2) => (Module._standard_planner = wasmExports.standard_planner)(e, t, r2, a2);
    Module._estimate_expression_value = (e, t) => (Module._estimate_expression_value = wasmExports.estimate_expression_value)(e, t);
    Module._add_new_columns_to_pathtarget = (e, t) => (Module._add_new_columns_to_pathtarget = wasmExports.add_new_columns_to_pathtarget)(e, t);
    Module._get_sortgroupref_clause_noerr = (e, t) => (Module._get_sortgroupref_clause_noerr = wasmExports.get_sortgroupref_clause_noerr)(e, t);
    Module._get_agg_clause_costs = (e, t, r2) => (Module._get_agg_clause_costs = wasmExports.get_agg_clause_costs)(e, t, r2);
    Module._grouping_is_sortable = (e) => (Module._grouping_is_sortable = wasmExports.grouping_is_sortable)(e);
    Module._create_sort_path = (e, t, r2, a2, o2) => (Module._create_sort_path = wasmExports.create_sort_path)(e, t, r2, a2, o2);
    Module._copy_pathtarget = (e) => (Module._copy_pathtarget = wasmExports.copy_pathtarget)(e);
    Module._get_sortgrouplist_exprs = (e, t) => (Module._get_sortgrouplist_exprs = wasmExports.get_sortgrouplist_exprs)(e, t);
    Module._estimate_num_groups = (e, t, r2, a2, o2) => (Module._estimate_num_groups = wasmExports.estimate_num_groups)(e, t, r2, a2, o2);
    Module._cost_qual_eval = (e, t, r2) => (Module._cost_qual_eval = wasmExports.cost_qual_eval)(e, t, r2);
    Module._plan_create_index_workers = (e, t) => (Module._plan_create_index_workers = wasmExports.plan_create_index_workers)(e, t);
    Module._create_projection_path = (e, t, r2, a2) => (Module._create_projection_path = wasmExports.create_projection_path)(e, t, r2, a2);
    Module._get_plan_rowmark = (e, t) => (Module._get_plan_rowmark = wasmExports.get_plan_rowmark)(e, t);
    Module._find_join_rel = (e, t) => (Module._find_join_rel = wasmExports.find_join_rel)(e, t);
    Module._make_canonical_pathkey = (e, t, r2, a2, o2) => (Module._make_canonical_pathkey = wasmExports.make_canonical_pathkey)(e, t, r2, a2, o2);
    Module._eclass_useful_for_merging = (e, t, r2) => (Module._eclass_useful_for_merging = wasmExports.eclass_useful_for_merging)(e, t, r2);
    Module._update_mergeclause_eclasses = (e, t) => (Module._update_mergeclause_eclasses = wasmExports.update_mergeclause_eclasses)(e, t);
    Module._clauselist_selectivity = (e, t, r2, a2, o2) => (Module._clauselist_selectivity = wasmExports.clauselist_selectivity)(e, t, r2, a2, o2);
    Module._join_clause_is_movable_to = (e, t) => (Module._join_clause_is_movable_to = wasmExports.join_clause_is_movable_to)(e, t);
    Module._generate_implied_equalities_for_column = (e, t, r2, a2, o2) => (Module._generate_implied_equalities_for_column = wasmExports.generate_implied_equalities_for_column)(e, t, r2, a2, o2);
    Module._get_tablespace_page_costs = (e, t, r2) => (Module._get_tablespace_page_costs = wasmExports.get_tablespace_page_costs)(e, t, r2);
    Module._set_baserel_size_estimates = (e, t) => (Module._set_baserel_size_estimates = wasmExports.set_baserel_size_estimates)(e, t);
    Module._add_to_flat_tlist = (e, t) => (Module._add_to_flat_tlist = wasmExports.add_to_flat_tlist)(e, t);
    Module._get_baserel_parampathinfo = (e, t, r2) => (Module._get_baserel_parampathinfo = wasmExports.get_baserel_parampathinfo)(e, t, r2);
    Module._create_foreignscan_path = (e, t, r2, a2, o2, s2, l2, n2, _2, m2) => (Module._create_foreignscan_path = wasmExports.create_foreignscan_path)(e, t, r2, a2, o2, s2, l2, n2, _2, m2);
    Module._create_foreign_join_path = (e, t, r2, a2, o2, s2, l2, n2, _2, m2) => (Module._create_foreign_join_path = wasmExports.create_foreign_join_path)(e, t, r2, a2, o2, s2, l2, n2, _2, m2);
    Module._create_foreign_upper_path = (e, t, r2, a2, o2, s2, l2, n2, _2) => (Module._create_foreign_upper_path = wasmExports.create_foreign_upper_path)(e, t, r2, a2, o2, s2, l2, n2, _2);
    Module._adjust_limit_rows_costs = (e, t, r2, a2, o2) => (Module._adjust_limit_rows_costs = wasmExports.adjust_limit_rows_costs)(e, t, r2, a2, o2);
    Module._SearchSysCacheAttName = (e, t) => (Module._SearchSysCacheAttName = wasmExports.SearchSysCacheAttName)(e, t);
    Module._get_translated_update_targetlist = (e, t, r2, a2) => (Module._get_translated_update_targetlist = wasmExports.get_translated_update_targetlist)(e, t, r2, a2);
    Module._add_row_identity_var = (e, t, r2, a2) => (Module._add_row_identity_var = wasmExports.add_row_identity_var)(e, t, r2, a2);
    Module._get_rel_all_updated_cols = (e, t) => (Module._get_rel_all_updated_cols = wasmExports.get_rel_all_updated_cols)(e, t);
    Module._list_append_unique_ptr = (e, t) => (Module._list_append_unique_ptr = wasmExports.list_append_unique_ptr)(e, t);
    Module._palloc_extended = (e, t) => (Module._palloc_extended = wasmExports.palloc_extended)(e, t);
    Module._pg_reg_getinitialstate = (e) => (Module._pg_reg_getinitialstate = wasmExports.pg_reg_getinitialstate)(e);
    Module._pg_reg_getfinalstate = (e) => (Module._pg_reg_getfinalstate = wasmExports.pg_reg_getfinalstate)(e);
    Module._pg_reg_getnumoutarcs = (e, t) => (Module._pg_reg_getnumoutarcs = wasmExports.pg_reg_getnumoutarcs)(e, t);
    Module._pg_reg_getoutarcs = (e, t, r2, a2) => (Module._pg_reg_getoutarcs = wasmExports.pg_reg_getoutarcs)(e, t, r2, a2);
    Module._pg_reg_getnumcolors = (e) => (Module._pg_reg_getnumcolors = wasmExports.pg_reg_getnumcolors)(e);
    Module._pg_reg_colorisbegin = (e, t) => (Module._pg_reg_colorisbegin = wasmExports.pg_reg_colorisbegin)(e, t);
    Module._pg_reg_colorisend = (e, t) => (Module._pg_reg_colorisend = wasmExports.pg_reg_colorisend)(e, t);
    Module._pg_reg_getnumcharacters = (e, t) => (Module._pg_reg_getnumcharacters = wasmExports.pg_reg_getnumcharacters)(e, t);
    Module._pg_reg_getcharacters = (e, t, r2, a2) => (Module._pg_reg_getcharacters = wasmExports.pg_reg_getcharacters)(e, t, r2, a2);
    Module._toupper = (e) => (Module._toupper = wasmExports.toupper)(e);
    Module._pg_initdb = () => (Module._pg_initdb = wasmExports.pg_initdb)();
    Module._pg_initdb_main = () => (Module._pg_initdb_main = wasmExports.pg_initdb_main)();
    Module.___cxa_throw = (e, t, r2) => (Module.___cxa_throw = wasmExports.__cxa_throw)(e, t, r2);
    Module._main_repl = () => (Module._main_repl = wasmExports.main_repl)();
    Module._main = (e, t) => (Module._main = wasmExports.__main_argc_argv)(e, t);
    Module._setenv = (e, t, r2) => (Module._setenv = wasmExports.setenv)(e, t, r2);
    Module._pg_repl_raf = () => (Module._pg_repl_raf = wasmExports.pg_repl_raf)();
    Module._GetForeignDataWrapper = (e) => (Module._GetForeignDataWrapper = wasmExports.GetForeignDataWrapper)(e);
    Module._GetForeignServer = (e) => (Module._GetForeignServer = wasmExports.GetForeignServer)(e);
    Module._GetForeignServerExtended = (e, t) => (Module._GetForeignServerExtended = wasmExports.GetForeignServerExtended)(e, t);
    Module._GetForeignServerByName = (e, t) => (Module._GetForeignServerByName = wasmExports.GetForeignServerByName)(e, t);
    Module._GetUserMapping = (e, t) => (Module._GetUserMapping = wasmExports.GetUserMapping)(e, t);
    Module._GetForeignTable = (e) => (Module._GetForeignTable = wasmExports.GetForeignTable)(e);
    Module._GetForeignColumnOptions = (e, t) => (Module._GetForeignColumnOptions = wasmExports.GetForeignColumnOptions)(e, t);
    Module._initClosestMatch = (e, t, r2) => (Module._initClosestMatch = wasmExports.initClosestMatch)(e, t, r2);
    Module._updateClosestMatch = (e, t) => (Module._updateClosestMatch = wasmExports.updateClosestMatch)(e, t);
    Module._getClosestMatch = (e) => (Module._getClosestMatch = wasmExports.getClosestMatch)(e);
    Module._GetExistingLocalJoinPath = (e) => (Module._GetExistingLocalJoinPath = wasmExports.GetExistingLocalJoinPath)(e);
    Module._BaseBackupAddTarget = (e, t, r2) => (Module._BaseBackupAddTarget = wasmExports.BaseBackupAddTarget)(e, t, r2);
    Module._bbsink_forward_begin_backup = (e) => (Module._bbsink_forward_begin_backup = wasmExports.bbsink_forward_begin_backup)(e);
    Module._bbsink_forward_archive_contents = (e, t) => (Module._bbsink_forward_archive_contents = wasmExports.bbsink_forward_archive_contents)(e, t);
    Module._bbsink_forward_end_archive = (e) => (Module._bbsink_forward_end_archive = wasmExports.bbsink_forward_end_archive)(e);
    Module._bbsink_forward_begin_archive = (e, t) => (Module._bbsink_forward_begin_archive = wasmExports.bbsink_forward_begin_archive)(e, t);
    Module._bbsink_forward_begin_manifest = (e) => (Module._bbsink_forward_begin_manifest = wasmExports.bbsink_forward_begin_manifest)(e);
    Module._bbsink_forward_manifest_contents = (e, t) => (Module._bbsink_forward_manifest_contents = wasmExports.bbsink_forward_manifest_contents)(e, t);
    Module._bbsink_forward_end_manifest = (e) => (Module._bbsink_forward_end_manifest = wasmExports.bbsink_forward_end_manifest)(e);
    Module._bbsink_forward_end_backup = (e, t, r2) => (Module._bbsink_forward_end_backup = wasmExports.bbsink_forward_end_backup)(e, t, r2);
    Module._bbsink_forward_cleanup = (e) => (Module._bbsink_forward_cleanup = wasmExports.bbsink_forward_cleanup)(e);
    Module._ResourceOwnerCreate = (e, t) => (Module._ResourceOwnerCreate = wasmExports.ResourceOwnerCreate)(e, t);
    Module._escape_json = (e, t) => (Module._escape_json = wasmExports.escape_json)(e, t);
    Module._exprIsLengthCoercion = (e, t) => (Module._exprIsLengthCoercion = wasmExports.exprIsLengthCoercion)(e, t);
    Module._tbm_add_tuples = (e, t, r2, a2) => (Module._tbm_add_tuples = wasmExports.tbm_add_tuples)(e, t, r2, a2);
    Module._appendStringInfoStringQuoted = (e, t, r2) => (Module._appendStringInfoStringQuoted = wasmExports.appendStringInfoStringQuoted)(e, t, r2);
    Module._list_make5_impl = (e, t, r2, a2, o2, s2) => (Module._list_make5_impl = wasmExports.list_make5_impl)(e, t, r2, a2, o2, s2);
    Module._list_delete = (e, t) => (Module._list_delete = wasmExports.list_delete)(e, t);
    Module._CleanQuerytext = (e, t, r2) => (Module._CleanQuerytext = wasmExports.CleanQuerytext)(e, t, r2);
    Module._EnableQueryId = () => (Module._EnableQueryId = wasmExports.EnableQueryId)();
    Module._get_rel_type_id = (e) => (Module._get_rel_type_id = wasmExports.get_rel_type_id)(e);
    Module._set_config_option = (e, t, r2, a2, o2, s2, l2, n2) => (Module._set_config_option = wasmExports.set_config_option)(e, t, r2, a2, o2, s2, l2, n2);
    Module._NewGUCNestLevel = () => (Module._NewGUCNestLevel = wasmExports.NewGUCNestLevel)();
    Module._AtEOXact_GUC = (e, t) => (Module._AtEOXact_GUC = wasmExports.AtEOXact_GUC)(e, t);
    Module._parse_int = (e, t, r2, a2) => (Module._parse_int = wasmExports.parse_int)(e, t, r2, a2);
    Module._strtod = (e, t) => (Module._strtod = wasmExports.strtod)(e, t);
    Module._parse_real = (e, t, r2, a2) => (Module._parse_real = wasmExports.parse_real)(e, t, r2, a2);
    Module._DefineCustomBoolVariable = (e, t, r2, a2, o2, s2, l2, n2, _2, m2) => (Module._DefineCustomBoolVariable = wasmExports.DefineCustomBoolVariable)(e, t, r2, a2, o2, s2, l2, n2, _2, m2);
    Module._DefineCustomIntVariable = (e, t, r2, a2, o2, s2, l2, n2, _2, m2, p2, d2) => (Module._DefineCustomIntVariable = wasmExports.DefineCustomIntVariable)(e, t, r2, a2, o2, s2, l2, n2, _2, m2, p2, d2);
    Module._DefineCustomRealVariable = (e, t, r2, a2, o2, s2, l2, n2, _2, m2, p2, d2) => (Module._DefineCustomRealVariable = wasmExports.DefineCustomRealVariable)(e, t, r2, a2, o2, s2, l2, n2, _2, m2, p2, d2);
    Module._DefineCustomStringVariable = (e, t, r2, a2, o2, s2, l2, n2, _2, m2) => (Module._DefineCustomStringVariable = wasmExports.DefineCustomStringVariable)(e, t, r2, a2, o2, s2, l2, n2, _2, m2);
    Module._DefineCustomEnumVariable = (e, t, r2, a2, o2, s2, l2, n2, _2, m2, p2) => (Module._DefineCustomEnumVariable = wasmExports.DefineCustomEnumVariable)(e, t, r2, a2, o2, s2, l2, n2, _2, m2, p2);
    Module._MarkGUCPrefixReserved = (e) => (Module._MarkGUCPrefixReserved = wasmExports.MarkGUCPrefixReserved)(e);
    Module._strcspn = (e, t) => (Module._strcspn = wasmExports.strcspn)(e, t);
    Module._BlockSampler_Init = (e, t, r2, a2) => (Module._BlockSampler_Init = wasmExports.BlockSampler_Init)(e, t, r2, a2);
    Module._sampler_random_init_state = (e, t) => (Module._sampler_random_init_state = wasmExports.sampler_random_init_state)(e, t);
    Module._BlockSampler_HasMore = (e) => (Module._BlockSampler_HasMore = wasmExports.BlockSampler_HasMore)(e);
    Module._BlockSampler_Next = (e) => (Module._BlockSampler_Next = wasmExports.BlockSampler_Next)(e);
    Module._sampler_random_fract = (e) => (Module._sampler_random_fract = wasmExports.sampler_random_fract)(e);
    Module._reservoir_init_selection_state = (e, t) => (Module._reservoir_init_selection_state = wasmExports.reservoir_init_selection_state)(e, t);
    Module._reservoir_get_next_S = (e, t, r2) => (Module._reservoir_get_next_S = wasmExports.reservoir_get_next_S)(e, t, r2);
    Module._canonicalize_path = (e) => (Module._canonicalize_path = wasmExports.canonicalize_path)(e);
    Module.__bt_mkscankey = (e, t) => (Module.__bt_mkscankey = wasmExports._bt_mkscankey)(e, t);
    Module._nocache_index_getattr = (e, t, r2) => (Module._nocache_index_getattr = wasmExports.nocache_index_getattr)(e, t, r2);
    Module._tuplesort_estimate_shared = (e) => (Module._tuplesort_estimate_shared = wasmExports.tuplesort_estimate_shared)(e);
    Module._tuplesort_initialize_shared = (e, t, r2) => (Module._tuplesort_initialize_shared = wasmExports.tuplesort_initialize_shared)(e, t, r2);
    Module._tuplesort_attach_shared = (e, t) => (Module._tuplesort_attach_shared = wasmExports.tuplesort_attach_shared)(e, t);
    Module._GetCurrentTransactionNestLevel = () => (Module._GetCurrentTransactionNestLevel = wasmExports.GetCurrentTransactionNestLevel)();
    Module._in_error_recursion_trouble = () => (Module._in_error_recursion_trouble = wasmExports.in_error_recursion_trouble)();
    Module._strrchr = (e, t) => (Module._strrchr = wasmExports.strrchr)(e, t);
    Module._errhidestmt = (e) => (Module._errhidestmt = wasmExports.errhidestmt)(e);
    Module._err_generic_string = (e, t) => (Module._err_generic_string = wasmExports.err_generic_string)(e, t);
    Module._getinternalerrposition = () => (Module._getinternalerrposition = wasmExports.getinternalerrposition)();
    Module._GetErrorContextStack = () => (Module._GetErrorContextStack = wasmExports.GetErrorContextStack)();
    Module._SplitIdentifierString = (e, t, r2) => (Module._SplitIdentifierString = wasmExports.SplitIdentifierString)(e, t, r2);
    Module._appendStringInfoSpaces = (e, t) => (Module._appendStringInfoSpaces = wasmExports.appendStringInfoSpaces)(e, t);
    Module._unpack_sql_state = (e) => (Module._unpack_sql_state = wasmExports.unpack_sql_state)(e);
    Module._CreateTupleDescCopyConstr = (e) => (Module._CreateTupleDescCopyConstr = wasmExports.CreateTupleDescCopyConstr)(e);
    Module._CachedPlanAllowsSimpleValidityCheck = (e, t, r2) => (Module._CachedPlanAllowsSimpleValidityCheck = wasmExports.CachedPlanAllowsSimpleValidityCheck)(e, t, r2);
    Module._CachedPlanIsSimplyValid = (e, t, r2) => (Module._CachedPlanIsSimplyValid = wasmExports.CachedPlanIsSimplyValid)(e, t, r2);
    Module._GetCachedExpression = (e) => (Module._GetCachedExpression = wasmExports.GetCachedExpression)(e);
    Module._FreeCachedExpression = (e) => (Module._FreeCachedExpression = wasmExports.FreeCachedExpression)(e);
    Module._MemoryContextDeleteChildren = (e) => (Module._MemoryContextDeleteChildren = wasmExports.MemoryContextDeleteChildren)(e);
    Module._is_publishable_relation = (e) => (Module._is_publishable_relation = wasmExports.is_publishable_relation)(e);
    Module._GetRelationPublications = (e) => (Module._GetRelationPublications = wasmExports.GetRelationPublications)(e);
    Module._GetSchemaPublications = (e) => (Module._GetSchemaPublications = wasmExports.GetSchemaPublications)(e);
    Module._index_getprocid = (e, t, r2) => (Module._index_getprocid = wasmExports.index_getprocid)(e, t, r2);
    Module._get_rel_relispartition = (e) => (Module._get_rel_relispartition = wasmExports.get_rel_relispartition)(e);
    Module._get_func_namespace = (e) => (Module._get_func_namespace = wasmExports.get_func_namespace)(e);
    Module._get_typsubscript = (e, t) => (Module._get_typsubscript = wasmExports.get_typsubscript)(e, t);
    Module._get_namespace_name_or_temp = (e) => (Module._get_namespace_name_or_temp = wasmExports.get_namespace_name_or_temp)(e);
    Module._texteq = (e) => (Module._texteq = wasmExports.texteq)(e);
    Module._GetUserIdAndSecContext = (e, t) => (Module._GetUserIdAndSecContext = wasmExports.GetUserIdAndSecContext)(e, t);
    Module._SetUserIdAndSecContext = (e, t) => (Module._SetUserIdAndSecContext = wasmExports.SetUserIdAndSecContext)(e, t);
    Module._DirectFunctionCall5Coll = (e, t, r2, a2, o2, s2, l2) => (Module._DirectFunctionCall5Coll = wasmExports.DirectFunctionCall5Coll)(e, t, r2, a2, o2, s2, l2);
    Module._CallerFInfoFunctionCall2 = (e, t, r2, a2, o2) => (Module._CallerFInfoFunctionCall2 = wasmExports.CallerFInfoFunctionCall2)(e, t, r2, a2, o2);
    Module._FunctionCall0Coll = (e, t) => (Module._FunctionCall0Coll = wasmExports.FunctionCall0Coll)(e, t);
    Module._OutputFunctionCall = (e, t) => (Module._OutputFunctionCall = wasmExports.OutputFunctionCall)(e, t);
    Module._get_fn_expr_rettype = (e) => (Module._get_fn_expr_rettype = wasmExports.get_fn_expr_rettype)(e);
    Module._has_fn_opclass_options = (e) => (Module._has_fn_opclass_options = wasmExports.has_fn_opclass_options)(e);
    Module._get_fn_opclass_options = (e) => (Module._get_fn_opclass_options = wasmExports.get_fn_opclass_options)(e);
    Module._CheckFunctionValidatorAccess = (e, t) => (Module._CheckFunctionValidatorAccess = wasmExports.CheckFunctionValidatorAccess)(e, t);
    Module._resolve_polymorphic_argtypes = (e, t, r2, a2) => (Module._resolve_polymorphic_argtypes = wasmExports.resolve_polymorphic_argtypes)(e, t, r2, a2);
    Module._get_func_arg_info = (e, t, r2, a2) => (Module._get_func_arg_info = wasmExports.get_func_arg_info)(e, t, r2, a2);
    Module._dlsym = (e, t) => (Module._dlsym = wasmExports.dlsym)(e, t);
    Module._dlopen = (e, t) => (Module._dlopen = wasmExports.dlopen)(e, t);
    Module._dlerror = () => (Module._dlerror = wasmExports.dlerror)();
    Module._dlclose = (e) => (Module._dlclose = wasmExports.dlclose)(e);
    Module._find_rendezvous_variable = (e) => (Module._find_rendezvous_variable = wasmExports.find_rendezvous_variable)(e);
    Module._fscanf = (e, t, r2) => (Module._fscanf = wasmExports.fscanf)(e, t, r2);
    Module._strlcat = (e, t, r2) => (Module._strlcat = wasmExports.strlcat)(e, t, r2);
    Module._pg_bindtextdomain = (e) => (Module._pg_bindtextdomain = wasmExports.pg_bindtextdomain)(e);
    Module._pg_do_encoding_conversion = (e, t, r2, a2) => (Module._pg_do_encoding_conversion = wasmExports.pg_do_encoding_conversion)(e, t, r2, a2);
    Module._report_invalid_encoding = (e, t, r2) => (Module._report_invalid_encoding = wasmExports.report_invalid_encoding)(e, t, r2);
    Module._pg_encoding_to_char_private = (e) => (Module._pg_encoding_to_char_private = wasmExports.pg_encoding_to_char_private)(e);
    Module._MemoryContextAllocHuge = (e, t) => (Module._MemoryContextAllocHuge = wasmExports.MemoryContextAllocHuge)(e, t);
    Module._namein = (e) => (Module._namein = wasmExports.namein)(e);
    Module._pg_char_to_encoding_private = (e) => (Module._pg_char_to_encoding_private = wasmExports.pg_char_to_encoding_private)(e);
    Module._pg_encoding_max_length = (e) => (Module._pg_encoding_max_length = wasmExports.pg_encoding_max_length)(e);
    Module._pg_server_to_any = (e, t, r2) => (Module._pg_server_to_any = wasmExports.pg_server_to_any)(e, t, r2);
    Module._pg_utf_mblen = (e) => (Module._pg_utf_mblen = wasmExports.pg_utf_mblen)(e);
    Module._pg_wchar2mb_with_len = (e, t, r2) => (Module._pg_wchar2mb_with_len = wasmExports.pg_wchar2mb_with_len)(e, t, r2);
    Module._pg_encoding_mblen = (e, t) => (Module._pg_encoding_mblen = wasmExports.pg_encoding_mblen)(e, t);
    Module._check_encoding_conversion_args = (e, t, r2, a2, o2) => (Module._check_encoding_conversion_args = wasmExports.check_encoding_conversion_args)(e, t, r2, a2, o2);
    Module._report_untranslatable_char = (e, t, r2, a2) => (Module._report_untranslatable_char = wasmExports.report_untranslatable_char)(e, t, r2, a2);
    Module._local2local = (e, t, r2, a2, o2, s2, l2) => (Module._local2local = wasmExports.local2local)(e, t, r2, a2, o2, s2, l2);
    Module._latin2mic = (e, t, r2, a2, o2, s2) => (Module._latin2mic = wasmExports.latin2mic)(e, t, r2, a2, o2, s2);
    Module._mic2latin = (e, t, r2, a2, o2, s2) => (Module._mic2latin = wasmExports.mic2latin)(e, t, r2, a2, o2, s2);
    Module._latin2mic_with_table = (e, t, r2, a2, o2, s2, l2) => (Module._latin2mic_with_table = wasmExports.latin2mic_with_table)(e, t, r2, a2, o2, s2, l2);
    Module._mic2latin_with_table = (e, t, r2, a2, o2, s2, l2) => (Module._mic2latin_with_table = wasmExports.mic2latin_with_table)(e, t, r2, a2, o2, s2, l2);
    Module._pg_encoding_verifymbchar = (e, t, r2) => (Module._pg_encoding_verifymbchar = wasmExports.pg_encoding_verifymbchar)(e, t, r2);
    Module._float_overflow_error = () => (Module._float_overflow_error = wasmExports.float_overflow_error)();
    Module._float_underflow_error = () => (Module._float_underflow_error = wasmExports.float_underflow_error)();
    Module._float4in_internal = (e, t, r2, a2, o2) => (Module._float4in_internal = wasmExports.float4in_internal)(e, t, r2, a2, o2);
    Module._strtof = (e, t) => (Module._strtof = wasmExports.strtof)(e, t);
    Module._float_to_shortest_decimal_buf = (e, t) => (Module._float_to_shortest_decimal_buf = wasmExports.float_to_shortest_decimal_buf)(e, t);
    Module._float8in_internal = (e, t, r2, a2, o2) => (Module._float8in_internal = wasmExports.float8in_internal)(e, t, r2, a2, o2);
    Module._float8out_internal = (e) => (Module._float8out_internal = wasmExports.float8out_internal)(e);
    Module._btfloat4cmp = (e) => (Module._btfloat4cmp = wasmExports.btfloat4cmp)(e);
    Module._btfloat8cmp = (e) => (Module._btfloat8cmp = wasmExports.btfloat8cmp)(e);
    Module._pow = (e, t) => (Module._pow = wasmExports.pow)(e, t);
    Module._log10 = (e) => (Module._log10 = wasmExports.log10)(e);
    Module._acos = (e) => (Module._acos = wasmExports.acos)(e);
    Module._asin = (e) => (Module._asin = wasmExports.asin)(e);
    Module._cos = (e) => (Module._cos = wasmExports.cos)(e);
    Module._sin = (e) => (Module._sin = wasmExports.sin)(e);
    Module._fmod = (e, t) => (Module._fmod = wasmExports.fmod)(e, t);
    Module._construct_array = (e, t, r2, a2, o2, s2) => (Module._construct_array = wasmExports.construct_array)(e, t, r2, a2, o2, s2);
    Module._try_relation_open = (e, t) => (Module._try_relation_open = wasmExports.try_relation_open)(e, t);
    Module._forkname_to_number = (e) => (Module._forkname_to_number = wasmExports.forkname_to_number)(e);
    Module._numeric_lt = (e) => (Module._numeric_lt = wasmExports.numeric_lt)(e);
    Module._int64_to_numeric = (e) => (Module._int64_to_numeric = wasmExports.int64_to_numeric)(e);
    Module._numeric_sub = (e) => (Module._numeric_sub = wasmExports.numeric_sub)(e);
    Module._numeric_ge = (e) => (Module._numeric_ge = wasmExports.numeric_ge)(e);
    Module._inet_in = (e) => (Module._inet_in = wasmExports.inet_in)(e);
    Module._format_operator = (e) => (Module._format_operator = wasmExports.format_operator)(e);
    Module._RelationIsVisible = (e) => (Module._RelationIsVisible = wasmExports.RelationIsVisible)(e);
    Module._pg_get_indexdef_columns_extended = (e, t) => (Module._pg_get_indexdef_columns_extended = wasmExports.pg_get_indexdef_columns_extended)(e, t);
    Module._accumArrayResult = (e, t, r2, a2, o2) => (Module._accumArrayResult = wasmExports.accumArrayResult)(e, t, r2, a2, o2);
    Module._makeArrayResult = (e, t) => (Module._makeArrayResult = wasmExports.makeArrayResult)(e, t);
    Module._init_local_reloptions = (e, t) => (Module._init_local_reloptions = wasmExports.init_local_reloptions)(e, t);
    Module._add_local_int_reloption = (e, t, r2, a2, o2, s2, l2) => (Module._add_local_int_reloption = wasmExports.add_local_int_reloption)(e, t, r2, a2, o2, s2, l2);
    Module._pg_inet_net_ntop = (e, t, r2, a2, o2) => (Module._pg_inet_net_ntop = wasmExports.pg_inet_net_ntop)(e, t, r2, a2, o2);
    Module._network_cmp = (e) => (Module._network_cmp = wasmExports.network_cmp)(e);
    Module._convert_network_to_scalar = (e, t, r2) => (Module._convert_network_to_scalar = wasmExports.convert_network_to_scalar)(e, t, r2);
    Module._JsonbValueToJsonb = (e) => (Module._JsonbValueToJsonb = wasmExports.JsonbValueToJsonb)(e);
    Module._pushJsonbValue = (e, t, r2) => (Module._pushJsonbValue = wasmExports.pushJsonbValue)(e, t, r2);
    Module._numeric_cmp = (e) => (Module._numeric_cmp = wasmExports.numeric_cmp)(e);
    Module._timetz_cmp = (e) => (Module._timetz_cmp = wasmExports.timetz_cmp)(e);
    Module._date_cmp = (e) => (Module._date_cmp = wasmExports.date_cmp)(e);
    Module._time_cmp = (e) => (Module._time_cmp = wasmExports.time_cmp)(e);
    Module._timestamp_cmp = (e) => (Module._timestamp_cmp = wasmExports.timestamp_cmp)(e);
    Module._domain_check = (e, t, r2, a2, o2) => (Module._domain_check = wasmExports.domain_check)(e, t, r2, a2, o2);
    Module._initArrayResult = (e, t, r2) => (Module._initArrayResult = wasmExports.initArrayResult)(e, t, r2);
    Module._path_is_prefix_of_path = (e, t) => (Module._path_is_prefix_of_path = wasmExports.path_is_prefix_of_path)(e, t);
    Module._path_is_relative_and_below_cwd = (e) => (Module._path_is_relative_and_below_cwd = wasmExports.path_is_relative_and_below_cwd)(e);
    Module._ArrayGetIntegerTypmods = (e, t) => (Module._ArrayGetIntegerTypmods = wasmExports.ArrayGetIntegerTypmods)(e, t);
    Module._bpchareq = (e) => (Module._bpchareq = wasmExports.bpchareq)(e);
    Module._varstr_cmp = (e, t, r2, a2, o2) => (Module._varstr_cmp = wasmExports.varstr_cmp)(e, t, r2, a2, o2);
    Module._bpcharlt = (e) => (Module._bpcharlt = wasmExports.bpcharlt)(e);
    Module._bpcharle = (e) => (Module._bpcharle = wasmExports.bpcharle)(e);
    Module._bpchargt = (e) => (Module._bpchargt = wasmExports.bpchargt)(e);
    Module._bpcharge = (e) => (Module._bpcharge = wasmExports.bpcharge)(e);
    Module._bpcharcmp = (e) => (Module._bpcharcmp = wasmExports.bpcharcmp)(e);
    Module._current_query = (e) => (Module._current_query = wasmExports.current_query)(e);
    Module._str_tolower = (e, t, r2) => (Module._str_tolower = wasmExports.str_tolower)(e, t, r2);
    Module._TransferExpandedObject = (e, t) => (Module._TransferExpandedObject = wasmExports.TransferExpandedObject)(e, t);
    Module._macaddr_cmp = (e) => (Module._macaddr_cmp = wasmExports.macaddr_cmp)(e);
    Module._macaddr_lt = (e) => (Module._macaddr_lt = wasmExports.macaddr_lt)(e);
    Module._macaddr_le = (e) => (Module._macaddr_le = wasmExports.macaddr_le)(e);
    Module._macaddr_eq = (e) => (Module._macaddr_eq = wasmExports.macaddr_eq)(e);
    Module._macaddr_ge = (e) => (Module._macaddr_ge = wasmExports.macaddr_ge)(e);
    Module._macaddr_gt = (e) => (Module._macaddr_gt = wasmExports.macaddr_gt)(e);
    Module._quote_ident = (e) => (Module._quote_ident = wasmExports.quote_ident)(e);
    Module._timestamp_in = (e) => (Module._timestamp_in = wasmExports.timestamp_in)(e);
    Module._ParseDateTime = (e, t, r2, a2, o2, s2, l2) => (Module._ParseDateTime = wasmExports.ParseDateTime)(e, t, r2, a2, o2, s2, l2);
    Module._DecodeDateTime = (e, t, r2, a2, o2, s2, l2, n2) => (Module._DecodeDateTime = wasmExports.DecodeDateTime)(e, t, r2, a2, o2, s2, l2, n2);
    Module.___multi3 = (e, t, r2, a2, o2) => (Module.___multi3 = wasmExports.__multi3)(e, t, r2, a2, o2);
    Module._timestamptz_in = (e) => (Module._timestamptz_in = wasmExports.timestamptz_in)(e);
    Module._timestamp_eq = (e) => (Module._timestamp_eq = wasmExports.timestamp_eq)(e);
    Module._timestamp_lt = (e) => (Module._timestamp_lt = wasmExports.timestamp_lt)(e);
    Module._timestamp_gt = (e) => (Module._timestamp_gt = wasmExports.timestamp_gt)(e);
    Module._timestamp_le = (e) => (Module._timestamp_le = wasmExports.timestamp_le)(e);
    Module._timestamp_ge = (e) => (Module._timestamp_ge = wasmExports.timestamp_ge)(e);
    Module._interval_eq = (e) => (Module._interval_eq = wasmExports.interval_eq)(e);
    Module._interval_lt = (e) => (Module._interval_lt = wasmExports.interval_lt)(e);
    Module._interval_gt = (e) => (Module._interval_gt = wasmExports.interval_gt)(e);
    Module._interval_le = (e) => (Module._interval_le = wasmExports.interval_le)(e);
    Module._interval_ge = (e) => (Module._interval_ge = wasmExports.interval_ge)(e);
    Module._interval_cmp = (e) => (Module._interval_cmp = wasmExports.interval_cmp)(e);
    Module._timestamp_mi = (e) => (Module._timestamp_mi = wasmExports.timestamp_mi)(e);
    Module._interval_um = (e) => (Module._interval_um = wasmExports.interval_um)(e);
    Module._interval_mi = (e) => (Module._interval_mi = wasmExports.interval_mi)(e);
    Module._IsValidJsonNumber = (e, t) => (Module._IsValidJsonNumber = wasmExports.IsValidJsonNumber)(e, t);
    Module._btnamecmp = (e) => (Module._btnamecmp = wasmExports.btnamecmp)(e);
    Module._strncpy = (e, t, r2) => (Module._strncpy = wasmExports.strncpy)(e, t, r2);
    Module._expand_array = (e, t, r2) => (Module._expand_array = wasmExports.expand_array)(e, t, r2);
    Module._pg_get_encoding_from_locale = (e, t) => (Module._pg_get_encoding_from_locale = wasmExports.pg_get_encoding_from_locale)(e, t);
    Module._localtime = (e) => (Module._localtime = wasmExports.localtime)(e);
    Module._strftime = (e, t, r2, a2) => (Module._strftime = wasmExports.strftime)(e, t, r2, a2);
    Module._numeric_is_nan = (e) => (Module._numeric_is_nan = wasmExports.numeric_is_nan)(e);
    Module._numeric_eq = (e) => (Module._numeric_eq = wasmExports.numeric_eq)(e);
    Module._numeric_gt = (e) => (Module._numeric_gt = wasmExports.numeric_gt)(e);
    Module._numeric_le = (e) => (Module._numeric_le = wasmExports.numeric_le)(e);
    Module._numeric_div = (e) => (Module._numeric_div = wasmExports.numeric_div)(e);
    Module._numeric_float8_no_overflow = (e) => (Module._numeric_float8_no_overflow = wasmExports.numeric_float8_no_overflow)(e);
    Module._numeric_float4 = (e) => (Module._numeric_float4 = wasmExports.numeric_float4)(e);
    Module._date_eq = (e) => (Module._date_eq = wasmExports.date_eq)(e);
    Module._date_lt = (e) => (Module._date_lt = wasmExports.date_lt)(e);
    Module._date_le = (e) => (Module._date_le = wasmExports.date_le)(e);
    Module._date_gt = (e) => (Module._date_gt = wasmExports.date_gt)(e);
    Module._date_ge = (e) => (Module._date_ge = wasmExports.date_ge)(e);
    Module._date_mi = (e) => (Module._date_mi = wasmExports.date_mi)(e);
    Module._time_eq = (e) => (Module._time_eq = wasmExports.time_eq)(e);
    Module._time_lt = (e) => (Module._time_lt = wasmExports.time_lt)(e);
    Module._time_le = (e) => (Module._time_le = wasmExports.time_le)(e);
    Module._time_gt = (e) => (Module._time_gt = wasmExports.time_gt)(e);
    Module._time_ge = (e) => (Module._time_ge = wasmExports.time_ge)(e);
    Module._time_mi_time = (e) => (Module._time_mi_time = wasmExports.time_mi_time)(e);
    Module._get_extension_oid = (e, t) => (Module._get_extension_oid = wasmExports.get_extension_oid)(e, t);
    Module._pg_ltoa = (e, t) => (Module._pg_ltoa = wasmExports.pg_ltoa)(e, t);
    Module._varbit_in = (e) => (Module._varbit_in = wasmExports.varbit_in)(e);
    Module._biteq = (e) => (Module._biteq = wasmExports.biteq)(e);
    Module._bitlt = (e) => (Module._bitlt = wasmExports.bitlt)(e);
    Module._bitle = (e) => (Module._bitle = wasmExports.bitle)(e);
    Module._bitgt = (e) => (Module._bitgt = wasmExports.bitgt)(e);
    Module._bitge = (e) => (Module._bitge = wasmExports.bitge)(e);
    Module._bitcmp = (e) => (Module._bitcmp = wasmExports.bitcmp)(e);
    Module._tidin = (e) => (Module._tidin = wasmExports.tidin)(e);
    Module._tidout = (e) => (Module._tidout = wasmExports.tidout)(e);
    Module._cash_cmp = (e) => (Module._cash_cmp = wasmExports.cash_cmp)(e);
    Module._arraycontsel = (e) => (Module._arraycontsel = wasmExports.arraycontsel)(e);
    Module._arraycontjoinsel = (e) => (Module._arraycontjoinsel = wasmExports.arraycontjoinsel)(e);
    Module._text_lt = (e) => (Module._text_lt = wasmExports.text_lt)(e);
    Module._text_le = (e) => (Module._text_le = wasmExports.text_le)(e);
    Module._text_gt = (e) => (Module._text_gt = wasmExports.text_gt)(e);
    Module._text_ge = (e) => (Module._text_ge = wasmExports.text_ge)(e);
    Module._bttextcmp = (e) => (Module._bttextcmp = wasmExports.bttextcmp)(e);
    Module._byteaeq = (e) => (Module._byteaeq = wasmExports.byteaeq)(e);
    Module._bytealt = (e) => (Module._bytealt = wasmExports.bytealt)(e);
    Module._byteale = (e) => (Module._byteale = wasmExports.byteale)(e);
    Module._byteagt = (e) => (Module._byteagt = wasmExports.byteagt)(e);
    Module._byteage = (e) => (Module._byteage = wasmExports.byteage)(e);
    Module._byteacmp = (e) => (Module._byteacmp = wasmExports.byteacmp)(e);
    Module._to_hex32 = (e) => (Module._to_hex32 = wasmExports.to_hex32)(e);
    Module._varstr_levenshtein = (e, t, r2, a2, o2, s2, l2, n2) => (Module._varstr_levenshtein = wasmExports.varstr_levenshtein)(e, t, r2, a2, o2, s2, l2, n2);
    Module._utf8_to_unicode = (e) => (Module._utf8_to_unicode = wasmExports.utf8_to_unicode)(e);
    Module._format_type_extended = (e, t, r2) => (Module._format_type_extended = wasmExports.format_type_extended)(e, t, r2);
    Module._array_create_iterator = (e, t, r2) => (Module._array_create_iterator = wasmExports.array_create_iterator)(e, t, r2);
    Module._array_iterate = (e, t, r2) => (Module._array_iterate = wasmExports.array_iterate)(e, t, r2);
    Module._make_expanded_record_from_typeid = (e, t, r2) => (Module._make_expanded_record_from_typeid = wasmExports.make_expanded_record_from_typeid)(e, t, r2);
    Module._make_expanded_record_from_tupdesc = (e, t) => (Module._make_expanded_record_from_tupdesc = wasmExports.make_expanded_record_from_tupdesc)(e, t);
    Module._make_expanded_record_from_exprecord = (e, t) => (Module._make_expanded_record_from_exprecord = wasmExports.make_expanded_record_from_exprecord)(e, t);
    Module._expanded_record_set_tuple = (e, t, r2, a2) => (Module._expanded_record_set_tuple = wasmExports.expanded_record_set_tuple)(e, t, r2, a2);
    Module._expanded_record_get_tuple = (e) => (Module._expanded_record_get_tuple = wasmExports.expanded_record_get_tuple)(e);
    Module._deconstruct_expanded_record = (e) => (Module._deconstruct_expanded_record = wasmExports.deconstruct_expanded_record)(e);
    Module._expanded_record_lookup_field = (e, t, r2) => (Module._expanded_record_lookup_field = wasmExports.expanded_record_lookup_field)(e, t, r2);
    Module._expanded_record_set_field_internal = (e, t, r2, a2, o2, s2) => (Module._expanded_record_set_field_internal = wasmExports.expanded_record_set_field_internal)(e, t, r2, a2, o2, s2);
    Module._expanded_record_set_fields = (e, t, r2, a2) => (Module._expanded_record_set_fields = wasmExports.expanded_record_set_fields)(e, t, r2, a2);
    Module._macaddr8_cmp = (e) => (Module._macaddr8_cmp = wasmExports.macaddr8_cmp)(e);
    Module._macaddr8_lt = (e) => (Module._macaddr8_lt = wasmExports.macaddr8_lt)(e);
    Module._macaddr8_le = (e) => (Module._macaddr8_le = wasmExports.macaddr8_le)(e);
    Module._macaddr8_eq = (e) => (Module._macaddr8_eq = wasmExports.macaddr8_eq)(e);
    Module._macaddr8_ge = (e) => (Module._macaddr8_ge = wasmExports.macaddr8_ge)(e);
    Module._macaddr8_gt = (e) => (Module._macaddr8_gt = wasmExports.macaddr8_gt)(e);
    Module._enum_lt = (e) => (Module._enum_lt = wasmExports.enum_lt)(e);
    Module._enum_le = (e) => (Module._enum_le = wasmExports.enum_le)(e);
    Module._enum_ge = (e) => (Module._enum_ge = wasmExports.enum_ge)(e);
    Module._enum_gt = (e) => (Module._enum_gt = wasmExports.enum_gt)(e);
    Module._enum_cmp = (e) => (Module._enum_cmp = wasmExports.enum_cmp)(e);
    Module._uuid_in = (e) => (Module._uuid_in = wasmExports.uuid_in)(e);
    Module._uuid_out = (e) => (Module._uuid_out = wasmExports.uuid_out)(e);
    Module._uuid_cmp = (e) => (Module._uuid_cmp = wasmExports.uuid_cmp)(e);
    Module._gen_random_uuid = (e) => (Module._gen_random_uuid = wasmExports.gen_random_uuid)(e);
    Module._generic_restriction_selectivity = (e, t, r2, a2, o2, s2) => (Module._generic_restriction_selectivity = wasmExports.generic_restriction_selectivity)(e, t, r2, a2, o2, s2);
    Module._genericcostestimate = (e, t, r2, a2) => (Module._genericcostestimate = wasmExports.genericcostestimate)(e, t, r2, a2);
    Module._pg_xml_init = (e) => (Module._pg_xml_init = wasmExports.pg_xml_init)(e);
    Module._xmlInitParser = () => (Module._xmlInitParser = wasmExports.xmlInitParser)();
    Module._xml_ereport = (e, t, r2, a2) => (Module._xml_ereport = wasmExports.xml_ereport)(e, t, r2, a2);
    Module._pg_xml_done = (e, t) => (Module._pg_xml_done = wasmExports.pg_xml_done)(e, t);
    Module._xmlXPathNewContext = (e) => (Module._xmlXPathNewContext = wasmExports.xmlXPathNewContext)(e);
    Module._xmlXPathFreeContext = (e) => (Module._xmlXPathFreeContext = wasmExports.xmlXPathFreeContext)(e);
    Module._xmlFreeDoc = (e) => (Module._xmlFreeDoc = wasmExports.xmlFreeDoc)(e);
    Module._xmlXPathCompile = (e) => (Module._xmlXPathCompile = wasmExports.xmlXPathCompile)(e);
    Module._xmlXPathCompiledEval = (e, t) => (Module._xmlXPathCompiledEval = wasmExports.xmlXPathCompiledEval)(e, t);
    Module._xmlXPathFreeCompExpr = (e) => (Module._xmlXPathFreeCompExpr = wasmExports.xmlXPathFreeCompExpr)(e);
    Module._xmlStrdup = (e) => (Module._xmlStrdup = wasmExports.xmlStrdup)(e);
    Module._strnlen = (e, t) => (Module._strnlen = wasmExports.strnlen)(e, t);
    Module._xmlXPathCastNodeToString = (e) => (Module._xmlXPathCastNodeToString = wasmExports.xmlXPathCastNodeToString)(e);
    Module._heap_modify_tuple_by_cols = (e, t, r2, a2, o2, s2) => (Module._heap_modify_tuple_by_cols = wasmExports.heap_modify_tuple_by_cols)(e, t, r2, a2, o2, s2);
    Module._ResourceOwnerReleaseAllPlanCacheRefs = (e) => (Module._ResourceOwnerReleaseAllPlanCacheRefs = wasmExports.ResourceOwnerReleaseAllPlanCacheRefs)(e);
    Module._RegisterResourceReleaseCallback = (e, t) => (Module._RegisterResourceReleaseCallback = wasmExports.RegisterResourceReleaseCallback)(e, t);
    Module._PinPortal = (e) => (Module._PinPortal = wasmExports.PinPortal)(e);
    Module._UnpinPortal = (e) => (Module._UnpinPortal = wasmExports.UnpinPortal)(e);
    Module._btint2cmp = (e) => (Module._btint2cmp = wasmExports.btint2cmp)(e);
    Module._btint4cmp = (e) => (Module._btint4cmp = wasmExports.btint4cmp)(e);
    Module._btoidcmp = (e) => (Module._btoidcmp = wasmExports.btoidcmp)(e);
    Module._btcharcmp = (e) => (Module._btcharcmp = wasmExports.btcharcmp)(e);
    Module._btint8cmp = (e) => (Module._btint8cmp = wasmExports.btint8cmp)(e);
    Module._btboolcmp = (e) => (Module._btboolcmp = wasmExports.btboolcmp)(e);
    Module._GetPublicationByName = (e, t) => (Module._GetPublicationByName = wasmExports.GetPublicationByName)(e, t);
    Module._GetTopMostAncestorInPublication = (e, t, r2) => (Module._GetTopMostAncestorInPublication = wasmExports.GetTopMostAncestorInPublication)(e, t, r2);
    Module._pub_collist_to_bitmapset = (e, t, r2) => (Module._pub_collist_to_bitmapset = wasmExports.pub_collist_to_bitmapset)(e, t, r2);
    Module._getExtensionOfObject = (e, t) => (Module._getExtensionOfObject = wasmExports.getExtensionOfObject)(e, t);
    Module._visibilitymap_prepare_truncate = (e, t) => (Module._visibilitymap_prepare_truncate = wasmExports.visibilitymap_prepare_truncate)(e, t);
    Module._log_newpage_range = (e, t, r2, a2, o2) => (Module._log_newpage_range = wasmExports.log_newpage_range)(e, t, r2, a2, o2);
    Module._function_parse_error_transpose = (e) => (Module._function_parse_error_transpose = wasmExports.function_parse_error_transpose)(e);
    Module._IndexGetRelation = (e, t) => (Module._IndexGetRelation = wasmExports.IndexGetRelation)(e, t);
    Module._RelnameGetRelid = (e) => (Module._RelnameGetRelid = wasmExports.RelnameGetRelid)(e);
    Module._standard_ProcessUtility = (e, t, r2, a2, o2, s2, l2, n2) => (Module._standard_ProcessUtility = wasmExports.standard_ProcessUtility)(e, t, r2, a2, o2, s2, l2, n2);
    Module._Async_Notify = (e, t) => (Module._Async_Notify = wasmExports.Async_Notify)(e, t);
    Module._sigaddset = (e, t) => (Module._sigaddset = wasmExports.sigaddset)(e, t);
    Module._fsync_pgdata = (e, t) => (Module._fsync_pgdata = wasmExports.fsync_pgdata)(e, t);
    Module._get_restricted_token = () => (Module._get_restricted_token = wasmExports.get_restricted_token)();
    Module._pg_malloc = (e) => (Module._pg_malloc = wasmExports.pg_malloc)(e);
    Module._pg_realloc = (e, t) => (Module._pg_realloc = wasmExports.pg_realloc)(e, t);
    Module._pg_strdup = (e) => (Module._pg_strdup = wasmExports.pg_strdup)(e);
    Module._simple_prompt = (e, t) => (Module._simple_prompt = wasmExports.simple_prompt)(e, t);
    Module._interactive_file = () => (Module._interactive_file = wasmExports.interactive_file)();
    Module._interactive_one = () => (Module._interactive_one = wasmExports.interactive_one)();
    Module._pg_shutdown = () => (Module._pg_shutdown = wasmExports.pg_shutdown)();
    Module._interactive_write = (e) => (Module._interactive_write = wasmExports.interactive_write)(e);
    Module._interactive_read = () => (Module._interactive_read = wasmExports.interactive_read)();
    Module._visibilitymap_pin = (e, t, r2) => (Module._visibilitymap_pin = wasmExports.visibilitymap_pin)(e, t, r2);
    Module._HeapTupleSatisfiesVacuum = (e, t, r2) => (Module._HeapTupleSatisfiesVacuum = wasmExports.HeapTupleSatisfiesVacuum)(e, t, r2);
    Module._visibilitymap_clear = (e, t, r2, a2) => (Module._visibilitymap_clear = wasmExports.visibilitymap_clear)(e, t, r2, a2);
    Module._vac_estimate_reltuples = (e, t, r2, a2) => (Module._vac_estimate_reltuples = wasmExports.vac_estimate_reltuples)(e, t, r2, a2);
    Module._heap_tuple_needs_eventual_freeze = (e) => (Module._heap_tuple_needs_eventual_freeze = wasmExports.heap_tuple_needs_eventual_freeze)(e);
    Module._HeapTupleSatisfiesUpdate = (e, t, r2) => (Module._HeapTupleSatisfiesUpdate = wasmExports.HeapTupleSatisfiesUpdate)(e, t, r2);
    Module._HeapTupleGetUpdateXid = (e) => (Module._HeapTupleGetUpdateXid = wasmExports.HeapTupleGetUpdateXid)(e);
    Module._HeapTupleSatisfiesVisibility = (e, t, r2) => (Module._HeapTupleSatisfiesVisibility = wasmExports.HeapTupleSatisfiesVisibility)(e, t, r2);
    Module._GetMultiXactIdMembers = (e, t, r2, a2) => (Module._GetMultiXactIdMembers = wasmExports.GetMultiXactIdMembers)(e, t, r2, a2);
    Module._XLogRecGetBlockTagExtended = (e, t, r2, a2, o2, s2) => (Module._XLogRecGetBlockTagExtended = wasmExports.XLogRecGetBlockTagExtended)(e, t, r2, a2, o2, s2);
    Module._toast_open_indexes = (e, t, r2, a2) => (Module._toast_open_indexes = wasmExports.toast_open_indexes)(e, t, r2, a2);
    Module._init_toast_snapshot = (e) => (Module._init_toast_snapshot = wasmExports.init_toast_snapshot)(e);
    Module._toast_close_indexes = (e, t, r2) => (Module._toast_close_indexes = wasmExports.toast_close_indexes)(e, t, r2);
    Module._index_getprocinfo = (e, t, r2) => (Module._index_getprocinfo = wasmExports.index_getprocinfo)(e, t, r2);
    Module._identify_opfamily_groups = (e, t) => (Module._identify_opfamily_groups = wasmExports.identify_opfamily_groups)(e, t);
    Module._check_amproc_signature = (e, t, r2, a2, o2, s2) => (Module._check_amproc_signature = wasmExports.check_amproc_signature)(e, t, r2, a2, o2, s2);
    Module._check_amoptsproc_signature = (e) => (Module._check_amoptsproc_signature = wasmExports.check_amoptsproc_signature)(e);
    Module._check_amop_signature = (e, t, r2, a2) => (Module._check_amop_signature = wasmExports.check_amop_signature)(e, t, r2, a2);
    Module._RelationGetIndexScan = (e, t, r2) => (Module._RelationGetIndexScan = wasmExports.RelationGetIndexScan)(e, t, r2);
    Module.__hash_get_indextuple_hashkey = (e) => (Module.__hash_get_indextuple_hashkey = wasmExports._hash_get_indextuple_hashkey)(e);
    Module.__hash_getbuf = (e, t, r2, a2) => (Module.__hash_getbuf = wasmExports._hash_getbuf)(e, t, r2, a2);
    Module.__hash_relbuf = (e, t) => (Module.__hash_relbuf = wasmExports._hash_relbuf)(e, t);
    Module.__hash_getbuf_with_strategy = (e, t, r2, a2, o2) => (Module.__hash_getbuf_with_strategy = wasmExports._hash_getbuf_with_strategy)(e, t, r2, a2, o2);
    Module._build_reloptions = (e, t, r2, a2, o2, s2) => (Module._build_reloptions = wasmExports.build_reloptions)(e, t, r2, a2, o2, s2);
    Module._index_form_tuple = (e, t, r2) => (Module._index_form_tuple = wasmExports.index_form_tuple)(e, t, r2);
    Module.__hash_ovflblkno_to_bitno = (e, t) => (Module.__hash_ovflblkno_to_bitno = wasmExports._hash_ovflblkno_to_bitno)(e, t);
    Module._brin_build_desc = (e) => (Module._brin_build_desc = wasmExports.brin_build_desc)(e);
    Module._brin_deform_tuple = (e, t, r2) => (Module._brin_deform_tuple = wasmExports.brin_deform_tuple)(e, t, r2);
    Module._brin_free_desc = (e) => (Module._brin_free_desc = wasmExports.brin_free_desc)(e);
    Module._XLogRecGetBlockRefInfo = (e, t, r2, a2, o2) => (Module._XLogRecGetBlockRefInfo = wasmExports.XLogRecGetBlockRefInfo)(e, t, r2, a2, o2);
    Module._ginPostingListDecode = (e, t) => (Module._ginPostingListDecode = wasmExports.ginPostingListDecode)(e, t);
    Module._add_reloption_kind = () => (Module._add_reloption_kind = wasmExports.add_reloption_kind)();
    Module._register_reloptions_validator = (e, t) => (Module._register_reloptions_validator = wasmExports.register_reloptions_validator)(e, t);
    Module._add_int_reloption = (e, t, r2, a2, o2, s2, l2) => (Module._add_int_reloption = wasmExports.add_int_reloption)(e, t, r2, a2, o2, s2, l2);
    Module._XLogFindNextRecord = (e, t) => (Module._XLogFindNextRecord = wasmExports.XLogFindNextRecord)(e, t);
    Module._RestoreBlockImage = (e, t, r2) => (Module._RestoreBlockImage = wasmExports.RestoreBlockImage)(e, t, r2);
    Module._GenericXLogStart = (e) => (Module._GenericXLogStart = wasmExports.GenericXLogStart)(e);
    Module._GenericXLogRegisterBuffer = (e, t, r2) => (Module._GenericXLogRegisterBuffer = wasmExports.GenericXLogRegisterBuffer)(e, t, r2);
    Module._GenericXLogFinish = (e) => (Module._GenericXLogFinish = wasmExports.GenericXLogFinish)(e);
    Module._GenericXLogAbort = (e) => (Module._GenericXLogAbort = wasmExports.GenericXLogAbort)(e);
    Module._read_local_xlog_page_no_wait = (e, t, r2, a2, o2) => (Module._read_local_xlog_page_no_wait = wasmExports.read_local_xlog_page_no_wait)(e, t, r2, a2, o2);
    Module._XLogRecStoreStats = (e, t) => (Module._XLogRecStoreStats = wasmExports.XLogRecStoreStats)(e, t);
    Module._ReadMultiXactIdRange = (e, t) => (Module._ReadMultiXactIdRange = wasmExports.ReadMultiXactIdRange)(e, t);
    Module._MultiXactIdPrecedesOrEquals = (e, t) => (Module._MultiXactIdPrecedesOrEquals = wasmExports.MultiXactIdPrecedesOrEquals)(e, t);
    Module._RegisterXactCallback = (e, t) => (Module._RegisterXactCallback = wasmExports.RegisterXactCallback)(e, t);
    Module._RegisterSubXactCallback = (e, t) => (Module._RegisterSubXactCallback = wasmExports.RegisterSubXactCallback)(e, t);
    Module._ReleaseCurrentSubTransaction = () => (Module._ReleaseCurrentSubTransaction = wasmExports.ReleaseCurrentSubTransaction)();
    Module._WaitForParallelWorkersToAttach = (e) => (Module._WaitForParallelWorkersToAttach = wasmExports.WaitForParallelWorkersToAttach)(e);
    Module.__bt_allequalimage = (e, t) => (Module.__bt_allequalimage = wasmExports._bt_allequalimage)(e, t);
    Module.__bt_checkpage = (e, t) => (Module.__bt_checkpage = wasmExports._bt_checkpage)(e, t);
    Module.__bt_relbuf = (e, t) => (Module.__bt_relbuf = wasmExports._bt_relbuf)(e, t);
    Module.__bt_metaversion = (e, t, r2) => (Module.__bt_metaversion = wasmExports._bt_metaversion)(e, t, r2);
    Module.__bt_search = (e, t, r2, a2, o2, s2) => (Module.__bt_search = wasmExports._bt_search)(e, t, r2, a2, o2, s2);
    Module.__bt_compare = (e, t, r2, a2) => (Module.__bt_compare = wasmExports._bt_compare)(e, t, r2, a2);
    Module.__bt_binsrch_insert = (e, t) => (Module.__bt_binsrch_insert = wasmExports._bt_binsrch_insert)(e, t);
    Module.__bt_freestack = (e) => (Module.__bt_freestack = wasmExports._bt_freestack)(e);
    Module.__bt_form_posting = (e, t, r2) => (Module.__bt_form_posting = wasmExports._bt_form_posting)(e, t, r2);
    Module.__bt_check_natts = (e, t, r2, a2) => (Module.__bt_check_natts = wasmExports._bt_check_natts)(e, t, r2, a2);
    Module._gistcheckpage = (e, t) => (Module._gistcheckpage = wasmExports.gistcheckpage)(e, t);
    Module._EndCopyFrom = (e) => (Module._EndCopyFrom = wasmExports.EndCopyFrom)(e);
    Module._ProcessCopyOptions = (e, t, r2, a2) => (Module._ProcessCopyOptions = wasmExports.ProcessCopyOptions)(e, t, r2, a2);
    Module._CopyFromErrorCallback = (e) => (Module._CopyFromErrorCallback = wasmExports.CopyFromErrorCallback)(e);
    Module._NextCopyFrom = (e, t, r2, a2) => (Module._NextCopyFrom = wasmExports.NextCopyFrom)(e, t, r2, a2);
    Module._nextval = (e) => (Module._nextval = wasmExports.nextval)(e);
    Module._defGetStreamingMode = (e) => (Module._defGetStreamingMode = wasmExports.defGetStreamingMode)(e);
    Module._ExplainBeginOutput = (e) => (Module._ExplainBeginOutput = wasmExports.ExplainBeginOutput)(e);
    Module._NewExplainState = () => (Module._NewExplainState = wasmExports.NewExplainState)();
    Module._ExplainEndOutput = (e) => (Module._ExplainEndOutput = wasmExports.ExplainEndOutput)(e);
    Module._ExplainPrintPlan = (e, t) => (Module._ExplainPrintPlan = wasmExports.ExplainPrintPlan)(e, t);
    Module._ExplainPrintTriggers = (e, t) => (Module._ExplainPrintTriggers = wasmExports.ExplainPrintTriggers)(e, t);
    Module._ExplainPrintJITSummary = (e, t) => (Module._ExplainPrintJITSummary = wasmExports.ExplainPrintJITSummary)(e, t);
    Module._ExplainPropertyInteger = (e, t, r2, a2) => (Module._ExplainPropertyInteger = wasmExports.ExplainPropertyInteger)(e, t, r2, a2);
    Module._ExplainQueryText = (e, t) => (Module._ExplainQueryText = wasmExports.ExplainQueryText)(e, t);
    Module._ExplainPropertyText = (e, t, r2) => (Module._ExplainPropertyText = wasmExports.ExplainPropertyText)(e, t, r2);
    Module._ExplainQueryParameters = (e, t, r2) => (Module._ExplainQueryParameters = wasmExports.ExplainQueryParameters)(e, t, r2);
    Module._pg_is_ascii = (e) => (Module._pg_is_ascii = wasmExports.pg_is_ascii)(e);
    Module._fputs = (e, t) => (Module._fputs = wasmExports.fputs)(e, t);
    Module._popen = (e, t) => (Module._popen = wasmExports.popen)(e, t);
    Module._float_to_shortest_decimal_bufn = (e, t) => (Module._float_to_shortest_decimal_bufn = wasmExports.float_to_shortest_decimal_bufn)(e, t);
    Module._pg_prng_uint64 = (e) => (Module._pg_prng_uint64 = wasmExports.pg_prng_uint64)(e);
    Module._scram_ClientKey = (e, t, r2, a2, o2) => (Module._scram_ClientKey = wasmExports.scram_ClientKey)(e, t, r2, a2, o2);
    Module._pg_encoding_dsplen = (e, t) => (Module._pg_encoding_dsplen = wasmExports.pg_encoding_dsplen)(e, t);
    Module._getcwd = (e, t) => (Module._getcwd = wasmExports.getcwd)(e, t);
    Module._pg_get_user_home_dir = (e, t, r2) => (Module._pg_get_user_home_dir = wasmExports.pg_get_user_home_dir)(e, t, r2);
    Module._nanosleep = (e, t) => (Module._nanosleep = wasmExports.nanosleep)(e, t);
    Module._snprintf = (e, t, r2, a2) => (Module._snprintf = wasmExports.snprintf)(e, t, r2, a2);
    Module._pg_strerror_r = (e, t, r2) => (Module._pg_strerror_r = wasmExports.pg_strerror_r)(e, t, r2);
    Module._pthread_mutex_lock = (e) => (Module._pthread_mutex_lock = wasmExports.pthread_mutex_lock)(e);
    Module._pthread_mutex_unlock = (e) => (Module._pthread_mutex_unlock = wasmExports.pthread_mutex_unlock)(e);
    Module._strncat = (e, t, r2) => (Module._strncat = wasmExports.strncat)(e, t, r2);
    Module._PQexec = (e, t) => (Module._PQexec = wasmExports.PQexec)(e, t);
    Module._PQsetSingleRowMode = (e) => (Module._PQsetSingleRowMode = wasmExports.PQsetSingleRowMode)(e);
    Module._PQcmdStatus = (e) => (Module._PQcmdStatus = wasmExports.PQcmdStatus)(e);
    Module._pthread_sigmask = (e, t, r2) => (Module._pthread_sigmask = wasmExports.pthread_sigmask)(e, t, r2);
    Module._sigismember = (e, t) => (Module._sigismember = wasmExports.sigismember)(e, t);
    Module._sigpending = (e) => (Module._sigpending = wasmExports.sigpending)(e);
    Module._sigwait = (e, t) => (Module._sigwait = wasmExports.sigwait)(e, t);
    Module._isolat1ToUTF8 = (e, t, r2, a2) => (Module._isolat1ToUTF8 = wasmExports.isolat1ToUTF8)(e, t, r2, a2);
    Module._UTF8Toisolat1 = (e, t, r2, a2) => (Module._UTF8Toisolat1 = wasmExports.UTF8Toisolat1)(e, t, r2, a2);
    Module._vfprintf = (e, t, r2) => (Module._vfprintf = wasmExports.vfprintf)(e, t, r2);
    Module._vsnprintf = (e, t, r2, a2) => (Module._vsnprintf = wasmExports.vsnprintf)(e, t, r2, a2);
    Module._xmlParserValidityWarning = (e, t, r2) => (Module._xmlParserValidityWarning = wasmExports.xmlParserValidityWarning)(e, t, r2);
    Module._xmlParserValidityError = (e, t, r2) => (Module._xmlParserValidityError = wasmExports.xmlParserValidityError)(e, t, r2);
    Module._xmlParserError = (e, t, r2) => (Module._xmlParserError = wasmExports.xmlParserError)(e, t, r2);
    Module._xmlParserWarning = (e, t, r2) => (Module._xmlParserWarning = wasmExports.xmlParserWarning)(e, t, r2);
    Module._fprintf = (e, t, r2) => (Module._fprintf = wasmExports.fprintf)(e, t, r2);
    Module.___xmlParserInputBufferCreateFilename = (e, t) => (Module.___xmlParserInputBufferCreateFilename = wasmExports.__xmlParserInputBufferCreateFilename)(e, t);
    Module.___xmlOutputBufferCreateFilename = (e, t, r2) => (Module.___xmlOutputBufferCreateFilename = wasmExports.__xmlOutputBufferCreateFilename)(e, t, r2);
    Module._xmlSAX2InternalSubset = (e, t, r2, a2) => (Module._xmlSAX2InternalSubset = wasmExports.xmlSAX2InternalSubset)(e, t, r2, a2);
    Module._xmlSAX2IsStandalone = (e) => (Module._xmlSAX2IsStandalone = wasmExports.xmlSAX2IsStandalone)(e);
    Module._xmlSAX2HasInternalSubset = (e) => (Module._xmlSAX2HasInternalSubset = wasmExports.xmlSAX2HasInternalSubset)(e);
    Module._xmlSAX2HasExternalSubset = (e) => (Module._xmlSAX2HasExternalSubset = wasmExports.xmlSAX2HasExternalSubset)(e);
    Module._xmlSAX2ResolveEntity = (e, t, r2) => (Module._xmlSAX2ResolveEntity = wasmExports.xmlSAX2ResolveEntity)(e, t, r2);
    Module._xmlSAX2GetEntity = (e, t) => (Module._xmlSAX2GetEntity = wasmExports.xmlSAX2GetEntity)(e, t);
    Module._xmlSAX2EntityDecl = (e, t, r2, a2, o2, s2) => (Module._xmlSAX2EntityDecl = wasmExports.xmlSAX2EntityDecl)(e, t, r2, a2, o2, s2);
    Module._xmlSAX2NotationDecl = (e, t, r2, a2) => (Module._xmlSAX2NotationDecl = wasmExports.xmlSAX2NotationDecl)(e, t, r2, a2);
    Module._xmlSAX2AttributeDecl = (e, t, r2, a2, o2, s2, l2) => (Module._xmlSAX2AttributeDecl = wasmExports.xmlSAX2AttributeDecl)(e, t, r2, a2, o2, s2, l2);
    Module._xmlSAX2ElementDecl = (e, t, r2, a2) => (Module._xmlSAX2ElementDecl = wasmExports.xmlSAX2ElementDecl)(e, t, r2, a2);
    Module._xmlSAX2UnparsedEntityDecl = (e, t, r2, a2, o2) => (Module._xmlSAX2UnparsedEntityDecl = wasmExports.xmlSAX2UnparsedEntityDecl)(e, t, r2, a2, o2);
    Module._xmlSAX2SetDocumentLocator = (e, t) => (Module._xmlSAX2SetDocumentLocator = wasmExports.xmlSAX2SetDocumentLocator)(e, t);
    Module._xmlSAX2StartDocument = (e) => (Module._xmlSAX2StartDocument = wasmExports.xmlSAX2StartDocument)(e);
    Module._xmlSAX2EndDocument = (e) => (Module._xmlSAX2EndDocument = wasmExports.xmlSAX2EndDocument)(e);
    Module._xmlSAX2StartElement = (e, t, r2) => (Module._xmlSAX2StartElement = wasmExports.xmlSAX2StartElement)(e, t, r2);
    Module._xmlSAX2EndElement = (e, t) => (Module._xmlSAX2EndElement = wasmExports.xmlSAX2EndElement)(e, t);
    Module._xmlSAX2Reference = (e, t) => (Module._xmlSAX2Reference = wasmExports.xmlSAX2Reference)(e, t);
    Module._xmlSAX2Characters = (e, t, r2) => (Module._xmlSAX2Characters = wasmExports.xmlSAX2Characters)(e, t, r2);
    Module._xmlSAX2ProcessingInstruction = (e, t, r2) => (Module._xmlSAX2ProcessingInstruction = wasmExports.xmlSAX2ProcessingInstruction)(e, t, r2);
    Module._xmlSAX2Comment = (e, t) => (Module._xmlSAX2Comment = wasmExports.xmlSAX2Comment)(e, t);
    Module._xmlSAX2GetParameterEntity = (e, t) => (Module._xmlSAX2GetParameterEntity = wasmExports.xmlSAX2GetParameterEntity)(e, t);
    Module._xmlSAX2CDataBlock = (e, t, r2) => (Module._xmlSAX2CDataBlock = wasmExports.xmlSAX2CDataBlock)(e, t, r2);
    Module._xmlSAX2ExternalSubset = (e, t, r2, a2) => (Module._xmlSAX2ExternalSubset = wasmExports.xmlSAX2ExternalSubset)(e, t, r2, a2);
    Module._xmlSAX2GetPublicId = (e) => (Module._xmlSAX2GetPublicId = wasmExports.xmlSAX2GetPublicId)(e);
    Module._xmlSAX2GetSystemId = (e) => (Module._xmlSAX2GetSystemId = wasmExports.xmlSAX2GetSystemId)(e);
    Module._xmlSAX2GetLineNumber = (e) => (Module._xmlSAX2GetLineNumber = wasmExports.xmlSAX2GetLineNumber)(e);
    Module._xmlSAX2GetColumnNumber = (e) => (Module._xmlSAX2GetColumnNumber = wasmExports.xmlSAX2GetColumnNumber)(e);
    Module._xmlSAX2IgnorableWhitespace = (e, t, r2) => (Module._xmlSAX2IgnorableWhitespace = wasmExports.xmlSAX2IgnorableWhitespace)(e, t, r2);
    Module._xmlHashDefaultDeallocator = (e, t) => (Module._xmlHashDefaultDeallocator = wasmExports.xmlHashDefaultDeallocator)(e, t);
    Module._iconv_open = (e, t) => (Module._iconv_open = wasmExports.iconv_open)(e, t);
    Module._iconv_close = (e) => (Module._iconv_close = wasmExports.iconv_close)(e);
    Module._iconv = (e, t, r2, a2, o2) => (Module._iconv = wasmExports.iconv)(e, t, r2, a2, o2);
    Module._UTF8ToHtml = (e, t, r2, a2) => (Module._UTF8ToHtml = wasmExports.UTF8ToHtml)(e, t, r2, a2);
    Module._xmlReadMemory = (e, t, r2, a2, o2) => (Module._xmlReadMemory = wasmExports.xmlReadMemory)(e, t, r2, a2, o2);
    Module._xmlSAX2StartElementNs = (e, t, r2, a2, o2, s2, l2, n2, _2) => (Module._xmlSAX2StartElementNs = wasmExports.xmlSAX2StartElementNs)(e, t, r2, a2, o2, s2, l2, n2, _2);
    Module._xmlSAX2EndElementNs = (e, t, r2, a2) => (Module._xmlSAX2EndElementNs = wasmExports.xmlSAX2EndElementNs)(e, t, r2, a2);
    Module.___cxa_atexit = (e, t, r2) => (Module.___cxa_atexit = wasmExports.__cxa_atexit)(e, t, r2);
    Module._xmlDocGetRootElement = (e) => (Module._xmlDocGetRootElement = wasmExports.xmlDocGetRootElement)(e);
    Module._xmlFileMatch = (e) => (Module._xmlFileMatch = wasmExports.xmlFileMatch)(e);
    Module._xmlFileOpen = (e) => (Module._xmlFileOpen = wasmExports.xmlFileOpen)(e);
    Module._xmlFileRead = (e, t, r2) => (Module._xmlFileRead = wasmExports.xmlFileRead)(e, t, r2);
    Module._xmlFileClose = (e) => (Module._xmlFileClose = wasmExports.xmlFileClose)(e);
    Module._gzread = (e, t, r2) => (Module._gzread = wasmExports.gzread)(e, t, r2);
    Module._gzclose = (e) => (Module._gzclose = wasmExports.gzclose)(e);
    Module._gzdirect = (e) => (Module._gzdirect = wasmExports.gzdirect)(e);
    Module._gzdopen = (e, t) => (Module._gzdopen = wasmExports.gzdopen)(e, t);
    Module._gzopen = (e, t) => (Module._gzopen = wasmExports.gzopen)(e, t);
    Module._gzwrite = (e, t, r2) => (Module._gzwrite = wasmExports.gzwrite)(e, t, r2);
    Module._xmlUCSIsCatNd = (e) => (Module._xmlUCSIsCatNd = wasmExports.xmlUCSIsCatNd)(e);
    Module._xmlUCSIsCatP = (e) => (Module._xmlUCSIsCatP = wasmExports.xmlUCSIsCatP)(e);
    Module._xmlUCSIsCatZ = (e) => (Module._xmlUCSIsCatZ = wasmExports.xmlUCSIsCatZ)(e);
    Module._xmlUCSIsCatC = (e) => (Module._xmlUCSIsCatC = wasmExports.xmlUCSIsCatC)(e);
    Module._xmlUCSIsCatL = (e) => (Module._xmlUCSIsCatL = wasmExports.xmlUCSIsCatL)(e);
    Module._xmlUCSIsCatLu = (e) => (Module._xmlUCSIsCatLu = wasmExports.xmlUCSIsCatLu)(e);
    Module._xmlUCSIsCatLl = (e) => (Module._xmlUCSIsCatLl = wasmExports.xmlUCSIsCatLl)(e);
    Module._xmlUCSIsCatLt = (e) => (Module._xmlUCSIsCatLt = wasmExports.xmlUCSIsCatLt)(e);
    Module._xmlUCSIsCatLm = (e) => (Module._xmlUCSIsCatLm = wasmExports.xmlUCSIsCatLm)(e);
    Module._xmlUCSIsCatLo = (e) => (Module._xmlUCSIsCatLo = wasmExports.xmlUCSIsCatLo)(e);
    Module._xmlUCSIsCatM = (e) => (Module._xmlUCSIsCatM = wasmExports.xmlUCSIsCatM)(e);
    Module._xmlUCSIsCatMn = (e) => (Module._xmlUCSIsCatMn = wasmExports.xmlUCSIsCatMn)(e);
    Module._xmlUCSIsCatMc = (e) => (Module._xmlUCSIsCatMc = wasmExports.xmlUCSIsCatMc)(e);
    Module._xmlUCSIsCatMe = (e) => (Module._xmlUCSIsCatMe = wasmExports.xmlUCSIsCatMe)(e);
    Module._xmlUCSIsCatN = (e) => (Module._xmlUCSIsCatN = wasmExports.xmlUCSIsCatN)(e);
    Module._xmlUCSIsCatNl = (e) => (Module._xmlUCSIsCatNl = wasmExports.xmlUCSIsCatNl)(e);
    Module._xmlUCSIsCatNo = (e) => (Module._xmlUCSIsCatNo = wasmExports.xmlUCSIsCatNo)(e);
    Module._xmlUCSIsCatPc = (e) => (Module._xmlUCSIsCatPc = wasmExports.xmlUCSIsCatPc)(e);
    Module._xmlUCSIsCatPd = (e) => (Module._xmlUCSIsCatPd = wasmExports.xmlUCSIsCatPd)(e);
    Module._xmlUCSIsCatPs = (e) => (Module._xmlUCSIsCatPs = wasmExports.xmlUCSIsCatPs)(e);
    Module._xmlUCSIsCatPe = (e) => (Module._xmlUCSIsCatPe = wasmExports.xmlUCSIsCatPe)(e);
    Module._xmlUCSIsCatPi = (e) => (Module._xmlUCSIsCatPi = wasmExports.xmlUCSIsCatPi)(e);
    Module._xmlUCSIsCatPf = (e) => (Module._xmlUCSIsCatPf = wasmExports.xmlUCSIsCatPf)(e);
    Module._xmlUCSIsCatPo = (e) => (Module._xmlUCSIsCatPo = wasmExports.xmlUCSIsCatPo)(e);
    Module._xmlUCSIsCatZs = (e) => (Module._xmlUCSIsCatZs = wasmExports.xmlUCSIsCatZs)(e);
    Module._xmlUCSIsCatZl = (e) => (Module._xmlUCSIsCatZl = wasmExports.xmlUCSIsCatZl)(e);
    Module._xmlUCSIsCatZp = (e) => (Module._xmlUCSIsCatZp = wasmExports.xmlUCSIsCatZp)(e);
    Module._xmlUCSIsCatS = (e) => (Module._xmlUCSIsCatS = wasmExports.xmlUCSIsCatS)(e);
    Module._xmlUCSIsCatSm = (e) => (Module._xmlUCSIsCatSm = wasmExports.xmlUCSIsCatSm)(e);
    Module._xmlUCSIsCatSc = (e) => (Module._xmlUCSIsCatSc = wasmExports.xmlUCSIsCatSc)(e);
    Module._xmlUCSIsCatSk = (e) => (Module._xmlUCSIsCatSk = wasmExports.xmlUCSIsCatSk)(e);
    Module._xmlUCSIsCatSo = (e) => (Module._xmlUCSIsCatSo = wasmExports.xmlUCSIsCatSo)(e);
    Module._xmlUCSIsCatCc = (e) => (Module._xmlUCSIsCatCc = wasmExports.xmlUCSIsCatCc)(e);
    Module._xmlUCSIsCatCf = (e) => (Module._xmlUCSIsCatCf = wasmExports.xmlUCSIsCatCf)(e);
    Module._xmlUCSIsCatCo = (e) => (Module._xmlUCSIsCatCo = wasmExports.xmlUCSIsCatCo)(e);
    Module._xmlUCSIsAegeanNumbers = (e) => (Module._xmlUCSIsAegeanNumbers = wasmExports.xmlUCSIsAegeanNumbers)(e);
    Module._xmlUCSIsAlphabeticPresentationForms = (e) => (Module._xmlUCSIsAlphabeticPresentationForms = wasmExports.xmlUCSIsAlphabeticPresentationForms)(e);
    Module._xmlUCSIsArabic = (e) => (Module._xmlUCSIsArabic = wasmExports.xmlUCSIsArabic)(e);
    Module._xmlUCSIsArabicPresentationFormsA = (e) => (Module._xmlUCSIsArabicPresentationFormsA = wasmExports.xmlUCSIsArabicPresentationFormsA)(e);
    Module._xmlUCSIsArabicPresentationFormsB = (e) => (Module._xmlUCSIsArabicPresentationFormsB = wasmExports.xmlUCSIsArabicPresentationFormsB)(e);
    Module._xmlUCSIsArmenian = (e) => (Module._xmlUCSIsArmenian = wasmExports.xmlUCSIsArmenian)(e);
    Module._xmlUCSIsArrows = (e) => (Module._xmlUCSIsArrows = wasmExports.xmlUCSIsArrows)(e);
    Module._xmlUCSIsBasicLatin = (e) => (Module._xmlUCSIsBasicLatin = wasmExports.xmlUCSIsBasicLatin)(e);
    Module._xmlUCSIsBengali = (e) => (Module._xmlUCSIsBengali = wasmExports.xmlUCSIsBengali)(e);
    Module._xmlUCSIsBlockElements = (e) => (Module._xmlUCSIsBlockElements = wasmExports.xmlUCSIsBlockElements)(e);
    Module._xmlUCSIsBopomofo = (e) => (Module._xmlUCSIsBopomofo = wasmExports.xmlUCSIsBopomofo)(e);
    Module._xmlUCSIsBopomofoExtended = (e) => (Module._xmlUCSIsBopomofoExtended = wasmExports.xmlUCSIsBopomofoExtended)(e);
    Module._xmlUCSIsBoxDrawing = (e) => (Module._xmlUCSIsBoxDrawing = wasmExports.xmlUCSIsBoxDrawing)(e);
    Module._xmlUCSIsBraillePatterns = (e) => (Module._xmlUCSIsBraillePatterns = wasmExports.xmlUCSIsBraillePatterns)(e);
    Module._xmlUCSIsBuhid = (e) => (Module._xmlUCSIsBuhid = wasmExports.xmlUCSIsBuhid)(e);
    Module._xmlUCSIsByzantineMusicalSymbols = (e) => (Module._xmlUCSIsByzantineMusicalSymbols = wasmExports.xmlUCSIsByzantineMusicalSymbols)(e);
    Module._xmlUCSIsCJKCompatibility = (e) => (Module._xmlUCSIsCJKCompatibility = wasmExports.xmlUCSIsCJKCompatibility)(e);
    Module._xmlUCSIsCJKCompatibilityForms = (e) => (Module._xmlUCSIsCJKCompatibilityForms = wasmExports.xmlUCSIsCJKCompatibilityForms)(e);
    Module._xmlUCSIsCJKCompatibilityIdeographs = (e) => (Module._xmlUCSIsCJKCompatibilityIdeographs = wasmExports.xmlUCSIsCJKCompatibilityIdeographs)(e);
    Module._xmlUCSIsCJKCompatibilityIdeographsSupplement = (e) => (Module._xmlUCSIsCJKCompatibilityIdeographsSupplement = wasmExports.xmlUCSIsCJKCompatibilityIdeographsSupplement)(e);
    Module._xmlUCSIsCJKRadicalsSupplement = (e) => (Module._xmlUCSIsCJKRadicalsSupplement = wasmExports.xmlUCSIsCJKRadicalsSupplement)(e);
    Module._xmlUCSIsCJKSymbolsandPunctuation = (e) => (Module._xmlUCSIsCJKSymbolsandPunctuation = wasmExports.xmlUCSIsCJKSymbolsandPunctuation)(e);
    Module._xmlUCSIsCJKUnifiedIdeographs = (e) => (Module._xmlUCSIsCJKUnifiedIdeographs = wasmExports.xmlUCSIsCJKUnifiedIdeographs)(e);
    Module._xmlUCSIsCJKUnifiedIdeographsExtensionA = (e) => (Module._xmlUCSIsCJKUnifiedIdeographsExtensionA = wasmExports.xmlUCSIsCJKUnifiedIdeographsExtensionA)(e);
    Module._xmlUCSIsCJKUnifiedIdeographsExtensionB = (e) => (Module._xmlUCSIsCJKUnifiedIdeographsExtensionB = wasmExports.xmlUCSIsCJKUnifiedIdeographsExtensionB)(e);
    Module._xmlUCSIsCherokee = (e) => (Module._xmlUCSIsCherokee = wasmExports.xmlUCSIsCherokee)(e);
    Module._xmlUCSIsCombiningDiacriticalMarks = (e) => (Module._xmlUCSIsCombiningDiacriticalMarks = wasmExports.xmlUCSIsCombiningDiacriticalMarks)(e);
    Module._xmlUCSIsCombiningDiacriticalMarksforSymbols = (e) => (Module._xmlUCSIsCombiningDiacriticalMarksforSymbols = wasmExports.xmlUCSIsCombiningDiacriticalMarksforSymbols)(e);
    Module._xmlUCSIsCombiningHalfMarks = (e) => (Module._xmlUCSIsCombiningHalfMarks = wasmExports.xmlUCSIsCombiningHalfMarks)(e);
    Module._xmlUCSIsCombiningMarksforSymbols = (e) => (Module._xmlUCSIsCombiningMarksforSymbols = wasmExports.xmlUCSIsCombiningMarksforSymbols)(e);
    Module._xmlUCSIsControlPictures = (e) => (Module._xmlUCSIsControlPictures = wasmExports.xmlUCSIsControlPictures)(e);
    Module._xmlUCSIsCurrencySymbols = (e) => (Module._xmlUCSIsCurrencySymbols = wasmExports.xmlUCSIsCurrencySymbols)(e);
    Module._xmlUCSIsCypriotSyllabary = (e) => (Module._xmlUCSIsCypriotSyllabary = wasmExports.xmlUCSIsCypriotSyllabary)(e);
    Module._xmlUCSIsCyrillic = (e) => (Module._xmlUCSIsCyrillic = wasmExports.xmlUCSIsCyrillic)(e);
    Module._xmlUCSIsCyrillicSupplement = (e) => (Module._xmlUCSIsCyrillicSupplement = wasmExports.xmlUCSIsCyrillicSupplement)(e);
    Module._xmlUCSIsDeseret = (e) => (Module._xmlUCSIsDeseret = wasmExports.xmlUCSIsDeseret)(e);
    Module._xmlUCSIsDevanagari = (e) => (Module._xmlUCSIsDevanagari = wasmExports.xmlUCSIsDevanagari)(e);
    Module._xmlUCSIsDingbats = (e) => (Module._xmlUCSIsDingbats = wasmExports.xmlUCSIsDingbats)(e);
    Module._xmlUCSIsEnclosedAlphanumerics = (e) => (Module._xmlUCSIsEnclosedAlphanumerics = wasmExports.xmlUCSIsEnclosedAlphanumerics)(e);
    Module._xmlUCSIsEnclosedCJKLettersandMonths = (e) => (Module._xmlUCSIsEnclosedCJKLettersandMonths = wasmExports.xmlUCSIsEnclosedCJKLettersandMonths)(e);
    Module._xmlUCSIsEthiopic = (e) => (Module._xmlUCSIsEthiopic = wasmExports.xmlUCSIsEthiopic)(e);
    Module._xmlUCSIsGeneralPunctuation = (e) => (Module._xmlUCSIsGeneralPunctuation = wasmExports.xmlUCSIsGeneralPunctuation)(e);
    Module._xmlUCSIsGeometricShapes = (e) => (Module._xmlUCSIsGeometricShapes = wasmExports.xmlUCSIsGeometricShapes)(e);
    Module._xmlUCSIsGeorgian = (e) => (Module._xmlUCSIsGeorgian = wasmExports.xmlUCSIsGeorgian)(e);
    Module._xmlUCSIsGothic = (e) => (Module._xmlUCSIsGothic = wasmExports.xmlUCSIsGothic)(e);
    Module._xmlUCSIsGreek = (e) => (Module._xmlUCSIsGreek = wasmExports.xmlUCSIsGreek)(e);
    Module._xmlUCSIsGreekExtended = (e) => (Module._xmlUCSIsGreekExtended = wasmExports.xmlUCSIsGreekExtended)(e);
    Module._xmlUCSIsGreekandCoptic = (e) => (Module._xmlUCSIsGreekandCoptic = wasmExports.xmlUCSIsGreekandCoptic)(e);
    Module._xmlUCSIsGujarati = (e) => (Module._xmlUCSIsGujarati = wasmExports.xmlUCSIsGujarati)(e);
    Module._xmlUCSIsGurmukhi = (e) => (Module._xmlUCSIsGurmukhi = wasmExports.xmlUCSIsGurmukhi)(e);
    Module._xmlUCSIsHalfwidthandFullwidthForms = (e) => (Module._xmlUCSIsHalfwidthandFullwidthForms = wasmExports.xmlUCSIsHalfwidthandFullwidthForms)(e);
    Module._xmlUCSIsHangulCompatibilityJamo = (e) => (Module._xmlUCSIsHangulCompatibilityJamo = wasmExports.xmlUCSIsHangulCompatibilityJamo)(e);
    Module._xmlUCSIsHangulJamo = (e) => (Module._xmlUCSIsHangulJamo = wasmExports.xmlUCSIsHangulJamo)(e);
    Module._xmlUCSIsHangulSyllables = (e) => (Module._xmlUCSIsHangulSyllables = wasmExports.xmlUCSIsHangulSyllables)(e);
    Module._xmlUCSIsHanunoo = (e) => (Module._xmlUCSIsHanunoo = wasmExports.xmlUCSIsHanunoo)(e);
    Module._xmlUCSIsHebrew = (e) => (Module._xmlUCSIsHebrew = wasmExports.xmlUCSIsHebrew)(e);
    Module._xmlUCSIsHighPrivateUseSurrogates = (e) => (Module._xmlUCSIsHighPrivateUseSurrogates = wasmExports.xmlUCSIsHighPrivateUseSurrogates)(e);
    Module._xmlUCSIsHighSurrogates = (e) => (Module._xmlUCSIsHighSurrogates = wasmExports.xmlUCSIsHighSurrogates)(e);
    Module._xmlUCSIsHiragana = (e) => (Module._xmlUCSIsHiragana = wasmExports.xmlUCSIsHiragana)(e);
    Module._xmlUCSIsIPAExtensions = (e) => (Module._xmlUCSIsIPAExtensions = wasmExports.xmlUCSIsIPAExtensions)(e);
    Module._xmlUCSIsIdeographicDescriptionCharacters = (e) => (Module._xmlUCSIsIdeographicDescriptionCharacters = wasmExports.xmlUCSIsIdeographicDescriptionCharacters)(e);
    Module._xmlUCSIsKanbun = (e) => (Module._xmlUCSIsKanbun = wasmExports.xmlUCSIsKanbun)(e);
    Module._xmlUCSIsKangxiRadicals = (e) => (Module._xmlUCSIsKangxiRadicals = wasmExports.xmlUCSIsKangxiRadicals)(e);
    Module._xmlUCSIsKannada = (e) => (Module._xmlUCSIsKannada = wasmExports.xmlUCSIsKannada)(e);
    Module._xmlUCSIsKatakana = (e) => (Module._xmlUCSIsKatakana = wasmExports.xmlUCSIsKatakana)(e);
    Module._xmlUCSIsKatakanaPhoneticExtensions = (e) => (Module._xmlUCSIsKatakanaPhoneticExtensions = wasmExports.xmlUCSIsKatakanaPhoneticExtensions)(e);
    Module._xmlUCSIsKhmer = (e) => (Module._xmlUCSIsKhmer = wasmExports.xmlUCSIsKhmer)(e);
    Module._xmlUCSIsKhmerSymbols = (e) => (Module._xmlUCSIsKhmerSymbols = wasmExports.xmlUCSIsKhmerSymbols)(e);
    Module._xmlUCSIsLao = (e) => (Module._xmlUCSIsLao = wasmExports.xmlUCSIsLao)(e);
    Module._xmlUCSIsLatin1Supplement = (e) => (Module._xmlUCSIsLatin1Supplement = wasmExports.xmlUCSIsLatin1Supplement)(e);
    Module._xmlUCSIsLatinExtendedA = (e) => (Module._xmlUCSIsLatinExtendedA = wasmExports.xmlUCSIsLatinExtendedA)(e);
    Module._xmlUCSIsLatinExtendedB = (e) => (Module._xmlUCSIsLatinExtendedB = wasmExports.xmlUCSIsLatinExtendedB)(e);
    Module._xmlUCSIsLatinExtendedAdditional = (e) => (Module._xmlUCSIsLatinExtendedAdditional = wasmExports.xmlUCSIsLatinExtendedAdditional)(e);
    Module._xmlUCSIsLetterlikeSymbols = (e) => (Module._xmlUCSIsLetterlikeSymbols = wasmExports.xmlUCSIsLetterlikeSymbols)(e);
    Module._xmlUCSIsLimbu = (e) => (Module._xmlUCSIsLimbu = wasmExports.xmlUCSIsLimbu)(e);
    Module._xmlUCSIsLinearBIdeograms = (e) => (Module._xmlUCSIsLinearBIdeograms = wasmExports.xmlUCSIsLinearBIdeograms)(e);
    Module._xmlUCSIsLinearBSyllabary = (e) => (Module._xmlUCSIsLinearBSyllabary = wasmExports.xmlUCSIsLinearBSyllabary)(e);
    Module._xmlUCSIsLowSurrogates = (e) => (Module._xmlUCSIsLowSurrogates = wasmExports.xmlUCSIsLowSurrogates)(e);
    Module._xmlUCSIsMalayalam = (e) => (Module._xmlUCSIsMalayalam = wasmExports.xmlUCSIsMalayalam)(e);
    Module._xmlUCSIsMathematicalAlphanumericSymbols = (e) => (Module._xmlUCSIsMathematicalAlphanumericSymbols = wasmExports.xmlUCSIsMathematicalAlphanumericSymbols)(e);
    Module._xmlUCSIsMathematicalOperators = (e) => (Module._xmlUCSIsMathematicalOperators = wasmExports.xmlUCSIsMathematicalOperators)(e);
    Module._xmlUCSIsMiscellaneousMathematicalSymbolsA = (e) => (Module._xmlUCSIsMiscellaneousMathematicalSymbolsA = wasmExports.xmlUCSIsMiscellaneousMathematicalSymbolsA)(e);
    Module._xmlUCSIsMiscellaneousMathematicalSymbolsB = (e) => (Module._xmlUCSIsMiscellaneousMathematicalSymbolsB = wasmExports.xmlUCSIsMiscellaneousMathematicalSymbolsB)(e);
    Module._xmlUCSIsMiscellaneousSymbols = (e) => (Module._xmlUCSIsMiscellaneousSymbols = wasmExports.xmlUCSIsMiscellaneousSymbols)(e);
    Module._xmlUCSIsMiscellaneousSymbolsandArrows = (e) => (Module._xmlUCSIsMiscellaneousSymbolsandArrows = wasmExports.xmlUCSIsMiscellaneousSymbolsandArrows)(e);
    Module._xmlUCSIsMiscellaneousTechnical = (e) => (Module._xmlUCSIsMiscellaneousTechnical = wasmExports.xmlUCSIsMiscellaneousTechnical)(e);
    Module._xmlUCSIsMongolian = (e) => (Module._xmlUCSIsMongolian = wasmExports.xmlUCSIsMongolian)(e);
    Module._xmlUCSIsMusicalSymbols = (e) => (Module._xmlUCSIsMusicalSymbols = wasmExports.xmlUCSIsMusicalSymbols)(e);
    Module._xmlUCSIsMyanmar = (e) => (Module._xmlUCSIsMyanmar = wasmExports.xmlUCSIsMyanmar)(e);
    Module._xmlUCSIsNumberForms = (e) => (Module._xmlUCSIsNumberForms = wasmExports.xmlUCSIsNumberForms)(e);
    Module._xmlUCSIsOgham = (e) => (Module._xmlUCSIsOgham = wasmExports.xmlUCSIsOgham)(e);
    Module._xmlUCSIsOldItalic = (e) => (Module._xmlUCSIsOldItalic = wasmExports.xmlUCSIsOldItalic)(e);
    Module._xmlUCSIsOpticalCharacterRecognition = (e) => (Module._xmlUCSIsOpticalCharacterRecognition = wasmExports.xmlUCSIsOpticalCharacterRecognition)(e);
    Module._xmlUCSIsOriya = (e) => (Module._xmlUCSIsOriya = wasmExports.xmlUCSIsOriya)(e);
    Module._xmlUCSIsOsmanya = (e) => (Module._xmlUCSIsOsmanya = wasmExports.xmlUCSIsOsmanya)(e);
    Module._xmlUCSIsPhoneticExtensions = (e) => (Module._xmlUCSIsPhoneticExtensions = wasmExports.xmlUCSIsPhoneticExtensions)(e);
    Module._xmlUCSIsPrivateUse = (e) => (Module._xmlUCSIsPrivateUse = wasmExports.xmlUCSIsPrivateUse)(e);
    Module._xmlUCSIsPrivateUseArea = (e) => (Module._xmlUCSIsPrivateUseArea = wasmExports.xmlUCSIsPrivateUseArea)(e);
    Module._xmlUCSIsRunic = (e) => (Module._xmlUCSIsRunic = wasmExports.xmlUCSIsRunic)(e);
    Module._xmlUCSIsShavian = (e) => (Module._xmlUCSIsShavian = wasmExports.xmlUCSIsShavian)(e);
    Module._xmlUCSIsSinhala = (e) => (Module._xmlUCSIsSinhala = wasmExports.xmlUCSIsSinhala)(e);
    Module._xmlUCSIsSmallFormVariants = (e) => (Module._xmlUCSIsSmallFormVariants = wasmExports.xmlUCSIsSmallFormVariants)(e);
    Module._xmlUCSIsSpacingModifierLetters = (e) => (Module._xmlUCSIsSpacingModifierLetters = wasmExports.xmlUCSIsSpacingModifierLetters)(e);
    Module._xmlUCSIsSpecials = (e) => (Module._xmlUCSIsSpecials = wasmExports.xmlUCSIsSpecials)(e);
    Module._xmlUCSIsSuperscriptsandSubscripts = (e) => (Module._xmlUCSIsSuperscriptsandSubscripts = wasmExports.xmlUCSIsSuperscriptsandSubscripts)(e);
    Module._xmlUCSIsSupplementalArrowsA = (e) => (Module._xmlUCSIsSupplementalArrowsA = wasmExports.xmlUCSIsSupplementalArrowsA)(e);
    Module._xmlUCSIsSupplementalArrowsB = (e) => (Module._xmlUCSIsSupplementalArrowsB = wasmExports.xmlUCSIsSupplementalArrowsB)(e);
    Module._xmlUCSIsSupplementalMathematicalOperators = (e) => (Module._xmlUCSIsSupplementalMathematicalOperators = wasmExports.xmlUCSIsSupplementalMathematicalOperators)(e);
    Module._xmlUCSIsSupplementaryPrivateUseAreaA = (e) => (Module._xmlUCSIsSupplementaryPrivateUseAreaA = wasmExports.xmlUCSIsSupplementaryPrivateUseAreaA)(e);
    Module._xmlUCSIsSupplementaryPrivateUseAreaB = (e) => (Module._xmlUCSIsSupplementaryPrivateUseAreaB = wasmExports.xmlUCSIsSupplementaryPrivateUseAreaB)(e);
    Module._xmlUCSIsSyriac = (e) => (Module._xmlUCSIsSyriac = wasmExports.xmlUCSIsSyriac)(e);
    Module._xmlUCSIsTagalog = (e) => (Module._xmlUCSIsTagalog = wasmExports.xmlUCSIsTagalog)(e);
    Module._xmlUCSIsTagbanwa = (e) => (Module._xmlUCSIsTagbanwa = wasmExports.xmlUCSIsTagbanwa)(e);
    Module._xmlUCSIsTags = (e) => (Module._xmlUCSIsTags = wasmExports.xmlUCSIsTags)(e);
    Module._xmlUCSIsTaiLe = (e) => (Module._xmlUCSIsTaiLe = wasmExports.xmlUCSIsTaiLe)(e);
    Module._xmlUCSIsTaiXuanJingSymbols = (e) => (Module._xmlUCSIsTaiXuanJingSymbols = wasmExports.xmlUCSIsTaiXuanJingSymbols)(e);
    Module._xmlUCSIsTamil = (e) => (Module._xmlUCSIsTamil = wasmExports.xmlUCSIsTamil)(e);
    Module._xmlUCSIsTelugu = (e) => (Module._xmlUCSIsTelugu = wasmExports.xmlUCSIsTelugu)(e);
    Module._xmlUCSIsThaana = (e) => (Module._xmlUCSIsThaana = wasmExports.xmlUCSIsThaana)(e);
    Module._xmlUCSIsThai = (e) => (Module._xmlUCSIsThai = wasmExports.xmlUCSIsThai)(e);
    Module._xmlUCSIsTibetan = (e) => (Module._xmlUCSIsTibetan = wasmExports.xmlUCSIsTibetan)(e);
    Module._xmlUCSIsUgaritic = (e) => (Module._xmlUCSIsUgaritic = wasmExports.xmlUCSIsUgaritic)(e);
    Module._xmlUCSIsUnifiedCanadianAboriginalSyllabics = (e) => (Module._xmlUCSIsUnifiedCanadianAboriginalSyllabics = wasmExports.xmlUCSIsUnifiedCanadianAboriginalSyllabics)(e);
    Module._xmlUCSIsVariationSelectors = (e) => (Module._xmlUCSIsVariationSelectors = wasmExports.xmlUCSIsVariationSelectors)(e);
    Module._xmlUCSIsVariationSelectorsSupplement = (e) => (Module._xmlUCSIsVariationSelectorsSupplement = wasmExports.xmlUCSIsVariationSelectorsSupplement)(e);
    Module._xmlUCSIsYiRadicals = (e) => (Module._xmlUCSIsYiRadicals = wasmExports.xmlUCSIsYiRadicals)(e);
    Module._xmlUCSIsYiSyllables = (e) => (Module._xmlUCSIsYiSyllables = wasmExports.xmlUCSIsYiSyllables)(e);
    Module._xmlUCSIsYijingHexagramSymbols = (e) => (Module._xmlUCSIsYijingHexagramSymbols = wasmExports.xmlUCSIsYijingHexagramSymbols)(e);
    Module._xmlUCSIsCatCs = (e) => (Module._xmlUCSIsCatCs = wasmExports.xmlUCSIsCatCs)(e);
    Module.___small_fprintf = (e, t, r2) => (Module.___small_fprintf = wasmExports.__small_fprintf)(e, t, r2);
    Module._xmlXPathBooleanFunction = (e, t) => (Module._xmlXPathBooleanFunction = wasmExports.xmlXPathBooleanFunction)(e, t);
    Module._xmlXPathCeilingFunction = (e, t) => (Module._xmlXPathCeilingFunction = wasmExports.xmlXPathCeilingFunction)(e, t);
    Module._xmlXPathCountFunction = (e, t) => (Module._xmlXPathCountFunction = wasmExports.xmlXPathCountFunction)(e, t);
    Module._xmlXPathConcatFunction = (e, t) => (Module._xmlXPathConcatFunction = wasmExports.xmlXPathConcatFunction)(e, t);
    Module._xmlXPathContainsFunction = (e, t) => (Module._xmlXPathContainsFunction = wasmExports.xmlXPathContainsFunction)(e, t);
    Module._xmlXPathIdFunction = (e, t) => (Module._xmlXPathIdFunction = wasmExports.xmlXPathIdFunction)(e, t);
    Module._xmlXPathFalseFunction = (e, t) => (Module._xmlXPathFalseFunction = wasmExports.xmlXPathFalseFunction)(e, t);
    Module._xmlXPathFloorFunction = (e, t) => (Module._xmlXPathFloorFunction = wasmExports.xmlXPathFloorFunction)(e, t);
    Module._xmlXPathLastFunction = (e, t) => (Module._xmlXPathLastFunction = wasmExports.xmlXPathLastFunction)(e, t);
    Module._xmlXPathLangFunction = (e, t) => (Module._xmlXPathLangFunction = wasmExports.xmlXPathLangFunction)(e, t);
    Module._xmlXPathLocalNameFunction = (e, t) => (Module._xmlXPathLocalNameFunction = wasmExports.xmlXPathLocalNameFunction)(e, t);
    Module._xmlXPathNotFunction = (e, t) => (Module._xmlXPathNotFunction = wasmExports.xmlXPathNotFunction)(e, t);
    Module._xmlXPathNamespaceURIFunction = (e, t) => (Module._xmlXPathNamespaceURIFunction = wasmExports.xmlXPathNamespaceURIFunction)(e, t);
    Module._xmlXPathNormalizeFunction = (e, t) => (Module._xmlXPathNormalizeFunction = wasmExports.xmlXPathNormalizeFunction)(e, t);
    Module._xmlXPathNumberFunction = (e, t) => (Module._xmlXPathNumberFunction = wasmExports.xmlXPathNumberFunction)(e, t);
    Module._xmlXPathPositionFunction = (e, t) => (Module._xmlXPathPositionFunction = wasmExports.xmlXPathPositionFunction)(e, t);
    Module._xmlXPathRoundFunction = (e, t) => (Module._xmlXPathRoundFunction = wasmExports.xmlXPathRoundFunction)(e, t);
    Module._xmlXPathStringFunction = (e, t) => (Module._xmlXPathStringFunction = wasmExports.xmlXPathStringFunction)(e, t);
    Module._xmlXPathStringLengthFunction = (e, t) => (Module._xmlXPathStringLengthFunction = wasmExports.xmlXPathStringLengthFunction)(e, t);
    Module._xmlXPathStartsWithFunction = (e, t) => (Module._xmlXPathStartsWithFunction = wasmExports.xmlXPathStartsWithFunction)(e, t);
    Module._xmlXPathSubstringFunction = (e, t) => (Module._xmlXPathSubstringFunction = wasmExports.xmlXPathSubstringFunction)(e, t);
    Module._xmlXPathSubstringBeforeFunction = (e, t) => (Module._xmlXPathSubstringBeforeFunction = wasmExports.xmlXPathSubstringBeforeFunction)(e, t);
    Module._xmlXPathSubstringAfterFunction = (e, t) => (Module._xmlXPathSubstringAfterFunction = wasmExports.xmlXPathSubstringAfterFunction)(e, t);
    Module._xmlXPathSumFunction = (e, t) => (Module._xmlXPathSumFunction = wasmExports.xmlXPathSumFunction)(e, t);
    Module._xmlXPathTrueFunction = (e, t) => (Module._xmlXPathTrueFunction = wasmExports.xmlXPathTrueFunction)(e, t);
    Module._xmlXPathTranslateFunction = (e, t) => (Module._xmlXPathTranslateFunction = wasmExports.xmlXPathTranslateFunction)(e, t);
    Module._xmlXPathNextSelf = (e, t) => (Module._xmlXPathNextSelf = wasmExports.xmlXPathNextSelf)(e, t);
    Module._xmlXPathNextChild = (e, t) => (Module._xmlXPathNextChild = wasmExports.xmlXPathNextChild)(e, t);
    Module._xmlXPathNextDescendant = (e, t) => (Module._xmlXPathNextDescendant = wasmExports.xmlXPathNextDescendant)(e, t);
    Module._xmlXPathNextDescendantOrSelf = (e, t) => (Module._xmlXPathNextDescendantOrSelf = wasmExports.xmlXPathNextDescendantOrSelf)(e, t);
    Module._xmlXPathNextParent = (e, t) => (Module._xmlXPathNextParent = wasmExports.xmlXPathNextParent)(e, t);
    Module._xmlXPathNextAncestor = (e, t) => (Module._xmlXPathNextAncestor = wasmExports.xmlXPathNextAncestor)(e, t);
    Module._xmlXPathNextAncestorOrSelf = (e, t) => (Module._xmlXPathNextAncestorOrSelf = wasmExports.xmlXPathNextAncestorOrSelf)(e, t);
    Module._xmlXPathNextFollowingSibling = (e, t) => (Module._xmlXPathNextFollowingSibling = wasmExports.xmlXPathNextFollowingSibling)(e, t);
    Module._xmlXPathNextPrecedingSibling = (e, t) => (Module._xmlXPathNextPrecedingSibling = wasmExports.xmlXPathNextPrecedingSibling)(e, t);
    Module._xmlXPathNextFollowing = (e, t) => (Module._xmlXPathNextFollowing = wasmExports.xmlXPathNextFollowing)(e, t);
    Module._xmlXPathNextNamespace = (e, t) => (Module._xmlXPathNextNamespace = wasmExports.xmlXPathNextNamespace)(e, t);
    Module._xmlXPathNextAttribute = (e, t) => (Module._xmlXPathNextAttribute = wasmExports.xmlXPathNextAttribute)(e, t);
    Module._zcalloc = (e, t, r2) => (Module._zcalloc = wasmExports.zcalloc)(e, t, r2);
    Module._zcfree = (e, t) => (Module._zcfree = wasmExports.zcfree)(e, t);
    Module._strerror = (e) => (Module._strerror = wasmExports.strerror)(e);
    var ___dl_seterr = (e, t) => (___dl_seterr = wasmExports.__dl_seterr)(e, t);
    Module._putc = (e, t) => (Module._putc = wasmExports.putc)(e, t);
    Module._gmtime = (e) => (Module._gmtime = wasmExports.gmtime)(e);
    var _htonl = (e) => (_htonl = wasmExports.htonl)(e), _htons = (e) => (_htons = wasmExports.htons)(e);
    Module._ioctl = (e, t, r2) => (Module._ioctl = wasmExports.ioctl)(e, t, r2);
    var _emscripten_builtin_memalign = (e, t) => (_emscripten_builtin_memalign = wasmExports.emscripten_builtin_memalign)(e, t), _ntohs = (e) => (_ntohs = wasmExports.ntohs)(e);
    Module._srand = (e) => (Module._srand = wasmExports.srand)(e);
    Module._rand = () => (Module._rand = wasmExports.rand)();
    var __emscripten_timeout = (e, t) => (__emscripten_timeout = wasmExports._emscripten_timeout)(e, t);
    Module.___floatsitf = (e, t) => (Module.___floatsitf = wasmExports.__floatsitf)(e, t);
    Module.___multf3 = (e, t, r2, a2, o2) => (Module.___multf3 = wasmExports.__multf3)(e, t, r2, a2, o2);
    Module.___extenddftf2 = (e, t) => (Module.___extenddftf2 = wasmExports.__extenddftf2)(e, t);
    Module.___getf2 = (e, t, r2, a2) => (Module.___getf2 = wasmExports.__getf2)(e, t, r2, a2);
    Module.___subtf3 = (e, t, r2, a2, o2) => (Module.___subtf3 = wasmExports.__subtf3)(e, t, r2, a2, o2);
    Module.___letf2 = (e, t, r2, a2) => (Module.___letf2 = wasmExports.__letf2)(e, t, r2, a2);
    Module.___lttf2 = (e, t, r2, a2) => (Module.___lttf2 = wasmExports.__lttf2)(e, t, r2, a2);
    var _setThrew = (e, t) => (_setThrew = wasmExports.setThrew)(e, t), __emscripten_tempret_set = (e) => (__emscripten_tempret_set = wasmExports._emscripten_tempret_set)(e), __emscripten_tempret_get = () => (__emscripten_tempret_get = wasmExports._emscripten_tempret_get)();
    Module.___fixtfsi = (e, t) => (Module.___fixtfsi = wasmExports.__fixtfsi)(e, t);
    var __emscripten_stack_restore = (e) => (__emscripten_stack_restore = wasmExports._emscripten_stack_restore)(e), __emscripten_stack_alloc = (e) => (__emscripten_stack_alloc = wasmExports._emscripten_stack_alloc)(e), _emscripten_stack_get_current = () => (_emscripten_stack_get_current = wasmExports.emscripten_stack_get_current)();
    Module._ScanKeywords = 18770052;
    Module._stderr = 18792480;
    Module._stdout = 18792784;
    Module._TopMemoryContext = 18830716;
    Module._MainLWLockArray = 18800668;
    Module._MyProc = 18802328;
    Module._MyProcPid = 18824228;
    Module._MyLatch = 18824260;
    Module._CurrentMemoryContext = 18830712;
    Module._InterruptPending = 18824092;
    Module._pg_global_prng_state = 18936304;
    Module._CurrentResourceOwner = 18830692;
    Module._InterruptHoldoffCount = 18824132;
    Module._IsUnderPostmaster = 18824165;
    Module._wal_level = 18758340;
    Module._MyDatabaseId = 18824148;
    Module._error_context_stack = 18816816;
    Module._PG_exception_stack = 18816820;
    Module.___THREW__ = 18950052;
    Module.___threwValue = 18950056;
    Module._ShmemVariableCache = 18849760;
    Module._shmem_startup_hook = 18794508;
    Module._debug_query_string = 18848300;
    Module._CritSectionCount = 18824140;
    Module._old_snapshot_threshold = 18823756;
    Module._TopTransactionResourceOwner = 18830700;
    Module._LocalBufferBlockPointers = 18800556;
    Module._BufferBlocks = 18795304;
    Module._pgBufferUsage = 18813728;
    Module._GUC_check_errdetail_string = 18814680;
    Module._NBuffers = 18690456;
    Module._BufferDescriptors = 18795300;
    Module._ParallelWorkerNumber = 18767008;
    Module._stdin = 18792632;
    Module._ScanKeywordTokens = 17487664;
    Module._post_parse_analyze_hook = 18802584;
    Module._progname = 18848060;
    Module._DataDir = 18824144;
    Module._MyStartTime = 18824232;
    Module._MyProcPort = 18824248;
    Module._Log_directory = 18803120;
    Module._Log_filename = 18803124;
    Module._ConfigReloadPending = 18803272;
    Module._ShutdownRequestPending = 18803276;
    Module._process_shared_preload_libraries_in_progress = 18824080;
    Module._wal_segment_size = 18758360;
    Module._application_name = 18815988;
    Module._XactIsoLevel = 18758700;
    Module._RmgrTable = 18758816;
    Module._CacheMemoryContext = 18830728;
    Module._TopTransactionContext = 18830736;
    Module._TTSOpsVirtual = 18638668;
    Module._WalReceiverFunctions = 18803712;
    Module._TTSOpsMinimalTuple = 18638764;
    Module._cluster_name = 18640444;
    Module._work_mem = 18690432;
    Module._ClientAuthentication_hook = 18804032;
    Module._cma_rsize = 18848108;
    Module._SOCKET_DATA = 18854312;
    Module._SOCKET_FILE = 18854308;
    Module._TTSOpsHeapTuple = 18638716;
    Module._SnapshotAnyData = 18690240;
    Module._ExecutorStart_hook = 18813600;
    Module._ExecutorRun_hook = 18813604;
    Module._ExecutorFinish_hook = 18813608;
    Module._ExecutorEnd_hook = 18813612;
    Module._SPI_processed = 18813624;
    Module._SPI_tuptable = 18813632;
    Module._SPI_result = 18813636;
    Module._pgWalUsage = 18813840;
    Module._cpu_operator_cost = 18638912;
    Module._planner_hook = 18813876;
    Module._maintenance_work_mem = 18690448;
    Module._max_parallel_maintenance_workers = 18690452;
    Module._cpu_tuple_cost = 18638896;
    Module._seq_page_cost = 18638880;
    Module._check_function_bodies = 18640389;
    Module._quote_all_identifiers = 18848065;
    Module._extra_float_digits = 18692128;
    Module._IntervalStyle = 18824172;
    Module._pg_crc32_table = 18115504;
    Module._oldSnapshotControl = 18823760;
    Module._shmem_request_hook = 18824084;
    Module._DateStyle = 18690420;
    Module._pg_number_of_ones = 18433360;
    Module._xmlStructuredError = 18936668;
    Module._xmlStructuredErrorContext = 18936676;
    Module._xmlGenericErrorContext = 18936672;
    Module._xmlGenericError = 18774356;
    Module._xmlIsBaseCharGroup = 18774120;
    Module._xmlIsDigitGroup = 18774152;
    Module._xmlIsCombiningGroup = 18774136;
    Module._xmlIsExtenderGroup = 18774168;
    Module._xmlFree = 18774320;
    Module._ProcessUtility_hook = 18848012;
    Module._single_mode_feed = 18848076;
    Module._cma_wsize = 18848116;
    Module._check_password_hook = 18850784;
    Module._IDB_STAGE = 18854320;
    Module._IDB_PIPE_FP = 18854316;
    Module._pg_scram_mech = 18774064;
    Module._pg_g_threadlock = 18772168;
    Module._pgresStatus = 18773856;
    Module._xmlIsPubidChar_tab = 18433648;
    Module._xmlGetWarningsDefaultValue = 18774348;
    Module._xmlMalloc = 18774324;
    Module._xmlRealloc = 18774332;
    Module._xmlLastError = 18936688;
    Module._xmlMallocAtomic = 18774328;
    Module._xmlMemStrdup = 18774336;
    Module._xmlBufferAllocScheme = 18774340;
    Module._xmlDefaultBufferSize = 18774344;
    Module._xmlParserDebugEntities = 18936628;
    Module._xmlDoValidityCheckingDefaultValue = 18936632;
    Module._xmlLoadExtDtdDefaultValue = 18936636;
    Module._xmlPedanticParserDefaultValue = 18936640;
    Module._xmlLineNumbersDefaultValue = 18936644;
    Module._xmlKeepBlanksDefaultValue = 18774352;
    Module._xmlSubstituteEntitiesDefaultValue = 18936648;
    Module._xmlRegisterNodeDefaultValue = 18936652;
    Module._xmlDeregisterNodeDefaultValue = 18936656;
    Module._xmlParserInputBufferCreateFilenameValue = 18936660;
    Module._xmlOutputBufferCreateFilenameValue = 18936664;
    Module._xmlIndentTreeOutput = 18774360;
    Module._xmlTreeIndentString = 18774364;
    Module._xmlSaveNoEmptyTags = 18936680;
    Module._xmlDefaultSAXHandler = 18774368;
    Module._xmlDefaultSAXLocator = 18774480;
    Module._xmlParserMaxDepth = 18775140;
    Module._xmlStringText = 18435456;
    Module._xmlStringComment = 18435471;
    Module._xmlStringTextNoenc = 18435461;
    Module._xmlXPathNAN = 18937352;
    Module._xmlXPathNINF = 18937368;
    Module._xmlXPathPINF = 18937360;
    Module._z_errmsg = 18791696;
    Module.__length_code = 18455120;
    Module.__dist_code = 18454608;
    function invoke_i(e) {
      var t = stackSave();
      try {
        return getWasmTableEntry(e)();
      } catch (r2) {
        if (stackRestore(t), r2 !== r2 + 0) throw r2;
        _setThrew(1, 0);
      }
    }
    function invoke_v(e) {
      var t = stackSave();
      try {
        getWasmTableEntry(e)();
      } catch (r2) {
        if (stackRestore(t), r2 !== r2 + 0) throw r2;
        _setThrew(1, 0);
      }
    }
    function invoke_vi(e, t) {
      var r2 = stackSave();
      try {
        getWasmTableEntry(e)(t);
      } catch (a2) {
        if (stackRestore(r2), a2 !== a2 + 0) throw a2;
        _setThrew(1, 0);
      }
    }
    function invoke_iii(e, t, r2) {
      var a2 = stackSave();
      try {
        return getWasmTableEntry(e)(t, r2);
      } catch (o2) {
        if (stackRestore(a2), o2 !== o2 + 0) throw o2;
        _setThrew(1, 0);
      }
    }
    function invoke_iiiiii(e, t, r2, a2, o2, s2) {
      var l2 = stackSave();
      try {
        return getWasmTableEntry(e)(t, r2, a2, o2, s2);
      } catch (n2) {
        if (stackRestore(l2), n2 !== n2 + 0) throw n2;
        _setThrew(1, 0);
      }
    }
    function invoke_viii(e, t, r2, a2) {
      var o2 = stackSave();
      try {
        getWasmTableEntry(e)(t, r2, a2);
      } catch (s2) {
        if (stackRestore(o2), s2 !== s2 + 0) throw s2;
        _setThrew(1, 0);
      }
    }
    function invoke_viiiiiii(e, t, r2, a2, o2, s2, l2, n2) {
      var _2 = stackSave();
      try {
        getWasmTableEntry(e)(t, r2, a2, o2, s2, l2, n2);
      } catch (m2) {
        if (stackRestore(_2), m2 !== m2 + 0) throw m2;
        _setThrew(1, 0);
      }
    }
    function invoke_iiii(e, t, r2, a2) {
      var o2 = stackSave();
      try {
        return getWasmTableEntry(e)(t, r2, a2);
      } catch (s2) {
        if (stackRestore(o2), s2 !== s2 + 0) throw s2;
        _setThrew(1, 0);
      }
    }
    function invoke_viiii(e, t, r2, a2, o2) {
      var s2 = stackSave();
      try {
        getWasmTableEntry(e)(t, r2, a2, o2);
      } catch (l2) {
        if (stackRestore(s2), l2 !== l2 + 0) throw l2;
        _setThrew(1, 0);
      }
    }
    function invoke_iiiii(e, t, r2, a2, o2) {
      var s2 = stackSave();
      try {
        return getWasmTableEntry(e)(t, r2, a2, o2);
      } catch (l2) {
        if (stackRestore(s2), l2 !== l2 + 0) throw l2;
        _setThrew(1, 0);
      }
    }
    function invoke_vii(e, t, r2) {
      var a2 = stackSave();
      try {
        getWasmTableEntry(e)(t, r2);
      } catch (o2) {
        if (stackRestore(a2), o2 !== o2 + 0) throw o2;
        _setThrew(1, 0);
      }
    }
    function invoke_ii(e, t) {
      var r2 = stackSave();
      try {
        return getWasmTableEntry(e)(t);
      } catch (a2) {
        if (stackRestore(r2), a2 !== a2 + 0) throw a2;
        _setThrew(1, 0);
      }
    }
    function invoke_viiiiiiii(e, t, r2, a2, o2, s2, l2, n2, _2) {
      var m2 = stackSave();
      try {
        getWasmTableEntry(e)(t, r2, a2, o2, s2, l2, n2, _2);
      } catch (p2) {
        if (stackRestore(m2), p2 !== p2 + 0) throw p2;
        _setThrew(1, 0);
      }
    }
    function invoke_viiiii(e, t, r2, a2, o2, s2) {
      var l2 = stackSave();
      try {
        getWasmTableEntry(e)(t, r2, a2, o2, s2);
      } catch (n2) {
        if (stackRestore(l2), n2 !== n2 + 0) throw n2;
        _setThrew(1, 0);
      }
    }
    function invoke_ij(e, t) {
      var r2 = stackSave();
      try {
        return getWasmTableEntry(e)(t);
      } catch (a2) {
        if (stackRestore(r2), a2 !== a2 + 0) throw a2;
        _setThrew(1, 0);
      }
    }
    function invoke_ji(e, t) {
      var r2 = stackSave();
      try {
        return getWasmTableEntry(e)(t);
      } catch (a2) {
        if (stackRestore(r2), a2 !== a2 + 0) throw a2;
        return _setThrew(1, 0), 0n;
      }
    }
    function invoke_ijiiiiii(e, t, r2, a2, o2, s2, l2, n2) {
      var _2 = stackSave();
      try {
        return getWasmTableEntry(e)(t, r2, a2, o2, s2, l2, n2);
      } catch (m2) {
        if (stackRestore(_2), m2 !== m2 + 0) throw m2;
        _setThrew(1, 0);
      }
    }
    function invoke_vij(e, t, r2) {
      var a2 = stackSave();
      try {
        getWasmTableEntry(e)(t, r2);
      } catch (o2) {
        if (stackRestore(a2), o2 !== o2 + 0) throw o2;
        _setThrew(1, 0);
      }
    }
    function invoke_vj(e, t) {
      var r2 = stackSave();
      try {
        getWasmTableEntry(e)(t);
      } catch (a2) {
        if (stackRestore(r2), a2 !== a2 + 0) throw a2;
        _setThrew(1, 0);
      }
    }
    function invoke_viijii(e, t, r2, a2, o2, s2) {
      var l2 = stackSave();
      try {
        getWasmTableEntry(e)(t, r2, a2, o2, s2);
      } catch (n2) {
        if (stackRestore(l2), n2 !== n2 + 0) throw n2;
        _setThrew(1, 0);
      }
    }
    function invoke_iiiiiji(e, t, r2, a2, o2, s2, l2) {
      var n2 = stackSave();
      try {
        return getWasmTableEntry(e)(t, r2, a2, o2, s2, l2);
      } catch (_2) {
        if (stackRestore(n2), _2 !== _2 + 0) throw _2;
        _setThrew(1, 0);
      }
    }
    function invoke_viijiiii(e, t, r2, a2, o2, s2, l2, n2) {
      var _2 = stackSave();
      try {
        getWasmTableEntry(e)(t, r2, a2, o2, s2, l2, n2);
      } catch (m2) {
        if (stackRestore(_2), m2 !== m2 + 0) throw m2;
        _setThrew(1, 0);
      }
    }
    function invoke_viij(e, t, r2, a2) {
      var o2 = stackSave();
      try {
        getWasmTableEntry(e)(t, r2, a2);
      } catch (s2) {
        if (stackRestore(o2), s2 !== s2 + 0) throw s2;
        _setThrew(1, 0);
      }
    }
    function invoke_jiiiiiiii(e, t, r2, a2, o2, s2, l2, n2, _2) {
      var m2 = stackSave();
      try {
        return getWasmTableEntry(e)(t, r2, a2, o2, s2, l2, n2, _2);
      } catch (p2) {
        if (stackRestore(m2), p2 !== p2 + 0) throw p2;
        return _setThrew(1, 0), 0n;
      }
    }
    function invoke_jiiiii(e, t, r2, a2, o2, s2) {
      var l2 = stackSave();
      try {
        return getWasmTableEntry(e)(t, r2, a2, o2, s2);
      } catch (n2) {
        if (stackRestore(l2), n2 !== n2 + 0) throw n2;
        return _setThrew(1, 0), 0n;
      }
    }
    function invoke_iiiiiiiii(e, t, r2, a2, o2, s2, l2, n2, _2) {
      var m2 = stackSave();
      try {
        return getWasmTableEntry(e)(t, r2, a2, o2, s2, l2, n2, _2);
      } catch (p2) {
        if (stackRestore(m2), p2 !== p2 + 0) throw p2;
        _setThrew(1, 0);
      }
    }
    function invoke_vji(e, t, r2) {
      var a2 = stackSave();
      try {
        getWasmTableEntry(e)(t, r2);
      } catch (o2) {
        if (stackRestore(a2), o2 !== o2 + 0) throw o2;
        _setThrew(1, 0);
      }
    }
    function invoke_iiiijii(e, t, r2, a2, o2, s2, l2) {
      var n2 = stackSave();
      try {
        return getWasmTableEntry(e)(t, r2, a2, o2, s2, l2);
      } catch (_2) {
        if (stackRestore(n2), _2 !== _2 + 0) throw _2;
        _setThrew(1, 0);
      }
    }
    function invoke_vijiji(e, t, r2, a2, o2, s2) {
      var l2 = stackSave();
      try {
        getWasmTableEntry(e)(t, r2, a2, o2, s2);
      } catch (n2) {
        if (stackRestore(l2), n2 !== n2 + 0) throw n2;
        _setThrew(1, 0);
      }
    }
    function invoke_viji(e, t, r2, a2) {
      var o2 = stackSave();
      try {
        getWasmTableEntry(e)(t, r2, a2);
      } catch (s2) {
        if (stackRestore(o2), s2 !== s2 + 0) throw s2;
        _setThrew(1, 0);
      }
    }
    function invoke_iiij(e, t, r2, a2) {
      var o2 = stackSave();
      try {
        return getWasmTableEntry(e)(t, r2, a2);
      } catch (s2) {
        if (stackRestore(o2), s2 !== s2 + 0) throw s2;
        _setThrew(1, 0);
      }
    }
    function invoke_iiiiiiii(e, t, r2, a2, o2, s2, l2, n2) {
      var _2 = stackSave();
      try {
        return getWasmTableEntry(e)(t, r2, a2, o2, s2, l2, n2);
      } catch (m2) {
        if (stackRestore(_2), m2 !== m2 + 0) throw m2;
        _setThrew(1, 0);
      }
    }
    function invoke_iiiiiii(e, t, r2, a2, o2, s2, l2) {
      var n2 = stackSave();
      try {
        return getWasmTableEntry(e)(t, r2, a2, o2, s2, l2);
      } catch (_2) {
        if (stackRestore(n2), _2 !== _2 + 0) throw _2;
        _setThrew(1, 0);
      }
    }
    function invoke_di(e, t) {
      var r2 = stackSave();
      try {
        return getWasmTableEntry(e)(t);
      } catch (a2) {
        if (stackRestore(r2), a2 !== a2 + 0) throw a2;
        _setThrew(1, 0);
      }
    }
    function invoke_id(e, t) {
      var r2 = stackSave();
      try {
        return getWasmTableEntry(e)(t);
      } catch (a2) {
        if (stackRestore(r2), a2 !== a2 + 0) throw a2;
        _setThrew(1, 0);
      }
    }
    function invoke_ijiiiii(e, t, r2, a2, o2, s2, l2) {
      var n2 = stackSave();
      try {
        return getWasmTableEntry(e)(t, r2, a2, o2, s2, l2);
      } catch (_2) {
        if (stackRestore(n2), _2 !== _2 + 0) throw _2;
        _setThrew(1, 0);
      }
    }
    function invoke_jiiii(e, t, r2, a2, o2) {
      var s2 = stackSave();
      try {
        return getWasmTableEntry(e)(t, r2, a2, o2);
      } catch (l2) {
        if (stackRestore(s2), l2 !== l2 + 0) throw l2;
        return _setThrew(1, 0), 0n;
      }
    }
    function invoke_viiiiii(e, t, r2, a2, o2, s2, l2) {
      var n2 = stackSave();
      try {
        getWasmTableEntry(e)(t, r2, a2, o2, s2, l2);
      } catch (_2) {
        if (stackRestore(n2), _2 !== _2 + 0) throw _2;
        _setThrew(1, 0);
      }
    }
    function invoke_viiiiiiiiiiii(e, t, r2, a2, o2, s2, l2, n2, _2, m2, p2, d2, g2) {
      var c2 = stackSave();
      try {
        getWasmTableEntry(e)(t, r2, a2, o2, s2, l2, n2, _2, m2, p2, d2, g2);
      } catch (f2) {
        if (stackRestore(c2), f2 !== f2 + 0) throw f2;
        _setThrew(1, 0);
      }
    }
    function invoke_jii(e, t, r2) {
      var a2 = stackSave();
      try {
        return getWasmTableEntry(e)(t, r2);
      } catch (o2) {
        if (stackRestore(a2), o2 !== o2 + 0) throw o2;
        return _setThrew(1, 0), 0n;
      }
    }
    function invoke_iiiij(e, t, r2, a2, o2) {
      var s2 = stackSave();
      try {
        return getWasmTableEntry(e)(t, r2, a2, o2);
      } catch (l2) {
        if (stackRestore(s2), l2 !== l2 + 0) throw l2;
        _setThrew(1, 0);
      }
    }
    function invoke_iiiiiiiiii(e, t, r2, a2, o2, s2, l2, n2, _2, m2) {
      var p2 = stackSave();
      try {
        return getWasmTableEntry(e)(t, r2, a2, o2, s2, l2, n2, _2, m2);
      } catch (d2) {
        if (stackRestore(p2), d2 !== d2 + 0) throw d2;
        _setThrew(1, 0);
      }
    }
    function invoke_viiji(e, t, r2, a2, o2) {
      var s2 = stackSave();
      try {
        getWasmTableEntry(e)(t, r2, a2, o2);
      } catch (l2) {
        if (stackRestore(s2), l2 !== l2 + 0) throw l2;
        _setThrew(1, 0);
      }
    }
    function invoke_iiji(e, t, r2, a2) {
      var o2 = stackSave();
      try {
        return getWasmTableEntry(e)(t, r2, a2);
      } catch (s2) {
        if (stackRestore(o2), s2 !== s2 + 0) throw s2;
        _setThrew(1, 0);
      }
    }
    function invoke_vid(e, t, r2) {
      var a2 = stackSave();
      try {
        getWasmTableEntry(e)(t, r2);
      } catch (o2) {
        if (stackRestore(a2), o2 !== o2 + 0) throw o2;
        _setThrew(1, 0);
      }
    }
    function invoke_viiiiiiiii(e, t, r2, a2, o2, s2, l2, n2, _2, m2) {
      var p2 = stackSave();
      try {
        getWasmTableEntry(e)(t, r2, a2, o2, s2, l2, n2, _2, m2);
      } catch (d2) {
        if (stackRestore(p2), d2 !== d2 + 0) throw d2;
        _setThrew(1, 0);
      }
    }
    function invoke_viiij(e, t, r2, a2, o2) {
      var s2 = stackSave();
      try {
        getWasmTableEntry(e)(t, r2, a2, o2);
      } catch (l2) {
        if (stackRestore(s2), l2 !== l2 + 0) throw l2;
        _setThrew(1, 0);
      }
    }
    function invoke_iiiiiiiiiiiiiiiii(e, t, r2, a2, o2, s2, l2, n2, _2, m2, p2, d2, g2, c2, f2, u2, w2) {
      var h2 = stackSave();
      try {
        return getWasmTableEntry(e)(t, r2, a2, o2, s2, l2, n2, _2, m2, p2, d2, g2, c2, f2, u2, w2);
      } catch (S2) {
        if (stackRestore(h2), S2 !== S2 + 0) throw S2;
        _setThrew(1, 0);
      }
    }
    Module.addRunDependency = addRunDependency, Module.removeRunDependency = removeRunDependency, Module.callMain = callMain, Module.ccall = ccall, Module.cwrap = cwrap, Module.setValue = setValue, Module.getValue = getValue, Module.UTF8ToString = UTF8ToString, Module.stringToNewUTF8 = stringToNewUTF8, Module.stringToUTF8OnStack = stringToUTF8OnStack, Module.FS_createPreloadedFile = FS_createPreloadedFile, Module.FS_unlink = FS_unlink, Module.FS_createPath = FS_createPath, Module.FS_createDevice = FS_createDevice, Module.FS = FS, Module.FS_createDataFile = FS_createDataFile, Module.FS_createLazyFile = FS_createLazyFile;
    var calledRun;
    dependenciesFulfilled = function e() {
      calledRun || run(), calledRun || (dependenciesFulfilled = e);
    };
    function callMain(e = []) {
      var t = resolveGlobalSymbol("main").sym;
      if (t) {
        e.unshift(thisProgram);
        var r2 = e.length, a2 = stackAlloc((r2 + 1) * 4), o2 = a2;
        e.forEach((l2) => {
          HEAPU32[o2 >> 2] = stringToUTF8OnStack(l2), o2 += 4;
        }), HEAPU32[o2 >> 2] = 0;
        try {
          var s2 = t(r2, a2);
          return exitJS(s2, true), s2;
        } catch (l2) {
          return handleException(l2);
        }
      }
    }
    function run(e = arguments_) {
      if (runDependencies > 0 || (preRun(), runDependencies > 0)) return;
      function t() {
        calledRun || (calledRun = true, Module.calledRun = true, !ABORT && (initRuntime(), preMain(), readyPromiseResolve(Module), Module.onRuntimeInitialized?.(), shouldRunNow && callMain(e), postRun()));
      }
      Module.setStatus ? (Module.setStatus("Running..."), setTimeout(() => {
        setTimeout(() => Module.setStatus(""), 1), t();
      }, 1)) : t();
    }
    if (Module.preInit) for (typeof Module.preInit == "function" && (Module.preInit = [Module.preInit]); Module.preInit.length > 0; ) Module.preInit.pop()();
    var shouldRunNow = true;
    return Module.noInitialRun && (shouldRunNow = false), run(), moduleRtn = readyPromise, moduleRtn;
  };
})(), ke = Qe;
var Te = ke;
var Y, W, j, J, $, _e, ie, me, Z, ae, oe, se, V, G, k, K, O, qe, re, pe = class pe2 extends z {
  constructor(r2 = {}, a2 = {}) {
    super();
    R$2(this, O);
    R$2(this, Y, false);
    R$2(this, W, false);
    R$2(this, j, false);
    R$2(this, J, false);
    R$2(this, $, false);
    R$2(this, _e, new H());
    R$2(this, ie, new H());
    R$2(this, me, new H());
    R$2(this, Z, false);
    this.debug = 0;
    R$2(this, ae);
    R$2(this, oe, []);
    R$2(this, se, new ye());
    R$2(this, V);
    R$2(this, G);
    R$2(this, k, /* @__PURE__ */ new Map());
    R$2(this, K, /* @__PURE__ */ new Set());
    typeof r2 == "string" ? a2 = { dataDir: r2, ...a2 } : a2 = r2, this.dataDir = a2.dataDir, a2.parsers !== void 0 && (this.parsers = { ...this.parsers, ...a2.parsers }), a2.serializers !== void 0 && (this.serializers = { ...this.serializers, ...a2.serializers }), a2?.debug !== void 0 && (this.debug = a2.debug), a2?.relaxedDurability !== void 0 && x$2(this, $, a2.relaxedDurability), x$2(this, ae, a2.extensions ?? {}), this.waitReady = T(this, O, qe).call(this, a2 ?? {});
  }
  static async create(r2, a2) {
    let o2 = typeof r2 == "string" ? { dataDir: r2, ...a2 ?? {} } : r2 ?? {}, s2 = new pe2(o2);
    return await s2.waitReady, s2;
  }
  get Module() {
    return this.mod;
  }
  get ready() {
    return h$1(this, Y) && !h$1(this, W) && !h$1(this, j);
  }
  get closed() {
    return h$1(this, j);
  }
  async close() {
    await this._checkReady(), x$2(this, W, true);
    for (let r2 of h$1(this, oe)) await r2();
    try {
      await this.execProtocol(O$1.end()), this.mod._pg_shutdown();
    } catch (r2) {
      let a2 = r2;
      if (!(a2.name === "ExitStatus" && a2.status === 0)) throw r2;
    }
    await this.fs.closeFs(), x$2(this, j, true), x$2(this, W, false);
  }
  async [Symbol.asyncDispose]() {
    await this.close();
  }
  async _handleBlob(r2) {
    x$2(this, V, r2 ? await r2.arrayBuffer() : void 0);
  }
  async _cleanupBlob() {
    x$2(this, V, void 0);
  }
  async _getWrittenBlob() {
    if (!h$1(this, G)) return;
    let r2 = new Blob(h$1(this, G));
    return x$2(this, G, void 0), r2;
  }
  async _checkReady() {
    if (h$1(this, W)) throw new Error("PGlite is closing");
    if (h$1(this, j)) throw new Error("PGlite is closed");
    h$1(this, Y) || await this.waitReady;
  }
  execProtocolRawSync(r2) {
    let a2 = r2.length, o2 = this.mod;
    o2._interactive_write(a2), o2.HEAPU8.set(r2, 1), o2._interactive_one();
    let s2 = a2 + 2, l2 = s2 + o2._interactive_read();
    return o2.HEAPU8.subarray(s2, l2);
  }
  async execProtocolRaw(r2, { syncToFs: a2 = true } = {}) {
    let o2 = r2.length, s2 = this.mod;
    s2._interactive_write(o2), s2.HEAPU8.set(r2, 1), s2._interactive_one();
    let l2 = o2 + 2, n2 = l2 + s2._interactive_read(), _2 = s2.HEAPU8.subarray(l2, n2);
    return a2 && await this.syncToFs(), _2;
  }
  async execProtocol(r2, { syncToFs: a2 = true, throwOnError: o2 = true, onNotice: s2 } = {}) {
    let l2 = await this.execProtocolRaw(r2, { syncToFs: a2 }), n2 = [];
    return h$1(this, se).parse(l2, (_2) => {
      if (_2 instanceof E) {
        if (x$2(this, se, new ye()), o2) throw _2;
      } else if (_2 instanceof ne) this.debug > 0 && console.warn(_2), s2 && s2(_2);
      else if (_2 instanceof ee$1) switch (_2.text) {
        case "BEGIN":
          x$2(this, J, true);
          break;
        case "COMMIT":
        case "ROLLBACK":
          x$2(this, J, false);
          break;
      }
      else if (_2 instanceof X) {
        let m2 = h$1(this, k).get(_2.channel);
        m2 && m2.forEach((p2) => {
          queueMicrotask(() => p2(_2.payload));
        }), h$1(this, K).forEach((p2) => {
          queueMicrotask(() => p2(_2.channel, _2.payload));
        });
      }
      n2.push(_2);
    }), { messages: n2, data: l2 };
  }
  isInTransaction() {
    return h$1(this, J);
  }
  async syncToFs() {
    if (h$1(this, Z)) return;
    x$2(this, Z, true);
    let r2 = async () => {
      await h$1(this, me).runExclusive(async () => {
        x$2(this, Z, false), await this.fs.syncToFs(h$1(this, $));
      });
    };
    h$1(this, $) ? r2() : await r2();
  }
  async listen(r2, a2) {
    let o2 = Nr(r2);
    h$1(this, k).has(o2) || h$1(this, k).set(o2, /* @__PURE__ */ new Set()), h$1(this, k).get(o2).add(a2);
    try {
      await this.exec(`LISTEN ${r2}`);
    } catch (s2) {
      throw h$1(this, k).get(o2).delete(a2), h$1(this, k).get(o2)?.size === 0 && h$1(this, k).delete(o2), s2;
    }
    return async () => {
      await this.unlisten(o2, a2);
    };
  }
  async unlisten(r2, a2) {
    let o2 = Nr(r2);
    a2 ? (h$1(this, k).get(o2)?.delete(a2), h$1(this, k).get(o2)?.size === 0 && (await this.exec(`UNLISTEN ${r2}`), h$1(this, k).delete(o2))) : (await this.exec(`UNLISTEN ${r2}`), h$1(this, k).delete(o2));
  }
  onNotification(r2) {
    return h$1(this, K).add(r2), () => {
      h$1(this, K).delete(r2);
    };
  }
  offNotification(r2) {
    h$1(this, K).delete(r2);
  }
  async dumpDataDir(r2) {
    let a2 = this.dataDir?.split("/").pop() ?? "pgdata";
    return this.fs.dumpTar(a2, r2);
  }
  _runExclusiveQuery(r2) {
    return h$1(this, _e).runExclusive(r2);
  }
  _runExclusiveTransaction(r2) {
    return h$1(this, ie).runExclusive(r2);
  }
  async clone() {
    let r2 = await this.dumpDataDir("none");
    return new pe2({ loadDataDir: r2 });
  }
};
Y = /* @__PURE__ */ new WeakMap(), W = /* @__PURE__ */ new WeakMap(), j = /* @__PURE__ */ new WeakMap(), J = /* @__PURE__ */ new WeakMap(), $ = /* @__PURE__ */ new WeakMap(), _e = /* @__PURE__ */ new WeakMap(), ie = /* @__PURE__ */ new WeakMap(), me = /* @__PURE__ */ new WeakMap(), Z = /* @__PURE__ */ new WeakMap(), ae = /* @__PURE__ */ new WeakMap(), oe = /* @__PURE__ */ new WeakMap(), se = /* @__PURE__ */ new WeakMap(), V = /* @__PURE__ */ new WeakMap(), G = /* @__PURE__ */ new WeakMap(), k = /* @__PURE__ */ new WeakMap(), K = /* @__PURE__ */ new WeakMap(), O = /* @__PURE__ */ new WeakSet(), qe = async function(r2) {
  if (r2.fs) this.fs = r2.fs;
  else {
    let { dataDir: d2, fsType: g2 } = Fe(r2.dataDir);
    this.fs = await Ae(d2, g2);
  }
  let a2 = {}, o2 = [], s2 = [`PGDATA=${C}`, `PREFIX=${Vr}`, `PGUSER=${r2.username ?? "postgres"}`, `PGDATABASE=${r2.database ?? "template1"}`, "MODE=REACT", "REPL=N", ...this.debug ? ["-d", this.debug.toString()] : []];
  r2.wasmModule || Rr();
  let l2 = r2.fsBundle ? r2.fsBundle.arrayBuffer() : Er(), n2;
  l2.then((d2) => {
    n2 = d2;
  });
  let _2 = { WASM_PREFIX: Vr, arguments: s2, INITIAL_MEMORY: r2.initialMemory, noExitRuntime: true, ...this.debug > 0 ? { print: console.info, printErr: console.error } : { print: () => {
  }, printErr: () => {
  } }, instantiateWasm: (d2, g2) => (Tr(d2, r2.wasmModule).then(({ instance: c2, module: f2 }) => {
    g2(c2, f2);
  }), {}), getPreloadedPackage: (d2, g2) => {
    if (d2 === "postgres.data") {
      if (n2.byteLength !== g2) throw new Error(`Invalid FS bundle size: ${n2.byteLength} !== ${g2}`);
      return n2;
    }
    throw new Error(`Unknown package: ${d2}`);
  }, preRun: [(d2) => {
    let g2 = d2.FS.makedev(64, 0), c2 = { open: (f2) => {
    }, close: (f2) => {
    }, read: (f2, u2, w2, h2, S2) => {
      let M2 = h$1(this, V);
      if (!M2) throw new Error("No /dev/blob File or Blob provided to read from");
      let y2 = new Uint8Array(M2);
      if (S2 >= y2.length) return 0;
      let x2 = Math.min(y2.length - S2, h2);
      for (let E2 = 0; E2 < x2; E2++) u2[w2 + E2] = y2[S2 + E2];
      return x2;
    }, write: (f2, u2, w2, h2, S2) => (h$1(this, G) ?? x$2(this, G, []), h$1(this, G).push(u2.slice(w2, w2 + h2)), h2), llseek: (f2, u2, w2) => {
      let h2 = h$1(this, V);
      if (!h2) throw new Error("No /dev/blob File or Blob provided to llseek");
      let S2 = u2;
      if (w2 === 1 ? S2 += f2.position : w2 === 2 && (S2 = new Uint8Array(h2).length), S2 < 0) throw new d2.FS.ErrnoError(28);
      return S2;
    } };
    d2.FS.registerDevice(g2, c2), d2.FS.mkdev("/dev/blob", g2);
  }] }, { emscriptenOpts: m2 } = await this.fs.init(this, _2);
  _2 = m2;
  for (let [d2, g2] of Object.entries(h$1(this, ae))) if (g2 instanceof URL) a2[d2] = ge(g2);
  else {
    let c2 = await g2.setup(this, _2);
    if (c2.emscriptenOpts && (_2 = c2.emscriptenOpts), c2.namespaceObj) {
      let f2 = this;
      f2[d2] = c2.namespaceObj;
    }
    c2.bundlePath && (a2[d2] = ge(c2.bundlePath)), c2.init && o2.push(c2.init), c2.close && h$1(this, oe).push(c2.close);
  }
  if (_2.pg_extensions = a2, await l2, this.mod = await Te(_2), await this.fs.initialSyncFs(), r2.loadDataDir) {
    if (this.mod.FS.analyzePath(C + "/PG_VERSION").exists) throw new Error("Database already exists, cannot load from tarball");
    T(this, O, re).call(this, "pglite: loading data from tarball"), await ce$1(this.mod.FS, r2.loadDataDir, C);
  }
  this.mod.FS.analyzePath(C + "/PG_VERSION").exists ? T(this, O, re).call(this, "pglite: found DB, resuming") : T(this, O, re).call(this, "pglite: no db"), await Pe(this.mod, (...d2) => T(this, O, re).call(this, ...d2));
  let p2 = this.mod._pg_initdb();
  if (!p2) throw new Error("INITDB failed to return value");
  if (p2 & 1) throw new Error("INITDB failed");
  if (p2 & 2) {
    let d2 = r2.username ?? "postgres", g2 = r2.database ?? "template1";
    if (p2 & 4) {
      if (!(p2 & 12)) throw new Error("Invalid db/user combination");
    } else if (g2 !== "template1" && d2 !== "postgres") throw new Error("INITDB created a new datadir, but an alternative db/user was requested");
  }
  await this.syncToFs(), x$2(this, Y, true), await this.exec("SET search_path TO public;"), await this._initArrayTypes();
  for (let d2 of o2) await d2();
}, re = function(...r2) {
  this.debug > 0 && console.log(...r2);
};
var Ue = pe;
u$1();
class PglitePreparedQuery extends PgPreparedQuery {
  constructor(client, queryString, params, logger, fields, name2, _isResponseInArrayMode, customResultMapper) {
    super({ sql: queryString, params });
    this.client = client;
    this.queryString = queryString;
    this.params = params;
    this.logger = logger;
    this.fields = fields;
    this._isResponseInArrayMode = _isResponseInArrayMode;
    this.customResultMapper = customResultMapper;
    this.rawQueryConfig = {
      rowMode: "object",
      parsers: {
        [hn.TIMESTAMP]: (value) => value,
        [hn.TIMESTAMPTZ]: (value) => value,
        [hn.INTERVAL]: (value) => value,
        [hn.DATE]: (value) => value,
        // numeric[]
        [1231]: (value) => value,
        // timestamp[]
        [1115]: (value) => value,
        // timestamp with timezone[]
        [1185]: (value) => value,
        // interval[]
        [1187]: (value) => value,
        // date[]
        [1182]: (value) => value
      }
    };
    this.queryConfig = {
      rowMode: "array",
      parsers: {
        [hn.TIMESTAMP]: (value) => value,
        [hn.TIMESTAMPTZ]: (value) => value,
        [hn.INTERVAL]: (value) => value,
        [hn.DATE]: (value) => value,
        // numeric[]
        [1231]: (value) => value,
        // timestamp[]
        [1115]: (value) => value,
        // timestamp with timezone[]
        [1185]: (value) => value,
        // interval[]
        [1187]: (value) => value,
        // date[]
        [1182]: (value) => value
      }
    };
  }
  static [entityKind] = "PglitePreparedQuery";
  rawQueryConfig;
  queryConfig;
  async execute(placeholderValues = {}) {
    const params = fillPlaceholders(this.params, placeholderValues);
    this.logger.logQuery(this.queryString, params);
    const { fields, rawQueryConfig, client, queryConfig, joinsNotNullableMap, customResultMapper, queryString } = this;
    if (!fields && !customResultMapper) {
      return client.query(queryString, params, rawQueryConfig);
    }
    const result = await client.query(queryString, params, queryConfig);
    return customResultMapper ? customResultMapper(result.rows) : result.rows.map((row) => mapResultRow(fields, row, joinsNotNullableMap));
  }
  all(placeholderValues = {}) {
    const params = fillPlaceholders(this.params, placeholderValues);
    this.logger.logQuery(this.queryString, params);
    return this.client.query(this.queryString, params, this.rawQueryConfig).then((result) => result.rows);
  }
  /** @internal */
  isResponseInArrayMode() {
    return this._isResponseInArrayMode;
  }
}
class PgliteSession extends PgSession {
  constructor(client, dialect, schema2, options = {}) {
    super(dialect);
    this.client = client;
    this.schema = schema2;
    this.options = options;
    this.logger = options.logger ?? new NoopLogger();
  }
  static [entityKind] = "PgliteSession";
  logger;
  prepareQuery(query, fields, name2, isResponseInArrayMode, customResultMapper) {
    return new PglitePreparedQuery(
      this.client,
      query.sql,
      query.params,
      this.logger,
      fields,
      name2,
      isResponseInArrayMode,
      customResultMapper
    );
  }
  async transaction(transaction, config) {
    return this.client.transaction(async (client) => {
      const session2 = new PgliteSession(
        client,
        this.dialect,
        this.schema,
        this.options
      );
      const tx = new PgliteTransaction(this.dialect, session2, this.schema);
      if (config) {
        await tx.setTransaction(config);
      }
      return transaction(tx);
    });
  }
  async count(sql2) {
    const res = await this.execute(sql2);
    return Number(
      res["rows"][0]["count"]
    );
  }
}
class PgliteTransaction extends PgTransaction {
  static [entityKind] = "PgliteTransaction";
  async transaction(transaction) {
    const savepointName = `sp${this.nestedIndex + 1}`;
    const tx = new PgliteTransaction(
      this.dialect,
      this.session,
      this.schema,
      this.nestedIndex + 1
    );
    await tx.execute(sql.raw(`savepoint ${savepointName}`));
    try {
      const result = await transaction(tx);
      await tx.execute(sql.raw(`release savepoint ${savepointName}`));
      return result;
    } catch (err2) {
      await tx.execute(sql.raw(`rollback to savepoint ${savepointName}`));
      throw err2;
    }
  }
}
class PgliteDriver {
  constructor(client, dialect, options = {}) {
    this.client = client;
    this.dialect = dialect;
    this.options = options;
  }
  static [entityKind] = "PgliteDriver";
  createSession(schema2) {
    return new PgliteSession(this.client, this.dialect, schema2, { logger: this.options.logger });
  }
}
class PgliteDatabase extends PgDatabase {
  static [entityKind] = "PgliteDatabase";
}
function construct(client, config = {}) {
  const dialect = new PgDialect({ casing: config.casing });
  let logger;
  if (config.logger === true) {
    logger = new DefaultLogger();
  } else if (config.logger !== false) {
    logger = config.logger;
  }
  let schema2;
  if (config.schema) {
    const tablesConfig = extractTablesRelationalConfig(
      config.schema,
      createTableRelationsHelpers
    );
    schema2 = {
      fullSchema: config.schema,
      schema: tablesConfig.tables,
      tableNamesMap: tablesConfig.tableNamesMap
    };
  }
  const driver = new PgliteDriver(client, dialect, { logger });
  const session2 = driver.createSession(schema2);
  const db = new PgliteDatabase(dialect, session2, schema2);
  db.$client = client;
  return db;
}
function drizzle(...params) {
  if (params[0] === void 0 || typeof params[0] === "string") {
    const instance2 = new Ue(params[0]);
    return construct(instance2, params[1]);
  }
  if (isConfig(params[0])) {
    const { connection: connection2, client, ...drizzleConfig } = params[0];
    if (client)
      return construct(client, drizzleConfig);
    if (typeof connection2 === "object") {
      const { dataDir, ...options } = connection2;
      const instance22 = new Ue(dataDir, options);
      return construct(instance22, drizzleConfig);
    }
    const instance2 = new Ue(connection2);
    return construct(instance2, drizzleConfig);
  }
  return construct(params[0], params[1]);
}
((drizzle2) => {
  function mock(config) {
    return construct({}, config);
  }
  drizzle2.mock = mock;
})(drizzle || (drizzle = {}));
function createPgliteConnection(dataPath) {
  const client = new Ue(dataPath);
  return drizzle(client, { schema });
}
async function listNotes$1(db, userId) {
  return db.select().from(notes).where(eq(notes.userId, userId)).orderBy(desc(notes.updatedAt));
}
async function getNoteById(db, id, userId) {
  const rows = await db.select().from(notes).where(and(eq(notes.id, id), eq(notes.userId, userId))).limit(1);
  return rows[0] ?? null;
}
async function createNote$1(db, userId, data) {
  const [row] = await db.insert(notes).values({
    userId,
    title: data.title,
    content: data.content ?? ""
  }).returning();
  return row;
}
async function updateNote$1(db, id, userId, data) {
  const [row] = await db.update(notes).set({
    ...data,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(and(eq(notes.id, id), eq(notes.userId, userId))).returning();
  return row ?? null;
}
async function deleteNote$1(db, id, userId) {
  const [row] = await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, userId))).returning();
  return row ?? null;
}
const DEFAULT_PROFILE_ID = "default-local-profile";
async function getOrCreateLocalProfile(db) {
  const existing = await db.select().from(localProfile).where(eq(localProfile.id, DEFAULT_PROFILE_ID)).limit(1);
  if (existing[0]) {
    return { id: existing[0].id };
  }
  const [row] = await db.insert(localProfile).values({
    id: DEFAULT_PROFILE_ID,
    name: "Local User"
  }).returning();
  return { id: row.id };
}
function readMigrationFiles(config) {
  const migrationFolderTo = config.migrationsFolder;
  const migrationQueries = [];
  const journalPath = `${migrationFolderTo}/meta/_journal.json`;
  if (!fs.existsSync(journalPath)) {
    throw new Error(`Can't find meta/_journal.json file`);
  }
  const journalAsString = fs.readFileSync(`${migrationFolderTo}/meta/_journal.json`).toString();
  const journal = JSON.parse(journalAsString);
  for (const journalEntry of journal.entries) {
    const migrationPath = `${migrationFolderTo}/${journalEntry.tag}.sql`;
    try {
      const query = fs.readFileSync(`${migrationFolderTo}/${journalEntry.tag}.sql`).toString();
      const result = query.split("--> statement-breakpoint").map((it2) => {
        return it2;
      });
      migrationQueries.push({
        sql: result,
        bps: journalEntry.breakpoints,
        folderMillis: journalEntry.when,
        hash: crypto$2.createHash("sha256").update(query).digest("hex")
      });
    } catch {
      throw new Error(`No file ${migrationPath} found in ${migrationFolderTo} folder`);
    }
  }
  return migrationQueries;
}
async function migrate(db, config) {
  const migrations = readMigrationFiles(config);
  await db.dialect.migrate(migrations, db.session, config);
}
async function migratePglite(db, migrationsFolder) {
  await migrate(db, { migrationsFolder });
}
async function listNotes(db, userId) {
  return listNotes$1(db, userId);
}
async function getNote(db, id, userId) {
  return getNoteById(db, id, userId);
}
async function createNote(db, userId, data) {
  return createNote$1(db, userId, {
    title: data.title,
    content: data.content ?? ""
  });
}
async function updateNote(db, id, userId, data) {
  return updateNote$1(db, id, userId, data);
}
async function deleteNote(db, id, userId) {
  return deleteNote$1(db, id, userId);
}
var util;
(function(util2) {
  util2.assertEqual = (_2) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k2) => typeof obj[obj[k2]] !== "number");
    const filtered = {};
    for (const k2 of validKeys) {
      filtered[k2] = obj[k2];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_2, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
const ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
const getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};
const ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
class ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i2 = 0;
          while (i2 < issue.path.length) {
            const el = issue.path[i2];
            const terminal = i2 === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i2++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
}
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};
const errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
let overrideErrorMap = errorMap;
function getErrorMap() {
  return overrideErrorMap;
}
const makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m2) => !!m2).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === errorMap ? void 0 : errorMap
      // then global default map
    ].filter((x2) => !!x2)
  });
  ctx.common.issues.push(issue);
}
class ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s2 of results) {
      if (s2.status === "aborted")
        return INVALID;
      if (s2.status === "dirty")
        status.dirty();
      arrayValue.push(s2.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
}
const INVALID = Object.freeze({
  status: "aborted"
});
const DIRTY = (value) => ({ status: "dirty", value });
const OK = (value) => ({ status: "valid", value });
const isAborted = (x2) => x2.status === "aborted";
const isDirty = (x2) => x2.status === "dirty";
const isValid = (x2) => x2.status === "valid";
const isAsync = (x2) => typeof Promise !== "undefined" && x2 instanceof Promise;
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));
class ParseInputLazyPath {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
}
const handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
class ZodType {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err2) {
        if (err2?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
}
const cuidRegex = /^c[^\s-]{8,}$/i;
const cuid2Regex = /^[0-9a-z]+$/;
const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
const nanoidRegex = /^[a-z0-9_-]{21}$/i;
const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
const durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
const emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
const _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
let emojiRegex;
const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
const ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
const base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
const base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
const dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
const dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args2) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args2.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args2.precision}}`;
  } else if (args2.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args2.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args2) {
  return new RegExp(`^${timeRegexSource(args2)}$`);
}
function datetimeRegex(args2) {
  let regex = `${dateRegexSource}T${timeRegexSource(args2)}`;
  const opts = [];
  opts.push(args2.local ? `Z?` : `Z`);
  if (args2.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
class ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
}
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
class ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
}
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
class ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
}
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
class ZodBoolean extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
class ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
}
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
class ZodSymbol extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
class ZodUndefined extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
class ZodNull extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
class ZodAny extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
}
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
class ZodUnknown extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
}
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
class ZodNever extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
}
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
class ZodVoid extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
class ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i2) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i2));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i2) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i2));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
}
ZodArray.create = (schema2, params) => {
  return new ZodArray({
    type: schema2,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema2) {
  if (schema2 instanceof ZodObject) {
    const newShape = {};
    for (const key in schema2.shape) {
      const fieldSchema = schema2.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema2._def,
      shape: () => newShape
    });
  } else if (schema2 instanceof ZodArray) {
    return new ZodArray({
      ...schema2._def,
      type: deepPartialify(schema2.element)
    });
  } else if (schema2 instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema2.unwrap()));
  } else if (schema2 instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema2.unwrap()));
  } else if (schema2 instanceof ZodTuple) {
    return ZodTuple.create(schema2.items.map((item) => deepPartialify(item)));
  } else {
    return schema2;
  }
}
class ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") ;
      else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema2) {
    return this.augment({ [key]: schema2 });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
}
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
class ZodUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
}
ZodUnion.create = (types2, params) => {
  return new ZodUnion({
    options: types2,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
function mergeValues(a2, b2) {
  const aType = getParsedType(a2);
  const bType = getParsedType(b2);
  if (a2 === b2) {
    return { valid: true, data: a2 };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b2);
    const sharedKeys = util.objectKeys(a2).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a2, ...b2 };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a2[key], b2[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a2.length !== b2.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a2.length; index++) {
      const itemA = a2[index];
      const itemB = b2[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a2 === +b2) {
    return { valid: true, data: a2 };
  } else {
    return { valid: false };
  }
}
class ZodIntersection extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
}
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
class ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema2 = this._def.items[itemIndex] || this._def.rest;
      if (!schema2)
        return null;
      return schema2._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x2) => !!x2);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new ZodTuple({
      ...this._def,
      rest
    });
  }
}
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
class ZodMap extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
}
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
class ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i2) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i2)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size2, message) {
    return this.min(size2, message).max(size2, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
}
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
class ZodLazy extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
}
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
class ZodLiteral extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
}
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values2, params) {
  return new ZodEnum({
    values: values2,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
class ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values2, newDef = this._def) {
    return ZodEnum.create(values2, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values2, newDef = this._def) {
    return ZodEnum.create(this.options.filter((opt) => !values2.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
}
ZodEnum.create = createZodEnum;
class ZodNativeEnum extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
}
ZodNativeEnum.create = (values2, params) => {
  return new ZodNativeEnum({
    values: values2,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
class ZodPromise extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
}
ZodPromise.create = (schema2, params) => {
  return new ZodPromise({
    type: schema2,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
class ZodEffects extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
}
ZodEffects.create = (schema2, effect, params) => {
  return new ZodEffects({
    schema: schema2,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema2, params) => {
  return new ZodEffects({
    schema: schema2,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
class ZodOptional extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
class ZodNullable extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
class ZodDefault extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
}
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
class ZodCatch extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
}
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
class ZodNaN extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
}
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
class ZodBranded extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
}
class ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a2, b2) {
    return new ZodPipeline({
      in: a2,
      out: b2,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
}
class ZodReadonly extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
const stringType = ZodString.create;
ZodNumber.create;
ZodBigInt.create;
ZodBoolean.create;
ZodDate.create;
ZodNever.create;
ZodArray.create;
const objectType = ZodObject.create;
ZodUnion.create;
ZodIntersection.create;
ZodTuple.create;
ZodEnum.create;
ZodPromise.create;
ZodOptional.create;
ZodNullable.create;
const coerce = {
  string: (arg) => ZodString.create({ ...arg, coerce: true }),
  number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
  boolean: (arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  }),
  bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
  date: (arg) => ZodDate.create({ ...arg, coerce: true })
};
const createNoteSchema = objectType({
  title: stringType().min(1).max(500),
  content: stringType().max(5e4).optional().default("")
});
const updateNoteSchema = objectType({
  title: stringType().min(1).max(500).optional(),
  content: stringType().max(5e4).optional()
});
objectType({
  id: stringType().uuid(),
  userId: stringType(),
  title: stringType(),
  content: stringType(),
  createdAt: coerce.date(),
  updatedAt: coerce.date()
});
function noteToResponse(row) {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
function createNotesRoute(db, getUserContext) {
  const app2 = new Hono();
  app2.get("/notes", async (c2) => {
    const user2 = await Promise.resolve(getUserContext(c2));
    if (!user2) return c2.json({ error: "Unauthorized" }, 401);
    const list = await listNotes(db, user2.userId);
    return c2.json(list.map(noteToResponse));
  });
  app2.get("/notes/:id", async (c2) => {
    const user2 = await Promise.resolve(getUserContext(c2));
    if (!user2) return c2.json({ error: "Unauthorized" }, 401);
    const id = c2.req.param("id");
    const note = await getNote(db, id, user2.userId);
    if (!note) return c2.json({ error: "Not found" }, 404);
    return c2.json(noteToResponse(note));
  });
  app2.post("/notes", async (c2) => {
    const user2 = await Promise.resolve(getUserContext(c2));
    if (!user2) return c2.json({ error: "Unauthorized" }, 401);
    const body2 = await c2.req.json();
    const parsed = createNoteSchema.safeParse(body2);
    if (!parsed.success) {
      return c2.json({ error: "Validation failed", issues: parsed.error.issues }, 400);
    }
    const note = await createNote(db, user2.userId, parsed.data);
    return c2.json(noteToResponse(note), 201);
  });
  app2.patch("/notes/:id", async (c2) => {
    const user2 = await Promise.resolve(getUserContext(c2));
    if (!user2) return c2.json({ error: "Unauthorized" }, 401);
    const id = c2.req.param("id");
    const body2 = await c2.req.json();
    const parsed = updateNoteSchema.safeParse(body2);
    if (!parsed.success) {
      return c2.json({ error: "Validation failed", issues: parsed.error.issues }, 400);
    }
    const note = await updateNote(db, id, user2.userId, parsed.data);
    if (!note) return c2.json({ error: "Not found" }, 404);
    return c2.json(noteToResponse(note));
  });
  app2.delete("/notes/:id", async (c2) => {
    const user2 = await Promise.resolve(getUserContext(c2));
    if (!user2) return c2.json({ error: "Unauthorized" }, 401);
    const id = c2.req.param("id");
    const note = await deleteNote(db, id, user2.userId);
    if (!note) return c2.json({ error: "Not found" }, 404);
    return c2.json({ ok: true });
  });
  return app2;
}
function createCoreRouter(options) {
  const { db, getUserContext, runtimeConfig } = options;
  const app2 = new Hono();
  app2.route("/", createHealthRoute());
  app2.route("/", createConfigRoute(runtimeConfig));
  app2.route("/", createNotesRoute(db, getUserContext));
  return app2;
}
var RequestError = class extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "RequestError";
  }
};
var toRequestError = (e) => {
  if (e instanceof RequestError) {
    return e;
  }
  return new RequestError(e.message, { cause: e });
};
var GlobalRequest = global.Request;
var Request$1 = class Request2 extends GlobalRequest {
  constructor(input, options) {
    if (typeof input === "object" && getRequestCache in input) {
      input = input[getRequestCache]();
    }
    if (typeof options?.body?.getReader !== "undefined") {
      options.duplex ??= "half";
    }
    super(input, options);
  }
};
var newHeadersFromIncoming = (incoming) => {
  const headerRecord = [];
  const rawHeaders = incoming.rawHeaders;
  for (let i2 = 0; i2 < rawHeaders.length; i2 += 2) {
    const { [i2]: key, [i2 + 1]: value } = rawHeaders;
    if (key.charCodeAt(0) !== /*:*/
    58) {
      headerRecord.push([key, value]);
    }
  }
  return new Headers(headerRecord);
};
var wrapBodyStream = Symbol("wrapBodyStream");
var newRequestFromIncoming = (method, url, headers, incoming, abortController) => {
  const init2 = {
    method,
    headers,
    signal: abortController.signal
  };
  if (method === "TRACE") {
    init2.method = "GET";
    const req = new Request$1(url, init2);
    Object.defineProperty(req, "method", {
      get() {
        return "TRACE";
      }
    });
    return req;
  }
  if (!(method === "GET" || method === "HEAD")) {
    if ("rawBody" in incoming && incoming.rawBody instanceof Buffer) {
      init2.body = new ReadableStream({
        start(controller) {
          controller.enqueue(incoming.rawBody);
          controller.close();
        }
      });
    } else if (incoming[wrapBodyStream]) {
      let reader;
      init2.body = new ReadableStream({
        async pull(controller) {
          try {
            reader ||= Readable.toWeb(incoming).getReader();
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
            } else {
              controller.enqueue(value);
            }
          } catch (error) {
            controller.error(error);
          }
        }
      });
    } else {
      init2.body = Readable.toWeb(incoming);
    }
  }
  return new Request$1(url, init2);
};
var getRequestCache = Symbol("getRequestCache");
var requestCache = Symbol("requestCache");
var incomingKey = Symbol("incomingKey");
var urlKey = Symbol("urlKey");
var headersKey = Symbol("headersKey");
var abortControllerKey = Symbol("abortControllerKey");
var getAbortController = Symbol("getAbortController");
var requestPrototype = {
  get method() {
    return this[incomingKey].method || "GET";
  },
  get url() {
    return this[urlKey];
  },
  get headers() {
    return this[headersKey] ||= newHeadersFromIncoming(this[incomingKey]);
  },
  [getAbortController]() {
    this[getRequestCache]();
    return this[abortControllerKey];
  },
  [getRequestCache]() {
    this[abortControllerKey] ||= new AbortController();
    return this[requestCache] ||= newRequestFromIncoming(
      this.method,
      this[urlKey],
      this.headers,
      this[incomingKey],
      this[abortControllerKey]
    );
  }
};
[
  "body",
  "bodyUsed",
  "cache",
  "credentials",
  "destination",
  "integrity",
  "mode",
  "redirect",
  "referrer",
  "referrerPolicy",
  "signal",
  "keepalive"
].forEach((k2) => {
  Object.defineProperty(requestPrototype, k2, {
    get() {
      return this[getRequestCache]()[k2];
    }
  });
});
["arrayBuffer", "blob", "clone", "formData", "json", "text"].forEach((k2) => {
  Object.defineProperty(requestPrototype, k2, {
    value: function() {
      return this[getRequestCache]()[k2]();
    }
  });
});
Object.setPrototypeOf(requestPrototype, Request$1.prototype);
var newRequest = (incoming, defaultHostname) => {
  const req = Object.create(requestPrototype);
  req[incomingKey] = incoming;
  const incomingUrl = incoming.url || "";
  if (incomingUrl[0] !== "/" && // short-circuit for performance. most requests are relative URL.
  (incomingUrl.startsWith("http://") || incomingUrl.startsWith("https://"))) {
    if (incoming instanceof Http2ServerRequest) {
      throw new RequestError("Absolute URL for :path is not allowed in HTTP/2");
    }
    try {
      const url2 = new URL(incomingUrl);
      req[urlKey] = url2.href;
    } catch (e) {
      throw new RequestError("Invalid absolute URL", { cause: e });
    }
    return req;
  }
  const host = (incoming instanceof Http2ServerRequest ? incoming.authority : incoming.headers.host) || defaultHostname;
  if (!host) {
    throw new RequestError("Missing host header");
  }
  let scheme;
  if (incoming instanceof Http2ServerRequest) {
    scheme = incoming.scheme;
    if (!(scheme === "http" || scheme === "https")) {
      throw new RequestError("Unsupported scheme");
    }
  } else {
    scheme = incoming.socket && incoming.socket.encrypted ? "https" : "http";
  }
  const url = new URL(`${scheme}://${host}${incomingUrl}`);
  if (url.hostname.length !== host.length && url.hostname !== host.replace(/:\d+$/, "")) {
    throw new RequestError("Invalid host header");
  }
  req[urlKey] = url.href;
  return req;
};
var responseCache = Symbol("responseCache");
var getResponseCache = Symbol("getResponseCache");
var cacheKey = Symbol("cache");
var GlobalResponse = global.Response;
var Response2 = class _Response {
  #body;
  #init;
  [getResponseCache]() {
    delete this[cacheKey];
    return this[responseCache] ||= new GlobalResponse(this.#body, this.#init);
  }
  constructor(body2, init2) {
    let headers;
    this.#body = body2;
    if (init2 instanceof _Response) {
      const cachedGlobalResponse = init2[responseCache];
      if (cachedGlobalResponse) {
        this.#init = cachedGlobalResponse;
        this[getResponseCache]();
        return;
      } else {
        this.#init = init2.#init;
        headers = new Headers(init2.#init.headers);
      }
    } else {
      this.#init = init2;
    }
    if (typeof body2 === "string" || typeof body2?.getReader !== "undefined" || body2 instanceof Blob || body2 instanceof Uint8Array) {
      this[cacheKey] = [init2?.status || 200, body2, headers || init2?.headers];
    }
  }
  get headers() {
    const cache = this[cacheKey];
    if (cache) {
      if (!(cache[2] instanceof Headers)) {
        cache[2] = new Headers(
          cache[2] || { "content-type": "text/plain; charset=UTF-8" }
        );
      }
      return cache[2];
    }
    return this[getResponseCache]().headers;
  }
  get status() {
    return this[cacheKey]?.[0] ?? this[getResponseCache]().status;
  }
  get ok() {
    const status = this.status;
    return status >= 200 && status < 300;
  }
};
["body", "bodyUsed", "redirected", "statusText", "trailers", "type", "url"].forEach((k2) => {
  Object.defineProperty(Response2.prototype, k2, {
    get() {
      return this[getResponseCache]()[k2];
    }
  });
});
["arrayBuffer", "blob", "clone", "formData", "json", "text"].forEach((k2) => {
  Object.defineProperty(Response2.prototype, k2, {
    value: function() {
      return this[getResponseCache]()[k2]();
    }
  });
});
Object.setPrototypeOf(Response2, GlobalResponse);
Object.setPrototypeOf(Response2.prototype, GlobalResponse.prototype);
async function readWithoutBlocking(readPromise) {
  return Promise.race([readPromise, Promise.resolve().then(() => Promise.resolve(void 0))]);
}
function writeFromReadableStreamDefaultReader(reader, writable, currentReadPromise) {
  const cancel = (error) => {
    reader.cancel(error).catch(() => {
    });
  };
  writable.on("close", cancel);
  writable.on("error", cancel);
  (currentReadPromise ?? reader.read()).then(flow, handleStreamError);
  return reader.closed.finally(() => {
    writable.off("close", cancel);
    writable.off("error", cancel);
  });
  function handleStreamError(error) {
    if (error) {
      writable.destroy(error);
    }
  }
  function onDrain() {
    reader.read().then(flow, handleStreamError);
  }
  function flow({ done, value }) {
    try {
      if (done) {
        writable.end();
      } else if (!writable.write(value)) {
        writable.once("drain", onDrain);
      } else {
        return reader.read().then(flow, handleStreamError);
      }
    } catch (e) {
      handleStreamError(e);
    }
  }
}
function writeFromReadableStream(stream, writable) {
  if (stream.locked) {
    throw new TypeError("ReadableStream is locked.");
  } else if (writable.destroyed) {
    return;
  }
  return writeFromReadableStreamDefaultReader(stream.getReader(), writable);
}
var buildOutgoingHttpHeaders = (headers) => {
  const res = {};
  if (!(headers instanceof Headers)) {
    headers = new Headers(headers ?? void 0);
  }
  const cookies = [];
  for (const [k2, v2] of headers) {
    if (k2 === "set-cookie") {
      cookies.push(v2);
    } else {
      res[k2] = v2;
    }
  }
  if (cookies.length > 0) {
    res["set-cookie"] = cookies;
  }
  res["content-type"] ??= "text/plain; charset=UTF-8";
  return res;
};
var X_ALREADY_SENT = "x-hono-already-sent";
if (typeof global.crypto === "undefined") {
  global.crypto = crypto$1;
}
var outgoingEnded = Symbol("outgoingEnded");
var handleRequestError = () => new Response(null, {
  status: 400
});
var handleFetchError = (e) => new Response(null, {
  status: e instanceof Error && (e.name === "TimeoutError" || e.constructor.name === "TimeoutError") ? 504 : 500
});
var handleResponseError = (e, outgoing) => {
  const err2 = e instanceof Error ? e : new Error("unknown error", { cause: e });
  if (err2.code === "ERR_STREAM_PREMATURE_CLOSE") {
    console.info("The user aborted a request.");
  } else {
    console.error(e);
    if (!outgoing.headersSent) {
      outgoing.writeHead(500, { "Content-Type": "text/plain" });
    }
    outgoing.end(`Error: ${err2.message}`);
    outgoing.destroy(err2);
  }
};
var flushHeaders = (outgoing) => {
  if ("flushHeaders" in outgoing && outgoing.writable) {
    outgoing.flushHeaders();
  }
};
var responseViaCache = async (res, outgoing) => {
  let [status, body2, header] = res[cacheKey];
  let hasContentLength = false;
  if (!header) {
    header = { "content-type": "text/plain; charset=UTF-8" };
  } else if (header instanceof Headers) {
    hasContentLength = header.has("content-length");
    header = buildOutgoingHttpHeaders(header);
  } else if (Array.isArray(header)) {
    const headerObj = new Headers(header);
    hasContentLength = headerObj.has("content-length");
    header = buildOutgoingHttpHeaders(headerObj);
  } else {
    for (const key in header) {
      if (key.length === 14 && key.toLowerCase() === "content-length") {
        hasContentLength = true;
        break;
      }
    }
  }
  if (!hasContentLength) {
    if (typeof body2 === "string") {
      header["Content-Length"] = Buffer.byteLength(body2);
    } else if (body2 instanceof Uint8Array) {
      header["Content-Length"] = body2.byteLength;
    } else if (body2 instanceof Blob) {
      header["Content-Length"] = body2.size;
    }
  }
  outgoing.writeHead(status, header);
  if (typeof body2 === "string" || body2 instanceof Uint8Array) {
    outgoing.end(body2);
  } else if (body2 instanceof Blob) {
    outgoing.end(new Uint8Array(await body2.arrayBuffer()));
  } else {
    flushHeaders(outgoing);
    await writeFromReadableStream(body2, outgoing)?.catch(
      (e) => handleResponseError(e, outgoing)
    );
  }
  outgoing[outgoingEnded]?.();
};
var isPromise = (res) => typeof res.then === "function";
var responseViaResponseObject = async (res, outgoing, options = {}) => {
  if (isPromise(res)) {
    if (options.errorHandler) {
      try {
        res = await res;
      } catch (err2) {
        const errRes = await options.errorHandler(err2);
        if (!errRes) {
          return;
        }
        res = errRes;
      }
    } else {
      res = await res.catch(handleFetchError);
    }
  }
  if (cacheKey in res) {
    return responseViaCache(res, outgoing);
  }
  const resHeaderRecord = buildOutgoingHttpHeaders(res.headers);
  if (res.body) {
    const reader = res.body.getReader();
    const values2 = [];
    let done = false;
    let currentReadPromise = void 0;
    if (resHeaderRecord["transfer-encoding"] !== "chunked") {
      let maxReadCount = 2;
      for (let i2 = 0; i2 < maxReadCount; i2++) {
        currentReadPromise ||= reader.read();
        const chunk = await readWithoutBlocking(currentReadPromise).catch((e) => {
          console.error(e);
          done = true;
        });
        if (!chunk) {
          if (i2 === 1) {
            await new Promise((resolve) => setTimeout(resolve));
            maxReadCount = 3;
            continue;
          }
          break;
        }
        currentReadPromise = void 0;
        if (chunk.value) {
          values2.push(chunk.value);
        }
        if (chunk.done) {
          done = true;
          break;
        }
      }
      if (done && !("content-length" in resHeaderRecord)) {
        resHeaderRecord["content-length"] = values2.reduce((acc, value) => acc + value.length, 0);
      }
    }
    outgoing.writeHead(res.status, resHeaderRecord);
    values2.forEach((value) => {
      outgoing.write(value);
    });
    if (done) {
      outgoing.end();
    } else {
      if (values2.length === 0) {
        flushHeaders(outgoing);
      }
      await writeFromReadableStreamDefaultReader(reader, outgoing, currentReadPromise);
    }
  } else if (resHeaderRecord[X_ALREADY_SENT]) ;
  else {
    outgoing.writeHead(res.status, resHeaderRecord);
    outgoing.end();
  }
  outgoing[outgoingEnded]?.();
};
var getRequestListener = (fetchCallback, options = {}) => {
  const autoCleanupIncoming = options.autoCleanupIncoming ?? true;
  if (options.overrideGlobalObjects !== false && global.Request !== Request$1) {
    Object.defineProperty(global, "Request", {
      value: Request$1
    });
    Object.defineProperty(global, "Response", {
      value: Response2
    });
  }
  return async (incoming, outgoing) => {
    let res, req;
    try {
      req = newRequest(incoming, options.hostname);
      let incomingEnded = !autoCleanupIncoming || incoming.method === "GET" || incoming.method === "HEAD";
      if (!incomingEnded) {
        ;
        incoming[wrapBodyStream] = true;
        incoming.on("end", () => {
          incomingEnded = true;
        });
        if (incoming instanceof Http2ServerRequest) {
          ;
          outgoing[outgoingEnded] = () => {
            if (!incomingEnded) {
              setTimeout(() => {
                if (!incomingEnded) {
                  setTimeout(() => {
                    incoming.destroy();
                    outgoing.destroy();
                  });
                }
              });
            }
          };
        }
      }
      outgoing.on("close", () => {
        const abortController = req[abortControllerKey];
        if (abortController) {
          if (incoming.errored) {
            req[abortControllerKey].abort(incoming.errored.toString());
          } else if (!outgoing.writableFinished) {
            req[abortControllerKey].abort("Client connection prematurely closed.");
          }
        }
        if (!incomingEnded) {
          setTimeout(() => {
            if (!incomingEnded) {
              setTimeout(() => {
                incoming.destroy();
              });
            }
          });
        }
      });
      res = fetchCallback(req, { incoming, outgoing });
      if (cacheKey in res) {
        return responseViaCache(res, outgoing);
      }
    } catch (e) {
      if (!res) {
        if (options.errorHandler) {
          res = await options.errorHandler(req ? e : toRequestError(e));
          if (!res) {
            return;
          }
        } else if (!req) {
          res = handleRequestError();
        } else {
          res = handleFetchError(e);
        }
      } else {
        return handleResponseError(e, outgoing);
      }
    }
    try {
      return await responseViaResponseObject(res, outgoing, options);
    } catch (e) {
      return handleResponseError(e, outgoing);
    }
  };
};
var createAdaptorServer = (options) => {
  const fetchCallback = options.fetch;
  const requestListener = getRequestListener(fetchCallback, {
    hostname: options.hostname,
    overrideGlobalObjects: options.overrideGlobalObjects,
    autoCleanupIncoming: options.autoCleanupIncoming
  });
  const createServer$1 = options.createServer || createServer;
  const server = createServer$1(options.serverOptions || {}, requestListener);
  return server;
};
var serve = (options, listeningListener) => {
  const server = createAdaptorServer(options);
  server.listen(options?.port, options.hostname, () => {
    const serverInfo = server.address();
    listeningListener && listeningListener(serverInfo);
  });
  return server;
};
const DESKTOP_API_PORT = 3099;
const desktopRuntimeConfig = {
  deploymentMode: "desktop",
  auth: {
    enabled: false,
    providers: { emailPassword: false, google: false }
  }
};
async function createDesktopServer(dbPath, migrationsFolder) {
  const db = createPgliteConnection(dbPath);
  await migratePglite(db, migrationsFolder);
  const { id: userId } = await getOrCreateLocalProfile(db);
  const getUserContext = () => ({ userId });
  const app2 = new Hono();
  app2.route(
    "/api",
    createCoreRouter({ db, getUserContext, runtimeConfig: desktopRuntimeConfig })
  );
  serve(
    { fetch: app2.fetch, port: DESKTOP_API_PORT, hostname: "127.0.0.1" },
    (info2) => {
      console.log(`Desktop API on http://127.0.0.1:${info2.port}`);
    }
  );
  return { port: DESKTOP_API_PORT, db };
}
async function bootstrap() {
  const userDataPath = app.getPath("userData");
  const dbPath = path__default.join(userDataPath, "db");
  const migrationsFolder = process.env.NODE_ENV === "production" ? path__default.join(process.resourcesPath, "migrations") : path__default.resolve(__dirname, "../../../../packages/db/migrations");
  await createDesktopServer(dbPath, migrationsFolder);
}
function createWindow() {
  const win = new BrowserWindow({
    width: 1e3,
    height: 700,
    webPreferences: {
      preload: path__default.join(
        __dirname,
        "../preload/preload.mjs"
      ),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (process.env.ELECTRON_VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.ELECTRON_VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path__default.join(__dirname, "../renderer/index.html"));
  }
}
app.whenReady().then(async () => {
  await bootstrap();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
export {
  C,
  R$2 as R,
  T,
  U$1 as U,
  u$1 as a,
  cr as c,
  h$1 as h,
  pr as p,
  ur as u,
  x$2 as x
};

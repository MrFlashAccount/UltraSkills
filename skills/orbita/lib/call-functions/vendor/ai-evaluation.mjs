// Generated vendor bundle for the Vercel AI SDK evaluation client.
// Commit this artifact so ask_jev works from an installed Orbita plugin without package installation.
import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// node_modules/@vercel/oidc/dist/get-context.js
var require_get_context = __commonJS((exports, module) => {
  var __defProp2 = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames2 = Object.getOwnPropertyNames;
  var __hasOwnProp2 = Object.prototype.hasOwnProperty;
  var __export2 = (target, all) => {
    for (var name17 in all)
      __defProp2(target, name17, { get: all[name17], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames2(from))
        if (!__hasOwnProp2.call(to, key) && key !== except)
          __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp2({}, "__esModule", { value: true }), mod);
  var get_context_exports = {};
  __export2(get_context_exports, {
    SYMBOL_FOR_REQ_CONTEXT: () => SYMBOL_FOR_REQ_CONTEXT,
    getContext: () => getContext2
  });
  module.exports = __toCommonJS(get_context_exports);
  var SYMBOL_FOR_REQ_CONTEXT = Symbol.for("@vercel/request-context");
  function getContext2() {
    const fromSymbol = globalThis;
    return fromSymbol[SYMBOL_FOR_REQ_CONTEXT]?.get?.() ?? {};
  }
});

// node_modules/@vercel/oidc/dist/token-error.js
var require_token_error = __commonJS((exports, module) => {
  var __defProp2 = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames2 = Object.getOwnPropertyNames;
  var __hasOwnProp2 = Object.prototype.hasOwnProperty;
  var __export2 = (target, all) => {
    for (var name17 in all)
      __defProp2(target, name17, { get: all[name17], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames2(from))
        if (!__hasOwnProp2.call(to, key) && key !== except)
          __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp2({}, "__esModule", { value: true }), mod);
  var token_error_exports = {};
  __export2(token_error_exports, {
    VercelOidcTokenError: () => VercelOidcTokenError
  });
  module.exports = __toCommonJS(token_error_exports);

  class VercelOidcTokenError extends Error {
    constructor(message, cause) {
      super(message);
      this.name = "VercelOidcTokenError";
      this.cause = cause;
    }
    toString() {
      if (this.cause) {
        return `${this.name}: ${this.message}: ${this.cause}`;
      }
      return `${this.name}: ${this.message}`;
    }
  }
});

// node_modules/@vercel/oidc/dist/token-io.js
var require_token_io = __commonJS((exports, module) => {
  var __create2 = Object.create;
  var __defProp2 = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames2 = Object.getOwnPropertyNames;
  var __getProtoOf2 = Object.getPrototypeOf;
  var __hasOwnProp2 = Object.prototype.hasOwnProperty;
  var __export2 = (target, all) => {
    for (var name17 in all)
      __defProp2(target, name17, { get: all[name17], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames2(from))
        if (!__hasOwnProp2.call(to, key) && key !== except)
          __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM2 = (mod, isNodeMode, target) => (target = mod != null ? __create2(__getProtoOf2(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp2(target, "default", { value: mod, enumerable: true }) : target, mod));
  var __toCommonJS = (mod) => __copyProps(__defProp2({}, "__esModule", { value: true }), mod);
  var token_io_exports = {};
  __export2(token_io_exports, {
    findRootDir: () => findRootDir,
    getUserDataDir: () => getUserDataDir
  });
  module.exports = __toCommonJS(token_io_exports);
  var import_path = __toESM2(__require("path"));
  var import_fs = __toESM2(__require("fs"));
  var import_os = __toESM2(__require("os"));
  var import_token_error = require_token_error();
  function findRootDir() {
    try {
      let dir = process.cwd();
      while (dir !== import_path.default.dirname(dir)) {
        const pkgPath = import_path.default.join(dir, ".vercel");
        if (import_fs.default.existsSync(pkgPath)) {
          return dir;
        }
        dir = import_path.default.dirname(dir);
      }
    } catch (e) {
      throw new import_token_error.VercelOidcTokenError("Token refresh only supported in node server environments");
    }
    return null;
  }
  function getUserDataDir() {
    if (process.env.XDG_DATA_HOME) {
      return process.env.XDG_DATA_HOME;
    }
    switch (import_os.default.platform()) {
      case "darwin":
        return import_path.default.join(import_os.default.homedir(), "Library/Application Support");
      case "linux":
        return import_path.default.join(import_os.default.homedir(), ".local/share");
      case "win32":
        if (process.env.LOCALAPPDATA) {
          return process.env.LOCALAPPDATA;
        }
        return null;
      default:
        return null;
    }
  }
});

// node_modules/@vercel/oidc/dist/auth-config.js
var require_auth_config = __commonJS((exports, module) => {
  var __create2 = Object.create;
  var __defProp2 = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames2 = Object.getOwnPropertyNames;
  var __getProtoOf2 = Object.getPrototypeOf;
  var __hasOwnProp2 = Object.prototype.hasOwnProperty;
  var __export2 = (target, all) => {
    for (var name17 in all)
      __defProp2(target, name17, { get: all[name17], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames2(from))
        if (!__hasOwnProp2.call(to, key) && key !== except)
          __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM2 = (mod, isNodeMode, target) => (target = mod != null ? __create2(__getProtoOf2(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp2(target, "default", { value: mod, enumerable: true }) : target, mod));
  var __toCommonJS = (mod) => __copyProps(__defProp2({}, "__esModule", { value: true }), mod);
  var auth_config_exports = {};
  __export2(auth_config_exports, {
    isValidAccessToken: () => isValidAccessToken,
    readAuthConfig: () => readAuthConfig,
    writeAuthConfig: () => writeAuthConfig
  });
  module.exports = __toCommonJS(auth_config_exports);
  var fs = __toESM2(__require("fs"));
  var path = __toESM2(__require("path"));
  var import_token_util = require_token_util();
  function getAuthConfigPath() {
    const dataDir = (0, import_token_util.getVercelDataDir)();
    if (!dataDir) {
      throw new Error(`Unable to find Vercel CLI data directory. Your platform: ${process.platform}. Supported: darwin, linux, win32.`);
    }
    return path.join(dataDir, "auth.json");
  }
  function readAuthConfig() {
    try {
      const authPath = getAuthConfigPath();
      if (!fs.existsSync(authPath)) {
        return null;
      }
      const content = fs.readFileSync(authPath, "utf8");
      if (!content) {
        return null;
      }
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }
  function writeAuthConfig(config2) {
    const authPath = getAuthConfigPath();
    const authDir = path.dirname(authPath);
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { mode: 504, recursive: true });
    }
    fs.writeFileSync(authPath, JSON.stringify(config2, null, 2), { mode: 384 });
  }
  function isValidAccessToken(authConfig, expirationBufferMs = 0) {
    if (!authConfig.token)
      return false;
    if (typeof authConfig.expiresAt !== "number")
      return true;
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const bufferInSeconds = expirationBufferMs / 1000;
    return authConfig.expiresAt >= nowInSeconds + bufferInSeconds;
  }
});

// node_modules/@vercel/oidc/dist/oauth.js
var require_oauth = __commonJS((exports, module) => {
  var __defProp2 = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames2 = Object.getOwnPropertyNames;
  var __hasOwnProp2 = Object.prototype.hasOwnProperty;
  var __export2 = (target, all) => {
    for (var name17 in all)
      __defProp2(target, name17, { get: all[name17], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames2(from))
        if (!__hasOwnProp2.call(to, key) && key !== except)
          __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp2({}, "__esModule", { value: true }), mod);
  var oauth_exports = {};
  __export2(oauth_exports, {
    processTokenResponse: () => processTokenResponse,
    refreshTokenRequest: () => refreshTokenRequest
  });
  module.exports = __toCommonJS(oauth_exports);
  var import_os = __require("os");
  var VERCEL_ISSUER = "https://vercel.com";
  var VERCEL_CLI_CLIENT_ID = "cl_HYyOPBNtFMfHhaUn9L4QPfTZz6TP47bp";
  var userAgent = `@vercel/oidc node-${process.version} ${(0, import_os.platform)()} (${(0, import_os.arch)()}) ${(0, import_os.hostname)()}`;
  var _tokenEndpoint = null;
  async function getTokenEndpoint() {
    if (_tokenEndpoint) {
      return _tokenEndpoint;
    }
    const discoveryUrl = `${VERCEL_ISSUER}/.well-known/openid-configuration`;
    const response = await fetch(discoveryUrl, {
      headers: { "user-agent": userAgent }
    });
    if (!response.ok) {
      throw new Error("Failed to discover OAuth endpoints");
    }
    const metadata = await response.json();
    if (!metadata || typeof metadata.token_endpoint !== "string") {
      throw new Error("Invalid OAuth discovery response");
    }
    const endpoint = metadata.token_endpoint;
    _tokenEndpoint = endpoint;
    return endpoint;
  }
  async function refreshTokenRequest(options) {
    const tokenEndpoint = await getTokenEndpoint();
    return await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "user-agent": userAgent
      },
      body: new URLSearchParams({
        client_id: VERCEL_CLI_CLIENT_ID,
        grant_type: "refresh_token",
        ...options
      })
    });
  }
  async function processTokenResponse(response) {
    const json = await response.json();
    if (!response.ok) {
      const errorMsg = typeof json === "object" && json && "error" in json ? String(json.error) : "Token refresh failed";
      return [new Error(errorMsg)];
    }
    if (typeof json !== "object" || json === null) {
      return [new Error("Invalid token response")];
    }
    if (typeof json.access_token !== "string") {
      return [new Error("Missing access_token in response")];
    }
    if (json.token_type !== "Bearer") {
      return [new Error("Invalid token_type in response")];
    }
    if (typeof json.expires_in !== "number") {
      return [new Error("Missing expires_in in response")];
    }
    return [null, json];
  }
});

// node_modules/@vercel/oidc/dist/auth-errors.js
var require_auth_errors = __commonJS((exports, module) => {
  var __defProp2 = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames2 = Object.getOwnPropertyNames;
  var __hasOwnProp2 = Object.prototype.hasOwnProperty;
  var __export2 = (target, all) => {
    for (var name17 in all)
      __defProp2(target, name17, { get: all[name17], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames2(from))
        if (!__hasOwnProp2.call(to, key) && key !== except)
          __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp2({}, "__esModule", { value: true }), mod);
  var auth_errors_exports = {};
  __export2(auth_errors_exports, {
    AccessTokenMissingError: () => AccessTokenMissingError2,
    RefreshAccessTokenFailedError: () => RefreshAccessTokenFailedError2
  });
  module.exports = __toCommonJS(auth_errors_exports);

  class AccessTokenMissingError2 extends Error {
    constructor() {
      super("No authentication found. Please log in with the Vercel CLI (vercel login).");
      this.name = "AccessTokenMissingError";
    }
  }

  class RefreshAccessTokenFailedError2 extends Error {
    constructor(cause) {
      super("Failed to refresh authentication token.", { cause });
      this.name = "RefreshAccessTokenFailedError";
    }
  }
});

// node_modules/@vercel/oidc/dist/token-util.js
var require_token_util = __commonJS((exports, module) => {
  var __create2 = Object.create;
  var __defProp2 = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames2 = Object.getOwnPropertyNames;
  var __getProtoOf2 = Object.getPrototypeOf;
  var __hasOwnProp2 = Object.prototype.hasOwnProperty;
  var __export2 = (target, all) => {
    for (var name17 in all)
      __defProp2(target, name17, { get: all[name17], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames2(from))
        if (!__hasOwnProp2.call(to, key) && key !== except)
          __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM2 = (mod, isNodeMode, target) => (target = mod != null ? __create2(__getProtoOf2(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp2(target, "default", { value: mod, enumerable: true }) : target, mod));
  var __toCommonJS = (mod) => __copyProps(__defProp2({}, "__esModule", { value: true }), mod);
  var token_util_exports = {};
  __export2(token_util_exports, {
    assertVercelOidcTokenResponse: () => assertVercelOidcTokenResponse,
    findProjectInfo: () => findProjectInfo,
    getTokenPayload: () => getTokenPayload,
    getVercelDataDir: () => getVercelDataDir,
    getVercelOidcToken: () => getVercelOidcToken2,
    getVercelToken: () => getVercelToken2,
    isExpired: () => isExpired,
    loadToken: () => loadToken,
    saveToken: () => saveToken
  });
  module.exports = __toCommonJS(token_util_exports);
  var path = __toESM2(__require("path"));
  var fs = __toESM2(__require("fs"));
  var import_token_error = require_token_error();
  var import_token_io = require_token_io();
  var import_auth_config = require_auth_config();
  var import_oauth = require_oauth();
  var import_auth_errors = require_auth_errors();
  function getVercelDataDir() {
    const vercelFolder = "com.vercel.cli";
    const dataDir = (0, import_token_io.getUserDataDir)();
    if (!dataDir) {
      return null;
    }
    return path.join(dataDir, vercelFolder);
  }
  async function getVercelToken2(options) {
    const authConfig = (0, import_auth_config.readAuthConfig)();
    if (!authConfig?.token) {
      throw new import_auth_errors.AccessTokenMissingError;
    }
    if ((0, import_auth_config.isValidAccessToken)(authConfig, options?.expirationBufferMs)) {
      return authConfig.token;
    }
    if (!authConfig.refreshToken) {
      (0, import_auth_config.writeAuthConfig)({});
      throw new import_auth_errors.RefreshAccessTokenFailedError("No refresh token available");
    }
    try {
      const tokenResponse = await (0, import_oauth.refreshTokenRequest)({
        refresh_token: authConfig.refreshToken
      });
      const [tokensError, tokens] = await (0, import_oauth.processTokenResponse)(tokenResponse);
      if (tokensError || !tokens) {
        (0, import_auth_config.writeAuthConfig)({});
        throw new import_auth_errors.RefreshAccessTokenFailedError(tokensError);
      }
      const updatedConfig = {
        token: tokens.access_token,
        expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in
      };
      if (tokens.refresh_token) {
        updatedConfig.refreshToken = tokens.refresh_token;
      }
      (0, import_auth_config.writeAuthConfig)(updatedConfig);
      return updatedConfig.token;
    } catch (error) {
      (0, import_auth_config.writeAuthConfig)({});
      if (error instanceof import_auth_errors.AccessTokenMissingError || error instanceof import_auth_errors.RefreshAccessTokenFailedError) {
        throw error;
      }
      throw new import_auth_errors.RefreshAccessTokenFailedError(error);
    }
  }
  async function getVercelOidcToken2(authToken, projectId, teamId) {
    const url = `https://api.vercel.com/v1/projects/${projectId}/token?source=vercel-oidc-refresh${teamId ? `&teamId=${teamId}` : ""}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    if (!res.ok) {
      throw new import_token_error.VercelOidcTokenError(`Failed to refresh OIDC token: ${res.statusText}`);
    }
    const tokenRes = await res.json();
    assertVercelOidcTokenResponse(tokenRes);
    return tokenRes;
  }
  function assertVercelOidcTokenResponse(res) {
    if (!res || typeof res !== "object") {
      throw new TypeError("Vercel OIDC token is malformed. Expected an object. Please run `vc env pull` and try again");
    }
    if (!("token" in res) || typeof res.token !== "string") {
      throw new TypeError("Vercel OIDC token is malformed. Expected a string-valued token property. Please run `vc env pull` and try again");
    }
  }
  function findProjectInfo() {
    const dir = (0, import_token_io.findRootDir)();
    if (!dir) {
      throw new import_token_error.VercelOidcTokenError("Unable to find project root directory. Have you linked your project with `vc link?`");
    }
    const prjPath = path.join(dir, ".vercel", "project.json");
    if (!fs.existsSync(prjPath)) {
      throw new import_token_error.VercelOidcTokenError("project.json not found, have you linked your project with `vc link?`");
    }
    const prj = JSON.parse(fs.readFileSync(prjPath, "utf8"));
    if (typeof prj.projectId !== "string" && typeof prj.orgId !== "string") {
      throw new TypeError("Expected a string-valued projectId property. Try running `vc link` to re-link your project.");
    }
    return { projectId: prj.projectId, teamId: prj.orgId };
  }
  function saveToken(token, projectId) {
    const dir = (0, import_token_io.getUserDataDir)();
    if (!dir) {
      throw new import_token_error.VercelOidcTokenError("Unable to find user data directory. Please reach out to Vercel support.");
    }
    const tokenPath = path.join(dir, "com.vercel.token", `${projectId}.json`);
    const tokenJson = JSON.stringify(token);
    fs.mkdirSync(path.dirname(tokenPath), { mode: 504, recursive: true });
    fs.writeFileSync(tokenPath, tokenJson);
    fs.chmodSync(tokenPath, 432);
    return;
  }
  function loadToken(projectId) {
    const dir = (0, import_token_io.getUserDataDir)();
    if (!dir) {
      throw new import_token_error.VercelOidcTokenError("Unable to find user data directory. Please reach out to Vercel support.");
    }
    const tokenPath = path.join(dir, "com.vercel.token", `${projectId}.json`);
    if (!fs.existsSync(tokenPath)) {
      return null;
    }
    const token = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
    assertVercelOidcTokenResponse(token);
    return token;
  }
  function getTokenPayload(token) {
    const tokenParts = token.split(".");
    if (tokenParts.length !== 3) {
      throw new import_token_error.VercelOidcTokenError("Invalid token. Please run `vc env pull` and try again");
    }
    const base642 = tokenParts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base642.padEnd(base642.length + (4 - base642.length % 4) % 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  }
  function isExpired(token, bufferMs = 0) {
    return token.exp * 1000 < Date.now() + bufferMs;
  }
});

// node_modules/@vercel/oidc/dist/token.js
var require_token = __commonJS((exports, module) => {
  var __defProp2 = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames2 = Object.getOwnPropertyNames;
  var __hasOwnProp2 = Object.prototype.hasOwnProperty;
  var __export2 = (target, all) => {
    for (var name17 in all)
      __defProp2(target, name17, { get: all[name17], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames2(from))
        if (!__hasOwnProp2.call(to, key) && key !== except)
          __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp2({}, "__esModule", { value: true }), mod);
  var token_exports = {};
  __export2(token_exports, {
    refreshToken: () => refreshToken
  });
  module.exports = __toCommonJS(token_exports);
  var import_token_error = require_token_error();
  var import_token_util = require_token_util();
  async function refreshToken(options) {
    let projectId = options?.project;
    let teamId = options?.team;
    if (!projectId && !teamId) {
      const projectInfo = (0, import_token_util.findProjectInfo)();
      projectId = projectInfo.projectId;
      teamId = projectInfo.teamId;
    } else if (!projectId || !teamId) {
      const projectInfo = (0, import_token_util.findProjectInfo)();
      projectId = projectId ?? projectInfo.projectId;
      teamId = teamId ?? projectInfo.teamId;
    }
    if (!projectId) {
      throw new import_token_error.VercelOidcTokenError("Failed to refresh OIDC token: No project specified. Try re-linking your project with `vc link`");
    }
    let maybeToken = (0, import_token_util.loadToken)(projectId);
    if (!maybeToken || (0, import_token_util.isExpired)((0, import_token_util.getTokenPayload)(maybeToken.token), options?.expirationBufferMs)) {
      const authToken = await (0, import_token_util.getVercelToken)({
        expirationBufferMs: options?.expirationBufferMs
      });
      maybeToken = await (0, import_token_util.getVercelOidcToken)(authToken, projectId, teamId);
      if (!maybeToken) {
        throw new import_token_error.VercelOidcTokenError("Failed to refresh OIDC token");
      }
      (0, import_token_util.saveToken)(maybeToken, projectId);
    }
    process.env.VERCEL_OIDC_TOKEN = maybeToken.token;
    return;
  }
});

// node_modules/@vercel/oidc/dist/get-vercel-oidc-token.js
var require_get_vercel_oidc_token = __commonJS((exports, module) => {
  var __defProp2 = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames2 = Object.getOwnPropertyNames;
  var __hasOwnProp2 = Object.prototype.hasOwnProperty;
  var __export2 = (target, all) => {
    for (var name17 in all)
      __defProp2(target, name17, { get: all[name17], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames2(from))
        if (!__hasOwnProp2.call(to, key) && key !== except)
          __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp2({}, "__esModule", { value: true }), mod);
  var get_vercel_oidc_token_exports = {};
  __export2(get_vercel_oidc_token_exports, {
    getVercelOidcToken: () => getVercelOidcToken2,
    getVercelOidcTokenSync: () => getVercelOidcTokenSync2
  });
  module.exports = __toCommonJS(get_vercel_oidc_token_exports);
  var import_get_context = require_get_context();
  var import_token_error = require_token_error();
  async function getVercelOidcToken2(options) {
    let token = "";
    let err;
    try {
      token = getVercelOidcTokenSync2();
    } catch (error) {
      err = error;
    }
    try {
      const [{ getTokenPayload, isExpired }, { refreshToken }] = await Promise.all([
        await Promise.resolve().then(() => __toESM(require_token_util())),
        await Promise.resolve().then(() => __toESM(require_token()))
      ]);
      if (!token || isExpired(getTokenPayload(token), options?.expirationBufferMs)) {
        await refreshToken(options);
        token = getVercelOidcTokenSync2();
      }
    } catch (error) {
      let message = err instanceof Error ? err.message : "";
      if (error instanceof Error) {
        message = `${message}
${error.message}`;
      }
      if (message) {
        throw new import_token_error.VercelOidcTokenError(message);
      }
      throw error;
    }
    return token;
  }
  function getVercelOidcTokenSync2() {
    const token = (0, import_get_context.getContext)().headers?.["x-vercel-oidc-token"] ?? process.env.VERCEL_OIDC_TOKEN;
    if (!token) {
      throw new Error(`The 'x-vercel-oidc-token' header is missing from the request. Do you have the OIDC option enabled in the Vercel project settings?`);
    }
    return token;
  }
});

// node_modules/@vercel/oidc/dist/index.js
var require_dist = __commonJS((exports, module) => {
  var __defProp2 = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames2 = Object.getOwnPropertyNames;
  var __hasOwnProp2 = Object.prototype.hasOwnProperty;
  var __export2 = (target, all) => {
    for (var name17 in all)
      __defProp2(target, name17, { get: all[name17], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames2(from))
        if (!__hasOwnProp2.call(to, key) && key !== except)
          __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp2({}, "__esModule", { value: true }), mod);
  var src_exports = {};
  __export2(src_exports, {
    AccessTokenMissingError: () => import_auth_errors.AccessTokenMissingError,
    RefreshAccessTokenFailedError: () => import_auth_errors.RefreshAccessTokenFailedError,
    getContext: () => import_get_context.getContext,
    getVercelOidcToken: () => import_get_vercel_oidc_token.getVercelOidcToken,
    getVercelOidcTokenSync: () => import_get_vercel_oidc_token.getVercelOidcTokenSync,
    getVercelToken: () => import_token_util.getVercelToken
  });
  module.exports = __toCommonJS(src_exports);
  var import_get_vercel_oidc_token = require_get_vercel_oidc_token();
  var import_get_context = require_get_context();
  var import_auth_errors = require_auth_errors();
  var import_token_util = require_token_util();
});

// node_modules/@ai-sdk/provider/dist/index.js
var marker = "vercel.ai.error";
var symbol = Symbol.for(marker);
var _a;
var _b;
var AISDKError = class _AISDKError extends (_b = Error, _a = symbol, _b) {
  constructor({
    name: name16,
    message,
    cause
  }) {
    super(message);
    this[_a] = true;
    this.name = name16;
    this.cause = cause;
  }
  static isInstance(error) {
    return _AISDKError.hasMarker(error, marker);
  }
  static hasMarker(error, marker17) {
    const markerSymbol = Symbol.for(marker17);
    return error != null && typeof error === "object" && markerSymbol in error && typeof error[markerSymbol] === "boolean" && error[markerSymbol] === true;
  }
};
var name = "AI_APICallError";
var marker2 = `vercel.ai.error.${name}`;
var symbol2 = Symbol.for(marker2);
var _a2;
var _b2;
var APICallError = class extends (_b2 = AISDKError, _a2 = symbol2, _b2) {
  constructor({
    message,
    url,
    requestBodyValues,
    statusCode,
    responseHeaders,
    responseBody,
    cause,
    isRetryable = statusCode != null && (statusCode === 408 || statusCode === 409 || statusCode === 429 || statusCode >= 500),
    data
  }) {
    super({ name, message, cause });
    this[_a2] = true;
    this.url = url;
    this.requestBodyValues = requestBodyValues;
    this.statusCode = statusCode;
    this.responseHeaders = responseHeaders;
    this.responseBody = responseBody;
    this.isRetryable = isRetryable;
    this.data = data;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker2);
  }
};
var name2 = "AI_EmptyResponseBodyError";
var marker3 = `vercel.ai.error.${name2}`;
var symbol3 = Symbol.for(marker3);
var _a3;
var _b3;
var EmptyResponseBodyError = class extends (_b3 = AISDKError, _a3 = symbol3, _b3) {
  constructor({ message = "Empty response body" } = {}) {
    super({ name: name2, message });
    this[_a3] = true;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker3);
  }
};
var name3 = "AI_EvaluationUnsupportedQuestionTypeError";
var marker4 = `vercel.ai.error.${name3}`;
var symbol4 = Symbol.for(marker4);
var _a4;
var _b4;
var EvaluationUnsupportedQuestionTypeError = class extends (_b4 = AISDKError, _a4 = symbol4, _b4) {
  constructor({
    questionId,
    questionType,
    provider,
    modelId,
    message = `Question "${questionId}" has type "${questionType}", which is not supported by provider "${provider}" and model "${modelId}".`
  }) {
    super({ name: name3, message });
    this[_a4] = true;
    this.questionId = questionId;
    this.questionType = questionType;
    this.provider = provider;
    this.modelId = modelId;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker4);
  }
};
function getErrorMessage(error) {
  if (error == null) {
    return "unknown error";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.toString();
  }
  return JSON.stringify(error);
}
var name4 = "AI_InvalidArgumentError";
var marker5 = `vercel.ai.error.${name4}`;
var symbol5 = Symbol.for(marker5);
var _a5;
var _b5;
var InvalidArgumentError = class extends (_b5 = AISDKError, _a5 = symbol5, _b5) {
  constructor({
    message,
    cause,
    argument
  }) {
    super({ name: name4, message, cause });
    this[_a5] = true;
    this.argument = argument;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker5);
  }
};
var name5 = "AI_InvalidPromptError";
var marker6 = `vercel.ai.error.${name5}`;
var symbol6 = Symbol.for(marker6);
var _a6;
var _b6;
var InvalidPromptError = class extends (_b6 = AISDKError, _a6 = symbol6, _b6) {
  constructor({
    prompt,
    message,
    cause
  }) {
    super({ name: name5, message: `Invalid prompt: ${message}`, cause });
    this[_a6] = true;
    this.prompt = prompt;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker6);
  }
};
var name6 = "AI_InvalidResponseDataError";
var marker7 = `vercel.ai.error.${name6}`;
var symbol7 = Symbol.for(marker7);
var _a7;
var _b7;
var InvalidResponseDataError = class extends (_b7 = AISDKError, _a7 = symbol7, _b7) {
  constructor({
    data,
    message = `Invalid response data: ${JSON.stringify(data)}.`
  }) {
    super({ name: name6, message });
    this[_a7] = true;
    this.data = data;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker7);
  }
};
var name7 = "AI_JSONParseError";
var marker8 = `vercel.ai.error.${name7}`;
var symbol8 = Symbol.for(marker8);
var _a8;
var _b8;
var JSONParseError = class extends (_b8 = AISDKError, _a8 = symbol8, _b8) {
  constructor({ text, cause }) {
    super({
      name: name7,
      message: `JSON parsing failed: Text: ${text}.
Error message: ${getErrorMessage(cause)}`,
      cause
    });
    this[_a8] = true;
    this.text = text;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker8);
  }
};
var name8 = "AI_LoadAPIKeyError";
var marker9 = `vercel.ai.error.${name8}`;
var symbol9 = Symbol.for(marker9);
var _a9;
var _b9;
var LoadAPIKeyError = class extends (_b9 = AISDKError, _a9 = symbol9, _b9) {
  constructor({ message }) {
    super({ name: name8, message });
    this[_a9] = true;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker9);
  }
};
var name9 = "AI_LoadSettingError";
var marker10 = `vercel.ai.error.${name9}`;
var symbol10 = Symbol.for(marker10);
var _a10;
var _b10;
var LoadSettingError = class extends (_b10 = AISDKError, _a10 = symbol10, _b10) {
  constructor({ message }) {
    super({ name: name9, message });
    this[_a10] = true;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker10);
  }
};
var name10 = "AI_NoContentGeneratedError";
var marker11 = `vercel.ai.error.${name10}`;
var symbol11 = Symbol.for(marker11);
var _a11;
var _b11;
var NoContentGeneratedError = class extends (_b11 = AISDKError, _a11 = symbol11, _b11) {
  constructor({
    message = "No content generated."
  } = {}) {
    super({ name: name10, message });
    this[_a11] = true;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker11);
  }
};
var name11 = "AI_NoSuchModelError";
var marker12 = `vercel.ai.error.${name11}`;
var symbol12 = Symbol.for(marker12);
var _a12;
var _b12;
var NoSuchModelError = class extends (_b12 = AISDKError, _a12 = symbol12, _b12) {
  constructor({
    errorName = name11,
    modelId,
    modelType,
    message = `No such ${modelType}: ${modelId}`
  }) {
    super({ name: errorName, message });
    this[_a12] = true;
    this.modelId = modelId;
    this.modelType = modelType;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker12);
  }
};
var name12 = "AI_NoSuchProviderReferenceError";
var marker13 = `vercel.ai.error.${name12}`;
var symbol13 = Symbol.for(marker13);
var _a13;
var _b13;
var NoSuchProviderReferenceError = class extends (_b13 = AISDKError, _a13 = symbol13, _b13) {
  constructor({
    provider,
    reference,
    message = `No provider reference found for provider '${provider}'. Available providers: ${Object.keys(reference).join(", ")}`
  }) {
    super({ name: name12, message });
    this[_a13] = true;
    this.provider = provider;
    this.reference = reference;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker13);
  }
};
var name13 = "AI_TooManyEmbeddingValuesForCallError";
var marker14 = `vercel.ai.error.${name13}`;
var symbol14 = Symbol.for(marker14);
var _a14;
var _b14;
var TooManyEmbeddingValuesForCallError = class extends (_b14 = AISDKError, _a14 = symbol14, _b14) {
  constructor(options) {
    super({
      name: name13,
      message: `Too many values for a single embedding call. The ${options.provider} model "${options.modelId}" can only embed up to ${options.maxEmbeddingsPerCall} values per call, but ${options.values.length} values were provided.`
    });
    this[_a14] = true;
    this.provider = options.provider;
    this.modelId = options.modelId;
    this.maxEmbeddingsPerCall = options.maxEmbeddingsPerCall;
    this.values = options.values;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker14);
  }
};
var name14 = "AI_TypeValidationError";
var marker15 = `vercel.ai.error.${name14}`;
var symbol15 = Symbol.for(marker15);
var _a15;
var _b15;
var TypeValidationError = class _TypeValidationError extends (_b15 = AISDKError, _a15 = symbol15, _b15) {
  constructor({
    value,
    cause,
    context
  }) {
    let contextPrefix = "Type validation failed";
    if (context == null ? undefined : context.field) {
      contextPrefix += ` for ${context.field}`;
    }
    if ((context == null ? undefined : context.entityName) || (context == null ? undefined : context.entityId)) {
      contextPrefix += " (";
      const parts = [];
      if (context.entityName) {
        parts.push(context.entityName);
      }
      if (context.entityId) {
        parts.push(`id: "${context.entityId}"`);
      }
      contextPrefix += parts.join(", ");
      contextPrefix += ")";
    }
    super({
      name: name14,
      message: `${contextPrefix}: Value: ${JSON.stringify(value)}.
Error message: ${getErrorMessage(cause)}`,
      cause
    });
    this[_a15] = true;
    this.value = value;
    this.context = context;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker15);
  }
  static wrap({
    value,
    cause,
    context
  }) {
    var _a17, _b17, _c;
    if (_TypeValidationError.isInstance(cause) && cause.value === value && ((_a17 = cause.context) == null ? undefined : _a17.field) === (context == null ? undefined : context.field) && ((_b17 = cause.context) == null ? undefined : _b17.entityName) === (context == null ? undefined : context.entityName) && ((_c = cause.context) == null ? undefined : _c.entityId) === (context == null ? undefined : context.entityId)) {
      return cause;
    }
    return new _TypeValidationError({ value, cause, context });
  }
};
var name15 = "AI_UnsupportedFunctionalityError";
var marker16 = `vercel.ai.error.${name15}`;
var symbol16 = Symbol.for(marker16);
var _a16;
var _b16;
var UnsupportedFunctionalityError = class extends (_b16 = AISDKError, _a16 = symbol16, _b16) {
  constructor({
    functionality,
    message = `'${functionality}' functionality not supported.`
  }) {
    super({ name: name15, message });
    this[_a16] = true;
    this.functionality = functionality;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker16);
  }
};

// node_modules/zod/v4/core/core.js
var _a17;
function $constructor(name16, initializer, params) {
  function init(inst, def) {
    if (!inst._zod) {
      Object.defineProperty(inst, "_zod", {
        value: {
          def,
          constr: _,
          traits: new Set
        },
        enumerable: false
      });
    }
    if (inst._zod.traits.has(name16)) {
      return;
    }
    inst._zod.traits.add(name16);
    initializer(inst, def);
    const proto = _.prototype;
    const keys = Object.keys(proto);
    for (let i = 0;i < keys.length; i++) {
      const k = keys[i];
      if (!(k in inst)) {
        inst[k] = proto[k].bind(inst);
      }
    }
  }
  const Parent = params?.Parent ?? Object;

  class Definition extends Parent {
  }
  Object.defineProperty(Definition, "name", { value: name16 });
  function _(def) {
    var _a18;
    const inst = params?.Parent ? new Definition : this;
    init(inst, def);
    (_a18 = inst._zod).deferred ?? (_a18.deferred = []);
    for (const fn of inst._zod.deferred) {
      fn();
    }
    return inst;
  }
  Object.defineProperty(_, "init", { value: init });
  Object.defineProperty(_, Symbol.hasInstance, {
    value: (inst) => {
      if (params?.Parent && inst instanceof params.Parent)
        return true;
      return inst?._zod?.traits?.has(name16);
    }
  });
  Object.defineProperty(_, "name", { value: name16 });
  return _;
}
var $brand = Symbol("zod_brand");

class $ZodAsyncError extends Error {
  constructor() {
    super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
  }
}

class $ZodEncodeError extends Error {
  constructor(name16) {
    super(`Encountered unidirectional transform during encode: ${name16}`);
    this.name = "ZodEncodeError";
  }
}
(_a17 = globalThis).__zod_globalConfig ?? (_a17.__zod_globalConfig = {});
var globalConfig = globalThis.__zod_globalConfig;
function config(newConfig) {
  if (newConfig)
    Object.assign(globalConfig, newConfig);
  return globalConfig;
}
// node_modules/zod/v4/core/util.js
var exports_util = {};
__export(exports_util, {
  unwrapMessage: () => unwrapMessage,
  uint8ArrayToHex: () => uint8ArrayToHex,
  uint8ArrayToBase64url: () => uint8ArrayToBase64url,
  uint8ArrayToBase64: () => uint8ArrayToBase64,
  stringifyPrimitive: () => stringifyPrimitive,
  slugify: () => slugify,
  shallowClone: () => shallowClone,
  safeExtend: () => safeExtend,
  required: () => required,
  randomString: () => randomString,
  propertyKeyTypes: () => propertyKeyTypes,
  promiseAllObject: () => promiseAllObject,
  primitiveTypes: () => primitiveTypes,
  prefixIssues: () => prefixIssues,
  pick: () => pick,
  partial: () => partial,
  parsedType: () => parsedType,
  optionalKeys: () => optionalKeys,
  omit: () => omit,
  objectClone: () => objectClone,
  numKeys: () => numKeys,
  nullish: () => nullish,
  normalizeParams: () => normalizeParams,
  mergeDefs: () => mergeDefs,
  merge: () => merge,
  jsonStringifyReplacer: () => jsonStringifyReplacer,
  joinValues: () => joinValues,
  issue: () => issue,
  isPlainObject: () => isPlainObject,
  isObject: () => isObject,
  hexToUint8Array: () => hexToUint8Array,
  getSizableOrigin: () => getSizableOrigin,
  getParsedType: () => getParsedType,
  getLengthableOrigin: () => getLengthableOrigin,
  getEnumValues: () => getEnumValues,
  getElementAtPath: () => getElementAtPath,
  floatSafeRemainder: () => floatSafeRemainder,
  finalizeIssue: () => finalizeIssue,
  extend: () => extend,
  explicitlyAborted: () => explicitlyAborted,
  escapeRegex: () => escapeRegex,
  esc: () => esc,
  defineLazy: () => defineLazy,
  createTransparentProxy: () => createTransparentProxy,
  cloneDef: () => cloneDef,
  clone: () => clone,
  cleanRegex: () => cleanRegex,
  cleanEnum: () => cleanEnum,
  captureStackTrace: () => captureStackTrace,
  cached: () => cached,
  base64urlToUint8Array: () => base64urlToUint8Array,
  base64ToUint8Array: () => base64ToUint8Array,
  assignProp: () => assignProp,
  assertNotEqual: () => assertNotEqual,
  assertNever: () => assertNever,
  assertIs: () => assertIs,
  assertEqual: () => assertEqual,
  assert: () => assert,
  allowsEval: () => allowsEval,
  aborted: () => aborted,
  NUMBER_FORMAT_RANGES: () => NUMBER_FORMAT_RANGES,
  Class: () => Class,
  BIGINT_FORMAT_RANGES: () => BIGINT_FORMAT_RANGES
});
function assertEqual(val) {
  return val;
}
function assertNotEqual(val) {
  return val;
}
function assertIs(_arg) {}
function assertNever(_x) {
  throw new Error("Unexpected value in exhaustive check");
}
function assert(_) {}
function getEnumValues(entries) {
  const numericValues = Object.values(entries).filter((v) => typeof v === "number");
  const values = Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
  return values;
}
function joinValues(array, separator = "|") {
  return array.map((val) => stringifyPrimitive(val)).join(separator);
}
function jsonStringifyReplacer(_, value) {
  if (typeof value === "bigint")
    return value.toString();
  return value;
}
function cached(getter) {
  const set = false;
  return {
    get value() {
      if (!set) {
        const value = getter();
        Object.defineProperty(this, "value", { value });
        return value;
      }
      throw new Error("cached value already set");
    }
  };
}
function nullish(input) {
  return input === null || input === undefined;
}
function cleanRegex(source) {
  const start = source.startsWith("^") ? 1 : 0;
  const end = source.endsWith("$") ? source.length - 1 : source.length;
  return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
  const ratio = val / step;
  const roundedRatio = Math.round(ratio);
  const tolerance = Number.EPSILON * Math.max(Math.abs(ratio), 1);
  if (Math.abs(ratio - roundedRatio) < tolerance)
    return 0;
  return ratio - roundedRatio;
}
var EVALUATING = /* @__PURE__ */ Symbol("evaluating");
function defineLazy(object, key, getter) {
  let value = undefined;
  Object.defineProperty(object, key, {
    get() {
      if (value === EVALUATING) {
        return;
      }
      if (value === undefined) {
        value = EVALUATING;
        value = getter();
      }
      return value;
    },
    set(v) {
      Object.defineProperty(object, key, {
        value: v
      });
    },
    configurable: true
  });
}
function objectClone(obj) {
  return Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyDescriptors(obj));
}
function assignProp(target, prop, value) {
  Object.defineProperty(target, prop, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  });
}
function mergeDefs(...defs) {
  const mergedDescriptors = {};
  for (const def of defs) {
    const descriptors = Object.getOwnPropertyDescriptors(def);
    Object.assign(mergedDescriptors, descriptors);
  }
  return Object.defineProperties({}, mergedDescriptors);
}
function cloneDef(schema) {
  return mergeDefs(schema._zod.def);
}
function getElementAtPath(obj, path) {
  if (!path)
    return obj;
  return path.reduce((acc, key) => acc?.[key], obj);
}
function promiseAllObject(promisesObj) {
  const keys = Object.keys(promisesObj);
  const promises = keys.map((key) => promisesObj[key]);
  return Promise.all(promises).then((results) => {
    const resolvedObj = {};
    for (let i = 0;i < keys.length; i++) {
      resolvedObj[keys[i]] = results[i];
    }
    return resolvedObj;
  });
}
function randomString(length = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let str = "";
  for (let i = 0;i < length; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return str;
}
function esc(str) {
  return JSON.stringify(str);
}
function slugify(input) {
  return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
var captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {};
function isObject(data) {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}
var allowsEval = /* @__PURE__ */ cached(() => {
  if (globalConfig.jitless) {
    return false;
  }
  if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) {
    return false;
  }
  try {
    const F = Function;
    new F("");
    return true;
  } catch (_) {
    return false;
  }
});
function isPlainObject(o) {
  if (isObject(o) === false)
    return false;
  const ctor = o.constructor;
  if (ctor === undefined)
    return true;
  if (typeof ctor !== "function")
    return true;
  const prot = ctor.prototype;
  if (isObject(prot) === false)
    return false;
  if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
    return false;
  }
  return true;
}
function shallowClone(o) {
  if (isPlainObject(o))
    return { ...o };
  if (Array.isArray(o))
    return [...o];
  if (o instanceof Map)
    return new Map(o);
  if (o instanceof Set)
    return new Set(o);
  return o;
}
function numKeys(data) {
  let keyCount = 0;
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      keyCount++;
    }
  }
  return keyCount;
}
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return "undefined";
    case "string":
      return "string";
    case "number":
      return Number.isNaN(data) ? "nan" : "number";
    case "boolean":
      return "boolean";
    case "function":
      return "function";
    case "bigint":
      return "bigint";
    case "symbol":
      return "symbol";
    case "object":
      if (Array.isArray(data)) {
        return "array";
      }
      if (data === null) {
        return "null";
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return "promise";
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return "map";
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return "set";
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return "date";
      }
      if (typeof File !== "undefined" && data instanceof File) {
        return "file";
      }
      return "object";
    default:
      throw new Error(`Unknown data type: ${t}`);
  }
};
var propertyKeyTypes = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
var primitiveTypes = /* @__PURE__ */ new Set([
  "string",
  "number",
  "bigint",
  "boolean",
  "symbol",
  "undefined"
]);
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
  const cl = new inst._zod.constr(def ?? inst._zod.def);
  if (!def || params?.parent)
    cl._zod.parent = inst;
  return cl;
}
function normalizeParams(_params) {
  const params = _params;
  if (!params)
    return {};
  if (typeof params === "string")
    return { error: () => params };
  if (params?.message !== undefined) {
    if (params?.error !== undefined)
      throw new Error("Cannot specify both `message` and `error` params");
    params.error = params.message;
  }
  delete params.message;
  if (typeof params.error === "string")
    return { ...params, error: () => params.error };
  return params;
}
function createTransparentProxy(getter) {
  let target;
  return new Proxy({}, {
    get(_, prop, receiver) {
      target ?? (target = getter());
      return Reflect.get(target, prop, receiver);
    },
    set(_, prop, value, receiver) {
      target ?? (target = getter());
      return Reflect.set(target, prop, value, receiver);
    },
    has(_, prop) {
      target ?? (target = getter());
      return Reflect.has(target, prop);
    },
    deleteProperty(_, prop) {
      target ?? (target = getter());
      return Reflect.deleteProperty(target, prop);
    },
    ownKeys(_) {
      target ?? (target = getter());
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(_, prop) {
      target ?? (target = getter());
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    defineProperty(_, prop, descriptor) {
      target ?? (target = getter());
      return Reflect.defineProperty(target, prop, descriptor);
    }
  });
}
function stringifyPrimitive(value) {
  if (typeof value === "bigint")
    return value.toString() + "n";
  if (typeof value === "string")
    return `"${value}"`;
  return `${value}`;
}
function optionalKeys(shape) {
  return Object.keys(shape).filter((k) => {
    return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
  });
}
var NUMBER_FORMAT_RANGES = {
  safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
  float32: [-340282346638528860000000000000000000000, 340282346638528860000000000000000000000],
  float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
};
var BIGINT_FORMAT_RANGES = {
  int64: [/* @__PURE__ */ BigInt("-9223372036854775808"), /* @__PURE__ */ BigInt("9223372036854775807")],
  uint64: [/* @__PURE__ */ BigInt(0), /* @__PURE__ */ BigInt("18446744073709551615")]
};
function pick(schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".pick() cannot be used on object schemas containing refinements");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const newShape = {};
      for (const key in mask) {
        if (!(key in currDef.shape)) {
          throw new Error(`Unrecognized key: "${key}"`);
        }
        if (!mask[key])
          continue;
        newShape[key] = currDef.shape[key];
      }
      assignProp(this, "shape", newShape);
      return newShape;
    },
    checks: []
  });
  return clone(schema, def);
}
function omit(schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".omit() cannot be used on object schemas containing refinements");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const newShape = { ...schema._zod.def.shape };
      for (const key in mask) {
        if (!(key in currDef.shape)) {
          throw new Error(`Unrecognized key: "${key}"`);
        }
        if (!mask[key])
          continue;
        delete newShape[key];
      }
      assignProp(this, "shape", newShape);
      return newShape;
    },
    checks: []
  });
  return clone(schema, def);
}
function extend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to extend: expected a plain object");
  }
  const checks = schema._zod.def.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    const existingShape = schema._zod.def.shape;
    for (const key in shape) {
      if (Object.getOwnPropertyDescriptor(existingShape, key) !== undefined) {
        throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
      }
    }
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const _shape = { ...schema._zod.def.shape, ...shape };
      assignProp(this, "shape", _shape);
      return _shape;
    }
  });
  return clone(schema, def);
}
function safeExtend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to safeExtend: expected a plain object");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const _shape = { ...schema._zod.def.shape, ...shape };
      assignProp(this, "shape", _shape);
      return _shape;
    }
  });
  return clone(schema, def);
}
function merge(a, b) {
  if (a._zod.def.checks?.length) {
    throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
  }
  const def = mergeDefs(a._zod.def, {
    get shape() {
      const _shape = { ...a._zod.def.shape, ...b._zod.def.shape };
      assignProp(this, "shape", _shape);
      return _shape;
    },
    get catchall() {
      return b._zod.def.catchall;
    },
    checks: b._zod.def.checks ?? []
  });
  return clone(a, def);
}
function partial(Class, schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".partial() cannot be used on object schemas containing refinements");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const oldShape = schema._zod.def.shape;
      const shape = { ...oldShape };
      if (mask) {
        for (const key in mask) {
          if (!(key in oldShape)) {
            throw new Error(`Unrecognized key: "${key}"`);
          }
          if (!mask[key])
            continue;
          shape[key] = Class ? new Class({
            type: "optional",
            innerType: oldShape[key]
          }) : oldShape[key];
        }
      } else {
        for (const key in oldShape) {
          shape[key] = Class ? new Class({
            type: "optional",
            innerType: oldShape[key]
          }) : oldShape[key];
        }
      }
      assignProp(this, "shape", shape);
      return shape;
    },
    checks: []
  });
  return clone(schema, def);
}
function required(Class, schema, mask) {
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const oldShape = schema._zod.def.shape;
      const shape = { ...oldShape };
      if (mask) {
        for (const key in mask) {
          if (!(key in shape)) {
            throw new Error(`Unrecognized key: "${key}"`);
          }
          if (!mask[key])
            continue;
          shape[key] = new Class({
            type: "nonoptional",
            innerType: oldShape[key]
          });
        }
      } else {
        for (const key in oldShape) {
          shape[key] = new Class({
            type: "nonoptional",
            innerType: oldShape[key]
          });
        }
      }
      assignProp(this, "shape", shape);
      return shape;
    }
  });
  return clone(schema, def);
}
function aborted(x, startIndex = 0) {
  if (x.aborted === true)
    return true;
  for (let i = startIndex;i < x.issues.length; i++) {
    if (x.issues[i]?.continue !== true) {
      return true;
    }
  }
  return false;
}
function explicitlyAborted(x, startIndex = 0) {
  if (x.aborted === true)
    return true;
  for (let i = startIndex;i < x.issues.length; i++) {
    if (x.issues[i]?.continue === false) {
      return true;
    }
  }
  return false;
}
function prefixIssues(path, issues) {
  return issues.map((iss) => {
    var _a18;
    (_a18 = iss).path ?? (_a18.path = []);
    iss.path.unshift(path);
    return iss;
  });
}
function unwrapMessage(message) {
  return typeof message === "string" ? message : message?.message;
}
function finalizeIssue(iss, ctx, config2) {
  const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config2.customError?.(iss)) ?? unwrapMessage(config2.localeError?.(iss)) ?? "Invalid input";
  const { inst: _inst, continue: _continue, input: _input, ...rest } = iss;
  rest.path ?? (rest.path = []);
  rest.message = message;
  if (ctx?.reportInput) {
    rest.input = _input;
  }
  return rest;
}
function getSizableOrigin(input) {
  if (input instanceof Set)
    return "set";
  if (input instanceof Map)
    return "map";
  if (input instanceof File)
    return "file";
  return "unknown";
}
function getLengthableOrigin(input) {
  if (Array.isArray(input))
    return "array";
  if (typeof input === "string")
    return "string";
  return "unknown";
}
function parsedType(data) {
  const t = typeof data;
  switch (t) {
    case "number": {
      return Number.isNaN(data) ? "nan" : "number";
    }
    case "object": {
      if (data === null) {
        return "null";
      }
      if (Array.isArray(data)) {
        return "array";
      }
      const obj = data;
      if (obj && Object.getPrototypeOf(obj) !== Object.prototype && "constructor" in obj && obj.constructor) {
        return obj.constructor.name;
      }
    }
  }
  return t;
}
function issue(...args) {
  const [iss, input, inst] = args;
  if (typeof iss === "string") {
    return {
      message: iss,
      code: "custom",
      input,
      inst
    };
  }
  return { ...iss };
}
function cleanEnum(obj) {
  return Object.entries(obj).filter(([k, _]) => {
    return Number.isNaN(Number.parseInt(k, 10));
  }).map((el) => el[1]);
}
function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0;i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
function uint8ArrayToBase64(bytes) {
  let binaryString = "";
  for (let i = 0;i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  return btoa(binaryString);
}
function base64urlToUint8Array(base64url) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - base64.length % 4) % 4);
  return base64ToUint8Array(base64 + padding);
}
function uint8ArrayToBase64url(bytes) {
  return uint8ArrayToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function hexToUint8Array(hex) {
  const cleanHex = hex.replace(/^0x/, "");
  if (cleanHex.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0;i < cleanHex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}
function uint8ArrayToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

class Class {
  constructor(..._args) {}
}

// node_modules/zod/v4/core/errors.js
var initializer = (inst, def) => {
  inst.name = "$ZodError";
  Object.defineProperty(inst, "_zod", {
    value: inst._zod,
    enumerable: false
  });
  Object.defineProperty(inst, "issues", {
    value: def,
    enumerable: false
  });
  inst.message = JSON.stringify(def, jsonStringifyReplacer, 2);
  Object.defineProperty(inst, "toString", {
    value: () => inst.message,
    enumerable: false
  });
};
var $ZodError = $constructor("$ZodError", initializer);
var $ZodRealError = $constructor("$ZodError", initializer, { Parent: Error });
function flattenError(error, mapper = (issue2) => issue2.message) {
  const fieldErrors = {};
  const formErrors = [];
  for (const sub of error.issues) {
    if (sub.path.length > 0) {
      fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
      fieldErrors[sub.path[0]].push(mapper(sub));
    } else {
      formErrors.push(mapper(sub));
    }
  }
  return { formErrors, fieldErrors };
}
function formatError(error, mapper = (issue2) => issue2.message) {
  const fieldErrors = { _errors: [] };
  const processError = (error2, path = []) => {
    for (const issue2 of error2.issues) {
      if (issue2.code === "invalid_union" && issue2.errors.length) {
        issue2.errors.map((issues) => processError({ issues }, [...path, ...issue2.path]));
      } else if (issue2.code === "invalid_key") {
        processError({ issues: issue2.issues }, [...path, ...issue2.path]);
      } else if (issue2.code === "invalid_element") {
        processError({ issues: issue2.issues }, [...path, ...issue2.path]);
      } else {
        const fullpath = [...path, ...issue2.path];
        if (fullpath.length === 0) {
          fieldErrors._errors.push(mapper(issue2));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < fullpath.length) {
            const el = fullpath[i];
            const terminal = i === fullpath.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue2));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    }
  };
  processError(error);
  return fieldErrors;
}

// node_modules/zod/v4/core/parse.js
var _parse = (_Err) => (schema, value, _ctx, _params) => {
  const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError;
  }
  if (result.issues.length) {
    const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
    captureStackTrace(e, _params?.callee);
    throw e;
  }
  return result.value;
};
var _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
  const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  if (result.issues.length) {
    const e = new (params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
    captureStackTrace(e, params?.callee);
    throw e;
  }
  return result.value;
};
var _safeParse = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError;
  }
  return result.issues.length ? {
    success: false,
    error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  } : { success: true, data: result.value };
};
var safeParse = /* @__PURE__ */ _safeParse($ZodRealError);
var _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  return result.issues.length ? {
    success: false,
    error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  } : { success: true, data: result.value };
};
var safeParseAsync = /* @__PURE__ */ _safeParseAsync($ZodRealError);
var _encode = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _parse(_Err)(schema, value, ctx);
};
var _decode = (_Err) => (schema, value, _ctx) => {
  return _parse(_Err)(schema, value, _ctx);
};
var _encodeAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _parseAsync(_Err)(schema, value, ctx);
};
var _decodeAsync = (_Err) => async (schema, value, _ctx) => {
  return _parseAsync(_Err)(schema, value, _ctx);
};
var _safeEncode = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _safeParse(_Err)(schema, value, ctx);
};
var _safeDecode = (_Err) => (schema, value, _ctx) => {
  return _safeParse(_Err)(schema, value, _ctx);
};
var _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _safeParseAsync(_Err)(schema, value, ctx);
};
var _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
  return _safeParseAsync(_Err)(schema, value, _ctx);
};
// node_modules/zod/v4/core/regexes.js
var cuid = /^[cC][0-9a-z]{6,}$/;
var cuid2 = /^[0-9a-z]+$/;
var ulid = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
var xid = /^[0-9a-vA-V]{20}$/;
var ksuid = /^[A-Za-z0-9]{27}$/;
var nanoid = /^[a-zA-Z0-9_-]{21}$/;
var duration = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
var guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
var uuid = (version) => {
  if (!version)
    return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
  return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
};
var email = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
var _emoji = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
function emoji() {
  return new RegExp(_emoji, "u");
}
var ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
var cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
var cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
var base64url = /^[A-Za-z0-9_-]*$/;
var httpProtocol = /^https?$/;
var e164 = /^\+[1-9]\d{6,14}$/;
var dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
var date = /* @__PURE__ */ new RegExp(`^${dateSource}$`);
function timeSource(args) {
  const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
  const regex = typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
  return regex;
}
function time(args) {
  return new RegExp(`^${timeSource(args)}$`);
}
function datetime(args) {
  const time2 = timeSource({ precision: args.precision });
  const opts = ["Z"];
  if (args.local)
    opts.push("");
  if (args.offset)
    opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
  const timeRegex = `${time2}(?:${opts.join("|")})`;
  return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
var string = (params) => {
  const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
  return new RegExp(`^${regex}$`);
};
var integer = /^-?\d+$/;
var number = /^-?\d+(?:\.\d+)?$/;
var boolean = /^(?:true|false)$/i;
var _null = /^null$/i;
var lowercase = /^[^A-Z]*$/;
var uppercase = /^[^a-z]*$/;

// node_modules/zod/v4/core/checks.js
var $ZodCheck = /* @__PURE__ */ $constructor("$ZodCheck", (inst, def) => {
  var _a18;
  inst._zod ?? (inst._zod = {});
  inst._zod.def = def;
  (_a18 = inst._zod).onattach ?? (_a18.onattach = []);
});
var numericOriginMap = {
  number: "number",
  bigint: "bigint",
  object: "date"
};
var $ZodCheckLessThan = /* @__PURE__ */ $constructor("$ZodCheckLessThan", (inst, def) => {
  $ZodCheck.init(inst, def);
  const origin = numericOriginMap[typeof def.value];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
    if (def.value < curr) {
      if (def.inclusive)
        bag.maximum = def.value;
      else
        bag.exclusiveMaximum = def.value;
    }
  });
  inst._zod.check = (payload) => {
    if (def.inclusive ? payload.value <= def.value : payload.value < def.value) {
      return;
    }
    payload.issues.push({
      origin,
      code: "too_big",
      maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
      input: payload.value,
      inclusive: def.inclusive,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckGreaterThan = /* @__PURE__ */ $constructor("$ZodCheckGreaterThan", (inst, def) => {
  $ZodCheck.init(inst, def);
  const origin = numericOriginMap[typeof def.value];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
    if (def.value > curr) {
      if (def.inclusive)
        bag.minimum = def.value;
      else
        bag.exclusiveMinimum = def.value;
    }
  });
  inst._zod.check = (payload) => {
    if (def.inclusive ? payload.value >= def.value : payload.value > def.value) {
      return;
    }
    payload.issues.push({
      origin,
      code: "too_small",
      minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
      input: payload.value,
      inclusive: def.inclusive,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckMultipleOf = /* @__PURE__ */ $constructor("$ZodCheckMultipleOf", (inst, def) => {
  $ZodCheck.init(inst, def);
  inst._zod.onattach.push((inst2) => {
    var _a18;
    (_a18 = inst2._zod.bag).multipleOf ?? (_a18.multipleOf = def.value);
  });
  inst._zod.check = (payload) => {
    if (typeof payload.value !== typeof def.value)
      throw new Error("Cannot mix number and bigint in multiple_of check.");
    const isMultiple = typeof payload.value === "bigint" ? payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0;
    if (isMultiple)
      return;
    payload.issues.push({
      origin: typeof payload.value,
      code: "not_multiple_of",
      divisor: def.value,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckNumberFormat = /* @__PURE__ */ $constructor("$ZodCheckNumberFormat", (inst, def) => {
  $ZodCheck.init(inst, def);
  def.format = def.format || "float64";
  const isInt = def.format?.includes("int");
  const origin = isInt ? "int" : "number";
  const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.format = def.format;
    bag.minimum = minimum;
    bag.maximum = maximum;
    if (isInt)
      bag.pattern = integer;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    if (isInt) {
      if (!Number.isInteger(input)) {
        payload.issues.push({
          expected: origin,
          format: def.format,
          code: "invalid_type",
          continue: false,
          input,
          inst
        });
        return;
      }
      if (!Number.isSafeInteger(input)) {
        if (input > 0) {
          payload.issues.push({
            input,
            code: "too_big",
            maximum: Number.MAX_SAFE_INTEGER,
            note: "Integers must be within the safe integer range.",
            inst,
            origin,
            inclusive: true,
            continue: !def.abort
          });
        } else {
          payload.issues.push({
            input,
            code: "too_small",
            minimum: Number.MIN_SAFE_INTEGER,
            note: "Integers must be within the safe integer range.",
            inst,
            origin,
            inclusive: true,
            continue: !def.abort
          });
        }
        return;
      }
    }
    if (input < minimum) {
      payload.issues.push({
        origin: "number",
        input,
        code: "too_small",
        minimum,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
    if (input > maximum) {
      payload.issues.push({
        origin: "number",
        input,
        code: "too_big",
        maximum,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
  };
});
var $ZodCheckMaxLength = /* @__PURE__ */ $constructor("$ZodCheckMaxLength", (inst, def) => {
  var _a18;
  $ZodCheck.init(inst, def);
  (_a18 = inst._zod.def).when ?? (_a18.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.length !== undefined;
  });
  inst._zod.onattach.push((inst2) => {
    const curr = inst2._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
    if (def.maximum < curr)
      inst2._zod.bag.maximum = def.maximum;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const length = input.length;
    if (length <= def.maximum)
      return;
    const origin = getLengthableOrigin(input);
    payload.issues.push({
      origin,
      code: "too_big",
      maximum: def.maximum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckMinLength = /* @__PURE__ */ $constructor("$ZodCheckMinLength", (inst, def) => {
  var _a18;
  $ZodCheck.init(inst, def);
  (_a18 = inst._zod.def).when ?? (_a18.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.length !== undefined;
  });
  inst._zod.onattach.push((inst2) => {
    const curr = inst2._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
    if (def.minimum > curr)
      inst2._zod.bag.minimum = def.minimum;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const length = input.length;
    if (length >= def.minimum)
      return;
    const origin = getLengthableOrigin(input);
    payload.issues.push({
      origin,
      code: "too_small",
      minimum: def.minimum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckLengthEquals = /* @__PURE__ */ $constructor("$ZodCheckLengthEquals", (inst, def) => {
  var _a18;
  $ZodCheck.init(inst, def);
  (_a18 = inst._zod.def).when ?? (_a18.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.length !== undefined;
  });
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.minimum = def.length;
    bag.maximum = def.length;
    bag.length = def.length;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const length = input.length;
    if (length === def.length)
      return;
    const origin = getLengthableOrigin(input);
    const tooBig = length > def.length;
    payload.issues.push({
      origin,
      ...tooBig ? { code: "too_big", maximum: def.length } : { code: "too_small", minimum: def.length },
      inclusive: true,
      exact: true,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckStringFormat = /* @__PURE__ */ $constructor("$ZodCheckStringFormat", (inst, def) => {
  var _a18, _b17;
  $ZodCheck.init(inst, def);
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.format = def.format;
    if (def.pattern) {
      bag.patterns ?? (bag.patterns = new Set);
      bag.patterns.add(def.pattern);
    }
  });
  if (def.pattern)
    (_a18 = inst._zod).check ?? (_a18.check = (payload) => {
      def.pattern.lastIndex = 0;
      if (def.pattern.test(payload.value))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: def.format,
        input: payload.value,
        ...def.pattern ? { pattern: def.pattern.toString() } : {},
        inst,
        continue: !def.abort
      });
    });
  else
    (_b17 = inst._zod).check ?? (_b17.check = () => {});
});
var $ZodCheckRegex = /* @__PURE__ */ $constructor("$ZodCheckRegex", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    def.pattern.lastIndex = 0;
    if (def.pattern.test(payload.value))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "regex",
      input: payload.value,
      pattern: def.pattern.toString(),
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckLowerCase = /* @__PURE__ */ $constructor("$ZodCheckLowerCase", (inst, def) => {
  def.pattern ?? (def.pattern = lowercase);
  $ZodCheckStringFormat.init(inst, def);
});
var $ZodCheckUpperCase = /* @__PURE__ */ $constructor("$ZodCheckUpperCase", (inst, def) => {
  def.pattern ?? (def.pattern = uppercase);
  $ZodCheckStringFormat.init(inst, def);
});
var $ZodCheckIncludes = /* @__PURE__ */ $constructor("$ZodCheckIncludes", (inst, def) => {
  $ZodCheck.init(inst, def);
  const escapedRegex = escapeRegex(def.includes);
  const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position}}${escapedRegex}` : escapedRegex);
  def.pattern = pattern;
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.patterns ?? (bag.patterns = new Set);
    bag.patterns.add(pattern);
  });
  inst._zod.check = (payload) => {
    if (payload.value.includes(def.includes, def.position))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "includes",
      includes: def.includes,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckStartsWith = /* @__PURE__ */ $constructor("$ZodCheckStartsWith", (inst, def) => {
  $ZodCheck.init(inst, def);
  const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
  def.pattern ?? (def.pattern = pattern);
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.patterns ?? (bag.patterns = new Set);
    bag.patterns.add(pattern);
  });
  inst._zod.check = (payload) => {
    if (payload.value.startsWith(def.prefix))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "starts_with",
      prefix: def.prefix,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckEndsWith = /* @__PURE__ */ $constructor("$ZodCheckEndsWith", (inst, def) => {
  $ZodCheck.init(inst, def);
  const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
  def.pattern ?? (def.pattern = pattern);
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.patterns ?? (bag.patterns = new Set);
    bag.patterns.add(pattern);
  });
  inst._zod.check = (payload) => {
    if (payload.value.endsWith(def.suffix))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "ends_with",
      suffix: def.suffix,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckOverwrite = /* @__PURE__ */ $constructor("$ZodCheckOverwrite", (inst, def) => {
  $ZodCheck.init(inst, def);
  inst._zod.check = (payload) => {
    payload.value = def.tx(payload.value);
  };
});

// node_modules/zod/v4/core/doc.js
class Doc {
  constructor(args = []) {
    this.content = [];
    this.indent = 0;
    if (this)
      this.args = args;
  }
  indented(fn) {
    this.indent += 1;
    fn(this);
    this.indent -= 1;
  }
  write(arg) {
    if (typeof arg === "function") {
      arg(this, { execution: "sync" });
      arg(this, { execution: "async" });
      return;
    }
    const content = arg;
    const lines = content.split(`
`).filter((x) => x);
    const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
    const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
    for (const line of dedented) {
      this.content.push(line);
    }
  }
  compile() {
    const F = Function;
    const args = this?.args;
    const content = this?.content ?? [``];
    const lines = [...content.map((x) => `  ${x}`)];
    return new F(...args, lines.join(`
`));
  }
}

// node_modules/zod/v4/core/versions.js
var version = {
  major: 4,
  minor: 4,
  patch: 3
};

// node_modules/zod/v4/core/schemas.js
var $ZodType = /* @__PURE__ */ $constructor("$ZodType", (inst, def) => {
  var _a18;
  inst ?? (inst = {});
  inst._zod.def = def;
  inst._zod.bag = inst._zod.bag || {};
  inst._zod.version = version;
  const checks = [...inst._zod.def.checks ?? []];
  if (inst._zod.traits.has("$ZodCheck")) {
    checks.unshift(inst);
  }
  for (const ch of checks) {
    for (const fn of ch._zod.onattach) {
      fn(inst);
    }
  }
  if (checks.length === 0) {
    (_a18 = inst._zod).deferred ?? (_a18.deferred = []);
    inst._zod.deferred?.push(() => {
      inst._zod.run = inst._zod.parse;
    });
  } else {
    const runChecks = (payload, checks2, ctx) => {
      let isAborted = aborted(payload);
      let asyncResult;
      for (const ch of checks2) {
        if (ch._zod.def.when) {
          if (explicitlyAborted(payload))
            continue;
          const shouldRun = ch._zod.def.when(payload);
          if (!shouldRun)
            continue;
        } else if (isAborted) {
          continue;
        }
        const currLen = payload.issues.length;
        const _ = ch._zod.check(payload);
        if (_ instanceof Promise && ctx?.async === false) {
          throw new $ZodAsyncError;
        }
        if (asyncResult || _ instanceof Promise) {
          asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
            await _;
            const nextLen = payload.issues.length;
            if (nextLen === currLen)
              return;
            if (!isAborted)
              isAborted = aborted(payload, currLen);
          });
        } else {
          const nextLen = payload.issues.length;
          if (nextLen === currLen)
            continue;
          if (!isAborted)
            isAborted = aborted(payload, currLen);
        }
      }
      if (asyncResult) {
        return asyncResult.then(() => {
          return payload;
        });
      }
      return payload;
    };
    const handleCanaryResult = (canary, payload, ctx) => {
      if (aborted(canary)) {
        canary.aborted = true;
        return canary;
      }
      const checkResult = runChecks(payload, checks, ctx);
      if (checkResult instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError;
        return checkResult.then((checkResult2) => inst._zod.parse(checkResult2, ctx));
      }
      return inst._zod.parse(checkResult, ctx);
    };
    inst._zod.run = (payload, ctx) => {
      if (ctx.skipChecks) {
        return inst._zod.parse(payload, ctx);
      }
      if (ctx.direction === "backward") {
        const canary = inst._zod.parse({ value: payload.value, issues: [] }, { ...ctx, skipChecks: true });
        if (canary instanceof Promise) {
          return canary.then((canary2) => {
            return handleCanaryResult(canary2, payload, ctx);
          });
        }
        return handleCanaryResult(canary, payload, ctx);
      }
      const result = inst._zod.parse(payload, ctx);
      if (result instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError;
        return result.then((result2) => runChecks(result2, checks, ctx));
      }
      return runChecks(result, checks, ctx);
    };
  }
  defineLazy(inst, "~standard", () => ({
    validate: (value) => {
      try {
        const r = safeParse(inst, value);
        return r.success ? { value: r.data } : { issues: r.error?.issues };
      } catch (_) {
        return safeParseAsync(inst, value).then((r) => r.success ? { value: r.data } : { issues: r.error?.issues });
      }
    },
    vendor: "zod",
    version: 1
  }));
});
var $ZodString = /* @__PURE__ */ $constructor("$ZodString", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = [...inst?._zod.bag?.patterns ?? []].pop() ?? string(inst._zod.bag);
  inst._zod.parse = (payload, _) => {
    if (def.coerce)
      try {
        payload.value = String(payload.value);
      } catch (_2) {}
    if (typeof payload.value === "string")
      return payload;
    payload.issues.push({
      expected: "string",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
var $ZodStringFormat = /* @__PURE__ */ $constructor("$ZodStringFormat", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  $ZodString.init(inst, def);
});
var $ZodGUID = /* @__PURE__ */ $constructor("$ZodGUID", (inst, def) => {
  def.pattern ?? (def.pattern = guid);
  $ZodStringFormat.init(inst, def);
});
var $ZodUUID = /* @__PURE__ */ $constructor("$ZodUUID", (inst, def) => {
  if (def.version) {
    const versionMap = {
      v1: 1,
      v2: 2,
      v3: 3,
      v4: 4,
      v5: 5,
      v6: 6,
      v7: 7,
      v8: 8
    };
    const v = versionMap[def.version];
    if (v === undefined)
      throw new Error(`Invalid UUID version: "${def.version}"`);
    def.pattern ?? (def.pattern = uuid(v));
  } else
    def.pattern ?? (def.pattern = uuid());
  $ZodStringFormat.init(inst, def);
});
var $ZodEmail = /* @__PURE__ */ $constructor("$ZodEmail", (inst, def) => {
  def.pattern ?? (def.pattern = email);
  $ZodStringFormat.init(inst, def);
});
var $ZodURL = /* @__PURE__ */ $constructor("$ZodURL", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    try {
      const trimmed = payload.value.trim();
      if (!def.normalize && def.protocol?.source === httpProtocol.source) {
        if (!/^https?:\/\//i.test(trimmed)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid URL format",
            input: payload.value,
            inst,
            continue: !def.abort
          });
          return;
        }
      }
      const url = new URL(trimmed);
      if (def.hostname) {
        def.hostname.lastIndex = 0;
        if (!def.hostname.test(url.hostname)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid hostname",
            pattern: def.hostname.source,
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
      }
      if (def.protocol) {
        def.protocol.lastIndex = 0;
        if (!def.protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid protocol",
            pattern: def.protocol.source,
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
      }
      if (def.normalize) {
        payload.value = url.href;
      } else {
        payload.value = trimmed;
      }
      return;
    } catch (_) {
      payload.issues.push({
        code: "invalid_format",
        format: "url",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
var $ZodEmoji = /* @__PURE__ */ $constructor("$ZodEmoji", (inst, def) => {
  def.pattern ?? (def.pattern = emoji());
  $ZodStringFormat.init(inst, def);
});
var $ZodNanoID = /* @__PURE__ */ $constructor("$ZodNanoID", (inst, def) => {
  def.pattern ?? (def.pattern = nanoid);
  $ZodStringFormat.init(inst, def);
});
var $ZodCUID = /* @__PURE__ */ $constructor("$ZodCUID", (inst, def) => {
  def.pattern ?? (def.pattern = cuid);
  $ZodStringFormat.init(inst, def);
});
var $ZodCUID2 = /* @__PURE__ */ $constructor("$ZodCUID2", (inst, def) => {
  def.pattern ?? (def.pattern = cuid2);
  $ZodStringFormat.init(inst, def);
});
var $ZodULID = /* @__PURE__ */ $constructor("$ZodULID", (inst, def) => {
  def.pattern ?? (def.pattern = ulid);
  $ZodStringFormat.init(inst, def);
});
var $ZodXID = /* @__PURE__ */ $constructor("$ZodXID", (inst, def) => {
  def.pattern ?? (def.pattern = xid);
  $ZodStringFormat.init(inst, def);
});
var $ZodKSUID = /* @__PURE__ */ $constructor("$ZodKSUID", (inst, def) => {
  def.pattern ?? (def.pattern = ksuid);
  $ZodStringFormat.init(inst, def);
});
var $ZodISODateTime = /* @__PURE__ */ $constructor("$ZodISODateTime", (inst, def) => {
  def.pattern ?? (def.pattern = datetime(def));
  $ZodStringFormat.init(inst, def);
});
var $ZodISODate = /* @__PURE__ */ $constructor("$ZodISODate", (inst, def) => {
  def.pattern ?? (def.pattern = date);
  $ZodStringFormat.init(inst, def);
});
var $ZodISOTime = /* @__PURE__ */ $constructor("$ZodISOTime", (inst, def) => {
  def.pattern ?? (def.pattern = time(def));
  $ZodStringFormat.init(inst, def);
});
var $ZodISODuration = /* @__PURE__ */ $constructor("$ZodISODuration", (inst, def) => {
  def.pattern ?? (def.pattern = duration);
  $ZodStringFormat.init(inst, def);
});
var $ZodIPv4 = /* @__PURE__ */ $constructor("$ZodIPv4", (inst, def) => {
  def.pattern ?? (def.pattern = ipv4);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.format = `ipv4`;
});
var $ZodIPv6 = /* @__PURE__ */ $constructor("$ZodIPv6", (inst, def) => {
  def.pattern ?? (def.pattern = ipv6);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.format = `ipv6`;
  inst._zod.check = (payload) => {
    try {
      new URL(`http://[${payload.value}]`);
    } catch {
      payload.issues.push({
        code: "invalid_format",
        format: "ipv6",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
var $ZodCIDRv4 = /* @__PURE__ */ $constructor("$ZodCIDRv4", (inst, def) => {
  def.pattern ?? (def.pattern = cidrv4);
  $ZodStringFormat.init(inst, def);
});
var $ZodCIDRv6 = /* @__PURE__ */ $constructor("$ZodCIDRv6", (inst, def) => {
  def.pattern ?? (def.pattern = cidrv6);
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    const parts = payload.value.split("/");
    try {
      if (parts.length !== 2)
        throw new Error;
      const [address, prefix] = parts;
      if (!prefix)
        throw new Error;
      const prefixNum = Number(prefix);
      if (`${prefixNum}` !== prefix)
        throw new Error;
      if (prefixNum < 0 || prefixNum > 128)
        throw new Error;
      new URL(`http://[${address}]`);
    } catch {
      payload.issues.push({
        code: "invalid_format",
        format: "cidrv6",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
function isValidBase64(data) {
  if (data === "")
    return true;
  if (/\s/.test(data))
    return false;
  if (data.length % 4 !== 0)
    return false;
  try {
    atob(data);
    return true;
  } catch {
    return false;
  }
}
var $ZodBase64 = /* @__PURE__ */ $constructor("$ZodBase64", (inst, def) => {
  def.pattern ?? (def.pattern = base64);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.contentEncoding = "base64";
  inst._zod.check = (payload) => {
    if (isValidBase64(payload.value))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "base64",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
function isValidBase64URL(data) {
  if (!base64url.test(data))
    return false;
  const base642 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
  const padded = base642.padEnd(Math.ceil(base642.length / 4) * 4, "=");
  return isValidBase64(padded);
}
var $ZodBase64URL = /* @__PURE__ */ $constructor("$ZodBase64URL", (inst, def) => {
  def.pattern ?? (def.pattern = base64url);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.contentEncoding = "base64url";
  inst._zod.check = (payload) => {
    if (isValidBase64URL(payload.value))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "base64url",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodE164 = /* @__PURE__ */ $constructor("$ZodE164", (inst, def) => {
  def.pattern ?? (def.pattern = e164);
  $ZodStringFormat.init(inst, def);
});
function isValidJWT(token, algorithm = null) {
  try {
    const tokensParts = token.split(".");
    if (tokensParts.length !== 3)
      return false;
    const [header] = tokensParts;
    if (!header)
      return false;
    const parsedHeader = JSON.parse(atob(header));
    if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT")
      return false;
    if (!parsedHeader.alg)
      return false;
    if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm))
      return false;
    return true;
  } catch {
    return false;
  }
}
var $ZodJWT = /* @__PURE__ */ $constructor("$ZodJWT", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (isValidJWT(payload.value, def.alg))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "jwt",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodNumber = /* @__PURE__ */ $constructor("$ZodNumber", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = inst._zod.bag.pattern ?? number;
  inst._zod.parse = (payload, _ctx) => {
    if (def.coerce)
      try {
        payload.value = Number(payload.value);
      } catch (_) {}
    const input = payload.value;
    if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) {
      return payload;
    }
    const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? "Infinity" : undefined : undefined;
    payload.issues.push({
      expected: "number",
      code: "invalid_type",
      input,
      inst,
      ...received ? { received } : {}
    });
    return payload;
  };
});
var $ZodNumberFormat = /* @__PURE__ */ $constructor("$ZodNumberFormat", (inst, def) => {
  $ZodCheckNumberFormat.init(inst, def);
  $ZodNumber.init(inst, def);
});
var $ZodBoolean = /* @__PURE__ */ $constructor("$ZodBoolean", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = boolean;
  inst._zod.parse = (payload, _ctx) => {
    if (def.coerce)
      try {
        payload.value = Boolean(payload.value);
      } catch (_) {}
    const input = payload.value;
    if (typeof input === "boolean")
      return payload;
    payload.issues.push({
      expected: "boolean",
      code: "invalid_type",
      input,
      inst
    });
    return payload;
  };
});
var $ZodNull = /* @__PURE__ */ $constructor("$ZodNull", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = _null;
  inst._zod.values = new Set([null]);
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (input === null)
      return payload;
    payload.issues.push({
      expected: "null",
      code: "invalid_type",
      input,
      inst
    });
    return payload;
  };
});
var $ZodAny = /* @__PURE__ */ $constructor("$ZodAny", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload) => payload;
});
var $ZodUnknown = /* @__PURE__ */ $constructor("$ZodUnknown", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload) => payload;
});
var $ZodNever = /* @__PURE__ */ $constructor("$ZodNever", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _ctx) => {
    payload.issues.push({
      expected: "never",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
function handleArrayResult(result, final, index) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(index, result.issues));
  }
  final.value[index] = result.value;
}
var $ZodArray = /* @__PURE__ */ $constructor("$ZodArray", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!Array.isArray(input)) {
      payload.issues.push({
        expected: "array",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    payload.value = Array(input.length);
    const proms = [];
    for (let i = 0;i < input.length; i++) {
      const item = input[i];
      const result = def.element._zod.run({
        value: item,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        proms.push(result.then((result2) => handleArrayResult(result2, payload, i)));
      } else {
        handleArrayResult(result, payload, i);
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => payload);
    }
    return payload;
  };
});
function handlePropertyResult(result, final, key, input, isOptionalIn, isOptionalOut) {
  const isPresent = key in input;
  if (result.issues.length) {
    if (isOptionalIn && isOptionalOut && !isPresent) {
      return;
    }
    final.issues.push(...prefixIssues(key, result.issues));
  }
  if (!isPresent && !isOptionalIn) {
    if (!result.issues.length) {
      final.issues.push({
        code: "invalid_type",
        expected: "nonoptional",
        input: undefined,
        path: [key]
      });
    }
    return;
  }
  if (result.value === undefined) {
    if (isPresent) {
      final.value[key] = undefined;
    }
  } else {
    final.value[key] = result.value;
  }
}
function normalizeDef(def) {
  const keys = Object.keys(def.shape);
  for (const k of keys) {
    if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) {
      throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
    }
  }
  const okeys = optionalKeys(def.shape);
  return {
    ...def,
    keys,
    keySet: new Set(keys),
    numKeys: keys.length,
    optionalKeys: new Set(okeys)
  };
}
function handleCatchall(proms, input, payload, ctx, def, inst) {
  const unrecognized = [];
  const keySet = def.keySet;
  const _catchall = def.catchall._zod;
  const t = _catchall.def.type;
  const isOptionalIn = _catchall.optin === "optional";
  const isOptionalOut = _catchall.optout === "optional";
  for (const key in input) {
    if (key === "__proto__")
      continue;
    if (keySet.has(key))
      continue;
    if (t === "never") {
      unrecognized.push(key);
      continue;
    }
    const r = _catchall.run({ value: input[key], issues: [] }, ctx);
    if (r instanceof Promise) {
      proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input, isOptionalIn, isOptionalOut)));
    } else {
      handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
    }
  }
  if (unrecognized.length) {
    payload.issues.push({
      code: "unrecognized_keys",
      keys: unrecognized,
      input,
      inst
    });
  }
  if (!proms.length)
    return payload;
  return Promise.all(proms).then(() => {
    return payload;
  });
}
var $ZodObject = /* @__PURE__ */ $constructor("$ZodObject", (inst, def) => {
  $ZodType.init(inst, def);
  const desc = Object.getOwnPropertyDescriptor(def, "shape");
  if (!desc?.get) {
    const sh = def.shape;
    Object.defineProperty(def, "shape", {
      get: () => {
        const newSh = { ...sh };
        Object.defineProperty(def, "shape", {
          value: newSh
        });
        return newSh;
      }
    });
  }
  const _normalized = cached(() => normalizeDef(def));
  defineLazy(inst._zod, "propValues", () => {
    const shape = def.shape;
    const propValues = {};
    for (const key in shape) {
      const field = shape[key]._zod;
      if (field.values) {
        propValues[key] ?? (propValues[key] = new Set);
        for (const v of field.values)
          propValues[key].add(v);
      }
    }
    return propValues;
  });
  const isObject2 = isObject;
  const catchall = def.catchall;
  let value;
  inst._zod.parse = (payload, ctx) => {
    value ?? (value = _normalized.value);
    const input = payload.value;
    if (!isObject2(input)) {
      payload.issues.push({
        expected: "object",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    payload.value = {};
    const proms = [];
    const shape = value.shape;
    for (const key of value.keys) {
      const el = shape[key];
      const isOptionalIn = el._zod.optin === "optional";
      const isOptionalOut = el._zod.optout === "optional";
      const r = el._zod.run({ value: input[key], issues: [] }, ctx);
      if (r instanceof Promise) {
        proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input, isOptionalIn, isOptionalOut)));
      } else {
        handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
      }
    }
    if (!catchall) {
      return proms.length ? Promise.all(proms).then(() => payload) : payload;
    }
    return handleCatchall(proms, input, payload, ctx, _normalized.value, inst);
  };
});
var $ZodObjectJIT = /* @__PURE__ */ $constructor("$ZodObjectJIT", (inst, def) => {
  $ZodObject.init(inst, def);
  const superParse = inst._zod.parse;
  const _normalized = cached(() => normalizeDef(def));
  const generateFastpass = (shape) => {
    const doc = new Doc(["shape", "payload", "ctx"]);
    const normalized = _normalized.value;
    const parseStr = (key) => {
      const k = esc(key);
      return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
    };
    doc.write(`const input = payload.value;`);
    const ids = Object.create(null);
    let counter = 0;
    for (const key of normalized.keys) {
      ids[key] = `key_${counter++}`;
    }
    doc.write(`const newResult = {};`);
    for (const key of normalized.keys) {
      const id = ids[key];
      const k = esc(key);
      const schema = shape[key];
      const isOptionalIn = schema?._zod?.optin === "optional";
      const isOptionalOut = schema?._zod?.optout === "optional";
      doc.write(`const ${id} = ${parseStr(key)};`);
      if (isOptionalIn && isOptionalOut) {
        doc.write(`
        if (${id}.issues.length) {
          if (${k} in input) {
            payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${k}, ...iss.path] : [${k}]
            })));
          }
        }

        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }

      `);
      } else if (!isOptionalIn) {
        doc.write(`
        const ${id}_present = ${k} in input;
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
        }

        if (${id}_present) {
          if (${id}.value === undefined) {
            newResult[${k}] = undefined;
          } else {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
      } else {
        doc.write(`
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }

        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }

      `);
      }
    }
    doc.write(`payload.value = newResult;`);
    doc.write(`return payload;`);
    const fn = doc.compile();
    return (payload, ctx) => fn(shape, payload, ctx);
  };
  let fastpass;
  const isObject2 = isObject;
  const jit = !globalConfig.jitless;
  const allowsEval2 = allowsEval;
  const fastEnabled = jit && allowsEval2.value;
  const catchall = def.catchall;
  let value;
  inst._zod.parse = (payload, ctx) => {
    value ?? (value = _normalized.value);
    const input = payload.value;
    if (!isObject2(input)) {
      payload.issues.push({
        expected: "object",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
      if (!fastpass)
        fastpass = generateFastpass(def.shape);
      payload = fastpass(payload, ctx);
      if (!catchall)
        return payload;
      return handleCatchall([], input, payload, ctx, value, inst);
    }
    return superParse(payload, ctx);
  };
});
function handleUnionResults(results, final, inst, ctx) {
  for (const result of results) {
    if (result.issues.length === 0) {
      final.value = result.value;
      return final;
    }
  }
  const nonaborted = results.filter((r) => !aborted(r));
  if (nonaborted.length === 1) {
    final.value = nonaborted[0].value;
    return nonaborted[0];
  }
  final.issues.push({
    code: "invalid_union",
    input: final.value,
    inst,
    errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  });
  return final;
}
var $ZodUnion = /* @__PURE__ */ $constructor("$ZodUnion", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : undefined);
  defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : undefined);
  defineLazy(inst._zod, "values", () => {
    if (def.options.every((o) => o._zod.values)) {
      return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
    }
    return;
  });
  defineLazy(inst._zod, "pattern", () => {
    if (def.options.every((o) => o._zod.pattern)) {
      const patterns = def.options.map((o) => o._zod.pattern);
      return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
    }
    return;
  });
  const first = def.options.length === 1 ? def.options[0]._zod.run : null;
  inst._zod.parse = (payload, ctx) => {
    if (first) {
      return first(payload, ctx);
    }
    let async = false;
    const results = [];
    for (const option of def.options) {
      const result = option._zod.run({
        value: payload.value,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        results.push(result);
        async = true;
      } else {
        if (result.issues.length === 0)
          return result;
        results.push(result);
      }
    }
    if (!async)
      return handleUnionResults(results, payload, inst, ctx);
    return Promise.all(results).then((results2) => {
      return handleUnionResults(results2, payload, inst, ctx);
    });
  };
});
var $ZodDiscriminatedUnion = /* @__PURE__ */ $constructor("$ZodDiscriminatedUnion", (inst, def) => {
  def.inclusive = false;
  $ZodUnion.init(inst, def);
  const _super = inst._zod.parse;
  defineLazy(inst._zod, "propValues", () => {
    const propValues = {};
    for (const option of def.options) {
      const pv = option._zod.propValues;
      if (!pv || Object.keys(pv).length === 0)
        throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(option)}"`);
      for (const [k, v] of Object.entries(pv)) {
        if (!propValues[k])
          propValues[k] = new Set;
        for (const val of v) {
          propValues[k].add(val);
        }
      }
    }
    return propValues;
  });
  const disc = cached(() => {
    const opts = def.options;
    const map = new Map;
    for (const o of opts) {
      const values = o._zod.propValues?.[def.discriminator];
      if (!values || values.size === 0)
        throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(o)}"`);
      for (const v of values) {
        if (map.has(v)) {
          throw new Error(`Duplicate discriminator value "${String(v)}"`);
        }
        map.set(v, o);
      }
    }
    return map;
  });
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!isObject(input)) {
      payload.issues.push({
        code: "invalid_type",
        expected: "object",
        input,
        inst
      });
      return payload;
    }
    const opt = disc.value.get(input?.[def.discriminator]);
    if (opt) {
      return opt._zod.run(payload, ctx);
    }
    if (def.unionFallback || ctx.direction === "backward") {
      return _super(payload, ctx);
    }
    payload.issues.push({
      code: "invalid_union",
      errors: [],
      note: "No matching discriminator",
      discriminator: def.discriminator,
      options: Array.from(disc.value.keys()),
      input,
      path: [def.discriminator],
      inst
    });
    return payload;
  };
});
var $ZodIntersection = /* @__PURE__ */ $constructor("$ZodIntersection", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    const left = def.left._zod.run({ value: input, issues: [] }, ctx);
    const right = def.right._zod.run({ value: input, issues: [] }, ctx);
    const async = left instanceof Promise || right instanceof Promise;
    if (async) {
      return Promise.all([left, right]).then(([left2, right2]) => {
        return handleIntersectionResults(payload, left2, right2);
      });
    }
    return handleIntersectionResults(payload, left, right);
  };
});
function mergeValues(a, b) {
  if (a === b) {
    return { valid: true, data: a };
  }
  if (a instanceof Date && b instanceof Date && +a === +b) {
    return { valid: true, data: a };
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const bKeys = Object.keys(b);
    const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
        };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return { valid: false, mergeErrorPath: [] };
    }
    const newArray = [];
    for (let index = 0;index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
        };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  }
  return { valid: false, mergeErrorPath: [] };
}
function handleIntersectionResults(result, left, right) {
  const unrecKeys = new Map;
  let unrecIssue;
  for (const iss of left.issues) {
    if (iss.code === "unrecognized_keys") {
      unrecIssue ?? (unrecIssue = iss);
      for (const k of iss.keys) {
        if (!unrecKeys.has(k))
          unrecKeys.set(k, {});
        unrecKeys.get(k).l = true;
      }
    } else {
      result.issues.push(iss);
    }
  }
  for (const iss of right.issues) {
    if (iss.code === "unrecognized_keys") {
      for (const k of iss.keys) {
        if (!unrecKeys.has(k))
          unrecKeys.set(k, {});
        unrecKeys.get(k).r = true;
      }
    } else {
      result.issues.push(iss);
    }
  }
  const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
  if (bothKeys.length && unrecIssue) {
    result.issues.push({ ...unrecIssue, keys: bothKeys });
  }
  if (aborted(result))
    return result;
  const merged = mergeValues(left.value, right.value);
  if (!merged.valid) {
    throw new Error(`Unmergable intersection. Error path: ` + `${JSON.stringify(merged.mergeErrorPath)}`);
  }
  result.value = merged.data;
  return result;
}
var $ZodRecord = /* @__PURE__ */ $constructor("$ZodRecord", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!isPlainObject(input)) {
      payload.issues.push({
        expected: "record",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    const proms = [];
    const values = def.keyType._zod.values;
    if (values) {
      payload.value = {};
      const recordKeys = new Set;
      for (const key of values) {
        if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
          recordKeys.add(typeof key === "number" ? key.toString() : key);
          const keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
          if (keyResult instanceof Promise) {
            throw new Error("Async schemas not supported in object keys currently");
          }
          if (keyResult.issues.length) {
            payload.issues.push({
              code: "invalid_key",
              origin: "record",
              issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
              input: key,
              path: [key],
              inst
            });
            continue;
          }
          const outKey = keyResult.value;
          const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
          if (result instanceof Promise) {
            proms.push(result.then((result2) => {
              if (result2.issues.length) {
                payload.issues.push(...prefixIssues(key, result2.issues));
              }
              payload.value[outKey] = result2.value;
            }));
          } else {
            if (result.issues.length) {
              payload.issues.push(...prefixIssues(key, result.issues));
            }
            payload.value[outKey] = result.value;
          }
        }
      }
      let unrecognized;
      for (const key in input) {
        if (!recordKeys.has(key)) {
          unrecognized = unrecognized ?? [];
          unrecognized.push(key);
        }
      }
      if (unrecognized && unrecognized.length > 0) {
        payload.issues.push({
          code: "unrecognized_keys",
          input,
          inst,
          keys: unrecognized
        });
      }
    } else {
      payload.value = {};
      for (const key of Reflect.ownKeys(input)) {
        if (key === "__proto__")
          continue;
        if (!Object.prototype.propertyIsEnumerable.call(input, key))
          continue;
        let keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
        if (keyResult instanceof Promise) {
          throw new Error("Async schemas not supported in object keys currently");
        }
        const checkNumericKey = typeof key === "string" && number.test(key) && keyResult.issues.length;
        if (checkNumericKey) {
          const retryResult = def.keyType._zod.run({ value: Number(key), issues: [] }, ctx);
          if (retryResult instanceof Promise) {
            throw new Error("Async schemas not supported in object keys currently");
          }
          if (retryResult.issues.length === 0) {
            keyResult = retryResult;
          }
        }
        if (keyResult.issues.length) {
          if (def.mode === "loose") {
            payload.value[key] = input[key];
          } else {
            payload.issues.push({
              code: "invalid_key",
              origin: "record",
              issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
              input: key,
              path: [key],
              inst
            });
          }
          continue;
        }
        const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
        if (result instanceof Promise) {
          proms.push(result.then((result2) => {
            if (result2.issues.length) {
              payload.issues.push(...prefixIssues(key, result2.issues));
            }
            payload.value[keyResult.value] = result2.value;
          }));
        } else {
          if (result.issues.length) {
            payload.issues.push(...prefixIssues(key, result.issues));
          }
          payload.value[keyResult.value] = result.value;
        }
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => payload);
    }
    return payload;
  };
});
var $ZodEnum = /* @__PURE__ */ $constructor("$ZodEnum", (inst, def) => {
  $ZodType.init(inst, def);
  const values = getEnumValues(def.entries);
  const valuesSet = new Set(values);
  inst._zod.values = valuesSet;
  inst._zod.pattern = new RegExp(`^(${values.filter((k) => propertyKeyTypes.has(typeof k)).map((o) => typeof o === "string" ? escapeRegex(o) : o.toString()).join("|")})$`);
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (valuesSet.has(input)) {
      return payload;
    }
    payload.issues.push({
      code: "invalid_value",
      values,
      input,
      inst
    });
    return payload;
  };
});
var $ZodLiteral = /* @__PURE__ */ $constructor("$ZodLiteral", (inst, def) => {
  $ZodType.init(inst, def);
  if (def.values.length === 0) {
    throw new Error("Cannot create literal schema with no valid values");
  }
  const values = new Set(def.values);
  inst._zod.values = values;
  inst._zod.pattern = new RegExp(`^(${def.values.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$`);
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (values.has(input)) {
      return payload;
    }
    payload.issues.push({
      code: "invalid_value",
      values: def.values,
      input,
      inst
    });
    return payload;
  };
});
var $ZodTransform = /* @__PURE__ */ $constructor("$ZodTransform", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      throw new $ZodEncodeError(inst.constructor.name);
    }
    const _out = def.transform(payload.value, payload);
    if (ctx.async) {
      const output = _out instanceof Promise ? _out : Promise.resolve(_out);
      return output.then((output2) => {
        payload.value = output2;
        payload.fallback = true;
        return payload;
      });
    }
    if (_out instanceof Promise) {
      throw new $ZodAsyncError;
    }
    payload.value = _out;
    payload.fallback = true;
    return payload;
  };
});
function handleOptionalResult(result, input) {
  if (input === undefined && (result.issues.length || result.fallback)) {
    return { issues: [], value: undefined };
  }
  return result;
}
var $ZodOptional = /* @__PURE__ */ $constructor("$ZodOptional", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  inst._zod.optout = "optional";
  defineLazy(inst._zod, "values", () => {
    return def.innerType._zod.values ? new Set([...def.innerType._zod.values, undefined]) : undefined;
  });
  defineLazy(inst._zod, "pattern", () => {
    const pattern = def.innerType._zod.pattern;
    return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : undefined;
  });
  inst._zod.parse = (payload, ctx) => {
    if (def.innerType._zod.optin === "optional") {
      const input = payload.value;
      const result = def.innerType._zod.run(payload, ctx);
      if (result instanceof Promise)
        return result.then((r) => handleOptionalResult(r, input));
      return handleOptionalResult(result, input);
    }
    if (payload.value === undefined) {
      return payload;
    }
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodExactOptional = /* @__PURE__ */ $constructor("$ZodExactOptional", (inst, def) => {
  $ZodOptional.init(inst, def);
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  defineLazy(inst._zod, "pattern", () => def.innerType._zod.pattern);
  inst._zod.parse = (payload, ctx) => {
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodNullable = /* @__PURE__ */ $constructor("$ZodNullable", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
  defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
  defineLazy(inst._zod, "pattern", () => {
    const pattern = def.innerType._zod.pattern;
    return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : undefined;
  });
  defineLazy(inst._zod, "values", () => {
    return def.innerType._zod.values ? new Set([...def.innerType._zod.values, null]) : undefined;
  });
  inst._zod.parse = (payload, ctx) => {
    if (payload.value === null)
      return payload;
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodDefault = /* @__PURE__ */ $constructor("$ZodDefault", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    if (payload.value === undefined) {
      payload.value = def.defaultValue;
      return payload;
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => handleDefaultResult(result2, def));
    }
    return handleDefaultResult(result, def);
  };
});
function handleDefaultResult(payload, def) {
  if (payload.value === undefined) {
    payload.value = def.defaultValue;
  }
  return payload;
}
var $ZodPrefault = /* @__PURE__ */ $constructor("$ZodPrefault", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    if (payload.value === undefined) {
      payload.value = def.defaultValue;
    }
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodNonOptional = /* @__PURE__ */ $constructor("$ZodNonOptional", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "values", () => {
    const v = def.innerType._zod.values;
    return v ? new Set([...v].filter((x) => x !== undefined)) : undefined;
  });
  inst._zod.parse = (payload, ctx) => {
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => handleNonOptionalResult(result2, inst));
    }
    return handleNonOptionalResult(result, inst);
  };
});
function handleNonOptionalResult(payload, inst) {
  if (!payload.issues.length && payload.value === undefined) {
    payload.issues.push({
      code: "invalid_type",
      expected: "nonoptional",
      input: payload.value,
      inst
    });
  }
  return payload;
}
var $ZodCatch = /* @__PURE__ */ $constructor("$ZodCatch", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => {
        payload.value = result2.value;
        if (result2.issues.length) {
          payload.value = def.catchValue({
            ...payload,
            error: {
              issues: result2.issues.map((iss) => finalizeIssue(iss, ctx, config()))
            },
            input: payload.value
          });
          payload.issues = [];
          payload.fallback = true;
        }
        return payload;
      });
    }
    payload.value = result.value;
    if (result.issues.length) {
      payload.value = def.catchValue({
        ...payload,
        error: {
          issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config()))
        },
        input: payload.value
      });
      payload.issues = [];
      payload.fallback = true;
    }
    return payload;
  };
});
var $ZodPipe = /* @__PURE__ */ $constructor("$ZodPipe", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "values", () => def.in._zod.values);
  defineLazy(inst._zod, "optin", () => def.in._zod.optin);
  defineLazy(inst._zod, "optout", () => def.out._zod.optout);
  defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      const right = def.out._zod.run(payload, ctx);
      if (right instanceof Promise) {
        return right.then((right2) => handlePipeResult(right2, def.in, ctx));
      }
      return handlePipeResult(right, def.in, ctx);
    }
    const left = def.in._zod.run(payload, ctx);
    if (left instanceof Promise) {
      return left.then((left2) => handlePipeResult(left2, def.out, ctx));
    }
    return handlePipeResult(left, def.out, ctx);
  };
});
function handlePipeResult(left, next, ctx) {
  if (left.issues.length) {
    left.aborted = true;
    return left;
  }
  return next._zod.run({ value: left.value, issues: left.issues, fallback: left.fallback }, ctx);
}
var $ZodReadonly = /* @__PURE__ */ $constructor("$ZodReadonly", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "propValues", () => def.innerType._zod.propValues);
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  defineLazy(inst._zod, "optin", () => def.innerType?._zod?.optin);
  defineLazy(inst._zod, "optout", () => def.innerType?._zod?.optout);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then(handleReadonlyResult);
    }
    return handleReadonlyResult(result);
  };
});
function handleReadonlyResult(payload) {
  payload.value = Object.freeze(payload.value);
  return payload;
}
var $ZodLazy = /* @__PURE__ */ $constructor("$ZodLazy", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "innerType", () => {
    const d = def;
    if (!d._cachedInner)
      d._cachedInner = def.getter();
    return d._cachedInner;
  });
  defineLazy(inst._zod, "pattern", () => inst._zod.innerType?._zod?.pattern);
  defineLazy(inst._zod, "propValues", () => inst._zod.innerType?._zod?.propValues);
  defineLazy(inst._zod, "optin", () => inst._zod.innerType?._zod?.optin ?? undefined);
  defineLazy(inst._zod, "optout", () => inst._zod.innerType?._zod?.optout ?? undefined);
  inst._zod.parse = (payload, ctx) => {
    const inner = inst._zod.innerType;
    return inner._zod.run(payload, ctx);
  };
});
var $ZodCustom = /* @__PURE__ */ $constructor("$ZodCustom", (inst, def) => {
  $ZodCheck.init(inst, def);
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _) => {
    return payload;
  };
  inst._zod.check = (payload) => {
    const input = payload.value;
    const r = def.fn(input);
    if (r instanceof Promise) {
      return r.then((r2) => handleRefineResult(r2, payload, input, inst));
    }
    handleRefineResult(r, payload, input, inst);
    return;
  };
});
function handleRefineResult(result, payload, input, inst) {
  if (!result) {
    const _iss = {
      code: "custom",
      input,
      inst,
      path: [...inst._zod.def.path ?? []],
      continue: !inst._zod.def.abort
    };
    if (inst._zod.def.params)
      _iss.params = inst._zod.def.params;
    payload.issues.push(issue(_iss));
  }
}
// node_modules/zod/v4/core/registries.js
var _a19;
var $output = Symbol("ZodOutput");
var $input = Symbol("ZodInput");

class $ZodRegistry {
  constructor() {
    this._map = new WeakMap;
    this._idmap = new Map;
  }
  add(schema, ..._meta) {
    const meta = _meta[0];
    this._map.set(schema, meta);
    if (meta && typeof meta === "object" && "id" in meta) {
      this._idmap.set(meta.id, schema);
    }
    return this;
  }
  clear() {
    this._map = new WeakMap;
    this._idmap = new Map;
    return this;
  }
  remove(schema) {
    const meta = this._map.get(schema);
    if (meta && typeof meta === "object" && "id" in meta) {
      this._idmap.delete(meta.id);
    }
    this._map.delete(schema);
    return this;
  }
  get(schema) {
    const p = schema._zod.parent;
    if (p) {
      const pm = { ...this.get(p) ?? {} };
      delete pm.id;
      const f = { ...pm, ...this._map.get(schema) };
      return Object.keys(f).length ? f : undefined;
    }
    return this._map.get(schema);
  }
  has(schema) {
    return this._map.has(schema);
  }
}
function registry() {
  return new $ZodRegistry;
}
(_a19 = globalThis).__zod_globalRegistry ?? (_a19.__zod_globalRegistry = registry());
var globalRegistry = globalThis.__zod_globalRegistry;
// node_modules/zod/v4/core/api.js
function _string(Class2, params) {
  return new Class2({
    type: "string",
    ...normalizeParams(params)
  });
}
function _email(Class2, params) {
  return new Class2({
    type: "string",
    format: "email",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _guid(Class2, params) {
  return new Class2({
    type: "string",
    format: "guid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _uuid(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _uuidv4(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v4",
    ...normalizeParams(params)
  });
}
function _uuidv6(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v6",
    ...normalizeParams(params)
  });
}
function _uuidv7(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v7",
    ...normalizeParams(params)
  });
}
function _url(Class2, params) {
  return new Class2({
    type: "string",
    format: "url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _emoji2(Class2, params) {
  return new Class2({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _nanoid(Class2, params) {
  return new Class2({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _cuid(Class2, params) {
  return new Class2({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _cuid2(Class2, params) {
  return new Class2({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _ulid(Class2, params) {
  return new Class2({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _xid(Class2, params) {
  return new Class2({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _ksuid(Class2, params) {
  return new Class2({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _ipv4(Class2, params) {
  return new Class2({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _ipv6(Class2, params) {
  return new Class2({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _cidrv4(Class2, params) {
  return new Class2({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _cidrv6(Class2, params) {
  return new Class2({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _base64(Class2, params) {
  return new Class2({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _base64url(Class2, params) {
  return new Class2({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _e164(Class2, params) {
  return new Class2({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _jwt(Class2, params) {
  return new Class2({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _isoDateTime(Class2, params) {
  return new Class2({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: false,
    local: false,
    precision: null,
    ...normalizeParams(params)
  });
}
function _isoDate(Class2, params) {
  return new Class2({
    type: "string",
    format: "date",
    check: "string_format",
    ...normalizeParams(params)
  });
}
function _isoTime(Class2, params) {
  return new Class2({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ...normalizeParams(params)
  });
}
function _isoDuration(Class2, params) {
  return new Class2({
    type: "string",
    format: "duration",
    check: "string_format",
    ...normalizeParams(params)
  });
}
function _number(Class2, params) {
  return new Class2({
    type: "number",
    checks: [],
    ...normalizeParams(params)
  });
}
function _int(Class2, params) {
  return new Class2({
    type: "number",
    check: "number_format",
    abort: false,
    format: "safeint",
    ...normalizeParams(params)
  });
}
function _boolean(Class2, params) {
  return new Class2({
    type: "boolean",
    ...normalizeParams(params)
  });
}
function _null2(Class2, params) {
  return new Class2({
    type: "null",
    ...normalizeParams(params)
  });
}
function _any(Class2) {
  return new Class2({
    type: "any"
  });
}
function _unknown(Class2) {
  return new Class2({
    type: "unknown"
  });
}
function _never(Class2, params) {
  return new Class2({
    type: "never",
    ...normalizeParams(params)
  });
}
function _lt(value, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
function _lte(value, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
function _gt(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
function _gte(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
function _multipleOf(value, params) {
  return new $ZodCheckMultipleOf({
    check: "multiple_of",
    ...normalizeParams(params),
    value
  });
}
function _maxLength(maximum, params) {
  const ch = new $ZodCheckMaxLength({
    check: "max_length",
    ...normalizeParams(params),
    maximum
  });
  return ch;
}
function _minLength(minimum, params) {
  return new $ZodCheckMinLength({
    check: "min_length",
    ...normalizeParams(params),
    minimum
  });
}
function _length(length, params) {
  return new $ZodCheckLengthEquals({
    check: "length_equals",
    ...normalizeParams(params),
    length
  });
}
function _regex(pattern, params) {
  return new $ZodCheckRegex({
    check: "string_format",
    format: "regex",
    ...normalizeParams(params),
    pattern
  });
}
function _lowercase(params) {
  return new $ZodCheckLowerCase({
    check: "string_format",
    format: "lowercase",
    ...normalizeParams(params)
  });
}
function _uppercase(params) {
  return new $ZodCheckUpperCase({
    check: "string_format",
    format: "uppercase",
    ...normalizeParams(params)
  });
}
function _includes(includes, params) {
  return new $ZodCheckIncludes({
    check: "string_format",
    format: "includes",
    ...normalizeParams(params),
    includes
  });
}
function _startsWith(prefix, params) {
  return new $ZodCheckStartsWith({
    check: "string_format",
    format: "starts_with",
    ...normalizeParams(params),
    prefix
  });
}
function _endsWith(suffix, params) {
  return new $ZodCheckEndsWith({
    check: "string_format",
    format: "ends_with",
    ...normalizeParams(params),
    suffix
  });
}
function _overwrite(tx) {
  return new $ZodCheckOverwrite({
    check: "overwrite",
    tx
  });
}
function _normalize(form) {
  return _overwrite((input) => input.normalize(form));
}
function _trim() {
  return _overwrite((input) => input.trim());
}
function _toLowerCase() {
  return _overwrite((input) => input.toLowerCase());
}
function _toUpperCase() {
  return _overwrite((input) => input.toUpperCase());
}
function _slugify() {
  return _overwrite((input) => slugify(input));
}
function _array(Class2, element, params) {
  return new Class2({
    type: "array",
    element,
    ...normalizeParams(params)
  });
}
function _custom(Class2, fn, _params) {
  const norm = normalizeParams(_params);
  norm.abort ?? (norm.abort = true);
  const schema = new Class2({
    type: "custom",
    check: "custom",
    fn,
    ...norm
  });
  return schema;
}
function _refine(Class2, fn, _params) {
  const schema = new Class2({
    type: "custom",
    check: "custom",
    fn,
    ...normalizeParams(_params)
  });
  return schema;
}
function _superRefine(fn, params) {
  const ch = _check((payload) => {
    payload.addIssue = (issue2) => {
      if (typeof issue2 === "string") {
        payload.issues.push(issue(issue2, payload.value, ch._zod.def));
      } else {
        const _issue = issue2;
        if (_issue.fatal)
          _issue.continue = false;
        _issue.code ?? (_issue.code = "custom");
        _issue.input ?? (_issue.input = payload.value);
        _issue.inst ?? (_issue.inst = ch);
        _issue.continue ?? (_issue.continue = !ch._zod.def.abort);
        payload.issues.push(issue(_issue));
      }
    };
    return fn(payload.value, payload);
  }, params);
  return ch;
}
function _check(fn, params) {
  const ch = new $ZodCheck({
    check: "custom",
    ...normalizeParams(params)
  });
  ch._zod.check = fn;
  return ch;
}
// node_modules/zod/v4/core/to-json-schema.js
function initializeContext(params) {
  let target = params?.target ?? "draft-2020-12";
  if (target === "draft-4")
    target = "draft-04";
  if (target === "draft-7")
    target = "draft-07";
  return {
    processors: params.processors ?? {},
    metadataRegistry: params?.metadata ?? globalRegistry,
    target,
    unrepresentable: params?.unrepresentable ?? "throw",
    override: params?.override ?? (() => {}),
    io: params?.io ?? "output",
    counter: 0,
    seen: new Map,
    cycles: params?.cycles ?? "ref",
    reused: params?.reused ?? "inline",
    external: params?.external ?? undefined
  };
}
function process2(schema, ctx, _params = { path: [], schemaPath: [] }) {
  var _a18;
  const def = schema._zod.def;
  const seen = ctx.seen.get(schema);
  if (seen) {
    seen.count++;
    const isCycle = _params.schemaPath.includes(schema);
    if (isCycle) {
      seen.cycle = _params.path;
    }
    return seen.schema;
  }
  const result = { schema: {}, count: 1, cycle: undefined, path: _params.path };
  ctx.seen.set(schema, result);
  const overrideSchema = schema._zod.toJSONSchema?.();
  if (overrideSchema) {
    result.schema = overrideSchema;
  } else {
    const params = {
      ..._params,
      schemaPath: [..._params.schemaPath, schema],
      path: _params.path
    };
    if (schema._zod.processJSONSchema) {
      schema._zod.processJSONSchema(ctx, result.schema, params);
    } else {
      const _json = result.schema;
      const processor = ctx.processors[def.type];
      if (!processor) {
        throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
      }
      processor(schema, ctx, _json, params);
    }
    const parent = schema._zod.parent;
    if (parent) {
      if (!result.ref)
        result.ref = parent;
      process2(parent, ctx, params);
      ctx.seen.get(parent).isParent = true;
    }
  }
  const meta = ctx.metadataRegistry.get(schema);
  if (meta)
    Object.assign(result.schema, meta);
  if (ctx.io === "input" && isTransforming(schema)) {
    delete result.schema.examples;
    delete result.schema.default;
  }
  if (ctx.io === "input" && "_prefault" in result.schema)
    (_a18 = result.schema).default ?? (_a18.default = result.schema._prefault);
  delete result.schema._prefault;
  const _result = ctx.seen.get(schema);
  return _result.schema;
}
function extractDefs(ctx, schema) {
  const root = ctx.seen.get(schema);
  if (!root)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const idToSchema = new Map;
  for (const entry of ctx.seen.entries()) {
    const id = ctx.metadataRegistry.get(entry[0])?.id;
    if (id) {
      const existing = idToSchema.get(id);
      if (existing && existing !== entry[0]) {
        throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
      }
      idToSchema.set(id, entry[0]);
    }
  }
  const makeURI = (entry) => {
    const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
    if (ctx.external) {
      const externalId = ctx.external.registry.get(entry[0])?.id;
      const uriGenerator = ctx.external.uri ?? ((id2) => id2);
      if (externalId) {
        return { ref: uriGenerator(externalId) };
      }
      const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
      entry[1].defId = id;
      return { defId: id, ref: `${uriGenerator("__shared")}#/${defsSegment}/${id}` };
    }
    if (entry[1] === root) {
      return { ref: "#" };
    }
    const uriPrefix = `#`;
    const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
    const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
    return { defId, ref: defUriPrefix + defId };
  };
  const extractToDef = (entry) => {
    if (entry[1].schema.$ref) {
      return;
    }
    const seen = entry[1];
    const { ref, defId } = makeURI(entry);
    seen.def = { ...seen.schema };
    if (defId)
      seen.defId = defId;
    const schema2 = seen.schema;
    for (const key in schema2) {
      delete schema2[key];
    }
    schema2.$ref = ref;
  };
  if (ctx.cycles === "throw") {
    for (const entry of ctx.seen.entries()) {
      const seen = entry[1];
      if (seen.cycle) {
        throw new Error("Cycle detected: " + `#/${seen.cycle?.join("/")}/<root>` + '\n\nSet the `cycles` parameter to `"ref"` to resolve cyclical schemas with defs.');
      }
    }
  }
  for (const entry of ctx.seen.entries()) {
    const seen = entry[1];
    if (schema === entry[0]) {
      extractToDef(entry);
      continue;
    }
    if (ctx.external) {
      const ext = ctx.external.registry.get(entry[0])?.id;
      if (schema !== entry[0] && ext) {
        extractToDef(entry);
        continue;
      }
    }
    const id = ctx.metadataRegistry.get(entry[0])?.id;
    if (id) {
      extractToDef(entry);
      continue;
    }
    if (seen.cycle) {
      extractToDef(entry);
      continue;
    }
    if (seen.count > 1) {
      if (ctx.reused === "ref") {
        extractToDef(entry);
        continue;
      }
    }
  }
}
function finalize(ctx, schema) {
  const root = ctx.seen.get(schema);
  if (!root)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const flattenRef = (zodSchema) => {
    const seen = ctx.seen.get(zodSchema);
    if (seen.ref === null)
      return;
    const schema2 = seen.def ?? seen.schema;
    const _cached = { ...schema2 };
    const ref = seen.ref;
    seen.ref = null;
    if (ref) {
      flattenRef(ref);
      const refSeen = ctx.seen.get(ref);
      const refSchema = refSeen.schema;
      if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
        schema2.allOf = schema2.allOf ?? [];
        schema2.allOf.push(refSchema);
      } else {
        Object.assign(schema2, refSchema);
      }
      Object.assign(schema2, _cached);
      const isParentRef = zodSchema._zod.parent === ref;
      if (isParentRef) {
        for (const key in schema2) {
          if (key === "$ref" || key === "allOf")
            continue;
          if (!(key in _cached)) {
            delete schema2[key];
          }
        }
      }
      if (refSchema.$ref && refSeen.def) {
        for (const key in schema2) {
          if (key === "$ref" || key === "allOf")
            continue;
          if (key in refSeen.def && JSON.stringify(schema2[key]) === JSON.stringify(refSeen.def[key])) {
            delete schema2[key];
          }
        }
      }
    }
    const parent = zodSchema._zod.parent;
    if (parent && parent !== ref) {
      flattenRef(parent);
      const parentSeen = ctx.seen.get(parent);
      if (parentSeen?.schema.$ref) {
        schema2.$ref = parentSeen.schema.$ref;
        if (parentSeen.def) {
          for (const key in schema2) {
            if (key === "$ref" || key === "allOf")
              continue;
            if (key in parentSeen.def && JSON.stringify(schema2[key]) === JSON.stringify(parentSeen.def[key])) {
              delete schema2[key];
            }
          }
        }
      }
    }
    ctx.override({
      zodSchema,
      jsonSchema: schema2,
      path: seen.path ?? []
    });
  };
  for (const entry of [...ctx.seen.entries()].reverse()) {
    flattenRef(entry[0]);
  }
  const result = {};
  if (ctx.target === "draft-2020-12") {
    result.$schema = "https://json-schema.org/draft/2020-12/schema";
  } else if (ctx.target === "draft-07") {
    result.$schema = "http://json-schema.org/draft-07/schema#";
  } else if (ctx.target === "draft-04") {
    result.$schema = "http://json-schema.org/draft-04/schema#";
  } else if (ctx.target === "openapi-3.0") {}
  if (ctx.external?.uri) {
    const id = ctx.external.registry.get(schema)?.id;
    if (!id)
      throw new Error("Schema is missing an `id` property");
    result.$id = ctx.external.uri(id);
  }
  Object.assign(result, root.def ?? root.schema);
  const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
  if (rootMetaId !== undefined && result.id === rootMetaId)
    delete result.id;
  const defs = ctx.external?.defs ?? {};
  for (const entry of ctx.seen.entries()) {
    const seen = entry[1];
    if (seen.def && seen.defId) {
      if (seen.def.id === seen.defId)
        delete seen.def.id;
      defs[seen.defId] = seen.def;
    }
  }
  if (ctx.external) {} else {
    if (Object.keys(defs).length > 0) {
      if (ctx.target === "draft-2020-12") {
        result.$defs = defs;
      } else {
        result.definitions = defs;
      }
    }
  }
  try {
    const finalized = JSON.parse(JSON.stringify(result));
    Object.defineProperty(finalized, "~standard", {
      value: {
        ...schema["~standard"],
        jsonSchema: {
          input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
          output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
        }
      },
      enumerable: false,
      writable: false
    });
    return finalized;
  } catch (_err) {
    throw new Error("Error converting schema to JSON.");
  }
}
function isTransforming(_schema, _ctx) {
  const ctx = _ctx ?? { seen: new Set };
  if (ctx.seen.has(_schema))
    return false;
  ctx.seen.add(_schema);
  const def = _schema._zod.def;
  if (def.type === "transform")
    return true;
  if (def.type === "array")
    return isTransforming(def.element, ctx);
  if (def.type === "set")
    return isTransforming(def.valueType, ctx);
  if (def.type === "lazy")
    return isTransforming(def.getter(), ctx);
  if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault") {
    return isTransforming(def.innerType, ctx);
  }
  if (def.type === "intersection") {
    return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
  }
  if (def.type === "record" || def.type === "map") {
    return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
  }
  if (def.type === "pipe") {
    if (_schema._zod.traits.has("$ZodCodec"))
      return true;
    return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
  }
  if (def.type === "object") {
    for (const key in def.shape) {
      if (isTransforming(def.shape[key], ctx))
        return true;
    }
    return false;
  }
  if (def.type === "union") {
    for (const option of def.options) {
      if (isTransforming(option, ctx))
        return true;
    }
    return false;
  }
  if (def.type === "tuple") {
    for (const item of def.items) {
      if (isTransforming(item, ctx))
        return true;
    }
    if (def.rest && isTransforming(def.rest, ctx))
      return true;
    return false;
  }
  return false;
}
var createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
  const ctx = initializeContext({ ...params, processors });
  process2(schema, ctx);
  extractDefs(ctx, schema);
  return finalize(ctx, schema);
};
var createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
  const { libraryOptions, target } = params ?? {};
  const ctx = initializeContext({ ...libraryOptions ?? {}, target, io, processors });
  process2(schema, ctx);
  extractDefs(ctx, schema);
  return finalize(ctx, schema);
};
// node_modules/zod/v4/core/json-schema-processors.js
var formatMap = {
  guid: "uuid",
  url: "uri",
  datetime: "date-time",
  json_string: "json-string",
  regex: ""
};
var stringProcessor = (schema, ctx, _json, _params) => {
  const json = _json;
  json.type = "string";
  const { minimum, maximum, format, patterns, contentEncoding } = schema._zod.bag;
  if (typeof minimum === "number")
    json.minLength = minimum;
  if (typeof maximum === "number")
    json.maxLength = maximum;
  if (format) {
    json.format = formatMap[format] ?? format;
    if (json.format === "")
      delete json.format;
    if (format === "time") {
      delete json.format;
    }
  }
  if (contentEncoding)
    json.contentEncoding = contentEncoding;
  if (patterns && patterns.size > 0) {
    const regexes = [...patterns];
    if (regexes.length === 1)
      json.pattern = regexes[0].source;
    else if (regexes.length > 1) {
      json.allOf = [
        ...regexes.map((regex) => ({
          ...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
          pattern: regex.source
        }))
      ];
    }
  }
};
var numberProcessor = (schema, ctx, _json, _params) => {
  const json = _json;
  const { minimum, maximum, format, multipleOf, exclusiveMaximum, exclusiveMinimum } = schema._zod.bag;
  if (typeof format === "string" && format.includes("int"))
    json.type = "integer";
  else
    json.type = "number";
  const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
  const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
  const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
  if (exMin) {
    if (legacy) {
      json.minimum = exclusiveMinimum;
      json.exclusiveMinimum = true;
    } else {
      json.exclusiveMinimum = exclusiveMinimum;
    }
  } else if (typeof minimum === "number") {
    json.minimum = minimum;
  }
  if (exMax) {
    if (legacy) {
      json.maximum = exclusiveMaximum;
      json.exclusiveMaximum = true;
    } else {
      json.exclusiveMaximum = exclusiveMaximum;
    }
  } else if (typeof maximum === "number") {
    json.maximum = maximum;
  }
  if (typeof multipleOf === "number")
    json.multipleOf = multipleOf;
};
var booleanProcessor = (_schema, _ctx, json, _params) => {
  json.type = "boolean";
};
var bigintProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("BigInt cannot be represented in JSON Schema");
  }
};
var symbolProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Symbols cannot be represented in JSON Schema");
  }
};
var nullProcessor = (_schema, ctx, json, _params) => {
  if (ctx.target === "openapi-3.0") {
    json.type = "string";
    json.nullable = true;
    json.enum = [null];
  } else {
    json.type = "null";
  }
};
var undefinedProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Undefined cannot be represented in JSON Schema");
  }
};
var voidProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Void cannot be represented in JSON Schema");
  }
};
var neverProcessor = (_schema, _ctx, json, _params) => {
  json.not = {};
};
var anyProcessor = (_schema, _ctx, _json, _params) => {};
var unknownProcessor = (_schema, _ctx, _json, _params) => {};
var dateProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Date cannot be represented in JSON Schema");
  }
};
var enumProcessor = (schema, _ctx, json, _params) => {
  const def = schema._zod.def;
  const values = getEnumValues(def.entries);
  if (values.every((v) => typeof v === "number"))
    json.type = "number";
  if (values.every((v) => typeof v === "string"))
    json.type = "string";
  json.enum = values;
};
var literalProcessor = (schema, ctx, json, _params) => {
  const def = schema._zod.def;
  const vals = [];
  for (const val of def.values) {
    if (val === undefined) {
      if (ctx.unrepresentable === "throw") {
        throw new Error("Literal `undefined` cannot be represented in JSON Schema");
      }
    } else if (typeof val === "bigint") {
      if (ctx.unrepresentable === "throw") {
        throw new Error("BigInt literals cannot be represented in JSON Schema");
      } else {
        vals.push(Number(val));
      }
    } else {
      vals.push(val);
    }
  }
  if (vals.length === 0) {} else if (vals.length === 1) {
    const val = vals[0];
    json.type = val === null ? "null" : typeof val;
    if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") {
      json.enum = [val];
    } else {
      json.const = val;
    }
  } else {
    if (vals.every((v) => typeof v === "number"))
      json.type = "number";
    if (vals.every((v) => typeof v === "string"))
      json.type = "string";
    if (vals.every((v) => typeof v === "boolean"))
      json.type = "boolean";
    if (vals.every((v) => v === null))
      json.type = "null";
    json.enum = vals;
  }
};
var nanProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("NaN cannot be represented in JSON Schema");
  }
};
var templateLiteralProcessor = (schema, _ctx, json, _params) => {
  const _json = json;
  const pattern = schema._zod.pattern;
  if (!pattern)
    throw new Error("Pattern not found in template literal");
  _json.type = "string";
  _json.pattern = pattern.source;
};
var fileProcessor = (schema, _ctx, json, _params) => {
  const _json = json;
  const file = {
    type: "string",
    format: "binary",
    contentEncoding: "binary"
  };
  const { minimum, maximum, mime } = schema._zod.bag;
  if (minimum !== undefined)
    file.minLength = minimum;
  if (maximum !== undefined)
    file.maxLength = maximum;
  if (mime) {
    if (mime.length === 1) {
      file.contentMediaType = mime[0];
      Object.assign(_json, file);
    } else {
      Object.assign(_json, file);
      _json.anyOf = mime.map((m) => ({ contentMediaType: m }));
    }
  } else {
    Object.assign(_json, file);
  }
};
var successProcessor = (_schema, _ctx, json, _params) => {
  json.type = "boolean";
};
var customProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Custom types cannot be represented in JSON Schema");
  }
};
var functionProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Function types cannot be represented in JSON Schema");
  }
};
var transformProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Transforms cannot be represented in JSON Schema");
  }
};
var mapProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Map cannot be represented in JSON Schema");
  }
};
var setProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Set cannot be represented in JSON Schema");
  }
};
var arrayProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  const { minimum, maximum } = schema._zod.bag;
  if (typeof minimum === "number")
    json.minItems = minimum;
  if (typeof maximum === "number")
    json.maxItems = maximum;
  json.type = "array";
  json.items = process2(def.element, ctx, {
    ...params,
    path: [...params.path, "items"]
  });
};
var objectProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  json.type = "object";
  json.properties = {};
  const shape = def.shape;
  for (const key in shape) {
    json.properties[key] = process2(shape[key], ctx, {
      ...params,
      path: [...params.path, "properties", key]
    });
  }
  const allKeys = new Set(Object.keys(shape));
  const requiredKeys = new Set([...allKeys].filter((key) => {
    const v = def.shape[key]._zod;
    if (ctx.io === "input") {
      return v.optin === undefined;
    } else {
      return v.optout === undefined;
    }
  }));
  if (requiredKeys.size > 0) {
    json.required = Array.from(requiredKeys);
  }
  if (def.catchall?._zod.def.type === "never") {
    json.additionalProperties = false;
  } else if (!def.catchall) {
    if (ctx.io === "output")
      json.additionalProperties = false;
  } else if (def.catchall) {
    json.additionalProperties = process2(def.catchall, ctx, {
      ...params,
      path: [...params.path, "additionalProperties"]
    });
  }
};
var unionProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const isExclusive = def.inclusive === false;
  const options = def.options.map((x, i) => process2(x, ctx, {
    ...params,
    path: [...params.path, isExclusive ? "oneOf" : "anyOf", i]
  }));
  if (isExclusive) {
    json.oneOf = options;
  } else {
    json.anyOf = options;
  }
};
var intersectionProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const a = process2(def.left, ctx, {
    ...params,
    path: [...params.path, "allOf", 0]
  });
  const b = process2(def.right, ctx, {
    ...params,
    path: [...params.path, "allOf", 1]
  });
  const isSimpleIntersection = (val) => ("allOf" in val) && Object.keys(val).length === 1;
  const allOf = [
    ...isSimpleIntersection(a) ? a.allOf : [a],
    ...isSimpleIntersection(b) ? b.allOf : [b]
  ];
  json.allOf = allOf;
};
var tupleProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  json.type = "array";
  const prefixPath = ctx.target === "draft-2020-12" ? "prefixItems" : "items";
  const restPath = ctx.target === "draft-2020-12" ? "items" : ctx.target === "openapi-3.0" ? "items" : "additionalItems";
  const prefixItems = def.items.map((x, i) => process2(x, ctx, {
    ...params,
    path: [...params.path, prefixPath, i]
  }));
  const rest = def.rest ? process2(def.rest, ctx, {
    ...params,
    path: [...params.path, restPath, ...ctx.target === "openapi-3.0" ? [def.items.length] : []]
  }) : null;
  if (ctx.target === "draft-2020-12") {
    json.prefixItems = prefixItems;
    if (rest) {
      json.items = rest;
    }
  } else if (ctx.target === "openapi-3.0") {
    json.items = {
      anyOf: prefixItems
    };
    if (rest) {
      json.items.anyOf.push(rest);
    }
    json.minItems = prefixItems.length;
    if (!rest) {
      json.maxItems = prefixItems.length;
    }
  } else {
    json.items = prefixItems;
    if (rest) {
      json.additionalItems = rest;
    }
  }
  const { minimum, maximum } = schema._zod.bag;
  if (typeof minimum === "number")
    json.minItems = minimum;
  if (typeof maximum === "number")
    json.maxItems = maximum;
};
var recordProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  json.type = "object";
  const keyType = def.keyType;
  const keyBag = keyType._zod.bag;
  const patterns = keyBag?.patterns;
  if (def.mode === "loose" && patterns && patterns.size > 0) {
    const valueSchema = process2(def.valueType, ctx, {
      ...params,
      path: [...params.path, "patternProperties", "*"]
    });
    json.patternProperties = {};
    for (const pattern of patterns) {
      json.patternProperties[pattern.source] = valueSchema;
    }
  } else {
    if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") {
      json.propertyNames = process2(def.keyType, ctx, {
        ...params,
        path: [...params.path, "propertyNames"]
      });
    }
    json.additionalProperties = process2(def.valueType, ctx, {
      ...params,
      path: [...params.path, "additionalProperties"]
    });
  }
  const keyValues = keyType._zod.values;
  if (keyValues) {
    const validKeyValues = [...keyValues].filter((v) => typeof v === "string" || typeof v === "number");
    if (validKeyValues.length > 0) {
      json.required = validKeyValues;
    }
  }
};
var nullableProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const inner = process2(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  if (ctx.target === "openapi-3.0") {
    seen.ref = def.innerType;
    json.nullable = true;
  } else {
    json.anyOf = [inner, { type: "null" }];
  }
};
var nonoptionalProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  process2(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
};
var defaultProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  process2(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  json.default = JSON.parse(JSON.stringify(def.defaultValue));
};
var prefaultProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  process2(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  if (ctx.io === "input")
    json._prefault = JSON.parse(JSON.stringify(def.defaultValue));
};
var catchProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  process2(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  let catchValue;
  try {
    catchValue = def.catchValue(undefined);
  } catch {
    throw new Error("Dynamic catch values are not supported in JSON Schema");
  }
  json.default = catchValue;
};
var pipeProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  const inIsTransform = def.in._zod.traits.has("$ZodTransform");
  const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
  process2(innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = innerType;
};
var readonlyProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  process2(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  json.readOnly = true;
};
var promiseProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  process2(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
};
var optionalProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  process2(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
};
var lazyProcessor = (schema, ctx, _json, params) => {
  const innerType = schema._zod.innerType;
  process2(innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = innerType;
};
var allProcessors = {
  string: stringProcessor,
  number: numberProcessor,
  boolean: booleanProcessor,
  bigint: bigintProcessor,
  symbol: symbolProcessor,
  null: nullProcessor,
  undefined: undefinedProcessor,
  void: voidProcessor,
  never: neverProcessor,
  any: anyProcessor,
  unknown: unknownProcessor,
  date: dateProcessor,
  enum: enumProcessor,
  literal: literalProcessor,
  nan: nanProcessor,
  template_literal: templateLiteralProcessor,
  file: fileProcessor,
  success: successProcessor,
  custom: customProcessor,
  function: functionProcessor,
  transform: transformProcessor,
  map: mapProcessor,
  set: setProcessor,
  array: arrayProcessor,
  object: objectProcessor,
  union: unionProcessor,
  intersection: intersectionProcessor,
  tuple: tupleProcessor,
  record: recordProcessor,
  nullable: nullableProcessor,
  nonoptional: nonoptionalProcessor,
  default: defaultProcessor,
  prefault: prefaultProcessor,
  catch: catchProcessor,
  pipe: pipeProcessor,
  readonly: readonlyProcessor,
  promise: promiseProcessor,
  optional: optionalProcessor,
  lazy: lazyProcessor
};
function toJSONSchema(input, params) {
  if ("_idmap" in input) {
    const registry2 = input;
    const ctx2 = initializeContext({ ...params, processors: allProcessors });
    const defs = {};
    for (const entry of registry2._idmap.entries()) {
      const [_, schema] = entry;
      process2(schema, ctx2);
    }
    const schemas = {};
    const external = {
      registry: registry2,
      uri: params?.uri,
      defs
    };
    ctx2.external = external;
    for (const entry of registry2._idmap.entries()) {
      const [key, schema] = entry;
      extractDefs(ctx2, schema);
      schemas[key] = finalize(ctx2, schema);
    }
    if (Object.keys(defs).length > 0) {
      const defsSegment = ctx2.target === "draft-2020-12" ? "$defs" : "definitions";
      schemas.__shared = {
        [defsSegment]: defs
      };
    }
    return { schemas };
  }
  const ctx = initializeContext({ ...params, processors: allProcessors });
  process2(input, ctx);
  extractDefs(ctx, input);
  return finalize(ctx, input);
}
// node_modules/zod/v4/classic/iso.js
var ZodISODateTime = /* @__PURE__ */ $constructor("ZodISODateTime", (inst, def) => {
  $ZodISODateTime.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function datetime2(params) {
  return _isoDateTime(ZodISODateTime, params);
}
var ZodISODate = /* @__PURE__ */ $constructor("ZodISODate", (inst, def) => {
  $ZodISODate.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function date2(params) {
  return _isoDate(ZodISODate, params);
}
var ZodISOTime = /* @__PURE__ */ $constructor("ZodISOTime", (inst, def) => {
  $ZodISOTime.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function time2(params) {
  return _isoTime(ZodISOTime, params);
}
var ZodISODuration = /* @__PURE__ */ $constructor("ZodISODuration", (inst, def) => {
  $ZodISODuration.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function duration2(params) {
  return _isoDuration(ZodISODuration, params);
}

// node_modules/zod/v4/classic/errors.js
var initializer2 = (inst, issues) => {
  $ZodError.init(inst, issues);
  inst.name = "ZodError";
  Object.defineProperties(inst, {
    format: {
      value: (mapper) => formatError(inst, mapper)
    },
    flatten: {
      value: (mapper) => flattenError(inst, mapper)
    },
    addIssue: {
      value: (issue2) => {
        inst.issues.push(issue2);
        inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
      }
    },
    addIssues: {
      value: (issues2) => {
        inst.issues.push(...issues2);
        inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
      }
    },
    isEmpty: {
      get() {
        return inst.issues.length === 0;
      }
    }
  });
};
var ZodRealError = /* @__PURE__ */ $constructor("ZodError", initializer2, {
  Parent: Error
});

// node_modules/zod/v4/classic/parse.js
var parse3 = /* @__PURE__ */ _parse(ZodRealError);
var parseAsync2 = /* @__PURE__ */ _parseAsync(ZodRealError);
var safeParse2 = /* @__PURE__ */ _safeParse(ZodRealError);
var safeParseAsync2 = /* @__PURE__ */ _safeParseAsync(ZodRealError);
var encode = /* @__PURE__ */ _encode(ZodRealError);
var decode = /* @__PURE__ */ _decode(ZodRealError);
var encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
var decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
var safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
var safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
var safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
var safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);

// node_modules/zod/v4/classic/schemas.js
var _installedGroups = /* @__PURE__ */ new WeakMap;
function _installLazyMethods(inst, group, methods) {
  const proto = Object.getPrototypeOf(inst);
  let installed = _installedGroups.get(proto);
  if (!installed) {
    installed = new Set;
    _installedGroups.set(proto, installed);
  }
  if (installed.has(group))
    return;
  installed.add(group);
  for (const key in methods) {
    const fn = methods[key];
    Object.defineProperty(proto, key, {
      configurable: true,
      enumerable: false,
      get() {
        const bound = fn.bind(this);
        Object.defineProperty(this, key, {
          configurable: true,
          writable: true,
          enumerable: true,
          value: bound
        });
        return bound;
      },
      set(v) {
        Object.defineProperty(this, key, {
          configurable: true,
          writable: true,
          enumerable: true,
          value: v
        });
      }
    });
  }
}
var ZodType = /* @__PURE__ */ $constructor("ZodType", (inst, def) => {
  $ZodType.init(inst, def);
  Object.assign(inst["~standard"], {
    jsonSchema: {
      input: createStandardJSONSchemaMethod(inst, "input"),
      output: createStandardJSONSchemaMethod(inst, "output")
    }
  });
  inst.toJSONSchema = createToJSONSchemaMethod(inst, {});
  inst.def = def;
  inst.type = def.type;
  Object.defineProperty(inst, "_def", { value: def });
  inst.parse = (data, params) => parse3(inst, data, params, { callee: inst.parse });
  inst.safeParse = (data, params) => safeParse2(inst, data, params);
  inst.parseAsync = async (data, params) => parseAsync2(inst, data, params, { callee: inst.parseAsync });
  inst.safeParseAsync = async (data, params) => safeParseAsync2(inst, data, params);
  inst.spa = inst.safeParseAsync;
  inst.encode = (data, params) => encode(inst, data, params);
  inst.decode = (data, params) => decode(inst, data, params);
  inst.encodeAsync = async (data, params) => encodeAsync(inst, data, params);
  inst.decodeAsync = async (data, params) => decodeAsync(inst, data, params);
  inst.safeEncode = (data, params) => safeEncode(inst, data, params);
  inst.safeDecode = (data, params) => safeDecode(inst, data, params);
  inst.safeEncodeAsync = async (data, params) => safeEncodeAsync(inst, data, params);
  inst.safeDecodeAsync = async (data, params) => safeDecodeAsync(inst, data, params);
  _installLazyMethods(inst, "ZodType", {
    check(...chks) {
      const def2 = this.def;
      return this.clone(exports_util.mergeDefs(def2, {
        checks: [
          ...def2.checks ?? [],
          ...chks.map((ch) => typeof ch === "function" ? { _zod: { check: ch, def: { check: "custom" }, onattach: [] } } : ch)
        ]
      }), { parent: true });
    },
    with(...chks) {
      return this.check(...chks);
    },
    clone(def2, params) {
      return clone(this, def2, params);
    },
    brand() {
      return this;
    },
    register(reg, meta2) {
      reg.add(this, meta2);
      return this;
    },
    refine(check, params) {
      return this.check(refine(check, params));
    },
    superRefine(refinement, params) {
      return this.check(superRefine(refinement, params));
    },
    overwrite(fn) {
      return this.check(_overwrite(fn));
    },
    optional() {
      return optional(this);
    },
    exactOptional() {
      return exactOptional(this);
    },
    nullable() {
      return nullable(this);
    },
    nullish() {
      return optional(nullable(this));
    },
    nonoptional(params) {
      return nonoptional(this, params);
    },
    array() {
      return array(this);
    },
    or(arg) {
      return union([this, arg]);
    },
    and(arg) {
      return intersection(this, arg);
    },
    transform(tx) {
      return pipe(this, transform(tx));
    },
    default(d) {
      return _default(this, d);
    },
    prefault(d) {
      return prefault(this, d);
    },
    catch(params) {
      return _catch(this, params);
    },
    pipe(target) {
      return pipe(this, target);
    },
    readonly() {
      return readonly(this);
    },
    describe(description) {
      const cl = this.clone();
      globalRegistry.add(cl, { description });
      return cl;
    },
    meta(...args) {
      if (args.length === 0)
        return globalRegistry.get(this);
      const cl = this.clone();
      globalRegistry.add(cl, args[0]);
      return cl;
    },
    isOptional() {
      return this.safeParse(undefined).success;
    },
    isNullable() {
      return this.safeParse(null).success;
    },
    apply(fn) {
      return fn(this);
    }
  });
  Object.defineProperty(inst, "description", {
    get() {
      return globalRegistry.get(inst)?.description;
    },
    configurable: true
  });
  return inst;
});
var _ZodString = /* @__PURE__ */ $constructor("_ZodString", (inst, def) => {
  $ZodString.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
  const bag = inst._zod.bag;
  inst.format = bag.format ?? null;
  inst.minLength = bag.minimum ?? null;
  inst.maxLength = bag.maximum ?? null;
  _installLazyMethods(inst, "_ZodString", {
    regex(...args) {
      return this.check(_regex(...args));
    },
    includes(...args) {
      return this.check(_includes(...args));
    },
    startsWith(...args) {
      return this.check(_startsWith(...args));
    },
    endsWith(...args) {
      return this.check(_endsWith(...args));
    },
    min(...args) {
      return this.check(_minLength(...args));
    },
    max(...args) {
      return this.check(_maxLength(...args));
    },
    length(...args) {
      return this.check(_length(...args));
    },
    nonempty(...args) {
      return this.check(_minLength(1, ...args));
    },
    lowercase(params) {
      return this.check(_lowercase(params));
    },
    uppercase(params) {
      return this.check(_uppercase(params));
    },
    trim() {
      return this.check(_trim());
    },
    normalize(...args) {
      return this.check(_normalize(...args));
    },
    toLowerCase() {
      return this.check(_toLowerCase());
    },
    toUpperCase() {
      return this.check(_toUpperCase());
    },
    slugify() {
      return this.check(_slugify());
    }
  });
});
var ZodString = /* @__PURE__ */ $constructor("ZodString", (inst, def) => {
  $ZodString.init(inst, def);
  _ZodString.init(inst, def);
  inst.email = (params) => inst.check(_email(ZodEmail, params));
  inst.url = (params) => inst.check(_url(ZodURL, params));
  inst.jwt = (params) => inst.check(_jwt(ZodJWT, params));
  inst.emoji = (params) => inst.check(_emoji2(ZodEmoji, params));
  inst.guid = (params) => inst.check(_guid(ZodGUID, params));
  inst.uuid = (params) => inst.check(_uuid(ZodUUID, params));
  inst.uuidv4 = (params) => inst.check(_uuidv4(ZodUUID, params));
  inst.uuidv6 = (params) => inst.check(_uuidv6(ZodUUID, params));
  inst.uuidv7 = (params) => inst.check(_uuidv7(ZodUUID, params));
  inst.nanoid = (params) => inst.check(_nanoid(ZodNanoID, params));
  inst.guid = (params) => inst.check(_guid(ZodGUID, params));
  inst.cuid = (params) => inst.check(_cuid(ZodCUID, params));
  inst.cuid2 = (params) => inst.check(_cuid2(ZodCUID2, params));
  inst.ulid = (params) => inst.check(_ulid(ZodULID, params));
  inst.base64 = (params) => inst.check(_base64(ZodBase64, params));
  inst.base64url = (params) => inst.check(_base64url(ZodBase64URL, params));
  inst.xid = (params) => inst.check(_xid(ZodXID, params));
  inst.ksuid = (params) => inst.check(_ksuid(ZodKSUID, params));
  inst.ipv4 = (params) => inst.check(_ipv4(ZodIPv4, params));
  inst.ipv6 = (params) => inst.check(_ipv6(ZodIPv6, params));
  inst.cidrv4 = (params) => inst.check(_cidrv4(ZodCIDRv4, params));
  inst.cidrv6 = (params) => inst.check(_cidrv6(ZodCIDRv6, params));
  inst.e164 = (params) => inst.check(_e164(ZodE164, params));
  inst.datetime = (params) => inst.check(datetime2(params));
  inst.date = (params) => inst.check(date2(params));
  inst.time = (params) => inst.check(time2(params));
  inst.duration = (params) => inst.check(duration2(params));
});
function string2(params) {
  return _string(ZodString, params);
}
var ZodStringFormat = /* @__PURE__ */ $constructor("ZodStringFormat", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  _ZodString.init(inst, def);
});
var ZodEmail = /* @__PURE__ */ $constructor("ZodEmail", (inst, def) => {
  $ZodEmail.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodGUID = /* @__PURE__ */ $constructor("ZodGUID", (inst, def) => {
  $ZodGUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodUUID = /* @__PURE__ */ $constructor("ZodUUID", (inst, def) => {
  $ZodUUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodURL = /* @__PURE__ */ $constructor("ZodURL", (inst, def) => {
  $ZodURL.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodEmoji = /* @__PURE__ */ $constructor("ZodEmoji", (inst, def) => {
  $ZodEmoji.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodNanoID = /* @__PURE__ */ $constructor("ZodNanoID", (inst, def) => {
  $ZodNanoID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodCUID = /* @__PURE__ */ $constructor("ZodCUID", (inst, def) => {
  $ZodCUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodCUID2 = /* @__PURE__ */ $constructor("ZodCUID2", (inst, def) => {
  $ZodCUID2.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodULID = /* @__PURE__ */ $constructor("ZodULID", (inst, def) => {
  $ZodULID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodXID = /* @__PURE__ */ $constructor("ZodXID", (inst, def) => {
  $ZodXID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodKSUID = /* @__PURE__ */ $constructor("ZodKSUID", (inst, def) => {
  $ZodKSUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodIPv4 = /* @__PURE__ */ $constructor("ZodIPv4", (inst, def) => {
  $ZodIPv4.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodIPv6 = /* @__PURE__ */ $constructor("ZodIPv6", (inst, def) => {
  $ZodIPv6.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodCIDRv4 = /* @__PURE__ */ $constructor("ZodCIDRv4", (inst, def) => {
  $ZodCIDRv4.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodCIDRv6 = /* @__PURE__ */ $constructor("ZodCIDRv6", (inst, def) => {
  $ZodCIDRv6.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodBase64 = /* @__PURE__ */ $constructor("ZodBase64", (inst, def) => {
  $ZodBase64.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodBase64URL = /* @__PURE__ */ $constructor("ZodBase64URL", (inst, def) => {
  $ZodBase64URL.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodE164 = /* @__PURE__ */ $constructor("ZodE164", (inst, def) => {
  $ZodE164.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodJWT = /* @__PURE__ */ $constructor("ZodJWT", (inst, def) => {
  $ZodJWT.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodNumber = /* @__PURE__ */ $constructor("ZodNumber", (inst, def) => {
  $ZodNumber.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json, params);
  _installLazyMethods(inst, "ZodNumber", {
    gt(value, params) {
      return this.check(_gt(value, params));
    },
    gte(value, params) {
      return this.check(_gte(value, params));
    },
    min(value, params) {
      return this.check(_gte(value, params));
    },
    lt(value, params) {
      return this.check(_lt(value, params));
    },
    lte(value, params) {
      return this.check(_lte(value, params));
    },
    max(value, params) {
      return this.check(_lte(value, params));
    },
    int(params) {
      return this.check(int(params));
    },
    safe(params) {
      return this.check(int(params));
    },
    positive(params) {
      return this.check(_gt(0, params));
    },
    nonnegative(params) {
      return this.check(_gte(0, params));
    },
    negative(params) {
      return this.check(_lt(0, params));
    },
    nonpositive(params) {
      return this.check(_lte(0, params));
    },
    multipleOf(value, params) {
      return this.check(_multipleOf(value, params));
    },
    step(value, params) {
      return this.check(_multipleOf(value, params));
    },
    finite() {
      return this;
    }
  });
  const bag = inst._zod.bag;
  inst.minValue = Math.max(bag.minimum ?? Number.NEGATIVE_INFINITY, bag.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null;
  inst.maxValue = Math.min(bag.maximum ?? Number.POSITIVE_INFINITY, bag.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null;
  inst.isInt = (bag.format ?? "").includes("int") || Number.isSafeInteger(bag.multipleOf ?? 0.5);
  inst.isFinite = true;
  inst.format = bag.format ?? null;
});
function number2(params) {
  return _number(ZodNumber, params);
}
var ZodNumberFormat = /* @__PURE__ */ $constructor("ZodNumberFormat", (inst, def) => {
  $ZodNumberFormat.init(inst, def);
  ZodNumber.init(inst, def);
});
function int(params) {
  return _int(ZodNumberFormat, params);
}
var ZodBoolean = /* @__PURE__ */ $constructor("ZodBoolean", (inst, def) => {
  $ZodBoolean.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json, params);
});
function boolean2(params) {
  return _boolean(ZodBoolean, params);
}
var ZodNull = /* @__PURE__ */ $constructor("ZodNull", (inst, def) => {
  $ZodNull.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => nullProcessor(inst, ctx, json, params);
});
function _null3(params) {
  return _null2(ZodNull, params);
}
var ZodAny = /* @__PURE__ */ $constructor("ZodAny", (inst, def) => {
  $ZodAny.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => anyProcessor(inst, ctx, json, params);
});
function any() {
  return _any(ZodAny);
}
var ZodUnknown = /* @__PURE__ */ $constructor("ZodUnknown", (inst, def) => {
  $ZodUnknown.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => unknownProcessor(inst, ctx, json, params);
});
function unknown() {
  return _unknown(ZodUnknown);
}
var ZodNever = /* @__PURE__ */ $constructor("ZodNever", (inst, def) => {
  $ZodNever.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
});
function never(params) {
  return _never(ZodNever, params);
}
var ZodArray = /* @__PURE__ */ $constructor("ZodArray", (inst, def) => {
  $ZodArray.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
  inst.element = def.element;
  _installLazyMethods(inst, "ZodArray", {
    min(n, params) {
      return this.check(_minLength(n, params));
    },
    nonempty(params) {
      return this.check(_minLength(1, params));
    },
    max(n, params) {
      return this.check(_maxLength(n, params));
    },
    length(n, params) {
      return this.check(_length(n, params));
    },
    unwrap() {
      return this.element;
    }
  });
});
function array(element, params) {
  return _array(ZodArray, element, params);
}
var ZodObject = /* @__PURE__ */ $constructor("ZodObject", (inst, def) => {
  $ZodObjectJIT.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
  exports_util.defineLazy(inst, "shape", () => {
    return def.shape;
  });
  _installLazyMethods(inst, "ZodObject", {
    keyof() {
      return _enum(Object.keys(this._zod.def.shape));
    },
    catchall(catchall) {
      return this.clone({ ...this._zod.def, catchall });
    },
    passthrough() {
      return this.clone({ ...this._zod.def, catchall: unknown() });
    },
    loose() {
      return this.clone({ ...this._zod.def, catchall: unknown() });
    },
    strict() {
      return this.clone({ ...this._zod.def, catchall: never() });
    },
    strip() {
      return this.clone({ ...this._zod.def, catchall: undefined });
    },
    extend(incoming) {
      return exports_util.extend(this, incoming);
    },
    safeExtend(incoming) {
      return exports_util.safeExtend(this, incoming);
    },
    merge(other) {
      return exports_util.merge(this, other);
    },
    pick(mask) {
      return exports_util.pick(this, mask);
    },
    omit(mask) {
      return exports_util.omit(this, mask);
    },
    partial(...args) {
      return exports_util.partial(ZodOptional, this, args[0]);
    },
    required(...args) {
      return exports_util.required(ZodNonOptional, this, args[0]);
    }
  });
});
function object(shape, params) {
  const def = {
    type: "object",
    shape: shape ?? {},
    ...exports_util.normalizeParams(params)
  };
  return new ZodObject(def);
}
function looseObject(shape, params) {
  return new ZodObject({
    type: "object",
    shape,
    catchall: unknown(),
    ...exports_util.normalizeParams(params)
  });
}
var ZodUnion = /* @__PURE__ */ $constructor("ZodUnion", (inst, def) => {
  $ZodUnion.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
  inst.options = def.options;
});
function union(options, params) {
  return new ZodUnion({
    type: "union",
    options,
    ...exports_util.normalizeParams(params)
  });
}
var ZodDiscriminatedUnion = /* @__PURE__ */ $constructor("ZodDiscriminatedUnion", (inst, def) => {
  ZodUnion.init(inst, def);
  $ZodDiscriminatedUnion.init(inst, def);
});
function discriminatedUnion(discriminator, options, params) {
  return new ZodDiscriminatedUnion({
    type: "union",
    options,
    discriminator,
    ...exports_util.normalizeParams(params)
  });
}
var ZodIntersection = /* @__PURE__ */ $constructor("ZodIntersection", (inst, def) => {
  $ZodIntersection.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
});
function intersection(left, right) {
  return new ZodIntersection({
    type: "intersection",
    left,
    right
  });
}
var ZodRecord = /* @__PURE__ */ $constructor("ZodRecord", (inst, def) => {
  $ZodRecord.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => recordProcessor(inst, ctx, json, params);
  inst.keyType = def.keyType;
  inst.valueType = def.valueType;
});
function record(keyType, valueType, params) {
  if (!valueType || !valueType._zod) {
    return new ZodRecord({
      type: "record",
      keyType: string2(),
      valueType: keyType,
      ...exports_util.normalizeParams(valueType)
    });
  }
  return new ZodRecord({
    type: "record",
    keyType,
    valueType,
    ...exports_util.normalizeParams(params)
  });
}
var ZodEnum = /* @__PURE__ */ $constructor("ZodEnum", (inst, def) => {
  $ZodEnum.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
  inst.enum = def.entries;
  inst.options = Object.values(def.entries);
  const keys = new Set(Object.keys(def.entries));
  inst.extract = (values, params) => {
    const newEntries = {};
    for (const value of values) {
      if (keys.has(value)) {
        newEntries[value] = def.entries[value];
      } else
        throw new Error(`Key ${value} not found in enum`);
    }
    return new ZodEnum({
      ...def,
      checks: [],
      ...exports_util.normalizeParams(params),
      entries: newEntries
    });
  };
  inst.exclude = (values, params) => {
    const newEntries = { ...def.entries };
    for (const value of values) {
      if (keys.has(value)) {
        delete newEntries[value];
      } else
        throw new Error(`Key ${value} not found in enum`);
    }
    return new ZodEnum({
      ...def,
      checks: [],
      ...exports_util.normalizeParams(params),
      entries: newEntries
    });
  };
});
function _enum(values, params) {
  const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
  return new ZodEnum({
    type: "enum",
    entries,
    ...exports_util.normalizeParams(params)
  });
}
var ZodLiteral = /* @__PURE__ */ $constructor("ZodLiteral", (inst, def) => {
  $ZodLiteral.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => literalProcessor(inst, ctx, json, params);
  inst.values = new Set(def.values);
  Object.defineProperty(inst, "value", {
    get() {
      if (def.values.length > 1) {
        throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
      }
      return def.values[0];
    }
  });
});
function literal(value, params) {
  return new ZodLiteral({
    type: "literal",
    values: Array.isArray(value) ? value : [value],
    ...exports_util.normalizeParams(params)
  });
}
var ZodTransform = /* @__PURE__ */ $constructor("ZodTransform", (inst, def) => {
  $ZodTransform.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
  inst._zod.parse = (payload, _ctx) => {
    if (_ctx.direction === "backward") {
      throw new $ZodEncodeError(inst.constructor.name);
    }
    payload.addIssue = (issue2) => {
      if (typeof issue2 === "string") {
        payload.issues.push(exports_util.issue(issue2, payload.value, def));
      } else {
        const _issue = issue2;
        if (_issue.fatal)
          _issue.continue = false;
        _issue.code ?? (_issue.code = "custom");
        _issue.input ?? (_issue.input = payload.value);
        _issue.inst ?? (_issue.inst = inst);
        payload.issues.push(exports_util.issue(_issue));
      }
    };
    const output = def.transform(payload.value, payload);
    if (output instanceof Promise) {
      return output.then((output2) => {
        payload.value = output2;
        payload.fallback = true;
        return payload;
      });
    }
    payload.value = output;
    payload.fallback = true;
    return payload;
  };
});
function transform(fn) {
  return new ZodTransform({
    type: "transform",
    transform: fn
  });
}
var ZodOptional = /* @__PURE__ */ $constructor("ZodOptional", (inst, def) => {
  $ZodOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function optional(innerType) {
  return new ZodOptional({
    type: "optional",
    innerType
  });
}
var ZodExactOptional = /* @__PURE__ */ $constructor("ZodExactOptional", (inst, def) => {
  $ZodExactOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function exactOptional(innerType) {
  return new ZodExactOptional({
    type: "optional",
    innerType
  });
}
var ZodNullable = /* @__PURE__ */ $constructor("ZodNullable", (inst, def) => {
  $ZodNullable.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function nullable(innerType) {
  return new ZodNullable({
    type: "nullable",
    innerType
  });
}
var ZodDefault = /* @__PURE__ */ $constructor("ZodDefault", (inst, def) => {
  $ZodDefault.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
  inst.removeDefault = inst.unwrap;
});
function _default(innerType, defaultValue) {
  return new ZodDefault({
    type: "default",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : exports_util.shallowClone(defaultValue);
    }
  });
}
var ZodPrefault = /* @__PURE__ */ $constructor("ZodPrefault", (inst, def) => {
  $ZodPrefault.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function prefault(innerType, defaultValue) {
  return new ZodPrefault({
    type: "prefault",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : exports_util.shallowClone(defaultValue);
    }
  });
}
var ZodNonOptional = /* @__PURE__ */ $constructor("ZodNonOptional", (inst, def) => {
  $ZodNonOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function nonoptional(innerType, params) {
  return new ZodNonOptional({
    type: "nonoptional",
    innerType,
    ...exports_util.normalizeParams(params)
  });
}
var ZodCatch = /* @__PURE__ */ $constructor("ZodCatch", (inst, def) => {
  $ZodCatch.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
  inst.removeCatch = inst.unwrap;
});
function _catch(innerType, catchValue) {
  return new ZodCatch({
    type: "catch",
    innerType,
    catchValue: typeof catchValue === "function" ? catchValue : () => catchValue
  });
}
var ZodPipe = /* @__PURE__ */ $constructor("ZodPipe", (inst, def) => {
  $ZodPipe.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
  inst.in = def.in;
  inst.out = def.out;
});
function pipe(in_, out) {
  return new ZodPipe({
    type: "pipe",
    in: in_,
    out
  });
}
var ZodReadonly = /* @__PURE__ */ $constructor("ZodReadonly", (inst, def) => {
  $ZodReadonly.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function readonly(innerType) {
  return new ZodReadonly({
    type: "readonly",
    innerType
  });
}
var ZodLazy = /* @__PURE__ */ $constructor("ZodLazy", (inst, def) => {
  $ZodLazy.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => lazyProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.getter();
});
function lazy(getter) {
  return new ZodLazy({
    type: "lazy",
    getter
  });
}
var ZodCustom = /* @__PURE__ */ $constructor("ZodCustom", (inst, def) => {
  $ZodCustom.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
});
function custom(fn, _params) {
  return _custom(ZodCustom, fn ?? (() => true), _params);
}
function refine(fn, _params = {}) {
  return _refine(ZodCustom, fn, _params);
}
function superRefine(fn, params) {
  return _superRefine(fn, params);
}
function _instanceof(cls, params = {}) {
  const inst = new ZodCustom({
    type: "custom",
    check: "custom",
    fn: (data) => data instanceof cls,
    abort: true,
    ...exports_util.normalizeParams(params)
  });
  inst._zod.bag.Class = cls;
  inst._zod.check = (payload) => {
    if (!(payload.value instanceof cls)) {
      payload.issues.push({
        code: "invalid_type",
        expected: cls.name,
        input: payload.value,
        inst,
        path: [...inst._zod.def.path ?? []]
      });
    }
  };
  return inst;
}

// node_modules/eventsource-parser/dist/index.js
class ParseError extends Error {
  constructor(message, options) {
    super(message), this.name = "ParseError", this.type = options.type, this.field = options.field, this.value = options.value, this.line = options.line;
  }
}
var LF = 10;
var CR = 13;
var SPACE = 32;
function noop(_arg) {}
function createParser(config2) {
  if (typeof config2 == "function")
    throw new TypeError("`config` must be an object, got a function instead. Did you mean `createParser({onEvent: fn})`?");
  const { onEvent = noop, onError = noop, onRetry = noop, onComment, maxBufferSize } = config2, pendingFragments = [];
  let pendingFragmentsLength = 0, isFirstChunk = true, id, data = "", dataLines = 0, eventType, terminated = false;
  function feed(chunk) {
    if (terminated)
      throw new Error("Cannot feed parser: it was terminated after exceeding the configured max buffer size. Call `reset()` to resume parsing.");
    if (isFirstChunk && (isFirstChunk = false, chunk.charCodeAt(0) === 239 && chunk.charCodeAt(1) === 187 && chunk.charCodeAt(2) === 191 && (chunk = chunk.slice(3))), pendingFragments.length === 0) {
      const trailing2 = processLines(chunk);
      trailing2 !== "" && (pendingFragments.push(trailing2), pendingFragmentsLength = trailing2.length), checkBufferSize();
      return;
    }
    if (chunk.indexOf(`
`) === -1 && chunk.indexOf("\r") === -1) {
      pendingFragments.push(chunk), pendingFragmentsLength += chunk.length, checkBufferSize();
      return;
    }
    pendingFragments.push(chunk);
    const input = pendingFragments.join("");
    pendingFragments.length = 0, pendingFragmentsLength = 0;
    const trailing = processLines(input);
    trailing !== "" && (pendingFragments.push(trailing), pendingFragmentsLength = trailing.length), checkBufferSize();
  }
  function checkBufferSize() {
    maxBufferSize !== undefined && (pendingFragmentsLength + data.length <= maxBufferSize || (terminated = true, pendingFragments.length = 0, pendingFragmentsLength = 0, id = undefined, data = "", dataLines = 0, eventType = undefined, onError(new ParseError(`Buffered data exceeded max buffer size of ${maxBufferSize} characters`, {
      type: "max-buffer-size-exceeded"
    }))));
  }
  function processLines(chunk) {
    let searchIndex = 0;
    if (chunk.indexOf("\r") === -1) {
      let lfIndex = chunk.indexOf(`
`, searchIndex);
      for (;lfIndex !== -1; ) {
        if (searchIndex === lfIndex) {
          dataLines > 0 && onEvent({ id, event: eventType, data }), id = undefined, data = "", dataLines = 0, eventType = undefined, searchIndex = lfIndex + 1, lfIndex = chunk.indexOf(`
`, searchIndex);
          continue;
        }
        const firstCharCode = chunk.charCodeAt(searchIndex);
        if (isDataPrefix(chunk, searchIndex, firstCharCode)) {
          const valueStart = chunk.charCodeAt(searchIndex + 5) === SPACE ? searchIndex + 6 : searchIndex + 5, value = chunk.slice(valueStart, lfIndex);
          if (dataLines === 0 && chunk.charCodeAt(lfIndex + 1) === LF) {
            onEvent({ id, event: eventType, data: value }), id = undefined, data = "", eventType = undefined, searchIndex = lfIndex + 2, lfIndex = chunk.indexOf(`
`, searchIndex);
            continue;
          }
          data = dataLines === 0 ? value : `${data}
${value}`, dataLines++;
        } else
          isEventPrefix(chunk, searchIndex, firstCharCode) ? eventType = chunk.slice(chunk.charCodeAt(searchIndex + 6) === SPACE ? searchIndex + 7 : searchIndex + 6, lfIndex) || undefined : parseLine(chunk, searchIndex, lfIndex);
        searchIndex = lfIndex + 1, lfIndex = chunk.indexOf(`
`, searchIndex);
      }
      return chunk.slice(searchIndex);
    }
    for (;searchIndex < chunk.length; ) {
      const crIndex = chunk.indexOf("\r", searchIndex), lfIndex = chunk.indexOf(`
`, searchIndex);
      let lineEnd = -1;
      if (crIndex !== -1 && lfIndex !== -1 ? lineEnd = crIndex < lfIndex ? crIndex : lfIndex : crIndex !== -1 ? crIndex === chunk.length - 1 ? lineEnd = -1 : lineEnd = crIndex : lfIndex !== -1 && (lineEnd = lfIndex), lineEnd === -1)
        break;
      parseLine(chunk, searchIndex, lineEnd), searchIndex = lineEnd + 1, chunk.charCodeAt(searchIndex - 1) === CR && chunk.charCodeAt(searchIndex) === LF && searchIndex++;
    }
    return chunk.slice(searchIndex);
  }
  function parseLine(chunk, start, end) {
    if (start === end) {
      dispatchEvent();
      return;
    }
    const firstCharCode = chunk.charCodeAt(start);
    if (isDataPrefix(chunk, start, firstCharCode)) {
      const valueStart = chunk.charCodeAt(start + 5) === SPACE ? start + 6 : start + 5, value2 = chunk.slice(valueStart, end);
      data = dataLines === 0 ? value2 : `${data}
${value2}`, dataLines++;
      return;
    }
    if (isEventPrefix(chunk, start, firstCharCode)) {
      eventType = chunk.slice(chunk.charCodeAt(start + 6) === SPACE ? start + 7 : start + 6, end) || undefined;
      return;
    }
    if (firstCharCode === 105 && chunk.charCodeAt(start + 1) === 100 && chunk.charCodeAt(start + 2) === 58) {
      const value2 = chunk.slice(chunk.charCodeAt(start + 3) === SPACE ? start + 4 : start + 3, end);
      value2.includes("\x00") || (id = value2);
      return;
    }
    if (firstCharCode === 58) {
      if (onComment) {
        const line2 = chunk.slice(start, end);
        onComment(line2.slice(chunk.charCodeAt(start + 1) === SPACE ? 2 : 1));
      }
      return;
    }
    const line = chunk.slice(start, end), fieldSeparatorIndex = line.indexOf(":");
    if (fieldSeparatorIndex === -1) {
      processField(line, "", line);
      return;
    }
    const field = line.slice(0, fieldSeparatorIndex), offset = line.charCodeAt(fieldSeparatorIndex + 1) === SPACE ? 2 : 1, value = line.slice(fieldSeparatorIndex + offset);
    processField(field, value, line);
  }
  function processField(field, value, line) {
    switch (field) {
      case "event":
        eventType = value || undefined;
        break;
      case "data":
        data = dataLines === 0 ? value : `${data}
${value}`, dataLines++;
        break;
      case "id":
        value.includes("\x00") || (id = value);
        break;
      case "retry":
        /^\d+$/.test(value) ? onRetry(parseInt(value, 10)) : onError(new ParseError(`Invalid \`retry\` value: "${value}"`, {
          type: "invalid-retry",
          value,
          line
        }));
        break;
      default:
        onError(new ParseError(`Unknown field "${field.length > 20 ? `${field.slice(0, 20)}…` : field}"`, { type: "unknown-field", field, value, line }));
        break;
    }
  }
  function dispatchEvent() {
    dataLines > 0 && onEvent({
      id,
      event: eventType,
      data
    }), id = undefined, data = "", dataLines = 0, eventType = undefined;
  }
  function reset(options = {}) {
    if (options.consume && pendingFragments.length > 0) {
      const incompleteLine = pendingFragments.join("");
      parseLine(incompleteLine, 0, incompleteLine.length);
    }
    isFirstChunk = true, id = undefined, data = "", dataLines = 0, eventType = undefined, pendingFragments.length = 0, pendingFragmentsLength = 0, terminated = false;
  }
  return { feed, reset };
}
function isDataPrefix(chunk, i, firstCharCode) {
  return firstCharCode === 100 && chunk.charCodeAt(i + 1) === 97 && chunk.charCodeAt(i + 2) === 116 && chunk.charCodeAt(i + 3) === 97 && chunk.charCodeAt(i + 4) === 58;
}
function isEventPrefix(chunk, i, firstCharCode) {
  return firstCharCode === 101 && chunk.charCodeAt(i + 1) === 118 && chunk.charCodeAt(i + 2) === 101 && chunk.charCodeAt(i + 3) === 110 && chunk.charCodeAt(i + 4) === 116 && chunk.charCodeAt(i + 5) === 58;
}

// node_modules/eventsource-parser/dist/stream.js
class EventSourceParserStream extends TransformStream {
  constructor({ onError, onRetry, onComment, maxBufferSize } = {}) {
    let parser;
    super({
      start(controller) {
        parser = createParser({
          onEvent: (event) => {
            controller.enqueue(event);
          },
          onError(error) {
            typeof onError == "function" && onError(error), (onError === "terminate" || error.type === "max-buffer-size-exceeded") && controller.error(error);
          },
          onRetry,
          onComment,
          maxBufferSize
        });
      },
      transform(chunk) {
        parser.feed(chunk);
      }
    });
  }
}

// node_modules/@workflow/serde/dist/index.js
var WORKFLOW_SERIALIZE = Symbol.for("workflow-serialize");
var WORKFLOW_DESERIALIZE = Symbol.for("workflow-deserialize");

// node_modules/@ai-sdk/provider-utils/dist/index.js
function combineHeaders(...headers) {
  return headers.reduce((combinedHeaders, currentHeaders) => ({
    ...combinedHeaders,
    ...currentHeaders != null ? currentHeaders : {}
  }), {});
}
function removeUndefinedEntries(record2) {
  return Object.fromEntries(Object.entries(record2).filter(([_key, value]) => value != null));
}
async function delay(delayInMs, options) {
  if (delayInMs == null) {
    return Promise.resolve();
  }
  const signal = options == null ? undefined : options.abortSignal;
  return new Promise((resolve2, reject) => {
    if (signal == null ? undefined : signal.aborted) {
      reject(createAbortError());
      return;
    }
    const timeoutId = setTimeout(() => {
      cleanup();
      resolve2();
    }, delayInMs);
    const cleanup = () => {
      clearTimeout(timeoutId);
      signal == null || signal.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(createAbortError());
    };
    signal == null || signal.addEventListener("abort", onAbort);
  });
}
function createAbortError() {
  return new DOMException("Delay was aborted", "AbortError");
}
function getWebSocketConstructor(webSocket) {
  const WebSocketConstructor = webSocket != null ? webSocket : globalThis.WebSocket;
  if (WebSocketConstructor == null) {
    throw new Error("No WebSocket implementation available.");
  }
  return WebSocketConstructor;
}
var textDecoder = new TextDecoder;
async function readWebSocketMessageText(data) {
  if (typeof data === "string")
    return data;
  if (data instanceof ArrayBuffer)
    return textDecoder.decode(data);
  if (ArrayBuffer.isView(data)) {
    return textDecoder.decode(data);
  }
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    return data.text();
  }
  return String(data);
}
var WEBSOCKET_OPEN_STATE = 1;
async function waitForWebSocketBufferDrain(socket, {
  highWaterMark = 1024 * 1024,
  pollIntervalMs = 20,
  abortSignal
} = {}) {
  var _a32;
  while (socket.readyState === WEBSOCKET_OPEN_STATE && ((_a32 = socket.bufferedAmount) != null ? _a32 : 0) > highWaterMark) {
    if ((abortSignal == null ? undefined : abortSignal.aborted) === true) {
      return;
    }
    await delay(pollIntervalMs);
  }
}
function connectToWebSocket({
  url,
  protocols,
  headers,
  webSocket,
  abortSignal,
  onOpen,
  onMessageText,
  onProcessingError,
  onSocketError,
  onClose,
  onAbort
}) {
  var _a32;
  let socket;
  let abortListener;
  const close = (code) => {
    if (abortListener != null) {
      abortSignal == null || abortSignal.removeEventListener("abort", abortListener);
      abortListener = undefined;
    }
    try {
      socket == null || socket.close(code);
    } catch (e) {}
  };
  if (abortSignal == null ? undefined : abortSignal.aborted) {
    onAbort == null || onAbort((_a32 = abortSignal.reason) != null ? _a32 : new Error("Aborted"));
    return { socket: undefined, close };
  }
  try {
    const WebSocketConstructor = getWebSocketConstructor(webSocket);
    socket = new WebSocketConstructor(url, protocols, {
      headers: removeUndefinedEntries(headers != null ? headers : {})
    });
  } catch (error) {
    onProcessingError(error);
    return { socket: undefined, close };
  }
  if (abortSignal != null && onAbort != null) {
    abortListener = () => {
      var _a42;
      return onAbort((_a42 = abortSignal.reason) != null ? _a42 : new Error("Aborted"));
    };
    abortSignal.addEventListener("abort", abortListener, { once: true });
  }
  const openedSocket = socket;
  socket.onopen = () => {
    try {
      onOpen == null || onOpen(openedSocket);
    } catch (error) {
      onProcessingError(error);
    }
  };
  let tail = Promise.resolve();
  socket.onmessage = (event) => {
    tail = tail.then(() => readWebSocketMessageText(event.data)).then((text) => onMessageText(text)).catch(onProcessingError);
  };
  socket.onerror = () => {
    tail = tail.then(() => onSocketError == null ? undefined : onSocketError()).catch(onProcessingError);
  };
  socket.onclose = (event) => {
    const closeEvent = event;
    const code = typeof (closeEvent == null ? undefined : closeEvent.code) === "number" ? closeEvent.code : undefined;
    const reason = typeof (closeEvent == null ? undefined : closeEvent.reason) === "string" ? closeEvent.reason : undefined;
    tail = tail.then(() => onClose == null ? undefined : onClose({ code, reason })).catch(onProcessingError);
  };
  return { socket, close };
}
function convertAsyncIteratorToReadableStream(iterator) {
  let cancelled = false;
  return new ReadableStream({
    async pull(controller) {
      if (cancelled)
        return;
      try {
        const { value, done } = await iterator.next();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel(reason) {
      cancelled = true;
      if (iterator.return) {
        try {
          await iterator.return(reason);
        } catch (e) {}
      }
    }
  });
}
var { btoa: btoa2, atob: atob2 } = globalThis;
function convertBase64ToUint8Array(base64String) {
  const base64Url = base64String.replace(/-/g, "+").replace(/_/g, "/");
  const latin1string = atob2(base64Url);
  return Uint8Array.from(latin1string, (byte) => byte.codePointAt(0));
}
function convertUint8ArrayToBase64(array2) {
  const chunks = [];
  const chunkSize = 4096;
  for (let i = 0;i < array2.length; i += chunkSize) {
    chunks.push(String.fromCodePoint(...array2.subarray(i, i + chunkSize)));
  }
  return btoa2(chunks.join(""));
}
function extractResponseHeaders(response) {
  return Object.fromEntries([...response.headers]);
}
function getRuntimeEnvironmentUserAgent(globalThisAny = globalThis) {
  var _a32, _b32, _c;
  if (globalThisAny.window) {
    return `runtime/browser`;
  }
  if ((_a32 = globalThisAny.navigator) == null ? undefined : _a32.userAgent) {
    return `runtime/${globalThisAny.navigator.userAgent.toLowerCase()}`;
  }
  if ((_c = (_b32 = globalThisAny.process) == null ? undefined : _b32.versions) == null ? undefined : _c.node) {
    return `runtime/node.js/${globalThisAny.process.version.substring(0)}`;
  }
  if (globalThisAny.EdgeRuntime) {
    return `runtime/vercel-edge`;
  }
  return "runtime/unknown";
}
function isAbortError(error) {
  return (error instanceof Error || typeof DOMException === "function" && error instanceof DOMException) && (error.name === "AbortError" || error.name === "ResponseAborted" || error.name === "TimeoutError");
}
var FETCH_FAILED_ERROR_MESSAGES = ["fetch failed", "failed to fetch"];
var RETRYABLE_NETWORK_ERROR_CODES = /* @__PURE__ */ new Set([
  "ConnectionRefused",
  "ConnectionClosed",
  "FailedToOpenSocket",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "UND_ERR_SOCKET",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_CONNECT_TIMEOUT"
]);
function findNetworkError(error) {
  const visited = /* @__PURE__ */ new Set;
  let current = error;
  while (current instanceof Error && !visited.has(current)) {
    visited.add(current);
    const errorWithCode = current;
    if (typeof errorWithCode.code === "string" && RETRYABLE_NETWORK_ERROR_CODES.has(errorWithCode.code)) {
      return errorWithCode;
    }
    current = current.cause;
  }
  return;
}
function handleFetchError({
  error,
  url,
  requestBodyValues
}) {
  if (isAbortError(error)) {
    return error;
  }
  if (error instanceof TypeError && FETCH_FAILED_ERROR_MESSAGES.includes(error.message.toLowerCase())) {
    const cause = error.cause;
    if (cause != null) {
      return new APICallError({
        message: `Cannot connect to API: ${cause.message}`,
        cause,
        url,
        requestBodyValues,
        isRetryable: true
      });
    }
  }
  const networkError = findNetworkError(error);
  if (networkError != null) {
    if (APICallError.isInstance(error)) {
      return new APICallError({
        message: error.message,
        cause: error.cause,
        url: error.url,
        requestBodyValues: error.requestBodyValues,
        statusCode: error.statusCode,
        responseHeaders: error.responseHeaders,
        responseBody: error.responseBody,
        data: error.data,
        isRetryable: true
      });
    }
    return new APICallError({
      message: `Cannot connect to API: ${error instanceof Error ? error.message : networkError.message}`,
      cause: error,
      url,
      requestBodyValues,
      isRetryable: true
    });
  }
  return error;
}
var VERSION = "5.0.44";
function normalizeHeaders(headers) {
  if (headers == null) {
    return {};
  }
  const normalized = {};
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      normalized[key.toLowerCase()] = value;
    });
  } else {
    if (!Array.isArray(headers)) {
      headers = Object.entries(headers);
    }
    for (const [key, value] of headers) {
      if (value != null) {
        normalized[key.toLowerCase()] = value;
      }
    }
  }
  return normalized;
}
function withUserAgentSuffix(headers, ...userAgentSuffixParts) {
  const normalizedHeaders = new Headers(normalizeHeaders(headers));
  const currentUserAgentHeader = normalizedHeaders.get("user-agent") || "";
  normalizedHeaders.set("user-agent", [currentUserAgentHeader, ...userAgentSuffixParts].filter(Boolean).join(" "));
  return Object.fromEntries(normalizedHeaders.entries());
}
var audioMediaTypeSignaturesWithoutMp4 = [
  {
    mediaType: "audio/mpeg",
    bytesPrefix: [255, 251]
  },
  {
    mediaType: "audio/mpeg",
    bytesPrefix: [255, 250]
  },
  {
    mediaType: "audio/mpeg",
    bytesPrefix: [255, 243]
  },
  {
    mediaType: "audio/mpeg",
    bytesPrefix: [255, 242]
  },
  {
    mediaType: "audio/mpeg",
    bytesPrefix: [255, 227]
  },
  {
    mediaType: "audio/mpeg",
    bytesPrefix: [255, 226]
  },
  {
    mediaType: "audio/wav",
    bytesPrefix: [
      82,
      73,
      70,
      70,
      null,
      null,
      null,
      null,
      87,
      65,
      86,
      69
    ]
  },
  {
    mediaType: "audio/ogg",
    bytesPrefix: [79, 103, 103, 83]
  },
  {
    mediaType: "audio/flac",
    bytesPrefix: [102, 76, 97, 67]
  },
  {
    mediaType: "audio/aac",
    bytesPrefix: [64, 21, 0, 0]
  },
  {
    mediaType: "audio/webm",
    bytesPrefix: [26, 69, 223, 163]
  }
];
var audioMediaTypeSignatures = [
  ...audioMediaTypeSignaturesWithoutMp4,
  {
    mediaType: "audio/mp4",
    bytesPrefix: [
      0,
      0,
      0,
      null,
      102,
      116,
      121,
      112
    ]
  }
];
var MAX_SIGNATURE_BYTES = 12;
var MAX_ID3_TAG_BYTES = 128 * 1024;
var ID3_SCAN_BYTES = MAX_ID3_TAG_BYTES + MAX_SIGNATURE_BYTES;
async function cancelResponseBody(response) {
  var _a32;
  try {
    await ((_a32 = response.body) == null ? undefined : _a32.cancel());
  } catch (e) {}
}
var name16 = "AI_DownloadError";
var marker22 = `vercel.ai.error.${name16}`;
var symbol17 = Symbol.for(marker22);
var _a20;
var _b17;
var DownloadError = class extends (_b17 = AISDKError, _a20 = symbol17, _b17) {
  constructor({
    url,
    statusCode,
    statusText,
    cause,
    message = cause == null ? `Failed to download ${url}: ${statusCode} ${statusText}` : `Failed to download ${url}: ${cause}`
  }) {
    super({ name: name16, message, cause });
    this[_a20] = true;
    this.url = url;
    this.statusCode = statusCode;
    this.statusText = statusText;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker22);
  }
};
function isBrowserRuntime(globalThisAny = globalThis) {
  return globalThisAny.window != null;
}
function isSameOrigin(url, baseUrl) {
  try {
    return new URL(url).origin === new URL(baseUrl).origin;
  } catch (e) {
    return false;
  }
}
function validateDownloadUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    throw new DownloadError({
      url,
      message: `Invalid URL: ${url}`
    });
  }
  if (parsed.protocol === "data:") {
    return;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new DownloadError({
      url,
      message: `URL scheme must be http, https, or data, got ${parsed.protocol}`
    });
  }
  const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, "");
  if (!hostname) {
    throw new DownloadError({
      url,
      message: `URL must have a hostname`
    });
  }
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".localhost")) {
    throw new DownloadError({
      url,
      message: `URL with hostname ${hostname} is not allowed`
    });
  }
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    const ipv62 = hostname.slice(1, -1);
    if (isPrivateIPv6(ipv62)) {
      throw new DownloadError({
        url,
        message: `URL with IPv6 address ${hostname} is not allowed`
      });
    }
    return;
  }
  if (isIPv4(hostname)) {
    if (isPrivateIPv4(hostname)) {
      throw new DownloadError({
        url,
        message: `URL with IP address ${hostname} is not allowed`
      });
    }
    return;
  }
}
function validateDownloadAddress({
  address,
  family,
  hostname
}) {
  const isUnsafe = family === 4 ? !isIPv4(address) || isPrivateIPv4(address) : family === 6 ? isPrivateIPv6(address) : true;
  if (isUnsafe) {
    throw new DownloadError({
      url: hostname,
      message: `Hostname ${hostname} resolved to disallowed IP address ${address}`
    });
  }
}
function isIPv4(hostname) {
  const parts = hostname.split(".");
  if (parts.length !== 4)
    return false;
  return parts.every((part) => {
    const num = Number(part);
    return Number.isInteger(num) && num >= 0 && num <= 255 && String(num) === part;
  });
}
function isPrivateIPv4(ip) {
  const parts = ip.split(".").map(Number);
  const [a, b, c] = parts;
  if (a === 0)
    return true;
  if (a === 10)
    return true;
  if (a === 100 && b >= 64 && b <= 127)
    return true;
  if (a === 127)
    return true;
  if (a === 169 && b === 254)
    return true;
  if (a === 172 && b >= 16 && b <= 31)
    return true;
  if (a === 192 && b === 0 && c === 0)
    return true;
  if (a === 192 && b === 0 && c === 2)
    return true;
  if (a === 192 && b === 168)
    return true;
  if (a === 198 && (b === 18 || b === 19))
    return true;
  if (a === 198 && b === 51 && c === 100)
    return true;
  if (a === 203 && b === 0 && c === 113)
    return true;
  if (a >= 224)
    return true;
  return false;
}
function parseIPv6(ip) {
  let address = ip.toLowerCase();
  const zoneIndex = address.indexOf("%");
  if (zoneIndex !== -1) {
    address = address.slice(0, zoneIndex);
  }
  const halves = address.split("::");
  if (halves.length > 2)
    return null;
  const toGroups = (segment) => {
    if (segment === "")
      return [];
    const groups = [];
    const parts = segment.split(":");
    for (let i = 0;i < parts.length; i++) {
      const part = parts[i];
      if (part.includes(".")) {
        if (i !== parts.length - 1 || !isIPv4(part))
          return null;
        const [a, b, c, d] = part.split(".").map(Number);
        groups.push(a << 8 | b, c << 8 | d);
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(part))
        return null;
      groups.push(parseInt(part, 16));
    }
    return groups;
  };
  const head = toGroups(halves[0]);
  if (head === null)
    return null;
  if (halves.length === 2) {
    const tail = toGroups(halves[1]);
    if (tail === null)
      return null;
    const fill = 8 - head.length - tail.length;
    if (fill < 0)
      return null;
    return [...head, ...new Array(fill).fill(0), ...tail];
  }
  return head.length === 8 ? head : null;
}
function isPrivateIPv6(ip) {
  const groups = parseIPv6(ip);
  if (groups === null)
    return true;
  const topZero = (count) => groups.slice(0, count).every((group) => group === 0);
  if (topZero(7) && (groups[7] === 0 || groups[7] === 1))
    return true;
  if ((groups[0] & 65024) === 64512)
    return true;
  if ((groups[0] & 65472) === 65152)
    return true;
  if ((groups[0] & 65472) === 65216)
    return true;
  if ((groups[0] & 65280) === 65280)
    return true;
  if (groups[0] === 8193 && groups[1] === 3512)
    return true;
  if (groups[0] === 16383 && (groups[1] & 61440) === 0)
    return true;
  const embedsIPv4 = topZero(6) || topZero(5) && groups[5] === 65535 || topZero(4) && groups[4] === 65535 && groups[5] === 0 || groups[0] === 100 && groups[1] === 65435 && groups[2] === 0 && groups[3] === 0 && groups[4] === 0 && groups[5] === 0 || groups[0] === 100 && groups[1] === 65435 && groups[2] === 1;
  if (embedsIPv4) {
    const a = groups[6] >> 8 & 255;
    const b = groups[6] & 255;
    const c = groups[7] >> 8 & 255;
    const d = groups[7] & 255;
    return isPrivateIPv4(`${a}.${b}.${c}.${d}`);
  }
  return false;
}
function createSafeLookup(lookup) {
  return (hostname, options, callback) => {
    lookup(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) {
        callback(error);
        return;
      }
      try {
        const [firstAddress] = addresses;
        if (firstAddress == null) {
          throw new Error(`Hostname ${hostname} did not resolve to an address`);
        }
        for (const { address, family } of addresses) {
          validateDownloadAddress({ address, family, hostname });
        }
        if (options.all === true) {
          callback(null, addresses);
        } else {
          callback(null, firstAddress.address, firstAddress.family);
        }
      } catch (error2) {
        callback(error2 instanceof Error ? error2 : new Error(String(error2)));
      }
    });
  };
}
var safeNodeFetchPromise;
function isNodeRuntime() {
  var _a32, _b32, _c;
  const runtimeProcess = globalThis.process;
  return ((_a32 = runtimeProcess == null ? undefined : runtimeProcess.release) == null ? undefined : _a32.name) === "node" && ((_b32 = runtimeProcess.versions) == null ? undefined : _b32.bun) == null && ((_c = runtimeProcess.versions) == null ? undefined : _c.deno) == null && runtimeProcess.title !== "workerd" && globalThis.EdgeRuntime == null;
}
async function getDefaultDownloadFetch() {
  if (!isNodeRuntime()) {
    return globalThis.fetch;
  }
  return safeNodeFetchPromise != null ? safeNodeFetchPromise : safeNodeFetchPromise = Promise.resolve().then(createSafeNodeFetch);
}
function createSafeNodeFetch() {
  const module = loadBuiltinModule("node:module");
  const { lookup } = loadBuiltinModule("node:dns");
  const nodeRequire = module.createRequire(getCurrentModulePath());
  const { Agent, fetch: fetch2 } = nodeRequire("undici");
  const dispatcher = new Agent({
    connect: {
      lookup: createSafeLookup(lookup)
    }
  });
  return (input, init) => fetch2(input, {
    ...init,
    dispatcher
  });
}
function loadBuiltinModule(id) {
  var _a32;
  const processWithBuiltins = globalThis.process;
  const builtinModule = (_a32 = processWithBuiltins == null ? undefined : processWithBuiltins.getBuiltinModule) == null ? undefined : _a32.call(processWithBuiltins, id);
  if (builtinModule == null) {
    throw new Error(`Node.js built-in module ${id} is unavailable`);
  }
  return builtinModule;
}
function getCurrentModulePath() {
  const originalPrepareStackTrace = Error.prepareStackTrace;
  try {
    Error.prepareStackTrace = (_error, callSites) => callSites;
    const error = new Error("Capture current module path");
    Error.captureStackTrace(error, getCurrentModulePath);
    const [caller] = error.stack;
    const fileName = caller == null ? undefined : caller.getFileName();
    if (fileName == null) {
      throw new Error("Unable to determine the current module path");
    }
    return fileName;
  } finally {
    Error.prepareStackTrace = originalPrepareStackTrace;
  }
}
var BLOCKED_REQUEST_HEADERS = [
  "connection",
  "keep-alive",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "forwarded",
  "proxy-authorization",
  "via",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-real-ip",
  "metadata",
  "metadata-flavor",
  "x-aws-ec2-metadata-token",
  "x-metadata-token",
  "cookie",
  "set-cookie"
];
function sanitizeRequestHeaders(input) {
  const headers = new Headers(input);
  for (const name32 of BLOCKED_REQUEST_HEADERS) {
    headers.delete(name32);
  }
  return headers;
}
var MAX_DOWNLOAD_REDIRECTS = 10;
var REDIRECT_STATUS_CODES = /* @__PURE__ */ new Set([301, 302, 303, 307, 308]);
async function getValidatedFetch(customFetch) {
  return customFetch == null || customFetch === globalThis.fetch ? await getDefaultDownloadFetch() : customFetch;
}
async function fetchWithValidatedRedirects({
  url,
  headers,
  abortSignal,
  maxRedirects = MAX_DOWNLOAD_REDIRECTS,
  fetch: customFetch,
  trustedOrigin
}) {
  var _a32;
  let currentHeaders = headers === undefined ? undefined : sanitizeRequestHeaders(headers);
  const perHopInit = (redirect) => {
    const init = { signal: abortSignal, redirect };
    if (currentHeaders !== undefined) {
      init.headers = new Headers(currentHeaders);
    }
    return init;
  };
  let currentUrl = url;
  for (let redirectCount = 0;redirectCount <= maxRedirects; redirectCount++) {
    const isTrustedHop = trustedOrigin !== undefined && isSameOrigin(currentUrl, trustedOrigin);
    if (!isTrustedHop) {
      validateDownloadUrl(currentUrl);
    }
    const fetch2 = isTrustedHop && customFetch != null ? customFetch : isTrustedHop ? globalThis.fetch : await getValidatedFetch(customFetch);
    const response = await fetch2(currentUrl, perHopInit("manual"));
    if (response.type === "opaqueredirect") {
      if (!isBrowserRuntime()) {
        throw new DownloadError({
          url,
          message: `Redirect from ${currentUrl} could not be validated and was blocked`
        });
      }
      return await fetch2(currentUrl, perHopInit("follow"));
    }
    const location = (_a32 = response.headers) == null ? undefined : _a32.get("location");
    if (REDIRECT_STATUS_CODES.has(response.status) && location) {
      await cancelResponseBody(response);
      const nextUrl = new URL(location, currentUrl).toString();
      if (currentHeaders !== undefined && !isSameOrigin(nextUrl, currentUrl)) {
        const userAgent = currentHeaders.get("user-agent");
        currentHeaders = new Headers(userAgent == null ? undefined : { "user-agent": userAgent });
      }
      currentUrl = nextUrl;
      continue;
    }
    return response;
  }
  throw new DownloadError({
    url,
    message: `Too many redirects (max ${maxRedirects})`
  });
}
var DEFAULT_MAX_DOWNLOAD_SIZE = 2 * 1024 * 1024 * 1024;
async function readResponseWithSizeLimit({
  response,
  url,
  maxBytes = DEFAULT_MAX_DOWNLOAD_SIZE
}) {
  const contentLength = response.headers.get("content-length");
  if (contentLength != null) {
    const length = parseInt(contentLength, 10);
    if (!isNaN(length) && length > maxBytes) {
      await cancelResponseBody(response);
      throw new DownloadError({
        url,
        message: `Download of ${url} exceeded maximum size of ${maxBytes} bytes (Content-Length: ${length}).`
      });
    }
  }
  const body = response.body;
  if (body == null) {
    return new Uint8Array(0);
  }
  const reader = body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      totalBytes += value.length;
      if (totalBytes > maxBytes) {
        throw new DownloadError({
          url,
          message: `Download of ${url} exceeded maximum size of ${maxBytes} bytes.`
        });
      }
      chunks.push(value);
    }
  } finally {
    try {
      await reader.cancel();
    } catch (e) {} finally {
      reader.releaseLock();
    }
  }
  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
var createIdGenerator = ({
  prefix,
  size = 16,
  alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  separator = "-"
} = {}) => {
  const generator = () => {
    const alphabetLength = alphabet.length;
    const chars = new Array(size);
    for (let i = 0;i < size; i++) {
      chars[i] = alphabet[Math.random() * alphabetLength | 0];
    }
    return chars.join("");
  };
  if (prefix == null) {
    return generator;
  }
  if (alphabet.includes(separator)) {
    throw new InvalidArgumentError({
      argument: "separator",
      message: `The separator "${separator}" must not be part of the alphabet "${alphabet}".`
    });
  }
  return () => `${prefix}${separator}${generator()}`;
};
var generateId = createIdGenerator();
var getOriginalFetch2 = () => globalThis.fetch;
var getFromApi = async ({
  url,
  headers = {},
  successfulResponseHandler,
  failedResponseHandler,
  abortSignal,
  fetch: fetch2,
  validateUrl,
  credentialedOrigin,
  trustedOrigin
}) => {
  try {
    const requestFetch = fetch2 != null ? fetch2 : getOriginalFetch2();
    const outgoingHeaders = credentialedOrigin !== undefined && !isSameOrigin(url, credentialedOrigin) ? {} : headers;
    const requestHeaders = withUserAgentSuffix(outgoingHeaders, `ai-sdk/provider-utils/${VERSION}`, getRuntimeEnvironmentUserAgent());
    const response = validateUrl ? await fetchWithValidatedRedirects({
      url,
      headers: requestHeaders,
      abortSignal,
      fetch: fetch2,
      trustedOrigin
    }) : await requestFetch(url, {
      method: "GET",
      headers: requestHeaders,
      signal: abortSignal
    });
    const responseHeaders = extractResponseHeaders(response);
    if (!response.ok) {
      let errorInformation;
      try {
        errorInformation = await failedResponseHandler({
          response,
          url,
          requestBodyValues: {}
        });
      } catch (error) {
        if (isAbortError(error) || APICallError.isInstance(error)) {
          throw error;
        }
        throw new APICallError({
          message: "Failed to process error response",
          cause: error,
          statusCode: response.status,
          url,
          responseHeaders,
          requestBodyValues: {}
        });
      }
      throw errorInformation.value;
    }
    try {
      return await successfulResponseHandler({
        response,
        url,
        requestBodyValues: {}
      });
    } catch (error) {
      if (error instanceof Error) {
        if (isAbortError(error) || APICallError.isInstance(error)) {
          throw error;
        }
      }
      throw new APICallError({
        message: "Failed to process successful response",
        cause: error,
        statusCode: response.status,
        url,
        responseHeaders,
        requestBodyValues: {}
      });
    }
  } catch (error) {
    throw handleFetchError({ error, url, requestBodyValues: {} });
  }
};
function isBuffer(value) {
  var _a32, _b32;
  return (_b32 = (_a32 = globalThis.Buffer) == null ? undefined : _a32.isBuffer(value)) != null ? _b32 : false;
}
function isRecord(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
function loadOptionalSetting({
  settingValue,
  environmentVariableName
}) {
  if (typeof settingValue === "string") {
    return settingValue;
  }
  if (settingValue != null || typeof process === "undefined") {
    return;
  }
  settingValue = process.env[environmentVariableName];
  if (settingValue == null || typeof settingValue !== "string") {
    return;
  }
  return settingValue;
}
function normalizeBatchRequestCounts({
  total,
  pending,
  completed,
  failed
}) {
  if (isNonNegativeSafeInteger(total) && isNonNegativeSafeInteger(pending) && isNonNegativeSafeInteger(completed) && isNonNegativeSafeInteger(failed) && pending + completed + failed === total) {
    return {
      total,
      pending,
      completed,
      failed
    };
  }
  return;
}
function isNonNegativeSafeInteger(value) {
  return value != null && Number.isSafeInteger(value) && value >= 0;
}
var suspectProtoRx = /"(?:_|\\u005[Ff])(?:_|\\u005[Ff])(?:p|\\u0070)(?:r|\\u0072)(?:o|\\u006[Ff])(?:t|\\u0074)(?:o|\\u006[Ff])(?:_|\\u005[Ff])(?:_|\\u005[Ff])"\s*:/;
var suspectConstructorRx = /"(?:c|\\u0063)(?:o|\\u006[Ff])(?:n|\\u006[Ee])(?:s|\\u0073)(?:t|\\u0074)(?:r|\\u0072)(?:u|\\u0075)(?:c|\\u0063)(?:t|\\u0074)(?:o|\\u006[Ff])(?:r|\\u0072)"\s*:/;
function _parse2(text) {
  const obj = JSON.parse(text);
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (suspectProtoRx.test(text) === false && suspectConstructorRx.test(text) === false) {
    return obj;
  }
  return filter(obj);
}
function filter(obj) {
  let next = [obj];
  while (next.length) {
    const nodes = next;
    next = [];
    for (const node of nodes) {
      if (Object.prototype.hasOwnProperty.call(node, "__proto__")) {
        throw new SyntaxError("Object contains forbidden prototype property");
      }
      if (Object.prototype.hasOwnProperty.call(node, "constructor") && node.constructor !== null && typeof node.constructor === "object" && Object.prototype.hasOwnProperty.call(node.constructor, "prototype")) {
        throw new SyntaxError("Object contains forbidden prototype property");
      }
      for (const key in node) {
        const value = node[key];
        if (value && typeof value === "object") {
          next.push(value);
        }
      }
    }
  }
  return obj;
}
function secureJsonParse(text) {
  const { stackTraceLimit } = Error;
  try {
    Error.stackTraceLimit = 0;
  } catch (e) {
    return _parse2(text);
  }
  try {
    return _parse2(text);
  } finally {
    Error.stackTraceLimit = stackTraceLimit;
  }
}
function addAdditionalPropertiesToJsonSchema(jsonSchema2) {
  if (jsonSchema2.type === "object" || Array.isArray(jsonSchema2.type) && jsonSchema2.type.includes("object")) {
    const { additionalProperties } = jsonSchema2;
    jsonSchema2.additionalProperties = additionalProperties != null && typeof additionalProperties !== "boolean" ? visit(additionalProperties) : false;
    const { properties } = jsonSchema2;
    if (properties != null) {
      for (const key of Object.keys(properties)) {
        properties[key] = visit(properties[key]);
      }
    }
  }
  if (jsonSchema2.items != null) {
    jsonSchema2.items = Array.isArray(jsonSchema2.items) ? jsonSchema2.items.map(visit) : visit(jsonSchema2.items);
  }
  if (jsonSchema2.anyOf != null) {
    jsonSchema2.anyOf = jsonSchema2.anyOf.map(visit);
  }
  if (jsonSchema2.allOf != null) {
    jsonSchema2.allOf = jsonSchema2.allOf.map(visit);
  }
  if (jsonSchema2.oneOf != null) {
    jsonSchema2.oneOf = jsonSchema2.oneOf.map(visit);
  }
  const { definitions } = jsonSchema2;
  if (definitions != null) {
    for (const key of Object.keys(definitions)) {
      definitions[key] = visit(definitions[key]);
    }
  }
  return jsonSchema2;
}
function visit(def) {
  if (typeof def === "boolean")
    return def;
  return addAdditionalPropertiesToJsonSchema(def);
}
var ignoreOverride = /* @__PURE__ */ Symbol("Let zodToJsonSchema decide on which parser to use");
var defaultOptions = {
  name: undefined,
  $refStrategy: "root",
  basePath: ["#"],
  effectStrategy: "input",
  pipeStrategy: "all",
  dateStrategy: "format:date-time",
  mapStrategy: "entries",
  removeAdditionalStrategy: "passthrough",
  allowedAdditionalProperties: true,
  rejectedAdditionalProperties: false,
  definitionPath: "definitions",
  strictUnions: false,
  definitions: {},
  errorMessages: false,
  patternStrategy: "escape",
  applyRegexFlags: false,
  emailStrategy: "format:email",
  base64Strategy: "contentEncoding:base64",
  nameStrategy: "ref"
};
var getDefaultOptions = (options) => typeof options === "string" ? {
  ...defaultOptions,
  name: options
} : {
  ...defaultOptions,
  ...options
};
function parseAnyDef() {
  return {};
}
function parseArrayDef(def, refs) {
  var _a32, _b32, _c;
  const res = {
    type: "array"
  };
  if (((_a32 = def.type) == null ? undefined : _a32._def) && ((_c = (_b32 = def.type) == null ? undefined : _b32._def) == null ? undefined : _c.typeName) !== "ZodAny") {
    res.items = parseDef(def.type._def, {
      ...refs,
      currentPath: [...refs.currentPath, "items"]
    });
  }
  if (def.minLength) {
    res.minItems = def.minLength.value;
  }
  if (def.maxLength) {
    res.maxItems = def.maxLength.value;
  }
  if (def.exactLength) {
    res.minItems = def.exactLength.value;
    res.maxItems = def.exactLength.value;
  }
  return res;
}
function parseBigintDef(def) {
  const res = {
    type: "integer",
    format: "int64"
  };
  if (!def.checks)
    return res;
  for (const check of def.checks) {
    switch (check.kind) {
      case "min":
        if (check.inclusive) {
          res.minimum = check.value;
        } else {
          res.exclusiveMinimum = check.value;
        }
        break;
      case "max":
        if (check.inclusive) {
          res.maximum = check.value;
        } else {
          res.exclusiveMaximum = check.value;
        }
        break;
      case "multipleOf":
        res.multipleOf = check.value;
        break;
    }
  }
  return res;
}
function parseBooleanDef() {
  return { type: "boolean" };
}
function parseBrandedDef(_def, refs) {
  return parseDef(_def.type._def, refs);
}
var parseCatchDef = (def, refs) => {
  return parseDef(def.innerType._def, refs);
};
function parseDateDef(def, refs, overrideDateStrategy) {
  const strategy = overrideDateStrategy != null ? overrideDateStrategy : refs.dateStrategy;
  if (Array.isArray(strategy)) {
    return {
      anyOf: strategy.map((item) => parseDateDef(def, refs, item))
    };
  }
  switch (strategy) {
    case "string":
    case "format:date-time":
      return {
        type: "string",
        format: "date-time"
      };
    case "format:date":
      return {
        type: "string",
        format: "date"
      };
    case "integer":
      return integerDateParser(def);
  }
}
var integerDateParser = (def) => {
  const res = {
    type: "integer",
    format: "unix-time"
  };
  for (const check of def.checks) {
    switch (check.kind) {
      case "min":
        res.minimum = check.value;
        break;
      case "max":
        res.maximum = check.value;
        break;
    }
  }
  return res;
};
function parseDefaultDef(_def, refs) {
  return {
    ...parseDef(_def.innerType._def, refs),
    default: _def.defaultValue()
  };
}
function parseEffectsDef(_def, refs) {
  return refs.effectStrategy === "input" ? parseDef(_def.schema._def, refs) : parseAnyDef();
}
function parseEnumDef(def) {
  return {
    type: "string",
    enum: Array.from(def.values)
  };
}
var isJsonSchema7AllOfType = (type) => {
  if ("type" in type && type.type === "string")
    return false;
  return "allOf" in type;
};
function parseIntersectionDef(def, refs) {
  const allOf = [
    parseDef(def.left._def, {
      ...refs,
      currentPath: [...refs.currentPath, "allOf", "0"]
    }),
    parseDef(def.right._def, {
      ...refs,
      currentPath: [...refs.currentPath, "allOf", "1"]
    })
  ].filter((x) => !!x);
  const mergedAllOf = [];
  allOf.forEach((schema) => {
    if (isJsonSchema7AllOfType(schema)) {
      mergedAllOf.push(...schema.allOf);
    } else {
      let nestedSchema = schema;
      if ("additionalProperties" in schema && schema.additionalProperties === false) {
        const { additionalProperties: _additionalProperties, ...rest } = schema;
        nestedSchema = rest;
      }
      mergedAllOf.push(nestedSchema);
    }
  });
  return mergedAllOf.length ? { allOf: mergedAllOf } : undefined;
}
function parseLiteralDef(def) {
  const parsedType2 = typeof def.value;
  if (parsedType2 !== "bigint" && parsedType2 !== "number" && parsedType2 !== "boolean" && parsedType2 !== "string") {
    return {
      type: Array.isArray(def.value) ? "array" : "object"
    };
  }
  return {
    type: parsedType2 === "bigint" ? "integer" : parsedType2,
    const: def.value
  };
}
var emojiRegex = undefined;
var zodPatterns = {
  cuid: /^[cC][^\s-]{8,}$/,
  cuid2: /^[0-9a-z]+$/,
  ulid: /^[0-9A-HJKMNP-TV-Z]{26}$/,
  email: /^(?!\.)(?!.*\.\.)([a-zA-Z0-9_'+\-\.]*)[a-zA-Z0-9_+-]@([a-zA-Z0-9][a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}$/,
  emoji: () => {
    if (emojiRegex === undefined) {
      emojiRegex = RegExp("^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$", "u");
    }
    return emojiRegex;
  },
  uuid: /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/,
  ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,
  ipv4Cidr: /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/,
  ipv6: /^(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))$/,
  ipv6Cidr: /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,
  base64: /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/,
  base64url: /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/,
  nanoid: /^[a-zA-Z0-9_-]{21}$/,
  jwt: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/
};
function parseStringDef(def, refs) {
  const res = {
    type: "string"
  };
  if (def.checks) {
    for (const check of def.checks) {
      switch (check.kind) {
        case "min":
          res.minLength = typeof res.minLength === "number" ? Math.max(res.minLength, check.value) : check.value;
          break;
        case "max":
          res.maxLength = typeof res.maxLength === "number" ? Math.min(res.maxLength, check.value) : check.value;
          break;
        case "email":
          switch (refs.emailStrategy) {
            case "format:email":
              addFormat(res, "email", check.message, refs);
              break;
            case "format:idn-email":
              addFormat(res, "idn-email", check.message, refs);
              break;
            case "pattern:zod":
              addPattern(res, zodPatterns.email, check.message, refs);
              break;
          }
          break;
        case "url":
          addFormat(res, "uri", check.message, refs);
          break;
        case "uuid":
          addFormat(res, "uuid", check.message, refs);
          break;
        case "regex":
          addPattern(res, check.regex, check.message, refs);
          break;
        case "cuid":
          addPattern(res, zodPatterns.cuid, check.message, refs);
          break;
        case "cuid2":
          addPattern(res, zodPatterns.cuid2, check.message, refs);
          break;
        case "startsWith":
          addPattern(res, RegExp(`^${escapeLiteralCheckValue(check.value, refs)}`), check.message, refs);
          break;
        case "endsWith":
          addPattern(res, RegExp(`${escapeLiteralCheckValue(check.value, refs)}$`), check.message, refs);
          break;
        case "datetime":
          addFormat(res, "date-time", check.message, refs);
          break;
        case "date":
          addFormat(res, "date", check.message, refs);
          break;
        case "time":
          addFormat(res, "time", check.message, refs);
          break;
        case "duration":
          addFormat(res, "duration", check.message, refs);
          break;
        case "length":
          res.minLength = typeof res.minLength === "number" ? Math.max(res.minLength, check.value) : check.value;
          res.maxLength = typeof res.maxLength === "number" ? Math.min(res.maxLength, check.value) : check.value;
          break;
        case "includes": {
          addPattern(res, RegExp(escapeLiteralCheckValue(check.value, refs)), check.message, refs);
          break;
        }
        case "ip": {
          if (check.version !== "v6") {
            addFormat(res, "ipv4", check.message, refs);
          }
          if (check.version !== "v4") {
            addFormat(res, "ipv6", check.message, refs);
          }
          break;
        }
        case "base64url":
          addPattern(res, zodPatterns.base64url, check.message, refs);
          break;
        case "jwt":
          addPattern(res, zodPatterns.jwt, check.message, refs);
          break;
        case "cidr": {
          if (check.version !== "v6") {
            addPattern(res, zodPatterns.ipv4Cidr, check.message, refs);
          }
          if (check.version !== "v4") {
            addPattern(res, zodPatterns.ipv6Cidr, check.message, refs);
          }
          break;
        }
        case "emoji":
          addPattern(res, zodPatterns.emoji(), check.message, refs);
          break;
        case "ulid": {
          addPattern(res, zodPatterns.ulid, check.message, refs);
          break;
        }
        case "base64": {
          switch (refs.base64Strategy) {
            case "format:binary": {
              addFormat(res, "binary", check.message, refs);
              break;
            }
            case "contentEncoding:base64": {
              res.contentEncoding = "base64";
              break;
            }
            case "pattern:zod": {
              addPattern(res, zodPatterns.base64, check.message, refs);
              break;
            }
          }
          break;
        }
        case "nanoid": {
          addPattern(res, zodPatterns.nanoid, check.message, refs);
        }
        case "toLowerCase":
        case "toUpperCase":
        case "trim":
          break;
        default:
      }
    }
  }
  return res;
}
function escapeLiteralCheckValue(literal2, refs) {
  return refs.patternStrategy === "escape" ? escapeNonAlphaNumeric(literal2) : literal2;
}
var ALPHA_NUMERIC = new Set("ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvxyz0123456789");
function escapeNonAlphaNumeric(source) {
  let result = "";
  for (let i = 0;i < source.length; i++) {
    if (!ALPHA_NUMERIC.has(source[i])) {
      result += "\\";
    }
    result += source[i];
  }
  return result;
}
function addFormat(schema, value, message, refs) {
  var _a32;
  if (schema.format || ((_a32 = schema.anyOf) == null ? undefined : _a32.some((x) => x.format))) {
    if (!schema.anyOf) {
      schema.anyOf = [];
    }
    if (schema.format) {
      schema.anyOf.push({
        format: schema.format
      });
      delete schema.format;
    }
    schema.anyOf.push({
      format: value,
      ...message && refs.errorMessages && { errorMessage: { format: message } }
    });
  } else {
    schema.format = value;
  }
}
function addPattern(schema, regex, message, refs) {
  var _a32;
  if (schema.pattern || ((_a32 = schema.allOf) == null ? undefined : _a32.some((x) => x.pattern))) {
    if (!schema.allOf) {
      schema.allOf = [];
    }
    if (schema.pattern) {
      schema.allOf.push({
        pattern: schema.pattern
      });
      delete schema.pattern;
    }
    schema.allOf.push({
      pattern: stringifyRegExpWithFlags(regex, refs),
      ...message && refs.errorMessages && { errorMessage: { pattern: message } }
    });
  } else {
    schema.pattern = stringifyRegExpWithFlags(regex, refs);
  }
}
function stringifyRegExpWithFlags(regex, refs) {
  var _a32;
  if (!refs.applyRegexFlags || !regex.flags) {
    return regex.source;
  }
  const flags = {
    i: regex.flags.includes("i"),
    m: regex.flags.includes("m"),
    s: regex.flags.includes("s")
  };
  const source = flags.i ? regex.source.toLowerCase() : regex.source;
  let pattern = "";
  let isEscaped = false;
  let inCharGroup = false;
  let inCharRange = false;
  for (let i = 0;i < source.length; i++) {
    if (isEscaped) {
      pattern += source[i];
      isEscaped = false;
      continue;
    }
    if (flags.i) {
      if (inCharGroup) {
        if (source[i].match(/[a-z]/)) {
          if (inCharRange) {
            pattern += source[i];
            pattern += `${source[i - 2]}-${source[i]}`.toUpperCase();
            inCharRange = false;
          } else if (source[i + 1] === "-" && ((_a32 = source[i + 2]) == null ? undefined : _a32.match(/[a-z]/))) {
            pattern += source[i];
            inCharRange = true;
          } else {
            pattern += `${source[i]}${source[i].toUpperCase()}`;
          }
          continue;
        }
      } else if (source[i].match(/[a-z]/)) {
        pattern += `[${source[i]}${source[i].toUpperCase()}]`;
        continue;
      }
    }
    if (flags.m) {
      if (source[i] === "^") {
        pattern += `(^|(?<=[\r
]))`;
        continue;
      } else if (source[i] === "$") {
        pattern += `($|(?=[\r
]))`;
        continue;
      }
    }
    if (flags.s && source[i] === ".") {
      pattern += inCharGroup ? `${source[i]}\r
` : `[${source[i]}\r
]`;
      continue;
    }
    pattern += source[i];
    if (source[i] === "\\") {
      isEscaped = true;
    } else if (inCharGroup && source[i] === "]") {
      inCharGroup = false;
    } else if (!inCharGroup && source[i] === "[") {
      inCharGroup = true;
    }
  }
  try {
    new RegExp(pattern);
  } catch (e) {
    console.warn(`Could not convert regex pattern at ${refs.currentPath.join("/")} to a flag-independent form! Falling back to the flag-ignorant source`);
    return regex.source;
  }
  return pattern;
}
function parseRecordDef(def, refs) {
  var _a32, _b32, _c, _d, _e, _f;
  const schema = {
    type: "object",
    additionalProperties: (_a32 = parseDef(def.valueType._def, {
      ...refs,
      currentPath: [...refs.currentPath, "additionalProperties"]
    })) != null ? _a32 : refs.allowedAdditionalProperties
  };
  if (((_b32 = def.keyType) == null ? undefined : _b32._def.typeName) === "ZodString" && ((_c = def.keyType._def.checks) == null ? undefined : _c.length)) {
    const { type: _type, ...keyType } = parseStringDef(def.keyType._def, refs);
    return {
      ...schema,
      propertyNames: keyType
    };
  } else if (((_d = def.keyType) == null ? undefined : _d._def.typeName) === "ZodEnum") {
    return {
      ...schema,
      propertyNames: {
        enum: def.keyType._def.values
      }
    };
  } else if (((_e = def.keyType) == null ? undefined : _e._def.typeName) === "ZodBranded" && def.keyType._def.type._def.typeName === "ZodString" && ((_f = def.keyType._def.type._def.checks) == null ? undefined : _f.length)) {
    const { type: _type, ...keyType } = parseBrandedDef(def.keyType._def, refs);
    return {
      ...schema,
      propertyNames: keyType
    };
  }
  return schema;
}
function parseMapDef(def, refs) {
  if (refs.mapStrategy === "record") {
    return parseRecordDef(def, refs);
  }
  const keys = parseDef(def.keyType._def, {
    ...refs,
    currentPath: [...refs.currentPath, "items", "items", "0"]
  }) || parseAnyDef();
  const values = parseDef(def.valueType._def, {
    ...refs,
    currentPath: [...refs.currentPath, "items", "items", "1"]
  }) || parseAnyDef();
  return {
    type: "array",
    maxItems: 125,
    items: {
      type: "array",
      items: [keys, values],
      minItems: 2,
      maxItems: 2
    }
  };
}
function parseNativeEnumDef(def) {
  const object2 = def.values;
  const actualKeys = Object.keys(def.values).filter((key) => {
    return typeof object2[object2[key]] !== "number";
  });
  const actualValues = actualKeys.map((key) => object2[key]);
  const parsedTypes = Array.from(new Set(actualValues.map((values) => typeof values)));
  return {
    type: parsedTypes.length === 1 ? parsedTypes[0] === "string" ? "string" : "number" : ["string", "number"],
    enum: actualValues
  };
}
function parseNeverDef() {
  return { not: parseAnyDef() };
}
function parseNullDef() {
  return {
    type: "null"
  };
}
var primitiveMappings = {
  ZodString: "string",
  ZodNumber: "number",
  ZodBigInt: "integer",
  ZodBoolean: "boolean",
  ZodNull: "null"
};
function parseUnionDef(def, refs) {
  const options = def.options instanceof Map ? Array.from(def.options.values()) : def.options;
  if (options.every((x) => (x._def.typeName in primitiveMappings) && (!x._def.checks || !x._def.checks.length))) {
    const types = options.reduce((types2, x) => {
      const type = primitiveMappings[x._def.typeName];
      return type && !types2.includes(type) ? [...types2, type] : types2;
    }, []);
    return {
      type: types.length > 1 ? types : types[0]
    };
  } else if (options.every((x) => x._def.typeName === "ZodLiteral" && !x.description)) {
    const types = options.reduce((acc, x) => {
      const type = typeof x._def.value;
      switch (type) {
        case "string":
        case "number":
        case "boolean":
          return [...acc, type];
        case "bigint":
          return [...acc, "integer"];
        case "object":
          if (x._def.value === null)
            return [...acc, "null"];
        case "symbol":
        case "undefined":
        case "function":
        default:
          return acc;
      }
    }, []);
    if (types.length === options.length) {
      const uniqueTypes = types.filter((x, i, a) => a.indexOf(x) === i);
      return {
        type: uniqueTypes.length > 1 ? uniqueTypes : uniqueTypes[0],
        enum: options.reduce((acc, x) => {
          return acc.includes(x._def.value) ? acc : [...acc, x._def.value];
        }, [])
      };
    }
  } else if (options.every((x) => x._def.typeName === "ZodEnum")) {
    return {
      type: "string",
      enum: options.reduce((acc, x) => [
        ...acc,
        ...x._def.values.filter((x2) => !acc.includes(x2))
      ], [])
    };
  }
  return asAnyOf(def, refs);
}
var asAnyOf = (def, refs) => {
  const anyOf = (def.options instanceof Map ? Array.from(def.options.values()) : def.options).map((x, i) => parseDef(x._def, {
    ...refs,
    currentPath: [...refs.currentPath, "anyOf", `${i}`]
  })).filter((x) => !!x && (!refs.strictUnions || typeof x === "object" && Object.keys(x).length > 0));
  return anyOf.length ? { anyOf } : undefined;
};
function parseNullableDef(def, refs) {
  if (["ZodString", "ZodNumber", "ZodBigInt", "ZodBoolean", "ZodNull"].includes(def.innerType._def.typeName) && (!def.innerType._def.checks || !def.innerType._def.checks.length)) {
    return {
      type: [
        primitiveMappings[def.innerType._def.typeName],
        "null"
      ]
    };
  }
  const base = parseDef(def.innerType._def, {
    ...refs,
    currentPath: [...refs.currentPath, "anyOf", "0"]
  });
  return base && { anyOf: [base, { type: "null" }] };
}
function parseNumberDef(def) {
  const res = {
    type: "number"
  };
  if (!def.checks)
    return res;
  for (const check of def.checks) {
    switch (check.kind) {
      case "int":
        res.type = "integer";
        break;
      case "min":
        if (check.inclusive) {
          res.minimum = check.value;
        } else {
          res.exclusiveMinimum = check.value;
        }
        break;
      case "max":
        if (check.inclusive) {
          res.maximum = check.value;
        } else {
          res.exclusiveMaximum = check.value;
        }
        break;
      case "multipleOf":
        res.multipleOf = check.value;
        break;
    }
  }
  return res;
}
function parseObjectDef(def, refs) {
  const result = {
    type: "object",
    properties: {}
  };
  const required2 = [];
  const shape = def.shape();
  for (const propName in shape) {
    let propDef = shape[propName];
    if (propDef === undefined || propDef._def === undefined) {
      continue;
    }
    const propOptional = safeIsOptional(propDef);
    const parsedDef = parseDef(propDef._def, {
      ...refs,
      currentPath: [...refs.currentPath, "properties", propName],
      propertyPath: [...refs.currentPath, "properties", propName]
    });
    if (parsedDef === undefined) {
      continue;
    }
    result.properties[propName] = parsedDef;
    if (!propOptional) {
      required2.push(propName);
    }
  }
  if (required2.length) {
    result.required = required2;
  }
  const additionalProperties = decideAdditionalProperties(def, refs);
  if (additionalProperties !== undefined) {
    result.additionalProperties = additionalProperties;
  }
  return result;
}
function decideAdditionalProperties(def, refs) {
  if (def.catchall._def.typeName !== "ZodNever") {
    return parseDef(def.catchall._def, {
      ...refs,
      currentPath: [...refs.currentPath, "additionalProperties"]
    });
  }
  switch (def.unknownKeys) {
    case "passthrough":
      return refs.allowedAdditionalProperties;
    case "strict":
      return refs.rejectedAdditionalProperties;
    case "strip":
      return refs.removeAdditionalStrategy === "strict" ? refs.allowedAdditionalProperties : refs.rejectedAdditionalProperties;
  }
}
function safeIsOptional(schema) {
  try {
    return schema.isOptional();
  } catch (e) {
    return true;
  }
}
var parseOptionalDef = (def, refs) => {
  var _a32;
  if (refs.currentPath.toString() === ((_a32 = refs.propertyPath) == null ? undefined : _a32.toString())) {
    return parseDef(def.innerType._def, refs);
  }
  const innerSchema = parseDef(def.innerType._def, {
    ...refs,
    currentPath: [...refs.currentPath, "anyOf", "1"]
  });
  return innerSchema ? { anyOf: [{ not: parseAnyDef() }, innerSchema] } : parseAnyDef();
};
var parsePipelineDef = (def, refs) => {
  if (refs.pipeStrategy === "input") {
    return parseDef(def.in._def, refs);
  } else if (refs.pipeStrategy === "output") {
    return parseDef(def.out._def, refs);
  }
  const inputSchema = parseDef(def.in._def, {
    ...refs,
    currentPath: [...refs.currentPath, "allOf", "0"]
  });
  const outputSchema = parseDef(def.out._def, {
    ...refs,
    currentPath: [...refs.currentPath, "allOf", inputSchema ? "1" : "0"]
  });
  return {
    allOf: [inputSchema, outputSchema].filter((schema) => schema !== undefined)
  };
};
function parsePromiseDef(def, refs) {
  return parseDef(def.type._def, refs);
}
function parseSetDef(def, refs) {
  const items = parseDef(def.valueType._def, {
    ...refs,
    currentPath: [...refs.currentPath, "items"]
  });
  const schema = {
    type: "array",
    uniqueItems: true,
    items
  };
  if (def.minSize) {
    schema.minItems = def.minSize.value;
  }
  if (def.maxSize) {
    schema.maxItems = def.maxSize.value;
  }
  return schema;
}
function parseTupleDef(def, refs) {
  if (def.rest) {
    return {
      type: "array",
      minItems: def.items.length,
      items: def.items.map((x, i) => parseDef(x._def, {
        ...refs,
        currentPath: [...refs.currentPath, "items", `${i}`]
      })).reduce((acc, x) => x === undefined ? acc : [...acc, x], []),
      additionalItems: parseDef(def.rest._def, {
        ...refs,
        currentPath: [...refs.currentPath, "additionalItems"]
      })
    };
  } else {
    return {
      type: "array",
      minItems: def.items.length,
      maxItems: def.items.length,
      items: def.items.map((x, i) => parseDef(x._def, {
        ...refs,
        currentPath: [...refs.currentPath, "items", `${i}`]
      })).reduce((acc, x) => x === undefined ? acc : [...acc, x], [])
    };
  }
}
function parseUndefinedDef() {
  return {
    not: parseAnyDef()
  };
}
function parseUnknownDef() {
  return parseAnyDef();
}
var parseReadonlyDef = (def, refs) => {
  return parseDef(def.innerType._def, refs);
};
var selectParser = (def, typeName, refs) => {
  switch (typeName) {
    case "ZodString":
      return parseStringDef(def, refs);
    case "ZodNumber":
      return parseNumberDef(def);
    case "ZodObject":
      return parseObjectDef(def, refs);
    case "ZodBigInt":
      return parseBigintDef(def);
    case "ZodBoolean":
      return parseBooleanDef();
    case "ZodDate":
      return parseDateDef(def, refs);
    case "ZodUndefined":
      return parseUndefinedDef();
    case "ZodNull":
      return parseNullDef();
    case "ZodArray":
      return parseArrayDef(def, refs);
    case "ZodUnion":
    case "ZodDiscriminatedUnion":
      return parseUnionDef(def, refs);
    case "ZodIntersection":
      return parseIntersectionDef(def, refs);
    case "ZodTuple":
      return parseTupleDef(def, refs);
    case "ZodRecord":
      return parseRecordDef(def, refs);
    case "ZodLiteral":
      return parseLiteralDef(def);
    case "ZodEnum":
      return parseEnumDef(def);
    case "ZodNativeEnum":
      return parseNativeEnumDef(def);
    case "ZodNullable":
      return parseNullableDef(def, refs);
    case "ZodOptional":
      return parseOptionalDef(def, refs);
    case "ZodMap":
      return parseMapDef(def, refs);
    case "ZodSet":
      return parseSetDef(def, refs);
    case "ZodLazy":
      return () => def.getter()._def;
    case "ZodPromise":
      return parsePromiseDef(def, refs);
    case "ZodNaN":
    case "ZodNever":
      return parseNeverDef();
    case "ZodEffects":
      return parseEffectsDef(def, refs);
    case "ZodAny":
      return parseAnyDef();
    case "ZodUnknown":
      return parseUnknownDef();
    case "ZodDefault":
      return parseDefaultDef(def, refs);
    case "ZodBranded":
      return parseBrandedDef(def, refs);
    case "ZodReadonly":
      return parseReadonlyDef(def, refs);
    case "ZodCatch":
      return parseCatchDef(def, refs);
    case "ZodPipeline":
      return parsePipelineDef(def, refs);
    case "ZodFunction":
    case "ZodVoid":
    case "ZodSymbol":
      return;
    default:
      return /* @__PURE__ */ ((_) => {
        return;
      })(typeName);
  }
};
var getRelativePath = (pathA, pathB) => {
  let i = 0;
  for (;i < pathA.length && i < pathB.length; i++) {
    if (pathA[i] !== pathB[i])
      break;
  }
  return [(pathA.length - i).toString(), ...pathB.slice(i)].join("/");
};
function parseDef(def, refs, forceResolution = false) {
  var _a32;
  const seenItem = refs.seen.get(def);
  if (refs.override) {
    const overrideResult = (_a32 = refs.override) == null ? undefined : _a32.call(refs, def, refs, seenItem, forceResolution);
    if (overrideResult !== ignoreOverride) {
      return overrideResult;
    }
  }
  if (seenItem && !forceResolution) {
    const seenSchema = get$ref(seenItem, refs);
    if (seenSchema !== undefined) {
      return seenSchema;
    }
  }
  const newItem = { def, path: refs.currentPath, jsonSchema: undefined };
  refs.seen.set(def, newItem);
  const jsonSchemaOrGetter = selectParser(def, def.typeName, refs);
  const jsonSchema2 = typeof jsonSchemaOrGetter === "function" ? parseDef(jsonSchemaOrGetter(), refs) : jsonSchemaOrGetter;
  if (jsonSchema2) {
    addMeta(def, refs, jsonSchema2);
  }
  if (refs.postProcess) {
    const postProcessResult = refs.postProcess(jsonSchema2, def, refs);
    newItem.jsonSchema = jsonSchema2;
    return postProcessResult;
  }
  newItem.jsonSchema = jsonSchema2;
  return jsonSchema2;
}
var get$ref = (item, refs) => {
  switch (refs.$refStrategy) {
    case "root":
      return { $ref: item.path.join("/") };
    case "relative":
      return { $ref: getRelativePath(refs.currentPath, item.path) };
    case "none":
    case "seen": {
      if (item.path.length < refs.currentPath.length && item.path.every((value, index) => refs.currentPath[index] === value)) {
        console.warn(`Recursive reference detected at ${refs.currentPath.join("/")}! Defaulting to any`);
        return parseAnyDef();
      }
      return refs.$refStrategy === "seen" ? parseAnyDef() : undefined;
    }
  }
};
var addMeta = (def, refs, jsonSchema2) => {
  if (def.description) {
    jsonSchema2.description = def.description;
  }
  return jsonSchema2;
};
var getRefs = (options) => {
  const _options = getDefaultOptions(options);
  const currentPath = _options.name !== undefined ? [..._options.basePath, _options.definitionPath, _options.name] : _options.basePath;
  return {
    ..._options,
    currentPath,
    propertyPath: undefined,
    seen: new Map(Object.entries(_options.definitions).map(([name32, def]) => [
      def._def,
      {
        def: def._def,
        path: [..._options.basePath, _options.definitionPath, name32],
        jsonSchema: undefined
      }
    ]))
  };
};
var zod3ToJsonSchema = (schema, options) => {
  var _a32;
  const refs = getRefs(options);
  let definitions = typeof options === "object" && options.definitions ? Object.entries(options.definitions).reduce((acc, [name42, schema2]) => {
    var _a42;
    return {
      ...acc,
      [name42]: (_a42 = parseDef(schema2._def, {
        ...refs,
        currentPath: [...refs.basePath, refs.definitionPath, name42]
      }, true)) != null ? _a42 : parseAnyDef()
    };
  }, {}) : undefined;
  const name32 = typeof options === "string" ? options : (options == null ? undefined : options.nameStrategy) === "title" ? undefined : options == null ? undefined : options.name;
  const main = (_a32 = parseDef(schema._def, name32 === undefined ? refs : {
    ...refs,
    currentPath: [...refs.basePath, refs.definitionPath, name32]
  }, false)) != null ? _a32 : parseAnyDef();
  const title = typeof options === "object" && options.name !== undefined && options.nameStrategy === "title" ? options.name : undefined;
  if (title !== undefined) {
    main.title = title;
  }
  const combined = name32 === undefined ? definitions ? {
    ...main,
    [refs.definitionPath]: definitions
  } : main : {
    $ref: [
      ...refs.$refStrategy === "relative" ? [] : refs.basePath,
      refs.definitionPath,
      name32
    ].join("/"),
    [refs.definitionPath]: {
      ...definitions,
      [name32]: main
    }
  };
  combined.$schema = "http://json-schema.org/draft-07/schema#";
  return combined;
};
var schemaSymbol = /* @__PURE__ */ Symbol.for("vercel.ai.schema");
function lazySchema(createSchema) {
  let schema;
  return () => {
    if (schema == null) {
      schema = createSchema();
    }
    return schema;
  };
}
function jsonSchema(jsonSchema2, {
  validate
} = {}) {
  return {
    [schemaSymbol]: true,
    _type: undefined,
    get jsonSchema() {
      if (typeof jsonSchema2 === "function") {
        jsonSchema2 = jsonSchema2();
      }
      return jsonSchema2;
    },
    validate
  };
}
function isSchema(value) {
  return typeof value === "object" && value !== null && schemaSymbol in value && value[schemaSymbol] === true && "jsonSchema" in value && "validate" in value;
}
function asSchema(schema) {
  return schema == null ? jsonSchema({
    type: "object",
    properties: {},
    additionalProperties: false
  }) : isSchema(schema) ? schema : ("~standard" in schema) ? schema["~standard"].vendor === "zod" ? zodSchema(schema) : standardSchema(schema) : schema();
}
function standardSchema(standardSchema2) {
  return jsonSchema(() => {
    if (!hasStandardJsonSchema(standardSchema2)) {
      throw new Error(`Standard schema vendor '${standardSchema2["~standard"].vendor}' does not support JSON Schema conversion.`);
    }
    return addAdditionalPropertiesToJsonSchema(standardSchema2["~standard"].jsonSchema.input({
      target: "draft-07"
    }));
  }, {
    validate: async (value) => {
      const result = await standardSchema2["~standard"].validate(value);
      return "value" in result ? { success: true, value: result.value } : {
        success: false,
        error: new TypeValidationError({
          value,
          cause: result.issues
        })
      };
    }
  });
}
function hasStandardJsonSchema(schema) {
  return schema["~standard"].jsonSchema != null;
}
function zod3Schema(zodSchema2, options) {
  var _a32;
  const useReferences = (_a32 = options == null ? undefined : options.useReferences) != null ? _a32 : false;
  return jsonSchema(() => zod3ToJsonSchema(zodSchema2, {
    $refStrategy: useReferences ? "root" : "none"
  }), {
    validate: async (value) => {
      const result = await zodSchema2.safeParseAsync(value);
      return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
    }
  });
}
function zod4Schema(zodSchema2, options) {
  var _a32;
  const useReferences = (_a32 = options == null ? undefined : options.useReferences) != null ? _a32 : false;
  return jsonSchema(() => addAdditionalPropertiesToJsonSchema(toJSONSchema(zodSchema2, {
    target: "draft-7",
    io: "input",
    reused: useReferences ? "ref" : "inline"
  })), {
    validate: async (value) => {
      const result = await safeParseAsync2(zodSchema2, value);
      return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
    }
  });
}
function isZod4Schema(zodSchema2) {
  return "_zod" in zodSchema2;
}
function zodSchema(zodSchema2, options) {
  if (isZod4Schema(zodSchema2)) {
    return zod4Schema(zodSchema2, options);
  } else {
    return zod3Schema(zodSchema2, options);
  }
}
async function validateTypes({
  value,
  schema,
  context
}) {
  const result = await safeValidateTypes({ value, schema, context });
  if (!result.success) {
    throw TypeValidationError.wrap({ value, cause: result.error, context });
  }
  return result.value;
}
async function safeValidateTypes({
  value,
  schema,
  context
}) {
  const actualSchema = asSchema(schema);
  try {
    if (actualSchema.validate == null) {
      return { success: true, value, rawValue: value };
    }
    const result = await actualSchema.validate(value);
    if (result.success) {
      return { success: true, value: result.value, rawValue: value };
    }
    return {
      success: false,
      error: TypeValidationError.wrap({ value, cause: result.error, context }),
      rawValue: value
    };
  } catch (error) {
    return {
      success: false,
      error: TypeValidationError.wrap({ value, cause: error, context }),
      rawValue: value
    };
  }
}
async function parseJSON({
  text,
  schema
}) {
  try {
    const value = secureJsonParse(text);
    if (schema == null) {
      return value;
    }
    return await validateTypes({ value, schema });
  } catch (error) {
    if (JSONParseError.isInstance(error) || TypeValidationError.isInstance(error)) {
      throw error;
    }
    throw new JSONParseError({ text, cause: error });
  }
}
async function safeParseJSON({
  text,
  schema
}) {
  try {
    const value = secureJsonParse(text);
    if (schema == null) {
      return { success: true, value, rawValue: value };
    }
    return await safeValidateTypes({ value, schema });
  } catch (error) {
    return {
      success: false,
      error: JSONParseError.isInstance(error) ? error : new JSONParseError({ text, cause: error }),
      rawValue: undefined
    };
  }
}
function parseJsonEventStream({
  stream,
  schema
}) {
  return stream.pipeThrough(new TextDecoderStream).pipeThrough(new EventSourceParserStream).pipeThrough(new TransformStream({
    async transform({ data }, controller) {
      if (data === "[DONE]") {
        return;
      }
      controller.enqueue(await safeParseJSON({ text: data, schema }));
    }
  }));
}
var getOriginalFetch4 = () => globalThis.fetch;
var postJsonToApi = async ({
  url,
  headers,
  body,
  failedResponseHandler,
  successfulResponseHandler,
  abortSignal,
  fetch: fetch2
}) => await postToApi({
  url,
  headers: {
    "Content-Type": "application/json",
    ...headers
  },
  body: {
    content: JSON.stringify(body),
    values: body
  },
  failedResponseHandler,
  successfulResponseHandler,
  abortSignal,
  fetch: fetch2
});
var postToApi = async ({
  url,
  headers = {},
  body,
  successfulResponseHandler,
  failedResponseHandler,
  abortSignal,
  fetch: fetch2 = getOriginalFetch4()
}) => {
  try {
    const response = await fetch2(url, {
      method: "POST",
      headers: withUserAgentSuffix(headers, `ai-sdk/provider-utils/${VERSION}`, getRuntimeEnvironmentUserAgent()),
      body: body.content,
      signal: abortSignal
    });
    const responseHeaders = extractResponseHeaders(response);
    if (!response.ok) {
      let errorInformation;
      try {
        errorInformation = await failedResponseHandler({
          response,
          url,
          requestBodyValues: body.values
        });
      } catch (error) {
        if (isAbortError(error) || APICallError.isInstance(error)) {
          throw error;
        }
        throw new APICallError({
          message: "Failed to process error response",
          cause: error,
          statusCode: response.status,
          url,
          responseHeaders,
          requestBodyValues: body.values
        });
      }
      throw errorInformation.value;
    }
    try {
      return await successfulResponseHandler({
        response,
        url,
        requestBodyValues: body.values
      });
    } catch (error) {
      if (error instanceof Error) {
        if (isAbortError(error) || APICallError.isInstance(error)) {
          throw error;
        }
      }
      throw new APICallError({
        message: "Failed to process successful response",
        cause: error,
        statusCode: response.status,
        url,
        responseHeaders,
        requestBodyValues: body.values
      });
    }
  } catch (error) {
    throw handleFetchError({ error, url, requestBodyValues: body.values });
  }
};
function tool(tool2) {
  return tool2;
}
function createProviderExecutedToolFactory({
  id,
  inputSchema,
  outputSchema,
  supportsDeferredResults
}) {
  return ({
    onInputStart,
    onInputDelta,
    onInputAvailable,
    ...args
  }) => tool({
    type: "provider",
    isProviderExecuted: true,
    id,
    args,
    inputSchema,
    outputSchema,
    onInputStart,
    onInputDelta,
    onInputAvailable,
    supportsDeferredResults
  });
}
async function resolve(value) {
  if (typeof value === "function") {
    value = value();
  }
  return Promise.resolve(value);
}
var retryWithExponentialBackoff = ({
  maxRetries = 2,
  initialDelayInMs = 2000,
  backoffFactor = 2,
  abortSignal,
  shouldRetry,
  getDelayInMs = ({ exponentialBackoffDelay }) => exponentialBackoffDelay,
  createRetryError = ({ message }) => new Error(message)
}) => async (f) => retryWithExponentialBackoffInternal(f, {
  maxRetries,
  delayInMs: initialDelayInMs,
  backoffFactor,
  abortSignal,
  shouldRetry,
  getDelayInMs,
  createRetryError
});
async function retryWithExponentialBackoffInternal(f, {
  maxRetries,
  delayInMs,
  backoffFactor,
  abortSignal,
  shouldRetry,
  getDelayInMs,
  createRetryError
}, errors2 = []) {
  try {
    return await f();
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (maxRetries === 0) {
      throw error;
    }
    const errorMessage = getErrorMessage(error);
    const newErrors = [...errors2, error];
    const tryNumber = newErrors.length;
    if (tryNumber > maxRetries) {
      throw createRetryError({
        message: `Failed after ${tryNumber} attempts. Last error: ${errorMessage}`,
        reason: "maxRetriesExceeded",
        errors: newErrors
      });
    }
    if (await shouldRetry(error) && tryNumber <= maxRetries) {
      await delay(getDelayInMs({
        error,
        exponentialBackoffDelay: delayInMs
      }), { abortSignal });
      return retryWithExponentialBackoffInternal(f, {
        maxRetries,
        delayInMs: backoffFactor * delayInMs,
        backoffFactor,
        abortSignal,
        shouldRetry,
        getDelayInMs,
        createRetryError
      }, newErrors);
    }
    if (tryNumber === 1) {
      throw error;
    }
    throw createRetryError({
      message: `Failed after ${tryNumber} attempts with non-retryable error: '${errorMessage}'`,
      reason: "errorNotRetryable",
      errors: newErrors
    });
  }
}
var textDecoder2 = new TextDecoder;
function wrapResponseBodyStream({
  stream,
  url,
  requestBodyValues,
  statusCode,
  responseHeaders
}) {
  const reader = stream.getReader();
  let readerReleased = false;
  const releaseReader = () => {
    if (!readerReleased) {
      reader.releaseLock();
      readerReleased = true;
    }
  };
  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          releaseReader();
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        releaseReader();
        if (isAbortError(error)) {
          controller.error(error);
          return;
        }
        controller.error(handleFetchError({
          error: new APICallError({
            message: "Failed to process successful response",
            cause: error,
            statusCode,
            url,
            responseHeaders,
            requestBodyValues
          }),
          url,
          requestBodyValues
        }));
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        releaseReader();
      }
    }
  });
}
async function readResponseBodyAsText({
  response,
  url
}) {
  return textDecoder2.decode(await readResponseWithSizeLimit({
    response,
    url
  }));
}
var createJsonErrorResponseHandler = ({
  errorSchema,
  errorToMessage,
  isRetryable
}) => async ({ response, url, requestBodyValues }) => {
  const responseBody = await readResponseBodyAsText({ response, url });
  const responseHeaders = extractResponseHeaders(response);
  if (responseBody.trim() === "") {
    return {
      responseHeaders,
      value: new APICallError({
        message: response.statusText,
        url,
        requestBodyValues,
        statusCode: response.status,
        responseHeaders,
        responseBody,
        isRetryable: isRetryable == null ? undefined : isRetryable(response)
      })
    };
  }
  try {
    const parsedError = await parseJSON({
      text: responseBody,
      schema: errorSchema
    });
    return {
      responseHeaders,
      value: new APICallError({
        message: errorToMessage(parsedError),
        url,
        requestBodyValues,
        statusCode: response.status,
        responseHeaders,
        responseBody,
        data: parsedError,
        isRetryable: isRetryable == null ? undefined : isRetryable(response, parsedError)
      })
    };
  } catch (e) {
    return {
      responseHeaders,
      value: new APICallError({
        message: response.statusText,
        url,
        requestBodyValues,
        statusCode: response.status,
        responseHeaders,
        responseBody,
        isRetryable: isRetryable == null ? undefined : isRetryable(response)
      })
    };
  }
};
var createEventSourceResponseHandler = (chunkSchema) => async ({ response, url, requestBodyValues }) => {
  const responseHeaders = extractResponseHeaders(response);
  if (response.body == null) {
    throw new EmptyResponseBodyError({});
  }
  return {
    responseHeaders,
    value: parseJsonEventStream({
      stream: wrapResponseBodyStream({
        stream: response.body,
        url,
        requestBodyValues,
        statusCode: response.status,
        responseHeaders
      }),
      schema: chunkSchema
    })
  };
};
var createJsonResponseHandler = (responseSchema) => async ({ response, url, requestBodyValues }) => {
  const responseBody = await readResponseBodyAsText({ response, url });
  const parsedResult = await safeParseJSON({
    text: responseBody,
    schema: responseSchema
  });
  const responseHeaders = extractResponseHeaders(response);
  if (!parsedResult.success) {
    throw new APICallError({
      message: "Invalid JSON response",
      cause: parsedResult.error,
      statusCode: response.status,
      responseHeaders,
      responseBody,
      url,
      requestBodyValues
    });
  }
  return {
    responseHeaders,
    value: parsedResult.value,
    rawValue: parsedResult.rawValue
  };
};
var createJsonLinesResponseHandler = (responseSchema) => async ({ response }) => {
  const responseHeaders = extractResponseHeaders(response);
  if (response.body == null) {
    throw new EmptyResponseBodyError({});
  }
  return {
    responseHeaders,
    value: parseJsonLines({
      stream: response.body,
      schema: responseSchema
    })
  };
};
async function* parseJsonLines({
  stream,
  schema
}) {
  const reader = stream.getReader();
  const decoder = new TextDecoder;
  let buffer = "";
  let finished = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        finished = true;
        buffer += decoder.decode();
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let lineEnd = buffer.indexOf(`
`);
      while (lineEnd !== -1) {
        const line = buffer.slice(0, lineEnd).replace(/\r$/, "");
        buffer = buffer.slice(lineEnd + 1);
        if (line.trim().length > 0) {
          yield await parseJSON({ text: line, schema });
        }
        lineEnd = buffer.indexOf(`
`);
      }
    }
    const finalLine = buffer.replace(/\r$/, "");
    if (finalLine.trim().length > 0) {
      yield await parseJSON({ text: finalLine, schema });
    }
  } finally {
    if (!finished) {
      await reader.cancel().catch(() => {});
    }
    reader.releaseLock();
  }
}
function isJSONSerializable(value) {
  if (value === null || value === undefined)
    return true;
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean")
    return true;
  if (type === "function" || type === "symbol" || type === "bigint")
    return false;
  if (Array.isArray(value)) {
    return value.every(isJSONSerializable);
  }
  if (Object.getPrototypeOf(value) === Object.prototype) {
    return Object.values(value).every(isJSONSerializable);
  }
  return false;
}
var name22 = "AI_SerializationError";
var marker32 = `vercel.ai.error.${name22}`;
var symbol22 = Symbol.for(marker32);
var _a22;
var _b22;
var SerializationError = class extends (_b22 = AISDKError, _a22 = symbol22, _b22) {
  constructor({
    message = "Failed to serialize value.",
    cause
  } = {}) {
    super({ name: name22, message, cause });
    this[_a22] = true;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker32);
  }
};
function serializeModelOptions(options) {
  const serializableConfig = {};
  for (const [key, value] of Object.entries(options.config)) {
    if (key === "headers") {
      const resolvedHeaders = resolveSync(value);
      if (isJSONSerializable(resolvedHeaders)) {
        serializableConfig[key] = resolvedHeaders;
      }
    } else if (isJSONSerializable(value)) {
      serializableConfig[key] = value;
    }
  }
  return { modelId: options.modelId, config: serializableConfig };
}
function resolveSync(value) {
  let next = value;
  if (typeof value === "function") {
    next = value();
  }
  if (next instanceof Promise) {
    throw new SerializationError({
      message: "Cannot serialize asynchronous model options."
    });
  }
  return next;
}
var TRANSCRIPTION_STREAM_START_FRAME_TYPE = "transcription-stream.start";
var TRANSCRIPTION_STREAM_AUDIO_DONE_FRAME_TYPE = "transcription-stream.audio-done";
function parseTranscriptionStreamPart(text) {
  let value;
  try {
    value = secureJsonParse(text);
  } catch (e) {
    return;
  }
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return;
  }
  const part = value;
  switch (part.type) {
    case "stream-start":
      return Array.isArray(part.warnings) && part.warnings.every(isWarning) ? part : undefined;
    case "transcript-delta":
      return isString(part.delta) && isOptional(part.id, isString) && isOptional(part.providerMetadata, isRecord) ? part : undefined;
    case "transcript-partial":
      return isString(part.text) && isOptional(part.id, isString) && isOptional(part.startSecond, isNumber) && isOptional(part.durationInSeconds, isNumber) && isOptional(part.channelIndex, isNumber) && isOptional(part.providerMetadata, isRecord) ? part : undefined;
    case "transcript-final":
      return isString(part.text) && isOptional(part.id, isString) && isOptional(part.startSecond, isNumber) && isOptional(part.endSecond, isNumber) && isOptional(part.channelIndex, isNumber) && isOptional(part.providerMetadata, isRecord) ? part : undefined;
    case "finish":
      return isString(part.text) && Array.isArray(part.segments) && part.segments.every(isSegment) && isOptional(part.language, isString) && isOptional(part.durationInSeconds, isNumber) && isOptional(part.providerMetadata, isRecord) ? part : undefined;
    case "response-metadata": {
      if (!(isOptional(part.modelId, isString) && isOptional(part.headers, isRecord))) {
        return;
      }
      const timestamp = part.timestamp;
      if (timestamp == null) {
        return { ...part, timestamp: undefined };
      }
      if (typeof timestamp !== "string") {
        return;
      }
      const revived = new Date(timestamp);
      return Number.isNaN(revived.getTime()) ? undefined : { ...part, timestamp: revived };
    }
    case "raw":
      return "rawValue" in part ? part : undefined;
    case "error":
      return "error" in part ? part : undefined;
    default:
      return;
  }
}
function isString(value) {
  return typeof value === "string";
}
function isNumber(value) {
  return typeof value === "number";
}
function isOptional(value, check) {
  return value === undefined || check(value);
}
function isWarning(value) {
  return isRecord(value) && isString(value.type);
}
function isSegment(value) {
  return isRecord(value) && isString(value.text) && isNumber(value.startSecond) && isNumber(value.endSecond);
}
function withoutTrailingSlash(url) {
  return url == null ? undefined : url.replace(/\/$/, "");
}

// node_modules/@ai-sdk/gateway/dist/index.js
var import_oidc = __toESM(require_dist(), 1);
var import_oidc2 = __toESM(require_dist(), 1);
var GATEWAY_REALTIME_SUBPROTOCOL = "ai-gateway-realtime.v1";
var GATEWAY_TRANSCRIPTION_SUBPROTOCOL = "ai-gateway-transcription.v1";
var GATEWAY_AUTH_SUBPROTOCOL_PREFIX = "ai-gateway-auth.";
var GATEWAY_TEAM_SUBPROTOCOL_PREFIX = "ai-gateway-team.";
function getGatewayRealtimeProtocols(token, options) {
  return buildGatewayProtocols(GATEWAY_REALTIME_SUBPROTOCOL, token, options);
}
function getGatewayTranscriptionProtocols(token, options) {
  return buildGatewayProtocols(GATEWAY_TRANSCRIPTION_SUBPROTOCOL, token, options);
}
function buildGatewayProtocols(marker122, token, options) {
  const protocols = [marker122, `${GATEWAY_AUTH_SUBPROTOCOL_PREFIX}${token}`];
  if (options == null ? undefined : options.teamIdOrSlug) {
    protocols.push(`${GATEWAY_TEAM_SUBPROTOCOL_PREFIX}${encodeSubprotocolValue(options.teamIdOrSlug)}`);
  }
  return protocols;
}
function encodeSubprotocolValue(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}
var z = {
  any,
  array,
  boolean: boolean2,
  discriminatedUnion,
  enum: _enum,
  literal,
  number: number2,
  object,
  record,
  string: string2,
  union,
  unknown
};
var marker17 = "vercel.ai.gateway.error";
var symbol19 = Symbol.for(marker17);
var _a21;
var _b19;
var GatewayError = class _GatewayError extends (_b19 = Error, _a21 = symbol19, _b19) {
  constructor({
    message,
    statusCode = 500,
    cause,
    generationId,
    isRetryable = statusCode != null && (statusCode === 408 || statusCode === 409 || statusCode === 429 || statusCode >= 500)
  }) {
    super(generationId ? `${message} [${generationId}]` : message);
    this[_a21] = true;
    this.statusCode = statusCode;
    this.cause = cause;
    this.generationId = generationId;
    this.isRetryable = isRetryable;
  }
  static isInstance(error) {
    return _GatewayError.hasMarker(error);
  }
  static hasMarker(error) {
    return typeof error === "object" && error !== null && symbol19 in error && error[symbol19] === true;
  }
};
var name18 = "GatewayAuthenticationError";
var marker23 = `vercel.ai.gateway.error.${name18}`;
var symbol23 = Symbol.for(marker23);
var _a23;
var _b23;
var GatewayAuthenticationError = class _GatewayAuthenticationError extends (_b23 = GatewayError, _a23 = symbol23, _b23) {
  constructor({
    message = "Authentication failed",
    statusCode = 401,
    cause,
    generationId
  } = {}) {
    super({ message, statusCode, cause, generationId });
    this[_a23] = true;
    this.name = name18;
    this.type = "authentication_error";
  }
  static isInstance(error) {
    return GatewayError.hasMarker(error) && symbol23 in error;
  }
  static createContextualError({
    apiKeyProvided,
    oidcTokenProvided,
    statusCode = 401,
    cause,
    generationId
  }) {
    let contextualMessage;
    if (apiKeyProvided) {
      contextualMessage = `AI Gateway authentication failed: Invalid API key or token.

Create a new API key: https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%2Fapi-keys

Provide an API key or Vercel access token via 'apiKey' option or 'AI_GATEWAY_API_KEY' environment variable.`;
    } else if (oidcTokenProvided) {
      contextualMessage = `AI Gateway authentication failed: Invalid OIDC token.

Run 'npx vercel link' to link your project, then 'vc env pull' to fetch the token.

Alternatively, use an API key: https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%2Fapi-keys
or pass a Vercel access token via the 'apiKey' option.`;
    } else {
      contextualMessage = `AI Gateway authentication failed: No authentication provided.

Option 1 - API key:
Create an API key: https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%2Fapi-keys
Provide via 'apiKey' option or 'AI_GATEWAY_API_KEY' environment variable.

Option 2 - Vercel access token:
Pass a Vercel personal access token or Vercel app access token via the 'apiKey' option.

Option 3 - OIDC token:
Run 'npx vercel link' to link your project, then 'vc env pull' to fetch the token.`;
    }
    return new _GatewayAuthenticationError({
      message: contextualMessage,
      statusCode,
      cause,
      generationId
    });
  }
};
var name23 = "GatewayInvalidRequestError";
var marker33 = `vercel.ai.gateway.error.${name23}`;
var symbol32 = Symbol.for(marker33);
var _a32;
var _b32;
var GatewayInvalidRequestError = class extends (_b32 = GatewayError, _a32 = symbol32, _b32) {
  constructor({
    message = "Invalid request",
    statusCode = 400,
    cause,
    generationId
  } = {}) {
    super({ message, statusCode, cause, generationId });
    this[_a32] = true;
    this.name = name23;
    this.type = "invalid_request_error";
  }
  static isInstance(error) {
    return GatewayError.hasMarker(error) && symbol32 in error;
  }
};
var name32 = "GatewayRateLimitError";
var marker42 = `vercel.ai.gateway.error.${name32}`;
var symbol42 = Symbol.for(marker42);
var _a42;
var _b42;
var GatewayRateLimitError = class extends (_b42 = GatewayError, _a42 = symbol42, _b42) {
  constructor({
    message = "Rate limit exceeded",
    statusCode = 429,
    cause,
    generationId
  } = {}) {
    super({ message, statusCode, cause, generationId });
    this[_a42] = true;
    this.name = name32;
    this.type = "rate_limit_exceeded";
  }
  static isInstance(error) {
    return GatewayError.hasMarker(error) && symbol42 in error;
  }
};
var name42 = "GatewayModelNotFoundError";
var marker52 = `vercel.ai.gateway.error.${name42}`;
var symbol52 = Symbol.for(marker52);
var modelNotFoundParamSchema = lazySchema(() => zodSchema(z.object({
  modelId: z.string()
})));
var _a52;
var _b52;
var GatewayModelNotFoundError = class extends (_b52 = GatewayError, _a52 = symbol52, _b52) {
  constructor({
    message = "Model not found",
    statusCode = 404,
    modelId,
    cause,
    generationId
  } = {}) {
    super({ message, statusCode, cause, generationId });
    this[_a52] = true;
    this.name = name42;
    this.type = "model_not_found";
    this.modelId = modelId;
  }
  static isInstance(error) {
    return GatewayError.hasMarker(error) && symbol52 in error;
  }
};
var name52 = "GatewayNotFoundError";
var marker62 = `vercel.ai.gateway.error.${name52}`;
var symbol62 = Symbol.for(marker62);
var _a62;
var _b62;
var GatewayNotFoundError = class extends (_b62 = GatewayError, _a62 = symbol62, _b62) {
  constructor({
    message = "Resource not found",
    statusCode = 404,
    cause,
    generationId
  } = {}) {
    super({ message, statusCode, cause, generationId });
    this[_a62] = true;
    this.name = name52;
    this.type = "not_found";
  }
  static isInstance(error) {
    return GatewayError.hasMarker(error) && symbol62 in error;
  }
};
var name62 = "GatewayInternalServerError";
var marker72 = `vercel.ai.gateway.error.${name62}`;
var symbol72 = Symbol.for(marker72);
var _a72;
var _b72;
var GatewayInternalServerError = class extends (_b72 = GatewayError, _a72 = symbol72, _b72) {
  constructor({
    message = "Internal server error",
    statusCode = 500,
    cause,
    generationId
  } = {}) {
    super({ message, statusCode, cause, generationId });
    this[_a72] = true;
    this.name = name62;
    this.type = "internal_server_error";
  }
  static isInstance(error) {
    return GatewayError.hasMarker(error) && symbol72 in error;
  }
};
var name72 = "GatewayFailedDependencyError";
var marker82 = `vercel.ai.gateway.error.${name72}`;
var symbol82 = Symbol.for(marker82);
var _a82;
var _b82;
var GatewayFailedDependencyError = class extends (_b82 = GatewayError, _a82 = symbol82, _b82) {
  constructor({
    message = "Failed dependency",
    statusCode = 424,
    cause,
    generationId
  } = {}) {
    super({ message, statusCode, cause, generationId });
    this[_a82] = true;
    this.name = name72;
    this.type = "failed_dependency";
  }
  static isInstance(error) {
    return GatewayError.hasMarker(error) && symbol82 in error;
  }
};
var name82 = "GatewayForbiddenError";
var marker92 = `vercel.ai.gateway.error.${name82}`;
var symbol92 = Symbol.for(marker92);
var forbiddenParamSchema = lazySchema(() => zodSchema(z.object({
  ruleId: z.string()
})));
var _a92;
var _b92;
var GatewayForbiddenError = class extends (_b92 = GatewayError, _a92 = symbol92, _b92) {
  constructor({
    message = "Forbidden",
    statusCode = 403,
    cause,
    generationId,
    ruleId
  } = {}) {
    super({ message, statusCode, cause, generationId });
    this[_a92] = true;
    this.name = name82;
    this.type = "forbidden";
    this.ruleId = ruleId;
  }
  static isInstance(error) {
    return GatewayError.hasMarker(error) && symbol92 in error;
  }
};
var name92 = "GatewayResponseError";
var marker102 = `vercel.ai.gateway.error.${name92}`;
var symbol102 = Symbol.for(marker102);
var _a102;
var _b102;
var GatewayResponseError = class extends (_b102 = GatewayError, _a102 = symbol102, _b102) {
  constructor({
    message = "Invalid response from Gateway",
    statusCode = 502,
    response,
    validationError,
    cause,
    generationId,
    isRetryable
  } = {}) {
    super({ message, statusCode, cause, generationId, isRetryable });
    this[_a102] = true;
    this.name = name92;
    this.type = "response_error";
    this.response = response;
    this.validationError = validationError;
  }
  static isInstance(error) {
    return GatewayError.hasMarker(error) && symbol102 in error;
  }
};
async function createGatewayErrorFromResponse({
  response,
  statusCode,
  defaultMessage = "Gateway request failed",
  cause,
  authMethod,
  isRetryable
}) {
  var _a122;
  const parseResult = await safeValidateTypes({
    value: response,
    schema: gatewayErrorResponseSchema
  });
  if (!parseResult.success) {
    const rawGenerationId = typeof response === "object" && response !== null && "generationId" in response ? response.generationId : undefined;
    return new GatewayResponseError({
      message: `Invalid error response format: ${defaultMessage}`,
      statusCode,
      response,
      validationError: parseResult.error,
      cause,
      generationId: rawGenerationId,
      isRetryable
    });
  }
  const validatedResponse = parseResult.value;
  const errorType = validatedResponse.error.type;
  const message = validatedResponse.error.message;
  const generationId = (_a122 = validatedResponse.generationId) != null ? _a122 : undefined;
  switch (errorType) {
    case "authentication_error":
      return GatewayAuthenticationError.createContextualError({
        apiKeyProvided: authMethod === "api-key",
        oidcTokenProvided: authMethod === "oidc",
        statusCode,
        cause,
        generationId
      });
    case "invalid_request_error":
      return new GatewayInvalidRequestError({
        message,
        statusCode,
        cause,
        generationId
      });
    case "rate_limit_exceeded":
      return new GatewayRateLimitError({
        message,
        statusCode,
        cause,
        generationId
      });
    case "model_not_found": {
      const modelResult = await safeValidateTypes({
        value: validatedResponse.error.param,
        schema: modelNotFoundParamSchema
      });
      return new GatewayModelNotFoundError({
        message,
        statusCode,
        modelId: modelResult.success ? modelResult.value.modelId : undefined,
        cause,
        generationId
      });
    }
    case "not_found":
      return new GatewayNotFoundError({
        message,
        statusCode,
        cause,
        generationId
      });
    case "internal_server_error":
      return new GatewayInternalServerError({
        message,
        statusCode,
        cause,
        generationId
      });
    case "failed_dependency":
      return new GatewayFailedDependencyError({
        message,
        statusCode,
        cause,
        generationId
      });
    case "forbidden": {
      const ruleResult = await safeValidateTypes({
        value: validatedResponse.error.param,
        schema: forbiddenParamSchema
      });
      return new GatewayForbiddenError({
        message,
        statusCode,
        cause,
        generationId,
        ruleId: ruleResult.success ? ruleResult.value.ruleId : undefined
      });
    }
    default:
      return new GatewayInternalServerError({
        message,
        statusCode,
        cause,
        generationId
      });
  }
}
var gatewayErrorResponseSchema = lazySchema(() => zodSchema(z.object({
  error: z.object({
    message: z.string(),
    type: z.string().nullish(),
    param: z.unknown().nullish(),
    code: z.union([z.string(), z.number()]).nullish()
  }),
  generationId: z.string().nullish()
})));
function extractApiCallResponse(error) {
  if (error.data !== undefined) {
    return error.data;
  }
  if (error.responseBody != null) {
    try {
      return secureJsonParse(error.responseBody);
    } catch (e) {
      return error.responseBody;
    }
  }
  return {};
}
var name102 = "GatewayTimeoutError";
var marker112 = `vercel.ai.gateway.error.${name102}`;
var symbol112 = Symbol.for(marker112);
var _a112;
var _b112;
var GatewayTimeoutError = class _GatewayTimeoutError extends (_b112 = GatewayError, _a112 = symbol112, _b112) {
  constructor({
    message = "Request timed out",
    statusCode = 408,
    cause,
    generationId
  } = {}) {
    super({ message, statusCode, cause, generationId });
    this[_a112] = true;
    this.name = name102;
    this.type = "timeout_error";
  }
  static isInstance(error) {
    return GatewayError.hasMarker(error) && symbol112 in error;
  }
  static createTimeoutError({
    originalMessage,
    statusCode = 408,
    cause,
    generationId
  }) {
    const message = `Gateway request timed out: ${originalMessage}

    This is a client-side timeout. To resolve this, increase your timeout configuration: https://vercel.com/docs/ai-gateway/capabilities/video-generation#extending-timeouts-for-node.js`;
    return new _GatewayTimeoutError({
      message,
      statusCode,
      cause,
      generationId
    });
  }
};
function isTimeoutError(error) {
  if (!(error instanceof Error)) {
    return false;
  }
  const errorCode = error.code;
  if (typeof errorCode === "string") {
    const undiciTimeoutCodes = [
      "UND_ERR_HEADERS_TIMEOUT",
      "UND_ERR_BODY_TIMEOUT",
      "UND_ERR_CONNECT_TIMEOUT"
    ];
    return undiciTimeoutCodes.includes(errorCode);
  }
  return false;
}
async function asGatewayError(error, authMethod) {
  var _a122;
  if (GatewayError.isInstance(error)) {
    return error;
  }
  if (isTimeoutError(error)) {
    return GatewayTimeoutError.createTimeoutError({
      originalMessage: error instanceof Error ? error.message : "Unknown error",
      cause: error
    });
  }
  if (APICallError.isInstance(error)) {
    if (error.cause && isTimeoutError(error.cause)) {
      return GatewayTimeoutError.createTimeoutError({
        originalMessage: error.message,
        cause: error
      });
    }
    return await createGatewayErrorFromResponse({
      response: extractApiCallResponse(error),
      statusCode: (_a122 = error.statusCode) != null ? _a122 : 500,
      defaultMessage: "Gateway request failed",
      cause: error,
      authMethod,
      isRetryable: error.isRetryable && (error.statusCode == null || error.statusCode < 400) ? true : undefined
    });
  }
  return await createGatewayErrorFromResponse({
    response: {},
    statusCode: 500,
    defaultMessage: error instanceof Error ? `Gateway request failed: ${error.message}` : "Unknown Gateway error",
    cause: error,
    authMethod
  });
}
var GATEWAY_AUTH_METHOD_HEADER = "ai-gateway-auth-method";
var VERCEL_AI_GATEWAY_TEAM_HEADER = "x-vercel-ai-gateway-team";
async function parseAuthMethod(headers) {
  const result = await safeValidateTypes({
    value: headers[GATEWAY_AUTH_METHOD_HEADER],
    schema: gatewayAuthMethodSchema
  });
  return result.success ? result.value : undefined;
}
var gatewayAuthMethodSchema = lazySchema(() => zodSchema(z.union([z.literal("api-key"), z.literal("oidc")])));
var KNOWN_MODEL_TYPES = [
  "embedding",
  "evaluation",
  "image",
  "language",
  "realtime",
  "reranking",
  "speech",
  "transcription",
  "video"
];
var GatewayFetchMetadata = class {
  constructor(config2) {
    this.config = config2;
  }
  async getAvailableModels() {
    try {
      const { value } = await getFromApi({
        url: `${this.config.baseURL}/config`,
        validateUrl: false,
        headers: this.config.headers ? await resolve(this.config.headers) : undefined,
        successfulResponseHandler: createJsonResponseHandler(gatewayAvailableModelsResponseSchema),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: (data) => {
            var _a122;
            return (_a122 = getErrorMessage(data)) != null ? _a122 : "unknown error";
          }
        }),
        fetch: this.config.fetch
      });
      return value;
    } catch (error) {
      throw await asGatewayError(error);
    }
  }
  async getCredits() {
    try {
      const baseUrl = new URL(this.config.baseURL);
      const { value } = await getFromApi({
        url: `${baseUrl.origin}/v1/credits`,
        validateUrl: false,
        headers: this.config.headers ? await resolve(this.config.headers) : undefined,
        successfulResponseHandler: createJsonResponseHandler(gatewayCreditsResponseSchema),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: (data) => {
            var _a122;
            return (_a122 = getErrorMessage(data)) != null ? _a122 : "unknown error";
          }
        }),
        fetch: this.config.fetch
      });
      return value;
    } catch (error) {
      throw await asGatewayError(error);
    }
  }
};
var gatewayAvailableModelsResponseSchema = lazySchema(() => zodSchema(z.object({
  models: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullish(),
    pricing: z.object({
      input: z.string(),
      output: z.string(),
      input_cache_read: z.string().nullish(),
      input_cache_write: z.string().nullish()
    }).transform(({ input, output, input_cache_read, input_cache_write }) => ({
      input,
      output,
      ...input_cache_read ? { cachedInputTokens: input_cache_read } : {},
      ...input_cache_write ? { cacheCreationInputTokens: input_cache_write } : {}
    })).nullish(),
    specification: z.object({
      specificationVersion: z.literal("v4"),
      provider: z.string(),
      modelId: z.string()
    }),
    modelType: z.string().nullish()
  })).transform((models) => models.filter((m) => m.modelType == null || KNOWN_MODEL_TYPES.includes(m.modelType)))
})));
var gatewayCreditsResponseSchema = lazySchema(() => zodSchema(z.object({
  balance: z.string(),
  total_used: z.string()
}).transform(({ balance, total_used }) => ({
  balance,
  totalUsed: total_used
}))));
var GatewaySpendReport = class {
  constructor(config2) {
    this.config = config2;
  }
  async getSpendReport(params) {
    try {
      const baseUrl = new URL(this.config.baseURL);
      const searchParams = new URLSearchParams;
      searchParams.set("start_date", params.startDate);
      searchParams.set("end_date", params.endDate);
      if (params.groupBy) {
        searchParams.set("group_by", params.groupBy);
      }
      if (params.datePart) {
        searchParams.set("date_part", params.datePart);
      }
      if (params.userId) {
        searchParams.set("user_id", params.userId);
      }
      if (params.model) {
        searchParams.set("model", params.model);
      }
      if (params.provider) {
        searchParams.set("provider", params.provider);
      }
      if (params.credentialType) {
        searchParams.set("credential_type", params.credentialType);
      }
      if (params.tags && params.tags.length > 0) {
        searchParams.set("tags", params.tags.join(","));
      }
      const { value } = await getFromApi({
        url: `${baseUrl.origin}/v1/report?${searchParams.toString()}`,
        validateUrl: false,
        headers: this.config.headers ? await resolve(this.config.headers) : undefined,
        successfulResponseHandler: createJsonResponseHandler(gatewaySpendReportResponseSchema),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: (data) => {
            var _a122;
            return (_a122 = getErrorMessage(data)) != null ? _a122 : "unknown error";
          }
        }),
        fetch: this.config.fetch
      });
      return value;
    } catch (error) {
      throw await asGatewayError(error);
    }
  }
};
var gatewaySpendReportResponseSchema = lazySchema(() => zodSchema(z.object({
  results: z.array(z.object({
    day: z.string().optional(),
    hour: z.string().optional(),
    user: z.string().optional(),
    model: z.string().optional(),
    tag: z.string().optional(),
    provider: z.string().optional(),
    credential_type: z.enum(["byok", "system"]).optional(),
    total_cost: z.number(),
    market_cost: z.number().optional(),
    input_tokens: z.number().optional(),
    output_tokens: z.number().optional(),
    cached_input_tokens: z.number().optional(),
    cache_creation_input_tokens: z.number().optional(),
    reasoning_tokens: z.number().optional(),
    request_count: z.number().optional()
  }).transform(({
    credential_type,
    total_cost,
    market_cost,
    input_tokens,
    output_tokens,
    cached_input_tokens,
    cache_creation_input_tokens,
    reasoning_tokens,
    request_count,
    ...rest
  }) => ({
    ...rest,
    ...credential_type !== undefined ? { credentialType: credential_type } : {},
    totalCost: total_cost,
    ...market_cost !== undefined ? { marketCost: market_cost } : {},
    ...input_tokens !== undefined ? { inputTokens: input_tokens } : {},
    ...output_tokens !== undefined ? { outputTokens: output_tokens } : {},
    ...cached_input_tokens !== undefined ? { cachedInputTokens: cached_input_tokens } : {},
    ...cache_creation_input_tokens !== undefined ? { cacheCreationInputTokens: cache_creation_input_tokens } : {},
    ...reasoning_tokens !== undefined ? { reasoningTokens: reasoning_tokens } : {},
    ...request_count !== undefined ? { requestCount: request_count } : {}
  })))
})));
var GatewayGenerationInfoFetcher = class {
  constructor(config2) {
    this.config = config2;
  }
  async getGenerationInfo(params) {
    try {
      const baseUrl = new URL(this.config.baseURL);
      const { value } = await getFromApi({
        url: `${baseUrl.origin}/v1/generation?id=${encodeURIComponent(params.id)}`,
        validateUrl: false,
        headers: this.config.headers ? await resolve(this.config.headers) : undefined,
        successfulResponseHandler: createJsonResponseHandler(gatewayGenerationInfoResponseSchema),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: (data) => {
            var _a122;
            return (_a122 = getErrorMessage(data)) != null ? _a122 : "unknown error";
          }
        }),
        fetch: this.config.fetch
      });
      return value;
    } catch (error) {
      throw await asGatewayError(error);
    }
  }
};
var gatewayGenerationInfoResponseSchema = lazySchema(() => zodSchema(z.object({
  data: z.object({
    id: z.string(),
    total_cost: z.number(),
    upstream_inference_cost: z.number(),
    usage: z.number(),
    created_at: z.string(),
    model: z.string(),
    is_byok: z.boolean(),
    provider_name: z.string(),
    streamed: z.boolean(),
    finish_reason: z.string(),
    latency: z.number(),
    generation_time: z.number(),
    native_tokens_prompt: z.number(),
    native_tokens_completion: z.number(),
    native_tokens_reasoning: z.number(),
    native_tokens_cached: z.number(),
    native_tokens_cache_creation: z.number(),
    billable_web_search_calls: z.number()
  }).transform(({
    total_cost,
    upstream_inference_cost,
    created_at,
    is_byok,
    provider_name,
    finish_reason,
    generation_time,
    native_tokens_prompt,
    native_tokens_completion,
    native_tokens_reasoning,
    native_tokens_cached,
    native_tokens_cache_creation,
    billable_web_search_calls,
    ...rest
  }) => ({
    ...rest,
    totalCost: total_cost,
    upstreamInferenceCost: upstream_inference_cost,
    createdAt: created_at,
    isByok: is_byok,
    providerName: provider_name,
    finishReason: finish_reason,
    generationTime: generation_time,
    promptTokens: native_tokens_prompt,
    completionTokens: native_tokens_completion,
    reasoningTokens: native_tokens_reasoning,
    cachedTokens: native_tokens_cached,
    cacheCreationTokens: native_tokens_cache_creation,
    billableWebSearchCalls: billable_web_search_calls
  }))
}).transform(({ data }) => data)));
var GatewayBatch = class {
  constructor(config2) {
    this.config = config2;
    this.specificationVersion = "v4";
    this.supportedUrls = { "*/*": [/.*/] };
    this.provider = `${config2.provider}.batch`;
  }
  async doStartBatch({
    requests,
    providerOptions,
    headers,
    abortSignal,
    webhookUrl
  }) {
    var _a122;
    assertTextBatchRequests(requests);
    const modelId = validateSingleModel(requests);
    const resolvedHeaders = this.config.headers ? await resolve(this.config.headers) : undefined;
    const idempotencyKey = getGatewayBatchIdempotencyKey(providerOptions);
    const forwardedProviderOptions = omitGatewayIdempotencyKey(providerOptions);
    try {
      const { value: responseBody } = await postJsonToApi({
        url: this.getBatchUrl("start"),
        headers: combineHeaders(resolvedHeaders, headers, { "ai-model-id": modelId }, await resolve(this.config.o11yHeaders), idempotencyKey != null ? { "idempotency-key": idempotencyKey } : undefined),
        body: {
          ...webhookUrl != null && { callbackUrl: webhookUrl },
          requests: requests.map((request) => ({
            id: request.id,
            type: request.type,
            modelId: request.modelId,
            options: maybeEncodeBatchFileParts(request.options)
          })),
          ...forwardedProviderOptions != null && {
            providerOptions: forwardedProviderOptions
          }
        },
        successfulResponseHandler: createJsonResponseHandler(gatewayBatchStartResponseSchema),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: (data) => {
            var _a132;
            return (_a132 = getErrorMessage(data)) != null ? _a132 : "unknown error";
          }
        }),
        ...abortSignal && { abortSignal },
        fetch: this.config.fetch
      });
      return {
        batchId: responseBody.batchId,
        ...convertGatewayBatchStatus(responseBody),
        warnings: (_a122 = responseBody.warnings) != null ? _a122 : []
      };
    } catch (error) {
      if (isAbortOrTimeoutError(error)) {
        throw error;
      }
      throw await asGatewayError(error, await parseAuthMethod(resolvedHeaders != null ? resolvedHeaders : {}));
    }
  }
  async doGetBatchStatus({
    batchId,
    headers,
    abortSignal
  }) {
    const resolvedHeaders = this.config.headers ? await resolve(this.config.headers) : undefined;
    try {
      const { value: responseBody } = await postJsonToApi({
        url: this.getBatchUrl("status"),
        headers: combineHeaders(resolvedHeaders, headers, await resolve(this.config.o11yHeaders)),
        body: { batchId },
        successfulResponseHandler: createJsonResponseHandler(gatewayBatchStatusResponseSchema),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: (data) => {
            var _a122;
            return (_a122 = getErrorMessage(data)) != null ? _a122 : "unknown error";
          }
        }),
        ...abortSignal && { abortSignal },
        fetch: this.config.fetch
      });
      return convertGatewayBatchStatus(responseBody);
    } catch (error) {
      if (isAbortOrTimeoutError(error)) {
        throw error;
      }
      throw await asGatewayError(error, await parseAuthMethod(resolvedHeaders != null ? resolvedHeaders : {}));
    }
  }
  async doGetBatchResults({
    batchId,
    headers,
    abortSignal
  }) {
    const resolvedHeaders = this.config.headers ? await resolve(this.config.headers) : undefined;
    try {
      const { value: lines } = await postJsonToApi({
        url: this.getBatchUrl("results"),
        headers: combineHeaders(resolvedHeaders, headers, await resolve(this.config.o11yHeaders)),
        body: { batchId },
        successfulResponseHandler: createJsonLinesResponseHandler(gatewayBatchItemResultLineSchema),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: (data) => {
            var _a122;
            return (_a122 = getErrorMessage(data)) != null ? _a122 : "unknown error";
          }
        }),
        ...abortSignal && { abortSignal },
        fetch: this.config.fetch
      });
      return convertAsyncIteratorToReadableStream(convertGatewayBatchResultLines(lines));
    } catch (error) {
      if (isAbortOrTimeoutError(error)) {
        throw error;
      }
      throw await asGatewayError(error, await parseAuthMethod(resolvedHeaders != null ? resolvedHeaders : {}));
    }
  }
  getBatchUrl(path) {
    return `${this.config.baseURL}/batch/${path}`;
  }
};
function maybeEncodeBatchFileParts(options) {
  for (const message of options.prompt) {
    if (!Array.isArray(message.content)) {
      continue;
    }
    for (const part of message.content) {
      if (part.type === "file" || part.type === "reasoning-file") {
        part.data = maybeBase64EncodeFileData(part.data);
      } else if (part.type === "tool-result" && part.output.type === "content") {
        for (const contentPart of part.output.value) {
          if (contentPart.type === "file") {
            contentPart.data = maybeBase64EncodeFileData(contentPart.data);
          }
        }
      }
    }
  }
  return options;
}
function maybeBase64EncodeFileData(data) {
  if (data.type === "data") {
    const bytes = data.data;
    if (bytes instanceof Uint8Array) {
      return { ...data, data: Buffer.from(bytes).toString("base64") };
    }
  }
  return data;
}
function validateSingleModel(requests) {
  var _a122;
  const modelId = (_a122 = requests[0]) == null ? undefined : _a122.modelId;
  if (modelId == null) {
    throw new InvalidArgumentError({
      argument: "requests",
      message: "The AI Gateway Batch API requires at least one request."
    });
  }
  for (const request of requests) {
    if (request.modelId !== modelId) {
      throw new InvalidArgumentError({
        argument: "requests",
        message: `The AI Gateway Batch API requires all requests in a batch to use the same model. Found "${modelId}" and "${request.modelId}".`
      });
    }
  }
  return modelId;
}
function assertTextBatchRequests(requests) {
  for (const request of requests) {
    const requestType = request.type;
    if (requestType !== "text") {
      throw new UnsupportedFunctionalityError({
        functionality: `batch request type: ${requestType}`,
        message: `The AI Gateway Batch API does not support batch requests with type "${requestType}".`
      });
    }
  }
}
function getGatewayBatchIdempotencyKey(providerOptions) {
  const gatewayOptions = providerOptions == null ? undefined : providerOptions.gateway;
  if (gatewayOptions == null || typeof gatewayOptions !== "object" || Array.isArray(gatewayOptions)) {
    return;
  }
  const key = gatewayOptions.idempotencyKey;
  return typeof key === "string" && key.length > 0 ? key : undefined;
}
function omitGatewayIdempotencyKey(providerOptions) {
  const gatewayOptions = providerOptions == null ? undefined : providerOptions.gateway;
  if (gatewayOptions == null || typeof gatewayOptions !== "object" || Array.isArray(gatewayOptions) || !("idempotencyKey" in gatewayOptions)) {
    return providerOptions;
  }
  const { idempotencyKey: _idempotencyKey, ...restGatewayOptions } = gatewayOptions;
  const restProviderOptions = { ...providerOptions };
  if (Object.keys(restGatewayOptions).length === 0) {
    delete restProviderOptions.gateway;
  } else {
    restProviderOptions.gateway = restGatewayOptions;
  }
  if (Object.keys(restProviderOptions).length === 0) {
    return;
  }
  return restProviderOptions;
}
function isAbortOrTimeoutError(error) {
  if (!(error instanceof Error || error instanceof DOMException)) {
    return false;
  }
  return error.name === "AbortError" || error.name === "TimeoutError";
}
function convertGatewayBatchStatus(body) {
  var _a122, _b122, _c, _d;
  const requestCounts = normalizeBatchRequestCounts({
    total: (_a122 = body.requestCounts) == null ? undefined : _a122.total,
    pending: (_b122 = body.requestCounts) == null ? undefined : _b122.pending,
    completed: (_c = body.requestCounts) == null ? undefined : _c.completed,
    failed: (_d = body.requestCounts) == null ? undefined : _d.failed
  });
  return {
    status: body.status,
    ...body.rawStatus != null && { rawStatus: body.rawStatus },
    ...requestCounts != null && { requestCounts },
    ...body.error != null && {
      error: {
        message: body.error.message,
        ...body.error.type != null && { type: body.error.type },
        ...body.error.code != null && { code: body.error.code },
        ...body.error.statusCode != null && {
          statusCode: body.error.statusCode
        }
      }
    },
    ...body.createdAt != null && { createdAt: body.createdAt },
    ...body.expiresAt != null && { expiresAt: body.expiresAt },
    ...body.providerMetadata != null && {
      providerMetadata: body.providerMetadata
    }
  };
}
async function* convertGatewayBatchResultLines(lines) {
  var _a122;
  for await (const line of lines) {
    const item = line;
    if (item.status === "succeeded") {
      const response = (_a122 = item.result) == null ? undefined : _a122.response;
      if (response !== undefined && typeof response.timestamp === "string") {
        response.timestamp = new Date(response.timestamp);
      }
    }
    yield item;
  }
}
var gatewayBatchItemResultLineSchema = z.object({
  type: z.literal("text"),
  id: z.string(),
  status: z.enum(["cancelled", "expired", "failed", "succeeded"])
}).catchall(z.unknown());
var gatewayBatchErrorSchema = z.object({
  message: z.string(),
  type: z.string().nullish(),
  code: z.string().nullish(),
  statusCode: z.number().nullish()
});
var gatewayBatchRequestCountsSchema = z.object({
  total: z.number().nullish(),
  pending: z.number().nullish(),
  completed: z.number().nullish(),
  failed: z.number().nullish()
});
var gatewayBatchProviderMetadataSchema = z.record(z.string(), z.record(z.string(), z.unknown()));
var gatewayBatchStatusFieldsSchema = z.object({
  status: z.enum(["completed", "failed", "pending"]),
  rawStatus: z.string().nullish(),
  requestCounts: gatewayBatchRequestCountsSchema.nullish(),
  error: gatewayBatchErrorSchema.nullish(),
  createdAt: z.string().nullish(),
  expiresAt: z.string().nullish(),
  providerMetadata: gatewayBatchProviderMetadataSchema.nullish()
});
var gatewayBatchStartResponseSchema = gatewayBatchStatusFieldsSchema.extend({
  batchId: z.string(),
  warnings: z.array(z.object({
    requestId: z.string().nullish(),
    warning: z.unknown()
  }).catchall(z.unknown())).nullish()
});
var gatewayBatchStatusResponseSchema = gatewayBatchStatusFieldsSchema;
var GatewayLanguageModel = class _GatewayLanguageModel {
  constructor(modelId, config2) {
    this.modelId = modelId;
    this.config = config2;
    this.specificationVersion = "v4";
    this.supportedUrls = { "*/*": [/.*/] };
  }
  static [WORKFLOW_SERIALIZE](model) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config
    });
  }
  static [WORKFLOW_DESERIALIZE](options) {
    return new _GatewayLanguageModel(options.modelId, options.config);
  }
  get provider() {
    return this.config.provider;
  }
  async getArgs(options) {
    const { abortSignal: _abortSignal, ...optionsWithoutSignal } = options;
    return {
      args: this.maybeEncodeFileParts(optionsWithoutSignal),
      warnings: []
    };
  }
  async doGenerate(options) {
    var _a122;
    const { args, warnings } = await this.getArgs(options);
    const { abortSignal } = options;
    const resolvedHeaders = this.config.headers ? await resolve(this.config.headers) : undefined;
    try {
      const {
        responseHeaders,
        value: responseBody,
        rawValue: rawResponse
      } = await postJsonToApi({
        url: this.getUrl(),
        headers: combineHeaders(resolvedHeaders, options.headers, this.getModelConfigHeaders(this.modelId, false), await resolve(this.config.o11yHeaders)),
        body: args,
        successfulResponseHandler: createJsonResponseHandler(z.any()),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: (data) => {
            var _a132;
            return (_a132 = getErrorMessage(data)) != null ? _a132 : "unknown error";
          }
        }),
        ...abortSignal && { abortSignal },
        fetch: this.config.fetch
      });
      return {
        ...responseBody,
        request: { body: args },
        response: { headers: responseHeaders, body: rawResponse },
        warnings: [...(_a122 = responseBody.warnings) != null ? _a122 : [], ...warnings]
      };
    } catch (error) {
      throw await asGatewayError(error, await parseAuthMethod(resolvedHeaders != null ? resolvedHeaders : {}));
    }
  }
  async doStream(options) {
    const { args, warnings } = await this.getArgs(options);
    const { abortSignal } = options;
    const resolvedHeaders = this.config.headers ? await resolve(this.config.headers) : undefined;
    try {
      const { value: response, responseHeaders } = await postJsonToApi({
        url: this.getUrl(),
        headers: combineHeaders(resolvedHeaders, options.headers, this.getModelConfigHeaders(this.modelId, true), await resolve(this.config.o11yHeaders)),
        body: args,
        successfulResponseHandler: createEventSourceResponseHandler(z.any()),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: (data) => {
            var _a122;
            return (_a122 = getErrorMessage(data)) != null ? _a122 : "unknown error";
          }
        }),
        ...abortSignal && { abortSignal },
        fetch: this.config.fetch
      });
      return {
        stream: response.pipeThrough(new TransformStream({
          start(controller) {
            if (warnings.length > 0) {
              controller.enqueue({ type: "stream-start", warnings });
            }
          },
          transform(chunk, controller) {
            if (chunk.success) {
              const streamPart = chunk.value;
              if (streamPart.type === "raw" && !options.includeRawChunks) {
                return;
              }
              if (streamPart.type === "response-metadata" && streamPart.timestamp && typeof streamPart.timestamp === "string") {
                streamPart.timestamp = new Date(streamPart.timestamp);
              }
              controller.enqueue(streamPart);
            } else {
              controller.error(chunk.error);
            }
          }
        })),
        request: { body: args },
        response: { headers: responseHeaders }
      };
    } catch (error) {
      throw await asGatewayError(error, await parseAuthMethod(resolvedHeaders != null ? resolvedHeaders : {}));
    }
  }
  maybeEncodeFileParts(options) {
    for (const message of options.prompt) {
      if (!Array.isArray(message.content)) {
        continue;
      }
      for (const part of message.content) {
        if (part.type === "file" || part.type === "reasoning-file") {
          part.data = maybeBase64EncodeFileData2(part.data);
        } else if (part.type === "tool-result" && part.output.type === "content") {
          for (const contentPart of part.output.value) {
            if (contentPart.type === "file") {
              contentPart.data = maybeBase64EncodeFileData2(contentPart.data);
            }
          }
        }
      }
    }
    return options;
  }
  getUrl() {
    return `${this.config.baseURL}/language-model`;
  }
  getModelConfigHeaders(modelId, streaming) {
    return {
      "ai-language-model-specification-version": "4",
      "ai-language-model-id": modelId,
      "ai-language-model-streaming": String(streaming)
    };
  }
};
function maybeBase64EncodeFileData2(data) {
  if (data.type === "data") {
    const bytes = data.data;
    if (bytes instanceof Uint8Array) {
      return { ...data, data: Buffer.from(bytes).toString("base64") };
    }
  }
  return data;
}
var GatewayEmbeddingModel = class _GatewayEmbeddingModel {
  constructor(modelId, config2) {
    this.modelId = modelId;
    this.config = config2;
    this.specificationVersion = "v4";
    this.maxEmbeddingsPerCall = 2048;
    this.supportsParallelCalls = true;
  }
  static [WORKFLOW_SERIALIZE](model) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config
    });
  }
  static [WORKFLOW_DESERIALIZE](options) {
    return new _GatewayEmbeddingModel(options.modelId, options.config);
  }
  get provider() {
    return this.config.provider;
  }
  async doEmbed({
    values,
    headers,
    abortSignal,
    providerOptions
  }) {
    var _a122, _b122;
    const resolvedHeaders = this.config.headers ? await resolve(this.config.headers) : undefined;
    try {
      const {
        responseHeaders,
        value: responseBody,
        rawValue
      } = await postJsonToApi({
        url: this.getUrl(),
        headers: combineHeaders(resolvedHeaders, headers != null ? headers : {}, this.getModelConfigHeaders(), await resolve(this.config.o11yHeaders)),
        body: {
          values,
          ...providerOptions ? { providerOptions } : {}
        },
        successfulResponseHandler: createJsonResponseHandler(gatewayEmbeddingResponseSchema),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: (data) => {
            var _a132;
            return (_a132 = getErrorMessage(data)) != null ? _a132 : "unknown error";
          }
        }),
        ...abortSignal && { abortSignal },
        fetch: this.config.fetch
      });
      return {
        embeddings: responseBody.embeddings,
        usage: (_a122 = responseBody.usage) != null ? _a122 : undefined,
        providerMetadata: responseBody.providerMetadata,
        response: { headers: responseHeaders, body: rawValue },
        warnings: (_b122 = responseBody.warnings) != null ? _b122 : []
      };
    } catch (error) {
      throw await asGatewayError(error, await parseAuthMethod(resolvedHeaders != null ? resolvedHeaders : {}));
    }
  }
  getUrl() {
    return `${this.config.baseURL}/embedding-model`;
  }
  getModelConfigHeaders() {
    return {
      "ai-embedding-model-specification-version": "4",
      "ai-model-id": this.modelId
    };
  }
};
var gatewayEmbeddingWarningSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("unsupported"),
    feature: z.string(),
    details: z.string().optional()
  }),
  z.object({
    type: z.literal("compatibility"),
    feature: z.string(),
    details: z.string().optional()
  }),
  z.object({
    type: z.literal("deprecated"),
    setting: z.string(),
    message: z.string()
  }),
  z.object({
    type: z.literal("other"),
    message: z.string()
  })
]);
var gatewayEmbeddingResponseSchema = lazySchema(() => zodSchema(z.object({
  embeddings: z.array(z.array(z.number())),
  usage: z.object({ tokens: z.number() }).nullish(),
  warnings: z.array(gatewayEmbeddingWarningSchema).optional(),
  providerMetadata: z.record(z.string(), z.record(z.string(), z.unknown())).optional()
})));
var GatewayImageModel = class _GatewayImageModel {
  constructor(modelId, config2) {
    this.modelId = modelId;
    this.config = config2;
    this.specificationVersion = "v4";
    this.maxImagesPerCall = Number.MAX_SAFE_INTEGER;
  }
  static [WORKFLOW_SERIALIZE](model) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config
    });
  }
  static [WORKFLOW_DESERIALIZE](options) {
    return new _GatewayImageModel(options.modelId, options.config);
  }
  get provider() {
    return this.config.provider;
  }
  async doGenerate({
    prompt,
    n,
    size,
    aspectRatio,
    seed,
    files,
    mask,
    providerOptions,
    headers,
    abortSignal
  }) {
    var _a122, _b122, _c, _d;
    const resolvedHeaders = this.config.headers ? await resolve(this.config.headers) : undefined;
    try {
      const { responseHeaders, value: responseBody } = await postJsonToApi({
        url: this.getUrl(),
        headers: combineHeaders(resolvedHeaders, headers != null ? headers : {}, this.getModelConfigHeaders(), await resolve(this.config.o11yHeaders)),
        body: {
          prompt,
          n,
          ...size && { size },
          ...aspectRatio && { aspectRatio },
          ...seed && { seed },
          ...providerOptions && { providerOptions },
          ...files && {
            files: files.map((file) => maybeEncodeImageFile(file))
          },
          ...mask && { mask: maybeEncodeImageFile(mask) }
        },
        successfulResponseHandler: createJsonResponseHandler(gatewayImageResponseSchema),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: (data) => {
            var _a132;
            return (_a132 = getErrorMessage(data)) != null ? _a132 : "unknown error";
          }
        }),
        ...abortSignal && { abortSignal },
        fetch: this.config.fetch
      });
      return {
        images: responseBody.images,
        ...responseBody.isRetryable != null && {
          isRetryable: responseBody.isRetryable
        },
        warnings: (_a122 = responseBody.warnings) != null ? _a122 : [],
        providerMetadata: responseBody.providerMetadata,
        response: {
          timestamp: /* @__PURE__ */ new Date,
          modelId: this.modelId,
          headers: responseHeaders
        },
        ...responseBody.usage != null && {
          usage: {
            inputTokens: (_b122 = responseBody.usage.inputTokens) != null ? _b122 : undefined,
            outputTokens: (_c = responseBody.usage.outputTokens) != null ? _c : undefined,
            totalTokens: (_d = responseBody.usage.totalTokens) != null ? _d : undefined
          }
        }
      };
    } catch (error) {
      throw await asGatewayError(error, await parseAuthMethod(resolvedHeaders != null ? resolvedHeaders : {}));
    }
  }
  getUrl() {
    return `${this.config.baseURL}/image-model`;
  }
  getModelConfigHeaders() {
    return {
      "ai-image-model-specification-version": "4",
      "ai-model-id": this.modelId
    };
  }
};
function maybeEncodeImageFile(file) {
  if (file.type === "file" && file.data instanceof Uint8Array) {
    return {
      ...file,
      data: convertUint8ArrayToBase64(file.data)
    };
  }
  return file;
}
var providerMetadataEntrySchema = z.object({
  images: z.array(z.unknown()).optional()
}).catchall(z.unknown());
var gatewayImageWarningSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("unsupported"),
    feature: z.string(),
    details: z.string().optional()
  }),
  z.object({
    type: z.literal("compatibility"),
    feature: z.string(),
    details: z.string().optional()
  }),
  z.object({
    type: z.literal("deprecated"),
    setting: z.string(),
    message: z.string()
  }),
  z.object({
    type: z.literal("other"),
    message: z.string()
  })
]);
var gatewayImageUsageSchema = z.object({
  inputTokens: z.number().nullish(),
  outputTokens: z.number().nullish(),
  totalTokens: z.number().nullish()
});
var gatewayImageResponseSchema = z.object({
  images: z.array(z.string()),
  isRetryable: z.boolean().optional(),
  warnings: z.array(gatewayImageWarningSchema).optional(),
  providerMetadata: z.record(z.string(), providerMetadataEntrySchema).optional(),
  usage: gatewayImageUsageSchema.optional()
});
var GatewayVideoModel = class {
  constructor(modelId, config2) {
    this.modelId = modelId;
    this.config = config2;
    this.specificationVersion = "v4";
    this.maxVideosPerCall = Number.MAX_SAFE_INTEGER;
  }
  get provider() {
    return this.config.provider;
  }
  async doGenerate(options) {
    var _a122, _b122;
    const { headers, abortSignal } = options;
    const resolvedHeaders = this.config.headers ? await resolve(this.config.headers) : undefined;
    try {
      const { responseHeaders, value: responseBody } = await postJsonToApi({
        url: this.getUrl(),
        headers: combineHeaders(resolvedHeaders, headers != null ? headers : {}, this.getModelConfigHeaders(), await resolve(this.config.o11yHeaders), { accept: "text/event-stream" }),
        body: this.buildRequestBody(options),
        successfulResponseHandler: async ({
          response,
          url,
          requestBodyValues
        }) => {
          if (response.body == null) {
            throw new APICallError({
              message: "SSE response body is empty",
              url,
              requestBodyValues,
              statusCode: response.status
            });
          }
          const eventStream = parseJsonEventStream({
            stream: response.body,
            schema: gatewayVideoEventSchema
          });
          const reader = eventStream.getReader();
          const { done, value: parseResult } = await reader.read();
          reader.releaseLock();
          if (done || !parseResult) {
            throw new APICallError({
              message: "SSE stream ended without a data event",
              url,
              requestBodyValues,
              statusCode: response.status
            });
          }
          if (!parseResult.success) {
            throw new APICallError({
              message: "Failed to parse video SSE event",
              cause: parseResult.error,
              url,
              requestBodyValues,
              statusCode: response.status
            });
          }
          const event = parseResult.value;
          if (event.type === "error") {
            throw new APICallError({
              message: event.message,
              statusCode: event.statusCode,
              url,
              requestBodyValues,
              responseHeaders: Object.fromEntries([...response.headers]),
              responseBody: JSON.stringify(event),
              data: {
                error: {
                  message: event.message,
                  type: event.errorType,
                  param: event.param
                }
              }
            });
          }
          return {
            value: {
              videos: event.videos,
              warnings: event.warnings,
              providerMetadata: event.providerMetadata
            },
            responseHeaders: Object.fromEntries([...response.headers])
          };
        },
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: (data) => {
            var _a132;
            return (_a132 = getErrorMessage(data)) != null ? _a132 : "unknown error";
          }
        }),
        ...abortSignal && { abortSignal },
        fetch: this.config.fetch
      });
      return {
        videos: responseBody.videos,
        warnings: (_a122 = responseBody.warnings) != null ? _a122 : [],
        providerMetadata: (_b122 = responseBody.providerMetadata) != null ? _b122 : undefined,
        response: {
          timestamp: /* @__PURE__ */ new Date,
          modelId: this.modelId,
          headers: responseHeaders
        }
      };
    } catch (error) {
      throw await asGatewayError(error, await parseAuthMethod(resolvedHeaders != null ? resolvedHeaders : {}));
    }
  }
  async handleWebhookOption({
    webhook
  }) {
    const { url, received } = await webhook();
    return { webhookUrl: url, received };
  }
  async doStart(options) {
    var _a122, _b122;
    const { headers, abortSignal, webhookUrl } = options;
    const resolvedHeaders = this.config.headers ? await resolve(this.config.headers) : undefined;
    try {
      const { responseHeaders, value: responseBody } = await postJsonToApi({
        url: this.getStartUrl(),
        headers: combineHeaders(resolvedHeaders, headers != null ? headers : {}, this.getModelConfigHeaders(), await resolve(this.config.o11yHeaders)),
        body: {
          ...this.buildRequestBody(options),
          ...webhookUrl && { callbackUrl: webhookUrl }
        },
        successfulResponseHandler: createJsonResponseHandler(gatewayVideoStartResponseSchema),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: (data) => {
            var _a132;
            return (_a132 = getErrorMessage(data)) != null ? _a132 : "unknown error";
          }
        }),
        ...abortSignal && { abortSignal },
        fetch: this.config.fetch
      });
      return {
        operation: responseBody.operation,
        warnings: (_a122 = responseBody.warnings) != null ? _a122 : [],
        providerMetadata: (_b122 = responseBody.providerMetadata) != null ? _b122 : undefined,
        response: {
          timestamp: /* @__PURE__ */ new Date,
          modelId: this.modelId,
          headers: responseHeaders
        }
      };
    } catch (error) {
      throw await asGatewayError(error, await parseAuthMethod(resolvedHeaders != null ? resolvedHeaders : {}));
    }
  }
  async doStatus({
    operation,
    abortSignal,
    headers
  }) {
    var _a122, _b122, _c, _d, _e, _f;
    const resolvedHeaders = this.config.headers ? await resolve(this.config.headers) : undefined;
    try {
      const { responseHeaders, value: responseBody } = await postJsonToApi({
        url: this.getStatusUrl(),
        headers: combineHeaders(resolvedHeaders, headers != null ? headers : {}, this.getModelConfigHeaders(), await resolve(this.config.o11yHeaders)),
        body: { operation },
        successfulResponseHandler: createJsonResponseHandler(gatewayVideoStatusResponseSchema),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: (data) => {
            var _a132;
            return (_a132 = getErrorMessage(data)) != null ? _a132 : "unknown error";
          }
        }),
        ...abortSignal && { abortSignal },
        fetch: this.config.fetch
      });
      const response = {
        timestamp: /* @__PURE__ */ new Date,
        modelId: this.modelId,
        headers: responseHeaders
      };
      if (responseBody.status === "completed") {
        return {
          status: "completed",
          videos: responseBody.videos,
          warnings: (_a122 = responseBody.warnings) != null ? _a122 : [],
          providerMetadata: (_b122 = responseBody.providerMetadata) != null ? _b122 : undefined,
          response
        };
      }
      if (responseBody.status === "error") {
        return {
          status: "error",
          error: responseBody.error,
          providerMetadata: (_c = responseBody.providerMetadata) != null ? _c : undefined,
          response
        };
      }
      if (responseBody.status === "cancelled") {
        return {
          status: "error",
          error: "Video generation was cancelled.",
          providerMetadata: (_d = responseBody.providerMetadata) != null ? _d : undefined,
          response
        };
      }
      return {
        status: "pending",
        warnings: (_e = responseBody.warnings) != null ? _e : [],
        providerMetadata: (_f = responseBody.providerMetadata) != null ? _f : undefined,
        response
      };
    } catch (error) {
      throw await asGatewayError(error, await parseAuthMethod(resolvedHeaders != null ? resolvedHeaders : {}));
    }
  }
  buildRequestBody({
    prompt,
    n,
    aspectRatio,
    resolution,
    duration: duration3,
    fps,
    seed,
    generateAudio,
    image,
    frameImages,
    inputReferences,
    providerOptions
  }) {
    return {
      prompt,
      n,
      ...aspectRatio && { aspectRatio },
      ...resolution && { resolution },
      ...duration3 && { duration: duration3 },
      ...fps && { fps },
      ...seed && { seed },
      ...generateAudio !== undefined && { generateAudio },
      ...providerOptions && { providerOptions },
      ...image && { image: maybeEncodeVideoFile(image) },
      ...frameImages && {
        frameImages: frameImages.map((frame) => ({
          ...frame,
          image: maybeEncodeVideoFile(frame.image)
        }))
      },
      ...inputReferences && {
        inputReferences: inputReferences.map((reference) => maybeEncodeVideoFile(reference))
      }
    };
  }
  getUrl() {
    return `${this.config.baseURL}/video-model`;
  }
  getStartUrl() {
    return `${this.config.baseURL}/video-model/start`;
  }
  getStatusUrl() {
    return `${this.config.baseURL}/video-model/status`;
  }
  getModelConfigHeaders() {
    return {
      "ai-video-model-specification-version": "4",
      "ai-model-id": this.modelId
    };
  }
};
function maybeEncodeVideoFile(file) {
  if (file.type === "file" && file.data instanceof Uint8Array) {
    return {
      ...file,
      data: convertUint8ArrayToBase64(file.data)
    };
  }
  return file;
}
var providerMetadataEntrySchema2 = z.object({
  videos: z.array(z.unknown()).optional()
}).catchall(z.unknown());
var gatewayVideoDataSchema = z.union([
  z.object({
    type: z.literal("url"),
    url: z.string(),
    mediaType: z.string()
  }),
  z.object({
    type: z.literal("base64"),
    data: z.string(),
    mediaType: z.string()
  })
]);
var gatewayVideoWarningSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("unsupported"),
    feature: z.string(),
    details: z.string().optional()
  }),
  z.object({
    type: z.literal("compatibility"),
    feature: z.string(),
    details: z.string().optional()
  }),
  z.object({
    type: z.literal("deprecated"),
    setting: z.string(),
    message: z.string()
  }),
  z.object({
    type: z.literal("other"),
    message: z.string()
  })
]);
var gatewayVideoEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("result"),
    videos: z.array(gatewayVideoDataSchema),
    warnings: z.array(gatewayVideoWarningSchema).optional(),
    providerMetadata: z.record(z.string(), providerMetadataEntrySchema2).optional()
  }),
  z.object({
    type: z.literal("error"),
    message: z.string(),
    errorType: z.string(),
    statusCode: z.number(),
    param: z.unknown().nullable()
  })
]);
var gatewayVideoStartResponseSchema = z.object({
  operation: z.unknown(),
  warnings: z.array(gatewayVideoWarningSchema).nullish(),
  providerMetadata: z.record(z.string(), providerMetadataEntrySchema2).nullish()
});
var gatewayVideoStatusResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("pending"),
    warnings: z.array(gatewayVideoWarningSchema).nullish(),
    providerMetadata: z.record(z.string(), providerMetadataEntrySchema2).nullish()
  }),
  z.object({
    status: z.literal("completed"),
    videos: z.array(gatewayVideoDataSchema),
    warnings: z.array(gatewayVideoWarningSchema).nullish(),
    providerMetadata: z.record(z.string(), providerMetadataEntrySchema2).nullish()
  }),
  z.object({
    status: z.literal("error"),
    error: z.string(),
    providerMetadata: z.record(z.string(), providerMetadataEntrySchema2).nullish()
  }),
  z.object({
    status: z.literal("cancelled"),
    providerMetadata: z.record(z.string(), providerMetadataEntrySchema2).nullish()
  })
]);
var GatewayEvaluationModel = class {
  constructor(modelId, config2) {
    this.modelId = modelId;
    this.config = config2;
    this.specificationVersion = "v4";
    this.supportedQuestionTypes = ["choice", "score", "boolean"];
  }
  get provider() {
    return this.config.provider;
  }
  async doEvaluate({
    state,
    questions,
    headers,
    abortSignal,
    providerOptions
  }) {
    var _a122;
    const resolvedHeaders = this.config.headers ? await resolve(this.config.headers) : undefined;
    try {
      const {
        responseHeaders,
        value: responseBody,
        rawValue
      } = await postJsonToApi({
        url: this.getUrl(),
        headers: combineHeaders(resolvedHeaders, headers != null ? headers : {}, this.getModelConfigHeaders(), await resolve(this.config.o11yHeaders)),
        body: {
          state,
          questions,
          ...providerOptions ? { providerOptions } : {}
        },
        successfulResponseHandler: createJsonResponseHandler(gatewayEvaluationResponseSchema),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: (data) => {
            var _a132;
            return (_a132 = getErrorMessage(data)) != null ? _a132 : "unknown error";
          }
        }),
        ...abortSignal && { abortSignal },
        fetch: this.config.fetch
      });
      return {
        answers: responseBody.answers,
        ...responseBody.rounding ? { rounding: responseBody.rounding } : {},
        ...responseBody.usage ? { usage: responseBody.usage } : {},
        warnings: (_a122 = responseBody.warnings) != null ? _a122 : [],
        providerMetadata: responseBody.providerMetadata,
        response: {
          modelId: this.modelId,
          headers: responseHeaders,
          body: rawValue
        }
      };
    } catch (error) {
      throw await asGatewayError(error, await parseAuthMethod(resolvedHeaders != null ? resolvedHeaders : {}));
    }
  }
  getUrl() {
    return `${this.config.baseURL}/evaluation-model`;
  }
  getModelConfigHeaders() {
    return {
      "ai-evaluation-model-specification-version": "4",
      "ai-model-id": this.modelId
    };
  }
};
var gatewayEvaluationAnswerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("choice"),
    choice: z.string(),
    probabilities: z.record(z.string(), z.number()).optional()
  }),
  z.object({
    type: z.literal("score"),
    score: z.number(),
    probabilities: z.record(z.string(), z.number()).optional()
  }),
  z.object({
    type: z.literal("boolean"),
    probability: z.number()
  })
]);
var gatewayEvaluationWarningSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("unsupported"),
    feature: z.string(),
    details: z.string().optional()
  }),
  z.object({
    type: z.literal("compatibility"),
    feature: z.string(),
    details: z.string().optional()
  }),
  z.object({
    type: z.literal("deprecated"),
    setting: z.string(),
    message: z.string()
  }),
  z.object({
    type: z.literal("other"),
    message: z.string()
  })
]);
var gatewayEvaluationResponseSchema = lazySchema(() => zodSchema(z.object({
  answers: z.record(z.string(), gatewayEvaluationAnswerSchema),
  rounding: z.object({
    probabilityDecimals: z.number().optional(),
    scoreDecimals: z.number().optional()
  }).optional(),
  usage: z.object({
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional()
  }).optional(),
  warnings: z.array(gatewayEvaluationWarningSchema).optional(),
  providerMetadata: z.record(z.string(), z.record(z.string(), z.unknown())).optional()
})));
var GatewayRerankingModel = class {
  constructor(modelId, config2) {
    this.modelId = modelId;
    this.config = config2;
    this.specificationVersion = "v4";
  }
  get provider() {
    return this.config.provider;
  }
  async doRerank({
    documents,
    query,
    topN,
    headers,
    abortSignal,
    providerOptions
  }) {
    var _a122;
    const resolvedHeaders = this.config.headers ? await resolve(this.config.headers) : undefined;
    try {
      const {
        responseHeaders,
        value: responseBody,
        rawValue
      } = await postJsonToApi({
        url: this.getUrl(),
        headers: combineHeaders(resolvedHeaders, headers != null ? headers : {}, this.getModelConfigHeaders(), await resolve(this.config.o11yHeaders)),
        body: {
          documents,
          query,
          ...topN != null ? { topN } : {},
          ...providerOptions ? { providerOptions } : {}
        },
        successfulResponseHandler: createJsonResponseHandler(gatewayRerankingResponseSchema),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: (data) => {
            var _a132;
            return (_a132 = getErrorMessage(data)) != null ? _a132 : "unknown error";
          }
        }),
        ...abortSignal && { abortSignal },
        fetch: this.config.fetch
      });
      return {
        ranking: responseBody.ranking,
        providerMetadata: responseBody.providerMetadata,
        response: { headers: responseHeaders, body: rawValue },
        warnings: (_a122 = responseBody.warnings) != null ? _a122 : []
      };
    } catch (error) {
      throw await asGatewayError(error, await parseAuthMethod(resolvedHeaders != null ? resolvedHeaders : {}));
    }
  }
  getUrl() {
    return `${this.config.baseURL}/reranking-model`;
  }
  getModelConfigHeaders() {
    return {
      "ai-reranking-model-specification-version": "4",
      "ai-model-id": this.modelId
    };
  }
};
var gatewayRerankingWarningSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("unsupported"),
    feature: z.string(),
    details: z.string().optional()
  }),
  z.object({
    type: z.literal("compatibility"),
    feature: z.string(),
    details: z.string().optional()
  }),
  z.object({
    type: z.literal("deprecated"),
    setting: z.string(),
    message: z.string()
  }),
  z.object({
    type: z.literal("other"),
    message: z.string()
  })
]);
var gatewayRerankingResponseSchema = lazySchema(() => zodSchema(z.object({
  ranking: z.array(z.object({
    index: z.number(),
    relevanceScore: z.number()
  })),
  warnings: z.array(gatewayRerankingWarningSchema).optional(),
  providerMetadata: z.record(z.string(), z.record(z.string(), z.unknown())).optional()
})));
var GatewaySpeechModel = class {
  constructor(modelId, config2) {
    this.modelId = modelId;
    this.config = config2;
    this.specificationVersion = "v4";
  }
  get provider() {
    return this.config.provider;
  }
  async doGenerate({
    text,
    voice,
    outputFormat,
    instructions,
    speed,
    language,
    providerOptions,
    headers,
    abortSignal
  }) {
    var _a122;
    const resolvedHeaders = this.config.headers ? await resolve(this.config.headers) : undefined;
    try {
      const {
        responseHeaders,
        value: responseBody,
        rawValue
      } = await postJsonToApi({
        url: this.getUrl(),
        headers: combineHeaders(resolvedHeaders, headers != null ? headers : {}, this.getModelConfigHeaders(), await resolve(this.config.o11yHeaders)),
        body: {
          text,
          ...voice && { voice },
          ...outputFormat && { outputFormat },
          ...instructions && { instructions },
          ...speed != null && { speed },
          ...language && { language },
          ...providerOptions && { providerOptions }
        },
        successfulResponseHandler: createJsonResponseHandler(gatewaySpeechResponseSchema),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: (data) => {
            var _a132;
            return (_a132 = getErrorMessage(data)) != null ? _a132 : "unknown error";
          }
        }),
        ...abortSignal && { abortSignal },
        fetch: this.config.fetch
      });
      return {
        audio: responseBody.audio,
        warnings: (_a122 = responseBody.warnings) != null ? _a122 : [],
        providerMetadata: responseBody.providerMetadata,
        response: {
          timestamp: /* @__PURE__ */ new Date,
          modelId: this.modelId,
          headers: responseHeaders,
          body: rawValue
        }
      };
    } catch (error) {
      throw await asGatewayError(error, await parseAuthMethod(resolvedHeaders != null ? resolvedHeaders : {}));
    }
  }
  getUrl() {
    return `${this.config.baseURL}/speech-model`;
  }
  getModelConfigHeaders() {
    return {
      "ai-speech-model-specification-version": "4",
      "ai-model-id": this.modelId
    };
  }
};
var providerMetadataEntrySchema3 = z.object({}).catchall(z.unknown());
var gatewaySpeechWarningSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("unsupported"),
    feature: z.string(),
    details: z.string().optional()
  }),
  z.object({
    type: z.literal("compatibility"),
    feature: z.string(),
    details: z.string().optional()
  }),
  z.object({
    type: z.literal("deprecated"),
    setting: z.string(),
    message: z.string()
  }),
  z.object({
    type: z.literal("other"),
    message: z.string()
  })
]);
var gatewaySpeechResponseSchema = z.object({
  audio: z.string(),
  warnings: z.array(gatewaySpeechWarningSchema).optional(),
  providerMetadata: z.record(z.string(), providerMetadataEntrySchema3).optional()
});
var GatewayTranscriptionModel = class {
  constructor(modelId, config2) {
    this.modelId = modelId;
    this.config = config2;
    this.specificationVersion = "v4";
  }
  get provider() {
    return this.config.provider;
  }
  async doGenerate({
    audio,
    mediaType,
    providerOptions,
    headers,
    abortSignal
  }) {
    var _a122, _b122, _c, _d;
    const resolvedHeaders = this.config.headers ? await resolve(this.config.headers) : undefined;
    try {
      const {
        responseHeaders,
        value: responseBody,
        rawValue
      } = await postJsonToApi({
        url: this.getUrl(),
        headers: combineHeaders(resolvedHeaders, headers != null ? headers : {}, this.getModelConfigHeaders(), await resolve(this.config.o11yHeaders)),
        body: {
          audio: audio instanceof Uint8Array ? convertUint8ArrayToBase64(audio) : audio,
          mediaType,
          ...providerOptions && { providerOptions }
        },
        successfulResponseHandler: createJsonResponseHandler(gatewayTranscriptionResponseSchema),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: (data) => {
            var _a132;
            return (_a132 = getErrorMessage(data)) != null ? _a132 : "unknown error";
          }
        }),
        ...abortSignal && { abortSignal },
        fetch: this.config.fetch
      });
      return {
        text: responseBody.text,
        segments: (_a122 = responseBody.segments) != null ? _a122 : [],
        language: (_b122 = responseBody.language) != null ? _b122 : undefined,
        durationInSeconds: (_c = responseBody.durationInSeconds) != null ? _c : undefined,
        warnings: (_d = responseBody.warnings) != null ? _d : [],
        providerMetadata: responseBody.providerMetadata,
        response: {
          timestamp: /* @__PURE__ */ new Date,
          modelId: this.modelId,
          headers: responseHeaders,
          body: rawValue
        }
      };
    } catch (error) {
      throw await asGatewayError(error, await parseAuthMethod(resolvedHeaders != null ? resolvedHeaders : {}));
    }
  }
  async doStream(options) {
    var _a122, _b122, _c, _d, _e;
    const currentDate = (_c = (_b122 = (_a122 = this.config._internal) == null ? undefined : _a122.currentDate) == null ? undefined : _b122.call(_a122)) != null ? _c : /* @__PURE__ */ new Date;
    const headers = combineHeaders(await resolve((_d = this.config.headers) != null ? _d : {}), (_e = options.headers) != null ? _e : {}, this.getModelConfigHeaders(), await resolve(this.config.o11yHeaders));
    const authMethod = await parseAuthMethod(headers);
    const startFrame = {
      type: TRANSCRIPTION_STREAM_START_FRAME_TYPE,
      inputAudioFormat: options.inputAudioFormat,
      ...options.providerOptions != null && {
        providerOptions: options.providerOptions
      },
      ...options.includeRawChunks != null && {
        includeRawChunks: options.includeRawChunks
      }
    };
    return {
      stream: createGatewayTranscriptionStream({
        webSocket: this.config.webSocket,
        url: toGatewayTranscriptionUrl(this.config.baseURL, this.modelId),
        protocols: getProtocolsFromHeaders(headers),
        headers,
        startFrame,
        audio: options.audio,
        abortSignal: options.abortSignal,
        authMethod
      }),
      request: { body: startFrame },
      response: { timestamp: currentDate, modelId: this.modelId }
    };
  }
  getUrl() {
    return `${this.config.baseURL}/transcription-model`;
  }
  getModelConfigHeaders() {
    return {
      "ai-transcription-model-specification-version": "4",
      "ai-model-id": this.modelId
    };
  }
};
function toGatewayTranscriptionUrl(baseURL, modelId) {
  const url = new URL(`${baseURL.replace(/^http/, "ws")}/transcription-model`);
  url.searchParams.set("ai-model-id", modelId);
  return url.toString();
}
function getProtocolsFromHeaders(headers) {
  const normalizedHeaders = normalizeHeaders(headers);
  const authorization = normalizedHeaders.authorization;
  const token = (authorization == null ? undefined : authorization.startsWith("Bearer ")) ? authorization.slice("Bearer ".length) : undefined;
  return token == null ? [GATEWAY_TRANSCRIPTION_SUBPROTOCOL] : getGatewayTranscriptionProtocols(token, {
    teamIdOrSlug: normalizedHeaders[VERCEL_AI_GATEWAY_TEAM_HEADER]
  });
}
var MAX_AUDIO_FRAME_BYTES = 64 * 1024;
function createGatewayTranscriptionStream({
  webSocket,
  url,
  protocols,
  headers,
  startFrame,
  audio,
  abortSignal,
  authMethod
}) {
  let finished = false;
  let cleanup = () => {};
  return new ReadableStream({
    start: (controller) => {
      let audioReader;
      let hasServerErrorPart = false;
      let lastServerError;
      let audioStopped = false;
      let connection;
      cleanup = (closeCode) => {
        if (audioReader != null) {
          audioReader.cancel().catch(() => {});
        } else {
          audio.cancel().catch(() => {});
        }
        connection == null || connection.close(closeCode);
      };
      const stopAudio = () => {
        audioStopped = true;
        if (audioReader != null) {
          audioReader.cancel().catch(() => {});
          audioReader = undefined;
        } else {
          audio.cancel().catch(() => {});
        }
      };
      const finishWithError = (error) => {
        if (finished)
          return;
        finished = true;
        cleanup();
        errorControllerWithGatewayError(controller, error, authMethod);
      };
      const sendAudio = async (socket) => {
        const reader = audio.getReader();
        audioReader = reader;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done || finished)
              break;
            const bytes = typeof value === "string" ? convertBase64ToUint8Array(value) : value;
            for (let offset = 0;offset < bytes.length; offset += MAX_AUDIO_FRAME_BYTES) {
              if (finished)
                break;
              socket.send(bytes.subarray(offset, offset + MAX_AUDIO_FRAME_BYTES));
              await waitForWebSocketBufferDrain(socket);
            }
          }
        } finally {
          reader.releaseLock();
          if (audioReader === reader) {
            audioReader = undefined;
          }
        }
        if (!finished && !audioStopped) {
          socket.send(JSON.stringify({
            type: TRANSCRIPTION_STREAM_AUDIO_DONE_FRAME_TYPE
          }));
        }
      };
      connection = connectToWebSocket({
        url,
        protocols,
        headers,
        webSocket,
        abortSignal,
        onAbort: (reason) => {
          if (finished)
            return;
          finished = true;
          cleanup();
          controller.error(reason);
        },
        onProcessingError: finishWithError,
        onOpen: (socket) => {
          socket.send(JSON.stringify(startFrame));
          sendAudio(socket).catch(finishWithError);
        },
        onMessageText: (text) => {
          if (finished)
            return;
          const part = parseTranscriptionStreamPart(text);
          if (part == null)
            return;
          if (part.type === "finish") {
            finished = true;
            controller.enqueue(part);
            controller.close();
            cleanup(1000);
            return;
          }
          if (part.type === "error") {
            hasServerErrorPart = true;
            lastServerError = part.error;
            stopAudio();
          }
          controller.enqueue(part);
        },
        onSocketError: () => {
          finishWithError(new Error("Connection error on AI Gateway transcription stream"));
        },
        onClose: () => {
          if (hasServerErrorPart) {
            if (finished)
              return;
            createErrorFromServerErrorPart(lastServerError, authMethod).then(finishWithError);
            return;
          }
          finishWithError(new Error("AI Gateway transcription stream closed before a finish part was received"));
        }
      });
    },
    cancel: () => {
      if (finished)
        return;
      finished = true;
      cleanup();
    }
  });
}
var providerMetadataEntrySchema4 = z.object({}).catchall(z.unknown());
var gatewayTranscriptionWarningSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("unsupported"),
    feature: z.string(),
    details: z.string().optional()
  }),
  z.object({
    type: z.literal("compatibility"),
    feature: z.string(),
    details: z.string().optional()
  }),
  z.object({
    type: z.literal("deprecated"),
    setting: z.string(),
    message: z.string()
  }),
  z.object({
    type: z.literal("other"),
    message: z.string()
  })
]);
var gatewayTranscriptionResponseSchema = z.object({
  text: z.string(),
  segments: z.array(z.object({
    text: z.string(),
    startSecond: z.number(),
    endSecond: z.number()
  })).optional(),
  language: z.string().nullish(),
  durationInSeconds: z.number().nullish(),
  warnings: z.array(gatewayTranscriptionWarningSchema).optional(),
  providerMetadata: z.record(z.string(), providerMetadataEntrySchema4).optional()
});
async function errorControllerWithGatewayError(controller, error, authMethod) {
  controller.error(await asGatewayError(error, authMethod));
}
function getServerErrorMessage(error) {
  if (error != null && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return getErrorMessage(error);
}
var SERVER_ERROR_STATUS_CODES = {
  authentication_error: 401,
  failed_dependency: 424,
  forbidden: 403,
  internal_server_error: 500,
  invalid_request_error: 400,
  model_not_found: 404,
  rate_limit_exceeded: 429
};
async function createErrorFromServerErrorPart(error, authMethod) {
  if (typeof error === "object" && error != null && "message" in error && typeof error.message === "string" && "type" in error && typeof error.type === "string" && error.type in SERVER_ERROR_STATUS_CODES) {
    return createGatewayErrorFromResponse({
      response: { error: { message: error.message, type: error.type } },
      statusCode: SERVER_ERROR_STATUS_CODES[error.type],
      authMethod
    });
  }
  return new Error(`AI Gateway transcription stream failed: ${getServerErrorMessage(error)}`);
}
var GatewayRealtimeModel = class {
  constructor(modelId, config2) {
    this.specificationVersion = "v4";
    this.modelId = modelId;
    this.provider = config2.provider;
    this.config = config2;
  }
  async doCreateClientSecret(options) {
    const secret = await this.config.createClientSecret({
      modelId: this.modelId,
      ...(options == null ? undefined : options.expiresAfterSeconds) != null && {
        expiresAfterSeconds: options.expiresAfterSeconds
      }
    });
    return {
      token: secret.token,
      url: toGatewayRealtimeUrl(this.config.baseURL, this.modelId),
      ...secret.expiresAt != null && { expiresAt: secret.expiresAt }
    };
  }
  getWebSocketConfig(options) {
    return {
      url: options.url,
      protocols: getGatewayRealtimeProtocols(options.token, {
        teamIdOrSlug: this.config.teamIdOrSlug
      })
    };
  }
  parseServerEvent(raw) {
    return raw;
  }
  serializeClientEvent(event) {
    return event;
  }
  buildSessionConfig(config2) {
    return config2;
  }
};
function toGatewayRealtimeUrl(baseURL, modelId) {
  const url = new URL(`${baseURL.replace(/^http/, "ws")}/realtime-model`);
  url.searchParams.set("ai-model-id", modelId);
  return url.toString();
}
var exaSearchInputSchema = lazySchema(() => zodSchema(z.object({
  query: z.string().describe("Natural-language web search query. This is required."),
  type: z.enum(["auto", "fast", "instant"]).optional().describe("Search method. Use auto for the default balance of speed and quality."),
  num_results: z.number().optional().describe("Maximum number of results to return (1-100, default: 10)."),
  category: z.enum([
    "company",
    "people",
    "research paper",
    "news",
    "personal site",
    "financial report"
  ]).optional().describe("Optional content category to focus results."),
  user_location: z.string().optional().describe("Two-letter ISO country code such as 'US'."),
  include_domains: z.array(z.string()).optional().describe("Only return results from these domains."),
  exclude_domains: z.array(z.string()).optional().describe("Exclude results from these domains."),
  start_published_date: z.string().optional().describe("Only return links published after this ISO 8601 date."),
  end_published_date: z.string().optional().describe("Only return links published before this ISO 8601 date."),
  contents: z.object({
    text: z.union([
      z.boolean(),
      z.object({
        max_characters: z.number().optional(),
        include_html_tags: z.boolean().optional(),
        verbosity: z.enum(["compact", "standard", "full"]).optional(),
        include_sections: z.array(z.enum([
          "header",
          "navigation",
          "banner",
          "body",
          "sidebar",
          "footer",
          "metadata"
        ])).optional(),
        exclude_sections: z.array(z.enum([
          "header",
          "navigation",
          "banner",
          "body",
          "sidebar",
          "footer",
          "metadata"
        ])).optional()
      })
    ]).optional(),
    highlights: z.union([
      z.boolean(),
      z.object({
        query: z.string().optional(),
        max_characters: z.number().optional()
      })
    ]).optional(),
    max_age_hours: z.number().optional(),
    livecrawl_timeout: z.number().optional(),
    subpages: z.number().optional(),
    subpage_target: z.union([z.string(), z.array(z.string())]).optional(),
    extras: z.object({
      links: z.number().optional(),
      image_links: z.number().optional()
    }).optional()
  }).optional().describe("Controls extracted page content and freshness.")
})));
var exaSearchOutputSchema = lazySchema(() => zodSchema(z.union([
  z.object({
    requestId: z.string(),
    searchType: z.string().optional(),
    resolvedSearchType: z.string().optional(),
    results: z.array(z.object({
      title: z.string(),
      url: z.string(),
      id: z.string(),
      publishedDate: z.string().nullable().optional(),
      author: z.string().nullable().optional(),
      image: z.string().nullable().optional(),
      favicon: z.string().nullable().optional(),
      text: z.string().optional(),
      highlights: z.array(z.string()).optional(),
      highlightScores: z.array(z.number()).optional(),
      summary: z.string().optional(),
      subpages: z.array(z.any()).optional(),
      extras: z.object({
        links: z.array(z.string()).optional(),
        imageLinks: z.array(z.string()).optional()
      }).optional()
    })),
    costDollars: z.object({
      total: z.number().optional(),
      search: z.record(z.string(), z.number()).optional()
    }).optional()
  }),
  z.object({
    error: z.enum([
      "api_error",
      "rate_limit",
      "timeout",
      "invalid_input",
      "configuration_error",
      "execution_error",
      "unknown"
    ]),
    statusCode: z.number().optional(),
    message: z.string()
  })
])));
var exaSearchToolFactory = createProviderExecutedToolFactory({
  id: "gateway.exa_search",
  inputSchema: exaSearchInputSchema,
  outputSchema: exaSearchOutputSchema
});
var exaSearch = (config2 = {}) => exaSearchToolFactory(config2);
var parallelSearchInputSchema = lazySchema(() => zodSchema(z.object({
  objective: z.string().describe("Natural-language description of the web research goal, including source or freshness guidance and broader context from the task. Maximum 5000 characters."),
  search_queries: z.array(z.string()).optional().describe("Optional search queries to supplement the objective. Maximum 200 characters per query."),
  mode: z.enum(["one-shot", "agentic"]).optional().describe('Mode preset: "one-shot" for comprehensive results with longer excerpts (default), "agentic" for concise, token-efficient results for multi-step workflows.'),
  max_results: z.number().optional().describe("Maximum number of results to return (1-20). Defaults to 10 if not specified."),
  source_policy: z.object({
    include_domains: z.array(z.string()).optional().describe("Limit results to these domains. Use plain domain names only — e.g. example.com or sub.example.gov, or a bare extension like .edu. Do not include a scheme, path, or port (e.g. not https://example.com/page)."),
    exclude_domains: z.array(z.string()).optional().describe("Exclude results from these domains. Use plain domain names only — e.g. example.com or sub.example.gov, or a bare extension like .edu. Do not include a scheme, path, or port (e.g. not https://example.com/page)."),
    after_date: z.string().optional().describe("Only include results published after this date. Use an ISO 8601 calendar date formatted YYYY-MM-DD (e.g. 2025-01-01); do not include a time.")
  }).optional().describe("Source policy for controlling which domains to include/exclude and freshness."),
  excerpts: z.object({
    max_chars_per_result: z.number().optional().describe("Maximum characters per result."),
    max_chars_total: z.number().optional().describe("Maximum total characters across all results.")
  }).optional().describe("Excerpt configuration for controlling result length."),
  fetch_policy: z.object({
    max_age_seconds: z.number().optional().describe("Maximum age in seconds for cached content. Set to 0 to always fetch fresh content.")
  }).optional().describe("Fetch policy for controlling content freshness.")
})));
var parallelSearchOutputSchema = lazySchema(() => zodSchema(z.union([
  z.object({
    searchId: z.string(),
    results: z.array(z.object({
      url: z.string(),
      title: z.string(),
      excerpt: z.string(),
      publishDate: z.string().nullable().optional(),
      relevanceScore: z.number().optional()
    }))
  }),
  z.object({
    error: z.enum([
      "api_error",
      "rate_limit",
      "timeout",
      "invalid_input",
      "configuration_error",
      "unknown"
    ]),
    statusCode: z.number().optional(),
    message: z.string()
  })
])));
var parallelSearchToolFactory = createProviderExecutedToolFactory({
  id: "gateway.parallel_search",
  inputSchema: parallelSearchInputSchema,
  outputSchema: parallelSearchOutputSchema
});
var parallelSearch = (config2 = {}) => parallelSearchToolFactory(config2);
var perplexitySearchInputSchema = lazySchema(() => zodSchema(z.object({
  query: z.union([z.string(), z.array(z.string())]).describe("Search query (string) or multiple queries (array of up to 5 strings). Multi-query searches return combined results from all queries."),
  max_results: z.number().optional().describe("Maximum number of search results to return (1-20, default: 10)"),
  max_tokens_per_page: z.number().optional().describe("Maximum number of tokens to extract per search result page (256-2048, default: 2048)"),
  max_tokens: z.number().optional().describe("Maximum total tokens across all search results (default: 25000, max: 1000000)"),
  country: z.string().optional().describe("Two-letter ISO 3166-1 alpha-2 country code for regional search results (e.g., 'US', 'GB', 'FR')"),
  search_domain_filter: z.array(z.string()).optional().describe("List of domains to include or exclude from search results (max 20). To include: ['nature.com', 'science.org']. To exclude: ['-example.com', '-spam.net']"),
  search_language_filter: z.array(z.string()).optional().describe("List of ISO 639-1 language codes to filter results (max 10, lowercase). Examples: ['en', 'fr', 'de']"),
  search_after_date: z.string().optional().describe("Include only results published after this date. Format: 'MM/DD/YYYY' (e.g., '3/1/2025'). Cannot be used with search_recency_filter."),
  search_before_date: z.string().optional().describe("Include only results published before this date. Format: 'MM/DD/YYYY' (e.g., '3/15/2025'). Cannot be used with search_recency_filter."),
  last_updated_after_filter: z.string().optional().describe("Include only results last updated after this date. Format: 'MM/DD/YYYY' (e.g., '3/1/2025'). Cannot be used with search_recency_filter."),
  last_updated_before_filter: z.string().optional().describe("Include only results last updated before this date. Format: 'MM/DD/YYYY' (e.g., '3/15/2025'). Cannot be used with search_recency_filter."),
  search_recency_filter: z.enum(["day", "week", "month", "year"]).optional().describe("Filter results by relative time period. Cannot be used with search_after_date or search_before_date.")
})));
var perplexitySearchOutputSchema = lazySchema(() => zodSchema(z.union([
  z.object({
    results: z.array(z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
      date: z.string().optional(),
      lastUpdated: z.string().optional()
    })),
    id: z.string()
  }),
  z.object({
    error: z.enum([
      "api_error",
      "rate_limit",
      "timeout",
      "invalid_input",
      "unknown"
    ]),
    statusCode: z.number().optional(),
    message: z.string()
  })
])));
var perplexitySearchToolFactory = createProviderExecutedToolFactory({
  id: "gateway.perplexity_search",
  inputSchema: perplexitySearchInputSchema,
  outputSchema: perplexitySearchOutputSchema
});
var perplexitySearch = (config2 = {}) => perplexitySearchToolFactory(config2);
var takoDataSourceInputSchema = z.object({
  count: z.number().optional().describe("Maximum number of data results to return (1-20). When include_contents is true, each additional result adds its own data surcharge."),
  include_contents: z.boolean().optional().describe("Inline rows for each data result. This adds a data surcharge based on row count and dataset source. To estimate cost, search with include_contents disabled and inspect cards.content.export_pricing. This applies to every returned card; limit sources.data.count and sources.data.max_rows to control cost."),
  mode: z.enum(["inline", "url"]).optional().describe("Requested data delivery mode. Search card data is always inline."),
  content_format: z.enum(["card_json", "csv", "json_compact", "json_records"]).optional().describe("Serialization for inlined card data."),
  max_rows: z.number().optional().describe("Maximum rows to inline per result. Omit to use the allowance in cards.content.export_pricing. A data surcharge applies per 1,000 exported rows; lower values reduce cost."),
  node_ids: z.array(z.string()).optional().describe("Data Graph node IDs to prioritize. Maximum 20."),
  strict: z.boolean().optional().describe("Only return cards matching node_ids. Requires a non-empty node_ids.")
});
var takoWebSourceInputSchema = z.object({
  count: z.number().optional().describe("Maximum number of web results to return (1-20)."),
  include_contents: z.boolean().optional().describe("Inline extracted web page text. This can add a data charge."),
  category: z.enum(["finance", "news", "sports"]).optional().describe("Optional web-result category filter."),
  include_domains: z.array(z.string()).optional().describe("Only return results from these bare domains."),
  exclude_domains: z.array(z.string()).optional().describe("Exclude results from these bare domains."),
  snippet_max_chars: z.number().optional().describe("Maximum characters in each web-result snippet."),
  highlights: z.boolean().optional().describe("Include highlighted passages in web results. Defaults to true in AI Gateway."),
  article_content_max_chars: z.number().optional().describe("Maximum extracted characters per web page when including contents."),
  published_after: z.string().optional().describe("Keep results published on or after this ISO date (YYYY-MM-DD)."),
  published_before: z.string().optional().describe("Keep results published on or before this ISO date (YYYY-MM-DD).")
});
var takoSearchInputSchema = lazySchema(() => zodSchema(z.object({
  query: z.string().describe('Natural-language search query. Include the entity, metric, and time period. Quote a phrase to force it to one entity, for example "Tesla":PRODUCT price.'),
  effort: z.enum(["deep", "fast", "instant"]).optional().describe("Search effort. fast is the balanced default, instant favors cached results and low latency, and deep broadens retrieval with reranking at higher cost and latency."),
  sources: z.object({
    data: takoDataSourceInputSchema.optional(),
    web: takoWebSourceInputSchema.optional()
  }).optional().describe("Sources to search. Omit to search both curated data and the web. When provided, only keys present are searched."),
  location: z.object({
    latitude: z.number().describe("Latitude between -90 and 90."),
    longitude: z.number().describe("Longitude between -180 and 180.")
  }).optional().describe("End-user coordinates for localized results."),
  country_code: z.string().optional().describe("Two-letter ISO 3166-1 country code, such as 'US'."),
  locale: z.string().optional().describe("BCP-47 locale, such as 'en-US'."),
  timezone: z.string().optional().describe("IANA timezone, such as 'America/New_York'."),
  output_settings: z.object({
    image_dark_mode: z.boolean().optional().describe("Render card preview images in dark mode."),
    force_refresh: z.boolean().optional().describe("Instant-effort only. Request a refreshed instant result.")
  }).optional().describe("Controls card rendering in the search response."),
  include_related: z.number().optional().describe("Maximum related search suggestions to include (1-20).")
})));
var takoDatasetCellSchema = z.union([z.boolean(), z.number(), z.string()]).nullable();
var takoResultContentSchema = z.object({
  content_format: z.enum(["card_json", "csv", "json_compact", "json_records"]).nullish(),
  cost: z.number().optional(),
  data: z.string().nullish(),
  records: z.array(z.record(z.string(), takoDatasetCellSchema)).nullish(),
  dataset: z.object({
    columns: z.array(z.object({
      name: z.string(),
      type: z.enum(["boolean", "date", "datetime", "number", "string"]),
      unit: z.string().nullish()
    })),
    rows: z.array(z.array(takoDatasetCellSchema)),
    total_rows: z.number(),
    truncated: z.boolean(),
    ref: z.string(),
    sources: z.array(z.object({
      name: z.string(),
      index: z.enum(["data", "web"]).optional()
    })),
    provenance: z.enum(["query", "web_extraction"]).optional()
  }).nullish(),
  card_data: z.object({}).passthrough().nullish(),
  card_data_schema: z.object({}).passthrough().nullish(),
  url: z.string().nullish(),
  expires_at: z.string().nullish(),
  total_rows: z.number().nullish(),
  truncated: z.boolean().optional(),
  export_pricing: z.object({
    baseline_usd: z.number(),
    free_rows: z.number(),
    max_rows_ceiling: z.number(),
    row_cpm_usd: z.number()
  }).nullish(),
  manifest: z.array(z.object({
    dtype: z.enum(["boolean", "date", "datetime", "number", "string"]).nullish(),
    entity: z.string().nullish(),
    metric: z.string().nullish(),
    name: z.string().nullish(),
    unit: z.string().nullish()
  })).nullish()
}).passthrough();
var takoCardSchema = z.object({
  card_id: z.string().nullish(),
  title: z.string().nullish(),
  description: z.string().nullish(),
  semantic_description: z.string().nullish(),
  webpage_url: z.string().nullish(),
  image_url: z.string().nullish(),
  embed_url: z.string().nullish(),
  sources: z.array(z.object({
    source_name: z.string().nullish(),
    source_description: z.string().nullish(),
    source_index: z.enum(["data", "web"]),
    source_text: z.string().nullish(),
    url: z.string().nullish()
  })).nullish(),
  methodologies: z.array(z.object({
    methodology_name: z.string().nullable(),
    methodology_description: z.string().nullable()
  })).nullish(),
  source_indexes: z.array(z.enum(["data", "web"])).nullish(),
  card_type: z.string().nullish(),
  relevance: z.enum(["High", "Low", "Medium"]).nullish(),
  content: takoResultContentSchema.nullish(),
  exportable: z.boolean().optional(),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.enum(["entity", "metric"]),
    name: z.string(),
    description: z.string().nullish()
  })).nullish(),
  metric_definitions: z.array(z.object({ name: z.string(), definition: z.string() })).nullish(),
  data_freshness: z.object({
    coverage_end: z.string().nullish(),
    data_as_of: z.string().nullish(),
    last_updated: z.string().nullish()
  }).nullish()
}).passthrough();
var takoWebResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string().nullish(),
  source_name: z.string().nullish(),
  publish_date: z.string().nullish(),
  content: takoResultContentSchema.nullish()
}).passthrough();
var takoSearchOutputSchema = lazySchema(() => zodSchema(z.union([
  z.object({
    request_id: z.string(),
    cards: z.array(takoCardSchema).optional(),
    web_results: z.array(takoWebResultSchema).optional(),
    usage: z.object({
      total_cost_usd: z.number(),
      compute: z.object({ cost_usd: z.number() }).nullish(),
      data: z.object({ cost_usd: z.number(), datasets: z.number() }).nullish()
    }).nullish(),
    related: z.array(z.object({}).passthrough()).nullish()
  }).passthrough(),
  z.object({
    error: z.enum([
      "api_error",
      "configuration_error",
      "execution_error",
      "invalid_input",
      "rate_limit",
      "timeout",
      "unknown_tool"
    ]),
    statusCode: z.number().optional(),
    message: z.string()
  })
])));
var takoSearchToolFactory = createProviderExecutedToolFactory({
  id: "gateway.tako_search",
  inputSchema: takoSearchInputSchema,
  outputSchema: takoSearchOutputSchema
});
var takoSearch = (config2 = {}) => takoSearchToolFactory(config2);
var gatewayTools = {
  exaSearch,
  parallelSearch,
  perplexitySearch,
  takoSearch
};
async function getVercelRequestId() {
  var _a122;
  return (_a122 = import_oidc.getContext().headers) == null ? undefined : _a122["x-vercel-id"];
}
var VERSION2 = "4.0.86";
var AI_GATEWAY_PROTOCOL_VERSION = "0.0.1";
var gatewayClientSecretResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.number().nullish()
});
function createGateway(options = {}) {
  var _a122, _b122;
  let pendingMetadata = null;
  let metadataCache = null;
  const cacheRefreshMillis = (_a122 = options.metadataCacheRefreshMillis) != null ? _a122 : 1000 * 60 * 5;
  let lastFetchTime = 0;
  const baseURL = (_b122 = withoutTrailingSlash(options.baseURL)) != null ? _b122 : "https://ai-gateway.vercel.sh/v4/ai";
  const createAuthHeaders = (auth) => withUserAgentSuffix({
    Authorization: `Bearer ${auth.token}`,
    "ai-gateway-protocol-version": AI_GATEWAY_PROTOCOL_VERSION,
    [GATEWAY_AUTH_METHOD_HEADER]: auth.authMethod,
    ...options.teamIdOrSlug != null ? { [VERCEL_AI_GATEWAY_TEAM_HEADER]: options.teamIdOrSlug } : {},
    ...options.headers
  }, `ai-sdk/gateway/${VERSION2}`);
  const getHeaders = async () => {
    try {
      return createAuthHeaders(await getGatewayAuthToken(options));
    } catch (error) {
      throw GatewayAuthenticationError.createContextualError({
        apiKeyProvided: false,
        oidcTokenProvided: false,
        statusCode: 401,
        cause: error
      });
    }
  };
  const getRealtimeAuthToken = async () => {
    try {
      return await getGatewayAuthToken(options);
    } catch (error) {
      throw GatewayAuthenticationError.createContextualError({
        apiKeyProvided: false,
        oidcTokenProvided: false,
        statusCode: 401,
        cause: error
      });
    }
  };
  const mintClientSecret = async (params) => {
    assertGatewayClientSecretServerEnvironment();
    const auth = await getRealtimeAuthToken();
    const headers = createAuthHeaders(auth);
    const url = new URL("/v1/realtime/client-secrets", baseURL).toString();
    try {
      const { value } = await postJsonToApi({
        url,
        headers,
        body: {
          model: params.modelId,
          ...params.routeKind != null && { routeKind: params.routeKind },
          ...params.expiresAfterSeconds != null && {
            expiresIn: params.expiresAfterSeconds
          }
        },
        successfulResponseHandler: createJsonResponseHandler(gatewayClientSecretResponseSchema),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: (data) => {
            var _a132;
            return (_a132 = getErrorMessage(data)) != null ? _a132 : "unknown error";
          }
        }),
        fetch: options.fetch
      });
      return {
        token: value.token,
        ...value.expiresAt != null && { expiresAt: value.expiresAt }
      };
    } catch (error) {
      throw await asGatewayError(error, await parseAuthMethod(headers));
    }
  };
  const createO11yHeaders = () => {
    const deploymentId = loadOptionalSetting({
      settingValue: undefined,
      environmentVariableName: "VERCEL_DEPLOYMENT_ID"
    });
    const environment = loadOptionalSetting({
      settingValue: undefined,
      environmentVariableName: "VERCEL_ENV"
    });
    const region = loadOptionalSetting({
      settingValue: undefined,
      environmentVariableName: "VERCEL_REGION"
    });
    const projectId = loadOptionalSetting({
      settingValue: undefined,
      environmentVariableName: "VERCEL_PROJECT_ID"
    });
    return async () => {
      const requestId = await getVercelRequestId();
      return {
        ...deploymentId && { "ai-o11y-deployment-id": deploymentId },
        ...environment && { "ai-o11y-environment": environment },
        ...region && { "ai-o11y-region": region },
        ...requestId && { "ai-o11y-request-id": requestId },
        ...projectId && { "ai-o11y-project-id": projectId }
      };
    };
  };
  const createLanguageModel = (modelId) => {
    return new GatewayLanguageModel(modelId, {
      provider: "gateway",
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      o11yHeaders: createO11yHeaders()
    });
  };
  const createBatch = () => new GatewayBatch({
    provider: "gateway",
    baseURL,
    headers: getHeaders,
    fetch: options.fetch,
    o11yHeaders: createO11yHeaders()
  });
  const getAvailableModels = async () => {
    var _a132, _b132, _c;
    const now = (_c = (_b132 = (_a132 = options._internal) == null ? undefined : _a132.currentDate) == null ? undefined : _b132.call(_a132).getTime()) != null ? _c : Date.now();
    if (!pendingMetadata || now - lastFetchTime > cacheRefreshMillis) {
      lastFetchTime = now;
      pendingMetadata = new GatewayFetchMetadata({
        baseURL,
        headers: getHeaders,
        fetch: options.fetch
      }).getAvailableModels().then((metadata) => {
        metadataCache = metadata;
        return metadata;
      }).catch(async (error) => {
        throw await asGatewayError(error, await parseAuthMethod(await getHeaders()));
      });
    }
    return metadataCache ? Promise.resolve(metadataCache) : pendingMetadata;
  };
  const getCredits = async () => {
    return new GatewayFetchMetadata({
      baseURL,
      headers: getHeaders,
      fetch: options.fetch
    }).getCredits().catch(async (error) => {
      throw await asGatewayError(error, await parseAuthMethod(await getHeaders()));
    });
  };
  const getSpendReport = async (params) => {
    return new GatewaySpendReport({
      baseURL,
      headers: getHeaders,
      fetch: options.fetch
    }).getSpendReport(params).catch(async (error) => {
      throw await asGatewayError(error, await parseAuthMethod(await getHeaders()));
    });
  };
  const getGenerationInfo = async (params) => {
    return new GatewayGenerationInfoFetcher({
      baseURL,
      headers: getHeaders,
      fetch: options.fetch
    }).getGenerationInfo(params).catch(async (error) => {
      throw await asGatewayError(error, await parseAuthMethod(await getHeaders()));
    });
  };
  const provider = function(modelId) {
    if (new.target) {
      throw new Error("The Gateway Provider model function cannot be called with the new keyword.");
    }
    return createLanguageModel(modelId);
  };
  provider.specificationVersion = "v4";
  provider.getAvailableModels = getAvailableModels;
  provider.getCredits = getCredits;
  provider.getSpendReport = getSpendReport;
  provider.getGenerationInfo = getGenerationInfo;
  provider.imageModel = (modelId) => {
    return new GatewayImageModel(modelId, {
      provider: "gateway",
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      o11yHeaders: createO11yHeaders()
    });
  };
  provider.languageModel = createLanguageModel;
  provider.experimental_batch = createBatch;
  const createEmbeddingModel = (modelId) => {
    return new GatewayEmbeddingModel(modelId, {
      provider: "gateway",
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      o11yHeaders: createO11yHeaders()
    });
  };
  provider.embeddingModel = createEmbeddingModel;
  provider.textEmbeddingModel = createEmbeddingModel;
  provider.videoModel = (modelId) => {
    return new GatewayVideoModel(modelId, {
      provider: "gateway",
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      o11yHeaders: createO11yHeaders()
    });
  };
  const createRerankingModel = (modelId) => {
    return new GatewayRerankingModel(modelId, {
      provider: "gateway",
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      o11yHeaders: createO11yHeaders()
    });
  };
  provider.rerankingModel = createRerankingModel;
  provider.reranking = createRerankingModel;
  const createEvaluationModel = (modelId) => {
    return new GatewayEvaluationModel(modelId, {
      provider: "gateway",
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      o11yHeaders: createO11yHeaders()
    });
  };
  provider.evaluationModel = createEvaluationModel;
  provider.evaluation = createEvaluationModel;
  const createSpeechModel = (modelId) => {
    return new GatewaySpeechModel(modelId, {
      provider: "gateway",
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      o11yHeaders: createO11yHeaders()
    });
  };
  provider.speechModel = createSpeechModel;
  provider.speech = createSpeechModel;
  const createTranscriptionModel = (modelId) => {
    return new GatewayTranscriptionModel(modelId, {
      provider: "gateway",
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      o11yHeaders: createO11yHeaders(),
      webSocket: options.webSocket
    });
  };
  provider.transcriptionModel = createTranscriptionModel;
  provider.transcription = createTranscriptionModel;
  provider.experimental_transcription = Object.assign((modelId) => createTranscriptionModel(modelId), {
    getToken: async (tokenOptions) => {
      const secret = await mintClientSecret({
        modelId: tokenOptions.model,
        routeKind: "transcription",
        ...tokenOptions.expiresAfterSeconds != null && {
          expiresAfterSeconds: tokenOptions.expiresAfterSeconds
        }
      });
      return {
        token: secret.token,
        url: toGatewayTranscriptionUrl(baseURL, tokenOptions.model),
        ...secret.expiresAt != null && { expiresAt: secret.expiresAt }
      };
    }
  });
  const createRealtimeModel = (modelId) => new GatewayRealtimeModel(modelId, {
    provider: "gateway.realtime",
    baseURL,
    teamIdOrSlug: options.teamIdOrSlug,
    createClientSecret: mintClientSecret
  });
  provider.experimental_realtime = Object.assign((modelId) => createRealtimeModel(modelId), {
    getToken: async (tokenOptions) => {
      const { model: modelId, ...secretOptions } = tokenOptions;
      const model = createRealtimeModel(modelId);
      const secret = await model.doCreateClientSecret(secretOptions);
      return {
        token: secret.token,
        url: secret.url,
        ...secret.expiresAt != null && { expiresAt: secret.expiresAt }
      };
    }
  });
  provider.chat = provider.languageModel;
  provider.embedding = provider.embeddingModel;
  provider.image = provider.imageModel;
  provider.video = provider.videoModel;
  provider.tools = gatewayTools;
  return provider;
}
var gateway = createGateway();
async function getGatewayAuthToken(options) {
  const apiKey = loadOptionalSetting({
    settingValue: options.apiKey,
    environmentVariableName: "AI_GATEWAY_API_KEY"
  });
  if (apiKey) {
    return {
      token: apiKey,
      authMethod: "api-key"
    };
  }
  const oidcToken = await import_oidc2.getVercelOidcToken();
  return {
    token: oidcToken,
    authMethod: "oidc"
  };
}
function assertGatewayClientSecretServerEnvironment() {
  if (typeof globalThis.window !== "undefined") {
    throw new Error("AI Gateway client secrets must be minted server-side: minting needs your Gateway credential, which must never reach the browser. Call gateway.experimental_realtime.getToken() or gateway.experimental_transcription.getToken() from your server and pass the returned token to the client.");
  }
}

// node_modules/ai/dist/index.js
var __defProp2 = Object.defineProperty;
var __export2 = (target, all) => {
  for (var name25 in all)
    __defProp2(target, name25, { get: all[name25], enumerable: true });
};
var name19 = "AI_InvalidArgumentError";
var marker19 = `vercel.ai.error.${name19}`;
var symbol20 = Symbol.for(marker19);
var _a24;
var _b20;
var InvalidArgumentError2 = class extends (_b20 = AISDKError, _a24 = symbol20, _b20) {
  constructor({
    parameter,
    value,
    message
  }) {
    super({
      name: name19,
      message: `Invalid argument for parameter ${parameter}: ${message}`
    });
    this[_a24] = true;
    this.parameter = parameter;
    this.value = value;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker19);
  }
};
var name24 = "AI_InvalidStreamPartError";
var marker24 = `vercel.ai.error.${name24}`;
var symbol24 = Symbol.for(marker24);
var _a25;
var _b24;
var InvalidStreamPartError = class extends (_b24 = AISDKError, _a25 = symbol24, _b24) {
  constructor({
    chunk,
    message
  }) {
    super({ name: name24, message });
    this[_a25] = true;
    this.chunk = chunk;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker24);
  }
};
var name33 = "AI_InvalidToolApprovalError";
var marker34 = `vercel.ai.error.${name33}`;
var symbol33 = Symbol.for(marker34);
var _a33;
var _b33;
var InvalidToolApprovalError = class extends (_b33 = AISDKError, _a33 = symbol33, _b33) {
  constructor({ approvalId }) {
    super({
      name: name33,
      message: `Tool approval response references unknown approvalId: "${approvalId}". No matching tool-approval-request found in message history.`
    });
    this[_a33] = true;
    this.approvalId = approvalId;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker34);
  }
};
var name43 = "AI_InvalidToolApprovalSignatureError";
var marker43 = `vercel.ai.error.${name43}`;
var symbol43 = Symbol.for(marker43);
var _a43;
var _b43;
var InvalidToolApprovalSignatureError = class extends (_b43 = AISDKError, _a43 = symbol43, _b43) {
  constructor({
    approvalId,
    toolCallId,
    reason
  }) {
    super({
      name: name43,
      message: `Tool approval signature verification failed for approval "${approvalId}" (tool call "${toolCallId}"): ${reason}`
    });
    this[_a43] = true;
    this.approvalId = approvalId;
    this.toolCallId = toolCallId;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker43);
  }
};
var name53 = "AI_InvalidToolInputError";
var marker53 = `vercel.ai.error.${name53}`;
var symbol53 = Symbol.for(marker53);
var _a53;
var _b53;
var InvalidToolInputError = class extends (_b53 = AISDKError, _a53 = symbol53, _b53) {
  constructor({
    toolInput,
    toolName,
    cause,
    message = `Invalid input for tool ${toolName}: ${getErrorMessage(cause)}`
  }) {
    super({ name: name53, message, cause });
    this[_a53] = true;
    this.toolInput = toolInput;
    this.toolName = toolName;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker53);
  }
};
var name63 = "AI_ToolCallNotFoundForApprovalError";
var marker63 = `vercel.ai.error.${name63}`;
var symbol63 = Symbol.for(marker63);
var _a63;
var _b63;
var ToolCallNotFoundForApprovalError = class extends (_b63 = AISDKError, _a63 = symbol63, _b63) {
  constructor({
    toolCallId,
    approvalId
  }) {
    super({
      name: name63,
      message: `Tool call "${toolCallId}" not found for approval request "${approvalId}".`
    });
    this[_a63] = true;
    this.toolCallId = toolCallId;
    this.approvalId = approvalId;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker63);
  }
};
var name73 = "AI_MissingToolResultsError";
var marker73 = `vercel.ai.error.${name73}`;
var symbol73 = Symbol.for(marker73);
var _a73;
var _b73;
var MissingToolResultsError = class extends (_b73 = AISDKError, _a73 = symbol73, _b73) {
  constructor({ toolCallIds }) {
    super({
      name: name73,
      message: `Tool result${toolCallIds.length > 1 ? "s are" : " is"} missing for tool call${toolCallIds.length > 1 ? "s" : ""} ${toolCallIds.join(", ")}.`
    });
    this[_a73] = true;
    this.toolCallIds = toolCallIds;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker73);
  }
};
var name83 = "AI_NoImageGeneratedError";
var marker83 = `vercel.ai.error.${name83}`;
var symbol83 = Symbol.for(marker83);
var _a83;
var _b83;
var NoImageGeneratedError = class extends (_b83 = AISDKError, _a83 = symbol83, _b83) {
  constructor({
    message = "No image generated.",
    cause,
    calls,
    responses
  }) {
    super({ name: name83, message, cause });
    this[_a83] = true;
    this.calls = calls;
    this.responses = responses;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker83);
  }
};
var name93 = "AI_NoObjectGeneratedError";
var marker93 = `vercel.ai.error.${name93}`;
var symbol93 = Symbol.for(marker93);
var _a93;
var _b93;
var NoObjectGeneratedError = class extends (_b93 = AISDKError, _a93 = symbol93, _b93) {
  constructor({
    message = "No object generated.",
    cause,
    text: text2,
    response,
    usage,
    finishReason
  }) {
    super({ name: name93, message, cause });
    this[_a93] = true;
    this.text = text2;
    this.response = response;
    this.usage = usage;
    this.finishReason = finishReason;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker93);
  }
};
var name103 = "AI_NoOutputGeneratedError";
var marker103 = `vercel.ai.error.${name103}`;
var symbol103 = Symbol.for(marker103);
var _a103;
var _b103;
var NoOutputGeneratedError = class extends (_b103 = AISDKError, _a103 = symbol103, _b103) {
  constructor({
    message = "No output generated.",
    cause
  } = {}) {
    super({ name: name103, message, cause });
    this[_a103] = true;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker103);
  }
};
var name112 = "AI_NoSpeechGeneratedError";
var marker113 = `vercel.ai.error.${name112}`;
var symbol113 = Symbol.for(marker113);
var _a113;
var _b113;
var NoSpeechGeneratedError = class extends (_b113 = AISDKError, _a113 = symbol113, _b113) {
  constructor(options) {
    super({
      name: name112,
      message: "No speech audio generated."
    });
    this[_a113] = true;
    this.responses = options.responses;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker113);
  }
};
var name122 = "AI_NoTranscriptGeneratedError";
var marker122 = `vercel.ai.error.${name122}`;
var symbol122 = Symbol.for(marker122);
var _a122;
var _b122;
var NoTranscriptGeneratedError = class extends (_b122 = AISDKError, _a122 = symbol122, _b122) {
  constructor(options) {
    super({
      name: name122,
      message: "No transcript generated."
    });
    this[_a122] = true;
    this.responses = options.responses;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker122);
  }
};
var name132 = "AI_NoTranslationGeneratedError";
var marker132 = `vercel.ai.error.${name132}`;
var symbol132 = Symbol.for(marker132);
var _a132;
var _b132;
var NoTranslationGeneratedError = class extends (_b132 = AISDKError, _a132 = symbol132, _b132) {
  constructor(options) {
    super({
      name: name132,
      message: "No translation generated."
    });
    this[_a132] = true;
    this.response = options.response;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker132);
  }
};
var name142 = "AI_NoVideoGeneratedError";
var marker142 = `vercel.ai.error.${name142}`;
var symbol142 = Symbol.for(marker142);
var _a142;
var _b142;
var NoVideoGeneratedError = class extends (_b142 = AISDKError, _a142 = symbol142, _b142) {
  constructor({
    message = "No video generated.",
    cause,
    responses
  }) {
    super({ name: name142, message, cause });
    this[_a142] = true;
    this.responses = responses;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker142);
  }
  static isNoVideoGeneratedError(error) {
    return error instanceof Error && error.name === name142 && typeof error.responses !== "undefined" ? true : false;
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      stack: this.stack,
      cause: this.cause,
      responses: this.responses
    };
  }
};
var name152 = "AI_NoSuchToolError";
var marker152 = `vercel.ai.error.${name152}`;
var symbol152 = Symbol.for(marker152);
var _a152;
var _b152;
var NoSuchToolError = class extends (_b152 = AISDKError, _a152 = symbol152, _b152) {
  constructor({
    toolName,
    availableTools = undefined,
    message = `Model tried to call unavailable tool '${toolName}'. ${availableTools === undefined ? "No tools are available." : `Available tools: ${availableTools.join(", ")}.`}`
  }) {
    super({ name: name152, message });
    this[_a152] = true;
    this.toolName = toolName;
    this.availableTools = availableTools;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker152);
  }
};
var name162 = "AI_StreamProviderError";
var marker162 = `vercel.ai.error.${name162}`;
var symbol162 = Symbol.for(marker162);
var _a162;
var _b162;
var StreamProviderError = class extends (_b162 = AISDKError, _a162 = symbol162, _b162) {
  constructor({
    message,
    type,
    code,
    statusCode,
    isRetryable = isRetryableStatusCode(statusCode),
    data,
    cause
  }) {
    super({ name: name162, message, cause });
    this[_a162] = true;
    this.type = type;
    this.code = code;
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
    this.data = data;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker162);
  }
};
function isRetryableStatusCode(statusCode) {
  return statusCode != null && (statusCode === 408 || statusCode === 409 || statusCode === 429 || statusCode >= 500);
}
var name17 = "AI_ToolCallRepairError";
var marker172 = `vercel.ai.error.${name17}`;
var symbol172 = Symbol.for(marker172);
var _a172;
var _b172;
var ToolCallRepairError = class extends (_b172 = AISDKError, _a172 = symbol172, _b172) {
  constructor({
    cause,
    originalError,
    message = `Error repairing tool call: ${getErrorMessage(cause)}`
  }) {
    super({ name: name17, message, cause });
    this[_a172] = true;
    this.originalError = originalError;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker172);
  }
};
var name182 = "AI_ToolChoiceViolationError";
var marker18 = `vercel.ai.error.${name182}`;
var symbol18 = Symbol.for(marker18);
var _a18;
var _b18;
var ToolChoiceViolationError = class extends (_b18 = AISDKError, _a18 = symbol18, _b18) {
  constructor({
    toolChoice,
    finishReason,
    provider,
    modelId,
    content,
    message = toolChoice.type === "required" ? "Model response did not contain a tool call even though tool choice was required." : `Model response did not contain a call to the required tool '${toolChoice.toolName}'.`
  }) {
    super({ name: name182, message });
    this[_a18] = true;
    this.toolChoice = toolChoice;
    this.finishReason = finishReason;
    this.provider = provider;
    this.modelId = modelId;
    this.content = content;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker18);
  }
};
var UnsupportedModelVersionError = class extends AISDKError {
  constructor(options) {
    super({
      name: "AI_UnsupportedModelVersionError",
      message: `Unsupported model version ${options.version} for provider "${options.provider}" and model "${options.modelId}". AI SDK 5 only supports models that implement specification version "v2".`
    });
    this.version = options.version;
    this.provider = options.provider;
    this.modelId = options.modelId;
  }
};
var name192 = "AI_UIMessageStreamError";
var marker192 = `vercel.ai.error.${name192}`;
var symbol192 = Symbol.for(marker192);
var _a192;
var _b192;
var UIMessageStreamError = class extends (_b192 = AISDKError, _a192 = symbol192, _b192) {
  constructor({
    chunkType,
    chunkId,
    message
  }) {
    super({ name: name192, message });
    this[_a192] = true;
    this.chunkType = chunkType;
    this.chunkId = chunkId;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker192);
  }
};
var name20 = "AI_InvalidDataContentError";
var marker20 = `vercel.ai.error.${name20}`;
var symbol202 = Symbol.for(marker20);
var _a202;
var _b202;
var InvalidDataContentError = class extends (_b202 = AISDKError, _a202 = symbol202, _b202) {
  constructor({
    content,
    cause,
    message = `Invalid data content. Expected a base64 string, Uint8Array, ArrayBuffer, or Buffer, but got ${typeof content}.`
  }) {
    super({ name: name20, message, cause });
    this[_a202] = true;
    this.content = content;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker20);
  }
};
var name21 = "AI_InvalidMessageRoleError";
var marker21 = `vercel.ai.error.${name21}`;
var symbol21 = Symbol.for(marker21);
var _a212;
var _b21;
var InvalidMessageRoleError = class extends (_b21 = AISDKError, _a212 = symbol21, _b21) {
  constructor({
    role,
    message = `Invalid message role: '${role}'. Must be one of: "system", "user", "assistant", "tool".`
  }) {
    super({ name: name21, message });
    this[_a212] = true;
    this.role = role;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker21);
  }
};
var name222 = "AI_MessageConversionError";
var marker222 = `vercel.ai.error.${name222}`;
var symbol222 = Symbol.for(marker222);
var _a222;
var _b222;
var MessageConversionError = class extends (_b222 = AISDKError, _a222 = symbol222, _b222) {
  constructor({
    originalMessage,
    message
  }) {
    super({ name: name222, message });
    this[_a222] = true;
    this.originalMessage = originalMessage;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker222);
  }
};
var name232 = "AI_RetryError";
var marker232 = `vercel.ai.error.${name232}`;
var symbol232 = Symbol.for(marker232);
var _a232;
var _b232;
var RetryError = class extends (_b232 = AISDKError, _a232 = symbol232, _b232) {
  constructor({
    message,
    reason,
    errors: errors2
  }) {
    super({ name: name232, message });
    this[_a232] = true;
    this.reason = reason;
    this.errors = errors2;
    this.lastError = errors2[errors2.length - 1];
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker232);
  }
};
function formatWarning({
  warning,
  provider,
  model
}) {
  const scope = provider != null && model != null ? ` (${provider} / ${model})` : "";
  const prefix = `AI SDK Warning${scope}:`;
  switch (warning.type) {
    case "unsupported": {
      let message = `${prefix} The feature "${warning.feature}" is not supported.`;
      if (warning.details) {
        message += ` ${warning.details}`;
      }
      return message;
    }
    case "compatibility": {
      let message = `${prefix} The feature "${warning.feature}" is used in a compatibility mode.`;
      if (warning.details) {
        message += ` ${warning.details}`;
      }
      return message;
    }
    case "deprecated": {
      return `${prefix} Deprecated: "${warning.setting}". ${warning.message}`;
    }
    case "other": {
      return `${prefix} ${warning.message}`;
    }
    default: {
      return `${prefix} ${JSON.stringify(warning, null, 2)}`;
    }
  }
}
var FIRST_WARNING_INFO_MESSAGE = "AI SDK Warning System: To turn off warning logging, set the AI_SDK_LOG_WARNINGS global to false.";
var hasLoggedBefore = false;
function emitWarning({
  message,
  type
}) {
  if (typeof process !== "undefined" && typeof process.emitWarning === "function") {
    process.emitWarning(message, { type });
  } else {
    console.warn(message);
  }
}
var logWarnings = (options) => {
  if (options.warnings.length === 0) {
    return;
  }
  const logger = globalThis.AI_SDK_LOG_WARNINGS;
  if (logger === false) {
    return;
  }
  if (typeof logger === "function") {
    logger(options);
    return;
  }
  if (!hasLoggedBefore) {
    hasLoggedBefore = true;
    emitWarning({
      message: FIRST_WARNING_INFO_MESSAGE,
      type: "Warning"
    });
  }
  for (const warning of options.warnings) {
    const message = formatWarning({
      warning,
      provider: options.provider,
      model: options.model
    });
    emitWarning({
      message,
      type: warning.type === "deprecated" ? "DeprecationWarning" : "Warning"
    });
  }
};
function resolveEvaluationModel(model) {
  var _a252;
  if (typeof model === "string") {
    const provider = (_a252 = globalThis.AI_SDK_DEFAULT_PROVIDER) != null ? _a252 : gateway;
    if (typeof (provider == null ? undefined : provider.evaluationModel) !== "function") {
      throw new NoSuchModelError({
        modelId: model,
        modelType: "evaluationModel",
        message: "The default provider does not support evaluation models. Pass an evaluation model instance or configure AI_SDK_DEFAULT_PROVIDER with an evaluationModel method."
      });
    }
    const resolvedModel = provider.evaluationModel(model);
    if (resolvedModel == null) {
      throw new NoSuchModelError({
        modelId: model,
        modelType: "evaluationModel"
      });
    }
    model = resolvedModel;
  }
  if (model.specificationVersion !== "v4") {
    throw new UnsupportedModelVersionError({
      version: model.specificationVersion,
      provider: model.provider,
      modelId: model.modelId
    });
  }
  return model;
}
var VERSION3 = "7.0.106";
var download = async ({
  url,
  maxBytes,
  abortSignal
}) => {
  var _a252;
  const urlText = url.toString();
  try {
    const headers = withUserAgentSuffix({}, `ai-sdk/${VERSION3}`, getRuntimeEnvironmentUserAgent());
    const response = await fetchWithValidatedRedirects({
      url: urlText,
      headers,
      abortSignal
    });
    if (!response.ok) {
      await cancelResponseBody(response);
      throw new DownloadError({
        url: urlText,
        statusCode: response.status,
        statusText: response.statusText
      });
    }
    const data = await readResponseWithSizeLimit({
      response,
      url: urlText,
      maxBytes: maxBytes != null ? maxBytes : DEFAULT_MAX_DOWNLOAD_SIZE
    });
    return {
      data,
      mediaType: (_a252 = response.headers.get("content-type")) != null ? _a252 : undefined
    };
  } catch (error) {
    if (DownloadError.isInstance(error)) {
      throw error;
    }
    throw new DownloadError({ url: urlText, cause: error });
  }
};
var z2 = {
  array,
  boolean: boolean2,
  custom,
  discriminatedUnion,
  enum: _enum,
  instanceof: _instanceof,
  lazy,
  literal,
  looseObject,
  never,
  null: _null3,
  number: number2,
  object,
  record,
  string: string2,
  union,
  unknown
};
var jsonValueSchema = z2.lazy(() => z2.union([
  z2.null(),
  z2.string(),
  z2.number(),
  z2.boolean(),
  z2.record(z2.string(), jsonValueSchema.optional()),
  z2.array(jsonValueSchema)
]));
var providerMetadataSchema = z2.record(z2.string(), z2.record(z2.string(), jsonValueSchema.optional()));
var fileInlineDataSchema = z2.union([
  z2.string(),
  z2.instanceof(Uint8Array),
  z2.instanceof(ArrayBuffer),
  z2.custom(isBuffer, { message: "Must be a Buffer" })
]);
var providerReferenceSchema = z2.record(z2.string(), z2.string());
var textPartSchema = z2.object({
  type: z2.literal("text"),
  text: z2.string(),
  providerOptions: providerMetadataSchema.optional()
});
var imagePartSchema = z2.object({
  type: z2.literal("image"),
  image: z2.union([
    fileInlineDataSchema,
    z2.instanceof(URL),
    providerReferenceSchema
  ]),
  mediaType: z2.string().optional(),
  providerOptions: providerMetadataSchema.optional()
});
var taggedFileDataSchema = z2.discriminatedUnion("type", [
  z2.object({ type: z2.literal("data"), data: fileInlineDataSchema }),
  z2.object({ type: z2.literal("url"), url: z2.instanceof(URL) }),
  z2.object({
    type: z2.literal("reference"),
    reference: providerReferenceSchema
  }),
  z2.object({ type: z2.literal("text"), text: z2.string() })
]);
var taggedReasoningFileDataSchema = z2.discriminatedUnion("type", [
  z2.object({ type: z2.literal("data"), data: fileInlineDataSchema }),
  z2.object({ type: z2.literal("url"), url: z2.instanceof(URL) })
]);
var filePartSchema = z2.object({
  type: z2.literal("file"),
  data: z2.union([
    taggedFileDataSchema,
    fileInlineDataSchema,
    z2.instanceof(URL),
    providerReferenceSchema
  ]),
  filename: z2.string().optional(),
  mediaType: z2.string(),
  providerOptions: providerMetadataSchema.optional()
});
var reasoningPartSchema = z2.object({
  type: z2.literal("reasoning"),
  text: z2.string(),
  providerOptions: providerMetadataSchema.optional()
});
var customPartSchema = z2.object({
  type: z2.literal("custom"),
  kind: z2.string().transform((value) => value),
  providerOptions: providerMetadataSchema.optional()
});
var reasoningFilePartSchema = z2.object({
  type: z2.literal("reasoning-file"),
  data: z2.union([
    taggedReasoningFileDataSchema,
    fileInlineDataSchema,
    z2.instanceof(URL)
  ]),
  mediaType: z2.string(),
  providerOptions: providerMetadataSchema.optional()
});
var toolCallPartSchema = z2.object({
  type: z2.literal("tool-call"),
  toolCallId: z2.string(),
  toolName: z2.string(),
  input: z2.unknown(),
  providerOptions: providerMetadataSchema.optional(),
  providerExecuted: z2.boolean().optional()
});
var outputSchema = z2.discriminatedUnion("type", [
  z2.object({
    type: z2.literal("text"),
    value: z2.string(),
    providerOptions: providerMetadataSchema.optional()
  }),
  z2.object({
    type: z2.literal("json"),
    value: jsonValueSchema,
    providerOptions: providerMetadataSchema.optional()
  }),
  z2.object({
    type: z2.literal("execution-denied"),
    reason: z2.string().optional(),
    providerOptions: providerMetadataSchema.optional()
  }),
  z2.object({
    type: z2.literal("error-text"),
    value: z2.string(),
    providerOptions: providerMetadataSchema.optional()
  }),
  z2.object({
    type: z2.literal("error-json"),
    value: jsonValueSchema,
    providerOptions: providerMetadataSchema.optional()
  }),
  z2.object({
    type: z2.literal("content"),
    value: z2.array(z2.union([
      z2.object({
        type: z2.literal("text"),
        text: z2.string(),
        providerOptions: providerMetadataSchema.optional()
      }),
      z2.object({
        type: z2.literal("file"),
        data: taggedFileDataSchema,
        mediaType: z2.string(),
        filename: z2.string().optional(),
        providerOptions: providerMetadataSchema.optional()
      }),
      z2.object({
        type: z2.literal("file-data"),
        data: z2.string(),
        mediaType: z2.string(),
        filename: z2.string().optional(),
        providerOptions: providerMetadataSchema.optional()
      }),
      z2.object({
        type: z2.literal("file-url"),
        url: z2.string(),
        mediaType: z2.string().optional(),
        providerOptions: providerMetadataSchema.optional()
      }),
      z2.object({
        type: z2.literal("file-id"),
        fileId: z2.union([z2.string(), z2.record(z2.string(), z2.string())]),
        providerOptions: providerMetadataSchema.optional()
      }),
      z2.object({
        type: z2.literal("file-reference"),
        providerReference: z2.record(z2.string(), z2.string()),
        providerOptions: providerMetadataSchema.optional()
      }),
      z2.object({
        type: z2.literal("image-data"),
        data: z2.string(),
        mediaType: z2.string(),
        providerOptions: providerMetadataSchema.optional()
      }),
      z2.object({
        type: z2.literal("image-url"),
        url: z2.string(),
        providerOptions: providerMetadataSchema.optional()
      }),
      z2.object({
        type: z2.literal("image-file-id"),
        fileId: z2.union([z2.string(), z2.record(z2.string(), z2.string())]),
        providerOptions: providerMetadataSchema.optional()
      }),
      z2.object({
        type: z2.literal("image-file-reference"),
        providerReference: z2.record(z2.string(), z2.string()),
        providerOptions: providerMetadataSchema.optional()
      }),
      z2.object({
        type: z2.literal("custom"),
        providerOptions: providerMetadataSchema.optional()
      })
    ]))
  })
]);
var toolResultPartSchema = z2.object({
  type: z2.literal("tool-result"),
  toolCallId: z2.string(),
  toolName: z2.string(),
  output: outputSchema,
  providerOptions: providerMetadataSchema.optional()
});
var toolApprovalRequestSchema = z2.object({
  type: z2.literal("tool-approval-request"),
  approvalId: z2.string(),
  toolCallId: z2.string(),
  reason: z2.string().optional()
});
var toolApprovalResponseSchema = z2.object({
  type: z2.literal("tool-approval-response"),
  approvalId: z2.string(),
  approved: z2.boolean(),
  reason: z2.string().optional()
});
var systemModelMessageSchema = z2.object({
  role: z2.literal("system"),
  content: z2.string(),
  providerOptions: providerMetadataSchema.optional()
});
var userModelMessageSchema = z2.object({
  role: z2.literal("user"),
  content: z2.union([
    z2.string(),
    z2.array(z2.union([textPartSchema, imagePartSchema, filePartSchema]))
  ]),
  providerOptions: providerMetadataSchema.optional()
});
var assistantModelMessageSchema = z2.object({
  role: z2.literal("assistant"),
  content: z2.union([
    z2.string(),
    z2.array(z2.union([
      textPartSchema,
      customPartSchema,
      filePartSchema,
      reasoningPartSchema,
      reasoningFilePartSchema,
      toolCallPartSchema,
      toolResultPartSchema,
      toolApprovalRequestSchema
    ]))
  ]),
  providerOptions: providerMetadataSchema.optional()
});
var toolModelMessageSchema = z2.object({
  role: z2.literal("tool"),
  content: z2.array(z2.union([toolResultPartSchema, toolApprovalResponseSchema])),
  providerOptions: providerMetadataSchema.optional()
});
var modelMessageSchema = z2.union([
  systemModelMessageSchema,
  userModelMessageSchema,
  assistantModelMessageSchema,
  toolModelMessageSchema
]);
function getRetryDelayInMs({
  error,
  exponentialBackoffDelay
}) {
  const headers = APICallError.isInstance(error) ? error.responseHeaders : APICallError.isInstance(error.cause) ? error.cause.responseHeaders : undefined;
  if (!headers)
    return exponentialBackoffDelay;
  let ms;
  const retryAfterMs = headers["retry-after-ms"];
  if (retryAfterMs) {
    const timeoutMs = parseFloat(retryAfterMs);
    if (!Number.isNaN(timeoutMs)) {
      ms = timeoutMs;
    }
  }
  const retryAfter = headers["retry-after"];
  if (retryAfter && ms === undefined) {
    const timeoutSeconds = parseFloat(retryAfter);
    if (!Number.isNaN(timeoutSeconds)) {
      ms = timeoutSeconds * 1000;
    } else {
      ms = Date.parse(retryAfter) - Date.now();
    }
  }
  if (ms != null && !Number.isNaN(ms) && 0 <= ms && (ms < 60 * 1000 || ms < exponentialBackoffDelay)) {
    return ms;
  }
  return exponentialBackoffDelay;
}
var retryWithExponentialBackoffRespectingRetryHeaders = ({
  maxRetries = 2,
  initialDelayInMs = 2000,
  backoffFactor = 2,
  abortSignal,
  additionalRetryableError
} = {}) => retryWithExponentialBackoff({
  maxRetries,
  initialDelayInMs,
  backoffFactor,
  abortSignal,
  shouldRetry: async (error) => error instanceof Error && (APICallError.isInstance(error) && error.isRetryable === true || GatewayError.isInstance(error) && error.isRetryable === true) || additionalRetryableError != null && await additionalRetryableError(error),
  getDelayInMs: ({ error, exponentialBackoffDelay }) => getRetryDelayInMs({
    error,
    exponentialBackoffDelay
  }),
  createRetryError: ({ message, reason, errors: errors2 }) => new RetryError({ message, reason, errors: errors2 })
});
function prepareRetries({
  maxRetries,
  abortSignal,
  additionalRetryableError,
  parameter = "maxRetries",
  defaultMaxRetries = 2
}) {
  if (maxRetries != null) {
    if (!Number.isInteger(maxRetries)) {
      throw new InvalidArgumentError2({
        parameter,
        value: maxRetries,
        message: `${parameter} must be an integer`
      });
    }
    if (maxRetries < 0) {
      throw new InvalidArgumentError2({
        parameter,
        value: maxRetries,
        message: `${parameter} must be >= 0`
      });
    }
  }
  const maxRetriesResult = maxRetries != null ? maxRetries : defaultMaxRetries;
  return {
    maxRetries: maxRetriesResult,
    retry: retryWithExponentialBackoffRespectingRetryHeaders({
      maxRetries: maxRetriesResult,
      abortSignal,
      additionalRetryableError
    })
  };
}
var output_exports = {};
__export2(output_exports, {
  array: () => array2,
  choice: () => choice,
  json: () => json,
  object: () => object2,
  text: () => text
});
function fixJson(input) {
  const stack = ["ROOT"];
  let lastValidIndex = -1;
  let literalStart = null;
  let unicodeEscapeDigits = 0;
  function isHexDigit(char) {
    return char >= "0" && char <= "9" || char >= "A" && char <= "F" || char >= "a" && char <= "f";
  }
  function processValueStart(char, i, swapState) {
    {
      switch (char) {
        case '"': {
          lastValidIndex = i;
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_STRING");
          break;
        }
        case "f":
        case "t":
        case "n": {
          lastValidIndex = i;
          literalStart = i;
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_LITERAL");
          break;
        }
        case "-": {
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_NUMBER");
          break;
        }
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9": {
          lastValidIndex = i;
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_NUMBER");
          break;
        }
        case "{": {
          lastValidIndex = i;
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_OBJECT_START");
          break;
        }
        case "[": {
          lastValidIndex = i;
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_ARRAY_START");
          break;
        }
      }
    }
  }
  function processAfterObjectValue(char, i) {
    switch (char) {
      case ",": {
        stack.pop();
        stack.push("INSIDE_OBJECT_AFTER_COMMA");
        break;
      }
      case "}": {
        lastValidIndex = i;
        stack.pop();
        break;
      }
    }
  }
  function processAfterArrayValue(char, i) {
    switch (char) {
      case ",": {
        stack.pop();
        stack.push("INSIDE_ARRAY_AFTER_COMMA");
        break;
      }
      case "]": {
        lastValidIndex = i;
        stack.pop();
        break;
      }
    }
  }
  for (let i = 0;i < input.length; i++) {
    const char = input[i];
    const currentState = stack[stack.length - 1];
    switch (currentState) {
      case "ROOT":
        processValueStart(char, i, "FINISH");
        break;
      case "INSIDE_OBJECT_START": {
        switch (char) {
          case '"': {
            stack.pop();
            stack.push("INSIDE_OBJECT_KEY");
            break;
          }
          case "}": {
            lastValidIndex = i;
            stack.pop();
            break;
          }
        }
        break;
      }
      case "INSIDE_OBJECT_AFTER_COMMA": {
        switch (char) {
          case '"': {
            stack.pop();
            stack.push("INSIDE_OBJECT_KEY");
            break;
          }
        }
        break;
      }
      case "INSIDE_OBJECT_KEY": {
        switch (char) {
          case '"': {
            stack.pop();
            stack.push("INSIDE_OBJECT_AFTER_KEY");
            break;
          }
        }
        break;
      }
      case "INSIDE_OBJECT_AFTER_KEY": {
        switch (char) {
          case ":": {
            stack.pop();
            stack.push("INSIDE_OBJECT_BEFORE_VALUE");
            break;
          }
        }
        break;
      }
      case "INSIDE_OBJECT_BEFORE_VALUE": {
        processValueStart(char, i, "INSIDE_OBJECT_AFTER_VALUE");
        break;
      }
      case "INSIDE_OBJECT_AFTER_VALUE": {
        processAfterObjectValue(char, i);
        break;
      }
      case "INSIDE_STRING": {
        switch (char) {
          case '"': {
            stack.pop();
            lastValidIndex = i;
            break;
          }
          case "\\": {
            stack.push("INSIDE_STRING_ESCAPE");
            break;
          }
          default: {
            lastValidIndex = i;
          }
        }
        break;
      }
      case "INSIDE_ARRAY_START": {
        switch (char) {
          case "]": {
            lastValidIndex = i;
            stack.pop();
            break;
          }
          default: {
            lastValidIndex = i;
            processValueStart(char, i, "INSIDE_ARRAY_AFTER_VALUE");
            break;
          }
        }
        break;
      }
      case "INSIDE_ARRAY_AFTER_VALUE": {
        switch (char) {
          case ",": {
            stack.pop();
            stack.push("INSIDE_ARRAY_AFTER_COMMA");
            break;
          }
          case "]": {
            lastValidIndex = i;
            stack.pop();
            break;
          }
          default: {
            lastValidIndex = i;
            break;
          }
        }
        break;
      }
      case "INSIDE_ARRAY_AFTER_COMMA": {
        processValueStart(char, i, "INSIDE_ARRAY_AFTER_VALUE");
        break;
      }
      case "INSIDE_STRING_ESCAPE": {
        stack.pop();
        if (char === "u") {
          unicodeEscapeDigits = 0;
          stack.push("INSIDE_STRING_UNICODE_ESCAPE");
        } else {
          lastValidIndex = i;
        }
        break;
      }
      case "INSIDE_STRING_UNICODE_ESCAPE": {
        if (isHexDigit(char)) {
          unicodeEscapeDigits++;
          if (unicodeEscapeDigits === 4) {
            stack.pop();
            lastValidIndex = i;
          }
        }
        break;
      }
      case "INSIDE_NUMBER": {
        switch (char) {
          case "0":
          case "1":
          case "2":
          case "3":
          case "4":
          case "5":
          case "6":
          case "7":
          case "8":
          case "9": {
            lastValidIndex = i;
            break;
          }
          case "e":
          case "E":
          case "-":
          case ".": {
            break;
          }
          case ",": {
            stack.pop();
            if (stack[stack.length - 1] === "INSIDE_ARRAY_AFTER_VALUE") {
              processAfterArrayValue(char, i);
            }
            if (stack[stack.length - 1] === "INSIDE_OBJECT_AFTER_VALUE") {
              processAfterObjectValue(char, i);
            }
            break;
          }
          case "}": {
            stack.pop();
            if (stack[stack.length - 1] === "INSIDE_OBJECT_AFTER_VALUE") {
              processAfterObjectValue(char, i);
            }
            break;
          }
          case "]": {
            stack.pop();
            if (stack[stack.length - 1] === "INSIDE_ARRAY_AFTER_VALUE") {
              processAfterArrayValue(char, i);
            }
            break;
          }
          default: {
            stack.pop();
            break;
          }
        }
        break;
      }
      case "INSIDE_LITERAL": {
        const partialLiteral = input.substring(literalStart, i + 1);
        if (!"false".startsWith(partialLiteral) && !"true".startsWith(partialLiteral) && !"null".startsWith(partialLiteral)) {
          stack.pop();
          if (stack[stack.length - 1] === "INSIDE_OBJECT_AFTER_VALUE") {
            processAfterObjectValue(char, i);
          } else if (stack[stack.length - 1] === "INSIDE_ARRAY_AFTER_VALUE") {
            processAfterArrayValue(char, i);
          }
        } else {
          lastValidIndex = i;
        }
        break;
      }
    }
  }
  let result = input.slice(0, lastValidIndex + 1);
  for (let i = stack.length - 1;i >= 0; i--) {
    const state = stack[i];
    switch (state) {
      case "INSIDE_STRING": {
        result += '"';
        break;
      }
      case "INSIDE_OBJECT_KEY":
      case "INSIDE_OBJECT_AFTER_KEY":
      case "INSIDE_OBJECT_AFTER_COMMA":
      case "INSIDE_OBJECT_START":
      case "INSIDE_OBJECT_BEFORE_VALUE":
      case "INSIDE_OBJECT_AFTER_VALUE": {
        result += "}";
        break;
      }
      case "INSIDE_ARRAY_START":
      case "INSIDE_ARRAY_AFTER_COMMA":
      case "INSIDE_ARRAY_AFTER_VALUE": {
        result += "]";
        break;
      }
      case "INSIDE_LITERAL": {
        const partialLiteral = input.substring(literalStart, input.length);
        if ("true".startsWith(partialLiteral)) {
          result += "true".slice(partialLiteral.length);
        } else if ("false".startsWith(partialLiteral)) {
          result += "false".slice(partialLiteral.length);
        } else if ("null".startsWith(partialLiteral)) {
          result += "null".slice(partialLiteral.length);
        }
      }
    }
  }
  return result;
}
async function parsePartialJson(jsonText) {
  if (jsonText === undefined) {
    return { value: undefined, state: "undefined-input" };
  }
  let result = await safeParseJSON({ text: jsonText });
  if (result.success) {
    return { value: result.value, state: "successful-parse" };
  }
  result = await safeParseJSON({ text: fixJson(jsonText) });
  if (result.success) {
    return { value: result.value, state: "repaired-parse" };
  }
  return { value: undefined, state: "failed-parse" };
}
var text = () => ({
  name: "text",
  responseFormat: Promise.resolve({ type: "text" }),
  async parseCompleteOutput({ text: text2 }) {
    return text2;
  },
  async parsePartialOutput({ text: text2 }) {
    return { partial: text2 };
  },
  createElementStreamTransform() {
    return;
  }
});
var object2 = ({
  schema: inputSchema,
  name: name25,
  description
}) => {
  const schema = asSchema(inputSchema);
  return {
    name: "object",
    responseFormat: resolve(schema.jsonSchema).then((jsonSchema3) => ({
      type: "json",
      schema: jsonSchema3,
      ...name25 != null && { name: name25 },
      ...description != null && { description }
    })),
    async parseCompleteOutput({ text: text2 }, context) {
      const parseResult = await safeParseJSON({ text: text2 });
      if (!parseResult.success) {
        throw new NoObjectGeneratedError({
          message: "No object generated: could not parse the response.",
          cause: parseResult.error,
          text: text2,
          response: context.response,
          usage: context.usage,
          finishReason: context.finishReason
        });
      }
      const validationResult = await safeValidateTypes({
        value: parseResult.value,
        schema
      });
      if (!validationResult.success) {
        throw new NoObjectGeneratedError({
          message: "No object generated: response did not match schema.",
          cause: validationResult.error,
          text: text2,
          response: context.response,
          usage: context.usage,
          finishReason: context.finishReason
        });
      }
      return validationResult.value;
    },
    async parsePartialOutput({ text: text2 }) {
      const result = await parsePartialJson(text2);
      switch (result.state) {
        case "failed-parse":
        case "undefined-input": {
          return;
        }
        case "repaired-parse":
        case "successful-parse": {
          return {
            partial: result.value
          };
        }
      }
    },
    createElementStreamTransform() {
      return;
    }
  };
};
var array2 = ({
  element: inputElementSchema,
  minItems,
  maxItems,
  name: name25,
  description
}) => {
  validateArrayBound({ name: "minItems", value: minItems });
  validateArrayBound({ name: "maxItems", value: maxItems });
  if (minItems != null && maxItems != null && minItems > maxItems) {
    throw new InvalidArgumentError2({
      parameter: "minItems",
      value: minItems,
      message: "minItems must be less than or equal to maxItems"
    });
  }
  const elementSchema = asSchema(inputElementSchema);
  return {
    name: "array",
    responseFormat: resolve(elementSchema.jsonSchema).then((jsonSchema3) => {
      const {
        $schema: _$schema,
        definitions,
        $defs,
        ...itemSchema
      } = jsonSchema3;
      return {
        type: "json",
        schema: {
          $schema: "http://json-schema.org/draft-07/schema#",
          ...definitions != null && { definitions },
          ...$defs != null && { $defs },
          type: "object",
          properties: {
            elements: {
              type: "array",
              items: itemSchema,
              ...minItems != null && { minItems },
              ...maxItems != null && { maxItems }
            }
          },
          required: ["elements"],
          additionalProperties: false
        },
        ...name25 != null && { name: name25 },
        ...description != null && { description }
      };
    }),
    async parseCompleteOutput({ text: text2 }, context) {
      const parseResult = await safeParseJSON({ text: text2 });
      if (!parseResult.success) {
        throw new NoObjectGeneratedError({
          message: "No object generated: could not parse the response.",
          cause: parseResult.error,
          text: text2,
          response: context.response,
          usage: context.usage,
          finishReason: context.finishReason
        });
      }
      const outerValue = parseResult.value;
      if (outerValue == null || typeof outerValue !== "object" || !("elements" in outerValue) || !Array.isArray(outerValue.elements)) {
        throw new NoObjectGeneratedError({
          message: "No object generated: response did not match schema.",
          cause: new TypeValidationError({
            value: outerValue,
            cause: "response must be an object with an elements array"
          }),
          text: text2,
          response: context.response,
          usage: context.usage,
          finishReason: context.finishReason
        });
      }
      const lengthValidationError = getArrayLengthValidationError({
        value: outerValue.elements,
        minItems,
        maxItems
      });
      if (lengthValidationError != null) {
        throw new NoObjectGeneratedError({
          message: "No object generated: response did not match schema.",
          cause: lengthValidationError,
          text: text2,
          response: context.response,
          usage: context.usage,
          finishReason: context.finishReason
        });
      }
      const validatedElements = [];
      for (const element of outerValue.elements) {
        const validationResult = await safeValidateTypes({
          value: element,
          schema: elementSchema
        });
        if (!validationResult.success) {
          throw new NoObjectGeneratedError({
            message: "No object generated: response did not match schema.",
            cause: validationResult.error,
            text: text2,
            response: context.response,
            usage: context.usage,
            finishReason: context.finishReason
          });
        }
        validatedElements.push(validationResult.value);
      }
      return validatedElements;
    },
    async parsePartialOutput({ text: text2 }) {
      const result = await parsePartialJson(text2);
      switch (result.state) {
        case "failed-parse":
        case "undefined-input": {
          return;
        }
        case "repaired-parse":
        case "successful-parse": {
          const outerValue = result.value;
          if (outerValue == null || typeof outerValue !== "object" || !("elements" in outerValue) || !Array.isArray(outerValue.elements)) {
            return;
          }
          const rawElements = result.state === "repaired-parse" && outerValue.elements.length > 0 ? outerValue.elements.slice(0, -1) : outerValue.elements;
          const parsedElements = [];
          for (const rawElement of rawElements) {
            const validationResult = await safeValidateTypes({
              value: rawElement,
              schema: elementSchema
            });
            if (validationResult.success) {
              parsedElements.push(validationResult.value);
            }
          }
          return { partial: parsedElements };
        }
      }
    },
    createElementStreamTransform() {
      let publishedElements = 0;
      return new TransformStream({
        transform({ partialOutput }, controller) {
          if (partialOutput != null) {
            for (;publishedElements < partialOutput.length; publishedElements++) {
              if (maxItems != null && publishedElements >= maxItems) {
                controller.error(getArrayLengthValidationError({
                  value: partialOutput,
                  maxItems
                }));
                return;
              }
              controller.enqueue(partialOutput[publishedElements]);
            }
          }
        }
      });
    }
  };
};
function validateArrayBound({
  name: name25,
  value
}) {
  if (value == null) {
    return;
  }
  if (!Number.isInteger(value)) {
    throw new InvalidArgumentError2({
      parameter: name25,
      value,
      message: `${name25} must be an integer`
    });
  }
  if (value < 0) {
    throw new InvalidArgumentError2({
      parameter: name25,
      value,
      message: `${name25} must be greater than or equal to 0`
    });
  }
}
function getArrayLengthValidationError({
  value,
  minItems,
  maxItems
}) {
  if (minItems != null && value.length < minItems) {
    return new TypeValidationError({
      value,
      cause: `elements array must contain at least ${minItems} items`
    });
  }
  if (maxItems != null && value.length > maxItems) {
    return new TypeValidationError({
      value,
      cause: `elements array must contain at most ${maxItems} items`
    });
  }
  return;
}
var choice = ({
  options: choiceOptions,
  name: name25,
  description
}) => {
  return {
    name: "choice",
    responseFormat: Promise.resolve({
      type: "json",
      schema: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties: {
          result: { type: "string", enum: choiceOptions }
        },
        required: ["result"],
        additionalProperties: false
      },
      ...name25 != null && { name: name25 },
      ...description != null && { description }
    }),
    async parseCompleteOutput({ text: text2 }, context) {
      const parseResult = await safeParseJSON({ text: text2 });
      if (!parseResult.success) {
        throw new NoObjectGeneratedError({
          message: "No object generated: could not parse the response.",
          cause: parseResult.error,
          text: text2,
          response: context.response,
          usage: context.usage,
          finishReason: context.finishReason
        });
      }
      const outerValue = parseResult.value;
      if (outerValue == null || typeof outerValue !== "object" || !("result" in outerValue) || typeof outerValue.result !== "string" || !choiceOptions.includes(outerValue.result)) {
        throw new NoObjectGeneratedError({
          message: "No object generated: response did not match schema.",
          cause: new TypeValidationError({
            value: outerValue,
            cause: "response must be an object that contains a choice value."
          }),
          text: text2,
          response: context.response,
          usage: context.usage,
          finishReason: context.finishReason
        });
      }
      return outerValue.result;
    },
    async parsePartialOutput({ text: text2 }) {
      const result = await parsePartialJson(text2);
      switch (result.state) {
        case "failed-parse":
        case "undefined-input": {
          return;
        }
        case "repaired-parse":
        case "successful-parse": {
          const outerValue = result.value;
          if (outerValue == null || typeof outerValue !== "object" || !("result" in outerValue) || typeof outerValue.result !== "string") {
            return;
          }
          const potentialMatches = choiceOptions.filter((choiceOption) => choiceOption.startsWith(outerValue.result));
          if (result.state === "successful-parse") {
            return potentialMatches.includes(outerValue.result) ? { partial: outerValue.result } : undefined;
          } else {
            return potentialMatches.length === 1 ? { partial: potentialMatches[0] } : undefined;
          }
        }
      }
    },
    createElementStreamTransform() {
      return;
    }
  };
};
var json = ({
  name: name25,
  description
} = {}) => {
  return {
    name: "json",
    responseFormat: Promise.resolve({
      type: "json",
      ...name25 != null && { name: name25 },
      ...description != null && { description }
    }),
    async parseCompleteOutput({ text: text2 }, context) {
      const parseResult = await safeParseJSON({ text: text2 });
      if (!parseResult.success) {
        throw new NoObjectGeneratedError({
          message: "No object generated: could not parse the response.",
          cause: parseResult.error,
          text: text2,
          response: context.response,
          usage: context.usage,
          finishReason: context.finishReason
        });
      }
      return parseResult.value;
    },
    async parsePartialOutput({ text: text2 }) {
      const result = await parsePartialJson(text2);
      switch (result.state) {
        case "failed-parse":
        case "undefined-input": {
          return;
        }
        case "repaired-parse":
        case "successful-parse": {
          return result.value === undefined ? undefined : { partial: result.value };
        }
      }
    },
    createElementStreamTransform() {
      return;
    }
  };
};
var encoder = new TextEncoder;
var encoder2 = new TextEncoder;
var originalGenerateId = createIdGenerator({
  prefix: "aitxt",
  size: 24
});
var originalGenerateCallId = createIdGenerator({
  prefix: "call",
  size: 24
});
var JsonToSseTransformStream = class extends TransformStream {
  constructor() {
    super({
      transform(part, controller) {
        controller.enqueue(`data: ${JSON.stringify(part)}

`);
      },
      flush(controller) {
        controller.enqueue(`data: [DONE]

`);
      }
    });
  }
};
var toolMetadataSchema = z2.record(z2.string(), jsonValueSchema.optional());
var uiMessageChunkSchema = lazySchema(() => zodSchema(z2.union([
  z2.looseObject({
    type: z2.literal("text-start"),
    id: z2.string(),
    providerMetadata: providerMetadataSchema.optional()
  }),
  z2.looseObject({
    type: z2.literal("text-delta"),
    id: z2.string(),
    delta: z2.string(),
    providerMetadata: providerMetadataSchema.optional()
  }),
  z2.looseObject({
    type: z2.literal("text-end"),
    id: z2.string(),
    providerMetadata: providerMetadataSchema.optional()
  }),
  z2.looseObject({
    type: z2.literal("error"),
    errorText: z2.string()
  }),
  z2.looseObject({
    type: z2.literal("tool-input-start"),
    toolCallId: z2.string(),
    toolName: z2.string(),
    providerExecuted: z2.boolean().optional(),
    providerMetadata: providerMetadataSchema.optional(),
    toolMetadata: toolMetadataSchema.optional(),
    dynamic: z2.boolean().optional(),
    title: z2.string().optional()
  }),
  z2.looseObject({
    type: z2.literal("tool-input-delta"),
    toolCallId: z2.string(),
    inputTextDelta: z2.string()
  }),
  z2.looseObject({
    type: z2.literal("tool-input-available"),
    toolCallId: z2.string(),
    toolName: z2.string(),
    input: z2.unknown(),
    providerExecuted: z2.boolean().optional(),
    providerMetadata: providerMetadataSchema.optional(),
    toolMetadata: toolMetadataSchema.optional(),
    dynamic: z2.boolean().optional(),
    title: z2.string().optional()
  }),
  z2.looseObject({
    type: z2.literal("tool-input-error"),
    toolCallId: z2.string(),
    toolName: z2.string(),
    input: z2.unknown(),
    providerExecuted: z2.boolean().optional(),
    providerMetadata: providerMetadataSchema.optional(),
    toolMetadata: toolMetadataSchema.optional(),
    dynamic: z2.boolean().optional(),
    errorText: z2.string(),
    title: z2.string().optional()
  }),
  z2.looseObject({
    type: z2.literal("tool-approval-request"),
    approvalId: z2.string(),
    toolCallId: z2.string(),
    approvalDescriptor: z2.unknown().optional(),
    reason: z2.string().optional(),
    isAutomatic: z2.boolean().optional(),
    signature: z2.string().optional()
  }),
  z2.looseObject({
    type: z2.literal("tool-approval-response"),
    approvalId: z2.string(),
    approved: z2.boolean(),
    reason: z2.string().optional(),
    providerExecuted: z2.boolean().optional(),
    providerMetadata: providerMetadataSchema.optional()
  }),
  z2.looseObject({
    type: z2.literal("tool-output-available"),
    toolCallId: z2.string(),
    output: z2.unknown(),
    providerExecuted: z2.boolean().optional(),
    providerMetadata: providerMetadataSchema.optional(),
    toolMetadata: toolMetadataSchema.optional(),
    dynamic: z2.boolean().optional(),
    preliminary: z2.boolean().optional()
  }),
  z2.looseObject({
    type: z2.literal("tool-output-error"),
    toolCallId: z2.string(),
    errorText: z2.string(),
    providerExecuted: z2.boolean().optional(),
    providerMetadata: providerMetadataSchema.optional(),
    toolMetadata: toolMetadataSchema.optional(),
    dynamic: z2.boolean().optional()
  }),
  z2.looseObject({
    type: z2.literal("tool-output-denied"),
    toolCallId: z2.string()
  }),
  z2.looseObject({
    type: z2.literal("reasoning-start"),
    id: z2.string(),
    providerMetadata: providerMetadataSchema.optional()
  }),
  z2.looseObject({
    type: z2.literal("reasoning-delta"),
    id: z2.string(),
    delta: z2.string(),
    providerMetadata: providerMetadataSchema.optional()
  }),
  z2.looseObject({
    type: z2.literal("reasoning-end"),
    id: z2.string(),
    providerMetadata: providerMetadataSchema.optional()
  }),
  z2.looseObject({
    type: z2.literal("custom"),
    kind: z2.string().transform((value) => value),
    providerMetadata: providerMetadataSchema.optional()
  }),
  z2.looseObject({
    type: z2.literal("source-url"),
    sourceId: z2.string(),
    url: z2.string(),
    title: z2.string().optional(),
    providerMetadata: providerMetadataSchema.optional()
  }),
  z2.looseObject({
    type: z2.literal("source-document"),
    sourceId: z2.string(),
    mediaType: z2.string(),
    title: z2.string(),
    filename: z2.string().optional(),
    providerMetadata: providerMetadataSchema.optional()
  }),
  z2.looseObject({
    type: z2.literal("file"),
    url: z2.string(),
    mediaType: z2.string(),
    providerMetadata: providerMetadataSchema.optional()
  }),
  z2.looseObject({
    type: z2.literal("reasoning-file"),
    url: z2.string(),
    mediaType: z2.string(),
    providerMetadata: providerMetadataSchema.optional()
  }),
  z2.looseObject({
    type: z2.custom((value) => typeof value === "string" && value.startsWith("data-"), { message: 'Type must start with "data-"' }),
    id: z2.string().optional(),
    data: z2.unknown(),
    transient: z2.boolean().optional()
  }),
  z2.looseObject({
    type: z2.literal("start-step")
  }),
  z2.looseObject({
    type: z2.literal("finish-step")
  }),
  z2.looseObject({
    type: z2.literal("reset-step")
  }),
  z2.looseObject({
    type: z2.literal("start"),
    messageId: z2.string().optional(),
    messageMetadata: z2.unknown().optional()
  }),
  z2.looseObject({
    type: z2.literal("finish"),
    finishReason: z2.enum([
      "stop",
      "length",
      "content-filter",
      "tool-calls",
      "error",
      "other"
    ]).optional(),
    messageMetadata: z2.unknown().optional()
  }),
  z2.looseObject({
    type: z2.literal("abort"),
    reason: z2.string().optional()
  }),
  z2.looseObject({
    type: z2.literal("message-metadata"),
    messageMetadata: z2.unknown()
  })
])));
var originalGenerateId2 = createIdGenerator({
  prefix: "aitxt",
  size: 24
});
var originalGenerateCallId2 = createIdGenerator({
  prefix: "call",
  size: 24
});
var originalGenerateId3 = createIdGenerator({
  prefix: "aitxt",
  size: 24
});
var originalGenerateCallId3 = createIdGenerator({
  prefix: "call",
  size: 24
});
var toolMetadataSchema2 = z2.record(z2.string(), jsonValueSchema.optional());
var providerReferenceSchema2 = z2.record(z2.string(), z2.string());
var uiMessagesSchema = lazySchema(() => zodSchema(z2.array(z2.object({
  id: z2.string(),
  role: z2.enum(["system", "user", "assistant"]),
  metadata: z2.unknown().optional(),
  parts: z2.array(z2.union([
    z2.object({
      type: z2.literal("text"),
      text: z2.string(),
      state: z2.enum(["streaming", "done"]).optional(),
      providerMetadata: providerMetadataSchema.optional()
    }),
    z2.object({
      type: z2.literal("reasoning"),
      id: z2.string().optional(),
      text: z2.string(),
      state: z2.enum(["streaming", "done"]).optional(),
      providerMetadata: providerMetadataSchema.optional()
    }),
    z2.object({
      type: z2.literal("custom"),
      kind: z2.string(),
      providerMetadata: providerMetadataSchema.optional()
    }),
    z2.object({
      type: z2.literal("source-url"),
      sourceId: z2.string(),
      url: z2.string(),
      title: z2.string().optional(),
      providerMetadata: providerMetadataSchema.optional()
    }),
    z2.object({
      type: z2.literal("source-document"),
      sourceId: z2.string(),
      mediaType: z2.string(),
      title: z2.string(),
      filename: z2.string().optional(),
      providerMetadata: providerMetadataSchema.optional()
    }),
    z2.object({
      type: z2.literal("file"),
      mediaType: z2.string(),
      filename: z2.string().optional(),
      url: z2.string(),
      providerReference: providerReferenceSchema2.optional(),
      providerMetadata: providerMetadataSchema.optional()
    }),
    z2.object({
      type: z2.literal("reasoning-file"),
      mediaType: z2.string(),
      url: z2.string(),
      providerMetadata: providerMetadataSchema.optional()
    }),
    z2.object({
      type: z2.literal("step-start")
    }),
    z2.object({
      type: z2.string().startsWith("data-"),
      id: z2.string().optional(),
      data: z2.unknown()
    }),
    z2.object({
      type: z2.literal("dynamic-tool"),
      toolName: z2.string(),
      toolCallId: z2.string(),
      title: z2.string().optional(),
      toolMetadata: toolMetadataSchema2.optional(),
      state: z2.literal("input-streaming"),
      input: z2.unknown().optional(),
      providerExecuted: z2.boolean().optional(),
      callProviderMetadata: providerMetadataSchema.optional(),
      output: z2.never().optional(),
      errorText: z2.never().optional(),
      approval: z2.never().optional()
    }),
    z2.object({
      type: z2.literal("dynamic-tool"),
      toolName: z2.string(),
      toolCallId: z2.string(),
      title: z2.string().optional(),
      toolMetadata: toolMetadataSchema2.optional(),
      state: z2.literal("input-available"),
      input: z2.unknown(),
      providerExecuted: z2.boolean().optional(),
      output: z2.never().optional(),
      errorText: z2.never().optional(),
      callProviderMetadata: providerMetadataSchema.optional(),
      approval: z2.never().optional()
    }),
    z2.object({
      type: z2.literal("dynamic-tool"),
      toolName: z2.string(),
      toolCallId: z2.string(),
      title: z2.string().optional(),
      toolMetadata: toolMetadataSchema2.optional(),
      state: z2.literal("approval-requested"),
      input: z2.unknown(),
      providerExecuted: z2.boolean().optional(),
      output: z2.never().optional(),
      errorText: z2.never().optional(),
      callProviderMetadata: providerMetadataSchema.optional(),
      approval: z2.object({
        id: z2.string(),
        approved: z2.never().optional(),
        descriptor: z2.unknown().optional(),
        requestReason: z2.string().optional(),
        reason: z2.never().optional(),
        isAutomatic: z2.boolean().optional(),
        signature: z2.string().optional()
      })
    }),
    z2.object({
      type: z2.literal("dynamic-tool"),
      toolName: z2.string(),
      toolCallId: z2.string(),
      title: z2.string().optional(),
      toolMetadata: toolMetadataSchema2.optional(),
      state: z2.literal("approval-responded"),
      input: z2.unknown(),
      providerExecuted: z2.boolean().optional(),
      output: z2.never().optional(),
      errorText: z2.never().optional(),
      callProviderMetadata: providerMetadataSchema.optional(),
      approval: z2.object({
        id: z2.string(),
        approved: z2.boolean(),
        descriptor: z2.unknown().optional(),
        requestReason: z2.string().optional(),
        reason: z2.string().optional(),
        isAutomatic: z2.boolean().optional(),
        signature: z2.string().optional()
      })
    }),
    z2.object({
      type: z2.literal("dynamic-tool"),
      toolName: z2.string(),
      toolCallId: z2.string(),
      title: z2.string().optional(),
      toolMetadata: toolMetadataSchema2.optional(),
      state: z2.literal("output-available"),
      input: z2.unknown(),
      providerExecuted: z2.boolean().optional(),
      output: z2.unknown(),
      errorText: z2.never().optional(),
      callProviderMetadata: providerMetadataSchema.optional(),
      resultProviderMetadata: providerMetadataSchema.optional(),
      preliminary: z2.boolean().optional(),
      approval: z2.object({
        id: z2.string(),
        approved: z2.literal(true),
        descriptor: z2.unknown().optional(),
        requestReason: z2.string().optional(),
        reason: z2.string().optional(),
        isAutomatic: z2.boolean().optional(),
        signature: z2.string().optional()
      }).optional()
    }),
    z2.object({
      type: z2.literal("dynamic-tool"),
      toolName: z2.string(),
      toolCallId: z2.string(),
      title: z2.string().optional(),
      toolMetadata: toolMetadataSchema2.optional(),
      state: z2.literal("output-error"),
      input: z2.unknown().optional(),
      rawInput: z2.unknown().optional(),
      providerExecuted: z2.boolean().optional(),
      output: z2.never().optional(),
      errorText: z2.string(),
      callProviderMetadata: providerMetadataSchema.optional(),
      resultProviderMetadata: providerMetadataSchema.optional(),
      approval: z2.object({
        id: z2.string(),
        approved: z2.literal(true),
        descriptor: z2.unknown().optional(),
        requestReason: z2.string().optional(),
        reason: z2.string().optional(),
        isAutomatic: z2.boolean().optional(),
        signature: z2.string().optional()
      }).optional()
    }),
    z2.object({
      type: z2.literal("dynamic-tool"),
      toolName: z2.string(),
      toolCallId: z2.string(),
      title: z2.string().optional(),
      toolMetadata: toolMetadataSchema2.optional(),
      state: z2.literal("output-denied"),
      input: z2.unknown(),
      providerExecuted: z2.boolean().optional(),
      output: z2.never().optional(),
      errorText: z2.never().optional(),
      callProviderMetadata: providerMetadataSchema.optional(),
      approval: z2.object({
        id: z2.string(),
        approved: z2.literal(false),
        descriptor: z2.unknown().optional(),
        requestReason: z2.string().optional(),
        reason: z2.string().optional(),
        isAutomatic: z2.boolean().optional(),
        signature: z2.string().optional()
      })
    }),
    z2.object({
      type: z2.string().startsWith("tool-"),
      toolCallId: z2.string(),
      title: z2.string().optional(),
      toolMetadata: toolMetadataSchema2.optional(),
      state: z2.literal("input-streaming"),
      providerExecuted: z2.boolean().optional(),
      callProviderMetadata: providerMetadataSchema.optional(),
      input: z2.unknown().optional(),
      output: z2.never().optional(),
      errorText: z2.never().optional(),
      approval: z2.never().optional()
    }),
    z2.object({
      type: z2.string().startsWith("tool-"),
      toolCallId: z2.string(),
      title: z2.string().optional(),
      toolMetadata: toolMetadataSchema2.optional(),
      state: z2.literal("input-available"),
      providerExecuted: z2.boolean().optional(),
      input: z2.unknown(),
      output: z2.never().optional(),
      errorText: z2.never().optional(),
      callProviderMetadata: providerMetadataSchema.optional(),
      approval: z2.never().optional()
    }),
    z2.object({
      type: z2.string().startsWith("tool-"),
      toolCallId: z2.string(),
      title: z2.string().optional(),
      toolMetadata: toolMetadataSchema2.optional(),
      state: z2.literal("approval-requested"),
      input: z2.unknown(),
      providerExecuted: z2.boolean().optional(),
      output: z2.never().optional(),
      errorText: z2.never().optional(),
      callProviderMetadata: providerMetadataSchema.optional(),
      approval: z2.object({
        id: z2.string(),
        approved: z2.never().optional(),
        descriptor: z2.unknown().optional(),
        requestReason: z2.string().optional(),
        reason: z2.never().optional(),
        isAutomatic: z2.boolean().optional(),
        signature: z2.string().optional()
      })
    }),
    z2.object({
      type: z2.string().startsWith("tool-"),
      toolCallId: z2.string(),
      title: z2.string().optional(),
      toolMetadata: toolMetadataSchema2.optional(),
      state: z2.literal("approval-responded"),
      input: z2.unknown(),
      providerExecuted: z2.boolean().optional(),
      output: z2.never().optional(),
      errorText: z2.never().optional(),
      callProviderMetadata: providerMetadataSchema.optional(),
      approval: z2.object({
        id: z2.string(),
        approved: z2.boolean(),
        descriptor: z2.unknown().optional(),
        requestReason: z2.string().optional(),
        reason: z2.string().optional(),
        isAutomatic: z2.boolean().optional(),
        signature: z2.string().optional()
      })
    }),
    z2.object({
      type: z2.string().startsWith("tool-"),
      toolCallId: z2.string(),
      title: z2.string().optional(),
      toolMetadata: toolMetadataSchema2.optional(),
      state: z2.literal("output-available"),
      providerExecuted: z2.boolean().optional(),
      input: z2.unknown(),
      output: z2.unknown(),
      errorText: z2.never().optional(),
      callProviderMetadata: providerMetadataSchema.optional(),
      resultProviderMetadata: providerMetadataSchema.optional(),
      preliminary: z2.boolean().optional(),
      approval: z2.object({
        id: z2.string(),
        approved: z2.literal(true),
        descriptor: z2.unknown().optional(),
        requestReason: z2.string().optional(),
        reason: z2.string().optional(),
        isAutomatic: z2.boolean().optional(),
        signature: z2.string().optional()
      }).optional()
    }),
    z2.object({
      type: z2.string().startsWith("tool-"),
      toolCallId: z2.string(),
      title: z2.string().optional(),
      toolMetadata: toolMetadataSchema2.optional(),
      state: z2.literal("output-error"),
      providerExecuted: z2.boolean().optional(),
      input: z2.unknown().optional(),
      rawInput: z2.unknown().optional(),
      output: z2.never().optional(),
      errorText: z2.string(),
      callProviderMetadata: providerMetadataSchema.optional(),
      resultProviderMetadata: providerMetadataSchema.optional(),
      approval: z2.object({
        id: z2.string(),
        approved: z2.literal(true),
        descriptor: z2.unknown().optional(),
        requestReason: z2.string().optional(),
        reason: z2.string().optional(),
        isAutomatic: z2.boolean().optional(),
        signature: z2.string().optional()
      }).optional()
    }),
    z2.object({
      type: z2.string().startsWith("tool-"),
      toolCallId: z2.string(),
      title: z2.string().optional(),
      toolMetadata: toolMetadataSchema2.optional(),
      state: z2.literal("output-denied"),
      providerExecuted: z2.boolean().optional(),
      input: z2.unknown(),
      output: z2.never().optional(),
      errorText: z2.never().optional(),
      callProviderMetadata: providerMetadataSchema.optional(),
      approval: z2.object({
        id: z2.string(),
        approved: z2.literal(false),
        descriptor: z2.unknown().optional(),
        requestReason: z2.string().optional(),
        reason: z2.string().optional(),
        isAutomatic: z2.boolean().optional(),
        signature: z2.string().optional()
      })
    })
  ]))
}).superRefine((message, context) => {
  if (message.role !== "assistant" && message.parts.length === 0) {
    context.addIssue({
      origin: "array",
      code: "too_small",
      minimum: 1,
      inclusive: true,
      input: message.parts,
      path: ["parts"],
      message: "Message must contain at least one part"
    });
  }
})).nonempty("Messages array must not be empty")));
var originalGenerateCallId4 = createIdGenerator({
  prefix: "call",
  size: 24
});
var originalGenerateCallId5 = createIdGenerator({
  prefix: "call",
  size: 24
});
var textEncoder = new TextEncoder;
var tolerance = 0.000001;
function isRecord2(value) {
  if (value == null || typeof value !== "object" || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function isJSON(value, ancestors = /* @__PURE__ */ new Set) {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value === "number")
    return Number.isFinite(value);
  if (typeof value !== "object" || !Array.isArray(value) && !isRecord2(value))
    return false;
  if (ancestors.has(value))
    return false;
  ancestors.add(value);
  const valid = Object.getOwnPropertySymbols(value).length === 0 && (Array.isArray(value) ? Array.from(value).every((item) => isJSON(item, ancestors)) : Object.values(value).every((item) => isJSON(item, ancestors)));
  ancestors.delete(value);
  return valid;
}
function isInput(value) {
  return (typeof value === "string" || Array.isArray(value) || isRecord2(value)) && isJSON(value);
}
function invalidInput(parameter, value, message) {
  throw new InvalidArgumentError2({ parameter, value, message });
}
function validateEvaluationInput({
  state,
  questions
}) {
  if (!isInput(state)) {
    invalidInput("state", state, "must be a JSON-compatible string, object, or array");
  }
  if (!isRecord2(questions) || Object.keys(questions).length === 0) {
    invalidInput("questions", questions, "must be a nonempty question map");
  }
  for (const [id, question] of Object.entries(questions)) {
    const parameter = `questions.${id}`;
    if (!isRecord2(question) || !isInput(question.instructions)) {
      invalidInput(parameter, question, "instructions must be a JSON-compatible string, object, or array");
    }
    const criteria = question.criteria;
    switch (question.type) {
      case "choice":
        if (!isRecord2(criteria) || Object.keys(criteria).length === 0) {
          invalidInput(parameter, question, "choice criteria must be a nonempty option map");
        }
        break;
      case "score":
        if (!Array.isArray(criteria) || criteria.length < 2) {
          invalidInput(parameter, question, "score criteria must contain at least two ordered levels");
        }
        break;
      case "boolean":
        if (criteria === undefined)
          continue;
        if (!isRecord2(criteria) || Object.keys(criteria).some((key) => key !== "true" && key !== "false")) {
          invalidInput(parameter, question, "boolean criteria may only describe true and false");
        }
        break;
      default:
        invalidInput(parameter, question, "question type must be choice, score, or boolean");
    }
    if (!isJSON(criteria) || Object.values(criteria).some((value) => value !== null && !isInput(value))) {
      invalidInput(parameter, question, "criteria descriptions must be JSON-compatible strings, objects, arrays, or null");
    }
  }
}
function invalidAnswer(answers, message) {
  throw new InvalidResponseDataError({ data: answers, message });
}
function isProbability(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}
function hasExactKeys(value, keys) {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
function validateDistribution(value, keys, answers, id, roundingError) {
  if (!isRecord2(value) || !hasExactKeys(value, keys) || !Object.values(value).every(isProbability)) {
    invalidAnswer(answers, `Question "${id}" must have a complete distribution of finite probabilities in [0, 1].`);
  }
  const sum = Object.values(value).reduce((total, probability) => total + probability, 0);
  if (Math.abs(sum - 1) > tolerance + keys.length * roundingError) {
    invalidAnswer(answers, `Question "${id}" probabilities must sum to 1 within the declared rounding precision.`);
  }
}
function validateEvaluationAnswers({
  questions,
  answers,
  rounding
}) {
  function roundingError(decimals) {
    if (decimals === undefined)
      return 0;
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 15) {
      invalidAnswer(answers, "Evaluation rounding decimals must be integers between 0 and 15.");
    }
    return 0.5 * 10 ** -decimals;
  }
  const probabilityError = roundingError(rounding == null ? undefined : rounding.probabilityDecimals);
  const scoreError = roundingError(rounding == null ? undefined : rounding.scoreDecimals);
  if (!isRecord2(answers) || !hasExactKeys(answers, Object.keys(questions))) {
    invalidAnswer(answers, "Evaluation must return exactly one answer for every question.");
  }
  for (const [id, question] of Object.entries(questions)) {
    const answer = answers[id];
    if (!isRecord2(answer) || answer.type !== question.type) {
      invalidAnswer(answers, `Question "${id}" returned an answer with the wrong type.`);
    }
    switch (question.type) {
      case "choice": {
        if (typeof answer.choice !== "string" || !Object.hasOwn(question.criteria, answer.choice)) {
          invalidAnswer(answers, `Question "${id}" selected an unknown option.`);
        }
        if (answer.probabilities !== undefined) {
          validateDistribution(answer.probabilities, Object.keys(question.criteria), answers, id, probabilityError);
          const selected = answer.probabilities[answer.choice];
          if (Object.values(answer.probabilities).some((probability) => probability > selected + tolerance)) {
            invalidAnswer(answers, `Question "${id}" did not select a highest-probability option.`);
          }
        }
        break;
      }
      case "score": {
        if (typeof answer.score !== "number" || !Number.isFinite(answer.score) || answer.score < 0 || answer.score > question.criteria.length - 1) {
          invalidAnswer(answers, `Question "${id}" score must be in [0, ${question.criteria.length - 1}].`);
        }
        if (answer.probabilities !== undefined) {
          const keys = question.criteria.map((_, index) => String(index));
          validateDistribution(answer.probabilities, keys, answers, id, probabilityError);
          const mean = Object.entries(answer.probabilities).reduce((total, [index, probability]) => total + Number(index) * probability, 0);
          const meanRoundingError = keys.reduce((total, index) => total + Number(index) * probabilityError, 0);
          if (Math.abs(mean - answer.score) > tolerance + meanRoundingError + scoreError) {
            invalidAnswer(answers, `Question "${id}" score must equal the probability-weighted mean within the declared rounding precision.`);
          }
        }
        break;
      }
      case "boolean":
        if (!isProbability(answer.probability)) {
          invalidAnswer(answers, `Question "${id}" must return P(true) as a finite probability in [0, 1].`);
        }
        break;
    }
  }
}
async function evaluate({
  model: modelArg,
  state,
  questions,
  maxRetries,
  abortSignal,
  headers,
  providerOptions = {}
}) {
  var _a252, _b25, _c, _d, _e, _f;
  const model = resolveEvaluationModel(modelArg);
  validateEvaluationInput({ state, questions });
  for (const [questionId, question] of Object.entries(questions)) {
    if (!model.supportedQuestionTypes.includes(question.type)) {
      throw new EvaluationUnsupportedQuestionTypeError({
        questionId,
        questionType: question.type,
        provider: model.provider,
        modelId: model.modelId
      });
    }
  }
  const { retry } = prepareRetries({ maxRetries, abortSignal });
  const result = await retry(() => {
    abortSignal == null || abortSignal.throwIfAborted();
    return model.doEvaluate({
      state,
      questions,
      abortSignal,
      headers: withUserAgentSuffix(headers != null ? headers : {}, `ai/${VERSION3}`),
      providerOptions
    });
  });
  abortSignal == null || abortSignal.throwIfAborted();
  validateEvaluationAnswers({
    questions,
    answers: result.answers,
    rounding: result.rounding
  });
  logWarnings({
    warnings: result.warnings,
    provider: model.provider,
    model: model.modelId
  });
  const inputTokens = (_a252 = result.usage) == null ? undefined : _a252.inputTokens;
  const outputTokens = (_b25 = result.usage) == null ? undefined : _b25.outputTokens;
  return {
    answers: result.answers,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens != null && outputTokens != null ? inputTokens + outputTokens : undefined
    },
    warnings: result.warnings,
    rounding: result.rounding,
    providerMetadata: result.providerMetadata,
    response: {
      ...result.response,
      timestamp: (_d = (_c = result.response) == null ? undefined : _c.timestamp) != null ? _d : /* @__PURE__ */ new Date,
      modelId: (_f = (_e = result.response) == null ? undefined : _e.modelId) != null ? _f : model.modelId
    }
  };
}
var originalGenerateId4 = createIdGenerator({ prefix: "aiobj", size: 24 });
function createDownload(options) {
  return ({ url, abortSignal }) => download({ url, maxBytes: options == null ? undefined : options.maxBytes, abortSignal });
}
var originalGenerateId5 = createIdGenerator({ prefix: "aiobj", size: 24 });
var defaultDownload = createDownload();
var REALTIME_MAX_FRAME_BYTES = 128 * 1024;
var REALTIME_MAX_BUFFERED_BYTES = 128 * 1024;
var MAX_SESSION_ANSWER_BYTES = 1024 * 1024;
var setupSchema = z2.object({
  token: z2.string().refine((value) => value.trim().length > 0),
  url: z2.string().refine((value) => {
    try {
      const url = new URL(value);
      return (url.protocol === "ws:" || url.protocol === "wss:") && url.hostname !== "";
    } catch (e) {
      return false;
    }
  }),
  expiresAt: z2.number().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  tools: z2.array(z2.object({
    type: z2.literal("function"),
    name: z2.string().min(1),
    description: z2.string().optional(),
    parameters: z2.record(z2.string(), z2.unknown())
  })).optional()
});
var name242 = "AI_NoSuchProviderError";
var marker242 = `vercel.ai.error.${name242}`;
var symbol242 = Symbol.for(marker242);
var _a242;
var _b242;
var NoSuchProviderError = class extends (_b242 = NoSuchModelError, _a242 = symbol242, _b242) {
  constructor({
    modelId,
    modelType,
    providerId,
    availableProviders,
    message = `No such provider: ${providerId} (available providers: ${availableProviders.join()})`
  }) {
    super({ errorName: name242, modelId, modelType, message });
    this[_a242] = true;
    this.providerId = providerId;
    this.availableProviders = availableProviders;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker242);
  }
};
var originalGenerateCallId6 = createIdGenerator({
  prefix: "call",
  size: 24
});
var defaultDownload2 = createDownload();
export {
  evaluate,
  createGateway
};

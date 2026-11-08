#!/usr/bin/env node
/**
 * Puts a README on a SpaceDock listing as its description.
 *
 *   spacedock-description.mjs render <readme> --repo <owner/name> --ref <ref> [--dir <path>] [--mod-id <id>]
 *   spacedock-description.mjs sync   <readme> --repo <owner/name> --ref <ref> --mod-id <id> [--dir <path>] [--short <text>] [--version <x.y.z>] [--dry-run]
 *
 * SpaceDock's JSON API cannot edit a description: `/api/mod/<id>/update`
 * uploads a version and nothing else. The only writer is the website's edit
 * form, `POST /mod/<id>/<name>/edit`, reached with the session cookie
 * `/api/login` hands out (the same login the version upload uses). That form
 * overwrites the whole listing, so `sync` loads the logged-in edit page, keeps
 * every field exactly as the page rendered it (licence, links, the machine
 * learning flag, notification ticks) and replaces only `description`, plus
 * `short-description` when `--short` is given.
 *
 * SpaceDock renders the text with python-markdown (tables, fenced code,
 * emoji) and then strips everything outside a short tag allowlist, resolving
 * relative URLs against spacedock.info. So the README is rewritten before it
 * goes: relative images and links become absolute GitHub URLs, `<details>`
 * becomes a bold heading, `<img>` becomes a markdown image (width and height
 * are dropped by SpaceDock anyway) and HTML comments are removed.
 *
 * `--dry-run` reads the README and prints what would be sent. It never
 * touches the network and never reads the login.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const SD = "https://spacedock.info";
const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/** Resolves a README-relative target to an absolute GitHub URL, or returns it unchanged when it already is one. */
export function absolutise(target, ctx, kind) {
  const trimmed = target.trim();
  if (trimmed === "" || ABSOLUTE.test(trimmed)) return trimmed;
  const [, pathPart, suffix] = /^([^#?]*)(.*)$/.exec(trimmed);
  const readmeDir = path.posix.dirname(ctx.readmePath);
  const withinRepo = pathPart.startsWith("/")
    ? pathPart.slice(1)
    : path.posix.normalize(path.posix.join(readmeDir, pathPart));
  const file = pathPart === "" ? ctx.readmePath : withinRepo;
  if (kind === "image") {
    return `https://raw.githubusercontent.com/${ctx.repo}/${ctx.ref}/${file}${suffix}`;
  }
  return `https://github.com/${ctx.repo}/blob/${ctx.ref}/${file}${suffix}`;
}

const TARGET = String.raw`(<[^>\n]*>|(?:[^\s()]|\([^\s()]*\))*)`;
const TITLE = String.raw`((?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?)`;
const LABEL = String.raw`((?:[^\][]|\[[^\]]*\])*)`;
const IMAGE_RE = new RegExp(
  String.raw`!\[${LABEL}\]\(\s*${TARGET}${TITLE}\s*\)`,
  "g",
);
const LINK_RE = new RegExp(
  String.raw`(?<!!)\[${LABEL}\]\(\s*${TARGET}${TITLE}\s*\)`,
  "g",
);

/** Splits a document into prose and code segments: fenced blocks and inline code spans are code. */
export function segments(markdown) {
  const out = [];
  let prose = [];
  const flush = () => {
    if (prose.length === 0) return;
    const text = prose.join("\n");
    prose = [];
    let last = 0;
    for (const m of text.matchAll(/(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g)) {
      if (m.index > last)
        out.push({ code: false, text: text.slice(last, m.index) });
      out.push({ code: true, text: m[0] });
      last = m.index + m[0].length;
    }
    out.push({ code: false, text: text.slice(last) });
  };
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const open = /^[ \t]*(`{3,}|~{3,})/.exec(lines[i]);
    if (!open) {
      prose.push(lines[i]);
      continue;
    }
    flush();
    const fence = new RegExp(
      `^[ \\t]*${open[1][0]}{${open[1].length},}[ \\t]*$`,
    );
    const block = [lines[i]];
    while (++i < lines.length) {
      block.push(lines[i]);
      if (fence.test(lines[i])) break;
    }
    out.push({ code: true, text: `\n${block.join("\n")}\n` });
  }
  flush();
  return out;
}

function rewriteProse(text, ctx) {
  let out = text.replace(/<!--[\s\S]*?-->/g, "");

  out = out.replace(
    /<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>/gi,
    (_m, title) => `\n**${title.replace(/<[^>]+>/g, "").trim()}**\n`,
  );
  out = out.replace(/<\/?details[^>]*>/gi, "\n");
  out = out.replace(/<\/?summary[^>]*>/gi, "");

  // Raw tags stay HTML (an img inside a <p> block is never parsed as markdown);
  // only their URLs change.
  const rewriteAttr = (name, kind) => (tag) =>
    tag.replace(
      new RegExp(`(\\b${name}\\s*=\\s*)(?:"([^"]*)"|'([^']*)')`, "i"),
      (_m, head, dq, sq) => `${head}"${absolutise(dq ?? sq, ctx, kind)}"`,
    );
  out = out.replace(/<img\b[^>]*>/gi, rewriteAttr("src", "image"));
  out = out.replace(/<a\b[^>]*>/gi, rewriteAttr("href", "link"));

  out = out.replace(IMAGE_RE, (_m, label, rawTarget, title) => {
    const target = rawTarget.replace(/^<|>$/g, "");
    return `![${label}](${absolutise(target, ctx, "image")}${title})`;
  });
  out = out.replace(LINK_RE, (_m, label, rawTarget, title) => {
    const target = rawTarget.replace(/^<|>$/g, "");
    return `[${label}](${absolutise(target, ctx, "link")}${title})`;
  });
  // Reference definitions: [id]: target "optional title"; footnotes are not links.
  out = out.replace(
    /^( {0,3}\[(?!\^)[^\]\n]+\]:[ \t]*)(<[^>\n]+>|\S+)(?=[ \t]*(?:["'(].*)?$)/gm,
    (_m, head, target) =>
      `${head}${absolutise(target.replace(/^<|>$/g, ""), ctx, "link")}`,
  );
  return out;
}

/**
 * The README rewritten for SpaceDock. Code, fenced or inline, passes through
 * untouched. `ctx.version` replaces the committed placeholder version.
 */
export function renderDescription(markdown, ctx) {
  let source = markdown.replace(/\r\n/g, "\n");
  if (ctx.modId !== undefined)
    source = source.replaceAll("SPACEDOCK_MOD_ID", String(ctx.modId));
  if (ctx.version !== undefined)
    source = source.replaceAll("0.0.0-development", ctx.version);
  const rendered = segments(source)
    .map((seg) => (seg.code ? seg.text : rewriteProse(seg.text, ctx)))
    .join("");
  return `${rendered.replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

const ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#34;": '"',
  "&#x27;": "'",
};
function unescapeHtml(text) {
  return text.replace(/&(?:amp|lt|gt|quot|#39|#34|#x27);/g, (m) => ENTITIES[m]);
}

function attr(tag, name) {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(
    tag,
  );
  return m ? unescapeHtml(m[1] ?? m[2]) : undefined;
}

/**
 * The fields the browser would submit from the edit page's form, in order.
 * Checkboxes and radios count only when ticked; submit buttons never do.
 */
export function parseEditForm(html) {
  return inspectEditForm(html).fields;
}

/**
 * The submitted fields plus the name of every named control on the form, ticked
 * or not, so a missing control can be told from an unticked checkbox.
 */
export function inspectEditForm(html) {
  const form = /<form\b[^>]*\/edit"[^>]*>([\s\S]*?)<\/form>/i.exec(html);
  if (!form)
    throw new Error(
      "the SpaceDock edit page has no edit form, so its layout changed or the login was refused",
    );
  const body = form[1];
  const fields = [];
  const controls = new Set();
  const token =
    /<input\b[^>]*>|<textarea\b[^>]*>[\s\S]*?<\/textarea>|<select\b[^>]*>[\s\S]*?<\/select>/gi;
  for (const m of body.matchAll(token)) {
    const tag = m[0];
    const name = attr(tag, "name");
    if (!name) continue;
    controls.add(name);
    if (/^<textarea/i.test(tag)) {
      fields.push([
        name,
        unescapeHtml(
          tag.replace(/^<textarea[^>]*>/i, "").replace(/<\/textarea>$/i, ""),
        ).replace(/^\n/, ""),
      ]);
    } else if (/^<select/i.test(tag)) {
      const options = [...tag.matchAll(/<option\b[^>]*>/gi)].map((o) => o[0]);
      const chosen = options.find((o) => /\bselected\b/i.test(o)) ?? options[0];
      if (chosen) fields.push([name, attr(chosen, "value") ?? ""]);
    } else {
      const type = (attr(tag, "type") ?? "text").toLowerCase();
      if (
        type === "submit" ||
        type === "button" ||
        type === "image" ||
        type === "file"
      )
        continue;
      if (
        (type === "checkbox" || type === "radio") &&
        !/\bchecked\b/i.test(tag)
      )
        continue;
      fields.push([
        name,
        attr(tag, "value") ?? (type === "checkbox" ? "on" : ""),
      ]);
    }
  }
  return { fields, controls };
}

const MUST_BE_ON_THE_FORM = [
  "name",
  "short-description",
  "license",
  "description",
  "ml",
  "donation-link",
  "external-link",
  "source-link",
];

/**
 * Throws unless every control the edit route overwrites is on the form and what
 * the form holds agrees with the public listing, so a field the page did not
 * render faithfully is never sent back.
 */
export function certifyEditForm({ fields, controls }, listing) {
  const absent = MUST_BE_ON_THE_FORM.filter((n) => !controls.has(n));
  if (absent.length > 0) {
    throw new Error(
      `the SpaceDock edit page has no ${absent.join(", ")} control; refusing to write anything`,
    );
  }
  const value = (n) => fields.find(([k]) => k === n)?.[1] ?? "";
  const flat = (t) => (t ?? "").replace(/\r\n/g, "\n");
  const agree = [
    ["name", value("name"), listing.name],
    ["license", value("license"), listing.license],
    [
      "short-description",
      value("short-description"),
      listing.short_description,
    ],
    ["donation-link", value("donation-link"), listing.donations],
    ["external-link", value("external-link"), listing.website],
    ["source-link", value("source-link"), listing.source_code],
    ["description", flat(value("description")), flat(listing.description)],
  ];
  for (const [n, form, api] of agree) {
    if ((form ?? "") !== (api ?? "")) {
      throw new Error(
        `the edit page's ${n} disagrees with the public listing; refusing to write anything`,
      );
    }
  }
}

/**
 * Throws unless the public listing page states the machine-learning flag as
 * True or False and the edit form's checkbox agrees. A listing whose flag was
 * never set renders the box ticked, and submitting it would store True.
 */
export function certifyMl({ fields }, modPageHtml) {
  const shown = /<h2 title="(True|False|None)"/.exec(modPageHtml)?.[1];
  if (shown === undefined) {
    throw new Error(
      "the listing page does not state its ML/AI flag; refusing to write anything",
    );
  }
  if (shown === "None") {
    throw new Error(
      "the listing's ML/AI flag was never set, and the edit form would store it as ticked; set the flag once on the listing's edit page by hand, then run again",
    );
  }
  const ticked = fields.some(([n]) => n === "ml");
  if (ticked !== (shown === "True")) {
    throw new Error(
      "the edit page's ML/AI checkbox disagrees with the listing page; refusing to write anything",
    );
  }
}

/** The explicit short description a README declares with `<!-- spacedock-short: ... -->`, or undefined. */
export function extractShort(markdown) {
  for (const seg of segments(markdown.replace(/\r\n/g, "\n"))) {
    if (seg.code) continue;
    const m = /<!--\s*spacedock-short:\s*([^\n]*?)\s*-->/.exec(seg.text);
    if (m) return m[1];
  }
  return undefined;
}

const REQUIRED = ["name", "short-description", "license", "description"];

/** The edit form's fields with `description` (and `short-description` when given) replaced. */
export function buildEditFields(fields, { description, short }) {
  const names = new Set(fields.map(([n]) => n));
  const missing = REQUIRED.filter((n) => !names.has(n));
  if (missing.length > 0) {
    throw new Error(
      `the SpaceDock edit page lacks ${missing.join(", ")}; refusing to submit a form that would blank them`,
    );
  }
  const current = Object.fromEntries(fields.map(([n, v]) => [n, v]));
  for (const must of ["name", "license"]) {
    if (!current[must])
      throw new Error(`the edit page's ${must} is empty; refusing to submit`);
  }
  if (short !== undefined && (short.length === 0 || short.length > 1000)) {
    throw new Error("a short description must be 1 to 1000 characters");
  }
  return fields.map(([n, v]) => {
    if (n === "description") return [n, description];
    if (n === "short-description" && short !== undefined) return [n, short];
    return [n, v];
  });
}

function cookieHeader(res, jar) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const [k, ...v] = pair.split("=");
    jar.set(k.trim(), v.join("="));
  }
}
const jarString = (jar) => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

export async function sync({
  readme,
  ctx,
  modId,
  short,
  dryRun,
  env,
  base = SD,
}) {
  const description = renderDescription(readFileSync(readme, "utf8"), {
    ...ctx,
    modId,
  });
  if (dryRun) {
    console.log(
      `SpaceDock mod ${modId}: would replace the description (${description.length} characters)${short === undefined ? ", short description kept" : `, short description "${short}"`}.`,
    );
    console.log("----- description -----");
    console.log(description);
    return 0;
  }
  const user = env.SPACEDOCK_USERNAME;
  const pass = env.SPACEDOCK_PASSWORD;
  if (!user || !pass)
    throw new Error("SPACEDOCK_USERNAME and SPACEDOCK_PASSWORD must be set");

  const jar = new Map();
  const login = new FormData();
  login.set("username", user);
  login.set("password", pass);
  const loginRes = await fetch(`${base}/api/login`, {
    method: "POST",
    body: login,
  });
  cookieHeader(loginRes, jar);
  const loginBody = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok || loginBody.error)
    throw new Error(`SpaceDock login failed (HTTP ${loginRes.status})`);

  const editUrl = `${base}/mod/${modId}/mod/edit`;
  const page = await fetch(editUrl, { headers: { cookie: jarString(jar) } });
  if (!page.ok)
    throw new Error(`SpaceDock edit page answered HTTP ${page.status}`);
  const before = await (await fetch(`${base}/api/mod/${modId}`)).json();
  const form = inspectEditForm(await page.text());
  certifyEditForm(form, before);
  const modPage = await fetch(`${base}/mod/${modId}/mod`);
  if (!modPage.ok)
    throw new Error(`SpaceDock listing page answered HTTP ${modPage.status}`);
  certifyMl(form, await modPage.text());
  const fields = buildEditFields(form.fields, { description, short });

  const post = await fetch(editUrl, {
    method: "POST",
    redirect: "manual",
    headers: {
      cookie: jarString(jar),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields).toString(),
  });
  if (post.status >= 400)
    throw new Error(`SpaceDock edit answered HTTP ${post.status}`);

  const after = await (await fetch(`${base}/api/mod/${modId}`)).json();
  const same = (a, b) => (a ?? "") === (b ?? "");
  for (const key of [
    "name",
    "license",
    "website",
    "donations",
    "source_code",
    ...(short === undefined ? ["short_description"] : []),
  ]) {
    if (!same(before[key], after[key]))
      throw new Error(
        `the edit changed the listing's ${key}; check the listing`,
      );
  }
  if (short !== undefined && !same(after.short_description, short)) {
    throw new Error(
      "SpaceDock did not store the short description that was sent; check the listing",
    );
  }
  if (
    !same(
      after.description?.replace(/\r\n/g, "\n"),
      description.replace(/\r\n/g, "\n"),
    )
  ) {
    throw new Error(
      "SpaceDock did not store the description that was sent; check the listing",
    );
  }
  // ml and the notification ticks are not in the public reply: read the edit page again.
  const reread = await fetch(editUrl, { headers: { cookie: jarString(jar) } });
  if (!reread.ok)
    throw new Error(
      `SpaceDock edit page answered HTTP ${reread.status} after the write`,
    );
  const kept = (list) =>
    JSON.stringify(
      list.filter(([n]) => n !== "description" && n !== "short-description"),
    );
  if (kept(inspectEditForm(await reread.text()).fields) !== kept(fields)) {
    throw new Error(
      "a field other than the description changed on the listing (ml, a link or a notification); check the listing",
    );
  }
  console.log(
    `SpaceDock mod ${modId}: description replaced (${description.length} characters).`,
  );
  return 0;
}

function parseArgs(argv) {
  const opts = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a.startsWith("--")) opts[a.slice(2)] = argv[++i];
    else positional.push(a);
  }
  return { opts, positional };
}

export async function main(argv, env = process.env) {
  const [command, ...rest] = argv;
  const { opts, positional } = parseArgs(rest);
  const [readme] = positional;
  if (
    !["render", "sync"].includes(command) ||
    !readme ||
    !opts.repo ||
    !opts.ref
  ) {
    console.error(
      "usage: spacedock-description.mjs render|sync <readme> --repo <owner/name> --ref <ref> [--dir <path>] [--mod-id <id>] [--short <text>] [--dry-run]",
    );
    return 2;
  }
  if (opts["mod-id"] !== undefined && !/^\d+$/.test(opts["mod-id"])) {
    console.error("--mod-id must be a number");
    return 2;
  }
  const readmePath = path.posix.join(opts.dir ?? "", path.basename(readme));
  const ctx = {
    repo: opts.repo,
    ref: opts.ref,
    readmePath,
    version: opts.version,
  };
  const modId = opts["mod-id"];
  if (command === "render") {
    process.stdout.write(
      renderDescription(readFileSync(readme, "utf8"), { ...ctx, modId }),
    );
    return 0;
  }
  if (!modId) {
    console.error("sync needs --mod-id");
    return 2;
  }
  return sync({
    readme,
    ctx,
    modId,
    short: opts.short ?? extractShort(readFileSync(readme, "utf8")),
    dryRun: opts.dryRun === true,
    env,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    },
  );
}

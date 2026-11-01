import * as R from "./rules.js";

const KEY = "mesadas_data_v1";
const SKEY = "mesadas_session_v1";
const $ = s => document.querySelector(s);
const app = $("#app");
const eur = n => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n);
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;" };
const esc = s => String(s ?? "").replace(/[&<>']/g, c => ESC[c]).split(String.fromCharCode(34)).join("&quot;");

async function hash(pw, salt) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pw));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const newSalt = () => [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, "0")).join("");

let data = null;
function save() { localStorage.setItem(KEY, JSON.stringify(data)); }
async function load() {
  const raw = localStorage.getItem(KEY);
  if (raw) { data = JSON.parse(raw); }
  else {
    const salt = newSalt();
    data = { children: {}, users: { admin: { role: "gestor", salt, hash: await hash("admin", salt), email: null, child_name: null, must_change: true } } };
    save();
  }
  data.users ??= {}; data.children ??= {};
  for (const c of Object.values(data.children)) R.ensureChild(c);
  validateAll();
}
function validateAll() {
  let changed = false;
  for (const c of Object.values(data.children)) changed = R.validateDebt(c) || changed;
  if (changed) save();
}
let session = JSON.parse(sessionStorage.getItem(SKEY) || "null");
const setSession = s => { session = s; s ? sessionStorage.setItem(SKEY, JSON.stringify(s)) : sessionStorage.removeItem(SKEY); };

function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2500); }
const isGestor = () => session?.role === "gestor";

function renderLogin(err = "") {
  $("#userbox").innerHTML = "";
  app.innerHTML = `<div class="card"><h2>Entrar</h2>
    <form id="f"><label>Utilizador</label><input name="u" autocomplete="username" required>
    <label>Password</label><input name="p" type="password" autocomplete="current-password" required>
    ${err ? `<p class="err">${esc(err)}</p>` : ""}<button>Entrar</button></form></div>`;
  $("#f").onsubmit = async e => {
    e.preventDefault();
    const u = e.target.u.value.trim(), p = e.target.p.value.trim();
    const user = data.users[u];
    if (!user || (await hash(p, user.salt)) !== user.hash) return renderLogin("Utilizador ou password inválidos");
    setSession({ username: u, role: user.role, child_name: user.child_name });
    render();
  };
}

function cofresHtml(c) {
  return `<div class="grid">${Object.keys(R.DEFAULT_ALLOWANCE).map(k => `<div class="cofre">${esc(k)}<b>${eur(c.cofres[k])}</b></div>`).join("")}</div>
  <p>Mesada semanal: <b>${eur(R.weeklyValue(c.allowance))}</b> · Próxima data: <b>${esc(c.last_paid)}</b>${c.last_payment_date ? ` · Último pagamento: ${esc(c.last_payment_date)}` : ""}</p>
  ${c.debt > 0 ? `<div class="debt">Dívida acumulada: <b>${eur(c.debt)}</b></div>` : ""}`;
}
function txHtml(c) {
  const rows = [...c.transactions].reverse().map(t => `<tr><td>${new Date(t.date).toLocaleString("pt-PT")}</td><td class="${t.type === "Crédito" ? "cr" : "db"}">${esc(t.type)}</td><td>${esc(t.cofre)}</td><td>${esc(t.description)}</td><td>${eur(t.amount)}</td></tr>`).join("");
  return `<div class="tablewrap"><table><thead><tr><th>Data</th><th>Tipo</th><th>Cofre</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>${rows || `<tr><td colspan="5">Sem movimentos.</td></tr>`}</tbody></table></div>`;
}

let selected = null;
function render() {
  if (!session) return renderLogin();
  $("#userbox").innerHTML = `${esc(session.username)} (${esc(session.role)}) <button class="sec" id="out">Sair</button>`;
  $("#out").onclick = () => { setSession(null); selected = null; renderLogin(); };
  validateAll();
  isGestor() ? renderGestor() : renderCrianca();
}

function renderCrianca() {
  const c = data.children[session.child_name];
  if (!c) { app.innerHTML = `<div class="card">Criança não encontrada.</div>`; return; }
  app.innerHTML = `<div class="card"><h2>${esc(session.child_name)}</h2>${cofresHtml(c)}</div>
    <div class="card"><h2>Movimentos</h2>${txHtml(c)}</div>${passwordCard()}`;
  bindPassword();
}

function passwordCard() {
  return `<div class="card"><h2>Alterar a minha password</h2><form id="pw"><input name="p" type="password" placeholder="Nova password" autocomplete="new-password" required><button>Guardar</button></form></div>`;
}
function bindPassword() {
  $("#pw").onsubmit = async e => {
    e.preventDefault();
    const p = e.target.p.value.trim(); if (!p) return;
    await setPassword(session.username, p); toast("Password atualizada"); e.target.reset();
    if (isGestor()) renderGestor();
  };
}
async function setPassword(username, pw) {
  const u = data.users[username]; u.salt = newSalt(); u.hash = await hash(pw, u.salt); delete u.must_change; save();
}

function renderGestor() {
  const names = Object.keys(data.children);
  if (!names.includes(selected)) selected = names[0] ?? null;
  const c = selected ? data.children[selected] : null;
  const cofreOpts = Object.keys(R.DEFAULT_ALLOWANCE).map(k => `<option>${esc(k)}</option>`).join("");
  const mustChange = data.users[session.username]?.must_change;
  app.innerHTML = `
    ${mustChange ? `<div class="card debt">A password por defeito do gestor ainda não foi alterada. Altera-a abaixo.</div>` : ""}
    <div class="card"><h2>Criança</h2>
      <select id="sel">${names.map(n => `<option ${n === selected ? "selected" : ""}>${esc(n)}</option>`).join("") || "<option>(nenhuma)</option>"}</select>
      ${c ? cofresHtml(c) : "<p>Adiciona uma criança abaixo.</p>"}
      ${c ? `<button id="pay">Pagar mesada semanal</button><button class="danger" id="rm">Remover criança</button>` : ""}
    </div>
    ${c ? `<div class="card"><h2>Registar gasto</h2><form id="sp"><div class="row">
      <div><label>Cofre</label><select name="cofre">${cofreOpts}</select></div>
      <div><label>Valor (€)</label><input name="valor" type="number" step="0.01" min="0.01" required></div>
      <div><label>Descrição</label><input name="descricao" placeholder="Gasto"></div></div><button>Debitar</button></form></div>
    <div class="card"><h2>Mesada por cofre (€/semana)</h2><form id="al"><div class="grid">
      ${Object.keys(R.DEFAULT_ALLOWANCE).map(k => `<div><label>${esc(k)}</label><input name="${esc(k)}" type="number" step="0.01" min="0" value="${c.allowance[k] ?? 0}"></div>`).join("")}
      </div><button>Guardar mesada</button></form></div>
    <div class="card"><h2>Movimentos</h2>${txHtml(c)}</div>` : ""}
    <div class="card"><h2>Adicionar utilizador</h2><form id="add"><div class="row">
      <div><label>Nome</label><input name="name" required></div>
      <div><label>Tipo</label><select name="role"><option value="crianca">Criança</option><option value="gestor">Gestor</option></select></div>
      <div><label>Utilizador</label><input name="username" autocapitalize="none" required></div>
      <div><label>Password</label><input name="password" type="password" autocomplete="new-password" required></div>
      <div><label>Email (opcional)</label><input name="email" type="email"></div></div><button>Adicionar</button></form></div>
    <div class="card"><h2>Repor password de utilizador</h2><form id="rp"><div class="row">
      <select name="u">${Object.keys(data.users).map(u => `<option>${esc(u)}</option>`).join("")}</select>
      <input name="p" type="password" placeholder="Nova password" autocomplete="new-password" required></div><button>Repor</button></form></div>
    ${passwordCard()}
    <div class="card"><h2>Cópia de segurança</h2><button id="exp" class="sec">Exportar JSON</button>
      <label>Importar JSON (substitui os dados atuais)</label><input type="file" id="imp" accept="application/json"></div>`;

  $("#sel").onchange = e => { selected = e.target.value; renderGestor(); };
  bindPassword();
  if (c) {
    $("#pay").onclick = () => { R.payWeekly(c); save(); toast("Mesada paga"); renderGestor(); };
    $("#rm").onclick = () => {
      if (!confirm(`Remover ${selected} e os respetivos utilizadores?`)) return;
      delete data.children[selected];
      for (const [u, v] of Object.entries(data.users)) if (v.role === "crianca" && v.child_name === selected) delete data.users[u];
      save(); selected = null; renderGestor();
    };
    $("#sp").onsubmit = e => {
      e.preventDefault(); const f = e.target;
      try { R.spend(c, f.cofre.value, parseFloat(f.valor.value), f.descricao.value.trim()); save(); toast("Gasto registado"); renderGestor(); }
      catch (err) { toast(err.message); }
    };
    $("#al").onsubmit = e => {
      e.preventDefault(); const na = {};
      for (const k of Object.keys(R.DEFAULT_ALLOWANCE)) { const v = parseFloat(e.target[k].value); if (isNaN(v) || v < 0) return toast(`Valor inválido para ${k}`); na[k] = v; }
      c.allowance = na; save(); toast("Mesada atualizada"); renderGestor();
    };
  }
  $("#add").onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    const name = f.name.value.trim(), role = f.role.value, username = f.username.value.trim(), pw = f.password.value.trim(), email = f.email.value.trim();
    if (!name || !username || !pw) return toast("Preenche os campos obrigatórios");
    if (data.users[username]) return toast("Utilizador já existe");
    if (role === "crianca") { if (data.children[name]) return toast("Criança já existe"); data.children[name] = R.newChild(); }
    const salt = newSalt();
    data.users[username] = { role, salt, hash: await hash(pw, salt), email: email || null, ...(role === "crianca" ? { child_name: name } : {}) };
    save(); selected = role === "crianca" ? name : selected; toast("Adicionado"); renderGestor();
  };
  $("#rp").onsubmit = async e => {
    e.preventDefault(); const p = e.target.p.value.trim(); if (!p) return;
    await setPassword(e.target.u.value, p); toast("Password reposta"); e.target.reset(); renderGestor();
  };
  $("#exp").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `mesadas_${R.isoDate(R.today())}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  $("#imp").onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      if (!d.users || typeof d.users !== "object" || !Object.values(d.users).some(u => u.role === "gestor")) throw new Error("Ficheiro inválido (sem gestor)");
      for (const u of Object.values(d.users)) {
        if (u.password !== undefined && !u.hash) { u.salt = newSalt(); u.hash = await hash(u.password, u.salt); delete u.password; }
        if (!u.hash) throw new Error("Utilizadores sem credenciais");
      }
      d.children ??= {};
      if (!confirm("Substituir todos os dados atuais?")) return;
      data = d; for (const ch of Object.values(data.children)) R.ensureChild(ch);
      save(); setSession(null); toast("Importado"); renderLogin();
    } catch (err) { toast(err.message); }
  };
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
await load();
render();

// Regras portadas de Gestao_mesada.py (repositorio palesigo/gest-o-mesadas)
export const COFRE_DISTRIBUICAO = { "Diário": 0.50, "Sonhos": 0.20, "Poupança": 0.1875, "Doação": 0.0625 };
export const DEFAULT_ALLOWANCE = { "Diário": 4.0, "Sonhos": 2.0, "Poupança": 1.5, "Doação": 0.5 };

const DAY = 86400000;
export const isoDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
export const parseDate = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };
export const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
export const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate()+n); return r; };
const diffDays = (a, b) => Math.round((a - b) / DAY);

// Sabado: Python weekday() 5 (segunda=0). JS getDay(): sabado=6.
export function nextSaturday(base = today()) {
  const pyWeekday = (base.getDay() + 6) % 7;
  const ahead = (5 - pyWeekday + 7) % 7;
  return ahead === 0 ? base : addDays(base, ahead);
}

export const weeklyValue = allowance => Object.values(allowance).reduce((a, b) => a + Number(b), 0);

export function newChild() {
  return {
    allowance: { ...DEFAULT_ALLOWANCE },
    cofres: Object.fromEntries(Object.keys(DEFAULT_ALLOWANCE).map(k => [k, 0])),
    last_paid: isoDate(nextSaturday()),
    debt: 0,
    last_payment_date: null,
    transactions: [],
  };
}

export function ensureChild(c) {
  c.allowance ??= { ...DEFAULT_ALLOWANCE };
  c.cofres ??= {};
  for (const k of Object.keys(DEFAULT_ALLOWANCE)) c.cofres[k] ??= 0;
  c.last_paid ??= isoDate(nextSaturday());
  c.debt ??= 0;
  c.last_payment_date ??= null;
  c.transactions ??= [];
}

export function addTransaction(c, tipo, cofre, descricao, montante) {
  c.transactions.push({ date: new Date().toISOString(), type: tipo, cofre, description: descricao, amount: Number(montante) });
}

// Acumula divida por semanas completas passadas desde last_paid (igual ao original)
export function validateDebt(c) {
  const lp = parseDate(c.last_paid);
  const t = today();
  if (lp >= t) return false;
  const weeks = Math.floor(diffDays(t, lp) / 7);
  if (weeks <= 0) return false;
  c.debt += weeklyValue(c.allowance) * weeks;
  c.last_paid = isoDate(addDays(lp, 7 * weeks));
  return true;
}

export function spend(c, cofre, valor, descricao) {
  if (!(cofre in c.cofres)) throw new Error("Cofre inválido");
  if (!(valor > 0)) throw new Error("Valor inválido");
  if (c.cofres[cofre] < valor - 1e-9) throw new Error("Saldo insuficiente");
  c.cofres[cofre] -= valor;
  addTransaction(c, "Débito", cofre, descricao || "Gasto", valor);
}

export function payWeekly(c) {
  validateDebt(c);
  const weekly = weeklyValue(c.allowance);
  for (const [cofre, p] of Object.entries(COFRE_DISTRIBUICAO)) {
    c.cofres[cofre] += weekly * p;
    addTransaction(c, "Crédito", cofre, "Mesada semanal", weekly * p);
  }
  if (c.debt > 0) {
    const d = c.debt;
    for (const [cofre, p] of Object.entries(COFRE_DISTRIBUICAO)) {
      c.cofres[cofre] += d * p;
      addTransaction(c, "Crédito", cofre, "Pagamento de dívida", d * p);
    }
    c.debt = 0;
  }
  c.last_payment_date = isoDate(today());
  c.last_paid = isoDate(addDays(parseDate(c.last_paid), 7));
}

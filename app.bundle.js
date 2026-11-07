/* Painel H.B v0.6.1 · bundle gerado por tools/build-app.mjs. Edite os módulos-fonte, não este arquivo. */
(() => {
  // html-utils.js
  var escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

  // panel-organization.js
  var settingsView = "Fontes";
  var work = ["agendados", "tasks", "agenda"];
  function organizePanel(route2) {
    const root = document.getElementById("content");
    if (!root) return;
    document.getElementById("update-all").hidden = !["home", "cases", "notifications", "publications", "sources"].includes(route2);
    const nav = document.getElementById("navigation");
    if (!nav.querySelector("[data-work-menu]")) {
      const links = work.map((k) => nav.querySelector(`[href="#${k}"]`)).filter(Boolean);
      const group = document.createElement("div");
      group.dataset.workMenu = "";
      group.innerHTML = '<a class="nav-item" href="#agendados">Trabalho</a>';
      links[0]?.before(group);
      for (const link of links) {
        link.classList.add("work-subnav");
        group.append(link);
      }
    }
    for (const link of nav.querySelectorAll(".work-subnav")) link.hidden = !work.includes(route2);
    if (work.includes(route2) && !root.querySelector("[data-work-views]")) {
      const bar = document.createElement("nav");
      bar.dataset.workViews = "";
      bar.className = "organization-tabs";
      bar.setAttribute("aria-label", "Vistas de Trabalho");
      bar.innerHTML = work.map((k, i) => `<a class="button ${k === route2 ? "primary" : "secondary"}" href="#${k}" ${k === route2 ? 'aria-current="page"' : ""}>${["Por processo", "Tarefas", "Agenda"][i]}</a>`).join("");
      root.prepend(bar);
    }
    if (route2 !== "sources") return;
    let tabs = root.querySelector("[data-settings-views]");
    if (!tabs) {
      tabs = document.createElement("nav");
      tabs.dataset.settingsViews = "";
      tabs.className = "organization-tabs";
      tabs.setAttribute("aria-label", "Seções de Ajustes");
      for (const name of ["Fontes", "Automação", "Dados", "Diagnóstico"]) {
        const button2 = document.createElement("button");
        button2.type = "button";
        button2.className = "button secondary";
        button2.textContent = name;
        button2.onclick = () => {
          settingsView = name;
          apply();
        };
        tabs.append(button2);
        const section = document.createElement("div");
        section.dataset.settingsSection = name;
        root.append(section);
      }
      root.prepend(tabs);
    }
    const destination = (name) => root.querySelector(`[data-settings-section="${name}"]`);
    const panels = [...root.querySelectorAll(".panel")].filter((el) => !el.parentElement.closest(".panel"));
    for (const panel2 of panels) {
      if (panel2.closest("[data-settings-section]")) continue;
      const heading = panel2.querySelector("h2")?.textContent || "";
      const group = panel2.querySelector("#auto-form") ? "Automação" : heading.includes("Dados sob") ? "Dados" : /Histórico|Comparação|evidências|Conectividade|Integridade|Preparar/.test(heading) ? "Diagnóstico" : "Fontes";
      destination(group).append(panel2);
    }
    const jobs = root.querySelector("#integrated-service-jobs");
    if (jobs) destination("Diagnóstico").append(jobs);
    for (const grid of [...root.querySelectorAll(".two-columns")]) if (!grid.children.length) grid.remove();
    function apply() {
      for (const section of root.querySelectorAll("[data-settings-section]")) section.hidden = section.dataset.settingsSection !== settingsView;
      for (const button2 of tabs.children) {
        button2.className = "button " + (button2.textContent === settingsView ? "primary" : "secondary");
        button2.setAttribute("aria-pressed", String(button2.textContent === settingsView));
      }
    }
    apply();
  }

  // safe-dates.js
  function safeDateLabel(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value)) return "Sem data";
    const day = value.slice(0, 10), d = /* @__PURE__ */ new Date(day + "T12:00:00Z");
    if (!Number.isFinite(d.valueOf()) || d.toISOString().slice(0, 10) !== day) return "Sem data";
    return day.slice(8) + "/" + day.slice(5, 7) + "/" + day.slice(0, 4);
  }
  function validStoredDate(value) {
    return typeof value === "string" && value.length <= 40 && /^\d{4}-\d{2}-\d{2}(?:$|T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})?$)/.test(value) && safeDateLabel(value) !== "Sem data" && Number.isFinite(Date.parse(value));
  }

  // core.js
  var VERSION = "0.6.1";
  function taskView(tasks2, query2 = "", filter2 = "open") {
    if (!["open", "done", "all"].includes(filter2)) throw Error("Filtro de tarefas inválido.");
    const fold2 = (v) => String(v ?? "").normalize("NFD").replace(new RegExp("\\p{M}", "gu"), "").toLocaleLowerCase("pt-BR");
    const needle = fold2(query2).trim(), matches = tasks2.filter((t) => fold2(t.title).includes(needle));
    const done = matches.filter((t) => t.stage === "done").length;
    return {
      counts: { open: matches.length - done, done, all: matches.length },
      rows: matches.filter((t) => filter2 === "all" || (filter2 === "done" ? t.stage === "done" : t.stage !== "done"))
    };
  }
  var SCHEMA = 2;
  var PUBLIC_DATAJUD_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
  var STAGES = { todo: "A fazer", doing: "Fazendo", ready: "Pronto para protocolar", done: "Concluído" };
  var WORK_OWNERS = Object.freeze({ me: "Comigo", court: "Com o juízo", other: "Parte contrária", client: "Com o cliente" });
  var WORK_STATUSES = Object.freeze({ todo: "A fazer", doing: "Fazendo", ready: "Pronto para protocolar", done: "Feito" });
  var JUDICIAL_SYSTEMS = { "": "Não identificado", eproc: "eproc", pje: "PJe", projudi: "Projudi", portal: "Consulta processual TJRJ" };
  var COURTS = { "": "Não informado", tjrj: "TJRJ", trf2: "TRF2", tjsp: "TJSP", stj: "STJ", stf: "STF", other: "Outro tribunal" };
  var COURT_LEVELS = { "": "Não informado", first: "1º grau", second: "2º grau", jec: "Juizado especial estadual", state_panel: "Turma recursal estadual", jef: "Juizado especial federal (JEF)", federal_panel: "Turma recursal federal", superior: "Tribunal superior", other: "Outro grau" };
  var PROCESS_SYSTEMS = { "": "Não informado", eproc: "eproc", pje: "PJe", projudi: "Projudi", esaj: "e-SAJ", portal: "Portal próprio", other: "Outro sistema" };
  var normalizeDocket = (value) => String(value ?? "").trim().replace(/\s+/gu, " ").toLocaleLowerCase("pt-BR");
  function validDatajudDetails(details, cnj) {
    if (!details || typeof details !== "object" || Array.isArray(details) || !validCnj(cnj) || details.cnj !== cnj) return false;
    const limits = { recordId: 150, tribunal: 35, grau: 35, sistema: 100, classe: 180, orgao: 180, dataAjuizamento: 45, sourceUpdatedAt: 45 };
    if (Object.entries(limits).some(([key, max]) => typeof details[key] !== "string" || details[key].length > max)) return false;
    if (!Array.isArray(details.assuntos) || details.assuntos.length > 20 || details.assuntos.some((x) => typeof x !== "string" || x.length > 180)) return false;
    return true;
  }
  var MANUAL_COURT_SOURCES = Object.freeze({
    tjrj: Object.freeze(["portal", "eproc", "pje", "projudi"]),
    trf2: Object.freeze(["portal", "eproc", "pje"]),
    tjsp: Object.freeze(["portal", "eproc", "esaj"]),
    stj: Object.freeze(["portal"]),
    stf: Object.freeze(["portal"])
  });
  function manualCheckCourt(c) {
    if (c?.court) return c.court;
    return validCnj(c?.cnj) && digits(c.cnj).slice(13, 16) === "819" ? "tjrj" : "";
  }
  function sameManualIdentity(c, item) {
    if (!c || !item || String(item.cnj || "") !== String(c.cnj || "")) return false;
    if (item.court === void 0) return manualCheckCourt(c) === "tjrj";
    return item.court === manualCheckCourt(c) && String(item.docketNumber || "") === String(c.docketNumber || "");
  }
  var courtLevels = { tjrj: ["first", "second", "jec", "state_panel", "other"], tjsp: ["first", "second", "jec", "state_panel", "other"], trf2: ["first", "second", "jef", "federal_panel", "other"], stj: ["superior", "other"], stf: ["superior", "other"] };
  function validateCaseHierarchy(state2, caseId, fields2) {
    const { court = "", courtLevel = "", processSystem = "", parentCaseId = "", docketNumber = "", originReference = "" } = fields2;
    if (!Object.hasOwn(COURTS, court) || !Object.hasOwn(COURT_LEVELS, courtLevel) || !Object.hasOwn(PROCESS_SYSTEMS, processSystem)) throw Error("Tribunal, grau ou sistema de tramitação inválido.");
    if (court && court !== "other" && courtLevel && !courtLevels[court].includes(courtLevel)) throw Error("Grau judicial incompatível com o tribunal informado.");
    if (typeof parentCaseId !== "string" || typeof docketNumber !== "string" || docketNumber.length > 100 || typeof originReference !== "string" || originReference.length > 120) throw Error("Referência processual inválida ou muito longa.");
    if (parentCaseId) {
      if (parentCaseId === caseId) throw Error("Um processo não pode ser sua própria origem.");
      const found = state2.cases.find((c) => c.id === parentCaseId);
      if (!found) throw Error("Processo de origem não encontrado.");
      const visited = /* @__PURE__ */ new Set([caseId]);
      let current = found;
      while (current) {
        if (visited.has(current.id)) throw Error("Vínculo processual circular não permitido.");
        visited.add(current.id);
        current = current.parentCaseId ? state2.cases.find((c) => c.id === current.parentCaseId) : null;
      }
    }
    return true;
  }
  var MANUAL_CHECK_RESULTS = { no_changes: "Sem novidade identificada", change: "Movimentação identificada", attention: "Requer acompanhamento", unavailable: "Consulta não concluída" };
  var COVERAGE_RESULTS = { match: "Coincidente na amostra", difference: "Divergência observada", unavailable: "Fonte indisponível", inconclusive: "Comparação inconclusiva" };
  var TABLES = ["clients", "cases", "tasks", "appointments", "fees", "events", "jobs", "payments", "documents", "coverageSamples"];
  var JOB_STATES = ["queued", "running", "success", "not_found", "error", "action", "cancelled", "interrupted"];
  var uid = () => crypto.randomUUID();
  var now = () => (/* @__PURE__ */ new Date()).toISOString();
  var digits = (value) => String(value ?? "").replace(/\D/g, "");
  var clean = (value, max = 4e3) => String(value ?? "").trim().slice(0, max);
  function dateKey(date2 = /* @__PURE__ */ new Date()) {
    return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(date2);
  }
  function emptyState() {
    return { schemaVersion: SCHEMA, revision: 0, clients: [], cases: [], tasks: [], appointments: [], fees: [], events: [], jobs: [], payments: [], documents: [], coverageSamples: [], settings: { datajudKey: PUBLIC_DATAJUD_KEY, datajud: false, djen: true, djenDays: 30, oab: "", ufOab: "", autoUpdateEnabled: true, autoUpdateTimes: "08:00,18:00", autoUpdateLast: "" } };
  }
  function validDay(value) {
    if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value)) return false;
    const d = /* @__PURE__ */ new Date(value + "T12:00:00Z");
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }
  function validDateTime(value) {
    if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) return false;
    const [day, time2] = value.split("T");
    const [hour, minute] = time2.split(":").map(Number);
    return validDay(day) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
  }
  function caseForWorkflow(state2, caseId) {
    const c = state2.cases.find((row) => row.id === caseId);
    if (!c) throw Error("Processo não encontrado para acompanhamento.");
    if (c.archived) throw Error("Desarquive o processo para editar o acompanhamento.");
    return c;
  }
  function updateCaseWorkflow(state2, caseId, input) {
    const c = caseForWorkflow(state2, caseId);
    if (typeof input.nextStep !== "string" || input.nextStep.length > 500) throw Error("Descreva o próximo passo em até 500 caracteres.");
    if (!Object.hasOwn(WORK_OWNERS, input.workOwner)) throw Error("Escolha um responsável válido.");
    if (!Object.hasOwn(WORK_STATUSES, input.workStatus)) throw Error("Escolha uma situação válida para o próximo passo.");
    if (typeof input.review !== "string" || input.review && !validDay(input.review)) throw Error("Informe uma data válida para revisar.");
    Object.assign(c, { nextStep: clean(input.nextStep, 500), workOwner: input.workOwner, workStatus: input.workStatus, review: input.review, updatedAt: now() });
    return c;
  }
  function markCaseReviewed(state2, caseId) {
    const c = caseForWorkflow(state2, caseId);
    c.reviewedAt = now();
    c.updatedAt = c.reviewedAt;
    return c;
  }
  function addCasePending(state2, caseId, title) {
    const c = caseForWorkflow(state2, caseId);
    if (typeof title !== "string" || !title.trim() || title.length > 240) throw Error("Descreva a pendência em até 240 caracteres.");
    if (!Array.isArray(c.pendingItems)) c.pendingItems = [];
    if (c.pendingItems.length >= 80) throw Error("Máximo de 80 pendências por processo.");
    const item = { id: uid(), title: clean(title, 240), done: false, createdAt: now(), completedAt: "" };
    c.pendingItems.push(item);
    c.updatedAt = now();
    return item;
  }
  function toggleCasePending(state2, caseId, pendingId) {
    const c = caseForWorkflow(state2, caseId);
    const item = (c.pendingItems || []).find((row) => row.id === pendingId);
    if (!item) throw Error("Pendência não encontrada neste processo.");
    item.done = !item.done;
    item.completedAt = item.done ? now() : "";
    c.updatedAt = now();
    return item;
  }
  function removeCasePending(state2, caseId, pendingId) {
    const c = caseForWorkflow(state2, caseId);
    const index = (c.pendingItems || []).findIndex((row) => row.id === pendingId);
    if (index < 0) throw Error("Pendência não encontrada neste processo.");
    const [item] = c.pendingItems.splice(index, 1);
    c.updatedAt = now();
    return item;
  }
  function migrateState(input) {
    if (!input) return emptyState();
    if (input.schemaVersion === 2) {
      const state3 = input.coverageSamples === void 0 ? { ...input, coverageSamples: [] } : input;
      state3.settings = { ...emptyState().settings, ...state3.settings && typeof state3.settings === "object" ? state3.settings : {} };
      return state3;
    }
    if (input.schemaVersion !== 1) throw Error("Versão do banco não suportada.");
    const state2 = structuredClone(input);
    state2.payments = [];
    state2.documents = [];
    state2.coverageSamples = [];
    for (const f of state2.fees || []) if (f.paid > 0) state2.payments.push({ id: "opening:" + f.id, feeId: f.id, amount: f.paid, kind: "receipt", date: dateKey(), notes: "Saldo recebido importado da versão 0.1. A data deste lançamento é a da migração; as datas originais dos recebimentos não estavam disponíveis.", opening: true, createdAt: now() });
    state2.schemaVersion = 2;
    state2.revision = (state2.revision || 0) + 1;
    state2.settings = { ...emptyState().settings, ...state2.settings && typeof state2.settings === "object" ? state2.settings : {} };
    return state2;
  }
  function feeReceived(state2, feeId) {
    return state2.payments.filter((p2) => p2.feeId === feeId).reduce((sum, p2) => sum + (p2.kind === "reversal" ? -p2.amount : p2.amount), 0);
  }
  function registerPayment(state2, input) {
    const fee = state2.fees.find((f) => f.id === input.feeId);
    if (!fee) throw Error("Honorário não encontrado.");
    const amount = cents(input.amount);
    if (amount <= 0 || amount > fee.amount - feeReceived(state2, fee.id)) throw Error("Recebimento deve ser positivo e não pode superar o saldo.");
    if (!validDay(input.date)) throw Error("Informe a data válida do recebimento.");
    const p2 = { id: uid(), feeId: fee.id, amount, kind: "receipt", date: input.date, notes: clean(input.notes), createdAt: now() };
    state2.payments.push(p2);
    fee.paid = feeReceived(state2, fee.id);
    return p2;
  }
  function reversePayment(state2, id, input) {
    const original = state2.payments.find((p3) => p3.id === id && p3.kind === "receipt");
    if (!original) throw Error("Recebimento não encontrado.");
    if (state2.payments.some((p3) => p3.reverses === id)) throw Error("Este recebimento já foi estornado.");
    if (!validDay(input.date) || input.date < original.date) throw Error("Data de estorno inválida ou anterior ao recebimento.");
    if (!clean(input.notes)) throw Error("Informe o motivo do estorno.");
    const p2 = { id: uid(), feeId: original.feeId, amount: original.amount, kind: "reversal", reverses: id, date: input.date, notes: clean(input.notes), createdAt: now() };
    state2.payments.push(p2);
    state2.fees.find((f) => f.id === p2.feeId).paid = feeReceived(state2, p2.feeId);
    return p2;
  }
  function registerManualCheck(state2, input) {
    const c = state2.cases.find((x) => x.id === input.caseId);
    const court = manualCheckCourt(c);
    if (!c || !MANUAL_COURT_SOURCES[court] || !(validCnj(c.cnj) || String(c.docketNumber || "").trim())) throw Error("Informe um tribunal atendido e um CNJ válido ou registro processual.");
    const source = String(input.source || ""), result = String(input.result || ""), notes = clean(input.notes, 2e3);
    if (!MANUAL_COURT_SOURCES[court].includes(source)) throw Error("Selecione um portal disponível para o tribunal informado.");
    if (!Object.hasOwn(MANUAL_CHECK_RESULTS, result)) throw Error("Selecione o resultado da conferência.");
    if (["change", "attention", "unavailable"].includes(result) && !notes) throw Error("Descreva o resultado da conferência.");
    if (String(input.notes || "").trim().length > 2e3) throw Error("Observações excedem 2.000 caracteres.");
    if (!Array.isArray(c.manualChecks)) c.manualChecks = [];
    if (c.manualChecks.length >= 500) throw Error("Limite de 500 conferências por processo. Exporte um backup antes de prosseguir.");
    const record = { id: uid(), cnj: c.cnj || "", docketNumber: c.docketNumber || "", court, source, result, notes, checkedAt: now() };
    c.manualChecks.push(record);
    c.manualCheckedAt = record.checkedAt;
    c.updatedAt = now();
    return record;
  }
  function latestCoverageJob(state2, caseId, source) {
    const c = state2.cases.find((x) => x.id === caseId);
    if (!c || !validCnj(c.cnj) || !["djen", "datajud"].includes(source)) return null;
    return [...state2.jobs].reverse().find((j2) => j2.caseId === c.id && j2.cnj === c.cnj && j2.source === source && ["success", "not_found", "action", "error", "interrupted"].includes(j2.status)) || null;
  }
  function registerCoverageSample(state2, input) {
    const c = state2.cases.find((x) => x.id === input.caseId);
    if (!c || !validCnj(c.cnj)) throw Error("Selecione um processo cadastrado com CNJ válido.");
    const source = String(input.source || ""), result = String(input.result || ""), referenceDate = String(input.referenceDate || ""), notes = clean(input.notes, 1500);
    if (!["djen", "datajud"].includes(source)) throw Error("Selecione a fonte a comparar.");
    if (!Object.hasOwn(COVERAGE_RESULTS, result)) throw Error("Selecione o resultado da comparação.");
    if (!validDay(referenceDate) || referenceDate > dateKey()) throw Error("Informe a data da conferência no portal oficial.");
    if (String(input.notes || "").trim().length > 1500 || notes.length < 12) throw Error("Descreva o que foi comparado no portal oficial (12 a 1.500 caracteres).");
    const job = latestCoverageJob(state2, c.id, source);
    if (["match", "difference"].includes(result) && !["success", "not_found"].includes(job?.status)) throw Error("Execute primeiro uma consulta concluída nessa fonte antes de declarar coincidência ou divergência.");
    if (!Array.isArray(state2.coverageSamples)) state2.coverageSamples = [];
    if (state2.coverageSamples.length >= 2e3) throw Error("Limite de 2.000 amostras atingido. Exporte um backup antes de prosseguir.");
    const sample = { id: uid(), caseId: c.id, cnj: c.cnj, court: c.court || "", courtLevel: c.courtLevel || "", processSystem: c.processSystem || "", source, result, referenceDate, notes, jobId: job?.id || "", checkedAt: now() };
    state2.coverageSamples.push(sample);
    return sample;
  }
  function currentCoverageSample(c, sample) {
    if (!c || c.id !== sample.caseId || c.cnj !== sample.cnj) return false;
    return ["court", "courtLevel", "processSystem"].every((key) => !Object.hasOwn(sample, key) || sample[key] === (c[key] || ""));
  }
  function coverageSummary(state2) {
    const byId = new Map(state2.cases.map((c) => [c.id, c]));
    const current = (state2.coverageSamples || []).filter((s) => currentCoverageSample(byId.get(s.caseId), s));
    const result = { total: current.length, history: (state2.coverageSamples || []).length, sources: {} };
    for (const source of ["djen", "datajud"]) {
      const selected2 = current.filter((s) => s.source === source);
      result.sources[source] = { total: selected2.length, match: selected2.filter((s) => s.result === "match").length, difference: selected2.filter((s) => s.result === "difference").length, unavailable: selected2.filter((s) => s.result === "unavailable").length, inconclusive: selected2.filter((s) => s.result === "inconclusive").length };
    }
    return result;
  }
  function coverageEvidenceMatrix(state2) {
    const byId = new Map(state2.cases.map((c) => [c.id, c]));
    const last = /* @__PURE__ */ new Map();
    for (const item of state2.coverageSamples || []) last.set(item.caseId + "|" + item.source, item);
    const groups = /* @__PURE__ */ new Map();
    let outdated = 0;
    const countedCases = /* @__PURE__ */ new Set();
    for (const sample of last.values()) {
      if (!currentCoverageSample(byId.get(sample.caseId), sample)) {
        outdated++;
        continue;
      }
      const court = sample.court ?? "", courtLevel = sample.courtLevel ?? "", processSystem = sample.processSystem ?? "";
      const key = JSON.stringify([court, courtLevel, processSystem, sample.source]);
      if (!groups.has(key)) groups.set(key, { court, courtLevel, processSystem, source: sample.source, cases: 0, match: 0, difference: 0, unavailable: 0, inconclusive: 0 });
      const row = groups.get(key);
      row.cases++;
      row[sample.result]++;
      countedCases.add(sample.caseId);
    }
    const order = ["tjrj", "trf2", "tjsp", "stj", "stf", "other", ""];
    const rows = [...groups.values()].sort((a, b) => order.indexOf(a.court) - order.indexOf(b.court) || a.courtLevel.localeCompare(b.courtLevel) || a.processSystem.localeCompare(b.processSystem) || a.source.localeCompare(b.source));
    return {
      rows,
      distinctCases: countedCases.size,
      latestComparisons: rows.reduce((n, r) => n + r.cases, 0),
      historical: (state2.coverageSamples || []).length,
      outdated,
      noSamples: ["tjrj", "trf2", "tjsp", "stj", "stf"].filter((court) => !rows.some((r) => r.court === court))
    };
  }
  function pendingManualReviews(state2) {
    return state2.cases.filter((c) => !c.archived).flatMap((c) => {
      const latest = [...c.manualChecks || []].reverse().find((x) => sameManualIdentity(c, x));
      if (!latest || !["attention", "change", "unavailable"].includes(latest.result)) return [];
      if (state2.tasks.some((t) => t.caseId === c.id && t.manualCheckId === latest.id)) return [];
      return [{ caseId: c.id, checkId: latest.id, result: latest.result, source: latest.source, notes: latest.notes, checkedAt: latest.checkedAt }];
    }).sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
  }
  function pendingSourceIssues(state2) {
    const issues = [], terminal = /* @__PURE__ */ new Set(["success", "not_found", "action", "error", "interrupted"]);
    for (const c of state2.cases) {
      if (c.archived || !c.cnj) continue;
      for (const source of ["datajud", "djen"]) {
        if (!state2.settings[source]) continue;
        const jobs = state2.jobs.filter((j2) => j2.caseId === c.id && j2.cnj === c.cnj && j2.source === source);
        const latest = [...jobs].reverse().find((j2) => terminal.has(j2.status));
        if (!latest || !["action", "error", "interrupted"].includes(latest.status)) continue;
        issues.push({
          jobId: latest.id,
          caseId: c.id,
          cnj: c.cnj,
          source,
          status: latest.status,
          message: latest.message || "Consulta não concluída",
          updatedAt: latest.updatedAt,
          partial: latest.count > 0,
          retrying: jobs.some((j2) => ["queued", "running"].includes(j2.status))
        });
      }
    }
    return issues.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }
  function retrySourceJob(state2, jobId) {
    const j2 = state2.jobs.find((x) => x.id === jobId);
    if (!j2 || !j2.caseId || !["action", "error", "interrupted"].includes(j2.status)) throw Error("Consulta sem falha elegível para nova tentativa.");
    const c = state2.cases.find((x) => x.id === j2.caseId);
    if (!c || c.archived || !c.cnj || c.cnj !== j2.cnj) throw Error("O processo foi alterado ou arquivado.");
    if (!state2.settings[j2.source]) throw Error("A fonte está desativada nas configurações.");
    const latest = [...state2.jobs].reverse().find((x) => x.caseId === c.id && x.cnj === c.cnj && x.source === j2.source && ["success", "not_found", "action", "error", "interrupted"].includes(x.status));
    if (latest?.id !== j2.id) throw Error("Existe um resultado mais recente para esta fonte.");
    if (j2.source === "djen" && (j2.periodStart || j2.periodEnd) && (!validDay(j2.periodStart) || !validDay(j2.periodEnd) || j2.periodStart > j2.periodEnd)) throw Error("Período da consulta anterior inválido. Verifique o histórico antes de repetir.");
    const added = enqueue(state2, [c.id], [j2.source]);
    if (added && j2.source === "djen" && (j2.periodStart || j2.periodEnd)) {
      const queued = state2.jobs.at(-1);
      queued.periodStart = j2.periodStart;
      queued.periodEnd = j2.periodEnd;
    }
    return added;
  }
  function pendingOabIssue(state2) {
    const { oab, ufOab, djen: djen2 } = state2.settings;
    if (!djen2 || !/^\d{1,8}[A-Za-z]?$/.test(oab) || !/^[A-Z]{2}$/.test(ufOab)) return null;
    const jobs = state2.jobs.filter((j2) => !j2.caseId && j2.source === "djen" && j2.oab === oab && j2.ufOab === ufOab);
    const terminal = /* @__PURE__ */ new Set(["success", "not_found", "action", "error", "interrupted"]);
    const latest = [...jobs].reverse().find((j2) => terminal.has(j2.status));
    if (!latest || !["action", "error", "interrupted"].includes(latest.status)) return null;
    return {
      jobId: latest.id,
      oab,
      ufOab,
      status: latest.status,
      message: latest.message || "Consulta não concluída",
      updatedAt: latest.updatedAt,
      partial: latest.count > 0,
      retrying: jobs.some((j2) => ["queued", "running"].includes(j2.status))
    };
  }
  function retryOabJob(state2, jobId) {
    const j2 = state2.jobs.find((x) => x.id === jobId);
    if (!j2 || j2.caseId || j2.source !== "djen" || !["action", "error", "interrupted"].includes(j2.status)) throw Error("Busca por OAB sem falha elegível para nova tentativa.");
    if (!state2.settings.djen) throw Error("DJEN está desativado nas configurações.");
    if (j2.oab !== state2.settings.oab || j2.ufOab !== state2.settings.ufOab) throw Error("A OAB configurada foi alterada. Confira os dados antes de tentar novamente.");
    const latest = [...state2.jobs].reverse().find((x) => !x.caseId && x.source === "djen" && x.oab === j2.oab && x.ufOab === j2.ufOab && ["success", "not_found", "action", "error", "interrupted"].includes(x.status));
    if (latest?.id !== j2.id) throw Error("Existe um resultado mais recente para esta OAB.");
    return enqueueOab(state2, { periodStart: j2.periodStart, periodEnd: j2.periodEnd });
  }
  function validCnj(value) {
    const n = digits(value);
    if (n.length !== 20) return false;
    const check = 98n - BigInt(n.slice(0, 7) + n.slice(9) + "00") % 97n;
    return n.slice(7, 9) === String(check).padStart(2, "0");
  }
  function formatCnj(value) {
    const n = digits(value);
    return n.length === 20 ? `${n.slice(0, 7)}-${n.slice(7, 9)}.${n.slice(9, 13)}.${n[13]}.${n.slice(14, 16)}.${n.slice(16)}` : value;
  }
  var TJ = { 1: "tjac", 2: "tjal", 3: "tjap", 4: "tjam", 5: "tjba", 6: "tjce", 7: "tjdft", 8: "tjes", 9: "tjgo", 10: "tjma", 11: "tjmt", 12: "tjms", 13: "tjmg", 14: "tjpa", 15: "tjpb", 16: "tjpr", 17: "tjpe", 18: "tjpi", 19: "tjrj", 20: "tjrn", 21: "tjrs", 22: "tjro", 23: "tjrr", 24: "tjsc", 25: "tjse", 26: "tjsp", 27: "tjto" };
  function tribunalAlias(cnj) {
    const n = digits(cnj), j2 = n[13], t = Number(n.slice(14, 16));
    if (!validCnj(cnj)) return null;
    if (j2 === "8") return TJ[t] || null;
    if (j2 === "4" && t >= 1 && t <= 6) return "trf" + t;
    if (j2 === "5" && t >= 1 && t <= 24) return "trt" + t;
    if (j2 === "5" && t === 0) return "tst";
    if (j2 === "6" && t >= 1 && t <= 27) return "tre-" + (TJ[t] || "").replace(/^tj/, "");
    if (j2 === "6" && t === 0) return "tse";
    if (j2 === "7" && t === 0) return "stm";
    if (j2 === "9" && [13, 21, 26].includes(t)) return "tjm" + (TJ[t] || "").replace(/^tj/, "");
    if (j2 === "3" && t === 0) return "stj";
    return null;
  }
  var money = (cents2) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents2 || 0) / 100);
  function cents(value) {
    if (!/^\d+(\.\d{1,2})?$/.test(String(value))) throw Error("Informe um valor válido, com até duas casas decimais.");
    const result = Math.round(Number(value) * 100);
    if (!Number.isSafeInteger(result) || result > 1e11) throw Error("Valor fora do limite.");
    return result;
  }
  function cnjChangeImpact(state2, caseId) {
    const c = state2.cases.find((x) => x.id === caseId);
    if (!c) throw Error("Processo não encontrado.");
    const fees = state2.fees.filter((f) => f.caseId === caseId);
    const feeIds = new Set(fees.map((f) => f.id));
    return {
      tasks: state2.tasks.filter((t) => t.caseId === caseId).length,
      appointments: state2.appointments.filter((a) => a.caseId === caseId).length,
      fees: fees.length,
      payments: state2.payments.filter((p2) => feeIds.has(p2.feeId)).length,
      documents: state2.documents.filter((d) => d.caseId === caseId).length,
      manualChecks: (c.manualChecks || []).filter((x) => sameManualIdentity(c, x)).length,
      events: state2.events.filter((e) => e.caseId === caseId && digits(e.cnj) === c.cnj).length,
      jobs: state2.jobs.filter((j2) => j2.caseId === caseId && j2.cnj === c.cnj && ["queued", "running"].includes(j2.status)).length
    };
  }
  function saveEntity(state2, table, input) {
    if (!["clients", "cases", "tasks", "appointments", "fees"].includes(table)) throw Error("Cadastro desconhecido.");
    const old = state2[table].find((x) => x.id === input.id), id = old?.id || uid();
    const row = { ...old, id, createdAt: old?.createdAt || now(), updatedAt: now() };
    if (table === "clients") {
      Object.assign(row, { name: clean(input.name, 180), phone: clean(input.phone, 40), email: clean(input.email, 180), notes: clean(input.notes) });
      if (!row.name) throw Error("Informe o nome do cliente.");
    }
    if (table === "cases") {
      const cnj = digits(input.cnj);
      if (cnj && !validCnj(cnj)) throw Error("Número CNJ inválido. Confira os 20 dígitos e os verificadores.");
      if (cnj && state2.cases.some((x) => x.cnj === cnj && x.id !== id)) throw Error("Este processo já está cadastrado.");
      if (old?.cnj && old.cnj !== cnj && input.confirmCnjChange !== "yes") throw Error("Confirme a correção do CNJ e revise os vínculos antes de salvar.");
      const court = input.court === void 0 ? old?.court || "" : String(input.court);
      const courtLevel = input.courtLevel === void 0 ? old?.courtLevel || "" : String(input.courtLevel);
      const processSystem = input.processSystem === void 0 ? old?.processSystem || "" : String(input.processSystem);
      const parentCaseId = input.parentCaseId === void 0 ? old?.parentCaseId || "" : String(input.parentCaseId);
      const docketNumber = input.docketNumber === void 0 ? old?.docketNumber || "" : String(input.docketNumber).trim();
      const originReference = input.originReference === void 0 ? old?.originReference || "" : String(input.originReference).trim();
      validateCaseHierarchy(state2, id, { court, courtLevel, processSystem, parentCaseId, docketNumber, originReference });
      if (["stj", "stf"].includes(court) && docketNumber && state2.cases.some((c) => c.id !== id && c.court === court && normalizeDocket(c.docketNumber) === normalizeDocket(docketNumber))) throw Error("Registro adicional já cadastrado para esse tribunal superior.");
      const judicialSystem = input.judicialSystem === void 0 ? old?.judicialSystem || "" : String(input.judicialSystem);
      if (!Object.hasOwn(JUDICIAL_SYSTEMS, judicialSystem)) throw Error("Sistema judicial inválido.");
      if (judicialSystem && (!validCnj(cnj) || cnj.slice(13, 16) !== "819")) throw Error("Selecione um sistema TJRJ somente para processos do TJRJ.");
      const nextStep = input.nextStep === void 0 ? old?.nextStep || "" : String(input.nextStep ?? "").trim();
      const workOwner = input.workOwner === void 0 ? old?.workOwner || "me" : String(input.workOwner);
      const workStatus = input.workStatus === void 0 ? old?.workStatus || "todo" : String(input.workStatus);
      if (nextStep.length > 500 || !Object.hasOwn(WORK_OWNERS, workOwner) || !Object.hasOwn(WORK_STATUSES, workStatus)) throw Error("Próximo passo, situação ou responsável inválido.");
      if ((input.plaintiff ?? "").length > 400 || (input.defendant ?? "").length > 400) throw Error("Nomes das partes acima do limite de 400 caracteres.");
      Object.assign(row, {
        title: clean(input.title, 240),
        cnj,
        clientId: input.clientId || "",
        plaintiff: clean(input.plaintiff === void 0 ? old?.plaintiff || "" : input.plaintiff, 400),
        defendant: clean(input.defendant === void 0 ? old?.defendant || "" : input.defendant, 400),
        area: clean(input.area, 80),
        stage: input.stage || "todo",
        review: clean(input.review, 10),
        notes: clean(input.notes),
        judicialSystem,
        court,
        courtLevel,
        processSystem,
        parentCaseId,
        docketNumber,
        originReference,
        archived: old ? !!old.archived : input.archived === true,
        nextStep,
        workOwner,
        workStatus,
        reviewedAt: old?.reviewedAt || "",
        pendingItems: old?.pendingItems || []
      });
      if (input.datajudDetails !== void 0) {
        if (input.datajudDetails !== null && !validDatajudDetails(input.datajudDetails, cnj)) throw Error("Dados públicos do DataJud inválidos para este CNJ. Consulte novamente.");
        if (input.datajudDetails === null) delete row.datajudDetails;
        else row.datajudDetails = structuredClone(input.datajudDetails);
      } else if (old && old.cnj !== cnj) delete row.datajudDetails;
      if (old && (old.cnj !== cnj || String(old.docketNumber || "") !== docketNumber || manualCheckCourt(old) !== manualCheckCourt(row))) row.manualCheckedAt = "";
      if (!row.title) throw Error("Informe um título para o caso.");
      if (!STAGES[row.stage]) throw Error("Etapa inválida.");
      if (row.clientId && !state2.clients.some((x) => x.id === row.clientId)) throw Error("Cliente não encontrado.");
    }
    if (table === "tasks") {
      const manualCheckId = input.manualCheckId === void 0 ? old?.manualCheckId || "" : String(input.manualCheckId || "");
      if (manualCheckId) {
        const linked = state2.cases.find((c) => c.id === input.caseId);
        if (!linked?.manualChecks?.some((x) => x.id === manualCheckId)) throw Error("Conferência de origem não encontrada neste processo.");
        if (state2.tasks.some((t) => t.id !== id && t.manualCheckId === manualCheckId)) throw Error("Já existe uma tarefa vinculada a esta conferência.");
      }
      Object.assign(row, { title: clean(input.title, 240), caseId: input.caseId || "", due: clean(input.due, 10), stage: input.stage || "todo", notes: clean(input.notes), manualCheckId });
      if (!row.title || !STAGES[row.stage]) throw Error("Informe tarefa e etapa válidas.");
    }
    if (table === "appointments") {
      Object.assign(row, { title: clean(input.title, 240), caseId: input.caseId || "", when: clean(input.when, 16), kind: clean(input.kind, 40), notes: clean(input.notes) });
      if (!row.title || !validDateTime(row.when)) throw Error("Informe título e data/hora válidos.");
    }
    if (table === "fees") {
      const initial = old ? feeReceived(state2, old.id) : cents(input.paid || "0");
      if (old && input.paid !== void 0 && cents(input.paid) !== initial) throw Error("Use Recebimentos para lançar ou estornar valores.");
      Object.assign(row, { title: clean(input.title, 240), caseId: input.caseId || "", amount: cents(input.amount), paid: initial, due: clean(input.due, 10), notes: clean(input.notes) });
      if (!row.title || row.amount <= 0 || row.paid > row.amount) throw Error("O valor deve ser positivo e o recebido não pode superar o total.");
    }
    if (row.caseId && !state2.cases.some((x) => x.id === row.caseId)) throw Error("Processo não encontrado.");
    for (const field2 of ["due", "review"]) if (row[field2] && !validDay(row[field2])) throw Error("Data inválida.");
    const index = state2[table].findIndex((x) => x.id === id);
    if (index < 0) state2[table].push(row);
    else state2[table][index] = row;
    if (table === "cases") {
      if (old && old.cnj !== row.cnj) {
        row.sourceInfo = {};
        for (const job of state2.jobs) if (job.caseId === row.id && job.cnj !== row.cnj && ["queued", "running"].includes(job.status)) {
          Object.assign(job, { status: "cancelled", message: "Consulta cancelada: CNJ do processo foi corrigido.", updatedAt: now(), leaseUntil: 0 });
        }
      }
      reconcileEventLinks(state2);
    }
    if (table === "fees" && !old && row.paid > 0) state2.payments.push({ id: uid(), feeId: row.id, amount: row.paid, kind: "receipt", date: dateKey(), notes: "Recebimento inicial informado no cadastro.", createdAt: now() });
    return row;
  }
  function reconcileEventLinks(state2) {
    const byCnj = new Map(state2.cases.filter((c) => validCnj(c.cnj)).map((c) => [c.cnj, c.id]));
    let updated = 0;
    for (const event of state2.events) {
      const cnj = digits(event.cnj);
      if (!validCnj(cnj)) continue;
      const expected = byCnj.get(cnj) || "";
      if ((event.caseId || "") !== expected) {
        event.caseId = expected;
        updated++;
      }
    }
    return updated;
  }
  function mergeEvents(state2, events, caseId) {
    let added = 0;
    for (const event of events) {
      const previous = state2.events.find((x) => x.id === event.id);
      const cnj = digits(event.cnj), matched = validCnj(cnj) ? state2.cases.find((c) => c.cnj === cnj)?.id || "" : "";
      if (previous) {
        Object.assign(previous, event, {
          caseId: matched,
          seen: previous.seen,
          discoveredAt: previous.discoveredAt,
          certificateHash: event.certificateHash || previous.certificateHash || ""
        });
      } else {
        state2.events.push({ ...event, caseId: matched, seen: false, discoveredAt: now() });
        added++;
      }
    }
    return added;
  }
  function enqueue(state2, caseIds, onlySources = ["datajud", "djen"]) {
    if (!Array.isArray(onlySources) || !onlySources.length || onlySources.some((source) => !["datajud", "djen"].includes(source))) throw Error("Fonte de consulta inválida.");
    const selected2 = state2.cases.filter((x) => caseIds.includes(x.id) && !x.archived && x.cnj);
    if (!selected2.length) throw Error("Selecione ao menos um processo com CNJ válido.");
    if (!state2.settings.datajud && !state2.settings.djen) throw Error("Habilite uma fonte nas configurações.");
    let added = 0;
    for (const c of selected2) for (const source of onlySources) {
      if (!state2.settings[source]) continue;
      if (state2.jobs.some((x) => x.caseId === c.id && x.cnj === c.cnj && x.source === source && ["queued", "running"].includes(x.status))) continue;
      state2.jobs.push({ id: uid(), runId: uid(), caseId: c.id, cnj: c.cnj, source, status: "queued", createdAt: now(), updatedAt: now(), cursor: null, attempt: 0, added: 0, count: 0, message: "Na fila", leaseUntil: 0, nextAt: 0 });
      added++;
    }
    return added;
  }
  function enqueueOab(state2, options = {}) {
    if (!state2.settings.djen) throw Error("DJEN está desativado. Habilite a fonte em Fontes e ajustes antes de buscar por OAB.");
    if (!/^\d{1,8}[A-Za-z]?$/.test(state2.settings.oab) || !/^[A-Z]{2}$/.test(state2.settings.ufOab)) throw Error("Configure OAB e UF antes da busca.");
    if (state2.jobs.some((x) => x.oab === state2.settings.oab && x.ufOab === state2.settings.ufOab && ["queued", "running"].includes(x.status))) return 0;
    if (options.periodStart !== void 0 && options.periodStart !== "" && !validDay(options.periodStart)) throw Error("Período inicial da consulta inválido.");
    if (options.periodEnd !== void 0 && options.periodEnd !== "" && !validDay(options.periodEnd)) throw Error("Período final da consulta inválido.");
    if (options.periodStart && options.periodEnd && options.periodStart > options.periodEnd) throw Error("Período da consulta invertido.");
    state2.jobs.push({ id: uid(), caseId: "", source: "djen", oab: state2.settings.oab, ufOab: state2.settings.ufOab, status: "queued", createdAt: now(), updatedAt: now(), cursor: null, attempt: 0, added: 0, count: 0, message: "Na fila", leaseUntil: 0, nextAt: 0, ...options });
    return 1;
  }
  var backup = (state2) => ({ format: "pauta-backup", version: 2, createdAt: now(), state: { ...structuredClone(state2), jobs: state2.jobs.map((x) => ["queued", "running"].includes(x.status) ? { ...x, status: "interrupted", needsManualRetry: true, leaseUntil: 0, message: "Pendente no momento do backup. Revise e repita manualmente; não há retomada automática após restauração." } : x), settings: { ...state2.settings, datajudKey: "" } } });
  function validateBackup(value) {
    if (value?.format !== "pauta-backup" || ![1, 2].includes(value.version) || ![1, 2].includes(value.state?.schemaVersion)) throw Error("Arquivo não é um backup Pauta compatível.");
    const s = migrateState(structuredClone(value.state));
    if (!s.settings || typeof s.settings !== "object" || Array.isArray(s.settings)) throw Error("Configurações inválidas no backup.");
    if (typeof s.settings.datajud !== "boolean" || typeof s.settings.djen !== "boolean" || !Number.isInteger(s.settings.djenDays) || s.settings.djenDays < 1 || s.settings.djenDays > 365) throw Error("Fontes inválidas no backup.");
    const text = (v, max = 2e5) => typeof v === "string" && v.length <= max;
    const day = (v) => !v || validDay(v);
    for (const table of TABLES) {
      if (!Array.isArray(s[table]) || s[table].length > 1e5) throw Error("Estrutura de backup inválida: " + table);
      const ids = /* @__PURE__ */ new Set();
      for (const row of s[table]) {
        if (!row || typeof row !== "object" || typeof row.id !== "string" || !row.id || ids.has(row.id)) throw Error("Identificadores inválidos ou repetidos em " + table);
        ids.add(row.id);
      }
    }
    const caseIds = new Set(s.cases.map((x) => x.id)), caseById = new Map(s.cases.map((x) => [x.id, x])), clientIds = new Set(s.clients.map((x) => x.id)), jobById = new Map(s.jobs.map((x) => [x.id, x]));
    if (s.coverageSamples.length > 2e3) throw Error("Limite de amostras de cobertura no backup excedido.");
    for (const item of s.coverageSamples) {
      const c = caseById.get(item.caseId);
      const j2 = item.jobId ? jobById.get(item.jobId) : null;
      for (const [field2, options] of [["court", COURTS], ["courtLevel", COURT_LEVELS], ["processSystem", PROCESS_SYSTEMS]]) {
        if (Object.hasOwn(item, field2) && (!text(item[field2], 40) || !Object.hasOwn(options, item[field2]))) throw Error("Classificação da amostra de cobertura inválida no backup.");
      }
      if (!c || !validCnj(item.cnj) || !["djen", "datajud"].includes(item.source) || !Object.hasOwn(COVERAGE_RESULTS, item.result) || !validDay(item.referenceDate) || item.referenceDate > dateKey() || !text(item.notes, 1500) || item.notes.trim().length < 12 || typeof item.checkedAt !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(item.checkedAt) || !Number.isFinite(Date.parse(item.checkedAt)) || new Date(item.checkedAt).toISOString() !== item.checkedAt || item.jobId !== "" && (!j2 || j2.caseId !== item.caseId || j2.cnj !== item.cnj || j2.source !== item.source || !["success", "not_found", "error", "action", "interrupted"].includes(j2.status)) || ["match", "difference"].includes(item.result) && !["success", "not_found"].includes(j2?.status)) throw Error("Amostra de cobertura inválida no backup.");
    }
    for (const c of s.clients) if (!text(c.name, 180) || !c.name.trim() || !text(c.phone || "", 40) || !text(c.email || "", 180) || !text(c.notes || "", 4e3)) throw Error("Cliente inválido no backup.");
    const cnjs = /* @__PURE__ */ new Set(), superiorRegisters = /* @__PURE__ */ new Set();
    for (const c of s.cases) {
      if (!text(c.title, 240) || !c.title || !STAGES[c.stage] || !text(c.cnj || "", 20) || c.cnj && !validCnj(c.cnj) || !day(c.review) || !text(c.notes || "", 4e3)) throw Error("Processo inválido no backup.");
      if (c.nextStep !== void 0 && !text(c.nextStep, 500) || c.workOwner !== void 0 && !Object.hasOwn(WORK_OWNERS, c.workOwner) || c.workStatus !== void 0 && !Object.hasOwn(WORK_STATUSES, c.workStatus) || c.reviewedAt !== void 0 && c.reviewedAt !== "" && (!text(c.reviewedAt, 40) || !Number.isFinite(Date.parse(c.reviewedAt)) || !/^\d{4}-\d\d-\d\dT/.test(c.reviewedAt))) throw Error("Acompanhamento do processo inválido no backup.");
      if (c.pendingItems !== void 0) {
        if (!Array.isArray(c.pendingItems) || c.pendingItems.length > 80) throw Error("Pendências do processo inválidas no backup.");
        const pendingIds = /* @__PURE__ */ new Set();
        for (const item of c.pendingItems) {
          if (!item || typeof item.id !== "string" || !item.id || pendingIds.has(item.id) || !text(item.title, 240) || !item.title.trim() || typeof item.done !== "boolean" || !text(item.createdAt, 40) || !Number.isFinite(Date.parse(item.createdAt)) || !text(item.completedAt, 40) || item.completedAt && !Number.isFinite(Date.parse(item.completedAt)) || item.done !== !!item.completedAt) throw Error("Pendência inválida no backup.");
          pendingIds.add(item.id);
        }
      }
      if (c.plaintiff !== void 0 && !text(c.plaintiff, 400) || c.defendant !== void 0 && !text(c.defendant, 400)) throw Error("Partes do processo inválidas no backup.");
      if (c.datajudDetails !== void 0 && c.datajudDetails !== null && !validDatajudDetails(c.datajudDetails, c.cnj)) throw Error("Metadados DataJud inválidos no backup.");
      if (c.judicialSystem !== void 0 && (!Object.hasOwn(JUDICIAL_SYSTEMS, c.judicialSystem) || c.judicialSystem && (!c.cnj || c.cnj.slice(13, 16) !== "819"))) throw Error("Sistema judicial inválido no backup.");
      try {
        const classified = {};
        for (const key of ["court", "courtLevel", "processSystem", "parentCaseId", "docketNumber", "originReference"]) {
          classified[key] = Object.hasOwn(c, key) ? c[key] : "";
        }
        validateCaseHierarchy(s, c.id, classified);
      } catch {
        throw Error("Vínculo ou classificação judicial inválida no backup.");
      }
      if (c.manualCheckedAt !== void 0 && c.manualCheckedAt !== "" && (typeof c.manualCheckedAt !== "string" || !Number.isFinite(Date.parse(c.manualCheckedAt)) || !/^\d{4}-\d\d-\d\dT/.test(c.manualCheckedAt))) throw Error("Data da conferência manual inválida no backup.");
      if (c.manualChecks !== void 0) {
        if (!Array.isArray(c.manualChecks) || c.manualChecks.length > 500) throw Error("Histórico de conferência manual inválido.");
        const ids = /* @__PURE__ */ new Set();
        for (const item of c.manualChecks) {
          const legacy = item?.court === void 0;
          const sourceOk = legacy ? validCnj(item.cnj) && digits(item.cnj).slice(13, 16) === "819" && Object.hasOwn(JUDICIAL_SYSTEMS, item.source) && !!item.source : MANUAL_COURT_SOURCES[item.court]?.includes(item.source) && typeof item.cnj === "string" && (!item.cnj || validCnj(item.cnj)) && text(item.docketNumber, 100) && (!!item.docketNumber || !!item.cnj);
          if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id || ids.has(item.id) || !sourceOk || !Object.hasOwn(MANUAL_CHECK_RESULTS, item.result) || !text(item.notes, 2e3) || ["change", "attention", "unavailable"].includes(item.result) && !item.notes.trim() || typeof item.checkedAt !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(item.checkedAt) || !Number.isFinite(Date.parse(item.checkedAt)) || new Date(item.checkedAt).toISOString() !== item.checkedAt) throw Error("Registro de conferência manual inválido no backup.");
          ids.add(item.id);
        }
      }
      if (c.cnj && cnjs.has(c.cnj)) throw Error("CNJ duplicado no backup.");
      if (c.cnj) cnjs.add(c.cnj);
      if (["stj", "stf"].includes(c.court) && c.docketNumber) {
        const key = c.court + ":" + normalizeDocket(c.docketNumber);
        if (superiorRegisters.has(key)) throw Error("Registro superior duplicado no backup.");
        superiorRegisters.add(key);
      }
      if (c.clientId && !clientIds.has(c.clientId)) throw Error("Vínculo de cliente ausente.");
    }
    for (const table of ["tasks", "appointments", "fees", "events", "jobs"]) for (const row of s[table]) if (row.caseId && !caseIds.has(row.caseId)) throw Error("Vínculo de processo ausente.");
    const usedManualChecks = /* @__PURE__ */ new Set();
    for (const t of s.tasks) {
      if (!text(t.title, 240) || !t.title || !STAGES[t.stage] || !day(t.due)) throw Error("Tarefa inválida.");
      if (t.manualCheckId !== void 0) {
        if (!text(t.manualCheckId, 100)) throw Error("Origem da tarefa inválida.");
        if (t.manualCheckId) {
          const source = caseById.get(t.caseId);
          if (!source?.manualChecks?.some((x) => x.id === t.manualCheckId) || usedManualChecks.has(t.manualCheckId)) throw Error("Vínculo da conferência na tarefa inválido.");
          usedManualChecks.add(t.manualCheckId);
        }
      }
    }
    for (const a of s.appointments) if (!text(a.title, 240) || !a.title || !validDateTime(a.when)) throw Error("Compromisso inválido.");
    for (const f of s.fees) if (!Number.isSafeInteger(f.amount) || !Number.isSafeInteger(f.paid) || f.amount <= 0 || f.paid < 0 || f.paid > f.amount) throw Error("Honorário inválido.");
    for (const f of s.fees) if (!text(f.title, 240) || !f.title || !day(f.due)) throw Error("Honorário inválido.");
    const feeIds = new Set(s.fees.map((f) => f.id)), paymentById = new Map(s.payments.map((p2) => [p2.id, p2])), paidByFee = new Map(s.fees.map((f) => [f.id, 0]));
    for (const p2 of s.payments) {
      if (!feeIds.has(p2.feeId) || !["receipt", "reversal"].includes(p2.kind) || !Number.isSafeInteger(p2.amount) || p2.amount <= 0 || !validDay(p2.date) || !text(p2.notes || "", 4e3)) throw Error("Recebimento inválido no backup.");
      paidByFee.set(p2.feeId, paidByFee.get(p2.feeId) + (p2.kind === "reversal" ? -p2.amount : p2.amount));
    }
    const reversed = /* @__PURE__ */ new Set();
    for (const p2 of s.payments) if (p2.kind === "reversal") {
      const original = paymentById.get(p2.reverses);
      if (!original || original.kind !== "receipt" || original.feeId !== p2.feeId || original.amount !== p2.amount || p2.date < original.date || reversed.has(original.id)) throw Error("Estorno inválido no backup.");
      reversed.add(original.id);
    }
    for (const f of s.fees) if (paidByFee.get(f.id) !== f.paid) throw Error("Saldo financeiro inconsistente no backup.");
    for (const d of s.documents) if (!caseIds.has(d.caseId) || !text(d.name, 200) || !d.name || !text(d.mime, 80) || d.createdAt !== void 0 && !validStoredDate(d.createdAt) || !Number.isInteger(d.size) || d.size <= 0 || d.size > 5 * 1024 * 1024 || !/^([a-f0-9]{64})$/.test(d.sha256 || "")) throw Error("Anexo inválido no backup.");
    for (const j2 of s.jobs) if (!JOB_STATES.includes(j2.status) || !["datajud", "djen"].includes(j2.source) || !text(j2.updatedAt, 40) || Number.isNaN(Date.parse(j2.updatedAt)) || j2.needsManualRetry !== void 0 && typeof j2.needsManualRetry !== "boolean") throw Error("Consulta inválida.");
    for (const j2 of s.jobs) {
      for (const k of ["periodStart", "periodEnd"]) if (j2[k] !== void 0 && j2[k] !== "" && !validDay(j2[k])) throw Error("Período de consulta inválido no backup.");
      if (j2.periodStart && j2.periodEnd && j2.periodStart > j2.periodEnd) throw Error("Período de consulta invertido no backup.");
    }
    for (const e of s.events) {
      if (!["datajud", "djen"].includes(e.source) || !["movement", "publication"].includes(e.kind) || !text(e.text) || !text(e.date, 40) || Number.isNaN(Date.parse(e.date)) || !text(e.discoveredAt, 40) || Number.isNaN(Date.parse(e.discoveredAt))) throw Error("Histórico inválido.");
      if (e.caseId && (!validCnj(e.cnj) || digits(e.cnj) !== caseById.get(e.caseId)?.cnj)) throw Error("Histórico vinculado a outro CNJ no backup.");
    }
    const result = structuredClone(s);
    result.settings = { ...emptyState().settings, ...s.settings, datajudKey: "" };
    result.jobs = result.jobs.map((x) => ({ ...x, status: ["queued", "running"].includes(x.status) ? "interrupted" : x.status }));
    return result;
  }
  function overview(state2) {
    return { expected: state2.fees.reduce((n, f) => n + f.amount, 0), received: state2.fees.reduce((n, f) => n + f.paid, 0), balance: state2.fees.reduce((n, f) => n + f.amount - f.paid, 0), unseen: state2.events.filter((x) => !x.seen).length };
  }
  function caseDeletionImpact(state2, ids) {
    const keys = new Set(ids), cases = state2.cases.filter((c) => keys.has(c.id));
    if (!cases.length || cases.length !== keys.size) throw Error("Seleção de processos desatualizada.");
    const count = (table) => (state2[table] || []).filter((row) => keys.has(row.caseId)).length;
    return { cases, attachments: count("documents"), samples: count("coverageSamples"), manualChecks: cases.reduce((n, c) => n + (c.manualChecks || []).length, 0), tasks: count("tasks"), appointments: count("appointments"), fees: count("fees"), events: count("events"), jobs: count("jobs"), children: state2.cases.filter((c) => !keys.has(c.id) && keys.has(c.parentCaseId)).length };
  }
  function deleteCases(state2, ids) {
    const impact = caseDeletionImpact(state2, ids);
    if (impact.attachments || impact.samples || impact.manualChecks) throw Error("Para preservar anexos, comparações e conferências manuais, remova os anexos e mantenha arquivadas as fichas com histórico de conferências ou comparações.");
    const keys = new Set(ids), stamp2 = now();
    state2.cases = state2.cases.filter((c) => !keys.has(c.id));
    for (const row of state2.tasks) if (keys.has(row.caseId)) {
      row.caseId = "";
      row.manualCheckId = "";
    }
    for (const table of ["appointments", "fees", "events"]) for (const row of state2[table]) if (keys.has(row.caseId)) row.caseId = "";
    for (const job of state2.jobs) if (keys.has(job.caseId)) {
      job.caseId = "";
      if (["queued", "running"].includes(job.status)) Object.assign(job, { status: "cancelled", message: "Consulta cancelada: cadastro excluído.", updatedAt: stamp2, leaseUntil: 0 });
    }
    for (const c of state2.cases) if (keys.has(c.parentCaseId)) c.parentCaseId = "";
    return impact;
  }
  function auditLocalData(state2) {
    const caseIds = new Set(state2.cases.map((c) => c.id));
    const caseById = new Map(state2.cases.map((c) => [c.id, c]));
    const feeIds = new Set(state2.fees.map((f) => f.id));
    const cnjs = /* @__PURE__ */ new Set();
    const issues = [];
    const add = (label2, count) => {
      if (count > 0) issues.push({ label: label2, count });
    };
    let invalidCases = 0;
    for (const c of state2.cases) {
      if (c.cnj && !validCnj(c.cnj) || c.cnj && cnjs.has(c.cnj)) invalidCases++;
      if (c.cnj) cnjs.add(c.cnj);
    }
    add("CNJs inválidos ou duplicados", invalidCases);
    const superiorRegisters = /* @__PURE__ */ new Set();
    let repeatedRegisters = 0;
    for (const c of state2.cases) if (["stj", "stf"].includes(c.court) && c.docketNumber) {
      const key = c.court + ":" + normalizeDocket(c.docketNumber);
      if (superiorRegisters.has(key)) repeatedRegisters++;
      else superiorRegisters.add(key);
    }
    add("Registros superiores repetidos", repeatedRegisters);
    let orphanRecords = 0;
    for (const table of ["tasks", "appointments", "fees", "documents", "coverageSamples"]) for (const row of state2[table] || []) if (row.caseId && !caseIds.has(row.caseId)) orphanRecords++;
    add("Registros vinculados a processos inexistentes", orphanRecords);
    let invalidPayments = 0;
    const received = /* @__PURE__ */ new Map();
    for (const p2 of state2.payments) {
      if (!feeIds.has(p2.feeId)) invalidPayments++;
      else received.set(p2.feeId, (received.get(p2.feeId) || 0) + (p2.kind === "reversal" ? -p2.amount : p2.amount));
    }
    for (const fee of state2.fees) if ((received.get(fee.id) || 0) !== fee.paid) invalidPayments++;
    add("Inconsistências em recebimentos ou saldos", invalidPayments);
    let mismatchedEvents = 0;
    for (const e of state2.events) if (e.caseId) {
      const associated = caseById.get(e.caseId);
      if (!associated || !validCnj(e.cnj) || digits(e.cnj) !== associated.cnj) mismatchedEvents++;
    }
    add("Movimentações ou publicações com vínculo CNJ divergente", mismatchedEvents);
    let invalidChecks = 0;
    for (const t of state2.tasks) if (t.manualCheckId) {
      const c = caseById.get(t.caseId);
      if (!c?.manualChecks?.some((m2) => m2.id === t.manualCheckId)) invalidChecks++;
    }
    add("Tarefas com conferência de origem ausente", invalidChecks);
    try {
      validateBackup(backup(state2));
    } catch {
      add("Inconsistência adicional na estrutura dos dados", 1);
    }
    return { counts: { clients: state2.clients.length, cases: state2.cases.length, events: state2.events.length, documents: state2.documents.length, fees: state2.fees.length }, issues };
  }

  // backup-crypto.js
  var encoder = new TextEncoder();
  var decoder = new TextDecoder("utf-8", { fatal: true });
  var ITERATIONS = 6e5;
  var additionalData = encoder.encode("Pauta encrypted backup v1");
  function toBase64(bytes2) {
    let out = "";
    for (let i = 0; i < bytes2.length; i += 24576) out += String.fromCharCode(...bytes2.subarray(i, i + 24576));
    return btoa(out);
  }
  function fromBase64(value, max = 64 * 1024 * 1024) {
    if (typeof value !== "string" || value.length > Math.ceil(max / 3) * 4 || value.length % 4 || /[^A-Za-z0-9+/=]/.test(value) || /=.+[^=]/.test(value)) throw Error("Dados codificados inválidos.");
    let raw;
    try {
      raw = atob(value);
    } catch {
      throw Error("Dados codificados inválidos.");
    }
    if (raw.length > max) throw Error("Backup excede o limite.");
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }
  async function keyFor(password, salt, iterations = ITERATIONS) {
    const base2 = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, base2, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function encryptBackup(payload, password) {
    if (typeof password !== "string" || password.length < 10 || password.length > 1024) throw Error("Use uma senha de 10 a 1024 caracteres.");
    const bytes2 = encoder.encode(JSON.stringify(payload));
    if (bytes2.length > 48 * 1024 * 1024) throw Error("Conteúdo excede 48 MB. Exporte menos anexos.");
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), key = await keyFor(password, salt);
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData, tagLength: 128 }, key, bytes2);
    return { format: "pauta-encrypted-backup", version: 1, kdf: "PBKDF2-SHA256", iterations: ITERATIONS, cipher: "AES-256-GCM", salt: toBase64(salt), iv: toBase64(iv), data: toBase64(new Uint8Array(encrypted)) };
  }
  async function decryptBackup(payload, password) {
    if (payload?.format !== "pauta-encrypted-backup" || payload.version !== 1 || payload.kdf !== "PBKDF2-SHA256" || !Number.isInteger(payload.iterations) || payload.iterations < 1e5 || payload.iterations > 1e6 || payload.cipher !== "AES-256-GCM") throw Error("Formato criptografado não suportado.");
    if (typeof password !== "string" || password.length > 1024) throw Error("Senha inválida.");
    const salt = fromBase64(payload.salt, 16), iv = fromBase64(payload.iv, 12), data = fromBase64(payload.data, 48 * 1024 * 1024 + 16);
    if (salt.length !== 16 || iv.length !== 12 || data.length < 16) throw Error("Backup criptografado inválido.");
    try {
      const key = await keyFor(password, salt, payload.iterations), plain2 = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData, tagLength: 128 }, key, data);
      return JSON.parse(decoder.decode(plain2));
    } catch {
      throw Error("Senha incorreta ou arquivo alterado/corrompido.");
    }
  }

  // documents.js
  var MAX_FILE = 5 * 1024 * 1024;
  var MAX_TOTAL = 25 * 1024 * 1024;
  async function sha256(bytes2) {
    return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes2))].map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  function validateDocument(bytes2, mime) {
    if (!(bytes2 instanceof Uint8Array) || bytes2.length === 0 || bytes2.length > MAX_FILE) throw Error("Cada anexo deve ter de 1 byte a 5 MB.");
    const start2 = [...bytes2.subarray(0, 12)];
    const begins = (values) => values.every((v, i) => start2[i] === v);
    const valid = mime === "application/pdf" && begins([37, 80, 68, 70, 45]) || mime === "image/png" && begins([137, 80, 78, 71, 13, 10, 26, 10]) || mime === "image/jpeg" && begins([255, 216, 255]) || mime === "image/webp" && begins([82, 73, 70, 70]) && start2.slice(8, 12).join(",") === "87,69,66,80";
    if (mime === "text/plain") {
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(bytes2);
      } catch {
        throw Error("Texto deve estar em UTF-8.");
      }
      if (bytes2.includes(0)) throw Error("Arquivo de texto contém conteúdo binário.");
      return true;
    }
    if (!valid) throw Error("Anexe PDF, PNG, JPEG, WebP ou texto UTF-8 com formato válido.");
    return true;
  }

  // runtime-mode.js
  function isIntegratedRuntime() {
    const loc = globalThis.location;
    return !!loc && loc.protocol === "http:" && loc.hostname === "127.0.0.1";
  }

  // workspace-api.js
  var csrf = "";
  var remote = false;
  var tail = Promise.resolve();
  var hasRemoteWorkspace = () => remote;
  async function workspaceRequest(route2, body, renew = true) {
    if (!csrf) {
      const r2 = await fetch("/api/v1/session", { cache: "no-store" });
      if (!r2.ok) throw Error("Serviço local indisponível.");
      csrf = (await r2.json()).csrf;
    }
    const r = await fetch("/api/v1/" + route2, {
      method: body === void 0 ? "GET" : "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "X-Pauta-CSRF": csrf, ...body === void 0 ? {} : { "Content-Type": "application/json" } },
      ...body === void 0 ? {} : { body: JSON.stringify(body) }
    });
    const result = await r.json();
    if (r.status === 403 && renew) {
      csrf = "";
      return workspaceRequest(route2, body, false);
    }
    if (!r.ok) throw Error(result.error || "Não foi possível salvar no serviço local.");
    return result;
  }
  async function initializeRemoteWorkspace(loadLocal) {
    if (!isIntegratedRuntime()) return;
    const current = await workspaceRequest("workspace");
    if (!current.initialized) {
      const bundle = await loadLocal();
      await workspaceRequest("workspace/migrate", bundle);
    }
    remote = true;
  }
  async function readRemoteWorkspace() {
    return migrateState((await workspaceRequest("workspace")).state);
  }
  function remoteTransaction(fn) {
    const result = tail.then(async () => {
      const state2 = await readRemoteWorkspace(), expectedRevision = state2.revision;
      const payload = await fn(state2);
      const saved = await workspaceRequest("workspace/save", { state: state2, expectedRevision, ...payload?.extra });
      return payload?.result === void 0 ? saved : payload.result;
    });
    tail = result.catch(() => {
    });
    return result;
  }

  // db.js
  var dbPromise;
  function openDB() {
    if (!globalThis.indexedDB) return Promise.reject(Error("Este navegador não disponibilizou IndexedDB para o painel local. Abra o dashboard.html no Chrome ou no Edge e verifique se o armazenamento local está permitido."));
    if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open("pauta-local", 2);
      let failed = false;
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains("workspace")) req.result.createObjectStore("workspace");
        if (!req.result.objectStoreNames.contains("attachments")) req.result.createObjectStore("attachments", { keyPath: "id" });
        const store = req.transaction.objectStore("workspace"), r = store.get("state");
        r.onsuccess = () => {
          if (r.result) store.put(migrateState(r.result), "state");
        };
      };
      req.onblocked = () => {
        failed = true;
        dbPromise = null;
        reject(Error("Feche as outras abas do Pauta e recarregue esta página para atualizar o banco."));
      };
      req.onsuccess = () => {
        if (failed) {
          req.result.close();
          return;
        }
        req.result.onversionchange = () => {
          req.result.close();
          dbPromise = null;
        };
        resolve(req.result);
      };
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
    return dbPromise;
  }
  async function initializeLocalWorkspace() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("workspace", "readwrite"), store = tx.objectStore("workspace");
      const request = store.get("state");
      request.onsuccess = () => {
        if (!request.result) store.put(emptyState(), "state");
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || Error("Não foi possível inicializar a carteira local."));
    });
  }
  async function initializeWorkspace() {
    if (isIntegratedRuntime()) {
      await initializeRemoteWorkspace(async () => {
        await initializeLocalWorkspace();
        const state2 = await readState(), bundle = await exportBundle();
        return { state: state2, attachments: bundle.attachments };
      });
    } else await initializeLocalWorkspace();
  }
  async function readState() {
    if (hasRemoteWorkspace()) return readRemoteWorkspace();
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("workspace", "readonly"), r = tx.objectStore("workspace").get("state");
      r.onsuccess = () => resolve(migrateState(r.result));
      r.onerror = () => reject(r.error);
    });
  }
  async function mutate(fn) {
    if (hasRemoteWorkspace()) return remoteTransaction((state2) => {
      const result = fn(state2);
      if (result?.then) throw Error("Mutação do banco deve ser síncrona.");
      return { result };
    });
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("workspace", "readwrite"), store = tx.objectStore("workspace"), r = store.get("state");
      let output, error;
      r.onsuccess = () => {
        try {
          const state2 = migrateState(r.result);
          output = fn(state2);
          if (output?.then) throw Error("Mutação do banco deve ser síncrona.");
          state2.revision = (state2.revision || 0) + 1;
          store.put(state2, "state");
        } catch (e) {
          error = e;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(output);
      tx.onabort = () => reject(error || tx.error || Error("Não foi possível salvar."));
      tx.onerror = () => reject(error || tx.error);
    });
  }
  async function addDocument(caseId, file) {
    const bytes2 = new Uint8Array(await file.arrayBuffer());
    validateDocument(bytes2, file.type);
    const hash = await sha256(bytes2), metadata = { id: uid(), caseId, name: String(file.name || "Documento").slice(0, 200), mime: file.type, size: bytes2.length, sha256: hash, createdAt: now() };
    if (hasRemoteWorkspace()) return remoteTransaction((state2) => {
      if (!state2.cases.some((c) => c.id === caseId)) throw Error("Processo não encontrado.");
      if (state2.documents.some((d) => d.caseId === caseId && d.sha256 === hash)) throw Error("Este arquivo já está anexado ao processo.");
      if (state2.documents.reduce((n, d) => n + d.size, 0) + metadata.size > MAX_TOTAL) throw Error("Limite de 25 MB em anexos atingido.");
      state2.documents.push(metadata);
      return { result: metadata, extra: { attachments: [{ id: metadata.id, data: toBase64(bytes2) }] } };
    });
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["workspace", "attachments"], "readwrite"), ws = tx.objectStore("workspace"), r = ws.get("state");
      let error;
      r.onsuccess = () => {
        try {
          const s = migrateState(r.result);
          if (!s.cases.some((c) => c.id === caseId)) throw Error("Processo não encontrado.");
          if (s.documents.some((d) => d.caseId === caseId && d.sha256 === hash)) throw Error("Este arquivo já está anexado ao processo.");
          if (s.documents.reduce((n, d) => n + d.size, 0) + metadata.size > MAX_TOTAL) throw Error("Limite de 25 MB em anexos atingido.");
          s.documents.push(metadata);
          s.revision++;
          ws.put(s, "state");
          tx.objectStore("attachments").put({ id: metadata.id, blob: new Blob([bytes2], { type: metadata.mime }) });
        } catch (e) {
          error = e;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(metadata);
      tx.onabort = () => reject(error || tx.error);
      tx.onerror = () => reject(error || tx.error);
    });
  }
  async function readDocument(id) {
    if (hasRemoteWorkspace()) {
      const bundle = await workspaceRequest("workspace/export"), d = bundle.state.documents.find((d2) => d2.id === id), f = bundle.attachments.find((f2) => f2.id === id);
      if (!d || !f) throw Error("Arquivo não encontrado.");
      const bytes2 = fromBase64(f.data, 5 * 1024 * 1024);
      if (bytes2.length !== d.size || await sha256(bytes2) !== d.sha256) throw Error("Anexo corrompido.");
      return new Blob([bytes2], { type: d.mime });
    }
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("attachments", "readonly"), r = tx.objectStore("attachments").get(id);
      r.onsuccess = () => r.result ? resolve(r.result.blob) : reject(Error("Arquivo não encontrado. Restaure um backup completo."));
      r.onerror = () => reject(r.error);
    });
  }
  async function auditLocalAttachments() {
    if (hasRemoteWorkspace()) {
      const bundle = await workspaceRequest("workspace/export");
      let checked2 = 0, missing2 = 0, corrupted2 = 0;
      for (const d of bundle.state.documents) {
        const f = bundle.attachments.find((f2) => f2.id === d.id);
        if (!f) {
          missing2++;
          continue;
        }
        const bytes2 = fromBase64(f.data, 5 * 1024 * 1024);
        if (bytes2.length !== d.size || await sha256(bytes2) !== d.sha256) corrupted2++;
        else checked2++;
      }
      return { checked: checked2, missing: missing2, corrupted: corrupted2, unreferenced: bundle.attachments.filter((f) => !bundle.state.documents.some((d) => d.id === f.id)).length };
    }
    const db = await openDB();
    const snapshot = await new Promise((resolve, reject) => {
      const tx = db.transaction(["workspace", "attachments"], "readonly");
      const state2 = tx.objectStore("workspace").get("state"), attachments = tx.objectStore("attachments").getAll();
      tx.oncomplete = () => resolve({ state: migrateState(state2.result), files: attachments.result });
      tx.onabort = () => reject(tx.error || Error("Falha ao ler anexos."));
      tx.onerror = () => reject(tx.error);
    });
    const byId = new Map(snapshot.files.map((f) => [f.id, f]));
    const expected = new Set(snapshot.state.documents.map((d) => d.id));
    let missing = 0, corrupted = 0, checked = 0;
    for (const d of snapshot.state.documents) {
      const stored = byId.get(d.id);
      if (!stored?.blob) {
        missing++;
        continue;
      }
      try {
        const bytes2 = new Uint8Array(await stored.blob.arrayBuffer());
        if (bytes2.length !== d.size || await sha256(bytes2) !== d.sha256) corrupted++;
        else checked++;
      } catch {
        corrupted++;
      }
    }
    return { checked, missing, corrupted, unreferenced: snapshot.files.filter((f) => !expected.has(f.id)).length };
  }
  async function removeDocument(id) {
    if (hasRemoteWorkspace()) return mutate((s) => {
      s.documents = s.documents.filter((d) => d.id !== id);
    });
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["workspace", "attachments"], "readwrite"), ws = tx.objectStore("workspace"), r = ws.get("state");
      r.onsuccess = () => {
        const s = migrateState(r.result);
        s.documents = s.documents.filter((d) => d.id !== id);
        s.revision++;
        ws.put(s, "state");
        tx.objectStore("attachments").delete(id);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  }
  async function exportBundle() {
    if (hasRemoteWorkspace()) {
      const bundle = await workspaceRequest("workspace/export");
      for (const d of bundle.state.documents) {
        const f = bundle.attachments.find((f2) => f2.id === d.id);
        if (!f) throw Error("Anexo ausente: " + d.name);
        const bytes2 = fromBase64(f.data, 5 * 1024 * 1024);
        if (bytes2.length !== d.size || await sha256(bytes2) !== d.sha256) throw Error("Anexo corrompido: " + d.name);
      }
      return { ...backup(bundle.state), attachments: bundle.attachments };
    }
    const db = await openDB();
    const snapshot = await new Promise((resolve, reject) => {
      const tx = db.transaction(["workspace", "attachments"], "readonly"), r = tx.objectStore("workspace").get("state"), a = tx.objectStore("attachments").getAll();
      tx.oncomplete = () => resolve({ state: migrateState(r.result), files: a.result });
      tx.onabort = () => reject(tx.error);
    });
    const value = backup(snapshot.state);
    value.attachments = [];
    const storedById = new Map(snapshot.files.map((file) => [file.id, file]));
    for (const d of value.state.documents) {
      const stored = storedById.get(d.id);
      if (!stored) throw Error("Anexo ausente: " + d.name);
      const bytes2 = new Uint8Array(await stored.blob.arrayBuffer());
      if (bytes2.length !== d.size || await sha256(bytes2) !== d.sha256) throw Error("Anexo corrompido: " + d.name);
      value.attachments.push({ id: d.id, data: toBase64(bytes2) });
    }
    return value;
  }
  async function decodeBundle(value) {
    const state2 = validateBackup(value), records = value.attachments || [];
    if (!Array.isArray(records) || records.length !== state2.documents.length) throw Error("Backup sem todos os anexos.");
    if (state2.documents.reduce((n, d) => n + d.size, 0) > MAX_TOTAL) throw Error("Anexos excedem 25 MB.");
    const byId = /* @__PURE__ */ new Map();
    for (const record of records) {
      if (!record || typeof record.id !== "string" || !record.id || byId.has(record.id)) throw Error("Anexos duplicados ou ausentes.");
      byId.set(record.id, record);
    }
    const files = [];
    for (const d of state2.documents) {
      const found = byId.get(d.id);
      if (!found) throw Error("Anexos duplicados ou ausentes.");
      const bytes2 = fromBase64(found.data, 5 * 1024 * 1024);
      if (bytes2.length !== d.size || await sha256(bytes2) !== d.sha256) throw Error("Integridade do anexo não confere: " + d.name);
      validateDocument(bytes2, d.mime);
      files.push({ id: d.id, blob: new Blob([bytes2], { type: d.mime }) });
    }
    return { state: state2, files };
  }
  async function restoreBundle(bundle) {
    if (hasRemoteWorkspace()) {
      const attachments = [];
      for (const f of bundle.files) attachments.push({ id: f.id, data: toBase64(new Uint8Array(await f.blob.arrayBuffer())) });
      return remoteTransaction((state2) => {
        if (state2.jobs.some((j2) => ["queued", "running"].includes(j2.status))) throw Error("Cancele as consultas antes de restaurar.");
        for (const key of Object.keys(state2)) delete state2[key];
        Object.assign(state2, structuredClone(bundle.state));
        return { extra: { attachments, replaceAttachments: true } };
      });
    }
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["workspace", "attachments"], "readwrite"), ws = tx.objectStore("workspace"), r = ws.get("state");
      let error;
      r.onsuccess = () => {
        try {
          const current = migrateState(r.result);
          if (current.jobs.some((j2) => ["queued", "running"].includes(j2.status))) throw Error("Cancele as consultas antes de restaurar.");
          const state2 = structuredClone(bundle.state);
          state2.revision = Math.max(current.revision || 0, state2.revision || 0) + 1;
          ws.put(state2, "state");
          const store = tx.objectStore("attachments");
          store.clear();
          for (const f of bundle.files) store.put(f);
        } catch (e) {
          error = e;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(error || tx.error);
      tx.onerror = () => reject(error || tx.error);
    });
  }

  // publication-details.js
  function rawDjenDetails(item = {}) {
    const d = {}, text = (x) => typeof x === "string" || typeof x === "number" ? String(x).trim().slice(0, 240) : "";
    for (const [field2, key] of Object.entries({ tribunal: "siglaTribunal", orgao: "nomeOrgao", classe: "nomeClasse", tipoComunicacao: "tipoComunicacao", tipoDocumento: "tipoDocumento", meio: "meio", numeroComunicacao: "numeroComunicacao" })) if (key in item) d[field2] = text(item[key]);
    if ("ativo" in item) d.ativo = item.ativo !== false;
    if (Array.isArray(item.destinatarios)) d.destinatarios = item.destinatarios.filter((x) => x && typeof x === "object").map((x) => ({ nome: text(x.nome), polo: text(x.polo) }));
    if (Array.isArray(item.destinatarioadvogados)) d.advogados = item.destinatarioadvogados.filter((x) => x && typeof x === "object").map((x) => {
      const a = x.advogado && typeof x.advogado === "object" ? x.advogado : x;
      return { nome: text(a.nome), numeroOab: text(a.numero_oab), ufOab: text(a.uf_oab).slice(0, 2) };
    });
    if (d.destinatarios) d.destinatarios.sort((a, b) => (a.nome + "|" + a.polo).localeCompare(b.nome + "|" + b.polo));
    if (d.advogados) d.advogados.sort((a, b) => (a.nome + "|" + a.numeroOab + "|" + a.ufOab).localeCompare(b.nome + "|" + b.numeroOab + "|" + b.ufOab));
    return d;
  }
  function publicationDetails(event = {}) {
    let value = event.publicationDetails ?? event.publication_details ?? {};
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        return {};
      }
    }
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  function publicationDetailsHTML(event = {}) {
    const d = publicationDetails(event);
    const text = (value) => typeof value === "string" || typeof value === "number" ? String(value) : "";
    const fields2 = [
      ["Tribunal", d.tribunal],
      ["Órgão da publicação", d.orgao],
      ["Classe na publicação", d.classe],
      ["Comunicação", d.tipoComunicacao],
      ["Documento publicado", d.tipoDocumento],
      ["Número da comunicação", d.numeroComunicacao]
    ];
    const rows = fields2.filter(([, v]) => text(v)).map(([k, v]) => `<p class="compact"><strong>${k}:</strong> ${escapeHTML(text(v))}</p>`);
    if (d.ativo === false) rows.push('<p class="warning-note">Publicação cancelada na fonte.</p>');
    const recipients = Array.isArray(d.destinatarios) ? d.destinatarios : [];
    const lawyers = Array.isArray(d.advogados) ? d.advogados : [];
    const poles = { A: "Polo ativo", P: "Polo passivo", T: "Terceiro" };
    if (recipients.length) rows.push("<div><strong>Destinatários da publicação</strong><ul>" + recipients.filter((x) => x && text(x.nome)).map((x) => `<li>${escapeHTML(text(x.nome))}${text(x.polo) ? " · " + escapeHTML(poles[x.polo] || text(x.polo)) : ""}</li>`).join("") + "</ul></div>");
    if (lawyers.length) rows.push("<div><strong>Advogados destinatários</strong><ul>" + lawyers.filter((x) => x && (text(x.nome) || text(x.numeroOab))).map((x) => `<li>${escapeHTML(text(x.nome))}${text(x.numeroOab) ? " · OAB " + escapeHTML(text(x.ufOab)) + " " + escapeHTML(text(x.numeroOab)) : ""}</li>`).join("") + "</ul></div>");
    if (!rows.length) return '<p class="muted compact">Dados dos destinatários ainda não disponíveis neste registro. Consulte o DJEN para atualizar.</p>';
    return '<details class="publication-metadata"><summary>Dados e destinatários da publicação</summary><div class="private">' + rows.join("") + "</div></details>";
  }

  // sources.js
  var SourceError = class extends Error {
    constructor(message, { action: action2 = false, retryable = false, retryAfter = 0 } = {}) {
      super(message);
      Object.assign(this, { action: action2, retryable, retryAfter });
    }
  };
  async function requestJSON(url, options = {}, fetcher = fetch) {
    const isDatajud = String(url).startsWith("https://api-publica.datajud.cnj.jus.br/");
    if (isDatajud) throw new SourceError("DataJud usa o cliente MCP no painel integrado. Abra ABRIR-PAINEL-INTEGRADO.cmd.", { action: true });
    const timeoutMs = isDatajud ? 45e3 : 18e3;
    let response;
    try {
      response = await fetcher(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
      throw new SourceError(timeout ? `Tempo de espera esgotado (${timeoutMs / 1e3} s). A fonte pode estar lenta ou bloqueando a conexão.` : "Falha de conexão. Se o painel foi aberto por arquivo local, o navegador pode ter bloqueado a consulta por CORS (a resposta existe, mas não pode ser lida). Verifique a internet; no DataJud, esse bloqueio é esperado sem um intermediário local.", { retryable: !isDatajud });
    }
    if (!response.ok) {
      const seconds = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(seconds) && seconds > 0 ? seconds * 1e3 : Math.max(0, Date.parse(response.headers.get("retry-after")) - Date.now()) || 0;
      const message = response.status === 401 ? "Autenticação recusada. Confira a chave pública." : response.status === 403 ? "A fonte recusou o acesso (HTTP 403). Pode ser bloqueio de CORS, restrição da API ou necessidade de configuração adicional." : response.status === 429 ? "A fonte limitou as consultas (HTTP 429). Aguarde alguns minutos ou reduza a frequência antes de tentar novamente." : response.status >= 500 ? `A fonte está temporariamente indisponível (HTTP ${response.status}). Tente novamente mais tarde.` : `Fonte respondeu HTTP ${response.status}.`;
      throw new SourceError(message, { action: [401, 403].includes(response.status), retryable: response.status === 429 || response.status >= 500 && !(isDatajud && response.status === 504), retryAfter: delay });
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new SourceError("A fonte não retornou JSON válido. A resposta pode ser uma página de bloqueio ou uma restrição de CORS.");
    }
    if (!data || typeof data !== "object") throw new SourceError("Formato de resposta desconhecido.");
    return data;
  }
  function plain(value) {
    return String(value ?? "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
  }
  function parseDjen(data, page = 1) {
    if (!Array.isArray(data.items) || !Number.isInteger(data.count) || data.count < 0) throw new SourceError("Estrutura DJEN desconhecida; consulta não validada.");
    if (data.count >= 1e4) throw new SourceError("A busca atingiu 10.000 resultados. Reduza o período para evitar um histórico incompleto.", { action: true });
    if (data.items.length > 100 || data.items.length === 0 && data.count > (page - 1) * 100 || data.items.length > 0 && data.items.length < 100 && (page - 1) * 100 + data.items.length < data.count) throw new SourceError("Página DJEN incompleta.");
    const events = data.items.map((item) => {
      if (!item.id || !item.numero_processo || !item.data_disponibilizacao || typeof item.texto !== "string") throw new SourceError("Publicação sem identificador, processo, data ou texto.");
      return { publicationDetails: rawDjenDetails(item), id: "djen:" + item.id, source: "djen", kind: "publication", cnj: digits(item.numero_processo), date: item.data_disponibilizacao, text: plain(item.texto), tribunal: item.siglaTribunal || "", body: item.nomeOrgao || "", url: item.link && /^https:\/\//i.test(item.link) ? item.link : "", certificateHash: typeof item.hash === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(item.hash) ? item.hash : "", publicationStatus: item.ativo === false ? "Cancelada" : item.status || "", sourceUpdatedAt: "" };
    });
    return { events, count: data.items.length, nextCursor: (page - 1) * 100 + data.items.length < data.count ? page + 1 : null, notFound: data.count === 0 };
  }
  async function datajud(job, settings, fetcher = fetch) {
    if (!validCnj(job.cnj)) throw new SourceError("CNJ inválido.", { action: true });
    const alias = tribunalAlias(job.cnj);
    if (!alias) throw new SourceError("Tribunal fora do catálogo DataJud desta versão.", { action: true });
    const key = String(settings.datajudKey || "").replace(/^APIKey\s+/i, "").trim();
    if (!key) throw new SourceError("Configure a chave pública DataJud em Fontes e ajustes.", { action: true });
    throw new SourceError("DataJud usa o cliente MCP no painel integrado. Abra ABRIR-PAINEL-INTEGRADO.cmd.", { action: true });
  }
  async function djen(job, settings, fetcher = fetch) {
    const page = job.cursor ?? 1;
    const end = job.periodEnd || dateKey(), start2 = job.periodStart || dateKey(new Date(Date.now() - (Math.min(365, Math.max(1, Number(settings.djenDays) || 30)) - 1) * 864e5));
    const params = new URLSearchParams({ pagina: String(page), itensPorPagina: "100", dataDisponibilizacaoInicio: start2, dataDisponibilizacaoFim: end });
    if (job.cnj) params.set("numeroProcesso", digits(job.cnj));
    else if (job.oab && job.ufOab) {
      params.set("numeroOab", job.oab);
      params.set("ufOab", job.ufOab);
    } else throw new SourceError("Informe processo ou OAB/UF.", { action: true });
    const response = await requestJSON("https://comunicaapi.pje.jus.br/api/v1/comunicacao?" + params, {}, fetcher);
    const parsed = parseDjen(response, page);
    if (job.cnj && parsed.events.some((x) => x.cnj !== digits(job.cnj))) throw new SourceError("A fonte retornou publicações de outro processo.");
    return { ...parsed, periodStart: start2, periodEnd: end };
  }

  // runner.js
  async function step({ read, mutate: mutate2, adapters: adapters2, clock = Date.now }) {
    const job = await mutate2((state2) => {
      for (const j2 of state2.jobs) if (j2.status === "running" && j2.leaseUntil < clock()) {
        j2.status = "queued";
        j2.message = "Retomando consulta interrompida";
      }
      for (const j2 of state2.jobs) if (j2.status === "queued" && state2.settings[j2.source] !== true) Object.assign(j2, { status: "cancelled", leaseUntil: 0, updatedAt: now(), message: "Consulta cancelada: fonte desativada." });
      for (const j2 of state2.jobs) if (j2.status === "queued" && j2.caseId) {
        const c = state2.cases.find((c2) => c2.id === j2.caseId);
        if (!c || c.archived || c.cnj !== j2.cnj) Object.assign(j2, { status: "cancelled", leaseUntil: 0, updatedAt: now(), message: "Consulta cancelada: processo alterado ou arquivado." });
      }
      const item = state2.jobs.find((j2) => j2.status === "queued" && (j2.nextAt || 0) <= clock());
      if (!item) return null;
      Object.assign(item, { status: "running", runId: uid(), leaseUntil: clock() + (item.source === "datajud" ? 9e4 : 45e3), updatedAt: now() });
      if (item.source === "djen" && !item.periodStart) {
        item.periodEnd = dateKey();
        item.periodStart = dateKey(new Date(clock() - (Math.min(365, Math.max(1, Number(state2.settings.djenDays) || 30)) - 1) * 864e5));
      }
      return structuredClone(item);
    });
    if (!job) return false;
    try {
      const state2 = await read();
      if (state2.settings[job.source] !== true || !job.caseId && job.source === "djen" && (state2.settings.oab !== job.oab || state2.settings.ufOab !== job.ufOab)) {
        await mutate2((s) => {
          const live = s.jobs.find((j2) => j2.id === job.id);
          if (live?.status === "running" && live.runId === job.runId) Object.assign(live, { status: "cancelled", leaseUntil: 0, updatedAt: now(), message: "Consulta cancelada: fonte desativada." });
        });
        return true;
      }
      const response = await adapters2[job.source](job, state2.settings);
      await mutate2((s) => {
        const live = s.jobs.find((j2) => j2.id === job.id);
        if (!live || live.status !== "running" || live.runId !== job.runId) return;
        const c = job.caseId ? s.cases.find((c2) => c2.id === job.caseId) : null;
        if (s.settings[job.source] !== true || job.caseId && (!c || c.archived || c.cnj !== job.cnj) || !job.caseId && job.source === "djen" && (s.settings.oab !== job.oab || s.settings.ufOab !== job.ufOab)) {
          Object.assign(live, { status: "cancelled", message: "Consulta cancelada: fonte ou referência foi alterada.", leaseUntil: 0, updatedAt: now() });
          return;
        }
        live.added = (live.added || 0) + mergeEvents(s, response.events);
        live.count = (live.count || 0) + response.count;
        const hasNext = response.nextCursor !== null;
        Object.assign(live, { status: hasNext ? "queued" : response.notFound && live.count === 0 ? "not_found" : "success", cursor: response.nextCursor, nextAt: clock() + 500, leaseUntil: 0, attempt: 0, updatedAt: now(), sourceUpdatedAt: response.sourceUpdatedAt || live.sourceUpdatedAt || "", message: hasNext ? "Buscando próxima página" : response.notFound && live.count === 0 ? "Nenhum registro encontrado nesta fonte e neste período" : `Concluído · ${live.added} novidade(s)`, periodStart: response.periodStart || live.periodStart, periodEnd: response.periodEnd || live.periodEnd });
        if (response.snapshots && job.caseId) {
          const c2 = s.cases.find((c3) => c3.id === job.caseId && c3.cnj === job.cnj);
          if (c2) {
            c2.sourceInfo = c2.sourceInfo || {};
            const all = [...c2.sourceInfo.datajud || [], ...response.snapshots];
            c2.sourceInfo.datajud = [...new Map(all.map((x) => [x.id, x])).values()];
          }
        }
      });
    } catch (error) {
      await mutate2((s) => {
        const live = s.jobs.find((j2) => j2.id === job.id);
        if (!live || live.status !== "running" || live.runId !== job.runId) return;
        if (s.settings[job.source] !== true) {
          Object.assign(live, { status: "cancelled", message: "Consulta cancelada: fonte desativada.", leaseUntil: 0, updatedAt: now() });
          return;
        }
        const retry = error.retryable && (live.attempt || 0) < 2;
        Object.assign(live, { status: retry ? "queued" : error.action ? "action" : "error", attempt: (live.attempt || 0) + 1, nextAt: clock() + Math.max(error.retryAfter || 0, 5e3 * 2 ** (live.attempt || 0)), leaseUntil: 0, updatedAt: now(), message: (retry ? "Nova tentativa programada. " : "") + (error.message || "Falha desconhecida") });
      });
    }
    return true;
  }

  // transport.js
  function transport(url, options = {}) {
    return fetch(url, {
      ...options,
      mode: "cors",
      credentials: "omit",
      cache: "no-store"
    });
  }

  // engine.js
  var adapters = {
    datajud: (job, settings) => datajud(job, settings, transport),
    djen: (job, settings) => djen(job, settings, transport)
  };
  var MAX_STEPS = 40;
  var AUTO_DEFAULT_TIMES = "08:00,18:00";
  var pumping = false;
  var scheduled = null;
  async function withQueueLock(fn) {
    if (navigator.locks?.request) {
      return navigator.locks.request("pauta-queue-executor", { ifAvailable: true }, (lock) => {
        if (!lock) {
          schedule(2e3);
          return void 0;
        }
        return fn();
      });
    }
    return fn();
  }
  function schedule(ms) {
    if (scheduled) return;
    scheduled = setTimeout(() => {
      scheduled = null;
      void pump();
    }, Math.max(250, ms));
  }
  async function drain() {
    if (pumping) return;
    pumping = true;
    try {
      for (let i = 0; i < MAX_STEPS; i++) {
        const worked = await step({ read: readState, mutate, adapters });
        if (!worked) break;
      }
    } catch (error) {
      console.error("Pauta: falha no executor local.", error);
    } finally {
      pumping = false;
    }
    const state2 = await readState().catch(() => null);
    const pending = state2?.jobs?.filter((job) => ["queued", "running"].includes(job.status)) || [];
    if (pending.length) {
      const target = Math.min(...pending.map((job) => job.status === "running" ? Number(job.leaseUntil) || 0 : Number(job.nextAt) || 0));
      schedule(Math.max(300, Math.min(15e3, target - Date.now() + 200)));
    }
  }
  async function pump() {
    return withQueueLock(drain);
  }
  async function handle(type, extra = {}) {
    if (type === "ping") return { version: VERSION };
    if (type === "update") {
      const count = await mutate((state2) => enqueue(state2, extra.ids || []));
      void pump();
      return { count };
    }
    if (type === "retry-source") {
      const count = await mutate((state2) => retrySourceJob(state2, extra.jobId));
      if (count) void pump();
      return { count };
    }
    if (type === "retry-oab") {
      const count = await mutate((state2) => retryOabJob(state2, extra.jobId));
      if (count) void pump();
      return { count };
    }
    if (type === "oab") {
      const count = await mutate(enqueueOab);
      void pump();
      return { count };
    }
    if (type === "resume") {
      await mutate((state2) => {
        for (const job of state2.jobs) {
          if (job.status === "interrupted" && !job.needsManualRetry) {
            Object.assign(job, { status: "queued", nextAt: 0, updatedAt: now() });
          }
        }
      });
      void pump();
      return {};
    }
    if (type === "cancel") {
      await mutate((state2) => {
        for (const job of state2.jobs) {
          if (["queued", "running"].includes(job.status)) {
            Object.assign(job, { status: "cancelled", message: "Cancelado pelo usuário", updatedAt: now() });
          }
        }
      });
      return {};
    }
    throw Error("Ação desconhecida.");
  }
  function saoPauloNow(clock = /* @__PURE__ */ new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(clock).map((part) => [part.type, part.value]));
    return {
      day: `${parts.year}-${parts.month}-${parts.day}`,
      minutes: Number(parts.hour) * 60 + Number(parts.minute)
    };
  }
  var minutesOf = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  function shiftDay(day, amount) {
    return new Date((/* @__PURE__ */ new Date(day + "T12:00:00Z")).getTime() + amount * 864e5).toISOString().slice(0, 10);
  }
  function parseAutoTimes(value) {
    const list = String(value || "").trim().split(/[;,\s]+/).filter(Boolean).map((item) => item.replace(/^(\d):/, "0$1:"));
    if (!list.length) throw Error("Informe ao menos um horário no formato HH:MM.");
    if (new Set(list).size > 6) throw Error("Informe no máximo 6 horários.");
    const clean2 = [];
    for (const item of list) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(item)) throw Error(`Horário inválido: ${item}. Use HH:MM.`);
      if (!clean2.includes(item)) clean2.push(item);
    }
    return clean2.sort();
  }
  function autoConfig(settings = {}) {
    let times;
    try {
      times = parseAutoTimes(settings.autoUpdateTimes || AUTO_DEFAULT_TIMES);
    } catch {
      times = parseAutoTimes(AUTO_DEFAULT_TIMES);
    }
    const last = String(settings.autoUpdateLast || "");
    return {
      enabled: settings.autoUpdateEnabled !== false,
      times,
      last: /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(last) ? last : ""
    };
  }
  function latestDue(times, clock = saoPauloNow()) {
    let best = "";
    for (const time2 of times) {
      if (minutesOf(time2) <= clock.minutes) best = `${clock.day}T${time2}`;
    }
    if (!best) best = `${shiftDay(clock.day, -1)}T${times[times.length - 1]}`;
    return best;
  }
  function nextRun(times, clock = saoPauloNow()) {
    const upcoming = times.find((time2) => minutesOf(time2) > clock.minutes);
    return upcoming ? `${clock.day}T${upcoming}` : `${shiftDay(clock.day, 1)}T${times[0]}`;
  }
  function autoScheduleInfo(settings = {}, clock = /* @__PURE__ */ new Date()) {
    const config = autoConfig(settings);
    const now2 = saoPauloNow(clock);
    const due = latestDue(config.times, now2);
    return {
      ...config,
      due,
      dueReached: config.last < due,
      next: nextRun(config.times, now2)
    };
  }

  // schedule-panel.js
  var moment = (v) => v ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(/* @__PURE__ */ new Date(v + "-03:00")) : "Não agendada";
  function scheduleRow(value = "", index = 1, enabled = true) {
    return `<div class="schedule-row"><label class="field">Horário ${index}<input type="time" name="autoTime" value="${escapeHTML(value)}" ${enabled ? "required" : "disabled"}></label><button type="button" class="button ghost small" data-time-remove aria-label="Remover horário ${index}">Remover</button></div>`;
  }
  function schedulePanel(settings) {
    const auto = autoScheduleInfo(settings);
    return `<section class="panel schedule-panel" aria-label="Atualização automática"><form id="auto-form"><header class="schedule-head"><div><h2>Atualização automática</h2><p class="schedule-note">Escolha quando consultar suas fontes habilitadas.</p></div><label class="check-field schedule-toggle"><input type="checkbox" name="autoUpdateEnabled" ${auto.enabled ? "checked" : ""}> Ativar</label></header><div class="schedule-facts"><div><small>Próxima consulta · Brasília</small><strong data-schedule-next>${auto.enabled ? escapeHTML(moment(auto.next)) : "Desativada"}</strong></div><div><small>Estado do serviço</small><span class="schedule-state off" data-schedule-connection>Verificando conexão</span></div></div><fieldset class="schedule-times"><legend>Horários diários · até 6</legend><div data-time-list>${auto.times.map((v, i) => scheduleRow(v, i + 1, auto.enabled)).join("")}</div></fieldset><button type="button" class="button secondary schedule-add" data-time-add>+ Adicionar horário</button><p class="schedule-note" data-time-help>Horários repetidos serão reunidos e ordenados ao salvar.</p><p class="schedule-note">O computador e o serviço precisam estar ativos. Pode fechar esta aba.</p><p class="schedule-note" data-schedule-status>As consultas seguem os horários salvos, no fuso de Brasília.</p><p class="form-error" role="alert"></p><div class="schedule-footer"><button class="button primary" type="submit">Salvar horários</button></div><div class="schedule-manual"><strong>Precisa consultar antes?</strong><p class="schedule-note">Uma consulta manual não altera os horários salvos.</p><button type="button" class="button secondary" data-action="auto-now">Consultar agora</button></div></form></section>`;
  }

  // form-inputs.js
  function normalizeMoneyInput(value) {
    let text = String(value ?? "").trim().replace(/^R\$\s*/, "");
    if (text.includes(",")) {
      if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(text)) throw Error("Informe o valor como 1.250,00 ou 1250,00, com até duas casas decimais.");
      text = text.replace(/\./g, "").replace(",", ".");
    }
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw Error("Informe um valor positivo, por exemplo 125,50.");
    return text;
  }

  // loading-indicator.js
  function isWaitingMessage(value) {
    return /^(?:Consultando|Buscando|Lendo|Carregando|Verificando|Preparando|Gerando|Salvando|Processando|Atualizando|Criptografando|Restaurando|Aguardando resposta)\b/iu.test(String(value || "").trim());
  }
  function installLoadingIndicators(root = document.body) {
    const selector = '[role="status"],p,button';
    function update2(node) {
      if (!node?.matches?.(selector)) return;
      const waiting = isWaitingMessage(node.textContent);
      if (waiting) {
        node.setAttribute("data-loading", "true");
        node.setAttribute("aria-busy", "true");
      } else if (node.dataset.loading === "true" && !node.hasAttribute("data-loading-fixed")) {
        node.removeAttribute("data-loading");
        node.removeAttribute("aria-busy");
      }
    }
    function scan(node) {
      if (node?.nodeType === 1) {
        update2(node);
        node.querySelectorAll(selector).forEach(update2);
      }
    }
    scan(root);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        update2(record.target.nodeType === 1 ? record.target : record.target.parentElement);
        record.addedNodes.forEach(scan);
      }
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }

  // agendados.js
  var SCHEDULE_GROUPS = Object.freeze({ overdue: "Revisões atrasadas", today: "Revisar hoje", week: "Revisar nos próximos 7 dias", later: "Próximas revisões", undated: "Sem revisão marcada" });
  var SCHEDULE_SORTS = Object.freeze({ priority: "Data de revisão", client: "Cliente", status: "Situação do próximo passo" });
  function scheduleGroup(caseRow, today) {
    const review = String(caseRow?.review || "");
    if (!/^\d{4}-\d\d-\d\d$/.test(review)) return "undated";
    if (review < today) return "overdue";
    if (review === today) return "today";
    const difference = (Date.parse(review + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 864e5;
    return difference <= 7 ? "week" : "later";
  }
  function scheduledCases(cases, { owner = "all", query: query2 = "", sort = "priority", today, clientName: clientName2 = () => "" } = {}) {
    const todayKey = today || new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(/* @__PURE__ */ new Date());
    const all = (cases || []).filter((c) => !c.archived);
    const counts = { all: all.length, me: 0, court: 0, other: 0, client: 0 };
    for (const c of all) counts[c.workOwner in counts ? c.workOwner : "me"]++;
    const needle = String(query2 || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    const rows = all.filter((c) => (owner === "all" || (c.workOwner || "me") === owner) && (!needle || normalize([
      c.title,
      c.cnj,
      c.docketNumber,
      c.area,
      c.nextStep,
      clientName2(c.clientId),
      ...(c.pendingItems || []).map((x) => x.title)
    ].join(" ")).includes(needle)));
    const groups = Object.fromEntries(Object.keys(SCHEDULE_GROUPS).map((key) => [key, []]));
    for (const c of rows) groups[scheduleGroup(c, todayKey)].push(c);
    const byText = (a, b) => String(a || "").localeCompare(String(b || ""), "pt-BR");
    for (const group of Object.values(groups)) group.sort((a, b) => {
      if (sort === "client") return byText(clientName2(a.clientId), clientName2(b.clientId)) || byText(a.title, b.title);
      if (sort === "status") return byText(a.workStatus || "todo", b.workStatus || "todo") || byText(a.review || "9999", b.review || "9999");
      return byText(a.review || "9999", b.review || "9999") || byText(a.title, b.title);
    });
    return {
      groups,
      counts,
      rows,
      total: rows.length,
      today: todayKey,
      overview: {
        overdue: all.filter((c) => scheduleGroup(c, todayKey) === "overdue").length,
        today: all.filter((c) => scheduleGroup(c, todayKey) === "today").length,
        week: all.filter((c) => scheduleGroup(c, todayKey) === "week").length,
        pending: all.reduce((sum, c) => sum + (c.pendingItems || []).filter((x) => !x.done).length, 0)
      }
    };
  }

  // official-links.js
  var PORTALS = Object.freeze({
    tjrj: Object.freeze([
      { id: "portal", label: "Consulta processual TJRJ", url: "https://www.tjrj.jus.br/consultas/processos-jud/formas-dispo-consultas" },
      { id: "pje2", label: "PJe · 2º grau", url: "https://tjrj.pje.jus.br/2g/ConsultaPublica/listView.seam" },
      { id: "projudi", label: "Projudi · consulta pública", url: "https://www3.tjrj.jus.br/projudi/processo/consultaPublica.do?actionType=pesquisar" },
      { id: "eproc", label: "eproc · orientações TJRJ", url: "https://www.tjrj.jus.br/servicos/processo-eletronico" }
    ]),
    trf2: Object.freeze([
      { id: "portal", label: "Consultas processuais · TRF2", url: "https://www.trf2.jus.br/trf2/consultas-e-servicos/consultas-processuais" },
      { id: "eproc", label: "eproc · consulta pública unificada", url: "https://balcaojus.trf2.jus.br/balcaojus/#/consultar" },
      { id: "orientacoes", label: "Orientações do eproc · TRF2", url: "https://portaleproc.trf2.jus.br/" }
    ]),
    tjsp: Object.freeze([
      { id: "portal", label: "Consulta de processos · TJSP", url: "https://www.tjsp.jus.br/Processos" },
      { id: "eproc", label: "eproc · acesso e consulta unificada", url: "https://portal.tjsp.jus.br/eproc" },
      { id: "esaj", label: "e-SAJ · consultas por grau", url: "https://esaj.tjsp.jus.br/esaj?servico=190090" }
    ]),
    stj: Object.freeze([
      { id: "portal", label: "Consulta processual · STJ", url: "https://www.stj.jus.br/sites/portalp/Processos/Consulta-Processual/" }
    ]),
    stf: Object.freeze([
      { id: "portal", label: "Consulta processual · STF", url: "https://portal.stf.jus.br/processos/" }
    ])
  });
  function officialConsultation(input, system = "", court = "") {
    const isCase = input !== null && typeof input === "object" && !Array.isArray(input);
    const cnj = isCase ? input.cnj : input;
    const chosenCourt = isCase ? String(input.court || "") : String(court || "");
    const selectedSystem = isCase ? String(input.processSystem || input.judicialSystem || "") : String(system || "");
    const valid = validCnj(cnj), number = valid ? formatCnj(digits(cnj)) : "";
    const resolved = chosenCourt || (valid && digits(cnj).slice(13, 16) === "819" ? "tjrj" : "");
    if (!Object.hasOwn(PORTALS, resolved)) return null;
    const docket = isCase ? String(input.docketNumber || "").trim() : "";
    if (!valid && !docket) return null;
    const links = PORTALS[resolved];
    const priority = { pje: "pje2", projudi: "projudi", esaj: "esaj", eproc: "eproc", portal: "portal" }[selectedSystem];
    const sorted = priority ? [...links].sort((a, b) => Number(b.id === priority) - Number(a.id === priority)) : links;
    return { court: resolved, courtLabel: COURTS[resolved], number, docket, links: sorted, manualSources: MANUAL_COURT_SOURCES[resolved], system: selectedSystem, explicitCourt: !!chosenCourt };
  }

  // changelog.js
  var CHANGELOG = Object.freeze([
    { version: "0.6.1", date: "2026-11-06", title: "Limpeza e proteção do pacote local", summary: "Consolida helpers, remove código e estilos sem uso e reforça a API local, a CSP e o backup protegido.", changes: ["Consolida o escape de HTML e a normalização de texto em módulos compartilhados, sem alterar a saída.", "Remove código, imports e estilos sem uso e uniformiza os fins de linha dos scripts Windows.", "Mantém o pacote de release sem testes ou Playwright e valida a versão em package.json, core.js, serviço e interface.", "Exige sessão local (Origin e CSRF) também nas leituras de painel, backup, publicações, notificações, processos e certidões.", "Reescreve a checagem de Origin com tabela-verdade testada e compara o token CSRF com secrets.compare_digest.", "Remove o script inline do dashboard, serve boot-check.js próprio e retira unsafe-inline do script-src da CSP.", "Eleva o PBKDF2 do backup protegido para 600.000 iterações, mantendo a abertura de backups antigos."] },
    { version: "0.6.0", date: "2026-11-06", title: "Atualizações assinadas pelo GitHub Releases", summary: "Amplia a Central com atualização gráfica, verificação de assinatura, backup e recuperação.", changes: ["Consulta versões estáveis no repositório configurado e mostra novidades sem instalar automaticamente.", "Verifica assinatura RSA do editor, SHA-256, inventário e caminhos antes de substituir arquivos do programa.", "Preserva origem do navegador e dados locais; exige confirmação de backup do IndexedDB e cria backup SQLite consistente.", "Prepara dependências alteradas em ambiente separado, registra etapas e permite recuperar o código anterior quando o esquema é compatível."] },
    { version: "0.5.11", date: "2026-11-06", title: "Mais espaço nos processos em atenção", summary: "Melhora a separação dos cards e o acesso à carteira na página inicial.", changes: ["Organiza os cards de processos em atenção em uma lista com espaçamento consistente.", "Move Ver todos os processos para o cabeçalho como botão secundário com seta e foco de teclado."] },
    { version: "0.5.10", date: "2026-11-06", title: "Publicações unificadas e tarefas por estado", summary: "Conclui a organização com uma lista de publicações e filtros de tarefas.", changes: ["Reúne publicações da carteira e do serviço sem duplicar a mesma comunicação, preservando conferência, teor e PDFs.", "Mostra tarefas em aberto por padrão e permite consultar concluídas ou todas, com busca e reabertura."] },
    { version: "0.5.9", date: "2026-11-06", title: "Prioridades e organização do escritório", summary: "Prioriza o trabalho diário e separa ajustes de diagnóstico, com backup de recuperação.", changes: ["Coloca compromissos do dia, tarefas e revisões antes dos indicadores financeiros no Início.", "Agrupa as vistas de Trabalho e organiza Ajustes em Fontes, Automação, Dados e Diagnóstico.", "Substitui a carteira repetida por um resumo e concentra novidades na central de Notificações."] },
    { version: "0.5.8", date: "2026-11-06", title: "Agendamento e consultas mais claros", summary: "Reorganiza atualização automática, diferencia status e orienta o acesso oficial ao Jus.br.", changes: [
      "Destaca próxima consulta e conexão, alinha horários e separa a consulta manual das alterações do agendamento.",
      "Diferencia por texto e cor cada status do histórico, inclusive conclusão, não localizado, parcialidade e indisponibilidade.",
      "Interpreta movimentos das tabelas TJSP de primeiro grau e do retorno de segundo grau do juscraper, sem concluir êxito quando o formato é desconhecido ou incompleto.",
      "Inclui instruções e links oficiais do Jus.br, deixando claro que o login do portal não conecta essa fonte automaticamente ao painel."
    ] },
    { version: "0.5.7", date: "2026-11-06", title: "Proteções de importação e distribuição", summary: "Reforça datas de backups, restauração do monitoramento, redirecionamentos e arquivos distribuídos.", changes: [
      "Valida datas importadas de anexos e períodos de consulta; a apresentação de datas não devolve marcação HTML.",
      "Reaplica regras de configuração e verifica tipos, datas e objetos JSON do monitoramento antes de restaurar ou criar o backup de segurança.",
      "Aplica no serviço a mesma verificação de tipos e assinaturas de anexos usada pelo navegador.",
      "Restringe redirecionamentos JSON do DJEN ao mesmo host HTTPS e troca a seleção por extensões por um inventário explícito de distribuição."
    ] },
    { version: "0.5.6", date: "2026-11-06", title: "Conclusão da auditoria de formulários", summary: "Protege rascunhos ao sair dos formulários e preserva ajustes ainda não salvos.", changes: [
      "Pede confirmação antes de fechar formulários alterados por Cancelar, X ou Escape, e antes de sair de Ajustes por um link.",
      "Salvar conexões preserva horários em edição e salvar horários preserva conexões em edição, sem perder o outro rascunho.",
      "Rejeita linhas vazias de horários ativos e mantém a orientação de seis horários ao atualizar o estado do serviço."
    ] },
    { version: "0.5.5", date: "2026-11-06", title: "Prevenção de erros nos ajustes", summary: "Chave protegida contra edição acidental e horários com seletores próprios.", changes: [
      "Mostra apenas o final da chave, com ações explícitas para substituir, cancelar ou preparar remoção ao salvar.",
      "Troca a lista digitada por campos de horário, com inclusão e remoção, deduplicação e limite de seis consultas diárias.",
      "Aceita valores financeiros no formato brasileiro, informa limites de contato e preserva a validação de centavos.",
      "Normaliza espaços na OAB, exige número e UF juntos e direciona o foco às mensagens de erro sem apagar o preenchimento."
    ] },
    {
      version: "0.5.4",
      date: "2026-11-06",
      title: "Retorno à execução exclusivamente local",
      summary: "Remove as adaptações de nuvem da v0.5.2 e corrige a reutilização de serviço antigo pelo iniciador integrado.",
      changes: [
        "Retira a entrada de nuvem, autenticação de hospedagem, marcador HTTPS e ferramentas de empacotamento para Botkeep; o servidor escuta somente neste computador.",
        "O iniciador integrado encerra uma instância de versão antiga e inicia a atual; o aviso de incompatibilidade informa as duas versões e a ação necessária.",
        "Preserva cadastros, anexos, monitoramento e a Central de Notificações da v0.5.3, incluindo busca por trechos sem distinguir acentos e maiúsculas."
      ]
    },
    {
      version: "0.5.3",
      date: "2026-11-06",
      title: "Central de notificações dos processos",
      summary: "Novo menu reúne movimentações e publicações com filtros, contador e conferência reversível.",
      changes: [
        "Reúne novidades do serviço e do histórico da carteira, sem duplicar a mesma comunicação recebida por CNJ e OAB.",
        "Oferece busca por processo, CNJ ou texto e filtros de estado, tipo, fonte, tribunal, processo e período, com paginação.",
        "Permite abrir o processo, ler o teor completo e marcar ou desmarcar a conferência individual ou das não lidas na página.",
        "Preserva o modo local, o histórico conferido e a referência inicial, com mensagens distintas para carregamento, lista vazia e falha de conexão."
      ]
    },
    {
      version: "0.5.2",
      date: "2026-11-06",
      title: "Preparação para hospedagem com modo local preservado",
      summary: "Entrada de nuvem separada com acesso protegido e banco próprio, sem alterar os iniciadores locais.",
      changes: [
        "Adiciona inicialização explícita para HTTPS com autenticação, origem configurada e diretório persistente obrigatório.",
        "Reconhece o modo integrado na nuvem somente no HTML marcado pelo servidor; mantém a execução local e o modo arquivo.",
        "Inclui pacote limpo de implantação e instruções para Botkeep, sem bancos, anexos, credenciais ou sincronização automática."
      ]
    },
    {
      version: "0.5.1",
      date: "2026-11-06",
      title: "Confirmação ao aplicar dados do DataJud",
      summary: "Aplicação dos dados informa o que foi preenchido e o changelog recupera a acentuação correta.",
      changes: [
        "O botão de aplicação passa a indicar Dados aplicados e exibe uma confirmação ao lado da ação, com campos preenchidos, dados públicos adicionados e aviso de que ainda é necessário salvar a ficha.",
        "Quando não há dados novos para preencher, a interface informa que nenhum campo foi alterado; trocar o registro ou editar tribunal, grau ou sistema libera uma nova aplicação.",
        "Corrige letras acentuadas substituídas por pontos de interrogação na entrada 0.5.0 do changelog e na documentação local."
      ]
    },
    {
      version: "0.5.0",
      date: "2026-11-06",
      title: "Cadastros locais em segundo plano",
      summary: "Carteira e anexos passam ao serviço local no modo integrado, com API para gerenciamento sem controlar a tela.",
      changes: [
        "Migra cadastros completos e anexos do navegador para SQLite na primeira abertura integrada, preservando a cópia original e criando backup da migração.",
        "Adiciona API local de cadastro, edição, arquivamento e exclusão de processos, com as mesmas validações do painel e backup antes de cada gravação.",
        "Impede sobrescritas por revisões antigas e sincronizações de abas anteriores; formulários abertos detectam alterações feitas em segundo plano.",
        "Mantém o modo arquivo com armazenamento próprio no navegador; o modo integrado usa o banco do serviço e exige Node.js para validar cadastros."
      ]
    },
    {
      version: "0.4.2",
      date: "2026-11-06",
      title: "Espera maior no DataJud",
      summary: "Consultas lentas do DataJud deixam de ser interrompidas pelo limite de 60 segundos.",
      changes: [
        "Amplia o limite de espera do DataJud de 60 para 120 segundos, tanto na fila de acompanhamento quanto no teste de conexão real, sem mudar endpoints nem chave pública.",
        "Mantém a consulta lenta como indisponível somente quando o DataJud não responde, evitando tratar espera longa como processo não localizado."
      ]
    },
    {
      version: "0.4.1",
      date: "2026-11-06",
      title: "DataJud mais resistente e fontes separadas",
      summary: "Espera ampliada no DataJud, busca de publicações por nome e seções independentes por fonte.",
      changes: [
        "Integra o cliente DataJud do projeto mcp-juridico-brasil com versão fixada, endpoint /_search exato e bloqueio de consultas simultâneas entre fila, cadastro e diagnóstico.",
        "Amplia o limite de espera do DataJud para 60 segundos, inclusive no teste de conexão real, sem repetição automática em timeout ou HTTP 504.",
        "Respostas incompletas do DataJud deixam de ser tratadas como processo não localizado, e a fila não duplica consultas longas em andamento.",
        "Separa andamentos e metadados do DataJud das publicações do DJEN, cada fonte com botão, resultado e erro próprios na ficha do processo.",
        "Publicações do DJEN passam a guardar e exibir destinatários, advogados e OAB, além de texto, links e certidão disponíveis.",
        "Adiciona busca avulsa de publicações por nome da parte ou do advogado, com período de 7 a 365 dias e resultados paginados, sem cadastrar processos automaticamente.",
        "Inclui indicadores animados de espera nas consultas, no diagnóstico e no carregamento, respeitando a preferência por movimento reduzido."
      ]
    },
    {
      version: "0.4.0",
      date: "2026-11-05",
      title: "Serviço local de acompanhamento processual",
      summary: "Acompanhamento via serviço Python local e histórico persistente sem manter a aba aberta.",
      changes: [
        "Adiciona API Python same-origin em loopback e armazenamento SQLite separado dos cadastros do IndexedDB.",
        "Consulta DataJud e DJEN com fila persistente, tratamento de falhas, novidades e separação de tramitações, sem prometer cobertura integral.",
        "A carteira utiliza somente a visualização em lista, com ações por seleção para arquivar, desarquivar e excluir com proteção do histórico.",
        "Publicações DJEN incluem o teor da comunicação, download da certidão oficial emitida pelo CNJ quando há hash válido e cópia PDF local alternativa.",
        "Revisa a UI/UX: consultas recentes com seis registros por página, busca e filtros, publicações integradas paginadas, detalhes recolhidos, foco preservado durante atualização e melhorias em telas pequenas.",
        "Agendados: processos em lista com revisão por data, próximo passo, responsável pela ação, situação, último visto, checklist de pendências e paginação de quinze registros.",
        "Inclui adaptador opcional juscraper 0.5.0 para TJSP e-SAJ primeiro e segundo graus; ainda requer validação com casos reais.",
        "Inclui iniciadores Windows, migração via backup protegido entre file:// e localhost e status do serviço."
      ]
    },
    {
      version: "0.3.0",
      date: "2026-11-05",
      title: "Aplicativo local, sem extensão e sem servidor",
      summary: "O Painel H.B abre direto do dashboard.html, mantém o banco no navegador e ganha atualização automática configurável.",
      changes: [
        "Remove a dependência de extensão, service worker, auxiliar nativo e mensagens do Chrome; a fila e o agendador passam a rodar na própria página.",
        "Consultas usam fetch direto: o DJEN funciona pela API pública e o DataJud pode ser bloqueado por CORS no modo arquivo local, com mensagens claras de limite HTTP 429, bloqueio e tempo esgotado.",
        "Fontes e ajustes ganha horários de atualização automática (padrão 08:00 e 18:00), recuperação da última janela perdida e botão de consulta manual.",
        "Inclui ABRIR-PAINEL.cmd, inicialização opcional com o Windows e documentação de migração do backup da extensão para o aplicativo local.",
        "Mantém IndexedDB, anexos, backup com senha AES-GCM, conferências, cobertura, importação Excel/CSV e as telas existentes."
      ]
    },
    {
      version: "0.2.16",
      date: "2026-11-05",
      title: "Revisão geral de segurança e importação",
      summary: "Corrige riscos de perda de dados, reforça o acompanhamento e permite conferir toda a importação.",
      changes: [
        "Importa recursos do STJ e STF pelo registro próprio quando não houver CNJ; detecta números superiores repetidos e mantém processos arquivados na ida e volta CSV.",
        "Prévia do Excel/CSV prioriza linhas problemáticas e disponibiliza relatório completo; identifica o número físico da linha e impede importação parcial em caso de falha.",
        "Não apaga campos de configuração em edição durante atualizações do banco; amplia o modo privacidade em detalhes, avisos e formulários.",
        "A retentativa do DJEN conserva o intervalo anterior, e consultas de processos arquivados ou de fontes desativadas são canceladas antes de gravar respostas tardias.",
        "Backup inclui consultas pendentes como interrompidas, valida vínculos de publicação por CNJ, otimiza conferência de saldos e anexos, e preserva compatibilidade criptográfica com contagens PBKDF2 suportadas."
      ]
    },
    {
      version: "0.2.15",
      date: "2026-11-05",
      title: "Carteira pronta para organização assistida",
      summary: "Filtre processos, baixe modelo de planilha e exporte sua carteira com avisos de segurança.",
      changes: [
        "Filtros combináveis de tribunal, grau e sistema diretamente na carteira; a seleção de processos é limpa quando o filtro muda para evitar atualizar casos ocultos.",
        "Modelo CSV vazio para preencher depois e exportação da carteira (incluindo arquivados) com confirmação de privacidade e proteção contra células que podem executar fórmulas no Excel.",
        "Orientações de primeiro uso em Fontes e ajustes: identificação de cadastros incompletos, backup com senha, diagnóstico de integridade e verificação de acesso às fontes."
      ]
    },
    {
      version: "0.2.14",
      date: "2026-11-05",
      title: "Mapa de evidências por tribunal e instância",
      summary: "Veja onde existem comparações manuais DJEN/DataJud sem confundir amostras com cobertura comprovada.",
      changes: [
        "Fontes e ajustes mostra uma matriz de amostras por tribunal, grau, sistema e fonte; destaca tribunais sem evidências registradas e não exibe percentuais de cobertura.",
        "Cada processo conta somente uma vez por fonte na matriz, usando sua última comparação, para não inflar a quantidade de processos verificados.",
        "Novas amostras preservam a classificação declarada no momento do registro. Alterações posteriores de CNJ, tribunal, grau ou sistema não reatribuem as comparações antigas; backups anteriores permanecem compatíveis."
      ]
    },
    {
      version: "0.2.13",
      date: "2026-11-05",
      title: "Portais oficiais e conferências por tribunal",
      summary: "Acesse consultas oficiais de cada tribunal e registre conferências sem misturar os processos.",
      changes: [
        "Fichas com tribunal confirmado exibem portais oficiais para TJRJ, TRF2, TJSP, STJ e STF, com destaque para o sistema informado e sem consultas automáticas.",
        "As conferências manuais aceitam portais disponíveis em cada tribunal e preservam tribunal, CNJ e registro adicional; recursos STJ/STF podem ser conferidos por número próprio.",
        "A compatibilidade com conferências antigas do TJRJ permanece. Alterar referências mantém o histórico anterior no backup, sem tratá-lo como resultado atual."
      ]
    },
    {
      version: "0.2.12",
      date: "2026-11-05",
      title: "Tribunais, instâncias e recursos vinculados",
      summary: "Identifique processos por tribunal, grau, sistema e vínculo de origem sem misturar históricos.",
      changes: [
        "TJRJ, TRF2, TJSP, STJ e STF com graus estaduais, federais e superiores, e sistemas separados por processo.",
        "Vínculos manuais entre processos com verificação de ciclos e preservação de números, eventos e documentos próprios.",
        "Importação Excel e CSV com mapeamento de tribunal, instância, sistema, registro adicional e referência de origem."
      ]
    },
    {
      version: "0.2.11",
      date: "2026-11-05",
      title: "Importar carteira Excel e CSV",
      summary: "Leia planilhas locais, confira as colunas e cadastre os processos válidos.",
      changes: [
        "A área de Processos agora importa arquivos XLSX, CSV e TSV locais, com escolha de aba, mapeamento de colunas e prévia dos registros.",
        "CNJs inválidos, duplicados, fórmulas e números do Excel são separados para revisão; clientes com nomes iguais exigem confirmação adicional.",
        "Tribunal, grau e demais colunas ainda sem campo próprio são preservados nas observações. Não são feitas consultas automáticas após a importação."
      ]
    },
    {
      version: "0.2.10",
      date: "2026-11-05",
      title: "Amostras de cobertura dos portais oficiais",
      summary: "Registre comparações por processo e fonte, sem presumir cobertura.",
      changes: [
        "Fontes e ajustes permite registrar comparações manuais com DJEN ou DataJud, informando processo, data, resultado observado e evidência textual.",
        "Uma comparação positiva ou divergente exige que exista uma consulta local concluída da mesma fonte e CNJ; falhas só podem ser inconclusivas ou indisponíveis.",
        "O histórico fica no backup protegido; um CNJ corrigido preserva os registros antigos, sem atribuí-los ao número novo."
      ]
    },
    {
      version: "0.2.9",
      date: "2026-11-05",
      title: "Auxiliar e instalação verificados",
      summary: "Instalação revisada, com diagnóstico da pasta e pacote portátil.",
      changes: [
        "A verificação local identifica registros Chrome, Edge ou Chromium que ainda apontam para uma pasta antiga da extensão.",
        "O auxiliar informa a mesma versão do Painel H.B; o botão Verificar auxiliar avisa quando precisa ser atualizado.",
        "O empacotamento agora acompanha a versão atual e exclui caminhos absolutos, registros locais e chaves temporárias."
      ]
    },
    {
      version: "0.2.8",
      date: "2026-11-05",
      title: "Diagnóstico manual da conexão com fontes",
      summary: "Verifique DJEN e DataJud sem consultar os seus processos.",
      changes: [
        "Fontes e ajustes oferece o botão Verificar conexão DJEN e DataJud, que testa cada API com um CNJ sintético e não modifica o banco.",
        "A resposta separa acesso válido, limites temporários HTTP 429, acesso recusado e falhas, sem tratar uma resposta vazia como prova de cobertura.",
        "O DJEN foi novamente validado em consulta pública real pelo auxiliar local; a cobertura de casos reais requer verificação independente."
      ]
    },
    {
      version: "0.2.7",
      date: "2026-11-05",
      title: "Diagnóstico de integridade dos dados locais",
      summary: "Confira vínculos, saldos e anexos sem modificar registros.",
      changes: [
        "Fontes e ajustes inclui o botão Verificar dados e anexos, que executa somente verificações locais e não consulta tribunais.",
        "O relatório aponta possíveis inconsistências de CNJ, vínculos e saldos e confere o tamanho e hash dos anexos armazenados.",
        "Os resultados são apresentados em contagens, sem expor dados pessoais no diagnóstico nem corrigir automaticamente os registros."
      ]
    },
    {
      version: "0.2.6",
      date: "2026-11-05",
      title: "Confirmação antes de corrigir o CNJ",
      summary: "Veja os vínculos antes de alterar o número de um processo.",
      changes: [
        "Ao alterar um CNJ já cadastrado, o Painel H.B mostra quantas tarefas, compromissos, honorários, recebimentos, anexos e conferências estão relacionados à ficha.",
        "A correção exige reconhecimento explícito dos efeitos sobre publicações e consultas antigas; sem confirmação os dados não são modificados.",
        "Dados financeiros, tarefas, agenda e anexos permanecem vinculados à ficha para revisão manual, sem exclusão automática."
      ]
    },
    {
      version: "0.2.5",
      date: "2026-11-05",
      title: "Vínculos seguros por número CNJ",
      summary: "Publicações antigas acompanham o cadastro correto do processo.",
      changes: [
        "Publicações já encontradas por OAB são vinculadas quando o processo é cadastrado ou importado pelo mesmo número CNJ.",
        "A opção Associar por CNJ reconcilia registros antigos locais, sem nova consulta nem alterar a marcação de conferência.",
        "Corrigir um CNJ separa publicações anteriores, cancela consultas pendentes do número antigo e impede resultados atrasados no processo errado."
      ]
    },
    {
      version: "0.2.4",
      date: "2026-11-05",
      title: "Triagem e navegação de publicações",
      summary: "Filtre e percorra todas as publicações já encontradas.",
      changes: [
        "A área de Publicações agora filtra por Todas, Novas, Conferidas e Sem processo vinculado, com contadores.",
        "O botão Mostrar mais permite acessar publicações além das primeiras 100 sem nova consulta de rede.",
        "As marcações de conferência continuam individuais e não representam ciência de intimação."
      ]
    },
    {
      version: "0.2.3",
      date: "2026-11-05",
      title: "Busca por OAB com alerta e retentativa",
      summary: "Falhas nas publicações por OAB agora aparecem na visão geral.",
      changes: [
        "A visão geral sinaliza bloqueios e erros pendentes na busca do DJEN pela OAB e UF configuradas.",
        "O botão Tentar novamente refaz apenas aquela consulta OAB/UF e conserva o período original quando disponível.",
        "O registro histórico das tentativas permanece íntegro; trocar a OAB configurada oculta avisos da inscrição anterior."
      ]
    },
    {
      version: "0.2.2",
      date: "2026-11-05",
      title: "Falhas de fontes visíveis na visão geral",
      summary: "Identifique falhas de consulta e repita só a fonte necessária.",
      changes: [
        "A visão geral destaca consultas DJEN ou DataJud com erro, bloqueio ou interrupção que ainda não tiveram resultado posterior concluído.",
        "O botão Tentar novamente reinicia apenas a fonte afetada daquele processo, mantendo histórico anterior e dados já encontrados.",
        "Uma consulta concluída posteriormente encerra o aviso daquela fonte; ausência de publicações não é tratada como falha."
      ]
    },
    {
      version: "0.2.1",
      date: "2026-11-05",
      title: "Novidades dentro do Painel H.B",
      summary: "Um espaço discreto para acompanhar as atualizações.",
      changes: [
        "Cartão de novidades na barra lateral, acessível também em telas pequenas.",
        "Histórico de versões dentro da extensão, sem depender de sites externos."
      ]
    },
    {
      version: "0.2.0",
      date: "2026-11-05",
      title: "Consultas, organização e acompanhamento",
      summary: "Evolução da gestão local de processos e conferências.",
      changes: [
        "Atualização manual pelo DJEN e DataJud, com histórico, paginação e tratamento de falhas. DataJud permanece opcional.",
        "Atalhos oficiais para conferência dos processos TJRJ e identificação manual de PJe, eproc ou Projudi.",
        "Histórico de conferências manuais e criação de tarefas vinculadas às pendências, sem cálculo de prazos.",
        "Backup protegido por senha, anexos locais, recebimentos e estornos individualizados."
      ]
    },
    {
      version: "0.1.0",
      date: "",
      title: "Primeira versão do painel",
      summary: "Base local de gestão jurídica.",
      changes: [
        "Cadastros de clientes e processos, quadro de etapas e importação de CNJs.",
        "Tarefas, agenda manual, honorários e configuração inicial de fontes públicas."
      ]
    }
  ]);

  // publication-pdf.js
  var ZONE = "America/Sao_Paulo";
  var validDay2 = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = /* @__PURE__ */ new Date(value + "T12:00:00Z");
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === value;
  };
  function publicationDateBR(value) {
    const input = String(value ?? "").trim(), day = input.slice(0, 10);
    if (!validDay2(day)) return "Sem data";
    if (/^\d{4}-\d\d-\d\d$/.test(input) || !/(Z|[+-]\d\d:\d\d)$/i.test(input)) return day.slice(8) + "/" + day.slice(5, 7) + "/" + day.slice(0, 4);
    const d = new Date(input);
    return Number.isNaN(d.valueOf()) ? "Sem data" : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: ZONE }).format(d);
  }
  function safePublicationUrl(value) {
    if (typeof value !== "string" || value.length > 2048 || /[\x00-\x20]/.test(value)) return "";
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname && !url.username && !url.password ? url.href : "";
    } catch {
      return "";
    }
  }
  function djenCertificateUrl(value) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(value)) return "";
    return "https://comunicaapi.pje.jus.br/api/v1/comunicacao/" + value + "/certidao";
  }
  function officialCertificateFilename(item) {
    return publicationPdfFilename(item).replace(/^Painel-HB-publicacao-/, "CNJ-certidao-publicacao-");
  }
  function downloadPdfBlob(blob, filename) {
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5e3);
  }
  async function fetchOfficialCertificate(item, { integrated: integrated2 = false, fetcher = fetch } = {}) {
    const hash = item?.certificateHash ?? item?.certificate_hash;
    const official = djenCertificateUrl(hash);
    if (!official) throw Error("A publicação não possui código de certidão. Atualize a consulta DJEN.");
    const localId = String(item.id ?? "");
    if (integrated2 && !/^djen:[A-Za-z0-9:_.-]{1,120}$/.test(localId)) throw Error("Identificador da publicação inválido.");
    const target = integrated2 ? "/api/v1/publications/" + encodeURIComponent(localId) + "/certidao" : official;
    let response;
    try {
      response = await fetcher(target, { cache: "no-store", signal: AbortSignal.timeout(18e3), ...integrated2 ? { credentials: "same-origin" } : {} });
    } catch (error) {
      throw Error(error?.name === "TimeoutError" ? "Tempo esgotado ao baixar certidão no CNJ." : "Não foi possível baixar a certidão. No HTML direto, o navegador pode bloquear a leitura por CORS; use “Abrir certidão no CNJ”.");
    }
    if (!response.ok) {
      let message = "";
      if (integrated2) try {
        message = (await response.json()).error || "";
      } catch {
      }
      throw Error(message || "Certidão indisponível no CNJ (HTTP " + response.status + ").");
    }
    const limit = 8e6;
    if (Number(response.headers?.get("content-length") || 0) > limit) throw Error("A certidão excede o limite de 8 MB.");
    let data;
    if (response.body?.getReader) {
      const reader = response.body.getReader(), chunks = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > limit) throw Error("A certidão excede o limite de 8 MB.");
          chunks.push(value);
        }
      } catch (error) {
        await reader.cancel().catch(() => {
        });
        throw error;
      }
      data = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.byteLength;
      }
    } else data = new Uint8Array(await response.arrayBuffer());
    if (data.length > limit || data.length < 8 || new TextDecoder("ascii").decode(data.slice(0, 5)) !== "%PDF-") throw Error("A fonte não retornou um PDF válido; nenhum arquivo foi salvo.");
    return new Blob([data], { type: "application/pdf" });
  }
  async function downloadOfficialCertificate(item, options = {}) {
    const blob = await fetchOfficialCertificate(item, options);
    downloadPdfBlob(blob, officialCertificateFilename(item));
  }
  function publicationPdfFilename(item) {
    const date2 = String(item.date ?? item.occurred_at ?? "").slice(0, 10);
    const cnj = String(item.cnj ?? "").replace(/\D/g, "").slice(0, 20) || "sem-cnj";
    const suffix = String(item.id ?? "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(-45) || "registro";
    return `Painel-HB-publicacao-${cnj}-${validDay2(date2) ? date2 : "sem-data"}-${suffix}.pdf`;
  }
  var remap = { "€": 128, "‚": 130, "ƒ": 131, "„": 132, "…": 133, "†": 134, "‡": 135, "ˆ": 136, "‰": 137, "Š": 138, "‹": 139, "Œ": 140, "Ž": 142, "‘": 145, "’": 146, "“": 147, "”": 148, "•": 149, "–": 150, "—": 151, "˜": 152, "™": 153, "š": 154, "›": 155, "œ": 156, "ž": 158, "Ÿ": 159 };
  var cleanText = (value) => String(value ?? "").replace(/\r\n?/g, "\n").replace(/[\t\f\v]/g, " ");
  function winAnsi(value) {
    let out = "";
    for (const c of cleanText(value)) {
      const n = c.codePointAt(0), v = remap[c] ?? (n >= 32 && n <= 126 || n >= 160 && n <= 255 ? n : 63);
      out += String.fromCharCode(v);
    }
    return out;
  }
  var literal = (value) => winAnsi(value).replace(/[\\()]/g, "\\$&");
  function wrap(value, max = 82) {
    const lines = [];
    for (const paragraph of cleanText(value).split("\n")) {
      if (!paragraph.trim()) {
        lines.push("");
        continue;
      }
      let line = "";
      for (const word of paragraph.trim().split(/\s+/)) {
        if (line && line.length + 1 + word.length > max) {
          lines.push(line);
          line = "";
        }
        if (word.length > max) {
          if (line) {
            lines.push(line);
            line = "";
          }
          for (let i = 0; i < word.length - max; i += max) lines.push(word.slice(i, i + max));
          line = word.slice(Math.max(0, word.length - word.length % max));
          if (!line) line = word.slice(-max);
        } else line += (line ? " " : "") + word;
      }
      lines.push(line);
    }
    return lines;
  }
  function bytes(text) {
    const output = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) output[i] = text.charCodeAt(i) & 255;
    return output;
  }
  function publicationPdfBlob(item) {
    if (!item || typeof item !== "object") throw Error("Publicação inválida para exportação.");
    const fields2 = [`Processo: ${item.cnj || "Não informado"}`, `Data: ${publicationDateBR(item.date ?? item.occurred_at)}`, `Fonte: ${item.tribunal || item.source || "Não informada"}`];
    const url = safePublicationUrl(item.url);
    if (url) fields2.push("Link da fonte: " + url);
    const lines = [...fields2.flatMap((x) => wrap(x)), "", ...wrap(item.text || "Conteúdo não informado."), "", ...wrap("Cópia local gerada pelo Painel H.B. Confira o texto e as informações no portal oficial; este PDF não substitui a publicação original.")];
    const perPage = 42, pages = [];
    for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
    if (!pages.length) pages.push([]);
    const objects = [null], add = (v) => (objects.push(v), objects.length - 1);
    const fontRegular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>");
    const fontTitle = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const pagesId = add("");
    const pageIds = [];
    pages.forEach((lines2, index) => {
      let stream = "0.16 0.32 0.23 rg\nBT /F2 17 Tf 45 788 Td (" + literal("Publicação judicial · Painel H.B") + ") Tj ET\n";
      stream += "0.75 0.82 0.72 RG 45 774 m 550 774 l S\n";
      lines2.forEach((line, i) => {
        stream += "0.16 0.20 0.17 rg\nBT /F1 10 Tf 45 " + (743 - i * 15) + " Td (" + literal(line) + ") Tj ET\n";
      });
      stream += "0.48 0.52 0.47 rg\nBT /F1 9 Tf 45 39 Td (" + literal("Painel H.B · cópia não oficial · página " + (index + 1) + " de " + pages.length) + ") Tj ET\n";
      const contentId = add("<< /Length " + bytes(stream).length + " >>\nstream\n" + stream + "endstream");
      pageIds.push(add("<< /Type /Page /Parent " + pagesId + " 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 " + fontRegular + " 0 R /F2 " + fontTitle + " 0 R >> >> /Contents " + contentId + " 0 R >>"));
    });
    objects[pagesId] = "<< /Type /Pages /Kids [" + pageIds.map((n) => n + " 0 R").join(" ") + "] /Count " + pageIds.length + " >>";
    const catalogId = add("<< /Type /Catalog /Pages " + pagesId + " 0 R >>");
    let output = "%PDF-1.4\n%âãÏÓ\n";
    const offsets = [0];
    for (let i = 1; i < objects.length; i++) {
      offsets[i] = bytes(output).length;
      output += i + " 0 obj\n" + objects[i] + "\nendobj\n";
    }
    const xref = bytes(output).length;
    output += "xref\n0 " + objects.length + "\n0000000000 65535 f \n";
    for (let i = 1; i < objects.length; i++) output += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
    output += "trailer\n<< /Size " + objects.length + " /Root " + catalogId + " 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
    return new Blob([bytes(output)], { type: "application/pdf" });
  }
  function downloadPublicationPdf(item) {
    downloadPdfBlob(publicationPdfBlob(item), publicationPdfFilename(item));
  }

  // text-utils.js
  var fold = (value) => String(value ?? "").normalize("NFD").replace(new RegExp("\\p{M}", "gu"), "").toLocaleLowerCase("pt-BR");

  // notifications.js
  var notificationKey = (e) => JSON.stringify([e.source, String(e.cnj || "").replace(/\D/g, ""), e.id]);
  var notificationSource = (s) => ({ djen: "DJEN", datajud: "DataJud", esaj_pg: "TJSP e-SAJ · 1º grau", esaj_sg: "TJSP e-SAJ · 2º grau" })[s] || s || "Fonte não informada";
  var time = (v) => Number.isFinite(Date.parse(v)) ? Date.parse(v) : 0;
  var eventDay = (value) => {
    const day = publicationDateBR(value);
    return /^\d\d\/\d\d\/\d{4}$/.test(day) ? day.split("/").reverse().join("-") : "";
  };
  function notificationRows(state2, serviceEvents = []) {
    const rows = /* @__PURE__ */ new Map(), cases = state2?.cases || [];
    const byId = new Map(cases.map((c) => [c.id, c])), byCnj = /* @__PURE__ */ new Map();
    for (const c of cases) if (c.cnj && !byCnj.has(c.cnj)) byCnj.set(c.cnj, c);
    const append = (raw, remote2) => {
      if (!raw || !["publication", "movement"].includes(raw.kind)) return;
      const e = {
        ...raw,
        remote: remote2,
        date: raw.date || raw.occurred_at,
        discoveredAt: raw.discoveredAt || raw.first_seen,
        caseId: raw.caseId || raw.case_id || "",
        seen: !!raw.seen,
        localIds: [],
        serviceRefs: []
      };
      const linked = byId.get(e.caseId), c = linked && (!e.cnj || linked.cnj === e.cnj) ? linked : byCnj.get(e.cnj);
      e.caseId = c?.id || "";
      e.title = c?.title || "Processo não vinculado";
      e.court = c?.court || "";
      e.tribunal = raw.tribunal || { tjrj: "TJRJ", tjsp: "TJSP", trf2: "TRF2", stj: "STJ", stf: "STF", other: "Outro tribunal" }[e.court] || e.court || "";
      e.key = notificationKey(e);
      const old = rows.get(e.key);
      if (remote2) e.serviceRefs = [{ caseId: raw.case_id || "", source: e.source, eventId: e.id, cnj: e.cnj }];
      else e.localIds = [e.id];
      if (old) {
        const latest = time(e.last_seen || e.discoveredAt) > time(old.last_seen || old.discoveredAt) ? e : old;
        rows.set(e.key, {
          ...latest,
          remote: old.remote || remote2,
          seen: old.seen && e.seen,
          localIds: [...old.localIds, ...e.localIds],
          serviceRefs: [...old.serviceRefs, ...e.serviceRefs],
          text: old.remote && !remote2 ? old.text : e.text
        });
      } else rows.set(e.key, e);
    };
    for (const e of state2?.events || []) append(e, false);
    for (const e of serviceEvents) append(e, true);
    return [...rows.values()].sort((a, b) => time(b.last_seen || b.discoveredAt) - time(a.last_seen || a.discoveredAt) || a.key.localeCompare(b.key));
  }
  function selectNotifications(rows, filters = {}, page = 1, pageSize = 20) {
    const q = fold(filters.search).trim(), cnjQuery = String(filters.search || "").replace(/\D/g, "");
    const selected2 = rows.filter((e) => (filters.status !== "unseen" || !e.seen) && (filters.status !== "seen" || e.seen) && (!filters.source || e.source === filters.source) && (!filters.kind || e.kind === filters.kind) && (!filters.court || e.tribunal === filters.court) && (!filters.caseId || e.caseId === filters.caseId) && (!filters.from || eventDay(e.date) >= filters.from) && (!filters.to || eventDay(e.date) <= filters.to) && (!q || fold([e.title, e.cnj, e.text, e.tribunal, notificationSource(e.source)].join(" ")).includes(q) || cnjQuery.length >= 7 && String(e.cnj || "").includes(cnjQuery)));
    const pages = Math.max(1, Math.ceil(selected2.length / pageSize));
    page = Math.max(1, Math.min(page, pages));
    return {
      rows: selected2.slice((page - 1) * pageSize, page * pageSize),
      total: selected2.length,
      page,
      pages,
      counts: { all: rows.length, unseen: rows.filter((e) => !e.seen).length, seen: rows.filter((e) => e.seen).length }
    };
  }
  var NotificationCenter = class {
    constructor(options) {
      Object.assign(this, options);
      this.events = [];
      this.filters = { status: "unseen" };
      this.page = 1;
      this.loaded = false;
      this.error = "";
      this.lastFetch = 0;
      this.busy = false;
      this.loading = false;
      this.details = /* @__PURE__ */ new Map();
      this.writeEpoch = 0;
    }
    rows() {
      return notificationRows(this.getState(), this.events);
    }
    mount() {
      this.paint();
      void this.refresh();
    }
    badge() {
      const total = this.rows().filter((e) => !e.seen).length;
      document.querySelectorAll("[data-notification-count]").forEach((x) => {
        x.textContent = String(total);
        x.hidden = !total;
        x.setAttribute("aria-label", total + " não conferidas");
      });
      document.querySelectorAll("[data-notification-metric]").forEach((x) => x.textContent = String(total));
    }
    async refresh(force = false) {
      this.badge();
      if (!this.isIntegrated()) {
        this.loaded = true;
        this.paint();
        return;
      }
      if (this.loading || this.busy || !force && Date.now() - this.lastFetch < 1e4) return;
      this.loading = true;
      if (!this.loaded) this.paint();
      const epoch = this.writeEpoch;
      try {
        const result = await this.apiGet("notifications");
        if (epoch === this.writeEpoch) {
          this.events = result.events;
          this.loaded = true;
          this.error = "";
          this.lastFetch = Date.now();
        }
      } catch (e) {
        this.error = e.message || "Não foi possível carregar as notificações.";
      } finally {
        this.loading = false;
        this.badge();
        this.paint();
      }
    }
    paint() {
      const root = document.getElementById("notification-center");
      if (!root) return;
      const all = this.rows(), view = selectNotifications(all, this.filters, this.page);
      this.page = view.page;
      const focus = root.contains(document.activeElement) ? document.activeElement : null;
      const filter2 = focus?.dataset.notificationFilter, start2 = focus?.selectionStart;
      const focusAction = focus?.dataset.notificationAction, focusKey = focus?.dataset.key, focusStatus = focus?.dataset.notificationStatus;
      const open = new Set([...root.querySelectorAll("details[open]")].map((x) => x.dataset.key));
      const options = (values, current, label2) => `<option value="">${label2}</option>` + values.map(([v, t]) => `<option value="${escapeHTML(v)}" ${v === current ? "selected" : ""}>${escapeHTML(t)}</option>`).join("");
      const sources = [...new Set(all.map((e) => e.source))].sort().map((s) => [s, notificationSource(s)]);
      const courts = [...new Set(all.map((e) => e.tribunal).filter(Boolean))].sort().map((s) => [s, s]);
      const cases = [...new Map(all.filter((e) => e.caseId).map((e) => [e.caseId, [e.caseId, e.title]])).values()];
      const controls = `<div class="notification-toolbar"><div class="notification-tabs" role="group" aria-label="Estado das notificações">${[["unseen", "Não conferidas"], ["all", "Todas"], ["seen", "Conferidas"]].map(([s, t]) => `<button type="button" data-notification-status="${s}" class="notification-tab ${this.filters.status === s ? "active" : ""}" aria-pressed="${this.filters.status === s}">${t}<span>${view.counts[s]}</span></button>`).join("")}</div><button type="button" class="button secondary" data-notification-action="refresh" ${this.loading ? "disabled" : ""}>${this.loading ? "Atualizando…" : "Atualizar lista"}</button></div>
      <form class="notification-filters" aria-label="Filtros de notificações"><label class="field notification-search">Buscar<input type="search" data-notification-filter="search" value="${escapeHTML(this.filters.search || "")}" placeholder="Processo, número CNJ ou resumo"></label>
      <label class="field">Tipo<select data-notification-filter="kind">${options([["movement", "Movimentações"], ["publication", "Publicações"]], this.filters.kind, "Todos os tipos")}</select></label>
      <label class="field">Fonte<select data-notification-filter="source">${options(sources, this.filters.source, "Todas as fontes")}</select></label>
      <div class="notification-advanced-group ${this.moreFilters ? "expanded" : ""}"><button type="button" class="button ghost notification-more-filters" data-notification-action="filters" aria-expanded="${!!this.moreFilters}" aria-controls="notification-advanced-fields">${this.moreFilters ? "Recolher filtros" : "Mais filtros"}${["court", "caseId", "from", "to"].some((k) => this.filters[k]) ? " · ativos" : ""}</button><div class="notification-advanced-fields" id="notification-advanced-fields">
      <label class="field">Tribunal<select data-notification-filter="court">${options(courts, this.filters.court, "Todos os tribunais")}</select></label>
      <label class="field notification-case-filter">Processo<select data-notification-filter="caseId">${options(cases, this.filters.caseId, "Todos os processos")}</select></label>
      <label class="field">Data do evento · de<input type="date" data-notification-filter="from" value="${escapeHTML(this.filters.from || "")}"></label>
      <label class="field">Até<input type="date" data-notification-filter="to" value="${escapeHTML(this.filters.to || "")}"></label>
      </div></div>
      <button type="button" class="button ghost" data-notification-action="clear">Limpar filtros</button></form>`;
      const status = this.error ? `<div class="notification-error" role="alert"><strong>Não foi possível atualizar a lista.</strong><p>${escapeHTML(this.error)} ${this.loaded ? "Os últimos registros carregados continuam abaixo." : "A lista pode estar incompleta até a conexão voltar."}</p><button class="button secondary small" data-notification-action="refresh">Tentar novamente</button></div>` : !this.loaded && this.isIntegrated() ? '<p class="notification-loading" role="status">Carregando notificações do monitoramento…</p>' : "";
      const records = view.rows.map((e) => {
        const url = safePublicationUrl(e.url), key = escapeHTML(e.key), type = e.kind === "publication" ? "Publicação" : "Movimentação";
        const fullText = this.details.get(e.key + "|" + (e.last_seen || e.discoveredAt));
        return `<article class="notification-record ${e.seen ? "is-seen" : "is-unseen"}" data-notification-key="${key}"><span class="notification-dot" aria-hidden="true"></span><div class="notification-record-main"><div class="notification-record-meta"><span class="notification-type">${type}</span><span>${escapeHTML(notificationSource(e.source))}</span><span class="notification-state">${e.seen ? "Conferida" : "Não conferida"}</span><time>${publicationDateBR(e.date)}</time></div><h3 class="private">${escapeHTML(e.title)}</h3><p class="notification-process private">${escapeHTML(formatCnj(e.cnj) || "CNJ não informado")}${e.tribunal ? " · " + escapeHTML(e.tribunal) : ""}</p><p class="notification-preview private">${escapeHTML(e.text || "Descrição não informada.")}</p><details data-key="${key}" ${open.has(e.key) ? "open" : ""}><summary>Ver conteúdo e origem</summary><div class="notification-detail private"><p>${escapeHTML(fullText || e.text || "Descrição não informada.")}</p>${e.remote && !fullText ? `<button class="button ghost small" data-notification-action="detail" data-key="${key}">Carregar conteúdo completo</button>` : ""}<small>Identificada em ${escapeHTML(this.stamp(e.last_seen || e.discoveredAt))}. ${e.remote ? "Monitoramento do serviço." : "Histórico da carteira."}</small></div></details><div class="notification-record-actions">${e.caseId ? `<button class="button secondary small" data-notification-action="case" data-key="${key}">Abrir processo</button>` : '<span class="muted compact">Sem processo vinculado à carteira</span>'}${url ? `<a class="button ghost small" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">Abrir na fonte</a>` : ""}<button class="button ${e.seen ? "ghost" : "primary"} small" data-notification-action="seen" data-key="${key}" ${this.busy ? "disabled" : ""}>${e.seen ? "Desmarcar conferência" : "Marcar como conferida"}</button></div></div></article>`;
      }).join("");
      const empty3 = !this.loaded && this.isIntegrated() ? "" : `<div class="notification-empty"><h3>${all.length ? "Nenhuma notificação nesta seleção" : "Suas novidades aparecerão aqui"}</h3><p>${all.length ? "Altere os filtros ou consulte Todas para rever o histórico." : "Quando uma consulta detectar uma movimentação ou publicação nova, ela será reunida nesta central. O histórico da primeira consulta forma a referência inicial."}</p>${all.length ? '<button class="button secondary" data-notification-action="clear">Ver todas as notificações</button>' : '<a class="button secondary" href="#sources">Configurar monitoramento</a>'}</div>`;
      root.innerHTML = `<section class="panel notification-panel" aria-label="Central de notificações"><div class="notification-heading"><div><h2>Atualizações dos processos</h2><p>Movimentações e publicações reunidas para sua conferência.</p></div><span class="notification-total">${view.counts.unseen} por conferir</span></div>${controls}${status}<div class="notification-results-heading"><p role="status" aria-live="polite">${view.total} ${view.total === 1 ? "notificação encontrada" : "notificações encontradas"}</p><button class="button ghost small" data-notification-action="seen-page" ${this.busy || !view.rows.some((e) => !e.seen) ? "disabled" : ""}>Conferir não lidas desta página</button></div><div class="notification-list">${records || empty3}</div>${view.total ? `<div class="notification-pagination"><p>Exibindo ${(view.page - 1) * 20 + 1}–${Math.min(view.page * 20, view.total)} de ${view.total}</p><div><button class="button ghost small" data-notification-action="prev" ${view.page <= 1 ? "disabled" : ""}>Anterior</button><span>Página ${view.page} de ${view.pages}</span><button class="button secondary small" data-notification-action="next" ${view.page >= view.pages ? "disabled" : ""}>Próxima</button></div></div>` : ""}<p class="notification-footnote">Conferência é um controle interno, sem efeito de ciência de intimação. Novidades dependem das consultas e da disponibilidade das fontes.</p></section>`;
      root.querySelector("form")?.addEventListener("submit", (e) => e.preventDefault());
      root.querySelectorAll("[data-notification-filter]").forEach((x) => x.addEventListener(x.tagName === "INPUT" && x.type === "search" ? "input" : "change", () => {
        this.filters[x.dataset.notificationFilter] = x.value;
        this.page = 1;
        this.paint();
      }));
      root.querySelectorAll("[data-notification-status]").forEach((x) => x.addEventListener("click", () => {
        this.filters.status = x.dataset.notificationStatus;
        this.page = 1;
        this.paint();
        root.querySelector(`[data-notification-status="${this.filters.status}"]`)?.focus();
      }));
      root.querySelectorAll("[data-notification-action]").forEach((x) => x.addEventListener("click", () => this.action(x).catch((e) => this.toast(e.message))));
      if (filter2) {
        const target = root.querySelector(`[data-notification-filter="${filter2}"]`);
        target?.focus();
        try {
          target?.setSelectionRange(start2, start2);
        } catch {
        }
      } else if (focusAction) {
        const same = [...root.querySelectorAll("[data-notification-action]")].find((x) => x.dataset.notificationAction === focusAction && x.dataset.key === focusKey && !x.disabled);
        (same || root.querySelector(".notification-tab.active"))?.focus({ preventScroll: true });
      } else if (focusStatus) root.querySelector(".notification-tab.active")?.focus({ preventScroll: true });
    }
    stamp(value) {
      const d = new Date(value);
      return Number.isFinite(d.valueOf()) ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(d) : "Data não informada";
    }
    async action(button2) {
      const action2 = button2.dataset.notificationAction, e = this.rows().find((e2) => e2.key === button2.dataset.key);
      if (action2 === "refresh") return this.refresh(true);
      if (action2 === "filters") {
        this.moreFilters = !this.moreFilters;
        this.paint();
        return;
      }
      if (action2 === "clear") {
        this.filters = { status: "all" };
        this.page = 1;
        this.paint();
        return;
      }
      if (action2 === "prev" || action2 === "next") {
        this.page += action2 === "next" ? 1 : -1;
        this.paint();
        document.getElementById("notification-center")?.scrollIntoView({ block: "start" });
        return;
      }
      if (action2 === "case" && e) return this.openCase(e.caseId);
      if (action2 === "detail" && e) {
        button2.disabled = true;
        button2.textContent = "Carregando…";
        try {
          const result = await this.apiPost("notifications/detail", { source: e.source, id: e.id, cnj: e.cnj });
          this.details.set(e.key + "|" + (e.last_seen || e.discoveredAt), result.event.text);
          const p2 = button2.parentElement.querySelector("p");
          if (p2) p2.textContent = result.event.text;
          button2.remove();
        } catch (err) {
          button2.disabled = false;
          button2.textContent = "Tentar carregar novamente";
          throw err;
        }
        return;
      }
      if (action2 === "seen" || action2 === "seen-page") {
        if (this.busy) return;
        const targets = action2 === "seen-page" ? selectNotifications(this.rows(), this.filters, this.page).rows.filter((e2) => !e2.seen) : e ? [e] : [];
        if (!targets.length) return;
        const seen = action2 === "seen-page" || !e.seen;
        this.busy = true;
        this.writeEpoch++;
        this.lastFetch = 0;
        button2.disabled = true;
        try {
          const remote2 = targets.filter((e2) => e2.remote);
          if (remote2.length) await this.apiPost("notifications/seen", { events: remote2.map(({ id, source, cnj }) => ({ id, source, cnj })), seen });
          const keys = new Set(targets.map((e2) => e2.key));
          if (targets.some((e2) => e2.localIds.length)) await this.markLocal(keys, seen);
          this.events = this.events.map((raw) => keys.has(notificationKey(raw)) ? { ...raw, seen: Number(seen), is_new: Number(!seen) } : raw);
          this.toast(targets.length === 1 ? seen ? "Notificação marcada como conferida." : "Conferência desmarcada." : targets.length + " notificações marcadas como conferidas.");
        } finally {
          this.busy = false;
          this.badge();
          this.paint();
        }
      }
    }
  };

  // publications.js
  function unifiedPublications(state2, serviceEvents = []) {
    const normalize = (e) => ({
      ...e,
      certificateHash: e.certificateHash || e.certificate_hash || "",
      publicationDetails: publicationDetails(e),
      publicationStatus: e.publicationStatus || e.publication_status || ""
    });
    const metadata = /* @__PURE__ */ new Map();
    for (const event of [...state2.events || [], ...serviceEvents]) {
      const key = notificationKey(event), old = metadata.get(key) || {}, current = normalize(event);
      metadata.set(key, {
        certificateHash: current.certificateHash || old.certificateHash || "",
        publicationDetails: Object.keys(current.publicationDetails).length ? current.publicationDetails : old.publicationDetails
      });
    }
    return notificationRows({ ...state2, events: (state2.events || []).map(normalize) }, serviceEvents.map(normalize)).filter((e) => e.kind === "publication").map((e) => {
      return { ...e, ...metadata.get(e.key) };
    });
  }
  var PUBLICATION_FILTERS = Object.freeze({ all: "Todas", unread: "Novas", reviewed: "Conferidas", unlinked: "Sem processo" });
  var PUBLICATION_BATCH_SIZE = 100;
  function publicationView(events, query2 = "", filter2 = "all", limit = PUBLICATION_BATCH_SIZE) {
    if (!Object.hasOwn(PUBLICATION_FILTERS, filter2)) throw Error("Filtro de publicações inválido.");
    const fold2 = (v) => String(v).normalize("NFD").replace(new RegExp("\\p{M}", "gu"), "").toLocaleLowerCase("pt-BR");
    const needle = fold2(query2).trim(), cnjQuery = String(query2).replace(/\D/g, "");
    const matches = events.filter((e) => e.kind === "publication" && (!needle || fold2(`${e.title || ""} ${e.cnj || ""} ${e.text || ""} ${e.tribunal || ""}`).includes(needle) || cnjQuery.length >= 7 && String(e.cnj || "").includes(cnjQuery)));
    const unread = (e) => !e.seen && (!e.remote || !!e.is_new || !!e.localIds?.length);
    const counts = { all: matches.length, unread: 0, reviewed: 0, unlinked: 0 };
    for (const e of matches) {
      if (e.seen) counts.reviewed++;
      else if (unread(e)) counts.unread++;
      if (!e.caseId) counts.unlinked++;
    }
    const rows = matches.filter((e) => filter2 === "all" || filter2 === "unread" && unread(e) || filter2 === "reviewed" && !!e.seen || filter2 === "unlinked" && !e.caseId).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
    const safeLimit = Number.isSafeInteger(limit) ? Math.max(1, limit) : PUBLICATION_BATCH_SIZE;
    return { counts, total: rows.length, rows: rows.slice(0, safeLimit), hasMore: rows.length > safeLimit };
  }

  // source-health.js
  var base = "999999920998199999";
  var DIAGNOSTIC_CNJ = base.slice(0, 7) + String(98n - BigInt(base + "00") % 97n).padStart(2, "0") + base.slice(7);
  var MESSAGE = {
    reachable: "A fonte respondeu com JSON no formato esperado para a consulta sintética.",
    limited: "A fonte aplicou um limite HTTP 429 nesta tentativa.",
    blocked: "O acesso foi recusado (HTTP 401/403). Verifique a fonte e a configuração.",
    unavailable: "Não foi possível validar uma resposta completa nesta tentativa. No modo arquivo local, o bloqueio de CORS (especialmente no DataJud) é uma causa provável.",
    configuration: "Não há chave pública DataJud configurada."
  };
  async function checkSourceConnectivity(settings, fetcher, clock = /* @__PURE__ */ new Date()) {
    if (!validCnj(DIAGNOSTIC_CNJ)) throw Error("CNJ sintético de diagnóstico inválido.");
    if (typeof fetcher !== "function") throw Error("Transporte das fontes indisponível.");
    const day = dateKey(clock), job = { cnj: DIAGNOSTIC_CNJ, periodStart: day, periodEnd: day, cursor: null };
    const check = async (source) => {
      if (source === "datajud" && !String(settings.datajudKey || "").trim()) return { source, status: "configuration", message: MESSAGE.configuration };
      try {
        if (source === "djen") await djen(job, settings, fetcher);
        else await datajud(job, settings, fetcher);
        return { source, status: "reachable", message: MESSAGE.reachable };
      } catch (error) {
        let status = "unavailable";
        if (error instanceof SourceError) {
          if (/cliente MCP/.test(error.message)) return { source, status: "configuration", message: error.message };
          if (/\bHTTP 429\b/.test(error.message)) status = "limited";
          else if (/HTTP 403|Autenticação recusada|HTTP 401/.test(error.message)) status = "blocked";
        }
        return { source, status, message: MESSAGE[status] };
      }
    };
    const results = await Promise.all(["djen", "datajud"].map(check));
    return { testedAt: now(), scope: "CNJ sintético; conectividade e formato apenas", results };
  }

  // zip-inflate.js
  var g = Uint8Array;
  var B = Uint16Array;
  var xr = Int32Array;
  var sr = new g([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0]);
  var fr = new g([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 0, 0]);
  var zr = new g([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
  var hr = function(r, n) {
    for (var t = new B(31), e = 0; e < 31; ++e) t[e] = n += 1 << r[e - 1];
    for (var i = new xr(t[30]), e = 1; e < 30; ++e) for (var f = t[e]; f < t[e + 1]; ++f) i[f] = f - t[e] << 5 | e;
    return { b: t, r: i };
  };
  var ur = hr(sr, 2);
  var lr = ur.b;
  var Ar = ur.r;
  lr[28] = 258, Ar[258] = 28;
  var vr = hr(fr, 0);
  var Mr = vr.b;
  var Pr = vr.r;
  var K = new B(32768);
  for (o = 0; o < 32768; ++o) M = (o & 43690) >> 1 | (o & 21845) << 1, M = (M & 52428) >> 2 | (M & 13107) << 2, M = (M & 61680) >> 4 | (M & 3855) << 4, K[o] = ((M & 65280) >> 8 | (M & 255) << 8) >> 1;
  var M;
  var o;
  var G = (function(r, n, t) {
    for (var e = r.length, i = 0, f = new B(n); i < e; ++i) r[i] && ++f[r[i] - 1];
    var u = new B(n);
    for (i = 1; i < n; ++i) u[i] = u[i - 1] + f[i - 1] << 1;
    var h;
    if (t) {
      h = new B(1 << n);
      var v = 15 - n;
      for (i = 0; i < e; ++i) if (r[i]) for (var c = i << 4 | r[i], l = n - r[i], a = u[r[i] - 1]++ << l, s = a | (1 << l) - 1; a <= s; ++a) h[K[a] >> v] = c;
    } else for (h = new B(e), i = 0; i < e; ++i) r[i] && (h[i] = K[u[r[i] - 1]++] >> 15 - r[i]);
    return h;
  });
  var O = new g(288);
  for (o = 0; o < 144; ++o) O[o] = 8;
  var o;
  for (o = 144; o < 256; ++o) O[o] = 9;
  var o;
  for (o = 256; o < 280; ++o) O[o] = 7;
  var o;
  for (o = 280; o < 288; ++o) O[o] = 8;
  var o;
  var cr = new g(32);
  for (o = 0; o < 32; ++o) cr[o] = 5;
  var o;
  var Sr = G(O, 9, 1);
  var Ur = G(cr, 5, 1);
  var Y = function(r) {
    for (var n = r[0], t = 1; t < r.length; ++t) r[t] > n && (n = r[t]);
    return n;
  };
  var m = function(r, n, t) {
    var e = n / 8 | 0;
    return (r[e] | r[e + 1] << 8) >> (n & 7) & t;
  };
  var j = function(r, n) {
    var t = n / 8 | 0;
    return (r[t] | r[t + 1] << 8 | r[t + 2] << 16) >> (n & 7);
  };
  var Fr = function(r) {
    return (r + 7) / 8 | 0;
  };
  var X = function(r, n, t) {
    return (n == null || n < 0) && (n = 0), (t == null || t > r.length) && (t = r.length), new g(r.subarray(n, t));
  };
  var Dr = ["unexpected EOF", "invalid block type", "invalid length/literal", "invalid distance", "stream finished", "no stream handler", , "no callback", "invalid UTF-8 data", "extra field too long", "date not in range 1980-2099", "filename too long", "stream finishing", "invalid zip data"];
  var p = function(r, n, t) {
    var e = new Error(n || Dr[r]);
    if (e.code = r, Error.captureStackTrace && Error.captureStackTrace(e, p), !t) throw e;
    return e;
  };
  var Tr = function(r, n, t, e) {
    var i = r.length, f = e ? e.length : 0;
    if (!i || n.f && !n.l) return t || new g(0);
    var u = !t, h = u || n.i != 2, v = n.i;
    u && (t = new g(i * 3));
    var c = function(ir) {
      var ar = t.length;
      if (ir > ar) {
        var or = new g(Math.max(ar * 2, ir));
        or.set(t), t = or;
      }
    }, l = n.f || 0, a = n.p || 0, s = n.b || 0, x = n.l, S = n.d, D = n.m, T = n.n, U = i * 8;
    do {
      if (!x) {
        l = m(r, a, 1);
        var L = m(r, a + 1, 3);
        if (a += 3, L) if (L == 1) x = Sr, S = Ur, D = 9, T = 5;
        else if (L == 2) {
          var H = m(r, a, 31) + 257, k = m(r, a + 10, 15) + 4, d = H + m(r, a + 5, 31) + 1;
          a += 14;
          for (var Z = new g(d), N = new g(19), y = 0; y < k; ++y) N[zr[y]] = m(r, a + y * 3, 7);
          a += k * 3;
          for (var b = Y(N), pr = (1 << b) - 1, gr = G(N, b, 1), y = 0; y < d; ) {
            var _ = gr[m(r, a, pr)];
            a += _ & 15;
            var z = _ >> 4;
            if (z < 16) Z[y++] = z;
            else {
              var C = 0, q = 0;
              for (z == 16 ? (q = 3 + m(r, a, 3), a += 2, C = Z[y - 1]) : z == 17 ? (q = 3 + m(r, a, 7), a += 3) : z == 18 && (q = 11 + m(r, a, 127), a += 7); q--; ) Z[y++] = C;
            }
          }
          var rr = Z.subarray(0, H), F = Z.subarray(H);
          D = Y(rr), T = Y(F), x = G(rr, D, 1), S = G(F, T, 1);
        } else p(1);
        else {
          var z = Fr(a) + 4, P = r[z - 4] | r[z - 3] << 8, $2 = z + P;
          if ($2 > i) {
            v && p(0);
            break;
          }
          h && c(s + P), t.set(r.subarray(z, $2), s), n.b = s += P, n.p = a = $2 * 8, n.f = l;
          continue;
        }
        if (a > U) {
          v && p(0);
          break;
        }
      }
      h && c(s + 131072);
      for (var yr = (1 << D) - 1, wr = (1 << T) - 1, R = a; ; R = a) {
        var C = x[j(r, a) & yr], I = C >> 4;
        if (a += C & 15, a > U) {
          v && p(0);
          break;
        }
        if (C || p(2), I < 256) t[s++] = I;
        else if (I == 256) {
          R = a, x = null;
          break;
        } else {
          var nr = I - 254;
          if (I > 264) {
            var y = I - 257, E = sr[y];
            nr = m(r, a, (1 << E) - 1) + lr[y], a += E;
          }
          var V = S[j(r, a) & wr], W = V >> 4;
          V || p(3), a += V & 15;
          var F = Mr[W];
          if (W > 3) {
            var E = fr[W];
            F += j(r, a) & (1 << E) - 1, a += E;
          }
          if (a > U) {
            v && p(0);
            break;
          }
          h && c(s + 131072);
          var tr = s + nr;
          if (s < F) {
            var er = f - F, mr = Math.min(F, tr);
            for (er + s < 0 && p(3); s < mr; ++s) t[s] = e[er + s];
          }
          for (; s < tr; ++s) t[s] = t[s - F];
        }
      }
      n.l = x, n.p = R, n.b = s, n.f = l, x && (l = 1, n.m = D, n.d = S, n.n = T);
    } while (!l);
    return s != t.length && u ? X(t, 0, s) : t.subarray(0, s);
  };
  var Cr = new g(0);
  var A = function(r, n) {
    return r[n] | r[n + 1] << 8;
  };
  var w = function(r, n) {
    return (r[n] | r[n + 1] << 8 | r[n + 2] << 16 | r[n + 3] << 24) >>> 0;
  };
  var J = function(r, n) {
    return w(r, n) + w(r, n + 4) * 4294967296;
  };
  function Ir(r, n) {
    return Tr(r, { i: 2 }, n && n.out, n && n.dictionary);
  }
  var Q = typeof TextDecoder < "u" && new TextDecoder();
  var Br = 0;
  try {
    Q.decode(Cr, { stream: true }), Br = 1;
  } catch {
  }
  var Zr = function(r) {
    for (var n = "", t = 0; ; ) {
      var e = r[t++], i = (e > 127) + (e > 223) + (e > 239);
      if (t + i > r.length) return { s: n, r: X(r, t - 1) };
      i ? i == 3 ? (e = ((e & 15) << 18 | (r[t++] & 63) << 12 | (r[t++] & 63) << 6 | r[t++] & 63) - 65536, n += String.fromCharCode(55296 | e >> 10, 56320 | e & 1023)) : i & 1 ? n += String.fromCharCode((e & 31) << 6 | r[t++] & 63) : n += String.fromCharCode((e & 15) << 12 | (r[t++] & 63) << 6 | r[t++] & 63) : n += String.fromCharCode(e);
    }
  };
  function Er(r, n) {
    if (n) {
      for (var t = "", e = 0; e < r.length; e += 16384) t += String.fromCharCode.apply(null, r.subarray(e, e + 16384));
      return t;
    } else {
      if (Q) return Q.decode(r);
      var i = Zr(r), f = i.s, t = i.r;
      return t.length && p(8), f;
    }
  }
  var Gr = function(r, n) {
    return n + 30 + A(r, n + 26) + A(r, n + 28);
  };
  var Or = function(r, n, t) {
    var e = A(r, n + 28), i = A(r, n + 30), f = Er(r.subarray(n + 46, n + 46 + e), !(A(r, n + 8) & 2048)), u = n + 46 + e, h = qr(r, u, i, t, w(r, n + 20), w(r, n + 24), w(r, n + 42)), v = h[0], c = h[1], l = h[2];
    return [A(r, n + 10), v, c, f, u + i + A(r, n + 32), l];
  };
  var qr = function(r, n, t, e, i, f, u) {
    var h = i == 4294967295, v = f == 4294967295, c = u == 4294967295, l = n + t, a = h + v + c;
    if (e && a) {
      for (; n + 4 < l; n += 4 + A(r, n + 2)) if (A(r, n) == 1) return [h ? J(r, n + 4 + 8 * v) : i, v ? J(r, n + 4) : f, c ? J(r, n + 4 + 8 * (v + h)) : u, 1];
      e < 2 && p(13);
    }
    return [i, f, u, 0];
  };
  function Lr(r, n) {
    for (var t = {}, e = r.length - 22; w(r, e) != 101010256; --e) (!e || r.length - e > 65558) && p(13);
    var i = A(r, e + 8);
    if (!i) return {};
    var f = w(r, e + 16), u = w(r, e - 20) == 117853008;
    if (u) {
      var h = w(r, e - 12);
      u = w(r, h) == 101075792, u && (i = w(r, h + 32), f = w(r, h + 48));
    }
    for (var v = n && n.filter, c = 0; c < i; ++c) {
      var l = Or(r, f, u), a = l[0], s = l[1], x = l[2], S = l[3], D = l[4], T = l[5], U = Gr(r, T);
      f = D, (!v || v({ name: S, size: s, originalSize: x, compression: a })) && (a ? a == 8 ? t[S] = Ir(r.subarray(U, U + s), { out: new g(x) }) : p(14, "unknown compression type " + a) : t[S] = X(r, U, U + s));
    }
    return t;
  }

  // spreadsheet-import.js
  var IMPORT_FIELDS = Object.freeze({
    cnj: "Número CNJ (opcional se STJ/STF com registro)",
    title: "Título/assunto",
    client: "Nome do cliente",
    plaintiff: "Autor / parte autora",
    defendant: "Réu / parte ré",
    hearingDate: "Audiência · data",
    hearingTime: "Audiência · hora",
    area: "Área",
    stage: "Etapa interna",
    review: "Data para conferir",
    notes: "Observações",
    court: "Tribunal",
    courtLevel: "Grau / instância",
    processSystem: "Sistema de tramitação",
    docketNumber: "Registro adicional",
    originReference: "Processo de origem (referência)",
    archived: "Situação do cadastro (Ativo/Arquivado)"
  });
  var MAX_IMPORT_ROWS = 2e3;
  var MAX_IMPORT_BYTES = 6 * 1024 * 1024;
  var MAX_COLUMNS = 60;
  var MAX_SHEETS = 12;
  var normalized = (value) => fold(value).replace(/[^a-z0-9]/g, "");
  var cell = (text = "", kind = "text") => ({ text: String(text ?? ""), kind });
  var empty = (x) => !x?.text?.trim();
  function parseDelimited(text, filename = "planilha.csv") {
    if (typeof text !== "string" || text.length > MAX_IMPORT_BYTES) throw Error("Arquivo de texto muito grande.");
    text = text.replace(/^\uFEFF/, "");
    let specified = "", preambleLines = 0;
    if (/^sep=[;,\t]\r?\n/i.test(text)) {
      specified = text[4];
      text = text.slice(text.indexOf("\n") + 1);
      preambleLines = 1;
    }
    const first = text.split(/\r?\n/, 1)[0];
    const countDelimiter = (delimiter2) => {
      let quoted2 = false, count = 0;
      for (let i = 0; i < first.length; i++) {
        if (first[i] === '"') {
          if (first[i + 1] === '"' && quoted2) {
            i++;
            continue;
          }
          quoted2 = !quoted2;
        } else if (first[i] === delimiter2 && !quoted2) count++;
      }
      return count;
    };
    const delimiter = specified || [";", "	", ","].sort((a, b) => countDelimiter(b) - countDelimiter(a))[0];
    if (!countDelimiter(delimiter) && !specified) throw Error("Não encontrei colunas separadas por vírgula, ponto e vírgula ou tabulação.");
    const rows = [];
    let row = [], value = "", quoted = false, physicalLine = preambleLines + 1, rowStart = physicalLine;
    function finish() {
      row.push(cell(value));
      value = "";
      if (row.some((x) => !empty(x))) {
        row.sourceLine = rowStart;
        rows.push(row);
      }
      row = [];
      rowStart = physicalLine;
      if (rows.length > MAX_IMPORT_ROWS + 1) throw Error("A planilha excede 2.000 linhas. Separe-a em arquivos menores.");
    }
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if ((ch === "\r" || ch === "\n") && !(ch === "\n" && text[i - 1] === "\r")) physicalLine++;
      if (ch === '"') {
        if (quoted && text[i + 1] === '"') {
          value += '"';
          i++;
        } else if (!quoted && value === "") quoted = true;
        else if (quoted) quoted = false;
        else value += ch;
      } else if (ch === delimiter && !quoted) {
        row.push(cell(value));
        value = "";
        if (row.length > MAX_COLUMNS) throw Error("A planilha excede 60 colunas.");
      } else if ((ch === "\r" || ch === "\n") && !quoted) {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        finish();
      } else value += ch;
    }
    if (quoted) throw Error("Arquivo CSV contém aspas sem fechamento.");
    if (row.length || value) finish();
    return makeSheet(filename, rows);
  }
  function makeSheet(name, rows, date1904 = false) {
    if (!rows.length || !rows[0]?.length) throw Error("Planilha sem cabeçalho.");
    const width = Math.max(...rows.map((r) => r.length));
    if (width > MAX_COLUMNS) throw Error("A planilha excede 60 colunas.");
    const headers = Array.from({ length: width }, (_, i) => rows[0][i]?.text?.trim() || `Coluna ${i + 1}`);
    return { name, headers, date1904, rows: rows.slice(1).filter((row) => row.some((c) => !empty(c))).map((row, i) => ({ line: row.sourceLine || i + 2, cells: row })) };
  }
  var xmlNodes = (node, name) => Array.from(node.getElementsByTagNameNS("*", name));
  var firstNode = (node, name) => xmlNodes(node, name)[0] || null;
  function xmlDocument(bytes2, name) {
    if (!bytes2) throw Error("Arquivo Excel incompleto: " + name);
    const data = new TextDecoder("utf-8", { fatal: true }).decode(bytes2);
    if (/<!DOCTYPE|<!ENTITY/i.test(data)) throw Error("XML com entidades não permitido em arquivos Excel.");
    const doc = new DOMParser().parseFromString(data, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw Error("XML do Excel inválido: " + name);
    return doc;
  }
  function indexFromColumn(label2) {
    let n = 0;
    for (const letter of label2.toUpperCase()) {
      const code = letter.charCodeAt(0) - 64;
      if (code < 1 || code > 26) throw Error("Coluna Excel inválida.");
      n = n * 26 + code;
    }
    return n - 1;
  }
  function readWorksheet(bytes2, shared, name, date1904 = false) {
    const doc = xmlDocument(bytes2, name), rows = [];
    for (const rowEl of xmlNodes(doc, "row")) {
      const values = [];
      let position = 0;
      for (const c of xmlNodes(rowEl, "c")) {
        const ref = c.getAttribute("r"), col = ref?.match(/^([A-Z]+)\d+$/i)?.[1];
        const idx = col ? indexFromColumn(col) : position;
        if (idx >= MAX_COLUMNS) throw Error("A planilha excede 60 colunas.");
        position = idx + 1;
        const t = c.getAttribute("t") || "n";
        const v = firstNode(c, "v")?.textContent || "";
        const formula = Boolean(firstNode(c, "f"));
        const displayed = t === "s" ? shared[Number(v)] ?? "" : t === "inlineStr" ? xmlNodes(firstNode(c, "is") || c, "t").map((x) => x.textContent).join("") : t === "b" ? v === "1" ? "Sim" : "Não" : v;
        values[idx] = cell(displayed, formula ? "formula" : t === "n" ? "number" : "text");
      }
      if (values.some((v) => !empty(v))) {
        values.sourceLine = Number(rowEl.getAttribute("r")) || rows.length + 1;
        rows.push(values);
        if (rows.length > MAX_IMPORT_ROWS + 1) throw Error("A planilha excede 2.000 linhas. Separe-a em arquivos menores.");
      }
    }
    return makeSheet(name, rows, date1904);
  }
  function parseXlsx(buffer) {
    if (typeof DOMParser !== "function") throw Error("A leitura XLSX precisa ser feita no navegador.");
    let total = 0, count = 0;
    const files = Lr(new Uint8Array(buffer), { filter: (f) => {
      count++;
      if (count > 400 || f.originalSize > 9 * 1024 * 1024 || (total += f.originalSize) > 22 * 1024 * 1024) throw Error("Excel muito grande ou com conteúdo excessivamente compactado.");
      if (/vbaProject\.bin|externalLinks/i.test(f.name)) throw Error("Importe um arquivo .xlsx sem macros nem vínculos externos.");
      return /^(xl\/workbook\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/sharedStrings\.xml|xl\/worksheets\/[\w.-]+\.xml)$/.test(f.name);
    } });
    const workbook = xmlDocument(files["xl/workbook.xml"], "workbook.xml");
    const date1904 = ["1", "true"].includes(firstNode(workbook, "workbookPr")?.getAttribute("date1904") || "");
    const relationships = xmlDocument(files["xl/_rels/workbook.xml.rels"], "workbook.xml.rels");
    const rels = new Map(xmlNodes(relationships, "Relationship").filter((r) => r.getAttribute("TargetMode") !== "External").map((r) => [r.getAttribute("Id"), r.getAttribute("Target")]));
    const shared = files["xl/sharedStrings.xml"] ? xmlNodes(xmlDocument(files["xl/sharedStrings.xml"], "sharedStrings.xml"), "si").map((x) => xmlNodes(x, "t").map((t) => t.textContent).join("")) : [];
    const sheets = [];
    for (const sheet of xmlNodes(workbook, "sheet").slice(0, MAX_SHEETS)) {
      const relId = sheet.getAttribute("r:id") || sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
      const target = rels.get(relId) || "";
      const plain2 = target.replace(/^\/?xl\//, "").replace(/^\//, "");
      if (plain2.includes("..") || !/^worksheets\/[\w.-]+\.xml$/.test(plain2)) continue;
      const path = "xl/" + plain2;
      if (files[path]) sheets.push(readWorksheet(files[path], shared, sheet.getAttribute("name") || `Aba ${sheets.length + 1}`, date1904));
    }
    if (!sheets.length) throw Error("Não encontrei uma aba de dados importável neste Excel.");
    return { sheets };
  }
  async function readSpreadsheet(file) {
    if (!file || !file.name) throw Error("Selecione um arquivo .xlsx, .csv ou .tsv.");
    if (file.size > MAX_IMPORT_BYTES) throw Error("O arquivo excede o limite de 6 MB.");
    const extension = file.name.split(".").at(-1).toLowerCase();
    const bytes2 = await file.arrayBuffer();
    if (extension === "xlsx") return parseXlsx(bytes2);
    if (!["csv", "tsv"].includes(extension)) throw Error("Formato não aceito. Salve a planilha como .xlsx ou CSV UTF-8.");
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes2);
    } catch {
      text = new TextDecoder("windows-1252").decode(bytes2);
    }
    return { sheets: [parseDelimited(text, file.name)] };
  }
  var names = {
    cnj: ["cnj", "numerocnj", "numeroprocesso", "numerodoprocesso", "nprocesso", "processo", "numprocesso", "processonumero"],
    title: ["titulo", "assunto", "nomeprocesso", "descricao", "caso", "acao", "acaotipo", "nomedocaso"],
    client: ["cliente", "nomecliente", "parte", "partes", "interessado", "contratante"],
    plaintiff: ["autor", "autora", "parteautora", "demandante", "requerente"],
    defendant: ["reu", "re", "parte re", "partere", "demandado", "requerido"],
    hearingDate: ["audiencia", "dataaudiencia", "datadaaudiência", "dadaaudiência", "diaaudiencia"],
    hearingTime: ["hora", "horario", "horaaudiencia", "horarioaudiencia", "horadaaudiência"],
    area: ["area", "areadodireito", "areajuridica", "materia"],
    stage: ["etapa", "status", "situacao", "statusinterno", "andamento"],
    review: ["revisao", "datarevisao", "proximaconferencia", "conferirem", "datapararevisar"],
    notes: ["observacoes", "observacao", "notas", "comentarios", "anotacoes"],
    court: ["tribunal", "tribunalorigem", "corte", "orgaojudicial"],
    courtLevel: ["grau", "instancia", "graudejurisdicao", "grauinstancia", "niveljudicial"],
    processSystem: ["sistema", "sistemajudicial", "sistemaprocessual", "sistemadetransitacao", "sistemadetramitacao"],
    docketNumber: ["registroadicional", "numeroregistro", "numerostj", "numerostf", "registrorecurso"],
    originReference: ["processodeorigem", "numeroprocessodeorigem", "cnjorigem", "processoorigem", "referenciaorigem"],
    archived: ["situacaocadastro", "arquivado", "arquivamentocadastro"]
  };
  function suggestMapping(headers) {
    const result = {};
    const taken = /* @__PURE__ */ new Set();
    for (const [field2, aliases] of Object.entries(names)) {
      let index = headers.findIndex((h, i) => !taken.has(i) && aliases.includes(normalized(h)));
      if (index === -1 && field2 === "cnj") index = headers.findIndex((h, i) => !taken.has(i) && /cnj|numerodoprocesso|numeroprocesso/.test(normalized(h)));
      result[field2] = index;
      if (index >= 0) taken.add(index);
    }
    return result;
  }
  function importDate(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";
    const br = value.match(/^(\d\d?)\/(\d\d?)\/(\d{4})$/);
    const iso = br ? `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}` : value;
    if (!validDay(iso)) throw Error("Data para revisar inválida ou numérica; use DD/MM/AAAA.");
    return iso;
  }
  function hearingDateFromCell(value, date1904 = false) {
    if (!value?.text?.trim()) return "";
    if (value.kind === "formula") return "";
    const text = value.text.trim();
    if (value.kind === "number") {
      const serial = Number(text), days = Math.floor(serial);
      if (!Number.isFinite(serial) || !Number.isInteger(serial) || days < (date1904 ? 1 : 61) || days > 73050) return "";
      const date2 = new Date(Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 30) + days * 864e5);
      const iso2 = date2.toISOString().slice(0, 10);
      return validDay(iso2) ? iso2 : "";
    }
    const br = /^(\d\d?)\/(\d\d?)\/(\d{4})$/.exec(text);
    const iso = br ? `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}` : text;
    return validDay(iso) ? iso : "";
  }
  function hearingTimeFromCell(value) {
    if (!value?.text?.trim() || value.kind === "formula") return "";
    const text = value.text.trim();
    if (value.kind === "number") {
      const fraction = Number(text);
      if (!Number.isFinite(fraction) || fraction < 0 || fraction >= 1) return "";
      const minutes = Math.round(fraction * 1440);
      if (minutes >= 1440 || Math.abs(fraction * 1440 - minutes) > 0.1) return "";
      return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    }
    const match = /^(\d{1,2})(?::([0-5]\d)|h(?:([0-5]\d))?)$/i.exec(text);
    if (!match) return "";
    const hour = Number(match[1]), minute = match[2] || match[3] || "00";
    return hour <= 23 ? `${String(hour).padStart(2, "0")}:${minute}` : "";
  }
  function hearingFromCells(dateCell, timeCell, date1904 = false) {
    const rawDate = dateCell?.text?.trim() || "", rawTime = timeCell?.text?.trim() || "";
    if (!rawDate && !rawTime) return { when: "", note: "" };
    const day = hearingDateFromCell(dateCell, date1904), time2 = hearingTimeFromCell(timeCell);
    const when = day && time2 ? `${day}T${time2}` : "";
    if (when && validDateTime(when)) return { when, note: "" };
    const details = [rawDate && `Data: ${rawDate}`, rawTime && `Hora: ${rawTime}`].filter(Boolean);
    return { when: "", note: `Audiência informada na planilha (sem agendamento automático): ${details.join(" · ")}` };
  }
  function importStage(raw) {
    const name = normalized(raw);
    if (!name) return "todo";
    const stages = { todo: "todo", afazer: "todo", pendente: "todo", doing: "doing", fazendo: "doing", emandamento: "doing", emcurso: "doing", ready: "ready", pronto: "ready", prontoparaprotocolo: "ready", done: "done", concluido: "done", finalizado: "done" };
    if (!stages[name]) throw Error("Etapa desconhecida. Mantenha a etapa original nas observações e revise a planilha.");
    return stages[name];
  }
  function mappedClassification(raw, field2, options, court = "") {
    const value = String(raw || "").trim();
    if (!value) return "";
    const key = normalized(value);
    if (field2 === "courtLevel" && key === "turmarecursal" && court === "trf2") return "federal_panel";
    if (field2 === "courtLevel" && key === "turmarecursal" && ["tjrj", "tjsp"].includes(court)) return "state_panel";
    if (field2 === "courtLevel" && key === "juizado" && ["tjrj", "tjsp"].includes(court)) return "jec";
    if (field2 === "courtLevel" && key === "juizado" && court === "trf2") return "jef";
    const aliases = {
      court: { rj: "tjrj", riodejaneiro: "tjrj", tjrj: "tjrj", trf2: "trf2", trfda2regiao: "trf2", tjsp: "tjsp", sp: "tjsp", saopaulo: "tjsp", stj: "stj", stf: "stf", outro: "other", outros: "other" },
      courtLevel: { primeirograu: "first", "1grau": "first", primeirainstancia: "first", segundograu: "second", "2grau": "second", segundainstancia: "second", jec: "jec", juizadoespecial: "jec", juizadoespecialestadual: "jec", turmarecursalestadual: "state_panel", turmarecursal: "", jef: "jef", juizadoespecialfederal: "jef", turmarecursalfederal: "federal_panel", tribunalsuperior: "superior", superior: "superior", outro: "other" },
      processSystem: { eproc: "eproc", pje: "pje", projudi: "projudi", esaj: "esaj", portal: "portal", outro: "other" }
    };
    const selected2 = aliases[field2]?.[key] ?? Object.keys(options).find((k) => normalized(k) === key || normalized(options[k]) === key);
    if (!selected2 || !Object.hasOwn(options, selected2)) throw Error("Valor de " + field2 + " não reconhecido: " + value + ". Revise a coluna ou deixe sem mapear.");
    return selected2;
  }
  var safeName = (value) => fold(value).replace(/\s+/g, " ").trim();
  function planSpreadsheetImport(state2, sheet, mapping) {
    if (!sheet || !Array.isArray(sheet.headers) || !Array.isArray(sheet.rows)) throw Error("Planilha inválida.");
    if (!Number.isInteger(mapping?.cnj) || mapping.cnj < -1 || mapping.cnj >= sheet.headers.length) throw Error("Selecione uma coluna de CNJ ou indique tribunal superior e registro adicional.");
    const mapped = Object.values(mapping).filter((i) => Number.isInteger(i) && i >= 0);
    if (new Set(mapped).size !== mapped.length || mapped.some((i) => i >= sheet.headers.length)) throw Error("Cada coluna só pode ser mapeada para um campo.");
    const existing = new Set(state2.cases.map((c) => c.cnj).filter(Boolean).map((cnj) => "cnj:" + cnj));
    for (const c of state2.cases) if (["stj", "stf"].includes(c.court) && c.docketNumber) existing.add("registro:" + c.court + ":" + normalizeDocket(c.docketNumber));
    const found = /* @__PURE__ */ new Set();
    const clients2 = /* @__PURE__ */ new Map();
    for (const c of state2.clients) {
      const name = safeName(c.name);
      clients2.set(name, [...clients2.get(name) || [], c]);
    }
    const ignored = sheet.headers.map((name, i) => ({ name, i })).filter((x) => !mapped.includes(x.i));
    const rows = sheet.rows.map((entry) => {
      const raw = (field2) => mapping[field2] >= 0 ? entry.cells[mapping[field2]] : null;
      const value = (field2) => raw(field2)?.text?.trim() || "";
      const cnjRaw = raw("cnj"), cnj = digits(value("cnj"));
      const hearing = hearingFromCells(raw("hearingDate"), raw("hearingTime"), !!sheet.date1904);
      const record = {
        cnj,
        title: value("title"),
        client: value("client"),
        plaintiff: value("plaintiff"),
        defendant: value("defendant"),
        hearingWhen: hearing.when,
        area: value("area"),
        stage: "todo",
        review: "",
        notes: value("notes"),
        court: "",
        courtLevel: "",
        processSystem: "",
        docketNumber: value("docketNumber"),
        originReference: value("originReference"),
        archived: false
      };
      let reason = "", status = "ready";
      if (cnjRaw?.kind === "formula" || cnjRaw?.kind === "number") reason = "CNJ salvo como fórmula/número pelo Excel. Formate a coluna como texto no arquivo original.";
      if (!reason) {
        try {
          if (raw("review")?.kind === "number" || raw("review")?.kind === "formula") throw Error("Data do Excel precisa ser texto DD/MM/AAAA.");
          record.review = importDate(value("review"));
          record.stage = importStage(value("stage"));
          const archived = normalized(value("archived"));
          if (!["", "ativo", "arquivado"].includes(archived)) throw Error("Situação do cadastro desconhecida; use Ativo ou Arquivado.");
          record.archived = archived === "arquivado";
          record.court = mappedClassification(value("court"), "court", COURTS);
          record.courtLevel = mappedClassification(value("courtLevel"), "courtLevel", COURT_LEVELS, record.court);
          record.processSystem = mappedClassification(value("processSystem"), "processSystem", PROCESS_SYSTEMS);
          if (record.docketNumber.length > 100 || record.originReference.length > 120) throw Error("Número adicional ou referência de origem acima do limite.");
          if (!cnj && (!["stj", "stf"].includes(record.court) || !record.docketNumber)) throw Error("Número CNJ ausente. Sem CNJ, informe tribunal STJ/STF e registro adicional.");
          if (cnj && !validCnj(cnj)) throw Error("Número CNJ inválido.");
          record.title = record.title || (cnj ? "Processo " + formatCnj(cnj) : "Recurso " + record.docketNumber);
          if (record.title.length > 240 || record.area.length > 80 || record.client.length > 180 || record.plaintiff.length > 400 || record.defendant.length > 400 || record.notes.length > 4e3) throw Error("Título, área, cliente, partes ou observações acima do limite.");
          const key = cnj ? "cnj:" + cnj : "registro:" + record.court + ":" + normalizeDocket(record.docketNumber);
          const docketKey = record.docketNumber && ["stj", "stf"].includes(record.court) ? "registro:" + record.court + ":" + normalizeDocket(record.docketNumber) : "";
          if (existing.has(key) || found.has(key) || docketKey && (existing.has(docketKey) || found.has(docketKey))) {
            status = "duplicate";
            throw Error("CNJ ou registro superior já cadastrado ou repetido no arquivo.");
          }
          if (record.court && record.courtLevel) {
            const admissible = { tjrj: ["first", "second", "jec", "state_panel", "other"], tjsp: ["first", "second", "jec", "state_panel", "other"], trf2: ["first", "second", "jef", "federal_panel", "other"], stj: ["superior", "other"], stf: ["superior", "other"] };
            if (admissible[record.court] && !admissible[record.court].includes(record.courtLevel)) throw Error("Grau incompatível com o tribunal; confira a linha.");
          }
        } catch (error) {
          reason = error.message;
        }
      }
      if (!reason && record.client && clients2.get(safeName(record.client))?.length > 1) reason = "Mais de um cliente existente com esse nome; revise a associação.";
      if (!reason) {
        const extras = ignored.map(({ name, i }) => [name, entry.cells[i]?.text?.trim() || ""]).filter(([, v]) => v);
        record.notes = [
          record.notes,
          hearing.note,
          extras.length ? "Dados não mapeados da planilha:" : "",
          ...extras.map(([key, v]) => `${key}: ${v}`)
        ].filter(Boolean).join("\n");
        if (record.notes.length > 4e3) reason = "Dados adicionais excedem o limite de observações; reduza as colunas ou divida a importação.";
      }
      if (reason) {
        status = status === "duplicate" ? "duplicate" : "invalid";
      } else {
        found.add(cnj ? "cnj:" + cnj : "registro:" + record.court + ":" + normalizeDocket(record.docketNumber));
        if (record.docketNumber && ["stj", "stf"].includes(record.court)) found.add("registro:" + record.court + ":" + normalizeDocket(record.docketNumber));
      }
      const clientMatches = record.client ? (clients2.get(safeName(record.client)) || []).map((c) => c.id) : [];
      return { line: entry.line, status, reason, record, clientMatches, rawCnj: value("cnj"), hearingNote: hearing.note };
    });
    const ready = rows.filter((r) => r.status === "ready"), duplicates = rows.filter((r) => r.status === "duplicate"), invalid = rows.filter((r) => r.status === "invalid");
    return { rows, ready, duplicates, invalid, unmapped: ignored.map((x) => x.name), total: rows.length, revision: state2.revision || 0 };
  }
  function commitSpreadsheetImport(state2, sheet, mapping, expected, options = {}) {
    const plan = planSpreadsheetImport(state2, sheet, mapping);
    if (!plan.ready.length) throw Error("Nenhum processo novo válido para importar.");
    if (JSON.stringify(plan.rows) !== JSON.stringify(expected?.rows)) throw Error("O banco ou a planilha foi alterado desde a prévia. Refaça a conferência antes de importar.");
    const countByName = /* @__PURE__ */ new Map();
    for (const { record } of plan.ready) if (record.client) {
      const key = safeName(record.client);
      countByName.set(key, (countByName.get(key) || 0) + 1);
    }
    const hasNameMatches = plan.ready.some((r) => r.clientMatches.length || r.record.client && countByName.get(safeName(r.record.client)) > 1);
    if (hasNameMatches && options.linkExistingClients !== true) throw Error("Confirme explicitamente a associação de clientes com nomes iguais antes de importar.");
    if (plan.ready.length > MAX_IMPORT_ROWS) throw Error("Limite de importação atingido.");
    try {
      validateBackup(backup(state2));
    } catch {
      throw Error("Há inconsistências nos dados locais. Execute Verificar dados e anexos antes de importar para não agravar o problema.");
    }
    const draft = structuredClone(state2);
    const lookup = new Map(draft.clients.map((c) => [safeName(c.name), c]));
    let clientsAdded = 0, appointmentsAdded = 0;
    for (const { record } of plan.ready) {
      let clientId = "";
      if (record.client) {
        const key = safeName(record.client);
        if (!lookup.has(key)) {
          const created2 = saveEntity(draft, "clients", { name: record.client });
          lookup.set(key, created2);
          clientsAdded++;
        }
        clientId = lookup.get(key).id;
      }
      const created = saveEntity(draft, "cases", {
        title: record.title,
        cnj: record.cnj,
        clientId,
        plaintiff: record.plaintiff,
        defendant: record.defendant,
        area: record.area,
        stage: record.stage,
        review: record.review,
        notes: record.notes,
        court: record.court,
        courtLevel: record.courtLevel,
        processSystem: record.processSystem,
        docketNumber: record.docketNumber,
        originReference: record.originReference,
        archived: record.archived
      });
      if (record.hearingWhen) {
        saveEntity(draft, "appointments", {
          caseId: created.id,
          title: `Audiência · ${record.title}`,
          when: record.hearingWhen,
          kind: "Audiência",
          notes: "Importada da planilha; confirmar a pauta e o horário na fonte oficial."
        });
        appointmentsAdded++;
      }
    }
    state2.clients = draft.clients;
    state2.cases = draft.cases;
    state2.events = draft.events;
    state2.appointments = draft.appointments;
    return {
      imported: plan.ready.length,
      clientsAdded,
      ignored: plan.invalid.length + plan.duplicates.length,
      ...appointmentsAdded ? { appointmentsAdded } : {}
    };
  }

  // portfolio-csv.js
  var PORTFOLIO_HEADERS = Object.freeze([
    "CNJ",
    "Assunto",
    "Cliente",
    "Área",
    "Etapa",
    "Data Revisão",
    "Observações",
    "Tribunal",
    "Grau",
    "Sistema",
    "Registro adicional",
    "Processo de origem",
    "Situação cadastro",
    "Autor",
    "Réu"
  ]);
  function cell2(value) {
    let text = String(value ?? "");
    if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text) || /^\d{15,}$/u.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }
  function csv(rows) {
    return "\uFEFFsep=;\r\n" + rows.map((row) => row.map(cell2).join(";")).join("\r\n") + "\r\n";
  }
  function portfolioTemplateCsv() {
    return csv([PORTFOLIO_HEADERS]);
  }
  function exportPortfolioCsv(state2) {
    if (!Array.isArray(state2?.cases) || !Array.isArray(state2?.clients)) throw Error("Dados da carteira inválidos.");
    const clients2 = new Map(state2.clients.map((c) => [c.id, c.name]));
    const cases = new Map(state2.cases.map((c) => [c.id, c]));
    const rows = state2.cases.map((c) => {
      const origin = cases.get(c.parentCaseId);
      const originNumber = origin ? origin.cnj ? formatCnj(origin.cnj) : origin.docketNumber || "" : "";
      return [
        c.cnj ? formatCnj(c.cnj) : "",
        c.title,
        clients2.get(c.clientId) || "",
        c.area || "",
        STAGES[c.stage] || "",
        c.review || "",
        c.notes || "",
        COURTS[c.court] && c.court ? COURTS[c.court] : "",
        COURT_LEVELS[c.courtLevel] && c.courtLevel ? COURT_LEVELS[c.courtLevel] : "",
        PROCESS_SYSTEMS[c.processSystem] && c.processSystem ? PROCESS_SYSTEMS[c.processSystem] : "",
        c.docketNumber || "",
        c.originReference || originNumber,
        c.archived ? "Arquivado" : "Ativo",
        c.plaintiff || "",
        c.defendant || ""
      ];
    });
    return csv([PORTFOLIO_HEADERS, ...rows]);
  }
  function exportImportReportCsv(plan) {
    if (!Array.isArray(plan?.rows)) throw Error("Prévia da importação indisponível.");
    const headers = ["Linha original", "Situação da prévia", "Motivo", "CNJ original", "CNJ interpretado", "Registro adicional", "Assunto", "Cliente", "Tribunal", "Grau", "Sistema", "Arquivado", "Autor", "Réu", "Audiência na agenda", "Aviso da audiência"];
    const status = { ready: "Pronto", duplicate: "Duplicado", invalid: "Revisar" };
    return csv([headers, ...plan.rows.map((item) => [
      item.line,
      status[item.status] || "Revisar",
      item.reason || "",
      item.rawCnj || "",
      item.record.cnj ? formatCnj(item.record.cnj) : "",
      item.record.docketNumber || "",
      item.record.title || "",
      item.record.client || "",
      COURTS[item.record.court] || "",
      COURT_LEVELS[item.record.courtLevel] || "",
      PROCESS_SYSTEMS[item.record.processSystem] || "",
      item.record.archived ? "Arquivado" : "Ativo",
      item.record.plaintiff || "",
      item.record.defendant || "",
      item.record.hearingWhen || "",
      item.hearingNote || ""
    ])]);
  }

  // integrated.js
  var integrated = isIntegratedRuntime();
  var CONTRACT = 1;
  var csrf2 = "";
  var lastRevision = -1;
  var serviceOnline = false;
  var serviceDashboard = { jobs: [], counts: {}, unseen: 0, recentUnseen: [] };
  var serviceSettings = null;
  var serviceConnectors = [];
  var serviceError = "Inicie o serviço com ABRIR-PAINEL-INTEGRADO.cmd.";
  var serviceSyncWarning = "";
  async function retryAfterSessionRenewal(request) {
    const first = await request();
    if (first.status !== 403) return first;
    try {
      const renewed = await fetch("/api/v1/session", { cache: "no-store", credentials: "same-origin" });
      if (!renewed.ok) return first;
      const session = await renewed.json();
      if (!session.csrf) return first;
      csrf2 = session.csrf;
      return await request();
    } catch {
      return first;
    }
  }
  async function apiFetch(path, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const request = () => {
      const headers = { ...options.headers || {} };
      if (csrf2) headers["X-Pauta-CSRF"] = csrf2;
      return fetch(path, {
        ...options,
        cache: options.cache ?? "no-store",
        credentials: "same-origin",
        headers
      });
    };
    if (method === "GET" || method === "HEAD") return retryAfterSessionRenewal(request);
    return request();
  }
  async function apiGet(route2) {
    if (!integrated) throw Error("Serviço não conectado. Abra o Painel H.B pelo iniciador integrado.");
    const response = await apiFetch("/api/v1/" + route2);
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Serviço indisponível.");
    if (data.contractVersion !== void 0 && data.contractVersion !== CONTRACT)
      throw Error("Versões incompatíveis: atualize o HTML e o serviço juntos.");
    return data;
  }
  async function apiPost(route2, payload = {}) {
    if (!csrf2) throw Error("Sessão local indisponível. Recarregue o painel integrado.");
    const response = await fetch("/api/v1/" + route2, {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Pauta-CSRF": csrf2 },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Operação não concluída.");
    return data;
  }
  async function updateExtraConnectors(enabled) {
    const response = await apiPost("settings", { enabled });
    serviceSettings = response.settings;
    return response.settings;
  }
  var fields = (s) => ({
    enabled: { datajud: !!s.datajud, djen: !!s.djen },
    autoEnabled: !!s.autoUpdateEnabled,
    autoTimes: String(s.autoUpdateTimes || "08:00,18:00").split(",").map((x) => x.trim()).filter(Boolean),
    djenDays: s.djenDays,
    datajudKey: s.datajudKey || "",
    oab: s.oab || "",
    ufOab: s.ufOab || ""
  });
  async function syncBrowser(state2, force = false, allowEmpty = false) {
    if (!integrated || !serviceOnline) return;
    if (hasRemoteWorkspace()) {
      serviceSyncWarning = "";
      return;
    }
    if (!force && lastRevision === state2.revision) return;
    const cases = state2.cases.map(({ id, cnj, archived, court, courtLevel, processSystem }) => ({ id, cnj, archived, court, courtLevel, processSystem }));
    const synced = await apiPost("cases/sync", { cases, ...allowEmpty ? { allowEmpty: true } : {} });
    if (synced.skipped) {
      serviceSyncWarning = synced.warning || "Restaure um backup antes de sincronizar a carteira.";
      lastRevision = state2.revision;
      return;
    }
    serviceSyncWarning = "";
    const saved = await apiPost("settings", fields(state2.settings));
    serviceSettings = saved.settings;
    lastRevision = state2.revision;
  }
  async function connect(state2) {
    if (!integrated) return false;
    try {
      const session = await apiGet("session");
      if (session.contractVersion !== CONTRACT)
        throw Error("Contrato API incompatível. Atualize o HTML e o serviço juntos.");
      if (session.appVersion !== VERSION)
        throw Error(`Interface v${VERSION} e serviço v${session.appVersion}. Reabra ABRIR-PAINEL-INTEGRADO.cmd para atualizar o serviço e recarregue esta página com Ctrl+F5.`);
      csrf2 = session.csrf;
      serviceOnline = true;
      await syncBrowser(state2, true);
      const [status, connectors, dashboard] = await Promise.all([
        apiGet("status"),
        apiGet("connectors"),
        apiGet("dashboard")
      ]);
      serviceSettings = status.settings;
      serviceConnectors = connectors.sources;
      serviceDashboard = dashboard;
      serviceError = "";
      return true;
    } catch (error) {
      serviceOnline = false;
      serviceError = error.message || "Serviço indisponível.";
      return false;
    }
  }
  async function pollService() {
    if (!serviceOnline) return;
    try {
      serviceDashboard = await apiGet("dashboard");
      serviceError = "";
    } catch (error) {
      serviceOnline = false;
      serviceError = error.message || "Serviço indisponível.";
    }
  }
  async function serverCommand(type, extra = {}, browserState) {
    if (!integrated || !serviceOnline) throw Error("Consultas indisponíveis: inicie o serviço Python pelo modo integrado.");
    await syncBrowser(browserState);
    if (type === "ping") return apiGet("status");
    if (type === "update") return apiPost("jobs", { ids: extra.ids || [], ...extra.sources ? { sources: extra.sources } : {} });
    if (type === "oab") return apiPost("jobs", { oab: true });
    if (type === "retry-source" || type === "retry-oab")
      return apiPost("jobs/retry", { jobId: extra.jobId });
    if (type === "cancel") return apiPost("jobs/cancel");
    if (type === "resume") return {};
    throw Error("Comando não suportado pelo serviço.");
  }
  async function exportMonitoring() {
    if (!serviceOnline) throw Error("Serviço desligado: não é possível fazer um backup completo do histórico integrado.");
    return apiGet("backup");
  }
  async function restoreMonitoring(monitoring) {
    if (!monitoring) return;
    if (!serviceOnline) throw Error("Abra o modo integrado antes de restaurar dados de monitoramento.");
    await apiPost("restore", { monitoring });
    lastRevision = -1;
  }

  // integrated-case-view.js
  var ZONE2 = "America/Sao_Paulo";
  var dateWithZone = new Intl.DateTimeFormat("pt-BR", {
    timeZone: ZONE2,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  function caseMoment(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    const raw = value.trim();
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    const withoutZone = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(raw);
    if (dateOnly || withoutZone) {
      const parts = dateOnly || withoutZone;
      const year = Number(parts[1]), month = Number(parts[2]), day = Number(parts[3]);
      const valid = new Date(Date.UTC(year, month - 1, day));
      if (year < 1e3 || valid.getUTCFullYear() !== year || valid.getUTCMonth() !== month - 1 || valid.getUTCDate() !== day) return null;
      if (dateOnly) return { text: `${parts[3]}/${parts[2]}/${parts[1]}`, datetime: raw, kind: "date" };
      const hour = Number(parts[4]), minute = Number(parts[5]), second = Number(parts[6] || 0);
      if (hour > 23 || minute > 59 || second > 59) return null;
      return {
        text: `${parts[3]}/${parts[2]}/${parts[1]} às ${parts[4]}:${parts[5]}`,
        datetime: raw,
        kind: "no-zone"
      };
    }
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/i.test(raw)) return null;
    const calendar = raw.slice(0, 10).split("-").map(Number);
    const check = new Date(Date.UTC(calendar[0], calendar[1] - 1, calendar[2]));
    if (calendar[0] < 1e3 || check.getUTCFullYear() !== calendar[0] || check.getUTCMonth() !== calendar[1] - 1 || check.getUTCDate() !== calendar[2]) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.valueOf())) return null;
    const fields2 = Object.fromEntries(dateWithZone.formatToParts(parsed).map(({ type, value: value2 }) => [type, value2]));
    return {
      text: `${fields2.day}/${fields2.month}/${fields2.year} às ${fields2.hour}:${fields2.minute}`,
      datetime: raw,
      kind: "converted"
    };
  }
  function label(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) value = value.nome || value.descricao || value.name || "";
    if (typeof value !== "string") return "";
    const text = value.replace(/\s+/gu, " ").trim();
    return /^c[oó]digo\s*\d+$/iu.test(text) || /^\d+$/u.test(text) || /^\[object\s+object\]$/iu.test(text) || /^[{[]/u.test(text) ? "" : text.slice(0, 240);
  }
  function courtDegree(value) {
    const normalized2 = label(value).toUpperCase().replace(/\s+/gu, " ");
    if (["G1", "1", "1º GRAU", "1° GRAU", "1ª INSTÂNCIA", "PRIMEIRO GRAU"].includes(normalized2)) return "1º grau";
    if (["G2", "2", "2º GRAU", "2° GRAU", "2ª INSTÂNCIA", "SEGUNDO GRAU"].includes(normalized2)) return "2º grau";
    if (["SUP", "SUPERIOR", "TRIBUNAL SUPERIOR"].includes(normalized2)) return "Tribunal superior";
    return "Grau não identificado";
  }
  var sourceLabel = (value) => ({
    datajud: "DataJud",
    djen: "DJEN",
    esaj_pg: "TJSP e-SAJ · 1º grau",
    esaj_sg: "TJSP e-SAJ · 2º grau"
  })[value] || label(value) || "Fonte não identificada";
  function tramitationGroups(records) {
    const order = ["1º grau", "2º grau", "Tribunal superior", "Grau não identificado"];
    const groups = /* @__PURE__ */ new Map();
    for (const item of records) {
      const degree = courtDegree(item.grau);
      if (!groups.has(degree)) groups.set(degree, []);
      groups.get(degree).push(item);
    }
    return order.filter((x) => groups.has(x)).map((name) => ({ name, records: groups.get(name) }));
  }
  function probableCrossDegreeDuplicates(events, tramitations) {
    const tracks = new Map(tramitations.map((x) => [String(x.id || ""), { source: x.source, degree: courtDegree(x.grau) }]));
    const groups = /* @__PURE__ */ new Map(), possible = /* @__PURE__ */ new Set();
    for (const event of events) {
      const track = tracks.get(String(event.tramitation_id || ""));
      const description = typeof event.text === "string" ? event.text.replace(/\s+/gu, " ").trim().toLocaleLowerCase("pt-BR") : "";
      if (!track || track.degree === "Grau não identificado" || track.source !== event.source || !event.occurred_at || !description) continue;
      const key = JSON.stringify([event.source, String(event.occurred_at).trim(), description]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ event, degree: track.degree });
    }
    for (const items of groups.values()) {
      if (new Set(items.map((x) => x.degree)).size > 1)
        for (const item of items) possible.add(String(item.event.source) + "\0" + String(item.event.id));
    }
    return possible;
  }
  var plural = (count, one, many) => `${count.toLocaleString("pt-BR")} ${count === 1 ? one : many}`;
  function latestMoment(values, oldest = false) {
    const valid = values.filter((x) => caseMoment(x));
    if (!valid.length) return "";
    const key = (value) => {
      const moment2 = caseMoment(value);
      if (moment2.kind === "converted") return Date.parse(value);
      return Date.parse(value.replace(" ", "T") + (moment2.kind === "date" ? "T00:00:00" : "") + "Z");
    };
    valid.sort((a, b) => key(a) - key(b));
    return oldest ? valid[0] : valid[valid.length - 1];
  }
  function readableTime(value) {
    const moment2 = caseMoment(value);
    if (!moment2) return "";
    const title = moment2.kind === "converted" ? "Exibido no horário de Brasília (America/Sao_Paulo)" : moment2.kind === "no-zone" ? "A fonte não forneceu fuso; hora exibida sem conversão" : "Data sem horário informado pela fonte";
    return `<time datetime="${escapeHTML(moment2.datetime)}" title="${escapeHTML(title)}">${escapeHTML(moment2.text)}</time>`;
  }
  function tramitationHTML(item) {
    const tribunal = label(item.tribunal), system = label(item.sistema), organ = label(item.orgao);
    const klass = label(item.classe);
    const summary = [
      tribunal && `<span><strong>Tribunal:</strong> ${escapeHTML(tribunal)}</span>`,
      system && `<span><strong>Sistema:</strong> ${escapeHTML(system)}</span>`,
      organ && `<span><strong>Órgão julgador:</strong> ${escapeHTML(organ)}</span>`,
      klass && `<span><strong>Classe:</strong> ${escapeHTML(klass)}</span>`,
      Array.isArray(item.assuntos) && item.assuntos.map(label).filter(Boolean).length ? `<span><strong>Assuntos:</strong> ${escapeHTML(item.assuntos.map(label).filter(Boolean).join(" · "))}</span>` : "",
      caseMoment(item.dataAjuizamento) ? `<span><strong>Ajuizamento:</strong> ${readableTime(item.dataAjuizamento)}</span>` : ""
    ].filter(Boolean);
    return `<article class="integrated-tramitation"><div class="integrated-tramitation-head"><span class="integrated-source">${escapeHTML(sourceLabel(item.source))}</span></div>` + (summary.length ? `<div class="integrated-track-meta">${summary.join("")}</div>` : '<p class="muted compact">Esta tramitação não trouxe dados adicionais de identificação.</p>') + "</article>";
  }
  function eventHTML(item, caseId, trackById, duplicates) {
    const when = readableTime(item.occurred_at);
    const track = trackById.get(String(item.tramitation_id || ""));
    const degree = track ? courtDegree(track.grau) : "";
    const isPending = !!item.is_new && !item.seen;
    const duplicate = duplicates.has(String(item.source) + "\0" + String(item.id));
    const text = typeof item.text === "string" && item.text.trim() ? item.text.trim() : "Descrição não informada pela fonte.";
    const snippet = text.replace(/\s+/gu, " ").slice(0, 145);
    return `<article class="integrated-event${isPending ? " integrated-event-pending" : ""}" data-event-source="${escapeHTML(item.source)}" data-event-id="${escapeHTML(item.id)}"><details class="integrated-event-disclosure"><summary class="integrated-event-summary"><span class="integrated-event-date">${when || "Data do evento não informada"}</span><span class="integrated-event-tags"><span class="integrated-source">${escapeHTML(sourceLabel(item.source))}</span>` + (track && degree !== "Grau não identificado" ? `<span class="integrated-degree">${escapeHTML(degree)}</span>` : "") + (item.kind === "publication" ? '<span class="integrated-degree">Publicação</span>' : "") + "</span>" + (isPending ? '<span class="integrated-pending-tag">Por conferir</span>' : "") + `<span class="integrated-event-snippet private">${escapeHTML(snippet)}</span><span class="integrated-event-caret" aria-hidden="true">⌄</span></summary><div class="integrated-event-extra"><p class="integrated-event-text private">${escapeHTML(text)}</p>` + (item.source === "djen" ? publicationDetailsHTML(item) + '<div class="publication-actions">' + (safePublicationUrl(item.url) ? `<a class="button ghost small" href="${escapeHTML(safePublicationUrl(item.url))}" target="_blank" rel="noopener noreferrer">Abrir publicação na fonte</a>` : "") + (djenCertificateUrl(item.certificate_hash) ? `<a class="button secondary small" href="${escapeHTML(djenCertificateUrl(item.certificate_hash))}" target="_blank" rel="noopener noreferrer">Abrir certidão oficial</a>` : "") + "</div>" : "") + (duplicate ? '<p class="integrated-possible-duplicate" title="A mesma data e descrição aparecem em tramitações de graus diferentes; são registros distintos e foram preservados.">Possível repetição em outro grau · confira ambos os registros</p>' : "") + (isPending ? `<button type="button" class="button secondary small" data-integrated="seen" data-id="${escapeHTML(item.id)}" data-case-id="${escapeHTML(caseId)}" data-source="${escapeHTML(item.source)}">Marcar como conferido (controle interno)</button>` : "") + "</div></details></article>";
  }
  var CASE_HISTORY_PAGE_SIZE = 12;
  function historyPage(records, requestedPage = 1, pageSize = CASE_HISTORY_PAGE_SIZE) {
    const count = records.length;
    const pages = Math.max(1, Math.ceil(count / pageSize));
    const page = Math.min(pages, Math.max(1, Math.trunc(Number(requestedPage) || 1)));
    const start2 = (page - 1) * pageSize;
    return { page, pages, start: start2, end: Math.min(start2 + pageSize, count), count, items: records.slice(start2, start2 + pageSize) };
  }
  function technicalHTML(info, items, track) {
    const first = latestMoment(items.map((x) => x.first_seen), true);
    const last = latestMoment(items.map((x) => x.last_seen));
    const sourceUpdated = latestMoment([...items.map((x) => x.source_updated_at), ...track.map((x) => x.ultimaAtualizacaoFonte)]);
    const values = [
      ["Primeira identificação no histórico exibido", first, "Primeira vez que o serviço registrou um dos eventos exibidos; não é a data do movimento."],
      ["Última identificação no histórico exibido", last, "Última vez que um evento exibido foi novamente identificado na fonte."],
      ["Última consulta tentada", info.lastAttempt?.attempted_at, "Quando o serviço local tentou consultar a fonte, mesmo que tenha falhado."],
      ["Última consulta com resposta", info.lastSuccess?.attempted_at, "Quando a fonte retornou um resultado, inclusive parcial ou sem registros."],
      ["Atualização informada pela fonte", sourceUpdated, "Atualização mais recente entre as fontes consultadas; não representa a data do movimento."]
    ];
    const perSource = /* @__PURE__ */ new Map();
    for (const item of [
      ...items.map((x) => ({ source: x.source, when: x.source_updated_at })),
      ...track.map((x) => ({ source: x.source, when: x.ultimaAtualizacaoFonte }))
    ]) {
      if (!caseMoment(item.when)) continue;
      const values2 = perSource.get(item.source) || [];
      values2.push(item.when);
      perSource.set(item.source, values2);
    }
    if (perSource.size > 1) {
      for (const [key, timestamps] of perSource)
        values.push([
          "Atualização · " + sourceLabel(key),
          latestMoment(timestamps),
          "Último carimbo de atualização disponível para esta fonte."
        ]);
    }
    const lines = values.filter(([, value]) => caseMoment(value));
    const corrections = items.reduce((n, x) => n + (Number(x.correction_count) || 0), 0);
    return `<details class="integrated-technical"><summary>Informações técnicas das consultas <span class="integrated-expand">Mostrar detalhes</span></summary>` + (lines.length ? `<dl class="integrated-technical-grid">${lines.map(([name, value, description]) => `<div><dt>${escapeHTML(name)}</dt><dd>${readableTime(value)}</dd><p>${escapeHTML(description)}</p></div>`).join("")}</dl>` : '<p class="muted compact">Ainda não há datas técnicas disponíveis nesta consulta.</p>') + (corrections ? `<p class="muted compact">Correções de conteúdo registradas: ${plural(corrections, "correção", "correções")}.</p>` : "") + (info.previousNumberEvents ? '<p class="muted compact">Há registros preservados para CNJ anterior, não exibidos neste processo.</p>' : "") + '<p class="muted compact">Identificação e consulta são registros internos do Painel H.B; não representam a ocorrência ou publicação judicial.</p></details>';
  }
  function sourceStatusHTML(info, caseId) {
    const jobs = Array.isArray(info.sourceJobs) ? info.sourceJobs : [];
    const states = {
      queued: "Na fila",
      running: "Consultando",
      success: "Consulta concluída",
      partial: "Resultado parcial",
      not_found: "Sem registros na consulta",
      unavailable: "Fonte indisponível",
      auth_required: "Autenticação necessária",
      access_denied: "Acesso negado",
      unsupported: "Não disponível",
      incompatible: "Resposta incompatível",
      cancelled: "Consulta cancelada"
    };
    return jobs.map((job) => `<article class="record" ${job.status === "running" ? 'data-loading="true" data-loading-fixed aria-busy="true"' : ""}><strong>${escapeHTML(sourceLabel(job.source))} · ${escapeHTML(states[job.status] || "Situação não identificada")}</strong><p class="compact">${escapeHTML(job.source === "djen" && job.status === "not_found" ? "Nenhuma publicação encontrada no período consultado. Isso não significa que o processo não existe." : job.message || "Consulta aguardando resultado.")}</p>` + (job.updated_at ? `<small>${readableTime(job.updated_at)}</small>` : "") + "</article>").join("");
  }
  function integratedCaseHTML(info, caseId, pageState = {}) {
    const items = Array.isArray(info?.events) ? info.events : [];
    const track = Array.isArray(info?.tramitations) ? info.tramitations.filter((x) => x.source === "datajud") : [];
    const pending = items.filter((x) => !!x.is_new && !x.seen);
    const previous = items.filter((x) => !x.is_new || !!x.seen);
    const movements = items.filter((x) => x.kind !== "publication").length;
    const publications2 = items.filter((x) => x.kind === "publication").length;
    const historyDescription = items.length >= 2e3 ? "no histórico exibido" : "no histórico";
    const count = items.length ? movements && publications2 ? `${plural(movements, "movimento", "movimentos")} · ${plural(publications2, "publicação", "publicações")} ${historyDescription}` : movements ? `${plural(movements, "movimento", "movimentos")} ${historyDescription}` : `${plural(publications2, "publicação", "publicações")} ${historyDescription}` : "Nenhum evento no histórico";
    const trackById = new Map(track.map((x) => [String(x.id || ""), x]));
    const duplicates = probableCrossDegreeDuplicates(items, track);
    const groupHTML = tramitationGroups(track).map(({ name, records }) => `<section class="integrated-degree-group" aria-label="Tramitações do ${escapeHTML(name)}"><header class="integrated-degree-heading"><h5>${escapeHTML(name)}</h5><span>${plural(records.length, "registro", "registros")}</span></header><div class="integrated-tramitation-list">${records.map(tramitationHTML).join("")}</div></section>`).join("");
    const eventList = (events, source, kind) => {
      const key = `${source}-${kind}`;
      const slice = historyPage(events, pageState[key]);
      const controls = slice.pages > 1 ? `<nav class="case-history-pagination" aria-label="Páginas de ${escapeHTML(sourceLabel(source))} · ${kind === "news" ? "novidades" : "histórico"}"><span>Mostrando ${slice.start + 1}–${slice.end} de ${slice.count} · Página ${slice.page} de ${slice.pages}</span><div><button type="button" class="button ghost small" data-integrated="events-page" data-key="${escapeHTML(key)}" data-page="${slice.page - 1}" ${slice.page === 1 ? "disabled" : ""} aria-label="Página anterior">Anterior</button><button type="button" class="button ghost small" data-integrated="events-page" data-key="${escapeHTML(key)}" data-page="${slice.page + 1}" ${slice.page === slice.pages ? "disabled" : ""} aria-label="Próxima página">Próxima</button></div></nav>` : "";
      return `<div class="integrated-event-list">${slice.items.map((item) => eventHTML(item, caseId, trackById, duplicates)).join("")}</div>${controls}`;
    };
    const block = (source, title, description) => {
      const selected2 = items.filter((x) => x.source === source);
      const news = selected2.filter((x) => !!x.is_new && !x.seen), history = selected2.filter((x) => !x.is_new || !!x.seen);
      const disabled = info.enabledSources?.[source] === false;
      const action2 = source === "datajud" ? "Buscar andamentos no DataJud" : "Buscar publicações no DJEN";
      return `<section class="integrated-block" aria-label="${title}"><h4>${title}</h4><p class="muted compact">${description}</p><button type="button" class="button secondary small" data-integrated="update-${source}" data-id="${escapeHTML(caseId)}" ${disabled ? "disabled" : ""}>${action2}</button>` + (disabled ? `<p class="warning-note">Habilite ${sourceLabel(source)} em Fontes e ajustes para consultar.</p>` : "") + (source === "djen" ? `<p class="muted compact">Período da busca DJEN: últimos ${Number(info.djenDays) || 30} dias.</p>` : "") + sourceStatusHTML({ ...info, sourceJobs: (info.sourceJobs || []).filter((x) => x.source === source) }, caseId) + `<div aria-label="Novidades por conferir"><h5>Por conferir · ${news.length}</h5>` + (news.length ? eventList(news, source, "news") : '<p class="integrated-empty">Nenhuma novidade pendente de conferência.</p>') + `</div><div aria-label="Histórico de eventos"><h5>Histórico · ${history.length}</h5>` + (history.length ? eventList(history, source, "history") : '<p class="integrated-empty">Não há outros registros no histórico desta consulta.</p>') + "</div>" + (source === "datajud" ? `<section aria-label="Tramitações agrupadas por grau"><h5>Metadados e tramitações por grau</h5>${track.length ? groupHTML : '<p class="integrated-empty">Nenhuma tramitação estruturada disponível nesta fonte.</p>'}</section>` : "") + "</section>";
    };
    const other = items.filter((x) => !["datajud", "djen"].includes(x.source));
    return `<div class="integrated-overview"><h3>Acompanhamento integrado</h3><p class="integrated-count" aria-live="polite"><strong>${escapeHTML(count)}</strong> · <strong>${plural(pending.length, "por conferir", "por conferir")}</strong></p><p class="muted compact">Novidade significa identificada após a linha de base ou consulta anterior — não necessariamente um movimento ocorrido recentemente.</p><p class="integrated-timezone">Datas e horas com fuso são exibidas no horário de Brasília. Sem fuso informado, o horário é mantido.</p>` + (items.length >= 2e3 ? '<p class="muted compact">Exibindo os 2.000 registros mais recentes retornados pelo serviço.</p>' : "") + "</div>" + block("datajud", "Andamentos · DataJud", "Movimentações enviadas pelo tribunal e metadados estruturados do processo. A consulta não fornece o teor das decisões.") + block("djen", "Publicações · DJEN", "Textos publicados, destinatários, advogados e certidões. Publicações não representam todos os andamentos dos autos.") + (other.length ? '<section class="integrated-block"><h4>Outras fontes</h4>' + eventList(other, "other", "history") + "</section>" : "") + technicalHTML(info, items, track) + '<p class="muted compact">Documentos dos autos: use os links oficiais quando disponíveis. Uma certidão DJEN não equivale ao PDF original da decisão.</p>';
  }

  // djen-name-search.js
  function djenNameSearchHTML() {
    return '<h2>Buscar publicações por nome</h2><form id="djen-name-search-form" class="form-grid"><label class="field">Buscar por<select name="criterion"><option value="nomeParte">Nome da parte</option><option value="nomeAdvogado">Nome do advogado</option></select></label><label class="field">Nome completo<input name="name" required minlength="3" maxlength="200" autocomplete="off" placeholder="Digite o nome da parte ou do advogado"></label><label class="field">Período<select name="days"><option value="7">Últimos 7 dias</option><option value="30" selected>Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="365">Últimos 365 dias</option></select></label><div class="form-actions"><button type="submit" class="button primary">Buscar no DJEN</button></div></form><p class="muted compact">Busca nas publicações do DJEN, não em todos os processos da pessoa. Confira os destinatários para distinguir homônimos. Os resultados são uma consulta avulsa e não cadastram processos automaticamente.</p><p data-djen-search-status role="status" aria-live="polite"></p><div data-djen-search-results></div>';
  }
  function djenNameResultsHTML(data = {}) {
    const events = Array.isArray(data.events) ? data.events : [];
    const rows = events.map((e) => {
      const url = safePublicationUrl(e.url), cert = djenCertificateUrl(e.certificateHash);
      return `<article class="record"><strong>${escapeHTML(e.cnj)} · ${publicationDateBR(e.occurredAt)}</strong>` + publicationDetailsHTML(e) + `<details class="service-publication-body"><summary>Ler teor da publicação</summary><p class="private">${escapeHTML(e.text)}</p></details><div class="publication-actions">` + (url ? `<a class="button ghost small" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">Abrir publicação na fonte</a>` : "") + (cert ? `<a class="button ghost small" href="${escapeHTML(cert)}" target="_blank" rel="noopener noreferrer">Abrir certidão oficial</a>` : "") + (e.caseId ? `<button type="button" class="button secondary small" data-integrated="detail" data-id="${escapeHTML(e.caseId)}">Abrir processo cadastrado</button>` : '<span class="muted compact">CNJ sem vínculo no histórico do serviço</span>') + "</div></article>";
    }).join("");
    return rows + (data.status === "partial" ? '<p class="warning-note">Resposta parcial. A busca não foi concluída; confira a fonte ou reduza o período.</p>' : "") + (data.limitReached ? '<p class="warning-note">Limite de 10.000 resultados atingido. Reduza o período.</p>' : "") + `<div class="service-jobs-pager"><button type="button" class="button ghost small" data-djen-search-page="${Number(data.page) - 1}" ${Number(data.page) <= 1 ? "disabled" : ""}>Anterior</button><span>Página ${Number(data.page) || 1}</span><button type="button" class="button secondary small" data-djen-search-page="${Number(data.page) + 1}" ${!data.hasNext ? "disabled" : ""}>Próxima</button></div>`;
  }
  async function searchDjenName(panel2, apiPost2, page = 1, filters = null) {
    const form = panel2.querySelector("form"), status = panel2.querySelector("[data-djen-search-status]"), results = panel2.querySelector("[data-djen-search-results]");
    const fields2 = filters || { criterion: form.elements.criterion.value, name: form.elements.name.value.trim(), days: Number(form.elements.days.value) };
    if (!fields2.name || fields2.name.length < 3) {
      status.textContent = "Informe pelo menos 3 caracteres do nome.";
      return;
    }
    const token = {};
    panel2._searchToken = token;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    results.innerHTML = "";
    status.textContent = "Consultando publicações no DJEN…";
    try {
      const data = await apiPost2("djen/search", { ...fields2, page });
      if (!panel2.isConnected || panel2._searchToken !== token) return;
      if (!Array.isArray(data.events) || !Number.isInteger(data.total) || !Number.isInteger(data.page)) throw Error("Resposta DJEN incompatível.");
      panel2._searchFilters = { ...fields2 };
      results.innerHTML = djenNameResultsHTML(data);
      status.textContent = data.status === "partial" ? "Busca com resposta parcial." : data.events.length ? `${data.total} publicação(ões) encontrada(s). Exibindo ${data.events.length} nesta página.` : data.total > 0 ? "Nenhuma publicação nesta página. Volte à página anterior." : "Nenhuma publicação encontrada para esse nome no período. Isso não comprova ausência de processos.";
    } catch (error) {
      if (panel2._searchToken === token && panel2.isConnected) status.textContent = "Busca não concluída: " + error.message;
    } finally {
      if (panel2._searchToken === token) submit.disabled = false;
    }
  }
  function installDjenNameSearch(apiPost2) {
    document.addEventListener("submit", (event) => {
      if (event.target.id !== "djen-name-search-form") return;
      event.preventDefault();
      void searchDjenName(event.target.closest("#djen-name-search-panel"), apiPost2);
    });
    document.addEventListener("input", (event) => {
      const panel2 = event.target.closest("#djen-name-search-panel");
      if (!panel2 || !event.target.closest("form")) return;
      panel2._searchToken = null;
      panel2._searchFilters = null;
      panel2.querySelector('[type="submit"]').disabled = false;
      panel2.querySelector("[data-djen-search-results]").innerHTML = "";
      panel2.querySelector("[data-djen-search-status]").textContent = "Filtros alterados. Clique em Buscar no DJEN.";
    });
    document.addEventListener("click", (event) => {
      const button2 = event.target.closest("[data-djen-search-page]");
      if (!button2) return;
      const panel2 = button2.closest("#djen-name-search-panel");
      if (panel2?._searchFilters) void searchDjenName(panel2, apiPost2, Number(button2.dataset.djenSearchPage), panel2._searchFilters);
    });
  }

  // service-job-history.js
  var SERVICE_JOB_PAGE_SIZE = 6;
  var SERVICE_JOB_FILTERS = Object.freeze({
    all: "Todas",
    attention: "Atenção",
    active: "Em andamento",
    completed: "Concluídas",
    cancelled: "Canceladas"
  });
  var ATTENTION = /* @__PURE__ */ new Set(["partial", "error", "action", "auth_required", "access_denied", "unavailable", "unsupported", "incompatible", "interrupted"]);
  var ACTIVE = /* @__PURE__ */ new Set(["queued", "running"]);
  var COMPLETED = /* @__PURE__ */ new Set(["success", "not_found"]);
  function serviceJobGroup(job) {
    const status = String(job?.status ?? "");
    if (ACTIVE.has(status)) return "active";
    if (ATTENTION.has(status)) return "attention";
    if (COMPLETED.has(status)) return "completed";
    return status === "cancelled" ? "cancelled" : "attention";
  }
  function selectServiceJobs(jobs, { filter: filter2 = "all", query: query2 = "", page = 1, pageSize = SERVICE_JOB_PAGE_SIZE } = {}) {
    if (!Object.hasOwn(SERVICE_JOB_FILTERS, filter2)) filter2 = "all";
    const collection = Array.isArray(jobs) ? jobs : [], counts = { all: collection.length, attention: 0, active: 0, completed: 0, cancelled: 0 };
    for (const job of collection) counts[serviceJobGroup(job)]++;
    const needle = fold(query2.trim());
    const matches = collection.filter((job) => (filter2 === "all" || serviceJobGroup(job) === filter2) && (!needle || fold([job.source, SOURCES[job.source], job.cnj, job.oab, job.uf, job.status, LABELS[job.status], job.message, job.case_id].join(" ")).includes(needle)));
    const size = Math.max(1, Math.min(25, Math.floor(Number(pageSize) || SERVICE_JOB_PAGE_SIZE)));
    const totalPages = Math.max(1, Math.ceil(matches.length / size));
    const currentPage = Math.max(1, Math.min(totalPages, Math.floor(Number(page) || 1)));
    const from = (currentPage - 1) * size;
    return {
      rows: matches.slice(from, from + size),
      counts,
      total: matches.length,
      totalPages,
      page: currentPage,
      first: matches.length ? from + 1 : 0,
      last: Math.min(from + size, matches.length),
      pageSize: size
    };
  }
  var SOURCES = { datajud: "DataJud", djen: "DJEN", esaj_pg: "TJSP e-SAJ · 1º grau", esaj_sg: "TJSP e-SAJ · 2º grau" };
  var LABELS = {
    queued: "Na fila",
    running: "Consultando",
    success: "Concluída",
    partial: "Parcial",
    not_found: "Não localizada",
    auth_required: "Autenticação necessária",
    access_denied: "Acesso negado",
    unavailable: "Indisponível",
    unsupported: "Não suportado",
    incompatible: "Resposta incompatível",
    cancelled: "Cancelada",
    error: "Erro",
    action: "Exige ação",
    interrupted: "Interrompida"
  };
  function serviceJobRowsHTML(rows, formatDate = () => "Data não informada") {
    if (!rows.length) return '<p class="service-jobs-empty">Nenhuma consulta corresponde a este filtro. Tente outra situação ou pesquisa.</p>';
    return '<ol class="service-jobs-list">' + rows.map((job) => {
      const category = serviceJobGroup(job), reference = job.cnj || (job.oab && job.uf ? `OAB ${job.oab}/${job.uf}` : "Referência não informada");
      const status = LABELS[job.status] || "Situação não informada", title = SOURCES[job.source] || "Fonte não informada";
      const date2 = job.updated_at ? formatDate(job.updated_at) : "Data não informada";
      return `<li ${job.status === "running" ? 'data-loading="true" data-loading-fixed aria-busy="true"' : ""} class="service-job-row ${category === "attention" ? "service-job-alert" : ""}">
      <div class="service-job-summary"><span class="service-job-source">${escapeHTML(title)}</span>
        <span data-service-status="${Object.hasOwn(LABELS, job.status) ? job.status : "unknown"}" class="tag service-job-tag ${category === "attention" ? "action" : category === "active" ? "running" : category === "completed" ? "success" : "cancelled"}">${escapeHTML(status)}</span>
        <strong class="service-job-reference private" title="${escapeHTML(reference)}">${escapeHTML(reference)}</strong>
        <span class="service-job-date">${escapeHTML(date2)}</span></div>
      <div class="service-job-extras"><details class="service-job-details"><summary>Detalhes</summary>
        <div class="service-job-detail-body"><p class="private">${escapeHTML(job.message || "Sem mensagem adicional da fonte.")}</p>
        ${job.source_updated_at ? `<p>Atualização informada pela fonte: ${escapeHTML(formatDate(job.source_updated_at))}</p>` : ""}
        <p>Última tentativa: ${escapeHTML(date2)}</p></div></details>
        ${job.case_id ? `<button type="button" class="button ghost small" data-integrated="detail" data-id="${escapeHTML(job.case_id)}">Ver processo</button>` : ""}</div>
    </li>`;
    }).join("") + "</ol>";
  }

  // integrated-ui.js
  var stamp = (value) => {
    if (!value) return "Não informado";
    const time2 = new Date(value);
    return Number.isNaN(time2.valueOf()) ? escapeHTML(value) : new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo"
    }).format(time2);
  };
  var currentCase = "";
  var caseDetailInfo = null;
  var caseHistoryPages = {};
  var serviceJobFilter = "all";
  var serviceJobSearch = "";
  var serviceJobPage = 1;
  var setText = (node, value) => {
    if (node && node.textContent !== value) node.textContent = value;
  };
  function refreshServiceJobHistory(force = false) {
    const host = document.getElementById("integrated-service-jobs");
    if (!host) return;
    if (!host.querySelector("#service-jobs-search")) {
      host.innerHTML = `<div class="service-jobs-heading"><div><h3 id="service-jobs-title">Consultas recentes do serviço</h3>
      <p class="muted compact">Últimas consultas recebidas do serviço local. O histórico completo permanece no SQLite e no backup.</p></div>
      <span class="service-jobs-total" id="service-jobs-total"></span></div>
      <div class="service-jobs-controls"><div class="service-jobs-filters" role="group" aria-label="Filtrar consultas por situação">
      ${Object.entries(SERVICE_JOB_FILTERS).map(([key, label2]) => `<button type="button" class="service-jobs-filter" data-integrated="jobs-filter" data-value="${key}" aria-pressed="false">${label2} <span data-jobs-count="${key}">0</span></button>`).join("")}
      </div><label class="service-jobs-search">Buscar nas consultas
      <input type="search" id="service-jobs-search" autocomplete="off" placeholder="CNJ, OAB, fonte ou mensagem" aria-label="Buscar nas consultas recentes do serviço"></label></div>
      <div id="service-jobs-rows"></div>
      <div class="service-jobs-footer"><p id="service-jobs-progress" role="status" aria-live="polite" aria-atomic="true"></p>
      <div class="service-jobs-pager"><button type="button" class="button ghost small" data-integrated="jobs-prev">Anterior</button>
      <span id="service-jobs-page" aria-label="Página atual"></span>
      <button type="button" class="button secondary small" data-integrated="jobs-next">Próxima</button></div></div>`;
    }
    const model = selectServiceJobs(serviceDashboard.jobs, { filter: serviceJobFilter, query: serviceJobSearch, page: serviceJobPage });
    serviceJobPage = model.page;
    for (const key of Object.keys(SERVICE_JOB_FILTERS)) {
      const button2 = host.querySelector(`[data-integrated="jobs-filter"][data-value="${key}"]`);
      button2.classList.toggle("active", serviceJobFilter === key);
      button2.setAttribute("aria-pressed", String(serviceJobFilter === key));
      setText(button2.querySelector("[data-jobs-count]"), String(model.counts[key]));
    }
    const input = host.querySelector("#service-jobs-search");
    if (document.activeElement !== input && input.value !== serviceJobSearch) input.value = serviceJobSearch;
    setText(host.querySelector("#service-jobs-total"), `${model.counts.all} registro(s)`);
    const list = host.querySelector("#service-jobs-rows"), markup = serviceJobRowsHTML(model.rows, stamp);
    if ((force || !list.contains(document.activeElement)) && list._lastMarkup !== markup) {
      list.innerHTML = markup;
      list._lastMarkup = markup;
    }
    setText(host.querySelector("#service-jobs-progress"), model.total ? `Exibindo ${model.first} a ${model.last} de ${model.total} nesta seleção (até 100 consultas recentes).` : "Nenhuma consulta encontrada nesta seleção.");
    setText(host.querySelector("#service-jobs-page"), `${model.page} de ${model.totalPages}`);
    host.querySelector('[data-integrated="jobs-prev"]').disabled = model.page <= 1;
    host.querySelector('[data-integrated="jobs-next"]').disabled = model.page >= model.totalPages;
  }
  function decorateIntegrated(route2, state2) {
    let banner = document.getElementById("service-status");
    if (!banner) {
      banner = document.createElement("section");
      banner.id = "service-status";
      banner.setAttribute("aria-live", "polite");
      const point = document.getElementById("job-progress");
      point.parentNode.insertBefore(banner, point);
    }
    if (!integrated) {
      document.getElementById("job-progress").innerHTML = "";
      banner.innerHTML = '<p class="compact muted">Modo HTML direto · seus registros locais estão disponíveis. Consultas judiciais indisponíveis sem o serviço Python. Abra <strong>ABRIR-PAINEL-INTEGRADO.cmd</strong> para atualizar processos. Consultas antigas pendentes não serão executadas neste modo.</p>';
      return;
    }
    const bannerHTML = serviceOnline ? '<p class="compact muted">Serviço Python local conectado · acompanhamento persiste com a aba fechada (enquanto o serviço e o computador permanecerem ativos).</p>' + (serviceSyncWarning ? '<p class="warning-note">' + escapeHTML(serviceSyncWarning) + "</p>" : "") : '<p class="warning-note">Serviço desconectado: ' + escapeHTML(serviceError) + ". Os cadastros e anexos deste navegador permanecem disponíveis. Reinicie pelo iniciador integrado.</p>";
    if (banner._lastMarkup !== bannerHTML) {
      banner.innerHTML = bannerHTML;
      banner._lastMarkup = bannerHTML;
    }
    const old = document.getElementById("job-progress");
    if (old) {
      const waiting = (serviceDashboard.jobs || []).filter((x) => ["queued", "running"].includes(x.status));
      const waitingHTML = waiting.length ? '<div class="job-banner" ' + (waiting.some((x) => x.status === "running") ? 'data-loading="true" data-loading-fixed aria-busy="true"' : "") + "><p><strong>" + waiting.length + ' consulta(s) na fila ou em andamento</strong> Você pode fechar a aba; o serviço continua enquanto estiver ligado.</p><button class="button secondary small" data-integrated="cancel">Cancelar consultas</button></div>' : "";
      if (old._lastMarkup !== waitingHTML) {
        old.innerHTML = waitingHTML;
        old._lastMarkup = waitingHTML;
      }
    }
    if (route2 === "sources") {
      const container = document.getElementById("content");
      if (!container) return;
      const scheduler = document.querySelector("#auto-form");
      if (scheduler) {
        const connection = scheduler.querySelector("[data-schedule-connection]");
        if (connection) {
          connection.textContent = serviceOnline ? "Serviço conectado" : "Serviço desconectado";
          connection.className = "schedule-state" + (serviceOnline ? "" : " warning");
        }
      }
      if (scheduler && serviceSettings) {
        const hint = scheduler.querySelector("[data-schedule-status]");
        if (hint) hint.textContent = serviceSettings.autoEnabled ? "Última janela processada pelo serviço: " + (serviceSettings.autoLast || "ainda nenhuma") + " · horários: " + serviceSettings.autoTimes.join(", ") + " · fuso America/Sao_Paulo. O serviço precisa estar em execução." : "Agendamento no serviço desativado. As consultas manuais continuam disponíveis.";
      }
      let panel2 = document.getElementById("integrated-source-panel");
      if (!panel2) {
        panel2 = document.createElement("section");
        panel2.className = "panel";
        panel2.id = "integrated-source-panel";
        container.insertBefore(panel2, container.firstChild);
      }
      if (!panel2.querySelector("#integrated-source-summary")) {
        panel2.innerHTML = '<div id="integrated-source-summary"></div><section id="integrated-service-jobs" aria-labelledby="service-jobs-title"></section>';
      }
      const summary = panel2.querySelector("#integrated-source-summary");
      const choices = serviceConnectors.filter((x) => x.id.startsWith("esaj_")).map((item) => {
        const enabled = !!serviceSettings?.enabled?.[item.id];
        return '<label class="check-field"><input type="checkbox" name="' + escapeHTML(item.id) + '" ' + (enabled ? "checked " : "") + (item.enabled ? "" : "disabled ") + "> " + escapeHTML(item.label) + (item.enabled ? "" : " (instalação opcional necessária)") + "</label>";
      }).join("");
      const summaryHtml = '<h2>Monitoramento pelo serviço Python</h2><p class="muted compact">No modo integrado, cadastros e anexos ficam no banco local, junto com consultas, tramitações, eventos e fila no SQLite local. Sem sincronização na nuvem.</p>' + (serviceOnline ? '<p class="compact">Conectado · ' + (serviceDashboard.unseen || 0) + ' novidade(s) para conferir.</p><form id="integrated-connectors-form"><h3>Fontes complementares</h3>' + choices + '<p class="muted compact">DataJud e DJEN são configurados nos cartões de fontes. O e-SAJ consulta somente processos TJSP e pode depender da disponibilidade do portal.</p><button class="button secondary" type="submit">Salvar conectores e-SAJ</button></form><details class="source-card"><summary>Como acessar o Jus.br/PDPJ</summary><p>Esta versão do Painel H.B não possui login integrado com o Jus.br/PDPJ. O acesso é feito no portal oficial.</p><ol><li>Abra o Portal Jus.br e escolha Entrar.</li><li>Para advogados, consulte as opções de gov.br (nível Ouro) ou certificado digital.</li><li>Conclua a verificação adicional solicitada pelo portal. Em caso de dificuldade, use o suporte do CNJ.</li></ol><p>Entrar no portal não conecta automaticamente o Jus.br ao painel.</p><div class="links"><a class="button secondary small" href="https://www.jus.br/" target="_blank" rel="noopener noreferrer">Abrir Jus.br ↗</a><a href="https://www.cnj.jus.br/tecnologia-da-informacao-e-comunicacao/justica-4-0/jus-br/perguntas-frequentes/" target="_blank" rel="noopener noreferrer">Instruções oficiais do CNJ</a><a href="https://suporteti.cnj.jus.br/" target="_blank" rel="noopener noreferrer">Suporte do CNJ</a></div></details>' : '<p class="warning-note">Sem conexão com o serviço local.</p>');
      if (!summary.contains(document.activeElement) && summary._lastMarkup !== summaryHtml) {
        summary.innerHTML = summaryHtml;
        summary._lastMarkup = summaryHtml;
      }
      refreshServiceJobHistory();
    }
    if (route2 === "publications" && serviceOnline) {
      void loadIntegratedPublications();
    }
    organizePanel(route2);
  }
  function loadIntegratedPublications() {
    const container = document.getElementById("content");
    if (!container || !serviceOnline || document.getElementById("djen-name-search-panel")) return;
    const search = document.createElement("section");
    search.id = "djen-name-search-panel";
    search.className = "panel";
    search.innerHTML = djenNameSearchHTML();
    container.insertBefore(search, container.firstChild);
  }
  async function loadIntegratedCase(caseId, background = false) {
    if (!integrated || !serviceOnline) return;
    if (currentCase !== caseId) {
      caseHistoryPages = {};
      caseDetailInfo = null;
    }
    currentCase = caseId;
    const body = document.getElementById("dialog-body");
    if (!body) return;
    let element = body.querySelector("#integrated-case-detail");
    if (background && (!element || element.dataset.caseId !== caseId)) return;
    if (!background) {
      element?.remove();
      element = null;
    }
    element ||= document.createElement("section");
    element.dataset.caseId = caseId;
    element.className = "detail-section";
    element.id = "integrated-case-detail";
    if (!background) {
      element.innerHTML = "<h3>Acompanhamento integrado</h3><p>Consultando o histórico salvo no serviço...</p>";
      body.appendChild(element);
    }
    try {
      const info = await apiGet("processes/" + encodeURIComponent(caseId));
      if (currentCase !== caseId || !element.isConnected) return;
      caseDetailInfo = info;
      const html = integratedCaseHTML(info, caseId, caseHistoryPages);
      if (element._lastHTML !== html) {
        const openEventKeys = new Set([...element.querySelectorAll(".integrated-event:has(details[open])")].map((x) => x.dataset.eventSource + "\0" + x.dataset.eventId));
        const technicalOpen = !!element.querySelector(".integrated-technical[open]");
        element.innerHTML = html;
        element._lastHTML = html;
        element.querySelectorAll(".integrated-event").forEach((x) => {
          x.querySelector("details").open = openEventKeys.has(x.dataset.eventSource + "\0" + x.dataset.eventId);
        });
        const technical = element.querySelector(".integrated-technical");
        if (technical) technical.open = technicalOpen;
      }
    } catch (error) {
      if (!background && element.isConnected) element.innerHTML = '<h3>Acompanhamento integrado</h3><p class="warning-note">' + escapeHTML(error.message) + "</p>";
    }
  }
  var refreshingCase = false;
  async function refreshIntegratedCase() {
    if (refreshingCase || !document.getElementById("editor")?.open || !currentCase) return;
    refreshingCase = true;
    try {
      await loadIntegratedCase(currentCase, true);
    } finally {
      refreshingCase = false;
    }
  }
  function installIntegratedActions({ update: update2, toast: toast2 }) {
    installDjenNameSearch(apiPost);
    document.addEventListener("input", (event) => {
      if (event.target.id !== "service-jobs-search") return;
      serviceJobSearch = event.target.value.slice(0, 180);
      serviceJobPage = 1;
      refreshServiceJobHistory();
    });
    document.addEventListener("click", async (event) => {
      const target = event.target.closest("[data-integrated]");
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      try {
        if (target.dataset.integrated === "events-page") {
          const key = target.dataset.key, next = Number(target.dataset.page);
          if (!/^(?:datajud|djen|other)-(?:news|history)$/.test(key) || !Number.isSafeInteger(next) || !caseDetailInfo) return;
          caseHistoryPages[key] = Math.max(1, next);
          const panel2 = document.getElementById("integrated-case-detail");
          if (!panel2 || panel2.dataset.caseId !== currentCase) return;
          const openEventKeys = new Set([...panel2.querySelectorAll(".integrated-event:has(details[open])")].map((x) => x.dataset.eventSource + "\0" + x.dataset.eventId));
          const technicalOpen = !!panel2.querySelector(".integrated-technical[open]");
          const html = integratedCaseHTML(caseDetailInfo, currentCase, caseHistoryPages);
          panel2.innerHTML = html;
          panel2._lastHTML = html;
          panel2.querySelectorAll(".integrated-event").forEach((x) => {
            x.querySelector("details").open = openEventKeys.has(x.dataset.eventSource + "\0" + x.dataset.eventId);
          });
          const technical = panel2.querySelector(".integrated-technical");
          if (technical) technical.open = technicalOpen;
          const direction = target.textContent.trim();
          const controls = [...panel2.querySelectorAll(`[data-integrated="events-page"][data-key="${key}"]:not([disabled])`)];
          (controls.find((button2) => button2.textContent.trim() === direction) || controls[0])?.focus();
          return;
        }
        if (target.dataset.integrated === "jobs-filter") {
          if (Object.hasOwn(SERVICE_JOB_FILTERS, target.dataset.value)) {
            serviceJobFilter = target.dataset.value;
            serviceJobPage = 1;
            refreshServiceJobHistory();
          }
          return;
        }
        if (target.dataset.integrated === "jobs-prev" || target.dataset.integrated === "jobs-next") {
          serviceJobPage += target.dataset.integrated === "jobs-next" ? 1 : -1;
          refreshServiceJobHistory();
          return;
        }
        if (target.dataset.integrated === "update") await update2([target.dataset.id]);
        if (target.dataset.integrated === "update-djen") {
          await update2([target.dataset.id], ["djen"]);
          await loadIntegratedCase(target.dataset.id, true);
        }
        if (target.dataset.integrated === "update-datajud") {
          await update2([target.dataset.id], ["datajud"]);
          await loadIntegratedCase(target.dataset.id, true);
        }
        if (target.dataset.integrated === "detail") {
          const id = target.dataset.id;
          document.getElementById("editor")?.showModal?.();
          document.getElementById("editor")?.classList.add("case-dialog");
          document.getElementById("dialog-title").textContent = "Acompanhamento · " + id;
          document.getElementById("dialog-body").innerHTML = "";
          await loadIntegratedCase(id);
        }
        if (target.dataset.integrated === "cancel") {
          const result = await apiPost("jobs/cancel");
          toast2(result.count + " consulta(s) cancelada(s).");
        }
        if (target.dataset.integrated === "seen") {
          await apiPost("events/seen", {
            caseId: target.dataset.caseId,
            source: target.dataset.source,
            eventId: target.dataset.id
          });
          if (target.dataset.caseId) {
            await loadIntegratedCase(target.dataset.caseId);
          }
        }
        await pollService();
        decorateIntegrated(location.hash.replace("#", "") || "home", {});
      } catch (error) {
        toast2(error.message);
      }
    }, true);
    document.addEventListener("submit", async (event) => {
      const form = event.target;
      if (form.id !== "integrated-connectors-form") return;
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      try {
        await updateExtraConnectors({ esaj_pg: !!data.esaj_pg, esaj_sg: !!data.esaj_sg });
        toast2("Fontes complementares atualizadas.");
        await pollService();
      } catch (error) {
        toast2(error.message);
      }
    });
  }

  // datajud-prefill.js
  var drafts = /* @__PURE__ */ new WeakMap();
  var initialDrafts = /* @__PURE__ */ new WeakMap();
  var previews = /* @__PURE__ */ new WeakMap();
  var labels = {
    tribunal: "Tribunal",
    grau: "Grau",
    sistema: "Sistema",
    classe: "Classe",
    assuntos: "Assuntos",
    orgao: "Órgão julgador",
    dataAjuizamento: "Data de ajuizamento"
  };
  var infoFields = ["tribunal", "grau", "sistema", "classe", "assuntos", "orgao", "dataAjuizamento"];
  function suggestions(record) {
    const court = String(record?.tribunal || "").toUpperCase().trim();
    const courts = { TJRJ: "tjrj", TRF2: "trf2", TJSP: "tjsp", STJ: "stj", STF: "stf" };
    const degree = String(record?.grau || "").toUpperCase().trim();
    const system = String(record?.sistema || "").toLowerCase().trim();
    return {
      court: courts[court] || (court && /^(TJ|TRF|TRT|TRE|TST|TSE|STM)/.test(court) ? "other" : "") || "",
      courtLevel: ["G1", "1", "PRIMEIRO GRAU", "1º GRAU"].includes(degree) ? "first" : ["G2", "2", "SEGUNDO GRAU", "2º GRAU"].includes(degree) ? "second" : ["SUP", "SUPERIOR"].includes(degree) ? "superior" : degree ? "other" : "",
      processSystem: !system ? "" : /\beproc\b/.test(system) ? "eproc" : /\bpje\b/.test(system) ? "pje" : /\bprojudi\b/.test(system) ? "projudi" : /\be.?saj\b/.test(system) ? "esaj" : "other"
    };
  }
  function normalizedDetails(record, cnj) {
    return {
      cnj: digits(cnj),
      recordId: String(record.id || "").slice(0, 150),
      tribunal: String(record.tribunal || "").slice(0, 35),
      grau: String(record.grau || "").slice(0, 35),
      sistema: String(record.sistema || "").slice(0, 100),
      classe: String(record.classe || "").slice(0, 180),
      assuntos: Array.isArray(record.assuntos) ? record.assuntos.slice(0, 20).map((x) => String(x).slice(0, 180)) : [],
      orgao: String(record.orgao || "").slice(0, 180),
      dataAjuizamento: String(record.dataAjuizamento || "").slice(0, 45),
      sourceUpdatedAt: String(record.sourceUpdatedAt || "").slice(0, 45)
    };
  }
  function mergeDetails(existing, incoming) {
    if (!existing || existing.cnj !== incoming.cnj) return incoming;
    const result = { ...existing };
    for (const key of Object.keys(incoming)) {
      if (key === "cnj") continue;
      if (key === "assuntos") {
        if (!Array.isArray(result.assuntos) || !result.assuntos.length) result.assuntos = incoming.assuntos;
      } else if (!String(result[key] || "").trim()) result[key] = incoming[key];
    }
    return result;
  }
  function applyEmptyFields(form, record, current, cnj) {
    const result = { filled: [], preserved: [], missing: [] };
    const suggested = suggestions(record);
    const manualCourt = form.elements.namedItem("court")?.value || "";
    const sourceCourt = suggested.court;
    const differentCourt = !!manualCourt && !!sourceCourt && manualCourt !== sourceCourt && manualCourt !== "other";
    const effectiveCourt = manualCourt || sourceCourt;
    if (differentCourt) result.missing.push("Conferência do tribunal (seleção diferente da fonte)");
    if (effectiveCourt === "stj" || effectiveCourt === "stf") {
      if (suggested.courtLevel && !differentCourt) suggested.courtLevel = "superior";
    } else if (["tjrj", "trf2", "tjsp"].includes(effectiveCourt) && suggested.courtLevel === "superior") {
      suggested.courtLevel = "";
    }
    for (const [name, label2] of [["court", "Tribunal"], ["courtLevel", "Grau"], ["processSystem", "Sistema"]]) {
      const field2 = form.elements.namedItem(name);
      if (!field2) continue;
      if (String(field2.value || "").trim()) {
        result.preserved.push(label2);
        continue;
      }
      if (differentCourt && name !== "court") {
        result.missing.push(label2 + " (requer conferência)");
        continue;
      }
      if (!suggested[name]) {
        result.missing.push(label2);
        continue;
      }
      if (![...field2.options].some((option) => option.value === suggested[name])) {
        result.missing.push(label2);
        continue;
      }
      field2.value = suggested[name];
      result.filled.push(label2);
    }
    const incoming = normalizedDetails(record, cnj);
    const details = mergeDetails(current, incoming);
    for (const key of ["classe", "assuntos", "orgao", "dataAjuizamento"]) {
      const value = details[key];
      if (!value || Array.isArray(value) && !value.length) result.missing.push(labels[key]);
    }
    const metadataLabels = { ...labels, recordId: "Identificação do registro", sourceUpdatedAt: "Atualização na fonte" };
    const hasValue = (value) => Array.isArray(value) ? value.length > 0 : !!String(value || "").trim();
    const metadataFilled = Object.keys(metadataLabels).filter((key) => hasValue(details[key]) && (!current || current.cnj !== cnj || !hasValue(current[key]))).map((key) => metadataLabels[key]);
    return { ...result, metadataFilled, details };
  }
  function detailsHTML(details) {
    if (!details) return '<p class="muted compact">Nenhum dado público aplicado. As observações pessoais ficam separadas.</p>';
    const entries = [
      ["Tribunal", details.tribunal],
      ["Grau", details.grau],
      ["Sistema informado pela fonte", details.sistema],
      ["Classe", details.classe],
      ["Assuntos", (details.assuntos || []).join("; ")],
      ["Órgão julgador", details.orgao],
      ["Data de ajuizamento", details.dataAjuizamento],
      ["Atualização na fonte", details.sourceUpdatedAt]
    ];
    return '<dl class="datajud-details">' + entries.map(([label2, value]) => `<div><dt>${label2}</dt><dd>${value ? escapeHTML(value) : "Não informado pelo DataJud"}</dd></div>`).join("") + '</dl><p class="muted compact">Fonte: DataJud/CNJ · registro ' + escapeHTML(details.recordId || "não informado") + ". Dados públicos importados por confirmação; não alteram suas observações.</p>";
  }
  function initDatajudForm(form, saved) {
    const original = saved && saved.cnj === digits(form.elements.cnj.value) ? structuredClone(saved) : null;
    initialDrafts.set(form, original);
    drafts.set(form, original ? structuredClone(original) : null);
    previews.delete(form);
    form.addEventListener("change", (event) => {
      if (!["court", "courtLevel", "processSystem"].includes(event.target.name)) return;
      const data = previews.get(form);
      if (!data?.application) return;
      delete data.application;
      updateApplyState(form);
    });
    renderDetails(form);
  }
  function getDatajudDraft(form) {
    return drafts.get(form) || null;
  }
  function renderDetails(form) {
    const container = form.querySelector("#datajud-fields");
    if (container) container.innerHTML = detailsHTML(getDatajudDraft(form));
  }
  function renderPreview(form) {
    const holder = form.querySelector("#datajud-preview"), data = previews.get(form);
    if (!holder) return;
    if (!data) {
      holder.hidden = true;
      holder.innerHTML = "";
      return;
    }
    const records = data.records || [], index = Number(form.querySelector("#datajud-choice")?.value || 0);
    const item = records[index] || records[0];
    holder.hidden = false;
    holder.innerHTML = `<h3>Prévia dos dados públicos</h3><p class="muted compact">${escapeHTML(data.message || "")} Nenhuma informação será salva antes de confirmar e salvar o processo.</p>` + (data.partial ? '<p class="warning-note">Resultado parcial. Alguns registros podem não ter sido consultados.</p>' : "") + (records.length > 1 ? `<label class="field">Escolha o registro ou grau
      <select id="datajud-choice" aria-label="Selecionar registro DataJud">${records.map((row, i) => `<option value="${i}" ${i === index ? "selected" : ""}>${escapeHTML(row.tribunal || "Tribunal não informado")} · ${escapeHTML(row.grau || "Grau não informado")} · ${escapeHTML(row.orgao || row.id || "Registro " + (i + 1))}</option>`).join("")}</select></label>` : "") + (item ? '<dl class="datajud-details">' + infoFields.map((field2) => {
      const value = field2 === "assuntos" ? (item.assuntos || []).join("; ") : item[field2];
      return `<div><dt>${labels[field2]}</dt><dd>${escapeHTML(value || "Não informado pela fonte")}</dd></div>`;
    }).join("") + '</dl><button type="button" class="button secondary small" data-action="datajud-apply">Aplicar apenas aos campos vazios</button><p id="datajud-apply-status" class="datajud-apply-status" role="status" aria-live="polite" aria-atomic="true" hidden></p>' : '<p class="warning-note">Nenhum registro localizado nesta consulta. Isso não prova inexistência do processo. Confira o portal oficial.</p>');
    updateApplyState(form);
  }
  function updateApplyState(form) {
    const data = previews.get(form), button2 = form.querySelector('[data-action="datajud-apply"]'), status = form.querySelector("#datajud-apply-status");
    if (!button2 || !status) return;
    const result = data?.application?.selected === (data?.selected || 0) ? data.application.result : null;
    button2.disabled = !!result;
    status.hidden = !result;
    if (!result) {
      button2.textContent = "Aplicar apenas aos campos vazios";
      status.textContent = "";
      delete status.dataset.outcome;
      return;
    }
    const changed = result.filled.length > 0 || result.metadataFilled.length > 0;
    button2.textContent = changed ? "✓ Dados aplicados" : "Nenhum dado novo para aplicar";
    status.dataset.outcome = changed ? "applied" : "unchanged";
    status.textContent = (changed ? "Dados aplicados ao formulário. Ainda não foram salvos. " : "Nenhum campo foi alterado nesta aplicação. ") + `Campos preenchidos: ${result.filled.join(", ") || "nenhum"}. Dados públicos adicionados: ${result.metadataFilled.join(", ") || "nenhum"}. Mantidos como estavam: ${result.preserved.join(", ") || "nenhum"}. Não disponíveis: ${result.missing.join(", ") || "nenhum"}. Para gravar a ficha, clique em Salvar caso.`;
  }
  function chooseDatajudRecord(form) {
    if (!previews.get(form)) return;
    const chosen = Number(form.querySelector("#datajud-choice")?.value || 0);
    const previous = previews.get(form);
    previous.selected = Number.isInteger(chosen) ? chosen : 0;
    delete previous.application;
    const status = form.querySelector("#datajud-status");
    if (status) {
      status.textContent = "";
      status.dataset.level = "";
    }
    renderPreviewSelection(form);
  }
  function renderPreviewSelection(form) {
    const data = previews.get(form);
    if (!data) return;
    const original = form.querySelector("#datajud-choice");
    if (original) original.value = String(data.selected || 0);
    const holder = form.querySelector("#datajud-preview");
    if (!holder) return;
    const selected2 = data.records[data.selected || 0];
    const dl = holder.querySelector(".datajud-details");
    if (dl && selected2) dl.innerHTML = infoFields.map((field2) => {
      const value = field2 === "assuntos" ? (selected2.assuntos || []).join("; ") : selected2[field2];
      return `<div><dt>${labels[field2]}</dt><dd>${escapeHTML(value || "Não informado pela fonte")}</dd></div>`;
    }).join("");
    updateApplyState(form);
  }
  function invalidateDatajudIfCnjChanged(form) {
    const cnj = digits(form.elements.cnj?.value || "");
    const previous = previews.get(form);
    if (previous && previous.cnj !== cnj) {
      previews.delete(form);
      renderPreview(form);
    }
    const current = getDatajudDraft(form);
    if (current && current.cnj !== cnj) {
      drafts.set(form, null);
      renderDetails(form);
    }
    const original = initialDrafts.get(form);
    if (!getDatajudDraft(form) && original && original.cnj === cnj) {
      drafts.set(form, structuredClone(original));
      renderDetails(form);
    }
    const message = form.querySelector("#datajud-status");
    if (message && (!previous || previous.cnj !== cnj)) {
      message.textContent = "";
      message.dataset.level = "";
    }
  }
  async function searchDatajud(form, apiPost2, online) {
    const status = form.querySelector("#datajud-status"), button2 = form.querySelector('[data-action="datajud-search"]');
    if (!online) {
      status.dataset.level = "error";
      status.textContent = "Abra o Painel H.B pelo iniciador integrado e mantenha o serviço Python ligado.";
      return;
    }
    const cnj = digits(form.elements.cnj.value);
    if (!validCnj(cnj)) {
      status.dataset.level = "error";
      status.textContent = "Confira os 20 dígitos e os verificadores do número CNJ.";
      return;
    }
    previews.delete(form);
    renderPreview(form);
    button2.disabled = true;
    status.dataset.level = "";
    status.textContent = "Consultando DataJud pelo serviço Python...";
    try {
      const data = await apiPost2("datajud/preview", { cnj });
      if (!form.isConnected || digits(form.elements.cnj.value) !== cnj) return;
      if (data.cnj !== cnj || !Array.isArray(data.records)) throw Error("Resposta DataJud incompatível com o CNJ informado.");
      previews.set(form, { ...data, selected: 0 });
      renderPreview(form);
      status.dataset.level = data.records.length ? "" : "error";
      status.textContent = data.records.length ? `${data.records.length} registro(s) recebido(s). Confira a prévia antes de aplicar.` : data.message;
    } catch (error) {
      if (form.isConnected && digits(form.elements.cnj.value) === cnj) {
        status.dataset.level = "error";
        status.textContent = "Consulta não concluída: " + error.message + ". Nenhum campo foi alterado.";
      }
    } finally {
      if (button2.isConnected) button2.disabled = false;
    }
  }
  function applyDatajudSelection(form) {
    const data = previews.get(form), cnj = digits(form.elements.cnj.value);
    if (!data || data.cnj !== cnj || !validCnj(cnj)) throw Error("Número CNJ alterado; consulte novamente antes de aplicar.");
    const record = data.records[data.selected || 0];
    if (!record) throw Error("Selecione um registro para aplicar.");
    if (data.application?.selected === (data.selected || 0)) return data.application.result;
    const result = applyEmptyFields(form, record, getDatajudDraft(form), cnj);
    drafts.set(form, result.details);
    renderDetails(form);
    const status = form.querySelector("#datajud-status");
    status.dataset.level = "";
    status.textContent = "";
    data.application = { selected: data.selected || 0, result };
    updateApplyState(form);
    return result;
  }

  // cnj-origin-units.js
  var TJRJ_ORIGIN_UNITS = Object.freeze({
    "0209": [
      "Regional da Barra da Tijuca"
    ],
    "0207": [
      "Regional da Ilha do Governador"
    ],
    "0210": [
      "Regional da Leopoldina"
    ],
    "0211": [
      "Regional da Pavuna"
    ],
    "0212": [
      "Regional da Região Oceânica"
    ],
    "0087": [
      "Regional de Alcântara"
    ],
    "0204": [
      "Regional de Bangu"
    ],
    "0205": [
      "Regional de Campo Grande"
    ],
    "0079": [
      "Regional de Itaipava"
    ],
    "0203": [
      "Regional de Jacarepaguá"
    ],
    "0202": [
      "Regional de Madureira"
    ],
    "0206": [
      "Regional de Santa Cruz"
    ],
    "0208": [
      "Regional do Méier"
    ],
    "0001": [
      "Comarca da Capital",
      "Processos da VEP"
    ],
    "0255": [
      "Capital - 1ª Vara da Infância e da Juventude Protetiva"
    ],
    "0256": [
      "Capital - 2ª Vara da Infância e da Juventude Protetiva"
    ],
    "0251": [
      "Comarca da Capital - Copacabana"
    ],
    "0252": [
      "Comarca da Capital - Lagoa"
    ],
    "0253": [
      "Comarca da Capital - Tijuca"
    ],
    "0254": [
      "Comarca da Capital - Vila Isabel"
    ],
    "0003": [
      "Comarca de Angra dos Reis"
    ],
    "0052": [
      "Comarca de Araruama"
    ],
    "0005": [
      "Comarca de Arraial do Cabo"
    ],
    "0006": [
      "Comarca de Barra do Piraí"
    ],
    "0007": [
      "Comarca de Barra Mansa"
    ],
    "0008": [
      "Comarca de Belford Roxo"
    ],
    "0009": [
      "Comarca de Bom Jardim"
    ],
    "0010": [
      "Comarca de Bom Jesus de Itabapoana"
    ],
    "0078": [
      "Comarca de Búzios"
    ],
    "0011": [
      "Comarca de Cabo Frio"
    ],
    "0012": [
      "Comarca de Cachoeiras de Macacu"
    ],
    "0013": [
      "Comarca de Cambuci"
    ],
    "0014": [
      "Comarca de Campos dos Goytacazes"
    ],
    "0015": [
      "Comarca de Cantagalo"
    ],
    "0084": [
      "RComarca de Carapebus / Quissamã"
    ],
    "0016": [
      "Comarca de Carmo"
    ],
    "0017": [
      "Comarca de Casimiro de Abreu"
    ],
    "0018": [
      "Comarca de Conceição de Macabu"
    ],
    "0019": [
      "Comarca de Cordeiro"
    ],
    "0020": [
      "Comarca de Duas Barras"
    ],
    "0021": [
      "Comarca de Duque de Caxias"
    ],
    "0022": [
      "Comarca de Engenheiro Paulo de Frontin"
    ],
    "0073": [
      "Comarca de Guapimirim"
    ],
    "0069": [
      "Comarca de Iguaba Grande"
    ],
    "0023": [
      "Comarca de Itaboraí"
    ],
    "0024": [
      "Comarca de Itaguaí"
    ],
    "0080": [
      "Comarca de Italva"
    ],
    "0025": [
      "Comarca de Itaocara"
    ],
    "0026": [
      "Comarca de Itaperuna"
    ],
    "0081": [
      "Comarca de Itatiaia"
    ],
    "0083": [
      "Comarca de Japeri"
    ],
    "0027": [
      "Comarca de Laje do Muriaé"
    ],
    "0028": [
      "Comarca de Macaé"
    ],
    "0029": [
      "Comarca de Magé"
    ],
    "0075": [
      "Comarca de Magé - Regional de Inhomirim"
    ],
    "0030": [
      "Comarca de Mangaratiba"
    ],
    "0031": [
      "Comarca de Maricá"
    ],
    "0032": [
      "Comarca de Mendes"
    ],
    "0033": [
      "Comarca de Miguel Pereira"
    ],
    "0034": [
      "Comarca de Miracema"
    ],
    "0035": [
      "Comarca de Natividade"
    ],
    "0036": [
      "Comarca de Nilópolis"
    ],
    "0002": [
      "Comarca de Niterói"
    ],
    "0037": [
      "Comarca de Nova Friburgo"
    ],
    "0038": [
      "Comarca de Nova Iguaçu"
    ],
    "0039": [
      "Comarca de Paracambi"
    ],
    "0040": [
      "Comarca de Paraíba do Sul"
    ],
    "0041": [
      "Comarca de Paraty"
    ],
    "0072": [
      "Comarca de Paty do Alferes"
    ],
    "0042": [
      "Comarca de Petrópolis"
    ],
    "0082": [
      "Comarca de Pinheiral"
    ],
    "0043": [
      "Comarca de Piraí"
    ],
    "0044": [
      "Comarca de Porciúncula"
    ],
    "0071": [
      "Comarca de Porto Real - Quatis"
    ],
    "0067": [
      "Comarca de Queimados"
    ],
    "0045": [
      "Comarca de Resende"
    ],
    "0046": [
      "Comarca de Rio Bonito"
    ],
    "0047": [
      "Comarca de Rio Claro"
    ],
    "0048": [
      "Comarca de Rio das Flores"
    ],
    "0068": [
      "Comarca de Rio das Ostras"
    ],
    "0049": [
      "Comarca de Santa Maria Madalena"
    ],
    "0050": [
      "Comarca de Santo Antônio de Pádua"
    ],
    "0051": [
      "Comarca de São Fidelis"
    ],
    "0070": [
      "Comarca de São Francisco do Itabapoana"
    ],
    "0004": [
      "Comarca de São Gonçalo"
    ],
    "0053": [
      "Comarca de São João da Barra"
    ],
    "0054": [
      "Comarca de São João de Meriti"
    ],
    "0076": [
      "Comarca de São José do Vale do Rio Preto"
    ],
    "0055": [
      "Comarca de São Pedro da Aldeia"
    ],
    "0056": [
      "Comarca de São Sebastião do Alto"
    ],
    "0057": [
      "Comarca de Sapucaia"
    ],
    "0058": [
      "Comarca de Saquarema"
    ],
    "0077": [
      "Comarca de Seropédica"
    ],
    "0059": [
      "Comarca de Silva Jardim"
    ],
    "0060": [
      "Comarca de Sumidouro"
    ],
    "0061": [
      "Comarca de Teresópolis"
    ],
    "0062": [
      "Comarca de Trajano de Moraes"
    ],
    "0063": [
      "Comarca de Três Rios"
    ],
    "0064": [
      "Comarca de Valença"
    ],
    "0065": [
      "Comarca de Vassouras"
    ],
    "0066": [
      "Comarca de Volta Redonda"
    ],
    "0000": [
      "Processos de 2ª Instância"
    ],
    "9000": [
      "Processos das Turmas Recursais"
    ]
  });

  // cnj-inference.js
  var SEGMENTS = {
    "1": "Supremo Tribunal Federal",
    "2": "Conselho Nacional de Justiça",
    "3": "Superior Tribunal de Justiça",
    "4": "Justiça Federal",
    "5": "Justiça do Trabalho",
    "6": "Justiça Eleitoral",
    "7": "Justiça Militar da União",
    "8": "Justiça Estadual e do Distrito Federal e Territórios",
    "9": "Justiça Militar Estadual"
  };
  var COURT_FIELD_BY_ALIAS = { tjrj: "tjrj", trf2: "trf2", tjsp: "tjsp", stj: "stj" };
  var autoFilledCourt = /* @__PURE__ */ new WeakMap();
  function tribunalName(alias, j2, tr) {
    if (j2 === "1" && tr === "00") return "STF";
    if (j2 === "2" && tr === "00") return "CNJ";
    if (j2 === "3" && tr === "00") return "STJ";
    if (j2 === "5" && tr === "00") return "TST";
    if (j2 === "6" && tr === "00") return "TSE";
    if (j2 === "7" && tr === "00") return "STM";
    if (!alias) return `Tribunal não identificado localmente (código ${j2}.${tr})`;
    if (/^trf\d+$/.test(alias)) return alias.toUpperCase();
    if (/^trt\d+$/.test(alias)) return `TRT da ${Number(alias.slice(3))}ª Região`;
    if (alias.startsWith("tre-")) return alias.toUpperCase();
    if (alias.startsWith("tjm")) return `TJM-${alias.slice(3).toUpperCase()}`;
    return alias.toUpperCase();
  }
  function inferCnjJurisdiction(value) {
    const cnj = digits(value);
    if (!validCnj(cnj)) return null;
    const year = cnj.slice(9, 13), j2 = cnj[13], tr = cnj.slice(14, 16), originCode = cnj.slice(16, 20);
    const alias = tribunalAlias(cnj) || (j2 === "1" && tr === "00" ? "stf" : null);
    const segment = SEGMENTS[j2] || `Segmento ${j2}`;
    const originUnitNames = alias === "tjrj" ? TJRJ_ORIGIN_UNITS[originCode] || [] : [];
    const originUnit = originUnitNames.length === 1 ? originUnitNames[0] : originUnitNames.length > 1 ? `Código ambíguo: ${originUnitNames.join(" / ")}` : "";
    return { year, j: j2, tr, originCode, originUnit, originUnitNames, segment, alias, tribunal: tribunalName(alias, j2, tr), court: alias === "stf" ? "stf" : COURT_FIELD_BY_ALIAS[alias] || "" };
  }
  function render(form, result, field2) {
    const summary = form.querySelector("#cnj-inference");
    if (!summary) return;
    if (!result) {
      summary.textContent = "Informe um CNJ válido para identificar segmento, tribunal e código da unidade de origem. O número não informa o grau nem se o sistema é PJe, eproc ou outro.";
      summary.dataset.level = "";
      const unitField2 = form.elements.namedItem("originUnit");
      if (unitField2) unitField2.value = "";
      return;
    }
    const changed = !!field2?.value && !!result.court && field2.value !== result.court;
    const courtStatus = result.court ? changed ? "Tribunal selecionado preservado para conferência." : field2?.value === result.court ? "Tribunal preenchido pelo CNJ; confira antes de salvar." : "Tribunal identificado; selecione-o na lista para preencher." : "O tribunal foi identificado pelo CNJ, mas não há opção correspondente nesta lista; escolha “Outro tribunal” ou deixe sem classificação.";
    summary.dataset.level = changed ? "warning" : "";
    const unitField = form.elements.namedItem("originUnit");
    const unitMessage = result.originUnitNames.length === 1 ? `Código ${result.originCode}: ${result.originUnitNames[0]}.` : result.originUnitNames.length > 1 ? `Código ${result.originCode} consta com mais de uma designação na tabela (${result.originUnitNames.join(" / ")}); confira no tribunal.` : result.alias === "tjrj" ? `Código ${result.originCode} sem correspondência única na tabela local do TJRJ.` : `A tabela local de unidade não cobre ${result.tribunal}; o código ${result.originCode} permanece sem nome resolvido.`;
    if (unitField) unitField.value = result.originUnitNames.length === 1 ? result.originUnitNames[0] : result.originUnit;
    summary.textContent = `Pelo CNJ: ${result.segment} · ${result.tribunal} · ano ${result.year}. ${unitMessage} ${courtStatus} O número não informa grau nem sistema eletrônico (PJe/eproc/Projudi).`;
  }
  function updateCnjInference(form) {
    const cnjField = form.elements.namedItem("cnj"), courtField = form.elements.namedItem("court");
    if (!cnjField) return null;
    const previous = autoFilledCourt.get(form);
    if (previous && courtField?.value === previous.value && digits(cnjField.value) !== previous.cnj) courtField.value = "";
    const result = inferCnjJurisdiction(cnjField.value);
    if (result?.court && courtField && !courtField.value) {
      courtField.value = result.court;
      autoFilledCourt.set(form, { cnj: digits(cnjField.value), value: result.court });
    } else if (previous && courtField?.value !== previous.value) {
      autoFilledCourt.delete(form);
    }
    render(form, result, courtField);
    return result;
  }

  // djen-lookup.js
  function djenLookupHTML() {
    return '<section class="datajud-lookup" aria-label="Consulta de publicações DJEN"><h3>Publicações do processo · DJEN</h3><button type="button" class="button primary small" data-action="djen-search">Buscar publicações no DJEN</button><p class="muted compact">Consulte pelo CNJ, mesmo antes de salvar o cadastro. A prévia mostra publicações dos últimos 30 dias e não altera os campos do formulário.</p><p id="djen-lookup-status" role="status" aria-live="polite"></p><div id="djen-lookup-results"></div></section>';
  }
  function djenPreviewHTML(events = []) {
    return events.map((e) => `<article class="record"><strong>Publicação DJEN · ${escapeHTML(e.occurredAt)}</strong>${publicationDetailsHTML(e)}<p class="private" style="white-space:pre-wrap">${escapeHTML(e.text)}</p>${/^https:\/\//i.test(e.url || "") ? `<a href="${escapeHTML(e.url)}" target="_blank" rel="noopener noreferrer">Abrir publicação oficial ↗</a>` : ""}</article>`).join("");
  }
  function invalidateDjenLookup(form) {
    form._djenRequest = null;
    const status = form.querySelector("#djen-lookup-status"), results = form.querySelector("#djen-lookup-results");
    if (status) status.textContent = "";
    if (results) results.innerHTML = "";
  }
  async function searchDjen(form, apiPost2, available) {
    const status = form.querySelector("#djen-lookup-status"), results = form.querySelector("#djen-lookup-results");
    const cnj = digits(form.elements.namedItem("cnj")?.value);
    if (!available) {
      status.textContent = "Inicie o painel integrado para consultar o DJEN.";
      return;
    }
    if (!validCnj(cnj)) {
      status.textContent = "Informe um número CNJ válido para consultar o DJEN.";
      return;
    }
    const token = {};
    form._djenRequest = token;
    const button2 = form.querySelector('[data-action="djen-search"]');
    button2.disabled = true;
    status.textContent = "Consultando publicações no DJEN…";
    results.innerHTML = "";
    try {
      const response = await apiPost2("djen/preview", { cnj });
      if (form._djenRequest !== token || digits(form.elements.namedItem("cnj").value) !== cnj) return;
      results.innerHTML = djenPreviewHTML(response.events);
      status.textContent = response.status === "not_found" ? "Nenhuma publicação encontrada nos últimos 30 dias. Isso não significa que o processo não existe." : `${response.events.length} publicação(ões) encontrada(s) nos últimos 30 dias.${response.status === "partial" ? " Resultado parcial; confira a fonte." : ""}`;
    } catch (error) {
      if (form._djenRequest === token) status.textContent = "Consulta DJEN não concluída: " + error.message;
    } finally {
      button2.disabled = false;
    }
  }

  // app.js
  installLoadingIndicators();
  var $ = (selector) => document.querySelector(selector);
  var paths = { home: "M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z", cases: "M3 7h7l2-3h9v16H3Z", clients: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3a4 4 0 0 1 0 8", tasks: "M9 5h12 M9 12h12 M9 19h12 M3 5l1 1 2-2 M3 12l1 1 2-2 M3 19l1 1 2-2", agenda: "M4 5h16v16H4Z M8 3v4 M16 3v4 M4 10h16 M8 14h3 M14 14h2", agendados: "M4 5h16v16H4Z M8 3v4 M16 3v4 M4 10h16 M8 15l2 2 4-4", finance: "M3 5h18v14H3Z M12 8a3 3 0 1 0 0 8 3 3 0 0 0 0-8 M6 9v6 M18 9v6", publications: "M6 3h9l4 4v14H6Z M14 3v6h5 M9 13h7 M9 17h5", sources: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M3 12h2 M19 12h2 M12 3v2 M12 19v2 M5.6 5.6 7 7 M17 17l1.4 1.4 M5.6 18.4 7 17 M17 7l1.4-1.4", privacy: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12 M3 3l18 18", backup: "M5 17v4h14v-4 M12 3v12 M7 10l5 5 5-5", refresh: "M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-1l2 3 M4 15l2 3a7 7 0 0 0 12-1", plus: "M12 5v14 M5 12h14", arrow: "M5 12h14 M13 6l6 6-6 6", check: "M5 12l4 4L19 6" };
  var icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.cases}"/></svg>`;
  var routes = { home: ["Visão geral", "Seu escritório em um só lugar"], cases: ["Processos", "Casos, próximos passos e histórico"], agendados: ["Agendados", "Próximas providências, responsáveis e revisões"], clients: ["Clientes", "Contatos e relacionamentos"], tasks: ["Tarefas", "O trabalho que precisa avançar"], agenda: ["Agenda", "Compromissos confirmados por você"], finance: ["Honorários", "Previsão, recebimentos e saldo"], publications: ["Publicações", "Comunicações disponíveis no DJEN"], sources: ["Fontes e ajustes", "Transparência em cada consulta"] };
  var notificationRoutes = Object.entries(routes);
  Object.keys(routes).forEach((k) => delete routes[k]);
  for (const [k, v] of notificationRoutes) {
    routes[k] = v;
    if (k === "home") routes.notifications = ["Notificações", "Todas as novidades dos processos, em um só lugar"];
  }
  paths.notifications = "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4";
  var statusName = { queued: "Na fila", running: "Consultando", success: "Concluído", not_found: "Não localizado", error: "Falhou", action: "Requer ação", cancelled: "Cancelado", interrupted: "Interrompido" };
  var taskFilter = "open";
  var publicationEvents = [];
  var publicationLoading = false;
  var publicationLoaded = false;
  var publicationError = "";
  var publicationFetched = 0;
  var publicationWriteEpoch = 0;
  var state;
  var route = "home";
  var query = "";
  var filter = "active";
  var caseCourtFilter = "";
  var caseLevelFilter = "";
  var caseSystemFilter = "";
  var scheduledOwner = "all";
  var scheduledSort = "priority";
  var scheduledPage = 1;
  var publicationFilter = "all";
  var publicationLimit = PUBLICATION_BATCH_SIZE;
  var selected = /* @__PURE__ */ new Set();
  var toastTimer;
  var pendingImport = null;
  var pendingWorkbook = null;
  var pendingSheetPlan = null;
  var pendingRestore = null;
  var pendingMonitoring = null;
  var pendingEncrypted = null;
  var pendingDeletion = null;
  var settingsDirty = false;
  var clientName = (id) => state.clients.find((x) => x.id === id)?.name || "Sem cliente vinculado";
  var caseName = (id) => state.cases.find((x) => x.id === id)?.title || "Sem processo vinculado";
  var date = (value) => escapeHTML(safeDateLabel(value));
  var timestamp = (value) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "Ainda não consultado";
  var button = (action2, label2, cls = "secondary", id = "") => `<button class="button ${cls}" data-action="${action2}"${id ? ` data-id="${escapeHTML(id)}"` : ""}>${label2}</button>`;
  var tag = (label2, cls = "") => `<span class="tag ${cls}">${escapeHTML(label2)}</span>`;
  function toast(text) {
    $("#toast").textContent = text;
    $("#toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("#toast").hidden = true, 6500);
  }
  var notificationCenter = new NotificationCenter({
    getState: () => state,
    isIntegrated: () => integrated,
    apiGet,
    apiPost,
    toast,
    openCase: (id) => fullDetail(id),
    markLocal: async (keys, seen) => {
      await mutate((s) => {
        for (const e of s.events) if (keys.has(notificationKey(e))) e.seen = seen;
      });
      state = await readState();
    }
  });
  function showChangelog() {
    dialog("Novidades e histórico", `<p class="subheading">Acompanhe as mudanças do Painel H.B. Estas informações são incluídas no aplicativo e podem ser consultadas sem internet.</p><div class="release-history">${CHANGELOG.map((release, index) => `<details class="release-entry" ${index === 0 ? "open" : ""}><summary><span class="release-summary-text"><strong>v${escapeHTML(release.version)} · ${escapeHTML(release.title)}</strong><small>${release.date ? date(release.date) : "Versão inicial"}</small></span><span class="release-expand">Detalhes</span></summary><p>${escapeHTML(release.summary)}</p><ul>${release.changes.map((change2) => `<li>${escapeHTML(change2)}</li>`).join("")}</ul></details>`).join("")}</div><p class="muted compact">Histórico de funcionalidades. Não indica disponibilidade em tempo real dos tribunais nem a instalação de atualizações automáticas.</p>`);
  }
  function coveragePanel() {
    const summary = coverageSummary(state), recent = [...state.coverageSamples || []].reverse().slice(0, 8);
    const line = (source) => {
      const row = summary.sources[source];
      return `<p class="muted compact"><strong>${source === "djen" ? "DJEN" : "DataJud"}</strong> · ${row.total} comparação(ões) atuais · ${row.match} coincidência(s) relatada(s) · ${row.difference} divergência(s) relatada(s) · ${row.inconclusive + row.unavailable} inconclusiva(s)/indisponível(is)</p>`;
    };
    return `<section class="panel" aria-label="Amostras de cobertura"><div class="panel-heading"><div><h2>Comparação com portais oficiais</h2><p class="muted compact">Registro manual de amostras. Não equivale a cobertura geral, certificação nem atualização automática de processos.</p></div>${button("coverage-new", "Registrar comparação", "secondary")}</div>${line("djen") + line("datajud")}<h3>Histórico recente · ${summary.history}</h3>${recent.map((item) => {
      const c = state.cases.find((c2) => c2.id === item.caseId);
      return `<article class="record"><div class="record-head"><strong>${item.source === "djen" ? "DJEN" : "DataJud"} · ${escapeHTML(COVERAGE_RESULTS[item.result] || "Comparação")}</strong><small>${date(item.referenceDate)} · ${timestamp(item.checkedAt)}</small></div><p class="private compact">${escapeHTML(c?.title || "Processo não encontrado")} · ${escapeHTML(formatCnj(item.cnj))}${c && c.cnj !== item.cnj ? " · CNJ anterior" : ""}</p><p class="private compact">${escapeHTML(item.notes)}</p></article>`;
    }).join("") || '<p class="muted compact">Ainda não há comparações registradas. Comece com um caso público ou autorizado e confira os resultados no portal oficial.</p>'}${summary.history > 8 ? '<p class="muted compact">Exibindo as oito comparações mais recentes. O histórico completo está no backup.</p>' : ""}</section>`;
  }
  function coverageEvidencePanel() {
    const report = coverageEvidenceMatrix(state);
    const cells = report.rows.map((item) => "<tr><td>" + escapeHTML(COURTS[item.court] || "Não informado na amostra") + "</td><td>" + escapeHTML(COURT_LEVELS[item.courtLevel] || "Não informado na amostra") + "</td><td>" + escapeHTML(PROCESS_SYSTEMS[item.processSystem] || "Não informado na amostra") + "</td><td>" + (item.source === "djen" ? "DJEN" : "DataJud") + "</td><td>" + item.cases + "</td><td>" + item.match + "</td><td>" + item.difference + "</td><td>" + item.unavailable + "</td><td>" + item.inconclusive + "</td></tr>").join("");
    const table = report.rows.length ? '<div class="table-wrap"><table><thead><tr><th>Tribunal registrado</th><th>Grau registrado</th><th>Sistema registrado</th><th>Fonte</th><th>Processos na amostra</th><th>Coincidente</th><th>Divergência</th><th>Indisponível</th><th>Inconclusivo</th></tr></thead><tbody>' + cells + "</tbody></table></div>" : '<p class="muted compact">Nenhuma comparação atual foi registrada. Comece com processos públicos ou autorizados.</p>';
    return '<section class="panel" aria-label="Mapa de evidências por tribunal"><h2>Mapa de evidências por tribunal e instância</h2><p class="muted compact">Somente comparações declaradas manualmente. Cada processo entra uma vez por fonte (sua última comparação); repetições não aumentam a quantidade de processos testados. Classificações são as informadas na data da comparação.</p><p class="compact"><strong>' + report.distinctCases + "</strong> processo(s) distintos · <strong>" + report.latestComparisons + "</strong> última(s) comparação(ões) por processo/fonte · <strong>" + report.historical + "</strong> registro(s) históricos</p>" + table + '<p class="muted compact">Sem amostras atuais atribuídas a: ' + escapeHTML(report.noSamples.map((c) => COURTS[c]).join(", ") || "nenhum dos cinco tribunais previstos") + ". " + (report.outdated ? report.outdated + " última(s) comparação(ões) não correspondem mais à classificação ou CNJ da ficha e foram excluídas do mapa, mas permanecem no histórico." : "") + '</p><p class="warning-note">Essas contagens não medem porcentagem de cobertura, confiabilidade de intimações nem completude de andamentos. Amostras antigas sem classificação registrada aparecem como “Não informado”, sem inferência retroativa.</p></section>';
  }
  function readinessPanel() {
    const total = state.cases.length, withoutCourt = state.cases.filter((c) => !c.court).length, withoutIdentifier = state.cases.filter((c) => !c.cnj && !c.docketNumber).length;
    return `<section class="panel" aria-label="Preparação para uso local"><h2>Preparar o uso local</h2><p class="muted compact">O Painel H.B pode ser usado para organização e conferências supervisionadas. Não substitui a consulta oficial dos tribunais nem acompanha automaticamente todos os andamentos.</p><div class="record-list"><article class="record"><strong>1. Conferir a carteira</strong><p class="muted compact">${total} processo(s) cadastrado(s). ${withoutCourt} sem tribunal confirmado; ${withoutIdentifier} sem CNJ ou registro adicional. Cadastros incompletos podem ser organizados, mas não devem ser usados para concluir consultas judiciais.</p><div class="links"><a href="#cases" class="button secondary small">Abrir processos</a></div></article><article class="record"><strong>2. Salvar cópia protegida</strong><p class="muted compact">Não é possível verificar daqui se um backup foi guardado fora do perfil. Exporte com senha e confira o arquivo antes de usar com dados importantes.</p><div class="links">${button("backup-readiness", "Exportar backup com senha", "secondary small")}${button("audit-readiness", "Verificar integridade local", "secondary small")}</div></article><article class="record"><strong>3. Confirmar acesso às fontes</strong><p class="muted compact">DJEN: ${state.settings.djen ? "habilitado" : "desabilitado"}. DataJud: ${state.settings.datajud ? "habilitado, sujeito a limites" : "desabilitado por padrão"}. Faça consultas de teste apenas em processos públicos ou autorizados. A configuração não comprova cobertura.</p><div class="links">${button("source-readiness", "Testar conexão pública", "secondary small")}</div></article></div><p class="warning-note">Antes de usar em um perfil definitivo: mantenha a pasta do painel no mesmo caminho, teste exportação/restauração em perfil temporário e mantenha um procedimento independente para acompanhar intimações e prazos.</p></section>`;
  }
  function simplifySourceLimitations() {
    const panel2 = [...document.querySelectorAll("#content .panel")].find((item) => item.querySelector("h2")?.textContent === "Alcance desta versão");
    if (!panel2) return;
    panel2.id = "source-technical-info";
    panel2.innerHTML = `<h2>O que cada fonte realmente oferece</h2>
    <p class="muted compact"><strong>DataJud:</strong> metadados e movimentações públicas por número CNJ nos tribunais com endpoint documentado, incluindo TJs, TRFs, TRTs e TREs. A integração não consulta diretamente PJe, eproc ou Projudi.</p>
    <p class="muted compact"><strong>DJEN:</strong> publicações por CNJ ou OAB/UF, somente no intervalo escolhido.</p>
    <details class="technical-disclosure"><summary>Limitações técnicas e como proceder</summary>
      <ul class="source-limits">
        <li><strong>Descobrir processos por CPF/CNPJ:</strong> a API pública usada não oferece pesquisa nacional por documento. Cadastre os números CNJ conhecidos ou importe uma carteira por planilha; consulte os canais oficiais para localizar outros processos.</li>
        <li><strong>PJe, eproc e Projudi:</strong> use o DataJud para metadados públicos por CNJ e os portais oficiais para conferir peças e movimentações ausentes. Integrações diretas dependem de cada tribunal.</li>
        <li><strong>Jus.br/PDPJ e autos restritos:</strong> acesso apenas com credenciais e autorização do titular, pelo portal oficial. O Painel H.B não captura sessões nem contorna autenticação.</li>
        <li><strong>CAPTCHA:</strong> quando exigido pelo tribunal, resolva manualmente no portal. O Painel H.B não o burla.</li>
        <li><strong>Computador desligado:</strong> o serviço Python precisa permanecer em execução em um computador ativo. Para monitorar 24 horas, seria necessária infraestrutura hospedada com segurança própria.</li>
        <li><strong>Resultado concluído:</strong> comprova somente a resposta da fonte e o período consultado, nunca a totalidade dos autos, intimações ou prazos.</li>
      </ul>
      <p class="muted compact"><a href="https://datajud-wiki.cnj.jus.br/api-publica/endpoints/" target="_blank" rel="noopener noreferrer">Tribunais atendidos pelo DataJud (CNJ)</a> · <a href="https://docs.pdpj.jus.br/" target="_blank" rel="noopener noreferrer">Documentação PDPJ-Br</a></p>
      <p class="muted compact">Painel H.B ${VERSION} · dados locais. Testes simulados e testes de conexão real são verificações diferentes.</p>
    </details>`;
  }
  function coverageJobHint() {
    const form = $("#coverage-form");
    if (!form) return;
    const job = latestCoverageJob(state, form.elements.caseId.value, form.elements.source.value);
    form.querySelector("#coverage-job-hint").textContent = job ? `Última consulta local: ${statusName[job.status]} em ${timestamp(job.updatedAt)}. É um resultado de fonte pública, não uma comparação automática.` : "Nenhuma consulta concluída desta fonte para o CNJ atual. Você pode registrar indisponibilidade ou resultado inconclusivo; para coincidência/divergência, consulte primeiro pelo botão Atualizar.";
  }
  function coverageDialog() {
    const cases = state.cases.filter((c) => validCnj(c.cnj));
    if (!cases.length) throw Error("Cadastre um processo com CNJ válido antes de registrar uma comparação.");
    dialog("Registrar comparação de cobertura", `<form id="coverage-form"><p class="subheading">Depois de consultar o portal oficial, registre o que foi comparado com DJEN ou DataJud. É uma declaração manual, não uma validação automática de todos os atos.</p><div class="form-grid">${select("Processo com CNJ *", "caseId", cases.map((c) => [c.id, `${c.title} · ${formatCnj(c.cnj)}`]))}${select("Fonte local comparada *", "source", [["djen", "DJEN · publicações"], ["datajud", "DataJud · metadados/movimentos"]])}${select("Resultado observado *", "result", Object.entries(COVERAGE_RESULTS), "inconclusive")}${field("Data da consulta ao portal oficial *", "referenceDate", dateKey(), "date", false, "required")}<p class="muted compact full" id="coverage-job-hint" role="status"></p><label class="field full">O que foi comparado e onde? *<textarea name="notes" required minlength="12" maxlength="1500" placeholder="Ex.: Conferi a publicação de referência no portal oficial em 05/11/2026. A data e o teor..."></textarea></label></div><p class="form-error" role="alert"></p><div class="form-actions"><button type="button" class="button ghost" data-action="close">Cancelar</button><button type="submit" class="button primary">Registrar comparação manual</button></div></form>`);
    coverageJobHint();
  }
  async function showLocalAudit() {
    dialog("Diagnóstico de integridade local", '<p role="status">Verificando os registros e arquivos locais, sem alterar dados...</p>');
    const data = auditLocalData(await readState());
    const attachments = await auditLocalAttachments();
    const problems = [...data.issues];
    for (const [label2, count] of [["Anexos ausentes no armazenamento", attachments.missing], ["Anexos com tamanho ou hash divergente", attachments.corrupted], ["Arquivos sem registro correspondente", attachments.unreferenced]]) if (count) problems.push({ label: label2, count });
    const result = problems.length ? `<div class="warning-note"><strong>${problems.length} tipo(s) de divergência encontrado(s).</strong><p>Exporte um backup protegido e examine os registros antes de qualquer alteração.</p></div><ul class="source-limits">${problems.map((item) => `<li>${escapeHTML(item.label)}: ${item.count}</li>`).join("")}</ul>` : '<p class="notice">Nenhuma divergência detectada nas verificações locais disponíveis.</p>';
    if (!$("#editor").open || $("#dialog-title").textContent !== "Diagnóstico de integridade local") return;
    $("#dialog-body").innerHTML = `<p class="subheading">Verificação somente de leitura. Não modifica cadastros, não inicia consultas judiciais e não envia informações para servidores.</p><p class="muted compact">Verificados: ${data.counts.cases} processos, ${data.counts.clients} clientes, ${data.counts.events} registros de fontes, ${data.counts.fees} honorários e ${data.counts.documents} anexos. ${attachments.checked} anexo(s) com hash confirmado.</p>${result}<p class="muted compact">A verificação identifica algumas inconsistências estruturais e dos arquivos locais. Não valida os atos judiciais, não substitui um backup e não garante ausência de outros problemas.</p><div class="form-actions"><button type="button" class="button ghost" data-action="close">Fechar</button>${button("backup", "Exportar backup", "primary")}</div>`;
  }
  async function showSourceDiagnostics() {
    if (integrated) {
      dialog("Conexão com as fontes públicas", '<p class="subheading" role="status">Consultando as APIs públicas diretamente pelo serviço Python, sem enviar CNJ, OAB ou dados da carteira...</p>');
      try {
        const [status, diagnostics] = await Promise.all([apiGet("status"), apiPost("diagnostics")]);
        const labels3 = { reachable: "Conectividade confirmada", unavailable: "Indisponível", rate_limited: "Limite de consultas (HTTP 429)", auth_required: "Chave inválida ou exigida", access_denied: "Acesso negado", incompatible: "Formato inesperado", unsupported: "Não suportado" };
        if (!$("#editor").open || $("#dialog-title").textContent !== "Conexão com as fontes públicas") return;
        $("#dialog-body").innerHTML = '<p class="notice">Serviço Python conectado · contrato v' + escapeHTML(status.contractVersion) + '</p><div class="release-history">' + diagnostics.results.map((item) => '<div class="release-entry"><strong>' + escapeHTML(item.source === "djen" ? "DJEN" : "DataJud") + " · " + escapeHTML(labels3[item.status] || item.status) + "</strong><p>" + escapeHTML(item.message) + "</p></div>").join("") + '</div><p class="muted compact">O teste usa uma consulta vazia ao DataJud e uma consulta mínima ao DJEN, sem dados da carteira; descarta o conteúdo retornado. Resposta válida confirma somente conexão e formato, não cobertura, movimentações ou resultados por processo.</p>';
      } catch (e) {
        $("#dialog-body").textContent = "Não foi possível conectar: " + e.message;
      }
      return;
    }
    dialog("Verificar conectividade das fontes", '<p class="subheading" role="status">Consultando DJEN e DataJud com um CNJ sintético, sem usar a carteira ou alterar o banco local. A conexão pode demorar ou falhar.</p><p class="muted compact">O painel roda direto do arquivo local, sem servidor. O DJEN permite acesso direto; o DataJud pode ser bloqueado pelo navegador por CORS.</p>');
    const settings = { ...state.settings };
    const report = await checkSourceConnectivity(settings, (url, options) => transport(url, options, settings));
    if (!$("#editor").open || $("#dialog-title").textContent !== "Verificar conectividade das fontes") return;
    const labels2 = { reachable: "Resposta válida", limited: "Limite de acesso", blocked: "Acesso recusado", unavailable: "Não validada", configuration: "Falta configuração" };
    $("#dialog-body").innerHTML = `<p class="subheading">Teste realizado em ${timestamp(report.testedAt)}. Somente CNJ sintético; nenhuma consulta da carteira foi efetuada.</p><div class="release-history">${report.results.map((x) => `<div class="release-entry"><strong>${x.source === "djen" ? "DJEN" : "DataJud"} · ${labels2[x.status]}</strong><p>${escapeHTML(x.message)}</p></div>`).join("")}</div><p class="muted compact">Uma resposta válida comprova somente o acesso e o formato deste teste. Não confirma publicações, movimentos, cobertura dos tribunais nem a atualização dos processos cadastrados.</p><p class="warning-note">Sem servidor e sem auxiliar nativo, o DataJud costuma falhar por CORS no modo arquivo local. O DJEN funciona diretamente porque a API pública libera a origem. As falhas aparecem no histórico de consultas e não apagam dados.</p><div class="form-actions"><button type="button" class="button ghost" data-action="close">Fechar</button></div>`;
  }
  async function send(type, extra = {}) {
    if (integrated) return serverCommand(type, extra, state);
    if (type === "resume") return {};
    if (type === "cancel") return handle(type, extra);
    throw Error("Consultas indisponíveis no HTML direto. Abra ABRIR-PAINEL-INTEGRADO.cmd e mantenha o serviço Python ativo.");
  }
  var formBaselines = /* @__PURE__ */ new WeakMap();
  function formSnapshot(form) {
    return JSON.stringify([...form.querySelectorAll("input[name],select[name],textarea[name]")].map((x) => [x.name, x.type === "checkbox" || x.type === "radio" ? x.checked : x.value, x.disabled]));
  }
  function rememberForm(form) {
    if (form) formBaselines.set(form, formSnapshot(form));
  }
  function formChanged(form) {
    return !!form && formBaselines.has(form) && formBaselines.get(form) !== formSnapshot(form);
  }
  function updateSettingsDirty() {
    settingsDirty = ["settings-form", "auto-form"].some((id) => formChanged(document.getElementById(id)));
  }
  function editorChanged() {
    return !!document.getElementById("editor")?.open && [...document.querySelectorAll("#editor form")].some(formChanged);
  }
  async function refresh(force = false) {
    const next = await readState();
    if (!force && state?.revision === next.revision) return;
    state = next;
    if (integrated && serviceOnline) void syncBrowser(state).catch((error) => console.warn("Painel H.B: sincronização do índice de processos não concluída:", error.message));
    if (route === "sources" && settingsDirty && document.querySelector("#settings-form")) return;
    render2();
  }
  async function change(fn, message) {
    await mutate(fn);
    await refresh(true);
    if (message) toast(message);
  }
  function empty2(title, text, action2, label2) {
    return `<div class="empty"><span class="empty-symbol">${icon(route)}</span><h2>${escapeHTML(title)}</h2><p>${escapeHTML(text)}</p>${action2 ? button(action2, escapeHTML(label2), "primary") : ""}</div>`;
  }
  function panel(title, body, toolbar2 = "") {
    return `<section class="panel"><div class="panel-heading"><h2>${title}</h2><div class="toolbar">${toolbar2}</div></div>${body}</section>`;
  }
  function metric(title, value, note, featured = false, type = "finance") {
    return `<article class="metric ${featured ? "featured" : ""}"><div class="metric-icon">${icon(type)}</div><p>${escapeHTML(title)}</p><strong class="private">${escapeHTML(value)}</strong><small>${escapeHTML(note)}</small></article>`;
  }
  function metrics() {
    const o2 = overview(state);
    return `<section class="metrics" aria-label="Indicadores">${metric("Honorários previstos", money(o2.expected), "Total dos honorários cadastrados", true)}${metric("Já recebido", money(o2.received), "Recebimentos informados por você")}${metric("A receber", money(o2.balance), "Saldo dos honorários cadastrados")}<a href="#notifications" class="notification-metric-link">${metric("Novidades para conferir", notificationCenter.rows().filter((e) => !e.seen).length, "Abrir central de notificações", "", "notifications").replace('<strong class="private">', '<strong class="private" data-notification-metric>')}</a></section>`;
  }
  function toolbar() {
    return `<input class="search" data-filter="search" aria-label="Buscar registros" placeholder="Buscar por cliente, processo ou assunto…" value="${escapeHTML(query)}">`;
  }
  function filteredCases() {
    return state.cases.filter((c) => (filter === "archived" ? c.archived : !c.archived) && (caseCourtFilter === "" || (c.court || "") === (caseCourtFilter === "unknown" ? "" : caseCourtFilter)) && (caseLevelFilter === "" || (c.courtLevel || "") === (caseLevelFilter === "unknown" ? "" : caseLevelFilter)) && (caseSystemFilter === "" || (c.processSystem || "") === (caseSystemFilter === "unknown" ? "" : caseSystemFilter)) && `${c.title} ${c.cnj} ${formatCnj(c.cnj)} ${clientName(c.clientId)} ${c.area} ${COURTS[c.court || ""]} ${COURT_LEVELS[c.courtLevel || ""]} ${PROCESS_SYSTEMS[c.processSystem || ""]} ${c.docketNumber || ""}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));
  }
  function lastResult(c) {
    const jobs = state.jobs.filter((j2) => j2.caseId === c.id).slice(-2);
    return jobs.length ? jobs.map((j2) => `${j2.source === "datajud" ? "DataJud" : "DJEN"}: ${statusName[j2.status]}`).join(" · ") : "Ainda não consultado";
  }
  var jurisdictionLabel = (c) => [COURTS[c.court || ""], COURT_LEVELS[c.courtLevel || ""], PROCESS_SYSTEMS[c.processSystem || ""]].filter((x) => x && x !== "Não informado").join(" · ");
  function casesPanel() {
    const rows = filteredCases();
    const tabs = `<div class="panel-heading"><div class="segments"><button data-action="filter-active" class="${filter === "active" ? "active" : ""}">Ativos</button><button data-action="filter-archived" class="${filter === "archived" ? "active" : ""}">Arquivados</button></div><div class="line-actions">${button("import-spreadsheet", "Importar Excel/CSV", "secondary small")}${button("import-cnj", "Colar CNJs", "ghost small")}${button("template-csv", "Modelo CSV vazio", "ghost small")}${state.cases.length ? button("export-portfolio", "Exportar carteira CSV", "secondary small") : ""}${selected.size ? `<span class="selection-count" role="status">${selected.size} selecionado(s)</span>${filter === "archived" ? button("unarchive-selected", "Desarquivar", "secondary small") : button("archive-selected", "Arquivar", "secondary small")}${filter === "active" ? button("update-selected", "Atualizar selecionados", "primary small") : ""}${button("delete-selected", "Deletar", "danger small")}` : ""}</div></div>`;
    const options = (items, value) => items.map(([key, label2]) => `<option value="${escapeHTML(key)}" ${key === value ? "selected" : ""}>${escapeHTML(label2)}</option>`).join("");
    const filters = `<div class="case-filters" aria-label="Filtros da carteira"><label>Tribunal<select data-case-filter="court" aria-label="Filtrar tribunal">${options([["", "Todos os tribunais"], ["unknown", "Não informado"], ...Object.entries(COURTS).filter(([key]) => key)], caseCourtFilter)}</select></label><label>Grau<select data-case-filter="level" aria-label="Filtrar grau">${options([["", "Todos os graus"], ["unknown", "Não informado"], ...Object.entries(COURT_LEVELS).filter(([key]) => key)], caseLevelFilter)}</select></label><label>Sistema<select data-case-filter="system" aria-label="Filtrar sistema">${options([["", "Todos os sistemas"], ["unknown", "Não informado"], ...Object.entries(PROCESS_SYSTEMS).filter(([key]) => key)], caseSystemFilter)}</select></label>${caseCourtFilter || caseLevelFilter || caseSystemFilter ? button("clear-case-filters", "Limpar filtros", "ghost small") : ""}</div>`;
    let body;
    if (!state.cases.length) body = empty2("Seu painel começa aqui", "Cadastre um caso ou importe números CNJ. As consultas só começam quando você clicar em atualizar.", "new-cases", "Cadastrar primeiro caso");
    else if (!rows.length) body = empty2("Nenhum caso nesta seleção", "Altere a busca ou o filtro para encontrar seus registros.");
    else body = `<div class="table-wrap"><table class="cases-list"><thead><tr><th><span class="sr-only">Selecionar</span></th><th>Processo / cliente</th><th>Etapa</th><th>Revisão</th><th>Últimas consultas</th><th>Ações</th></tr></thead><tbody>${rows.map((c) => `<tr><td><input type="checkbox" aria-label="Selecionar ${escapeHTML(c.title)}" data-select="${escapeHTML(c.id)}" ${selected.has(c.id) ? "checked" : ""}></td><td><button class="cell-title private" data-action="detail" data-id="${escapeHTML(c.id)}">${escapeHTML(c.title)}</button><small class="private">${escapeHTML(c.cnj ? formatCnj(c.cnj) : c.docketNumber ? "Registro " + c.docketNumber : "Sem CNJ")} · ${escapeHTML(clientName(c.clientId))}</small></td><td>${tag(STAGES[c.stage])}</td><td>${date(c.review)}</td><td><small>${escapeHTML(lastResult(c))}</small></td><td><div class="line-actions">${c.archived ? button("archive", "Desarquivar", "secondary small", c.id) : c.cnj ? button("djen-process", "Buscar no DJEN", "primary small", c.id) : ""}${button("edit-cases", "Editar", "ghost small", c.id)}</div></td></tr>`).join("")}</tbody></table></div>`;
    return panel('Sua carteira <span class="pill">' + rows.length + "</span>", tabs + filters + body, toolbar());
  }
  function agendadosPanel() {
    const model = scheduledCases(state.cases, { owner: scheduledOwner, query, sort: scheduledSort, today: dateKey(), clientName });
    const ordered = Object.values(model.groups).flat(), pageSize = 15, pages = Math.max(1, Math.ceil(ordered.length / pageSize));
    scheduledPage = Math.max(1, Math.min(pages, scheduledPage));
    const visibleIds = new Set(ordered.slice((scheduledPage - 1) * pageSize, scheduledPage * pageSize).map((c) => c.id));
    const options = [["all", "Todos"], ...Object.entries(WORK_OWNERS)].map(([key, label2]) => `<button type="button" data-action="scheduled-owner" data-id="${key}" class="agendados-owner ${key === scheduledOwner ? "active" : ""}" aria-pressed="${key === scheduledOwner}">${escapeHTML(label2)} <span>${model.counts[key]}</span></button>`).join("");
    const overview2 = `<div class="agendados-overview" aria-label="Resumo de revisões"><div><strong>${model.overview.overdue}</strong><span>Atrasadas</span></div><div><strong>${model.overview.today}</strong><span>Revisar hoje</span></div><div><strong>${model.overview.week}</strong><span>Próximos 7 dias</span></div><div><strong>${model.overview.pending}</strong><span>Pendências abertas</span></div></div>`;
    const filters = `<div class="agendados-toolbar"><div class="agendados-owners" role="group" aria-label="Responsável pela próxima ação">${options}</div><div class="agendados-toolbar-right"><label class="field">Buscar processo ou providência<input class="search" data-filter="search" aria-label="Buscar nos agendados" placeholder="Cliente, CNJ, próximo passo…" value="${escapeHTML(query)}"></label><label class="field">Ordenar por<select data-scheduled-sort="true" aria-label="Ordenar agendados">${Object.entries(SCHEDULE_SORTS).map(([key, label2]) => `<option value="${key}" ${scheduledSort === key ? "selected" : ""}>${escapeHTML(label2)}</option>`).join("")}</select></label></div></div>`;
    const groups = Object.entries(model.groups).map(([key, rows]) => [key, rows.filter((c) => visibleIds.has(c.id))]).filter(([, rows]) => rows.length).map(([key, rows]) => `<section class="agendados-group" aria-label="${escapeHTML(SCHEDULE_GROUPS[key])}"><div class="agendados-group-heading"><h3>${escapeHTML(SCHEDULE_GROUPS[key])}</h3><span>${rows.length}</span></div><div class="agendados-list">${rows.map((c) => {
      const pending = (c.pendingItems || []).filter((item) => !item.done).length, viewedToday = c.reviewedAt && dateKey(new Date(c.reviewedAt)) === dateKey(), owner = c.workOwner || "me", status = c.workStatus || "todo";
      return `<article class="agendados-row"><div class="agendados-case"><button class="cell-title private" data-action="detail" data-id="${escapeHTML(c.id)}">${escapeHTML(c.title)}</button><small class="private">${escapeHTML(clientName(c.clientId))} · ${escapeHTML(c.cnj ? formatCnj(c.cnj) : c.docketNumber || "Sem CNJ")}</small></div><div class="agendados-status">${tag(WORK_OWNERS[owner] || WORK_OWNERS.me, "")}${tag(WORK_STATUSES[status] || WORK_STATUSES.todo, status === "ready" ? "action" : status === "done" ? "success" : "")}</div><div class="agendados-next"><strong class="private">${escapeHTML(c.nextStep || "Próximo passo ainda não definido")}</strong><small>${escapeHTML(c.area || "Área não informada")} · ${escapeHTML(PROCESS_SYSTEMS[c.processSystem || ""] || "Sistema não informado")}</small>${pending ? `<span class="agendados-pending">${pending} pendência(s) aberta(s)</span>` : ""}</div><div class="agendados-review"><strong>${c.review ? date(c.review) : "Sem data"}</strong><small>${c.reviewedAt ? "Visto: " + timestamp(c.reviewedAt) : "Ainda não visto"}</small></div><div class="agendados-actions">${button("detail", "Abrir ficha", "secondary small", c.id)}${button("workflow-viewed", viewedToday ? "Visto hoje ✓" : "Marcar visto", "ghost small", c.id)}</div></article>`;
    }).join("")}</div></section>`).join("");
    const emptyMessage = state.cases.some((c) => !c.archived) ? '<div class="empty"><h2>Nenhum processo neste filtro</h2><p>Altere o responsável ou o termo pesquisado.</p></div>' : empty2("Organize suas revisões", "Cadastre o primeiro processo. Depois registre o próximo passo, responsável e data de revisão.", "new-cases", "Cadastrar processo");
    const paging = model.total ? `<div class="agendados-footer"><span>Mostrando ${(scheduledPage - 1) * pageSize + 1} a ${Math.min(scheduledPage * pageSize, model.total)} de ${model.total} processo(s)</span><div class="line-actions"><button class="button ghost small" data-action="scheduled-prev" ${scheduledPage <= 1 ? "disabled" : ""}>Anterior</button><span class="muted compact">${scheduledPage} de ${pages}</span><button class="button secondary small" data-action="scheduled-next" ${scheduledPage >= pages ? "disabled" : ""}>Próxima</button></div></div>` : "";
    return '<p class="intro-note">As revisões e providências são planejadas manualmente. “Visto” é um controle interno e não representa ciência de intimação nem contagem automática de prazo judicial.</p>' + overview2 + panel(`Agendados <span class="pill">${model.total}</span>`, filters + (groups || emptyMessage) + paging);
  }
  function home() {
    const today = dateKey(), due = [...state.appointments.filter((a) => a.when?.slice(0, 10) === today).map((a) => ({ title: a.title, sub: "Compromisso · " + a.when.slice(11, 16), action: "edit-appointments", id: a.id })), ...state.tasks.filter((t) => t.due && t.due <= today && t.stage !== "done").map((t) => ({ title: t.title, sub: "Tarefa · " + caseName(t.caseId), action: "edit-tasks", id: t.id })), ...state.cases.filter((c) => !c.archived && c.review && c.review <= today).map((c) => ({ title: c.title, sub: "Revisão agendada para " + date(c.review), action: "detail", id: c.id }))];
    const attention = `<section class="attention"><div class="attention-heading"><div><p class="eyebrow">HOJE</p><h2>O que pede atenção</h2></div><span class="pill">${due.length} ponto(s) de atenção</span></div>${due.length ? due.slice(0, 5).map((d) => `<div class="attention-row"><span class="round-icon">${icon("arrow")}</span><div><p class="private">${escapeHTML(d.title)}</p><small class="private">${escapeHTML(d.sub)}</small></div>${button(d.action, "Abrir", "ghost small", d.id)}</div>`).join("") : '<div class="attention-row"><span class="round-icon">' + icon("check") + "</span><div><p>Nenhuma pendência para hoje</p><small>Revisões e tarefas cadastradas aparecem aqui.</small></div></div>"}</section>`;
    const pending = pendingManualReviews(state);
    const reviews = pending.length ? `<section class="attention" aria-label="Conferências pendentes"><div class="attention-heading"><div><p class="eyebrow">CONFERÊNCIAS MANUAIS</p><h2>Resultados para encaminhar</h2></div><span class="pill">${pending.length} pendência(s)</span></div>${pending.slice(0, 5).map((x) => `<div class="attention-row"><span class="round-icon">${icon("arrow")}</span><div><p class="private">${escapeHTML(caseName(x.caseId))}</p><small class="private">${escapeHTML(MANUAL_CHECK_RESULTS[x.result])} · ${timestamp(x.checkedAt)} · ${escapeHTML(x.notes.slice(0, 120))}</small></div><div class="line-actions">${button("task-from-check", "Criar tarefa", "secondary small", x.checkId)}${button("detail", "Abrir processo", "ghost small", x.caseId)}</div></div>`).join("")}${pending.length > 5 ? '<p class="muted compact">Exibindo as cinco conferências mais recentes sem tarefa vinculada.</p>' : ""}<p class="muted compact">As conferências são registros feitos por você, não prazos calculados automaticamente.</p></section>` : "";
    const issues = pendingSourceIssues(state);
    const failures = issues.length ? `<section class="attention" aria-label="Falhas nas fontes"><div class="attention-heading"><div><p class="eyebrow">CONSULTAS AUTOMÁTICAS</p><h2>Fontes que precisam de atenção</h2></div><span class="pill">${issues.length} fonte(s)</span></div>${issues.slice(0, 5).map((x) => `<div class="attention-row"><span class="round-icon">${icon("refresh")}</span><div><p class="private">${escapeHTML(caseName(x.caseId))} · ${x.source === "datajud" ? "DataJud" : "DJEN"}</p><small class="private">${escapeHTML(statusName[x.status])} · ${timestamp(x.updatedAt)} · ${escapeHTML(x.message.slice(0, 140))}${x.partial ? " · Resultado parcial" : ""}${x.retrying ? " · Nova tentativa em andamento" : ""}</small></div><div class="line-actions">${!x.retrying ? button("retry-source", "Tentar novamente", "secondary small", x.jobId) : ""}${button("detail", "Abrir processo", "ghost small", x.caseId)}</div></div>`).join("")}${issues.length > 5 ? '<p class="muted compact">Exibindo cinco fontes com falhas não resolvidas. Veja o histórico completo em Fontes e ajustes.</p>' : ""}<p class="muted compact">Falhas anteriores permanecem até uma consulta posterior ser concluída na mesma fonte. Resultados não encontrados não são tratados como erro.</p></section>` : "";
    const oabIssue = pendingOabIssue(state);
    const oabFailure = oabIssue ? `<section class="attention" aria-label="Falha na busca OAB"><div class="attention-heading"><div><p class="eyebrow">PUBLICAÇÕES DJEN</p><h2>Busca por OAB precisa de atenção</h2></div><span class="pill">1 busca</span></div><div class="attention-row"><span class="round-icon">${icon("refresh")}</span><div><p class="private">OAB ${escapeHTML(oabIssue.oab)}/${escapeHTML(oabIssue.ufOab)}</p><small class="private">${escapeHTML(statusName[oabIssue.status])} · ${timestamp(oabIssue.updatedAt)} · ${escapeHTML(oabIssue.message.slice(0, 140))}${oabIssue.partial ? " · Resultado parcial" : ""}${oabIssue.retrying ? " · Nova tentativa em andamento" : ""}</small></div><div class="line-actions">${!oabIssue.retrying ? button("retry-oab", "Tentar novamente", "secondary small", oabIssue.jobId) : ""}${button("open-sources", "Ver histórico", "ghost small")}</div></div><p class="muted compact">A retentativa usa a mesma OAB/UF e, quando disponível, o período anterior. Não garante uma consulta completa.</p></section>` : "";
    const attentionCases = state.cases.filter((c) => !c.archived && (c.nextStep || c.review)).slice(0, 5);
    const attentionList = attentionCases.length ? '<div class="record-list home-attention-list">' + attentionCases.map((c) => '<article class="record">' + button("detail", escapeHTML(c.title), "ghost small", c.id) + '<p class="private">' + escapeHTML(c.nextStep || "Revisão: " + safeDateLabel(c.review)) + "</p></article>").join("") + "</div>" : '<p class="muted">Nenhum processo com próximo passo ou revisão cadastrados.</p>';
    return attention + reviews + '<section class="panel"><h2>Novidades dos processos</h2><p>Confira movimentações e publicações na central.</p><a class="button secondary" href="#notifications">Abrir Notificações</a></section>' + failures + oabFailure + panel("Processos em atenção", attentionList, '<a class="button secondary small" href="#cases">Ver todos os processos ' + icon("arrow") + "</a>") + metrics();
  }
  function clients() {
    const rows = state.clients.filter((x) => `${x.name} ${x.email} ${x.phone}`.toLowerCase().includes(query.toLowerCase()));
    return panel("Relacionamentos", rows.length ? `<div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Contato</th><th>Casos</th><th></th></tr></thead><tbody>${rows.map((c) => `<tr><td><strong class="private">${escapeHTML(c.name)}</strong><small class="private">${escapeHTML(c.notes).slice(0, 120)}</small></td><td><span class="private">${escapeHTML(c.email || "—")}</span><small class="private">${escapeHTML(c.phone || "Sem telefone")}</small></td><td>${state.cases.filter((x) => x.clientId === c.id).length}</td><td><div class="line-actions">${button("edit-clients", "Editar", "ghost small", c.id)}${digits(c.phone).length >= 10 ? `<a class="button secondary small" href="https://wa.me/${digits(c.phone).startsWith("55") ? digits(c.phone) : "55" + digits(c.phone)}" target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>` : ""}</div></td></tr>`).join("")}</tbody></table></div>` : empty2("Contatos com contexto", "Reúna seus clientes e associe cada um aos casos que acompanha.", "new-clients", "Cadastrar cliente"), `<input class="search" data-filter="search" aria-label="Buscar registros" placeholder="Buscar cliente…" value="${escapeHTML(query)}">`);
  }
  function tasks() {
    const { counts, rows } = taskView(state.tasks, query, taskFilter);
    const matched = { length: counts.all };
    const tabs = `<div class="publication-filters" role="group" aria-label="Filtrar tarefas">${Object.entries({ open: "Em aberto", done: "Concluídas", all: "Todas" }).map(([key, label2]) => `<button type="button" class="publication-filter ${taskFilter === key ? "active" : ""}" data-action="task-filter" data-id="${key}" aria-pressed="${taskFilter === key}">${label2} <span>${counts[key]}</span></button>`).join("")}</div>`;
    return panel("Próximos passos", tabs + (rows.length ? `<div class="record-list">${rows.sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999")).map((t) => `<article class="record"><div class="record-head"><div><h3 class="private">${escapeHTML(t.title)}</h3><small class="private">${escapeHTML(caseName(t.caseId))}</small></div><div class="line-actions">${tag(STAGES[t.stage])}${button("complete-task", t.stage === "done" ? "Reabrir" : "Concluir", "secondary small", t.id)}${button("edit-tasks", "Editar", "ghost small", t.id)}</div></div><div class="meta"><span>${t.due ? "Vencimento: " + date(t.due) : "Sem vencimento"}</span></div>${t.notes ? `<p class="private">${escapeHTML(t.notes)}</p>` : ""}</article>`).join("")}</div>` : matched.length ? '<div class="empty"><h2>Nenhuma tarefa neste filtro</h2><p>Escolha outro estado para ver as demais tarefas.</p></div>' : query ? '<div class="empty"><h2>Nenhuma tarefa encontrada</h2><p>Altere a busca para ver as tarefas cadastradas.</p></div>' : empty2("Cada caso, um próximo passo", "Cadastre tarefas, defina a etapa e acompanhe o que precisa ser feito.", "new-tasks", "Criar tarefa")), `<input type="search" class="search" data-filter="search" aria-label="Buscar tarefas" placeholder="Buscar tarefas…" value="${escapeHTML(query)}">`);
  }
  function agenda() {
    const rows = [...state.appointments].sort((a, b) => a.when.localeCompare(b.when));
    return '<div class="intro-note">Compromissos informados por você. Esta versão não calcula prazos processuais automaticamente. Horários de Brasília.</div>' + panel("Compromissos", rows.length ? `<div class="record-list">${rows.map((a) => `<article class="record calendar-record"><div class="date-block">${date(a.when)}<br><strong>${escapeHTML(a.when.slice(11))}</strong></div><div class="record-main"><h3 class="private">${escapeHTML(a.title)}</h3><small>${escapeHTML(a.kind || "Compromisso")} · <span class="private">${escapeHTML(caseName(a.caseId))}</span></small>${a.notes ? `<p class="private">${escapeHTML(a.notes)}</p>` : ""}</div>${button("edit-appointments", "Editar", "ghost small", a.id)}</article>`).join("")}</div>` : empty2("Espaço para o que vem a seguir", "Cadastre audiências, reuniões, revisões e prazos que você já confirmou.", "new-appointments", "Agendar compromisso"));
  }
  function finance() {
    return metrics() + panel("Honorários cadastrados", state.fees.length ? `<div class="table-wrap"><table><thead><tr><th>Honorário / caso</th><th>Vencimento</th><th>Total</th><th>Recebido</th><th>Saldo</th><th></th></tr></thead><tbody>${state.fees.map((f) => `<tr><td><strong class="private">${escapeHTML(f.title)}</strong><small class="private">${escapeHTML(caseName(f.caseId))}</small></td><td>${date(f.due)}</td><td class="private">${money(f.amount)}</td><td class="private">${money(f.paid)}</td><td class="private">${money(f.amount - f.paid)}</td><td><div class="line-actions">${button("payments", "Recebimentos", "secondary small", f.id)}${button("edit-fees", "Editar", "ghost small", f.id)}</div></td></tr>`).join("")}</tbody></table></div>` : empty2("Seu financeiro, com clareza", "Registre honorários e cada recebimento, preservando o histórico de estornos.", "new-fees", "Cadastrar honorário"));
  }
  function paymentDialog(id) {
    const fee = state.fees.find((f) => f.id === id);
    if (!fee) return;
    const entries = state.payments.filter((p2) => p2.feeId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    dialog("Recebimentos · " + fee.title, `<p class="subheading private">Total ${money(fee.amount)} · Recebido ${money(fee.paid)} · Saldo ${money(fee.amount - fee.paid)}</p>${fee.paid < fee.amount ? `<form id="payment-form" data-id="${escapeHTML(id)}"><div class="form-grid">${field("Valor recebido (R$)", "amount", "", "number", false, `required min="0.01" max="${((fee.amount - fee.paid) / 100).toFixed(2)}" step="0.01"`)}${field("Data do recebimento", "date", dateKey(), "date", false, "required")}${area("Observações", "notes")}</div><p class="form-error" role="alert"></p><div class="form-actions"><button class="button primary" type="submit">Registrar recebimento</button></div></form>` : '<div class="intro-note">Honorário integralmente recebido.</div>'}<div class="detail-section"><h3>Histórico de lançamentos</h3>${entries.map((p2) => `<article class="record"><div class="record-head"><div><h3>${p2.kind === "reversal" ? "Estorno" : "Recebimento"} · <span class="private">${p2.kind === "reversal" ? "− " : ""}${money(p2.amount)}</span></h3><small>${date(p2.date)}${p2.opening ? " · Saldo importado da 0.1" : ""}</small></div>${p2.kind === "receipt" ? state.payments.some((x) => x.reverses === p2.id) ? tag("Estornado") : button("reverse-payment", "Estornar", "ghost small", p2.id) : tag("Estorno")}</div><p class="private">${escapeHTML(p2.notes || "Sem observações")}</p></article>`).join("") || '<p class="muted">Nenhum recebimento registrado.</p>'}</div>`, true);
  }
  function documentsSection(id) {
    const items = state.documents.filter((d) => d.caseId === id);
    return `<div class="detail-section"><div class="panel-heading"><h3>Anexos · ${items.length}</h3>${button("attach", "Anexar documento", "secondary small", id)}</div><p class="muted compact">PDF, PNG, JPEG, WebP ou TXT UTF-8. Até 5 MB por arquivo e 25 MB no total. Armazenamento local, incluído no backup.</p>${items.map((d) => `<article class="record"><div class="record-head"><div><strong class="private">${escapeHTML(d.name)}</strong><small>${(d.size / 1024).toFixed(1)} KB · ${date(d.createdAt)}</small></div><div class="line-actions">${button("download-document", "Baixar", "secondary small", d.id)}${button("remove-document", "Remover", "ghost small", d.id)}</div></div></article>`).join("") || '<p class="muted">Nenhum documento anexado.</p>'}</div>`;
  }
  function officialSection(c) {
    const info = officialConsultation(c);
    if (!info) return c.cnj || c.docketNumber ? '<div class="detail-section"><h3>Consulta oficial</h3><p class="muted compact">Selecione um tribunal atendido na edição do processo para abrir os portais de consulta manual. Nenhuma consulta será executada automaticamente.</p></div>' : "";
    const history = (c.manualChecks || []).filter((x) => sameManualIdentity(c, x)).slice().reverse();
    return `<div class="detail-section"><h3>Conferência no ${escapeHTML(info.courtLabel)}</h3><p class="muted compact">Sistema informado: <strong>${escapeHTML((c.processSystem ? PROCESS_SYSTEMS[c.processSystem] : JUDICIAL_SYSTEMS[c.judicialSystem || ""]) || "Não informado")}</strong>. Abra o portal correspondente e pesquise manualmente pelo CNJ, registro próprio ou origem, conforme os campos aceitos. Os links abrem formulários de consulta; não buscam nem importam resultados automaticamente.</p><div class="links">${info.number ? button("copy-cnj", "Copiar número CNJ", "secondary small", c.id) : ""}${info.docket ? button("copy-docket", "Copiar registro adicional", "secondary small", c.id) : ""}${info.links.map((link, i) => `<a class="button ${i === 0 && (c.processSystem || c.judicialSystem) ? "primary" : "secondary"} small" href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(link.label)} ↗</a>`).join("")}</div><p class="muted compact">${info.number ? `Número CNJ: <span class="private">${escapeHTML(info.number)}</span>.` : ""}${info.docket ? ` Registro adicional: <span class="private">${escapeHTML(info.docket)}</span>.` : ""} ${c.manualCheckedAt ? "Última conferência manual registrada: " + timestamp(c.manualCheckedAt) + "." : "Nenhuma conferência manual registrada."} O sistema correto precisa ser confirmado no tribunal.</p><div class="links">${button("manual-check", "Registrar resultado da conferência", "secondary small", c.id)}</div><p class="muted compact">Registros manuais são declarações do usuário; não substituem a fonte oficial, não alteram movimentações importadas nem calculam prazos.</p><h3>Histórico de conferências · ${history.length}</h3>${history.slice(0, 10).map((x) => `<article class="record"><div class="record-head"><strong>${escapeHTML(MANUAL_CHECK_RESULTS[x.result] || "Conferência")}</strong><small>${timestamp(x.checkedAt)} · ${escapeHTML(PROCESS_SYSTEMS[x.source] || JUDICIAL_SYSTEMS[x.source] || x.source)}</small></div>${x.notes ? `<p class="private">${escapeHTML(x.notes)}</p>` : ""}</article>`).join("") || '<p class="muted compact">Nenhuma conferência detalhada registrada.</p>'}${history.length > 10 ? '<p class="muted compact">Exibindo as últimas 10 conferências. O histórico completo permanece no backup.</p>' : ""}</div>`;
  }
  function manualCheckDialog(id) {
    const c = state.cases.find((x) => x.id === id);
    const info = officialConsultation(c);
    if (!info) throw Error("Informe tribunal atendido e um CNJ ou registro válido antes da conferência.");
    dialog("Registrar conferência · " + c.title, `<form id="manual-check-form" data-id="${escapeHTML(id)}"><p class="subheading">Preencha após consultar o portal oficial. O registro corresponde apenas ao que você observou e não atualiza a fonte automaticamente.</p><div class="form-grid">${select("Portal consultado *", "source", info.manualSources.map((source) => [source, source === "portal" ? "Portal do tribunal" : PROCESS_SYSTEMS[source] || JUDICIAL_SYSTEMS[source] || source]), info.manualSources.includes(c.processSystem || c.judicialSystem) ? c.processSystem || c.judicialSystem : "portal")}${select("Resultado observado *", "result", Object.entries(MANUAL_CHECK_RESULTS), "no_changes")}${area("Observações (obrigatórias se houver alteração, pendência ou falha)", "notes")}</div><p class="form-error" role="alert"></p><div class="form-actions"><button class="button ghost" type="button" data-action="close">Cancelar</button><button class="button primary" type="submit">Salvar conferência</button></div></form>`, true);
  }
  function workflowSection(c) {
    const items = (c.pendingItems || []).slice().sort((a, b) => Number(a.done) - Number(b.done)), remaining = items.filter((item) => !item.done).length;
    const reviewed = c.reviewedAt && dateKey(new Date(c.reviewedAt)) === dateKey();
    const readonly = c.archived;
    const list = items.length ? `<ul class="case-pending-list">${items.map((item) => `<li class="case-pending-item ${item.done ? "is-done" : ""}"><label><input type="checkbox" data-workflow-pending="${escapeHTML(item.id)}" data-case-id="${escapeHTML(c.id)}" ${item.done ? "checked" : ""} ${readonly ? "disabled" : ""}><span class="private">${escapeHTML(item.title)}</span></label>${!readonly ? `<button type="button" class="button ghost small" data-action="workflow-pending-remove" data-id="${escapeHTML(item.id)}" data-case-id="${escapeHTML(c.id)}" aria-label="Remover pendência: ${escapeHTML(item.title)}">Remover</button>` : ""}</li>`).join("")}</ul>` : '<p class="muted compact">Nenhuma pendência cadastrada neste processo.</p>';
    return `<section class="detail-section case-workflow" id="case-workflow" aria-label="Próximo passo, responsável e pendências"><div class="case-workflow-heading"><div><h3>Próximo passo e revisão</h3><p class="muted compact">Organização interna. Não representa intimação lida nem prazo processual calculado.</p></div><div class="line-actions">${c.reviewedAt ? tag(reviewed ? "Visto hoje" : "Último visto: " + date(dateKey(new Date(c.reviewedAt))), "success") : tag("Ainda não visto")}${!readonly ? button("workflow-viewed", "Marcar visto hoje", "secondary small", c.id) : ""}</div></div>${readonly ? '<p class="notice">Processo arquivado: desarquive para editar próximos passos e pendências.</p>' : ""}<form id="workflow-form" data-id="${escapeHTML(c.id)}"><div class="form-grid"><label class="field full">Próximo passo<textarea name="nextStep" maxlength="500" rows="2" placeholder="Ex.: Aguardar comprovante das custas" ${readonly ? "disabled" : ""}>${escapeHTML(c.nextStep || "")}</textarea></label>${select("Situação do passo", "workStatus", Object.entries(WORK_STATUSES), c.workStatus || "todo")}${select("Com quem está a bola?", "workOwner", Object.entries(WORK_OWNERS), c.workOwner || "me")}${field("Revisar em", "review", c.review, "date")}</div>${!readonly ? '<div class="form-actions"><button class="button primary" type="submit">Salvar acompanhamento</button></div>' : ""}<p class="form-error" role="alert"></p></form><div class="case-pending-heading"><h3>Pendências · ${remaining} aberta(s)</h3><small>${items.length} registrada(s)</small></div>${list}${!readonly ? `<form id="workflow-pending-form" data-id="${escapeHTML(c.id)}" class="case-pending-add"><label class="field">Nova pendência<input name="title" type="text" required maxlength="240" autocomplete="off" placeholder="Ex.: Pedir comprovante ao cliente"></label><button type="submit" class="button secondary">Adicionar pendência</button><p class="form-error" role="alert"></p></form>` : ""}</section>`;
  }
  function fullDetail(id) {
    detail(id);
    const c = state.cases.find((c2) => c2.id === id);
    if (c) {
      if (c.archived) $("#workflow-form")?.querySelectorAll("input,select,textarea,button").forEach((field2) => {
        field2.disabled = true;
      });
      $("#dialog-body").insertAdjacentHTML("beforeend", documentsSection(id));
      void loadIntegratedCase(id);
    }
  }
  function relatedProceedings(c) {
    const parent = state.cases.find((x) => x.id === c.parentCaseId), children = state.cases.filter((x) => x.parentCaseId === c.id);
    return `<div class="detail-section"><h3>Tramitação e vínculos</h3><p class="private">${escapeHTML(jurisdictionLabel(c) || "Tribunal e grau não informados")}</p>${c.docketNumber ? `<p class="private">Registro adicional: ${escapeHTML(c.docketNumber)}</p>` : ""}${c.originReference ? `<p class="private">Referência de origem: ${escapeHTML(c.originReference)}</p>` : ""}${parent ? `<p class="private">Origem: ${button("detail", "Abrir " + escapeHTML(parent.title), "secondary small", parent.id)}</p>` : ""}${children.map((x) => `<p class="private">Relacionado: ${button("detail", "Abrir " + escapeHTML(x.title), "secondary small", x.id)}</p>`).join("")}<p class="muted compact">Vínculos manuais. Eventos e documentos permanecem associados ao processo original.</p></div>`;
  }
  function eventRecord(e) {
    const actionId = e.key, baseline = e.remote && !e.is_new && !e.seen && !e.localIds.length;
    const sourceUrl = safePublicationUrl(e.url), certificateUrl = djenCertificateUrl(e.certificateHash);
    return `<article class="record" data-publication-key="${escapeHTML(e.key)}"><div class="record-head"><div><h3 class="private">${escapeHTML(e.cnj ? formatCnj(e.cnj) : "Referência processual")}</h3><small>${escapeHTML(e.tribunal || e.source)} · ${publicationDateBR(e.date)} · ${e.kind === "publication" ? "Publicação" : "Movimentação"}</small></div><div class="line-actions">${e.publicationStatus === "Cancelada" ? tag("Publicação cancelada", "action") : ""}${baseline ? tag("Referência inicial") : !e.seen ? tag("Nova") : tag("Conferida")}${baseline ? "" : button("publication-seen", e.seen ? "Desmarcar" : "Conferir", "ghost small", actionId)}</div></div>${e.source === "djen" ? publicationDetailsHTML(e) : ""}<details><summary>${e.kind === "publication" ? "Ler teor completo da comunicação" : "Ver conteúdo e origem"}</summary><p class="private">${escapeHTML(e.text)}</p><p class="muted compact">Encontrado em ${timestamp(e.discoveredAt)}${e.sourceUpdatedAt ? " · Atualização da fonte: " + escapeHTML(e.sourceUpdatedAt) : ""}</p></details>${e.kind === "publication" ? `<div class="publication-actions">${certificateUrl ? `${button("unified-publication-official-pdf", "Baixar certidão oficial (PDF)", "primary small", actionId)}<a class="button ghost small" target="_blank" rel="noopener noreferrer" href="${escapeHTML(certificateUrl)}">Abrir certidão no CNJ</a>` : '<span class="muted compact">Certidão oficial não identificada; atualize o DJEN</span>'}${button("unified-publication-pdf", "Baixar cópia do teor (PDF)", "secondary small", actionId)}${sourceUrl ? `<a class="button ghost small" target="_blank" rel="noopener noreferrer" href="${escapeHTML(sourceUrl)}">Abrir processo na fonte</a>` : ""}</div>` : ""}<div class="meta"><span class="private">${e.caseId ? escapeHTML(caseName(e.caseId)) : "Ainda não associado a um caso"}</span>${!e.caseId && validCnj(e.cnj) ? button("unified-register-event", "Cadastrar caso com este CNJ", "ghost small", actionId) : ""}</div></article>`;
  }
  function publications() {
    const { counts, total, rows, hasMore } = publicationView(unifiedPublications(state, publicationEvents), query, publicationFilter, publicationLimit);
    const tabs = `<div class="publication-filters" role="group" aria-label="Filtrar publicações">${Object.entries(PUBLICATION_FILTERS).map(([key, label2]) => `<button type="button" class="publication-filter ${publicationFilter === key ? "active" : ""}" data-action="publication-filter" data-id="${key}" aria-pressed="${publicationFilter === key}">${label2} <span>${counts[key]}</span></button>`).join("")}</div>`;
    const listing = !counts.all && integrated && !publicationLoaded ? "" : rows.length ? `<div class="record-list">${rows.map(eventRecord).join("")}</div>${total ? `<p class="muted compact publication-progress" aria-live="polite">Exibindo ${rows.length} de ${total} publicação(ões) nesta seleção.</p>` : ""}${hasMore ? `<div class="publication-more">${button("publication-more", "Mostrar mais publicações", "secondary")}</div>` : ""}` : counts.all ? '<div class="empty"><h2>Nenhuma publicação neste filtro</h2><p>Escolha outro estado ou altere a busca. Os registros continuam disponíveis.</p></div>' : empty2("Novidades com a origem à vista", "Atualize seus processos ou configure OAB/UF e busque publicações.", "oab", "Buscar pela OAB");
    const status = publicationError ? `<p class="warning-note" role="alert">Não foi possível atualizar as publicações: ${escapeHTML(publicationError)}. Os registros já carregados permanecem disponíveis; a lista pode estar incompleta.</p>` : integrated && !publicationLoaded ? '<p role="status">Carregando publicações…</p>' : "";
    return `<div class="intro-note">Busca por OAB encontra publicações no período configurado. Os resultados não comprovam a carteira completa do advogado. Marcar como conferida é apenas controle interno, não ciência de intimação.</div><div id="publication-list">` + panel("Publicações do DJEN", tabs + status + listing + '<p class="muted compact">Lista unificada da carteira e das até 400 publicações recentes disponíveis no serviço. Conferência é controle interno.</p>', `<input class="search" data-filter="search" aria-label="Buscar registros" placeholder="Buscar nas publicações…" value="${escapeHTML(query)}">${button("refresh-publications", "Atualizar lista", "secondary small")}${button("reconcile-events", "Associar por CNJ", "ghost small")}${button("oab", "Buscar OAB", "secondary")}`) + "</div>";
  }
  async function refreshPublications(force = false) {
    if (route !== "publications" || !integrated || !serviceOnline || publicationLoading || !force && Date.now() - publicationFetched < 12e3) return;
    publicationLoading = true;
    const epoch = publicationWriteEpoch;
    try {
      const result = await apiGet("publications");
      if (epoch === publicationWriteEpoch) {
        publicationEvents = result.events;
        publicationLoaded = true;
        publicationError = "";
        publicationFetched = Date.now();
      }
    } catch (error) {
      publicationError = error.message;
      publicationFetched = Date.now();
    } finally {
      publicationLoading = false;
      if (route === "publications") paintPublications();
    }
  }
  function paintPublications() {
    const root = document.getElementById("publication-list");
    if (!root) return;
    const focus = root.contains(document.activeElement) ? document.activeElement : null;
    const active = focus ? { action: focus.dataset.action, id: focus.dataset.id, search: focus.dataset.filter, start: focus.selectionStart } : null;
    const opened = new Map([...root.querySelectorAll("[data-publication-key]")].map((r) => [r.dataset.publicationKey, [...r.querySelectorAll("details")].map((d) => d.open)]));
    const template = document.createElement("template");
    template.innerHTML = publications();
    root.innerHTML = template.content.querySelector("#publication-list").innerHTML;
    root.querySelectorAll("[data-publication-key]").forEach((r) => r.querySelectorAll("details").forEach((d, i) => {
      d.open = !!opened.get(r.dataset.publicationKey)?.[i];
    }));
    if (active) {
      const next = [...root.querySelectorAll("button,input")].find((x) => active.search ? x.dataset.filter === active.search : x.dataset.action === active.action && x.dataset.id === active.id);
      next?.focus({ preventScroll: true });
      try {
        next?.setSelectionRange(active.start, active.start);
      } catch {
      }
    }
  }
  function sourcePage() {
    const auto = autoScheduleInfo(state.settings);
    return `<div class="intro-note">Fontes gratuitas. Sem assinatura, crédito pago ou contratação automática. A abrangência real precisa ser conferida nos processos da sua carteira.</div><div class="split"><section class="panel"><h2>Conexões e consultas</h2><form id="settings-form" class="settings-form"><article class="source-card"><h3>DataJud <span class="pill">Metadados e movimentos</span></h3><p>Lê a base nacional por número CNJ. Consultar novamente não força a atualização do tribunal.</p><label class="check-field"><input type="checkbox" name="datajud" ${state.settings.datajud ? "checked" : ""}> Incluir DataJud na atualização</label><label class="field">Chave pública do CNJ<input readonly value="${state.settings.datajudKey ? "••••••••" + escapeHTML(state.settings.datajudKey.slice(-4)) : "Sem chave configurada"}" aria-label="Chave pública protegida" style="background:var(--soft);color:var(--muted)"><small>A chave só muda quando você escolhe substituir ou remover.</small></label><div class="links"><button type="button" class="button secondary small" data-key-edit>${state.settings.datajudKey ? "Substituir chave" : "Adicionar chave"}</button>${state.settings.datajudKey ? '<button type="button" class="button ghost small" data-key-remove>Remover chave</button>' : ""}</div><div data-key-editor hidden><label class="field">Nova chave pública<input name="datajudKey" type="password" disabled autocomplete="off" spellcheck="false" maxlength="256"><small>Cole a chave completa. Ela será aplicada ao salvar configurações.</small></label><button type="button" class="button ghost small" data-key-cancel>Cancelar alteração da chave</button></div><p><a href="https://datajud-wiki.cnj.jus.br/api-publica/acesso/" target="_blank" rel="noopener noreferrer">Obter chave na documentação do CNJ ↗</a></p></article><article class="source-card"><h3>DJEN <span class="pill">Publicações</span></h3><p>Consulta publicações por processo ou OAB. Não representa todos os movimentos do processo.</p><label class="check-field"><input type="checkbox" name="djen" ${state.settings.djen ? "checked" : ""}> Incluir DJEN na atualização</label><div class="form-grid"><label class="field">Período de consulta (dias)<input type="number" min="1" max="365" name="djenDays" value="${state.settings.djenDays}" required></label><span></span><label class="field">Número da OAB<input name="oab" value="${escapeHTML(state.settings.oab)}" placeholder="Ex.: 123456" maxlength="9"></label><label class="field">UF da OAB<select name="ufOab"><option value="">Selecione</option>${"AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SE SP TO".split(" ").map((x) => `<option ${x === state.settings.ufOab ? "selected" : ""}>${x}</option>`).join("")}</select></label></div></article><button class="button primary" type="submit">Salvar configurações</button><p class="form-error" id="settings-error" role="alert"></p></form></section><div>${schedulePanel(state.settings)}<section class="panel"><h2>Dados sob seu controle</h2><p class="muted">No modo integrado, cadastros, anexos e monitoramento ficam no banco local deste computador. No modo arquivo, os dados ficam neste navegador. Exporte uma cópia antes de trocar de perfil ou computador.</p><div class="links">${button("backup", "Exportar backup", "primary")}${button("restore", "Restaurar backup", "secondary")}</div><p class="warning-note">O backup pode ser protegido por senha, inclui os anexos e, no modo integrado, também o monitoramento SQLite. Guarde a senha. A restauração substitui os dados após prévia e confirmação.</p></section><section class="panel"><h2>Alcance desta versão</h2><ul class="source-limits"><li>Não há busca nacional por CPF/CNPJ.</li><li>TJSP e-SAJ é opcional; não há integração específica com PJe, eproc ou Projudi.</li><li>Não há login em JusBR/PDPJ ou acesso a peças restritas.</li><li>Não há resolução automática de CAPTCHA.</li><li>Não há consulta com navegador e computador desligados.</li><li>Consultas concluídas se referem às fontes e ao período selecionados.</li></ul><p class="muted compact">Painel H.B ${VERSION} · dados locais · testes de interface com respostas simuladas são distintos dos testes de conectividade.</p></section></div></div>` + jobsPanel();
  }
  function jobsPanel() {
    const rows = state.jobs.slice(-60).reverse(), title = integrated ? "Histórico anterior · navegador" : "Histórico de consultas";
    if (!rows.length) return panel(title, empty2("Nenhuma consulta executada", "As buscas e eventuais falhas serão registradas aqui."));
    const heads = "<thead><tr><th>Processo / referência</th><th>Fonte</th><th>Resultado</th><th>Detalhes</th><th>Verificação</th></tr></thead>";
    const items = (list) => list.map((j2) => `<tr><td class="private">${escapeHTML(j2.cnj ? formatCnj(j2.cnj) : `OAB ${j2.oab}/${j2.ufOab}`)}</td><td>${j2.source === "djen" ? "DJEN" : "DataJud"}</td><td>${tag(statusName[j2.status], j2.status)}</td><td class="private">${escapeHTML(j2.message)}${j2.periodStart ? `<small>${date(j2.periodStart)} a ${date(j2.periodEnd)}</small>` : ""}${j2.count > 0 && ["error", "action"].includes(j2.status) ? '<small class="warning-note">Resultado parcial; há páginas não concluídas.</small>' : ""}</td><td><small>${timestamp(j2.updatedAt)}</small></td></tr>`).join("");
    const compact = `<div class="table-wrap"><table>${heads}<tbody>${items(rows.slice(0, 6))}</tbody></table></div>`;
    const remaining = rows.length > 6 ? `<details class="legacy-history"><summary>Ver outras ${rows.length - 6} consultas anteriores</summary><div class="table-wrap legacy-history-scroll"><table>${heads}<tbody>${items(rows.slice(6))}</tbody></table></div></details>` : "";
    return panel(title, `<p class="muted compact">Exibindo as consultas mais recentes. O histórico anterior permanece preservado.</p>${compact}${remaining}`);
  }
  function render2() {
    const oldFocus = document.activeElement?.dataset?.filter ? { type: document.activeElement.dataset.filter, start: document.activeElement.selectionStart } : null;
    const [title, sub] = routes[route];
    $("#page-title").textContent = title;
    $("#eyebrow").textContent = sub;
    $("#navigation").innerHTML = Object.entries(routes).filter(([k]) => k !== "sources").map(([k, [label2]]) => `<a class="nav-item ${route === k ? "active" : ""}" href="#${k}" ${route === k ? 'aria-current="page"' : ""}>${icon(k)}${label2}${k === "cases" ? `<span class="nav-count">${state.cases.filter((c) => !c.archived).length}</span>` : k === "notifications" ? '<span class="nav-count notification-nav-count" data-notification-count hidden>0</span>' : ""}</a>`).join("");
    $("#privacy").innerHTML = icon("privacy") + "Modo privacidade";
    $("#privacy").setAttribute("aria-pressed", String(!!state.settings.privacy));
    document.body.classList.toggle("privacy", !!state.settings.privacy);
    $("#backup").innerHTML = icon("backup") + "Exportar backup";
    $("#settings-link").innerHTML = icon("sources") + "Fontes e ajustes";
    $("#settings-link").classList.toggle("active", route === "sources");
    $("#release-version").textContent = "v" + CHANGELOG[0].version;
    $("#release-title").textContent = CHANGELOG[0].summary;
    $("#today").textContent = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(/* @__PURE__ */ new Date());
    $("#update-all").innerHTML = icon("refresh") + "Atualizar tudo";
    const addMap = { home: ["cases", "Novo caso"], agendados: ["cases", "Novo caso"], cases: ["cases", "Novo caso"], clients: ["clients", "Novo cliente"], tasks: ["tasks", "Nova tarefa"], agenda: ["appointments", "Agendar"], finance: ["fees", "Novo honorário"], publications: ["cases", "Novo caso"], sources: ["cases", "Novo caso"] };
    addMap.notifications = ["cases", "Novo caso"];
    $("#new-record").dataset.action = "new-" + addMap[route][0];
    $("#new-record").innerHTML = icon("plus") + addMap[route][1];
    const running = state.jobs.filter((j2) => ["queued", "running"].includes(j2.status));
    $("#job-progress").innerHTML = running.length ? `<div class="job-banner">${icon("refresh")}<p><strong>${running.length} consulta(s) pendente(s)</strong>Você pode continuar usando o painel. Resultados serão salvos por fonte.</p>${button("cancel", "Cancelar", "ghost small")}${button("resume", "Continuar", "secondary small")}</div>` : "";
    $("#content").innerHTML = { home, notifications: () => '<div id="notification-center"></div>', agendados: agendadosPanel, cases: casesPanel, clients, tasks, agenda, finance, publications, sources: sourcePage }[route]();
    if (route === "sources") for (const id of ["settings-form", "auto-form"]) rememberForm(document.getElementById(id));
    if (route === "notifications") notificationCenter.mount();
    if (route === "publications") void refreshPublications();
    notificationCenter.badge();
    if (route === "sources") {
      simplifySourceLimitations();
      updateTimeControls(document.getElementById("auto-form"));
    }
    $("#local-version").textContent = VERSION;
    if (route === "sources" && !integrated) $("#content").insertAdjacentHTML("afterbegin", '<div class="notice"><strong>HTML direto, sem serviço Python.</strong> Seus registros permanecem acessíveis no IndexedDB, mas novas consultas judiciais estão indisponíveis. Para integrá-las, faça backup e abra pelo iniciador integrado; os dados de file:// não aparecem automaticamente em localhost.</div>');
    if (route === "sources") $("#content").insertAdjacentHTML("beforeend", coveragePanel());
    if (route === "sources") $("#content").insertAdjacentHTML("beforeend", coverageEvidencePanel());
    if (route === "sources") $("#content").insertAdjacentHTML("beforeend", `<section class="panel"><div class="panel-heading"><h2>Conectividade das fontes públicas</h2>${button("source-diagnostics", "Testar conexão real DJEN e DataJud", "secondary")}</div><p class="muted compact">Teste manual das APIs públicas, sem dados da carteira, sem salvar eventos ou confirmar cobertura. Pode levar alguns segundos.</p></section>`);
    if (route === "sources") $("#content").insertAdjacentHTML("beforeend", `<section class="panel"><div class="panel-heading"><h2>Integridade do banco local</h2>${button("audit-local", "Verificar dados e anexos", "secondary")}</div><p class="muted compact">Confere vínculos entre cadastros, saldos e arquivos armazenados. Não altera registros nem consulta os tribunais. Uma verificação sem erros não substitui backup protegido.</p></section>`);
    if (route === "sources") $("#content").insertAdjacentHTML("beforeend", readinessPanel());
    if (oldFocus) {
      const f = document.querySelector(`[data-filter="${oldFocus.type}"]`);
      f?.focus();
      try {
        f?.setSelectionRange(oldFocus.start, oldFocus.start);
      } catch {
      }
    }
    decorateIntegrated(route, state);
    organizePanel(route);
  }
  var field = (label2, name, value = "", type = "text", full = false, extra = "") => {
    const cash = ["amount", "paid"].includes(name) && type === "number";
    if (cash) {
      type = "text";
      extra = extra.replace(/(?:min|step)="[^"]*"/g, "") + ' inputmode="decimal"';
    }
    const limits = { phone: 40, email: 180, area: 120 };
    if (limits[name] && !extra.includes("maxlength")) extra += ' maxlength="' + limits[name] + '"';
    const complete = { phone: "tel", email: "email", name: "name" }[name];
    return `<label class="field ${full ? "full" : ""}">${label2}<input name="${name}" type="${type}" value="${escapeHTML(cash ? String(value).replace(".", ",") : value)}" ${extra} ${complete ? 'autocomplete="' + complete + '"' : ""}>${cash ? "<small>Ex.: 1.250,00. Até duas casas decimais.</small>" : limits[name] ? "<small>Até " + limits[name] + " caracteres.</small>" : ""}</label>`;
  };
  var area = (label2, name, value = "") => `<label class="field full">${label2}<textarea name="${name}" maxlength="4000">${escapeHTML(value)}</textarea></label>`;
  var select = (label2, name, options, value = "") => `<label class="field">${label2}<select name="${name}">${options.map(([k, v]) => `<option value="${escapeHTML(k)}" ${k === value ? "selected" : ""}>${escapeHTML(v)}</option>`).join("")}</select></label>`;
  function dialog(title, body, sensitiveTitle = false) {
    $("#editor").classList.remove("case-dialog");
    $("#dialog-title").textContent = title;
    $("#dialog-title").classList.toggle("private", sensitiveTitle);
    $("#dialog-body").innerHTML = body;
    for (const f of $("#dialog-body").querySelectorAll("form")) rememberForm(f);
    if (!$("#editor").open) $("#editor").showModal();
  }
  function renderCnjChangeWarning() {
    const form = $("#entity-form");
    if (!form || form.dataset.table !== "cases" || !form.dataset.id) return;
    const old = state.cases.find((c) => c.id === form.dataset.id), notice = form.querySelector("#cnj-change-warning");
    if (!old || !notice) return;
    const proposed = digits(form.querySelector('[name="cnj"]')?.value);
    if (!old.cnj || old.cnj === proposed) {
      notice.hidden = true;
      notice.innerHTML = "";
      return;
    }
    const count = cnjChangeImpact(state, old.id);
    const items = [["tarefas", count.tasks], ["compromissos", count.appointments], ["honorários", count.fees], ["recebimentos/estornos", count.payments], ["anexos", count.documents], ["conferências manuais", count.manualChecks], ["publicações/movimentações", count.events], ["consultas em andamento", count.jobs]];
    notice.hidden = false;
    notice.innerHTML = `<h3>Confirme a correção do CNJ</h3><p class="compact">De <strong>${escapeHTML(formatCnj(old.cnj))}</strong> para <strong>${proposed ? validCnj(proposed) ? escapeHTML(formatCnj(proposed)) : "número ainda inválido" : "sem CNJ"}</strong>.</p><p class="compact">Dados associados atualmente: ${items.map(([label2, total]) => `${total} ${label2}`).join(" · ")}.</p><p class="compact">Publicações e consultas do número anterior serão separadas; buscas pendentes serão canceladas. Tarefas, compromissos, honorários, recebimentos e anexos permanecerão nesta ficha, por isso precisam de revisão manual. As conferências antigas continuam no histórico exportado, mas não são exibidas como conferência do novo CNJ.</p><label class="check-field"><input type="checkbox" name="confirmCnjChange" value="yes" required> Conferi os números CNJ e reconheço que devo revisar os vínculos preservados.</label>`;
  }
  function edit(table, id = "", preset = {}) {
    const row = { ...preset, ...state[table].find((x) => x.id === id) || {} };
    let fields2 = "";
    const caseOptions = [["", "Sem processo vinculado"], ...state.cases.map((c) => [c.id, c.title])];
    if (table === "clients") fields2 = field("Nome *", "name", row.name, "text", true, 'required maxlength="180"') + field("Telefone / WhatsApp", "phone", row.phone, "tel") + field("E-mail", "email", row.email, "email") + area("Observações", "notes", row.notes);
    if (table === "cases") fields2 = field("Título do caso *", "title", row.title, "text", true, 'required maxlength="240"') + field("Número CNJ (opcional para pré-processual)", "cnj", row.cnj ? formatCnj(row.cnj) : "", "text", true, 'placeholder="0000000-00.0000.0.00.0000" maxlength="25"') + '<p id="cnj-inference" class="cnj-inference muted compact" aria-live="polite"></p>' + field("Unidade de origem (pela tabela oficial, quando disponível)", "originUnit", "", "text", true, 'readonly aria-readonly="true" placeholder="Será identificada pelo CNJ"') + djenLookupHTML() + '<details class="datajud-lookup"><summary>Consulta complementar - DataJud</summary><button class="button secondary small" type="button" data-action="datajud-search">Buscar dados no DataJud</button><p class="muted compact">O tribunal e a unidade de origem são inferidos localmente dos dígitos. O nome da unidade vem da tabela oficial disponível para o TJRJ; para outros tribunais, consulte o respectivo cadastro. O DataJud é uma consulta separada para buscar metadados públicos.</p><p id="datajud-status" class="compact" aria-live="polite" role="status"></p><div id="datajud-preview" class="datajud-preview" hidden></div></details>' + select("Cliente", "clientId", [["", "Sem cliente vinculado"], ...state.clients.map((c) => [c.id, c.name])], row.clientId) + field("Autor / parte autora", "plaintiff", row.plaintiff, "text", true, 'maxlength="400"') + field("Réu / parte ré", "defendant", row.defendant, "text", true, 'maxlength="400"') + field("Área", "area", row.area) + select("Etapa de trabalho", "stage", Object.entries(STAGES), row.stage || "todo") + select("Sistema de tramitação TJRJ (confirmado manualmente)", "judicialSystem", Object.entries(JUDICIAL_SYSTEMS), row.judicialSystem || "") + field("Data para revisar", "review", row.review, "date") + '<label class="field full">Próximo passo<textarea name="nextStep" maxlength="500" rows="2" placeholder="Ex.: Aguardar manifestação do cliente">' + escapeHTML(row.nextStep || "") + "</textarea></label>" + select("Responsável pela próxima ação", "workOwner", Object.entries(WORK_OWNERS), row.workOwner || "me") + select("Situação do próximo passo", "workStatus", Object.entries(WORK_STATUSES), row.workStatus || "todo") + area("Observações", "notes", row.notes);
    if (table === "cases") fields2 += select("Tribunal (inferido pelo CNJ; confira)", "court", Object.entries(COURTS), row.court || "") + select("Grau / órgão judicial (não consta nos dígitos do CNJ)", "courtLevel", Object.entries(COURT_LEVELS), row.courtLevel || "") + select("Sistema do processo (não consta nos dígitos do CNJ)", "processSystem", Object.entries(PROCESS_SYSTEMS), row.processSystem || "") + select("Processo de origem cadastrado", "parentCaseId", [["", "Sem vínculo de origem"], ...state.cases.filter((c) => c.id !== id).map((c) => [c.id, c.title + " · " + (c.cnj ? formatCnj(c.cnj) : c.docketNumber || "sem CNJ")])], row.parentCaseId || "") + field("Número de registro adicional (STJ/STF etc.)", "docketNumber", row.docketNumber, "text", false, 'maxlength="100"') + field("Referência externa de origem (não vinculada automaticamente)", "originReference", row.originReference, "text", true, 'maxlength="120"') + '<p class="muted compact">O CNJ identifica segmento, tribunal e código da unidade de origem. Grau e sistema eletrônico precisam ser confirmados por outra fonte. Vincular processos não mistura seus CNJs, publicações, anexos ou histórico.</p>';
    if (table === "tasks") fields2 = field("Tarefa *", "title", row.title, "text", true, 'required maxlength="240"') + select("Processo", "caseId", caseOptions, row.caseId) + select("Etapa", "stage", Object.entries(STAGES), row.stage || "todo") + field("Vencimento", "due", row.due, "date", true) + area("Observações", "notes", row.notes) + (row.manualCheckId ? `<input type="hidden" name="manualCheckId" value="${escapeHTML(row.manualCheckId)}"><p class="muted compact">Origem: conferência manual do processo. Defina o vencimento somente após confirmar o prazo na fonte oficial.</p>` : "");
    if (table === "appointments") fields2 = field("Compromisso *", "title", row.title, "text", true, 'required maxlength="240"') + field("Data e hora (Brasília) *", "when", row.when, "datetime-local", false, "required") + select("Tipo", "kind", [["Reunião", "Reunião"], ["Audiência", "Audiência"], ["Revisão", "Revisão"], ["Prazo confirmado", "Prazo confirmado"]], row.kind || "Reunião") + select("Processo", "caseId", caseOptions, row.caseId) + area("Observações", "notes", row.notes);
    if (table === "fees") fields2 = field("Descrição do honorário *", "title", row.title, "text", true, 'required maxlength="240"') + select("Processo", "caseId", caseOptions, row.caseId) + field("Vencimento", "due", row.due, "date") + field("Valor total (R$) *", "amount", row.amount !== void 0 ? (row.amount / 100).toFixed(2) : "", "number", false, 'required min="0.01" step="0.01"') + (id ? '<p class="muted compact">Use Recebimentos para lançar valores e estornos.</p>' : field("Recebimento inicial (R$)", "paid", "0", "number", false, 'min="0" step="0.01"')) + area("Observações", "notes", row.notes);
    const names2 = { clients: "cliente", cases: "caso", tasks: "tarefa", appointments: "compromisso", fees: "honorário" };
    dialog((id ? "Editar " : "Cadastrar ") + names2[table], `<form id="entity-form" data-table="${table}" data-id="${escapeHTML(id)}"><div class="form-grid">${fields2}</div>${table === "cases" ? '<section class="datajud-saved-panel"><h3>Dados públicos do processo · DataJud</h3><div id="datajud-fields"></div></section>' : ""}${id && table === "cases" ? '<section id="cnj-change-warning" class="cnj-change-panel" hidden aria-label="Confirmação da correção do CNJ"></section>' : ""}<p class="form-error" id="entity-error" role="alert"></p><div class="form-actions">${id && table === "cases" ? button("archive", row.archived ? "Desarquivar" : "Arquivar", "ghost", id) : ""}<button class="button ghost" type="button" data-action="close">Cancelar</button><button class="button primary" type="submit">Salvar ${names2[table]}</button></div></form>`);
    $("#entity-form").dataset.revision = String(state.revision);
    if (table === "cases") {
      initDatajudForm($("#entity-form"), row.datajudDetails);
      updateCnjInference($("#entity-form"));
      renderCnjChangeWarning();
    }
  }
  var activeDetailCaseId = "";
  var localHistoryPage = 1;
  function localHistoryHTML(events) {
    if (!events.length) return '<p class="muted">As informações encontradas nas fontes aparecerão aqui.</p>';
    const slice = historyPage(events, localHistoryPage);
    localHistoryPage = slice.page;
    const entries = slice.items.map((e) => {
      const label2 = e.kind === "publication" ? "Publicação" : "Movimentação";
      const url = safePublicationUrl(e.url), certificate = djenCertificateUrl(e.certificateHash);
      const summary = String(e.text || "Descrição não informada").replace(/\s+/gu, " ").slice(0, 145);
      return `<article class="case-history-event"><details><summary class="case-history-summary"><time class="case-history-date">${escapeHTML(publicationDateBR(e.date))}</time><span class="integrated-source">${escapeHTML(e.tribunal || e.source || "Fonte não informada")}</span><span class="integrated-degree">${label2}</span>${e.publicationStatus === "Cancelada" ? tag("Publicação cancelada", "action") : ""}${!e.seen ? '<span class="integrated-pending-tag">Por conferir</span>' : ""}<span class="case-history-snippet private">${escapeHTML(summary)}</span><span class="integrated-event-caret" aria-hidden="true">⌄</span></summary><div class="case-history-extra private"><p>${escapeHTML(e.text || "Descrição não informada")}</p>${e.source === "djen" ? publicationDetailsHTML(e) : ""}<p class="muted compact">Identificado em ${timestamp(e.discoveredAt)}${e.sourceUpdatedAt ? " · Atualização da fonte: " + escapeHTML(e.sourceUpdatedAt) : ""}</p><div class="case-history-actions">${button("seen", e.seen ? "Desmarcar conferência" : "Marcar como conferido", "ghost small", e.id)}${e.kind === "publication" ? button("publication-pdf", "Baixar cópia (PDF)", "secondary small", e.id) + (certificate ? button("publication-official-pdf", "Baixar certidão oficial", "secondary small", e.id) : "") : ""}${url ? `<a href="${escapeHTML(url)}" class="button ghost small" target="_blank" rel="noopener noreferrer">Abrir na fonte</a>` : ""}${certificate ? `<a href="${escapeHTML(certificate)}" class="button ghost small" target="_blank" rel="noopener noreferrer">Abrir certidão no CNJ</a>` : ""}</div></div></details></article>`;
    }).join("");
    const pagination = slice.pages > 1 ? `<nav class="case-history-pagination" aria-label="Páginas do histórico local"><span>Mostrando ${slice.start + 1}–${slice.end} de ${slice.count} · Página ${slice.page} de ${slice.pages}</span><div><button type="button" class="button ghost small" data-case-page="${slice.page - 1}" ${slice.page === 1 ? "disabled" : ""}>Anterior</button><button type="button" class="button ghost small" data-case-page="${slice.page + 1}" ${slice.page === slice.pages ? "disabled" : ""}>Próxima</button></div></nav>` : "";
    return `<div class="case-history-list">${entries}</div>${pagination}`;
  }
  function refreshLocalHistory() {
    const section = $("#local-case-history");
    if (!section || !activeDetailCaseId) return;
    const events = state.events.filter((e) => e.caseId === activeDetailCaseId).sort((a, b) => b.date.localeCompare(a.date));
    section.innerHTML = `<h3>Histórico · ${events.length} registro(s)</h3>${localHistoryHTML(events)}`;
  }
  function detail(id) {
    const c = state.cases.find((x) => x.id === id);
    if (!c) return;
    if (activeDetailCaseId !== id) {
      activeDetailCaseId = id;
      localHistoryPage = 1;
    }
    const events = state.events.filter((e) => e.caseId === id).sort((a, b) => b.date.localeCompare(a.date));
    dialog(c.title, `<p class="subheading private">${escapeHTML(c.cnj ? formatCnj(c.cnj) : c.docketNumber ? "Registro " + c.docketNumber : "Pré-processual")} · ${escapeHTML(clientName(c.clientId))}</p><div class="links">${button("edit-cases", "Editar caso", "secondary", id)}${c.cnj ? button("djen-process", "Buscar publicações no DJEN", "primary", id) + button("update-one", "Atualizar todas as fontes", "secondary", id) : ""}${button("new-task-for", "Criar tarefa", "ghost", id)}</div>${c.plaintiff || c.defendant ? `<div class="detail-section"><h3>Partes do processo</h3>${c.plaintiff ? `<p class="private compact"><strong>Autor:</strong> ${escapeHTML(c.plaintiff)}</p>` : " "}${c.defendant ? `<p class="private compact"><strong>Réu:</strong> ${escapeHTML(c.defendant)}</p>` : " "}</div>` : ""}${workflowSection(c)}${relatedProceedings(c)}${officialSection(c)}${c.datajudDetails ? `<div class="detail-section"><h3>Metadados públicos · DataJud</h3><p class="compact">Classe: ${escapeHTML(c.datajudDetails.classe || "Não informada")} · Assuntos: ${escapeHTML((c.datajudDetails.assuntos || []).join("; ") || "Não informados")} · Órgão julgador: ${escapeHTML(c.datajudDetails.orgao || "Não informado")}</p><p class="muted compact">Registro ${escapeHTML(c.datajudDetails.recordId || "sem ID")} · Fonte ${escapeHTML(c.datajudDetails.sourceUpdatedAt || "sem data de atualização")}</p></div>` : ""}${c.notes ? `<div class="detail-section"><h3>Observações</h3><p class="private">${escapeHTML(c.notes)}</p></div>` : ""}<div class="detail-section"><h3>Consultas e alcance</h3>${state.jobs.filter((j2) => j2.caseId === id).slice(-4).reverse().map((j2) => `<div class="record"><div class="record-head"><strong>${j2.source === "datajud" ? "DataJud" : "DJEN"}</strong>${tag(statusName[j2.status], j2.status)}</div><p>${escapeHTML(j2.message)}</p><small>${timestamp(j2.updatedAt)}${j2.periodStart ? " · Período " + date(j2.periodStart) + " a " + date(j2.periodEnd) : ""}</small></div>`).join("") || '<p class="muted">Nenhuma consulta executada.</p>'}</div><div class="detail-section" id="local-case-history"><h3>Histórico · ${events.length} registro(s)</h3>${localHistoryHTML(events) || '<p class="muted">As informações encontradas nas fontes aparecerão aqui.</p>'}</div><div class="detail-section"><h3>Tarefas vinculadas</h3>${state.tasks.filter((t) => t.caseId === id).map((t) => `<p class="private">${escapeHTML(t.title)} · ${escapeHTML(STAGES[t.stage])}</p>`).join("") || '<p class="muted">Nenhuma tarefa vinculada.</p>'}</div>`, true);
    $("#editor").classList.add("case-dialog");
  }
  function downloadJSON(payload, name) {
    const a = document.createElement("a"), url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5e3);
  }
  function downloadCsv(text, name) {
    const a = document.createElement("a"), url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5e3);
  }
  function exportPortfolioDialog() {
    dialog("Exportar carteira CSV", `<p>O arquivo terá <strong>${state.cases.length} processo(s)</strong>, incluindo os arquivados, e poderá conter nomes de clientes, observações e números processuais.</p><p class="warning-note">CSV não tem criptografia e NÃO é backup completo: não inclui anexos, histórico financeiro, tarefas, consultas ou conferências. Guarde-o em local protegido. Para preservar todos os dados, use Exportar backup com senha.</p><div class="form-actions"><button type="button" class="button ghost" data-action="close">Cancelar</button>${button("confirm-export-portfolio", "Confirmar download do CSV", "primary")}</div>`);
  }
  function exportBackup() {
    dialog("Exportar backup", `<p class="subheading">Inclui cadastros, histórico financeiro e anexos. A chave pública DataJud não é exportada.</p><form id="backup-form"><div class="form-grid" id="password-fields">${field("Senha (mínimo 10 caracteres)", "password", "", "password", true, 'required minlength="10" maxlength="1024" autocomplete="new-password"')}${field("Confirmar senha", "confirmation", "", "password", true, 'required minlength="10" maxlength="1024" autocomplete="new-password"')}</div><label class="check-field"><input type="checkbox" name="plain"> Exportar sem senha; estou ciente de que o arquivo ficará legível.</label><p class="warning-note">Não há recuperação de senha. A proteção se aplica ao arquivo exportado; o banco local do navegador não é criptografado por esta função.</p><p class="form-error" role="alert"></p><div class="form-actions"><button class="button ghost" type="button" data-action="close">Cancelar</button><button class="button primary" type="submit">Gerar backup</button></div></form>`);
  }
  function importDialog() {
    pendingImport = null;
    dialog("Importar números CNJ", `<form id="import-form"><p class="subheading">Cole um número por linha. Confira a prévia antes de cadastrar. Nenhuma busca será iniciada automaticamente.</p><label class="field">Números de processo<textarea name="numbers" rows="8" required placeholder="0000000-00.0000.0.00.0000"></textarea></label><p class="form-error" id="import-error" role="alert"></p><div class="form-actions"><button type="button" class="button ghost" data-action="close">Cancelar</button><button class="button primary" type="submit">Conferir números</button></div></form>`);
  }
  function spreadsheetFileDialog() {
    pendingWorkbook = null;
    pendingSheetPlan = null;
    dialog("Importar carteira do Excel", `<form id="sheet-file-form"><p class="subheading">Selecione um arquivo <strong>.xlsx, .csv ou .tsv</strong> com uma linha de cabeçalho. O arquivo é lido neste navegador, sem envio à internet.</p><label class="field full">Arquivo Excel/CSV<input name="file" type="file" accept=".xlsx,.csv,.tsv" required></label><p class="muted compact">Até 6 MB, 2.000 linhas, 60 colunas por aba. Para preservar o CNJ, a coluna deve estar formatada como <strong>texto</strong> no Excel, não número ou fórmula. Formato .xls antigo não é aceito: salve como .xlsx.</p><p class="warning-note">Exporte um backup protegido antes de importar. A prévia não altera registros. Somente linhas com CNJ válido ou recurso STJ/STF com registro adicional não duplicado poderão ser criadas.</p><p class="form-error" role="alert"></p><div class="form-actions"><button type="button" class="button ghost" data-action="close">Cancelar</button><button type="submit" class="button primary">Ler arquivo local</button></div></form>`);
  }
  function spreadsheetMappingDialog(index = 0) {
    if (!pendingWorkbook?.sheets?.[index]) throw Error("Aba da planilha não encontrada.");
    pendingSheetPlan = null;
    const sheet = pendingWorkbook.sheets[index], mapping = suggestMapping(sheet.headers);
    const options = (selected2, includeUnmapped = true) => `${includeUnmapped ? '<option value="-1">Não mapear</option>' : ""}${sheet.headers.map((name, i) => `<option value="${i}" ${selected2 === i ? "selected" : ""}>${escapeHTML(name)} (coluna ${i + 1})</option>`).join("")}`;
    const cells = Object.entries(IMPORT_FIELDS).map(([key, label2]) => `<label class="field">${label2}<select name="map-${key}">${options(mapping[key])}</select></label>`).join("");
    const tabs = pendingWorkbook.sheets.length > 1 ? `<label class="field full">Aba a importar<select name="sheet-index">${pendingWorkbook.sheets.map((tab, i) => `<option value="${i}" ${i === index ? "selected" : ""}>${escapeHTML(tab.name)} · ${tab.rows.length} linhas</option>`).join("")}</select></label>` : "";
    const sample = sheet.rows.slice(0, 3).map((x) => `<tr>${sheet.headers.map((_, i) => `<td>${escapeHTML((x.cells[i]?.text || "").slice(0, 90))}</td>`).join("")}</tr>`).join("");
    dialog("Relacionar colunas do Excel", `<form id="sheet-mapping-form"><p class="subheading">Aba <strong>${escapeHTML(sheet.name)}</strong> · ${sheet.rows.length} linha(s). Escolha qual coluna corresponde a cada campo do Painel H.B. As colunas Tribunal, Processo, Autor, Réu, Ação, Audiência e Hora são reconhecidas automaticamente. Autor e réu são partes, não clientes. Audiência com data e hora válidas cria compromisso vinculado; informação incompleta fica nas observações. Confira todas as colunas antes de continuar. Processo de origem importado fica como referência textual, sem vínculo automático.</p><div class="form-grid">${tabs}${cells}</div><div class="table-wrap sheet-import-table"><table><thead><tr>${sheet.headers.map((h) => `<th>${escapeHTML(h)}</th>`).join("")}</tr></thead><tbody>${sample || "<tr><td>Sem dados</td></tr>"}</tbody></table></div><p class="muted compact">Importação de clientes: novos nomes serão cadastrados; clientes com nome idêntico serão reutilizados. Não modifica clientes existentes. A etapa do processo é interna. A data de audiência importada não é prazo jurídico e deve ser conferida na fonte oficial.</p><p class="form-error" role="alert"></p><div class="form-actions"><button type="button" class="button ghost" data-action="close">Cancelar</button><button type="submit" class="button primary">Conferir prévia</button></div></form>`);
  }
  function spreadsheetPreviewDialog(sheet, mapping, plan) {
    pendingSheetPlan = { sheet, mapping, plan };
    const names2 = plan.ready.filter((x) => x.record.client).map((x) => x.record.client.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim());
    const repeats = new Set(names2.filter((name, index) => names2.indexOf(name) !== index));
    const reusing = plan.ready.filter((row) => row.clientMatches.length || repeats.has(row.record.client.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim())).length;
    const rows = [...plan.invalid, ...plan.duplicates, ...plan.ready].slice(0, 40).map((row) => `<tr><td>${row.line}</td><td class="private">${escapeHTML(row.record.cnj ? formatCnj(row.record.cnj) : row.record.docketNumber ? "Registro " + row.record.docketNumber : "Sem CNJ")}</td><td class="private">${escapeHTML(row.record.title.slice(0, 90))}</td><td>${row.status === "ready" ? "Pronto" : row.status === "duplicate" ? "Duplicado" : "Revisar"}</td><td>${escapeHTML([row.reason, row.hearingNote].filter(Boolean).join(" · "))}</td></tr>`).join("");
    dialog("Prévia da importação Excel", `<div class="intro-note"><strong>${plan.ready.length} processo(s) novo(s)</strong> · ${plan.duplicates.length} repetido(s) · ${plan.invalid.length} linha(s) para corrigir.</div><p class="muted compact">Somente os registros marcados <strong>Pronto</strong> serão criados. Duplicidades e erros não serão sobrescritos, e a planilha original ficará intacta. Nenhuma consulta aos tribunais será iniciada. <strong>${plan.ready.filter((x) => x.record.hearingWhen).length} audiência(s)</strong> com data e hora completas serão cadastradas na agenda; informações incompletas ficam nas observações.</p><div class="table-wrap sheet-import-table"><table><thead><tr><th>Linha</th><th>CNJ / registro</th><th>Assunto</th><th>Situação</th><th>Motivo</th></tr></thead><tbody>${rows}</tbody></table></div>${plan.total > 40 ? '<p class="muted compact">Exibindo até 40 linhas, priorizando erros e duplicatas. Baixe o relatório CSV para conferir todas.</p>' : ""}<p class="muted compact">Colunas não mapeadas preservadas em observações quando contêm conteúdo: ${escapeHTML(plan.unmapped.join(", ") || "nenhuma")}.</p><div class="links">${button("download-sheet-report", "Baixar relatório completo CSV", "secondary small")}</div><p class="warning-note">O relatório inclui dados da planilha e não tem senha. Guarde-o em local protegido.</p><form id="sheet-confirm-form"><label class="check-field"><input type="checkbox" name="confirmed" value="yes" required> Revisei a prévia, fiz backup e autorizo cadastrar apenas os processos válidos. Clientes novos serão criados quando informados.</label>${reusing ? `<label class="check-field"><input type="checkbox" name="confirmedExisting" value="yes" required> Confirmei os ${reusing} processo(s) que possuem nomes de clientes iguais a outros registros da planilha ou clientes já cadastrados. Esses nomes serão agrupados; revise possíveis homônimos.</label>` : ""}<p class="form-error" role="alert"></p><div class="form-actions">${button("sheet-back", "Rever colunas", "ghost")}<button type="button" class="button ghost" data-action="close">Cancelar</button><button type="submit" class="button primary" ${plan.ready.length ? "" : "disabled"}>Importar ${plan.ready.length} processo(s)</button></div></form>`);
  }
  async function acceptBackup(payload) {
    pendingRestore = await decodeBundle(payload);
    pendingMonitoring = payload.monitoring || null;
    const candidate = pendingRestore.state, monitor = pendingMonitoring?.tables;
    if (pendingMonitoring && (pendingMonitoring.format !== "pauta-monitoramento" || ![1, 2, 3].includes(pendingMonitoring.version) || !monitor || !Array.isArray(monitor.events) || !Array.isArray(monitor.jobs))) throw Error("Monitoramento no backup está incompatível.");
    dialog("Conferir restauração", `<p>Este backup contém <strong>${candidate.clients.length} cliente(s), ${candidate.cases.length} caso(s), ${candidate.tasks.length} tarefa(s)</strong>, ${candidate.documents.length} anexo(s), ${candidate.payments.length} lançamento(s) financeiro(s) e ${candidate.events.length} registro(s) do histórico antigo.</p><p class="muted compact">Monitoramento integrado: ${monitor ? monitor.events.length + " evento(s) e " + monitor.jobs.length + " consulta(s)" : "não incluído neste backup"}. Registros locais atuais: ${state.cases.length} processo(s), ${state.documents.length} anexo(s).</p><div class="notice">A restauração substitui os dados atuais. Exporte uma cópia atual antes de selecionar o backup. Não há mesclagem automática.</div><form id="restore-form"><label class="check-field"><input type="checkbox" name="confirmed" required> Tenho uma cópia dos dados atuais e quero substituí-los.</label><div class="form-actions"><button type="button" data-action="close" class="button ghost">Cancelar</button><button type="submit" class="button danger">Substituir pelo backup</button></div><p class="form-error" id="restore-error" role="alert"></p></form>`);
  }
  async function chooseBackup() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", async () => {
      try {
        const file = input.files?.[0];
        if (!file) return;
        if (file.size > 64 * 1024 * 1024) throw Error("Backup excede o limite de 64 MB desta versão.");
        const payload = JSON.parse(await file.text());
        if (payload.format === "pauta-encrypted-backup") {
          pendingEncrypted = payload;
          dialog("Abrir backup protegido", `<form id="decrypt-form">${field("Senha do backup", "password", "", "password", true, 'required maxlength="1024" autocomplete="off"')}<p class="form-error" role="alert"></p><div class="form-actions"><button type="button" data-action="close" class="button ghost">Cancelar</button><button type="submit" class="button primary">Desbloquear e conferir</button></div></form>`);
        } else await acceptBackup(payload);
      } catch (e) {
        pendingRestore = null;
        toast(e.message);
      }
    });
    input.click();
  }
  async function attachDocument(caseId) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.png,.jpg,.jpeg,.webp,.txt";
    input.addEventListener("change", async () => {
      try {
        const file = input.files?.[0];
        if (!file) return;
        await addDocument(caseId, file);
        await refresh(true);
        fullDetail(caseId);
        toast("Anexo salvo no computador e incluído nos próximos backups.");
      } catch (e) {
        toast(e.message);
      }
    });
    input.click();
  }
  async function update(ids, sources) {
    const r = await send("update", { ids, sources });
    toast(r.count ? `${r.count} consulta(s) adicionada(s). Acompanhe os resultados na ficha do processo.` : "Nenhuma consulta adicionada: confira as fontes habilitadas ou consultas já na fila.");
    await refresh(true);
  }
  async function action(name, id, caseId = "") {
    if (name === "scheduled-owner") {
      if (id === "all" || Object.hasOwn(WORK_OWNERS, id)) {
        scheduledOwner = id;
        scheduledPage = 1;
        return render2();
      }
      throw Error("Filtro de responsável inválido.");
    }
    if (name === "scheduled-prev" || name === "scheduled-next") {
      scheduledPage = Math.max(1, scheduledPage + (name === "scheduled-next" ? 1 : -1));
      return render2();
    }
    if (name === "workflow-viewed") {
      await change((s) => markCaseReviewed(s, id));
      if ($("#editor").open && $("#workflow-form")?.dataset.id === id) {
        const y = $("#editor").scrollTop;
        fullDetail(id);
        $("#editor").scrollTop = y;
      }
      return toast("Processo marcado como visto hoje (controle interno).");
    }
    if (name === "workflow-pending-remove") {
      if (!caseId) throw Error("Processo da pendência não identificado.");
      await change((s) => removeCasePending(s, caseId, id));
      if ($("#editor").open && state.cases.some((c) => c.id === caseId)) {
        const y = $("#editor").scrollTop;
        fullDetail(caseId);
        $("#editor").scrollTop = y;
      }
      return toast("Pendência removida da ficha.");
    }
    if (name === "djen-search") return searchDjen($("#entity-form"), apiPost, integrated && serviceOnline);
    if (name === "djen-process") {
      await update([id], ["djen"]);
      return fullDetail(id);
    }
    if (name === "datajud-search") return searchDatajud($("#entity-form"), apiPost, integrated && serviceOnline);
    if (name === "datajud-apply") return applyDatajudSelection($("#entity-form"));
    if (name === "changelog") return showChangelog();
    if (name.startsWith("new-") && ["clients", "cases", "tasks", "appointments", "fees"].includes(name.slice(4))) return edit(name.slice(4));
    if (name.startsWith("edit-")) return edit(name.slice(5), id);
    if (name === "detail") return fullDetail(id);
    if (name === "copy-cnj") {
      const c = state.cases.find((c2) => c2.id === id), info = officialConsultation(c);
      if (!info?.number) throw Error("Número CNJ válido não disponível para copiar.");
      await navigator.clipboard.writeText(info.number);
      return toast("Número CNJ copiado.");
    }
    if (name === "copy-docket") {
      const c = state.cases.find((c2) => c2.id === id), info = officialConsultation(c);
      if (!info?.docket) throw Error("Registro adicional indisponível.");
      await navigator.clipboard.writeText(info.docket);
      return toast("Registro adicional copiado.");
    }
    if (name === "manual-check") return manualCheckDialog(id);
    if (name === "close") {
      pendingRestore = null;
      pendingEncrypted = null;
      pendingWorkbook = null;
      pendingSheetPlan = null;
      pendingDeletion = null;
      return $("#editor").close();
    }
    if (name === "payments") return paymentDialog(id);
    if (name === "reverse-payment") {
      const p2 = state.payments.find((p3) => p3.id === id);
      return dialog("Estornar recebimento", `<p>O lançamento original de ${money(p2.amount)} continuará no histórico.</p><form id="reversal-form" data-id="${escapeHTML(id)}"><div class="form-grid">${field("Data do estorno", "date", dateKey(), "date", false, "required")}${area("Motivo obrigatório", "notes")}</div><p class="form-error" role="alert"></p><div class="form-actions"><button type="button" class="button ghost" data-action="close">Cancelar</button><button type="submit" class="button danger">Confirmar estorno</button></div></form>`);
    }
    if (name === "attach") return attachDocument(id);
    if (name === "download-document") {
      const d = state.documents.find((d2) => d2.id === id), blob = await readDocument(id), url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url;
      a.download = d.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5e3);
      return;
    }
    if (name === "remove-document") {
      const d = state.documents.find((d2) => d2.id === id);
      return dialog("Remover anexo", `<p class="private">${escapeHTML(d.name)}</p><div class="notice">O arquivo será removido deste banco local. Cópias em backups já exportados permanecerão disponíveis.</div>${button("confirm-remove-document", "Confirmar remoção", "danger", id)}`);
    }
    if (name === "confirm-remove-document") {
      const d = state.documents.find((d2) => d2.id === id);
      if (!d) return;
      await removeDocument(id);
      await refresh(true);
      fullDetail(d.caseId);
      toast("Anexo removido.");
      return;
    }
    if (name === "new-task-for") return edit("tasks", "", { caseId: id });
    if (name === "task-from-check") {
      const c = state.cases.find((c2) => (c2.manualChecks || []).some((x) => x.id === id && sameManualIdentity(c2, x)));
      const check = c?.manualChecks.find((x) => x.id === id);
      if (!check || !["attention", "change", "unavailable"].includes(check.result)) throw Error("Conferência não encontrada ou sem pendência.");
      const linked = state.tasks.find((t) => t.caseId === c.id && t.manualCheckId === check.id);
      if (linked) return edit("tasks", linked.id);
      return edit("tasks", "", { caseId: c.id, manualCheckId: check.id, title: "Conferir resultado da consulta processual", notes: `Conferência manual em ${timestamp(check.checkedAt)} no ${PROCESS_SYSTEMS[check.source] || JUDICIAL_SYSTEMS[check.source] || "portal oficial"}: ${MANUAL_CHECK_RESULTS[check.result]}. ${check.notes}` });
    }
    if (name === "retry-source") {
      const response = await send("retry-source", { jobId: id });
      toast(response.count ? "Nova consulta adicionada para esta fonte." : "Essa fonte já está em consulta.");
      return refresh(true);
    }
    if (name === "retry-oab") {
      const response = await send("retry-oab", { jobId: id });
      toast(response.count ? "Busca por OAB adicionada novamente à fila." : "Esta OAB já está em consulta.");
      return refresh(true);
    }
    if (name === "open-sources") {
      location.hash = "#sources";
      return;
    }
    if (name === "task-filter") {
      if (!["open", "done", "all"].includes(id)) return;
      taskFilter = id;
      render2();
      document.querySelector(`[data-action="task-filter"][data-id="${id}"]`)?.focus();
      return;
    }
    if (name === "refresh-publications") return refreshPublications(true);
    if (name === "publication-seen" || name.startsWith("unified-")) {
      const e = unifiedPublications(state, publicationEvents).find((e2) => e2.key === id);
      if (!e) throw Error("Publicação não encontrada. Atualize a lista.");
      if (name === "unified-publication-pdf") {
        downloadPublicationPdf(e);
        return;
      }
      if (name === "unified-publication-official-pdf") return downloadOfficialCertificate(e, { integrated: e.remote, ...e.remote ? { fetcher: apiFetch } : {} });
      if (name === "unified-register-event") {
        if (!validCnj(e.cnj)) throw Error("CNJ inválido.");
        const existing = state.cases.find((c) => c.cnj === e.cnj);
        return existing ? fullDetail(existing.id) : edit("cases", "", { cnj: e.cnj, title: "Processo " + formatCnj(e.cnj) });
      }
      const seen = !e.seen;
      publicationWriteEpoch++;
      if (e.remote) {
        if (seen && !e.is_new && !e.seen) {
          for (const ref of e.serviceRefs) await apiPost("events/seen", { caseId: ref.caseId, source: ref.source, eventId: ref.eventId });
        } else await apiPost("notifications/seen", { events: [{ id: e.id, source: e.source, cnj: e.cnj }], seen });
      }
      publicationEvents = publicationEvents.map((x) => notificationKey(x) === e.key ? { ...x, seen: Number(seen), is_new: Number(!seen) } : x);
      if (e.localIds.length) await mutate((s) => {
        for (const x of s.events) if (notificationKey(x) === e.key) x.seen = seen;
      });
      notificationCenter.lastFetch = 0;
      void notificationCenter.refresh(true);
      await refresh(true);
      toast(seen ? "Publicação conferida." : "Conferência desmarcada.");
      return;
    }
    if (name === "publication-filter") {
      if (!Object.hasOwn(PUBLICATION_FILTERS, id)) throw Error("Filtro de publicações inválido.");
      publicationFilter = id;
      publicationLimit = PUBLICATION_BATCH_SIZE;
      render2();
      document.querySelector(`[data-action="publication-filter"][data-id="${id}"]`)?.focus();
      return;
    }
    if (name === "publication-more") {
      publicationLimit += PUBLICATION_BATCH_SIZE;
      return render2();
    }
    if (name === "publication-pdf") {
      const publication = state.events.find((e) => e.id === id && e.kind === "publication");
      if (!publication) throw Error("Publicação não encontrada para exportar.");
      downloadPublicationPdf(publication);
      return;
    }
    if (name === "publication-official-pdf") {
      const publication = state.events.find((e) => e.id === id && e.kind === "publication");
      if (!publication) throw Error("Publicação não encontrada para baixar certidão.");
      return downloadOfficialCertificate(publication, { integrated: false });
    }
    if (name === "filter-active" || name === "filter-archived") {
      filter = name.slice(7);
      selected.clear();
      return render2();
    }
    if (name === "clear-case-filters") {
      caseCourtFilter = "";
      caseLevelFilter = "";
      caseSystemFilter = "";
      selected.clear();
      return render2();
    }
    if (name === "update-selected") return update([...selected]);
    if (name === "archive-selected" || name === "unarchive-selected") {
      const ids = [...selected], archived = name === "archive-selected";
      await change((s) => {
        for (const c of s.cases) if (ids.includes(c.id)) c.archived = archived;
      }, archived ? "Processos arquivados." : "Processos desarquivados.");
      selected.clear();
      return render2();
    }
    if (name === "delete-selected") {
      pendingDeletion = [...selected];
      const impact = caseDeletionImpact(state, pendingDeletion);
      const blocked = impact.attachments || impact.samples || impact.manualChecks;
      return dialog("Deletar " + impact.cases.length + " processo(s)", `<p class="subheading">${impact.cases.slice(0, 6).map((c) => `<span class="private">${escapeHTML(c.title)}</span>`).join(" · ")}${impact.cases.length > 6 ? " · outros " + (impact.cases.length - 6) : ""}</p><p class="notice">Deletar remove os cadastros selecionados da carteira. Não remove publicações, consultas, tarefas, compromissos nem honorários: vínculos serão desvinculados. A exclusão não é desfeita por “Desarquivar”. Faça backup antes.</p><p class="muted compact">Vínculos preservados: ${impact.tasks} tarefa(s), ${impact.appointments} compromisso(s), ${impact.fees} honorário(s), ${impact.events} evento(s) e ${impact.jobs} consulta(s).</p>${blocked ? `<p class="warning-note" role="alert">Exclusão bloqueada para não perder ${impact.attachments} anexo(s), ${impact.samples} comparação(ões) ou ${impact.manualChecks} conferência(s) manual(is). Remova anexos individualmente; para processos com conferências ou comparações, utilize Arquivar.</p>` : '<p class="warning-note">O título, observações e demais dados exclusivos da ficha serão excluídos. O histórico do serviço integrado será mantido.</p>'}<div class="form-actions"><button type="button" class="button ghost" data-action="close">Cancelar</button>${blocked ? "" : button("confirm-delete-selected", "Confirmar exclusão", "danger")}</div>`);
    }
    if (name === "confirm-delete-selected") {
      if (!pendingDeletion?.length) throw Error("Nenhum processo selecionado para exclusão.");
      const ids = pendingDeletion;
      await mutate((s) => deleteCases(s, ids));
      pendingDeletion = null;
      selected.clear();
      $("#editor").close();
      await refresh(true);
      if (integrated && serviceOnline) await syncBrowser(state, true, state.cases.length === 0);
      return toast(ids.length + " processo(s) removido(s) da carteira. Históricos vinculados preservados.");
    }
    if (name === "update-one") {
      $("#editor").close();
      return update([id]);
    }
    if (name === "backup" || name === "backup-readiness") return exportBackup();
    if (name === "template-csv") {
      downloadCsv(portfolioTemplateCsv(), "Painel-HB-modelo-carteira.csv");
      return toast("Modelo vazio gerado. Edite as colunas e mantenha o CNJ como texto.");
    }
    if (name === "export-portfolio") return exportPortfolioDialog();
    if (name === "download-sheet-report") {
      if (!pendingSheetPlan?.plan) throw Error("Prévia da importação não encontrada.");
      downloadCsv(exportImportReportCsv(pendingSheetPlan.plan), "Painel-HB-relatorio-importacao-" + dateKey() + ".csv");
      return toast("Relatório completo baixado. Contém dados da planilha e não tem senha.");
    }
    if (name === "confirm-export-portfolio") {
      downloadCsv(exportPortfolioCsv(state), "Painel-HB-carteira-" + dateKey() + ".csv");
      $("#editor").close();
      return toast("Carteira exportada. Este CSV não substitui o backup com senha.");
    }
    if (name === "audit-local" || name === "audit-readiness") return showLocalAudit();
    if (name === "source-diagnostics" || name === "source-readiness") return showSourceDiagnostics();
    if (name === "coverage-new") return coverageDialog();
    if (name === "auto-now") {
      if (!integrated || !serviceOnline) throw Error("Inicie o Painel H.B no modo integrado para consultar os tribunais.");
      const ids = state.cases.filter((c) => !c.archived && c.cnj).map((c) => c.id);
      const result = await send("update", { ids });
      toast(result?.count ? `${result.count} consulta(s) adicionada(s) à fila do serviço.` : "Não há novas consultas para adicionar.");
      return refresh(true);
    }
    if (name === "restore") return chooseBackup();
    if (name === "import-cnj") return importDialog();
    if (name === "import-spreadsheet") return spreadsheetFileDialog();
    if (name === "sheet-back") {
      if (!pendingSheetPlan) return spreadsheetFileDialog();
      return spreadsheetMappingDialog(pendingWorkbook.sheets.indexOf(pendingSheetPlan.sheet));
    }
    if (name === "confirm-import") {
      if (!pendingImport?.length) return;
      const numbers = pendingImport;
      await change((s) => {
        for (const n of numbers) if (!s.cases.some((c) => c.cnj === n)) saveEntity(s, "cases", { cnj: n, title: "Processo " + formatCnj(n), stage: "todo" });
      }, "Importação concluída.");
      pendingImport = null;
      $("#editor").close();
      return;
    }
    if (name === "archive") {
      await change((s) => {
        const c = s.cases.find((c2) => c2.id === id);
        if (c) c.archived = !c.archived;
      }, "Arquivo atualizado.");
      selected.delete(id);
      if ($("#editor").open) $("#editor").close();
      return;
    }
    if (name === "complete-task") return change((s) => {
      const t = s.tasks.find((t2) => t2.id === id);
      if (t) t.stage = t.stage === "done" ? "todo" : "done";
    }, "Tarefa atualizada.");
    if (name === "seen") {
      await change((s) => {
        const e = s.events.find((e2) => e2.id === id);
        if (e) e.seen = !e.seen;
      });
      if ($("#editor").open && state.events.find((e) => e.id === id)?.caseId) fullDetail(state.events.find((e) => e.id === id).caseId);
      return;
    }
    if (name === "register-event") {
      const e = state.events.find((e2) => e2.id === id);
      if (!e || !validCnj(e.cnj)) throw Error("Publicação sem CNJ válido.");
      const existing = state.cases.find((c) => c.cnj === e.cnj);
      return existing ? fullDetail(existing.id) : edit("cases", "", { cnj: e.cnj, title: "Processo " + formatCnj(e.cnj) });
    }
    if (name === "reconcile-events") {
      let count = 0;
      await change((s) => {
        count = reconcileEventLinks(s);
      });
      return toast(count ? `${count} publicação(ões) e movimentação(ões) vinculadas ou corrigidas pelo CNJ.` : "Todos os vínculos por CNJ já estão atualizados.");
    }
    if (name === "oab") {
      const result = await send("oab");
      toast(result.count ? "Busca de publicações adicionada à fila." : "Esta OAB já está na fila.");
      return refresh(true);
    }
    if (name === "resume" || name === "cancel") {
      await send(name);
      return refresh(true);
    }
  }
  document.addEventListener("click", (event) => {
    const paging = event.target.closest("[data-case-page]");
    if (paging) {
      event.preventDefault();
      localHistoryPage = Number(paging.dataset.casePage) || 1;
      refreshLocalHistory();
      $("#local-case-history [data-case-page]:not([disabled])")?.focus();
      return;
    }
    const target = event.target.closest("[data-action]");
    if (target) {
      event.preventDefault();
      action(target.dataset.action, target.dataset.id, target.dataset.caseId).catch((e) => toast(e.message));
    }
  });
  $("#update-all").addEventListener("click", () => update(state.cases.filter((c) => !c.archived && c.cnj).map((c) => c.id)).catch((e) => toast(e.message)));
  $("#backup").addEventListener("click", exportBackup);
  $("#privacy").addEventListener("click", () => change((s) => s.settings.privacy = !s.settings.privacy).catch((e) => toast(e.message)));
  $("#skip-to-content").addEventListener("click", () => $("#content").focus());
  $("#close-dialog").addEventListener("click", () => {
    $("#editor").close();
    pendingRestore = null;
  });
  $("#editor").addEventListener("cancel", () => {
    pendingRestore = null;
    pendingEncrypted = null;
  });
  document.addEventListener("input", (event) => {
    if (event.target.closest("#settings-form,#auto-form")) updateSettingsDirty();
    if (event.target.dataset.filter === "search") {
      query = event.target.value;
      if (route === "publications") publicationLimit = PUBLICATION_BATCH_SIZE;
      else if (route === "cases") selected.clear();
      else if (route === "agendados") scheduledPage = 1;
      render2();
    }
    if (event.target.name === "cnj" && event.target.closest("#entity-form")) {
      const form = event.target.closest("#entity-form");
      if (form.dataset.table === "cases") {
        invalidateDatajudIfCnjChanged(form);
        invalidateDjenLookup(form);
        updateCnjInference(form);
      }
      renderCnjChangeWarning();
    }
  });
  document.addEventListener("change", (event) => {
    if (event.target.dataset.scheduledSort) {
      if (Object.hasOwn(SCHEDULE_SORTS, event.target.value)) {
        scheduledSort = event.target.value;
        scheduledPage = 1;
        render2();
      }
      return;
    }
    if (event.target.dataset.workflowPending) {
      const caseId = event.target.dataset.caseId, pendingId = event.target.dataset.workflowPending, scroll = $("#editor").scrollTop;
      change((s) => toggleCasePending(s, caseId, pendingId)).then(() => {
        if ($("#editor").open) {
          fullDetail(caseId);
          $("#editor").scrollTop = scroll;
        }
      }).catch((e) => toast(e.message));
      return;
    }
    if (event.target.closest("#settings-form,#auto-form")) updateSettingsDirty();
    if (event.target.id === "datajud-choice" && event.target.closest("#entity-form")) chooseDatajudRecord(event.target.closest("#entity-form"));
    if (event.target.dataset.caseFilter) {
      const which = event.target.dataset.caseFilter;
      if (which === "court") caseCourtFilter = event.target.value;
      if (which === "level") caseLevelFilter = event.target.value;
      if (which === "system") caseSystemFilter = event.target.value;
      selected.clear();
      render2();
      return;
    }
    if (event.target.name === "sheet-index" && event.target.closest("#sheet-mapping-form")) spreadsheetMappingDialog(Number(event.target.value));
    if (event.target.closest("#coverage-form") && ["caseId", "source"].includes(event.target.name)) coverageJobHint();
    if (event.target.name === "plain" && event.target.closest("#backup-form")) {
      for (const field2 of $("#password-fields").querySelectorAll("input")) {
        field2.disabled = event.target.checked;
        field2.required = !event.target.checked;
      }
      $("#password-fields").hidden = event.target.checked;
    }
    if (event.target.dataset.select) {
      event.target.checked ? selected.add(event.target.dataset.select) : selected.delete(event.target.dataset.select);
      render2();
    }
    if (event.target.dataset.stage) change((s) => {
      const c = s.cases.find((c2) => c2.id === event.target.dataset.stage);
      if (c && STAGES[event.target.value]) {
        c.stage = event.target.value;
        c.updatedAt = now();
      }
    }, "Etapa atualizada.").catch((e) => toast(e.message));
  });
  function updateTimeControls(form) {
    const enabled = form.querySelector("[name=autoUpdateEnabled]").checked;
    const rows = [...form.querySelectorAll("[data-time-list] > div")];
    rows.forEach((row, i) => {
      row.querySelector("label").firstChild.textContent = "Horário " + (i + 1);
      row.querySelector("button").setAttribute("aria-label", "Remover horário " + (i + 1));
    });
    const add = form.querySelector("[data-time-add]");
    add.disabled = rows.length >= 6 || !enabled;
    form.querySelector("[data-time-help]").textContent = rows.length >= 6 ? "Limite de 6 horários atingido. Remova um horário para adicionar outro." : !enabled ? "Ative para editar os horários. Os horários salvos serão preservados." : rows.length ? "Horários repetidos serão reunidos e ordenados ao salvar." : "Adicione ao menos um horário antes de salvar a ativação.";
    for (const button2 of form.querySelectorAll("[data-time-remove]")) button2.disabled = !enabled;
  }
  document.addEventListener("click", (event) => {
    const t = event.target;
    const form = t.closest("#settings-form");
    if (form && t.matches("[data-key-edit],[data-key-remove],[data-key-cancel]")) {
      settingsDirty = true;
      const box = form.querySelector("[data-key-editor]"), input = box.querySelector("input");
      if (t.matches("[data-key-edit]")) {
        box.hidden = false;
        input.disabled = false;
        input.value = "";
        input.required = true;
        input.focus();
      }
      if (t.matches("[data-key-cancel]")) {
        box.hidden = true;
        input.disabled = true;
        input.required = false;
        input.value = "";
      }
      if (t.matches("[data-key-remove]") && confirm("Remover a chave ao salvar configurações? Consultas ao DataJud ficarão indisponíveis até configurar outra chave.")) {
        box.hidden = false;
        input.disabled = false;
        input.required = false;
        input.value = "";
        input.placeholder = "Remoção pendente. Salve as configurações ou cancele.";
      }
      updateSettingsDirty();
    }
    const auto = t.closest("#auto-form");
    if (!auto) return;
    settingsDirty = true;
    if (t.matches("[data-time-add]")) {
      const list = auto.querySelector("[data-time-list]");
      if (list.children.length >= 6) {
        toast("Você pode configurar até 6 horários.");
        return;
      }
      const enabled = auto.querySelector("[name=autoUpdateEnabled]").checked;
      list.insertAdjacentHTML("beforeend", scheduleRow("", list.children.length + 1, enabled));
      const input = list.lastElementChild.querySelector("input");
      if (enabled) input.focus();
      updateTimeControls(auto);
    }
    if (t.matches("[data-time-remove]")) {
      t.parentElement.remove();
      updateTimeControls(auto);
      auto.querySelector("[data-time-add]").focus();
    }
    updateSettingsDirty();
  });
  document.addEventListener("change", (event) => {
    if (event.target.name === "autoUpdateEnabled") {
      const f = event.target.form;
      for (const x of f.querySelectorAll("[name=autoTime]")) {
        x.required = event.target.checked;
        x.disabled = !event.target.checked;
      }
      updateTimeControls(f);
      updateSettingsDirty();
    }
  });
  document.addEventListener("click", (event) => {
    const t = event.target.closest('[data-action="close"],#close-dialog,a[href^="#"]');
    if (!t) return;
    const closing = t.matches('[data-action="close"],#close-dialog');
    if ((closing ? editorChanged() : settingsDirty) && !confirm("Há alterações não salvas. Deseja descartá-las?")) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  $("#editor").addEventListener("cancel", (event) => {
    if (editorChanged() && !confirm("Descartar as alterações não salvas?")) event.preventDefault();
  });
  window.addEventListener("beforeunload", (event) => {
    if (settingsDirty || editorChanged()) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!["entity-form", "settings-form", "auto-form", "import-form", "restore-form", "backup-form", "decrypt-form", "payment-form", "reversal-form", "manual-check-form", "coverage-form", "sheet-file-form", "sheet-mapping-form", "sheet-confirm-form", "workflow-form", "workflow-pending-form"].includes(form.id)) return;
    event.preventDefault();
    const submit = form.querySelector("[type=submit]");
    if (submit.disabled) return;
    submit.disabled = true;
    submit.dataset.loading = "true";
    submit.setAttribute("data-loading-fixed", "");
    submit.setAttribute("aria-busy", "true");
    try {
      const data = Object.fromEntries(new FormData(form));
      for (const name of ["amount", "paid"]) if (data[name] !== void 0 && String(data[name]).trim()) data[name] = normalizeMoneyInput(data[name]);
      if (form.id === "workflow-form") {
        const caseId = form.dataset.id, scroll = $("#editor").scrollTop;
        await change((s) => updateCaseWorkflow(s, caseId, data));
        fullDetail(caseId);
        $("#editor").scrollTop = scroll;
        toast("Próximo passo, responsável e revisão salvos.");
      }
      if (form.id === "workflow-pending-form") {
        const caseId = form.dataset.id, scroll = $("#editor").scrollTop;
        await change((s) => addCasePending(s, caseId, data.title));
        fullDetail(caseId);
        $("#editor").scrollTop = scroll;
        toast("Pendência adicionada ao processo.");
      }
      if (form.id === "sheet-file-form") {
        pendingWorkbook = await readSpreadsheet(data.file);
        spreadsheetMappingDialog();
      }
      if (form.id === "sheet-mapping-form") {
        const sheet = pendingWorkbook?.sheets?.[Number(data["sheet-index"] || 0)];
        if (!sheet) throw Error("Aba não selecionada.");
        const mapping = Object.fromEntries(Object.keys(IMPORT_FIELDS).map((key) => [key, Number(data["map-" + key])]));
        const plan = planSpreadsheetImport(state, sheet, mapping);
        spreadsheetPreviewDialog(sheet, mapping, plan);
      }
      if (form.id === "sheet-confirm-form") {
        if (data.confirmed !== "yes" || !pendingSheetPlan?.plan) throw Error("Confirme a prévia antes de importar.");
        let result;
        await change((s) => {
          result = commitSpreadsheetImport(s, pendingSheetPlan.sheet, pendingSheetPlan.mapping, pendingSheetPlan.plan, { linkExistingClients: data.confirmedExisting === "yes" });
        });
        pendingSheetPlan = null;
        pendingWorkbook = null;
        $("#editor").close();
        toast(`${result.imported} processos importados, ${result.clientsAdded} cliente(s) novo(s). ${result.ignored} linha(s) ignoradas. Nenhuma consulta iniciada.${result.appointmentsAdded ? ` ${result.appointmentsAdded} audiência(s) adicionada(s) à agenda.` : ""}`);
      }
      if (form.id === "backup-form") {
        if (!data.plain && data.password !== data.confirmation) throw Error("As senhas não coincidem.");
        const bundle = await exportBundle();
        if (integrated) bundle.monitoring = await exportMonitoring();
        const payload = data.plain ? bundle : await encryptBackup(bundle, data.password);
        downloadJSON(payload, `Painel-HB-backup-${data.plain ? "aberto" : "protegido"}-${dateKey()}.json`);
        $("#editor").close();
        toast(data.plain ? "Backup sem senha exportado. Guarde em local privado." : "Backup com senha exportado, incluindo monitoramento e anexos. Guarde a senha.");
      }
      if (form.id === "decrypt-form") {
        const decoded = await decryptBackup(pendingEncrypted, data.password);
        pendingMonitoring = decoded.monitoring || null;
        await acceptBackup(decoded);
        pendingEncrypted = null;
      }
      if (form.id === "payment-form") {
        const feeId = form.dataset.id;
        await change((s) => registerPayment(s, { ...data, feeId }));
        paymentDialog(feeId);
        toast("Recebimento registrado.");
      }
      if (form.id === "reversal-form") {
        let feeId;
        await change((s) => {
          feeId = reversePayment(s, form.dataset.id, data).feeId;
        });
        paymentDialog(feeId);
        toast("Estorno registrado sem apagar o lançamento original.");
      }
      if (form.id === "manual-check-form") {
        const caseId = form.dataset.id;
        await change((s) => registerManualCheck(s, { ...data, caseId }));
        fullDetail(caseId);
        toast("Resultado da conferência salvo no histórico.");
      }
      if (form.id === "coverage-form") {
        await change((s) => registerCoverageSample(s, data));
        $("#editor").close();
        toast("Comparação manual salva. Confira o histórico em Fontes e ajustes.");
      }
      if (form.id === "entity-form") {
        if (form.dataset.table === "cases") data.datajudDetails = getDatajudDraft(form);
        await mutate((s) => {
          if (integrated && Number(form.dataset.revision) !== s.revision) throw Error("A carteira foi alterada em segundo plano. Feche e reabra este formulário para conferir os dados atuais.");
          return saveEntity(s, form.dataset.table, { ...data, id: form.dataset.id });
        });
        $("#editor").close();
        await refresh(true);
        toast("Registro salvo.");
      }
      if (form.id === "settings-form") {
        const days = Number(data.djenDays);
        if (!Number.isInteger(days) || days < 1 || days > 365) throw Error("Informe um período de 1 a 365 dias.");
        const oab = String(data.oab || "").replace(/[\s.\-]/g, "").toUpperCase(), uf = String(data.ufOab || "");
        if (oab && !uf) throw Error("Selecione a UF da OAB.");
        if (uf && !oab) throw Error("Informe o número da OAB ou deixe a UF sem seleção.");
        if (oab && !/^\d{1,8}[A-Za-z]?$/.test(oab)) throw Error("Confira o número da OAB.");
        await mutate((s) => Object.assign(s.settings, { datajud: !!data.datajud, djen: !!data.djen, datajudKey: (data.datajudKey === void 0 ? s.settings.datajudKey : String(data.datajudKey)).trim().replace(/^APIKey\s+/i, "").trim(), djenDays: days, oab, ufOab: uf }));
        rememberForm(form);
        updateSettingsDirty();
        await refresh(true);
        toast("Configurações salvas.");
      }
      if (form.id === "auto-form") {
        const enabled = data.autoUpdateEnabled === "on";
        const values = [...form.querySelectorAll("[name=autoTime]")].map((x) => x.value);
        if (enabled && values.some((x) => !x)) throw Error("Preencha o horário vazio ou remova essa linha.");
        const times = enabled ? parseAutoTimes(values.join(",")) : autoScheduleInfo(state.settings).times;
        await mutate((s) => Object.assign(s.settings, { autoUpdateEnabled: data.autoUpdateEnabled === "on", autoUpdateTimes: times.join(",") }));
        rememberForm(form);
        updateSettingsDirty();
        await refresh(true);
        toast(data.autoUpdateEnabled === "on" ? "Atualização automática ativada: " + times.join(", ") + "." : "Atualização automática desativada.");
      }
      if (form.id === "import-form") {
        const lines = String(data.numbers).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
        if (lines.length > 500) throw Error("Importe até 500 números por vez.");
        const seen = new Set(state.cases.map((c) => c.cnj));
        const preview = lines.map((line) => {
          const cnj = digits(line);
          const error = !validCnj(cnj) ? "CNJ inválido" : seen.has(cnj) ? "Já cadastrado ou repetido" : "";
          seen.add(cnj);
          return { cnj, line, error };
        });
        pendingImport = preview.filter((x) => !x.error).map((x) => x.cnj);
        dialog("Prévia da importação", `<p>${pendingImport.length} processo(s) pronto(s) para cadastrar. ${preview.length - pendingImport.length} linha(s) serão ignoradas.</p><div class="import-preview">${preview.map((x) => `<p class="${x.error ? "import-error" : ""}">${escapeHTML(x.line)} · ${x.error || "Pronto para cadastrar"}</p>`).join("")}</div><div class="form-actions">${button("import-cnj", "Voltar", "ghost")}${pendingImport.length ? button("confirm-import", "Cadastrar " + pendingImport.length + " processo(s)", "primary") : ""}</div>`);
      }
      if (form.id === "restore-form") {
        if (!data.confirmed || !pendingRestore) throw Error("Confirme a substituição.");
        if (state.jobs.some((j2) => ["queued", "running"].includes(j2.status))) throw Error("Cancele e aguarde as consultas antes de restaurar.");
        if (integrated && pendingMonitoring) await restoreMonitoring(pendingMonitoring);
        await restoreBundle(pendingRestore);
        pendingRestore = null;
        pendingMonitoring = null;
        selected.clear();
        $("#editor").close();
        await refresh(true);
        if (integrated && serviceOnline) await syncBrowser(state, true);
        toast("Backup restaurado. Confira cadastros, anexos, totais e monitoramento antes de continuar.");
      }
    } catch (e) {
      const error = form.querySelector(".form-error");
      if (error) {
        error.textContent = e.message;
        error.tabIndex = -1;
        error.focus();
      } else toast(e.message);
    } finally {
      if (submit.isConnected) {
        submit.disabled = false;
        submit.removeAttribute("data-loading");
        submit.removeAttribute("data-loading-fixed");
        submit.removeAttribute("aria-busy");
      }
    }
  });
  window.addEventListener("hashchange", () => {
    route = Object.hasOwn(routes, location.hash.slice(1)) ? location.hash.slice(1) : "home";
    query = "";
    settingsDirty = false;
    scheduledPage = 1;
    publicationFilter = "all";
    publicationFetched = 0;
    publicationLimit = PUBLICATION_BATCH_SIZE;
    selected.clear();
    render2();
  });
  async function start() {
    route = Object.hasOwn(routes, location.hash.slice(1)) ? location.hash.slice(1) : "home";
    await initializeWorkspace();
    await refresh(true);
    installIntegratedActions({ update, toast });
    if (integrated) {
      await connect(state);
      decorateIntegrated(route, state);
      organizePanel(route);
      void notificationCenter.refresh(true);
      void refreshPublications();
      setInterval(async () => {
        if (!document.hidden) {
          await refresh().catch(() => {
          });
          await pollService();
          if (!serviceOnline) await connect(state);
          decorateIntegrated(route, state);
          organizePanel(route);
          void notificationCenter.refresh();
          void refreshPublications();
          await refreshIntegratedCase();
        }
      }, 3500);
    } else {
    }
  }
  globalThis.__PAUTA_BOOTED__ = true;
  start().catch((e) => {
    $("#content").textContent = "Não foi possível abrir o banco local: " + e.message;
  });
})();

/** Experimental chat protocol. No provider credentials, model SDK or global routing. */
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
const digest = (value) => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
let runtimePromise;
async function runtime() {
    if (!runtimePromise)
        runtimePromise = Promise.all([
            import(new URL('../scripts/generation-compact-cases.mjs', import.meta.url).href),
            import(new URL('../scripts/generation-compact-session.mjs', import.meta.url).href),
            import(new URL('../scripts/generation-compact-kit.mjs', import.meta.url).href),
        ]).then(parts => Object.assign({}, ...parts)).catch(error => { runtimePromise = undefined; throw error; });
    return runtimePromise;
}
function atomicJson(path, value) {
    const tmp = path + '.tmp-' + randomUUID();
    writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
    renameSync(tmp, path);
}
export class PptGenerationService {
    root;
    options;
    constructor(options) {
        this.options = options;
        this.root = resolve(options.root ?? join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'plugins', 'dsh-ppt', 'generation'));
    }
    namespace(scope) {
        if (!/^[a-f0-9]{64}$/.test(scope))
            throw new Error('ppt_generation requires a trusted DSH session ID');
        return join(this.root, scope);
    }
    file(dir, id) {
        if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id))
            throw new Error('Invalid experiment runId');
        return join(dir, id);
    }
    read(dir, id) {
        const out = this.file(dir, id);
        if (!existsSync(join(out, 'state.json')))
            throw new Error('Experiment not found in this user/session');
        const state = readJson(join(out, 'state.json'));
        if (state.version !== 1 || state.runId !== id || !Number.isSafeInteger(state.responses) || state.responses < 0 || state.responses > 4)
            throw new Error('Invalid stored experiment state');
        return state;
    }
    event(out, type, data = {}) {
        appendFileSync(join(out, 'events.jsonl'), JSON.stringify({ version: 1, at: new Date().toISOString(), type, ...data }) + '\n');
    }
    responses(out, state) {
        return Array.from({ length: state.responses }, (_, i) => {
            const row = readJson(join(out, 'responses', String(i + 1) + '.json'));
            if (typeof row.text !== 'string' || digest(row.text) !== row.responseSha256 || row.responseSha256 !== state.responseHashes?.[i])
                throw new Error('Saved experiment response changed; original evidence must be retained');
            return row;
        });
    }
    async locked(dir, work) {
        mkdirSync(dir, { recursive: true });
        const path = join(dir, '.lock'), lease = { pid: process.pid, token: randomUUID() };
        let fd;
        try {
            fd = openSync(path, 'wx');
        }
        catch (error) {
            if (error.code !== 'EEXIST')
                throw error;
            const isStale = () => {
                try {
                    const previous = readJson(path);
                    if (Number.isSafeInteger(previous.pid) && previous.pid > 0) {
                        try {
                            process.kill(previous.pid, 0);
                        }
                        catch (e) {
                            return e.code === 'ESRCH';
                        }
                    }
                }
                catch { /* An unreadable lease cannot be safely replaced. */ }
                return false;
            };
            const stale = isStale();
            if (!stale)
                throw new Error('Experiment is busy; read status after the current tool finishes. Do not submit the answer again as a new turn.');
            // Serialize reapers so two restarted workers cannot delete a fresh lease.
            const reapPath = join(dir, '.recovery');
            let reap;
            try {
                reap = openSync(reapPath, 'wx');
            }
            catch {
                throw new Error('Experiment lock recovery is busy; preserve state and retry status later');
            }
            try {
                writeFileSync(reap, JSON.stringify(lease));
                if (!isStale())
                    throw new Error('Experiment is busy; its lease changed during recovery');
                unlinkSync(path);
                // A normal claimant may win this gap; never remove its new lease.
                fd = openSync(path, 'wx');
            }
            finally {
                closeSync(reap);
                if (existsSync(reapPath) && readJson(reapPath).token === lease.token)
                    unlinkSync(reapPath);
            }
        }
        try {
            writeFileSync(fd, JSON.stringify(lease));
            return await work();
        }
        finally {
            closeSync(fd);
            if (existsSync(path) && readJson(path).token === lease.token)
                unlinkSync(path);
        }
    }
    view(state) {
        return {
            ok: ['waiting-for-response', 'exported'].includes(state.status), operation: 'experiment', runId: state.runId,
            status: state.status, mode: state.mode, caseId: state.caseId, templateKey: state.templateKey,
            calls: state.responses, corrections: state.corrections, maxCorrections: 2,
            acceptance: 'not-verified', responseCapture: 'tool-argument', route: state.route, routeVerification: state.route ? 'host-metadata' : 'unavailable',
            timing: state.timing, usage: { inputTokens: null, outputTokens: null, cost: null, reason: 'Provider billing is unavailable to this tool; never estimate or supply it from model self-report.' },
            ...(state.status === 'waiting-for-response' ? { expectedTurn: state.responses + 1, nextRequest: state.pending,
                nextAction: 'Generate the strict JSON requested by nextRequest. Call ppt_generation operation:submit with this runId, expectedTurn and responseText containing that exact JSON. Do not call ppt_create. Do not start a new experiment to reset the repair budget.' } : {}),
            diagnostics: state.diagnostics ?? [],
            ...(state.artifacts ?? {}),
            ...(state.artifacts ? { status: state.status, acceptance: 'not-verified' } : {}),
            experiment: { runId: state.runId, mode: state.mode, caseId: state.caseId, templateKey: state.templateKey, status: state.status, calls: state.responses, corrections: state.corrections, acceptance: 'not-verified', note: 'Use operation:report for the current chat experiment log. Exported files require human visual/factual/editability review.' },
        };
    }
    recover(out, state) {
        // Holding the namespace lease proves that no previous operation is active.
        const orphan = join(out, 'responses', String(state.responses + 1) + '.json');
        const hasOrphan = state.status === 'waiting-for-response' && existsSync(orphan);
        if (state.status !== 'processing' && !hasOrphan)
            return;
        if (hasOrphan) {
            const row = readJson(orphan);
            if (typeof row.text !== 'string' || digest(row.text) !== row.responseSha256)
                throw new Error('Uncommitted response is corrupt; retain evidence for investigation');
            state.responses++;
            state.responseHashes.push(row.responseSha256);
            state.timing.firstSubmissionAt ??= row.capturedAt;
            state.timing.lastSubmissionAt = row.capturedAt;
        }
        state.status = 'interrupted';
        state.pending = null;
        state.diagnostics = [{ code: 'experiment-interrupted', path: 'run', slideId: null, message: 'Previous processing was interrupted. Saved responses and any export files are retained; no automatic replay/export or budget reset.' }];
        state.timing.finishedAt = new Date().toISOString();
        this.event(out, 'interrupted', { responses: state.responses });
        atomicJson(join(out, 'state.json'), state);
    }
    async execute(args, context) {
        context.signal?.throwIfAborted();
        const dir = this.namespace(context.scope);
        if (args.operation === 'list') {
            const mod = await runtime(), cases = mod.compactCases(), templates = mod.compactTemplates();
            return { ok: true, experimental: true, targetModel: 'glm-5.3-flash', modes: ['A', 'B', 'C'],
                cases: cases.map((c) => ({ id: c.id, title: c.title })),
                templates: templates.map((t) => ({ key: t.key, name: t.manifest.name, pageSize: t.manifest.style.pageSize })),
                pilot: ['cards', 'chart', 'long-ru', 'overload'].flatMap((caseId, i) => [0, 1, 2].map(order => ({ caseId, templateKey: templates[i].key, mode: ['A', 'B', 'C'][(i + order) % 3] }))),
                instructions: 'Only run when the user explicitly requests the experimental A/B/C pilot. Each experiment uses one fresh DSH chat. Use operation:start with experimental:true, mode, caseId, templateKey. Built-in sources are controlled demo content and templates are explicitly style references. Clarify missing requirements with ask_user_question; do not repeat already answered questions. No provider requests are made by this tool.' };
        }
        return this.locked(dir, async () => {
            const mod = await runtime();
            context.signal?.throwIfAborted();
            if (args.operation === 'start') {
                if (args.experimental !== true)
                    throw new Error('Explicit experimental:true is required for a user-requested pilot');
                if (!['A', 'B', 'C'].includes(args.mode))
                    throw new Error('Choose mode A, B or C');
                const base = mod.compactCases().find((c) => c.id === args.caseId), template = mod.compactTemplates().find((t) => t.key === args.templateKey);
                if (!base || !template)
                    throw new Error('Choose known caseId/templateKey from operation:list');
                const active = join(dir, 'active.json');
                if (existsSync(active)) {
                    const state = this.read(dir, readJson(active).runId);
                    if (state.mode !== args.mode || state.caseId !== args.caseId || state.templateKey !== args.templateKey)
                        throw new Error('Use a fresh DSH chat for the next experiment; changing mode/task cannot reset this chat repair budget');
                    this.recover(this.file(dir, state.runId), state);
                    return { ...this.view(state), alreadyStarted: true };
                }
                const { rubric, ...data } = base;
                if (context.route && context.route.model !== 'glm-5.3-flash')
                    throw new Error('Select glm-5.3-flash in DSH before starting this controlled pilot; the tool never switches models');
                const task = { ...data, brief: { ...base.brief, goal: base.brief.goal + '\n' + base.instruction, templateId: template.manifest.id } };
                const result = await mod.processCompactRecording({ mode: args.mode, task, template, rubric, recording: { version: 1, responses: [] }, signal: context.signal });
                const runId = randomUUID(), out = this.file(dir, runId);
                mkdirSync(join(out, 'responses'), { recursive: true });
                const input = { task, template, rubric }, now = new Date().toISOString();
                writeFileSync(join(out, 'input.json'), JSON.stringify(input), { flag: 'wx' });
                const state = { version: 1, runId, mode: args.mode, caseId: args.caseId, templateKey: args.templateKey, status: result.status, responses: 0, responseHashes: [], corrections: result.corrections,
                    inputSha256: digest(input), versions: mod.codeVersions(), pending: result.pending, diagnostics: result.diagnostics, outputDir: join(context.outputDir, 'experiment-' + runId), route: context.route,
                    timing: { serverStartedAt: now, firstSubmissionAt: null, lastSubmissionAt: null, finishedAt: null }, clarificationVerification: 'host-history-unavailable' };
                this.event(out, 'started', { runId, mode: state.mode, caseId: state.caseId, templateKey: state.templateKey, versions: state.versions, request: result.pending, route: context.route });
                atomicJson(join(out, 'state.json'), state);
                atomicJson(active, { runId });
                return this.view(state);
            }
            let runId = args.runId;
            if (['status', 'report'].includes(args.operation) && runId === undefined) {
                const active = join(dir, 'active.json');
                if (!existsSync(active))
                    throw new Error('No active experiment in this user/session; use operation:start first');
                runId = readJson(active).runId;
            }
            const state = this.read(dir, runId), out = this.file(dir, runId);
            this.recover(out, state);
            const responses = this.responses(out, state);
            if (args.operation === 'status')
                return this.view(state);
            if (args.operation === 'report') {
                mkdirSync(state.outputDir, { recursive: true });
                const reportPath = join(state.outputDir, 'experiment-log-' + randomUUID() + '.json');
                const { rubric: privateRubric, ...publicInput } = readJson(join(out, 'input.json'));
                const report = { version: 1, ...state, input: publicInput, responses, events: readFileSync(join(out, 'events.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line)), capture: 'Exact submitted tool argument strings; full model/tool transcript and actual provider usage must be exported from DSH separately.', acceptance: 'not-verified' };
                writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
                return { ok: true, runId: state.runId, status: state.status, reportPath, reportSha256: digest(readFileSync(reportPath)), acceptance: 'not-verified' };
            }
            if (args.operation !== 'submit')
                throw new Error('Expected operation list/start/status/submit/report');
            if (!Number.isSafeInteger(args.expectedTurn) || args.expectedTurn < 1 || args.expectedTurn > 4)
                throw new Error('Use expectedTurn returned by the experiment');
            if (typeof args.responseText !== 'string' || args.responseText.length > 4 * 1024 * 1024)
                throw new Error('Submit exact responseText (up to 4 MiB); invalid/empty JSON is recorded and consumes its attempt');
            const responseHash = digest(args.responseText);
            if (args.expectedTurn <= state.responses) {
                const previous = readJson(join(out, 'responses', String(args.expectedTurn) + '.json'));
                if (previous.responseSha256 !== responseHash)
                    throw new Error('Conflicting/stale answer for an already recorded turn; original response was preserved');
                return { ...this.view(state), duplicateSubmission: true };
            }
            if (state.status !== 'waiting-for-response')
                throw new Error('Experiment is terminal; use status/report and retain the outcome');
            if (args.expectedTurn !== state.responses + 1)
                throw new Error('Stale/out-of-order expectedTurn');
            const input = readJson(join(out, 'input.json'));
            if (digest(input) !== state.inputSha256)
                throw new Error('Experiment input snapshot changed');
            if (mod.codeVersions().codeSha256 !== state.versions.codeSha256)
                throw new Error('Plugin code changed during this experiment; preserve this run and use a fresh chat after deployment');
            const now = new Date().toISOString(), row = { text: args.responseText, responseSha256: responseHash, stage: state.pending.stage, kind: state.pending.kind, route: context.route, capturedAt: now, capture: 'tool-argument' };
            writeFileSync(join(out, 'responses', String(args.expectedTurn) + '.json'), JSON.stringify(row), { flag: 'wx' });
            state.responses++;
            state.responseHashes.push(responseHash);
            state.status = 'processing';
            state.timing.firstSubmissionAt ??= now;
            state.timing.lastSubmissionAt = now;
            this.event(out, 'submission', { turn: args.expectedTurn, response: row });
            atomicJson(join(out, 'state.json'), state);
            if (state.route && context.route && digest(state.route) !== digest(context.route)) {
                state.status = 'route-changed';
                state.pending = null;
                state.timing.finishedAt = now;
                state.diagnostics = [{ code: 'route-changed', path: 'run', slideId: null, message: 'The trusted DSH provider/model changed during this experiment. Response retained; no mixed-route export or automatic reset.' }];
                this.event(out, 'route-changed', { route: context.route });
                atomicJson(join(out, 'state.json'), state);
                return this.view(state);
            }
            const turnDir = join(out, 'turn-' + args.expectedTurn);
            mkdirSync(turnDir);
            responses.push(row);
            const result = await mod.processCompactRecording({ mode: state.mode, ...input, recording: { version: 1, responses }, signal: context.signal,
                exportDeck: async (create) => {
                    context.signal?.throwIfAborted();
                    writeFileSync(join(out, 'export-started.json'), JSON.stringify({ at: new Date().toISOString(), outputDir: state.outputDir }), { flag: 'wx' });
                    const engine = await this.options.loadEngine();
                    return (engine.buildDeckAsync ?? engine.buildDeck)({ ...create, outputDir: state.outputDir, internalProject: true, cacheScope: context.scope, maxSlides: this.options.maxSlides, signal: context.signal });
                } });
            const { journal, pending, ...summary } = result;
            writeFileSync(join(turnDir, 'trace.jsonl'), journal.map((e) => JSON.stringify({ ...e, offlineReplay: true })).join('\n') + '\n', { flag: 'wx' });
            writeFileSync(join(turnDir, 'result.json'), JSON.stringify(summary, null, 2), { flag: 'wx' });
            state.status = result.status;
            state.pending = pending;
            state.corrections = result.corrections;
            state.diagnostics = result.diagnostics;
            state.artifacts = result.artifacts;
            if (!pending)
                state.timing.finishedAt = new Date().toISOString();
            this.event(out, 'validated', { turn: args.expectedTurn, status: state.status, corrections: state.corrections, diagnostics: state.diagnostics, request: pending, artifacts: state.artifacts });
            atomicJson(join(out, 'state.json'), state);
            return this.view(state);
        });
    }
}

import { useEffect, useRef, useState } from 'react';
import { Search, ShieldCheck, RefreshCw, Download, Sparkles } from 'lucide-react';
import { Button, EmptyState, Tabs } from './components/ui/Primitives';
import { ANALYSIS_ACTIONS, AnalysisView, InterpretationLine, NaturalResults, type AnalysisState } from './components/OfwNaturalLanguage';
import type { OfwAnalysisEvent, OfwAnalysisTask } from './types';

type RecordData = Record<string, unknown>;
const record = (v:unknown):RecordData => v && typeof v==='object' && !Array.isArray(v) ? v as RecordData : {};
const show = (v:unknown):string => v == null ? '' : typeof v==='object' ? JSON.stringify(v,null,2) : String(v);
type DateRange = { since: string; until: string };
let sessionDateRange: DateRange | null = null;
function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function today() { return formatLocalDate(new Date()); }
function defaultDateRange(): DateRange {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 60);
  return { since: formatLocalDate(start), until: formatLocalDate(end) };
}
const makeId = () => `ofw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type MessageMode = 'natural' | 'exact';

export function OfwPanel() {
  const initialDateRange = sessionDateRange ?? defaultDateRange();
  const [tab,setTab]=useState('messages');
  const [connected,setConnected]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('Connect to verify your account, then sync messages before searching.');
  const [q,setQ]=useState('');
  const [mode,setMode]=useState<MessageMode>('natural');
  // Calendar keeps its 60-day window. For messages, dates are an optional
  // override: the question itself can say "last month" or "since March".
  const [since,setSince]=useState(initialDateRange.since);
  const [until,setUntil]=useState(initialDateRange.until);
  const [msgSince,setMsgSince]=useState('');
  const [msgUntil,setMsgUntil]=useState('');
  const [folder,setFolder]=useState('auto');
  const [result,setResult]=useState<RecordData|null>(null);
  const [detail,setDetail]=useState<RecordData|null>(null);
  const [snapshot,setSnapshot]=useState<{at:string;action:string;filters:RecordData}|null>(null);
  const [analysis,setAnalysis]=useState<AnalysisState|null>(null);
  const [qwenReady,setQwenReady]=useState<boolean|null>(null);
  const [copied,setCopied]=useState('');
  const cancelRef=useRef<(() => void) | null>(null);
  const desktop=Boolean(window.agentForce?.ofw);

  useEffect(() => {
    if (!window.agentForce?.qwenHealth) return;
    let live = true;
    window.agentForce.qwenHealth().then((r) => { if (live) setQwenReady(r.ok); }).catch(() => { if (live) setQwenReady(false); });
    return () => { live = false; cancelRef.current?.(); };
  }, []);

  async function run(action:string,input:RecordData={}) {
    if(!window.agentForce?.ofw) return;
    setBusy(true);setError('');
    try {
      const response=await window.agentForce.ofw(action,input);
      if(!response.ok) throw new Error(response.error || 'Unable to read OFW');
      const data=record(response.data);
      if(action==='connect') {
        setConnected(true);
        setNotice(`Account verified. OFW writes and read receipts are disabled. Natural-language search: ${data.naturalLanguageSearch==='connector'?'provided by the connector':'ranked in this app (connector has no ofw_search_messages)'}.`);
      }
      else if(action==='sync') {setNotice(`Sync response: ${show(data)}`);setResult(null);setDetail(null);}
      else if(action==='message') setDetail(data);
      else {setResult(data);setDetail(null);setSnapshot({at:new Date().toISOString(),action,filters:input});}
      return data;
    } catch(e) {setError(e instanceof Error?e.message:'OFW request failed');if(action==='connect')setConnected(false);}
    finally {setBusy(false);}
  }

  function messageFilters(): RecordData {
    return {
      ...(folder !== 'auto' ? { folderId: folder } : {}),
      ...(msgSince ? { since: msgSince } : {}),
      ...(msgUntil ? { until: msgUntil } : {})
    };
  }

  function search(page=1,start=0) {
    if (tab==='messages') {
      if (!q.trim()) { setError('Type a question or words to search for.'); return; }
      void run('nlsearch', { query: q.trim(), mode, limit: 25, ...messageFilters() });
      return;
    }
    const input = tab==='calendar' ? {startDate:since||today(),endDate:until||today()} : {start};
    void run(tab,input);
  }

  async function syncThenSearch() {
    await run('sync');
    if (snapshot?.action === 'nlsearch') void run('nlsearch', snapshot.filters);
  }

  function analyze(task: OfwAnalysisTask) {
    const bridge = window.agentForce;
    if (!bridge?.ofwAnalyze) return;
    const question = q.trim();
    if (task === 'answer' && !question) { setError('Type a question for Qwen to answer.'); return; }
    cancelRef.current?.();
    const requestId = makeId();
    const label = ANALYSIS_ACTIONS.find((a) => a.task === task)?.label ?? task;
    setError('');
    setAnalysis({ task, label, question, phase: 'retrieving', text: '', sources: [], caveats: [], startedAt: Date.now() });
    const f = messageFilters();
    cancelRef.current = bridge.ofwAnalyze(requestId, {
      task, query: question,
      folderId: typeof f.folderId === 'string' ? f.folderId : undefined,
      since: typeof f.since === 'string' ? f.since : undefined,
      until: typeof f.until === 'string' ? f.until : undefined
    }, (event: OfwAnalysisEvent) => {
      setAnalysis((current) => {
        if (!current) return current;
        switch (event.type) {
          case 'sources': return { ...current, label: current.label, sources: event.sources, caveats: event.caveats, phase: 'thinking' };
          case 'phase': return { ...current, phase: event.phase === 'retrieving' ? 'retrieving' : 'thinking' };
          case 'token': return { ...current, phase: 'streaming', text: current.text + event.token };
          case 'done': return { ...current, phase: 'done' };
          case 'error': {
            const cancelled = /^CANCELLED:/.test(event.error);
            return { ...current, phase: cancelled ? 'cancelled' : 'error', error: cancelled ? undefined : friendlyModelError(event.error) };
          }
          default: return current;
        }
      });
    });
  }

  function stopAnalysis() {
    cancelRef.current?.();
    cancelRef.current = null;
    setAnalysis((current) => current ? { ...current, phase: 'cancelled' } : current);
  }

  function exportResult() {
    const blob=new Blob([JSON.stringify({source:'OurFamilyWizard',...snapshot,limitations:'Read only. Unread message bodies excluded. Completeness and freshness are provided by the connector. This export contains only the displayed response.',result,analysis:analysis?{task:analysis.task,question:analysis.question,answer:analysis.text,sources:analysis.sources,caveats:analysis.caveats,model:'local Qwen',status:analysis.phase}:undefined},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`ofw-${snapshot?.action ?? 'analysis'}-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function updateDateRange(next: DateRange) {
    sessionDateRange = next;
    setSince(next.since);
    setUntil(next.until);
  }
  function resetDateRange() { updateDateRange(defaultDateRange()); }

  const isNatural = snapshot?.action === 'nlsearch' && result !== null;
  const refused = isNatural && typeof result?.result === 'string';
  const rawRows=result?.messages ?? result?.data ?? result?.events;
  const rows=Array.isArray(rawRows)?rawRows:[];
  const hits=isNatural && Array.isArray(result?.results) ? result!.results as unknown[] : [];
  const freshness=record(result?.freshness);
  const recordTabs = [['messages','Messages'],['expenses','Expenses'],['totals','Expense totals'],['calendar','Calendar']] as const;
  const analysisRunning = analysis ? ['retrieving','thinking','streaming'].includes(analysis.phase) : false;

  return <section className="ofw-panel glass-panel" aria-label="OurFamilyWizard read-only workspace">
    <div className="ofw-heading"><div><div className="eyebrow"><ShieldCheck size={16}/> Private case workspace</div><h2>OurFamilyWizard</h2><p>Search your records. Keep the source in view.</p></div><span className="ofw-badge">Read only · No read receipts</span></div>
    {!desktop && <p className="ofw-warning">Open the Electron desktop app to connect. The browser preview has no access to your account.</p>}
    <div className="ofw-toolbar"><Button disabled={busy||!desktop} onClick={()=>void run('connect')}>{connected?'Check connection':'Connect OFW'}</Button><Button disabled={busy||!connected} onClick={()=>void run('sync')} icon={<RefreshCw size={15}/>}>Sync / continue history</Button><span role="status" aria-live="polite">{busy?'Reading OFW…':connected?'Account connected':'Not connected'}</span></div>
    <details className="ofw-notice"><summary>Connection and sync details</summary><pre>{notice}</pre></details>
    <p className="ofw-help">Unread bodies stay private until you open them in OFW. Each sync checks recent messages and continues older history; repeat if the sync reports incomplete.</p>
    <div className="ofw-tabs"><Tabs items={recordTabs.map(([id,label])=>({id,label}))} activeId={tab} onChange={(id)=>{setTab(id);setResult(null);setDetail(null);setError('');}} label="OFW record types" /></div>

    <form id={`ofw-record-types-${tab}`} className="ofw-search" role="tabpanel" aria-labelledby={`ofw-record-types-tab-${tab}`} onSubmit={e=>{e.preventDefault();search();}}>
      {tab==='messages' && <>
        <div className="ofw-nl-mode" role="radiogroup" aria-label="Search mode">
          {([['natural','Ask a question'],['exact','Exact words']] as const).map(([id,label]) =>
            <button key={id} type="button" role="radio" aria-checked={mode===id} className={mode===id?'active':''} onClick={()=>setMode(id)}>{label}</button>)}
        </div>
        <label className="ofw-nl-query">{mode==='natural'?'Ask or search your messages':'Exact words or phrase'}
          <input value={q} onChange={e=>setQ(e.target.value)} maxLength={500}
            placeholder={mode==='natural'?'e.g. what did she say about the dentist last month?':'e.g. reimbursement'}/>
          <small className="ofw-nl-hint">{mode==='natural'
            ? 'Understands dates (“last month”, “since March”), who wrote it (“she said”, “I told her”, “from Sarah”), related wording and typos. Quote a phrase for an exact match; -word excludes.'
            : 'Matches the whole text literally, ranked, with the match highlighted.'}</small>
        </label>
        <label>Folder<select value={folder} onChange={e=>setFolder(e.target.value)}><option value="auto">Auto (from the question)</option><option value="both">Inbox + sent</option><option value="inbox">Received</option><option value="sent">Sent by me</option></select></label>
        <label>From (optional)<input type="date" value={msgSince} onChange={e=>setMsgSince(e.target.value)}/></label>
        <label>Before (optional)<input type="date" value={msgUntil} onChange={e=>setMsgUntil(e.target.value)}/></label>
        {(msgSince||msgUntil) && <button type="button" onClick={()=>{setMsgSince('');setMsgUntil('');}} disabled={busy}>Clear dates</button>}
      </>}
      {tab==='calendar' && <><label>From<input type="date" value={since} onChange={e=>updateDateRange({since:e.target.value,until})}/></label><label>Through<input type="date" value={until} onChange={e=>updateDateRange({since,until:e.target.value})}/></label><button type="button" onClick={resetDateRange} disabled={busy}>Reset to last 60 days</button></>}
      <button disabled={busy||!connected} type="submit"><Search size={16}/>{tab==='messages'?'Search':'Load records'}</button>
    </form>

    {tab==='messages' && <div className="ofw-nl-actionsbar">
      <span className="ofw-nl-label"><Sparkles size={15}/> Local Qwen</span>
      {ANALYSIS_ACTIONS.map((a) => <button key={a.task} type="button" title={a.hint}
        disabled={!connected || busy || analysisRunning || !window.agentForce?.ofwAnalyze || (a.task==='answer' && !q.trim())}
        onClick={()=>analyze(a.task)}>{a.label}</button>)}
      <span className="ofw-help">{qwenReady===false
        ? 'Local Qwen is not responding — search still works. Start it with pnpm qwen:start.'
        : 'Reads only the most relevant messages, on this computer, and cites each one.'}</span>
    </div>}

    {error && <p className="ofw-warning" role="alert">{error}</p>}
    {tab==='messages' && analysis && <AnalysisView state={analysis} onCancel={stopAnalysis} onView={(id)=>void run('message',{messageId:id})}/>}

    {result && <div className="ofw-results">
      <div className="ofw-toolbar"><strong>{isNatural
        ? (refused ? 'No answer — see below' : `${show(result.returned ?? hits.length)} of ${show(result.totalMatches ?? hits.length)} matches · ${show(result.searched ?? '?')} messages searched`)
        : rows.length?`${rows.length} records on this page`:'OFW response'}</strong><Button onClick={exportResult} disabled={busy} icon={<Download size={15}/>}>Export this response</Button></div>
      <p className="ofw-help">Retrieved {snapshot?.at}. {freshness.asOf?`Cache verified: ${show(freshness.asOfDisplay || freshness.asOf)} (${show(freshness.staleness)}).`:''}{isNatural && result.engine==='local'?' Ranked in this app.':''}</p>
      {isNatural && result.interpretation !== undefined && <InterpretationLine value={result.interpretation}/>}
      {refused && <div className="ofw-warning" role="alert">
        <strong>{result.result==='UNVERIFIED_EMPTY'?'Not verified — this is not proof that nothing exists.':'The connector could not answer this search.'}</strong>
        {[result.reason,result.remedy].filter(Boolean).map((n,i)=><p key={i}>{show(n)}</p>)}
        <button type="button" disabled={busy} onClick={()=>void syncThenSearch()}><RefreshCw size={14}/> Sync with OurFamilyWizard and search again</button>
      </div>}
      {!refused && result.complete!==undefined && <p className={result.complete?'ofw-help':'ofw-warning'}>{result.complete?'Connector reports the result set complete.':'Partial or unverified results — do not treat this page as the complete record.'}</p>}
      {!refused && [result.completeNote,result.bodiesNote,result.note,freshness.warning].filter(Boolean).map((n,i)=><p className="ofw-help" key={i}>{show(n)}</p>)}
      {copied && <p className="ofw-help" role="status">Citation for message {copied} copied.</p>}
      {isNatural
        ? (!refused && (hits.length
            ? <NaturalResults result={result} busy={busy} onView={(id)=>void run('message',{messageId:id})} onCopied={(id)=>{setCopied(id);setTimeout(()=>setCopied(''),1600);}}/>
            : <EmptyState title="No messages matched" detail="Check how the question was read above. Try different wording, widen the dates, or switch to Exact words." />))
        : <>
          {rows.map((value,i)=>{const r=record(value);return <article className="ofw-record" key={show(r.id)||i}><h3>{show(r.subject||r.title||r.description)||`Record ${i+1}`}</h3><p className="ofw-source">{r.id?`Source ID ${show(r.id)} · `:''}{show(r.sentAtDisplay||r.sentAt||r.date)} {r.from?` · ${show(r.from)}`:''}</p><pre>{show(r)}</pre></article>;})}
          {!rows.length && <EmptyState title="No records matched these filters" detail="Widen the date range and try again." />}
          {result.hasMore===true && <button disabled={busy} onClick={()=>{
            if(snapshot)void run(snapshot.action,{...snapshot.filters,start:result.nextStart});
          }}>Next page</button>}
        </>}
      <details><summary>Source response and coverage metadata</summary><pre>{show(result)}</pre></details>
    </div>}
    {detail && <aside className="ofw-detail"><div className="ofw-toolbar"><h3>Message source</h3><button onClick={()=>setDetail(null)}>Close</button></div><pre>{show(detail)}</pre></aside>}
  </section>;
}

function friendlyModelError(message: string): string {
  if (message.startsWith('REMOTE_MODEL_BLOCKED:')) return message.replace('REMOTE_MODEL_BLOCKED: ', '');
  if (/SERVER_UNAVAILABLE|ECONNREFUSED|fetch failed|LLM endpoint failed/i.test(message)) return 'Local Qwen is not running. Start it with pnpm qwen:start, then try again. Search still works without it.';
  if (message.startsWith('INACTIVITY_TIMEOUT:')) return 'Local Qwen stopped producing text. Try a narrower question or fewer dates.';
  return message;
}

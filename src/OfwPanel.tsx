import { useState } from 'react';
import { Search, ShieldCheck, RefreshCw, Download } from 'lucide-react';
import { Button, EmptyState, Tabs } from './components/ui/Primitives';

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

function parseMessageIntent(query: string) {
  const value = query.trim();
  const recent = /\b(?:most\s+recent|latest|recent)\b/i.test(value);
  const messageRequest = /\b(?:messages?|records?)\b/i.test(value);
  const conversational = /^(?:tell\s+me|show\s+me|list|give\s+me|what\s+are)\b/i.test(value);
  if (!recent || !messageRequest || !conversational) return { query: value, size: 25, interpreted: false };
  const count = Number(value.match(/\b([1-9]\d?)\b/)?.[1] ?? 25);
  return { query: '', size: Math.min(Math.max(count, 1), 25), interpreted: true };
}

export function OfwPanel() {
  const initialDateRange = sessionDateRange ?? defaultDateRange();
  const [tab,setTab]=useState('messages');
  const [connected,setConnected]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('Connect to verify your account, then sync messages before searching.');
  const [q,setQ]=useState('');
  const [since,setSince]=useState(initialDateRange.since);
  const [until,setUntil]=useState(initialDateRange.until);
  const [folder,setFolder]=useState('both');
  const [result,setResult]=useState<RecordData|null>(null);
  const [detail,setDetail]=useState<RecordData|null>(null);
  const [snapshot,setSnapshot]=useState<{at:string;action:string;filters:RecordData}|null>(null);
  const desktop=Boolean(window.agentForce?.ofw);

  async function run(action:string,input:RecordData={}) {
    if(!window.agentForce?.ofw) return;
    setBusy(true);setError('');
    try {
      const response=await window.agentForce.ofw(action,input);
      if(!response.ok) throw new Error(response.error || 'Unable to read OFW');
      const data=record(response.data);
      if(action==='connect') {setConnected(true);setNotice('Account verified. OFW writes and read receipts are disabled.');}
      else if(action==='sync') {setNotice(`Sync response: ${show(data)}`);setResult(null);setDetail(null);}
      else if(action==='message') setDetail(data);
      else {setResult(data);setDetail(null);setSnapshot({at:new Date().toISOString(),action,filters:input});}
    } catch(e) {setError(e instanceof Error?e.message:'OFW request failed');if(action==='connect')setConnected(false);}
    finally {setBusy(false);}
  }
  function search(page=1,start=0) {
    const intent = parseMessageIntent(q);
    const input = tab==='messages' ? {q:intent.query,since,until,folderId:folder,page,size:intent.size}
      : tab==='calendar' ? {startDate:since||today(),endDate:until||today()} : {start};
    void run(tab,input);
  }
  function exportResult() {
    const blob=new Blob([JSON.stringify({source:'OurFamilyWizard',...snapshot,limitations:'Read only. Unread message bodies excluded. Completeness and freshness are provided by the connector. This export contains only the displayed response.',result},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`ofw-${snapshot?.action}-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function updateDateRange(next: DateRange) {
    sessionDateRange = next;
    setSince(next.since);
    setUntil(next.until);
  }
  function resetDateRange() { updateDateRange(defaultDateRange()); }
  const rawRows=result?.messages ?? result?.data ?? result?.events;
  const rows=Array.isArray(rawRows)?rawRows:[];
  const freshness=record(result?.freshness);
  const looksLikeQuestion = /\?|^(are|is|can|could|what|when|where|why|how|summarize|identify|explain)\b/i.test(q.trim());
  const messageIntent = parseMessageIntent(q);
  const recordTabs = [['messages','Messages'],['expenses','Expenses'],['totals','Expense totals'],['calendar','Calendar']] as const;
  return <section className="ofw-panel glass-panel" aria-label="OurFamilyWizard read-only workspace">
    <div className="ofw-heading"><div><div className="eyebrow"><ShieldCheck size={16}/> Private case workspace</div><h2>OurFamilyWizard</h2><p>Search your records. Keep the source in view.</p></div><span className="ofw-badge">Read only · No read receipts</span></div>
    {!desktop && <p className="ofw-warning">Open the Electron desktop app to connect. The browser preview has no access to your account.</p>}
    <div className="ofw-toolbar"><Button disabled={busy||!desktop} onClick={()=>void run('connect')}>{connected?'Check connection':'Connect OFW'}</Button><Button disabled={busy||!connected} onClick={()=>void run('sync')} icon={<RefreshCw size={15}/>}>Sync / continue history</Button><span role="status" aria-live="polite">{busy?'Reading OFW…':connected?'Account connected':'Not connected'}</span></div>
    <details className="ofw-notice"><summary>Connection and sync details</summary><pre>{notice}</pre></details>
    <p className="ofw-help">Unread bodies stay private until you open them in OFW. Each sync checks recent messages and continues older history; repeat if the sync reports incomplete. Search matches exact text in cached subjects and available bodies.</p>
    <div className="ofw-tabs"><Tabs items={recordTabs.map(([id,label])=>({id,label}))} activeId={tab} onChange={(id)=>{setTab(id);setResult(null);setDetail(null);setError('');}} label="OFW record types" /></div>
    <form id={`ofw-record-types-${tab}`} className="ofw-search" onSubmit={e=>{e.preventDefault();search();}}>
      {tab==='messages' && <><label>Search words (exact match)<input value={q} onChange={e=>setQ(e.target.value)} placeholder="e.g. reimbursement or school pickup" maxLength={300}/>{messageIntent.interpreted ? <small className="ofw-field-help">Interpreted as the {messageIntent.size} most recent messages.</small> : looksLikeQuestion && <small className="ofw-field-help">Questions belong in the Qwen panel above; this field searches exact words.</small>}</label><label>Folder<select value={folder} onChange={e=>setFolder(e.target.value)}><option value="both">Inbox + sent</option><option value="inbox">Inbox</option><option value="sent">Sent</option></select></label></>}
      {(tab==='messages'||tab==='calendar') && <><label>From<input type="date" value={since} onChange={e=>updateDateRange({since:e.target.value,until})}/></label><label>{tab==='messages'?'Before (exclusive)':'Through'}<input type="date" value={until} onChange={e=>updateDateRange({since,until:e.target.value})}/></label><button type="button" onClick={resetDateRange} disabled={busy}>Reset to last 60 days</button></>}
      <button disabled={busy||!connected} type="submit"><Search size={16}/>{tab==='messages'?'Search records':'Load records'}</button>
    </form>
    {error && <p className="ofw-warning" role="alert">{error}</p>}
    {result && <div className="ofw-results">
      <div className="ofw-toolbar"><strong>{rows.length?`${rows.length} records on this page`:'OFW response'}</strong><Button onClick={exportResult} disabled={busy} icon={<Download size={15}/>}>Export this response</Button></div>
      <p className="ofw-help">Retrieved {snapshot?.at}. {freshness.asOf?`Cache verified: ${show(freshness.asOf)} (${show(freshness.staleness)}).`:''}</p>
      {result.complete!==undefined && <p className={result.complete?'ofw-help':'ofw-warning'}>{result.complete?'Connector reports the result set complete.':'Partial or unverified results — do not treat this page as the complete record.'}</p>}
      {[result.completeNote,result.note,result.reason,result.remedy,freshness.warning].filter(Boolean).map((n,i)=><p className="ofw-help" key={i}>{show(n)}</p>)}
      {rows.map((value,i)=>{const r=record(value);return <article className="ofw-record" key={show(r.id)||i}><h3>{show(r.subject||r.title||r.description)||`Record ${i+1}`}</h3><p className="ofw-source">{r.id?`Source ID ${show(r.id)} · `:''}{show(r.sentAtDisplay||r.sentAt||r.date)} {r.from?` · ${show(r.from)}`:''}</p>{tab==='messages'?<><pre>{typeof r.body==='string'&&r.body?r.body:'Body not cached. Unread bodies will not be fetched.'}</pre><button disabled={busy} onClick={()=>void run('message',{messageId:show(r.id)})}>View available message</button></>:<pre>{show(r)}</pre>}</article>;})}
      {!rows.length && <EmptyState title="No records matched these filters" detail="Try a shorter exact search term, widen the date range, or use the local Qwen panel for a natural-language question." />}
      {result.hasMore===true && <button disabled={busy} onClick={()=>{
        if(snapshot)void run(snapshot.action,{...snapshot.filters,...(tab==='messages'?{page:result.nextPage}:{start:result.nextStart})});
      }}>Next page</button>}
      <details><summary>Source response and coverage metadata</summary><pre>{show(result)}</pre></details>
    </div>}
    {detail && <aside className="ofw-detail"><div className="ofw-toolbar"><h3>Message source</h3><button onClick={()=>setDetail(null)}>Close</button></div><pre>{show(detail)}</pre></aside>}
  </section>;
}

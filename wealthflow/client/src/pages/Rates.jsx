import { useRef, useState } from 'react';
import { Upload, Download, Trash2, Search, Pencil, History } from 'lucide-react';
import { api, qs } from '../api.js';
import { Card, PageHead, useLoad, useAction, Spinner, Empty, Modal, Field, Confirm, exportExcel, MONTHS } from '../ui.jsx';

export default function Rates() {
  const [f, setF] = useState({ q: '', amc: '', month: '', year: '', current: '1' });
  const [checked, setChecked] = useState(new Set());
  const [edit, setEdit] = useState(null);
  const [history, setHistory] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [run, busy] = useAction();
  const file = useRef();
  const { data, reload } = useLoad(() => api.get(`/rates${qs(f)}`), [JSON.stringify(f)]);

  const upload = (files) => run(async () => {
    const fd = new FormData();
    for (const x of files) fd.append('files', x);
    fd.append('period', period);
    const r = await api.post('/rates/upload', fd);
    reload();
    return r;
  }, (r) => `${r.total} scheme rate(s) extracted from ${r.files.length} file(s)`);
  const years = [...new Set((data?.rows || []).map((r) => r.period?.slice(0, 4)))].filter(Boolean);

  return (
    <>
      <PageHead title="BROKERAGE STRUCTURE" sub="Master control for AMC brokerage rates and PDF extraction.">
        <button className="btn btn-green btn-caps" onClick={() => exportExcel((data?.rows || []).map((r) => ({ AMC: r.amc, Scheme: r.scheme, Period: r.period, 'Gross Rate %': r.rate, Source: r.source })), 'brokerage-rates.csv')}><Download size={14} />Export CSV</button>
        <button className="btn btn-caps" onClick={() => setConfirm('reset')}><Trash2 size={14} />Reset Master</button>
      </PageHead>
      <div className="grid g-1-2">
        <div className="col gap-lg">
          <div className="dropzone" style={{ padding: 34 }} onClick={() => file.current.click()}>
            <Upload size={34} className="t-blue" />
            <div className="card-title" style={{ color: 'var(--text)' }}>Upload Brokerage PDF</div>
            <div className="tiny upper bold">Auto-extract rates from AMC PDFs (or .xlsx / .csv rate sheets)</div>
            <div className="row gap-sm" onClick={(e) => e.stopPropagation()}>
              <span className="tiny bold upper">Effective</span><input type="month" className="input sm" value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-caps btn-lg" disabled={busy}>{busy ? 'Extracting…' : 'Select PDF Files'}</button>
            <input ref={file} type="file" hidden multiple accept=".pdf,.xlsx,.xls,.csv" onChange={(e) => { const fl = [...e.target.files]; e.target.value = ''; if (fl.length) upload(fl); }} />
          </div>
          <Card className="card-pad col gap">
            <div className="card-title">Structure Analytics</div>
            <div className="kv"><span className="upper faint" style={{ fontSize: 9.5 }}>Total Schemes</span><b style={{ fontSize: 18 }}>{data?.stats.schemes ?? 0}</b></div>
            <div className="kv"><span className="upper faint" style={{ fontSize: 9.5 }}>Rate Versions</span><b className="faint" style={{ fontSize: 18 }}>{data?.stats.versions ?? 0}</b></div>
            <div className="kv"><span className="upper faint" style={{ fontSize: 9.5 }}>Tracked AMCs</span><b style={{ fontSize: 18 }}>{data?.stats.amcs ?? 0}</b></div>
          </Card>
        </div>
        <Card>
          <div style={{ padding: 14 }} className="col gap-sm">
            <div className="row gap wrap">
              <div className="input-icon grow"><Search size={14} /><input className="input" placeholder="Search Master List..." value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div>
              <select className="select sm" value={f.amc} onChange={(e) => setF({ ...f, amc: e.target.value })}><option value="">All AMCs</option>{data?.amcs.map((a) => <option key={a}>{a}</option>)}</select>
              <select className="select sm" value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })}><option value="">Months</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
              <select className="select sm" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })}><option value="">Years</option>{years.map((y) => <option key={y}>{y}</option>)}</select>
            </div>
            <div className="row between">
              <label className="check"><input type="checkbox" checked={f.current === '1'} onChange={(e) => setF({ ...f, current: e.target.checked ? '1' : '0' })} />Current rate only</label>
              <div className="row gap">
                {checked.size > 0 && <button className="btn btn-red-soft btn-xs" onClick={() => setConfirm('selected')}><Trash2 size={11} />Delete {checked.size}</button>}
                <span className="tiny upper faint bold">{data?.rows.length ?? 0} master schemes</span>
              </div>
            </div>
          </div>
          {!data ? <Spinner /> : (
            <div className="table-wrap scroll" style={{ maxHeight: 640 }}>
              <table className="t">
                <thead><tr><th style={{ width: 30 }}><input type="checkbox" checked={data.rows.length > 0 && checked.size === data.rows.length} onChange={(e) => setChecked(new Set(e.target.checked ? data.rows.map((r) => r.id) : []))} /></th>
                  <th>AMC &amp; Scheme Name</th><th className="c">Period</th><th className="c">Gross Rate</th><th className="r">Control</th></tr></thead>
                <tbody>
                  {!data.rows.length && <tr><td colSpan={5}><Empty title="No rates yet" text="Upload AMC brokerage PDFs or a rate sheet." /></td></tr>}
                  {data.rows.map((r) => (
                    <tr key={r.id}>
                      <td><input type="checkbox" checked={checked.has(r.id)} onChange={() => { const s = new Set(checked); s.has(r.id) ? s.delete(r.id) : s.add(r.id); setChecked(s); }} /></td>
                      <td><div className="cell-main small">{r.scheme}</div><div className="cell-sub blue upper">{r.amc}</div></td>
                      <td className="c tiny bold faint">{r.period}</td>
                      <td className="c bold" style={{ fontSize: 15 }}>{r.rate}%</td>
                      <td className="r" style={{ whiteSpace: 'nowrap' }}>
                        <button className="icon-btn" title="Rate history" onClick={() => api.get(`/rates/history${qs({ amc: r.amc, scheme: r.scheme })}`).then((h) => setHistory({ r, h }))}><History size={14} /></button>
                        <button className="icon-btn" onClick={() => setEdit({ ...r })}><Pencil size={14} /></button>
                        <button className="icon-btn" onClick={() => run(() => api.post('/rates/delete', { ids: [r.id] }).then(reload), 'Rate deleted')}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
      {edit && <Modal title="Edit Rate" onClose={() => setEdit(null)} footer={<>
        <button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
        <button className="btn btn-primary" onClick={() => run(() => api.put(`/rates/${edit.id}`, edit).then(() => { setEdit(null); reload(); }), 'Rate updated')}>Save</button></>}>
        <Field label="Scheme"><input className="input" value={edit.scheme} onChange={(e) => setEdit({ ...edit, scheme: e.target.value })} /></Field>
        <div className="grid g2">
          <Field label="Gross Rate %"><input className="input" type="number" step="0.01" value={edit.rate} onChange={(e) => setEdit({ ...edit, rate: e.target.value })} /></Field>
          <Field label="Period"><input className="input" type="month" value={edit.period} onChange={(e) => setEdit({ ...edit, period: e.target.value })} /></Field>
        </div>
      </Modal>}
      {history && <Modal title="Rate History" onClose={() => setHistory(null)}>
        <div className="semi">{history.r.scheme}</div>
        <table className="t compact card"><thead><tr><th>Period</th><th>Rate</th><th>Source</th></tr></thead>
          <tbody>{history.h.map((x) => <tr key={x.id}><td>{x.period}</td><td className="bold">{x.rate}%</td><td className="tiny muted">{x.source}</td></tr>)}</tbody></table>
      </Modal>}
      {confirm && <Confirm danger title={confirm === 'reset' ? 'Reset the rate master?' : 'Delete selected rates?'} text={confirm === 'reset' ? 'Every scheme rate and its history will be deleted.' : `${checked.size} rate row(s) will be deleted.`}
        confirmLabel={confirm === 'reset' ? 'Reset Master' : 'Delete'} onClose={() => setConfirm(null)}
        onConfirm={() => run(() => (confirm === 'reset' ? api.post('/rates/reset') : api.post('/rates/delete', { ids: [...checked] })).then(() => { setChecked(new Set()); reload(); }), 'Done')} />}
    </>
  );
}

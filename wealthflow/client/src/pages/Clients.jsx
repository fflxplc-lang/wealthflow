import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, Users, Database, Search, UserPlus, Copy, Pencil, Trash2, Download, Upload, FileSpreadsheet, Plus, Check, Tags, UserCog, Mail, Phone, IdCard } from 'lucide-react';
import { api, qs } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Card, PageHead, Segmented, useLoad, useAction, Spinner, Empty, Modal, Field, Pager, Confirm, exportExcel, inrShort, LEVELS, useToast } from '../ui.jsx';

// ---------------- Hierarchy (team accounts) ----------------
const blankUser = { name: '', email: '', code: '', gst: '', parent_id: '', sharing_pct: 0, role: 'ops', level: 1, password: '', extra_levels: [], bank: {}, address: { country: 'India' } };

// The policy's share for a level: L1-L3 their own-lead rate, L4 the whole pool, L5-L7 the top share.
export function levelDefaultPct(level, sharing) {
  if (!sharing) return 0;
  const top = Object.values(sharing.top || {}).reduce((s, v) => s + Number(v || 0), 0);
  if (level <= 3) return Number(sharing.rates?.[level] ?? 0);
  if (level === 4) return Math.max(0, 100 - top);
  return Number(sharing.top?.[level] ?? 0);
}

export function UserModal({ initial, users, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ ...blankUser, ...initial, password: '', bank: { ...(initial?.bank || {}) }, address: { country: 'India', ...(initial?.address || {}) } }));
  const [run, busy] = useAction();
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const rules = useLoad(() => api.get('/settings/global'), []);
  const sharing = rules.data?.sharing;
  const def = levelDefaultPct(f.level, sharing);
  // Fill the rule's % when the form opens without a personal rate, and again whenever the level changes.
  const filled = useRef(false);
  useEffect(() => {
    if (!sharing || filled.current) return;
    filled.current = true;
    if (!(Number(initial?.sharing_pct) > 0)) set('sharing_pct', levelDefaultPct(f.level, sharing));
  }, [sharing]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickLevel = (l) => setF((x) => ({ ...x, level: l, sharing_pct: levelDefaultPct(l, sharing), extra_levels: x.extra_levels.filter((e) => e !== l) }));
  const setIn = (o, k, v) => setF((x) => ({ ...x, [o]: { ...x[o], [k]: v } }));
  const save = (recalculate) => run(async () => {
    // A % equal to the rule is stored as "follow the rule", so later policy changes still apply.
    const pct = Number(f.sharing_pct) || 0;
    const body = { ...f, sharing_pct: f.level >= 4 || pct === levelDefaultPct(f.level, sharing) ? 0 : pct, recalculate };
    if (initial?.id) await api.put(`/users/${initial.id}`, body); else await api.post('/users', body);
    onSaved(); onClose();
  }, recalculate ? 'Saved and payouts recalculated' : 'Saved');
  const toggleLevel = (l) => set('extra_levels', f.extra_levels.includes(l) ? f.extra_levels.filter((x) => x !== l) : [...f.extra_levels, l]);
  return (
    <Modal title={initial?.id ? 'Edit User' : 'Provision User'} onClose={onClose} footer={<>
      <span className="tiny muted" style={{ flex: '1 1 220px', minWidth: 200, marginRight: 'auto' }}>Changed the sharing %? Use <b className="t-blue">Save &amp; Recalculate</b> to apply it across every payout. "Save" alone stores it without recomputing past payouts.</span>
      <button className="btn btn-ghost btn-caps" onClick={onClose}>Cancel</button>
      <button className="btn btn-soft btn-caps btn-lg" disabled={busy} onClick={() => save(false)}>Save</button>
      <button className="btn btn-primary btn-caps btn-lg" disabled={busy} onClick={() => save(true)}>Save &amp; Recalculate</button>
    </>}>
      <div className="form-section"><UserPlus size={15} />Basic Information</div>
      <Field label="Full Name"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="John Mathew" /></Field>
      <Field label="Access Email"><input className="input" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="john@wealthflow.com" /></Field>
      <div className="grid g2">
        <Field label="Employee/ARN Code"><input className="input" value={f.code || ''} onChange={(e) => set('code', e.target.value)} placeholder="WF-001" /></Field>
        <Field label="GST Number (optional)"><input className="input" value={f.gst || ''} onChange={(e) => set('gst', e.target.value)} placeholder="22AAAAA0000A1Z5" /></Field>
      </div>
      <div className="form-section"><Shield size={15} />Hierarchy &amp; Sharing</div>
      <div className="grid g2">
        <Field label="Reports To (Parent)">
          <select className="select" value={f.parent_id || ''} onChange={(e) => set('parent_id', e.target.value)}>
            <option value="">-- No Parent (Root) --</option>
            {users.filter((u) => u.id !== initial?.id).map((u) => <option key={u.id} value={u.id}>{u.name} · L{u.level}</option>)}
          </select>
        </Field>
        <Field label="Sharing % Rate" hint={!sharing ? '' : f.level >= 4 ? `L${f.level} share comes from the policy (${def}%). Set a custom % in Admin Console → User Sharing.` : Number(f.sharing_pct) === def ? `Policy rate for L${f.level}. Change it only for a personal rate.` : `Personal rate. The policy rate for L${f.level} is ${def}%.`}>
          <input className="input" type="number" step="0.01" value={f.level >= 4 ? def : f.sharing_pct} readOnly={f.level >= 4} onChange={(e) => set('sharing_pct', e.target.value)} />
        </Field>
      </div>
      <div className="grid g3">
        <Field label="Role">
          <select className="select" value={f.role} onChange={(e) => set('role', e.target.value)}>
            <option value="ops">Ops / RM — own data</option><option value="partner">Partner — own data</option>
            <option value="mentor">Mentor — own data + direct reports</option><option value="admin">Admin — full access</option>
          </select>
          {f.role === 'mentor' && <span className="tiny muted">A mentor sees their own data and that of everyone who reports to them directly.</span>}
        </Field>
        <Field label="System Level (Primary)">
          <select className="select" value={f.level} onChange={(e) => pickLevel(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7].map((l) => <option key={l} value={l}>Level {l} · {LEVELS[l]}</option>)}
          </select>
        </Field>
        <Field label={initial?.id ? 'New Password (optional)' : 'Account Password'}><input className="input" type="password" value={f.password} onChange={(e) => set('password', e.target.value)} placeholder="••••••••" /></Field>
      </div>
      <div className="card card-pad col gap-sm" style={{ background: 'var(--surface-2)' }}>
        <span className="field-label">Additional Levels (Multi-Role)</span>
        <span className="small muted">Tick every level this user can be assigned to in client hierarchies. On each client they earn that level's share. The Primary level above is always allowed.</span>
        <div className="row gap-sm mt-sm wrap">
          {[1, 2, 3, 4, 5, 6, 7].map((l) => <button key={l} type="button" className={`level-chip ${l === f.level || f.extra_levels.includes(l) ? 'on' : ''}`} onClick={() => l !== f.level && toggleLevel(l)}>L{l}{l === f.level ? '★' : ''}</button>)}
        </div>
      </div>
      <div className="form-section"><Check size={15} />Bank Details</div>
      <Field label="Account Holder Name"><input className="input" value={f.bank.holder || ''} onChange={(e) => setIn('bank', 'holder', e.target.value)} placeholder="Same as Full Name" /></Field>
      <div className="grid g2">
        <Field label="Bank Name"><input className="input" value={f.bank.bankName || ''} onChange={(e) => setIn('bank', 'bankName', e.target.value)} placeholder="HDFC Bank" /></Field>
        <Field label="Branch Name"><input className="input" value={f.bank.branch || ''} onChange={(e) => setIn('bank', 'branch', e.target.value)} placeholder="Main Branch" /></Field>
        <Field label="Account Number"><input className="input mono" value={f.bank.account || ''} onChange={(e) => setIn('bank', 'account', e.target.value)} placeholder="00018239..." /></Field>
        <Field label="IFSC Code"><input className="input mono" value={f.bank.ifsc || ''} onChange={(e) => setIn('bank', 'ifsc', e.target.value.toUpperCase())} placeholder="HDFC0000001" /></Field>
      </div>
      <div className="form-section"><Tags size={15} />Office Address</div>
      <Field label="Street / Building"><input className="input" value={f.address.street || ''} onChange={(e) => setIn('address', 'street', e.target.value)} placeholder="Plot No 4, Skyline" /></Field>
      <div className="grid g2">
        <Field label="City"><input className="input" value={f.address.city || ''} onChange={(e) => setIn('address', 'city', e.target.value)} placeholder="Mumbai" /></Field>
        <Field label="State"><input className="input" value={f.address.state || ''} onChange={(e) => setIn('address', 'state', e.target.value)} placeholder="Maharashtra" /></Field>
        <Field label="Pincode"><input className="input mono" value={f.address.pincode || ''} onChange={(e) => setIn('address', 'pincode', e.target.value)} placeholder="400001" /></Field>
        <Field label="Country"><input className="input" value={f.address.country || ''} onChange={(e) => setIn('address', 'country', e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

// One layout for the team export, the import template and the import itself, so an export can be
// edited and imported back.
const ROLE_LABEL = { ops: 'Ops / RM', mentor: 'Mentor', partner: 'Partner', admin: 'Admin' };
const teamRow = (u, byId) => ({
  'Full Name': u.name, 'Access Email': u.email, 'Employee/ARN Code': u.code || '', Level: `L${u.level}`,
  'Reports To': u.parent_id ? byId.get(Number(u.parent_id))?.name || '' : '', Role: ROLE_LABEL[u.role] || u.role,
  'Sharing %': Number(u.sharing_pct) || '', 'Additional Levels': (u.extra_levels || []).map((l) => `L${l}`).join(', '),
  GSTIN: u.gst || '', PAN: u.pan || '', 'Account Holder': u.bank?.holder || '', 'Bank Name': u.bank?.bankName || '',
  Branch: u.bank?.branch || '', 'Account Number': u.bank?.account || '', IFSC: u.bank?.ifsc || '',
  Street: u.address?.street || '', City: u.address?.city || '', State: u.address?.state || '', Pincode: u.address?.pincode || '',
});
const TEMPLATE = [
  { 'Full Name': 'ANMOL KUMAR JHA', 'Access Email': 'anmol@example.com', 'Employee/ARN Code': 'ARN-270605', Level: 'L4', 'Reports To': '', Role: 'Mentor', Password: 'Welcome@123', 'Sharing %': '', 'Additional Levels': '', GSTIN: '', PAN: 'ABCPJ1234F', 'Account Holder': 'ANMOL KUMAR JHA', 'Bank Name': 'HDFC Bank', Branch: 'Andheri', 'Account Number': '50100012345678', IFSC: 'HDFC0000123', Street: '12 MG Road', City: 'Mumbai', State: 'Maharashtra', Pincode: '400001' },
  { 'Full Name': 'Johnson M John', 'Access Email': 'johnson@example.com', 'Employee/ARN Code': 'WF-101', Level: 'L1', 'Reports To': 'anmol@example.com', Role: 'Ops / RM', Password: '', 'Sharing %': '', 'Additional Levels': '', GSTIN: '27ABCPJ1234F1Z6', PAN: '', 'Account Holder': '', 'Bank Name': '', Branch: '', 'Account Number': '', IFSC: '', Street: '', City: 'Pune', State: 'Maharashtra', Pincode: '411001' },
];

function ImportTeam({ onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [prev, setPrev] = useState(null);
  const [run, busy] = useAction();
  const pick = (fl) => { setFile(fl); setPrev(null); if (!fl) return; const fd = new FormData(); fd.append('file', fl); run(async () => setPrev(await api.post('/users/import/preview', fd))); };
  const apply = () => run(async () => {
    const fd = new FormData(); fd.append('file', file);
    const r = await api.post('/users/import/apply', fd);
    onDone(); onClose();
    return r;
  }, 'Team accounts created');
  return (
    <Modal wide title="Import RMs and Mentors" onClose={onClose} footer={<>
      <button className="btn btn-ghost btn-caps" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary btn-caps btn-lg" disabled={busy || !prev?.ok} onClick={apply}>Create {prev?.ok || 0} account{prev?.ok === 1 ? '' : 's'}</button>
    </>}>
      <div className="small muted">One row per person. Required: <b>Full Name</b>, <b>Access Email</b> and <b>Level</b> (L1 to L7). <b>Role</b> is Ops / RM, Mentor, Partner or Admin (blank = Ops / RM).
        <b> Reports To</b> is the manager's email, code or name, either already in the team or in the same file. A blank <b>Password</b> gives <span className="mono">Welcome@123</span>.
        A blank <b>Sharing %</b> follows the policy for the level. People whose email already has an account are skipped.</div>
      <div className="row gap wrap">
        <button className="btn btn-soft btn-caps" onClick={() => exportExcel(TEMPLATE, 'team-import-template.xlsx')}><FileSpreadsheet size={14} />Download template</button>
        <label className="btn btn-primary btn-caps"><Upload size={14} />{file ? file.name : 'Choose filled file'}<input type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => pick(e.target.files[0] || null)} /></label>
      </div>
      {busy && !prev && <Spinner />}
      {prev && (
        <>
          <div className="small"><b className="t-green">{prev.ok} ready</b>{prev.errors > 0 && <> · <b className="t-red">{prev.errors} with errors (skipped)</b></>}</div>
          <div className="table-wrap scroll" style={{ maxHeight: 360 }}>
            <table className="t compact">
              <thead><tr><th>Row</th><th>Name</th><th>Email</th><th>Level</th><th>Role</th><th>Reports to</th><th>Check</th></tr></thead>
              <tbody>{prev.rows.map((x) => (
                <tr key={x.row}>
                  <td>{x.row}</td><td className="semi">{x.name}</td><td className="small">{x.email}</td><td>{x.level ? `L${x.level}` : '—'}</td>
                  <td>{ROLE_LABEL[x.role] || '—'}</td><td className="small">{x.parentName || x.parentRef || '—'}</td>
                  <td className="small">{x.errors.length ? <span className="t-red">{x.errors.join('; ')}</span> : <span className="t-green">OK</span>}
                    {x.notes.length > 0 && <div className="tiny muted">{x.notes.join('; ')}</div>}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

function Hierarchy({ initialQ }) {
  const [q, setQ] = useState(initialQ || '');
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [importing, setImporting] = useState(false);
  const [run] = useAction();
  const toast = useToast();
  const doExport = () => {
    const list = all.data || [];
    const byId = new Map(list.map((u) => [u.id, u]));
    exportExcel(list.slice().sort((a, b) => b.level - a.level || a.name.localeCompare(b.name)).map((u) => ({ ...teamRow(u, byId), 'Mapped Clients': u.clients })), 'team-rm-mentors.xlsx');
  };
  const { data, reload } = useLoad(() => api.get(`/users${qs({ q })}`), [q]);
  const all = useLoad(() => api.get('/users'), []);
  const copy = (u) => {
    const text = `Freedom LifeX access\nURL: ${window.location.origin}${import.meta.env.BASE_URL}\nLogin: ${u.email}${u.code ? ` (or ${u.code})` : ''}\nPassword: as set by your administrator`;
    navigator.clipboard?.writeText(text).then(() => toast('Access details copied'), () => toast(text));
  };
  return (
    <Card>
      <div className="card-head">
        <div className="row gap-lg"><span className="card-title">Active System Accounts</span>
          <div className="input-icon"><Search size={13} /><input className="input sm" style={{ width: 230, borderRadius: 999 }} placeholder="SEARCH USER NAME OR EMAIL..." value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
        <div className="row gap-sm wrap">
          <button className="btn btn-green btn-caps" onClick={doExport} disabled={!all.data}><Download size={14} />Export</button>
          <button className="btn btn-soft btn-caps" onClick={() => setImporting(true)}><Upload size={14} />Import</button>
          <button className="btn btn-primary btn-caps" onClick={() => setEdit({})}><UserPlus size={14} />New User Account</button>
        </div>
      </div>
      {!data ? <Spinner /> : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>User Details</th><th>Role &amp; Level</th><th>Reports To</th><th>Mapped Clients</th><th>Credentials</th><th className="r">Actions</th></tr></thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id}>
                  <td><div className="cell-main">{u.name}</div><div className="small muted">{u.email}</div></td>
                  <td><span className={`tag ${u.role === 'mentor' ? 'green' : ''}`}>{u.role.toUpperCase()}</span> <b>L{u.level}</b> <span className="tiny faint">{u.level_name}</span>
                    {u.extra_levels?.length > 0 && <div className="cell-sub">+ {u.extra_levels.map((l) => `L${l}`).join(', ')}</div>}</td>
                  <td className="small muted">{u.parent_name || '—'}</td>
                  <td><div className="bold t-blue" style={{ fontSize: 16 }}>{u.clients}</div><div className="cell-sub upper">Direct clients</div></td>
                  <td><button className="btn btn-soft btn-xs btn-caps" onClick={() => copy(u)}><Copy size={11} />Copy Access</button></td>
                  <td className="r"><button className="icon-btn" onClick={() => setEdit(u)}><Pencil size={15} /></button><button className="icon-btn" onClick={() => setDel(u)}><Trash2 size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && <UserModal initial={edit} users={all.data || []} onClose={() => setEdit(null)} onSaved={() => { reload(); all.reload(); }} />}
      {importing && <ImportTeam onClose={() => setImporting(false)} onDone={() => { reload(); all.reload(); }} />}
      {del && <Confirm danger title="Delete user?" text={`${del.name} will be removed from every client hierarchy and their reports will move up to their manager. Payouts recalculate.`} confirmLabel="Delete"
        onClose={() => setDel(null)} onConfirm={() => run(() => api.del(`/users/${del.id}`).then(reload), 'User deleted')} />}
    </Card>
  );
}

// ---------------- Clients ----------------
function ClientModal({ initial, onClose, onSaved }) {
  const [f, setF] = useState({ name: '', pan: '', email: '', mobile: '', ...initial, folios: (initial?.folios || []).join(', ') });
  const [run, busy] = useAction();
  const count = f.folios.split(',').map((x) => x.trim()).filter(Boolean).length;
  const save = () => run(async () => {
    if (initial?.id) await api.put(`/clients/${initial.id}`, f); else await api.post('/clients', f);
    onSaved(); onClose();
  }, 'Profile saved');
  return (
    <Modal title={initial?.id ? 'Edit Investor Profile' : 'New Investor Profile'} onClose={onClose} footer={<>
      <button className="btn btn-ghost btn-caps" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary btn-caps btn-lg" style={{ borderRadius: 999, minWidth: 180 }} disabled={busy} onClick={save}>Save Profile</button>
    </>}>
      <Field label="Investor Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="PAN Number"><input className="input mono" value={f.pan || ''} onChange={(e) => setF({ ...f, pan: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" /></Field>
      <div className="grid g2">
        <Field label="Email ID"><input className="input" value={f.email || ''} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="client@example.com" /></Field>
        <Field label="Mobile Number"><input className="input" value={f.mobile || ''} onChange={(e) => setF({ ...f, mobile: e.target.value })} placeholder="+91 98765 43210" /></Field>
      </div>
      <Field label="Linked Folios (comma separated)" hint={`${count} folios — separate each with a comma`}>
        <textarea className="textarea mono" rows={3} value={f.folios} onChange={(e) => setF({ ...f, folios: e.target.value })} placeholder="11366282/49, 45966856/64" />
      </Field>
    </Modal>
  );
}

function MapModal({ client, users, onClose, onSaved }) {
  const [mode, setMode] = useState('rm');
  const lowest = Object.keys(client.hierarchy || {}).filter((l) => client.hierarchy[l]).map(Number).sort((x, y) => x - y)[0];
  const [rmId, setRmId] = useState(lowest ? String(client.hierarchy[lowest]) : '');
  const [h, setH] = useState({ ...client.hierarchy });
  const [leadBy, setLeadBy] = useState(client.leadBy || '');
  const [correcting, setCorrecting] = useState(false);
  const [reason, setReason] = useState('');
  const leadFixed = Boolean(client.leadBy) && !correcting;
  // With a lead brought by an L4+, only their direct reports can be the RM.
  const team = (bossId) => users.filter((u) => Number(u.parent_id) === Number(bossId));
  const rmChoices = leadBy ? team(leadBy) : users;
  const pickLead = (v) => { setLeadBy(v); if (v && !team(v).some((u) => String(u.id) === String(rmId))) setRmId(''); };
  const [resplitPast, setResplitPast] = useState(false);
  const [run, busy] = useAction();
  const eligible = (l) => users.filter((u) => u.level === l || (u.extra_levels || []).includes(l));
  const save = () => run(async () => {
    const body = { ...(mode === 'rm' ? { rmId } : { hierarchy: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((l) => [l, h[l] || null])) }), leadBy: leadBy || null, resplitPast, ...(correcting ? { correctLead: true, reason } : {}) };
    if (mode === 'rm' && !rmId) throw new Error('Choose an RM');
    if (correcting && String(leadBy || '') !== String(client.leadBy) && reason.trim().length < 5) throw new Error('Give a reason for correcting the lead source');
    await api.put(`/clients/${client.id}/map`, body);
    onSaved(); onClose();
  }, 'Client mapping saved');
  return (
    <Modal title="Map Account" onClose={onClose} footer={<>
      <button className="btn btn-ghost btn-caps" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary btn-caps btn-lg" disabled={busy} onClick={save}>Save Mapping</button>
    </>}>
      <div className="semi">{client.name} <span className="mono tiny faint">{client.pan}</span></div>
      <Field label="Lead brought by" hint={leadFixed ? 'The lead source is fixed once saved. An admin can correct a mistake below.' : correcting ? 'Correcting the saved lead source. The re-split box below is ticked so brokerage already received follows the correction; untick it to change only future brokerage.' : 'Leave blank when the RM brought the lead. Pick the L4+ who brought it to pass it down: they get 25% first, and only their direct reports can be chosen as RM.'}>
        <select className="select" value={leadBy} disabled={leadFixed} onChange={(e) => pickLead(e.target.value ? Number(e.target.value) : '')}>
          <option value="">— The RM brought it —</option>
          {users.filter((u) => u.level >= 4).map((u) => <option key={u.id} value={u.id}>{u.name} · L{u.level} {LEVELS[u.level]}</option>)}
        </select>
        {leadFixed && <button type="button" className="btn btn-xs btn-caps" style={{ marginTop: 8 }} onClick={() => { setCorrecting(true); setResplitPast(true); }}><Pencil size={12} />Correct lead source</button>}
      </Field>
      {correcting && (
        <Field label="Reason for the correction" hint="Saved in the Audit Log with the old and new lead source. Only admins can do this.">
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Entered Anmol by mistake, lead came through Priya" />
        </Field>
      )}
      <Segmented value={mode} onChange={setMode} options={[{ value: 'rm', label: 'Assign RM (standard hierarchy)' }, { value: 'levels', label: 'Set each level' }]} />
      {mode === 'rm' ? (
        <Field label="Relationship Manager" hint={leadBy ? `Showing only people who report directly to ${users.find((u) => u.id === Number(leadBy))?.name || 'the lead'}.` : 'Their managers are filled in automatically from the reporting line.'}>
          <select className="select" value={rmId} onChange={(e) => setRmId(e.target.value)}>
            <option value="">— Select RM —</option>
            {rmChoices.map((u) => <option key={u.id} value={u.id}>{u.name} · L{u.level} {LEVELS[u.level]}</option>)}
          </select>
        </Field>
      ) : [1, 2, 3, 4, 5, 6, 7].map((l) => (
        <Field key={l} label={`Level ${l} · ${LEVELS[l]}`}>
          <select className="select" value={h[l] || ''} onChange={(e) => setH({ ...h, [l]: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">— Nobody —</option>
            {eligible(l).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
      ))}
      <label className="check"><input type="checkbox" checked={resplitPast} onChange={(e) => setResplitPast(e.target.checked)} />Also re-split brokerage already received (only to correct a wrong mapping)</label>
      <div className="tiny muted">Normally the new mapping applies only to brokerage imported from now on; earlier payouts stay as they were. Locked months never change.</div>
    </Modal>
  );
}

function ClientList({ initialQ, admin }) {
  const [q, setQ] = useState(initialQ || '');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState(null);
  const [map, setMap] = useState(null);
  const [del, setDel] = useState(null);
  const [checked, setChecked] = useState(new Set());
  const [run] = useAction();
  const { data, reload } = useLoad(() => (filter === 'orphan' ? api.get('/clients/orphan-folios') : api.get(`/clients${qs({ q, filter, page })}`)), [q, filter, page]);
  const users = useLoad(() => api.get('/users'), []);
  const counts = useLoad(() => api.get('/clients?size=1'), [data]);
  const c = counts.data?.counts || {};
  const doExport = async () => {
    const r = await api.get(`/clients${qs({ q, filter, all: 1 })}`);
    exportExcel(r.rows.map((x) => ({ Name: x.name, PAN: x.pan, Email: x.email, Mobile: x.mobile, Folios: x.folios.join(', '), AUM: x.aum, 'Assigned Manager': x.owner?.name || '', Level: x.owner?.level || '' })), 'clients.xlsx');
  };
  const pills = [['all', 'All Clients', c.all], ['noRM', 'No RM', c.noRM], ['noBM', 'No BM', c.noBM], ['noFolios', 'No Folios', c.noFolios], ['orphan', 'Folios with no client', c.orphanFolios]];
  return (
    <Card>
      <div className="card-head" style={{ borderBottom: 0 }}>
        <div className="input-icon" style={{ width: 340 }}><Search size={15} /><input className="input" placeholder="Search portfolios..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        <div className="row gap">
          <button className="btn btn-green btn-caps" onClick={doExport}><Download size={14} />Export</button>
          {admin && <button className="btn btn-primary btn-caps" onClick={() => setEdit({})}><Plus size={14} />Add Client</button>}
        </div>
      </div>
      <div className="pills">
        {pills.map(([k, label, n]) => <button key={k} className={`pill ${filter === k ? 'on' : ''} ${k === 'orphan' && filter !== k ? 'warn' : ''}`} onClick={() => { setFilter(k); setPage(1); }}>{label} <span className="n">{n ?? '?'}</span></button>)}
      </div>
      {!data ? <Spinner /> : filter === 'orphan' ? (
        <div className="table-wrap"><table className="t">
          <thead><tr><th>Folio</th><th>Investor on statement</th><th>PAN</th><th className="r">Txns</th><th className="r">Gross</th></tr></thead>
          <tbody>{!data.length && <tr><td colSpan={5}><Empty title="Every folio with brokerage belongs to a client" /></td></tr>}
            {data.map((f) => <tr key={f.folio}><td className="mono">{f.folio}</td><td>{f.investor || <i className="faint">unknown</i>}</td><td className="mono small">{f.pan || '—'}</td><td className="r">{f.txns}</td><td className="r t-amber bold">₹{f.gross.toFixed(2)}</td></tr>)}</tbody>
        </table></div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th style={{ width: 30 }}><input type="checkbox" checked={data.rows.length > 0 && data.rows.every((r) => checked.has(r.id))} onChange={(e) => setChecked(new Set(e.target.checked ? data.rows.map((r) => r.id) : []))} /></th>
                <th>Investor Identity</th><th>PAN / Folios</th><th className="r">AUM</th><th>Assigned Manager / Owner</th><th className="r">Action</th></tr></thead>
              <tbody>
                {!data.rows.length && <tr><td colSpan={6}><Empty title="No clients found" text="Import transaction or folio files, or add a client." /></td></tr>}
                {data.rows.map((x) => (
                  <tr key={x.id}>
                    <td><input type="checkbox" checked={checked.has(x.id)} onChange={() => { const s = new Set(checked); s.has(x.id) ? s.delete(x.id) : s.add(x.id); setChecked(s); }} /></td>
                    <td><div className="cell-main">{x.name}</div><div className="cell-sub blue mono">{x.pan || 'NO PAN'}</div></td>
                    <td><div className="small semi" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.folios.join(', ') || '—'}</div><div className="cell-sub upper">{x.folios.length} linked folios</div></td>
                    <td className="r"><div className="bold t-green">{inrShort(x.aum)}</div><div className="cell-sub">LATEST · {x.aumPeriod}</div></td>
                    <td>{x.owner ? <><div className="semi">{x.owner.name}</div><div className="cell-sub blue upper">Level {x.owner.level}</div></> : <span className="badge amber">Unmapped</span>}</td>
                    <td className="r" style={{ whiteSpace: 'nowrap' }}>
                      {admin && <><button className="btn btn-xs btn-caps" style={{ color: 'var(--blue)', borderColor: '#c7d7fe' }} onClick={() => setMap(x)}><UserCog size={12} />Map Account</button>
                        <button className="icon-btn" onClick={() => setEdit(x)}><Pencil size={14} /></button>
                        <button className="icon-btn" onClick={() => setDel(x)}><Trash2 size={14} /></button></>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={data.total} onPage={setPage} />
        </>
      )}
      {edit && <ClientModal initial={edit} onClose={() => setEdit(null)} onSaved={reload} />}
      {map && <MapModal client={map} users={users.data || []} onClose={() => setMap(null)} onSaved={reload} />}
      {del && <Confirm danger title="Delete client?" text={`${del.name} will be removed. Their brokerage stays in the system as unmapped (company retention) until re-mapped.`} confirmLabel="Delete"
        onClose={() => setDel(null)} onConfirm={() => run(() => api.del(`/clients/${del.id}`).then(reload), 'Client deleted')} />}
    </Card>
  );
}

// ---------------- Standardize ----------------
function NameTable({ kind, title, icon, cols }) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [run] = useAction();
  const { data, reload } = useLoad(() => api.get(`/clients/names/${kind}${qs({ page, q })}`), [page, q]);
  const save = () => run(() => api.put(`/clients/names/${kind}`, editing).then(() => { setEditing(null); reload(); }), 'Standard name updated');
  return (
    <Card className="card-pad">
      <div className="row between"><h3 className="row gap-sm" style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>{icon}{title}</h3>
        <input className="input sm" style={{ width: 180 }} placeholder="Filter…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
      <div className="table-wrap scroll mt" style={{ maxHeight: 300, border: '1px solid var(--border)', borderRadius: 10 }}>
        <table className="t compact">
          <thead><tr><th style={{ textTransform: 'none', fontSize: 12, color: 'var(--text)' }}>{cols[0]}</th><th style={{ textTransform: 'none', fontSize: 12, color: 'var(--text)' }}>{cols[1]}</th></tr></thead>
          <tbody>
            {data?.rows.map((r) => (
              <tr key={r.original}>
                <td className="small muted">{r.original}</td>
                <td>{editing?.original === r.original
                  ? <div className="row gap-sm"><input className="input sm" style={{ width: '100%' }} autoFocus value={editing.standard} onChange={(e) => setEditing({ ...editing, standard: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} /><button className="btn btn-primary btn-xs" onClick={save}>Save</button></div>
                  : <button className="t-blue semi small" style={{ background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', color: kind === 'scheme' ? 'var(--purple)' : 'var(--blue)' }} onClick={() => setEditing({ ...r })}>{r.standard}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && !data.rows.length && <Empty title="" text="Names appear here after the first import." />}
      </div>
      {data && <Pager page={page} total={data.total} onPage={setPage} />}
    </Card>
  );
}

function Standardize() {
  const [run] = useAction();
  const { data, reload } = useLoad(() => api.get('/clients/duplicates'), []);
  const merge = (g, master) => run(() => api.post('/clients/merge', { masterId: master.id, otherIds: g.records.filter((r) => r.id !== master.id).map((r) => r.id) }).then(reload), 'Records merged into master');
  return (
    <div className="col gap-lg">
      <Card className="card-pad col gap">
        <h3 className="row gap-sm" style={{ fontSize: 17 }}><Search size={18} className="t-purple" />Advanced Duplicate Detection</h3>
        <p className="muted">Scanning for conflicts in Identity (PAN), Contact (Mobile/Email), and exact Name matches.</p>
        <div className="banner amber small"><b>Check the names before merging.</b> A shared PAN does not always mean a duplicate — a minor invests under the guardian's PAN, so siblings legitimately share one (e.g. two children of the same parent). Merge only when the records are the SAME person; "Keep as Master" permanently folds the others into it.</div>
        {!data ? <Spinner /> : !data.length ? <Empty title="No duplicates found" text="Every client has a unique PAN, contact and name." /> : data.map((g) => (
          <div key={`${g.by}-${g.key}`} className="dup-group">
            <div className="row between"><div><div className="upper t-amber" style={{ fontSize: 10 }}>Possible duplicate — matched by {g.by}</div><div className="bold mt-sm">{g.key}</div></div>
              <span className="badge amber">{g.records.length} conflicting records</span></div>
            <div className="grid g2 mt">
              {g.records.map((r) => (
                <div key={r.id} className="dup-card">
                  <div className="cell-main">{r.name}</div>
                  <div className="row gap-sm wrap mt-sm">
                    <span className="tag row gap-sm"><IdCard size={10} />{r.pan || '—'}</span>
                    {r.mobile && <span className="tag row gap-sm"><Phone size={10} />{r.mobile}</span>}
                    {r.email && <span className="tag row gap-sm"><Mail size={10} />{r.email.toUpperCase()}</span>}
                    <span className="tag">{r.folios} folios</span>
                  </div>
                  <button className="btn btn-primary btn-caps mt" style={{ width: '100%' }} onClick={() => merge(g, r)}>Keep as Master</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Card>
      <div className="grid g2">
        <NameTable kind="amc" title="AMC Name Standardization" icon={<Tags size={16} className="t-blue" />} cols={['Original Name', 'Mapped Standard']} />
        <NameTable kind="scheme" title="Scheme Standardization" icon={<Database size={16} className="t-purple" />} cols={['Extracted Name', 'Standard Name']} />
      </div>
    </div>
  );
}

export default function Clients() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const admin = user.role === 'admin';
  const [tab, setTab] = useState(params.get('tab') || (admin ? 'hierarchy' : 'clients'));
  const q = params.get('q') || '';
  const opts = [
    ...(admin ? [{ value: 'hierarchy', label: 'Hierarchy', icon: <Shield size={13} /> }] : []),
    { value: 'clients', label: 'Clients', icon: <Users size={13} /> },
    ...(admin ? [{ value: 'standardize', label: 'Standardize', icon: <Database size={13} /> }] : []),
  ];
  return (
    <>
      <PageHead title="Enterprise Management" sub="System-wide client mapping and hierarchy control.">
        <Segmented className="solid caps" value={tab} onChange={setTab} options={opts} />
      </PageHead>
      {tab === 'hierarchy' && admin && <Hierarchy key={q} initialQ={q} />}
      {tab === 'clients' && <ClientList key={q} initialQ={q} admin={admin} />}
      {tab === 'standardize' && admin && <Standardize />}
    </>
  );
}


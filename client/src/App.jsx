import { useEffect, useState } from 'react';

const statuses = ['Open', 'In progress', 'Completed'];
const emptyForm = { title: '', clientName: '', assignee: '', dueDate: '', status: 'Open' };

function localDate(value) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function isOverdue(request) {
  const today = new Date();
  const dueDate = new Date(request.dueDate);
  today.setUTCHours(0, 0, 0, 0);
  dueDate.setUTCHours(0, 0, 0, 0);
  return request.status !== 'Completed' && dueDate < today;
}

export default function App() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('All requests');
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadRequests() {
    setError('');
    try {
      const response = await fetch('/api/requests');
      if (!response.ok) throw new Error('Could not load requests. Is the API running?');
      setRequests(await response.json());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRequests(); }, []);

  const overdueRequests = requests.filter(isOverdue);
  const overdueCount = overdueRequests.length;
  const activeCount = requests.filter((request) => request.status !== 'Completed').length;
  const visibleRequests = requests.filter((request) => {
    if (filter === 'All requests') return true;
    if (filter === 'Overdue') return isOverdue(request);
    return request.status === filter;
  });

  async function createRequest(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not create request.');
      setForm(emptyForm);
      setShowForm(false);
      setNotice('Request added to the work queue.');
      await loadRequests();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(request, status) {
    setError('');
    try {
      const response = await fetch(`/api/requests/${request._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not update status.');
      setRequests((current) => current.map((item) => item._id === request._id ? result : item));
      setNotice('Status updated.');
    } catch (updateError) {
      setError(updateError.message);
    }
  }

  async function generateReminders() {
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/reminders/check', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not generate reminders.');
      setNotice(result.reminders.length
        ? `${result.reminders.length} reminder${result.reminders.length === 1 ? '' : 's'} generated in the API log.`
        : 'No overdue reminders to generate.');
    } catch (reminderError) {
      setError(reminderError.message);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home" aria-label="Ledgerline home">
          <span className="brand-mark">L</span>
          <span>ledgerline<small>ACCOUNTING DESK</small></span>
        </a>
        <div className="nav-caption">WORKSPACE</div>
        <button className={`nav-item${filter !== 'Overdue' ? ' active' : ''}`} type="button" onClick={() => setFilter('All requests')}><span className="nav-symbol">▤</span> Requests <span className="nav-count">{activeCount}</span></button>
        <button className={`nav-item${filter === 'Overdue' ? ' active' : ''}`} type="button" onClick={() => setFilter('Overdue')}><span className="nav-symbol">◷</span> Overdue <span className="nav-count alert-count">{overdueCount}</span></button>
        <div className="sidebar-foot"><span className="avatar avatar-green">LL</span><span>Ledgerline demo<small>Sample workspace</small></span><span className="more-mark">···</span></div>
      </aside>

      <main className="main-area" id="home">
        <header className="topbar"><span>Workspace <b>/</b> Requests</span><span className="today-label">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span></header>
        <div className="page-content">
          <section className="page-heading">
            <div><div className="eyebrow">OPERATIONS / CLIENT WORK</div><h1>Request tracker</h1><p>Keep client requests moving, from intake to done.</p></div>
            <button className="primary-button" type="button" onClick={() => { setShowForm((shown) => !shown); setError(''); }}><span aria-hidden="true">+</span> New request</button>
          </section>

          <section className="summary-row" aria-label="Request summary">
            <div className="summary-item"><span className="summary-label">ACTIVE REQUESTS</span><strong>{activeCount.toString().padStart(2, '0')}</strong><span className="summary-note">Not yet completed</span></div>
            <div className="summary-item overdue-summary"><span className="summary-label">PAST DUE</span><strong>{overdueCount.toString().padStart(2, '0')}</strong><span className="summary-note">Needs attention</span></div>
            <div className="summary-item"><span className="summary-label">TOTAL IN QUEUE</span><strong>{requests.length.toString().padStart(2, '0')}</strong><span className="summary-note">Across all statuses</span></div>
            <button className="reminder-action" type="button" onClick={generateReminders}><span className="reminder-icon">↗</span><span>Generate reminders<small>For open overdue work</small></span></button>
          </section>

          {!loading && overdueCount > 0 && <section className="overdue-alert" role="alert" aria-labelledby="overdue-alert-title">
            <div className="overdue-alert-heading">
              <span className="overdue-alert-icon" aria-hidden="true">!</span>
              <div><h2 id="overdue-alert-title">{overdueCount} overdue {overdueCount === 1 ? 'request needs' : 'requests need'} attention</h2><p>These open requests are past their due date:</p></div>
            </div>
            <ul>{overdueRequests.map((request) => <li key={request._id}><strong>{request.title}</strong><span>{request.clientName} · Assigned to {request.assignee}</span></li>)}</ul>
            <button type="button" onClick={() => setFilter('Overdue')}>View overdue requests</button>
          </section>}

          {showForm && <form className="request-form" onSubmit={createRequest}>
            <div className="form-heading"><div><span className="eyebrow">NEW WORK ITEM</span><h2>Add a request</h2></div><button className="close-button" type="button" aria-label="Close form" onClick={() => setShowForm(false)}>×</button></div>
            <label className="field field-wide">Request title<input required maxLength="120" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Prepare quarterly sales tax" /></label>
            <label className="field">Client name<input required maxLength="80" value={form.clientName} onChange={(event) => setForm({ ...form, clientName: event.target.value })} placeholder="Sample client only" /></label>
            <label className="field">Assignee<input required maxLength="80" value={form.assignee} onChange={(event) => setForm({ ...form, assignee: event.target.value })} placeholder="Team member" /></label>
            <label className="field">Due date<input required type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label>
            <label className="field">Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
            <div className="form-actions"><button className="text-button" type="button" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-button" disabled={saving} type="submit">{saving ? 'Adding…' : 'Add request'}</button></div>
          </form>}

          {error && <div className="feedback error-feedback" role="alert">{error}</div>}
          {notice && <div className="feedback" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}>×</button></div>}

          <section className="queue-section">
            <div className="queue-heading"><div><span className="eyebrow">THE WORK QUEUE</span><h2>Requests <span>{visibleRequests.length}</span></h2></div>
              <label className="filter-control"><span>View</span><select aria-label="Filter requests" value={filter} onChange={(event) => setFilter(event.target.value)}>{['All requests', 'Open', 'In progress', 'Completed', 'Overdue'].map((option) => <option key={option}>{option}</option>)}</select></label>
            </div>
            {filter === 'Overdue' && <div className="feedback" role="note">Use the Status menu on a request to update it. Marking it Completed removes it from the overdue view.</div>}
            <div className="table-wrap"><table>
              <thead><tr><th>REQUEST</th><th>CLIENT</th><th>ASSIGNEE</th><th>DUE DATE</th><th>STATUS</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="5" className="empty-state">Loading requests…</td></tr> : visibleRequests.length === 0 ? <tr><td colSpan="5" className="empty-state">No requests in this view.</td></tr> : visibleRequests.map((request) => <tr key={request._id}>
                  <td className="request-title-cell"><strong>{request.title}</strong>{isOverdue(request) && <span className="overdue-tag">OVERDUE</span>}</td>
                  <td>{request.clientName}</td>
                  <td><span className="assignee"><span className="avatar">{request.assignee.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>{request.assignee}</span></td>
                  <td className={isOverdue(request) ? 'due-date overdue-date' : 'due-date'}>{localDate(request.dueDate)}</td>
                  <td><select className={`status-select status-${request.status.toLowerCase().replace(' ', '-')}`} aria-label={`Status for ${request.title}`} value={request.status} onChange={(event) => updateStatus(request, event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></td>
                </tr>)}
              </tbody>
            </table></div>
            <div className="table-footer"><span>Sorted by due date · earliest first</span><span>{visibleRequests.length} {visibleRequests.length === 1 ? 'request' : 'requests'}</span></div>
          </section>
          <footer className="privacy-note">Demo workspace uses fictional sample data. Do not enter real client information.</footer>
        </div>
      </main>
    </div>
  );
}

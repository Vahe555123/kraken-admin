import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { logout } from '../App';
import { api } from '../api';
import styles from './Emails.module.css';

interface EmailItem {
  id: string;
  email: string;
  status: 'used' | 'not_used';
  lastUsedAt: string | null;
  lastJobId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EmailsResponse {
  ok: boolean;
  emails: EmailItem[];
  total: number;
}

function formatStatus(status: EmailItem['status']): string {
  return status === 'used' ? 'used' : 'not used';
}

export function Emails() {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addEmail, setAddEmail] = useState('');
  const [addBulk, setAddBulk] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const load = () => {
    api<EmailsResponse>('/admin/emails')
      .then((data) => {
        setError(null);
        setEmails(data.emails);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleAddOne = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmail.trim()) return;
    setAdding(true);
    try {
      await api('/admin/emails', {
        method: 'POST',
        body: JSON.stringify({ raw: addEmail }),
      });
      setAddEmail('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add failed');
    } finally {
      setAdding(false);
    }
  };

  const handleAddBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addBulk.trim()) return;
    setAdding(true);
    try {
      await api('/admin/emails/bulk', {
        method: 'POST',
        body: JSON.stringify({ raw: addBulk }),
      });
      setAddBulk('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk add failed');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this email?')) return;
    try {
      await api(`/admin/emails/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleDeleteAll = async () => {
    if (emails.length === 0) return;
    if (!confirm('Delete all emails?')) return;
    setDeletingAll(true);
    try {
      await api('/admin/emails', { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete all failed');
    } finally {
      setDeletingAll(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: EmailItem['status']) => {
    const nextStatus = currentStatus === 'used' ? 'not_used' : 'used';
    try {
      await api(`/admin/emails/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    }
  };

  const usedCount = emails.filter((item) => item.status === 'used').length;
  const availableCount = emails.filter((item) => item.status === 'not_used').length;

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <h1 className={styles.title}>Bot Credit</h1>
        <nav className={styles.nav}>
          <Link to="/dashboard" className={styles.navLink}>Jobs</Link>
          <Link to="/proxies" className={styles.navLink}>Proxies</Link>
          <Link to="/emails" className={styles.navActive}>Emails</Link>
        </nav>
        <button type="button" onClick={logout} className={styles.logout}>
          Logout
        </button>
      </header>

      <main className={styles.main}>
        <div className={styles.stats}>
          <span>Total: {emails.length}</span>
          <span>Available: {availableCount}</span>
          <span>Used: {usedCount}</span>
          <button
            type="button"
            className={styles.btnDelAll}
            onClick={handleDeleteAll}
            disabled={loading || deletingAll || emails.length === 0}
          >
            {deletingAll ? 'Deleting...' : 'Delete all'}
          </button>
        </div>

        <div className={styles.addSection}>
          <form onSubmit={handleAddOne} className={styles.addForm}>
            <input
              type="text"
              placeholder="name@example.com"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              className={styles.input}
            />
            <button type="submit" disabled={adding} className={styles.btnAdd}>
              Add
            </button>
          </form>

          <form onSubmit={handleAddBulk} className={styles.bulkForm}>
            <textarea
              placeholder="Paste emails separated by newline, space, or comma"
              value={addBulk}
              onChange={(e) => setAddBulk(e.target.value)}
              className={styles.textarea}
              rows={5}
            />
            <button type="submit" disabled={adding} className={styles.btnAdd}>
              Add all
            </button>
          </form>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Last used</th>
                <th>Job ID</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {emails.map((item) => (
                <tr key={item.id}>
                  <td className={styles.emailCell}>{item.email}</td>
                  <td>
                    <button
                      type="button"
                      className={item.status === 'used' ? styles.badgeUsed : styles.badgeNotUsed}
                      onClick={() => handleToggleStatus(item.id, item.status)}
                    >
                      {formatStatus(item.status)}
                    </button>
                  </td>
                  <td>{item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleString() : '—'}</td>
                  <td className={styles.mono}>{item.lastJobId ? `${item.lastJobId.slice(0, 8)}…` : '—'}</td>
                  <td>{new Date(item.createdAt).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.btnDel}
                      onClick={() => handleDelete(item.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && emails.length === 0 && (
          <p className={styles.hint}>
            Add internal replacement emails here. The worker will use them only when the target site reports that the current email has already been used.
          </p>
        )}
      </main>
    </div>
  );
}

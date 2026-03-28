import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { logout } from '../App';
import { api } from '../api';
import styles from './Proxies.module.css';

interface ProxyItem {
  id: string;
  url: string;
  status: string;
  lastUsedAt: string | null;
  lastJobId: string | null;
  createdAt: string;
}

interface ProxiesResponse {
  ok: boolean;
  proxies: ProxyItem[];
  total: number;
}

export function Proxies() {
  const [proxies, setProxies] = useState<ProxyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addUrl, setAddUrl] = useState('');
  const [addBulk, setAddBulk] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [expandRange, setExpandRange] = useState(true);

  const load = () => {
    api<ProxiesResponse>('/admin/proxies')
      .then((data) => {
        setError(null);
        setProxies(data.proxies);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleAddOne = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUrl.trim()) return;
    setAdding(true);
    try {
      await api('/admin/proxies', {
        method: 'POST',
        body: JSON.stringify({ url: addUrl.trim(), expandPortRange: expandRange }),
      });
      setAddUrl('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add failed');
    } finally {
      setAdding(false);
    }
  };

  const handleAddBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    const urls = addBulk.split(/[\n,]/).map((u) => u.trim()).filter(Boolean);
    if (urls.length === 0) return;
    setAdding(true);
    try {
      await api('/admin/proxies/bulk', { method: 'POST', body: JSON.stringify({ urls }) });
      setAddBulk('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add failed');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить прокси?')) return;
    try {
      await api(`/admin/proxies/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleDeleteAll = async () => {
    if (proxies.length === 0) return;
    if (!confirm('Удалить все прокси?')) return;
    setDeletingAll(true);
    try {
      await api('/admin/proxies', { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete all failed');
    } finally {
      setDeletingAll(false);
    }
  };

  const handleToggle = async (id: string, current: string) => {
    const next = current === 'active' ? 'disabled' : 'active';
    try {
      await api(`/admin/proxies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Toggle failed');
    }
  };

  const activeCount = proxies.filter((p) => p.status === 'active').length;
  const usedCount = proxies.filter((p) => p.lastUsedAt != null).length;

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <h1 className={styles.title}>Bot Credit</h1>
        <nav className={styles.nav}>
          <Link to="/dashboard" className={styles.navLink}>Заявки</Link>
          <Link to="/proxies" className={styles.navActive}>Прокси</Link>
        </nav>
        <button type="button" onClick={logout} className={styles.logout}>
          Logout
        </button>
      </header>

      <main className={styles.main}>
        <div className={styles.stats}>
          <span>Всего: {proxies.length}</span>
          <span>Активных: {activeCount}</span>
          <span>Использовано: {usedCount}</span>
          <button
            type="button"
            className={styles.btnDelAll}
            onClick={handleDeleteAll}
            disabled={loading || deletingAll || proxies.length === 0}
          >
            {deletingAll ? 'Удаление...' : 'Удалить все'}
          </button>
        </div>

        <div className={styles.addSection}>
          <form onSubmit={handleAddOne} className={styles.addForm}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={expandRange}
                onChange={(e) => setExpandRange(e.target.checked)}
              />
              Без порта -&gt; порты 9000-9199 по очереди (round-robin)
            </label>
            <input
              type="text"
              placeholder="socks5://user:pass@proxy.froxy.com (без :порт)"
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              className={styles.input}
            />
            <button type="submit" disabled={adding} className={styles.btnAdd}>
              Добавить
            </button>
          </form>

          <form onSubmit={handleAddBulk} className={styles.bulkForm}>
            <textarea
              placeholder="Прокси построчно или через запятую"
              value={addBulk}
              onChange={(e) => setAddBulk(e.target.value)}
              className={styles.textarea}
              rows={4}
            />
            <button type="submit" disabled={adding} className={styles.btnAdd}>
              Добавить все
            </button>
          </form>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {loading ? (
          <div className={styles.loading}>Загрузка...</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>URL</th>
                <th>Статус</th>
                <th>Последнее использование</th>
                <th>Job ID</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {proxies.map((proxy) => (
                <tr key={proxy.id}>
                  <td className={styles.url}>{proxy.url}</td>
                  <td>
                    <button
                      type="button"
                      className={proxy.status === 'active' ? styles.badgeActive : styles.badgeDisabled}
                      onClick={() => handleToggle(proxy.id, proxy.status)}
                    >
                      {proxy.status}
                    </button>
                  </td>
                  <td>{proxy.lastUsedAt ? new Date(proxy.lastUsedAt).toLocaleString('ru-RU') : '—'}</td>
                  <td className={styles.mono}>{proxy.lastJobId ? `${proxy.lastJobId.slice(0, 8)}…` : '—'}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.btnDel}
                      onClick={() => handleDelete(proxy.id)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && proxies.length === 0 && (
          <p className={styles.hint}>
            Добавьте базовый URL без порта, например socks5://login:password@proxy.froxy.com.
            Будут созданы записи :9000 ... :9199. Очередь выбирает прокси по lastUsedAt.
          </p>
        )}
      </main>
    </div>
  );
}

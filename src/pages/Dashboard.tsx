import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { logout } from '../App';
import { api } from '../api';
import styles from './Dashboard.module.css';

interface JobSummary {
  id: string;
  status: string;
  currentStep: number | null;
  errorMessage: string | null;
  proxy: string | null;
  createdAt: string;
  updatedAt: string;
  phone?: string | null;
  email?: string | null;
}

interface JobsResponse {
  ok: boolean;
  jobs: JobSummary[];
  pagination: { page: number; limit: number; total: number };
}

interface QueueEntrySummary {
  queueJobId: string;
  appJobId: string | null;
  name: string;
  state: 'waiting' | 'prioritized' | 'delayed' | 'active';
  position: number;
  enqueuedAt: string;
  scheduledFor: string | null;
  dryRun: boolean;
  attemptsMade: number;
  attemptsStarted: number;
  phone: string | null;
  email: string | null;
  dbStatus: string | null;
  errorMessage: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface QueueResponse {
  ok: boolean;
  summary: {
    waiting: number;
    prioritized: number;
    delayed: number;
    active: number;
  };
  entries: QueueEntrySummary[];
  activeEntries: QueueEntrySummary[];
}

const STATUS_OPTIONS = ['', 'queued', 'running', 'cancelling', 'cancelled', 'completed', 'failed', 'dry_run_completed'];

function shortId(value: string | null | undefined): string {
  if (!value) return '—';
  return value.length > 8 ? `${value.slice(0, 8)}…` : value;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [queueEntries, setQueueEntries] = useState<QueueEntrySummary[]>([]);
  const [activeEntries, setActiveEntries] = useState<QueueEntrySummary[]>([]);
  const [queueSummary, setQueueSummary] = useState({
    waiting: 0,
    prioritized: 0,
    delayed: 0,
    active: 0,
  });
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') ?? '1', 10));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deletingQueueJobId, setDeletingQueueJobId] = useState<string | null>(null);
  const [deletingAppJobId, setDeletingAppJobId] = useState<string | null>(null);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    params.set('page', String(page));
    params.set('limit', '20');

    Promise.allSettled([
      api<JobsResponse>(`/admin/jobs?${params}`),
      api<QueueResponse>('/admin/queue?limit=50'),
    ])
      .then(([jobsResult, queueResult]) => {
        if (cancelled) return;

        const errors: string[] = [];

        if (jobsResult.status === 'fulfilled') {
          setJobs(jobsResult.value.jobs);
          setPagination(jobsResult.value.pagination);
        } else {
          errors.push(jobsResult.reason instanceof Error ? jobsResult.reason.message : 'Jobs load failed');
          setJobs([]);
          setPagination({ page: 1, limit: 20, total: 0 });
        }

        if (queueResult.status === 'fulfilled') {
          setQueueEntries(queueResult.value.entries);
          setActiveEntries(queueResult.value.activeEntries ?? []);
          setQueueSummary(queueResult.value.summary);
        } else {
          errors.push(queueResult.reason instanceof Error ? queueResult.reason.message : 'Queue load failed');
          setQueueEntries([]);
          setActiveEntries([]);
          setQueueSummary({ waiting: 0, prioritized: 0, delayed: 0, active: 0 });
        }

        setError(errors.length > 0 ? errors.join(' | ') : null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [statusFilter, page, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit || 1));

  const refresh = () => setRefreshKey((current) => current + 1);

  const handleDeleteQueueEntry = async (queueJobId: string) => {
    if (!window.confirm('Delete this queue entry?')) return;
    setDeletingQueueJobId(queueJobId);
    setError(null);
    try {
      await api(`/admin/queue/${encodeURIComponent(queueJobId)}`, { method: 'DELETE' });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Queue delete failed');
    } finally {
      setDeletingQueueJobId(null);
    }
  };

  const handleDeleteQueuedJob = async (jobId: string) => {
    if (!window.confirm('Delete queued job and remove it from BullMQ?')) return;
    setDeletingAppJobId(jobId);
    setError(null);
    try {
      await api(`/admin/jobs/${encodeURIComponent(jobId)}/queue`, { method: 'DELETE' });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Job queue delete failed');
    } finally {
      setDeletingAppJobId(null);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!window.confirm('Cancel the current running session?')) return;
    setCancellingJobId(jobId);
    setError(null);
    try {
      await api(`/admin/jobs/${encodeURIComponent(jobId)}/cancel`, { method: 'POST' });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Job cancel failed');
    } finally {
      setCancellingJobId(null);
    }
  };

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <h1 className={styles.title}>Bot Credit</h1>
        <nav className={styles.nav}>
          <Link to="/dashboard" className={styles.navActive}>Jobs</Link>
          <Link to="/proxies" className={styles.navLink}>Proxies</Link>
        </nav>
        <button type="button" onClick={logout} className={styles.logout}>
          Logout
        </button>
      </header>

      <main className={styles.main}>
        <div className={styles.toolbar}>
          <h2 className={styles.subtitle}>Jobs</h2>
          <div className={styles.filters}>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className={styles.select}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.filter(Boolean).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <button type="button" className={styles.btn} onClick={refresh}>
              Refresh
            </button>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {loading ? (
          <div className={styles.loading}>Loading…</div>
        ) : (
          <>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>Active Sessions</h3>
                  <p className={styles.sectionText}>Running browser sessions. Cancel stops the current session and lets the next queued item continue.</p>
                </div>
              </div>

              {activeEntries.length === 0 ? (
                <div className={styles.empty}>No active sessions</div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Queue ID</th>
                      <th>Job ID</th>
                      <th>State</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Started</th>
                      <th>Updated</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeEntries.map((entry) => (
                      <tr key={entry.queueJobId}>
                        <td className={styles.mono}>{shortId(entry.queueJobId)}</td>
                        <td className={styles.mono}>{shortId(entry.appJobId)}</td>
                        <td>
                          <span className={styles[`queueState_${entry.state}`] ?? styles.status}>
                            {entry.state}
                          </span>
                        </td>
                        <td>{entry.phone ?? 'вЂ”'}</td>
                        <td>{entry.email ?? 'вЂ”'}</td>
                        <td>{formatDate(entry.createdAt ?? entry.enqueuedAt)}</td>
                        <td>{formatDate(entry.updatedAt ?? entry.enqueuedAt)}</td>
                        <td className={styles.actionsCell}>
                          {entry.appJobId && (
                            <>
                              <button
                                type="button"
                                className={styles.btn}
                                onClick={() => navigate(`/jobs/${entry.appJobId}`)}
                              >
                                Open
                              </button>
                              <button
                                type="button"
                                className={styles.dangerBtn}
                                onClick={() => handleCancelJob(entry.appJobId!)}
                                disabled={cancellingJobId === entry.appJobId || entry.dbStatus === 'cancelling'}
                              >
                                {cancellingJobId === entry.appJobId || entry.dbStatus === 'cancelling' ? 'Cancelling…' : 'Cancel'}
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>Queue</h3>
                  <p className={styles.sectionText}>BullMQ waiting and delayed entries. Delete removes queued sessions before they start.</p>
                </div>
              </div>

              <div className={styles.queueSummary}>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Waiting</span>
                  <strong className={styles.summaryValue}>{queueSummary.waiting}</strong>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Prioritized</span>
                  <strong className={styles.summaryValue}>{queueSummary.prioritized}</strong>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Delayed</span>
                  <strong className={styles.summaryValue}>{queueSummary.delayed}</strong>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Active</span>
                  <strong className={styles.summaryValue}>{queueSummary.active}</strong>
                </div>
              </div>

              {queueEntries.length === 0 ? (
                <div className={styles.empty}>Queue is empty</div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Queue ID</th>
                      <th>Job ID</th>
                      <th>State</th>
                      <th>Pos</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Queued</th>
                      <th>Scheduled</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {queueEntries.map((entry) => (
                      <tr key={entry.queueJobId}>
                        <td className={styles.mono}>{shortId(entry.queueJobId)}</td>
                        <td className={styles.mono}>{shortId(entry.appJobId)}</td>
                        <td>
                          <span className={styles[`queueState_${entry.state}`] ?? styles.status}>
                            {entry.state}
                          </span>
                        </td>
                        <td>{entry.position}</td>
                        <td>{entry.phone ?? '—'}</td>
                        <td>{entry.email ?? '—'}</td>
                        <td>{formatDate(entry.enqueuedAt)}</td>
                        <td>{formatDate(entry.scheduledFor)}</td>
                        <td className={styles.actionsCell}>
                          {entry.appJobId && (
                            <button
                              type="button"
                              className={styles.btn}
                              onClick={() => navigate(`/jobs/${entry.appJobId}`)}
                            >
                              Open
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.dangerBtn}
                            onClick={() => handleDeleteQueueEntry(entry.queueJobId)}
                            disabled={deletingQueueJobId === entry.queueJobId}
                          >
                            {deletingQueueJobId === entry.queueJobId ? 'Deleting…' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className={styles.section}>
              {jobs.length === 0 ? (
                <div className={styles.empty}>No jobs</div>
              ) : (
                <>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Step</th>
                        <th>Proxy</th>
                        <th>Created</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((job) => (
                        <tr key={job.id}>
                          <td className={styles.mono}>{shortId(job.id)}</td>
                          <td>{job.phone ?? '—'}</td>
                          <td>{job.email ?? '—'}</td>
                          <td>
                            <span className={styles[`status_${job.status}`] ?? styles.status}>
                              {job.status}
                            </span>
                          </td>
                          <td>{job.currentStep ?? '—'}</td>
                          <td className={styles.proxy}>{job.proxy ?? '—'}</td>
                          <td>{formatDate(job.createdAt)}</td>
                          <td className={styles.actionsCell}>
                            <button
                              type="button"
                              className={styles.btn}
                              onClick={() => navigate(`/jobs/${job.id}`)}
                            >
                              Open
                            </button>
                            {job.status === 'queued' && (
                              <button
                                type="button"
                                className={styles.dangerBtn}
                                onClick={() => handleDeleteQueuedJob(job.id)}
                                disabled={deletingAppJobId === job.id}
                              >
                                {deletingAppJobId === job.id ? 'Deleting…' : 'Delete'}
                              </button>
                            )}
                            {(job.status === 'running' || job.status === 'cancelling') && (
                              <button
                                type="button"
                                className={styles.dangerBtn}
                                onClick={() => handleCancelJob(job.id)}
                                disabled={cancellingJobId === job.id || job.status === 'cancelling'}
                              >
                                {cancellingJobId === job.id || job.status === 'cancelling' ? 'Cancelling…' : 'Cancel'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {totalPages > 1 && (
                    <div className={styles.pagination}>
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage((current) => current - 1)}
                      >
                        ←
                      </button>
                      <span>
                        {page} / {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={page >= totalPages}
                        onClick={() => setPage((current) => current + 1)}
                      >
                        →
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

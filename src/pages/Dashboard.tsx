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

interface LeadMetrics {
  totalLeads: number;
  completed: number;
  failed: number;
  dryRunCompleted: number;
  inProgress: number;
  restartSessions: number;
  jobsWithMultipleRuns: number;
}

interface LeadStatsResponse {
  ok: boolean;
  timezoneNote?: string;
  today: LeadMetrics & { date: string };
  week: LeadMetrics & { from: string; to: string };
  selectedDay: { date: string; metrics: LeadMetrics } | null;
}

const STATUS_OPTIONS = ['', 'queued', 'running', 'cancelling', 'cancelled', 'completed', 'failed', 'validation_failed', 'dry_run_completed'];

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
  const [statsDate, setStatsDate] = useState('');
  const [leadStats, setLeadStats] = useState<LeadStatsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    params.set('page', String(page));
    params.set('limit', '20');

    const statsQs = statsDate.trim() ? `?date=${encodeURIComponent(statsDate.trim())}` : '';

    Promise.allSettled([
      api<JobsResponse>(`/admin/jobs?${params}`),
      api<QueueResponse>('/admin/queue?limit=50'),
      api<LeadStatsResponse>(`/admin/jobs/stats${statsQs}`),
    ])
      .then(([jobsResult, queueResult, statsResult]) => {
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

        if (statsResult.status === 'fulfilled') {
          setLeadStats(statsResult.value);
        } else {
          errors.push(statsResult.reason instanceof Error ? statsResult.reason.message : 'Stats load failed');
          setLeadStats(null);
        }

        setError(errors.length > 0 ? errors.join(' | ') : null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [statusFilter, page, refreshKey, statsDate]);

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

  const renderMetricCells = (m: LeadMetrics) => (
    <>
      <div className={`${styles.statCell} ${styles.statCellHighlight}`}>
        <span className={styles.statCellLabel}>Всего лидов</span>
        <span className={styles.statCellValue}>{m.totalLeads}</span>
      </div>
      <div className={`${styles.statCell} ${styles.statCellSuccess}`}>
        <span className={styles.statCellLabel}>Успешно</span>
        <span className={styles.statCellValue}>{m.completed}</span>
      </div>
      <div className={`${styles.statCell} ${styles.statCellDanger}`}>
        <span className={styles.statCellLabel}>Неуспешно</span>
        <span className={styles.statCellValue}>{m.failed}</span>
      </div>
      <div className={`${styles.statCell} ${styles.statCellMuted}`}>
        <span className={styles.statCellLabel}>Перезапусков сессий</span>
        <span className={styles.statCellValue}>{m.restartSessions}</span>
      </div>
      <div className={`${styles.statCell} ${styles.statCellMuted}`}>
        <span className={styles.statCellLabel}>Лидов с 2+ сессиями</span>
        <span className={styles.statCellValue}>{m.jobsWithMultipleRuns}</span>
      </div>
      <div className={`${styles.statCell} ${styles.statCellMuted}`}>
        <span className={styles.statCellLabel}>В процессе / очередь</span>
        <span className={styles.statCellValue}>{m.inProgress}</span>
      </div>
      <div className={`${styles.statCell} ${styles.statCellMuted}`}>
        <span className={styles.statCellLabel}>Dry-run завершён</span>
        <span className={styles.statCellValue}>{m.dryRunCompleted}</span>
      </div>
    </>
  );

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <h1 className={styles.title}>Bot Credit</h1>
        <nav className={styles.nav}>
          <Link to="/dashboard" className={styles.navActive}>Jobs</Link>
          <Link to="/proxies" className={styles.navLink}>Proxies</Link>
          <Link to="/emails" className={styles.navLink}>Emails</Link>
        </nav>
        <button type="button" onClick={logout} className={styles.logout}>
          Logout
        </button>
      </header>

      <main className={styles.main}>
        <section className={styles.statsSection} aria-labelledby="lead-stats-heading">
          <h2 id="lead-stats-heading" className={styles.statsSectionTitle}>
            Статистика лидов
          </h2>
          {leadStats?.timezoneNote && (
            <p className={styles.statsTimezone}>{leadStats.timezoneNote}</p>
          )}
          <div className={styles.statsDateBar}>
            <span className={styles.statsDateLabel}>Произвольный день</span>
            <input
              type="date"
              className={styles.statsDateInput}
              value={statsDate}
              onChange={(e) => setStatsDate(e.target.value)}
              aria-label="Выбор даты для статистики"
            />
            {statsDate ? (
              <button type="button" className={styles.btn} onClick={() => setStatsDate('')}>
                Сбросить
              </button>
            ) : null}
            <p className={styles.statsDateHint}>
              Считаем по дате создания заявки (Job). «Перезапуски» — дополнительные браузерные сессии (Run) после
              ротации прокси и т.п.; «Лидов с 2+ сессиями» — сколько заявок имело больше одного Run.
            </p>
          </div>
          {leadStats ? (
            <>
              <div className={styles.statsRow}>
                <div className={styles.statsPeriod}>
                  <h3 className={styles.statsPeriodHead}>Сегодня ({leadStats.today.date})</h3>
                  <div className={styles.statsGrid}>{renderMetricCells(leadStats.today)}</div>
                </div>
                <div className={styles.statsPeriod}>
                  <h3 className={styles.statsPeriodHead}>
                    7 дней ({leadStats.week.from} — {leadStats.week.to})
                  </h3>
                  <div className={styles.statsGrid}>{renderMetricCells(leadStats.week)}</div>
                </div>
              </div>
              {statsDate.trim() && leadStats.selectedDay ? (
                <div className={styles.statsRow}>
                  <div className={styles.statsPeriod} style={{ maxWidth: '100%' }}>
                    <h3 className={styles.statsPeriodHead}>
                      Выбранный день ({leadStats.selectedDay.date})
                    </h3>
                    <div className={styles.statsGrid}>{renderMetricCells(leadStats.selectedDay.metrics)}</div>
                  </div>
                </div>
              ) : null}
            </>
          ) : loading ? (
            <p className={styles.statsTimezone}>Загрузка статистики…</p>
          ) : null}
        </section>

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

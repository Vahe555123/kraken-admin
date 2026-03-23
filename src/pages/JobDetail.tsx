import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { logout } from '../App';
import { api } from '../api';
import { ScreenshotImage } from '../components/ScreenshotImage';
import { StructuredPayload } from '../components/StructuredPayload';
import { VideoArtifact } from '../components/VideoArtifact';
import styles from './JobDetail.module.css';

interface RunArtifact {
  id: string;
  type: string;
  path: string;
  step: number | null;
  createdAt: string;
}

interface JobRun {
  id: string;
  runId: string;
  status: string;
  currentStep: number | null;
  errorMessage: string | null;
  screenshots: string[];
  durationMs: number | null;
  startedAt: string;
  finishedAt: string | null;
  resultJson: unknown;
  artifacts: RunArtifact[];
}

interface JobDetailData {
  ok: boolean;
  settings: {
    videoEnabled: boolean;
  };
  job: {
    id: string;
    status: string;
    currentStep: number | null;
    errorMessage: string | null;
    runId: string | null;
    proxy: string | null;
    createdAt: string;
    updatedAt: string;
    rawPayload: Record<string, unknown>;
    meta: unknown;
  };
  runs: JobRun[];
  lastResult: {
    success: boolean;
    step: number;
    message: string;
    errorMessage?: string;
    durationMs?: number;
    screenshots: string[];
    navigationUrls?: string[];
  } | null;
}

type Tab = 'overview' | 'data' | 'steps' | 'screenshots' | 'videos';

export function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<JobDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [editJson, setEditJson] = useState('');
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryModalOpen, setRetryModalOpen] = useState(false);
  const [deletingArtifactId, setDeletingArtifactId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);

    api<JobDetailData>(`/admin/jobs/${id}`)
      .then((response) => {
        if (cancelled) return;
        setData(response);
        setEditJson(JSON.stringify(response.job.rawPayload, null, 2));
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const payload = JSON.parse(editJson);
      await api(`/admin/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setData((prev) => (prev ? { ...prev, job: { ...prev.job, rawPayload: payload } } : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRetryConfirm = async () => {
    if (!id) return;
    setRetrying(true);
    try {
      await api(`/admin/jobs/${id}/retry`, { method: 'POST' });
      setRetryModalOpen(false);
      navigate('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Retry failed');
    } finally {
      setRetrying(false);
    }
  };

  const handleCancelJob = async () => {
    if (!id) return;
    if (!window.confirm('Cancel the current running session?')) return;
    setCancelling(true);
    try {
      await api(`/admin/jobs/${id}/cancel`, { method: 'POST' });
      setData((prev) => (
        prev
          ? {
              ...prev,
              job: {
                ...prev.job,
                status: 'cancelling',
                errorMessage: 'Cancellation requested by admin',
              },
            }
          : prev
      ));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setCancelling(false);
    }
  };

  const handleDeleteArtifact = async (artifactId: string) => {
    if (!window.confirm('Удалить видео?')) return;
    setDeletingArtifactId(artifactId);
    try {
      await api(`/admin/artifacts/${artifactId}`, { method: 'DELETE' });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          runs: prev.runs.map((run) => ({
            ...run,
            artifacts: run.artifacts.filter((artifact) => artifact.id !== artifactId),
          })),
        };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingArtifactId(null);
    }
  };

  const goToEditAndCloseModal = () => {
    setRetryModalOpen(false);
    setTab('data');
  };

  if (!id) return null;
  if (loading) return <div className={styles.center}>Загрузка...</div>;
  if (error || !data) return <div className={styles.error}>{error ?? 'Not found'}</div>;

  const { job, runs, lastResult, settings } = data;
  const lastRun = runs[0];
  const screenshots = lastResult?.screenshots ?? lastRun?.screenshots ?? [];
  const videoArtifacts = runs.flatMap((run) =>
    run.artifacts
      .filter((artifact) => artifact.type === 'video')
      .map((artifact) => ({
        ...artifact,
        runId: run.runId,
        runStatus: run.status,
      }))
  );
  const runStats = {
    total: runs.length,
    success: runs.filter((run) => run.status === 'completed' || run.status === 'dry_run_completed').length,
    failed: runs.filter((run) => run.status === 'failed').length,
    running: runs.filter((run) => run.status === 'running').length,
  };

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate('/dashboard')}>
          ← Назад
        </button>
        <h1 className={styles.title}>Заявка {job.id.slice(0, 8)}…</h1>
        <nav className={styles.nav}>
          <Link to="/dashboard" className={styles.navLink}>Заявки</Link>
          <Link to="/proxies" className={styles.navLink}>Прокси</Link>
        </nav>
        <button type="button" onClick={logout} className={styles.logout}>Logout</button>
      </header>

      <div className={styles.tabs}>
        {(['overview', 'data', 'steps', 'screenshots', 'videos'] as const).map((currentTab) => (
          <button
            key={currentTab}
            type="button"
            className={tab === currentTab ? styles.tabActive : styles.tab}
            onClick={() => setTab(currentTab)}
          >
            {currentTab === 'overview' && 'Обзор'}
            {currentTab === 'data' && 'Данные'}
            {currentTab === 'steps' && 'Шаги'}
            {currentTab === 'screenshots' && `Скрины (${screenshots.length})`}
            {currentTab === 'videos' && `Видео (${videoArtifacts.length})`}
          </button>
        ))}
      </div>

      <main className={styles.main}>
        {tab === 'overview' && (
          <div className={styles.overview}>
            <div className={styles.overviewGrid}>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Статус</span>
                <span className={`${styles.statusBadge} ${styles[`status_${job.status}`] ?? ''}`}>
                  {job.status}
                </span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Текущий шаг</span>
                <span className={styles.cardValue}>{job.currentStep ?? '—'}</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Создан</span>
                <span className={styles.cardValue}>{new Date(job.createdAt).toLocaleString('ru-RU')}</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Обновлён</span>
                <span className={styles.cardValue}>{new Date(job.updatedAt).toLocaleString('ru-RU')}</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Видео</span>
                <span className={styles.cardValue}>
                  {settings.videoEnabled ? `Включено (${videoArtifacts.length})` : 'Выключено'}
                </span>
              </div>
              <div className={styles.card} style={{ gridColumn: '1 / -1' }}>
                <span className={styles.cardLabel}>Прокси</span>
                <span className={styles.cardValue}>{job.proxy ?? '—'}</span>
              </div>
            </div>

            {job.errorMessage && (
              <div className={styles.errorCard}>
                <span className={styles.errorLabel}>Ошибка</span>
                <p className={styles.errorText}>{job.errorMessage}</p>
              </div>
            )}

            <div className={styles.historyCard}>
              <h3 className={styles.historyTitle}>История запусков</h3>
              <div className={styles.historyStats}>
                <div className={styles.statItem}>
                  <span className={styles.statNumber}>{runStats.total}</span>
                  <span className={styles.statLabel}>всего</span>
                </div>
                <div className={`${styles.statItem} ${styles.statSuccess}`}>
                  <span className={styles.statNumber}>{runStats.success}</span>
                  <span className={styles.statLabel}>успешно</span>
                </div>
                <div className={`${styles.statItem} ${styles.statFailed}`}>
                  <span className={styles.statNumber}>{runStats.failed}</span>
                  <span className={styles.statLabel}>ошибок</span>
                </div>
              </div>
              {runs.length > 0 && (
                <ul className={styles.runList}>
                  {runs.map((run) => (
                    <li key={run.id} className={styles.runItem}>
                      <span
                        className={`${styles.runStatus} ${
                          run.status === 'completed' || run.status === 'dry_run_completed'
                            ? styles.runOk
                            : run.status === 'failed'
                              ? styles.runFail
                              : ''
                        }`}
                      >
                        {run.status === 'completed' || run.status === 'dry_run_completed'
                          ? '✓'
                          : run.status === 'failed'
                            ? '✗'
                            : '○'}
                      </span>
                      <span className={styles.runMeta}>
                        {new Date(run.startedAt).toLocaleString('ru-RU')}
                        {run.durationMs != null && ` · ${(run.durationMs / 1000).toFixed(0)}с`}
                      </span>
                      {run.errorMessage && <span className={styles.runErr}>{run.errorMessage}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={styles.actions}>
              {(job.status === 'running' || job.status === 'cancelling') && (
                <button
                  type="button"
                  className={styles.btnStopJob}
                  onClick={handleCancelJob}
                  disabled={cancelling || job.status === 'cancelling'}
                >
                  {cancelling || job.status === 'cancelling' ? 'Stopping…' : 'Stop current session'}
                </button>
              )}
              <button
                type="button"
                className={styles.btnRetry}
                onClick={() => setRetryModalOpen(true)}
              >
                Перезапустить задачу
              </button>
            </div>
          </div>
        )}

        {retryModalOpen && (
          <div className={styles.modalOverlay} onClick={() => setRetryModalOpen(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>Перезапуск задачи</h3>
              <p className={styles.modalText}>
                Перед перезапуском вы можете отредактировать данные заявки.
              </p>
              <button
                type="button"
                className={styles.btnEdit}
                onClick={goToEditAndCloseModal}
              >
                Редактировать данные
              </button>
              <div className={styles.modalDivider} />
              <div className={styles.modalHistory}>
                <strong>История:</strong> запусков {runStats.total}, успешных {runStats.success}, с ошибками {runStats.failed}
              </div>
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.btnCancel}
                  onClick={() => setRetryModalOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className={styles.btnConfirmRetry}
                  onClick={handleRetryConfirm}
                  disabled={retrying}
                >
                  {retrying ? 'Перезапуск…' : 'Перезапустить'}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'data' && (
          <div className={styles.dataPanel}>
            <div className={styles.dataSections}>
              {job.rawPayload && <StructuredPayload payload={job.rawPayload} />}
            </div>
            <div className={styles.jsonSection}>
              <div className={styles.dataToolbar}>
                <span>Редактирование JSON</span>
                <button
                  type="button"
                  className={styles.btnSave}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Сохранение…' : 'Сохранить'}
                </button>
              </div>
              <textarea
                className={styles.jsonEditor}
                value={editJson}
                onChange={(e) => setEditJson(e.target.value)}
                spellCheck={false}
              />
            </div>
          </div>
        )}

        {tab === 'steps' && (
          <div className={styles.steps}>
            {lastRun ? (
              <div className={styles.stepInfo}>
                <p><strong>Шаг:</strong> {lastRun.currentStep ?? '—'}</p>
                <p><strong>Длительность:</strong> {lastRun.durationMs != null ? `${(lastRun.durationMs / 1000).toFixed(1)} с` : '—'}</p>
                <p><strong>Начало:</strong> {new Date(lastRun.startedAt).toLocaleString()}</p>
                <p><strong>Конец:</strong> {lastRun.finishedAt ? new Date(lastRun.finishedAt).toLocaleString() : '—'}</p>
              </div>
            ) : (
              <p>Нет данных о шагах</p>
            )}
          </div>
        )}

        {tab === 'screenshots' && (
          <div className={styles.screenshots}>
            {screenshots.length === 0 ? (
              <p>Нет скриншотов</p>
            ) : (
              <div className={styles.screenshotGrid}>
                {screenshots.map((_, idx) => (
                  lastRun ? (
                    <div key={idx} className={styles.screenshotCard}>
                      <ScreenshotImage runId={lastRun.runId} index={idx} />
                      <span className={styles.screenshotLabel}>#{idx + 1}</span>
                    </div>
                  ) : null
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'videos' && (
          <div className={styles.screenshots}>
            {!settings.videoEnabled ? (
              <p>Запись видео в боте выключена.</p>
            ) : videoArtifacts.length === 0 ? (
              <p>Видео пока нет.</p>
            ) : (
              <div className={styles.videoGrid}>
                {videoArtifacts.map((artifact) => (
                  <div key={artifact.id} className={styles.videoCard}>
                    <VideoArtifact artifactId={artifact.id} />
                    <div className={styles.videoMeta}>
                      <span className={styles.screenshotLabel}>
                        Run {artifact.runId.slice(0, 8)}… · {artifact.runStatus}
                      </span>
                      <button
                        type="button"
                        className={styles.btnDeleteArtifact}
                        onClick={() => handleDeleteArtifact(artifact.id)}
                        disabled={deletingArtifactId === artifact.id}
                      >
                        {deletingArtifactId === artifact.id ? 'Удаление…' : 'Удалить'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

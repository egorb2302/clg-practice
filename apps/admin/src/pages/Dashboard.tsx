import { Link } from "react-router";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorBox, Loading, PageHead, useLoad } from "../ui";

type Count = { total: number };

export function Dashboard() {
  const { caps, session } = useAuth();
  const counts = useLoad(async (signal) => {
    if (!caps.leadsRead) return null;
    const get = (q: string) => api<Count>(`/admin/leads?${q}`, { signal }).then((r) => r.total);
    const [fresh, work, offer, unassigned] = await Promise.all([
      get("status=new"),
      get("status=in_progress"),
      get("status=offer_agreed"),
      get("assignee=none&status=new"),
    ]);
    return { fresh, work, offer, unassigned };
  }, [caps.leadsRead]);
  const jobs = useLoad(
    async (signal) => (caps.admin ? api<{ items: unknown[] }>("/admin/jobs?status=failed", { signal }).then((r) => r.items.length) : 0),
    [caps.admin],
  );

  return (
    <>
      <PageHead title={`Здравствуйте${session?.user.name ? `, ${session.user.name}` : ""}`} />
      {counts.loading && <Loading />}
      <ErrorBox error={counts.error} onRetry={counts.reload} />
      {counts.data && (
        <div className="stats">
          <Link className="stat" to="/leads?status=new">
            <b>{counts.data.fresh}</b>
            <span>Новые заявки</span>
          </Link>
          <Link className="stat" to="/leads?status=new&assignee=none">
            <b>{counts.data.unassigned}</b>
            <span>Без ответственного</span>
          </Link>
          <Link className="stat" to="/leads?status=in_progress">
            <b>{counts.data.work}</b>
            <span>В работе</span>
          </Link>
          <Link className="stat" to="/leads?status=offer_agreed">
            <b>{counts.data.offer}</b>
            <span>Предложение согласовано</span>
          </Link>
          {caps.admin && jobs.data !== undefined && (
            <Link className="stat" to="/jobs">
              <b>{jobs.data}</b>
              <span>Неотправленные уведомления</span>
            </Link>
          )}
        </div>
      )}
      {!caps.leadsRead && <p className="muted">Каталог и публикации доступны в меню слева</p>}
    </>
  );
}

import { redirect } from "next/navigation";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams
}: {
  searchParams?: Promise<{ days?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const resolvedSearchParams = await searchParams;
  const days = Math.max(1, Math.min(365, Number(resolvedSearchParams?.days || 7)));

  const supabase = await createServerSupabaseClient();

  // Get date range
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  // Total visits
  const { data: totalVisits, count: totalCount } = await supabase
    .from("visitor_events")
    .select("id", { count: "exact" })
    .gte("created_at", startDate.toISOString());

  // Unique visitors (by session)
  const { data: uniqueVisitors } = await supabase
    .from("visitor_events")
    .select("session_id")
    .gte("created_at", startDate.toISOString());

  const uniqueSessions = new Set(uniqueVisitors?.map((v) => v.session_id).filter(Boolean) || [])
    .size;

  // Top pages
  const { data: topPages } = await supabase
    .from("visitor_events")
    .select("path")
    .gte("created_at", startDate.toISOString());

  const pageCounts = (topPages || []).reduce(
    (acc, event) => {
      acc[event.path] = (acc[event.path] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const topPagesList = Object.entries(pageCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  // Device breakdown
  const { data: deviceData } = await supabase
    .from("visitor_events")
    .select("device_type")
    .gte("created_at", startDate.toISOString());

  const deviceCounts = (deviceData || []).reduce(
    (acc, event) => {
      const device = event.device_type || "unknown";
      acc[device] = (acc[device] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Browser breakdown
  const { data: browserData } = await supabase
    .from("visitor_events")
    .select("browser")
    .gte("created_at", startDate.toISOString());

  const browserCounts = (browserData || []).reduce(
    (acc, event) => {
      const browser = event.browser || "unknown";
      acc[browser] = (acc[browser] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Recent visits
  const { data: recentVisits } = await supabase
    .from("visitor_events")
    .select("path, referrer, device_type, browser, os, created_at, user_id")
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-sm text-slate-600">Visitor tracking and insights.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/analytics?days=7"
            className={`button-secondary-sm text-xs sm:text-sm ${days === 7 ? "button" : ""}`}
          >
            7 days
          </a>
          <a
            href="/analytics?days=30"
            className={`button-secondary-sm text-xs sm:text-sm ${days === 30 ? "button" : ""}`}
          >
            30 days
          </a>
          <a
            href="/analytics?days=90"
            className={`button-secondary-sm text-xs sm:text-sm ${days === 90 ? "button" : ""}`}
          >
            90 days
          </a>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-3 sm:p-4">
          <p className="text-xs text-slate-500">Total Visits</p>
          <p className="text-2xl font-semibold">{totalCount || 0}</p>
        </div>
        <div className="card p-3 sm:p-4">
          <p className="text-xs text-slate-500">Unique Visitors</p>
          <p className="text-2xl font-semibold">{uniqueSessions}</p>
        </div>
        <div className="card p-3 sm:p-4">
          <p className="text-xs text-slate-500">Time Period</p>
          <p className="text-2xl font-semibold">{days} days</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Pages */}
        <div className="card p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4">Top Pages</h2>
          {topPagesList.length > 0 ? (
            <div className="space-y-2">
              {topPagesList.map(({ path, count }) => (
                <div key={path} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700 truncate">{path}</span>
                  <span className="text-sm font-semibold text-slate-900">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No data available</p>
          )}
        </div>

        {/* Device Breakdown */}
        <div className="card p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4">Devices</h2>
          {Object.keys(deviceCounts).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(deviceCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([device, count]) => (
                  <div key={device} className="flex items-center justify-between">
                    <span className="text-sm text-slate-700 capitalize">{device}</span>
                    <span className="text-sm font-semibold text-slate-900">{count}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No data available</p>
          )}
        </div>

        {/* Browser Breakdown */}
        <div className="card p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4">Browsers</h2>
          {Object.keys(browserCounts).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(browserCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([browser, count]) => (
                  <div key={browser} className="flex items-center justify-between">
                    <span className="text-sm text-slate-700 capitalize">{browser}</span>
                    <span className="text-sm font-semibold text-slate-900">{count}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No data available</p>
          )}
        </div>
      </div>

      {/* Recent Visits */}
      <div className="card p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Visits</h2>
        {recentVisits && recentVisits.length > 0 ? (
          <>
            {/* Card view for small screens */}
            <div className="space-y-4 lg:hidden">
              {recentVisits.map((visit) => (
                <div
                  key={visit.created_at}
                  className="border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
                >
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Time</p>
                    <p className="text-sm font-medium text-slate-900">{formatDate(visit.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Path</p>
                    <p className="text-sm font-medium text-slate-900 break-words">{visit.path}</p>
                  </div>
                  {visit.referrer && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Referrer</p>
                      <p className="text-xs text-slate-600 break-words">{visit.referrer}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Device</p>
                      <p className="font-medium text-slate-900 capitalize">{visit.device_type || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Browser</p>
                      <p className="font-medium text-slate-900 capitalize">{visit.browser || "-"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">User</p>
                    <p className="text-sm font-medium text-slate-900">
                      {visit.user_id ? "✓ Logged in" : "Guest"}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Table view for large screens */}
            <div className="hidden lg:block table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Path</th>
                    <th>Referrer</th>
                    <th>Device</th>
                    <th>Browser</th>
                    <th>User</th>
                  </tr>
                </thead>
                <tbody>
                  {recentVisits.map((visit) => (
                    <tr key={visit.created_at}>
                      <td className="text-xs text-slate-600">
                        {formatDate(visit.created_at)}
                      </td>
                      <td className="text-sm font-medium">{visit.path}</td>
                      <td className="text-xs text-slate-500 truncate max-w-xs">
                        {visit.referrer || "-"}
                      </td>
                      <td className="text-xs text-slate-600 capitalize">
                        {visit.device_type || "-"}
                      </td>
                      <td className="text-xs text-slate-600 capitalize">
                        {visit.browser || "-"}
                      </td>
                      <td className="text-xs text-slate-600">
                        {visit.user_id ? "✓ Logged in" : "Guest"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">No visits recorded yet</p>
        )}
      </div>
    </div>
  );
}

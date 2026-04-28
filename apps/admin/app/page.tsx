"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "../components/RequireAuth";
import { api } from "../lib/api";

export default function Home() {
  const [data, setData] = useState<any>();
  useEffect(() => { api("/admin/overview").then(setData).catch(console.error); }, []);
  return (
    <RequireAuth>
      <div className="topbar"><h1>Overview</h1><span className="muted">Internal control plane</span></div>
      <div className="grid four">
        <div className="grid three">
          {["singleKeys", "enterpriseKeys", "activations", "templates"].map((key) => (
            <div className="card" key={key}><div className="muted">{key}</div><h2>{data?.[key] ?? "-"}</h2></div>
          ))}
        </div>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <h2>Recent audit</h2>
        <table className="table"><tbody>{data?.audits?.map((a: any) => <tr key={a.id}><td>{a.action}</td><td>{a.targetType}</td><td>{new Date(a.createdAt).toLocaleString()}</td></tr>)}</tbody></table>
      </div>
    </RequireAuth>
  );
}

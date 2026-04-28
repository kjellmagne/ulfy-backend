"use client";

import { ReactNode, useEffect, useState } from "react";
import { getToken } from "../lib/api";
import { appPath } from "../lib/base-path";

export function RequireAuth({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!getToken()) window.location.href = appPath("/login");
    else setReady(true);
  }, []);
  if (!ready) return <div className="panel">Checking session...</div>;
  return children;
}

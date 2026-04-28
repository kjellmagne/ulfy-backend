"use client";

import { ReactNode, useEffect, useState } from "react";
import { getToken } from "../lib/api";
import { appPath } from "../lib/base-path";
import { LoadingPanel } from "./AdminUI";

export function RequireAuth({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!getToken()) window.location.href = appPath("/login");
    else setReady(true);
  }, []);
  if (!ready) return <LoadingPanel label="Checking session" />;
  return children;
}

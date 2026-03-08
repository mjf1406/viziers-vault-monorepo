import { createAuthClient } from "better-auth/react";
import { getApiBase } from "./api";

const base = getApiBase();
const authBaseUrl =
  base === "/api"
    ? undefined
    : `${base.replace(/\/$/, "")}/api`;

export const authClient = createAuthClient({
  baseURL: authBaseUrl,
});

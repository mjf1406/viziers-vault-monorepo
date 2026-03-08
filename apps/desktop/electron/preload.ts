import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("__APP_RUNTIME__", {
  apiBaseUrl: "http://127.0.0.1:3099",
  deploymentMode: "desktop",
});

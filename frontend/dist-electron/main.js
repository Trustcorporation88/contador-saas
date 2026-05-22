import { app as n, BrowserWindow as s, shell as h } from "electron";
import o from "node:path";
import { fileURLToPath as p } from "node:url";
const c = p(import.meta.url), l = o.dirname(c), a = o.join(l, ".."), r = o.join(a, "dist"), i = process.env.VITE_DEV_SERVER_URL;
process.env.VITE_PUBLIC = i ? o.join(a, "public") : r;
let e = null;
function d() {
  e = new s({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: "O Contador",
    show: !1,
    // prevents flash of unstyled content
    webPreferences: {
      preload: o.join(l, "preload.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1,
      sandbox: !1
    }
  }), e.once("ready-to-show", () => e == null ? void 0 : e.show()), e.webContents.setWindowOpenHandler(({ url: t }) => ((t.startsWith("http://") || t.startsWith("https://")) && h.openExternal(t), { action: "deny" })), i ? (e.loadURL(i), e.webContents.openDevTools()) : e.loadFile(o.join(r, "index.html")), e.on("closed", () => {
    e = null;
  });
}
n.whenReady().then(d);
n.on("window-all-closed", () => {
  process.platform !== "darwin" && (n.quit(), e = null);
});
n.on("activate", () => {
  s.getAllWindows().length === 0 && d();
});
//# sourceMappingURL=main.js.map

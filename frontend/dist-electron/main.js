import { app as o, BrowserWindow as s, shell as h } from "electron";
import n from "node:path";
import { fileURLToPath as p } from "node:url";
const c = p(import.meta.url), l = n.dirname(c), a = n.join(l, ".."), r = n.join(a, "dist"), i = process.env.VITE_DEV_SERVER_URL;
process.env.VITE_PUBLIC = i ? n.join(a, "public") : r;
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
      preload: n.join(l, "preload.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1,
      sandbox: !1
    }
  }), e.once("ready-to-show", () => e?.show()), e.webContents.setWindowOpenHandler(({ url: t }) => ((t.startsWith("http://") || t.startsWith("https://")) && h.openExternal(t), { action: "deny" })), i ? (e.loadURL(i), e.webContents.openDevTools()) : e.loadFile(n.join(r, "index.html")), e.on("closed", () => {
    e = null;
  });
}
o.whenReady().then(d);
o.on("window-all-closed", () => {
  process.platform !== "darwin" && (o.quit(), e = null);
});
o.on("activate", () => {
  s.getAllWindows().length === 0 && d();
});
//# sourceMappingURL=main.js.map

import { BrowserWindow as e, app as t, shell as n } from "electron";
import r from "node:path";
import { fileURLToPath as i } from "node:url";
//#region electron/main.ts
var a = i(import.meta.url), o = r.dirname(a), s = r.join(o, ".."), c = r.join(s, "dist"), l = process.env.VITE_DEV_SERVER_URL;
process.env.VITE_PUBLIC = l ? r.join(s, "public") : c;
var u = null;
function d() {
	u = new e({
		width: 1280,
		height: 800,
		minWidth: 1024,
		minHeight: 640,
		title: "O Contador",
		show: !1,
		webPreferences: {
			preload: r.join(o, "preload.mjs"),
			contextIsolation: !0,
			nodeIntegration: !1,
			sandbox: !1
		}
	}), u.once("ready-to-show", () => u?.show()), u.webContents.setWindowOpenHandler(({ url: e }) => ((e.startsWith("http://") || e.startsWith("https://")) && n.openExternal(e), { action: "deny" })), l ? (u.loadURL(l), u.webContents.openDevTools()) : u.loadFile(r.join(c, "index.html")), u.on("closed", () => {
		u = null;
	});
}
t.whenReady().then(d), t.on("window-all-closed", () => {
	process.platform !== "darwin" && (t.quit(), u = null);
}), t.on("activate", () => {
	e.getAllWindows().length === 0 && d();
});
//#endregion

//# sourceMappingURL=main.js.map
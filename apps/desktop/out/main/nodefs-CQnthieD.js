import { u as ur, C, a as u } from "./main.js";
import * as s from "fs";
import * as path from "path";
u();
var m = class extends ur {
  constructor(t) {
    super(t), this.rootDir = path.resolve(t), s.existsSync(path.join(this.rootDir)) || s.mkdirSync(this.rootDir);
  }
  async init(t, e) {
    return this.pg = t, { emscriptenOpts: { ...e, preRun: [...e.preRun || [], (r) => {
      let c = r.FS.filesystems.NODEFS;
      r.FS.mkdir(C), r.FS.mount(c, { root: this.rootDir }, C);
    }] } };
  }
  async closeFs() {
    this.pg.Module.FS.quit();
  }
};
export {
  m as NodeFS
};

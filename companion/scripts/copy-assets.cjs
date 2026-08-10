const fs = require("node:fs");
const path = require("node:path");
const destination = path.join("dist", "cli");
fs.mkdirSync(destination, { recursive: true });
fs.copyFileSync(
  path.join("src", "cli", "hook-forwarder.cjs"),
  path.join(destination, "hook-forwarder.cjs")
);

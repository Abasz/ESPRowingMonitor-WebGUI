#!/usr/bin/env node
"use strict";

import { writeFile } from "fs/promises";

writeFile(
    "./src/version.ts",
    `export const versionInfo = {
    timeStamp: "${new Date().toJSON()}",
};
`,
    "utf-8",
);

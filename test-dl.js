const { DownloadCommandHandler } = require('./dist/commands/downloadCommandHandler');
const path = require('path');
const handler = new DownloadCommandHandler();
const result = handler.handleCommand([], '/home/openclaw/opencode/remoat/nodemcu-vscode');
console.log(JSON.stringify(result, null, 2));

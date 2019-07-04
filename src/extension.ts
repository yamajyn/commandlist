'use strict';

import * as vscode from 'vscode';
import { CommandsProvider } from './commands';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const commandsProvider = new CommandsProvider(context.globalStoragePath, context.storagePath);
	
	vscode.window.registerTreeDataProvider('commandLists', commandsProvider);
}

// this method is called when your extension is deactivated
export function deactivate() {}

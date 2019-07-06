'use strict';

import * as vscode from 'vscode';
import { CommandExplorer } from './commandExplorer';

// this method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {

	if(context.storagePath){
		new CommandExplorer('workSpaceCommandExplorer', context.storagePath);
	}
	new CommandExplorer('globalCommandExplorer', context.globalStoragePath);
}

// this method is called when your extension is deactivated
export function deactivate() {}

'use strict';

import * as vscode from 'vscode';
import { CommandExplorer } from './commandExplorer';
import { CommandExecuter } from './commandExecuter';


// this method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {

	if(context.storagePath){
		new CommandExplorer('workSpaceCommandExplorer', context.storagePath);
		new CommandExecuter('workSpaceCommandExecuter', context);
	}
	new CommandExplorer('globalCommandExplorer', context.globalStoragePath);
	new CommandExecuter('globalCommandExecuter', context);

	
}

// this method is called when your extension is deactivated
export function deactivate() {}

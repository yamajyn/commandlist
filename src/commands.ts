import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class CommandsProvider implements vscode.TreeDataProvider<Command> {

	private _onDidChangeTreeData: vscode.EventEmitter<Command | undefined> = new vscode.EventEmitter<Command | undefined>();
	readonly onDidChangeTreeData: vscode.Event<Command | undefined> = this._onDidChangeTreeData.event;

	constructor(private globalStragePath: string,private storagePath: string | undefined) {
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: Command): vscode.TreeItem {
		return element;
	}

	getChildren(element?: Command): Thenable<Command[]> {
		if (!this.storagePath || !this.pathExists(path.join(this.storagePath, 'commands.json'))) {
			vscode.window.showInformationMessage('No command in empty workspace');
			// return Promise.resolve([]);
		}

		if (element) {
			return Promise.resolve(this.getCommands(path.join(this.globalStragePath,'commands.json')));
		} else {
			const jsonPath = path.join(this.globalStragePath,'commands.json');
			if (this.pathExists(jsonPath)) {
				return Promise.resolve(this.getCommands(jsonPath));
			} else {
				vscode.window.showInformationMessage('you have no command data.');
				return Promise.resolve([]);
			}
		}

	}

	/**
	 * Given the path to commands.json, read all its commands
	 */
	private getCommands(jsonPath: string): Command[] {
		if (this.pathExists(jsonPath)) {
			const commands = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

			const toCommand = (label: string, script: string): Command => {
				if (this.hasChildren(commands, label)) {
					return new Command(label, script, vscode.TreeItemCollapsibleState.Collapsed);
				} else {
					return new Command(label, script, vscode.TreeItemCollapsibleState.None, {
						command: 'execute',
						title: '',
						arguments: [script]
					});
				}
			};

			const coms = commands ? Object.keys(commands).map(label => toCommand(label, commands[label].command)) : [];
			return coms;
		} else {
			return [];
		}
	}

	private hasChildren(commands:any, label:string):boolean {
		return commands[label].commands !== undefined;
	}

	private pathExists(p: string): boolean {
		try {
			fs.accessSync(p);
		} catch (err) {
			return false;
		}

		return true;
	}
}

export class Command extends vscode.TreeItem {

	constructor(
		public readonly label: string,
		private subLabel: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
    super(label, collapsibleState);
	}

	get tooltip(): string {
		return `${this.label}-$ ${this.subLabel}`;
	}

	get description(): string {
		return this.subLabel;
	}

  // if you want to add stand out icon, you can comment in.
	// iconPath = {
	// 	light: path.join(__filename, '..', '..', 'resources','icon.svg'),
	// 	dark: path.join(__filename, '..', '..', 'resources','icon.svg')
	// };

	contextValue = 'command';

}

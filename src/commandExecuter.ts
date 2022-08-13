import * as vscode from 'vscode';
import * as fs from 'fs';
import { Entry } from './type/Entry';
import { Command } from './type/Command';

export class CommandExecuter {

  constructor(viewId: string, context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand(`${viewId}.execute`, (element: Entry) => this.executeCommand(element)));
    context.subscriptions.push(vscode.commands.registerCommand(`${viewId}.watch`, (element: Entry) => this.watchCommandTime(element)));
  }

  private async executeCommand(element: Entry, needsWatchTime: boolean = false) {
    const command: Command = JSON.parse(fs.readFileSync(element.uri.fsPath, 'utf8'));
    this.ensureTerminalExists();
    if (vscode.window.terminals.length === 1) {
      const terminal = vscode.window.terminals[0];
      terminal.show();
      console.log(`execute $ ${command.script}`);
      terminal.sendText(command.script ? command.script : '');
      if (needsWatchTime) { this.startWatch(element, command) }
      await this.progressBar(command);
    } else {
      let terminal = await this.selectTerminal()
      if (terminal) {
        terminal.show();
        console.log(`execute $ ${command.script}`);
        terminal.sendText(command.script ? command.script : '');
        if (needsWatchTime) { this.startWatch(element, command) }
        await this.progressBar(command);
      } else {
        console.error('Selected Terminal is not exist');
        vscode.window.showErrorMessage('Sorry, Unexpected error has occurred.');
      }
    }
  }

  private selectTerminal(): Thenable<vscode.Terminal | undefined> {
    interface TerminalQuickPickItem extends vscode.QuickPickItem {
      terminal: vscode.Terminal;
    }
    const terminals = <vscode.Terminal[]>(<any>vscode.window).terminals;
    const items: TerminalQuickPickItem[] = terminals.map(terminal => {
      return {
        label: `${terminal.name}`,
        terminal: terminal
      };
    });
    return vscode.window.showQuickPick(items).then(item => {
      return item ? item.terminal : undefined;
    });
  }

  private ensureTerminalExists(): void {
    if (vscode.window.terminals.length === 0) {
      vscode.window.createTerminal('Command List');
    }
  }

  private async watchCommandTime(element: Entry) {
    const value = await vscode.window.showInformationMessage(
      "[BETA] Stopwatch. Do you want to measure time? If recorded, a progress bar will appear next time.",
      "Start",
      "Cancel"
    );
    if (value === 'Start') {
      this.executeCommand(element, true);
    }
  }

  private startWatch = async (element: Entry, command: Command) => {
    let start = new Date();
    const value = await vscode.window.showInformationMessage(
      "[BETA] Stopwatch. Record the execution time",
      "Completed. Record time",
      "Cancel"
    );
    if (value === 'Completed. Record time') {
      let end = new Date();
      let time = (end.getTime() - start.getTime()) / 1000;
      console.log(time);
      command.time = time;
      await fs.writeFileSync(element.uri.fsPath, this.stringToUnit8Array(JSON.stringify(command)));
      await vscode.window.showInformationMessage(
        "Congratulations👏 The progress bar will appear next time🥳",
      );
    }
  }

  private stringToUnit8Array = (s: string): Uint8Array => {
    return Uint8Array.from(Buffer.from(s));
  }
  
  private progressBar = async (command?: Command) => {
    if (command?.time == null || command.time <= 0) return;
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "",
      cancellable: false
    }, async (progress) => {
      const refreshTime = 100; // ms
      const loopCount = command.time! * 1000 / refreshTime;
      for(var index=0; index<loopCount; index++) {
        let inc = 100 / loopCount;
        progress.report({ message: `[BETA] Stopwatch. ${command.label}`, increment: inc });
        await this.sleep(refreshTime);
      }
    })
  }

  private sleep = async (time: number): Promise<number> => {
    return new Promise<number>(resolve => {
      setTimeout(()=> {
        resolve(time);
      }, time);
    });
  };

}
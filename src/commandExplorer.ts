import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as rimraf from 'rimraf';
import * as uuid from 'uuid/v4';
import * as sanitizeFilename from 'sanitize-filename';
import { Entry } from './type/Entry';
import { Command } from './type/Command';

//#region Utilities

namespace _ {

  function handleResult<T>(resolve: (result: T) => void, reject: (error: Error) => void, error: Error | null | undefined, result: T): void {
    if (error) {
      reject(massageError(error));
    } else {
      resolve(result);
    }
  }

  function massageError(error: Error & { code?: string }): Error {
    if (error.code === 'ENOENT') {
      return vscode.FileSystemError.FileNotFound();
    }

    if (error.code === 'EISDIR') {
      return vscode.FileSystemError.FileIsADirectory();
    }

    if (error.code === 'EEXIST') {
      return vscode.FileSystemError.FileExists();
    }

    if (error.code === 'EPERM' || error.code === 'EACCESS') {
      return vscode.FileSystemError.NoPermissions();
    }

    return error;
  }

  export function checkCancellation(token: vscode.CancellationToken): void {
    if (token.isCancellationRequested) {
      throw new Error('Operation cancelled');
    }
  }

  export function normalizeNFC(items: string): string;
  export function normalizeNFC(items: string[]): string[];
  export function normalizeNFC(items: string | string[]): string | string[] {
    if (process.platform !== 'darwin') {
      return items;
    }

    if (Array.isArray(items)) {
      return items.map(item => item.normalize('NFC'));
    }

    return items.normalize('NFC');
  }

  export function readdir(path: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      fs.readdir(path, (error, children) => handleResult(resolve, reject, error, normalizeNFC(children)));
    });
  }

  export function stat(path: string): Promise<fs.Stats> {
    return new Promise<fs.Stats>((resolve, reject) => {
      fs.stat(path, (error, stat) => handleResult(resolve, reject, error, stat));
    });
  }

  export function readfile(path: string): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      fs.readFile(path, (error, buffer) => handleResult(resolve, reject, error, buffer));
    });
  }

  export function writefile(path: string, content: Buffer): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      fs.writeFile(path, content, error => handleResult(resolve, reject, error, void 0));
    });
  }

  export function exists(path: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      fs.exists(path, exists => handleResult(resolve, reject, null, exists));
    });
  }

  export function rmrf(path: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      rimraf(path, error => handleResult(resolve, reject, error, void 0));
    });
  }

  export function mkdir(path: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      mkdirp(path, error => handleResult(resolve, reject, error, void 0));
    });
  }

  export function rename(oldPath: string, newPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      fs.rename(oldPath, newPath, error => handleResult(resolve, reject, error, void 0));
    });
  }

  export function unlink(path: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      fs.unlink(path, error => handleResult(resolve, reject, error, void 0));
    });
  }
}

export class FileStat implements vscode.FileStat {

  constructor(private fsStat: fs.Stats) { }

  get type(): vscode.FileType {
    return this.fsStat.isFile() ? vscode.FileType.File : this.fsStat.isDirectory() ? vscode.FileType.Directory : this.fsStat.isSymbolicLink() ? vscode.FileType.SymbolicLink : vscode.FileType.Unknown;
  }

  get isFile(): boolean | undefined {
    return this.fsStat.isFile();
  }

  get isDirectory(): boolean | undefined {
    return this.fsStat.isDirectory();
  }

  get isSymbolicLink(): boolean | undefined {
    return this.fsStat.isSymbolicLink();
  }

  get size(): number {
    return this.fsStat.size;
  }

  get ctime(): number {
    return this.fsStat.ctime.getTime();
  }

  get mtime(): number {
    return this.fsStat.mtime.getTime();
  }
}

//#endregion

export class FileSystemProvider implements vscode.TreeDataProvider<Entry>, vscode.FileSystemProvider {

  private _onDidChangeTreeData: vscode.EventEmitter<Entry | undefined> = new vscode.EventEmitter<Entry | undefined>();
  readonly onDidChangeTreeData: vscode.Event<Entry | undefined> = this._onDidChangeTreeData.event;
  
  private _onDidChangeFile: vscode.EventEmitter<vscode.FileChangeEvent[]>;

  private rootUri: vscode.Uri;

  private viewId: string;

  constructor(viewId:string, rootPath:string) {
    this._onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    this.rootUri = vscode.Uri.file(rootPath);
    this.viewId = viewId;
    this.watch(this.rootUri,{recursive:true, excludes: ['.json']});
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  get onDidChangeFile(): vscode.Event<vscode.FileChangeEvent[]> {
    return this._onDidChangeFile.event;
  }

  add(selected?: Entry){
    vscode.window.showInputBox({ 
      placeHolder: 'e.g: rm -rf COVID-19.virus',
      prompt: 'Enter a new command script'
    })
      .then(script => 
        vscode.window.showInputBox({
          placeHolder: 'e.g: 💊💊💊 Overcome COVID-19.virus 💊💊💊',
          prompt: 'Enter command label name',
          value: script,
          validateInput: this.validateLabelName
        })
          .then(label => { 
            const command: Command = {
              script: script,
              label: label
            };
            return command
          })
      )
      .then(command => {
        let fileName = command.label ? command.label : command.script ? command.script : 'no name';
        const sanitizedFilename = sanitizeFilename(fileName).slice(0, 250);
        if(selected){
          const filePath = selected.type === vscode.FileType.Directory ? `${selected.uri.fsPath}/${fileName}.json` : `${this.getDirectoryPath(selected.uri.fsPath)}/${sanitizedFilename}.json`;
          this._writeFile(filePath, this.stringToUnit8Array(JSON.stringify(command)),{ create: true, overwrite: true });
        }else{
          this._writeFile(`${this.rootUri.fsPath}/${fileName}.json`, this.stringToUnit8Array(JSON.stringify(command)),{ create: true, overwrite: true });
        }
      });
  }

  private validateLabelName(value: string): string | null {
    return value.length > 250 ? value : null
  }

  addFolder(selected?: Entry){
    vscode.window.showInputBox({ placeHolder: 'Enter a new group name' })
      .then(value => {
        if (value !== null && value !== undefined) {
          if(selected){
            const filePath = selected.type === vscode.FileType.Directory ? `${selected.uri.fsPath}/${value}` : `${this.getDirectoryPath(selected.uri.fsPath)}/${value}`;
            this.createDirectory(vscode.Uri.file(filePath));
          }else{
            this.createDirectory(vscode.Uri.file(`${this.rootUri.fsPath}/${value}`));
          }
        }
      });
  }

  edit(element?: Entry){
    if(element && element.type === vscode.FileType.File){
      const file: Command = JSON.parse(fs.readFileSync(element.uri.fsPath, 'utf8'));
      vscode.window.showInputBox({
        placeHolder: 'Edit command and Save',
        value:file.script ? file.script : ''
      }).then(async value => {
        if (value !== null && value !== undefined) {
          const data: Command = {
            script: value
          };
          const fileName = sanitizeFilename(value).slice(0, 250);
          const newUri = vscode.Uri.file(`${this.getDirectoryPath(element.uri.fsPath)}/${fileName}.json`);
          await this.delete(element.uri, { recursive: false });
          await this._writeFile(newUri.fsPath, this.stringToUnit8Array(JSON.stringify(data)),{ create: true, overwrite: true });
        }
      });
    }else if(element && element.type === vscode.FileType.Directory){
      vscode.window.showInputBox({ placeHolder: 'Edit Folder name', value: this.getFileName(element.uri.fsPath)})
      .then(value => {
        if (value !== null && value !== undefined) {
          const newPath = vscode.Uri.file(`${this.getDirectoryPath(element.uri.fsPath)}/${value}`);
          this.rename(element.uri, newPath, { overwrite: true });
        }
      });
    }
  }

  watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
    const watcher = fs.watch(uri.fsPath, { recursive: options.recursive }, async (event: string, filename: string | Buffer) => {
      const filepath = path.join(uri.fsPath, _.normalizeNFC(filename.toString()));

      this.refresh();

      this._onDidChangeFile.fire([{
        type: event === 'change' ? vscode.FileChangeType.Changed : await _.exists(filepath) ? vscode.FileChangeType.Created : vscode.FileChangeType.Deleted,
        uri: uri.with({ path: filepath })
      } as vscode.FileChangeEvent]);
    });

    return { dispose: () => watcher.close() };
  }

  stat(uri: vscode.Uri): Thenable<vscode.FileStat> {
    return this._stat(uri.fsPath);
  }

  async _stat(path: string): Promise<vscode.FileStat> {
    return new FileStat(await _.stat(path));
  }

  readDirectory(uri: vscode.Uri): Thenable<[string, vscode.FileType][]> {
    return this._readDirectory(uri);
  }

  async _readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    const children = await _.readdir(uri.fsPath);

    const result: [string, vscode.FileType][] = [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const stat = await this._stat(path.join(uri.fsPath, child));
      result.push([child, stat.type]);
    }

    return Promise.resolve(result);
  }

  createDirectory(uri: vscode.Uri): Thenable<void> {
    return _.mkdir(uri.fsPath);
  }

  readFile(uri: vscode.Uri): Promise<Uint8Array> {
    return _.readfile(uri.fsPath);
  }

  writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Thenable<void> {
    return this._writeFile(uri.fsPath, content, options);
  }

  async _writeFile(fsPath: string, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
    const exists = await _.exists(fsPath);
    if (!exists) {
      if (!options.create) {
        throw vscode.FileSystemError.FileNotFound();
      }

      await _.mkdir(path.dirname(fsPath));
    } else {
      if (!options.overwrite) {
        throw vscode.FileSystemError.FileExists();
      }
    }

    return _.writefile(fsPath, content as Buffer);
  }

  stringToUnit8Array(s:string): Uint8Array{
    return Uint8Array.from(Buffer.from(s));
  }

  delete(uri: vscode.Uri, options: { recursive: boolean; }): Thenable<void> {
    if (options.recursive) {
      return _.rmrf(uri.fsPath);
    }

    return _.unlink(uri.fsPath);
  }

  rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): Thenable<void> {
    return this._rename(oldUri, newUri, options);
  }

  async _rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): Promise<void> {
    const exists = await _.exists(newUri.fsPath);
    if (exists) {
      if (!options.overwrite) {
        throw vscode.FileSystemError.FileExists();
      } else {
        await _.rmrf(newUri.fsPath);
      }
    }

    const parentExists = await _.exists(path.dirname(newUri.fsPath));
    if (!parentExists) {
      await _.mkdir(path.dirname(newUri.fsPath));
    }

    return _.rename(oldUri.fsPath, newUri.fsPath);
  }

  // tree data provider

  async getChildren(element?: Entry): Promise<Entry[]> {

    let uri: vscode.Uri = element ? element.uri : this.rootUri;

    if (!element && !await _.exists(uri.fsPath)){
      this.createDirectory(this.rootUri);
      return [];
    }
    const children = await this.readDirectory(uri);
    children.sort((a, b) => {
      if (a[1] === b[1]) {
        return a[0].localeCompare(b[0]);
      }
      return a[1] === vscode.FileType.Directory ? -1 : 1;
    });
    return children
            .filter(([name, type]) => this.isJson(name) || type === vscode.FileType.Directory)
            .map(([name, type]) => ({ uri: vscode.Uri.file(path.join(uri.fsPath, name)), type }));
  }

  getTreeItem(element: Entry): vscode.TreeItem {
    const isDirectory = element.type === vscode.FileType.Directory;
    let label = this.getFileName(element.uri.fsPath);
    let tooltip = label;
    let time = '';
    if(!isDirectory){
      try{
        const command: Command = JSON.parse(fs.readFileSync(element.uri.fsPath, 'utf8'));
        if(command.script === undefined){
          throw new Error("unknown data");
        }
        label = command.label ? command.label : command.script;
        if(command.time) {
          time = `${command.time}s`;
        }
        
      } catch {
        label = '';
        time = 'unknown command';
      }
    }
    const treeItem = new vscode.TreeItem(label, isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
    if (element.type === vscode.FileType.File) {
      treeItem.command = { command: `${this.viewId}.edit`, title: "Edit", arguments: [element], };
      treeItem.contextValue = 'file';
      treeItem.description = time;
      treeItem.tooltip = tooltip
    }
    return treeItem;
  }

  isJson(path: string) : boolean {
    const index = path.lastIndexOf('.json');
    if(index === -1) {
      return false;
    }
    return (path.length - index) === 5;
  }

  getFileName(path: string): string {
    return path.slice(path.lastIndexOf('/') + 1);
  }

  getDirectoryPath(path: string): string {
    return path.slice(0, path.lastIndexOf('/'));
  }

  isExists(path: string): Promise<boolean> {
    return _.exists(path);
  }
}

export class CommandExplorer {

  private commandExplorer?: vscode.TreeView<Entry>;

  private selectedFile?: Entry;

  constructor(viewId: string, storagePath: string) {
    this.setupStorage(storagePath).then(() => {
      const treeDataProvider = new FileSystemProvider(viewId, storagePath);
      this.commandExplorer = vscode.window.createTreeView(viewId, { treeDataProvider });
      vscode.commands.registerCommand(`${viewId}.openFile`, (resource) => this.openResource(resource));
      this.commandExplorer.onDidChangeSelection(event => this.selectedFile = event.selection[0]);
      vscode.commands.registerCommand(`${viewId}.add`,() => treeDataProvider.add(this.selectedFile));
      vscode.commands.registerCommand(`${viewId}.addFolder`,() => treeDataProvider.addFolder(this.selectedFile));
      vscode.commands.registerCommand(`${viewId}.sync`,() => treeDataProvider.refresh());
      vscode.commands.registerCommand(`${viewId}.edit`,(element) => treeDataProvider.edit(element));
      vscode.commands.registerCommand(`${viewId}.delete`, (element: Entry) => treeDataProvider.delete(element.uri,{ recursive: true }));
    });
  }

  private async setupStorage(storagePath: string){
    const isExist = await _.exists(storagePath);
    if(!isExist){
      await _.mkdir(storagePath);
    }
    return;
  }

  private openResource(resource: vscode.Uri): void {
    vscode.window.showTextDocument(resource);
  }
}
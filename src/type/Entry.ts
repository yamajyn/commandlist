import * as vscode from 'vscode';

export interface Entry {
  uri: vscode.Uri;
  type: vscode.FileType;
}


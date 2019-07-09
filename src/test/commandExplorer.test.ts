import { CommandExplorer, FileSystemProvider } from "./../commandExplorer";
import * as assert from "assert";
import * as vscode from "vscode";
import { Command } from "../type/Command";

export const commandExplorerTest = () => {
  suite("FileSystemProvider　normal", () => {

    const provider = new FileSystemProvider("test", __dirname);
    test("getDirectoryPath", () => {
      assert.equal(__dirname, provider.getDirectoryPath(__filename));
    });

    const dir = vscode.Uri.file(__dirname + "/testdir");
    test("createDirectory", () => {
      provider.createDirectory(dir);
      provider.isExists(dir.fsPath).then(result => {
        assert.equal(true, result);
      });
    });

    const file = vscode.Uri.file(__dirname + "/testdir/test.json");
    const testJSON: Command = {
      script: "ls -a"
    };
    test("writeFile", () => {
      const content = provider.stringToUnit8Array(JSON.stringify(testJSON));
      assert.ok(provider.writeFile(file, content, { create: true, overwrite: true }));
    });

    test('isExists', () => {
      provider.isExists(file.fsPath).then(result => {
        assert.equal(true, result);
      });
    });

    test('readFile', () => {
      provider.readFile(file).then(result => {
        assert.equal(testJSON, result.toString());
      });
    });

    test('isJson', () => {
      assert.equal(true, provider.isJson(file.fsPath));
    });

    test('deleteFile', () => {
      provider.delete(dir, { recursive : true });
    });
  });
};

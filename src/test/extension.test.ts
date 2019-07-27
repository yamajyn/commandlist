import { CommandExplorer, FileSystemProvider } from "./../commandExplorer";
import * as assert from "assert";
import * as vscode from "vscode";
import { Command } from "../type/Command";

suite("FileSystemProvider　normal", () => {
  console.log("a");
  const provider = new FileSystemProvider("test", __dirname);
  test("getDirectoryPath", () => {
    assert.equal(__dirname, provider.getDirectoryPath(__filename));
    console.log("b");
  });

  const dir = vscode.Uri.file(__dirname + "/testdir");
  test("createDirectory", () => {
    return provider.createDirectory(dir).then(_ => {
      return provider.isExists(dir.fsPath);
    }).then(result => {
        assert.equal(true, result);
        console.log("c");
      });
    
  });

  const file = vscode.Uri.file(__dirname + "/testdir/test.json");
  const testJSON: Command = {
    script: 'ls -a'
  };
  test("writeFile", () => {
    const content = provider.stringToUnit8Array(JSON.stringify(testJSON));
    return provider.writeFile(file, content, { create: true, overwrite: true }).then(_ => {
      return provider.isExists(file.fsPath);
    }).then(result => {
      assert.equal(true, result);
      console.log("d");
    });
  });

  test('readFile', () => {
    return provider.readFile(file).then(result => {
      assert.equal(JSON.stringify(testJSON), result.toString());
    });
  });

  test('isJson', () => {
    assert.equal(true, provider.isJson(file.fsPath));
  });

  test('deleteFile', () => {
    return provider.delete(dir, { recursive : true }).then( _ => {
      return provider.isExists(file.fsPath);
    }).then(result => {
      assert.equal(false, result);
      console.log("e");
    });
  });
  console.log("f");
});
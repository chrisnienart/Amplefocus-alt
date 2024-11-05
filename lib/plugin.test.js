import { jest } from "@jest/globals"
import { mockAppWithContent, mockApp, mockPlugin, mockNote } from "./test-helpers.js"
import { CODE_HEADING, DEFAULT_BRANCH, MAX_REPLACE_CONTENT_LENGTH, ENTRY_LOCATIONS } from "./plugin-constants"

const REPO_URL = "https://github.com/alloy-org/plugin-builder";

// --------------------------------------------------------------------------------------
async function refreshWithContent(plugin, content) {
  const { app, note } = mockAppWithContent(content);
  expect(plugin.noteOption["Refresh"].check(app)).toBeTruthy();
  await plugin.noteOption["Refresh"].run(app);

  return { app, note };
}

// --------------------------------------------------------------------------------------
describe("This here plugin", () => {
  const plugin = mockPlugin();
  plugin._testEnvironment = true;

  // --------------------------------------------------------------------------------------
  it("should fail when there is nowhere to insert code", async () => {
    const content = `Baby's plugin
    Repo: ${ REPO_URL }
    |  |  |
    | ---- | ----------- |
    | name | Baby's plugin | 
    
    \`\`\`javascript
    {
      name: "Baby's"
    }
    \`\`\`
  `.replace(/^[\s]*/gm, "");

    const { app, note } = mockAppWithContent(content);
    app.alert = jest.fn();
    await plugin.insertText["Refresh"].run(app);
    expect(app.alert).toHaveBeenCalledWith(plugin._noSyncMessage());
  });

  it("should succeed regardless of the code block casing", async () => {
    const content = `Baby's plugin
    Repo: ${ REPO_URL }
    |  |  |
    | ---- | ----------- |
    | name | Baby's plugin | 
    
    # code block
    \`\`\`javascript
    {
      name: "Baby's"
    }
    \`\`\`
  `.replace(/^[\s]*/gm, "");

    const { app, note } = mockAppWithContent(content);
    await plugin.insertText["Refresh"].run(app);
    expect(note.body).toContain("async _inlined_plugin_import_inliner_js_fileContentFromUrl")
    expect(note.body).toContain("# code block")
  });

  // --------------------------------------------------------------------------------------
  it("should propagate repo to note", async () => {
    const content = `Baby's plugin
    Repo: ${ REPO_URL }
    |  |  |
    | ---- | ----------- |
    | name | Baby's plugin | 
    
  `.replace(/^[\s]*/gm, "");

    const pluginNoteUUID = "abc123";
    const note = mockNote(content, "Baby's plugin", pluginNoteUUID);
    const app = mockApp(note);
    expect(plugin.noteOption["Refresh"].check(app)).toBeTruthy();
    expect(pluginNoteUUID).toEqual(app.context.noteUUID);
    expect(app.notes.find(app.context.noteUUID)).toEqual(note);
    expect(note.content()).toBeTruthy();
    const repoUrl = await plugin.insertText["Sync"].check(app);
    expect(repoUrl).toEqual(repoUrl);

    await plugin.insertText["Sync"].run(app);
    expect(note.body).toContain("fileContentFromUrl");
  });

  // --------------------------------------------------------------------------------------
  it("should import a multi-line function declaration", async () => {
    const content = `Entry: ${ REPO_URL }/src/entry-test.js\n# Code block\n`.replace(/^[\s]*/g, "");
    const { note } = await refreshWithContent(plugin, content)
    const noteContent = note.content();
    expect(noteContent).toContain("multiLineDeclaration(argument, { options = false, moreOptions = [] } = {}) {");
  });

  // --------------------------------------------------------------------------------------
  it("should comment console.debug upon request", async () => {
    const content = `Entry: ${ REPO_URL }/src/entry-test.js\n# Code block\n`.replace(/^[\s]*/g, "");
    let { app, note } = mockAppWithContent(content);
    await plugin.noteOption["Refresh minus debug"].run(app)
    const noteContent = note.content();
    expect(noteContent).toContain("if (true) console.debug");
    expect(noteContent).toContain(`// console.debug("neat");`);
  })

  // --------------------------------------------------------------------------------------
  it("should allow specifying a custom entry file", async () => {
    const content = `Entry: ${ REPO_URL }/src/entry-test.js
    # Code block`.replace(/^[\s]*/gm, "");

    const { note } = await refreshWithContent(plugin, content);
    const noteContent = note.content();
    expect(noteContent).toContain("async _inlined_nested_import_js_wrappedFetch(");
    expect(noteContent).toContain("async _inlined_plugin_import_inliner_js_fetchWithRetry(");
    expect(noteContent.match(/async\s_inlined_plugin_import_inliner_js_fetchWithRetry\(/g).length).toEqual(1);
    expect(noteContent).toContain("async _inlined_plugin_import_inliner_js_fileContentFromUrl(");
  });

  // --------------------------------------------------------------------------------------
  it("should allow specifying constants", async () => {
    const content = `Entry: ${ REPO_URL }/src/constant-test.js
    # Code block`.replace(/^[\s]*/gm, "");

    const { note } = await refreshWithContent(plugin, content);
    const noteContent = note.content();
    expect(noteContent).toContain(`const heading = "${ CODE_HEADING }";`);
    expect(noteContent).toContain(`const branch = "${ DEFAULT_BRANCH }";`);
    expect(noteContent).toContain(`const locations = [ "${ ENTRY_LOCATIONS.join(`", "`) }" ];`);
    expect(noteContent).toContain(`// I will stay on line, promises { foo: "bar", bird: "plane" } and`)
    expect(noteContent).toContain(`const replaceLength = ${ MAX_REPLACE_CONTENT_LENGTH };`);
    expect(noteContent).toContain("const entryPoint = { hashie: \"cooo\", hootie: \"hoo\" }");
  });

  // --------------------------------------------------------------------------------------
  it("should allow importing fancy-function content", async () => {
    const content = `Entry: ${ REPO_URL }/src/fancy-function-test.js
    # Code block\n`.replace(/^[\s]*/gm, "");

    const { app, note } = await refreshWithContent(plugin, content);
    expect(app.notes.find(app.context.noteUUID)).toEqual(note);
    expect(note.content()).toBeTruthy();

    expect(note.body).toContain("*_inlined_fancy_function_import_js_generator");
    expect(note.body).not.toMatch(/^\s+};,\s*\n/gm);
  });

  // --------------------------------------------------------------------------------------
  it("should transform esbuild content", async () => {
    const content = `Entry: ${ REPO_URL }/src/compiled-test.js\n# Code Block\n`;
    const { app, note } = await refreshWithContent(plugin, content);
    expect(note.body).toMatch(/}\)\(\)$/m);
    expect(note.body).toContain("return plugin;")
  })
});

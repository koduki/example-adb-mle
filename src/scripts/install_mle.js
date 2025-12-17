/*
 * script: install_mle.js
 * Purpose: Generic loader to deploy a JS file as an MLE Module.
 * Usage: script install_mle.js <path_to_js_file> <module_name>
 * Context: Runs inside SQLcl (Nashorn/GraalJS)
 */

// args[0] is the script name itself usually, or depends on invocation.
// In SQLcl 'script file.js arg1 arg2', args is an array of arguments.
// args[0] = arg1, args[1] = arg2

if (args.length < 2) {
    ctx.write("Error: Missing arguments. Usage: script install_mle.js <js_path> <module_name>\n");
    throw "Missing arguments";
}

var jsPath = args[0];
var moduleName = args[1];

var sqlcl = ctx.getProperty("sqlcl");
var Path = Java.type("java.nio.file.Paths");
var Files = Java.type("java.nio.file.Files");
var String = Java.type("java.lang.String");

try {
    ctx.write("DEBUG: Deploying MLE Module: " + moduleName + " from " + jsPath + "\n");

    // Check file existence
    if (!Files.exists(Path.get(jsPath))) {
        throw "File not found: " + jsPath;
    }

    var contentBytes = Files.readAllBytes(Path.get(jsPath));
    var content = new String(contentBytes, "UTF-8");

    // Construct DDL
    // Using CREATE OR REPLACE to ensure updates match the file content
    // Use q-quote syntax to avoid escaping single quotes in JS code
    // Ensure module name is upper case
    var ddl = "CREATE OR REPLACE MLE MODULE " + moduleName.toUpperCase() + " LANGUAGE JAVASCRIPT AS q'~" +
        content + "~';";

    ctx.write("DEBUG: Executing DDL:\n" + ddl + "\n");

    // Execute
    sqlcl.setStmt(ddl);
    sqlcl.run();

    ctx.write("MLE Module '" + moduleName + "' deployed successfully.\n");

} catch (e) {
    ctx.write("ERROR deploying MLE module: " + e + "\n");
    throw e;
}

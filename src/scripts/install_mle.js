/*
 * script: install_mle.js
 * Purpose: Generic loader to deploy a JS file as an MLE Module.
 * Usage: script install_mle.js <path_to_js_file> <module_name>
 * Context: Runs inside SQLcl (Nashorn/GraalJS)
 */

// args[0] is the script name itself usually, or depends on invocation.
// In SQLcl 'script file.js arg1 arg2', args is an array of arguments.
// args[0] = arg1, args[1] = arg2

var System = Java.type("java.lang.System");

System.out.println("DEBUG: install_mle.js started");
System.out.println("DEBUG: args.length = " + args.length);
for (var i = 0; i < args.length; i++) {
    System.out.println("DEBUG: args[" + i + "] = " + args[i]);
}

if (args.length < 2) {
    System.out.println("Error: Missing arguments. Usage: script install_mle.js <js_path> <module_name>");
    // ctx.write("Error: Missing arguments. Usage: script install_mle.js <js_path> <module_name>\n");
    // Java.type("java.lang.System").exit(1); // Do not kill the session, just throw
    throw "Missing arguments";
}

var jsPath = args[0];
var moduleName = args[1];

var sqlcl = ctx.getProperty("sqlcl");
var Path = Java.type("java.nio.file.Paths");
var Files = Java.type("java.nio.file.Files");
var String = Java.type("java.lang.String");

try {
    ctx.write("Deploying MLE Module: " + moduleName + " from " + jsPath + "\n");

    // Check file existence
    if (!Files.exists(Path.get(jsPath))) {
        throw "File not found: " + jsPath;
    }

    var contentBytes = Files.readAllBytes(Path.get(jsPath));
    var content = new String(contentBytes, "UTF-8");

    // Construct DDL
    // Using CREATE OR REPLACE to ensure updates match the file content
    // Use q-quote syntax to avoid escaping single quotes in JS code
    var ddl = "CREATE OR REPLACE MLE MODULE " + moduleName + " LANGUAGE JAVASCRIPT AS q'~" +
        content + "~';\n/\n";

    // Execute
    sqlcl.setStmt(ddl);
    sqlcl.run();

    ctx.write("MLE Module '" + moduleName + "' deployed successfully.\n");

} catch (e) {
    ctx.write("ERROR deploying MLE module: " + e + "\n");
    throw e;
}

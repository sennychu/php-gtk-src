/*
  +----------------------------------------------------------------------+
  | PHP Version 5                                                        |
  +----------------------------------------------------------------------+
  | Copyright (c) 1997-2004 The PHP Group                                |
  +----------------------------------------------------------------------+
  | This source file is subject to version 3.0 of the PHP license,       |
  | that is bundled with this package in the file LICENSE, and is        |
  | available through the world-wide-web at the following url:           |
  | http://www.php.net/license/3_0.txt.                                  |
  | If you did not receive a copy of the PHP license and are unable to   |
  | obtain it through the world-wide-web, please send a note to          |
  | license@php.net so we can mail you a copy immediately.               |
  +----------------------------------------------------------------------+
  | Author: Wez Furlong <wez@thebrainroom.com>                           |
  +----------------------------------------------------------------------+
*/

/* $Id: buildconf.js,v 1.9 2007-05-29 12:40:22 auroraeosrose Exp $ */
// This generates a configure script for win32 build

var FSO = WScript.CreateObject("Scripting.FileSystemObject");
var MODULES = WScript.CreateObject("Scripting.Dictionary");
var dir = FSO.GetFolder("ext/gtk+");

if (FSO.FileExists('configure.js')) {
	FSO.DeleteFile('configure.js');
}
if (FSO.FileExists('sources.temp')) {
	FSO.DeleteFile('sources.temp');
}
if (FSO.FileExists('source_complete.txt')) {
	FSO.DeleteFile('source_complete.txt');
}

var C = FSO.CreateTextFile("configure.js", true);
var temp = FSO.CreateTextFile("win32/temp.bat", true);

WScript.StdOut.WriteBlankLines(1);
WScript.StdOut.WriteLine("Rebuilding configure.js");
WScript.StdOut.WriteBlankLines(1);

function file_get_contents(filename) {

	var F = FSO.OpenTextFile(filename, 1);
	var t = F.ReadAll();

	F.Close();
	return t;
}

function Module_Item(module_name, config_path, dir_line, content) {

	this.module_name = module_name;
	this.config_path = config_path;
	this.dir_line = dir_line;
	this.content = content;
}

function gen_modules() {

	var module_names = (new VBArray(MODULES.Keys())).toArray();
	var i, mod_name, j;
	var item;
	var output = "";

	for (i in module_names) {
		mod_name = module_names[i];
		item = MODULES.Item(mod_name);
		MODULES.Remove(mod_name);

		// TEMPORARY HACK - always make sure gtk+ is written first
		// STEPH SHOULD FIX THE REAL PROBLEM AT SOME POINT
		if (mod_name == 'gtk+')
		{
			output = emit_module(item) + output;
		}
		else
		{
			output += emit_module(item);
		}

		// output += emit_module(item);
		// END HACK
	}

	return output;
}

function emit_module(item) {

	return item.dir_line + item.content;
}

function find_config_w32(dirname) {

	if (!FSO.FolderExists(dirname)) {
		return;
	}

	var f = FSO.GetFolder(dirname);
	var fc = new Enumerator(f.SubFolders);
	var c, i, ok, n;
	var item = null;

	for (; !fc.atEnd(); fc.moveNext()) {
		ok = true;
		/* check if we already picked up a module with the same dirname;
		 * if we have, don't include it here */
		n = FSO.GetFileName(fc.item());

		if (n == 'CVS' || n == 'tests' || n == '.svn')
			continue;

		WScript.StdOut.Write("Checking " + dirname + "/" + n);
		if (MODULES.Exists(n)) {
			WScript.StdOut.WriteLine("Skipping " + dirname + "/" + n + " -- already have a module with that name");
			continue;
		}

		c = FSO.BuildPath(fc.item(), "config.w32");

		if (!FSO.FileExists(c)) {

			WScript.StdOut.WriteLine("		Not currently available for Windows systems");

		} else {

			WScript.StdOut.WriteLine("		Available");

			var dir_line = "configure_module_dirname = condense_path(FSO.GetParentFolderName('"
							   + c.replace(new RegExp('(["\\\\])', "g"), '\\$1') + "'));\r\n";
			var contents = file_get_contents(c);

			item = new Module_Item(n, c, dir_line, contents);
			MODULES.Add(n, item);
		}
	}
}

/* buildconf should clean up generated files */
if (FSO.FileExists('configure.bat')) {
	FSO.DeleteFile('configure.bat');
}

if (FSO.FolderExists('Release')) {
	FSO.DeleteFolder('Release');
}

if (FSO.FolderExists('Debug')) {
	FSO.DeleteFolder('Debug');
}

if (FSO.FileExists('main\\php_gtk_version.h')) {
	FSO.DeleteFile('main\\php_gtk_version.h');
}

if (FSO.FileExists('Makefile')) {
	FSO.DeleteFile('Makefile');
}

var F = FSO.CreateTextFile("configure.bat", true);

iter = new Enumerator(dir.Files);
name = "";
for (; !iter.atEnd(); iter.moveNext()) {
	name = FSO.GetFileName(iter.item());
	if (name.match(new RegExp("gen_")) || name.match(new RegExp(".cache"))) {
		FSO.DeleteFile(iter.item());
	}
}

// Write the head of the configure script
C.WriteLine("/* This file is automatically generated from win32/confutils.js */");
C.Write(file_get_contents("win32/confutils.js"));

// Pull in code from extensions
modules = file_get_contents("win32/config.w32.in");

// Pick up confs from extensions if present
find_config_w32("ext");

/* Now generate contents of module based on MODULES */
modules += gen_modules();

// Look for ARG_ENABLE or ARG_WITH calls
re = new RegExp("(ARG_(ENABLE|WITH|IS)\([^;]+\);)", "gm");
calls = modules.match(re);
for (i = 0; i < calls.length; i++) {
	item = calls[i];
	C.WriteLine("try {");
	C.WriteLine(item);
	C.WriteLine("} catch (e) {");
	C.WriteLine('\tSTDOUT.WriteLine("problem: " + e);');
	C.WriteLine("}");
}

C.WriteBlankLines(1);
C.WriteLine("conf_process_args();");
C.WriteBlankLines(1);

// Comment out the calls from their original positions
modules = modules.replace(re, "/* $1 */");
C.Write(modules);

C.WriteBlankLines(1);
C.Write("generate_files();");

// Generate configure.bat utility
F.Write("@ECHO OFF\r\ncscript /nologo configure.js %*");

WScript.StdOut.WriteBlankLines(1);
WScript.StdOut.WriteLine("Now run 'configure --help'");

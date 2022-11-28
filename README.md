# TinyCircuits-Web-Programming-Platform

## TODO
* [] Make this work with TinyTV Mini
* [] Make sure fill buffer loop will timeout after not getting data for long enough and go back to looking for TV detection command
* [] Make streaming portion of firmware into class and make it able to be dropped in
* [] 

## How to build and develop

1. If you just cloned this repo, execute `npm i` in the cloned root folder to install dependencies for building the static site (only static, no server interaction).
2. Execute `npm run watch` in root to run server at `https://127.0.0.1/`. Each time a file that is marked as tracked in `tailwind.config.js` is saved, the website will automatically update but you'll need to refresh the page. The triggering files are for Tailwind CSS and daisyUI. If a JS/CSS/HTML file uses Tailwind CSS or daisyUI classes, make sure they are tracked in `tailwind.config.js` otherwise you'll get bugs where elements do not have the correct formatting or disappear because the position formatting was lost.
3. Should be able to run `npm run build` to build the site without watching, see `package.json` for commands/scripts

NOTE: Uses assets from 'src/js' and 'src/html' during `npm run watch` but the compiled css is in 'dist' (the css is the only asset in 'dist' that has to do with running the page during 'npm run watch').

## Build process
`package.json` contains a command `build` under `scripts` that is run when the `npm run watch` command detects a change. When that build command runs it builds the Tailwind CSS output in `dist`, based on the input file, and runs a gulpfile that will move any html files, like `src/html/index.html`, to `dist` (should only be one file `index.html` but it will move more). Then the JavaScript files under `src/js` are webpacked and combined into a file `dist/main.js.`

Now, all the `dist` folder will contain is hopefully three files `index.html`, `main.js`, and 'tailwind_output.css,' but these need combined into a single html file for Shopify. The specific file `dist_index_find_and_replace.py` is finally run which will look for specific lines like `<script type="module" src="/src/js/main.js"></script>` and then replace the line with linked file contents in the `dist_index_find_and_replace.py` script.

Only copy the contents of dist/index.html to the Shopify page template "pages.tvlive.liquid" under the "{layout: none}" line.

# Setup from scratch (for reference if needed)
1. `mkdir TinyCircuits-Web-Programming-Platform`
2. `cd TinyCircuits-Web-Programming-Platform`
3. `mkdir src`
4. `mkdir dist`
5. Create file called `index.js` at `TinyCircuits-Web-Programming-Platform/index.js`
6. Create file called `index.html` at `TinyCircuits-Web-Programming-Platform/src/html/index.html` and copy paste
```html
<!doctype html>

<html>
    <head>
        <title>Template website</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="/dist/tailwind_output.css" rel="stylesheet">
    </head>

    <body>
        @@include('./common/header.html')
    </body>
</html>
```
7. Create a file `header.html` at `TinyCircuits-Web-Programming-Platform/src/html/common/header.html` and cop paste:
```html
<div class="min-w-full h-12 bg-orange-600">
    Header
</div>
```
8. `npm init` (just enter whatever for the fields)

Tailwind CSS setup (https://tailwindcss.com/docs/installation)

9. `npm install -D tailwindcss`
10. `npx tailwindcss init` (creates `tailwind.config.js` at `TinyCircuits-Web-Programming-Platform/tailwind.config.js`)
11. Open `tailwind.config.js` and copy paste
```js
module.exports = {
  content: ['./src/**/*.{html,js}'],
  theme: {
    extend: {},
  },
  plugins: [],
}
```
12. Create input Tailwind CSS file called `tailwind_input.css` at `TinyCircuits-Web-Programming-Platform/src/tailwind_input.css`
13. Open `tailwind_input.css` and copy paste (https://tailwindcss.com/docs/functions-and-directives)
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```
14. `cd ..`
15. Manually build Tailwind CSS with `npx tailwindcss -i ./src/tailwind_input.css -o ./dist/tailwind_output.css` (see later steps for how to use in npm build and watch commands)
16. Use output css file in html with `<link href="/dist/tailwind_output.css" rel="stylesheet">`

Gulp HTML preprocessor setup (https://css-tricks.com/the-simplest-ways-to-handle-html-includes/#aa-use-gulp)

17. `npm install --save-dev gulp`
18. `npm install --save-dev gulp-file-include`
19. Create a file called `gulpfile.js` at `TinyCircuits-Web-Programming-Platform/gulpfile.js` and copy paste
```js
var fileinclude = require('gulp-file-include');
var gulp = require('gulp');
 
gulp.src(['./src/html/**/*.html'])
.pipe(fileinclude({
    prefix: '@@',
    basepath: '@file'
}))
.pipe(gulp.dest('./dist'));
```
20. `cd TinyCircuits-Web-Programming-Platform`
21. `node gulpfile.js` (copies html and replaces includes in dist folder, see later steps on how to setup with build and watch node scripts/commands)

Setup node server (https://nodejs.org/en/knowledge/HTTP/servers/how-to-create-a-HTTPS-server/)

22. `cd TinyCircuits-Web-Programming-Platform`
23. `openssl genrsa -out key.pem`
24. `openssl req -new -key key.pem -out csr.pem`
    1. `US`
    2. `Ohio`
    3. `Akron`
    4. `TinyCircuits`
    5. `Canal Place`
    6. `TinyCircuits`
    7. `jmarcum@tinycircuits.com`
    8. `test`
    9. ``
25. `openssl x509 -req -days 9999 -in csr.pem -signkey key.pem -out cert.pem`
26. `rm csr.pem`
27. `npm install express`
27. Copy paste below to `index.js`
```js
var express = require('express');
var path = require('path');
var https = require('https');
var fs = require('fs');

// This line is from the Node.js HTTPS documentation.
const options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
};

// Create a service (the app object is just a callback).
var app = express();

app.use('/', express.static(__dirname));

// Create an HTTPS service identical to the HTTP service.
https.createServer(options, app).listen(443);


// Show '/dist/index.html' file at URL https://localhost:443
app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, '/dist/index.html'));
});
```
28. Run the server manually with `node index.js`
29. Access https server at `https://localhost:443/`

Setup node build command

30. Open `TinyCircuits-Web-Programming-Platform/package.json`
31. In the `scripts` section add the script `"build": "npx tailwindcss -i ./src/tailwind_input.css -o ./dist/tailwind_output.css & node gulpfile.js"`
32. Use `npm run build` to ready the `dist` folder for deployment

Setup start command

33. Open `TinyCircuits-Web-Programming-Platform/package.json`
34. In the `scripts` section add the script `"start": "node index.js"`
35. Use `npm run start` to start the server and access it at `https://localhost:443/`

Setup npm-watch

36. `npm install npm-watch` (https://www.npmjs.com/package/npm-watch)
37. Open `TinyCircuits-Web-Programming-Platform/package.json`
38. Make sure watch and scripts section look as below:
```json
"watch": {
"build": {
    "patterns": ["src", "index.js"],
    "extensions": "js,jsx,html,css"
},
"start": {
    "patterns": ["src", "index.js"],
    "extensions": "js,jsx,html,css"
}
},
"scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "build": "npx tailwindcss -i ./src/tailwind_input.css -o ./dist/tailwind_output.css & node gulpfile.js",
    "start": "node index.js",
    "watch": "npm-watch"
},
```
39. Run for faster dev with `npm run watch` (manually refresh page after done auto building)
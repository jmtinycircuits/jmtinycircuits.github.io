# Open to read contents
dist_index = open("dist/index.html", 'r')
dist_index_lines = dist_index.readlines()
dist_index.close()

# Open to write to it
dist_index = open("dist/index.html", 'w')

for line in dist_index_lines:
    if "<link href=\"/dist/tailwind_output.css\" rel=\"stylesheet\">" in line:
        f = open("dist/tailwind_output.css", 'r')
        line = line.replace("<link href=\"/dist/tailwind_output.css\" rel=\"stylesheet\">", "<style>" + f.read() + "</style>")
        f.close()
    elif "<script type=\"module\" src=\"/src/js/main.js\"></script>" in line:
        f = open("dist/main.js", 'r')
        line = line.replace("<script type=\"module\" src=\"/src/js/main.js\"></script>", "<script>" + f.read() + "</script>")
        f.close()

    dist_index.write(line)

dist_index.close()


print("Done building! Ready to serve on a static site!")
    
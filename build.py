"""Inline everything into one file, dist/lab-cpet-tool.html, which works offline. Add the libraries with plain concatenation, so the file stays readable."""
import pathlib
root=pathlib.Path(__file__).parent; h=(root/'index.html').read_text()
h=h.replace('<link rel="stylesheet" href="src/styles.css">','<style>\n'+(root/'src/styles.css').read_text()+'\n</style>')
for src in ['vendor/plotly.min.js','vendor/xlsx.min.js','src/parse.js','src/gdcore.js','src/protocol.js','src/oxynet_models.js','src/oxynet.js','src/lactate.js','src/app.js']:
    code=(root/src).read_text().replace('</script','<\\/script')
    h=h.replace(f'<script src="{src}"></script>','<script>\n'+code+'\n</script>')
(root/'dist').mkdir(exist_ok=True); (root/'dist/lab-cpet-tool.html').write_text(h)
print('built',round(len(h)/1e6,2),'MB')

"""Turn pyoxynet's frozen CNN and LSTM models into src/oxynet_models.js, so the tool can run them with no extra libraries.
Needs: pip install pyoxynet tflite. Run once per pyoxynet version."""
import base64, json, os, pathlib
import numpy as np, tflite, pyoxynet
d = pathlib.Path(pyoxynet.__file__).parent / 'models'
names = {getattr(tflite.BuiltinOperator, k): k for k in dir(tflite.BuiltinOperator) if k.isupper()}
TYPES = {tflite.TensorType.FLOAT32: 'f', tflite.TensorType.INT32: 'i'}
def options(op, kind):
    o = op.BuiltinOptions()
    if o is None: return {}
    def get(cls, **fields):
        x = cls(); x.Init(o.Bytes, o.Pos); return {k: getattr(x, v)() for k, v in fields.items()}
    if kind == 'CONV_2D': return get(tflite.Conv2DOptions, pad='Padding', sw='StrideW', sh='StrideH', act='FusedActivationFunction', dw='DilationWFactor', dh='DilationHFactor')
    if kind == 'MAX_POOL_2D': return get(tflite.Pool2DOptions, pad='Padding', sw='StrideW', sh='StrideH', fw='FilterWidth', fh='FilterHeight', act='FusedActivationFunction')
    if kind == 'FULLY_CONNECTED': return get(tflite.FullyConnectedOptions, act='FusedActivationFunction', keep='KeepNumDims')
    if kind == 'ADD': return get(tflite.AddOptions, act='FusedActivationFunction')
    if kind == 'SUB': return get(tflite.SubOptions, act='FusedActivationFunction')
    if kind == 'MUL': return get(tflite.MulOptions, act='FusedActivationFunction')
    if kind == 'PACK': return get(tflite.PackOptions, axis='Axis', n='ValuesCount')
    if kind == 'UNPACK': return get(tflite.UnpackOptions, axis='Axis', n='Num')
    if kind == 'SOFTMAX': return get(tflite.SoftmaxOptions, beta='Beta')
    if kind == 'MEAN': return get(tflite.ReducerOptions, keep='KeepDims')
    return {}
out = {}
for m in ['cnn', 'lstm']:
    b = (d / f'{m}.tflite').read_bytes(); M = tflite.Model.GetRootAsModel(b, 0); G = M.Subgraphs(0); tensors = []
    for i in range(G.TensorsLength()):
        t = G.Tensors(i); e = {'s': [int(x) for x in t.ShapeAsNumpy()] if t.ShapeLength() else [], 't': TYPES[t.Type()]}
        buf = M.Buffers(t.Buffer())
        if buf.DataLength(): e['d'] = base64.b64encode(buf.DataAsNumpy().tobytes()).decode()
        tensors.append(e)
    ops = []
    for i in range(G.OperatorsLength()):
        op = G.Operators(i); code = M.OperatorCodes(op.OpcodeIndex()); kind = names[max(code.BuiltinCode(), code.DeprecatedBuiltinCode())]
        ops.append({'k': kind, 'i': [int(x) for x in op.InputsAsNumpy()], 'o': [int(x) for x in op.OutputsAsNumpy()], 'a': options(op, kind)})
    out[m] = {'tensors': tensors, 'ops': ops, 'in': int(G.Inputs(0)), 'out': int(G.Outputs(0))}
p = pathlib.Path(__file__).parent.parent / 'src/oxynet_models.js'
p.write_text('/* Frozen models from pyoxynet ' + pyoxynet.__version__ + ' (Zignoli A; MIT licence), converted by tools/export_oxynet.py. */\n(function (root) { const M = ' + json.dumps(out, separators=(',', ':')) + ';\n if (typeof module !== "undefined" && module.exports) module.exports = M; else root.OXY_MODELS = M; })(this);\n')
print('written', round(p.stat().st_size / 1024), 'kB', {k: len(v['ops']) for k, v in out.items()})

"""Optional reproducible build: Python + onnx==1.19.0. Not required to run Node demo."""
from pathlib import Path
import hashlib
import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper
from onnx.reference import ReferenceEvaluator

root = Path(__file__).resolve().parent
graph = helper.make_graph(
    [helper.make_node('MatMul', ['input', 'weights'], ['product']),
     helper.make_node('Add', ['product', 'bias'], ['scores'])],
    'archive-affine-v1',
    [helper.make_tensor_value_info('input', TensorProto.FLOAT, [1, 1])],
    [helper.make_tensor_value_info('scores', TensorProto.FLOAT, [1, 2])],
    [numpy_helper.from_array(np.array([[-1, 1]], dtype=np.float32), 'weights'),
     numpy_helper.from_array(np.array([1, 0], dtype=np.float32), 'bias')])
model = helper.make_model(graph, producer_name='attested-fact-binding',
                          opset_imports=[helper.make_opsetid('', 13)], ir_version=8)
onnx.checker.check_model(model, full_check=True)
for x in [0, 1]:
    output = ReferenceEvaluator(model).run(None, {'input': np.array([[x]], dtype=np.float32)})[0]
    assert output.tolist() == [[1-x, x]]
data = model.SerializeToString(deterministic=True)
(root / 'classifier.onnx').write_bytes(data)
print(f'ONNX PASS: both binary inputs; {len(data)} bytes; sha256={hashlib.sha256(data).hexdigest()}')

// Empty stub for `onnxruntime-node`. The Node-only ONNX runtime is never
// used in this app (Whisper runs in the browser via onnxruntime-web inside
// a Web Worker). We replace the import so @xenova/transformers' static
// `import * as ONNX_NODE from 'onnxruntime-node'` resolves to a noop module
// instead of `webpackMissingModule`.
module.exports = {};
